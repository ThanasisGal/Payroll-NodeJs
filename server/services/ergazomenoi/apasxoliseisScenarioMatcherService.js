// Pure scenario matcher for Apasxoliseis facts.
// This module returns proposed decisions only; it must not write or apply updates.

const SCENARIO_VERSION = 'mvp:v1';

const CONFIDENCE = Object.freeze({
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
});

const DECISION_STATUS = Object.freeze({
    CLASSIFIED_ONLY: 'CLASSIFIED_ONLY',
    PENDING_REVIEW: 'PENDING_REVIEW',
    AUTO_APPLIED: 'AUTO_APPLIED',
    HR_CONFIRMED: 'HR_CONFIRMED',
    HR_OVERRIDDEN: 'HR_OVERRIDDEN',
    IGNORED: 'IGNORED'
});

const REASON_CODES = Object.freeze({
    DECLARED_WORK_WITHOUT_CARDS: 'DECLARED_WORK_WITHOUT_CARDS',
    DECLARED_LEAVE_FOUND: 'DECLARED_LEAVE_FOUND',
    HOLIDAY_REQUIRED_FOUND: 'HOLIDAY_REQUIRED_FOUND',
    HOLIDAY_OPTIONAL_COMPANY_WORKS: 'HOLIDAY_OPTIONAL_COMPANY_WORKS',
    HOLIDAY_OPTIONAL_COMPANY_CLOSED: 'HOLIDAY_OPTIONAL_COMPANY_CLOSED',
    ZERO_LENGTH_CARD_INTERVAL_FOUND: 'ZERO_LENGTH_CARD_INTERVAL_FOUND',
    SPLIT_SHIFT_DEVIATION_FOUND: 'SPLIT_SHIFT_DEVIATION_FOUND',
    DECLARED_REPO_WITH_CARDS: 'DECLARED_REPO_WITH_CARDS',
    DECLARED_NON_WORK_WITH_CARDS: 'DECLARED_NON_WORK_WITH_CARDS',
    REPO_TRANSFER_CANDIDATE: 'REPO_TRANSFER_CANDIDATE',
    LEGAL_CLASSIFICATION_REQUIRED: 'LEGAL_CLASSIFICATION_REQUIRED',
    UNKNOWN_PATTERN: 'UNKNOWN_PATTERN'
});

const SCENARIO_CODES = Object.freeze({
    DECLARED_WORK_NO_CARDS_LEAVE: 'DECLARED_WORK_NO_CARDS_LEAVE',
    DECLARED_WORK_NO_CARDS_HOLIDAY_REQUIRED: 'DECLARED_WORK_NO_CARDS_HOLIDAY_REQUIRED',
    DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_WORKS:
        'DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_WORKS',
    DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_CLOSED:
        'DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_CLOSED',
    DECLARED_REPO_WITH_CARDS: 'DECLARED_REPO_WITH_CARDS',
    DECLARED_NON_WORK_WITH_CARDS: 'DECLARED_NON_WORK_WITH_CARDS',
    ZERO_LENGTH_CARD_INTERVAL: 'ZERO_LENGTH_CARD_INTERVAL',
    SPLIT_SHIFT_MATCHED_WITH_DEVIATION: 'SPLIT_SHIFT_MATCHED_WITH_DEVIATION',
    REPO_TRANSFER_WITHIN_WEEK: 'REPO_TRANSFER_WITHIN_WEEK',
    UNKNOWN_PATTERN_REQUIRES_REVIEW: 'UNKNOWN_PATTERN_REQUIRES_REVIEW'
});

