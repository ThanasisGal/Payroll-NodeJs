'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('async function loadResults(');
const end = source.indexOf('function pairNo(', start);
assert.notEqual(start, -1, 'loadResults start boundary must exist');
assert.notEqual(end, -1, 'loadResults end boundary must exist');
assert.ok(end > start, 'loadResults end boundary must follow its start boundary');
const loadResultsSource = source.slice(start, end);

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

const period = deferred();
const review = deferred();
const events = [];
const elements = {
    ypokatasthma_stathera_advanced: { value: '0000' },
    apo_hmeromhnia: { value: '2026-04-01' },
    eos_hmeromhnia: { value: '2026-04-30' },
    kodikos: { value: '' },
    advancedBranchValidation: { classList: { toggle() {} } },
    policyPreviewGroupsContainer: { replaceChildren() {} }
};
const sandbox = {
    URLSearchParams,
    Map,
    console,
    document: { getElementById: (id) => elements[id] || null },
    window: {
        AppLoader: {
            begin() { events.push('loader-begin'); },
            end() { events.push('loader-end'); }
        },
        EmploymentReviewOrphanQualityCheck: { async run() {} }
    },
    csrfToken: 'test-token',
    loadEmploymentPeriodControl(branch, options) {
        events.push(`period-start:${branch}:${options?.render}`);
        return period.promise;
    },
    fetch(url) {
        events.push(`review-start:${url}`);
        return review.promise;
    },
    renderEmploymentPeriodControl(value) {
        events.push(value ? 'period-render-final' : 'period-render-safe-empty');
    },
    hasAuthoritativeEmploymentCalculation() { return true; },
    renderPolicyPreviewGroups() {},
    ensureReviewTableStructure() {},
    beginBoundaryInfoSearchResult() {},
    renderCurrentReviewRows() {},
    prepareWeeklyHrStage1LazyLoad() {},
    async autoOpenBoundaryInfoForSearchResult() {},
    updateEmploymentReviewWorkflowPresentation() { events.push('workflow-presentation'); },
    renderWeeklyHrStage2LifecycleFallback() {},
    employmentReviewSwal() {},
    currentWeeklyHrStage2BulkLastResultDetails: [],
    currentReviewLifecycleProjectionReady: false,
    currentEmploymentReviewBoundaryContextPreflight: null,
    currentAtomicRepoTransferProjection: null,
    currentPolicyPreviewRowsById: new Map(),
    currentPreCalculationDataIssueGroups: [],
    currentPolicyPreviewBaseParams: null,
    currentRepoTransferDecisionsByProposalId: new Map(),
    currentPolicyPreviewApprovalRecords: [],
    currentPolicyPreviewApprovalTotal: 0,
    currentPolicyPreviewApprovalsByGroupId: new Map(),
    currentPolicyPreviewApprovalsError: '',
    currentPolicyPreviewApplyDryRun: null,
    currentPolicyPreviewApplyDryRunError: '',
    currentApprovalHistoryFilters: {},
    currentCanonicalLifecyclePayloads: [],
    currentWeeklyHrStage2BulkPreview: null,
    currentReviewRows: [],
    currentReviewDeviations: [],
    currentPendingDeviationWeeks: [],
    currentLegacyDeviations: [],
    currentEmploymentReviewLifecyclePresentation: null
};
vm.createContext(sandbox);
vm.runInContext(`${loadResultsSource}; this.loadResults = loadResults;`, sandbox);

(async () => {
    const loading = sandbox.loadResults();
    assert.deepEqual(events.slice(0, 4), [
        'loader-begin',
        'period-render-safe-empty',
        'period-start:0000:false',
        'review-start:/api/prodhlomena-oraria/review?apo_hmeromhnia=2026-04-01&eos_hmeromhnia=2026-04-30&ypokatasthma=0000&kodikos=&page=1&limit=5000'
    ], 'τα δύο read requests ξεκινούν πριν επιλυθεί οποιοδήποτε από αυτά');

    review.resolve({
        async json() {
            events.push('review-json-ready');
            return {
                success: true,
                finalized: true,
                rows: [],
                canonicalLifecycleProjections: [],
                stage2BulkPreview: null
            };
        }
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.ok(!events.includes('period-render-final'));
    assert.ok(!events.includes('workflow-presentation'));
    assert.ok(!events.includes('loader-end'));

    period.resolve({
        effective_mode: 'FINALIZED',
        calculation: { authoritative_result: true },
        allowed_actions: {}
    });
    assert.equal(await loading, true);
    assert.ok(events.indexOf('period-render-final') > events.indexOf('review-json-ready'));
    assert.ok(events.indexOf('workflow-presentation') > events.indexOf('period-render-final'));
    assert.ok(events.indexOf('loader-end') > events.indexOf('workflow-presentation'));
    assert.equal(events.filter((event) => event.startsWith('period-start:')).length, 1);
    assert.equal(events.filter((event) => event.startsWith('review-start:')).length, 1);
    assert.match(loadResultsSource, /Promise\.all\(\[\s*periodControlPromise,\s*reviewResponsePromise\s*\]\)/);
    assert.doesNotMatch(loadResultsSource, /await loadEmploymentPeriodControl\(advancedBranch\)/);
    console.log('employment review initial read parallelization: PASS');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
