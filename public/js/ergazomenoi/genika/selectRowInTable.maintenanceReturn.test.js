'use strict';

// Real browser + local fixtures only: no application server, database, or external API.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const ejs = require('ejs');
const root = path.resolve(__dirname, '../../../..');
const BASE = '/ergazomenoi/ergazomenoi';
const KEY = 'employee-table-return:v2';
const keys = ['kodikos', 'eponymo', 'onoma', 'patronymo', 'eidikothta', 'afm', 'amka', 'adt'];
const id = n => n.toString(16).padStart(24, '0');
const records = Array.from({ length: 40 }, (_, n) => ({
    _id: id(n + 1), kodikos: String(n + 1).padStart(4, '0'),
    eponymo: `Surname ${String(40 - n).padStart(2, '0')}`, onoma: `Name ${n % 7}`,
    patronymo: `Father ${n % 5}`, eidikothta: `Specialty ${n % 3}`, afm: String(100 + n),
    amka: String(200 + n), adt: `ID ${40 - n}`, energos: n % 4 !== 0
}));
let browser, server, origin;
const script = value => `/assets/${value}.js`;
function render(file, locals = {}) {
    const filename = path.join(root, 'views/ergazomenoi/ergazomenoi', file);
    return ejs.render(fs.readFileSync(filename, 'utf8'), {
        script, companyInUse: 'fixture-company', yearInUse: '2026', ...locals
    }, { filename });
}
function html(url) {
    let body;
    if (/\/(add|edit\/[a-f\d]{24})$/.test(url.pathname)) {
        const footer = url.pathname.endsWith('/add') ? 'add/cardFooters/cardFooter_Add' : 'edit/cardFooters/cardFooter_Edit';
        body = render(`partials/${footer}.ejs`) +
            render('partials/employmentTableNavigation.ejs');
    } else if (url.pathname === '/shared' || url.pathname === '/baseline') {
        body = '<table id="myTableHeader"><tr>' + keys.map(k => `<th>${k}<i class="sort-icon bi"></i></th>`).join('') +
            '</tr></table><table id="myTable"><tbody>' + records.map(r =>
                `<tr data-id="${r._id}">${keys.map(k => `<td>${r[k]}</td>`).join('')}</tr>`).join('') +
            `</tbody></table><script src="${url.pathname === '/baseline' ? '/baseline.js' : script('common/sortTable')}"></script>`;
    } else if (url.pathname === '/unrelated') {
        body = '<p>Unrelated fixture page</p>';
    } else {
        const search = url.pathname.includes('/search');
        body = render(search ? 'search.ejs' : 'ergazomenoi.ejs', {
            nonce: 'fixture', NODE_ENV: 'development', csrfToken: 'fixture',
            userPrivileges: { admin: true, privileges: { admin: true } },
            current: Number(url.searchParams.get('page')) || 1, pages: 4, perx: 1, basePer: 40, entries: 40,
            sTerm: 'fixture', anenergh: url.searchParams.get('anenergh') || '',
            ergazomenoi: records, ergazomenoiFilteredRecs: records
        });
    }
    return '<!doctype html><html><head><style>.overflow-auto{height:160px;overflow:auto} table{border-collapse:collapse} td{height:30px} th{cursor:pointer} .disabled-link{pointer-events:none}</style></head><body>' + body + '</body></html>';
}
before(async () => {
    server = http.createServer((req, res) => {
        res.setHeader('Referrer-Policy', 'no-referrer');
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/assets/')) {
            res.setHeader('Content-Type', 'text/javascript');
            res.end(fs.readFileSync(path.join(root, 'public/js', url.pathname.slice(8))));
        } else if (url.pathname === '/baseline.js') {
            res.setHeader('Content-Type', 'text/javascript');
            res.end(execFileSync('git', ['show', '981302d3:public/js/common/sortTable.js'], { cwd: root }));
        } else {
            res.setHeader('Content-Type', 'text/html'); res.end(html(url));
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chromium', headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'] });
});
after(async () => {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
});
async function pageFor(t, url = BASE, unavailable = false) {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    await page.addInitScript(() => {
        window.pageShows = [];
        window.addEventListener('pageshow', event => pageShows.push(event.persisted));
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    t.after(() => assert.deepEqual(errors, [], 'no browser JS errors'));
    if (unavailable) await page.addInitScript(() => {
        Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('storage denied'); } });
    });
    await page.goto(origin + url);
    return page;
}
async function snapshot(page) {
    return page.evaluate(() => ({
        ids: [...document.querySelectorAll('#myTable tbody tr')].map(r => r.dataset.id),
        selected: document.querySelector('#myTable .selected-row')?.dataset.id || null,
        selectedRowId,
        sort: window.TableSort.getSortState(document.getElementById('myTable'), document.getElementById('myTableHeader')),
        icons: [...document.querySelectorAll('#myTableHeader .sort-icon')].map(i => i.className),
        scroll: document.querySelector('.overflow-auto').scrollTop,
        edit: document.getElementById('edit-btn').getAttribute('href'),
        delete: document.getElementById('delete-btn').getAttribute('href'),
        url: location.pathname + location.search,
        stored: sessionStorage.getItem('employee-table-return:v2')
    }));
}
async function sort(page, key, direction) {
    const header = page.locator(`[data-sort-key="${key}"]`);
    if (await header.getAttribute('data-dir') !== direction) await header.click();
    if (await header.getAttribute('data-dir') !== direction) await header.click();
}
async function depart(page, { key = 'eponymo', direction = 'asc', selected = true, add = false } = {}) {
    await sort(page, key, direction);
    if (selected) await page.locator(`tr[data-id="${id(31)}"] td`).first().click();
    await page.locator('.overflow-auto').evaluate(el => { el.scrollTop = 210; });
    const before = await snapshot(page);
    await page.locator(add ? '#add-btn' : '#edit-btn').click();
    await page.waitForURL(url => /\/(add|edit\/[a-f\d]{24})$/.test(url.pathname));
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('employee-table-return:v2'))?.phase === 'entered');
    return before;
}
async function returnToList(page) {
    await page.locator('.card-footer a').first().click();
    await page.waitForURL(url => [BASE, `${BASE}/search`, `${BASE}/search/`].includes(url.pathname));
    await page.waitForFunction(() => !sessionStorage.getItem('employee-table-return:v2'));
}
function sameState(actual, expected) {
    for (const key of ['ids', 'selected', 'selectedRowId', 'sort', 'icons', 'scroll', 'edit', 'delete', 'url']) {
        assert.deepEqual(actual[key], expected[key], key);
    }
    assert.equal(actual.stored, null);
}

