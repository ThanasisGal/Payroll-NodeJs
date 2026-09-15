'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const view = fs.readFileSync(path.join(root,
    'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
const bootstrapCss = fs.readFileSync(path.join(root, 'public/css/bootstrap.min.css'), 'utf8');
const renderedView = ejs.render(view, {
    userRole: 'HR', csrfToken: 'layout-test', companyId: 'company-test',
    periodRec: { apo: '2026-06-01', eos: '2026-06-30' }, script: () => '#'
});

function fixture() {
    return `<!doctype html><html><head><meta charset="utf-8">
        <style>${bootstrapCss}</style><style>${css}</style>
        <style>:root { --app-header-h: 0px; }
        #globalApplicationFooter { height: var(--app-footer-h); }</style></head>
        <body><main>${renderedView}</main>
        <footer class="footer" id="globalApplicationFooter">Υποσέλιδο εφαρμογής</footer></body></html>`;
}

async function measure(page, statusVisible) {
    return page.evaluate((showStatus) => {
        const status = document.getElementById('employmentPeriodControlPanel');
        status.classList.toggle('d-none', !showStatus);
        document.querySelector('.employment-review-scroll-container').insertAdjacentHTML(
            'beforeend', '<div class="viewport-layout-filler" style="height:1200px">Περιεχόμενο</div>'
        );
        const shell = document.querySelector('.employment-review-page-shell');
        const card = document.querySelector('.employment-review-card');
        const scroll = document.querySelector('.employment-review-scroll-container');
        const footer = document.getElementById('globalApplicationFooter');
        const shellRect = shell.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const footerRect = footer.getBoundingClientRect();
        const cardStyle = getComputedStyle(card);
        return {
            shellToFooter: footerRect.top - shellRect.bottom,
            shadowClearance: shellRect.bottom - cardRect.bottom,
            cardInsideViewport: cardRect.bottom <= innerHeight,
            cardHeight: cardRect.height,
            bottomLeftRadius: cardStyle.borderBottomLeftRadius,
            bottomRightRadius: cardStyle.borderBottomRightRadius,
            boxShadow: cardStyle.boxShadow,
            innerOverflowY: getComputedStyle(scroll).overflowY,
            innerScrolls: scroll.scrollHeight > scroll.clientHeight,
            pageOverflow: document.documentElement.scrollHeight -
                document.documentElement.clientHeight
        };
    }, statusVisible);
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const [width, height] of [[1366, 768], [1024, 700], [768, 700]]) {
            for (const statusVisible of [false, true]) {
                const page = await browser.newPage({ viewport: { width, height } });
                await page.setContent(fixture(), { waitUntil: 'domcontentloaded' });
                const result = await measure(page, statusVisible);
                const state = statusVisible ? 'ορατή κατάσταση' : 'κρυφή κατάσταση';
                assert.ok(Math.abs(result.shellToFooter - 5) <= 0.5,
                    `${width}x${height}, ${state}: το κέλυφος απέχει 5px από το υποσέλιδο`);
                assert.ok(result.shadowClearance >= 11.5,
                    `${width}x${height}, ${state}: διατηρείται χώρος για τη σκιά`);
                assert.strictEqual(result.cardInsideViewport, true);
                assert.ok(result.cardHeight > 0);
                assert.notStrictEqual(result.bottomLeftRadius, '0px');
                assert.notStrictEqual(result.bottomRightRadius, '0px');
                assert.notStrictEqual(result.boxShadow, 'none');
                assert.strictEqual(result.innerOverflowY, 'auto');
                assert.strictEqual(result.innerScrolls, true);
                assert.ok(result.pageOverflow <= 0,
                    `${width}x${height}, ${state}: δεν επιτρέπεται εξωτερική κύλιση`);
                await page.close();
            }
        }
        console.log('employment review viewport shell layout tests passed');
    } finally {
        await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
