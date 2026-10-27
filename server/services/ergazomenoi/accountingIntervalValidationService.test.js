'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectAccountingIntervals, assertAccountingIntervals,
    accountingIntervalsFromRow, assertWtoDailyPayloadIntervals } = require('./accountingIntervalValidationService');
const interval = (start, end, pairNumber) => ({ start, end, ...(pairNumber ? { pairNumber } : {}) });
const inspect = intervals => inspectAccountingIntervals({ intervals, date: '2026-09-27' });

test('27/09: exact overnight overlap, 360 minutes, Greek date and pair numbers', () => {
    const intervals = [interval('18:28', '00:28'), interval('18:28', '00:30')];
    const before = JSON.stringify(intervals);
    const result = inspect(intervals);
    assert.equal(result.valid, false);
    assert.equal(result.issues[0].overlapMinutes, 360);
    assert.deepEqual(result.issues[0].pairNumbers, [1, 2]);
    assert.match(result.issues[0].message, /27\/09\/2026/);
    assert.equal(JSON.stringify(intervals), before);
    assert.throws(() => assertAccountingIntervals({ intervals, date: '2026-09-27', operation: 'submit' }),
        error => error.code === 'ACCOUNTING_INTERVALS_OVERLAP' &&
            /1\./.test(error.message) && /2\./.test(error.message) &&
            /Δεν αποθηκεύτηκε/.test(error.message) && /Δεν στάλθηκε/.test(error.message));
});

test('25/09: touching at 18:29 remains unchanged, distinct from positive overlap', () => {
    const intervals = [interval('18:00', '18:29'), interval('18:29', '22:00')];
    const before = JSON.stringify(intervals);
    const result = inspectAccountingIntervals({ intervals, date: '2026-09-25' });
    assert.equal(result.valid, true);
    assert.equal(result.contacts.length, 1);
    assert.equal(result.contacts[0].overlapMinutes, 0);
    assert.match(result.contacts[0].message, /25\/09\/2026/);
    assert.equal(JSON.stringify(intervals), before);
});

test('all pairs including nonadjacent slots 1/3 and slots 2/3 are compared', () => {
    const result = inspect([interval('08:00', '18:00'), interval('09:00', '10:00'), interval('11:00', '12:00')]);
    assert.deepEqual(result.issues.map(issue => issue.pairNumbers), [[1, 2], [1, 3]]);
    const secondThird = inspect([interval('', ''), interval('22:00', '02:00'), interval('23:00', '01:00')]);
    assert.deepEqual(secondThird.issues[0].pairNumbers, [2, 3]);
    assert.equal(secondThird.issues[0].overlapMinutes, 120);
});

test('independent daytime and night spans are valid; order never moves a date', () => {
    assert.equal(inspect([interval('08:00', '12:00'), interval('16:00', '20:00')]).valid, true);
    assert.equal(inspect([interval('22:00', '06:00')]).valid, true);
    assert.equal(inspect([interval('00:30', '03:00'), interval('22:00', '02:00')]).valid, true);
    assert.equal(inspect([interval('16:00', '20:00'), interval('08:00', '12:00')]).valid, true);
});

test('empty slots are ignored, zero length and incomplete/invalid times rejected', () => {
    assert.equal(inspect([]).valid, true);
    assert.equal(inspect([interval('', ''), interval('', ''), interval('', '')]).valid, true);
    assert.equal(inspect([interval('00:30', '00:30')]).issues[0].code, 'ACCOUNTING_INTERVAL_ZERO_LENGTH');
    for (const input of [interval('08:00', ''), interval('', '12:00'), interval('24:00', '12:00'),
        interval('8:00', '12:00')]) assert.equal(inspect([input]).valid, false);
    assert.equal(inspect([null]).valid, false);
});

test('at most three unique slots; gaps preserve original pair numbers', () => {
    assert.equal(inspect(Array.from({ length: 4 }, () => interval('', ''))).valid, false);
    assert.equal(inspect([interval('08:00', '10:00', 1), interval('12:00', '13:00', 1)]).valid, false);
    const slots = accountingIntervalsFromRow({ apo_ora_02_apologistika: '12:00', eos_ora_02_apologistika: '14:00',
        apo_ora_03_apologistika: '13:00', eos_ora_03_apologistika: '15:00' });
    assert.deepEqual(inspect(slots).issues[0].pairNumbers, [2, 3]);
});

