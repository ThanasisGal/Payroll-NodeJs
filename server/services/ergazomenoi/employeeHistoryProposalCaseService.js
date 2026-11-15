'use strict';

// Export-only selection. Existing History inspectors own all findings. Nothing
// here changes their global status or grants an executable correction/approval.
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { inspectEmployeeHistorySave } = require('./employeeHistorySaveValidationService');
const { canonicalizeEmployeeHistory } = require('./employeeHistoryCanonicalizationService');
const { verifyEmployeeHistoryAutomaticSettlement } = require('./employeeHistoryAutomaticReconstructionPlannerService');
const { employeeHistoryCoverageGaps } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');
const VERSION = 'employee-history-proposal-case:v1';
const id = row => String(row?._id || '');
const day = value => { try { return calendarDate(value)?.toISOString().slice(0, 10) || null; } catch { return null; } };
const recordOrder = (a, b) => (day(a[C.START]) || day(a[C.HIRE]) || '9999').localeCompare(day(b[C.START]) || day(b[C.HIRE]) || '9999') || id(a).localeCompare(id(b));
const labels = { REFERENCE_STATE_NOT_LOADED: 'δεν φορτώθηκε η τεκμηρίωση των συνδεδεμένων ιστορικών στοιχείων',
    REQUIRED_PROFILE_FIELD: 'Ελλιπή ή μη έγκυρα στοιχεία εγγραφής', CURRENT_PROFILE_MISMATCH: 'Ασυμφωνία τρεχόντων και ιστορικών όρων',
    ACTIVE_PERIOD_NOT_OPEN: 'Ασυμφωνία λήξης τελευταίας ιστορικής περιόδου', HISTORY_COVERAGE_MISSING: 'Ελλείπουσα ιστορική περίοδος',
    CONFLICTING_PROFILE_EVENTS: 'Αντικρουόμενοι όροι στην ίδια περίοδο', OVERLAPPING_GENUINE_PERIODS: 'Επικαλυπτόμενες ιστορικές περίοδοι',
    INVALID_PROPOSED_WORK_TERMS: 'Μη επαληθευμένοι όροι εργασίας', INVALID_NUMERIC_PROFILE_FACT: 'Μη έγκυρη αριθμητική τιμή',
    INVALID_TEMPORAL_DATE: 'Μη έγκυρη ιστορική ημερομηνία', NUMERIC_PROFILE_FACT_UNRECORDED: 'Μη καταγεγραμμένοι αριθμητικοί όροι' };

function unavailableEmployeeHistoryProposalCase(detail) {
    return { version: VERSION, status: 'REVIEW_REQUIRED', selectedCase: null, total: 0, cases: [], gaps: [],
        historyStatus: 'REVIEW_REQUIRED', sourceFingerprint: null,
        diagnostic: `Ζητήσατε εξαγωγή μίας περίπτωσης Ιστορικού, αλλά η επόμενη περίπτωση δεν μπορεί να προσδιοριστεί με ασφάλεια: ${detail}. Δεν αποθηκεύτηκε καμία αλλαγή και δεν δημιουργήθηκε αρχείο.\n1. Ελέγξτε τα καταγεγραμμένα χρονικά στοιχεία και τα σχετικά έγγραφα.\n2. Ζητήστε τεκμηριωμένο έλεγχο του Ιστορικού από διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-XLSX-ΠΕΡΙΠΤΩΣΗ.` };
}

