'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../..');
const template = fs.readFileSync(path.join(root,
    'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/stoixeiaProslhpshs.ejs'), 'utf8');
const calculator = fs.readFileSync(path.join(__dirname, 'calcProyphresia.js'), 'utf8');
const base = ['proyphresia_se_eth', 'proyphresia_se_mhnes', 'proyphresia_adeias_se_eth'];
const derived = ['synolo_proyphresias_se_eth', 'synolo_proyphresias_se_mhnes',
    'proyphresia_apozhmioshs_se_eth', 'misthologiko_klimakio'];
const render = rec => ejs.render(template, { rec, ergazomenoiData: {} });
test('server-rendered Edit displays canonical zeros before JavaScript; preserves nonzero experience', () => {
    for (const empty of [undefined, null, '']) {
        const html = render(Object.fromEntries(base.map(field => [field, empty])));
        for (const field of base) assert.match(html,
            new RegExp(`<input[^>]*id="${field}"[^>]*value="0"`), field);
    }
    const html = render({ proyphresia_se_mhnes: null, proyphresia_adeias_se_eth: '' });
    for (const field of base) assert.match(html, new RegExp(`<input[^>]*id="${field}"[^>]*value="0"`));
    for (const field of base) assert.match(render({ [field]: 3 }),
        new RegExp(`<input[^>]*id="${field}"[^>]*value="3"`));
});
test('actual calculator recomputes exactly four readonly outputs while base experience stays zero', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date('2026-10-10T12:00:00') });
        await page.setContent(render({ hmeromhnia_proslhpshs: '2024-04-01',
            ...Object.fromEntries(derived.map(field => [field, 0])) }));
        await page.addScriptTag({ content: calculator });
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
        for (const field of base) assert.equal(await page.locator(`#${field}`).inputValue(), '0');
        for (const [field, value] of derived.map((field, i) => [field, ['2', '6', '2', '3'][i]])) {
            assert.equal(await page.locator(`#${field}`).inputValue(), value, field);
            assert.equal(await page.locator(`#${field}`).getAttribute('readonly'), '', field);
        }
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});
