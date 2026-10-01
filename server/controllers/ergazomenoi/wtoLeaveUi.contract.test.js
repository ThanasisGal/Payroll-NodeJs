'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const view = fs.readFileSync(path.join(root,
    'views/ergazomenoi/programmata/ypovoliAdeion.ejs'), 'utf8');
const frontend = fs.readFileSync(path.join(root,
    'public/js/ergazomenoi/programmata/wtoLeave.js'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname, 'wtoLeaveController.js'), 'utf8');
const dataset = fs.readFileSync(path.join(root,
    'server/services/ergazomenoi/wtoLeaveDatasetService.js'), 'utf8');
const mainLayout = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');

assert.match(view, /id="wtoLeaveSubmitButton" disabled/);
const formStart = view.indexOf('<form id="wtoLeaveForm"');
const formEnd = view.indexOf('</form>', formStart);
assert.ok(formStart >= 0 && formEnd > formStart);
for (const controlId of ['wtoLeaveBranch', 'wtoLeaveFrom', 'wtoLeaveTo',
    'wtoLeavePreviewButton', 'wtoLeaveSubmitButton']) {
    const controlPosition = view.indexOf(`id="${controlId}"`, formStart);
    assert.ok(controlPosition > formStart && controlPosition < formEnd, controlId);
}
assert.ok(view.indexOf('id="wtoLeaveBranch"') < view.indexOf('id="wtoLeaveFrom"'));
assert.ok(view.indexOf('id="wtoLeaveFrom"') < view.indexOf('id="wtoLeaveTo"'));
assert.ok(view.indexOf('id="wtoLeaveTo"') < view.indexOf('id="wtoLeavePreviewButton"'));
assert.match(view, /<button[^>]*type="button"[^>]*id="wtoLeavePreviewButton"/);
assert.match(view, /<button[^>]*type="button"[^>]*id="wtoLeaveSubmitButton"/);
assert.strictEqual((mainLayout.match(/common\/moveByEnter/g) || []).length, 1);
assert.strictEqual((view.match(/common\/moveByEnter/g) || []).length, 0);
assert.ok(view.includes('z-depth-5'));
assert.ok(view.includes('card-header'));
assert.ok(view.includes('Υποβολή Αδειών'));
assert.match(view, /id="wtoLeaveCard" class="[^"]*card[^"]*d-flex[^"]*flex-column[^"]*z-depth-5[^"]*overflow-hidden[^"]*"/);
const bodyTag = view.match(/<div id="wtoLeaveCardBody"[^>]*>/)?.[0] || '';
assert.match(bodyTag, /class="[^"]*card-body[^"]*d-flex[^"]*flex-column[^"]*flex-grow-1[^"]*"/);
assert.ok(!/overflow-(?:auto|y-auto)/.test(bodyTag));
assert.match(bodyTag, /overflow:\s*hidden/);
assert.match(view, /class="date-control" type="date" id="wtoLeaveFrom"/);
assert.match(view, /class="date-control" type="date" id="wtoLeaveTo"/);
const bodyStart = view.indexOf('id="wtoLeaveCardBody"');
const resultsStart = view.indexOf('id="wtoLeaveResultsScroll"', bodyStart);
const dataPreviewStart = view.indexOf('id="wtoLeaveJson"', resultsStart);
const footerStart = view.indexOf('class="card-footer mt-auto', bodyStart);
assert.ok(bodyStart >= 0 && resultsStart > bodyStart && dataPreviewStart > resultsStart &&
    footerStart > dataPreviewStart);
