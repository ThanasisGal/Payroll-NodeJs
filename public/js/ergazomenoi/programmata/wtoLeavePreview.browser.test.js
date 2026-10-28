'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Chromium: incomplete preview is distinct from empty; valid rows remain visible, submission stays blocked', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.route('**/*', route => route.abort());
        const html = ejs.render(read('views/ergazomenoi/programmata/ypovoliAdeion.ejs'), {
            companyName: 'ΣΥΝΘΕΤΙΚΗ ΕΤΑΙΡΕΙΑ', userPrivileges: { export: true },
            csrfToken: 'synthetic-csrf', nonce: 'synthetic', script: () => '#',
            branches: [{ kodikos: '0000', perigrafh: 'ΔΟΚΙΜΗ' }],
            periodRec: { apo: '2026-09-01', eos: '2026-09-30' }
        }).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
        await page.setContent(`<html><body><aside id="syntheticSidebar"></aside><main class="payroll-form-layout">${html}</main><footer class="footer"></footer></body></html>`);
        await page.addStyleTag({ content: read('public/css/bootstrap.min.css') + read('public/css/main.css') +
            'body {margin:0;} .payroll-form-layout {margin:0; padding:0;} .footer {position:fixed; bottom:0; height:20px;}' });
        await page.evaluate(() => {
            window.calls = [];
            window.previewResult = { success: true, actual_from: '', actual_to: '',
                employee_count: 0, employee_day_count: 0, analytics_count: 0,
                rows: [], payload: null, parity: { exact: false }, submission_eligible: false,
                blockers: [{ code: 'WTOLEAVE_INVALID_WEEKLY_DAYS', employee_code: '0002',
                    date: '2026-09-16', message: 'Δεν τεκμηριώνεται πενθήμερη ή εξαήμερη εργασία. ' +
                    '1. Ελέγξτε τους ιστορικούς όρους εργασίας. 2. Εκτελέστε νέα προεπισκόπηση. ' +
                    'Δεν αποθηκεύτηκε καμία αλλαγή και δεν έγινε υποβολή.' }] };
            window.fetch = async (url, options) => {
                window.calls.push({ url, options });
                if (!url.endsWith('/preview')) throw Error('Forbidden submission');
                return { ok: true, json: async () => window.previewResult };
            };
        });
        await page.addScriptTag({ content: read('public/js/ergazomenoi/programmata/wtoLeave.js') });
        await page.locator('#wtoLeaveBranch').selectOption('0000');
        await page.locator('#wtoLeavePreviewButton').click();
        await page.waitForFunction(() => document.querySelector('#wtoLeaveStatus').textContent.includes('ελλιπής'));
        assert.equal(await page.locator('#wtoLeaveDayCount').textContent(), '—');
        assert.match(await page.locator('#wtoLeaveBlockers').textContent(), /Εργαζόμενος 0002, 16\/09\/2026/);
        assert.doesNotMatch(await page.locator('#wtoLeaveRows').textContent(), /Δεν βρέθηκαν υποβλητέες/);
        assert.equal(await page.locator('#wtoLeaveSubmitButton').isDisabled(), true);
        for (const [width, height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],
            [1280,1024],[1280,800],[1280,720],[640,640]]) for (const open of [false,true]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(open => {
                document.querySelector('main').style.marginLeft = open ? '260px' : '0';
                document.querySelector('#syntheticSidebar').hidden = !open;
            }, open);
            await page.waitForTimeout(30);
            const bounds = await page.locator('#wtoLeaveSubmitButton').boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
                `button width ${width}, sidebar ${open}`);
            assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height + 1,
                `button height ${height}, sidebar ${open}`);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
        }
        await page.evaluate(() => {
            window.previewResult.rows = [{ date: '2026-09-17', employee_code: '0001',
                afm: '987654321', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΕΛΕΝΗ',
                leave_type: 'ΑΔΚΑΝ', full_day: true, intervals: [], reference_year: '2026', required_days: '022' }];
        });
        await page.locator('#wtoLeavePreviewButton').click();
        await page.waitForFunction(() => document.querySelector('#wtoLeaveRows').textContent.includes('0001'));
        assert.equal(await page.locator('#wtoLeaveSubmitButton').isDisabled(), true);
        if (process.env.WTOLEAVE_PREVIEW_SCREENSHOT) {
            await page.screenshot({ path: process.env.WTOLEAVE_PREVIEW_SCREENSHOT });
        }
        await page.evaluate(() => { window.previewResult.rows = []; window.previewResult.blockers = []; });
        await page.locator('#wtoLeavePreviewButton').click();
        await page.waitForFunction(() => document.querySelector('#wtoLeaveDayCount').textContent === '0');
        assert.match(await page.locator('#wtoLeaveRows').textContent(), /Δεν βρέθηκαν υποβλητέες/);
        assert.equal(await page.locator('#wtoLeaveSubmitButton').isDisabled(), true);
        await page.evaluate(() => {
            window.previewResult.rows = [{ date: '2026-09-17', employee_code: '0001',
                afm: '987654321', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΕΛΕΝΗ',
                leave_type: 'ΑΔΚΑΝ', full_day: true, intervals: [], reference_year: '2026', required_days: '022' }];
            Object.assign(window.previewResult, { employee_count: 1, employee_day_count: 1,
                analytics_count: 1, payload: { synthetic: true }, parity: { exact: true }, submission_eligible: true });
        });
        await page.locator('#wtoLeavePreviewButton').click();
        await page.waitForFunction(() => !document.querySelector('#wtoLeaveSubmitButton').disabled);
        assert.equal(await page.locator('#wtoLeaveDayCount').textContent(), '1');
        await page.locator('#wtoLeaveFrom').fill('2026-09-02');
        await page.locator('#wtoLeaveFrom').dispatchEvent('change');
        assert.equal(await page.locator('#wtoLeaveSubmitButton').isDisabled(), true);
        assert.equal(await page.evaluate(() => window.calls.length), 4);
        assert.equal(await page.evaluate(() => window.calls.every(item => item.url.endsWith('/preview'))), true);
    } finally { await browser.close(); }
});
