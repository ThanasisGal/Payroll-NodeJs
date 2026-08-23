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
            hmeromhnia: '2026-06-02', kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
            cards_ores_ergasias: 0, noCardsDisplayStatus: 'ΑΔΕΙΑ', adeia: false,
            kathgoria_adeias: '', ores_apoysias: 0, adeia_apologistika: false,
            kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', effective_is_full_time: true
        }, {
            _id: 'confirmed-leave-row',
            kodikos: '001', ypokatasthma: '0001', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΧΡΗΣΤΗΣ',
            hmeromhnia: '2026-06-08', kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
            cards_apo_ora_01: '12:00', cards_eos_ora_01: '20:00', cards_ores_ergasias: 8,
            noCardsDisplayStatus: '', adeia: true,
            kathgoria_adeias: 'ΚΑΝΟΝΙΚΗ', adeia_apologistika: true,
            kathgoria_adeias_apologistika: 'ΚΑΝΟΝΙΚΗ', leave_provenance: 'HR_DECLARED_LEAVE',
            effective_is_full_time: true
        }, ...[
            ['2026-06-01', '14:12', '22:22', 8.166666666666666, 0.33],
            ['2026-06-05', '14:37', '22:10', 7.55, 0.95],
            ['2026-06-06', '14:37', '22:54', 8.283333333333333, 0.22],
            ['2026-06-07', '14:39', '22:49', 8.166666666666666, 0.33]
        ].map(([date, start, end, cardHours, absenceHours]) => ({
            _id: `atlas-residual-${date}`,
            kodikos: '001', ypokatasthma: '0001', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΧΡΗΣΤΗΣ',
            hmeromhnia: date, kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
            cards_apo_ora_01: start, cards_eos_ora_01: end,
            cards_ores_ergasias: cardHours, ores_apoysias_apologistika: absenceHours,
            adeia: false, kathgoria_adeias: '', adeia_apologistika: false,
            kathgoria_adeias_apologistika: '', effective_is_full_time: true
        })), {
            _id: 'orphan-card-row',
            kodikos: '001', ypokatasthma: '0001', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΧΡΗΣΤΗΣ',
            hmeromhnia: '2026-06-14', kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
            cards_apo_ora_01: '14:51', cards_eos_ora_01: '', cards_ores_ergasias: 0,
            adeia: false, kathgoria_adeias: '', adeia_apologistika: false,
            kathgoria_adeias_apologistika: '', effective_is_full_time: true
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
            canonical_identical_group_key: 'geometry-identical-group',
            canonical_identical_group_count: 2,
            note: 'Πραγματική ανθρώπινη σημείωση με αρκετά μεγάλο περιεχόμενο ώστε να επιβεβαιώνεται ότι το σχόλιο αναδιπλώνεται σε πολλές γραμμές χωρίς να μεγαλώνει ανεξέλεγκτα το συνολικό πλάτος του εβδομαδιαίου πίνακα.'
        }];
        currentReviewDeviations.push(...Array.from({ length: 8 }, (_, index) => ({
            ...currentReviewDeviations[0],
            week_apo: `2026-07-${String(index + 1).padStart(2, '0')}`,
            week_eos: `2026-07-${String(index + 7).padStart(2, '0')}`,
            canonical_identical_group_key: '', canonical_identical_group_count: 1
        })));
        currentPendingDeviationWeeks = [{
            kodikos: '001',
            status: 'OPEN_WEEK_PENDING_COMPLETION',
            week_apo: '2026-06-01',
            week_eos: '2026-06-07'
        }];
        currentLegacyDeviations = [];
        currentReviewLifecycleProjectionReady = true;
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
            }, {
                issue_code: 'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC',
                category: 'HUMAN_REVIEW_REQUIRED', count: 2, employees_count: 1,
                cases: [{ team: 'team-a', company_kod: 'company-a', ypokatasthma: '0001',
                    employee_kodikos: '001', week_start: '2026-06-01', week_end: '2026-06-07' },
                { team: 'team-a', company_kod: 'company-a', ypokatasthma: '0001',
                    employee_kodikos: '001', week_start: '2026-06-01', week_end: '2026-06-07' }]
            }]
        };
        summary.innerHTML = renderActionableIssueGroups(
            currentAtomicRepoTransferProjection.actionable_issue_groups
        );
        bindActionableIssueEvents(summary);
        document.getElementById('employmentReviewStage2Collapse').classList.add('show');
        const stage2Button = document.querySelector(
            '[data-bs-target="#employmentReviewStage2Collapse"]'
        );
        stage2Button.classList.remove('collapsed');
        stage2Button.setAttribute('aria-expanded', 'true');
        document.getElementById('employmentReviewStage4Collapse').classList.add('show');
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
            '#resultsTable tr[data-date="2026-06-02"]'
        )?.cells?.[5]?.innerText?.trim() || '',
        confirmedLeaveCell: document.querySelector(
            '#resultsTable tr[data-date="2026-06-08"]'
        )?.cells?.[5]?.innerText?.trim() || '',
        atlasResidualCells: ['2026-06-01', '2026-06-05', '2026-06-06', '2026-06-07']
            .map((date) => ({
                date,
                text: document.querySelector(`#resultsTable tr[data-date="${date}"]`)
                    ?.cells?.[5]?.innerText?.trim() || ''
            })),
        orphanCardCell: document.querySelector(
            '#resultsTable tr[data-date="2026-06-14"]'
        )?.cells?.[5]?.innerText?.trim() || '',
        scenarioVisibleText: document.getElementById('scenarioDetailsTestHost')?.innerText || '',
        openWeekRenderedText: window.openWeekRenderedText || '',
        weeklyRowCount: document.querySelectorAll('.employee-deviation-row tbody > tr').length
    }));
}

