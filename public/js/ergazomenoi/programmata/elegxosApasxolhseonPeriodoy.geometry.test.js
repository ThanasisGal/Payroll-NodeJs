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
    await page.evaluate(() => {
        document.getElementById('employmentPeriodControlPanel').classList.remove('d-none');
        document.getElementById('employmentPeriodControlStatus').textContent =
            'ΕΚΠΡΟΘΕΣΜΗ — ΧΩΡΙΣ ΟΡΙΣΤΙΚΟΠΟΙΗΜΕΝΟ ΑΠΟΤΕΛΕΣΜΑ';
        document.getElementById('employmentPeriodControlDeadline').textContent = '31/07/2026';
        document.getElementById('historicalReconstructionBtn').classList.remove('d-none');
        const summary = document.getElementById('policyPreviewGroupsContainer');
        summary.innerHTML = '<div class="employment-review-pending-summary"><strong>4 μεταφορές ρεπό προς απόφαση</strong></div>';
        const body = document.querySelector('#resultsTable tbody');
        body.innerHTML = Array.from({ length: 80 }, (_, index) => `<tr>${Array.from(
            { length: 13 },
            (_unused, cell) => `<td>${cell === 0 ? `0${(index % 9) + 1}/06/2026` : `Στοιχείο ${index + 1}-${cell + 1}`}</td>`
        ).join('')}</tr>`).join('');
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
