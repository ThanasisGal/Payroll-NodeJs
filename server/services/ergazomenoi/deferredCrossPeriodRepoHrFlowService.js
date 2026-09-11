'use strict';

const crypto = require('crypto');
const { assertCriticalEmploymentDecisionRole } = require('./apasxoliseisCriticalActionAuthorizationService');
const { RESOLUTION_KIND, ACCOUNTING_TIME_FIELDS, buildDeferredCrossPeriodRepoResolution } =
    require('./deferredCrossPeriodRepoResolutionService');
const { resolveEffectiveDeferredCrossPeriodDecision } =
    require('./deferredCrossPeriodRepoDecisionRevisionService');

const SNAPSHOT_VERSION = 'deferred-cross-period-repo-resolution:v1';

function flowError(code, message, statusCode = 409) {
    return Object.assign(new Error(message), { code, statusCode });
}
function text(value) { return String(value == null ? '' : value).trim(); }
function commandIdentity(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function validateResolveCommand(body = {}) {
    const forbidden = ['after_rows', 'period_projections', 'employee_id', 'employee_kodikos',
        'team', 'company_kod', 'accounting_rows'];
    if (forbidden.some((key) => body[key] !== undefined)) {
        throw flowError('FORGED_DEFERRED_CROSS_PERIOD_RESOLUTION',
            'Το αίτημα περιέχει μη επιτρεπτά authoritative πεδία.', 400);
    }
    const command = {
        deferred_week_id: text(body.deferred_week_id), proposal_identity: text(body.proposal_identity),
        resolution_fingerprint: text(body.resolution_fingerprint),
        source_row_id: text(body.source_row_id), target_row_id: text(body.target_row_id),
        request_id: text(body.request_id), resolution_reason: text(body.resolution_reason),
        correction_reason: text(body.correction_reason),
        expected_previous_decision_id: text(body.expected_previous_decision_id),
        expected_previous_resolution_fingerprint: text(body.expected_previous_resolution_fingerprint)
    };
    if (['deferred_week_id', 'proposal_identity', 'resolution_fingerprint', 'source_row_id',
        'target_row_id', 'request_id'].some((key) => !command[key])) throw flowError(
        'INVALID_DEFERRED_CROSS_PERIOD_RESOLUTION_COMMAND', 'Το αίτημα επίλυσης είναι ατελές.', 400);
    if (command.source_row_id === command.target_row_id) throw flowError(
        'INVALID_DEFERRED_CROSS_PERIOD_RESOLUTION_COMMAND', 'Οι γραμμές source και target πρέπει να διαφέρουν.', 400);
    return Object.freeze(command);
}
function actorFromSession(session = {}) {
    const role = assertCriticalEmploymentDecisionRole(session);
    const actor = { user_id: text(session.userId), user_name: text(session.userName || session.username), user_role: role };
    if (!actor.user_id || !actor.user_name) throw flowError('INVALID_DEFERRED_RESOLUTION_ACTOR',
        'Δεν υπάρχει πλήρης authoritative ταυτότητα χρήστη.', 403);
    return actor;
}
function buildPreview({ authoritativeInput, session, now = new Date() }) {
    const actor = actorFromSession(session);
    const decision = buildDeferredCrossPeriodRepoResolution({ ...authoritativeInput,
        hr: { ...actor, resolution_reason: authoritativeInput.resolution_reason ||
            'Ρητή απόφαση HR για το πραγματικό ρεπό οριακής εβδομάδας', resolved_at: now } });
    const accounting = (row = {}) => Object.fromEntries(ACCOUNTING_TIME_FIELDS
        .filter((field) => row[field] !== undefined).map((field) => [field, row[field]]));
    const declared = (row = {}) => ({ category: row.kathgoria_ergasias || '', hours: row.ores_ergasias || 0,
        intervals: [1, 2, 3].map((n) => ({ from: row[`apo_ora_0${n}`] || '', to: row[`eos_ora_0${n}`] || '' })).filter((item) => item.from || item.to) });
    const cards = (row = {}) => ({ hours: row.cards_ores_ergasias || 0,
        intervals: [1, 2, 3].map((n) => ({ from: row[`cards_apo_ora_0${n}`] || '', to: row[`cards_eos_ora_0${n}`] || '' })).filter((item) => item.from || item.to) });
    const afterById = new Map(decision.canonical_snapshot.proposed_accounting_after_values.map((row) => [row.row_id, row]));
    const beforeById = new Map(decision.canonical_snapshot.before_values.map((row) => [String(row.row_id || row._id), row]));
    const rows = decision.canonical_snapshot.full_week_context.map((row) => ({
        row_id: String(row.row_id || row._id), hmeromhnia: row.hmeromhnia,
        ownership_period: row.hmeromhnia >= decision.target_period_start &&
            row.hmeromhnia <= decision.target_period_end ? 'TARGET_PERIOD' : 'SOURCE_PERIOD',
        declared: declared(row), cards: cards(row), current_accounting: accounting(row),
        proposed_accounting: afterById.get(String(row.row_id || row._id)) || null
    }));
    return Object.freeze({ ...decision, week_start: decision.canonical_snapshot.identity.week_start,
        week_end: decision.canonical_snapshot.identity.week_end,
        employee: Object.freeze({ employee_id: decision.canonical_snapshot.identity.employee_id,
            employee_kodikos: decision.canonical_snapshot.full_week_context[0].employee_kodikos ||
                decision.canonical_snapshot.full_week_context[0].kodikos || '' }),
        days: Object.freeze(rows), before_after: Object.freeze({
        source: { before: accounting(beforeById.get(decision.canonical_snapshot.identity.source_row_id)),
            after: accounting(afterById.get(decision.canonical_snapshot.identity.source_row_id)) },
        target: { before: accounting(beforeById.get(decision.canonical_snapshot.identity.target_row_id)),
            after: accounting(afterById.get(decision.canonical_snapshot.identity.target_row_id)) }
        }) });
}
function toRecord(decision, command, session, now, previous = null) {
    const actor = actorFromSession(session);
    return {
        proposal_identity: decision.proposal_identity, proposal_id: decision.proposal_identity,
        canonical_group_key: decision.deferred_week_id, snapshot_version: SNAPSHOT_VERSION,
        snapshot_fingerprint: decision.resolution_fingerprint, canonical_snapshot: decision.canonical_snapshot,
        decision_code: 'APPROVE_PROPOSAL', decision_status: 'RECORDED', notes: command.resolution_reason,
        request_id: command.request_id, command_identity: commandIdentity(command),
        team: decision.canonical_snapshot.identity.team, company_kod: decision.canonical_snapshot.identity.company_kod,
        ypokatasthma: decision.canonical_snapshot.identity.ypokatasthma,
        employee_id: decision.canonical_snapshot.identity.employee_id,
        employee_kodikos: decision.canonical_snapshot.full_week_context[0].employee_kodikos ||
            decision.canonical_snapshot.full_week_context[0].kodikos,
        week_start: decision.canonical_snapshot.identity.week_start,
        week_end: decision.canonical_snapshot.identity.week_end,
        source_prodhlomena_oraria_id: decision.canonical_snapshot.identity.source_row_id,
        target_prodhlomena_oraria_id: decision.canonical_snapshot.identity.target_row_id,
        created_by_user_id: actor.user_id, created_by_user_name: actor.user_name, created_by_user_role: actor.user_role,
        ...decision, resolution_reason: command.resolution_reason,
        resolved_by_user_id: actor.user_id, resolved_by_user_name: actor.user_name,
        resolved_by_user_role: actor.user_role, resolved_at: now,
        resolution_revision: previous ? Number(previous.resolution_revision || 1) + 1 : 1,
        supersedes_decision_id: previous?._id || undefined,
        supersedes_resolution_fingerprint: previous?.resolution_fingerprint || undefined,
        correction_reason: previous ? command.correction_reason : undefined
    };
}
function sameDecision(record, decision) {
    return record && record.proposal_identity === decision.proposal_identity &&
        record.resolution_fingerprint === decision.resolution_fingerprint;
}
async function resolveDeferredCrossPeriodRepo({ body, session, reconstruct, decisionStore,
    indexGuard = async () => {}, now = new Date() }) {
    const command = validateResolveCommand(body); actorFromSession(session); await indexGuard();
    const authoritativeInput = await reconstruct({ command, session });
    const decision = buildPreview({ authoritativeInput: { ...authoritativeInput,
        resolution_reason: command.resolution_reason }, session, now });
    if (decision.proposal_identity !== command.proposal_identity ||
        decision.resolution_fingerprint !== command.resolution_fingerprint ||
        decision.canonical_snapshot.identity.source_row_id !== command.source_row_id ||
        decision.canonical_snapshot.identity.target_row_id !== command.target_row_id) {
        throw flowError('DEFERRED_CROSS_PERIOD_RESOLUTION_STALE',
            'Η πρόταση έχει αλλάξει. Απαιτείται νέα προεπισκόπηση.');
    }
    const byRequest = await decisionStore.findByRequest(command.request_id);
    if (byRequest) {
        if (sameDecision(byRequest, decision)) return { idempotent: true, decision: byRequest };
        throw flowError('DEFERRED_CROSS_PERIOD_RESOLUTION_REQUEST_CONFLICT',
            'Το request_id αντιστοιχεί σε διαφορετική απόφαση.');
    }
    const found = await decisionStore.findByDeferredWeek(command.deferred_week_id);
    const all = found ? (Array.isArray(found) ? found : [found]) : [];
    let existing;
    try { existing = resolveEffectiveDeferredCrossPeriodDecision(all, command.deferred_week_id); }
    catch (error) { throw flowError(error.code, error.message); }
    if (existing && sameDecision(existing, decision)) return { idempotent: true, decision: existing };
    if (existing) {
        if (command.expected_previous_decision_id !== text(existing._id) ||
            command.expected_previous_resolution_fingerprint !== text(existing.resolution_fingerprint)) {
            throw flowError('DEFERRED_CROSS_PERIOD_RESOLUTION_STALE',
                'Η ενεργή επιλογή άλλαξε. Απαιτείται νέα προεπισκόπηση.');
        }
    } else if (command.expected_previous_decision_id || command.expected_previous_resolution_fingerprint) {
        throw flowError('DEFERRED_CROSS_PERIOD_RESOLUTION_STALE',
            'Δεν υπάρχει η αναμενόμενη προηγούμενη επιλογή.');
    }
    const record = toRecord(decision, command, session, now, existing);
    try { return { idempotent: false, decision: await decisionStore.create(record) }; }
    catch (error) {
        if (error?.code !== 11000) throw error;
        const winnerByWeek = await decisionStore.findByDeferredWeek(command.deferred_week_id);
        let winner = await decisionStore.findByRequest(command.request_id);
        if (!winner) {
            try { winner = resolveEffectiveDeferredCrossPeriodDecision(
                Array.isArray(winnerByWeek) ? winnerByWeek : [winnerByWeek].filter(Boolean),
                command.deferred_week_id); } catch (_error) { winner = null; }
        }
        if (sameDecision(winner, decision)) return { idempotent: true, decision: winner };
        throw flowError('DEFERRED_CROSS_PERIOD_RESOLUTION_STALE',
            'Καταγράφηκε ταυτόχρονα διαφορετική αλλαγή. Απαιτείται νέα προεπισκόπηση.');
    }
}

module.exports = { SNAPSHOT_VERSION, flowError, validateResolveCommand, buildPreview,
    resolveDeferredCrossPeriodRepo, commandIdentity };
