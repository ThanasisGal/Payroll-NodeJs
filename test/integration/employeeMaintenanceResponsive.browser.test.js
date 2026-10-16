'use strict';
// Presentation only: actual EJS/CSS and the production row template. No app.js,
// database, save handler, payroll algorithm or external request is executed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ejs = require('ejs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const sizes = [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[1100,700],[800,700],[780,700]];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const stripScripts = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

async function renderForm() {
    const employee = { _id: 'synthetic-employee', kodikos: '0001', team: 'TEST', company_kod: 'TEST',
        eponymo: 'ΔΟΚΙΜΑΣΤΙΚΟΣ', onoma: 'ΕΡΓΑΖΟΜΕΝΟΣ', afm: '199999999', amka: '12345678901',
        oristikh_enhmerosh: false, hmeromhnia_proslhpshs: '2026-10-01' };
    return stripScripts(await ejs.renderFile(path.join(root, 'views/ergazomenoi/ergazomenoi/edit.ejs'), {
        ergazomenoiData: employee, rec: employee, companyData: { apasxolhsh_kata_tis_argies: true },
        originalEmploymentHistoryId: '', originalEmploymentHistoryRevision: '', employeeStateToken: '',
        employeeHistoryStateToken: '', employeeHistoryAccessMode: 'ADMIN_FULL', problematicHistoryIds: [],
        istorikoData: [], orariaData: [], perifereies: [], genikesParametroi: [], sessionYearInUse: 2026,
        companyInUse: 'TEST', userTeam: 'TEST', NODE_ENV: 'development', nonce: '', csrfToken: '', userRole: 'A', CONFIG: { EGGRAFES: 20 },
        script: () => '', mode: 'edit', context: 'ergazomenoi'
    }));
}
function scheduleRows() {
    const source = read('public/js/ergazomenoi/genika/date_sync_edit.js');
    const template = source.match(/const divHtml = `([\s\S]*?)`;\s*container\.insertAdjacentHTML/)[1];
    return Array.from({ length: 7 }, (_, index) => vm.runInNewContext('`' + template + '`', {
        i1: String(index + 1).padStart(2, '0'), pKathgoria: 'ΕΡΓ', shouldDefaultMEAfterContractEnd: false,
        pApoOra01: '08:00', pEosOra01: '12:00', pDialApo01: '', pDialEos01: '',
        // Exercise filled, empty and partially filled pairs without evaluating hours.
        pApoOra02: index % 2 ? '' : '16:00', pEosOra02: index % 2 ? '' : '18:00',
        pDialApo02: '', pDialEos02: '', pApoOra03: index === 0 ? '19:00' : '',
        pEosOra03: index === 0 ? '20:00' : '', pDialApo03: '', pDialEos03: '',
        pRepo: false, pArgia: false, labelRepoText: 'ΟΧΙ', labelArgiaText: 'ΟΧΙ',
        pPerigrafh: index === 2 ? 'Δοκιμαστική αργία' : '', disabledAttr: index === 0 ? '' : 'disabled'
    })).join('');
}

