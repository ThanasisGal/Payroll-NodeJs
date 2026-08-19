'use strict';

const assert = require('assert');
const fs = require('fs');
const mongoose = require('mongoose');
const PeriodControlModel = require('../../models/apasxoliseisPeriodControl');
const {
    calculatePeriodDeadline, normalizeScope, resolveEffectiveMode, projectPeriodControl,
    assertNormalPeriod, assertReviewReadablePeriod, assertCanonicalDecisionPeriod,
    runWithPeriodWriteFence, runWithStaleCanonicalDecisionWriteFence,
    runWithStaleOrphanResolutionWriteFence,
    transitionPeriodControl, isDateInsideEmploymentPeriod,
    isWeekAllowedForEmploymentPeriod, hasFullNaturalWeekCoverage, acquirePeriodCalculationOwnership,
    runWithPeriodCalculationWriteFence, releasePeriodCalculationOwnership
} = require('./apasxoliseisPeriodControlService');

function key(date) { return date.toISOString().slice(0, 10); }
assert.strictEqual(key(calculatePeriodDeadline('2026-06-30')), '2026-07-31');
assert.strictEqual(key(calculatePeriodDeadline('2026-01-31')), '2026-02-28');
assert.strictEqual(key(calculatePeriodDeadline('2028-01-31')), '2028-02-29');
assert.strictEqual(key(calculatePeriodDeadline('2026-12-31')), '2027-01-31');
assert.strictEqual(key(calculatePeriodDeadline(new Date('2026-06-30T23:59:59.999Z'))), '2026-07-31');

const july = { period_start: '2026-07-01', period_end: '2026-07-31' };
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-06-29', week_end: '2026-07-05' }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-07-06', week_end: '2026-07-12' }), true);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-07-27', week_end: '2026-08-02' }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-06-22', week_end: '2026-06-28' }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-06-30', week_end: '2026-07-06' }), false);
assert.strictEqual(isDateInsideEmploymentPeriod({ ...july, date: '2026-06-30' }), false);
assert.strictEqual(isDateInsideEmploymentPeriod({ ...july, date: '2026-07-01' }), true);
assert.strictEqual(isDateInsideEmploymentPeriod({ ...july, date: '2026-07-31' }), true);
assert.strictEqual(isDateInsideEmploymentPeriod({ ...july, date: '2026-08-01' }), false);

const scope = normalizeScope({ team: 'THA', company_kod: 'c', ypokatasthma: '0', period_start: '2026-06-01', period_end: '2026-06-30' });
const juneCrossMonth = { period_start: '2026-06-01', period_end: '2026-06-30',
    week_start: '2026-06-29', week_end: '2026-07-05' };
const reconstructedWeek = { ...juneCrossMonth, period_control: {
    effective_mode: 'HISTORICAL_RECONSTRUCTED', historical_reconstruction_status: 'COMPLETED'
}, historical_as_of: '2026-08-12', authoritative_row_dates: [
    '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02',
    '2026-07-03', '2026-07-04', '2026-07-05'
] };
assert.strictEqual(isWeekAllowedForEmploymentPeriod(reconstructedWeek), true);
const staleCompletedWeek = { ...reconstructedWeek,
    period_control: { effective_mode: 'HISTORICAL_RECONSTRUCTION_STALE',
        historical_reconstruction_status: 'COMPLETED' },
    allow_stale_completed_context: true };
assert.strictEqual(isWeekAllowedForEmploymentPeriod(staleCompletedWeek), true);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...staleCompletedWeek,
    authoritative_row_dates: ['2026-06-30', '2026-07-01', '2026-07-02'],
    required_authoritative_dates: ['2026-06-30', '2026-07-01', '2026-07-02'] }), true);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...staleCompletedWeek,
    allow_stale_completed_context: false }), false);
assert.strictEqual(hasFullNaturalWeekCoverage({ week_start: '2026-06-29',
    week_end: '2026-07-05', authoritative_row_dates: reconstructedWeek.authoritative_row_dates }), true);
assert.strictEqual(hasFullNaturalWeekCoverage({ week_start: '2026-06-29',
    week_end: '2026-07-05', authoritative_row_dates:
        reconstructedWeek.authoritative_row_dates.slice(0, 6) }), false);
