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
assert.match(view, /id="employmentReviewWorkflowProgress"/);
assert.match(view, /aria-label="Πρόοδος Ελέγχου Απασχολήσεων"/);
assert.match(view, /id="employmentReviewAttentionSummary"/);
assert.match(view, /STAGE1[\s\S]*weeklyHrStage1Container/);
assert.match(view, /STAGE2[\s\S]*policyPreviewGroupsContainer/);
assert.match(view, /STAGE3[\s\S]*weeklyHrStage3Container/);
assert.match(view, /STAGE4[\s\S]*resultsTable/);

const helperStart = source.indexOf('const workflowStageNames');
const helperEnd = source.indexOf('function renderWeeklyHrStage3');
const stage2Container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
const stage2Collapse = { className: 'accordion-collapse collapse' };
const decisionCalls = [];
const loadResultsCalls = [];
const fallbackErrors = [];
const sandbox = {
    currentWeeklyHrStage2BulkPreview: null,
    currentCanonicalLifecyclePayloads: [], weeklyHrStage2BulkSubmitting: false,
    document: { getElementById: (id) => id === 'policyPreviewGroupsContainer'
        ? stage2Container : id === 'employmentReviewStage2Collapse' ? stage2Collapse : null },
    escapeHtml: (value) => String(value ?? ''),
    formatStage1DateKey: (value) => String(value || ''),
    getPolicyPreviewReasonLabel: (value) => String(value || ''),
    policyPreviewReasonLabels: { REPO_RESOLUTION_REQUIRED: 'Απαιτείται επίλυση μεταφοράς ρεπό.' },
    atomicRepoTransferDiagnosticLabels: {},
    formatPolicyPreviewUnknownCode: (value) => String(value || ''),
    userCanRecordRepoTransferDecision: () => true,
    userCanRecordCanonicalDecision: () => false,
    canRecordEmploymentDecisionForCurrentPeriod: () => false,
    userCanApplyRepoTransferDecision: () => false,
    submitRepoTransferDecision: async (...args) => { decisionCalls.push(args); return true; },
    submitRepoTransferApply: async () => false,
    loadResults: async () => { loadResultsCalls.push(true); },
    employmentReviewSwal: async (options) => { fallbackErrors.push(options); }
};
vm.runInNewContext(`${source.slice(helperStart, helperEnd)}
this.derive = derivePeriodLifecyclePresentation;`, sandbox);
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

const readyAutomaticLifecycle = sandbox.derive([{ scope: { employee_kodikos: '0004' },
    lifecycle_projection: { stages: {
        stage1: stage('COMPLETED'), stage2: stage('COMPLETED'),
        stage3: stage('OPEN', 26), stage4: stage('COMPLETED')
    } } }], null, { safe_bulk_count: 19, manual_exception_count: 0 });
assert.equal(readyAutomaticLifecycle.current_stage, 'STAGE2');
assert.equal(readyAutomaticLifecycle.stages.STAGE2.presentation_status, 'ACTIVE');
assert.equal(readyAutomaticLifecycle.stages.STAGE2.pending_count, 19);
assert.equal(readyAutomaticLifecycle.stages.STAGE2.user_action_required, true);
assert.equal(readyAutomaticLifecycle.stages.STAGE3.presentation_status, 'LOCKED');
assert.equal(readyAutomaticLifecycle.stages.STAGE3.enabled, false);
const stage3AfterStage2 = sandbox.derive([{ scope: { employee_kodikos: '0004' },
    lifecycle_projection: { stages: {
        stage1: stage('COMPLETED'), stage2: stage('COMPLETED'),
        stage3: stage('OPEN', 26), stage4: stage('COMPLETED')
    } } }], null, { safe_bulk_count: 0, manual_exception_count: 0 });
assert.equal(stage3AfterStage2.current_stage, 'STAGE3');
const manualStage2 = sandbox.derive([{ scope: { employee_kodikos: '0004' },
    lifecycle_projection: { stages: {
        stage1: stage('COMPLETED'), stage2: stage('COMPLETED'),
        stage3: stage('OPEN', 26), stage4: stage('COMPLETED')
    } } }], null, { safe_bulk_count: 0, manual_exception_count: 1 });
assert.equal(manualStage2.current_stage, 'STAGE2');

const staleLifecycle = sandbox.derive([{ scope: { employee_kodikos: '0004' },
    lifecycle_projection: { stages: {
        stage1: stage('STALE'), stage2: stage('COMPLETED'),
        stage3: stage('COMPLETED'), stage4: stage('COMPLETED')
    } } }]);
assert.equal(staleLifecycle.current_stage, 'STAGE1');
assert.equal(staleLifecycle.stages.STAGE2.presentation_status, 'LOCKED');
assert.equal(staleLifecycle.stages.STAGE3.presentation_status, 'LOCKED');
assert.equal(staleLifecycle.stages.STAGE4.presentation_status, 'LOCKED');
const activeStage1Lifecycle = sandbox.derive([{ scope: { employee_kodikos: '0031' },
    lifecycle_projection: { stages: {
        stage1: stage('OPEN', 1), stage2: stage('COMPLETED'),
        stage3: stage('COMPLETED'), stage4: stage('COMPLETED')
    } } }]);
