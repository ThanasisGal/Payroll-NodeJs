'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const { calculateHistoricalFingerprints } = require('../../server/services/ergazomenoi/apasxoliseisHistoricalPeriodReconstructionService');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const period = { period_start: '2026-09-01', period_end: '2026-09-30' };

async function setup(t) {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-12T12:00:00Z') });
    const data = await createStage1CompletionFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    data.session.appDate = '2026-11-12';
    const terms = { kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
    await data.E.collection.updateOne({ _id: data.employee._id }, { $set: terms });
    await data.H.collection.updateOne({ _id: data.history._id }, { $set: terms });
    await data.H.collection.insertOne({ ...data.history, ...terms, _id: new mongoose.Types.ObjectId() });
    for (const row of data.rows) {
        const rest = [0, 6].includes(row.hmeromhnia.getUTCDay());
        await data.D.collection.updateOne({ _id: row._id }, { $set: {
            kathgoria_ergasias: rest ? 'ΑΝ' : 'ΕΡΓ', repo: rest,
            kathgoria_ergasias_apologistika: rest ? 'ΑΝ' : 'ΑΣΘΕΝΕΙΑ', repo_apologistika: rest,
            adeia: !rest, kathgoria_adeias: rest ? '' : 'SYNTHETIC-MATERNITY',
            astheneia_apologistika: !rest, adeia_apologistika: false, kathgoria_adeias_apologistika: '',
            apousia_apologistika: false, ores_ergasias: rest ? 0 : 8,
            apo_ora_01: rest ? '' : '08:00', eos_ora_01: rest ? '' : '16:00',
            cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
            ores_ergasias_apologistika: 0, ores_pragmatikhs_ergasias_apologistika: 0,
            apologistiko_biblio: false } });
    }
    // Only synthetic fixture rows, in the guarded disposable localhost database.
    await data.D.collection.deleteMany({ ...data.base, hmeromhnia: { $gte: new Date('2026-10-01') } });
    const periodScope = { ...data.base, period_start: new Date(period.period_start), period_end: new Date(period.period_end) };
    const fp = await calculateHistoricalFingerprints({ scope: periodScope });
    await data.Period.create({ ...periodScope, deadline: new Date('2026-10-31'), status: 'OPEN',
        historical_reconstruction_status: 'COMPLETED', historical_reconstruction_version: 1,
        historical_source_fingerprint: fp.source_fingerprint, historical_dependency_fingerprint: fp.dependency_fingerprint,
        historical_holiday_dependency_fingerprint: fp.holiday_dependency_fingerprint,
        historical_result_fingerprint: fp.result_fingerprint, historical_reconstruction_completed_at: new Date('2026-11-11') });
    const scopes = ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'].map((start, i) => ({
        ...data.scope, week_start: start, week_end: new Date(Date.parse(start) + 6 * 86400000).toISOString().slice(0, 10),
        ...([0, 4].includes(i) ? period : {}) }));
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = async (path, body) => {
        const response = await fetch(origin + '/api/prodhlomena-oraria/review' + path, body ? {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
        return { status: response.status, body: await response.json() };
    };
    const completed = await request('/weekly-hr-workflow/stage1/bulk-complete', {
        scopes, bulk_request_id: 'legacy-stage2-five-weeks', reason_or_notes: 'Έλεγχος συνθετικών ημερήσιων χαρακτηρισμών' });
    assert.equal(completed.body.completed_count, 5, JSON.stringify(completed.body));
    const search = async () => {
        const result = await request('?' + new URLSearchParams({ ypokatasthma: '0000', kodikos: '0039',
            apo_hmeromhnia: period.period_start, eos_hmeromhnia: period.period_end, limit: '10000' }));
        assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body;
    };
    const snapshot = async () => {
        const names = (await mongoose.connection.db.listCollections().toArray()).map(c => c.name).sort();
        return JSON.stringify(Object.fromEntries(await Promise.all(names.map(async name =>
            [name, await mongoose.connection.db.collection(name).find({}).sort({ _id: 1 }).toArray()]))));
    };
    return { ...data, origin, scopes, request, search, snapshot, periodScope };
}

test('HTTP: five reconstructed legacy weeks have no artificial Stage 2/3 tasks; boundary attestations remain intact', {
    skip: !uri || !vendor
}, async t => {
    const data = await setup(t);
    await data.Period.collection.insertOne({ ...data.base, period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'), status: 'FINALIZED', version: 3,
        frozen_snapshot_id: new mongoose.Types.ObjectId(), frozen_snapshot_fingerprint: 'b'.repeat(64) });
    const before = await data.snapshot();
    const result = await data.search();
    assert.equal(result.stage2BulkPreview.manual_exception_count, 0, JSON.stringify(result.stage2BulkPreview));
    assert.equal(result.stage2BulkPreview.pending_scope_count, 0);
    assert.equal(result.stage2BulkPreview.safe_day_change_count, 0);
    assert.equal(result.canonicalLifecycleProjections.length, 5);
    for (const payload of result.canonicalLifecycleProjections) {
        const p = payload.lifecycle_projection;
        assert.equal(p.stages.stage1.business_status, 'COMPLETED');
        assert.equal(p.stages.stage2.pending_count, 0);
        assert.equal(p.stages.stage3.pending_count, 0);
        assert.equal(p.stages.stage4.final_weekly_analysis_available, false);
        assert.equal(p.all_results_documented, false);
        assert.equal(p.history_pending, true);
    }
    assert.equal(await data.snapshot(), before);
});

for (const kind of ['worked-rest', 'unpaired-card']) {
    test(`HTTP: ${kind} retains its real diagnostic and never proposes an automatic write`, {
        skip: !uri || !vendor
    }, async t => {
        const data = await setup(t);
        await data.D.collection.updateOne({ ...data.base, hmeromhnia: new Date('2026-09-12') }, { $set: {
            cards_apo_ora_01: '08:00', cards_eos_ora_01: kind === 'worked-rest' ? '16:00' : '',
            cards_ores_ergasias: kind === 'worked-rest' ? 8 : 0 } });
        const before = await data.snapshot(), result = await data.search();
        const p = result.canonicalLifecycleProjections.find(item => item.scope.week_start === '2026-09-07').lifecycle_projection;
        assert.equal(p.stages.stage1.persisted_status, 'STALE');
        assert.equal(p.stages.stage2.business_status, 'BLOCKED');
        assert.ok(p.stages.stage2.blockers.includes('REST_CLASSIFICATION_REVIEW_REQUIRED'));
        assert.equal(result.stage2BulkPreview.pending_scope_count, 1);
        assert.equal(result.stage2BulkPreview.safe_day_change_count, 0);
        assert.notEqual(p.stages.stage3.business_status, 'COMPLETED');
        assert.equal(await data.snapshot(), before);
    });
}

test('HTTP: ambiguous real days retain Stage 3 decisions and fresh fingerprints', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    await data.D.collection.updateMany({ ...data.base, hmeromhnia: {
        $in: [new Date('2026-09-11'), new Date('2026-09-12')] } }, { $set: {
        repo: false, repo_apologistika: false, adeia: false, kathgoria_adeias: '', astheneia_apologistika: false,
        kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: '',
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', ores_ergasias: 8,
        apo_ora_01: '08:00', eos_ora_01: '16:00' } });
    const complete = await data.request('/weekly-hr-workflow/stage1/bulk-complete', { scopes: [data.scopes[1]],
        bulk_request_id: 'legacy-stage2-real-decisions', reason_or_notes: 'Ρητή συνθετική επιβεβαίωση' });
    assert.equal(complete.body.completed_count, 1, JSON.stringify(complete.body));
    const before = await data.snapshot(), result = await data.search();
    const p = result.canonicalLifecycleProjections.find(item => item.scope.week_start === '2026-09-07').lifecycle_projection;
    assert.equal(p.stages.stage2.resolution_route, 'STAGE3_HUMAN_DECISION');
    assert.ok(p.stages.stage2.pending_reasons.includes('AMBIGUOUS_WEEKLY_REST_DATES'));
    assert.equal(p.stages.stage3.pending_count, 2);
    assert.equal(result.stage2BulkPreview.manual_exception_count, 1);
    assert.equal(result.stage2BulkPreview.safe_day_change_count, 0);
    assert.equal(await data.snapshot(), before);
    const item = p.stages.stage3.pending_items.find(item => item.date === '2026-09-11');
    const command = { ...data.scopes[1], row_id: item.row_id, decision_date: item.date,
        expected_input_fingerprint: item.input_fingerprint, expected_stage3_version: item.expected_stage3_version,
        final_classification: 'ABSENCE', request_id: 'legacy-stage2-real-stage3', reason_or_notes: 'Ρητή συνθετική απόφαση' };
    const resolved = await data.request('/weekly-hr-workflow/stage3/resolve-day', command);
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    assert.equal(await data.Audit.countDocuments({ ...data.base, action: 'STAGE3_DAILY_RESOLVED' }), 1);
    const after = await data.search();
    const stage3 = after.canonicalLifecycleProjections.find(item => item.scope.week_start === '2026-09-07').lifecycle_projection.stages.stage3;
    assert.equal(stage3.pending_count, 1);
    assert.deepEqual(stage3.pending_dates, ['2026-09-12']);
});

