'use strict';

const assert = require('assert');
const { buildBreakConfigurationHistoryChange, resolveBreakConfigurationForDate } =
    require('./resolveBreakConfigurationForDate');
const {
    resolveOrphanCardResolution
} = require('../../services/ergazomenoi/apasxoliseisOrphanCardResolutionService');

const { buildCompleteProfileSnapshot } = require('./employmentProfileHistory');
const C = require('./employmentProfileContract');

const history = [
    { _id: 'june', aa_eggrafhs: '0002', afora_allagh_dialleimatos: true,
        hmeromhnia_isxyos_dialleimatos_apo: new Date('2026-06-01T00:00:00Z'),
        dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30 },
    { _id: 'july', aa_eggrafhs: '0003', afora_allagh_dialleimatos: true,
        hmeromhnia_isxyos_dialleimatos_apo: new Date('2026-07-01T00:00:00Z'),
        dialleima_entos_ektos_orarioy: true, dialleima_se_lepta: 20 }
];
for (const [date, inside, minutes, source] of [
    ['2026-06-14', false, 30, 'BREAK_CONFIGURATION_HISTORY'],
    ['2026-06-30', false, 30, 'BREAK_CONFIGURATION_HISTORY'],
    ['2026-07-01', true, 20, 'BREAK_CONFIGURATION_HISTORY'],
    ['2026-07-31', true, 20, 'BREAK_CONFIGURATION_HISTORY']
]) {
    const result = resolveBreakConfigurationForDate(date, history, {});
    assert.strictEqual(result.break_inside_schedule, inside);
    assert.strictEqual(result.break_minutes, minutes);
    assert.strictEqual(result.source, source);
}
const legacy = resolveBreakConfigurationForDate('2026-06-14', [], {
    dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30
});
assert.strictEqual(legacy.source, 'LEGACY_EMPLOYEE_FALLBACK');
assert.strictEqual(legacy.break_inside_schedule, false);
assert.strictEqual(legacy.break_minutes, 30);

const midMonthChange = buildBreakConfigurationHistoryChange({
    currentEmployee: { dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30 },
    formData: { dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 15,
        hmeromhnia_metabolhs: '2026-07-15' }
});
const completeMidMonth = buildCompleteProfileSnapshot({
    input: midMonthChange.snapshot, effectiveFrom: '2026-07-15'
});
assert.strictEqual(midMonthChange.effectiveFrom.toISOString(), '2026-07-15T00:00:00.000Z');
assert.strictEqual(resolveBreakConfigurationForDate('2026-07-14',
    [...history, completeMidMonth], {}).break_minutes, 20);
assert.strictEqual(resolveBreakConfigurationForDate('2026-07-15',
    [...history, completeMidMonth], {}).break_minutes, 15);
assert.strictEqual(resolveBreakConfigurationForDate('2026-07-16',
    [...history, completeMidMonth], {}).break_minutes, 15);
const change = buildBreakConfigurationHistoryChange({
    currentEmployee: { dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30 },
    formData: { dialleima_entos_ektos_orarioy: true, dialleima_se_lepta: 20,
        hmeromhnia_metabolhs: '2026-07-01' }
});
assert.strictEqual(change.changed, true);
assert.strictEqual(change.snapshot.hmeromhnia_isxyos_dialleimatos_apo.toISOString(),
    '2026-07-01T00:00:00.000Z');

function orphan(date) {
    return { _id: date, hmeromhnia: `${date}T00:00:00.000Z`,
        apo_ora_01: '14:51', eos_ora_01: '22:51', apo_ora_02: '', eos_ora_02: '',
        apo_ora_03: '', eos_ora_03: '', ores_ergasias: 8,
        cards_apo_ora_01: '14:51', cards_eos_ora_01: '',
        cards_apo_ora_02: '', cards_eos_ora_02: '', cards_apo_ora_03: '', cards_eos_ora_03: '' };
}
const juneRow = orphan('2026-06-14');
const juneBreak = resolveBreakConfigurationForDate(juneRow.hmeromhnia, history, {});
const juneDecision = resolveOrphanCardResolution({ row: juneRow, contextRows: [juneRow],
    breakConfiguration: juneBreak, reuseScope: 'FUTURE_IDENTICAL' });
assert.strictEqual(juneDecision.proposal.end, '23:21');
const julyRow = orphan('2026-07-14');
const julyBreak = resolveBreakConfigurationForDate(julyRow.hmeromhnia, history, {});
const julyDecision = resolveOrphanCardResolution({ row: julyRow, contextRows: [julyRow],
    breakConfiguration: julyBreak, reusableRule: juneDecision.reusableDecisionRule });
assert.strictEqual(julyDecision.proposal.end, '22:51');
assert.strictEqual(julyDecision.canAutomaticReuse, true);

console.log('calendar-effective break configuration resolver tests passed');

// A non-month-start LEGACY row was ineligible before foundation and stays so.
const legacyMidMonth = { _id: 'legacy-mid', aa_eggrafhs: '9999', ...midMonthChange.snapshot };
for (const date of ['2026-07-14', '2026-07-15', '2026-07-31', '2026-08-01']) {
    const resolved = resolveBreakConfigurationForDate(date, [...history, legacyMidMonth], {});
    assert.strictEqual(resolved.history_id, 'july');
    assert.strictEqual(resolved.break_minutes, 20);
}
// Merely adding a version/default to an incomplete old record cannot certify V1.
assert.strictEqual(resolveBreakConfigurationForDate('2026-07-16', [...history,
    { ...legacyMidMonth, [C.SCHEMA_VERSION]: 1 }], {}).history_id, 'july');
// Legacy month-start rows ignore profile-end dates as they did in the baseline.
assert.strictEqual(resolveBreakConfigurationForDate('2026-07-31',
    [{ ...history[1], hmeromhnia_isxyos_oron_ergasias_eos: '2026-07-02' }], {}).history_id, 'july');
const bounded = { ...completeMidMonth, hmeromhnia_isxyos_oron_ergasias_eos: '2026-07-20' };
assert.strictEqual(resolveBreakConfigurationForDate('2026-07-20', [bounded], {}).break_minutes, 15);
assert.strictEqual(resolveBreakConfigurationForDate('2026-07-21', [bounded], {}).source, 'LEGACY_EMPLOYEE_FALLBACK');
