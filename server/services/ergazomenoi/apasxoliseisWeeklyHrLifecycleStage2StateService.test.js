'use strict';

const assert = require('node:assert/strict');
const { buildWeeklyLifecycleWithStage2State } = require(
    './apasxoliseisWeeklyHrLifecycleStage2StateService'
);

function projection(input = {}) {
    return { input, stages: { stage2: {
        stage2_applicability: input.actionable ? 'ACTIONABLE' : 'NOT_APPLICABLE',
        has_transferable_pair: input.actionable === true,
        has_bounded_selection: false,
        business_status: input.persistedStage2DecisionState ? 'COMPLETED' : 'OPEN',
        pending_reasons: input.stage2StateDiagnostic ? [input.stage2StateDiagnostic] : []
    } } };
}

(async () => {
    let loads = 0;
    for (let index = 0; index < 71; index++) {
        const result = await buildWeeklyLifecycleWithStage2State({
            projectionInput: { actionable: false }, buildProjection: projection,
            loadStage2State: async () => { loads++; return {}; }
        });
        assert.equal(result.stages.stage2.stage2_applicability, 'NOT_APPLICABLE');
    }
    assert.equal(loads, 0);

    const loaded = await buildWeeklyLifecycleWithStage2State({
        projectionInput: { actionable: true }, buildProjection: projection,
        loadStage2State: async () => { loads++; return { current: true }; }
    });
    assert.equal(loads, 1);
    assert.equal(loaded.stages.stage2.business_status, 'COMPLETED');

    const failed = await buildWeeklyLifecycleWithStage2State({
        projectionInput: { actionable: true }, buildProjection: projection,
        loadStage2State: async () => { throw new Error('read failed'); }
    });
    assert.equal(failed.stages.stage2.business_status, 'OPEN');
    assert.deepEqual(failed.stages.stage2.pending_reasons,
        ['STAGE2_DECISION_STATE_UNAVAILABLE']);
    const missing = await buildWeeklyLifecycleWithStage2State({
        projectionInput: { actionable: true }, buildProjection: projection,
        loadStage2State: async () => null
    });
    assert.equal(missing.stages.stage2.business_status, 'OPEN');
    assert.deepEqual(missing.stages.stage2.pending_reasons,
        ['STAGE2_DECISION_STATE_UNAVAILABLE']);
    console.log('weekly HR Stage 2 conditional state loading tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
