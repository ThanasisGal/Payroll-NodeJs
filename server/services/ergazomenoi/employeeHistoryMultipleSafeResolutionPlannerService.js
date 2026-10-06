'use strict';

const crypto = require('node:crypto');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { effectiveStart, effectiveEnd } =
    require('../../utils/ergazomenoi/employmentProfileHistory');
const { REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD, REDUNDANT_REFERENCED,
    isPersistedReferencedRedundant } =
    require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { partitionHistoryUpdateReferences } =
    require('./employeeHistoryReferenceSemanticsService');
const { CANONICAL_STATUSES, PROFILE_EQUIVALENCE_FIELDS, calculateCanonicalDiff,
    canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { identifyEmployeeHistoryProblemScope } =
    require('./employeeHistoryProblemScopeService');
const { RESOLUTION_CLASSES, REFERENCE_CLASSES } =
    require('./employeeHistoryResolutionAnalysisService');

const MULTIPLE_SAFE_RESOLUTION_VERSION = 'employee-history-multiple-safe-resolution:v1';
const OPERATION = 'EMPLOYEE_HISTORY_MULTIPLE_SAFE_BUSINESS_RESOLUTION';
const RESOLUTION_KIND = 'GUIDED_BUSINESS_CHOICE';
const PLAN_STATUSES = Object.freeze({
    APPLICABLE: 'APPLICABLE',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    BLOCKED: 'BLOCKED'
});
const SHAPE_KINDS = Object.freeze({
    SAME_PERIOD_PROFILE_ALTERNATIVES: 'SAME_PERIOD_PROFILE_ALTERNATIVES',
    CORRECTION_FROM_HIRE_OR_SPECIALTY_CHANGE: 'CORRECTION_FROM_HIRE_OR_SPECIALTY_CHANGE',
    OPTIONAL_INTERMEDIATE_PROFILE: 'OPTIONAL_INTERMEDIATE_PROFILE',
    FOUR_DAY_PROFILE_EFFECTIVE_START: 'FOUR_DAY_PROFILE_EFFECTIVE_START'
});
const SCOPE_FIELDS = Object.freeze(['team', 'company_kod', 'kodikos']);
const START_FIELD = 'hmeromhnia_isxyos_oron_ergasias_apo';
const END_FIELD = 'hmeromhnia_isxyos_oron_ergasias_eos';

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
    if (typeof value.toHexString === 'function') return value.toHexString();
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}
function stableStringify(value) { return JSON.stringify(stableValue(value)); }
function fingerprint(value) {
    return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}
function day(value) { return C.calendarDate(value)?.toISOString().slice(0, 10) || ''; }
function historyId(row = {}) { return row._id == null ? '' : String(row._id); }
function addDays(value, count) {
    const date = C.calendarDate(value);
    if (!date) return '';
    date.setUTCDate(date.getUTCDate() + count);
    return date.toISOString().slice(0, 10);
}
function sameDay(left, right) { return day(left) === day(right); }
function profileKey(row = {}) {
    return `${Number(row.hmeres_ergasias_ebdomadas)}|${Number(row.ores_ergasias_ebdomadas)}`;
}
function optionDateId(prefix, value) { return `${prefix}_${day(value).replaceAll('-', '_')}`; }
function normalizedScope(scope = {}) {
    return Object.fromEntries(SCOPE_FIELDS.map(field =>
        [field, String(scope[field] ?? '').trim()]));
}
function publicOption(id, label, description, input = null) {
    return Object.freeze({ id, label, description,
        ...(input ? { inputs: Object.freeze([Object.freeze(input)]) } : {}) });
}
function dateInput(min, max) {
    return { id: 'effectiveDate', type: 'date', label: 'Ημερομηνία έναρξης',
        required: true, min, max };
}
function basePlan({ scope, currentEmployee, completeHistoryRows, canonicalBefore,
    problemScope }) {
    return {
        version: MULTIPLE_SAFE_RESOLUTION_VERSION,
        status: PLAN_STATUSES.NOT_APPLICABLE,
        reason: canonicalBefore?.diagnostics?.reason || canonicalBefore?.status || 'NOT_APPLICABLE',
        operation: OPERATION,
        resolutionClass: RESOLUTION_CLASSES.MULTIPLE_SAFE_BUSINESS_PLANS,
        resolutionKind: RESOLUTION_KIND,
        shapeKind: null,
        scope,
        businessOptions: [],
        internalPlans: {},
        referenceClass: REFERENCE_CLASSES.UNKNOWN_REFERENCE,
        canonicalBefore,
        problemScope,
        diagnostics: {
            currentEmployeeId: currentEmployee?._id == null ? null : String(currentEmployee._id),
            completeHistoryIds: completeHistoryRows.map(historyId).sort()
        }
    };
}
function finish(plan, status, reason, additions = {}) {
    const result = { ...plan, ...additions, status, reason };
    result.optionSetFingerprint = fingerprint({
        version: result.version,
        resolutionClass: result.resolutionClass,
        resolutionKind: result.resolutionKind,
        shapeKind: result.shapeKind,
        businessOptions: result.businessOptions,
        internalPlans: result.internalPlans,
        referenceClass: result.referenceClass,
        problemScope: result.problemScope,
        diagnostics: result.diagnostics
    });
    return result;
}
function blocked(plan, reason, diagnostics = {}) {
    return finish({ ...plan, diagnostics: { ...plan.diagnostics, ...diagnostics } },
        PLAN_STATUSES.BLOCKED, reason);
}

