'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../..');
const { row, catalogs } = require('../../../../server/services/ergazomenoi/fixtures/employeeContractDisplayFixtures');
const { enrichWithCatalogs } = require('../../../../test/fixtures/employeeContractDetails');
const F = require('../../../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { planEmployeeHistoryAutomaticReconstruction } = require('../../../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
const { buildEmployeeHistoryReconstructionPreview } = require('../../../../server/services/ergazomenoi/employeeHistoryReconstructionPreviewService');

for (const width of [1440, 390]) test(`contract History, review borders and sidebar alignment at ${width}px; no real network`, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const input = F.caseA();
        input.completeHistoryRows.forEach(r => Object.assign(r, row));
        Object.assign(input.currentEmployee, row);
        const history = await enrichWithCatalogs(input.completeHistoryRows, catalogs);
        const preview = buildEmployeeHistoryReconstructionPreview({ plan: planEmployeeHistoryAutomaticReconstruction(input),
            completeHistoryRows: input.completeHistoryRows, catalogs });
        const partial = await ejs.renderFile(path.join(root,
            'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs'), {
            ergazomenoiData: input.currentEmployee, istorikoData: history, problematicHistoryIds: [],
            employeeHistoryAccessMode: 'ADMIN_FULL', employeeHistoryStateToken: 'synthetic' });
        const sidebar = (await ejs.renderFile(path.join(root, 'views/partials/sidebar.ejs'), {
            userRole: 'A', isAdminOrSupervisorRole: () => true, NODE_ENV: 'development', nonce: '', userId: '', script: () => ''
        })).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
        const page = await browser.newPage({ viewport: { width, height: 1000 }, locale: 'el-GR' });
        const errors = [], requests = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => { requests.push(route.request().method()); return route.abort(); });
        await page.setContent(`<!doctype html><html lang="el"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <body>${sidebar}<div id="test-history">${partial}</div></body></html>`);
        for (const file of ['public/css/bootstrap.min.css', 'public/css/main.css']) await page.addStyleTag({ path: path.join(root, file) });
        for (const file of ['public/js/bootstrap.bundle.min.js', 'public/js/common/sidebar.js',
            'public/js/ergazomenoi/genika/employeeHistoryFieldLabels.js', 'public/js/ergazomenoi/genika/istorikoTable.js',
            'public/js/ergazomenoi/genika/employeeHistoryReconstructionPreview.js']) await page.addScriptTag({ path: path.join(root, file) });
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
        const capture = async name => {
            if (!process.env.PAYROLL_VISUAL_ARTIFACT_DIR) return;
            fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `${name}-${width}.png`), animations: 'disabled' });
        };
        const checkArrows = async () => {
            const positions = await page.locator('#nav-tree .sidebar-submenu-toggle:visible').evaluateAll(links => links.map(link => {
                const arrow = link.querySelector('.user-privileges-hierarchy-chevron').getBoundingClientRect();
                const label = link.querySelector('.sidebar-menu-label').getBoundingClientRect();
                return { x: arrow.x + arrow.width / 2, labelRight: label.right, left: arrow.left };
            }));
            assert.ok(positions.length > 4);
            assert.ok(Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x)) < 1, JSON.stringify(positions));
            assert.ok(positions.every(p => p.labelRight <= p.left));
            const right = await page.locator('#sidebarMenu').evaluate(e => e.getBoundingClientRect().right);
            assert.ok(right - positions[0].x < 24, `right inset: ${right - positions[0].x}`);
        };
        await checkArrows(); await capture('sidebar-closed');
        await page.locator('#btn-expand-all').click();
        await checkArrows(); await capture('sidebar-open');
        await page.locator('#btn-collapse-all').click();
        await checkArrows();
        // Inspect the full History width as it appears in the employee panel.
        await page.locator('#sidebarMenu').evaluate(e => { e.hidden = true; });
        await page.mouse.move(0, 0);
        await page.locator('.istoriko-actions i').evaluateAll(icons => icons.forEach(icon => {
            icon.innerHTML = '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor"><path d="M7 1h2v6h6v2H9v6H7V9H1V7h6z"/></svg>';
        }));
        const review = page.locator('.istoriko-actions [data-action="review"]').first();
        const box = await review.evaluate(e => {
            const rect = e.getBoundingClientRect(), cell = e.closest('td').getBoundingClientRect(), style = getComputedStyle(e);
            return { left: rect.left, right: rect.right, cellLeft: cell.left, cellRight: cell.right,
                font: parseFloat(style.fontSize), weight: style.fontWeight, borderLeft: style.borderLeftWidth, borderRight: style.borderRightWidth,
                overflow: e.scrollWidth > e.clientWidth + 1, whiteSpace: style.whiteSpace, cellWidth: cell.width,
                background: style.backgroundColor };
        });
        // This isolated partial has the 14px compact fallback; the full layout uses its shared 14.4–16px scale.
        assert.ok(box.font >= 14 && box.font <= 16); assert.equal(box.weight, '400');
        assert.equal(box.whiteSpace, 'nowrap'); assert.equal(box.overflow, false);
        assert.ok(box.left >= box.cellLeft + 1 && box.right <= box.cellRight - 1, JSON.stringify(box));
        assert.equal(box.borderLeft, '1px'); assert.equal(box.borderRight, '1px');
        assert.ok(box.cellWidth <= 202);
        assert.ok(box.left >= 0 && box.right <= width, JSON.stringify(box));
        assert.equal(box.background, 'rgb(240, 231, 226)');
        const iconBoxes = await page.locator('.istoriko-row').first().locator('.istoriko-btn').evaluateAll(elements => elements.map(e => {
            const r = e.getBoundingClientRect(), cell = e.closest('td').getBoundingClientRect();
            return { left: r.left, right: r.right, cellLeft: cell.left, cellRight: cell.right, padding: getComputedStyle(e).padding, iconWidth: e.querySelector('i').getBoundingClientRect().width };
        }));
        assert.ok(iconBoxes.every(r => r.left >= r.cellLeft && r.right <= r.cellRight), JSON.stringify(iconBoxes));
        await review.hover(); await page.waitForTimeout(200);
        assert.equal(await review.evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(121, 85, 72)');
        await page.mouse.move(0, 0); await capture('history-review');
        // Bootstrap adds .show before the opening transition ends and ignores hide() during it.
        // Register before opening so even a synchronous shown event cannot be missed.
        await page.locator('#istorikoDetailsModal').evaluate(modal => {
            window.__istorikoDetailsShown = false;
            modal.addEventListener('shown.bs.modal', () => { window.__istorikoDetailsShown = true; }, { once: true });
        });
        await page.locator('.istoriko-row').first().dblclick();
        await page.locator('#istorikoDetailsModal.show').waitFor();
        await page.waitForFunction(() => window.__istorikoDetailsShown === true);
        const details = page.locator('#istorikoDetailsBody');
        assert.match(await details.innerText(), /0001\s*-\s*ΒΟΗΘΟΣ ΣΕΡΒΙΤΟΡΟΥ/);
        const items = details.locator('.istoriko-contract-elements-table tbody tr:not(.istoriko-modal-totals-row)');
        assert.equal(await items.count(), 2);
        assert.match(await items.nth(0).innerText(), /0001 - ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ/);
        assert.equal((await items.nth(0).locator('td').nth(2).innerText()).trim(), '990,00');
        assert.equal((await items.nth(0).locator('td').nth(3).innerText()).trim(), '');
        assert.equal((await items.nth(1).locator('td').nth(2).innerText()).trim(), '');
        assert.equal((await items.nth(1).locator('td').nth(3).innerText()).trim(), '99,00');
        await capture('history-contract-details');
        await details.locator('.istoriko-contract-elements-table').scrollIntoViewIfNeeded();
        await capture('history-contract-details-items');
        await page.locator('#istorikoDetailsModal [data-bs-dismiss]').first().click();
        await page.locator('#istorikoDetailsModal').waitFor({ state: 'hidden' });
        await page.evaluate(preview => { void window.employeeHistoryReconstructionPreview.approveForSave({ preview, token: 'synthetic' }); }, preview);
        await page.locator('#employeeHistoryReconstructionPreviewModal.show').waitFor();
        const body = page.locator('#employeeHistoryReconstructionPreviewBody');
        assert.match(await body.innerText(), /0001 - ΒΟΗΘΟΣ ΣΕΡΒΙΤΟΡΟΥ/);
        assert.doesNotMatch(await body.innerText(), /ΑΡΧΙΜΑΓΕΙΡΟΣ|Στοιχείο Σύμβασης \d{2}|poso_symbashs|stoixeio_symbashs/);
        const first = body.locator('.history-preview-period .history-preview-contract-items').first();
        assert.equal(await first.locator('tbody tr').count(), 2);
        assert.equal((await first.locator('tbody tr').first().locator('td').nth(3).textContent()).trim(), '');
        await capture('history-contract-preview');
        await first.scrollIntoViewIfNeeded(); await capture('history-contract-preview-items');
        const original = body.locator('.history-preview-original > details').first();
        await original.locator(':scope > summary').click();
        const contract = original.locator('details').filter({ has: page.locator('summary', { hasText: /^Στοιχεία Σύμβασης$/ }) });
        await contract.locator('summary').click();
        await contract.locator('.history-preview-contract-items tbody tr').first().waitFor();
        assert.equal(await contract.locator('.history-preview-contract-items tbody tr').count(), 2);
        assert.match(await contract.innerText(), /0001 - ΒΟΗΘΟΣ ΣΕΡΒΙΤΟΡΟΥ/);
        assert.doesNotMatch(await contract.innerText(), /Στοιχείο Σύμβασης \d{2}|Ποσό.* \d{2}|ΑΡΧΙΜΑΓΕΙΡΟΣ/);
        await contract.scrollIntoViewIfNeeded(); await capture('history-contract-original');
        await contract.locator('.history-preview-contract-items').scrollIntoViewIfNeeded();
        await capture('history-contract-original-items');
        assert.deepEqual(errors, []);
        assert.ok(requests.every(method => method === 'GET'));
    } finally { await browser.close(); }
});
