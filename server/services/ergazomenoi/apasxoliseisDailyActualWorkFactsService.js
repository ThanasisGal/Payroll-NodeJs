// Pure daily facts used by weekly compliance and payroll calculations.

const REASON = Object.freeze({
    INVALID_DECLARED_HOURS: 'INVALID_DECLARED_HOURS',
    INVALID_CARD_HOURS: 'INVALID_CARD_HOURS',
    INVALID_EXPLICIT_HOURLY_LEAVE_HOURS: 'INVALID_EXPLICIT_HOURLY_LEAVE_HOURS',
    EXPLICIT_HOURLY_LEAVE_EXCEEDS_DECLARED_BALANCE:
        'EXPLICIT_HOURLY_LEAVE_EXCEEDS_DECLARED_BALANCE',
    FULL_DAY_LEAVE_WITH_CARD_WORK_REQUIRES_HR_DECISION:
        'FULL_DAY_LEAVE_WITH_CARD_WORK_REQUIRES_HR_DECISION',
    UNSUPPORTED_DAILY_CATEGORY: 'UNSUPPORTED_DAILY_CATEGORY'
});

const WARNING = Object.freeze({
    INCOMPLETE_CARD_INTERVAL: 'INCOMPLETE_CARD_INTERVAL',
    CARD_HOURS_EXCEED_DECLARED_HOURS: 'CARD_HOURS_EXCEED_DECLARED_HOURS',
    MIXED_WORK_AND_HOURLY_LEAVE: 'MIXED_WORK_AND_HOURLY_LEAVE',
    MIXED_WORK_AND_SICKNESS: 'MIXED_WORK_AND_SICKNESS',
    HOLIDAY_CARD_HOURS_EXCEED_DECLARED_HOURS: 'HOLIDAY_CARD_HOURS_EXCEED_DECLARED_HOURS'
});
const {
    LEAVE_PROVENANCE,
    classifyLeaveProvenance
} = require('./apasxoliseisLeaveProvenanceService');
const {
    resolveCardPairVerification
} = require('./apasxoliseisCardPairResolverService');
const {
    isApprovedOrphanResolution
} = require('./apasxoliseisOrphanCardResolutionService');

function nonNegativeNumber(value) {
    if (value === null || value === undefined || String(value).trim() === '') {
        return { ok: true, value: 0 };
    }
    if (!['string', 'number'].includes(typeof value)) return { ok: false, value: null };
    const number = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(number) && number >= 0
        ? { ok: true, value: number }
        : { ok: false, value: null };
}

function categoryOf(row = {}) {
    if (row.astheneia_apologistika === true || row.astheneia === true) return 'ΑΣΘΕΝΕΙΑ';
    if (row.argia_apologistika === true || row.argia === true) return 'ΑΡΓΙΑ';
    if (row.adeia_apologistika === true || row.adeia === true) return 'ΑΔΕΙΑ';
    if (row.apousia_apologistika === true) return 'ΑΠΟΥΣΙΑ';
    return String(
        row.kathgoria_ergasias_apologistika || row.kathgoria_ergasias || ''
    ).trim().toUpperCase();
}

