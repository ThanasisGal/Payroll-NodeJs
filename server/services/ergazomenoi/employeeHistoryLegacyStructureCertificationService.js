'use strict';
// Coordinated, explicit certification of the EXISTING rows of ONE recorded
// employment cycle. No hire, departure, history identity, row or period is made.
const C = require('./employeeHistoryAutomaticReconstructionContract');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const P = require('./employeeHistoryApprovedProposalContract');
const E = require('./employeeHistoryProposalEditorService');
const X = require('./employeeHistoryProposalXlsxService');
const Profile = require('../../utils/ergazomenoi/employmentProfileContract');
const Certification = require('./employeeHistoryProfileCertificationService');
const BreakFacts = require('../../utils/ergazomenoi/certifiedHistoryBreakFacts');
const { semanticHistoryRows, isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { inspectEmployeeHistorySave } = require('./employeeHistorySaveValidationService');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const VERSION = 'legacy-history-structure-certification:v1';
const KINDS = Object.freeze(['INITIAL_TERMS', 'TERMS_CHANGE', 'SCHEDULE_ONLY']);
const day = value => { try { return Profile.calendarDate(value)?.toISOString().slice(0, 10) || null; } catch { return null; } };
const id = row => String(row._id);
const dates = row => ({ termsFrom: day(row[C.START]), termsTo: day(row[C.END]),
    scheduleFrom: day(row.hmeromhnia_allaghs_orarioy_apo), scheduleTo: day(row.hmeromhnia_allaghs_orarioy_eos) });
function failure(reason, row, field, detail) {
    const error = P.failure(reason, 422);
    error.problems = [{ kind: 'CHECK', code: reason, fieldId: field || reason,
        field: `${row?.aa_eggrafhs ? `Εγγραφή ${row.aa_eggrafhs} · ` : ''}${labels[field] || 'Πιστοποίηση πραγματικού ιστορικού γεγονότος'}`,
        problem: detail || 'Δεν έχει επιβεβαιωθεί το πραγματικό ιστορικό γεγονός.',
        cause: 'Οι ημερομηνίες ωραρίου και η επαναλαμβανόμενη ένδειξη πρόσληψης δεν αποδεικνύουν από μόνες τους όρους ή νέα εργασιακή σχέση.',
        action: '1. Επιλέξτε το πραγματικό είδος εγγραφής και την τεκμηριωμένη ημερομηνία όρων. 2. Αναφέρετε το ιστορικό τεκμήριο και επιβεβαιώστε ρητά τα γνωστά στοιχεία. Δεν αποθηκεύτηκε καμία αλλαγή.' }];
    return error;
}
function diagnosis(input) {
    const active = semanticHistoryRows(input.completeHistoryRows);
    return { version: VERSION, rows: active.map(row => ({ historyId: id(row), sequence: row.aa_eggrafhs || '',
        hire: day(row[C.HIRE]), ...dates(row), hireFlag: row.afora_proslhpsh === true,
        breakChange: row.afora_allagh_dialleimatos === true, breakFrom: day(row.hmeromhnia_isxyos_dialleimatos_apo) })),
        requiresExplicitEvents: true };
}
async function editor(input, catalogs, req, selected) {
    if (selected?.operation !== 'UPDATE' || semanticHistoryRows(input.completeHistoryRows).length > 30) return null;
    const initial = input.completeHistoryRows.find(row => id(row) === selected.targetHistoryId);
    if (!initial || initial.afora_proslhpsh !== true) return null;
    const model = diagnosis(input);
    for (const row of model.rows) {
        if (row.historyId === selected.targetHistoryId) { row.selected = true; row.fields = []; continue; }
        const baseline = await X.buildEmployeeHistoryProposalWorkbook(input, catalogs, { selection: `UPDATE:${row.historyId}` });
        const controls = E.editorModel(baseline, catalogs);
        row.completion = { caseId: baseline.caseSelection.selectedCase.id, snapshotFingerprint: baseline.snapshotFingerprint,
            context: E.editorContext(req, baseline.snapshotFingerprint, baseline.caseSelection.selectedCase.id) };
        row.fields = controls.rows.filter(item => item.control && C.PROFILE_FIELDS.includes(item.control.fieldId));
    }
    return model;
}
function validateRequest(value) {
    if (!P.exactKeys(value, ['version', 'events', 'confirmed']) || value.version !== VERSION || value.confirmed !== true ||
        !Array.isArray(value.events) || !value.events.length || value.events.length > 30) throw P.failure('LEGACY_CERTIFICATION_REQUIRED', 422);
    for (const event of value.events) if (!P.exactKeys(event, ['historyId', 'kind', 'from', 'breakFrom', 'evidence', 'breakConfirmed', 'completion']) ||
        !/^[a-f\d]{24}$/i.test(event.historyId || '') || typeof event.evidence !== 'string' || event.evidence.length > 4000 ||
        ![null, true, false].includes(event.breakConfirmed) || ![null, ''].includes(event.from) && typeof event.from !== 'string' ||
        ![null, ''].includes(event.breakFrom) && typeof event.breakFrom !== 'string') throw P.failure('REQUEST', 400);
}
function candidateFrom(original, prepared, historyModel) {
    const candidate = { ...original }, answers = new Map();
    for (const answer of prepared.filter(item => item.entry.role === 'ANSWER')) {
        const field = answer.entry.canonicalField;
        if (!P.permittedFields.includes(field)) throw P.failure('LIFECYCLE', 422);
        const path = historyModel.schema.path(field); if (!path) throw P.failure('VALUE', 422);
        const value = answer.raw === null ? null : path.cast(answer.raw);
        if (Certification.inactiveEmptyDays(original, { ...candidate, [field]: value }) && field === Profile.DAYS) {
            answers.set(answer.entry, { ...answer, raw: value }); continue;
        }
        candidate[field] = value; answers.set(answer.entry, { ...answer, raw: value });
    }
    return { candidate, answers };
}
async function plan({ input, proposal, req, catalogs, historyModel, mainBaseline, mainCompletions }) {
    validateRequest(proposal.legacyCertification);
    const active = semanticHistoryRows(input.completeHistoryRows), value = proposal.legacyCertification;
    const eventIds = value.events.map(event => event.historyId);
    if (new Set(eventIds).size !== active.length || eventIds.length !== active.length ||
        !active.every(row => eventIds.includes(id(row)))) throw P.failure('LEGACY_STRUCTURE_STALE');
    const hire = day(input.currentEmployee[C.HIRE]);
    if (!hire || active.some(row => day(row[C.HIRE]) !== hire) ||
        require('./employeeEmploymentCycleResolverService').buildEmploymentCycles({ currentEmployee: input.currentEmployee, history: active }).length !== 1)
        throw P.failure('LEGACY_CYCLE_EVIDENCE_REQUIRED', 422);
    const initial = value.events.filter(event => event.kind === 'INITIAL_TERMS');
    if (initial.length !== 1 || initial[0].historyId !== mainBaseline.caseSelection.selectedCase.targetHistoryId ||
        day(initial[0].from) !== hire) throw failure('LEGACY_INITIAL_EVENT_REQUIRED', active.find(row => id(row) === initial[0]?.historyId), C.START);
    const certificates = [], planned = new Map(), termEvents = [], patches = [];
    for (const event of value.events) {
        const original = active.find(row => id(row) === event.historyId);
        if (!KINDS.includes(event.kind) || !event.evidence.trim()) throw failure('LEGACY_EVENT_EVIDENCE_REQUIRED', original, null,
            `Λείπει τεκμηρίωση αν η εγγραφή ${original.aa_eggrafhs || ''} αφορά πραγματικούς όρους ή μόνο ωράριο.`);
        if (event.kind === 'SCHEDULE_ONLY') {
            if (original[C.START] || original[C.END] || event.from || event.breakFrom || event.breakConfirmed === true ||
                event.completion !== null) throw failure('LEGACY_SCHEDULE_CLASSIFICATION_CONFLICT', original, C.START);
            planned.set(id(original), { ...original, [C.START]: null, [C.END]: null,
                afora_proslhpsh: false, afora_allagh_oron_ergasias: false });
            continue;
        }
        const from = day(event.from), departure = day(input.currentEmployee[C.DEPARTURE]);
        if (!from || from < hire || departure && from > departure) throw failure('LEGACY_TERMS_DATE_REQUIRED', original, C.START);
        if (event.breakConfirmed !== true || !event.breakFrom || day(event.breakFrom) !== from)
            throw failure('LEGACY_INITIAL_BREAK_FACTS_REQUIRED', original, 'hmeromhnia_isxyos_dialleimatos_apo',
                'Λείπει ρητή πιστοποίηση των αρχικών στοιχείων διαλείμματος της περιόδου και της πραγματικής ημερομηνίας ισχύος τους. Δεν πρόκειται για γεγονός μεταβολής διαλείμματος.');
        if (original.afora_allagh_dialleimatos === true && day(original.hmeromhnia_isxyos_dialleimatos_apo) !== from)
            throw failure('LEGACY_BREAK_CHANGE_EVENT_CONFLICT', original, 'hmeromhnia_isxyos_dialleimatos_apo',
                'Η εγγραφή δηλώνει πραγματική μεταβολή διαλείμματος, χωρίς αποδεδειγμένη ίδια ημερομηνία με τους πιστοποιούμενους όρους. Απαιτείται το τεκμήριο αυτού του χωριστού γεγονότος· η αρχική πιστοποίηση δεν το αντικαθιστά.');
        let completions;
        if (id(original) === initial[0].historyId) {
            if (event.completion !== null) throw P.failure('REQUEST', 400);
            completions = mainCompletions;
        } else {
            const baseline = await X.buildEmployeeHistoryProposalWorkbook(input, catalogs, { selection: `UPDATE:${id(original)}` });
            completions = E.prepareLocalCompletion(baseline, event.completion, req, catalogs);
            if (completions.some(item => item.entry.role !== 'ANSWER' || !C.PROFILE_FIELDS.includes(item.entry.canonicalField)))
                throw P.failure('LIFECYCLE', 422);
        }
        const built = candidateFrom(original, completions, historyModel);
        let normalized;
        try { normalized = Certification.planCertification(original, built.candidate, built.answers); }
        catch (error) { throw failure('LEGACY_PROFILE_FACT_REQUIRED', original, error.field,
            `Τα δηλωμένα στοιχεία «${labels[error.field] || 'προφίλ'}» της εγγραφής ${original.aa_eggrafhs || ''} δεν σχηματίζουν έγκυρη ιστορική τιμή. Ελέγξτε τα με το συγκεκριμένο πρωτότυπο.`); }
        if (normalized.missing.length || !normalized.certificate) throw failure('LEGACY_PROFILE_FACT_REQUIRED', original, normalized.missing[0],
            `Δεν έχει δηλωθεί ρητά έγκυρη τιμή για «${labels[normalized.missing[0]] || 'στοιχείο προφίλ'}» στην εγγραφή ${original.aa_eggrafhs || ''}.`);
        const candidate = { ...built.candidate, ...normalized.patch, [C.START]: Profile.calendarDate(from), [C.END]: null,
            afora_proslhpsh: event.kind === 'INITIAL_TERMS', afora_allagh_oron_ergasias: true,
            hmeromhnia_isxyos_dialleimatos_apo: Profile.calendarDate(event.breakFrom), [BreakFacts.FIELD]: BreakFacts.VALUE };
        // Retain the real break-change flag exactly. Certification observes
        // facts; it does not backdate or manufacture a change event.
        if (Object.hasOwn(original, 'afora_allagh_dialleimatos')) candidate.afora_allagh_dialleimatos = original.afora_allagh_dialleimatos;
        else delete candidate.afora_allagh_dialleimatos;
        planned.set(id(original), candidate); termEvents.push({ event, original, candidate });
        certificates.push({ historyId: id(original), sequence: original.aa_eggrafhs || '', profile: normalized.certificate,
            initialBreakFacts: { from, evidence: event.evidence, originalChangeFlag: original.afora_allagh_dialleimatos ?? null } });
    }
    const all = input.completeHistoryRows.map(row => planned.get(id(row)) || row);
    const canonical = canonicalizeEmployeeHistory({ scope: input.scope, currentEmployee: input.currentEmployee, historyRows: all, strictProfileEvidence: true });
    if (!canonical.canonicalRows || canonical.status === 'TRUE_AMBIGUITY' || canonical.rowsToDelete?.length || canonical.rowsToInsert?.length ||
        canonical.canonicalRows.length !== active.length) throw P.failure('LEGACY_STRUCTURE_CONFLICT', 422);
    for (const entry of termEvents) {
        const canonicalRow = canonical.canonicalRows.find(row => id(row) === id(entry.original));
        // Only the existing canonical successor/departure END rule is adopted.
        // No normalized pay, hours, aliases or current-master facts are copied.
        entry.candidate[C.END] = canonicalRow[C.END] ?? null;
        const supplied = id(entry.original) === initial[0].historyId ? mainCompletions : [];
        for (const answer of supplied) if (answer.entry.role === 'ANSWER' && [C.START, C.END, 'hmeromhnia_isxyos_dialleimatos_apo'].includes(answer.entry.canonicalField) &&
            answer.raw !== null && day(answer.raw) !== day(entry.candidate[answer.entry.canonicalField]))
            throw failure('LEGACY_XLSX_DATE_CONFLICT', entry.original, answer.entry.canonicalField,
                `Το ΜΕΤΑ περιέχει ${day(answer.raw)}, ενώ τα πιστοποιημένα ιστορικά γεγονότα δίνουν ${day(entry.candidate[answer.entry.canonicalField]) || 'ανοικτή ισχύ'}. Οι τιμές δεν αντικαταστάθηκαν σιωπηρά. Διορθώστε τη συγκεκριμένη ημερομηνία ΜΕΤΑ ή τα τεκμηριωμένα γεγονότα.`);
        planned.set(id(entry.original), entry.candidate);
    }
    const after = input.completeHistoryRows.map(row => planned.get(id(row)) || row);
    const inspection = inspectEmployeeHistorySave({ scope: input.scope, currentEmployee: input.currentEmployee, historyRows: after, includeIssueDetails: true });
    if (inspection.status !== 'CLEAN') {
        const issue = inspection.issues[0] || {};
        throw failure('LEGACY_FULL_HISTORY_NOT_VERIFIED', active.find(row => id(row) === String(issue.historyId)), issue.field,
            issue.label ? `Δεν επιβεβαιώθηκε «${issue.label}» για ολόκληρο το Ιστορικό.` :
                `Δεν επιβεβαιώθηκε το σύνολο των πραγματικών γεγονότων και της ιστορικής κάλυψης (${issue.reason || 'άγνωστο γεγονός'}).`);
    }
    for (const original of active) {
        const candidate = planned.get(id(original));
        const patch = Object.fromEntries(Object.entries(candidate).filter(([field, value]) => !A.equal(original[field], value)));
        if (Object.keys(patch).length) patches.push({ historyId: id(original), patch, candidate });
    }
    if (!patches.length) throw P.failure('NO_CHANGES', 422);
    const target = planned.get(initial[0].historyId), targetPatch = patches.find(row => row.historyId === initial[0].historyId)?.patch || {};
    return { version: VERSION, patches, after, target, targetPatch,
        affected: { from: hire, to: day(input.currentEmployee[C.DEPARTURE]), beforeEvidence: null },
        certification: { version: VERSION, rows: certificates.find(row => row.historyId === initial[0].historyId).profile.rows,
            historyEvents: value.events.map(({ completion, ...event }) => event), certifiedRows: certificates },
        rows: patches.flatMap(row => Object.entries(row.patch).map(([field, value]) => ({ historyId: row.historyId,
            sequence: active.find(original => id(original) === row.historyId).aa_eggrafhs || '', fieldId: field,
            field: labels[field] || ({ afora_proslhpsh: 'Ένδειξη πρόσληψης', afora_allagh_oron_ergasias: 'Εγγραφή πραγματικών όρων',
                [BreakFacts.FIELD]: 'Πιστοποίηση πραγματικών στοιχείων περιόδου' })[field] || field,
            before: active.find(original => id(original) === row.historyId)[field] ?? null, after: value }))) };
}
function assertPlan(proof) {
    const plan = proof.legacyPlan;
    const permitted = new Set([...P.permittedFields, ...Certification.metadata, 'afora_proslhpsh', 'afora_allagh_oron_ergasias', BreakFacts.FIELD]);
    if (plan?.version !== VERSION || proof.certification?.version !== VERSION || !Array.isArray(plan.patches) ||
        !plan.patches.length || new Set(plan.patches.map(row => row.historyId)).size !== plan.patches.length ||
        proof.companySerialization?.field !== require('./employeeHistoryPeriodSerializationService').field ||
        proof.companySerialization.before !== proof.companyPeriodSequence ||
        proof.companySerialization.after !== (proof.companyPeriodSequence || 0) + 1 ||
        plan.patches.some(update => {
            const before = proof.before.find(row => id(row) === update.historyId);
            return !before || isInactiveHistoryRow(before) || Object.keys(update.patch).some(field => !permitted.has(field)) ||
                !A.equal(update.candidate, { ...before, ...update.patch }) ||
                !A.equal(update.candidate[C.HIRE], before[C.HIRE]) || !A.equal(update.candidate[C.DEPARTURE], before[C.DEPARTURE]);
        }) || !A.equal(A.ordered(plan.after), A.ordered(proof.before.map(row => plan.patches.find(update => update.historyId === id(row))?.candidate || row))))
        throw P.failure('BOUNDARY');
    const verified = inspectEmployeeHistorySave({ scope: proof.scope, currentEmployee: proof.originalCurrent, historyRows: plan.after });
    if (verified.status !== 'CLEAN') throw P.failure('BOUNDARY');
}
function requiresStructureCertification(input, selected) {
    const target = input.completeHistoryRows.find(row => id(row) === selected?.targetHistoryId);
    return selected?.operation === 'UPDATE' && target?.afora_proslhpsh === true && !target[C.START] &&
        semanticHistoryRows(input.completeHistoryRows).some(row => id(row) !== id(target) &&
            row.afora_proslhpsh === true && day(row[C.HIRE]) === day(target[C.HIRE]));
}
module.exports = { VERSION, KINDS, diagnosis, editor, validateRequest, plan, assertPlan, requiresStructureCertification };
