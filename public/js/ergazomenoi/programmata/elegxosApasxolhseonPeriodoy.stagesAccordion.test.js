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
const decisionCalls = [];
const loadResultsCalls = [];
const fallbackErrors = [];
const sandbox = {
    document: { getElementById: (id) => id === 'policyPreviewGroupsContainer'
        ? stage2Container : id === 'employmentReviewStage2Collapse' ? stage2Collapse : null },
    escapeHtml: (value) => String(value ?? ''),
    formatStage1DateKey: (value) => String(value || ''),
    getPolicyPreviewReasonLabel: (value) => String(value || ''),
    policyPreviewReasonLabels: { REPO_RESOLUTION_REQUIRED: 'Απαιτείται επίλυση μεταφοράς ρεπό.' },
    atomicRepoTransferDiagnosticLabels: {},
    formatPolicyPreviewUnknownCode: (value) => String(value || ''),
    userCanRecordRepoTransferDecision: () => true,
    userCanApplyRepoTransferDecision: () => false,
    submitRepoTransferDecision: async (...args) => { decisionCalls.push(args); return true; },
    submitRepoTransferApply: async () => false,
    loadResults: async () => { loadResultsCalls.push(true); },
    employmentReviewSwal: async (options) => { fallbackErrors.push(options); }
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

const staleLifecycle = sandbox.derive([{ scope: { employee_kodikos: '0004' },
    lifecycle_projection: { stages: {
        stage1: stage('STALE'), stage2: stage('COMPLETED'),
        stage3: stage('COMPLETED'), stage4: stage('COMPLETED')
    } } }]);
assert.equal(staleLifecycle.current_stage, 'STAGE1');
assert.equal(staleLifecycle.stages.STAGE2.presentation_status, 'LOCKED');
assert.equal(staleLifecycle.stages.STAGE3.presentation_status, 'LOCKED');
assert.equal(staleLifecycle.stages.STAGE4.presentation_status, 'LOCKED');
const completedLifecycle = sandbox.derive([{ scope: { employee_kodikos: '0004' },
    lifecycle_projection: { stages: {
        stage1: stage('COMPLETED'), stage2: stage('COMPLETED'),
        stage3: stage('COMPLETED'), stage4: stage('COMPLETED')
    } } }]);
assert.equal(completedLifecycle.current_stage, null);
assert.equal(completedLifecycle.requires_hr_action, false);
assert.equal(completedLifecycle.total_pending_count, 0);

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
assert.match(source, /button\.disabled = presentationStatus === 'LOCKED'/);
assert.match(source, /aria-disabled[\s\S]{0,100}LOCKED/);

const rendered = sandbox.renderWeeklyHrStage2LifecycleFallback(lifecycle);
assert.equal(rendered, true);
assert.match(stage2Container.innerHTML, /Εκκρεμότητες Μεταφοράς Ρεπό/);
assert.match(stage2Container.innerHTML, /0004/);
assert.match(stage2Container.innerHTML, /Απαιτείται επίλυση μεταφοράς ρεπό\./);
assert.doesNotMatch(stage2Container.innerHTML, /REPO_RESOLUTION_REQUIRED/);
assert.equal(sandbox.getStage2LifecycleReasonLabel('REPO_TRANSFER_DECISION_REQUIRED'),
    'Απαιτείται απόφαση για τη συνδεδεμένη πρόταση μεταφοράς ρεπό.');
assert.notEqual(sandbox.getStage2LifecycleReasonLabel('REPO_TRANSFER_DECISION_REQUIRED'),
    'Απαιτείται έλεγχος της περίπτωσης.');
const stage2HtmlBeforeToggle = stage2Container.innerHTML;
stage2Collapse.className = 'accordion-collapse collapse show';
stage2Collapse.className = 'accordion-collapse collapse';
assert.equal(stage2Container.innerHTML, stage2HtmlBeforeToggle);

stage2Container.innerHTML = '<section>Προτάσεις Μεταφοράς Ρεπό · ' +
    'Μεταφορές ρεπό προς απόφαση: 9</section>';
assert.equal(sandbox.renderWeeklyHrStage2LifecycleFallback({ stages: { STAGE2: {
    business_status: 'COMPLETED', pending_count: 0, pending_items: []
} } }), true);
assert.equal(stage2Container.innerHTML,
    '<div class="text-muted small employment-review-stage2-empty">' +
    'Δεν υπάρχουν εκκρεμείς μεταφορές ρεπό.</div>');
assert.doesNotMatch(stage2Container.innerHTML, /Προτάσεις Μεταφοράς Ρεπό/);
assert.doesNotMatch(stage2Container.innerHTML, /Μεταφορές ρεπό προς απόφαση/);

stage2Container.innerHTML = '<div>legacy A B C D</div>';
const pendingLifecycle = { stages: { STAGE2: { business_status: 'OPEN', pending_count: 2,
    pending_reasons: ['REPO_RESOLUTION_REQUIRED'], pending_items: [
        { employee_kodikos: 'A', week_start: '2026-06-01', week_end: '2026-06-07',
            pending_count: 1, reasons: ['REPO_RESOLUTION_REQUIRED'] },
        { employee_kodikos: 'B', week_start: '2026-06-08', week_end: '2026-06-14',
            pending_count: 1, reasons: ['REPO_RESOLUTION_REQUIRED'] }
    ] } } };
assert.equal(sandbox.renderWeeklyHrStage2LifecycleFallback(pendingLifecycle), true);
assert.match(stage2Container.innerHTML, /<td>A<\/td>/);
assert.match(stage2Container.innerHTML, /<td>B<\/td>/);
assert.doesNotMatch(stage2Container.innerHTML, /legacy|<td>C<\/td>|<td>D<\/td>/);
const batchShapedCurrentProposal = {
    source: { current_category: 'ΑΝ', proposed_values: {
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        ores_ergasias_apologistika: 8.5,
        apo_ora_01_apologistika: '14:07', eos_ora_01_apologistika: '22:37' } },
    target: { current_category: 'ΕΡΓ', proposed_values: {
        kathgoria_ergasias_apologistika: 'ΑΝ',
        ores_ergasias_apologistika: 0 } }
};
const structuredLifecycle = { stages: { STAGE2: { business_status: 'OPEN',
    pending_count: 1, pending_reasons: ['REPO_TRANSFER_DECISION_REQUIRED'], pending_items: [{
        employee_kodikos: '0029', week_start: '2026-07-13', week_end: '2026-07-19',
        reason_code: 'REPO_TRANSFER_DECISION_REQUIRED', decision_state: 'NONE',
        source: { date: '2026-07-13', declaration_classification: 'ΡΕΠΟ',
            card_intervals: [{ start: '14:07', end: '22:37' }] },
        target: { date: '2026-07-14', declaration_classification: 'ΕΡΓΑΣΙΑ',
            card_intervals: [] },
        proposal: { source_new_classification: 'ΕΡΓΑΣΙΑ',
            target_new_classification: 'ΡΕΠΟ' },
        proposal_id: 'proposal-0029', decision_command: {
            proposal_id: 'proposal-0029', expected_source_id: 'source-0029',
            expected_target_id: 'target-0029', expected_proposal_version: 'v5',
            expected_choice_code: 'TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR' },
        canonical_source: structuredClone(batchShapedCurrentProposal.source),
        canonical_target: structuredClone(batchShapedCurrentProposal.target)
    }] } } };
const decisionButtons = ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL'].map((decisionCode) => ({
    disabled: false, dataset: { decisionCode },
    addEventListener(_event, listener) { this.listener = listener; }
}));
const structuredArticle = {
    querySelectorAll: () => decisionButtons,
    querySelector: () => null
};
stage2Container.querySelectorAll = (selector) =>
    selector === '.employment-review-stage2-proposal' ? [structuredArticle] : [];
