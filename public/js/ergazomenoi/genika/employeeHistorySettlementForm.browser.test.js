'use strict';

const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const { dataFor } = require('../../../../test/fixtures/responsiveForms');
const { forbidRealSettlementMongo } = require('../../../../test/fixtures/forbidRealSettlementMongo');
const { createEmployeeHistoryReconstructionPreviewController: create } = require('../../../../server/controllers/ergazomenoi/employeeHistoryReconstructionPreviewController');
const { planEmployeeHistoryAutomaticSettlement: settle } = require('../../../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
const F = require('../../../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { settlementDecisionFixture } = require('../../../../test/fixtures/employeeHistorySettlementDecisionFixture');
const B = require('../../../../server/services/ergazomenoi/fixtures/businessFactEmployeeHistoryResolutionFixtures');
const root = path.resolve(__dirname, '../../../..');
const artifacts = '/tmp/payroll-phase3h-chromium';
const modal = '#employeeSettlementPreviewModal';
const content = '#employeeSettlementPreviewBody';
const trigger = '#employeeHistoryReconstructionPreviewBtn';
const approve = '#employeeSettlementPreviewApprove';
let browser;
before(async () => {
    forbidRealSettlementMongo(mock);
    fs.mkdirSync(artifacts, { recursive: true });
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); mock.restoreAll(); });

function fixture(kind) {
    const input = kind === 'unique' || kind === 'unsafeUnique'
        ? require('../../../../server/services/ergazomenoi/fixtures/uniqueSafeEmployeeHistoryRepairFixtures').shapeBCorrectedProfileFixture()
        : kind === 'decision' ? settlementDecisionFixture()
        : kind === 'special' ? B.competingDepartureDatesFixture() : F.real0006BoundaryStructure();
    input.scope = { team: 'TEST', company_kod: '700000000000000000000002', kodikos: '0006' };
    Object.assign(input.currentEmployee, input.scope, { _id: '700000000000000000000006',
        onoma: 'ΣΥΝΘΕΤΙΚΟΣ', eponymo: 'ΕΡΓΑΖΟΜΕΝΟΣ', oristikh_enhmerosh: true });
    input.completeHistoryRows.forEach(row => Object.assign(row, input.scope,
        { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 }));
    if (kind === 'unique' || kind === 'unsafeUnique') Object.assign(input.currentEmployee,
        { evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40 });
    if (kind === 'unsafeUnique') [input.currentEmployee, ...input.completeHistoryRows]
        .forEach(row => { delete row.evelikth_proselefsh; });
    input.protectedReferenceSummary = Object.fromEntries(input.completeHistoryRows.map(row => [String(row._id), [{
        collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'synthetic-frozen' }]]));
    if (kind === 'clean') input.completeHistoryRows = settle(input).proposedRows;
    if (kind === 'unknown') input.protectedReferenceSummary = Object.fromEntries(input.completeHistoryRows.map(row =>
        [String(row._id), [{ collection: 'Unknown', documentId: 'synthetic-unknown' }]]));
    return input;
}
const query = value => ({ select() { return this; }, mongooseOptions() { return this; }, lean: async () => value });

async function withForm({ kind = 'automatic', width = 1280, sidebar = false,
    forgedExecution = false, missingAsset = false, failure = null, resolveFailure = false,
    syntheticMarker = false } = {}, work) {
    const input = fixture(kind), before = JSON.stringify(input);
    const deps = {
        companyModel: { findOne: () => query({ _id: input.scope.company_kod }) },
        employeeModel: { findOne: () => query(input.currentEmployee) },
        historyModel: { db: {}, find: () => query(input.completeHistoryRows) },
        referenceChecker: async ({ historyIds }) => input.protectedReferenceSummary[String(historyIds[0])] || [],
        loadCatalogs: async () => ({})
    };
    const controller = create(deps), resolver = create({ ...deps, resolveBusinessDecision: true });
    const locals = { ...dataFor('views/ergazomenoi/ergazomenoi/edit.ejs'),
        ergazomenoiData: input.currentEmployee, rec: input.currentEmployee,
        istorikoData: input.completeHistoryRows, employeeHistoryAccessMode: 'NONE',
        settlementSyntheticHarness: syntheticMarker };
    const html = await ejs.renderFile(path.join(root, 'views/ergazomenoi/ergazomenoi/edit.ejs'), locals);
    const sidebarHtml = await ejs.renderFile(path.join(root, 'views/partials/sidebar.ejs'), locals);
    const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 900 } });
    page.setDefaultTimeout(7000);
    const requests = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
        const request = route.request();
        if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
        if (!/\/history-(reconstruction-preview|automatic-settlement-resolve)/.test(request.url())) return route.abort();
        requests.push({ method: request.method(), url: request.url() });
        assert.ok(request.method() === 'GET' || request.url().includes('/history-automatic-settlement-resolve'),
            'the normal form must never apply a settlement');
        if (failure && (resolveFailure ? request.method() === 'POST' : requests.length === 1)) {
            if (failure === 'network') return route.abort('failed');
            return route.fulfill({ status: failure === 'http' ? 500 : 200, contentType: 'application/json',
                body: failure === 'json' ? 'invalid JSON' : JSON.stringify(failure === 'shape'
                    ? { success: true, preview: {} } : { success: false, message: 'SECRET_INTERNAL' }) });
        }
        const req = { params: { id: input.currentEmployee._id }, query: { presentation: 'settlement' },
            session: { userId: 'synthetic-reader', userTeam: input.scope.team, companyInUse: input.scope.company_kod },
            authenticatedUserTeam: input.scope.team };
        if (request.method() === 'POST') req.body = request.postDataJSON();
        const res = { code: 200, set() { return this; }, status(code) { this.code = code; return this; },
            json(body) { this.body = body; return this; } };
        await (request.method() === 'POST' ? resolver : controller)(req, res);
        if (forgedExecution) Object.assign(res.body, { executionMode: 'SYNTHETIC_ONLY',
            decisionEnabled: true, approvalFingerprint: 'x'.repeat(43) });
        return route.fulfill({ status: res.code, contentType: 'application/json', body: JSON.stringify(res.body) });
    });
    try {
        await page.goto('https://payroll.test/');
        await page.setContent(`<!doctype html><html lang="el"><head><meta charset="utf-8"></head>
            <body data-mode="edit" data-context="ergazomenoi">${sidebarHtml}
            <main class="payroll-form-layout">${html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')}</main></body></html>`);
        for (const file of ['public/css/bootstrap.min.css', 'public/css/main.css'])
            await page.addStyleTag({ path: path.join(root, file) });
        for (const file of ['public/js/bootstrap.bundle.min.js', 'node_modules/sweetalert2/dist/sweetalert2.all.js',
            'public/js/common/sectionsVisible.js', 'public/js/common/formLayout.js',
            ...(!missingAsset ? ['public/js/ergazomenoi/genika/employeeHistoryAutomaticSettlementPreview.js'] : []),
            'public/js/ergazomenoi/genika/employeeHistoryReconstructionPreview.js'])
            await page.addScriptTag({ path: path.join(root, file) });
        const saveSource = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');
        await page.addScriptTag({ content: saveSource.slice(0, saveSource.indexOf("document.addEventListener('DOMContentLoaded'")) });
        await page.evaluate(sidebar => {
            // Release the real form's loading mask with synthetic readiness;
            // no dropdown loaders, application server or database are started.
            const shell = document.querySelector('.employee-edit-page');
            shell.dataset.employeeFormState = 'ready';
            shell.dataset.employeeFormVisible = 'true';
            shell.setAttribute('aria-busy', 'false');
            shell.querySelectorAll('[inert]').forEach(node => { node.inert = false; });
            const loader = shell.querySelector('.employee-form-loading');
            if (loader) loader.remove();
            document.documentElement.style.setProperty('--leftW', sidebar ? '280px' : '0px');
            const nav = document.getElementById('sidebarMenu');
            nav.classList.toggle('d-none', !sidebar);
            nav.style.cssText = 'position:fixed;left:0;top:0;width:280px;height:100vh;overflow:auto';
            document.dispatchEvent(new Event('DOMContentLoaded'));
            window.guidedCalls = 0;
            window.employeeHistoryGuidedResolution = { handleInitialResponse() { window.guidedCalls++; } };
            document.getElementById('employeeHistoryCorrectionStartBtn')?.addEventListener('click', () => window.guidedCalls++);
        }, sidebar);
        try { await work({ page, requests, input }); }
        catch (error) {
            console.log(JSON.stringify({ syntheticDiagnostic: await page.locator(content).textContent(), requests, errors }));
            throw error;
        }
        assert.equal(JSON.stringify(input), before, 'the complete synthetic repository is unchanged');
        assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => window.guidedCalls), 0);
        assert.ok(requests.every(request => request.method === 'GET' && request.url.endsWith('?presentation=settlement') ||
            request.method === 'POST' && request.url.endsWith('/history-automatic-settlement-resolve')));
    } finally { await page.close(); }
}
async function open(page) {
    await page.locator('.menu_Links li[data-tab-caption="Ιστορικό"]').click();
    await page.locator(trigger).click();
    await page.locator(`${content} .employee-settlement-message`).waitFor();
    await page.waitForTimeout(350);
}

