'use strict';

const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { BSON } = require('mongoose').mongo;
const { syntheticProtectionStore, row } = require('../../../test/fixtures/employeeHistoryProtectionSyntheticReadStore');
const { readLegacyProtection } = require('./employeeHistoryLegacyProtectionService');
before(() => require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());

test('διατήρηση περιόδων: δύο σειριακές αναγνώσεις διατηρούν πλήρη δεδομένα και ακριβή αποτυπώματα BSON', async () => {
    const control = row({ status: 'FINALIZED', reference: new BSON.ObjectId('650000000000000000000002') });
    const snapshot = row({ frozen_snapshot: { amount: BSON.Decimal128.fromString('1234.56'),
        data: Buffer.from([1, 2, 3]), nullable: null, work: [new BSON.Int32(480)] } });
    const store = syntheticProtectionStore({ controls: [control], snapshots: [snapshot] });
    const result = await readLegacyProtection({ ...store, period: { from: '2026-01-01', to: null }, preserveOriginal: true });
    assert.equal(result.uncertain, false);
    assert.deepEqual(result.controls, [BSON.deserialize(BSON.serialize(control))]);
    assert.deepEqual(result.snapshots, [BSON.deserialize(BSON.serialize(snapshot))]);
    assert.equal(store.reads.length, 2);
    assert.ok(store.reads.every(read => read.raw));
    for (const [index, document] of [control, snapshot].entries()) {
        assert.equal(result.wire[index].sha256, crypto.createHash('sha256').update(BSON.serialize(document)).digest('hex'));
        assert.equal(result.wire[index].identityBson, BSON.serialize({ _id: document._id }).toString('base64'));
    }
});

test('η τεκμηρίωση διατήρησης περιλαμβάνει και μη επικαλυπτόμενες περιόδους χωρίς κοινή προσωρινή αποθήκευση', async () => {
    const store = syntheticProtectionStore({ controls: [row()] });
    const first = await readLegacyProtection({ ...store, preserveOriginal: true });
    assert.deepEqual(first.controls, []);
    assert.equal(first.wire.length, 1);
    first.wire[0].sha256 = 'changed';
    const second = await readLegacyProtection({ ...store, preserveOriginal: true });
    assert.notEqual(second.wire[0].sha256, 'changed');
    assert.equal(store.reads.length, 4);
});

test('οι επιλογές αποκωδικοποίησης της συλλογής διατηρούν τους ίδιους τύπους BSON', async () => {
    const bsonOptions = { promoteBuffers: true, promoteLongs: false };
    const document = row({ frozen_snapshot: { bytes: Buffer.from([1, 2]), minutes: BSON.Long.fromNumber(480) } });
    const store = syntheticProtectionStore({ snapshots: [document], bsonOptions });
    const result = await readLegacyProtection({ ...store, period: { from: '2026-01-01', to: null }, preserveOriginal: true });
    assert.deepEqual(result.snapshots, [BSON.deserialize(BSON.serialize(document), bsonOptions)]);
    assert.ok(Buffer.isBuffer(result.snapshots[0].frozen_snapshot.bytes));
    assert.equal(result.snapshots[0].frozen_snapshot.minutes._bsontype, 'Long');
});

for (const invalid of [
    { period_start: null }, { period_end: 'invalid' },
    { period_start: new Date('2026-02-01') }, { ypokatasthma: ' ' }, { ypokatasthma: 1 }
]) test(`μη έγκυρα στοιχεία περιόδου παραμένουν αβέβαια: ${Object.keys(invalid)}`, async () => {
    const store = syntheticProtectionStore({ controls: [row(invalid)] });
    const result = await readLegacyProtection({ ...store, preserveOriginal: true });
    assert.equal(result.uncertain, true);
    assert.equal(result.wire.length, 1);
});

for (const invalid of [{ status: 'UNKNOWN' }, { active_calculation_id: 123 }])
    test(`μη έγκυρη επικαλυπτόμενη κατάσταση παραμένει αβέβαιη: ${Object.keys(invalid)}`, async () => {
        const store = syntheticProtectionStore({ controls: [row({ ...invalid, period_end: new Date('2026-12-31') })] });
        assert.equal((await readLegacyProtection({ ...store, preserveOriginal: true })).uncertain, true);
    });

test('μη έγκυρη απόκριση BSON απορρίπτεται', async () => {
    const store = syntheticProtectionStore({ controls: [row()], invalidRaw: true });
    await assert.rejects(readLegacyProtection({ ...store, preserveOriginal: true }), /PROTECTION_UNKNOWN/);
});

test('το όριο των 1000 εγγραφών παραμένει δεσμευτικό', async () => {
    const store = syntheticProtectionStore({ controls: Array.from({ length: 1001 }, (_, index) =>
        row({ _id: new BSON.ObjectId(index.toString(16).padStart(24, '0')) })) });
    await assert.rejects(readLegacyProtection({ ...store, preserveOriginal: true }), /PROTECTION_UNKNOWN/);
});

test('η αυστηρή διαδρομή διατηρεί τις αρχικές τέσσερις αναγνώσεις και τους ελέγχους προστασίας', async () => {
    const store = syntheticProtectionStore({ controls: [row()] });
    const result = await readLegacyProtection(store);
    assert.deepEqual(result.controls, []);
    assert.deepEqual(result.wire, []);
    assert.deepEqual(store.reads.map(read => read.raw), [false, false, true, true]);
    for (const [extra, error] of [[{ status: 'LOCKED' }, /PERIOD_PROTECTED/],
        [{ active_calculation_id: 'busy' }, /PERIOD_BUSY/], [{ period_start: null }, /PROTECTION_UNKNOWN/],
        [{ status: 'FINALIZED' }, /REFERENCE/]]) {
        const protectedStore = syntheticProtectionStore({ controls: [row({ period_end: new Date('2026-12-31'), ...extra })] });
        await assert.rejects(readLegacyProtection(protectedStore), error);
    }
});
