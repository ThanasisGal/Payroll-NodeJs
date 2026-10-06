'use strict';

const crypto = require('node:crypto');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { CANONICAL_STATUSES } = require('./employeeHistoryCanonicalizationService');

const RESOLUTION_ANALYSIS_VERSION = 'employee-history-resolution-analysis:v1';
const RESOLUTION_CLASSES = Object.freeze({
    UNIQUE_SAFE_PLAN: 'UNIQUE_SAFE_PLAN',
    MULTIPLE_SAFE_BUSINESS_PLANS: 'MULTIPLE_SAFE_BUSINESS_PLANS',
    BUSINESS_FACT_REQUIRED: 'BUSINESS_FACT_REQUIRED',
    ADMIN_REVIEW_REQUIRED: 'ADMIN_REVIEW_REQUIRED',
    FALSE_POSITIVE_OR_ALREADY_RESOLVABLE: 'FALSE_POSITIVE_OR_ALREADY_RESOLVABLE'
});
const REFERENCE_CLASSES = Object.freeze({
    NO_REFERENCES: 'NO_REFERENCES',
    PROVENANCE_ONLY: 'PROVENANCE_ONLY',
    LIVE_REFERENCE: 'LIVE_REFERENCE',
    UNKNOWN_REFERENCE: 'UNKNOWN_REFERENCE'
});
const UNIQUE_SAFE_REPAIR_CONTRACT_VERSION = 1;
const UNIQUE_SAFE_REPAIR_KIND = 'UNIQUE_SAFE_REPAIR';
const UNIQUE_SAFE_REPAIR_ACTION = 'APPLY_UNIQUE_SAFE_PLAN';
const UNIQUE_SAFE_REPAIR_TITLE = 'Βρέθηκε ασυνέπεια στο ιστορικό';
const UNIQUE_SAFE_REPAIR_EXPLANATION =
    'Η ασυνέπεια μπορεί να τακτοποιηθεί με ασφάλεια χωρίς να αλλάξει η πραγματική εργασιακή σχέση.';
const GUIDED_BUSINESS_CHOICE_CONTRACT_VERSION = 1;
const GUIDED_BUSINESS_CHOICE_KIND = 'GUIDED_BUSINESS_CHOICE';
const GUIDED_BUSINESS_CHOICE_TITLE = 'Χρειάζεται επιβεβαίωση του ιστορικού';
const GUIDED_BUSINESS_CHOICE_EXPLANATION =
    'Υπάρχουν περισσότερες από μία ασφαλείς ερμηνείες. Επιλέξτε τι συνέβη πραγματικά.';
const BUSINESS_FACT_COLLECTION_CONTRACT_VERSION = 1;
const BUSINESS_FACT_COLLECTION_KIND = 'BUSINESS_FACT_COLLECTION';
const BUSINESS_FACT_COLLECTION_TITLE = 'Χρειάζονται πραγματικά στοιχεία για το ιστορικό';
const BUSINESS_FACT_COLLECTION_EXPLANATION =
    'Το υπάρχον ιστορικό περιέχει αντικρουόμενα στοιχεία. Επιβεβαιώστε τι συνέβη πραγματικά.';

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
    if (typeof value.toHexString === 'function') return value.toHexString();
    return Object.fromEntries(Object.keys(value).sort()
        .map(key => [key, stableValue(value[key])]));
}

function containsPhysicalRowIdentity(value) {
    if (Array.isArray(value)) return value.some(containsPhysicalRowIdentity);
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, nested]) =>
        /(?:^_id$|historyIds?$|rowIds?$)/i.test(key) ||
        containsPhysicalRowIdentity(nested));
}

function buildFingerprint(payload) {
    return crypto.createHash('sha256')
        .update(JSON.stringify(stableValue(payload)))
        .digest('hex');
}