async function actionableIssueInteraction(page) {
    const summary = page.locator('.actionable-issue-summary').first();
    await summary.click();
    const expanded = await summary.getAttribute('aria-expanded');
    const panel = page.locator('.actionable-issue-panel').first();
    const panelText = await panel.innerText();
    const before = await page.evaluate(() => {
        const rect = (selector) => {
            const value = document.querySelector(selector).getBoundingClientRect();
            return { top: value.top, bottom: value.bottom };
        };
        const container = document.querySelector('.employment-review-scroll-container');
        return { filters: rect('.review-filters-sticky'), card: rect('.employment-review-card'),
            container: rect('.employment-review-scroll-container'), pageY: window.scrollY,
            scrollTop: container.scrollTop, scrollLeft: container.scrollLeft };
    });
    await page.locator('.actionable-issue-open-case').first().click();
    const after = await page.evaluate(() => {
        const rect = (selector) => {
            const value = document.querySelector(selector).getBoundingClientRect();
            return { top: value.top, bottom: value.bottom };
        };
        const container = document.querySelector('.employment-review-scroll-container');
        const target = document.querySelector(
            '#resultsTable .employee-deviation-row tbody > tr[data-week-start="2026-06-01"]'
        );
        const targetRect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        return { filters: rect('.review-filters-sticky'), card: rect('.employment-review-card'),
            container: rect('.employment-review-scroll-container'), pageY: window.scrollY,
            scrollTop: container.scrollTop, scrollLeft: container.scrollLeft,
            targetVisible: targetRect.bottom > containerRect.top && targetRect.top < containerRect.bottom };
    });
    return {
        expanded,
        panelVisible: await panel.isVisible(),
        panelText,
        employeeExpanded: await page.locator(
            '#resultsTable .employee-group-row[data-employee-kodikos="001"]'
        ).getAttribute('aria-expanded'),
        weeklyHighlighted: await page.locator(
            '#resultsTable .employee-deviation-row tbody > tr[data-week-start="2026-06-01"]'
        ).evaluate((row) => row.classList.contains('actionable-issue-target-highlight')),
        before,
        after
    };
}

