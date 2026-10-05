'use strict';

const C = require('../../utils/ergazomenoi/employmentProfileContract');
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const { BASE_HISTORY_FIELDS, effectiveStart, effectiveEnd } =
    require('../../utils/ergazomenoi/employmentProfileHistory');
const { REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD, REDUNDANT_REFERENCED,
    isPersistedReferencedRedundant } =
    require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { EMPLOYMENT_TYPE_SEMANTIC_STATUSES, LEGACY_ALIAS_STATUSES,
    resolveEmploymentTypeSemantics } =
    require('../../utils/ergazomenoi/employmentTypeSemantics');

const CANONICAL_STATUSES = Object.freeze({
    CLEAN: 'CLEAN',
    AUTO_REPAIRABLE: 'AUTO_REPAIRABLE',
    TRUE_AMBIGUITY: 'TRUE_AMBIGUITY'
});
const ROW_DISPOSITIONS = Object.freeze({
    KEEP: 'KEEP',
    UPDATE: 'UPDATE',
    REDUNDANT: 'REDUNDANT',
    TRUE_AMBIGUITY: 'TRUE_AMBIGUITY'
});
const EVENT_TYPES = Object.freeze({
    HIRE: 'HIRE',
    PROFILE_CHANGE: 'PROFILE_CHANGE',
    DEPARTURE: 'DEPARTURE',
    PROFILE_CHANGE_DEPARTURE: 'PROFILE_CHANGE_DEPARTURE',
    LEGACY_TECHNICAL: 'LEGACY_TECHNICAL'
});
const DEFAULT_MAX_HISTORY_ROWS = 1000;
const SCOPE_FIELDS = Object.freeze(['team', 'company_kod', 'kodikos']);
const DATE_FIELDS = Object.freeze([
    'hmeromhnia_proslhpshs',
    'hmeromhnia_allaghs_symbashs',
    'hmeromhnia_allaghs_orarioy_apo',
    'hmeromhnia_allaghs_orarioy_eos',
    'hmeromhnia_isxyos_oron_ergasias_apo',
    'hmeromhnia_isxyos_oron_ergasias_eos',
    'hmeromhnia_isxyos_dialleimatos_apo',
    'hmeromhnia_lhxhs_symbashs',
    'hmeromhnia_apoxorhshs'
]);
const PERIOD_IDENTITY_FIELDS = Object.freeze([
    'hmeromhnia_proslhpshs',
    'hmeromhnia_isxyos_oron_ergasias_apo',
    'hmeromhnia_isxyos_oron_ergasias_eos'
]);
const PERIOD_STATE_FIELDS = Object.freeze([...new Set([
    ...BASE_HISTORY_FIELDS.filter(field => !DATE_FIELDS.includes(field)),
    // Contract end is mutable profile state. It is deliberately not part of
    // semantic period identity or profile-event equivalence.
    'hmeromhnia_lhxhs_symbashs',
    ...C.FACT_FIELDS,
    ...T.STANDARD_FIELDS,
    'eidikh_kathgoria_ergazomenoy',
    'kathestos_apasxolhshs',
    'typos_apasxolhshs',
    'typos_ebdomadas',
    'apasxolhsh_basei_symbashs',
    'pososto_prosayxhshs_6hs_hmeras',
    'hmeres_ergasias_ebdomadas',
    'ores_ergasias_ebdomadas',
    'mo_oron_hmerhsias_ergasias'
])]);
const EMPLOYMENT_TYPE_ALIAS_FIELDS = Object.freeze([
    'kathestos_apasxolhshs',
    'typos_apasxolhshs'
]);
const PROFILE_EQUIVALENCE_FIELDS = Object.freeze(PERIOD_STATE_FIELDS.filter(field =>
    field !== 'hmeromhnia_lhxhs_symbashs' && !EMPLOYMENT_TYPE_ALIAS_FIELDS.includes(field)));
