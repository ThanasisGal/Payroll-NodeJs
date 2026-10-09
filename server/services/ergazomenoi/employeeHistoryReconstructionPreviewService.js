'use strict';

const C = require('./employeeHistoryAutomaticReconstructionContract');
const { isNoOp } = require('./employeeHistoryAutomaticReconstructionApplyContract');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');
const { registryEntryForCanonicalField } = require('./employeeHistoryCorrectionFieldRegistryService');

// Explicit public allowlist. Everything else in the 118-path contract stays
// server-side, including identities, scope, timestamps, versions and references.
const DISPLAY_FIELDS = Object.freeze(['aa_eggrafhs', ...C.FIELD_GROUPS.TEMPORAL_SEMANTIC,
    ...C.FIELD_GROUPS.INFORMATIONAL, ...C.PROFILE_FIELDS]);
const SCHEDULE_FIELDS = new Set(['hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos']);
const DATE_FIELDS = new Set([...C.FIELD_GROUPS.TEMPORAL_SEMANTIC.filter(f => f !== 'afora_proslhpsh'),
    ...SCHEDULE_FIELDS, ...C.PROFILE_FIELDS.filter(f => C.PROFILE_FIELD_TYPES[f] === 'Date')]);
const GROUP_TITLES = Object.freeze(['Χρονικά Στοιχεία', 'Στοιχεία Απασχόλησης', 'Στοιχεία Σύμβασης',
    'Αποδοχές', 'Κρατήσεις / Ασφάλιση', 'Λοιπά Στοιχεία']);
const INFORMATIONAL_NOTE = 'Πληροφοριακό πεδίο — δεν χρησιμοποιείται στην αυτόματη τακτοποίηση.';
const numberFormat = new Intl.NumberFormat('el-GR', { maximumFractionDigits: 4 });
const empty = value => value === undefined || value === null || value === '';
const identity = value => value == null ? '' : String(value);
const safeText = value => typeof value === 'string'
    ? value.replace(/\b[a-f\d]{24}\b/gi, 'Μη διαθέσιμη περιγραφή') : '';