for (const mode of ['FINALIZED', 'HISTORICAL_RECONSTRUCTION_REQUIRED']) {
    test(`HTTP: ${mode} still refuses Stage 2 writes`, { skip: !uri || !vendor }, async t => {
        const data = await setup(t);
        await data.Period.collection.updateOne(data.periodScope, { $set: mode === 'FINALIZED'
            ? { status: 'FINALIZED' } : { historical_reconstruction_status: 'NONE', historical_reconstruction_version: 0 } });
        const before = await data.snapshot();
        const denied = await data.request('/weekly-hr-workflow/stage2/complete', {
            ...data.scopes[1], request_id: 'legacy-stage2-protected-period', reason_or_notes: 'Συνθετικός έλεγχος προστασίας' });
        assert.equal(denied.status, 409, JSON.stringify(denied.body));
        assert.match(denied.body.code, /PERIOD|HISTORICAL/);
        assert.equal(await data.snapshot(), before);
    });
}

async function openReview(t, data) {
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === data.origin ? route.continue() : route.abort());
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    t.after(() => assert.deepEqual(errors, []));
    await page.goto(data.origin + '/review');
    await page.waitForFunction(() => typeof loadResults === 'function');
    await page.evaluate(async () => {
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0039';
        await loadResults();
    });
    return page;
}
async function lifecycleState(page) {
    return page.evaluate(() => ({
        canonical: currentCanonicalLifecyclePayloads,
        presentation: currentEmploymentReviewLifecyclePresentation,
        ready: currentReviewLifecycleProjectionReady,
        preview: Object.fromEntries(['preview_fingerprint', 'exceptions', 'exception_page', 'pending_scope_count', 'safe_bulk_count', 'manual_exception_count',
            'technical_conflict_count'].map(key => [key, currentWeeklyHrStage2BulkPreview?.[key]]))
    }));
}
async function expandStage(page, stage) {
    const button = page.locator(`[data-workflow-stage="STAGE${stage}"] .accordion-button`);
    if (await button.getAttribute('aria-expanded') === 'true') {
        await button.click(); await page.waitForFunction(() => !document.querySelector('.collapsing'));
    }
    await button.click();
    await page.waitForFunction(() => !document.querySelector('.collapsing'));
    if (stage === 1) await page.evaluate(() => loadPreparedWeeklyHrStage1());
}

