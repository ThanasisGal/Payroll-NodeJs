const {
    dateKeyUtc,
    getMondaySundayWeekRange
} = require('../../utils/date/mondaySundayWeek');
const {
    resolveDailyActualWorkFacts
} = require('./apasxoliseisDailyActualWorkFactsService');
const {
    MODE: EFFECTIVE_REPO_MODE,
    resolveEffectiveRepoState
} = require('./apasxoliseisEffectiveRepoStateService');
const {
    resolveFullTimeFromWorkTerms
} = require('./apasxoliseisReviewEmploymentProfileService');

const POLICY_VERSION = 'sepe-weekly-sixth-seventh-day:v3';
const STATUS = Object.freeze({ READY: 'READY', NOT_APPLICABLE: 'NOT_APPLICABLE', NEEDS_HR_DECISION: 'NEEDS_HR_DECISION' });
const ZERO_RATE_EXEMPT_SPECIAL_CATEGORIES = new Set(['0009']);

function validRate(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const rate = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

function resolveSeventhDayIllegalOvertimeHours(day) {
    const actualHours = Number(day?.actualWorkHours);
    return Number.isFinite(actualHours) && actualHours >= 0 ? actualHours : 0;
}

function selectSixthDay(candidates) {
    const cardProvenCandidates = candidates
        .filter((day) => day.cardHours > 0 ||
            day.cardVerificationStatus === 'SAFE_AUTO_RESOLVED')
        .sort((a, b) => a.hmeromhnia.localeCompare(b.hmeromhnia));
    const standardCandidates = cardProvenCandidates.filter(
        (day) => day.actualWorkHours > 5 && day.actualWorkHours <= 8
    );
    const day = [...standardCandidates].sort((a, b) => {
        const distance = Math.abs(a.actualWorkHours - 8) - Math.abs(b.actualWorkHours - 8);
        return distance || b.hmeromhnia.localeCompare(a.hmeromhnia);
    })[0] || null;

    if (day) {
        return { day, warnings: [] };
    }

    const fallback = [...cardProvenCandidates].sort((a, b) => {
        const distance = Math.abs(b.actualWorkHours - 8) - Math.abs(a.actualWorkHours - 8);
        return distance || a.hmeromhnia.localeCompare(b.hmeromhnia);
    }).at(-1) || null;

    if (fallback) {
        return {
            day: fallback,
            warnings: [
                'SIXTH_DAY_NO_STANDARD_CANDIDATE_CLOSEST_TO_EIGHT',
                ...(fallback.actualWorkHours > 8
                    ? ['SIXTH_DAY_DAILY_HOURS_EXCEED_EIGHT']
                    : [])
            ]
        };
    }

    return { day: null, reason: 'SIXTH_DAY_CANDIDATE_NOT_DETERMINISTIC' };
}

function isSixthDayEligible(day) {
    return (day.cardHours > 0 || day.cardVerificationStatus === 'SAFE_AUTO_RESOLVED') &&
        day.actualWorkHours > 5 && day.actualWorkHours <= 8;
}

function resolveCanonicalRepoDayIdentities({
    weekRows = [],
    effectiveProfile = {},
    allowedRepoIdentityCounts = [2]
} = {}) {
    const fullTime = resolveFullTimeFromWorkTerms(effectiveProfile);
    const explicitRepoCategories = [...new Set(
        weekRows
            .flatMap((row) => [
                row?.kathgoria_ergasias_apologistika,
                row?.kathgoria_ergasias
            ])
            .map((value) => String(value || '').trim())
            .filter((value) => value === 'ΑΝ' || value === 'ΜΕ')
    )];
    const expectedRepoCategory = fullTime === null
        ? (explicitRepoCategories.length === 1 ? explicitRepoCategories[0] : null)
        : (fullTime ? 'ΑΝ' : 'ΜΕ');
    const states = weekRows.map((row) => ({
        identity: dateKeyUtc(row?.hmeromhnia),
        state: resolveEffectiveRepoState({
            row,
            mode: EFFECTIVE_REPO_MODE.CURRENT,
            expectedRepoCategory
        })
    }));
    const diagnostics = [...new Set(states.flatMap(({ state }) => state.diagnostics || []))];
    const identities = states
        .filter(({ identity, state }) => identity && state.effectiveRepo === true)
        .map(({ identity }) => identity)
        .sort();

    if (diagnostics.length > 0 || !allowedRepoIdentityCounts.includes(identities.length)) {
        return Object.freeze({
            ok: false,
            canonicalRepoDayIdentities: Object.freeze([]),
            reasons: Object.freeze([
                ...(diagnostics.length > 0 ? diagnostics : []),
                ...(!allowedRepoIdentityCounts.includes(identities.length)
                    ? ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'] : [])
            ])
        });
    }
    return Object.freeze({
        ok: true,
        canonicalRepoDayIdentities: Object.freeze(identities),
        reasons: Object.freeze([])
    });
}

function resolveCurrentRepoCandidateIdentities({ weekRows = [], effectiveProfile = {} } = {}) {
    const fullTime = resolveFullTimeFromWorkTerms(effectiveProfile);
    const expectedRepoCategory = fullTime === null ? null : (fullTime ? 'ΑΝ' : 'ΜΕ');
    return weekRows.filter((row) => resolveEffectiveRepoState({
        row, mode: EFFECTIVE_REPO_MODE.CURRENT, expectedRepoCategory
    }).effectiveRepo === true).map((row) => dateKeyUtc(row.hmeromhnia)).filter(Boolean).sort();
}

function resolveSafeHumanRepoCandidateIdentities({ weekRows = [], effectiveProfile = {} } = {}) {
    const fullTime = resolveFullTimeFromWorkTerms(effectiveProfile);
    const expectedRepoCategory = fullTime === null ? null : (fullTime ? 'ΑΝ' : 'ΜΕ');
    return weekRows.filter((row) => {
        if (row?.is_locked === true) return false;
        const effectiveRepo = resolveEffectiveRepoState({
            row, mode: EFFECTIVE_REPO_MODE.CURRENT, expectedRepoCategory
        }).effectiveRepo === true;
        const declaredRepo = row?.repo === true ||
            ['ΑΝ', 'ΜΕ'].includes(String(row?.kathgoria_ergasias || '').trim());
        const facts = resolveDailyActualWorkFacts(row);
        const safeNonWorkDay = facts.countsAsActualWorkDay === false &&
            facts.cardVerificationStatus === 'READY';
        return effectiveRepo || declaredRepo || safeNonWorkDay;
    }).map((row) => dateKeyUtc(row.hmeromhnia)).filter(Boolean).sort();
}

function decisionFailure(reason, base = {}) {
    return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NEEDS_HR_DECISION,
        reasons: [reason], warnings: base.warnings || [], dailyFacts: base.dailyFacts || [],
        canonicalRepoDayIdentities: base.canonicalRepoDayIdentities || [],
        sixthDayIdentity: null, sixthDayRepoIdentity: null,
        remainingRepoIdentity: null, sixthDay: null, seventhDay: null });
}