assert.strictEqual(hasFullNaturalWeekCoverage({ week_start: '2026-06-30',
    week_end: '2026-07-06', authoritative_row_dates: reconstructedWeek.authoritative_row_dates }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...reconstructedWeek,
    period_control: { effective_mode: 'NORMAL', historical_reconstruction_status: 'COMPLETED' } }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...reconstructedWeek,
    period_control: { effective_mode: 'HISTORICAL_RECONSTRUCTED', historical_reconstruction_status: 'AUTHORIZED' } }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...reconstructedWeek,
    authoritative_row_dates: reconstructedWeek.authoritative_row_dates.slice(0, 6) }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...reconstructedWeek,
    historical_as_of: '2026-07-04' }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...reconstructedWeek,
    week_start: '2026-06-30', week_end: '2026-07-06' }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...reconstructedWeek, ...july }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ period_start: '2026-06-01', period_end: '2026-06-30',
    week_start: '2026-06-22', week_end: '2026-06-28' }), true);
const deadline = calculatePeriodDeadline(scope.period_end);
assert.strictEqual(resolveEffectiveMode({ storedStatus: 'OPEN', deadline, now: new Date('2026-07-31T20:59:00Z') }), 'NORMAL');
assert.strictEqual(resolveEffectiveMode({ storedStatus: 'OPEN', deadline, now: new Date('2026-07-31T21:00:00Z') }), 'HISTORICAL_RECONSTRUCTION_REQUIRED');
assert.strictEqual(resolveEffectiveMode({ storedStatus: 'LOCKED', deadline, now: new Date('2026-07-31') }), 'LOCKED');
assert.strictEqual(resolveEffectiveMode({ storedStatus: 'FINALIZED', deadline, now: new Date('2026-07-31') }), 'FINALIZED');
assert.strictEqual(resolveEffectiveMode({ storedStatus: 'OPEN', deadline, now: new Date('2026-08-01') }), 'HISTORICAL_RECONSTRUCTION_REQUIRED');
assert.strictEqual(resolveEffectiveMode({ storedStatus: 'LOCKED', deadline, now: new Date('2026-08-01') }), 'LOCKED');
assert.strictEqual(resolveEffectiveMode({ storedStatus: 'FINALIZED', deadline, now: new Date('2026-08-01') }), 'FINALIZED');
assert.strictEqual(projectPeriodControl({ scope, now: new Date('2026-07-01') }).effective_mode, 'NORMAL');
assert.strictEqual(projectPeriodControl({ scope, now: new Date('2026-08-01') }).effective_mode, 'HISTORICAL_RECONSTRUCTION_REQUIRED');
const reconstructedRecord = {
    status: 'OPEN', deadline: new Date('2026-07-31'),
    historical_reconstruction_status: 'COMPLETED', historical_reconstruction_version: 1,
    historical_dependency_fingerprint: 'a'.repeat(64)
};
const reconstructedProjection = projectPeriodControl({ scope, record: reconstructedRecord,
    now: new Date('2026-08-01'), dependencyFingerprint: 'a'.repeat(64) });
assert.strictEqual(reconstructedProjection.effective_mode, 'HISTORICAL_RECONSTRUCTED');
assert.strictEqual(reconstructedProjection.has_authoritative_calculation_result, true);
const staleProjection = projectPeriodControl({ scope, record: reconstructedRecord,
    now: new Date('2026-08-01'), dependencyFingerprint: 'b'.repeat(64) });
assert.strictEqual(staleProjection.effective_mode, 'HISTORICAL_RECONSTRUCTION_STALE');
assert.strictEqual(staleProjection.has_authoritative_calculation_result, false);
assert.strictEqual(staleProjection.can_record_decision, false);
assert.strictEqual(staleProjection.can_record_stale_canonical_decision, true);
const serviceSource = fs.readFileSync(__filename.replace('.test.js', '.js'), 'utf8');
assert.ok(serviceSource.includes('session.withTransaction'));
assert.ok(serviceSource.includes('status: previousStatus, version: beforeVersion'));

mongoose.set('sanitizeFilter', true);
const unsafeMissingFieldQuery = PeriodControlModel.findOneAndUpdate({
    $or: [{ active_calculation_id: '' }, { active_calculation_id: null },
        { active_calculation_id: { $exists: false } }]
}, { $set: { active_calculation_id: 'calculation-cast-regression' } });
unsafeMissingFieldQuery._castConditions();
assert.ok(unsafeMissingFieldQuery.error() instanceof mongoose.Error.CastError);
const trustedMissingFieldQuery = PeriodControlModel.findOneAndUpdate({
    $or: [{ active_calculation_id: '' }, { active_calculation_id: null },
        { active_calculation_id: mongoose.trusted({ $exists: false }) }]
}, { $set: { active_calculation_id: 'calculation-cast-regression' } });
trustedMissingFieldQuery._castConditions();
assert.strictEqual(trustedMissingFieldQuery.error(), undefined);
assert.strictEqual(trustedMissingFieldQuery.getFilter().$or[2]
    .active_calculation_id.$exists, false);

