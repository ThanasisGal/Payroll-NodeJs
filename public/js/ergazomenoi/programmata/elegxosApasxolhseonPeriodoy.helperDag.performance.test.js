'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');

function deferred() {
    let resolve;
    const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
    return { promise, resolve };
}

async function flush() {
    await new Promise((resolve) => setImmediate(resolve));
}

async function testScenarioPageDag() {
    const start = source.indexOf('function buildScenarioReviewParams(');
    const end = source.indexOf('function buildScenarioClassificationsMap(', start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    assert.ok(end > start);
    const requests = [];
    const pages = new Map([[1, deferred()], [2, deferred()], [3, deferred()]]);
    const sandbox = {
        URLSearchParams,
        csrfToken: 'test-token',
        fetch(url) {
            const page = Number(new URL(url, 'http://local').searchParams.get('page'));
            requests.push(page);
            return pages.get(page).promise;
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(`${source.slice(start, end)}; this.fetchScenarios = fetchScenarioClassifications;`, sandbox);
    const loading = sandbox.fetchScenarios(new URLSearchParams({
        apo_hmeromhnia: '2026-05-01', eos_hmeromhnia: '2026-05-31',
        ypokatasthma: '0000', kodikos: ''
    }));
    assert.deepEqual(requests, [1]);
    pages.get(1).resolve({
        async json() { return { success: true, page: 1, totalPages: 3, rows: [{ page: 1 }] }; }
    });
    await flush();
    assert.deepEqual(requests, [1, 2, 3],
        'οι υπόλοιπες γνωστές σελίδες ξεκινούν μαζί μετά την πρώτη');
    pages.get(3).resolve({ async json() { return { success: true, rows: [{ page: 3 }] }; } });
    await flush();
    let completed = false;
    loading.then(() => { completed = true; });
    await flush();
    assert.equal(completed, false);
    pages.get(2).resolve({ async json() { return { success: true, rows: [{ page: 2 }] }; } });
    const rows = await loading;
    assert.deepEqual(Array.from(rows, (row) => row.page), [1, 2, 3]);
    assert.equal(requests.length, 3, 'η παραλληλοποίηση δεν αυξάνει τις scenario κλήσεις');
}

async function testHelperDagAndFinalBarrier() {
    const start = source.indexOf('async function loadResults(');
    const end = source.indexOf('function pairNo(', start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    assert.ok(end > start);
    const events = [];
    const period = deferred();
    const review = deferred();
    const helpers = Object.fromEntries(
        ['scenario', 'grouping', 'approvals', 'dry-run', 'repo', 'orphan']
            .map((name) => [name, deferred()])
    );
    const elements = {
        ypokatasthma_stathera_advanced: { value: '0000' },
        apo_hmeromhnia: { value: '2026-05-01' },
        eos_hmeromhnia: { value: '2026-05-31' },
        kodikos: { value: '' },
        advancedBranchValidation: { classList: { toggle() {} } },
        policyPreviewGroupsContainer: { replaceChildren() {} }
    };
    const begin = (name, value) => {
        events.push(`${name}-start`);
        return value.promise;
    };
    const sandbox = {
        URLSearchParams, Map, console,
        document: { getElementById: (id) => elements[id] || null },
        window: {
            AppLoader: { begin() { events.push('loader-begin'); }, end() { events.push('loader-end'); } },
            EmploymentReviewOrphanQualityCheck: {
                run() { return begin('orphan', helpers.orphan); }
            }
        },
        csrfToken: 'test-token',
        loadEmploymentPeriodControl() { return begin('period', period); },
        fetch() { return begin('review', review); },
        fetchScenarioClassifications() { return begin('scenario', helpers.scenario); },
        fetchPolicyPreviewGrouping() { return begin('grouping', helpers.grouping); },
        refreshPolicyPreviewApprovals() { return begin('approvals', helpers.approvals); },
        fetchPolicyPreviewApplyDryRun() { return begin('dry-run', helpers['dry-run']); },
        refreshRepoTransferDecisions() { return begin('repo', helpers.repo); },
        renderEmploymentPeriodControl() {},
        hasAuthoritativeEmploymentCalculation() { return true; },
        renderPolicyPreviewGroups() {}, ensureReviewTableStructure() {},
        beginBoundaryInfoSearchResult() {}, buildScenarioClassificationsMap() { return new Map(); },
        attachScenarioClassifications() {}, renderCurrentReviewRows() {},
        prepareWeeklyHrStage1LazyLoad() {}, async autoOpenBoundaryInfoForSearchResult() {},
        attachPolicyPreviewResults() {},
        updateEmploymentReviewWorkflowPresentation() { events.push('final-presentation'); },
        renderWeeklyHrStage2LifecycleFallback() {}, employmentReviewSwal() {},
        currentWeeklyHrStage2BulkLastResultDetails: [], currentReviewLifecycleProjectionReady: false,
        currentEmploymentReviewBoundaryContextPreflight: null,
        currentAtomicRepoTransferProjection: null, currentPolicyPreviewRowsById: new Map(),
        currentPreCalculationDataIssueGroups: [], currentPolicyPreviewBaseParams: null,
        currentRepoTransferDecisionsByProposalId: new Map(), currentPolicyPreviewApprovalRecords: [],
        currentPolicyPreviewApprovalTotal: 0, currentPolicyPreviewApprovalsByGroupId: new Map(),
        currentPolicyPreviewApprovalsError: '', currentPolicyPreviewApplyDryRun: null,
        currentPolicyPreviewApplyDryRunError: '', currentApprovalHistoryFilters: {},
        currentCanonicalLifecyclePayloads: [], currentWeeklyHrStage2BulkPreview: null,
        currentReviewRows: [], currentReviewDeviations: [], currentPendingDeviationWeeks: [],
        currentLegacyDeviations: [], currentEmploymentReviewLifecyclePresentation: null
    };
    vm.createContext(sandbox);
    vm.runInContext(`${source.slice(start, end)}; this.loadResults = loadResults;`, sandbox);
    const loading = sandbox.loadResults();
    assert.ok(events.includes('period-start') && events.includes('review-start'));
    period.resolve({ calculation: { authoritative_result: true }, allowed_actions: {} });
    review.resolve({ async json() { return { success: true, finalized: false, rows: [],
        canonicalLifecycleProjections: [], stage2BulkPreview: null }; } });
    await flush();
    for (const name of ['scenario', 'grouping', 'approvals', 'dry-run', 'repo']) {
        assert.ok(events.includes(`${name}-start`), `${name} πρέπει να ξεκινήσει στο ίδιο DAG level`);
    }
    assert.ok(!events.includes('orphan-start'));
    assert.ok(!events.includes('final-presentation'));

    helpers.grouping.resolve({ previewRows: [], grouping: null, atomicGroupProjection: null });
    helpers.approvals.resolve({});
    helpers['dry-run'].resolve({});
    helpers.repo.resolve();
    await flush();
    assert.ok(!events.includes('final-presentation'), 'η παρουσίαση περιμένει και το scenario result');
    helpers.scenario.resolve([]);
    await flush();
    assert.ok(events.includes('orphan-start'));
    assert.ok(!events.includes('final-presentation'), 'το υπάρχον required orphan barrier διατηρείται');
    helpers.orphan.resolve(null);
    assert.equal(await loading, true);
    assert.ok(events.indexOf('final-presentation') > events.indexOf('orphan-start'));
    assert.ok(events.indexOf('loader-end') > events.indexOf('final-presentation'));
    for (const name of ['period', 'review', 'scenario', 'grouping', 'approvals', 'dry-run', 'repo', 'orphan']) {
        assert.equal(events.filter((event) => event === `${name}-start`).length, 1, `${name} request count`);
    }
}

Promise.resolve()
    .then(testScenarioPageDag)
    .then(testHelperDagAndFinalBarrier)
    .then(() => console.log('employment review helper DAG performance contracts: PASS'))
    .catch((error) => { console.error(error); process.exitCode = 1; });
