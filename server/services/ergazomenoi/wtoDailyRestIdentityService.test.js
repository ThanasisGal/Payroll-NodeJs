'use strict';
const assert = require('assert');
const { assertWtoDailyFrozenSnapshotVersion, resolveWtoDailyRestIdentity,
    buildWtoDailyPayloadFingerprint } = require('./wtoDailyRestIdentityService');

assert.throws(() => assertWtoDailyFrozenSnapshotVersion({ snapshot_schema_version: 'employment-period-frozen:v2',
    employees: [{ kodikos: '1', eponymo: 'ΕΠ', onoma: 'ΟΝ' }] }),
    (error) => error.code === 'WTODAILY_FROZEN_IDENTITY_VERSION_UNSUPPORTED');
assert.strictEqual(assertWtoDailyFrozenSnapshotVersion({ snapshot_schema_version: 'employment-period-frozen:v3',
    employees: [{ kodikos: '1', afm: '123456789', eponymo: 'ΕΠ', onoma: 'ΟΝ' }] })
    .snapshot_schema_version, 'employment-period-frozen:v3');

assert.deepStrictEqual(resolveWtoDailyRestIdentity({ submission: { id: 91, code: 'WTODayilyA' } }, 'trial'), {
    environment: 'trial', submission_code: 'WTODayilyA', submission_id: 91
});
assert.deepStrictEqual(resolveWtoDailyRestIdentity({ submission: { id: 207, code: 'WTODayilyA' } }, 'production'), {
    environment: 'production', submission_code: 'WTODayilyA', submission_id: 207
});
assert.throws(() => resolveWtoDailyRestIdentity({ submission: { id: 207, code: 'OTHER' } }, 'trial'),
    (error) => error.code === 'WTODAILY_RESOLVED_SUBMISSION_INVALID');
assert.throws(() => resolveWtoDailyRestIdentity({ submission: { id: 91, code: 'OTHER' } }, 'production'),
    (error) => error.code === 'WTODAILY_RESOLVED_SUBMISSION_INVALID');
const fingerprintInput = { team: 'team', company: 'company', branch: '0001',
    periodStart: '2026-06-01', periodEnd: '2026-06-30', payload: { WTOS: { WTO: [] } } };
const trialFingerprint = buildWtoDailyPayloadFingerprint({ ...fingerprintInput,
    environment: 'trial', submission_id: 91 });
const productionFingerprint = buildWtoDailyPayloadFingerprint({ ...fingerprintInput,
    environment: 'production', submission_id: 207 });
assert.strictEqual(trialFingerprint, productionFingerprint);
assert.strictEqual(trialFingerprint.length, 64);
console.log('WTODayilyA environment-specific REST identity tests passed');
