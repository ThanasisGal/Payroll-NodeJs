'use strict';
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
for (const text of ['Πληροφορίες οριακών εβδομάδων', 'Χρειάζεται επιλογή ρεπό',
    'Επιλογή ρεπό', 'Έλεγχος αλλαγής ρεπό', 'Ημερομηνία', 'Προδηλωμένο', 'Κάρτα',
    'Πριν', 'Μετά', 'Μήνας', 'Η οριστικοποιημένη μισθοδοσία δεν αλλάζει.',
    'Από προηγούμενο μήνα', 'Προς επόμενο μήνα', 'Αλλαγή επιλογής', 'Ακύρωση'])
    assert.ok(source.includes(text), `missing UI contract: ${text}`);
const method = source.slice(source.indexOf('async function previewDeferredCrossPeriodRepoResolution'),
    source.indexOf('function stage2LifecycleClassificationLabel'));
const boundaryTable = source.slice(source.indexOf('function renderDeferredWeekGroups'),
    source.indexOf('async function previewDeferredCrossPeriodRepoResolution'));
assert.match(method, /deferred-cross-period\/preview/); assert.match(method, /deferred-cross-period\/resolve/);
assert.doesNotMatch(method, /submitFinalWTODayilyA|period-control\/submission\/final/);
assert.ok(!source.includes('deferred-cross-period-persistent-panel'));
assert.match(source, /entry\.resolution_status === 'REQUIRED'[\s\S]*data-deferred-repo-resolve/);
assert.match(source, /Δεν χρειάζεται ενέργεια/);
assert.match(method, /day\.current_accounting/); assert.match(method, /day\.proposed_accounting/);
assert.doesNotMatch(method, /<pre>|JSON\.stringify\([^)]*preview|Επιλογή SOURCE|πραγματικού ρεπό \(TARGET\)|Ρητή επιβεβαίωση επίλυσης|Υπολογισμός προεπισκόπησης|['"]Cancel['"]/);
assert.ok(method.indexOf('Προαιρετική σημείωση') > method.indexOf('Έλεγχος αλλαγής ρεπό'));
assert.match(source, /NO_VALID_REST_DAY/); assert.match(source, /ERGANI_CORRECTION_REQUIRED/);
assert.match(boundaryTable, /<th class="text-center">Κωδικός<\/th>/);
assert.doesNotMatch(boundaryTable, /<th>Εργαζόμενος<\/th>/);
assert.match(boundaryTable, /const hasAction = rows\.some/);
assert.match(boundaryTable, /hasAction \? '<th class="text-center">Ενέργεια<\/th>' : ''/);
const css = fs.readFileSync(path.join(__dirname, '../../../css/main.css'), 'utf8');
assert.match(css, /\.employment-review-action-btn\s*\{[\s\S]*?white-space:\s*nowrap[\s\S]*?min-width:\s*max-content/);
assert.match(css, /\.employment-review-boundary-table th,[\s\S]*?white-space:\s*nowrap/);
assert.match(css, /\.employment-review-boundary-table \.employment-review-boundary-week[\s\S]*?white-space:\s*nowrap/);
console.log('deferred cross-period UI contracts passed');
