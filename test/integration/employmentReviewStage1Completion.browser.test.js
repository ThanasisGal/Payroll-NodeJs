'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;

test('Stage 1 completion, pending 12–13 September, approved NON_WORK and fresh searches', {
    skip: !uri || !vendor, timeout: 180000
}, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T12:00:00Z').getTime() });
    const data = await createStage1CompletionFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const prefix = origin + '/api/prodhlomena-oraria/review/weekly-hr-workflow/';
    const request = async (route, body, status = 200) => {
        const response = await fetch(prefix + route, { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const result = await response.json();
        assert.equal(response.status, status, JSON.stringify(result));
        return result;
    };
    const readWeek = async (scope = data.scope) => {
        const response = await fetch(prefix + 'stage1?' + new URLSearchParams(scope));
        const result = await response.json();
        assert.equal(response.status, 200, JSON.stringify(result));
        return result;
    };
    await t.test('search reads persisted rows despite a real history gap without writes', async () => {
        const before = await data.snapshot();
        await data.H.collection.updateOne({ _id: data.history._id }, { $set: {
            hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-09-01') } });
        try {
            const response = await fetch(origin + '/api/prodhlomena-oraria/review?' +
                new URLSearchParams({ apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30',
                    ypokatasthma: '0000', kodikos: '0039' }));
            const result = await response.json();
            // This GET only reads existing rows. It does not call the calculation or a write endpoint.
            assert.equal(response.status, 200, JSON.stringify(result));
            assert.equal(result.success, true);
            assert.ok(result.rows.length > 0);
            assert.ok(result.read_warnings.some(item => item.code === 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'));
            assert.match(result.read_warnings[0].message, /ΙΣΤ-ΚΑΛΥΨΗ-01/);
            assert.equal(await data.snapshot(), before, 'stored-result search must not write');
        } finally {
            await data.H.collection.updateOne({ _id: data.history._id }, { $set: {
                hmeromhnia_isxyos_oron_ergasias_apo: data.history.hmeromhnia_isxyos_oron_ergasias_apo } });
        }
    });
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).origin === origin
        ? route.continue() : route.abort());
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
    page.setDefaultTimeout(15000);
    await page.goto(origin + '/review');
    await page.waitForFunction(() => {
        const branch = document.getElementById('ypokatasthma').tomselect;
        return Boolean(window.EmploymentReviewEmployees && window.EmploymentReviewBranches &&
            branch?._preselectDone && !branch._preselectAbort);
    });
    await page.locator('#ypokatasthma + .ts-wrapper .ts-control').click();
    await page.locator('#ypokatasthma + .ts-wrapper .option[data-value="0000"]').click();
    await page.waitForFunction(() => Boolean(document.getElementById('reviewEmployee').tomselect));
    await page.locator('#reviewEmployee + .ts-wrapper .ts-control').click();
    await page.locator('#reviewEmployee + .ts-wrapper .dropdown-input').fill('0039');
    await page.locator('#reviewEmployee + .ts-wrapper .option[data-value="0039"]').click();
    await page.evaluate(() => {
        const original = loadResults;
        loadResults = (...args) => (window.stage1TestSearch = original(...args));
    });
    const search = async () => {
        const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/prodhlomena-oraria/review');
        await page.locator('#searchBtn').click();
        const searchResponse = await response;
        assert.equal(searchResponse.status(), 200, await searchResponse.text());
        await page.evaluate(async () => {
            await window.stage1TestSearch;
            await loadPreparedWeeklyHrStage1();
            document.getElementById('employmentReviewStage1Collapse').classList.add('show');
        });
    };
    const targetDates = ['2026-09-12', '2026-09-13'];
    const weekRows = () => data.D.find({ ...data.base, kodikos: '0039', hmeromhnia:
        mongoose.trusted({ $in: targetDates.map(date => new Date(date)) }) }).sort({ hmeromhnia: 1 }).lean();
    const beforeSearch = await data.snapshot();
    await search();
    assert.equal(await data.snapshot(), beforeSearch, 'real search is read only');
    const initial = await readWeek();
    assert.deepEqual(initial.lifecycle_projection.stages.stage1.pending_dates, targetDates);
    assert.ok(initial.lifecycle_projection.stage1_no_classification_preview_items.every(item =>
        item.safe && item.classification === 'NON_WORK'));
    for (const date of targetDates) assert.match(await page.locator(`[data-guidance-date="${date}"]`).first().innerText(), /ΠΙΘ\. ΑΔΕΙΑ/);
    await page.locator('[data-guidance-date="2026-09-12"] .weekly-hr-stage1-open-editor').click();
    assert.match(await page.locator('#weeklyHrStage1DayEditor').innerText(), /Θα επιλυθεί ως ΜΗ ΕΡΓΑΣΙΑ/);
    assert.match(await page.locator('#weeklyHrStage1DayEditor').innerText(), /Στάδιο 2/);
    await page.locator('#weeklyHrStage1DayEditor .btn-close').click();
    // A second tab holds the pre-completion view. Its subsequent click must
    // report ALREADY_COMPLETED without inventing a second successful change.
    const stalePage = await context.newPage();
    await stalePage.goto(origin + '/review');
    await stalePage.waitForFunction(() => document.getElementById('ypokatasthma').tomselect?._preselectDone);
    await stalePage.evaluate(async () => {
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0039';
        await loadResults();
        await loadPreparedWeeklyHrStage1();
        document.getElementById('employmentReviewStage1Collapse').classList.add('show');
    });

    await t.test('bulk completion attests review but preserves both possible leaves', async () => {
        const before = JSON.stringify(await weekRows());
        const posted = page.waitForResponse(response => response.url().endsWith('/stage1/bulk-complete'));
        await page.locator('.weekly-hr-stage1-card').filter({ hasText: '07/09–13/09' })
            .locator('.weekly-hr-stage1-select').check();
        await page.locator('.weekly-hr-bulk-complete').click();
        assert.match(await page.locator('.swal2-html-container').innerText(), /εφαρμόζεται χωριστά στο Στάδιο 2/);
        await page.locator('.swal2-confirm').click();
        const result = await (await posted).json();
        assert.equal(result.completed_count, 1);
        await page.waitForFunction(() => document.querySelector('.swal2-html-container')?.textContent.includes('Παραμένουν 2 πιθανές άδειες'));
        const text = await page.locator('.swal2-html-container').innerText();
        assert.match(text, /Αποθηκεύτηκε η επιβεβαίωση/);
        assert.match(text, /Στάδιο 2/);
        assert.equal(await page.locator('.swal2-warning').isVisible(), true);
        await page.locator('.swal2-confirm').click();
        assert.equal(JSON.stringify(await weekRows()), before, 'attestation must not classify or lock daily rows');
        const after = await readWeek();
        assert.equal(after.stage1_status, 'COMPLETED');
        assert.deepEqual(after.lifecycle_projection.stages.stage1.reviewed_possible_leave_dates, targetDates);
        assert.equal(after.lifecycle_projection.stages.stage3.stage2_automatic_resolution_items.length, 2);
        await search();
        for (const date of targetDates) assert.match(await page.locator(`[data-guidance-date="${date}"]`).first().innerText(), /ΠΙΘ\. ΑΔΕΙΑ/);
    });

    await t.test('already completed is reported separately and writes no second attestation', async () => {
        const before = await data.snapshot();
        const result = await request('stage1/bulk-complete', { scopes: [data.scope],
            reason_or_notes: 'Επανάληψη ελέγχου', bulk_request_id: 'stage1-already-september-312' });
        assert.equal(result.completed_count, 0);
        assert.equal(result.already_completed_count, 1);
        const presentation = await page.evaluate(result => renderWeeklyHrStage1BulkResult(result), result);
        assert.match(presentation.text, /Ήδη ολοκληρωμένες εβδομάδες: 1/);
        assert.match(presentation.text, /Δεν αποθηκεύτηκε καμία νέα ολοκλήρωση/);
        assert.match(presentation.text, /Παραμένουν 2 πιθανές άδειες/);
        const posted = stalePage.waitForResponse(response => response.url().endsWith('/stage1/bulk-complete'));
        await stalePage.locator('.weekly-hr-stage1-card').filter({ hasText: '07/09–13/09' })
            .locator('.weekly-hr-stage1-select').check();
        await stalePage.locator('.weekly-hr-bulk-complete').click();
        await stalePage.locator('.swal2-confirm').click();
        assert.equal((await (await posted).json()).already_completed_count, 1);
        await stalePage.waitForFunction(() => document.querySelector('.swal2-html-container')?.textContent.includes('Ήδη ολοκληρωμένες εβδομάδες: 1'));
        assert.match(await stalePage.locator('.swal2-html-container').innerText(), /Δεν αποθηκεύτηκε καμία νέα ολοκλήρωση/);
        assert.match(await stalePage.locator('.swal2-html-container').innerText(), /Παραμένουν 2 πιθανές άδειες/);
        await stalePage.locator('.swal2-confirm').click();
        await stalePage.close();
        assert.equal(await data.snapshot(), before);
    });

    await t.test('NON_WORK is written only by the separately authorized Stage 2 command', async () => {
        const deniedBefore = await data.snapshot();
        data.session.userRole = 'E';
        await request('stage2/complete', { ...data.scope, reason_or_notes: 'Μη εξουσιοδοτημένος',
            request_id: 'stage2-denied-september-312' }, 403);
        data.session.userRole = 'HR';
        assert.equal(await data.snapshot(), deniedBefore);
        const result = await request('stage2/complete', { ...data.scope,
            reason_or_notes: 'Έλεγχος και έγκριση προεπισκόπησης ΜΕ', request_id: 'stage2-approved-september-312' });
        assert.equal(result.materialized_count, 2);
        for (const row of await weekRows()) {
            assert.equal(row.kathgoria_ergasias_apologistika, 'ΜΕ');
            assert.equal(row.kathgoria_adeias_apologistika, '');
            assert.equal(row.adeia_apologistika, false);
            assert.equal(row.apologistiko_biblio, true);
            assert.equal(row.is_locked, true);
        }
        assert.equal(await data.DailyAudit.countDocuments(data.base), 2);
        const settled = await readWeek();
        assert.equal(settled.stage1_status, 'COMPLETED');
        assert.deepEqual(settled.lifecycle_projection.stages.stage1.reviewed_possible_leave_dates, []);
        assert.deepEqual(settled.lifecycle_projection.stages.stage3.stage2_automatic_resolution_items, []);
        const before = await data.snapshot();
        await search();
        await search();
        assert.equal(await data.snapshot(), before);
        for (const date of targetDates) {
            const tile = await page.locator(`.employee-detail-row[data-date="${date}"]`).textContent();
            assert.doesNotMatch(tile, /ΠΙΘ\. ΑΔΕΙΑ/);
            assert.match(tile, /ΜΗ ΕΡΓΑΣΙΑ/);
        }
    });

    await t.test('explicit leave and absence use the existing human classification save', async () => {
        const rows = await data.D.find({ ...data.base, kodikos: '0039', hmeromhnia:
            mongoose.trusted({ $in: [new Date('2026-09-14'), new Date('2026-09-15')] }) }).lean();
        await data.D.collection.updateMany({ _id: { $in: rows.map(row => row._id) } }, { $set: {
            cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
            kathgoria_ergasias_apologistika: '', ores_ergasias_apologistika: 0,
            kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', apologistiko_biblio: false } });
        await search();
        await page.locator('[data-guidance-date="2026-09-14"] .weekly-hr-stage1-open-editor').click();
        await page.locator('#weeklyHrStage1DrawerClassification').selectOption('LEAVE');
        await page.locator('#weeklyHrStage1DrawerLeaveCategory').selectOption('ΑΔΚΑΝ');
        await page.locator('#weeklyHrStage1DayEditor .btn-close').click();
        await page.locator('[data-guidance-date="2026-09-15"] .weekly-hr-stage1-open-editor').click();
        await page.locator('#weeklyHrStage1DrawerClassification').selectOption('ABSENCE');
        await page.locator('#weeklyHrStage1DayEditor .btn-close').click();
        await page.locator('.weekly-hr-save-day-classifications').click();
        await page.locator('.swal2-textarea').fill('Εγκεκριμένοι συνθετικοί χαρακτηρισμοί');
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => document.querySelector('.swal2-title')?.textContent === 'Αποθήκευση χαρακτηρισμών');
        await page.locator('.swal2-confirm').click();
        const saved = await data.D.find({ _id: mongoose.trusted({ $in: rows.map(row => row._id) }) }).sort({ hmeromhnia: 1 }).lean();
        assert.equal(saved[0].adeia_apologistika, true);
        assert.equal(saved[0].kathgoria_adeias_apologistika, 'ΑΔΚΑΝ');
        assert.equal(saved[1].apousia_apologistika, true);
        await search();
        assert.match(await page.locator('[data-guidance-date="2026-09-14"]').first().innerText(), /ΑΔΕΙΑ/);
        assert.match(await page.locator('[data-guidance-date="2026-09-15"]').first().innerText(), /ΑΠΟΥΣΙΑ/);
        for (const date of targetDates) assert.match(
            await page.locator(`[data-guidance-date="${date}"]`).first().innerText(), /ΜΗ ΕΡΓΑΣΙΑ/);
    });

    await t.test('partial completion and a real competing input change preserve independent transactions', async () => {
        const scope = start => ({ ...data.scope, week_start: start,
            week_end: new Date(new Date(start).getTime() + 6 * 86400000).toISOString().slice(0, 10) });
        await data.D.collection.updateOne({ ...data.base, kodikos: '0039', hmeromhnia: new Date('2026-09-21') },
            { $set: { ores_ergasias: -1 } });
        const partial = await request('stage1/bulk-complete', { scopes: [scope('2026-09-14'), scope('2026-09-21')],
            reason_or_notes: 'Συνθετική μερική ολοκλήρωση', bulk_request_id: 'stage1-partial-september-312' });
        assert.equal(partial.completed_count, 1);
        assert.equal(partial.blocked_count, 1);
        await data.D.collection.updateOne({ ...data.base, kodikos: '0039', hmeromhnia: new Date('2026-09-21') },
            { $set: { ores_ergasias: 4 } });
        const originalStartSession = mongoose.startSession;
        mongoose.startSession = async function (...args) {
            const session = await originalStartSession.apply(this, args);
            const originalTransaction = session.withTransaction.bind(session);
            session.withTransaction = async function (...transactionArgs) {
                // Competing writer commits after the command's initial load and
                // before its transactional revalidation. Production checks run unchanged.
                await data.D.collection.updateOne({ ...data.base, kodikos: '0039', hmeromhnia: new Date('2026-09-21') },
                    { $set: { ores_ergasias: 3 } });
                return originalTransaction(...transactionArgs);
            };
            return session;
        };
        let conflict;
        try {
            conflict = await request('stage1/bulk-complete', { scopes: [scope('2026-09-21')],
                reason_or_notes: 'Συνθετική σύγκρουση', bulk_request_id: 'stage1-conflict-september-312' });
        } finally { mongoose.startSession = originalStartSession; }
        assert.equal(conflict.results[0].status, 'STALE_RETRY_REQUIRED');
        assert.equal(conflict.results[0].code, 'STAGE1_INPUT_CHANGED');
        assert.equal(await data.Audit.countDocuments({ ...data.base, week_start: new Date('2026-09-21') }), 0);
        const presentation = await page.evaluate(result => renderWeeklyHrStage1BulkResult(result), conflict);
        assert.match(presentation.text, /Δεν αποθηκεύτηκε καμία νέα ολοκλήρωση/);
        assert.match(presentation.html, /Αναζήτηση/);
        const unavailable = await page.evaluate(result => renderWeeklyHrStage1BulkResult(result,
            { refreshSucceeded: false }), partial);
        assert.match(unavailable.text, /Η νέα κατάσταση των ημερών δεν επιβεβαιώθηκε/);
        assert.ok(unavailable.needsReview > 0);
    });

    await t.test('historical periods and nonselectable leave categories remain protected', async () => {
        const before = await data.snapshot();
        const row = (await weekRows())[0];
        const category = await request('stage1/bulk-classify-days', { ypokatasthma: '0000',
            period_start: '2026-09-01', period_end: '2026-09-30', reason: 'Μη επιτρεπτή άδεια',
            changes: [{ row_id: String(row._id), classification: 'LEAVE', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' }] }, 400);
        assert.equal(category.code, 'POSSIBLE_LEAVE_NOT_HR_SELECTABLE');
        t.mock.timers.setTime(new Date('2026-11-02T12:00:00Z').getTime());
        const historical = await request('stage1/bulk-complete', { scopes: [data.scope],
            reason_or_notes: 'Εκπρόθεσμη ενέργεια χωρίς έγκριση', bulk_request_id: 'stage1-historical-september-312' });
        assert.equal(historical.completed_count, 0);
        assert.equal(historical.results[0].code, 'PERIOD_CONTROL_REVIEW_NOT_AVAILABLE');
        assert.equal(await data.snapshot(), before);
    });
    assert.equal(mongoose.get('sanitizeFilter'), true);
    assert.deepEqual(pageErrors, []);
});
