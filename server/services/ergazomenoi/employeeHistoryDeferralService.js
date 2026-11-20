'use strict';

// Evidence and read-only policy only. All History planning/writing stays in
// employeeEmploymentProfileWriter and its existing physical write boundary.
const crypto = require('node:crypto');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const SaveState = require('../../utils/ergazomenoi/employeeSaveState');
const { CURRENT_SYNC_FIELDS } = require('./employeeHistoryRebuilderService');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const VERSION = 'employee-pending-history:v1';
const FIELD = 'employee_pending_history';
const ACTIONS = 'employee_history_external_actions';
// Short lived confirmations deliberately expire on process restart. No secret
// comes from the browser or from an environment/credential file.
const confirmationSecret = crypto.randomBytes(32);
const PROFILE_FIELDS = [...new Set([...CURRENT_SYNC_FIELDS, ...C.FACT_FIELDS,
    'afora_proslhpsh', 'afora_allagh_oron_ergasias', 'employment_profile_source',
    'afora_allagh_dialleimatos', 'hmeromhnia_isxyos_dialleimatos_apo'])];

function stable(value) {
    if (value instanceof Date) return value.toISOString();
    if (value?.toHexString) return value.toHexString();
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
        .filter(key => value[key] !== undefined).map(key => [key, stable(value[key])]));
    return value;
}
const digest = value => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const historyFingerprint = rows => digest(rows.map(stable).sort((a,b) => String(a._id).localeCompare(String(b._id))));
const businessState = current => Object.fromEntries(PROFILE_FIELDS.map(field => [field,
    Object.hasOwn(current, field) && current[field] !== undefined
        ? { recorded: true, type: Array.isArray(current[field]) ? 'Array' : current[field] instanceof Date ? 'Date' : typeof current[field], value: stable(current[field]) }
        : { recorded: false }]));
