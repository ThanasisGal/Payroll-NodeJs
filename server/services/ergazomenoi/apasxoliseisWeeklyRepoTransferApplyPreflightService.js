const { fingerprintSnapshot, reconstructWeeklyRepoTransferDecision } = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');
const { applyError, validateApplyCommand, commandIdentity, validateApplySession } = require('./apasxoliseisWeeklyRepoTransferApplyCommandService');

const APPLY_FIELDS = Object.freeze(['kathgoria_ergasias_apologistika','repo_apologistika','adeia_apologistika','kathgoria_adeias_apologistika','ores_apoysias_apologistika','apo_ora_01_apologistika','eos_ora_01_apologistika','apo_ora_02_apologistika','eos_ora_02_apologistika','apo_ora_03_apologistika','eos_ora_03_apologistika','ores_ergasias_apologistika']);
const APPLY_FIELD_SET = new Set(APPLY_FIELDS);
function lean(query) { return query && typeof query.lean === 'function' ? query.lean() : query; }
function dateKey(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10); }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function pick(values) { return Object.fromEntries(APPLY_FIELDS.map((field) => [field, values?.[field] === undefined ? null : values[field]])); }
function validateProposed(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).some((field) => !APPLY_FIELD_SET.has(field))) throw applyError('UNSUPPORTED_PROPOSED_FIELD', 409);
    return Object.freeze({ ...values });
}
async function preflightWeeklyRepoTransferApply({ session, payload, executionModel, decisionModel, reconstruct = reconstructWeeklyRepoTransferDecision, fingerprint = fingerprintSnapshot }) {
    const command = validateApplyCommand(payload); const scope = validateApplySession(session); const identity = commandIdentity(command);
    const requestExecution = await lean(executionModel.findOne({ team: scope.team, company_kod: scope.company_kod, request_id: command.request_id }));
    if (requestExecution) {
        if (requestExecution.command_identity === identity) return { execution: requestExecution, idempotent: true };
        throw applyError('REQUEST_ID_CONFLICT', 409);
    }
    const decision = await lean(decisionModel.findOne({ _id: command.decision_id, team: scope.team, company_kod: scope.company_kod }));
    if (!decision) throw applyError('DECISION_NOT_FOUND', 404);
    if (decision.decision_code !== 'APPROVE_PROPOSAL' || decision.decision_status !== 'RECORDED') throw applyError('DECISION_NOT_APPROVED', 409);
    if (await lean(executionModel.findOne({ decision_id: command.decision_id }))) throw applyError('DECISION_ALREADY_APPLIED', 409);
    const immutableSnapshot = decision.canonical_snapshot;
    const reconstructionCommand = { proposal_id: immutableSnapshot.proposal_id, expected_source_id: immutableSnapshot.source.prodhlomena_oraria_id, expected_target_id: immutableSnapshot.target.prodhlomena_oraria_id, expected_proposal_version: immutableSnapshot.proposal_version, expected_choice_code: immutableSnapshot.choice_code };
    const rebuilt = await reconstruct({ scope, command: reconstructionCommand });
    if (rebuilt.fingerprint !== decision.snapshot_fingerprint || fingerprint(immutableSnapshot) !== decision.snapshot_fingerprint) throw applyError('STALE_FINGERPRINT', 409);
    const current = rebuilt.snapshot;
    if (String(current.source.prodhlomena_oraria_id) !== String(immutableSnapshot.source.prodhlomena_oraria_id) || String(decision.source_prodhlomena_oraria_id) !== String(immutableSnapshot.source.prodhlomena_oraria_id)) throw applyError('PAIR_IDENTITY_MISMATCH', 409);
    if (String(current.target.prodhlomena_oraria_id) !== String(immutableSnapshot.target.prodhlomena_oraria_id) || String(decision.target_prodhlomena_oraria_id) !== String(immutableSnapshot.target.prodhlomena_oraria_id)) throw applyError('PAIR_IDENTITY_MISMATCH', 409);
    for (const field of ['team','company_kod','ypokatasthma','employee_id','employee_kodikos']) if (String(current[field]) !== String(immutableSnapshot[field]) || String(decision[field]) !== String(immutableSnapshot[field])) throw applyError('SCOPE_MISMATCH', 409);
    if (dateKey(current.week_start) !== dateKey(immutableSnapshot.week_start) || dateKey(current.week_end) !== dateKey(immutableSnapshot.week_end) || dateKey(decision.week_start) !== dateKey(immutableSnapshot.week_start) || dateKey(decision.week_end) !== dateKey(immutableSnapshot.week_end)) throw applyError('SCOPE_MISMATCH', 409);
    if (!equal(current.source.current_values, immutableSnapshot.source.current_values)) throw applyError('SOURCE_STALE', 409);
    if (!equal(current.target.current_values, immutableSnapshot.target.current_values)) throw applyError('TARGET_STALE', 409);
    if (current.source.lock_state || immutableSnapshot.source.lock_state) throw applyError('SOURCE_LOCKED', 409);
    if (current.target.lock_state || immutableSnapshot.target.lock_state) throw applyError('TARGET_LOCKED', 409);
    const sourceAfter = validateProposed(immutableSnapshot.source.proposed_values); const targetAfter = validateProposed(immutableSnapshot.target.proposed_values);
    return { idempotent: false, plan: Object.freeze({ decision, scope, source: Object.freeze({ id: String(immutableSnapshot.source.prodhlomena_oraria_id), date: immutableSnapshot.source.hmeromhnia, before: Object.freeze(pick(immutableSnapshot.source.current_values)), after: sourceAfter }), target: Object.freeze({ id: String(immutableSnapshot.target.prodhlomena_oraria_id), date: immutableSnapshot.target.hmeromhnia, before: Object.freeze(pick(immutableSnapshot.target.current_values)), after: targetAfter }), actor: Object.freeze({ id: scope.created_by_user_id, name: scope.created_by_user_name, role: scope.created_by_user_role }), request_id: command.request_id, command_identity: identity }) };
}

module.exports = { APPLY_FIELDS, pick, validateProposed, preflightWeeklyRepoTransferApply };
