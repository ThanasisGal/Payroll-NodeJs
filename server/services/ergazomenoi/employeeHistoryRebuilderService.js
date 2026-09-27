'use strict';

const C = require('../../utils/ergazomenoi/employmentProfileContract');
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const { BASE_HISTORY_FIELDS, effectiveStart, effectiveEnd } =
    require('../../utils/ergazomenoi/employmentProfileHistory');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');

const REBUILD_STATUSES = Object.freeze({
    NO_CHANGE: 'NO_CHANGE',
    CLEAN: 'CLEAN',
    AUTO_REPAIRABLE: 'AUTO_REPAIRABLE',
    MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED'
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
    'hmeromhnia_allaghs_symbashs',
    'hmeromhnia_allaghs_orarioy_apo',
    'hmeromhnia_allaghs_orarioy_eos',
    'hmeromhnia_isxyos_oron_ergasias_apo',
    'hmeromhnia_isxyos_oron_ergasias_eos',
    'hmeromhnia_isxyos_dialleimatos_apo',
    'hmeromhnia_apoxorhshs'
]);
// These describe the state inside an already identified period. Differences in
// these fields can rank competing legacy snapshots, but cannot create a period.
const PERIOD_STATE_FIELDS = Object.freeze([...new Set([
    ...BASE_HISTORY_FIELDS.filter(field => !PERIOD_IDENTITY_FIELDS.includes(field)),
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
const EVENT_KINDS = Object.freeze({
    HIRE_LIFECYCLE: 'HIRE_LIFECYCLE',
    PROFILE_SNAPSHOT: 'PROFILE_SNAPSHOT'
});
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
function comparable(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
        const date = C.calendarDate(value.slice(0, 10));
        if (date) return date.toISOString();
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

function day(value) {
    return C.calendarDate(value)?.toISOString().slice(0, 10) || '';
}

function semanticPeriodKey(row, eventKind = EVENT_KINDS.PROFILE_SNAPSHOT) {
    const from = effectiveStart(row);
    // A missing legacy work-terms end is not the schedule-generation end. Treat
    // it as unrecorded/open for period identity so that a later explicit row can
    // be recognized as the same period without using a mutable date cut-off.
    const until = Object.hasOwn(row, 'hmeromhnia_isxyos_oron_ergasias_eos')
        ? C.calendarDate(row.hmeromhnia_isxyos_oron_ergasias_eos) : null;
    const breakFrom = C.calendarDate(row.hmeromhnia_isxyos_dialleimatos_apo);
    const distinctBreakStart = breakFrom && breakFrom.getTime() !== (from?.getTime() ?? null)
        ? breakFrom : null;
    return JSON.stringify([
        eventKind,
        day(row.hmeromhnia_proslhpshs),
        day(row.hmeromhnia_allaghs_symbashs),
        day(row.hmeromhnia_allaghs_orarioy_apo),
        day(row.hmeromhnia_allaghs_orarioy_eos),
        day(from),
        day(until),
        day(distinctBreakStart),
        day(row.hmeromhnia_apoxorhshs)
    ]);
}

function isSparseHireLifecycleEvidence(row) {
    return row.afora_proslhpsh === true &&
        !meaningful(row.hmeromhnia_isxyos_oron_ergasias_apo) &&
        row.afora_allagh_oron_ergasias !== true &&
        !C.readEmploymentProfile(row).recorded;
}

function orderTuple(row) {
    const aa = Number(row.aa_eggrafhs);
    const createdAt = row.createdAt ? new Date(row.createdAt).getTime() : 0;
    return [
        Number.isSafeInteger(aa) ? aa : -1,
        Number.isFinite(createdAt) ? createdAt : 0,
        String(row._id ?? '')
    ];
}

function compareTuple(left, right) {
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        if (left[index] < right[index]) return -1;
        if (left[index] > right[index]) return 1;
    }
    return 0;
}

function latestOrderedRow(rows = []) {
    let latest = null;
    for (const row of rows) {
        if (!latest || compareTuple(orderTuple(row), orderTuple(latest)) > 0) latest = row;
    }
    return latest;
}

function meaningful(value) {
    return value !== undefined && value !== null && value !== '' &&
        (typeof value !== 'number' || Number.isFinite(value));
}

function provenanceScore(row, authoritativeCurrent, currentPeriod) {
    let score = 0;
    if (C.readEmploymentProfile(row).recorded) score += 100;
    if (row.employment_profile_source === 'EMPLOYEE_PROFILE_FOUNDATION') score += 50;
    else if (String(row.employment_profile_source || '').trim()) score += 20;
    if (Object.hasOwn(row, 'hmeromhnia_isxyos_oron_ergasias_apo') &&
        row.hmeromhnia_isxyos_oron_ergasias_apo != null) score += 10;
    if (row.afora_allagh_oron_ergasias === true) score += 5;
    if (row.afora_allagh_dialleimatos === true) score += 2;
    score += PERIOD_STATE_FIELDS.filter(field => meaningful(row[field])).length / 100;
    if (currentPeriod) {
        const comparableFields = CURRENT_SYNC_FIELDS.filter(field =>
            field !== 'hmeromhnia_lhxhs_symbashs' && meaningful(row[field]) &&
            meaningful(authoritativeCurrent?.[field]));
        if (comparableFields.length &&
            comparableFields.every(field => equal(row[field], authoritativeCurrent[field]))) score += 1000;
    }
    return score;
}

function selectSurvivor(rows, authoritativeCurrent, currentPeriod) {
    return [...rows].sort((left, right) => {
        const scoreDifference = provenanceScore(left, authoritativeCurrent, currentPeriod) -
            provenanceScore(right, authoritativeCurrent, currentPeriod);
        return scoreDifference || compareTuple(orderTuple(left), orderTuple(right));
    }).at(-1);
}

function changedPatch(stored, proposed, fields) {
    return Object.fromEntries(fields.filter(field => Object.hasOwn(proposed, field) &&
        proposed[field] !== undefined && !equal(stored[field], proposed[field]))
        .map(field => [field, proposed[field]]));
}

function currentSynchronizationFields(latest, authoritativeCurrent) {
    const recordedPair = C.readEmploymentProfile(latest).recorded &&
        C.readEmploymentProfile(authoritativeCurrent || {}).recorded;
    return CURRENT_SYNC_FIELDS.filter(field => {
        if (!Object.hasOwn(latest, field) || !Object.hasOwn(authoritativeCurrent || {}, field)) return false;
        if (DATE_FIELDS.includes(field)) return true;
        if (C.FACT_FIELDS.includes(field)) return recordedPair;
        if (T.STANDARD_FIELDS.includes(field) || [
            'kathestos_apasxolhshs', 'typos_apasxolhshs', 'typos_ebdomadas',
            'apasxolhsh_basei_symbashs', 'pososto_prosayxhshs_6hs_hmeras',
            'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas',
            'mo_oron_hmerhsias_ergasias'
        ].includes(field)) return true;
        return meaningful(latest[field]) && meaningful(authoritativeCurrent[field]);
    });
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

function manual(reason, diagnostics = {}) {
    return {
        status: REBUILD_STATUSES.MANUAL_REVIEW_REQUIRED,
        canonicalRows: [], rowsToUpdate: [], rowsToDelete: [], rowsToInsert: [],
        employeePatch: {}, conflicts: [{ reason }], cleanupRequired: false,
        idempotent: false, diagnostics: { reason, ...diagnostics }, replacementByDeletedId: {}
    };
}

function rebuildEmployeeHistory({ scope, currentEmployee, historyRows = [],
    authoritativeCurrent = currentEmployee, maxHistoryRows = DEFAULT_MAX_HISTORY_ROWS } = {}) {
    if (!scope || !SCOPE_FIELDS.every(field => String(scope[field] ?? '').trim())) {
        return manual('CONFLICT_SCOPE');
    }
    if (!Array.isArray(historyRows)) return manual('HISTORY_NOT_ARRAY');
    if (historyRows.length > maxHistoryRows) {
        return manual('HISTORY_SIZE_LIMIT_EXCEEDED', { rowCount: historyRows.length, maxHistoryRows });
    }
    if ((currentEmployee && !SCOPE_FIELDS.every(field =>
        String(currentEmployee[field] ?? '') === String(scope[field] ?? ''))) ||
        historyRows.some(row => !SCOPE_FIELDS.every(field =>
            String(row[field] ?? '') === String(scope[field] ?? '')))) {
        return manual('CONFLICT_SCOPE');
    }

    let cycles;
    try {
        cycles = buildEmploymentCycles({ currentEmployee, history: historyRows });
    } catch (error) {
        return manual(error.code || 'EMPLOYMENT_CYCLE_INVALID', { lifecycleDetails: error.details || null });
    }

    const currentHire = day(currentEmployee?.hmeromhnia_proslhpshs);
    const currentCycle = cycles.find(cycle => cycle.is_current_cycle && cycle.hire_date === currentHire) || null;
    const cycleById = new Map();
    for (const cycle of cycles) for (const id of cycle.history_ids) cycleById.set(String(id), cycle);
    const rowsByCycleNo = new Map();
    for (const row of historyRows) {
        const cycle = cycleById.get(String(row._id));
        if (!cycle) continue;
        if (!rowsByCycleNo.has(cycle.cycle_no)) rowsByCycleNo.set(cycle.cycle_no, []);
        rowsByCycleNo.get(cycle.cycle_no).push(row);
    }
    const eventKindById = new Map();
    for (const cycle of cycles) {
        const sparseHireRows = (rowsByCycleNo.get(cycle.cycle_no) || [])
            .filter(isSparseHireLifecycleEvidence);
        const lifecycleKeys = new Set(sparseHireRows.map(row => semanticPeriodKey(
            row, EVENT_KINDS.HIRE_LIFECYCLE)));
        if (lifecycleKeys.size > 1) {
            return manual('AMBIGUOUS_LIFECYCLE_EVENTS', {
                cycleNo: cycle.cycle_no,
                historyIds: sparseHireRows.map(row => String(row._id))
            });
        }
        for (const row of sparseHireRows) {
            eventKindById.set(String(row._id), EVENT_KINDS.HIRE_LIFECYCLE);
        }
    }
    const groups = new Map();
    for (const row of historyRows) {
        // Rows without an explicit hire cannot establish or merge employment
        // cycles. Preserve each one independently as unclassified legacy data.
        const cycle = cycleById.get(String(row._id)) || {
            cycle_no: `UNCLASSIFIED:${String(row._id)}`,
            history_ids: [String(row._id)],
            is_current_cycle: false
        };
        const eventKind = eventKindById.get(String(row._id)) || EVENT_KINDS.PROFILE_SNAPSHOT;
        const key = `${cycle.cycle_no}|${semanticPeriodKey(row, eventKind)}`;
        if (!groups.has(key)) groups.set(key, { key, cycle, eventKind, rows: [] });
        groups.get(key).rows.push(row);
    }

    let latestCurrentGroup = null;
    let latestCurrentRow = null;
    for (const group of groups.values()) {
        if (!currentCycle || group.cycle.cycle_no !== currentCycle.cycle_no ||
            group.eventKind !== EVENT_KINDS.PROFILE_SNAPSHOT) continue;
        const candidate = latestOrderedRow(group.rows);
        if (!latestCurrentRow ||
            (effectiveStart(candidate)?.getTime() || 0) >
                (effectiveStart(latestCurrentRow)?.getTime() || 0) ||
            ((effectiveStart(candidate)?.getTime() || 0) ===
                (effectiveStart(latestCurrentRow)?.getTime() || 0) &&
                compareTuple(orderTuple(candidate), orderTuple(latestCurrentRow)) > 0)) {
            latestCurrentGroup = group;
            latestCurrentRow = candidate;
        }
    }

    const canonicalRows = [];
    const rowsToDelete = [];
    const replacementByDeletedId = {};
    const diagnostics = { rowCount: historyRows.length, cycleCount: cycles.length,
        semanticPeriodCount: groups.size, collapsedGroups: [] };

    for (const group of groups.values()) {
        const currentPeriod = group === latestCurrentGroup;
        const survivor = selectSurvivor(group.rows, authoritativeCurrent, currentPeriod);
        canonicalRows.push({ ...survivor });
        if (group.rows.length > 1) {
            const redundant = group.rows.filter(row => String(row._id) !== String(survivor._id));
            for (const row of redundant) {
                rowsToDelete.push({ historyId: String(row._id), survivingHistoryId: String(survivor._id) });
                replacementByDeletedId[String(row._id)] = String(survivor._id);
            }
            diagnostics.collapsedGroups.push({ cycleNo: group.cycle.cycle_no,
                survivorId: String(survivor._id), deletedIds: redundant.map(row => String(row._id)) });
        }
    }

    canonicalRows.sort((left, right) => {
        const leftCycle = cycleById.get(String(left._id))?.cycle_no || 0;
        const rightCycle = cycleById.get(String(right._id))?.cycle_no || 0;
        if (leftCycle !== rightCycle) return leftCycle - rightCycle;
        const leftStart = effectiveStart(left)?.getTime() || 0;
        const rightStart = effectiveStart(right)?.getTime() || 0;
        return leftStart - rightStart || compareTuple(orderTuple(left), orderTuple(right));
    });

    const canonicalRowsByCycleNo = new Map();
    for (const row of canonicalRows) {
        const cycleNo = cycleById.get(String(row._id))?.cycle_no;
        if (cycleNo === undefined) continue;
        if (!canonicalRowsByCycleNo.has(cycleNo)) canonicalRowsByCycleNo.set(cycleNo, []);
        canonicalRowsByCycleNo.get(cycleNo).push(row);
    }

    for (const cycle of cycles) {
        const cycleRows = (canonicalRowsByCycleNo.get(cycle.cycle_no) || []).filter(row =>
            effectiveStart(row) &&
            !(row.afora_proslhpsh === true && !C.readEmploymentProfile(row).recorded));
        for (let index = 1; index < cycleRows.length; index += 1) {
            const previous = cycleRows[index - 1];
            const next = cycleRows[index];
            const previousEnd = effectiveEnd(previous);
            if (!previousEnd || previousEnd >= effectiveStart(next)) {
                return manual('OVERLAPPING_GENUINE_PERIODS', {
                    cycleNo: cycle.cycle_no,
                    historyIds: [String(previous._id), String(next._id)]
                });
            }
        }
    }

    if (currentCycle) {
        const latest = (canonicalRowsByCycleNo.get(currentCycle.cycle_no) || []).at(-1);
        if (latest) {
            const patch = changedPatch(latest, authoritativeCurrent || {},
                currentSynchronizationFields(latest, authoritativeCurrent));
            if (Object.keys(patch).length) {
                Object.assign(latest, patch);
            }
        } else if (historyRows.length) {
            return manual('CURRENT_CYCLE_HISTORY_MISSING', { currentHire });
        }
    }

    const diff = calculateCanonicalDiff(historyRows, canonicalRows);
    const rowsToUpdate = diff.rowsToUpdate;
    const cleanupRequired = rowsToDelete.length > 0 || rowsToUpdate.length > 0;
    return {
        status: cleanupRequired ? REBUILD_STATUSES.AUTO_REPAIRABLE : REBUILD_STATUSES.CLEAN,
        canonicalRows,
        rowsToUpdate,
        rowsToDelete,
        rowsToInsert: [],
        employeePatch: {},
        conflicts: [],
        cleanupRequired,
        idempotent: !cleanupRequired,
        diagnostics,
        replacementByDeletedId
    };
}

module.exports = {
    REBUILD_STATUSES,
    DEFAULT_MAX_HISTORY_ROWS,
    EVENT_KINDS,
    PERIOD_IDENTITY_FIELDS,
    PERIOD_STATE_FIELDS,
    CURRENT_SYNC_FIELDS,
    isSparseHireLifecycleEvidence,
    semanticPeriodKey,
    calculateCanonicalDiff,
    rebuildEmployeeHistory
};
