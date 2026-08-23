'use strict';

const assert = require('node:assert/strict');
const { runWithStaleStage2MaterializationWriteFence } = require(
    './apasxoliseisPeriodControlService'
);

const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    period_start: '2026-06-01', period_end: '2026-06-30' };
function store(overrides = {}) {
    let record = { ...scope, status: 'OPEN', version: 3, write_fence_version: 25,
        deadline: new Date('2026-07-31Z'), active_calculation_id: '',
        historical_reconstruction_status: 'COMPLETED', historical_reconstruction_version: 1,
        historical_dependency_fingerprint: 'a'.repeat(64), ...overrides };
    return { model: { async findOneAndUpdate(filter, update) {
        if (filter.status !== record.status || filter.version !== record.version ||
            filter.write_fence_version !== record.write_fence_version ||
            record.historical_reconstruction_status !== 'COMPLETED' ||
            record.historical_reconstruction_version < 1 || record.active_calculation_id) return null;
        record = { ...record, ...update.$set,
            write_fence_version: record.write_fence_version + update.$inc.write_fence_version };
        return { ...record };
    } }, snapshot: () => structuredClone(record), restore: (value) => { record = value; } };
}
function options(source, overrides = {}) {
    return { scope, expectedToken: { exists: true, stored_status: 'OPEN', version: 3,
        write_fence_version: 25 },
        now: new Date('2026-08-18Z'), periodControlModel: source.model,
        indexGuard: async () => {}, fingerprintResolver: async () => ({
            dependency_fingerprint: 'b'.repeat(64) }),
        transactionRunner: async (work) => { const before = source.snapshot();
            try { return await work({ transaction: true }); }
            catch (error) { source.restore(before); throw error; } }, ...overrides };
}

(async () => {
    for (const classification of ['REST_REPO', 'NON_WORK']) {
        const source = store(); let envelope;
        const result = await runWithStaleStage2MaterializationWriteFence({
            ...options(source), work: async (value) => { envelope = value; return classification; }
        });
        assert.equal(result.result, classification);
        assert.ok(envelope.session);
        assert.equal(envelope.state.effective_mode, 'HISTORICAL_RECONSTRUCTION_STALE');
        assert.equal(envelope.period_control_version, 3);
        assert.equal(envelope.period_write_fence_version, 26);
    }
    for (const source of [store({ status: 'LOCKED' }),
        store({ historical_reconstruction_status: 'AUTHORIZED' }),
        store({ active_calculation_id: 'calculation' })]) {
        await assert.rejects(() => runWithStaleStage2MaterializationWriteFence({
            ...options(source), work: async () => 'must-not-run' }),
        { code: 'PERIOD_CONTROL_STATE_CONFLICT' });
    }
    const changedToken = store();
    await assert.rejects(() => runWithStaleStage2MaterializationWriteFence({
        ...options(changedToken), expectedToken: { exists: true, stored_status: 'OPEN', version: 2 },
        work: async () => 'must-not-run' }), { code: 'PERIOD_CONTROL_STATE_CONFLICT' });
    const changedWriteFence = store({ write_fence_version: 26 });
    await assert.rejects(() => runWithStaleStage2MaterializationWriteFence({
        ...options(changedWriteFence), work: async () => 'must-not-run'
    }), { code: 'PERIOD_CONTROL_STATE_CONFLICT' });
    const stableDependency = store();
    await assert.rejects(() => runWithStaleStage2MaterializationWriteFence({
        ...options(stableDependency), fingerprintResolver: async () => ({
            dependency_fingerprint: 'a'.repeat(64) }), work: async () => 'must-not-run' }),
    { code: 'PERIOD_CONTROL_STALE_STAGE2_MATERIALIZATION_NOT_ALLOWED' });
    const rollback = store(); const before = rollback.snapshot(); const writes = [];
    await assert.rejects(() => runWithStaleStage2MaterializationWriteFence({
        ...options(rollback, { transactionRunner: async (work) => {
            const periodBefore = rollback.snapshot(); const writesBefore = [...writes];
            try { return await work({ transaction: true }); } catch (error) {
                rollback.restore(periodBefore); writes.splice(0, writes.length, ...writesBefore);
                throw error;
            }
        } }), work: async () => { writes.push('daily', 'state', 'audit');
            throw new Error('audit failure'); } }));
    assert.deepEqual(rollback.snapshot(), before);
    assert.deepEqual(writes, []);
    console.log('stale historical Stage-2 materialization fence tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
