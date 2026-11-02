'use strict';

const { effectiveStart, effectiveEnd } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { sortHistoryForPresentation } = require('../../utils/ergazomenoi/employmentHistoryPresentation');
const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');
const { isInactiveHistoryRow } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');

// Presentation of established outcomes only. No planner, decision or write here.
const guides = [
    [['EMPLOYMENT_CYCLE_OVERLAP'],
        'Δεν μπορούμε να επιλέξουμε ποια πρόσληψη ή αποχώρηση πρέπει να αλλάξει. Μια τέτοια επιλογή θα μπορούσε να αφαιρέσει ημέρες πραγματικής εργασίας.',
        'Μια πρόσληψη εμφανίζεται με αποχώρηση στις 20/06/2025 και μια επόμενη πρόσληψη στις 15/06/2025. Οι ημέρες 15–20 Ιουνίου ανήκουν και στις δύο περιόδους. Χρειάζονται τα έγγραφα πρόσληψης και αποχώρησης για να βρεθεί ποια ημερομηνία ισχύει.',
        'Συγκρίνετε με τον υπεύθυνο μισθοδοσίας τις ημερομηνίες πρόσληψης και αποχώρησης των περιόδων που έχουν κοινές ημέρες.'],
    [['EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE'],
        'Δεν γνωρίζουμε πότε τελείωσε η προηγούμενη εργασία. Η επαναπρόσληψη από μόνη της δεν μας επιτρέπει να ορίσουμε μια ημερομηνία αποχώρησης.',
        'Υπάρχει πρόσληψη στις 01/02/2025 χωρίς αποχώρηση και νέα πρόσληψη στις 01/09/2025. Δεν σημαίνει αυτόματα ότι η πρώτη εργασία τελείωσε στις 31/08/2025· μπορεί να είχε τελειώσει νωρίτερα.',
        'Βρείτε με τον υπεύθυνο μισθοδοσίας το έγγραφο αποχώρησης της προηγούμενης πρόσληψης και επιβεβαιώστε την ημερομηνία της επαναπρόσληψης.'],
    [['AMBIGUOUS_LIFECYCLE_EVENTS', 'RECORDED_DEPARTURE_WOULD_CHANGE'],
        'Η ημερομηνία αποχώρησης καθορίζει μέχρι πότε υπήρχε εργασία. Δεν μπορούμε να κρατήσουμε μία ημερομηνία ή να την αλλάξουμε χωρίς να ξέρουμε ποια είναι η πραγματική ημερομηνία αποχώρησης.',
        'Για την ίδια πρόσληψη μια εγγραφή γράφει αποχώρηση 30/06/2025 και μια άλλη 15/07/2025. Αν επιλεγεί η πρώτη, οι ημέρες 1–15 Ιουλίου μένουν εκτός εργασίας· αν επιλεγεί η δεύτερη, περιλαμβάνονται. Χρειάζεται το έγγραφο αποχώρησης.',
        'Αντιπαραβάλετε με τον υπεύθυνο μισθοδοσίας τις καταγεγραμμένες αποχωρήσεις με το έγγραφο της συγκεκριμένης πρόσληψης. Επιβεβαιώστε ποια ημερομηνία ισχύει.'],
    [['EMPLOYMENT_CYCLE_DEPARTURE_BEFORE_HIRE', 'CONTRACT_END_BEFORE_HIRE'],
        'Δεν μπορούμε να μετακινήσουμε την πρόσληψη ή τη λήξη για να ταιριάξουν, επειδή καθεμία περιγράφει πραγματικό γεγονός.',
        'Η πρόσληψη γράφει 01/05/2025, αλλά η λήξη γράφει 30/04/2025. Η εργασία φαίνεται να τελειώνει πριν αρχίσει. Τα έγγραφα θα δείξουν ποια ημερομηνία χρειάζεται διόρθωση.',
        'Ελέγξτε μαζί την πρόσληψη και τη λήξη ή αποχώρηση στα αντίστοιχα έγγραφα. Επιβεβαιώστε ότι αφορούν την ίδια εργασιακή σχέση.'],
    [['CONFLICTING_RECORDED_CONTRACT_END'],
        'Δεν μπορούμε να διαλέξουμε ποια λήξη σύμβασης ισχύει. Η επιλογή αλλάζει τις ημέρες που καλύπτει η σύμβαση.',
        'Δύο καταχωρίσεις της ίδιας αλλαγής σύμβασης γράφουν λήξη 30/09/2025 και 31/12/2025. Η δεύτερη μπορεί να αφορά παράταση, αλλά αυτό πρέπει να επιβεβαιωθεί από τη σύμβαση.',
        'Ελέγξτε την αρχική σύμβαση και τυχόν παράταση. Επιβεβαιώστε τη λήξη που αντιστοιχεί σε κάθε αλλαγή σύμβασης.'],
    [['CONTRACT_CONTINUATION_NOT_EVIDENCED', 'CONTRACT_EXTENSION_NOT_EVIDENCED'],
        'Μια μεταγενέστερη καταχώριση δεν αποδεικνύει από μόνη της ότι παρατάθηκε η σύμβαση ούτε με ποιους όρους συνεχίστηκε η εργασία.',
        'Η σύμβαση λήγει στις 30/06/2025, αλλά υπάρχει αλλαγή αποδοχών στις 01/07/2025. Μπορεί να υπήρξε παράταση· χωρίς το σχετικό έγγραφο δεν γνωρίζουμε αν και μέχρι πότε συνεχίστηκε η σύμβαση.',
        'Βρείτε τη σύμβαση και τυχόν παράταση. Ελέγξτε τη λήξη, τη μεταγενέστερη καταχώριση και τους όρους που ίσχυσαν μετά τη λήξη.'],
    [['INVALID_RECORDED_CONTRACT_END', 'INVALID_TEMPORAL_DATE'],
        'Δεν μπορούμε να αντικαταστήσουμε μια ημερομηνία που δεν διαβάζεται σωστά με μια ημερομηνία της επιλογής μας.',
        'Μια καταχώριση γράφει 31/02/2025. Ο Φεβρουάριος δεν έχει αυτή την ημέρα και δεν γνωρίζουμε αν εννοείται 28/02 ή κάποια ημέρα του Μαρτίου.',
        'Ελέγξτε τις ημερομηνίες στα έγγραφα πρόσληψης, σύμβασης και αποχώρησης. Συμπληρώστε τη σωστή ημερομηνία μόνο αφού επιβεβαιωθεί.'],
    [['CONFLICTING_PROFILE_EVENTS', 'MISSING_PERIOD_TERMS_AMBIGUOUS', 'INCOMPATIBLE_VERIFIED_CANDIDATES'],
        'Υπάρχουν περισσότερες από μία εκδοχές όρων εργασίας. Δεν μπορούμε να αποφασίσουμε ποια ίσχυε ούτε από ποια ημέρα, γιατί αυτό μπορεί να αλλάξει τις ώρες ή τις αποδοχές.',
        'Για την ίδια περίοδο μια εγγραφή γράφει 40 ώρες την εβδομάδα και μια άλλη 20. Μπορεί να είναι λάθος καταχώριση ή πραγματική αλλαγή σύμβασης. Χρειάζεται να επιβεβαιωθούν οι ώρες και η ημερομηνία αλλαγής· δεν αρκεί να επιλεγεί η πιο πρόσφατη εγγραφή.',
        'Συγκρίνετε τις διαφορετικές ώρες, ημέρες και αποδοχές με τις συμβάσεις. Επιβεβαιώστε με τον υπεύθυνο μισθοδοσίας ποιοι όροι ίσχυαν και από ποια ημερομηνία.'],
    [['HISTORY_COVERAGE_MISSING', 'MISSING_PERIOD_TERMS_NOT_EVIDENCED', 'CONTRARY_MISSING_PERIOD_EVIDENCE'],
        'Για το διάστημα που αναφέρεται δεν επιβεβαιώθηκαν οι όροι εργασίας. Δεν μπορούμε να αντιγράψουμε αυτόματα τους προηγούμενους ή τους επόμενους όρους, επειδή μπορεί να είχαν αλλάξει.',
        'Η πρώτη περίοδος τελειώνει στις 31/03/2025 και η επόμενη αρχίζει στις 10/04/2025. Για τις ημέρες 1–9 Απριλίου δεν αναφέρονται όροι. Χρειάζεται να επιβεβαιωθεί αν υπήρχε εργασία και με ποιες ώρες και αποδοχές.',
        'Ελέγξτε το διάστημα που αναφέρεται με τον υπεύθυνο μισθοδοσίας. Βρείτε τη σύμβαση ή την αλλαγή σύμβασης που δείχνει αν υπήρχε εργασία και ποιες ώρες, ημέρες και αποδοχές ίσχυαν τότε.'],
    [['NUMERIC_PROFILE_FACT_UNRECORDED', 'INVALID_NUMERIC_PROFILE_FACT', 'INVALID_PROPOSED_WORK_TERMS'],
        'Δεν μπορούμε να συμπληρώσουμε ώρες, ημέρες ή ποσά με μια συνηθισμένη τιμή. Θα μπορούσε να προκύψει διαφορετική απασχόληση ή διαφορετικός μισθός από τον συμφωνημένο.',
        'Μια αλλαγή σύμβασης αρχίζει στις 01/04/2025, αλλά δεν αναφέρει τις εβδομαδιαίες ώρες. Οι 40 ώρες της προηγούμενης περιόδου δεν αποδεικνύουν ότι παρέμειναν 40 μετά την αλλαγή.',
        'Επιβεβαιώστε από τη σύμβαση τις ημέρες και ώρες εργασίας, την ευέλικτη προσέλευση και τις αποδοχές της περιόδου. Ξεχωρίστε την τιμή μηδέν από ένα στοιχείο που δεν έχει καταχωριστεί.'],
    [['REFERENCE_STATE_NOT_LOADED', 'INVALID_REFERENCE_EVIDENCE', 'REFERENCE_SEMANTICS_UNKNOWN',
        'INACTIVE_REFERENCE_WOULD_CHANGE', 'INACTIVE_ORIGINAL_WOULD_CHANGE', 'PROTECTED_PAYLOAD_WOULD_CHANGE',
        'PROTECTED_SURVIVOR_NOT_ESTABLISHED', 'LIVE_REFERENCE_BLOCKS_REPAIR', 'CYCLIC_CANONICAL_REFERENCE'],
        'Παλιότερα αποτελέσματα μπορεί να χρησιμοποιούν στοιχεία από αυτές τις εγγραφές. Δεν επιβεβαιώθηκε ότι η διόρθωση θα τα διατηρούσε όπως υπολογίστηκαν, γι’ αυτό σταμάτησε η αυτόματη αλλαγή.',
        'Μια εγγραφή του Μαρτίου χρησιμοποιήθηκε για ήδη υπολογισμένη μισθοδοσία. Αν αλλάξουν οι ώρες της ή διαγραφεί η εγγραφή, το παλιό αποτέλεσμα μπορεί να μη συμφωνεί πια με τα στοιχεία στα οποία βασίστηκε.',
        'Ζητήστε από τον υπεύθυνο μισθοδοσίας και τον διαχειριστή να ελέγξουν ποια παλιότερα αποτελέσματα χρησιμοποιούν τις εγγραφές και πώς θα διατηρηθούν. Μην διαγράψετε εγγραφή για να προχωρήσει ο έλεγχος.'],
    [['NO_RECORDED_EMPLOYMENT', 'UNRECORDED_HIRE_WOULD_BE_CREATED'],
        'Χωρίς καταγεγραμμένη πρόσληψη δεν μπορούμε να αποφασίσουμε πότε άρχισε η εργασία. Η ημερομηνία μιας άλλης καταχώρισης δεν αρκεί για να δημιουργήσουμε πρόσληψη.',
        'Υπάρχει αλλαγή αποδοχών στις 01/04/2025, αλλά δεν υπάρχει ημερομηνία πρόσληψης. Η πρόσληψη μπορεί να έγινε τον Απρίλιο ή νωρίτερα· η αλλαγή αποδοχών δεν δίνει την απάντηση.',
        'Βρείτε το έγγραφο πρόσληψης και επιβεβαιώστε σε ποια πρόσληψη ανήκουν οι εγγραφές πριν συμπληρωθεί ημερομηνία.'],
    [['RECORDED_CYCLE_WOULD_BE_REMOVED', 'RECORDED_CHANGE_WOULD_BE_REMOVED'],
        'Η διόρθωση που εξετάστηκε θα αφαιρούσε μια καταγεγραμμένη πρόσληψη ή αλλαγή σύμβασης. Δεν γνωρίζουμε ότι αυτή η καταχώριση έγινε κατά λάθος.',
        'Υπάρχει αλλαγή από 40 σε 20 ώρες στις 01/07/2025. Αν αφαιρεθεί η εγγραφή μόνο για να ενωθούν δύο περίοδοι, θα χαθεί η πραγματική αλλαγή της σύμβασης.',
        'Επιβεβαιώστε από τα έγγραφα αν η πρόσληψη ή η αλλαγή σύμβασης πραγματοποιήθηκε. Μην αφαιρέσετε την εγγραφή μόνο για να συνεχιστεί η αυτόματη τακτοποίηση.'],
    [['PAST_CYCLE_CANNOT_CHANGE_CURRENT_EMPLOYEE'],
        'Η διόρθωση παλιότερης πρόσληψης θα άλλαζε και τα σημερινά στοιχεία. Δεν μπορούμε να θεωρήσουμε ότι οι παλιοί όροι ισχύουν στη σημερινή πρόσληψη.',
        'Η εργασία του 2024 ήταν 20 ώρες την εβδομάδα, ενώ η επαναπρόσληψη του 2025 είναι 40 ώρες. Μια διόρθωση στο 2024 δεν πρέπει να μεταφέρει τις 20 ώρες στα σημερινά στοιχεία.',
        'Ελέγξτε χωριστά τις συμβάσεις της παλιάς πρόσληψης και της επαναπρόσληψης. Επιβεβαιώστε ποιοι όροι αφορούν κάθε περίοδο.'],
    [['NO_ACTIVE_PROFILE', 'NO_ACTIVE_HISTORY'],
        'Με τη διόρθωση που εξετάστηκε δεν απέμενε περίοδος εργασίας που να μπορεί να χρησιμοποιηθεί. Δεν μπορούμε να συνεχίσουμε θεωρώντας ότι δεν υπήρξε εργασία.',
        'Αν όλες οι εγγραφές μιας πρόσληψης παραμεριστούν ως παλιές, μπορεί να μη μείνει καμία που να περιγράφει τις ώρες και τις αποδοχές. Αυτό δεν σημαίνει ότι ο εργαζόμενος δεν εργάστηκε.',
        'Ελέγξτε ποιες εγγραφές περιγράφουν την πραγματική εργασία και ποια σύμβαση καλύπτει κάθε περίοδο. Μην διαγράψετε άλλες εγγραφές για να παρακάμψετε το πρόβλημα.']
];
const genericGuide = [
    'Ελέγξαμε αν οι διορθώσεις θα άφηναν όλες τις ημέρες εργασίας με τους σωστούς όρους, θα διατηρούσαν τις προσλήψεις και αποχωρήσεις και δεν θα επηρέαζαν παλιότερα αποτελέσματα. Δεν μπορέσαμε να επιβεβαιώσουμε όλα αυτά μαζί. Δεν γνωρίζουμε ποια αλλαγή θα ήταν σωστή και δεν επιτρέπεται να διαλέξουμε αυθαίρετα.',
    'Δύο εγγραφές μπορεί να δείχνουν ότι οι όροι αλλάζουν μέσα στον Ιούνιο, χωρίς να είναι σαφές αν η αλλαγή έγινε την 1η ή τη 15η ημέρα. Και οι δύο ημερομηνίες είναι δυνατές, αλλά αλλάζουν τις ώρες ή τις αποδοχές για τις ενδιάμεσες ημέρες. Χρειάζεται η σύμβαση για να αποφασιστεί. Αυτό το παράδειγμα δεν σημαίνει ότι βρέθηκε τέτοια διαφορά στο δικό σας Ιστορικό.',
    'Ελέγξτε με τον υπεύθυνο μισθοδοσίας τη σειρά των προσλήψεων, αποχωρήσεων και αλλαγών σύμβασης, καθώς και τις ώρες, ημέρες και αποδοχές ανά περίοδο. Συγκρίνετέ τα με τα αντίστοιχα έγγραφα, ξεκινώντας από τα συγκεκριμένα ευρήματα που αναφέρονται παραπάνω.'
];
const uncertain = 'Δεν μπορέσαμε να εντοπίσουμε με βεβαιότητα ποια εγγραφή χρειάζεται διόρθωση.';
const genericReasons = new Set(['CANONICAL_STATE_NOT_CLEAN', 'FINAL_STATE_NOT_CLEAN', 'INVALID_PROPOSED_STATE',
    'INVALID_OR_CONFLICTING_INPUT', 'PREVIEW_IDENTITY_COLLISION', 'RECONSTRUCTION_REQUIRES_BUSINESS_CONFIRMATION']);

