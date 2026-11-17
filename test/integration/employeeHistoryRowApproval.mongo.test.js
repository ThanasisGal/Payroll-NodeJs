'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startApprovedProposalMongo, seedApprovedProposal, approvedProposalBody, startApprovedProposalHttp } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { seedLegacyStructure, seedLegacyFrozen, rawState } = require('../fixtures/employeeHistoryLegacyStructure');
const { createEmployeeHistoryApprovedProposalService: create } = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const Row = require('../../server/services/ergazomenoi/employeeHistoryRowApprovalService');
const X = require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const E = require('../../server/services/ergazomenoi/employeeHistoryProposalEditorService');
const I = require('../../server/services/ergazomenoi/employeeHistoryProposalImportService');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const P = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalContract');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const approve = (proposal, preview) => ({ proposal, approval: { token: preview.approval.token, confirmed: true } });
const proxy = (model, overrides) => new Proxy(model, { get(target, key) { return key in overrides ? overrides[key] : Reflect.get(target, key); } });

test('Οριστική έγκριση εγγραφής: πραγματικοί ελεγκτές, απομονωμένη MongoDB και Chromium', { skip: !binary, timeout: 180000 }, async t => {
    const db = await startApprovedProposalMongo(binary); t.after(db.close);
    assert.equal(require('mongoose').connection.readyState, 0);
    assert.equal(P.enabled(), false);
    async function submit(f, values) {
        const proposal = await approvedProposalBody(f, { values }), service = create(f.dependencies);
        const preview = await service.preview(f.req, proposal);
        const result = await service.apply(f.req, approve(proposal, preview));
        assert.equal(result.selectedCaseStatus, Row.STATUS); assert.equal(result.verification.persisted, true);
        return { proposal, preview, result, service,
            audit: await db.auditModel.findById(result.auditId).lean() };
    }
    await t.test('Δύο συμπληρωμένα και όλα τα υπόλοιπα κενά: ακριβές UPDATE, 0/false και απουσία πεδίου', async () => {
        const f = await seedApprovedProposal(db, { employeeCode: '0001' });
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: { afora_egkekrimenh_rythmish_ergasias: true }, $unset: { poso_symbashs_01: 1 } });
        const input = await f.input(), baseline = await X.buildEmployeeHistoryProposalWorkbook(input, f.catalogs, { selection: `UPDATE:${f.history[0]._id}` });
        const values = { nomimosMisthos: '0', afora_egkekrimenh_rythmish_ergasias: '1' };
        const changes = baseline.editableCells.map((entry, index) => ({ index,
            value: entry.role === 'DECLARATION' ? '1' : values[entry.canonicalField] ?? '' }));
        const falseEntry = baseline.editableCells.find(entry => entry.canonicalField === 'afora_egkekrimenh_rythmish_ergasias');
        changes.find(change => baseline.editableCells[change.index] === falseEntry).value = String(E.editorChoices(falseEntry, f.catalogs).findIndex(option => option.id === false));
        const proposal = { selection: `UPDATE:${f.history[0]._id}`, completion: { caseId: baseline.caseSelection.selectedCase.id,
            snapshotFingerprint: baseline.snapshotFingerprint, context: E.editorContext(f.req, baseline.snapshotFingerprint, baseline.caseSelection.selectedCase.id), changes } };
        const before = await db.historyModel.findById(f.history[0]._id).lean(), commands = [];
        const capture = event => { if (event.commandName === 'update') commands.push(event.command); };
        db.connection.getClient().on('commandStarted', capture);
        const service = create(f.dependencies), preview = await service.preview(f.req, proposal);
        assert.equal(preview.rows.length, 2); assert.equal(preview.physicalWrites.history.mode, 'PHYSICAL_UPDATE');
        const result = await service.apply(f.req, approve(proposal, preview));
        db.connection.getClient().off('commandStarted', capture);
        assert.equal(result.selectedCaseStatus, Row.STATUS);
        const after = await db.historyModel.findById(f.history[0]._id).lean();
        assert.equal(after.nomimosMisthos, 0); assert.equal(after.afora_egkekrimenh_rythmish_ergasias, false);
        assert.equal(Object.hasOwn(after, 'poso_symbashs_01'), false);
        assert.equal(A.equal(after, { ...before, nomimosMisthos: 0, afora_egkekrimenh_rythmish_ergasias: false, updatedAt: after.updatedAt }), true);
        const updates = commands.flatMap(command => command.updates).filter(update => Object.hasOwn(update.u.$set || {}, 'nomimosMisthos'));
        assert.equal(updates.length, 1); assert.deepEqual(Object.keys(updates[0].u.$set).sort(), ['afora_egkekrimenh_rythmish_ergasias', 'nomimosMisthos', 'updatedAt']);
        const audit = await db.auditModel.findById(result.auditId).lean();
        assert.equal(audit.diagnostics.rowApproval.facts.filter(fact => fact.specified).length, 2);
        const absent = audit.diagnostics.rowApproval.facts.find(fact => fact.field === 'poso_symbashs_01');
        assert.deepEqual(absent.before, { recorded: false }); assert.deepEqual(absent.after, { recorded: false });
        assert.ok(changes.length - 3 >= 90);
        console.log(`Πραγματικό XLSX: 2 ρητές μεταβολές, ${changes.length - 3} κενά ΜΕΤΑ και αμετάβλητα προστατευμένα στοιχεία.`);
    });
    await t.test('Κενό XLSX → εισαγωγή → επεξεργαστής → προεπισκόπηση: διατήρηση αρχικών τιμών και ρητών 0/false', async () => {
        const f = await seedApprovedProposal(db), input = await f.input(), selection = `UPDATE:${f.history[0]._id}`;
        const baseline = await X.buildEmployeeHistoryProposalWorkbook(input, f.catalogs, { selection });
        for (const entry of baseline.editableCells) baseline.workbook.getWorksheet(entry.sheet).getCell(entry.cell).value = null;
        for (const [field, value] of [['nomimosMisthos', 0], ['afora_egkekrimenh_rythmish_ergasias', 'Όχι']]) {
            const entry = baseline.editableCells.find(entry => entry.canonicalField === field);
            baseline.workbook.getWorksheet(entry.sheet).getCell(entry.cell).value = value;
        }
        const imported = await I.previewEmployeeHistoryProposalImport({ buffer: await X.serializeEmployeeHistoryProposalWorkbook(baseline.workbook), input, catalogs: f.catalogs, req: f.req });
        const fresh = await X.buildEmployeeHistoryProposalWorkbook(input, f.catalogs, { selection });
        const completion = { caseId: fresh.caseSelection.selectedCase.id, snapshotFingerprint: fresh.snapshotFingerprint,
            context: E.editorContext(f.req, fresh.snapshotFingerprint, fresh.caseSelection.selectedCase.id),
            changes: imported.editorValues.values.map(item => {
                const index = fresh.editableCells.findIndex(entry => (entry.canonicalField || entry.fieldId) === item.fieldId);
                const choices = E.editorChoices(fresh.editableCells[index], f.catalogs);
                return { index, value: item.value === null ? '' : choices.length ? String(choices.findIndex(choice => A.equal(choice.id, item.value))) : item.value };
            }) };
        const preview = await create(f.dependencies).preview(f.req, { selection, completion });
        assert.deepEqual(preview.rows.map(row => row.fieldId), ['nomimosMisthos']);
        assert.equal(imported.editorValues.values.find(item => item.fieldId === 'pragmatikosMisthos').value, null);
    });
    await t.test('Παλιά 0001: έγκριση χωρίς αλλαγές και ανεξαρτησία άλλων ελλείψεων', async () => {
        const f = await seedLegacyStructure(db), before = await rawState(f);
        const { result, audit, service, proposal, preview } = await submit(f, {});
        const after = await rawState(f);
        assert.deepEqual(after.history, before.history); assert.deepEqual(after.controls, before.controls); assert.deepEqual(after.frozen, before.frozen);
        assert.deepEqual(audit.diagnostics.approvedFields, []); assert.equal(audit.diagnostics.rowApproval.mode, 'APPROVAL_ONLY');
        assert.equal(audit.diagnostics.actualAfter.aa_eggrafhs, '0001'); assert.equal(result.historyStatus, 'REVIEW_REQUIRED');
        const current = await db.employeeModel.findById(f.employee._id).lean();
        const history = await db.historyModel.find(f.scope).lean();
        const reviewed = await require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter').writeEmployeeEmploymentHistoryOperations({
            ...f.dependencies, scope: f.scope, employeeId: String(f.employee._id), actorUserId: String(f.actor), operations: [],
            expectedStateToken: require('../../server/services/ergazomenoi/employeeHistoryEditorStateService')
                .buildEmployeeHistoryEditorStateToken({ currentEmployee: current, historyRows: history }),
            correction: { intent: 'REVIEW', targetHistoryId: String(f.history[0]._id), facts: {}, confirmation: null } });
        assert.equal(reviewed.selectedCaseStatus, Row.STATUS); assert.equal(reviewed.saved, false);
        const next = await X.buildEmployeeHistoryProposalWorkbook(await f.input(), f.catalogs);
        assert.equal(next.caseSelection.cases.some(item => item.operation === 'UPDATE' && item.targetHistoryId === String(f.history[0]._id)), false);
        await db.historyModel.collection.updateOne({ _id: f.history[1]._id }, { $set: { nomimosMisthos: 17 } });
        assert.equal((await service.reconcile(f.req, { proposal, token: preview.approval.token })).selectedCaseStatus, Row.STATUS);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: { nomimosMisthos: 18 } });
        await assert.rejects(service.reconcile(f.req, { proposal, token: preview.approval.token }), error => error.saved === true);
    });
    await t.test('Προστατευμένη περίοδος: διορθωτική έκδοση, αμετάβλητο πρωτότυπο/αποτέλεσμα/αποτύπωμα και αναγνώστης έκδοσης', async () => {
        const f = await seedLegacyStructure(db); await seedLegacyFrozen(f, { finalized: true });
        const before = await rawState(f), { audit } = await submit(f, { nomimosMisthos: '1456.78' });
        const after = await rawState(f);
        assert.deepEqual(after.history, before.history); assert.deepEqual(after.frozen, before.frozen); assert.deepEqual(after.controls, before.controls);
        assert.equal(audit.diagnostics.rowApproval.mode, 'CORRECTION_EDITION');
        assert.equal(audit.diagnostics.rowApproval.approvedContent.nomimosMisthos, 1456.78);
        const input = await f.input(), row = input.completeHistoryRows.find(row => String(row._id) === String(f.history[0]._id));
        assert.equal(Row.reviewedRow(input, row).nomimosMisthos, 1456.78);
        const exported = await X.buildEmployeeHistoryProposalWorkbook(input, f.catalogs, { selection: `UPDATE:${row._id}` });
        assert.equal(exported.editableCells.find(entry => entry.canonicalField === 'nomimosMisthos').rawProposed, 1456.78);
        const repeated = await submit(f, {}); assert.equal(repeated.preview.rows.length, 0);
    });
    for (const phase of ['audit', 'verification']) await t.test(`Αποτυχία ${phase}: πραγματική αναίρεση ολόκληρης συναλλαγής`, async () => {
        const f = await seedApprovedProposal(db), before = await f.snapshot(), proposal = await approvedProposalBody(f);
        const auditModel = proxy(db.auditModel, { async create(records, options) {
            const result = await db.auditModel.create(records, options);
            if (phase === 'audit') throw Error('SYNTHETIC_AUDIT_FAILURE');
            await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: { nomimosMisthos: 999 } }, options);
            return result;
        } });
        const service = create({ ...f.dependencies, auditModel }), preview = await service.preview(f.req, proposal);
        await assert.rejects(service.apply(f.req, approve(proposal, preview))); assert.equal(await f.snapshot(), before);
    });
    await t.test('Αλλαγή αρχικής έκδοσης και ανάκληση δικαιωμάτων δεν δηλώνουν ολοκλήρωση', async () => {
        const f = await seedApprovedProposal(db), service = create(f.dependencies), proposal = await approvedProposalBody(f), preview = await service.preview(f.req, proposal);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: { nomimosMisthos: 333 } });
        const before = await f.snapshot(); await assert.rejects(service.apply(f.req, approve(proposal, preview))); assert.equal(await f.snapshot(), before);
        const next = await approvedProposalBody(f), checked = await service.preview(f.req, next);
        await db.privilegeModel.collection.updateOne({ userId: String(f.actor) }, { $set: { 'privileges.update': false } });
        await assert.rejects(service.apply(f.req, approve(next, checked))); assert.equal(await db.auditModel.countDocuments({ 'employeeScope.employee_id': f.employee._id }), 0);
    });
    await t.test('Chromium: μία οθόνη χωρίς πιστοποιήσεις, κενά ΜΕΤΑ και προσαρμογή με ανοικτό/κλειστό πλευρικό μενού', async () => {
        const f = await seedLegacyStructure(db), service = create(f.dependencies), http = await startApprovedProposalHttp(f, service);
        const browser = await require('playwright').chromium.launch({ headless: true }), page = await browser.newPage();
        try {
            await page.goto(`${http.origin}/api/ergazomenoi/${f.employee._id}/history-proposal-editor?selection=UPDATE:${f.history[0]._id}`);
            assert.equal(await page.locator('#legacyHistoryCertification, #previewProposalCertification, #proposalCertificationConsent').count(), 0);
            await page.locator('[data-field-id="nomimosMisthos"]').fill('');
            await page.locator('[data-field-id="DECLARATION"]').selectOption({ label: 'Ναι' });
            await page.locator('#previewProposalApply').click(); await page.locator('#approveProposalApply:enabled').waitFor();
            for (const [width, height] of [[1920,1080],[1680,1050],[1600,900],[1440,900],[1280,1024],[1280,800],[1280,720],[480,700],[900,450]]) for (const sidebar of [false, true]) {
                await page.setViewportSize({ width, height });
                await page.evaluate(open => { const main = document.querySelector('.proposal-page'); main.style.width = open ? 'calc(100% - 160px)' : ''; main.style.marginLeft = open ? '160px' : ''; }, sidebar);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                const button = page.locator('#approveProposalApply'); await button.scrollIntoViewIfNeeded();
                assert.equal(await button.evaluate(node => { const rect = node.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight; }), true);
            }
            await page.locator('#approveProposalApply').click();
            await page.waitForFunction(() => document.getElementById('previewProposalApply').dataset.completed === 'true');
            assert.match(await page.locator('#proposalApplyStatus').textContent(), /Εγκεκριμένη — Ολοκληρωμένη/);
            await page.locator('#openPersistedProposal').click();
            assert.match(await page.locator('#historyProposalEditor').textContent(), /Εγκεκριμένη — Ολοκληρωμένη/);
        } finally { await browser.close(); await http.close(); }
    });
});