for (const width of [1280, 1366, 1600, 1920]) for (const sidebar of [false, true])
test(`complete employee form ${width}px sidebar=${sidebar}: read-only approval, report, Continue and Close`, async () => {
    await withForm({ width, sidebar, forgedExecution: true }, async ({ page, requests }) => {
        await open(page);
        assert.equal(await page.locator(modal).getAttribute('data-execution-mode'), 'PREVIEW_ONLY');
        assert.equal(await page.locator(`${content} input`).count(), 0);
        assert.equal(await page.locator('#employeeHistoryReconstructionPreviewModal').isVisible(), false);
        const geometry = await page.locator(modal).evaluate(node => {
            const box = node.querySelector('.modal-content').getBoundingClientRect();
            const footer = node.querySelector('.modal-footer').getBoundingClientRect();
            return { fits: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
                footerFits: footer.bottom <= innerHeight, scrollsHorizontally: node.scrollWidth > node.clientWidth };
        });
        assert.deepEqual(geometry, { fits: true, footerFits: true, scrollsHorizontally: false });
        await page.screenshot({ path: `${artifacts}/form-${width}-sidebar-${sidebar}.png` });
        await page.locator('#employeeSettlementPreviewDetails').click();
        assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /Προτεινόμενες ενέργειες.*Δεν αποθηκεύτηκε/s);
        await page.locator('#employeeSettlementPreviewBack').click();
        await page.locator(approve).click();
        assert.match(await page.locator(content).innerText(), /μόνο για προεπισκόπηση.*Δεν αποθηκεύτηκε/s);
        assert.doesNotMatch(await page.locator(content).innerText(), /τακτοποιήθηκε επιτυχώς/);
        assert.equal(requests.length, 1, 'forged synthetic response cannot enable POST');
        await page.locator('#employeeSettlementPreviewContinue').click();
        await page.waitForTimeout(350);
        await page.locator(trigger).click();
        await page.locator(`${content} .employee-settlement-message`).waitFor();
        await page.waitForTimeout(350);
        await page.locator(`${modal} .modal-footer [data-bs-dismiss="modal"]`).click();
        await page.waitForTimeout(350);
        assert.equal(await page.locator('.modal-backdrop').count(), 0);
        assert.equal(await page.locator('#employeeHistoryReconstructionApplyBtn').isVisible(), false);
    });
});

