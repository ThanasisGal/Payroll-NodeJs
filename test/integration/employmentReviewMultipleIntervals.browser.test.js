'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const { createStage1CompletionFixture } = require('../helpers/employmentReviewStage1CompletionApp');
const controller = require('../../server/controllers/ergazomenoi/erganhController');
const checkAuth = require('../../server/middlewares/checkValidUser');
const requireAccess = require('../../server/middlewares/requireUserPrivilegeForm')('ElegxosApasxolhseonPeriodoy');
const { requireCriticalEmploymentDecisionRole: hr } = require('../../server/services/ergazomenoi/apasxoliseisCriticalActionAuthorizationService');
const { RAW_CARD_FIELDS } = require('../../server/services/ergazomenoi/apasxoliseisOrphanResolutionPersistenceService');
const uri = process.env.PAYROLL_GUIDANCE_TEST_MONGO_URI;
const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
const work = (...pairs) => pairs.map(([start, end], index) => ({ pairNumber: index + 1, start, end }));
const two = work(['09:00', '13:00'], ['16:58', '20:58']);
const cards = row => Object.fromEntries(Object.keys(row).filter(key => key.startsWith('cards_')).map(key => [key, row[key]]));

test('multiple approved actual intervals survive real HTTP, MongoDB, reload and Chromium without changing cards', {
    skip: !uri || !vendor, timeout: 180000
}, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T12:00:00Z').getTime() });
    t.after(() => mongoose.disconnect());
    const data = await createStage1CompletionFixture(uri, vendor);
    const baseSnapshot = data.snapshot;
    data.snapshot = async () => JSON.stringify({ data: await baseSnapshot(),
        periods: await data.Period.find(data.base).lean() });
    const prefix = '/api/prodhlomena-oraria/review';
    data.app.post(prefix + '/:id/orphan-resolution/preview', checkAuth, requireAccess, hr,
        controller.previewProdhlomenaOrariaOrphanResolution);
    data.app.post(prefix + '/:id/daily-actual-work-resolution/preview', checkAuth, requireAccess, hr,
        controller.previewHrDailyActualWorkResolution);
    data.app.patch(prefix + '/:id', checkAuth, requireAccess, hr, controller.updateProdhlomenaOrariaReviewRecord);
    data.app.get(prefix + '/:id/audit', checkAuth, requireAccess, controller.getProdhlomenaOrariaReviewAudit);
    const employee = { ...data.employee, _id: new mongoose.Types.ObjectId(), kodikos: '0088',
        onoma: 'ΠΟΛΛΑΠΛΑ ΔΙΑΣΤΗΜΑΤΑ', kathestos_apasxolhshs: '0', typos_apasxolhshs: '0',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8, dialleima_se_lepta: 30 };
    await data.E.collection.insertOne(employee);
    const makeRow = async (date, raw = {}) => {
        const row = { ...data.rows[0], _id: new mongoose.Types.ObjectId(), employee_id: employee._id,
            kodikos: employee.kodikos, hmeromhnia: new Date(date), kathgoria_ergasias: 'ΕΡΓ',
            apo_ora_01: '09:00', eos_ora_01: '13:00', apo_ora_02: '17:00', eos_ora_02: '21:00',
            ores_ergasias: 8, kathgoria_ergasias_apologistika: '', apologistiko_biblio: false,
            cards_apo_ora_01: '16:58', cards_eos_ora_01: '', cards_ores_ergasias: 0,
            ...Object.fromEntries(['01', '02', '03'].flatMap(pair => [
                [`apo_ora_${pair}_apologistika`, ''], [`eos_ora_${pair}_apologistika`, '']])),
            ...raw };
        await data.D.collection.insertOne(row); return row;
    };
    const row = await makeRow('2026-09-23');
    const originalCards = cards(row);
    const server = data.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = async (route, body, status = 200, method = 'POST') => {
        const response = await fetch(origin + prefix + route, { method,
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual' });
        const text = await response.text();
        assert.equal(response.status, status, text);
        return text.startsWith('{') ? JSON.parse(text) : text;
    };
    const preview = (target, intervals) => request(`/${target._id}/orphan-resolution/preview`, { work_intervals: intervals });
    const approve = async (target, intervals, status = 200, fingerprint) => {
        const command = { approve: true, work_intervals: intervals, reuse_scope: 'ONE_TIME',
            risk_acknowledged: false,
            preview_fingerprint: fingerprint ?? (await preview(target, intervals)).preview_fingerprint };
        const body = { reason: 'Συνθετική τεκμηριωμένη επιβεβαίωση πραγματικής εργασίας από HR',
            updates: { cards_apo_ora_01: '00:00', cards_eos_ora_01: '23:59',
                apo_ora_01_apologistika: '00:01', ores_ergasias_apologistika: 999 },
            orphan_resolution: command };
        const result = await request(`/${target._id}`, body, status, 'PATCH');
        return { body, result };
    };
    const search = async () => {
        const response = await fetch(origin + prefix + '?' + new URLSearchParams({
            ypokatasthma: '0000', kodikos: employee.kodikos,
            apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30', limit: '10000' }));
        const payload = await response.json(); assert.equal(response.status, 200, JSON.stringify(payload));
        return payload.rows;
    };
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let savedBody;
    page.on('request', req => { if (req.method() === 'PATCH') savedBody = req.postDataJSON(); });
    await page.goto(origin + '/review');
    await page.waitForFunction(() => document.getElementById('ypokatasthma').tomselect?._preselectDone);
    await page.evaluate(async () => {
        document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
        document.getElementById('kodikos').value = '0088'; await loadResults();
    });
    await page.evaluate(target => showDetailsModal(target, { orphanResolution: true }), (await search()).find(item => item._id === String(row._id)));
    for (const interval of two) {
        await page.locator(`#edit_apo_ora_0${interval.pairNumber}_apologistika`).fill(interval.start);
        await page.locator(`#edit_eos_ora_0${interval.pairNumber}_apologistika`).fill(interval.end);
    }
    await page.locator('#edit_reason').fill('Επιβεβαιωμένη συνθετική εργασία χωρίς διαβίβαση καρτών');
    // Trigger the real debounced preview after all fields have been filled.
    await page.locator('#edit_eos_ora_02_apologistika').dispatchEvent('change');
    await page.waitForFunction(() => document.querySelector('#orphanCardResolutionSection')?.textContent.includes('8.00'));
    const artifactDir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
    for (const width of [1280, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('.apologistiko-section').scrollIntoViewIfNeeded();
        if (artifactDir) { fs.mkdirSync(artifactDir, { recursive: true }); await page.screenshot({
            path: path.join(artifactDir, `multiple-intervals-form-${width}.png`), animations: 'disabled' }); }
    }
    await page.locator('#orphanResolutionApprove').check();
    await page.locator('#saveRecordBtn').click();
    await page.getByText('Έγκριση πλήρους απολογιστικού ωραρίου', { exact: true }).waitFor();
    for (const width of [1280, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        if (artifactDir) { fs.mkdirSync(artifactDir, { recursive: true }); await page.screenshot({
            path: path.join(artifactDir, `multiple-intervals-approval-${width}.png`), fullPage: false, animations: 'disabled' }); }
        assert.match(await page.locator('.swal2-popup').innerText(), /09:00–13:00[\s\S]*16:58–20:58/);
    }
    await page.locator('.swal2-confirm').click();
    await page.getByText('Επιτυχία', { exact: true }).waitFor();
    await page.locator('.swal2-confirm').click();
    assert.deepEqual(savedBody.orphan_resolution.work_intervals, two);
    assert.match(savedBody.orphan_resolution.preview_fingerprint, /^[a-f0-9]{64}$/);
    const persisted = await data.D.findById(row._id).lean();
    assert.deepEqual(cards(persisted), originalCards);
    assert.deepEqual(persisted.orphan_card_resolution.approved_work_intervals, two);
    assert.equal(persisted.orphan_card_resolution.resolved_pairs[0].start, '16:58');
    assert.equal(persisted.ores_pragmatikhs_ergasias_apologistika, 8);
    assert.equal(persisted.ores_ergasias_apologistika, 8);
    assert.equal(persisted.ores_apoysias_apologistika, 0);
    assert.equal(persisted.is_locked, true);
    const readBack = (await search()).find(item => item._id === String(row._id));
    assert.equal(readBack.orphan_card_resolution_preview.eligible, true);
    assert.deepEqual(readBack.orphan_card_resolution_preview.approvedWorkIntervals, two);
    await page.evaluate(target => showDetailsModal(target), readBack);
    await page.locator('.approved-orphan-decision').waitFor();
    assert.match(await page.locator('.approved-orphan-decision').innerText(), /09:00–13:00[\s\S]*16:58–20:58/);
    assert.equal(await page.locator('#orphanResolutionApprove').count(), 0);
    await page.locator('#detailsModal').evaluate(node => bootstrap.Modal.getInstance(node).hide());
    for (const interval of two) {
        const pair = `0${interval.pairNumber}`;
        assert.equal(readBack[`apo_ora_${pair}_apologistika`], interval.start);
        assert.equal(readBack[`eos_ora_${pair}_apologistika`], interval.end);
    }
    assert.deepEqual(cards(readBack), originalCards);
    assert.equal(await data.DailyAudit.countDocuments({ prodhlomena_oraria_id: row._id }), 1);
    const audit = await data.DailyAudit.findOne({ prodhlomena_oraria_id: row._id }).lean();
    assert.equal(audit.reason, savedBody.reason); assert.equal(audit.changedBy, data.session.userName);
    assert.equal(Object.keys(audit.newValues).some(field => field.startsWith('cards_')), false);
    await page.reload();
    await page.waitForFunction(() => typeof renderReviewRows === 'function');
    for (const width of [1280, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(target => {
            document.getElementById('employmentReviewStage4Collapse').classList.add('show');
            renderReviewRows([target]);
            document.querySelector('#resultsTable .employee-group-row').click();
        }, readBack);
        const cell = page.locator('#resultsTable .employee-detail-row > td').nth(5);
        await cell.scrollIntoViewIfNeeded();
        assert.match(await cell.innerText(), /09:00 - 13:00[\s\S]*16:58 - 20:58[\s\S]*ΟΡΦΑΝΟ ΧΤΥΠΗΜΑ/);
        assert.match(await cell.locator('[title]').first().getAttribute('title'), /Εγκεκριμένος/);
        const fits = await cell.evaluate(node => [...node.querySelectorAll('.review-interval-line,.badge')].every(child => {
            const r = child.getBoundingClientRect(), c = node.getBoundingClientRect();
            return r.left >= c.left && r.right <= c.right + 1 && child.scrollWidth <= child.clientWidth + 1;
        }));
        assert.equal(fits, true);
        if (artifactDir) await page.screenshot({ path: path.join(artifactDir, `multiple-intervals-table-${width}.png`), fullPage: false });
    }
    const beforeRepeat = await baseSnapshot();
    const repeated = await request(`/${row._id}`, savedBody, 200, 'PATCH');
    assert.equal(repeated.code, 'ORPHAN_RESOLUTION_ALREADY_APPLIED');
    assert.equal(await baseSnapshot(), beforeRepeat);
    const beforeLockedChange = await data.snapshot();
    await approve(row, work(['09:00', '13:00'], ['16:58', '21:00']), 409);
    assert.equal(await data.snapshot(), beforeLockedChange);

    const three = work(['06:00', '08:00'], ['11:00', '13:00'], ['16:58', '20:58']);
    const threeRow = await makeRow('2026-09-21', { cards_apo_ora_02: '', cards_eos_ora_02: '08:00' });
    await approve(threeRow, three);
    const threeSaved = await data.D.findById(threeRow._id).lean();
    assert.deepEqual(threeSaved.orphan_card_resolution.approved_work_intervals, three);
    assert.equal(threeSaved.orphan_card_resolution.resolved_pairs.length, 2);
    assert.deepEqual(cards(threeSaved), cards(threeRow));
    assert.equal(threeSaved.ores_pragmatikhs_ergasias_apologistika, 8);
    assert.equal((await search()).find(item => item._id === String(threeRow._id)).eos_ora_03_apologistika, '20:58');
    const pending = await makeRow('2026-09-25');
    for (const intervals of [work(['09:00', '']), work(['09:00', '18:00'], ['16:58', '20:58']),
        work(['09:00', '14:00'], ['16:58', '20:58'])]) {
        const before = await data.snapshot();
        await request(`/${pending._id}/orphan-resolution/preview`, { work_intervals: intervals }, 409);
        assert.equal(await data.snapshot(), before);
    }
    const pendingPreview = await preview(pending, two);
    await data.D.updateOne({ _id: pending._id }, { $set: { eos_ora_02: '21:01' } });
    const staleSnapshot = await data.snapshot();
    await approve(pending, two, 409, pendingPreview.preview_fingerprint);
    assert.equal(await data.snapshot(), staleSnapshot);
    const freshPreview = await preview(pending, two);
    await data.D.updateOne({ _id: row._id }, { $set: { eos_ora_02_apologistika: '20:59' } });
    const contextStaleSnapshot = await data.snapshot();
    await approve(pending, two, 409, freshPreview.preview_fingerprint);
    assert.equal(await data.snapshot(), contextStaleSnapshot);
    await data.D.updateOne({ _id: row._id }, { $set: { eos_ora_02_apologistika: '20:58' } });
    for (const [field, value, status] of [['userRole', 'R', 403], ['userId', '', 401]]) {
        const before = await data.snapshot(); const previous = data.session[field]; data.session[field] = value;
        await request(`/${pending._id}`, { reason: 'Απαγορευμένη εγγραφή', orphan_resolution: { approve: true, work_intervals: two } }, status, 'PATCH');
        data.session[field] = previous; assert.equal(await data.snapshot(), before);
    }
    const plain = await makeRow('2026-09-26');
    await request(`/${plain._id}`, { reason: 'Απολογιστικό χωρίς έγκριση ορφανού', updates: {
        apo_ora_01_apologistika: '09:00', eos_ora_01_apologistika: '13:00',
        cards_apo_ora_01: '00:00', cards_eos_ora_01: '13:00' } }, 200, 'PATCH');
    const plainSaved = await data.D.findById(plain._id).lean();
    assert.deepEqual(cards(plainSaved), cards(plain)); assert.equal(plainSaved.orphan_card_resolution, undefined);
    const badge = await page.evaluate(target => renderApprovedOrphanAuditBadge(target), plainSaved);
    assert.match(badge, /ΟΡΦΑΝΟ ΧΤΥΠΗΜΑ/); assert.match(badge, /Εκκρεμεί/);
    const staleBadge = await page.evaluate(target => renderApprovedOrphanAuditBadge(target), {
        ...persisted, cards_apo_ora_01: '16:59' });
    assert.match(staleBadge, /Εκκρεμεί/);
    const single = await makeRow('2026-09-18', { cards_apo_ora_01: '', cards_eos_ora_01: '17:00',
        apo_ora_01: '09:00', eos_ora_01: '17:00', apo_ora_02: '', eos_ora_02: '' });
    await approve(single, work(['09:00', '17:00']));
    const singleSaved = await data.D.findById(single._id).lean();
    assert.deepEqual(cards(singleSaved), cards(single));
    assert.equal(singleSaved.eos_ora_01_apologistika, '17:00');
    assert.equal(singleSaved.apo_ora_02_apologistika, '');
    // No cards: use the existing daily HR decision, preserving its validation and absence policy.
    const noCards = await makeRow('2026-09-28', { cards_apo_ora_01: '' });
    const dailyCommand = { approve: true, source_case: 'HR_CORRECTED_ACTUAL_DAY',
        work_intervals: work(['09:00', '13:00'], ['17:00', '21:00']), emergency_hourly_leave_intervals: [], leave_category: '' };
    const dailyBody = { reason: 'Τεκμηριωμένη συνθετική εργασία χωρίς διαθέσιμες κάρτες', daily_actual_work_resolution: dailyCommand };
    const dailyPreview = await request(`/${noCards._id}/daily-actual-work-resolution/preview`, dailyBody);
    dailyCommand.preview_fingerprint = dailyPreview.preview.previewFingerprint;
    await request(`/${noCards._id}`, dailyBody, 200, 'PATCH');
    const noCardsSaved = await data.D.findById(noCards._id).lean();
    assert.deepEqual(cards(noCardsSaved), cards(noCards));
    assert.equal(noCardsSaved.ores_pragmatikhs_ergasias_apologistika, 8);
    assert.equal(noCardsSaved.ores_apoysias_apologistika, 0);
    for (const field of RAW_CARD_FIELDS) assert.equal(persisted[field], row[field]);
    assert.deepEqual(errors, []);
});