function resolveDailyActualWorkFacts(row = {}, {
    calculatedWorkHoursAuthoritative = false,
    isCalculatedWorkHoursAuthoritativeForRow = null
} = {}) {
    const calculatedHoursAreAuthoritative =
        typeof isCalculatedWorkHoursAuthoritativeForRow === 'function'
            ? isCalculatedWorkHoursAuthoritativeForRow(row) === true
            : calculatedWorkHoursAuthoritative === true;
    const declared = nonNegativeNumber(row.ores_ergasias);
    const cards = nonNegativeNumber(row.cards_ores_ergasias);
    const calculatedWork = nonNegativeNumber(row.ores_ergasias_apologistika);
    const explicitHourlyLeave = nonNegativeNumber(
        row.explicit_hourly_leave_hours ?? row.ores_apoysias
    );
    const reasons = [];
    const warnings = [];
    if (!declared.ok) reasons.push(REASON.INVALID_DECLARED_HOURS);
    if (!cards.ok) reasons.push(REASON.INVALID_CARD_HOURS);
    if (!explicitHourlyLeave.ok) reasons.push(REASON.INVALID_EXPLICIT_HOURLY_LEAVE_HOURS);

    const leaveProvenance = classifyLeaveProvenance(row);
    const category = categoryOf(row);
    const cardVerification = resolveCardPairVerification(row);
    const approvedOrphan = cardVerification.hasUnresolvedCardEvidence &&
        isApprovedOrphanResolution(row);
    const hasCompleteCardEvidence = cardVerification.hasCompleteCardEvidence;
    const hasIncompleteCardInterval = cardVerification.hasUnresolvedCardEvidence;
    const verificationFacts = {
        cardVerificationStatus: cardVerification.status,
        verifiedCardHours: cardVerification.verifiedHours,
        completeCardPairNumbers: cardVerification.completePairNumbers,
        unresolvedCardPairNumbers: cardVerification.unresolvedPairNumbers
    };
    if (reasons.length > 0) {
        return Object.freeze({
            category,
            declaredWorkHours: declared.ok ? declared.value : null,
            cardHours: cards.ok ? cards.value : null,
            hasCompleteCardEvidence,
            ...verificationFacts,
            actualWorkHours: 0,
            leaveHours: 0,
            holidayCreditedHours: 0,
            sicknessHours: 0,
            countsAsActualWorkDay: false,
            reasons,
            warnings
        });
    }

    // Τα πλήρη ζεύγη παραμένουν αποδεδειγμένος χρόνος ακόμη κι όταν άλλο
    // ζεύγος της ημέρας είναι ελλιπές. Το ανεξακρίβωτο τμήμα δεν
    // συμπληρώνεται και δεν μετατρέπεται σε εργασία, άδεια, αργία ή ρεπό.
    if (hasIncompleteCardInterval && approvedOrphan) {
        const actualWorkHours = calculatedWork.ok ? calculatedWork.value : 0;
        return Object.freeze({ category: 'ΕΡΓ', declaredWorkHours: declared.value,
            cardHours: cards.value, hasCompleteCardEvidence: false, ...verificationFacts,
            cardVerificationStatus: 'HR_APPROVED_ORPHAN', actualWorkHours,
            leaveHours: 0, holidayCreditedHours: 0, sicknessHours: 0,
            countsAsActualWorkDay: true, reasons: [],
            warnings: [WARNING.INCOMPLETE_CARD_INTERVAL, 'HR_APPROVED_ORPHAN_CARD_RESOLUTION'] });
    }
    if (hasIncompleteCardInterval) {
        const verifiedActualWorkHours = hasCompleteCardEvidence
            ? cardVerification.verifiedHours
            : 0;
        return Object.freeze({
            category: 'ΕΡΓ',
            declaredWorkHours: declared.value,
            cardHours: cards.value,
            hasCompleteCardEvidence,
            ...verificationFacts,
            actualWorkHours: verifiedActualWorkHours,
            leaveHours: 0,
            holidayCreditedHours: 0,
            sicknessHours: 0,
            countsAsActualWorkDay: true,
            reasons: ['ORPHAN_CARD_DURATION_REQUIRES_HR_DECISION'],
            warnings: [WARNING.INCOMPLETE_CARD_INTERVAL]
        });
    }

    let actualWorkHours = 0;
    let leaveHours = 0;
    let holidayCreditedHours = 0;
    let sicknessHours = 0;
    // Τα πλήρη ζεύγη καρτών αποδεικνύουν την παρουσία. Όταν η ημερήσια
    // φάση έχει ήδη παράγει θετικές απολογιστικές ώρες, εκείνες είναι το
    // δεσμευτικό αριθμητικό αποτέλεσμα μετά την εφαρμογή διαλείμματος.
    const effectiveWorkedHours =
        cards.value > 0 && calculatedWork.ok && (
            calculatedHoursAreAuthoritative || row.is_locked === true ||
            calculatedWork.value > 0
        )
            ? calculatedWork.value
            : cards.value;
    if (leaveProvenance === LEAVE_PROVENANCE.AUTO_CALCULATED_LEAVE) {
        leaveHours = declared.value;
    } else if (category === 'ΕΡΓ') {
        actualWorkHours = effectiveWorkedHours;
    } else if (category === 'ΑΔΕΙΑ') {
        actualWorkHours = effectiveWorkedHours;
        if (explicitHourlyLeave.value > 0) {
            leaveHours = explicitHourlyLeave.value;
            if (leaveHours + cards.value > declared.value + 0.02) {
                reasons.push(REASON.EXPLICIT_HOURLY_LEAVE_EXCEEDS_DECLARED_BALANCE);
            }
        } else if (cards.value > 0) {
            reasons.push(REASON.FULL_DAY_LEAVE_WITH_CARD_WORK_REQUIRES_HR_DECISION);
        } else {
            leaveHours = declared.value;
        }
        if (actualWorkHours > 0 && explicitHourlyLeave.value > 0) {
            warnings.push(WARNING.MIXED_WORK_AND_HOURLY_LEAVE);
        }
    } else if (category === 'ΑΡΓΙΑ') {
        actualWorkHours = effectiveWorkedHours;
        holidayCreditedHours = Math.max(declared.value - actualWorkHours, 0);
        if (cards.value > declared.value) {
            warnings.push(WARNING.HOLIDAY_CARD_HOURS_EXCEED_DECLARED_HOURS);
        }
    } else if (category === 'ΑΣΘΕΝΕΙΑ') {
        actualWorkHours = effectiveWorkedHours;
        sicknessHours = Math.max(declared.value - actualWorkHours, 0);
        if (actualWorkHours > 0 && sicknessHours > 0) {
            warnings.push(WARNING.MIXED_WORK_AND_SICKNESS);
        }
    } else if (category === 'ΑΝ' || category === 'ΜΕ' || category === 'ΑΠΟΥΣΙΑ') {
        actualWorkHours = effectiveWorkedHours;
    } else {
        reasons.push(REASON.UNSUPPORTED_DAILY_CATEGORY);
    }

    if (cards.value > declared.value && ['ΑΔΕΙΑ', 'ΑΣΘΕΝΕΙΑ'].includes(category)) {
        warnings.push(WARNING.CARD_HOURS_EXCEED_DECLARED_HOURS);
    }

    return Object.freeze({
        category,
        declaredWorkHours: declared.value,
        cardHours: cards.value,
        hasCompleteCardEvidence,
        ...verificationFacts,
        actualWorkHours,
        leaveHours,
        holidayCreditedHours,
        sicknessHours,
        countsAsActualWorkDay: actualWorkHours > 0,
        reasons: [...new Set(reasons)],
        warnings: [...new Set(warnings)]
    });
}

module.exports = { REASON, WARNING, nonNegativeNumber, resolveDailyActualWorkFacts };