for (const kind of ['clean', 'decision', 'unknown', 'special'])
test(`complete form ${kind}: minimal presentation and independent maintenance remain available`, async () => {
    await withForm({ kind, sidebar: true }, async ({ page, requests }) => {
        // Exercise the production Save response handler against the actual current tab caption.
        const handled = await page.evaluate(async () => handleEmployeeSaveHistoryAction({ status: 200, ok: true }, {
            success: false, actionRequired: true, reason: 'EMPLOYEE_HISTORY_MANUAL_REVIEW_REQUIRED',
            nextAction: { type: 'OPEN_EMPLOYEE_HISTORY_TAB' }
        }, { swal: Swal, documentRef: document }));
        assert.equal(handled, true);
        await page.locator(`${content} .employee-settlement-message`).waitFor();
        await page.waitForTimeout(350);
        assert.equal(await page.locator('.menu_Links li[data-tab-caption="Ιστορικό"]').evaluate(node => node.classList.contains('active')), true);
        if (kind === 'clean') {
            assert.match(await page.locator(content).innerText(), /Το Ιστορικό ελέγχθηκε και είναι σωστό/);
            assert.equal(await page.locator(approve).isVisible(), false);
        } else if (kind === 'decision') {
            assert.equal(await page.locator(`${content} input[type=radio]:checked`).count(), 0);
            assert.equal(await page.locator(`${content} input[type=radio]`).count(), 3);
            await page.locator(`${content} input[type=radio]`).first().check();
            await page.locator(approve).click();
            await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewApprove').textContent === 'Έγκριση & Τακτοποίηση');
            await page.locator(approve).click();
            await page.locator('#employeeSettlementPreviewDetails').click();
            assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /Δεν αποθηκεύτηκε καμία αλλαγή/);
        } else {
            assert.match(await page.locator(content).innerText(), /Δεν αποθηκεύτηκε καμία αλλαγή.*1\..*διαχειριστή.*2\..*ΙΣΤ-ΑΥΤ-3Α/s);
            assert.equal(await page.locator(approve).isVisible(), false);
        }
        await page.locator('#employeeSettlementPreviewContinue').click();
        await page.waitForTimeout(350);
        await page.locator('.menu_Links li').first().click();
        assert.equal(await page.locator('.sel_1_section').evaluate(node => node.classList.contains('visible')), true);
        assert.equal(requests.length, kind === 'decision' ? 2 : 1);
    });
});

