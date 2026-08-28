'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');

const defaultReason = 'Μετά από έλεγχο του προδηλωμένου ωραρίου, των πραγματικών στοιχείων απασχόλησης και του καθεστώτος μερικής/εκ περιτροπής απασχόλησης, η ημέρα χαρακτηρίζεται ως ΜΗ ΕΡΓΑΣΙΑ. Δεν προέκυψε άδεια, ασθένεια ή απουσία.';
assert.ok(source.includes(defaultReason));
assert.match(source, /input:\s*'textarea'/);
assert.match(source, /inputValue:\s*selection === 'NON_WORK'\s*\? STAGE3_NON_WORK_DEFAULT_REASON/);
assert.match(source, /inputValidator:[\s\S]*String\(value \|\| ''\)\.trim\(\)/);
assert.match(source, /weekly-hr-stage3-classification/);
assert.match(source, /weekly-hr-stage3-leave-category/);
assert.match(source, /weekly-hr-stage3-resolve/);
assert.match(source, /Απαιτείται τελική εξέταση πιθανής άδειας\./);
assert.doesNotMatch(source.slice(source.indexOf('function renderWeeklyHrStage3'),
    source.indexOf('function updateEmploymentReviewWorkflowPresentation')),
    />REMAINING_POSSIBLE_LEAVE_REVIEW_REQUIRED</);
assert.match(source, /allowed_classifications/);
assert.match(source, /final_classification:\s*selection/);
assert.match(source, /expected_input_fingerprint:\s*item\.input_fingerprint/);
assert.match(source, /expected_stage3_version:\s*Number\(item\.expected_stage3_version \|\| 0\)/);
const submitStage3 = source.slice(source.indexOf('async function submitWeeklyHrStage3Decision'),
    source.indexOf('function updateEmploymentReviewWorkflowPresentation'));
assert.match(submitStage3, /await loadResults\(\)/);
assert.match(submitStage3, /focusWeeklyHrStage1StaleAfterStage3Save\(\)/);
assert.doesNotMatch(submitStage3, /refreshWeeklyHrStage1Scope/);

const focusSource = source.match(
    /function focusWeeklyHrStage1StaleAfterStage3Save\(\) \{[\s\S]*?\n}/
)?.[0] || '';
const selected = new Set(['hidden-open', 'stale-week']);
const filters = { open: true, stale: true, completed: true, blocked: true,
    leave: true, sickness: true, absence: true };
let pruned = 0;
let rendered = 0;
let opened = 0;
const focusSandbox = {
    stage1PayloadsForDisplay: () => [
        { lifecycle_projection: { stages: { stage1: { business_status: 'COMPLETED' } } } },
        { lifecycle_projection: { stages: { stage1: { business_status: 'STALE' } } } }
    ],
    weeklyHrStage1BusinessStatus: (payload) =>
        payload.lifecycle_projection.stages.stage1.business_status,
    stage1DisplayFilters: filters,
    weeklyHrStage1Selected: selected,
    pruneHiddenWeeklyHrStage1Selections: () => { pruned += 1; },
    renderWeeklyHrStage1Presentation: () => { rendered += 1; },
    document: { querySelector: () => ({}) },
    bootstrap: { Collapse: { getOrCreateInstance: () => ({ show: () => { opened += 1; } }) } }
};
vm.runInNewContext(`${focusSource}\nthis.focus = focusWeeklyHrStage1StaleAfterStage3Save;`,
    focusSandbox);
assert.equal(focusSandbox.focus(), 1);
assert.deepEqual(filters, { open: false, stale: true, completed: false, blocked: false,
    leave: false, sickness: false, absence: false });
assert.equal(selected.size, 0);
assert.equal(pruned, 1);
assert.equal(rendered, 1);
assert.equal(opened, 1);
assert.doesNotMatch(focusSource, /weeklyHrStage1Selected\.add|completeWeeklyHrStage1/);
console.log('Stage-3 actionable UI contracts passed');
