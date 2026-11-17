'use strict';

// Export-only evidence projection. Never call a normalizer, repair planner or writer.
// Field identities, types, labels and grouping come from the existing UI/contract.
const C = require('./employeeHistoryAutomaticReconstructionContract');
const P = require('../../utils/ergazomenoi/employmentProfileContract');
const { BASE_HISTORY_FIELDS, effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { DISPLAY_FIELDS, DATE_FIELDS, GROUP_TITLES, groupFor } = require('./employeeHistoryReconstructionPreviewService');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { selectEmployeeHistoryProposalCase } = require('./employeeHistoryProposalCaseService');
const { proposalChoice } = require('./employeeHistoryProposalChoicesService');
const UPDATE_DATE_FIELDS = Object.freeze([C.CHANGE, C.START, C.END, C.CONTRACT_END,
    'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos']);
const present = value => value !== undefined && value !== null && value !== '';
const id = row => String(row?._id || '');
const day = value => { try { return P.calendarDate(value)?.toISOString().slice(0, 10) || null; } catch { return null; } };
const before = value => new Date(new Date(value).getTime() - 86400000).toISOString().slice(0, 10);
const after = value => new Date(new Date(value).getTime() + 86400000).toISOString().slice(0, 10);
const copy = value => value instanceof Date ? new Date(value) : Array.isArray(value) ? [...value] : value;
const start = row => { try { return day(effectiveStart(row || {})); } catch { return null; } };
const end = row => { try { return day(effectiveEnd(row || {})); } catch { return null; } };
const contractFields = new Set(BASE_HISTORY_FIELDS.filter(field => !DATE_FIELDS.has(field)));
contractFields.add(C.CONTRACT_END);
// Employment type is a contract discriminator, independently of schedule generation.
for (const field of C.COMPATIBILITY_FIELDS.filter(field => !C.CRITICAL_NUMBERS.includes(field))) contractFields.add(field);
const breakFields = new Set([...P.BREAK_FIELDS, 'hmeromhnia_isxyos_dialleimatos_apo']);
const PROPOSAL_GROUPS = Object.freeze([GROUP_TITLES[0], GROUP_TITLES[2],
    `${GROUP_TITLES[2]} / Ποσά`, GROUP_TITLES[3], GROUP_TITLES[4], GROUP_TITLES[5]]);
function proposalGroupFor(field) {
    if (/^(stoixeio_symbashs_|poso_symbashs_|synolo_symbashs)/.test(field)) return PROPOSAL_GROUPS[2];
    const group = groupFor(field);
    return group === GROUP_TITLES[1] ? GROUP_TITLES[5] : group;
}

function recordedWindow(row, field, rows) {
    const date = name => day(row?.[name]);
    let from, until, anchor, kind;
    if (breakFields.has(field)) {
        kind = 'BREAK'; anchor = 'hmeromhnia_isxyos_dialleimatos_apo';
        from = row?.afora_allagh_dialleimatos === true ? date(anchor) : null;
    } else if (contractFields.has(field)) {
        kind = 'CONTRACT'; anchor = C.CHANGE;
        from = date(anchor) || (row?.afora_proslhpsh === true ? date(C.HIRE) : date(C.START));
        until = date(C.CONTRACT_END);
    } else {
        kind = 'WORK_TERMS'; anchor = C.START;
        from = date(C.START) || date('hmeromhnia_allaghs_orarioy_apo');
        until = date(C.START) ? end(row) : date('hmeromhnia_allaghs_orarioy_eos');
    }
    // Explicit profile validity binds all its terms. Legacy schedule-generation
    // expiry is not reused as expiry of a contract or an independently dated break.
    const explicitEnd = Object.hasOwn(row || {}, C.END) ? date(C.END) : null;
    if (explicitEnd && (!until || explicitEnd < until)) until = explicitEnd;
    const next = rows.map(other => kind === 'BREAK'
        ? other.afora_allagh_dialleimatos === true && day(other[anchor])
        : kind === 'CONTRACT' ? day(other[anchor]) : start(other))
        .filter(value => value && from && value > from).sort()[0];
    if (next && (!until || before(next) < until)) until = before(next);
    const departure = date(C.DEPARTURE);
    if (departure && (!until || departure < until)) until = departure;
    return { kind, from, to: until || null };
}

function fieldCoverage(window, period) {
    const uncovered = [];
    if (!window.from || !period.from) return { ...window, covered: false,
        uncovered: [{ from: period.from, to: period.to }] };
    if (window.from > period.from) uncovered.push({ from: period.from,
        to: period.to && period.to < window.from ? period.to : before(window.from) });
    if (window.to && (!period.to || window.to < period.to)) uncovered.push({
        from: window.to < period.from ? period.from : after(window.to), to: period.to });
    return { ...window, covered: window.from <= period.from &&
        (!period.to ? !window.to : !window.to || window.to >= period.to), uncovered };
}

function buildEmployeeHistoryProposalComparisons(input, plan, selection = selectEmployeeHistoryProposalCase(input, plan), catalogs = {}) {
    const stored = input.completeHistoryRows || [];
    const active = semanticHistoryRows(stored);
    const { gaps, selectedCase } = selection;
    const periods = selectedCase ? [selectedCase.period] : [];
    // The display allowlist is the application's existing business contract;
    // optional labelled legacy fields are included only when actually recorded.
    const fields = [...new Set([...Object.keys(labels).filter(field => DISPLAY_FIELDS.includes(field) ||
        stored.some(row => Object.hasOwn(row, field))), ...DISPLAY_FIELDS])]
        .filter(field => labels[field]);
    const orderedFields = PROPOSAL_GROUPS.flatMap(group => fields.filter(field => proposalGroupFor(field) === group));
    return { gaps, caseSelection: selection, comparisons: periods.map(period => {
        const cycle = active.filter(row => day(row[C.HIRE]) === period.hire);
        const previous = stored.find(row => id(row) === period.beforeHistoryId) ||
            cycle.filter(row => (start(row) || day(row[C.HIRE])) <= period.from)
                .sort((a, b) => String(start(a) || day(a[C.HIRE])).localeCompare(
                    String(start(b) || day(b[C.HIRE])))).at(-1) || null;
        const next = stored.find(row => id(row) === period.afterHistoryId) ||
            cycle.filter(row => start(row) > period.from)
                .sort((a, b) => start(a).localeCompare(start(b)))[0] || null;
        const original = previous || (!period.missing ? stored.find(row => id(row) === period.beforeHistoryId) : null);
        const candidateId = selectedCase.candidatePeriodId || `comparison-${selectedCase.id.slice(-24)}`;
        const verified = plan.status === 'CLEAN' && plan.verification?.status === 'CLEAN'
            ? (plan.proposedRows || []).find(row => period.missing
                ? day(row[C.START]) === period.from && day(row[C.END]) === period.to
                : id(row) === id(original)) : null;
        const candidate = {};
        const values = orderedFields.map(field => {
            const laterSource = [next, ...cycle.filter(row => row !== next && start(row) > period.from)
                .sort((a, b) => start(a).localeCompare(start(b)))].find(row => row && present(row[field])) || next;
            const old = original?.[field], approved = original ? require('./employeeHistoryRowApprovalService').reviewedRow(input, original)[field] : old, later = next?.[field];
            let proposed = approved, state = 'UNCERTAIN', editable = C.PROFILE_FIELDS.includes(field) || field === C.CONTRACT_END ||
                selectedCase.operation === 'UPDATE' && UPDATE_DATE_FIELDS.includes(field);
            const coverage = fieldCoverage(recordedWindow(original, field, cycle), period);
            coverage.valueRecorded = present(old);
            if (!present(old)) { coverage.covered = false; coverage.uncovered = [{ from: period.from, to: period.to }]; }
            let source = original, reason = 'Δεν υπάρχει επαρκής τεκμηρίωση για όλη την εξεταζόμενη περίοδο.';
            if (!period.missing) { state = present(old) ? 'RECORDED' : 'UNCERTAIN';
                reason = present(old) ? 'Ακριβής καταγεγραμμένη τιμή της προηγούμενης εγγραφής.' : 'Δεν υπάρχει καταγεγραμμένη τιμή.'; }
            if (period.missing && field === C.START) {
                proposed = period.from; state = 'GAP_BOUNDARY'; reason = 'Υποψήφια έναρξη από το πραγματικό κενό κάλυψης, χωρίς δημιουργία νέου συμβάντος.';
            } else if (period.missing && field === C.END) {
                proposed = period.to; state = 'GAP_BOUNDARY'; reason = 'Υποψήφια λήξη του πραγματικού κενού κάλυψης.';
            } else if (field === C.HIRE) {
                proposed = period.hire; state = 'RECORDED'; reason = 'Η καταγεγραμμένη πρόσληψη της ίδιας εργασιακής σχέσης διατηρείται.';
            } else if (period.missing && (C.FIELD_GROUPS.INFORMATIONAL.includes(field) ||
                [C.CHANGE, C.DEPARTURE, 'afora_proslhpsh'].includes(field))) {
                proposed = null; editable = false; state = 'SOURCE_EVENT';
                reason = 'Το συμβάν ανήκει στην αρχική εγγραφή. Δεν αντιγράφεται ούτε δημιουργείται συμβάν στη νέα περίοδο.';
            } else if (period.missing && DATE_FIELDS.has(field)) {
                // No future effective/event date is ever backdated by a display fallback.
                if (!present(old) || !coverage.covered) proposed = null;
                state = present(proposed) ? 'RECORDED' : 'UNCERTAIN';
                reason = 'Διατηρείται μόνο καταγεγραμμένη, χρονικά συμβατή ημερομηνία. Δεν μεταφέρεται ημερομηνία μεταγενέστερης εγγραφής.';
            } else if (period.missing && present(old)) {
                const conflict = present(later) && !A.equal(old, later) || cycle.some(other => {
                    if (other === original || !present(other[field]) || A.equal(old, other[field])) return false;
                    const window = recordedWindow(other, field, cycle);
                    return window.from && (!period.to || window.from <= period.to) &&
                        (!window.to || window.to >= period.from);
                });
                state = !conflict && coverage.covered ? 'CONTINUING' : 'CONFIRM_PREVIOUS';
                reason = conflict ? 'Οι εγγραφές διαφέρουν. Η προηγούμενη τιμή εμφανίζεται για σύγκριση και απαιτεί επιβεβαίωση για τη νέα περίοδο.' :
                    coverage.covered ? 'Η καταγεγραμμένη τιμή καλύπτει χρονικά όλη την περίοδο και δεν υπάρχει αντίθετη επόμενη τιμή.' :
                        'Η προηγούμενη τιμή προτείνεται χωρίς να θεωρείται τεκμηριωμένη για το ακάλυπτο διάστημα.';
            } else if (period.missing && present(laterSource?.[field])) {
                proposed = copy(laterSource[field]); state = 'SUGGESTED_LATER'; source = laterSource;
                reason = `Πρόταση από μεταγενέστερη εγγραφή ${laterSource.aa_eggrafhs || 'χωρίς αρίθμηση'} — απαιτείται επιβεβαίωση`;
            }
            if (!period.missing && selectedCase.fields.includes(field)) {
                state = present(proposed) ? 'CONFIRM_PREVIOUS' : 'UNCERTAIN';
                reason = 'Το στοιχείο αφορά την επιλεγμένη ασυμφωνία της συγκεκριμένης υπάρχουσας εγγραφής και απαιτεί ρητή επιβεβαίωση.';
            }
            if (selectedCase.operation === 'REVIEW_REQUIRED' && editable) { state = 'UNCERTAIN';
                reason = 'Τα στοιχεία παραμένουν αβέβαια. Η τοπική συμπλήρωση δεν αποτελεί ασφαλή πρόταση εγγραφής.'; }
            if (field === 'aa_eggrafhs') {
                proposed = period.missing ? null : old; editable = false;
                if (period.missing) { state = 'SOURCE_IDENTITY';
                    reason = 'Δεν εκχωρείται αρίθμηση νέας εγγραφής κατά την εξαγωγή.'; }
            }
            // A verified planner value remains a proposal; it cannot certify the
            // export's human decisions or promote a REVIEW_REQUIRED planner.
            if (period.missing && verified && Object.hasOwn(verified, field) && editable && !DATE_FIELDS.has(field) &&
                !present(proposed)) { proposed = copy(verified[field]); state = 'PLANNER_PROPOSAL';
                reason = 'Πρόταση του υπάρχοντος επαληθευμένου ελέγχου — ελέγξτε την τεκμηρίωσή της.'; }
            const choice = proposalChoice(field, proposed, source, catalogs);
            if (choice) {
                proposed = choice.value;
                if (choice.selectionRequired) { state = 'UNCERTAIN'; reason = choice.reason; }
            }
            candidate[field] = copy(proposed);
            // Displaying the original event is not a proposal to create that event.
            const displayOnly = ['SOURCE_EVENT', 'SOURCE_IDENTITY'].includes(state) ||
                DATE_FIELDS.has(field) && present(old) && !present(proposed);
            if (displayOnly) editable = false;
            return { field, label: labels[field], group: proposalGroupFor(field), before: copy(old),
                displayAfter: copy(displayOnly ? old : proposed), displayOnly,
                after: copy(proposed), state, editable, selectionRequired: choice?.selectionRequired || false,
                sourceHistoryId: id(source),
                previousHistoryId: id(original), nextHistoryId: id(next),
                laterHistoryId: id(laterSource), nextValue: copy(laterSource?.[field]), coverage, reason };
        });
        return { id: candidateId, caseId: selectedCase.id, operation: selectedCase.operation,
            targetHistoryId: selectedCase.targetHistoryId, candidatePeriodId: selectedCase.candidatePeriodId, period, original, next, candidate, values };
    }) };
}

module.exports = { buildEmployeeHistoryProposalComparisons, PROPOSAL_GROUPS, UPDATE_DATE_FIELDS };
