'use strict';

const crypto = require('node:crypto');
const { isMinimalLegacyOpenCycleFoundation } = require('../../models/employeeEmploymentProfileFields');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const { effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { buildEmploymentCycles } = require('./employeeEmploymentCycleResolverService');
const { canonicalizeEmployeeHistory, CANONICAL_STATUSES } = require('./employeeHistoryCanonicalizationService');
const { buildEmployeeHistoryEditorStateToken } = require('./employeeHistoryEditorStateService');
const { CORRECTION_FIELD_REGISTRY, registryEntry, normalizedCatalog,
    normalizeConfirmedFieldValue, validateWorkTermRelationships } = require('./employeeHistoryCorrectionFieldRegistryService');

const KIND = 'EMPLOYEE_HISTORY_SAFE_CORRECTION';
const INTENTS = Object.freeze(['REVIEW', 'REMOVE_ROW', 'REPLACE_START', 'CORRECT_DEPARTURE',
    'CANCEL_DEPARTURE', 'REMOVE_RELATIONSHIP', 'INSERT_EVENT']);
const START = 'hmeromhnia_isxyos_oron_ergasias_apo';
const END = 'hmeromhnia_isxyos_oron_ergasias_eos';
const HIRE = 'hmeromhnia_proslhpshs';
const DEPARTURE = 'hmeromhnia_apoxorhshs';
const day = value => C.calendarDate(value)?.toISOString().slice(0, 10) || '';
const id = row => String(row?._id || '');
const greekDate = value => day(value).split('-').reverse().join('/') || '—';
const sameDate = (a, b) => day(a) === day(b);
const stable = value => value instanceof Date ? value.toISOString() : Array.isArray(value)
    ? value.map(stable) : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
const exact = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));

function correctionError(code, message) {
    const error = new Error(code);
    error.code = code; error.statusCode = 409;
    error.publicMessage = `${message} Δεν έχει γίνει καμία αλλαγή. 1. Κλείστε το παράθυρο. 2. Ελέγξτε τα στοιχεία με διαχειριστή. 3. Ανοίξτε ξανά τον εργαζόμενο πριν δοκιμάσετε πάλι.`;
    return error;
}
function invalid() { throw correctionError('EMPLOYEE_HISTORY_CORRECTION_INVALID_REQUEST',
    'Η εφαρμογή δεν μπορεί να χρησιμοποιήσει αυτές τις απαντήσεις για τη διόρθωση του Ιστορικού.'); }
function normalizeCorrectionRequest(raw) {
    if (!raw || !exact(raw, ['intent', 'targetHistoryId', 'facts', 'confirmation']) ||
        !INTENTS.includes(raw.intent) || typeof raw.targetHistoryId !== 'string' ||
        !/^[a-f0-9]{24}$/i.test(raw.targetHistoryId) ||
        !raw.facts || Object.getPrototypeOf(raw.facts) !== Object.prototype) invalid();
    const allowed = {
        REVIEW: [], REMOVE_ROW: [], REPLACE_START: Object.keys(raw.facts).length ? ['fieldId','value'] : [], REMOVE_RELATIONSHIP: [],
        CORRECT_DEPARTURE: ['departureDate'], CANCEL_DEPARTURE: ['periodEnd'],
        INSERT_EVENT: ['effectiveDate', 'fieldId', 'value', 'previousPeriodEnd']
    }[raw.intent];
    if (!exact(raw.facts, allowed)) invalid();
    for (const key of ['departureDate', 'periodEnd', 'effectiveDate', 'previousPeriodEnd']) {
        if (!Object.hasOwn(raw.facts, key)) continue;
        const value = raw.facts[key];
        if (key === 'periodEnd' && value === null) continue;
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || day(value) !== value) invalid();
    }
    if ((raw.intent === 'INSERT_EVENT' || raw.intent === 'REPLACE_START' && Object.keys(raw.facts).length) &&
        !registryEntry(raw.facts.fieldId)) invalid();
    if (raw.confirmation !== null && (!exact(raw.confirmation, ['fingerprint', 'confirmed']) ||
        !/^[a-f0-9]{64}$/.test(raw.confirmation.fingerprint) || raw.confirmation.confirmed !== true)) invalid();
    if (raw.intent === 'REVIEW' && raw.confirmation !== null) invalid();
    return { intent: raw.intent, targetHistoryId: raw.targetHistoryId,
        facts: { ...raw.facts }, confirmation: raw.confirmation && { ...raw.confirmation } };
}

