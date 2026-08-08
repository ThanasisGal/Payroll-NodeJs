'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const view = fs.readFileSync(path.join(__dirname,
    '../../../views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const browser = fs.readFileSync(path.join(__dirname,
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');

for (const method of ['getWeeklyCanonicalDecisionCurrent', 'getWeeklyCanonicalDecisions',
    'createWeeklyCanonicalDecision']) assert.ok(controller.includes(`static ${method}`));
assert.ok(controller.includes('loadWeeklyCanonicalDecisionContext({'));
assert.ok(controller.includes('validateCommandForCurrentContext({ session: req.session, body, context })'));
assert.ok(controller.includes('recordWeeklyCanonicalDecision({'));
assert.ok(controller.includes("error?.code === 'CANONICAL_DECISION_INDEXES_NOT_READY' ? 503"));
assert.ok(view.includes('id="canonicalDecisionModal"'));
assert.ok(browser.includes('Καταγραφή απόφασης'));
assert.ok(view.includes('Απόφαση εβδομαδιαίου ελέγχου'));
assert.ok(browser.includes('Η απόφαση είναι μόνο τεκμηριωτική'));
assert.ok(browser.includes('canonicalApplicabilityLabels'));
assert.ok(browser.includes('current_repo_candidate_dates'));
assert.ok(browser.includes('profile_candidates'));
assert.ok(browser.includes('Η επανεκτέλεση υπολογισμού γίνεται από το υπάρχον κουμπί'));
assert.ok(!browser.includes('record decision + calculation'));
assert.ok(!view.includes('canonical κατάσταση'));
for (const phrase of ['Authoritative profile', 'candidate ημερομην', 'server-side',
    'έγκυρο profile', 'canonical ρεπό', 'Αμετάβλητο ιστορικό αποφάσεων']) {
    assert.ok(!browser.includes(phrase), `visible technical phrase remains: ${phrase}`);
}
assert.ok(browser.includes('<option value="NORMAL">Κανονική ημέρα</option>'));
assert.ok(browser.includes('<option value="SIXTH">6η ημέρα</option>'));
assert.ok(browser.includes('<option value="SEVENTH">7η ημέρα</option>'));
assert.ok(browser.includes("NEEDS_HR_DECISION: 'Απαιτείται απόφαση'"));
assert.ok(browser.includes("READY: 'Ολοκληρωμένο'"));
assert.ok(browser.includes('canonicalReasonLabel(reason)'));
assert.ok(!browser.includes('escapeHtml(reason)</div>'));
assert.ok(browser.includes('canonicalDecisionTypeLabel(record.decision_type)'));
assert.ok(!browser.includes('escapeHtml(record.decision_type ||'));
assert.ok(browser.includes('formatDate(current.scope.week_start)'));
assert.ok(browser.includes('formatDate(current.scope.week_end)'));
assert.ok(browser.includes('formatDate(candidate.effective_date)'));
assert.ok(browser.includes('formatDate(row.date)'));
assert.ok(browser.includes("profile_outcome: 'USE_PROFILE'"));
assert.ok(browser.includes("['PROFILE_CHANGED_INSIDE_WEEK', 'Επιλογή προφίλ εργασίας']"));
assert.ok(browser.includes("HR: 'Υπεύθυνος Ανθρώπινου Δυναμικού'"));
assert.ok(!browser.includes("HR: 'Ανθρώπινο Δυναμικό'"));
assert.ok(!browser.includes('Απόφαση HR'));
assert.ok(!view.includes('Απόφαση HR'));
assert.ok(browser.includes("['A', 'S', 'HR']") || view.includes("['A', 'S', 'HR']"));
assert.ok(browser.includes(
    'Διαχειριστή, Επόπτη ή Υπεύθυνου Ανθρώπινου Δυναμικού'
));
assert.ok(!browser.includes('Admin, Supervisor ή HR'));

console.log('canonical decision API/workspace contract tests passed (47 contracts)');
