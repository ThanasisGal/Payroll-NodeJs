'use strict';
const assert = require('assert'); const ejs = require('ejs'); const fs = require('fs'); const path = require('path');
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
    assert.ok(view.includes('Ποσοστό Παρακράτησης εις Χείρας Τρίτων'));
    assert.match(view, /name="corrective_payroll_withholding_rate_percent"[^>]*min="0"[^>]*max="100"[^>]*step="0\.01"/);
    assert.match(view, /<div class="col-3 left-align">\s*<label for="corrective_payroll_withholding_rate_percent"/);
    assert.match(view, /name="symfonhtheis_misthos_genikos"[\s\S]*?<div class="col-3"><\/div>\s*<div class="col-3 left-align">\s*<label for="symfonhtheis_misthos_apasxolhseis"/);
}
const renderedValue = (view, rec) => {
    const rendered = ejs.render(view, { rec });
    return rendered.match(/name="corrective_payroll_withholding_rate_percent"[^>]*value="([^"]*)"/)[1];
};
assert.strictEqual(renderedValue(addView), '0.00');
assert.strictEqual(renderedValue(editView), '0.00');
assert.strictEqual(renderedValue(editView, { corrective_payroll_withholding_rate_percent: null }), '0.00');
assert.strictEqual(renderedValue(editView, { corrective_payroll_withholding_rate_percent: '' }), '0.00');
assert.strictEqual(renderedValue(editView, { corrective_payroll_withholding_rate_percent: 0 }), '0.00');
assert.strictEqual(renderedValue(editView, { corrective_payroll_withholding_rate_percent: 5 }), '5.00');
assert.strictEqual(renderedValue(editView, { corrective_payroll_withholding_rate_percent: 17.2 }), '17.20');
assert.strictEqual(renderedValue(editView, { corrective_payroll_withholding_rate_percent: 17.25 }), '17.25');
console.log('employee corrective withholding maintenance contract: PASS');
