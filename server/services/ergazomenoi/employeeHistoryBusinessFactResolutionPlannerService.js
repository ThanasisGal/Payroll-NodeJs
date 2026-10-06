'use strict';

const crypto = require('node:crypto');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { BASE_HISTORY_FIELDS, effectiveStart } =
    require('../../utils/ergazomenoi/employmentProfileHistory');
const { REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD, REDUNDANT_REFERENCED,
    isPersistedReferencedRedundant } =
    require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { resolveEmploymentTypeSemantics } =
    require('../../utils/ergazomenoi/employmentTypeSemantics');
const { partitionHistoryUpdateReferences } =
    require('./employeeHistoryReferenceSemanticsService');
const { CANONICAL_STATUSES, PROFILE_EQUIVALENCE_FIELDS, calculateCanonicalDiff,
    canonicalizeEmployeeHistory, isSparseHireLifecycleEvidence } =
    require('./employeeHistoryCanonicalizationService');
const { identifyEmployeeHistoryProblemScope } =
    require('./employeeHistoryProblemScopeService');
const { RESOLUTION_CLASSES, REFERENCE_CLASSES } =
    require('./employeeHistoryResolutionAnalysisService');

const BUSINESS_FACT_RESOLUTION_VERSION = 'employee-history-business-fact-resolution:v1';
const OPERATION = 'EMPLOYEE_HISTORY_BUSINESS_FACT_RESOLUTION';
const RESOLUTION_KIND = 'BUSINESS_FACT_COLLECTION';
const PLAN_STATUSES = Object.freeze({
    APPLICABLE: 'APPLICABLE',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    BLOCKED: 'BLOCKED'
});
const SHAPE_KINDS = Object.freeze({
    COMPETING_DEPARTURE_DATES: 'COMPETING_DEPARTURE_DATES',
    DEPARTURE_AND_PAY_EFFECTIVE_DATE: 'DEPARTURE_AND_PAY_EFFECTIVE_DATE'
});
const QUESTION_TYPES = Object.freeze({
    SINGLE_CHOICE: 'SINGLE_CHOICE',
    DATE: 'DATE'
});
const ANSWERS = Object.freeze({
    DEPARTED_ON_FIRST_RECORDED_DATE: 'DEPARTED_ON_FIRST_RECORDED_DATE',
    DEPARTED_ON_SECOND_RECORDED_DATE: 'DEPARTED_ON_SECOND_RECORDED_DATE',
    DEPARTED_ON_OTHER_DATE: 'DEPARTED_ON_OTHER_DATE',
    NO_DEPARTURE: 'NO_DEPARTURE',
    PAY_APPLIED_FROM_HIRE: 'PAY_APPLIED_FROM_HIRE',
    PAY_APPLIED_FROM_OTHER_DATE: 'PAY_APPLIED_FROM_OTHER_DATE'
});
const SCOPE_FIELDS = Object.freeze(['team', 'company_kod', 'kodikos']);
const START_FIELD = 'hmeromhnia_isxyos_oron_ergasias_apo';
const END_FIELD = 'hmeromhnia_isxyos_oron_ergasias_eos';
const DEPARTURE_FIELD = 'hmeromhnia_apoxorhshs';
const PAY_FIELDS = Object.freeze(BASE_HISTORY_FIELDS.filter(field =>
    field === 'misthologiko_klimakio' ||
    /^(?:stoixeio_symbashs_|poso_symbashs_|poso_symbashs_basei_oron_ergasias_)/.test(field) ||
    /^(?:synolo_symbashs|synolo_symbashs_basei_oron_ergasias|nomimosMisthos|nomimoHmeromisthio|nomimoOromisthio|pragmatikosMisthos|pragmatikoHmeromisthio|pragmatikoOromisthio)$/.test(field)));
