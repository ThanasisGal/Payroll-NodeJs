'use strict';
// One owned replica set, real XLSX/controllers/writer/audit and real Chromium.
// No app.js, .env, DEV server, existing Mongo URI or external ERGANI requests.
const { test } = require('node:test'), assert = require('node:assert/strict');
const mongoose = require('mongoose'), { chromium } = require('playwright');
const { startApprovedProposalMongo, seedApprovedProposal, approvedProposalBody, startApprovedProposalHttp } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { createEmployeeHistoryApprovedProposalService: create } = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const C = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const X = require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const E = require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService');
const P = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalContract');
const F = require('../../server/services/ergazomenoi/apasxoliseisPeriodFrozenSnapshotService');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const date = value => new Date(value);
async function legacy(db, { otherIssue = false } = {}) {
    const f = await seedApprovedProposal(db, { employeeCode: '0002' });
    const starts = ['2026-02-02', '2026-04-01', '2026-06-01'];
    for (const [index, row] of f.history.entries()) {
        await db.historyModel.collection.updateOne({ _id: row._id }, { $set: {
            [C.HIRE]: date(starts[0]), [C.CHANGE]: date(starts[index]),
            [C.START]: index ? date(starts[index]) : null,
            [C.END]: index === 1 ? date('2026-05-31') : null,
            hmeromhnia_allaghs_orarioy_apo: index ? date(starts[index]) : null,
            hmeromhnia_isxyos_dialleimatos_apo: index ? date(starts[index]) : null,
            ...(index === 0 ? { employment_profile_schema_version: null, hmeres_ergasias_ebdomadas: 0,
                ores_ergasias_ebdomadas: 0, mo_oron_hmerhsias_ergasias: 0 } : {})
        }, ...(otherIssue && index === 1 ? { $unset: { nomimosMisthos: 1 } } : {}) });
    }
    await db.employeeModel.collection.updateOne({ _id: f.employee._id }, { $set: {
        [C.HIRE]: date(starts[0]), [C.CHANGE]: date(starts[2]), [C.START]: date(starts[2]),
        hmeromhnia_isxyos_dialleimatos_apo: date(starts[2]) } });
    await db.companyModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(f.scope.company_kod) }, { $set: { kod: '0003' } });
    const input = f.input; f.input = async () => ({ ...await input(), companyBusinessCode: '0003' });
    await db.periodControlModel.collection.updateOne({ company_kod: f.scope.company_kod }, { $set: { period_end: date('2026-08-31') } });
    const scope = { team: f.scope.team, company_kod: f.scope.company_kod, ypokatasthma: '0001',
        period_start: date('2026-09-01'), period_end: date('2026-09-30') };
    const built = F.buildEmploymentPeriodFrozenSnapshot({ scope, employees: [(await f.input()).currentEmployee],
        profileHistory: (await f.input()).completeHistoryRows,
        dailyResults: [{ _id: new mongoose.Types.ObjectId(), kodikos: '0002', ypokatasthma: '0001',
            hmeromhnia: '2026-09-07', ores_ergasias_apologistika: 8, ores_pragmatikhs_ergasias_apologistika: 8,
            effective_profile_istoriko_id: String(f.history[2]._id) }],
        payrollResults: [{ kodikos: '0002', plhroteo: 1234.56, synolo_apodoxon: 1500 }] });
    const frozenId = new mongoose.Types.ObjectId();
    await db.frozenModel.collection.insertOne({ _id: frozenId, ...scope,
        ...Object.fromEntries(Object.entries(built).filter(([key]) => key !== 'snapshot')), frozen_snapshot: built.snapshot });
    await db.periodControlModel.collection.insertOne({ ...scope, status: 'FINALIZED',
        frozen_snapshot_id: frozenId, frozen_snapshot_fingerprint: built.frozen_snapshot_fingerprint });
    const frozenBson = () => db.frozenModel.collection.findOne({ _id: frozenId }, { raw: true });
    const proposal = await approvedProposalBody(f, { all: true, values: {
        [C.START]: starts[0], [C.END]: '2026-03-31', hmeromhnia_isxyos_dialleimatos_apo: starts[0],
        hmeres_ergasias_ebdomadas: '5', ores_ergasias_ebdomadas: '40', mo_oron_hmerhsias_ergasias: '8',
        dialleima_se_lepta: '30', EVIDENCE: 'Συνθετική σύμβαση Α1: πρόσληψη 02/02, διάδοχη μεταβολή 01/04, διάλειμμα από 02/02.', DECLARATION: '1' } });
    return { ...f, proposal, frozenId, frozenBson };
}
const approved = (proposal, preview) => ({ proposal, approval: { token: preview.approval.token, confirmed: true },
     });

