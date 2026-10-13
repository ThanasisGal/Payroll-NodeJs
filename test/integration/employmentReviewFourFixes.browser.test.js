'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const { createGuidanceFixture } = require('../helpers/employmentReviewGuidanceApp');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;

test('menu options, full-width employee disclosure and declared rest at supported desktop widths', {
    skip: !uri || !vendor, timeout: 120000
}, async t => {
    const data = await createGuidanceFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    const employee = data.employees.find(item => item.kodikos === '0001');
    for (const row of await data.D.find({ employee_id: employee._id }).lean()) {
        const rest = row.kathgoria_ergasias === 'ΑΝ';
        await data.D.collection.updateOne({ _id: row._id }, { $set: {
            eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΕΡΓΑΖΟΜΕΝΟΣ',
            kathgoria_ergasias_apologistika: rest ? 'ΑΝ' : 'ΕΡΓ',
            repo_apologistika: false, apologistiko_biblio: false,
            ores_ergasias: rest ? 0 : 8, ores_ergasias_apologistika: rest ? 0 : 8,
            cards_ores_ergasias: rest ? 0 : 8,
            cards_apo_ora_01: rest ? '' : '09:00', cards_eos_ora_01: rest ? '' : '17:00',
            apo_ora_01: rest ? '' : '09:00', eos_ora_01: rest ? '' : '17:00',
            kathgoria_adeias_apologistika: '' } });
    }
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).origin === origin
        ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/review');
    await page.waitForFunction(() => typeof loadResults === 'function');
    const before = await data.snapshot();
    await page.evaluate(async () => {
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0001';
        await loadResults();
        await loadPreparedWeeklyHrStage1();
    });
    for (const width of [1280, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => {
            document.getElementById('employmentReviewStage4Collapse').classList.remove('show');
            document.getElementById('employmentReviewStage1Collapse').classList.add('show');
        });
        const menu = page.locator('.weekly-hr-stage1-bulk-action-menu');
        await page.locator('.weekly-hr-stage1-bulk-action-toggle').click();
        await menu.waitFor({ state: 'visible' });
        const options = await menu.locator('.dropdown-item').evaluateAll(nodes => nodes.map(node => {
            const style = getComputedStyle(node);
            return { text: node.textContent.trim(), display: style.display, align: style.textAlign,
                border: style.borderTopWidth, background: style.backgroundColor,
                width: node.getBoundingClientRect().width, parentWidth: node.parentElement.getBoundingClientRect().width };
        }));
        assert.deepEqual(options.map(item => item.text), ['Άδεια', 'Ασθένεια', 'Απουσία', 'Καθαρισμός']);
        await capture(`bulk-menu-${width}`);
        for (const option of options) {
            assert.equal(option.display, 'block');
            assert.equal(option.align, 'left');
            assert.equal(option.border, '0px');
            assert.ok(Math.abs(option.width - option.parentWidth) < 3);
        }
        await capture(`bulk-menu-${width}`);
        await page.keyboard.press('Escape');
        await page.evaluate(() => {
            document.getElementById('employmentReviewStage1Collapse').classList.remove('show');
            document.getElementById('employmentReviewStage4Collapse').classList.add('show');
        });
        const group = page.locator('#resultsTable .employee-group-row').first();
        await group.scrollIntoViewIfNeeded();
        const geometry = await group.evaluate(node => {
            const rect = node.getBoundingClientRect(), table = node.closest('table').getBoundingClientRect();
            return { display: getComputedStyle(node).display, width: rect.width, tableWidth: table.width,
                viewportOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        assert.equal(geometry.display, 'table-row');
        assert.ok(Math.abs(geometry.width - geometry.tableWidth) < 3);
        assert.equal(geometry.viewportOverflow, false);
        assert.match(await group.innerText(), /Παράρτημα 0000/);
        assert.match(await group.innerText(), /ΣΥΝΘΕΤΙΚΟΣ ΕΡΓΑΖΟΜΕΝΟΣ/);
        await group.focus();
        if (await group.getAttribute('aria-expanded') === 'true') await page.keyboard.press('Enter');
        assert.equal(await group.getAttribute('aria-expanded'), 'false');
        await capture(`stage4-closed-${width}`);
        await page.keyboard.press('Enter');
        assert.equal(await group.getAttribute('aria-expanded'), 'true');
        const row = page.locator('#resultsTable .employee-detail-row[data-date="2026-09-02"]');
        await row.waitFor({ state: 'visible' });
        assert.match(await row.innerText(), /ΑΝΑΠΑΥΣΗ \/ ΡΕΠΟ/);
        assert.doesNotMatch(await row.innerText(), /χρειάζεται έλεγχος|ΜΗ ΚΑΝΟΝΙΚΟΠΟΙΗΜΕΝΗ/);
        await capture(`stage4-open-${width}`);
        await group.focus();
        await page.keyboard.press('Space');
        assert.equal(await row.isVisible(), false);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(await data.snapshot(), before, 'read-only reevaluation must not write');
    async function capture(name) {
        const dir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
        if (!dir) return;
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true, animations: 'disabled' });
    }
});