function fake(initial = null, options = {}) {
    let record = initial ? { ...initial } : null;
    const audits = [];
    return {
        model: {
            findOne() { return { lean: async () => record ? { ...record } : null }; },
            async create(value) { record = { ...value, _id: 'control' }; return { ...record }; },
            async findOneAndUpdate(filter, update) {
                if (options.conflict || !record || record.status !== filter.status || record.version !== filter.version) return null;
                record = { ...record, ...update.$set }; return { ...record };
            }
        },
        audit: { async create(value) { audits.push(value); return value; } },
        get record() { return record; }, audits
    };
}
const session = { userRole: 'HR', userId: '507f1f77bcf86cd799439011', userName: 'HR User' };

(async () => {
    const julyScope = normalizeScope({ team: 'THA', company_kod: 'c', ypokatasthma: '0', ...july });
    assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-06-29', week_end: '2026-07-05' }), false);
    await assertNormalPeriod({ scope: julyScope, now: new Date('2026-07-15'), periodControlModel: fake().model });
    await assert.rejects(() => assertNormalPeriod({ scope: julyScope, now: new Date('2026-07-15'), periodControlModel: fake({ status: 'LOCKED', version: 1, deadline: new Date('2026-08-31') }).model }), (error) => error.code === 'PERIOD_CONTROL_LOCKED');
    await assert.rejects(() => assertNormalPeriod({ scope: julyScope, now: new Date('2026-09-01'), periodControlModel: fake().model }), (error) => error.code === 'PERIOD_CONTROL_HISTORICAL_RECONSTRUCTION_REQUIRED');
    const empty = fake();
    const normal = await assertNormalPeriod({ scope, now: new Date('2026-07-01'), periodControlModel: empty.model });
    assert.strictEqual(normal.token.exists, false);
    await assert.rejects(() => assertNormalPeriod({ scope, now: new Date('2026-08-01'), periodControlModel: empty.model }), (error) => error.code === 'PERIOD_CONTROL_HISTORICAL_RECONSTRUCTION_REQUIRED');

    const staleStateResolver = async () => staleProjection;
    const staleReadable = await assertReviewReadablePeriod({ scope,
        stateResolver: staleStateResolver });
    assert.strictEqual(staleReadable.state.effective_mode, 'HISTORICAL_RECONSTRUCTION_STALE');
    const staleDecisionAccess = await assertCanonicalDecisionPeriod({ scope,
        stateResolver: staleStateResolver });
    assert.strictEqual(staleDecisionAccess.state.can_record_stale_canonical_decision, true);
    await assert.rejects(() => assertReviewReadablePeriod({ scope,
        stateResolver: async () => ({ ...staleProjection,
            effective_mode: 'HISTORICAL_RECONSTRUCTION_REQUIRED' }) }),
    (error) => error.code === 'PERIOD_CONTROL_REVIEW_NOT_AVAILABLE');
    await assert.rejects(() => assertCanonicalDecisionPeriod({ scope,
        stateResolver: async () => ({ ...staleProjection,
            can_record_stale_canonical_decision: false }) }),
    (error) => error.code === 'PERIOD_CONTROL_STALE_CANONICAL_DECISION_NOT_ALLOWED');

    let staleCanonicalWrites = 0;
    const staleFenceStore = fake({ ...reconstructedRecord, version: 9,
        write_fence_version: 2, active_calculation_id: '' });
    const staleFenceResult = await runWithStaleCanonicalDecisionWriteFence({
        scope, expectedToken: { exists: true, stored_status: 'OPEN', version: 9 },
        now: new Date('2026-08-14'), periodControlModel: staleFenceStore.model,
        indexGuard: async () => ({ ready: true }),
        fingerprintResolver: async () => ({ dependency_fingerprint: 'b'.repeat(64) }),
        transactionRunner: async (work) => work({ id: 'stale-canonical-session' }),
        work: ({ session }) => {
            assert.strictEqual(session.id, 'stale-canonical-session');
            staleCanonicalWrites += 1;
            return 'canonical-only';
        }
    });
    assert.strictEqual(staleFenceResult.result, 'canonical-only');
    assert.strictEqual(staleFenceResult.state.effective_mode, 'HISTORICAL_RECONSTRUCTION_STALE');
    assert.strictEqual(staleFenceResult.state.historical_reconstruction_status, 'COMPLETED');
    assert.strictEqual(staleFenceResult.state.historical_reconstruction_version, 1);
    assert.strictEqual(staleCanonicalWrites, 1);
    let staleOrphanWrites = 0;
    const staleOrphanStore = fake({ ...reconstructedRecord, version: 10,
        write_fence_version: 4, active_calculation_id: '' });
    const staleOrphanResult = await runWithStaleOrphanResolutionWriteFence({
        scope, expectedToken: { exists: true, stored_status: 'OPEN', version: 10 },
        now: new Date('2026-08-14'), periodControlModel: staleOrphanStore.model,
        indexGuard: async () => ({ ready: true }),
        fingerprintResolver: async () => ({ dependency_fingerprint: 'b'.repeat(64) }),
        transactionRunner: async (work) => work({ id: 'stale-orphan-session' }),
        work: ({ session, state }) => {
            assert.strictEqual(session.id, 'stale-orphan-session');
            assert.strictEqual(state.effective_mode, 'HISTORICAL_RECONSTRUCTION_STALE');
            staleOrphanWrites += 1;
            return 'orphan-only';
        }
    });
    assert.strictEqual(staleOrphanResult.result, 'orphan-only');
    assert.strictEqual(staleOrphanResult.state.historical_reconstruction_status, 'COMPLETED');
    assert.strictEqual(staleOrphanWrites, 1);

    const store = fake();
    const pendingStore = fake();
    await assert.rejects(() => transitionPeriodControl({ session, scope, action: 'LOCK', reason: 'pending guard',
        requestId: 'period-pending-lock-001', now: new Date('2026-07-01'), expectedVersion: 0,
        periodControlModel: pendingStore.model, auditModel: pendingStore.audit,
        indexGuard: async () => ({ ready: true }), periodHrReadinessResolver: async () => ({
            ready: false, total_pending_count: 1, pending_cases: [{ employee_kodikos: '999' }]
        }) }), (error) => error.code === 'PERIOD_HAS_PENDING_HR_ACTIONS');
    assert.strictEqual(pendingStore.record, null);
    const dataQualityStore = fake();
    await assert.rejects(() => transitionPeriodControl({ session, scope, action: 'LOCK', reason: 'data quality',
        requestId: 'period-data-quality-001', now: new Date('2026-07-01'), expectedVersion: 0,
        periodControlModel: dataQualityStore.model, auditModel: dataQualityStore.audit,
        indexGuard: async () => ({ ready: true }), periodDataQualityReadinessResolver: async () => ({
            ready: false, unresolved_count: 1, unresolved_cases: [{ employee_kodikos: '0003' }]
        }) }), (error) => error.code === 'PERIOD_HAS_UNRESOLVED_DATA_QUALITY_ISSUES');
    assert.strictEqual(dataQualityStore.record, null);
    const locked = await transitionPeriodControl({ session, scope, action: 'LOCK', reason: 'Οριστικοποίηση ελέγχου', requestId: 'period-lock-001', now: new Date('2026-07-01'), expectedVersion: 0, periodControlModel: store.model, auditModel: store.audit, indexGuard: async () => ({ ready: true }) });
    assert.strictEqual(locked.state.stored_status, 'LOCKED');
    assert.strictEqual(store.audits.length, 1);
    assert.strictEqual(store.audits[0].version_before, 0);
    assert.strictEqual(store.audits[0].version_after, 1);
    const idempotent = await transitionPeriodControl({ session, scope, action: 'LOCK', reason: 'Οριστικοποίηση ελέγχου', requestId: 'period-lock-001', now: new Date('2026-07-01'), expectedVersion: 1, periodControlModel: store.model, auditModel: store.audit, indexGuard: async () => ({ ready: true }) });
    assert.strictEqual(idempotent.idempotent, true);
    await assert.rejects(() => transitionPeriodControl({ session, scope, action: 'LOCK', reason: 'Άλλη εντολή', requestId: 'period-lock-002', now: new Date('2026-07-01'), expectedVersion: 1, periodControlModel: store.model, auditModel: store.audit, indexGuard: async () => ({ ready: true }) }), (error) => error.code === 'PERIOD_CONTROL_STATE_CONFLICT');
    const unlocked = await transitionPeriodControl({ session, scope, action: 'UNLOCK', reason: 'Νέα αιτιολογία', requestId: 'period-unlock-001', now: new Date('2026-07-01'), expectedVersion: 1, periodControlModel: store.model, auditModel: store.audit, indexGuard: async () => ({ ready: true }) });
    assert.strictEqual(unlocked.state.stored_status, 'OPEN');
    assert.strictEqual(store.audits.length, 2);
    assert.strictEqual(store.record.locked_at, null);
    await assert.rejects(() => transitionPeriodControl({ session, scope, action: 'LOCK', reason: '', requestId: 'period-lock-003', now: new Date('2026-07-01'), periodControlModel: store.model, auditModel: store.audit }), (error) => error.code === 'PERIOD_CONTROL_REASON_REQUIRED');
    await assert.rejects(() => transitionPeriodControl({ session, scope, action: 'LOCK', reason: 'late', requestId: 'period-lock-004', now: new Date('2026-08-01'), periodControlModel: store.model, auditModel: store.audit }), (error) => error.code === 'HISTORICAL_RECONSTRUCTION_REQUIRED');
    for (const role of ['U', 'C', 'V']) {
        await assert.rejects(() => transitionPeriodControl({ session: { ...session, userRole: role }, scope, action: 'LOCK', reason: 'x', requestId: `period-role-${role}-01`, now: new Date('2026-07-01'), periodControlModel: store.model, auditModel: store.audit }), (error) => error.statusCode === 403);
    }
    for (const role of ['A', 'S', 'HR']) {
        const roleStore = fake();
        const roleResult = await transitionPeriodControl({
            session: { ...session, userRole: role }, scope, action: 'LOCK', reason: 'Έλεγχος ρόλου',
            requestId: `period-allowed-${role}-01`, now: new Date('2026-07-01'), expectedVersion: 0,
            periodControlModel: roleStore.model, auditModel: roleStore.audit,
            indexGuard: async () => ({ ready: true })
        });
        assert.strictEqual(roleResult.state.stored_status, 'LOCKED');
    }
    const conflictStore = fake({ ...store.record, status: 'OPEN', version: 2 }, { conflict: true });
    await assert.rejects(() => transitionPeriodControl({ session, scope, action: 'LOCK', reason: 'race', requestId: 'period-race-001', now: new Date('2026-07-01'), expectedVersion: 2, periodControlModel: conflictStore.model, auditModel: conflictStore.audit, indexGuard: async () => ({ ready: true }) }), (error) => error.code === 'PERIOD_CONTROL_STATE_CONFLICT');
    const lockedStore = fake({ ...store.record, status: 'LOCKED', version: 3 });
    await assert.rejects(() => assertNormalPeriod({ scope, now: new Date('2026-07-01'), periodControlModel: lockedStore.model }), (error) => error.code === 'PERIOD_CONTROL_LOCKED');
    await assert.rejects(() => assertNormalPeriod({ scope, now: new Date('2026-07-01'), expectedToken: { exists: false, stored_status: 'OPEN', version: 0 }, periodControlModel: lockedStore.model }), (error) => error.code === 'PERIOD_CONTROL_STATE_CONFLICT');
    let fencedWrites = 0;
    const fenceStore = fake({ ...store.record, status: 'OPEN', version: 4, write_fence_version: 0 });
    const fencedResult = await runWithPeriodWriteFence({
        scope, expectedToken: { exists: true, stored_status: 'OPEN', version: 4 },
        now: new Date('2026-07-01'),
        periodControlModel: fenceStore.model, indexGuard: async () => ({ ready: true }),
        transactionRunner: async (work) => work({ id: 'transaction-session' }),
        work: ({ session }) => { assert.strictEqual(session.id, 'transaction-session'); fencedWrites++; return 'written'; }
    });
    assert.strictEqual(fencedResult.result, 'written');
    assert.strictEqual(fencedWrites, 1);
    const lockedAtWriterBoundary = fake({ ...store.record, status: 'LOCKED', version: 5 });
    await assert.rejects(() => runWithPeriodWriteFence({
        scope, expectedToken: { exists: true, stored_status: 'OPEN', version: 4 },
        now: new Date('2026-07-01'),
        periodControlModel: lockedAtWriterBoundary.model, indexGuard: async () => ({ ready: true }),
        transactionRunner: async (work) => work({ id: 'transaction-session' }),
        work: () => { fencedWrites++; }
    }), (error) => error.code === 'PERIOD_CONTROL_STATE_CONFLICT');
    assert.strictEqual(fencedWrites, 1);
    let committedBoundaryWrites = 0;
    let stagedBoundaryWrites = 0;
    const commitRaceStore = fake({ ...store.record, status: 'OPEN', version: 6, write_fence_version: 0 });
    await assert.rejects(() => runWithPeriodWriteFence({
        scope, expectedToken: { exists: true, stored_status: 'OPEN', version: 6 },
        now: new Date('2026-07-01'), periodControlModel: commitRaceStore.model,
        indexGuard: async () => ({ ready: true }),
        transactionRunner: async (work) => {
            await work({ id: 'transaction-session' });
            const conflict = new Error('period lock won before commit');
            conflict.code = 112; conflict.codeName = 'WriteConflict'; throw conflict;
        },
        work: () => { stagedBoundaryWrites++; }
    }), (error) => error.code === 'PERIOD_CONTROL_STATE_CONFLICT');
    assert.strictEqual(stagedBoundaryWrites, 1);
    assert.strictEqual(committedBoundaryWrites, 0);
    assert.strictEqual(store.record.is_locked, undefined);

    function ownershipStore(initial = null) {
        let record = initial ? { ...initial } : null;
        const audits = [];
        const matches = (filter) => {
            if (!record) return false;
            if (filter.status !== undefined && record.status !== filter.status) return false;
            if (filter.version !== undefined && record.version !== filter.version) return false;
            if (filter.historical_reconstruction_status !== undefined &&
                record.historical_reconstruction_status !== filter.historical_reconstruction_status) return false;
            if (filter.last_historical_reconstruction_request_id !== undefined &&
                record.last_historical_reconstruction_request_id !== filter.last_historical_reconstruction_request_id) return false;
            if (filter.active_calculation_id !== undefined && record.active_calculation_id !== filter.active_calculation_id) return false;
            if (filter.$or && !filter.$or.some((condition) => {
                const expected = condition.active_calculation_id;
                if (expected && typeof expected === 'object' && expected.$exists === false) return record.active_calculation_id === undefined;
                return record.active_calculation_id === expected;
            })) return false;
            return true;
        };
        return {
            model: {
                findOne() { return { session() { return this; }, lean: async () => record ? { ...record } : null }; },
                async create(value) {
                    const document = Array.isArray(value) ? value[0] : value;
                    if (record) { const error = new Error('duplicate'); error.code = 11000; throw error; }
                    record = { ...document, _id: 'control' };
                    const output = { ...record };
                    return Array.isArray(value) ? [output] : output;
                },
                async findOneAndUpdate(filter, update) {
                    if (!matches(filter)) return null;
                    record = { ...record, ...(update.$set || {}) };
                    if (update.$inc) for (const [field, amount] of Object.entries(update.$inc)) record[field] = Number(record[field] || 0) + amount;
                    return { ...record };
                }
            },
            audit: { async create(value) { audits.push(Array.isArray(value) ? value[0] : value); } },
            get record() { return record; }, audits
        };
    }
    const transactionRunner = async (work) => work({ id: 'ownership-transaction' });
    const indexGuard = async () => ({ ready: true });
    const baseRecord = { ...scope, status: 'OPEN', deadline, version: 1, write_fence_version: 0,
        active_calculation_id: '', active_calculation_started_at: null };
    for (const [label, activeValue] of [['empty', ''], ['null', null], ['missing', undefined]]) {
        const eligibleRecord = { ...baseRecord };
        if (activeValue === undefined) delete eligibleRecord.active_calculation_id;
        else eligibleRecord.active_calculation_id = activeValue;
        const eligible = ownershipStore(eligibleRecord);
        const result = await transitionPeriodControl({ session, scope, action: 'LOCK',
            reason: `Lock with ${label} calculation owner`, requestId: `period-lock-${label}-owner`,
            now: new Date('2026-07-01'), expectedVersion: 1,
            periodControlModel: eligible.model, auditModel: eligible.audit,
            indexGuard: async () => ({ ready: true }) });
        assert.strictEqual(result.state.stored_status, 'LOCKED');
    }
    const activeLockOwner = ownershipStore({ ...baseRecord,
        active_calculation_id: 'active-calculation-id' });
    await assert.rejects(() => transitionPeriodControl({ session, scope, action: 'LOCK',
        reason: 'Lock with active calculation owner', requestId: 'period-lock-active-owner',
        now: new Date('2026-07-01'), expectedVersion: 1,
        periodControlModel: activeLockOwner.model, auditModel: activeLockOwner.audit,
        indexGuard: async () => ({ ready: true }) }),
    (error) => error.code === 'PERIOD_CONTROL_CALCULATION_IN_PROGRESS');
    assert.strictEqual(activeLockOwner.record.status, 'OPEN');
    for (const [label, activeValue] of [['empty', ''], ['null', null], ['missing', undefined]]) {
        const eligibleRecord = { ...baseRecord };
        if (activeValue === undefined) delete eligibleRecord.active_calculation_id;
        else eligibleRecord.active_calculation_id = activeValue;
        const eligible = ownershipStore(eligibleRecord);
        const eligibleOwner = await acquirePeriodCalculationOwnership({ scope,
            calculationId: `calculation-${label}-owner`, now: new Date('2026-07-01'),
            periodControlModel: eligible.model, indexGuard, transactionRunner });
        assert.strictEqual(eligibleOwner.calculationId, `calculation-${label}-owner`);
        assert.strictEqual(eligible.record.active_calculation_id, `calculation-${label}-owner`);
    }

    const occupied = ownershipStore({ ...baseRecord, active_calculation_id: 'calculation-existing-owner' });
    await assert.rejects(() => acquirePeriodCalculationOwnership({ scope,
        calculationId: 'calculation-takeover-owner', now: new Date('2026-07-01'),
        periodControlModel: occupied.model, indexGuard, transactionRunner }),
    (error) => error.code === 'PERIOD_CONTROL_CALCULATION_IN_PROGRESS');
    assert.strictEqual(occupied.record.active_calculation_id, 'calculation-existing-owner');

    const lockedOwnership = ownershipStore({ ...baseRecord, status: 'LOCKED' });
    await assert.rejects(() => acquirePeriodCalculationOwnership({ scope,
        calculationId: 'calculation-locked-owner', now: new Date('2026-07-01'),
        periodControlModel: lockedOwnership.model, indexGuard, transactionRunner }),
    (error) => error.code === 'PERIOD_CONTROL_LOCKED');

    const historicalRecord = { ...baseRecord,
        historical_reconstruction_status: 'AUTHORIZED',
        last_historical_reconstruction_request_id: 'historical-authorized-request' };
    const historicalOwnership = ownershipStore(historicalRecord);
    const historicalOwner = await acquirePeriodCalculationOwnership({ scope,
        calculationId: 'historical-authorized-owner',
        historicalRequestId: 'historical-authorized-request', now: new Date('2026-08-01'),
        periodControlModel: historicalOwnership.model, indexGuard, transactionRunner });
    assert.strictEqual(historicalOwner.historical, true);

    const wrongHistoricalRequest = ownershipStore(historicalRecord);
    await assert.rejects(() => acquirePeriodCalculationOwnership({ scope,
        calculationId: 'historical-wrong-request-owner',
        historicalRequestId: 'historical-wrong-request', now: new Date('2026-08-01'),
        periodControlModel: wrongHistoricalRequest.model, indexGuard, transactionRunner }),
    (error) => error.code === 'PERIOD_CONTROL_STATE_CONFLICT');
    assert.strictEqual(wrongHistoricalRequest.record.active_calculation_id, '');

    const owned = ownershipStore(baseRecord);
    const owner = await acquirePeriodCalculationOwnership({ scope, calculationId: 'calculation-owner-0001',
        now: new Date('2026-07-01'), periodControlModel: owned.model, indexGuard, transactionRunner });
    const committedStages = [];
    await runWithPeriodCalculationWriteFence({ scope, calculationId: owner.calculationId,
        periodControlModel: owned.model, indexGuard, transactionRunner,
        work: async () => { committedStages.push('first-chunk'); return { modifiedCount: 1 }; } });
    await assert.rejects(() => transitionPeriodControl({ session, scope, action: 'LOCK', reason: 'lock after chunk',
        requestId: 'period-owner-lock-01', now: new Date('2026-07-01'), expectedVersion: 1,
        periodControlModel: owned.model, auditModel: owned.audit, indexGuard, transactionRunner }),
    (error) => error.code === 'PERIOD_CONTROL_CALCULATION_IN_PROGRESS' &&
        error.message === 'Δεν είναι δυνατή η ολοκλήρωση του κλειδώματος επειδή βρίσκεται σε εξέλιξη Υπολογισμός Απασχολήσεων.');
    for (const stage of ['next-chunk', 'post-check', 'deviations']) await runWithPeriodCalculationWriteFence({
        scope, calculationId: owner.calculationId, periodControlModel: owned.model, indexGuard, transactionRunner,
        work: async () => { committedStages.push(stage); }
    });
    assert.deepStrictEqual(committedStages, ['first-chunk', 'next-chunk', 'post-check', 'deviations']);
    await releasePeriodCalculationOwnership({ scope, calculationId: owner.calculationId,
        successful: true, periodControlModel: owned.model, indexGuard, transactionRunner });
    assert.strictEqual(owned.record.successful_calculation_version, 1);
    assert.strictEqual(owned.record.last_successful_calculation_id, owner.calculationId);
    assert.ok(owned.record.last_successful_calculation_at instanceof Date);
    assert.strictEqual(projectPeriodControl({ scope, record: owned.record,
        now: new Date('2026-07-01') }).has_authoritative_calculation_result, true);
    const lockAfterRelease = await transitionPeriodControl({ session, scope, action: 'LOCK', reason: 'completed calculation',
        requestId: 'period-owner-lock-02', now: new Date('2026-07-01'), expectedVersion: 2,
        periodControlModel: owned.model, auditModel: owned.audit, indexGuard, transactionRunner });
    assert.strictEqual(lockAfterRelease.state.stored_status, 'LOCKED');

    const twoCalculations = ownershipStore(baseRecord);
    await acquirePeriodCalculationOwnership({ scope, calculationId: 'calculation-owner-0002', now: new Date('2026-07-01'),
        periodControlModel: twoCalculations.model, indexGuard, transactionRunner });
    await assert.rejects(() => acquirePeriodCalculationOwnership({ scope, calculationId: 'calculation-owner-0003',
        now: new Date('2026-07-01'), periodControlModel: twoCalculations.model, indexGuard, transactionRunner }),
    (error) => error.code === 'PERIOD_CONTROL_CALCULATION_IN_PROGRESS');

    const failedCalculation = ownershipStore(baseRecord);
    const failedOwner = await acquirePeriodCalculationOwnership({ scope, calculationId: 'calculation-owner-0004',
        now: new Date('2026-07-01'), periodControlModel: failedCalculation.model, indexGuard, transactionRunner });
    await runWithPeriodCalculationWriteFence({ scope, calculationId: failedOwner.calculationId,
        periodControlModel: failedCalculation.model, indexGuard, transactionRunner, work: async () => committedStages.push('partial') });
    await assert.rejects(() => transitionPeriodControl({ session, scope, action: 'LOCK', reason: 'during failure cleanup',
        requestId: 'period-owner-lock-03', now: new Date('2026-07-01'), expectedVersion: 1,
        periodControlModel: failedCalculation.model, auditModel: failedCalculation.audit, indexGuard, transactionRunner }),
    (error) => error.code === 'PERIOD_CONTROL_CALCULATION_IN_PROGRESS');
    await releasePeriodCalculationOwnership({ scope, calculationId: failedOwner.calculationId,
        periodControlModel: failedCalculation.model, indexGuard, transactionRunner });
    assert.strictEqual(failedCalculation.record.status, 'OPEN');
    assert.strictEqual(failedCalculation.record.successful_calculation_version, undefined);
    assert.strictEqual(projectPeriodControl({ scope, record: failedCalculation.record,
        now: new Date('2026-07-01') }).has_authoritative_calculation_result, false);
    await acquirePeriodCalculationOwnership({ scope, calculationId: 'calculation-owner-retry', now: new Date('2026-07-02'),
        periodControlModel: failedCalculation.model, indexGuard, transactionRunner });

    const deadlineCrossing = ownershipStore(baseRecord);
    const deadlineOwner = await acquirePeriodCalculationOwnership({ scope, calculationId: 'calculation-owner-deadline',
        now: new Date('2026-07-31T20:59:00Z'), periodControlModel: deadlineCrossing.model, indexGuard, transactionRunner });
    await runWithPeriodCalculationWriteFence({ scope, calculationId: deadlineOwner.calculationId,
        periodControlModel: deadlineCrossing.model, indexGuard, transactionRunner, work: async () => committedStages.push('after-deadline') });
    await releasePeriodCalculationOwnership({ scope, calculationId: deadlineOwner.calculationId,
        periodControlModel: deadlineCrossing.model, indexGuard, transactionRunner });
    await assert.rejects(() => acquirePeriodCalculationOwnership({ scope, calculationId: 'calculation-after-deadline',
        now: new Date('2026-08-01'), periodControlModel: deadlineCrossing.model, indexGuard, transactionRunner }),
    (error) => error.code === 'PERIOD_CONTROL_CORRECTIVE_ONLY');

    const julyScopeIndependent = normalizeScope({ team: 'THA', company_kod: 'c', ypokatasthma: '0',
        period_start: '2026-07-01', period_end: '2026-07-31' });
    const juneIndependent = ownershipStore(baseRecord);
    const julyIndependent = ownershipStore({ ...julyScopeIndependent, status: 'OPEN',
        deadline: calculatePeriodDeadline(julyScopeIndependent.period_end), version: 1, active_calculation_id: '' });
    await Promise.all([
        acquirePeriodCalculationOwnership({ scope, calculationId: 'calculation-june-owner', now: new Date('2026-07-01'),
            periodControlModel: juneIndependent.model, indexGuard, transactionRunner }),
        acquirePeriodCalculationOwnership({ scope: julyScopeIndependent, calculationId: 'calculation-july-owner', now: new Date('2026-08-01'),
            periodControlModel: julyIndependent.model, indexGuard, transactionRunner })
    ]);
    assert.strictEqual(juneIndependent.record.active_calculation_id, 'calculation-june-owner');
    assert.strictEqual(julyIndependent.record.active_calculation_id, 'calculation-july-owner');
    console.log('apasxoliseisPeriodControlService tests: ownership contract PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
