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
