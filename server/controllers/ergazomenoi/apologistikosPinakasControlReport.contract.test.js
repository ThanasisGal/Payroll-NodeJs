'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const viewPath = 'views/ergazomenoi/programmata/katastashElegxouApologistikouPinaka.ejs';
const view = read(viewPath); const frontend = read('public/js/ergazomenoi/programmata/katastashElegxouApologistikouPinaka.js');
const controller = read('server/controllers/ergazomenoi/apologistikosPinakasControlReportController.js');
ejs.compile(view, { filename: path.join(root, viewPath) });
const rendered = ejs.render(view, {
    locals: { title: 'Κατάσταση Ελέγχου Απολογιστικού Πίνακα', description: 'Web Payroll Solutions' },
    userPrivileges: { export: true }, periodRec: { apo: '2026-08-01', eos: '2026-08-31' },
    companyId: 'current-company-id', rec: {}, script: (value) => `/js/${value}.js`
}, { filename: path.join(root, viewPath) });
assert.ok(rendered.includes('data-api="/api/dropdown/erganh/ypokatasthmata?company=current-company-id"'));
for (const label of ['Από Ημερομηνία', 'Έως Ημερομηνία', 'Παράρτημα', 'Έλεγχος σε PDF', 'Επιστροφή']) assert.ok(view.includes(label));
assert.ok(!view.includes('Εργαζόμενος')); assert.ok(!view.includes('reviewEmployee'));
assert.ok(view.includes('id="ypokatasthma"')); assert.ok(view.includes('id="ypokatasthma_stathera_advanced"'));
assert.ok(view.includes('data-target-input="ypokatasthma_stathera_advanced"'));
assert.ok(view.includes('/api/dropdown/erganh/ypokatasthmata?company=<%= companyId || \'\' %>'));
assert.ok(!view.includes('companyInUse'));
assert.ok(frontend.includes('new URLSearchParams')); assert.ok(frontend.includes("'_blank', 'noopener'"));
assert.ok(!frontend.includes('company_kod')); assert.ok(!frontend.includes('team'));
assert.ok(controller.includes('team: req.session.userTeam')); assert.ok(controller.includes('company_kod: req.session.companyInUse'));
assert.ok(controller.includes('reportService.loadCompanyName(scope)'));
assert.ok(!controller.includes('req.query.companyName')); assert.ok(!controller.includes('req.body.companyName'));
assert.ok(controller.includes("'Content-Type', 'application/pdf'")); assert.ok(controller.includes("'Content-Disposition', 'inline;"));
console.log('PASS accounting control page, frontend and controller contract');
