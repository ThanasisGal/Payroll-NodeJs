'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../../..');
const view = fs.readFileSync(path.join(root,
    'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
const bootstrapCss = fs.readFileSync(path.join(root, 'public/css/bootstrap.min.css'), 'utf8');
const sweetAlertCss = fs.readFileSync(
    path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.css'), 'utf8');
const sweetAlertJs = fs.readFileSync(
    path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js'), 'utf8');
const defaultReason = 'Υποβολή απολογιστικού πίνακα μετά από την οριστικοποίηση της περιόδου';

test('WTODailyA final confirmation uses the horizontal reason row and shared PDF UI', async () => {
    const commonScript = "script('ergazomenoi/genika/erganiRestSubmissionUi')";
    const reviewScript = "script('ergazomenoi/programmata/elegxosApasxolhseonPeriodoy')";
    assert.ok(view.includes(commonScript));
    assert.ok(view.indexOf(commonScript) < view.indexOf(reviewScript));
    assert.match(source, /class="final-wto-reason-row mt-3"/);
    assert.doesNotMatch(source,
        /<label class="form-label mt-3" for="finalWtoReason">Αιτιολογία<\/label><textarea/);
    assert.match(css, /\.final-wto-reason-row\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*max-content minmax\(0, 1fr\);[\s\S]*?align-items:\s*center;[\s\S]*?width:\s*100%;/);
    assert.match(css, /\.final-wto-reason-row \.swal2-textarea\s*\{[\s\S]*?width:\s*100% !important;[\s\S]*?margin:\s*0 !important;[\s\S]*?box-sizing:\s*border-box;/);

    const renderedView = ejs.render(view, {
        userRole: 'HR', csrfToken: 'test-token', companyId: 'company-test',
        periodRec: { apo: '2026-08-01', eos: '2026-08-31' }, script: () => '#'
    });
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        await page.setContent(`<!doctype html><html><head><style>${bootstrapCss}</style>` +
            `<style>${sweetAlertCss}</style><style>${css}</style></head>` +
            `<body>${renderedView}</body></html>`, { waitUntil: 'domcontentloaded' });
        await page.addScriptTag({ content: sweetAlertJs });
        await page.addScriptTag({ content: source });
        await page.evaluate(() => {
            document.getElementById('apo_hmeromhnia').value = '2026-08-01';
            document.getElementById('eos_hmeromhnia').value = '2026-08-31';
            const fixedBranch = document.getElementById('ypokatasthma_stathera_advanced');
            if (fixedBranch) fixedBranch.value = '001';
            const branch = document.getElementById('ypokatasthma');
            if (branch) branch.value = '001';
            currentEmploymentPeriodControl = {
                final_submission_summary: {
                    period_start: '2026-08-01', period_end: '2026-08-31',
                    branch: '001', employees_count: 12, employee_days_count: 248
                }
            };
            window.finalWtoEvents = [];
            window.finalWtoRequests = [];
            window.fetch = async (url, options) => {
                window.finalWtoEvents.push('submit');
                window.finalWtoRequests.push({ url, body: JSON.parse(options.body) });
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        idempotent: true,
                        submissionCode: 'WTODailyA',
                        protocol: 'PROTO-EXISTING',
                        submitDate: '2026-09-01',
                        erganhLogId: '507f1f77bcf86cd799439011',
                        pdfUrl: '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439011'
                    })
                };
            };
            loadEmploymentPeriodControl = async requestedBranch => {
                window.finalWtoEvents.push(`refresh:${requestedBranch}`);
            };
            window.ErganiRestSubmissionUi = {
                presentSubmissionResultSafely: async result => {
                    window.finalWtoEvents.push('present');
                    window.finalWtoPresentation = result;
                    return result;
                }
            };
            window.finalWtoPromise = submitFinalWTODayilyA();
        });

        const textarea = page.locator('#finalWtoReason');
        await textarea.waitFor();
        assert.equal(await textarea.inputValue(), defaultReason);
        assert.equal(await textarea.isEditable(), true);

        const geometry = await page.locator('.final-wto-reason-row').evaluate(row => {
            const label = row.querySelector('label').getBoundingClientRect();
            const textareaBox = row.querySelector('textarea').getBoundingClientRect();
            const alert = row.parentElement.querySelector('.alert-danger').getBoundingClientRect();
            const popup = row.closest('.swal2-popup').getBoundingClientRect();
            return {
                display: getComputedStyle(row).display,
                labelTextareaMidpointDifference:
                    Math.abs((label.top + label.height / 2) -
                        (textareaBox.top + textareaBox.height / 2)),
                rightEdgeDifference: Math.abs(textareaBox.right - alert.right),
                textareaRight: textareaBox.right,
                popupRight: popup.right,
                textareaWidth: textareaBox.width
            };
        });
        assert.equal(geometry.display, 'grid', JSON.stringify(geometry));
        assert.ok(geometry.labelTextareaMidpointDifference <= 2, JSON.stringify(geometry));
        assert.ok(geometry.rightEdgeDifference <= 2, JSON.stringify(geometry));
        assert.ok(geometry.textareaRight <= geometry.popupRight, JSON.stringify(geometry));
        assert.ok(geometry.textareaWidth > 300, JSON.stringify(geometry));
        console.log(JSON.stringify({ finalWtoReasonGeometry: geometry }));
        assert.equal((await page.locator('.swal2-confirm').textContent()).trim(),
            'Οριστική υποβολή');
        assert.equal((await page.locator('.swal2-cancel').textContent()).trim(), 'Ακύρωση');

        await textarea.fill('');
        await page.locator('.swal2-confirm').click();
        await page.locator('.swal2-validation-message').waitFor();
        assert.equal((await page.locator('.swal2-validation-message').textContent()).trim(),
            'Η αιτιολογία είναι υποχρεωτική.');
        assert.equal(await textarea.isVisible(), true);
        await textarea.fill('  Επεξεργασμένη αιτιολογία χρήστη  ');
        assert.equal(await textarea.inputValue(), '  Επεξεργασμένη αιτιολογία χρήστη  ');
        await page.locator('.swal2-confirm').click();
        await page.evaluate(() => window.finalWtoPromise);

        const result = await page.evaluate(() => ({
            events: window.finalWtoEvents,
            requests: window.finalWtoRequests,
            presentation: window.finalWtoPresentation
        }));
        assert.equal(result.requests.length, 1);
        assert.equal(result.requests[0].url,
            '/api/prodhlomena-oraria/review/period-control/submission/final');
        assert.equal(result.requests[0].body.reason, 'Επεξεργασμένη αιτιολογία χρήστη');
        assert.deepEqual(result.events, ['submit', 'refresh:001', 'present']);
        assert.equal(result.presentation.idempotent, true);
        assert.equal(result.presentation.submissionCode, 'WTODailyA');
        assert.equal(result.presentation.protocol, 'PROTO-EXISTING');
        assert.equal(result.presentation.processDescription,
            'Οργάνωση Χρόνου Εργασίας - Απολογιστικός Πίνακας Ωραρίων');
        assert.equal(result.presentation.pdfViewerVariant, 'compact-portrait');
    } finally {
        await browser.close();
    }
});
