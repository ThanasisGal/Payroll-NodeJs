'use strict';

const crypto = require('node:crypto');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const { BASE_HISTORY_FIELDS, buildCompleteProfileSnapshot, effectiveStart, effectiveEnd } =
    require('../../utils/ergazomenoi/employmentProfileHistory');
const { REDUNDANT_STATUS_FIELD, REDUNDANT_SURVIVOR_FIELD, REDUNDANT_REFERENCED,
    isPersistedReferencedRedundant } =
    require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { CANONICAL_STATUSES, PROFILE_EQUIVALENCE_FIELDS, calculateCanonicalDiff,
    canonicalizeEmployeeHistory } =
    require('./employeeHistoryCanonicalizationService');
const { identifyEmployeeHistoryProblemScope } =
    require('./employeeHistoryProblemScopeService');
const { partitionHistoryUpdateReferences } =
    require('./employeeHistoryReferenceSemanticsService');
const { RESOLUTION_CLASSES, REFERENCE_CLASSES } =
    require('./employeeHistoryResolutionAnalysisService');
const { REGISTRY_VERSION, CORRECTION_FIELD_REGISTRY, registryEntry,
    registryEntryForCanonicalField, publicRegistryDescriptor, normalizedCatalog,
    normalizeConfirmedFieldValue, registryFingerprintMaterial,
    validateWorkTermRelationships, NEVER_IMPLICITLY_MUTATE } =
    require('./employeeHistoryCorrectionFieldRegistryService');

