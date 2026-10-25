'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const dateKey = value => new Date(value).toISOString().slice(0, 10);

test('Stage 2 reconciles participation, dated approvals and real conflicts through production HTTP and Chromium', {
    skip: !uri || !vendor, timeout: 180000
}, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T12:00:00Z').getTime() });
    const data = await createStage1CompletionFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    const terms = { kathestos_apasxolhshs: '2', typos_apasxolhshs: '2', typos_ebdomadas: '5ΗΜΕΡΗ',
        hmeres_ergasias_ebdomadas: 2, ores_ergasias_ebdomadas: 16, mo_oron_hmerhsias_ergasias: 8 };
    await data.E.updateOne({ _id: data.employee._id }, { $set: terms });
    await data.H.updateOne({ _id: data.history._id }, { $set: terms });
    for (const row of data.rows) {
        const date = dateKey(row.hmeromhnia);
        const rest = [0, 6].includes(row.hmeromhnia.getUTCDay());
        const possible = ['2026-09-05', '2026-09-06'].includes(date);
        await data.D.collection.updateOne({ _id: row._id }, { $set: {
            kathgoria_ergasias: rest && !possible ? 'ΑΝ' : 'ΕΡΓ', repo: rest && !possible,
            apo_ora_01: rest && !possible ? '' : '09:00', eos_ora_01: rest && !possible ? '' : '17:00',
            ores_ergasias: rest && !possible ? 0 : 8,
            cards_apo_ora_01: rest ? '' : '09:00', cards_eos_ora_01: rest ? '' : '17:00',
            cards_ores_ergasias: rest ? 0 : 8, ores_ergasias_apologistika: rest ? 0 : 8,
            kathgoria_ergasias_apologistika: rest && !possible ? 'ΑΝ' : '', repo_apologistika: false,
            apologistiko_biblio: !rest, kathgoria_adeias_apologistika: possible ? 'POSSIBLE_LEAVE' : '' } });
    }
    const firstScope = { ...data.scope, week_start: '2026-08-31', week_end: '2026-09-06',
        period_start: '2026-09-01', period_end: '2026-09-30' };
    const day = date => data.rows.find(row => dateKey(row.hmeromhnia) === date);
    await data.D.collection.updateOne({ _id: day('2026-09-01')._id }, { $set: {
        repo_apologistika: true, is_locked: true, apologistiko_biblio: false,
        cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0, ores_ergasias_apologistika: 0 } });
    await data.D.collection.updateOne({ _id: day('2026-09-02')._id }, { $set: {
        kathgoria_ergasias: 'ΑΝ', repo: true, kathgoria_ergasias_apologistika: 'ΑΝ',
        apo_ora_01: '', eos_ora_01: '', ores_ergasias: 0, apologistiko_biblio: false,
        cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0, ores_ergasias_apologistika: 0 } });
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const prefix = origin + '/api/prodhlomena-oraria/review';
    const mutations = [];
    mongoose.set('debug', (collection, method) => {
        if (/^(?:insert|update|delete|findOneAnd|bulkWrite|replace|create)/.test(method)) {
            mutations.push(`${collection}.${method}`);
        }
    });
    t.after(() => mongoose.set('debug', false));
    const read = async route => {
        const before = mutations.length;
        const response = await fetch(prefix + route);
        const result = await response.json();
        assert.equal(response.status, 200, JSON.stringify(result));
        assert.equal(mutations.length, before, `read route must never write: ${route}`);
        return result;
    };
    const post = async (route, body, status = 200) => {
        const response = await fetch(prefix + '/weekly-hr-workflow/' + route, { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const result = await response.json();
        assert.equal(response.status, status, JSON.stringify(result));
        return result;
    };
    const query = new URLSearchParams({ ypokatasthma: '0000', kodikos: '0039',
        apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30', limit: '10000' });
    const readWeek = () => read('/weekly-hr-workflow/stage1?' + new URLSearchParams(firstScope));
    const readOnlyBefore = await data.snapshot();
    const initial = await readWeek();
    assert.equal(initial.lifecycle_projection.stages.stage2.blockers.length, 0);
    assert.equal(initial.lifecycle_projection.rest_review_items.find(i => i.date === '2026-09-02').status,
        'VALID_DECLARED_REST');
    await read('?' + query);
    assert.equal(await data.snapshot(), readOnlyBefore, 'search and weekly read cannot write');
    const completed = await post('stage1/bulk-complete', { scopes: [firstScope],
        reason_or_notes: 'Συνθετική έγκριση του τμήματος Σεπτεμβρίου', bulk_request_id: 'stage2-deadlock-stage1' });
    assert.equal(completed.completed_count, 1, JSON.stringify(completed));
    const state = await data.State.findOne({ ...data.base, employee_id: data.employee._id,
        week_start: new Date('2026-08-31') }).lean();
    assert.equal(state.stage1.status, 'OPEN');
    assert.equal(state.stage1.period_slices[0].status, 'COMPLETED');
    await data.Period.updateOne(data.base, { $set: { successful_calculation_version: 1,
        last_successful_calculation_id: 'synthetic-stage2-calculation',
        last_successful_calculation_at: new Date('2026-09-30') } });
    const beforePreview = await data.snapshot();
    const search = await read('?' + query);
    const preview = search.stage2BulkPreview;
    assert.equal(preview.safe_bulk_count, 1, JSON.stringify(preview));
    assert.equal(preview.safe_day_change_count, 2);
    assert.equal(preview.technical_conflict_count, 0);
    assert.equal(preview.manual_exception_count, 0);
    assert.equal(preview.safe_bulk_count + preview.already_resolved_count, preview.total_scopes);
    const detailQuery = new URLSearchParams({ ypokatasthma: '0000', period_start: '2026-09-01',
        period_end: '2026-09-30', preview_fingerprint: preview.preview_fingerprint, details: '1' });
    const details = await read('/weekly-hr-workflow/stage2/bulk-preview?' + detailQuery);
    assert.deepEqual(details.details.map(i => i.date), ['2026-09-05', '2026-09-06']);
    assert.equal(await data.snapshot(), beforePreview);
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const browserContext = await browser.newContext();
    await browserContext.route('**/*', route => new URL(route.request().url()).origin === origin
        ? route.continue() : route.abort());
    const page = await browserContext.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/review');
    await page.waitForFunction(() => document.getElementById('ypokatasthma').tomselect?._preselectDone);
    const load = () => page.evaluate(async () => {
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0039';
        await loadResults();
    });
    await load();
    for (const width of [1280, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => document.getElementById('employmentReviewStage2Collapse').classList.add('show'));
        assert.equal(await page.locator('.weekly-hr-stage2-bulk-complete').isDisabled(), false);
        await page.locator('.weekly-hr-stage2-bulk-complete').click();
        const modal = page.locator('#weeklyHrStage2BulkPreviewModal');
        await modal.waitFor({ state: 'visible' });
        await page.waitForFunction(() => getComputedStyle(document.getElementById(
            'weeklyHrStage2BulkPreviewModal')).opacity === '1');
        assert.match(await modal.innerText(), /05\/09\/2026/);
        assert.match(await modal.innerText(), /06\/09\/2026/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR) {
            fs.mkdirSync(process.env.PAYROLL_VISUAL_ARTIFACT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.PAYROLL_VISUAL_ARTIFACT_DIR,
                `stage2-deadlock-${width}.png`), fullPage: true, animations: 'disabled' });
        }
        await modal.locator('[data-bs-dismiss="modal"]').first().click();
        await modal.waitFor({ state: 'hidden' });
    }
    assert.equal(await data.snapshot(), beforePreview, 'Chromium previews cannot write');
    const command = { ypokatasthma: '0000', period_start: '2026-09-01', period_end: '2026-09-30',
        expected_preview_fingerprint: (await read('?' + query)).stage2BulkPreview.preview_fingerprint,
        reason_or_notes: 'Συνθετική έγκριση κοινής προεπισκόπησης', bulk_request_id: 'stage2-deadlock-approved' };
    data.session.userRole = 'E';
    await post('stage2/bulk-complete', command, 403);
    data.session.userRole = 'HR';
    assert.equal(await data.snapshot(), beforePreview);
    await data.D.collection.updateOne({ _id: day('2026-09-05')._id }, { $set: {
        repo_apologistika: true } });
    const competingChange = await data.snapshot();
    const stale = await post('stage2/bulk-complete', { ...command, bulk_request_id: 'stage2-deadlock-stale' });
    assert.equal(stale.stale, 1, JSON.stringify(stale));
    assert.equal(stale.applied, 0);
    assert.equal(await data.snapshot(), competingChange, 'a changed daily input cannot be overwritten');
    await data.D.collection.updateOne({ _id: day('2026-09-05')._id }, { $set: {
        repo_apologistika: false } });
    // A profile can change after batch preparation but before the first
    // transaction read. The final writer must reload historical terms itself.
    const beforeTermsRace = await data.snapshot();
    const originalStartSession = mongoose.startSession;
    let injected = false;
    const intercepted = t.mock.method(mongoose, 'startSession', async function(...args) {
        if (!injected) {
            injected = true;
            await data.H.updateOne({ _id: data.history._id }, { $set: {
                kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
                hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40 } });
        }
        return originalStartSession.apply(this, args);
    });
    const termsRace = await post('stage2/bulk-complete', { ...command,
        bulk_request_id: 'stage2-deadlock-terms' });
    intercepted.mock.restore();
    assert.equal(injected, true);
    assert.equal(termsRace.applied, 0, JSON.stringify(termsRace));
    assert.equal(termsRace.stale, 1, JSON.stringify(termsRace));
    assert.equal(await data.snapshot(), beforeTermsRace, 'prepared terms must not override historical terms');
    await data.H.updateOne({ _id: data.history._id }, { $set: terms });
    const applied = await post('stage2/bulk-complete', command);
    assert.equal(applied.applied, 1, JSON.stringify(applied));
    assert.equal(applied.failed, 0, JSON.stringify(applied));
    assert.equal(await data.DailyAudit.countDocuments(data.base), 2);
    const settled = await readWeek();
    assert.equal(settled.stage1_status, 'COMPLETED');
    assert.equal(settled.lifecycle_projection.stages.stage2.business_status, 'COMPLETED');
    assert.notEqual(settled.lifecycle_projection.stages.stage3.presentation_status, 'LOCKED');
    const preserved = await data.D.findById(day('2026-09-01')._id).lean();
    assert.equal(preserved.repo_apologistika, true);
    assert.equal(preserved.kathgoria_ergasias_apologistika, '');
    assert.equal(preserved.is_locked, true);
    const afterApply = await data.snapshot();
    const resolved = await read('?' + query);
    assert.equal(resolved.stage2BulkPreview.safe_bulk_count, 0);
    assert.equal(resolved.stage2BulkPreview.technical_conflict_count, 0);
    assert.equal(resolved.stage2BulkPreview.manual_exception_count, 0);
    await load();
    assert.equal(await page.evaluate(() => currentEmploymentReviewLifecyclePresentation.stages.STAGE2.pending_count), 0);
    assert.equal(await data.snapshot(), afterApply, 'settled decisions stay settled on repeated read');
    // A genuine explicit rest/work conflict must remain closed to automatic writes.
    await data.D.collection.updateOne({ _id: day('2026-09-08')._id }, { $set: {
        kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true, apologistiko_biblio: true } });
    const conflictBefore = await data.snapshot();
    const conflicted = await read('?' + query);
    assert.equal(conflicted.stage2BulkPreview.manual_exception_count, 1);
    assert.equal(conflicted.stage2BulkPreview.technical_conflict_count, 0);
    assert.deepEqual(conflicted.stage2BulkPreview.exceptions[0].dates, ['2026-09-08']);
    assert.ok(conflicted.stage2BulkPreview.exceptions[0].diagnostics.some(d =>
        d.code === 'REST_CLASSIFICATION_WORK_CONFLICT'));
    await load();
    assert.equal(await page.evaluate(() => currentEmploymentReviewLifecyclePresentation.stages.STAGE3.enabled), false);
    await page.evaluate(() => document.getElementById('employmentReviewStage2Collapse').classList.add('show'));
    await page.locator('.employment-review-stage2-bulk details').first().evaluate(node => node.open = true);
    const exception = page.locator('.weekly-hr-stage2-exception');
    assert.match(await exception.innerText(), /REST_CLASSIFICATION_REVIEW_REQUIRED/);
    assert.match(await exception.innerText(), /Προβολή 08\/09\/2026/);
    // The conflict keeps Stage 2 locked. Verify its prepared full explanation
    // without exposing the hidden stage or enabling an unavailable action.
    assert.equal(await page.locator('#policyPreviewGroupsContainer').evaluate(node => node.hidden), true);
    const instructions = await exception.locator('template[data-stage2-guidance-details]')
        .evaluate(template => template.content.textContent);
    assert.match(instructions, /Απαιτείται ανθρώπινη απόφαση/);
    assert.match(instructions, /Φόρτωση ιστορικού/);
    for (const width of [1280, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        if (process.env.PAYROLL_VISUAL_ARTIFACT_DIR) await page.screenshot({ path: path.join(
            process.env.PAYROLL_VISUAL_ARTIFACT_DIR, `stage2-conflict-${width}.png`),
            fullPage: true, animations: 'disabled' });
    }
    assert.equal(await data.snapshot(), conflictBefore);
    // The same conflicting row cannot create pending rest outside employment
    // or outside the dated employer's authority.
    await data.E.updateOne({ _id: data.employee._id }, { $set: {
        hmeromhnia_proslhpshs: new Date('2026-09-10'), hmeromhnia_apoxorhshs: new Date('2026-09-28') } });
    await data.H.updateOne({ _id: data.history._id }, { $set: {
        hmeromhnia_proslhpshs: new Date('2026-09-10'), hmeromhnia_apoxorhshs: new Date('2026-09-28'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-09-10'),
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-09-28') } });
    let scopedBefore = await data.snapshot();
    const partial = await read('?' + query);
    assert.ok(partial.canonicalLifecycleProjections.every(payload =>
        payload.lifecycle_projection.employment_date_scope.authoritative_date_set.every(date =>
            date >= '2026-09-10' && date <= '2026-09-28')));
    assert.equal(partial.stage2BulkPreview.manual_exception_count, 0);
    assert.equal(await data.snapshot(), scopedBefore);
    await data.E.updateOne({ _id: data.employee._id }, { $set: {
        afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false,
        hmnia_enarxhs_daneismoy: new Date('2026-09-14'), hmnia_lhxhs_daneismoy: new Date('2026-09-20') } });
    await data.D.collection.updateOne({ _id: day('2026-09-15')._id }, { $set: {
        kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true } });
    scopedBefore = await data.snapshot();
    const loan = await read('?' + query);
    assert.ok(loan.rows.every(row => dateKey(row.hmeromhnia) < '2026-09-14' ||
        dateKey(row.hmeromhnia) > '2026-09-20'));
    assert.equal(loan.stage2BulkPreview.manual_exception_count, 0);
    assert.equal(await data.snapshot(), scopedBefore);
    assert.deepEqual(errors, []);
    assert.equal(mongoose.get('sanitizeFilter'), true);
});