function buildEmployeeHistoryResolutionAnalysis({ resolutionClass, reason,
    candidateBusinessPlans = [], missingBusinessFacts = [],
    referenceClass = REFERENCE_CLASSES.UNKNOWN_REFERENCE,
    hypotheticalCanonicalResult = null, sourceStateFingerprint = null,
    resolutionKind = null, title = null, explanation = null, action = null } = {}) {
    if (!Object.values(RESOLUTION_CLASSES).includes(resolutionClass)) {
        throw new TypeError('Unknown employee-history resolution class');
    }
    if (!String(reason || '').trim()) throw new TypeError('Resolution reason is required');
    if (!Object.values(REFERENCE_CLASSES).includes(referenceClass)) {
        throw new TypeError('Unknown employee-history reference class');
    }
    if (!Array.isArray(candidateBusinessPlans) || !Array.isArray(missingBusinessFacts)) {
        throw new TypeError('Resolution plans and missing facts must be arrays');
    }
    if (containsPhysicalRowIdentity(candidateBusinessPlans)) {
        throw new TypeError('Business resolution options cannot expose physical history-row identities');
    }

    const payload = {
        version: RESOLUTION_ANALYSIS_VERSION,
        resolutionClass,
        reason: String(reason).trim(),
        candidateBusinessPlans: stableValue(candidateBusinessPlans),
        missingBusinessFacts: stableValue(missingBusinessFacts),
        referenceClass,
        ...(resolutionKind ? { resolutionKind: String(resolutionKind) } : {}),
        ...(title ? { title: String(title) } : {}),
        ...(explanation ? { explanation: String(explanation) } : {}),
        ...(action ? { action: String(action) } : {}),
        sourceStateFingerprint: sourceStateFingerprint == null
            ? null : String(sourceStateFingerprint),
        hypotheticalCanonicalResult: hypotheticalCanonicalResult
            ? stableValue(hypotheticalCanonicalResult) : null
    };
    return Object.freeze({ ...payload, fingerprint: buildFingerprint(payload) });
}

function buildUniqueSafeRepairStateFingerprint({ scope, currentEmployee,
    completeHistoryRows = [], protectedReferenceSummary = {}, repairPlan,
    normalizedSaveRequest = {} } = {}) {
    if (repairPlan?.status !== 'APPLICABLE' || repairPlan?.operation !==
        'EMPLOYEE_HISTORY_UNIQUE_SAFE_REPAIR') {
        throw new TypeError('Applicable unique-safe repair plan required');
    }
    return buildFingerprint({
        contract: 'employee-history-unique-safe-repair-confirmation:v1',
        scope,
        employee: currentEmployee,
        completeHistory: completeHistoryRows,
        referenceState: protectedReferenceSummary,
        exactRepairPlan: repairPlan,
        normalizedSaveRequest
    });
}

function buildMultipleSafeResolutionStateFingerprint({ scope, currentEmployee,
    completeHistoryRows = [], protectedReferenceSummary = {}, canonicalResult,
    problemScope, multiplePlan, normalizedSaveRequest = {} } = {}) {
    if (multiplePlan?.status !== 'APPLICABLE' ||
        multiplePlan?.resolutionClass !== RESOLUTION_CLASSES.MULTIPLE_SAFE_BUSINESS_PLANS ||
        !Array.isArray(multiplePlan.businessOptions) || multiplePlan.businessOptions.length < 2) {
        throw new TypeError('Applicable multiple-safe resolution plan required');
    }
    return buildFingerprint({
        contract: 'employee-history-guided-business-choice-confirmation:v1',
        scope,
        employee: currentEmployee,
        completeHistory: completeHistoryRows,
        referenceState: protectedReferenceSummary,
        currentAmbiguity: canonicalSourceStateFingerprint(canonicalResult),
        problemScope,
        exactServerPlan: multiplePlan,
        exactOptionSet: multiplePlan.businessOptions,
        normalizedSaveRequest
    });
}

