'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const frontend = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const wrapper = frontend.slice(0, frontend.indexOf('function userCanReviewEdit'));
const mainCss = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
const sweetAlertCss = fs.readFileSync(
    path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.css'), 'utf8');
const sweetAlertJs = fs.readFileSync(
    path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js'), 'utf8');
assert.match(mainCss,
    /\.swal2-popup\.employment-review-swal-popup \.swal2-html-container[\s\S]*?font-size:\s*0\.95rem\s*!important/);
assert.match(mainCss,
    /\.swal2-popup\.employment-review-swal-popup \.swal2-html-container[\s\S]*?line-height:\s*1\.45/);

function visibleButtonState(page) {
    return page.evaluate(() => Object.fromEntries(['confirm', 'deny', 'cancel'].map((kind) => {
        const button = document.querySelector(`.swal2-${kind}`);
        const visible = Boolean(button && getComputedStyle(button).display !== 'none' &&
            button.getBoundingClientRect().width > 0 && button.getBoundingClientRect().height > 0);
        return [kind, { visible, label: button?.textContent?.trim() || '',
            classes: button?.className || '' }];
    })));
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent(`<!doctype html><html><head><meta name="csrf-token" content="test">
            <style>${sweetAlertCss}</style><style>${mainCss}</style></head><body></body></html>`);
        await page.addScriptTag({ content: sweetAlertJs });
        await page.addScriptTag({ content: wrapper });

        await page.evaluate(() => { employmentReviewSwal({ title: 'Έλεγχος περίπτωσης',
            text: 'Δεν υπάρχει διαθέσιμη ασφαλής αυτόματη απόφαση.',
            showConfirmButton: false, showDenyButton: false,
            showCancelButton: true, cancelButtonText: 'Κλείσιμο' }); });
        const noSafe = await visibleButtonState(page);
        assert.equal(noSafe.confirm.visible, false);
        assert.equal(noSafe.deny.visible, false);
        assert.equal(noSafe.cancel.visible, true);
        assert.equal(noSafe.cancel.label, 'Κλείσιμο');
        assert.doesNotMatch(noSafe.confirm.classes, /custom-swal-button|custom-confirm-button/);
        await page.evaluate(() => Swal.close());

        await page.evaluate(() => { employmentReviewSwal({ title: 'Έλεγχος περίπτωσης',
            html: '<strong>Τι θα αλλάξει</strong><br>Ρεπό → Εργασία',
            showConfirmButton: true, confirmButtonText: 'Εφαρμογή μεταφοράς',
            showDenyButton: true, denyButtonText: 'Η μεταφορά δεν ισχύει',
            showCancelButton: true, cancelButtonText: 'Ακύρωση' }); });
        const safe = await visibleButtonState(page);
        assert.deepEqual(Object.fromEntries(Object.entries(safe)
            .map(([kind, state]) => [kind, state.visible])),
        { confirm: true, deny: true, cancel: true });
        assert.equal(safe.confirm.label, 'Εφαρμογή μεταφοράς');
        assert.equal(safe.deny.label, 'Η μεταφορά δεν ισχύει');
        assert.equal(safe.cancel.label, 'Ακύρωση');
        assert.match(await page.locator('.swal2-html-container').innerText(), /Τι θα αλλάξει/);
    } finally {
        await browser.close();
    }
    console.log('weekly HR Stage-2 Swal visible-button tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
