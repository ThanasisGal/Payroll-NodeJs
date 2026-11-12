'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;

test('five legacy weeks with recorded maternity sickness need weekly attestation, never reclassification', {
    skip: !uri || !vendor, timeout: 120000
}, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T12:00:00Z').getTime() });
    const data = await createStage1CompletionFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    const terms = { kathestos_apasxolhshs: '0', typos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
    await data.E.collection.updateOne({ _id: data.employee._id }, { $set: terms });
    await data.H.collection.updateOne({ _id: data.history._id }, { $set: terms });
    await data.H.collection.insertOne({ ...data.history, ...terms, _id: new mongoose.Types.ObjectId() });
    const { KathgoriesAdeiasModel } = require('../../server/models/stathera_arxeia');
    await KathgoriesAdeiasModel.collection.insertOne({ kodikos: 'SYNTHETIC-MATERNITY', perigrafh: 'Συνθετική άδεια μητρότητας' });
    for (const row of data.rows) {
        const rest = [0, 6].includes(row.hmeromhnia.getUTCDay());
        await data.D.collection.updateOne({ _id: row._id }, { $set: {
            kathgoria_ergasias: rest ? 'ΑΝ' : 'ΕΡΓ', repo: rest,
            kathgoria_ergasias_apologistika: rest ? 'ΑΝ' : 'ΑΣΘΕΝΕΙΑ', repo_apologistika: rest,
            adeia: !rest, kathgoria_adeias: rest ? '' : 'SYNTHETIC-MATERNITY',
            astheneia_apologistika: !rest, adeia_apologistika: false, kathgoria_adeias_apologistika: '',
            apousia_apologistika: false, ores_ergasias: rest ? 0 : 8,
            cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
            ores_ergasias_apologistika: 0, ores_pragmatikhs_ergasias_apologistika: 0
        } });
    }
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + '/review');
    await page.waitForFunction(() => typeof loadResults === 'function');
    const before = await data.snapshot();
    const payloads = await page.evaluate(async () => {
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0039';
        await loadResults(); await loadPreparedWeeklyHrStage1();
        document.getElementById('employmentReviewStage1Collapse').classList.add('show');
        return [...weeklyHrStage1Payloads.values()];
    });
    assert.equal(payloads.length, 5);
    for (const p of payloads) {
        assert.equal(p.stage1_status, 'OPEN');
        assert.ok(p.confirmed_sickness_dates.length > 0);
        assert.deepEqual(p.lifecycle_projection.stages.stage1.pending_reasons, ['STAGE1_WEEKLY_CONFIRMATION_REQUIRED']);
        assert.deepEqual(p.lifecycle_projection.stages.stage1.pending_dates, []);
        assert.deepEqual(p.lifecycle_projection.stages.stage1.blockers, []);
    }
    assert.equal(await page.locator('#weeklyHrStage1SelectedCount').innerText(), '0');
    await page.locator('[data-guidance-stage="STAGE1"] [data-guidance-move="first"]').click();
    assert.equal(await page.locator('#employmentReviewGuidancePopover').isVisible(), false);
    await page.locator('.review-guidance-highlight [data-review-guidance-open]').first().click();
    const text = await page.locator('#employmentReviewGuidancePopover').innerText();
    assert.match(text, /ΑΣΘΕΝΕΙΑ/);
    assert.match(text, /Συνθετική άδεια μητρότητας/);
    assert.match(text, /εβδομαδιαία επιβεβαίωση/);
    assert.match(text, /δεν απαιτείται επαναχαρακτηρισμός/);
    await page.keyboard.press('Escape');
    assert.equal(await data.snapshot(), before, 'Search and instructions write no daily decisions, confirmations or audits');
    const dailyBefore = JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean());
    await page.locator('.weekly-hr-select-all').click();
    assert.equal(await page.locator('#weeklyHrStage1SelectedCount').innerText(), '5');
    const response = page.waitForResponse(r => r.url().endsWith('/stage1/bulk-complete'));
    await page.locator('.weekly-hr-bulk-complete').click();
    assert.match(await page.locator('.swal2-textarea').inputValue(), /ήδη αποθηκευμένων χαρακτηρισμών/);
    await page.locator('.swal2-confirm').click();
    const result = await (await response).json();
    assert.equal(result.completed_count, 5, JSON.stringify(result));
    assert.equal(await data.Audit.countDocuments({ ...data.base, action: 'STAGE1_COMPLETED' }), 3);
    assert.equal(await data.Audit.countDocuments({ ...data.base, action: 'STAGE1_PERIOD_SLICE_COMPLETED' }), 2);
    assert.equal(JSON.stringify(await data.D.find(data.base).sort({ _id: 1 }).lean()), dailyBefore);
    const after = await page.evaluate(async () => {
        await loadResults(); await loadPreparedWeeklyHrStage1();
        return [...weeklyHrStage1Payloads.values()];
    });
    for (const p of after) {
        assert.equal(p.stage1_status, 'COMPLETED');
        assert.equal(p.lifecycle_projection.stages.stage1.pending_count, 0);
        assert.equal(p.lifecycle_projection.history_pending, true);
        assert.equal(p.lifecycle_projection.all_results_documented, false);
    }
});
