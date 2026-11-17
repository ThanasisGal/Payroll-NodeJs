'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const mongoose = require('mongoose');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const F = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { createEmployeeHistoryApprovedProposalService: create } = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const Profile = require('../../server/utils/ergazomenoi/employmentProfileContract');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const approve = (proposal, preview) => ({ proposal, approval: { token: preview.approval.token, confirmed: true },
    certification: { token: preview.certificationApproval.token, confirmed: true } });
const values = { nomimosMisthos: '1456.78', [Profile.ENABLED]: '1', [Profile.TYPE]: 'OTHER_APPROVED_ARRANGEMENT', [Profile.FROM]: '2026-01-02', [Profile.DAYS]: [] };
const legacy = async db => {
    const f = await F.seedApprovedProposal(db);
    await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $unset: { [Profile.SCHEMA_VERSION]: 1 } });
    return f;
};

test('Επιλεγμένη πιστοποίηση: απομονωμένη MongoDB, ακριβές προφίλ και πλήρης προστασία', { skip: !binary, timeout: 120000 }, async t => {
    const db = await F.startApprovedProposalMongo(binary); t.after(db.close);
    console.log(`Απομονωμένη πιστοποίηση: ${db.folder}`);
    assert.equal(mongoose.connection.readyState, 0);
    for (const state of ['absent', 'null', 'empty']) await t.test(`Ρητά ανενεργή ρύθμιση, ημέρες ${state}: μόνο η εγκεκριμένη διόρθωση`, async () => {
        const f = await legacy(db);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, state === 'absent' ?
            { $unset: { [Profile.DAYS]: 1, [Profile.TYPE_VERSION]: 1 } } :
            { $set: { [Profile.DAYS]: state === 'null' ? null : [] }, $unset: { [Profile.TYPE_VERSION]: 1 } });
        const proposal = await F.approvedProposalBody(f, { values: { nomimosMisthos: '1456.78', [Profile.DAYS]: [] } });
        const before = await f.input(), service = create(f.dependencies), preview = await service.preview(f.req, proposal);
        assert.equal(preview.certification, null); assert.equal(preview.executionEnabled, true);
        assert.deepEqual(preview.rows.map(row => row.fieldId), ['nomimosMisthos']);
        await service.apply(f.req, { proposal, approval: { token: preview.approval.token, confirmed: true } });
        const after = await f.input(), old = before.completeHistoryRows.find(row => String(row._id) === String(f.history[0]._id));
        const changed = after.completeHistoryRows.find(row => String(row._id) === String(f.history[0]._id));
        for (const field of Profile.FACT_FIELDS) { assert.equal(Object.hasOwn(changed, field), Object.hasOwn(old, field), field); assert.equal(A.stringify(changed[field]), A.stringify(old[field]), field); }
        assert.equal(Profile.readEmploymentProfile(changed).recorded, false);
    });
    await t.test('Γνήσια ενεργοποίηση: ρητή διάγνωση, χωριστή πιστοποίηση, ένα ατομικό audit και reconciliation', async () => {
        const f = await legacy(db), service = create(f.dependencies), proposal = await F.approvedProposalBody(f, { all: true, values });
        const before = await f.snapshot();
        await assert.rejects(service.preview(f.req, proposal), error => {
            assert.equal(error.reason, 'PROFILE_CERTIFICATION_REQUIRED');
            assert.equal(error.profileDiagnosis.recorded, false);
            assert.ok(error.profileDiagnosis.unrecordedFields.includes(Profile.SCHEMA_VERSION));
            assert.deepEqual(error.profileDiagnosis.arrangementChanges.map(row => row.fieldId).sort(), [Profile.ENABLED, Profile.TYPE, Profile.FROM].sort());
            assert.equal(error.profileDiagnosis.arrangementChanges.find(row => row.fieldId === Profile.ENABLED).before, false);
            assert.equal(error.profileDiagnosis.arrangementChanges.find(row => row.fieldId === Profile.ENABLED).after, true);
            return true;
        });
        const preview = await service.certificationPreview(f.req, proposal);
        assert.equal(await f.snapshot(), before); assert.equal(preview.certification.rows.length, Profile.FACT_FIELDS.length);
        assert.deepEqual(preview.certification.rows.find(row => row.fieldId === Profile.DAYS).after, []);
        const body = approve(proposal, preview);
        await assert.rejects(service.apply(f.req, { proposal, approval: body.approval }), error => error.reason === 'PROFILE_CERTIFICATION_REQUIRED');
        await assert.rejects(service.apply(f.req, { ...body, certification: { ...body.certification, confirmed: false } }));
        await assert.rejects(service.apply(f.req, { ...body, certification: { token: body.approval.token, confirmed: true } }), error => error.reason === 'APPROVAL');
        const result = await service.apply(f.req, body); assert.equal(result.saved, true); assert.equal(result.historyStatus, 'REVIEW_REQUIRED');
        const audit = await db.auditModel.findById(result.auditId).lean();
        assert.equal(audit.diagnostics.actualAfter[Profile.SCHEMA_VERSION], 1);
        assert.equal(audit.diagnostics.actualAfter[Profile.TYPE_VERSION], '1');
        assert.deepEqual(audit.diagnostics.profileCertification, preview.certification);
        assert.equal(audit.diagnostics.certificationApproval.purpose, 'PROFILE_CERTIFICATION');
        assert.deepEqual(audit.diagnostics.approvedFields.sort(), [...preview.rows.map(row => row.fieldId), Profile.TYPE_VERSION, Profile.SCHEMA_VERSION].sort());
        assert.equal(audit.historyBefore.length, audit.historyAfter.length);
        for (const old of audit.historyBefore) if (String(old._id) !== result.targetHistoryId)
            assert.equal(A.stringify(audit.historyAfter.find(row => String(row._id) === String(old._id))), A.stringify(old));
        assert.equal(Profile.readEmploymentProfile(audit.diagnostics.actualAfter).recorded, true);
        const committed = await f.snapshot();
        const reconciled = await service.reconcile(f.req, { proposal, token: preview.approval.token });
        assert.equal(reconciled.reconciledReadOnly, true); assert.equal(reconciled.alreadyApplied, true);
        assert.equal((await service.apply(f.req, body)).alreadyApplied, true); assert.equal(await f.snapshot(), committed);
    });
    await t.test('Απόντα παλιά προαιρετικά στοιχεία πιστοποιούνται μόνο ως ρητά ελεγμένες τιμές της επιλεγμένης εγγραφής', async () => {
        const f = await legacy(db);
        const absent = [Profile.UNTIL, Profile.START, Profile.END, Profile.CATEGORY, ...Profile.BREAK_PAIRS.flat(), Profile.TYPE_VERSION];
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $unset: Object.fromEntries(absent.map(field => [field, 1])) });
        const proposal = await F.approvedProposalBody(f, { all: true, values }), service = create(f.dependencies), preview = await service.certificationPreview(f.req, proposal);
        for (const field of absent) {
            const row = preview.certification.rows.find(item => item.fieldId === field);
            assert.equal(row.beforeRecorded, false); assert.equal(row.after, field === Profile.TYPE_VERSION ? '1' : null);
        }
        const result = await service.apply(f.req, approve(proposal, preview));
        const audit = await db.auditModel.findById(result.auditId).lean();
        for (const field of absent) assert.equal(Object.hasOwn(audit.diagnostics.actualAfter, field), true);
        for (const old of audit.historyBefore) if (String(old._id) !== result.targetHistoryId)
            assert.equal(A.stringify(audit.historyAfter.find(row => String(row._id) === String(old._id))), A.stringify(old));
    });
    await t.test('Ανάκληση ρόλου μετά την προεπισκόπηση αποκλείει την πιστοποίηση χωρίς εγγραφή', async () => {
        const f = await legacy(db), service = create(f.dependencies), proposal = await F.approvedProposalBody(f, { all: true, values });
        const preview = await service.certificationPreview(f.req, proposal);
        await db.userModel.collection.updateOne({ _id: f.actor }, { $set: { privileges: 'S' } });
        const before = await f.snapshot();
        await assert.rejects(service.apply(f.req, approve(proposal, preview)), error => error.statusCode === 403);
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Άγνωστα παλιά στοιχεία: δεν πιστοποιούνται από προεπιλογές, εμφανίζονται ακριβώς τα ελλείποντα', async () => {
        const f = await legacy(db), service = create(f.dependencies);
        const proposal = await F.approvedProposalBody(f, { values });
        const before = await f.snapshot();
        await assert.rejects(service.certificationPreview(f.req, proposal), error => {
            assert.equal(error.reason, 'PROFILE_CERTIFICATION_REQUIRED');
            assert.ok(error.problems.some(row => row.fieldId === 'dialleima_entos_ektos_orarioy' && row.code === 'CERTIFICATION_EXPLICIT_VALUE_REQUIRED'));
            return true;
        }); assert.equal(await f.snapshot(), before);
    });
    await t.test('Παλιά απουσία απενεργοποίησης παραμένει άγνωστη και απαιτεί χωριστή πιστοποίηση', async () => {
        const f = await legacy(db);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $unset: { [Profile.ENABLED]: 1 } });
        const proposal = await F.approvedProposalBody(f, { values: { [Profile.ENABLED]: '0', nomimosMisthos: '1456.78' } }), before = await f.snapshot();
        await assert.rejects(create(f.dependencies).preview(f.req, proposal), error => error.reason === 'PROFILE_CERTIFICATION_REQUIRED');
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Ήδη πλήρες πιστοποιημένο ενεργό προφίλ: συνηθισμένη διόρθωση χωρίς νέα πιστοποίηση', async () => {
        const f = await F.seedApprovedProposal(db);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: {
            [Profile.ENABLED]: true, [Profile.TYPE]: 'OTHER_APPROVED_ARRANGEMENT', [Profile.FROM]: new Date('2026-01-02'), [Profile.TYPE_VERSION]: '1' } });
        const proposal = await F.approvedProposalBody(f, { values: { [Profile.FROM]: '2026-01-03' } });
        assert.equal((await create(f.dependencies).preview(f.req, proposal)).certification, null);
    });
    for (const state of ['absent', 'null']) await t.test(`Ενεργή ρύθμιση με ${state} ημέρες: το [] δεν επινοείται ως παλιό γεγονός`, async () => {
        const f = await F.seedApprovedProposal(db);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: {
            [Profile.ENABLED]: true, [Profile.TYPE]: 'OTHER_APPROVED_ARRANGEMENT', [Profile.FROM]: new Date('2026-01-02'), [Profile.TYPE_VERSION]: '1',
            ...(state === 'null' ? { [Profile.DAYS]: null } : {}) }, ...(state === 'absent' ? { $unset: { [Profile.DAYS]: 1 } } : {}) });
        const proposal = await F.approvedProposalBody(f, { all: true, values: { [Profile.DAYS]: [] } }), before = await f.snapshot();
        await assert.rejects(create(f.dependencies).preview(f.req, proposal), error => error.reason === 'PROFILE_CERTIFICATION_REQUIRED');
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Ιστορική επικάλυψη, πιστοποίηση, αναφορά και οριστικοποίηση διαγιγνώσκονται μαζί', async () => {
        const f = await legacy(db);
        await db.frozenModel.collection.insertOne({ frozen_snapshot: { daily_results: [{ effective_profile_istoriko_id: String(f.history[0]._id) }] } });
        await db.periodControlModel.collection.updateOne({ company_kod: f.scope.company_kod }, { $set: { status: 'FINALIZED' } });
        const proposal = await F.approvedProposalBody(f, { all: true, values: { ...values, hmeromhnia_isxyos_oron_ergasias_eos: '2026-02-05' } }), before = await f.snapshot();
        await assert.rejects(create(f.dependencies).preview(f.req, proposal), error => {
            assert.deepEqual(error.blockedChecks, ['COVERAGE', 'PROFILE_CERTIFICATION_REQUIRED', 'REFERENCE', 'PERIOD_PROTECTED']); return true;
        }); assert.equal(await f.snapshot(), before);
    });
    await t.test('Πιστοποίηση, αναφορές και οριστικοποίηση εμφανίζονται μαζί σε αναγνωστική διάγνωση', async () => {
        const f = await legacy(db);
        await db.frozenModel.collection.insertOne({ frozen_snapshot: { daily_results: [{ effective_profile_istoriko_id: String(f.history[0]._id) }] } });
        await db.periodControlModel.collection.updateOne({ company_kod: f.scope.company_kod }, { $set: { status: 'FINALIZED' } });
        const proposal = await F.approvedProposalBody(f, { all: true, values }), before = await f.snapshot();
        await assert.rejects(create(f.dependencies).preview(f.req, proposal), error => {
            assert.deepEqual(error.blockedChecks, ['PROFILE_CERTIFICATION_REQUIRED', 'REFERENCE', 'PERIOD_PROTECTED']);
            assert.ok(error.problems.some(row => row.code === 'REFERENCE')); assert.ok(error.problems.some(row => row.code === 'PERIOD_PROTECTED')); return true;
        }); assert.equal(await f.snapshot(), before);
    });
    await t.test('Πιστοποίηση με ελλιπή τεκμηρίωση μένει κλειδωμένη', async () => {
        const f = await legacy(db), proposal = await F.approvedProposalBody(f, { all: true, values: { ...values, EVIDENCE: '' } }), before = await f.snapshot();
        await assert.rejects(create(f.dependencies).certificationPreview(f.req, proposal), error =>
            error.reason === 'PROFILE_CERTIFICATION_REQUIRED' && error.problems.some(row => row.code === 'CERTIFICATION_EVIDENCE_REQUIRED'));
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Παλιό στιγμιότυπο, τροποποιημένο αίτημα και ληγμένη πιστοποίηση απορρίπτονται', async () => {
        const f = await legacy(db); let now = Date.now(); const service = create({ ...f.dependencies, now: () => now });
        const proposal = await F.approvedProposalBody(f, { all: true, values }), preview = await service.certificationPreview(f.req, proposal), body = approve(proposal, preview);
        now += 16 * 60 * 1000; await assert.rejects(service.apply(f.req, body), error => error.reason === 'EXPIRED'); now -= 16 * 60 * 1000;
        await assert.rejects(service.apply(f.req, { ...body, proposal: { ...proposal, selection: '' } }), error => error.reason === 'APPROVAL');
        await db.historyModel.collection.updateOne({ _id: f.history[1]._id }, { $set: { nomimosMisthos: 1500 } });
        const before = await f.snapshot(); await assert.rejects(service.apply(f.req, body), error => error.reason === 'STALE'); assert.equal(await f.snapshot(), before);
    });
    await t.test('Ταυτόχρονες διαφορετικές εγκρίσεις πιστοποίησης: μία μόνο καταχώριση', async () => {
        const f = await legacy(db), service = create(f.dependencies), proposal = await F.approvedProposalBody(f, { all: true, values });
        const a = await service.certificationPreview(f.req, proposal), b = await service.certificationPreview(f.req, proposal);
        const results = await Promise.allSettled([service.apply(f.req, approve(proposal, a)), service.apply(f.req, approve(proposal, b))]);
        assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
        assert.equal(results.find(row => row.status === 'rejected').reason.reason, 'STALE');
        assert.equal(await db.auditModel.countDocuments({ 'employeeScope.employee_id': f.employee._id }), 1);
    });
    await t.test('Αποτυχία μετά την πραγματική πιστοποίηση και το audit ανακαλεί ολόκληρη τη συναλλαγή', async () => {
        const f = await legacy(db), proposal = await F.approvedProposalBody(f, { all: true, values }), service = create(f.dependencies);
        const preview = await service.certificationPreview(f.req, proposal), before = await f.snapshot();
        const auditModel = new Proxy(db.auditModel, { get(target, key) {
            if (key === 'create') return async (...args) => { await target.create(...args); throw Error('SYNTHETIC_ROLLBACK_AFTER_CERTIFICATION_AUDIT'); };
            const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
        } });
        await assert.rejects(create({ ...f.dependencies, auditModel }).apply(f.req, approve(proposal, preview)));
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Chromium: ορατή ακριβής πιστοποίηση, χωριστή έγκριση και προσαρμοστική φόρμα', async () => {
        const f = await legacy(db), service = create(f.dependencies), h = await F.startApprovedProposalHttp(f, service);
        const browser = await chromium.launch({ headless: true }), page = await browser.newPage();
        const before = await f.snapshot(), errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => new URL(route.request().url()).origin === h.origin ? route.continue() : route.abort());
        try {
            await page.goto(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-editor?selection=UPDATE:${f.history[0]._id}`);
            await page.locator(`[data-field-id="${Profile.ENABLED}"]`).selectOption('1');
            await page.locator(`[data-field-id="${Profile.TYPE}"]`).fill('OTHER_APPROVED_ARRANGEMENT');
            await page.locator(`[data-field-id="${Profile.FROM}"]`).fill('2026-01-02');
            await page.locator('[data-field-id="EVIDENCE"]').fill('Ρητό συνθετικό ιστορικό τεκμήριο Α1');
            await page.locator('[data-field-id="DECLARATION"]').selectOption('1');
            await page.locator('#previewProposalApply').click();
            await page.locator('#previewProposalCertification').waitFor({ state: 'visible' });
            const certificationResponse = page.waitForResponse(response => response.url().endsWith('/history-proposal-certification-preview'));
            await page.locator('#previewProposalCertification').click();
            const certificationResult = await (await certificationResponse).json();
            assert.equal(certificationResult.success, true, JSON.stringify(certificationResult));
            await page.waitForFunction(() => document.getElementById('approveProposalApply').disabled === false);
            assert.match(await page.locator('#proposalApplyPreview').textContent(), /Χωριστή πιστοποίηση/);
            assert.equal(await page.locator('#proposalApplyPreview table').count(), 2);
            for (const [width, height] of [[1920,1080], [1680,1050], [1600,900], [1440,900], [1280,1024], [1280,800], [1280,720], [900,450], [480,700]]) for (const sidebar of [false,true]) {
                await page.setViewportSize({ width, height });
                await page.locator('.proposal-page').evaluate((node, sidebar) => { node.style.width = sidebar ? 'calc(100% - 140px)' : ''; node.style.marginLeft = sidebar ? '140px' : ''; }, sidebar);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            }
            await page.locator('#approveProposalApply').click();
            assert.equal(await page.locator('#proposalCertificationConsentLabel').isVisible(), true);
            await page.locator('#proposalApplyConsent').check(); assert.equal(await page.locator('#confirmProposalApply').isDisabled(), true);
            await page.locator('#proposalCertificationConsent').check(); assert.equal(await page.locator('#confirmProposalApply').isDisabled(), false);
            const images = await fs.mkdtemp('/tmp/payroll-profile-certification-browser-');
            await page.screenshot({ path: `${images}/separate-approval-480x700.png` });
            await page.locator('#cancelProposalApply').click();
            await page.locator('#proposalApplyPreview').scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${images}/certification-preview-480x700.png` });
            console.log(`Συνθετική πιστοποίηση σε Chromium: ${images}`);
            assert.equal(await f.snapshot(), before); assert.deepEqual(errors, []);
        } finally { await browser.close(); await h.close(); }
    });
    assert.equal(mongoose.connection.readyState, 0);
});