test('Employee Maintenance buttons and schedule alignment in Chromium across resolutions and sidebar states', { skip: !vendor, timeout: 120000 }, async t => {
    const html = await renderForm();
    const sidebar = stripScripts(await ejs.renderFile(path.join(root, 'views/partials/sidebar.ejs'), {
        userRole: 'A', isAdminOrSupervisorRole: () => true, companyInUse: 'TEST', userTeam: 'TEST', NODE_ENV: 'development', nonce: '', userId: '', script: () => ''
    })).replace(/src="\/static\/img\/([^"]+)"/g, (_, file) => `src="data:image/png;base64,${fs.readFileSync(path.join(root, 'public/img', file)).toString('base64')}"`);
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ locale: 'el-GR', screen: { width: 1920, height: 1080 } });
    const requests = [], errors = [], measurements = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    await page.setContent(`<!doctype html><html lang="el"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <body><div class="container-fluid container-scroll"><div class="row">${sidebar}
        <main class="col-md-9 ms-sm-auto col-lg-10 px-md-4 main-transparent payroll-form-layout">${html}</main></div></div></body></html>`);
    await page.addStyleTag({ path: path.join(vendor, 'tom-select.css') });
    for (const file of ['public/css/bootstrap.min.css', 'public/css/main.css'])
        await page.addStyleTag({ path: path.join(root, file) });
    await page.locator('#dynamicFields').evaluate((element, rows) => { element.innerHTML = rows; }, scheduleRows());
    await page.evaluate(() => {
        document.querySelectorAll('#dynamicFields .input-date').forEach((input, i) => {
            input.value = `2026-10-${String(i + 1).padStart(2, '0')}`;
            document.getElementById(`day_label_${String(i + 1).padStart(2, '0')}`).textContent = ['Πε','Πα','Σα','Κυ','Δε','Τρ','Τε'][i];
        });
        document.querySelectorAll('#dynamicFields select').forEach(e => { e.add(new Option('Εργασία', 'ΕΡΓ', true, true)); });
        document.querySelectorAll('.sync-eponymo').forEach(e => { e.textContent = 'ΔΟΚΙΜΑΣΤΙΚΟΣ'; });
        document.querySelectorAll('.sync-onoma').forEach(e => { e.textContent = 'ΕΡΓΑΖΟΜΕΝΟΣ'; });
        document.querySelectorAll('.sectionTitle').forEach(e => { e.textContent = 'Συντήρηση Στοιχείων Εργαζομένων'; });
        document.querySelectorAll('.employee-maintenance-form .bi').forEach(icon => {
            icon.innerHTML = '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 1h10l3 3v11H1V1zm2 1v5h7V2zM4 10v4h8v-4z"/></svg>';
        });
        document.querySelectorAll('form').forEach(form => form.addEventListener('submit', event => event.preventDefault()));
    });
    await page.addScriptTag({ path: path.join(vendor, 'tom-select.complete.js') });
    await page.evaluate(() => {
        document.querySelectorAll('#dynamicFields select').forEach(e => { new TomSelect(e, { create: false }); });
    });
    const snapshot = () => page.locator('#dynamicFields input').evaluateAll(inputs => inputs.map(e => ({ id: e.id, value: e.value, disabled: e.disabled, checked: e.checked })));
    const before = await snapshot();
    const artifactDir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
    if (artifactDir) fs.mkdirSync(artifactDir, { recursive: true });
    const capture = async name => {
        if (artifactDir) await page.screenshot({ path: path.join(artifactDir, `${name}.png`), animations: 'disabled' });
    };
    await page.addScriptTag({ path: path.join(root, 'public/js/common/formLayout.js') });
    for (const [width, height] of sizes) for (const sidebarOpen of [true, false]) {
        const label = `${width}x${height}-${sidebarOpen ? 'open' : 'closed'}`;
        await page.setViewportSize({ width, height });
        await page.evaluate(open => {
            document.getElementById('sidebarMenu').classList.toggle('d-none', !open);
            const main = document.querySelector('main');
            main.style.setProperty('width', open ? '' : '100%', 'important');
            main.style.setProperty('margin-left', open ? '' : '0px', 'important');
        }, sidebarOpen);
        const result = { label, tabs: [] };
        for (const section of ['Σταθερά Στοιχεία', 'Ωράριο Εργασίας']) {
            await page.evaluate(async section => {
                document.querySelectorAll('.sections > section').forEach(e => { e.classList.toggle('visible', e.dataset.section === section); e.style.display = e.dataset.section === section ? 'block' : 'none'; });
                document.querySelectorAll('.menu_Links li').forEach(e => { e.classList.toggle('active', e.textContent.trim() === section); });
                window.dispatchEvent(new Event('resize'));
                await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
            }, section);
            const footer = page.locator(`section[data-section="${section}"] .card-footer > .companies-management-actions`);
            assert.equal(await footer.count(), 1, `${label}/${section}: one action group is required`);
            if (section === 'Ωράριο Εργασίας')
                assert.equal(await page.locator('.menu_Links li.active').getAttribute('data-tab-caption'), 'Ωράρια');
            await footer.scrollIntoViewIfNeeded();
            await page.mouse.move(0,0);
            await page.waitForTimeout(180);
            const buttons = await footer.locator(':scope > :is(button, a):not(.btn-toTop)').evaluateAll(elements => elements.map(e => {
                const s = getComputedStyle(e), r = e.getBoundingClientRect(), icon = e.querySelector('i').getBoundingClientRect();
                const card = e.closest('.card').getBoundingClientRect();
                const hit = document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
                const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), rects = [];
                while (walker.nextNode()) if (walker.currentNode.textContent.trim()) {
                    const range = document.createRange(); range.selectNodeContents(walker.currentNode);
                    rects.push(...Array.from(range.getClientRects(), r => ({ y:r.y, height:r.height })));
                }
                return { cardTop:card.top, cardBottom:card.bottom, hit:!!hit && e.contains(hit), text: e.textContent.trim(), left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height,
                    font:parseFloat(s.fontSize), radius:parseFloat(s.borderRadius), align:s.alignItems, nowrap:s.whiteSpace,
                    scroll:e.scrollWidth, client:e.clientWidth, background:s.backgroundColor, border:s.borderTopColor,
                    color:s.color, paddingX:parseFloat(s.paddingLeft), paddingY:parseFloat(s.paddingTop), icon:icon.width,
                    iconCenterDelta:Math.abs(icon.y+icon.height/2-r.y-r.height/2),
                    textCenterDelta:Math.max(...rects.map(t=>Math.abs(t.y+t.height/2-r.y-r.height/2))), lines:rects.length };
            }));
            assert.equal(buttons.length, section === 'Σταθερά Στοιχεία' ? 3 : 2, `${label}/${section}: all footer actions must be measured`);
            for (const b of buttons) {
                assert.ok(b.font >= 14 && b.font <= 16, `${label}: ${JSON.stringify(b)}`);
                assert.ok(b.height >= 34 && b.height <= 42, `${label}: button height`);
                assert.equal(b.radius, 6); assert.equal(b.align, 'center'); assert.equal(b.nowrap, 'nowrap');
                assert.ok(b.left >= 0 && b.right <= width + 1 && b.bottom <= height + 1, `${label}: inaccessible button ${JSON.stringify(b)}`);
                assert.ok(b.top >= b.cardTop && b.bottom <= b.cardBottom+.1 && b.hit, `${label}: clipped or covered action ${JSON.stringify(b)}`);
                assert.ok(b.scroll <= b.client + 1 && b.lines === 1, `${label}: clipped/wrapped caption`);
                assert.ok(Math.abs(b.icon-b.font) <= .1 && b.iconCenterDelta <= 1 && b.textCenterDelta <= 1.5, `${label}: icon/text alignment ${JSON.stringify(b)}`);
                assert.equal(b.border, b.color);
            }
            const footerWidth = await footer.evaluate(e => e.clientWidth);
            if (buttons.reduce((sum,b) => sum+b.width,0) > footerWidth)
                assert.ok(new Set(buttons.map(b=>b.top)).size > 1, `${label}: buttons must wrap`);
            for (let i=0;i<buttons.length;i++) for (let j=i+1;j<buttons.length;j++) {
                const a=buttons[i], b=buttons[j];
                assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `${label}: overlapping buttons`);
            }
            const first = footer.locator('button:not(.btn-toTop)').first();
            await first.hover(); await page.waitForTimeout(180);
            const hover = await first.evaluate(e => ({ color:getComputedStyle(e).color, background:getComputedStyle(e).backgroundColor }));
            assert.equal(hover.color, 'rgb(255, 255, 255)'); assert.notEqual(hover.background, buttons[0].background);
            await page.mouse.move(0,0); await page.waitForTimeout(180);
            if (section === 'Ωράριο Εργασίας') await page.locator('#cardBody6').evaluate(e => { e.scrollTop = 0; });
            result.tabs.push({ section, buttons });
            await capture(`employee-maintenance-${section === 'Ωράριο Εργασίας' ? 'schedule' : 'actions'}-${label}`);
        }
        await page.locator('#cardBody6').evaluate(e => { e.scrollTop = 0; });
        const geometry = await page.locator('#dynamicFields input[type="time"]').evaluateAll(inputs => inputs.map(e => {
            const r=e.getBoundingClientRect(); return { id:e.id, left:r.left, top:r.top, width:r.width, height:r.height, right:r.right, font:parseFloat(getComputedStyle(e).fontSize) };
        }));
        assert.equal(geometry.length, 84);
        let maxDelta = 0;
        for (const prefix of ['apo', 'eos', 'dialleima_apo', 'dialleima_eos']) {
            const fields = geometry.filter(e => e.id.startsWith(prefix + '_ora_'));
            const reference = fields[0];
            for (const e of fields) for (const property of ['left','width','height']) {
                const delta = Math.abs(e[property]-reference[property]); maxDelta=Math.max(maxDelta,delta);
                assert.ok(delta <= .1, `${label}: ${e.id} ${property} differs by ${delta}px`);
            }
        }
        for (const e of geometry) {
            assert.ok(Math.abs(e.width-geometry[0].width) <= .1 && Math.abs(e.height-geometry[0].height) <= .1, `${label}: unequal work/break field size`);
            assert.ok(e.left >= 0 && e.right <= width+1 && e.width >= 108 && e.font >= 14, `${label}: unreadable field ${JSON.stringify(e)}`);
        }
        const columns = await page.locator('.employee-schedule-day').first().evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
        for (let day = 1; day <= 7; day++) for (let pair = 1; pair <= 3; pair++) {
            const suffix = `_0${pair}_0${day}`;
            const fields = geometry.filter(e => e.id.endsWith(suffix));
            const groups = columns === 2 ? [fields.filter(e=>!e.id.startsWith('dialleima')), fields.filter(e=>e.id.startsWith('dialleima'))] : [fields];
            for (const group of groups) assert.ok(Math.max(...group.map(e => e.top))-Math.min(...group.map(e => e.top)) <= .1, `${label}: time inputs in pair ${suffix} must share a row`);
        }
        const container = await page.locator('#cardBody6').evaluate(e => ({ client:e.clientWidth, scroll:e.scrollWidth }));
        assert.ok(container.scroll <= container.client+1, `${label}: schedule horizontal overflow ${JSON.stringify(container)}`);
        result.schedule = { columns, maxDelta, fieldWidth:geometry[0].width, fieldHeight:geometry[0].height, font:geometry[0].font, container };
        // The last day remains reachable through the existing card's inner scroll.
        await page.locator('#eos_ora_03_07').scrollIntoViewIfNeeded();
        await capture(`employee-maintenance-schedule-last-${label}`);
        assert.deepEqual(await snapshot(), before);
        measurements.push(result);
    }
    if (artifactDir) fs.writeFileSync(path.join(artifactDir, 'employee-maintenance-responsive-measurements.json'), JSON.stringify(measurements, null, 2));
    console.log(JSON.stringify(measurements.map(m => ({ label:m.label, font:m.tabs[0].buttons[0].font, buttonHeight:m.tabs[0].buttons[0].height, ...m.schedule }))));
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
});

