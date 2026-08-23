'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const view = fs.readFileSync(path.join(__dirname,
    '../../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../../public/css/main.css'), 'utf8');

function getDirectStageItems(markup) {
    const parentStart = markup.indexOf('<div class="accordion" id="employmentReviewStagesAccordion">');
    assert.notEqual(parentStart, -1);
    const tags = /<\/?div\b[^>]*>/g;
    tags.lastIndex = parentStart;
    let depth = 0;
    const items = [];
    for (let match = tags.exec(markup); match; match = tags.exec(markup)) {
        const isClosing = match[0].startsWith('</');
        if (isClosing) {
            depth -= 1;
            if (depth === 0) break;
            continue;
        }
        if (depth === 1 && /class="accordion-item"/.test(match[0])) items.push(match[0]);
        depth += 1;
    }
    return items;
}

function getCssRule(selector) {
    for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const selectors = match[1].split(',').map((candidate) => candidate.trim());
        if (selectors.includes(selector)) return match[2];
    }
    assert.fail(`Missing CSS rule: ${selector}`);
}

assert.match(view, /id="employmentReviewStagesAccordion"/);
assert.equal((view.match(/data-bs-parent="#employmentReviewStagesAccordion"/g) || []).length, 4);
assert.equal((view.match(/class="accordion-item" data-workflow-stage="STAGE[1-4]"/g) || []).length, 4);
assert.equal(getDirectStageItems(view).length, 4);
assert.match(view, /employmentReviewWorkflowSummary/);
assert.match(view, /STAGE1[\s\S]*weeklyHrStage1Container/);
assert.match(view, /STAGE2[\s\S]*policyPreviewGroupsContainer/);
assert.match(view, /STAGE3[\s\S]*weeklyHrStage3Container/);
assert.match(view, /STAGE4[\s\S]*resultsTable/);

const helperStart = source.indexOf('const workflowStageNames');
const helperEnd = source.indexOf('function renderWeeklyHrStage3');
const stage2Container = { innerHTML: '' };
const stage2Collapse = { className: 'accordion-collapse collapse' };
const sandbox = {
    document: { getElementById: (id) => id === 'policyPreviewGroupsContainer'
        ? stage2Container : id === 'employmentReviewStage2Collapse' ? stage2Collapse : null },
    escapeHtml: (value) => String(value ?? ''),
    formatStage1DateKey: (value) => String(value || ''),
    getPolicyPreviewReasonLabel: (value) => String(value || ''),
    policyPreviewReasonLabels: { REPO_RESOLUTION_REQUIRED: 'Απαιτείται επίλυση μεταφοράς ρεπό.' },
    atomicRepoTransferDiagnosticLabels: {},
    formatPolicyPreviewUnknownCode: (value) => String(value || '')
};
vm.runInNewContext(`${source.slice(helperStart, helperEnd)}\nthis.derive = derivePeriodLifecyclePresentation;`, sandbox);
const stage = (business_status, pending_count = 0) => ({ business_status, pending_count,
    pending_dates: [], pending_reasons: [] });
const lifecycle = sandbox.derive([{ scope: { employee_kodikos: '0004' },
    lifecycle_projection: { stages: {
        stage1: { ...stage('COMPLETED'), persisted_status: 'OPEN' },
        stage2: { ...stage('OPEN', 3), pending_dates: ['2026-06-17'],
            pending_reasons: ['REPO_RESOLUTION_REQUIRED'] },
        stage3: stage('OPEN', 1), stage4: stage('COMPLETED')
    } } }]);
assert.equal(lifecycle.current_stage, 'STAGE2');
assert.equal(lifecycle.stages.STAGE1.presentation_status, 'COMPLETED');
assert.equal(lifecycle.stages.STAGE1.enabled, true);
assert.equal(lifecycle.stages.STAGE2.presentation_status, 'ACTIVE');
assert.equal(lifecycle.stages.STAGE3.presentation_status, 'LOCKED');
assert.equal(lifecycle.stages.STAGE3.enabled, false);
assert.equal(lifecycle.stages.STAGE4.presentation_status, 'LOCKED');

const unsortedStage3 = sandbox.derive([
    [['2026-06-09', '2026-06-10'], 'week-2'],
    [['2026-06-03'], 'week-1'], [['2026-06-22'], 'week-4']
].map(([dates, week]) => ({ scope: { employee_kodikos: '0014', week_start: week },
    lifecycle_projection: { stages: {
        stage1: stage('COMPLETED'), stage2: stage('COMPLETED'),
        stage3: { ...stage('OPEN', dates.length), pending_dates: dates,
            pending_items: dates.map((date) => ({ date, row_id: `row-${date}` })) },
        stage4: stage('COMPLETED')
    } } })));
assert.deepEqual(Array.from(unsortedStage3.stages.STAGE3.pending_items, (item) => item.date),
    ['2026-06-03', '2026-06-09', '2026-06-10', '2026-06-22']);
assert.match(source, /button\.disabled = status === 'LOCKED'/);
assert.match(source, /aria-disabled[\s\S]{0,100}LOCKED/);

const rendered = sandbox.renderWeeklyHrStage2LifecycleFallback(lifecycle);
assert.equal(rendered, true);
assert.match(stage2Container.innerHTML, /Εκκρεμότητες Μεταφοράς Ρεπό/);
assert.match(stage2Container.innerHTML, /0004/);
assert.match(stage2Container.innerHTML, /Απαιτείται επίλυση μεταφοράς ρεπό\./);
assert.doesNotMatch(stage2Container.innerHTML, /REPO_RESOLUTION_REQUIRED/);
const stage2HtmlBeforeToggle = stage2Container.innerHTML;
stage2Collapse.className = 'accordion-collapse collapse show';
stage2Collapse.className = 'accordion-collapse collapse';
assert.equal(stage2Container.innerHTML, stage2HtmlBeforeToggle);
assert.match(source, /container\.innerHTML = '';\s*renderWeeklyHrStage2LifecycleFallback/);

const headingIds = [...view.matchAll(/id="(employmentReviewStage[1-4]Heading)"/g)].map((match) => match[1]);
const collapseIds = [...view.matchAll(/id="(employmentReviewStage[1-4]Collapse)"/g)].map((match) => match[1]);
assert.equal(headingIds.length, 4);
assert.equal(collapseIds.length, 4);
assert.equal(new Set(headingIds).size, 4);
assert.equal(new Set(collapseIds).size, 4);

const itemRule = getCssRule('#employmentReviewStagesAccordion > .accordion-item');
const headerRule = getCssRule('#employmentReviewStagesAccordion > .accordion-item > .accordion-header');
const buttonRule = getCssRule('#employmentReviewStagesAccordion > .accordion-item > .accordion-header > .accordion-button');
const headerContentRule = getCssRule('#employmentReviewStagesAccordion .workflow-stage-header');
assert.doesNotMatch(`${itemRule}${headerRule}${buttonRule}`, /position\s*:\s*(?:absolute|sticky)/);
assert.match(itemRule, /position\s*:\s*static/);
assert.match(headerRule, /position\s*:\s*static/);
assert.match(buttonRule, /height\s*:\s*auto/);
assert.match(buttonRule, /white-space\s*:\s*normal/);
assert.match(buttonRule, /margin\s*:\s*0\s*!important/);
assert.match(headerContentRule, /flex-wrap\s*:\s*wrap/);
assert.doesNotMatch(buttonRule, /(?:^|\n)\s*height\s*:\s*[0-9.]+(?:px|rem|vh|vw)\s*;/);

console.log('employment review four-stage accordion projection tests passed');
