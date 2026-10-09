'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const { chromium } = require('playwright');
const { planEmployeeHistoryAutomaticReconstruction: plan } = require('../../../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService');
const { buildEmployeeHistoryReconstructionPreview: project } = require('../../../../server/services/ergazomenoi/employeeHistoryReconstructionPreviewService');
const F = require('../../../../server/services/ergazomenoi/fixtures/automaticEmployeeHistoryReconstructionFixtures');
const { buildAutomaticReconstructionPreviewToken } = require('../../../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const root = path.resolve(__dirname, '../../../..');
const dto = input => project({ plan: plan(input), completeHistoryRows: input.completeHistoryRows });
const modal = '#employeeHistoryReconstructionPreviewModal';
const body = '#employeeHistoryReconstructionPreviewBody';
const button = '#employeeHistoryReconstructionPreviewBtn';
async function withPage({ input = F.caseA(), status = 200, payload, viewport = { width: 1440, height: 1000 }, delay = 0,
    manualHandler, applyHandler, stateToken = 'synthetic' } = {}, work) {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport });
        const requests = [], errors = [], allRequests = [];
        page.on('request', request => allRequests.push({ method: request.method(), url: request.url() }));
        page.on('pageerror', error => errors.push(error.message));
        const partial = await ejs.renderFile(path.join(root, 'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section7/istoriko.ejs'), {
            ergazomenoiData: input.currentEmployee, istorikoData: input.completeHistoryRows,
            employeeHistoryAccessMode: 'ADMIN_FULL', employeeHistoryStateToken: stateToken, problematicHistoryIds: []
        });
        await page.route('https://payroll.test/**', async route => {
            const request = route.request();
            if (applyHandler && request.url().endsWith('/history-reconstruction-apply')) {
                const data = request.postDataJSON();
                requests.push({ method: request.method(), path: new URL(request.url()).pathname, data });
                const reply = await applyHandler(data);
                return route.fulfill({ status: reply.status, contentType: reply.contentType || 'application/json', body: reply.rawBody ?? JSON.stringify(reply.body) });
            }
            if (manualHandler && request.url().endsWith('/istoriko/update')) {
                const data = request.postDataJSON();
                requests.push({ method: request.method(), path: new URL(request.url()).pathname, data });
                const reply = await manualHandler(data);
                return route.fulfill({ status: reply.status, contentType: reply.contentType || 'application/json',
                    body: reply.rawBody ?? JSON.stringify(reply.body) });
            }
            if (!request.url().includes('/history-reconstruction-preview')) return route.fulfill({ contentType: 'text/html',
                body: `<!doctype html><html lang="el"><head><meta charset="utf-8"></head><body>${partial}</body></html>` });
            requests.push({ method: request.method(), path: new URL(request.url()).pathname });
            if (delay) await new Promise(resolve => setTimeout(resolve, delay));
            return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload || { success: true, preview: dto(input), previewToken: buildAutomaticReconstructionPreviewToken({ ...input, plan: plan(input) }) }) }).catch(() => {});
        });
        await page.goto('https://payroll.test/');
        for (const file of ['public/css/bootstrap.min.css', 'public/css/main.css', 'node_modules/sweetalert2/dist/sweetalert2.css'])
            await page.addStyleTag({ path: path.join(root, file) });
        for (const file of ['public/js/bootstrap.bundle.min.js', 'node_modules/sweetalert2/dist/sweetalert2.all.js',
            'public/js/ergazomenoi/genika/employeeHistoryReconstructionPreview.js',
            ...(manualHandler ? ['public/js/ergazomenoi/genika/employeeHistoryGuidedResolution.js',
                'public/js/ergazomenoi/genika/istorikoTable.js'] : [])]) await page.addScriptTag({ path: path.join(root, file) });
        assert.equal(await page.evaluate(() => Swal.version), '11.26.25');
        await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
        await work({ page, requests, allRequests });
        assert.deepEqual(errors, []);
        assert.ok(requests.every(request => request.method === 'GET' ||
            applyHandler && request.method === 'POST' && Object.keys(request.data).sort().join(',') === 'approvalAccepted,previewToken' ||
            manualHandler && request.method === 'POST' && request.data.updates.length === 0 && request.data.correction.confirmation === null));
    } finally { await browser.close(); }
}
async function open(page) {
    await page.click(button);
    await page.locator(`${body} .history-preview-summary`).waitFor();
    await page.waitForFunction(selector => document.querySelector(selector).classList.contains('show'), modal);
    await page.waitForTimeout(350);
}

