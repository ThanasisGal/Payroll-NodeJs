'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildWeeklyHrLifecycleProjection } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildWeeklyHrStage2BulkPreview } = require('./apasxoliseisWeeklyHrStage2BulkPreviewService');
const { inspectAutomaticMaterialization } = require('./apasxoliseisWeeklyHrWorkflowStage2CompletionService');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const { deriveEmploymentOwnedDateScope, restrictWeeklyReviewRowsToEmploymentDates } = require('./apasxoliseisEmploymentPeriodScopeService');
const profile = { typos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5, typos_ebdomadas: '5ΗΜΕΡΗ',
    pososto_prosayxhshs_6hs_hmeras: 40, pragmatikoOromisthio: 10 };
function rows(start = '2031-03-03') {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start); date.setUTCDate(date.getUTCDate() + index);
        return { _id: `synthetic-${index}`, hmeromhnia: date, team: 'SYNTHETIC',
            company_kod: 'synthetic-company', ypokatasthma: '0137', kodikos: '0298',
            kathgoria_ergasias: 'ΕΡΓ', repo: false, ores_ergasias: 8,
            apo_ora_01: '08:00', eos_ora_01: '16:00',
            cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00', cards_ores_ergasias: 8,
            kathgoria_ergasias_apologistika: 'ΕΡΓ', ores_ergasias_apologistika: 8,
            repo_apologistika: false, apologistiko_biblio: false,
            adeia_apologistika: false, astheneia_apologistika: false, apousia_apologistika: false };
    });
}
function possible(row) { Object.assign(row, { cards_apo_ora_01: '', cards_eos_ora_01: '',
    cards_ores_ergasias: 0, ores_ergasias_apologistika: 0, kathgoria_ergasias_apologistika: '',
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' }); }
function rest(row) { possible(row); Object.assign(row, { kathgoria_ergasias: 'ΑΝ', repo: true,
    kathgoria_ergasias_apologistika: 'ΑΝ', kathgoria_adeias_apologistika: '',
    apo_ora_01: '', eos_ora_01: '', ores_ergasias: 0 }); }
function project(weekRows, options = {}) {
    return buildWeeklyHrLifecycleProjection({ weekRows, effectiveProfile: profile,
        persistedStage1State: { status: 'COMPLETED', version: 1,
            completion_fingerprint: buildStage1Fingerprint(weekRows).fingerprint }, ...options });
}
for (const start of ['2023-01-02', '2028-02-28', '2031-03-03']) for (const [required, count] of [[1, 2], [2, 2], [1, 1], [0, 2]]) {
    test(`general evidence rule ${start}: deficit ${required}, candidates ${count}`, () => {
        const weekRows = rows(start);
        for (let i = 0; i < 2 - required; i++) rest(weekRows[i]);
        for (const row of weekRows.slice(-count)) possible(row);
        const lifecycle = project(weekRows);
        const stage2 = lifecycle.stages.stage2;
        assert.equal(stage2.rest_evidence.missing_count, required);
        assert.equal(stage2.rest_evidence.candidate_dates.length, count);
        assert.equal(lifecycle.stages.stage3.pending_count, count);
        assert.deepEqual(lifecycle.stages.stage3.stage2_automatic_resolution_items, []);
        assert.equal(lifecycle.stages.stage4.final_weekly_analysis_available, false);
        const preview = buildWeeklyHrStage2BulkPreview({ contexts: [{ scope: {
            employee_id: 'synthetic-id', employee_kodikos: '0298', week_start: weekRows[0].hmeromhnia,
            week_end: weekRows[6].hmeromhnia }, rows: weekRows, lifecycle }] });
        assert.equal(preview.manual_exception_count, 1); assert.equal(preview.safe_day_change_count, 0);
        assert.equal(lifecycle.stages.stage3.pending_items.some(item =>
            item.allowed_classifications.includes('REST_REPO')), required > 0);
    });
}
test('leave, sickness, absence and approved actual work never become automatic rest', () => {
    for (const decision of [{ adeia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' },
        { astheneia_apologistika: true }, { apousia_apologistika: true },
        { kathgoria_ergasias_apologistika: 'ΕΡΓ', ores_pragmatikhs_ergasias_apologistika: 1,
            apo_ora_01_apologistika: '08:00', eos_ora_01_apologistika: '09:00',
            ores_ergasias_apologistika: 1 }]) {
        const weekRows = rows(); possible(weekRows[6]); Object.assign(weekRows[6], decision);
        const lifecycle = project(weekRows);
        assert.deepEqual(lifecycle.stages.stage3.stage2_automatic_resolution_items, []);
        assert.ok(!lifecycle.stages.stage2.rest_evidence?.candidate_dates.length);
    }
});
test('declared rest survives false participation; actual work cancels its recognition', () => {
    const weekRows = rows(); rest(weekRows[1]); possible(weekRows[6]);
    assert.equal(project(weekRows).stages.stage2.rest_evidence.recognized_count, 1);
    Object.assign(weekRows[1], { cards_apo_ora_01: '08:00', cards_eos_ora_01: '09:00', cards_ores_ergasias: 1 });
    const lifecycle = project(weekRows);
    assert.equal(lifecycle.rest_review_items.find(item => item.date === '2031-03-04').status, 'REVIEW_REQUIRED');
    assert.equal(lifecycle.stages.stage2.business_status, 'BLOCKED');
    assert.equal(lifecycle.stages.stage4.final_weekly_analysis_available, false);
});
test('obsolete or fabricated full-time automatic proposal is rejected at materialization boundary', () => {
    const weekRows = rows(); possible(weekRows[6]);
    const context = { rows: weekRows, effectiveProfile: profile,
        lifecycle: { stages: { stage3: { stage2_automatic_resolution_items: [
            { date: '2031-03-09', classification: 'REST_REPO' }] } } } };
    assert.equal(inspectAutomaticMaterialization(context).code, 'UNCONFIRMED_WEEKLY_REST_DATES');
});
test('historical change inside week cannot borrow the last profile for all dates', () => {
    const weekRows = rows(); possible(weekRows[6]);
    const effectiveProfilesByDate = Object.fromEntries(weekRows.map((row, i) =>
        [row.hmeromhnia.toISOString().slice(0,10), { ...profile, hmeres_ergasias_ebdomadas: i < 3 ? 6 : 5 }]));
    const lifecycle = project(weekRows, { effectiveProfilesByDate });
    assert.equal(lifecycle.stages.stage2.rest_evidence.missing_count, null);
    assert.deepEqual(lifecycle.stages.stage2.rest_evidence.confirmable_dates, []);
    assert.ok(!lifecycle.stages.stage3.pending_items[0].allowed_classifications.includes('REST_REPO'));
});
for (const employment of [{ hire_date: '2031-03-05', departure_date: '2031-03-07' },
    { employee: { hmeromhnia_proslhpshs: '2031-03-07', employment_history: [
        { hmeromhnia_proslhpshs: '2031-03-01', hmeromhnia_apoxorhshs: '2031-03-04' },
        { hmeromhnia_proslhpshs: '2031-03-07' }] } }]) {
    test('hire, inclusive departure and rehire gaps are excluded before the rest obligation', () => {
        const allRows = rows(); allRows.forEach(possible);
        const employmentDateScope = deriveEmploymentOwnedDateScope({ natural_week_start: '2031-03-03',
            natural_week_end: '2031-03-09', period_start: '2031-03-01', period_end: '2031-03-31', ...employment });
        const weekRows = restrictWeeklyReviewRowsToEmploymentDates(allRows, employmentDateScope);
        const lifecycle = project(weekRows, { employmentDateScope });
        assert.equal(lifecycle.stages.stage3.pending_count, weekRows.length);
        assert.deepEqual(lifecycle.stages.stage3.stage2_automatic_resolution_items, []);
        assert.ok(!lifecycle.stages.stage3.pending_dates.includes('2031-03-02'));
        if (employment.departure_date) {
            assert.ok(lifecycle.stages.stage3.pending_dates.includes(employment.departure_date));
            assert.ok(!lifecycle.stages.stage3.pending_dates.includes('2031-03-08'));
            assert.equal(lifecycle.stages.stage2.rest_evidence.required_count, 0);
        } else {
            assert.ok(!lifecycle.stages.stage3.pending_dates.includes('2031-03-05'));
            assert.ok(lifecycle.stages.stage3.pending_dates.includes('2031-03-04'));
        }
    });
}
