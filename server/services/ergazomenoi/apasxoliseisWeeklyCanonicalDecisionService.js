'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const DecisionModel = require('../../models/apasxoliseisWeeklyCanonicalDecision');
const {
    assertCriticalEmploymentDecisionRole
} = require('./apasxoliseisCriticalActionAuthorizationService');
const {
    assertWeeklyCanonicalDecisionIndexesReady
} = require('./apasxoliseisWeeklyCanonicalDecisionIndexGuardService');

const SNAPSHOT_VERSION = 'weekly-canonical-human-decision-snapshot:v1';
const DECISION_SCHEMA_VERSION = 'weekly-canonical-human-decision:v1';
const APPLICABILITY = Object.freeze({
    APPLICABLE: 'APPLICABLE',
    STALE: 'STALE',
    CONFLICT: 'CONFLICT',
    NOT_FOUND: 'NOT_FOUND'
});
const DECISION_TYPES = Object.freeze([
    'PROFILE_CHANGED_INSIDE_WEEK',
    'CARD_VERIFICATION_PENDING',
    'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
    'CLASSIFICATION_BY_DATE'
]);
const CLASSIFICATIONS = new Set(['NORMAL', 'SIXTH', 'SEVENTH']);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/;

function fail(message, statusCode = 400, code = 'INVALID_WEEKLY_CANONICAL_DECISION') {
    const error = new Error(message); error.statusCode = statusCode; error.code = code; return error;
}
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function text(value, max = 250) { return String(value ?? '').trim().slice(0, max); }
function dateKey(value, label = 'date') {
    const valueKey = text(value, 10);
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(valueKey) ? `${valueKey}T00:00:00.000Z` : value);
    if (Number.isNaN(date.getTime())) throw fail(`Μη έγκυρη τιμή για ${label}.`);
    return date.toISOString().slice(0, 10);
}
function stable(value) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((result, key) => {
        result[key] = stable(value[key]); return result;
    }, {});
}
function fingerprint(value) {
    return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
function uniqueSorted(values) {
    return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value, 150)).filter(Boolean))].sort();
}
function scopeFromInput(input = {}) {
    const scope = {
        team: text(input.team, 100), company_kod: text(input.company_kod, 100),
        ypokatasthma: text(input.ypokatasthma, 20).padStart(4, '0'),
        employee_kodikos: text(input.employee_kodikos, 100),
        employee_id: text(input.employee_id, 50) || null,
        week_start: dateKey(input.week_start, 'week_start'),
        week_end: dateKey(input.week_end, 'week_end')
    };
    if (!scope.team || !scope.company_kod || !scope.ypokatasthma || !scope.employee_kodikos) {
        throw fail('Λείπει το υποχρεωτικό scope της εβδομαδιαίας απόφασης.');
    }
    const start = new Date(`${scope.week_start}T00:00:00.000Z`);
    const end = new Date(`${scope.week_end}T00:00:00.000Z`);
    if (start.getUTCDay() !== 1 || end.getUTCDay() !== 0 || (end - start) / 86400000 !== 6) {
        throw fail('Η απόφαση πρέπει να αφορά ακριβή εβδομάδα Δευτέρα–Κυριακή.');
    }
    scope.scope_key = [scope.team, scope.company_kod, scope.ypokatasthma,
        scope.employee_kodikos, scope.week_start, scope.week_end].join('|');
    return scope;
}
function normalizeWeeklyRows(rows, scope) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
        id: text(row._id || row.id, 50), date: dateKey(row.hmeromhnia, 'weekly row date'),
        declared_category: text(row.kathgoria_ergasias, 50),
        calculated_category: text(row.kathgoria_ergasias_apologistika, 50),
        declared_repo: row.repo === true, current_repo: row.repo_apologistika === true,
        declared_hours: Number(row.ores_ergasias || 0),
        actual_hours: Number(row.ores_ergasias_apologistika ?? row.cards_ores_ergasias ?? 0),
        card_hours: Number(row.cards_ores_ergasias || 0),
        card_intervals: [1, 2, 3].map((index) => ({
            from: text(row[`cards_apo_ora_0${index}`], 5),
            to: text(row[`cards_eos_ora_0${index}`], 5)
        })),
        locked: row.is_locked === true
    })).filter((row) => row.date >= scope.week_start && row.date <= scope.week_end)
        .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}
