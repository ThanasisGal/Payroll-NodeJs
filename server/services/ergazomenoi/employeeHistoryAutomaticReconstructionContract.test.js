'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const C = require('./employeeHistoryAutomaticReconstructionContract');

test('every persisted History path has exactly one explicit classification and profile type', () => {
    const paths = IstorikoProslhpseonAllagonModel.schema.paths;
    const classified = [...Object.values(C.FIELD_GROUPS).flat(), ...C.PROFILE_FIELDS];
    assert.equal(new Set(classified).size, classified.length, 'no duplicate classifications');
    assert.deepEqual([...classified].sort(), Object.keys(paths).sort(), 'new schema paths require a deliberate decision');
    for (const field of C.PROFILE_FIELDS) assert.equal(C.PROFILE_FIELD_TYPES[field], paths[field].instance, field);
    assert.equal(Object.keys(C.FIELD_CLASSIFICATION).length, classified.length);
    assert.equal(classified.length, 118, 'display/schema coverage stays 118/118 independently of physical proposals');
});

test('schedule dates are exclusively informational and identity/metadata fields cannot be reconstructed', () => {
    for (const field of ['hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos']) {
        assert.equal(C.FIELD_CLASSIFICATION[field], 'INFORMATIONAL');
        assert.ok(!C.FIELD_GROUPS.TEMPORAL_SEMANTIC.includes(field));
        assert.ok(!C.PROFILE_FIELDS.includes(field));
    }
    for (const field of [...C.FIELD_GROUPS.IDENTITY_PROTECTED, ...C.FIELD_GROUPS.CANONICAL_METADATA]) {
        assert.ok(!C.PROFILE_FIELDS.includes(field), field);
    }
});
