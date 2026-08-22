'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const root = path.resolve(__dirname, '..', '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const routes = read('server/routes/usersRoute.js');
const controller = read('server/controllers/ergazomenoi/erganhController.js');
const service = read('server/services/ergazomenoi/daneizomenoiProdhlomenaOrariaUpdateService.js');
const viewPath = path.join(root,
    'views/ergazomenoi/programmata/lhpshProdhlomenonOrarionMonoDaneizomenon.ejs');
const view = fs.readFileSync(viewPath, 'utf8');
const frontend = read('public/js/ergazomenoi/programmata/updateBorrowedDeclaredSchedules.js');
const middleware = read('server/middlewares/programmataAccessScope.js');

ejs.compile(view, { filename: viewPath });
assert.ok(view.includes('Ενημέρωση Ωραρίων από Δανειζόμενη Εταιρεία'));
assert.ok(view.includes('> Ενημέρωση'));
assert.ok(!view.includes('downloadScheduleButton'));
assert.ok(!frontend.includes('/ergazomenoi/programmata/downloadSchedule'));
assert.ok(frontend.includes('/ergazomenoi/programmata/updateProdhlomenaOrariaMonoDaneizomenon'));
assert.ok(frontend.includes('/ergazomenoi/programmata/borrowed-source-branches'));
assert.ok(view.includes('Παράρτημα Δανείζουσας Εταιρείας'));
assert.ok(view.includes('Παράρτημα Δανειζόμενης Εταιρείας'));
assert.ok(view.includes('id="target_ypokatasthma"'));
assert.ok(view.includes('id="source_ypokatasthma"'));
assert.ok(view.includes('data-dropdown-direction="down"'));
assert.ok(view.includes('borrowed-schedule-card-body'));
assert.ok(!view.includes('card-body overflow-auto flex-grow-1 height-vh-31'));
assert.ok(frontend.includes(
    'Η άντληση των δεδομένων από το ΕΡΓΑΝΗ ΙΙ θα πρέπει να έχει γίνει από την Δανειζόμενη Εταιρεία.'
));
assert.ok(frontend.includes(
    'Με την παρούσα ενέργεια θα γίνει μόνο ενημέρωση των Προδηλωμένων Ωραρίων της Δανείζουσας Εταιρείας.'
));
assert.ok(frontend.includes("confirmButtonText: 'Το κατάλαβα'"));
assert.ok(frontend.includes('allowOutsideClick: false'));
assert.ok(frontend.includes('allowEscapeKey: false'));
assert.ok(!/localStorage|sessionStorage/.test(frontend));

assert.ok(routes.includes("requireUserPrivilegeAction('LhpshProdhlomenonOrarionMonoDaneizomenon', 'read')"));
assert.ok(routes.includes("requireUserPrivilegeAction('LhpshProdhlomenonOrarionMonoDaneizomenon', 'update')"));
assert.ok(routes.includes('authorizeBorrowedDeclaredScheduleUpdate'));
assert.ok(controller.includes('updateBorrowedEmployeeDeclaredSchedules({'));
assert.ok(controller.includes('team: scope.effectiveTeam'));
assert.ok(controller.includes('company_kod: scope.companyId'));
assert.ok(controller.includes('target_ypokatasthma: scope.target_ypokatasthma'));
assert.ok(controller.includes('source_ypokatasthma: scope.source_ypokatasthma'));
assert.ok(controller.includes('companykod_object: scope.sourceCompanyId'));
assert.ok(middleware.includes('resolveBorrowedSourceContext({'));
assert.ok(middleware.includes('req.query?.sourceCompanyId !== undefined'));
assert.ok(middleware.includes('req.body?.sourceCompanyId !== undefined'));
assert.ok(!frontend.includes('sourceCompanyId:'));
assert.ok(!service.includes('downloadSchedule'));
assert.ok(!service.includes('processOrariaXlsx'));
assert.ok(!service.includes('fetch('));
assert.ok(!service.includes('deleteMany'));
assert.ok(!service.includes('deleteOne'));
assert.ok(!service.includes('.save('));
assert.ok(service.includes('bulkWrite('));

console.log('PASS borrowed declared schedules page/routes/internal-only service contract');