// Authenticity is a conjunction of independent persisted evidence, never a flag
// or date comparison alone. Canonical lifecycle/period evidence must agree with
// a unique first boundary, the cycle and the server-created provenance.
function classifyHistoryEvidence({ scope, currentEmployee, historyRows }) {
    const rows = semanticHistoryRows(historyRows);
    const canonical = canonicalizeEmployeeHistory({ scope, currentEmployee, historyRows });
    let cycles;
    try { cycles = buildEmploymentCycles({ currentEmployee, history: rows }); } catch { cycles = []; }
    return rows.map(row => {
        const hire = day(row[HIRE]);
        const cycle = cycles.find(c => c.hire_date === hire);
        const members = rows.filter(r => day(r[HIRE]) === hire);
        const boundaries = members.filter(r => isMinimalLegacyOpenCycleFoundation(r) ||
            sameDate(effectiveStart(r), hire) ||
            !effectiveStart(r) && sameDate(r.hmeromhnia_allaghs_symbashs, hire));
        const first = [...members].filter(r => effectiveStart(r)).sort((a,b) =>
            effectiveStart(a) - effectiveStart(b));
        const source = ['EMPLOYEE_PROFILE_FOUNDATION', 'LEGACY_OPEN_CYCLE_CLEANUP_FOUNDATION']
            .includes(row.employment_profile_source);
        const events = canonical.classifications?.find(c => c.historyId === id(row))?.eventTypes || [];
        const supported = events.includes('HIRE') || events.some(e => e.includes('PROFILE_CHANGE')) &&
            C.readEmploymentProfile(row).recorded;
        const authenticHire = Boolean(cycle && canonical.status !== CANONICAL_STATUSES.TRUE_AMBIGUITY &&
            source && row.afora_proslhpsh === true && boundaries.length === 1 &&
            id(boundaries[0]) === id(row) && (!first.length || id(first[0]) === id(row) ||
                !effectiveStart(row) && day(effectiveStart(first[0])) >= hire) && supported);
        const soleStart = Boolean(cycle && (boundaries.length === 1 && id(boundaries[0]) === id(row) ||
            members.length === 1));
        const departures = members.filter(r => day(r[DEPARTURE]));
        const soleDeparture = Boolean(day(row[DEPARTURE]) && departures.length === 1);
        const uncertainHire = !authenticHire && Boolean(row.afora_proslhpsh === true ||
            boundaries.some(r => id(r) === id(row))) &&
            !canonical.replacementByDeletedId?.[id(row)];
        return { row, cycle, authenticHire, soleStart, soleDeparture, uncertainHire,
            redundant: Boolean(canonical.replacementByDeletedId?.[id(row)]) };
    });
}

function protectedIntent(evidence, operations, historyRows) {
    const deletes = new Set(operations.filter(op => op.state === 'deleted').map(op => op.historyId));
    const whole = evidence.some(e => e.cycle?.departure_date && !e.cycle.is_current_cycle &&
        e.cycle.history_ids.length && e.cycle.history_ids.every(value => deletes.has(value)));
    if (whole) return 'REMOVE_RELATIONSHIP';
    if (evidence.some(e => day(e.row[DEPARTURE]) &&
        historyRows.filter(row => day(row[HIRE]) === day(e.row[HIRE]) && day(row[DEPARTURE]))
            .every(row => deletes.has(id(row))))) return 'CORRECT_DEPARTURE';
    for (const op of operations) {
        const e = evidence.find(item => id(item.row) === op.historyId);
        if (!e) continue;
        if (op.state === 'deleted') {
            if (e.authenticHire || e.soleStart || e.uncertainHire) return 'REPLACE_START';
            if (e.soleDeparture) return 'CORRECT_DEPARTURE';
        }
        const patch = op.maintenance?.historyChanges || {};
        if (op.state === 'modified' && (e.authenticHire || e.soleStart) &&
            [HIRE, START].some(key => Object.hasOwn(patch,key) && !sameDate(patch[key], e.row[key]))) {
            return 'REPLACE_START';
        }
        if (op.state === 'modified' && e.soleDeparture && Object.hasOwn(patch, DEPARTURE) &&
            !sameDate(patch[DEPARTURE], e.row[DEPARTURE])) return 'CORRECT_DEPARTURE';
    }
    return null;
}
function assertOrdinaryHistoryPolicy({ scope, currentEmployee, historyRows, operations }) {
    const intent = protectedIntent(classifyHistoryEvidence({ scope, currentEmployee, historyRows }), operations, historyRows);
    if (intent) throw correctionError('EMPLOYEE_HISTORY_CORRECTION_REQUIRED', intent === 'CORRECT_DEPARTURE'
        ? 'Η μόνη εγγραφή αποχώρησης δεν μπορεί να διαγραφεί απευθείας. Επιλέξτε «Έλεγχος / Διόρθωση».'
        : intent === 'REMOVE_RELATIONSHIP' ? 'Μια παλιά εργασιακή σχέση δεν μπορεί να διαγραφεί από τις γραμμές του Ιστορικού. Επιλέξτε «Έλεγχος / Διόρθωση».'
            : 'Η εγγραφή που δείχνει την αρχή της εργασιακής σχέσης δεν μπορεί να διαγραφεί απευθείας. Επιλέξτε «Έλεγχος / Διόρθωση».');
}

