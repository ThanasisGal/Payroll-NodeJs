const {
    resolveDailyRepoCalculationState
} = require('./apasxoliseisDailyRepoCalculationStateService');

function isZeroHours(value) {
    const numericValue = Number(value || 0);
    return !Number.isFinite(numericValue) || Math.abs(numericValue) < 0.000001;
}

function resolveCanonicalRepoDayCountState({
    row,
    dailyProfile,
    hasUnresolvedCardPair = false
} = {}) {
    const repoState = resolveDailyRepoCalculationState({ row, dailyProfile });
    const effectiveHours =
        repoState.provenance === 'APOLOGISTIKA_CURRENT'
            ? row?.ores_ergasias_apologistika
            : row?.ores_ergasias;
    const hasZeroEffectiveHours = isZeroHours(effectiveHours);
    const hasZeroCardHours = isZeroHours(row?.cards_ores_ergasias);

    return Object.freeze({
        effectiveCategory: repoState.effectiveCategory,
        effectiveRepo: repoState.effectiveRepo,
        provenance: repoState.provenance,
        effectiveHours,
        countsAsRepo:
            repoState.effectiveRepo === true &&
            hasUnresolvedCardPair !== true &&
            hasZeroEffectiveHours &&
            hasZeroCardHours,
        diagnostics: Object.freeze([...repoState.diagnostics])
    });
}

function resolveWeeklyActualRepoCount(days = []) {
    const dayStates = (Array.isArray(days) ? days : []).map((day) =>
        resolveCanonicalRepoDayCountState(day)
    );

    return Object.freeze({
        actualRepo: dayStates.filter((day) => day.countsAsRepo).length,
        diagnostics: Object.freeze([
            ...new Set(dayStates.flatMap((day) => day.diagnostics))
        ]),
        dayStates: Object.freeze(dayStates)
    });
}

module.exports = {
    resolveCanonicalRepoDayCountState,
    resolveWeeklyActualRepoCount
};
