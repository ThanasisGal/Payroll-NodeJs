'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const sandbox = {
    console,
    document: {
        querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
        addEventListener: () => {}, createElement: () => ({ addEventListener: () => {},
            appendChild: () => {}, classList: { add: () => {}, toggle: () => {} },
            dataset: {}, setAttribute: () => {}, style: {} }),
        head: { appendChild: () => {} }, body: { appendChild: () => {} }
    },
    window: {}, URLSearchParams,
    fetch: async () => { throw new Error('Unexpected fetch'); },
    setTimeout: () => {}, clearTimeout: () => {}
};
vm.createContext(sandbox);
vm.runInContext(`${source}
this.resolvePresentation = resolveReviewApologistikoPresentation;
this.buildStage2Map = buildStage2DailyResolutionByKey;
this.buildEmploymentTypeMap = buildCanonicalDailyEmploymentTypeByKey;
this.visiblePayloads = visibleWeeklyHrPayloads;
this.stage2Key = stage2DailyResolutionKey;
this.renderDeviation = renderDeviationNoteCell;
this.isResolvedAmbiguity = isResolvedWeeklySelectionAmbiguity;
this.finalWeeklyNonWorkDays = resolveFinalWeeklyNonWorkDays;
this.weeklyEmploymentStatus = renderWeeklyEmploymentStatus;`, sandbox,
{ filename: sourcePath });