const CURRENT_SYNC_FIELDS = Object.freeze([...new Set([
    ...BASE_HISTORY_FIELDS,
    ...C.FACT_FIELDS,
    ...T.STANDARD_FIELDS,
    ...DATE_FIELDS.filter(field => field !== 'hmeromhnia_isxyos_dialleimatos_apo'),
    'eidikh_kathgoria_ergazomenoy',
    'kathestos_apasxolhshs',
    'typos_apasxolhshs',
    'typos_ebdomadas',
    'apasxolhsh_basei_symbashs',
    'pososto_prosayxhshs_6hs_hmeras',
    'hmeres_ergasias_ebdomadas',
    'ores_ergasias_ebdomadas',
    'mo_oron_hmerhsias_ergasias'
])]);

function day(value) {
    return C.calendarDate(value)?.toISOString().slice(0, 10) || '';
}

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

function equal(left, right) {
    return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

function meaningful(value) {
    return value !== undefined && value !== null && value !== '' &&
        (typeof value !== 'number' || Number.isFinite(value));
}

function orderTuple(row = {}) {
    const sequence = Number(row.aa_eggrafhs);
    const createdAt = row.createdAt ? new Date(row.createdAt).getTime() : 0;
    return [Number.isSafeInteger(sequence) ? sequence : -1,
        Number.isFinite(createdAt) ? createdAt : 0, String(row._id ?? '')];
}

function compareTuple(left, right) {
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        if (left[index] < right[index]) return -1;
        if (left[index] > right[index]) return 1;
    }
    return 0;
}

function latestRow(rows = []) {
    return [...rows].sort((left, right) => compareTuple(orderTuple(left), orderTuple(right))).at(-1) || null;
}

function isSparseHireLifecycleEvidence(row = {}) {
    return row.afora_proslhpsh === true &&
        !meaningful(row.hmeromhnia_isxyos_oron_ergasias_apo) &&
        row.afora_allagh_oron_ergasias !== true && !C.readEmploymentProfile(row).recorded;
}

function changedPatch(stored = {}, proposed = {}, fields = Object.keys(proposed)) {
    return Object.fromEntries(fields.filter(field => Object.hasOwn(proposed, field) &&
        proposed[field] !== undefined && !equal(stored[field], proposed[field]))
        .map(field => [field, proposed[field]]));
}

function calculateCanonicalDiff(persistedRows = [], canonicalRows = []) {
    const persistedById = new Map(persistedRows.map(row => [String(row._id), row]));
    const canonicalById = new Map(canonicalRows.filter(row => row._id != null)
        .map(row => [String(row._id), row]));
    const rowsToUpdate = [];
    for (const [historyId, canonical] of canonicalById) {
        const persisted = persistedById.get(historyId);
        if (!persisted) continue;
        const fields = Object.keys(canonical).filter(field =>
            !['_id', '__v', 'createdAt', 'updatedAt'].includes(field));
        const patch = changedPatch(persisted, canonical, fields);
        if (Object.keys(patch).length) rowsToUpdate.push({ historyId, patch });
    }
    return {
        rowsToUpdate,
        rowsToDelete: persistedRows.filter(row => !canonicalById.has(String(row._id)))
            .map(row => ({ historyId: String(row._id) })),
        rowsToInsert: canonicalRows.filter(row => row._id == null)
    };
}

function ambiguity(reason, historyIds = [], diagnostics = {}) {
    const classifications = historyIds.map(historyId => ({ historyId: String(historyId),
        disposition: ROW_DISPOSITIONS.TRUE_AMBIGUITY, eventTypes: [] }));
    return {
        status: CANONICAL_STATUSES.TRUE_AMBIGUITY,
        canonicalRows: [], semanticRows: [], rowsToUpdate: [], rowsToDelete: [], rowsToInsert: [],
        classifications, events: [], employeePatch: {}, cleanupRequired: false, idempotent: false,
        conflicts: [{ reason }], diagnostics: { reason, historyIds: historyIds.map(String), ...diagnostics },
        replacementByDeletedId: {}
    };
}

