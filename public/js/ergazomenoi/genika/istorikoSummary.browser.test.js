'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../..');
const view = path.join(root, 'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs');
const rows = [1, 2, 3].map((n, index) => ({ _id: `synthetic-${n}`, aa_eggrafhs: `000${n}`,
    hmeromhnia_proslhpshs: '2026-01-01', hmeromhnia_allaghs_symbashs: '2026-01-01',
    hmeromhnia_isxyos_oron_ergasias_apo: ['2026-01-01', '2026-02-01', '2026-02-01'][index],
    hmeromhnia_isxyos_oron_ergasias_eos: ['2026-01-31', '2026-02-28', '2026-02-28'][index],
    hmeromhnia_allaghs_orarioy_apo: `2044-0${n}-10`,
    hmeromhnia_allaghs_orarioy_eos: `2044-0${n}-16`,
    hmeromhnia_lhxhs_symbashs: '2026-12-31', hmeromhnia_apoxorhshs: null }));
const render = (istorikoData = rows) => ejs.renderFile(view, { istorikoData,
    ergazomenoiData: { _id: 'synthetic', hmeromhnia_proslhpshs: '2026-01-01' },
    employeeHistoryAccessMode: 'ADMIN_FULL', employeeHistoryStateToken: 'synthetic-token' });

test('History summary renders nine ordered columns with work-terms dates; editor state and actions retain schedule information', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ locale: 'el-GR' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setContent(await render());
        const headers = page.locator('#istorikoTable thead tr').nth(1).locator('th');
        assert.deepEqual(await headers.allTextContents(), ['α/α', 'Πρόσληψης', 'Αλλαγής Σύμβασης',
            'Ισχύος Όρων Εργασίας Από', 'Ισχύος Όρων Εργασίας Έως',
            'Λήξης Σύμβασης', 'Αποχώρησης', 'Κατ.', 'Ενέργειες']);
        assert.equal(await page.locator('#istorikoTable colgroup col').count(), 9);
        assert.equal(await page.locator('#istorikoTable thead tr').first().locator('[colspan="6"]').count(), 1);
        const display = value => new Date(value).toLocaleDateString('el-GR');
        const domRows = page.locator('#istorikoTable tbody tr.istoriko-row');
        const initial = await domRows.evaluateAll(elements => elements.map(row => row.textContent));
        for (let i = 0; i < rows.length; i++) {
            const row = domRows.nth(i), cells = row.locator('td');
            assert.equal(await cells.count(), 9);
            for (const [column, field] of [[3, 'hmeromhnia_isxyos_oron_ergasias_apo'],
                [4, 'hmeromhnia_isxyos_oron_ergasias_eos']]) {
                const expected = i > 0 && rows[i][field] === rows[i - 1][field] ? '' : display(rows[i][field]);
                assert.equal((await cells.nth(column).innerText()).trim(), expected);
            }
            assert.doesNotMatch(await row.innerText(), /2044/);
            assert.equal(await cells.nth(7).locator('.istoriko-state.state-clean').count(), 1);
            assert.deepEqual(await cells.nth(8).locator('[data-action]').evaluateAll(buttons =>
                buttons.map(button => button.dataset.action)), ['add', 'edit', 'review', 'delete', 'undo']);
            const record = JSON.parse(await row.getAttribute('data-record'));
            const original = JSON.parse(await row.getAttribute('data-original'));
            assert.equal(record.hmeromhnia_allaghs_orarioy_apo, rows[i].hmeromhnia_allaghs_orarioy_apo);
            assert.equal(original.hmeromhnia_allaghs_orarioy_eos, rows[i].hmeromhnia_allaghs_orarioy_eos);
        }
        // The existing editor still owns its original six date fields. Hydration
        // may prepare them, but must not replace summary text with schedule dates.
        await page.addScriptTag({ path: path.join(root, 'public/js/ergazomenoi/genika/istorikoTable.js') });
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
        assert.deepEqual(await domRows.evaluateAll(elements => elements.map(row => row.textContent)), initial);
        await domRows.first().locator('[data-action="edit"]').click();
        assert.deepEqual(await domRows.first().locator('input[data-field-input]').evaluateAll(inputs =>
            inputs.map(input => input.dataset.fieldInput)), ['hmeromhnia_proslhpshs',
            'hmeromhnia_allaghs_symbashs', 'hmeromhnia_allaghs_orarioy_apo',
            'hmeromhnia_allaghs_orarioy_eos', 'hmeromhnia_lhxhs_symbashs', 'hmeromhnia_apoxorhshs']);
        assert.equal(await domRows.first().locator('[data-field-input="hmeromhnia_allaghs_orarioy_apo"]').inputValue(), '2044-01-10');
        assert.deepEqual(errors, []);
        await page.setContent(await render([]));
        assert.equal(await page.locator('#istorikoTable .istoriko-empty-row').getAttribute('colspan'), '9');
    } finally { await browser.close(); }
});