const PLANNER_VERSION = 'employee-history-user-confirmed-correction:v1';
const OPERATION = 'EMPLOYEE_HISTORY_USER_CONFIRMED_CORRECTION';
const RESOLUTION_KIND = 'USER_CONFIRMED_HISTORY_CORRECTION';
const PLAN_STATUSES = Object.freeze({
    APPLICABLE: 'APPLICABLE',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    BLOCKED: 'BLOCKED'
});
const SHAPE_KINDS = Object.freeze({
    INITIAL_PROFILE_BOUNDARY_WITH_INCOMPLETE_EVIDENCE:
        'INITIAL_PROFILE_BOUNDARY_WITH_INCOMPLETE_EVIDENCE',
    INITIAL_PROFILE_BOUNDARY_WITH_FIELD_CONFLICT:
        'INITIAL_PROFILE_BOUNDARY_WITH_FIELD_CONFLICT',
    INTERMEDIATE_PERIOD_WITH_OVERLAPPING_CANDIDATES:
        'INTERMEDIATE_PERIOD_WITH_OVERLAPPING_CANDIDATES'
});
const INTENTS = Object.freeze({
    FROM_HIRE: 'FROM_HIRE',
    FROM_KNOWN_HISTORY_DATE: 'FROM_KNOWN_HISTORY_DATE',
    OTHER_DATE: 'OTHER_DATE',
    CONFIRM_EXISTING: 'CONFIRM_EXISTING',
    CORRECT_EXISTING_HISTORICAL_FACT: 'CORRECT_EXISTING_HISTORICAL_FACT',
    REAL_HISTORICAL_CHANGE: 'REAL_HISTORICAL_CHANGE',
    ENTER_DIFFERENT_VALUE: 'ENTER_DIFFERENT_VALUE',
    CONFIRM_REAL_PERIOD: 'CONFIRM_REAL_PERIOD',
    RETIRE_ERRONEOUS_ARTIFACT: 'RETIRE_ERRONEOUS_ARTIFACT'
});
const SCOPE_FIELDS = Object.freeze(['team', 'company_kod', 'kodikos']);
const START_FIELD = 'hmeromhnia_isxyos_oron_ergasias_apo';
const END_FIELD = 'hmeromhnia_isxyos_oron_ergasias_eos';
const HIRE_FIELD = 'hmeromhnia_proslhpshs';
const CONTRACT_CHANGE_FIELD = 'hmeromhnia_allaghs_symbashs';
const BUSINESS_SUMMARY_FIELDS = Object.freeze([
    'symbash', 'kathgoria_symbashs', 'eidikothta_symbashs',
    'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas',
    'mo_oron_hmerhsias_ergasias', 'krathsh_01',
    'synolo_symbashs', 'nomimosMisthos', 'pragmatikosMisthos'
]);
const PROFILE_COPY_FIELDS = Object.freeze([...new Set([
    ...BASE_HISTORY_FIELDS,
    ...T.STANDARD_FIELDS,
    ...C.FACT_FIELDS,
    'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas',
    'mo_oron_hmerhsias_ergasias', 'typos_ebdomadas',
    'pososto_prosayxhshs_6hs_hmeras', 'eidikh_kathgoria_ergazomenoy'
])]);
// Correction-domain projection of the canonical profile shape already emitted by
// buildCompleteProfileSnapshot: contract/pay/KPK come from BASE_HISTORY_FIELDS and
// the three work-time values are the explicit canonical work-term snapshot fields.
// This list says what a complete correction profile needs; the registry separately
// says which of those fields the controlled correction flow can accept.
const CANONICAL_CORRECTION_REQUIREMENT_FIELDS = Object.freeze([
    ...BASE_HISTORY_FIELDS.filter(field => BUSINESS_SUMMARY_FIELDS.includes(field)),
    'hmeres_ergasias_ebdomadas',
    'ores_ergasias_ebdomadas',
    'mo_oron_hmerhsias_ergasias'
]);
const FIELD_REQUIREMENT_STATES = Object.freeze({
    PRESENT_AND_USABLE: 'PRESENT_AND_USABLE',
    MISSING_REQUIRED: 'MISSING_REQUIRED',
    CONFLICTING: 'CONFLICTING',
    NOT_REQUIRED_FOR_THIS_PERIOD: 'NOT_REQUIRED_FOR_THIS_PERIOD',
    UNSUPPORTED: 'UNSUPPORTED'
});

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
function greekDate(value) {
    const normalized = day(value);
    return normalized ? `${normalized.slice(8, 10)}/${normalized.slice(5, 7)}/${normalized.slice(0, 4)}` : '—';
}
function normalizedScope(scope = {}) {
    return Object.fromEntries(SCOPE_FIELDS.map(field => [field, String(scope[field] ?? '').trim()]));
}
function historyId(row = {}) { return row._id == null ? '' : String(row._id); }
function clone(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]));
}
function orderTuple(row = {}, index = 0) {
    return [day(effectiveStart(row)) || day(row.hmeromhnia_allaghs_orarioy_apo) || '9999-12-31',
        Number(row.aa_eggrafhs) || 0,
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
    return rows.map((row, index) => ({ row, tuple: orderTuple(row, index) }))
        .sort((left, right) => compareTuple(left.tuple, right.tuple)).map(item => item.row);
}
function valueEqual(left, right) { return stableStringify(left ?? null) === stableStringify(right ?? null); }
function displayValue(fieldId, value, catalogs = {}) {
    if (value == null || value === '') return { value: null, label: 'Δεν υπάρχει καταχωρισμένη τιμή' };
    const entry = registryEntry(fieldId);
    if (entry?.catalog) {
        const found = normalizedCatalog(catalogs[entry.catalog]).find(item => item.value === String(value));
        return found || { value: String(value), label: String(value) };
    }
    if (entry?.dataType === 'DECIMAL') return { value: Number(value), label: String(Number(value)) };
    if (entry?.dataType === 'INTEGER') return { value: Number(value), label: String(Number(value)) };
    return { value, label: String(value) };
}
function period(from, to) {
    return Object.freeze({ from: day(from), to: day(to) || null,
        label: `${greekDate(from)} – ${to ? greekDate(to) : 'σήμερα'}` });
}
function profileSummary(row, catalogs = {}) {
    return Object.freeze(BUSINESS_SUMMARY_FIELDS.map(field => {
        const entry = registryEntryForCanonicalField(field);
        return Object.freeze({ fieldId: entry?.id || field,
            label: entry?.label || field,
            value: displayValue(entry?.id, row?.[field], catalogs) });
    }));
}
function publicIntent(id, label, description, extra = {}) {
    return Object.freeze({ id, label, description, ...extra });
}
function dateControl(min, max, label = 'Ημερομηνία που άρχισαν να ισχύουν οι όροι') {
    return Object.freeze({ type: 'DATE', label, required: true, min: day(min), max: day(max) });
}
function valueControl(fieldId, catalogs, allowedValues = [], useFullCatalog = false) {
    const descriptor = publicRegistryDescriptor(fieldId, catalogs);
    const values = descriptor?.inputType === 'CATALOG_CHOICE' && useFullCatalog
        ? descriptor.catalogValues
        : allowedValues.map(value => displayValue(fieldId, value, catalogs));
    const { inputType, catalogValues, ...publicField } = descriptor;
    return Object.freeze({ ...publicField, type: inputType, required: true,
        ...(values?.length ? { allowedValues: Object.freeze(values) } : {}) });
}
function conflict(id, kind, businessPeriod, issue, decisionRequired, intents, extra = {}) {
    return Object.freeze({ conflictId: id, kind, period: businessPeriod,
        issue, decisionRequired, required: true, intents: Object.freeze(intents), ...extra });
}

function basePlan({ scope, currentEmployee, completeHistoryRows, canonicalBefore,
    problemScope, catalogs }) {
    return {
        version: PLANNER_VERSION,
        status: PLAN_STATUSES.NOT_APPLICABLE,
        reason: canonicalBefore?.diagnostics?.reason || canonicalBefore?.status || 'NOT_APPLICABLE',
        operation: OPERATION,
        resolutionClass: RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED,
        resolutionKind: RESOLUTION_KIND,
        shapeKind: null,
        scope,
        conflicts: [],
        internalRules: {},
        referenceClass: REFERENCE_CLASSES.UNKNOWN_REFERENCE,
        referenceClassifications: {},
        canonicalBefore,
        problemScope,
        fieldImpactRegistryVersion: REGISTRY_VERSION,
        registryFingerprintMaterial: registryFingerprintMaterial(catalogs),
        diagnostics: {
            currentEmployeeId: currentEmployee?._id == null ? null : String(currentEmployee._id),
            completeHistoryIds: completeHistoryRows.map(historyId).sort()
        }
    };
}
function finish(plan, status, reason, additions = {}) {
    const result = { ...plan, ...additions, status, reason };
    result.worksheetFingerprint = fingerprint({
        version: result.version,
        resolutionClass: result.resolutionClass,
        resolutionKind: result.resolutionKind,
        shapeKind: result.shapeKind,
        conflicts: result.conflicts,
        internalRules: result.internalRules,
        referenceClass: result.referenceClass,
        referenceClassifications: result.referenceClassifications,
        problemScope: result.problemScope,
        registry: result.registryFingerprintMaterial,
        diagnostics: result.diagnostics
    });
    return result;
}
function blocked(plan, reason, diagnostics = {}) {
    return finish({ ...plan, diagnostics: { ...plan.diagnostics, ...diagnostics } },
        PLAN_STATUSES.BLOCKED, reason);
}
function referenceState(rows, summary, referencePartitioner) {
    const byId = {};
    let provenance = false;
    for (const row of rows) {
        const id = historyId(row);
        if (!Object.hasOwn(summary || {}, id) || !Array.isArray(summary[id])) {
            return { safe: false, referenceClass: REFERENCE_CLASSES.UNKNOWN_REFERENCE,
                byId, reason: 'REFERENCE_STATE_NOT_LOADED' };
        }
        let partitioned;
        try { partitioned = referencePartitioner(summary[id]); } catch {
            return { safe: false, referenceClass: REFERENCE_CLASSES.UNKNOWN_REFERENCE,
                byId, reason: 'REFERENCE_SEMANTICS_UNKNOWN' };
        }
        if (partitioned.liveDereference.length) {
            return { safe: false, referenceClass: REFERENCE_CLASSES.LIVE_REFERENCE,
                byId, reason: 'LIVE_REFERENCE_BLOCKS_USER_CONFIRMED_CORRECTION' };
        }
        const collections = [...new Set(partitioned.frozenProvenance
            .map(reference => String(reference.collection)))].sort();
        byId[id] = { count: partitioned.frozenProvenance.length, collections };
        if (collections.length) provenance = true;
    }
    return { safe: true, referenceClass: provenance
        ? REFERENCE_CLASSES.PROVENANCE_ONLY : REFERENCE_CLASSES.NO_REFERENCES,
    byId, reason: null };
}
function applicableInput(scope, currentEmployee, rows) {
    return currentEmployee && rows.length && SCOPE_FIELDS.every(field => scope[field] &&
        String(currentEmployee[field] ?? '') === scope[field]) &&
        rows.every(row => historyId(row) && SCOPE_FIELDS.every(field =>
            String(row[field] ?? '') === scope[field])) &&
        new Set(rows.map(historyId)).size === rows.length;
}
function candidateLogicalIds(rows) {
    return Object.fromEntries(orderedRows(rows).map((row, index) =>
        [`PROFILE_CANDIDATE_${index + 1}`, historyId(row)]));
}
function candidatePublicOptions(candidateIds, byId, catalogs) {
    return Object.entries(candidateIds).map(([candidateId, id], index) => {
        const row = byId.get(id);
        return Object.freeze({ value: candidateId,
            label: `Όροι εργασίας ${index + 1} — εγγραφή από ${greekDate(effectiveStart(row))}`,
            description: `Τα στοιχεία που γράφει το ιστορικό από ${greekDate(effectiveStart(row))}.`,
            summary: profileSummary(row, catalogs) });
    });
}
function existingFieldValues(fieldId, rows, catalogs) {
    const entry = registryEntry(fieldId);
    const values = [];
    for (const row of rows) {
        for (const field of entry.fields) {
            if (row[field] == null || values.some(item => valueEqual(item.value, row[field]))) continue;
            values.push(displayValue(fieldId, row[field], catalogs));
        }
    }
    return values;
}

function sourceValueIsUsable(entry, sourceProfile = {}) {
    if (!entry?.fields?.length) return false;
    try {
        return entry.fields.every(field => {
            const value = sourceProfile[field];
            if (value === undefined || value === null || value === '') return false;
            entry.normalize(value);
            return true;
        });
    } catch {
        return false;
    }
}

function determineRequiredCorrectionFields({ logicalPeriod = null, sourceProfile = {},
    canonicalRequirements = [], explicitConflicts = [],
    registry = CORRECTION_FIELD_REGISTRY } = {}) {
    const registryEntries = Array.isArray(registry) ? registry : [];
    const conflicts = new Set((explicitConflicts || []).map(item =>
        String(item?.fieldId || item?.id || item || '')));
    const requiredTokens = [...new Set((canonicalRequirements || [])
        .map(item => String(item?.field || item?.fieldId || item?.id || item || ''))
        .filter(Boolean))];
    const requiredCanonicalFields = new Set();
    const requiredBusinessIds = new Set();
    const unsupported = [];

    for (const token of requiredTokens) {
        const byBusinessId = registryEntries.find(entry => entry.id === token);
        const byCanonicalField = registryEntries.find(entry => entry.fields.includes(token));
        const supported = byBusinessId || byCanonicalField;
        if (!supported) {
            unsupported.push(Object.freeze({ field: token,
                state: FIELD_REQUIREMENT_STATES.UNSUPPORTED }));
            continue;
        }
        if (byBusinessId) requiredBusinessIds.add(byBusinessId.id);
        else requiredCanonicalFields.add(token);
    }

    const classifications = registryEntries.map(entry => {
        const required = requiredBusinessIds.has(entry.id) ||
            entry.fields.some(field => requiredCanonicalFields.has(field));
        let state = FIELD_REQUIREMENT_STATES.NOT_REQUIRED_FOR_THIS_PERIOD;
        if (required && conflicts.has(entry.id)) state = FIELD_REQUIREMENT_STATES.CONFLICTING;
        else if (required && sourceValueIsUsable(entry, sourceProfile)) {
            state = FIELD_REQUIREMENT_STATES.PRESENT_AND_USABLE;
        } else if (required) state = FIELD_REQUIREMENT_STATES.MISSING_REQUIRED;
        return Object.freeze({ fieldId: entry.id, fields: entry.fields, state });
    });
    const requiredUserFieldIds = classifications.filter(item => [
        FIELD_REQUIREMENT_STATES.MISSING_REQUIRED,
        FIELD_REQUIREMENT_STATES.CONFLICTING
    ].includes(item.state)).map(item => item.fieldId);

    return Object.freeze({
        status: unsupported.length ? PLAN_STATUSES.BLOCKED : PLAN_STATUSES.APPLICABLE,
        logicalPeriod: logicalPeriod ? Object.freeze({ ...logicalPeriod }) : null,
        requiredUserFieldIds: Object.freeze(requiredUserFieldIds),
        classifications: Object.freeze([...classifications, ...unsupported]),
        unsupportedRequiredFields: Object.freeze(unsupported.map(item => item.field))
    });
}

function buildInitialShape({ plan, activeRows, profileRows, nonProfileRows, hire,
    catalogs, refs }) {
    if (profileRows.length !== 1 || !nonProfileRows.length) return null;
    const profile = profileRows[0];
    const profileStart = day(effectiveStart(profile));
    if (!profileStart || profileStart <= hire) return null;
    const knownRows = nonProfileRows.filter(row => {
        const known = day(row.hmeromhnia_allaghs_orarioy_apo);
        return known && known >= hire && known < profileStart;
    });
    if (!knownRows.length) return null;
    const legacy = orderedRows(knownRows)[0];
    const knownDate = day(legacy.hmeromhnia_allaghs_orarioy_apo);
    const byId = new Map(activeRows.map(row => [historyId(row), row]));
    const candidateIds = candidateLogicalIds([profile]);
    const candidates = candidatePublicOptions(candidateIds, byId, catalogs);
    const differingSupported = CORRECTION_FIELD_REGISTRY.filter(entry => {
        const field = entry.fields[0];
        return legacy[field] != null && profile[field] != null &&
            !valueEqual(legacy[field], profile[field]);
    });
    const boundedPeriod = period(hire, addDays(profileStart, -1));
    const fieldRequirements = determineRequiredCorrectionFields({
        logicalPeriod: boundedPeriod,
        sourceProfile: legacy,
        canonicalRequirements: CANONICAL_CORRECTION_REQUIREMENT_FIELDS,
        explicitConflicts: differingSupported.map(entry => entry.id)
    });
    if (fieldRequirements.status === PLAN_STATUSES.BLOCKED) {
        return blocked(plan, 'UNSUPPORTED_REQUIRED_CORRECTION_FIELD', {
            boundedPeriod: { from: boundedPeriod.from, to: boundedPeriod.to },
            unsupportedRequiredFields: fieldRequirements.unsupportedRequiredFields
        });
    }
    const profileRequiredFieldIds = fieldRequirements.classifications
        .filter(item => item.state === FIELD_REQUIREMENT_STATES.MISSING_REQUIRED)
        .map(item => item.fieldId);
    const profileIntents = [
        publicIntent(INTENTS.CONFIRM_EXISTING,
            'Ίσχυαν οι όροι που εμφανίζονται',
            'Κρατήστε τα στοιχεία που εμφανίζονται για αυτό το διάστημα.', {
                valueControl: Object.freeze({ type: 'SINGLE_CHOICE', required: true,
                    label: 'Ποιοι όροι ίσχυαν;',
                    allowedValues: Object.freeze(candidates) })
            })
    ];
    if (profileRequiredFieldIds.length) {
        profileIntents.push(publicIntent(INTENTS.ENTER_DIFFERENT_VALUE,
            'Ίσχυαν διαφορετικοί όροι',
            'Θα σας ζητήσουμε μόνο τα στοιχεία που λείπουν και χρειάζονται για αυτό το διάστημα.', {
                valueControl: Object.freeze({ type: 'PROFILE_FIELDS', required: true,
                    baselineValues: Object.freeze(candidates),
                    fields: Object.freeze(profileRequiredFieldIds.map(fieldId =>
                        publicRegistryDescriptor(fieldId, catalogs))) })
            }));
    }
    const conflicts = [
        conflict('INITIAL_PROFILE_START', 'BOUNDARY', period(hire, addDays(profileStart, -1)),
            `Ο εργαζόμενος προσλήφθηκε στις ${greekDate(hire)}.\nΣτο ιστορικό υπάρχει μια παλιά εγγραφή από ${greekDate(knownDate)}. Υπάρχουν επίσης καταγραμμένοι όροι εργασίας από ${greekDate(profileStart)}.\nΔεν είναι ξεκάθαρο από ποια ημερομηνία ίσχυαν πραγματικά αυτοί οι όροι. Πείτε μας από ποια ημερομηνία ίσχυαν.`,
            'Από ποια ημερομηνία ίσχυαν αυτοί οι όροι εργασίας;', [
                publicIntent(INTENTS.FROM_HIRE, 'Από την πρόσληψη',
                    `Οι ίδιοι όροι ίσχυαν από την πρώτη ημέρα, δηλαδή από ${greekDate(hire)}.`),
                publicIntent(INTENTS.FROM_KNOWN_HISTORY_DATE,
                    `Από ${greekDate(knownDate)}`,
                    `Οι ίδιοι όροι άρχισαν να ισχύουν από ${greekDate(knownDate)}.`),
                publicIntent(INTENTS.OTHER_DATE, 'Από άλλη ημερομηνία',
                    'Γράψτε την ημερομηνία από την οποία άρχισαν πραγματικά να ισχύουν.', {
                        effectiveDateControl: dateControl(hire, addDays(profileStart, -1))
                    })
            ], { hireDate: hire, knownHistoryDate: knownDate }),
        conflict('INITIAL_PROFILE_TERMS', 'PROFILE', period(hire, addDays(profileStart, -1)),
            profileRequiredFieldIds.length
                ? `Για το διάστημα ${greekDate(hire)} έως ${greekDate(addDays(profileStart, -1))} υπάρχουν ήδη κάποια στοιχεία στο ιστορικό, αλλά λείπουν μερικά στοιχεία που χρειάζονται.\nΛείπουν: ${profileRequiredFieldIds.map(id => registryEntry(id).label).join(', ')}.\nΗ εφαρμογή δεν μπορεί να τα συμπληρώσει μόνη της. Πείτε αν οι όροι που εμφανίζονται ήταν σωστοί ή αν ίσχυαν διαφορετικοί όροι.`
                : `Για το διάστημα ${greekDate(hire)} έως ${greekDate(addDays(profileStart, -1))} υπάρχουν στοιχεία στο ιστορικό, αλλά δεν είναι ξεκάθαρο ποιοι όροι ίσχυαν τότε.\nΗ εφαρμογή δεν μπορεί να διαλέξει μόνη της. Πείτε ποιοι όροι ίσχυαν σε αυτό το διάστημα.`,
            'Τι ίσχυε σε αυτό το διάστημα;', profileIntents,
            { knownHistoricalSummary: profileSummary(legacy, catalogs),
                laterProfileSummary: profileSummary(profile, catalogs) })
    ];
    for (const entry of differingSupported) {
        const field = entry.fields[0];
        const values = existingFieldValues(entry.id, [legacy, profile], catalogs);
        const existingControl = valueControl(entry.id, catalogs,
            values.map(item => item.value));
        const catalogControl = valueControl(entry.id, catalogs,
            values.map(item => item.value), entry.dataType === 'CATALOG_CHOICE');
        const fieldLabel = entry.id === 'KPK' ? 'ΚΠΚ' : entry.label;
        const oldValue = displayValue(entry.id, legacy[field], catalogs).label;
        const newValue = displayValue(entry.id, profile[field], catalogs).label;
        const oldCode = String(legacy[field]);
        conflicts.push(conflict(`FIELD_${entry.id}`, 'FIELD', period(hire, addDays(profileStart, -1)),
            `Για το διάστημα ${greekDate(hire)} έως ${greekDate(addDays(profileStart, -1))} το ιστορικό γράφει:\n${fieldLabel}: ${oldValue}\n\nΣε επόμενη εγγραφή γράφει:\n${fieldLabel}: ${newValue}\n\n${entry.id === 'KPK' ? 'Αυτά τα δύο ΚΠΚ δεν είναι το ίδιο.' : 'Οι δύο τιμές είναι διαφορετικές.'}\nΠείτε τι ίσχυε πραγματικά για αυτό το διάστημα.`,
            `Τι ίσχυε πραγματικά για ${entry.id === 'KPK' ? 'το ΚΠΚ' : `το στοιχείο «${fieldLabel}»`};`, [
                publicIntent(INTENTS.CONFIRM_EXISTING,
                    entry.id === 'KPK' ? 'Το παλιό ΚΠΚ ήταν σωστό' : `Η παλιά τιμή για «${fieldLabel}» ήταν σωστή`,
                    `Το ${oldCode} ήταν σωστό για το παλιό διάστημα. Δεν διορθώνεται αυτή η τιμή.`),
                publicIntent(INTENTS.CORRECT_EXISTING_HISTORICAL_FACT,
                    entry.id === 'KPK' ? 'Το παλιό ΚΠΚ ήταν λάθος' : `Η παλιά τιμή για «${fieldLabel}» ήταν λάθος`,
                    entry.id === 'KPK'
                        ? 'Το ΚΠΚ γράφτηκε λάθος στο ιστορικό.\nΕπιλέξτε ποιο ΚΠΚ έπρεπε να υπάρχει.\nΘα διορθωθεί μόνο το ΚΠΚ.\nΔεν θα δημιουργηθεί νέα αλλαγή σύμβασης.'
                        : `Το στοιχείο «${fieldLabel}» γράφτηκε λάθος στο ιστορικό. Επιλέξτε τη σωστή τιμή. Θα διορθωθεί μόνο αυτό το στοιχείο στο ίδιο διάστημα. Δεν θα προστεθεί νέα αλλαγή στους όρους εργασίας.`,
                    { valueControl: existingControl }),
                publicIntent(INTENTS.REAL_HISTORICAL_CHANGE,
                    entry.id === 'KPK' ? 'Το ΚΠΚ άλλαξε πραγματικά κάποια ημερομηνία' : `Το στοιχείο «${fieldLabel}» άλλαξε πραγματικά κάποια ημερομηνία`,
                    `Το ${entry.id === 'KPK' ? 'παλιό ΚΠΚ' : 'παλιό στοιχείο'} ήταν σωστό στην αρχή και αργότερα άλλαξε.\nΕπιλέξτε ${entry.id === 'KPK' ? 'το νέο ΚΠΚ' : 'τη νέα τιμή'} και γράψτε την ημερομηνία που έγινε η αλλαγή.`,
                    { valueControl: existingControl,
                        effectiveDateControl: dateControl(hire, profileStart,
                            'Ημερομηνία που έγινε η αλλαγή') }),
                publicIntent(INTENTS.ENTER_DIFFERENT_VALUE,
                    entry.id === 'KPK' ? 'Ίσχυε άλλο ΚΠΚ' : `Ίσχυε άλλη τιμή για «${fieldLabel}»`,
                    `Καμία από τις τιμές που εμφανίζονται δεν είναι σωστή. Επιλέξτε ${entry.id === 'KPK' ? 'το σωστό ΚΠΚ' : 'τη σωστή τιμή'} από τη λίστα.`,
                    { valueControl: catalogControl })
            ], { field: publicRegistryDescriptor(entry.id, catalogs),
                historicalValues: Object.freeze([displayValue(entry.id, legacy[field], catalogs)]),
                laterValue: displayValue(entry.id, profile[field], catalogs) }));
    }
    const kpkConflict = differingSupported.some(entry => entry.id === 'KPK');
    const shapeKind = kpkConflict
        ? SHAPE_KINDS.INITIAL_PROFILE_BOUNDARY_WITH_FIELD_CONFLICT
        : SHAPE_KINDS.INITIAL_PROFILE_BOUNDARY_WITH_INCOMPLETE_EVIDENCE;
    return finish(plan, PLAN_STATUSES.APPLICABLE, shapeKind, {
        shapeKind,
        conflicts: Object.freeze(conflicts),
        referenceClass: refs.referenceClass,
        referenceClassifications: refs.byId,
        internalRules: Object.freeze({
            hire,
            profileStart,
            knownDate,
            legacyHistoryId: historyId(legacy),
            profileHistoryId: historyId(profile),
            retireHistoryIds: nonProfileRows.filter(row => historyId(row) !== historyId(legacy))
                .map(historyId).sort(),
            candidateIds,
            profileRequiredFieldIds,
            supportedFieldConflictIds: differingSupported.map(entry => `FIELD_${entry.id}`)
        }),
        diagnostics: { ...plan.diagnostics,
            boundedPeriod: { from: hire, to: addDays(profileStart, -1) },
            supportedFields: differingSupported.map(entry => entry.id),
            requiredUserFieldIds: fieldRequirements.requiredUserFieldIds,
            fieldRequirementClassifications: fieldRequirements.classifications }
    });
}

function buildIntermediateShape({ plan, activeRows, profileRows, nonProfileRows,
    hire, catalogs, refs }) {
    if (profileRows.length !== 2 || !nonProfileRows.length) return null;
    const orderedProfiles = orderedRows(profileRows);
    const earlier = orderedProfiles[0];
    const later = orderedProfiles[1];
    const earlierStart = day(effectiveStart(earlier));
    const laterStart = day(effectiveStart(later));
    if (!earlierStart || !laterStart || earlierStart > laterStart) return null;
    const artifact = orderedRows(nonProfileRows).find(row => {
        const start = day(row.hmeromhnia_allaghs_orarioy_apo);
        const end = day(row.hmeromhnia_allaghs_orarioy_eos);
        return start && end && start <= end && start >= earlierStart && start <= laterStart;
    });
    if (!artifact) return null;
    const artifactStart = day(artifact.hmeromhnia_allaghs_orarioy_apo);
    const artifactEnd = day(artifact.hmeromhnia_allaghs_orarioy_eos);
    const byId = new Map(activeRows.map(row => [historyId(row), row]));
    const candidateIds = candidateLogicalIds(orderedProfiles);
    const candidates = candidatePublicOptions(candidateIds, byId, catalogs);
    const conflicts = [
        conflict('INITIAL_PROFILE_START', 'BOUNDARY', period(hire, addDays(earlierStart, -1)),
            `Ο εργαζόμενος προσλήφθηκε στις ${greekDate(hire)}.\nΣτο ιστορικό υπάρχουν όροι εργασίας από ${greekDate(earlierStart)}, αλλά δεν είναι ξεκάθαρο από ποια ημερομηνία ίσχυαν πραγματικά.\nΠείτε μας από ποια ημερομηνία ίσχυαν.`,
            'Από ποια ημερομηνία ίσχυαν αυτοί οι όροι εργασίας;', [
                publicIntent(INTENTS.FROM_HIRE, 'Από την πρόσληψη',
                    `Οι ίδιοι όροι ίσχυαν από την πρώτη ημέρα, δηλαδή από ${greekDate(hire)}.`),
                publicIntent(INTENTS.FROM_KNOWN_HISTORY_DATE,
                    `Από ${greekDate(earlierStart)}`,
                    `Οι ίδιοι όροι άρχισαν να ισχύουν από ${greekDate(earlierStart)}.`),
                publicIntent(INTENTS.OTHER_DATE, 'Από άλλη ημερομηνία',
                    'Γράψτε την ημερομηνία από την οποία άρχισαν πραγματικά να ισχύουν.', {
                        effectiveDateControl: dateControl(hire, earlierStart)
                    })
            ], { hireDate: hire, knownHistoryDate: earlierStart }),
        conflict('INTERMEDIATE_PERIOD_MEANING', 'STRUCTURAL_PERIOD',
            period(artifactStart, artifactEnd),
            `Στο ιστορικό υπάρχει ξεχωριστή εγγραφή για το διάστημα ${greekDate(artifactStart)} έως ${greekDate(artifactEnd)}.\nΑυτή η εγγραφή δεν έχει όλα τα στοιχεία. Δεν είναι ξεκάθαρο αν υπήρξε πραγματική αλλαγή στους όρους εργασίας ή αν η εγγραφή μπήκε κατά λάθος.\nΠείτε τι συνέβη πραγματικά.`,
            `Υπήρχαν πραγματικά διαφορετικοί όροι από ${greekDate(artifactStart)} έως ${greekDate(artifactEnd)};`, [
                publicIntent(INTENTS.CONFIRM_REAL_PERIOD,
                    'Ναι, εκείνες τις ημέρες ίσχυαν διαφορετικοί όροι',
                    'Η περίοδος ήταν πραγματική. Θα σας ζητήσουμε μόνο όσα στοιχεία χρειάζονται για να πείτε τι ίσχυε αυτές τις ημέρες.'),
                publicIntent(INTENTS.RETIRE_ERRONEOUS_ARTIFACT,
                    'Όχι, αυτή η εγγραφή μπήκε κατά λάθος',
                    'Δεν υπήρξε πραγματική αλλαγή για αυτές τις ημέρες. Η εφαρμογή δεν θα θεωρεί αυτή την εγγραφή ξεχωριστή περίοδο.')
            ], { knownHistoricalSummary: profileSummary(artifact, catalogs) }),
        conflict('INTERMEDIATE_PROFILE_TERMS', 'PROFILE', period(artifactStart, artifactEnd),
            `Πείτε ποιοι όροι εργασίας ίσχυαν από ${greekDate(artifactStart)} έως ${greekDate(artifactEnd)}.\nΗ εφαρμογή δεν μπορεί να επιλέξει μόνη της ανάμεσα στα στοιχεία που εμφανίζονται.`,
            'Ποιοι όροι ίσχυαν αυτές τις ημέρες;', [
                publicIntent(INTENTS.CONFIRM_EXISTING,
                    'Ίσχυαν οι όροι που εμφανίζονται',
                    'Επιλέξτε ποιοι από τους όρους που εμφανίζονται ήταν σωστοί για αυτές τις ημέρες.', {
                        valueControl: Object.freeze({ type: 'SINGLE_CHOICE', required: true,
                            label: 'Ποιοι όροι ίσχυαν;',
                            allowedValues: Object.freeze(candidates) })
                    })
            ], { condition: Object.freeze({ conflictId: 'INTERMEDIATE_PERIOD_MEANING',
                intent: INTENTS.CONFIRM_REAL_PERIOD }) }),
        conflict('LATER_PROFILE_START', 'BOUNDARY', period(earlierStart, laterStart),
            `Στο ιστορικό υπάρχουν όροι εργασίας από ${greekDate(earlierStart)} και άλλοι όροι από ${greekDate(laterStart)}.\nΟι ημερομηνίες τους δεν δείχνουν καθαρά πότε σταμάτησαν οι παλιοί όροι και πότε άρχισαν οι νέοι.\nΠείτε από ποια ημερομηνία άρχισαν να ισχύουν οι νέοι όροι.`,
            'Από ποια ημερομηνία ίσχυαν οι νέοι όροι εργασίας;', [
                publicIntent(INTENTS.FROM_KNOWN_HISTORY_DATE,
                    `Από ${greekDate(laterStart)}`,
                    `Οι νέοι όροι άρχισαν να ισχύουν από ${greekDate(laterStart)}.`),
                publicIntent(INTENTS.OTHER_DATE, 'Από άλλη ημερομηνία',
                    'Γράψτε την ημερομηνία από την οποία άρχισαν πραγματικά να ισχύουν οι νέοι όροι.', {
                        effectiveDateControl: dateControl(earlierStart,
                            day(currentCycleEnd(plan.canonicalBefore, later)) || laterStart)
                    })
            ], { knownHistoryDate: laterStart,
                earlierProfileSummary: profileSummary(earlier, catalogs),
                laterProfileSummary: profileSummary(later, catalogs) })
    ];
    return finish(plan, PLAN_STATUSES.APPLICABLE,
        SHAPE_KINDS.INTERMEDIATE_PERIOD_WITH_OVERLAPPING_CANDIDATES, {
            shapeKind: SHAPE_KINDS.INTERMEDIATE_PERIOD_WITH_OVERLAPPING_CANDIDATES,
            conflicts: Object.freeze(conflicts),
            referenceClass: refs.referenceClass,
            referenceClassifications: refs.byId,
            internalRules: Object.freeze({
                hire,
                earlierStart,
                laterStart,
                artifactStart,
                artifactEnd,
                earlierHistoryId: historyId(earlier),
                laterHistoryId: historyId(later),
                artifactHistoryId: historyId(artifact),
                retireHistoryIds: nonProfileRows.filter(row => historyId(row) !== historyId(artifact))
                    .map(historyId).sort(),
                candidateIds
            }),
            diagnostics: { ...plan.diagnostics,
                boundedPeriod: { from: artifactStart, to: artifactEnd },
                supportedFields: [] }
        });
}
function currentCycleEnd(canonical, fallbackRow) {
    return fallbackRow?.[END_FIELD] || canonical?.canonicalRows?.find(row =>
        historyId(row) === historyId(fallbackRow))?.[END_FIELD] || null;
}

function planEmployeeHistoryUserConfirmedCorrection({ scope: rawScope, currentEmployee,
    completeHistoryRows = [], canonicalResult = null, problemScope = null,
    protectedReferenceSummary = {}, catalogs = {},
    referencePartitioner = partitionHistoryUpdateReferences,
    canonicalizer = canonicalizeEmployeeHistory } = {}) {
    const scope = normalizedScope(rawScope);
    const canonicalBefore = canonicalResult || canonicalizer({ scope, currentEmployee,
        historyRows: completeHistoryRows });
    const resolvedProblemScope = problemScope || identifyEmployeeHistoryProblemScope({
        scope, currentEmployee, completeHistoryRows, canonicalizer });
    const plan = basePlan({ scope, currentEmployee, completeHistoryRows,
        canonicalBefore, problemScope: resolvedProblemScope, catalogs });
    if (!applicableInput(scope, currentEmployee, completeHistoryRows)) {
        return blocked(plan, 'INVALID_OR_CONFLICTING_INPUT');
    }
    if (canonicalBefore.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY ||
        resolvedProblemScope.deterministicallyResolved !== true ||
        !['AMBIGUOUS_LIFECYCLE_EVENTS', 'OVERLAPPING_GENUINE_PERIODS']
            .includes(canonicalBefore.diagnostics?.reason)) {
        return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
            canonicalBefore.diagnostics?.reason || canonicalBefore.status);
    }
    const refs = referenceState(completeHistoryRows, protectedReferenceSummary,
        referencePartitioner);
    if (!refs.safe) return blocked({ ...plan, referenceClass: refs.referenceClass }, refs.reason,
        { referenceState: refs.byId });
    const activeRows = completeHistoryRows.filter(row => !isPersistedReferencedRedundant(row));
    const hires = [...new Set([currentEmployee, ...activeRows].map(row => day(row[HIRE_FIELD]))
        .filter(Boolean))];
    if (hires.length !== 1) return finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
        'NO_UNIQUE_HIRE_ANCHOR');
    const profileRows = activeRows.filter(row => effectiveStart(row) &&
        row.afora_allagh_oron_ergasias === true);
    const nonProfileRows = activeRows.filter(row => !profileRows.includes(row));
    const common = { plan, activeRows, profileRows, nonProfileRows, hire: hires[0], catalogs, refs };
    if (canonicalBefore.diagnostics?.reason === 'AMBIGUOUS_LIFECYCLE_EVENTS') {
        return buildInitialShape(common) || finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
            'UNSUPPORTED_USER_CONFIRMED_INITIAL_SHAPE');
    }
    return buildIntermediateShape(common) || finish(plan, PLAN_STATUSES.NOT_APPLICABLE,
        'UNSUPPORTED_USER_CONFIRMED_INTERMEDIATE_SHAPE');
}

