'use strict';

const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { effectiveStart } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
const { PROFILE_EQUIVALENCE_FIELDS, CANONICAL_STATUSES,
    canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { buildEmployeeDepartureTransition } = require('./employeeDepartureLifecycleTransitionService');
const { partitionHistoryUpdateReferences } =
    require('./employeeHistoryReferenceSemanticsService');

const OPERATION = 'DEPARTURE_WITH_DEFERRED_HISTORY_AMBIGUITY';
const ELIGIBLE_REASON = 'HISTORICAL_OVERLAP_EXCLUDES_UNIQUE_LATEST_PROFILE';
const PLAN_STATUSES = Object.freeze({
    APPLYABLE: 'APPLYABLE_DEPARTURE_WITH_DEFERRED_HISTORY_AMBIGUITY',
    BLOCKED: 'BLOCKED_DEPARTURE_WITH_DEFERRED_HISTORY_AMBIGUITY'
});

function comparable(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
        return C.calendarDate(value.slice(0, 10))?.toISOString() || value;
    }
    if (value && typeof value === 'object' && typeof value.toHexString === 'function') {
        return value.toHexString();
    }
    if (Array.isArray(value)) return value.map(comparable);
    return value;
}

function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object' && !(value instanceof Date) &&
        typeof value.toHexString !== 'function') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(comparable(value));
}

function same(left, right) {
    return stable(left) === stable(right);
}

function meaningful(value) {
    return value !== undefined && value !== null && value !== '';
}

function profileMatchesCurrent(row, current) {
    if (dateKeyUtc(row.hmeromhnia_proslhpshs) !== dateKeyUtc(current.hmeromhnia_proslhpshs) ||
        (effectiveStart(row)?.getTime() ?? null) !== (effectiveStart(current)?.getTime() ?? null)) {
        return false;
    }
    const fields = PROFILE_EQUIVALENCE_FIELDS.filter(field =>
        meaningful(row[field]) && meaningful(current[field]));
    return fields.length > 0 && fields.every(field => same(row[field], current[field]));
}

function blocked(reason, diagnostics = {}) {
    return { status: PLAN_STATUSES.BLOCKED, reason, currentPatch: {}, historyPatches: {},
        changedHistoryIds: [], diagnostics, planFingerprint: stable({ reason, diagnostics }) };
}

