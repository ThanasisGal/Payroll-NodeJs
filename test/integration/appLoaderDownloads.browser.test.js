'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const layout = fs.readFileSync(path.join(__dirname, '../../views/layouts/main.ejs'), 'utf8');
const scripts = [...layout.replace(/<%[\s\S]*?%>/g, '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const loader = scripts.find(source => source.includes('const efkaRoot ='));
const links = scripts.find(source => source.includes('// Links:'));

async function withPage(t, run) {
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ acceptDownloads: true });
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
    await page.goto('http://synthetic.test/employee');
    await page.setContent(`<div class="app-loader--simple" data-loader="simple"><span class="app-loader__title"></span><span class="app-loader__meta"></span></div>
        <div id="contractModal"><a id="pdf" href="/contract.pdf" download="σύμβαση.pdf"><span>Λήψη PDF</span></a>
        <button id="continue">Συνέχεια</button></div><a id="navigation" href="/next">Επόμενη σελίδα</a>`);
    await page.addScriptTag({ content: loader });
    await page.addScriptTag({ content: links });
    await page.evaluate(() => {
        window.begins = 0;
        const begin = AppLoader.begin.bind(AppLoader);
        AppLoader.begin = (...args) => { window.begins++; begin(...args); };
        window.pdfChoice = new Promise(resolve => document.querySelector('#continue').onclick = () => {
            window.chosen = true; resolve('continue');
        });
    });
    await run(page);
}

for (const programmatic of [false, true]) {
    test(`PDF download ${programmatic ? 'programmatic click' : 'user click'} keeps user choice usable without AppLoader`, async t => {
        await withPage(t, async page => {
            await page.route('**/contract.pdf', route => route.fulfill({
                contentType: 'application/pdf', headers: { 'Content-Disposition': 'attachment; filename=contract.pdf' },
                body: '%PDF-1.4\nsynthetic download\n%%EOF'
            }));
            const download = page.waitForEvent('download');
            if (programmatic) await page.evaluate(() => document.querySelector('#pdf').click());
            else await page.locator('#pdf span').click();
            assert.ok(await download);
            assert.equal(await page.evaluate(() => window.begins), 0);
            assert.equal(await page.locator('.app-loader--simple.is-visible').count(), 0);
            assert.equal(new URL(page.url()).pathname, '/employee');
            assert.equal(await page.evaluate(() => window.chosen), undefined);
            await page.locator('#continue').click();
            assert.equal(await page.evaluate(() => window.pdfChoice), 'continue');
        });
    });
}

for (const protocol of ['blob', 'data']) {
    test(`${protocol}: programmatic file download has no navigation loader`, async t => {
        await withPage(t, async page => {
            const download = page.waitForEvent('download');
            await page.evaluate(protocol => {
                const a = document.createElement('a');
                a.href = protocol === 'blob' ? URL.createObjectURL(new Blob(['synthetic PDF'])) : 'data:application/pdf,synthetic';
                a.download = 'contract.pdf';
                document.body.append(a); a.click(); a.remove();
            }, protocol);
            assert.ok(await download);
            assert.equal(await page.evaluate(() => window.begins), 0);
        });
    });
}

test('real same-tab navigation retains AppLoader while destination waits', async t => {
    await withPage(t, async page => {
        let report;
        const shown = new Promise(resolve => { report = resolve; });
        await page.exposeFunction('reportLoader', report);
        await page.evaluate(() => {
            const root = document.querySelector('.app-loader--simple');
            const observer = new MutationObserver(() => {
                if (root.classList.contains('is-visible')) {
                    window.reportLoader(window.begins); observer.disconnect();
                }
            });
            observer.observe(root, { attributes: true, attributeFilter: ['class'] });
        });
        await page.route('**/next', async route => {
            assert.equal(await shown, 1);
            await route.fulfill({ body: 'next page' });
        });
        await Promise.all([page.waitForURL('**/next'), page.locator('#navigation').click()]);
    });
});

test('explicit download attribute, opt-out and new-tab links do not begin AppLoader', async t => {
    await withPage(t, async page => {
        await page.evaluate(() => {
            document.addEventListener('click', event => event.preventDefault());
            for (const attributes of [{ download: '' }, { 'data-no-loader': '' }, { target: '_blank' }]) {
                const a = document.createElement('a'); a.href = '/contract.pdf';
                for (const [name, value] of Object.entries(attributes)) a.setAttribute(name, value);
                document.body.append(a); a.click(); a.remove();
            }
        });
        assert.equal(await page.evaluate(() => window.begins), 0);
    });
});