function decisionMap(decisions, conflicts) {
    if (!Array.isArray(decisions) || !decisions.length) invalidRequest('DECISIONS_REQUIRED');
    const byId = new Map();
    for (const decision of decisions) {
        if (!decision || typeof decision !== 'object' || Array.isArray(decision) ||
            Object.keys(decision).some(key => !['conflictId', 'intent', 'value',
                'effectiveDate', 'values'].includes(key))) invalidRequest('INVALID_DECISION_SHAPE');
        const conflictId = String(decision.conflictId || '');
        if (!conflictId || byId.has(conflictId)) invalidRequest('DUPLICATE_OR_MISSING_CONFLICT');
        const conflict = conflicts.find(item => item.conflictId === conflictId);
        if (!conflict) invalidRequest('UNKNOWN_CONFLICT');
        const intent = conflict.intents.find(item => item.id === decision.intent);
        if (!intent) invalidRequest('UNKNOWN_INTENT');
        byId.set(conflictId, { ...decision, conflict, intent });
    }
    for (const conflict of conflicts) {
        const active = !conflict.condition ||
            byId.get(conflict.condition.conflictId)?.intent.id === conflict.condition.intent;
        if (active !== byId.has(conflict.conflictId)) invalidRequest(active
            ? 'MISSING_REQUIRED_DECISION' : 'UNEXPECTED_CONDITIONAL_DECISION');
    }
    return byId;
}
function invalidRequest(reason, code = 'EMPLOYEE_HISTORY_USER_CORRECTION_INVALID_REQUEST') {
    const error = new TypeError(reason);
    error.code = code;
    error.reason = reason;
    error.statusCode = 409;
    throw error;
}
function normalizedDateForDecision(decision, min, max, fallback = '') {
    let value = fallback;
    if (decision.intent.id === INTENTS.FROM_HIRE) value = min;
    if (decision.intent.id === INTENTS.FROM_KNOWN_HISTORY_DATE) value = fallback;
    if ([INTENTS.OTHER_DATE, INTENTS.REAL_HISTORICAL_CHANGE].includes(decision.intent.id)) {
        value = decision.effectiveDate;
    }
    let normalized;
    try { normalized = day(value); } catch { invalidRequest('INVALID_DATE'); }
    if (!normalized) invalidRequest('DATE_REQUIRED');
    if ((min && normalized < day(min)) || (max && normalized > day(max))) {
        invalidRequest('DATE_OUT_OF_RANGE');
    }
    return normalized;
}
function allowedValuesForIntent(intent) {
    return intent?.valueControl?.allowedValues || [];
}
function normalizeFieldDecision(fieldId, decision) {
    const valueRequired = [INTENTS.CORRECT_EXISTING_HISTORICAL_FACT,
        INTENTS.REAL_HISTORICAL_CHANGE, INTENTS.ENTER_DIFFERENT_VALUE]
        .includes(decision.intent.id);
    if (!valueRequired) {
        if (decision.value !== undefined || decision.values !== undefined ||
            decision.effectiveDate !== undefined) invalidRequest('UNEXPECTED_DECISION_VALUE');
        return { conflictId: decision.conflictId, intent: decision.intent.id };
    }
    if (decision.values !== undefined) invalidRequest('UNEXPECTED_DECISION_VALUES');
    const value = normalizeConfirmedFieldValue(fieldId, decision.value, {
        allowedValues: allowedValuesForIntent(decision.intent)
    });
    const normalized = { conflictId: decision.conflictId, intent: decision.intent.id, value };
    if (decision.intent.id === INTENTS.REAL_HISTORICAL_CHANGE) {
        normalized.effectiveDate = normalizedDateForDecision(decision,
            decision.conflict.period.from, decision.conflict.period.to || decision.effectiveDate,
            decision.effectiveDate);
    } else if (decision.effectiveDate !== undefined) invalidRequest('UNEXPECTED_EFFECTIVE_DATE');
    return normalized;
}
function profileCandidateId(decision, candidateIds) {
    const value = String(decision.value || '');
    if (!Object.hasOwn(candidateIds, value)) invalidRequest('UNKNOWN_PROFILE_CANDIDATE');
    return candidateIds[value];
}
function selectedProfileValues(decision, candidateIds, rowsById, conflicts, catalogs) {
    if (decision.intent.id === INTENTS.CONFIRM_EXISTING) {
        if (decision.values !== undefined || decision.effectiveDate !== undefined) {
            invalidRequest('UNEXPECTED_PROFILE_VALUES');
        }
        return { sourceHistoryId: profileCandidateId(decision, candidateIds), overrides: {} };
    }
    if (decision.intent.id !== INTENTS.ENTER_DIFFERENT_VALUE ||
        !decision.values || typeof decision.values !== 'object' || Array.isArray(decision.values) ||
        decision.effectiveDate !== undefined) invalidRequest('INVALID_PROFILE_VALUES');
    const profileControl = conflicts.flatMap(item => item.intents)
        .find(intent => intent.valueControl?.type === 'PROFILE_FIELDS')?.valueControl;
    const allowed = new Set((profileControl?.fields || []).map(field => field.id));
    const keys = Object.keys(decision.values);
    if (!keys.length || keys.some(key => !allowed.has(key))) invalidRequest('UNSUPPORTED_PROFILE_FIELD');
    if (keys.length !== allowed.size || [...allowed].some(fieldId => !keys.includes(fieldId))) {
        invalidRequest('INCOMPLETE_PROFILE_FIELDS');
    }
    const baselineId = String(decision.value || '');
    if (!Object.hasOwn(candidateIds, baselineId)) invalidRequest('UNKNOWN_PROFILE_CANDIDATE');
    const overrides = {};
    for (const fieldId of keys) {
        const descriptor = profileControl.fields.find(item => item.id === fieldId);
        const catalogValues = descriptor?.catalogValues || [];
        const entry = registryEntry(fieldId);
        const existing = [...rowsById.values()].map(row => row[entry.fields[0]])
            .filter(value => value != null).map(value => ({ value }));
        overrides[entry.fields[0]] = normalizeConfirmedFieldValue(fieldId,
            decision.values[fieldId], { allowedValues: catalogValues.length ? catalogValues : existing });
    }
    validateWorkTermRelationships(overrides);
    return { sourceHistoryId: candidateIds[baselineId], overrides };
}
function copyProfile(source, effectiveFrom, effectiveUntil = null, overrides = {}) {
    const copied = Object.fromEntries(PROFILE_COPY_FIELDS.filter(field =>
        source[field] !== undefined).map(field => [field, clone(source[field])]));
    const complete = buildCompleteProfileSnapshot({ input: { ...copied, ...overrides },
        current: { ...copied, ...overrides }, effectiveFrom });
    return { ...complete,
        [HIRE_FIELD]: source[HIRE_FIELD],
        [CONTRACT_CHANGE_FIELD]: source[CONTRACT_CHANGE_FIELD],
        hmeromhnia_lhxhs_symbashs: source.hmeromhnia_lhxhs_symbashs,
        hmeromhnia_apoxorhshs: source.hmeromhnia_apoxorhshs,
        [START_FIELD]: dateValue(effectiveFrom),
        [END_FIELD]: effectiveUntil ? dateValue(effectiveUntil) : null,
        afora_allagh_oron_ergasias: true,
        employment_profile_source: 'EMPLOYEE_PROFILE_FOUNDATION'
    };
}
function preserveKnownHistoricalProfileValues(baseline, historical) {
    const preserved = { ...baseline };
    for (const field of PROFILE_COPY_FIELDS) {
        const value = historical?.[field];
        if (value !== undefined && value !== null && value !== '') preserved[field] = clone(value);
    }
    return preserved;
}
function retire(row, survivorId) {
    return { ...row, [REDUNDANT_STATUS_FIELD]: REDUNDANT_REFERENCED,
        [REDUNDANT_SURVIVOR_FIELD]: survivorId };
}
function patchProfileRow(target, source, start, end, overrides = {}) {
    const identity = Object.fromEntries(['_id', ...SCOPE_FIELDS, 'aa_eggrafhs', 'createdAt', 'updatedAt']
        .filter(field => target[field] !== undefined).map(field => [field, target[field]]));
    const protectedTemporal = Object.fromEntries(NEVER_IMPLICITLY_MUTATE
        .filter(field => target[field] !== undefined).map(field => [field, clone(target[field])]));
    return { ...target, ...copyProfile(source, start, end, overrides),
        ...protectedTemporal, ...identity };
}
function rowForId(rows, id) {
    const row = rows.find(item => historyId(item) === String(id));
    if (!row) invalidRequest('HISTORY_STATE_CHANGED', 'EMPLOYEE_HISTORY_USER_CORRECTION_STALE');
    return row;
}
function buildSelectedPlan(plannerResult, currentEmployee, beforeRows, finalRows,
    normalizedDecisions, currentPatch = {}, hypotheticalCanonicalResult = null,
    secondCanonicalResult = null) {
    const diff = calculateCanonicalDiff(beforeRows, finalRows);
    const historyPatches = Object.fromEntries(diff.rowsToUpdate.map(item =>
        [String(item.historyId), item.patch]));
    const insertedRows = diff.rowsToInsert;
    const affectedStableIds = Object.keys(historyPatches).sort();
    const plan = {
        version: plannerResult.version,
        status: PLAN_STATUSES.APPLICABLE,
        operation: OPERATION,
        resolutionClass: RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED,
        resolutionKind: RESOLUTION_KIND,
        shapeKind: plannerResult.shapeKind,
        currentPatch,
        desiredHistoryRows: finalRows,
        historyPatches,
        insertedRows,
        physicalDeleteIds: [],
        changedHistoryIds: affectedStableIds,
        affectedStableIds,
        normalizedDecisions,
        conflictsShown: plannerResult.conflicts,
        responsibilityAccepted: true,
        referenceClass: plannerResult.referenceClass,
        referenceClassifications: plannerResult.referenceClassifications,
        fieldImpactRegistryVersion: plannerResult.fieldImpactRegistryVersion
    };
    if (hypotheticalCanonicalResult) plan.hypotheticalCanonicalResult = hypotheticalCanonicalResult;
    if (secondCanonicalResult) plan.secondCanonicalResult = secondCanonicalResult;
    plan.planFingerprint = fingerprint({
        version: plan.version,
        operation: plan.operation,
        resolutionClass: plan.resolutionClass,
        resolutionKind: plan.resolutionKind,
        shapeKind: plan.shapeKind,
        currentPatch: plan.currentPatch,
        desiredHistoryRows: plan.desiredHistoryRows,
        normalizedDecisions: plan.normalizedDecisions,
        conflictsShown: plan.conflictsShown,
        responsibilityAccepted: true,
        referenceClass: plan.referenceClass,
        referenceClassifications: plan.referenceClassifications,
        registryVersion: plan.fieldImpactRegistryVersion
    });
    return plan;
}

