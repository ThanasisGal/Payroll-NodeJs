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
const {
    REUSE_SCOPE,
    REUSE_STATUS,
    utcDateKey,
    buildWeeklyReusableDecisionRule
} = require('./apasxoliseisReusablePolicyDecisionService');
const {
    resolveFullTimeFromWorkTerms
} = require('./apasxoliseisReviewEmploymentProfileService');

const SNAPSHOT_VERSION = 'weekly-canonical-human-decision-snapshot:v1';
const DECISION_SCHEMA_VERSION = 'weekly-canonical-human-decision:v2';
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
const PROFILE_FINGERPRINT_VERSION = 'weekly-canonical-selected-profile:v1';
const REPO_IDENTITY_SEMANTIC_VERSION = 'weekly-canonical-repo-identity-semantic:v1';

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
function repoIdentityDailyFactProjection(value = {}) {
    const fact = object(value);
    return {
        category: fact.category ?? null,
        actualWorkHours: fact.actualWorkHours ?? null,
        countsAsActualWorkDay: fact.countsAsActualWorkDay === true,
        cardVerificationStatus: fact.cardVerificationStatus ?? null,
        reasons: uniqueSorted(fact.reasons)
    };
}
function repoIdentityWeeklyRowProjection(value = {}) {
    const row = object(value);
    return {
        date: row.date ?? null,
        declared_category: row.declared_category ?? null,
        calculated_category: row.calculated_category ?? null,
        declared_repo: row.declared_repo === true,
        current_repo: row.current_repo === true,
        locked: row.locked === true
    };
}
function repoIdentityDecisionSnapshotProjection(value = {}) {
    const snapshot = object(value);
    const profile = object(snapshot.effective_profile);
    const actualFacts = object(snapshot.actual_work_facts);
    return stable({
        semantic_version: REPO_IDENTITY_SEMANTIC_VERSION,
        scope: snapshot.scope,
        employment_contract: {
            weekly_days: profile.hmeres_ergasias_ebdomadas ?? null,
            full_time: resolveFullTimeFromWorkTerms(profile)
        },
        weekly_rows: (Array.isArray(snapshot.weekly_rows) ? snapshot.weekly_rows : [])
            .map(repoIdentityWeeklyRowProjection),
        actual_work_facts: Object.fromEntries(Object.keys(actualFacts).sort().map((date) => [
            date, repoIdentityDailyFactProjection(actualFacts[date])
        ])),
        current_repo_identities: uniqueSorted(snapshot.current_repo_identities),
        applied_atomic_repo_transfer: snapshot.applied_atomic_repo_transfer || null
    });
}
function isRecordSnapshotApplicable(record, current) {
    if (record?.snapshot_fingerprint === current.fingerprint) return true;
    if (record?.decision_type !== 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC' ||
        !record?.canonical_snapshot ||
        fingerprint(record.canonical_snapshot) !== record.snapshot_fingerprint) return false;
    return fingerprint(repoIdentityDecisionSnapshotProjection(record.canonical_snapshot)) ===
        fingerprint(repoIdentityDecisionSnapshotProjection(current.snapshot));
}
function selectedProfileFingerprint(profile = {}) {
    const source = object(profile);
    return fingerprint(stable({
        version: PROFILE_FINGERPRINT_VERSION,
        hmeres_ergasias_ebdomadas: source.hmeres_ergasias_ebdomadas ?? null,
        ores_ergasias_ebdomadas: source.ores_ergasias_ebdomadas ?? null,
        mo_oron_hmerhsias_ergasias: source.mo_oron_hmerhsias_ergasias ?? null,
        kathestos_apasxolhshs: source.kathestos_apasxolhshs ?? null,
        typos_apasxolhshs: source.typos_apasxolhshs ?? null,
        typos_ebdomadas: source.typos_ebdomadas ?? null,
        typos_ergazomenon: source.typos_ergazomenon ?? null,
        pososto_prosayxhshs_6hs_hmeras: source.pososto_prosayxhshs_6hs_hmeras ?? null,
        nomimoOromisthio: source.nomimoOromisthio ?? null,
        pragmatikoOromisthio: source.pragmatikoOromisthio ?? null,
        eidikh_kathgoria_ergazomenoy: source.eidikh_kathgoria_ergazomenoy ?? null,
        eidikh_periptosh: source.eidikh_periptosh ?? null,
        source: source.employment_profile_source ?? source.source ?? null,
        istorikoId: text(source.istorikoId ?? source._id, 50) || null,
        hmeromhnia_isxyos_oron_ergasias_apo: source.hmeromhnia_isxyos_oron_ergasias_apo ?? null,
        hmeromhnia_isxyos_oron_ergasias_eos: source.hmeromhnia_isxyos_oron_ergasias_eos ?? null,
        hmeromhnia_allaghs_orarioy_apo: source.hmeromhnia_allaghs_orarioy_apo ?? null,
        hmeromhnia_allaghs_orarioy_eos: source.hmeromhnia_allaghs_orarioy_eos ?? null,
        hmeromhnia_allaghs_symbashs: source.hmeromhnia_allaghs_symbashs ?? null
    }));
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
        if (outcome === 'USE_PROFILE') {
            const selectedReference = object(source.selected_profile_reference);
            const kind = text(selectedReference.kind, 30).toUpperCase();
            const id = text(selectedReference.id, 100);
            const selectedFingerprint = text(source.selected_profile_fingerprint, 64);
            if (!['HISTORY', 'CURRENT_EMPLOYEE'].includes(kind) || !id ||
                !/^[a-f0-9]{64}$/i.test(selectedFingerprint)) {
                throw fail('Μη έγκυρη deterministic αναφορά επιλεγμένου profile.');
            }
            return stable({ profile_outcome: outcome, profile_reference: reference,
                selected_profile_reference: { kind, id },
                selected_profile_fingerprint: selectedFingerprint.toLowerCase() });
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
        const appliedExecutionId = text(applied?.execution_id, 50);
        if (applied && appliedExecutionId &&
            text(source.applied_execution_id, 50) !== appliedExecutionId) {
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
    const reuseScope = text(command.reuse_scope || REUSE_SCOPE.ONE_TIME, 30).toUpperCase();
    if (!Object.values(REUSE_SCOPE).includes(reuseScope)) throw fail('Μη έγκυρο εύρος επαναχρησιμοποίησης.');
    let reusable = null; let reuseEffectiveFrom = null; let reuseEffectiveTo = null;
    if (reuseScope === REUSE_SCOPE.FUTURE_IDENTICAL) {
        reusable = buildWeeklyReusableDecisionRule({ snapshotResult, decisionType,
            decisionPayload });
        if (!reusable.eligible) throw fail(reusable.reason, 400, reusable.reason_code);
        reuseEffectiveFrom = utcDateKey(command.reuse_effective_from);
        reuseEffectiveTo = utcDateKey(command.reuse_effective_to);
        if (!reuseEffectiveFrom) throw fail('Απαιτείται έγκυρη ημερομηνία έναρξης ισχύος.');
        if (reuseEffectiveTo && reuseEffectiveTo < reuseEffectiveFrom) {
            throw fail('Η ημερομηνία λήξης δεν μπορεί να προηγείται της έναρξης.');
        }
    }
    const normalized = { decision_type: decisionType, decision_payload: decisionPayload,
        notes: text(command.notes, 2000), request_id: requestId, reuse_scope: reuseScope,
        reuse_effective_from: reuseEffectiveFrom, reuse_effective_to: reuseEffectiveTo };
    return { actor, snapshotResult, command: normalized,
        reusable,
        payloadFingerprint: fingerprint(decisionPayload), commandIdentity: fingerprint({
            scope_key: snapshotResult.scope.scope_key, snapshot_fingerprint: snapshotResult.fingerprint,
            decision_type: decisionType, decision_payload: decisionPayload, notes: normalized.notes,
            reuse_scope: reuseScope, reuse_effective_from: reuseEffectiveFrom,
            reuse_effective_to: reuseEffectiveTo
        }) };
}
function queryLean(query) { return query && typeof query.lean === 'function' ? query.lean() : query; }
function sameLogicalDecision(record, validated) {
    return record.snapshot_fingerprint === validated.snapshotResult.fingerprint &&
        record.decision_type === validated.command.decision_type &&
        record.decision_payload_fingerprint === validated.payloadFingerprint &&
        text(record.reuse_scope || REUSE_SCOPE.ONE_TIME, 30).toUpperCase() ===
            validated.command.reuse_scope;
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
    mutationRunner = null,
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
        reuse_scope: validated.command.reuse_scope,
        reuse_status: validated.reusable ? REUSE_STATUS.ACTIVE : REUSE_STATUS.NOT_APPLICABLE,
        reuse_fingerprint: validated.reusable?.fingerprint || '',
        reuse_match_criteria: validated.reusable?.criteria || null,
        reusable_decision_payload: validated.reusable?.decision_payload || null,
        reuse_effective_from: validated.command.reuse_effective_from
            ? new Date(`${validated.command.reuse_effective_from}T00:00:00.000Z`) : null,
        reuse_effective_to: validated.command.reuse_effective_to
            ? new Date(`${validated.command.reuse_effective_to}T00:00:00.000Z`) : null,
        notes: validated.command.notes, created_by_user_id: validated.actor.user_id,
        created_by_user_name: validated.actor.user_name, created_by_user_role: validated.actor.role,
        created_at: now
    };
    try {
        const createRecord = async (dbSession = null) => {
            if (!dbSession) return decisionModel.create(record);
            const created = await decisionModel.create([record], { session: dbSession });
            return Array.isArray(created) ? created[0] : created;
        };
        const created = typeof mutationRunner === 'function'
            ? await mutationRunner((dbSession) => createRecord(dbSession))
            : await createRecord();
        return { record: created, idempotent: false };
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
    const applicable = records.filter((record) => isRecordSnapshotApplicable(record, current));
    if (!applicable.length) return { applicability: APPLICABILITY.STALE, record: records[0], current_fingerprint: current.fingerprint };
    const identities = new Set(applicable.map((record) => `${record.decision_type}|${record.decision_payload_fingerprint}`));
    if (identities.size > 1) return { applicability: APPLICABILITY.CONFLICT, records: applicable, current_fingerprint: current.fingerprint };
    return { applicability: APPLICABILITY.APPLICABLE, record: applicable[0], current_fingerprint: current.fingerprint };
}

function resolvePreloadedWeeklyCanonicalDecision({ currentInput, records = [] } = {}) {
    const current = buildCanonicalWeeklyDecisionSnapshot(currentInput);
    const scoped = (Array.isArray(records) ? records : []).filter((record) =>
        record?.decision_status === 'RECORDED' &&
        record?.team === current.scope.team && record?.company_kod === current.scope.company_kod &&
        record?.ypokatasthma === current.scope.ypokatasthma &&
        String(record?.employee_kodikos || '') === current.scope.employee_kodikos &&
        dateKey(record?.week_start) === current.scope.week_start &&
        dateKey(record?.week_end) === current.scope.week_end
    );
    if (!scoped.length) return { applicability: APPLICABILITY.NOT_FOUND, record: null,
        current_fingerprint: current.fingerprint };
    const applicable = scoped.filter((record) => isRecordSnapshotApplicable(record, current));
    if (!applicable.length) return { applicability: APPLICABILITY.STALE,
        record: [...scoped].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0],
        current_fingerprint: current.fingerprint };
    const identities = new Set(applicable.map((record) =>
        `${record.decision_type}|${record.decision_payload_fingerprint}`));
    if (identities.size > 1) return { applicability: APPLICABILITY.CONFLICT,
        records: applicable, current_fingerprint: current.fingerprint };
    return { applicability: APPLICABILITY.APPLICABLE,
        record: [...applicable].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0],
        current_fingerprint: current.fingerprint };
}

module.exports = {
    SNAPSHOT_VERSION, DECISION_SCHEMA_VERSION, PROFILE_FINGERPRINT_VERSION,
    REPO_IDENTITY_SEMANTIC_VERSION, APPLICABILITY, DECISION_TYPES,
    stable, fingerprint, selectedProfileFingerprint, scopeFromInput, buildCanonicalWeeklyDecisionSnapshot,
    repoIdentityDecisionSnapshotProjection, isRecordSnapshotApplicable,
    validateDecisionPayload, validateDecisionCommand, isDuplicateKey, applicableFilter,
    classifyConcurrentDuplicate, recordWeeklyCanonicalDecision,
    listWeeklyCanonicalDecisions, getLatestApplicableWeeklyCanonicalDecision,
    resolvePreloadedWeeklyCanonicalDecision
};
