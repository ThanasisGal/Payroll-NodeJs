'use strict';

const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { effectiveStart, effectiveEnd } =
    require('../../utils/ergazomenoi/employmentProfileHistory');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { partitionHistoryUpdateReferences } =
    require('./employeeHistoryReferenceSemanticsService');
const { CANONICAL_STATUSES, calculateCanonicalDiff, canonicalizeEmployeeHistory,
    isPersistedReferencedRedundant } = require('./employeeHistoryCanonicalizationService');
const { stableStringify, sha256 } = require('./employeeLegacyOpenCycleCleanupService');

const OPERATION = 'HISTORY_DEPARTURE_DATE_CORRECTION';
const DEPARTURE_FIELD = 'hmeromhnia_apoxorhshs';
const END_FIELD = 'hmeromhnia_isxyos_oron_ergasias_eos';
const SCOPE_FIELDS = Object.freeze(['team', 'company_kod', 'kodikos']);
const PLAN_STATUSES = Object.freeze({
    APPLYABLE_DEPARTURE_ONLY: 'APPLYABLE_DEPARTURE_ONLY',
    APPLYABLE_WITH_PROVEN_CLAMP: 'APPLYABLE_WITH_PROVEN_CLAMP',
    NO_OP: 'NO_OP',
    BLOCKED_INVALID_DATE: 'BLOCKED_INVALID_DATE',
    BLOCKED_CYCLE_AMBIGUITY: 'BLOCKED_CYCLE_AMBIGUITY',
    BLOCKED_DEPARTURE_AMBIGUITY: 'BLOCKED_DEPARTURE_AMBIGUITY',
    BLOCKED_REHIRE_CONFLICT: 'BLOCKED_REHIRE_CONFLICT',
    BLOCKED_REFERENCE: 'BLOCKED_REFERENCE',
    BLOCKED_END_PROVENANCE: 'BLOCKED_END_PROVENANCE',
    BLOCKED_FINAL_CANONICAL: 'BLOCKED_FINAL_CANONICAL',
    BLOCKED_OTHER: 'BLOCKED_OTHER'
});
const CLAMP_OWNERSHIP = Object.freeze({
    DEPARTURE_OWNED: 'DEPARTURE_OWNED',
    INDEPENDENT: 'INDEPENDENT',
    UNKNOWN: 'UNKNOWN',
    NOT_PRESENT: 'NOT_PRESENT'
});

function day(value) {
    return C.calendarDate(value)?.toISOString().slice(0, 10) || '';
}

function strictRequestedDay(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : day(value);
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    return day(value) === value ? value : '';
}

function historyId(row = {}) {
    return row._id == null ? '' : String(row._id);
}

function normalizedScope(scope = {}) {
    return Object.fromEntries(SCOPE_FIELDS.map(field =>
        [field, String(scope[field] ?? '').trim()]));
}

function eventMap(result = {}) {
    const mapped = {};
    for (const event of result.events || []) {
        const id = String(event.historyId);
        if (!mapped[id]) mapped[id] = [];
        mapped[id].push(event.eventType);
    }
    return Object.fromEntries(Object.entries(mapped).sort(([left], [right]) =>
        left.localeCompare(right)).map(([id, events]) =>
            [id, events.length === 1 ? events[0] : [...new Set(events)].sort()]));
}

function latestProfileRow(canonical = {}, hireDate) {
    const profileIds = new Set((canonical.events || []).filter(event =>
        event.hireDate === hireDate && ['PROFILE_CHANGE', 'PROFILE_CHANGE_DEPARTURE']
            .includes(event.eventType)).map(event => String(event.historyId)));
    return (canonical.canonicalRows || []).filter(row => profileIds.has(historyId(row)))
        .sort((left, right) => (effectiveStart(left)?.getTime() || 0) -
            (effectiveStart(right)?.getTime() || 0) || historyId(left).localeCompare(historyId(right)))
        .at(-1) || null;
}

function earlier(left, right) {
    const leftTime = left ? new Date(left).getTime() : NaN;
    const rightTime = right ? new Date(right).getTime() : NaN;
    return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime < rightTime;
}

