'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const controller = require('../../server/controllers/ergazomenoi/erganhController');
const { requireUserPrivilegeAction } = require('../../server/middlewares/requireUserPrivilegeForm');
const { authorizeSessionCompany } = require('../../server/middlewares/programmataAccessScope');
const { requireCriticalEmploymentDecisionRole } = require('../../server/services/ergazomenoi/apasxoliseisCriticalActionAuthorizationService');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const period = { period_start: '2026-09-01', period_end: '2026-09-30' };
let identity = 0;

async function setup(t) {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T12:00:00Z').getTime() });
    const data = await createStage1CompletionFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    const terms = { kathestos_apasxolhshs: '0', typos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
    await data.E.collection.updateOne({ _id: data.employee._id }, { $set: terms });
    await data.H.collection.updateOne({ _id: data.history._id }, { $set: terms });
    await data.H.collection.insertOne({ ...data.history, ...terms, _id: new mongoose.Types.ObjectId() });
    for (const row of data.rows) {
        const rest = [0, 6].includes(row.hmeromhnia.getUTCDay());
        await data.D.collection.updateOne({ _id: row._id }, { $set: {
            kathgoria_ergasias: rest ? 'ΑΝ' : 'ΕΡΓ', repo: rest,
            kathgoria_ergasias_apologistika: rest ? 'ΑΝ' : 'ΑΣΘΕΝΕΙΑ', repo_apologistika: rest,
            astheneia_apologistika: !rest, adeia_apologistika: false, apousia_apologistika: false,
            kathgoria_adeias_apologistika: '', cards_apo_ora_01: '', cards_eos_ora_01: '',
            apo_ora_01: rest ? '' : '08:00', eos_ora_01: rest ? '' : '16:00',
            cards_ores_ergasias: 0, ores_ergasias: rest ? 0 : 8,
            ores_ergasias_apologistika: 0, ores_pragmatikhs_ergasias_apologistika: 0
        } });
    }
    const second = new mongoose.Types.ObjectId();
    await data.U.collection.insertOne({ _id: second, team: 'TEST', situation: 'A', privileges: 'HR' });
    await data.V.collection.insertOne({ userId: String(second), form: 'ElegxosApasxolhseonPeriodoy', privileges: { read: true } });
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        req.session = { ...data.session, ...(req.headers['x-synthetic-actor'] === 'second'
            ? { userId: String(second), userName: 'ΔΕΥΤΕΡΟΣ ΣΥΝΘΕΤΙΚΟΣ ΧΡΗΣΤΗΣ' } : {}) };
        next();
    });
    app.use(requireUserPrivilegeAction('ElegxosApasxolhseonPeriodoy', 'read'), authorizeSessionCompany);
    app.get('/stage1', controller.getWeeklyHrWorkflowStage1);
    app.get('/search', controller.getProdhlomenaOrariaForReview);
    app.get('/period', controller.getEmploymentReviewPeriodControl);
    app.post('/complete', requireCriticalEmploymentDecisionRole, controller.completeWeeklyHrWorkflowStage1);
    app.post('/bulk', requireCriticalEmploymentDecisionRole, controller.completeWeeklyHrWorkflowStage1Bulk);
    app.post('/resolve', requireCriticalEmploymentDecisionRole, controller.resolveWeeklyHrStage3Day);
    app.use(data.app);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const request = async (route, body, actor = '') => {
        const response = await fetch(origin + route, body ? { method: 'POST', headers: {
            'Content-Type': 'application/json', 'x-synthetic-actor': actor }, body: JSON.stringify(body) } : {});
        return { status: response.status, body: await response.json() };
    };
    const read = async scope => {
        const response = await request('/stage1?' + new URLSearchParams(scope || data.scope));
        assert.equal(response.status, 200, JSON.stringify(response.body));
        return response.body;
    };
    const scopes = ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'].map((start, i) => ({
        ...data.scope, week_start: start, week_end: new Date(Date.parse(start) + 6 * 86400000).toISOString().slice(0, 10),
        ...([0, 4].includes(i) ? period : {}) }));
    const bulk = (selected, id = 'independent-bulk-' + ++identity, actor = '') => request('/bulk', {
        scopes: selected, reason_or_notes: 'Ανεξάρτητη συνθετική επαλήθευση', bulk_request_id: id }, actor);
    const snapshot = async () => {
        const collections = (await mongoose.connection.db.listCollections().toArray()).map(c => c.name).sort();
        const result = {};
        for (const name of collections) result[name] = await mongoose.connection.db.collection(name).find().sort({ _id: 1 }).toArray();
        return JSON.stringify(result);
    };
    return { ...data, origin, request, read, scopes, bulk, fullSnapshot: snapshot };
}