async function groupedCanonicalDecisionButtonStyles(page) {
    const summary = page.locator('.actionable-issue-summary').nth(1);
    if (await summary.getAttribute('aria-expanded') !== 'true') await summary.click();
    const button = page.locator('.canonical-identical-group .canonical-decision-open');
    const read = () => button.evaluate((element) => {
        const style = getComputedStyle(element);
        return { classes: element.className, background: style.backgroundColor,
            border: style.borderColor, color: style.color };
    });
    const normal = await read();
    await button.hover();
    await page.waitForTimeout(250);
    return { normal, hover: await read() };
}

async function weeklyDeviationStickyInteraction(page) {
    return page.evaluate(() => {
        const container = document.querySelector('.employment-review-scroll-container');
        const subtotal = document.querySelector('#resultsTable .employee-subtotal-row:not(.d-none) > td');
        const title = document.querySelector('#resultsTable .weekly-deviation-section-title');
        const header = document.querySelector('#resultsTable .weekly-deviation-table > thead > tr > th');
        const firstHeader = header;
        const firstData = document.querySelector('#resultsTable .weekly-deviation-table > tbody > tr > td');
        const card = document.querySelector('.employment-review-card');
        const filters = document.querySelector('.review-filters-sticky');
        const rect = (element) => {
            const value = element.getBoundingClientRect();
            return { top: value.top, bottom: value.bottom, left: value.left, height: value.height };
        };
        const headerStyle = getComputedStyle(header);
        const headerCells = [...document.querySelectorAll(
            '#resultsTable .weekly-deviation-table > thead > tr > th'
        )];
        const fixed = () => ({ subtotal: rect(subtotal), title: rect(title), header: rect(header),
            card: rect(card), filters: rect(filters), container: rect(container), pageY: window.scrollY,
            scrollTop: container.scrollTop, scrollLeft: container.scrollLeft,
            columnDelta: rect(firstHeader).left - rect(firstData).left });
        const containerTop = container.getBoundingClientRect().top;
        const desiredSubtotalTop = containerTop +
            parseFloat(getComputedStyle(container).getPropertyValue('--employment-review-subtotal-sticky-top'));
        container.scrollTop += subtotal.getBoundingClientRect().top - desiredSubtotalTop + 40;
        const verticalBefore = fixed();
        container.scrollTop += 100;
        const verticalAfter = fixed();
        const horizontalBefore = fixed();
        container.scrollLeft = Math.min(180, container.scrollWidth - container.clientWidth);
        const horizontalAfter = fixed();
        return { verticalBefore, verticalAfter, horizontalBefore, horizontalAfter,
            headerStyle: { position: headerStyle.position, fontSize: headerStyle.fontSize,
                lineHeight: headerStyle.lineHeight, whiteSpace: headerStyle.whiteSpace,
                overflowWrap: headerStyle.overflowWrap, verticalAlign: headerStyle.verticalAlign },
            headerCellsReadable: headerCells.every((cell) =>
                cell.getBoundingClientRect().height >= parseFloat(getComputedStyle(cell).lineHeight) &&
                cell.scrollWidth <= cell.clientWidth + 1),
            headerTexts: headerCells.map((cell) => cell.innerText.trim()) };
    });
}

async function weeklyDeviationColumnWidths(page) {
    return page.evaluate(() => {
        const table = document.querySelector('#resultsTable .weekly-deviation-table');
        const typeCell = table.querySelector(':scope > tbody > tr > td:nth-child(3)');
        const commentCell = table.querySelector(':scope > tbody > tr > .weekly-deviation-comment');
        const commentStyle = getComputedStyle(commentCell);
        const lineHeight = parseFloat(commentStyle.lineHeight) ||
            parseFloat(commentStyle.fontSize) * 1.2;
        return {
            tableClientWidth: table.clientWidth,
            tableScrollWidth: table.scrollWidth,
            typeWidth: typeCell.getBoundingClientRect().width,
            commentWidth: commentCell.getBoundingClientRect().width,
            commentHeight: commentCell.getBoundingClientRect().height,
            commentLineHeight: lineHeight,
            commentWhiteSpace: commentStyle.whiteSpace,
            commentOverflowWrap: commentStyle.overflowWrap,
            commentScrollWidth: commentCell.scrollWidth,
            commentClientWidth: commentCell.clientWidth,
            commentText: commentCell.innerText
        };
    });
}

