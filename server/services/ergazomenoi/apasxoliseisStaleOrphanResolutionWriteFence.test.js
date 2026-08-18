'use strict';

const assert = require('assert');
const {
    runWithStaleOrphanResolutionWriteFence
} = require('./apasxoliseisPeriodControlService');

const scope = {
    team: 'THA',
    company_kod: 'company-1',
    ypokatasthma: '0000',
    period_start: '2026-06-01',
    period_end: '2026-06-30'
};
const storedFingerprint = 'a'.repeat(64);
const changedFingerprint = 'b'.repeat(64);

function createStore(overrides = {}) {
    let record = {
        status: 'OPEN',
        version: 12,
        write_fence_version: 3,
        deadline: new Date('2026-07-31T00:00:00.000Z'),
        historical_reconstruction_status: 'COMPLETED',
        historical_reconstruction_version: 1,
        historical_dependency_fingerprint: storedFingerprint,
        active_calculation_id: '',
        ...overrides
    };
    return {
        model: {
            async findOneAndUpdate(filter, update) {
                const calculationIdle = !record.active_calculation_id;
                if (record.status !== filter.status || record.version !== filter.version ||
                    record.historical_reconstruction_status !==
                        filter.historical_reconstruction_status ||
                    record.historical_reconstruction_version < 1 || !calculationIdle) return null;
                record = {
                    ...record,
                    ...update.$set,
                    write_fence_version: record.write_fence_version +
                        Number(update.$inc?.write_fence_version || 0)
                };
                return { ...record };
            }
        },
        snapshot: () => structuredClone(record),
        restore: (snapshot) => { record = structuredClone(snapshot); }
    };
}

function transactionalRunner(store) {
    return async (work) => {
        const before = store.snapshot();
        try {
            return await work({ id: 'simulated-stale-orphan-transaction' });
        } catch (error) {
            store.restore(before);
            throw error;
        }
    };
}

function options(store, overrides = {}) {
    return {
        scope,
        expectedToken: { exists: true, stored_status: 'OPEN', version: 12 },
        now: new Date('2026-08-17T00:00:00.000Z'),
        periodControlModel: store.model,
        indexGuard: async () => ({ ready: true }),
        fingerprintResolver: async () => ({ dependency_fingerprint: changedFingerprint }),
        transactionRunner: transactionalRunner(store),
        ...overrides
    };
}

(async () => {
    const employee0009Store = createStore();
    const guards = [];
    const successful = await runWithStaleOrphanResolutionWriteFence({
        ...options(employee0009Store),
        work: async ({ session, state }) => {
            guards.push('token', 'completed-reconstruction', 'idle-calculation',
                'dependency-fingerprint', 'transaction');
            assert.strictEqual(session.id, 'simulated-stale-orphan-transaction');
            assert.strictEqual(state.effective_mode, 'HISTORICAL_RECONSTRUCTION_STALE');
            return {
                employee_kodikos: '0009',
                date: '2026-06-07',
                orphan_type: 'START_ONLY',
                interval: '14:38-23:08'
            };
        }
    });
    assert.deepStrictEqual(successful.result, {
        employee_kodikos: '0009', date: '2026-06-07',
        orphan_type: 'START_ONLY', interval: '14:38-23:08'
    });
    assert.deepStrictEqual(guards, ['token', 'completed-reconstruction', 'idle-calculation',
        'dependency-fingerprint', 'transaction']);

    const tokenStore = createStore();
    await assert.rejects(() => runWithStaleOrphanResolutionWriteFence({
        ...options(tokenStore),
        expectedToken: { exists: true, stored_status: 'OPEN', version: 11 },
        work: async () => 'must-not-run'
    }), (error) => error.code === 'PERIOD_CONTROL_STATE_CONFLICT');

    const calculationStore = createStore({ active_calculation_id: 'calculation-1' });
    await assert.rejects(() => runWithStaleOrphanResolutionWriteFence({
        ...options(calculationStore), work: async () => 'must-not-run'
    }), (error) => error.code === 'PERIOD_CONTROL_STATE_CONFLICT');

    const fingerprintStore = createStore();
    await assert.rejects(() => runWithStaleOrphanResolutionWriteFence({
        ...options(fingerprintStore),
        fingerprintResolver: async () => ({ dependency_fingerprint: storedFingerprint }),
        work: async () => 'must-not-run'
    }), (error) => error.code === 'PERIOD_CONTROL_STALE_ORPHAN_RESOLUTION_NOT_ALLOWED');

    const atomicStore = createStore();
    const beforeFailure = atomicStore.snapshot();
    const simulatedWrites = [];
    await assert.rejects(() => runWithStaleOrphanResolutionWriteFence({
        ...options(atomicStore),
        transactionRunner: async (work) => {
            const before = atomicStore.snapshot();
            const writesBefore = structuredClone(simulatedWrites);
            try {
                return await work({ id: 'simulated-reusable-transaction' });
            } catch (error) {
                atomicStore.restore(before);
                simulatedWrites.splice(0, simulatedWrites.length, ...writesBefore);
                throw error;
            }
        },
        work: async () => {
            simulatedWrites.push('daily-resolution', 'derived-update', 'orphan-metadata');
            const error = new Error('simulated reusable creation failure');
            error.code = 'SIMULATED_REUSABLE_CREATION_FAILURE';
            throw error;
        }
    }), (error) => error.code === 'SIMULATED_REUSABLE_CREATION_FAILURE');
    assert.deepStrictEqual(simulatedWrites, []);
    assert.deepStrictEqual(atomicStore.snapshot(), beforeFailure);

    console.log('stale orphan resolution write fence tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