test('real Bootstrap modal is wide, Greek, approval-capable; meaningful changes precede collapsed lazy defaults', async () => {
    await withPage({}, async ({ page, requests }) => {
        await open(page);
        const width = await page.locator(`${modal} .modal-dialog`).evaluate(element => element.getBoundingClientRect().width);
        assert.ok(width > 1300, `modal width ${width}`);
        const text = await page.locator(modal).innerText();
        assert.match(text, /Δεν έχει αποθηκευτεί καμία αλλαγή/);
        assert.match(text, /24\/04\/2026 → 24\/05\/2026/);
        assert.match(text, /25\/05\/2026 → 05\/10\/2026/);
        assert.doesNotMatch(text, /fingerprint|ObjectId|sourceHistoryId|APPLICATION_|hmeromhnia_|SYNTHETIC_/);
        assert.deepEqual(await page.locator(`${modal} .modal-footer button`).allTextContents(), ['Εφαρμογή Τακτοποίησης', 'Κλείσιμο']);
        assert.equal(await page.locator('#employeeHistoryReconstructionApplyBtn').isDisabled(), true);
        assert.equal(await page.locator(`${body} .history-preview-defaults`).getAttribute('open'), null);
        assert.equal(await page.locator(`${body} .history-preview-defaults tr`).count(), 0);
        assert.match(await page.locator(`${body} .history-preview-change-list tbody tr`).first().innerText(), /Ισχύος Όρων/);
        await page.locator('.history-preview-defaults > summary').click();
        const group = page.locator('.history-preview-defaults details').first();
        await group.waitFor();
        assert.match(await group.locator('summary').innerText(), /Εγγραφή 0001 — 43/);
        assert.equal(await group.locator('tr').count(), 0);
        await group.locator('summary').click();
        await page.waitForFunction(() => document.querySelectorAll('.history-preview-defaults tbody tr').length === 43);
        assert.equal(await page.locator('.history-preview-defaults tbody tr').count(), 43);
        assert.equal(requests.length, 1);
    });
});

test('all 105 display fields are reachable in expandable Greek groups; schedule dates explicitly informational', async () => {
    await withPage({}, async ({ page }) => {
        await open(page);
        const original = page.locator('.history-preview-original');
        const row = original.locator(':scope > details').first();
        await row.locator(':scope > summary').click();
        await page.waitForFunction(() => document.querySelectorAll('.history-preview-section details details').length === 6);
        const groups = row.locator('details');
        for (let i = 0; i < 6; i++) {
            await groups.nth(i).locator(':scope > summary').click();
            await groups.nth(i).locator('dl').waitFor();
        }
        assert.equal(await row.locator('dt').count(), 105);
        assert.equal(await row.locator('dt small').count(), 2);
        assert.match(await row.locator('dt small').first().innerText(), /Πληροφοριακό πεδίο.*δεν χρησιμοποιείται/);
        for (const text of await row.locator('dt').allTextContents()) assert.match(text, /[Α-Ωα-ω]/u);
        assert.doesNotMatch(await row.innerText(), /hmeromhnia_|aa_eggrafhs|_id|sourceHistoryId/);
    });
});

test('asymmetric Case B combines the initial rows and renders review assumptions with visible BEFORE/AFTER', async () => {
    await withPage({ input: F.caseBWithProfileEvidence() }, async ({ page }) => {
        await open(page);
        assert.match(await page.locator('.history-preview-periods').innerText(), /23\/04\/2026 → 16\/05\/2026/);
        assert.match(await page.locator('.history-preview-periods').innerText(), /0001, 0002/);
        assert.equal(await page.locator('.history-preview-attention').getAttribute('open'), null);
        await page.locator('.history-preview-attention > summary').click();
        await page.locator('.history-preview-attention li').waitFor();
        assert.match(await page.locator('.history-preview-attention').innerText(), /ΚΠΚ.*Υπάρχουσες τιμές.*0115 \/ 0111.*Πρόταση.*0115.*Πηγή: Εγγραφή 0002/s);
        const conflict = page.locator('.history-preview-change-list tbody tr').filter({ hasText: 'ΚΠΚ' }).filter({ hasText: '0111' });
        assert.match(await conflict.innerText(), /0111.*0115.*Υπόθεση Εφαρμογής.*Χρειάζεται Έλεγχο/s);
    });
});

