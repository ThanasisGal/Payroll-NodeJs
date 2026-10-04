'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('function minuteToReviewTime');
const end = source.indexOf('function showDetailsModal', start);
const values = {
    edit_apo_ora_01_apologistika: '10:00', edit_eos_ora_01_apologistika: '10:30',
    edit_apo_ora_02_apologistika: '13:00', edit_eos_ora_02_apologistika: '14:04',
    edit_apo_ora_03_apologistika: '', edit_eos_ora_03_apologistika: '',
    edit_kathgoria_adeias_apologistika_hidden: 'ΑΔΑΣ'
};
const leaveStarts = [{ value: '10:30' }, { value: '' }, { value: '' }];
const leaveEnds = [{ value: '13:00' }, { value: '' }, { value: '' }];
const sandbox = { escapeHtml: String, document: {
    getElementById: (id) => ({ value: values[id] || '',
        checked: id === 'dailyEmergencyLeaveEnabled' }),
    querySelectorAll: (selector) => selector === '.daily-leave-start' ? leaveStarts : leaveEnds
} };
vm.createContext(sandbox);
vm.runInContext(`${source.slice(start, end)};this.api={renderDailyActualWorkResolutionSection,
buildFrozenDailyActualWorkCommand,dailyResolutionSummary,renderDailyResolutionSummary,
buildDailyResolutionConfirmationHtml,confirmFrozenDailyResolution,
canStartManualDailyActualWorkResolution,renderManualDailyActualWorkResolutionAction,
reviewTimeToMinute,minuteToReviewTime};`, sandbox);
const row = { ores_ergasias: 4, cards_apo_ora_01: '10:00', cards_eos_ora_01: '10:30',
    suspicious_short_card_interval: { suspicious: true } };
