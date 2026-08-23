'use strict';

const assert = require('assert');
const { buildBreakConfigurationHistoryChange, resolveBreakConfigurationForDate } =
    require('./resolveBreakConfigurationForDate');
const {
    resolveOrphanCardResolution
} = require('../../services/ergazomenoi/apasxoliseisOrphanCardResolutionService');

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

assert.throws(() => buildBreakConfigurationHistoryChange({
    currentEmployee: { dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 30 },
    formData: { dialleima_entos_ektos_orarioy: true, dialleima_se_lepta: 20,
        hmeromhnia_metabolhs: '2026-07-15' }
}), (error) => error.code === 'BREAK_CONFIGURATION_EFFECTIVE_DATE_MUST_BE_MONTH_START');
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

console.log('month-effective break configuration resolver tests passed');
