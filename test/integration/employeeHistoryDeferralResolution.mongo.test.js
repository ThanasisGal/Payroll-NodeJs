'use strict';
// Synthetic tests only. Each case owns a fresh private mongod/dbpath/port.
// The original database, application service and Git worktree are never used.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../fixtures/employeeHistoryApprovedProposalMongo');
const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const D = require('../../server/services/ergazomenoi/employeeHistoryDeferralService');
const S = require('../../server/utils/ergazomenoi/employeeSaveState');
const binary = process.env.PAYROLL_CORRECTION3_TEST_MONGOD;

async function seeded(t) {
    const db = await F.startApprovedProposalMongo(binary);
    t.after(async () => db.close());
    const f = await F.seedApprovedProposal(db);
    await db.employeeModel.collection.updateOne({ _id: f.employee._id }, { $unset: { krathsh_01: '' } });
    await db.historyModel.collection.updateOne({ _id: f.history.at(-1)._id }, { $unset: { krathsh_01: '' } });
    const current = await db.employeeModel.findById(f.employee._id).lean();
    const input = {
        ...db, scope: f.scope, employeeId: String(f.employee._id), actorUserId: String(f.actor),
        confirmationSession: 'synthetic-correction3-resolution',
        expectedEmployeeStateToken: S.employeeStateToken(current),
        correctionCatalogLoader: f.dependencies.loadCatalogs,
        maintenance: {
            employeeChanges: { pragmatikosMisthos: 1550 }, submittedEmployeeFields: ['pragmatikosMisthos'],
            historyChanges: { pragmatikosMisthos: 1550 }, submittedHistoryChanges: { pragmatikosMisthos: 1550 },
            submittedFormValues: { pragmatikosMisthos: 1550 }
        }
    };
    const preview = await W.writeEmployeeMaintenance({ ...input, historyPreflight: true });
    assert.equal(preview.status, 'MISSING_REQUIRED_HISTORY_FIELDS', preview.message);
    const deferred = await W.writeEmployeeMaintenance({ ...input,
        historyDecision: 'DEFER_HISTORY', historyConfirmation: preview.historyConfirmation });
    assert.equal(deferred.historyDeferred, true);
    const saved = await db.employeeModel.findById(f.employee._id).lean();
    assert.equal(saved[D.FIELD].version, D.VERSION);
    return { db, f, saved, pending: saved[D.FIELD] };
}

function resolution({ db, f, saved, pending }) {
    return {
        ...db, scope: f.scope, employeeId: String(f.employee._id), actorUserId: String(f.actor),
        confirmationSession: 'synthetic-correction3-resolution',
        expectedEmployeeStateToken: S.employeeStateToken(saved),
        correctionCatalogLoader: f.dependencies.loadCatalogs,
        externalIntent: {},
        maintenance: {
            employeeChanges: { krathsh_01: '0101' }, submittedEmployeeFields: ['krathsh_01'],
            historyChanges: { krathsh_01: '0101' }, submittedHistoryChanges: { krathsh_01: '0101' },
            submittedFormValues: { krathsh_01: '0101' }
        },
        pendingResolution: { id: pending.id, effectiveFrom: pending.effectiveFrom, confirmed: true }
    };
}

const opts = { skip: !binary ? 'Portable isolated mongod must be explicit' : false, timeout: 90000 };

