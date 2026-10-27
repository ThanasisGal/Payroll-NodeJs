'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const source = fs.readFileSync(require.resolve('./elegxosApasxolhseonPeriodoy'), 'utf8');
const extract = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));

test('Chromium: saved Stage 1 payloads avoid fresh requests; frozen decisions remain readable at all required widths', { timeout: 30000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.route('**/*', route => route.abort());
        await page.setContent('<main style="min-width:0"><div id="weeklyHrStage1Container"></div><div id="policyPreviewGroupsContainer"></div></main>');
        await page.addScriptTag({ content: `
            var weeklyHrStage1Scopes = new Map(), weeklyHrStage1RowsById = new Map(), weeklyHrStage1Payloads = new Map();
            var weeklyHrStage1Selected = new Set(), weeklyHrStage1DaySelected = new Set(), weeklyHrStage1DayDrafts = new Map();
            var weeklyHrStage1Page = 1, currentReviewLifecycleProjectionReady = false;
            var currentCanonicalLifecyclePayloads = [], currentReviewDeviations = [], requests = [];
            function resetWeeklyHrStage1TooltipInteraction() {}
            function buildWeeklyHrStage1Scopes() { return new Map(); }
            async function loadWeeklyHrLeaveCategories() {}
            async function fetchWeeklyHrStage1Bulk() { requests.push('unexpected'); throw Error('fresh read'); }
            function weeklyHrStage1Key(scope) { return scope.employee_kodikos; }
            function replaceCanonicalLifecyclePayload(payload) { currentCanonicalLifecyclePayloads = [payload]; }
            function isWeeklyHrStage1Selectable() { return false; }
            function renderWeeklyHrStage1Presentation() { document.getElementById('weeklyHrStage1Container').textContent = 'Αποθηκευμένες τιμές'; }
            function updateEmploymentReviewWorkflowPresentation() {}
            function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
            function formatStage1DateKey(value) { return String(value || '').slice(0, 10); }
            function canonicalDecisionTypeLabel() { return 'Αποθηκευμένη απόφαση'; }
            ${extract('async function renderWeeklyHrStage1(', 'function prepareWeeklyHrStage1LazyLoad(')}
        ` });
        // Extract the complete fallback body using its next named function, without evaluating the application.
        const fallback = source.match(/function renderWeeklyHrStage2LifecycleFallback\([\s\S]*?\n}/)[0];
        await page.addScriptTag({ content: fallback });
        await page.evaluate(async () => {
            const payload = { scope: { employee_kodikos: '001', week_start: '2026-08-31' },
                rows: [{ _id: 'saved', ores_ergasias_apologistika: 6.37 }],
                lifecycle_projection: { finalized_authoritative: true, stages: { stage2: {
                    stored_decisions: [{ employee_kodikos: '001', week_start: '2026-08-31', decision_type: 'TEST' }],
                    stored_transfers: [{ employee_kodikos: '001', week_start: '2026-08-31' }] } } } };
            await renderWeeklyHrStage1(payload.rows, { storedPayloads: [payload] });
            renderWeeklyHrStage2LifecycleFallback({ stages: { STAGE2: { business_status: 'COMPLETED' } } });
        });
        assert.deepEqual(await page.evaluate(() => requests), []);
        assert.equal(await page.evaluate(() => weeklyHrStage1Payloads.get('001').rows[0].ores_ergasias_apologistika), 6.37);
        assert.match(await page.locator('#policyPreviewGroupsContainer').innerText(), /Εφαρμοσμένη μεταφορά ρεπό/);
        for (const [width, height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[800,600]]) {
            await page.setViewportSize({ width, height });
            for (const sidebar of [0, 260]) {
                await page.locator('main').evaluate((node, margin) => { node.style.marginLeft = margin + 'px'; }, sidebar);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            }
        }
    } finally { await browser.close(); }
});