function substantiveFingerprint(row = {}) {
    return JSON.stringify([
        ...PROFILE_EQUIVALENCE_FIELDS.map(field => comparable(row[field])),
        resolveEmploymentTypeSemantics(row).comparisonKey
    ]);
}

function matchesCurrent(row, currentEmployee) {
    if (!currentEmployee || day(row.hmeromhnia_proslhpshs) !== day(currentEmployee.hmeromhnia_proslhpshs) ||
        (effectiveStart(row)?.getTime() ?? null) !== (effectiveStart(currentEmployee)?.getTime() ?? null)) return false;
    const comparableFields = PROFILE_EQUIVALENCE_FIELDS.filter(field => meaningful(row[field]) &&
        meaningful(currentEmployee[field]));
    if (!comparableFields.every(field => equal(row[field], currentEmployee[field]))) return false;
    const rowEmploymentType = resolveEmploymentTypeSemantics(row);
    const currentEmploymentType = resolveEmploymentTypeSemantics(currentEmployee);
    const employmentTypeComparable = rowEmploymentType.hasEvidence && currentEmploymentType.hasEvidence;
    if (employmentTypeComparable &&
        rowEmploymentType.comparisonKey !== currentEmploymentType.comparisonKey) return false;
    return comparableFields.length > 0 || employmentTypeComparable;
}

function hasOnlyCompatibleSparseDifferences(rows = []) {
    return PROFILE_EQUIVALENCE_FIELDS.every(field => {
        const values = new Set(rows.filter(row => meaningful(row[field]))
            .map(row => JSON.stringify(comparable(row[field]))));
        return values.size <= 1;
    });
}

function chooseLegacyEmploymentTypeAliasSurvivor(rows = [], currentEmployee) {
    if (rows.length < 2 || !hasOnlyCompatibleSparseDifferences(rows)) return null;
    const analyzed = rows.map(row => ({ row, semantics: resolveEmploymentTypeSemantics(row) }));
    if (analyzed.some(item => item.semantics.status !== EMPLOYMENT_TYPE_SEMANTIC_STATUSES.RESOLVED)) {
        return null;
    }
    if (new Set(analyzed.map(item => item.semantics.effectiveValue)).size !== 1) return null;
    if (!analyzed.some(item =>
        item.semantics.legacyAliasStatus === LEGACY_ALIAS_STATUSES.INVALID_IGNORED)) return null;
    const validAliasRows = analyzed.filter(item =>
        item.semantics.legacyAliasStatus === LEGACY_ALIAS_STATUSES.CONSISTENT);
    if (!validAliasRows.length) return null;

    const exactCurrent = validAliasRows.filter(item => matchesCurrent(item.row, currentEmployee));
    const foundations = validAliasRows.filter(item =>
        item.row.employment_profile_source === 'EMPLOYEE_PROFILE_FOUNDATION');
    const preferred = exactCurrent.length ? exactCurrent
        : foundations.length ? foundations : validAliasRows;
    return latestRow(preferred.map(item => item.row));
}

function chooseProfileSurvivor(rows, currentEmployee, currentCycle) {
    if (rows.length === 1) return { survivor: rows[0], ambiguous: false };
    const aliasSurvivor = chooseLegacyEmploymentTypeAliasSurvivor(rows, currentEmployee);
    if (aliasSurvivor) return { survivor: aliasSurvivor, ambiguous: false,
        normalizationReason: 'INVALID_LEGACY_EMPLOYMENT_TYPE_ALIAS' };
    const fullRows = rows.filter(row => C.readEmploymentProfile(row).recorded);
    const exactCurrent = currentCycle ? rows.filter(row => matchesCurrent(row, currentEmployee)) : [];
    if (exactCurrent.length === 1) return { survivor: exactCurrent[0], ambiguous: false };
    const foundations = rows.filter(row => row.employment_profile_source === 'EMPLOYEE_PROFILE_FOUNDATION');
    if (foundations.length === 1) return { survivor: foundations[0], ambiguous: false };
    const candidates = fullRows.length === 1 ? fullRows : rows;
    const fingerprints = new Set(candidates.map(substantiveFingerprint));
    if (fingerprints.size > 1) return { survivor: null, ambiguous: true };
    return { survivor: latestRow(candidates), ambiguous: false };
}

