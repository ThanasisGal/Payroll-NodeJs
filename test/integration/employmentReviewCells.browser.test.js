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

test('fresh searches and uniform single-layer day cells in Chromium at 1440 and 390', {
    skip: !uri || !vendor, timeout: 120000
}, async t => {
    const data = await createGuidanceFixture(uri, vendor, { employmentScenarios: true });
    t.after(() => mongoose.disconnect());
    const employee = data.employees.find(e => e.kodikos === '0001');
    await data.D.collection.updateMany({ employee_id: employee._id,
        hmeromhnia: { $in: [new Date('2026-09-29'), new Date('2026-09-30')] } },
        { $set: { cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
            kathgoria_ergasias_apologistika: '', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' } });
    // Real completion commands seed old attestations; subsequent synthetic input
    // changes happen before the first browser search, never during a read.
    for (const [start, end] of [['2026-09-07', '2026-09-13'], ['2026-09-14', '2026-09-20']]) {
        await data.complete({ employee_id: String(employee._id), ypokatasthma: '0000',
            week_start: start, week_end: end }, 'Συνθετική προηγούμενη επιβεβαίωση', `cells-${start}`);
        await data.D.collection.updateOne({ employee_id: employee._id, hmeromhnia: new Date(start) },
            { $set: { ores_ergasias: 7.5 } });
    }
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    t.after(() => new Promise(r => server.close(r)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext();
    await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/review');
    page.setDefaultTimeout(15000);
    await page.waitForFunction(() => typeof loadResults === 'function');
    const before = await data.snapshot();
    const writes = [];
    mongoose.set('debug', (collection, method) => {
        if (/^(insert|update|delete|replace|findOneAnd)/.test(method)) writes.push({ collection, method });
    });
    t.after(() => mongoose.set('debug', false));
    await page.evaluate(async () => {
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0001';
        requestEmploymentReviewCurrentStageAutoOpen();
        try { await loadResults(); } finally { cancelEmploymentReviewCurrentStageAutoOpen(); }
        await loadPreparedWeeklyHrStage1();
        // A second search must reevaluate the same evidence without recording
        // a new attestation, decision or audit.
        await loadResults();
        await loadPreparedWeeklyHrStage1();
    });
    const fresh = await page.evaluate(() => [...weeklyHrStage1Payloads.values()].map(p => ({
        week: p.scope.week_start, status: p.lifecycle_projection.stages.stage1.business_status,
        persisted: p.lifecycle_projection.stages.stage1.persisted_status,
        dates: p.lifecycle_projection.stages.stage1.pending_dates,
        selectable: isWeeklyHrStage1Selectable(p), completable: isWeeklyHrStage1Completable(p)
    })));
    const settled = fresh.find(p => p.week === '2026-09-07');
    assert.equal(settled.persisted, 'STALE');
    assert.equal(settled.status, 'COMPLETED');
    const pending = fresh.find(p => p.week === '2026-09-14');
    assert.equal(pending.persisted, 'STALE');
    assert.equal(pending.status, 'OPEN');
    assert.deepEqual(pending.dates, ['2026-09-15']);
    assert.equal(pending.selectable && pending.completable, true, 'fresh pending input remains actionable');
    const failures = [];
    const results = [];
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => document.getElementById('employmentReviewStage1Collapse').classList.add('show'));
        await page.locator('.weekly-hr-stage1-table').scrollIntoViewIfNeeded();
        const measurements = await page.evaluate(() => {
            const cells = [...document.querySelectorAll('.weekly-hr-stage1-matrix-day-cell')];
            return cells.map(cell => {
                const frame = cell.querySelector('.weekly-hr-stage1-day-tile,.weekly-hr-stage1-readonly-tile');
                if (!frame) return { blank: cell.textContent === '', children: cell.children.length };
                const button = frame.querySelector('button') || frame;
                const c = cell.getBoundingClientRect(), f = frame.getBoundingClientRect(), b = button.getBoundingClientRect();
                const cs = getComputedStyle(cell), s = getComputedStyle(frame), bs = getComputedStyle(button);
                const textFits = [...button.querySelectorAll('strong,span,small')].every(node => {
                    const range = document.createRange(); range.selectNodeContents(node);
                    const text = range.getBoundingClientRect(), n = node.getBoundingClientRect();
                    return text.left >= n.left - .5 && text.right <= n.right + .5 &&
                        text.top >= b.top && text.bottom <= b.bottom;
                });
                return { date: cell.dataset.guidanceDate, month: button.querySelector('small')?.textContent || '',
                    cellWidth: c.width, width: f.width, height: f.height, left: f.left-c.left, right: c.right-f.right,
                    paddingLeft: s.paddingLeft, paddingRight: s.paddingRight,
                    frameBackground: s.backgroundColor, buttonBackground: bs.backgroundColor,
                    buttonBorder: bs.borderTopWidth, buttonShadow: bs.boxShadow, cellShadow: cs.boxShadow,
                    buttonFits: b.left >= f.left && b.right <= f.right && b.bottom <= f.bottom,
                    verticalCenter: Math.abs((f.top+f.bottom)-(c.top+c.bottom)) <= 1,
                    buttonPaddingLeft: bs.paddingLeft, buttonPaddingRight: bs.paddingRight,
                    textFits, label: button.querySelector('strong').textContent,
                    centered: bs.alignItems === 'center' && bs.justifyContent === 'center' &&
                        Math.abs((b.left+b.right)-(f.left+f.right)) < 1 &&
                        Math.abs((b.top+b.bottom)-(f.top+f.bottom)) < 1,
                    classes: [cell.className, frame.className, button.className],
                    before: getComputedStyle(frame, '::before').content, after: getComputedStyle(frame, '::after').content };
            });
        });
        results.push({ width, measurements });
        const statusControls = await page.locator('.weekly-hr-stage1-status button').evaluateAll(nodes => nodes.map(n => {
            const r = n.getBoundingClientRect(), cell = n.closest('td').getBoundingClientRect();
            const range = document.createRange(); range.selectNodeContents(n);
            const text = range.getBoundingClientRect();
            return { text: n.textContent, textFits: text.left >= r.left && text.right <= r.right,
                left: r.left-cell.left, right: cell.right-r.right,
                width: r.width, cellWidth: cell.width, minWidth: getComputedStyle(n).minWidth };
        }));
        const visible = measurements.filter(m => m.date);
        const check = (ok, message) => { if (!ok) failures.push(`${width}: ${message}`); };
        for (const control of statusControls) check(control.left >= 0 && control.right >= 0 && control.textFits,
            `status control overlaps day cells: ${JSON.stringify(control)}`);
        for (const m of visible) {
            check(Math.abs(m.left-m.right) <= 1, `asymmetric ${m.date} ${m.left}/${m.right}`);
            check(Math.abs(m.width-visible[0].width) <= 1 && Math.abs(m.height-visible[0].height) <= 1, `dimensions ${m.date}`);
            check(m.buttonFits && m.textFits && m.centered && m.verticalCenter, `overflow/alignment ${m.date}`);
            check(m.buttonPaddingLeft === m.buttonPaddingRight, `padding ${m.date}`);
            check(m.before === 'none' && m.after === 'none', `pseudo layer ${m.date}`);
            check(m.month === ({ '08': 'Αύγουστος', '09': 'Σεπτέμβριος', '10': 'Οκτώβριος' })[m.date.slice(5,7)], `month ${m.date}: ${m.month}`);
            if (m.classes[1].includes('day-tile')) {
                check(m.buttonBackground === 'rgba(0, 0, 0, 0)' && m.buttonBorder === '0px' && m.buttonShadow === 'none', `second layer ${m.date}`);
            }
            check(m.cellShadow === 'none', `cell layer ${m.date}`);
        }
        assert.ok(visible.some(m => m.label === 'ΠΙΘ. ΑΔΕΙΑ'), 'long labels really rendered');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        // Exercise real selection plus focus/guidance on 29/09, keeping one frame.
        const target = page.locator('.weekly-hr-stage1-card [data-guidance-date="2026-09-29"]');
        await target.locator('.weekly-hr-stage1-day-select').check();
        const selected = await target.locator('.weekly-hr-stage1-day-tile').evaluate(n => ({
            border: getComputedStyle(n).borderColor, background: getComputedStyle(n).backgroundColor,
            innerBorder: getComputedStyle(n.querySelector('button')).borderTopWidth }));
        assert.equal(selected.border, 'rgb(13, 110, 253)');
        assert.equal(selected.innerBorder, '0px');
        assert.equal(selected.background, 'rgb(207, 226, 255)');
        await target.locator('.weekly-hr-stage1-day-select').uncheck();
        await target.focus();
        await target.evaluate(n => n.classList.add('review-guidance-highlight'));
        const highlight = await target.evaluate(n => ({ outline: getComputedStyle(n).outlineStyle,
            border: getComputedStyle(n.querySelector('.weekly-hr-stage1-day-tile')).borderTopColor }));
        assert.equal(highlight.outline, 'none');
        assert.equal(highlight.border, 'rgb(13, 110, 253)');
        await page.keyboard.press('Escape');
        await target.evaluate(n => n.classList.remove('review-guidance-highlight'));
        await target.evaluate(n => {
            const id = n.querySelector('.weekly-hr-stage1-open-editor').dataset.rowId;
            weeklyHrStage1DayDrafts.set(id, { classification: 'ABSENCE' });
            rerenderWeeklyHrStage1Rows();
        });
        const draft = await target.locator('.weekly-hr-stage1-day-tile').evaluate(n => ({
            pending: n.classList.contains('is-pending'), draft: n.classList.contains('has-draft'),
            background: getComputedStyle(n).backgroundColor, shadow: getComputedStyle(n).boxShadow,
            height: n.getBoundingClientRect().height,
            innerBorder: getComputedStyle(n.querySelector('button')).borderTopWidth
        }));
        assert.deepEqual(draft, { pending: false, draft: true, background: 'rgb(238, 246, 255)',
            shadow: 'none', height: 72, innerBorder: '0px' });
        await target.evaluate(n => {
            weeklyHrStage1DayDrafts.delete(n.querySelector('.weekly-hr-stage1-open-editor').dataset.rowId);
            rerenderWeeklyHrStage1Rows();
        });
        const art = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
        if (art) {
            fs.mkdirSync(art, { recursive: true });
            async function captureCell(date, name) {
                const cell = page.locator(`.weekly-hr-stage1-card [data-guidance-date="${date}"]`);
                await cell.locator('.weekly-hr-stage1-day-tile').scrollIntoViewIfNeeded();
                await cell.evaluate(n => {
                    const shell = n.closest('.weekly-hr-stage1-table-shell');
                    shell.scrollLeft += n.getBoundingClientRect().left - shell.getBoundingClientRect().left - 20;
                    if (innerWidth > 767) {
                        const scroller = n.closest('.employment-review-scroll-container');
                        const toolbar = document.querySelector('.weekly-hr-stage1-bulk-toolbar');
                        const header = n.closest('table').querySelector('thead');
                        const tile = n.querySelector('.weekly-hr-stage1-day-tile');
                        scroller.scrollTop += tile.getBoundingClientRect().top - scroller.getBoundingClientRect().top -
                            toolbar.getBoundingClientRect().height - header.getBoundingClientRect().height - 12;
                    }
                    document.activeElement?.blur();
                    closeEmploymentReviewGuidancePopover(false);
                });
                await page.mouse.move(1, 1);
                await page.screenshot({ path: path.join(art, `${name}-${width}.png`), fullPage: true });
            }
            await captureCell('2026-09-29', 'cells');
            await captureCell('2026-08-31', 'first-week');
            fs.writeFileSync(path.join(art, `cells-${width}.json`), JSON.stringify(measurements, null, 2));
        }
    }
    await page.evaluate(async () => {
        document.getElementById('kodikos').value = '0032';
        await loadResults();
        await loadPreparedWeeklyHrStage1();
    });
    const excluded = await page.locator('.weekly-hr-stage1-matrix-day-cell.employment-review-outside-employment').evaluateAll(nodes => nodes.map(n => ({
        text: n.textContent, children: n.children.length, background: getComputedStyle(n).backgroundColor,
        shadow: getComputedStyle(n).boxShadow
    })));
    assert.ok(excluded.length > 0);
    for (const cell of excluded) assert.deepEqual(cell, { text: '', children: 0, background: 'rgb(233, 236, 239)', shadow: 'none' });
    assert.equal(await data.snapshot(), before, 'search and projection never write');
    assert.deepEqual(writes, [], 'no database mutations during searches, selection or navigation');
    assert.equal(mongoose.get('sanitizeFilter'), true);
    assert.deepEqual(errors, []);
    console.log('Cell geometry:', JSON.stringify(results.map(r => ({ width: r.width, sample: r.measurements.filter(m => ['2026-09-29','2026-09-30'].includes(m.date)) }))));
    assert.deepEqual(failures, []);
});
