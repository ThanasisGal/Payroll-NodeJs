'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../..');
const source = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');
const helpers = source.slice(0, source.indexOf("document.addEventListener('DOMContentLoaded'"));
const successStart = source.indexOf('const showSuccessSwal = async () => {');
const successEnd = source.indexOf('\n                    };', successStart) + 23;
const successFunction = source.slice(successStart, successEnd);
const origin = 'http://127.0.0.1:5001';

async function capture(page, name, width) {
    if (!process.env.PAYROLL_VISUAL_ARTIFACT_DIR) return;
    fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `${name}-${width}.png`), animations: 'disabled' });
}

async function fixture(width, work) {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        const requests = [], errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const employeeFooter = await ejs.renderFile(path.join(root,
            'views/ergazomenoi/ergazomenoi/partials/edit/cardFooters/cardFooter_Edit.ejs'));
        const companyFooter = await ejs.renderFile(path.join(root,
            'views/companies/genikastoixeia/partials/edit/cardFooter.ejs'));
        // Real shared styles and real form partials; every network request is
        // intercepted, including unwanted writes and external resources.
        await page.route('**/*', route => {
            requests.push({ url: route.request().url(), method: route.request().method() });
            if (route.request().url() !== `${origin}/__visual_buttons__`)
                return route.abort();
            return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="el">
                <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                <body><div id="visual-workspace" style="padding:12px; height:100vh; overflow:auto">
                <h1>Στοιχεία εργαζομένου</h1><form>${employeeFooter}</form>
                <h2>Στοιχεία εταιρείας</h2>${companyFooter}
                <h2>Ενέργειες πίνακα</h2><div class="table-responsive"><table class="table"><tbody><tr><td>Δοκιμή</td><td>
                    <button class="btn btn-sm btn-success" id="table-save">Αποθήκευση</button>
                    <button class="btn btn-sm btn-danger" id="table-delete">Διαγραφή</button>
                    <button class="btn btn-sm" disabled id="disabled">Έλεγχος / Διόρθωση</button>
                </td></tr></tbody></table></div>
                <div id="policyPreviewGroupsContainer"><button class="btn btn-warning" id="policy">Έλεγχος Ιστορικού</button></div>
                <div id="variants" class="d-flex flex-wrap gap-2 mt-3">
                    ${['primary', 'success', 'danger', 'warning', 'info', 'secondary', 'brown', 'orange', 'green', 'light', 'dark', 'refresh-custom', 'message-custom']
                        .map(variant => `<button class="btn btn-${variant} rounded-4" id="variant-${variant}">Ενέργεια</button>`).join('')}
                    <button id="plain">Έλεγχος Ιστορικού</button>
                    <input type="submit" value="Αποθήκευση" id="input-submit">
                    <a class="btn btn-success disabled" aria-disabled="true" id="disabled-link">Επιστροφή</a>
                </div>
                <div class="card rounded-4 mt-3" id="unrelated-card">Κάρτα</div>
                <a href="#" id="plain-link">Σύνδεσμος κειμένου</a>
                <button class="nav-link active" role="tab" id="tab">Στοιχεία</button>
                <button hidden id="hidden">Κρυφό</button>
                <div class="pdf-modal-footer mt-3"><button class="btn btn-secondary" id="cancelPdfUpload">Ακύρωση</button>
                    <a class="btn btn-info" href="#" id="pdf-link">Λήψη & Αποστολή</a></div>
                </div></body></html>` });
        });
        await page.goto(`${origin}/__visual_buttons__`);
        for (const file of ['public/css/bootstrap.min.css', 'node_modules/sweetalert2/dist/sweetalert2.css', 'public/css/main.css'])
            await page.addStyleTag({ path: path.join(root, file) });
        if (process.env.PAYROLL_VISUAL_ICON_CSS && process.env.PAYROLL_VISUAL_ICON_FONT) {
            const font = fs.readFileSync(process.env.PAYROLL_VISUAL_ICON_FONT).toString('base64');
            const css = fs.readFileSync(process.env.PAYROLL_VISUAL_ICON_CSS, 'utf8')
                .replace(/url\("[^"]+"\)/g, `url("data:font/woff2;base64,${font}")`);
            await page.addStyleTag({ content: css });
            await page.evaluate(() => document.fonts.ready);
        } else {
            // Offline CI checks the same icon box using inline vector glyphs.
            await page.locator('.bi').evaluateAll(icons => icons.forEach(icon => {
                icon.innerHTML = '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1 1 8l7 7v-4h7V5H8z"/></svg>';
            }));
        }
        await page.addScriptTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js') });
        await page.addScriptTag({ content: helpers + `
            const originalFire = Swal.fire.bind(Swal);
            Swal.fire = options => originalFire({ ...withEmployeeMaintenanceButtonStyles(options),
                showClass: { popup: '' }, hideClass: { popup: '' } });
            const data = { historyUpdated: true };
            const successfulPdfs = [];
            const e3XmlHtml = '', e3RestPendingHtml = '', e7RestPendingHtml = '', e5RestPendingHtml = '',
                e6nRestPendingHtml = '', e6nXmlPendingHtml = '', wtoRestPendingHtml = '', wtoXmlHtml = '';
            const hasE3Xml = false, hasWtoXml = false, hasMAXml = false, isE6NRestSubmit = false, isE6NXmlSubmit = false;
            ${successFunction}
            window.showSaveSuccess = showSuccessSwal;
        ` });
        await work(page);
        assert.deepEqual(errors, []);
        assert.deepEqual(requests, [{ url: `${origin}/__visual_buttons__`, method: 'GET' }]);
    } finally { await browser.close(); }
}

async function geometry(element) {
    return element.evaluate(e => {
        const s = getComputedStyle(e), r = e.getBoundingClientRect();
        return { display: s.display, align: s.alignItems, justify: s.justifyContent, whiteSpace: s.whiteSpace,
            radius: parseFloat(s.borderTopLeftRadius), background: s.backgroundColor, color: s.color,
            border: s.borderTopColor, padding: s.padding, fontSize: s.fontSize, lineHeight: s.lineHeight,
            height: r.height, width: r.width, left: r.left, right: r.right, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth };
    });
}

// Compare helpers with and without the action layer. Login retains its approved
// layout in both snapshots; other screens retain their legacy baseline.
// No historical Git objects, CDN or database are needed.
const sharedCSS = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
const actionSystemStart = sharedCSS.indexOf('/* Primary action buttons share one system.');
assert.ok(actionSystemStart > 100000, 'legacy styles and the action system boundary must be present');
const legacyCSS = sharedCSS.slice(0, actionSystemStart);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const dropdownSource = read('public/js/dropdown-item.js');
const dropdownHelpers = dropdownSource.slice(dropdownSource.indexOf('function makeUnfocusable('),
    dropdownSource.indexOf('window.tomDropdownConfig ='));
const editRoot = 'views/ergazomenoi/ergazomenoi/partials/edit/';

async function helperMarkup(screen) {
    if (screen === 'home') {
        return read('views/partials/sidebar.ejs').match(/<div class="sidebar-bottom-buttons">[\s\S]*?<\/div>/)[0]
            .replace(/src="\/static\/img\/([^"]+)"/g, (_, file) =>
                `src="data:image/png;base64,${fs.readFileSync(path.join(root, 'public/img', file)).toString('base64')}"`);
    }
    if (screen === 'login') {
        return ejs.renderFile(path.join(root, 'views/login/login.ejs'), { csrfToken: 'visual-fixture', userName: '' });
    }
    const dypa = await ejs.renderFile(path.join(root, editRoot, 'cardBodies/section1/accordion/dypa.ejs'), { rec: {} });
    const link = dypa.match(/<a\s+id="gotoProgrammaDypa"[\s\S]*?<\/a>/)[0];
    const trash = file => read(editRoot + file).match(/<button\s[^>]*class="[^"]*tom-trash[\s\S]*?<\/button>/)[0];
    const singleTrash = trash('cardBodies/section2/apodoxes.ejs');
    const multiTrash = ejs.render(trash('cardBodies/section3/krathseis.ejs'), { idNum: 1 });
    const clearRow = (file, variable, value) => read(file)
        .match(/<button type="button" class="[^"]*clear-row[\s\S]*?<\/button>/)[0]
        .replaceAll('${' + variable + '}', value);
    const rowHelpers = clearRow('public/js/ergazomenoi/genika/addStoixeiaSymbaseon.js', 'idNum', '1')
        + clearRow('public/js/kinhseis/apasxolhseis/loadKrathseis.js', 'index', '2');
    const footer = await ejs.renderFile(path.join(root, editRoot, 'cardFooters/cardFooter_Edit.ejs'));
    return `<h1>Συντήρηση εργαζομένου</h1><form>
        ${[['name', 'Ονοματεπώνυμο', 'text', 'Δοκιμή'], ['afm', 'ΑΦΜ', 'text', '000000000'],
        ['date', 'Ημερομηνία', 'date', '2026-07-23'], ['time', 'Ώρα', 'time', '12:30'],
        ['locked', 'Κλειδωμένο πεδίο', 'text', 'Δοκιμή'], ['empty', 'Κενό πεδίο', 'text', '']]
            .map(([id, label, type, value]) => `<label class="d-block mb-2">${label}
                <input id="${id}" type="${type}" class="form-control" value="${value}" ${id === 'locked' ? 'readonly' : ''}>
                </label>`).join('')}
        <label class="d-block mb-3">Απλή επιλογή</label><div class="ts-wrapper single" id="single">
            <select id="single-select" hidden></select><div class="ts-control"><div class="item">Δοκιμαστική επιλογή</div></div></div>
        <label class="d-block my-3">Πολλαπλή επιλογή</label><div class="ts-wrapper multi" id="multi">
            <select id="multi-select" hidden></select><div class="ts-control">
                ${['Πρώτη επιλογή', 'Δεύτερη επιλογή', 'Τρίτη επιλογή'].map((text, i) =>
                    `<div class="item" data-value="${i + 1}">${text}<a class="remove" role="button" href="#">×</a></div>`).join('')}
            </div></div>
        <div class="d-flex align-items-center my-3" id="editApodoxesTomDropdownScope">Σύμβαση ${singleTrash}</div>
        <div class="d-flex align-items-center my-3" id="editKrathseisTomDropdownScope">Κρατήσεις ${multiTrash}</div>
        <div class="d-flex align-items-center my-3">Καθαρισμός πεδίων γραμμής ${rowHelpers}</div>
        <div class="d-flex align-items-center my-3">Πρόγραμμα Δ.ΥΠ.Α. ${link}</div>
        ${footer}</form>`;
}

async function helperSnapshot(page, selectors) {
    const session = await page.context().newCDPSession(page);
    try {
        await session.send('DOM.enable');
        await session.send('CSS.enable');
        const { root: documentNode } = await session.send('DOM.getDocument');
        const result = {};
        for (const selector of selectors) {
            const { nodeId } = await session.send('DOM.querySelector', { nodeId: documentNode.nodeId, selector });
            assert.ok(nodeId, selector);
            result[selector] = {};
            for (const [state, forcedPseudoClasses] of Object.entries({ normal: [], hover: ['hover'],
                focus: ['focus', 'focus-visible'], active: ['hover', 'active'] })) {
                await session.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses });
                result[selector][state] = await page.locator(selector).evaluate(e => {
                    const properties = ['display', 'position', 'top', 'right', 'width', 'height', 'min-width', 'min-height',
                        'max-width', 'max-height', 'padding', 'margin', 'border-radius', 'border-width', 'border-color',
                        'border-style', 'background-color', 'color', 'font-size', 'line-height', 'font-weight', 'white-space',
                        'align-items', 'justify-content', 'vertical-align', 'transform', 'opacity', 'pointer-events',
                        'cursor', 'box-shadow', 'outline', 'outline-offset', 'flex-grow', 'flex-shrink'];
                    const styles = element => Object.fromEntries(properties.map(p => [p, getComputedStyle(element).getPropertyValue(p)]));
                    const box = e.getBoundingClientRect();
                    return { styles: styles(e), width: box.width, height: box.height,
                        icons: [...e.querySelectorAll('i, svg, img')].map(styles) };
                });
            }
            await session.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
        }
        return result;
    } finally { await session.detach(); }
}

async function assertLoginClearAlignment(page, snapshot) {
    const geometry = await page.locator('#email').evaluate(input => {
        const wrapper = input.parentElement;
        const inputBox = input.getBoundingClientRect();
        const wrapperBox = wrapper.getBoundingClientRect();
        return {
            inputHeight: inputBox.height, wrapperHeight: wrapperBox.height,
            inputTop: inputBox.top, wrapperTop: wrapperBox.top,
            controlHeight: parseFloat(getComputedStyle(input).getPropertyValue('--payroll-control-height'))
                * parseFloat(getComputedStyle(document.documentElement).fontSize)
        };
    });
    assert.equal(geometry.inputHeight, geometry.controlHeight, 'Login must use the approved common input height');
    assert.equal(geometry.wrapperHeight, geometry.inputHeight, 'The clear-button anchor must match the input height');
    assert.equal(geometry.wrapperTop, geometry.inputTop, 'The clear-button anchor must align with its input');
    for (const [state, button] of Object.entries(snapshot['.clear-btn'])) {
        assert.equal(parseFloat(button.styles.top), geometry.inputHeight / 2, `${state}: clear button must anchor at the input centre`);
        assert.equal(button.styles.position, 'absolute');
        assert.equal(button.styles.opacity, '1');
        assert.equal(button.styles['pointer-events'], 'auto');
    }
}

for (const width of [1440, 390]) {
    for (const screen of ['home', 'login', 'employee']) {
        test(`helper scope: ${screen} preserves helper geometry and all states at ${width}px`, async () => {
            const browser = await chromium.launch({ headless: true });
            try {
                const page = await browser.newPage({ viewport: { width, height: 1200 } });
                page.setDefaultTimeout(5000);
                const requests = [], errors = [];
                page.on('pageerror', error => errors.push(error.message));
                const markup = await helperMarkup(screen);
                await page.route('**/*', route => {
                    requests.push({ url: route.request().url(), method: route.request().method() });
                    if (route.request().url() === 'https://cdn.webpayrollsolutions.com/assets/img/wps1.png')
                        return route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(root, 'public/img/wps1.png')) });
                    return route.request().url() === `${origin}/__helper_scope__`
                        ? route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="el">
                            <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                            <body><main ${screen === 'login' ? 'class="payroll-form-layout"' : ''}
                                style="max-width:${screen === 'home' ? 240 : 800}px;padding:16px;margin:auto;${screen === 'login' ? '--leftW:0px;--app-header-h:0px;--app-footer-h:0px' : ''}">${markup}</main></body></html>` })
                        : route.abort();
                });
                await page.goto(`${origin}/__helper_scope__`);
                await page.addStyleTag({ path: path.join(root, 'public/css/bootstrap.min.css') });
                const stylesheet = await page.addStyleTag({ content: screen === 'login' ? sharedCSS : legacyCSS });
                if (screen === 'login') {
                    // Keep the real control height and responsive login layout. Only the
                    // primary-action layer is absent from this helper's baseline.
                    const removedLayers = await stylesheet.evaluate(element => {
                        let removed = 0;
                        function removeActionLayer(group) {
                            for (let i = group.cssRules.length - 1; i >= 0; i--) {
                                const rule = group.cssRules[i];
                                if (rule instanceof CSSLayerBlockRule && rule.name === 'application-buttons') {
                                    group.deleteRule(i);
                                    removed++;
                                }
                                else if (rule.cssRules && rule.deleteRule) removeActionLayer(rule);
                            }
                        }
                        removeActionLayer(element.sheet);
                        return removed;
                    });
                    assert.ok(removedLayers > 0, 'The login baseline must actually omit the primary-action layer');
                }
                await page.addStyleTag({ content: `*, *::before, *::after { transition: none !important; animation: none !important; }
                    #single, #multi { position:relative; width:min(260px, calc(100% - 64px)); }
                    .ts-control { border:1px solid #ccc; padding:6px; min-height:32px; }
                    .ts-control .item { font-size:14px; }
                    .ts-overflow-popup { position:absolute; top:40px; width:260px; z-index:10; background:white; }` });
                if (process.env.PAYROLL_VISUAL_ICON_CSS && process.env.PAYROLL_VISUAL_ICON_FONT) {
                    const font = fs.readFileSync(process.env.PAYROLL_VISUAL_ICON_FONT).toString('base64');
                    await page.addStyleTag({ content: fs.readFileSync(process.env.PAYROLL_VISUAL_ICON_CSS, 'utf8')
                        .replace(/url\("[^"]+"\)/g, `url("data:font/woff2;base64,${font}")`) });
                } else {
                    await page.locator('i.bi').evaluateAll(icons => icons.forEach(icon => {
                        icon.innerHTML = '<svg width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16"><path d="M4 4h8v10H4z"/></svg>';
                    }));
                }
                if (screen === 'login') {
                    await page.locator('#email').fill('visual@example.test');
                    await page.addScriptTag({ path: path.join(root, 'public/js/common/clearableInputs.js') });
                    await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
                } else if (screen === 'employee') {
                    await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/genika/clearableInputs.js') });
                    await page.evaluate(() => window.initClearableInputs());
                    await page.locator('.edit-apodoxes-tom-trash, .edit-employee-tom-trash').evaluateAll(buttons =>
                        buttons.forEach(button => { button.hidden = false; }));
                    // Production rendering functions, synthetic selections; no lookup or save request.
                    await page.addScriptTag({ content: dropdownHelpers });
                    await page.evaluate(() => {
                        for (const mode of ['single', 'multi']) {
                            const wrapper = document.getElementById(mode);
                            const tom = { wrapper, input: wrapper.querySelector('select'), settings: { mode },
                                items: mode === 'single' ? ['1'] : ['1', '2', '3'], on() {},
                                control_input: document.createElement('input'),
                                options: { 1: { label: 'Πρώτη επιλογή' }, 2: { label: 'Δεύτερη επιλογή' }, 3: { label: 'Τρίτη επιλογή' } } };
                            updateOverflow(tom);
                        }
                    });
                }
                await page.evaluate(() => document.fonts.ready);
                const selectors = screen === 'home' ? ['.sidebar-mini-btn:nth-child(1)', '.sidebar-mini-btn:nth-child(2)', '.sidebar-mini-btn:nth-child(3)']
                    : screen === 'login' ? ['.clear-btn'] : ['#name + .clear-btn', '#afm + .clear-btn', '#date + .clear-btn', '#time + .clear-btn',
                        '#locked + .clear-btn', '#empty + .clear-btn', '.ts-single-reset-btn', '.ts-multi-reset-btn',
                        '.ts-overflow-indicator', '.ts-control .item:first-child .remove',
                        '.edit-apodoxes-tom-trash', '.edit-employee-tom-trash', '#clearSelectSymbaseon-1',
                        '#clearSelectKrathseon_2', '#gotoProgrammaDypa'];
                const before = await helperSnapshot(page, selectors);
                if (screen === 'login') await assertLoginClearAlignment(page, before);
                await capture(page, `scope-${screen}-legacy`, width);
                await stylesheet.evaluate((element, css) => { element.textContent = css; }, sharedCSS);
                const after = await helperSnapshot(page, selectors);
                if (screen === 'login') await assertLoginClearAlignment(page, after);
                assert.deepEqual(after, before, 'all helper styles and geometry must survive the primary-action layer');
                if (screen === 'home') {
                    for (const selector of selectors) assert.equal(before[selector].normal.height, 28);
                } else if (screen === 'employee') {
                    // Overflow row delete buttons are generated only after expanding +N.
                    await page.locator('.ts-overflow-indicator').dispatchEvent('pointerdown');
                    await page.locator('.ts-popup-row button').first().waitFor({ state: 'attached' });
                    if (!process.env.PAYROLL_VISUAL_ICON_CSS || !process.env.PAYROLL_VISUAL_ICON_FONT) {
                        await page.locator('.ts-popup-row i').evaluateAll(icons => icons.forEach(icon => {
                            icon.innerHTML = '<svg width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16"><path d="M4 4h8v10H4z"/></svg>';
                        }));
                    }
                    await page.locator('.ts-popup-row button').first().waitFor();
                    const popupSelector = ['.ts-popup-row:first-child button'];
                    const current = await helperSnapshot(page, popupSelector);
                    await stylesheet.evaluate((element, css) => { element.textContent = css; }, legacyCSS);
                    assert.deepEqual(await helperSnapshot(page, popupSelector), current);
                    await stylesheet.evaluate((element, css) => { element.textContent = css; }, sharedCSS);
                    // Restoring the action layer starts its 150ms color transition.
                    await page.waitForTimeout(200);
                    await capture(page, 'scope-employee-overflow', width);
                    await page.locator('.ts-overflow-popup').evaluate(element => element.remove());
                    assert.equal(before['.ts-single-reset-btn'].normal.height, 28);
                    assert.equal(before['.ts-multi-reset-btn'].normal.height, 28);
                    for (const selector of ['form .submitButton', 'form .cardFooter01 a.btn']) {
                        const primary = await geometry(page.locator(selector));
                        assert.equal(primary.align, 'center'); assert.equal(primary.whiteSpace, 'nowrap');
                        assert.equal(primary.radius, 6); assert.equal(primary.border, primary.color);
                    }
                }
                await capture(page, `scope-${screen}-restored`, width);
                assert.deepEqual(errors, []);
                assert.deepEqual(requests.filter(request => !request.url.endsWith('/wps1.png')),
                    [{ url: `${origin}/__helper_scope__`, method: 'GET' }]);
                assert.ok(requests.every(request => request.method === 'GET'));
            } finally { await browser.close(); }
        });
    }
}

