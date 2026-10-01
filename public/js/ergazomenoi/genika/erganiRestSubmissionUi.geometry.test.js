'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../../../');

for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    test(`long WebMA error remains usable at ${viewport.width}x${viewport.height}`, async () => {
        const browser = await chromium.launch({ channel: 'chromium', headless: true });
        try {
            const page = await browser.newPage({ viewport });
            await page.setContent('<!doctype html><html lang="el"><body></body></html>');
            await page.addStyleTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.css') });
            await page.addStyleTag({ path: path.join(root, 'public/css/main.css') });
            await page.addScriptTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js') });
            await page.addScriptTag({ path: path.join(__dirname, 'erganiRestSubmissionUi.js') });
            await page.evaluate(() => {
                window.ErganiRestSubmissionUi.presentSubmissionResultSafely({
                    success: false,
                    submissionCode: 'WebMA',
                    message: 'Έχει λήξει η περίοδος αποδοχής ουσιωδών όρων\\n' +
                        'Υπάρχει ήδη αναγγελία για την ημερομηνία. ' + 'ΠολύΜακρύΚείμενο'.repeat(60)
                });
            });
            const geometry = await page.locator('.swal2-popup').evaluate(popup => {
                const box = popup.getBoundingClientRect();
                const html = popup.querySelector('.swal2-html-container');
                const button = popup.querySelector('.swal2-confirm');
                return {
                    width: box.width, right: box.right, bottom: box.bottom,
                    scrollWidth: popup.scrollWidth, clientWidth: popup.clientWidth,
                    htmlOverflow: html.scrollWidth > html.clientWidth,
                    buttonVisible: !!button && button.getBoundingClientRect().bottom <= innerHeight,
                    lines: html.innerHTML.includes('<br>') && !html.textContent.includes('\\n')
                };
            });
            assert.ok(geometry.width <= Math.min(600, viewport.width * 0.9) + 2, JSON.stringify(geometry));
            assert.ok(geometry.right <= viewport.width && geometry.bottom <= viewport.height, JSON.stringify(geometry));
            assert.equal(geometry.scrollWidth <= geometry.clientWidth, true, JSON.stringify(geometry));
            assert.equal(geometry.htmlOverflow, false, JSON.stringify(geometry));
            assert.equal(geometry.buttonVisible, true, JSON.stringify(geometry));
            assert.equal(geometry.lines, true, JSON.stringify(geometry));
            await page.close();
        } finally {
            await browser.close();
        }
    });
}

test('ordinary legacy error is capped while explicit PDF width remains wide', async () => {
    const browser = await chromium.launch({ channel: 'chromium', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
        await page.setContent('<!doctype html><html><body></body></html>');
        await page.addStyleTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.css') });
        await page.addStyleTag({ path: path.join(root, 'public/css/main.css') });
        await page.addScriptTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js') });
        await page.evaluate(() => { window.Swal.fire({ icon: 'error', text: 'ΜακρύΜήνυμα'.repeat(80) }); });
        const ordinaryWidth = await page.locator('.swal2-popup.swal2-show').evaluate(el => el.getBoundingClientRect().width);
        assert.ok(ordinaryWidth <= 602, `ordinary width ${ordinaryWidth}`);
        await page.evaluate(() => { window.Swal.close(); window.Swal.fire({ width: 1250, customClass: { popup: 'ergani-submitted-pdf-popup' }, html: '<iframe></iframe>' }); });
        const pdfWidth = await page.locator('.swal2-popup.swal2-show').evaluate(el => el.getBoundingClientRect().width);
        assert.ok(pdfWidth >= 1200, `PDF width ${pdfWidth}`);
        await page.evaluate(() => { window.Swal.close(); window.Swal.fire({ width: 800, html: '<table><tr><td>Preview</td></tr></table>' }); });
        const previewWidth = await page.locator('.swal2-popup.swal2-show').evaluate(el => el.getBoundingClientRect().width);
        assert.ok(previewWidth >= 790, `explicit preview width ${previewWidth}`);
    } finally {
        await browser.close();
    }
});

test('WTOLeave compact portrait PDF stays balanced with tall preview and one-row actions', async () => {
    const browser = await chromium.launch({ channel: 'chromium', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        await page.route('https://payroll.test/**', route => route.fulfill({
            contentType: 'text/html', body: '<!doctype html><html><body></body></html>'
        }));
        await page.goto('https://payroll.test/');
        await page.addStyleTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.css') });
        await page.addStyleTag({ path: path.join(root, 'public/css/main.css') });
        await page.addScriptTag({ path: path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js') });
        await page.addScriptTag({ path: path.join(__dirname, 'erganiRestSubmissionUi.js') });
        await page.evaluate(() => {
            window.ErganiRestSubmissionUi.presentSubmissionResultSafely({
                success: true,
                submissionCode: 'WTOLeave',
                processDescription: 'Οργάνωση Χρόνου Εργασίας - Άδειες',
                protocol: 'ΟΡ70202286',
                pdfViewerVariant: 'compact-portrait',
                pdfUrl: '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439011'
            });
        });
        const geometry = await page.locator('.ergani-submitted-pdf-popup--compact-portrait')
            .evaluate(popup => {
                const box = popup.getBoundingClientRect();
                const iframe = popup.querySelector('.pdf-preview-iframe').getBoundingClientRect();
                const actions = popup.querySelector('.pdf-preview-actions');
                const buttons = [...actions.children].map(item => item.getBoundingClientRect());
                const style = getComputedStyle(actions);
                return {
                    width: box.width,
                    height: box.height,
                    bottom: box.bottom,
                    iframeHeight: iframe.height,
                    iframeWidth: iframe.width,
                    actionWrap: style.flexWrap,
                    actionGap: parseFloat(style.gap),
                    singleRow: buttons.every(item => Math.abs(item.top - buttons[0].top) < 2)
                };
            });
        assert.ok(geometry.width < 600, JSON.stringify(geometry));
        assert.ok(geometry.height >= 580 && geometry.height <= 610, JSON.stringify(geometry));
        assert.ok(geometry.bottom <= 768, JSON.stringify(geometry));
        assert.ok(geometry.iframeHeight > 350, JSON.stringify(geometry));
        assert.ok(geometry.iframeWidth <= geometry.width, JSON.stringify(geometry));
        assert.equal(geometry.actionWrap, 'nowrap', JSON.stringify(geometry));
        assert.ok(geometry.actionGap >= 11, JSON.stringify(geometry));
        assert.equal(geometry.singleRow, true, JSON.stringify(geometry));
    } finally {
        await browser.close();
    }
});