function applyConfirmedFieldDecisionToTimeline({ rows, targetHistoryId, fieldId, decision,
    allowedValues = [], canonicalizer = null, scope = null, currentEmployee = null } = {}) {
    const entry = registryEntry(fieldId);
    if (!entry || !Array.isArray(rows)) invalidRequest('UNSUPPORTED_FIELD');
    const field = entry.fields[0];
    const result = rows.map(clone);
    const index = result.findIndex(row => historyId(row) === String(targetHistoryId));
    if (index < 0) invalidRequest('UNKNOWN_TARGET');
    const normalizedValue = normalizeConfirmedFieldValue(fieldId, decision.value, { allowedValues });
    const before = clone(result[index]);
    if (decision.intent === INTENTS.CORRECT_EXISTING_HISTORICAL_FACT ||
        decision.intent === INTENTS.ENTER_DIFFERENT_VALUE) {
        result[index][field] = normalizedValue;
    } else if (decision.intent === INTENTS.REAL_HISTORICAL_CHANGE) {
        const from = day(effectiveStart(result[index]));
        const until = day(effectiveEnd(result[index]));
        const boundary = day(decision.effectiveDate);
        if (!from || !boundary || boundary <= from || (until && boundary > until)) {
            invalidRequest('REAL_CHANGE_BOUNDARY_OUT_OF_RANGE');
        }
        result[index][END_FIELD] = dateValue(addDays(boundary, -1));
        const next = { ...clone(before), _id: undefined,
            [START_FIELD]: dateValue(boundary), [END_FIELD]: until ? dateValue(until) : null,
            [field]: normalizedValue };
        result.splice(index + 1, 0, next);
    } else invalidRequest('UNSUPPORTED_FIELD_INTENT');
    const protectedFields = NEVER_IMPLICITLY_MUTATE;
    for (const protectedField of protectedFields) {
        if (!valueEqual(before[protectedField], result[index][protectedField])) {
            invalidRequest('PROTECTED_TEMPORAL_FIELD_CHANGED');
        }
    }
    if (canonicalizer && scope && currentEmployee) {
        const simulated = canonicalizer({ scope, currentEmployee, historyRows: result });
        return { rows: result, simulated };
    }
    return { rows: result };
}

