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
assert.match(sandbox.renderDeviation(deviation), /απαιτείται επιλογή/i);

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

const weeklyRenderer = source.slice(source.indexOf('function appendEmployeeDeviationRows('),
    source.indexOf('const canonicalApplicabilityLabels'));
assert.match(weeklyRenderer, /Εβδομαδιαίος έλεγχος εργασίας και ανάπαυσης/);
assert.match(weeklyRenderer, /Συμβατικές ημέρες εργασίας/);
assert.match(weeklyRenderer, /Αναμενόμενες ημέρες ανάπαυσης \/ μη εργασίας/);
assert.match(weeklyRenderer, /Τελικές ημέρες ανάπαυσης \/ μη εργασίας/);
assert.doesNotMatch(weeklyRenderer, /Αναμενόμενα ρεπό|Πραγματικά ρεπό|Προτεινόμενα\/επιλυμένα ρεπό/);

console.log('final derived daily and weekly presentation: PASS');
