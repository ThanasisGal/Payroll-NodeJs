const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) =>
    fs.readFileSync(path.join(root, relativePath), 'utf8');

const model = read('server/models/ergazomenoi.js');
const controller = read('server/controllers/ergazomenoi/ergazomenoiController.js');
const addForm = read(
    'views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section6/diafora.ejs'
);
const editForm = read(
    'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section6/diafora.ejs'
);
const payrollUi = read('public/js/kinhseis/apasxolhseis/apasxolhseis.js');

assert.ok(
    model.match(/pososto_prosayxhshs_6hs_hmeras:\s*\{\s*type:\s*Number,\s*min:\s*0/s)
        ?.length >= 1
);
for (const form of [addForm, editForm]) {
    assert.ok(form.includes('Προσαύξηση 6ης Ημέρας (%)'));
    assert.ok(form.includes('min="0"'));
    assert.ok(form.includes('step="0.01"'));
    assert.ok(form.includes('required'));
}
assert.ok(addForm.includes('value="40"'));
assert.ok(controller.includes('MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE'));
assert.ok(controller.includes('defaultForNew: true'));
assert.ok(
    payrollUi.includes(
        'sharedParams.ergazomenoi.pososto_prosayxhshs_6hs_hmeras'
    )
);
assert.ok(!payrollUi.includes('sharedParams.genikesParametroi[16].timh'));

console.log('SEPE weekly employee premium field/UI contract tests passed');