test('independent: five legacy weeks, duplicate scopes and repeated requests write exactly five attestations', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    const dailyBefore = JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean());
    const first = await data.bulk([...data.scopes, data.scopes[2]], 'independent-repeat-five');
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.completed_count, 5, JSON.stringify(first.body));
    assert.equal(first.body.already_completed_count, 1);
    const again = await data.bulk([...data.scopes, data.scopes[2]], 'independent-repeat-five');
    assert.equal(again.body.completed_count, 0);
    assert.equal(again.body.already_completed_count, 6, JSON.stringify(again.body));
    assert.equal(await data.Audit.countDocuments(data.base), 5);
    assert.equal(JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean()), dailyBefore);
    for (const scope of data.scopes) {
        const read = await data.read(scope);
        assert.equal(read.lifecycle_projection.stages.stage1.pending_count, 0);
    }
});

test('independent: concurrent users cannot create duplicate weekly attestations', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    const scope = data.scopes[2];
    const responses = await Promise.all([data.bulk([scope], 'independent-race-first'), data.bulk([scope], 'independent-race-second', 'second')]);
    assert.ok(responses.some(r => r.body.completed_count === 1), JSON.stringify(responses));
    assert.equal(await data.Audit.countDocuments(data.base), 1);
    assert.equal(await data.State.countDocuments(data.base), 1);
    const retry = await data.bulk([scope], 'independent-race-retry', 'second');
    assert.equal(retry.body.already_completed_count, 1, JSON.stringify(retry.body));
    assert.equal(await data.Audit.countDocuments(data.base), 1);
});

test('independent: a real rest/category contradiction blocks completion without writes', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    const row = data.rows.find(row => row.hmeromhnia.toISOString().slice(0, 10) === '2026-09-12');
    await data.D.collection.updateOne({ _id: row._id }, { $set: {
        kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: true } });
    const before = await data.fullSnapshot();
    const read = await data.read(data.scope);
    assert.ok(read.lifecycle_projection.stages.stage1.blockers.includes('CATEGORY_REPO_CONFLICT'));
    const result = await data.bulk([data.scope]);
    assert.equal(result.body.completed_count, 0);
    assert.equal(result.body.blocked_count, 1, JSON.stringify(result.body));
    assert.equal(await data.fullSnapshot(), before);
});

test('independent: reused request identity cannot attest changed daily input', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    assert.equal((await data.bulk([data.scope], 'independent-identity-input')).body.completed_count, 1);
    const row = data.rows.find(row => row.hmeromhnia.toISOString().slice(0, 10) === '2026-09-08');
    await data.D.collection.updateOne({ _id: row._id }, { $set: { astheneia_apologistika: false,
        apousia_apologistika: true, kathgoria_ergasias_apologistika: 'ΑΠΟΥΣΙΑ' } });
    const before = await data.fullSnapshot();
    const replay = await data.bulk([data.scope], 'independent-identity-input');
    assert.equal(replay.body.results[0].code, 'STAGE1_REQUEST_ID_CONFLICT', JSON.stringify(replay.body));
    assert.equal(await data.fullSnapshot(), before);
    assert.equal(await data.Audit.countDocuments(data.base), 1);
});

test('independent: an intermediate audit failure rolls back its transaction and retry completes only that week', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    const selected = data.scopes.slice(1, 4), original = data.Audit.create;
    const mocked = t.mock.method(data.Audit, 'create', async function (documents, options) {
        if (new Date(documents[0].week_start).toISOString().slice(0, 10) === '2026-09-14') {
            throw new Error('Synthetic intermediate audit failure');
        }
        return original.call(this, documents, options);
    });
    const response = await data.bulk(selected, 'independent-intermediate-failure');
    assert.equal(response.body.completed_count, 2, JSON.stringify(response.body));
    assert.equal(response.body.failed_count, 1);
    assert.equal(await data.State.countDocuments(data.base), 2);
    assert.equal(await data.Audit.countDocuments(data.base), 2);
    assert.equal(await data.State.countDocuments({ ...data.base, week_start: new Date('2026-09-14') }), 0);
    mocked.mock.restore();
    const retry = await data.bulk(selected, 'independent-intermediate-failure');
    assert.equal(retry.body.completed_count, 1, JSON.stringify(retry.body));
    assert.equal(retry.body.already_completed_count, 2);
    assert.equal(await data.Audit.countDocuments(data.base), 3);
});

