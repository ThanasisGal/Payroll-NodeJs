'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const routes = fs.readFileSync(path.join(__dirname, 'usersRoute.js'), 'utf8');

const contracts = [
    ['GET', '/ergazomenoi/programmata/programmaErgasias', "requireUserPrivilegeAction('SynthrhshProgrammatosErgasias', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/ergazomenoi/programmata/antigrafhProgrammaton', "requireUserPrivilegeAction('SynthrhshProgrammatosErgasias', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/api/getAllErgazomenoi/:selectedTeam/:selectedCompany', "requireUserPrivilegeAction('SynthrhshProgrammatosErgasias', 'read')", 'authorizeProgrammataList'],
    ['GET', '/api/getErgazomeno/:selectedTeam/:selectedCompany/:selectedKodikos', "requireUserPrivilegeAction('SynthrhshProgrammatosErgasias', 'read')", 'authorizeProgrammataEmployee'],
    ['POST', '/api/ergazomenoi/programmata/update/:selectedTeam/:selectedCompany/:selectedKodikos', "requireUserPrivilegeAction('SynthrhshProgrammatosErgasias', 'update')", 'authorizeProgrammataUpdate'],
    ['DELETE', '/ergazomenoi/programmata/delete/:selectedTeam/:selectedCompany/:selectedKodikos/:startDate/:endDate', "requireUserPrivilegeAction('SynthrhshProgrammatosErgasias', 'delete')", 'authorizeProgrammataDelete'],
    ['POST', '/ergazomenoi/programmata/copy', "requireUserPrivilegeAnyAction('SynthrhshProgrammatosErgasias', ['create', 'update'])", 'authorizeProgrammataCopy'],
    ['POST', '/api/ergazomenoi/programmata/getOraria', "requireUserPrivilegeAction('SynthrhshProgrammatosErgasias', 'update')", 'authorizeGetOraria'],
    ['GET', '/ergazomenoi/programmata/lhpshOrarionApoErganh', "requireUserPrivilegeAction('LhpshOrarionApoErganh', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/ergazomenoi/programmata/lhpshProdhlomenonOrarionMonoDaneizomenon', "requireUserPrivilegeAction('LhpshProdhlomenonOrarionMonoDaneizomenon', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/ergazomenoi/programmata/borrowed-source-branches', "requireUserPrivilegeAction('LhpshProdhlomenonOrarionMonoDaneizomenon', 'read')", 'authorizeBorrowedSourceBranches'],
    ['POST', '/ergazomenoi/programmata/updateProdhlomenaOrariaMonoDaneizomenon', "requireUserPrivilegeAction('LhpshProdhlomenonOrarionMonoDaneizomenon', 'update')", 'authorizeBorrowedDeclaredScheduleUpdate'],
    ['POST', '/ergazomenoi/programmata/downloadSchedule', "requireUserPrivilegeAction('LhpshOrarionApoErganh', 'update')", 'authorizeProgrammataExternalAction'],
    ['GET', '/ergazomenoi/programmata/lhpshOrarionApoKartes', "requireUserPrivilegeAction('LhpshOrarionApoKartes', 'read')", 'authorizeProgrammataSessionCompany'],
    ['POST', '/ergazomenoi/programmata/downloadCards', "requireUserPrivilegeAction('LhpshOrarionApoKartes', 'update')", 'authorizeProgrammataExternalAction'],
    ['POST', '/ergazomenoi/programmata/wtoApologistiko', "requireUserPrivilegeAction('ApologistikosPinakasOrarion', 'export')", 'authorizeProgrammataExternalAction'],
    ['POST', '/ergazomenoi/programmata/wtoApologistikoYperorion', "requireUserPrivilegeAction('ApologistikosPinakasYperorion', 'export')", 'authorizeProgrammataExternalAction'],
    ['POST', '/ergazomenoi/programmata/delete-pdf', "requireUserPrivilegeAction('LhpshOrarionApoKartes', 'delete')", 'validatePdfDelete'],
    ['GET', '/ergazomenoi/programmata/exagoghOrarionSeErganh', "requireUserPrivilegeAction('ExagoghOrarionSeErganh', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/ergazomenoi/programmata/apologistikosPinakasOrarion', "requireUserPrivilegeAction('ApologistikosPinakasOrarion', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/ergazomenoi/programmata/apologistikosPinakasYperorion', "requireUserPrivilegeAction('ApologistikosPinakasYperorion', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/ergazomenoi/programmata/calcApasxolhseisPeriodoy', "requireUserPrivilegeAction('ElegxosApasxolhseonPeriodoy', 'read')", 'authorizeProgrammataSessionCompany'],
    ['POST', '/ergazomenoi/programmata/calcApasxolhseisPeriodoy', "requireUserPrivilegeAction('ElegxosApasxolhseonPeriodoy', 'update')", 'authorizeProgrammataCalculation'],
    ['GET', '/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy', "requireUserPrivilegeAction('ElegxosApasxolhseonPeriodoy', 'read')", 'authorizeProgrammataSessionCompany']
];

for (const [method, route, privilege, scope] of contracts) {
    const start =
        method === 'POST' && route === '/ergazomenoi/programmata/calcApasxolhseisPeriodoy'
            ? routes.lastIndexOf(`'${route}'`)
            : routes.indexOf(`'${route}'`);
    assert.ok(start >= 0, `${method} ${route}: route missing`);
    const block = routes.slice(start, start + 500);
    assert.ok(block.includes(privilege), `${method} ${route}: action privilege middleware missing`);
    assert.ok(block.includes(scope), `${method} ${route}: scope middleware missing`);
}

const borrowedGetStart = routes.indexOf("'/ergazomenoi/programmata/lhpshProdhlomenonOrarionMonoDaneizomenon'");
const borrowedGetBlock = routes.slice(borrowedGetStart, routes.indexOf('router.', borrowedGetStart + 10));
assert.ok(borrowedGetBlock.includes('mainLhpshProdhlomenonOrarionMonoDaneizomenonForm'));
assert.ok(!borrowedGetBlock.includes('sendStatus(501)'));
const borrowedPostStart = routes.indexOf("'/ergazomenoi/programmata/updateProdhlomenaOrariaMonoDaneizomenon'");
const borrowedPostBlock = routes.slice(borrowedPostStart, routes.indexOf('router.', borrowedPostStart + 10));
assert.ok(borrowedPostBlock.includes('updateProdhlomenaOrariaMonoDaneizomenon'));
assert.ok(!borrowedPostBlock.includes('authorizeProgrammataExternalAction'));
assert.ok(!borrowedPostBlock.includes('lhpshOrarionApoErganh'));
assert.ok(!borrowedPostBlock.includes('processOrariaXlsx'));

console.log(`PASS programmata route security contract (${contracts.length} sensitive routes)`);
