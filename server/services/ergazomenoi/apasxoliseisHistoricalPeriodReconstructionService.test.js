'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const PeriodControlModel = require('../../models/apasxoliseisPeriodControl');
const { ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');
const {
    SOURCE_FIELDS,
    dependencyWindow,
    fingerprintRows,
    projectionForHistoricalState,
    authorizeHistoricalReconstruction,
    calculateHistoricalFingerprints,
    completeHistoricalReconstruction,
    failHistoricalReconstruction
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

function matches(record, filter = {}) {
    if (!record) return false;
    for (const [key, expected] of Object.entries(filter)) {
        if (key === '$or') {
            if (!expected.some(condition => matches(record, condition))) return false;
            continue;
        }
        if (key === '_id' && expected?.$exists === false) continue;
        const actual = record[key];
        if (expected && expected.$exists !== undefined) {
            if ((actual !== undefined) !== expected.$exists) return false;
            continue;
        }
        if (expected && Array.isArray(expected.$in)) {
            if (!expected.$in.includes(actual ?? '')) return false;
        } else if (expected instanceof Date) {
            if (new Date(actual).getTime() !== expected.getTime()) return false;
        } else if (expected !== undefined && String(actual ?? '') !== String(expected ?? '')) return false;
    }
    return true;
}
function store(initial = null) {
    let record = initial ? { ...initial } : null;
    const audits = [];
    const auditOptions = [];
    const query = filter => ({ session() { return this; }, lean: async () => matches(record, filter) ? { ...record } : null });
    return { model: {
        findOne: query,
        async create(values) { const value = Array.isArray(values) ? values[0] : values;
            record = { _id: 'control', ...value }; return Array.isArray(values) ? [{ ...record }] : { ...record }; },
        async findOneAndUpdate(filter, update) {
            if (!matches(record, filter)) return null;
            record = { ...record, ...(update.$set || {}) };
            for (const [key, amount] of Object.entries(update.$inc || {})) record[key] = Number(record[key] || 0) + amount;
            return { ...record };
        }
    }, audit: { async create(values, options) {
        audits.push(...(Array.isArray(values) ? values : [values]));
        auditOptions.push(options);
    } }, get record() { return record; }, audits, auditOptions };
}
const transactionRunner = work => work({ id: 'transaction' });

function castAuthorizationSelector(activeCalculationSelector) {
    const query = PeriodControlModel.findOneAndUpdate({ ...juneScope, status: 'OPEN', version: 2,
        active_calculation_id: activeCalculationSelector }, { $set: {
        historical_reconstruction_status: 'AUTHORIZED' } }, { new: true });
    query._castConditions();
    return { error: query.error(), filter: query.getFilter() };
}

function castFingerprintDateSelector(dateSelector) {
    const query = ProdhlomenaOrariaModel.find({ ...juneScope, hmeromhnia: dateSelector });
    query._castConditions();
    return { error: query.error(), filter: query.getFilter() };
}

(async () => {
    const previousSanitizeFilter = mongoose.get('sanitizeFilter');
    mongoose.set('sanitizeFilter', true);
    try {
        const untrusted = castAuthorizationSelector({ $in: ['', null] });
        assert.ok(untrusted.error instanceof mongoose.Error.CastError);
        assert.strictEqual(untrusted.error.path, 'active_calculation_id');

        const trustedEmpty = castAuthorizationSelector(mongoose.trusted({ $in: ['', null] }));
        assert.strictEqual(trustedEmpty.error, undefined);
        assert.deepStrictEqual(trustedEmpty.filter.active_calculation_id.$in, ['', null]);

        const trustedNull = castAuthorizationSelector(mongoose.trusted({ $in: ['', null] }));
        assert.strictEqual(trustedNull.error, undefined);
        assert.ok(trustedNull.filter.active_calculation_id.$in.includes(null));

        const periodStart = new Date('2026-06-01T00:00:00.000Z');
        const periodEnd = new Date('2026-06-30T00:00:00.000Z');
        const untrustedRange = castFingerprintDateSelector({ $gte: periodStart, $lte: periodEnd });
        assert.ok(untrustedRange.error instanceof mongoose.Error.CastError);
        assert.strictEqual(untrustedRange.error.path, 'hmeromhnia');

        const trustedRange = castFingerprintDateSelector(
            mongoose.trusted({ $gte: periodStart, $lte: periodEnd }));
        assert.strictEqual(trustedRange.error, undefined);
        assert.strictEqual(trustedRange.filter.hmeromhnia.$gte.getTime(), periodStart.getTime());
        assert.strictEqual(trustedRange.filter.hmeromhnia.$lte.getTime(), periodEnd.getTime());

        const castFilters = [];
        const castingProdhlomenaModel = { find(filter) {
            const query = ProdhlomenaOrariaModel.find(filter);
            query._castConditions();
            if (query.error()) throw query.error();
            castFilters.push(query.getFilter());
            return { select() { return this; }, sort() { return this; }, session() { return this; },
                async lean() { return []; } };
        } };
        const fingerprints = await calculateHistoricalFingerprints({ scope: juneScope,
            prodhlomenaModel: castingProdhlomenaModel });
        assert.strictEqual(castFilters.length, 2);
        for (const filter of castFilters) {
            assert.strictEqual(filter.hmeromhnia.$gte.getTime(), periodStart.getTime());
            assert.strictEqual(filter.hmeromhnia.$lte.getTime(), periodEnd.getTime());
        }
        assert.strictEqual(fingerprints.source_fingerprint, fingerprintRows([], SOURCE_FIELDS));
        assert.strictEqual(fingerprints.result_fingerprint, fingerprintRows([]));
    } finally {
        mongoose.set('sanitizeFilter', previousSanitizeFilter);
    }

    for (const activeCalculationId of ['', null]) {
        const existing = store({ ...juneScope, status: 'OPEN',
            deadline: calculatePeriodDeadline(juneScope.period_end), version: 2,
            write_fence_version: 0, active_calculation_id: activeCalculationId,
            historical_reconstruction_status: '', historical_reconstruction_version: 0,
            historical_reconstruction_pending_version: 0 });
        const result = await authorizeHistoricalReconstruction({ session: user, scope: juneScope,
            reason: 'sanitizeFilter authorization', requestId: `historical-selector-${activeCalculationId === null ? 'null' : 'empty'}-01`,
            confirmation: true, now: new Date('2026-08-01'), periodControlModel: existing.model,
            auditModel: existing.audit, transactionRunner });
        assert.strictEqual(result.record.historical_reconstruction_status, 'AUTHORIZED');
        assert.strictEqual(result.record.historical_reconstruction_version, 0);
        assert.strictEqual(result.record.historical_reconstruction_pending_version, 1);
        assert.strictEqual(result.record.version, 3);
        assert.strictEqual(existing.audits[0].event_type, 'HISTORICAL_RECONSTRUCTION_OPEN');
    }

    const active = store({ ...juneScope, status: 'OPEN',
        deadline: calculatePeriodDeadline(juneScope.period_end), version: 2,
        write_fence_version: 0, active_calculation_id: 'actual-calculation-id',
        historical_reconstruction_status: '', historical_reconstruction_version: 0,
        historical_reconstruction_pending_version: 0 });
    await assert.rejects(() => authorizeHistoricalReconstruction({ session: user, scope: juneScope,
        reason: 'must fail closed', requestId: 'historical-selector-active-01', confirmation: true,
        now: new Date('2026-08-01'), periodControlModel: active.model, auditModel: active.audit,
        transactionRunner }), error => error.code === 'PERIOD_CONTROL_CALCULATION_IN_PROGRESS');
    assert.strictEqual(active.record.historical_reconstruction_status, '');
    assert.strictEqual(active.record.version, 2);
    assert.strictEqual(active.audits.length, 0);

    for (const role of ['A', 'S', 'HR']) {
        const s = store();
        const result = await authorizeHistoricalReconstruction({ session: { ...user, userRole: role },
            scope: juneScope, reason: 'Ιστορική ανακατασκευή', requestId: `historical-${role}-0001`,
            confirmation: true, now: new Date('2026-08-01'), periodControlModel: s.model,
            auditModel: s.audit, transactionRunner });
        assert.strictEqual(result.record.historical_reconstruction_version, 0);
        assert.strictEqual(result.record.historical_reconstruction_pending_version, 1);
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
    const command = { session: user, scope: mayScope, reason: 'reason', requestId: 'historical-replay-01',
        confirmation: true, now: new Date('2026-08-01'), periodControlModel: replayStore.model,
        auditModel: replayStore.audit, transactionRunner };
    await authorizeHistoricalReconstruction(command);
    const replay = await authorizeHistoricalReconstruction(command);
    assert.strictEqual(replay.idempotent, true);
    assert.strictEqual(replayStore.audits.length, 1);

    Object.assign(replayStore.record, { historical_reconstruction_status: 'COMPLETED',
        historical_reconstruction_version: 1, historical_reconstruction_pending_version: 0,
        historical_dependency_fingerprint: 'old' });
    const reassess = await authorizeHistoricalReconstruction({ ...command, requestId: 'historical-reassess-02',
        reason: 'dependency changed', fingerprintResolver: async () => ({ dependency_fingerprint: 'changed' }) });
    assert.strictEqual(reassess.record.historical_reconstruction_version, 1);
    assert.strictEqual(reassess.record.historical_reconstruction_pending_version, 2);
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
    assert.strictEqual(completion.record.historical_reconstruction_version, 2);
    assert.strictEqual(completion.record.historical_reconstruction_pending_version, 0);
    assert.strictEqual(completion.record.active_calculation_id,
        'historical-calculation-complete-01');
    assert.strictEqual(completion.record.historical_dependency_fingerprint, originalMayDependency);
    assert.strictEqual(JSON.stringify(factRows), sourceBeforeCompletion);
    assert.deepStrictEqual(replayStore.audits.slice(-2).map(audit => audit.event_type),
        ['HISTORICAL_RECONSTRUCTION_CALCULATION', 'HISTORICAL_RECONSTRUCTION_COMPLETE']);
    assert.strictEqual(replayStore.auditOptions.at(-1).ordered, true);
    assert.strictEqual(replayStore.auditOptions.at(-1).session.id, 'transaction');

    const failedFirst = store();
    const firstCommand = { session: user, scope: juneScope, reason: 'first failure',
        requestId: 'historical-failure-first-01', confirmation: true, now: new Date('2026-08-01'),
        periodControlModel: failedFirst.model, auditModel: failedFirst.audit, transactionRunner };
    await authorizeHistoricalReconstruction(firstCommand);
    const beforeOwnershipRecovery = await failHistoricalReconstruction({ scope: juneScope,
        requestId: firstCommand.requestId, errorCode: 'FAILED_BEFORE_OWNERSHIP',
        periodControlModel: failedFirst.model, auditModel: failedFirst.audit, transactionRunner });
    assert.strictEqual(beforeOwnershipRecovery.recovered, true);
    assert.strictEqual(beforeOwnershipRecovery.record.historical_reconstruction_status, '');
    assert.strictEqual(beforeOwnershipRecovery.record.historical_reconstruction_version, 0);
    assert.strictEqual(beforeOwnershipRecovery.record.historical_reconstruction_pending_version, 0);
    assert.strictEqual(failedFirst.audits.at(-1).event_type, 'HISTORICAL_RECONSTRUCTION_FAILED');
    assert.ok(!failedFirst.audits.some(audit => audit.event_type === 'HISTORICAL_RECONSTRUCTION_COMPLETE'));

    const retry = await authorizeHistoricalReconstruction({ ...firstCommand,
        requestId: 'historical-failure-first-retry-01' });
    failedFirst.record.active_calculation_id = 'historical-first-retry-calculation';
    const retryComplete = await completeHistoricalReconstruction({ scope: juneScope,
        calculationId: 'historical-first-retry-calculation', requestId: retry.record.last_historical_reconstruction_request_id,
        periodControlModel: failedFirst.model, auditModel: failedFirst.audit,
        prodhlomenaModel, transactionRunner });
    assert.strictEqual(retryComplete.record.historical_reconstruction_version, 1);

    const completedV1Fingerprints = {
        historical_source_fingerprint: retryComplete.record.historical_source_fingerprint,
        historical_dependency_fingerprint: retryComplete.record.historical_dependency_fingerprint,
        historical_result_fingerprint: retryComplete.record.historical_result_fingerprint
    };
    failedFirst.record.active_calculation_id = '';
    const reassessment = await authorizeHistoricalReconstruction({ ...firstCommand,
        requestId: 'historical-failure-reassess-01', reason: 'stale reassessment',
        fingerprintResolver: async () => ({ dependency_fingerprint: 'changed-again' }) });
    assert.strictEqual(reassessment.record.historical_reconstruction_version, 1);
    failedFirst.record.active_calculation_id = 'historical-reassess-failed-calculation';
    const reassessRecovery = await failHistoricalReconstruction({ scope: juneScope,
        requestId: reassessment.record.last_historical_reconstruction_request_id,
        calculationId: 'historical-reassess-failed-calculation', errorCode: 'FAILED_AFTER_OWNERSHIP',
        periodControlModel: failedFirst.model, auditModel: failedFirst.audit, transactionRunner });
    assert.strictEqual(reassessRecovery.record.historical_reconstruction_status, 'COMPLETED');
    assert.strictEqual(reassessRecovery.record.historical_reconstruction_version, 1);
    for (const [field, value] of Object.entries(completedV1Fingerprints)) {
        assert.strictEqual(reassessRecovery.record[field], value);
    }
    const staleAfterFailure = projectionForHistoricalState({ record: reassessRecovery.record,
        pastDeadline: true, dependencyFingerprint: 'changed-again' });
    assert.strictEqual(staleAfterFailure, 'HISTORICAL_RECONSTRUCTION_STALE');

    failedFirst.record.active_calculation_id = '';
    const reassessRetry = await authorizeHistoricalReconstruction({ ...firstCommand,
        requestId: 'historical-failure-reassess-retry-01', reason: 'retry stale reassessment',
        fingerprintResolver: async () => ({ dependency_fingerprint: 'changed-again' }) });
    failedFirst.record.active_calculation_id = 'historical-reassess-retry-calculation';
    const reassessRetryComplete = await completeHistoricalReconstruction({ scope: juneScope,
        calculationId: 'historical-reassess-retry-calculation',
        requestId: reassessRetry.record.last_historical_reconstruction_request_id,
        periodControlModel: failedFirst.model, auditModel: failedFirst.audit,
        prodhlomenaModel, transactionRunner });
    assert.strictEqual(reassessRetryComplete.record.historical_reconstruction_version, 2);

    const abandoned = store();
    await authorizeHistoricalReconstruction({ ...firstCommand, requestId: 'historical-abandoned-old-01',
        periodControlModel: abandoned.model, auditModel: abandoned.audit });
    const superseded = await authorizeHistoricalReconstruction({ ...firstCommand,
        requestId: 'historical-abandoned-new-01', periodControlModel: abandoned.model,
        auditModel: abandoned.audit });
    assert.strictEqual(superseded.record.historical_reconstruction_version, 0);
    assert.strictEqual(superseded.record.historical_reconstruction_pending_version, 1);
    assert.ok(abandoned.audits.some(audit => audit.details?.error_code === 'AUTHORIZATION_SUPERSEDED'));
    assert.deepStrictEqual(abandoned.audits.slice(-2).map(audit => audit.event_type),
        ['HISTORICAL_RECONSTRUCTION_FAILED', 'HISTORICAL_RECONSTRUCTION_OPEN']);
    assert.strictEqual(abandoned.auditOptions.at(-1).ordered, true);
    assert.strictEqual(abandoned.auditOptions.at(-1).session.id, 'transaction');

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