test('Chromium PR381: Search → 1 → 2 → 3 → 4 → 1 → Search preserves canonical lifecycle and counters', {
    skip: !uri || !vendor
}, async t => {
    const data = await setup(t);
    // The application date can still be the selected payroll month's end.
    // The detail endpoint then diagnoses the boundary week as OPEN_WEEK_PENDING_COMPLETION.
    data.session.appDate = '2026-09-30';
    const before = await data.snapshot();
    const page = await openReview(t, data), initial = await lifecycleState(page);
    assert.equal(initial.canonical.length, 5);
    assert.equal(initial.presentation.stages.STAGE1.pending_count, 0);
    assert.equal(initial.presentation.stages.STAGE2.pending_count, 0);
    assert.equal(initial.presentation.stages.STAGE3.pending_count, 0);
    assert.equal(initial.presentation.stages.STAGE4.business_status, 'OPEN');
    for (const stage of [1, 2, 3, 4, 1, 4, 3, 2, 1]) {
        await expandStage(page, stage);
        const state = await lifecycleState(page);
        t.diagnostic(`Stage ${stage}: Stage 2 ${state.presentation.stages.STAGE2.business_status}, pending ${state.presentation.stages.STAGE2.pending_count}`);
        assert.deepEqual(state.presentation, initial.presentation, `Opening Stage ${stage} cannot change business states`);
        assert.deepEqual(state, initial, `Opening Stage ${stage} cannot replace Search authority`);
        t.diagnostic(`PASS Stage ${stage}: states and counters unchanged`);
    }
    await page.evaluate(() => loadResults());
    assert.deepEqual(await lifecycleState(page), initial);
    assert.equal(await page.locator('.weekly-hr-stage2-exception-review').count(), 0);
    assert.match(await page.locator('#policyPreviewGroupsContainer').textContent(), /Περιπτώσεις που χρειάζονται έλεγχο:\s*0/);
    await page.waitForLoadState('networkidle');
    assert.equal(await data.snapshot(), before, 'Reading every stage writes no MongoDB collection');
    const boundary = initial.canonical.find(p => p.scope.week_start === '2026-09-28');
    assert.equal(boundary.lifecycle_projection.stages.stage1.attestation_scope, 'PERIOD_SLICE');
    for (const kind of ['worked-rest', 'unpaired-card']) {
        await data.D.collection.updateOne({ ...data.base, hmeromhnia: new Date('2026-09-12') },
            { $set: { cards_apo_ora_01: '08:00', cards_eos_ora_01: kind === 'worked-rest' ? '16:00' : '',
                cards_ores_ergasias: kind === 'worked-rest' ? 8 : 0 } });
        const conflictBefore = await data.snapshot();
        await page.evaluate(() => loadResults());
        const blocked = await lifecycleState(page);
        assert.equal(blocked.presentation.stages.STAGE2.business_status, 'BLOCKED');
        assert.ok(blocked.canonical.some(p => p.lifecycle_projection.stages.stage1.persisted_status === 'STALE'));
        await expandStage(page, 1);
        assert.deepEqual(await lifecycleState(page), blocked);
        assert.equal(await page.locator('[data-workflow-stage="STAGE2"] .accordion-button').isDisabled(), true);
        await expandStage(page, 4);
        assert.deepEqual(await lifecycleState(page), blocked);
        assert.equal(await data.snapshot(), conflictBefore);
    }
});

