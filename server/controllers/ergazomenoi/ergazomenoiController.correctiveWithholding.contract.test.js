'use strict';
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const controller = fs.readFileSync(path.join(__dirname, 'ergazomenoiController.js'), 'utf8');
const addView = fs.readFileSync(path.join(__dirname,
    '../../../views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section6/diafora.ejs'), 'utf8');
const editView = fs.readFileSync(path.join(__dirname,
    '../../../views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section6/diafora.ejs'), 'utf8');
assert.match(controller, /function parseCorrectivePayrollWithholdingRate/);
assert.ok((controller.match(/formData\.corrective_payroll_withholding_rate_percent/g) || []).length >= 6);
assert.match(controller, /newErgazomenos\.corrective_payroll_withholding_rate_percent\s*=/);
assert.match(controller, /corrective_payroll_withholding_rate_percent:\s*formData\.corrective_payroll_withholding_rate_percent/);
for (const view of [addView, editView]) {
    assert.ok(view.includes('Ποσοστό παρακράτησης διορθωτικής μισθοδοσίας'));
    assert.match(view, /name="corrective_payroll_withholding_rate_percent"[^>]*min="0"[^>]*max="100"[^>]*step="0\.01"/);
}
console.log('employee corrective withholding maintenance contract: PASS');