function buildBusinessFactResolutionStateFingerprint({ scope, currentEmployee,
    completeHistoryRows = [], protectedReferenceSummary = {}, canonicalResult,
    problemScope, businessFactPlan, normalizedSaveRequest = {} } = {}) {
    if (businessFactPlan?.status !== 'APPLICABLE' ||
        businessFactPlan?.resolutionClass !== RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED ||
        businessFactPlan?.resolutionKind !== BUSINESS_FACT_COLLECTION_KIND ||
        !Array.isArray(businessFactPlan.factQuestions) || !businessFactPlan.factQuestions.length) {
        throw new TypeError('Applicable business-fact resolution plan required');
    }
    return buildFingerprint({
        contract: 'employee-history-business-fact-collection-confirmation:v1',
        scope,
        employee: currentEmployee,
        completeHistory: completeHistoryRows,
        referenceState: protectedReferenceSummary,
        currentAmbiguity: canonicalSourceStateFingerprint(canonicalResult),
        problemScope,
        exactServerRules: businessFactPlan.internalResolutionRules,
        exactQuestionSet: businessFactPlan.factQuestions,
        exactServerPlan: businessFactPlan,
        normalizedSaveRequest
    });
}

function buildUniqueSafeRepairResolutionAnalysis({ repairPlan,
    sourceStateFingerprint } = {}) {
    if (repairPlan?.status !== 'APPLICABLE' || !sourceStateFingerprint) return null;
    if (![REFERENCE_CLASSES.NO_REFERENCES, REFERENCE_CLASSES.PROVENANCE_ONLY]
        .includes(repairPlan.referenceClass) || repairPlan.physicalDeleteIds?.length ||
        repairPlan.insertedRows?.length ||
        repairPlan.hypotheticalCanonicalResult?.status !== CANONICAL_STATUSES.CLEAN) return null;
    return buildEmployeeHistoryResolutionAnalysis({
        resolutionClass: RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN,
        resolutionKind: 'SAFE_HISTORY_REPAIR',
        reason: repairPlan.reason,
        title: UNIQUE_SAFE_REPAIR_TITLE,
        explanation: UNIQUE_SAFE_REPAIR_EXPLANATION,
        action: UNIQUE_SAFE_REPAIR_ACTION,
        candidateBusinessPlans: [{
            id: UNIQUE_SAFE_REPAIR_ACTION,
            businessMeaning: 'PRESERVE_REAL_EMPLOYMENT_RELATIONSHIP',
            mutationKind: 'SAFE_HISTORY_REPAIR'
        }],
        missingBusinessFacts: [],
        referenceClass: repairPlan.referenceClass,
        sourceStateFingerprint,
        hypotheticalCanonicalResult: {
            status: CANONICAL_STATUSES.CLEAN,
            reason: 'CANONICAL_CLEAN',
            blocksOrdinaryMaintenance: false
        }
    });
}

function buildUniqueSafeRepairPublicResolution({ analysis, fingerprint } = {}) {
    if (analysis?.resolutionClass !== RESOLUTION_CLASSES.UNIQUE_SAFE_PLAN ||
        analysis?.action !== UNIQUE_SAFE_REPAIR_ACTION ||
        !/^[a-f0-9]{64}$/.test(String(fingerprint || ''))) {
        throw new TypeError('Valid unique-safe resolution analysis and fingerprint required');
    }
    return Object.freeze({
        version: UNIQUE_SAFE_REPAIR_CONTRACT_VERSION,
        kind: UNIQUE_SAFE_REPAIR_KIND,
        title: UNIQUE_SAFE_REPAIR_TITLE,
        explanation: UNIQUE_SAFE_REPAIR_EXPLANATION,
        options: Object.freeze([Object.freeze({
            id: UNIQUE_SAFE_REPAIR_ACTION,
            label: 'Τακτοποίηση ιστορικού',
            description: 'Η εφαρμογή θα διορθώσει μόνο τις αποδεδειγμένα ασυνεπείς ιστορικές εγγραφές.'
        })]),
        fingerprint: String(fingerprint)
    });
}

