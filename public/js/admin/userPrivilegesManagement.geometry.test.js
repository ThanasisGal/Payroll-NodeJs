const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..', '..');
const longLabel = '0001 — Πολύ μεγάλο ονοματεπώνυμο χρήστη για επιβεβαίωση αποκοπής με ellipsis — user@example.invalid — Επαναλαμβανόμενο εξαιρετικά μεγάλο label χρήστη — Επαναλαμβανόμενο εξαιρετικά μεγάλο label χρήστη';

const html = `<!doctype html>
<html lang="el">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="fixture-token">
    <link rel="stylesheet" href="/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.webpayrollsolutions.com/assets/own/vendor/tom-select.css">
    <link rel="stylesheet" href="/css/main.css">
    <style>body { overflow-y: auto !important; } main { width: 100%; }</style>
</head>
<body class="user-privileges-page">
<div class="container-fluid container-scroll"><div class="row">
<main class="col-md-9 ms-sm-auto col-lg-10 px-md-4 main-transparent">
    <section class="user-privileges-shell">
        <div class="card user-privileges-card">
            <div class="user-privileges-controls">
                <div class="user-privileges-user-field">
                    <label for="userPrivilegesUser">Χρήστης</label>
                    <select id="userPrivilegesUser" class="form-select tom-dropdown" data-api="/api/users" data-preload-all="true"></select>
                </div>
                <div class="user-privileges-role-field">
                    <label for="userPrivilegesRole">Ρόλος</label>
                    <input id="userPrivilegesRole" class="form-control" value="Supervisor" readonly>
                </div>
                <div class="user-privileges-toggle-field"><button id="userPrivilegesToggleAll" class="btn btn-success">Επιλογή όλων</button></div>
            </div>
            <div id="userPrivilegesStatus"></div>
            <div class="user-privileges-table-container">
                <table class="table user-privileges-table">
                    <thead id="userPrivilegesTableHead"></thead>
                    <tbody id="userPrivilegesTableBody"></tbody>
                </table>
                <div id="userPrivilegesEmpty" hidden></div>
            </div>
            <footer class="card-footer user-privileges-footer">
                <div class="d-flex cardFooter01 user-privileges-footer-actions">
                    <button id="userPrivilegesUpdate" type="button" class="btn btn-brown rounded-4 mt-1 w-20 buttons-content" disabled>
                        <i class="bi bi-floppy"></i> Ενημέρωση
                    </button>
                    <a id="userPrivilegesReturn" href="/mainapp" class="btn btn-brown buttons-content rounded-4 mt-1 w-20">
                        <i class="bi bi-chevron-double-left"></i> Επιστροφή
                    </a>
                </div>
            </footer>
        </div>
    </section>
    <div id="employeeFooterReference" class="card-footer" aria-hidden="true" style="position:fixed;left:-10000px;top:0;width:90vw;opacity:0.01;z-index:9999">
        <div class="d-flex cardFooter01">
            <button id="employeeSaveReference" type="button" class="btn btn-brown rounded-4 mt-1 w-20 buttons-content">
                <i class="bi bi-floppy"></i> Αποθήκευση
            </button>
            <a id="employeeReturnReference" class="btn btn-brown buttons-content rounded-4 mt-1 w-20" href="#">
                <i class="bi bi-chevron-double-left"></i> Επιστροφή
            </a>
        </div>
    </div>
    <input
        id="employeeStyleCheckboxReference"
        type="checkbox"
        class="form-check-input custom-checkbox checkbox-class"
        checked
        aria-hidden="true"
        style="position:fixed;left:-10000px;top:0"
    >
</main>
</div></div>
<script src="https://cdn.webpayrollsolutions.com/assets/own/vendor/tom-select.complete.js"></script>
<script src="/js/admin/userPrivilegesManagement.js"></script>
<script type="module">
import { initTomDropdown } from '/js/dropdown-item.js';
initTomDropdown({ selector: '#userPrivilegesUser', url: '/api/users' });
window.geometryReady = true;
</script>
</body>
</html>`;

function contentType(filename) {
    if (filename.endsWith('.css')) return 'text/css; charset=utf-8';
    if (filename.endsWith('.js')) return 'text/javascript; charset=utf-8';
    return 'text/html; charset=utf-8';
}