function resolveInitialPlan(plannerResult, decisions, currentEmployee, completeHistoryRows,
    canonicalizer) {
    const rules = plannerResult.internalRules;
    const rows = completeHistoryRows.map(clone);
    const rowsById = new Map(rows.map(row => [historyId(row), row]));
    const boundaryDecision = decisions.get('INITIAL_PROFILE_START');
    const start = normalizedDateForDecision(boundaryDecision, rules.hire,
        addDays(rules.profileStart, -1), rules.knownDate);
    const termsDecision = decisions.get('INITIAL_PROFILE_TERMS');
    const selected = selectedProfileValues(termsDecision, rules.candidateIds, rowsById,
        plannerResult.conflicts, {});
    const legacyIndex = rows.findIndex(row => historyId(row) === rules.legacyHistoryId);
    const legacyBefore = rows[legacyIndex];
    const selectedSource = rowForId(rows, selected.sourceHistoryId);
    const source = termsDecision.intent.id === INTENTS.ENTER_DIFFERENT_VALUE
        ? preserveKnownHistoricalProfileValues(selectedSource, legacyBefore)
        : selectedSource;
    const legacyEnd = addDays(rules.profileStart, -1);
    rows[legacyIndex] = patchProfileRow(legacyBefore, source, start, legacyEnd,
        selected.overrides);
    rows[legacyIndex][HIRE_FIELD] = dateValue(rules.hire);
    rows[legacyIndex].afora_proslhpsh = true;
    for (const conflictId of rules.supportedFieldConflictIds) {
        const fieldId = conflictId.slice('FIELD_'.length);
        const decision = decisions.get(conflictId);
        const normalized = normalizeFieldDecision(fieldId, decision);
        const entry = registryEntry(fieldId);
        const field = entry.fields[0];
        if (normalized.intent === INTENTS.CONFIRM_EXISTING) {
            rows[legacyIndex][field] = legacyBefore[field];
        } else if (normalized.intent === INTENTS.REAL_HISTORICAL_CHANGE) {
            const earlierTarget = rowForId(rows, rules.legacyHistoryId);
            const laterTarget = rowForId(rows, rules.profileHistoryId);
            earlierTarget[field] = legacyBefore[field];
            earlierTarget[END_FIELD] = dateValue(addDays(normalized.effectiveDate, -1));
            laterTarget[field] = normalized.value;
            laterTarget[START_FIELD] = dateValue(normalized.effectiveDate);
        } else {
            const currentTarget = rowForId(rows, rules.legacyHistoryId);
            currentTarget[field] = normalized.value;
        }
    }
    const survivorId = rules.profileHistoryId;
    for (const id of rules.retireHistoryIds) {
        const index = rows.findIndex(row => historyId(row) === id);
        if (index >= 0) rows[index] = retire(rows[index], survivorId);
    }
    if (start > rules.hire) {
        const spareId = rules.retireHistoryIds[0];
        const spareIndex = rows.findIndex(row => historyId(row) === spareId);
        if (spareIndex < 0) invalidRequest('INITIAL_GAP_REQUIRES_PROFILE');
        rows[spareIndex] = patchProfileRow(rows[spareIndex], source, rules.hire,
            addDays(start, -1), selected.overrides);
        rows[spareIndex][HIRE_FIELD] = dateValue(rules.hire);
        rows[spareIndex].afora_proslhpsh = true;
    }
    validateWorkTermRelationships(rows[legacyIndex]);
    const canonical = canonicalizer({ scope: plannerResult.scope,
        currentEmployee, historyRows: rows });
    if (canonical.status !== CANONICAL_STATUSES.CLEAN || canonical.cleanupRequired ||
        !canonical.idempotent) {
        invalidRequest('COMPLETED_WORKSHEET_DID_NOT_PRODUCE_CLEAN_HISTORY',
            'EMPLOYEE_HISTORY_USER_CORRECTION_SIMULATION_FAILED');
    }
    const secondCanonical = canonicalizer({ scope: plannerResult.scope,
        currentEmployee, historyRows: rows });
    return buildSelectedPlan(plannerResult, currentEmployee, completeHistoryRows, rows,
        [...decisions.values()].map(decision => ({
            conflictId: decision.conflictId,
            intent: decision.intent.id,
            ...(decision.value !== undefined ? { value: decision.value } : {}),
            ...(decision.effectiveDate !== undefined ? { effectiveDate: decision.effectiveDate } : {}),
            ...(decision.values !== undefined ? { values: decision.values } : {})
        })), {}, canonical, secondCanonical);
}