function formatDate(value) {
    try {
        const date = calendarDate(value);
        return date ? date.toISOString().slice(0, 10).split('-').reverse().join('/') : 'Μη έγκυρη ημερομηνία';
    } catch { return 'Μη έγκυρη ημερομηνία'; }
}
function formatValue(field, value, catalogs = {}) {
    if (empty(value)) return 'Δεν έχει καταχωριστεί';
    if (DATE_FIELDS.has(field)) return formatDate(value);
    if (typeof value === 'boolean') {
        if (field === 'synexes_diakekomeno') return value ? 'Διακεκομμένο' : 'Συνεχές';
        if (field === 'typos_orarioy') return value ? 'Μεταβαλλόμενο' : 'Σταθερό';
        if (field === 'dialleima_entos_ektos_orarioy') return value ? 'Εντός Ωραρίου' : 'Εκτός Ωραρίου';
        return value ? 'Ναι' : 'Όχι';
    }
    if (typeof value === 'number') return Number.isFinite(value) ? numberFormat.format(value) : 'Μη έγκυρη τιμή';
    if (Array.isArray(value)) {
        if (!value.length) return 'Καμία ημέρα';
        const days = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];
        return value.every(v => Number.isInteger(v) && v >= 1 && v <= 7)
            ? value.map(v => days[v - 1]).join(', ') : 'Χρειάζεται έλεγχος των ημερών';
    }
    if (typeof value !== 'string') return 'Μη διαθέσιμη περιγραφή';
    const catalog = registryEntryForCanonicalField(field)?.catalog;
    const description = catalog && catalogs[catalog]?.find(item => item.code === value)?.label;
    if (typeof description === 'string' && description.trim()) return safeText(`${value} - ${description}`);
    if (field === 'kathestos_apasxolhshs') {
        return ({ '0': 'Πλήρης Απασχόληση', '1': 'Μερική Απασχόληση', '2': 'Εκ Περιτροπής Εργασία' })[value] || safeText(value);
    }
    if (field === 'typos_apasxolhshs') {
        return ({ PLHRHS: 'Πλήρης Απασχόληση', MERIKH: 'Μερική Απασχόληση', EK_PERITROPHS: 'Εκ Περιτροπής Εργασία' })[value] || safeText(value);
    }
    return safeText(value);
}
function groupFor(field) {
    if (DATE_FIELDS.has(field) || field === 'afora_proslhpsh') return GROUP_TITLES[0];
    if (/^(symbash|kathgoria_symbashs|eidikothta_symbashs|stoixeio_symbashs_|poso_symbashs_|synolo_symbashs)/.test(field)) return GROUP_TITLES[2];
    if (/Misthos|Hmeromisthio|Oromisthio|misthologiko_klimakio/.test(field)) return GROUP_TITLES[3];
    if (field.startsWith('krathsh_')) return GROUP_TITLES[4];
    if (field === 'aa_eggrafhs') return GROUP_TITLES[5];
    return GROUP_TITLES[1];
}
const SOURCE_LABELS = Object.freeze({
    EXISTING: 'Άλλη Εγγραφή της Ίδιας Περιόδου',
    DETERMINISTIC_HIRE_BOUNDARY: 'Ημερομηνία Πρόσληψης',
    DETERMINISTIC_CONTRACT_CHANGE_BOUNDARY: 'Αλλαγή Σύμβασης',
    DETERMINISTIC_NEXT_PERIOD_BOUNDARY: 'Έναρξη Επόμενης Περιόδου',
    DETERMINISTIC_CONTINUATION_BOUNDARY: 'Λήξη Προηγούμενης Περιόδου',
    PREVIOUS_PERIOD: 'Προηγούμενη Περίοδος', NEXT_PERIOD: 'Επόμενη Περίοδος',
    CURRENT_EMPLOYEE: 'Τρέχοντα Στοιχεία Εργαζομένου', DEFAULT_VALUE: 'Αυτόματη Προεπιλογή',
    APPLICATION_ASSUMPTION: 'Υπόθεση Εφαρμογής', AUTHORITATIVE_FINAL_BOUNDARY: 'Καταχωρισμένη Αποχώρηση ή Λήξη Σύμβασης',
    DETERMINISTIC_OPEN_BOUNDARY: 'Δεν υπάρχει καταχωρισμένη τελική λήξη'
});
function confidence(item) {
    if (item.confidence === 'ASSUMED' || item.sourceType === 'APPLICATION_ASSUMPTION') return 'Χρειάζεται Έλεγχο';
    if (item.sourceType === 'DEFAULT_VALUE') return 'Προεπιλογή';
    if (['EXISTING', 'PREVIOUS_PERIOD', 'NEXT_PERIOD'].includes(item.sourceType)) return 'Κληρονομήθηκε';
    return 'Αυτόματο / Βέβαιο';
}
function priority(diff) {
    if ([C.START, C.END].includes(diff.field)) return 0;
    if ([C.HIRE, C.CHANGE, C.CONTRACT_END, C.DEPARTURE].includes(diff.field)) return 1;
    if (C.CRITICAL_NUMBERS.includes(diff.field)) return 2;
    if (/symbash|krathsh_|kathestos|typos_apasxolhshs/.test(diff.field)) return 3;
    return diff.confidence === 'ASSUMED' ? 5 : 4;
}

