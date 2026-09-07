'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const H = require('../../utils/ergazomenoi/employmentProfileHistory');
const { resolveBreakConfigurationForDate: resolveBreak } = require('../../utils/ergazomenoi/resolveBreakConfigurationForDate');
const { getOrarioTermsForDate: resolveTerms } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { buildEmploymentPeriodFrozenSnapshot: freeze } = require('./apasxoliseisPeriodFrozenSnapshotService');

const json = value => JSON.parse(JSON.stringify(value));
function fixture() {
    const observed = { kodikos: 'fixture', dialleima_se_lepta: 30,
        dialleima_entos_ektos_orarioy: false, hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        kathestos_apasxolhshs: '0', typos_apasxolhshs: '0' };
    const legacy = { _id: 'legacy-fixture', kodikos: observed.kodikos,
        afora_allagh_dialleimatos: true, hmeromhnia_isxyos_dialleimatos_apo: '2026-06-01',
        dialleima_se_lepta: 25, dialleima_entos_ektos_orarioy: false };
    const v1 = { ...H.buildCompleteProfileSnapshot({ current: observed,
        input: { dialleima_se_lepta: 15 }, effectiveFrom: '2026-09-15' }),
        _id: 'v1-fixture', kodikos: observed.kodikos,
        ores_ergasias_ebdomadas: 32, hmeres_ergasias_ebdomadas: 4,
        kathestos_apasxolhshs: '1', typos_apasxolhshs: '1',
        hmeromhnia_allaghs_orarioy_eos: '2026-09-30' };
    const current = { ...observed, ...v1,
        [T.ANCHOR]: T.capture(observed, [legacy], '2026-09-15') };
    return { observed, legacy, v1, current, history: [legacy, v1] };
}
function freezeContext(current, history) {
    const result = freeze({ employees: [current], profileHistory: history,
        dailyResults: [{ kodikos: current.kodikos, hmeromhnia: '2026-06-15' }] });
    return { ...result, current: result.snapshot.employees[0],
        history: result.snapshot.weekly_calculation_context.profile_history };
}
function parity(date, current, history) {
    const frozen = freezeContext(current, history);
    assert.deepEqual(resolveBreak(date, frozen.history, frozen.current), resolveBreak(date, history, current));
    assert.deepEqual(json(resolveTerms(date, frozen.history, frozen.current)), json(resolveTerms(date, history, current)));
    return resolveBreak(date, frozen.history, frozen.current);
}

test('explicit legacy break wins over anchor before and after freezing, including V1 boundary', () => {
    const { current, history } = fixture();
    const before = json({ current, history });
    for (const date of ['2026-06-15', '2026-09-14', '2026-09-15']) {
        const result = parity(date, current, history);
        assert.equal(result.break_minutes, date < '2026-09-15' ? 25 : 15);
        assert.equal(result.source, 'BREAK_CONFIGURATION_HISTORY');
        assert.equal(result.history_id, date < '2026-09-15' ? 'legacy-fixture' : 'v1-fixture');
    }
    assert.deepEqual(json({ current, history }), before, 'serialization does not mutate input');
});

test('legacy provenance survives without fabricated versions, arrangements, dates or break pairs', () => {
    const { current, history, legacy } = fixture();
    const row = freezeContext(current, history).history.find(item => item._id === legacy._id);
    assert.deepEqual(row, legacy);
    assert.equal(T.complete(row), false);
    assert.equal(T.versioned(row), false);
    for (const field of [C.SCHEMA_VERSION, ...C.ARRANGEMENT_FIELDS, T.START, T.END, ...C.BREAK_PAIRS.flat()]) {
        assert.equal(Object.hasOwn(row, field), false, field);
    }
});

test('anchor remains fallback when explicit legacy history is absent or not yet applicable', () => {
    const { current, history, v1 } = fixture();
    for (const [date, rows] of [['2026-06-15', [v1]], ['2026-05-31', history]]) {
        const result = parity(date, current, rows);
        assert.equal(result.break_minutes, 30);
        assert.equal(result.source, 'PRE_V1_COMPATIBILITY_ANCHOR');
    }
});

test('legacy month-start eligibility is unchanged by serialization', () => {
    const { current, legacy, v1 } = fixture();
    const result = parity('2026-06-15', current, [{ ...legacy, hmeromhnia_isxyos_dialleimatos_apo: '2026-06-02' }, v1]);
    assert.equal(result.break_minutes, 30);
    assert.equal(result.source, 'PRE_V1_COMPATIBILITY_ANCHOR');
});

test('pure legacy explicit break resolution retains its meaning without V1 evidence', () => {
    const { observed, legacy } = fixture();
    const result = parity('2026-06-15', observed, [legacy]);
    assert.equal(result.break_minutes, 25);
    assert.equal(result.source, 'BREAK_CONFIGURATION_HISTORY');
    assert.equal(T.versioned(freezeContext(observed, [legacy]).current), false);
});

test('ordinary pure legacy snapshot and fingerprint match the pre-fix implementation', () => {
    const module = { exports: {} };
    const source = execFileSync('git', ['show',
        '36a0a1c731e45896a4a1533d9311c9cb2049981c:server/services/ergazomenoi/apasxoliseisPeriodFrozenSnapshotService.js'], { encoding: 'utf8' });
    vm.runInNewContext(source, { module, require: id => id === 'crypto' ? require('node:crypto') : T, Date });
    const { observed } = fixture();
    const input = { employees: [observed], profileHistory: [{ ...observed,
        _id: 'ordinary-legacy', hmeromhnia_allaghs_orarioy_apo: '2026-01-01',
        hmeromhnia_allaghs_orarioy_eos: '2026-12-31', localNote: 'not projected' }],
        dailyResults: [{ kodikos: observed.kodikos, hmeromhnia: '2026-06-15' }] };
    assert.deepEqual(json(freeze(input)), json(module.exports.buildEmploymentPeriodFrozenSnapshot(input)));
});

test('complete V1 stays complete and null end remains open beyond schedule-generation end', () => {
    const { current, history } = fixture();
    const v1 = freezeContext(current, history).history.find(row => row._id === 'v1-fixture');
    assert.equal(T.complete(v1), true);
    assert.equal(v1[T.END], null);
    for (const date of ['2026-10-01', '2026-12-01']) {
        const result = parity(date, current, history);
        assert.equal(result.break_minutes, 15);
        assert.equal(result.history_id, v1._id);
    }
});

test('explicit legacy standard work terms and later V1 terms retain full frozen parity', () => {
    const { current, history } = fixture();
    history[0] = { ...history[0], afora_allagh_oron_ergasias: true,
        hmeromhnia_allaghs_orarioy_apo: '2026-06-01', hmeromhnia_allaghs_orarioy_eos: '2026-09-14',
        ores_ergasias_ebdomadas: 35, hmeres_ergasias_ebdomadas: 5, kathestos_apasxolhshs: '0' };
    for (const date of ['2026-06-15', '2026-09-14', '2026-09-15', '2026-12-01']) {
        parity(date, current, history);
        const result = resolveTerms(date, history, current);
        assert.equal(result.ores_ergasias_ebdomadas, date < '2026-09-15' ? 35 : 32);
        assert.equal(result.hmeres_ergasias_ebdomadas, date < '2026-09-15' ? 5 : 4);
        assert.equal(result.kathestos_apasxolhshs, date < '2026-09-15' ? '0' : '1');
    }
});
