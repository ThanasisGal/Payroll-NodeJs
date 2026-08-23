'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
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
console.log('Stage-3 actionable UI contracts passed');