function buildCanonicalWeeklyDecisionSnapshot(input = {}) {
    const scope = scopeFromInput(input);
    const canonicalStatus = text(input.canonical_status, 50).toUpperCase();
    const canonicalReasons = uniqueSorted(input.canonical_reasons);
    if (canonicalStatus !== 'NEEDS_HR_DECISION' || canonicalReasons.length === 0) {
        throw fail('Απαιτείται canonical NEEDS_HR_DECISION με τουλάχιστον μία αιτία.');
    }
    const snapshot = stable({
        snapshot_version: SNAPSHOT_VERSION,
        scope,
        weekly_rows: normalizeWeeklyRows(input.weekly_rows, scope),
        current_repo_identities: uniqueSorted(input.current_repo_identities),
        actual_work_facts: object(input.actual_work_facts),
        effective_profile: object(input.effective_profile),
        profile_history: Array.isArray(input.profile_history) ? input.profile_history : [],
        canonical_status: canonicalStatus,
        canonical_reasons: canonicalReasons,
        policy_version: text(input.policy_version, 100),
        source_version: text(input.source_version, 100),
        applied_atomic_repo_transfer: input.applied_atomic_repo_transfer || null
    });
    return { scope, snapshot, fingerprint: fingerprint(snapshot) };
}
function validateClassificationByDate(value, scope) {
    const source = object(value); const result = {};
    for (const key of Object.keys(source).sort()) {
        const day = dateKey(key, 'classification date');
        const classification = text(source[key], 20).toUpperCase();
        if (day < scope.week_start || day > scope.week_end || !CLASSIFICATIONS.has(classification)) {
            throw fail('Μη έγκυρη classification_by_date.');
        }
        result[day] = classification;
    }
    if (Object.keys(result).length === 0) throw fail('Η classification_by_date είναι κενή.');
    return result;
}
function validateDecisionPayload(decisionType, payload, snapshotResult) {
    const source = object(payload); const scope = snapshotResult.scope;
    if (decisionType === 'PROFILE_CHANGED_INSIDE_WEEK') {
        const outcome = text(source.profile_outcome, 50).toUpperCase();
        const reference = object(source.profile_reference);
        if (!['USE_PROFILE', 'CONFIRM_PROFILE_TRANSITION'].includes(outcome) ||
            (!text(reference.history_id, 50) && !text(reference.effective_date, 10) && !text(reference.source, 100))) {
            throw fail('Μη έγκυρη απόφαση profile change.');
        }
        return stable({ profile_outcome: outcome, profile_reference: reference });
    }
    if (decisionType === 'CARD_VERIFICATION_PENDING') {
        if (source.verified !== true || !text(source.evidence_reference, 500)) {
            throw fail('Απαιτείται επιβεβαιωμένη αναφορά card evidence.');
        }
        return stable({ verified: true, evidence_reference: text(source.evidence_reference, 500),
            corrected_row_ids: uniqueSorted(source.corrected_row_ids) });
    }
    if (decisionType === 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC') {
        const identities = uniqueSorted(source.current_repo_identities);
        if (identities.length !== 2 || identities.some((day) => day < scope.week_start || day > scope.week_end)) {
            throw fail('Απαιτούνται ακριβώς δύο CURRENT repo identities μέσα στην εβδομάδα.');
        }
        const applied = snapshotResult.snapshot.applied_atomic_repo_transfer;
        if (applied && text(source.applied_execution_id, 50) !== text(applied.execution_id, 50)) {
            throw fail('Η απόφαση συγκρούεται με εφαρμοσμένη atomic repo transfer.', 409,
                'APPLIED_ATOMIC_REPO_TRANSFER_CONFLICT');
        }
        return stable({ current_repo_identities: identities,
            applied_execution_id: text(source.applied_execution_id, 50) || null });
    }
    if (decisionType === 'CLASSIFICATION_BY_DATE') {
        return { classification_by_date: validateClassificationByDate(source.classification_by_date, scope) };
    }
    throw fail('Ο τύπος απόφασης δεν υποστηρίζεται.');
}
function sessionScope(session = {}, { critical = false } = {}) {
    const role = critical
        ? assertCriticalEmploymentDecisionRole(session)
        : text(session.userRole, 50).toUpperCase();
    const result = { team: text(session.userTeam, 100), company_kod: text(session.companyInUse, 100),
        user_id: text(session.userId, 50), user_name: text(session.userName || session.username || session.userId, 150), role };
    if (text(session.userStatus, 10).toUpperCase() !== 'A' || !result.team || !result.company_kod ||
        !mongoose.isValidObjectId(result.user_id)) throw fail('Μη έγκυρη ενεργή συνεδρία.', 403, 'NOT_AUTHORIZED');
    return result;
}
function validateDecisionCommand({ session, command = {}, currentInput = {} }) {
    const actor = sessionScope(session, { critical: true }); const snapshotResult = buildCanonicalWeeklyDecisionSnapshot(currentInput);
    if (actor.team !== snapshotResult.scope.team || actor.company_kod !== snapshotResult.scope.company_kod) {
        throw fail('Το decision scope είναι εκτός ενεργής συνεδρίας.', 403, 'SCOPE_MISMATCH');
    }
    const decisionType = text(command.decision_type, 100).toUpperCase();
    if (!DECISION_TYPES.includes(decisionType)) throw fail('Ο τύπος απόφασης δεν υποστηρίζεται.');
    const requestId = text(command.request_id, 100);
    if (!REQUEST_ID_PATTERN.test(requestId)) throw fail('Μη έγκυρο request_id.');
    const decisionPayload = validateDecisionPayload(decisionType, command.decision_payload, snapshotResult);
    const normalized = { decision_type: decisionType, decision_payload: decisionPayload,
        notes: text(command.notes, 2000), request_id: requestId };
    return { actor, snapshotResult, command: normalized,
        payloadFingerprint: fingerprint(decisionPayload), commandIdentity: fingerprint({
            scope_key: snapshotResult.scope.scope_key, snapshot_fingerprint: snapshotResult.fingerprint,
            decision_type: decisionType, decision_payload: decisionPayload, notes: normalized.notes
        }) };
}
function queryLean(query) { return query && typeof query.lean === 'function' ? query.lean() : query; }
function sameLogicalDecision(record, validated) {
    return record.snapshot_fingerprint === validated.snapshotResult.fingerprint &&
        record.decision_type === validated.command.decision_type &&
        record.decision_payload_fingerprint === validated.payloadFingerprint;
}
function isDuplicateKey(error) {
    return error?.code === 11000 || error?.name === 'MongoServerError' && error?.code === 11000;
}
function applicableFilter(scope, snapshotFingerprint) {
    return {
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: scope.ypokatasthma,
        employee_kodikos: scope.employee_kodikos,
        week_start: new Date(`${scope.week_start}T00:00:00.000Z`),
        week_end: new Date(`${scope.week_end}T00:00:00.000Z`),
        snapshot_fingerprint: snapshotFingerprint,
        decision_status: 'RECORDED'
    };
}
async function classifyConcurrentDuplicate({ decisionModel, validated }) {
    const requestRecord = await queryLean(decisionModel.findOne({
        team: validated.actor.team,
        company_kod: validated.actor.company_kod,
        request_id: validated.command.request_id
    }));
    if (requestRecord) {
        if (requestRecord.command_identity === validated.commandIdentity) {
            return { record: requestRecord, idempotent: true };
        }
        throw fail('Το request_id έχει ήδη χρησιμοποιηθεί.', 409, 'REQUEST_ID_CONFLICT');
    }
    const candidates = await queryLean(decisionModel.find(applicableFilter(
        validated.snapshotResult.scope,
        validated.snapshotResult.fingerprint
    )));
    const equivalent = candidates.find((record) => sameLogicalDecision(record, validated));
    if (equivalent && candidates.every((record) => sameLogicalDecision(record, validated))) {
        return { record: equivalent, idempotent: true };
    }
    if (candidates.length > 0) {
        throw fail('Υπάρχουν συγκρουόμενες εφαρμοστέες αποφάσεις.', 409,
            'CONFLICTING_APPLICABLE_DECISIONS');
    }
    throw fail('Η ταυτόχρονη καταγραφή απόφασης απέτυχε κλειστά.', 409,
        'CANONICAL_DECISION_CONCURRENT_CONFLICT');
}
async function recordWeeklyCanonicalDecision({
    session,
    command,
    currentInput,
    decisionModel = DecisionModel,
    indexReadinessGuard = assertWeeklyCanonicalDecisionIndexesReady,
    now = new Date()
}) {
    const validated = validateDecisionCommand({ session, command, currentInput });
    await indexReadinessGuard();
    const requestRecord = await queryLean(decisionModel.findOne({ team: validated.actor.team,
        company_kod: validated.actor.company_kod, request_id: validated.command.request_id }));
    if (requestRecord) {
        if (requestRecord.command_identity === validated.commandIdentity) return { record: requestRecord, idempotent: true };
        throw fail('Το request_id έχει ήδη χρησιμοποιηθεί.', 409, 'REQUEST_ID_CONFLICT');
    }
    const scope = validated.snapshotResult.scope;
    const candidates = await queryLean(decisionModel.find(applicableFilter(
        scope,
        validated.snapshotResult.fingerprint
    )));
    if (candidates.length > 0) {
        const equivalent = candidates.find((record) => sameLogicalDecision(record, validated));
        if (equivalent && candidates.every((record) => sameLogicalDecision(record, validated))) {
            return { record: equivalent, idempotent: true };
        }
        throw fail('Υπάρχουν συγκρουόμενες εφαρμοστέες αποφάσεις.', 409, 'CONFLICTING_APPLICABLE_DECISIONS');
    }
    const record = {
        ...scope, employee_id: scope.employee_id || null,
        week_start: new Date(`${scope.week_start}T00:00:00.000Z`), week_end: new Date(`${scope.week_end}T00:00:00.000Z`),
        snapshot_version: SNAPSHOT_VERSION, snapshot_fingerprint: validated.snapshotResult.fingerprint,
        canonical_snapshot: validated.snapshotResult.snapshot,
        canonical_status: validated.snapshotResult.snapshot.canonical_status,
        canonical_reasons: validated.snapshotResult.snapshot.canonical_reasons,
        decision_type: validated.command.decision_type, decision_payload: validated.command.decision_payload,
        decision_payload_fingerprint: validated.payloadFingerprint, decision_status: 'RECORDED',
        request_id: validated.command.request_id, command_identity: validated.commandIdentity,
        decision_schema_version: DECISION_SCHEMA_VERSION,
        policy_version: validated.snapshotResult.snapshot.policy_version,
        source_version: validated.snapshotResult.snapshot.source_version,
        notes: validated.command.notes, created_by_user_id: validated.actor.user_id,
        created_by_user_name: validated.actor.user_name, created_by_user_role: validated.actor.role,
        created_at: now
    };
    try {
        return { record: await decisionModel.create(record), idempotent: false };
    } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        return classifyConcurrentDuplicate({ decisionModel, validated });
    }
}
async function listWeeklyCanonicalDecisions({ session, filters = {}, decisionModel = DecisionModel }) {
    const actor = sessionScope(session); const query = { team: actor.team, company_kod: actor.company_kod };
    for (const field of ['ypokatasthma', 'employee_kodikos']) if (filters[field]) query[field] = text(filters[field], 100);
    if (filters.week_start) query.week_start = new Date(`${dateKey(filters.week_start)}T00:00:00.000Z`);
    return queryLean(decisionModel.find(query).sort({ created_at: -1 }).limit(200));
}
async function getLatestApplicableWeeklyCanonicalDecision({ session, currentInput, decisionModel = DecisionModel }) {
    const actor = sessionScope(session); const current = buildCanonicalWeeklyDecisionSnapshot(currentInput);
    if (actor.team !== current.scope.team || actor.company_kod !== current.scope.company_kod) throw fail('Scope mismatch.', 403, 'SCOPE_MISMATCH');
    const scope = current.scope;
    const records = await queryLean(decisionModel.find({ team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: scope.ypokatasthma, employee_kodikos: scope.employee_kodikos,
        week_start: new Date(`${scope.week_start}T00:00:00.000Z`), week_end: new Date(`${scope.week_end}T00:00:00.000Z`),
        decision_status: 'RECORDED' }).sort({ created_at: -1 }));
    if (!records.length) return { applicability: APPLICABILITY.NOT_FOUND, record: null, current_fingerprint: current.fingerprint };
    const applicable = records.filter((record) => record.snapshot_fingerprint === current.fingerprint);
    if (!applicable.length) return { applicability: APPLICABILITY.STALE, record: records[0], current_fingerprint: current.fingerprint };
    const identities = new Set(applicable.map((record) => `${record.decision_type}|${record.decision_payload_fingerprint}`));
    if (identities.size > 1) return { applicability: APPLICABILITY.CONFLICT, records: applicable, current_fingerprint: current.fingerprint };
    return { applicability: APPLICABILITY.APPLICABLE, record: applicable[0], current_fingerprint: current.fingerprint };
}

module.exports = {
    SNAPSHOT_VERSION, DECISION_SCHEMA_VERSION, APPLICABILITY, DECISION_TYPES,
    stable, fingerprint, scopeFromInput, buildCanonicalWeeklyDecisionSnapshot,
    validateDecisionPayload, validateDecisionCommand, isDuplicateKey, applicableFilter,
    classifyConcurrentDuplicate, recordWeeklyCanonicalDecision,
    listWeeklyCanonicalDecisions, getLatestApplicableWeeklyCanonicalDecision
};
