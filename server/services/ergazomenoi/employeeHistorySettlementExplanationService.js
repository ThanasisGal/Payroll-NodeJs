'use strict';

const { effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { sortHistoryForPresentation } = require('../../utils/ergazomenoi/employmentHistoryPresentation');

// Presentation only. Never serialize diagnostics or derive a new business decision.
function buildSettlementExplanation({ plan = {}, completeHistoryRows = [], descriptions = {} } = {}) {
    const known = reason => typeof reason === 'string' && Object.hasOwn(descriptions, reason)
        ? descriptions[reason] : null;
    const fallback = 'Κανένα από τα διαθέσιμα υποψήφια σχέδια δεν επαληθεύτηκε ως ασφαλής ολοκληρωμένη πρόταση. Αυτό από μόνο του δεν τεκμηριώνει συγκεκριμένη αντίφαση στα καταγεγραμμένα στοιχεία.';
    const finding = known(plan.reason) || fallback;
    const locations = [];
    const identifiableRows = Array.isArray(completeHistoryRows) && completeHistoryRows.every(row =>
        row && typeof row === 'object' && row._id != null) &&
        new Set(completeHistoryRows.map(row => String(row._id))).size === completeHistoryRows.length;
    const rows = identifiableRows ? sortHistoryForPresentation(completeHistoryRows) : [];
    const numbers = new Map(rows.map((row, index) => [String(row._id), String(index + 1).padStart(4, '0')]));
    const date = value => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        const parsed = new Date(value + 'T00:00:00Z');
        return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
            ? value.split('-').reverse().join('/') : null;
    };
    const attempts = Array.isArray(plan.attempts) ? plan.attempts.filter(item => item && typeof item === 'object') : [];
    // Even EXISTING_STATE can be normalized by the coordinator. Only refer to
    // original rows when their recorded boundary exactly matches the diagnostic.
    const sources = attempts.map(attempt => ({ original: attempt.solver === 'EXISTING_STATE',
        gaps: attempt.coverageGaps, issues: attempt.issues }));
    sources.push({ original: false, gaps: plan.coverageGaps, issues: plan.issues });
    const boundaryNumber = (value, boundary, offset, hire) => {
        const row = rows.find(item => String(item._id) === String(value));
        if (!row || !date(hire)) return null;
        try {
            const rowHire = new Date(row.hmeromhnia_proslhpshs).toISOString().slice(0, 10);
            const edge = offset > 0 ? effectiveEnd(row) : effectiveStart(row);
            if (rowHire !== hire || !edge || !date(boundary)) return null;
            return new Date(edge.getTime() + offset * 86400000).toISOString().slice(0, 10) === boundary
                ? numbers.get(String(value)) : null;
        } catch { return null; }
    };
    for (const source of sources) {
        for (const gap of Array.isArray(source.gaps) ? source.gaps : []) {
            if (!gap || typeof gap !== 'object') continue;
            const from = date(gap.from), to = date(gap.to);
            if (!from || gap.to != null && !to || to && gap.to < gap.from) continue;
            const interval = to ? `από ${from} έως ${to}` : `από ${from}, χωρίς προσδιορισμένο τέλος στα αποτελέσματα του ελέγχου`;
            const boundaryRows = [...new Set([
                gap.beforeHistoryId == null ? null : boundaryNumber(gap.beforeHistoryId, gap.from, 1, gap.hire),
                gap.afterHistoryId == null ? null : boundaryNumber(gap.afterHistoryId, gap.to, -1, gap.hire)
            ].filter(Boolean))];
            locations.push(`${source.original ? 'Κατά τον έλεγχο με βάση το υπάρχον Ιστορικό' : 'Κατά την επαλήθευση υποψήφιας πρότασης'}: ${known(gap.reason) || 'Δεν επιβεβαιώθηκε η κάλυψη με όρους εργασίας'} ${interval}.${boundaryRows.length
                ? ` Γραμμές στα όρια της περιόδου: Α/Α ${boundaryRows.join(', ')}. Οι γραμμές οριοθετούν το εύρημα· δεν χαρακτηρίζονται αυτομάτως λανθασμένες.`
                : 'Δεν προσδιορίζεται με ασφάλεια συγκεκριμένη γραμμή του πίνακα.'}`);
        }
    }
    for (const source of sources) {
        const issues = [...new Set((Array.isArray(source.issues) ? source.issues : []).map(known).filter(Boolean))];
        for (const issue of issues) if (issue !== finding) locations.push(`Κατά την επαλήθευση ${source.original
            ? 'με βάση το υπάρχον Ιστορικό' : 'υποψήφιας πρότασης'}: ${issue} Δεν προσδιορίζεται συγκεκριμένη γραμμή από αυτό το εύρημα.`);
    }
    if (!locations.length) locations.push('Τα διαθέσιμα διαγνωστικά δεν προσδιορίζουν με ασφάλεια συγκεκριμένη γραμμή, ημερομηνία ή πεδίο. Δεν αποδίδεται το πρόβλημα σε κάποια εγγραφή χωρίς τεκμηρίωση.');
    let safety = 'Δεν έχει επαληθευτεί μία πλήρης και ασφαλής πρόταση για όλο το Ιστορικό. Η αυτόματη διόρθωση δεν επιτρέπεται να υποθέσει πραγματικά γεγονότα ή όρους που δεν τεκμηριώνονται.';
    let check = 'Ζητήστε από τον διαχειριστή να εξετάσει το Ιστορικό και τα αποδεικτικά των πραγματικών ημερομηνιών και όρων εργασίας. Όπου δεν αναφέρεται γραμμή, χρειάζεται έλεγχος ολόκληρης της εργασιακής σχέσης.';
    if (['EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE', 'EMPLOYMENT_CYCLE_OVERLAP', 'AMBIGUOUS_LIFECYCLE_EVENTS'].includes(plan.reason)) {
        safety = 'Δεν μπορεί να επιλεγεί ή να δημιουργηθεί αυτόματα ημερομηνία αποχώρησης ούτε να αφαιρεθεί πραγματική εργασιακή σχέση χωρίς ασφαλή τεκμηρίωση.';
        check = 'Ζητήστε από τον διαχειριστή να αντιπαραβάλει τις προσλήψεις και τις αποχωρήσεις με τα πραγματικά δικαιολογητικά, πριν διορθώσει τις αντίστοιχες εγγραφές.';
    } else if (['REFERENCE_STATE_NOT_LOADED', 'INVALID_REFERENCE_EVIDENCE', 'REFERENCE_SEMANTICS_UNKNOWN', 'INACTIVE_REFERENCE_WOULD_CHANGE'].includes(plan.reason)) {
        safety = 'Δεν επιβεβαιώνεται ότι θα διατηρηθούν με ασφάλεια οι συνδέσεις με παλιότερα αποτελέσματα. Η αυτόματη διόρθωση δεν επιτρέπεται να τις μεταβάλει ή να τις αγνοήσει.';
        check = 'Ζητήστε από τον διαχειριστή να ελέγξει τις συνδέσεις του Ιστορικού με τα παλιότερα αποτελέσματα. Μην διαγράψετε ιστορικές εγγραφές για να παρακάμψετε τον έλεγχο.';
    } else if (['NUMERIC_PROFILE_FACT_UNRECORDED', 'INVALID_NUMERIC_PROFILE_FACT'].includes(plan.reason)) {
        check = 'Ελέγξτε με τον διαχειριστή τις πραγματικές ώρες, την ευέλικτη προσέλευση και τα ποσά στους όρους εργασίας. Χρειάζονται τεκμηριωμένες τιμές· δεν επιτρέπεται αυθαίρετη συμπλήρωση.';
    } else if (/CONTRACT_|MISSING_PERIOD_|HISTORY_COVERAGE|CONTRARY_MISSING/.test(plan.reason || '')) {
        check = 'Ελέγξτε με τον διαχειριστή τους όρους των αναφερόμενων περιόδων και τα δικαιολογητικά λήξης ή παράτασης σύμβασης. Η συμπλήρωση χρειάζεται τεκμηριωμένη πηγή, όχι εκτίμηση.';
    } else if (plan.reason === 'CONFLICTING_PROFILE_EVENTS' || plan.reason === 'INCOMPATIBLE_VERIFIED_CANDIDATES') {
        check = 'Ζητήστε από τον διαχειριστή να επιβεβαιώσει ποιοι όροι ίσχυαν πραγματικά στην επίμαχη περίοδο και να ελέγξει τις διαφορετικές εκδοχές πριν από οποιαδήποτε διόρθωση.';
    }
    return { finding, locations: [...new Set(locations)], safety,
        checks: [check, 'Πατήστε «Πίσω» για επιστροφή στην προεπισκόπηση ή «Συνέχεια» / «Κλείσιμο» για τις ανεξάρτητες εργασίες.'],
        reference: 'ΙΣΤ-ΑΥΤ-3Α' };
}

module.exports = { buildSettlementExplanation };
