const mongoose = require('mongoose');
const { ProdhlomenaOrariaModel, ProdhlomenaOrariaAuditModel } = require('../../models/ergazomenoi');
const ExecutionModel = require('../../models/apasxoliseisWeeklyRepoTransferExecution');
const { APPLY_FIELDS, pick } = require('./apasxoliseisWeeklyRepoTransferApplyPreflightService');
const { applyError } = require('./apasxoliseisWeeklyRepoTransferApplyCommandService');

const AUDIT_REASON = 'APPROVED_LINKED_REPO_TRANSFER_APPLY';
async function defaultCapabilityProbe(connection) {
    const hello = await connection.db.admin().command({ hello: 1 });
    return Boolean((hello.setName || hello.msg === 'isdbgrid') && Number(hello.logicalSessionTimeoutMinutes) > 0);
}
function queryWithSession(query, session) { if (typeof query.session === 'function') query = query.session(session); return typeof query.lean === 'function' ? query.lean() : query; }
function exact(value) { return value === undefined ? null : value; }
function rowFilter(plan, row) {
    const filter = { _id: row.id, team: plan.scope.team, company_kod: plan.scope.company_kod, ypokatasthma: plan.decision.ypokatasthma, kodikos: plan.decision.employee_kodikos, hmeromhnia: new Date(`${String(row.date).slice(0, 10)}T00:00:00.000Z`), is_locked: false };
    APPLY_FIELDS.forEach((field) => { filter[field] = exact(row.before[field]); });
    if (Number.isInteger(row.version)) filter.__v = row.version;
    return filter;
}
function updateDocument(row) { const update = { $set: Object.fromEntries(APPLY_FIELDS.map((field) => [field, exact(row.after[field])])) }; if (Number.isInteger(row.version)) update.$inc = { __v: 1 }; return update; }
function auditRecord(plan, row, timestamp) { return { team: plan.scope.team, company_kod: plan.scope.company_kod, prodhlomena_oraria_id: row.id, kodikos: plan.decision.employee_kodikos, ypokatasthma: plan.decision.ypokatasthma, hmeromhnia: new Date(`${String(row.date).slice(0, 10)}T00:00:00.000Z`), changedBy: `${plan.actor.name} (${plan.actor.id})`, changedAt: timestamp, reason: AUDIT_REASON, oldValues: pick(row.before), newValues: pick(row.after) }; }
function executionRecord(plan, timestamp) { return { decision_id: plan.decision._id, decision_fingerprint: plan.decision.snapshot_fingerprint, proposal_id: plan.decision.proposal_id, source_prodhlomena_oraria_id: plan.source.id, target_prodhlomena_oraria_id: plan.target.id, team: plan.scope.team, company_kod: plan.scope.company_kod, ypokatasthma: plan.decision.ypokatasthma, employee_id: plan.decision.employee_id, employee_kodikos: plan.decision.employee_kodikos, week_start: plan.decision.week_start, week_end: plan.decision.week_end, request_id: plan.request_id, command_identity: plan.command_identity, created_by_user_id: plan.actor.id, created_by_user_name: plan.actor.name, created_by_user_role: plan.actor.role, execution_status: 'APPLIED', before_snapshot: { source: pick(plan.source.before), target: pick(plan.target.before), source_locked: false, target_locked: false }, after_snapshot: { source: pick(plan.source.after), target: pick(plan.target.after), source_locked: false, target_locked: false }, applied_at: timestamp, created_at: timestamp }; }
async function freshRow(model, plan, row, session) { return queryWithSession(model.findOne({ _id: row.id, team: plan.scope.team, company_kod: plan.scope.company_kod, ypokatasthma: plan.decision.ypokatasthma, kodikos: plan.decision.employee_kodikos, hmeromhnia: new Date(`${String(row.date).slice(0, 10)}T00:00:00.000Z`) }), session); }
function verifyFresh(fresh, row, prefix) { if (!fresh) throw applyError(`${prefix}_STALE`, 409); if (fresh.is_locked === true) throw applyError(`${prefix}_LOCKED`, 409); if (JSON.stringify(pick(fresh)) !== JSON.stringify(pick(row.before))) throw applyError(`${prefix}_STALE`, 409); return Object.freeze({ ...row, version: Number.isInteger(fresh.__v) ? fresh.__v : undefined }); }

async function writeWeeklyRepoTransferAtomically({ plan, connection = mongoose.connection, prodhlomenaModel = ProdhlomenaOrariaModel, auditModel = ProdhlomenaOrariaAuditModel, executionModel = ExecutionModel, capabilityProbe = defaultCapabilityProbe, now = () => new Date() }) {
    if (!await capabilityProbe(connection)) throw applyError('TRANSACTIONS_UNAVAILABLE', 503);
    const session = await connection.startSession(); let execution;
    try {
        await session.withTransaction(async () => {
            const sourceFresh = await freshRow(prodhlomenaModel, plan, plan.source, session); const source = verifyFresh(sourceFresh, plan.source, 'SOURCE');
            const targetFresh = await freshRow(prodhlomenaModel, plan, plan.target, session); const target = verifyFresh(targetFresh, plan.target, 'TARGET');
            const sourceResult = await prodhlomenaModel.updateOne(mongoose.trusted(rowFilter(plan, source)), updateDocument(source), { session });
            if (sourceResult.matchedCount !== 1) throw applyError('SOURCE_STALE', 409);
            const targetResult = await prodhlomenaModel.updateOne(mongoose.trusted(rowFilter(plan, target)), updateDocument(target), { session });
            if (targetResult.matchedCount !== 1) throw applyError('TARGET_STALE', 409);
            const timestamp = now();
            await auditModel.create([auditRecord(plan, plan.source, timestamp)], { session });
            await auditModel.create([auditRecord(plan, plan.target, timestamp)], { session });
            [execution] = await executionModel.create([executionRecord(plan, timestamp)], { session });
        });
        return execution;
    } finally { await session.endSession(); }
}

module.exports = { AUDIT_REASON, defaultCapabilityProbe, rowFilter, updateDocument, auditRecord, executionRecord, writeWeeklyRepoTransferAtomically };
