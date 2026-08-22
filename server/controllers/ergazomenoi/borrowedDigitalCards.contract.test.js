'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const root = path.resolve(__dirname, '..', '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const routes = read('server/routes/usersRoute.js');
const controller = read('server/controllers/ergazomenoi/erganhController.js');
const service = read('server/services/ergazomenoi/daneizomenoiProdhlomenaOrariaUpdateService.js');
const policy = read('server/services/ergazomenoi/prodhlomenaOrariaCardsPolicy.js');
const frontend = read('public/js/ergazomenoi/programmata/updateBorrowedDigitalCards.js');
const viewPath = path.join(root, 'views/ergazomenoi/programmata/lhpshPshfiakonKartonMonoDaneizomenon.ejs');
const view = fs.readFileSync(viewPath, 'utf8');

ejs.compile(view, { filename: viewPath });
assert.ok(view.includes('Ενημέρωση Ψηφιακών Καρτών από Δανειζόμενη Εταιρεία'));
assert.ok(view.includes('target_ypokatasthma'));
assert.ok(view.includes('source_ypokatasthma'));
assert.ok(view.includes('data-dropdown-direction="down"'));
assert.ok(frontend.includes('θα πρέπει να έχει ήδη γίνει από τη Δανειζόμενη Εταιρεία'));
assert.ok(frontend.includes('ενημερώνει μόνο τις Ψηφιακές Κάρτες της Δανείζουσας Εταιρείας'));
assert.ok(frontend.includes('/ergazomenoi/programmata/borrowed-card-source-branches'));
assert.ok(frontend.includes('/ergazomenoi/programmata/updatePshfiakesKartesMonoDaneizomenon'));
assert.ok(routes.includes("requireUserPrivilegeAction('LhpshPshfiakonKartonMonoDaneizomenon', 'update')"));
assert.ok(controller.includes('updateBorrowedEmployeeDigitalCards({'));
assert.ok(service.includes('sourceFields: DIGITAL_CARD_FIELDS'));
assert.ok(service.includes('buildUpdate: buildDigitalCardsUpdate'));
assert.ok(service.includes('upsert: false'));
for (const field of ['cards_apo_ora_01', 'cards_eos_ora_01', 'cards_apo_ora_02',
    'cards_eos_ora_02', 'cards_apo_ora_03', 'cards_eos_ora_03',
    'cards_ores_ergasias', 'check_ergasia']) assert.ok(policy.includes(field));
for (const forbidden of ['kathgoria_ergasias', 'apo_ora_01_apologistika',
    'ores_ergasias_apologistika', 'repo_apologistika']) assert.ok(!policy.includes(forbidden));
assert.ok(!service.includes('downloadCards'));
assert.ok(!service.includes('lhpshOrarionApoKartes'));

console.log('PASS borrowed digital cards internal-only contract');
