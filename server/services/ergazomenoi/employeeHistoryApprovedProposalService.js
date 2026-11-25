'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const P = require('./employeeHistoryApprovedProposalContract');
const E = require('./employeeHistoryProposalEditorService');
const X = require('./employeeHistoryProposalXlsxService');
const W = require('./employeeEmploymentProfileWriter');
const RowApproval = require('./employeeHistoryRowApprovalService');
const FailureDiagnostics = require('./employeeHistoryApprovedProposalFailureDiagnostics');
const LegacyProtection = require('./employeeHistoryLegacyProtectionService');
const PeriodSerialization = require('./employeeHistoryPeriodSerializationService');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { authorizeEmployeeMaintenance } = require('./employeeMaintenanceAuthorizationService');
const { actorAccess } = require('./employeeHistoryAutomaticReconstructionApplyService');
const { assertEmployeeHistoryOperationsAuthorized, ACCESS_MODES } = require('./employeeHistoryAuthorizationService');
const { identifyEmployeeHistoryProblemScope } = require('./employeeHistoryProblemScopeService');
const { normalizeRequiredUserTeam } = require('../userTeamScopeService');
const ephemeralSecret = crypto.randomBytes(32).toString('hex');
const nativeClaimField = '__employee_history_approved_proposal_claim';

function defaults() {
    return {
        connection: mongoose.connection,
        employeeModel: require('../../models/ergazomenoi').ErgazomenoiModel,
        historyModel: require('../../models/ergazomenoi').IstorikoProslhpseonAllagonModel,
        auditModel: require('../../models/employeeHistoryRepairAudit'),
        userModel: require('../../models/userModel'), privilegeModel: require('../../models/privileges').UserPrivilegesModel,
        companyModel: require('../../models/companies').CompaniesModel,
        periodControlModel: require('../../models/apasxoliseisPeriodControl'),
        frozenModel: require('../../models/apasxoliseisPeriodFrozenSnapshot'),
        loadCatalogs: require('./employeeHistoryCorrectionCatalogService').loadEmployeeHistoryCorrectionCatalogs,
        referenceChecker: require('./employeeHistoryReferenceAuditService').findHistoryIdReferences,
        loadSchedules: require('./employeeHistoryMissingPeriodCorrectionService').loadPredeclaredGapScheduleRows,
        auditStorage: require('./employeeHistoryRepairAuditSetupService').getEmployeeHistoryRepairAuditStorageState,
        capabilityProbe: W.transactionCapability,
        isEnabled: () => P.enabled(),
        approvalSecret: process.env.SESSION_SECRET || process.env.SECRET || null,
        now: () => Date.now()
    };
}

