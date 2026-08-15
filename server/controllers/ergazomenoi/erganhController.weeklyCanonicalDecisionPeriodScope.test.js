'use strict';

const assert = require('node:assert/strict');
const Controller = require('./erganhController');

const { executeWeeklyCanonicalDecisionCreation } = Controller.__weeklyCanonicalDecisionTestHooks;
const req = { session: { userTeam: 'THA', companyInUse: 'company', appDate: '2026-06-30' } };
const body = { ypokatasthma: '0000', employee_kodikos: '0014', week_start: '2026-06-29' };
const dates = [
    '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02',
    '2026-07-03', '2026-07-04', '2026-07-05'
];
const context = {
    scope: { week_start: '2026-06-29', week_end: '2026-07-05' },
    rows: dates.map((hmeromhnia) => ({ hmeromhnia })),
    snapshotInput: { snapshot: true }
};

(async () => {
    let rejectedRecordCalls = 0;
    await assert.rejects(() => executeWeeklyCanonicalDecisionCreation({
        req, body,
        loadContext: async () => context,
        assertPeriodAccess: async () => {
            const error = new Error('scope mismatch');
            error.code = 'PERIOD_CONTROL_SCOPE_MISMATCH';
            throw error;
        },
        validateCommand: () => ({ command: true }),
        recordDecision: async () => { rejectedRecordCalls += 1; }
    }), (error) => error.code === 'PERIOD_CONTROL_SCOPE_MISMATCH');
    assert.equal(rejectedRecordCalls, 0);

    let allowedRecordCalls = 0;
    let periodFenceCalls = 0;
    let canonicalWriteCallbacks = 0;
    let guardedRange = null;
    const result = await executeWeeklyCanonicalDecisionCreation({
        req, body,
        loadContext: async () => context,
        assertPeriodAccess: async (_req, _branch, _token, range) => {
            guardedRange = range;
            return { scope: { period_start: '2026-06-01', period_end: '2026-06-30' }, token: { version: 3 } };
        },
        validateCommand: () => ({ command: true }),
        recordDecision: async ({ mutationRunner, currentInput }) => {
            allowedRecordCalls += 1;
            assert.deepEqual(currentInput, context.snapshotInput);
            await mutationRunner(async (session) => {
                canonicalWriteCallbacks += 1;
                assert.equal(session, 'fake-transaction-session');
                return { stored: true };
            });
            return { idempotent: false, record: { ok: true } };
        },
        runPeriodFence: async ({ scope, expectedToken, work }) => {
            periodFenceCalls += 1;
            assert.deepEqual(scope, { period_start: '2026-06-01', period_end: '2026-06-30' });
            assert.deepEqual(expectedToken, { version: 3 });
            return { result: await work({ session: 'fake-transaction-session' }) };
        }
    });
    assert.equal(allowedRecordCalls, 1);
    assert.equal(periodFenceCalls, 1);
    assert.equal(canonicalWriteCallbacks, 1);
    assert.equal(result.record.ok, true);
    assert.deepEqual(guardedRange, {
        start: '2026-06-29', end: '2026-07-05', kind: 'WEEKLY_CONTEXT',
        authoritativeRowDates: dates
    });

    let staleFenceCalls = 0;
    let generalFenceCalls = 0;
    const staleResult = await executeWeeklyCanonicalDecisionCreation({
        req, body,
        loadContext: async () => context,
        assertPeriodAccess: async () => ({
            scope: { period_start: '2026-06-01', period_end: '2026-06-30' },
            token: { exists: true, version: 3 },
            state: { effective_mode: 'HISTORICAL_RECONSTRUCTION_STALE' }
        }),
        validateCommand: () => ({ command: true }),
        recordDecision: async ({ mutationRunner }) => {
            await mutationRunner(async (session) => {
                assert.equal(session, 'stale-canonical-transaction');
                return { stored: true };
            });
            return { idempotent: false, record: { stalePeriodDecision: true } };
        },
        runPeriodFence: async () => { generalFenceCalls += 1; },
        runStalePeriodFence: async ({ work }) => {
            staleFenceCalls += 1;
            return { result: await work({ session: 'stale-canonical-transaction' }) };
        }
    });
    assert.equal(staleFenceCalls, 1);
    assert.equal(generalFenceCalls, 0);
    assert.equal(staleResult.record.stalePeriodDecision, true);

    console.log('weekly canonical decision period-scope orchestration tests: PASS');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
