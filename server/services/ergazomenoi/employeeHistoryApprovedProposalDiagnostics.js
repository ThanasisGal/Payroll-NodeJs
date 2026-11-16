'use strict';
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const { permittedFields } = require('./employeeHistoryApprovedProposalContract');
const allowed = new Set(permittedFields);
const explanations = {
    REQUIRED_PROFILE_FIELD: ['Το απαιτούμενο στοιχείο δεν είναι έγκυρο ή πλήρες.',
        'Ο έλεγχος δεν επιβεβαίωσε την απαιτούμενη τιμή.', 'Συμπληρώστε έγκυρη τιμή για την εξεταζόμενη περίοδο.'],
    INVALID_NUMERIC_PROFILE_FACT: ['Ο αριθμός δεν είναι έγκυρος.',
        'Η αριθμητική τιμή δεν πληροί τους ισχύοντες κανόνες.', 'Διορθώστε τον αριθμό και ελέγξτε τα επιτρεπόμενα όρια.'],
    NUMERIC_PROFILE_FACT_UNRECORDED: ['Λείπει απαιτούμενη αριθμητική τιμή.',
        'Ο έλεγχος απαιτεί καταγεγραμμένη τιμή για αυτή την περίοδο.', 'Συμπληρώστε την αριθμητική τιμή που ίσχυε στην περίοδο.'],
    INVALID_TEMPORAL_DATE: ['Η ημερομηνία δεν είναι έγκυρη.',
        'Ο έλεγχος δεν αναγνώρισε έγκυρη ημερομηνία.', 'Διορθώστε την ημερομηνία της εξεταζόμενης περιόδου.'],
    INVALID_PROPOSED_WORK_TERMS: ['Οι όροι δεν συμφωνούν μεταξύ τους.',
        'Ο έλεγχος απέρριψε τον συνδυασμό των δηλωμένων όρων.', 'Ελέγξτε τις ημέρες, τις ώρες και τα χρονικά όρια της περιόδου.'],
    INVALID_EMPLOYMENT_PROFILE: ['Η ρύθμιση απασχόλησης δεν είναι έγκυρη.',
        'Ο έλεγχος δεν επιβεβαίωσε συμβατή ρύθμιση απασχόλησης.', 'Διορθώστε τη ρύθμιση απασχόλησης για την εξεταζόμενη περίοδο.']
};
// Only explicit field identities from the inspector are public. Never infer a
// failed field from a difference, a candidate value, or an unscoped exception.
function incompleteProblems(inspection = {}) {
    const issues = [...(inspection.issues || [])];
    // The verifier also names required numeric facts explicitly. These are
    // failed facts, not deductions from a BEFORE/AFTER comparison.
    for (const fact of inspection.verification?.unrecordedFacts || [])
        if (fact.required === true && fact.sourceType === 'UNRECORDED')
            issues.push({ reason: 'NUMERIC_PROFILE_FACT_UNRECORDED', field: fact.field });
    const problems = new Map();
    for (const issue of issues) {
        const details = explanations[issue.reason];
        if (!details || !allowed.has(issue.field) || !labels[issue.field] || problems.has(issue.field)) continue;
        const [problem, cause, action] = details;
        const earnings = issue.reason === 'REQUIRED_PROFILE_FIELD' &&
            ({ nomimosMisthos: 'Νόμιμες αποδοχές', pragmatikosMisthos: 'Πραγματικές αποδοχές' })[issue.field];
        problems.set(issue.field, { fieldId: issue.field, field: earnings || labels[issue.field], problem,
            cause: earnings ? 'Δεν βρέθηκε θετικό ποσό σε μισθό, ημερομίσθιο ή ωρομίσθιο.' : cause,
            action: earnings ? 'Συμπληρώστε θετικό μισθό, ημερομίσθιο ή ωρομίσθιο στην αντίστοιχη ομάδα αποδοχών, ανάλογα με τον τρόπο αμοιβής.' : action });
    }
    return [...problems.values()];
}
module.exports = { incompleteProblems };