function referenceStateForRows(rows, summary, referencePartitioner) {
    const byId = {};
    let hasProvenance = false;
    for (const row of rows) {
        const id = historyId(row);
        if (!Object.hasOwn(summary || {}, id) || !Array.isArray(summary[id])) {
            return { referenceClass: REFERENCE_CLASSES.UNKNOWN_REFERENCE,
                byId, safe: false, reason: 'REFERENCE_STATE_NOT_LOADED' };
        }
        let partitioned;
        try { partitioned = referencePartitioner(summary[id]); } catch {
            return { referenceClass: REFERENCE_CLASSES.UNKNOWN_REFERENCE,
                byId, safe: false, reason: 'REFERENCE_SEMANTICS_UNKNOWN' };
        }
        if (partitioned.liveDereference.length) {
            return { referenceClass: REFERENCE_CLASSES.LIVE_REFERENCE,
                byId, safe: false, reason: 'LIVE_REFERENCE_BLOCKS_RESOLUTION' };
        }
        const collections = [...new Set(partitioned.frozenProvenance
            .map(reference => String(reference.collection)))].sort();
        byId[id] = { count: partitioned.frozenProvenance.length, collections };
        if (collections.length) hasProvenance = true;
    }
    return { referenceClass: hasProvenance
        ? REFERENCE_CLASSES.PROVENANCE_ONLY : REFERENCE_CLASSES.NO_REFERENCES,
    byId, safe: true, reason: null };
}

