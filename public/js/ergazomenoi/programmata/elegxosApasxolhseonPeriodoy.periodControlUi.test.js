'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const view = fs.readFileSync(path.join(root,
    'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
const bootstrapCss = fs.readFileSync(path.join(root, 'public/css/bootstrap.min.css'), 'utf8');
const sweetAlertCss = fs.readFileSync(path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.css'), 'utf8');
const sweetAlertJs = fs.readFileSync(path.join(root, 'node_modules/sweetalert2/dist/sweetalert2.all.js'), 'utf8');
const browserSource = fs.readFileSync(path.join(root,
    'public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
const renderedView = ejs.render(view, {
    userRole: 'HR', csrfToken: 'test-token', companyId: 'company-test',
    periodRec: { apo: '2026-06-01', eos: '2026-06-30' }, script: () => '#'
});

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        await page.setContent(`<!doctype html><html><head><style>${bootstrapCss}</style><style>${sweetAlertCss}</style><style>${css}</style></head>
            <body>${renderedView}</body></html>`, { waitUntil: 'domcontentloaded' });
        await page.addScriptTag({ content: sweetAlertJs });
        await page.addScriptTag({ content: browserSource });

        async function transitionModalContract(periodControl, action) {
            await page.evaluate(({ control, transitionAction }) => {
                currentEmploymentPeriodControl = control;
                window.periodControlModalPromise = transitionEmploymentPeriod(transitionAction);
            }, { control: periodControl, transitionAction: action });
            const button = page.locator('.swal2-confirm');
            await button.waitFor();
            const contract = await button.evaluate((element) => {
                const style = getComputedStyle(element);
                return {
                    text: element.textContent.trim(), classes: [...element.classList],
                    whiteSpace: style.whiteSpace,
                    clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
                    textareaValue: document.querySelector('.swal2-textarea')?.value,
                    cancelText: document.querySelector('.swal2-cancel')?.textContent.trim()
                };
            });
            await page.locator('.swal2-cancel').click();
            return contract;
        }

        const historicalLockContract = await transitionModalContract(
            { effective_mode: 'HISTORICAL_RECONSTRUCTED' }, 'lock');
        assert.strictEqual(historicalLockContract.text, 'Κλείδωμα περιόδου');
        assert.ok(historicalLockContract.classes.includes('employment-period-lock-confirm-button'));
        assert.ok(historicalLockContract.classes.includes('custom-confirm-button'));
        assert.ok(historicalLockContract.classes.includes('custom-swal-button'));
        assert.strictEqual(historicalLockContract.whiteSpace, 'nowrap');
        assert.ok(historicalLockContract.clientWidth >= historicalLockContract.scrollWidth);
        assert.strictEqual(historicalLockContract.textareaValue,
            'Ολοκλήρωση ελέγχου και κλείδωμα ανακατασκευασμένης εκπρόθεσμης περιόδου');

        const normalLockContract = await transitionModalContract(
            { effective_mode: 'NORMAL' }, 'lock');
        assert.strictEqual(normalLockContract.textareaValue,
            'Ολοκλήρωση ελέγχου και κλείδωμα περιόδου');
        assert.ok(normalLockContract.classes.includes('employment-period-lock-confirm-button'));

        const unlockContract = await transitionModalContract(
            { effective_mode: 'LOCKED' }, 'unlock');
        assert.strictEqual(unlockContract.text, 'Ξεκλείδωμα περιόδου');
        assert.ok(unlockContract.classes.includes('employment-period-unlock-confirm-button'));
        assert.ok(!unlockContract.classes.includes('employment-period-lock-confirm-button'));
        assert.ok(!unlockContract.classes.includes('employment-period-finalize-confirm-button'));
        assert.strictEqual(unlockContract.whiteSpace, 'nowrap');
        assert.ok(unlockContract.clientWidth >= unlockContract.scrollWidth);
        assert.strictEqual(unlockContract.textareaValue, '');

        async function lifecycleModalContract(periodControl, kind) {
            await page.evaluate(({ control, actionKind }) => {
                currentEmploymentPeriodControl = control;
                window.periodControlModalPromise = runEmploymentPeriodLifecycleAction(actionKind);
            }, { control: periodControl, actionKind: kind });
            const button = page.locator('.swal2-confirm');
            await button.waitFor();
            const contract = await button.evaluate((element) => {
                const style = getComputedStyle(element);
                return {
                    text: element.textContent.trim(), classes: [...element.classList],
                    whiteSpace: style.whiteSpace, clientWidth: element.clientWidth,
                    scrollWidth: element.scrollWidth,
                    textareaValue: document.querySelector('.swal2-textarea')?.value,
                    cancelText: document.querySelector('.swal2-cancel')?.textContent.trim()
                };
            });
            await page.locator('.swal2-cancel').click();
            return contract;
        }

        const historicalFinalizeContract = await lifecycleModalContract(
            { effective_mode: 'LOCKED', past_deadline: true,
                historical_reconstruction: { status: 'COMPLETED', version: 1 } },
            'finalize');
        assert.strictEqual(historicalFinalizeContract.text, 'Οριστικοποίηση περιόδου');
        assert.ok(historicalFinalizeContract.classes.includes(
            'employment-period-finalize-confirm-button'));
        assert.strictEqual(historicalFinalizeContract.whiteSpace, 'nowrap');
        assert.ok(historicalFinalizeContract.clientWidth >= historicalFinalizeContract.scrollWidth);
        assert.strictEqual(historicalFinalizeContract.textareaValue,
            'Ολοκλήρωση ελέγχου και οριστικοποίηση ανακατασκευασμένης εκπρόθεσμης περιόδου');

        const normalFinalizeContract = await lifecycleModalContract(
            { effective_mode: 'LOCKED', past_deadline: false,
                historical_reconstruction: { status: '', version: 0 } },
            'finalize');
        assert.strictEqual(normalFinalizeContract.textareaValue,
            'Ολοκλήρωση ελέγχου και οριστικοποίηση περιόδου');
        assert.ok(normalFinalizeContract.classes.includes(
            'employment-period-finalize-confirm-button'));

        const correctiveContract = await lifecycleModalContract(
            { effective_mode: 'FINALIZED' }, 'corrective');
        assert.ok(!correctiveContract.classes.includes('employment-period-finalize-confirm-button'));
        assert.ok(!correctiveContract.classes.includes('employment-period-lock-confirm-button'));
        assert.ok(!correctiveContract.classes.includes('employment-period-unlock-confirm-button'));
        assert.strictEqual(correctiveContract.textareaValue, '');
        assert.strictEqual(correctiveContract.cancelText, 'Ακύρωση');
        assert.strictEqual(unlockContract.cancelText, 'Ακύρωση');
        console.log(JSON.stringify({ historicalLockContract, normalLockContract, unlockContract,
            historicalFinalizeContract, normalFinalizeContract, correctiveContract }));
    } finally {
        await browser.close();
    }
    console.log('employment period control UI regression tests: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });
