'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { buildStage3InputFingerprint } = require('./apasxoliseisStage3FingerprintService');

function context() {
    return { scope: { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
        employee_id: new mongoose.Types.ObjectId().toString(), employee_kodikos: '0014',
        week_start: '2026-06-01', week_end: '2026-06-07' },
    row: { _id: new mongoose.Types.ObjectId().toString(), hmeromhnia: '2026-06-03',
        kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 6,
        apo_ora_01: '15:00', eos_ora_01: '21:00', cards_ores_ergasias: 0,
        kathgoria_ergasias_apologistika: '', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' },
    dailyProfile: { kathestos_apasxolhshs: '1', source: 'ISTORIKO',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-25' }, isResidual: true,
    stage2: { fingerprint: 'a'.repeat(64), status: 'COMPLETED',
        resolution: 'NOT_APPLICABLE', resolved_dates: [] },
    upstream: { stage1_current_fingerprint: 'b'.repeat(64),
        stage1_completion_fingerprint: 'b'.repeat(64),
        stage1_effective_fingerprint: 'b'.repeat(64), stage1_version: 1,
        stage2_fingerprint: 'a'.repeat(64), stage2_version: 0 } };
}
const base = context();
const first = buildStage3InputFingerprint(base).fingerprint;
assert.equal(first, buildStage3InputFingerprint(base).fingerprint);
for (const changed of [
    { row: { ...base.row, ores_ergasias: 8 } },
    { row: { ...base.row, cards_ores_ergasias: 2,
        cards_apo_ora_01: '15:00', cards_eos_ora_01: '17:00' } },
    { dailyProfile: { ...base.dailyProfile, kathestos_apasxolhshs: '0' } },
    { isResidual: false },
    { upstream: { ...base.upstream, stage1_effective_fingerprint: 'c'.repeat(64) } },
    { upstream: { ...base.upstream, stage1_version: 2 } }
]) {
    assert.notEqual(buildStage3InputFingerprint({ ...base, ...changed }).fingerprint, first);
}
console.log('Stage-3 input fingerprint tests passed');