function shapeOne({ activeRows, canonicalBefore, refs }) {
    if (canonicalBefore.diagnostics?.reason !== 'CONFLICTING_PROFILE_EVENTS') return null;
    const conflictIds = canonicalBefore.diagnostics.historyIds || [];
    const candidates = activeRows.filter(row => conflictIds.includes(historyId(row)));
    if (candidates.length !== 2 || new Set(candidates.map(row => day(effectiveStart(row)))).size !== 1 ||
        new Set(candidates.map(row => day(effectiveEnd(row)))).size !== 1 ||
        new Set(candidates.map(profileKey)).size !== 2) return null;
    const twoDay = candidates.find(row => profileKey(row) === '2|14');
    const fourDay = candidates.find(row => profileKey(row) === '4|30');
    if (!twoDay || !fourDay || refs.referenceClass !== REFERENCE_CLASSES.PROVENANCE_ONLY ||
        !refs.byId[historyId(twoDay)]?.count || !refs.byId[historyId(fourDay)]?.count) return null;
    const start = day(effectiveStart(twoDay));
    const end = day(effectiveEnd(twoDay));
    const previous = activeRows.filter(row => day(effectiveEnd(row)) === addDays(start, -1) &&
        profileKey(row) === '1|4');
    const next = activeRows.filter(row => day(effectiveStart(row)) === addDays(end, 1) &&
        profileKey(row) === '5|40');
    const split = day(fourDay.hmeromhnia_allaghs_orarioy_apo);
    if (previous.length !== 1 || !next.length || !split || split <= start || split > end) return null;
    const splitId = optionDateId('SPLIT_AT', split);
    return {
        shapeKind: SHAPE_KINDS.SAME_PERIOD_PROFILE_ALTERNATIVES,
        businessOptions: [
            publicOption('KEEP_TWO_DAY_PROFILE',
                'Ίσχυαν 2 ημέρες / 14 ώρες για όλη την περίοδο',
                'Η απασχόληση 2 ημερών / 14 ωρών ίσχυε σε ολόκληρη την αμφίβολη περίοδο.'),
            publicOption('KEEP_FOUR_DAY_PROFILE',
                'Ίσχυαν 4 ημέρες / 30 ώρες για όλη την περίοδο',
                'Η απασχόληση 4 ημερών / 30 ωρών ίσχυε σε ολόκληρη την αμφίβολη περίοδο.'),
            publicOption(splitId,
                `Έγινε πραγματική αλλαγή στις ${split.slice(8, 10)}/${split.slice(5, 7)}/${split.slice(0, 4)}`,
                'Η πρώτη απασχόληση ίσχυε μέχρι την προηγούμενη ημέρα και η δεύτερη από αυτή την ημερομηνία.')
        ],
        internalPlans: {
            KEEP_TWO_DAY_PROFILE: { strategy: 'KEEP_ONE_RETIRE_OTHER',
                survivorId: historyId(twoDay), retiredId: historyId(fourDay) },
            KEEP_FOUR_DAY_PROFILE: { strategy: 'KEEP_ONE_RETIRE_OTHER',
                survivorId: historyId(fourDay), retiredId: historyId(twoDay) },
            [splitId]: { strategy: 'SPLIT_PAIR', firstId: historyId(twoDay),
                secondId: historyId(fourDay), effectiveDate: split }
        },
        diagnostics: { periodStart: start, periodEnd: end, businessCandidateDate: split }
    };
}

function materialDifferences(left, right) {
    return PROFILE_EQUIVALENCE_FIELDS.filter(field =>
        stableStringify(left[field]) !== stableStringify(right[field]));
}

function shapeTwo({ activeRows, currentEmployee, canonicalBefore, refs }) {
    if (canonicalBefore.diagnostics?.reason !== 'OVERLAPPING_GENUINE_PERIODS' ||
        activeRows.length !== 2 || refs.referenceClass !== REFERENCE_CLASSES.NO_REFERENCES) return null;
    const [left, right] = activeRows;
    const hire = day(currentEmployee.hmeromhnia_proslhpshs);
    if (!hire || !activeRows.every(row => day(effectiveStart(row)) === hire)) return null;
    const bounded = activeRows.find(row => day(effectiveEnd(row)));
    const open = activeRows.find(row => !day(effectiveEnd(row)));
    if (!bounded || !open || profileKey(bounded) !== profileKey(open) ||
        profileKey(open) !== '5|40' ||
        String(bounded.eidikothta_symbashs || '') === String(open.eidikothta_symbashs || '') ||
        String(currentEmployee.eidikothta_symbashs || '') !== String(open.eidikothta_symbashs || '')) return null;
    const differences = materialDifferences(left, right);
    if (!differences.length || differences.some(field => field !== 'eidikothta_symbashs')) return null;
    const predefined = addDays(effectiveEnd(bounded), 1);
    const min = addDays(hire, 1);
    const max = predefined;
    if (!predefined || min > max) return null;
    const predefinedId = optionDateId('SPECIALTY_CHANGE', predefined);
    return {
        shapeKind: SHAPE_KINDS.CORRECTION_FROM_HIRE_OR_SPECIALTY_CHANGE,
        businessOptions: [
            publicOption('CORRECTION_FROM_HIRE',
                `Η ειδικότητα ${String(open.eidikothta_symbashs)} ίσχυε από την πρόσληψη`,
                'Η παλαιότερη ειδικότητα ήταν λανθασμένη και η τρέχουσα ίσχυε από την πρόσληψη.'),
            publicOption(predefinedId,
                `Η ειδικότητα άλλαξε στις ${predefined.slice(8, 10)}/${predefined.slice(5, 7)}/${predefined.slice(0, 4)}`,
                'Η παλαιότερη ειδικότητα ίσχυε μέχρι την προηγούμενη ημέρα.'),
            publicOption('SPECIALTY_CHANGE_OTHER_DATE',
                'Η ειδικότητα άλλαξε σε άλλη ημερομηνία',
                'Δηλώστε την πραγματική ημερομηνία από την οποία ίσχυσε η νέα ειδικότητα.',
                dateInput(min, max))
        ],
        internalPlans: {
            CORRECTION_FROM_HIRE: { strategy: 'DELETE_REDUNDANT_UNREFERENCED',
                survivorId: historyId(open), deletedId: historyId(bounded) },
            [predefinedId]: { strategy: 'SPLIT_PAIR', firstId: historyId(bounded),
                secondId: historyId(open), effectiveDate: predefined, synchronizeCurrentStart: true },
            SPECIALTY_CHANGE_OTHER_DATE: { strategy: 'SPLIT_PAIR_INPUT',
                firstId: historyId(bounded), secondId: historyId(open), min, max,
                synchronizeCurrentStart: true }
        },
        diagnostics: { hire, min, max, predefinedDate: predefined }
    };
}

