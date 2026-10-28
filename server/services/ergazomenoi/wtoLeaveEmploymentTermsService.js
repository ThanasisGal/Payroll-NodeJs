'use strict';

const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { getEffectiveTermsApo, getEffectiveTermsEos, resolveEmploymentTypeValue,
    resolveEffectiveWeeklyWorkdays, normalizeWeeklyWorkdaysValue } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const { resolveEmploymentCycleForDate, STATUS } = require('./employeeEmploymentCycleResolverService');

function termsError(code, reason) {
    const error = new Error(`Η προεπισκόπηση της κανονικής άδειας σταμάτησε: ${reason} ` +
        '1. Ελέγξτε το Ιστορικό και τους όρους εργασίας που ίσχυαν την ημέρα της άδειας. ' +
        '2. Ζητήστε από τον υπεύθυνο προσωπικού να επιβεβαιώσει τα στοιχεία πριν από νέα προεπισκόπηση. ' +
        `Δεν αποθηκεύτηκε καμία αλλαγή και δεν έγινε υποβολή. Κωδικός αναφοράς: ${code}`);
    error.code = code;
    return error;
}

// Read-only resolution. Never fill historical gaps from the latest employee terms.
function resolveWtoLeaveEmploymentTerms(employee, date, history = []) {
    history = semanticHistoryRows(history);
    let lifecycle;
    try {
        lifecycle = resolveEmploymentCycleForDate(date, { currentEmployee: employee, history });
    } catch (error) {
        throw termsError(error.code, 'οι καταγεγραμμένες προσλήψεις και αποχωρήσεις είναι ασύμβατες.');
    }
    // Preserve the existing WTOLeave rule: a recorded departure does not truncate
    // the entitlement reference date. A gap before a rehire must never cross cycles.
    const cycle = lifecycle.cycle || (lifecycle.status === STATUS.AFTER_LAST_DEPARTURE
        ? lifecycle.previous_cycle : null);
    if (!cycle) throw termsError('WTOLEAVE_EMPLOYMENT_CYCLE_UNKNOWN',
        'δεν τεκμηριώνεται η αντίστοιχη πρόσληψη για την ημερομηνία της άδειας.');
    const target = T.day(date);
    const cycleHistory = history.filter(row => {
        const hire = T.day(row.hmeromhnia_proslhpshs);
        if (hire) return hire.toISOString().slice(0, 10) === cycle.hire_date;
        const from = getEffectiveTermsApo(row);
        return from && from >= T.day(cycle.hire_date) &&
            (!cycle.departure_date || from <= T.day(cycle.departure_date));
    });
    let matching = cycleHistory.filter(row => {
        const from = getEffectiveTermsApo(row), until = getEffectiveTermsEos(row);
        return row.afora_allagh_oron_ergasias !== false && from && from >= T.day(cycle.hire_date) && from <= target &&
            (!until || target <= until);
    });
    if (matching.some(T.complete)) matching = matching.filter(T.complete);
    if (matching.length > 1) throw termsError('WTOLEAVE_AMBIGUOUS_WORK_TERMS',
        'υπάρχουν επικαλυπτόμενοι όροι εργασίας για την ίδια ημερομηνία.');
    let profile = matching[0];
    let source = 'HISTORY';
    if (!profile && cycle.is_current_cycle) {
        const temporal = T.fallback(date, employee, cycleHistory);
        const from = getEffectiveTermsApo(employee), until = getEffectiveTermsEos(employee);
        if (temporal.source === 'PRE_V1_COMPATIBILITY_ANCHOR' ||
            (temporal.source === 'CURRENT_PROFILE' && from >= T.day(cycle.hire_date))) {
            profile = temporal.facts;
            source = temporal.source;
        } else if (!T.versioned(employee, cycleHistory) && from && from >= T.day(cycle.hire_date) && from <= target &&
            (!until || target <= until) && !cycleHistory.some(row =>
                getEffectiveTermsApo(row) >= from && getEffectiveTermsApo(row) <= target)) {
            profile = employee;
            source = 'DATED_CURRENT_TERMS';
        }
    }
    if (!profile) throw termsError('WTOLEAVE_HISTORICAL_WORK_TERMS_UNKNOWN',
        'δεν έχουν καταγραφεί οι ισχύοντες όροι εργασίας για την ημέρα της άδειας.');
    const primary = profile.hmeres_ergasias_ebdomadas;
    if (primary != null && String(primary).trim() !== '' &&
        (!['number', 'string'].includes(typeof primary) || (Number(primary) !== 0 &&
        ![5, 6].includes(normalizeWeeklyWorkdaysValue(primary))))) {
        throw termsError('WTOLEAVE_INVALID_WEEKLY_DAYS',
            'οι καταγεγραμμένες ημέρες εβδομαδιαίας εργασίας δεν υποστηρίζουν υπολογισμό πενθημέρου ή εξαημέρου.');
    }
    const weeklyDays = resolveEffectiveWeeklyWorkdays(profile);
    if (![5, 6].includes(weeklyDays)) throw termsError('WTOLEAVE_INVALID_WEEKLY_DAYS',
        'δεν τεκμηριώνεται πενθήμερη ή εξαήμερη εργασία για την ημέρα της άδειας.');
    const explicitWeekType = normalizeWeeklyWorkdaysValue(profile.typos_ebdomadas);
    if (explicitWeekType !== null && explicitWeekType !== weeklyDays) {
        throw termsError('WTOLEAVE_INVALID_WEEKLY_DAYS',
            'οι καταγεγραμμένοι όροι διαφωνούν ως προς την πενθήμερη ή εξαήμερη εργασία.');
    }
    const employmentType = resolveEmploymentTypeValue(profile);
    if (!['0', '1', '2'].includes(employmentType)) throw termsError('WTOLEAVE_INVALID_EMPLOYMENT_TYPE',
        'δεν τεκμηριώνεται ο τύπος απασχόλησης για την ημέρα της άδειας.');
    if (profile !== employee && profile.proyphresia_adeias_se_eth == null &&
        Number(employee.proyphresia_adeias_se_eth || 0) !== 0) {
        throw termsError('WTOLEAVE_HISTORICAL_PREVIOUS_SERVICE_UNKNOWN',
            'δεν τεκμηριώνεται η αναγνωρισμένη προϋπηρεσία άδειας της αντίστοιχης περιόδου.');
    }
    return { hireDate: cycle.hire_date, weeklyDays,
        employmentType,
        previousLeaveServiceYears: profile.proyphresia_adeias_se_eth ??
            employee.proyphresia_adeias_se_eth,
        source, historyId: profile._id ? String(profile._id) : null };
}

module.exports = { resolveWtoLeaveEmploymentTerms };
