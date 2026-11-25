'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startApprovedProposalMongo } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { seed, controller } = require('../fixtures/employeeHistoryArchiveFormHarness');
const { rawState } = require('../fixtures/employeeHistoryLegacyStructure');
const Archive = require('../../server/services/ergazomenoi/employeeHistoryArchiveService');
const State = require('../../server/services/ergazomenoi/employeeHistoryArchiveStateService');
const Approval = require('../../server/services/ergazomenoi/employeeHistoryMaintenanceApprovalService');
const Validation = require('../../server/services/ergazomenoi/employeeHistorySaveValidationService');
const { readOperationalHistory } = require('../../server/services/ergazomenoi/employeeHistoryOperationalReadService');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const five = { hmeres_ergasias_ebdomadas: 5, typos_ebdomadas: '5HMERH', ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
const six = { hmeres_ergasias_ebdomadas: 6, typos_ebdomadas: '6HMERH', ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 6.67 };
const describe = (h, response) => JSON.stringify({ response: response.body, errors: h.errors });

test('PR419 P1: πραγματική πλήρης φόρμα με historyPreflight και απομονωμένη MongoDB',
    { skip: !binary, timeout: 180000 }, async t => {
    assert.equal(mongoose.connection.readyState, 0);
    const db = await startApprovedProposalMongo(binary); t.after(db.close);
    for (const [key, model] of Object.entries({
        scheduleModel: require('../../server/models/ergazomenoi').ProdhlomenaOrariaModel,
        branchModel: require('../../server/models/companies').YpokatasthmataModel
    })) {
        db[key] = db.connection.model(model.modelName, model.schema.clone());
        await db[key].createCollection();
    }
    async function setup({ overlap = true, archive = true } = {}) {
        const f = await seed(db);
        const target = f.history.find(row => row.aa_eggrafhs === '0001');
        if (overlap) await db.historyModel.collection.updateOne({ _id: target._id },
            { $set: { hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-04-15') } });
        if (archive) await db.historyModel.collection.updateOne({ _id: target._id }, { $unset: { krathsh_01: 1 } });
        const input = () => f.input().then(i => Approval.loadMaintenanceApprovalInput(i, db.auditModel));
        if (archive) {
            const i = await input(), row = i.completeHistoryRows.find(row => String(row._id) === String(target._id));
            await Archive.createEmployeeHistoryArchiveService(db).archive(f.req,
                { ...Archive.descriptor(f.req, i, row), confirmed: true });
            const managed = await input();
            const inspection = Validation.inspectEmployeeHistorySave({ scope: f.scope, currentEmployee: managed.currentEmployee,
                historyRows: require('../../server/services/ergazomenoi/employeeHistoryProposalReadService').proposalHistoryState(managed).historyRows,
                approvedHistoryInput: managed });
            assert.equal(inspection.status, 'MANAGEMENT_RESOLVED', JSON.stringify(inspection.issues));
            assert.equal(inspection.historyCertified, false);
        }
        const h = await controller(db, f); t.after(h.close);
        const payload = async (changes = {}, external = false) => {
            const current = (await input()).currentEmployee;
            const terms = Object.fromEntries(Object.keys(five).map(field => [field, current[field]]));
            const body = await h.payload('NEW_CHANGE', terms);
            delete body.change;
            Object.assign(body.formData, changes);
            if (external) body.filesToUpdate = { ...body.filesToUpdate,
                erganiUploadMethod: 'rest', e3_metaboles_ergasiakhs_sxeshs: true };
            return body;
        };
        async function save(body) {
            assert.equal(body.historyPreflight, true);
            const preview = await h.submit(body);
            assert.equal(preview.body.success, true, describe(h, preview));
            // The established independent/no-op shortcut may finish in the
            // first request. A historical preview always needs signed APPLY.
            const result = preview.body.preflight ? await h.submit(h.confirm(body, preview)) : preview;
            assert.equal(result.body.success, true, describe(h, result));
            return result;
        }
        return { f, h, target, input, payload, save };
    }
    async function preserved(s, before, { newAudits = 0, changedHistoryId = null } = {}) {
        const after = await rawState(s.f);
        for (const key of ['controls', 'frozen']) assert.deepEqual(after[key], before[key], key);
        if (newAudits) {
            const prior = mongoose.mongo.BSON.deserialize(before.company);
            const current = mongoose.mongo.BSON.deserialize(after.company);
            const field = 'employee_history_period_mutation_sequence';
            assert.equal(current[field], (prior[field] || 0) + newAudits);
            delete prior[field]; delete current[field]; assert.deepEqual(current, prior);
        } else assert.deepEqual(after.company, before.company);
        const history = new Map(after.history.map(raw => [String(mongoose.mongo.BSON.deserialize(raw)._id), raw]));
        for (const raw of before.history) {
            const id = String(mongoose.mongo.BSON.deserialize(raw)._id);
            if (id !== changedHistoryId) assert.equal(history.get(id)?.equals(raw), true, 'Original History BSON');
        }
        const audits = new Map(after.audit.map(raw => [String(mongoose.mongo.BSON.deserialize(raw)._id), raw]));
        for (const raw of before.audit)
            assert.equal(audits.get(String(mongoose.mongo.BSON.deserialize(raw)._id))?.equals(raw), true, 'Original Audit BSON');
        assert.equal(after.audit.length, before.audit.length + newAudits);
        const fresh = await s.input();
        assert.equal(State.visibleRows(fresh).some(row => String(row._id) === String(s.target._id)), false);
    }
    await t.test('Α: αρχειοθετημένη επικάλυψη και τηλέφωνο — πραγματική τελική αποθήκευση', async () => {
        const s = await setup(), before = await rawState(s.f);
        const result = await s.save(await s.payload({ thlefono: '2101234567' }));
        assert.equal(result.body.employeeUpdated, true);
        assert.equal(result.body.historyUpdated, false);
        assert.equal(result.body.historyStatus, 'MANAGEMENT_RESOLVED');
        assert.equal((await s.input()).currentEmployee.thlefono, '2101234567');
        assert.ok(Object.keys(s.h.requests[0].maintenance.submittedFormValues).length > 300);
        await preserved(s, before);
    });
    await t.test('Β: email και ανεξάρτητη διεύθυνση αποθηκεύονται', async () => {
        const s = await setup(), before = await rawState(s.f);
        await s.save(await s.payload({ email: 'synthetic@example.invalid', arithmos: '12' }));
        const current = (await s.input()).currentEmployee;
        assert.equal(current.email, 'synthetic@example.invalid'); assert.equal(current.arithmos, '12');
        await preserved(s, before);
    });
    for (const changed of [false, true]) await t.test(`Γ: έγγραφα και mock ΕΡΓΑΝΗ, ανεξάρτητη αλλαγή=${changed}`, async () => {
        const s = await setup(), before = await rawState(s.f);
        const result = await s.save(await s.payload(changed ? { thlefono: '2109876543' } : {}, true));
        assert.equal(result.body.externalActionsAllowed, true);
        assert.equal(result.body.maXmlData.success, true);
        assert.deepEqual(s.h.effects, [{ type: 'MA_XML', days: 5 }]);
        const mock = require('../fixtures/employeeHistoryArchiveErganiMock').mockArchiveErgani();
        const response = await mock.upload({ submissionCode: 'MA', payload: { xml: result.body.maXmlData.xml },
            creds: { username: 'synthetic', password: 'synthetic' } });
        assert.equal(response.protocol, 'SYNTHETIC-ARCHIVE-1');
        assert.equal(mock.calls.filter(call => typeof call === 'object').length, 1);
        await preserved(s, before);
    });
    await t.test('Αμετάβλητη πλήρης φόρμα: κανονική συνέχεια χωρίς ιστορική εγγραφή', async () => {
        const s = await setup(), before = await rawState(s.f);
        const body = await s.payload({ symbash: ' 01 ', symbash_stathera: ' 01 ', poso_symbashs_basei_oron_ergasias_01: '1000' });
        const result = await s.save(body);
        assert.equal(result.body.employeeUpdated, false);
        assert.deepEqual(await rawState(s.f), before);
    });
    await t.test('Δ και Ζ: αυστηρή νέα μεταβολή 5→6 και διόρθωση 6→5 χωρίς αναβίωση', async () => {
        const s = await setup(), before = await rawState(s.f);
        const body = await s.h.payload('NEW_CHANGE', six);
        await s.save(body);
        const afterNew = await rawState(s.f), state = await s.input();
        const successor = state.completeHistoryRows.find(row => row.aa_eggrafhs === '0004');
        assert.ok(successor); assert.equal(successor.hmeres_ergasias_ebdomadas, 6);
        await preserved(s, before, { newAudits: 1 });
        await s.save(await s.h.payload('CORRECT_SAVED_ERROR', five, String(successor._id)));
        const final = await s.input(), corrected = final.completeHistoryRows.find(row => String(row._id) === String(successor._id));
        assert.equal(final.currentEmployee.hmeres_ergasias_ebdomadas, 5);
        assert.equal(corrected.hmeres_ergasias_ebdomadas, 5);
        assert.equal(final.completeHistoryRows.length, state.completeHistoryRows.length);
        assert.equal(+corrected.hmeromhnia_isxyos_oron_ergasias_apo, +successor.hmeromhnia_isxyos_oron_ergasias_apo);
        await preserved(s, afterNew, { newAudits: 1, changedHistoryId: String(successor._id) });
        assert.equal(State.managementPreview(final).managementResolved, true);
        const independent = await s.save(await s.payload({ email: 'after-correction@example.invalid' }));
        assert.equal(independent.body.historyStatus, 'MANAGEMENT_RESOLVED');
        assert.equal(independent.body.historyUpdated, false);
    });
    await t.test('Ε: άκυρο νέο ιστορικό απορρίπτεται αυστηρά', async () => {
        const s = await setup({ overlap: false }), before = await rawState(s.f);
        const response = await s.h.submit(await s.h.payload('NEW_CHANGE', { ...six, mo_oron_hmerhsias_ergasias: -1 }));
        assert.equal(response.body.success, false);
        assert.deepEqual(await rawState(s.f), before);
    });
    await t.test('ΣΤ: μικτή αλλαγή χωρίς εντολή ιστορικού δεν παρακάμπτει την επικύρωση', async () => {
        const s = await setup(), before = await rawState(s.f);
        const response = await s.h.submit(await s.payload({ thlefono: '2101234567', pragmatikosMisthos: 1550 }));
        assert.equal(response.body.success, false);
        assert.deepEqual(await rawState(s.f), before);
    });
    await t.test('ΣΤ: έγκυρη μικτή αλλαγή απαιτεί υπογεγραμμένη έγκριση', async () => {
        const s = await setup({ overlap: false }), before = await rawState(s.f);
        const body = await s.h.payload('NEW_CHANGE', six); body.formData.thlefono = '2101234567';
        const preview = await s.h.submit(body);
        assert.equal(preview.body.decision, 'COMBINED_SAVE', describe(s.h, preview));
        assert.deepEqual(await rawState(s.f), before);
        const forged = await s.h.submit({ ...body, historyPreflight: false, historyDecision: 'COMBINED_SAVE', historyConfirmation: 'forged' });
        assert.equal(forged.body.success, false); assert.deepEqual(await rawState(s.f), before);
        const saved = await s.h.submit(s.h.confirm(body, preview));
        assert.equal(saved.body.success, true, describe(s.h, saved));
        assert.equal((await s.input()).currentEmployee.thlefono, '2101234567');
        await preserved(s, before, { newAudits: 1 });
    });
    await t.test('Η: φυσικές εγγραφές, εγκρίσεις, παγωμένα αποτελέσματα και επιχειρησιακές αναγνώσεις διατηρούνται', async () => {
        const s = await setup(), before = await rawState(s.f);
        const read = () => readOperationalHistory(db.historyModel.find(s.f.scope).sort({ aa_eggrafhs: 1 }).lean());
        const facts = await read();
        await s.save(await s.payload({ thlefono: '2101234567' }));
        assert.deepEqual(await read(), facts);
        await preserved(s, before);
    });
    await t.test('Μη αρχειοθετημένη επικάλυψη παραμένει εμπόδιο', async () => {
        const s = await setup({ archive: false }), before = await rawState(s.f);
        const response = await s.h.submit(await s.payload({ thlefono: '2101234567' }));
        assert.equal(response.body.success, false); assert.deepEqual(await rawState(s.f), before);
    });
    await t.test('Παρωχημένη κατάσταση και ανάκληση δικαιωμάτων απορρίπτονται', async () => {
        const s = await setup(), body = await s.payload({ thlefono: '2101234567' });
        await db.employeeModel.updateOne({ _id: s.f.employee._id }, { $set: { email: 'changed@example.invalid' } });
        let before = await rawState(s.f), response = await s.h.submit(body);
        assert.equal(response.body.success, false); assert.deepEqual(await rawState(s.f), before);
        const fresh = await s.payload({ thlefono: '2101234567' });
        const revoked = await db.privilegeModel.updateOne({ userId: s.f.req.session.userId, form: 'Ergazomenoi' }, { $set: { 'privileges.update': false } });
        assert.equal(revoked.matchedCount, 1);
        before = await rawState(s.f); response = await s.h.submit(fresh);
        assert.equal(response.body.success, false); assert.deepEqual(await rawState(s.f), before);
    });
    await t.test('Νέα μη αρχειοθετημένη εκκρεμότητα διατηρεί τον αποκλεισμό', async () => {
        const s = await setup(), before = await s.input();
        const other = before.completeHistoryRows.find(row => row.aa_eggrafhs === '0002');
        await db.historyModel.collection.updateOne({ _id: other._id }, { $set: { mo_oron_hmerhsias_ergasias: -1 } });
        const snapshot = await rawState(s.f), response = await s.h.submit(await s.payload({ thlefono: '2101234567' }));
        assert.equal(response.body.success, false); assert.deepEqual(await rawState(s.f), snapshot);
    });
    await t.test('Παράλληλες αλλαγές με το ίδιο αρχικό αποτύπωμα δεν αλληλοαναιρούνται', async () => {
        const s = await setup(), before = await rawState(s.f);
        const first = await s.payload({ thlefono: '2101111111' }), second = await s.payload({ thlefono: '2102222222' });
        const results = await Promise.all([s.h.submit(first), s.h.submit(second)]);
        assert.equal(results.filter(result => result.body.success === true).length, 1);
        assert.equal(results.filter(result => result.body.success === false).length, 1);
        assert.ok(['2101111111', '2102222222'].includes((await s.input()).currentEmployee.thlefono));
        await preserved(s, before);
    });
    assert.equal(mongoose.connection.readyState, 0);
});