function shapeThree({ activeRows, canonicalBefore, refs }) {
    if (canonicalBefore.diagnostics?.reason !== 'OVERLAPPING_GENUINE_PERIODS' ||
        refs.referenceClass !== REFERENCE_CLASSES.PROVENANCE_ONLY) return null;
    const fourDay = activeRows.find(row => profileKey(row) === '4|32');
    const twoDay = activeRows.find(row => profileKey(row) === '2|16' && fourDay &&
        sameDay(effectiveStart(row), effectiveStart(fourDay)));
    if (!fourDay || !twoDay || !refs.byId[historyId(twoDay)]?.count) return null;
    const fourEnd = day(effectiveEnd(fourDay));
    const twoEnd = day(effectiveEnd(twoDay));
    const threeDay = activeRows.find(row => profileKey(row) === '3|24' &&
        day(effectiveStart(row)) === addDays(fourEnd, 1) && day(effectiveEnd(row)) === twoEnd);
    const fullTime = activeRows.filter(row => profileKey(row) === '5|40' &&
        day(effectiveStart(row)) === addDays(twoEnd, 1));
    const min = addDays(effectiveStart(fourDay), 1);
    const max = addDays(effectiveStart(threeDay || {}), -1);
    const predefined = day(twoDay.hmeromhnia_allaghs_orarioy_apo);
    if (!threeDay || !fullTime.length || !predefined || min > max ||
        predefined < min || predefined > max) return null;
    const predefinedId = optionDateId('INTERMEDIATE_PROFILE_FROM', predefined);
    return {
        shapeKind: SHAPE_KINDS.OPTIONAL_INTERMEDIATE_PROFILE,
        businessOptions: [
            publicOption('INTERMEDIATE_PROFILE_NOT_REAL',
                'Η απασχόληση 2 ημερών / 16 ωρών ήταν λανθασμένη',
                'Το ιστορικό θα συνεχίσει από την απασχόληση 4 ημερών στην απασχόληση 3 ημερών.'),
            publicOption(predefinedId,
                `Η απασχόληση 2 ημερών / 16 ωρών ίσχυσε από ${predefined.slice(8, 10)}/${predefined.slice(5, 7)}/${predefined.slice(0, 4)}`,
                'Η ενδιάμεση απασχόληση θα διατηρηθεί μέχρι την έναρξη της επόμενης περιόδου.'),
            publicOption('INTERMEDIATE_PROFILE_OTHER_DATE',
                'Η απασχόληση 2 ημερών / 16 ωρών ξεκίνησε σε άλλη ημερομηνία',
                'Δηλώστε την πραγματική ημερομηνία έναρξης της ενδιάμεσης απασχόλησης.',
                dateInput(min, max))
        ],
        internalPlans: {
            INTERMEDIATE_PROFILE_NOT_REAL: { strategy: 'RETIRE_ROW',
                survivorId: historyId(fourDay), retiredId: historyId(twoDay) },
            [predefinedId]: { strategy: 'INSERT_INTERMEDIATE', firstId: historyId(fourDay),
                intermediateId: historyId(twoDay), nextId: historyId(threeDay),
                effectiveDate: predefined },
            INTERMEDIATE_PROFILE_OTHER_DATE: { strategy: 'INSERT_INTERMEDIATE_INPUT',
                firstId: historyId(fourDay), intermediateId: historyId(twoDay),
                nextId: historyId(threeDay), min, max }
        },
        diagnostics: { min, max, predefinedDate: predefined, nextProfileStart: day(effectiveStart(threeDay)) }
    };
}