function planEmployeeDepartureWithDeferredHistoryAmbiguity({ scope, currentEmployee,
    completeHistoryRows = [], requestedDepartureDate, protectedReferences = {},
    canonicalizer = canonicalizeEmployeeHistory,
    referencePartitioner = partitionHistoryUpdateReferences } = {}) {
    if (!scope || !currentEmployee || !Array.isArray(completeHistoryRows)) {
        return blocked('INVALID_INPUT');
    }
    if (dateKeyUtc(currentEmployee.hmeromhnia_apoxorhshs)) {
        return blocked('NOT_FIRST_DEPARTURE');
    }
    const departure = dateKeyUtc(requestedDepartureDate);
    const hire = dateKeyUtc(currentEmployee.hmeromhnia_proslhpshs);
    if (!departure) return blocked('INVALID_DEPARTURE_DATE');
    if (!hire || departure < hire) return blocked('DEPARTURE_BEFORE_HIRE');

    const canonicalBefore = canonicalizer({ scope, currentEmployee,
        historyRows: completeHistoryRows });
    if (canonicalBefore.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY ||
        canonicalBefore.diagnostics?.reason !== 'OVERLAPPING_GENUINE_PERIODS') {
        return blocked('UNSUPPORTED_CANONICAL_AMBIGUITY', {
            canonicalStatusBefore: canonicalBefore.status,
            canonicalReasonBefore: canonicalBefore.diagnostics?.reason || null
        });
    }

    let cycles;
    try {
        cycles = buildEmploymentCycles({ currentEmployee, history: completeHistoryRows });
    } catch (error) {
        return blocked('EMPLOYMENT_CYCLE_AMBIGUITY', { lifecycleCode: error.code || null });
    }
    const currentCycle = cycles.at(-1);
    if (!currentCycle?.is_current_cycle || currentCycle.hire_date !== hire ||
        currentCycle.departure_date !== null || cycles.filter(cycle => cycle.is_current_cycle).length !== 1) {
        return blocked('EMPLOYMENT_CYCLE_AMBIGUITY');
    }
    const cycleRows = currentCycle.history_ids.map(id =>
        completeHistoryRows.find(row => String(row._id) === String(id))).filter(Boolean);
    if (cycleRows.length !== currentCycle.history_ids.length || !cycleRows.length) {
        return blocked('CURRENT_CYCLE_HISTORY_MISSING');
    }
    const starts = cycleRows.map(row => effectiveStart(row)?.getTime() ?? null)
        .filter(value => value !== null);
    const latestStart = starts.length ? Math.max(...starts) : null;
    const latestRows = latestStart === null ? [] : cycleRows.filter(row =>
        effectiveStart(row)?.getTime() === latestStart);
    const matchingLatest = latestRows.filter(row => profileMatchesCurrent(row, currentEmployee));
    if (latestRows.length !== 1 || matchingLatest.length !== 1) {
        return blocked('LATEST_PROFILE_AMBIGUOUS', {
            latestHistoryIds: latestRows.map(row => String(row._id))
        });
    }
    const latest = matchingLatest[0];
    const unresolvedHistoryIds = [...new Set(canonicalBefore.diagnostics.historyIds || [])]
        .map(String).sort();
    if (!unresolvedHistoryIds.length || unresolvedHistoryIds.includes(String(latest._id)) ||
        unresolvedHistoryIds.some(id => {
            const row = cycleRows.find(item => String(item._id) === id);
            return !row || (effectiveStart(row)?.getTime() ?? Infinity) >= latestStart;
        })) {
        return blocked('LATEST_PROFILE_INVOLVED_IN_AMBIGUITY', {
            latestAuthoritativeHistoryId: String(latest._id), unresolvedHistoryIds
        });
    }

    let transition;
    try {
        transition = buildEmployeeDepartureTransition({ currentEmployee,
            history: completeHistoryRows, departureDate: departure });
    } catch (error) {
        return blocked(error.code || 'DEPARTURE_TRANSITION_BLOCKED');
    }
    if (String(transition.latestProfileRow?._id) !== String(latest._id) ||
        String(transition.terminalHistoryRow?._id) !== String(latest._id)) {
        return blocked('TERMINAL_PROFILE_MISMATCH', {
            latestAuthoritativeHistoryId: String(latest._id),
            terminalHistoryId: String(transition.terminalHistoryRow?._id || '')
        });
    }

    const changedHistoryIds = [String(latest._id)];
    const protectedReferenceSummary = {};
    for (const row of completeHistoryRows) {
        const id = String(row._id);
        if (!Object.hasOwn(protectedReferences, id) || !Array.isArray(protectedReferences[id])) {
            return blocked('PROTECTED_REFERENCE_STATE_MISSING', { historyId: id });
        }
        let partitioned;
        try {
            partitioned = referencePartitioner(protectedReferences[id]);
        } catch {
            return blocked('PROTECTED_REFERENCE_SEMANTICS_UNKNOWN', { historyId: id });
        }
        if (changedHistoryIds.includes(id) && partitioned.liveDereference.length) {
            return blocked('LIVE_DEREFERENCE_BLOCKS_DEPARTURE', { historyId: id });
        }
        protectedReferenceSummary[id] = {
            frozenProvenance: partitioned.frozenProvenance.length,
            liveDereference: partitioned.liveDereference.length,
            collections: [...new Set(partitioned.frozenProvenance.map(item => item.collection))].sort()
        };
    }

    const departureDate = C.calendarDate(departure);
    const historyPatch = { hmeromhnia_apoxorhshs: departureDate };
    if (transition.clampProfileEnd) {
        historyPatch.hmeromhnia_isxyos_oron_ergasias_eos = departureDate;
    }
    const currentPatch = {
        hmeromhnia_apoxorhshs: departureDate,
        energos: false,
        employment_departure_restore: {
            departure,
            terminal_id: String(latest._id),
            profile_id: String(latest._id),
            employee_end_clamped: Boolean(transition.clampEmployeeEnd),
            profile_end_clamped: Boolean(transition.clampProfileEnd),
            employee_end_before: currentEmployee.hmeromhnia_isxyos_oron_ergasias_eos ?? null,
            profile_end_before: latest.hmeromhnia_isxyos_oron_ergasias_eos ?? null
        }
    };
    if (transition.clampEmployeeEnd) {
        currentPatch.hmeromhnia_isxyos_oron_ergasias_eos = departureDate;
    }
    const historyPatches = { [String(latest._id)]: historyPatch };
    const diagnostics = {
        operation: OPERATION,
        eligibilityReason: ELIGIBLE_REASON,
        departureDate: departure,
        canonicalStatusBefore: canonicalBefore.status,
        canonicalReasonBefore: canonicalBefore.diagnostics.reason,
        unresolvedHistoryIds,
        latestAuthoritativeHistoryId: String(latest._id),
        terminalHistoryId: String(latest._id),
        protectedReferenceSummary,
        unchangedHistoryIds: completeHistoryRows.map(row => String(row._id))
            .filter(id => !changedHistoryIds.includes(id)).sort()
    };
    const planFingerprint = stable({ scope, employeeId: String(currentEmployee._id),
        hire, departure, currentPatch, historyPatches, diagnostics });
    return { status: PLAN_STATUSES.APPLYABLE, reason: ELIGIBLE_REASON,
        currentPatch, historyPatches, changedHistoryIds,
        latestAuthoritativeHistoryId: String(latest._id),
        terminalHistoryId: String(latest._id), unresolvedHistoryIds,
        canonicalBefore, transition, diagnostics, planFingerprint };
}