const ISSUE_MESSAGES = Object.freeze({
    HIRE_INFERRED_FROM_EARLIEST_PROFILE_EVENT: 'Δεν βρέθηκε ημερομηνία πρόσληψης. Η εφαρμογή προτείνει την παλαιότερη καταχωρισμένη έναρξη όρων ή αλλαγή σύμβασης.',
    EMPLOYMENT_CYCLE_ASSUMED: 'Δεν ήταν σαφές σε ποια πρόσληψη ανήκει μία εγγραφή. Η εφαρμογή προτείνει την πλησιέστερη τεκμηριωμένη εργασιακή σχέση.',
    EXISTING_INITIAL_START_AFTER_HIRE: 'Η αρχική έναρξη όρων εργασίας διαφέρει από την πρόσληψη. Προτείνεται η αρχική περίοδος να αρχίζει στην ημερομηνία πρόσληψης.',
    COMPETING_PROFILE_START_BOUNDARIES: 'Βρέθηκαν διαφορετικές ημερομηνίες έναρξης και αλλαγής σύμβασης. Η εφαρμογή προτείνει την καταχωρισμένη έναρξη ισχύος των όρων.',
    INCONSISTENT_EXISTING_START: 'Η καταχωρισμένη έναρξη δεν συμφωνεί με την εργασιακή σχέση. Ελέγξτε την προτεινόμενη περίοδο.',
    UNDATED_ROW_ATTACHED_TO_UNIQUE_COMPATIBLE_PERIOD: 'Μία εγγραφή δεν έχει σαφή ημερομηνία έναρξης. Η εφαρμογή προτείνει να ενταχθεί στη συμβατή περίοδο.',
    UNDATED_ROW_PLACEMENT_ASSUMED: 'Μία εγγραφή μπορεί να ανήκει σε περισσότερες περιόδους. Η εφαρμογή προτείνει την παλαιότερη συμβατή περίοδο ή την αρχική εργασιακή κατάσταση.',
    CURRENT_TERMINATION_DIFFERS_FROM_HISTORY: 'Η τρέχουσα λήξη διαφέρει από το Ιστορικό. Η πρόταση χρησιμοποιεί την καταχωρισμένη ιστορική λήξη.',
    PROFILE_EVENT_AFTER_DEPARTURE: 'Υπάρχουν όροι εργασίας μετά από καταχωρισμένη αποχώρηση. Η πρόταση διατηρεί τη μεταγενέστερη περίοδο· ελέγξτε τις ημερομηνίες.',
    COMPETING_FINAL_BOUNDARIES: 'Βρέθηκαν διαφορετικές ημερομηνίες λήξης. Η εφαρμογή προτείνει πρώτα την αποχώρηση ή, διαφορετικά, την πιο πρόσφατη ιστορική λήξη σύμβασης.',
    CYCLE_TERMINATION_ASSUMED_BEFORE_REHIRE: 'Δεν βρέθηκε λήξη πριν από επαναπρόσληψη. Προτείνεται η προηγούμενη σχέση να τελειώνει την προηγούμενη ημέρα.',
    CURRENT_EMPLOYEE_PROFILE_FALLBACK: 'Δεν βρέθηκε καλύτερο ιστορικό στοιχείο. Η πρόταση χρησιμοποιεί τα εφαρμόσιμα τρέχοντα στοιχεία του εργαζομένου.',
    EXISTING_PERIOD_END_REBUILT: 'Η καταχωρισμένη λήξη περιόδου διαφέρει από την προτεινόμενη. Ελέγξτε τις δύο ημερομηνίες στις αλλαγές.',
    LEGACY_ZERO_PLACEHOLDER_REPLACED: 'Ένα παλαιό μηδενικό στις ημέρες ή ώρες αντικαθίσταται από διαθέσιμα ιστορικά στοιχεία.',
    UNUSABLE_PROFILE_VALUE_REPLACED: 'Μία καταχωρισμένη τιμή δεν μπορεί να χρησιμοποιηθεί με ασφάλεια. Ελέγξτε την αρχική και την προτεινόμενη τιμή.',
    HISTORICAL_NON_EMPTY_VALUE_CHANGE: 'Το στοιχείο αλλάζει μεταξύ διαφορετικών περιόδων. Οι διαφορετικές ιστορικές τιμές διατηρούνται.',
    INVALID_TEMPORAL_DATE: 'Μία καταχωρισμένη ημερομηνία δεν είναι έγκυρη και δεν χρησιμοποιήθηκε για την πρόταση.',
    INCONSISTENT_TERMINATING_EVENT: 'Μία αποχώρηση ή λήξη σύμβασης δεν συμφωνεί με την περίοδο και δεν χρησιμοποιήθηκε ως λήξη της.',
    INCONSISTENT_RECONSTRUCTED_WORK_TERMS: 'Οι ημέρες και οι ώρες εργασίας δεν συμφωνούν μεταξύ τους. Ελέγξτε τα προτεινόμενα στοιχεία απασχόλησης.',
    INCONSISTENT_RECONSTRUCTED_PROFILE: 'Ορισμένα στοιχεία ωραρίου, διαλείμματος ή εγκεκριμένης ρύθμισης χρειάζονται έλεγχο.'
});

