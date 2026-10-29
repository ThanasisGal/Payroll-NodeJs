'use strict';

// Real collections, sessions, snapshot isolation, driver retries and commits.
// Failure injection throws only AFTER real writes; it is not a memory store.
const mongoose = require('mongoose');
const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const { assertMongoConnection } = require('./employeeHistorySettlementMongoTarget');
const { deferred } = require('./employeeProfileTransactionStore');
const contexts = new WeakMap();

async function createMongoSettlementStore({ enriched = true } = {}) {
    const connection = mongoose.connection;
    assertMongoConnection(connection);
    const { ErgazomenoiModel: E, IstorikoProslhpseonAllagonModel: H } = require('../../server/models/ergazomenoi');
    const auditModel = require('../../server/models/employeeHistoryRepairAudit');
    const userModel = require('../../server/models/userModel');
    const { UserPrivilegesModel: privilegeModel } = require('../../server/models/privileges');
    const { findHistoryIdReferences } = require('../../server/services/ergazomenoi/employeeHistoryReferenceAuditService');
    const { employeeHistoryRepairAuditCollectionExists } = require('../../server/services/ergazomenoi/employeeHistoryRepairAuditSetupService');
    const { transactionCapability } = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const input = require('../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures').real0006BoundaryStructure();
    input.scope.company_kod = String(new mongoose.Types.ObjectId());
    Object.assign(input.currentEmployee, input.scope, { _id: new mongoose.Types.ObjectId() });
    input.completeHistoryRows.forEach(row => {
        Object.assign(row, input.scope, { _id: new mongoose.Types.ObjectId() });
        if (enriched) Object.assign(row, { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 });
    });
    // Native inserts deliberately retain absent evidence: schema defaults must
    // not accidentally enrich the original incomplete 0006.
    await E.collection.insertOne(S.clone(input.currentEmployee));
    await H.collection.insertMany(S.clone(input.completeHistoryRows));
    const actor = new mongoose.Types.ObjectId();
    await userModel.collection.insertOne({ _id: actor, privileges: 'A', team: 'THA', situation: 'A' });
    await privilegeModel.collection.insertOne({ userId: String(actor), form: 'Ergazomenoi', privileges: { update: true } });
    const frozen = connection.collection('Apasxoliseis_Period_Frozen_Snapshots');
    const referenceDocument = historyId => ({ _id: new mongoose.Types.ObjectId(), ...input.scope,
        frozen_snapshot: { finalized: true, amount: 123.45, hours: 8,
            daily_results: [{ kodikos: '0006', effective_profile_istoriko_id: historyId }] } });
    await frozen.insertMany(input.completeHistoryRows.slice(0, 2).map(row => referenceDocument(row._id)));
    const scope = input.scope, employeeId = String(input.currentEmployee._id), actorUserId = String(actor);
    let failure = null, writes = 0, paused = null;
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
    const historyModel = proxy(H, { async updateOne(...args) {
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
        const summary = {};
        // A MongoDB session must execute transaction operations sequentially.
        for (const row of rows) summary[String(row._id)] = await findHistoryIdReferences({
            connection, historyIds: [String(row._id)], session });
        return summary;
    };
    const handle = Object.freeze({});
    contexts.set(handle, Object.freeze({ deps: { connection, capabilityProbe: transactionCapability,
        employeeModel, historyModel, auditModel: injectedAudit, userModel, privilegeModel,
        referenceChecker: findHistoryIdReferences, auditCollectionChecker: employeeHistoryRepairAuditCollectionExists },
    readAudits, referenceSummary }));
    const state = async () => ({ employee: await E.collection.findOne({ _id: input.currentEmployee._id }),
        history: await H.collection.find(scope).sort({ aa_eggrafhs: 1 }).toArray(),
        references: await frozen.find(scope).sort({ _id: 1 }).toArray(), audits: await readAudits() });
    return { handle, scope, employeeId, actorUserId, events, state,
        async approvalInput() { const snapshot = await state();
            return { scope: S.clone(scope), employeeId, actorUserId, currentEmployee: snapshot.employee,
                completeHistoryRows: snapshot.history,
                protectedReferenceSummary: await referenceSummary(snapshot.history) }; },
        failAt(value) { failure = value; writes = 0; },
        pauseNextEmployeeRead() { const barrier = { reached: deferred(), resume: deferred() }; paused = barrier;
            return { reached: barrier.reached.promise, resume: barrier.resume.resolve }; },
        async changeEmployee(patch) { await E.collection.updateOne({ _id: input.currentEmployee._id }, { $set: patch }); },
        async addReference(historyId) {
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
