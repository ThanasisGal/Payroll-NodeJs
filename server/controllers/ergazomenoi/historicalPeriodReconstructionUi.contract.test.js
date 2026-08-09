'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const view = fs.readFileSync(path.join(root,
    'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const frontend = fs.readFileSync(path.join(root,
    'public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const controller = fs.readFileSync(path.join(root,
    'server/controllers/ergazomenoi/erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'server/routes/usersRoute.js'), 'utf8');

for (const text of [
    'Ανακατασκευή Εκπρόθεσμης Περιόδου',
    'Επανεκτίμηση Ανακατασκευασμένης Περιόδου',
    'ΑΝΑΚΑΤΑΣΚΕΥΑΣΜΕΝΗ ΕΚΠΡΟΘΕΣΜΗ ΠΕΡΙΟΔΟΣ',
    'ΕΚΠΡΟΘΕΣΜΗ — ΧΩΡΙΣ ΟΡΙΣΤΙΚΟΠΟΙΗΜΕΝΟ BASELINE',
    'ΕΝΤΟΣ ΠΡΟΘΕΣΜΙΑΣ'
]) assert.ok(`${view}\n${frontend}`.includes(text), `missing UI contract: ${text}`);
assert.ok(frontend.includes('historical_reconstruction_request_id: requestId'));
assert.ok(frontend.includes("popup: 'historical-reconstruction-swal'"));
assert.ok(frontend.includes("input: 'historical-reconstruction-swal__reason'"));
assert.ok(frontend.includes("inputValidator: value => String(value || '').trim()"));
assert.ok(frontend.includes("'/ergazomenoi/programmata/calcApasxolhseisPeriodoy'"));
assert.ok(controller.includes('completeHistoricalReconstruction'));
assert.ok(controller.includes('failHistoricalReconstruction'));
assert.ok(controller.includes("['NORMAL', 'HISTORICAL_RECONSTRUCTED'].includes(state.effective_mode)"));
assert.ok(controller.includes("errorCode: error?.code || 'HISTORICAL_RECONSTRUCTION_CALCULATION_FAILED'"));
assert.ok(controller.includes('assertCriticalEmploymentDecisionRole(req.session)'));
assert.ok(routes.includes('/period-control/historical-reconstruction/authorize'));
assert.ok(routes.includes('requireCriticalEmploymentDecisionRole'));
assert.ok(!frontend.includes('unlock finalized period'));

console.log('historical period reconstruction UI/runtime wiring contract: PASS');
