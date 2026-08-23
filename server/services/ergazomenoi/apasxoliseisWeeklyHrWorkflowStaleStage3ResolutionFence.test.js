'use strict';

const assert = require('node:assert/strict');
const { runWithStaleStage3ResolutionWriteFence } = require('./apasxoliseisPeriodControlService');

const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    period_start: '2026-06-01', period_end: '2026-06-30' };
function model(overrides = {}) {
    const record = { ...scope, status: 'OPEN', version: 3, write_fence_version: 9,
        deadline: new Date('2026-07-31Z'), active_calculation_id: '',
        historical_reconstruction_status: 'COMPLETED', historical_reconstruction_version: 1,
        historical_dependency_fingerprint: 'a'.repeat(64), ...overrides };
    return { record, async findOneAndUpdate(filter, update) {
        if (filter.status !== record.status || filter.version !== record.version ||
            record.historical_reconstruction_status !== 'COMPLETED' ||
            record.historical_reconstruction_version < 1 || record.active_calculation_id) return null;
        record.write_fence_version += update.$inc.write_fence_version;
        Object.assign(record, update.$set); return { ...record };
    } };
}
(async () => {
    const period = model(); let callback;
    const result = await runWithStaleStage3ResolutionWriteFence({ scope,
        expectedToken: { exists: true, stored_status: 'OPEN', version: 3 },
        periodControlModel: period, indexGuard: async () => {},
        fingerprintResolver: async () => ({ dependency_fingerprint: 'b'.repeat(64) }),
        transactionRunner: async (work) => work({ transaction: true }),
        work: async (envelope) => { callback = envelope; return 'ok'; } });
    assert.equal(result.result, 'ok');
    assert.ok(callback.session);
    assert.equal(callback.period_control_version, 3);
    assert.equal(callback.period_write_fence_version, 10);
    assert.equal(period.record.historical_reconstruction_status, 'COMPLETED');
    assert.equal(period.record.historical_reconstruction_version, 1);
    assert.equal(period.record.active_calculation_id, '');
    for (const invalid of [model({ status: 'LOCKED' }),
        model({ historical_reconstruction_status: 'AUTHORIZED' }),
        model({ active_calculation_id: 'calculation' })]) {
        await assert.rejects(() => runWithStaleStage3ResolutionWriteFence({ scope,
            expectedToken: { exists: true, stored_status: 'OPEN', version: 3 },
            periodControlModel: invalid, indexGuard: async () => {},
            fingerprintResolver: async () => ({ dependency_fingerprint: 'b'.repeat(64) }),
            transactionRunner: async (work) => work({}), work: async () => {} }),
        { code: 'PERIOD_CONTROL_STATE_CONFLICT' });
    }
    console.log('stale historical Stage-3 resolution fence tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
