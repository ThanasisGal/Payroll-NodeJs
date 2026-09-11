'use strict';
function canSubmitFinalWtoDaily({ state, frozenSnapshot, lifecycleIndexesReady,
    submissionIndexesReady, finalProjection, deferredBoundaryReadiness } = {}) {
    return state?.stored_status === 'FINALIZED' && !state?.past_deadline && Boolean(frozenSnapshot) &&
        lifecycleIndexesReady === true && submissionIndexesReady === true && Boolean(finalProjection) &&
        !state?.submission_reference && deferredBoundaryReadiness?.status === 'READY';
}
module.exports = { canSubmitFinalWtoDaily };