assert.equal(activeStage1Lifecycle.stages.STAGE1.presentation_status, 'ACTIVE');
const refreshedActiveStage1Lifecycle = sandbox.derive([{ scope: {
    employee_kodikos: '0031' }, lifecycle_projection: { stages: {
    stage1: stage('OPEN', 1), stage2: stage('COMPLETED'),
    stage3: stage('COMPLETED'), stage4: stage('COMPLETED')
} } }]);
assert.equal(refreshedActiveStage1Lifecycle.stages.STAGE1.presentation_status, 'ACTIVE');
assert.equal(refreshedActiveStage1Lifecycle.stages.STAGE2.presentation_status, 'LOCKED');
assert.equal(refreshedActiveStage1Lifecycle.stages.STAGE3.presentation_status, 'LOCKED');
assert.equal(refreshedActiveStage1Lifecycle.stages.STAGE4.presentation_status, 'LOCKED');
const completedLifecycle = sandbox.derive([{ scope: { employee_kodikos: '0004' },
    lifecycle_projection: { stages: {
        stage1: stage('COMPLETED'), stage2: stage('COMPLETED'),
        stage3: stage('COMPLETED'), stage4: stage('COMPLETED')
    } } }]);
assert.equal(completedLifecycle.current_stage, null);
assert.equal(completedLifecycle.requires_hr_action, false);
assert.equal(completedLifecycle.total_pending_count, 0);

const guideStart = source.indexOf('function employmentReviewWaitingReason');
const guideEnd = source.indexOf('function updateEmploymentReviewWorkflowPresentation');
assert.notEqual(guideStart, -1);
assert.notEqual(guideEnd, -1);
assert.ok(guideEnd > guideStart);
const classList = () => ({ values: new Set(['d-none']),
    remove(value) { this.values.delete(value); }, add(value) { this.values.add(value); },
    contains(value) { return this.values.has(value); } });
const progressElement = { innerHTML: '', classList: classList() };
const attentionElement = { innerHTML: '', classList: classList() };
const guideSandbox = {
    currentWeeklyHrStage2BulkPreview: null,
    workflowStageShortNames: { STAGE1: 'Άδειες', STAGE2: 'Μεταφορά Ρεπό',
        STAGE3: 'Υπόλοιπες Άδειες', STAGE4: 'Τελικός Έλεγχος' },
    escapeHtml: (value) => String(value ?? '').replaceAll('<', '&lt;'),
    getStage2LifecycleReasonLabel: () => 'Διορθώστε τα στοιχεία του τρέχοντος σταδίου.',
    document: { getElementById: (id) => id === 'employmentReviewWorkflowProgress'
        ? progressElement : id === 'employmentReviewAttentionSummary' ? attentionElement : null },
    CSS: { escape: (value) => value }, bootstrap: { Collapse: { getOrCreateInstance: () => ({ show() {} }) } }
};
vm.runInNewContext(`${source.slice(guideStart, guideEnd)}
this.renderGuide = renderEmploymentReviewWorkflowGuide;
this.attention = employmentReviewAttentionPresentation;
this.focusStage = focusEmploymentReviewStage;`, guideSandbox);
guideSandbox.renderGuide(stage3AfterStage2);
assert.match(progressElement.innerHTML, /1\. Άδειες/);
assert.match(progressElement.innerHTML, /2\. Μεταφορά Ρεπό/);
assert.match(progressElement.innerHTML, /3\. Υπόλοιπες Άδειες/);
assert.match(progressElement.innerHTML, /4\. Τελικός Έλεγχος/);
assert.equal((progressElement.innerHTML.match(/is-completed/g) || []).length, 2);
assert.match(progressElement.innerHTML, /is-current[^>]*aria-current="step"/);
assert.match(progressElement.innerHTML, /is-waiting/);
assert.doesNotMatch(progressElement.innerHTML, /ΚΛΕΙΔΩΜΕΝΟ/);
assert.match(progressElement.innerHTML,
    /Αναμονή ολοκλήρωσης του Σταδίου 3 — Υπόλοιπες Άδειες/);
assert.match(attentionElement.innerHTML, /Τι χρειάζεται την προσοχή σας/);
assert.match(attentionElement.innerHTML, /26 ημέρες χρειάζονται τελικό χαρακτηρισμό/);
assert.match(attentionElement.innerHTML, /Τα προηγούμενα στάδια έχουν ολοκληρωθεί/);
assert.match(attentionElement.innerHTML, /Προβολή 26 εκκρεμοτήτων/);
assert.equal(progressElement.classList.contains('d-none'), false);
assert.equal(attentionElement.classList.contains('d-none'), false);