test('Chromium PR381: late Stage 1 response cannot overwrite a newer Search or Stage 2 preview', {
    skip: !uri || !vendor
}, async t => {
    const data = await setup(t), page = await openReview(t, data);
    let release, captured;
    const gate = new Promise(resolve => { release = resolve; });
    const ready = new Promise(resolve => { captured = resolve; });
    await page.route('**/stage1/bulk-review', async route => {
        const response = await route.fetch(); captured(); await gate; await route.fulfill({ response });
    });
    await page.evaluate(() => { window.oldStage1Request = loadPreparedWeeklyHrStage1(); });
    await ready;
    await data.D.collection.updateOne({ ...data.base, hmeromhnia: new Date('2026-09-12') },
        { $set: { cards_apo_ora_01: '08:00', cards_eos_ora_01: '', cards_ores_ergasias: 0 } });
    await page.evaluate(() => loadResults());
    const current = await lifecycleState(page), before = await data.snapshot();
    assert.equal(current.presentation.stages.STAGE2.business_status, 'BLOCKED');
    release(); await page.evaluate(() => window.oldStage1Request);
    assert.deepEqual(await lifecycleState(page), current);
    assert.equal(await page.evaluate(() => weeklyHrStage1Payloads.size), 0,
        'Old details must not populate the new search either');
    await page.unroute('**/stage1/bulk-review');
    await expandStage(page, 1);
    assert.deepEqual(await lifecycleState(page), current);
    assert.equal(await data.snapshot(), before);
});

test('Chromium PR381: late Search cannot hide a fresh real blocker', { skip: !uri || !vendor }, async t => {
    const data = await setup(t), page = await openReview(t, data);
    let release, captured, first = true;
    const gate = new Promise(resolve => { release = resolve; });
    const ready = new Promise(resolve => { captured = resolve; });
    await page.route('**/review?*', async route => {
        if (!first) return route.continue(); first = false;
        const response = await route.fetch(); captured(); await gate; await route.fulfill({ response });
    });
    await page.evaluate(() => { window.oldSearch = loadResults(); });
    await ready;
    await data.D.collection.updateOne({ ...data.base, hmeromhnia: new Date('2026-09-12') },
        { $set: { cards_apo_ora_01: '08:00', cards_eos_ora_01: '', cards_ores_ergasias: 0 } });
    await page.evaluate(() => loadResults());
    const current = await lifecycleState(page), before = await data.snapshot();
    assert.equal(current.presentation.stages.STAGE2.business_status, 'BLOCKED');
    release(); await page.evaluate(() => window.oldSearch);
    assert.deepEqual(await lifecycleState(page), current);
    assert.equal(await data.snapshot(), before);
});