function validatePublicBusinessOptions(options) {
    if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
        throw new TypeError('Guided business options must contain 2..10 entries');
    }
    const ids = new Set();
    return options.map(option => {
        if (!option || typeof option !== 'object' || Array.isArray(option) ||
            !/^[A-Z0-9_]{3,100}$/.test(String(option.id || '')) ||
            !String(option.label || '').trim() || !String(option.description || '').trim()) {
            throw new TypeError('Invalid guided business option');
        }
        const allowed = new Set(['id', 'label', 'description', 'inputs']);
        if (Object.keys(option).some(key => !allowed.has(key)) || ids.has(option.id)) {
            throw new TypeError('Unsafe guided business option');
        }
        ids.add(option.id);
        const result = { id: String(option.id), label: String(option.label),
            description: String(option.description) };
        if (option.inputs !== undefined) {
            if (!Array.isArray(option.inputs) || option.inputs.length !== 1) {
                throw new TypeError('Only one guided input is supported');
            }
            const input = option.inputs[0];
            const inputKeys = Object.keys(input || {}).sort();
            if (inputKeys.join(',') !== 'id,label,max,min,required,type' ||
                input.id !== 'effectiveDate' || input.type !== 'date' ||
                input.required !== true || !String(input.label || '').trim()) {
                throw new TypeError('Invalid guided date input');
            }
            const min = C.calendarDate(input.min, 'min').toISOString().slice(0, 10);
            const max = C.calendarDate(input.max, 'max').toISOString().slice(0, 10);
            if (min > max) throw new TypeError('Invalid guided date bounds');
            result.inputs = [{ id: 'effectiveDate', type: 'date',
                label: String(input.label), required: true, min, max }];
        }
        return Object.freeze(result);
    });
}

function buildMultipleSafeResolutionAnalysis({ multiplePlan,
    sourceStateFingerprint } = {}) {
    if (multiplePlan?.status !== 'APPLICABLE' || !sourceStateFingerprint ||
        multiplePlan.resolutionClass !== RESOLUTION_CLASSES.MULTIPLE_SAFE_BUSINESS_PLANS ||
        ![REFERENCE_CLASSES.NO_REFERENCES, REFERENCE_CLASSES.PROVENANCE_ONLY]
            .includes(multiplePlan.referenceClass)) return null;
    const options = validatePublicBusinessOptions(multiplePlan.businessOptions);
    return buildEmployeeHistoryResolutionAnalysis({
        resolutionClass: RESOLUTION_CLASSES.MULTIPLE_SAFE_BUSINESS_PLANS,
        resolutionKind: GUIDED_BUSINESS_CHOICE_KIND,
        reason: multiplePlan.reason,
        title: GUIDED_BUSINESS_CHOICE_TITLE,
        explanation: GUIDED_BUSINESS_CHOICE_EXPLANATION,
        candidateBusinessPlans: options,
        missingBusinessFacts: [],
        referenceClass: multiplePlan.referenceClass,
        sourceStateFingerprint,
        hypotheticalCanonicalResult: {
            status: 'CHOICE_REQUIRED',
            reason: multiplePlan.shapeKind,
            blocksOrdinaryMaintenance: true
        }
    });
}

function buildMultipleSafePublicResolution({ analysis, fingerprint } = {}) {
    if (analysis?.resolutionClass !== RESOLUTION_CLASSES.MULTIPLE_SAFE_BUSINESS_PLANS ||
        analysis?.resolutionKind !== GUIDED_BUSINESS_CHOICE_KIND ||
        !/^[a-f0-9]{64}$/.test(String(fingerprint || ''))) {
        throw new TypeError('Valid multiple-safe resolution analysis and fingerprint required');
    }
    return Object.freeze({
        version: GUIDED_BUSINESS_CHOICE_CONTRACT_VERSION,
        kind: GUIDED_BUSINESS_CHOICE_KIND,
        title: GUIDED_BUSINESS_CHOICE_TITLE,
        explanation: GUIDED_BUSINESS_CHOICE_EXPLANATION,
        options: Object.freeze(validatePublicBusinessOptions(analysis.candidateBusinessPlans)),
        fingerprint: String(fingerprint)
    });
}

