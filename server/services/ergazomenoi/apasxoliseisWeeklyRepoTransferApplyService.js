const DecisionModel = require('../../models/apasxoliseisWeeklyRepoTransferDecision');
const ExecutionModel = require('../../models/apasxoliseisWeeklyRepoTransferExecution');
const { validateApplyCommand, commandIdentity, validateApplySession, applyError } = require('./apasxoliseisWeeklyRepoTransferApplyCommandService');
const { preflightWeeklyRepoTransferApply } = require('./apasxoliseisWeeklyRepoTransferApplyPreflightService');
const { writeWeeklyRepoTransferAtomically } = require('./apasxoliseisWeeklyRepoTransferAtomicWriterService');

function presentation(record) { return { id: String(record._id || ''), decision_id: String(record.decision_id || ''), proposal_id: record.proposal_id, execution_status: record.execution_status, source_id: String(record.source_prodhlomena_oraria_id || ''), target_id: String(record.target_prodhlomena_oraria_id || ''), applied_at: record.applied_at }; }
function duplicate(error) { return error?.code === 11000 || error?.name === 'MongoServerError' && error?.code === 11000; }
async function lean(query) { return query && typeof query.lean === 'function' ? query.lean() : query; }
async function applyWeeklyRepoTransfer({ session, payload, decisionModel = DecisionModel, executionModel = ExecutionModel,
    preflight = preflightWeeklyRepoTransferApply, writer = writeWeeklyRepoTransferAtomically, periodWriteGuard, periodFence,
    authorizationMetadata = null, writerOptions = null, revalidateInTransaction = false, refreshDecisionInTransaction = false }) {
    const command = validateApplyCommand(payload); const scope = validateApplySession(session); const identity = commandIdentity(command);
    const result = await preflight({ session, payload: command, decisionModel, executionModel });
    if (result.idempotent) return { execution: presentation(result.execution), idempotent: true };
    if (typeof periodWriteGuard === 'function') await periodWriteGuard({ plan: result.plan });
    const plan = authorizationMetadata
        ? Object.freeze({ ...result.plan, authorization_metadata: authorizationMetadata })
        : result.plan;
    const revalidate = revalidateInTransaction ? async dbSession => {
        const R = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');
        const snapshot = plan.decision.canonical_snapshot;
        const rebuilt = await R.reconstructWeeklyRepoTransferDecision({ scope, session: dbSession, command: {
            proposal_id: snapshot.proposal_id, expected_source_id: snapshot.source.prodhlomena_oraria_id,
            expected_target_id: snapshot.target.prodhlomena_oraria_id,
            expected_proposal_version: snapshot.proposal_version, expected_choice_code: snapshot.choice_code
        } });
        if (rebuilt.fingerprint !== plan.decision.snapshot_fingerprint) throw applyError('STALE_FINGERPRINT', 409);
        if (refreshDecisionInTransaction) {
            // Bulk maps are preview data. Validate the persisted immutable
            // decision again in this attempt, rather than trusting that map.
            const currentDecision = await decisionModel.findOne({ _id: command.decision_id,
                team: scope.team, company_kod: scope.company_kod }).session(dbSession).lean();
            require('./apasxoliseisWeeklyRepoTransferApplyPreflightService')
                .preflightWeeklyRepoTransferApplyPrepared({ session, payload: command,
                    decision: currentDecision, rebuilt });
        }
        await require('./apasxoliseisWeeklyRepoTransferInputWriteFenceService').claimWeeklyRepoTransferInputs({ rebuilt, scope, session: dbSession });
        const { IstorikoProslhpseonAllagonModel: historyModel } = require('../../models/ergazomenoi');
        const identity = { team: scope.team, company_kod: scope.company_kod, kodikos: plan.decision.employee_kodikos };
        const historyRows = await historyModel.find(identity).select('+history_reference_fence').session(dbSession).lean();
        await require('./employeeHistoryReferenceWriteFenceService').claimUnchangedHistoryReferences({
            historyRows, scope: identity, historyModel, session: dbSession });
    } : null;
    try { return { execution: presentation(await writer({ plan, periodFence, revalidate,
        ...(writerOptions || {}) })), idempotent: false }; }
    catch (error) {
        const byRequest = await lean(executionModel.findOne({ team: scope.team, company_kod: scope.company_kod, request_id: command.request_id }));
        const byDecision = await lean(executionModel.findOne({ decision_id: command.decision_id, team: scope.team, company_kod: scope.company_kod }));
        if (byRequest) {
            if (byRequest.command_identity === identity && String(byRequest.decision_id) === command.decision_id) return { execution: presentation(byRequest), idempotent: true };
            throw applyError('REQUEST_ID_CONFLICT', 409);
        }
        if (byDecision) throw applyError('DECISION_ALREADY_APPLIED', 409);
        throw error;
    }
}

module.exports = { presentation, duplicate, applyWeeklyRepoTransfer };
