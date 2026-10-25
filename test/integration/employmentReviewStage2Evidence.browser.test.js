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
const key = value => new Date(value).toISOString().slice(0, 10);

test('Stage 2 requires evidence and explicit bounded HR decisions through production HTTP, transactions and Chromium', {
    skip: !uri || !vendor, timeout: 180000
}, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T12:00:00Z').getTime() });
    const data = await createStage1CompletionFixture(uri, vendor);
    t.after(() => mongoose.disconnect());
    const terms = { kathestos_apasxolhshs: '0', typos_apasxolhshs: '0', typos_ebdomadas: '5ΗΜΕΡΗ',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
    const employees = [];
    for (const code of ['0009', '0011', '0014']) {
        const employee = { ...data.employee, ...terms, _id: new mongoose.Types.ObjectId(),
            kodikos: code, eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: `ΕΡΓΑΖΟΜΕΝΟΣ ${code}` };
        await data.E.collection.insertOne(employee); employees.push(employee);
        // Each cloned employee needs its own verified terms for the complete
        // natural weeks, including 31 August and the October boundary days.
        await data.H.collection.insertOne({ ...data.history, ...terms,
            _id: new mongoose.Types.ObjectId(), kodikos: code });
        const records = data.rows.map(source => {
            const date = key(source.hmeromhnia);
            const firstWeek = date <= '2026-09-06';
            const possible = firstWeek && (date === '2026-09-06' ||
                date === '2026-09-05' && code !== '0014');
            const rest = firstWeek ? code !== '0009' && date === '2026-09-01'
                : [0, 6].includes(source.hmeromhnia.getUTCDay());
            return { ...source, _id: new mongoose.Types.ObjectId(), employee_id: employee._id,
                kodikos: code, kathgoria_ergasias: rest ? 'ΑΝ' : 'ΕΡΓ', repo: rest,
                apo_ora_01: rest ? '' : '09:00', eos_ora_01: rest ? '' : '17:00', ores_ergasias: rest ? 0 : 8,
                cards_apo_ora_01: rest || possible ? '' : '09:00',
                cards_eos_ora_01: rest || possible ? '' : '17:00',
                cards_ores_ergasias: rest || possible ? 0 : 8,
                ores_ergasias_apologistika: rest || possible ? 0 : 8,
                kathgoria_ergasias_apologistika: rest ? 'ΑΝ' : possible ? '' : 'ΕΡΓ',
                repo_apologistika: false, kathgoria_adeias_apologistika: possible ? 'POSSIBLE_LEAVE' : '',
                apologistiko_biblio: !rest && !possible };
        });
        await data.D.collection.insertMany(records);
    }
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const prefix = origin + '/api/prodhlomena-oraria/review';
    const read = async route => {
        const before = await data.snapshot();
        const response = await fetch(prefix + route); const result = await response.json();
        assert.equal(response.status, 200, JSON.stringify(result));
        assert.equal(await data.snapshot(), before, 'reads never write'); return result;
    };
    const post = async (route, body, status = 200) => {
        const response = await fetch(prefix + '/weekly-hr-workflow/' + route, { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result;
    };
    const scopeFor = employee => ({ ypokatasthma: '0000', employee_id: String(employee._id),
        week_start: '2026-08-31', week_end: '2026-09-06', period_start: '2026-09-01', period_end: '2026-09-30' });
    const week = employee => read('/weekly-hr-workflow/stage1?' + new URLSearchParams(scopeFor(employee)));
    const search = employee => read('?' + new URLSearchParams({ ypokatasthma: '0000', kodikos: employee.kodikos,
        apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30', limit: '10000' }));
    await t.test('a real 31 August history gap still blocks completion without writes', async () => {
        const historyScope = { team: data.base.team, company_kod: data.base.company_kod,
            kodikos: employees[0].kodikos };
        await data.H.collection.updateOne(historyScope, { $set: {
            hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-09-01') } });
        const before = await data.snapshot();
        try {
            const result = await post('stage1/bulk-complete', { scopes: [scopeFor(employees[0])],
                reason_or_notes: 'Συνθετικός έλεγχος πραγματικού κενού Ιστορικού',
                bulk_request_id: 'stage2-evidence-history-gap' });
            assert.equal(result.completed_count, 0, JSON.stringify(result));
            assert.equal(result.failed_count, 1);
            assert.equal(result.results[0].code, 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED');
            assert.match(result.results[0].message, /2026-08-31/);
            assert.equal(await data.snapshot(), before, 'missing history cannot authorize writes');
        } finally {
            await data.H.collection.updateOne(historyScope, { $set: {
                hmeromhnia_isxyos_oron_ergasias_apo: data.history.hmeromhnia_isxyos_oron_ergasias_apo } });
        }
    });
    for (const employee of employees) {
        const result = await post('stage1/bulk-complete', { scopes: [scopeFor(employee)],
            reason_or_notes: 'Συνθετική εξέταση αδειών, χωρίς επιβεβαίωση ρεπό',
            bulk_request_id: `stage2-evidence-stage1-${employee.kodikos}` });
        assert.equal(result.completed_count, 1, JSON.stringify(result));
    }
    await data.Period.updateOne(data.base, { $set: { successful_calculation_version: 1,
        last_successful_calculation_id: 'synthetic-evidence-calculation',
        last_successful_calculation_at: new Date('2026-09-30') } });
    for (const [index, expected] of [[0, [2, 0, 2, 2]], [1, [2, 1, 1, 2]], [2, [2, 1, 1, 1]]]) {
        const payload = await week(employees[index]); const stages = payload.lifecycle_projection.stages;
        const evidence = stages.stage2.rest_evidence;
        assert.deepEqual([evidence.required_count, evidence.recognized_count, evidence.missing_count,
            evidence.candidate_dates.length], expected);
        assert.equal(stages.stage2.business_status, 'OPEN');
        assert.equal(stages.stage3.business_status, 'OPEN');
        assert.equal(stages.stage3.enabled, true);
        assert.equal(stages.stage4.final_weekly_analysis_available, false);
        assert.deepEqual(stages.stage3.stage2_automatic_resolution_items, []);
        const preview = (await search(employees[index])).stage2BulkPreview;
        assert.equal(preview.safe_day_change_count, 0);
        assert.equal(preview.safe_automatic_count, 0);
        assert.equal(preview.manual_exception_count, 1);
        assert.equal(preview.exceptions[0].resolution_route, 'STAGE3_HUMAN_DECISION');
    }
    const e = employees[1];
    const itemFor = async (employee, date) => (await week(employee)).lifecycle_projection.stages.stage3
        .pending_items.find(item => item.date === date);
    const commandFor = async (employee, date, classification, requestId) => {
        const item = await itemFor(employee, date);
        return { ...scopeFor(employee), row_id: item.row_id, decision_date: item.date,
            expected_input_fingerprint: item.input_fingerprint, expected_stage3_version: item.expected_stage3_version,
            final_classification: classification, request_id: requestId,
            reason_or_notes: 'Ρητή συνθετική επιβεβαίωση της πραγματικής ημερήσιας κατάστασης' };
    };
    const bulkFor = async (dates, employee = e) => ({ ypokatasthma: '0000', period_start: '2026-09-01', period_end: '2026-09-30',
        final_classification: 'REST_REPO', items: await Promise.all(dates.map(async date => {
            const command = await commandFor(employee, date, 'REST_REPO', 'unused-id');
            const { final_classification, reason_or_notes, request_id, period_start, period_end,
                ypokatasthma, ...item } = command; return item;
        })) });
    const tooMany = await post('stage3/bulk-preview', await bulkFor(['2026-09-05', '2026-09-06']));
    assert.equal(tooMany.can_apply, false, JSON.stringify(tooMany));
    assert.ok(tooMany.invalid_items.some(item => item.code === 'WEEKLY_REST_DECISION_NOT_ALLOWED'));
    const single = await bulkFor(['2026-09-05']);
    const valid = await post('stage3/bulk-preview', single);
    assert.equal(valid.can_apply, true, JSON.stringify(valid)); assert.equal(valid.will_apply_count, 1);
    // Change a different day after preview: whole-week attestation must fence the command.
    const target = await data.D.findOne({ ...data.base, kodikos: e.kodikos, hmeromhnia: new Date('2026-09-05') }).lean();
    await data.D.updateOne({ _id: target._id }, { $set: { apousia_apologistika: true } });
    const beforeStale = await data.snapshot();
    await post('stage3/bulk-apply', { ...single, expected_preview_fingerprint: valid.preview_fingerprint,
        bulk_request_id: 'stage2-evidence-stale', reason_or_notes: 'Δεν πρέπει να εφαρμοστεί' }, 409);
    assert.equal(await data.snapshot(), beforeStale);
    await data.D.updateOne({ _id: target._id }, { $set: { apousia_apologistika: false } });
    const refresh = await week(e);
    await post('stage1/bulk-complete', { scopes: [scopeFor(e)],
        reason_or_notes: 'Νέα συνθετική εξέταση μετά τη μεταβολή', bulk_request_id: 'stage2-evidence-stage1-refresh' });
    // Two simultaneous human decisions cannot consume the same last rest twice.
    const commands = await Promise.all(['2026-09-05', '2026-09-06'].map((date, i) =>
        commandFor(e, date, 'REST_REPO', `stage2-evidence-race-${i}`)));
    const race = await Promise.all(commands.map(body => fetch(prefix + '/weekly-hr-workflow/stage3/resolve-day', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })));
    assert.deepEqual(race.map(response => response.status).sort(), [200, 409]);
    const afterRace = await week(e); const stages = afterRace.lifecycle_projection.stages;
    assert.equal(stages.stage3.pending_count, 1); assert.equal(stages.stage2.business_status, 'OPEN');
    assert.equal(stages.stage4.final_weekly_analysis_available, false);
    const remaining = stages.stage3.pending_items[0];
    assert.ok(!remaining.allowed_classifications.includes('REST_REPO'));
    const beforeDenied = await data.snapshot();
    await post('stage3/resolve-day', await commandFor(e, remaining.date, 'REST_REPO', 'stage2-evidence-excess'), 409);
    assert.equal(await data.snapshot(), beforeDenied);
    await post('stage3/resolve-day', await commandFor(e, remaining.date, 'ABSENCE', 'stage2-evidence-absence'));
    const settled = (await week(e)).lifecycle_projection.stages;
    assert.equal(settled.stage2.business_status, 'COMPLETED'); assert.equal(settled.stage3.business_status, 'COMPLETED');
    assert.equal(settled.stage4.upstream_stages_completed, true);
    assert.equal(await data.Audit.countDocuments({ ...data.base, employee_id: e._id,
        final_classification: 'REST_REPO' }), 1);
    // A repeated old command must not write twice.
    const beforeRepeat = await data.snapshot();
    const repeat = await fetch(prefix + '/weekly-hr-workflow/stage3/resolve-day', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(commands[0]) });
    assert.equal(repeat.status, 409); assert.equal(await data.snapshot(), beforeRepeat);
    // Strict scope isolation: identical dates/codes in another company or branch
    // can neither enter this preview nor receive this company's decision.
    const scopedCommand = await commandFor(employees[0], '2026-09-05', 'REST_REPO', 'stage2-foreign-scope');
    const foreignRows = [];
    for (const changedScope of [{ company_kod: String(data.otherCompany) }, { ypokatasthma: '0001' }]) {
        const foreignEmployee = { ...employees[0], ...changedScope, _id: new mongoose.Types.ObjectId() };
        await data.E.collection.insertOne(foreignEmployee);
        const foreignRow = { ...await data.D.findById(scopedCommand.row_id).lean(), ...changedScope,
            _id: new mongoose.Types.ObjectId(), employee_id: foreignEmployee._id };
        await data.D.collection.insertOne(foreignRow); foreignRows.push(foreignRow);
        await post('stage3/resolve-day', { ...scopedCommand, employee_id: String(foreignEmployee._id),
            row_id: String(foreignRow._id) }, 404);
    }
    const isolated = await search(employees[0]);
    for (const foreignRow of foreignRows) {
        assert.equal(JSON.stringify(isolated).includes(String(foreignRow._id)), false);
        assert.deepEqual(await data.D.findById(foreignRow._id).lean(), foreignRow);
    }
    // Real browser, production scripts and styles. No remote requests or writes.
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).origin === origin
        ? route.continue() : route.abort());
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    await page.goto(origin + '/review');
    await page.waitForFunction(() => document.getElementById('ypokatasthma').tomselect?._preselectDone);
    await page.evaluate(async () => {
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0009'; await loadResults();
    });
    const beforeBrowser = await data.snapshot();
    for (const width of [1280, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => document.getElementById('employmentReviewStage2Collapse').classList.add('show'));
        await page.locator('.employment-review-stage2-bulk details').first().evaluate(node => node.open = true);
        assert.equal(await page.locator('.weekly-hr-stage2-bulk-complete').isDisabled(), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        const dir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
        if (dir) { fs.mkdirSync(dir, { recursive: true }); await page.screenshot({
            path: path.join(dir, `stage2-evidence-${width}.png`), fullPage: true, animations: 'disabled' }); }
        const info = page.locator('.weekly-hr-stage2-exception [data-review-guidance-open]').first();
        await info.hover();
        const explanation = page.locator('#employmentReviewGuidancePopover');
        assert.equal(await explanation.isVisible(), false, 'hover alone does not open instructions');
        await info.click();
        await explanation.waitFor({ state: 'visible' });
        const explanationBox = await explanation.boundingBox();
        await page.mouse.move(explanationBox.x + 20, explanationBox.y + 20);
        assert.match(await explanation.innerText(), /ανάπαυση|αναπαύσεων/);
        assert.match(await explanation.innerText(), /Ελλείπουσες: 2/);
        assert.match(await explanation.innerText(), /δεν αποδεικνύει ανάπαυση/);
        const explanationGeometry = await explanation.evaluate(node => {
            const popup = node.getBoundingClientRect();
            const details = node.querySelector('.review-guidance-detail').getBoundingClientRect();
            const close = node.querySelector('[data-review-guidance-close]').getBoundingClientRect();
            return { left: popup.left, right: popup.right, top: popup.top, bottom: popup.bottom,
                viewportWidth: innerWidth, viewportHeight: innerHeight,
                closeTop: close.top, closeBottom: close.bottom, contentBottom: details.bottom };
        });
        assert.ok(explanationGeometry.left >= 9 && explanationGeometry.right <= width - 9 &&
            explanationGeometry.top >= 9 && explanationGeometry.bottom <= explanationGeometry.viewportHeight - 9,
        JSON.stringify(explanationGeometry));
        assert.ok(explanationGeometry.closeTop >= explanationGeometry.contentBottom - 1 &&
            explanationGeometry.closeBottom <= explanationGeometry.bottom, JSON.stringify(explanationGeometry));
        if (dir) await page.screenshot({ path: path.join(dir, `stage2-explanation-${width}.png`),
            fullPage: false, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await page.locator('.weekly-hr-stage2-exception-review').click();
        await page.locator('#employmentReviewStage3Collapse').waitFor({ state: 'visible' });
        await page.waitForFunction(() => document.getElementById('employmentReviewStage3Collapse')
            .classList.contains('show'));
        await page.locator('.stage3-week-group').first().scrollIntoViewIfNeeded();
        const wrapper = page.locator('.stage3-decisions-table-wrapper').first();
        const geometry = await wrapper.evaluate(node => ({
            width: node.clientWidth, scroll: node.scrollWidth,
            table: node.firstElementChild.getBoundingClientRect().width,
            overflow: getComputedStyle(node).overflowX,
            minimum: (node.querySelector('option[value="REST_REPO"]') ? 64 : 61) *
                parseFloat(getComputedStyle(document.documentElement).fontSize),
            pageOverflow: document.documentElement.scrollWidth - innerWidth
        }));
        assert.ok(geometry.table >= geometry.minimum - 1, JSON.stringify(geometry));
        assert.equal(geometry.overflow, 'auto', JSON.stringify(geometry));
        assert.equal(geometry.scroll > geometry.width + 1,
            geometry.table > geometry.width + 1, JSON.stringify(geometry));
        assert.ok(geometry.pageOverflow <= 1, JSON.stringify(geometry));
        if (dir) await page.screenshot({ path: path.join(dir, `stage2-daily-decisions-${width}.png`),
            fullPage: true, animations: 'disabled' });
        const button = page.locator('.weekly-hr-stage3-resolve').first();
        // Scrolling/resizing may move this button under the existing pointer.
        // Measure the normal state only after explicitly leaving hover/focus.
        await button.scrollIntoViewIfNeeded();
        await page.mouse.move(1, 1);
        await button.evaluate(node => node.blur());
        await page.waitForFunction(() => {
            const node = document.querySelector('.weekly-hr-stage3-resolve');
            return !node.matches(':hover, :focus') && !node.getAnimations().length;
        });
        const normal = await button.evaluate(node => ({ background: getComputedStyle(node).backgroundColor,
            radius: parseFloat(getComputedStyle(node).borderRadius), whiteSpace: getComputedStyle(node).whiteSpace,
            clipped: node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1 }));
        await button.hover();
        await page.waitForFunction(color => getComputedStyle(document.querySelector(
            '.weekly-hr-stage3-resolve')).backgroundColor !== color, normal.background);
        const hovered = await button.evaluate(node => getComputedStyle(node).backgroundColor);
        assert.notEqual(normal.background, hovered);
        assert.ok(normal.radius >= 5 && normal.radius <= 7);
        assert.equal(normal.whiteSpace, 'normal');
        assert.equal(normal.clipped, false, JSON.stringify(normal));
        const select = page.locator('.weekly-hr-stage3-classification').first();
        await select.selectOption('REST_REPO');
        await page.locator('.weekly-hr-stage3-resolve').first().click();
        await page.locator('.swal2-popup').waitFor({ state: 'visible' });
        assert.match(await page.locator('.swal2-popup').innerText(), /επιβεβαίωση προσωπικού/);
        if (dir) await page.screenshot({ path: path.join(dir, `stage2-human-preview-${width}.png`),
            fullPage: true, animations: 'disabled' });
        await page.locator('.swal2-cancel').click();
    }
    assert.equal(await data.snapshot(), beforeBrowser); assert.deepEqual(errors, []);
    // Explicit batch confirmation remains available when every selected rest
    // fits the deficit; preview, apply and duplicate apply use the same rule.
    const safeCommand = await bulkFor(['2026-09-05', '2026-09-06'], employees[0]);
    const safePreview = await post('stage3/bulk-preview', safeCommand);
    assert.equal(safePreview.can_apply, true, JSON.stringify(safePreview));
    assert.equal(safePreview.will_apply_count, 2);
    const applyCommand = { ...safeCommand, expected_preview_fingerprint: safePreview.preview_fingerprint,
        bulk_request_id: 'stage2-evidence-explicit-batch',
        reason_or_notes: 'Ρητή συνθετική επιβεβαίωση και των δύο αναπαύσεων από τον υπεύθυνο' };
    const appliedBatch = await post('stage3/bulk-apply', applyCommand);
    assert.equal(appliedBatch.applied_count, 2, JSON.stringify(appliedBatch));
    const afterBatch = await data.snapshot();
    const repeatedBatch = await post('stage3/bulk-apply', applyCommand);
    assert.equal(repeatedBatch.idempotent, true, JSON.stringify(repeatedBatch));
    assert.equal(await data.snapshot(), afterBatch);
    const finalStages = (await week(employees[0])).lifecycle_projection.stages;
    assert.equal(finalStages.stage2.business_status, 'COMPLETED');
    assert.equal(finalStages.stage3.business_status, 'COMPLETED');
    for (const foreignRow of foreignRows) assert.deepEqual(await data.D.findById(foreignRow._id).lean(), foreignRow);
});