const FACT_QUESTION_IDS = Object.freeze([
    'departureOutcome', 'departureDate', 'payEffectiveOutcome', 'payEffectiveDate'
]);
const FACT_ANSWER_IDS = Object.freeze({
    departureOutcome: [
        'DEPARTED_ON_FIRST_RECORDED_DATE',
        'DEPARTED_ON_SECOND_RECORDED_DATE',
        'DEPARTED_ON_OTHER_DATE',
        'NO_DEPARTURE'
    ],
    payEffectiveOutcome: ['PAY_APPLIED_FROM_HIRE', 'PAY_APPLIED_FROM_OTHER_DATE']
});

function exactKeys(value, expected) {
    const keys = Object.keys(value || {}).sort();
    const sorted = [...expected].sort();
    return keys.length === sorted.length && keys.every((key, index) => key === sorted[index]);
}

function validatePublicFactQuestions(questions) {
    if (!Array.isArray(questions) || ![2, 4].includes(questions.length)) {
        throw new TypeError('Business-fact questions must contain one or two controlled pairs');
    }
    const expectedOrder = questions.length === 2
        ? ['departureOutcome', 'departureDate']
        : ['departureOutcome', 'departureDate', 'payEffectiveOutcome', 'payEffectiveDate'];
    if (questions.some((question, index) => question?.id !== expectedOrder[index])) {
        throw new TypeError('Unexpected business-fact question order');
    }
    return questions.map(question => {
        if (!question || typeof question !== 'object' || Array.isArray(question) ||
            !FACT_QUESTION_IDS.includes(question.id) || !String(question.label || '').trim() ||
            question.required !== true) throw new TypeError('Invalid business-fact question');
        if (question.type === 'SINGLE_CHOICE') {
            if (!exactKeys(question, ['id', 'type', 'label', 'required', 'options']) ||
                !Array.isArray(question.options)) throw new TypeError('Invalid fact choice question');
            const expectedOptions = FACT_ANSWER_IDS[question.id];
            if (!expectedOptions || question.options.length !== expectedOptions.length ||
                question.options.some((option, index) =>
                    !exactKeys(option, ['id', 'label']) || option.id !== expectedOptions[index] ||
                    !String(option.label || '').trim())) {
                throw new TypeError('Invalid fact answer options');
            }
            return Object.freeze({ id: question.id, type: 'SINGLE_CHOICE',
                label: String(question.label), required: true,
                options: Object.freeze(question.options.map(option => Object.freeze({
                    id: option.id, label: String(option.label)
                }))) });
        }
        if (question.type !== 'DATE' ||
            !exactKeys(question, ['condition', 'id', 'label', 'max', 'min', 'required', 'type']) ||
            !exactKeys(question.condition, ['equals', 'questionId'])) {
            throw new TypeError('Invalid fact date question');
        }
        const expectedCondition = question.id === 'departureDate'
            ? { questionId: 'departureOutcome', equals: 'DEPARTED_ON_OTHER_DATE' }
            : question.id === 'payEffectiveDate'
                ? { questionId: 'payEffectiveOutcome', equals: 'PAY_APPLIED_FROM_OTHER_DATE' }
                : null;
        if (!expectedCondition || question.condition.questionId !== expectedCondition.questionId ||
            question.condition.equals !== expectedCondition.equals) {
            throw new TypeError('Invalid fact date condition');
        }
        const min = C.calendarDate(question.min, 'min').toISOString().slice(0, 10);
        const max = C.calendarDate(question.max, 'max').toISOString().slice(0, 10);
        if (min > max) throw new TypeError('Invalid fact date bounds');
        return Object.freeze({ id: question.id, type: 'DATE', label: String(question.label),
            required: true, min, max, condition: Object.freeze(expectedCondition) });
    });
}

