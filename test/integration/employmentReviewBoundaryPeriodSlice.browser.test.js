'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const { calculateHistoricalFingerprints } = require('../../server/services/ergazomenoi/apasxoliseisHistoricalPeriodReconstructionService');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const period = { period_start: '2026-09-01', period_end: '2026-09-30' };
let sequence = 0;

async function setup(t, { legacy = true } = {}) {
    // The real reported historical mode, after the deadline; no date bypass.
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-12T12:00:00Z') });
    const data = await createStage1CompletionFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    data.session.appDate = '2026-11-12';
    const terms = { kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
    await data.E.collection.updateOne({ _id: data.employee._id }, { $set: terms });
    await data.H.collection.updateOne({ _id: data.history._id }, { $set: terms });
    if (legacy) await data.H.collection.insertOne({ ...data.history, ...terms, _id: new mongoose.Types.ObjectId() });
    const future = await data.D.collection.find({ ...data.base, hmeromhnia: { $gte: new Date('2026-10-01') } }).toArray();
    // Fixture construction only, guarded to the disposable localhost database.
    await data.D.collection.deleteMany({ ...data.base, hmeromhnia: { $gte: new Date('2026-10-01') } });
    await data.D.collection.updateMany({ ...data.base, hmeromhnia: { $gte: new Date('2026-09-28') } }, { $set: {
        kathgoria_ergasias: 'ΕΡΓ', repo: false, kathgoria_ergasias_apologistika: 'ΑΣΘΕΝΕΙΑ',
        astheneia_apologistika: true, adeia_apologistika: false, kathgoria_adeias_apologistika: '',
        apo_ora_01: '08:00', eos_ora_01: '16:00', ores_ergasias: 8,
        cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
        ores_ergasias_apologistika: 0, ores_pragmatikhs_ergasias_apologistika: 0,
        apologistiko_biblio: false, is_locked: false } });
    await data.D.collection.updateOne({ ...data.base, hmeromhnia: new Date('2026-09-28') },
        { $set: { adeia: true, kathgoria_adeias: 'ΣΥΝΘΕΤΙΚΗ_ΜΗΤΡΟΤΗΤΑ' } });
    const periodScope = { ...data.base, period_start: new Date(period.period_start), period_end: new Date(period.period_end) };
    const fingerprints = await calculateHistoricalFingerprints({ scope: periodScope });
    await data.Period.create({ ...periodScope, deadline: new Date('2026-10-31'), status: 'OPEN',
        historical_reconstruction_status: 'COMPLETED', historical_reconstruction_version: 1,
        historical_source_fingerprint: fingerprints.source_fingerprint,
        historical_dependency_fingerprint: fingerprints.dependency_fingerprint,
        historical_holiday_dependency_fingerprint: fingerprints.holiday_dependency_fingerprint,
        historical_result_fingerprint: fingerprints.result_fingerprint,
        historical_reconstruction_completed_at: new Date('2026-11-11') });
    const scope = { ...data.scope, week_start: '2026-09-28', week_end: '2026-10-04', ...period };
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const prefix = origin + '/api/prodhlomena-oraria/review/weekly-hr-workflow/';
    const request = async (route, body) => {
        const response = await fetch(prefix + route, body ? { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
        return { status: response.status, body: await response.json() };
    };
    const bulk = (id = 'boundary-bulk-' + ++sequence, scopes = [scope]) => request('stage1/bulk-complete', {
        scopes, reason_or_notes: 'Ρητή επιβεβαίωση συνθετικού τμήματος Σεπτεμβρίου', bulk_request_id: id });
    const read = async () => {
        const result = await request('stage1?' + new URLSearchParams(scope));
        assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body;
    };
    return { ...data, future, scope, origin, request, bulk, read, periodScope };
}

test('A/G: historical September completion succeeds without October rows or daily writes', {
    skip: !uri || !vendor
}, async t => {
    const data = await setup(t);
    const before = JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean());
    const response = await data.bulk();
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.completed_count, 1, JSON.stringify(response.body));
    const state = await data.State.findOne(data.base).lean();
    assert.equal(state.stage1.status, 'OPEN', 'The full natural week must not be attested');
    assert.equal(state.stage1.period_slices[0].status, 'COMPLETED');
    assert.deepEqual(state.stage1.period_slices[0].actionable_dates.map(d => d.toISOString().slice(0, 10)),
        ['2026-09-28', '2026-09-29', '2026-09-30']);
    assert.equal(await data.Audit.countDocuments(data.base), 1);
    assert.equal(JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean()), before);
    const read = await data.read();
    assert.equal(read.stage1_status, 'COMPLETED');
    assert.equal(read.lifecycle_projection.stages.stage1.pending_count, 0);
    assert.ok(read.lifecycle_projection.stages.stage1.read_warnings.some(
        item => item.code === 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED'));
});

for (const problem of ['missing', 'duplicate', 'contradiction', 'unpaired-card']) {
    test(`B/C: ${problem} owned day blocks completion without writes`, { skip: !uri || !vendor }, async t => {
        const data = await setup(t);
        const day = new Date(problem === 'missing' ? '2026-09-29' : '2026-09-30');
        const filter = { ...data.base, hmeromhnia: day };
        if (problem === 'missing') await data.D.collection.deleteOne(filter);
        if (problem === 'duplicate') await data.D.collection.insertOne({
            ...await data.D.collection.findOne(filter), _id: new mongoose.Types.ObjectId() });
        if (problem === 'contradiction') await data.D.collection.updateOne(filter, { $set: {
            astheneia_apologistika: false, kathgoria_ergasias_apologistika: 'ΕΡΓ',
            repo_apologistika: true } });
        if (problem === 'unpaired-card') await data.D.collection.updateOne(filter,
            { $set: { cards_apo_ora_01: '08:00', cards_eos_ora_01: '' } });
        const before = await data.snapshot();
        const result = (await data.bulk()).body;
        assert.equal(result.completed_count, 0, JSON.stringify(result));
        assert.equal(result.blocked_count, 1, JSON.stringify(result));
        assert.equal(result.results[0].code, ['contradiction', 'unpaired-card'].includes(problem)
            ? 'STAGE1_COMPLETION_BLOCKED' : 'INCOMPLETE_NATURAL_WEEK');
        assert.match(JSON.stringify(result.results[0].diagnostics), new RegExp(day.toISOString().slice(0, 10)));
        assert.equal(await data.snapshot(), before);
    });
}

test('D/E: future October creation preserves September; October attests independently; owned changes go stale', {
    skip: !uri || !vendor
}, async t => {
    const data = await setup(t);
    const requestId = 'boundary-september-replay';
    assert.equal((await data.bulk(requestId)).body.completed_count, 1);
    const september = JSON.stringify((await data.State.findOne(data.base).lean()).stage1.period_slices[0]);
    await data.D.collection.insertMany(data.future);
    assert.equal((await data.read()).stage1_status, 'COMPLETED');
    assert.equal((await data.bulk(requestId)).body.already_completed_count, 1);
    assert.equal(await data.Audit.countDocuments(data.base), 1);

    const { PeriodsModel } = require('../../server/models/stathera_arxeia');
    await PeriodsModel.collection.insertOne({ xrhsh: '2026', kodikos: '10',
        apo: new Date('2026-10-01'), eos: new Date('2026-10-31') });
    data.session.periodInUse = '10';
    const october = { ...data.scope, period_start: '2026-10-01', period_end: '2026-10-31' };
    const result = await data.bulk('boundary-october-independent', [october]);
    assert.equal(result.body.completed_count, 1, JSON.stringify(result.body));
    const state = await data.State.findOne(data.base).lean();
    assert.equal(state.stage1.status, 'OPEN');
    assert.equal(state.stage1.period_slices.length, 2);
    assert.equal(JSON.stringify(state.stage1.period_slices[0]), september);
    assert.deepEqual(state.stage1.period_slices[1].actionable_dates.map(d => d.toISOString().slice(0, 10)),
        ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    assert.equal(await data.Audit.countDocuments(data.base), 2);

    data.session.periodInUse = '09';
    await data.D.collection.updateOne({ ...data.base, hmeromhnia: new Date('2026-09-29') }, { $set: {
        astheneia_apologistika: false, apousia_apologistika: true, kathgoria_ergasias_apologistika: 'ΑΠΟΥΣΙΑ' } });
    assert.equal((await data.read()).lifecycle_projection.stages.stage1.persisted_status, 'STALE');
    const replay = (await data.bulk(requestId)).body;
    assert.equal(replay.completed_count + replay.already_completed_count, 0);
    assert.equal(replay.results[0].code, 'STAGE1_REQUEST_ID_CONFLICT');
    assert.equal(await data.Audit.countDocuments(data.base), 2);
});

test('F: finalized October and its locked daily rows are unchanged', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    await data.D.collection.insertMany(data.future.map(row => ({ ...row, is_locked: true })));
    const neighbour = { _id: new mongoose.Types.ObjectId(), ...data.base,
        period_start: new Date('2026-10-01'), period_end: new Date('2026-10-31'),
        status: 'FINALIZED', version: 3, write_fence_version: 5,
        frozen_snapshot_id: new mongoose.Types.ObjectId(), frozen_snapshot_fingerprint: 'b'.repeat(64) };
    await data.Period.collection.insertOne(neighbour);
    const before = JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean());
    const result = await data.bulk();
    assert.equal(result.body.completed_count, 1, JSON.stringify(result.body));
    assert.deepEqual(await data.Period.collection.findOne({ _id: neighbour._id }), neighbour);
    assert.equal(JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean()), before);
});

