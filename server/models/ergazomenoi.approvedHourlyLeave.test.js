'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { ProdhlomenaOrariaModel } = require('./ergazomenoi');

const fields = {
    egkekrimenh_oroadeia_apologistika: 'Boolean',
    apo_ora_egkekrimenhs_oroadeias_apologistika: 'String',
    eos_ora_egkekrimenhs_oroadeias_apologistika: 'String',
    explicit_hourly_leave_hours: 'Number'
};

test('daily approved hourly leave has typed paths and safe defaults without inferred credits', () => {
    for (const [field, type] of Object.entries(fields)) assert.equal(ProdhlomenaOrariaModel.schema.path(field)?.instance, type);
    for (const doc of [new ProdhlomenaOrariaModel(), ProdhlomenaOrariaModel.hydrate({ ores_ergasias: 8 })]) {
        assert.equal(doc.egkekrimenh_oroadeia_apologistika, false);
        assert.equal(doc.explicit_hourly_leave_hours, 0);
        assert.equal(doc.apo_ora_egkekrimenhs_oroadeias_apologistika, undefined);
        assert.equal(doc.eos_ora_egkekrimenhs_oroadeias_apologistika, undefined);
    }
    assert.equal(mongoose.connection.readyState, 0);
});

test('explicit daily hourly leave values survive validation and hydration without setting full-day leave', async () => {
    const values = { egkekrimenh_oroadeia_apologistika: true,
        apo_ora_egkekrimenhs_oroadeias_apologistika: '12:00',
        eos_ora_egkekrimenhs_oroadeias_apologistika: '13:30', explicit_hourly_leave_hours: 1.5 };
    const doc = new ProdhlomenaOrariaModel(values);
    await doc.validate(); // In-memory only: never save or connect.
    const restored = ProdhlomenaOrariaModel.hydrate(doc.toObject());
    for (const [field, value] of Object.entries(values)) assert.equal(restored[field], value);
    assert.equal(restored.adeia_apologistika, false);
    assert.equal(restored.kathgoria_adeias_apologistika, undefined);
    assert.equal(restored.ores_adeias_pistomenes_apologistika, 0);
    assert.equal(mongoose.connection.readyState, 0);
});