for (const state of ['NO_OP', 'BLOCKED']) test(`${state} has a normal Greek explanation and safely closes/restores focus`, async () => {
    const input = F.caseA();
    if (state === 'NO_OP') input.completeHistoryRows = plan(input).proposedRows;
    else input.completeHistoryRows[1]._id = input.completeHistoryRows[0]._id;
    await withPage({ input }, async ({ page }) => {
        await open(page);
        assert.match(await page.locator('.history-preview-message').innerText(), state === 'NO_OP'
            ? /Το Ιστορικό είναι ήδη τακτοποιημένο/ : /Δεν είναι δυνατό.*Δεν έχει αποθηκευτεί.*1\..*2\./s);
        assert.doesNotMatch(await page.locator(modal).innerText(), /NO_OP|BLOCKED|INVALID_/);
        assert.equal(await page.locator('#employeeHistoryReconstructionApplyBtn').isVisible(), false);
        assert.equal(await page.locator('#employeeHistoryReconstructionApproval').isVisible(), false);
        await page.locator(`${modal} .modal-footer [data-bs-dismiss="modal"]`).click();
        await page.waitForFunction(selector => !document.querySelector(selector).classList.contains('show'), modal);
        await page.waitForTimeout(350);
        assert.equal(await page.locator(body).innerText(), '');
        assert.equal(await page.locator(button).evaluate(element => element === document.activeElement), true);
        assert.equal(await page.locator('.modal-backdrop').count(), 0);
    });
});

test('server failure never dumps its technical body, and can be closed/retried', async () => {
    await withPage({ status: 500, payload: { stack: 'SECRET_INTERNAL_STACK', _id: '507f1f77bcf86cd799439011' } }, async ({ page, requests }) => {
        await page.click(button);
        await page.locator('.history-preview-message').waitFor();
        assert.match(await page.locator(body).innerText(), /Ο έλεγχος.*δεν ολοκληρώθηκε.*Δεν έχει αποθηκευτεί.*1\..*2\./s);
        assert.doesNotMatch(await page.locator(body).innerText(), /SECRET|507f/);
        await page.waitForTimeout(350);
        await page.locator(`${modal} .modal-footer [data-bs-dismiss="modal"]`).click();
        await page.waitForTimeout(400);
        await page.click(button);
        await page.waitForTimeout(350);
        assert.equal(requests.length, 2);
    });
});

test('closing a pending request aborts it, suppresses stale output and preserves existing correction buttons', async () => {
    await withPage({ delay: 1000 }, async ({ page, requests }) => {
        const corrections = await page.locator('[data-action="review"]').count();
        assert.ok(corrections > 0);
        await page.click(button);
        await page.waitForTimeout(350);
        assert.equal(await page.locator(button).isDisabled(), true);
        await page.locator(`${modal} .modal-footer [data-bs-dismiss="modal"]`).click();
        await page.waitForTimeout(1100);
        assert.equal(await page.locator(body).innerText(), '');
        assert.equal(await page.locator(button).isEnabled(), true);
        assert.equal(await page.locator('[data-action="review"]').count(), corrections);
        assert.equal(requests.length, 1);
    });
});

test('untrusted display strings are escaped rather than executed', async () => {
    const input = F.caseBWithProfileEvidence();
    const payload = { success: true, preview: dto(input) };
    payload.preview.changes[0].before = '<img src=x onerror="window.previewInjected=true">';
    await withPage({ input, payload }, async ({ page }) => {
        await open(page);
        assert.match(await page.locator(body).innerText(), /<img src=x/);
        assert.equal(await page.evaluate(() => window.previewInjected), undefined);
        assert.equal(await page.locator(`${body} img`).count(), 0);
    });
});

