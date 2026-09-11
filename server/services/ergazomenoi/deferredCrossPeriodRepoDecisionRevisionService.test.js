'use strict';
const assert = require('assert');
const { resolveEffectiveDeferredCrossPeriodDecision } = require('./deferredCrossPeriodRepoDecisionRevisionService');

const base = { resolution_kind: 'DEFERRED_CROSS_PERIOD_REPO_RESOLUTION',
    resolution_status: 'RESOLVED', deferred_week_id: 'week' };
const first = { ...base, _id: 'd1', resolution_revision: 1, resolution_fingerprint: 'f1' };
const second = { ...base, _id: 'd2', resolution_revision: 2, resolution_fingerprint: 'f2',
    supersedes_decision_id: 'd1', supersedes_resolution_fingerprint: 'f1' };
assert.strictEqual(resolveEffectiveDeferredCrossPeriodDecision([second, first], 'week'), second);
assert.equal(first.resolution_revision, 1);
assert.throws(() => resolveEffectiveDeferredCrossPeriodDecision([first, { ...second, _id: 'fork' }, second], 'week'),
    (error) => error.code === 'DEFERRED_CROSS_PERIOD_RESOLUTION_CHAIN_CONFLICT');
assert.throws(() => resolveEffectiveDeferredCrossPeriodDecision([first, { ...second,
    supersedes_resolution_fingerprint: 'stale' }], 'week'),
    (error) => error.code === 'DEFERRED_CROSS_PERIOD_RESOLUTION_CHAIN_CONFLICT');
console.log('deferred cross-period decision revision tests passed');
