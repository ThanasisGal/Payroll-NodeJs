'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCompanySuspiciousShortCardPolicy } =
    require('./companySuspiciousShortCardPolicyService');

test('company suspicious-short policy has backwards-compatible defaults', () => {
    assert.deepEqual(normalizeCompanySuspiciousShortCardPolicy({}), {
        elegxos_ypopta_mikron_diastimaton_kartas: false,
        poly_mikro_diastima_kartas_eos_lepta: 5,
        mikro_diastima_kartas_eos_lepta: 60,
        mikro_diastima_kartas_max_pososto_programmatos: 25,
        mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: 60
    });
});
test('valid configured values round-trip', () => {
    const input = { elegxos_ypopta_mikron_diastimaton_kartas: true,
        poly_mikro_diastima_kartas_eos_lepta: '3', mikro_diastima_kartas_eos_lepta: '45',
        mikro_diastima_kartas_max_pososto_programmatos: '20',
        mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: '90' };
    const value = normalizeCompanySuspiciousShortCardPolicy(input);
    assert.equal(value.elegxos_ypopta_mikron_diastimaton_kartas, true);
    assert.equal(value.mikro_diastima_kartas_eos_lepta, 45);
});
test('disabled policy preserves the four explicit zero values from the company UI', () => {
    assert.deepEqual(normalizeCompanySuspiciousShortCardPolicy({
        elegxos_ypopta_mikron_diastimaton_kartas: false,
        poly_mikro_diastima_kartas_eos_lepta: '0',
        mikro_diastima_kartas_eos_lepta: '0',
        mikro_diastima_kartas_max_pososto_programmatos: '0',
        mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: '0'
    }), {
        elegxos_ypopta_mikron_diastimaton_kartas: false,
        poly_mikro_diastima_kartas_eos_lepta: 0,
        mikro_diastima_kartas_eos_lepta: 0,
        mikro_diastima_kartas_max_pososto_programmatos: 0,
        mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: 0
    });
});
test('invalid ranges and inconsistent thresholds fail closed', () => {
    assert.throws(() => normalizeCompanySuspiciousShortCardPolicy({
        poly_mikro_diastima_kartas_eos_lepta: 61,
        mikro_diastima_kartas_eos_lepta: 60 }),
    { code: 'COMPANY_SUSPICIOUS_SHORT_POLICY_INVALID' });
    assert.throws(() => normalizeCompanySuspiciousShortCardPolicy({
        mikro_diastima_kartas_max_pososto_programmatos: 101 }),
    { code: 'COMPANY_SUSPICIOUS_SHORT_POLICY_INVALID' });
    assert.throws(() => normalizeCompanySuspiciousShortCardPolicy({
        mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: 1441 }),
    { code: 'COMPANY_SUSPICIOUS_SHORT_POLICY_INVALID' });
});
