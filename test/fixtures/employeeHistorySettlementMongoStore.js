'use strict';

// Real collections, sessions, snapshot isolation, driver retries and commits.
// Failure injection throws only AFTER real writes; it is not a memory store.
const mongoose = require('mongoose');
const assert = require('node:assert/strict');
const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const { assertMongoConnection } = require('./employeeHistorySettlementMongoTarget');
const { deferred } = require('./employeeProfileTransactionStore');
const contexts = new WeakMap();

async function createMongoSettlementStore({ enriched = true, fixture, role = 'A', update = true } = {}) {
    const connection = mongoose.connection;
    assertMongoConnection(connection);
    const { ErgazomenoiModel: E, IstorikoProslhpseonAllagonModel: H } = require('../../server/models/ergazomenoi');
    const auditModel = require('../../server/models/employeeHistoryRepairAudit');
    const userModel = require('../../server/models/userModel');
    const { UserPrivilegesModel: privilegeModel } = require('../../server/models/privileges');
    for (const model of [E, H, auditModel, userModel, privilegeModel]) {
        assert.equal(model.db, connection, 'Every repository must use the guarded disposable connection');
    }
    const { findHistoryIdReferences } = require('../../server/services/ergazomenoi/employeeHistoryReferenceAuditService');
    const { employeeHistoryRepairAuditCollectionExists } = require('../../server/services/ergazomenoi/employeeHistoryRepairAuditSetupService');
    const { transactionCapability } = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const input = fixture ? S.clone(fixture)
        : require('../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures').real0006BoundaryStructure();
    const referencedIds = fixture ? new Set(Object.entries(input.protectedReferenceSummary)
        .filter(([, references]) => references.length).map(([id]) => id))
        : new Set(input.completeHistoryRows.slice(0, 2).map(row => String(row._id)));
    const referenceRows = [];
    const remappedIds = new Map(input.completeHistoryRows.map(row => [String(row._id), new mongoose.Types.ObjectId()]));
    input.scope.company_kod = String(new mongoose.Types.ObjectId());
    Object.assign(input.currentEmployee, input.scope, { _id: new mongoose.Types.ObjectId() });
    input.completeHistoryRows.forEach(row => {
        const sourceId = String(row._id);
        Object.assign(row, input.scope, { _id: remappedIds.get(sourceId) });
        if (referencedIds.has(sourceId)) referenceRows.push(row);
        if (row.employment_history_canonical_survivor_id) row.employment_history_canonical_survivor_id =
            remappedIds.get(String(row.employment_history_canonical_survivor_id));
        if (enriched) Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 });
    });
    // Native inserts deliberately retain absent evidence: schema defaults must
    // not accidentally enrich the original incomplete 0006.
    await E.collection.insertOne(S.clone(input.currentEmployee));
    await H.collection.insertMany(S.clone(input.completeHistoryRows));
    const actor = new mongoose.Types.ObjectId();
    await userModel.collection.insertOne({ _id: actor, privileges: role, team: role === 'A' ? 'THA' : input.scope.team, situation: 'A' });
    await privilegeModel.collection.insertOne({ userId: String(actor), form: 'Ergazomenoi', privileges: { update } });
    const frozen = connection.collection('Apasxoliseis_Period_Frozen_Snapshots');
    const referenceDocument = historyId => ({ _id: new mongoose.Types.ObjectId(), ...input.scope,
        frozen_snapshot: { finalized: true, amount: 123.45, hours: 8,
            daily_results: [{ kodikos: input.scope.kodikos, effective_profile_istoriko_id: historyId }] } });
    if (referenceRows.length) await frozen.insertMany(referenceRows.map(row => referenceDocument(row._id)));
    const scope = input.scope, employeeId = String(input.currentEmployee._id), actorUserId = String(actor);
    let failure = null, writes = 0, inserts = 0, paused = null;
    const events = [];
    const proxy = (model, overrides) => new Proxy(model, { get(target, key) {
        if (Object.hasOwn(overrides, key)) return overrides[key];
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
    } });
    const employeeModel = proxy(E, { findOne(...args) {
        const query = E.findOne(...args), lean = query.lean.bind(query);
        query.lean = async (...leanArgs) => {
            const result = await lean(...leanArgs);
            if (paused) { const barrier = paused; paused = null;
                barrier.reached.resolve(); await barrier.resume.promise; }
            return result;
        };
        return query;
    }, async updateOne(...args) {
        try { return await E.updateOne(...args); }
        catch (error) { events.push({ type: 'fence-error', code: error.code,
            transient: error.hasErrorLabel?.('TransientTransactionError') }); throw error; }
    } });
    const historyModel = proxy(H, { async create(...args) {
        const created = await H.create(...args);
        events.push({ type: 'history-insert', session: args[1].session });
        if (failure === 'INSERT' && ++inserts === 2) throw Error('INJECTED_AFTER_REAL_HISTORY_INSERT');
        return created;
    }, async updateOne(...args) {
        let result;
        try { result = await H.updateOne(...args); }
        catch (error) { events.push({ type: 'history-error', code: error.code,
            transient: error.hasErrorLabel?.('TransientTransactionError') }); throw error; }
        events.push({ type: 'history-write', session: args[2].session });
        if (failure === 'WRITE' && ++writes === 2) throw Error('INJECTED_AFTER_REAL_HISTORY_WRITE');
        return result;
    } });
    const injectedAudit = { async create(records, options) {
        const created = await auditModel.create(records, options);
        events.push({ type: 'audit-write', session: options.session });
        if (failure === 'AUDIT') throw Error('INJECTED_AFTER_REAL_AUDIT_WRITE');
        if (failure === 'FINAL') await H.collection.updateOne({ _id: input.completeHistoryRows[0]._id },
            { $inc: { history_reference_fence: 1 } }, { session: options.session });
        return created;
    } };
    const readAudits = session => auditModel.find({ 'employeeScope.employee_id': input.currentEmployee._id })
        .session(session || null).sort({ _id: 1 }).lean();
    const referenceSummary = async (rows, session) => {
        assertMongoConnection(connection);
        const summary = {};
        // A MongoDB session must execute transaction operations sequentially.
        for (const row of rows) summary[String(row._id)] = await findHistoryIdReferences({
            connection, historyIds: [String(row._id)], session });
        return summary;
    };
    const guardedConnection = proxy(connection, { async startSession(...args) {
        assertMongoConnection(connection);
        const session = await connection.startSession(...args);
        const withTransaction = session.withTransaction.bind(session);
        session.withTransaction = async (...transactionArgs) => {
            const result = await withTransaction(...transactionArgs);
            // Application-level acknowledgement loss AFTER a real driver commit.
            // This does not claim to simulate a network-level lost commit reply.
            if (failure === 'COMMIT_ACK_LOST') {
                failure = null;
                const error = Error('INJECTED_AFTER_REAL_COMMIT');
                error.errorLabels = ['UnknownTransactionCommitResult'];
                throw error;
            }
            return result;
        };
        return session;
    } });
    const handle = Object.freeze({});
    contexts.set(handle, Object.freeze({ deps: Object.freeze({ connection: guardedConnection, capabilityProbe: transactionCapability,
        employeeModel, historyModel, auditModel: injectedAudit, userModel, privilegeModel,
        referenceChecker: findHistoryIdReferences, auditCollectionChecker: employeeHistoryRepairAuditCollectionExists }),
    readAudits, referenceSummary }));
    const state = async () => { assertMongoConnection(connection); return { employee: await E.collection.findOne({ _id: input.currentEmployee._id }),
        history: await H.collection.find(scope).sort({ aa_eggrafhs: 1 }).toArray(),
        references: await frozen.find(scope).sort({ _id: 1 }).toArray(), audits: await readAudits() }; };
    return { handle, scope, employeeId, actorUserId, events, state,
        async approvalInput() { const snapshot = await state();
            return { scope: S.clone(scope), employeeId, actorUserId, currentEmployee: snapshot.employee,
                completeHistoryRows: snapshot.history,
                protectedReferenceSummary: await referenceSummary(snapshot.history) }; },
        failAt(value) { failure = value; writes = 0; inserts = 0; },
        async changeActor(patch) { assertMongoConnection(connection); await userModel.collection.updateOne({ _id: actor }, { $set: patch }); },
        async changePermission(value) { assertMongoConnection(connection); await privilegeModel.collection.updateOne({ userId: actorUserId, form: 'Ergazomenoi' },
            { $set: { 'privileges.update': value } }); },
        pauseNextEmployeeRead() { const barrier = { reached: deferred(), resume: deferred() }; paused = barrier;
            return { reached: barrier.reached.promise, resume: barrier.resume.resolve }; },
        async changeEmployee(patch) { assertMongoConnection(connection); await E.collection.updateOne({ _id: input.currentEmployee._id }, { $set: patch }); },
        async addReference(historyId) {
            assertMongoConnection(connection);
            const document = referenceDocument(new mongoose.Types.ObjectId(historyId));
            const { fenceEmployeeHistoryReferences } = require('../../server/services/ergazomenoi/employeeHistoryReferenceWriteFenceService');
            // Use the real reference writer's fence in the same real transaction.
            await connection.transaction(async session => {
                await fenceEmployeeHistoryReferences({ collectionName: 'Apasxoliseis_Period_Frozen_Snapshots',
                    documents: [document], session });
                await frozen.insertOne(document, { session });
            });
        }
    };
}
function mongoSettlementContext(handle) {
    if (!handle || !contexts.has(handle)) S.fail('SYNTHETIC_STORE_REQUIRED');
    assertMongoConnection(mongoose.connection);
    return contexts.get(handle);
}
module.exports = { createMongoSettlementStore, mongoSettlementContext };
