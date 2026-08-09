'use strict';

const assert = require('assert');
const {
    SOURCE_FIELDS,
    dependencyWindow,
    fingerprintRows,
    projectionForHistoricalState,
    authorizeHistoricalReconstruction,
    calculateHistoricalFingerprints,
    completeHistoricalReconstruction
} = require('./apasxoliseisHistoricalPeriodReconstructionService');
const { normalizeScope, calculatePeriodDeadline, projectPeriodControl,
    acquirePeriodCalculationOwnership } = require('./apasxoliseisPeriodControlService');

const user = { userRole: 'HR', userId: '507f1f77bcf86cd799439011', userName: 'HR User' };
const mayScope = normalizeScope({ team: 'THA', company_kod: 'company', ypokatasthma: '0',
    period_start: '2026-05-01', period_end: '2026-05-31' });
const juneScope = normalizeScope({ team: 'THA', company_kod: 'company', ypokatasthma: '0',
    period_start: '2026-06-01', period_end: '2026-06-30' });

assert.strictEqual(dependencyWindow(mayScope.period_start).start.toISOString().slice(0, 10), '2026-04-27');
assert.strictEqual(dependencyWindow(mayScope.period_start).end.toISOString().slice(0, 10), '2026-04-30');
assert.deepStrictEqual(dependencyWindow(juneScope.period_start), { start: null, end: null });

const boundary = [{ _id: '1', kodikos: '0001', hmeromhnia: new Date('2026-04-27'),
    kathgoria_ergasias_apologistika: 'ΕΡΓ', cards_ores_ergasias: 8 }];
const mayDependencyV1 = fingerprintRows(boundary);
assert.strictEqual(mayDependencyV1, fingerprintRows([...boundary]));
assert.notStrictEqual(mayDependencyV1, fingerprintRows([{ ...boundary[0], cards_ores_ergasias: 7.5 }]));
assert.strictEqual(fingerprintRows([]), fingerprintRows([]));
assert.ok(!SOURCE_FIELDS.includes('updated_at'));

assert.strictEqual(projectionForHistoricalState({ record: null, pastDeadline: true,
    dependencyFingerprint: fingerprintRows([]) }), 'HISTORICAL_RECONSTRUCTION_REQUIRED');
const completed = { status: 'OPEN', historical_reconstruction_status: 'COMPLETED',
    historical_dependency_fingerprint: mayDependencyV1 };
assert.strictEqual(projectionForHistoricalState({ record: completed, pastDeadline: true,
    dependencyFingerprint: mayDependencyV1 }), 'HISTORICAL_RECONSTRUCTED');
assert.strictEqual(projectionForHistoricalState({ record: completed, pastDeadline: true,
    dependencyFingerprint: fingerprintRows([{ ...boundary[0], repo_apologistika: true }]) }),
'HISTORICAL_RECONSTRUCTION_STALE');

const julyScope = normalizeScope({ team: 'THA', company_kod: 'company', ypokatasthma: '0',
    period_start: '2026-07-01', period_end: '2026-07-31' });
const july = projectPeriodControl({ scope: julyScope, now: new Date('2026-08-15') });
assert.strictEqual(july.effective_mode, 'NORMAL');
assert.strictEqual(july.can_calculate, true);
assert.strictEqual(july.can_historical_reconstruct, false);
const juneRequired = projectPeriodControl({ scope: juneScope, now: new Date('2026-08-01') });
assert.strictEqual(juneRequired.effective_mode, 'HISTORICAL_RECONSTRUCTION_REQUIRED');
assert.strictEqual(juneRequired.can_calculate, false);
assert.strictEqual(juneRequired.can_historical_reconstruct, true);
const finalized = projectPeriodControl({ scope: juneScope, now: new Date('2026-08-01'), record: {
    status: 'FINALIZED', deadline: calculatePeriodDeadline(juneScope.period_end), version: 2,
    frozen_snapshot_id: 'snapshot', frozen_snapshot_fingerprint: 'f'.repeat(64) } });
assert.strictEqual(finalized.effective_mode, 'FINALIZED');
assert.strictEqual(finalized.can_historical_reconstruct, false);
assert.strictEqual(finalized.can_corrective, true);

