'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildWeeklyHrLifecycleProjection } = require('../../services/ergazomenoi/apasxoliseisWeeklyHrLifecycleProjectionService');
const { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints } = require(
    '../../services/ergazomenoi/apasxoliseisStage1PeriodSliceService');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const search = source.slice(source.indexOf('static getProdhlomenaOrariaForReview ='),
    source.indexOf('static getEmploymentReviewPeriodControl ='));
const mainRead = search.slice(search.indexOf('ProdhlomenaOrariaModel.find(filter)'),
    search.indexOf('ProdhlomenaOrariaModel.countDocuments(filter)'));
const weekRead = search.slice(search.indexOf('ProdhlomenaOrariaModel.find(deviationContextFilter)'),
    search.indexOf('const kodikoiRows ='));
for (const read of [mainRead, weekRead]) {
    // Both the visible rows and the natural-week enrichment must carry every
    // stored field used by the Stage-1 fingerprint on a resolved absence day.
    for (const field of ['kathestos_apasxolhshs_hmeras',
        'hmeres_apoysias_apologistika', 'ores_adeias_pistomenes_apologistika']) {
        assert.ok(read.includes(field), `${field} missing from Search row selection`);
    }
}
assert.match(source, /stage3AuditDecisionDates: stage3AuditDatesByEmployeeWeek\.get\(/);
assert.match(source, /stage3AuditDecisionDates: stage3Audits\.map\(/);
assert.match(source, /stage3AuditDecisionDatesByEmployeeWeek\(rows\.__workflowAudits \|\| \[\]\)/);
assert.match(source, /String\(audit\.employee_id \|\| ''\).*dateKeyUtc\(audit\.week_start\)/);

const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: 'employee-0007', employee_kodikos: '0007',
    week_start: '2026-04-27', week_end: '2026-05-03' };
const profile = { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: '1',
    pososto_prosayxhshs_6hs_hmeras: 40, pragmatikoOromisthio: 10 };
const rows = Array.from({ length: 7 }, (_, index) => {
    const date = new Date('2026-04-27T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + index);
    return { _id: `row-${index}`, team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.ypokatasthma, kodikos: scope.employee_kodikos,
        hmeromhnia: date, kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
        apo_ora_01: '09:00', eos_ora_01: '17:00', cards_ores_ergasias: 0,
        cards_apo_ora_01: '', cards_eos_ora_01: '',
        kathgoria_ergasias_apologistika: '', adeia_apologistika: false,
        astheneia_apologistika: false, apousia_apologistika: false,
        hmeres_apoysias_apologistika: 0, ores_apoysias_apologistika: 0,
        ores_adeias_pistomenes_apologistika: 0, is_locked: false };
});
for (const row of rows.slice(5)) Object.assign(row, {
    apousia_apologistika: true, hmeres_apoysias_apologistika: 1,
    ores_apoysias_apologistika: 8, is_locked: true
});
const mayPeriod = { period_start: '2026-05-01', period_end: '2026-05-31' };
const aprilPeriod = { period_start: '2026-04-01', period_end: '2026-04-30' };
const slice = deriveStage1PeriodSlice({ weekRows: rows, week_start: scope.week_start,
    week_end: scope.week_end, ...mayPeriod });
const fp = buildStage1PeriodSliceFingerprints({ weekRows: rows, slice });
const stage1 = { status: 'OPEN', version: 4, period_slices: [{
    ...mayPeriod, status: 'COMPLETED', version: 4,
    context_fingerprint: fp.context_fingerprint,
    effective_fingerprint: fp.completion_fingerprint,
    completion_fingerprint: 'a'.repeat(64) }] };
const stage3 = { status: 'COMPLETED', version: 2,
    completion_fingerprint: 'b'.repeat(64) };
function project(weekRows, periodScope, extra = {}) {
    return buildWeeklyHrLifecycleProjection({ weekRows, effectiveProfile: profile,
        scope, periodScope, persistedStage1State: stage1,
        persistedStage3State: stage3, ...extra });
}
const correctMay = project(rows, mayPeriod);
assert.equal(correctMay.stages.stage1.business_status, 'COMPLETED');
assert.equal(correctMay.stages.stage1.current_context_fingerprint,
    stage1.period_slices[0].context_fingerprint);
assert.equal(correctMay.stages.stage1.current_completion_fingerprint,
    stage1.period_slices[0].effective_fingerprint);
const oldSearchShape = rows.map((row) => ({ ...row }));
for (const row of oldSearchShape.slice(5)) delete row.hmeres_apoysias_apologistika;
const falseMayStale = project(oldSearchShape, mayPeriod);
assert.equal(falseMayStale.stages.stage1.business_status, 'STALE');
assert.notEqual(falseMayStale.stages.stage1.current_completion_fingerprint,
    stage1.period_slices[0].effective_fingerprint);

const aprilWithNextPeriodAudits = project(rows, aprilPeriod, {
    stage3AuditDecisionDates: ['2026-05-02', '2026-05-03'] });
assert.equal(aprilWithNextPeriodAudits.stages.stage1.business_status,
    'DEFERRED_TO_NEXT_PERIOD');
assert.equal(aprilWithNextPeriodAudits.stages.stage1.pending_count, 0);
assert.deepEqual(aprilWithNextPeriodAudits.stages.stage1.blockers, []);
for (const evidence of [undefined, [], ['2026-04-29'],
    ['2026-05-02', null], ['2026-05-02']]) {
    const blocked = project(rows, aprilPeriod, {
        stage3AuditDecisionDates: evidence });
    assert.equal(blocked.stages.stage1.business_status, 'BLOCKED');
    assert.equal(blocked.stages.stage1.pending_count, 1);
    assert.ok(blocked.stages.stage1.blockers.includes(
        'EXISTING_WEEKLY_DECISION_REQUIRES_FULL_WEEK_VALIDATION'));
}
const stage2Decision = project(rows, aprilPeriod, {
    stage3AuditDecisionDates: ['2026-05-02', '2026-05-03'],
    persistedStage2DecisionState: { status: 'APPROVED' } });
assert.equal(stage2Decision.stages.stage1.business_status, 'BLOCKED');

const externalAprilChange = rows.map((row) => ({ ...row }));
externalAprilChange[3].apo_ora_01 = '10:00';
assert.equal(project(externalAprilChange, mayPeriod).stages.stage1.business_status,
    'STALE');
console.log('cross-period Search lifecycle regression tests passed');
