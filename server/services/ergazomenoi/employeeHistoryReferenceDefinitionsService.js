'use strict';

const REFERENCE_DEFINITIONS = Object.freeze({
    Prodhlomena_Oraria_Deviations: Object.freeze([
        'effective_profile_istoriko_id',
        'previous_profile_istoriko_id'
    ]),
    Oraria_Apologistika: Object.freeze([
        'effective_profile_istoriko_id',
        'previous_profile_istoriko_id'
    ]),
    Apasxoliseis_Period_Frozen_Snapshots: Object.freeze([
        'frozen_snapshot.daily_results[].effective_profile_istoriko_id',
        'frozen_snapshot.deviations[].effective_profile_istoriko_id',
        'frozen_snapshot.weekly_calculation_context.profile_history[]._id',
        'frozen_snapshot.canonical_decisions[].decision_payload.profile_reference.history_id',
        'frozen_snapshot.canonical_decisions[].decision_payload.selected_profile_reference.id',
        'frozen_snapshot.canonical_decisions[].canonical_snapshot.profile_history[]._id',
        'frozen_snapshot.canonical_decisions[].canonical_snapshot.effective_profile.istorikoId',
        // Old exports sometimes persisted the frozen payload itself as the root document.
        'daily_results[].effective_profile_istoriko_id',
        'deviations[].effective_profile_istoriko_id',
        'weekly_calculation_context.profile_history[]._id',
        'canonical_decisions[].decision_payload.profile_reference.history_id',
        'canonical_decisions[].decision_payload.selected_profile_reference.id'
    ]),
    Apasxoliseis_Weekly_Canonical_Decisions: Object.freeze([
        'decision_payload.profile_reference.history_id',
        'decision_payload.selected_profile_reference.id',
        'reusable_decision_payload.profile_reference.history_id',
        'reusable_decision_payload.selected_profile_reference.id',
        'canonical_snapshot.profile_history[]._id',
        'canonical_snapshot.effective_profile.istorikoId',
        // Legacy persisted decision shapes remain readable and protected.
        'canonical_snapshot.input.profile_history[]._id',
        'canonical_snapshot.analysis.profile_history[]._id',
        'canonical_snapshot.employee.profile_istoriko_id'
    ]),
    Apasxoliseis_Weekly_Repo_Transfer_Decisions: Object.freeze([
        'canonical_snapshot.employment_profile.profile_istoriko_id',
        'canonical_snapshot.employment_profile.history[].id',
        'canonical_snapshot.full_week_context[].effective_profile_istoriko_id',
        // Legacy persisted decision shapes remain readable and protected.
        'canonical_snapshot.input.profile_history[]._id',
        'canonical_snapshot.analysis.profile_history[]._id',
        'canonical_snapshot.employee.profile_istoriko_id',
        'decision_payload.profile_reference.history_id',
        'decision_payload.selected_profile_reference.id',
        'reusable_decision_payload.profile_reference.history_id',
        'reusable_decision_payload.selected_profile_reference.id'
    ])
});

const SUPPORTED_COLLECTIONS = Object.freeze(Object.keys(REFERENCE_DEFINITIONS));
const EMPLOYEE_CODE_FIELDS = Object.freeze(['kodikos', 'employee_kodikos']);

function invalidReference() {
    const error = new Error('EMPLOYEE_HISTORY_REFERENCE_ID_INVALID');
    error.code = 'EMPLOYEE_HISTORY_REFERENCE_ID_INVALID';
    error.statusCode = 409;
    return error;
}

function scopedReferenceError() {
    const error = new Error('EMPLOYEE_HISTORY_REFERENCE_SCOPE_REQUIRED');
    error.code = 'EMPLOYEE_HISTORY_REFERENCE_SCOPE_REQUIRED';
    error.statusCode = 409;
    return error;
}

function normalizedHistoryId(value) {
    if (value === null || value === undefined || value === '') return null;
    const text = typeof value?.toHexString === 'function'
        ? value.toHexString()
        : String(value).trim();
    if (!/^[0-9a-fA-F]{24}$/.test(text)) throw invalidReference();
    return text.toLowerCase();
}

function visitPath(value, segments, ancestors, visit) {
    if (!segments.length) {
        visit(value, ancestors);
        return;
    }
    if (value === null || value === undefined) return;
    const [rawSegment, ...rest] = segments;
    const isArray = rawSegment.endsWith('[]');
    const segment = isArray ? rawSegment.slice(0, -2) : rawSegment;
    const next = value?.[segment];
    if (isArray) {
        if (!Array.isArray(next)) return;
        for (const item of next) visitPath(item, rest, [...ancestors, item], visit);
        return;
    }
    visitPath(next, rest, ancestors, visit);
}

function employeeCodeFor(document, ancestors) {
    for (const candidate of [...ancestors].reverse().concat(document)) {
        for (const field of EMPLOYEE_CODE_FIELDS) {
            const value = String(candidate?.[field] ?? '').trim();
            if (value) return value;
        }
    }
    return '';
}

function employeeHistoryReferenceQueryPaths(collectionName) {
    const definitions = REFERENCE_DEFINITIONS[collectionName];
    if (!definitions) {
        throw new TypeError(`Unsupported employee-history reference collection: ${collectionName}`);
    }
    return [...new Set(definitions.map(path => path.replaceAll('[]', '')))];
}

function extractEmployeeHistoryReferences(collectionName, documents = []) {
    const definitions = REFERENCE_DEFINITIONS[collectionName];
    if (!definitions) {
        throw new TypeError(`Unsupported employee-history reference collection: ${collectionName}`);
    }
    const targets = new Map();
    for (const document of Array.isArray(documents) ? documents : []) {
        for (const path of definitions) {
            visitPath(document, path.split('.'), [], (rawId, ancestors) => {
                const historyId = normalizedHistoryId(rawId);
                if (!historyId) return;
                const team = String(document?.team ?? '').trim();
                const company_kod = String(document?.company_kod ?? '').trim();
                const kodikos = employeeCodeFor(document, ancestors);
                if (!team || !company_kod || !kodikos) throw scopedReferenceError();
                const key = `${team}|${company_kod}|${kodikos}|${historyId}`;
                if (!targets.has(key)) {
                    targets.set(key, { team, company_kod, kodikos, historyId });
                }
            });
        }
    }
    return [...targets.values()];
}

module.exports = {
    REFERENCE_DEFINITIONS,
    SUPPORTED_COLLECTIONS,
    employeeHistoryReferenceQueryPaths,
    extractEmployeeHistoryReferences
};