test('independent: a completed boundary slice supports the next human daily decision', { skip: !uri || !vendor }, async t => {
    const data = await setup(t), scope = data.scopes[0];
    const row = data.rows.find(row => row.hmeromhnia.toISOString().slice(0, 10) === '2026-09-01');
    await data.D.collection.updateOne({ _id: row._id }, { $set: { astheneia_apologistika: false,
        kathgoria_ergasias_apologistika: '', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' } });
    const completed = await data.bulk([scope]);
    assert.equal(completed.body.completed_count, 1, JSON.stringify(completed.body));
    const read = await data.read(scope);
    const item = read.lifecycle_projection.stages.stage3.pending_items.find(item => item.date === '2026-09-01');
    assert.ok(item);
    const resolved = await data.request('/resolve', { ...scope, row_id: String(row._id), decision_date: item.date,
        expected_input_fingerprint: item.input_fingerprint, expected_stage3_version: item.expected_stage3_version,
        final_classification: 'ABSENCE', reason_or_notes: 'Ρητή συνθετική απόφαση', request_id: 'independent-boundary-stage3' });
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    assert.equal((await data.D.findById(row._id).lean()).apousia_apologistika, true);
    assert.equal(await data.Audit.countDocuments({ ...data.base, action: 'STAGE3_DAILY_RESOLVED' }), 1);
    assert.equal((await data.read(scope)).lifecycle_projection.stages.stage1.pending_count, 0);
});

test('independent: late and finalized periods reject completion without changing any collection', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    const before = await data.fullSnapshot();
    t.mock.timers.setTime(new Date('2027-01-01T12:00:00Z').getTime());
    const late = await data.bulk([data.scope]);
    assert.equal(late.body.completed_count, 0, JSON.stringify(late.body));
    assert.equal(late.body.failed_count, 1);
    assert.equal(await data.fullSnapshot(), before);
    t.mock.timers.setTime(new Date('2026-09-30T12:00:00Z').getTime());
    await data.Period.collection.insertOne({ ...data.base, period_start: new Date(period.period_start),
        period_end: new Date(period.period_end), status: 'FINALIZED', version: 1, write_fence_version: 1,
        frozen_snapshot_id: new mongoose.Types.ObjectId(), frozen_snapshot_fingerprint: 'a'.repeat(64) });
    const frozen = await data.fullSnapshot();
    const finalized = await data.bulk([data.scope]);
    assert.equal(finalized.body.completed_count, 0, JSON.stringify(finalized.body));
    assert.equal(finalized.body.failed_count, 1);
    assert.equal(await data.fullSnapshot(), frozen);
});

test('independent: ordinary Search and weekly/period reads preserve every stored collection', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    const before = await data.fullSnapshot();
    const search = await data.request('/search?' + new URLSearchParams({ apo_hmeromhnia: period.period_start,
        eos_hmeromhnia: period.period_end, ypokatasthma: '0000', kodikos: '0039' }));
    assert.equal(search.status, 200, JSON.stringify(search.body));
    for (const scope of data.scopes) await data.read(scope);
    assert.equal((await data.request('/period?ypokatasthma=0000')).status, 200);
    assert.equal(await data.fullSnapshot(), before);
});

test('independent: boundary attestations preserve finalized and locked neighbouring periods', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    const frozen = new mongoose.Types.ObjectId(), locked = new mongoose.Types.ObjectId();
    await data.Period.collection.insertMany([
        { _id: frozen, ...data.base, period_start: new Date('2026-08-01'), period_end: new Date('2026-08-31'),
            status: 'FINALIZED', version: 3, write_fence_version: 5,
            frozen_snapshot_id: new mongoose.Types.ObjectId(), frozen_snapshot_fingerprint: 'b'.repeat(64) },
        { _id: locked, ...data.base, period_start: new Date('2026-10-01'), period_end: new Date('2026-10-31'),
            status: 'LOCKED', version: 2, write_fence_version: 4 }
    ]);
    const neighbours = async () => JSON.stringify(await data.Period.collection.find({ _id: { $in: [frozen, locked] } }).sort({ _id: 1 }).toArray());
    const before = await neighbours();
    const daily = JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean());
    const completed = await data.bulk([data.scopes[0], data.scopes[4]]);
    assert.equal(completed.body.completed_count, 2, JSON.stringify(completed.body));
    for (const scope of [data.scopes[0], data.scopes[4]]) {
        assert.equal((await data.read(scope)).lifecycle_projection.stages.stage1.pending_count, 0);
    }
    assert.equal(await neighbours(), before);
    assert.equal(JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean()), daily);
    assert.equal(await data.Audit.countDocuments({ ...data.base, action: 'STAGE1_PERIOD_SLICE_COMPLETED' }), 2);
});

