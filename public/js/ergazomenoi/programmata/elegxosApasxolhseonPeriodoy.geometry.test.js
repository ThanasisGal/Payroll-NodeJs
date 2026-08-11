const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const view = fs.readFileSync(
    path.join(root, 'views/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.ejs'),
    'utf8'
);
const css = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
const bootstrapCss = fs.readFileSync(path.join(root, 'public/css/bootstrap.min.css'), 'utf8');
const reviewJs = fs.readFileSync(
    path.join(root, 'public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'),
    'utf8'
);
const renderedView = ejs.render(view, {
    userRole: 'HR',
    csrfToken: 'test-token',
    companyId: 'company-test',
    periodRec: { apo: '2026-06-01', eos: '2026-06-30' },
    script: () => '#'
});

function fixture() {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${bootstrapCss}</style><style>${css}</style></head>
        <body><main class="employment-review-test-host">${renderedView}</main>
        <footer class="footer" id="globalApplicationFooter">Εφαρμογή μισθοδοσίας</footer></body></html>`;
}

async function loadOperationalState(page) {
    await page.setContent(fixture(), { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: reviewJs });
    await page.evaluate(() => {
        currentEmploymentPeriodControl = {
            effective_mode: 'NORMAL',
            calculation: { authoritative_result: true },
            allowed_actions: { record_decision: true }
        };
        const beforeHeaders = Array.from(document.querySelectorAll('#resultsTable > thead th'))
            .map((header) => header.textContent.trim());
        window.reviewTableHeadersBefore = beforeHeaders;
        ensureReviewTableStructure();
        window.reviewTableHeadersAfter = Array.from(
            document.querySelectorAll('#resultsTable > thead th')
        ).map((header) => header.textContent.trim());
        currentReviewRows = [{
            _id: 'render-current-row',
            kodikos: '001',
            ypokatasthma: '0001',
            eponymo: 'ΔΟΚΙΜΗ',
            onoma: 'ΧΡΗΣΤΗΣ',
            hmeromhnia: '2026-06-03',
            kathgoria_ergasias: 'ΕΡΓ',
            ores_ergasias: 8,
            cards_ores_ergasias: 8,
            effective_is_full_time: true
        }, {
            _id: 'derived-possible-leave-row',
            kodikos: '001', ypokatasthma: '0001', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΧΡΗΣΤΗΣ',
            hmeromhnia: '2026-06-04', kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
            cards_ores_ergasias: 0, noCardsDisplayStatus: 'ΑΔΕΙΑ', adeia: false,
            kathgoria_adeias: '', ores_apoysias: 0, adeia_apologistika: false,
            kathgoria_adeias_apologistika: '', effective_is_full_time: true
        }, {
            _id: 'confirmed-leave-row',
            kodikos: '001', ypokatasthma: '0001', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΧΡΗΣΤΗΣ',
            hmeromhnia: '2026-06-05', kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
            cards_ores_ergasias: 0, noCardsDisplayStatus: 'ΑΔΕΙΑ', adeia: true,
            kathgoria_adeias: 'ΚΑΝΟΝΙΚΗ', adeia_apologistika: true,
            kathgoria_adeias_apologistika: 'ΚΑΝΟΝΙΚΗ', leave_provenance: 'HR_DECLARED_LEAVE',
            effective_is_full_time: true
        }];
        currentReviewDeviations = [{
            kodikos: '001', week_apo: '2026-06-01', week_eos: '2026-06-07',
            expected_repo: 2, actual_repo: 1, resolved_repo: 2, actual_workdays: 6,
            sixth_day_count: 1, seventh_day_count: 0,
            effective_typos_apasxolhshs: '0', effective_weekly_workdays: 5,
            effective_expected_repo: 2, status: 'NEEDS_HR_DECISION',
            repo_transfer_status: 'NEEDS_REVIEW',
            repo_transfer_reasons: ['MULTIPLE_TARGET_CANDIDATES'],
            canonical_reasons: ['CARD_VERIFICATION_PENDING',
                'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC', 'UNKNOWN_PRIVATE_REASON_CODE'],
            note: 'Πραγματική ανθρώπινη σημείωση.'
        }];
        currentPendingDeviationWeeks = [{
            kodikos: '001',
            status: 'OPEN_WEEK_PENDING_COMPLETION',
            week_apo: '2026-06-01',
            week_eos: '2026-06-07'
        }];
        currentLegacyDeviations = [];
        renderCurrentReviewRows();
        window.openWeekRenderedText = document.querySelector('#resultsTable tbody')?.innerText || '';
        document.getElementById('employmentPeriodControlPanel').classList.remove('d-none');
        document.getElementById('employmentPeriodControlStatus').textContent =
            'ΕΚΠΡΟΘΕΣΜΗ — ΧΩΡΙΣ ΟΡΙΣΤΙΚΟΠΟΙΗΜΕΝΟ ΑΠΟΤΕΛΕΣΜΑ';
        document.getElementById('employmentPeriodControlDeadline').textContent = '31/07/2026';
        document.getElementById('historicalReconstructionBtn').classList.remove('d-none');
        const summary = document.getElementById('policyPreviewGroupsContainer');
        const body = document.querySelector('#resultsTable tbody');
        body.insertAdjacentHTML('beforeend', Array.from({ length: 80 }, (_, index) => `<tr class="geometry-filler-row">${Array.from(
            { length: 13 },
            (_unused, cell) => `<td>${cell === 0 ? `0${(index % 9) + 1}/06/2026` : `Στοιχείο ${index + 1}-${cell + 1}`}</td>`
        ).join('')}</tr>`).join(''));
        currentAtomicRepoTransferProjection = {
            actionable_issue_groups: [{
                issue_code: 'MULTIPLE_TARGET_CANDIDATES',
                category: 'HUMAN_REVIEW_REQUIRED',
                count: 1,
                employees_count: 1,
                cases: [{
                    team: 'team-a', company_kod: 'company-a', ypokatasthma: '0001',
                    employee_kodikos: '001', week_start: '2026-06-01',
                    week_end: '2026-06-07', related_dates: ['2026-06-03']
                }]
            }]
        };
        summary.innerHTML = renderActionableIssueGroups(
            currentAtomicRepoTransferProjection.actionable_issue_groups
        );
        bindActionableIssueEvents(summary);
        const scenarioDetails = document.createElement('div');
        scenarioDetails.id = 'scenarioDetailsTestHost';
        scenarioDetails.innerHTML = renderScenarioDetailsSection({
            scenarioDecision: {
                scenario_code: 'UNKNOWN_PATTERN_REQUIRES_REVIEW',
                confidence: 'HIGH',
                decision_status: 'NEEDS_REVIEW',
                requires_review: true,
                reasons: ['CARD_VERIFICATION_PENDING', 'UNKNOWN_PRIVATE_REASON_CODE'],
                warnings: ['CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC']
            }
        });
        document.body.appendChild(scenarioDetails);
    });
}

async function renderedTableContract(page) {
    return page.evaluate(() => ({
        before: window.reviewTableHeadersBefore,
        after: window.reviewTableHeadersAfter,
        colCount: document.querySelectorAll('#resultsTable > colgroup > col').length,
        dailyCellCounts: Array.from(document.querySelectorAll(
            '#resultsTable > tbody > tr.employee-detail-row, #resultsTable > tbody > tr.geometry-filler-row'
        ))
            .map((row) => row.cells.length),
        subtotalLogicalColumns: Array.from(
            document.querySelector('.employee-subtotal-row')?.cells || []
        ).reduce((total, cell) => total + cell.colSpan, 0),
        weeklyHeaders: Array.from(document.querySelectorAll('.employee-deviation-row table thead th'))
            .map((header) => header.textContent.trim()),
        weeklyVisibleText: document.querySelector('.employee-deviation-row')?.innerText || '',
        possibleLeaveCell: document.querySelector(
            '#resultsTable tr[data-date="2026-06-04"]'
        )?.cells?.[5]?.innerText?.trim() || '',
        confirmedLeaveCell: document.querySelector(
            '#resultsTable tr[data-date="2026-06-05"]'
        )?.cells?.[5]?.innerText?.trim() || '',
        scenarioVisibleText: document.getElementById('scenarioDetailsTestHost')?.innerText || '',
        openWeekRenderedText: window.openWeekRenderedText || '',
        weeklyRowCount: document.querySelectorAll('.employee-deviation-row tbody > tr').length
    }));
}

async function actionableIssueInteraction(page) {
    const summary = page.locator('.actionable-issue-summary');
    await summary.click();
    const expanded = await summary.getAttribute('aria-expanded');
    const panel = page.locator('.actionable-issue-panel');
    const panelText = await panel.innerText();
    await page.locator('.actionable-issue-open-case').click();
    return {
        expanded,
        panelVisible: await panel.isVisible(),
        panelText,
        employeeExpanded: await page.locator(
            '#resultsTable .employee-group-row[data-employee-kodikos="001"]'
        ).getAttribute('aria-expanded'),
        weeklyHighlighted: await page.locator(
            '#resultsTable .employee-deviation-row tbody > tr[data-week-start="2026-06-01"]'
        ).evaluate((row) => row.classList.contains('actionable-issue-target-highlight'))
    };
}

async function canonicalDecisionButtonStyles(page) {
    const button = page.locator('#resultsTable .canonical-decision-open');
    const normal = await button.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, color: style.color };
    });
    await button.hover();
    await page.waitForTimeout(250);
    const hover = await button.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, color: style.color };
    });
    return { text: (await button.innerText()).trim(), normal, hover };
}

async function canonicalDecisionGatingContract(page) {
    return page.evaluate(async () => {
        const renderWith = (state) => {
            currentEmploymentPeriodControl = state;
            renderCurrentReviewRows();
            return document.querySelectorAll('#resultsTable .canonical-decision-open').length;
        };
        const preCalculation = renderWith({
            effective_mode: 'NORMAL', calculation: { authoritative_result: false },
            allowed_actions: { record_decision: true }
        });
        const postCalculation = renderWith({
            effective_mode: 'NORMAL', calculation: { authoritative_result: true },
            allowed_actions: { record_decision: true }
        });
        const stale = renderWith({
            effective_mode: 'HISTORICAL_RECONSTRUCTION_STALE',
            calculation: { authoritative_result: true },
            allowed_actions: { record_decision: true }
        });
        currentEmploymentPeriodControl = {
            effective_mode: 'NORMAL', calculation: { authoritative_result: true },
            allowed_actions: { record_decision: true }
        };
        renderCurrentReviewRows();
        document.querySelector('#resultsTable .employee-group-row')?.click();
        return { preCalculation, postCalculation, stale };
    });
}

async function possibleLeaveModalContract(page) {
    return page.evaluate(async () => {
        let mutationCount = 0;
        window.fetch = async (_url, options = {}) => {
            if (String(options.method || 'GET').toUpperCase() !== 'GET') mutationCount++;
            return { json: async () => ({ results: [] }) };
        };
        window.bootstrap = {
            Modal: class {
                constructor(element) { this.element = element; }
                show() {
                    this.element.classList.add('show');
                    this.element.style.display = 'block';
                }
                static getInstance() { return null; }
            }
        };
        showDetailsModal({
            _id: 'possible-leave-row',
            kodikos: '0005',
            ypokatasthma: '0001',
            eponymo: 'ΚΑΡΝΑΒΑΤΟΠΟΥΛΟΥ',
            onoma: 'ΣΩΤΗΡΙΑ',
            hmeromhnia: '2026-06-04',
            kathgoria_ergasias: 'ΕΡΓ',
            ores_ergasias: 8,
            cards_ores_ergasias: 0,
            noCardsDisplayStatus: 'ΑΔΕΙΑ',
            adeia: false,
            kathgoria_adeias: '',
            ores_apoysias: 0,
            adeia_apologistika: false,
            kathgoria_adeias_apologistika: ''
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
        const modal = document.getElementById('detailsModal');
        const hidden = document.getElementById('edit_kathgoria_adeias_apologistika_hidden');
        return {
            visibleText: modal.innerText,
            categoryOption: document.querySelector(
                '#edit_kathgoria_adeias_apologistika option:checked'
            )?.textContent?.trim() || '',
            leaveChecked: document.getElementById('edit_adeia_apologistika')?.checked,
            persistedValue: hidden?.value,
            derived: hidden?.dataset?.derivedPossibleLeave,
            mutationCount
        };
    });
}

async function geometry(page) {
    return page.evaluate(() => {
        const rect = (selector) => {
            const value = document.querySelector(selector)?.getBoundingClientRect();
            return value ? { top: value.top, bottom: value.bottom, width: value.width, height: value.height } : null;
        };
        const results = document.querySelector('.employment-review-scroll-container');
        const table = document.querySelector('.results-table-wrapper');
        const globalFooter = document.getElementById('globalApplicationFooter').getBoundingClientRect();
        return {
            documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            card: rect('.employment-review-card'),
            lifecycle: rect('#employmentPeriodControlPanel'),
            filters: rect('.review-filters-sticky'),
            pending: rect('#policyPreviewGroupsContainer'),
            results: rect('.employment-review-scroll-container'),
            cardFooter: rect('.employment-review-card > .card-footer'),
            globalFooter: rect('#globalApplicationFooter'),
            usableApplicationBottom: globalFooter.top,
            resultsVerticalScroll: results.scrollHeight > results.clientHeight,
            tableHorizontalScroll: table.scrollWidth > table.clientWidth
        };
    });
}

async function modalGeometry(page) {
    await page.evaluate(() => {
        const popup = document.createElement('div');
        popup.className = 'swal2-popup historical-reconstruction-swal';
        popup.innerHTML = '<div class="swal2-icon">!</div>' +
            '<h2 class="swal2-title">Ανακατασκευή Εκπρόθεσμης Περιόδου</h2>' +
            '<div class="swal2-html-container historical-reconstruction-swal__content"><p>Η περίοδος έχει λήξει. Η ανακατασκευή δεν αλλάζει την εκπρόθεσμη κατάστασή της και καταγράφεται με χρήστη, ημερομηνία και αιτιολογία.</p></div>' +
            '<label>Υποχρεωτική αιτιολογία</label>' +
            '<textarea class="swal2-textarea historical-reconstruction-swal__reason"></textarea>' +
            '<div class="swal2-actions"><button>Ανακατασκευή</button><button>Ακύρωση</button></div>';
        document.body.appendChild(popup);
    });
    return page.evaluate(() => {
        const popup = document.querySelector('.historical-reconstruction-swal');
        const rect = popup.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
            viewportHeight: innerHeight,
            overflow: popup.scrollHeight > popup.clientHeight,
            titleVisible: Boolean(popup.querySelector('.swal2-title')),
            textVisible: Boolean(popup.querySelector('p')),
            textareaVisible: Boolean(popup.querySelector('textarea')),
            buttonsVisible: popup.querySelectorAll('button').length === 2
        };
    });
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const measurements = [];
    try {
        for (const [width, height] of [[1366, 768], [1440, 900], [1648, 900], [1648, 920], [1920, 1080]]) {
            await page.setViewportSize({ width, height });
            await loadOperationalState(page);
            const tableContract = await renderedTableContract(page);
            const expectedHeaders = ['Ημ/νία', 'Παράρτημα', 'Κωδικός', 'Προδηλωμένο',
                'Κάρτες', 'Απολογιστικό', 'Ώρες', 'Απουσίες', 'Νύχτα', 'Αργία',
                'Πρόσθ.', 'Υπερεργ.', 'Υπερωρ.'];
            assert.deepStrictEqual(tableContract.before, expectedHeaders);
            assert.deepStrictEqual(tableContract.after, expectedHeaders);
            assert.strictEqual(tableContract.colCount, 13);
            assert.ok(tableContract.dailyCellCounts.slice(0, 80).every((count) => count === 13));
            assert.strictEqual(tableContract.subtotalLogicalColumns, 13);
            assert.strictEqual(tableContract.after.filter((text) => text === 'Απουσίες').length, 1);
            assert.strictEqual(tableContract.after.filter((text) => text === 'Προδηλωμένο').length, 1);
            assert.ok(tableContract.weeklyHeaders.includes('Τύπος απασχόλησης'));
            assert.ok(!tableContract.weeklyHeaders.includes('Profile'));
            assert.strictEqual(tableContract.weeklyRowCount, 1);
            assert.strictEqual(tableContract.possibleLeaveCell, 'ΠΙΘΑΝΗ ΑΔΕΙΑ');
            assert.strictEqual(tableContract.confirmedLeaveCell, 'ΑΔΕΙΑ');
            assert.ok(!tableContract.openWeekRenderedText.includes('Αναμονή ολοκλήρωσης'));
            assert.ok(!tableContract.openWeekRenderedText.includes(
                'δεν έχει ακόμη ολοκληρωθεί και θα επανελεγχθεί μετά την Κυριακή'
            ));
            [
                'Εκκρεμεί επιβεβαίωση των στοιχείων της κάρτας εργασίας.',
                'Βρέθηκαν περισσότερες από μία πιθανές ημέρες για τη μεταφορά του ρεπό και απαιτείται επιλογή.',
                'Δεν μπορούν να προσδιοριστούν με βεβαιότητα οι ημέρες ανάπαυσης/ρεπό της εβδομάδας και απαιτείται έλεγχος.'
            ].forEach((message) => assert.ok(tableContract.weeklyVisibleText.includes(message)));
            [
                'CARD_VERIFICATION_PENDING',
                'MULTIPLE_TARGET_CANDIDATES',
                'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'
            ].forEach((code) => assert.ok(!tableContract.weeklyVisibleText.includes(code)));
            assert.ok(tableContract.weeklyVisibleText.includes('Απαιτείται έλεγχος της περίπτωσης.'));
            assert.ok(tableContract.weeklyVisibleText.includes('Πραγματική ανθρώπινη σημείωση.'));
            assert.ok(tableContract.scenarioVisibleText.includes(
                'Εκκρεμεί επιβεβαίωση των στοιχείων της κάρτας εργασίας.'
            ));
            assert.ok(tableContract.scenarioVisibleText.includes(
                'Δεν μπορούν να προσδιοριστούν με βεβαιότητα οι ημέρες ανάπαυσης/ρεπό της εβδομάδας και απαιτείται έλεγχος.'
            ));
            assert.ok(tableContract.scenarioVisibleText.includes('Απαιτείται έλεγχος της περίπτωσης.'));
            ['CARD_VERIFICATION_PENDING', 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
                'UNKNOWN_PRIVATE_REASON_CODE']
                .forEach((code) => assert.ok(!tableContract.scenarioVisibleText.includes(code)));
            const issueInteraction = await actionableIssueInteraction(page);
            assert.strictEqual(issueInteraction.expanded, 'true');
            assert.strictEqual(issueInteraction.panelVisible, true);
            ['Γιατί εμφανίζεται αυτή η εκκρεμότητα',
                'Τι προτείνεται να κάνει ο Υπεύθυνος Ανθρώπινου Δυναμικού',
                '001 — ΔΟΚΙΜΗ ΧΡΗΣΤΗΣ', '01/06/2026–07/06/2026',
                'Άνοιγμα στον πίνακα']
                .forEach((text) => assert.ok(issueInteraction.panelText.includes(text), text));
            assert.strictEqual(issueInteraction.employeeExpanded, 'true');
            assert.strictEqual(issueInteraction.weeklyHighlighted, true);
            const decisionGating = await canonicalDecisionGatingContract(page);
            assert.deepStrictEqual(decisionGating, {
                preCalculation: 0,
                postCalculation: 1,
                stale: 0
            });
            const actionButton = await canonicalDecisionButtonStyles(page);
            assert.strictEqual(actionButton.text, 'Καταγραφή απόφασης');
            assert.strictEqual(actionButton.normal.background, 'rgb(207, 226, 255)');
            assert.strictEqual(actionButton.normal.color, 'rgb(8, 66, 152)');
            assert.strictEqual(actionButton.hover.background, 'rgb(13, 110, 253)');
            assert.strictEqual(actionButton.hover.color, 'rgb(255, 255, 255)');
            await page.evaluate(() => window.scrollTo(0, 0));
            const result = await geometry(page);
            measurements.push({ viewport: `${width}x${height}`, ...result });
            assert.ok(result.lifecycle && result.pending && result.cardFooter);
            assert.ok(result.documentOverflow <= 0, `${width}x${height}: page horizontal overflow`);
            assert.ok(result.cardFooter.bottom <= result.usableApplicationBottom + 0.5,
                `${width}x${height}: card footer outside usable application viewport`);
            assert.strictEqual(result.resultsVerticalScroll, true, `${width}x${height}: results must scroll internally`);
            if (width <= 1440) assert.strictEqual(result.tableHorizontalScroll, true,
                `${width}x${height}: table must scroll horizontally inside its wrapper`);
        }

        await page.setViewportSize({ width: 1366, height: 768 });
        await loadOperationalState(page);
        const possibleLeaveModal = await possibleLeaveModalContract(page);
        assert.ok(possibleLeaveModal.visibleText.includes('ΠΙΘΑΝΗ ΑΔΕΙΑ'));
        assert.ok(!possibleLeaveModal.visibleText.includes('POSSIBLE_LEAVE'));
        assert.strictEqual(possibleLeaveModal.categoryOption, 'ΠΙΘΑΝΗ ΑΔΕΙΑ');
        assert.strictEqual(possibleLeaveModal.leaveChecked, false);
        assert.strictEqual(possibleLeaveModal.persistedValue, '');
        assert.strictEqual(possibleLeaveModal.derived, 'true');
        assert.strictEqual(possibleLeaveModal.mutationCount, 0);

        for (const [width, height] of [[1366, 768], [1648, 920], [1920, 1080]]) {
            await page.setViewportSize({ width, height });
            await loadOperationalState(page);
            const modal = await modalGeometry(page);
            measurements.push({ viewport: `${width}x${height}`, modal });
            assert.ok(modal.width <= 620, `${width}x${height}: modal width ${modal.width}`);
            assert.ok(modal.height < modal.viewportHeight);
            assert.strictEqual(modal.overflow, false);
            assert.ok(modal.titleVisible && modal.textVisible && modal.textareaVisible && modal.buttonsVisible);
        }
    } finally {
        await browser.close();
    }
    console.log(`PASS employment review geometry ${JSON.stringify(measurements)}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