function shapeFour({ activeRows, currentEmployee, canonicalBefore, refs }) {
    if (canonicalBefore.diagnostics?.reason !== 'OVERLAPPING_GENUINE_PERIODS' ||
        refs.referenceClass !== REFERENCE_CLASSES.PROVENANCE_ONLY) return null;
    const hire = day(currentEmployee.hmeromhnia_proslhpshs);
    const twoDay = activeRows.find(row => profileKey(row) === '2|16' &&
        day(effectiveStart(row)) === hire && day(effectiveEnd(row)));
    const fourDay = activeRows.find(row => profileKey(row) === '4|34' &&
        day(effectiveStart(row)) === hire && !day(effectiveEnd(row)));
    if (!twoDay || !fourDay || !refs.byId[historyId(twoDay)]?.count ||
        !refs.byId[historyId(fourDay)]?.count) return null;
    const nextStart = addDays(effectiveEnd(twoDay), 1);
    const fullTime = activeRows.filter(row => profileKey(row) === '5|40' &&
        day(effectiveStart(row)) === nextStart);
    const predefined = day(fourDay.hmeromhnia_allaghs_orarioy_apo);
    const min = addDays(hire, 1);
    const max = day(effectiveEnd(twoDay));
    if (!fullTime.length || !predefined || predefined < min || predefined > max ||
        profileKey(currentEmployee) !== '5|40') return null;
    const predefinedId = optionDateId('FOUR_DAY_PROFILE_FROM', predefined);
    return {
        shapeKind: SHAPE_KINDS.FOUR_DAY_PROFILE_EFFECTIVE_START,
        businessOptions: [
            publicOption('FOUR_DAY_PROFILE_FROM_HIRE',
                'Οι 4 ημέρες / 34 ώρες ίσχυαν από την πρόσληψη',
                'Η απασχόληση 2 ημερών / 16 ωρών ήταν λανθασμένη.'),
            publicOption(predefinedId,
                `Οι 4 ημέρες / 34 ώρες ίσχυαν από ${predefined.slice(8, 10)}/${predefined.slice(5, 7)}/${predefined.slice(0, 4)}`,
                'Η απασχόληση 2 ημερών θα λήξει την προηγούμενη ημέρα.'),
            publicOption('FOUR_DAY_PROFILE_FROM_OTHER_DATE',
                'Οι 4 ημέρες / 34 ώρες ίσχυαν από άλλη ημερομηνία',
                'Δηλώστε την πραγματική ημερομηνία έναρξης της απασχόλησης 4 ημερών.',
                dateInput(min, max))
        ],
        internalPlans: {
            FOUR_DAY_PROFILE_FROM_HIRE: { strategy: 'RETIRE_ROW_AND_CLOSE_SURVIVOR',
                survivorId: historyId(fourDay), retiredId: historyId(twoDay),
                survivorEnd: max },
            [predefinedId]: { strategy: 'SPLIT_PAIR', firstId: historyId(twoDay),
                secondId: historyId(fourDay), effectiveDate: predefined, secondEnd: max },
            FOUR_DAY_PROFILE_FROM_OTHER_DATE: { strategy: 'SPLIT_PAIR_INPUT',
                firstId: historyId(twoDay), secondId: historyId(fourDay), min, max,
                secondEnd: max }
        },
        diagnostics: { hire, min, max, predefinedDate: predefined, nextProfileStart: nextStart }
    };
}