assert.equal(sandbox.renderWeeklyHrStage2LifecycleFallback(structuredLifecycle), true);
assert.match(stage2Container.innerHTML, /Βρέθηκε προδηλωμένο ρεπό/);
assert.match(stage2Container.innerHTML, /14:07–22:37/);
assert.match(stage2Container.innerHTML, /2026-07-13.*ΡΕΠΟ → ΕΡΓΑΣΙΑ/);
assert.match(stage2Container.innerHTML, /2026-07-14.*ΕΡΓΑΣΙΑ → ΡΕΠΟ/);
assert.match(stage2Container.innerHTML, /Ελέγξτε αν η 2026-07-14 ήταν πράγματι το ρεπό/);
assert.doesNotMatch(stage2Container.innerHTML,
    /Απαιτείται έλεγχος της περίπτωσης\./);
assert.match(stage2Container.innerHTML, />Αποδοχή πρότασης<\/button>/);
assert.match(stage2Container.innerHTML, />Δεν ισχύει<\/button>/);
const authoritativePendingHtml = stage2Container.innerHTML;
stage2Collapse.className = 'accordion-collapse collapse show';
stage2Collapse.className = 'accordion-collapse collapse';
assert.equal(stage2Container.innerHTML, authoritativePendingHtml);
assert.match(source, /currentReviewLifecycleProjectionReady && renderWeeklyHrStage2LifecycleFallback/);
assert.match(source.match(/function updateEmploymentReviewWorkflowPresentation[\s\S]*?\n}/)?.[0] || '',
    /renderWeeklyHrStage2LifecycleFallback\(lifecycle\)/);

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