function independentProfileEndEvidence({ departureAuditContext = [], profileId,
    terminalHistoryId, oldDeparture }) {
    for (const evidence of departureAuditContext || []) {
        if (evidence?.type === 'INDEPENDENT_PROFILE_END' &&
            String(evidence.profileId || '') === profileId &&
            day(evidence.endDate) === oldDeparture && evidence.observedBeforeDeparture === true) {
            return true;
        }
        for (const snapshotName of ['historyBefore', 'historyAfter']) {
            const rows = Array.isArray(evidence?.[snapshotName]) ? evidence[snapshotName] : [];
            const profile = rows.find(row => historyId(row) === profileId &&
                day(row[END_FIELD]) === oldDeparture);
            const terminal = rows.find(row => historyId(row) === terminalHistoryId &&
                day(row[DEPARTURE_FIELD]) === oldDeparture);
            if (profile && terminal && earlier(profile.updatedAt, terminal.updatedAt)) return true;
        }
    }
    return false;
}

function basePlan({ scope, currentEmployee, completeHistoryRows, requestedDepartureDate }) {
    return {
        operation: OPERATION,
        status: PLAN_STATUSES.BLOCKED_OTHER,
        reason: 'UNPLANNED',
        scope,
        currentEmployeeId: currentEmployee?._id == null ? null : String(currentEmployee._id),
        oldDeparture: day(currentEmployee?.[DEPARTURE_FIELD]) || null,
        newDeparture: strictRequestedDay(requestedDepartureDate) || null,
        terminalHistoryId: null,
        latestProfileId: null,
        currentPatch: {},
        historyPatches: {},
        desiredHistoryRows: [],
        changedHistoryIds: [],
        survivingHistoryIds: [],
        clampOwnership: {
            currentEnd: CLAMP_OWNERSHIP.NOT_PRESENT,
            profileEnd: CLAMP_OWNERSHIP.NOT_PRESENT
        },
        canonicalBefore: null,
        canonicalResult: null,
        secondCanonicalResult: null,
        diagnostics: {
            currentEmployeeFingerprint: sha256(currentEmployee || null),
            historyInputFingerprint: sha256(completeHistoryRows || []),
            protectedReferenceSummary: {},
            finalLifecycleEvents: {},
            secondPassIdempotent: false,
            profileGap: []
        }
    };
}

function finish(plan, status, reason) {
    const completed = { ...plan, status, reason };
    completed.planFingerprint = sha256({
        operation: completed.operation,
        status: completed.status,
        reason: completed.reason,
        scope: completed.scope,
        currentEmployeeId: completed.currentEmployeeId,
        oldDeparture: completed.oldDeparture,
        newDeparture: completed.newDeparture,
        terminalHistoryId: completed.terminalHistoryId,
        latestProfileId: completed.latestProfileId,
        currentPatch: completed.currentPatch,
        historyPatches: completed.historyPatches,
        changedHistoryIds: completed.changedHistoryIds,
        survivingHistoryIds: completed.survivingHistoryIds,
        clampOwnership: completed.clampOwnership,
        diagnostics: completed.diagnostics
    });
    return completed;
}

function blocked(plan, status, reason, diagnostics = {}) {
    return finish({ ...plan, diagnostics: { ...plan.diagnostics, ...diagnostics } }, status, reason);
}

function profileGap(profileEnd, departure) {
    if (!profileEnd || !departure || profileEnd >= departure) return [];
    const cursor = C.calendarDate(profileEnd);
    const end = C.calendarDate(departure);
    const gap = [];
    while (cursor && end && cursor < end) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        gap.push(cursor.toISOString().slice(0, 10));
    }
    return gap;
}

