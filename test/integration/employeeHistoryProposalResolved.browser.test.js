'use strict';
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { forbidRealSettlementMongo } = require('../fixtures/forbidRealSettlementMongo');
const { startUnifiedPreviewHarness } = require('../fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const F = require('../fixtures/employeeHistoryResolvedProposal');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const P = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalContract');

test('Chromium: νέα φόρτωση χωρίς επιλογή, σωστή αρίθμηση και χωριστές ολοκληρωμένες εγγραφές', { timeout: 60000 }, async () => {
    forbidRealSettlementMongo(mock);
    const data = F.resolvedProposalFixture(), audit = F.approveSyntheticEdition(data);
    let auditReads = 0;
    const historyAuditModel = { find(filter) {
        auditReads++;
        assert.equal(filter['employeeScope.employee_id'], data.currentEmployee._id);
        assert.equal(filter['employeeScope.company_kod'], data.scope.company_kod);
        assert.equal(filter['diagnostics.rowApproval.status'], 'APPROVED_RESOLVED');
        return { sort() { return this; }, session() { return this; }, lean: async () => [structuredClone(audit)] };
    } };
    const h = await startUnifiedPreviewHarness({ data, catalogs: F.catalogs, historyAuditModel });
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage(), before = A.stringify(h.state), external = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
        if (new URL(route.request().url()).origin === h.origin) return route.continue();
        external.push(route.request().url()); return route.abort();
    });
    const url = `${h.origin}/api/ergazomenoi/${data.currentEmployee._id}/history-proposal-editor`;
    try {
        assert.equal((await page.goto(url)).status(), 200);
        assert.match(await page.locator('#proposalCaseCounts').textContent(), /Ενεργές εκκρεμότητες: 1.*Ολοκληρωμένες εγγραφές: 1/);
        assert.match(await page.locator('#proposalActiveCase').textContent(), /Ανοιχτή περίπτωση: UPDATE.*0003.*01\/04\/2026.*02\/06\/2026/);
        assert.match(await page.locator('.proposal-context').textContent(), /Περίπτωση 1 από 1/);
        assert.equal(await page.locator('#proposalSelection option[value^="INSERT:"]').count(), 0);
        const completed = page.locator('optgroup[label="Εγκεκριμένες — Ολοκληρωμένες εγγραφές"]');
        assert.match(await completed.textContent(), /Εγγραφή 0001/);

        await page.locator('#proposalSelection').selectOption(`UPDATE:${data.completeHistoryRows[0]._id}`);
        await page.waitForFunction(() => document.getElementById('proposalActiveCase').textContent.includes('Εγκεκριμένη — Ολοκληρωμένη:'));
        assert.match(await page.locator('.proposal-context').textContent(), /^Επιλεγμένη εγγραφή/);
        assert.match(await page.locator('#proposalCaseCounts').textContent(), /Ενεργές εκκρεμότητες: 1/);
        assert.equal(await page.locator('#historyProposalEditor table').count(), 1);
        assert.equal(await page.locator('#legacyHistoryCertification, #previewProposalCertification').count(), 0);

        for (const [width, height] of [[1440, 900], [900, 450], [480, 700]]) for (const sidebar of [false, true]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(open => {
                const main = document.querySelector('.proposal-page');
                main.style.width = open ? 'calc(100% - 160px)' : '';
                main.style.marginLeft = open ? '160px' : '';
            }, sidebar);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            for (const selector of ['#proposalActiveCase', '#proposalCaseCounts', '#proposalSelection']) {
                await page.locator(selector).scrollIntoViewIfNeeded();
                const rect = await page.locator(selector).boundingBox();
                assert.ok(rect.width > 0 && rect.x >= 0 && rect.x + rect.width <= width + 1);
            }
            await page.locator('#saveProposalXlsx').scrollIntoViewIfNeeded();
            assert.ok(await page.locator('#saveProposalXlsx').isVisible());
        }
        await page.goto(url);
        assert.match(await page.locator('.proposal-context').textContent(), /Περίπτωση 1 από 1/);
        assert.equal(await page.locator('#proposalSelection option[value^="INSERT:"]').count(), 0);
        assert.ok(auditReads >= 3);
        assert.equal(A.stringify(h.state), before); assert.equal(h.counts.applyRequests, 0);
        assert.equal(audit.diagnostics.rowApproval.status, 'APPROVED_RESOLVED');
        assert.equal(P.enabled(), false); assert.deepEqual(errors, []); assert.deepEqual(external, []);
    } finally { await browser.close(); await h.close(); mock.restoreAll(); }
});