function buildBusinessFactResolutionAnalysis({ businessFactPlan,
    sourceStateFingerprint } = {}) {
    if (businessFactPlan?.status !== 'APPLICABLE' || !sourceStateFingerprint ||
        businessFactPlan.resolutionClass !== RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED ||
        businessFactPlan.resolutionKind !== BUSINESS_FACT_COLLECTION_KIND ||
        ![REFERENCE_CLASSES.NO_REFERENCES, REFERENCE_CLASSES.PROVENANCE_ONLY]
            .includes(businessFactPlan.referenceClass)) return null;
    const questions = validatePublicFactQuestions(businessFactPlan.factQuestions);
    return buildEmployeeHistoryResolutionAnalysis({
        resolutionClass: RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED,
        resolutionKind: BUSINESS_FACT_COLLECTION_KIND,
        reason: businessFactPlan.reason,
        title: BUSINESS_FACT_COLLECTION_TITLE,
        explanation: BUSINESS_FACT_COLLECTION_EXPLANATION,
        candidateBusinessPlans: [],
        missingBusinessFacts: questions,
        referenceClass: businessFactPlan.referenceClass,
        sourceStateFingerprint,
        hypotheticalCanonicalResult: {
            status: 'FACTS_REQUIRED',
            reason: businessFactPlan.shapeKind,
            blocksOrdinaryMaintenance: true
        }
    });
}

function buildBusinessFactPublicResolution({ analysis, fingerprint } = {}) {
    if (analysis?.resolutionClass !== RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED ||
        analysis?.resolutionKind !== BUSINESS_FACT_COLLECTION_KIND ||
        !/^[a-f0-9]{64}$/.test(String(fingerprint || ''))) {
        throw new TypeError('Valid business-fact resolution analysis and fingerprint required');
    }
    return Object.freeze({
        version: BUSINESS_FACT_COLLECTION_CONTRACT_VERSION,
        kind: BUSINESS_FACT_COLLECTION_KIND,
        title: BUSINESS_FACT_COLLECTION_TITLE,
        explanation: BUSINESS_FACT_COLLECTION_EXPLANATION,
        questions: Object.freeze(validatePublicFactQuestions(analysis.missingBusinessFacts)),
        fingerprint: String(fingerprint)
    });
}

function resolutionRequestError(code = 'EMPLOYEE_HISTORY_RESOLUTION_INVALID_REQUEST') {
    const error = new Error(code);
    error.code = code;
    error.statusCode = 400;
    return error;
}

function normalizeUniqueSafeRepairConfirmation(value) {
    if (value == null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.getPrototypeOf(value) !== Object.prototype) throw resolutionRequestError();
    const keys = Object.keys(value).sort();
    if (keys.length !== 2 || keys[0] !== 'choiceId' || keys[1] !== 'fingerprint' ||
        value.choiceId !== UNIQUE_SAFE_REPAIR_ACTION ||
        !/^[a-f0-9]{64}$/.test(String(value.fingerprint || ''))) {
        throw resolutionRequestError();
    }
    return Object.freeze({ choiceId: UNIQUE_SAFE_REPAIR_ACTION,
        fingerprint: String(value.fingerprint) });
}

function normalizeEmployeeHistoryResolutionConfirmation(value) {
    if (value == null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.getPrototypeOf(value) !== Object.prototype) throw resolutionRequestError();
    const keys = Object.keys(value).sort();
    const guided = [['choiceId', 'fingerprint'], ['answers', 'choiceId', 'fingerprint']]
        .some(expected => expected.length === keys.length &&
            expected.every((key, index) => key === keys[index]));
    const fact = keys.length === 2 && keys[0] === 'answers' && keys[1] === 'fingerprint';
    if ((!guided && !fact) || !/^[a-f0-9]{64}$/.test(String(value.fingerprint || '')) ||
        (guided && !/^[A-Z0-9_]{3,100}$/.test(String(value.choiceId || '')))) {
        throw resolutionRequestError();
    }
    if (guided && Object.hasOwn(value, 'answers')) {
        const answers = value.answers;
        if (!answers || typeof answers !== 'object' || Array.isArray(answers) ||
            Object.getPrototypeOf(answers) !== Object.prototype ||
            Object.keys(answers).some(key => key !== 'effectiveDate')) {
            throw resolutionRequestError();
        }
    }
    if (fact) {
        const answers = value.answers;
        if (!answers || typeof answers !== 'object' || Array.isArray(answers) ||
            Object.getPrototypeOf(answers) !== Object.prototype ||
            !Object.keys(answers).length || Object.keys(answers).some(key =>
                !FACT_QUESTION_IDS.includes(key) || typeof answers[key] !== 'string')) {
            throw resolutionRequestError();
        }
        return Object.freeze({ fingerprint: String(value.fingerprint),
            answers: Object.freeze({ ...answers }) });
    }
    return Object.freeze({ choiceId: String(value.choiceId), fingerprint: String(value.fingerprint),
        ...(Object.hasOwn(value, 'answers') ? { answers: Object.freeze({ ...value.answers }) } : {}) });
}

