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

test('Chromium: completed daily declarations show no forced HR decision at Stage 2 or Stage 3', {
    skip: !uri || !vendor
}, async t => {
    const data = await setup(t), before = await data.snapshot();
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === data.origin ? route.continue() : route.abort());
    await page.goto(data.origin + '/review');
    await page.waitForFunction(() => typeof loadResults === 'function');
    await page.evaluate(async () => {
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0039';
        await loadResults(); await loadPreparedWeeklyHrStage1();
        document.getElementById('employmentReviewStage2Collapse').classList.add('show');
    });
    assert.equal(await page.locator('.weekly-hr-stage2-exception-review').count(), 0);
    assert.match(await page.locator('#policyPreviewGroupsContainer').textContent(), /Περιπτώσεις που χρειάζονται έλεγχο:\s*0/);
    const stages = await page.evaluate(() => currentCanonicalLifecyclePayloads.map(p => p.lifecycle_projection.stages));
    assert.equal(stages.length, 5);
    assert.ok(stages.every(s => s.stage2.pending_count === 0 && s.stage3.pending_count === 0),
        JSON.stringify(stages.map(s => ({ stage2: s.stage2, stage3: s.stage3 }))));
    await page.waitForLoadState('networkidle');
    assert.equal(await data.snapshot(), before);
    await data.D.collection.updateOne({ ...data.base, hmeromhnia: new Date('2026-09-12') },
        { $set: { cards_apo_ora_01: '08:00', cards_eos_ora_01: '' } });
    const conflictBefore = await data.snapshot();
    await page.evaluate(async () => { await loadResults(); await loadPreparedWeeklyHrStage1(); });
    assert.equal(await page.locator('.weekly-hr-stage2-exception, .weekly-hr-stage2-technical-conflict').count(), 1);
    assert.match(await page.locator('#policyPreviewGroupsContainer').textContent(), /CARD|REST_CLASSIFICATION/);
    await page.waitForLoadState('networkidle');
    assert.equal(await data.snapshot(), conflictBefore, 'Showing a real conflict cannot change stored data');
});