function store(initial = null) {
    let record = initial ? { ...initial } : null;
    const audits = [];
    const query = () => ({ session() { return this; }, lean: async () => record ? { ...record } : null });
    return { model: {
        findOne: query,
        async create(values) { const value = Array.isArray(values) ? values[0] : values;
            record = { _id: 'control', ...value }; return Array.isArray(values) ? [{ ...record }] : { ...record }; },
        async findOneAndUpdate(filter, update) {
            if (!record || (filter.version !== undefined && filter.version !== record.version) ||
                (filter.status && filter.status !== record.status) ||
                (filter.historical_reconstruction_status && filter.historical_reconstruction_status !== record.historical_reconstruction_status)) return null;
            record = { ...record, ...(update.$set || {}) };
            for (const [key, amount] of Object.entries(update.$inc || {})) record[key] = Number(record[key] || 0) + amount;
            return { ...record };
        }
    }, audit: { async create(values) { audits.push(...(Array.isArray(values) ? values : [values])); } },
    get record() { return record; }, audits };
}
const transactionRunner = work => work({ id: 'transaction' });

(async () => {
    for (const role of ['A', 'S', 'HR']) {
        const s = store();
        const result = await authorizeHistoricalReconstruction({ session: { ...user, userRole: role },
            scope: juneScope, reason: 'Ιστορική ανακατασκευή', requestId: `historical-${role}-0001`,
            confirmation: true, now: new Date('2026-08-01'), periodControlModel: s.model,
            auditModel: s.audit, transactionRunner });
        assert.strictEqual(result.record.historical_reconstruction_version, 1);
        assert.strictEqual(s.audits[0].event_type, 'HISTORICAL_RECONSTRUCTION_OPEN');
    }
    await assert.rejects(() => authorizeHistoricalReconstruction({ session: { ...user, userRole: 'U' },
        scope: juneScope, reason: 'x', requestId: 'historical-user-0001', confirmation: true,
        periodControlModel: store().model, auditModel: store().audit, transactionRunner }), error => error.statusCode === 403);
    await assert.rejects(() => authorizeHistoricalReconstruction({ session: user, scope: juneScope,
        reason: '', requestId: 'historical-reason-01', confirmation: true,
        periodControlModel: store().model, auditModel: store().audit, transactionRunner }),
    error => error.code === 'HISTORICAL_RECONSTRUCTION_REASON_REQUIRED');
    await assert.rejects(() => authorizeHistoricalReconstruction({ session: user, scope: juneScope,
        reason: 'x', requestId: 'historical-confirm-01', confirmation: false,
        periodControlModel: store().model, auditModel: store().audit, transactionRunner }),
    error => error.code === 'HISTORICAL_RECONSTRUCTION_CONFIRMATION_REQUIRED');
    await assert.rejects(() => authorizeHistoricalReconstruction({ session: user, scope: julyScope,
        reason: 'normal period', requestId: 'historical-normal-01', confirmation: true,
        now: new Date('2026-08-15'), periodControlModel: store().model,
        auditModel: store().audit, transactionRunner }),
    error => error.code === 'HISTORICAL_RECONSTRUCTION_NOT_OVERDUE');

    const replayStore = store();
    const command = { session: user, scope: juneScope, reason: 'reason', requestId: 'historical-replay-01',
        confirmation: true, now: new Date('2026-08-01'), periodControlModel: replayStore.model,
        auditModel: replayStore.audit, transactionRunner };
    await authorizeHistoricalReconstruction(command);
    const replay = await authorizeHistoricalReconstruction(command);
    assert.strictEqual(replay.idempotent, true);
    assert.strictEqual(replayStore.audits.length, 1);

    replayStore.record.historical_reconstruction_status = 'COMPLETED';
    const reassess = await authorizeHistoricalReconstruction({ ...command, requestId: 'historical-reassess-02',
        reason: 'dependency changed', fingerprintResolver: async () => ({ dependency_fingerprint: 'changed' }) });
    assert.strictEqual(reassess.record.historical_reconstruction_version, 2);
    assert.strictEqual(replayStore.audits.at(-1).event_type, 'HISTORICAL_RECONSTRUCTION_REASSESS');
    assert.strictEqual(replayStore.audits.at(-2).event_type, 'HISTORICAL_RECONSTRUCTION_STALE');

    const factRows = [
        { _id: 'april-boundary', team: 'THA', company_kod: 'company', ypokatasthma: '0000',
            kodikos: '0001', hmeromhnia: new Date('2026-04-28'), kathgoria_ergasias: 'ΕΡΓ',
            cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00',
            kathgoria_ergasias_apologistika: 'ΕΡΓ' },
        { _id: 'may-result', team: 'THA', company_kod: 'company', ypokatasthma: '0000',
            kodikos: '0001', hmeromhnia: new Date('2026-05-01'), kathgoria_ergasias: 'ΕΡΓ',
            cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00',
            kathgoria_ergasias_apologistika: 'ΕΡΓ' }
    ];
    const prodhlomenaModel = { find(filter) { let selected = factRows.filter(row =>
        row.hmeromhnia >= filter.hmeromhnia.$gte && row.hmeromhnia <= filter.hmeromhnia.$lte);
        return { select() { return this; }, sort() { return this; }, session() { return this; },
            async lean() { return selected.map(row => ({ ...row })); } }; } };
    const mayFingerprints = await calculateHistoricalFingerprints({ scope: mayScope, prodhlomenaModel });
    assert.strictEqual(mayFingerprints.dependency_window_start.toISOString().slice(0, 10), '2026-04-27');
    assert.strictEqual(mayFingerprints.dependency_window_end.toISOString().slice(0, 10), '2026-04-30');
    const originalMayDependency = mayFingerprints.dependency_fingerprint;
    factRows[0].cards_eos_ora_01 = '15:30';
    const changedMayDependency = (await calculateHistoricalFingerprints({ scope: mayScope, prodhlomenaModel })).dependency_fingerprint;
    assert.notStrictEqual(changedMayDependency, originalMayDependency);
    factRows[0].cards_eos_ora_01 = '16:00';
    assert.strictEqual((await calculateHistoricalFingerprints({ scope: mayScope, prodhlomenaModel })).dependency_fingerprint,
        originalMayDependency);
    const juneFingerprints = await calculateHistoricalFingerprints({ scope: juneScope, prodhlomenaModel });
    assert.strictEqual(juneFingerprints.dependency_window_start, null);
    assert.strictEqual(juneFingerprints.dependency_fingerprint, fingerprintRows([]));

    replayStore.record.active_calculation_id = 'historical-calculation-complete-01';
    replayStore.record.last_historical_reconstruction_request_id = 'historical-reassess-02';
    const sourceBeforeCompletion = JSON.stringify(factRows);
    const completion = await completeHistoricalReconstruction({ scope: mayScope,
        calculationId: 'historical-calculation-complete-01', requestId: 'historical-reassess-02',
        now: new Date('2026-08-02'), periodControlModel: replayStore.model,
        auditModel: replayStore.audit, prodhlomenaModel, transactionRunner });
    assert.strictEqual(completion.record.historical_reconstruction_status, 'COMPLETED');
    assert.strictEqual(completion.record.historical_dependency_fingerprint, originalMayDependency);
    assert.strictEqual(JSON.stringify(factRows), sourceBeforeCompletion);
    assert.deepStrictEqual(replayStore.audits.slice(-2).map(audit => audit.event_type),
        ['HISTORICAL_RECONSTRUCTION_CALCULATION', 'HISTORICAL_RECONSTRUCTION_COMPLETE']);

    const ownershipStore = store({ ...juneScope, status: 'OPEN', deadline: calculatePeriodDeadline(juneScope.period_end),
        version: 2, write_fence_version: 0, active_calculation_id: '',
        historical_reconstruction_status: 'AUTHORIZED', last_historical_reconstruction_request_id: 'historical-owner-01' });
    const owner = await acquirePeriodCalculationOwnership({ scope: juneScope,
        calculationId: 'historical-calculation-owner-01', historicalRequestId: 'historical-owner-01',
        now: new Date('2026-08-01'), periodControlModel: ownershipStore.model,
        indexGuard: async () => ({ ready: true }), transactionRunner });
    assert.strictEqual(owner.historical, true);
    await assert.rejects(() => acquirePeriodCalculationOwnership({ scope: juneScope,
        calculationId: 'historical-calculation-owner-02', now: new Date('2026-08-01'),
        periodControlModel: ownershipStore.model, indexGuard: async () => ({ ready: true }), transactionRunner }),
    error => error.code === 'PERIOD_CONTROL_CORRECTIVE_ONLY');
    console.log('apasxoliseisHistoricalPeriodReconstructionService tests: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