function uniqueArray(values = []) {
    return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function getWarningsArray(facts = {}) {
    const warnings = facts.warnings || {};
    return [
        ...(Array.isArray(warnings.missingCriticalFacts)
            ? warnings.missingCriticalFacts
            : []),
        ...(Array.isArray(warnings.conflictingFacts) ? warnings.conflictingFacts : [])
    ];
}

function hasCriticalWarnings(facts = {}) {
    const warnings = facts.warnings || {};
    return (
        (Array.isArray(warnings.missingCriticalFacts) &&
            warnings.missingCriticalFacts.length > 0) ||
        (Array.isArray(warnings.conflictingFacts) && warnings.conflictingFacts.length > 0) ||
        warnings.legalClassificationPending === true
    );
}

function hasCompleteNonZeroIntervals(intervals = []) {
    return (
        Array.isArray(intervals) &&
        intervals.filter((interval) => interval?.isComplete && !interval?.isZeroLength).length >= 2
    );
}

function buildScenarioDecision({
    scenario_code,
    confidence,
    requires_review,
    reasons = [],
    warnings = [],
    proposed_updates = {},
    display_labels = {},
    audit_payload = {},
    can_auto_apply = false,
    blocked_by_lock = false,
    blocked_by_legal_pending = false
}) {
    return {
        scenario_code,
        scenario_version: SCENARIO_VERSION,
        confidence,
        requires_review: requires_review === true,
        decision_status:
            requires_review === true
                ? DECISION_STATUS.PENDING_REVIEW
                : DECISION_STATUS.CLASSIFIED_ONLY,
        reasons: uniqueArray(reasons),
        warnings: uniqueArray(warnings),
        proposed_updates,
        display_labels,
        audit_payload,
        can_auto_apply: can_auto_apply === true,
        blocked_by_lock: blocked_by_lock === true,
        blocked_by_legal_pending: blocked_by_legal_pending === true
    };
}

function makeDecision(template, facts, options = {}) {
    const proposedUpdates =
        typeof template.proposed_updates === 'function'
            ? template.proposed_updates(facts, options)
            : template.proposed_updates || {};

    return buildScenarioDecision({
        scenario_code: template.scenario_code,
        confidence: template.confidence,
        requires_review: template.requires_review,
        reasons: template.reasons,
        warnings: getWarningsArray(facts),
        proposed_updates: proposedUpdates,
        display_labels: template.display_labels || {},
        audit_payload: {
            scenario_code: template.scenario_code,
            scenario_version: SCENARIO_VERSION,
            reasons: template.reasons
        },
        can_auto_apply: false,
        blocked_by_lock: facts?.review?.is_locked === true,
        blocked_by_legal_pending: facts?.warnings?.legalClassificationPending === true
    });
}

function makeUnknownDecision(facts = {}) {
    const legalPending = facts?.warnings?.legalClassificationPending === true;
    const reasons = [REASON_CODES.UNKNOWN_PATTERN];

    if (legalPending) {
        reasons.push(REASON_CODES.LEGAL_CLASSIFICATION_REQUIRED);
    }

    return buildScenarioDecision({
        scenario_code: SCENARIO_CODES.UNKNOWN_PATTERN_REQUIRES_REVIEW,
        confidence: CONFIDENCE.LOW,
        requires_review: true,
        reasons,
        warnings: getWarningsArray(facts),
        proposed_updates: {},
        display_labels: {
            badge: 'ΠΡΟΣ ΕΛΕΓΧΟ'
        },
        audit_payload: {
            scenario_code: SCENARIO_CODES.UNKNOWN_PATTERN_REQUIRES_REVIEW,
            scenario_version: SCENARIO_VERSION,
            reasons
        },
        can_auto_apply: false,
        blocked_by_lock: facts?.review?.is_locked === true,
        blocked_by_legal_pending: legalPending
    });
}

function getMvpScenarioTemplates() {
    return [
        {
            scenario_code: SCENARIO_CODES.DECLARED_WORK_NO_CARDS_LEAVE,
            description: 'Προδηλωμένο ΕΡΓ χωρίς κάρτες, με καταχωρημένη άδεια.',
            confidence: CONFIDENCE.HIGH,
            requires_review: false,
            reasons: [
                REASON_CODES.DECLARED_WORK_WITHOUT_CARDS,
                REASON_CODES.DECLARED_LEAVE_FOUND
            ],
            match: (facts) =>
                facts?.declared?.isDeclaredWork === true &&
                facts?.declared?.hasDeclaredHours === true &&
                facts?.cards?.hasCards === false &&
                facts?.leave?.hasDeclaredLeave === true,
            proposed_updates: (facts) => ({
                adeia_apologistika: true,
                argia: false,
                kathgoria_adeias_apologistika: facts?.leave?.kathgoria_adeias || 'ΑΔΑΛ'
            })
        },
        {
            scenario_code: SCENARIO_CODES.DECLARED_WORK_NO_CARDS_HOLIDAY_REQUIRED,
            description: 'Προδηλωμένο ΕΡΓ χωρίς κάρτες σε υποχρεωτική αργία.',
            confidence: CONFIDENCE.HIGH,
            requires_review: false,
            reasons: [
                REASON_CODES.DECLARED_WORK_WITHOUT_CARDS,
                REASON_CODES.HOLIDAY_REQUIRED_FOUND
            ],
            match: (facts) =>
                facts?.declared?.isDeclaredWork === true &&
                facts?.declared?.hasDeclaredHours === true &&
                facts?.cards?.hasCards === false &&
                facts?.holiday?.isHoliday === true &&
                facts?.holiday?.isMandatoryHoliday === true &&
                facts?.holiday?.companyWorksOnMandatoryHoliday === false,
            proposed_updates: {
                adeia_apologistika: false,
                argia: true,
                kathgoria_adeias_apologistika: ''
            }
        },
        {
            scenario_code: SCENARIO_CODES.DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_CLOSED,
            description:
                'Προδηλωμένο ΕΡΓ χωρίς κάρτες σε μη υποχρεωτική αργία με κλειστή εταιρεία.',
            confidence: CONFIDENCE.HIGH,
            requires_review: false,
            reasons: [
                REASON_CODES.DECLARED_WORK_WITHOUT_CARDS,
                REASON_CODES.HOLIDAY_OPTIONAL_COMPANY_CLOSED
            ],
            match: (facts) =>
                facts?.declared?.isDeclaredWork === true &&
                facts?.declared?.hasDeclaredHours === true &&
                facts?.cards?.hasCards === false &&
                facts?.holiday?.isHoliday === true &&
                facts?.holiday?.isOptionalHoliday === true &&
                facts?.holiday?.companyWorksOnOptionalHoliday === false,
            proposed_updates: {
                adeia_apologistika: false,
                argia: true,
                kathgoria_adeias_apologistika: ''
            }
        },
        {
            scenario_code: SCENARIO_CODES.DECLARED_WORK_NO_CARDS_HOLIDAY_OPTIONAL_COMPANY_WORKS,
            description:
                'Προδηλωμένο ΕΡΓ χωρίς κάρτες σε μη υποχρεωτική αργία με λειτουργία εταιρείας.',
            confidence: CONFIDENCE.MEDIUM,
            requires_review: true,
            reasons: [
                REASON_CODES.DECLARED_WORK_WITHOUT_CARDS,
                REASON_CODES.HOLIDAY_OPTIONAL_COMPANY_WORKS
            ],
            match: (facts) =>
                facts?.declared?.isDeclaredWork === true &&
                facts?.declared?.hasDeclaredHours === true &&
                facts?.cards?.hasCards === false &&
                facts?.holiday?.isHoliday === true &&
                facts?.holiday?.isOptionalHoliday === true &&
                facts?.holiday?.companyWorksOnOptionalHoliday === true,
            proposed_updates: {
                adeia_apologistika: true,
                argia: false,
                kathgoria_adeias_apologistika: 'ΑΔΑΛ'
            }
        },
        {
            scenario_code: SCENARIO_CODES.ZERO_LENGTH_CARD_INTERVAL,
            description: 'Ίδια ώρα εισόδου-εξόδου χωρίς πραγματικές κάρτες.',
            confidence: CONFIDENCE.HIGH,
            requires_review: false,
            reasons: [REASON_CODES.ZERO_LENGTH_CARD_INTERVAL_FOUND],
            match: (facts) =>
                facts?.cards?.hasZeroLengthCardInterval === true &&
                facts?.cards?.hasCards === false,
            proposed_updates: {}
        },
        {
            scenario_code: SCENARIO_CODES.DECLARED_REPO_WITH_CARDS,
            description: 'Προδηλωμένο ΡΕΠΟ με πραγματικές κάρτες.',
            confidence: CONFIDENCE.HIGH,
            requires_review: false,
            reasons: [REASON_CODES.DECLARED_REPO_WITH_CARDS],
            match: (facts) =>
                facts?.declared?.isDeclaredRepo === true && facts?.cards?.hasCards === true,
            proposed_updates: {
                kathgoria_ergasias_apologistika: 'ΕΡΓ'
            }
        },
        {
            scenario_code: SCENARIO_CODES.DECLARED_NON_WORK_WITH_CARDS,
            description: 'Προδηλωμένη ΜΗ ΕΡΓΑΣΙΑ / ΜΕ με κάρτες.',
            confidence: CONFIDENCE.MEDIUM,
            requires_review: true,
            reasons: [REASON_CODES.DECLARED_NON_WORK_WITH_CARDS],
            match: (facts) =>
                facts?.declared?.isDeclaredNonWork === true && facts?.cards?.hasCards === true,
            proposed_updates: {
                kathgoria_ergasias_apologistika: 'ΕΡΓ'
            }
        },
        {
            scenario_code: SCENARIO_CODES.SPLIT_SHIFT_MATCHED_WITH_DEVIATION,
            description: 'Σπαστό προδηλωμένο και σπαστές κάρτες με απολογιστικά intervals.',
            confidence: CONFIDENCE.HIGH,
            requires_review: false,
            reasons: [REASON_CODES.SPLIT_SHIFT_DEVIATION_FOUND],
            match: (facts) =>
                hasCompleteNonZeroIntervals(facts?.declared?.declaredIntervals) &&
                hasCompleteNonZeroIntervals(facts?.cards?.cardIntervalsNormalized) &&
                hasCompleteNonZeroIntervals(
                    facts?.apologistika?.currentApologistikaIntervals
                ),
            proposed_updates: {}
        },
        {
            scenario_code: SCENARIO_CODES.REPO_TRANSFER_WITHIN_WEEK,
            description: 'Πιθανή μεταφορά ρεπό εντός εβδομάδας.',
            confidence: CONFIDENCE.MEDIUM,
            requires_review: true,
            reasons: [REASON_CODES.REPO_TRANSFER_CANDIDATE],
            match: (_facts, options = {}) => options?.weeklyContext?.possibleRepoTransfer === true,
            proposed_updates: {}
        }
    ];
}

function matchApasxoliseisScenarioFacts(facts, options = {}) {
    if (hasCriticalWarnings(facts)) {
        return makeUnknownDecision(facts);
    }

    const templates = getMvpScenarioTemplates();
    const matchedTemplate = templates.find((template) => template.match(facts, options));

    if (matchedTemplate) {
        return makeDecision(matchedTemplate, facts, options);
    }

    return makeUnknownDecision(facts);
}

module.exports = {
    matchApasxoliseisScenarioFacts,
    getMvpScenarioTemplates,
    buildScenarioDecision,
    SCENARIO_CODES,
    CONFIDENCE,
    DECISION_STATUS,
    REASON_CODES
};