async function canonicalDecisionButtonStyles(page) {
    const button = page.locator('#resultsTable .canonical-decision-open').first();
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

async function lifecycleDangerButtonStyles(page) {
    const button = page.locator('#lockEmploymentPeriodBtn');
    await button.evaluate((element) => element.classList.remove('d-none'));
    const normal = await button.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
            background: style.backgroundColor,
            border: style.borderColor,
            color: style.color
        };
    });
    await button.hover();
    await page.waitForTimeout(250);
    const hover = await button.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
            background: style.backgroundColor,
            border: style.borderColor,
            color: style.color
        };
    });
    return { normal, hover };
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
            calculation: { authoritative_result: false },
            allowed_actions: { record_decision: false,
                record_stale_canonical_decision: true,
                calculate: false, repo_transfer: false }
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
        popup.className = 'swal2-popup custom-swal-popup employment-review-swal-popup historical-reconstruction-swal';
        popup.innerHTML = '<div class="swal2-icon">!</div>' +
            '<h2 class="swal2-title custom-title">Ανακατασκευή Εκπρόθεσμης Περιόδου</h2>' +
            '<div class="swal2-html-container custom-html-container employment-review-swal-html-container historical-reconstruction-swal__content"><p>Η περίοδος έχει λήξει. Η ανακατασκευή δεν αλλάζει την εκπρόθεσμη κατάστασή της και καταγράφεται με χρήστη, ημερομηνία και αιτιολογία.</p></div>' +
            '<label>Υποχρεωτική αιτιολογία</label>' +
            '<textarea class="swal2-textarea historical-reconstruction-swal__reason"></textarea>' +
            '<div class="swal2-actions"><button class="swal2-confirm class-warning custom-confirm-button custom-swal-button">Ανακατασκευή</button><button class="custom-cancel-button custom-swal-button">Ακύρωση</button></div>';
        document.body.appendChild(popup);
    });
    const confirmButton = page.locator('.historical-reconstruction-swal .swal2-confirm');
    const confirmNormal = await confirmButton.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, border: style.borderColor, color: style.color };
    });
    await confirmButton.hover();
    await page.waitForTimeout(250);
    return page.evaluate((confirmNormalStyle) => {
        const popup = document.querySelector('.historical-reconstruction-swal');
        const textarea = popup.querySelector('textarea');
        const htmlContainer = popup.querySelector('.swal2-html-container');
        const rect = popup.getBoundingClientRect();
        const textareaRect = textarea.getBoundingClientRect();
        const contentRect = htmlContainer.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
            viewportHeight: innerHeight,
            overflow: popup.scrollHeight > popup.clientHeight,
            horizontalOverflow: popup.scrollWidth > popup.clientWidth,
            textareaWidth: textareaRect.width,
            contentWidth: contentRect.width,
            textareaRatio: textareaRect.width / contentRect.width,
            bodyFontSize: getComputedStyle(htmlContainer).fontSize,
            confirmNormal: confirmNormalStyle,
            confirmHover: (() => {
                const style = getComputedStyle(popup.querySelector('.swal2-confirm'));
                return { background: style.backgroundColor, border: style.borderColor, color: style.color };
            })(),
            commonClasses: {
                popup: popup.classList.contains('custom-swal-popup'),
                title: popup.querySelector('.swal2-title').classList.contains('custom-title'),
                html: htmlContainer.classList.contains('custom-html-container'),
                confirm: popup.querySelector('.swal2-actions button').classList.contains('custom-swal-button')
            },
            titleVisible: Boolean(popup.querySelector('.swal2-title')),
            textVisible: Boolean(popup.querySelector('p')),
            textareaVisible: Boolean(textarea),
            buttonsVisible: popup.querySelectorAll('button').length === 2
        };
    }, confirmNormal);
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
            assert.ok(tableContract.weeklyHeaders.includes('Καθεστώς'));
            assert.ok(!tableContract.weeklyHeaders.includes('Profile'));
            assert.strictEqual(tableContract.weeklyRowCount, 9);
            assert.strictEqual(tableContract.possibleLeaveCell, 'ΠΙΘΑΝΗ ΑΔΕΙΑ');
            assert.strictEqual(tableContract.confirmedLeaveCell, 'ΑΔΕΙΑ');
            tableContract.atlasResidualCells.forEach(({ date, text }) =>
                assert.notStrictEqual(text, 'ΑΔΕΙΑ', `${date}: residual absence is not confirmed leave`));
            assert.strictEqual(tableContract.orphanCardCell, 'ΟΡΦΑΝΟ ΧΤΥΠΗΜΑ');
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
            assert.ok(tableContract.weeklyVisibleText.includes('Πραγματική ανθρώπινη σημείωση'));
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
            assert.deepStrictEqual(issueInteraction.after.filters, issueInteraction.before.filters);
            assert.deepStrictEqual(issueInteraction.after.card, issueInteraction.before.card);
            assert.deepStrictEqual(issueInteraction.after.container, issueInteraction.before.container);
            assert.strictEqual(issueInteraction.after.pageY, issueInteraction.before.pageY);
            assert.strictEqual(issueInteraction.after.scrollLeft, issueInteraction.before.scrollLeft);
            assert.strictEqual(issueInteraction.after.targetVisible, true);
            measurements.push({ viewport: `${width}x${height}`, actionableInteraction: issueInteraction });
            const weeklySticky = await weeklyDeviationStickyInteraction(page);
            const closeTo = (left, right, label) => assert.ok(Math.abs(left - right) <= 1,
                `${label}: ${left} != ${right}`);
            closeTo(weeklySticky.verticalBefore.subtotal.top,
                weeklySticky.verticalAfter.subtotal.top, 'subtotal sticky top');
            closeTo(weeklySticky.verticalBefore.title.top,
                weeklySticky.verticalAfter.title.top, 'weekly title sticky top');
            closeTo(weeklySticky.verticalBefore.header.top,
                weeklySticky.verticalAfter.header.top, 'weekly header sticky top');
            assert.deepStrictEqual(weeklySticky.headerStyle, {
                position: 'sticky', fontSize: '11.52px', lineHeight: '13.248px',
                whiteSpace: 'normal', overflowWrap: 'anywhere', verticalAlign: 'middle'
            });
            assert.strictEqual(weeklySticky.headerCellsReadable, true);
            assert.deepStrictEqual(weeklySticky.headerTexts, [
                'Από', 'Έως', 'Καθεστώς', 'Συμβατικές ημέρες εργασίας',
                'Αναμενόμενες ημέρες ανάπαυσης / μη εργασίας',
                'Πραγματικές ημέρες εργασίας',
                'Τελικές ημέρες ανάπαυσης / μη εργασίας',
                '6η ημέρα', '7η ημέρα / παράβαση', 'Σχόλιο'
            ]);
            assert.ok(weeklySticky.verticalAfter.title.top >= weeklySticky.verticalAfter.subtotal.bottom - 1);
            assert.ok(weeklySticky.verticalAfter.header.top >= weeklySticky.verticalAfter.title.bottom - 1);
            assert.strictEqual(weeklySticky.horizontalAfter.pageY, weeklySticky.horizontalBefore.pageY);
            assert.strictEqual(weeklySticky.horizontalAfter.card.left, weeklySticky.horizontalBefore.card.left);
            assert.strictEqual(weeklySticky.horizontalAfter.filters.left, weeklySticky.horizontalBefore.filters.left);
            closeTo(weeklySticky.horizontalBefore.columnDelta,
                weeklySticky.horizontalAfter.columnDelta, 'weekly column alignment');
            assert.ok(weeklySticky.horizontalAfter.scrollLeft > weeklySticky.horizontalBefore.scrollLeft ||
                weeklySticky.horizontalAfter.scrollLeft === 0);
            measurements.push({ viewport: `${width}x${height}`, weeklySticky });
            const weeklyColumns = await weeklyDeviationColumnWidths(page);
            assert.ok(weeklyColumns.typeWidth <= weeklyColumns.tableClientWidth * 0.17);
            assert.ok(weeklyColumns.commentWidth <= weeklyColumns.tableClientWidth * 0.21);
            assert.ok(weeklyColumns.commentHeight > weeklyColumns.commentLineHeight * 2,
                JSON.stringify(weeklyColumns));
            assert.strictEqual(weeklyColumns.commentWhiteSpace, 'normal');
            assert.strictEqual(weeklyColumns.commentOverflowWrap, 'anywhere');
            assert.ok(weeklyColumns.commentScrollWidth <= weeklyColumns.commentClientWidth + 1);
            assert.ok(weeklyColumns.tableScrollWidth <= weeklyColumns.tableClientWidth + 1);
            measurements.push({ viewport: `${width}x${height}`, weeklyColumns });
            const groupedButton = await groupedCanonicalDecisionButtonStyles(page);
            assert.ok(groupedButton.normal.classes.includes('employment-review-action-btn'));
            assert.ok(groupedButton.normal.classes.includes('employment-review-action-primary'));
            assert.deepStrictEqual(groupedButton.normal, {
                classes: 'btn btn-sm canonical-decision-open employment-review-action-btn employment-review-action-primary',
                background: 'rgb(207, 226, 255)', border: 'rgb(158, 197, 254)',
                color: 'rgb(8, 66, 152)'
            });
            assert.deepStrictEqual(groupedButton.hover, {
                classes: 'btn btn-sm canonical-decision-open employment-review-action-btn employment-review-action-primary',
                background: 'rgb(13, 110, 253)', border: 'rgb(13, 110, 253)',
                color: 'rgb(255, 255, 255)'
            });
            const decisionGating = await canonicalDecisionGatingContract(page);
            assert.deepStrictEqual(decisionGating, {
                preCalculation: 0,
                postCalculation: 9,
                stale: 9
            });
            const actionButton = await canonicalDecisionButtonStyles(page);
            assert.strictEqual(actionButton.text, 'Απόφαση για την ομάδα');
            assert.strictEqual(actionButton.normal.background, 'rgb(207, 226, 255)');
            assert.strictEqual(actionButton.normal.color, 'rgb(8, 66, 152)');
            assert.strictEqual(actionButton.hover.background, 'rgb(13, 110, 253)');
            assert.strictEqual(actionButton.hover.color, 'rgb(255, 255, 255)');
            const lifecycleDangerButton = await lifecycleDangerButtonStyles(page);
            assert.deepStrictEqual(lifecycleDangerButton.normal, {
                background: 'rgb(248, 215, 218)',
                border: 'rgb(241, 174, 181)',
                color: 'rgb(132, 32, 41)'
            });
            assert.deepStrictEqual(lifecycleDangerButton.hover, {
                background: 'rgb(220, 53, 69)',
                border: 'rgb(220, 53, 69)',
                color: 'rgb(255, 255, 255)'
            });
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
        assert.strictEqual(possibleLeaveModal.categoryOption, '');
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
            assert.strictEqual(modal.horizontalOverflow, false);
            assert.ok(modal.textareaRatio >= 0.94 && modal.textareaRatio <= 0.96,
                `${width}x${height}: textarea ratio ${modal.textareaRatio}`);
            assert.strictEqual(modal.bodyFontSize, '13.6px');
            assert.deepStrictEqual(modal.confirmNormal, {
                background: 'rgb(255, 243, 205)',
                border: 'rgb(255, 230, 156)',
                color: 'rgb(102, 77, 3)'
            });
            assert.deepStrictEqual(modal.confirmHover, {
                background: 'rgb(255, 193, 7)',
                border: 'rgb(255, 193, 7)',
                color: 'rgb(255, 255, 255)'
            });
            assert.deepStrictEqual(modal.commonClasses, {
                popup: true, title: true, html: true, confirm: true
            });
            assert.ok(modal.titleVisible && modal.textVisible && modal.textareaVisible && modal.buttonsVisible);
        }
    } finally {
        await browser.close();
    }
    console.log(`PASS employment review geometry ${JSON.stringify(measurements)}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
