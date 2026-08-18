'use strict';

const assert = require('assert');
const { resolveOrphanCardResolution } = require('./apasxoliseisOrphanCardResolutionService');
const controller = require('../../controllers/ergazomenoi/erganhController');
const { buildApprovedOrphanDerivedPreview, ORPHAN_WEEKLY_DEPENDENT_FIELDS } =
    controller.__orphanDailyCalculationTestHooks;

function complete(date, start, end) {
    return { _id: date, hmeromhnia: `${date}T00:00:00.000Z`,
        cards_apo_ora_01: start, cards_eos_ora_01: end };
}

const common = { effectiveEmployee: { hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
    dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30,
    _workTermsSource: 'ISTORIKO', _workTermsIstorikoId: '6a134a66452cce439d36c955' },
breakConfiguration: { break_inside_schedule: false, break_minutes: 30,
    source: 'LEGACY_EMPLOYEE_FALLBACK' } };
const startOnly = { _id: '07', hmeromhnia: '2026-06-07T00:00:00.000Z',
    kathgoria_ergasias: 'ΕΡΓ', apo_ora_01: '14:38', eos_ora_01: '22:38',
    ores_ergasias: 8, cards_ores_ergasias: 0,
    cards_apo_ora_01: '14:38', cards_eos_ora_01: '', repo: false, adeia: false,
    astheneia: false, argia: false, is_locked: false, repo_apologistika: false };
ORPHAN_WEEKLY_DEPENDENT_FIELDS.forEach((field) => { startOnly[field] = 0; });
const start = resolveOrphanCardResolution({ row: startOnly, ...common,
    contextRows: [complete('2026-06-06', '14:34', '22:54'), startOnly,
        complete('2026-06-08', '12:36', '20:36')] });
assert.strictEqual(start.orphanType, 'START_ONLY');
assert.strictEqual(start.proposal.start, '14:38');
assert.strictEqual(start.proposal.end, '23:08');
assert.strictEqual(start.rest.backwardMinutes, 944);
assert.strictEqual(start.rest.forwardMinutes, 808);
assert.strictEqual(start.rest.hasViolation, false);
const startDerived = buildApprovedOrphanDerivedPreview({ row: startOnly,
    effectiveEmployee: common.effectiveEmployee, argiesDateSet: new Set(),
    approvedOrphanResolution: start });
assert.deepStrictEqual(startDerived.fields, {
    ores_ergasias_apologistika: 8, ores_pragmatikhs_ergasias_apologistika: 8,
    ores_apoysias_apologistika: 0, ores_nyxtas_apologistika: 1.13,
    ores_argion_prosayxhsh_apologistika: 8, ores_argion_ergasia_apologistika: 0,
    ores_prostheths_ergasias_apologistika: 0,
    ores_yperergasias_apologistika: 0, ores_yperergasias_nyxtas_apologistika: 0,
    ores_yperergasias_argion_apologistika: 0,
    ores_yperergasias_argion_nyxtas_apologistika: 0,
    ores_nominhs_yperorias_apologistika: 0,
    ores_nominhs_yperorias_nyxtas_apologistika: 0,
    ores_nominhs_yperorias_argion_apologistika: 0,
    ores_nominhs_yperorias_argion_nyxtas_apologistika: 0,
    ores_paranomhs_yperorias_apologistika: 0,
    ores_paranomhs_yperorias_nyxtas_apologistika: 0,
    ores_paranomhs_yperorias_argion_apologistika: 0,
    ores_paranomhs_yperorias_argion_nyxtas_apologistika: 0,
    repo_apologistika: false, adeia_apologistika: false,
    astheneia_apologistika: false, apousia_apologistika: false,
    kyriakes_apologistika: true
});

const endOnly = { _id: '15', hmeromhnia: '2026-06-15T00:00:00.000Z',
    kathgoria_ergasias: 'ΑΝ', repo: true, apo_ora_01: '', eos_ora_01: '',
    ores_ergasias: 0, cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '23:47', adeia: false,
    astheneia: false, argia: false, is_locked: false, repo_apologistika: false,
    ores_prostheths_ergasias_apologistika: 0,
    ores_yperergasias_apologistika: 0, ores_yperergasias_nyxtas_apologistika: 0,
    ores_yperergasias_argion_apologistika: 0,
    ores_yperergasias_argion_nyxtas_apologistika: 0,
    ores_nominhs_yperorias_apologistika: 0,
    ores_nominhs_yperorias_nyxtas_apologistika: 0,
    ores_nominhs_yperorias_argion_apologistika: 0,
    ores_nominhs_yperorias_argion_nyxtas_apologistika: 0,
    ores_paranomhs_yperorias_apologistika: 0,
    ores_paranomhs_yperorias_nyxtas_apologistika: 0,
    ores_paranomhs_yperorias_argion_apologistika: 0,
    ores_paranomhs_yperorias_argion_nyxtas_apologistika: 0 };
const end = resolveOrphanCardResolution({ row: endOnly, ...common,
    contextRows: [complete('2026-06-14', '14:50', '22:55'), endOnly,
        complete('2026-06-16', '14:16', '23:04')] });
assert.strictEqual(end.orphanType, 'END_ONLY');
assert.strictEqual(end.proposal.start, '15:17');
assert.strictEqual(end.proposal.end, '23:47');
assert.strictEqual(end.proposal.workDurationHours, 8);
assert.strictEqual(end.proposal.durationHours, 8.5);
assert.strictEqual(end.rest.backwardMinutes, 982);
assert.strictEqual(end.rest.forwardMinutes, 869);
assert.strictEqual(end.rest.hasViolation, false);
assert.strictEqual(end.apologistikoBookUpdate, true);
const endDerived = buildApprovedOrphanDerivedPreview({ row: endOnly,
    effectiveEmployee: common.effectiveEmployee, argiesDateSet: new Set(),
    approvedOrphanResolution: end });
assert.strictEqual(endDerived.fields.ores_ergasias_apologistika, 8);
assert.strictEqual(endDerived.fields.ores_pragmatikhs_ergasias_apologistika, 8);
assert.strictEqual(endDerived.fields.ores_apoysias_apologistika, 0);
assert.strictEqual(endDerived.fields.ores_nyxtas_apologistika, 1.78);
assert.strictEqual(endDerived.fields.repo_apologistika, false);
assert.strictEqual(endDerived.fields.kyriakes_apologistika, false);
for (const field of endDerived.weekly_dependent_fields) {
    assert.strictEqual(endDerived.fields[field], 0, field);
}
assert.strictEqual(endOnly.cards_apo_ora_01, '');
assert.strictEqual(endOnly.cards_eos_ora_01, '23:47');

console.log('0009 June 2026 orphan resolution fixture passed');
