'use strict';

const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { IDENTITY_FIELDS } = require('../../utils/ergazomenoi/employmentProfileTransition');
const { effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { REBUILD_STATUSES, isSparseHireLifecycleEvidence,
    rebuildEmployeeHistory } = require('./employeeHistoryRebuilderService');

const STATES = Object.freeze({
    NO_HISTORY_CHANGE: 'NO_HISTORY_CHANGE',
    CORRECT_EXISTING: 'CORRECT_EXISTING',
    MOVE_EXISTING_BOUNDARY: 'MOVE_EXISTING_BOUNDARY',
    APPEND_NEW_VERSION: 'APPEND_NEW_VERSION',
    DEPARTURE: 'DEPARTURE',
    CANCEL_DEPARTURE: 'CANCEL_DEPARTURE',
    REHIRE: 'REHIRE',
    CONFLICT: 'CONFLICT'
});

const INTENTS = Object.freeze({
    MAINTENANCE: 'MAINTENANCE',
    HISTORY_CORRECTION: 'HISTORY_CORRECTION',
    APPEND_NEW_VERSION: 'APPEND_NEW_VERSION',
    DEPARTURE: 'DEPARTURE',
    CANCEL_DEPARTURE: 'CANCEL_DEPARTURE',
    REHIRE: 'REHIRE'
});

const BOUNDARY_FIELDS = new Set([
    'hmeromhnia_allaghs_symbashs',
    'hmeromhnia_allaghs_orarioy_apo',
    'hmeromhnia_allaghs_orarioy_eos',
    'hmeromhnia_isxyos_oron_ergasias_apo',
    'hmeromhnia_isxyos_oron_ergasias_eos'
]);

function comparable(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? value : value.getTime();
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
        const date = C.calendarDate(value.slice(0, 10));
        if (date) return date.getTime();
    }
    return value;
}

function changedPatch(stored = {}, submitted = {}) {
    return Object.fromEntries(Object.entries(submitted).filter(([, value]) => value !== undefined)
        .filter(([field, value]) => JSON.stringify(comparable(stored[field])) !== JSON.stringify(comparable(value))));
}

function semanticHistoryPatch(target = {}, currentEmployee = {}, submitted = {}) {
    const baseline = Object.fromEntries(Object.keys(submitted).map(field => [field,
        Object.hasOwn(target, field) ? target[field] : currentEmployee[field]]));
    return changedPatch(baseline, submitted);
}

function canonicalSnapshotEqual(row, snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || !Object.keys(snapshot).length) return false;
    return Object.entries(snapshot).every(([field, value]) =>
        JSON.stringify(comparable(row[field])) === JSON.stringify(comparable(value)));
}

function conflict(reason, field = null) {
    return {
        state: STATES.CONFLICT,
        status: REBUILD_STATUSES.MANUAL_REVIEW_REQUIRED,
        canonicalRows: [],
        rowsToUpdate: [],
        rowsToDelete: [],
        rowsToInsert: [],
        targetHistoryId: null,
        employeePatch: {},
        historyPatch: {},
        appendSnapshot: null,
        neighborPatches: [],
        conflicts: [{ reason, field }],
        idempotent: false,
        responseCode: reason,
        cleanupRequired: false,
        diagnostics: { reason }
    };
}

function sameScope(scope, row) {
    return ['team', 'company_kod', 'kodikos'].every(field =>
        String(row?.[field] ?? '') === String(scope?.[field] ?? ''));
}

