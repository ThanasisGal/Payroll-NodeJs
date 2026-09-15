'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const controller = source.slice(source.indexOf('function initEmploymentReviewScrollToTop'),
    source.indexOf("document.addEventListener('DOMContentLoaded', initEmploymentReviewScrollToTop)"));
const view = fs.readFileSync(path.join(root, 'views/ergazomenoi/programmata',
    'elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
assert.equal((view.match(/id="employmentReviewScrollToTop"/g) || []).length, 1);
assert.match(view, /aria-label="Επιστροφή στην κορυφή"/);

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent(`<!doctype html><style>
            .area { width: 250px; height: 100px; overflow-y: auto; }
            .area > div { height: 500px; }
            .horizontal { width: 250px; height: 100px; overflow-x: auto; overflow-y: hidden; }
            .horizontal > div { width: 500px; height: 50px; }
        </style><section id="employmentReviewWorkspace">
            <div id="stage1" class="area"><div></div></div>
            <div id="stage3" class="area"><div></div></div>
            <div id="horizontal" class="horizontal"><div></div></div>
            <div class="modal"><div id="modal-area" class="area"><div></div></div></div>
            <button type="button" id="employmentReviewScrollToTop" hidden></button>
        </section><div id="outside" class="area"><div></div></div>`);
        await page.addScriptTag({ content: `${controller}\ninitEmploymentReviewScrollToTop();` });
        assert.equal(await page.locator('#employmentReviewScrollToTop').isVisible(), false);
        await page.evaluate(() => {
            for (const id of ['horizontal', 'modal-area']) {
                const target = document.getElementById(id);
                target.scrollTop = 180;
                target.dispatchEvent(new Event('scroll'));
            }
        });
        assert.equal(await page.locator('#employmentReviewScrollToTop').isVisible(), false);
        await page.evaluate(() => {
            const first = document.getElementById('stage1');
            first.scrollTop = 160;
            first.dispatchEvent(new Event('scroll'));
        });
        assert.equal(await page.locator('#employmentReviewScrollToTop').isVisible(), true);
        await page.evaluate(() => {
            const first = document.getElementById('stage1');
            first.scrollTo = (options) => { window.lastScroll = { id: first.id, options }; };
        });
        await page.locator('#employmentReviewScrollToTop').click();
        assert.deepEqual(await page.evaluate(() => window.lastScroll),
            { id: 'stage1', options: { top: 0, behavior: 'smooth' } });
        await page.evaluate(() => {
            const second = document.getElementById('stage3');
            second.scrollTop = 170;
            second.scrollTo = (options) => { window.lastScroll = { id: second.id, options }; };
            second.dispatchEvent(new Event('scroll'));
        });
        await page.locator('#employmentReviewScrollToTop').click();
        assert.deepEqual(await page.evaluate(() => window.lastScroll),
            { id: 'stage3', options: { top: 0, behavior: 'smooth' } });
        await page.evaluate(() => {
            const second = document.getElementById('stage3');
            second.scrollTop = 0;
            second.dispatchEvent(new Event('scroll'));
        });
        assert.equal(await page.locator('#employmentReviewScrollToTop').isVisible(), false);
        await page.evaluate(() => {
            const outside = document.getElementById('outside');
            outside.scrollTop = 180;
            outside.dispatchEvent(new Event('scroll'));
            document.getElementById('stage1').outerHTML =
                '<div id="stage1-new" class="area"><div></div></div>';
            const next = document.getElementById('stage1-new');
            next.scrollTop = 180;
            next.dispatchEvent(new Event('scroll'));
        });
        assert.equal(await page.locator('#employmentReviewScrollToTop').count(), 1);
        assert.equal(await page.locator('#employmentReviewScrollToTop').isVisible(), true);
        await page.evaluate(() => {
            const next = document.getElementById('stage1-new');
            next.scrollTo = (options) => { window.lastScroll = { id: next.id, options }; };
        });
        await page.locator('#employmentReviewScrollToTop').click();
        assert.deepEqual(await page.evaluate(() => window.lastScroll),
            { id: 'stage1-new', options: { top: 0, behavior: 'smooth' } });
        console.log('employment review scroll-to-top UI tests passed');
    } finally {
        await browser.close();
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
