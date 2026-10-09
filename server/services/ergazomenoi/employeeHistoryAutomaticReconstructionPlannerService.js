'use strict';

const { createHash } = require('node:crypto');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { calendarDate, normalizeEmploymentProfileSubmission } = require('../../utils/ergazomenoi/employmentProfileContract');

const MAX_HISTORY_ROWS = 1000;
const SOURCES = Object.freeze({
    EXISTING: 'EXISTING', HIRE: 'DETERMINISTIC_HIRE_BOUNDARY',
    CONTRACT_CHANGE: 'DETERMINISTIC_CONTRACT_CHANGE_BOUNDARY',
    NEXT_BOUNDARY: 'DETERMINISTIC_NEXT_PERIOD_BOUNDARY', CONTINUATION: 'DETERMINISTIC_CONTINUATION_BOUNDARY',
    PREVIOUS: 'PREVIOUS_PERIOD', NEXT: 'NEXT_PERIOD', CURRENT: 'CURRENT_EMPLOYEE',
    DEFAULT: 'DEFAULT_VALUE', ASSUMPTION: 'APPLICATION_ASSUMPTION',
    FINAL_END: 'AUTHORITATIVE_FINAL_BOUNDARY'
});

function day(value) {
    try { return calendarDate(value)?.toISOString().slice(0, 10) || null; } catch { return null; }
}
function addDays(value, count) {
    const date = calendarDate(value);
    date.setUTCDate(date.getUTCDate() + count);
    return date.toISOString().slice(0, 10);
}
function clone(value) {
    if (value instanceof Date) return new Date(value.getTime());
    // Preserve native BSON identity, including survivor references. Do not
    // spread or JSON-clone ObjectId internals (PR #302/#303 regression).
    if (value?._bsontype === 'ObjectId' && typeof value.toHexString === 'function') {
        return new value.constructor(value.toHexString());
    }
    if (Buffer.isBuffer(value)) return Buffer.from(value);
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]));
}
function stable(value) {
    if (value === undefined) return { $missing: true };
    if (value instanceof Date) return { $date: Number.isNaN(value.getTime()) ? 'INVALID' : value.toISOString() };
    if (typeof value?.toHexString === 'function') return { $oid: value.toHexString() };
    if (typeof value === 'number' && !Number.isFinite(value)) return { $number: String(value) };
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
const stringify = value => JSON.stringify(stable(value));
const equal = (left, right) => stringify(left) === stringify(right);
const id = row => typeof row?._id?.toHexString === 'function' ? row._id.toHexString() : String(row?._id ?? '');
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const nonEmpty = value => value !== null && value !== undefined && value !== '';

function usable(field, value) {
    switch (C.PROFILE_FIELD_TYPES[field]) {
    case 'Number': return typeof value === 'number' && Number.isFinite(value) && value >= 0 &&
        (!C.CRITICAL_NUMBERS.includes(field) || value > 0);
    case 'Boolean': return typeof value === 'boolean';
    case 'String': return typeof value === 'string' && value.trim() !== '';
    case 'Array': return Array.isArray(value) && value.every(item => Number.isInteger(item) && item >= 1 && item <= 7);
    case 'Date': return day(value) !== null;
    default: return false;
    }
}
function defaultValue(field) {
    return ({ Number: 0, Boolean: false, String: '', Array: [], Date: null })[C.PROFILE_FIELD_TYPES[field]];
}
function compatible(left, right) {
    return C.COMPATIBILITY_FIELDS.every(field =>
        !usable(field, left[field]) || !usable(field, right[field]) || equal(left[field], right[field]));
}

function validIdentity(value) {
    return (typeof value === 'string' && value.trim() !== '') ||
        (value?._bsontype === 'ObjectId' && typeof value.toHexString === 'function' &&
            /^[a-f0-9]{24}$/i.test(value.toHexString()));
}

// This is an input-state token for future stale protection, not a hash of the
// filled result: accepting a proposal should change the token. Informational
// dates, audit numbering, timestamps, Mongoose version and fences never enter it.
function semanticFingerprint({ scope, currentEmployee, completeHistoryRows }) {
    const fields = [...C.SCOPE_FIELDS, '_id', ...C.FIELD_GROUPS.TEMPORAL_SEMANTIC,
        ...C.PROFILE_FIELDS, ...C.FIELD_GROUPS.CANONICAL_METADATA];
    const project = record => Object.fromEntries(fields.filter(field => Object.hasOwn(record || {}, field))
        .map(field => [field, record[field]]));
    return createHash('sha256').update(stringify({ version: C.VERSION,
        scope: Object.fromEntries(C.SCOPE_FIELDS.map(field => [field, scope?.[field]])),
        employee: project(currentEmployee),
        history: completeHistoryRows.map(project).map(stringify).sort()
    })).digest('hex');
}

// Plans are internal evidence, never commands to apply. PLANNED/NO_OP means no
// unresolved assumption, REVIEW_REQUIRED exposes assumptions/invalid evidence,
// BLOCKED returns unchanged physical rows where a temporal state cannot be
// established. No insert/delete/retirement/current-Employee patch is emitted.
function planEmployeeHistoryAutomaticReconstruction({ scope, currentEmployee = {}, completeHistoryRows = [] } = {}) {
    const plan = { version: C.VERSION, status: 'PLANNED', semanticFingerprint: null,
        logicalPeriods: [], proposedRows: [], rowDiffs: [], assumptions: [], warnings: [],
        diagnostics: { physicalRowCount: Array.isArray(completeHistoryRows) ? completeHistoryRows.length : 0,
            logicalPeriodCount: 0, proposedFieldChangeCount: 0, provenanceCounts: {}, redundantArtifactCount: 0 } };
    const warning = (code, field) => {
        if (!plan.warnings.some(item => item.code === code && item.field === field)) {
            plan.warnings.push({ code, ...(field ? { field } : {}) });
        }
    };
    const assumption = (code, extra = {}) => {
        plan.assumptions.push({ code, sourceType: SOURCES.ASSUMPTION, ...extra });
    };
    const blocked = code => {
        plan.status = 'BLOCKED';
        warning(code);
        plan.logicalPeriods = [];
        plan.rowDiffs = [];
        plan.proposedRows = Array.isArray(completeHistoryRows) ? clone(completeHistoryRows) : [];
        return plan;
    };
    if (!Array.isArray(completeHistoryRows) || !currentEmployee || typeof currentEmployee !== 'object' ||
        completeHistoryRows.some(row => !row || typeof row !== 'object') ||
        !C.SCOPE_FIELDS.every(field => typeof scope?.[field] === 'string' && scope[field].trim() &&
            currentEmployee[field] === scope[field] && completeHistoryRows.every(row => row[field] === scope[field])) ||
        completeHistoryRows.some(row => !validIdentity(row._id)) ||
        new Set(completeHistoryRows.map(id)).size !== completeHistoryRows.length) {
        return blocked('INVALID_OR_CONFLICTING_INPUT');
    }
    if (completeHistoryRows.length > MAX_HISTORY_ROWS) return blocked('HISTORY_SIZE_LIMIT_EXCEEDED');
    plan.semanticFingerprint = semanticFingerprint({ scope, currentEmployee, completeHistoryRows });
    const rows = [...completeHistoryRows].sort((a, b) => compare(id(a), id(b)));
    plan.proposedRows = clone(rows);
    if (!rows.length) { plan.status = 'NO_HISTORY'; return plan; }
    const proposedById = new Map(plan.proposedRows.map(row => [id(row), row]));
    if (rows.some(row => nonEmpty(row.employment_history_canonical_status) &&
        row.employment_history_canonical_status !== 'REDUNDANT_REFERENCED')) {
        return blocked('UNKNOWN_CANONICAL_STATUS');
    }
    const active = rows.filter(row => row.employment_history_canonical_status !== 'REDUNDANT_REFERENCED');
    plan.diagnostics.redundantArtifactCount = rows.length - active.length;
    if (!active.length) { plan.status = 'NO_ACTIVE_HISTORY'; return plan; }
    // Redundant referenced artifacts are preserved in full, but cannot donate
    // lifecycle/profile evidence or create events, even with unusual dates.
    for (const record of [currentEmployee, ...active]) {
        for (const field of C.FIELD_GROUPS.TEMPORAL_SEMANTIC.filter(field => field !== 'afora_proslhpsh')) {
            if (nonEmpty(record[field]) && !day(record[field])) warning('INVALID_TEMPORAL_DATE', field);
        }
    }
    const currentHire = day(currentEmployee[C.HIRE]);
    const hires = [...new Set(active.map(row => day(row[C.HIRE])).filter(Boolean))].sort();
    if (!hires.length && currentHire) hires.push(currentHire);
    if (!hires.length) return blocked('NO_HIRE_EVIDENCE');
    const cycles = hires.map((hire, index) => ({ hire, nextHire: hires[index + 1] || null, rows: [], groups: [] }));
    for (const row of active) {
        const hire = day(row[C.HIRE]);
        const anchor = day(row[C.START]) || day(row[C.CHANGE]);
        const candidates = hire ? cycles.filter(cycle => cycle.hire === hire)
            : anchor ? cycles.filter(cycle => anchor >= cycle.hire && (!cycle.nextHire || anchor < cycle.nextHire))
                : cycles.length === 1 ? cycles : [];
        if (candidates.length !== 1) return blocked('UNRESOLVED_EMPLOYMENT_CYCLE');
        candidates[0].rows.push(row);
    }

    const changeField = (row, field, value, provenance) => {
        // Date-only inputs are semantically equivalent to midnight BSON dates.
        if (equal(row[field], value) || (value instanceof Date && day(row[field]) === day(value))) return;
        proposedById.get(id(row))[field] = clone(value);
        plan.rowDiffs.push({ historyId: clone(row._id), field,
            before: row[field] === undefined ? null : clone(row[field]),
            beforeMissing: row[field] === undefined, after: clone(value), ...clone(provenance) });
    };
    const evidence = (sourceType, sourceHistoryId = null, sourceField = null, confidence = 'INFERRED') =>
        ({ sourceType, sourceHistoryId: clone(sourceHistoryId), sourceField, confidence });

    for (const cycle of cycles) {
        const hireSource = cycle.rows.find(row => day(row[C.HIRE]) === cycle.hire);
        const byStart = new Map();
        const unanchored = [];
        const add = (row, from, provenance) => {
            if (!byStart.has(from)) byStart.set(from, { from, rows: [], startSources: new Map(), cycle });
            const group = byStart.get(from);
            group.rows.push(row);
            group.startSources.set(id(row), provenance);
        };
        for (const row of cycle.rows) {
            const start = day(row[C.START]);
            const change = day(row[C.CHANGE]);
            if (start && start >= cycle.hire && (!cycle.nextHire || start < cycle.nextHire)) {
                add(row, start, evidence(SOURCES.EXISTING, row._id, C.START, 'EXISTING'));
                if (row.afora_proslhpsh === true && start > cycle.hire && (!change || change === cycle.hire)) {
                    assumption('EXISTING_INITIAL_START_AFTER_HIRE', { sourceHistoryIds: [clone(row._id)] });
                }
            } else if (change && change >= cycle.hire && (!cycle.nextHire || change < cycle.nextHire)) {
                add(row, change, evidence(change === cycle.hire ? SOURCES.HIRE : SOURCES.CONTRACT_CHANGE,
                    row._id, C.CHANGE, 'DETERMINISTIC'));
            } else if (row.afora_proslhpsh === true || (day(row[C.HIRE]) && !start && !change)) {
                add(row, cycle.hire, { ...evidence(SOURCES.HIRE,
                    day(row[C.HIRE]) ? row._id : hireSource?._id, C.HIRE, 'DETERMINISTIC'),
                originSourceType: hireSource ? SOURCES.EXISTING : SOURCES.CURRENT });
            } else unanchored.push(row);
            if (start && (start < cycle.hire || (cycle.nextHire && start >= cycle.nextHire))) {
                assumption('INCONSISTENT_EXISTING_START', { sourceHistoryIds: [clone(row._id)] });
            }
        }
        // A missing start can be proved by surrounding explicit end/start facts.
        // No row number, input position, creation time or schedule date is used.
        unanchored.sort((a, b) => compare(day(a[C.END]) || '', day(b[C.END]) || '') || compare(id(a), id(b)));
        for (const row of unanchored) {
            const end = day(row[C.END]);
            const groups = [...byStart.values()].sort((a, b) => compare(a.from, b.from));
            const boundaries = groups.flatMap((group, index) => {
                const next = groups[index + 1];
                return group.rows.filter(previous => day(previous[C.END]))
                    .map(previous => ({ from: addDays(day(previous[C.END]), 1),
                        sourceId: previous._id, nextId: next?.rows[0]._id }))
                    .filter(({ from }) => end && from > group.from && from <= end &&
                        (!next || (from < next.from && addDays(end, 1) === next.from)));
            });
            const unique = [...new Set(boundaries.map(item => item.from))];
            if (unique.length === 1 && !byStart.has(unique[0])) {
                const boundary = boundaries.find(item => item.from === unique[0]);
                add(row, unique[0], { ...evidence(SOURCES.CONTINUATION, boundary.sourceId, C.END, 'DETERMINISTIC'),
                    sourceHistoryIds: [boundary.sourceId, boundary.nextId].filter(value => value != null).map(clone) });
                continue;
            }
            const compatibleGroups = groups.filter(group => group.rows.every(other => compatible(row, other)));
            if (compatibleGroups.length !== 1) return blocked('UNRESOLVED_PERIOD_START');
            add(row, compatibleGroups[0].from, evidence(SOURCES.ASSUMPTION,
                compatibleGroups[0].rows[0]._id, C.START, 'ASSUMED'));
            assumption('UNDATED_ROW_ATTACHED_TO_UNIQUE_COMPATIBLE_PERIOD', { sourceHistoryIds: [clone(row._id)] });
        }
        cycle.groups = [...byStart.values()].sort((a, b) => compare(a.from, b.from));
        for (const group of cycle.groups) {
            group.rows.sort((a, b) => compare(id(a), id(b)));
            group.raw = {};
            group.donors = {};
            group.conflictingFields = new Set();
            for (const field of C.PROFILE_FIELDS) {
                const donors = group.rows.filter(row => usable(field, row[field]));
                if (!donors.length) continue;
                group.raw[field] = donors[0][field];
                group.donors[field] = donors[0];
                if (donors.some(row => !equal(row[field], donors[0][field]))) {
                    group.conflictingFields.add(field);
                    assumption('SAME_DATE_NON_EMPTY_CONFLICT', { field,
                        sourceHistoryIds: donors.map(row => clone(row._id)),
                        selectedSourceHistoryId: clone(donors[0]._id), resolution: 'PRESERVE_PHYSICAL_VALUES' });
                }
            }
        }

        // Resolve evidence to a fixed point before applying defaults. Each newly
        // inferred discriminator participates in subsequent compatibility checks.
        // This prevents mixing (for example) 35-hour and 40-hour work profiles,
        // and prevents a second invocation discovering new transitive donors.
        const currentStart = day(currentEmployee[C.START]) || day(currentEmployee[C.CHANGE]);
        for (const group of cycle.groups) {
            group.resolved = { ...group.raw };
            group.resolvedProvenance = {};
            for (const field of Object.keys(group.raw)) {
                group.resolvedProvenance[field] = evidence(group.conflictingFields.has(field)
                    ? SOURCES.ASSUMPTION : SOURCES.EXISTING, group.donors[field]._id, field,
                group.conflictingFields.has(field) ? 'ASSUMED' : 'EXISTING');
            }
        }
        // Copy each compatible donor's available facts together. Selecting
        // individual fields from multiple still-sparse donors can otherwise mix
        // a 35-hour state with days/averages belonging to a 40-hour state.
        const inherit = (target, donor, direction) => {
            let filled = false;
            for (const field of C.PROFILE_FIELDS) {
                if (usable(field, target.resolved[field]) || !usable(field, donor.resolved[field])) continue;
                const source = donor.resolvedProvenance[field];
                const sourceId = donor.donors[field]?._id || donor.rows[0]._id;
                target.resolved[field] = clone(donor.resolved[field]);
                target.resolvedProvenance[field] = {
                    ...evidence(direction < 0 ? SOURCES.PREVIOUS : SOURCES.NEXT, sourceId, field,
                        source.confidence === 'ASSUMED' ? 'ASSUMED' : 'INFERRED'),
                    originSourceType: source.originSourceType || source.sourceType,
                    sourceLineage: [clone(sourceId), ...(source.sourceLineage || [])]
                };
                filled = true;
            }
            return filled;
        };
        // Exhaust historical inheritance before admitting current Employee data.
        // Otherwise an early current fallback can mask a later historical donor.
        for (const allowCurrent of [false, true]) {
            let filled;
            do {
                filled = false;
                for (let index = 0; index < cycle.groups.length; index += 1) {
                    const group = cycle.groups[index];
                    for (const direction of [-1, 1]) {
                        for (let otherIndex = index + direction; otherIndex >= 0 && otherIndex < cycle.groups.length; otherIndex += direction) {
                            const other = cycle.groups[otherIndex];
                            if (!compatible(group.resolved, other.resolved) || other.conflictingFields.size) break;
                            filled = inherit(group, other, direction) || filled;
                        }
                    }
                    const currentApplicable = allowCurrent && currentHire === cycle.hire &&
                        (!currentStart || currentStart <= group.from) && compatible(group.resolved, currentEmployee);
                    if (!currentApplicable) continue;
                    for (const field of C.PROFILE_FIELDS) {
                        if (usable(field, group.resolved[field]) || !usable(field, currentEmployee[field])) continue;
                        group.resolved[field] = clone(currentEmployee[field]);
                        group.resolvedProvenance[field] = evidence(SOURCES.CURRENT, null, field, 'ASSUMED');
                        filled = true;
                    }
                }
            } while (filled);
        }
        for (let index = 0; index < cycle.groups.length; index += 1) {
            const group = cycle.groups[index];
            const next = cycle.groups[index + 1];
            let finalEvidence = null;
            if (next) {
                group.to = addDays(next.from, -1);
                finalEvidence = evidence(SOURCES.NEXT_BOUNDARY, next.rows[0]._id, C.START, 'DETERMINISTIC');
            } else {
                // Current-cycle final facts cannot terminate a different hire.
                // Departure caps employment; otherwise the latest state carrying
                // contract-end evidence wins. Conflicting dates are explicit.
                const candidates = [];
                for (const source of cycle.rows) for (const field of [C.DEPARTURE, C.CONTRACT_END]) {
                    const value = day(source[field]);
                    if (value && value >= group.from && (!cycle.nextHire || value < cycle.nextHire)) {
                        const sourceGroup = cycle.groups.find(item => item.rows.includes(source));
                        candidates.push({ value, field, source, rank: sourceGroup.from });
                    } else if (value) warning('INCONSISTENT_TERMINATING_EVENT', field);
                }
                if (currentHire === cycle.hire) for (const field of [C.DEPARTURE, C.CONTRACT_END]) {
                    const value = day(currentEmployee[field]);
                    if (value && value >= group.from && (!cycle.nextHire || value < cycle.nextHire)) {
                        // Current is a fallback only when History lacks that fact.
                        if (!candidates.some(item => item.field === field)) {
                            candidates.push({ value, field, source: null, rank: group.from });
                        } else if (candidates.some(item => item.field === field && item.value !== value)) {
                            assumption('CURRENT_TERMINATION_DIFFERS_FROM_HISTORY', { field });
                        }
                    } else if (value) warning('INCONSISTENT_TERMINATING_EVENT', field);
                }
                const departureCandidates = candidates.filter(item => item.field === C.DEPARTURE);
                if (cycle.rows.some(source => day(source[C.DEPARTURE]) &&
                    day(source[C.DEPARTURE]) < group.from) ||
                    (!cycle.rows.some(source => day(source[C.DEPARTURE])) &&
                        currentHire === cycle.hire && day(currentEmployee[C.DEPARTURE]) &&
                        day(currentEmployee[C.DEPARTURE]) < group.from)) {
                    return blocked('PROFILE_EVENT_AFTER_DEPARTURE');
                }
                const preferred = departureCandidates.length ? departureCandidates : candidates;
                preferred.sort((a, b) => compare(b.rank, a.rank) || compare(a.value, b.value) ||
                    compare(id(a.source), id(b.source)));
                const chosen = preferred[0];
                if (new Set(candidates.map(item => item.value)).size > 1) {
                    assumption('COMPETING_FINAL_BOUNDARIES', { selectedSourceHistoryId: clone(chosen?.source?._id ?? null),
                        selectedSourceField: chosen?.field, resolution: 'DEPARTURE_THEN_LATEST_HISTORICAL_STATE' });
                }
                group.to = chosen?.value || null;
                finalEvidence = chosen ? { ...evidence(SOURCES.FINAL_END, chosen.source?._id, chosen.field, 'DETERMINISTIC'),
                    originSourceType: chosen.source ? SOURCES.EXISTING : SOURCES.CURRENT }
                    : evidence(SOURCES.DEFAULT, null, null, 'DEFAULT');
                if (cycle.nextHire && !chosen) return blocked('UNRESOLVED_CYCLE_TERMINATION');
            }
            group.profile = {};
            group.fieldProvenance = {};
            for (const field of C.PROFILE_FIELDS) {
                const selected = usable(field, group.resolved[field]) ? {
                    value: group.resolved[field], provenance: group.resolvedProvenance[field]
                } : { value: defaultValue(field), provenance: evidence(SOURCES.DEFAULT, null, field, 'DEFAULT') };
                if (selected.provenance.sourceType === SOURCES.CURRENT) {
                    assumption('CURRENT_EMPLOYEE_PROFILE_FALLBACK', { field, periodFrom: group.from });
                }
                group.profile[field] = clone(selected.value);
                group.fieldProvenance[field] = clone(selected.provenance);
                for (const row of group.rows) {
                    if (usable(field, row[field])) continue;
                    if (nonEmpty(row[field]) && !equal(row[field], selected.value)) {
                        assumption(C.CRITICAL_NUMBERS.includes(field) && row[field] === 0
                            ? 'LEGACY_ZERO_PLACEHOLDER_REPLACED' : 'UNUSABLE_PROFILE_VALUE_REPLACED',
                        { field, sourceHistoryIds: [clone(row._id)] });
                    }
                    changeField(row, field, selected.value, selected.provenance);
                }
            }
            for (const row of group.rows) {
                changeField(row, C.START, calendarDate(group.from), group.startSources.get(id(row)));
                const oldEnd = day(row[C.END]);
                if (oldEnd && oldEnd !== group.to) assumption('EXISTING_PERIOD_END_REBUILT', {
                    field: C.END, sourceHistoryIds: [clone(row._id)] });
                changeField(row, C.END, group.to ? calendarDate(group.to) : null, finalEvidence);
                if (!day(row[C.HIRE])) changeField(row, C.HIRE, calendarDate(cycle.hire),
                    evidence(hireSource ? SOURCES.HIRE : SOURCES.CURRENT,
                        hireSource?._id, C.HIRE, 'DETERMINISTIC'));
            }
            const [days, hours, average] = C.CRITICAL_NUMBERS.map(field => group.profile[field]);
            if ((days > 0 && (!Number.isInteger(days) || days > 7)) ||
                (days > 0 && hours > 0 && average > 0 && Math.abs(days * average - hours) > 0.01)) {
                warning('INCONSISTENT_RECONSTRUCTED_WORK_TERMS');
            }
            // Validate coupled break/arrangement facts without applying the
            // normalizer's values/version stamps or touching any schema/model.
            try { normalizeEmploymentProfileSubmission(group.profile); } catch (error) {
                warning('INCONSISTENT_RECONSTRUCTED_PROFILE',
                    Object.hasOwn(C.FIELD_CLASSIFICATION, error.field) ? error.field : undefined);
            }
            plan.logicalPeriods.push({ from: group.from, to: group.to, hireDate: cycle.hire,
                sourceHistoryIds: group.rows.map(row => clone(row._id)),
                profile: group.profile, fieldProvenance: group.fieldProvenance,
                startProvenance: group.rows.map(row => ({ historyId: clone(row._id), ...group.startSources.get(id(row)) })),
                endProvenance: finalEvidence, conflictingFields: [...group.conflictingFields].sort() });
        }
    }
    // Different non-empty historical values remain intact, including changes at
    // distinct dates. Expose them for later review rather than overwriting them.
    for (const cycle of cycles) for (let index = 1; index < cycle.groups.length; index += 1) {
        const previous = cycle.groups[index - 1];
        const group = cycle.groups[index];
        for (const field of C.PROFILE_FIELDS) if (usable(field, previous.raw[field]) && usable(field, group.raw[field]) &&
            !equal(previous.raw[field], group.raw[field])) {
            assumption('HISTORICAL_NON_EMPTY_VALUE_CHANGE', { field, periodFrom: group.from,
                resolution: 'PRESERVE_EACH_PERIOD_VALUE' });
        }
    }
    plan.rowDiffs.sort((a, b) => compare(id({ _id: a.historyId }), id({ _id: b.historyId })) || compare(a.field, b.field));
    plan.warnings.sort((a, b) => compare(stringify(a), stringify(b)));
    plan.assumptions.sort((a, b) => compare(stringify(a), stringify(b)));
    plan.diagnostics.logicalPeriodCount = plan.logicalPeriods.length;
    plan.diagnostics.proposedFieldChangeCount = plan.rowDiffs.length;
    for (const diff of plan.rowDiffs) {
        plan.diagnostics.provenanceCounts[diff.sourceType] = (plan.diagnostics.provenanceCounts[diff.sourceType] || 0) + 1;
    }
    plan.status = plan.assumptions.length || plan.warnings.length ? 'REVIEW_REQUIRED'
        : plan.rowDiffs.length ? 'PLANNED' : 'NO_OP';
    return plan;
}

// Explicit allowlist: safe to print this summary even when the input contains
// names, identifiers, salaries or arbitrary user-provided strings. Never log the
// full plan, proposedRows, rowDiffs or assumptions.
function summarizeEmployeeHistoryAutomaticReconstruction(plan) {
    return { version: C.VERSION, status: plan.status, semanticFingerprint: plan.semanticFingerprint,
        physicalRowCount: plan.diagnostics.physicalRowCount,
        logicalPeriodCount: plan.diagnostics.logicalPeriodCount,
        proposedFieldChangeCount: plan.diagnostics.proposedFieldChangeCount,
        provenanceCounts: { ...plan.diagnostics.provenanceCounts }, assumptionsCount: plan.assumptions.length,
        warnings: plan.warnings.map(({ code, field }) => ({ code, ...(field ? { field } : {}) })) };
}

module.exports = { MAX_HISTORY_ROWS, SOURCES, planEmployeeHistoryAutomaticReconstruction,
    summarizeEmployeeHistoryAutomaticReconstruction };