function normalizeMultipleSafeResolutionConfirmation(value, businessOptions) {
    const normalized = normalizeEmployeeHistoryResolutionConfirmation(value);
    if (!normalized) return null;
    const options = validatePublicBusinessOptions(businessOptions);
    const selected = options.find(option => option.id === normalized.choiceId);
    if (!selected) throw resolutionRequestError();
    const input = selected.inputs?.[0];
    if (!input) {
        if (Object.hasOwn(normalized, 'answers')) throw resolutionRequestError();
        return normalized;
    }
    if (!normalized.answers || Object.keys(normalized.answers).length !== 1 ||
        !Object.hasOwn(normalized.answers, input.id)) throw resolutionRequestError();
    let effectiveDate;
    try {
        if (typeof normalized.answers.effectiveDate !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(normalized.answers.effectiveDate)) {
            throw new TypeError('Exact calendar date required');
        }
        effectiveDate = C.calendarDate(normalized.answers.effectiveDate,
            'effectiveDate').toISOString().slice(0, 10);
    } catch {
        throw resolutionRequestError('EMPLOYEE_HISTORY_RESOLUTION_DATE_INVALID');
    }
    if (effectiveDate < input.min || effectiveDate > input.max) {
        throw resolutionRequestError('EMPLOYEE_HISTORY_RESOLUTION_DATE_OUT_OF_RANGE');
    }
    return Object.freeze({ ...normalized,
        answers: Object.freeze({ effectiveDate }) });
}

function normalizeBusinessFactResolutionConfirmation(value, factQuestions) {
    const normalized = normalizeEmployeeHistoryResolutionConfirmation(value);
    if (!normalized || Object.hasOwn(normalized, 'choiceId')) throw resolutionRequestError();
    const questions = validatePublicFactQuestions(factQuestions);
    const answers = normalized.answers;
    const expectedKeys = [];
    for (const question of questions) {
        if (question.type === 'SINGLE_CHOICE') {
            if (!question.options.some(option => option.id === answers[question.id])) {
                throw resolutionRequestError();
            }
            expectedKeys.push(question.id);
            continue;
        }
        if (answers[question.condition.questionId] !== question.condition.equals) continue;
        const raw = answers[question.id];
        let date;
        try {
            if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                throw new TypeError('Exact calendar date required');
            }
            date = C.calendarDate(raw, question.id).toISOString().slice(0, 10);
        } catch {
            throw resolutionRequestError('EMPLOYEE_HISTORY_RESOLUTION_DATE_INVALID');
        }
        if (date < question.min || date > question.max) {
            throw resolutionRequestError('EMPLOYEE_HISTORY_RESOLUTION_DATE_OUT_OF_RANGE');
        }
        expectedKeys.push(question.id);
    }
    if (!exactKeys(answers, expectedKeys)) throw resolutionRequestError();
    return Object.freeze({ fingerprint: normalized.fingerprint,
        answers: Object.freeze(Object.fromEntries(expectedKeys.map(key => [key, answers[key]]))) });
}

function canonicalSourceStateFingerprint(canonicalResult = {}) {
    return buildFingerprint({
        status: canonicalResult.status || null,
        canonicalRows: canonicalResult.canonicalRows || [],
        rowsToUpdate: canonicalResult.rowsToUpdate || [],
        rowsToDelete: canonicalResult.rowsToDelete || [],
        rowsToInsert: canonicalResult.rowsToInsert || [],
        employeePatch: canonicalResult.employeePatch || {},
        diagnostics: canonicalResult.diagnostics || {}
    });
}

