'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const State = require('./employeeHistoryArchiveStateService');
const W = require('./employeeEmploymentProfileWriter');
const { authorizeEmployeeMaintenance } = require('./employeeMaintenanceAuthorizationService');
const { normalizeRequiredUserTeam } = require('../userTeamScopeService');
const { normalizeUserRole } = require('../../constants/userRoles');
const failure = (reason, statusCode = 409) => Object.assign(new Error('EMPLOYEE_HISTORY_ARCHIVE_' + reason),
    { code: 'EMPLOYEE_HISTORY_ARCHIVE_' + reason, statusCode });
function defaults() {
    return { connection: mongoose.connection,
        employeeModel: require('../../models/ergazomenoi').ErgazomenoiModel,
        historyModel: require('../../models/ergazomenoi').IstorikoProslhpseonAllagonModel,
        auditModel: require('../../models/employeeHistoryRepairAudit'),
        userModel: require('../../models/userModel'), privilegeModel: require('../../models/privileges').UserPrivilegesModel,
        companyModel: require('../../models/companies').CompaniesModel,
        auditStorage: require('./employeeHistoryRepairAuditSetupService').getEmployeeHistoryRepairAuditStorageState,
        capabilityProbe: W.transactionCapability };
}
async function authorize(input, req, d, session = null) {
    await authorizeEmployeeMaintenance({ actorUserId: req.session?.userId, employeeId: req.params?.id,
        scope: input.scope, current: input.currentEmployee, session, userModel: d.userModel, privilegeModel: d.privilegeModel });
    const actor = await d.userModel.findById(req.session.userId).select('_id privileges team situation').session(session).lean();
    if (!['HR', 'S', 'A'].includes(normalizeUserRole(actor?.privileges))) throw failure('FORBIDDEN', 403);
    const permission = await d.privilegeModel.findOne({ userId: req.session.userId, form: 'Ergazomenoi' }).session(session).lean();
    return { actor, permission };
}
function context(req, version, targetHistoryId) {
    if (!req.sessionID || !req.session?.userId) throw failure('AUTHENTICATION', 401);
    return crypto.createHmac('sha256', req.sessionID).update(A.stringify([State.VERSION,
        req.session.userId, req.session.userTeam, req.session.companyInUse, req.params.id, version, targetHistoryId])).digest('base64url');
}
function descriptor(req, input, row) {
    const version = A.hash({ employee: input.currentEmployee, rows: A.ordered(input.completeHistoryRows), archives: input.archiveAudits || [] });
    return { targetHistoryId: String(row._id), version, context: context(req, version, String(row._id)) };
}
async function editorArchiveAccess(req, input, row, overrides = {}) {
    if (!row || State.archivedIds(input).has(String(row._id))) return null;
    try {
        await authorize(input, req, { ...defaults(), ...overrides });
        return descriptor(req, input, row);
    } catch (error) {
        if (error.statusCode === 403) return null;
        throw error;
    }
}
function createEmployeeHistoryArchiveService(overrides = {}) {
    const d = { ...defaults(), ...overrides };
    async function read(req, session) {
        if (!req.session?.userId) throw failure('AUTHENTICATION', 401);
        if (![req.session.userId, req.params?.id, req.session.companyInUse].every(value =>
            typeof value === 'string' && /^[a-f\d]{24}$/i.test(value))) throw failure('FORBIDDEN', 403);
        let team;
        try { team = normalizeRequiredUserTeam(req.session.userTeam); } catch { throw failure('FORBIDDEN', 403); }
        const currentEmployee = await d.employeeModel.findOne({ _id: req.params.id, team,
            company_kod: req.session.companyInUse }).select('+employee_profile_mutation_sequence').session(session).lean();
        if (!currentEmployee) throw failure('FORBIDDEN', 403);
        const scope = { team, company_kod: req.session.companyInUse, kodikos: currentEmployee.kodikos };
        const input = { scope, currentEmployee };
        const rights = await authorize(input, req, d, session);
        const company = await d.companyModel.findOne({ _id: scope.company_kod, team }).session(session).lean();
        if (!company) throw failure('FORBIDDEN', 403);
        const q = d.historyModel.find(scope); q.mongooseOptions({ includeRedundantHistoryArtifacts: true });
        input.completeHistoryRows = await q.select('+history_reference_fence').session(session).lean();
        input.protectedReferenceSummary = Object.fromEntries(input.completeHistoryRows.map(row => [String(row._id), []]));
        const approval = await require('./employeeHistoryMaintenanceApprovalService').loadMaintenanceApprovalInput(input, d.auditModel, session);
        return { ...input, ...approval, rights, company };
    }
    async function claim(collection, id, session) {
        const key = '__employee_history_archive_claim';
        if ((await collection.updateOne({ _id: id, [key]: { $exists: false } }, { $set: { [key]: true } }, { session })).matchedCount !== 1)
            throw failure('STALE');
        if ((await collection.updateOne({ _id: id, [key]: true }, { $unset: { [key]: '' } }, { session })).matchedCount !== 1)
            throw failure('STALE');
    }
    async function archive(req, body) {
        if (!body || Array.isArray(body) || !A.equal(Object.keys(body).sort(), ['confirmed', 'context', 'targetHistoryId', 'version']) ||
            body.confirmed !== true || !/^[a-f\d]{24}$/i.test(body.targetHistoryId) ||
            typeof body.targetHistoryId !== 'string' || !/^[A-Za-z\d_-]{43}$/.test(body.version) || !/^[A-Za-z\d_-]{43}$/.test(body.context)) throw failure('REQUEST', 400);
        if (!A.tokenMatches(body.context, context(req, body.version, body.targetHistoryId))) throw failure('FORBIDDEN', 403);
        try {
            return await W.inProfileTransaction(d.connection, d.capabilityProbe, async session => {
                const input = await read(req, session);
                const row = input.completeHistoryRows.find(row => String(row._id) === body.targetHistoryId);
                if (!row || require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus').isInactiveHistoryRow(row)) throw failure('NOT_FOUND', 404);
                const receiptId = new mongoose.Types.ObjectId(crypto.createHash('sha256').update(A.stringify([State.VERSION, input.scope, req.params.id, body.targetHistoryId])).digest('hex').slice(0, 24));
                const receipt = await d.auditModel.findById(receiptId).session(session).lean();
                if (receipt) {
                    if (receipt.mutationSource !== State.OPERATION || receipt.diagnostics.requestHash !== A.hash(body) ||
                        receipt.diagnostics.actorUserId !== req.session.userId) throw failure('ALREADY_ARCHIVED');
                    return { success: true, saved: true, alreadyArchived: true, targetHistoryId: body.targetHistoryId,
                        state: State.STATUS, auditId: String(receiptId) };
                }
                if (State.archivedIds(input).has(body.targetHistoryId) || !A.equal(descriptor(req, input, row),
                    { targetHistoryId: body.targetHistoryId, version: body.version, context: body.context })) throw failure('STALE');
                if (!(await d.auditStorage({ connection: d.connection })).ready) throw failure('AUDIT_UNAVAILABLE', 503);
                // Existing Employee fence serializes archive with Save, approvals
                // and reconstruction. Role/privilege/company claims serialize revocations.
                await W.acquireEmployeeMutationFence({ filter: input.scope, employeeId: req.params.id,
                    employeeModel: d.employeeModel, session });
                await claim(d.userModel.collection, input.rights.actor._id, session);
                await claim(d.privilegeModel.collection, input.rights.permission._id, session);
                await claim(d.companyModel.collection, input.company._id, session);
                const inspection = require('./employeeHistorySaveValidationService').inspectEmployeeHistorySave({
                    scope: input.scope, currentEmployee: input.currentEmployee,
                    historyRows: require('./employeeHistoryProposalReadService').proposalHistoryState(input).historyRows,
                    approvedHistoryInput: { ...input, archiveAudits: [] }, includeIssueDetails: true });
                const selected = require('./employeeHistoryProposalCaseService').selectEmployeeHistoryProposalCase(
                    { ...input, archiveAudits: [] }, { status: 'REVIEW_REQUIRED' });
                await d.auditModel.create([{ _id: receiptId, employeeScope: { ...input.scope, employee_id: input.currentEmployee._id },
                    repairedAt: new Date(), currentBefore: input.currentEmployee, historyBefore: [row], historyAfter: [row],
                    survivingHistoryIds: [String(row._id)], deletedLegacyHistoryIds: [], mutationSource: State.OPERATION,
                    diagnostics: { version: State.VERSION, outcome: 'COMMITTED', actorUserId: req.session.userId,
                        targetHistoryId: String(row._id), previousState: 'VISIBLE', newState: State.STATUS,
                        correctnessApproved: false, businessEffectRetained: true,
                        originalRowHash: State.rowHash(row), contextHash: State.contextHash(input), requestHash: A.hash(body),
                        acceptedIssues: inspection.issues.filter(issue => !issue.historyId || issue.historyId === String(row._id)).map(issue => State.issueHash(issue, input)),
                        acceptedFindings: [...selected.cases, ...(selected.reviewFindings || [])]
                            .filter(item => item.sourceHistoryIds.includes(String(row._id))).map(item => State.findingHash(input, item)) }
                }], { session });
                return { success: true, saved: true, alreadyArchived: false, targetHistoryId: body.targetHistoryId,
                    state: State.STATUS, auditId: String(receiptId) };
            }, null, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
        } catch (error) {
            if (error.hasErrorLabel?.('UnknownTransactionCommitResult')) throw failure('COMMIT_UNCERTAIN', 503);
            if (error.code === 11000 || error.code === 112 || error.hasErrorLabel?.('TransientTransactionError')) throw failure('STALE');
            throw error;
        }
    }
    return { archive, editorAccess: (req, input, row) => editorArchiveAccess(req, input, row, d) };
}
module.exports = { createEmployeeHistoryArchiveService, editorArchiveAccess, descriptor, context, failure };
