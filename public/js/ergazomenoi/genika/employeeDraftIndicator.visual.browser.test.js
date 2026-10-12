'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../..');

for (const width of [1440, 390]) test(`draft indicator in full Maintenance form at ${width}px; no network or database`, async () => {
    const employee = { _id: 'synthetic', oristikh_enhmerosh: false, kodikos: '0001',
        eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΟΠΤΙΚΟΥ ΕΛΕΓΧΟΥ' };
    const html = await ejs.renderFile(path.join(root, 'views/ergazomenoi/ergazomenoi/edit.ejs'), {
        ergazomenoiData: employee, rec: employee, companyData: {}, genikesParametroi: {},
        istorikoData: [], orariaData: [], perifereies: [], originalEmploymentHistoryId: '',
        originalEmploymentHistoryRevision: 0, sessionYearInUse: 2026, mode: 'edit', context: 'ergazomenoi',
        employeeHistoryAccessMode: 'ADMIN_FULL', canManageEmployeeHistory: true, problematicHistoryIds: [],
        NODE_ENV: 'development', nonce: '', script: () => '', css: () => '', userRole: 'HR', csrfToken: '',
        companyInUse: '', userTeam: 'TEST', employmentProfileUi: { types: [], categories: [] }
    });
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, locale: 'el-GR' });
        await page.route('**/*', route => route.abort());
        await page.setContent(`<!doctype html><html lang="el"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>${html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')}</body></html>`);
        for (const file of ['bootstrap.min.css', 'main.css'])
            await page.addStyleTag({ path: path.join(root, 'public/css', file) });
        // Wait for existing entrance animations before measuring the actual layout.
        await page.waitForTimeout(1200);
        const indicator = page.locator('.employee-draft-indicator');
        await indicator.scrollIntoViewIfNeeded();
        assert.equal(await indicator.innerText(), 'Προσωρινά Αποθηκευμένος');
        const geometry = await indicator.evaluate(e => {
            const box = e.getBoundingClientRect(), style = getComputedStyle(e);
            const date = e.parentElement.querySelector('input[type="date"]').getBoundingClientRect();
            const card = e.closest('.card-body'), c = card.getBoundingClientRect(), cs = getComputedStyle(card);
            const range = document.createRange(); range.selectNodeContents(e);
            const text = range.getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
                date: { left: date.left, right: date.right, top: date.top, bottom: date.bottom },
                cardRight: c.right - parseFloat(cs.paddingRight),
                rowRight: e.parentElement.getBoundingClientRect().right,
                textRight: text.right, paddingRight: parseFloat(style.paddingRight),
                font: parseFloat(style.fontSize), weight: style.fontWeight, color: style.color,
                clientWidth: e.clientWidth, scrollWidth: e.scrollWidth, cardId: card.id };
        });
        assert.equal(geometry.cardId, 'cardBody');
        assert.equal(geometry.font, 17.6);
        assert.equal(geometry.weight, '700');
        assert.equal(geometry.color, 'rgb(176, 42, 55)');
        assert.ok(Math.abs(geometry.right - geometry.rowRight) < 1);
        assert.ok(Math.abs(geometry.textRight - geometry.right + geometry.paddingRight) < 1);
        assert.ok(geometry.right <= geometry.cardRight);
        assert.ok(geometry.left >= 0 && geometry.right <= width);
        assert.ok(geometry.scrollWidth <= geometry.clientWidth);
        if (width === 1440) {
            assert.ok(geometry.top < geometry.date.bottom && geometry.bottom > geometry.date.top);
            assert.ok(geometry.left > geometry.date.right);
        } else assert.ok(geometry.top >= geometry.date.bottom);
        // Compare date placement with the previous indicator styling.
        const previousDate = await indicator.evaluate(e => {
            e.classList.remove('ms-auto', 'text-end'); e.style.fontSize = '1rem';
            const box = e.parentElement.querySelector('input[type="date"]').getBoundingClientRect();
            const result = { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
            e.classList.add('ms-auto', 'text-end'); e.style.removeProperty('font-size');
            return result;
        });
        assert.deepEqual(geometry.date, previousDate);
        if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR) {
            fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `draft-indicator-${width}.png`) });
        }
        console.log(JSON.stringify({ width, ...geometry }));
    } finally { await browser.close(); }
});
