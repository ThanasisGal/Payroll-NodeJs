'use strict';
const mongoose = require('mongoose');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
const UserModel = require('../../models/userModel');
const AuditModel = require('../../models/employeeHistoryRepairAudit');
const { inProfileTransaction, acquireEmployeeMutationFence, transactionCapability, executeEmployeeHistoryAutomaticReconstructionPlan } = require('./employeeEmploymentProfileWriter');
const { employeeHistoryRepairAuditCollectionExists } = require('./employeeHistoryRepairAuditSetupService');
const { accessForUser, ACCESS_MODES, assertEmployeeHistoryOperationsAuthorized } = require('./employeeHistoryAuthorizationService');
const { normalizeRequiredUserTeam, CANONICAL_ALL_TEAMS_CODE } = require('../userTeamScopeService');
const { identifyEmployeeHistoryProblemScope } = require('./employeeHistoryProblemScopeService');
const { planEmployeeHistoryAutomaticReconstruction: planner } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { findHistoryIdReferences } = require('./employeeHistoryReferenceAuditService');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');

async function readHistory(historyModel, scope, session) {
    const query = historyModel.find(scope);
    query.mongooseOptions({ includeRedundantHistoryArtifacts: true });
    return query.select('+history_reference_fence').session(session).lean();
}
async function actorAccess({ actorUserId, userModel, session, scope }) {
    const user = actorUserId ? await userModel.findById(actorUserId).select('privileges team situation').session(session).lean() : null;
    const access = accessForUser(user);
    const team = user ? normalizeRequiredUserTeam(user.team) : null;
    if (!team || (team !== CANONICAL_ALL_TEAMS_CODE && team !== scope.team)) throw A.failure('FORBIDDEN', 403);
    if (access.mode === ACCESS_MODES.NONE) throw A.failure('FORBIDDEN', 403);
    return access;
}
async function authorize({ actorUserId, userModel, session, scope, current, history, plan }) {
    const access = await actorAccess({ actorUserId, userModel, session, scope });
    assertEmployeeHistoryOperationsAuthorized({ accessMode: access.mode,
        operations: [...new Set(plan.rowDiffs.map(diff => String(diff.historyId)))].map(historyId => ({ state: 'modified', historyId })),
        originalHistoryRows: history,
        problemScope: access.mode === ACCESS_MODES.SUPERVISOR_PROBLEM_SCOPE
            ? identifyEmployeeHistoryProblemScope({ scope, currentEmployee: current, completeHistoryRows: history }) : null });
}
function buildAutomaticReconstructionAudit({ scope, current, history, physicalPlan, plan, actorUserId, previewToken, persistedToken }) {
    return { employeeScope: { ...scope, employee_id: current._id },
    currentBefore: current, historyBefore: history, historyAfter: physicalPlan.expectedRows,
    survivingHistoryIds: history.map(row => String(row._id)), deletedLegacyHistoryIds: [],
    repairedAt: new Date(), mutationSource: A.OPERATION,
    diagnostics: { operation: A.OPERATION, version: A.APPLY_VERSION, engineVersion: C.VERSION,
        actor: { userId: String(actorUserId) }, semanticFingerprint: plan.semanticFingerprint,
        applyTokenHash: A.hash(previewToken), persistedStateHash: A.hash(persistedToken),
        plannerStatus: plan.status, assumptionCount: plan.assumptions.length, warningCount: plan.warnings.length,
        provenanceCounts: plan.diagnostics.provenanceCounts,
        affectedStableIds: physicalPlan.rowsToUpdate.map(update => update.historyId),
        changedFieldNames: [...new Set(plan.rowDiffs.map(diff => diff.field))].sort(),
        changedFieldCount: plan.rowDiffs.length, approvalAccepted: true }
            };
}

