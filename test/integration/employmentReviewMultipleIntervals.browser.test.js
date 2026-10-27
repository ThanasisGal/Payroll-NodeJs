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
    // The cloned employee needs its own verified history, with the full-time
    // terms and configured break used by this synthetic split-schedule case.
    const history = { ...data.history, _id: new mongoose.Types.ObjectId(), kodikos: employee.kodikos,
        kathestos_apasxolhshs: employee.kathestos_apasxolhshs,
        typos_apasxolhshs: employee.typos_apasxolhshs,
        hmeres_ergasias_ebdomadas: employee.hmeres_ergasias_ebdomadas,
        ores_ergasias_ebdomadas: employee.ores_ergasias_ebdomadas,
        mo_oron_hmerhsias_ergasias: employee.mo_oron_hmerhsias_ergasias,
        dialleima_se_lepta: employee.dialleima_se_lepta };
    await data.H.collection.insertOne(history);
    const makeRow = async (date, raw = {}) => {
        const row = { ...data.rows[0], _id: new mongoose.Types.ObjectId(), employee_id: employee._id,
            kodikos: employee.kodikos, hmeromhnia: new Date(date), kathgoria_ergasias: 'ΕΡΓ',
            apo_ora_01: '09:00', eos_ora_01: '13:00', apo_ora_02: '16:45', eos_ora_02: '20:45',
            ores_ergasias: 8, kathgoria_ergasias_apologistika: '', apologistiko_biblio: false,
            cards_apo_ora_01: '16:58', cards_eos_ora_01: '', cards_ores_ergasias: 0,
            ...Object.fromEntries(['01', '02', '03'].flatMap(pair => [
                [`apo_ora_${pair}_apologistika`, ''], [`eos_ora_${pair}_apologistika`, '']])),
            ...raw };
        await data.D.collection.insertOne(row); return row;
    };
    const row = await makeRow('2026-09-25', {
        apo_ora_01_apologistika: '09:00', eos_ora_01_apologistika: '13:00',
        // The real incident had a legacy approval for the wrong interval, not
        // an unapproved row. No full-day intervals or raw-card snapshot existed.
        orphan_card_resolution: { status: 'HR_APPROVED',
            policy_version: 'orphan-card-continuous:v1', orphan_type: 'START_ONLY',
            reuse_scope: 'ONE_TIME', raw_cards_preserved: true,
            approved_interval: { start: '09:00', end: '13:00', durationHours: 4 },
            resolved_pairs: [{ pairNumber: 1, orphanType: 'START_ONLY',
                start: '09:00', end: '13:00' }] } });
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
    await t.test('a real 25 September history gap preserves stored search but blocks preview and approval without writes', async () => {
        const savedRow = await data.D.findById(row._id).lean();
        const priorPreview = await preview(row, two);
        const continuation = { ...history, _id: new mongoose.Types.ObjectId(), afora_proslhpsh: false,
            hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-09-26') };
        await data.H.collection.updateOne({ _id: history._id }, { $set: {
            hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-09-24') } });
        await data.H.collection.insertOne(continuation);
        const before = await data.snapshot();
        try {
            for (const result of [
                await request(`/${row._id}/orphan-resolution/preview`, { work_intervals: two }, 409),
                (await approve(row, two, 409, priorPreview.preview_fingerprint)).result
            ]) {
                assert.equal(result.success, false);
                assert.equal(result.code, 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED');
                assert.match(result.message, /2026-09-25/);
            }
            const result = await request('?' + new URLSearchParams({ ypokatasthma: '0000', kodikos: employee.kodikos,
                apo_hmeromhnia: '2026-09-01', eos_hmeromhnia: '2026-09-30' }), undefined, 200, 'GET');
            assert.equal(result.success, true);
            assert.equal(result.source, 'STORED_DRAFT');
            assert.ok(result.read_warnings.some(warning => warning.code === 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED' &&
                warning.employee_kodikos === employee.kodikos));
            const stored = result.rows.find(item => item._id === String(row._id));
            assert.ok(stored, 'the saved row remains readable despite missing historical coverage');
            assert.equal(stored.ores_ergasias_apologistika, savedRow.ores_ergasias_apologistika);
            assert.deepEqual(stored.orphan_card_resolution, savedRow.orphan_card_resolution);
            assert.deepEqual(cards(stored), cards(savedRow));
            assert.equal(await data.snapshot(), before, 'a genuine history gap cannot authorize writes');
        } finally {
            await data.H.collection.deleteOne({ _id: continuation._id });
            await data.H.collection.updateOne({ _id: history._id }, { $unset: {
                hmeromhnia_isxyos_oron_ergasias_eos: '' } });
        }
    });
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
    const pendingRow = (await search()).find(item => item._id === String(row._id));
    assert.equal(pendingRow.orphan_card_resolution_preview.approvalCurrent, false);
    assert.equal(pendingRow.orphan_card_resolution_preview.reason, 'ORPHAN_PAIR_SET_MISMATCH');
    // Open through the same user-facing action as the real application.
    await page.locator('[data-bs-target="#employmentReviewStage1Collapse"]').click();
    await page.locator(`.weekly-hr-open-orphan[data-row-id="${row._id}"]`).first().click();
    assert.match(await page.locator('#orphanCardResolutionSection').innerText(),
        /ORPHAN_APPROVAL_EVIDENCE_MISMATCH/);
    const beforeEditing = await data.snapshot();
    const previewRequests = [];
    page.on('request', req => { if (req.url().endsWith('/orphan-resolution/preview'))
        previewRequests.push(req.postDataJSON()); });
    let releaseRejected, rejectedReady;
    const rejectedGate = new Promise(resolve => { releaseRejected = resolve; });
    const rejectedResponse = new Promise(resolve => { rejectedReady = resolve; });
    await page.route('**/orphan-resolution/preview', async route => {
        const response = await route.fetch();
        if (route.request().postDataJSON().work_intervals[1]?.start === '16:00') {
            assert.equal(response.status(), 409);
            assert.equal((await response.json()).code, 'ORPHAN_WORK_PUNCH_MISMATCH');
            rejectedReady(); await rejectedGate;
        }
        await route.fulfill({ response });
    });
    // A real intermediate value is rejected while the HR finishes editing the same field.
    await page.locator('#edit_apo_ora_02_apologistika').fill('16:00');
    await page.locator('#edit_eos_ora_02_apologistika').fill('20:58');
    await rejectedResponse;
    await page.locator('#edit_apo_ora_02_apologistika').fill('16:58');
    releaseRejected();
    await page.waitForFunction(() => document.querySelector('#orphanCardResolutionSection')?.textContent.includes('8.00'));
    assert.deepEqual(previewRequests.at(-1).work_intervals, two);
    assert.equal(await page.locator('#orphanResolutionApprove').isChecked(), false);
    assert.equal(await data.snapshot(), beforeEditing);
    await page.unroute('**/orphan-resolution/preview');
    assert.equal(await page.locator('.swal2-popup').count(), 0, 'stale rejection is ignored');
    const section = page.locator('#orphanCardResolutionSection');
    assert.match(await section.innerText(), /Αντίστοιχο απολογιστικό σκέλος 2:[\s\S]*16:58–20:58/);
    assert.match(await page.locator('.orphan-interval-without-cards').innerText(), /09:00–13:00/);

    // A current rejection removes approval and explains the actual service failure in place.
    await page.locator('#edit_eos_ora_01_apologistika').fill('18:00');
    await page.waitForFunction(() => document.querySelector('#orphanCardResolutionSection')?.textContent.includes('SPLIT_INTERVALS_OVERLAP'));
    assert.match(await section.innerText(), /τα διαστήματα εργασίας επικαλύπτονται/);
    assert.doesNotMatch(await section.innerText(), /Δεν είναι δυνατή ασφαλής αυτόματη πρόταση/);
    assert.equal(await page.locator('#orphanResolutionApprove').count(), 0);
    assert.equal(await data.snapshot(), beforeEditing);
    await page.locator('#edit_eos_ora_01_apologistika').fill('13:00');
    await page.locator('#orphanResolutionApprove').waitFor();

    // Deliver a real successful service response after a newer successful response.
    let releaseOld, oldReady, oldDelivered;
    const oldGate = new Promise(resolve => { releaseOld = resolve; });
    const oldResponse = new Promise(resolve => { oldReady = resolve; });
    const delivered = new Promise(resolve => { oldDelivered = resolve; });
    await page.route('**/orphan-resolution/preview', async route => {
        const response = await route.fetch();
        const old = route.request().postDataJSON().work_intervals[1]?.end === '20:59';
        if (old) { assert.equal(response.status(), 200); oldReady(); await oldGate; }
        await route.fulfill({ response });
        if (old) oldDelivered();
    });
    await page.locator('#edit_eos_ora_02_apologistika').fill('20:59');
    await oldResponse;
    await page.locator('#edit_eos_ora_02_apologistika').fill('20:58');
    await page.waitForFunction(() => document.querySelector('#orphanCardResolutionSection')?.textContent.includes('8.00'));
    releaseOld(); await delivered;
    await page.waitForTimeout(100);
    assert.match(await section.innerText(), /8.00 ώρες/);
    assert.doesNotMatch(await section.innerText(), /20:59/);
    await page.unroute('**/orphan-resolution/preview');
    assert.equal(await data.snapshot(), beforeEditing);
    await page.locator('#edit_reason').fill('Επιβεβαιωμένη συνθετική εργασία χωρίς διαβίβαση καρτών');
    const artifactDir = process.env.PAYROLL_VISUAL_ARTIFACT_DIR;
    for (const width of [1280, 1440]) {
        await page.setViewportSize({ width, height: width === 1280 ? 720 : 900 });
        await page.locator('#edit_eos_ora_02_apologistika').fill('');
        await page.waitForFunction(() => document.querySelector('#orphanCardResolutionSection')?.textContent.includes('περιμένει πλήρη διαστήματα'));
        assert.equal(await page.locator('#orphanResolutionApprove').count(), 0);
        await page.locator('#edit_eos_ora_02_apologistika').fill('20:58');
        await page.locator('#orphanResolutionApprove').waitFor();
        await section.scrollIntoViewIfNeeded();
        if (artifactDir) { fs.mkdirSync(artifactDir, { recursive: true }); await page.screenshot({
            path: path.join(artifactDir, `multiple-intervals-form-${width}.png`), animations: 'disabled' }); }
        await page.locator('#orphanResolutionApprove').scrollIntoViewIfNeeded();
        await page.locator('#orphanResolutionApprove').check();
        await page.locator('#orphanResolutionApprove').uncheck();
        await page.locator('#orphanResolutionScope').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('#orphanResolutionScope').inputValue(), 'ONE_TIME');
        assert.equal(await page.locator('#orphanResolutionScope option[value="FUTURE_IDENTICAL"]').isDisabled(), true);
        assert.equal(await section.evaluate(node => [...node.children].every(child => {
            const bounds = child.getBoundingClientRect(), section = node.getBoundingClientRect();
            return bounds.left >= section.left && bounds.right <= section.right + 1 &&
                child.scrollWidth <= child.clientWidth + 1;
        })), true);
        if (artifactDir) await page.screenshot({ path: path.join(artifactDir,
            `multiple-intervals-control-${width}.png`), animations: 'disabled' });
    }
    assert.equal(await data.snapshot(), beforeEditing);
    await page.locator('#saveRecordBtn').click();
    await page.getByText('Ρητή έγκριση ορφανού χτυπήματος', { exact: true }).waitFor();
    assert.equal(await data.snapshot(), beforeEditing);
    await page.locator('.swal2-confirm').click();
    await page.locator('#orphanResolutionApprove').check();
    await page.locator('#saveRecordBtn').click();
    await page.getByText('Έγκριση πλήρους απολογιστικού ωραρίου', { exact: true }).waitFor();
    for (const width of [1280, 1440]) {
        await page.setViewportSize({ width, height: width === 1280 ? 720 : 900 });
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
    assert.equal(readBack.orphan_card_resolution_preview.approvalCurrent, true);
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
    const lockedChange = await approve(row, work(['09:00', '13:00'], ['16:58', '21:00']), 409);
    assert.equal(lockedChange.result.code, 'EMPLOYMENT_REVIEW_RECORD_LOCKED');
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
    const pending = await makeRow('2026-09-23');
    for (const intervals of [work(['09:00', '']), work(['09:00', '18:00'], ['16:58', '20:58']),
        work(['09:00', '14:00'], ['16:58', '20:58'])]) {
        const before = await data.snapshot();
        await request(`/${pending._id}/orphan-resolution/preview`, { work_intervals: intervals }, 409);
        assert.equal(await data.snapshot(), before);
    }
    const pendingPreview = await preview(pending, two);
    const beforeNoApproval = await data.snapshot();
    const noApproval = await request(`/${pending._id}`, {
        reason: 'Αποθήκευση χωρίς ρητή έγκριση',
        orphan_resolution: { approve: false, work_intervals: two }
    }, 400, 'PATCH');
    assert.equal(noApproval.code, 'ORPHAN_RESOLUTION_EXPLICIT_APPROVAL_REQUIRED');
    assert.equal(await data.snapshot(), beforeNoApproval);
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
    const noCards = await makeRow('2026-09-28', { cards_apo_ora_01: '',
        apo_ora_02: '17:00', eos_ora_02: '21:00' });
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
