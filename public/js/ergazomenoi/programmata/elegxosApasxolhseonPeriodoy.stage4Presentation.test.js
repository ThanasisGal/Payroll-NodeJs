'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
const view = fs.readFileSync(path.join(root, 'views/ergazomenoi/programmata',
    'elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const dynamicSource = source.slice(source.indexOf('function ensureReviewTableStructure'),
    source.indexOf('function ', source.indexOf('function ensureReviewTableStructure') + 20));
const dynamicCss = dynamicSource.match(/style\.textContent = `([\s\S]*?)`;/)?.[1] || '';
assert.ok(dynamicCss.includes('var(--stage4-absence-bg)'));
assert.doesNotMatch(dynamicCss, /\.cell-apoysia\s*\{\s*background-color:\s*#dc3545/i);

const completed = { scope: { employee_kodikos: '0013', week_start: '2026-05-25',
    week_end: '2026-05-31' }, lifecycle_projection: { stages: { stage4: {
    business_status: 'COMPLETED', pending_count: 0,
    final_weekly_analysis: { status: 'READY', sixthDayIdentity: '2026-05-31',
        sixthDay: { hmeromhnia: '2026-05-31', premiumRate: 40 } }
} } } };
const blocked = { scope: { employee_kodikos: '0012', week_start: '2026-04-20',
    week_end: '2026-04-26' }, lifecycle_projection: { stages: { stage4: {
    business_status: 'BLOCKED', pending_count: 1,
    blockers: ['CARD_VERIFICATION_PENDING'],
    final_weekly_analysis: { status: 'NEEDS_HR_DECISION', reasons: ['CARD_VERIFICATION_PENDING'] }
} } } };
const sandbox = {
    currentCanonicalLifecyclePayloads: [completed, blocked],
    weeklyHrStage1Payloads: new Map(),
    stage1DateKey: (value) => String(value || '').slice(0, 10),
    reviewHrReasonLabel: () => 'Εκκρεμεί επιβεβαίωση κάρτας.',
    escapeHtml: (value) => String(value ?? ''),
    renderWeeklySeventhDayValue: (dev) => dev.seventh_day_count ?? 0,
    document: { getElementById: () => null }
};
vm.createContext(sandbox);
const lifecycleStart = source.indexOf('function weeklyLifecyclePayloadForDeviation');
const lifecycleEnd = source.indexOf('function hasAdeiaSuggestion', lifecycleStart);
const summaryStart = source.indexOf('function renderStage4Summary');
const summaryEnd = source.indexOf('function updateEmploymentReviewWorkflowPresentation', summaryStart);
vm.runInContext(`${source.slice(lifecycleStart, lifecycleEnd)}\n${source.slice(summaryStart, summaryEnd)}
this.classification = renderStage4ClassificationPill;
this.sixth = renderStage4SixthDayValue;
this.seventh = renderStage4SeventhDayValue;
this.status = renderStage4StatusCell;
this.summary = renderStage4Summary;`, sandbox);
const absenceHtml = sandbox.classification('ΑΠΟΥΣΙΑ');
assert.match(absenceHtml, /stage4-classification-absence/);
assert.doesNotMatch(absenceHtml, /text-bg-danger/);
assert.match(sandbox.classification('ΑΔΕΙΑ'), /stage4-classification-leave/);
assert.match(sandbox.classification('ΑΣΘΕΝΕΙΑ'), /stage4-classification-sickness/);
assert.match(sandbox.classification('ΑΝΑΠΑΥΣΗ \/ ΡΕΠΟ'), /stage4-classification-repo/);
const sixthHtml = sandbox.sixth({ kodikos: '0013', week_apo: '2026-05-25',
    week_eos: '2026-05-31', sixth_day_count: 1 });
assert.match(sixthHtml, /stage4-sixth-day-pill[^>]*>6η ημέρα · 40%/);
assert.doesNotMatch(sixthHtml, /text-bg-danger/);
const blockedHtml = sandbox.status({ kodikos: '0012', week_apo: '2026-04-20',
    week_eos: '2026-04-26' });
assert.match(blockedHtml, /badge text-bg-danger[^>]*>ΜΠΛΟΚΑΡΙΣΜΕΝΟ/);
assert.match(blockedHtml, /Εκκρεμεί επιβεβαίωση κάρτας/);
const seventhPayload = JSON.parse(JSON.stringify(completed));
seventhPayload.lifecycle_projection.stages.stage4.final_weekly_analysis.seventhDay = {
    severity: 'SERIOUS_VIOLATION', classification: 'SEVENTH_DAY_ILLEGAL_OVERTIME' };
sandbox.currentCanonicalLifecyclePayloads.push(seventhPayload);
assert.match(sandbox.seventh({ kodikos: '0013', week_apo: '2026-05-25',
    week_eos: '2026-05-31', seventh_day_count: 1,
    seventh_day_severity: 'SERIOUS_VIOLATION' }), /text-bg-danger[^>]*>7η ημέρα · ΠΑΡΑΝΟΜΗ/);

const strip = { classList: { names: new Set(), toggle(name, on) {
    if (on) this.names.add(name); else this.names.delete(name);
} }, textContent: '' };
sandbox.document.getElementById = () => strip;
sandbox.summary([completed]);
assert.equal(strip.textContent, '✓ Τελικός εβδομαδιαίος έλεγχος ολοκληρώθηκε');
assert.equal(strip.classList.names.has('d-none'), false);
sandbox.summary([completed, blocked]);
assert.equal(strip.textContent, 'Χρειάζονται έλεγχο: 1 εβδομάδα');
assert.equal(strip.classList.names.has('stage4-summary-attention'), true);
assert.match(view, /id="employmentReviewStage4Summary"[^>]*role="status"/);

const weeklySource = source.slice(source.indexOf('function appendEmployeeDeviationRows'),
    source.indexOf('const canonicalApplicabilityLabels'));
const header = weeklySource.match(/<thead[\s\S]*?<tr>([\s\S]*?)<\/tr>/)?.[1] || '';
const row = weeklySource.match(/data-week-end=[\s\S]*?<\/tr>/)?.[0] || '';
assert.equal((header.match(/<th(?:\s|>)/g) || []).length, 10);
assert.equal((row.match(/<td(?:\s|>)/g) || []).length, 10);
assert.match(row, /stage4-week-code/);

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent(`<!doctype html><style>${css}\n${dynamicCss}</style>
            <section id="employmentReviewWorkspace"><div class="employment-review-scroll-container"
                style="height:180px;overflow:auto"><div id="employmentReviewStage4Collapse">
                <div class="stage4-summary-strip">✓ Τελικός εβδομαδιαίος έλεγχος ολοκληρώθηκε</div>
                <table id="resultsTable"><thead><tr><th>Ημ/νία</th></tr></thead>
                <tbody><tr class="employee-detail-row"><td>04/05</td>
                    <td class="cell-apoysia cell-stage1-absence">${absenceHtml}</td></tr>
                    <tr class="employee-deviation-row"><td><table class="weekly-deviation-table">
                    <thead><tr><th>6η ημέρα</th></tr></thead><tbody><tr><td>${sixthHtml}</td></tr>
                    </tbody></table></td></tr></tbody></table></div></div></section>`);
        const styles = await page.evaluate(() => {
            const absence = document.querySelector('.cell-apoysia');
            const pill = document.querySelector('.stage4-classification-absence');
            const sixth = document.querySelector('.stage4-sixth-day-pill');
            return { absenceBg: getComputedStyle(absence).backgroundColor,
                absenceText: getComputedStyle(absence).color,
                pillBg: getComputedStyle(pill).backgroundColor,
                sixthBg: getComputedStyle(sixth).backgroundColor,
                headerPosition: getComputedStyle(document.querySelector('#resultsTable > thead th')).position,
                weeklyHeaderPosition: getComputedStyle(document.querySelector('.weekly-deviation-table th')).position };
        });
        assert.equal(styles.absenceBg, 'rgb(247, 232, 232)', JSON.stringify(styles));
        assert.equal(styles.absenceText, 'rgb(122, 52, 52)', JSON.stringify(styles));
        assert.equal(styles.pillBg, 'rgb(247, 232, 232)', JSON.stringify(styles));
        assert.equal(styles.sixthBg, 'rgb(251, 243, 223)', JSON.stringify(styles));
        assert.equal(styles.headerPosition, 'sticky');
        assert.equal(styles.weeklyHeaderPosition, 'sticky');
        console.log('Stage4 presentation UI tests passed');
    } finally {
        await browser.close();
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
