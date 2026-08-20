'use strict';

const assert = require('node:assert/strict');
const erganhController = require('../../controllers/ergazomenoi/erganhController');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');
const { previewFrozenCorrectiveWeek } = require('./apasxoliseisPeriodCorrectiveService');

const rowId = '6a7c515e6aeaefb3c8764b54';
const profile = Object.freeze({ kodikos: '0004', typos_apasxolhshs: 'PLHRHS',
    plhrhs_apasxolhsh: true, hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
    dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30,
    pragmatikoOromisthio: 10, nomimoOromisthio: 8,
    pososto_prosayxhshs_6hs_hmeras: 0,
    eidikh_kathgoria_ergazomenoy: '0009' });

function frozenRow(index) {
    const date = new Date(Date.UTC(2026, 5, 8 + index)).toISOString();
    const orphan = index === 6;
    const restDay = index === 2;
    return {
        _id: orphan ? rowId : `6a7c515e6aeaefb3c8764b${String(index).padStart(2, '0')}`,
        team: 'THA', company_kod: '69e8e92fb198b803164b824a', ypokatasthma: '0000',
        kodikos: '0004', hmeromhnia: date, kathgoria_ergasias: restDay ? 'ΑΝ' : 'ΕΡΓ',
        kathgoria_ergasias_apologistika: orphan ? '' : restDay ? 'ΑΝ' : 'ΕΡΓ',
        apo_ora_01: orphan ? '14:51' : restDay ? '' : '12:00',
        eos_ora_01: orphan ? '22:51' : restDay ? '' : '20:00',
        apo_ora_02: '', eos_ora_02: '', apo_ora_03: '', eos_ora_03: '',
        cards_apo_ora_01: orphan ? '14:51' : restDay ? '' : '12:00',
        cards_eos_ora_01: orphan ? '' : restDay ? '' : '20:00',
        cards_apo_ora_02: '', cards_eos_ora_02: '', cards_apo_ora_03: '', cards_eos_ora_03: '',
        ores_ergasias: restDay ? 0 : 8, cards_ores_ergasias: restDay ? 0 : 8,
        apo_ora_01_apologistika: orphan || restDay ? '' : '12:00',
        eos_ora_01_apologistika: orphan || restDay ? '' : '20:00',
        ores_ergasias_apologistika: orphan || restDay ? 0 : 8,
        ores_pragmatikhs_ergasias_apologistika: orphan || restDay ? 0 : 8,
        repo: restDay, repo_apologistika: restDay, adeia: false, adeia_apologistika: false,
        astheneia: false, astheneia_apologistika: false, argia: false,
        is_locked: orphan, locked_by: orphan ? 'HR-1' : null,
        locked_at: orphan ? '2026-06-15T08:00:00.000Z' : null
    };
}

const rows = Array.from({ length: 7 }, (_, index) => frozenRow(index));
const baselineSnapshot = canonicalize({
    snapshot_schema_version: 'employment-period-frozen:v3',
    source_calculation_version: 'employment-calculation:v2',
    scope: { team: 'THA', company_kod: '69e8e92fb198b803164b824a', ypokatasthma: '0000',
        period_start: '2026-06-01', period_end: '2026-06-30' },
    employees: [profile], daily_results: rows, deviations: [],
    weekly_calculation_context: { rows, calendar_facts: [], profile_history: [] },
    policy_context: { rules: [] }, applied_repo_transfers: [], canonical_decisions: []
});
const baselineBefore = JSON.stringify(baselineSnapshot);
const resolution = { status: 'HR_APPROVED', policy_version: 'orphan-card-continuous:v1',
    approved_start: '14:51', approved_end: '23:21',
    approved_hours: 8, approved_by: 'HR-1', approved_at: '2026-08-14T20:00:45.630Z' };