test('Mongo real: pending resolves exactly once; original boundary, History update, pending clear and audit are atomic', opts, async t => {
    const ctx = await seeded(t), { db, f, pending } = ctx;
    const before = await db.historyModel.collection.find(f.scope).toArray();
    const input = resolution(ctx);
    const preview = await W.writeEmployeeMaintenance({ ...input, historyPreflight: true });
    assert.equal(preview.status, 'READY_FOR_COMBINED_SAVE', preview.message);
    assert.equal(preview.decision, 'RESOLVE_PENDING');
    const result = await W.writeEmployeeMaintenance({ ...input,
        historyDecision: 'RESOLVE_PENDING', historyConfirmation: preview.historyConfirmation });
    assert.equal(result.pendingResolved, true);
    assert.equal(result.historyUpdated, true);
    assert.equal(result.externalActionsAllowed, false, 'History-only resolution must not resend ERGANI');
    const after = await db.historyModel.collection.find(f.scope).toArray();
    const employee = await db.employeeModel.findById(f.employee._id).lean();
    assert.equal(employee[D.FIELD] ?? null, null);
    assert.equal(after.length, before.length);
    const changed = after.filter(row => D.digest(row) !== D.digest(before.find(old => String(old._id) === String(row._id))));
    assert.equal(changed.length, 1, 'One existing physical History row may change');
    const updated = after.find(row => String(row._id) === String(pending.targetHistoryId));
    assert.equal(updated.krathsh_01, '0101');
    assert.equal(updated.pragmatikosMisthos, 1550);
    assert.equal(new Date(updated.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0,10),
        new Date(pending.profileEffectiveFrom).toISOString().slice(0,10));
    assert.ok(await db.auditModel.collection.countDocuments({}) >= 1, 'Resolution must be audited');
    await assert.rejects(W.writeEmployeeMaintenance({ ...input,
        historyDecision: 'RESOLVE_PENDING', historyConfirmation: preview.historyConfirmation }));
    assert.deepEqual(await db.historyModel.collection.find(f.scope).toArray(), after);
});

test('Mongo real: intervening History write blocks stale pending resolution and preserves original pending', opts, async t => {
    const ctx = await seeded(t), { db, f, pending } = ctx;
    await db.historyModel.collection.updateOne({ _id: f.history[0]._id },
        { $set: { updatedAt: new Date('2026-11-20') } });
    const afterThirdParty = await db.historyModel.collection.find(f.scope).toArray();
    const preview = await W.writeEmployeeMaintenance({ ...resolution(ctx), historyPreflight: true });
    assert.equal(preview.status, 'UNSAFE_HISTORY_CHANGE', preview.message);
    assert.ok(!preview.historyConfirmation, 'Stale history must not receive executable confirmation');
    const employee = await db.employeeModel.findById(f.employee._id).lean();
    assert.equal(D.digest(employee[D.FIELD]), D.digest(pending));
    assert.deepEqual(await db.historyModel.collection.find(f.scope).toArray(), afterThirdParty);
});

test('Mongo real: audit failure rolls back History, Employee and pending-clear in the same transaction', opts, async t => {
    const ctx = await seeded(t), { db, f, pending } = ctx;
    const input = resolution(ctx);
    const preview = await W.writeEmployeeMaintenance({ ...input, historyPreflight: true });
    assert.equal(preview.status, 'READY_FOR_COMBINED_SAVE', preview.message);
    const beforeHistory = await db.historyModel.collection.find(f.scope).toArray();
    const beforeEmployee = await db.employeeModel.collection.findOne({ _id: f.employee._id });
    const beforeAudits = await db.auditModel.collection.find({}).toArray();
    const failedAuditModel = Object.create(db.auditModel);
    failedAuditModel.create = async () => { throw new Error('SYNTHETIC_AUDIT_ABORT'); };
    await assert.rejects(W.writeEmployeeMaintenance({ ...input, auditModel: failedAuditModel,
        historyDecision: 'RESOLVE_PENDING', historyConfirmation: preview.historyConfirmation }),
        /SYNTHETIC_AUDIT_ABORT/);
    assert.deepEqual(await db.historyModel.collection.find(f.scope).toArray(), beforeHistory);
    assert.deepEqual(await db.employeeModel.collection.findOne({ _id: f.employee._id }), beforeEmployee);
    assert.deepEqual(await db.auditModel.collection.find({}).toArray(), beforeAudits);
    const persisted = await db.employeeModel.findById(f.employee._id).lean();
    assert.equal(D.digest(persisted[D.FIELD]), D.digest(pending));
});
