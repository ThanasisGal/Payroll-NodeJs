'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints } = require('./apasxoliseisStage1PeriodSliceService');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const scope = { week_start: '2026-09-28', week_end: '2026-10-04',
    period_start: '2026-09-01', period_end: '2026-09-30' };
const rows = Array.from({ length: 7 }, (_, i) => ({ _id: `synthetic-${i}`,
    hmeromhnia: new Date(Date.UTC(2026, 8, 28 + i)), kathgoria_ergasias: 'ΕΡΓ',
    kathgoria_ergasias_apologistika: 'ΑΣΘΕΝΕΙΑ', astheneia_apologistika: true,
    ores_ergasias: 8, apo_ora_01: '08:00', eos_ora_01: '16:00', cards_ores_ergasias: 0 }));

test('A: complete September slice does not require future October rows', () => {
    const slice = deriveStage1PeriodSlice({ ...scope, weekRows: rows.slice(0, 3),
        require_complete_slice: true });
    assert.deepEqual(slice.actionable_dates, ['2026-09-28', '2026-09-29', '2026-09-30']);
    assert.deepEqual(slice.context_only_dates, ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
});
test('B/C: missing and duplicate owned days are rejected by slice validation', () => {
    for (const weekRows of [[rows[0], rows[2]], [...rows.slice(0, 3), rows[2]]]) {
        assert.throws(() => deriveStage1PeriodSlice({ ...scope, weekRows,
            require_complete_slice: true }), { code: 'INCOMPLETE_NATURAL_WEEK' });
    }
    assert.throws(() => deriveStage1PeriodSlice({ ...scope, weekRows: rows.slice(0, 3) }),
        { code: 'INCOMPLETE_NATURAL_WEEK' }, 'The default full-week contract stays strict');
});
test('D/E: future rows are independent, owned rows and previous context remain fingerprinted', () => {
    const slice = deriveStage1PeriodSlice({ ...scope, weekRows: rows });
    const before = buildStage1PeriodSliceFingerprints({ weekRows: rows.slice(0, 3), slice });
    const after = buildStage1PeriodSliceFingerprints({ weekRows: rows, slice });
    assert.equal(after.context_fingerprint, before.context_fingerprint);
    assert.equal(after.completion_fingerprint, before.completion_fingerprint);
    const changed = structuredClone(rows);
    changed[1].astheneia_apologistika = false;
    changed[1].apousia_apologistika = true;
    assert.notEqual(buildStage1PeriodSliceFingerprints({ weekRows: changed, slice }).completion_fingerprint,
        before.completion_fingerprint);
    const october = deriveStage1PeriodSlice({ ...scope, period_start: '2026-10-01',
        period_end: '2026-10-31', weekRows: rows });
    assert.notEqual(buildStage1PeriodSliceFingerprints({ weekRows: changed, slice: october }).context_fingerprint,
        buildStage1PeriodSliceFingerprints({ weekRows: rows, slice: october }).context_fingerprint);
});
test('existing full-week context fingerprints remain usable while their dependencies match', () => {
    const slice = deriveStage1PeriodSlice({ ...scope, weekRows: rows });
    const legacy = buildStage1Fingerprint(rows).fingerprint;
    const current = buildStage1PeriodSliceFingerprints({ weekRows: rows, slice,
        persisted_slice: { status: 'COMPLETED', context_fingerprint: legacy } });
    assert.equal(current.context_fingerprint, legacy);
});