function possibleLeave(overrides = {}) {
    return { kodikos: '0014', kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', ...overrides };
}

const nonWork = { classification: 'NON_WORK' };
const restRepo = { classification: 'REST_REPO' };
assert.equal(sandbox.resolvePresentation(possibleLeave(), {
    stage2AutomaticResolution: nonWork }).text, 'ΜΗ ΕΡΓΑΣΙΑ');
assert.equal(sandbox.resolvePresentation(possibleLeave(), {
    stage2AutomaticResolution: restRepo }).text, 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ');

[
    [{ adeia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΑΛ',
        leave_provenance: 'HR_DECLARED_LEAVE' }, 'ΑΔΕΙΑ'],
    [{ astheneia_apologistika: true }, 'ΑΣΘΕΝΕΙΑ'],
    [{ apousia_apologistika: true }, 'ΑΠΟΥΣΙΑ']
].forEach(([positive, expected]) => {
    assert.equal(sandbox.resolvePresentation(possibleLeave(positive), {
        stage2AutomaticResolution: nonWork }).text, expected);
});

const june0014Items = [
    ['2026-06-03', 'NON_WORK'], ['2026-06-09', 'NON_WORK'],
    ['2026-06-10', 'NON_WORK'], ['2026-06-22', 'REST_REPO'],
    ['2026-06-29', 'REST_REPO']
].map(([date, classification]) => ({ date, classification }));
const stage2Map = sandbox.buildStage2Map([{ scope: { employee_kodikos: '0014' },
    lifecycle_projection: { stages: { stage3: {
        stage2_automatic_resolution_items: june0014Items
    } } } }]);
for (const item of june0014Items) {
    const resolution = stage2Map.get(sandbox.stage2Key('0014', item.date));
    const expected = item.classification === 'NON_WORK' ? 'ΜΗ ΕΡΓΑΣΙΑ' : 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ';
    assert.equal(sandbox.resolvePresentation(possibleLeave({ hmeromhnia: item.date }), {
        stage2AutomaticResolution: resolution }).text, expected);
}

const completed0001 = {
    scope: { employee_kodikos: '0001', ypokatasthma: '0000',
        week_start: '2026-06-01', week_end: '2026-06-07' },
    stage1_daily_presentation: [{ date: '2026-06-02', employment_type: '0' }],
    lifecycle_projection: {
        requires_hr_action: false,
        total_pending_count: 0,
        stages: Object.fromEntries(['stage1', 'stage2', 'stage3', 'stage4'].map((stage) =>
            [stage, { business_status: 'COMPLETED', pending_count: 0,
                pending_reasons: [], pending_dates: [],
                ...(stage === 'stage3' ? { stage2_automatic_resolution_items: [
                    { date: '2026-06-02', classification: 'REST_REPO' }
                ] } : {}) }]))
    }
};
const active0002 = {
    scope: { employee_kodikos: '0002', ypokatasthma: '0000',
        week_start: '2026-06-01', week_end: '2026-06-07' },
    lifecycle_projection: {
        requires_hr_action: true,
        total_pending_count: 1,
        stages: {
            stage1: { business_status: 'OPEN', pending_count: 1,
                pending_reasons: [], pending_dates: ['2026-06-02'] },
            stage2: { business_status: 'COMPLETED', pending_count: 0 },
            stage3: { business_status: 'COMPLETED', pending_count: 0 },
            stage4: { business_status: 'COMPLETED', pending_count: 0 }
        }
    }
};
const allPayloads = [completed0001, active0002];
const lifecycleVisible = sandbox.visiblePayloads(allPayloads, '');
assert.deepStrictEqual(Array.from(lifecycleVisible, (item) => item.scope.employee_kodikos),
    ['0002']);

const allEmployeesMap = sandbox.buildStage2Map(allPayloads);
const selectedEmployeeMap = sandbox.buildStage2Map(
    sandbox.visiblePayloads(allPayloads, '0001'));
const resolutionKey0001 = sandbox.stage2Key('0001', '2026-06-02');
assert.equal(allEmployeesMap.get(resolutionKey0001).classification, 'REST_REPO');
assert.equal(selectedEmployeeMap.get(resolutionKey0001).classification, 'REST_REPO');
assert.equal(sandbox.buildEmploymentTypeMap(allPayloads).get(resolutionKey0001), '0');

const row0001 = possibleLeave({ kodikos: '0001', hmeromhnia: '2026-06-02' });
const selectedPresentation = sandbox.resolvePresentation(row0001, {
    stage2AutomaticResolution: selectedEmployeeMap.get(resolutionKey0001)
});
const allEmployeesPresentation = sandbox.resolvePresentation(row0001, {
    stage2AutomaticResolution: allEmployeesMap.get(resolutionKey0001)
});
for (const presentation of [selectedPresentation, allEmployeesPresentation]) {
    assert.equal(presentation.text, 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ');
    assert.equal(presentation.className, 'cell-repo-day');
    assert.equal(presentation.source, 'derived_stage2');
}

const deviation = { kodikos: '0014', week_apo: '2026-06-29', week_eos: '2026-07-05',
    repo_transfer_reasons: ['MULTIPLE_SOURCE_CANDIDATES'],
    note: 'Βρέθηκαν περισσότερες από μία ημέρες και απαιτείται επιλογή.' };
const payload = (requiresHrAction) => ({ scope: { employee_kodikos: '0014',
    week_start: '2026-06-29', week_end: '2026-07-05' },
    lifecycle_projection: { requires_hr_action: requiresHrAction } });
assert.equal(sandbox.isResolvedAmbiguity(deviation, [payload(false)]), true);
assert.equal(sandbox.isResolvedAmbiguity(deviation, [payload(true)]), false);

const weeklyMap = vm.runInContext('weeklyHrStage1Payloads', sandbox);
weeklyMap.set('resolved', payload(false));
assert.doesNotMatch(sandbox.renderDeviation(deviation), /απαιτείται επιλογή/i);
weeklyMap.clear();
weeklyMap.set('unresolved', payload(true));
assert.doesNotMatch(sandbox.renderDeviation(deviation), /απαιτείται επιλογή/i);

assert.equal(sandbox.weeklyEmploymentStatus({ effective_typos_apasxolhshs: '1' }), 'Μερική');
assert.equal(sandbox.weeklyEmploymentStatus({ effective_typos_apasxolhshs: '2' }),
    'Εκ περιτροπής / Μερική');
assert.equal(sandbox.weeklyEmploymentStatus({ effective_typos_apasxolhshs: '0' }), 'Πλήρης');
assert.equal(sandbox.finalWeeklyNonWorkDays({ actual_workdays: 2 }), 5);
assert.equal(sandbox.finalWeeklyNonWorkDays({ actual_workdays: 5 }), 2);
assert.equal(sandbox.finalWeeklyNonWorkDays({ kodikos: '0014', week_apo: '2026-06-01',
    week_eos: '2026-06-07', resolved_repo: 4, resolved_repo_identities: [] }, [{
    scope: { employee_kodikos: '0014', week_start: '2026-06-01', week_end: '2026-06-07' },
    lifecycle_projection: { stages: { stage3: { stage2_automatic_resolution_items: [
        { date: '2026-06-03', classification: 'NON_WORK' }
    ] } } }
}]), 5);

function weeklyDeviation(overrides = {}) {
    return {
        kodikos: '0099', ypokatasthma: '0000',
        week_apo: '2026-06-08', week_eos: '2026-06-14',
        status: 'READY', sixth_seventh_day_status: 'READY',
        effective_weekly_workdays: 5, actual_workdays: 5,
        sixth_day_count: 0, seventh_day_count: 0,
        ...overrides
    };
}

const normalWeekComment = sandbox.renderDeviation(weeklyDeviation({
    note: 'Η προτεινόμενη ημέρα ρεπό έχει ήδη χειροκίνητη αλλαγή.',
    presentation_reasons: ['TARGET_ALREADY_PROCESSED']
}));
assert.match(normalWeekComment,
    /Η εβδομάδα ολοκληρώθηκε με 5 ημέρες εργασίας και 2 ημέρες ανάπαυσης \/ μη εργασίας/);
assert.match(normalWeekComment, /Δεν προκύπτει 6η ή 7η ημέρα εργασίας/);
assert.doesNotMatch(normalWeekComment, /χειροκίνητη αλλαγή|ουσιαστικά απολογιστικά στοιχεία/);

const sixthDayComment = sandbox.renderDeviation(weeklyDeviation({
    actual_workdays: 6, sixth_day_count: 1, sixth_day_date: '2026-06-14',
    sixth_day_premium_rate: 40
}));
assert.match(sixthDayComment, /6η ημέρα εργασίας:<\/strong> Κυ 14\/06\/2026/);
assert.match(sixthDayComment, /Προσαύξηση 6ης ημέρας: 40%/);

const specialCategoryComment = sandbox.renderDeviation(weeklyDeviation({
    actual_workdays: 6, sixth_day_count: 1, sixth_day_date: '2026-06-14',
    sixth_day_premium_rate: 0
}));
assert.match(specialCategoryComment, /Προσαύξηση 6ης ημέρας: 0% λόγω ειδικής κατηγορίας/);

const longSixthDayComment = sandbox.renderDeviation(weeklyDeviation({
    actual_workdays: 6, sixth_day_count: 1, sixth_day_date: '2026-06-14',
    sixth_day_premium_rate: 40,
    sixth_seventh_day_warnings: ['SIXTH_DAY_DAILY_HOURS_EXCEED_EIGHT']
}));
assert.match(longSixthDayComment, /Η εργασία της 6ης ημέρας υπερβαίνει τις 8 ώρες/);

const seventhDayComment = sandbox.renderDeviation(weeklyDeviation({
    actual_workdays: 7, seventh_day_count: 1, seventh_day_date: '2026-06-17',
    seventh_day_illegal_overtime_hours: 6.48
}));
assert.match(seventhDayComment, /7η ημέρα εργασίας:<\/strong> Τε 17\/06\/2026/);
assert.match(seventhDayComment, /Εργασία σε ημέρα ανάπαυσης — σοβαρή παράβαση/);
assert.match(seventhDayComment, /Παράνομη υπερωρία: 6,48 ώρες/);

const sixthAndSeventhComment = sandbox.renderDeviation(weeklyDeviation({
    actual_workdays: 7,
    sixth_day_count: 1, sixth_day_date: '2026-06-21', sixth_day_premium_rate: 40,
    seventh_day_count: 1, seventh_day_date: '2026-06-17',
    seventh_day_illegal_overtime_hours: 6.48
}));
assert.match(sixthAndSeventhComment, /6η ημέρα εργασίας/);
assert.match(sixthAndSeventhComment, /7η ημέρα εργασίας/);
assert.doesNotMatch(sixthAndSeventhComment,
    /TARGET_|SOURCE_|χειροκίνητη αλλαγή|ουσιαστικά απολογιστικά στοιχεία/);

const notApplicableComment = sandbox.renderDeviation(weeklyDeviation({
    status: 'NOT_APPLICABLE', sixth_seventh_day_status: 'NOT_APPLICABLE',
    effective_weekly_workdays: 4
}));
assert.match(notApplicableComment, /Δεν εφαρμόζεται έλεγχος 6ης\/7ης ημέρας/);
assert.doesNotMatch(notApplicableComment, /παράβαση|προειδοποίηση/i);

const needsDecisionComment = sandbox.renderDeviation(weeklyDeviation({
    status: 'NEEDS_HR_DECISION', sixth_seventh_day_status: 'NEEDS_HR_DECISION',
    sixth_seventh_day_reasons: [
        'CARD_VERIFICATION_PENDING',
        'MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE',
        'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'
    ]
}));
assert.match(needsDecisionComment, /Δεν υπάρχουν ακόμη επαρκή στοιχεία κάρτας/);
assert.match(needsDecisionComment, /Δεν έχει οριστεί έγκυρο ποσοστό προσαύξησης/);
assert.match(needsDecisionComment, /Δεν μπορεί να προσδιοριστεί με ασφάλεια/);
assert.doesNotMatch(needsDecisionComment,
    /CARD_VERIFICATION_PENDING|MISSING_OR_INVALID|CANONICAL_REPO_IDENTITIES/);

const weeklyRenderer = source.slice(source.indexOf('function appendEmployeeDeviationRows('),
    source.indexOf('const canonicalApplicabilityLabels'));
assert.match(weeklyRenderer, /Εβδομαδιαίος έλεγχος εργασίας και ανάπαυσης/);
assert.match(weeklyRenderer, /Συμβατικές ημέρες εργασίας/);
assert.match(weeklyRenderer, /Αναμενόμενες ημέρες ανάπαυσης \/ μη εργασίας/);
assert.match(weeklyRenderer, /Τελικές ημέρες ανάπαυσης \/ μη εργασίας/);
assert.doesNotMatch(weeklyRenderer, /Αναμενόμενα ρεπό|Πραγματικά ρεπό|Προτεινόμενα\/επιλυμένα ρεπό/);

console.log('final derived daily and weekly presentation: PASS');
