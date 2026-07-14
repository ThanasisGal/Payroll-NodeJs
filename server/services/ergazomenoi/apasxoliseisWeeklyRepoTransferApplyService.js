const DecisionModel = require('../../models/apasxoliseisWeeklyRepoTransferDecision');
const ExecutionModel = require('../../models/apasxoliseisWeeklyRepoTransferExecution');
const { validateApplyCommand, commandIdentity, validateApplySession, applyError } = require('./apasxoliseisWeeklyRepoTransferApplyCommandService');
const { preflightWeeklyRepoTransferApply } = require('./apasxoliseisWeeklyRepoTransferApplyPreflightService');
const { writeWeeklyRepoTransferAtomically } = require('./apasxoliseisWeeklyRepoTransferAtomicWriterService');

function presentation(record) { return { id: String(record._id || ''), decision_id: String(record.decision_id || ''), proposal_id: record.proposal_id, execution_status: record.execution_status, source_id: String(record.source_prodhlomena_oraria_id || ''), target_id: String(record.target_prodhlomena_oraria_id || ''), applied_at: record.applied_at }; }
function duplicate(error) { return error?.code === 11000 || error?.name === 'MongoServerError' && error?.code === 11000; }
async function lean(query) { return query && typeof query.lean === 'function' ? query.lean() : query; }
async function applyWeeklyRepoTransfer({ session, payload, decisionModel = DecisionModel, executionModel = ExecutionModel, preflight = preflightWeeklyRepoTransferApply, writer = writeWeeklyRepoTransferAtomically }) {
    const command = validateApplyCommand(payload); const scope = validateApplySession(session); const identity = commandIdentity(command);
    const result = await preflight({ session, payload: command, decisionModel, executionModel });
    if (result.idempotent) return { execution: presentation(result.execution), idempotent: true };
    try { return { execution: presentation(await writer({ plan: result.plan })), idempotent: false }; }
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
