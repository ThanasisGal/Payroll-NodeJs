'use strict';

const assert = require('assert/strict');
const {
    resolveSafeHumanRepoCandidateIdentities
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');

function row(date, overrides = {}) {
    return { hmeromhnia: date, kathgoria_ergasias: 'ΕΡΓ', repo: false,
        ores_ergasias_apologistika: 8, cards_ores_ergasias: 8,
        cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', ...overrides };
}

const rows = [
    row('2026-06-08'), row('2026-06-09'),
    row('2026-06-10', { kathgoria_ergasias: 'ΑΝ', repo: true }),
    row('2026-06-11', { ores_ergasias_apologistika: 0, cards_ores_ergasias: 0,
        cards_apo_ora_01: '', cards_eos_ora_01: '' }),
    row('2026-06-12'), row('2026-06-13'),
    row('2026-06-14', { cards_eos_ora_01: '', cards_ores_ergasias: 0 })
];
assert.deepEqual(resolveSafeHumanRepoCandidateIdentities({ rows, weekRows: rows,
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: '0' } }),
['2026-06-10', '2026-06-11']);
assert.deepEqual(resolveSafeHumanRepoCandidateIdentities({
    weekRows: rows.map((item) => ({ ...item, is_locked: true })),
    effectiveProfile: { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: '0' }
}), []);

console.log('weekly canonical repo candidate tests passed (2 contracts)');