function selectEmployeeHistoryProposalCase(input, plan, inspection = inspectEmployeeHistorySave({
    scope: input.scope, currentEmployee: input.currentEmployee, historyRows: input.completeHistoryRows }), selection = '') {
    if (typeof selection !== 'string' || selection && !/^(UPDATE:[a-f\d]{24}|INSERT:history-case-[A-Za-z\d_-]{24})$/i.test(selection))
        throw Object.assign(new Error('INVALID_LOCAL_PROPOSAL_SELECTION'), { statusCode: 400 });
    const rows = semanticHistoryRows(input.completeHistoryRows).slice().sort(recordOrder), byId = new Map(rows.map(row => [id(row), row]));
    let gaps = [], canonical;
    try {
        gaps = employeeHistoryCoverageGaps({ currentEmployee: input.currentEmployee, historyRows: input.completeHistoryRows });
        canonical = canonicalizeEmployeeHistory({ scope: input.scope, currentEmployee: input.currentEmployee,
            historyRows: input.completeHistoryRows, strictProfileEvidence: true });
    } catch (error) { canonical = { status: 'TRUE_AMBIGUITY', diagnostics: { reason: error.code || 'INVALID_TEMPORAL_DATE' } }; }
    const cases = new Map();
    function existing(historyId, reason, field, review = false, related = [historyId]) {
        const original = byId.get(String(historyId));
        if (!original) return;
        const key = review ? `review:${[...related].sort().join(',')}` : `row:${historyId}`;
        let item = cases.get(key);
        if (!item) {
            item = { kind: review ? 'AMBIGUITY' : 'EXISTING_ROW', operation: review ? 'REVIEW_REQUIRED' : 'UPDATE',
                existingHistoryId: id(original), targetHistoryId: review ? null : id(original), candidatePeriodId: null,
                sourceHistoryIds: [...related].sort(), reasons: [], fields: [],
                period: { hire: day(original[C.HIRE]), from: day(original[C.START]), to: day(original[C.END]), beforeHistoryId: id(original), missing: false } };
            cases.set(key, item);
        }
        if (reason && !item.reasons.includes(reason)) item.reasons.push(reason);
        if (field && !item.fields.includes(field)) item.fields.push(field);
    }
    for (const gap of gaps.filter(gap => !gap.reason && gap.from)) {
        const key = `gap:${gap.hire}:${gap.from}:${gap.to || ''}`;
        cases.set(key, { kind: 'MISSING_PERIOD', operation: 'INSERT', existingHistoryId: null, targetHistoryId: null,
            sourceHistoryIds: [gap.beforeHistoryId, gap.afterHistoryId].filter(Boolean).sort(),
            reasons: ['HISTORY_COVERAGE_MISSING'], fields: [], period: { ...gap, missing: true } });
    }
    for (const issue of inspection.issues) if (issue.historyId) existing(issue.historyId, issue.reason, issue.field);
    for (const fact of inspection.verification.unrecordedFacts || []) if (fact.required)
        existing(fact.historyId, 'NUMERIC_PROFILE_FACT_UNRECORDED', fact.field);
    // The verifier's aggregate numeric/date findings lack a row identity. Ask
    // the same verifier for each recorded row; accept only those exact reasons.
    const localReasons = ['INVALID_NUMERIC_PROFILE_FACT', 'INVALID_TEMPORAL_DATE', 'INVALID_PROPOSED_WORK_TERMS'];
    const reported = localReasons.filter(reason => inspection.issues.some(issue => issue.reason === reason));
    if (reported.length) for (const row of rows) {
        const checked = verifyEmployeeHistoryAutomaticSettlement({ scope: input.scope, currentEmployee: input.currentEmployee,
            proposedRows: [row], requiredHistoryRows: [row], strictProfileEvidence: true });
        for (const reason of reported.filter(reason => checked.issues.includes(reason))) existing(id(row), reason);
    }
    for (const change of canonical.rowsToUpdate || []) for (const field of Object.keys(change.patch))
        existing(change.historyId, 'RECORDED_ROW_CORRECTION', field);
    // A proposed repair (for example extending a preceding row across a gap)
    // is not another persisted discrepancy and must not become a second case.
    for (const change of canonical.rowsToDelete || []) existing(change.historyId, 'REDUNDANT_RECORDED_ROW', null, true);
    const reason = canonical.diagnostics?.reason;
    const related = (canonical.diagnostics?.historyIds || []).map(String).filter(key => byId.has(key));
    if (canonical.status === 'TRUE_AMBIGUITY' && reason !== 'HISTORY_COVERAGE_MISSING' && related.length) {
        // One unresolved conflict may involve several physical rows. Keep that
        // conflict together, never choose a survivor or fabricate new bounds.
        const originals = related.map(key => byId.get(key)).sort(recordOrder);
        existing(id(originals[0]), reason, null, true, related);
    }
    // The canonicalizer reports the first structural conflict. Probe only
    // potentially intersecting, recorded intervals with that same inspector so
    // independent later conflicts also contribute to N. Bound pathological
    // overlap sets; an incomplete count must produce diagnostics, not a guess.
    let probes = 0, unresolvedScope = false;
    for (let i = 0; i < rows.length && !unresolvedScope; i++) for (let j = i + 1; j < rows.length; j++) {
        const first = rows[i], second = rows[j], from = day(first[C.START]), next = day(second[C.START]);
        if (!from || !next || day(first[C.HIRE]) !== day(second[C.HIRE]) ||
            !(from === next || day(first[C.END]) && day(first[C.END]) >= next)) continue;
        if (++probes > 1000) { unresolvedScope = true; break; }
        let checked;
        try { checked = canonicalizeEmployeeHistory({ scope: input.scope, currentEmployee: input.currentEmployee,
            historyRows: [first, second], strictProfileEvidence: true }); }
        catch { unresolvedScope = true; break; }
        if (['CONFLICTING_PROFILE_EVENTS', 'OVERLAPPING_GENUINE_PERIODS'].includes(checked.diagnostics?.reason))
            existing(id(first), checked.diagnostics.reason, null, true, [id(first), id(second)]);
    }
    const candidates = [...cases.values()];
    // Priority: oldest recorded affected start, then recorded hire, kind, and
    // physical identity (or exact gap bounds). Unknown dates sort last. No date
    // is inferred for the displayed period from this ordering fallback.
    candidates.sort((a, b) => (a.period.from || a.period.hire || '9999').localeCompare(b.period.from || b.period.hire || '9999') ||
        a.kind.localeCompare(b.kind) || String(a.existingHistoryId || '').localeCompare(String(b.existingHistoryId || '')) ||
        String(a.period.to || '').localeCompare(String(b.period.to || '')));
    let explicitlySelected;
    if (selection.startsWith('UPDATE:')) {
        const targetId = selection.slice(7), target = byId.get(targetId);
        if (!target || !C.SCOPE_FIELDS.every(field => target[field] === input.scope[field]) ||
            !Array.isArray(input.protectedReferenceSummary?.[targetId]))
            throw Object.assign(new Error('LOCAL_PROPOSAL_TARGET_NOT_FOUND'), { statusCode: 404 });
        explicitlySelected = candidates.find(item => item.operation === 'UPDATE' && item.targetHistoryId === targetId);
        if (!explicitlySelected) {
            explicitlySelected = { kind: 'EXISTING_ROW', operation: 'UPDATE', existingHistoryId: targetId,
                targetHistoryId: targetId, candidatePeriodId: null, sourceHistoryIds: [targetId],
                reasons: ['USER_REQUESTED_ROW_CORRECTION'], fields: [],
                period: { hire: day(target[C.HIRE]), from: day(target[C.START]), to: day(target[C.END]),
                    beforeHistoryId: targetId, missing: false } };
            candidates.push(explicitlySelected);
        }
        explicitlySelected.manualSelection = true;
    }
    const sourceFingerprint = A.hash({ scope: input.scope, employee: input.currentEmployee,
        history: A.ordered(input.completeHistoryRows), references: input.protectedReferenceSummary });
    for (const item of candidates) {
        item.reasons.sort(); item.fields.sort();
        item.id = `history-case-${A.hash({ version: VERSION, sourceFingerprint, ...item }).slice(0, 24)}`;
        item.candidatePeriodId = item.operation === 'INSERT' ? `candidate-period-${item.id.slice(-24)}` : null;
        item.label = labels[item.reasons[0]] || (item.operation === 'REVIEW_REQUIRED' ? 'Αβέβαια ιστορικά στοιχεία' : 'Ασυμφωνία υπάρχουσας εγγραφής');
        if (item.manualSelection) item.label = 'Διόρθωση επιλεγμένης ιστορικής εγγραφής';
        item.executionEnabled = false; item.confirmationRequired = true;
    }
    if (selection.startsWith('INSERT:')) {
        explicitlySelected = candidates.find(item => item.operation === 'INSERT' && item.id === selection.slice(7));
        if (!explicitlySelected) throw Object.assign(new Error('LOCAL_PROPOSAL_GAP_CHANGED'), { statusCode: 409 });
    }
    const clean = !explicitlySelected && inspection.status === 'CLEAN' && plan.status === 'CLEAN' && plan.noOp;
    const selectedCase = explicitlySelected || (clean || unresolvedScope ? null : candidates[0] || null);
    const status = clean ? 'NO_CORRECTION' : selectedCase ? 'SELECTED' : 'REVIEW_REQUIRED';
    const diagnostic = clean ? 'Δεν απαιτείται διόρθωση' : selectedCase ? null :
        `Ζητήσατε εξαγωγή μίας περίπτωσης Ιστορικού. Η επόμενη περίπτωση δεν μπορεί να προσδιοριστεί με ασφάλεια: ${unresolvedScope ? 'οι πολλές ή μη επαληθευμένες επικαλύψεις δεν επέτρεψαν πλήρη προσδιορισμό των περιπτώσεων' : labels[reason || plan.reason] || 'δεν επαληθεύτηκαν το διάστημα και η συγκεκριμένη εγγραφή της ασυμφωνίας'}. Δεν αποθηκεύτηκε καμία αλλαγή και δεν δημιουργήθηκε αρχείο.\n1. Ελέγξτε τα καταγεγραμμένα χρονικά στοιχεία και τα σχετικά έγγραφα.\n2. Ζητήστε τεκμηριωμένο έλεγχο του Ιστορικού από διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-XLSX-ΠΕΡΙΠΤΩΣΗ.`;
    return { version: VERSION, status, selectedCase, total: candidates.length, cases: candidates, gaps, diagnostic,
        historyStatus: clean ? 'CLEAN' : 'REVIEW_REQUIRED', sourceFingerprint };
}
module.exports = { selectEmployeeHistoryProposalCase, unavailableEmployeeHistoryProposalCase };