for (const width of [1440, 390]) {
    test(`global buttons: forms, table, links, variants and legacy overrides at ${width}px`, async () => {
        await fixture(width, async page => {
            const selectors = ['form .submitButton', 'form a.btn', '.clearButton', '#table-save', '#table-delete', '#policy',
                '#plain', '#input-submit', '#cancelPdfUpload', '#pdf-link',
                ...['primary', 'success', 'danger', 'warning', 'info', 'secondary', 'brown', 'orange', 'green', 'light', 'dark', 'refresh-custom', 'message-custom'].map(v => `#variant-${v}`)];
            for (const selector of selectors) {
                const element = page.locator(selector).first();
                await element.scrollIntoViewIfNeeded();
                await page.mouse.move(0, 0);
                await page.waitForTimeout(180);
                const before = await geometry(element);
                assert.ok(['flex', 'inline-flex'].includes(before.display), selector);
                assert.equal(before.align, 'center', selector);
                assert.equal(before.justify, 'center', selector);
                assert.equal(before.whiteSpace, 'nowrap', selector);
                assert.equal(before.radius, 6, selector);
                assert.equal(before.color, before.border, selector);
                assert.notEqual(before.background, before.color, selector);
                assert.ok(parseFloat(before.fontSize) >= 14, selector);
                assert.ok(before.left >= 0 && before.right <= width, `${selector}: viewport overflow ${JSON.stringify(before)}`);
                assert.ok(before.scrollWidth <= before.clientWidth + 1, `${selector}: clipped label`);
                await element.hover(); await page.waitForTimeout(180);
                const hover = await geometry(element);
                assert.equal(hover.background, before.color, selector);
                assert.equal(hover.color, 'rgb(255, 255, 255)', selector);
                assert.equal(hover.height, before.height, selector);
                assert.equal(hover.width, before.width, selector);
                await page.keyboard.press('Tab'); await element.focus();
                assert.equal(await element.evaluate(e => getComputedStyle(e).outlineStyle), 'solid', selector);
                await page.mouse.down();
                assert.equal((await geometry(element)).height, before.height, selector);
                await page.mouse.move(0, 0); await page.mouse.up();
            }
            const button = await geometry(page.locator('form .submitButton'));
            const anchor = await geometry(page.locator('form a.btn'));
            for (const prop of ['height', 'padding', 'fontSize', 'lineHeight', 'radius']) assert.equal(button[prop], anchor[prop], prop);
            for (const selector of ['form .submitButton', 'form a.btn']) {
                const offsets = await page.locator(selector).evaluate(e => {
                    const icon = e.querySelector('i').getBoundingClientRect(), box = e.getBoundingClientRect();
                    const text = [...e.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
                    const range = document.createRange(); range.selectNodeContents(text);
                    const label = range.getBoundingClientRect();
                    return { icon: Math.abs((icon.top + icon.bottom - box.top - box.bottom) / 2),
                        label: Math.abs((label.top + label.bottom - box.top - box.bottom) / 2) };
                });
                assert.ok(offsets.icon <= 1 && offsets.label <= 2, `${selector}: ${JSON.stringify(offsets)}`);
            }
            for (const selector of ['#disabled', '#disabled-link']) {
                const element = page.locator(selector);
                const before = await geometry(element);
                // aria-disabled links can intentionally block pointer events.
                const box = await element.boundingBox();
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await page.waitForTimeout(180);
                assert.equal((await geometry(element)).background, before.background);
                assert.equal(before.background, 'rgb(233, 236, 239)');
            }
            assert.equal(await page.locator('#hidden').isVisible(), false);
            assert.equal(await page.locator('.scroll-to-top').isVisible(), false);
            assert.notEqual(await page.locator('#unrelated-card').evaluate(e => getComputedStyle(e).borderRadius), '6px');
            assert.notEqual(await page.locator('#plain-link').evaluate(e => getComputedStyle(e).display), 'inline-flex');
            await page.locator('form').scrollIntoViewIfNeeded();
            await page.mouse.move(0, 0);
            await page.evaluate(() => document.activeElement.blur());
            await capture(page, 'global-buttons', width);
            await page.locator('form .submitButton').hover(); await page.waitForTimeout(180);
            await capture(page, 'global-button-hover', width);
        });
    });

    test(`actual successful Save HTML sizes to content and owns the 2000ms delay at ${width}px`, async () => {
        await fixture(width, async page => {
            await page.clock.install();
            await page.clock.pauseAt(new Date());
            await page.evaluate(() => {
                window.redirects = 0;
                void window.showSaveSuccess().then(() => { window.redirects++; });
            });
            await page.clock.runFor(250);
            const popup = page.locator('.swal2-popup');
            assert.equal(await page.locator('.swal2-title').innerText(), 'Επιτυχής καταχώριση!');
            assert.equal(await page.locator('.swal2-html-container').innerText(),
                'Η αποθήκευση ολοκληρώθηκε. Ενημερώθηκαν τα στοιχεία του εργαζομένου και το Ιστορικό.');
            const sizes = await popup.evaluate(e => {
                const s = getComputedStyle(e), box = e.getBoundingClientRect();
                const content = e.querySelector('.swal2-html-container').getBoundingClientRect();
                return { height: box.height, bottomGap: box.bottom - content.bottom, minHeight: s.minHeight,
                    whiteSpace: getComputedStyle(e.querySelector('.swal2-html-container')).whiteSpace,
                    left: box.left, right: box.right };
            });
            assert.equal(sizes.minHeight, '0px'); assert.equal(sizes.whiteSpace, 'normal');
            assert.ok(sizes.bottomGap <= 40, JSON.stringify(sizes));
            assert.ok(sizes.height < 430, JSON.stringify(sizes));
            assert.ok(sizes.left >= 0 && sizes.right <= width);
            assert.equal(await page.locator('.swal2-actions').isVisible(), false);
            await capture(page, 'actual-save-success', width);
            await page.keyboard.press('Escape');
            await page.clock.runFor(1749);
            assert.equal(await page.evaluate(() => window.redirects), 0);
            assert.equal(await popup.isVisible(), true);
            await page.clock.runFor(1);
            assert.equal(await page.evaluate(() => window.redirects), 1);
            await page.clock.runFor(2500);
            assert.equal(await page.evaluate(() => window.redirects), 1);

            for (const response of [{ status: 200, ok: true }, { status: 302, ok: false }]) {
                await page.evaluate(({ response, origin }) => {
                    window.redirects = 0;
                    void showEmployeeSaveRedirectNotice(response, '/ergazomenoi/ergazomenoi', Swal, origin)
                        .then(() => { window.redirects++; });
                }, { response, origin });
                await page.clock.runFor(1999);
                assert.equal(await page.evaluate(() => window.redirects), 0);
                await page.clock.runFor(1);
                assert.equal(await page.evaluate(() => window.redirects), 1);
            }
            for (const destination of ['/login', 'https://other.test/ergazomenoi/ergazomenoi']) {
                await page.evaluate(({ destination, origin }) =>
                    showEmployeeSaveRedirectNotice({ status: 200, ok: true }, destination, Swal, origin), { destination, origin });
                assert.equal(await page.locator('.swal2-popup').isVisible(), false);
            }

            for (const options of [{ icon: 'error', title: 'Η αποθήκευση σταμάτησε', text: 'Δεν αποθηκεύτηκε καμία αλλαγή.', confirmButtonText: 'Κλείσιμο' },
                { icon: 'question', title: 'Επιβεβαίωση', text: 'Θέλετε να συνεχίσετε;', showCancelButton: true,
                    confirmButtonText: 'Συνέχεια', cancelButtonText: 'Ακύρωση' },
                { icon: 'success', title: 'Επιτυχής καταχώριση!', showConfirmButton: true, confirmButtonText: 'Κλείσιμο', timer: undefined }]) {
                await page.evaluate(options => {
                    void Swal.fire(options.icon === 'success' ? employeeSaveSuccessOptions(options) : options);
                }, options);
                await page.clock.runFor(5000);
                assert.equal(await page.locator('.swal2-popup').isVisible(), true);
                assert.equal(await page.evaluate(() => Swal.getTimerLeft()), undefined);
                for (const element of await page.locator('.swal2-actions button:visible').all()) {
                    const action = await geometry(element);
                    assert.equal(action.align, 'center'); assert.equal(action.justify, 'center');
                    assert.equal(action.whiteSpace, 'nowrap'); assert.equal(action.radius, 6);
                }
                await capture(page, `scope-dialog-${options.icon}`, width);
                await page.evaluate(() => Swal.close());
            }
        });
    });
}