test('missing simple-preview asset stops safely instead of opening the old guided process', async () => {
    await withForm({ missingAsset: true }, async ({ page, requests }) => {
        await page.locator('.menu_Links li[data-tab-caption="Ιστορικό"]').click();
        await page.locator(trigger).click();
        await page.locator('.swal2-popup').waitFor();
        assert.match(await page.locator('.swal2-html-container').innerText(), /Δεν αποθηκεύτηκε καμία αλλαγή.*1\..*2\..*ΙΣΤ-ΑΥΤ-3Η/s);
        assert.equal(requests.length, 0);
        assert.equal(await page.locator('#employeeHistoryReconstructionPreviewModal').isVisible(), false);
    });
});

for (const failure of ['http', 'json', 'shape', 'network'])
test(`normal form ${failure} failure is technical and a safe retry reloads the preview`, async () => {
    await withForm({ failure, sidebar: true }, async ({ page, requests }) => {
        await open(page);
        const message = await page.locator(content).innerText();
        assert.match(message, /Δεν αποθηκεύτηκε καμία αλλαγή.*1\..*2\..*ΙΣΤ-ΑΥΤ-3Τ/s);
        assert.doesNotMatch(message, /ΙΣΤ-ΑΥΤ-3Α|SECRET_INTERNAL|είναι σωστό/);
        assert.equal(await page.locator(approve).isVisible(), false);
        await page.getByRole('button', { name: 'Επανάληψη ελέγχου', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewBody').textContent.includes('μπορεί να τακτοποιηθεί αυτόματα'));
        assert.equal(requests.length, 2);
        assert.equal(await page.locator(approve).isVisible(), true);
        await page.locator('#employeeSettlementPreviewContinue').click();
        await page.waitForTimeout(350);
        assert.equal(await page.locator('.modal-backdrop').count(), 0);
    });
});
for (const kind of ['unique', 'unsafeUnique']) test(`normal form ${kind} remains read-only with independent verification`, async () => {
    await withForm({ kind, forgedExecution: true }, async ({ page, requests }) => {
        await open(page);
        if (kind === 'unique') {
            await page.locator('#employeeSettlementPreviewDetails').click();
            assert.match(await page.locator('#employeeSettlementPreviewReport').innerText(), /μοναδική ασφαλής πρόταση.*Ισχύοντα στοιχεία/s);
            await page.locator('#employeeSettlementPreviewBack').click();
            await page.locator(approve).click();
            assert.match(await page.locator(content).innerText(), /μόνο για προεπισκόπηση/);
        } else {
            assert.match(await page.locator(content).innerText(), /Βρέθηκε πρόταση.*δεν επιβεβαιώθηκε.*ΙΣΤ-ΑΥΤ-3Α/s);
            assert.equal(await page.locator(approve).isVisible(), false);
        }
        assert.equal(requests.length, 1);
    });
});
test('unique preview cannot acquire an execution capability even in a marked synthetic form', async () => {
    await withForm({ kind: 'unique', forgedExecution: true, syntheticMarker: true }, async ({ page, requests }) => {
        await open(page);
        assert.equal(await page.locator(modal).getAttribute('data-execution-mode'), 'SYNTHETIC_ONLY');
        await page.locator(approve).click();
        assert.match(await page.locator(content).innerText(), /μόνο για προεπισκόπηση/);
        assert.equal(requests.length, 1);
    });
});
test('a failed business-choice preview retains the exact selected choice for retry', async () => {
    await withForm({ kind: 'decision', failure: 'http', resolveFailure: true }, async ({ page, requests }) => {
        await open(page);
        const option = page.locator(`${content} input[type=radio]`).first();
        const choice = await option.inputValue();
        const sent = [];
        page.on('request', request => { if (request.method() === 'POST') sent.push(request.postDataJSON()); });
        await option.check();
        await page.locator(approve).click();
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewBody').textContent.includes('ΙΣΤ-ΑΥΤ-3Τ'));
        await page.getByRole('button', { name: 'Επανάληψη ελέγχου', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#employeeSettlementPreviewBody').textContent.includes('ΙΣΤ-ΑΥΤ-3Τ'));
        await page.waitForTimeout(150);
        assert.equal(requests.length, 3);
        assert.deepEqual(sent, [{ businessDecision: { choiceId: choice } }, { businessDecision: { choiceId: choice } }]);
    });
});
