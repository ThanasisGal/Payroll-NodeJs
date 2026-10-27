'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { buildEmploymentPeriodFrozenSnapshot } = require('../../../../server/services/ergazomenoi/apasxoliseisPeriodFrozenSnapshotService');
const { buildRevisionPreview } = require('../../../../server/services/ergazomenoi/wtoDailySubmissionRevisionService');
const root = path.resolve(__dirname, '../../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js');
const wrapper = source.slice(source.indexOf('const employmentReviewSwalCommonClasses'), source.indexOf('function userCanReviewEdit'));
const scope = { team: 'synthetic', company_kod: 'synthetic-company', ypokatasthma: '0000',
    period_start: '2026-09-01', period_end: '2026-09-30' };
const uiScope = { workspace: 'UNIFIED', apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30', ypokatasthma: '0000' };
function fixture() {
    const daily = (id, date, start, end, start2, end2) => ({ _id: id, kodikos: '001', ypokatasthma: '0000',
        hmeromhnia: date, is_locked: true, apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apo_ora_01_apologistika: start, eos_ora_01_apologistika: end,
        apo_ora_02_apologistika: start2, eos_ora_02_apologistika: end2 });
    const frozen = buildEmploymentPeriodFrozenSnapshot({ scope, dailyResults: [
        daily('row-25', '2026-09-25', '18:00', '18:29', '18:29', '22:00'),
        daily('row-27', '2026-09-27', '18:28', '00:28', '18:28', '00:30')],
    employees: [{ kodikos: '001', afm: '123456789', onoma: 'ΕΛΕΓΧΟΣ', eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', afora_daneismo_ergazomenoy: false }] });
    const document = { _id: '507f1f77bcf86cd799439014', ...scope, frozen_snapshot: frozen.snapshot,
        frozen_snapshot_fingerprint: frozen.frozen_snapshot_fingerprint };
    const control = { status: 'FINALIZED', version: 4, write_fence_version: 0,
        frozen_snapshot_id: document._id, frozen_snapshot_fingerprint: document.frozen_snapshot_fingerprint };
    return { document, control };
}

test('Chromium: full two-day choice and approval at all required sizes, open/closed sidebar; no external requests', { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    const baseline = fixture(); const original = JSON.stringify(baseline.document);
    const session = { userId: 'synthetic-reviewer' };
    let externalRequests = 0; let createRequests = 0; let preview;
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(10000);
        page.on('pageerror', error => { console.error('Browser error:', error.message); });
        await page.route('**/*', route => { externalRequests += 1; return route.abort(); });
        await page.exposeFunction('syntheticRequest', async (url, command) => {
            if (url.endsWith('/current')) return { success: true, revision: null, transmission: null, send_enabled: false };
            assert.match(url, /submission\/revision\/(preview|create)$/);
            if (url.endsWith('/preview')) {
                preview = buildRevisionPreview({ scope, ...baseline, command, session });
                return { success: true, preview };
            }
            assert.equal(command.approve, true); assert.equal(command.reviewed_entire_preview, true);
            assert.equal(command.corrections[0].keep_pair, 2);
            assert.equal(command.corrections[0].confirmed_actual_hours, true);
            assert.equal(command.expected_preview_fingerprint, preview.preview_fingerprint);
            assert.equal(preview.corrections.length, 2);
            createRequests += 1;
            return { success: true, message: 'Η συνθετική έκδοση δημιουργήθηκε. Δεν στάλθηκε υποβολή στο ΕΡΓΑΝΗ.' };
        });
        const css = read('public/css/bootstrap.min.css') + '\n' +
            fs.readFileSync(require.resolve('sweetalert2/dist/sweetalert2.css'), 'utf8') + '\n' + read('public/css/main.css');
        await page.setContent('<!doctype html><html><head><style>' + css + '</style></head><body>' +
            '<aside id="syntheticSidebar" style="width:260px;position:fixed;height:100vh">Πλευρικό μενού</aside>' +
            '<main id="syntheticContent">Έλεγχος Απασχολήσεων</main></body></html>');
        await page.addScriptTag({ path: require.resolve('sweetalert2/dist/sweetalert2.all.js') });
        await page.addScriptTag({ content: wrapper });
        await page.addScriptTag({ content: read('public/js/ergazomenoi/programmata/wtoDailySubmissionRevisionUi.js') });
        await page.evaluate(scope => {
            window.fetch = async (url, options) => ({ ok: true, json: async () => window.syntheticRequest(url, JSON.parse(options.body)) });
            window.revisionFlow = window.WtoDailySubmissionRevisionUi.open({ scope, getScope: () => scope,
                csrfToken: 'synthetic', showDialog: employmentReviewSwal });
        }, uiScope);
        await page.locator('.swal2-textarea').fill('Συνθετική επαλήθευση δύο ημερών');
        await page.locator('.swal2-confirm').click();
        await page.locator('input[name="wto-choice-0"]').first().waitFor();
        assert.equal(createRequests, 0);
        assert.equal(await page.locator('input[name="wto-choice-0"]:checked').count(), 0);
        assert.match(await page.locator('.wto-revision-content').innerText(), /00:28/);
        assert.match(await page.locator('.wto-revision-content').innerText(), /00:30/);
        await page.locator('.swal2-confirm').click();
        await page.locator('.swal2-validation-message').waitFor({ state: 'visible' });
        assert.equal(createRequests, 0);
        await page.locator('.wto-revision-json summary').click();
        const sizes = [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[700,560],[390,640]];
        for (const [width, height] of sizes) for (const sidebar of [false, true]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(open => {
                document.getElementById('syntheticSidebar').hidden = !open;
                document.getElementById('syntheticContent').style.marginLeft = open ? '260px' : '0';
            }, sidebar);
            const geometry = await page.evaluate(() => {
                const popup = document.querySelector('.wto-revision-swal');
                const rect = popup.getBoundingClientRect();
                const actions = popup.querySelector('.swal2-actions').getBoundingClientRect();
                const html = popup.querySelector('.swal2-html-container');
                const table = popup.querySelector('.wto-revision-table-wrap');
                return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
                    actionsBottom: actions.bottom, actionsTop: actions.top,
                    scrollWidth: popup.scrollWidth, clientWidth: popup.clientWidth,
                    htmlOverflow: getComputedStyle(html).overflowY,
                    tableOverflow: getComputedStyle(table).overflowX,
                    fontSize: parseFloat(getComputedStyle(popup.querySelector('td')).fontSize) };
            });
            assert.ok(geometry.left >= -1 && geometry.right <= width + 1, JSON.stringify({ width, height, sidebar, geometry }));
            assert.ok(geometry.top >= -1 && geometry.bottom <= height + 1, JSON.stringify({ width, height, sidebar, geometry }));
            assert.ok(geometry.actionsBottom <= height && geometry.actionsTop >= 0, JSON.stringify({ width, height, sidebar, geometry }));
            assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, JSON.stringify({ width, height, sidebar, geometry }));
            assert.equal(geometry.htmlOverflow, 'auto'); assert.equal(geometry.tableOverflow, 'auto');
            assert.ok(geometry.fontSize >= 13.6);
        }
        await page.locator('input[name="wto-choice-0"][value="2"]').check();
        await page.locator('#wto-hours-confirm-0').check();
        await page.locator('.swal2-confirm').click();
        await page.locator('#wto-revision-approve').waitFor();
        assert.match(await page.locator('.wto-revision-table').innerText(), /18:00 – 22:00/);
        assert.match(await page.locator('.wto-revision-table').innerText(), /18:28 – 00:30/);
        assert.doesNotMatch(await page.locator('.wto-revision-content').innerText(), /fingerprint|request_id|row-25|row-27/);
        await page.locator('.swal2-confirm').click();
        await page.locator('.swal2-validation-message').waitFor({ state: 'visible' });
        assert.equal(createRequests, 0);
        await page.locator('#wto-revision-approve').check();
        await page.locator('.swal2-confirm').click();
        await page.getByText('Δημιουργήθηκε διορθωτική έκδοση', { exact: true }).waitFor();
        assert.equal(createRequests, 1); assert.equal(externalRequests, 0);
        assert.equal(JSON.stringify(baseline.document), original);
        await page.locator('.swal2-confirm').click();
        await page.evaluate(() => window.revisionFlow);
        // The manual review path validates complete pairs and can be cancelled
        // after preview without creating another edition.
        await page.evaluate(scope => {
            window.revisionFlow = window.WtoDailySubmissionRevisionUi.open({ scope, getScope: () => scope,
                csrfToken: 'synthetic', showDialog: employmentReviewSwal });
        }, uiScope);
        await page.locator('.swal2-textarea').fill('Συνθετικός αναλυτικός έλεγχος');
        await page.locator('.swal2-confirm').click();
        await page.locator('.wto-revision-manual summary').first().click();
        await page.locator('input[name="wto-choice-0"][value="manual"]').check();
        await page.locator('#wto-hours-confirm-0').check();
        await page.locator('.swal2-confirm').click();
        await page.locator('.swal2-validation-message').waitFor({ state: 'visible' });
        assert.equal(createRequests, 1);
        await page.locator('#wto-manual-0-0-start').fill('18:28');
        await page.locator('#wto-manual-0-0-end').fill('00:28');
        await page.locator('.swal2-confirm').click();
        await page.locator('#wto-revision-approve').waitFor();
        assert.equal(preview.correction.confirmed_actual_hours, true);
        assert.equal(preview.correction.keep_pair, undefined);
        assert.deepEqual(preview.correction.confirmed_intervals, [{ start: '18:28', end: '00:28' }]);
        await page.locator('.swal2-cancel').click();
        await page.evaluate(() => window.revisionFlow);
        assert.equal(createRequests, 1); assert.equal(externalRequests, 0);
        assert.equal(JSON.stringify(baseline.document), original);

    } finally { await browser.close(); }
});

test('Chromium: approved edition is read separately; release gate, explicit send approval and success protocol', { timeout: 30000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 700, height: 560 } });
        await page.route('**/*', route => route.abort());
        await page.setContent('<!doctype html><html><head></head><body></body></html>');
        await page.addStyleTag({ content: fs.readFileSync(require.resolve('sweetalert2/dist/sweetalert2.css'), 'utf8') + read('public/css/main.css') });
        await page.addScriptTag({ path: require.resolve('sweetalert2/dist/sweetalert2.all.js') });
        await page.addScriptTag({ content: wrapper });
        await page.addScriptTag({ content: read('public/js/ergazomenoi/programmata/wtoDailySubmissionRevisionUi.js') });
        const baseline = fixture();
        const preview = buildRevisionPreview({ scope, ...baseline, session: { userId: 'synthetic-reviewer' },
            command: { reason: 'Συνθετικός έλεγχος', corrections: [{ row_id: 'row-27', date: '2026-09-27',
                keep_pair: 1, confirmed_actual_hours: true, intervals: [{ start: '18:28', end: '00:28' }] }] } });
        await page.evaluate(({ uiScope, preview }) => {
            window.sendCount = 0; window.releaseEnabled = false;
            window.fetch = async (url, options) => {
                if (url.endsWith('/current')) return { ok: true, json: async () => ({ success: true,
                    revision: { ...preview, _id: 'a'.repeat(64) }, transmission: null, send_enabled: window.releaseEnabled }) };
                if (!url.endsWith('/submit')) throw new Error('Unexpected request');
                const command = JSON.parse(options.body);
                if (!command.approve_submission || !command.previous_attempt_not_accepted || !command.boundary_reviewed || !command.previous_attempt_evidence) throw new Error('Missing approval');
                window.sendCount++;
                return { ok: true, json: async () => ({ success: true, message: 'Συνθετική επιτυχία', transmission: { result: { protocol: 'SYNTHETIC-PROTOCOL' } } }) };
            };
            window.openSendReview = () => window.WtoDailySubmissionRevisionUi.open({ scope: uiScope, getScope: () => uiScope,
                csrfToken: 'synthetic', showDialog: employmentReviewSwal });
            window.sendFlow = window.openSendReview();
        }, { uiScope, preview });
        await page.getByText('Η πραγματική αποστολή παραμένει απενεργοποιημένη', { exact: false }).waitFor();
        assert.equal(await page.locator('.swal2-confirm').isVisible(), false);
        await page.locator('.swal2-cancel').click();
        await page.evaluate(async () => { await window.sendFlow; window.releaseEnabled = true; window.sendFlow = window.openSendReview(); });
        await page.locator('#wto-send-evidence').waitFor();
        await page.locator('.swal2-confirm').click();
        await page.locator('.swal2-validation-message').waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => window.sendCount), 0);
        await page.locator('#wto-send-evidence').fill('Συνθετική επιβεβαίωση απόρριψης προηγούμενης απόπειρας');
        await page.locator('#wto-send-previous').check(); await page.locator('#wto-send-review').check();
        await page.locator('.swal2-confirm').click();
        await page.getByText('Η υποβολή καταγράφηκε', { exact: true }).waitFor();
        assert.match(await page.locator('.swal2-html-container').innerText(), /SYNTHETIC-PROTOCOL/);
        assert.equal(await page.evaluate(() => window.sendCount), 1);
        await page.locator('.swal2-confirm').click(); await page.evaluate(() => window.sendFlow);
    } finally { await browser.close(); }
});


