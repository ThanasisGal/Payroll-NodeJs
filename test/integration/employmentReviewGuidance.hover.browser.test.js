'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const { createGuidanceFixture } = require('../helpers/employmentReviewGuidanceApp');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendorDir = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;

test('contextual explanations in isolated Chromium: days, multiple causes, weeks, keyboard and touch', {
    skip: !uri || !vendorDir, timeout: 120000
}, async t => {
    const data = await createGuidanceFixture(uri, vendorDir);
    t.after(() => mongoose.disconnect());
    const employee = data.employees.find(item => item.kodikos === '0001');
    // Add a second independent cause to the same synthetic day only.
    await data.D.collection.updateOne({ employee_id: employee._id, hmeromhnia: new Date('2026-09-01') },
        { $set: { cards_ores_ergasias: -1 } });
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    page.setDefaultTimeout(15000);
    await page.goto(origin + '/review');
    await page.waitForFunction(() => typeof loadResults === 'function');
    async function refresh(targetPage = page, employeeCode = '0001', stage = 1) {
        // Selection has its own #311 coverage. Exercise the real read-only loading
        // pipeline directly, avoiding unrelated asynchronous dropdown preselection.
        const loaded = await targetPage.evaluate(async employeeCode => {
            document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
            document.getElementById('kodikos').value = employeeCode;
            requestEmploymentReviewCurrentStageAutoOpen();
            try { return await loadResults(); }
            finally { cancelEmploymentReviewCurrentStageAutoOpen(); }
        }, employeeCode);
        assert.notEqual(loaded, false);
        await targetPage.locator(`[data-guidance-stage="STAGE${stage}"] [data-guidance-move="first"]`).waitFor();
    }
    await refresh();
    const guide = page.locator('[data-guidance-stage="STAGE1"]');
    const panel = page.locator('#employmentReviewGuidancePopover');
    const day = date => page.locator(`.weekly-hr-stage1-card [data-guidance-date="${date}"]`);
    const before = await data.snapshot();
    assert.equal(await guide.locator('.review-guidance-detail').count(), 0, 'no permanent detailed guidance');
    await guide.locator('[data-guidance-move="first"]').click();
    await day('2026-09-01').waitFor();
    await page.mouse.move(1, 1);
    await page.keyboard.press('Escape');
    await day('2026-09-01').hover();
    assert.equal(await panel.isVisible(), false, 'hover alone does not open instructions');
    const dayButton = day('2026-09-01').locator('[data-review-guidance-open]');
    await dayButton.click();
    await panel.waitFor({ state: 'visible' });
    let text = await panel.innerText();
    assert.match(text, /01\/09\/2026/);
    assert.match(text, /δηλωμένες ώρες/);
    assert.match(text, /συνολικές ώρες κάρτας/);
    assert.equal(await panel.locator('.review-guidance-issue').count(), 2);
    assert.doesNotMatch(text, /03\/09\/2026|CATEGORY_REPO_CONFLICT/);
    await panel.hover();
    await page.waitForTimeout(300);
    assert.equal(await panel.isVisible(), true, 'pointer may enter the explanation');
    await panel.locator('[data-review-guidance-close]').click();
    assert.equal(await panel.isVisible(), false);
    assert.equal(await dayButton.evaluate(node => node === document.activeElement), true);
    await dayButton.click();
    await panel.waitFor({ state: 'visible' });
    await dayButton.click();
    assert.equal(await panel.isVisible(), false, 'second click closes instructions');
    assert.equal(await dayButton.getAttribute('aria-expanded'), 'false');
    await day('2026-09-02').hover();
    await page.waitForTimeout(300);
    assert.equal(await panel.isVisible(), false, 'documented rest with no work has no explanation');
    assert.equal(await day('2026-09-02').getAttribute('data-review-guidance-key'), null);
    await day('2026-09-02').locator('button').first().focus();
    await day('2026-09-01').focus();
    assert.equal(await panel.isVisible(), false, 'focus alone does not open instructions');
    await dayButton.focus();
    assert.equal(await panel.isVisible(), false, 'button focus alone does not open instructions');
    await page.keyboard.press('Enter');
    await panel.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    assert.equal(await panel.isVisible(), false);
    assert.equal(await dayButton.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Space');
    await panel.waitFor({ state: 'visible' });
    assert.equal(await panel.locator('[data-review-guidance-close]').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Escape');
    async function checkGeometry(width, name) {
        const rect = await panel.evaluate(node => {
            const r = node.getBoundingClientRect();
            const details = node.querySelector('.review-guidance-detail');
            const contentRect = details.getBoundingClientRect();
            const closeRect = node.querySelector('[data-review-guidance-close]').getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width,
                font: parseFloat(getComputedStyle(node).fontSize),
                closeTop: closeRect.top, closeBottom: closeRect.bottom,
                closeLeft: closeRect.left, closeRight: closeRect.right,
                contentBottom: contentRect.bottom,
                horizontalOverflow: details.scrollWidth > details.clientWidth + 1,
                contentScrolls: details.scrollHeight > details.clientHeight,
                contentOverflowY: getComputedStyle(details).overflowY };
        });
        assert.ok(rect.left >= 9 && rect.right <= width - 9, JSON.stringify(rect));
        assert.ok(rect.top >= 9 && rect.bottom <= 991, JSON.stringify(rect));
        assert.ok(rect.font >= 14 && rect.font <= 15);
        if (width === 1440) assert.ok(rect.width >= 475 && rect.width <= 550);
        assert.ok(rect.closeTop >= rect.contentBottom - 1, JSON.stringify(rect));
        assert.ok(rect.closeBottom <= rect.bottom && rect.closeLeft >= rect.left &&
            rect.closeRight <= rect.right, JSON.stringify(rect));
        assert.equal(rect.horizontalOverflow, false, JSON.stringify(rect));
        if (rect.contentScrolls) assert.equal(rect.contentOverflowY, 'auto', JSON.stringify(rect));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const artifactDir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
        if (artifactDir) {
            fs.mkdirSync(artifactDir, { recursive: true });
            await page.screenshot({ path: path.join(artifactDir, `${name}-${width}.png`), animations: 'disabled' });
        }
    }
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await day('2026-09-01').scrollIntoViewIfNeeded();
        await day('2026-09-01').locator('[data-review-guidance-open]').click();
        await checkGeometry(width, 'day');
        await panel.locator('[data-review-guidance-close]').click();
    }
    assert.equal(await data.snapshot(), before, 'viewing explanations never changes database state');
    // A missing weekly contract term is genuinely week-wide, without inventing a day.
    employee.hmeres_ergasias_ebdomadas = null;
    await refresh();
    await guide.locator('[data-guidance-move="first"]').click();
    await panel.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    const weekStatus = page.locator('.weekly-hr-stage1-card').first().locator('.weekly-hr-stage1-status');
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await weekStatus.scrollIntoViewIfNeeded();
        await weekStatus.locator('[data-review-guidance-open]').click();
        assert.match(await panel.innerText(), /συμβατικών ημερών/);
        assert.doesNotMatch(await panel.innerText(), /Ημέρα εντοπισμού/);
        await checkGeometry(width, 'week');
        await panel.locator('[data-review-guidance-close]').click();
    }
    // A final-stage problem is reached through the same real read-only pipeline,
    // without repeating any of the four-stage business completion commands.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await refresh(page, '0011', 4);
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('[data-guidance-stage="STAGE4"] [data-guidance-move="first"]').click();
        const finalWeekButton = page.locator(
            '.review-guidance-highlight[data-review-guidance-stage="STAGE4"] [data-review-guidance-open]');
        await finalWeekButton.waitFor();
        assert.equal(await panel.isVisible(), false, 'final-stage navigation only locates the case');
        await finalWeekButton.click();
        await panel.waitFor({ state: 'visible' });
        assert.match(await panel.innerText(), /προσαύξηση|προσαύξησης/);
        assert.match(await panel.innerText(), /19\/09\/2026/);
        await checkGeometry(width, 'final-week');
        await panel.locator('[data-review-guidance-close]').click();
    }
    // Real touch events use the explicit information control; day editing stays available.
    const touchContext = await browser.newContext({ viewport: { width: 390, height: 1000 }, isMobile: true, hasTouch: true });
    await touchContext.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const touchPage = await touchContext.newPage();
    await touchPage.goto(origin + '/review');
    touchPage.setDefaultTimeout(15000);
    await touchPage.waitForFunction(() => typeof loadResults === 'function');
    await refresh(touchPage);
    await touchPage.locator('[data-guidance-stage="STAGE1"] [data-guidance-move="first"]').tap();
    // Navigation may still be awaiting the read-only weekly payload after tap.
    // Dismiss the explanation only after that navigation has actually finished.
    await touchPage.locator('#employmentReviewGuidancePopover').waitFor({ state: 'visible' });
    await touchPage.keyboard.press('Escape');
    await touchPage.locator('#employmentReviewGuidancePopover').waitFor({ state: 'hidden' });
    const touchButton = touchPage.locator('.weekly-hr-stage1-card [data-guidance-date="2026-09-01"] [data-review-guidance-open]');
    await touchButton.tap();
    await touchPage.locator('#employmentReviewGuidancePopover').waitFor({ state: 'visible' });
    if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR) await touchPage.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, 'touch-390.png') });
    await touchPage.locator('[data-review-guidance-close]').tap();
    assert.equal(await touchPage.locator('#employmentReviewGuidancePopover').isVisible(), false);
    const expectedCodes = Object.keys(require('../../public/js/ergazomenoi/programmata/employmentReviewGuidance').catalog).sort();
    assert.deepEqual(await page.evaluate(() => Object.keys(EmploymentReviewGuidance.catalog).sort()), expectedCodes);
    assert.equal(await data.snapshot(), before, 'touch and weekly explanations also leave the database unchanged');
    assert.deepEqual(errors, []);
    assert.equal(mongoose.get('sanitizeFilter'), true);
});
