'use strict';

const assert = require('assert');
const { finalizeEmploymentPeriod, linkEmploymentPeriodSubmission, openCorrectiveCase,
    saveCorrectiveResult, closeCorrectiveCase } = require('./apasxoliseisPeriodLifecycleService');
const { transitionPeriodControl } = require('./apasxoliseisPeriodControlService');

const scope = { team: 'T', company_kod: '507f1f77bcf86cd799439099', ypokatasthma: '0001',
    period_start: '2026-06-01', period_end: '2026-06-30' };
const allowed = { userRole: 'HR', userId: '507f1f77bcf86cd799439011', userName: 'HR' };
const denied = { ...allowed, userRole: 'U' };
const runner = async (work) => work({ id: 'tx' });
const guard = async () => ({ ready: true });
const testAuthoritativeWeek = ({ frozenRows }) => ({ correctedRows: frozenRows.map((row) => {
    const start = String(row.cards_apo_ora_01 || '').split(':').map(Number);
    const end = String(row.cards_eos_ora_01 || '').split(':').map(Number);
    if (start.length !== 2 || end.length !== 2 || start.some(Number.isNaN) || end.some(Number.isNaN)) return row;
    let minutes = end[0] * 60 + end[1] - start[0] * 60 - start[1]; if (minutes <= 0) minutes += 1440;
    const hours = minutes / 60; return { ...row, cards_ores_ergasias: hours,
        ores_ergasias_apologistika: hours, ores_pragmatikhs_ergasias_apologistika: hours,
        compensation_breakdown_apologistika: { amounts: { baseActualWorkAmount: hours * 10,
            premiumTotalAmount: 0, grossWorkAmount: hours * 10 } } };
}), deviations: [], diagnostics: [] });
function query(value) { return { session() { return this; }, async lean() { return value; } }; }
function stores(controlInput = {}) {
    let control = { ...scope, status: 'LOCKED', version: 2, active_calculation_id: '',
        frozen_snapshot_id: null, frozen_snapshot_fingerprint: '', ...controlInput };
    if (Object.prototype.hasOwnProperty.call(controlInput, 'active_calculation_id') &&
        controlInput.active_calculation_id === undefined) delete control.active_calculation_id;
    let frozen = null; const audits = []; const cases = [];
    return {
        period: {
            findOne() { return query(control ? { ...control } : null); },
            async findOneAndUpdate(filter, update) {
                if (!control || control.status !== filter.status || (filter.version !== undefined && control.version !== filter.version)) return null;
                if (filter.$or && !filter.$or.some((condition) => {
                    const expected = condition.active_calculation_id;
                    if (expected && expected.$exists === false) {
                        return !Object.prototype.hasOwnProperty.call(control, 'active_calculation_id');
                    }
                    return control.active_calculation_id === expected;
                })) return null;
                control = { ...control, ...update.$set }; return { ...control };
            }
        },
        frozen: {
            findOne(filter) { return query(frozen?.request_id === filter.request_id ? { ...frozen } : null); },
            async create(documents) { frozen = { _id: '507f1f77bcf86cd799439012', ...documents[0] }; return [{ ...frozen }]; }
        },
        corrective: {
            findOne(filter) {
                return query(cases.find((row) => row.case_id === filter.case_id && row.status === filter.status) || null);
            },
            async create(documents) {
                if (cases.some((item) => item.status === 'ACTIVE')) { const error = new Error('duplicate'); error.code = 11000; throw error; }
                const item = { _id: '507f1f77bcf86cd799439013', result_version: 0, ...documents[0] }; cases.push(item); return [item];
            },
            async findOneAndUpdate(filter, update) {
                const item = cases.find((row) => row.case_id === filter.case_id && row.status === filter.status);
                if (!item || (filter.result_version !== undefined && item.result_version !== filter.result_version) ||
                    (filter.corrected_result_fingerprint && typeof filter.corrected_result_fingerprint === 'string' &&
                        item.corrected_result_fingerprint !== filter.corrected_result_fingerprint)) return null;
                Object.assign(item, update.$set);
                for (const [field, amount] of Object.entries(update.$inc || {})) item[field] = Number(item[field] || 0) + amount;
                return { ...item };
            }
        },
        audit: { async create(documents) {
            audits.push(...(Array.isArray(documents) ? documents : [documents])); return documents;
        } },
        get control() { return control; }, get frozenRecord() { return frozen; }, audits, cases
    };
}
const snapshotInput = { dailyResults: [{ kodikos: '1', hmeromhnia: '2026-06-01', ores_ergasias_apologistika: 8 }] };
(async () => {
    const finalized = stores();
    const result = await finalizeEmploymentPeriod({ session: allowed, scope, reason: 'Οριστικοποίηση',
        requestId: 'finalize-request-0001', snapshotInput, periodControlModel: finalized.period,
        frozenModel: finalized.frozen, auditModel: finalized.audit, indexGuard: guard, transactionRunner: runner });
    assert.strictEqual(result.idempotent, false);
    assert.strictEqual(finalized.control.status, 'FINALIZED');
    assert.ok(finalized.control.frozen_snapshot_id);
    assert.strictEqual(finalized.control.frozen_snapshot_fingerprint.length, 64);
    assert.strictEqual(finalized.audits[0].event_type, 'FINALIZE');
    const replay = await finalizeEmploymentPeriod({ session: allowed, scope, reason: 'Οριστικοποίηση',
        requestId: 'finalize-request-0001', snapshotInput, periodControlModel: finalized.period,
        frozenModel: finalized.frozen, auditModel: finalized.audit, indexGuard: guard, transactionRunner: runner });
    assert.strictEqual(replay.idempotent, true);
    await assert.rejects(() => finalizeEmploymentPeriod({ session: allowed, scope, reason: 'Άλλο αίτημα',
        requestId: 'finalize-request-concurrent', snapshotInput, periodControlModel: finalized.period,
        frozenModel: finalized.frozen, auditModel: finalized.audit, indexGuard: guard, transactionRunner: runner }),
    (error) => error.code === 'PERIOD_FINALIZE_REQUIRES_LOCKED');

    await assert.rejects(() => finalizeEmploymentPeriod({ session: allowed, scope, reason: '', requestId: 'x', snapshotInput,
        periodControlModel: stores().period, frozenModel: stores().frozen, auditModel: stores().audit, indexGuard: guard, transactionRunner: runner }),
    (error) => error.code === 'PERIOD_FINALIZE_REASON_REQUIRED');
    await assert.rejects(() => finalizeEmploymentPeriod({ session: denied, scope, reason: 'x', requestId: 'x', snapshotInput,
        periodControlModel: stores().period, frozenModel: stores().frozen, auditModel: stores().audit, indexGuard: guard, transactionRunner: runner }),
    (error) => error.statusCode === 403);
    for (const role of ['A', 'S', 'HR']) {
        const store = stores();
        await finalizeEmploymentPeriod({ session: { ...allowed, userRole: role }, scope, reason: 'x', requestId: `finalize-${role}-request`, snapshotInput,
            periodControlModel: store.period, frozenModel: store.frozen, auditModel: store.audit, indexGuard: guard, transactionRunner: runner });
    }
    for (const [label, activeCalculationId] of [['empty', ''], ['null', null], ['missing', undefined]]) {
        const store = stores({ active_calculation_id: activeCalculationId });
        await finalizeEmploymentPeriod({ session: allowed, scope, reason: 'x', requestId: `finalize-${label}-calculation-id`, snapshotInput,
            periodControlModel: store.period, frozenModel: store.frozen, auditModel: store.audit,
            indexGuard: guard, transactionRunner: runner });
        assert.strictEqual(store.control.status, 'FINALIZED');
    }
    await assert.rejects(() => finalizeEmploymentPeriod({ session: allowed, scope, reason: 'x', requestId: 'finalize-open-request', snapshotInput,
        periodControlModel: stores({ status: 'OPEN' }).period, frozenModel: stores().frozen, auditModel: stores().audit,
        indexGuard: guard, transactionRunner: runner }), (error) => error.code === 'PERIOD_FINALIZE_REQUIRES_LOCKED');
    const activeCalculation = stores({ active_calculation_id: 'calculation-active-1' });
    await assert.rejects(() => finalizeEmploymentPeriod({ session: allowed, scope, reason: 'x', requestId: 'finalize-active-request', snapshotInput,
        periodControlModel: activeCalculation.period, frozenModel: activeCalculation.frozen, auditModel: activeCalculation.audit,
        indexGuard: guard, transactionRunner: runner }), (error) => error.code === 'PERIOD_CONTROL_CALCULATION_IN_PROGRESS');

    const pendingFinalization = stores({ status: 'LOCKED' });
    await assert.rejects(() => finalizeEmploymentPeriod({ session: allowed, scope, reason: 'pending',
        requestId: 'finalize-pending-request', snapshotInput, periodControlModel: pendingFinalization.period,
        frozenModel: pendingFinalization.frozen, auditModel: pendingFinalization.audit,
        indexGuard: guard, transactionRunner: runner, periodHrReadinessResolver: async () => ({
            ready: false, total_pending_count: 1, pending_cases: [{ employee_kodikos: '999' }]
        }) }), (error) => error.code === 'PERIOD_HAS_PENDING_HR_ACTIONS');
    assert.strictEqual(pendingFinalization.control.status, 'LOCKED');
    assert.strictEqual(pendingFinalization.frozenRecord, null);
    const dataQualityFinalization = stores({ status: 'LOCKED' });
    await assert.rejects(() => finalizeEmploymentPeriod({ session: allowed, scope, reason: 'data quality',
        requestId: 'finalize-data-quality-request', snapshotInput,
        periodControlModel: dataQualityFinalization.period, frozenModel: dataQualityFinalization.frozen,
        auditModel: dataQualityFinalization.audit, indexGuard: guard, transactionRunner: runner,
        periodDataQualityReadinessResolver: async () => ({ ready: false, unresolved_count: 1 }) }),
    (error) => error.code === 'PERIOD_HAS_UNRESOLVED_DATA_QUALITY_ISSUES');
    assert.strictEqual(dataQualityFinalization.control.status, 'LOCKED');
    assert.strictEqual(dataQualityFinalization.frozenRecord, null);

    const historicalFinalized = stores({ historical_reconstruction_status: 'COMPLETED',
        historical_reconstruction_version: 2, historical_dependency_fingerprint: 'd'.repeat(64) });
    await finalizeEmploymentPeriod({ session: allowed, scope, reason: 'Ιστορική οριστικοποίηση',
        requestId: 'historical-finalize-request', snapshotInput,
        periodControlModel: historicalFinalized.period, frozenModel: historicalFinalized.frozen,
        auditModel: historicalFinalized.audit, indexGuard: guard, transactionRunner: runner,
        historicalFingerprintResolver: async () => ({ dependency_fingerprint: 'd'.repeat(64) }) });
    assert.strictEqual(historicalFinalized.frozenRecord.baseline_origin,
        'HISTORICAL_RECONSTRUCTION_AFTER_DEADLINE');
    assert.strictEqual(historicalFinalized.frozenRecord.historical_reconstruction_version, 2);
    const immutableHistoricalFingerprint = historicalFinalized.frozenRecord.frozen_snapshot_fingerprint;
    assert.strictEqual(historicalFinalized.control.frozen_snapshot_fingerprint, immutableHistoricalFingerprint);

    const reconstructedFlow = stores({ status: 'OPEN', historical_reconstruction_status: 'COMPLETED',
        historical_reconstruction_version: 1, historical_dependency_fingerprint: 'c'.repeat(64) });
    const lockedReconstructed = await transitionPeriodControl({ session: allowed, scope, action: 'LOCK',
        reason: 'Ολοκλήρωση ελέγχου ανακατασκευής', requestId: 'historical-lock-e2e-01',
        now: new Date('2026-08-02'), expectedVersion: 2, periodControlModel: reconstructedFlow.period,
        auditModel: reconstructedFlow.audit, indexGuard: guard, transactionRunner: runner,
        historicalFingerprintResolver: async () => ({ dependency_fingerprint: 'c'.repeat(64) }) });
    assert.strictEqual(lockedReconstructed.state.stored_status, 'LOCKED');
    await finalizeEmploymentPeriod({ session: allowed, scope, reason: 'Ιστορική οριστικοποίηση',
        requestId: 'historical-finalize-e2e-01', snapshotInput,
        periodControlModel: reconstructedFlow.period, frozenModel: reconstructedFlow.frozen,
        auditModel: reconstructedFlow.audit, indexGuard: guard, transactionRunner: runner,
        historicalFingerprintResolver: async () => ({ dependency_fingerprint: 'c'.repeat(64) }) });
    assert.strictEqual(reconstructedFlow.control.status, 'FINALIZED');
    assert.strictEqual(reconstructedFlow.frozenRecord.baseline_origin,
        'HISTORICAL_RECONSTRUCTION_AFTER_DEADLINE');
    assert.strictEqual(reconstructedFlow.frozenRecord.historical_reconstruction_version, 1);

    const staleHistorical = stores({ historical_reconstruction_status: 'COMPLETED',
        historical_reconstruction_version: 1, historical_dependency_fingerprint: 'a'.repeat(64) });
    await assert.rejects(() => finalizeEmploymentPeriod({ session: allowed, scope, reason: 'stale',
        requestId: 'historical-stale-finalize', snapshotInput,
        periodControlModel: staleHistorical.period, frozenModel: staleHistorical.frozen,
        auditModel: staleHistorical.audit, indexGuard: guard, transactionRunner: runner,
        historicalFingerprintResolver: async () => ({ dependency_fingerprint: 'b'.repeat(64) }) }),
    error => error.code === 'HISTORICAL_RECONSTRUCTION_STALE_CANNOT_FINALIZE');
    assert.strictEqual(staleHistorical.frozenRecord, null);
    const staleOpen = stores({ status: 'OPEN', historical_reconstruction_status: 'COMPLETED',
        historical_reconstruction_version: 1, historical_dependency_fingerprint: 'a'.repeat(64) });
    await assert.rejects(() => transitionPeriodControl({ session: allowed, scope, action: 'LOCK',
        reason: 'stale lock', requestId: 'historical-stale-lock-01', now: new Date('2026-08-02'),
        expectedVersion: 2, periodControlModel: staleOpen.period, auditModel: staleOpen.audit,
        indexGuard: guard, transactionRunner: runner,
        historicalFingerprintResolver: async () => ({ dependency_fingerprint: 'b'.repeat(64) }) }),
    error => error.code === 'HISTORICAL_RECONSTRUCTION_STALE_CANNOT_FINALIZE');

    const correctionStore = stores({ status: 'FINALIZED', frozen_snapshot_id: '507f1f77bcf86cd799439012',
        frozen_snapshot_fingerprint: 'a'.repeat(64) });
    const correction = await openCorrectiveCase({ session: allowed, scope, reason: 'Λάθος κάρτα', caseId: 'case-1',
        periodControlModel: correctionStore.period, correctiveModel: correctionStore.corrective,
        auditModel: correctionStore.audit, indexGuard: guard, transactionRunner: runner });
    assert.strictEqual(correction.status, 'ACTIVE');
    assert.strictEqual(correction.baseline_fingerprint, 'a'.repeat(64));
    assert.strictEqual(correctionStore.control.frozen_snapshot_fingerprint, 'a'.repeat(64));
    await assert.rejects(() => openCorrectiveCase({ session: allowed, scope, reason: 'second', caseId: 'case-2',
        periodControlModel: correctionStore.period, correctiveModel: correctionStore.corrective,
        auditModel: correctionStore.audit, indexGuard: guard, transactionRunner: runner }),
    (error) => error.code === 'CORRECTIVE_CASE_ALREADY_ACTIVE');
    await assert.rejects(() => openCorrectiveCase({ session: denied, scope, reason: 'x', caseId: 'case-3',
        periodControlModel: correctionStore.period, correctiveModel: correctionStore.corrective,
        auditModel: correctionStore.audit, indexGuard: guard, transactionRunner: runner }), (error) => error.statusCode === 403);

    const baselineWeek = Array.from({ length: 7 }, (_, index) => { const date = new Date('2026-06-01T00:00:00Z'); date.setUTCDate(date.getUTCDate() + index);
        return { _id: `r${index}`, kodikos: '1', hmeromhnia: date.toISOString().slice(0, 10),
            kathgoria_ergasias: index >= 5 ? 'ΑΝ' : 'ΕΡΓ', repo: index >= 5, repo_apologistika: index >= 5,
            ores_ergasias: 8, cards_ores_ergasias: index < 5 ? 8 : 0,
            cards_apo_ora_01: index < 5 ? '09:00' : '', cards_eos_ora_01: index < 5 ? '17:00' : '',
            effective_profile_resolved: { hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40,
                pragmatikoOromisthio: 10, nomimoOromisthio: 8 } }; });
    const baselineSnapshot = { snapshot_schema_version: 'employment-period-frozen:v2', source_calculation_version: 'employment-calculation:v2', scope,
        employees: [{ kodikos: '1', hmeres_ergasias_ebdomadas: 5, pososto_prosayxhshs_6hs_hmeras: 40,
            pragmatikoOromisthio: 10, nomimoOromisthio: 8 }], policy_context: { rules: [] },
        weekly_calculation_context: { rows: baselineWeek, calendar_facts: [], profile_history: [], applied_transfer_protection: {} },
        daily_results: [{ kodikos: '1', hmeromhnia: '2026-06-01', ores_ergasias_apologistika: 8,
            ores_pragmatikhs_ergasias_apologistika: 8, compensation_breakdown_apologistika: { amounts: {
                baseActualWorkAmount: 80, premiumTotalAmount: 0, grossWorkAmount: 80 } } }] };
    const baselineModel = { findOne(filter) {
        assert.strictEqual(String(filter._id), '507f1f77bcf86cd799439012');
        assert.strictEqual(filter.frozen_snapshot_fingerprint, 'a'.repeat(64));
        return query({ frozen_snapshot: baselineSnapshot });
    } };
    const corrections = [{ type: 'REPLACE_HISTORICAL_CARD_INTERVALS', employee_kodikos: '1',
        date: '2026-06-01', intervals: [{ start: '09:00', end: '18:00' }] }];
    const calculated = await saveCorrectiveResult({ session: allowed, scope, caseId: 'case-1', reason: 'Διόρθωση κάρτας',
        corrections, requestId: 'corrective-request-1', requiresNewSubmission: true,
        runAuthoritativeWeek: testAuthoritativeWeek,
        now: new Date('2026-08-01'), correctiveModel: correctionStore.corrective,
        frozenModel: baselineModel, auditModel: correctionStore.audit, transactionRunner: runner });
    assert.strictEqual(calculated.record.corrective_delta.totals.ores_ergasias_apologistika, 1);
    assert.strictEqual(calculated.record.corrective_delta_fingerprint.length, 64);
    assert.strictEqual(calculated.record.corrected_result_fingerprint.length, 64);
    assert.notStrictEqual(calculated.record.corrective_delta_fingerprint,
        calculated.record.corrected_result_fingerprint);
    assert.strictEqual(calculated.record.can_submit_correction, false);
    const replayCalculation = await saveCorrectiveResult({ session: allowed, scope, caseId: 'case-1', reason: 'retry',
        corrections, requestId: 'corrective-request-1', requiresNewSubmission: true,
        runAuthoritativeWeek: testAuthoritativeWeek,
        now: new Date('2026-08-01'), correctiveModel: correctionStore.corrective,
        frozenModel: baselineModel, auditModel: correctionStore.audit, transactionRunner: runner });
    assert.strictEqual(replayCalculation.idempotent, true);
    await assert.rejects(() => saveCorrectiveResult({ session: allowed, scope, caseId: 'case-1', reason: 'conflict',
        corrections: [{ ...corrections[0], intervals: [{ start: '09:00', end: '19:00' }] }],
        requestId: 'corrective-request-1', runAuthoritativeWeek: testAuthoritativeWeek, correctiveModel: correctionStore.corrective,
        frozenModel: baselineModel, auditModel: correctionStore.audit, transactionRunner: runner }),
    (error) => error.code === 'CORRECTIVE_REQUEST_ID_CONFLICT');
    assert.strictEqual(correctionStore.control.frozen_snapshot_fingerprint, 'a'.repeat(64));
    const mismatchedBaselineModel = { findOne() { return query(null); } };
    await assert.rejects(() => saveCorrectiveResult({ session: allowed, scope, caseId: 'case-1', reason: 'mismatch',
        corrections, requestId: 'corrective-request-mismatch', correctiveModel: correctionStore.corrective,
        runAuthoritativeWeek: testAuthoritativeWeek,
        frozenModel: mismatchedBaselineModel, auditModel: correctionStore.audit, transactionRunner: runner }),
    (error) => error.code === 'CORRECTIVE_BASELINE_MISMATCH');
    const closed = await closeCorrectiveCase({ session: allowed, scope, caseId: 'case-1', reason: 'Ολοκλήρωση',
        correctiveModel: correctionStore.corrective, auditModel: correctionStore.audit, transactionRunner: runner });
    assert.strictEqual(closed.status, 'CLOSED');
    await assert.rejects(() => saveCorrectiveResult({ session: allowed, scope, caseId: 'case-1', reason: 'rewrite',
        corrections, requestId: 'corrective-request-rewrite', correctiveModel: correctionStore.corrective, frozenModel: baselineModel,
        runAuthoritativeWeek: testAuthoritativeWeek,
        auditModel: correctionStore.audit, transactionRunner: runner }), (error) => error.code === 'CORRECTIVE_CASE_NOT_ACTIVE');

    const submissionStore = stores({ status: 'FINALIZED' });
    const submission = { _id: '507f1f77bcf86cd799439014', submit_date: new Date('2026-07-31T12:00:00Z'),
        protocol: 'PROTO-1', submission_status: 'SUCCESS', submission_code: 'WTODailyA', submission_id: 91,
        employment_period_start: new Date('2026-06-01T00:00:00.000Z'),
        employment_period_end: new Date('2026-06-30T00:00:00.000Z') };
    const submissionModel = { findOne(filter) { assert.strictEqual(filter.ypokatasthma_kodikos, '0001');
        assert.strictEqual(String(filter.companykod_object), scope.company_kod);
        assert.strictEqual(filter.submission_code, 'WTODailyA');
        assert.deepStrictEqual(filter.submission_id, { $type: 'number', $gt: 0 });
        assert.strictEqual(filter.process_code, undefined);
        assert.strictEqual(filter.employment_period_start.toISOString().slice(0, 10), scope.period_start);
        assert.strictEqual(filter.employment_period_end.toISOString().slice(0, 10), scope.period_end);
        return query(submission); } };
    await linkEmploymentPeriodSubmission({ session: allowed, scope, reason: 'Σύνδεση', submissionId: submission._id,
        submissionModel, periodControlModel: submissionStore.period, auditModel: submissionStore.audit, transactionRunner: runner });
    assert.strictEqual(submissionStore.control.submission_protocol, 'PROTO-1');
    assert.strictEqual(submissionStore.control.submission_timeliness, 'TIMELY');
    assert.strictEqual(submissionStore.audits[0].event_type, 'SUBMISSION_LINK');
    const productionSubmissionStore = stores({ status: 'FINALIZED' });
    const productionSubmission = { ...submission, _id: '507f1f77bcf86cd799439015', submission_id: 207 };
    const productionSubmissionModel = { findOne(filter) {
        assert.strictEqual(filter.submission_code, 'WTODailyA');
        assert.deepStrictEqual(filter.submission_id, { $type: 'number', $gt: 0 });
        assert.strictEqual(filter.process_code, undefined);
        return query(productionSubmission);
    } };
    await linkEmploymentPeriodSubmission({ session: allowed, scope, reason: 'Production σύνδεση',
        submissionId: productionSubmission._id, submissionModel: productionSubmissionModel,
        periodControlModel: productionSubmissionStore.period, auditModel: productionSubmissionStore.audit,
        transactionRunner: runner });
    assert.strictEqual(productionSubmissionStore.control.submission_protocol, 'PROTO-1');
    const wrongPeriodSubmissionModel = { findOne() { return query({ ...submission,
        employment_period_start: new Date('2026-07-01T00:00:00.000Z'),
        employment_period_end: new Date('2026-07-31T00:00:00.000Z') }); } };
    await assert.rejects(() => linkEmploymentPeriodSubmission({ session: allowed, scope, reason: 'Λάθος περίοδος',
        submissionId: submission._id, submitted_at: '2026-01-01', submission_protocol: 'FORGED',
        submissionModel: wrongPeriodSubmissionModel, periodControlModel: submissionStore.period,
        auditModel: submissionStore.audit, transactionRunner: runner }),
    (error) => error.code === 'SUBMISSION_PERIOD_SCOPE_MISMATCH');
    const wrongBranchSubmissionModel = { findOne(filter) { assert.strictEqual(filter.ypokatasthma_kodikos, '0001'); return query(null); } };
    await assert.rejects(() => linkEmploymentPeriodSubmission({ session: allowed, scope, reason: 'Άλλο παράρτημα',
        submissionId: submission._id, submissionModel: wrongBranchSubmissionModel,
        periodControlModel: submissionStore.period, auditModel: submissionStore.audit, transactionRunner: runner }),
    (error) => error.code === 'SUBMISSION_NOT_AUTHORITATIVE');
    const wrongTypeSubmissionModel = { findOne(filter) { assert.strictEqual(filter.submission_code, 'WTODailyA');
        assert.strictEqual(filter.process_code, undefined); return query(null); } };
    await assert.rejects(() => linkEmploymentPeriodSubmission({ session: allowed, scope, reason: 'Λάθος τύπος',
        submissionId: submission._id, submissionModel: wrongTypeSubmissionModel,
        periodControlModel: submissionStore.period, auditModel: submissionStore.audit, transactionRunner: runner }),
    (error) => error.code === 'SUBMISSION_NOT_AUTHORITATIVE');
    console.log('employment period lifecycle transaction contracts: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
