'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const C = require('../../../../server/utils/ergazomenoi/employmentProfileContract');
const { getEmploymentProfileUiContext } = require('../../../../server/utils/ergazomenoi/employmentProfileUiContext');
const template = path.resolve('views/ergazomenoi/ergazomenoi/partials/employmentProfileBreakRows.ejs');
const ui = fs.readFileSync(__dirname + '/employmentProfileUi.js', 'utf8');
const categoryId = 'eidikh_kathgoria_ergazomenoy';
let browser;
before(async () => { browser = await chromium.launch({ channel: 'chromium', headless: true }); });
after(async () => { await browser?.close(); });
async function fixture(t, category, edit = true, pending = false) {
    const page = await browser.newPage(); t.after(() => page.close());
    const rec = { [categoryId]: category };
    if (edit) for (const i of [1, 2, 3]) {
        rec[`dialleima_apo_ora_0${i}`] = '12:00'; rec[`dialleima_eos_ora_0${i}`] = '12:15';
    }
    const html = ejs.render(fs.readFileSync(template, 'utf8'), { rec }, { filename: template });
    await page.setContent(`<div class="card-body"><select id="${categoryId}" name="${categoryId}" data-selected="${category || ''}">` +
        (pending ? '' : ['', '0004', '0005', '0009'].map(value => `<option value="${value}" ${value === (category || '') ? 'selected' : ''}>${value}</option>`).join('')) + '</select>' + html + '</div>');
    return page;
}
async function states(page) {
    return page.locator('input[type=time]').evaluateAll(inputs => inputs.map(input => ({
        id: input.id, disabled: input.disabled, value: input.value, extra: input.hasAttribute('data-third-profile-break')
    })));
}
function availability(rows, all) {
    assert.equal(rows.length, 6);
    for (const row of rows) {
        const extra = row.id.endsWith('03');
        assert.equal(row.extra, extra, row.id);
        assert.equal(row.disabled, extra && !all, row.id);
    }
}
test('ordinary category accepts two separate fifteen-minute breaks', async t => {
    const page = await fixture(t, '0009', false);
    await page.addScriptTag({ content: ui });
    for (const [id, value] of Object.entries({ dialleima_apo_ora_01: '10:00', dialleima_eos_ora_01: '10:15',
        dialleima_apo_ora_02: '12:00', dialleima_eos_ora_02: '12:15' })) await page.locator(`#${id}`).fill(value);
    availability(await states(page), false);
    const payload = Object.fromEntries((await states(page)).map(row => [row.id, row.value]));
    const normalized = C.normalizeEmploymentProfileSubmission({ ...payload, dialleima_se_lepta: 30 });
    assert.equal(normalized.dialleima_se_lepta, 30);
    assert.equal(normalized.dialleima_apo_ora_02, '12:00');
});
test('legacy disabled OTHER option survives initialization, toggles and actual Add/Edit serialization', async t => {
    const page = await browser.newPage(); t.after(() => page.close());
    const file = path.resolve('views/ergazomenoi/ergazomenoi/partials/employmentProfileArrangementRows.ejs');
    const model = { find() { return this; }, select() { return this; }, sort() { return this; }, lean: async () => [] };
    const employmentProfileUi = await getEmploymentProfileUiContext(model);
    const rec = { [C.ENABLED]: true, [C.TYPE]: 'OTHER_APPROVED_ARRANGEMENT', [C.FROM]: '2026-09-01' };
    await page.setContent('<div class="card-body">' + ejs.render(fs.readFileSync(file, 'utf8'),
        { rec, employmentProfileUi }, { filename: file }) + '</div>');
    await page.addScriptTag({ content: ui });
    await page.locator(`#${C.ENABLED}`).uncheck();
    await page.locator(`#${C.ENABLED}`).check();
    assert.equal(await page.locator(`#${C.TYPE}`).inputValue(), rec[C.TYPE]);
    assert.equal(await page.locator(`option[value="${rec[C.TYPE]}"]`).isDisabled(), true);
    for (const file of ['getFieldValues.js', 'putFieldValues.js']) {
        const code = fs.readFileSync(__dirname + '/' + file, 'utf8');
        const start = code.indexOf('        const formData = {}');
        const body = code.slice(start, code.indexOf('// ✅ CONVERT PDFs TO BASE64', start));
        const payload = await page.evaluate(body => new Function(body + '\nreturn formData;')(), body);
        assert.equal(payload[C.TYPE], rec[C.TYPE], file);
        assert.equal(C.normalizeEmploymentProfileSubmission(payload)[C.TYPE], rec[C.TYPE]);
    }
});
for (const edit of [false, true]) for (const category of ['0004', '0005', '0009', '', null]) {
    test(`${edit ? 'Edit' : 'Add'} initial category ${JSON.stringify(category)}: correct EJS and shared handler availability`, async t => {
        const page = await fixture(t, category, edit);
        availability(await states(page), ['0004', '0005'].includes(category)); // Before JS, too.
        await page.addScriptTag({ content: ui });
        availability(await states(page), ['0004', '0005'].includes(category));
        for (const i of [1, 2, 3]) for (const word of ['Έναρξης', 'Λήξης']) {
            assert.equal(await page.getByText(`${i}ο Διάλειμμα — Ώρα ${word}`, { exact: true }).count(), 1);
        }
    });
}
for (const edit of [false, true]) test(`${edit ? 'Edit' : 'Add'} dynamic category toggles retain values, emit no interval events, and keep existing Add/Edit serialization`, async t => {
    const page = await fixture(t, '0004', edit);
    if (!edit) for (const i of [1, 2, 3]) {
        await page.locator(`#dialleima_apo_ora_0${i}`).fill('12:00');
        await page.locator(`#dialleima_eos_ora_0${i}`).fill('12:15');
    }
    await page.evaluate(() => {
        window.intervalEvents = 0;
        document.querySelectorAll('input[type=time]').forEach(input => {
            for (const event of ['input', 'change']) input.addEventListener(event, () => window.intervalEvents++);
        });
    });
    await page.addScriptTag({ content: ui });
    const original = (await states(page)).map(row => row.value);
    for (const category of ['0009', '0005', '0009', '0004', '', '0005', '', '0004', '0009']) {
        await page.selectOption(`#${categoryId}`, category);
        availability(await states(page), ['0004', '0005'].includes(category));
        assert.deepEqual((await states(page)).map(row => row.value), original);
    }
    assert.equal(await page.evaluate(() => window.intervalEvents), 0);
    for (const file of ['getFieldValues.js', 'putFieldValues.js']) {
        const code = fs.readFileSync(__dirname + '/' + file, 'utf8');
        const start = code.indexOf('        const formData = {}');
        const body = code.slice(start, code.indexOf('// ✅ CONVERT PDFs TO BASE64', start));
        const payload = await page.evaluate(body => new Function(body + '\nreturn formData;')(), body);
        for (const row of await states(page)) assert.equal(payload[row.id], row.value, `${file}: ${row.id}`);
    }
});
for (const category of ['0004', '0005', '0009']) test(`actual async Edit dropdown restores ${category} and updates availability`, async t => {
    const page = await fixture(t, category, true, true);
    await page.addScriptTag({ content: ui });
    availability(await states(page), false);
    const code = fs.readFileSync(__dirname + '/loadDropdowns_edit.js', 'utf8');
    const start = code.indexOf('  const loadEidikesKathgories = async () => {');
    const end = code.indexOf("  eidikesKathgoriesDropdown.addEventListener", start);
    assert(start >= 0 && end > start);
    await page.evaluate(async body => {
        // In-memory response only: execute the real loader without any network request.
        window.fetch = async () => ({ ok: true, json: async () => [
            { kodikos: '0004', perigrafh: 'Fixture 4' }, { kodikos: '0005', perigrafh: 'Fixture 5' },
            { kodikos: '0009', perigrafh: 'Fixture 9' }
        ] });
        await new Function(body + '\nreturn loadEidikesKathgories();')();
    }, code.slice(start, end));
    assert.equal(await page.locator(`#${categoryId}`).inputValue(), category);
    availability(await states(page), ['0004', '0005'].includes(category));
    assert.deepEqual((await states(page)).map(row => row.value), ['12:00', '12:15', '12:00', '12:15', '12:00', '12:15']);
});