const evidence = Object.freeze({ audit_id: '6a7f73f539204eb71c90bee9', row_id: rowId,
    employee_kodikos: '0004', date: '2026-06-14',
    evidence_type: 'PRODHLomena_ORARIA_HR_APPROVED_ORPHAN_AUDIT',
    orphan_card_resolution: resolution });
const commands = [{ type: 'RECOMPUTE_FROZEN_WEEK', employee_kodikos: '0004',
    week_start: '2026-06-08', evidence_audit_ids: [evidence.audit_id] }];
const runAuthoritativeWeek = erganhController.frozenCorrectivePreview.runAuthoritativeWeek;

const protectedPlan = runAuthoritativeWeek({ employeeKodikos: '0004', weekStart: '2026-06-08',
    frozenRows: baselineSnapshot.weekly_calculation_context.rows.map((row) => ({ ...row })),
    baselineSnapshot });
const protectedOrphan = protectedPlan.correctedRows.find((row) => String(row._id) === rowId);
assert.equal(protectedOrphan.ores_ergasias_apologistika, 0);
assert.equal(protectedOrphan.ores_pragmatikhs_ergasias_apologistika, 0);
assert.equal(protectedOrphan.is_locked, true);

const readyPreview = previewFrozenCorrectiveWeek({ baselineSnapshot, employee_kodikos: '0004',
    week_start: '2026-06-08', evidence_audit_ids: [evidence.audit_id],
    verifiedEvidence: [evidence], runAuthoritativeWeek });
assert.equal(readyPreview.status, 'READY');
const correctedOrphan = readyPreview.correctedRows.find((row) => String(row._id) === rowId);
assert.equal(correctedOrphan.apo_ora_01_apologistika, '14:51');
assert.equal(correctedOrphan.eos_ora_01_apologistika, '23:21');
assert.equal(correctedOrphan.ores_ergasias_apologistika, 8);
assert.equal(correctedOrphan.ores_pragmatikhs_ergasias_apologistika, 8);
assert.equal(correctedOrphan.compensation_breakdown_apologistika.status, 'READY',
    JSON.stringify(correctedOrphan.compensation_breakdown_apologistika));
assert.equal(correctedOrphan.compensation_breakdown_apologistika.hours.sixthDayHours, 8);
assert.equal(correctedOrphan.sixth_day_hours, 8);
assert.equal(correctedOrphan.seventh_day_hours, 0);
assert.equal(correctedOrphan.sixth_seventh_classification, 'SIXTH');
assert.equal(correctedOrphan.effective_sixth_day_rate, 0);
assert.equal(correctedOrphan.is_locked, true);
assert.equal(correctedOrphan.locked_by, 'HR-1');
assert.equal(correctedOrphan.locked_at, '2026-06-15T08:00:00.000Z');
assert.notDeepEqual(correctedOrphan.compensation_breakdown_apologistika,
    baselineSnapshot.daily_results[6].compensation_breakdown_apologistika);
assert.equal(JSON.stringify(baselineSnapshot), baselineBefore);

const needsCompensationRunner = (input) => {
    const planned = runAuthoritativeWeek(input);
    return { ...planned, correctedRows: planned.correctedRows.map((row) =>
        String(row._id) === rowId ? { ...row, compensation_breakdown_apologistika: {
            ...row.compensation_breakdown_apologistika, status: 'NEEDS_HR_DECISION',
            reasons: ['TARGETED_COMPENSATION_GUARD_TEST'] } } : row) };
};
const needsPreview = previewFrozenCorrectiveWeek({ baselineSnapshot,
    employee_kodikos: '0004', week_start: '2026-06-08',
    evidence_audit_ids: [evidence.audit_id], verifiedEvidence: [evidence],
    runAuthoritativeWeek: needsCompensationRunner });
assert.equal(needsPreview.status, 'NEEDS_HR_DECISION');
assert.ok(needsPreview.compensation_issues.some((issue) => issue.date === '2026-06-14' &&
    issue.status === 'NEEDS_HR_DECISION'));

console.log('locked frozen corrective HR-approved orphan authoritative calculation: PASS');