test('H: verified history also recognizes the slice without declaring stages 2–4 or the full week completed', {
    skip: !uri || !vendor
}, async t => {
    const data = await setup(t, { legacy: false });
    assert.equal((await data.bulk()).body.completed_count, 1);
    const read = await data.read();
    assert.equal(read.stage1_status, 'COMPLETED');
    assert.equal(read.lifecycle_projection.stages.stage1.attestation_scope, 'PERIOD_SLICE');
    for (const stage of ['stage2', 'stage3', 'stage4']) {
        assert.equal(read.lifecycle_projection.stages[stage].business_status, 'DEFERRED_TO_NEXT_PERIOD');
        assert.equal(read.lifecycle_projection.stages[stage].final_weekly_analysis_available, false);
    }
    const state = await data.State.findOne(data.base).lean();
    assert.equal(state.stage1.status, 'OPEN');
});

test('transaction rechecks owned rows and rolls back a competing change', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    const startSession = mongoose.startSession;
    t.mock.method(mongoose, 'startSession', async function (...args) {
        const session = await startSession.apply(this, args);
        const withTransaction = session.withTransaction.bind(session);
        session.withTransaction = async (...transactionArgs) => {
            await data.D.collection.updateOne({ ...data.base, hmeromhnia: new Date('2026-09-29') },
                { $set: { astheneia_apologistika: false, apousia_apologistika: true,
                    kathgoria_ergasias_apologistika: 'ΑΠΟΥΣΙΑ' } });
            return withTransaction(...transactionArgs);
        };
        return session;
    });
    const result = (await data.bulk()).body;
    assert.equal(result.results[0].code, 'STAGE1_INPUT_CHANGED', JSON.stringify(result));
    assert.equal(result.results[0].status, 'STALE_RETRY_REQUIRED');
    assert.equal(await data.State.countDocuments(data.base), 0);
    assert.equal(await data.Audit.countDocuments(data.base), 0);
    assert.equal((await data.Period.findOne(data.periodScope).lean()).write_fence_version, 0);
});

