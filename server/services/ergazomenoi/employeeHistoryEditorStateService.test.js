'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const S = require('./employeeHistoryEditorStateService');
const { IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const { fixture, clone } = require('../../../test/fixtures/employeeProfileTransactionStore');
const token = snapshot => S.buildEmployeeHistoryEditorStateToken({
    currentEmployee: snapshot.employee, historyRows: snapshot.history
});

test('identical persisted business snapshots produce a valid deterministic SHA-256 token', () => {
    const before = fixture();
    assert.match(token(before), /^[a-f0-9]{64}$/);
    assert.equal(token(before), token(clone(before)));
});

test('query row ordering does not affect the token', () => {
    const before = fixture(), after = clone(before);
    after.history.reverse();
    assert.equal(token(before), token(after));
});

test('nested object key order, dates, ObjectIds and ordered arrays are canonical', () => {
    const before = fixture(), after = clone(before);
    before.employee.employment_profile_pre_v1 = { b: [1, 2], a: new Date('2026-01-01') };
    after.employee.employment_profile_pre_v1 = { a: '2026-01-01T00:00:00.000Z', b: [1, 2] };
    before.history[0]._id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
    after.history[0]._id = '507f1f77bcf86cd799439011';
    assert.equal(token(before), token(after));
    after.employee.employment_profile_pre_v1.b.reverse();
    assert.notEqual(token(before), token(after), 'array order remains significant');
});

for (const [name, change] of [
    ['same rendered row modification', s => { s.history[0].hmeromhnia_lhxhs_symbashs = '2026-11-30'; }],
    ['different row modification', s => { s.history[1].symbash = 'changed-contract'; }],
    ['inserted row', s => { s.history.push({ ...s.history[1], _id: 'new-row' }); }],
    ['deleted row', s => { s.history.splice(1, 1); }],
    ['current Employee business change', s => { s.employee.energos = false; }],
    ['current legacy compatibility anchor', s => { s.employee.employment_profile_pre_v1 = { baseline: 1 }; }],
    ['canonical redundant marker', s => { s.history[1].employment_history_canonical_status = 'REDUNDANT_REFERENCED'; }],
    ['row identity', s => { s.history[0]._id = 'replacement-row'; }],
    ['creation ordering fact', s => { s.history[0].createdAt = new Date('2025-01-01'); }]
]) test(`${name} changes the token`, () => {
    const before = fixture(), after = clone(before);
    change(after);
    assert.notEqual(token(before), token(after));
});

test('all persisted History schema fields are covered except private fence and Mongoose version', () => {
    assert.deepEqual(Object.keys(IstorikoProslhpseonAllagonModel.schema.paths)
        .filter(field => !S.HISTORY_STATE_FIELDS.includes(field)).sort(), ['__v', 'history_reference_fence']);
});

test('all projected business fields affect the snapshot, including falsy values', () => {
    const before = fixture();
    for (const [source, fields] of [['employee', S.EMPLOYEE_STATE_FIELDS], ['history', S.HISTORY_STATE_FIELDS]]) {
        for (const field of fields) {
            const after = clone(before);
            const record = source === 'employee' ? after.employee : after.history[0];
            record[field] = record[field] === false ? true : false;
            assert.notEqual(token(before), token(after), `${source}.${field}`);
        }
    }
});

test('lookups, display enrichment, document blobs and private metadata are excluded', () => {
    const before = fixture(), after = clone(before);
    for (const record of [after.employee, ...after.history]) {
        Object.assign(record, { __lookups: { contract: 'display description' },
            symbash_perigrafh: 'display text', computedPresentation: { label: 'display' },
            bibliario_anhlikoy_base64: 'large-document-payload', __v: 100,
            history_reference_fence: 100, employee_profile_mutation_sequence: 100 });
    }
    assert.equal(token(before), token(after));
    assert.ok(!S.EMPLOYEE_STATE_FIELDS.includes('employee_profile_mutation_sequence'));
});

test('another Employee snapshot cannot change this Employee token', () => {
    const a = fixture(), b = fixture('other', { team: 'OTHER', company_kod: 'elsewhere', kodikos: '9999' });
    const expected = token(a);
    b.history[1].hmeromhnia_lhxhs_symbashs = '2026-11-30';
    b.employee.energos = false;
    assert.equal(token(a), expected);
});

test('validation rejects missing, malformed and well-formed forged expectations with typed 409', () => {
    const snapshot = fixture();
    for (const expectedStateToken of [undefined, null, '', 1, [], {}, 'f'.repeat(63), 'F'.repeat(64), 'f'.repeat(64)]) {
        assert.throws(() => S.assertEmployeeHistoryEditorState({ expectedStateToken,
            currentEmployee: snapshot.employee, historyRows: snapshot.history }),
        { code: 'EMPLOYEE_HISTORY_EDITOR_STALE', statusCode: 409 });
    }
    S.assertEmployeeHistoryEditorState({ expectedStateToken: token(snapshot),
        currentEmployee: snapshot.employee, historyRows: snapshot.history });
});