function verifyDepartureWithDeferredHistoryAmbiguity({ plan, currentBefore, historyBefore,
    currentAfter, historyAfter, canonicalizer = canonicalizeEmployeeHistory } = {}) {
    const fail = reason => ({ ok: false, reason });
    if (plan?.status !== PLAN_STATUSES.APPLYABLE) return fail('PLAN_NOT_APPLYABLE');
    const expectedCurrent = { ...currentBefore, ...plan.currentPatch };
    const currentComparable = record => Object.fromEntries(Object.entries(record || {})
        .filter(([field]) => !['updatedAt', '__v'].includes(field)));
    if (!same(currentComparable(currentAfter), currentComparable(expectedCurrent))) {
        return fail('CURRENT_STATE_MISMATCH');
    }
    const beforeIds = historyBefore.map(row => String(row._id)).sort();
    const afterIds = historyAfter.map(row => String(row._id)).sort();
    if (!same(beforeIds, afterIds)) return fail('HISTORY_IDENTITIES_CHANGED');
    const beforeById = new Map(historyBefore.map(row => [String(row._id), row]));
    const afterById = new Map(historyAfter.map(row => [String(row._id), row]));
    for (const id of beforeIds) {
        const before = beforeById.get(id), after = afterById.get(id);
        if (!Object.hasOwn(plan.historyPatches, id)) {
            if (!same(before, after)) return fail(`UNRELATED_HISTORY_CHANGED:${id}`);
            continue;
        }
        const expected = { ...before, ...plan.historyPatches[id] };
        const withoutRevision = record => Object.fromEntries(Object.entries(record)
            .filter(([field]) => field !== 'updatedAt'));
        if (!same(withoutRevision(after), withoutRevision(expected))) {
            return fail(`TARGET_HISTORY_MISMATCH:${id}`);
        }
    }
    let beforeCycles, afterCycles;
    try {
        beforeCycles = buildEmploymentCycles({ currentEmployee: currentBefore, history: historyBefore });
        afterCycles = buildEmploymentCycles({ currentEmployee: currentAfter, history: historyAfter });
    } catch (error) {
        return fail(error.code || 'EMPLOYMENT_CYCLE_INVALID');
    }
    if (beforeCycles.length !== afterCycles.length ||
        beforeCycles.some((cycle, index) => cycle.hire_date !== afterCycles[index].hire_date) ||
        afterCycles.at(-1)?.departure_date !== plan.diagnostics.departureDate) {
        return fail('EMPLOYMENT_CYCLE_CHANGED');
    }
    const finalCanonical = canonicalizer({ scope: {
        team: currentBefore.team, company_kod: currentBefore.company_kod,
        kodikos: currentBefore.kodikos
    }, currentEmployee: currentAfter, historyRows: historyAfter });
    const finalIds = [...new Set(finalCanonical.diagnostics?.historyIds || [])].map(String).sort();
    if (finalCanonical.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY ||
        finalCanonical.diagnostics?.reason !== plan.diagnostics.canonicalReasonBefore ||
        !same(finalIds, plan.unresolvedHistoryIds)) {
        return fail('HISTORICAL_AMBIGUITY_CHANGED');
    }
    return { ok: true, reason: 'DEPARTURE_COHERENT_HISTORICAL_AMBIGUITY_PRESERVED',
        canonicalStatusAfter: finalCanonical.status,
        canonicalReasonAfter: finalCanonical.diagnostics.reason,
        unresolvedHistoryIds: finalIds };
}

module.exports = { OPERATION, ELIGIBLE_REASON, PLAN_STATUSES,
    planEmployeeDepartureWithDeferredHistoryAmbiguity,
    verifyDepartureWithDeferredHistoryAmbiguity };
