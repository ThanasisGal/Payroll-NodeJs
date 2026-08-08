const {
    normalizeEmploymentType,
    resolveFullTimeFromWorkTerms
} = require('./apasxoliseisReviewEmploymentProfileService');
const {
    MODE: EFFECTIVE_REPO_MODE,
    resolveEffectiveRepoState
} = require('./apasxoliseisEffectiveRepoStateService');

const DIAGNOSTIC = Object.freeze({
    DAILY_EMPLOYMENT_PROFILE_UNRESOLVED: 'DAILY_EMPLOYMENT_PROFILE_UNRESOLVED'
});

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function result({
    expectedRepoCategory,
    effectiveCategory,
    effectiveRepo,
    provenance,
    diagnostics = []
}) {
    return Object.freeze({
        expectedRepoCategory,
        effectiveCategory,
        effectiveRepo,
        provenance,
        diagnostics: Object.freeze([...diagnostics])
    });
}

function unresolvedProfileResult() {
    return result({
        expectedRepoCategory: null,
        effectiveCategory: null,
        effectiveRepo: null,
        provenance: null,
        diagnostics: [DIAGNOSTIC.DAILY_EMPLOYMENT_PROFILE_UNRESOLVED]
    });
}

function hasConflictingExplicitEmploymentTypes(dailyProfile) {
    const contractType = normalizeEmploymentType(dailyProfile.kathestos_apasxolhshs);
    const employmentType = normalizeEmploymentType(dailyProfile.typos_apasxolhshs);
    return Boolean(contractType && employmentType && contractType !== employmentType);
}

function resolveDailyRepoCalculationState({ row, dailyProfile } = {}) {
    if (!isPlainObject(dailyProfile)) return unresolvedProfileResult();
    if (hasConflictingExplicitEmploymentTypes(dailyProfile)) {
        return unresolvedProfileResult();
    }

    const isFullTime = resolveFullTimeFromWorkTerms(dailyProfile);
    if (isFullTime === null) return unresolvedProfileResult();

    const expectedRepoCategory = isFullTime ? 'ΑΝ' : 'ΜΕ';
    const effectiveState = resolveEffectiveRepoState({
        row,
        mode: EFFECTIVE_REPO_MODE.CURRENT,
        expectedRepoCategory
    });

    return result({
        expectedRepoCategory,
        effectiveCategory: effectiveState.effectiveCategory,
        effectiveRepo: effectiveState.effectiveRepo,
        provenance: effectiveState.provenance,
        diagnostics: effectiveState.diagnostics
    });
}

module.exports = {
    DIAGNOSTIC,
    resolveDailyRepoCalculationState
};