function planEmployeeHistoryMultipleSafeResolution({ scope: rawScope, currentEmployee,
    completeHistoryRows = [], canonicalResult = null, problemScope = null,
    protectedReferenceSummary = {}, existingResolutionAnalysis = null,
    referencePartitioner = partitionHistoryUpdateReferences,
    canonicalizer = canonicalizeEmployeeHistory } = {}) {
    const scope = normalizedScope(rawScope);
    const canonicalBefore = canonicalResult || canonicalizer({ scope, currentEmployee,
        historyRows: completeHistoryRows });
    const resolvedProblemScope = problemScope || identifyEmployeeHistoryProblemScope({
        scope, currentEmployee, completeHistoryRows, canonicalizer });
    const plan = basePlan({ scope, currentEmployee, completeHistoryRows,
        canonicalBefore, problemScope: resolvedProblemScope });
    if (!currentEmployee || !Array.isArray(completeHistoryRows) || !completeHistoryRows.length ||
        SCOPE_FIELDS.some(field => !scope[field] ||
            String(currentEmployee[field] ?? '') !== scope[field]) ||
        completeHistoryRows.some(row => !historyId(row) || SCOPE_FIELDS.some(field =>
            String(row[field] ?? '') !== scope[field])) ||
        new Set(completeHistoryRows.map(historyId)).size !== completeHistoryRows.length) {
        return blocked(plan, 'INVALID_OR_CONFLICTING_INPUT');
    }
    if (existingResolutionAnalysis?.resolutionClass === RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN) {
        return finish(plan, PLAN_STATUSES.NOT_APPLICABLE, 'UNIQUE_SAFE_PLAN_OWNS_AMBIGUITY');
    }
    if (canonicalBefore.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY ||
        resolvedProblemScope.deterministicallyResolved !== true ||
        !resolvedProblemScope.problematicHistoryIds.length) {
        return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
            canonicalBefore.diagnostics?.reason || canonicalBefore.status);
    }
    let cycles;
    try { cycles = buildEmploymentCycles({ currentEmployee, history: completeHistoryRows }); } catch (error) {
        return blocked(plan, error.code || 'EMPLOYMENT_CYCLE_UNRESOLVED');
    }
    if (cycles.length !== 1) return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
        'EXACTLY_ONE_EMPLOYMENT_CYCLE_REQUIRED');
    const refs = referenceStateForRows(completeHistoryRows, protectedReferenceSummary,
        referencePartitioner);
    if (!refs.safe) return blocked({ ...plan, referenceClass: refs.referenceClass }, refs.reason,
        { referenceClass: refs.referenceClass, referenceState: refs.byId });
    const activeRows = completeHistoryRows.filter(row => !isPersistedReferencedRedundant(row));
    const context = { activeRows, currentEmployee, canonicalBefore, refs };
    const matches = [shapeOne(context), shapeTwo(context), shapeThree(context), shapeFour(context)]
        .filter(Boolean);
    if (matches.length !== 1) return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
        matches.length ? 'MULTIPLE_SHAPE_MATCHES' : 'UNSUPPORTED_MULTIPLE_SAFE_SHAPE');
    const match = matches[0];
    return finish({ ...plan,
        shapeKind: match.shapeKind,
        businessOptions: match.businessOptions,
        internalPlans: match.internalPlans,
        referenceClass: refs.referenceClass,
        diagnostics: { ...plan.diagnostics, ...match.diagnostics,
            referenceState: refs.byId, cycleCount: cycles.length }
    }, PLAN_STATUSES.APPLICABLE, 'MULTIPLE_SAFE_BUSINESS_OPTIONS');
}

function invalidChoice(code = 'EMPLOYEE_HISTORY_RESOLUTION_INVALID_REQUEST') {
    const error = new Error(code);
    error.code = code;
    error.statusCode = 400;
    return error;
}