// DI belongs to isolated tests, never to HTTP bodies or environment URI fallbacks.
function createEmployeeHistoryApprovedProposalService(overrides = {}) {
    const d = { ...defaults(), ...overrides };
    const secret = typeof d.approvalSecret === 'string' && d.approvalSecret.length >= 16 ? d.approvalSecret : null;
    const isEnabled = () => d.isEnabled() === true && Boolean(secret);
    const signingSecret = secret || ephemeralSecret; // OFF previews never grant a write capability.

    async function read(req, session = null) {
        const actorUserId = req.session?.userId, employeeId = req.params?.id, company = req.session?.companyInUse;
        if (!actorUserId) throw P.failure('AUTHENTICATION', 401);
        if (![actorUserId, employeeId, company].every(value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)) ||
            typeof req.sessionID !== 'string' || !req.sessionID) throw P.failure('SCOPE', 403);
        let team;
        try { team = normalizeRequiredUserTeam(req.session.userTeam); } catch { throw P.failure('SCOPE', 403); }
        const current = await d.employeeModel.findOne({ _id: employeeId, team, company_kod: company })
            .select('+employee_profile_mutation_sequence').session(session).lean();
        if (!current || String(current._id) !== employeeId || typeof current.kodikos !== 'string') throw P.failure('SCOPE', 403);
        const scope = { team, company_kod: company, kodikos: current.kodikos };
        await authorizeEmployeeMaintenance({ actorUserId, employeeId, scope, current, session,
            userModel: d.userModel, privilegeModel: d.privilegeModel });
        if (require('../../utils/ergazomenoi/employeeSaveState').isTemporaryEmployee(current)) throw P.failure('DRAFT');
        const access = await actorAccess({ actorUserId, scope, session, userModel: d.userModel });
        const companyRecord = await d.companyModel.findOne({ _id: company, team })
            .select('+employee_history_period_mutation_sequence').session(session).lean();
        if (!companyRecord) throw P.failure('SCOPE', 403);
        const query = d.historyModel.find(scope); query.mongooseOptions({ includeRedundantHistoryArtifacts: true });
        const history = await query.select('+history_reference_fence').session(session).lean();
        const references = {};
        for (const row of history) references[String(row._id)] = await d.referenceChecker({
            connection: d.connection, historyIds: [String(row._id)], session });
        const predeclaredScheduleRows = await d.loadSchedules({ scope, currentEmployee: current, historyRows: history,
            connection: d.connection, session });
        const archiveAudits = await require('./employeeHistoryArchiveStateService').loadArchives(
            { scope, currentEmployee: current }, d.auditModel, session);
        const approvedHistoryDecisions = await RowApproval.loadDecisions({ scope, currentEmployee: current }, d.auditModel, session);
        return { actorUserId, employeeId, access, scope, archiveAudits, approvedHistoryDecisions, currentEmployee: current, completeHistoryRows: history,
            protectedReferenceSummary: references, companyBusinessCode: companyRecord.kod,
            companyPeriodSequence: companyRecord.employee_history_period_mutation_sequence ?? null,
            predeclaredScheduleRows: predeclaredScheduleRows || [] };
    }
    function authorizeCase(input, selected) {
        assertEmployeeHistoryOperationsAuthorized({ accessMode: input.access.mode,
            operations: [{ state: selected.operation === 'INSERT' ? 'inserted' : 'modified',
                historyId: selected.targetHistoryId, anchorHistoryId: selected.sourceHistoryIds[0] }],
            originalHistoryRows: input.completeHistoryRows,
            problemScope: input.access.mode === ACCESS_MODES.SUPERVISOR_PROBLEM_SCOPE ? identifyEmployeeHistoryProblemScope(input) : null });
    }
    async function prepare(req, proposal, input, session = null) {
        P.request(proposal);
        const catalogs = await d.loadCatalogs({ session });
        let baseline;
        try { baseline = await X.buildEmployeeHistoryProposalWorkbook(input, catalogs, { selection: proposal.selection }); }
        catch { throw P.failure('STALE'); }
        const selected = baseline.caseSelection.selectedCase;
        if (!baseline.workbook || !selected || !['UPDATE', 'INSERT'].includes(selected.operation)) throw P.failure('CASE');
        const original = input.completeHistoryRows.find(row => String(row._id) === selected.targetHistoryId);
        if (require('./employeeHistoryArchiveStateService').archivedIds(input).has(selected.targetHistoryId)) throw P.failure('STALE');
        try {
            authorizeCase(input, selected);
            let completions;
            try { completions = E.prepareLocalCompletion(baseline, proposal.completion, req, catalogs); }
            catch (cause) {
                const error = P.failure(cause.statusCode === 409 ? 'STALE' : 'VALUE', [403, 409].includes(cause.statusCode) ? cause.statusCode : 422);
                if (cause.validationIssues?.length) error.problems = require('./employeeHistoryApprovedProposalDiagnostics')
                    .incompleteProblems({ issues: cause.validationIssues });
                throw error;
            }
            const evidence = completions.find(item => item.entry.role === 'EVIDENCE')?.raw ?? '';
            const declaration = completions.find(item => item.entry.role === 'DECLARATION')?.raw ?? 'Όχι';
            if (typeof evidence !== 'string' || evidence.length > 4000 || !['Ναι', 'Όχι'].includes(declaration)) throw P.failure('VALUE', 422);
            if (selected.operation === 'UPDATE' && (!original || isInactiveHistoryRow(original))) throw P.failure('CASE');
            return await RowApproval.prepare({ input, baseline, completions, original, dependencies: d, session, evidence, declaration });
        } catch (error) {
            if (!error.problems?.length && error.reason) error.problems = require('./employeeHistoryApprovedProposalDiagnostics')
                .incompleteProblems({ issues: [{ reason: error.reason, check: 'HISTORY_CONTEXT' }] });
            error.proposalCase = { operation: selected.operation, historySequence: original?.aa_eggrafhs || null,
                period: { from: selected.period.from, to: selected.period.to } };
            throw error;
        }
    }
    const binding = (req, input) => ({ actorUserId: input.actorUserId, employeeId: input.employeeId, scope: input.scope,
        session: crypto.createHmac('sha256', signingSecret).update(req.sessionID).digest('hex') });
    function checkBinding(req, proposal, input, payload) {
        if (!A.equal(payload.binding, binding(req, input)) || payload.requestHash !== A.hash(proposal)) throw P.failure('APPROVAL');
    }
    async function claim(collection, id, session) {
        const identity = { _id: id, [nativeClaimField]: { $exists: false } };
        const result = await collection.updateOne(identity, { $set: { [nativeClaimField]: true } }, { session });
        if (result.matchedCount !== 1) throw P.failure('STALE');
        if ((await collection.updateOne({ _id: id, [nativeClaimField]: true }, { $unset: { [nativeClaimField]: 1 } }, { session })).matchedCount !== 1)
            throw P.failure('STALE');
    }
    async function receipt(input, payload, session) {
        const audit = await d.auditModel.findById(payload.approvalId.slice(0, 24)).session(session).lean();
        if (!audit) return null;
        if (audit.mutationSource !== P.OPERATION || audit.diagnostics?.approvalId !== payload.approvalId ||
            !A.equal(audit.diagnostics.binding, payload.binding) || audit.diagnostics.fingerprint !== payload.fingerprint ||
            audit.diagnostics.requestHash !== payload.requestHash || !A.equal(audit.employeeScope, { ...input.scope, employee_id: input.currentEmployee._id }))
            throw P.failure('APPROVAL');
        if (audit.diagnostics.rowApproval) {
            let verified;
            try { verified = RowApproval.verify(input, audit); }
            catch { const error = P.failure('COMMITTED_STATE_CHANGED'); error.saved = true; throw error; }
            const selectedReferenceIds = new Set(Object.values(audit.diagnostics.referenceEvidence).filter(Array.isArray).flat().map(reference => reference.documentId));
            for (const proof of audit.diagnostics.periodProtection.wire.filter(proof => proof.collection === 'Apasxoliseis_Period_Frozen_Snapshots')) {
                const identity = mongoose.mongo.BSON.deserialize(Buffer.from(proof.identityBson, 'base64'));
                if (!selectedReferenceIds.has(String(identity._id))) continue;
                const raw = await d.connection.collection(proof.collection).findOne(identity, { session, raw: true });
                if (!Buffer.isBuffer(raw) || crypto.createHash('sha256').update(raw).digest('hex') !== proof.sha256) {
                    const error = P.failure('COMMITTED_STATE_CHANGED'); error.saved = true; throw error;
                }
            }
            let verificationRecorded = false;
            if (audit.diagnostics.rowApproval.status !== RowApproval.STATUS) {
                // This is a NEW transaction reading the committed decision. Only
                // after this independent verification is the terminal status saved.
                await claim(d.userModel.collection, new mongoose.Types.ObjectId(input.actorUserId), session);
                const permission = await d.privilegeModel.findOne({ userId: input.actorUserId, form: 'Ergazomenoi' }).session(session).lean();
                if (!permission) throw P.failure('RIGHTS', 403);
                await claim(d.privilegeModel.collection, permission._id, session);
                await require('./employeeHistoryReferenceWriteFenceService').claimUnchangedHistoryReferences({
                    historyRows: [audit.diagnostics.actualAfter], scope: input.scope, historyModel: d.historyModel, session });
                const result = await d.auditModel.collection.updateOne({ _id: audit._id,
                    'diagnostics.rowApproval.status': 'COMMITTED_AWAITING_VERIFICATION',
                    'diagnostics.rowApproval.verification': { $exists: false } }, { $set: {
                    'diagnostics.rowApproval.status': RowApproval.STATUS,
                    'diagnostics.rowApproval.verification': { version: RowApproval.VERSION, verifiedAt: new Date(d.now()),
                        persistedRowHash: audit.diagnostics.rowApproval.persistedRowHash,
                        approvedContentHash: audit.diagnostics.rowApproval.approvedContentHash, actorUserId: input.actorUserId }
                } }, { session });
                if (result.matchedCount !== 1) throw P.failure('VERIFICATION');
                verificationRecorded = true;
            }
            return { success: true, saved: true, applied: false, alreadyApplied: true, outcome: 'COMMITTED',
                ...verified, verificationRecorded, approvalId: payload.approvalId, auditId: String(audit._id),
                operation: audit.diagnostics.operation, targetHistoryId: audit.diagnostics.targetHistoryId };
        }
        throw P.failure('APPROVAL');
    }
    async function preview(req, proposal) {
        let stage = 'PREVIEW_TRANSACTION_OPEN';
        try {
            // A consistent snapshot, with no claims, writes or session-store
            // mutation. A preview must never combine different stored versions.
            return await W.inProfileTransaction(d.connection, d.capabilityProbe, async session => {
                stage = 'PREVIEW_READ';
                const input = await read(req, session);
                stage = 'PREVIEW_PREPARE';
                const prepared = await prepare(req, proposal, input, session);
                stage = 'PREVIEW_RESPONSE';
                const payload = { version: P.VERSION, purpose: 'APPLY', approvalId: crypto.randomBytes(32).toString('hex'),
                    expiresAt: d.now() + 15 * 60 * 1000, binding: binding(req, input),
                    fingerprint: prepared.fingerprint, requestHash: A.hash(proposal), approved: prepared.declaration === 'Ναι',
                    executionEnabled: isEnabled() && prepared.declaration === 'Ναι' };
                return { success: true, saved: false, previewOnly: true, executionEnabled: payload.executionEnabled, approved: payload.approved,
                    operation: prepared.operation, caseId: prepared.caseId, targetHistoryId: prepared.targetHistoryId,
                    employeeCode: input.scope.kodikos, historySequence: input.completeHistoryRows.find(row => String(row._id) === prepared.targetHistoryId)?.aa_eggrafhs || null,
                    period: prepared.period, rows: prepared.rows, evidence: prepared.evidence, declaration: prepared.declaration,
                    certification: prepared.certification,
                    beforePeriodEvidence: prepared.affected.beforeEvidence || null,
                    protectedReferences: Object.values(prepared.referenceEvidence).filter(Array.isArray).flat()
                        .map(reference => ({ collection: reference.collection, documentId: reference.documentId, bsonSha256: reference.bsonSha256 })),
                    physicalWrites: { history: { operation: prepared.operation, targetHistoryId: prepared.targetHistoryId,
                        fields: prepared.rowApproval && prepared.rowApproval.mode !== 'PHYSICAL_UPDATE' ? [] : Object.keys(prepared.patch),
                        mode: prepared.rowApproval?.mode || prepared.operation, revisionField: 'updatedAt',
                        coordinatedRows: null },
                        employee: { fields: ['employee_profile_mutation_sequence'] }, audit: { rows: 1 },
                        company: prepared.rowApproval ? { fields: [PeriodSerialization.field] } : null,
                        referencePayloadsModified: false, finalizedResultsModified: false },
                    certificationApproval: null,
                    approval: { token: P.sign(payload, signingSecret), approvalId: payload.approvalId }, historyStatus: 'REVIEW_REQUIRED' };
            }, null, P.transactionOptions);
        } catch (error) {
            FailureDiagnostics.capture(error, stage);
            if (error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE') throw FailureDiagnostics.translate(P.failure('TRANSACTIONS_UNAVAILABLE', 503), error);
            throw error;
        }
    }
    async function apply(req, body) {
        // This check precedes all reads, session creation, fences and audit writes.
        if (!isEnabled()) throw P.failure('DISABLED', 403);
        if (!P.exactKeys(body, ['proposal', 'approval']) ||
            !P.exactKeys(body.approval, ['token', 'confirmed']) || body.approval.confirmed !== true) throw P.failure('APPROVAL', 400);
        P.request(body.proposal);
        const payload = P.verify(body.approval.token, signingSecret);
        if (payload.purpose !== 'APPLY') throw P.failure('APPROVAL');
        if (payload.approved !== true) throw P.failure('APPROVAL_REQUIRED', 422);
        if (payload.executionEnabled !== true) throw P.failure('DISABLED', 403);
        let stage = 'TRANSACTION_OPEN';
        try {
            const committed = await W.inProfileTransaction(d.connection, d.capabilityProbe, async session => {
                if (!isEnabled()) throw P.failure('DISABLED', 403);
                stage = 'READ_AND_BIND';
                const input = await read(req, session); checkBinding(req, body.proposal, input, payload);
                stage = 'EXISTING_RECEIPT';
                const completed = await receipt(input, payload, session); if (completed) return completed;
                if (payload.expiresAt < d.now()) throw P.failure('EXPIRED');
                stage = 'COMPANY_SERIALIZATION';
                const companySerialization = await PeriodSerialization.claimCompanyPeriodSerialization({ connection: d.connection, scope: input.scope, session });
                stage = 'PREPARE_PROPOSAL';
                const prepared = await prepare(req, body.proposal, input, session);
                if (prepared.declaration !== 'Ναι') throw P.failure('APPROVAL_REQUIRED', 422);
                if (prepared.fingerprint !== payload.fingerprint) throw P.failure('STALE');
                stage = 'AUDIT_STORAGE';
                if (!(await d.auditStorage({ connection: d.connection })).ready) throw P.failure('AUDIT_UNAVAILABLE', 503);
                stage = 'AUTHORIZATION_CLAIMS';
                await claim(d.userModel.collection, new mongoose.Types.ObjectId(input.actorUserId), session);
                const permission = await d.privilegeModel.findOne({ userId: input.actorUserId, form: 'Ergazomenoi' }).session(session).lean();
                if (!permission) throw P.failure('RIGHTS', 403);
                await claim(d.privilegeModel.collection, permission._id, session);
                await claim(d.companyModel.collection, new mongoose.Types.ObjectId(input.scope.company_kod), session);
                for (const control of prepared.protection.controls) await claim(d.periodControlModel.collection, control._id, session);
                stage = 'EMPLOYEE_FENCE';
                await W.acquireEmployeeMutationFence({ filter: input.scope, employeeId: input.employeeId,
                    employeeModel: d.employeeModel, session, notFoundCode: P.OPERATION + '_STALE' });
                stage = 'HISTORY_REFERENCE_CLAIMS';
                await require('./employeeHistoryReferenceWriteFenceService').claimUnchangedHistoryReferences({
                    historyRows: input.completeHistoryRows, scope: input.scope, historyModel: d.historyModel, session });
                stage = 'DEPENDENT_REFERENCE_CLAIMS';
                await require('./employeeHistorySettlementReferenceEvidence').claimReferenceEvidence(
                    d.connection, prepared.referenceEvidence, session, payload.approvalId);
                stage = 'PERIOD_PROTECTION_CLAIMS';
                await LegacyProtection.claimLegacyProtection({ protection: prepared.protection, connection: d.connection, session });
                stage = 'VERIFY_FENCED_EMPLOYEE';
                const current = await d.employeeModel.findOne({ ...input.scope, _id: input.employeeId })
                    .select('+employee_profile_mutation_sequence').session(session).lean();
                const expectedCurrent = { ...input.currentEmployee,
                    employee_profile_mutation_sequence: (input.currentEmployee.employee_profile_mutation_sequence || 0) + 1 };
                if (!A.equal(current, expectedCurrent)) throw P.failure('STALE');
                const proof = P.sealExecution({ ...prepared, scope: input.scope, current, originalCurrent: input.currentEmployee,
                    before: input.completeHistoryRows, payload, companySerialization, isEnabled, actorUserId: input.actorUserId });
                stage = 'EXECUTE_WRITER';
                const result = await W.executeEmployeeHistoryApprovedProposalPlan({ proof, employeeId: input.employeeId, session,
                    employeeModel: d.employeeModel, historyModel: d.historyModel, auditModel: d.auditModel });
                if (!isEnabled()) throw P.failure('DISABLED', 403);
                stage = 'TRANSACTION_COMMIT';
                return result;
            }, null, P.transactionOptions);
            // A new majority/snapshot read AFTER transaction commit. The writer's
            // in-transaction reread alone is not a persisted completion result.
            let verified;
            stage = 'POST_COMMIT_VERIFICATION';
            try { verified = await reconcile(req, { proposal: body.proposal, token: body.approval.token }); }
            catch (error) {
                if (error.saved === true) throw error;
                const failure = P.failure('COMMITTED_VERIFICATION_REQUIRED', 503); failure.saved = true;
                throw FailureDiagnostics.translate(failure, FailureDiagnostics.capture(error, stage));
            }
            return { ...verified, applied: committed.applied, alreadyApplied: committed.alreadyApplied };
        } catch (error) {
            FailureDiagnostics.capture(error, stage);
            if (error.code === 'EMPLOYEE_PROFILE_TRANSACTIONS_UNAVAILABLE') throw FailureDiagnostics.translate(P.failure('TRANSACTIONS_UNAVAILABLE', 503), error);
            if (error.hasErrorLabel?.('UnknownTransactionCommitResult') || error.errorLabels?.includes('UnknownTransactionCommitResult')) throw FailureDiagnostics.translate(P.failure('COMMIT_UNCERTAIN', 503), error);
            if (error.hasErrorLabel?.('TransientTransactionError') || error.code === 112 || error.code === 11000) throw FailureDiagnostics.translate(P.failure('STALE'), error);
            throw error;
        }
    }
    async function reconcile(req, body) {
        if (!P.exactKeys(body, ['proposal', 'token'])) throw P.failure('REQUEST', 400);
        P.request(body.proposal);
        const payload = P.verify(body.token, signingSecret);
        if (payload.purpose !== 'APPLY') throw P.failure('APPROVAL');
        let stage = 'RECONCILE_TRANSACTION_OPEN';
        try {
            return await W.inProfileTransaction(d.connection, d.capabilityProbe, async session => {
                stage = 'RECONCILE_READ_AND_BIND';
                const input = await read(req, session); checkBinding(req, body.proposal, input, payload);
                stage = 'RECONCILE_RECEIPT';
                const completed = await receipt(input, payload, session);
                if (!completed) throw P.failure('COMMIT_UNCERTAIN', 503);
                stage = 'RECONCILE_TRANSACTION_COMMIT';
                return { ...completed, reconciledReadOnly: !completed.verificationRecorded };
            }, null, P.transactionOptions);
        } catch (error) { throw FailureDiagnostics.capture(error, stage); }
    }
    return { preview, apply, reconcile, isEnabled };
}
module.exports = { createEmployeeHistoryApprovedProposalService };