function assertCorrectionRolePolicy({ scope, currentEmployee, historyBefore, historyAfter,
    currentAfter = currentEmployee, accessMode }) {
    if (accessMode === 'ADMIN_FULL') return;
    const after = new Map(historyAfter.map(row => [id(row),row]));
    const evidence = classifyHistoryEvidence({ scope,currentEmployee,historyRows:historyBefore });
    let boundaryChanges = 0;
    const destructive = evidence.some(e => {
        const remaining = after.get(id(e.row));
        if (!remaining) return e.authenticHire || e.soleStart || e.soleDeparture || e.uncertainHire;
        if (!sameDate(e.row[HIRE],remaining[HIRE])) return true;
        if ((e.authenticHire || e.soleStart || e.uncertainHire) &&
            e.row.afora_proslhpsh === true && remaining.afora_proslhpsh !== true) return true;
        if (e.soleDeparture && day(e.row[DEPARTURE]) && !day(remaining[DEPARTURE])) return true;
        if ([START,HIRE,DEPARTURE].some(field => !sameDate(e.row[field],remaining[field]))) boundaryChanges++;
        return false;
    });
    if (destructive || boundaryChanges > 1 ||
        day(currentEmployee[DEPARTURE]) && !day(currentAfter[DEPARTURE]) ||
        !sameDate(currentEmployee[HIRE],currentAfter[HIRE])) {
        throw correctionError('EMPLOYEE_HISTORY_CORRECTION_ADMIN_REQUIRED',
            'Η διόρθωση επηρεάζει βασικά στοιχεία της εργασιακής σχέσης. Για λόγους ασφάλειας, χρειάζεται έλεγχος από διαχειριστή.');
    }
}

function previewHistory({ scope, currentEmployee, historyRows }) {
    const evidence = classifyHistoryEvidence({ scope, currentEmployee, historyRows });
    return [...semanticHistoryRows(historyRows)].sort((a,b) =>
        day(a[HIRE]).localeCompare(day(b[HIRE])) ||
        day(effectiveStart(a) || a[DEPARTURE] || a[HIRE]).localeCompare(day(effectiveStart(b) || b[DEPARTURE] || b[HIRE])) || id(a).localeCompare(id(b)))
        .flatMap(row => {
            const e = evidence.find(x => id(x.row) === id(row));
            const event = e?.authenticHire || e?.soleStart ? 'Πρόσληψη' : day(row[DEPARTURE])
                ? 'Αποχώρηση' : effectiveStart(row) ? 'Αλλαγή όρων' : 'Στοιχεία εργασίας';
            const summary = { date: greekDate(event === 'Αποχώρηση' ? row[DEPARTURE] : effectiveStart(row) || row[HIRE]),
                event, period: `${greekDate(effectiveStart(row) || row[HIRE])} – ${effectiveEnd(row) ? greekDate(effectiveEnd(row)) : 'χωρίς ημερομηνία λήξης'}`,
                details: CORRECTION_FIELD_REGISTRY.filter(entry => row[entry.fields[0]] != null)
                    .map(entry => `${entry.label}: ${String(row[entry.fields[0]])}`) };
            if (!day(row[DEPARTURE]) || !effectiveStart(row)) return [summary];
            return [{ ...summary, event: e?.authenticHire || e?.soleStart ? 'Πρόσληψη' : 'Αλλαγή όρων',
                date: greekDate(effectiveStart(row)) },
                { date: greekDate(row[DEPARTURE]), event: 'Αποχώρηση', period: summary.period, details: [] }];
        });
}

