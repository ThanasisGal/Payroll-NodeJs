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
        <main class="col-md-9 ms-sm-auto col-lg-10 px-md-4 main-transparent">${html}</main></div></div></body></html>`);
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
            await page.evaluate(section => {
                document.querySelectorAll('.sections > section').forEach(e => { e.classList.toggle('visible', e.dataset.section === section); e.style.display = e.dataset.section === section ? 'block' : 'none'; });
                document.querySelectorAll('.menu_Links li').forEach(e => { e.classList.toggle('active', e.textContent.trim() === section); });
            }, section);
            const footer = page.locator(`section[data-section="${section}"] .cardFooter01`);
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