function resolveIntermediatePlan(plannerResult, decisions, currentEmployee,
    completeHistoryRows, canonicalizer) {
    const rules = plannerResult.internalRules;
    const rows = completeHistoryRows.map(clone);
    const rowsById = new Map(rows.map(row => [historyId(row), row]));
    const initialStart = normalizedDateForDecision(decisions.get('INITIAL_PROFILE_START'),
        rules.hire, rules.earlierStart, rules.earlierStart);
    const laterStart = normalizedDateForDecision(decisions.get('LATER_PROFILE_START'),
        rules.earlierStart,
        day(currentEmployee.hmeromhnia_apoxorhshs || currentEmployee[END_FIELD]) || rules.laterStart,
        rules.laterStart);
    if (laterStart <= initialStart) invalidRequest('INVALID_PROFILE_BOUNDARY_ORDER');
    let earlierIndex = rows.findIndex(row => historyId(row) === rules.earlierHistoryId);
    let laterIndex = rows.findIndex(row => historyId(row) === rules.laterHistoryId);
    let artifactIndex = rows.findIndex(row => historyId(row) === rules.artifactHistoryId);
    const earlierSource = rows[earlierIndex];
    const laterSource = rows[laterIndex];
    rows[earlierIndex] = patchProfileRow(rows[earlierIndex], earlierSource,
        initialStart, addDays(laterStart, -1));
    rows[earlierIndex][HIRE_FIELD] = dateValue(rules.hire);
    rows[earlierIndex].afora_proslhpsh = true;
    rows[laterIndex] = patchProfileRow(rows[laterIndex], laterSource, laterStart, null);
    rows[laterIndex].afora_proslhpsh = false;
    const meaning = decisions.get('INTERMEDIATE_PERIOD_MEANING');
    if (meaning.intent.id === INTENTS.RETIRE_ERRONEOUS_ARTIFACT) {
        rows[artifactIndex] = retire(rows[artifactIndex], rules.earlierHistoryId);
    } else {
        const terms = decisions.get('INTERMEDIATE_PROFILE_TERMS');
        const sourceId = profileCandidateId(terms, rules.candidateIds);
        const source = rowForId(rows, sourceId);
        const from = rules.artifactStart;
        const until = addDays(laterStart, -1);
        if (until < from) invalidRequest('INTERMEDIATE_PERIOD_OUTSIDE_TIMELINE');
        rows[artifactIndex] = patchProfileRow(rows[artifactIndex], source, from, until);
        rows[artifactIndex].afora_proslhpsh = false;
        rows[earlierIndex][END_FIELD] = dateValue(addDays(from, -1));
    }
    for (const id of rules.retireHistoryIds) {
        const index = rows.findIndex(row => historyId(row) === id);
        if (index >= 0) rows[index] = retire(rows[index], rules.earlierHistoryId);
    }
    const canonical = canonicalizer({ scope: plannerResult.scope,
        currentEmployee, historyRows: rows });
    if (canonical.status !== CANONICAL_STATUSES.CLEAN || canonical.cleanupRequired ||
        !canonical.idempotent) {
        invalidRequest('COMPLETED_WORKSHEET_DID_NOT_PRODUCE_CLEAN_HISTORY',
            'EMPLOYEE_HISTORY_USER_CORRECTION_SIMULATION_FAILED');
    }
    const secondCanonical = canonicalizer({ scope: plannerResult.scope,
        currentEmployee, historyRows: rows });
    return buildSelectedPlan(plannerResult, currentEmployee, completeHistoryRows, rows,
        [...decisions.values()].map(decision => ({
            conflictId: decision.conflictId, intent: decision.intent.id,
            ...(decision.value !== undefined ? { value: decision.value } : {}),
            ...(decision.effectiveDate !== undefined ? { effectiveDate: decision.effectiveDate } : {})
        })), {}, canonical, secondCanonical);
}

