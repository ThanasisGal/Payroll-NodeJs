'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('./employmentProfileContract');
const T = require('./employmentProfileTemporal');
const { IDENTITY_FIELDS, TRANSITION_FIELDS, semanticEmploymentProfileChanged: changed } = require('./employmentProfileTransition');

test('all standard terms, user facts and identity dates participate; server metadata never does', () => {
    for (const field of [...T.STANDARD_FIELDS, ...C.FACT_FIELDS.filter(field => ![C.SCHEMA_VERSION, C.TYPE_VERSION].includes(field)), ...IDENTITY_FIELDS]) {
        assert(TRANSITION_FIELDS.includes(field), field);
    }
    for (const field of [C.SCHEMA_VERSION, C.TYPE_VERSION, T.ANCHOR]) {
        assert(!TRANSITION_FIELDS.includes(field), field);
        assert.equal(changed({}, {}, { [field]: field === T.ANCHOR ? { facts: {} } : 1 }), false);
    }
});
test('every neutral new field representation is equivalent to physical absence', () => {
    for (const value of [null, '']) for (const field of [C.TYPE, C.FROM, C.UNTIL, C.START, C.END, C.CATEGORY, ...C.BREAK_PAIRS.flat()]) {
        assert.equal(changed({}, {}, { [field]: value }), false, field);
    }
    assert.equal(changed({}, {}, { [C.ENABLED]: false, [C.DAYS]: [] }), false);
    assert.equal(changed({}, {}, { dialleima_se_lepta: 0, evelikth_proselefsh: 0, symbatikes_ores_ergasias: 0 }), false);
});
test('unchanged canonical aliases, numeric strings and derived average retain legacy semantics', () => {
    const current = { kathestos_apasxolhshs: 'FULL_TIME', hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        apasxolhsh_basei_symbashs: '5HMERH', dialleima_se_lepta: 30 };
    assert.equal(changed(current, { historyChanges: { kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
        typos_ebdomadas: '5HMERH', hmeres_ergasias_ebdomadas: '5', ores_ergasias_ebdomadas: '40', mo_oron_hmerhsias_ergasias: 8,
        apasxolhsh_basei_symbashs: '5' } }, { dialleima_se_lepta: '30' }), false);
});
for (const field of T.STANDARD_FIELDS) test(`a real standard-term change is detected: ${field}`, () => {
    const types = ['kathestos_apasxolhshs', 'typos_apasxolhshs'];
    const codes = ['eidikh_kathgoria_ergazomenoy', 'eidikh_periptosh', 'typos_ergazomenon'];
    const before = types.includes(field) ? '0' : codes.includes(field) ? 'old-code' : 5;
    const after = types.includes(field) ? '1' : codes.includes(field) ? 'new-code' : 4;
    assert.equal(changed({ [field]: before }, { employeeChanges: { [field]: after } }), true);
});
for (const field of IDENTITY_FIELDS) test(`only an actual identity date change drives transition: ${field}`, () => {
    const current = { [field]: '2026-04-01' };
    assert.equal(changed(current, { identity: { [field]: new Date('2026-04-01') } }), false);
    assert.equal(changed(current, { identity: { [field]: '2026-09-15' } }), true);
});
test('existing schedule start is equivalent to a serialized canonical effective start', () => {
    assert.equal(changed({ hmeromhnia_allaghs_orarioy_apo: '2026-04-01' }, {
        identity: { [T.START]: '2026-04-01', [T.END]: null }
    }), false);
});
test('non-neutral first scalar values and boolean toggles are genuine transitions', () => {
    for (const field of ['dialleima_se_lepta', 'evelikth_proselefsh', 'symbatikes_ores_ergasias']) assert.equal(changed({}, {}, { [field]: 20 }), true, field);
    for (const field of [C.ENABLED, 'synexes_diakekomeno', 'typos_orarioy', 'dialleima_entos_ektos_orarioy']) assert.equal(changed({ [field]: false }, {}, { [field]: true }), true, field);
});
test('malformed neutral-looking input fails closed', () => {
    assert.throws(() => changed({}, {}, { [C.DAYS]: [''] }), /weekdays/);
    assert.throws(() => changed({}, {}, { [C.ENABLED]: 'no' }), /boolean/);
});
