'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const ejs = require('ejs');
const { chromium } = require('playwright');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const { locals: layoutLocals, root } = require('../fixtures/responsiveForms');
const { strip, addTypographyAssets, settleLayout } = require('../helpers/responsiveFormsBrowser');
const { DAILY_NUMBER_FIELDS } = require('../../server/services/ergazomenoi/apasxoliseisEmploymentReviewReportService');
const controller = require('../../server/controllers/ergazomenoi/erganhController');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const sizes = [[1920,1080], [1680,1050], [1600,900], [1440,900], [1280,1024], [1280,800], [1280,720], [800,700]];

async function setup(t) {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-30T12:00:00Z') });
    const data = await createStage1CompletionFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    const terms = { kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
    await data.E.collection.updateOne({ _id: data.employee._id }, { $set: terms });
    await data.H.collection.updateOne({ _id: data.history._id }, { $set: terms });
    for (const row of data.rows) {
        const rest = [0, 6].includes(row.hmeromhnia.getUTCDay());
        const short = row.hmeromhnia.toISOString().startsWith('2026-09-29');
        const hours = rest ? 0 : short ? 7.5 : 8;
        await data.D.collection.updateOne({ _id: row._id }, { $set: {
            ...Object.fromEntries(DAILY_NUMBER_FIELDS.map(([field]) => [field, 0])),
            kathgoria_ergasias: rest ? 'ΑΝ' : 'ΕΡΓ', repo: rest,
            kathgoria_ergasias_apologistika: rest ? 'ΑΝ' : 'ΕΡΓ', repo_apologistika: rest,
            adeia_apologistika: false, astheneia_apologistika: false, apousia_apologistika: false,
            kathgoria_adeias_apologistika: '', apologistiko_biblio: true,
            apo_ora_01: rest ? '' : '08:00', eos_ora_01: rest ? '' : '16:00', ores_ergasias: rest ? 0 : 8,
            cards_apo_ora_01: rest ? '' : '08:00', cards_eos_ora_01: rest ? '' : short ? '15:30' : '16:00',
            cards_ores_ergasias: hours, ores_ergasias_apologistika: hours,
            ores_pragmatikhs_ergasias_apologistika: hours, ores_apoysias_apologistika: short ? 0.5 : 0
        } });
    }
    const prefix = '/api/prodhlomena-oraria/review';
    data.app.get(prefix + '/export-excel', controller.exportProdhlomenaOrariaReviewExcel);
    data.app.get(prefix + '/export-pdf', controller.exportProdhlomenaOrariaReviewPdf);
    data.app.get(prefix + '/export-audit-dossier-pdf', controller.exportProdhlomenaOrariaReviewAuditDossierPdf);
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const query = new URLSearchParams({ ypokatasthma: '0000', kodikos: '0039',
        apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30', limit: '10000' });
    const request = suffix => fetch(origin + prefix + suffix + '?' + query);
    const snapshot = async () => {
        const names = (await mongoose.connection.db.listCollections().toArray()).map(c => c.name).sort();
        return JSON.stringify(Object.fromEntries(await Promise.all(names.map(async name =>
            [name, await mongoose.connection.db.collection(name).find({}).sort({ _id: 1 }).toArray()]))));
    };
    const makeLegacy = async () => {
        await data.H.collection.insertOne({ ...data.history, ...terms, _id: new mongoose.Types.ObjectId() });
        await data.D.collection.updateMany(data.base, { $set: { compensation_breakdown_apologistika: {
            status: 'LEGACY_FALLBACK_ASSUMED', history_terms_unavailable: true,
            all_results_documented: false, calculation_executed: true,
            assumed_work_terms: { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40 },
            total_amount: null, amounts: { grossWorkAmount: null }
        } } });
    };
    return { ...data, origin, request, snapshot, makeLegacy };
}

test('real search and Excel/PDF exports retain September measurements before and after legacy uncertainty', {
    skip: !uri || !vendor, timeout: 120000
}, async t => {
    const data = await setup(t);
    for (const legacy of [false, true]) {
        if (legacy) await data.makeLegacy();
        const before = await data.snapshot();
        const search = await data.request(''); assert.equal(search.status, 200);
        const shown = await search.json();
        assert.equal(shown.rows.length, 30);
        assert.equal(shown.rows.reduce((sum, row) => sum + row.ores_pragmatikhs_ergasias_apologistika, 0), 175.5);
        if (legacy) assert.ok(shown.read_warnings.length);
        const excel = await data.request('/export-excel'); assert.equal(excel.status, 200);
        const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await excel.arrayBuffer()));
        const totals = book.getWorksheet('ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ');
        const actualIndex = totals.getRow(1).values.indexOf('Πραγματική εργασία');
        assert.equal(totals.getRow(2).getCell(actualIndex).value, 175.5);
        assert.equal(totals.getRow(3).getCell(actualIndex).value, 175.5);
        const absenceIndex = totals.getRow(1).values.indexOf('Ώρες απουσίας');
        assert.equal(totals.getRow(2).getCell(absenceIndex).value, 0.5);
        if (legacy) assert.equal(totals.getRow(2).getCell(totals.getRow(1).values.indexOf('Πρόσθετη εργασία')).value, 'Μη διαθέσιμο');
        for (const suffix of ['/export-pdf', '/export-audit-dossier-pdf']) {
            const response = await data.request(suffix); assert.equal(response.status, 200);
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-pr380-http-pdf-'));
            const file = path.join(dir, 'report.pdf'); fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
            const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
            assert.match(text, /175[.,]50/);
            if (legacy) assert.match(text, /Μη\s+διαθέσιμο/);
        }
        assert.equal(await data.snapshot(), before, 'Search and exports never write any collection');
    }
    await data.D.collection.updateOne({ ...data.base, hmeromhnia: new Date('2026-09-30') },
        { $set: { ores_pragmatikhs_ergasias_apologistika: null, ores_ergasias_apologistika: null } });
    const before = await data.snapshot(), response = await data.request('/export-excel');
    const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
    const totals = book.getWorksheet('ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ');
    assert.equal(totals.getRow(2).getCell(totals.getRow(1).values.indexOf('Πραγματική εργασία')).value, 'Μη διαθέσιμο');
    assert.equal(totals.getRow(2).getCell(totals.getRow(1).values.indexOf('Ώρες απουσίας')).value, 0.5);
    assert.equal(await data.snapshot(), before);
});

test('Chromium: independent employee totals, unknown values and responsive Stage 4', {
    skip: !uri || !vendor, timeout: 180000
}, async t => {
    const data = await setup(t); await data.makeLegacy();
    const before = await data.snapshot();
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const page = await browser.newPage();
    await page.route('**/*', route => new URL(route.request().url()).origin === data.origin ? route.continue() : route.abort());
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(data.origin + '/review');
    await page.waitForFunction(() => typeof loadResults === 'function');
    const sidebar = strip(await ejs.renderFile(path.join(root, 'views/partials/sidebar.ejs'), layoutLocals));
    await page.evaluate(async sidebar => {
        const host = document.createElement('div'); host.className = 'container-fluid container-scroll';
        host.innerHTML = '<div class="row">' + sidebar + '<main class="col-md-9 ms-sm-auto col-lg-10 px-md-4 main-transparent payroll-form-layout"></main></div>';
        const shell = document.querySelector('.employment-review-page-shell');
        document.body.append(host); host.querySelector('main').append(shell);
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0039';
        await loadResults();
        for (const stage of [1, 2, 3]) document.getElementById(`employmentReviewStage${stage}Collapse`).classList.remove('show');
        document.getElementById('employmentReviewStage4Collapse').classList.add('show');
        renderReviewRows(currentReviewRows);
        // Exercise the later stage's presentation without completing or writing
        // the synthetic workflow. Command authorization remains unchanged.
        document.querySelector('.results-table-wrapper').hidden = false;
    }, sidebar);
    await addTypographyAssets(page, vendor);
    await page.addScriptTag({ path: path.join(root, 'public/js/common/formLayout.js') });
    const loaded = await page.evaluate(() => currentReviewRows.map(row => ({ ...row })));
    assert.equal(loaded.length, 30);
    const originalRows = JSON.stringify(loaded);
    assert.equal(await page.locator('#resultsTable .stage4-hours-unavailable').count() > 0, true);
    const unknown = page.locator('#resultsTable .grand-total-row .stage4-hours-unavailable').first();
    assert.match(await unknown.getAttribute('title'), /δεν είναι τεκμηριωμένη/);
    assert.match(await unknown.getAttribute('aria-label'), /δεν είναι τεκμηριωμένη/);
    assert.equal(await unknown.textContent(), '0.00');
    assert.match(await unknown.ariaSnapshot(), /note.*δεν είναι τεκμηριωμένη/);
    await unknown.focus();
    assert.equal(await unknown.evaluate(node => document.activeElement === node), true);
    // A second synthetic employee verifies isolation between subtotal groups.
    const verified = { ...loaded.find(row => row.hmeromhnia.startsWith('2026-09-28')), kodikos: '0050',
        _id: 'synthetic-browser-verified', history_terms_unavailable: false, compensation_breakdown_apologistika: null };
    await page.evaluate(rows => { renderReviewRows(rows); }, [...loaded, verified]);
    await page.evaluate(() => {
        const other = document.createElement('table'); other.id = 'unrelatedTotalsTable';
        other.style.textAlign = 'center';
        other.innerHTML = '<tbody><tr class="employee-subtotal-row"><td>Άλλος πίνακας</td><td>7.50</td></tr></tbody>';
        document.body.append(other);
        other.style.position = 'fixed'; other.style.visibility = 'hidden';
    });
    for (const [width, height] of sizes) for (const open of [true, false]) {
        await t.test(`${width}x${height}, sidebar ${open ? 'open' : 'closed'}`, async () => {
            await page.setViewportSize({ width, height });
            await page.evaluate(open => {
                document.getElementById('sidebarMenu').classList.toggle('d-none', !open);
                const main = document.querySelector('main');
                main.style.setProperty('width', open ? '' : '100%', 'important');
                main.style.setProperty('margin-left', open ? '' : '0px', 'important');
                const group = document.querySelector('[data-employee-kodikos="0039"].employee-group-row');
                if (group.classList.contains('collapsed')) group.click();
            }, open);
            await settleLayout(page);
            assert.equal(await page.locator('#resultsTable').isVisible(), true);
            const subtotal = page.locator('.employee-subtotal-row[data-group-id="group-0039"]');
            assert.match(await subtotal.locator('td').nth(1).textContent(), /175\.50/);
            assert.match(await subtotal.locator('td').nth(2).textContent(), /0\.50/);
            assert.match(await subtotal.locator('td').nth(5).textContent(), /0\.00/);
            assert.match(await page.locator('.employee-subtotal-row[data-group-id="group-0050"] td').nth(1).textContent(), /8\.00/);
            assert.match(await page.locator('.grand-total-row td').nth(1).textContent(), /183\.50/);
            assert.match(await page.locator('.grand-total-row td').nth(2).textContent(), /0\.50/);
            assert.match(await page.locator('.grand-total-row td').nth(5).textContent(), /0\.00/);
            const alignment = await page.evaluate(() => {
                const table = document.getElementById('resultsTable');
                const cells = [...table.querySelectorAll('.employee-detail-row:not(.d-none) > td:nth-child(n + 7), .employee-subtotal-row:not(.d-none) > td:nth-child(n + 2), .grand-total-row > td:nth-child(n + 2)')];
                const clocks = [...table.querySelectorAll('.employee-detail-row:not(.d-none) .stage4-hours-clock, .employee-subtotal-row:not(.d-none) .stage4-hours-clock, .grand-total-row .stage4-hours-clock')];
                const decimals = [...table.querySelectorAll('.employee-detail-row:not(.d-none) .stage4-hours-decimal, .employee-subtotal-row:not(.d-none) .stage4-hours-decimal, .grand-total-row .stage4-hours-decimal')];
                return {
                    cells: cells.map(cell => getComputedStyle(cell).textAlign),
                    clocks: clocks.map(node => ({ text: node.textContent, align: getComputedStyle(node).textAlign,
                        offset: node.getBoundingClientRect().left - node.parentElement.getBoundingClientRect().left })),
                    decimals: decimals.map(node => ({ text: node.textContent, align: getComputedStyle(node).textAlign,
                        offset: node.parentElement.getBoundingClientRect().right - node.getBoundingClientRect().right })),
                    unrelated: getComputedStyle(document.querySelector('#unrelatedTotalsTable td:nth-child(2)')).textAlign
                };
            });
            assert.ok(alignment.cells.length > 7);
            assert.ok(alignment.cells.every(value => value === 'right'), JSON.stringify(alignment.cells));
            assert.ok(alignment.clocks.some(value => value.text === '175:30'));
            assert.ok(alignment.clocks.some(value => value.text === '183:30'));
            assert.ok(alignment.clocks.every(value => value.align === 'left' && Math.abs(value.offset) <= 1), JSON.stringify(alignment.clocks));
            assert.ok(alignment.decimals.some(value => value.text === '7.50'));
            assert.ok(alignment.decimals.some(value => value.text === '0.00'));
            assert.ok(alignment.decimals.every(value => value.align === 'right' && Math.abs(value.offset) <= 1), JSON.stringify(alignment.decimals));
            assert.equal(alignment.unrelated, 'center');
            const metrics = await page.evaluate(() => {
                const table = document.getElementById('resultsTable'), box = table.closest('.table-responsive');
                return { viewport: innerWidth, page: document.documentElement.scrollWidth,
                    width: box.clientWidth, content: box.scrollWidth,
                    overflow: getComputedStyle(box).overflowX,
                    cellOverflow: Math.max(0, ...[...table.querySelectorAll('.employee-detail-row:not(.d-none) > td:nth-child(n + 7)')]
                        .map(cell => cell.scrollWidth - cell.clientWidth)),
                    font: parseFloat(getComputedStyle(table.querySelector('td')).fontSize) };
            });
            assert.ok(metrics.page <= metrics.viewport + 2, JSON.stringify(metrics));
            assert.ok(metrics.width > 0 && metrics.content > 0, JSON.stringify(metrics));
            assert.ok(metrics.cellOverflow <= 2, JSON.stringify(metrics));
            assert.ok(metrics.font >= 13.6, JSON.stringify(metrics));
            if (metrics.content > metrics.width) assert.match(metrics.overflow, /auto|scroll/);
            if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR && [1440, 800].includes(width)) {
                fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, { recursive: true });
                await subtotal.scrollIntoViewIfNeeded();
                await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,
                    `review-totals-${width}-${open ? 'open' : 'closed'}.png`), fullPage: true });
            }
        });
    }
    const missing = structuredClone(loaded);
    missing[0].ores_ergasias_apologistika = null;
    await page.evaluate(rows => renderReviewRows(rows), [...missing, verified]);
    assert.match(await page.locator('.employee-subtotal-row[data-group-id="group-0039"] td').nth(1).textContent(), /0\.00/);
    assert.match(await page.locator('.employee-subtotal-row[data-group-id="group-0039"] td').nth(2).textContent(), /0\.50/);
    assert.match(await page.locator('.employee-subtotal-row[data-group-id="group-0050"] td').nth(1).textContent(), /8\.00/);
    assert.match(await page.locator('.grand-total-row td').nth(1).textContent(), /0\.00/);
    assert.match(await page.locator('.grand-total-row td').nth(2).textContent(), /0\.50/);
    assert.equal(JSON.stringify(loaded), originalRows);
    const semantics = await page.evaluate(() => {
        const row = currentReviewRows.find(row => row.history_terms_unavailable);
        return { value: EmploymentReviewNumbers.dailyNumber(row, 'ores_prostheths_ergasias_apologistika'),
            sum: EmploymentReviewNumbers.sum([8, null]),
            editor: renderApologistikaFields({ ...row, ores_prostheths_ergasias_apologistika: null }) };
    });
    assert.equal(semantics.value, null); assert.equal(semantics.sum, null);
    assert.doesNotMatch(semantics.editor, /stage4-hours-unavailable/);
    assert.deepEqual(errors, []);
    assert.equal(await data.snapshot(), before);
});
