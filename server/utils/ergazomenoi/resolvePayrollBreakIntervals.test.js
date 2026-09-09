'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolvePayrollBreakIntervals: resolve } = require('./resolvePayrollBreakIntervals');
const S = require('../../services/ergazomenoi/apasxoliseisWeeklyIllegalOvertimeCalculationService');
const employee = { dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: false };
const geometry = intervals => intervals.map(({ start, end }) => [start, end]);
const input = (start, end, row = {}, profile = employee) => ({ row, effectiveEmployee: profile,
    workIntervals: [{ start, end }] });

test('σπαστό δηλωμένο ωράριο: 8 ώρες, χωρίς κανένα διάλειμμα', () => {
    const row = { apo_ora_01: '08:00', eos_ora_01: '12:00', apo_ora_02: '16:00', eos_ora_02: '20:00' };
    for (const profile of [employee, { ...employee, dialleima_apo_ora_01: '10:00', dialleima_eos_ora_01: '10:30' }]) {
        const r = resolve({ row, effectiveEmployee: profile, workIntervals: [{ start: 480, end: 720 }, { start: 960, end: 1200 }] });
        assert.equal(r.splitSchedule, true);
        assert.equal(r.netMinutes, 480);
        assert.equal(r.removedMinutes, 0);
        assert.deepEqual(r.breakIntervals, []);
    }
});
test('σπαστό ωράριο με εξάωρα διαστήματα: καμία αφαίρεση', () => {
    const r = resolve({ row: { apo_ora_01: '06:00', eos_ora_01: '12:00', apo_ora_02: '16:00', eos_ora_02: '22:00' },
        effectiveEmployee: employee, workIntervals: [{ start: 360, end: 720 }, { start: 960, end: 1320 }] });
    assert.equal(r.netMinutes, 720);
    assert.deepEqual(r.breakIntervals, []);
});
test('ρητό προφίλ υπερισχύει ημερήσιου ζεύγους και συνθετικού διαλείμματος', () => {
    const row = { dialleima_apo_ora_01: '15:00', dialleima_eos_ora_01: '15:30' };
    const profile = { ...employee, dialleima_apo_ora_01: '14:00', dialleima_eos_ora_01: '14:30' };
    const r = resolve(input(750, 1079, row, profile));
    assert.equal(r.source, 'EFFECTIVE_PROFILE');
    assert.deepEqual(geometry(r.workIntervals), [[750, 840], [870, 1079]]);
    const daily = resolve(input(750, 1079, row));
    assert.equal(daily.source, 'DAILY_SCHEDULE');
    assert.deepEqual(geometry(daily.workIntervals), [[750, 900], [930, 1079]]);
});
test('0031: 12:30–17:59, διάλειμμα 16:30–17:00 και 299 καθαρά λεπτά Κυριακής', () => {
    const r = resolve(input(750, 1079));
    assert.deepEqual(r.breakIntervals, [{ start: 990, end: 1020, apo: '16:30', eos: '17:00' }]);
    assert.deepEqual([r.grossMinutes, r.removedMinutes, r.netMinutes], [329, 30, 299]);
    const classified = S.emptyClassifiedMinutes();
    for (const x of r.workIntervals) for (let m = x.start; m < x.end; m++)
        S.addClassifiedMinute(classified, { hmeromhnia: '2026-04-05' }, m, new Set());
    assert.deepEqual(classified, { normal: 0, night: 0, holiday: 299, holidayNight: 0 });
});
test('όριο νύχτας: 17:45–23:00 αφαιρεί 21:45–22:15', () => {
    const r = resolve(input(1065, 1380));
    assert.deepEqual(geometry(r.workIntervals), [[1065, 1305], [1335, 1380]]);
    const night = r.workIntervals.reduce((sum, x) => sum + Math.max(0, x.end - Math.max(1320, x.start)), 0);
    assert.equal(night, 45);
    assert.equal(r.netMinutes, 285);
});
test('μεσάνυχτα: 22:30–05:00 τοποθετεί 02:30–03:00 την επόμενη ημέρα', () => {
    const r = resolve(input(1350, 1740));
    assert.deepEqual(r.breakIntervals, [{ start: 1590, end: 1620, apo: '02:30', eos: '03:00' }]);
    assert.equal(r.netMinutes, 360);
});
test('12:30–16:40 αφαιρεί μόνο 10 λεπτά χωρίς επέκταση παρουσίας', () => {
    const r = resolve(input(750, 1000));
    assert.equal(r.removedMinutes, 10);
    assert.equal(r.netMinutes, 240);
    assert.deepEqual(geometry(r.workIntervals), [[750, 990]]);
});
test('παρουσία έως τέσσερις ώρες δεν δημιουργεί συνθετικό διάλειμμα', () => {
    for (const length of [1, 120, 239, 240]) {
        const r = resolve(input(750, 750 + length));
        assert.equal(r.netMinutes, length);
        assert.deepEqual(r.breakIntervals, []);
    }
});
test('εσωτερικό διάλειμμα διατηρεί όλα τα λεπτά εργασίας', () => {
    const r = resolve(input(750, 1079, {}, { ...employee, dialleima_entos_ektos_orarioy: true }));
    assert.equal(r.netMinutes, 329);
    assert.equal(r.removedMinutes, 0);
    assert.equal(r.breakIntervals[0].apo, '16:30');
});
test('πολλαπλές κάρτες δεν αρκούν για σπαστό ωράριο και το κενό μηδενίζει τη συνέχεια', () => {
    const r = resolve({ row: { apo_ora_01: '08:00', eos_ora_01: '20:00' }, effectiveEmployee: employee,
        workIntervals: [{ start: 480, end: 600 }, { start: 660, end: 960 }] });
    assert.equal(r.splitSchedule, false);
    assert.equal(r.breakIntervals[0].apo, '15:00');
    assert.equal(r.netMinutes, 390);
    const shortRuns = resolve({ effectiveEmployee: employee,
        workIntervals: [{ start: 480, end: 660 }, { start: 720, end: 900 }] });
    assert.equal(shortRuns.netMinutes, 360);
    assert.deepEqual(shortRuns.breakIntervals, []);
});
test('εφαπτόμενες κάρτες συνεχίζουν τα 240 λεπτά, ακόμη και στα μεσάνυχτα', () => {
    const r = resolve({ effectiveEmployee: employee,
        workIntervals: [{ start: 1320, end: 1440 }, { start: 0, end: 300 }] });
    assert.equal(r.breakIntervals[0].apo, '02:00');
    assert.equal(r.netMinutes, 390);
});
test('ίδια αμετάβλητα δεδομένα δίνουν ακριβώς ίδιο αποτέλεσμα', () => {
    const data = input(750, 1079);
    const before = structuredClone(data);
    Object.freeze(data.effectiveEmployee);
    Object.freeze(data.workIntervals[0]);
    assert.deepEqual(resolve(data), resolve(data));
    assert.deepEqual(data, before);
});