const LABELS = Object.freeze({
    REMOVE_ROW: 'Η εγγραφή μπήκε κατά λάθος', REPLACE_START: 'Αντικατάσταση της εγγραφής έναρξης',
    CORRECT_DEPARTURE: 'Η αποχώρηση έγινε σε άλλη ημερομηνία',
    CANCEL_DEPARTURE: 'Η αποχώρηση δεν έγινε ποτέ', REMOVE_RELATIONSHIP: 'Όλη η παλιά εργασιακή σχέση μπήκε κατά λάθος',
    INSERT_EVENT: 'Λείπει μια παλαιότερη αλλαγή όρων'
});
function reviewChoices(e) {
    const choices = [];
    if (!e.authenticHire && !e.soleStart && !e.soleDeparture && !e.uncertainHire) choices.push('REMOVE_ROW');
    if (e.authenticHire || e.soleStart || e.uncertainHire) choices.push('REPLACE_START');
    if (e.soleDeparture) choices.push('CORRECT_DEPARTURE', 'CANCEL_DEPARTURE');
    if (e.cycle?.departure_date && !e.cycle.is_current_cycle) choices.push('REMOVE_RELATIONSHIP');
    if (effectiveStart(e.row) && effectiveEnd(e.row)) choices.push('INSERT_EVENT');
    return choices;
}
function fundamental(e, intent) {
    return ['REPLACE_START', 'CORRECT_DEPARTURE', 'CANCEL_DEPARTURE', 'REMOVE_RELATIONSHIP'].includes(intent) ||
        intent === 'REMOVE_ROW' && (e.authenticHire || e.soleStart || e.soleDeparture || e.uncertainHire);
}
function publicResolution({ phase, fingerprint, explanation, attention, recommendation = null,
    changes = [], unchanged = [], before = [], after = [], choices = [], fields = [] }) {
    return { version: 1, kind: KIND, phase, title: 'Έλεγχος / Διόρθωση Ιστορικού',
        explanation, attention, recommendation, changes, unchanged,
        preview: { before, after }, choices, fields, fingerprint };
}

