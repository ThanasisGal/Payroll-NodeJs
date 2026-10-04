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
    ['GET', '/ergazomenoi/programmata/lhpshPshfiakonKartonMonoDaneizomenon', "requireUserPrivilegeAction('LhpshPshfiakonKartonMonoDaneizomenon', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/ergazomenoi/programmata/borrowed-card-source-branches', "requireUserPrivilegeAction('LhpshPshfiakonKartonMonoDaneizomenon', 'read')", 'authorizeBorrowedSourceBranches'],
    ['POST', '/ergazomenoi/programmata/updatePshfiakesKartesMonoDaneizomenon', "requireUserPrivilegeAction('LhpshPshfiakonKartonMonoDaneizomenon', 'update')", 'authorizeBorrowedDeclaredScheduleUpdate'],
    ['POST', '/ergazomenoi/programmata/downloadCards', "requireUserPrivilegeAction('LhpshOrarionApoKartes', 'update')", 'authorizeProgrammataExternalAction'],
    ['POST', '/ergazomenoi/programmata/wtoApologistiko', "requireUserPrivilegeAction('ApologistikosPinakasOrarion', 'export')", 'authorizeProgrammataExternalAction'],
    ['POST', '/ergazomenoi/programmata/wtoApologistikoYperorion', "requireUserPrivilegeAction('ApologistikosPinakasYperorion', 'export')", 'authorizeProgrammataSessionCompany'],
    ['POST', '/ergazomenoi/programmata/delete-pdf', "requireUserPrivilegeAction('LhpshOrarionApoKartes', 'delete')", 'validatePdfDelete'],
    ['GET', '/ergazomenoi/programmata/exagoghOrarionSeErganh', "requireUserPrivilegeAction('ExagoghOrarionSeErganh', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/ergazomenoi/programmata/apologistikosPinakasOrarion', "requireUserPrivilegeAction('ApologistikosPinakasOrarion', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/ergazomenoi/programmata/ypovoliAdeion', "requireUserPrivilegeAction('YpobolhAdeion', 'read')", 'authorizeProgrammataSessionCompany'],
    ['POST', '/api/ergazomenoi/programmata/wto-leave/preview', "requireUserPrivilegeAction('YpobolhAdeion', 'read')", 'authorizeProgrammataSessionCompany'],
    ['POST', '/api/ergazomenoi/programmata/wto-leave/submit', "requireUserPrivilegeAction('YpobolhAdeion', 'export')", 'authorizeProgrammataExternalAction'],
    ['GET', '/ergazomenoi/programmata/apologistikosPinakasYperorion', "requireUserPrivilegeAction('ApologistikosPinakasYperorion', 'read')", 'authorizeProgrammataSessionCompany'],
    ['POST', '/api/ergazomenoi/programmata/wto-overtime/preview', "requireUserPrivilegeAction('ApologistikosPinakasYperorion', 'read')", 'authorizeProgrammataSessionCompany'],
    ['POST', '/api/ergazomenoi/programmata/wto-overtime/submit', "requireUserPrivilegeAction('ApologistikosPinakasYperorion', 'export')", 'authorizeProgrammataExternalAction'],
    ['GET', '/ergazomenoi/programmata/katastashElegxouApologistikouPinaka', "requireUserPrivilegeAction('KatastashElegxouApologistikouPinaka', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/ergazomenoi/programmata/katastashElegxouApologistikouPinaka/pdf', "requireUserPrivilegeAction('KatastashElegxouApologistikouPinaka', 'export')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka', "requireUserPrivilegeAction('EktyposhOristikouApologistikouPinaka', 'read')", 'authorizeProgrammataSessionCompany'],
    ['GET', '/api/prodhlomena-oraria/review/period-control/submission/final/document', "requireUserPrivilegeAction('EktyposhOristikouApologistikouPinaka', 'export')", 'authorizeProgrammataSessionCompany'],
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

for (const route of [
    '/ergazomenoi/programmata/ypovoliAdeion',
    '/api/ergazomenoi/programmata/wto-leave/preview',
    '/api/ergazomenoi/programmata/wto-leave/submit',
    '/ergazomenoi/programmata/apologistikosPinakasYperorion',
    '/api/ergazomenoi/programmata/wto-overtime/preview',
    '/api/ergazomenoi/programmata/wto-overtime/submit',
    '/ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka',
    '/api/prodhlomena-oraria/review/period-control/submission/final/document'
]) {
    const start = routes.indexOf(`'${route}'`);
    const block = routes.slice(start, start + 500);
    assert.ok(block.includes('checkAuth'), `${route}: checkAuth missing`);
}
const wtoLeaveSubmitStart = routes.indexOf("'/api/ergazomenoi/programmata/wto-leave/submit'");
const wtoLeaveSubmitBlock = routes.slice(wtoLeaveSubmitStart, wtoLeaveSubmitStart + 500);
assert.ok(wtoLeaveSubmitBlock.indexOf("requireUserPrivilegeAction('YpobolhAdeion', 'export')") <
    wtoLeaveSubmitBlock.indexOf('authorizeProgrammataExternalAction'));
const wtoOvertimeSubmitStart = routes.indexOf("'/api/ergazomenoi/programmata/wto-overtime/submit'");
const wtoOvertimeSubmitBlock = routes.slice(wtoOvertimeSubmitStart, wtoOvertimeSubmitStart + 500);
assert.ok(wtoOvertimeSubmitBlock.indexOf("requireUserPrivilegeAction('ApologistikosPinakasYperorion', 'export')") <
    wtoOvertimeSubmitBlock.indexOf('authorizeProgrammataExternalAction'));
const legacyOvertimeStart = routes.indexOf("'/ergazomenoi/programmata/wtoApologistikoYperorion'");
const legacyOvertimeBlock = routes.slice(legacyOvertimeStart,
    routes.indexOf('router.', legacyOvertimeStart + 10));
assert.ok(legacyOvertimeBlock.includes('wtoOvertimeController.deprecatedLegacy'));
assert.ok(!legacyOvertimeBlock.includes('authorizeProgrammataExternalAction'));
assert.ok(!legacyOvertimeBlock.includes('generateWTOApologistikoYperorion'));

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