function normalizedEffectiveDate(internal, answers) {
    if (!internal.strategy.endsWith('_INPUT')) {
        if (answers !== undefined) throw invalidChoice();
        return internal.effectiveDate || null;
    }
    if (!answers || typeof answers !== 'object' || Array.isArray(answers) ||
        Object.getPrototypeOf(answers) !== Object.prototype ||
        Object.keys(answers).length !== 1 || !Object.hasOwn(answers, 'effectiveDate')) {
        throw invalidChoice();
    }
    let value;
    try {
        if (typeof answers.effectiveDate !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(answers.effectiveDate)) {
            throw new TypeError('Exact calendar date required');
        }
        value = day(C.calendarDate(answers.effectiveDate, 'effectiveDate'));
    } catch {
        throw invalidChoice('EMPLOYEE_HISTORY_RESOLUTION_DATE_INVALID');
    }
    if (!value || value < internal.min || value > internal.max) {
        throw invalidChoice('EMPLOYEE_HISTORY_RESOLUTION_DATE_OUT_OF_RANGE');
    }
    return value;
}

function strictClean(result) {
    return result?.status === CANONICAL_STATUSES.CLEAN && result.cleanupRequired === false &&
        result.idempotent === true && !(result.rowsToUpdate || []).length &&
        !(result.rowsToDelete || []).length && !(result.rowsToInsert || []).length &&
        !Object.keys(result.employeePatch || {}).length;
}