test('independent load: code ASC, numeric icon, no selection', async t => {
    const page = await pageFor(t);
    const state = await snapshot(page);
    assert.equal(state.sort.key, 'kodikos'); assert.equal(state.sort.direction, 'asc');
    assert.equal(state.selected, null); assert.equal(state.edit, '#'); assert.equal(state.delete, '#');
    assert.deepEqual(state.ids, records.map(r => r._id));
    assert.match(state.icons[0], /bi-sort-numeric-down$/);
});
for (const key of keys) for (const direction of ['asc', 'desc']) {
    test(`Edit return: ${key} ${direction}, exact order/icon/selection/buttons/scroll`, async t => {
        const page = await pageFor(t, BASE + '?page=2&perx=3&anenergh=on');
        const before = await depart(page, { key, direction });
        await returnToList(page);
        sameState(await snapshot(page), before);
        assert.equal(await page.locator('.selected-row > td').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(25, 135, 84)');
    });
}
for (const selected of [true, false]) test(`Add return, selected=${selected}`, async t => {
    const page = await pageFor(t, BASE + '?page=3&perx=2&anenergh=on');
    const before = await depart(page, { add: true, selected, direction: 'desc' });
    const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('employee-table-return:v2')));
    assert.equal(saved.employeeId, selected ? id(31) : null);
    assert.deepEqual(Object.keys(saved.sort).sort(), ['direction', 'key']);
    await returnToList(page); sameState(await snapshot(page), before);
});
test('stale entered state and legacy state never restore on typed independent visit', async t => {
    const page = await pageFor(t);
    await depart(page);
    await page.evaluate(() => sessionStorage.setItem('employee-maintenance-return:v1', '{"employeeId":"stale"}'));
    await page.goto(origin + BASE);
    const state = await snapshot(page);
    assert.equal(state.sort.key, 'kodikos'); assert.equal(state.selected, null); assert.equal(state.scroll, 0);
    assert.equal(state.stored, null);
});
for (const sortValue of [{ key: 'bogus', direction: 'asc' }, { key: 'eponymo', direction: 'sideways' }]) {
    test(`invalid sort ignored: ${JSON.stringify(sortValue)}`, async t => {
        const page = await pageFor(t); await depart(page);
        await page.evaluate(sortValue => {
            const state = JSON.parse(sessionStorage.getItem('employee-table-return:v2'));
            state.sort = sortValue; sessionStorage.setItem('employee-table-return:v2', JSON.stringify(state));
        }, sortValue);
        await returnToList(page);
        const state = await snapshot(page);
        assert.equal(state.sort.key, 'kodikos'); assert.equal(state.selected, id(31));
    });
}
test('missing employee restores sort/scroll but clears selection/buttons', async t => {
    const page = await pageFor(t); await depart(page);
    await page.evaluate(() => {
        const state = JSON.parse(sessionStorage.getItem('employee-table-return:v2'));
        state.employeeId = 'ffffffffffffffffffffffff'; sessionStorage.setItem('employee-table-return:v2', JSON.stringify(state));
    });
    await returnToList(page);
    const state = await snapshot(page);
    assert.equal(state.sort.key, 'eponymo'); assert.equal(state.scroll, 210);
    assert.equal(state.selected, null); assert.equal(state.selectedRowId, null);
    assert.equal(state.edit, '#'); assert.equal(state.delete, '#');
});
test('storage denied: header clicks and Add/Edit/return remain usable', async t => {
    const page = await pageFor(t, BASE, true);
    await sort(page, 'eponymo', 'desc');
    await page.locator('#add-btn').click();
    await page.waitForURL(origin + BASE + '/add');
    await page.locator('.card-footer a').first().click();
    await page.waitForURL(origin + BASE);
    await page.locator(`tr[data-id="${id(31)}"] td`).first().click();
    await page.locator('#edit-btn').click();
    await page.waitForURL(origin + BASE + '/edit/' + id(31));
    await page.locator('.card-footer a').first().click();
    await page.waitForURL(origin + BASE);
});
test('Back and repeated persisted pageshow restore once, never toggle/reorder twice', async t => {
    const page = await pageFor(t);
    const before = await depart(page, { direction: 'desc' });
    await page.goBack({ waitUntil: 'commit' });
    await page.waitForFunction(() => !sessionStorage.getItem('employee-table-return:v2'));
    assert.equal(await page.evaluate(() => pageShows.includes(true)), true, 'actual BFCache return');
    sameState(await snapshot(page), before);
    await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    sameState(await snapshot(page), before);
});
test('sort then selection then deferred scroll (real DOM instrumentation)', async t => {
    const page = await pageFor(t); await depart(page);
    await page.addInitScript(() => {
        window.events = [];
        const append = Node.prototype.appendChild;
        Node.prototype.appendChild = function (child) { if (this.tagName === 'TBODY') events.push('sort'); return append.call(this, child); };
        const add = DOMTokenList.prototype.add;
        DOMTokenList.prototype.add = function (...tokens) { if (tokens.includes('selected-row')) events.push('select'); return add.apply(this, tokens); };
        const scroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
        Object.defineProperty(Element.prototype, 'scrollTop', { ...scroll, set(value) { events.push('scroll'); scroll.set.call(this, value); } });
    });
    await returnToList(page);
    const events = await page.evaluate(() => events);
    assert.equal(events.filter(e => e === 'sort').length, records.length);
    assert(events.lastIndexOf('sort') < events.indexOf('select'));
    assert(events.indexOf('select') < events.indexOf('scroll'));
});
test('existing save-style navigation redirects to exact page/perx/filter context', async t => {
    const page = await pageFor(t, BASE + '?page=2&perx=4&anenergh=on');
    const before = await depart(page);
    await page.evaluate(base => { location.href = base; }, BASE);
    await page.waitForURL(origin + before.url);
    await page.waitForFunction(() => !sessionStorage.getItem('employee-table-return:v2'));
    sameState(await snapshot(page), before);
});
for (const route of ['/search', '/search/?page=2&anenergh=on']) test(`existing search context ${route}`, async t => {
    const page = await pageFor(t, BASE + route);
    const before = await depart(page, { key: 'eidikothta', direction: 'desc' });
    await returnToList(page); sameState(await snapshot(page), before);
});
test('inactive toggle retains perx and resets page as before', async t => {
    const page = await pageFor(t, BASE + '?page=2&perx=3');
    await page.locator('#anenergh').check();
    await page.waitForURL(origin + BASE + '?page=1&perx=3&anenergh=on');
    assert.equal((await snapshot(page)).sort.key, 'kodikos');
});
test('context mismatch and external return URLs are rejected', async t => {
    for (const patch of [{ context: 'other-company' }, { returnUrl: 'https://external.invalid/' }]) {
        const page = await pageFor(t); await depart(page);
        await page.evaluate(patch => {
            const state = JSON.parse(sessionStorage.getItem('employee-table-return:v2'));
            sessionStorage.setItem('employee-table-return:v2', JSON.stringify({ ...state, ...patch }));
        }, patch);
        await returnToList(page);
        assert.equal((await snapshot(page)).selected, null);
    }
});
test('shared consumers: unchanged header toggling and comparator against baseline', async t => {
    const page = await pageFor(t, '/shared');
    const baseline = await pageFor(t, '/baseline');
    // Include blanks, mixed case, equal values and numeric-looking/text values.
    for (const p of [page, baseline]) await p.evaluate(() => {
        const values = ['10', '2', '', '02', '-3', '1.5'];
        const text = ['Beta', 'alpha', '', 'ALPHA', 'α', 'Ά'];
        [...document.querySelectorAll('#myTable tr')].forEach((row, i) => {
            row.cells[0].textContent = values[i % values.length]; row.cells[1].textContent = text[i % text.length];
        });
    });
    for (const column of [0, 0, 1, 1, 4, 4, 0]) {
        for (const p of [page, baseline]) await p.locator('#myTableHeader th').nth(column).click();
        const inspect = p => p.evaluate(() => ({
            ids: [...document.querySelectorAll('#myTable tr')].map(r => r.dataset.id),
            icons: [...document.querySelectorAll('.sort-icon')].map(i => i.className),
            dirs: [...document.querySelectorAll('th')].map(th => th.dataset.dir)
        }));
        assert.deepEqual(await inspect(page), await inspect(baseline));
    }
});
test('generic exact API is scoped to supplied table and header', async t => {
    const page = await pageFor(t, '/shared');
    assert.equal(await page.evaluate(() => {
        const table = document.getElementById('myTable'), header = document.getElementById('myTableHeader');
        const second = table.cloneNode(true), secondHeader = header.cloneNode(true);
        document.body.append(second, secondHeader);
        const order = [...table.rows].map(r => r.dataset.id).join();
        window.TableSort.applySortState(second, secondHeader, { column: 0, direction: 'desc' });
        return [...table.rows].map(r => r.dataset.id).join() === order &&
            !window.TableSort.getSortState(table, header) &&
            window.TableSort.getSortState(second, secondHeader).direction === 'desc';
    }), true);
});

