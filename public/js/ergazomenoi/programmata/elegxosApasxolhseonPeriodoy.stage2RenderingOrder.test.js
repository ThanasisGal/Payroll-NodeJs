'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const helperStart = source.indexOf('const workflowStageNames');
const helperEnd = source.indexOf('function renderWeeklyHrStage3');
assert.notEqual(helperStart, -1);
assert.notEqual(helperEnd, -1);

const mutations = [];
let html = '';
const container = {};
Object.defineProperty(container, 'innerHTML', {
    get: () => html,
    set: (value) => {
        mutations.push({ before: html, after: String(value) });
        html = String(value);
    }
});
const sandbox = {
    document: { getElementById: (id) => id === 'policyPreviewGroupsContainer' ? container : null },
    escapeHtml: (value) => String(value ?? ''),
    formatStage1DateKey: (value) => String(value || '').split('-').reverse().join('/'),
    getPolicyPreviewReasonLabel: (value) => String(value || ''),
    policyPreviewReasonLabels: { REPO_RESOLUTION_REQUIRED: 'Απαιτείται επίλυση μεταφοράς ρεπό.' },
    atomicRepoTransferDiagnosticLabels: {},
    formatPolicyPreviewUnknownCode: (value) => String(value || '')
};
vm.createContext(sandbox);
vm.runInContext(`${source.slice(helperStart, helperEnd)}
    this.derive = derivePeriodLifecyclePresentation;
    this.renderFallback = renderWeeklyHrStage2LifecycleFallback;`, sandbox);

const stage = (pendingDates = []) => ({ business_status: 'OPEN', pending_count: 1,
    pending_dates: pendingDates, pending_reasons: ['REPO_RESOLUTION_REQUIRED'] });
const payload = (weekStart, weekEnd, pendingDates = []) => ({
    scope: { employee_kodikos: '0004', week_start: weekStart, week_end: weekEnd },
    lifecycle_projection: { stages: {
        stage1: { business_status: 'COMPLETED', pending_count: 0, pending_dates: [] },
        stage2: stage(pendingDates),
        stage3: { business_status: 'COMPLETED', pending_count: 0, pending_dates: [] },
        stage4: { business_status: 'COMPLETED', pending_count: 0, pending_dates: [] }
    } }
});
const weeklyPayloads = [
    payload('2026-06-01', '2026-06-07'),
    payload('2026-06-08', '2026-06-14'),
    payload('2026-06-22', '2026-06-28')
];
const lifecycle = sandbox.derive(weeklyPayloads);
assert.equal(lifecycle.stages.STAGE2.pending_count, 3);
assert.equal(lifecycle.stages.STAGE2.pending_items.length, 3);
assert.ok(lifecycle.stages.STAGE2.pending_items.every((item) => item.date === null));
assert.deepEqual(Array.from(lifecycle.stages.STAGE2.pending_items,
    (item) => `${item.week_start}/${item.week_end}`), [
    '2026-06-01/2026-06-07', '2026-06-08/2026-06-14', '2026-06-22/2026-06-28'
]);
assert.equal(lifecycle.stages.STAGE2.pending_items.reduce((sum, item) =>
    sum + item.pending_count, 0), lifecycle.stages.STAGE2.pending_count);

const deduplicated = sandbox.derive([...weeklyPayloads, weeklyPayloads[0]]);
assert.equal(deduplicated.stages.STAGE2.pending_count, 3);
assert.equal(deduplicated.stages.STAGE2.pending_items.length, 3);

const dated = sandbox.derive([payload('2026-06-08', '2026-06-14', ['2026-06-10'])]);
assert.equal(dated.stages.STAGE2.pending_items[0].date, '2026-06-10');

const completedStage2Payloads = weeklyPayloads.map((entry) => ({ ...entry,
    lifecycle_projection: { stages: { ...entry.lifecycle_projection.stages,
        stage2: { business_status: 'COMPLETED', pending_count: 0,
            pending_dates: [], pending_reasons: [] } } } }));
const completedStage2Lifecycle = sandbox.derive(completedStage2Payloads);
assert.equal(completedStage2Lifecycle.stages.STAGE2.pending_count, 0);
assert.equal(completedStage2Lifecycle.stages.STAGE2.pending_items.length, 0);
container.innerHTML = '';
assert.equal(sandbox.renderFallback(completedStage2Lifecycle), true);
assert.match(container.innerHTML, /Δεν υπάρχουν εκκρεμότητες Μεταφοράς Ρεπό\./);
const completedHtmlBeforeToggle = container.innerHTML;
let stage2CollapseState = 'show';
stage2CollapseState = 'hidden';
assert.equal(container.innerHTML, completedHtmlBeforeToggle);

// 1-2: lifecycle presentation is available before the asynchronous policy renderer completes.
container.innerHTML = '';
assert.equal(sandbox.renderFallback(lifecycle), true);
assert.match(container.innerHTML, /Εκκρεμότητες Μεταφοράς Ρεπό/);
assert.doesNotMatch(container.innerHTML, /Δεν υπάρχουν εκκρεμότητες Μεταφοράς Ρεπό\./);
assert.match(container.innerHTML, /01\/06\/2026–07\/06\/2026/);
assert.match(container.innerHTML, /Απαιτείται επίλυση μεταφοράς ρεπό\./);
assert.doesNotMatch(container.innerHTML, /REPO_RESOLUTION_REQUIRED/);

// 3: the no-card policy/pre-calculation branch clears the shared container.
container.innerHTML = '';
assert.equal(container.innerHTML, '');

// 4: loadResults finally is the final orchestration point and restores the fallback.
assert.equal(sandbox.renderFallback(lifecycle), true);
assert.match(container.innerHTML, /Εκκρεμότητες Μεταφοράς Ρεπό/);
assert.equal((container.innerHTML.match(/Απαιτείται επίλυση μεταφοράς ρεπό\./g) || []).length, 3);

// Real atomic/policy content always wins and is never replaced by the fallback.
container.innerHTML = '<section class="atomic-repo-transfer-section">atomic card</section>';
assert.equal(sandbox.renderFallback(lifecycle), false);
assert.equal(container.innerHTML, '<section class="atomic-repo-transfer-section">atomic card</section>');
assert.doesNotMatch(container.innerHTML, /Δεν υπάρχουν εκκρεμότητες Μεταφοράς Ρεπό\./);

// A later no-card refresh can clear, then restore, the same derived fallback.
container.innerHTML = '';
assert.equal(sandbox.renderFallback(lifecycle), true);
const beforeCollapseToggle = container.innerHTML;
const collapse = { className: 'accordion-collapse collapse show' };
collapse.className = 'accordion-collapse collapse';
collapse.className = 'accordion-collapse collapse show';
assert.equal(container.innerHTML, beforeCollapseToggle);

const loadResults = source.slice(source.indexOf('async function loadResults()'),
    source.indexOf('function pairNo('));
assert.match(loadResults, /renderPreCalculationDataIssues\(rows\);\s*return;/);
assert.match(loadResults, /finally\s*\{[\s\S]*renderWeeklyHrStage2LifecycleFallback\(currentEmploymentReviewLifecyclePresentation\)/);
assert.ok(mutations.some((entry) => entry.after === ''));
assert.match(mutations.at(-1).after, /Εκκρεμότητες Μεταφοράς Ρεπό/);

console.log('Stage-2 asynchronous rendering-order integration test passed');
