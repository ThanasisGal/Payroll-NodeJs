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

assert.match(view, /id="wtoLeaveSubmitButton" disabled/);
assert.ok(view.includes('Τελική Υποβολή Αδειών στο ΕΡΓΑΝΗ'));
assert.ok(view.includes('JSON preview'));
assert.ok(frontend.includes('Η ενέργεια θα πραγματοποιήσει οριστική REST υποβολή WTOLeave στο ΕΡΓΑΝΗ.'));
assert.ok(frontend.includes("'/api/ergazomenoi/programmata/wto-leave/preview'"));
assert.ok(frontend.includes("'/api/ergazomenoi/programmata/wto-leave/submit'"));
assert.ok(frontend.includes("'x-csrf-token': token"));
assert.ok(frontend.includes('data.parity?.exact'));
assert.ok(frontend.indexOf('result.isConfirmed') < frontend.indexOf("'/api/ergazomenoi/programmata/wto-leave/submit'"));
assert.ok(controller.includes("submissionCode: 'WTOLeave'"));
assert.ok(controller.includes('assertBrowserInput(req.body, { submit: true })'));
assert.ok(dataset.includes('ProdhlomenaOrariaModel'));
assert.ok(!dataset.includes('ApasxolhseisModel'));
assert.ok(!/\son[a-z]+\s*=/.test(view));

console.log('PASS WTOLeave UI confirmation, preview gating, CSRF and authoritative source contract');