async function applyEmployeeHistoryAutomaticReconstruction({ scope, employeeId, previewToken, approvalAccepted,
    actorUserId, connection = mongoose.connection, employeeModel = ErgazomenoiModel,
    historyModel = IstorikoProslhpseonAllagonModel, auditModel = AuditModel, userModel = UserModel,
    capabilityProbe = transactionCapability, referenceChecker = findHistoryIdReferences, auditCollectionChecker = employeeHistoryRepairAuditCollectionExists } = {}) {
    if (approvalAccepted !== true) throw A.failure('APPROVAL_REQUIRED', 400);
    if (!actorUserId) throw A.failure('FORBIDDEN', 403);
    if (typeof previewToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(previewToken)) throw A.failure('INVALID_REQUEST', 400);
    if (!C.SCOPE_FIELDS.every(field => typeof scope?.[field] === 'string' && scope[field].trim()) || !employeeId) {
        throw A.failure('INVALID_REQUEST', 400);
    }
    // A controlled no-op abort also rolls back the technical Employee fence.
    // Driver retries only transaction conflicts; stale errors never retry.
    const noOp = Symbol('automaticReconstructionNoOp');
    try {
        return await inProfileTransaction(connection, capabilityProbe, async session => {
            await acquireEmployeeMutationFence({ filter: scope, employeeId, employeeModel, session, notFoundCode: A.PREFIX + 'STALE' });
            const current = await employeeModel.findOne({ ...scope, _id: employeeId }).select('+employee_profile_mutation_sequence').session(session).lean();
            if (!current) throw A.failure('STALE');
            const history = await readHistory(historyModel, scope, session);
            const plan = planner({ scope, currentEmployee: current, completeHistoryRows: history });
            const freshToken = A.buildAutomaticReconstructionPreviewToken({ scope, currentEmployee: current, completeHistoryRows: history, plan });
            const matching = A.tokenMatches(previewToken, freshToken);
            // Exact duplicate recognition is scoped to this employee and actor,
            // and proves the entire non-informational persisted state still matches.
            let completed = null;
            if (!matching && A.isNoOp(plan)) {
                completed = await auditModel.findOne({ mutationSource: A.OPERATION,
                    'employeeScope.employee_id': current._id, ...Object.fromEntries(C.SCOPE_FIELDS.map(field => [`employeeScope.${field}`, scope[field]])),
                    'diagnostics.applyTokenHash': A.hash(previewToken), 'diagnostics.actor.userId': String(actorUserId)
                }).session(session).lean();
                if (!completed || completed.diagnostics.persistedStateHash !== A.hash(freshToken)) throw A.failure('STALE');
            } else if (!matching) throw A.failure('STALE');
            if (A.isNoOp(plan)) {
                // No mutation is authorized or attempted on this path. Still
                // require an active History actor before disclosing its result.
                await actorAccess({ actorUserId, userModel, session, scope });
                throw { [noOp]: true, result: { success: true, applied: false, alreadyApplied: Boolean(completed),
                    changedRows: 0, changedFields: 0, message: 'Το Ιστορικό είναι ήδη τακτοποιημένο.' } };
            }
            if (!['PLANNED', 'REVIEW_REQUIRED'].includes(plan.status)) throw A.failure('BLOCKED');
            await authorize({ actorUserId, userModel, session, scope, current, history, plan });
            const physicalPlan = A.buildAutomaticReconstructionPhysicalPlan({ plan, completeHistoryRows: history });
            A.assertAutomaticReconstructionBoundary({ plan, completeHistoryRows: history, physicalPlan });
            const expectedPlan = planner({ scope, currentEmployee: current, completeHistoryRows: physicalPlan.expectedRows });
            const persistedToken = A.buildAutomaticReconstructionPreviewToken({ scope, currentEmployee: current,
                completeHistoryRows: physicalPlan.expectedRows, plan: expectedPlan });
            const auditRecord = buildAutomaticReconstructionAudit({ scope, current, history, physicalPlan,
                plan, actorUserId, previewToken, persistedToken });
            return executeEmployeeHistoryAutomaticReconstructionPlan({ physicalPlan, currentBefore: current,
                filter: scope, employeeId, session, employeeModel, historyModel, auditModel,
                connection, auditCollectionChecker, referenceChecker,
                automaticReconstructionPlan: plan, automaticHistoryBefore: history, automaticAuditRecord: auditRecord });
        });
    } catch (error) {
        if (error?.[noOp]) return error.result;
        // A lost commit acknowledgement cannot truthfully be reported as a
        // rollback. The same token remains safe for completed-action detection.
        if (error?.hasErrorLabel?.('UnknownTransactionCommitResult') ||
            error?.errorLabels?.includes('UnknownTransactionCommitResult')) throw A.failure('COMMIT_UNCERTAIN', 503);
        throw error;
    }
}
module.exports = { applyEmployeeHistoryAutomaticReconstruction, actorAccess, authorize, buildAutomaticReconstructionAudit };