test('independent form visit cannot revive old entered state via its referrer', async t => {
    const page = await pageFor(t); await depart(page);
    await page.goto(origin + '/unrelated');
    await page.goto(origin + BASE + '/edit/' + id(31));
    await page.locator('.card-footer a').first().click();
    await page.waitForURL(origin + BASE);
    const state = await snapshot(page);
    assert.equal(state.sort.key, 'kodikos'); assert.equal(state.selected, null); assert.equal(state.stored, null);
});
test('return token cannot be replayed after consumption', async t => {
    const page = await pageFor(t); await depart(page);
    const href = await page.locator('.card-footer a').first().getAttribute('href');
    await returnToList(page);
    await page.goto(origin + '/unrelated');
    await page.goto(origin + href);
    const state = await snapshot(page);
    assert.equal(state.sort.key, 'kodikos'); assert.equal(state.selected, null); assert.equal(state.stored, null);
});
test('malformed storage is cleared safely', async t => {
    const page = await pageFor(t);
    await page.evaluate(() => sessionStorage.setItem('employee-table-return:v2', '{'));
    await page.reload();
    assert.equal((await snapshot(page)).stored, null);
});
test('selection still toggles one row at a time after restoration and reordering', async t => {
    const page = await pageFor(t); await depart(page); await returnToList(page);
    await sort(page, 'onoma', 'desc');
    await page.locator(`tr[data-id="${id(31)}"] td`).first().click();
    assert.equal((await snapshot(page)).selected, null);
    await page.locator(`tr[data-id="${id(2)}"] td`).first().click();
    const state = await snapshot(page);
    assert.equal(state.selected, id(2)); assert.equal(state.selectedRowId, id(2));
    assert.equal(await page.locator('.selected-row').count(), 1);
    assert.equal(state.edit, BASE + '/edit/' + id(2)); assert.equal(state.delete, BASE + '/delete/' + id(2));
});

