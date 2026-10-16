'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');

// Optional visual run against the isolated app. Only static GETs reach it;
// synthetic pages and transactional fixtures remain inside the browser tests.
const appOrigin = process.env.PAYROLL_BROWSER_APP_ORIGIN;
if (appOrigin) assert.equal(appOrigin, 'http://127.0.0.1:5001');
const origin = appOrigin || 'https://payroll.test';
// Offline browser runs can use the exact asserted SweetAlert version outside the repository.
const sweetAlertVendor = process.env.PAYROLL_SWEETALERT_VENDOR_DIR;
const asset = (root, file) => sweetAlertVendor && file.startsWith('node_modules/sweetalert2/dist/')
    ? { path: path.join(sweetAlertVendor, path.basename(file)) }
    : appOrigin && file.startsWith('public/')
    ? { url: `${origin}/static/${file.slice('public/'.length)}` }
    : { path: path.join(root, file) };

async function assertChoiceAligned(page, inputId) {
    const positions = await page.locator(`#${inputId}`).evaluate(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const i = input.getBoundingClientRect(), l = label.getBoundingClientRect();
        return { delta: Math.abs(i.y + i.height / 2 - l.y - l.height / 2),
            gap: l.x - i.right, inputHeight: i.height, labelHeight: l.height,
            align: getComputedStyle(input.parentElement).alignItems };
    });
    assert.equal(positions.align, 'center');
    assert.ok(positions.inputHeight > 0 && positions.labelHeight > 0);
    assert.ok(positions.gap >= 0, JSON.stringify(positions));
    assert.ok(positions.delta <= 1, JSON.stringify(positions));
}
module.exports = { origin, asset, assertChoiceAligned };
