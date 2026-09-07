'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('./apasxoliseisWeeklyIllegalOvertimeCalculationService');
const { subtractIntervals } = require('../../utils/ergazomenoi/subtractExternalBreakIntervals');
const { analyzeWeeklySixthSeventhDay } = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const { getOrarioTermsForDate } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { buildCompleteProfileSnapshot } = require('../../utils/ergazomenoi/employmentProfileHistory');
const profile = (start = '03:00', end = '03:30', extra = {}) => ({
    hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 8, typos_apasxolhshs: '0',
    dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30,
    dialleima_apo_ora_01: start, dialleima_eos_ora_01: end, ...extra
});
const row = (date = '2026-09-06', start = '23:00', end = '07:30') => ({
    hmeromhnia: date, kathgoria_ergasias: 'ΕΡΓ', repo: false,
    apo_ora_01: start, eos_ora_01: end, ores_ergasias: 8,
    cards_apo_ora_01: start, cards_eos_ora_01: end, cards_ores_ergasias: 8.5
});
const geometry = intervals => intervals.map(({ start, end }) => [start, end]);
function classify(rec, employee, holidays = []) {
    const intervals = S.getPayrollCalculationIntervals(rec, employee);
    const bucket = S.emptyClassifiedMinutes();
    for (const { start, end } of intervals) for (let m = start; m < end; m++)
        S.addClassifiedMinute(bucket, rec, m, new Set(holidays));
    assert.equal(Object.values(bucket).reduce((a, b) => a + b, 0),
        intervals.reduce((n, i) => n + i.end - i.start, 0));
    return { intervals, ...bucket };
}