guideSandbox.currentWeeklyHrStage2BulkPreview = {
    safe_bulk_count: 19, manual_exception_count: 0, already_resolved_count: 66
};
guideSandbox.renderGuide(readyAutomaticLifecycle);
assert.match(attentionElement.innerHTML, /19 περιπτώσεις είναι έτοιμες για ασφαλή ενημέρωση/);
assert.match(attentionElement.innerHTML, /0 χρειάζονται χειροκίνητο έλεγχο/);
assert.match(attentionElement.innerHTML, /66 έχουν ήδη τακτοποιηθεί/);
assert.match(attentionElement.innerHTML, /Προεπισκόπηση 19 ενημερώσεων/);

guideSandbox.renderGuide(completedLifecycle);
assert.match(attentionElement.innerHTML, /Ο έλεγχος ολοκληρώθηκε/);
assert.doesNotMatch(attentionElement.innerHTML, /data-employment-review-attention-stage/);
const blockedLifecycle = { current_stage: 'STAGE2', stages: {
    STAGE1: { presentation_status: 'COMPLETED', business_status: 'COMPLETED' },
    STAGE2: { presentation_status: 'ACTIVE', business_status: 'BLOCKED', open_by_default: true,
        pending_reasons: ['BLOCKER'] },
    STAGE3: { presentation_status: 'LOCKED', business_status: 'OPEN' },
    STAGE4: { presentation_status: 'LOCKED', business_status: 'OPEN' }
} };
guideSandbox.renderGuide(blockedLifecycle);
assert.match(progressElement.innerHTML, /is-blocked/);
assert.match(progressElement.innerHTML, /Χρειάζεται διόρθωση/);
assert.match(attentionElement.innerHTML, /Διορθώστε τα στοιχεία του τρέχοντος σταδίου/);

let shown = 0;
let focused = 0;
let scrolled = 0;
const focusItem = { querySelector: (selector) => selector === '.accordion-button'
    ? { disabled: false, focus() { focused += 1; } } : { },
scrollIntoView() { scrolled += 1; } };
guideSandbox.document.querySelector = () => focusItem;
guideSandbox.bootstrap.Collapse.getOrCreateInstance = () => ({ show() { shown += 1; } });
assert.equal(guideSandbox.focusStage('STAGE3'), true);
assert.equal(shown, 1);
assert.equal(focused, 1);
assert.equal(scrolled, 1);
assert.doesNotMatch(source.slice(guideStart, guideEnd), /fetch\s*\(/);
const progressedLifecycle = sandbox.derive([{ scope: { employee_kodikos: '0004' },
    lifecycle_projection: { stages: {
        stage1: stage('COMPLETED'), stage2: stage('OPEN', 1),
        stage3: stage('COMPLETED'), stage4: stage('COMPLETED')
    } } }]);
assert.notStrictEqual(progressedLifecycle, refreshedActiveStage1Lifecycle);
assert.equal(progressedLifecycle.stages.STAGE1.presentation_status, 'COMPLETED');
assert.equal(progressedLifecycle.stages.STAGE2.presentation_status, 'ACTIVE');
assert.equal(progressedLifecycle.stages.STAGE3.presentation_status, 'LOCKED');
assert.equal(progressedLifecycle.stages.STAGE4.presentation_status, 'LOCKED');

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
assert.match(source, /button\.disabled = stageViewLocked/);
assert.match(source, /aria-disabled[\s\S]{0,100}stageViewLocked/);
assert.match(source, /ΑΠΑΙΤΕΙΤΑΙ ΕΝΕΡΓΕΙΑ/);
assert.match(source, /employmentReviewWaitingReason\(stage\.stage\)/);

const rendered = sandbox.renderWeeklyHrStage2LifecycleFallback(lifecycle);
assert.equal(rendered, true);
assert.match(stage2Container.innerHTML, /Περιπτώσεις που χρειάζονται έλεγχο/);
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
sandbox.currentWeeklyHrStage2BulkPreview = null;
assert.equal(sandbox.renderWeeklyHrStage2LifecycleFallback({ stages: { STAGE2: {
    business_status: 'COMPLETED', pending_count: 0, pending_items: []
} } }), true);
assert.match(stage2Container.innerHTML, /Προεπισκόπηση μαζικής ενημέρωσης/);
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
sandbox.currentWeeklyHrStage2BulkPreview = null;
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
sandbox.currentWeeklyHrStage2BulkPreview = null;
assert.equal(sandbox.renderWeeklyHrStage2LifecycleFallback(structuredLifecycle), true);
assert.match(stage2Container.innerHTML, /<td>0029<\/td>/);
assert.match(stage2Container.innerHTML, />Έλεγχος<\/button>/);
assert.doesNotMatch(stage2Container.innerHTML, /employment-review-stage2-proposal/);
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
assert.match(getCssRule('.employment-review-progress-step.is-completed'), /--bs-success/);
assert.match(getCssRule('.employment-review-progress-step.is-current'), /--bs-warning/);
assert.match(getCssRule('.employment-review-progress-step.is-blocked'), /--bs-danger/);

console.log('employment review four-stage accordion projection tests passed');