for (const count of [1, 3, 20]) test(`${count} rows on mobile stay responsive, scrollable and avoid horizontal overflow`, async () => {
    const input = F.caseA();
    input.completeHistoryRows = Array.from({ length: count }, (_, i) => F.row(String(i).padStart(4, '0'), {
        hmeromhnia_proslhpshs: '2026-04-24', hmeromhnia_isxyos_oron_ergasias_apo: `2026-05-${String(i + 1).padStart(2, '0')}`, ...F.workTerms }));
    await withPage({ input, viewport: { width: 390, height: 844 } }, async ({ page }) => {
        const started = performance.now();
        await open(page);
        assert.ok(performance.now() - started < 5000);
        assert.equal(await page.locator('.history-preview-original').locator(':scope > details').count(), count);
        const dimensions = await page.locator(`${modal} .modal-body`).evaluate(element => ({
            width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight, scrollHeight: element.scrollHeight,
            overflow: getComputedStyle(element).overflowY
        }));
        assert.ok(dimensions.scrollWidth <= dimensions.width + 1, JSON.stringify(dimensions));
        assert.equal(dimensions.overflow, 'auto');
        assert.ok(dimensions.scrollHeight > dimensions.height);
        assert.equal(await page.locator('.history-preview-defaults tr').count(), 0);
    });
});

test('15 attention points are initially collapsed, grouped on expansion, and collapse again', async () => {
    const input = F.caseBWithProfileEvidence();
    const preview = dto(input);
    const point = preview.attention[0];
    preview.attention = Array.from({ length: 15 }, (_, i) => ({ ...point, ...(i === 0 ? { conflict: undefined, field: 'Νόμιμος Μισθός' } : {}), category: i < 10 ? 'Αποδοχές' : 'Ασφάλιση / ΚΠΚ' }));
    preview.summary.assumptions = 15;
    await withPage({ input, payload: { success: true, preview } }, async ({ page }) => {
        await open(page);
        const attention = page.locator('.history-preview-attention');
        assert.match(await attention.innerText(), /15 σημεία χρειάζονται την προσοχή σας.*Προβολή λεπτομερειών/s);
        assert.equal(await attention.getAttribute('open'), null);
        assert.equal(await attention.locator('li').count(), 0);
        assert.ok(await attention.evaluate(e => e.getBoundingClientRect().height < 75));
        const summary = await page.locator('.history-preview-summary').innerText();
        assert.match(summary, /Προτεινόμενες Αλλαγές.*Σημεία προς Έλεγχο.*Προειδοποιήσεις/s);
        assert.doesNotMatch(summary, /Υποθέσεις|Αυτόματες Αλλαγές/);
        await attention.locator('summary').click();
        await attention.locator('li').first().waitFor();
        assert.equal(await attention.locator('li').count(), 15);
        assert.match(await attention.locator('li').first().innerText(), /Νόμιμος Μισθός — Βρέθηκαν διαφορετικές τιμές/);
        assert.deepEqual(await attention.locator('h6').allTextContents(), ['Αποδοχές', 'Ασφάλιση / ΚΠΚ']);
        await attention.locator('summary').click();
        assert.equal(await attention.getAttribute('open'), null);
        assert.equal(await attention.locator('li').first().isVisible(), false);
    });
});

