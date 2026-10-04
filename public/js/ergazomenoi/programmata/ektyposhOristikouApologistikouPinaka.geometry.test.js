'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const ejs = require('ejs');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const viewPath = path.join(
    root,
    'views/ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka.ejs'
);

function render() {
    const view = fs.readFileSync(viewPath, 'utf8');
    const body = ejs.render(view, {
        companyId: 'company',
        periodRec: { apo: '2026-09-01', eos: '2026-09-30' },
        userPrivileges: { admin: true, export: true },
        script: (name) => `/js/${name}.js`
    }, { filename: viewPath });
    return '<!doctype html><html><head><meta name="viewport" content="width=device-width">' +
        '<link rel="stylesheet" href="/css/bootstrap.min.css">' +
        '<link rel="stylesheet" href="/css/main.css"></head><body>' + body + '</body></html>';
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(render());
    }
    const filename = path.resolve(root, 'public', url.pathname.replace(/^\//, ''));
    if (!filename.startsWith(path.join(root, 'public') + path.sep) || !fs.existsSync(filename)) {
        res.writeHead(404); return res.end();
    }
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return fs.createReadStream(filename).pipe(res);
});

(async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
        await page.evaluate(() => {
            const metadata = document.getElementById('finalWtoSubmittedDocumentMetadata');
            metadata.classList.remove('d-none');
            document.getElementById('finalWtoSubmittedProtocol').textContent = 'OP84859148';
            document.getElementById('finalWtoSubmittedDate').textContent = '04/10/2026 13:57';
            document.getElementById('finalWtoSubmittedStatus').textContent = 'SUCCESS';
        });
        const geometry = await page.evaluate(() => {
            const card = document.querySelector('.final-wto-submitted-document-card');
            const body = document.querySelector('.final-wto-submitted-document-body');
            const metadata = document.getElementById('finalWtoSubmittedDocumentMetadata');
            const footer = card.querySelector('.card-footer');
            const cardBox = card.getBoundingClientRect();
            const bodyBox = body.getBoundingClientRect();
            const metadataBox = metadata.getBoundingClientRect();
            const footerBox = footer.getBoundingClientRect();
            return {
                bodyClientHeight: body.clientHeight,
                bodyScrollHeight: body.scrollHeight,
                bodyOverflowY: getComputedStyle(body).overflowY,
                cardClientHeight: card.clientHeight,
                cardScrollHeight: card.scrollHeight,
                cardOverflowY: getComputedStyle(card).overflowY,
                metadataVisible: metadataBox.width > 0 && metadataBox.height > 0,
                metadataInsideBody: metadataBox.top >= bodyBox.top && metadataBox.bottom <= bodyBox.bottom + 1,
                footerVisible: footerBox.width > 0 && footerBox.height > 0 && footerBox.bottom <= innerHeight,
                contentNotClipped: cardBox.bottom >= footerBox.bottom && footerBox.top >= bodyBox.bottom - 1
            };
        });
        assert.ok(
            geometry.bodyScrollHeight <= geometry.bodyClientHeight + 1,
            JSON.stringify(geometry)
        );
        assert.ok(!['auto', 'scroll', 'hidden'].includes(geometry.bodyOverflowY), JSON.stringify(geometry));
        assert.ok(!['auto', 'scroll', 'hidden'].includes(geometry.cardOverflowY), JSON.stringify(geometry));
        assert.ok(geometry.cardScrollHeight <= geometry.cardClientHeight + 2, JSON.stringify(geometry));
        assert.strictEqual(geometry.metadataVisible, true, JSON.stringify(geometry));
        assert.strictEqual(geometry.metadataInsideBody, true, JSON.stringify(geometry));
        assert.strictEqual(geometry.footerVisible, true, JSON.stringify(geometry));
        assert.strictEqual(geometry.contentNotClipped, true, JSON.stringify(geometry));
        console.log(`PASS final WTODailyA document form geometry ${JSON.stringify(geometry)}`);
        await page.close();
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
