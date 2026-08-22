const assert = require('assert');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const sidebarScriptPath = path.join(__dirname, 'sidebar.js');

function toggle(id, label, children) {
    return `<li id="${id}" data-value="${id}">
        <a class="enabled menu-item sidebar-submenu-toggle d-flex align-items-center w-100 py-1 gap-2">
            <span class="sidebar-menu-label flex-grow-1 text-wrap">${label}</span>
            <span class="user-privileges-hierarchy-chevron flex-shrink-0 ms-auto" aria-hidden="true">▸</span>
        </a>
        <ul class="submenu">${children}</ul>
    </li>`;
}

function pageHtml() {
    const currentLeaf = '<li id="current-leaf" data-value="current-leaf"><a class="enabled menu-item" href="/current">Current</a></li>';
    const currentSection = toggle('current-section', 'Current section', currentLeaf);
    const currentRoot = toggle('current-root', 'Current root', currentSection);
    const savedRoot = toggle('saved-root', 'Saved root', '<li><a class="enabled menu-item" href="/saved">Saved</a></li>');
    return `<!doctype html><html><head>
        <link rel="stylesheet" href="/bootstrap.css">
        <link rel="stylesheet" href="/main.css">
        <style>#sidebarMenu { display: block !important; position: relative !important; height: auto !important; }</style>
        </head><body>
        <div id="sidebarMenu"><div class="sidebar-scroll"><ul id="nav-tree">${currentRoot}${savedRoot}</ul></div></div>
        <script src="/sidebar.js"></script>
    </body></html>`;
}

(async () => {
    const server = http.createServer((req, res) => {
        if (req.url === '/sidebar.js') {
            res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
            res.end(require('fs').readFileSync(sidebarScriptPath));
            return;
        }
        if (req.url === '/bootstrap.css') {
            res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
            res.end(require('fs').readFileSync(path.join(__dirname, '../../css/bootstrap.min.css')));
            return;
        }
        if (req.url === '/main.css') {
            res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
            res.end(require('fs').readFileSync(path.join(__dirname, '../../css/main.css')));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(pageHtml());
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto(`${origin}/current/details/?filter=open`);

        const initial = await page.evaluate(() => ({
            active: document.querySelector('#current-leaf > a').classList.contains('active'),
            rootOpen: document.querySelector('#current-root > ul').classList.contains('active'),
            sectionOpen: document.querySelector('#current-section > ul').classList.contains('active'),
            rootArrow: document.querySelector('#current-root .user-privileges-hierarchy-chevron').textContent,
            sectionArrow: document.querySelector('#current-section .user-privileges-hierarchy-chevron').textContent
        }));
        assert.deepStrictEqual(initial, {
            active: true,
            rootOpen: true,
            sectionOpen: true,
            rootArrow: '▾',
            sectionArrow: '▾'
        });

        await page.click('#saved-root > a');
        assert.deepStrictEqual(
            JSON.parse(await page.evaluate(() => sessionStorage.getItem('wps.sidebar.open-ids.v2'))),
            ['saved-root']
        );

        await page.reload();
        const restored = await page.evaluate(() => ({
            savedOpen: document.querySelector('#saved-root > ul').classList.contains('active'),
            currentRootOpen: document.querySelector('#current-root > ul').classList.contains('active'),
            currentSectionOpen: document.querySelector('#current-section > ul').classList.contains('active'),
            active: document.querySelector('#current-leaf > a').classList.contains('active')
        }));
        assert.deepStrictEqual(restored, {
            savedOpen: true,
            currentRootOpen: true,
            currentSectionOpen: true,
            active: true
        });

        await page.evaluate(() => sessionStorage.setItem('wps.sidebar.open-ids.v2', JSON.stringify(['current-root'])));
        await page.reload();
        assert.strictEqual(
            await page.$eval('#current-section > ul', (submenu) => submenu.classList.contains('active')),
            true
        );

        await page.evaluate(() => sessionStorage.removeItem('wps.sidebar.open-ids.v2'));
        await page.goto(`${origin}/unmatched`);
        assert.strictEqual(await page.$eval('#saved-root .user-privileges-hierarchy-chevron', (arrow) => arrow.textContent), '▸');
        await page.click('#saved-root > a');
        assert.strictEqual(await page.$eval('#saved-root .user-privileges-hierarchy-chevron', (arrow) => arrow.textContent), '▾');
        await page.click('#saved-root > a');
        assert.strictEqual(await page.$eval('#saved-root .user-privileges-hierarchy-chevron', (arrow) => arrow.textContent), '▸');

        for (const width of [1280, 1440, 1536, 1680, 1920]) {
            await page.setViewportSize({ width, height: 900 });
            const geometry = await page.evaluate(() => {
                document.querySelectorAll('#nav-tree ul.submenu').forEach((submenu) => {
                    submenu.style.display = 'block';
                });
                const rights = [...document.querySelectorAll('#nav-tree .user-privileges-hierarchy-chevron')]
                    .map((arrow) => arrow.getBoundingClientRect().right);
                const sidebar = document.querySelector('#sidebarMenu');
                return {
                    delta: Math.max(...rights) - Math.min(...rights),
                    overflow: sidebar.scrollWidth - sidebar.clientWidth
                };
            });
            assert.ok(geometry.delta <= 0.5, `${width}px arrow delta: ${geometry.delta}`);
            assert.ok(geometry.overflow <= 0.5, `${width}px sidebar overflow: ${geometry.overflow}`);
        }

        const source = require('fs').readFileSync(sidebarScriptPath, 'utf8');
        assert.ok(source.includes('sessionStorage'));
        assert.ok(!source.includes('localStorage'));
        console.log('PASS sidebar current path, ancestor priority, tab session state and arrows');
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