function analyzeCanonicalLegacyAliasResolution({ canonicalResult,
    referenceClass = REFERENCE_CLASSES.UNKNOWN_REFERENCE } = {}) {
    const collapsedGroups = canonicalResult?.diagnostics?.collapsedGroups || [];
    const exclusivelyLegacyAliasNormalization = collapsedGroups.length > 0 &&
        collapsedGroups.every(group =>
            group.normalizationReason === 'INVALID_LEGACY_EMPLOYMENT_TYPE_ALIAS');
    const deterministicRemovalOnly = canonicalResult?.status === CANONICAL_STATUSES.AUTO_REPAIRABLE &&
        canonicalResult.rowsToDelete?.length > 0 &&
        canonicalResult.rowsToUpdate?.length === 0 &&
        canonicalResult.rowsToInsert?.length === 0 &&
        Object.keys(canonicalResult.employeePatch || {}).length === 0;

    if (referenceClass !== REFERENCE_CLASSES.NO_REFERENCES ||
        !exclusivelyLegacyAliasNormalization || !deterministicRemovalOnly) return null;

    return buildEmployeeHistoryResolutionAnalysis({
        resolutionClass: RESOLUTION_CLASSES.FALSE_POSITIVE_OR_ALREADY_RESOLVABLE,
        reason: 'INVALID_LEGACY_EMPLOYMENT_TYPE_ALIAS_NORMALIZED',
        candidateBusinessPlans: [{
            id: 'PRESERVE_CANONICAL_EMPLOYMENT_PROFILE',
            businessMeaning: 'PRESERVE_AUTHORITATIVE_PROFILE_AND_REMOVE_REDUNDANT_ARTIFACT',
            mutationKind: 'REDUNDANT_ARTIFACT_REMOVAL'
        }],
        missingBusinessFacts: [],
        referenceClass,
        sourceStateFingerprint: canonicalSourceStateFingerprint(canonicalResult),
        hypotheticalCanonicalResult: {
            status: CANONICAL_STATUSES.CLEAN,
            reason: 'CANONICAL_CLEAN',
            blocksOrdinaryMaintenance: false
        }
    });
}

module.exports = {
    RESOLUTION_ANALYSIS_VERSION,
    RESOLUTION_CLASSES,
    REFERENCE_CLASSES,
    UNIQUE_SAFE_REPAIR_CONTRACT_VERSION,
    UNIQUE_SAFE_REPAIR_KIND,
    UNIQUE_SAFE_REPAIR_ACTION,
    UNIQUE_SAFE_REPAIR_TITLE,
    UNIQUE_SAFE_REPAIR_EXPLANATION,
    GUIDED_BUSINESS_CHOICE_CONTRACT_VERSION,
    GUIDED_BUSINESS_CHOICE_KIND,
    GUIDED_BUSINESS_CHOICE_TITLE,
    GUIDED_BUSINESS_CHOICE_EXPLANATION,
    BUSINESS_FACT_COLLECTION_CONTRACT_VERSION,
    BUSINESS_FACT_COLLECTION_KIND,
    BUSINESS_FACT_COLLECTION_TITLE,
    BUSINESS_FACT_COLLECTION_EXPLANATION,
    canonicalSourceStateFingerprint,
    buildEmployeeHistoryResolutionAnalysis,
    analyzeCanonicalLegacyAliasResolution,
    buildUniqueSafeRepairStateFingerprint,
    buildMultipleSafeResolutionStateFingerprint,
    buildBusinessFactResolutionStateFingerprint,
    buildUniqueSafeRepairResolutionAnalysis,
    buildMultipleSafeResolutionAnalysis,
    buildBusinessFactResolutionAnalysis,
    buildUniqueSafeRepairPublicResolution,
    buildMultipleSafePublicResolution,
    buildBusinessFactPublicResolution,
    normalizeUniqueSafeRepairConfirmation,
    normalizeEmployeeHistoryResolutionConfirmation,
    normalizeMultipleSafeResolutionConfirmation,
    normalizeBusinessFactResolutionConfirmation,
    validatePublicBusinessOptions,
    validatePublicFactQuestions
};
