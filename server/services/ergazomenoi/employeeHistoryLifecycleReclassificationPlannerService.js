'use strict';

const crypto = require('node:crypto');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { partitionHistoryUpdateReferences } =
    require('./employeeHistoryReferenceSemanticsService');
const { CANONICAL_STATUSES, calculateCanonicalDiff, canonicalizeEmployeeHistory } =
    require('./employeeHistoryCanonicalizationService');
const { stableStringify } = require('./employeeLegacyOpenCycleCleanupService');

const OPERATION = 'HISTORY_LIFECYCLE_RECLASSIFICATION';
const AMBIGUITY_REASON = 'AMBIGUOUS_LIFECYCLE_EVENTS';
const PLAN_STATUSES = Object.freeze({
    APPLYABLE: 'APPLYABLE',
    NO_OP: 'NO_OP',
    BLOCKED_NOT_LIFECYCLE_AMBIGUITY: 'BLOCKED_NOT_LIFECYCLE_AMBIGUITY',
    BLOCKED_NO_UNIQUE_HIRE_ANCHOR: 'BLOCKED_NO_UNIQUE_HIRE_ANCHOR',
    BLOCKED_MULTIPLE_HIRE_ANCHORS: 'BLOCKED_MULTIPLE_HIRE_ANCHORS',
    BLOCKED_UNSAFE_REFERENCE: 'BLOCKED_UNSAFE_REFERENCE',
    BLOCKED_REMAINING_AMBIGUITY: 'BLOCKED_REMAINING_AMBIGUITY',
    BLOCKED_UNEXPECTED_MUTATION: 'BLOCKED_UNEXPECTED_MUTATION',
    BLOCKED_OTHER: 'BLOCKED_OTHER'
});
const SCOPE_FIELDS = Object.freeze(['team', 'company_kod', 'kodikos']);

function day(value) {
    return C.calendarDate(value)?.toISOString().slice(0, 10) || '';
}