test('Chromium PR381: late Stage 2 preview cannot replace the preview of a newer Search', {
    skip: !uri || !vendor
}, async t => {
    const data = await setup(t), page = await openReview(t, data);
    let release, captured;
    const gate = new Promise(resolve => { release = resolve; });
    const ready = new Promise(resolve => { captured = resolve; });
    await page.route('**/stage2/bulk-preview?*', async route => {
        const response = await route.fetch(); captured(); await gate; await route.fulfill({ response });
    });
    await page.evaluate(() => { window.oldPreview = loadWeeklyHrStage2BulkPreview(); });
    await ready;
    await data.D.collection.updateOne({ ...data.base, hmeromhnia: new Date('2026-09-12') },
        { $set: { cards_apo_ora_01: '08:00', cards_eos_ora_01: '', cards_ores_ergasias: 0 } });
    await page.evaluate(() => loadResults());
    const current = await lifecycleState(page), before = await data.snapshot();
    assert.equal(current.preview.technical_conflict_count, 1);
    release(); await page.evaluate(() => window.oldPreview);
    assert.deepEqual(await lifecycleState(page), current);
    assert.equal(await data.snapshot(), before);
});

test('Chromium PR381: a failed detail read preserves states and never certifies completion', {
    skip: !uri || !vendor
}, async t => {
    const data = await setup(t), page = await openReview(t, data);
    const current = await lifecycleState(page), before = await data.snapshot();
    await page.route('**/stage1/bulk-review', route => route.fulfill({ status: 503,
        contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Συνθετική αστοχία ανάγνωσης' }) }));
    await expandStage(page, 1);
    assert.deepEqual(await lifecycleState(page), current);
    assert.equal(await page.evaluate(() => weeklyHrStage1Payloads.size), 0);
    assert.equal(await data.snapshot(), before);
});

test('Chromium PR381: an explicit daily save refreshes every stage from Search before further navigation', {
    skip: !uri || !vendor
}, async t => {
    const data = await setup(t), page = await openReview(t, data);
    await expandStage(page, 1);
    const rowId = String((await data.D.collection.findOne({ ...data.base,
        hmeromhnia: new Date('2026-09-08') }))._id);
    const before = await data.snapshot();
    await page.locator('[data-guidance-date="2026-09-08"] .weekly-hr-stage1-open-editor').click();
    await page.locator('#weeklyHrStage1DrawerClassification').selectOption('ABSENCE');
    await page.locator('#weeklyHrStage1DayEditor .btn-close').click();
    const refreshed = page.waitForResponse(r => new URL(r.url()).pathname === '/api/prodhlomena-oraria/review');
    await page.locator('.weekly-hr-save-day-classifications').click();
    await page.locator('.swal2-textarea').fill('Ρητή αποθήκευση συνθετικού χαρακτηρισμού');
    await page.locator('.swal2-confirm').click();
    const authoritative = await (await refreshed).json();
    await page.waitForFunction(() => document.querySelector('.swal2-title')?.textContent === 'Αποθήκευση χαρακτηρισμών');
    assert.deepEqual(await page.evaluate(() => currentCanonicalLifecyclePayloads), authoritative.canonicalLifecycleProjections);
    assert.equal((await data.D.collection.findOne({ _id: new mongoose.Types.ObjectId(rowId) })).apousia_apologistika, true);
    assert.notEqual(await data.snapshot(), before);
    await page.locator('.swal2-confirm').click();
    await page.waitForFunction(() => !weeklyHrStage1DaySaving);
    const current = await lifecycleState(page), saved = await data.snapshot();
    await expandStage(page, 4); await expandStage(page, 1);
    assert.deepEqual(await lifecycleState(page), current);
    assert.equal(await data.snapshot(), saved);
});
