'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { ProdhlomenaOrariaModel: Model } = require('./ergazomenoi');
const { validTimeShiftCompensation } = require('../utils/ergazomenoi/approvedTimeShiftCompensation');
const field = 'egkekrimenh_anaplhrosh_apologistika';
const shortage = 'diastimata_elleimmatos';
const compensation = 'diastimata_anaplhroshs';
const segment = (apo_lepto, eos_lepto) => ({ apo_lepto, eos_lepto });
const fact = (s = [segment(720, 840)], c = [segment(960, 1080)], m = 120, r = 0) => ({
    [shortage]: s, [compensation]: c, antistoixismena_lepta: m, ypoloipomena_lepta: r
});

test('optional typed fact defaults to null on construction and hydration', async () => {
    for (const doc of [new Model(), Model.hydrate({}), new Model({ [field]: null })]) {
        await doc.validate();
        assert.equal(doc[field], null);
    }
    const schema = Model.schema.path(field).schema;
    assert.equal(schema.options._id, false);
    for (const key of [shortage, compensation]) {
        const path = schema.path(key);
        assert.equal(path.instance, 'Array');
        assert.equal(path.schema.options._id, false);
        for (const bound of ['apo_lepto', 'eos_lepto']) {
            assert.equal(path.schema.path(bound).instance, 'Number');
            assert.equal(path.schema.path(bound).isRequired, true);
        }
    }
    assert.deepEqual(new Model({ [field]: {} }).toObject()[field], fact([], [], 0, 0));
    assert.equal(mongoose.connection.readyState, 0);
});

for (const [name, value] of [
    ['empty', fact([], [], 0, 0)],
    ['full', fact()],
    ['partial', fact(undefined, [segment(960, 1020)], 60, 60)],
    ['none', fact(undefined, [], 0, 120)],
    ['multiple', fact([segment(660, 720), segment(840, 900)],
        [segment(1080, 1140), segment(1170, 1230)])],
    ['overnight', fact([segment(1500, 1560)], [segment(1800, 1860)], 60)],
    ['adjacent', fact([segment(720, 780), segment(780, 840)],
        [segment(960, 1020), segment(1020, 1080)])],
    ['no duration ceiling', fact([segment(0, Number.MAX_SAFE_INTEGER)], [], 0, Number.MAX_SAFE_INTEGER)]
]) test(`${name} round-trips exactly without calculation writes or DB connection`, async () => {
    const original = structuredClone(value);
    assert.equal(validTimeShiftCompensation(value), true);
    const doc = new Model({ [field]: value });
    await doc.validate();
    assert.deepEqual(doc.toObject()[field], original);
    const restored = Model.hydrate(doc.toObject());
    await restored.validate();
    assert.deepEqual(restored.toObject()[field], original);
    assert.deepEqual(value, original);
    assert.equal(restored.egkekrimenh_oroadeia_apologistika, false);
    assert.equal(restored.explicit_hourly_leave_hours, 0);
    assert.equal(restored.compensation_breakdown_apologistika, null);
    assert.equal(restored.apo_ora_01_apologistika, undefined);
    assert.equal(mongoose.connection.readyState, 0);
});

for (const key of [shortage, compensation]) {
    for (const [name, invalid] of [
        ['negative', [segment(-1, 120)]],
        ['fractional start', [segment(0.5, 120)]],
        ['fractional end', [segment(0, 120.5)]],
        ['unsafe', [segment(0, Number.MAX_SAFE_INTEGER + 1)]],
        ['zero', [segment(120, 120)]],
        ['reversed', [segment(120, 0)]],
        ['overlap', [segment(0, 70), segment(60, 110)]],
        ['unordered', [segment(60, 120), segment(0, 60)]],
        ['object', segment(0, 120)], ['null', null], ['string', '0-120'],
        ['missing bound', [{ apo_lepto: 0 }]], ['null segment', [null]]
    ]) test(`${key} rejects ${name} without changing input`, async () => {
        const value = { ...fact(), [key]: invalid };
        const original = structuredClone(value);
        assert.equal(validTimeShiftCompensation(value), false);
        await assert.rejects(new Model({ [field]: value }).validate());
        assert.deepEqual(value, original);
    });
}
for (const key of ['antistoixismena_lepta', 'ypoloipomena_lepta']) {
    for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, null, Infinity]) {
        test(`${key} rejects ${value}`, async () => {
            await assert.rejects(new Model({ [field]: { ...fact(), [key]: value } }).validate());
        });
    }
}
for (const [name, value] of [
    ['compensation sum', fact(undefined, [segment(960, 1020)])],
    ['shortage sum', fact(undefined, undefined, 120, 1)],
    ['matched exceeds shortage', fact([segment(720, 780)])],
    ['empty with nonzero totals', fact([], [], 0, 1)]
]) test(`rejects inconsistent ${name}`, async () => {
    await assert.rejects(new Model({ [field]: value }).validate());
});
test('revalidation catches nested edits and invalid hydrated order', async () => {
    const doc = new Model({ [field]: fact() });
    await doc.validate();
    doc[field][compensation][0].eos_lepto++;
    assert.ok(doc.validateSync());
    await assert.rejects(doc.validate());
    const value = fact([segment(840, 900), segment(660, 720)]);
    const restored = Model.hydrate({ [field]: value });
    await assert.rejects(restored.validate());
    assert.deepEqual(restored.toObject()[field], value);
    assert.equal(mongoose.connection.readyState, 0);
});