(async () => {
    await decisionButtons[0].listener();
    assert.deepEqual(decisionCalls.map((call) => call[1]), ['APPROVE_PROPOSAL']);
    assert.equal(loadResultsCalls.length, 1);
    await decisionButtons[1].listener();
    assert.deepEqual(decisionCalls.map((call) => call[1]),
        ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL']);
    assert.equal(loadResultsCalls.length, 2);
    assert.equal(fallbackErrors.length, 0);
    assert.ok(decisionCalls.every((call) => call[0].group_id === 'proposal-0029'));
    assert.ok(decisionCalls.every((call) =>
        call[0].pair_contract.choice_code === 'TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR'));

    for (const employmentType of ['MERIKH', 'EK_PERITROPHS']) {
        const nonWorkLifecycle = structuredClone(structuredLifecycle);
        const item = nonWorkLifecycle.stages.STAGE2.pending_items[0];
        item.source.declaration_classification = 'ΜΕ';
        item.proposal.target_new_classification = 'ΜΕ';
        assert.equal(sandbox.renderWeeklyHrStage2LifecycleFallback(nonWorkLifecycle), true);
        assert.match(stage2Container.innerHTML, /Βρέθηκε προδηλωμένη μη εργασία/,
            employmentType);
        assert.match(stage2Container.innerHTML, /η μη εργασία που δόθηκε αντί της προδηλωμένης μη εργασίας/,
            employmentType);
        assert.doesNotMatch(stage2Container.innerHTML, /προδηλωμένο ρεπό/, employmentType);
    }

    const approvedLifecycle = structuredClone(structuredLifecycle);
    const approvedItem = approvedLifecycle.stages.STAGE2.pending_items[0];
    approvedItem.decision_state = 'APPROVED_PENDING_APPLY';
    approvedItem.can_apply = true;
    approvedItem.apply_state = 'READY_TO_APPLY';
    approvedItem.decision_id = 'decision-0029';
    const applyButton = { disabled: false,
        addEventListener(_event, listener) { this.listener = listener; } };
    const applyArticle = { querySelectorAll: () => [],
        querySelector: (selector) => selector === '.stage2-lifecycle-apply-btn'
            ? applyButton : null };
    stage2Container.querySelectorAll = () => [applyArticle];
    sandbox.userCanApplyRepoTransferDecision = () => true;
    let fallbackApplyGroup = null;
    let successfulApplyCalls = 0;
    sandbox.submitRepoTransferApply = async (group) => {
        successfulApplyCalls += 1;
        fallbackApplyGroup = group;
        return true;
    };
    assert.equal(sandbox.renderWeeklyHrStage2LifecycleFallback(approvedLifecycle), true);
    await applyButton.listener();
    assert.equal(successfulApplyCalls, 1);
    assert.equal(loadResultsCalls.length, 3);
    assert.equal(fallbackErrors.length, 0);
    const sourceItem = fallbackApplyGroup.items.find((item) =>
        item.role === 'SOURCE_BECOMES_WORK');
    const targetItem = fallbackApplyGroup.items.find((item) =>
        item.role === 'TARGET_BECOMES_REPO');
    assert.equal(sourceItem.kathgoria_ergasias, 'ΑΝ');
    assert.equal(sourceItem.proposed_values.kathgoria_ergasias_apologistika, 'ΕΡΓ');
    assert.equal(sourceItem.proposed_values.ores_ergasias_apologistika, 8.5);
    assert.equal(sourceItem.proposed_values.apo_ora_01_apologistika, '14:07');
    assert.equal(sourceItem.proposed_values.eos_ora_01_apologistika, '22:37');
    assert.equal(targetItem.kathgoria_ergasias, 'ΕΡΓ');
    assert.equal(targetItem.proposed_values.kathgoria_ergasias_apologistika, 'ΑΝ');
    assert.deepEqual(sourceItem.proposed_values,
        batchShapedCurrentProposal.source.proposed_values);
    assert.deepEqual(targetItem.proposed_values,
        batchShapedCurrentProposal.target.proposed_values);

    let decisionPostAttempts = 0;
    fallbackErrors.length = 0;
    sandbox.submitRepoTransferDecision = async () => {
        decisionPostAttempts += 1;
        throw new Error('decision submit failed');
    };
    await decisionButtons[0].listener();
    assert.equal(decisionPostAttempts, 1);
    assert.equal(fallbackErrors.at(-1).title, 'Δεν καταγράφηκε η απόφαση');

    fallbackErrors.length = 0;
    sandbox.submitRepoTransferDecision = async () => {
        decisionPostAttempts += 1;
        return true;
    };
    sandbox.loadResults = async () => { throw new Error('decision refresh failed'); };
    await decisionButtons[1].listener();
    assert.equal(decisionPostAttempts, 2);
    assert.equal(fallbackErrors.at(-1).icon, 'warning');
    assert.match(fallbackErrors.at(-1).title,
        /Η απόφαση καταγράφηκε, αλλά η προβολή δεν ανανεώθηκε/);
    assert.doesNotMatch(fallbackErrors.at(-1).title, /Δεν καταγράφηκε/);
    assert.match(fallbackErrors.at(-1).text, /Αναζήτηση/);

    let applyPostAttempts = 0;
    let applyRefreshAttempts = 0;
    fallbackErrors.length = 0;
    sandbox.loadResults = async () => { applyRefreshAttempts += 1; };
    sandbox.submitRepoTransferApply = async () => {
        applyPostAttempts += 1;
        return false;
    };
    await applyButton.listener();
    assert.equal(applyPostAttempts, 1);
    assert.equal(applyRefreshAttempts, 0);
    assert.equal(fallbackErrors.length, 0);

    fallbackErrors.length = 0;
    sandbox.submitRepoTransferApply = async () => {
        applyPostAttempts += 1;
        throw new Error('apply submit failed');
    };
    await applyButton.listener();
    assert.equal(applyPostAttempts, 2);
    assert.equal(applyRefreshAttempts, 0);
    assert.equal(fallbackErrors.length, 1);
    assert.equal(fallbackErrors.at(-1).title, 'Δεν εφαρμόστηκε η μεταφορά');

    fallbackErrors.length = 0;
    sandbox.submitRepoTransferApply = async () => {
        applyPostAttempts += 1;
        return true;
    };
    sandbox.loadResults = async () => {
        applyRefreshAttempts += 1;
        throw new Error('apply refresh failed');
    };
    await applyButton.listener();
    assert.equal(applyPostAttempts, 3);
    assert.equal(applyRefreshAttempts, 1);
    assert.equal(fallbackErrors.at(-1).icon, 'warning');
    assert.match(fallbackErrors.at(-1).title,
        /Η εφαρμογή ολοκληρώθηκε, αλλά η προβολή δεν ανανεώθηκε/);
    assert.doesNotMatch(fallbackErrors.at(-1).title, /Δεν εφαρμόστηκε/);
    assert.match(fallbackErrors.at(-1).text, /Αναζήτηση/);
    console.log('employment review four-stage accordion projection tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
