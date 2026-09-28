'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { IstorikoProslhpseonAllagonModel } = require('./ergazomenoi');
const { LEGACY_OPEN_CYCLE_CLEANUP_FOUNDATION_SOURCE } =
    require('../constants/employeeLegacyOpenCycleCleanup');

function foundation(extra = {}) {
    return new IstorikoProslhpseonAllagonModel({
        team: 'BLG', company_kod: '507f1f77bcf86cd799439151', kodikos: '0001',
        aa_eggrafhs: '0001', hmeromhnia_proslhpshs: '2026-05-01',
        afora_proslhpsh: true, afora_allagh_oron_ergasias: false,
        employment_profile_source: LEGACY_OPEN_CYCLE_CLEANUP_FOUNDATION_SOURCE,
        ...extra
    }, null, { defaults: false });
}

test('approved sparse legacy current-hire foundation passes history validation', async () => {
    const document = foundation();
    await document.validate();
    assert.equal(document.employment_profile_schema_version == null, true);
    assert.equal(document.hmeromhnia_apoxorhshs, undefined);
});

test('legacy foundation exception rejects synthesized lifecycle boundary facts', async () => {
    for (const extra of [
        { hmeromhnia_apoxorhshs: '2026-05-31' },
        { hmeromhnia_lhxhs_symbashs: '2026-05-31' },
        { hmeromhnia_isxyos_oron_ergasias_apo: '2026-05-01' }
    ]) {
        await assert.rejects(foundation(extra).validate());
    }
});
