'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const { root, dataFor } = require('../../../../test/fixtures/responsiveForms');
const { strip, viewport, settleLayout } = require('../../../../test/helpers/responsiveFormsBrowser');

test('cards real Chromium distinguishes stored files from applied records and retains readable errors', { timeout: 120000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const file = 'views/ergazomenoi/programmata/lhpshOrarionApoKartes.ejs';
        const data = { ...dataFor(file), rec: {}, periodRec: { apo: '2026-06-01', eos: '2026-06-30' } };
        const form = await ejs.renderFile(path.join(root, file), data);
        const html = strip(await ejs.renderFile(path.join(root, 'views/layouts/main.ejs'), { ...data, body: form }));
        const origin = 'https://cards-fixture.invalid', errors = [], requests = [];
        let response = { status: 500, payload: { success: false, code: 'ERGANI_CARDS_DATABASE_FAILED' } };
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const request = route.request();
            if (request.url() === origin + '/fixture') return route.fulfill({ contentType: 'text/html', body: html });
            if (request.url() === origin + '/ergazomenoi/programmata/downloadCards' && request.method() === 'POST') {
                requests.push(JSON.parse(request.postData()));
                return route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.payload) });
            }
            return route.abort();
        });
        await page.goto(origin + '/fixture');
        for (const asset of ['public/css/bootstrap.min.css', 'node_modules/sweetalert2/dist/sweetalert2.css',
            'public/css/main.css', 'public/css/navTabs.css']) await page.addStyleTag({ path: path.join(root, asset) });
        for (const asset of ['node_modules/sweetalert2/dist/sweetalert2.all.js', 'public/js/common/formLayout.js',
            'public/js/ergazomenoi/programmata/erganiFormsSwal.js', 'public/js/ergazomenoi/programmata/downloadCardsButton.js']) {
            await page.addScriptTag({ path: path.join(root, asset) });
        }
        await page.evaluate(() => {
            document.getElementById('ypokatasthmata').add(new Option('0000 — Συνθετικό παράρτημα', '0', true, true));
            document.getElementById('ypokatasthmaHidden').value = '0';
            document.querySelector('.loader-container')?.style.setProperty('display', 'none');
            document.dispatchEvent(new Event('DOMContentLoaded'));
        });
        for (const scenario of [
            { status: 500, payload: { success: false, code: 'ERGANI_CARDS_DATABASE_FAILED', message: 'synthetic-secret-marker' } },
            { status: 500, payload: { success: false, code: 'ERGANI_CARDS_DATABASE_UNCONFIRMED' } },
            { status: 200, payload: { success: false } },
            { status: 200, payload: { success: 'true' } }
        ]) {
            response = scenario;
            const before = requests.length;
            await page.locator('#downloadCardsButton').click();
            assert.equal(requests.length, before);
            await page.locator('.swal2-confirm').click();
            await page.locator('.swal2-error').waitFor({ state: 'visible' });
            const message = await page.locator('.swal2-html-container').innerText();
            assert.equal(message.includes('synthetic-secret-marker'), false);
            assert.equal(await page.evaluate(() => Swal.getTimerLeft()), undefined);
            if (scenario.payload.code) {
                assert.match(message, /1\..*2\./);
                assert.match(message, new RegExp('Κωδικός αναφοράς: ' + scenario.payload.code));
                if (scenario.payload.code.endsWith('UNCONFIRMED')) assert.match(message, /δεν μπορεί να επιβεβαιωθεί αν αποθηκεύτηκαν αλλαγές/);
                else assert.match(message, /Δεν αποθηκεύτηκε καμία αλλαγή στις εγγραφές εργασίας/);
                for (const [width, height] of [[1920,1080], [1680,1050], [1600,900], [1440,900],
                    [1280,1024], [1280,800], [1280,720], [800,600], [390,640]]) {
                    for (const open of [false, true]) {
                        await viewport(page, width, height, open); await settleLayout(page);
                        const layout = await page.evaluate(() => {
                            const popup = Swal.getPopup().getBoundingClientRect(), content = Swal.getHtmlContainer();
                            const button = Swal.getConfirmButton(), r = button.getBoundingClientRect();
                            const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                            return { left: popup.left, right: popup.right, top: popup.top, bottom: popup.bottom,
                                font: parseFloat(getComputedStyle(content).fontSize), overflow: content.scrollWidth - content.clientWidth,
                                reachable: target === button || button.contains(target) };
                        });
                        assert.ok(layout.left >= -1 && layout.right <= width + 1, `${width}: popup width`);
                        assert.ok(layout.top >= -1 && layout.bottom <= height + 1, `${height}: popup height`);
                        assert.ok(layout.font >= 13.6 && layout.overflow <= 2, `${width}: readable message`);
                        assert.ok(layout.reachable, `${width}x${height}: close button sidebar=${open}`);
                    }
                }
            }
            await page.locator('.swal2-confirm').click();
            await page.locator('.swal2-container').waitFor({ state: 'hidden' });
            assert.equal(page.url(), origin + '/fixture');
            assert.equal(requests.length, before + 1);
        }
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
