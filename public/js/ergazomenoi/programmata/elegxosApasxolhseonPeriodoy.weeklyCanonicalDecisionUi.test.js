'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const view = fs.readFileSync(path.resolve(__dirname,
    '../../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const css = fs.readFileSync(path.resolve(__dirname, '../../../css/main.css'), 'utf8');

assert.ok(source.includes('Μόνο για αυτή την εβδομάδα'));
assert.ok(source.includes('Και για μελλοντικές ίδιες περιπτώσεις'));
assert.ok(source.includes('Ισχύει από'));
assert.ok(source.includes('Ισχύει έως'));
assert.match(source, /canonicalReuseFuture[\s\S]{0,500}disabled = !eligibility\.eligible/);
assert.ok(source.includes("reuse_scope: document.querySelector('input[name=\"canonicalReuseScope\"]:checked')"));
assert.ok(source.includes('reuse_effective_from:'));
assert.ok(source.includes('reuse_effective_to:'));
assert.ok(source.includes("document.getElementById('apo_hmeromhnia')?.value"));
assert.ok(!source.includes('id="canonicalReuseFrom" value="${new Date()'));
assert.ok(source.includes('employment-review-action-btn employment-review-action-primary'));
assert.ok(source.includes("context.applicability === 'APPLICABLE'"));
assert.ok(source.includes("selectedRepoDates.has(date) ? ' checked' : ''"));
assert.ok(source.includes("value === applicableType ? ' selected' : ''"));
assert.ok(view.includes('employment-review-action-btn employment-review-action-secondary'));
assert.match(css, /\.employment-review-action-btn:disabled\s*\{[\s\S]*?opacity:\s*0\.65/);
assert.match(css, /\.employment-review-action-primary:disabled\s*\{[\s\S]*?background:/);
assert.ok(source.includes('όμοιες περιπτώσεις'));
assert.ok(source.includes('Απόφαση για την ομάδα'));
assert.ok(source.includes('ένας επαναχρησιμοποιήσιμος κανόνας'));
assert.ok(source.includes("current.is_identical_group = current.identical_group_count > 1 && Boolean(current.identical_group_key)"));
assert.match(source, /current\.is_identical_group && eligibility\.eligible[\s\S]{0,200}future\.checked = true/);
assert.ok(source.includes('data-identical-group-key='));
assert.ok(source.includes('identical_group_key: current.identical_group_key'));
assert.ok(source.includes('function canonicalGroupingForActionableCase'));
assert.ok(source.includes('currentReviewDeviations.find((deviation)'));
assert.ok(source.includes("group.issue_code === 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'"));
assert.ok(source.includes('function renderCanonicalActionableCases'));
assert.ok(source.includes('displayGroups.get(displayKey).push(item)'));
assert.ok(source.includes('canonical-identical-group'));
assert.match(source, /canonical-identical-group[\s\S]{0,900}data-identical-group-count=[\s\S]{0,400}data-identical-group-key=/);
assert.match(source, /bindActionableIssueEvents[\s\S]{0,1800}querySelectorAll\('\.canonical-decision-open'\)/);
assert.match(source, /dev\.status === 'NEEDS_HR_DECISION' && dev\.requires_new_hr_decision !== false && canRecordCanonicalEmploymentDecision\(\)/);
assert.ok(!source.includes('btn btn-sm btn-outline-primary actionable-issue-open-case'));
assert.ok(source.includes('actionable-issue-open-case employment-review-action-btn employment-review-action-primary'));
assert.ok(!source.includes("target.scrollIntoView({ behavior: 'smooth', block: 'center'"));
assert.ok(source.includes("target.closest('.employment-review-scroll-container')"));
assert.ok(source.includes('scrollContainer.scrollLeft = previousScrollLeft'));

console.log('weekly canonical decision UI tests passed (34 contracts)');
