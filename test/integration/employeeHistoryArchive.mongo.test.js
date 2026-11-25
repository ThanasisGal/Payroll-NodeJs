'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startApprovedProposalMongo, seedApprovedProposal, approvedProposalBody } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const Archive = require('../../server/services/ergazomenoi/employeeHistoryArchiveService');
const State = require('../../server/services/ergazomenoi/employeeHistoryArchiveStateService');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const Validation = require('../../server/services/ergazomenoi/employeeHistorySaveValidationService');
const X = require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const { readOperationalHistory } = require('../../server/services/ergazomenoi/employeeHistoryOperationalReadService');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
async function input(f, db) {
    const i = await f.input();
    return require('../../server/services/ergazomenoi/employeeHistoryMaintenanceApprovalService').loadMaintenanceApprovalInput(i, db.auditModel);
}
async function body(f, db, row = f.history[0]) {
    return { ...Archive.descriptor(f.req, await input(f, db), row), confirmed: true };
}
test('Αρχειοθέτηση διαχείρισης σε ιδιόκτητη απομονωμένη MongoDB', { skip: !binary, timeout: 180000 }, async t => {
    assert.equal(mongoose.connection.readyState, 0);
    const db = await startApprovedProposalMongo(binary); t.after(db.close);
    const service = Archive.createEmployeeHistoryArchiveService(db);
    for (const role of ['HR', 'S', 'A']) await t.test(`Δικαίωμα ${role}, ακριβές Audit και idempotency χωρίς καμία εγγραφή στο Ιστορικό`, async () => {
        const f = await seedApprovedProposal(db);
        await db.userModel.collection.updateOne({ _id: f.actor }, { $set: { privileges: role } });
        const b = await body(f, db), before = await f.snapshot(), commands = [];
        const capture = e => { if (['update', 'delete', 'insert'].includes(e.commandName)) commands.push(e.command); };
        db.connection.getClient().on('commandStarted', capture);
        const result = await service.archive(f.req, b);
        db.connection.getClient().off('commandStarted', capture);
        assert.equal(result.state, State.STATUS);
        const after = JSON.parse(await f.snapshot()), original = JSON.parse(before);
        assert.deepEqual(after.history, original.history);
        assert.deepEqual(after.controls, original.controls);
        const { employee_profile_mutation_sequence, ...current } = after.current;
        assert.deepEqual(current, original.current);
        assert.equal(employee_profile_mutation_sequence, 1);
        assert.equal(after.audits.length, 1);
        const audit = await db.auditModel.findById(result.auditId).lean();
        assert.equal(audit.diagnostics.actorUserId, String(f.actor));
        assert.equal(audit.diagnostics.previousState, 'VISIBLE');
        assert.equal(audit.diagnostics.correctnessApproved, false);
        assert.ok(audit.repairedAt instanceof Date);
        assert.deepEqual(audit.historyBefore, audit.historyAfter);
        assert.ok(commands.every(command => command.update !== db.historyModel.collection.name && command.delete !== db.historyModel.collection.name));
        const snapshot = await f.snapshot();
        assert.equal((await service.archive(f.req, b)).alreadyArchived, true);
        assert.equal(await f.snapshot(), snapshot);
        const i = await input(f, db);
        assert.ok(!State.visibleRows(i).some(row => String(row._id) === String(f.history[0]._id)));
        await assert.rejects(X.buildEmployeeHistoryProposalWorkbook(i, f.catalogs, { selection: `UPDATE:${f.history[0]._id}` }), { statusCode: 404 });
    });
    for (const scenario of ['customer', 'inactive', 'no-update', 'other-team', 'other-company', 'other-employee'])
        await t.test(`Απόρριψη ${scenario} χωρίς μεταβολή`, async () => {
            const f = await seedApprovedProposal(db), b = await body(f, db);
            if (scenario === 'customer') await db.userModel.collection.updateOne({ _id: f.actor }, { $set: { privileges: 'C' } });
            if (scenario === 'inactive') await db.userModel.collection.updateOne({ _id: f.actor }, { $set: { situation: 'I' } });
            if (scenario === 'no-update') await db.privilegeModel.collection.updateOne({ userId: String(f.actor) }, { $set: { privileges: { read: true } } });
            if (scenario === 'other-team') await db.userModel.collection.updateOne({ _id: f.actor }, { $set: { team: 'OTHER' } });
            if (scenario === 'other-company') f.req.session.companyInUse = String(new mongoose.Types.ObjectId());
            if (scenario === 'other-employee') f.req.params.id = String(new mongoose.Types.ObjectId());
            const before = await f.snapshot();
            await assert.rejects(service.archive(f.req, b), { statusCode: 403 });
            assert.equal(await f.snapshot(), before);
        });
    await t.test('Stale εγγραφή, παράλληλα αιτήματα και αποτυχία Audit: ατομικότητα', async () => {
        const f = await seedApprovedProposal(db), stale = await body(f, db);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: { nomimosMisthos: 1700 } });
        const before = await f.snapshot();
        await assert.rejects(service.archive(f.req, stale), { statusCode: 409 });
        assert.equal(await f.snapshot(), before);
        const b = await body(f, db);
        const failing = Archive.createEmployeeHistoryArchiveService({ ...db, auditModel: new Proxy(db.auditModel, {
            get(target, key) { return key === 'create' ? async () => { throw Error('synthetic audit failure'); } : Reflect.get(target, key); }
        }) });
        await assert.rejects(failing.archive(f.req, b), /synthetic audit failure/);
        assert.equal(await f.snapshot(), before);
        const results = await Promise.all([service.archive(f.req, b), service.archive(f.req, b)]);
        assert.equal(results.filter(r => r.alreadyArchived).length, 1);
        assert.equal(await db.auditModel.countDocuments({ 'employeeScope.employee_id': f.employee._id }), 1);
    });
    await t.test('Παλαιά πρόταση και XLSX δεν επαναφέρουν την εγγραφή', async () => {
        const f = await seedApprovedProposal(db);
        const proposal = await approvedProposalBody(f), approvals = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService')
            .createEmployeeHistoryApprovedProposalService(f.dependencies);
        const preview = await approvals.preview(f.req, proposal);
        const old = await X.buildEmployeeHistoryProposalWorkbook(await f.input(), f.catalogs, { selection: proposal.selection });
        const buffer = await X.serializeEmployeeHistoryProposalWorkbook(old.workbook);
        await service.archive(f.req, await body(f, db));
        const before = await f.snapshot();
        await assert.rejects(approvals.apply(f.req, { proposal, approval: { token: preview.approval.token, confirmed: true } }));
        await assert.rejects(require('../../server/services/ergazomenoi/employeeHistoryProposalImportService').previewEmployeeHistoryProposalImport({
            buffer, input: await input(f, db), catalogs: f.catalogs, req: f.req }));
        assert.equal(await f.snapshot(), before);
    });
    await t.test('Μοναδική πηγή όρων: ακριβώς ίδιοι επιχειρησιακοί αναγνώστες και εξαρτώμενα ΠΡΙΝ/ΜΕΤΑ', async () => {
        const f = await seedApprovedProposal(db);
        // Three real recorded periods; the selected first period has no other source.
        const refs = db.connection.collection('Oraria_Apologistika');
        await refs.insertOne({ employee: f.employee._id, effective_profile_istoriko_id: String(f.history[0]._id), cards: ['08:00', '16:00'], finalized: { amount: 1234.56 } });
        const read = async () => A.stringify(await readOperationalHistory(db.historyModel.find(f.scope).sort({ aa_eggrafhs: 1 }).lean()));
        const frozen = await require('../fixtures/employeeHistoryLegacyStructure').seedLegacyFrozen(f, { finalized: true, from: '2026-01-01', to: '2026-01-31' });
        const frozenBefore = await frozen.raw();
        const facts = await read(), dependent = await refs.find({ employee: f.employee._id }).toArray();
        const resolver = require('../../server/utils/ergazomenoi/employmentProfileHistory');
        const i = await f.input();
        const periods = ['2026-01-05', '2026-03-02', '2026-07-06'];
        const resolve = rows => periods.map(date => resolver.resolveEmploymentProfileFactsForDate(date, rows, { currentEmployee: i.currentEmployee }));
        const before = resolve(i.completeHistoryRows);
        const compute = rows => periods.map(date => {
            const terms = require('../../server/utils/ergazomenoi/getOrarioTermsForDate').getOrarioTermsForDate(date, rows, i.currentEmployee);
            assert.equal(terms.source, 'ISTORIKO');
            const cards = require('../../server/services/ergazomenoi/apasxoliseisDailyActualWorkFactsService').resolveDailyActualWorkFacts({
                kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: terms.mo_oron_hmerhsias_ergasias,
                cards_ores_ergasias: 8, cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00' });
            assert.equal(cards.actualWorkHours, 8);
            return { terms, cards };
        });
        const calculatedBefore = compute(i.completeHistoryRows);
        await service.archive(f.req, await body(f, db));
        assert.equal(await read(), facts);
        assert.deepEqual(await frozen.raw(), frozenBefore);
        assert.deepEqual(await refs.find({ employee: f.employee._id }).toArray(), dependent);
        assert.deepEqual(resolve((await f.input()).completeHistoryRows), before);
        assert.deepEqual(compute((await f.input()).completeHistoryRows), calculatedBefore);
        assert.equal((await db.historyModel.find(f.scope).lean()).length, f.history.length);
    });
    await t.test('Ελλιπής εγγραφή: διαχειριστικά ολοκληρωμένη χωρίς πιστοποίηση τιμών, νέες ελλείψεις αυστηρές', async () => {
        const f = await seedApprovedProposal(db);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $unset: { kpk: 1, krathsh_01: 1 }, $set: { nomimosMisthos: 0, pragmatikosMisthos: 0 } });
        const i = await input(f, db), raw = Validation.inspectEmployeeHistorySave({ scope: i.scope, currentEmployee: i.currentEmployee, historyRows: i.completeHistoryRows });
        assert.notEqual(raw.status, 'CLEAN');
        await service.archive(f.req, await body(f, db));
        const fresh = await input(f, db);
        const managed = Validation.inspectEmployeeHistorySave({ scope: fresh.scope, currentEmployee: fresh.currentEmployee,
            historyRows: fresh.completeHistoryRows, approvedHistoryInput: fresh });
        assert.equal(managed.status, 'MANAGEMENT_RESOLVED', JSON.stringify(managed.issues));
        assert.deepEqual(managed.verification, Validation.inspectEmployeeHistorySave({ scope: fresh.scope, currentEmployee: fresh.currentEmployee, historyRows: fresh.completeHistoryRows, includeIssueDetails: true }).verification);
        assert.equal(managed.historyCertified, false);
        assert.equal(State.managementPreview(fresh).managementResolved, true);
        const cases = require('../../server/services/ergazomenoi/employeeHistoryProposalCaseService')
            .selectEmployeeHistoryProposalCase(fresh, { status: 'REVIEW_REQUIRED' });
        assert.equal(cases.total, 0);
        const altered = fresh.completeHistoryRows.map((row, index) => index === 1 ? { ...row, mo_oron_hmerhsias_ergasias: -3 } : row);
        const invalid = Validation.inspectEmployeeHistorySave({ scope: fresh.scope, currentEmployee: fresh.currentEmployee,
            historyRows: altered, approvedHistoryInput: fresh });
        assert.equal(State.managementReady(invalid), false);
        assert.throws(() => State.assertArchivesPreserved(fresh, fresh.completeHistoryRows.slice(1)), /ARCHIVE_IMMUTABLE/);
    });
    await t.test('Αποθήκευση ανεξάρτητων στοιχείων διατηρεί την αρχειοθέτηση χωρίς δεύτερη εγγραφή Ιστορικού', async () => {
        const f = await seedApprovedProposal(db);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $unset: { krathsh_01: 1 } });
        await service.archive(f.req, await body(f, db));
        const before = (await f.input()).completeHistoryRows;
        const saved = await W.writeEmployeeMaintenance({ ...f.dependencies, scope: f.scope, employeeId: String(f.employee._id), actorUserId: String(f.actor),
            maintenance: { employeeChanges: { thlefono: '2101234567' } } });
        assert.equal(saved.employeeUpdated, true);
        assert.equal(saved.historyStatus, 'MANAGEMENT_RESOLVED');
        assert.equal(saved.externalActionsAllowed, true);
        const mock = require('../fixtures/employeeHistoryArchiveErganiMock').mockArchiveErgani();
        const uploaded = await mock.upload({ submissionCode: 'MA', payload: { syntheticEmployee: String(f.employee._id) },
            creds: { username: 'synthetic', password: 'synthetic' } });
        assert.equal(uploaded.success, true);
        assert.equal(uploaded.protocol, 'SYNTHETIC-ARCHIVE-1');
        assert.deepEqual(mock.calls.filter(call => typeof call === 'string'), ['authenticate', 'lookup', 'logout']);
        assert.equal(mock.calls.filter(call => typeof call === 'object').length, 1);
        assert.deepEqual((await f.input()).completeHistoryRows, before);
        assert.equal(State.visibleRows(await input(f, db)).length, before.length - 1);
    });

    await t.test('Ήδη εγκεκριμένη διορθωτική έκδοση και οριστικοποιημένη περίοδος παραμένουν επιχειρησιακά ίδιες', async () => {
        const f = await seedApprovedProposal(db);
        await require('../fixtures/employeeHistoryLegacyStructure').seedLegacyFrozen(f, { finalized: true, from: '2026-01-01', to: '2026-01-31' });
        const proposal = await approvedProposalBody(f);
        const approvals = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService')
            .createEmployeeHistoryApprovedProposalService(f.dependencies);
        const preview = await approvals.preview(f.req, proposal);
        assert.equal(preview.physicalWrites.history.mode, 'CORRECTION_EDITION');
        await approvals.apply(f.req, { proposal, approval: { token: preview.approval.token, confirmed: true } });
        const read = () => readOperationalHistory(db.historyModel.find(f.scope).sort({ aa_eggrafhs: 1 }).lean());
        const before = await read();
        assert.equal(before[0].nomimosMisthos, 1456.78);
        await service.archive(f.req, await body(f, db));
        assert.deepEqual(await read(), before);
        assert.equal(State.visibleRows(await input(f, db)).length, f.history.length - 1);
    });
    await t.test('Νέα πραγματική μεταβολή μετά την αρχειοθέτηση με αυστηρή επικύρωση και χωρίς επαναφορά', async () => {
        const f = await seedApprovedProposal(db);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $unset: { krathsh_01: 1 } });
        await service.archive(f.req, await body(f, db));
        const before = await input(f, db);
        const Atomic = require('../../server/services/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceService');
        const atomic = Atomic.createApprovedHistoryAtomicMaintenanceService({ ...db,
            enabled: () => true, secret: 'synthetic-archive-atomic-secret-32' });
        const terms = { hmeres_ergasias_ebdomadas: 6, ores_ergasias_ebdomadas: 40,
            mo_oron_hmerhsias_ergasias: 6.67, typos_ebdomadas: '6HMERH' };
        const change = { kind: 'NEW_CHANGE', effectiveFrom: '2026-06-01', correctedTerms: terms };
        const preview = await atomic.preview(f.req, change);
        const result = await atomic.apply(f.req, change, preview.approval);
        assert.equal(result.success, true);
        const after = await input(f, db);
        assert.equal(after.completeHistoryRows.length, before.completeHistoryRows.length + 1);
        assert.deepEqual(after.completeHistoryRows.find(row => String(row._id) === String(f.history[0]._id)),
            before.completeHistoryRows.find(row => String(row._id) === String(f.history[0]._id)));
        assert.equal(State.visibleRows(after).some(row => String(row._id) === String(f.history[0]._id)), false);
        const bad = { ...change, effectiveFrom: '2026-07-01', correctedTerms: { ...terms, mo_oron_hmerhsias_ergasias: -1 } };
        await assert.rejects(atomic.preview(f.req, bad));
    });
    await t.test('Πραγματικό reconstruction μετά την αρχειοθέτηση δεν αναδημιουργεί ούτε εμφανίζει την εγγραφή', async () => {
        const f = await seedApprovedProposal(db);
        await service.archive(f.req, await body(f, db));
        const state = await input(f, db);
        const planner = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService').planEmployeeHistoryAutomaticReconstruction;
        const plan = planner(state);
        const token = A.buildAutomaticReconstructionPreviewToken({ ...state, plan, actorUserId: String(f.actor) });
        await require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyService').applyEmployeeHistoryAutomaticReconstruction({
            ...f.dependencies, scope: f.scope, employeeId: String(f.employee._id), actorUserId: String(f.actor),
            previewToken: token, approvalAccepted: true });
        const after = await input(f, db);
        assert.deepEqual(after.completeHistoryRows, state.completeHistoryRows);
        assert.equal(State.visibleRows(after).length, f.history.length - 1);
    });
});