function analyzeWeeklySixthSeventhDay({
    weekRows = [],
    effectiveProfile = {},
    hourlyRate = null,
    canonicalRepoDayIdentitiesOverride = null,
    allowDeclaredRepoIdentityOverride = false,
    classificationByDateOverride = null,
    calculatedWorkHoursAuthoritative = false,
    isCalculatedWorkHoursAuthoritativeForRow = null
} = {}) {
    const rows = Array.isArray(weekRows) ? weekRows : [];
    const dates = rows.map((row) => dateKeyUtc(row?.hmeromhnia));
    const range = dates[0] ? getMondaySundayWeekRange(dates[0]) : null;
    if (
        rows.length !== 7 ||
        dates.some((date) => !date) ||
        new Set(dates).size !== 7 ||
        !range ||
        dates.some((date) => getMondaySundayWeekRange(date)?.weekStartKey !== range.weekStartKey)
    ) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NEEDS_HR_DECISION, reasons: ['INVALID_OR_INCOMPLETE_MONDAY_SUNDAY_WEEK'], warnings: [], dailyFacts: [] });
    }
    if (effectiveProfile.profile_changed_inside_week === true) {
        return Object.freeze({
            policyVersion: POLICY_VERSION,
            status: STATUS.NEEDS_HR_DECISION,
            reasons: ['PROFILE_CHANGED_INSIDE_WEEK'],
            warnings: [],
            dailyFacts: [],
            sixthDay: null,
            seventhDay: null
        });
    }
    if (Number(effectiveProfile.hmeres_ergasias_ebdomadas) !== 5) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NOT_APPLICABLE, reasons: [], warnings: [], dailyFacts: [] });
    }
    const dailyFacts = rows
        .map((row) => ({
            hmeromhnia: dateKeyUtc(row.hmeromhnia),
            ...resolveDailyActualWorkFacts(row, {
                calculatedWorkHoursAuthoritative,
                isCalculatedWorkHoursAuthoritativeForRow
            })
        }))
        .sort((a, b) => a.hmeromhnia.localeCompare(b.hmeromhnia));
    const factReasons = [...new Set(dailyFacts.flatMap((day) => day.reasons))];
    if (factReasons.length > 0) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NEEDS_HR_DECISION, reasons: factReasons, warnings: [], dailyFacts });
    }
    if (dailyFacts.some((day) => !['READY', 'HR_APPROVED_ORPHAN'].includes(day.cardVerificationStatus))) {
        return Object.freeze({
            policyVersion: POLICY_VERSION,
            status: STATUS.NEEDS_HR_DECISION,
            reasons: ['CARD_VERIFICATION_PENDING'],
            warnings: [...new Set(dailyFacts.flatMap((day) => day.warnings))],
            dailyFacts,
            sixthDay: null,
            seventhDay: null
        });
    }
    const actualDays = dailyFacts.filter((day) => day.countsAsActualWorkDay);
    if (actualDays.length <= 5) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NOT_APPLICABLE, reasons: [], warnings: [...new Set(dailyFacts.flatMap((day) => day.warnings))], dailyFacts, sixthDay: null, seventhDay: null });
    }
    const repoIdentityResolution = resolveCanonicalRepoDayIdentities({
        weekRows: rows,
        effectiveProfile,
        allowedRepoIdentityCounts: [2]
    });
    let canonicalRepoDayIdentities;
    if (canonicalRepoDayIdentitiesOverride !== null) {
        const overrideFullTime = resolveFullTimeFromWorkTerms(effectiveProfile);
        const overrideExpectedRepoCategory = overrideFullTime === null
            ? null
            : (overrideFullTime ? 'ΑΝ' : 'ΜΕ');
        const override = [...new Set((Array.isArray(canonicalRepoDayIdentitiesOverride)
            ? canonicalRepoDayIdentitiesOverride : []).map(dateKeyUtc).filter(Boolean))].sort();
        const candidates = allowDeclaredRepoIdentityOverride
            ? rows.filter((row) => row?.repo === true ||
                ['ΑΝ', 'ΜΕ'].includes(String(row?.kathgoria_ergasias || '').trim()) ||
                resolveEffectiveRepoState({ row, mode: EFFECTIVE_REPO_MODE.CURRENT,
                    expectedRepoCategory: overrideExpectedRepoCategory }).effectiveRepo === true)
                .map((row) => dateKeyUtc(row.hmeromhnia)).filter(Boolean).sort()
            : resolveSafeHumanRepoCandidateIdentities({ weekRows: rows, effectiveProfile });
        const allowedRepoIdentityCounts = [1, 2];
        if (!allowedRepoIdentityCounts.includes(override.length) ||
            override.some((identity) => !dates.includes(identity)) ||
            override.some((identity) => !candidates.includes(identity))) {
            return decisionFailure('CANONICAL_DECISION_REPO_IDENTITIES_INVALID', {
                dailyFacts, warnings: [...new Set(dailyFacts.flatMap((day) => day.warnings))]
            });
        }
        canonicalRepoDayIdentities = override;
    } else if (!repoIdentityResolution.ok) {
        return Object.freeze({
            policyVersion: POLICY_VERSION,
            status: STATUS.NEEDS_HR_DECISION,
            reasons: [...repoIdentityResolution.reasons],
            warnings: [...new Set(dailyFacts.flatMap((day) => day.warnings))],
            dailyFacts,
            canonicalRepoDayIdentities: [],
            sixthDayIdentity: null,
            sixthDayRepoIdentity: null,
            remainingRepoIdentity: null,
            sixthDay: null,
            seventhDay: null
        });
    } else {
        canonicalRepoDayIdentities = [...repoIdentityResolution.canonicalRepoDayIdentities];
    }
    const workedRepoDays = actualDays.filter((day) =>
        canonicalRepoDayIdentities.includes(day.hmeromhnia)
    );
    const sixthCandidates = actualDays;
    let selected = selectSixthDay(sixthCandidates);
    if (!selected.day) {
        return Object.freeze({ policyVersion: POLICY_VERSION, status: STATUS.NEEDS_HR_DECISION, reasons: [selected.reason], warnings: [...new Set(dailyFacts.flatMap((day) => day.warnings))], dailyFacts, canonicalRepoDayIdentities, sixthDayIdentity: null, sixthDayRepoIdentity: null, remainingRepoIdentity: null, sixthDay: null, seventhDay: null });
    }
    let sixthDayIdentity = selected.day.hmeromhnia;
    let sixthDayRepoIdentity = canonicalRepoDayIdentities.includes(sixthDayIdentity)
        ? sixthDayIdentity : null;
    let seventhDayCandidates = actualDays.length >= 7
        ? workedRepoDays.filter((day) => day.hmeromhnia !== sixthDayIdentity) : [];
    let seventhDay = seventhDayCandidates.length === 1 ? seventhDayCandidates[0] : null;
    let remainingRepoIdentity = sixthDayRepoIdentity
        ? canonicalRepoDayIdentities.find((identity) => identity !== sixthDayIdentity) || null
        : seventhDay?.hmeromhnia || null;
    if (classificationByDateOverride === null && actualDays.length >= 7 &&
        seventhDayCandidates.length !== 1) {
        return decisionFailure('SEVENTH_DAY_IDENTITY_NOT_DETERMINISTIC', {
            dailyFacts, canonicalRepoDayIdentities
        });
    }
    if (classificationByDateOverride !== null) {
        const map = classificationByDateOverride && typeof classificationByDateOverride === 'object' &&
            !Array.isArray(classificationByDateOverride) ? classificationByDateOverride : {};
        const finalClassifications = Object.fromEntries(dates.map((date) => [date,
            date === sixthDayIdentity ? 'SIXTH' :
                seventhDay?.hmeromhnia === date ? 'SEVENTH' : 'NORMAL']));
        for (const [rawDate, rawClassification] of Object.entries(map)) {
            const date = dateKeyUtc(rawDate);
            const classification = String(rawClassification || '').trim().toUpperCase();
            if (!date || !dates.includes(date) || !['NORMAL', 'SIXTH', 'SEVENTH'].includes(classification)) {
                return decisionFailure('CANONICAL_DECISION_CLASSIFICATION_INVALID', {
                    dailyFacts, canonicalRepoDayIdentities
                });
            }
            finalClassifications[date] = classification;
        }
        const sixthDates = dates.filter((date) => finalClassifications[date] === 'SIXTH');
        const seventhDates = dates.filter((date) => finalClassifications[date] === 'SEVENTH');
        const humanSixth = sixthDates[0];
        const humanSixthDay = actualDays.find((day) => day.hmeromhnia === humanSixth);
        const humanSeventh = seventhDates[0] || null;
        const requiresSeventh = actualDays.length >= 7;
        if (sixthDates.length !== 1 || !humanSixthDay || !isSixthDayEligible(humanSixthDay) ||
            seventhDates.length !== (requiresSeventh ? 1 : 0) ||
            (requiresSeventh && (humanSeventh === humanSixth ||
                !workedRepoDays.some((day) => day.hmeromhnia === humanSeventh)))) {
            return decisionFailure('CANONICAL_DECISION_CLASSIFICATION_INVALID', {
                dailyFacts, canonicalRepoDayIdentities
            });
        }
        selected = { day: humanSixthDay, warnings: [] };
        sixthDayIdentity = humanSixth;
        sixthDayRepoIdentity = canonicalRepoDayIdentities.includes(humanSixth)
            ? humanSixth : null;
        seventhDay = humanSeventh
            ? actualDays.find((day) => day.hmeromhnia === humanSeventh) : null;
        remainingRepoIdentity = sixthDayRepoIdentity
            ? canonicalRepoDayIdentities.find((identity) => identity !== humanSixth) || null
            : seventhDay?.hmeromhnia || null;
    }
    const sixthDayHours = Math.min(selected.day.actualWorkHours, 8);
    const illegalOvertimeHours = Math.max(selected.day.actualWorkHours - 8, 0);
    const classification = illegalOvertimeHours > 0
        ? 'SIXTH_DAY_WITH_ILLEGAL_OVERTIME'
        : 'SIXTH_DAY';
    const sixthDayWithoutAmounts = {
        ...selected.day,
        sixthDayHours,
        illegalOvertimeHours,
        premiumRate: null,
        baseAmount: null,
        premiumAmount: null,
        value: null,
        classification
    };
    const classificationWarnings = [...new Set([
        ...dailyFacts.flatMap((day) => day.warnings),
        ...(selected.warnings || []),
        ...(seventhDay ? ['SEVENTH_CONSECUTIVE_ACTUAL_WORK_DAY_CONTRACT_VIOLATION'] : [])
    ])];
    const premiumRate = validRate(effectiveProfile.pososto_prosayxhshs_6hs_hmeras);
    if (premiumRate === null) {
        return Object.freeze({
            policyVersion: POLICY_VERSION,
            status: STATUS.NEEDS_HR_DECISION,
            reasons: ['MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE'],
            warnings: classificationWarnings,
            dailyFacts,
            canonicalRepoDayIdentities,
            sixthDayIdentity,
            sixthDayRepoIdentity,
            remainingRepoIdentity,
            sixthDay: sixthDayWithoutAmounts,
            seventhDay
        });
    }
    const sixthDayWithRate = {
        ...sixthDayWithoutAmounts,
        premiumRate
    };
    const specialCategory = String(
        effectiveProfile.eidikh_kathgoria_ergazomenoy ||
        effectiveProfile.eidikh_periptosh ||
        ''
    ).trim().padStart(4, '0');
    if (
        premiumRate === 0 &&
        !ZERO_RATE_EXEMPT_SPECIAL_CATEGORIES.has(specialCategory)
    ) {
        return Object.freeze({
            policyVersion: POLICY_VERSION,
            status: STATUS.NEEDS_HR_DECISION,
            reasons: ['ZERO_SIXTH_DAY_PREMIUM_RATE_WITHOUT_EXEMPTION'],
            warnings: classificationWarnings,
            dailyFacts,
            canonicalRepoDayIdentities,
            sixthDayIdentity,
            sixthDayRepoIdentity,
            remainingRepoIdentity,
            sixthDay: sixthDayWithRate,
            seventhDay
        });
    }
    const rate = Number(String(hourlyRate).replace(',', '.'));
    const baseAmount = Number.isFinite(rate) && rate >= 0
        ? Number((sixthDayHours * rate).toFixed(2))
        : null;
    const premiumAmount = baseAmount === null
        ? null
        : Number((baseAmount * premiumRate / 100).toFixed(2));
    const sixthDayValue = baseAmount === null
        ? null
        : Number((baseAmount + premiumAmount).toFixed(2));
    const seventhDayIllegalOvertimeHours = seventhDay
        ? resolveSeventhDayIllegalOvertimeHours(seventhDay)
        : 0;
    return Object.freeze({
        policyVersion: POLICY_VERSION,
        status: STATUS.READY,
        reasons: [],
        warnings: classificationWarnings,
        week: { start: range.weekStartKey, end: range.weekEndKey },
        premiumRate,
        premiumRateSource: effectiveProfile.source || null,
        dailyFacts,
        canonicalRepoDayIdentities,
        sixthDayIdentity,
        sixthDayRepoIdentity,
        remainingRepoIdentity,
        sixthDay: {
            ...selected.day,
            sixthDayHours,
            illegalOvertimeHours,
            premiumRate,
            baseAmount,
            premiumAmount,
            value: sixthDayValue,
            classification
        },
        seventhDay: seventhDay
            ? {
                  ...seventhDay,
                  severity: 'SERIOUS_VIOLATION',
                  classification: 'SEVENTH_DAY_ILLEGAL_OVERTIME',
                  illegalOvertimeHours: seventhDayIllegalOvertimeHours
              }
            : null
    });
}

module.exports = {
    POLICY_VERSION,
    STATUS,
    ZERO_RATE_EXEMPT_SPECIAL_CATEGORIES,
    validRate,
    resolveSeventhDayIllegalOvertimeHours,
    resolveCanonicalRepoDayIdentities,
    resolveCurrentRepoCandidateIdentities,
    resolveSafeHumanRepoCandidateIdentities,
    selectSixthDay,
    analyzeWeeklySixthSeventhDay
};