function planEmployeeDepartureDateCorrection({ scope: rawScope, currentEmployee,
    completeHistoryRows = [], requestedDepartureDate, protectedReferences = {},
    departureAuditContext = [], referencePartitioner = partitionHistoryUpdateReferences,
    canonicalizer = canonicalizeEmployeeHistory } = {}) {
    const scope = normalizedScope(rawScope);
    const plan = basePlan({ scope, currentEmployee, completeHistoryRows, requestedDepartureDate });
    try {
        if (!currentEmployee || !Array.isArray(completeHistoryRows) ||
            !SCOPE_FIELDS.every(field => scope[field]) ||
            SCOPE_FIELDS.some(field => String(currentEmployee[field] ?? '') !== scope[field]) ||
            completeHistoryRows.some(row => SCOPE_FIELDS.some(field =>
                String(row[field] ?? '') !== scope[field])) ||
            completeHistoryRows.some(row => !historyId(row)) ||
            new Set(completeHistoryRows.map(historyId)).size !== completeHistoryRows.length) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER, 'INVALID_OR_CONFLICTING_INPUT');
        }
        const oldDeparture = day(currentEmployee[DEPARTURE_FIELD]);
        const requested = strictRequestedDay(requestedDepartureDate);
        const hire = day(currentEmployee.hmeromhnia_proslhpshs);
        if (!oldDeparture || !requested || !hire || requested < hire) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_INVALID_DATE,
                !oldDeparture ? 'CURRENT_DEPARTURE_MISSING' : !requested
                    ? 'REQUESTED_DEPARTURE_INVALID' : 'REQUESTED_DEPARTURE_BEFORE_HIRE');
        }

        const activeRows = completeHistoryRows.filter(row => !isPersistedReferencedRedundant(row));
        const otherHires = [...new Set(activeRows.map(row => day(row.hmeromhnia_proslhpshs))
            .filter(value => value && value !== hire))];
        const lower = requested < oldDeparture ? requested : oldDeparture;
        const upper = requested > oldDeparture ? requested : oldDeparture;
        const interveningHires = otherHires.filter(value => value > lower && value <= upper);
        if (interveningHires.length) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_REHIRE_CONFLICT,
                'HIRE_OR_REHIRE_BETWEEN_DEPARTURES', { interveningHires: interveningHires.sort() });
        }

        const departureRows = activeRows.filter(row =>
            day(row.hmeromhnia_proslhpshs) === hire && day(row[DEPARTURE_FIELD]));
        if (departureRows.length !== 1 || day(departureRows[0]?.[DEPARTURE_FIELD]) !== oldDeparture) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_DEPARTURE_AMBIGUITY,
                'CURRENT_AND_HISTORY_DEPARTURE_NOT_UNIQUE_OR_EQUAL', {
                    departureHistoryIds: departureRows.map(historyId).sort(),
                    historyDepartureDates: departureRows.map(row => day(row[DEPARTURE_FIELD])).sort()
                });
        }

        const canonicalBefore = canonicalizer({ scope, currentEmployee,
            historyRows: completeHistoryRows });
        plan.canonicalBefore = canonicalBefore;
        if (canonicalBefore.status !== CANONICAL_STATUSES.CLEAN ||
            canonicalBefore.cleanupRequired || !canonicalBefore.idempotent) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_CYCLE_AMBIGUITY,
                canonicalBefore.diagnostics?.reason || 'CURRENT_CANONICAL_STATE_NOT_CLEAN');
        }
        let cycles;
        try {
            cycles = buildEmploymentCycles({ currentEmployee, history: canonicalBefore.canonicalRows });
        } catch (error) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_CYCLE_AMBIGUITY,
                error.code || error.message);
        }
        const currentCycles = cycles.filter(cycle => cycle.is_current_cycle);
        if (currentCycles.length !== 1 || currentCycles[0].hire_date !== hire ||
            currentCycles[0].departure_date !== oldDeparture) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_CYCLE_AMBIGUITY,
                'CURRENT_EMPLOYMENT_CYCLE_NOT_UNIQUE');
        }
        const currentCycle = currentCycles[0];
        const canonicalDepartureEvents = (canonicalBefore.events || []).filter(event =>
            event.hireDate === hire && String(event.eventType).includes('DEPARTURE'));
        if (departureRows.length !== 1 || canonicalDepartureEvents.length !== 1 ||
            historyId(departureRows[0]) !== String(canonicalDepartureEvents[0].historyId) ||
            day(departureRows[0][DEPARTURE_FIELD]) !== oldDeparture ||
            !currentCycle.history_ids.includes(historyId(departureRows[0]))) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_DEPARTURE_AMBIGUITY,
                'CURRENT_AND_HISTORY_DEPARTURE_NOT_UNIQUE_OR_EQUAL', {
                    departureHistoryIds: departureRows.map(historyId).sort(),
                    canonicalDepartureHistoryIds: canonicalDepartureEvents
                        .map(event => String(event.historyId)).sort()
                });
        }
        const terminal = departureRows[0];
        plan.terminalHistoryId = historyId(terminal);
        const profile = latestProfileRow(canonicalBefore, hire);
        plan.latestProfileId = profile ? historyId(profile) : null;

        if (requested === oldDeparture) {
            plan.desiredHistoryRows = canonicalBefore.canonicalRows.map(row => ({ ...row }));
            plan.survivingHistoryIds = plan.desiredHistoryRows.map(historyId).sort();
            plan.canonicalResult = canonicalBefore;
            plan.secondCanonicalResult = canonicalBefore;
            plan.diagnostics.finalLifecycleEvents = eventMap(canonicalBefore);
            plan.diagnostics.secondPassIdempotent = true;
            return finish(plan, PLAN_STATUSES.NO_OP, 'DEPARTURE_ALREADY_MATCHES');
        }

        const marker = currentEmployee.employment_departure_restore;
        const markerExists = marker !== undefined && marker !== null;
        const markerMatches = markerExists && marker.departure === oldDeparture &&
            String(marker.terminal_id || '') === plan.terminalHistoryId &&
            (!marker.profile_id || String(marker.profile_id) === plan.latestProfileId);
        if (markerExists && !markerMatches) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_END_PROVENANCE,
                'DEPARTURE_PROVENANCE_MARKER_CONFLICT');
        }
        const independentProfile = profile && independentProfileEndEvidence({
            departureAuditContext, profileId: plan.latestProfileId,
            terminalHistoryId: plan.terminalHistoryId, oldDeparture
        });
        const currentEnd = day(currentEmployee[END_FIELD]);
        const profileEnd = day(effectiveEnd(profile || {}));
        plan.clampOwnership = {
            currentEnd: markerMatches && marker.employee_end_clamped === true
                ? CLAMP_OWNERSHIP.DEPARTURE_OWNED
                : currentEnd ? independentProfile && currentEnd === profileEnd
                    ? CLAMP_OWNERSHIP.INDEPENDENT : CLAMP_OWNERSHIP.UNKNOWN
                    : CLAMP_OWNERSHIP.NOT_PRESENT,
            profileEnd: markerMatches && marker.profile_end_clamped === true
                ? CLAMP_OWNERSHIP.DEPARTURE_OWNED
                : profileEnd ? independentProfile
                    ? CLAMP_OWNERSHIP.INDEPENDENT : CLAMP_OWNERSHIP.UNKNOWN
                    : CLAMP_OWNERSHIP.NOT_PRESENT
        };
        if ((plan.clampOwnership.currentEnd === CLAMP_OWNERSHIP.DEPARTURE_OWNED &&
                currentEnd !== oldDeparture) ||
            (plan.clampOwnership.profileEnd === CLAMP_OWNERSHIP.DEPARTURE_OWNED &&
                (!profile || profileEnd !== oldDeparture ||
                    String(marker.profile_id || '') !== plan.latestProfileId))) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_END_PROVENANCE,
                'PROVEN_CLAMP_NO_LONGER_MATCHES_DEPARTURE');
        }
        if (requested < oldDeparture &&
            ((currentEnd && currentEnd > requested &&
                plan.clampOwnership.currentEnd !== CLAMP_OWNERSHIP.DEPARTURE_OWNED) ||
            ((!profileEnd || profileEnd > requested) &&
                plan.clampOwnership.profileEnd !== CLAMP_OWNERSHIP.DEPARTURE_OWNED))) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_END_PROVENANCE,
                'EARLIER_DEPARTURE_WOULD_REQUIRE_UNPROVEN_END_CHANGE');
        }

        const newDate = C.calendarDate(requested);
        const currentPatch = { [DEPARTURE_FIELD]: newDate };
        const historyPatches = {
            [plan.terminalHistoryId]: { [DEPARTURE_FIELD]: newDate }
        };
        let movesClamp = false;
        if (plan.clampOwnership.currentEnd === CLAMP_OWNERSHIP.DEPARTURE_OWNED) {
            currentPatch[END_FIELD] = newDate;
            movesClamp = true;
        }
        if (plan.clampOwnership.profileEnd === CLAMP_OWNERSHIP.DEPARTURE_OWNED) {
            historyPatches[plan.latestProfileId] = {
                ...(historyPatches[plan.latestProfileId] || {}), [END_FIELD]: newDate
            };
            movesClamp = true;
        }
        if (markerMatches) {
            currentPatch.employment_departure_restore = { ...marker, departure: requested };
        }

        const proposedCurrent = { ...currentEmployee, ...currentPatch };
        const proposedRows = canonicalBefore.canonicalRows.map(row => ({ ...row,
            ...(historyPatches[historyId(row)] || {}) }));
        const originalIds = canonicalBefore.canonicalRows.map(historyId).sort();
        const proposedIds = proposedRows.map(historyId).sort();
        if (stableStringify(originalIds) !== stableStringify(proposedIds)) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER, 'HISTORY_IDENTITIES_CHANGED');
        }
        const diff = calculateCanonicalDiff(canonicalBefore.canonicalRows, proposedRows);
        const allowedById = new Map(Object.entries(historyPatches));
        const exactHistoryChanges = !diff.rowsToDelete.length && !diff.rowsToInsert.length &&
            diff.rowsToUpdate.length === allowedById.size && diff.rowsToUpdate.every(item => {
                const expected = allowedById.get(item.historyId);
                return expected && stableStringify(item.patch) === stableStringify(expected);
            });
        if (!exactHistoryChanges) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER,
                'UNEXPECTED_HISTORY_MUTATION_REQUIRED');
        }

        const protectedReferenceSummary = {};
        for (const changedId of [...allowedById.keys()].sort()) {
            if (!Object.hasOwn(protectedReferences, changedId) ||
                !Array.isArray(protectedReferences[changedId])) {
                return blocked(plan, PLAN_STATUSES.BLOCKED_REFERENCE,
                    'REFERENCE_STATE_NOT_LOADED', { historyId: changedId });
            }
            let partitioned;
            try {
                partitioned = referencePartitioner(protectedReferences[changedId]);
            } catch (error) {
                return blocked(plan, PLAN_STATUSES.BLOCKED_REFERENCE,
                    error.message || 'REFERENCE_SEMANTICS_UNKNOWN', { historyId: changedId });
            }
            if (partitioned.liveDereference.length) {
                return blocked(plan, PLAN_STATUSES.BLOCKED_REFERENCE,
                    'LIVE_DEREFERENCE_BLOCKS_DEPARTURE_CORRECTION', { historyId: changedId });
            }
            protectedReferenceSummary[changedId] = {
                count: partitioned.frozenProvenance.length,
                collections: [...new Set(partitioned.frozenProvenance
                    .map(reference => reference.collection))].sort()
            };
        }

        const canonical = canonicalizer({ scope, currentEmployee: proposedCurrent,
            historyRows: proposedRows });
        plan.canonicalResult = canonical;
        if (canonical.status !== CANONICAL_STATUSES.CLEAN || canonical.cleanupRequired ||
            !canonical.idempotent || canonical.rowsToDelete.length || canonical.rowsToInsert.length) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_FINAL_CANONICAL,
                canonical.diagnostics?.reason || 'FINAL_CANONICAL_STATE_NOT_CLEAN');
        }
        const second = canonicalizer({ scope, currentEmployee: proposedCurrent,
            historyRows: canonical.canonicalRows });
        plan.secondCanonicalResult = second;
        const secondPassIdempotent = second.status === CANONICAL_STATUSES.CLEAN &&
            second.cleanupRequired === false && second.idempotent === true &&
            stableStringify(second.canonicalRows) === stableStringify(canonical.canonicalRows);
        if (!secondPassIdempotent) {
            return blocked(plan, PLAN_STATUSES.BLOCKED_FINAL_CANONICAL,
                second.diagnostics?.reason || 'SECOND_CANONICAL_PASS_NOT_IDEMPOTENT');
        }

        plan.currentPatch = currentPatch;
        plan.historyPatches = historyPatches;
        plan.desiredHistoryRows = canonical.canonicalRows.map(row => ({ ...row }));
        plan.changedHistoryIds = [...allowedById.keys()].sort();
        plan.survivingHistoryIds = plan.desiredHistoryRows.map(historyId).sort();
        plan.diagnostics.protectedReferenceSummary = protectedReferenceSummary;
        plan.diagnostics.finalLifecycleEvents = eventMap(canonical);
        plan.diagnostics.secondPassIdempotent = true;
        plan.diagnostics.profileGap = profileGap(day(effectiveEnd(
            plan.desiredHistoryRows.find(row => historyId(row) === plan.latestProfileId) || {})), requested);
        return finish(plan, movesClamp ? PLAN_STATUSES.APPLYABLE_WITH_PROVEN_CLAMP
            : PLAN_STATUSES.APPLYABLE_DEPARTURE_ONLY,
        movesClamp ? 'DEPARTURE_AND_PROVEN_CLAMP_READY' : 'DEPARTURE_ONLY_READY');
    } catch (error) {
        return blocked(plan, PLAN_STATUSES.BLOCKED_OTHER,
            'DEPARTURE_DATE_CORRECTION_PLANNER_EXCEPTION', {
                plannerException: error?.message || String(error)
            });
    }
}

module.exports = { OPERATION, DEPARTURE_FIELD, END_FIELD, PLAN_STATUSES, CLAMP_OWNERSHIP,
    independentProfileEndEvidence, planEmployeeDepartureDateCorrection };