function resolveEmployeeHistoryMultipleSafeChoice({ plannerResult, choiceId, answers,
    currentEmployee, completeHistoryRows = [], canonicalizer = canonicalizeEmployeeHistory } = {}) {
    if (plannerResult?.status !== PLAN_STATUSES.APPLICABLE ||
        plannerResult?.operation !== OPERATION || typeof choiceId !== 'string' ||
        !Object.hasOwn(plannerResult.internalPlans || {}, choiceId)) throw invalidChoice();
    const internal = plannerResult.internalPlans[choiceId];
    const effectiveDate = normalizedEffectiveDate(internal, answers);
    const byId = new Map(completeHistoryRows.map(row => [historyId(row), row]));
    let desired = completeHistoryRows.map(row => ({ ...row }));
    const desiredById = () => new Map(desired.map(row => [historyId(row), row]));
    const retire = (retiredId, survivorId) => {
        const rows = desiredById();
        if (!rows.has(retiredId) || !rows.has(survivorId)) throw invalidChoice();
        Object.assign(rows.get(retiredId), {
            [REDUNDANT_STATUS_FIELD]: REDUNDANT_REFERENCED,
            [REDUNDANT_SURVIVOR_FIELD]: survivorId
        });
    };
    const patch = (id, values) => {
        const row = desiredById().get(id);
        if (!row) throw invalidChoice();
        Object.assign(row, values);
    };
    const closeBefore = (id, start) => patch(id, { [END_FIELD]: C.calendarDate(addDays(start, -1)) });
    const startAt = (id, start) => patch(id, { [START_FIELD]: C.calendarDate(start) });
    if (internal.strategy === 'KEEP_ONE_RETIRE_OTHER' || internal.strategy === 'RETIRE_ROW') {
        retire(internal.retiredId, internal.survivorId);
    } else if (internal.strategy === 'RETIRE_ROW_AND_CLOSE_SURVIVOR') {
        retire(internal.retiredId, internal.survivorId);
        patch(internal.survivorId, { [END_FIELD]: C.calendarDate(internal.survivorEnd) });
    } else if (internal.strategy === 'DELETE_REDUNDANT_UNREFERENCED') {
        desired = desired.filter(row => historyId(row) !== internal.deletedId);
    } else if (['SPLIT_PAIR', 'SPLIT_PAIR_INPUT'].includes(internal.strategy)) {
        closeBefore(internal.firstId, effectiveDate);
        startAt(internal.secondId, effectiveDate);
        if (internal.secondEnd) patch(internal.secondId,
            { [END_FIELD]: C.calendarDate(internal.secondEnd) });
    } else if (['INSERT_INTERMEDIATE', 'INSERT_INTERMEDIATE_INPUT'].includes(internal.strategy)) {
        const next = byId.get(internal.nextId);
        if (!next) throw invalidChoice();
        closeBefore(internal.firstId, effectiveDate);
        startAt(internal.intermediateId, effectiveDate);
        patch(internal.intermediateId,
            { [END_FIELD]: C.calendarDate(addDays(effectiveStart(next), -1)) });
    } else {
        throw invalidChoice();
    }
    const currentPatch = internal.synchronizeCurrentStart
        ? { [START_FIELD]: C.calendarDate(effectiveDate) } : {};
    const proposedCurrent = { ...currentEmployee, ...currentPatch };
    let canonical = canonicalizer({ scope: plannerResult.scope,
        currentEmployee: proposedCurrent, historyRows: desired });
    if (canonical?.status === CANONICAL_STATUSES.AUTO_REPAIRABLE) {
        const boundaryClosureOnly = !(canonical.rowsToDelete || []).length &&
            !(canonical.rowsToInsert || []).length &&
            !Object.keys(canonical.employeePatch || {}).length &&
            (canonical.rowsToUpdate || []).length > 0 &&
            canonical.rowsToUpdate.every(item =>
                Object.keys(item.patch || {}).length === 1 &&
                Object.hasOwn(item.patch, END_FIELD));
        if (!boundaryClosureOnly) {
            const error = invalidChoice('EMPLOYEE_HISTORY_MULTIPLE_SAFE_SIMULATION_FAILED');
            error.canonicalReason = canonical?.diagnostics?.reason || canonical?.status;
            throw error;
        }
        const retiredRows = desired.filter(isPersistedReferencedRedundant);
        desired = [...canonical.canonicalRows.map(row => ({ ...row })),
            ...retiredRows.map(row => ({ ...row }))];
        canonical = canonicalizer({ scope: plannerResult.scope,
            currentEmployee: proposedCurrent, historyRows: desired });
    }
    if (!strictClean(canonical)) {
        const error = invalidChoice('EMPLOYEE_HISTORY_MULTIPLE_SAFE_SIMULATION_FAILED');
        error.canonicalReason = canonical?.diagnostics?.reason || canonical?.status;
        throw error;
    }
    const second = canonicalizer({ scope: plannerResult.scope,
        currentEmployee: proposedCurrent, historyRows: desired });
    if (!strictClean(second) || stableStringify(second.canonicalRows) !==
        stableStringify(canonical.canonicalRows)) {
        throw invalidChoice('EMPLOYEE_HISTORY_MULTIPLE_SAFE_SIMULATION_FAILED');
    }
    const diff = calculateCanonicalDiff(completeHistoryRows, desired);
    const historyPatches = Object.fromEntries(diff.rowsToUpdate.map(item =>
        [item.historyId, item.patch]));
    const physicalDeleteIds = diff.rowsToDelete.map(item => item.historyId).sort();
    if (physicalDeleteIds.length && (internal.strategy !== 'DELETE_REDUNDANT_UNREFERENCED' ||
        plannerResult.referenceClass !== REFERENCE_CLASSES.NO_REFERENCES ||
        physicalDeleteIds.length !== 1 || physicalDeleteIds[0] !== internal.deletedId)) {
        throw invalidChoice('EMPLOYEE_HISTORY_MULTIPLE_SAFE_INVALID_BOUNDARY');
    }
    const execution = {
        version: MULTIPLE_SAFE_RESOLUTION_VERSION,
        status: PLAN_STATUSES.APPLICABLE,
        reason: 'SELECTED_BUSINESS_PLAN_CLEAN',
        operation: OPERATION,
        shapeKind: plannerResult.shapeKind,
        choiceId,
        normalizedAnswers: effectiveDate && internal.strategy.endsWith('_INPUT')
            ? { effectiveDate } : {},
        currentPatch,
        desiredHistoryRows: desired,
        historyPatches,
        changedHistoryIds: diff.rowsToUpdate.map(item => item.historyId).sort(),
        physicalDeleteIds,
        insertedRows: diff.rowsToInsert,
        replacementByDeletedId: internal.deletedId
            ? { [internal.deletedId]: internal.survivorId } : {},
        referenceClass: plannerResult.referenceClass,
        hypotheticalCanonicalResult: canonical,
        secondCanonicalResult: second
    };
    execution.planFingerprint = fingerprint(execution);
    return execution;
}

module.exports = {
    MULTIPLE_SAFE_RESOLUTION_VERSION,
    OPERATION,
    RESOLUTION_KIND,
    PLAN_STATUSES,
    SHAPE_KINDS,
    START_FIELD,
    END_FIELD,
    stableValue,
    fingerprint,
    planEmployeeHistoryMultipleSafeResolution,
    resolveEmployeeHistoryMultipleSafeChoice
};
