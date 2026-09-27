'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(__dirname + '/dokimastikhPeriodos_Blur.js', 'utf8');

function field(name, value = '') {
    const listeners = new Map();
    return {
        id: name,
        name,
        value,
        addEventListener(event, listener) { listeners.set(event, listener); },
        async dispatch(event) { return listeners.get(event)?.call(this, { type: event }); }
    };
}

function browser({ trial, hire = '2026-01-01', contract = '2026-10-31', relationship = '0' }) {
    const fields = {
        hmnia_lhxhs_dokimastikhs_periodoy: field('hmnia_lhxhs_dokimastikhs_periodoy', trial),
        hmeromhnia_proslhpshs: field('hmeromhnia_proslhpshs', hire),
        hmeromhnia_lhxhs_symbashs: field('hmeromhnia_lhxhs_symbashs', contract),
        sxesh_ergasias_stathera: field('sxesh_ergasias_stathera', relationship)
    };
    let ready;
    const document = {
        addEventListener(event, listener) { if (event === 'DOMContentLoaded') ready = listener; },
        getElementById(id) { return fields[id] || null; }
    };
    vm.runInNewContext(source, {
        document,
        Swal: { fire: async () => ({ isConfirmed: true }) },
        Date,
        setTimeout,
        clearTimeout
    }, { filename: 'dokimastikhPeriodos_Blur.js' });
    ready();
    return fields;
}

function serialize(fields) {
    return Object.fromEntries(Object.values(fields).map(input => [input.name, input.value]));
}

test('changing a valid trial-period end never changes contract end', async () => {
    const fields = browser({ trial: '2026-02-01' });
    await fields.hmnia_lhxhs_dokimastikhs_periodoy.dispatch('blur');
    assert.equal(fields.hmnia_lhxhs_dokimastikhs_periodoy.value, '2026-02-01');
    assert.equal(fields.hmeromhnia_lhxhs_symbashs.value, '2026-10-31');
});

test('accepting a suggested trial-period date changes only the trial-period field', async () => {
    const fields = browser({ trial: '2026-04-01', contract: '2026-05-01', relationship: '1' });
    await fields.hmnia_lhxhs_dokimastikhs_periodoy.dispatch('blur');
    assert.equal(fields.hmnia_lhxhs_dokimastikhs_periodoy.value, '2026-01-31');
    assert.equal(fields.hmeromhnia_lhxhs_symbashs.value, '2026-05-01');
});

test('tabbing through the trial-period field cannot mutate contract end', async () => {
    const fields = browser({ trial: '2026-03-01', contract: '2026-12-31' });
    await fields.hmnia_lhxhs_dokimastikhs_periodoy.dispatch('blur');
    assert.equal(fields.hmeromhnia_lhxhs_symbashs.value, '2026-12-31');
});

test('form serialization preserves contract end unless that field is explicitly edited', async () => {
    const fields = browser({ trial: '2026-04-01', contract: '2026-05-31', relationship: '1' });
    await fields.hmnia_lhxhs_dokimastikhs_periodoy.dispatch('blur');
    assert.equal(serialize(fields).hmeromhnia_lhxhs_symbashs, '2026-05-31');
    fields.hmeromhnia_lhxhs_symbashs.value = '2026-06-30';
    assert.equal(serialize(fields).hmeromhnia_lhxhs_symbashs, '2026-06-30');
});

test('trial-period browser code contains no assignment to contract end', () => {
    assert.doesNotMatch(source, /hmeromhniaLhxhsSymbashs\.value\s*=/);
});