test('transport groups repeated employee/day entries without exposing identity', () => {
    const employee = (from, to) => ({ f_afm: 'synthetic-identity', f_date: '27/09/2026',
        ErgazomenosAnalytics: { ErgazomenosWTOAnalytics: [{ f_type: 'ΕΡΓ', f_from: from, f_to: to }] } });
    const payload = { WTOS: { WTO: [{ Ergazomenoi: { ErgazomenoiWTO: [employee('18:28', '00:28'), employee('18:28', '00:30')] } }] } };
    assert.throws(() => assertWtoDailyPayloadIntervals(payload), error =>
        error.code === 'ACCOUNTING_INTERVALS_OVERLAP' && !JSON.stringify(error.details).includes('synthetic-identity'));
});

test('malformed transport or blank work fails closed; nonworking categories remain valid', () => {
    assert.throws(() => assertWtoDailyPayloadIntervals({}), { code: 'WTODAILY_INVALID_INTERVAL_PAYLOAD' });
    const payload = type => ({ WTOS: { WTO: [{ Ergazomenoi: { ErgazomenoiWTO: [{ f_date: '25/09/2026',
        ErgazomenosAnalytics: { ErgazomenosWTOAnalytics: [{ f_type: type, f_from: '', f_to: '' }] } }] } }] } });
    assert.throws(() => assertWtoDailyPayloadIntervals(payload('ΕΡΓ')), { code: 'WTODAILY_INVALID_INTERVAL_PAYLOAD' });
    for (const type of ['ΑΝ', 'ΜΕ']) assert.equal(assertWtoDailyPayloadIntervals(payload(type)).valid, true);
});

const { normalizeAccountingIntervals, normalizedAccountingRowUpdate } = require('./accountingIntervalValidationService');
for (const [input, expected] of [
    [[['18:00', '18:29'], ['18:29', '22:00']], [['18:00', '22:00']]],
    [[['09:00', '12:00'], ['12:00', '17:00']], [['09:00', '17:00']]],
    [[['08:00', '10:00'], ['10:00', '12:00'], ['12:00', '16:00']], [['08:00', '16:00']]],
    [[['18:00', '22:00'], ['22:00', '00:30']], [['18:00', '00:30']]],
    [[['08:00', '12:00'], ['12:30', '16:00']], [['08:00', '12:00'], ['12:30', '16:00']]],
    [[['18:28', '00:28'], ['18:28', '00:30']], [['18:28', '00:28'], ['18:28', '00:30']]],
    [[['08:00', '12:00'], ['11:00', '16:00']], [['08:00', '12:00'], ['11:00', '16:00']]]
]) test(`shared normalization preserves minutes and gaps: ${JSON.stringify(input)}`, () => {
    const intervals = input.map(([start, end]) => ({ start, end }));
    const original = structuredClone(intervals);
    const result = normalizeAccountingIntervals(intervals);
    assert.deepEqual(result.intervals, expected.map(([start, end]) => ({ start, end })));
    assert.deepEqual(intervals, original);
    const duration = rows => rows.reduce((sum, row) => {
        const min = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
        return sum + (min(row.end) - min(row.start) + 1440) % 1440;
    }, 0);
    assert.equal(duration(result.intervals), duration(intervals));
});
test('normalization clears obsolete pairs but never touches cards, declared hours or approvals', () => {
    const source = { apo_ora_01_apologistika: '18:00', eos_ora_01_apologistika: '18:29',
        apo_ora_02_apologistika: '18:29', eos_ora_02_apologistika: '22:00',
        cards_apo_ora_01: '18:00', apo_ora_01: '18:00', hr_daily_actual_work_resolution: { approved: true } };
    const update = normalizedAccountingRowUpdate(source);
    assert.equal(update.eos_ora_01_apologistika, '22:00');
    assert.equal(update.apo_ora_02_apologistika, '');
    assert.equal(update.eos_ora_03_apologistika, '');
    assert.equal(Object.keys(update).length, 6);
    assert.equal(source.eos_ora_01_apologistika, '18:29');
});
