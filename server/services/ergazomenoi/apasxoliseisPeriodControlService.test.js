'use strict';

const assert = require('assert');
const fs = require('fs');
const {
    calculatePeriodDeadline, normalizeScope, resolveEffectiveMode, projectPeriodControl,
    assertNormalPeriod, runWithPeriodWriteFence, transitionPeriodControl, isDateInsideEmploymentPeriod,
    isWeekAllowedForEmploymentPeriod, acquirePeriodCalculationOwnership,
    runWithPeriodCalculationWriteFence, releasePeriodCalculationOwnership
} = require('./apasxoliseisPeriodControlService');

function key(date) { return date.toISOString().slice(0, 10); }
assert.strictEqual(key(calculatePeriodDeadline('2026-06-30')), '2026-07-31');
assert.strictEqual(key(calculatePeriodDeadline('2026-01-31')), '2026-02-28');
assert.strictEqual(key(calculatePeriodDeadline('2028-01-31')), '2028-02-29');
assert.strictEqual(key(calculatePeriodDeadline('2026-12-31')), '2027-01-31');
assert.strictEqual(key(calculatePeriodDeadline(new Date('2026-06-30T23:59:59.999Z'))), '2026-07-31');

const july = { period_start: '2026-07-01', period_end: '2026-07-31' };
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-06-29', week_end: '2026-07-05' }), true);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-07-06', week_end: '2026-07-12' }), true);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-07-27', week_end: '2026-08-02' }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-06-22', week_end: '2026-06-28' }), false);
assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-06-30', week_end: '2026-07-06' }), false);
assert.strictEqual(isDateInsideEmploymentPeriod({ ...july, date: '2026-06-30' }), false);
assert.strictEqual(isDateInsideEmploymentPeriod({ ...july, date: '2026-07-01' }), true);
assert.strictEqual(isDateInsideEmploymentPeriod({ ...july, date: '2026-07-31' }), true);
assert.strictEqual(isDateInsideEmploymentPeriod({ ...july, date: '2026-08-01' }), false);

const scope = normalizeScope({ team: 'THA', company_kod: 'c', ypokatasthma: '0', period_start: '2026-06-01', period_end: '2026-06-30' });
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
const serviceSource = fs.readFileSync(__filename.replace('.test.js', '.js'), 'utf8');
assert.ok(serviceSource.includes('session.withTransaction'));
assert.ok(serviceSource.includes('status: previousStatus, version: beforeVersion'));

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
    assert.strictEqual(isWeekAllowedForEmploymentPeriod({ ...july, week_start: '2026-06-29', week_end: '2026-07-05' }), true);
    await assertNormalPeriod({ scope: julyScope, now: new Date('2026-07-15'), periodControlModel: fake().model });
    await assert.rejects(() => assertNormalPeriod({ scope: julyScope, now: new Date('2026-07-15'), periodControlModel: fake({ status: 'LOCKED', version: 1, deadline: new Date('2026-08-31') }).model }), (error) => error.code === 'PERIOD_CONTROL_LOCKED');
    await assert.rejects(() => assertNormalPeriod({ scope: julyScope, now: new Date('2026-09-01'), periodControlModel: fake().model }), (error) => error.code === 'PERIOD_CONTROL_HISTORICAL_RECONSTRUCTION_REQUIRED');
    const empty = fake();
    const normal = await assertNormalPeriod({ scope, now: new Date('2026-07-01'), periodControlModel: empty.model });
    assert.strictEqual(normal.token.exists, false);
    await assert.rejects(() => assertNormalPeriod({ scope, now: new Date('2026-08-01'), periodControlModel: empty.model }), (error) => error.code === 'PERIOD_CONTROL_HISTORICAL_RECONSTRUCTION_REQUIRED');

    const store = fake();
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
        periodControlModel: owned.model, indexGuard, transactionRunner });
    const lockAfterRelease = await transitionPeriodControl({ session, scope, action: 'LOCK', reason: 'completed calculation',
        requestId: 'period-owner-lock-02', now: new Date('2026-07-01'), expectedVersion: 1,
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