test('Chromium: actual status menu and final rejection open exact read-only JSON and existing correction approval', { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    const baseline = fixture();
    const stable = { ...baseline.document.frozen_snapshot.daily_results[0], _id: 'stable-row', hmeromhnia: '2026-09-24',
        apo_ora_01_apologistika: '09:00', eos_ora_01_apologistika: '17:00', apo_ora_02_apologistika: '', eos_ora_02_apologistika: '' };
    baseline.document.frozen_snapshot.daily_results.push(stable);
    const fingerprint = require('../../../../server/services/ergazomenoi/wtoDailySubmissionRevisionService').baselineFingerprint(baseline.document.frozen_snapshot);
    baseline.document.frozen_snapshot_fingerprint = fingerprint; baseline.control.frozen_snapshot_fingerprint = fingerprint;
    const original = JSON.stringify(baseline);
    const first = buildRevisionPreview({ scope, ...baseline, command: { reason: 'Έλεγχος', corrections: [] }, session: { userId: 'synthetic-reviewer' } });
    const sourceSubmission = { _id: '507f1f77bcf86cd799439099', team: scope.team, companykod_object: scope.company_kod,
        ypokatasthma_kodikos: scope.ypokatasthma, employment_period_start: scope.period_start, employment_period_end: scope.period_end,
        submission_code: 'WTODailyA', submission_status: 'FAILED', reconciliation_required: false,
        environment: process.env.ERGANI_ENV || 'trial', request_payload: structuredClone(first.before_payload) };
    sourceSubmission.request_payload.WTOS.WTO[0].f_comments = 'Αρχικό σχόλιο υποβολής';
    sourceSubmission.payload_fingerprint = require('../../../../server/services/ergazomenoi/wtoDailyRestIdentityService').buildWtoDailyPayloadFingerprint({
        team: scope.team, company: scope.company_kod, branch: scope.ypokatasthma, periodStart: scope.period_start, periodEnd: scope.period_end,
        payload: sourceSubmission.request_payload });
    let creates = 0, sends = 0, outbound = 0;
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        page.setDefaultTimeout(10000);
        await page.route('**/*', route => { outbound++; return route.abort(); });
        await page.exposeFunction('mockRequest', async (url, command) => {
            if (url.endsWith('/final')) return { success: false, submission_outcome: 'REJECTED', source_submission_id: sourceSubmission._id,
                rejected_payload: sourceSubmission.request_payload, message: 'Απόρριψη συνθετικού ΕΡΓΑΝΗ' };
            if (url.endsWith('/current')) return { success: true, revision: null };
            if (url.endsWith('/preview')) return { success: true, preview: buildRevisionPreview({ scope, ...baseline, command,
                session: { userId: 'synthetic-reviewer' }, sourceSubmission }) };
            if (url.endsWith('/create')) { creates++; assert.equal(command.approve, true); assert.equal(command.reviewed_entire_preview, true);
                return { success: true, message: 'Συνθετική αποθήκευση μόνο' }; }
            sends++; throw new Error('Forbidden send');
        });
        const render = source.slice(source.indexOf('function syncEmploymentPeriodActionsVisibility'), source.indexOf('async function runHistoricalReconstruction'));
        const ids = [...new Set([...render.matchAll(/getElementById\('([^']+)'\)/g)].map(match => match[1]))];
        await page.setContent('<html><head></head><body>' + ids.map(id => `<div id="${id}" class="d-none"></div>`).join('') + '</body></html>');
        await page.addStyleTag({ content: fs.readFileSync(require.resolve('sweetalert2/dist/sweetalert2.css'), 'utf8') + read('public/css/main.css') });
        await page.addScriptTag({ path: require.resolve('sweetalert2/dist/sweetalert2.all.js') });
        await page.addScriptTag({ content: wrapper });
        await page.addScriptTag({ content: 'var currentEmploymentPeriodControl; const employmentPeriodModeLabels={},employmentSubmissionTimelinessLabels={}; function formatPolicyPreviewDate(){return "";} function userCanReviewEdit(){return true;}' + render });
        await page.evaluate(() => { const button = document.getElementById('createWtoDailyRevisionBtn'); button.setAttribute('data-employment-period-action', '');
            document.getElementById('employmentPeriodControlActions').append(button); renderEmploymentPeriodControl({ status: 'FINALIZED', effective_mode: 'FINALIZED', allowed_actions: {} }); });
        assert.equal(await page.locator('#createWtoDailyRevisionBtn').evaluate(el => el.classList.contains('d-none')), false);
        assert.equal(await page.locator('#employmentPeriodControlActions').evaluate(el => el.classList.contains('d-none')), false);
        await page.addScriptTag({ content: read('public/js/ergazomenoi/programmata/wtoDailySubmissionRevisionUi.js') });
        const final = source.slice(source.indexOf('async function submitFinalWTODayilyA()'), source.indexOf('async function loadEmploymentPeriodControl'));
        await page.addScriptTag({ content: 'const csrfToken="synthetic"; const escapeHtml = value => String(value); function currentCorrectiveBranch(){return "0000";} function getActiveEmploymentReviewScope(){return {ypokatasthma:"0000"};}' + final });
        await page.evaluate(() => { window.fetch = async (url, opts) => { const result = await window.mockRequest(url, JSON.parse(opts.body)); return { ok: result.success, json: async () => result }; }; window.finalFlow = submitFinalWTODayilyA(); });
        await page.locator('.swal2-confirm').click();
        await page.getByRole('button', { name: 'Προβολή JSON και διόρθωση διαστημάτων' }).click();
        await page.locator('.wto-revision-json summary').click();
        assert.deepEqual(JSON.parse(await page.locator('.wto-revision-json pre').innerText()), sourceSubmission.request_payload);
        assert.equal(await page.locator('.wto-revision-json pre').getAttribute('contenteditable'), null);
        await page.getByRole('button', { name: 'Συνέχεια στον έλεγχο' }).click();
        await page.locator('.swal2-textarea').fill('Διόρθωση μόνο ωρών');
        await page.locator('.swal2-confirm').click();
        await page.locator('input[name="wto-choice-0"]').first().waitFor();
        assert.equal(await page.locator('input[name="wto-choice-0"]:checked').count(), 0);
        await page.locator('input[name="wto-choice-0"][value="2"]').check();
        await page.locator('#wto-hours-confirm-0').check();
        await page.locator('.swal2-confirm').click();
        await page.locator('#wto-revision-approve').waitFor();
        const corrected = JSON.parse(await page.locator('.wto-revision-json pre').textContent());
        assert.equal(corrected.WTOS.WTO[0].f_comments, 'Αρχικό σχόλιο υποβολής');
        const analytics = corrected.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO;
        assert.deepEqual(analytics.find(row => row.f_date === '25/09/2026').ErgazomenosAnalytics.ErgazomenosWTOAnalytics,
            [{ f_type: 'ΕΡΓ', f_from: '18:00', f_to: '22:00' }]);
        assert.deepEqual(analytics.find(row => row.f_date === '24/09/2026'),
            sourceSubmission.request_payload.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO.find(row => row.f_date === '24/09/2026'));
        assert.equal(creates + sends, 0);
        await page.locator('#wto-revision-approve').check();
        await page.locator('.swal2-confirm').click();
        await page.getByText('Συνθετική αποθήκευση μόνο', { exact: true }).waitFor();
        assert.equal(creates, 1); assert.equal(sends + outbound, 0); assert.equal(JSON.stringify(baseline), original);
    } finally { await browser.close(); }
});