test('independent: missing future context allows the complete active-period attestation', { skip: !uri || !vendor }, async t => {
    const data = await setup(t), scope = data.scopes[4];
    // Only this fixture's generated rows in the guarded disposable database.
    await data.D.collection.deleteMany({ ...data.base, hmeromhnia: { $gt: new Date('2026-09-30') } });
    const before = await data.fullSnapshot();
    const read = await data.read(scope);
    assert.equal(read.lifecycle_projection.history_pending, true);
    assert.equal(read.lifecycle_projection.all_results_documented, false);
    assert.equal(await data.fullSnapshot(), before);
    const daily = JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean());
    const completion = await data.bulk([scope]);
    assert.equal(completion.body.completed_count, 1, JSON.stringify(completion.body));
    assert.equal((await data.read(scope)).stage1_status, 'COMPLETED');
    assert.equal((await data.State.findOne(data.base).lean()).stage1.status, 'OPEN');
    assert.equal(await data.Audit.countDocuments(data.base), 1);
    assert.equal(JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean()), daily);
});

test('independent: single completion and replay preserve one audit; read-only roles cannot complete', { skip: !uri || !vendor }, async t => {
    const data = await setup(t), scope = data.scopes[2];
    const read = await data.read(scope);
    assert.equal(read.lifecycle_projection.stages.stage1.business_status, 'OPEN');
    const command = { ...scope, reason_or_notes: 'Ρητή ατομική συνθετική επιβεβαίωση',
        request_id: 'independent-single-replay' };
    const completed = await data.request('/complete', command);
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
    const snapshot = await data.fullSnapshot();
    const repeated = await data.request('/complete', command);
    assert.equal(repeated.status, 200, JSON.stringify(repeated.body));
    assert.equal(repeated.body.already_completed, true);
    // The period fence must still serialize replay against locking/finalizing.
    // Only its counter may advance; no daily, attestation or audit rewrite.
    const expectedReplay = JSON.parse(snapshot);
    const ownedPeriods = expectedReplay[data.Period.collection.name].filter(record =>
        record.company_kod === data.base.company_kod && record.ypokatasthma === data.base.ypokatasthma);
    assert.equal(ownedPeriods.length, 1);
    ownedPeriods[0].write_fence_version += 1;
    assert.deepEqual(JSON.parse(await data.fullSnapshot()), expectedReplay);
    assert.equal(await data.Audit.countDocuments(data.base), 1);
    data.session.userRole = 'E';
    const denied = await data.bulk([data.scopes[1]]);
    assert.equal(denied.status, 403, JSON.stringify(denied.body));
    assert.equal(denied.body.code, 'CRITICAL_EMPLOYMENT_DECISION_NOT_AUTHORIZED');
    assert.deepEqual(JSON.parse(await data.fullSnapshot()), expectedReplay);
});

test('independent Chromium: double-click submits one bulk request and instructions never write', { skip: !uri || !vendor }, async t => {
    const data = await setup(t);
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === data.origin ? route.continue() : route.abort());
    const requests = [];
    page.on('request', request => { if (request.url().endsWith('/stage1/bulk-complete')) requests.push(request); });
    const before = await data.fullSnapshot();
    await page.goto(data.origin + '/review');
    await page.waitForFunction(() => typeof loadResults === 'function');
    await page.evaluate(async () => {
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0039';
        await loadResults(); await loadPreparedWeeklyHrStage1();
        document.getElementById('employmentReviewStage1Collapse').classList.add('show');
    });
    assert.equal(await page.locator('#weeklyHrStage1SelectedCount').innerText(), '0');
    await page.locator('[data-guidance-stage="STAGE1"] [data-guidance-move="first"]').click();
    assert.equal(await page.locator('#employmentReviewGuidancePopover').isVisible(), false);
    await page.locator('.review-guidance-highlight [data-review-guidance-open]').first().click();
    assert.match(await page.locator('#employmentReviewGuidancePopover').innerText(), /εβδομαδιαία επιβεβαίωση/);
    await page.keyboard.press('Escape');
    assert.equal(await data.fullSnapshot(), before);
    await page.locator('.weekly-hr-select-all').click();
    await page.locator('.weekly-hr-bulk-complete').click();
    await page.locator('.swal2-cancel').click();
    await page.waitForFunction(() => !weeklyHrStage1BulkSubmitting && !Swal.isVisible());
    assert.equal(requests.length, 0);
    assert.equal(await data.fullSnapshot(), before, 'Cancelling confirmation must not write');
    await page.locator('.weekly-hr-bulk-complete').dblclick();
    assert.equal(requests.length, 0, 'Opening confirmation must not submit the action');
    assert.equal(await page.locator('.swal2-confirm').isVisible(), true,
        'The second click must not dismiss the confirmation as a backdrop click');
    assert.equal(await page.evaluate(() => weeklyHrStage1BulkSubmitting), true);
    const response = page.waitForResponse(r => r.url().endsWith('/stage1/bulk-complete'));
    await page.locator('.swal2-confirm').dblclick();
    const result = await (await response).json();
    assert.equal(result.completed_count, 5, JSON.stringify(result));
    assert.equal(requests.length, 1);
    assert.equal(await data.Audit.countDocuments(data.base), 5);
});