// Pure proposal construction. No model writes, no reference remapping, no second
// CRUD engine. The writer will preflight and execute through its existing path.
function planHistoryCorrection({ scope, currentEmployee, historyRows, request, accessMode,
    catalogs = {}, insertId }) {
    const evidence = classifyHistoryEvidence({ scope, currentEmployee, historyRows });
    const e = evidence.find(item => id(item.row) === request.targetHistoryId);
    if (!e) throw correctionError('EMPLOYEE_HISTORY_CORRECTION_TARGET_MISSING', 'Η επιλεγμένη εγγραφή δεν υπάρχει πλέον στο Ιστορικό.');
    const before = previewHistory({ scope, currentEmployee, historyRows });
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(stable({ version: 1,
        state: buildEmployeeHistoryEditorStateToken({ currentEmployee, historyRows }),
        intent: request.intent, target: request.targetHistoryId, facts: request.facts, accessMode, catalogs }))).digest('hex');
    const blocked = message => ({ blocked: true, public: publicResolution({ phase: 'BLOCKED', fingerprint,
        explanation: message, attention: 'Δεν έχει γίνει καμία αλλαγή. 1. Ακυρώστε τη διόρθωση. 2. Ζητήστε έλεγχο από διαχειριστή.', before }) });
    if (request.intent !== 'REVIEW' && (!reviewChoices(e).includes(request.intent))) {
        return blocked('Η εφαρμογή δεν μπορεί να κάνει αυτή τη διόρθωση με ασφάλεια για την επιλεγμένη εγγραφή.');
    }
    if (request.intent !== 'REVIEW' && fundamental(e,request.intent) && accessMode !== 'ADMIN_FULL') {
        return blocked('Η διόρθωση επηρεάζει βασικά στοιχεία της εργασιακής σχέσης. Για λόγους ασφάλειας, χρειάζεται έλεγχος από διαχειριστή.');
    }
    const fields = CORRECTION_FIELD_REGISTRY.map(entry => ({ id: entry.id, label: entry.label,
        type: entry.dataType, ...(entry.min !== undefined ? { min: entry.min, max: entry.max } : {}),
        ...(entry.catalog ? { allowedValues: normalizedCatalog(catalogs[entry.catalog]) } : {}) }));
    if (request.intent === 'REVIEW') {
        return { public: publicResolution({ phase: 'CHOICE', fingerprint,
            explanation: e.authenticHire ? 'Η εγγραφή πρόσληψης δεν μπορεί να διαγραφεί απευθείας.'
                : e.soleStart ? 'Αυτή είναι η μόνη εγγραφή που δείχνει πότε ξεκίνησε η εργασιακή σχέση.'
                    : e.soleDeparture ? 'Αυτή είναι η μόνη εγγραφή που δείχνει την αποχώρηση.'
                        : 'Επιλέξτε τι χρειάζεται να διορθωθεί στην εγγραφή.',
            attention: 'Η εφαρμογή δεν μπορεί να γνωρίζει με ασφάλεια τι συνέβη από τα διαθέσιμα στοιχεία. Επιλέξτε μόνο αυτό που γνωρίζετε ότι είναι σωστό. Δεν έχει γίνει καμία αλλαγή.',
            before, choices: reviewChoices(e).map(intent => ({ id: intent, label: LABELS[intent] })), fields }) };
    }
    const target = e.row;
    let desired = historyRows.map(row => ({ ...row }));
    let currentPatch = {};
    const replace = (targetId, patch) => { desired = desired.map(row => id(row) === targetId ? { ...row, ...patch } : row); };
    const affectedIds = new Set([id(target)]);
    const changes = [];
    if (request.intent === 'REMOVE_ROW') {
        desired = desired.filter(row => id(row) !== id(target));
        changes.push('Θα αφαιρεθεί μόνο η επιλεγμένη εγγραφή. Το κενό ανάμεσα στις περιόδους θα παραμείνει.');
    } else if (request.intent === 'REMOVE_RELATIONSHIP') {
        const remove = new Set(e.cycle.history_ids);
        desired = desired.filter(row => !remove.has(id(row)));
        e.cycle.history_ids.forEach(value => affectedIds.add(value));
        changes.push(`Θα αφαιρεθούν όλα τα ${remove.size} γεγονότα της παλιάς εργασιακής σχέσης που εμφανίζονται παρακάτω.`);
    } else if (request.intent === 'REPLACE_START') {
        if (e.uncertainHire || !e.cycle) return blocked('Η εφαρμογή δεν έχει αρκετά στοιχεία για να επιβεβαιώσει ποια είναι η σωστή πρόσληψη.');
        if (request.facts.fieldId && !C.readEmploymentProfile(target).recorded) {
            return blocked('Η εγγραφή έναρξης δεν έχει αρκετά στοιχεία για αυτή τη διόρθωση όρων. Χρειάζεται έλεγχος από διαχειριστή.');
        }
        const replacement = { ...target, _id: insertId };
        delete replacement.createdAt; delete replacement.updatedAt;
        desired = desired.filter(row => id(row) !== id(target)); desired.push(replacement);
        changes.push('Η εγγραφή έναρξης θα αντικατασταθεί στην ίδια αποθήκευση. Η ημερομηνία πρόσληψης θα παραμείνει ίδια.');
        if (request.facts.fieldId) {
            const entry = registryEntry(request.facts.fieldId);
            const value = normalizeConfirmedFieldValue(entry.id, request.facts.value,
                { allowedValues: entry.catalog ? normalizedCatalog(catalogs[entry.catalog]) : [] });
            replacement[entry.fields[0]] = value;
            validateWorkTermRelationships(replacement);
            changes.push(`Θα διορθωθεί το στοιχείο ${entry.label}: ${String(value)}.`);
            if (sameDate(effectiveStart(target),effectiveStart(currentEmployee)) &&
                e.cycle.is_current_cycle && !historyRows.some(row => effectiveStart(row) > effectiveStart(target))) {
                currentPatch[entry.fields[0]] = value;
                changes.push('Το ίδιο στοιχείο θα διορθωθεί και στα σημερινά στοιχεία του εργαζομένου.');
            }
        }
    } else if (request.intent === 'CORRECT_DEPARTURE' || request.intent === 'CANCEL_DEPARTURE') {
        const departure = request.intent === 'CORRECT_DEPARTURE' ? C.calendarDate(request.facts.departureDate) : null;
        if (departure && day(departure) < e.cycle?.hire_date) return blocked('Η αποχώρηση δεν μπορεί να είναι πριν από την πρόσληψη.');
        const cycleRows = desired.filter(row => day(row[HIRE]) === e.cycle?.hire_date);
        const terminalProfile = [...cycleRows].filter(row => effectiveStart(row)).sort((a,b) => effectiveStart(a) - effectiveStart(b)).at(-1);
        if (!terminalProfile || !e.cycle) return blocked('Η εφαρμογή δεν μπορεί να επιβεβαιώσει την περίοδο που αφορά η αποχώρηση.');
        replace(id(target), { [DEPARTURE]: departure });
        const end = departure || C.calendarDate(request.facts.periodEnd);
        if (end && end < effectiveStart(terminalProfile)) return blocked('Η λήξη της περιόδου είναι πριν από την αρχή της.');
        replace(id(terminalProfile), { [END]: end }); affectedIds.add(id(terminalProfile));
        changes.push(departure ? `Η αποχώρηση και η λήξη της τελευταίας περιόδου θα γίνουν στις ${greekDate(departure)}.`
            : 'Η αποχώρηση θα ακυρωθεί. Η εργασιακή σχέση θα εμφανίζεται ενεργή, με τη λήξη περιόδου που δηλώσατε.');
        if (e.cycle.is_current_cycle) currentPatch = { [DEPARTURE]: departure, [END]: end,
            energos: departure ? false : true, employment_departure_restore: null };
    } else if (request.intent === 'INSERT_EVENT') {
        const start = C.calendarDate(request.facts.effectiveDate), end = effectiveEnd(target);
        const previousEnd = C.calendarDate(request.facts.previousPeriodEnd);
        if (!C.readEmploymentProfile(target).recorded || !start || !end ||
            start <= effectiveStart(target) || start > end || previousEnd < effectiveStart(target) || previousEnd >= start) {
            return blocked('Η παλαιότερη αλλαγή πρέπει να βρίσκεται μέσα στην επιλεγμένη περίοδο και να μην καλύπτει τις ίδιες ημέρες με άλλη εγγραφή.');
        }
        const entry = registryEntry(request.facts.fieldId);
        const value = normalizeConfirmedFieldValue(entry.id, request.facts.value,
            { allowedValues: entry.catalog ? normalizedCatalog(catalogs[entry.catalog]) : [] });
        const inserted = { ...target, _id: insertId, [START]: start, [END]: end,
            [entry.fields[0]]: value, afora_proslhpsh: false, [DEPARTURE]: null,
            hmeromhnia_isxyos_dialleimatos_apo: start };
        delete inserted.createdAt; delete inserted.updatedAt;
        validateWorkTermRelationships(inserted);
        replace(id(target), { [END]: previousEnd }); desired.push(inserted);
        changes.push(`Θα προστεθεί αλλαγή όρων στις ${greekDate(start)}: ${entry.label} = ${String(value)}.`,
            `Η προηγούμενη περίοδος θα λήγει στις ${greekDate(previousEnd)}. Αυτή η αλλαγή γίνεται μόνο με την επιβεβαίωσή σας.`);
    }
    if (request.intent === 'INSERT_EVENT') {
        desired.sort((a,b) => day(a[HIRE]).localeCompare(day(b[HIRE])) ||
            day(effectiveStart(a) || a[DEPARTURE] || a[HIRE])
                .localeCompare(day(effectiveStart(b) || b[DEPARTURE] || b[HIRE])) || id(a).localeCompare(id(b)));
        desired = desired.map((row,index) => ({ ...row,aa_eggrafhs:String(index+1).padStart(4,'0') }));
    }
    const currentAfter = { ...currentEmployee, ...currentPatch };
    try { buildEmploymentCycles({ currentEmployee: currentAfter, history: desired }); } catch {
        return blocked('Οι ημερομηνίες δεν συμφωνούν με τις άλλες εργασιακές σχέσεις του εργαζομένου.');
    }
    const canonical = canonicalizeEmployeeHistory({ scope, currentEmployee: currentAfter, historyRows: desired });
    // Never silently accept an additional boundary change, survivor deletion or
    // current projection rewrite. Every business change must already be previewed.
    if (canonical.status === CANONICAL_STATUSES.TRUE_AMBIGUITY || canonical.rowsToUpdate.length ||
        canonical.rowsToDelete.length || canonical.rowsToInsert.length || Object.keys(canonical.employeePatch || {}).length) {
        return blocked('Η εφαρμογή δεν μπορεί να επιβεβαιώσει τη διόρθωση χωρίς να αλλάξει και άλλα στοιχεία. Χρειάζεται έλεγχος των γύρω περιόδων.');
    }
    const after = previewHistory({ scope, currentEmployee: currentAfter, historyRows: desired });
    return { desiredRows: desired, currentPatch, affectedIds: [...affectedIds],
        fundamental: fundamental(e, request.intent),
        public: publicResolution({ phase: 'PREVIEW', fingerprint,
            explanation: 'Η εφαρμογή ετοίμασε τη διόρθωση με βάση την επιλογή σας. Ελέγξτε όλα τα στοιχεία πριν την επιβεβαίωση.',
            attention: 'Η διόρθωση θα αποθηκευτεί μόνο αν την επιβεβαιώσετε. Με την ακύρωση δεν αλλάζει τίποτα.',
            // Removal is recommended only for an independently proven redundant
            // artifact. The writer must additionally prove role/reference safety.
            recommendation: e.redundant && request.intent === 'REMOVE_ROW' ? 'Η επιλεγμένη εγγραφή επαναλαμβάνει τα ίδια στοιχεία. Η εφαρμογή προτείνει να αφαιρεθεί το αντίγραφο.' : null,
            changes, unchanged: ['Οι υπόλοιπες εγγραφές και οι νεότερες εργασιακές σχέσεις θα παραμείνουν ίδιες.',
                ...(Object.keys(currentPatch).length ? [] : ['Τα σημερινά στοιχεία του εργαζομένου θα παραμείνουν ίδια.'])], before, after }) };
}

