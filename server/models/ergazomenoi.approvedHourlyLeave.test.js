'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { ProdhlomenaOrariaModel } = require('./ergazomenoi');
const { validApprovedHourlyLeaveSegments } = require('../utils/ergazomenoi/approvedHourlyLeaveSegments');
const segmentField = 'egkekrimena_diastimata_oroadeias_apologistika';

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
        assert.deepEqual(doc.toObject()[segmentField], []);
    }
    assert.equal(mongoose.connection.readyState, 0);
});

test('segment schema is typed, required, has no subdocument ids and independent defaults', () => {
    const path = ProdhlomenaOrariaModel.schema.path(segmentField);
    assert.equal(path.instance, 'Array');
    assert.equal(path.schema.options._id, false);
    for (const field of ['apo_lepto', 'eos_lepto']) {
        assert.equal(path.schema.path(field).instance, 'Number');
        assert.equal(path.schema.path(field).isRequired, true);
    }
    const first = new ProdhlomenaOrariaModel();
    first[segmentField].push({ apo_lepto: 0, eos_lepto: 1 });
    assert.deepEqual(new ProdhlomenaOrariaModel().toObject()[segmentField], []);
});

const segment = (apo_lepto, eos_lepto) => ({ apo_lepto, eos_lepto });
for (const [name, segments] of [
    ['empty', []],
    ['single', [segment(720, 840)]],
    ['disjoint', [segment(660, 720), segment(840, 900)]],
    ['overnight', [segment(1380, 1500)]],
    ['multiple next-day segments', [segment(1500, 1560), segment(1600, 1700)]],
    ['adjacent', [segment(0, 60), segment(60, 120)]],
    ['no invented duration ceiling', [segment(0, Number.MAX_SAFE_INTEGER)]]
]) test(`approved hourly leave segments: ${name} validates and hydrates losslessly`, async () => {
    const before = structuredClone(segments);
    assert.equal(validApprovedHourlyLeaveSegments(segments), true);
    const doc = new ProdhlomenaOrariaModel({ [segmentField]: segments });
    await doc.validate();
    const restored = ProdhlomenaOrariaModel.hydrate(doc.toObject());
    await restored.validate();
    assert.deepEqual(restored.toObject()[segmentField], before);
    assert.deepEqual(segments, before);
    // Stage 1B stores segments only: no implicit calculation writes to other facts.
    assert.equal(doc.egkekrimenh_oroadeia_apologistika, false);
    assert.equal(doc.explicit_hourly_leave_hours, 0);
    assert.equal(doc.apo_ora_egkekrimenhs_oroadeias_apologistika, undefined);
    assert.equal(doc.eos_ora_egkekrimenhs_oroadeias_apologistika, undefined);
    assert.equal(doc.apo_ora_01_apologistika, undefined);
    assert.equal(doc.compensation_breakdown_apologistika, null);
    assert.equal(mongoose.connection.readyState, 0);
});

for (const [name, segments] of [
    ['negative start', [segment(-1, 60)]],
    ['fractional start', [segment(0.5, 60)]],
    ['fractional end', [segment(0, 60.5)]],
    ['unsafe start', [segment(Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 2)]],
    ['unsafe end', [segment(0, Number.MAX_SAFE_INTEGER + 1)]],
    ['infinite end', [segment(0, Infinity)]],
    ['NaN start', [segment(NaN, 60)]],
    ['missing start', [{ eos_lepto: 60 }]],
    ['missing end', [{ apo_lepto: 0 }]],
    ['null start', [segment(null, 60)]],
    ['zero duration', [segment(60, 60)]],
    ['reversed', [segment(60, 0)]],
    ['overlap', [segment(660, 730), segment(720, 900)]],
    ['out of order', [segment(840, 900), segment(660, 720)]],
    ['null array', null],
    ['non-array', segment(0, 60)],
    ['null segment', [null]]
]) test(`approved hourly leave segments reject ${name} in memory`, async () => {
    const before = structuredClone(segments);
    assert.equal(validApprovedHourlyLeaveSegments(segments), false);
    const doc = new ProdhlomenaOrariaModel({ [segmentField]: segments });
    await assert.rejects(doc.validate());
    assert.deepEqual(segments, before);
    assert.equal(mongoose.connection.readyState, 0);
});

test('validation catches overlapping in-place edits and unordered hydrated segments', async () => {
    const doc = new ProdhlomenaOrariaModel({ [segmentField]: [segment(660, 720), segment(840, 900)] });
    doc[segmentField][1].apo_lepto = 710;
    await assert.rejects(doc.validate());
    const restored = ProdhlomenaOrariaModel.hydrate({ [segmentField]: [segment(840, 900), segment(660, 720)] });
    await assert.rejects(restored.validate());
    assert.deepEqual(restored.toObject()[segmentField], [segment(840, 900), segment(660, 720)]);
});

test('future zero/single/multiple writer payloads round-trip without deriving or losing facts', async () => {
    for (const [segments, enabled, start, end, hours] of [
        [[], false, '', '', 0],
        [[segment(720, 840)], true, '12:00', '14:00', 2],
        [[segment(660, 720), segment(840, 900)], true, '', '', 2]
    ]) {
        const payload = { [segmentField]: segments, egkekrimenh_oroadeia_apologistika: enabled,
            apo_ora_egkekrimenhs_oroadeias_apologistika: start,
            eos_ora_egkekrimenhs_oroadeias_apologistika: end, explicit_hourly_leave_hours: hours };
        const doc = new ProdhlomenaOrariaModel(payload);
        await doc.validate();
        const restored = ProdhlomenaOrariaModel.hydrate(doc.toObject()).toObject();
        for (const key of Object.keys(payload)) assert.deepEqual(restored[key], payload[key]);
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
