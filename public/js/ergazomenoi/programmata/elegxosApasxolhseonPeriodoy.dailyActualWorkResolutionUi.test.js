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
assert.match(html, /ΥΠΟΠΤΑ ΜΙΚΡΟ ΔΙΑΣΤΗΜΑ ΚΑΡΤΑΣ/);
assert.match(html, /Η κάρτα είναι σωστή/);
assert.match(html, /Έκτακτη ωροάδεια/);
assert.match(html, /Προσθήκη διαστήματος εργασίας/);
assert.match(html, /Αφαίρεση τελευταίου διαστήματος ωροάδειας/);
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
assert.match(sandbox.api.renderManualDailyActualWorkResolutionAction(manualRow),
    /Εργασία \/ έκτακτη ωροάδεια/);
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
assert.match(source, /Επίλυση πραγματικής ημέρας με εργασία και έκτακτη ωροάδεια/);
const approved = sandbox.api.renderDailyActualWorkResolutionSection({ ...row,
    hr_daily_actual_work_resolution: { status: 'HR_APPROVED' } }, false);
assert.match(approved, /Διόρθωση εγκεκριμένης ημερήσιας επίλυσης/);
assert.match(source, /requestFrozenDailyResolutionPreview\([\s\S]*confirmFrozenDailyResolution\(dailyActualWorkCommand, serverPreview\)[\s\S]*preview_fingerprint: serverPreview\.previewFingerprint[\s\S]*daily_actual_work_resolution: dailyActualWorkCommand/);
console.log('employment review daily actual-work resolution UI tests passed');
