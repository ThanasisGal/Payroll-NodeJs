'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectSuspiciousShortCardInterval } = require('./apasxoliseisSuspiciousShortCardIntervalService');

const policy = { elegxos_ypopta_mikron_diastimaton_kartas: true,
    poly_mikro_diastima_kartas_eos_lepta: 5, mikro_diastima_kartas_eos_lepta: 60,
    mikro_diastima_kartas_max_pososto_programmatos: 25,
    mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: 60 };
function row(cards = ['10:00', '10:01']) { return { kathgoria_ergasias: 'ΕΡΓ',
    apo_ora_01: '10:00', eos_ora_01: '14:00',
    cards_apo_ora_01: cards[0], cards_eos_ora_01: cards[1] }; }

test('disabled policy and incomplete card evidence are not suspicious-short', () => {
    assert.equal(detectSuspiciousShortCardInterval(row(), {}).suspicious, false);
    assert.equal(detectSuspiciousShortCardInterval(row(['14:04', '14:04']), policy).suspicious, false);
    assert.equal(detectSuspiciousShortCardInterval(row(['14:04', '']), policy).suspicious, false);
});
test('very-short boundaries and relative rule are deterministic', () => {
    assert.equal(detectSuspiciousShortCardInterval(row(['10:00', '10:01']), policy).matchedRule, 'VERY_SHORT');
    assert.equal(detectSuspiciousShortCardInterval(row(['10:00', '10:05']), policy).matchedRule, 'VERY_SHORT');
    assert.equal(detectSuspiciousShortCardInterval(row(['10:00', '10:06']), policy).matchedRule,
        'SHORT_RELATIVE_TO_DECLARED');
    const thirty = detectSuspiciousShortCardInterval(row(['10:00', '10:30']), policy);
    assert.equal(thirty.suspicious, true); assert.equal(thirty.percentage, 12.5);
    assert.equal(detectSuspiciousShortCardInterval(row(['10:00', '12:00']), policy).suspicious, false);
});
test('total verified minutes across complete pairs and existing authorities are respected', () => {
    const split = { ...row(['08:00', '12:00']), apo_ora_01: '08:00', eos_ora_01: '12:00',
        apo_ora_02: '13:00', eos_ora_02: '17:00',
        cards_apo_ora_02: '13:00', cards_eos_ora_02: '17:00' };
    assert.equal(detectSuspiciousShortCardInterval(split, policy).suspicious, false);
    assert.equal(detectSuspiciousShortCardInterval({ ...row(),
        apo_ora_01_apologistika: '10:00', eos_ora_01_apologistika: '10:01',
        ektakth_oroadeia_apologistika: false,
        ektakta_diastimata_oroadeias_apologistika: [],
        ores_ektakths_oroadeias_apologistika: 0,
        kathgoria_adeias_apologistika: '',
        hr_daily_actual_work_resolution: { status: 'HR_APPROVED',
            policy_version: 'hr-daily-actual-work:v1',
            resolution_kind: 'HR_DAILY_ACTUAL_WORK_AND_EMERGENCY_HOURLY_LEAVE',
            source_case: 'SUSPICIOUS_SHORT_CARD_INTERVAL', reason: 'Έλεγχος',
            approved_work_intervals: [{ pairNumber: 1, start: '10:00', end: '10:01' }],
            emergency_hourly_leave_intervals: [], leave_category: '',
            raw_card_snapshot: { cards_apo_ora_01: '10:00', cards_eos_ora_01: '10:01',
                cards_apo_ora_02: '', cards_eos_ora_02: '',
                cards_apo_ora_03: '', cards_eos_ora_03: '' }, raw_cards_preserved: true,
            approved_by: 'HR', approved_at: new Date(), revision_number: 0 }
    }, policy).suspicious, false);
    assert.equal(detectSuspiciousShortCardInterval({ ...row(),
        egkekrimenh_oroadeia_apologistika: true }, policy).suspicious, false);
});
test('percentage and missing-time boundaries are inclusive', () => {
    const exact = detectSuspiciousShortCardInterval(row(['10:00', '11:00']), {
        ...policy, mikro_diastima_kartas_eos_lepta: 60,
        mikro_diastima_kartas_max_pososto_programmatos: 25,
        mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: 180
    });
    assert.equal(exact.suspicious, true);
    assert.equal(exact.percentage, 25);
    assert.equal(exact.missingDeclaredMinutes, 180);
});

test('missing schedule, invalid evidence and full-day authority are excluded', () => {
    assert.equal(detectSuspiciousShortCardInterval({ cards_apo_ora_01: '10:00',
        cards_eos_ora_01: '10:01' }, policy).suspicious, false);
    assert.equal(detectSuspiciousShortCardInterval(row(['bad', '10:01']), policy).suspicious,
        false);
    assert.equal(detectSuspiciousShortCardInterval({ ...row(),
        adeia_apologistika: true }, policy).suspicious, false);
    assert.equal(detectSuspiciousShortCardInterval({ ...row(),
        astheneia_apologistika: true }, policy).suspicious, false);
});

test('diagnostics preserve exact thresholds and malformed approval cannot suppress review', () => {
    const result = detectSuspiciousShortCardInterval(row(['10:00', '10:30']), policy);
    assert.equal(result.reason, 'SUSPICIOUS_SHORT_CARD_INTERVAL_REQUIRES_HR_DECISION');
    assert.equal(result.verifiedMinutes, 30);
    assert.equal(result.declaredMinutes, 240);
    assert.equal(result.missingDeclaredMinutes, 210);
    assert.deepEqual(result.thresholds, { enabled: true, veryShortMinutes: 5,
        shortMinutes: 60, maxDeclaredPercentage: 25,
        minimumMissingDeclaredMinutes: 60 });
    assert.equal(detectSuspiciousShortCardInterval({ ...row(),
        hr_daily_actual_work_resolution: { status: 'HR_APPROVED' } }, policy).suspicious, true);
});
