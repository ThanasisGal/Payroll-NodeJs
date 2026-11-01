'use strict';
const path = require('node:path');
const mongoose = require('mongoose');
const { BSON } = mongoose.mongo;
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const F = require('./employeeHistoryPilotFiles');
const { SUPPORTED_COLLECTIONS, employeeHistoryReferenceQueryPaths } = require('./employeeHistoryReferenceDefinitionsService');
const { authorizeEmployeeMaintenance } = require('./employeeMaintenanceAuthorizationService');
const { actorAccess } = require('./employeeHistoryAutomaticReconstructionApplyService');
const ordered = rows => [...rows].sort((a,b) => String(a._id).localeCompare(String(b._id)));
function databaseIdentity(connection) {
    const options = connection.getClient().options;
    return { database: connection.db.databaseName, hosts: (options.hosts || []).map(String).sort(),
        srvHost: options.srvHost || null, replicaSet: options.replicaSet || null };
}
function collections(deps) {
    return { employee: deps.employeeModel.collection, history: deps.historyModel.collection,
        audit: deps.connection.collection('Employee_History_Repair_Audit') };
}
async function authorize(deps, scope, employeeId, actorUserId, session) {
    if (!scope || !A.equal(Object.keys(scope).sort(), ['company_kod','kodikos','team']) ||
        !Object.values(scope).every(value=>typeof value==='string' && value.trim()===value && value.length>0) ||
        ![employeeId,actorUserId,scope.company_kod].every(id=>/^[a-f0-9]{24}$/i.test(id||''))) F.fail('SCOPE');
    const current = await deps.employeeModel.findOne({ ...scope, _id: employeeId }).session(session).lean();
    await authorizeEmployeeMaintenance({ actorUserId, scope, employeeId, current, session,
        userModel: deps.userModel, privilegeModel: deps.privilegeModel });
    if ((await actorAccess({ actorUserId, scope, session, userModel: deps.userModel })).mode !== 'ADMIN_FULL') F.fail('FORBIDDEN');
    if (!await deps.companyModel.findOne({ _id: scope.company_kod, team: scope.team }).session(session).lean()) F.fail('COMPANY');
}
async function capture({ deps, scope, employeeId, session, historyIds = [] }) {
    const c = collections(deps);
    const employee = await c.employee.findOne({ ...scope, _id: new mongoose.Types.ObjectId(employeeId) }, { session });
    if (!employee) F.fail('EMPLOYEE');
    const history = ordered(await c.history.find(scope, { session }).toArray());
    const ids = [...new Set([...history.map(row=>String(row._id)), ...historyIds.map(String)])];
    const values = ids.flatMap(id => [id, new mongoose.Types.ObjectId(id)]);
    const references = {};
    for (const name of SUPPORTED_COLLECTIONS) references[name] = ordered(await deps.connection.collection(name)
        .find({ $or: employeeHistoryReferenceQueryPaths(name).map(field => ({ [field]: { $in: values } })) }, { session }).toArray());
    return { identity: databaseIdentity(deps.connection), scope: { ...scope }, employeeId, employee, history, references };
}
function evidence(snapshot) {
    const groups = { employee: [snapshot.employee], history: snapshot.history, ...snapshot.references };
    return Object.fromEntries(Object.entries(groups).map(([name, rows]) => [name,
        { count: rows.length, ids: rows.map(row=>String(row._id)), hash: A.hash(rows) }]));
}
async function prepareBackup({ deps, scope, employeeId, actorUserId, outputDirectory, appRoot, businessDecision }) {
    F.privateDirectory(outputDirectory, appRoot);
    const { inProfileTransaction } = require('./employeeEmploymentProfileWriter');
    const snapshot = await inProfileTransaction(deps.connection, deps.capabilityProbe, async session => {
        await authorize(deps, scope, employeeId, actorUserId, session);
        const state = await capture({ deps, scope, employeeId, session });
        const protectedReferenceSummary = {};
        for (const row of state.history) protectedReferenceSummary[String(row._id)] = await deps.referenceChecker({
            connection: deps.connection, historyIds: [String(row._id)], session });
        const input = { scope, employeeId, actorUserId, currentEmployee: state.employee, completeHistoryRows: state.history,
            protectedReferenceSummary, ...(businessDecision === undefined ? {} : { businessDecision }) };
        const proposal = require('./employeeHistoryCoordinatedSettlementContract').buildCoordinatedSettlementProposal(input);
        const approvalFingerprint = proposal.status === 'CLEAN'
            ? require('./employeeHistoryAutomaticSettlementPreparationContract').buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal }) : null;
        return { ...state, approvalFingerprint, ...(businessDecision === undefined ? {} : { businessDecision }) };
    }, null, { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
    const payload = { version: 1, capturedAt: new Date(), actorUserId, ...snapshot, evidence: evidence(snapshot) };
    const bytes = BSON.serialize(payload), sha256 = F.digest(bytes);
    const file = path.join(outputDirectory, sha256 + '.bson');
    F.writeExclusive(file, bytes, appRoot);
    return { file, sha256, approvalFingerprint: payload.approvalFingerprint, evidence: payload.evidence };
}
function readBackup(file, sha256, appRoot) {
    const bytes = F.readPrivate(file, appRoot);
    if (F.digest(bytes) !== sha256) F.fail('BACKUP_HASH');
    const data = BSON.deserialize(bytes);
    if (data.version !== 1 || !A.equal(data.evidence, evidence(data))) F.fail('BACKUP_EVIDENCE');
    return data;
}
function sameSnapshot(backup, current) {
    return ['identity','scope','employeeId','employee','history','references'].every(key=>A.equal(backup[key],current[key]));
}
function inversePatch(before, after, current, ignore = new Set()) {
    const set = {}, unset = {};
    for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (ignore.has(field) || A.equal(before[field], after[field])) continue;
        if (!A.equal(current[field], after[field]) || Object.hasOwn(current,field)!==Object.hasOwn(after,field)) F.fail('NEWER_CHANGE');
        if (Object.hasOwn(before,field)) set[field] = before[field]; else unset[field] = '';
    }
    return { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) };
}
// Resolve an acknowledgement loss by reading only. A missing audit is never
// interpreted as permission to retry a mutation or remove the durable claim.
async function reconcile({ context, actorUserId }) {
    const gate = context?.pilot;
    if (!gate) F.fail('RECONCILE_AUTHORIZATION');
    const grant = gate.grant, deps = context.deps;
    gate.assertIdentity({ scope: grant.scope, employeeId: grant.employeeId, actorUserId, fingerprint: grant.fingerprint });
    const W = require('./employeeEmploymentProfileWriter');
    return W.inProfileTransaction(deps.connection, deps.capabilityProbe, async session => {
        await authorize(deps, grant.scope, grant.employeeId, actorUserId, session);
        const audit = await collections(deps).audit.findOne({ mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT',
            'employeeScope.employee_id': new mongoose.Types.ObjectId(grant.employeeId),
            'employeeScope.team': grant.scope.team, 'employeeScope.company_kod': grant.scope.company_kod,
            'employeeScope.kodikos': grant.scope.kodikos, 'diagnostics.actorUserId': actorUserId,
            'diagnostics.approvalFingerprint': grant.fingerprint, 'diagnostics.pilot.grantHash': gate.grantHash }, { session });
        if (!audit) return { outcome: 'UNCONFIRMED', executionEnabled: false };
        const state = await capture({ deps, scope: grant.scope, employeeId: grant.employeeId, session });
        const backup = readBackup(grant.backupFile, grant.backupSha256, grant.root);
        if (!A.equal(state.employee, audit.diagnostics.pilot.currentAfter) ||
            !A.equal(state.history, ordered(audit.diagnostics.historyAfter)) ||
            !A.equal(state.references, backup.references)) F.fail('RECONCILE_CHANGED');
        const proposal = require('./employeeHistoryCoordinatedSettlementContract').buildCoordinatedSettlementProposal({
            scope: grant.scope, employeeId: grant.employeeId, actorUserId, currentEmployee: state.employee,
            completeHistoryRows: state.history, protectedReferenceSummary: await context.referenceSummary(state.history, session) });
        if (proposal.status !== 'CLEAN' || !proposal.noOp) F.fail('RECONCILE_NOT_CLEAN');
        return { outcome: 'COMMITTED', historyStatus: 'CLEAN', noOp: true, executionEnabled: false, auditId: String(audit._id) };
    }, null, { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
}
async function undo({ context, actorUserId, auditId, confirmed }) {
    const gate = context?.pilot;
    if (!gate || confirmed !== true) F.fail('UNDO_AUTHORIZATION');
    const grant = gate.grant, deps = context.deps, scope = grant.scope, employeeId = grant.employeeId;
    gate.assertIdentity({ scope, employeeId, actorUserId, fingerprint: grant.fingerprint });
    const backup = readBackup(grant.backupFile, grant.backupSha256, grant.root);
    const W = require('./employeeEmploymentProfileWriter'), c = collections(deps);
    return W.inProfileTransaction(deps.connection, deps.capabilityProbe, async session => {
        await authorize(deps, scope, employeeId, actorUserId, session);
        const audit = await c.audit.findOne({ _id: new mongoose.Types.ObjectId(auditId),
            mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT', 'employeeScope.employee_id': new mongoose.Types.ObjectId(employeeId),
            'employeeScope.team': scope.team, 'employeeScope.company_kod': scope.company_kod, 'employeeScope.kodikos': scope.kodikos,
            'diagnostics.approvalFingerprint': grant.fingerprint }, { session });
        if (!audit || !A.equal(audit.diagnostics.pilot?.backupSha256, grant.backupSha256) ||
            audit.diagnostics.pilot.grantHash !== gate.grantHash ||
            !A.equal(ordered(audit.diagnostics.historyBefore), backup.history) ||
            !A.equal(audit.diagnostics.pilot.currentBefore, backup.employee)) F.fail('UNDO_AUDIT');
        if (await c.audit.findOne({ mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT_PILOT_UNDO',
            'diagnostics.originalAuditId': audit._id }, { session })) F.fail('ALREADY_UNDONE');
        const after = audit.diagnostics.historyAfter;
        const state = await capture({ deps, scope, employeeId, session, historyIds: after.map(row=>row._id) });
        if (!A.equal(state.identity, backup.identity) || !A.equal(state.history, ordered(after)) ||
            !A.equal(state.references, backup.references)) F.fail('NEWER_DEPENDENCY');
        const expected = audit.diagnostics.pilot.currentAfter;
        // Later independent informational fields survive; later business facts
        // invalidate the inverse even if this pilot did not edit that field.
        for (const field of new Set([...C.PROFILE_FIELDS, ...C.FIELD_GROUPS.TEMPORAL_SEMANTIC]))
            if (!A.equal(state.employee[field], expected[field])) F.fail('NEWER_CHANGE');
        const employeePatch = inversePatch(backup.employee, expected, state.employee,
            new Set(['_id','updatedAt','employee_profile_mutation_sequence']));
        gate.claimUndo(session);
        await W.acquireEmployeeMutationFence({ filter: scope, employeeId, employeeModel: deps.employeeModel, session });
        // Reference writers share these write fences. A concurrent reference
        // conflicts and the retry must reread the complete dependency set.
        for (const row of state.history) {
            const filter = { ...scope, _id: row._id };
            if ((await c.history.updateOne(filter, { $inc: { history_reference_fence: 1 } }, { session })).matchedCount !== 1) F.fail('STALE');
            const old = backup.history.find(item=>String(item._id)===String(row._id));
            if (!old) {
                if ((await c.history.deleteOne(filter, { session })).deletedCount !== 1) F.fail('STALE');
            } else {
                if (A.equal(old,row)) {
                    const release = Object.hasOwn(row,'history_reference_fence')
                        ? { $set: { history_reference_fence: row.history_reference_fence } }
                        : { $unset: { history_reference_fence: '' } };
                    if ((await c.history.updateOne(filter, release, { session })).matchedCount !== 1) F.fail('STALE');
                    continue;
                }
                const patch = inversePatch(old, row, row, new Set(['_id','updatedAt','history_reference_fence']));
                patch.$set = { ...patch.$set, updatedAt: new Date(Math.max(Date.now(), new Date(row.updatedAt || 0).getTime() + 1)) };
                if (Object.hasOwn(old,'history_reference_fence')) patch.$set.history_reference_fence = old.history_reference_fence;
                else patch.$unset = { ...patch.$unset, history_reference_fence: '' };
                if ((await c.history.updateOne(filter, patch, { session })).matchedCount !== 1) F.fail('STALE');
            }
        }
        if (Object.keys(employeePatch).length) {
            employeePatch.$set = { ...employeePatch.$set, updatedAt: new Date(Math.max(Date.now(), new Date(state.employee.updatedAt || 0).getTime() + 1)) };
            if ((await c.employee.updateOne({ ...scope, _id: backup.employee._id }, employeePatch, { session })).matchedCount !== 1) F.fail('STALE');
        }
        const final = await capture({ deps, scope, employeeId, session, historyIds: after.map(row=>row._id) });
        if (!A.equal(final.references, backup.references) || final.history.length !== backup.history.length) F.fail('UNDO_VERIFICATION');
        const expectedEmployee = { ...state.employee, ...employeePatch.$set,
            employee_profile_mutation_sequence: (state.employee.employee_profile_mutation_sequence || 0) + 1 };
        for (const key of Object.keys(employeePatch.$unset || {})) delete expectedEmployee[key];
        if (!A.equal(final.employee, expectedEmployee)) F.fail('UNDO_VERIFICATION');
        for (const row of backup.history) {
            const actual = final.history.find(item=>String(item._id)===String(row._id));
            const stripRevision = document => Object.fromEntries(Object.entries(document).filter(([key])=>key!=='updatedAt'));
            if (!actual || !A.equal(stripRevision(actual), stripRevision(row))) F.fail('UNDO_VERIFICATION');
        }
        await c.audit.insertOne({ employeeScope: { ...scope, employee_id: backup.employee._id }, repairedAt: new Date(),
            mutationSource: 'EMPLOYEE_HISTORY_SETTLEMENT_PILOT_UNDO', currentBefore: state.employee,
            historyBefore: state.history, historyAfter: final.history, survivingHistoryIds: final.history.map(row=>String(row._id)),
            deletedLegacyHistoryIds: state.history.filter(row=>!backup.history.some(old=>String(old._id)===String(row._id))).map(row=>String(row._id)),
            diagnostics: { originalAuditId: audit._id, actorUserId, approvalFingerprint: grant.fingerprint,
                grantHash: gate.grantHash, backupSha256: grant.backupSha256 } }, { session });
        return { undone: true, originalAuditId: String(audit._id) };
    }, null, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
}
module.exports = { databaseIdentity, capture, evidence, prepareBackup, readBackup, sameSnapshot, reconcile, undo };
