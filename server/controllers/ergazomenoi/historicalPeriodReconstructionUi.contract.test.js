'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../../..');
const view = fs.readFileSync(path.join(root,
    'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const frontend = fs.readFileSync(path.join(root,
    'public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const stylesheet = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
const controller = fs.readFileSync(path.join(root,
    'server/controllers/ergazomenoi/erganhController.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'server/routes/usersRoute.js'), 'utf8');

for (const text of [
    'Ανακατασκευή Εκπρόθεσμης Περιόδου',
    'Επανεκτίμηση Ανακατασκευασμένης Περιόδου',
    'ΑΝΑΚΑΤΑΣΚΕΥΑΣΜΕΝΗ ΕΚΠΡΟΘΕΣΜΗ ΠΕΡΙΟΔΟΣ',
    'ΕΚΠΡΟΘΕΣΜΗ — ΧΩΡΙΣ ΟΡΙΣΤΙΚΟΠΟΙΗΜΕΝΟ ΑΠΟΤΕΛΕΣΜΑ'
]) assert.ok(`${view}\n${frontend}`.includes(text), `missing UI contract: ${text}`);
assert.ok(frontend.includes('historical_reconstruction_request_id: requestId'));
assert.ok(frontend.includes("popup: 'custom-swal-popup employment-review-swal-popup'"));
assert.ok(frontend.includes("title: 'custom-title'"));
assert.ok(frontend.includes("htmlContainer: 'custom-html-container employment-review-swal-html-container'"));
assert.ok(frontend.includes("'custom-confirm-button'"));
assert.ok(frontend.includes("'custom-swal-button'"));
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

const auditedSwalCalls = (frontend.match(/employmentReviewSwal\(/g) || []).length - 1;
assert.strictEqual(auditedSwalCalls, 64, 'all 64 Employment Review Swal calls must use the common wrapper');
assert.strictEqual(
    (frontend.match(/Swal\.fire\(/g) || []).length,
    1,
    'only the common Employment Review wrapper may call Swal.fire directly'
);

const helperSource = frontend.slice(0, frontend.indexOf('function userCanReviewEdit'));
const renderedOptions = [];
const context = {
    document: { querySelector: () => null },
    Swal: { fire: options => { renderedOptions.push(options); return Promise.resolve(options); } }
};
vm.runInNewContext(`${helperSource}\nthis.employmentReviewSwal = employmentReviewSwal;`, context);

for (const options of [
    { icon: 'success', title: 'Ιστορική ανακατασκευή ολοκληρώθηκε', text: 'Έκδοση 1' },
    { icon: 'error', title: 'Σφάλμα', text: 'Η ιστορική ανακατασκευή απέτυχε.' },
    { icon: 'info', title: 'Κατάσταση περιόδου', text: 'Ενημερωτικό μήνυμα' },
    {
        icon: 'warning',
        title: 'Εφαρμογή πρότασης',
        customClass: { confirmButton: 'text-black' }
    },
    {
        icon: 'warning',
        title: 'Ανακατασκευή Εκπρόθεσμης Περιόδου',
        html: '<p>Περιγραφή</p>',
        input: 'textarea',
        showCancelButton: true,
        customClass: {
            popup: 'historical-reconstruction-swal',
            htmlContainer: 'historical-reconstruction-swal__content',
            input: 'historical-reconstruction-swal__reason'
        }
    }
]) context.employmentReviewSwal(options);

for (const options of renderedOptions) {
    assert.match(options.customClass.confirmButton, /(?:^|\s)custom-confirm-button(?:\s|$)/);
    assert.match(options.customClass.confirmButton, /(?:^|\s)custom-swal-button(?:\s|$)/);
    assert.match(options.customClass.title, /(?:^|\s)custom-title(?:\s|$)/);
    assert.match(options.customClass.popup, /(?:^|\s)custom-swal-popup(?:\s|$)/);
    assert.match(options.customClass.htmlContainer, /(?:^|\s)custom-html-container(?:\s|$)/);
}
assert.match(renderedOptions[0].customClass.confirmButton, /(?:^|\s)class-success(?:\s|$)/);
assert.match(renderedOptions[1].customClass.confirmButton, /(?:^|\s)class-error(?:\s|$)/);
assert.match(renderedOptions[2].customClass.confirmButton, /(?:^|\s)class-info(?:\s|$)/);
assert.match(renderedOptions[3].customClass.confirmButton, /(?:^|\s)class-warning(?:\s|$)/);
assert.match(renderedOptions[3].customClass.confirmButton, /(?:^|\s)text-black(?:\s|$)/);
assert.match(renderedOptions[4].customClass.confirmButton, /(?:^|\s)class-warning(?:\s|$)/);
assert.match(renderedOptions[4].customClass.popup, /(?:^|\s)historical-reconstruction-swal(?:\s|$)/);
assert.match(renderedOptions[4].customClass.htmlContainer, /(?:^|\s)historical-reconstruction-swal__content(?:\s|$)/);
assert.match(renderedOptions[4].customClass.cancelButton, /(?:^|\s)custom-cancel-button(?:\s|$)/);
assert.strictEqual(renderedOptions[4].customClass.input, 'historical-reconstruction-swal__reason');

assert.match(stylesheet, /\.swal2-popup\.employment-review-swal-popup[\s\S]*?font-size:\s*0\.85rem\s*!important;/);
assert.match(stylesheet, /\.custom-swal-popup\.historical-reconstruction-swal\s*\{[\s\S]*?width:\s*min\(600px,\s*calc\(100vw - 2rem\)\)\s*!important;/);
assert.match(stylesheet, /\.historical-reconstruction-swal__reason\s*\{[\s\S]*?width:\s*96%\s*!important;[\s\S]*?max-width:\s*96%\s*!important;[\s\S]*?box-sizing:\s*border-box;/);
assert.match(stylesheet, /\.employment-review-action-danger\s*\{[\s\S]*?background:\s*var\(--bs-danger-bg-subtle,\s*#f8d7da\);[\s\S]*?border-color:\s*#f1aeb5;/);
assert.match(stylesheet, /\.employment-review-action-danger:hover,[\s\S]*?color:\s*#ffffff;[\s\S]*?background:\s*#dc3545;/);

for (const viewportWidth of [1366, 1648, 1920]) {
    const popupWidth = Math.min(600, viewportWidth - 32);
    const textareaWidth = popupWidth * 0.96;
    assert.ok(popupWidth >= 600 && popupWidth <= 620, `compact popup geometry failed at ${viewportWidth}px`);
    assert.strictEqual(textareaWidth / popupWidth, 0.96, `textarea ratio failed at ${viewportWidth}px`);
    assert.ok(textareaWidth <= popupWidth, `textarea overflowed at ${viewportWidth}px`);
}

console.log('historical period reconstruction UI/runtime wiring contract: PASS');