function revision(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function isPollutedSameStartGroup(rows) {
    if (rows.length < 2) return false;
    const contractEnds = new Set(rows.map(row => comparable(row.hmeromhnia_lhxhs_symbashs))
        .filter(value => value !== null && value !== undefined));
    return contractEnds.size > 1;
}

function resolveDeterministicPollutedTarget(rows, currentEmployee) {
    if (!isPollutedSameStartGroup(rows)) return { polluted: false, target: null };
    const scope = Object.fromEntries(['team', 'company_kod', 'kodikos']
        .map(field => [field, currentEmployee?.[field] ?? rows[0]?.[field]]));
    const rebuilt = rebuildEmployeeHistory({ scope, currentEmployee, historyRows: rows });
    if (rebuilt.status === REBUILD_STATUSES.MANUAL_REVIEW_REQUIRED) {
        return { polluted: true, target: null };
    }
    const candidates = rebuilt.canonicalRows.filter(row => !isSparseHireLifecycleEvidence(row));
    const target = (candidates.length ? candidates : rebuilt.canonicalRows)
        .sort((left, right) => (effectiveStart(left)?.getTime() || 0) -
            (effectiveStart(right)?.getTime() || 0) ||
            Number(left.aa_eggrafhs || 0) - Number(right.aa_eggrafhs || 0)).at(-1);
    return { polluted: true, target: target || null };
}

function matchesCompleteIdentity(row, identity) {
    if (!identity || !IDENTITY_FIELDS.every(field => Object.hasOwn(identity, field))) return false;
    return IDENTITY_FIELDS.every(field => {
        const stored = field === 'hmeromhnia_isxyos_oron_ergasias_apo' ? effectiveStart(row) :
            field === 'hmeromhnia_isxyos_oron_ergasias_eos' ? effectiveEnd(row) : row[field];
        return comparable(stored) === comparable(identity[field]);
    });
}

function plan(state, target, employeePatch, historyPatch, options = {}) {
    return {
        state,
        status: options.status || (options.cleanupRequired
            ? REBUILD_STATUSES.AUTO_REPAIRABLE
            : state === STATES.NO_HISTORY_CHANGE && options.idempotent === true
                ? REBUILD_STATUSES.NO_CHANGE : REBUILD_STATUSES.CLEAN),
        canonicalRows: options.canonicalRows || [],
        rowsToUpdate: options.rowsToUpdate || [],
        rowsToDelete: options.rowsToDelete || [],
        rowsToInsert: options.rowsToInsert || (state === STATES.APPEND_NEW_VERSION && options.appendSnapshot
            ? [options.appendSnapshot] : []),
        targetHistoryId: target ? String(target._id) : null,
        employeePatch,
        historyPatch,
        appendSnapshot: options.appendSnapshot || null,
        neighborPatches: options.neighborPatches || [],
        conflicts: [],
        idempotent: options.idempotent === true,
        responseCode: options.responseCode || state,
        cleanupRequired: options.cleanupRequired === true,
        diagnostics: options.diagnostics || {}
    };
}

function resolveEmployeeHistoryMutation({
    scope,
    currentEmployee,
    historyRows = [],
    submittedState = {},
    intentHint = INTENTS.MAINTENANCE,
    historyId = null,
    expectedRevision = null
} = {}) {
    if (!scope || !['team', 'company_kod', 'kodikos'].every(field => String(scope[field] || '').trim())) {
        return conflict('CONFLICT_SCOPE');
    }
    const rows = historyRows.filter(row => sameScope(scope, row));
    if (rows.length !== historyRows.length || (currentEmployee && !sameScope(scope, currentEmployee))) {
        return conflict('CONFLICT_SCOPE');
    }
    if (intentHint === INTENTS.DEPARTURE) return plan(STATES.DEPARTURE, null, {}, {});
    if (intentHint === INTENTS.CANCEL_DEPARTURE) return plan(STATES.CANCEL_DEPARTURE, null, {}, {});
    if (intentHint === INTENTS.REHIRE) return plan(STATES.REHIRE, null, {}, {});

    const employeeSubmitted = submittedState.employeePatch || {};
    const historySubmitted = submittedState.historyPatch || {};
    const effectiveFrom = C.calendarDate(submittedState.effectiveFrom);
    const employeePatch = changedPatch(currentEmployee || {}, employeeSubmitted);
    const requestedTarget = historyId ? rows.find(row => String(row._id) === String(historyId)) : null;
    if (historyId && !requestedTarget) return conflict('CONFLICT_AMBIGUOUS_TARGET', 'historyId');
    if (requestedTarget && expectedRevision !== null &&
        revision(requestedTarget.updatedAt) !== revision(expectedRevision)) {
        return conflict('CONFLICT_STALE', 'expectedRevision');
    }
    const rebuild = rebuildEmployeeHistory({
        scope,
        currentEmployee,
        authoritativeCurrent: currentEmployee,
        historyRows: rows
    });
    if (rebuild.status === REBUILD_STATUSES.MANUAL_REVIEW_REQUIRED) {
        const result = conflict('EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED');
        result.conflicts = rebuild.conflicts;
        result.diagnostics = rebuild.diagnostics;
        return result;
    }
    const canonicalRows = rebuild.canonicalRows;
    const cleanupOptions = {
        status: rebuild.status,
        canonicalRows,
        rowsToUpdate: rebuild.rowsToUpdate,
        rowsToDelete: rebuild.rowsToDelete,
        cleanupRequired: rebuild.cleanupRequired,
        diagnostics: rebuild.diagnostics
    };

    if (intentHint === INTENTS.APPEND_NEW_VERSION) {
        if (!effectiveFrom) return conflict('NEW_VERSION_NOT_FUTURE', 'effectiveFrom');
        const sameStart = canonicalRows.filter(row => effectiveStart(row)?.getTime() === effectiveFrom.getTime());
        const appendSnapshot = submittedState.appendSnapshot;
        const identical = sameStart.find(row => canonicalSnapshotEqual(row, appendSnapshot));
        if (identical) return plan(STATES.NO_HISTORY_CHANGE, identical, employeePatch, {}, {
            ...cleanupOptions, idempotent: !rebuild.cleanupRequired && !Object.keys(employeePatch).length
        });
        const latestStart = Math.max(0, ...canonicalRows.map(row => effectiveStart(row)?.getTime() || 0));
        if (effectiveFrom.getTime() <= latestStart) return conflict('NEW_VERSION_NOT_FUTURE', 'effectiveFrom');
        return plan(STATES.APPEND_NEW_VERSION, null, employeePatch, historySubmitted,
            { ...cleanupOptions, appendSnapshot: appendSnapshot || null });
    }

    const canonicalTargetId = requestedTarget
        ? rebuild.replacementByDeletedId[String(requestedTarget._id)] || String(requestedTarget._id)
        : null;
    let target = canonicalTargetId
        ? canonicalRows.find(row => String(row._id) === canonicalTargetId) || null
        : null;
    if (!target) {
        const currentHire = comparable(currentEmployee?.hmeromhnia_proslhpshs);
        const cycleRows = canonicalRows.filter(row => comparable(row.hmeromhnia_proslhpshs) === currentHire);
        const latestStart = Math.max(0, ...cycleRows.map(row => effectiveStart(row)?.getTime() || 0));
        const candidates = cycleRows.filter(row => (effectiveStart(row)?.getTime() || 0) === latestStart);
        const polluted = resolveDeterministicPollutedTarget(candidates, currentEmployee);
        if (polluted.polluted && !polluted.target) return conflict('CONFLICT_INCONSISTENT_HISTORY');
        if (polluted.target) target = polluted.target;
        const identityMatches = target ? [] : candidates.filter(row => matchesCompleteIdentity(row, submittedState.identity));
        if (!target && identityMatches.length === 1) target = identityMatches[0];
        const currentStart = effectiveStart(currentEmployee)?.getTime() ?? null;
        const currentEnd = effectiveEnd(currentEmployee)?.getTime() ?? null;
        const currentMatches = candidates.filter(row =>
            (effectiveStart(row)?.getTime() ?? null) === currentStart &&
            (effectiveEnd(row)?.getTime() ?? null) === currentEnd);
        if (!target && currentMatches.length === 1) target = currentMatches[0];
        const recorded = candidates.filter(row => C.readEmploymentProfile(row).recorded);
        if (!target && recorded.length === 1) target = recorded[0];
        else if (!target && candidates.length === 1) target = candidates[0];
        else if (!target && candidates.length > 1) return conflict('CONFLICT_AMBIGUOUS_TARGET');
        else if (!target && canonicalRows.length) return conflict('CONFLICT_AMBIGUOUS_TARGET');
    }
    if (!target) {
        // Imported employees without any history retain the established baseline creation.
        return plan(STATES.APPEND_NEW_VERSION, null, employeePatch, historySubmitted,
            { ...cleanupOptions, appendSnapshot: submittedState.appendSnapshot || historySubmitted });
    }

    const targetStart = effectiveStart(target);
    const sameStart = canonicalRows.filter(row => effectiveStart(row)?.getTime() === targetStart?.getTime() &&
        comparable(row.hmeromhnia_proslhpshs) === comparable(target.hmeromhnia_proslhpshs));
    const sameStartTermsRows = sameStart.filter(row => !isSparseHireLifecycleEvidence(row));
    if (isSparseHireLifecycleEvidence(target) && sameStartTermsRows.length === 1) {
        target = sameStartTermsRows[0];
    }
    const polluted = resolveDeterministicPollutedTarget(sameStart, currentEmployee);
    if (polluted.polluted && !polluted.target) return conflict('CONFLICT_INCONSISTENT_HISTORY');
    if (polluted.target) target = polluted.target;
    const persistedTarget = rows.find(row => String(row._id) === String(target._id)) || target;
    const historyPatch = semanticHistoryPatch(persistedTarget, currentEmployee || {}, historySubmitted);
    if (Object.hasOwn(historyPatch, 'hmeromhnia_proslhpshs')) {
        return conflict('HIRE_DATE_REQUIRES_CONTROLLED_LIFECYCLE', 'hmeromhnia_proslhpshs');
    }
    // historyPatch is already server-mapped and allow-listed by the writer.
    // Every changed member is therefore history-relevant; arbitrary request
    // properties never reach this boundary.
    const historyRelevantPatch = historyPatch;
    if (!Object.keys(historyRelevantPatch).length) {
        return plan(STATES.NO_HISTORY_CHANGE, target, employeePatch, {},
            { ...cleanupOptions, idempotent: !rebuild.cleanupRequired && !Object.keys(employeePatch).length });
    }

    const boundaryChanged = Object.keys(historyRelevantPatch).some(field => BOUNDARY_FIELDS.has(field));
    if (boundaryChanged) {
        const proposed = { ...target, ...historyRelevantPatch };
        const from = effectiveStart(proposed);
        const until = effectiveEnd(proposed);
        if (!from || (until && until < from)) return conflict('CONFLICT_OVERLAP', 'effectiveFrom');
        const overlaps = canonicalRows.some(row => String(row._id) !== String(target._id) && effectiveStart(row) &&
            (!until || effectiveStart(row) <= until) && (!effectiveEnd(row) || effectiveEnd(row) >= from));
        if (overlaps) return conflict('CONFLICT_OVERLAP', 'effectiveFrom');
        return plan(STATES.MOVE_EXISTING_BOUNDARY, target, employeePatch, historyRelevantPatch,
            cleanupOptions);
    }
    return plan(STATES.CORRECT_EXISTING, target, employeePatch, historyRelevantPatch,
        cleanupOptions);
}

module.exports = { STATES, INTENTS, BOUNDARY_FIELDS, resolveDeterministicPollutedTarget,
    resolveEmployeeHistoryMutation };
