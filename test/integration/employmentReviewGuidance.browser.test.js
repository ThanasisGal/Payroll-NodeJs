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

test('four stages in real Chromium with isolated MongoDB and real workflow commands', {
    skip: !uri || !vendorDir, timeout: 180000
}, async t => {
    const data = await createGuidanceFixture(uri, vendorDir);
    t.after(() => mongoose.disconnect());
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await browserContext.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await browserContext.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (['warning', 'error'].includes(message.type())) console.error('Browser diagnostic:', message.text()); });
    t.after(() => { if (errors.length) console.error('Browser errors:', errors); });
    page.setDefaultTimeout(15000);
    const artifactDir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
    async function capture(name) {
        if (!artifactDir) return;
        await page.waitForFunction(() => !document.body.classList.contains('loader-active'));
        fs.mkdirSync(artifactDir, { recursive: true });
        await page.screenshot({ path: path.join(artifactDir, name + '.png'), fullPage: true, animations: 'disabled' });
        const visibleGuide = page.locator('[data-guidance-stage]:visible');
        if (await visibleGuide.count() === 1) {
            await visibleGuide.evaluate(node => {
                const inner = node.closest('.employment-review-scroll-container');
                const scroller = getComputedStyle(inner).overflowY === 'visible' ? node.closest('.review-card-body') : inner;
                scroller.scrollTop += node.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
            });
            await page.screenshot({ path: path.join(artifactDir, name + '-detail.png'), fullPage: true, animations: 'disabled' });
            const navigation = visibleGuide.locator('.review-guidance-navigation');
            if (await navigation.count()) {
                await navigation.evaluate(node => {
                    const inner = node.closest('.employment-review-scroll-container');
                    const scroller = getComputedStyle(inner).overflowY === 'visible' ? node.closest('.review-card-body') : inner;
                    scroller.scrollTop += node.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
                });
                await page.screenshot({ path: path.join(artifactDir, name + '-navigation.png'), fullPage: true, animations: 'disabled' });
            }
        }
    }
    await page.goto(origin + '/review');
    await page.waitForFunction(() => Boolean(window.EmploymentReviewEmployees && window.EmploymentReviewBranches && document.getElementById('ypokatasthma').tomselect));
    await page.locator('#ypokatasthma + .ts-wrapper .ts-control').click();
    await page.locator('#ypokatasthma + .ts-wrapper .option[data-value="0000"]').click();
    await page.waitForFunction(() => Boolean(document.getElementById('reviewEmployee').tomselect));
    async function search(code) {
        const reset = page.locator('#reviewEmployee + .ts-wrapper .ts-single-reset-btn');
        if (await reset.isVisible()) await reset.click();
        await page.locator('#reviewEmployee + .ts-wrapper .ts-control').click();
        await page.locator('#reviewEmployee + .ts-wrapper .dropdown-input').fill(code);
        await page.locator(`#reviewEmployee + .ts-wrapper .option[data-value="${code}"]`).click();
        await refresh();
    }
    async function refresh() {
        const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/prodhlomena-oraria/review');
        await page.locator('#searchBtn').click();
        assert.equal((await response).status(), 200);
        await page.waitForFunction(() => [...document.querySelectorAll('[data-guidance-stage]')].some(node => node.innerText.trim()));
    }
    const guide = stage => page.locator(`[data-guidance-stage="STAGE${stage}"]`);
    async function active(stage) {
        await guide(stage).waitFor({ state: 'visible' });
        for (const other of [1, 2, 3, 4].filter(value => value !== stage)) assert.equal(await guide(other).isVisible(), false);
    }
    await search('0001');
    await active(1);
    assert.equal(await guide(1).locator('.review-guidance-detail').count(), 0);
    await guide(1).locator('[data-guidance-move="first"]').click();
    const explanation = page.locator('#employmentReviewGuidancePopover');
    let text = await explanation.innerText();
    assert.match(text, /0001.*ΣΥΝΘΕΤΙΚΟΣ/);
    assert.match(text, /31\/08\/2026–06\/09\/2026/);
    assert.match(text, /01\/09\/2026/);
    assert.doesNotMatch(text, /INVALID_DECLARED_WORK_HOURS|ZERO_LENGTH_CARD/);
    await page.keyboard.press('Escape');
    for (const stage of [2, 3, 4]) {
        const prerequisite = page.locator(`[data-guidance-prerequisite="STAGE${stage}"]`);
        assert.equal(await prerequisite.isVisible(), true);
        assert.match(await prerequisite.innerText(), /πρώτα|προϋποθέτει/);
    }
    const beforeNavigation = await data.snapshot();
    await guide(1).locator('[data-guidance-move="first"]').click();
    await page.locator('[data-guidance-date="2026-09-01"].review-guidance-highlight').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.guidanceDate), '2026-09-01');
    await guide(1).locator('[data-guidance-move="next"]').click();
    await page.locator('[data-guidance-date="2026-09-03"].review-guidance-highlight').waitFor();
    text = await explanation.innerText();
    assert.match(text, /Ημέρα εντοπισμού: 03\/09\/2026/);
    assert.match(text, /μηδενικό διάστημα κάρτας/);
    assert.match(text, /09:00–09:00/);
    assert.doesNotMatch(text, /15\/09\/2026/);
    assert.equal(await data.snapshot(), beforeNavigation, 'navigation never changes rows, states, audits or decisions');
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await guide(1).scrollIntoViewIfNeeded();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal page overflow');
        await capture('guidance-stage1-' + width);
    }
    await data.repairSyntheticFirstWeek();
    await refresh();
    // Details now live in the contextual popover, so the summary cannot signal
    // completion by losing an old explanation. Wait for the refreshed targets.
    await page.waitForFunction(() => {
        const targets = EmploymentReviewGuidanceUi.targets(currentCanonicalLifecyclePayloads, 'STAGE1');
        return targets[0]?.date === '2026-09-15' &&
            !targets.some(target => ['2026-09-01', '2026-09-03'].includes(target.date));
    });
    await guide(1).locator('[data-guidance-move="first"]').click();
    await page.locator('[data-guidance-date="2026-09-15"].review-guidance-highlight').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.guidanceDate), '2026-09-15');
    text = await explanation.innerText();
    assert.match(text, /Ημέρα εντοπισμού: 15\/09\/2026/);
    assert.match(text, /πιθανή άδεια/);
    assert.doesNotMatch(text, /03\/09\/2026|μηδενικό διάστημα κάρτας|09:00–09:00/);
    const beforeLeaves = await data.snapshot();
    await guide(1).locator('[data-guidance-move="next"]').click();
    await page.locator('[data-guidance-date="2026-09-22"].review-guidance-highlight').waitFor();
    assert.equal(await data.snapshot(), beforeLeaves);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await search('0009');
    await active(1);
    const employee = data.employees.find(item => item.kodikos === '0009');
    const input = { employee_id: String(employee._id), ypokatasthma: '0000', week_start: '2026-09-14', week_end: '2026-09-20' };
    const completion = await page.request.post(origin + '/api/prodhlomena-oraria/review/weekly-hr-workflow/stage1/bulk-complete', {
        data: { scopes: [input], reason_or_notes: 'Συνθετική επιβεβαίωση ελέγχου', bulk_request_id: 'guidance-browser-stage1-completion' }
    });
    assert.equal(completion.status(), 200, await completion.text());
    assert.equal((await completion.json()).results[0].status, 'COMPLETED');
    await refresh();
    await active(2);
    assert.match(await guide(2).innerText(), /μεταφοράς ρεπό|δηλωμένο ρεπό/);
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await capture('guidance-stage2-' + width);
    }
    const current = await data.context(input);
    const command = current.prepared.record.current_proposal.command;
    const rejection = await page.request.post(origin + '/api/prodhlomena-oraria/review/repo-transfer-decisions', {
        data: { ...command, decision_code: 'REJECT_PROPOSAL', notes: 'Συνθετική απόφαση HR', request_id: 'guidance-browser-rejection' }
    });
    assert.equal(rejection.status(), 200, await rejection.text());
    await refresh();
    await active(3);
    await guide(3).locator('[data-guidance-move="first"]').click();
    assert.match(await explanation.innerText(), /15\/09\/2026/);
    await page.keyboard.press('Escape');
    const beforeStage3Navigation = await data.snapshot();
    await guide(3).locator('[data-guidance-move="first"]').click();
    assert.equal(await data.snapshot(), beforeStage3Navigation);
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await capture('guidance-stage3-' + width);
    }
    const stage3 = (await data.context(input)).lifecycle.stages.stage3;
    const item = stage3.pending_items[0];
    const resolution = await page.request.post(origin + '/api/prodhlomena-oraria/review/weekly-hr-workflow/stage3/resolve-day', {
        data: { ...input, row_id: String(item.row_id), decision_date: item.date,
            expected_input_fingerprint: item.input_fingerprint, expected_stage3_version: stage3.expected_stage3_version || 0,
            final_classification: 'ABSENCE', leave_category: '', reason_or_notes: 'Συνθετικά τεκμηριωμένη απουσία', request_id: 'guidance-browser-stage3-resolution' }
    });
    assert.equal(resolution.status(), 200, await resolution.text());
    await refresh();
    assert.equal((await data.context(input)).lifecycle.stages.stage3.business_status, 'COMPLETED');
    await search('0011');
    await active(4);
    await guide(4).locator('[data-guidance-move="first"]').click();
    assert.match(await explanation.innerText(), /προσαύξηση|προσαύξησης/);
    assert.match(await explanation.innerText(), /19\/09\/2026/);
    await page.keyboard.press('Escape');
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await guide(4).scrollIntoViewIfNeeded();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await capture('guidance-stage4-' + width);
    }
    assert.ok(await data.Audit.countDocuments({ action: 'STAGE1_COMPLETED' }) > 0);
    assert.ok(await data.Audit.countDocuments({ action: 'STAGE3_DAILY_RESOLVED' }) > 0);
    assert.deepEqual(errors, []);
});