function resolveEmployeeHistoryUserConfirmedCorrection({ plannerResult, confirmation,
    currentEmployee, completeHistoryRows = [], canonicalizer = canonicalizeEmployeeHistory } = {}) {
    if (plannerResult?.status !== PLAN_STATUSES.APPLICABLE ||
        plannerResult?.resolutionKind !== RESOLUTION_KIND) invalidRequest('PLANNER_NOT_APPLICABLE');
    if (!confirmation || typeof confirmation !== 'object' || Array.isArray(confirmation) ||
        confirmation.responsibilityAccepted !== true || !Array.isArray(confirmation.decisions)) {
        invalidRequest('RESPONSIBILITY_AND_DECISIONS_REQUIRED');
    }
    const decisions = decisionMap(confirmation.decisions, plannerResult.conflicts);
    if (plannerResult.shapeKind ===
        SHAPE_KINDS.INTERMEDIATE_PERIOD_WITH_OVERLAPPING_CANDIDATES) {
        return resolveIntermediatePlan(plannerResult, decisions, currentEmployee,
            completeHistoryRows, canonicalizer);
    }
    return resolveInitialPlan(plannerResult, decisions, currentEmployee,
        completeHistoryRows, canonicalizer);
}

module.exports = {
    PLANNER_VERSION,
    OPERATION,
    RESOLUTION_KIND,
    PLAN_STATUSES,
    SHAPE_KINDS,
    INTENTS,
    BUSINESS_SUMMARY_FIELDS,
    CANONICAL_CORRECTION_REQUIREMENT_FIELDS,
    FIELD_REQUIREMENT_STATES,
    determineRequiredCorrectionFields,
    planEmployeeHistoryUserConfirmedCorrection,
    resolveEmployeeHistoryUserConfirmedCorrection,
    applyConfirmedFieldDecisionToTimeline,
    stableStringify,
    fingerprint
};