test('Sunday to Monday: exact external break preserves 8h, 6.5h night and 1h Sunday/night', () => {
    const c = classify(row(), profile());
    assert.deepEqual(geometry(c.intervals), [[1380, 1620], [1650, 1890]]);
    assert.deepEqual([c.normal, c.night, c.holiday, c.holidayNight], [90, 330, 0, 60]);
});
test('Saturday to Sunday: midnight-side break removes Sunday/night minutes', () => {
    const c = classify(row('2026-09-05', '20:00', '04:30'), profile('00:15', '00:45'));
    assert.deepEqual(geometry(c.intervals), [[1200, 1455], [1485, 1710]]);
    assert.deepEqual([c.normal, c.night, c.holiday, c.holidayNight], [120, 120, 0, 240]);
});
test('break crossing 06:00 removes 15 night and 15 daytime minutes', () => {
    const c = classify(row(), profile('05:45', '06:15'));
    assert.deepEqual([c.normal, c.night, c.holidayNight], [75, 345, 60]);
});
test('break crossing midnight removes intersections on both calendar dates', () => {
    const c = classify(row('2026-09-05', '20:00', '04:30'), profile('23:45', '00:15'));
    assert.deepEqual(geometry(c.intervals), [[1200, 1425], [1455, 1710]]);
    assert.deepEqual([c.normal, c.night, c.holidayNight], [120, 105, 255]);
});
test('official holiday classification happens after break removal', () => {
    const c = classify(row('2026-09-03'), profile(), ['2026-09-04']);
    assert.deepEqual([c.normal, c.night, c.holiday, c.holidayNight], [0, 60, 90, 330]);
});
test('weekly illegal overtime takes the last worked minutes, with their real night/day placement', () => {
    const result = S.buildWeeklyIllegalOvertimeUpdate(row(), profile(), 2, new Set());
    assert.equal(result.ores_paranomhs_yperorias_apologistika, 1.5);
    assert.equal(result.ores_paranomhs_yperorias_nyxtas_apologistika, 0.5);
    assert.equal(result.ores_paranomhs_yperorias_argion_nyxtas_apologistika, 0);
});
test('Thursday to Friday uses the same geometry, with no end trimming', () => {
    const c = classify(row('2026-09-03'), profile());
    assert.deepEqual(geometry(c.intervals), [[1380, 1620], [1650, 1890]]);
    assert.equal(c.normal, 90); assert.equal(c.night, 390);
});
test('weekday invariance for all seven overnight transitions', () => {
    for (let day = 0; day < 7; day++) {
        const date = new Date(Date.UTC(2026, 8, 7 + day)).toISOString().slice(0, 10);
        const c = classify(row(date), profile());
        assert.deepEqual(geometry(c.intervals), [[1380, 1620], [1650, 1890]]);
        assert.equal(c.night + c.holidayNight, 390);
        assert.equal(c.normal + c.holiday, 90);
    }
});
test('multiple breaks, overlapping breaks and non-overlap preserve work and do not double subtract', () => {
    const c = classify(row('2026-09-03'), profile('03:00', '03:15', {
        dialleima_apo_ora_02: '03:10', dialleima_eos_ora_02: '03:30',
        dialleima_apo_ora_03: '12:00', dialleima_eos_ora_03: '12:30'
    }));
    assert.deepEqual(geometry(c.intervals), [[1380, 1620], [1650, 1890]]);
    assert.deepEqual(geometry(S.getCardIntervals(row('2026-09-03', '09:00', '17:30'), profile('12:00', '12:15', {
        dialleima_apo_ora_02: '15:00', dialleima_eos_ora_02: '15:15'
    }))), [[540, 720], [735, 900], [915, 1050]]);
});
test('valid non-overlapping exact break never falls back to trimming', () => {
    assert.deepEqual(geometry(S.getCardIntervals(row(), profile('12:00', '12:30'))), [[1380, 1890]]);
});
test('a fully removed card interval never resurrects apologistika fallback work', () => {
    const r = { ...row('2026-09-03', '03:00', '03:30'),
        apo_ora_01_apologistika: '03:00', eos_ora_01_apologistika: '03:30' };
    assert.deepEqual(S.getPayrollCalculationIntervals(r, profile()), []);
});
test('no exact interval, invalid/zero-length pair: legacy duration fallback remains', () => {
    for (const p of [profile('', ''), profile('03:00', '03:00'), profile('25:00', '25:30')]) {
        assert.deepEqual(geometry(S.getCardIntervals(row(), p)), [[1380, 1860]]);
    }
    assert.deepEqual(geometry(S.getCardIntervals(row('2026-09-03', '09:00', '12:00'), profile('', ''))), [[540, 720]]);
});
test('internal break does not remove or extend work', () => {
    assert.deepEqual(geometry(S.getCardIntervals(row(), profile('03:00', '03:30', {
        dialleima_entos_ektos_orarioy: true
    }))), [[1380, 1890]]);
});
test('pure subtraction ignores invalid ranges and conserves the interval difference', () => {
    const work = Object.freeze([{ start: 100, end: 200, tag: 'work' }]);
    assert.deepEqual(subtractIntervals(work, [{ start: 120, end: 150 }, { start: 140, end: 170 },
        { start: 200, end: 220 }, { start: 180, end: 180 }, { start: NaN, end: 190 }]),
    [{ start: 100, end: 120, tag: 'work' }, { start: 170, end: 200, tag: 'work' }]);
    assert.deepEqual(subtractIntervals(work, [{ start: 0, end: 300 }]), []);
});
test('pure subtraction matches minute-set difference across varied overlaps', () => {
    for (let offset = 0; offset < 60; offset++) {
        const work = [{ start: 0, end: 50 }, { start: 70, end: 100 }];
        const pauses = [{ start: offset - 10, end: offset + 15 }, { start: offset, end: offset + 30 }];
        const minutes = spans => spans.flatMap(({ start, end }) => Array.from({ length: end - start }, (_, i) => start + i));
        const removed = new Set(minutes(pauses));
        assert.deepEqual(minutes(subtractIntervals(work, pauses)), minutes(work).filter(m => !removed.has(m)));
    }
});
test('split and partially verified cards remove only actual intersections', () => {
    const r = { ...row(), cards_eos_ora_01: '03:00', cards_apo_ora_02: '03:30', cards_eos_ora_02: '07:30' };
    assert.deepEqual(geometry(S.getCardIntervals(r, profile())), [[1380, 1620], [1650, 1890]]);
    const partial = { ...row(), cards_apo_ora_02: '12:00' };
    assert.deepEqual(geometry(S.getPayrollCalculationIntervals(partial, profile())), [[1380, 1620], [1650, 1890]]);
});
test('daily declared breaks do not replace the existing profile authority', () => {
    const r = { ...row(), dialleima_apo_ora_01: '06:30', dialleima_eos_ora_01: '07:00' };
    assert.deepEqual(geometry(S.getCardIntervals(r, profile())), [[1380, 1620], [1650, 1890]]);
    assert.deepEqual(geometry(S.getCardIntervals(r, profile('', ''))), [[1380, 1860]]);
});
test('calendar-date profile resolver supplies historical exact pairs, not current pairs', () => {
    const history = [buildCompleteProfileSnapshot({ input: profile('03:00', '03:30'), effectiveFrom: '2026-09-01' })];
    const effective = getOrarioTermsForDate('2026-09-06', history, profile('06:30', '07:00'));
    assert.deepEqual(geometry(S.getCardIntervals(row(), effective)), [[1380, 1620], [1650, 1890]]);
});
test('five-day week with Tuesday/Wednesday repo retains Sunday as normal and five actual days', () => {
    const rows = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(Date.UTC(2026, 8, 7 + i)).toISOString().slice(0, 10);
        const repo = i === 1 || i === 2;
        return { ...row(date), repo, kathgoria_ergasias: repo ? 'ΑΝ' : 'ΕΡΓ',
            cards_apo_ora_01: repo ? '' : '23:00', cards_eos_ora_01: repo ? '' : '07:30',
            cards_ores_ergasias: repo ? 0 : 8.5, ores_pragmatikhs_ergasias_apologistika: repo ? 0 : 8 };
    });
    const analysis = analyzeWeeklySixthSeventhDay({ weekRows: rows, effectiveProfile: profile(), hourlyRate: 10 });
    assert.equal(analysis.sixthDay, null); assert.equal(analysis.seventhDay, null);
    assert.equal(analysis.dailyFacts.filter(d => d.countsAsActualWorkDay).length, 5);
    assert.equal(analysis.dailyFacts.at(-1).countsAsActualWorkDay, true);
});