function createServer() {
    return http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(html);
        }
        if (url.pathname === '/api/users') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ items: [{ value: 'user-1', label: longLabel }], hasMore: false }));
        }
        if (url.pathname === '/admin/user-privileges/user-1') {
            const columns = ['admin', 'create', 'read', 'update', 'delete', 'print', 'export'];
            const rows = Array.from({ length: 27 }, (_, index) => ({
                id: index === 11 ? null : `0000000000000000000000${String(index + 1).padStart(2, '0')}`,
                form: index === 11 ? 'ElegxosApasxolhseonPeriodoy' : `FixtureForm${index}`,
                formLabel: index === 11 ? 'Έλεγχος Απασχολήσεων' : `Δοκιμαστική φόρμα ${index}`,
                sidebarOrder: index,
                exists: index !== 11,
                applicableKeys: index === 4 ? columns.filter((key) => key !== 'read') : columns,
                privileges: Object.fromEntries(columns.map((key) => [key, false])),
                navigation: {
                    itemLabel: index === 11 ? 'Έλεγχος Απασχολήσεων' : `Δοκιμαστική φόρμα ${index}`,
                    itemOrder: index,
                    ancestors: [{ key: 'fixture-root', label: 'Δοκιμαστική Ενότητα', order: 0 }]
                }
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                success: true,
                user: { id: 'user-1', role: 'S', roleLabel: 'Supervisor' },
                columns,
                rows
            }));
        }
        const relative = url.pathname.replace(/^\//, '');
        const filename = path.resolve(root, 'public', relative);
        const publicRoot = path.resolve(root, 'public') + path.sep;
        if (!filename.startsWith(publicRoot) || !fs.existsSync(filename)) {
            res.writeHead(404);
            return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': contentType(filename) });
        return fs.createReadStream(filename).pipe(res);
    });
}

function rounded(rect) {
    return Object.fromEntries(['left', 'right', 'top', 'bottom', 'width', 'height'].map((key) => [key, Number(rect[key].toFixed(2))]));
}

async function readCheckboxVisual(locator) {
    return locator.evaluate((checkbox) => {
        const style = getComputedStyle(checkbox);
        const markStyle = getComputedStyle(checkbox, '::before');
        return {
            checked: checkbox.checked,
            background: style.backgroundColor,
            border: style.borderColor,
            mark: markStyle.color,
            transitionDuration: style.transitionDuration,
            transitionDelay: style.transitionDelay
        };
    });
}

function maxTransitionMs(visual) {
    const parseTimes = (value) => String(value)
        .split(',')
        .map((part) => part.trim())
        .map((part) => {
            if (part.endsWith('ms')) return Number.parseFloat(part);
            if (part.endsWith('s')) return Number.parseFloat(part) * 1000;
            return 0;
        })
        .map((value) => (Number.isFinite(value) ? value : 0));
    const durations = parseTimes(visual.transitionDuration);
    const delays = parseTimes(visual.transitionDelay);
    const count = Math.max(durations.length, delays.length);
    return Math.max(
        0,
        ...Array.from(
            { length: count },
            (_, index) =>
                durations[index % durations.length] + delays[index % delays.length]
        )
    );
}

function settledTransitionWait(visual) {
    return Math.min(1000, Math.max(100, maxTransitionMs(visual) + 100));
}

async function measure(page) {
    return page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
        const field = rect('.user-privileges-user-field');
        const wrapper = rect('.user-privileges-user-field .ts-wrapper');
        const control = rect('.user-privileges-user-field .ts-control');
        const reset = rect('.user-privileges-user-field .ts-single-reset-btn');
        const role = rect('.user-privileges-role-field');
        const item = document.querySelector('.user-privileges-user-field .ts-control .item');
        const dropdown = document.querySelector('.user-privileges-user-field .ts-dropdown');
        const dropdownRect = dropdown?.getBoundingClientRect();
        return {
            field: Object.fromEntries(['left', 'right', 'top', 'bottom', 'width', 'height'].map((key) => [key, field[key]])),
            wrapper: Object.fromEntries(['left', 'right', 'top', 'bottom', 'width', 'height'].map((key) => [key, wrapper[key]])),
            control: Object.fromEntries(['left', 'right', 'top', 'bottom', 'width', 'height'].map((key) => [key, control[key]])),
            reset: Object.fromEntries(['left', 'right', 'top', 'bottom', 'width', 'height'].map((key) => [key, reset[key]])),
            role: Object.fromEntries(['left', 'right', 'top', 'bottom', 'width', 'height'].map((key) => [key, role[key]])),
            resetOutsideControl: reset.left >= control.right,
            resetInsideUserField: reset.left >= field.left && reset.right <= field.right,
            resetRoleGap: role.top >= field.bottom ? role.top - reset.bottom : role.left - reset.right,
            wrapperReduction: field.width - wrapper.width,
            expectedReduction: parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.5,
            horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            labelEllipsis: item ? getComputedStyle(item).textOverflow === 'ellipsis' && item.scrollWidth > item.clientWidth : false,
            labelMetrics: item ? {
                clientWidth: item.clientWidth,
                scrollWidth: item.scrollWidth,
                overflow: getComputedStyle(item).overflow,
                textOverflow: getComputedStyle(item).textOverflow,
                whiteSpace: getComputedStyle(item).whiteSpace
            } : null,
            dropdownVisible: Boolean(dropdownRect && dropdownRect.width > 0 && dropdownRect.height > 0),
            dropdownInsideViewport: !dropdownRect || (dropdownRect.left >= 0 && dropdownRect.right <= document.documentElement.clientWidth),
            resetParentClass: document.querySelector('.user-privileges-user-field .ts-single-reset-btn').parentElement.className
        };
    });
}

