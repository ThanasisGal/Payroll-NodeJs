'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const { root, dataFor } = require('../../../../test/fixtures/responsiveForms');
const { strip, viewport, settleLayout } = require('../../../../test/helpers/responsiveFormsBrowser');
const origin = 'https://schedule-fixture.invalid';
const downloadPath = '/ergazomenoi/programmata/downloadSchedule';
const reference = '6c5fa2ab-bb50-4d22-93f3-d6b889d977b2';

test('real Chromium preserves confirmation, safe persistent errors and responsive actions', { timeout: 120000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const file = 'views/ergazomenoi/programmata/lhpshOrarionApoErganh.ejs';
        const data = { ...dataFor(file), rec: {},
            periodRec: { apo: '2026-10-01', eos: '2026-10-31' } };
        const form = await ejs.renderFile(path.join(root, file), data);
        const html = strip(await ejs.renderFile(path.join(root, 'views/layouts/main.ejs'), { ...data, body: form }));
        const requests = [], pageErrors = [];
        let mode = { status: 500, payload: { success: false, error: { code: 'SCHEDULE_PROCESSING_FAILED',
            correlationId: reference, storageState: 'uncertain' } } };
        page.on('pageerror', error => pageErrors.push(error.message));
        // Every request is fulfilled or aborted locally. No application or ERGANI is contacted.
        await page.route('**/*', route => {
            const request = route.request();
            if (request.url() === `${origin}/fixture`) {
                return route.fulfill({ contentType: 'text/html', body: html });
            }
            if (request.url() === origin + downloadPath && request.method() === 'POST') {
                requests.push(JSON.parse(request.postData()));
                if (mode.networkFailure) return route.abort('failed');
                return route.fulfill({ status: mode.status, contentType: mode.contentType || 'application/json',
                    headers: { 'X-Correlation-ID': reference },
                    body: mode.rawBody === undefined ? JSON.stringify(mode.payload) : mode.rawBody });
            }
            return route.abort();
        });
        await page.goto(`${origin}/fixture`);
        for (const file of ['public/css/bootstrap.min.css', 'node_modules/sweetalert2/dist/sweetalert2.css',
            'public/css/main.css', 'public/css/navTabs.css']) {
            await page.addStyleTag({ path: path.join(root, file) });
        }
        for (const file of ['node_modules/sweetalert2/dist/sweetalert2.all.js',
            'public/js/common/formLayout.js', 'public/js/ergazomenoi/programmata/erganiFormsSwal.js',
            'public/js/ergazomenoi/programmata/downloadScheduleButton.js']) {
            await page.addScriptTag({ path: path.join(root, file) });
        }
        await page.evaluate(() => {
            document.getElementById('ypokatasthmata').add(new Option('0000 — Συνθετικό παράρτημα', '0', true, true));
            document.getElementById('ypokatasthmaHidden').value = '0';
            document.querySelector('.loader-container')?.style.setProperty('display', 'none');
            document.dispatchEvent(new Event('DOMContentLoaded'));
        });
        await page.locator('#downloadScheduleButton').click();
        await page.locator('.swal2-cancel').click();
        assert.equal(requests.length, 0);
        for (const scenario of [
            ...[400, 401, 403, 409, 500].map(status => ({ status, payload: { success: false,
                error: { code: 'SCHEDULE_INTERNAL_ERROR', correlationId: reference, storageState: 'not_started' },
                message: '<img src=x onerror=alert(1)>synthetic-secret-marker' } })),
            { status: 200, payload: { success: false } },
            { status: 200, rawBody: '{invalid' },
            { status: 200, contentType: 'text/html', rawBody: '<html>synthetic-secret-marker</html>' },
            { networkFailure: true }
        ]) {
            mode = scenario;
            const count = requests.length;
            await page.locator('#downloadScheduleButton').click();
            assert.equal(requests.length, count);
            await page.locator('.swal2-confirm').click();
            await page.locator('.swal2-error').waitFor({ state: 'visible' });
            const message = await page.locator('.swal2-html-container').innerText();
            assert.match(message, /Κωδικός αναφοράς: SCHEDULE_/);
            assert.equal(message.includes('synthetic-secret-marker'), false);
            assert.equal(await page.evaluate(() => Swal.getTimerLeft()), undefined);
            assert.equal(requests.length, count + 1);
            assert.equal(page.url(), `${origin}/fixture`);
            await page.locator('.swal2-confirm').click();
            await page.locator('.swal2-container').waitFor({ state: 'hidden' });
            assert.equal(page.url(), `${origin}/fixture`);
        }
        mode = { status: 500, payload: { success: false, error: { code: 'SCHEDULE_PROCESSING_FAILED',
            correlationId: reference, storageState: 'uncertain' } } };
        await page.locator('#downloadScheduleButton').click();
        await page.locator('.swal2-confirm').click();
        await page.locator('.swal2-error').waitFor({ state: 'visible' });
        for (const [width, height] of [[1920,1080], [1680,1050], [1600,900], [1440,900],
            [1280,1024], [1280,800], [1280,720], [800,600], [390,640]]) {
            for (const open of [false, true]) {
                await viewport(page, width, height, open);
                await settleLayout(page);
                const geometry = await page.evaluate(() => {
                    const popup = Swal.getPopup(), content = Swal.getHtmlContainer(), button = Swal.getConfirmButton();
                    const bounds = element => { const r = element.getBoundingClientRect();
                        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
                    const r = button.getBoundingClientRect();
                    const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                    return { popup: bounds(popup), button: bounds(button),
                        font: parseFloat(getComputedStyle(content).fontSize),
                        whiteSpace: getComputedStyle(content).whiteSpace,
                        contentOverflow: content.scrollWidth - content.clientWidth,
                        reachable: target === button || button.contains(target) };
                });
                assert.ok(geometry.popup.left >= -1 && geometry.popup.right <= width + 1, `${width} popup width`);
                assert.ok(geometry.popup.top >= -1 && geometry.popup.bottom <= height + 1, `${height} popup height`);
                assert.ok(geometry.font >= 13.6, `Readable error at ${width}`);
                assert.equal(geometry.whiteSpace, 'pre-line');
                assert.ok(geometry.contentOverflow <= 2, `Wrapped reference at ${width}`);
                assert.ok(geometry.reachable, `Reachable close button at ${width} sidebar=${open}`);
                if (process.env.PAYROLL_SCHEDULE_DIAGNOSTICS_ARTIFACT_DIR) {
                    fs.mkdirSync(process.env.PAYROLL_SCHEDULE_DIAGNOSTICS_ARTIFACT_DIR, { recursive: true });
                    await page.screenshot({ path: path.join(process.env.PAYROLL_SCHEDULE_DIAGNOSTICS_ARTIFACT_DIR,
                        `schedule-error-${width}x${height}-sidebar-${open}.png`) });
                }
            }
        }
        assert.deepEqual(pageErrors, []);
    } finally { await browser.close(); }
});