function sanitizePublicCorrection(value) {
    const text = v => typeof v === 'string' && v.length <= 2000;
    const texts = v => Array.isArray(v) && v.length <= 1000 && v.every(text);
    const rows = v => Array.isArray(v) && v.length <= 1000 && v.every(row =>
        exact(row, ['date', 'event', 'period', 'details']) && text(row.date) &&
        text(row.event) && text(row.period) && texts(row.details));
    if (!exact(value, ['version', 'kind', 'phase', 'title', 'explanation', 'attention',
        'recommendation', 'changes', 'unchanged', 'preview', 'choices', 'fields', 'fingerprint']) ||
        value.version !== 1 || value.kind !== KIND || !['CHOICE','PREVIEW','BLOCKED'].includes(value.phase) ||
        !text(value.title) || !text(value.explanation) || !text(value.attention) ||
        !(value.recommendation === null || value.phase === 'PREVIEW' && text(value.recommendation)) ||
        !texts(value.changes) || !texts(value.unchanged) ||
        !exact(value.preview, ['before','after']) || !rows(value.preview.before) || !rows(value.preview.after) ||
        !Array.isArray(value.choices) || value.choices.length > 6 || value.choices.some(choice =>
            !exact(choice,['id','label']) || !INTENTS.includes(choice.id) || choice.id === 'REVIEW' || !text(choice.label)) ||
        new Set(value.choices.map(choice => choice.id)).size !== value.choices.length ||
        !Array.isArray(value.fields) || value.fields.length > CORRECTION_FIELD_REGISTRY.length ||
        value.fields.some(field => {
            const entry = registryEntry(field.id);
            if (!entry || field.type !== entry.dataType || !text(field.label)) return true;
            const keys = ['id','label','type', ...(entry.min !== undefined ? ['min','max'] : []),
                ...(entry.catalog ? ['allowedValues'] : [])];
            return !exact(field,keys) || entry.min !== undefined && (field.min !== entry.min || field.max !== entry.max) ||
                entry.catalog && (!Array.isArray(field.allowedValues) || field.allowedValues.length > 10000 ||
                field.allowedValues.some(item => !exact(item,['value','label']) || !text(item.value) || !text(item.label)));
        }) || !/^[a-f0-9]{64}$/.test(value.fingerprint)) return null;
    const explanation = JSON.stringify({ ...value, fingerprint: undefined });
    if (/(?:historyId|survivorId|deleteId|"_id"|"patch"|Mongo|canonical|planner|mutation|transaction|fingerprint|\bV1\b)/i.test(explanation)) return null;
    return JSON.parse(JSON.stringify(value));
}

module.exports = { KIND, INTENTS, sanitizePublicCorrection, normalizeCorrectionRequest, classifyHistoryEvidence,
    assertOrdinaryHistoryPolicy, assertCorrectionRolePolicy, previewHistory, planHistoryCorrection, correctionError };
