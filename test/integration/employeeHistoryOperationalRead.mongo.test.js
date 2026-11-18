'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startApprovedProposalMongo, seedApprovedProposal, approvedProposalBody } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { seedLegacyStructure, seedLegacyFrozen, rawState } = require('../fixtures/employeeHistoryLegacyStructure');
const { createEmployeeHistoryApprovedProposalService: create } = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService');
const { readOperationalHistory } = require('../../server/services/ergazomenoi/employeeHistoryOperationalReadService');
const { getIstorikoOronErgasiasForPeriod } = require('../../server/utils/ergazomenoi/getIstorikoOronErgasiasForPeriod');
const { getOrarioTermsForDate } = require('../../server/utils/ergazomenoi/getOrarioTermsForDate');
const { resolveEffectiveEmploymentProfileForReviewDate } = require('../../server/services/ergazomenoi/apasxoliseisBorrowedEmploymentProfileResolverService');
const Row = require('../../server/services/ergazomenoi/employeeHistoryRowApprovalService');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const P = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalContract');
const C = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const X = require('../../server/services/ergazomenoi/employeeHistoryProposalXlsxService');
const date = value => new Date(value);
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;

test('Ισχύοντα εγκεκριμένα ΜΕΤΑ: πραγματικές εγκρίσεις και αναγνώσεις σε ιδιόκτητη MongoDB', { skip: !binary, timeout: 180000 }, async t => {
    assert.equal(P.enabled(), false);
    assert.equal(mongoose.connection.readyState, 0);
    const db = await startApprovedProposalMongo(binary); t.after(db.close);
    console.log(`Απομονωμένη MongoDB: ${db.folder}`);
    const approve = async (f, values) => {
        if (!await db.frozenModel.countDocuments({ company_kod: f.scope.company_kod })) await seedLegacyFrozen(f, { finalized: true });
        const proposal = await approvedProposalBody(f, { values }), service = create(f.dependencies);
        const preview = await service.preview(f.req, proposal);
        assert.equal(preview.physicalWrites.history.mode === 'CORRECTION_EDITION' || preview.physicalWrites.history.mode === 'APPROVAL_ONLY', true);
        const result = await service.apply(f.req, { proposal, approval: { token: preview.approval.token, confirmed: true } });
        assert.equal(result.selectedCaseStatus, Row.STATUS);
        assert.equal(result.historyStatus, 'REVIEW_REQUIRED');
        return await db.auditModel.findById(result.auditId).lean();
    };
    const read = (f, fields) => readOperationalHistory(db.historyModel.find(f.scope)
        .select(fields).sort({ aa_eggrafhs: 1 }).lean());
    const terms = (f, from, to = from) => getIstorikoOronErgasiasForPeriod({ ...f.scope,
        aa_eggrafhs: '0001', periodApo: from, periodEos: to }, { historyModel: db.historyModel });
    const values = { [C.START]: '2026-02-02', [C.END]: '2026-03-31',
        nomimosMisthos: '1456.78', ores_ergasias_ebdomadas: '35', mo_oron_hmerhsias_ergasias: '7',
        dialleima_se_lepta: '0' };

    await t.test('0002 / 0001 / 02-02 έως 31-03: ισχύς σε νέα εργασία, ακριβή BSON πρωτοτύπων και παγωμένων αποτελεσμάτων', async () => {
        const f = await seedLegacyStructure(db);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $unset: { poso_symbashs_01: 1 },
            $set: { pragmatikosMisthos: null, afora_egkekrimenh_rythmish_ergasias: false, hmeres_egkekrimenhs_rythmishs: [] } });
        const frozen = await seedLegacyFrozen(f, { finalized: true });
        const before = await rawState(f);
        assert.deepEqual(await terms(f, '2026-03-16'), [], 'The original schedule interval ends on 08/02');
        const audit = await approve(f, values), after = await rawState(f);
        assert.deepEqual(after.history, before.history);
        assert.deepEqual(after.controls, before.controls);
        assert.deepEqual(after.frozen, before.frozen);
        const source = (await f.input()).completeHistoryRows.find(row => String(row._id) === String(f.history[0]._id));
        const selected = (await terms(f, '2026-03-16'))[0];
        assert.equal(selected.nomimosMisthos, 1456.78);
        assert.equal(selected.dialleima_se_lepta, 0);
        assert.equal(selected.pragmatikosMisthos, null);
        assert.equal(selected.afora_egkekrimenh_rythmish_ergasias, false);
        assert.deepEqual(selected.hmeres_egkekrimenhs_rythmishs, []);
        assert.equal(Object.hasOwn(selected, 'poso_symbashs_01'), false);
        assert.equal(Object.hasOwn(selected, 'history_reference_fence'), false);
        for (const field of Object.keys(source).filter(field => !Object.hasOwn(values, field) && field !== 'history_reference_fence'))
            assert.equal(A.equal(selected[field], source[field]), true, field);
        const employee = (await f.input()).currentEmployee;
        const payroll = getOrarioTermsForDate('2026-03-16', [selected], employee);
        assert.equal(payroll.ores_ergasias_ebdomadas, 35);
        assert.equal(payroll.mo_oron_hmerhsias_ergasias, 7);
        const review = resolveEffectiveEmploymentProfileForReviewDate({ reviewDate: '2026-03-16',
            normalEmployee: employee, normalHistory: await read(f) });
        assert.equal(review.ores_ergasias_ebdomadas, 35);
        assert.equal(review.mo_oron_hmerhsias_ergasias, 7);
        const projected = await read(f, 'kodikos nomimosMisthos -_id');
        assert.deepEqual(projected[0], { kodikos: '0002', nomimosMisthos: 1456.78 });
        assert.deepEqual((await read(f, '_id'))[0], { _id: selected._id });
        // The physical reader and frozen reader still resolve the protected source.
        const physical = await readOperationalHistory(db.historyModel.find(f.scope).lean(), { useCorrections: false });
        assert.equal(A.equal(physical[0].nomimosMisthos, source.nomimosMisthos), true);
        assert.deepEqual(await frozen.raw(), before.frozen[0]);
        assert.equal(audit.diagnostics.rowApproval.status, 'APPROVED_RESOLVED');
        assert.equal(Row.activeDecision(await f.input(), source)._id.toString(), audit._id.toString());
        const reloaded = await X.buildEmployeeHistoryProposalWorkbook(await f.input(), f.catalogs);
        assert.equal(reloaded.caseSelection.cases.some(item => item.operation === 'INSERT' &&
            item.period.from <= '2026-03-31' && (!item.period.to || item.period.to >= '2026-02-02')), false);
        assert.equal(reloaded.caseSelection.completedRows[0].historyId, String(source._id));
        assert.ok(reloaded.caseSelection.cases.some(item => item.operation === 'INSERT' && item.period.from === '2026-04-01'),
            'The independent remaining legacy coverage gap must stay visible');
        assert.deepEqual(await rawState(f), after, 'Reopening the proposal performs no writes or renewed approval');
        const snapshot = await rawState(f); await read(f); await terms(f, '2026-03-16');
        assert.deepEqual(await rawState(f), snapshot, 'Operational reads perform no writes');
    });

    await t.test('Κενά ΜΕΤΑ, διαδοχικές εγκρίσεις και έγκριση χωρίς αλλαγές: τελευταία επαληθευμένη έκδοση', async () => {
        const f = await seedLegacyStructure(db);
        const first = await approve(f, values);
        const second = await approve(f, { nomimosMisthos: '1600', ores_ergasias_ebdomadas: '', dialleima_se_lepta: '   ' });
        assert.equal(second.diagnostics.rowApproval.previousApprovalId, first.diagnostics.approvalId);
        let selected = (await terms(f, '2026-03-16'))[0];
        assert.equal(selected.nomimosMisthos, 1600);
        assert.equal(selected.ores_ergasias_ebdomadas, 35);
        assert.equal(selected.dialleima_se_lepta, 0);
        const third = await approve(f, {});
        assert.equal(third.diagnostics.rowApproval.mode, 'APPROVAL_ONLY');
        assert.equal(third.diagnostics.rowApproval.hasCorrectionEdition, true);
        selected = (await terms(f, '2026-03-16'))[0];
        assert.equal(selected.nomimosMisthos, 1600);
        await db.auditModel.collection.updateOne({ _id: third._id }, { $set: { 'diagnostics.rowApproval.verification.approvedContentHash': 'invalid' } });
        await db.auditModel.collection.updateOne({ _id: second._id }, { $set: { 'diagnostics.rowApproval.status': 'COMMITTED_AWAITING_VERIFICATION' } });
        assert.equal((await terms(f, '2026-03-16'))[0].nomimosMisthos, 1456.78, 'Latest valid and independently verified edition wins');
    });

    await t.test('Άλλοι εργαζόμενοι, εταιρείες και περίοδοι δεν επηρεάζονται· κανένα ψευδές CLEAN', async () => {
        const f = await seedLegacyStructure(db), original = await read(f);
        const otherEmployee = new mongoose.Types.ObjectId(), otherHistory = new mongoose.Types.ObjectId();
        await db.employeeModel.collection.insertOne({ ...(await f.input()).currentEmployee, _id: otherEmployee, kodikos: '0003' });
        await db.historyModel.collection.insertOne({ ...original[0], _id: otherHistory, kodikos: '0003' });
        const other = { scope: { ...f.scope, kodikos: '0003' } }, otherBefore = await read(other);
        const aprilBefore = await readOperationalHistory(db.historyModel.find({ ...f.scope,
            hmeromhnia_allaghs_orarioy_apo: mongoose.trusted({ $gte: date('2026-04-01') }) }).lean());
        await approve(f, values);
        assert.deepEqual(await terms(f, '2026-02-01'), []);
        assert.deepEqual(await terms(f, '2026-04-01'), []);
        assert.deepEqual(await read(other), otherBefore);
        assert.deepEqual(await readOperationalHistory(db.historyModel.find({ ...f.scope,
            hmeromhnia_allaghs_orarioy_apo: mongoose.trusted({ $gte: date('2026-04-01') }) }).lean()), aprilBefore);
        const wrongCompany = { scope: { ...f.scope, company_kod: String(new mongoose.Types.ObjectId()) } };
        assert.deepEqual(await read(wrongCompany), []);
        const plan = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionPlannerService')
            .planEmployeeHistoryAutomaticReconstruction;
        const input = await f.input();
        assert.notEqual(A.historyCompletionStatus({ ...input, plan: plan(input) }), 'CLEAN');
    });

    for (const fault of ['status', 'missingVerification', 'verificationDate', 'actor', 'contentHash', 'content', 'employee', 'company', 'historyId', 'rowVersion'])
        await t.test(`Μη έγκυρη δέσμευση ${fault}: διατήρηση πρωτοτύπου`, async () => {
            const f = await seedLegacyStructure(db), audit = await approve(f, values);
            const changes = {
                status: { 'diagnostics.rowApproval.status': 'COMMITTED_AWAITING_VERIFICATION' },
                missingVerification: { 'diagnostics.rowApproval.verification': null },
                verificationDate: { 'diagnostics.rowApproval.verification.verifiedAt': 'invalid' },
                actor: { 'diagnostics.rowApproval.verification.actorUserId': String(new mongoose.Types.ObjectId()) },
                contentHash: { 'diagnostics.rowApproval.approvedContentHash': 'tampered' },
                content: { 'diagnostics.rowApproval.approvedContent.nomimosMisthos': 999999 },
                employee: { 'employeeScope.employee_id': new mongoose.Types.ObjectId() },
                company: { 'diagnostics.binding.scope.company_kod': String(new mongoose.Types.ObjectId()) },
                historyId: { 'diagnostics.targetHistoryId': String(f.history[1]._id) }
            };
            if (fault === 'rowVersion') await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: { updatedAt: new Date() } });
            else await db.auditModel.collection.updateOne({ _id: audit._id }, { $set: changes[fault] });
            assert.deepEqual(await terms(f, '2026-03-16'), []);
            const physical = await db.historyModel.find(f.scope).lean();
            assert.deepEqual(await read(f), physical.sort((a, b) => a.aa_eggrafhs.localeCompare(b.aa_eggrafhs)));
        });

    await t.test('Αύξηση τεχνικού μετρητή αναφορών δεν απαιτεί νέα επιχειρησιακή έγκριση', async () => {
        const f = await seedLegacyStructure(db), audit = await approve(f, values);
        await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $inc: { history_reference_fence: 1 } });
        assert.equal((await terms(f, '2026-03-16'))[0].nomimosMisthos, 1456.78);
        const input = await f.input(), source = input.completeHistoryRows.find(row => String(row._id) === String(f.history[0]._id));
        assert.equal(String(Row.activeDecision(input, source)._id), String(audit._id));
        assert.equal(Row.verify(input, audit).selectedCaseStatus, Row.STATUS);
        assert.equal((await db.auditModel.findById(audit._id).lean()).diagnostics.rowApproval.status, Row.STATUS);
    });
    await t.test('Ταυτόχρονη αλλαγή πηγής μετά την επαλήθευση απορρίπτει την παλιά διορθωτική έκδοση', async context => {
        const f = await seedLegacyStructure(db); await approve(f, values);
        const collection = db.connection.collection(db.historyModel.collection.name);
        const aggregate = collection.aggregate.bind(collection);
        context.mock.method(collection, 'aggregate', (...args) => ({ toArray: async () => {
            await db.historyModel.collection.updateOne({ _id: f.history[0]._id }, { $set: { nomimosMisthos: 333, updatedAt: new Date() } });
            return aggregate(...args).toArray();
        } }));
        const selected = (await read(f))[0];
        assert.equal(selected.nomimosMisthos, 333);
        assert.equal(require('../../server/services/ergazomenoi/employeeHistoryOperationalReadService').originalHistoryRow(selected), selected);
    });
    await t.test('Φάσεις μισθοδοσίας: πεπερασμένη διόρθωση καθεστώτος μόνο εντός των ρητών ορίων της', async () => {
        const f = await seedLegacyStructure(db);
        await approve(f, { [C.START]: '2026-02-09', [C.END]: '2026-02-28', [C.CHANGE]: '2026-02-09',
            kathestos_apasxolhshs: '1' });
        const histories = await read(f);
        const employee = { ...(await f.input()).currentEmployee, employment_profile_schema_version: null,
            employment_profile_pre_v1: null };
        const phases = await require('../../server/services/kinhseis/phaseDetectorService').detectPayrollPhasesForDateRange({
            ...f.scope, apo: '2026-02-02', eos: '2026-03-31', asOfDate: '2026-04-30',
            preparedContext: { employee, rows: [], contractStatusHistoryRows: histories, workingTermsHistoryRows: [] } });
        for (const [day, expected] of [['2026-02-02', '0'], ['2026-02-09', '1'], ['2026-02-28', '1'], ['2026-03-01', '0']]) {
            const interval = phases.contractStatusIntervals.find(interval => date(interval.apo) <= date(day) && date(day) <= date(interval.eos));
            assert.equal(interval?.kathestosCode, expected, day);
        }
    });
    await t.test('Πραγματική αποτυχία ανεξάρτητης επαλήθευσης: καμία επιχειρησιακή χρήση μέχρι τη συμφωνία', async () => {
        const f = await seedLegacyStructure(db); await seedLegacyFrozen(f, { finalized: true });
        let unavailable = true;
        const checker = require('../../server/services/ergazomenoi/employeeHistoryReferenceAuditService').findHistoryIdReferences;
        const service = create({ ...f.dependencies, referenceChecker: async args => {
            if (unavailable && await db.auditModel.countDocuments({ 'employeeScope.employee_id': f.employee._id })) throw Error('SYNTHETIC_VERIFICATION_UNAVAILABLE');
            return checker(args);
        } });
        const proposal = await approvedProposalBody(f, { values }), preview = await service.preview(f.req, proposal);
        await assert.rejects(service.apply(f.req, { proposal, approval: { token: preview.approval.token, confirmed: true } }),
            error => error.saved && error.reason === 'COMMITTED_VERIFICATION_REQUIRED');
        assert.deepEqual(await terms(f, '2026-03-16'), []);
        unavailable = false;
        await service.reconcile(f.req, { proposal, token: preview.approval.token });
        assert.equal((await terms(f, '2026-03-16'))[0].nomimosMisthos, 1456.78);
    });
    for (const insert of [false, true]) await t.test(`Μη επαληθευμένο ${insert ? 'INSERT' : 'PHYSICAL_UPDATE'}: προηγούμενα επιχειρησιακά δεδομένα`, async () => {
        const f = await seedApprovedProposal(db, { insert }), before = await read(f);
        const checker = require('../../server/services/ergazomenoi/employeeHistoryReferenceAuditService').findHistoryIdReferences;
        const service = create({ ...f.dependencies, referenceChecker: async args => {
            if (await db.auditModel.countDocuments({ 'employeeScope.employee_id': f.employee._id })) throw Error('SYNTHETIC_VERIFICATION_UNAVAILABLE');
            return checker(args);
        } });
        const proposal = await approvedProposalBody(f, { insert }), preview = await service.preview(f.req, proposal);
        assert.equal(preview.physicalWrites.history.mode, insert ? 'INSERT' : 'PHYSICAL_UPDATE');
        await assert.rejects(service.apply(f.req, { proposal, approval: { token: preview.approval.token, confirmed: true } }),
            error => error.saved && error.reason === 'COMMITTED_VERIFICATION_REQUIRED');
        assert.deepEqual(await read(f), before);
    });
    await t.test('Πραγματικός Υπολογισμός και αναζήτηση Ελέγχου Μαρτίου: χρήση ΜΕΤΑ με άθικτο οριστικοποιημένο Φεβρουάριο', async context => {
        const f = await seedLegacyStructure(db); await approve(f, values);
        const before = await rawState(f);
        assert.equal(mongoose.connection.readyState, 0);
        // Exercise the ordinary OPEN-period path at its real business time,
        // preserving all overdue/reconstruction guards in production.
        context.mock.timers.enable({ apis: ['Date'], now: date('2026-04-15') });
        // Attach production models only to this test's already verified process
        // and database. No URI input, .env, existing server or external API.
        await mongoose.connect(`mongodb://127.0.0.1:${db.connection.port}/${db.connection.name}?replicaSet=payrollApprovedProposalTest`,
            { autoIndex: false, autoCreate: false });
        mongoose.set('sanitizeFilter', true);
        let server;
        try {
            const models = require('../../server/models/ergazomenoi');
            const { YpokatasthmataModel } = require('../../server/models/companies');
            const { PeriodsModel } = require('../../server/models/stathera_arxeia');
            await YpokatasthmataModel.collection.insertOne({ team: f.scope.team, companykod_object: f.scope.company_kod, kodikos: '0000' });
            await PeriodsModel.collection.insertOne({ xrhsh: '2026', kodikos: '03', apo: date('2026-03-01'), eos: date('2026-03-31') });
            await db.privilegeModel.collection.insertOne({ userId: String(f.actor), form: 'ElegxosApasxolhseonPeriodoy', privileges: { read: true, update: true } });
            const period = { team: f.scope.team, company_kod: f.scope.company_kod, ypokatasthma: '0000',
                period_start: date('2026-03-01'), period_end: date('2026-03-31') };
            await db.periodControlModel.collection.insertOne({ ...period, status: 'OPEN', deadline: date('2026-04-30'),
                version: 1, write_fence_version: 0, successful_calculation_version: 0, active_calculation_id: '' });
            const days = Array.from({ length: 42 }, (_, index) => {
                const day = new Date(Date.UTC(2026, 1, 23 + index)), worked = ![0, 6].includes(day.getUTCDay());
                return { ...f.scope, _id: new mongoose.Types.ObjectId(), ypokatasthma: '0000', hmeromhnia: day,
                    is_locked: day < period.period_start, kathgoria_ergasias: worked ? 'ΕΡΓ' : 'ΜΕ', repo: false,
                    apo_ora_01: worked ? '08:00' : '', eos_ora_01: worked ? '16:00' : '',
                    cards_apo_ora_01: worked ? '08:00' : '', cards_eos_ora_01: worked ? '16:00' : '',
                    ores_ergasias: worked ? 8 : 0, cards_ores_ergasias: worked ? 8 : 0,
                    kathgoria_ergasias_apologistika: worked ? 'ΕΡΓ' : 'ΜΕ',
                    ergani_pipeline: { cards_pending: false, calculation_pending: true } };
            });
            await models.ProdhlomenaOrariaModel.collection.insertMany(days);
            const express = require('express'), app = express(), controller = require('../../server/controllers/ergazomenoi/erganhController');
            app.use(express.json());
            app.use((req, res, next) => {
                req.session = { ...f.req.session, userStatus: 'A', userRole: 'HR', periodInUse: '03', yearInUse: '2026', appDate: '2026-04-15', companyKodikos: '0003' };
                req.sessionID = 'synthetic-operational-calculation';
                req.programmataAccessScope = { effectiveTeam: f.scope.team, companyId: f.scope.company_kod,
                    ypokatasthma: '0000', dateRange: { startDate: period.period_start, endDate: period.period_end } }; next();
            });
            app.post('/calculate', controller.calcApasxolhseisPeriodoy);
            app.get('/review', controller.getProdhlomenaOrariaForReview);
            server = app.listen(0, '127.0.0.1'); await require('node:events').once(server, 'listening');
            const origin = `http://127.0.0.1:${server.address().port}`;
            const response = await fetch(origin + '/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apo_hmeromhnia: '2026-03-01', eos_hmeromhnia: '2026-03-31', ypokatasthma: '0000' }) });
            const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result));
            const calculated = await models.ProdhlomenaOrariaModel.findOne({ ...f.scope, hmeromhnia: date('2026-03-16') }).lean();
            assert.equal(calculated.ores_pragmatikhs_ergasias_apologistika, 8);
            const reviewResponse = await fetch(origin + '/review?apo_hmeromhnia=2026-03-01&eos_hmeromhnia=2026-03-31&ypokatasthma=0000&limit=200');
            const review = await reviewResponse.json(); assert.equal(reviewResponse.status, 200, JSON.stringify(review));
            assert.ok(review.rows.length > 0);
            const after = await rawState(f);
            assert.deepEqual(after.history, before.history); assert.deepEqual(after.frozen, before.frozen);
            assert.equal((await db.auditModel.findOne({ 'employeeScope.employee_id': f.employee._id }).lean()).diagnostics.rowApproval.status, Row.STATUS);
        } finally {
            if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
            await mongoose.disconnect();
            context.mock.timers.reset();
        }
    });
    assert.equal(P.enabled(), false);
    assert.equal(mongoose.connection.readyState, 0);
});
