const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const controller = read('server/controllers/userController.js');
const sidebar = read('views/partials/sidebar.ejs');
const frontend = read('public/js/common/getUserRole.js');
const reviewView = read('views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs');
const reviewJs = read('public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js');
const routes = read('server/routes/usersRoute.js');

assert.ok(controller.includes('UserPrivilegesModel.find('));
assert.ok(!/fetchPermissions[\s\S]*?SidebarStatusModel\.find/.test(controller));
assert.ok(!controller.includes('Model: SidebarStatusModel'));
assert.ok(!controller.includes('SidebarStatusModel.insertMany'));
assert.ok(controller.includes("{ _id: 0, form: 1, 'privileges.admin': 1, 'privileges.read': 1 }"));
assert.ok(frontend.includes('permission?.admin === true || permission?.read === true'));
assert.ok(frontend.includes("a[data-privilege-form]"));
assert.ok(frontend.includes('updateParentLinks(root)'));
assert.ok(!frontend.includes('textContent'));
assert.ok(!/situation_(?:A|S|HR|C|U|V)/.test(frontend));

for (const form of [
    'Companies', 'Ypokatasthmata', 'NomimoiEkprosopoi', 'Passwords', 'Antistoixiseis', 'Trapezes',
    'Ergazomenoi', 'AntigrafhProgrammatonErgasias', 'LhpshOrarionApoErganh', 'LhpshOrarionApoKartes',
    'CalcApasxolhseisPeriodoy', 'CalcApasxolhseisDaneizomenoyProsopikoy',
    'ElegxosApasxolhseonPeriodoy', 'ApologistikosPinakasOrarion',
    'ApologistikosPinakasYperorion', 'Krathseis', 'Symbaseis', 'KathgoriesSymbaseon',
    'EidikothtesSymbaseon', 'StoixeiaSymbaseon', 'KlimakiaSymbaseon',
    'YpologismoiKlimakionSymbaseon', 'Apasxolhseis', 'EktyposhAtomikonEkkathariseon',
    'EktyposhSymbaseonErgazomenon'
]) assert.ok(sidebar.includes(`data-privilege-form="${form}"`), form);

assert.ok(sidebar.includes('data-sidebar-authorized="<%= isAdminUserRole(userRole) %>"'));
assert.ok(sidebar.includes('<% if (isUserPrivilegesManagerRole(userRole)) { %>'));
assert.ok(sidebar.includes('href="../../../login/logout"'));
assert.ok(sidebar.includes('data-sidebar-special data-sidebar-authorized="true"'));
assert.ok(!/\son[a-z]+\s*=/.test(sidebar));

ejs.compile(reviewView, { filename: path.join(root, 'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs') });
assert.ok(reviewView.includes('class="btn btn-secondary rounded-4 employment-review-return-btn" href="/mainapp"'));
assert.ok(!reviewView.includes('history.back'));
assert.ok(!/employment-review-return-btn[^>]*(?:outline|style=)/.test(reviewView));
assert.ok(!/\son[a-z]+\s*=/.test(reviewView));
assert.ok(reviewJs.includes("kodikos: ''"));
assert.ok(reviewJs.includes('currentHrPendingGroups.map((group, groupIndex)'));
assert.ok(!reviewJs.includes('currentHrActiveIndex'));
assert.ok(reviewJs.includes("closest('.hr-review-proposal-card[data-group-id]')"));
assert.ok(reviewJs.includes("'x-csrf-token': token"));
assert.ok(routes.includes("requireUserPrivilegeForm('ElegxosApasxolhseonPeriodoy')"));
assert.ok(routes.includes("'/api/login/getRoles', userController.getUserRoles"));

console.log('PASS sidebar/review static security contract (canonical keys, legacy removal, auth, CSP, CSRF, return link)');
