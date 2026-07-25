const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const ejs = require('ejs');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const viewPath = path.join(root, 'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs');
const view = fs.readFileSync(viewPath, 'utf8');

function render(role) {
    const body = ejs.render(view, {
        userRole: role, csrfToken: 'test', companyId: 'company', periodRec: {},
        script: (name) => `/js/${name}.js`
    }, { filename: viewPath });
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/css/bootstrap.min.css"><link rel="stylesheet" href="/css/main.css"></head><body>${body}</body></html>`;
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/hr' || url.pathname === '/admin') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(render(url.pathname === '/hr' ? 'HR' : 'A'));
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
        for (const [rolePath, viewport] of [['hr', { width: 600, height: 800 }], ['admin', { width: 1440, height: 900 }]]) {
            const page = await browser.newPage({ viewport });
            await page.goto(`http://127.0.0.1:${server.address().port}/${rolePath}`, { waitUntil: 'networkidle' });
            const link = page.locator('.employment-review-return-btn').first();
            assert.strictEqual(await link.getAttribute('href'), '/mainapp');
            assert.ok((await link.getAttribute('class')).includes('btn-secondary'));
            assert.ok(!(await link.getAttribute('class')).includes('outline'));
            const normal = await link.evaluate((element) => getComputedStyle(element).backgroundColor);
            await link.hover();
            const hover = await link.evaluate((element) => getComputedStyle(element).backgroundColor);
            await link.focus();
            const focus = await link.evaluate((element) => getComputedStyle(element).backgroundColor);
            [normal, hover, focus].forEach((color) => assert.ok(color !== 'transparent' && !color.endsWith(', 0)')));
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            assert.strictEqual(overflow, 0);
            console.log(JSON.stringify({ role: rolePath === 'hr' ? 'HR' : 'A/S fixture', viewport: `${viewport.width}x${viewport.height}`, normal, hover, focus, horizontalOverflow: overflow }));
            await page.close();
        }
        console.log('PASS employment-review solid return button and responsive overflow');
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