function selectDepartureEvent(rows, departureDate) {
    const candidates = rows.filter(row => day(row.hmeromhnia_apoxorhshs) === departureDate);
    return latestRow(candidates);
}

function dateBefore(value) {
    const result = new Date(value);
    result.setUTCDate(result.getUTCDate() - 1);
    return result;
}

function synchronizationFields(row, currentEmployee) {
    const recordedPair = C.readEmploymentProfile(row).recorded &&
        C.readEmploymentProfile(currentEmployee || {}).recorded;
    return CURRENT_SYNC_FIELDS.filter(field => {
        if (!Object.hasOwn(row, field) || !Object.hasOwn(currentEmployee || {}, field)) return false;
        // Lifecycle and effective-boundary dates are event identity. They are
        // never copied from the mutable master onto a different historical
        // event. Contract end is mutable period state and is synchronized.
        if (DATE_FIELDS.includes(field)) return field === 'hmeromhnia_lhxhs_symbashs';
        if (C.FACT_FIELDS.includes(field)) return recordedPair;
        return meaningful(row[field]) && meaningful(currentEmployee[field]);
    });
}

function canonicalizeEmployeeHistory({ scope, currentEmployee, historyRows = [],
    maxHistoryRows = DEFAULT_MAX_HISTORY_ROWS } = {}) {
    if (!scope || !SCOPE_FIELDS.every(field => String(scope[field] ?? '').trim())) {
        return ambiguity('CONFLICT_SCOPE');
    }
    if (!Array.isArray(historyRows)) return ambiguity('HISTORY_NOT_ARRAY');
    if (historyRows.length > maxHistoryRows) {
        return ambiguity('HISTORY_SIZE_LIMIT_EXCEEDED', [], { rowCount: historyRows.length, maxHistoryRows });
    }
    if ((currentEmployee && !SCOPE_FIELDS.every(field =>
        String(currentEmployee[field] ?? '') === String(scope[field] ?? ''))) ||
        historyRows.some(row => !SCOPE_FIELDS.every(field =>
            String(row[field] ?? '') === String(scope[field] ?? '')))) {
        return ambiguity('CONFLICT_SCOPE');
    }

    const preclassifiedRedundant = historyRows.filter(isPersistedReferencedRedundant);
    const activeRows = historyRows.filter(row => !isPersistedReferencedRedundant(row));
    const rowsByHire = new Map();
    for (const row of activeRows) {
        const hire = day(row.hmeromhnia_proslhpshs);
        const key = hire || `UNCLASSIFIED:${String(row._id)}`;
        if (!rowsByHire.has(key)) rowsByHire.set(key, []);
        rowsByHire.get(key).push(row);
    }
    const currentHire = day(currentEmployee?.hmeromhnia_proslhpshs);
    if (currentHire && !rowsByHire.has(currentHire)) rowsByHire.set(currentHire, []);
    const hires = [...rowsByHire.keys()].filter(key => !key.startsWith('UNCLASSIFIED:')).sort();
    const cycles = [];
    for (const hire of hires) {
        const rows = rowsByHire.get(hire);
        const departureDates = new Set(rows.map(row => day(row.hmeromhnia_apoxorhshs)).filter(Boolean));
        if (hire === currentHire && day(currentEmployee?.hmeromhnia_apoxorhshs)) {
            departureDates.add(day(currentEmployee.hmeromhnia_apoxorhshs));
        }
        if (departureDates.size > 1) {
            return ambiguity('AMBIGUOUS_LIFECYCLE_EVENTS', rows.map(row => row._id),
                { hireDate: hire, departureDates: [...departureDates] });
        }
        const departure = [...departureDates][0] || null;
        if (departure && departure < hire) {
            return ambiguity('EMPLOYMENT_CYCLE_DEPARTURE_BEFORE_HIRE', rows.map(row => row._id),
                { hireDate: hire, departureDate: departure, businessDataInvalid: true });
        }
        cycles.push({ cycle_no: cycles.length + 1, hire_date: hire, departure_date: departure,
            is_current_cycle: hire === currentHire, rows });
    }
    for (let index = 0; index < cycles.length - 1; index += 1) {
        const cycle = cycles[index];
        const next = cycles[index + 1];
        if (!cycle.departure_date) {
            return ambiguity('EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE', cycle.rows.map(row => row._id),
                { cycleNo: cycle.cycle_no, nextHireDate: next.hire_date, businessDataInvalid: true });
        }
        if (cycle.departure_date >= next.hire_date) {
            return ambiguity('EMPLOYMENT_CYCLE_OVERLAP', cycle.rows.map(row => row._id),
                { cycleNo: cycle.cycle_no, nextHireDate: next.hire_date, businessDataInvalid: true });
        }
    }

    const desiredById = new Map();
    const eventTypesById = new Map();
    const replacementByDeletedId = {};
    const diagnostics = { rowCount: historyRows.length, cycleCount: cycles.length,
        semanticPeriodCount: 0, collapsedGroups: [], lifecycleEvents: [] };
    const keep = (row, eventType) => {
        desiredById.set(String(row._id), { ...row });
        if (!eventTypesById.has(String(row._id))) eventTypesById.set(String(row._id), new Set());
        eventTypesById.get(String(row._id)).add(eventType);
    };

    for (const cycle of cycles) {
        const sparseHireRows = cycle.rows.filter(isSparseHireLifecycleEvidence);
        if (sparseHireRows.length) {
            const boundaries = new Set(sparseHireRows.map(row => JSON.stringify([
                day(row.hmeromhnia_allaghs_symbashs), day(row.hmeromhnia_allaghs_orarioy_apo)
            ])));
            if (boundaries.size > 1) {
                return ambiguity('AMBIGUOUS_LIFECYCLE_EVENTS', sparseHireRows.map(row => row._id),
                    { cycleNo: cycle.cycle_no });
            }
            const hireSurvivor = latestRow(sparseHireRows);
            keep(hireSurvivor, EVENT_TYPES.HIRE);
            for (const row of sparseHireRows) if (row !== hireSurvivor) {
                replacementByDeletedId[String(row._id)] = String(hireSurvivor._id);
            }
        }

        const departureRow = cycle.departure_date
            ? selectDepartureEvent(cycle.rows, cycle.departure_date) : null;
        const cycleDeparture = C.calendarDate(cycle.departure_date);
        const profileCandidates = cycle.rows.filter(row => {
            if (isSparseHireLifecycleEvidence(row) || !effectiveStart(row)) return false;
            const lacksExplicitStart = !meaningful(row.hmeromhnia_isxyos_oron_ergasias_apo);
            if (lacksExplicitStart && row.afora_allagh_oron_ergasias === false) return false;
            // A legacy schedule generated after an already recorded departure is
            // technical evidence, never a future profile event.
            if (lacksExplicitStart && cycleDeparture && effectiveStart(row) > cycleDeparture) return false;
            return true;
        });
        let departureIsComposite = false;
        if (departureRow && effectiveStart(departureRow)) {
            const departureStart = effectiveStart(departureRow)?.getTime();
            departureIsComposite = !profileCandidates.some(row => row !== departureRow &&
                effectiveStart(row)?.getTime() === departureStart);
        }
        if (departureRow) {
            keep(departureRow, departureIsComposite
                ? EVENT_TYPES.PROFILE_CHANGE_DEPARTURE : EVENT_TYPES.DEPARTURE);
            diagnostics.lifecycleEvents.push({ cycleNo: cycle.cycle_no,
                eventType: EVENT_TYPES.DEPARTURE, historyId: String(departureRow._id),
                date: cycle.departure_date });
        }

        const semanticProfiles = profileCandidates.filter(row => row !== departureRow || departureIsComposite);
        const profileGroups = new Map();
        for (const row of semanticProfiles) {
            // A stored work-terms end is a real boundary. Schedule-generation
            // dates are deliberately excluded, so their technical differences
            // cannot split an otherwise identical employment period.
            const explicitEnd = Object.hasOwn(row, 'hmeromhnia_isxyos_oron_ergasias_eos')
                ? day(row.hmeromhnia_isxyos_oron_ergasias_eos) : '';
            const key = `${day(effectiveStart(row))}|${explicitEnd}`;
            if (!profileGroups.has(key)) profileGroups.set(key, []);
            profileGroups.get(key).push(row);
        }
        diagnostics.semanticPeriodCount += profileGroups.size;
        const cycleProfiles = [];
        for (const [start, group] of profileGroups) {
            const selected = chooseProfileSurvivor(group, currentEmployee, cycle.is_current_cycle);
            if (selected.ambiguous) {
                return ambiguity('CONFLICTING_PROFILE_EVENTS', group.map(row => row._id),
                    { cycleNo: cycle.cycle_no, effectiveStart: start.split('|')[0] });
            }
            const survivor = selected.survivor;
            keep(survivor, survivor === departureRow
                ? EVENT_TYPES.PROFILE_CHANGE_DEPARTURE : EVENT_TYPES.PROFILE_CHANGE);
            cycleProfiles.push(desiredById.get(String(survivor._id)));
            const redundant = group.filter(row => row !== survivor);
            for (const row of redundant) replacementByDeletedId[String(row._id)] = String(survivor._id);
            if (redundant.length) diagnostics.collapsedGroups.push({ cycleNo: cycle.cycle_no,
                survivorId: String(survivor._id), deletedIds: redundant.map(row => String(row._id)),
                ...(selected.normalizationReason
                    ? { normalizationReason: selected.normalizationReason } : {}) });
        }

        cycleProfiles.sort((left, right) => effectiveStart(left) - effectiveStart(right) ||
            compareTuple(orderTuple(left), orderTuple(right)));
        for (let index = 0; index < cycleProfiles.length; index += 1) {
            const row = cycleProfiles[index];
            const next = cycleProfiles[index + 1];
            const start = effectiveStart(row);
            let end = effectiveEnd(row);
            if (next) {
                const nextStart = effectiveStart(next);
                if (!end && nextStart > start) {
                    row.hmeromhnia_isxyos_oron_ergasias_eos = dateBefore(nextStart);
                    end = effectiveEnd(row);
                } else if (end && end >= nextStart) {
                    return ambiguity('OVERLAPPING_GENUINE_PERIODS', [row._id, next._id],
                        { cycleNo: cycle.cycle_no });
                }
            }
            if (!next && cycle.departure_date) {
                const departure = C.calendarDate(cycle.departure_date);
                if (start > departure) {
                    return ambiguity('PROFILE_EVENT_AFTER_DEPARTURE', [row._id],
                        { cycleNo: cycle.cycle_no, businessDataInvalid: true });
                }
                if (!end || end > departure) row.hmeromhnia_isxyos_oron_ergasias_eos = departure;
            }
        }

        if (cycle.is_current_cycle && cycleProfiles.length) {
            const currentProfile = cycleProfiles.at(-1);
            const patch = changedPatch(currentProfile, currentEmployee || {},
                synchronizationFields(currentProfile, currentEmployee));
            Object.assign(currentProfile, patch);
        } else if (cycle.is_current_cycle && activeRows.length && !departureRow && !sparseHireRows.length) {
            return ambiguity('CURRENT_CYCLE_HISTORY_MISSING', cycle.rows.map(row => row._id),
                { currentHire });
        }

        const unclassified = cycle.rows.filter(row => !desiredById.has(String(row._id)) &&
            !Object.hasOwn(replacementByDeletedId, String(row._id)) && row !== departureRow);
        for (const row of unclassified) keep(row, EVENT_TYPES.LEGACY_TECHNICAL);
    }

    for (const [key, rows] of rowsByHire) if (key.startsWith('UNCLASSIFIED:')) {
        for (const row of rows) keep(row, EVENT_TYPES.LEGACY_TECHNICAL);
    }

    const canonicalRows = [...desiredById.values()].sort((left, right) => {
        const hireDifference = day(left.hmeromhnia_proslhpshs).localeCompare(day(right.hmeromhnia_proslhpshs));
        if (hireDifference) return hireDifference;
        const startDifference = (effectiveStart(left)?.getTime() || 0) -
            (effectiveStart(right)?.getTime() || 0);
        return startDifference || compareTuple(orderTuple(left), orderTuple(right));
    });
    const diff = calculateCanonicalDiff(activeRows, canonicalRows);
    const deletedById = new Map(diff.rowsToDelete.map(item => [item.historyId, item]));
    for (const item of diff.rowsToDelete) item.survivingHistoryId = replacementByDeletedId[item.historyId] || null;
    const classifications = [];
    for (const row of activeRows) {
        const historyId = String(row._id);
        const update = diff.rowsToUpdate.find(item => item.historyId === historyId);
        classifications.push({ historyId,
            disposition: deletedById.has(historyId) ? ROW_DISPOSITIONS.REDUNDANT
                : update ? ROW_DISPOSITIONS.UPDATE : ROW_DISPOSITIONS.KEEP,
            eventTypes: [...(eventTypesById.get(historyId) || [])],
            survivingHistoryId: replacementByDeletedId[historyId] || null,
            patch: update?.patch || {} });
    }
    for (const row of preclassifiedRedundant) classifications.push({ historyId: String(row._id),
        disposition: ROW_DISPOSITIONS.REDUNDANT, eventTypes: [],
        survivingHistoryId: row[REDUNDANT_SURVIVOR_FIELD] || null, referenced: true, patch: {} });
    const events = canonicalRows.flatMap(row => [...(eventTypesById.get(String(row._id)) || [])]
        .map(eventType => ({ eventType, historyId: String(row._id),
            hireDate: day(row.hmeromhnia_proslhpshs), effectiveStart: day(effectiveStart(row)),
            departureDate: eventType.includes('DEPARTURE') ? day(row.hmeromhnia_apoxorhshs) : null })));
    const cleanupRequired = diff.rowsToUpdate.length > 0 || diff.rowsToDelete.length > 0;
    return {
        status: cleanupRequired ? CANONICAL_STATUSES.AUTO_REPAIRABLE : CANONICAL_STATUSES.CLEAN,
        canonicalRows, semanticRows: canonicalRows, rowsToUpdate: diff.rowsToUpdate,
        rowsToDelete: diff.rowsToDelete, rowsToInsert: [], classifications, events,
        employeePatch: {}, cleanupRequired, idempotent: !cleanupRequired, conflicts: [], diagnostics,
        replacementByDeletedId
    };
}

module.exports = {
    CANONICAL_STATUSES,
    ROW_DISPOSITIONS,
    EVENT_TYPES,
    DEFAULT_MAX_HISTORY_ROWS,
    PERIOD_IDENTITY_FIELDS,
    PERIOD_STATE_FIELDS,
    EMPLOYMENT_TYPE_ALIAS_FIELDS,
    PROFILE_EQUIVALENCE_FIELDS,
    CURRENT_SYNC_FIELDS,
    REDUNDANT_STATUS_FIELD,
    REDUNDANT_SURVIVOR_FIELD,
    REDUNDANT_REFERENCED,
    isPersistedReferencedRedundant,
    isSparseHireLifecycleEvidence,
    calculateCanonicalDiff,
    canonicalizeEmployeeHistory
};
