'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const view = fs.readFileSync(path.join(__dirname,
    '../../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../../public/css/main.css'), 'utf8');

assert.match(view, /id="weeklyHrStage1Container"/);
assert.match(source, /weekly-hr-stage1-table/);
assert.match(source, /<tr class="weekly-hr-stage1-card"/);
assert.match(source, /Πιθανές άδειες/);
assert.match(source, /weekly-hr-stage1-day-classification/);
assert.match(source, /UNCLASSIFIED.*LEAVE.*SICKNESS.*ABSENCE/s);
assert.doesNotMatch(source.match(/function renderStage1DayEditor[\s\S]*?\n}/)?.[0] || '',
    /<option value="REPO"/);
assert.match(source, /weekly-hr-select-all-days/);
assert.match(source, /weekly-hr-clear-all-days/);
assert.match(source, /Επιλεγμένες → Άδεια/);
assert.match(source, /Επιλεγμένες → Ασθένεια/);
assert.match(source, /Επιλεγμένες → Απουσία/);
assert.doesNotMatch(source, /Επιλεγμένες → ΡΕΠΟ/);
assert.match(source, /Καθαρισμός χαρακτηρισμού/);
assert.match(source, /Αποθήκευση Χαρακτηρισμών/);
assert.match(source, /\/api\/dropdown\/ergazomenoi\/kathgoria_adeias/);
assert.match(source, /Κάθε επιλεγμένη Άδεια πρέπει να έχει πραγματική κατηγορία άδειας/);
assert.match(source, /bulk-classify-days/);
assert.match(source, /function updateAuthoritativeReviewDailyRow/);
assert.match(source, /if \(item\.record\) updateAuthoritativeReviewDailyRow\(item\.record\)/);
assert.match(source, /data-review-cell="apologistiko"/);
assert.match(source, /await Promise\.all\(\[\.\.\.affectedKeys\]/);
assert.match(source, /showDetailsModal\(row\)/);
assert.match(source, /weekly-hr-bulk-complete/);
const dailySaveFunction = source.match(/async function saveStage1DailyClassificationDrafts\([\s\S]*?\n}/)?.[0] || '';
assert.doesNotMatch(dailySaveFunction, /loadResults\(|location\.reload/);

const scopeHelpers = source.slice(source.indexOf('function stage1DateKey'),
    source.indexOf('async function fetchWeeklyHrStage1'));
const scopeSandbox = {};
vm.runInNewContext(`${scopeHelpers}\nthis.helpers = { buildWeeklyHrStage1Scopes, formatStage1DateKey };`, scopeSandbox);
const juneRows = Array.from({ length: 30 }, (_, index) => ({
    _id: `row-${index + 1}`, employee_id: 'employee-x', kodikos: '0004',
    ypokatasthma: '0000', hmeromhnia: `2026-06-${String(index + 1).padStart(2, '0')}`,
    kathgoria_adeias_apologistika: [2, 11, 26].includes(index + 1) ? 'POSSIBLE_LEAVE' : ''
}));
function weekKeys(start, end) {
    return [...scopeSandbox.helpers.buildWeeklyHrStage1Scopes(juneRows, start, end).values()]
        .map((scope) => `${scope.week_start}/${scope.week_end}`).sort();
}
const fourWeeks = ['2026-06-01/2026-06-07', '2026-06-08/2026-06-14',
    '2026-06-15/2026-06-21', '2026-06-22/2026-06-28'];
assert.deepEqual(weekKeys('2026-06-01', '2026-06-30'), fourWeeks);
assert.ok(!weekKeys('2026-06-01', '2026-06-30').some((key) => key.startsWith('2026-06-29')));
assert.equal(scopeSandbox.helpers.formatStage1DateKey('2026-06-02'), '02/06/2026');

const editorStart = source.indexOf('function stage1ClassificationForRow');
const editorEnd = source.indexOf('async function loadWeeklyHrLeaveCategories');
const sandbox = { weeklyHrLeaveCategories: [{ value: 'ΑΔΚΑΝ', label: 'Κανονική άδεια' }],
    weeklyHrStage1DayDrafts: new Map(), weeklyHrStage1DaySelected: new Set(),
    escapeHtml: String, formatStage1DateKey: scopeSandbox.helpers.formatStage1DateKey,
    stage1DateKey: (value) => String(value).slice(0, 10) };
vm.runInNewContext(`${source.slice(editorStart, editorEnd)}\nthis.helpers = { stage1ClassificationForRow, renderStage1DayEditor };`, sandbox);
const payload = { workflow: { unclassified_stage2_candidates: [
    { date: '2026-06-02', label: 'Προς εξέταση ως ΑΝΑΠΑΥΣΗ / ΡΕΠΟ' }
] }, rows: [
    { _id: 'u', hmeromhnia: '2026-06-02', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' },
    { _id: 'l', hmeromhnia: '2026-06-04', adeia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' },
    { _id: 's', hmeromhnia: '2026-06-05', astheneia_apologistika: true },
    { _id: 'a', hmeromhnia: '2026-06-06', apousia_apologistika: true }
] };
assert.equal(sandbox.helpers.stage1ClassificationForRow(payload.rows[0]), 'UNCLASSIFIED');
assert.equal(sandbox.helpers.stage1ClassificationForRow(payload.rows[1]), 'LEAVE');
assert.equal(sandbox.helpers.stage1ClassificationForRow(payload.rows[2]), 'SICKNESS');
assert.equal(sandbox.helpers.stage1ClassificationForRow(payload.rows[3]), 'ABSENCE');
const editors = payload.rows.map((row) => sandbox.helpers.renderStage1DayEditor(payload,
    String(row.hmeromhnia).slice(0, 10))).join('');
assert.equal((editors.match(/weekly-hr-stage1-day d-inline-flex/g) || []).length, 4);
assert.match(editors, />—<\/option>/);
assert.match(editors, />Άδεια<\/option>/);
assert.match(editors, /value="ΑΔΚΑΝ" selected>Κανονική άδεια/);
assert.match(editors, />Ασθένεια<\/option>/);
assert.match(editors, />Απουσία<\/option>/);
assert.doesNotMatch(editors, />ΡΕΠΟ<\/option>/);
assert.match(editors, /Προς εξέταση ως ΑΝΑΠΑΥΣΗ \/ ΡΕΠΟ/);
const nonWorkEditor = sandbox.helpers.renderStage1DayEditor({ ...payload,
    workflow: { unclassified_stage2_candidates: [{ date: '2026-06-02',
        label: 'Προς εξέταση ως ΜΗ ΕΡΓΑΣΙΑ' }] } }, '2026-06-02');
assert.match(nonWorkEditor, /Προς εξέταση ως ΜΗ ΕΡΓΑΣΙΑ/);
assert.doesNotMatch(source, /Οι αχαρακτήριστες ημέρες θα εξεταστούν στο επόμενο στάδιο ως πιθανό ΡΕΠΟ/);
const sicknessEditor = sandbox.helpers.renderStage1DayEditor(payload, '2026-06-05');
assert.match(sicknessEditor, /weekly-hr-stage1-leave-category/);
assert.match(sicknessEditor, /disabled aria-disabled="true"/);
assert.match(sicknessEditor, /value="ΑΔΑΣ" selected/);
assert.match(source, /function formatStage1LeaveCategoryLabel/);
const labelHelper = vm.runInNewContext(`(() => { ${source.match(/function formatStage1LeaveCategoryLabel[\s\S]*?\n}/)?.[0]} return formatStage1LeaveCategoryLabel; })()`);
assert.equal(labelHelper('ΑΔΑΠΕΜ..... - Περιγραφή'), 'ΑΔΑΠΕΜ. - Περιγραφή');
assert.equal(labelHelper('ΑΔΚΑΝ - Κανονική άδεια'), 'ΑΔΚΑΝ - Κανονική άδεια');
assert.match(editors, /value="ΑΔΚΑΝ" selected>Κνονική άδεια|value="ΑΔΚΑΝ" selected>Κανονική άδεια/);
assert.match(css, /weekly-hr-stage1-leave-category[\s\S]*width:\s*30rem/);
console.log('weekly HR Stage 1 compact/bulk classification UI tests passed');