(async () => {
    const server = createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true });
    try {
        for (const viewport of [
            { width: 1024, height: 800 },
            { width: 1152, height: 800 },
            { width: 1280, height: 900 },
            { width: 1366, height: 900 },
            { width: 1440, height: 900 },
            { width: 1600, height: 900 },
            { width: 1913, height: 1000 },
            { width: 600, height: 800 }
        ]) {
            const page = await browser.newPage({ viewport });
            const consoleErrors = [];
            page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
            page.on('pageerror', (error) => consoleErrors.push(error.message));
            await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => window.geometryReady && document.querySelector('#userPrivilegesUser')?.tomselect);

            const beforeRole = await page.locator('.user-privileges-role-field').boundingBox();
            await page.evaluate(() => {
                const tom = document.querySelector('#userPrivilegesUser').tomselect;
                tom.addOption({ value: 'user-1', label: '0001 — Πολύ μεγάλο ονοματεπώνυμο χρήστη για επιβεβαίωση αποκοπής με ellipsis — user@example.invalid — Επαναλαμβανόμενο εξαιρετικά μεγάλο label χρήστη — Επαναλαμβανόμενο εξαιρετικά μεγάλο label χρήστη' });
                tom.open();
            });
            const dropdownGeometry = await page.evaluate(() => {
                const dropdown = document.querySelector('.user-privileges-user-field .ts-dropdown').getBoundingClientRect();
                return {
                    visible: dropdown.width > 0 && dropdown.height > 0,
                    insideViewport: dropdown.left >= 0 && dropdown.right <= document.documentElement.clientWidth
                };
            });
            await page.evaluate(() => {
                const tom = document.querySelector('#userPrivilegesUser').tomselect;
                tom.close();
                tom.setValue('user-1');
            });
            await page.waitForSelector('.user-privileges-user-field .ts-single-reset-btn:not([hidden])');
            await page.waitForSelector('#userPrivilegesTableBody tr:nth-child(18)');
            await page.evaluate(async () => {
                await window.UserPrivilegesManagement.loadUser('user-1');
                await window.UserPrivilegesManagement.loadUser('user-1');
            });
            const tableBehavior = await page.evaluate(() => {
                const rows = [...document.querySelectorAll('#userPrivilegesTableBody tr[data-privilege-form-row="true"]')];
                const employmentIndex = rows.findIndex((row) => row.dataset.form === 'ElegxosApasxolhseonPeriodoy');
                const employmentName = rows[employmentIndex]?.querySelector('.user-privileges-form-name');
                const formNames = [...document.querySelectorAll('#userPrivilegesTableBody .user-privileges-form-name')];
                const expectedColumns = ['admin', 'create', 'read', 'update', 'delete', 'print', 'export'];
                const columnButtons = [...document.querySelectorAll('#userPrivilegesTableHead .user-privileges-column-toggle')];
                const readButton = document.querySelector('[data-privilege-key="read"]');
                const activeRead = [...document.querySelectorAll('#userPrivilegesTableBody input[data-key="read"]:not(:disabled)')];
                const disabledRead = document.querySelector('#userPrivilegesTableBody input[data-key="read"]:disabled');
                const adminBoxes = [...document.querySelectorAll('#userPrivilegesTableBody input[data-key="admin"]:not(:disabled)')];
                readButton.click();
                const firstReadToggle = activeRead.every((box) => box.checked);
                const disabledAfterFirst = disabledRead.checked;
                const adminAfterRead = adminBoxes.some((box) => box.checked);
                readButton.click();
                const secondReadToggle = activeRead.every((box) => !box.checked);
                activeRead[0].checked = true;
                activeRead[0].dispatchEvent(new Event('change', { bubbles: true }));
                const partialState = {
                    ariaPressed: readButton.getAttribute('aria-pressed'),
                    dataState: readButton.dataset.state,
                    className: readButton.className
                };
                activeRead[0].checked = false;
                activeRead[0].dispatchEvent(new Event('change', { bubbles: true }));
                document.getElementById('userPrivilegesToggleAll').click();
                const globalToggle = [...document.querySelectorAll('#userPrivilegesTableBody input:not(:disabled)')]
                    .every((box) => box.checked);
                const hierarchyButton = document.querySelector('.user-privileges-hierarchy-toggle');
                const firstCheckbox = document.querySelector(
                    'tr[data-privilege-form-row="true"] input:not(:disabled)'
                );
                firstCheckbox.checked = true;
                const checkedBeforeCollapse = firstCheckbox.checked;
                hierarchyButton.click();
                const collapsedRowsHidden = [...document.querySelectorAll(
                    'tr[data-privilege-form-row="true"]'
                )].every((row) => row.hidden);
                const checkboxPreserved = firstCheckbox.checked === checkedBeforeCollapse;
                const collapsedAria = hierarchyButton.getAttribute('aria-expanded');
                hierarchyButton.click();
                const expandedRowsVisible = [...document.querySelectorAll(
                    'tr[data-privilege-form-row="true"]'
                )].every((row) => !row.hidden);
                return {
                    rowCount: rows.length,
                    headerButtons: columnButtons.map((button) => ({
                        type: button.type,
                        key: button.dataset.privilegeKey,
                        ariaLabel: button.getAttribute('aria-label'),
                        pointerEvents: getComputedStyle(button).pointerEvents
                    })),
                    employmentIndex,
                    employmentLabel: employmentName?.textContent,
                    employmentWeight: getComputedStyle(employmentName).fontWeight,
                    sampledFormWeights: [formNames[0], formNames[Math.floor(formNames.length / 2)], employmentName]
                        .map((name) => getComputedStyle(name).fontWeight),
                    firstReadToggle,
                    secondReadToggle,
                    disabledAfterFirst,
                    adminAfterRead,
                    globalToggle,
                    checkboxClasses: [...firstCheckbox.classList],
                    collapsedRowsHidden,
                    checkboxPreserved,
                    collapsedAria,
                    expandedRowsVisible,
                    readAriaPressed: readButton.getAttribute('aria-pressed'),
                    partialState,
                    expectedColumns
                };
            });
            assert.deepStrictEqual(
                tableBehavior.headerButtons.map((button) => button.key),
                tableBehavior.expectedColumns
            );
            assert.strictEqual(tableBehavior.rowCount, 27);
            assert.strictEqual(tableBehavior.headerButtons.length, 7);
            tableBehavior.headerButtons.forEach((button) => {
                assert.strictEqual(button.type, 'button');
                assert.strictEqual(button.ariaLabel, `Επιλογή ή αποεπιλογή όλων στη στήλη ${button.key}`);
                assert.strictEqual(button.pointerEvents, 'auto');
            });
            assert.strictEqual(tableBehavior.employmentIndex, 11);
            assert.strictEqual(tableBehavior.employmentLabel, 'Έλεγχος Απασχολήσεων');
            assert.ok(['400', 'normal'].includes(tableBehavior.employmentWeight));
            tableBehavior.sampledFormWeights.forEach((weight) => {
                assert.ok(['400', 'normal'].includes(weight), `tbody form name is bold: ${weight}`);
            });
            assert.strictEqual(tableBehavior.firstReadToggle, true);
            assert.strictEqual(tableBehavior.secondReadToggle, true);
            assert.strictEqual(tableBehavior.disabledAfterFirst, false);
            assert.strictEqual(tableBehavior.adminAfterRead, false);
            assert.deepStrictEqual(tableBehavior.partialState, {
                ariaPressed: 'false',
                dataState: 'partial',
                className: 'user-privileges-column-toggle is-partial'
            });
            assert.strictEqual(tableBehavior.globalToggle, true);
            assert.deepStrictEqual(tableBehavior.checkboxClasses, [
                'form-check-input',
                'custom-checkbox',
                'checkbox-class',
                'user-privileges-checkbox'
            ]);
            if (viewport.width === 1024) {
                const visualCheckbox = page.locator(
                    'tr[data-privilege-form-row="true"] input:not(:disabled)'
                ).first();
                const employeeStyleCheckboxReference = page.locator(
                    '#employeeStyleCheckboxReference'
                );
                assert.strictEqual(await employeeStyleCheckboxReference.isChecked(), true);
                const referenceTransition = await readCheckboxVisual(
                    employeeStyleCheckboxReference
                );
                const referenceTransitionMs = maxTransitionMs(referenceTransition);
                await page.waitForTimeout(settledTransitionWait(referenceTransition));
                const employeeStyleVisual = await readCheckboxVisual(
                    employeeStyleCheckboxReference
                );

                await visualCheckbox.uncheck();
                assert.strictEqual(await visualCheckbox.isChecked(), false);
                await visualCheckbox.check();
                assert.strictEqual(await visualCheckbox.isChecked(), true);
                await page.mouse.move(0, 0);
                const permissionTransition = await readCheckboxVisual(visualCheckbox);
                const permissionTransitionMs = maxTransitionMs(permissionTransition);
                await page.waitForTimeout(settledTransitionWait(permissionTransition));
                const checkedVisual = await readCheckboxVisual(visualCheckbox);
                const diagnostic = JSON.stringify({
                    viewport,
                    reference: employeeStyleVisual,
                    permission: checkedVisual,
                    referenceTransitionMs,
                    permissionTransitionMs
                });
                assert.deepStrictEqual({
                    checked: employeeStyleVisual.checked,
                    background: employeeStyleVisual.background,
                    border: employeeStyleVisual.border,
                    mark: employeeStyleVisual.mark
                }, {
                    background: 'rgb(0, 128, 0)',
                    border: 'rgb(0, 128, 0)',
                    mark: 'rgb(255, 255, 255)',
                    checked: true
                }, `Employee checkbox visual mismatch: ${diagnostic}`);
                assert.deepStrictEqual({
                    checked: checkedVisual.checked,
                    background: checkedVisual.background,
                    border: checkedVisual.border,
                    mark: checkedVisual.mark
                }, {
                    checked: employeeStyleVisual.checked,
                    background: employeeStyleVisual.background,
                    border: employeeStyleVisual.border,
                    mark: employeeStyleVisual.mark
                }, `Permission checkbox visual mismatch: ${diagnostic}`);
                assert.strictEqual(
                    await page.locator('#userPrivilegesTableBody input:disabled').first()
                        .evaluate((checkbox) => getComputedStyle(checkbox).opacity),
                    '0.55'
                );
            }
            assert.strictEqual(tableBehavior.collapsedRowsHidden, true);
            assert.strictEqual(tableBehavior.checkboxPreserved, true);
            assert.strictEqual(tableBehavior.collapsedAria, 'false');
            assert.strictEqual(tableBehavior.expandedRowsVisible, true);
            const hierarchyToggle = page.locator('.user-privileges-hierarchy-toggle');
            await hierarchyToggle.focus();
            await hierarchyToggle.press('Enter');
            assert.strictEqual(await hierarchyToggle.getAttribute('aria-expanded'), 'false');
            await hierarchyToggle.press('Space');
            assert.strictEqual(await hierarchyToggle.getAttribute('aria-expanded'), 'true');
            const readToggle = page.locator('[data-privilege-key="read"]');
            await readToggle.focus();
            await readToggle.press('Enter');
            assert.strictEqual(
                await page.locator('#userPrivilegesTableBody input[data-key="read"]:not(:disabled):checked').count(),
                0
            );
            await readToggle.press('Space');
            assert.strictEqual(
                await page.locator('#userPrivilegesTableBody input[data-key="read"]:not(:disabled):not(:checked)').count(),
                0
            );
            assert.strictEqual(
                await page.locator('#userPrivilegesTableBody input[data-key="read"]:disabled:checked').count(),
                0
            );
            await page.waitForSelector('#userPrivilegesUpdate:not([disabled])');
            await page.waitForTimeout(250);
            await page.evaluate(() => {
                document.getElementById('employeeFooterReference').style.left = '0';
            });

            async function buttonStyle(selector) {
                return page.locator(selector).evaluate((element) => {
                    const style = getComputedStyle(element);
                    return {
                        backgroundColor: style.backgroundColor,
                        borderColor: style.borderColor,
                        borderRadius: style.borderRadius,
                        height: style.height,
                        fontFamily: style.fontFamily,
                        fontSize: style.fontSize,
                        fontWeight: style.fontWeight
                    };
                });
            }
            const updateStyle = await buttonStyle('#userPrivilegesUpdate');
            const employeeStyle = await buttonStyle('#employeeSaveReference');
            assert.deepStrictEqual(updateStyle, employeeStyle);
            const returnStyle = await buttonStyle('#userPrivilegesReturn');
            const employeeReturnStyle = await buttonStyle('#employeeReturnReference');
            assert.deepStrictEqual(returnStyle, employeeReturnStyle);

            await page.hover('#userPrivilegesUpdate');
            await page.waitForTimeout(200);
            const updateHover = await buttonStyle('#userPrivilegesUpdate');
            await page.hover('#employeeSaveReference');
            await page.waitForTimeout(200);
            const employeeHover = await buttonStyle('#employeeSaveReference');
            assert.deepStrictEqual(updateHover, employeeHover);

            await page.mouse.move(0, 0);
            await page.focus('#userPrivilegesUpdate');
            await page.waitForTimeout(200);
            const updateFocus = await buttonStyle('#userPrivilegesUpdate');
            await page.focus('#employeeSaveReference');
            await page.waitForTimeout(200);
            const employeeFocus = await buttonStyle('#employeeSaveReference');
            assert.deepStrictEqual(updateFocus, employeeFocus);

            await page.hover('#userPrivilegesUpdate');
            await page.mouse.down();
            await page.waitForTimeout(200);
            const updateActive = await buttonStyle('#userPrivilegesUpdate');
            await page.mouse.up();
            await page.hover('#employeeSaveReference');
            await page.mouse.down();
            await page.waitForTimeout(200);
            const employeeActive = await buttonStyle('#employeeSaveReference');
            await page.mouse.up();
            assert.deepStrictEqual(updateActive, employeeActive);

            const selected = await measure(page);
            const afterRole = await page.locator('.user-privileges-role-field').boundingBox();

            assert.ok(selected.resetParentClass.includes('ts-wrapper'), 'common reset DOM parent changed');
            assert.ok(selected.resetOutsideControl, 'reset must render outside the TomSelect control');
            assert.ok(selected.resetInsideUserField, 'reset must remain inside the user grid cell');
            assert.ok(selected.resetRoleGap >= 0, 'reset overlaps the role field');
            assert.ok(
                Math.abs(selected.wrapperReduction - selected.expectedReduction) <= 1,
                `expected 2.5rem reduction, got ${selected.wrapperReduction}px`
            );
            assert.ok(
                Math.abs(beforeRole.x - afterRole.x) <= 20 && Math.abs(beforeRole.width - afterRole.width) <= 10,
                `role geometry moved after selection: ${JSON.stringify({ beforeRole, afterRole })}`
            );
            assert.strictEqual(selected.horizontalOverflow, 0, 'page has horizontal overflow');
            assert.ok(selected.labelEllipsis, `selected label does not ellipsize: ${JSON.stringify(selected.labelMetrics)}`);
            assert.ok(
                dropdownGeometry.visible && dropdownGeometry.insideViewport,
                `dropdown is clipped or outside the viewport: ${JSON.stringify(dropdownGeometry)}`
            );

            await page.locator('.user-privileges-user-field .ts-single-reset-btn').click();
            assert.strictEqual(await page.evaluate(() => document.querySelector('#userPrivilegesUser').tomselect.getValue()), '', 'reset is not clickable');
            assert.deepStrictEqual(consoleErrors, []);

            const report = {
                viewport: `${viewport.width}x${viewport.height}`,
                tomSelectRight: Number(selected.control.right.toFixed(2)),
                trash: rounded(selected.reset),
                roleLeft: Number(selected.role.left.toFixed(2)),
                roleWidth: Number(selected.role.width.toFixed(2)),
                roleBefore: { left: Number(beforeRole.x.toFixed(2)), width: Number(beforeRole.width.toFixed(2)) },
                roleAfter: { left: Number(afterRole.x.toFixed(2)), width: Number(afterRole.width.toFixed(2)) },
                trashRoleGap: Number(selected.resetRoleGap.toFixed(2)),
                trashOutsideControl: selected.resetOutsideControl,
                trashInsideUserField: selected.resetInsideUserField,
                tomSelectWidthReduction: Number(selected.wrapperReduction.toFixed(2)),
                horizontalOverflow: selected.horizontalOverflow,
                tableBehavior,
                footerStyleParity: true,
                consoleErrors
            };
            console.log(JSON.stringify(report));
            await page.close();
        }
        console.log('PASS user privileges TomSelect geometry (desktop and mobile)');
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
