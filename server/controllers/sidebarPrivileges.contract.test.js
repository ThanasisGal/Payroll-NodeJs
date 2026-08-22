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
const renderedSidebar = ejs.render(sidebar, {
    userRole: 'A',
    isAdminUserRole: () => true,
    isUserPrivilegesManagerRole: () => true,
    NODE_ENV: 'test',
    nonce: '',
    userId: '',
    script: () => ''
}, { filename: path.join(root, 'views/partials/sidebar.ejs') });
const renderedSidebarWithoutComments = renderedSidebar.replace(/<!--[\s\S]*?-->/g, '');
const renderedMenuItems = [...renderedSidebarWithoutComments.matchAll(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi)]
    .filter((match) => {
        const classValue = match[0].match(/\bclass=["']([^"']*)["']/i)?.[1] || '';
        return classValue.split(/\s+/).includes('menu-item');
    });

assert.ok(controller.includes('UserPrivilegesModel.find('));
assert.ok(!/fetchPermissions[\s\S]*?SidebarStatusModel\.find/.test(controller));
assert.ok(!controller.includes('Model: SidebarStatusModel'));
assert.ok(!controller.includes('SidebarStatusModel.insertMany'));
assert.ok(controller.includes("{ _id: 0, form: 1, 'privileges.admin': 1, 'privileges.read': 1 }"));
assert.ok(frontend.includes('permission?.admin === true || permission?.read === true'));
assert.ok(frontend.includes("a[data-privilege-form]"));
assert.ok(frontend.includes('updateParentLinks(root)'));
assert.strictEqual((frontend.match(/textContent\s*=/g) || []).length, 1);
assert.ok(frontend.includes('availability.borrowedEmployeeTransfers === true'));
assert.ok(frontend.includes("'ΟΛΩΝ των Εργαζόμενων'"));
assert.ok(frontend.includes("'ΜΗ Δανειζόμενων Εργαζόμενων'"));
assert.strictEqual((sidebar.match(/data-borrowed-standard-label="true"/g) || []).length, 2);
assert.ok(!/situation_(?:A|S|HR|C|U|V)/.test(frontend));

for (const form of [
    'Companies', 'Ypokatasthmata', 'NomimoiEkprosopoi', 'Passwords', 'Antistoixiseis', 'Trapezes',
    'Ergazomenoi', 'AntigrafhProgrammatonErgasias',
    'LhpshOrarionApoErganh', 'LhpshProdhlomenonOrarionMonoDaneizomenon',
    'LhpshOrarionApoKartes', 'LhpshPshfiakonKartonMonoDaneizomenon',
    'CalcApasxolhseisPeriodoy',
    'ElegxosApasxolhseonPeriodoy', 'ApologistikosPinakasOrarion',
    'ApologistikosPinakasYperorion', 'YpobolhAdeion', 'Krathseis', 'Symbaseis', 'KathgoriesSymbaseon',
    'EidikothtesSymbaseon', 'StoixeiaSymbaseon', 'KlimakiaSymbaseon',
    'YpologismoiKlimakionSymbaseon', 'Apasxolhseis', 'EktyposhAtomikonEkkathariseon',
    'EktyposhSymbaseonErgazomenon'
]) assert.ok(sidebar.includes(`data-privilege-form="${form}"`), form);

assert.ok(sidebar.includes('data-sidebar-authorized="<%= isAdminUserRole(userRole) %>"'));
assert.ok(sidebar.includes('<% if (isUserPrivilegesManagerRole(userRole)) { %>'));
assert.ok(sidebar.includes('href="../../../login/logout"'));
assert.ok(sidebar.includes('data-sidebar-special data-sidebar-authorized="true"'));
assert.ok(!/\son[a-z]+\s*=/.test(sidebar));
assert.strictEqual(renderedMenuItems.length, 58);
renderedMenuItems.forEach((match, index) => {
    const labels = [...match[0].matchAll(
        /<span\b[^>]*\bclass=["'][^"']*\bsidebar-menu-label\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi
    )];
    assert.strictEqual(labels.length, 1, `menu-item ${index + 1}: exactly one sidebar label`);
    assert.ok(labels[0][1].replace(/<[^>]+>/g, '').trim(), `menu-item ${index + 1}: non-empty sidebar label`);
});
assert.ok(sidebar.includes('id="li2373" data-value="li2373"'));
assert.ok(sidebar.includes('id="ypobolhAdeion"'));
assert.ok(sidebar.includes('data-privilege-form="YpobolhAdeion"'));
for (const [liId, anchorId, form, href] of [
    ['li2382', 'lhpshProdhlomenonMonoDaneizomenon', 'LhpshProdhlomenonOrarionMonoDaneizomenon', '/ergazomenoi/programmata/lhpshProdhlomenonOrarionMonoDaneizomenon'],
    ['li2392', 'lhpshPshfiakonKartonMonoDaneizomenon', 'LhpshPshfiakonKartonMonoDaneizomenon', '/ergazomenoi/programmata/lhpshPshfiakonKartonMonoDaneizomenon']
]) {
    const liStart = sidebar.indexOf(`id="${liId}"`);
    const liBlock = sidebar.slice(liStart, liStart + 900);
    assert.ok(liStart >= 0, `${liId}: missing`);
    assert.ok(liBlock.includes(`id="${anchorId}"`), `${liId}: anchor id mismatch`);
    assert.ok(liBlock.includes(`data-privilege-form="${form}"`), `${liId}: privilege mismatch`);
    assert.ok(liBlock.includes(`href="${href}"`), `${liId}: href mismatch`);
    assert.ok(!liBlock.includes('href="#"'), `${liId}: placeholder href remains`);
    assert.strictEqual((sidebar.match(new RegExp(`href="${href}"`, 'g')) || []).length, 1, `${liId}: route href must be unique`);
}
assert.strictEqual((sidebar.match(/id="apologistikosPinakasOrarion"/g) || []).length, 1);

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
