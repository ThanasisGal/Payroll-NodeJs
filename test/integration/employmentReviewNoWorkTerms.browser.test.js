'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;

test('date-effective AN/ME agrees between Stage 1, search, Stage 2 preview and approved write', {
    skip: !uri || !vendor, timeout: 180000
}, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T12:00:00Z').getTime() });
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    for (const [name, code, days, classification, category] of [
        ['full', '0', 5, 'REST_REPO', 'ΑΝ'],
        ['part', '1', 5, 'REST_REPO', 'ΑΝ'],
        ['rotating', '2', 2, 'NON_WORK', 'ΜΕ'],
        ['intermittent', '1', 2, 'NON_WORK', 'ΜΕ']
    ]) await t.test(name, async () => {
        const caseUri = uri.replace(/\/payroll_period_employees_test_guidance_[a-z0-9_]+\?/,
            `/payroll_period_employees_test_guidance_anme_${name.slice(0, 3)}_${process.pid}?`);
        const data = await createStage1CompletionFixture(caseUri, vendor);
        const server = data.app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const origin = `http://127.0.0.1:${server.address().port}`;
        const context = await browser.newContext();
        await context.route('**/*', route => new URL(route.request().url()).origin === origin
            ? route.continue() : route.abort());
        try {
            const hours = code === '1' ? 4 : 8;
            const terms = { kathestos_apasxolhshs: code, typos_apasxolhshs: code,
                typos_ebdomadas: '5ΗΜΕΡΗ', hmeres_ergasias_ebdomadas: days,
                ores_ergasias_ebdomadas: days * hours, mo_oron_hmerhsias_ergasias: hours };
            // Today's master deliberately differs. The dated historical terms
            // must control both previews and the transactional writer.
            await data.E.updateOne({ _id: data.employee._id }, { $set: {
                kathestos_apasxolhshs: '2', typos_apasxolhshs: '2' } });
            // Keep complete, non-overlapping history around the September terms:
            // search also needs the boundary weeks' August and October days.
            await data.H.collection.updateOne({ _id: data.history._id }, { $set: {
                hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-08-31') } });
            await data.H.collection.insertOne({ ...data.history, _id: new mongoose.Types.ObjectId(),
                afora_proslhpsh: false,
                hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-10-01') });
            await data.H.collection.insertOne({ team: data.base.team,
                company_kod: data.base.company_kod, kodikos: '0039', ...terms,
                hmeromhnia_proslhpshs: data.employee.hmeromhnia_proslhpshs,
                afora_allagh_oron_ergasias: true,
                hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-09-01'),
                hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-09-30') });
            await data.D.updateMany({ ...data.base, kodikos: '0039', hmeromhnia:
                mongoose.trusted({ $gte: new Date('2026-09-07'), $lte: new Date('2026-09-11') }) },
            { $set: { kathgoria_ergasias: category, repo: category === 'ΑΝ',
                kathgoria_ergasias_apologistika: category, repo_apologistika: category === 'ΑΝ' } });
            const prefix = origin + '/api/prodhlomena-oraria/review';
            const request = async (route, body, status = 200) => {
                const response = await fetch(prefix + '/weekly-hr-workflow/' + route, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body) });
                const result = await response.json();
                assert.equal(response.status, status, JSON.stringify(result));
                return result;
            };
            const week = await (await fetch(prefix + '/weekly-hr-workflow/stage1?' +
                new URLSearchParams(data.scope))).json();
            assert.deepEqual(week.lifecycle_projection.stage1_no_classification_preview_items
                .map(item => item.classification), classification === 'REST_REPO'
                    ? [null, null] : [classification, classification]);
            assert.equal(week.lifecycle_projection.stages.stage1.business_status, 'OPEN');
            assert.deepEqual(week.lifecycle_projection.stages.stage3.stage2_automatic_resolution_items, []);
            const before = await data.D.find(data.base).sort({ hmeromhnia: 1 }).lean();
            assert.equal((await request('stage1/bulk-complete', { scopes: [data.scope],
                reason_or_notes: 'Έλεγχος συνθετικών ημερών χωρίς θετικό χαρακτηρισμό',
                bulk_request_id: `anme-stage1-${name}` })).completed_count, 1);
            assert.deepEqual(await data.D.find(data.base).sort({ hmeromhnia: 1 }).lean(), before);
            // Seed the existing successful-calculation precondition, only in
            // this isolated fixture. Production approval gates remain active.
            await data.Period.updateOne(data.base, { $set: { successful_calculation_version: 1,
                last_successful_calculation_id: 'synthetic-anme-calculation',
                last_successful_calculation_at: new Date('2026-09-30') } });

            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(origin + '/review');
            await page.waitForFunction(() => document.getElementById('ypokatasthma')
                .tomselect?._preselectDone);
            const searched = page.waitForResponse(response =>
                new URL(response.url()).pathname === '/api/prodhlomena-oraria/review');
            await page.evaluate(async () => {
                document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
                document.getElementById('kodikos').value = '0039';
                await loadResults();
            });
            const searchResponse = await searched;
            assert.equal(searchResponse.status(), 200, await searchResponse.text());
            const preview = await page.evaluate(() => currentWeeklyHrStage2BulkPreview);
            assert.ok(preview, 'successful search must provide the Stage 2 preview');
            if (classification === 'REST_REPO') {
                assert.equal(preview.safe_automatic_count, 0);
                assert.equal(preview.safe_day_change_count, 0);
                assert.equal(preview.manual_exception_count, 1);
                assert.equal(await page.locator('.weekly-hr-stage2-bulk-complete').isDisabled(), true);
                const fresh = await (await fetch(prefix + '/weekly-hr-workflow/stage1?' +
                    new URLSearchParams(data.scope))).json();
                assert.equal(fresh.lifecycle_projection.stages.stage3.pending_count, 2);
                assert.equal(fresh.lifecycle_projection.stages.stage2.business_status, 'OPEN');
                assert.equal(fresh.lifecycle_projection.stages.stage4.final_weekly_analysis_available, false);
                assert.deepEqual(await data.D.find(data.base).sort({ hmeromhnia: 1 }).lean(), before);
                assert.deepEqual(errors, []);
                return;
            }
            assert.equal(preview.safe_automatic_count, 1, JSON.stringify(preview));
            assert.equal(preview.technical_conflict_count, 0);
            assert.equal(preview.safe_day_change_count, 2);
            assert.equal(await page.locator('[data-workflow-stage="STAGE2"] .accordion-button')
                .isDisabled(), false);
            assert.equal(await page.locator('.weekly-hr-stage2-bulk-complete').isDisabled(), false);
            await page.locator('[data-workflow-stage="STAGE2"] .accordion-button').click();
            await page.locator('.weekly-hr-stage2-bulk-complete').click();
            await page.locator('#weeklyHrStage2BulkPreviewModal').waitFor({ state: 'visible' });
            const modal = await page.locator('#weeklyHrStage2BulkPreviewModal').innerText();
            assert.match(modal, category === 'ΑΝ' ? /Ρεπό|ΡΕΠΟ|ΑΝΑΠΑΥΣΗ/ : /Μη εργασία|ΜΗ ΕΡΓΑΣΙΑ/);
            // Merely opening either preview must not materialize a classification.
            assert.deepEqual(await data.D.find(data.base).sort({ hmeromhnia: 1 }).lean(), before);
            data.session.userRole = 'E';
            const command = { period_start: '2026-09-01', period_end: '2026-09-30',
                ypokatasthma: '0000', expected_preview_fingerprint: preview.preview_fingerprint,
                bulk_request_id: `anme-stage2-${name}`,
                reason_or_notes: 'Έλεγχος και έγκριση της προτεινόμενης τακτοποίησης' };
            await request('stage2/bulk-complete', command, 403);
            data.session.userRole = 'HR';
            assert.deepEqual(await data.D.find(data.base).sort({ hmeromhnia: 1 }).lean(), before);
            const result = await request('stage2/bulk-complete', command);
            assert.equal(result.applied, 1, JSON.stringify(result));
            const dates = ['2026-09-12', '2026-09-13'];
            const rows = await data.D.find({ ...data.base, hmeromhnia:
                mongoose.trusted({ $in: dates.map(date => new Date(date)) }) }).lean();
            for (const row of rows) {
                assert.equal(row.kathgoria_ergasias_apologistika, category);
                assert.equal(row.repo_apologistika, category === 'ΑΝ');
                assert.equal(row.kathgoria_adeias_apologistika, '');
                assert.equal(row.adeia_apologistika, false);
                assert.equal(row.apologistiko_biblio, true);
                assert.equal(row.is_locked, true);
            }
            await page.locator('#weeklyHrStage2BulkPreviewModal .btn-close').click();
            const settled = await data.snapshot();
            await page.evaluate(async () => { await loadResults(); await loadResults(); });
            assert.equal(await data.snapshot(), settled);
            assert.equal(await page.evaluate(() => currentWeeklyHrStage2BulkPreview.safe_automatic_count), 0);
            for (const date of dates) {
                const text = await page.locator(`.employee-detail-row[data-date="${date}"]`).textContent();
                assert.doesNotMatch(text, /ΠΙΘ\. ΑΔΕΙΑ/);
                assert.match(text, category === 'ΑΝ' ? /ΡΕΠΟ/ : /ΜΗ ΕΡΓΑΣΙΑ/);
            }
            const refreshed = await (await fetch(prefix + '/weekly-hr-workflow/stage1?' +
                new URLSearchParams(data.scope))).json();
            assert.equal(refreshed.stage1_status, 'COMPLETED');
            assert.deepEqual(refreshed.lifecycle_projection.stages.stage1.reviewed_possible_leave_dates, []);
            assert.deepEqual(errors, []);
            assert.equal(mongoose.get('sanitizeFilter'), true);
        } finally {
            await context.close();
            await new Promise(resolve => server.close(resolve));
            await mongoose.disconnect();
        }
    });
});