test('replay revalidates completeness inside the transaction instead of trusting the old audit', {
    skip: !uri || !vendor
}, async t => {
    const data = await setup(t), requestId = 'boundary-replay-completeness';
    assert.equal((await data.bulk(requestId)).body.completed_count, 1);
    const state = JSON.stringify(await data.State.findOne(data.base).lean());
    const periodBefore = JSON.stringify(await data.Period.findOne(data.periodScope).lean());
    const startSession = mongoose.startSession;
    t.mock.method(mongoose, 'startSession', async function (...args) {
        const session = await startSession.apply(this, args);
        const withTransaction = session.withTransaction.bind(session);
        session.withTransaction = async (...transactionArgs) => {
            await data.D.collection.deleteOne({ ...data.base, hmeromhnia: new Date('2026-09-29') });
            return withTransaction(...transactionArgs);
        };
        return session;
    });
    const result = (await data.bulk(requestId)).body;
    assert.equal(result.results[0].code, 'INCOMPLETE_NATURAL_WEEK', JSON.stringify(result));
    assert.equal(result.blocked_count, 1);
    assert.equal(result.completed_count + result.already_completed_count, 0);
    assert.equal(JSON.stringify(await data.State.findOne(data.base).lean()), state);
    assert.equal(JSON.stringify(await data.Period.findOne(data.periodScope).lean()), periodBefore);
    assert.equal(await data.Audit.countDocuments(data.base), 1);
});

test('Chromium: real bulk confirmation attests only September with missing October', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === data.origin ? route.continue() : route.abort());
    const daily = JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean());
    await page.goto(data.origin + '/review');
    await page.waitForFunction(() => typeof loadResults === 'function');
    await page.evaluate(async () => {
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0039';
        await loadResults(); await loadPreparedWeeklyHrStage1();
        document.getElementById('employmentReviewStage1Collapse').classList.add('show');
    });
    const checkbox = page.locator('.weekly-hr-stage1-select').last();
    await checkbox.check();
    const response = page.waitForResponse(r => r.url().endsWith('/stage1/bulk-complete'));
    await page.locator('.weekly-hr-bulk-complete').click();
    await page.locator('.swal2-confirm').click();
    const posted = await response;
    const body = await posted.json();
    assert.equal(body.completed_count, 1, JSON.stringify(body));
    assert.deepEqual(posted.request().postDataJSON().scopes, [data.scope]);
    await page.waitForFunction(() => document.querySelector('.swal2-html-container')?.textContent
        .includes('Αποθηκεύτηκε η επιβεβαίωση'));
    assert.doesNotMatch(await page.locator('.swal2-html-container').innerText(),
        /Η νέα κατάσταση των ημερών δεν επιβεβαιώθηκε/);
    await page.locator('.swal2-confirm').click();
    await page.waitForFunction(() => !weeklyHrStage1BulkSubmitting);
    await page.waitForLoadState('networkidle');
    assert.equal((await data.read()).stage1_status, 'COMPLETED');
    assert.equal(await data.Audit.countDocuments(data.base), 1);
    assert.equal(JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean()), daily);
});