test('explicit Return and Back work without Navigation API or referrer', async t => {
    const page = await pageFor(t);
    await page.addInitScript(() => Object.defineProperty(window, 'navigation', { value: undefined }));
    await page.reload();
    const before = await depart(page, { add: true, selected: false, direction: 'desc' });
    await returnToList(page); sameState(await snapshot(page), before);
    const second = await depart(page);
    await page.goBack({ waitUntil: 'commit' });
    await page.waitForFunction(() => !sessionStorage.getItem('employee-table-return:v2'));
    sameState(await snapshot(page), second);
});
test('proven return to base redirects to exact URL before restoration', async t => {
    const page = await pageFor(t, BASE + '?page=2&perx=3&anenergh=on');
    const before = await depart(page);
    await page.locator('.card-footer a').first().evaluate((link, base) => {
        link.href = base + new URL(link.href).hash;
    }, BASE);
    await returnToList(page);
    sameState(await snapshot(page), before);
});

test('same-origin absolute return URL is normalized without a redirect loop', async t => {
    const page = await pageFor(t, BASE + '?page=2&perx=3');
    const before = await depart(page);
    await page.evaluate(() => {
        const state = JSON.parse(sessionStorage.getItem('employee-table-return:v2'));
        state.returnUrl = location.origin + state.returnUrl;
        sessionStorage.setItem('employee-table-return:v2', JSON.stringify(state));
    });
    await returnToList(page); sameState(await snapshot(page), before);
});