// The three add/edit corrections share the real templates, typography and Tom
// Select initializer. These fixtures never load write/calculation handlers.
const { loadForm, viewport, settleLayout } = require('../helpers/responsiveFormsBrowser');
const geometryTolerance = 1.5; // Visible alignment; sub-pixel differences are acceptable.
const visaNumber = 'arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh';
const visaDates = ['apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh', 'eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh'];
async function selectEmployeeTab(page, tab) {
    await page.evaluate(tab => {
        [...document.querySelectorAll('.menu_Links li')].find(li => li.textContent.trim() === tab)?.click();
        document.querySelectorAll('.sections > section').forEach(section => {
            section.classList.toggle('visible', section.dataset.section === tab);
            section.style.display = section.dataset.section === tab ? 'block' : 'none';
        });
        document.querySelectorAll('.menu_Links li').forEach(li => li.classList.toggle('active', li.textContent.trim() === tab));
    }, tab);
    await settleLayout(page);
}
function near(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) <= geometryTolerance, `${message}: ${actual} vs ${expected}`);
}
function measureEmployeeControls() {
    const box = e => {
        const r = e.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, center: r.y + r.height / 2 };
    };
    const visible = e => !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const section = document.querySelector('.sections > section.visible');
    const problems = [];
    const textBoxes = e => {
        const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), boxes = [];
        while (walker.nextNode()) if (walker.currentNode.textContent.trim()) {
            const range = document.createRange(); range.selectNodeContents(walker.currentNode);
            boxes.push(...range.getClientRects());
        }
        return boxes;
    };
    const rendered = e => e.tomselect?.wrapper || e;
    const scopes = section.dataset.section === 'Σταθερά Στοιχεία'
        ? [document.querySelector('.employee-status-fields').parentElement]
        : section.dataset.section === 'Κρατήσεις' ? [...section.querySelectorAll('.employee-retention-row')]
        : [section.querySelector('.card-body')];
    const fields = scopes.flatMap(scope => [...scope.querySelectorAll('input:not([type="hidden"]),select,textarea')])
        .filter(e => !e.closest('.ts-wrapper') || e.tomselect).map(rendered).filter(visible);
    for (const e of fields) {
        const b = box(e), content = e.matches('.ts-wrapper') ? e.querySelector('.ts-control') : e;
        // Locked Tom Select paints its lock outside the control, inside the
        // reserved icon space. Check its actual text, not that pseudo-element's scrollWidth.
        const clipped = e.matches('.ts-wrapper')
            ? [...content.querySelectorAll('.item')].some(item => item.scrollWidth > item.clientWidth + 1
                || textBoxes(item).some(r => r.left < b.left || r.right > b.right))
            : e.matches('input[type="date"],textarea') && content.scrollWidth > content.clientWidth + 1;
        if (b.left < 0 || b.right > innerWidth + 1 || clipped) problems.push({ kind: 'field-overflow', id: e.id, box: b });
    }
    for (const label of scopes.flatMap(scope => [...scope.querySelectorAll('label')])) if (visible(label)) {
        if (label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1) problems.push({ kind: 'label-clipping', text: label.textContent.trim() });
        for (const r of textBoxes(label)) for (const field of fields) {
            if (label.contains(field)) continue;
            const b = box(field);
            if (r.left < b.right - 1 && b.left < r.right - 1 && r.top < b.bottom - 1 && b.top < r.bottom - 1)
                problems.push({ kind: 'label-overlap', text: label.textContent.trim(), field: field.id });
        }
    }
    for (const e of [document.documentElement, document.querySelector('main'), section, section.querySelector('.card-body')])
        if (e && e.scrollWidth > e.clientWidth + 1) problems.push({ kind: 'container-overflow', class: e.className, scroll: e.scrollWidth, client: e.clientWidth });
    return { problems, boxes: Object.fromEntries(fields.map(e => [e.previousElementSibling?.tomselect ? e.previousElementSibling.id : e.id, box(e)])) };
}
async function assertNativeDateVisible(cdp, id, inputBox, clearBox) {
    // Inspect Chromium's actual native date segments, including the four-digit
    // year, rather than assuming a CSS min-width proves they are visible.
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#${id}` });
    const { node } = await cdp.send('DOM.describeNode', { nodeId, depth: -1, pierce: true });
    const flatten = n => [n, ...(n.children || []).flatMap(flatten), ...(n.shadowRoots || []).flatMap(flatten)];
    const nodes = flatten(node);
    const attrs = n => Object.fromEntries((n.attributes || []).reduce((pairs, v, i, a) => i % 2 ? pairs : [...pairs, [v, a[i + 1]]], []));
    const nativeBox = async pseudo => {
        const target = nodes.find(n => attrs(n).pseudo === pseudo);
        assert.ok(target, `${id}: missing native ${pseudo}`);
        const { model } = await cdp.send('DOM.getBoxModel', { backendNodeId: target.backendNodeId });
        return { left: model.border[0], right: model.border[2], top: model.border[1], bottom: model.border[5] };
    };
    const edit = await nativeBox('-webkit-datetime-edit');
    const calendar = await nativeBox('-webkit-calendar-picker-indicator');
    assert.ok(calendar.right > calendar.left && calendar.left >= inputBox.left && calendar.right <= inputBox.right, `${id}: clipped calendar`);
    const segments = [];
    for (const part of ['day', 'month', 'year']) {
        const pseudo = `-webkit-datetime-edit-${part}-field`;
        const n = nodes.find(n => attrs(n).pseudo === pseudo);
        assert.equal(attrs(n)['aria-valuenow'], part === 'year' ? '2026' : part === 'month' ? '10' : '14');
        const b = await nativeBox(pseudo);
        assert.ok(b.left >= edit.left - geometryTolerance && b.right <= edit.right + geometryTolerance
            && b.left >= inputBox.left && b.right <= calendar.left + geometryTolerance, `${id}: clipped ${part} ${JSON.stringify({ b, edit, calendar })}`);
        if (clearBox) assert.ok(b.right <= clearBox.left + geometryTolerance || b.left >= clearBox.right - geometryTolerance, `${id}: clear covers ${part}`);
        segments.push({ part, ...b });
    }
    return { calendar, segments };
}