test('zero attention hides the section; proposed periods and changes precede original rows and fallback note', async () => {
    await withPage({}, async ({ page }) => {
        await open(page);
        assert.equal(await page.locator('.history-preview-attention').count(), 0);
        assert.deepEqual(await page.locator('.history-preview-section > h6').allTextContents(),
            ['1. Προτεινόμενες Περίοδοι', '2. Προτεινόμενες Αλλαγές', '3. Υπάρχον Ιστορικό']);
        assert.equal(await page.locator('.history-preview-period-explanation').count(), 0);
        assert.ok(await page.locator('.history-preview-change-list').evaluate(e =>
            !!(e.compareDocumentPosition(document.querySelector('.history-preview-defaults')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    });
    await withPage({ input: F.caseBWithProfileEvidence() }, async ({ page }) => {
        await open(page);
        assert.match(await page.locator('.history-preview-period-explanation').innerText(),
            /Οι εγγραφές 0001 και 0002 φαίνεται να περιγράφουν την ίδια εργασιακή περίοδο και συνδυάστηκαν στην πρόταση/);
        const headings = await page.locator('.history-preview-original > details > summary').allTextContents();
        assert.ok(headings.every(text => text.includes('Ισχύς Όρων Εργασίας:')));
        assert.match(headings[0], /Δεν έχει καταχωριστεί → Χωρίς καταχωρισμένη λήξη/);
        const note = page.locator('.history-preview-message');
        assert.match(await note.innerText(), /Αν συμφωνείτε με την πρόταση.*έγκριση.*έλεγχο της αντίστοιχης εγγραφής/s);
        assert.equal(await note.evaluate(e => e === e.parentElement.lastElementChild && e.classList.contains('small') && !e.classList.contains('alert-warning')), true);
        assert.ok(await page.locator('[data-action="review"]').count() > 0);
    });
});

for (const count of [1, 2, 3]) for (const width of [390, 1440]) test(`${count} periods at ${width}px use full single width, desktop columns or mobile stacking`, async () => {
    const input = F.caseA();
    input.completeHistoryRows = Array.from({ length: count }, (_, i) => F.row(String(i + 1).padStart(4, '0'), {
        hmeromhnia_proslhpshs: '2026-04-24', hmeromhnia_isxyos_oron_ergasias_apo: `2026-05-${String(i + 1).padStart(2, '0')}`, ...F.workTerms }));
    await withPage({ input, viewport: { width, height: 1000 } }, async ({ page }) => {
        await open(page);
        const grid = await page.locator('.history-preview-periods').boundingBox();
        const cards = await page.locator('.history-preview-period').evaluateAll(items => items.map(e => {
            const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width };
        }));
        assert.equal(cards.length, count);
        if (count === 1 || width < 768) assert.ok(cards.every(card => Math.abs(card.width - grid.width) < 2));
        if (count > 1 && width >= 768) {
            assert.equal(cards[0].y, cards[1].y);
            assert.ok(cards[1].x > cards[0].x + cards[0].width);
        }
        if (count > 1 && width < 768) assert.ok(cards[1].y > cards[0].y);
    });
});

test('catalog descriptions and unresolved code fallback are readable in period cards and original fields', async () => {
    const input = F.caseBWithProfileEvidence();
    input.completeHistoryRows.forEach(row => Object.assign(row, { symbash: '0002', kathgoria_symbashs: '0001' }));
    const preview = project({ plan: plan(input), completeHistoryRows: input.completeHistoryRows,
        catalogs: { CONTRACT_TYPE: [{ code: '0002', label: 'Σύμβαση δοκιμής' }], KPK_EFKA: [{ code: '0115', label: 'Ασφάλιση δοκιμής' }, { code: '0111', label: 'Ασφάλιση δοκιμής' }] } });
    await withPage({ input, payload: { success: true, preview } }, async ({ page }) => {
        await open(page);
        const text = await page.locator('.history-preview-periods').innerText();
        assert.match(text, /0002 - Σύμβαση δοκιμής/);
        assert.match(text, /011[15] - Ασφάλιση δοκιμής/);
        const category = page.locator('.history-preview-period').first().locator('dl > div').filter({ hasText: 'Κατηγορία Σύμβασης' });
        assert.equal(await category.locator('dd').innerText(), '0001');
        assert.doesNotMatch(await page.locator(modal).innerText(), /[a-f0-9]{24}|SAME_DATE|APPLICATION_ASSUMPTION|sourceHistoryId|fingerprint/);
    });
});

async function closePreviewThenReview(page) {
    await open(page);
    await page.locator(`${modal} .modal-footer [data-bs-dismiss="modal"]`).click();
    await page.waitForFunction(() => !document.querySelector('.modal-backdrop'));
    await page.locator('[data-action="review"]').first().click();
    await page.locator('.swal2-popup').waitFor();
}

test('preview footer leads through the real manual client and writer to read-only choices and cancellation', async () => {
    const { fixture, store, scope } = require('../../../../test/fixtures/employeeProfileTransactionStore');
    const { token, userModel } = require('../../../../test/fixtures/employeeHistorySupervisor');
    const W = require('../../../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const { profileError } = require('../../../../server/utils/ergazomenoi/employmentProfileMaintenance');
    const f = fixture(), db = store([f]), before = db.state();
    const input = { scope, currentEmployee: f.employee, completeHistoryRows: f.history };
    const manualHandler = async data => {
        const deny = async () => assert.fail('manual entry attempted a database write');
        try {
            await W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, scope, employeeId: data.employeeId,
                operations: data.updates, expectedStateToken: data.expectedStateToken, correction: data.correction,
                actorUserId: 'authenticated', userModel: userModel({ privileges: 'A', team: 'THA', situation: 'A' }),
                correctionCatalogLoader: async () => ({}), employeeModel: { ...db.deps.employeeModel, updateOne: deny } });
            assert.fail('an unconfirmed request cannot save');
        } catch (error) {
            const res = { status(status) { this.statusCode = status; return this; }, json(body) { this.body = body; } };
            profileError(res, error, { resolutionStatusCode: 200 });
            return { status: res.statusCode, body: res.body };
        }
    };
    await withPage({ input, stateToken: token(db), manualHandler }, async ({ page, requests }) => {
        await closePreviewThenReview(page);
        assert.match(await page.locator('.swal2-title').innerText(), /Έλεγχος \/ Διόρθωση Ιστορικού/);
        assert.ok(await page.locator('.swal2-popup input[type="radio"]').count() > 0);
        assert.match(await page.locator('.swal2-popup').getAttribute('class'), /custom-swal-popup employee-history-correction-popup/);
        assert.match(await page.locator('.swal2-cancel').getAttribute('class'), /employee-history-correction-cancel/);
        assert.ok(parseFloat(await page.locator('.swal2-title').evaluate(e => getComputedStyle(e).fontSize)) < 22);
        await page.locator('.swal2-cancel').click();
        await page.waitForFunction(() => !document.querySelector('.swal2-container'));
        assert.deepEqual(requests.map(r => r.method), ['GET', 'POST']);
        assert.equal(requests[1].data.correction.intent, 'REVIEW');
        assert.equal(requests[1].data.correction.confirmation, null);
        assert.equal(await page.locator('[data-action="review"]').first().isEnabled(), true);
    });
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(e => ['fence', 'write', 'commit'].includes(e.type)), false);
});

for (const failure of ['specific', 'legacy-generic', 'non-json']) test(`manual ${failure} failure after preview uses the common styled notice and safe read-only wording`, async () => {
    const message = 'Η επιλεγμένη εγγραφή δεν υπάρχει πλέον στο Ιστορικό. Δεν έχει γίνει καμία αλλαγή. 1. Κλείστε το παράθυρο. 2. Ανοίξτε ξανά τον εργαζόμενο. Κωδικός αναφοράς: EMPLOYEE_HISTORY_CORRECTION_TARGET_MISSING';
    const manualHandler = async () => ({ status: failure === 'specific' ? 409 : 500,
        ...(failure === 'specific' ? { body: { success: false, reason: 'EMPLOYEE_HISTORY_CORRECTION_TARGET_MISSING', message } }
            : failure === 'legacy-generic' ? { body: { success: false, message: 'Σφάλμα κατά την ενημέρωση του Ιστορικού.' } }
            : { contentType: 'text/html', rawBody: '<!doctype html><title>Unavailable</title>' }) });
    await withPage({ manualHandler }, async ({ page, requests }) => {
        await closePreviewThenReview(page);
        const notice = page.locator('.swal2-popup');
        assert.match(await notice.getAttribute('class'), /custom-swal-popup/);
        assert.match(await page.locator('.swal2-title').getAttribute('class'), /custom-title/);
        assert.match(await page.locator('.swal2-confirm').getAttribute('class'), /class-warning custom-confirm-button custom-swal-button/);
        assert.equal(await page.locator('.swal2-cancel').isVisible(), false);
        assert.equal(await page.locator('.swal2-confirm').innerText(), 'Κλείσιμο');
        assert.ok(parseFloat(await page.locator('.swal2-title').evaluate(e => getComputedStyle(e).fontSize)) < 22);
        const text = await page.locator('.swal2-html-container').innerText();
        if (failure === 'specific') assert.equal(text, message);
        else assert.match(text, /έλεγχος.*δεν ολοκληρώθηκε.*Δεν έχει αποθηκευτεί καμία αλλαγή.*1\..*2\..*Κωδικός αναφοράς:/s);
        assert.doesNotMatch(text, /Σφάλμα κατά την ενημέρωση|ελέγξτε αν αποθηκεύτηκε/i);
        assert.deepEqual(requests.map(r => r.method), ['GET', 'POST']);
        await page.locator('.swal2-confirm').click();
    });
});

for (const input of [F.caseA(), F.caseBWithProfileEvidence()]) test(`approval visual state and native input/label/keyboard toggles for ${plan(input).status}; zero POST`, async () => {
    await withPage({ input }, async ({ page, requests, allRequests }) => {
        await open(page);
        await page.waitForFunction(selector => document.querySelector(selector).getAnimations({ subtree: true })
            .every(animation => animation.playState !== 'running'), modal);
        const apply = page.locator('#employeeHistoryReconstructionApplyBtn');
        const checkbox = page.locator('#employeeHistoryReconstructionApprovalAccepted');
        const label = page.locator('label[for="employeeHistoryReconstructionApprovalAccepted"]');
        assert.equal(await label.count(), 1);
        assert.equal(await label.evaluate(e => e.control === document.getElementById(e.htmlFor)), true);
        const style = () => apply.evaluate(e => {
            const s = getComputedStyle(e);
            return { background: s.backgroundColor, opacity: s.opacity, cursor: s.cursor };
        });
        async function assertDisabled() {
            assert.equal(await checkbox.isChecked(), false);
            assert.equal(await apply.isDisabled(), true);
            assert.equal(await apply.evaluate(e => e.matches('.btn-success:disabled')), true);
            await page.waitForFunction(() => getComputedStyle(document.getElementById('employeeHistoryReconstructionApplyBtn')).backgroundColor === 'rgb(108, 117, 125)');
            const s = await style();
            assert.equal(s.background, 'rgb(108, 117, 125)');
            assert.equal(s.opacity, '0.65');
            assert.equal(s.cursor, 'not-allowed');
        }
        async function assertEnabled() {
            assert.equal(await checkbox.isChecked(), true);
            assert.equal(await apply.isEnabled(), true);
            assert.equal(await apply.evaluate(e => e.matches('.btn-success:enabled')), true);
            await page.waitForFunction(() => getComputedStyle(document.getElementById('employeeHistoryReconstructionApplyBtn')).backgroundColor === 'rgb(25, 135, 84)');
            const s = await style();
            assert.equal(s.background, 'rgb(25, 135, 84)');
            assert.equal(s.opacity, '1');
            assert.equal(s.cursor, 'pointer');
        }
        await assertDisabled();
        assert.equal(await page.locator(`${modal} input[type="checkbox"]`).count(), 1);
        // Native disabled buttons ignore pointer and keyboard activation.
        const box = await apply.boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await apply.evaluate(e => e.focus());
        assert.equal(await apply.evaluate(e => document.activeElement === e), false);
        await page.mouse.move(0, 0);
        const layout = await page.locator(`${modal} .modal-content`).boundingBox();
        await checkbox.click(); await assertEnabled();
        await checkbox.click(); await assertDisabled();
        await label.click(); await assertEnabled();
        assert.deepEqual(await page.locator(`${modal} .modal-content`).boundingBox(), layout);
        await label.click(); await assertDisabled();
        await checkbox.focus();
        await page.keyboard.press('Space'); await assertEnabled();
        assert.equal(await checkbox.evaluate(e => document.activeElement === e), true);
        await page.keyboard.press('Space'); await assertDisabled();
        const token = buildAutomaticReconstructionPreviewToken({ ...input, plan: plan(input) });
        assert.ok(!(await page.locator(modal).innerText()).includes(token));
        assert.equal(requests.length, 1);
        assert.equal(allRequests.some(request => request.method === 'POST'), false);
    });
});
for (const failure of ['stale', 'forbidden', 'rejected', 'non-json', 'commit-uncertain']) test(`Apply ${failure}: real compact SweetAlert, zero automatic retry, invalidated approval`, async () => {
    const applyHandler = async () => ({ status: failure === 'stale' ? 409 : failure === 'forbidden' ? 403 : 500,
        ...(failure === 'non-json' ? { contentType: 'text/html', rawBody: '<html>unavailable</html>' }
            : { body: { success: false, code: failure === 'stale' ? 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_STALE' : failure === 'commit-uncertain' ? 'EMPLOYEE_HISTORY_AUTOMATIC_RECONSTRUCTION_COMMIT_UNCERTAIN' : 'PRIVATE_INTERNAL' } }) });
    await withPage({ applyHandler }, async ({ page, requests }) => {
        await open(page);
        await page.locator('#employeeHistoryReconstructionApprovalAccepted').check();
        await page.locator('#employeeHistoryReconstructionApplyBtn').click();
        await page.locator('.swal2-popup').waitFor();
        assert.match(await page.locator('.swal2-popup').getAttribute('class'), /custom-swal-popup/);
        assert.match(await page.locator('.swal2-confirm').getAttribute('class'), /custom-swal-button/);
        assert.equal(requests.filter(r => r.method === 'POST').length, 1);
        assert.deepEqual(Object.keys(requests[1].data).sort(), ['approvalAccepted', 'previewToken']);
        assert.equal(requests[1].data.approvalAccepted, true);
        assert.doesNotMatch(await page.locator('.swal2-popup').innerText(), /PRIVATE_INTERNAL|EMPLOYEE_HISTORY_/);
        if (failure === 'stale') {
            assert.equal(await page.locator('.swal2-title').innerText(), 'Τα στοιχεία άλλαξαν');
            assert.match(await page.locator('.swal2-html-container').innerText(), /δεν αποθηκεύτηκε καμία αλλαγή.*Ανοίξτε ξανά/s);
        }
        if (['non-json', 'commit-uncertain'].includes(failure)) assert.match(await page.locator('.swal2-html-container').innerText(), /δεν μπόρεσε να επιβεβαιώσει αν αποθηκεύτηκε/);
        assert.equal(await page.locator('#employeeHistoryReconstructionApprovalAccepted').isChecked(), false);
        assert.equal(await page.locator('#employeeHistoryReconstructionApplyBtn').isDisabled(), true);
    });
});
test('Apply is single-flight, prevents modal dismissal during request and success reloads persisted History without Employee Save', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const applyHandler = async () => { await pending; return { status: 200, body: { success: true, applied: true, changedRows: 2, changedFields: 97 } }; };
    await withPage({ applyHandler }, async ({ page, requests }) => {
        await open(page);
        await page.locator('#employeeHistoryReconstructionApprovalAccepted').check();
        await page.locator('#employeeHistoryReconstructionApplyBtn').click();
        assert.equal(await page.locator('#employeeHistoryReconstructionApplyBtn').isDisabled(), true);
        const approvalCheckbox = page.locator('#employeeHistoryReconstructionApprovalAccepted');
        assert.equal(await approvalCheckbox.isDisabled(), true);
        await page.locator('label[for="employeeHistoryReconstructionApprovalAccepted"]').click({ force: true });
        assert.equal(await approvalCheckbox.isChecked(), true);
        await page.locator('#employeeHistoryReconstructionApplyBtn').evaluate(e => e.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        await page.keyboard.press('Escape');
        assert.equal(await page.locator(modal).isVisible(), true);
        release();
        await page.locator('.swal2-popup').waitFor();
        assert.equal(await page.locator('.swal2-title').innerText(), 'Το Ιστορικό Τακτοποιήθηκε');
        assert.equal(await page.locator('.swal2-html-container').innerText(), 'Οι εγκεκριμένες αλλαγές αποθηκεύτηκαν επιτυχώς.');
        assert.equal(requests.filter(r => r.method === 'POST').length, 1);
        await Promise.all([page.waitForEvent('load'), page.locator('.swal2-confirm').click()]);
        assert.equal(requests.filter(r => r.method === 'POST').length, 1);
    });
});