function buildEmployeeHistoryReconstructionPreview({ plan, completeHistoryRows, catalogs = {} }) {
    const displayValue = (field, value) => formatValue(field, value, catalogs);
    const orderedRows = [...completeHistoryRows].sort((a, b) =>
        String(a.aa_eggrafhs || '').localeCompare(String(b.aa_eggrafhs || ''), 'el') || identity(a._id).localeCompare(identity(b._id)));
    const rowLabels = new Map(orderedRows.map((row, index) => [identity(row._id),
        safeText(String(row.aa_eggrafhs || '')) || String(index + 1).padStart(4, '0')]));
    const rowLabel = id => rowLabels.get(identity(id)) || 'Μη διαθέσιμη εγγραφή';
    const publicField = (field, value) => ({ label: labels[field], value: displayValue(field, value),
        ...(SCHEDULE_FIELDS.has(field) ? { informational: true, note: INFORMATIONAL_NOTE } : {}) });
    const originalRows = orderedRows.map(row => ({ label: rowLabel(row._id),
        summary: `${formatValue(C.START, row[C.START])} → ${empty(row[C.END]) ? 'Χωρίς καταχωρισμένη λήξη' : formatDate(row[C.END])}`,
        ...(row.employment_history_canonical_status === 'REDUNDANT_REFERENCED'
            ? { note: 'Η εγγραφή διατηρείται για υπάρχουσες αναφορές και δεν δημιουργεί νέα εργασιακή περίοδο.' } : {}),
        groups: GROUP_TITLES.map(title => ({ title,
            fields: DISPLAY_FIELDS.filter(field => groupFor(field) === title).map(field => publicField(field, row[field])) }))
    }));
    const publicChange = diff => ({ row: rowLabel(diff.historyId), field: labels[diff.field],
        before: displayValue(diff.field, diff.beforeMissing ? undefined : diff.before), after: displayValue(diff.field, diff.after),
        source: SOURCE_LABELS[diff.sourceType] || 'Διαθέσιμα Ιστορικά Στοιχεία',
        ...(diff.sourceHistoryId ? { sourceRow: rowLabel(diff.sourceHistoryId) } : {}),
        confidence: confidence(diff) });
    const changes = plan.rowDiffs.filter(diff => DISPLAY_FIELDS.includes(diff.field));
    const numericDefaults = changes.filter(diff => diff.sourceType === 'DEFAULT_VALUE' &&
        C.PROFILE_FIELD_TYPES[diff.field] === 'Number' && diff.after === 0);
    const defaultSet = new Set(numericDefaults);
    const meaningfulChanges = changes.filter(diff => !defaultSet.has(diff)).sort((a, b) =>
        priority(a) - priority(b) || labels[a.field].localeCompare(labels[b.field], 'el') || rowLabel(a.historyId).localeCompare(rowLabel(b.historyId)));
    const defaultGroups = orderedRows.map(row => {
        const items = numericDefaults.filter(diff => identity(diff.historyId) === identity(row._id));
        return { row: rowLabel(row._id), count: items.length, changes: items.map(publicChange) };
    }).filter(group => group.count);
    const important = ['kathestos_apasxolhshs', ...C.CRITICAL_NUMBERS, 'symbash', 'kathgoria_symbashs', 'eidikothta_symbashs', 'krathsh_01'];
    const periods = plan.logicalPeriods.map(period => ({ from: formatDate(period.from),
        to: period.to ? formatDate(period.to) : 'Χωρίς καταχωρισμένη λήξη',
        rows: period.sourceHistoryIds.map(rowLabel), facts: important.filter(field => !empty(period.profile[field]))
            .map(field => publicField(field, period.profile[field])) }));
    const issue = item => {
        let message = ISSUE_MESSAGES[item.code] || 'Ορισμένα στοιχεία χρειάζονται έλεγχο πριν από την τακτοποίηση.';
        let conflict;
        if (item.code === 'SAME_DATE_NON_EMPTY_CONFLICT') {
            const values = (item.sourceValues || []).map(value => displayValue(item.field, value.value));
            const selected = (item.sourceValues || []).find(value => identity(value.historyId) === identity(item.selectedSourceHistoryId));
            message = `Βρέθηκαν διαφορετικές τιμές για το πεδίο «${labels[item.field] || 'Στοιχείο Ιστορικού'}» στην ίδια περίοδο: ${values.join(' / ')}. Η εφαρμογή προτείνει ${displayValue(item.field, selected?.value)}.`;
            conflict = { values, proposed: displayValue(item.field, selected?.value),
                ...(selected ? { sourceRow: rowLabel(selected.historyId) } : {}) };
        }
        const group = groupFor(item.field || '');
        const category = group === GROUP_TITLES[0] || /HIRE|BOUNDAR|START|UNDATED|TERMINAT|DEPARTURE|PERIOD_END|TEMPORAL|CYCLE/.test(item.code)
            ? 'Ημερομηνίες' : group === GROUP_TITLES[3] ? 'Αποδοχές' : group === GROUP_TITLES[2] ? 'Σύμβαση'
                : group === GROUP_TITLES[4] ? 'Ασφάλιση / ΚΠΚ' : 'Λοιπά';
        return { message, category, ...(conflict ? { conflict } : {}), ...(labels[item.field] ? { field: labels[item.field] } : {}),
            ...(item.sourceHistoryIds ? { rows: item.sourceHistoryIds.map(rowLabel) } : {}) };
    };
    const blocked = plan.status === 'BLOCKED';
    const unchanged = isNoOp(plan);
    return { status: blocked ? 'unavailable' : unchanged ? 'unchanged' : plan.status === 'REVIEW_REQUIRED' ? 'review' : 'ready',
        message: blocked ? 'Δεν είναι δυνατό να εφαρμοστεί αυτόματα ασφαλής τακτοποίηση. Δεν έχει αποθηκευτεί καμία αλλαγή.\n1. Ελέγξτε την πρόσληψη και τις ημερομηνίες του Ιστορικού.\n2. Αν το πρόβλημα παραμένει, επικοινωνήστε με τον διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-ΠΡΟΕΠ-01.'
            : unchanged ? 'Το Ιστορικό είναι ήδη τακτοποιημένο.'
                : plan.status === 'REVIEW_REQUIRED' ? 'Η πρόταση περιλαμβάνει σημεία που χρειάζονται την προσοχή σας. Δεν έχει αποθηκευτεί καμία αλλαγή.\n1. Συγκρίνετε τις αρχικές και τις προτεινόμενες τιμές στα σημεία προσοχής.\n2. Αν συμφωνείτε με την πρόταση, επιλέξτε την έγκριση και εφαρμόστε την τακτοποίηση. Αν χρειάζεται διαφορετική διόρθωση, κλείστε την προεπισκόπηση και χρησιμοποιήστε τον έλεγχο της αντίστοιχης εγγραφής.'
                    : 'Η προτεινόμενη τακτοποίηση είναι έτοιμη για προβολή. Δεν έχει αποθηκευτεί καμία αλλαγή.',
        summary: { historyRows: completeHistoryRows.length, periods: periods.length, changes: changes.length,
            assumptions: plan.assumptions.length, warnings: plan.warnings.length, numericDefaults: numericDefaults.length },
        originalRows, periods, changes: meaningfulChanges.map(publicChange), defaultGroups,
        attention: [...new Map([...plan.assumptions, ...plan.warnings].map(item => {
            const entry = issue(item); return [JSON.stringify(entry), entry];
        })).values()] };
}

module.exports = { DISPLAY_FIELDS, GROUP_TITLES, INFORMATIONAL_NOTE, formatValue, buildEmployeeHistoryReconstructionPreview };