const html = sandbox.api.renderDailyActualWorkResolutionSection(row, true);
const validActionVariants = [
    'employment-review-action-primary', 'employment-review-action-secondary',
    'employment-review-action-success', 'employment-review-action-warning',
    'employment-review-action-danger'
];
function assertActionButton(renderedHtml, id, variant) {
    const tag = renderedHtml.match(new RegExp(`<button\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
    assert.ok(tag, `missing action button ${id}`);
    const classes = tag.match(/\bclass="([^"]*)"/)?.[1]?.split(/\s+/) || [];
    assert.ok(classes.includes('employment-review-action-btn'), `${id} is not namespaced`);
    assert.ok(classes.includes(variant), `${id} is missing ${variant}`);
    assert.equal(classes.some((className) => className.startsWith('btn-outline-')), false,
        `${id} must not use an outline button`);
}
function assertNoPlainDailyResolutionButtons(renderedHtml) {
    const buttonTags = renderedHtml.match(/<button\b[^>]*>/g) || [];
    assert.ok(buttonTags.length > 0);
    buttonTags.forEach((tag) => {
        const classes = tag.match(/\bclass="([^"]*)"/)?.[1]?.split(/\s+/) || [];
        assert.ok(classes.includes('employment-review-action-btn'), tag);
        assert.ok(validActionVariants.some((variant) => classes.includes(variant)), tag);
        assert.equal(classes.some((className) => className.startsWith('btn-outline-')), false, tag);
        assert.notDeepEqual(classes, ['btn', 'btn-sm']);
    });
}
assert.match(html, /ΥΠΟΠΤΑ ΜΙΚΡΟ ΔΙΑΣΤΗΜΑ ΚΑΡΤΑΣ/);
assert.match(html, /Η κάρτα είναι σωστή/);
assert.match(html, /Έκτακτη ωροάδεια/);
assert.match(html, /Προσθήκη διαστήματος εργασίας/);
assert.match(html, /Αφαίρεση τελευταίου διαστήματος ωροάδειας/);
assertActionButton(html, 'dailyAddWorkInterval', 'employment-review-action-primary');
assertActionButton(html, 'dailyRemoveWorkInterval', 'employment-review-action-secondary');
assertActionButton(html, 'dailyAddLeaveInterval', 'employment-review-action-primary');
assertActionButton(html, 'dailyRemoveLeaveInterval', 'employment-review-action-secondary');
assertActionButton(html, 'dailyUseRawCards', 'employment-review-action-success');
assertNoPlainDailyResolutionButtons(html);
assert.doesNotMatch(html, /24:00/);
assert.equal(sandbox.api.reviewTimeToMinute('24:00'), null);
assert.equal(sandbox.api.minuteToReviewTime(1440), '');
const command = sandbox.api.buildFrozenDailyActualWorkCommand(row, false);
assert.deepEqual(JSON.parse(JSON.stringify(command.work_intervals)), [
    { pairNumber: 1, start: '10:00', end: '10:30' },
    { pairNumber: 2, start: '13:00', end: '14:04' }
]);
assert.deepEqual(JSON.parse(JSON.stringify(command.emergency_hourly_leave_intervals)), [
    { apo_lepto: 630, eos_lepto: 780 }
]);
assert.equal(Object.isFrozen(command), true);
assert.equal(Object.isFrozen(command.work_intervals), true);
assert.equal(Object.isFrozen(command.work_intervals[0]), true);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.api.dailyResolutionSummary(command, row))),
    { work: 94, leave: 150, covered: 244, absence: 0, declared: 240 });
const serverPreview = { normalizedWorkIntervals: command.work_intervals,
    emergencyLeaveIntervals: command.emergency_hourly_leave_intervals,
    netWorkMinutes: 94, emergencyLeaveMinutes: 150,
    contractualCoveredMinutes: 240, absenceMinutes: 0,
    breakResolution: { removedMinutes: 0 } };
const confirmation = sandbox.api.buildDailyResolutionConfirmationHtml(command, serverPreview);
assert.match(confirmation, /10:00–10:30, 13:00–14:04/);
assert.match(confirmation, /10:30–13:00/);
assert.match(confirmation, /καθαρή πραγματική εργασία 94 λεπτά/);
assert.match(confirmation, /συμβατικά καλυμμένα 240 λεπτά/);
const manualRow = { apo_ora_01: '10:00', eos_ora_01: '14:00',
    cards_apo_ora_01: '10:00', cards_eos_ora_01: '12:00',
    kathgoria_ergasias: 'ΕΡΓ', is_locked: false,
    suspicious_short_card_interval: { suspicious: false } };
assert.equal(sandbox.api.buildFrozenDailyActualWorkCommand(manualRow, false).source_case,
    'HR_CORRECTED_ACTUAL_DAY');
assert.equal(sandbox.api.canStartManualDailyActualWorkResolution(manualRow), true);
const manualAction = sandbox.api.renderManualDailyActualWorkResolutionAction(manualRow);
assert.match(manualAction, /Εργασία \/ έκτακτη ωροάδεια/);
assertActionButton(manualAction, 'startManualDailyResolutionBtn',
    'employment-review-action-primary');
for (const incompatible of [
    { is_locked: true }, { adeia_apologistika: true }, { astheneia_apologistika: true },
    { egkekrimenh_oroadeia_apologistika: true },
    { cards_eos_ora_01: '10:00' },
    { orphan_card_resolution_preview: { orphanVisible: true } },
    { hr_daily_actual_work_resolution: { status: 'HR_APPROVED' } }
]) assert.equal(sandbox.api.canStartManualDailyActualWorkResolution({
    ...manualRow, ...incompatible }), false);
sandbox.currentEmploymentPeriodControl = { allowed_actions: { manual_edit: false } };
assert.equal(sandbox.api.canStartManualDailyActualWorkResolution(manualRow), false);
sandbox.currentEmploymentPeriodControl.allowed_actions.manual_edit = true;
const generic = sandbox.api.renderDailyActualWorkResolutionSection(manualRow, true);
assert.match(generic, /Επίλυση πραγματικής ημέρας/);
assert.doesNotMatch(generic, /ΥΠΟΠΤΑ ΜΙΚΡΟ ΔΙΑΣΤΗΜΑ ΚΑΡΤΑΣ/);
assert.doesNotMatch(generic, /Η κάρτα είναι σωστή/);
assert.match(generic, /Χρήση αρχικών χτυπημάτων κάρτας/);
assertActionButton(generic, 'dailyUseRawCards', 'employment-review-action-secondary');
assertNoPlainDailyResolutionButtons(generic);
assert.match(source, /Επίλυση πραγματικής ημέρας με εργασία και έκτακτη ωροάδεια/);
const approved = sandbox.api.renderDailyActualWorkResolutionSection({ ...row,
    hr_daily_actual_work_resolution: { status: 'HR_APPROVED' } }, false);
assert.match(approved, /Διόρθωση εγκεκριμένης ημερήσιας επίλυσης/);
assertActionButton(approved, 'dailyResolutionRevisionBtn', 'employment-review-action-warning');
assertNoPlainDailyResolutionButtons(approved);
assert.match(source, /requestFrozenDailyResolutionPreview\([\s\S]*confirmFrozenDailyResolution\(dailyActualWorkCommand, serverPreview\)[\s\S]*preview_fingerprint: serverPreview\.previewFingerprint[\s\S]*daily_actual_work_resolution: dailyActualWorkCommand/);
console.log('employment review daily actual-work resolution UI tests passed');