const PAY_FIELD_SET = new Set(PAY_FIELDS);
const EMPLOYMENT_TYPE_FIELDS = new Set(['kathestos_apasxolhshs', 'typos_apasxolhshs']);

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
function dateValue(value) { return value ? C.calendarDate(value) : null; }
function addDays(value, count) {
    const result = C.calendarDate(value);
    if (!result) return '';
    result.setUTCDate(result.getUTCDate() + count);
    return result.toISOString().slice(0, 10);
}
function historyId(row = {}) { return row._id == null ? '' : String(row._id); }
function normalizedScope(scope = {}) {
    return Object.fromEntries(SCOPE_FIELDS.map(field =>
        [field, String(scope[field] ?? '').trim()]));
}
function orderTuple(row = {}, index = 0) {
    return [Number(row.aa_eggrafhs) || 0,
        row.createdAt ? new Date(row.createdAt).getTime() || 0 : 0,
        historyId(row), index];
}
function compareTuple(left, right) {
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        if (left[index] < right[index]) return -1;
        if (left[index] > right[index]) return 1;
    }
    return 0;
}
function orderedRows(rows = []) {
    return rows.map((row, index) => ({ row, order: orderTuple(row, index) }))
        .sort((left, right) => compareTuple(left.order, right.order)).map(item => item.row);
}
function latest(rows = []) { return orderedRows(rows).at(-1) || null; }
function greekDate(value) {
    const normalized = day(value);
    return `${normalized.slice(8, 10)}/${normalized.slice(5, 7)}/${normalized.slice(0, 4)}`;
}
function greekMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '';
    const [integer, decimal] = amount.toFixed(2).split('.');
    return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimal}`;
}
function valueForComparison(field, value) {
    if (field === 'pososto_prosayxhshs_6hs_hmeras') return Number(value || 0);
    return value === undefined ? null : value;
}
function nonPayProfileFingerprint(row = {}) {
    return stableStringify({
        fields: Object.fromEntries(PROFILE_EQUIVALENCE_FIELDS
            .filter(field => !PAY_FIELD_SET.has(field) && !EMPLOYMENT_TYPE_FIELDS.has(field))
            .map(field => [field, valueForComparison(field, row[field])])),
        employmentType: resolveEmploymentTypeSemantics(row).comparisonKey
    });
}
function payProfileFingerprint(row = {}) {
    return stableStringify(Object.fromEntries(PAY_FIELDS
        .map(field => [field, valueForComparison(field, row[field])])));
}
function publicChoice(id, label) { return Object.freeze({ id, label }); }
function publicSingleChoice(id, label, options) {
    return Object.freeze({ id, type: QUESTION_TYPES.SINGLE_CHOICE, label, required: true,
        options: Object.freeze(options) });
}
function publicConditionalDate(id, label, min, max, questionId, equals) {
    return Object.freeze({ id, type: QUESTION_TYPES.DATE, label, required: true, min, max,
        condition: Object.freeze({ questionId, equals }) });
}
function departureQuestions(recordedDates, min, max,
    label = 'Τι συνέβη πραγματικά με την αποχώρηση;') {
    return [
        publicSingleChoice('departureOutcome', label, [
            publicChoice(ANSWERS.DEPARTED_ON_FIRST_RECORDED_DATE,
                `Αποχώρησε στις ${greekDate(recordedDates[0])}`),
            publicChoice(ANSWERS.DEPARTED_ON_SECOND_RECORDED_DATE,
                `Αποχώρησε στις ${greekDate(recordedDates[1])}`),
            publicChoice(ANSWERS.DEPARTED_ON_OTHER_DATE,
                'Αποχώρησε σε άλλη ημερομηνία'),
            publicChoice(ANSWERS.NO_DEPARTURE, 'Δεν πραγματοποιήθηκε αποχώρηση')
        ]),
        publicConditionalDate('departureDate', 'Ημερομηνία αποχώρησης', min, max,
            'departureOutcome', ANSWERS.DEPARTED_ON_OTHER_DATE)
    ];
}
function payQuestions(currentPay, min, max) {
    return [
        publicSingleChoice('payEffectiveOutcome',
            `Από πότε ίσχυαν πραγματικά οι αποδοχές ${greekMoney(currentPay)};`, [
                publicChoice(ANSWERS.PAY_APPLIED_FROM_HIRE, 'Ίσχυαν από την πρόσληψη'),
                publicChoice(ANSWERS.PAY_APPLIED_FROM_OTHER_DATE,
                    'Ίσχυαν από μεταγενέστερη ημερομηνία')
            ]),
        publicConditionalDate('payEffectiveDate', 'Ημερομηνία έναρξης αποδοχών', min, max,
            'payEffectiveOutcome', ANSWERS.PAY_APPLIED_FROM_OTHER_DATE)
    ];
}
function basePlan({ scope, currentEmployee, completeHistoryRows, canonicalBefore,
    problemScope, asOfDate }) {
    return {
        version: BUSINESS_FACT_RESOLUTION_VERSION,
        status: PLAN_STATUSES.NOT_APPLICABLE,
        reason: canonicalBefore?.diagnostics?.reason || canonicalBefore?.status || 'NOT_APPLICABLE',
        operation: OPERATION,
        resolutionClass: RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED,
        resolutionKind: RESOLUTION_KIND,
        shapeKind: null,
        scope,
        factQuestions: [],
        internalResolutionRules: {},
        referenceClass: REFERENCE_CLASSES.UNKNOWN_REFERENCE,
        canonicalBefore,
        problemScope,
        asOfDate,
        diagnostics: {
            currentEmployeeId: currentEmployee?._id == null ? null : String(currentEmployee._id),
            completeHistoryIds: completeHistoryRows.map(historyId).sort()
        }
    };
}
function finish(plan, status, reason, additions = {}) {
    const result = { ...plan, ...additions, status, reason };
    result.questionSetFingerprint = fingerprint({
        version: result.version,
        resolutionClass: result.resolutionClass,
        resolutionKind: result.resolutionKind,
        shapeKind: result.shapeKind,
        factQuestions: result.factQuestions,
        internalResolutionRules: result.internalResolutionRules,
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
                byId, safe: false, reason: 'LIVE_REFERENCE_BLOCKS_FACT_RESOLUTION' };
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
function recordedDepartureDates(rows, currentEmployee) {
    const dates = [];
    for (const row of orderedRows(rows)) {
        const value = day(row[DEPARTURE_FIELD]);
        if (value && !dates.includes(value)) dates.push(value);
    }
    const current = day(currentEmployee?.[DEPARTURE_FIELD]);
    if (current && !dates.includes(current)) dates.push(current);
    return dates;
}

function planEmployeeHistoryBusinessFactResolution({ scope: rawScope, currentEmployee,
    completeHistoryRows = [], canonicalResult = null, problemScope = null,
    protectedReferenceSummary = {}, asOfDate,
    referencePartitioner = partitionHistoryUpdateReferences,
    canonicalizer = canonicalizeEmployeeHistory } = {}) {
    const scope = normalizedScope(rawScope);
    let normalizedAsOf = '';
    try { normalizedAsOf = day(asOfDate); } catch { normalizedAsOf = ''; }
    const canonicalBefore = canonicalResult || canonicalizer({ scope, currentEmployee,
        historyRows: completeHistoryRows });
    const resolvedProblemScope = problemScope || identifyEmployeeHistoryProblemScope({
        scope, currentEmployee, completeHistoryRows, canonicalizer });
    const plan = basePlan({ scope, currentEmployee, completeHistoryRows,
        canonicalBefore, problemScope: resolvedProblemScope, asOfDate: normalizedAsOf });
    if (!normalizedAsOf || !currentEmployee || !Array.isArray(completeHistoryRows) ||
        !completeHistoryRows.length || SCOPE_FIELDS.some(field => !scope[field] ||
            String(currentEmployee[field] ?? '') !== scope[field]) ||
        completeHistoryRows.some(row => !historyId(row) || SCOPE_FIELDS.some(field =>
            String(row[field] ?? '') !== scope[field])) ||
        new Set(completeHistoryRows.map(historyId)).size !== completeHistoryRows.length) {
        return blocked(plan, 'INVALID_OR_CONFLICTING_INPUT');
    }
    if (canonicalBefore.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY ||
        canonicalBefore.diagnostics?.reason !== 'AMBIGUOUS_LIFECYCLE_EVENTS' ||
        resolvedProblemScope.deterministicallyResolved !== true ||
        currentEmployee.energos !== true || !day(currentEmployee[DEPARTURE_FIELD])) {
        return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
            canonicalBefore.diagnostics?.reason || canonicalBefore.status);
    }
    const activeRows = completeHistoryRows.filter(row => !isPersistedReferencedRedundant(row));
    const hires = [...new Set([currentEmployee, ...activeRows]
        .map(row => day(row.hmeromhnia_proslhpshs)).filter(Boolean))];
    const departures = recordedDepartureDates(activeRows, currentEmployee);
    if (hires.length !== 1 || departures.length !== 2 ||
        !departures.includes(day(currentEmployee[DEPARTURE_FIELD])) ||
        departures.some(value => value < hires[0] || value > normalizedAsOf)) {
        return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
            'UNSUPPORTED_DEPARTURE_FACT_SHAPE');
    }
    const refs = referenceStateForRows(completeHistoryRows, protectedReferenceSummary,
        referencePartitioner);
    if (!refs.safe) return blocked({ ...plan, referenceClass: refs.referenceClass }, refs.reason,
        { referenceClass: refs.referenceClass, referenceState: refs.byId });

    const profileRows = activeRows.filter(row => effectiveStart(row) &&
        !isSparseHireLifecycleEvidence(row));
    if (profileRows.length < 2 || profileRows.some(row =>
        day(effectiveStart(row)) !== hires[0] ||
        (day(row[DEPARTURE_FIELD]) && !departures.includes(day(row[DEPARTURE_FIELD]))))) {
        return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
            'UNSUPPORTED_DEPARTURE_PROFILE_EVIDENCE');
    }
    if (new Set(profileRows.map(nonPayProfileFingerprint)).size !== 1) {
        return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
            'ADDITIONAL_BUSINESS_FACTS_REQUIRED');
    }
    const payGroups = new Map();
    for (const row of profileRows) {
        const key = payProfileFingerprint(row);
        if (!payGroups.has(key)) payGroups.set(key, []);
        payGroups.get(key).push(row);
    }
    const departureBase = departureQuestions(departures, hires[0], normalizedAsOf);
    const commonRules = {
        hireDate: hires[0],
        maximumFactDate: normalizedAsOf,
        recordedDepartureDates: [...departures],
        profileRowIds: profileRows.map(historyId).sort(),
        referenceState: refs.byId
    };
    if (payGroups.size === 1) {
        const currentProfileKey = payProfileFingerprint(currentEmployee);
        if (![...payGroups.keys()].includes(currentProfileKey)) {
            return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
                'CURRENT_PROFILE_NOT_CORROBORATED');
        }
        return finish({ ...plan,
            shapeKind: SHAPE_KINDS.COMPETING_DEPARTURE_DATES,
            factQuestions: departureBase,
            internalResolutionRules: {
                ...commonRules,
                strategy: 'RESOLVE_DEPARTURE_ONLY',
                preferredCurrentProfileId: historyId(latest(profileRows.filter(row =>
                    day(row[DEPARTURE_FIELD]) === day(currentEmployee[DEPARTURE_FIELD]))))
            },
            referenceClass: refs.referenceClass,
            diagnostics: { ...plan.diagnostics, hireDate: hires[0],
                recordedDepartureDates: departures, referenceState: refs.byId }
        }, PLAN_STATUSES.APPLICABLE, 'CONTROLLED_DEPARTURE_FACTS_REQUIRED');
    }
    if (payGroups.size !== 2) {
        return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
            'ADDITIONAL_BUSINESS_FACTS_REQUIRED');
    }
    const currentPayKey = payProfileFingerprint(currentEmployee);
    const currentPayRows = payGroups.get(currentPayKey) || [];
    const oldGroups = [...payGroups.entries()].filter(([key]) => key !== currentPayKey);
    if (currentPayRows.length !== 1 || oldGroups.length !== 1 ||
        oldGroups[0][1].length !== 2 || !day(currentPayRows[0][DEPARTURE_FIELD])) {
        return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
            'INCOMPLETE_PAY_EFFECTIVE_FACT_MODEL');
    }
    const oldRows = oldGroups[0][1];
    const oldOpenRows = oldRows.filter(row => !day(row[DEPARTURE_FIELD]));
    const oldDepartureRows = oldRows.filter(row => day(row[DEPARTURE_FIELD]));
    if (oldOpenRows.length !== 1 || oldDepartureRows.length !== 1 ||
        day(oldDepartureRows[0][DEPARTURE_FIELD]) ===
            day(currentPayRows[0][DEPARTURE_FIELD])) {
        return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
            'INCOMPLETE_PAY_EFFECTIVE_FACT_MODEL');
    }
    const currentPay = Number(currentEmployee.synolo_symbashs);
    if (!Number.isFinite(currentPay) || currentPay < 0 || hires[0] >= normalizedAsOf) {
        return blocked(plan, 'INVALID_PAY_FACT_BOUNDS');
    }
    return finish({ ...plan,
        shapeKind: SHAPE_KINDS.DEPARTURE_AND_PAY_EFFECTIVE_DATE,
        factQuestions: [...departureQuestions(departures, hires[0], normalizedAsOf,
            'Πότε αποχώρησε πραγματικά ο εργαζόμενος;'), ...payQuestions(currentPay,
            addDays(hires[0], 1), normalizedAsOf)],
        internalResolutionRules: {
            ...commonRules,
            strategy: 'RESOLVE_DEPARTURE_AND_PAY_EFFECTIVE_DATE',
            oldPayProfileId: historyId(oldOpenRows[0]),
            currentPayProfileId: historyId(currentPayRows[0]),
            currentPayAmount: currentPay
        },
        referenceClass: refs.referenceClass,
        diagnostics: { ...plan.diagnostics, hireDate: hires[0],
            recordedDepartureDates: departures, currentPay,
            referenceState: refs.byId }
    }, PLAN_STATUSES.APPLICABLE, 'CONTROLLED_DEPARTURE_AND_PAY_FACTS_REQUIRED');
}

function invalidFact(code = 'EMPLOYEE_HISTORY_RESOLUTION_INVALID_REQUEST') {
    const error = new Error(code);
    error.code = code;
    error.statusCode = 400;
    return error;
}
function strictDate(value, field) {
    try {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new TypeError('Exact calendar date required');
        }
        return day(C.calendarDate(value, field));
    } catch {
        throw invalidFact('EMPLOYEE_HISTORY_RESOLUTION_DATE_INVALID');
    }
}
function selectedFacts(plannerResult, answers) {
    const rules = plannerResult.internalResolutionRules;
    const expectedAnswerKeys = ['departureOutcome'];
    const departureOutcome = answers.departureOutcome;
    let departureDate = null;
    if (departureOutcome === ANSWERS.DEPARTED_ON_FIRST_RECORDED_DATE) {
        departureDate = rules.recordedDepartureDates[0];
    } else if (departureOutcome === ANSWERS.DEPARTED_ON_SECOND_RECORDED_DATE) {
        departureDate = rules.recordedDepartureDates[1];
    } else if (departureOutcome === ANSWERS.DEPARTED_ON_OTHER_DATE) {
        expectedAnswerKeys.push('departureDate');
        departureDate = strictDate(answers.departureDate, 'departureDate');
        if (rules.recordedDepartureDates.includes(departureDate)) throw invalidFact();
    } else if (departureOutcome !== ANSWERS.NO_DEPARTURE) {
        throw invalidFact();
    }
    if (departureDate && (departureDate < rules.hireDate ||
        departureDate > rules.maximumFactDate)) {
        throw invalidFact('EMPLOYEE_HISTORY_RESOLUTION_DATE_OUT_OF_RANGE');
    }
    let payEffectiveDate = null;
    if (plannerResult.shapeKind === SHAPE_KINDS.DEPARTURE_AND_PAY_EFFECTIVE_DATE) {
        expectedAnswerKeys.push('payEffectiveOutcome');
        if (answers.payEffectiveOutcome === ANSWERS.PAY_APPLIED_FROM_HIRE) {
            payEffectiveDate = rules.hireDate;
        } else if (answers.payEffectiveOutcome === ANSWERS.PAY_APPLIED_FROM_OTHER_DATE) {
            expectedAnswerKeys.push('payEffectiveDate');
            payEffectiveDate = strictDate(answers.payEffectiveDate, 'payEffectiveDate');
            if (payEffectiveDate <= rules.hireDate ||
                payEffectiveDate > rules.maximumFactDate) {
                throw invalidFact('EMPLOYEE_HISTORY_RESOLUTION_DATE_OUT_OF_RANGE');
            }
        } else {
            throw invalidFact();
        }
        if (departureDate && payEffectiveDate > departureDate) {
            throw invalidFact('EMPLOYEE_HISTORY_RESOLUTION_DATE_OUT_OF_RANGE');
        }
    }
    const actualAnswerKeys = Object.keys(answers).sort();
    expectedAnswerKeys.sort();
    if (actualAnswerKeys.length !== expectedAnswerKeys.length ||
        actualAnswerKeys.some((key, index) => key !== expectedAnswerKeys[index])) {
        throw invalidFact();
    }
    return { departureOutcome, departureDate,
        ...(payEffectiveDate ? { payEffectiveOutcome: answers.payEffectiveOutcome,
            payEffectiveDate } : {}) };
}
function strictClean(result) {
    return result?.status === CANONICAL_STATUSES.CLEAN && result.cleanupRequired === false &&
        result.idempotent === true && !(result.rowsToUpdate || []).length &&
        !(result.rowsToDelete || []).length && !(result.rowsToInsert || []).length &&
        !Object.keys(result.employeePatch || {}).length;
}

function resolveEmployeeHistoryBusinessFacts({ plannerResult, answers, currentEmployee,
    completeHistoryRows = [], canonicalizer = canonicalizeEmployeeHistory } = {}) {
    if (plannerResult?.status !== PLAN_STATUSES.APPLICABLE ||
        plannerResult?.operation !== OPERATION || !answers || typeof answers !== 'object' ||
        Array.isArray(answers) || Object.getPrototypeOf(answers) !== Object.prototype) {
        throw invalidFact();
    }
    const facts = selectedFacts(plannerResult, answers);
    const rules = plannerResult.internalResolutionRules;
    const sourceById = new Map(completeHistoryRows.map(row => [historyId(row), row]));
    let desired = completeHistoryRows.map(row => ({ ...row }));
    const desiredById = () => new Map(desired.map(row => [historyId(row), row]));
    const patch = (id, values) => {
        const row = desiredById().get(id);
        if (!row) throw invalidFact('EMPLOYEE_HISTORY_BUSINESS_FACT_INVALID_BOUNDARY');
        Object.assign(row, values);
    };
    const discard = (id, survivorId) => {
        const reference = rules.referenceState[id];
        if (!reference || !sourceById.has(id) || !sourceById.has(survivorId)) {
            throw invalidFact('EMPLOYEE_HISTORY_BUSINESS_FACT_INVALID_BOUNDARY');
        }
        if (plannerResult.referenceClass === REFERENCE_CLASSES.PROVENANCE_ONLY) {
            patch(id, { [REDUNDANT_STATUS_FIELD]: REDUNDANT_REFERENCED,
                [REDUNDANT_SURVIVOR_FIELD]: survivorId });
        } else {
            desired = desired.filter(row => historyId(row) !== id);
        }
    };
    const datePatch = value => value ? dateValue(value) : null;
    let survivorId;
    let currentStart = rules.hireDate;
    if (plannerResult.shapeKind === SHAPE_KINDS.COMPETING_DEPARTURE_DATES) {
        const profiles = rules.profileRowIds.map(id => sourceById.get(id)).filter(Boolean);
        const matching = facts.departureDate
            ? profiles.filter(row => day(row[DEPARTURE_FIELD]) === facts.departureDate)
            : profiles.filter(row => !day(row[DEPARTURE_FIELD]));
        survivorId = historyId(latest(matching) || sourceById.get(
            rules.preferredCurrentProfileId) || latest(profiles));
        if (!survivorId) throw invalidFact('EMPLOYEE_HISTORY_BUSINESS_FACT_INVALID_BOUNDARY');
        for (const id of rules.profileRowIds) if (id !== survivorId) discard(id, survivorId);
        patch(survivorId, {
            [START_FIELD]: dateValue(rules.hireDate),
            [END_FIELD]: datePatch(facts.departureDate),
            [DEPARTURE_FIELD]: datePatch(facts.departureDate)
        });
    } else if (plannerResult.shapeKind ===
        SHAPE_KINDS.DEPARTURE_AND_PAY_EFFECTIVE_DATE) {
        const oldId = rules.oldPayProfileId;
        const currentId = rules.currentPayProfileId;
        survivorId = currentId;
        currentStart = facts.payEffectiveDate;
        const retained = new Set(facts.payEffectiveDate === rules.hireDate
            ? [currentId] : [oldId, currentId]);
        for (const id of rules.profileRowIds) if (!retained.has(id)) discard(id, currentId);
        if (retained.has(oldId)) patch(oldId, {
            [START_FIELD]: dateValue(rules.hireDate),
            [END_FIELD]: dateValue(addDays(facts.payEffectiveDate, -1)),
            [DEPARTURE_FIELD]: null
        });
        patch(currentId, {
            [START_FIELD]: dateValue(facts.payEffectiveDate),
            [END_FIELD]: datePatch(facts.departureDate),
            [DEPARTURE_FIELD]: datePatch(facts.departureDate)
        });
    } else {
        throw invalidFact();
    }
    const currentPatch = {
        [DEPARTURE_FIELD]: datePatch(facts.departureDate),
        energos: !facts.departureDate,
        [START_FIELD]: dateValue(currentStart),
        [END_FIELD]: datePatch(facts.departureDate)
    };
    const proposedCurrent = { ...currentEmployee, ...currentPatch };
    const canonical = canonicalizer({ scope: plannerResult.scope,
        currentEmployee: proposedCurrent, historyRows: desired });
    if (!strictClean(canonical)) {
        const error = invalidFact('EMPLOYEE_HISTORY_BUSINESS_FACT_SIMULATION_FAILED');
        error.canonicalReason = canonical?.diagnostics?.reason || canonical?.status;
        throw error;
    }
    const second = canonicalizer({ scope: plannerResult.scope,
        currentEmployee: proposedCurrent, historyRows: desired });
    if (!strictClean(second) || stableStringify(second.canonicalRows) !==
        stableStringify(canonical.canonicalRows)) {
        throw invalidFact('EMPLOYEE_HISTORY_BUSINESS_FACT_SIMULATION_FAILED');
    }
    const diff = calculateCanonicalDiff(completeHistoryRows, desired);
    const physicalDeleteIds = diff.rowsToDelete.map(item => item.historyId).sort();
    if ((physicalDeleteIds.length &&
        plannerResult.referenceClass !== REFERENCE_CLASSES.NO_REFERENCES) ||
        physicalDeleteIds.some(id => rules.referenceState[id]?.count !== 0)) {
        throw invalidFact('EMPLOYEE_HISTORY_BUSINESS_FACT_INVALID_BOUNDARY');
    }
    const historyPatches = Object.fromEntries(diff.rowsToUpdate.map(item =>
        [item.historyId, item.patch]));
    const execution = {
        version: BUSINESS_FACT_RESOLUTION_VERSION,
        status: PLAN_STATUSES.APPLICABLE,
        reason: 'COLLECTED_BUSINESS_FACTS_PRODUCE_CLEAN_HISTORY',
        operation: OPERATION,
        resolutionClass: RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED,
        resolutionKind: RESOLUTION_KIND,
        shapeKind: plannerResult.shapeKind,
        normalizedAnswers: { ...facts },
        currentPatch,
        desiredHistoryRows: desired,
        historyPatches,
        changedHistoryIds: diff.rowsToUpdate.map(item => item.historyId).sort(),
        physicalDeleteIds,
        insertedRows: diff.rowsToInsert,
        replacementByDeletedId: Object.fromEntries(physicalDeleteIds.map(id => [id, survivorId])),
        referenceClass: plannerResult.referenceClass,
        referenceClassifications: rules.referenceState,
        affectedStableIds: [...new Set([
            ...diff.rowsToUpdate.map(item => item.historyId), ...physicalDeleteIds
        ])].sort(),
        hypotheticalCanonicalResult: canonical,
        secondCanonicalResult: second
    };
    execution.planFingerprint = fingerprint(execution);
    return execution;
}

module.exports = {
    BUSINESS_FACT_RESOLUTION_VERSION,
    OPERATION,
    RESOLUTION_KIND,
    PLAN_STATUSES,
    SHAPE_KINDS,
    QUESTION_TYPES,
    ANSWERS,
    PAY_FIELDS,
    START_FIELD,
    END_FIELD,
    DEPARTURE_FIELD,
    stableValue,
    fingerprint,
    planEmployeeHistoryBusinessFactResolution,
    resolveEmployeeHistoryBusinessFacts
};
