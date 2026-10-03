'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ProdhlomenaOrariaModel } = require('./ergazomenoi');

test('emergency hourly leave defaults are separate from agreement fields', () => {
    const row = new ProdhlomenaOrariaModel();
    assert.equal(row.ektakth_oroadeia_apologistika, false);
    assert.deepEqual(row.ektakta_diastimata_oroadeias_apologistika.toObject(), []);
    assert.equal(row.ores_ektakths_oroadeias_apologistika, 0);
    assert.equal(row.hr_daily_actual_work_resolution, null);
});
test('emergency hourly leave validates same-day ordered non-overlapping minutes', () => {
    const valid = new ProdhlomenaOrariaModel({ ektakta_diastimata_oroadeias_apologistika: [
        { apo_lepto: 600, eos_lepto: 630 }, { apo_lepto: 780, eos_lepto: 840 }
    ] });
    assert.equal(valid.validateSync(), undefined);
    const invalid = new ProdhlomenaOrariaModel({ ektakta_diastimata_oroadeias_apologistika: [
        { apo_lepto: 600, eos_lepto: 700 }, { apo_lepto: 650, eos_lepto: 800 }
    ] });
    assert.ok(invalid.validateSync()?.errors?.ektakta_diastimata_oroadeias_apologistika);
});