function buildSettlementExplanation({ plan = {}, completeHistoryRows = [], currentEmployee = {},
    protectedReferenceSummary = {}, descriptions = {} } = {}) {
    const known = reason => typeof reason === 'string' && Object.hasOwn(descriptions, reason) ? descriptions[reason] : null;
    const guide = guides.find(([reasons]) => reasons.includes(plan.reason));
    const [safety, defaultExample, check] = guide ? guide.slice(1) : genericGuide;
    const finding = genericReasons.has(plan.reason) || !known(plan.reason)
        ? 'Δεν επιβεβαιώθηκε μια αυτόματη διόρθωση που να διατηρεί σωστά όλες τις περιόδους εργασίας και τα παλιότερα αποτελέσματα.' : known(plan.reason);
    const locations = [];
    const identifiableRows = Array.isArray(completeHistoryRows) && completeHistoryRows.every(row =>
        row && typeof row === 'object' && row._id != null) &&
        new Set(completeHistoryRows.map(row => String(row._id))).size === completeHistoryRows.length;
    const rows = identifiableRows ? sortHistoryForPresentation(completeHistoryRows) : [];
    const numbers = new Map(rows.map((row, index) => [String(row._id), String(index + 1).padStart(4, '0')]));
    const day = value => { try { return calendarDate(value)?.toISOString().slice(0, 10) || null; } catch { return null; } };
    const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && day(value) === value
        ? value.split('-').reverse().join('/') : null;
    const attempts = Array.isArray(plan.attempts) ? plan.attempts.filter(item => item && typeof item === 'object') : [];
    // A category found only in a rejected correction may inform the hypothetical
    // example, but must never become a diagnosis of the original employee rows.
    const exampleReason = attempts.flatMap(attempt => [attempt.reason, ...(Array.isArray(attempt.issues) ? attempt.issues : []),
        ...(Array.isArray(attempt.coverageGaps) && attempt.coverageGaps.length ? ['HISTORY_COVERAGE_MISSING'] : [])])
        .find(reason => guides.some(([reasons]) => reasons.includes(reason)));
    const example = guide ? defaultExample : guides.find(([reasons]) => reasons.includes(exampleReason))?.[2] || defaultExample;
    // EXISTING_STATE also passes through normalization. Matching boundaries
    // locate a period, but never prove that an original row is wrong.
    const sources = attempts.map(attempt => ({ original: attempt.solver === 'EXISTING_STATE',
        gaps: attempt.coverageGaps, issues: [attempt.reason, ...(Array.isArray(attempt.issues) ? attempt.issues : [])] }));
    sources.push({ original: false, gaps: plan.coverageGaps, issues: plan.issues });
    const boundaryNumber = (value, boundary, offset, hire) => {
        const row = rows.find(item => String(item._id) === String(value));
        if (!row || !date(hire)) return null;
        try {
            const edge = offset > 0 ? effectiveEnd(row) : effectiveStart(row);
            return day(row.hmeromhnia_proslhpshs) === hire && edge && date(boundary) &&
                new Date(edge.getTime() + offset * 86400000).toISOString().slice(0, 10) === boundary
                ? numbers.get(String(value)) : null;
        } catch { return null; }
    };
    const reportedIssues = new Set([finding]);
    for (const source of sources) {
        for (const gap of Array.isArray(source.gaps) ? source.gaps : []) {
            if (!gap || typeof gap !== 'object') continue;
            const from = date(gap.from), to = date(gap.to);
            if (!from || gap.to != null && !to || to && gap.to < gap.from) continue;
            const interval = to ? `από ${from} έως ${to}` : `από ${from}, χωρίς να έχει προσδιοριστεί μέχρι πότε`;
            const boundaryRows = [...new Set([
                gap.beforeHistoryId == null ? null : boundaryNumber(gap.beforeHistoryId, gap.from, 1, gap.hire),
                gap.afterHistoryId == null ? null : boundaryNumber(gap.afterHistoryId, gap.to, -1, gap.hire)
            ].filter(Boolean))];
            locations.push(`${source.original ? 'Στον έλεγχο που ξεκίνησε από το υπάρχον Ιστορικό' : 'Στον έλεγχο μιας προτεινόμενης διόρθωσης'} δεν επιβεβαιώθηκαν όροι εργασίας ${interval}.${boundaryRows.length
                ? ` Στον πίνακά σας, οι εγγραφές στα όρια αυτού του διαστήματος είναι οι Α/Α ${boundaryRows.join(', ')}. Αυτές οι ημερομηνίες βοηθούν να βρείτε την περίοδο· δεν σημαίνει ότι οι συγκεκριμένες εγγραφές είναι λανθασμένες.`
                : ''}${source.original ? '' : ' Το αποτέλεσμα αφορά τη διόρθωση που εξετάστηκε και δεν αποδεικνύει ότι το ίδιο κενό υπάρχει στις αποθηκευμένες εγγραφές.'}`);
        }
        const issues = [...new Set((Array.isArray(source.issues) ? source.issues : [])
            .filter(reason => !genericReasons.has(reason)).map(known).filter(Boolean))];
        for (const issue of issues) {
            if (reportedIssues.has(issue)) continue;
            reportedIssues.add(issue);
            locations.push(`${source.original ? 'Στον έλεγχο που ξεκίνησε από το υπάρχον Ιστορικό' : 'Για μια διόρθωση που εξετάστηκε'}: ${issue} Αυτό εξηγεί γιατί σταμάτησε ο έλεγχος της διόρθωσης· δεν δείχνει από μόνο του ποια αποθηκευμένη εγγραφή είναι λανθασμένη.`);
        }
    }
    // Allowlisted transcriptions only, not a second conflict detector. Never
    // serialize arbitrary employee text, reference payloads or internal identities.
    const allTemporal = ['hmeromhnia_proslhpshs', 'hmeromhnia_apoxorhshs', 'hmeromhnia_allaghs_symbashs',
        'hmeromhnia_lhxhs_symbashs', 'hmeromhnia_isxyos_oron_ergasias_apo', 'hmeromhnia_isxyos_oron_ergasias_eos'];
    const numeric = ['hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias', 'symbatikes_ores_ergasias',
        'evelikth_proselefsh', 'synolo_symbashs'];
    const terms = /PROFILE|TERMS|NUMERIC|CANDIDATES|MISSING_PERIOD|HISTORY_COVERAGE/.test(plan.reason || '');
    const reference = guide && guide[0].includes('REFERENCE_STATE_NOT_LOADED');
    const lifecycle = /EMPLOYMENT_CYCLE|LIFECYCLE|RECORDED_DEPARTURE/.test(plan.reason || '');
    const temporal = lifecycle ? ['hmeromhnia_proslhpshs', 'hmeromhnia_apoxorhshs'] : allTemporal;
    const recordedChoices = {
        kathestos_apasxolhshs: { '0': 'Πλήρης απασχόληση', '1': 'Μερική απασχόληση', '2': 'Εκ περιτροπής εργασία' },
        typos_apasxolhshs: { PLHRHS: 'Πλήρης απασχόληση', MERIKH: 'Μερική απασχόληση', EK_PERITROPHS: 'Εκ περιτροπής εργασία' },
        typos_ebdomadas: { '5HMERH': 'Πενθήμερη', '6HMERH': 'Εξαήμερη' }
    };
    const recorded = [];
    for (const row of [...(reference ? rows : rows.filter(row => !isInactiveHistoryRow(row))), currentEmployee]) {
        const name = row === currentEmployee ? 'Ισχύοντα στοιχεία εργαζομένου' : `Α/Α ${numbers.get(String(row._id))}`;
        if (reference) {
            if (row !== currentEmployee && Array.isArray(protectedReferenceSummary[String(row._id)]) &&
                protectedReferenceSummary[String(row._id)].length) recorded.push(`${name}: υπάρχει καταγεγραμμένη σύνδεση με παλιότερα αποτελέσματα.`);
            continue;
        }
        if (!guide) continue;
        const values = temporal.flatMap(field => {
            const value = date(day(row[field]));
            return value ? [`${labels[field]}: ${value}`] : [];
        });
        if (terms) for (const field of numeric) {
            if (typeof row[field] === 'number' && Number.isFinite(row[field])) values.push(`${labels[field]}: ${new Intl.NumberFormat('el-GR', { maximumFractionDigits: 20 }).format(row[field])}${field === 'synolo_symbashs' ? ' €' : ''}`);
        }
        if (terms) for (const [field, choices] of Object.entries(recordedChoices)) {
            if (typeof row[field] === 'string' && Object.hasOwn(choices, row[field])) values.push(`${labels[field]}: ${choices[row[field]]}`);
        }
        if (values.length) recorded.push(`${name} — ${values.join(' · ')}.`);
    }
    if (recorded.length) locations.push('Για να συγκρίνετε τα στοιχεία με τα έγγραφά σας, είναι καταχωρισμένα τα παρακάτω. Η αναφορά μιας εγγραφής εδώ δεν σημαίνει ότι είναι λανθασμένη.', ...recorded);
    locations.unshift(uncertain);
    return {
        reviewed: reference ? 'Ξεκινήσαμε ελέγχοντας ποια παλιότερα αποτελέσματα χρησιμοποιούν τις εγγραφές του Ιστορικού και αν μια διόρθωση θα τα διατηρούσε όπως υπολογίστηκαν. Ο έλεγχος σταμάτησε πριν επιβεβαιωθούν όλα τα στοιχεία.' : 'Ελέγξαμε αν οι περίοδοι από την πρόσληψη μέχρι την αποχώρηση καλύπτουν τις ημέρες εργασίας, αν οι αλλαγές σύμβασης έχουν τους αντίστοιχους όρους και αν μια διόρθωση θα διατηρούσε τα ήδη υπολογισμένα αποτελέσματα.',
        finding, locations: [...new Set(locations)], safety,
        example: `Υποθετικό παράδειγμα — οι ημερομηνίες και οι τιμές που ακολουθούν δεν είναι στοιχεία του εργαζομένου σας. ${example}`,
        checks: [check, 'Αφού επιβεβαιωθούν τα στοιχεία, ζητήστε από τον αρμόδιο για το Ιστορικό να διορθώσει μόνο όσα αποδεικνύονται από τα έγγραφα και επαναλάβετε τον έλεγχο. Από αυτή την επεξήγηση δεν αποθηκεύεται καμία αλλαγή.'],
        reference: 'ΙΣΤ-ΑΥΤ-3Α'
    };
}
module.exports = { buildSettlementExplanation };