for (const form of ['add', 'edit']) test(`Employee ${form}: status/gender, seven retentions and VISA geometry`, { skip: !vendor, timeout: 180000 }, async t => {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ locale: 'el-GR' });
    const errors = [], requests = [], measurements = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    await loadForm(page, `views/ergazomenoi/ergazomenoi/${form}.ejs`, { vendor, populated: false });
    if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR) fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, { recursive: true });
    await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/genika/clearableInputs.js') });
    await page.evaluate(() => initClearableInputs(document.querySelector('main')));
    // Bind only the two presentation choices, using their unchanged real handler.
    await page.addScriptTag({ path: path.join(root, 'public/js/common/toggleLabelErgazomenon.js') });
    await page.evaluate(() => {
        for (const id of ['energos', 'fylo']) {
            const input = document.getElementById(id);
            input.addEventListener('change', () => toggleCheckboxState(id, input.checked));
            toggleCheckboxState(id, input.checked);
        }
        document.querySelectorAll('select.krathsh-select').forEach(select => {
            select.tomselect.addOption({ value: 'SYNTHETIC', label: '0001 — Συνθετική κράτηση' });
            if (Number(select.dataset.rowIndex) <= 2) select.tomselect.setValue('SYNTHETIC');
        });
    });
    const cdp = await page.context().newCDPSession(page);
    t.after(async () => {
        if (!process.env.PAYROLL_VISUAL_ARTIFACT_DIR) return;
        fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `employee-${form}-three-corrections.json`), JSON.stringify({ errors, requests, measurements }, null, 2));
    });
    for (const [width, height] of [[1440, 900], [1100, 700], [800, 700]]) for (const open of [true, false]) {
        const label = `${form}/${width}x${height}/${open ? 'open' : 'closed'}`;
        await t.test(label, async () => {
            await viewport(page, width, height, open);
            await selectEmployeeTab(page, 'Σταθερά Στοιχεία');
            const states = [];
            for (const active of [false, true]) for (const female of [false, true]) {
                await page.evaluate(({ active, female }) => {
                    for (const [id, checked] of [['energos', active], ['fylo', female]]) {
                        const e = document.getElementById(id); e.checked = checked; e.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, { active, female });
                await settleLayout(page);
                const geometry = await page.locator('.employee-status-fields').evaluate(group => {
                    const rect = e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, width: r.width, height: r.height, center: r.y + r.height / 2 }; };
                    const parts = [...group.querySelectorAll('input,label')].map(e => ({ id: e.id, text: e.textContent.trim(), ...rect(e) }));
                    const doy = document.getElementById('doy').tomselect.wrapper;
                    return { groupHeight: group.getBoundingClientRect().height, parts, doy: rect(doy), label: rect(document.querySelector('label[for^="doy"]')), previous: rect(document.getElementById('eponymo_mhteras')), next: rect(document.getElementById('typos_taytothtas').tomselect.wrapper) };
                });
                assert.ok(geometry.groupHeight <= Math.max(...geometry.parts.map(p => p.height)) + geometryTolerance, `${label}: compact status row without reserved height`);
                near(geometry.parts.find(p => p.id === 'energos').left, geometry.previous.left, `${label}: active checkbox shares the mother surname input start`);
                for (const p of geometry.parts) near(p.center, geometry.parts[0].center, `${label}: status/gender vertical center`);
                for (let i = 1; i < geometry.parts.length; i++) assert.ok(geometry.parts[i].left >= geometry.parts[i - 1].right - geometryTolerance, `${label}: overlapping choices`);
                assert.equal(geometry.parts.find(p => p.id === 'label-energos').text, active ? 'ΕΝΕΡΓΟΣ' : 'ΑΝΕΝΕΡΓΟΣ');
                assert.equal(geometry.parts.find(p => p.id === 'label-fylo').text, female ? 'ΓΥΝΑΙΚΑ' : 'ΑΝΔΡΑΣ');
                if (states.length) {
                    for (const key of ['doy', 'label', 'previous', 'next']) for (const prop of ['left', 'top', 'width', 'height']) near(geometry[key][prop], states[0][key][prop], `${label}: stable ${key}/${prop}`);
                    geometry.parts.forEach((p, i) => near(p.left, states[0].parts[i].left, `${label}: stable choice position`));
                }
                states.push(geometry);
            }
            if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `focused-${label.replaceAll('/', '-')}-status.png`) });
            const status = await page.evaluate(measureEmployeeControls);
            assert.deepEqual(status.problems, [], `${label}: fixed details`);
            await selectEmployeeTab(page, 'Κρατήσεις');
            const retentions = [];
            for (const values of ['mixed', 'filled', 'empty']) {
                await page.evaluate(values => document.querySelectorAll('select.krathsh-select').forEach((e, i) => {
                    e.tomselect.clear();
                    e.tomselect.enable();
                    e.tomselect.addOption({ value: 'SYNTHETIC', label: '0001 — Συνθετική κράτηση' });
                    if (values === 'filled' || values === 'mixed' && i < 2) e.tomselect.addItem('SYNTHETIC');
                    e.tomselect.blur();
                }), values);
                await settleLayout(page);
                const rows = await page.locator('.employee-retention-row').evaluateAll(rows => rows.map(row => {
                    const box = e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height, center: r.y + r.height / 2 }; };
                    const trash = row.querySelector('.edit-employee-tom-trash');
                    return { value: row.querySelector('select').tomselect.getValue(), select: box(row.querySelector('.ts-wrapper')), ama: box(row.querySelector('.employee-ama-field input')), trash: trash && !trash.hidden ? box(trash) : null };
                }));
                assert.equal(rows.length, 7);
                for (const [index, row] of rows.entries()) {
                    assert.equal(row.value, values === 'filled' || values === 'mixed' && index < 2 ? 'SYNTHETIC' : '', `${label}/${values}: actual selected value`);
                    for (const prop of ['left', 'right', 'width']) near(row.select[prop], rows[0].select[prop], `${label}/${values}: seven select ${prop}`);
                    near(row.ama.width, 128, `${label}: original AMA width`);
                    if (retentions.length) for (const key of ['select', 'ama']) for (const prop of ['left', 'right', 'width']) near(row[key][prop], retentions[0].rows[0][key][prop], `${label}: stable ${key}/${prop}`);
                    if (row.trash) {
                        assert.ok(row.trash.left >= row.select.right - geometryTolerance && row.trash.right <= row.ama.left, `${label}: trash beside dropdown, before AMA`);
                        assert.ok(row.trash.left - row.select.right <= 8, `${label}: trash stays in dropdown control area`);
                        near(row.trash.center, row.select.center, `${label}: centered trash`);
                    }
                }
                if (values === 'filled' && process.env.PAYROLL_VISUAL_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `focused-${label.replaceAll('/', '-')}-retentions.png`) });
                const measured = await page.evaluate(measureEmployeeControls);
                assert.deepEqual(measured.problems, [], `${label}/${values}: retentions`);
                retentions.push({ values, rows });
            }
            await selectEmployeeTab(page, 'Αλλοδαποί');
            await page.locator('section[data-section="Αλλοδαποί"] .card-body').evaluate(e => { e.scrollTop = 0; });
            if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `focused-${label.replaceAll('/', '-')}-foreign-top.png`) });
            await page.locator(`#${visaNumber}`).evaluate(e => { e.value = '1'; });
            await page.evaluate(ids => ids.forEach(id => {
                const e = document.getElementById(id); e.disabled = false; e.value = '2026-10-14';
                e.dispatchEvent(new Event('input', { bubbles: true }));
            }), visaDates);
            const dates = [];
            const numberBox = await page.locator(`#${visaNumber}`).boundingBox();
            for (const id of visaDates) {
                await page.locator(`#${id}`).scrollIntoViewIfNeeded();
                await settleLayout(page);
                const geometry = await page.locator(`#${id}`).evaluate(e => {
                    const r = e.getBoundingClientRect(), clear = e.parentElement.querySelector('.clear-btn.is-visible')?.getBoundingClientRect();
                    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                    return { reachable: hit === e || e.contains(hit), left: r.left, right: r.right, top: r.top, width: r.width, height: r.height, clear: clear ? { left: clear.left, right: clear.right } : null };
                });
                assert.ok(geometry.reachable, `${label}: date remains reachable after inner scrolling`);
                near(geometry.right, numberBox.x + numberBox.width, `${label}: VISA right edge`);
                near(geometry.height, 36, `${label}: approved date height`);
                assert.ok(geometry.width >= 180 && geometry.left >= 0 && geometry.right <= width, `${label}: approved date width`);
                assert.ok(geometry.clear, `${label}: preserved clear X`);
                dates.push({ id, ...geometry, ...await assertNativeDateVisible(cdp, id, geometry, geometry.clear) });
            }
            const foreignRows = await page.locator('section[data-section="Αλλοδαποί"] .card-body > .row.form-group').evaluateAll(rows => rows.map(row => {
                const b = row.getBoundingClientRect(), prev = row.previousElementSibling;
                return { height: b.height, gap: prev?.matches('.row.form-group') ? b.top - prev.getBoundingClientRect().bottom : null };
            }));
            for (const row of foreignRows) if (row.gap !== null) assert.ok(row.gap >= -1 && row.gap <= 12, `${label}: uniform compact foreign row spacing ${JSON.stringify(row)}`);
            const foreign = await page.evaluate(measureEmployeeControls);
            assert.deepEqual(foreign.problems, [], `${label}: foreigners`);
            if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR && width === 800) {
                await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `employee-${label.replaceAll('/', '-')}-visa.png`) });
            }
            measurements.push({ label, states, retentions, dates, problems: [...status.problems, ...foreign.problems] });
        });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
});