function sha256(value) {
    return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function historyId(row = {}) {
    return row._id == null ? '' : String(row._id);
}

function scopeValue(scope = {}) {
    return Object.fromEntries(SCOPE_FIELDS.map(field =>
        [field, String(scope[field] ?? '').trim()]));
}

function eventMap(result = {}) {
    const byId = new Map();
    for (const event of result.events || []) {
        const id = String(event.historyId);
        if (!byId.has(id)) byId.set(id, []);
        byId.get(id).push(String(event.eventType));
    }
    return Object.fromEntries([...byId.entries()].sort(([left], [right]) =>
        left.localeCompare(right)).map(([id, events]) =>
        [id, events.length === 1 ? events[0] : [...new Set(events)].sort()]));
}

function rowEvents(result, id) {
    const value = eventMap(result)[String(id)];
    return value == null ? [] : Array.isArray(value) ? value : [value];
}

function independentHireBoundary(row = {}, hireDate) {
    const workTermsStart = day(row.hmeromhnia_isxyos_oron_ergasias_apo);
    const scheduleStart = day(row.hmeromhnia_allaghs_orarioy_apo);
    const contractChange = day(row.hmeromhnia_allaghs_symbashs);
    // Work-terms and schedule starts are row-specific. A copied contract-change
    // date is accepted only when neither stronger boundary exists on the row.
    if (workTermsStart || scheduleStart) {
        return workTermsStart === hireDate || scheduleStart === hireDate;
    }
    return contractChange === hireDate;
}

function cycleSummaries(cycles = []) {
    return cycles.map(cycle => ({
        cycleNo: cycle.cycle_no,
        hireDate: cycle.hire_date,
        departureDate: cycle.departure_date || null,
        historyIds: [...cycle.history_ids].map(String).sort()
    }));
}

function lifecycleDates(rows = []) {
    return Object.fromEntries(rows.map(row => [historyId(row), {
        hire: day(row.hmeromhnia_proslhpshs),
        departure: day(row.hmeromhnia_apoxorhshs),
        contractChange: day(row.hmeromhnia_allaghs_symbashs),
        contractEnd: day(row.hmeromhnia_lhxhs_symbashs),
        scheduleFrom: day(row.hmeromhnia_allaghs_orarioy_apo),
        scheduleTo: day(row.hmeromhnia_allaghs_orarioy_eos),
        workTermsFrom: day(row.hmeromhnia_isxyos_oron_ergasias_apo),
        workTermsTo: day(row.hmeromhnia_isxyos_oron_ergasias_eos)
    }]));
}

function basePlan({ scope, currentEmployee, completeHistoryRows }) {
    return {
        status: PLAN_STATUSES.BLOCKED_OTHER,
        reason: 'UNPLANNED',
        operation: OPERATION,
        scope,
        currentEmployeeId: currentEmployee?._id == null ? null : String(currentEmployee._id),
        currentPatch: {},
        desiredHistoryRows: [],
        changedHistoryIds: [],
        historyPatches: {},
        physicalDeleteIds: [],
        insertedRows: [],
        survivingHistoryIds: [],
        replacementByDeletedId: {},
        canonicalBefore: null,
        canonicalResult: null,
        secondCanonicalResult: null,
        currentEmployeeFingerprint: sha256(currentEmployee || null),
        historyInputFingerprint: sha256(completeHistoryRows || []),
        diagnostics: {
            originalReason: null,
            hireAnchorByCycle: {},
            cycleSummariesBefore: [],
            cycleSummariesAfter: [],
            finalLifecycleEvents: {},
            protectedReferenceSummary: {},
            currentEmployeeUnchanged: true,
            secondPassIdempotent: false
        }
    };
}

function finish(plan, status, reason) {
    const completed = { ...plan, status, reason };
    completed.planFingerprint = sha256({
        status, reason, operation: completed.operation, scope: completed.scope,
        currentEmployeeId: completed.currentEmployeeId,
        currentEmployeeFingerprint: completed.currentEmployeeFingerprint,
        historyInputFingerprint: completed.historyInputFingerprint,
        changedHistoryIds: completed.changedHistoryIds,
        historyPatches: completed.historyPatches,
        survivingHistoryIds: completed.survivingHistoryIds,
        diagnostics: completed.diagnostics
    });
    return completed;
}

function blocked(plan, status, reason, diagnostics = {}) {
    return finish({ ...plan, diagnostics: { ...plan.diagnostics, ...diagnostics } }, status, reason);
}

function planEmployeeHistoryLifecycleReclassification({ scope: rawScope, currentEmployee,
    completeHistoryRows = [], protectedReferenceSummary = {},
    referencePartitioner = partitionHistoryUpdateReferences,
    canonicalizer = canonicalizeEmployeeHistory } = {}) {
    const scope = scopeValue(rawScope);
    const plan = basePlan({ scope, currentEmployee, completeHistoryRows });
    try {
        if (!currentEmployee || !Array.isArray(completeHistoryRows) || !completeHistoryRows.length ||
            !SCOPE_FIELDS.every(field => scope[field]) ||
            typeof protectedReferenceSummary !== 'object' || protectedReferenceSummary === null ||
            SCOPE_FIELDS.some(field => String(currentEmployee[field] ?? '') !== scope[field]) ||
            completeHistoryRows.some(row => SCOPE_FIELDS.some(field =>
                String(row[field] ?? '') !== scope[field])) ||
            completeHistoryRows.some(row => !historyId(row)) ||
            new Set(completeHistoryRows.map(historyId)).size !== completeHistoryRows.length) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER, 'INVALID_OR_CONFLICTING_INPUT');
        }

        const canonicalBefore = canonicalizer({ scope, currentEmployee,
            historyRows: completeHistoryRows });
        plan.canonicalBefore = canonicalBefore;
        plan.diagnostics.originalReason = canonicalBefore.diagnostics?.reason || null;
        const alreadyClean = canonicalBefore.status === CANONICAL_STATUSES.CLEAN &&
            canonicalBefore.cleanupRequired === false && canonicalBefore.idempotent === true;
        if (!alreadyClean && (canonicalBefore.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY ||
            canonicalBefore.diagnostics?.reason !== AMBIGUITY_REASON)) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_NOT_LIFECYCLE_AMBIGUITY,
                canonicalBefore.diagnostics?.reason || canonicalBefore.status);
        }

        let cycles;
        try {
            cycles = buildEmploymentCycles({ currentEmployee, history: completeHistoryRows });
        } catch (error) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY,
                error.code || error.message);
        }
        if (!cycles.length) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_NO_UNIQUE_HIRE_ANCHOR,
                'NO_EMPLOYMENT_CYCLE');
        }
        plan.diagnostics.cycleSummariesBefore = cycleSummaries(cycles);

        const rowsByHire = new Map();
        for (const row of completeHistoryRows) {
            const hire = day(row.hmeromhnia_proslhpshs);
            if (!hire) return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER,
                'HISTORY_HIRE_DATE_MISSING', { historyId: historyId(row) });
            if (!rowsByHire.has(hire)) rowsByHire.set(hire, []);
            rowsByHire.get(hire).push(row);
        }
        const anchors = new Map();
        for (const cycle of cycles) {
            const rows = rowsByHire.get(cycle.hire_date) || [];
            const departures = [...new Set(rows.map(row => day(row.hmeromhnia_apoxorhshs))
                .filter(Boolean))];
            if (departures.length > 1) {
                return blocked(plan, PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY,
                    'COMPETING_DEPARTURE_DATES', { cycleNo: cycle.cycle_no, departures });
            }
            const candidates = rows.filter(row => independentHireBoundary(row, cycle.hire_date));
            if (!candidates.length) {
                return blocked(plan, PLAN_STATUSES.BLOCKED_NO_UNIQUE_HIRE_ANCHOR,
                    'NO_INDEPENDENT_HIRE_BOUNDARY', { cycleNo: cycle.cycle_no });
            }
            if (candidates.length > 1) {
                return blocked(plan, PLAN_STATUSES.BLOCKED_MULTIPLE_HIRE_ANCHORS,
                    'MULTIPLE_INDEPENDENT_HIRE_BOUNDARIES', {
                        cycleNo: cycle.cycle_no,
                        candidateHistoryIds: candidates.map(historyId).sort()
                    });
            }
            anchors.set(cycle.hire_date, candidates[0]);
            plan.diagnostics.hireAnchorByCycle[String(cycle.cycle_no)] = historyId(candidates[0]);
        }

        const proposedRows = completeHistoryRows.map(row => ({ ...row,
            afora_proslhpsh: historyId(anchors.get(day(row.hmeromhnia_proslhpshs))) ===
                historyId(row) }));
        const proposedFlagById = Object.fromEntries(proposedRows.map(row =>
            [historyId(row), row.afora_proslhpsh]));
        const changedIds = completeHistoryRows.filter(row =>
            row.afora_proslhpsh !== proposedFlagById[historyId(row)]).map(historyId).sort();

        if (alreadyClean && changedIds.length) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_NOT_LIFECYCLE_AMBIGUITY,
                'CLEAN_HISTORY_REQUIRES_NO_AUTOMATIC_RECLASSIFICATION');
        }
        if (alreadyClean && !changedIds.length) {
            plan.desiredHistoryRows = canonicalBefore.canonicalRows.map(row => ({ ...row }));
            plan.survivingHistoryIds = completeHistoryRows.map(historyId).sort();
            plan.canonicalResult = canonicalBefore;
            plan.secondCanonicalResult = canonicalBefore;
            plan.diagnostics.finalLifecycleEvents = eventMap(canonicalBefore);
            plan.diagnostics.cycleSummariesAfter = cycleSummaries(cycles);
            plan.diagnostics.secondPassIdempotent = true;
            return finish(plan, PLAN_STATUSES.NO_OP, 'ALREADY_STRICTLY_CLASSIFIED');
        }

        const referenceSummary = {};
        for (const historyIdValue of changedIds) {
            if (!Object.hasOwn(protectedReferenceSummary, historyIdValue) ||
                !Array.isArray(protectedReferenceSummary[historyIdValue])) {
                return blocked(plan, PLAN_STATUSES.BLOCKED_UNSAFE_REFERENCE,
                    'REFERENCE_STATE_NOT_LOADED', { historyId: historyIdValue });
            }
            const partitioned = referencePartitioner(protectedReferenceSummary[historyIdValue]);
            if (partitioned.liveDereference.length) {
                return blocked(plan, PLAN_STATUSES.BLOCKED_UNSAFE_REFERENCE,
                    'LIVE_DEREFERENCE_BLOCKS_RECLASSIFICATION', { historyId: historyIdValue });
            }
            referenceSummary[historyIdValue] = {
                count: partitioned.frozenProvenance.length,
                collections: [...new Set(partitioned.frozenProvenance
                    .map(reference => reference.collection))].sort()
            };
        }

        const canonical = canonicalizer({ scope, currentEmployee, historyRows: proposedRows });
        plan.canonicalResult = canonical;
        if (canonical.status === CANONICAL_STATUSES.TRUE_AMBIGUITY) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY,
                canonical.diagnostics?.reason || 'TRUE_AMBIGUITY');
        }
        if (canonical.status !== CANONICAL_STATUSES.CLEAN || canonical.cleanupRequired ||
            !canonical.idempotent || Object.keys(canonical.employeePatch || {}).length ||
            canonical.rowsToDelete.length || canonical.rowsToInsert?.length ||
            canonical.rowsToUpdate.length) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_UNEXPECTED_MUTATION,
                'CANONICALIZER_REQUIRES_ADDITIONAL_MUTATION');
        }

        const finalEvents = eventMap(canonical);
        for (const cycle of cycles) {
            const rows = rowsByHire.get(cycle.hire_date) || [];
            const events = rows.flatMap(row => rowEvents(canonical, historyId(row)));
            const anchorId = historyId(anchors.get(cycle.hire_date));
            if (events.filter(event => event === 'HIRE').length !== 1 ||
                !rowEvents(canonical, anchorId).includes('HIRE') ||
                (cycle.departure_date &&
                    events.filter(event => event.includes('DEPARTURE')).length !== 1)) {
                return blocked(plan, PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY,
                    'FINAL_LIFECYCLE_EVENTS_NOT_UNIQUE', { cycleNo: cycle.cycle_no });
            }
        }

        const second = canonicalizer({ scope, currentEmployee,
            historyRows: canonical.canonicalRows });
        plan.secondCanonicalResult = second;
        const secondPassIdempotent = second.status === CANONICAL_STATUSES.CLEAN &&
            second.cleanupRequired === false && second.idempotent === true &&
            stableStringify(second.canonicalRows) === stableStringify(canonical.canonicalRows) &&
            stableStringify(eventMap(second)) === stableStringify(finalEvents);
        if (!secondPassIdempotent) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY,
                'FINAL_CANONICAL_STATE_NOT_IDEMPOTENT');
        }

        let cyclesAfter;
        try {
            cyclesAfter = buildEmploymentCycles({ currentEmployee, history: canonical.canonicalRows });
        } catch (error) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_REMAINING_AMBIGUITY,
                error.code || error.message);
        }
        if (stableStringify(cycleSummaries(cyclesAfter)) !==
                stableStringify(cycleSummaries(cycles)) ||
            stableStringify(lifecycleDates(canonical.canonicalRows)) !==
                stableStringify(lifecycleDates(completeHistoryRows))) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_UNEXPECTED_MUTATION,
                'LIFECYCLE_BOUNDARY_CHANGED');
        }

        const diff = calculateCanonicalDiff(completeHistoryRows, canonical.canonicalRows);
        const updateIds = diff.rowsToUpdate.map(item => item.historyId).sort();
        const onlyAllowedPatches = diff.rowsToUpdate.every(item =>
            Object.keys(item.patch).length === 1 &&
            item.patch.afora_proslhpsh === proposedFlagById[item.historyId]);
        if (diff.rowsToDelete.length || updateIds.length !== changedIds.length ||
            stableStringify(updateIds) !== stableStringify(changedIds) || !onlyAllowedPatches) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_UNEXPECTED_MUTATION,
                'PHYSICAL_PLAN_EXCEEDS_BOOLEAN_RECLASSIFICATION');
        }

        plan.desiredHistoryRows = canonical.canonicalRows.map(row => ({ ...row }));
        plan.changedHistoryIds = updateIds;
        plan.historyPatches = Object.fromEntries(diff.rowsToUpdate.map(item =>
            [item.historyId, { ...item.patch }]));
        plan.survivingHistoryIds = completeHistoryRows.map(historyId).sort();
        plan.diagnostics.protectedReferenceSummary = referenceSummary;
        plan.diagnostics.finalLifecycleEvents = finalEvents;
        plan.diagnostics.cycleSummariesAfter = cycleSummaries(cyclesAfter);
        plan.diagnostics.secondPassIdempotent = true;
        return finish(plan, PLAN_STATUSES.APPLYABLE, 'STRICT_HIRE_FLAGS_READY');
    } catch (error) {
        return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER,
            error?.code || error?.message || 'PLANNER_EXCEPTION', {
                plannerException: error?.message || String(error)
            });
    }
}

module.exports = {
    OPERATION,
    AMBIGUITY_REASON,
    PLAN_STATUSES,
    sha256,
    eventMap,
    independentHireBoundary,
    planEmployeeHistoryLifecycleReclassification
};
