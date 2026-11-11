'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const { chromium } = require('playwright');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const controller = require('../../server/controllers/ergazomenoi/erganhController');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;

test('legacy history: normal Search, single/bulk Stage1, real conflicts, provisional terms and exports', {
    skip: !uri || !vendor, timeout: 120000
}, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T12:00:00Z').getTime() });
    const data = await createStage1CompletionFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    const legacy = { ...data.employee, _id: new mongoose.Types.ObjectId(), kodikos: '0015',
        onoma: 'ΣΥΝΘΕΤΙΚΟ ΙΣΤΟΡΙΚΟ', kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
    await data.E.collection.insertOne(legacy);
    const history = { ...data.history, kodikos: legacy.kodikos,
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        kathestos_apasxolhshs: '0', typos_apasxolhshs: '0' };
    await data.H.collection.insertMany([1, 2].map(() => ({ ...history, _id: new mongoose.Types.ObjectId() })));
    const rows = Array.from({ length: 7 }, (_, i) => ({ ...data.rows[0], _id: new mongoose.Types.ObjectId(),
        employee_id: legacy._id, kodikos: legacy.kodikos, hmeromhnia: new Date(Date.UTC(2026, 8, 7 + i)),
        kathgoria_ergasias: i < 5 ? 'ΕΡΓ' : 'ΑΝ', repo: i >= 5,
        kathgoria_ergasias_apologistika: i < 5 ? 'ΕΡΓ' : 'ΑΝ', repo_apologistika: i >= 5,
        kathgoria_adeias_apologistika: '', adeia_apologistika: false,
        apo_ora_01: i < 5 ? '08:00' : '', eos_ora_01: i < 5 ? '16:00' : '',
        cards_apo_ora_01: i < 5 ? '08:00' : '', cards_eos_ora_01: i < 5 ? '16:00' : '',
        ores_ergasias: i < 5 ? 8 : 0, cards_ores_ergasias: i < 5 ? 8 : 0,
        ores_ergasias_apologistika: i < 5 ? 8 : 0, ores_pragmatikhs_ergasias_apologistika: i < 5 ? 8 : 0 }));
    await data.D.collection.insertMany(rows);
    const prefix = '/api/prodhlomena-oraria/review';
    data.app.get(prefix + '/export-excel', controller.exportProdhlomenaOrariaReviewExcel);
    data.app.get(prefix + '/export-pdf', controller.exportProdhlomenaOrariaReviewPdf);
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const params = new URLSearchParams({ apo_hmeromhnia: '2026-09-07', eos_hmeromhnia: '2026-09-13', ypokatasthma: '0000' });
    const request = async (path, body) => {
        const r = await fetch(origin + prefix + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
        assert.equal(r.status, 200, await r.clone().text()); return r;
    };
    const read = async () => {
        const search = await (await request('?' + params)).json();
        assert.notEqual(search.source, 'STORED_DRAFT');
        assert.equal(search.read_warnings.length, 1);
        assert.equal(search.read_warnings[0].employee_kodikos, '0015');
        const scopes = [data.employee, legacy].map(employee => ({ ...data.scope,
            employee_id: String(employee._id), employee_kodikos: employee.kodikos }));
        const bulk = await (await request('/weekly-hr-workflow/stage1/bulk-review', { ypokatasthma: '0000', scopes })).json();
        assert.equal(bulk.payloads.length, 2);
        for (const scope of scopes) {
            const single = await (await request('/weekly-hr-workflow/stage1?' + new URLSearchParams(scope))).json();
            const matching = bulk.payloads.find(p => p.scope.employee_kodikos === scope.employee_kodikos);
            assert.equal(single.write_enabled, true);
            assert.equal(matching.write_enabled, true);
            assert.deepEqual(single.workflow.blocking_reasons, matching.workflow.blocking_reasons);
            assert.equal(single.read_warnings.length, scope.employee_kodikos === '0015' ? 1 : 0);
        }
        return { search, bulk };
    };
    const before = await data.snapshot();
    const { search, bulk } = await read();
    const assumed = bulk.payloads.find(p => p.scope.employee_kodikos === '0015');
    assert.ok(!assumed.workflow.blocking_reasons.includes('CATEGORY_REPO_CONFLICT'));
    assert.equal(assumed.lifecycle_projection.history_pending, true);
    assert.equal(assumed.lifecycle_projection.all_results_documented, false);
    for (const row of search.rows.filter(r => r.kodikos === '0015')) {
        assert.equal(row.history_terms_unavailable, true);
        assert.equal(row.legacy_fallback_status, 'LEGACY_FALLBACK_ASSUMED');
        assert.equal(row.assumed_work_terms.hmeres_ergasias_ebdomadas, 5);
        assert.equal(row.effective_hourly_rate, null);
        assert.ok(row.unavailable_financial_fields.includes('pragmatikoOromisthio'));
        assert.equal(row.effective_profile_employee_id, String(legacy._id));
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await (await request('/export-excel?' + params)).arrayBuffer()));
    assert.ok(workbook.worksheets.length);
    const pdf = Buffer.from(await (await request('/export-pdf?' + params)).arrayBuffer());
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    assert.equal(await data.snapshot(), before, 'all read paths preserve rows, states and audits');
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const page = await browser.newPage();
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + '/review');
    await page.waitForFunction(() => typeof loadResults === 'function');
    const ui = await page.evaluate(async () => {
        document.getElementById('apo_hmeromhnia').value = '2026-09-07';
        document.getElementById('eos_hmeromhnia').value = '2026-09-13';
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        await loadResults(); await loadPreparedWeeklyHrStage1();
        return [...weeklyHrStage1Payloads.values()].map(p => ({ code: p.scope.employee_kodikos, write: p.write_enabled }));
    });
    assert.ok(ui.some(p => p.code === '0015' && p.write));
    assert.ok(ui.some(p => p.code === '0039' && p.write));
    await page.close();
    await data.D.updateOne({ _id: rows[5]._id }, { $set: { kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: true } });
    const conflict = await read();
    assert.ok(conflict.bulk.payloads.find(p => p.scope.employee_kodikos === '0015').workflow.blocking_reasons.includes('CATEGORY_REPO_CONFLICT'));
    const cleanBefore = bulk.payloads.find(p => p.scope.employee_kodikos === '0039');
    assert.deepEqual(conflict.bulk.payloads.find(p => p.scope.employee_kodikos === '0039'), cleanBefore);
});
