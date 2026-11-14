'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../../..');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
function extract(name) {
    const start = source.indexOf('function ' + name + '(');
    return source.slice(start, source.indexOf('\nfunction ', start + 1));
}

test('Chromium: pending source-stage instructions remain visible and readable across required content sizes', async () => {
    const body = await ejs.renderFile(path.join(root, 'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), {
        userRole: 'HR', csrfToken: 'synthetic', companyId: 'synthetic', script: () => '#',
        periodRec: { apo: '2026-10-01', eos: '2026-10-31' }
    });
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.route('**/*', route => route.abort());
        await page.setContent('<main>' + body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '') + '</main>');
        for (const asset of ['public/css/bootstrap.min.css', 'public/css/main.css']) {
            await page.addStyleTag({ path: path.join(root, asset) });
        }
        await page.addScriptTag({ content: `
            var weeklyHrStage1AttentionTooltip = '';
            var workflowStageShortNames = { STAGE1: 'Άδειες', STAGE2: 'Μεταφορά Ρεπό', STAGE3: 'Πιθανές Άδειες', STAGE4: 'Έλεγχος' };
            function escapeHtml(value) { const n = document.createElement('span'); n.textContent = value; return n.innerHTML; }
            function updateWeeklyHrStage1BulkToolbar() {}
            ${['employmentReviewWaitingReason', 'employmentReviewProgressState', 'employmentReviewAttentionPresentation',
                'renderEmploymentReviewWorkflowGuide'].map(extract).join('\n')}
        ` });
        for (const reason of ['ERGANI_CARDS_RECEIPT_REQUIRED', 'ERGANI_CALCULATION_REQUIRED']) {
            await page.evaluate(reason => renderEmploymentReviewWorkflowGuide({ current_stage: 'STAGE1',
                stages: Object.fromEntries([1, 2, 3, 4].map(index => ['STAGE' + index, {
                    business_status: 'STALE', pending_reasons: [reason], open_by_default: index === 1
                }])) }), reason);
            assert.equal(await page.locator('#employmentReviewAttentionSummary').isVisible(), true);
            assert.match(await page.locator('#employmentReviewAttentionSummary').innerText(), /Εκκρεμεί/);
            for (const [width, height] of [[1920,1080], [1680,1050], [1600,900], [1440,900],
                [1280,1024], [1280,800], [1280,720], [800,600]]) {
                await page.setViewportSize({ width, height });
                for (const sidebar of [0, 260]) {
                    const measured = await page.evaluate(sidebar => {
                        const main = document.querySelector('main');
                        main.style.marginLeft = sidebar + 'px';
                        main.style.width = `calc(100% - ${sidebar}px)`;
                        const message = document.querySelector('#employmentReviewAttentionSummary p');
                        return { fits: message.scrollWidth <= message.clientWidth,
                            fontSize: parseFloat(getComputedStyle(message).fontSize),
                            pageFits: document.documentElement.scrollWidth <= innerWidth };
                    }, sidebar);
                    assert.equal(measured.fits, true, `${width}×${height}/${sidebar}`);
                    assert.equal(measured.pageFits, true, `${width}×${height}/${sidebar}`);
                    assert.ok(measured.fontSize >= 13.6);
                }
            }
        }
    } finally { await browser.close(); }
});
