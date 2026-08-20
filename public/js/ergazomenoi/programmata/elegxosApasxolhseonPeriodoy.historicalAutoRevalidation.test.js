'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const helperStart = source.indexOf('function isWeeklyHrStage1Eligible');
const helperEnd = source.indexOf('function weeklyHrStage1BusinessStatus', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
assert.match(source.match(/async function runHistoricalReconstruction[\s\S]*?\n}/)?.[0] || '',
    /await refreshAndAutoRevalidateStage1AfterHistoricalReassessment\(\)/);

function stalePayload(index, overrides = {}) {
    const stage = (business_status, pending_count = 0) => ({ business_status,
        pending_count, pending_dates: [], pending_reasons: [], blockers: [] });
    return { scope: { ypokatasthma: '0000', employee_id: `employee-${index}`,
        employee_kodikos: String(index).padStart(4, '0'), week_start: '2026-06-01',
        week_end: '2026-06-07' }, stage1_status: 'STALE', write_enabled: true,
    rows: [], workflow: { next_required_hr_stage: 'LEAVE_CLASSIFICATION' },
    lifecycle_projection: { requires_hr_action: true,
        stage1_no_classification_preview_items: [], stages: {
            stage1: stage('STALE'), stage2: stage('COMPLETED'),
            stage3: stage('COMPLETED'), stage4: stage('COMPLETED')
        } }, ...overrides };
}

function createSandbox({ payloads, dataQualityReady = true, completedAfterRefresh = true }) {
    let loadCount = 0;
    const fetchCalls = [];
    const weeklyHrStage1Payloads = new Map();
    const sandbox = { weeklyHrStage1DayDrafts: new Map(), weeklyHrStage1Payloads,
        currentEmploymentPeriodControl: null,
        crypto: { randomUUID: () => 'request-id' }, csrfToken: 'csrf',
        weeklyHrOrphanRows: (payload) => payload.unresolved_orphan ? [{}] : [],
        loadResults: async () => {
            loadCount += 1;
            sandbox.currentEmploymentPeriodControl = {
                period_data_quality_readiness: { ready: dataQualityReady }
            };
            weeklyHrStage1Payloads.clear();
            const current = loadCount > 1 && completedAfterRefresh ? [] : payloads;
            current.forEach((payload, index) => weeklyHrStage1Payloads.set(String(index), payload));
        },
        fetch: async (url, options) => {
            fetchCalls.push({ url, options, body: JSON.parse(options.body) });
            return { ok: true, json: async () => ({ success: true,
                requested_count: options ? JSON.parse(options.body).scopes.length : 0,
                completed_count: options ? JSON.parse(options.body).scopes.length : 0,
                already_completed_count: 0 }) };
        }
    };
    vm.runInNewContext(`${source.slice(helperStart, helperEnd)}\n` +
        'this.runFlow = refreshAndAutoRevalidateStage1AfterHistoricalReassessment;' +
        'this.isSafe = isSafeStage1StaleAutoRevalidation;', sandbox);
    return { sandbox, fetchCalls, getLoadCount: () => loadCount };
}

(async () => {
    const safe = Array.from({ length: 30 }, (_, index) => stalePayload(index + 1));
    const successful = createSandbox({ payloads: safe });
    const result = await successful.sandbox.runFlow();
    assert.equal(result.attempted, true);
    assert.equal(result.completed_count, 30);
    assert.equal(successful.fetchCalls.length, 1);
    assert.equal(successful.fetchCalls[0].body.scopes.length, 30);
    assert.equal(successful.getLoadCount(), 2);

    const actionable = stalePayload(15);
    actionable.lifecycle_projection.stages.stage3 = { business_status: 'OPEN',
        pending_count: 1, pending_dates: ['2026-06-06'], pending_reasons:
            ['REMAINING_POSSIBLE_LEAVE_REVIEW_REQUIRED'], blockers: [] };
    const blockedByHr = createSandbox({ payloads: [actionable] });
    assert.equal((await blockedByHr.sandbox.runFlow()).attempted, false);
    assert.equal(blockedByHr.fetchCalls.length, 0);
    assert.equal(blockedByHr.getLoadCount(), 1);

    const blockedByQuality = createSandbox({ payloads: safe, dataQualityReady: false });
    assert.equal((await blockedByQuality.sandbox.runFlow()).attempted, false);
    assert.equal(blockedByQuality.fetchCalls.length, 0);
    assert.equal(blockedByQuality.getLoadCount(), 1);

    const unsafePreview = stalePayload(20);
    unsafePreview.lifecycle_projection.stage1_no_classification_preview_items = [
        { date: '2026-06-04', safe: false, requires_further_review: true }
    ];
    assert.equal(successful.sandbox.isSafe(unsafePreview, { ready: true }), false);
    const orphan = stalePayload(21, { unresolved_orphan: true });
    assert.equal(successful.sandbox.isSafe(orphan, { ready: true }), false);

    const staleCanonical = stalePayload(22);
    staleCanonical.lifecycle_projection.stages.stage1.pending_reasons =
        ['CANONICAL_DECISION_STALE'];
    assert.equal(successful.sandbox.isSafe(staleCanonical, { ready: true }), false);

    const unresolvedWeekly = stalePayload(23, { rows: [{
        compensation_breakdown_apologistika: { status: 'NEEDS_HR_DECISION' }
    }] });
    assert.equal(successful.sandbox.isSafe(unresolvedWeekly, { ready: true }), false);

    console.log('historical reassessment automatic Stage 1 revalidation tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
