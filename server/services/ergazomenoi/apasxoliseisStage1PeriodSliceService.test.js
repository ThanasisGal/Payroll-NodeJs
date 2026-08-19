'use strict';

const assert = require('assert/strict');
const { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints,
    findStage1PeriodSlice, resolveStage1PeriodSliceStatus } = require(
    './apasxoliseisStage1PeriodSliceService'
);

function rows() {
    return Array.from({ length: 7 }, (_, index) => ({
        _id: `row-${index}`,
        hmeromhnia: new Date(Date.UTC(2026, 5, 29 + index)),
        employee_id: 'employee-0014',
        kodikos: '0014',
        kathgoria_ergasias: 'ΕΡΓ',
        synolo_ores: index < 2 ? 8 : 0,
        kathgoria_adeias_apologistika: index === 0 ? 'POSSIBLE_LEAVE' : ''
    }));
}

const weekRows = rows();
const june = deriveStage1PeriodSlice({ weekRows,
    week_start: '2026-06-29', week_end: '2026-07-05',
    period_start: '2026-06-01', period_end: '2026-06-30' });
assert.deepEqual([...june.actionable_dates], ['2026-06-29', '2026-06-30']);
assert.deepEqual([...june.context_only_dates], ['2026-07-01', '2026-07-02',
    '2026-07-03', '2026-07-04', '2026-07-05']);

const july = deriveStage1PeriodSlice({ weekRows,
    week_start: '2026-06-29', week_end: '2026-07-05',
    period_start: '2026-07-01', period_end: '2026-07-31' });
assert.deepEqual([...july.actionable_dates], ['2026-07-01', '2026-07-02',
    '2026-07-03', '2026-07-04', '2026-07-05']);
assert.deepEqual([...july.context_only_dates], ['2026-06-29', '2026-06-30']);

const juneFingerprints = buildStage1PeriodSliceFingerprints({ weekRows, slice: june });
const julyFingerprints = buildStage1PeriodSliceFingerprints({ weekRows, slice: july });
assert.equal(juneFingerprints.context_fingerprint, julyFingerprints.context_fingerprint);
assert.notEqual(juneFingerprints.completion_fingerprint, julyFingerprints.completion_fingerprint);

const stage1 = { period_slices: [{ ...june, status: 'COMPLETED',
    context_fingerprint: juneFingerprints.context_fingerprint,
    completion_fingerprint: juneFingerprints.completion_fingerprint,
    effective_fingerprint: juneFingerprints.completion_fingerprint,
    version: 1 }, { ...july, status: 'OPEN',
    context_fingerprint: julyFingerprints.context_fingerprint, version: 1 }] };
assert.equal(findStage1PeriodSlice(stage1, '2026-06-01', '2026-06-30').status, 'COMPLETED');
assert.equal(findStage1PeriodSlice(stage1, '2026-07-01', '2026-07-31').status, 'OPEN');
assert.equal(resolveStage1PeriodSliceStatus({
    current_context_fingerprint: juneFingerprints.context_fingerprint,
    current_completion_fingerprint: juneFingerprints.completion_fingerprint,
    persisted_slice: stage1.period_slices[0]
}), 'COMPLETED');
assert.equal(resolveStage1PeriodSliceStatus({
    current_context_fingerprint: 'f'.repeat(64),
    current_completion_fingerprint: juneFingerprints.completion_fingerprint,
    persisted_slice: stage1.period_slices[0]
}), 'COMPLETED');
assert.equal(resolveStage1PeriodSliceStatus({
    current_context_fingerprint: juneFingerprints.context_fingerprint,
    current_completion_fingerprint: 'e'.repeat(64),
    persisted_slice: stage1.period_slices[0]
}), 'STALE');

const changedJulyRows = rows();
changedJulyRows[4].kathgoria_adeias_apologistika = 'POSSIBLE_LEAVE';
const changed = buildStage1PeriodSliceFingerprints({ weekRows: changedJulyRows, slice: june });
assert.notEqual(changed.context_fingerprint, juneFingerprints.context_fingerprint);
assert.equal(changed.completion_fingerprint, juneFingerprints.completion_fingerprint);
assert.equal(resolveStage1PeriodSliceStatus({
    current_context_fingerprint: changed.context_fingerprint,
    current_completion_fingerprint: changed.completion_fingerprint,
    persisted_slice: stage1.period_slices[0]
}), 'COMPLETED');

assert.throws(() => deriveStage1PeriodSlice({ weekRows: weekRows.slice(0, 2),
    week_start: '2026-06-29', week_end: '2026-07-05',
    period_start: '2026-06-01', period_end: '2026-06-30' }),
{ code: 'INCOMPLETE_NATURAL_WEEK' });

console.log('Stage-1 period-slice fingerprint tests passed');
