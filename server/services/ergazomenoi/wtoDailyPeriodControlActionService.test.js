'use strict';
const assert = require('assert'); const { canSubmitFinalWtoDaily } = require('./wtoDailyPeriodControlActionService');
const base = { state: { stored_status: 'FINALIZED', past_deadline: false, submission_reference: null },
    frozenSnapshot: {}, lifecycleIndexesReady: true, submissionIndexesReady: true, finalProjection: {},
    deferredBoundaryReadiness: { status: 'READY' } };
assert.equal(canSubmitFinalWtoDaily(base), true);
assert.equal(canSubmitFinalWtoDaily({ ...base, deferredBoundaryReadiness: {
    status: 'WTODAILY_DEFERRED_BOUNDARY_RESOLUTION_REQUIRED' } }), false);
assert.equal(canSubmitFinalWtoDaily({ ...base, deferredBoundaryReadiness: { status: 'READY',
    boundary_statuses: [{ status: 'NOT_REQUIRED' }] } }), true);
assert.equal(canSubmitFinalWtoDaily({ ...base, deferredBoundaryReadiness: { status: 'READY',
    boundary_statuses: [{ status: 'RESOLVED' }] } }), true);
console.log('WTODaily period-control action tests passed');