assert.ok(view.includes('\n        </div>\n        <div class="card-footer mt-auto', bodyStart));
assert.match(view, /id="wtoLeaveResultsScroll"[^>]*style="[^"]*overflow-y:\s*auto;[^"]*overflow-x:\s*auto;/);
assert.match(view, /id="wtoLeaveJson"[\s\S]*?style="[^"]*max-height:[^"]*"/);
assert.match(view, /id="wtoLeaveActualRange" style="white-space:\s*nowrap;"/);
assert.match(view, /id="wtoLeaveSummary"[\s\S]*?<div class="col-4">[\s\S]*?<div class="col-2">[\s\S]*?<div class="col-3">[\s\S]*?<div class="col-3">/);
assert.ok(view.includes('Τελική Υποβολή Αδειών στο ΕΡΓΑΝΗ'));
assert.ok(view.includes('Αναλυτικές εγγραφές'));
assert.ok(view.includes('Δεδομένα προς υποβολή'));
assert.ok(view.includes('Ημέρες αδειών'));
assert.ok(!view.includes('Analytics:'));
assert.ok(!view.includes('JSON preview'));
assert.ok(!view.includes('payload'));
assert.ok(!frontend.includes('Analytics records'));
assert.ok(!frontend.includes('Ημέρες εργαζομένων'));
assert.ok(!frontend.includes('επιλέξιμο payload'));
assert.ok(!frontend.includes('με το payload'));
assert.ok(frontend.includes('Η ενέργεια θα πραγματοποιήσει οριστική υποβολή αδειών στο ΕΡΓΑΝΗ.'));
assert.ok(frontend.includes("data.idempotent === true"));
assert.ok(frontend.includes("title: 'Ήδη υποβλημένο'"));
assert.ok(frontend.includes('Η συγκεκριμένη υποβολή αδειών έχει ήδη ολοκληρωθεί στο ΕΡΓΑΝΗ.'));
assert.ok(frontend.includes('Δεν πραγματοποιήθηκε νέα υποβολή.'));
assert.ok(frontend.includes("escapeHtml(data.protocol || '—')"));
assert.ok(frontend.includes('window.ErganiRestSubmissionUi.presentSubmissionResultSafely({'));
assert.ok(frontend.includes("processDescription: 'Οργάνωση Χρόνου Εργασίας - Άδειες'"));
assert.ok(frontend.includes("'/api/ergazomenoi/programmata/wto-leave/preview'"));
assert.ok(frontend.includes("'/api/ergazomenoi/programmata/wto-leave/submit'"));
assert.ok(frontend.includes("'x-csrf-token': token"));
assert.ok(frontend.includes('data.parity?.exact'));
assert.ok(frontend.includes('function formatGreekDate(value)'));
assert.ok(frontend.includes('escapeHtml(formatGreekDate(row.date))'));
assert.ok(frontend.includes('function syncWtoLeaveCardHeight()'));
assert.ok(frontend.includes("document.querySelector('.footer')"));
assert.ok(frontend.includes('const footerClearance = 25'));
assert.ok(frontend.includes("window.addEventListener('resize', scheduleWtoLeaveCardHeightSync)"));
assert.ok(frontend.includes("document.addEventListener('DOMContentLoaded', initWtoLeaveLayout"));
assert.ok(frontend.indexOf('result.isConfirmed') < frontend.indexOf("'/api/ergazomenoi/programmata/wto-leave/submit'"));
assert.ok(controller.includes("submissionCode: 'WTOLeave'"));
assert.ok(controller.includes('assertBrowserInput(req.body, { submit: true })'));
assert.ok(controller.includes('function getWtoLeavePdfRoute(id)'));
assert.ok(controller.includes('pdfSaved: hasWtoLeavePdf(record)'));
assert.ok(!controller.includes('pdfUrl: existing.pdf_s3_url'));
assert.ok(!controller.includes('pdfUrl: record.pdf_s3_url'));
const commonUiScript = "script('ergazomenoi/genika/erganiRestSubmissionUi')";
const wtoLeaveScript = "script('ergazomenoi/programmata/wtoLeave.js')";
assert.ok(view.includes(commonUiScript));
assert.ok(view.indexOf(commonUiScript) < view.indexOf(wtoLeaveScript));
assert.ok(dataset.includes('ProdhlomenaOrariaModel'));
assert.ok(!dataset.includes('ApasxolhseisModel'));
assert.ok(!/\son[a-z]+\s*=/.test(view));

console.log('PASS WTOLeave UI confirmation, preview gating, CSRF and authoritative source contract');
