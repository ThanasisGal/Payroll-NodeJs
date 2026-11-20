'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../fixtures/employeeHistoryApprovedProposalMongo');
const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const D = require('../../server/services/ergazomenoi/employeeHistoryDeferralService');
const S = require('../../server/utils/ergazomenoi/employeeSaveState');
const binary = process.env.PAYROLL_CORRECTION3_TEST_MONGOD;

// Only a new process/dbpath owned by this fixture is accepted. No URI, .env,
// default mongoose connection or existing database can be supplied to this test.
test('Correction 3: disposable Mongo transaction, physical History checksum and zero History write commands', {
    skip: !binary ? 'SKIP: Δεν διατίθεται ρητά απομονωμένο εκτελέσιμο mongod (PAYROLL_CORRECTION3_TEST_MONGOD).' : false,
    timeout: 90000
}, async t => {
    const db = await F.startApprovedProposalMongo(binary); t.after(db.close);
    const f = await F.seedApprovedProposal(db);
    await db.employeeModel.collection.updateOne({ _id: f.employee._id }, { $unset: { krathsh_01: '' } });
    await db.historyModel.collection.updateOne({ _id: f.history.at(-1)._id }, { $unset: { krathsh_01: '' } });
    const current = await db.employeeModel.findById(f.employee._id).lean();
    const before = await db.historyModel.collection.find(f.scope).toArray();
    const commands = [];
    db.connection.getClient().on('commandStarted', event => {
        if (['update', 'insert', 'delete', 'findAndModify'].includes(event.commandName)) commands.push(event);
    });
    const input = { ...db, scope: f.scope, employeeId: String(f.employee._id), actorUserId: String(f.actor),
        confirmationSession: 'synthetic-mongo-correction3', expectedEmployeeStateToken: S.employeeStateToken(current),
        correctionCatalogLoader: f.dependencies.loadCatalogs,
        maintenance: { employeeChanges: { pragmatikosMisthos: 1550 }, submittedEmployeeFields: ['pragmatikosMisthos'],
            historyChanges: { pragmatikosMisthos: 1550 }, submittedHistoryChanges: { pragmatikosMisthos: 1550 },
            submittedFormValues: { pragmatikosMisthos: 1550 } } };
    const preview = await W.writeEmployeeMaintenance({ ...input, historyPreflight: true });
    assert.equal(preview.status, 'MISSING_REQUIRED_HISTORY_FIELDS', preview.message);
    assert.equal(commands.length, 0, 'preflight is physically read only');
    const result = await W.writeEmployeeMaintenance({ ...input, historyDecision: 'DEFER_HISTORY', historyConfirmation: preview.historyConfirmation });
    assert.equal(result.historyDeferred, true);
    const after = await db.historyModel.collection.find(f.scope).toArray();
    assert.deepEqual(after, before); assert.equal(D.historyFingerprint(after), D.historyFingerprint(before));
    assert.equal(commands.filter(event => Object.values(event.command).includes(db.historyModel.collection.name)).length, 0);
    const saved = await db.employeeModel.findById(f.employee._id).lean();
    assert.equal(saved.pragmatikosMisthos, 1550); assert.equal(saved[D.FIELD].version, D.VERSION);
    assert.equal(db.connection.name, 'payroll_approved_proposal_test');
});
