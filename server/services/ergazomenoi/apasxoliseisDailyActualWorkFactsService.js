// Pure daily facts used by weekly compliance and payroll calculations.

const REASON = Object.freeze({
    INVALID_DECLARED_HOURS: 'INVALID_DECLARED_HOURS',
    INVALID_CARD_HOURS: 'INVALID_CARD_HOURS',
    UNSUPPORTED_DAILY_CATEGORY: 'UNSUPPORTED_DAILY_CATEGORY'
});

const WARNING = Object.freeze({
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
    buildCardIntervals
} = require('./apasxoliseisScenarioFactsService');

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
    return String(
        row.kathgoria_ergasias_apologistika || row.kathgoria_ergasias || ''
    ).trim().toUpperCase();
}

function resolveDailyActualWorkFacts(row = {}) {
    const declared = nonNegativeNumber(row.ores_ergasias);
    const cards = nonNegativeNumber(row.cards_ores_ergasias);
    const reasons = [];
    const warnings = [];
    if (!declared.ok) reasons.push(REASON.INVALID_DECLARED_HOURS);
    if (!cards.ok) reasons.push(REASON.INVALID_CARD_HOURS);

    const leaveProvenance = classifyLeaveProvenance(row);
    const category = categoryOf(row);
    const hasCompleteCardEvidence = buildCardIntervals(row).some(
        (interval) => interval.isComplete && !interval.isZeroLength
    );
    if (reasons.length > 0) {
        return Object.freeze({
            category,
            cardHours: cards.ok ? cards.value : null,
            hasCompleteCardEvidence,
            actualWorkHours: 0,
            leaveHours: 0,
            sicknessHours: 0,
            countsAsActualWorkDay: false,
            reasons,
            warnings
        });
    }

    let actualWorkHours = 0;
    let leaveHours = 0;
    let sicknessHours = 0;
    if (leaveProvenance === LEAVE_PROVENANCE.AUTO_CALCULATED_LEAVE) {
        leaveHours = declared.value;
    } else if (category === 'ΕΡΓ') {
        actualWorkHours = cards.value;
    } else if (category === 'ΑΔΕΙΑ') {
        actualWorkHours = cards.value > 0 ? cards.value : declared.value;
        leaveHours = cards.value > 0 ? Math.max(declared.value - cards.value, 0) : 0;
        if (actualWorkHours > 0 && leaveHours > 0) {
            warnings.push(WARNING.MIXED_WORK_AND_HOURLY_LEAVE);
        }
    } else if (category === 'ΑΡΓΙΑ') {
        actualWorkHours = declared.value;
        if (cards.value > declared.value) {
            warnings.push(WARNING.HOLIDAY_CARD_HOURS_EXCEED_DECLARED_HOURS);
        }
    } else if (category === 'ΑΣΘΕΝΕΙΑ') {
        actualWorkHours = cards.value;
        sicknessHours = Math.max(declared.value - cards.value, 0);
        if (actualWorkHours > 0 && sicknessHours > 0) {
            warnings.push(WARNING.MIXED_WORK_AND_SICKNESS);
        }
    } else if (category === 'ΑΝ' || category === 'ΜΕ') {
        actualWorkHours = cards.value;
    } else {
        reasons.push(REASON.UNSUPPORTED_DAILY_CATEGORY);
    }

    if (cards.value > declared.value && ['ΑΔΕΙΑ', 'ΑΣΘΕΝΕΙΑ'].includes(category)) {
        warnings.push(WARNING.CARD_HOURS_EXCEED_DECLARED_HOURS);
    }

    return Object.freeze({
        category,
        cardHours: cards.value,
        hasCompleteCardEvidence,
        actualWorkHours,
        leaveHours,
        sicknessHours,
        countsAsActualWorkDay: actualWorkHours > 0,
        reasons: [...new Set(reasons)],
        warnings: [...new Set(warnings)]
    });
}

module.exports = { REASON, WARNING, nonNegativeNumber, resolveDailyActualWorkFacts };