test('Ενιαίο τελικό κριτήριο: πιστοποιημένο Ιστορικό και ενεργή περίοδος σε ιδιόκτητη MongoDB/Chromium',
    { skip: !binary, timeout: 240000 }, async t => {
    assert.equal(P.enabled(), false, 'The real process flag must remain OFF');
    assert.equal(mongoose.connection.readyState, 0);
    const db = await startApprovedProposalMongo(binary); t.after(db.close);
    console.log(`Συνθετικές αποδείξεις: ${db.folder}`);
    await t.test('A: XLSX → εισαγωγή → χωριστή πιστοποίηση → ατομική εφαρμογή → νέα ανάγνωση → ειλικρινές κλείσιμο', async () => {
        const f = await legacy(db, { otherIssue: true }), service = create(f.dependencies);
        const baseline = await X.buildEmployeeHistoryProposalWorkbook(await f.input(), f.catalogs, { selection: f.proposal.selection });
        E.applyLocalCompletion(baseline, f.proposal.completion, f.req, f.catalogs);
        const buffer = await X.serializeEmployeeHistoryProposalWorkbook(baseline.workbook);
        const before = await f.snapshot(), raw = await f.frozenBson();
        const h = await startApprovedProposalHttp(f, service), browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => new URL(route.request().url()).origin === h.origin ? route.continue() : route.abort());
        try {
            await page.goto(`${h.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-editor?selection=${f.proposal.selection}`);
            const imported = page.waitForResponse(response => response.url().endsWith('/history-proposal-import-preview'));
            await page.locator('#proposalImportFile').setInputFiles({ name: 'synthetic-approved-0001.xlsx',
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
            const importResult = await (await imported).json(); assert.equal(importResult.success, true, importResult.message);
            await page.waitForFunction(() => document.querySelector('.proposal-page').getAttribute('aria-busy') === 'false');
            assert.equal(await f.snapshot(), before);
            await page.locator('[data-field-id="DECLARATION"]').selectOption({ label: 'Ναι' });
            let response = page.waitForResponse(response => response.url().endsWith('/history-proposal-apply-preview'));
            await page.locator('#previewProposalApply').click();
            const previewResponse=await response,actualProposal=previewResponse.request().postDataJSON();
            const preview=await previewResponse.json();assert.equal(preview.success,true,preview.message);
            assert.equal(preview.certification,null);assert.equal(preview.physicalWrites.history.mode,'CORRECTION_EDITION');
            assert.equal(await f.snapshot(),before);
            await page.waitForFunction(()=>document.querySelector('.proposal-page').getAttribute('aria-busy')==='false');
            response=page.waitForResponse(response=>response.url().endsWith('/history-proposal-apply'));
            await page.locator('#approveProposalApply').click();
            const result = await (await response).json(); assert.equal(result.success, true, result.message);
            assert.equal(result.selectedCaseStatus, 'APPROVED_RESOLVED');
            assert.equal(result.historyStatus, 'REVIEW_REQUIRED');
            assert.equal(result.verification.persisted, true); assert.equal(result.verification.selectedCaseResolved,true);
            await page.waitForFunction(() => document.getElementById('previewProposalApply').dataset.completed === 'true');
            assert.match(await page.locator('#proposalEditState').textContent(), /Δεν απαιτείται επανεισαγωγή/);
            assert.match(await page.locator('#proposalActiveCase').textContent(), /Εγκεκριμένη — Ολοκληρωμένη/);
            assert.doesNotMatch(await page.locator('#proposalCaseContent .proposal-context').textContent(), /χωρίς καταγεγραμμένη/);
            assert.equal(await page.locator('[data-field-id="dialleima_se_lepta"]').isDisabled(), true);
            const persistedPage = await page.request.get(await page.locator('#openPersistedProposal').getAttribute('href'));
            assert.equal(persistedPage.status(), 200);
            const audit = await db.auditModel.findById(result.auditId).lean();
            assert.equal(audit.diagnostics.rowApproval.mode,'CORRECTION_EDITION');
            const persisted = await f.input();
            for (const old of audit.historyBefore) {
                const after = persisted.completeHistoryRows.find(row => String(row._id) === String(old._id));
                if (String(old._id) !== String(f.history[0]._id)) assert.deepEqual(after, old);
                else for (const field of new Set([...Object.keys(old), ...Object.keys(after)]))
                    if (!audit.diagnostics.approvedFields.includes(field) && field !== 'updatedAt') assert.deepEqual(after[field], old[field], field);
            }
            assert.deepEqual(await f.frozenBson(), raw, 'Frozen BSON, identity, fingerprint and stored money/hours must be byte-identical');
            const saved = await f.snapshot();
            const reconciled = await service.reconcile(f.req, { proposal: actualProposal, token: preview.approval.token });
            assert.equal(reconciled.selectedCaseStatus, 'APPROVED_RESOLVED');
            assert.equal((await service.apply(f.req, {proposal:actualProposal,approval:{token:preview.approval.token,confirmed:true}})).alreadyApplied, true);
            assert.equal(await f.snapshot(), saved); assert.deepEqual(errors, []);
            await page.screenshot({ path: `${db.folder}/history-verified-closure.png`, fullPage: true });
            const reopened = await X.buildEmployeeHistoryProposalWorkbook(await f.input(), f.catalogs, { selection: f.proposal.selection });
            const storedInput=await f.input();const storedRow=require('../../server/services/ergazomenoi/employeeHistoryRowApprovalService').reviewedRow(storedInput,storedInput.completeHistoryRows.find(row=>String(row._id)===String(f.history[0]._id)));
            assert.equal(storedRow.dialleima_se_lepta, 30); assert.equal(storedRow.hmeres_ergasias_ebdomadas, 5);
            assert.ok(reopened.workbook); assert.notEqual(reopened.snapshotFingerprint, baseline.snapshotFingerprint);
        } finally { await browser.close(); await h.close(); }
    });
    await t.test('A: αποτυχίες και αμετάβλητες αναφορές', async t => {
        for (const scenario of ['approval', 'missing-evidence', 'unknown-profile', 'stale-reference', 'fingerprint', 'busy', 'protected', 'unproved-before'])
            await t.test(scenario, async () => {
                const f = await legacy(db), service = create(f.dependencies);
                const baseline = await X.buildEmployeeHistoryProposalWorkbook(await f.input(), f.catalogs, { selection: f.proposal.selection });
                const set = (field, value) => { const index = baseline.editableCells.findIndex(entry => (entry.canonicalField || entry.fieldId) === field);
                    f.proposal.completion.changes.find(item => item.index === index).value = value; };
                if (scenario === 'missing-evidence') set('EVIDENCE', '');
                if (scenario === 'unknown-profile') set('evelikth_proselefsh', '');
                if (scenario === 'unproved-before') {
                    await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: { afora_proslhpsh: false } });
                    // Refresh the legitimate workbook snapshot after the evidence change.
                    const fresh = await approvedProposalBody(f, { all: true, values: { [C.START]: '2026-02-02', [C.END]: '2026-03-31',
                        hmeromhnia_isxyos_dialleimatos_apo: '2026-02-02', hmeres_ergasias_ebdomadas: '5',
                        ores_ergasias_ebdomadas: '40', mo_oron_hmerhsias_ergasias: '8', EVIDENCE: 'Συνθετικό Α1' } });
                    f.proposal = fresh;
                }
                if (scenario === 'busy') await db.periodControlModel.collection.updateOne({ company_kod: f.scope.company_kod, status: 'OPEN' }, { $set: { active_calculation_id: 'synthetic-running' } });
                if (scenario === 'protected') await db.periodControlModel.collection.updateOne({ company_kod: f.scope.company_kod, status: 'OPEN' }, { $set: { status: 'LOCKED' } });
                if (scenario === 'fingerprint') await db.frozenModel.collection.updateOne({ _id: f.frozenId }, { $set: { 'frozen_snapshot.payroll_results.0.plhroteo': 9999 } });
                const before = await f.snapshot(), raw = await f.frozenBson();
                if (['missing-evidence', 'unknown-profile', 'busy', 'protected', 'fingerprint', 'unproved-before'].includes(scenario)) {
                    const preview=await service.preview(f.req,f.proposal);
                    assert.equal(preview.success,true);assert.equal(preview.certification,null);
                    assert.equal(preview.physicalWrites.history.mode,'CORRECTION_EDITION');
                } else {
                    const preview = await service.preview(f.req, f.proposal), body = approved(f.proposal, preview);
                    if (scenario === 'approval') body.approval.confirmed = false;
                    else await db.frozenModel.collection.updateOne({ _id: f.frozenId }, { $set: { finalize_reason: 'concurrent' } });
                    const actualBefore = await f.snapshot(), actualRaw = await f.frozenBson();
                    await assert.rejects(service.apply(f.req, body));
                    assert.equal(await f.snapshot(), actualBefore); assert.deepEqual(await f.frozenBson(), actualRaw); return;
                }
                assert.equal(await f.snapshot(), before); assert.deepEqual(await f.frozenBson(), raw);
            });
    });
    await t.test('A: ταυτόχρονη αλλαγή παγωμένης αναφοράς, ανάκληση και μεταγενέστερη συμφωνία', async () => {
        const f = await legacy(db), previewService = create(f.dependencies);
        const preview = await previewService.preview(f.req, f.proposal), before = await f.snapshot();
        let changed = false;
        const originalUpdate = db.userModel.collection.updateOne.bind(db.userModel.collection);
        const user = new Proxy(db.userModel, { get(target, key) {
            if (key === 'collection') return new Proxy(target.collection, { get(collection, name) {
                if (name === 'updateOne') return async (...args) => {
                    if (!changed) { changed = true; await db.frozenModel.collection.updateOne({ _id: f.frozenId }, { $set: { finalize_reason: 'Συνθετική ταυτόχρονη καταγραφή' } }); }
                    return originalUpdate(...args);
                };
                const value = collection[name]; return typeof value === 'function' ? value.bind(collection) : value;
            } });
            const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
        } });
        await assert.rejects(create({ ...f.dependencies, userModel: user }).apply(f.req, approved(f.proposal, preview)), error => error.reason === 'STALE');
        assert.equal(await f.snapshot(), before); assert.equal(changed, true);
        const fresh = await previewService.preview(f.req, f.proposal);
        const applied = await previewService.apply(f.req, approved(f.proposal, fresh));
        assert.equal(applied.selectedCaseStatus, 'APPROVED_RESOLVED');
        const committed = await f.snapshot();
        await db.frozenModel.collection.updateOne({ _id: f.frozenId }, { $set: { finalize_reason: 'Μεταγενέστερη εξωτερική αλλαγή' } });
        await assert.rejects(previewService.reconcile(f.req, { proposal: f.proposal, token: fresh.approval.token }),
            error => error.reason === 'COMMITTED_STATE_CHANGED' && error.saved === true);
        assert.equal(await f.snapshot(), committed);
    });
    await t.test('A: η αποθήκευση χωρίς επιτυχή τελικό επανέλεγχο δεν δηλώνεται ολοκλήρωση', async () => {
        const f = await legacy(db); let failReread = true;
        const checker = require('../../server/services/ergazomenoi/employeeHistoryReferenceAuditService').findHistoryIdReferences;
        const service = create({ ...f.dependencies, referenceChecker: async args => {
            if (failReread && await db.auditModel.countDocuments({ 'employeeScope.employee_id': f.employee._id })) throw Error('Synthetic postcommit read unavailable');
            return checker(args);
        } });
        const preview = await service.preview(f.req, f.proposal);
        await assert.rejects(service.apply(f.req, approved(f.proposal, preview)), error => error.saved === true && error.reason === 'COMMITTED_VERIFICATION_REQUIRED');
        assert.equal(await db.auditModel.countDocuments({ 'employeeScope.employee_id': f.employee._id }), 1);
        assert.equal((await db.auditModel.findOne({'employeeScope.employee_id':f.employee._id}).lean()).diagnostics.rowApproval.status,'COMMITTED_AWAITING_VERIFICATION');
        failReread = false;
        const reconciled = await service.reconcile(f.req, { proposal: f.proposal, token: preview.approval.token });
        assert.equal(reconciled.selectedCaseStatus, 'APPROVED_RESOLVED');
        assert.equal(reconciled.verification.persisted, true);
    });
    await t.test('A: πραγματική αποτυχία μετά το audit ανακαλεί ιστορικό, δεσμεύσεις και audit με αμετάβλητα παγωμένα BSON', async () => {
        const f = await legacy(db), baseService = create(f.dependencies);
        const preview = await baseService.preview(f.req, f.proposal);
        const before = await f.snapshot(), raw = await f.frozenBson();
        const audit = new Proxy(db.auditModel, { get(target, key) {
            if (key === 'create') return async (...args) => { await target.create(...args); throw Error('Synthetic failure after atomic audit'); };
            const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
        } });
        await assert.rejects(create({ ...f.dependencies, auditModel: audit }).apply(f.req, approved(f.proposal, preview)));
        assert.equal(await f.snapshot(), before); assert.deepEqual(await f.frozenBson(), raw);
        assert.equal(await db.auditModel.countDocuments({ 'employeeScope.employee_id': f.employee._id }), 0);
        assert.equal((await baseService.apply(f.req, approved(f.proposal, preview))).selectedCaseStatus, 'APPROVED_RESOLVED');
    });
    await t.test('B/C: πραγματικός Υπολογισμός τριών ενεργών εργαζομένων, τέσσερα στάδια και 31 αμετάβλητες ημερήσιες εγγραφές αποχωρήσαντος', async () => {
        const vendor = process.env.PAYROLL_PERIOD_EMPLOYEES_TOM_VENDOR_DIR;
        assert.ok(vendor, 'Chromium acceptance requires the real local Tom Select assets');
        const data = await require('../fixtures/payrollCertifiedClosureReview').startClosureReview(db, vendor);
        const { D, E: Employee, H: History, base, employees } = data;
        const beforeBson = () => D.collection.find({ ...base, kodikos: '0001' }, { raw: true }).sort({ _id: 1 }).toArray();
        const original = await beforeBson(); assert.equal(original.length, 31);
        const params = new URLSearchParams({ apo_hmeromhnia: '2026-10-01', eos_hmeromhnia: '2026-10-31', ypokatasthma: '0000', limit: '200' });
        const get = (extra = '') => fetch(`${data.origin}${data.prefix}?${params}${extra}`);
        const browser = await chromium.launch({ headless: true });
        try {
            const initial = await get();
            assert.equal(initial.status, 409, await initial.text());
            const calculated = await fetch(`${data.origin}${data.prefix}/calculate`, { method: 'POST',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apo_hmeromhnia: '2026-10-01',
                    eos_hmeromhnia: '2026-10-31', ypokatasthma: '0000' }) });
            const calculation = await calculated.json(); assert.equal(calculated.status, 200, JSON.stringify(calculation));
            assert.equal(calculation.employeesCount, 3, JSON.stringify(calculation));
            assert.deepEqual(await beforeBson(), original);
            const response = await get(), review = await response.json();
            assert.equal(response.status, 200, JSON.stringify(review));
            assert.ok(review.rows.length > 0); assert.equal(review.rows.some(row => row.kodikos === '0001'), false);
            assert.equal(new Set(review.rows.map(row => row.kodikos)).size, 3);
            const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => new URL(route.request().url()).origin === data.origin ? route.continue() : route.abort());
            await page.goto(data.origin + '/review');
            await page.waitForFunction(() => typeof loadResults === 'function');
            const displayed = await page.evaluate(async () => {
                document.getElementById('ypokatasthma_stathera_advanced').value = '0000';
                const success = await loadResults(); await loadPreparedWeeklyHrStage1();
                return { success, employees: [...new Set(currentReviewRows.map(row => row.kodikos))],
                    stages: currentCanonicalLifecyclePayloads.map(payload => Object.keys(payload.lifecycle_projection.stages)) };
            });
            assert.equal(displayed.success, true); assert.equal(displayed.employees.includes('0001'), false);
            assert.ok(displayed.stages.length >= 3); assert.ok(displayed.stages.every(stages => stages.length === 4));
            assert.deepEqual(errors, []);
            for (const [width, height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[640,620]]) {
                await page.setViewportSize({ width, height });
                for (const sidebar of [false, true]) {
                    await page.evaluate(open => { document.body.style.paddingLeft = open ? '240px' : ''; }, sidebar);
                    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
                        `${width}×${height}, menu ${sidebar}`);
                }
            }
            await page.screenshot({ path: `${db.folder}/october-four-stages.png`, fullPage: true });
            for (const kind of ['excel', 'pdf']) {
                const exported = await fetch(`${data.origin}${data.prefix}/export-${kind}?${params}`);
                assert.equal(exported.status, 200, await exported.clone().text());
                const bytes = Buffer.from(await exported.arrayBuffer());
                if (kind === 'excel') {
                    const workbook = new (require('exceljs').Workbook)(); await workbook.xlsx.load(bytes);
                    const values = []; workbook.eachSheet(sheet => sheet.eachRow(row => values.push(...row.values)));
                    assert.ok(values.some(value => String(value).includes('0002')));
                    assert.equal(values.some(value => String(value).includes('ΣΥΝΘΕΤΙΚΟΣ 0001')), false);
                } else {
                    assert.equal(bytes.subarray(0,4).toString(), '%PDF');
                    const fs = require('node:fs/promises'), file = `${db.folder}/october-review.pdf`;
                    await fs.writeFile(file, bytes);
                    const { stdout } = await require('node:util').promisify(require('node:child_process').execFile)('pdftotext', ['-layout', file, '-']);
                    assert.match(stdout, /0002/); assert.doesNotMatch(stdout, /ΣΥΝΘΕΤΙΚΟΣ 0001/);
                }
            }
            assert.deepEqual(await beforeBson(), original);
            const active = await D.findOne({ ...base, kodikos: '0002', hmeromhnia: new Date('2026-10-15') }).lean();
            await D.collection.updateOne({ _id: active._id }, { $set: { 'ergani_pipeline.calculation_pending': true,
                apologistiko_biblio: false, ores_nyxtas_apologistika: 0 } });
            for (const extra of ['', '&only_apologistiko=true', '&only_nyxta=true&limit=1&page=2', '&only_yperergasia=true',
                '&$nor[0][kodikos]=0002', '&search=ΧΩΡΙΣ_ΑΠΟΤΕΛΕΣΜΑ']) {
                const blocked = await get(extra); assert.equal(blocked.status, 409, extra);
                assert.equal((await blocked.json()).code, 'ERGANI_CALCULATION_REQUIRED');
            }
            for (const kind of ['excel', 'pdf']) {
                const blocked = await fetch(`${data.origin}${data.prefix}/export-${kind}?${params}&only_apologistiko=true`);
                assert.equal(blocked.status, 409, await blocked.clone().text());
            }
            const lazyScope = review.canonicalLifecycleProjections.find(item =>
                String(item.scope.employee_id) === String(employees[1]._id) && String(item.scope.week_start).startsWith('2026-10-12'))?.scope;
            assert.ok(lazyScope);
            const lazy = await fetch(`${data.origin}${data.prefix}/weekly-hr-workflow/stage1?${new URLSearchParams(lazyScope)}`);
            assert.equal(lazy.status, 409, await lazy.clone().text());
            await D.collection.updateOne({ _id: active._id }, { $set: { 'ergani_pipeline.calculation_pending': false } });
            // No evidence of departure: the same pending rows must be visible
            // to the preflight, despite today's inactive display marker.
            await Employee.collection.updateOne({ _id: employees[0]._id }, { $unset: { hmeromhnia_apoxorhshs: 1 } });
            assert.equal((await get()).status, 409);
            await Employee.collection.updateOne({ _id: employees[0]._id }, { $set: { hmeromhnia_apoxorhshs: new Date('2026-09-30') } });
            // Rehire: exclude only the proved gap; never hide the new cycle.
            await Employee.collection.updateOne({ _id: employees[0]._id }, { $set: {
                hmeromhnia_proslhpshs: new Date('2026-10-20'), hmeromhnia_apoxorhshs: null } });
            await History.collection.insertOne({ ...base, kodikos: '0001', hmeromhnia_proslhpshs: new Date('2026-10-20') });
            assert.equal((await get()).status, 409);
            assert.deepEqual(await beforeBson(), original);
            // Reset the test relationship, keeping the original 31 documents.
            await Employee.collection.updateOne({ _id: employees[0]._id }, { $set: {
                hmeromhnia_proslhpshs: new Date('2026-01-01'), hmeromhnia_apoxorhshs: new Date('2026-09-30') } });
            const rehire = await History.collection.findOne({ ...base, kodikos: '0001', hmeromhnia_proslhpshs: new Date('2026-10-20') });
            await History.collection.updateOne({ _id: rehire._id }, { $set: { employment_history_canonical_status: 'WITHDRAWN_ERRONEOUS' } });
            const borrowed = { ...employees[1], _id: new mongoose.Types.ObjectId(), kodikos: '0005',
                afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false,
                hmnia_enarxhs_daneismoy: new Date('2026-10-10'), hmnia_lhxhs_daneismoy: new Date('2026-10-20') };
            await Employee.collection.insertOne(borrowed);
            const borrowedRow = { _id: new mongoose.Types.ObjectId(), ...base, kodikos: '0005', hmeromhnia: new Date('2026-10-15'),
                apologistiko_biblio: false, ergani_pipeline: { calculation_pending: true, cards_pending: false } };
            await D.collection.insertOne(borrowedRow);
            const borrowedBson = await D.collection.findOne({ _id: borrowedRow._id }, { raw: true });
            assert.equal((await get()).status, 200, 'Confirmed outgoing loan date belongs to the other employer');
            await Employee.collection.updateOne({ _id: borrowed._id }, { $unset: { hmnia_enarxhs_daneismoy: 1 } });
            assert.equal((await get()).status, 409, 'Unknown loan cannot conceal a pending day');
            await Employee.collection.updateOne({ _id: borrowed._id }, { $set: { hmnia_enarxhs_daneismoy: new Date('2026-10-10'), typos_ergodoth_daneismoy: true } });
            assert.equal((await get()).status, 409, 'Incoming loan is owned inside the agreed interval');
            assert.deepEqual(await D.collection.findOne({ _id: borrowedRow._id }, { raw: true }), borrowedBson);
            const guard = require('../../server/services/ergazomenoi/erganiResultFreshnessService').assertErganiScopeCurrent;
            const rawFilter = { ...base, hmeromhnia: { $gte: new Date('2026-10-01'), $lte: new Date('2026-10-31') },
                $nor: [{ kodikos: '0005' }, { kodikos: '0001' }], apologistiko_biblio: true };
            await assert.rejects(guard(D, rawFilter), { code: 'ERGANI_CALCULATION_REQUIRED' });
            await assert.rejects(guard(D, rawFilter, null, { employmentScope: JSON.parse('{"exclusions":[{"kodikos":"0005"}]}') }),
                /EMPLOYMENT_REVIEW_SCOPE_CAPABILITY_INVALID/);
            assert.deepEqual(await beforeBson(), original);
        } finally { await browser.close(); await data.close(); }
    });
});
module.exports = { legacy };