function restoreBusiness(current, recorded) {
    const result = { ...current };
    for (const [field, fact] of Object.entries(recorded)) {
        if (fact.recorded) result[field] = fact.type === 'Date' ? new Date(fact.value) : structuredClone(fact.value);
        else delete result[field];
    }
    return result;
}
function failure(reason, detail, statusCode = 409) {
    const code = `EMPLOYEE_HISTORY_DEFER_${reason}`;
    return Object.assign(new Error(`Η αποθήκευση σταμάτησε. ${detail} Δεν αποθηκεύτηκε καμία αλλαγή από αυτή την προσπάθεια.\n` +
        '1. Ελέγξτε την εκκρεμότητα και τις αρχικές ημερομηνίες στη Συντήρηση.\n' +
        '2. Επαναφορτώστε τα στοιχεία πριν δοκιμάσετε ξανά.\n' + `Κωδικός αναφοράς: ${code}.`), { code, statusCode });
}
function assertNoClientEvidence(request) {
    for (const values of [request, request.input, request.maintenance?.employeeChanges,
        request.maintenance?.historyChanges, request.maintenance?.submittedFormValues]) {
        if ([FIELD, ACTIONS, 'historyDeferred', 'externalActionsAllowed'].some(field => Object.hasOwn(values || {}, field)))
            throw failure('FORGED', 'Η επιβεβαίωση της εκκρεμότητας δεν προήλθε από τον έλεγχο της εφαρμογής.', 400);
    }
}
function storedRequest(request) {
    const strip = value => {
        if (value instanceof Date) return value.toISOString();
        if (Array.isArray(value)) return value.map(strip);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
            .filter(([key,v]) => v !== undefined && key !== 'updatedAt').map(([key,v]) => [key, strip(v)]));
        return value;
    };
    return strip({ scope: request.scope, employeeId: request.employeeId, input: request.input || {},
        maintenance: request.maintenance || {}, expectedStoredDeparture: request.expectedStoredDeparture ?? null,
        externalIntent: request.externalIntent || {}, resolution: request.pendingResolution || null });
}
function binding({ request, current, history, actorUserId }) {
    if (!actorUserId || typeof request.confirmationSession !== 'string' || !request.confirmationSession)
        throw failure('FORBIDDEN', 'Δεν επιβεβαιώθηκε ενεργή συνεδρία με δικαίωμα αποθήκευσης.', 403);
    return digest({ version: VERSION, actor: String(actorUserId), session: request.confirmationSession,
        employee: SaveState.employeeStateToken(current), history: historyFingerprint(history), proposal: storedRequest(request) });
}
function issueConfirmation(bound, decision) {
    const data = Buffer.from(JSON.stringify({ version: VERSION, bound, decision,
        id: crypto.randomUUID(), expires: Date.now() + 10 * 60 * 1000 })).toString('base64url');
    return `${data}.${crypto.createHmac('sha256', confirmationSecret).update(data).digest('base64url')}`;
}
function verifyConfirmation(token, bound, decision) {
    try {
        if (typeof token !== 'string' || token.length > 2048) throw Error();
        const [data, signature, extra] = token.split('.');
        const expected = crypto.createHmac('sha256', confirmationSecret).update(data).digest();
        const supplied = Buffer.from(signature || '', 'base64url');
        if (extra || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw Error();
        const payload = JSON.parse(Buffer.from(data, 'base64url'));
        if (payload.version !== VERSION || payload.bound !== bound || payload.decision !== decision || payload.expires < Date.now()) throw Error();
        return payload.id;
    } catch { throw failure('STALE', 'Η πρόταση ή τα αποθηκευμένα στοιχεία άλλαξαν, ή η επιβεβαίωση έληξε. Χρειάζεται νέος έλεγχος.'); }
}
const empty = value => value == null || value === '';
function missingIssues(inspection, rows) {
    const missing = [], unsafe = [];
    for (const issue of inspection.issues) {
        const row = rows.find(row => String(row._id) === issue.historyId) || {};
        const fields = issue.field ? [issue.field] : issue.fields || [];
        const isMissing = fields.length === 1 && (
            issue.reason === 'REQUIRED_PROFILE_FIELD' && (empty(row[fields[0]]) || row[fields[0]] === 0) ||
            issue.reason === 'NUMERIC_PROFILE_FACT_UNRECORDED' && empty(row[fields[0]]) ||
            issue.check === 'POSITIVE_WORK_TIME_REQUIRED' && (empty(row[fields[0]]) || row[fields[0]] === 0) ||
            issue.check === 'PROFILE_REQUIRED_WHEN_ENABLED' && empty(row[fields[0]]));
        if (!isMissing) { unsafe.push(issue); continue; }
        const field = fields[0];
        if (!missing.some(item => item.field === field && item.historyId === issue.historyId)) missing.push({
            field, label: labels[field] || issue.label || field, historyId: issue.historyId,
            group: /Misthos|Hmeromisthio|Oromisthio|poso_|synolo_/.test(field) ? 'Αποδοχές' :
                /krathsh/.test(field) ? 'Ασφάλιση' : /symbash/.test(field) ? 'Σύμβαση' : 'Όροι απασχόλησης',
            reason: 'Δεν έχει καταγραφεί έγκυρη απαιτούμενη τιμή για τη συγκεκριμένη ιστορική περίοδο.'
        });
    }
    return { missing, unsafe };
}
function selectedActions(intent = {}) {
    const selected = [];
    if (intent.e3_anaggelia_proslhpshs === true) selected.push('E3N');
    if (intent.ma_222 === true) selected.push('E7N');
    if (intent.ma_217 === true) selected.push('E5N');
    if (intent.ma_220 === true || intent.ma_221 === true) selected.push('E6N');
    if (intent.e3_metaboles_ergasiakhs_sxeshs === true || intent.e3_metaboles_ergasiakhs_sxeshs_daneizomenoy_prosopikoy === true) selected.push('MA');
    if (intent.schedules === true || intent.wto_pshfiakh_organosh_xronoy_ergasias === true) selected.push('WTO');
    return [...new Set(selected)];
}
function externalParameters(request, proposed) {
    const intent = request.externalIntent || {};
    const day = field => C.calendarDate(proposed[field])?.toISOString().slice(0,10) || null;
    return { method: intent.erganiUploadMethod === 'rest' && intent.isPermanent === true ? 'rest' : 'xml',
        hire: day('hmeromhnia_proslhpshs'), departure: day('hmeromhnia_apoxorhshs'),
        scheduleFrom: day('hmeromhnia_allaghs_orarioy_apo'), scheduleUntil: day('hmeromhnia_allaghs_orarioy_eos'),
        branch: String(proposed.ypokatasthma || '0'), mutationDate: request.maintenance?.submittedFormValues?.hmeromhnia_metabolhs || null,
        processCode: intent.ma_222 === true ? '222' : intent.ma_217 === true ? '217' : intent.ma_221 === true ? '221' :
            intent.ma_220 === true ? '220' : intent.e3_metaboles_ergasiakhs_sxeshs === true ? '230' : '231' };
}
function descriptor({ request, current, proposed, history, composed, missing, actorUserId, requestId }) {
    const profileEffectiveFrom = C.calendarDate(proposed.hmeromhnia_isxyos_oron_ergasias_apo);
    const effectiveFrom = composed.lifecycleOperation
        ? C.calendarDate(proposed.hmeromhnia_apoxorhshs || current.hmeromhnia_apoxorhshs) : profileEffectiveFrom;
    if (!effectiveFrom || !composed.targetHistoryId) throw failure('UNSAFE', 'Δεν αποδείχθηκε η αρχική περίοδος της μεταβολής.');
    return { version: VERSION, id: requestId, actorUserId: String(actorUserId), createdAt: new Date(),
        effectiveFrom, profileEffectiveFrom, eventType: composed.lifecycleOperation || 'MAINTENANCE',
        targetHistoryId: composed.targetHistoryId,
        targetCycle: { hire: C.calendarDate(current.hmeromhnia_proslhpshs), departure: C.calendarDate(current.hmeromhnia_apoxorhshs) },
        before: businessState(current), after: businessState(proposed),
        historyPlan: composed.physicalPlan.rowsToUpdate.map(({ historyId }) => ({ historyId,
            before: businessState(history.find(row => String(row._id) === historyId)),
            after: businessState(composed.physicalPlan.finalRows.find(row => String(row._id) === historyId)) })),
        originalHistoryFingerprint: historyFingerprint(history), originalEmployeeFingerprint: SaveState.employeeStateToken(current),
        originalRequest: replayEvidenceRequest(request), originalProposalDigest: digest(storedRequest(request)), originalRequestIdentity: requestId,
        missingFields: missing, reason: 'MISSING_REQUIRED_HISTORY_FIELDS',
        submissionCompletionStatus: 'TRACKED_SEPARATELY', actionKey: requestId };
}
function replayEvidenceRequest(request) {
    const saved = storedRequest(request), fields = new Set(PROFILE_FIELDS);
    const select = values => Object.fromEntries(Object.entries(values || {}).filter(([field]) => fields.has(field)));
    saved.input = select(saved.input);
    saved.maintenance.employeeChanges = select(saved.maintenance.employeeChanges);
    saved.maintenance.historyChanges = select(saved.maintenance.historyChanges);
    saved.maintenance.submittedHistoryChanges = select(saved.maintenance.submittedHistoryChanges);
    saved.maintenance.submittedEmployeeFields = (saved.maintenance.submittedEmployeeFields ||
        Object.keys(saved.maintenance.employeeChanges)).filter(field => fields.has(field));
    // Preserve source aliases and neutral echoes, but never duplicate attachments,
    // personal details or full browser payloads in the historical descriptor.
    saved.maintenance.submittedFormValues = Object.fromEntries(Object.entries(saved.maintenance.submittedFormValues || {})
        .filter(([field]) => fields.has(field) || fields.has(field.replace(/(?:_stathera|_edit|Hidden)$/, ''))));
    saved.maintenance.submittedFormFields = Object.keys(saved.maintenance.submittedFormValues);
    saved.externalIntent = {};
    return saved;
}
function pendingResponse(current, history, extra = {}) {
    return { employee: current, employeeUpdated: true, historyDeferred: true, historyUpdated: false,
        historyAlreadyClean: false, historyChangedRows: 0, historyStatus: 'PENDING_EMPLOYEE_RECONCILIATION',
        historyAccessMode: 'READ_ONLY', externalActionsAllowed: true,
        protectedHistoryCount: history.length, historyChecksum: historyFingerprint(history),
        idempotencyKey: current[FIELD]?.actionKey, pendingHistory: publicPending(current[FIELD]), ...extra };
}
function publicPending(pending) {
    if (!pending) return null;
    return { id: pending.id, version: pending.version, effectiveFrom: pending.effectiveFrom,
        eventType: pending.eventType, missingFields: pending.missingFields, targetHistoryId: pending.targetHistoryId };
}
function replayRequest({ pending, request, current, history }) {
    if (pending.version !== VERSION || pending.originalHistoryFingerprint !== historyFingerprint(history))
        throw failure('REPLAY_UNSAFE', 'Το αρχικό Ιστορικό άλλαξε. Η εκκρεμότητα διατηρείται για τεκμηριωμένο έλεγχο.');
    const resolution = request.pendingResolution;
    const changes = request.maintenance?.employeeChanges || {}, form = request.maintenance?.submittedFormValues || {};
    const owned = new Set(request.maintenance?.submittedEmployeeFields || Object.keys(changes));
    const allowed = new Set(pending.missingFields.map(item => item.field));
    const schema = require('../../models/ergazomenoi').ErgazomenoiModel.schema;
    for (const field of PROFILE_FIELDS) {
        if (!owned.has(field) || !Object.hasOwn(changes, field) || allowed.has(field)) continue;
        const path = schema.path(field);
        const equal = require('./employeeHistoryAutomaticReconstructionApplyContract').equal;
        if (path && !equal(path.cast(changes[field]), path.cast(current[field])))
            throw failure('SECOND_CHANGE', 'Υπάρχει ήδη εκκρεμής μεταβολή. Η νέα μεταβολή όρων δεν συγχωνεύεται με την πρώτη.');
    }
    if (resolution?.id !== pending.id || resolution.confirmed !== true ||
        C.calendarDate(resolution.effectiveFrom)?.getTime() !== C.calendarDate(pending.effectiveFrom)?.getTime())
        throw failure('REPLAY_REQUIRED', 'Η συμπλήρωση χρειάζεται ρητή επιβεβαίωση της αρχικής περιόδου.');
    const replay = structuredClone(pending.originalRequest);
    delete replay.resolution;
    const completion = {};
    for (const field of allowed) {
        const sources = [field, `${field}_stathera`, `${field}_edit`, `${field}Hidden`];
        if (!owned.has(field) || !sources.some(source => Object.hasOwn(form, source) && !empty(form[source])) || !Object.hasOwn(changes, field))
            throw failure('STILL_MISSING', 'Δεν συμπληρώθηκαν όλα τα απαιτούμενα στοιχεία της αρχικής εκκρεμότητας.');
        completion[field] = changes[field];
    }
    replay.maintenance.employeeChanges = { ...replay.maintenance.employeeChanges, ...completion };
    replay.maintenance.submittedEmployeeFields = [...new Set([...(replay.maintenance.submittedEmployeeFields || []), ...Object.keys(completion)])];
    replay.maintenance.historyChanges = { ...replay.maintenance.historyChanges, ...completion };
    replay.maintenance.submittedHistoryChanges = { ...replay.maintenance.submittedHistoryChanges, ...completion };
    replay.maintenance.submittedFormValues = { ...replay.maintenance.submittedFormValues, ...completion };
    return { replay, before: restoreBusiness(current, pending.before), completion };
}
function assertReplayPlan(pending, composed) {
    if (composed.targetHistoryId !== pending.targetHistoryId || !Array.isArray(pending.historyPlan))
        throw failure('REPLAY_UNSAFE', 'Δεν επιβεβαιώθηκε ο ίδιος αρχικός ιστορικός στόχος.');
    const { IstorikoProslhpseonAllagonModel } = require('../../models/ergazomenoi');
    const equal = require('./employeeHistoryAutomaticReconstructionApplyContract').equal;
    for (const promised of pending.historyPlan) {
        const after = composed.physicalPlan.finalRows.find(row => String(row._id) === promised.historyId);
        if (!after) throw failure('REPLAY_UNSAFE', 'Δεν βρέθηκε μία από τις αρχικές ιστορικές περιόδους.');
        const missing = new Set(pending.missingFields.filter(item => item.historyId === promised.historyId).map(item => item.field));
        for (const [field, fact] of Object.entries(promised.after)) {
            if (!fact.recorded || missing.has(field)) continue;
            const path = IstorikoProslhpseonAllagonModel.schema.path(field);
            if (path && !equal(path.cast(fact.value), path.cast(after[field])))
                throw failure('REPLAY_UNSAFE', 'Η ανασύνθεση διαφέρει από τα αρχικά τεκμηριωμένα στοιχεία. Η εκκρεμότητα διατηρείται.');
        }
    }
}
function sendError(res, error) {
    if (!String(error?.code).startsWith('EMPLOYEE_HISTORY_DEFER_')) return false;
    res.status(error.statusCode || 409).json({ success: false, reason: error.code,
        historyStatus: 'PENDING_EMPLOYEE_RECONCILIATION', message: error.message, errorMessage: error.message });
    return true;
}
module.exports = { VERSION, FIELD, ACTIONS, PROFILE_FIELDS, stable, digest, historyFingerprint, businessState,
    failure, assertNoClientEvidence, storedRequest, binding, issueConfirmation, verifyConfirmation, missingIssues,
    descriptor, selectedActions, externalParameters, pendingResponse, publicPending, replayRequest, assertReplayPlan, sendError };
