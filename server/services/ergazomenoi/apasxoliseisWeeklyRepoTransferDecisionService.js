const mongoose = require('mongoose');
const crypto = require('crypto');
const DecisionModel = require('../../models/apasxoliseisWeeklyRepoTransferDecision');
const { validateSessionScope } = require('./apasxoliseisPolicyPreviewApprovalService');
const { reconstructWeeklyRepoTransferDecision } = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');
const { getAtomicPeriodRangeDiagnostic } = require('./apasxoliseisWeeklyRepoTransferAtomicPageProjectionService');

const DECISION_CODES = Object.freeze(['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'NEEDS_MORE_REVIEW']);
const DECISION_ALLOWED_ROLES = Object.freeze(['A', 'S', 'HR']);
const COMMAND_KEYS = Object.freeze(['proposal_id','expected_source_id','expected_target_id','expected_proposal_version','expected_choice_code','decision_code','notes','request_id']);
const MAX_COMMAND_BYTES = 16 * 1024;

function errorWithStatus(message, statusCode) { const error = new Error(message); error.statusCode = statusCode; return error; }
function decisionAuthorizationError() {
    const error = errorWithStatus('Δεν έχετε δικαίωμα καταγραφής απόφασης.', 403);
    error.code = 'DECISION_NOT_AUTHORIZED';
    return error;
}
function text(value, max) { return String(value ?? '').trim().slice(0, max); }
function isWeeklyRepoTransferDecisionRoleAllowed(role) {
    return DECISION_ALLOWED_ROLES.includes(String(role ?? '').trim().toUpperCase());
}
function assertWeeklyRepoTransferDecisionAuthorization(session = {}) {
    let scope;
    try {
        scope = validateSessionScope(session);
    } catch {
        throw decisionAuthorizationError();
    }
    if (!isWeeklyRepoTransferDecisionRoleAllowed(scope.created_by_user_role)) {
        throw decisionAuthorizationError();
    }
    return scope;
}
function validateCommand(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw errorWithStatus('Μη έγκυρη εντολή απόφασης.', 400);
    let bytes; try { bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8'); } catch { throw errorWithStatus('Μη έγκυρη εντολή απόφασης.', 400); }
    if (bytes > MAX_COMMAND_BYTES) throw errorWithStatus('Η εντολή απόφασης υπερβαίνει το επιτρεπτό μέγεθος.', 413);
    const unknown = Object.keys(payload).filter((key) => !COMMAND_KEYS.includes(key));
    if (unknown.length || Object.keys(payload).some((key) => key.startsWith('$') || key.includes('.'))) throw errorWithStatus('Η εντολή περιέχει μη επιτρεπτά πεδία.', 400);
    const command = {
        proposal_id: text(payload.proposal_id, 200), expected_source_id: text(payload.expected_source_id, 50),
        expected_target_id: text(payload.expected_target_id, 50), expected_proposal_version: text(payload.expected_proposal_version, 100),
        expected_choice_code: text(payload.expected_choice_code, 100), decision_code: text(payload.decision_code, 50).toUpperCase(),
        notes: text(payload.notes, 2001), request_id: text(payload.request_id, 100)
    };
    if (!command.proposal_id || !command.expected_proposal_version || !command.expected_choice_code || !command.request_id) throw errorWithStatus('Λείπουν απαραίτητα στοιχεία της απόφασης.', 400);
    if (!mongoose.isValidObjectId(command.expected_source_id) || !mongoose.isValidObjectId(command.expected_target_id) || command.expected_source_id === command.expected_target_id) throw errorWithStatus('Μη έγκυρες εγγραφές της πρότασης.', 400);
    if (!DECISION_CODES.includes(command.decision_code)) throw errorWithStatus('Η απόφαση δεν υποστηρίζεται.', 400);
    if (command.notes.length > 2000) throw errorWithStatus('Οι σημειώσεις υπερβαίνουν το επιτρεπτό μήκος.', 400);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/.test(command.request_id)) throw errorWithStatus('Μη έγκυρο request_id.', 400);
    return command;
}
function scopeFromSession(session) {
    const base = assertWeeklyRepoTransferDecisionAuthorization(session);
    return {
        ...base,
        year: text(session.yearInUse, 10),
        company_kodikos: text(session.companyKodikos, 100)
    };
}
function isDuplicateKey(error) { return error?.code === 11000 || error?.name === 'MongoServerError' && error?.code === 11000; }
function commandIdentity(command) {
    const normalized = COMMAND_KEYS.reduce((result, key) => {
        if (key !== 'request_id') result[key] = command[key];
        return result;
    }, {});
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
function presentation(record, currentFingerprint = null) { return { id: String(record._id || ''), proposal_id: record.proposal_id, decision_code: record.decision_code, decision_status: record.decision_status, notes: record.notes || '', ypokatasthma: record.ypokatasthma, employee_kodikos: record.employee_kodikos, week_start: record.week_start, week_end: record.week_end, created_by_user_name: record.created_by_user_name, created_at: record.created_at, is_current: Boolean(currentFingerprint && record.snapshot_fingerprint === currentFingerprint) }; }

async function createWeeklyRepoTransferDecision({ session, payload, decisionModel = DecisionModel, reconstruct = reconstructWeeklyRepoTransferDecision }) {
    const scope = scopeFromSession(session); const command = validateCommand(payload);
    const normalizedCommandIdentity = commandIdentity(command);
    const retry = await decisionModel.findOne({
        team: scope.team,
        company_kod: scope.company_kod,
        request_id: command.request_id
    }).lean();
    if (retry) {
        if (retry.command_identity === normalizedCommandIdentity) return { decision: presentation(retry, retry.snapshot_fingerprint), idempotent: true };
        throw errorWithStatus('Το αναγνωριστικό αιτήματος έχει ήδη χρησιμοποιηθεί.', 409);
    }
    const initial = await reconstruct({ scope, command });
    const final = await reconstruct({ scope, command });
    if (initial.fingerprint !== final.fingerprint) throw errorWithStatus('Τα στοιχεία της πρότασης έχουν αλλάξει. Ανανεώστε τον έλεγχο πριν καταγράψετε απόφαση.', 409);
    const snapshot = final.snapshot;
    const existingDecision = await decisionModel.findOne({
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: snapshot.ypokatasthma,
        proposal_identity: final.fingerprint,
        decision_status: 'RECORDED'
    }).lean();
    if (existingDecision) throw errorWithStatus('Έχει ήδη καταγραφεί απόφαση για αυτή την πρόταση.', 409);
    const record = {
        proposal_identity: final.fingerprint, proposal_id: snapshot.proposal_id, canonical_group_key: snapshot.canonical_group_key,
        snapshot_version: snapshot.snapshot_version, snapshot_fingerprint: final.fingerprint, canonical_snapshot: snapshot,
        decision_code: command.decision_code, decision_status: 'RECORDED', notes: command.notes, request_id: command.request_id,
        command_identity: normalizedCommandIdentity,
        team: scope.team, company_kod: scope.company_kod, ypokatasthma: snapshot.ypokatasthma,
        employee_id: snapshot.employee_id, employee_kodikos: snapshot.employee_kodikos,
        week_start: new Date(`${snapshot.week_start}T00:00:00.000Z`), week_end: new Date(`${snapshot.week_end}T00:00:00.000Z`),
        source_prodhlomena_oraria_id: snapshot.source.prodhlomena_oraria_id, target_prodhlomena_oraria_id: snapshot.target.prodhlomena_oraria_id,
        created_by_user_id: scope.created_by_user_id, created_by_user_name: scope.created_by_user_name, created_by_user_role: scope.created_by_user_role
    };
    try { const created = await decisionModel.create(record); return { decision: presentation(created, final.fingerprint), idempotent: false }; }
    catch (error) {
        if (!isDuplicateKey(error)) throw error;
        const racedRetry = await decisionModel.findOne({ team: scope.team, company_kod: scope.company_kod, request_id: command.request_id }).lean();
        if (racedRetry && racedRetry.command_identity === normalizedCommandIdentity) return { decision: presentation(racedRetry, racedRetry.snapshot_fingerprint), idempotent: true };
        throw errorWithStatus('Έχει ήδη καταγραφεί απόφαση για αυτή την πρόταση.', 409);
    }
}

function parseDate(value, label) { const key = text(value, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw errorWithStatus(`Μη έγκυρη τιμή για ${label}.`, 400); const date = new Date(`${key}T00:00:00.000Z`); if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== key) throw errorWithStatus(`Μη έγκυρη τιμή για ${label}.`, 400); return date; }
async function listWeeklyRepoTransferDecisions({ session, filters = {}, decisionModel = DecisionModel, reconstruct = reconstructWeeklyRepoTransferDecision }) {
    const scope = scopeFromSession(session); const ypokatasthma = text(filters.ypokatasthma, 20);
    if (!ypokatasthma || ypokatasthma.toUpperCase() === 'ALL' || ypokatasthma.includes(',')) throw errorWithStatus('Επιλέξτε συγκεκριμένο υποκατάστημα.', 400);
    const start = parseDate(filters.apo_hmeromhnia, 'apo_hmeromhnia'); const end = parseDate(filters.eos_hmeromhnia, 'eos_hmeromhnia');
    if (getAtomicPeriodRangeDiagnostic({ periodStart: start, periodEnd: end })) throw errorWithStatus('Το επιλεγμένο εύρος ημερομηνιών δεν υποστηρίζεται.', 400);
    const query = { team: scope.team, company_kod: scope.company_kod, ypokatasthma, decision_status: 'RECORDED', week_start: mongoose.trusted({ $lte: end }), week_end: mongoose.trusted({ $gte: start }) };
    const proposalId = text(filters.proposal_id, 200); if (proposalId) query.proposal_id = proposalId;
    let currentFingerprint = null;
    if (proposalId) {
        const command = validateCommand({
            proposal_id: proposalId,
            expected_source_id: filters.expected_source_id,
            expected_target_id: filters.expected_target_id,
            expected_proposal_version: filters.expected_proposal_version,
            expected_choice_code: filters.expected_choice_code,
            decision_code: 'NEEDS_MORE_REVIEW',
            notes: '',
            request_id: 'history-current-probe'
        });
        currentFingerprint = (await reconstruct({ scope, command })).fingerprint;
    }
    const records = await decisionModel
        .find(query)
        .select('-canonical_snapshot -canonical_group_key')
        .sort({ created_at: -1 })
        .limit(200)
        .lean();
    return records.map((record) => presentation(record, currentFingerprint));
}

module.exports = { DECISION_CODES, DECISION_ALLOWED_ROLES, COMMAND_KEYS, MAX_COMMAND_BYTES, validateCommand, isWeeklyRepoTransferDecisionRoleAllowed, assertWeeklyRepoTransferDecisionAuthorization, scopeFromSession, commandIdentity, createWeeklyRepoTransferDecision, listWeeklyRepoTransferDecisions, presentation };
