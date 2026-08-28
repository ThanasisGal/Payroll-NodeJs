'use strict';

async function buildWeeklyLifecycleWithStage2State({
    projectionInput = {},
    buildProjection,
    loadStage2State
} = {}) {
    if (typeof buildProjection !== 'function' || typeof loadStage2State !== 'function') {
        throw new TypeError('Stage 2 lifecycle dependencies are required.');
    }
    const preliminary = buildProjection(projectionInput);
    const stage2 = preliminary?.stages?.stage2 || {};
    const actionable = stage2.stage2_applicability === 'ACTIONABLE' &&
        (stage2.has_transferable_pair === true || stage2.has_bounded_selection === true);
    if (!actionable) return preliminary;
    let persistedStage2DecisionState;
    try {
        persistedStage2DecisionState = await loadStage2State();
    } catch (_error) {
        return buildProjection({ ...projectionInput,
            stage2StateDiagnostic: 'STAGE2_DECISION_STATE_UNAVAILABLE' });
    }
    if (!persistedStage2DecisionState) {
        return buildProjection({ ...projectionInput,
            stage2StateDiagnostic: 'STAGE2_DECISION_STATE_UNAVAILABLE' });
    }
    return buildProjection({ ...projectionInput, persistedStage2DecisionState });
}

module.exports = { buildWeeklyLifecycleWithStage2State };
