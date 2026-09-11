'use strict';
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { resolveWeeklyRepoTransferStage2StateFromPreparedBatch,
    resolveWeeklyRepoTransferDecisionFromPreparedWeek } = require(
    './apasxoliseisWeeklyRepoTransferPreparedStage2ResolverService');
const current = { current_proposal_fingerprint: 'fp', current_proposal: {
    employee_kodikos: '001', week_start: '2026-04-27', week_end: '2026-05-03' } };
assert.strictEqual(resolveWeeklyRepoTransferStage2StateFromPreparedBatch({ records: [current],
    scope: { employee_kodikos: '001', week_start: '2026-04-27', week_end: '2026-05-03' } }), current);
assert.equal(resolveWeeklyRepoTransferStage2StateFromPreparedBatch({ records: [current],
    scope: { employee_kodikos: '002', week_start: '2026-04-27', week_end: '2026-05-03' } }), null);
assert.equal(resolveWeeklyRepoTransferStage2StateFromPreparedBatch({ records: [{
    ...current, current_proposal_fingerprint: '' }], scope: current.current_proposal }), null);

function day(start, offset) { const value = new Date(`${start}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + offset); return value; }
function preparedWeek(start = '2026-07-06') {
    const weekRows = Array.from({ length: 7 }, (_, offset) => ({
        _id: new mongoose.Types.ObjectId(), team: 'THA', company_kod: 'company',
        ypokatasthma: '0000', kodikos: '001', hmeromhnia: day(start, offset),
        kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8, cards_ores_ergasias: 8,
        cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', repo: false,
        is_locked: false }));
    Object.assign(weekRows[1], { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0,
        cards_ores_ergasias: 8 });
    Object.assign(weekRows[4], { cards_ores_ergasias: 0, cards_apo_ora_01: '',
        cards_eos_ora_01: '' });
    Object.assign(weekRows[6], { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0,
        cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '' });
    return { weekRows, employmentProfile: { typos_apasxolhshs: 'PLHRHS',
        hmeres_ergasias_ebdomadas: 5, mo_oron_hmerhsias_ergasias: 8,
        external_break_minutes: 0 }, holidayByDateKey: new Map(),
        existingAuditCountByRowKey: new Map(), diagnosticContext: {
            team: 'THA', company_kod: 'company', ypokatasthma: '0000',
            employee_kodikos: '001', week_start: start,
            week_end: day(start, 6).toISOString().slice(0, 10) } };
}
const weeklyInput = preparedWeek();
const employee = { _id: new mongoose.Types.ObjectId(), kodikos: '001',
    eponymo: 'Test', onoma: 'Employee' };
const base = { weeklyInput, scope: { team: 'THA', company_kod: 'company',
    company_kodikos: '0004', ypokatasthma: '0000' },
canonicalDecisionContext: { employee, history: [], audits: [], companyFlags: {},
    companyKodikos: '0004' }, presentationStart: '2026-07-06',
presentationEnd: '2026-07-12', canonicalSnapshotBuilder: () => ({}),
snapshotFingerprintBuilder: () => 'current' };
const bounded = resolveWeeklyRepoTransferDecisionFromPreparedWeek(base);
assert.ok(bounded.record);
assert.equal(bounded.record.current_proposal.week_start, '2026-07-06');
assert.equal(bounded.record.current_proposal.week_end, '2026-07-12');
assert.equal(bounded.record.apply_state, 'NOT_APPROVED');
const decision = { _id: new mongoose.Types.ObjectId(), proposal_id: bounded.record.proposal_id,
    snapshot_fingerprint: 'current', decision_code: 'APPROVE_PROPOSAL',
    decision_status: 'RECORDED', team: 'THA', ypokatasthma: '0000',
    employee_kodikos: '001', week_start: day('2026-07-06', 0),
    week_end: day('2026-07-06', 6) };
const approved = resolveWeeklyRepoTransferDecisionFromPreparedWeek({ ...base,
    decisions: [decision], applyProtection: { authorized: true, runtimeEnabled: true,
        indexReady: true } }).record;
assert.equal(approved.apply_state, 'READY_TO_APPLY');
assert.equal(approved.current_decision.is_current, true);
const stale = resolveWeeklyRepoTransferDecisionFromPreparedWeek({ ...base,
    decisions: [{ ...decision, snapshot_fingerprint: 'old' }],
    applyProtection: { authorized: true, runtimeEnabled: true, indexReady: true } }).record;
assert.equal(stale.apply_state, 'STALE_DECISION');
const execution = { _id: new mongoose.Types.ObjectId(), decision_id: decision._id,
    execution_status: 'APPLIED', applied_at: new Date('2026-05-04') };
const applied = resolveWeeklyRepoTransferDecisionFromPreparedWeek({ ...base,
    decisions: [decision], executions: [execution],
    applyProtection: { authorized: true, runtimeEnabled: true, indexReady: true } }).record;
assert.equal(applied.apply_state, 'ALREADY_APPLIED');
assert.equal(applied.current_execution.decision_id, String(decision._id));
const protectedApply = resolveWeeklyRepoTransferDecisionFromPreparedWeek({ ...base,
    decisions: [decision], applyProtection: { authorized: false, runtimeEnabled: true,
        indexReady: true } }).record;
assert.equal(protectedApply.apply_state, 'NOT_AUTHORIZED');
const holidayInput = preparedWeek();
holidayInput.holidayByDateKey.set('2026-07-10', { description: 'Αργία',
    ypoxreotikh_argia: true });
assert.doesNotThrow(() => resolveWeeklyRepoTransferDecisionFromPreparedWeek({ ...base,
    weeklyInput: holidayInput }));
const notApplicable = preparedWeek();
notApplicable.weekRows.forEach((row) => Object.assign(row, { kathgoria_ergasias: 'ΑΝ',
    ores_ergasias: 0, cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '' }));
assert.equal(resolveWeeklyRepoTransferDecisionFromPreparedWeek({ ...base,
    weeklyInput: notApplicable }).record, null);
const profileChanged = preparedWeek();
profileChanged.employmentProfile.profile_changed_inside_week = true;
const changedResult = resolveWeeklyRepoTransferDecisionFromPreparedWeek({ ...base,
    weeklyInput: profileChanged });
assert.equal(changedResult.record, null);
assert.ok(changedResult.projection.reason_counts.PROFILE_CHANGED_INSIDE_WEEK > 0);
console.log('prepared Stage 2 resolver tests passed');
