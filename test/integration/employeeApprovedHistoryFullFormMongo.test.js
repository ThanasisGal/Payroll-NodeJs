'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { once } = require('node:events');
const mongoose = require('mongoose');
const { startApprovedProposalMongo, approvedProposalBody } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const { seedLegacyFrozen, rawState } = require('../fixtures/employeeHistoryLegacyStructure');
const F = require('../fixtures/employee0002HistoryProposalFixture');
const Models = require('../../server/models/ergazomenoi');
const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const Atomic = require('../../server/services/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceService');
const Row = require('../../server/services/ergazomenoi/employeeHistoryRowApprovalService');
const A = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const C = require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionContract');
const Profile = require('../../server/utils/ergazomenoi/employmentProfileContract');
const SaveState = require('../../server/utils/ergazomenoi/employeeSaveState');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;
const five = { hmeres_ergasias_ebdomadas: 5, typos_ebdomadas: '5HMERH',
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
const six = { hmeres_ergasias_ebdomadas: 6, typos_ebdomadas: '6HMERH',
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 6.67 };

// Execute the actual controller method and mapping helpers, without importing
// its AWS/PDF/ERGANI module graph or app.js/.env/default database connection.
// Every model, authorization, transaction, write and reread below is real.
const source = fs.readFileSync(require.resolve('../../server/controllers/ergazomenoi/ergazomenoiController'), 'utf8').replaceAll('\r', '');
const start = source.indexOf('    static postErgazomenoiUpdate = ');
const method = source.slice(start, source.indexOf('    static deleteErgazomenoi', start))
    .trim().replace('static postErgazomenoiUpdate = ', '').replace(/;$/, '');
const helpers = source.slice(source.indexOf('function valueOrEmpty('), source.indexOf('// ✅ HELPERS: Εμπλουτισμός ιστορικού'));
const constants = source.slice(source.indexOf('const fieldsStoixeionSymbashs'), source.indexOf('function parseS3Uri'));

function fullForm(employee) {
    const aliases = { eponymoHidden: 'eponymo', onomaHidden: 'onoma',
        afm_ergazomenoyHidden: 'afm', amka_ergazomenoyHidden: 'amka',
        kataggelia_me_proeidopoihsh: 'afora_kataggelia_me_proeidopoihsh',
        hmnia_koinopoihshs_kataggelias: 'hmeromhnia_koinopoihshs_kataggelias',
        logos_peratoshs_stathera: 'logos_peratosis', parathrhseis_peratoshs: 'parathrhseis_peratosis',
        parathrhseis_efarmosteas_sse: 'efarmostea_sse_parathrhseis', evelikth_proselefsh_edit: 'evelikth_proselefsh' };
    const names = new Set([...method.slice(0, method.indexOf('let updatedErgazomenos'))
        .matchAll(/formData\.([a-zA-Z_0-9]+)/g)].map(match => match[1]));
    for (const field of Profile.FACT_FIELDS) if (![Profile.SCHEMA_VERSION, Profile.TYPE_VERSION].includes(field)) names.add(field);
    for (let i = 1; i <= 15; i++) {
        const suffix = String(i).padStart(2, '0');
        for (const prefix of ['stoixeio_symbashs', 'poso_symbashs', 'poso_symbashs_basei_oron_ergasias', 'krathsh']) names.add(`${prefix}_${suffix}`);
        names.add(`stoixeio_symbashs_${suffix}_hidden`);
    }
    return Object.fromEntries([...names].flatMap(name => {
        const field = aliases[name] || name.replace(/_stathera$/, '').replace(/^(stoixeio_symbashs_\d{2})_hidden$/, '$1');
        const path = Models.ErgazomenoiModel.schema.path(field), value = employee[field];
        if (!path) return [];
        return [[name, path.instance === 'Date' ? value ? new Date(value).toISOString().slice(0, 10) : null
            : path.instance === 'Number' ? Number(value || 0) : path.instance === 'Boolean' ? value === true
                : path.instance === 'Array' ? [...(value || [])] : value ?? '']];
    }));
}
const proxy = (model, overrides) => new Proxy(model, { get(target, key) {
    if (Object.hasOwn(overrides, key)) return overrides[key];
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
} });
const describe = (row, field) => !Object.hasOwn(row, field) ? { type: 'missing' }
    : { type: row[field] instanceof Date ? 'Date' : row[field]?._bsontype || typeof row[field], value: row[field] };
function differences(original, patch, actual) {
    const expected = { ...original, ...patch };
    return [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
        .filter(field => !A.equal(expected[field], actual[field]) || Object.hasOwn(expected, field) !== Object.hasOwn(actual, field))
        .map(field => ({ historyId: String(original._id), sequence: original.aa_eggrafhs, field,
            original: describe(original, field), targetPatch: describe(patch, field), actual: describe(actual, field) }));
}

async function seed(db) {
    const data = F.employee0002HistoryProposalFixture({ datedInitialProfile: true, reviewRequired: false });
    const scope = { team: 'THA', company_kod: String(new mongoose.Types.ObjectId()), kodikos: '0002' };
    const actor = new mongoose.Types.ObjectId();
    data.completeHistoryRows[0][C.END] = new Date('2026-03-31');
    const history = await db.historyModel.create(data.completeHistoryRows.map(row => ({ ...row, ...scope,
        _id: new mongoose.Types.ObjectId(), eidikothta_symbashs: '01', nomimoOromisthio: 8 })));
    const employee = await db.employeeModel.create({ ...data.currentEmployee, ...scope,
        _id: new mongoose.Types.ObjectId(), eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΕΛΕΓΧΟΣ',
        afm: '123456789', amka: '12345678901', ypokatasthma: '0000', oristikh_enhmerosh: true,
        apasxolhsh_basei_symbashs: '5', proyphresia_se_eth: 0, proyphresia_se_mhnes: 0,
        proyphresia_adeias_se_eth: 0, oysiodeis_oroi: '0', foreas_epikoyrikhs_asfalishs: [],
        typos_metabolhs: [], typos_metabolhs_table: '[]', thlefono: '2100000000',
        odos: 'ΣΥΝΘΕΤΙΚΗ', arithmos: '10', tk: '00000' });
    await db.companyModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(scope.company_kod), team: scope.team, kod: '0003' });
    await db.userModel.collection.insertOne({ _id: actor, team: scope.team, situation: 'A', privileges: 'A' });
    await db.privilegeModel.collection.insertOne({ userId: String(actor), form: 'Ergazomenoi', privileges: { update: true } });
    const req = { sessionID: 'synthetic-full-form-' + actor, params: { id: String(employee._id) },
        session: { userId: String(actor), userTeam: scope.team, companyInUse: scope.company_kod } };
    const dependencies = { ...db, approvalSecret: 'synthetic-full-form-approval-secret-32',
        isEnabled: () => true, loadCatalogs: async () => F.catalogs, loadSchedules: async () => [] };
    const input = async () => {
        const query = db.historyModel.find(scope); query.mongooseOptions({ includeRedundantHistoryArtifacts: true });
        const completeHistoryRows = await query.select('+history_reference_fence').lean();
        const currentEmployee = await db.employeeModel.findById(employee._id).select('+employee_profile_mutation_sequence').lean();
        const protectedReferenceSummary = {};
        for (const row of completeHistoryRows) protectedReferenceSummary[String(row._id)] =
            await require('../../server/services/ergazomenoi/employeeHistoryReferenceAuditService')
                .findHistoryIdReferences({ connection: db.connection, historyIds: [String(row._id)] });
        return { scope, currentEmployee, completeHistoryRows, protectedReferenceSummary,
            approvedHistoryDecisions: await Row.loadDecisions({ scope, currentEmployee }, db.auditModel),
            companyBusinessCode: '0003', predeclaredScheduleRows: [] };
    };
    // Approve the actual persisted 0003 with the production approval service.
    const f = { req, scope, employee, history: [history[2], history[0], history[1]], dependencies, catalogs: F.catalogs, input };
    const service = require('../../server/services/ergazomenoi/employeeHistoryApprovedProposalService')
        .createEmployeeHistoryApprovedProposalService(dependencies);
    const proposal = await approvedProposalBody(f, { values: {} }), preview = await service.preview(req, proposal);
    const approved = await service.apply(req, { proposal, approval: { token: preview.approval.token, confirmed: true } });
    assert.equal(approved.selectedCaseStatus, Row.STATUS);
    assert.equal(Row.verify(await input(), await db.auditModel.findById(approved.auditId).lean()).selectedCaseStatus, Row.STATUS);
    // A real finalized earlier period and frozen references remain protected.
    await seedLegacyFrozen(f, { finalized: true, historyIndex: 1 });
    return f;
}

async function controller(db, f, { corrupt = false } = {}) {
    const plans = [], reads = [], requests = [], errors = [], results = [], mutations = [];
    const historyModel = proxy(db.historyModel, {
        find(...args) {
            const query = db.historyModel.find(...args), lean = query.lean;
            query.lean = async function (...options) {
                const rows = await lean.apply(this, options);
                reads.push(rows);
                return rows;
            };
            return query;
        }
    });
    const auditModel = proxy(db.auditModel, {
        async create(rows, options) {
            const saved = await db.auditModel.create(rows, options);
            if (corrupt && rows[0].diagnostics?.operation === 'CORRECT_SAVED_ERROR') {
                // Deliberate REAL unexpected write in the SAME Mongo transaction,
                // after the planned persistence, before the final physical reread.
                assert.equal(options.session.inTransaction(), true);
                const old = (await f.input()).completeHistoryRows.find(row => row.aa_eggrafhs === '0001');
                await db.historyModel.collection.updateOne({ _id: old._id }, { $set: { nomimosMisthos: 9999 } }, { session: options.session });
                const persisted = await db.historyModel.collection.findOne({ _id: old._id }, { session: options.session });
                assert.equal(persisted.nomimosMisthos, 9999);
                mutations.push(String(old._id));
            }
            return saved;
        }
    });
    const dependencies = { ...db, historyModel, auditModel, correctionCatalogLoader: async () => F.catalogs,
        approvedHistoryServiceFactory: options => {
            const service = Atomic.createApprovedHistoryAtomicMaintenanceService({ ...db, ...options,
                enabled: () => true, secret: 'synthetic-full-form-atomic-secret-32' });
            return { ...service, async prepareEmployeeSave(...args) {
                const prepared = await service.prepareEmployeeSave(...args);
                plans.push(prepared.plan);
                return prepared;
            } };
        } };
    const handler = vm.runInNewContext(`${constants}\n${helpers}\n(${method})`, {
        SaveState, HistoryDeferral: require('../../server/services/ergazomenoi/employeeHistoryDeferralService'), Date, URL, mongoose,
        require(name) {
            if (name.endsWith('/contractGenerator') || name.endsWith('/userContext') || name.endsWith('/pdfHandler')) return {};
            throw new Error('Unexpected external dependency: ' + name);
        },
        console: { log() {}, warn() {}, error(...args) { errors.push(args); } },
        logger: { info() {}, debug() {}, warn() {}, error() {} },
        ...require('../../server/utils/ergazomenoi/employmentProfileMaintenance'),
        ...require('../../server/utils/ergazomenoi/getOrarioTermsForDate'),
        ...require('../../server/services/ergazomenoi/employeeScheduleDailyRestValidationService'),
        ...require('../../server/utils/ergazomenoi/forologikhKlimakaCode'),
        ...require('../../server/utils/date/mondaySundayWeek'),
        ...require('../../server/services/ergazomenoi/employeeHistoryAutomaticReconstructionSaveContract'),
        ...require('../../server/services/ergazomenoi/employeeHistoryResolutionAnalysisService'),
        requireScopedEmployeeForUpdate: require('../../server/controllers/ergazomenoi/employeeUpdateScope').requireScopedEmployeeForUpdate,
        ErgazomenoiModel: db.employeeModel, CompaniesModel: db.companyModel,
        ProdhlomenaOrariaModel: db.scheduleModel, YpokatasthmataModel: db.branchModel,
        async writeEmployeeMaintenance(args) {
            requests.push(args);
            const result = await W.writeEmployeeMaintenance({ ...dependencies, ...args });
            results.push(result);
            return result;
        }
    });
    const payload = async (kind, terms, targetHistoryId) => {
        const state = await f.input();
        return { saveMode: 'final', historyPreflight: true,
            expectedEmployeeStateToken: SaveState.employeeStateToken(state.currentEmployee),
            formData: { ...fullForm(state.currentEmployee), ...terms,
                hmeromhnia_allaghs_orarioy_apo: '', hmeromhnia_allaghs_orarioy_eos: '',
                apasxolhsh_basei_symbashs: String(terms.hmeres_ergasias_ebdomadas),
                historyExpectedRevision: state.completeHistoryRows.find(row => String(row._id) === targetHistoryId)?.updatedAt.toISOString() },
            change: { kind, effectiveFrom: '2026-11-29', correctedTerms: terms,
                ...(targetHistoryId ? { targetHistoryId } : {}) },
            filesToUpdate: { create_contract: false, isPermanent: true, erganiUploadMethod: 'xml' } };
    };
    const express = require('express'), app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.session = f.req.session; req.sessionID = f.req.sessionID; next(); });
    // Same URL and actual controller as usersRoute.js. Database permissions
    // are still freshly checked by the production writer in its transaction.
    app.post('/api/ergazomenoi/update/:ergazomenoiId', (req, res, next) => handler(req, res).catch(next));
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const submit = async body => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ergazomenoi/update/${f.employee._id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return { statusCode: response.status, body: await response.json() };
    };
    const confirm = (body, preview) => ({ ...body, historyPreflight: false,
        historyDecision: preview.body.decision, historyConfirmation: preview.body.historyConfirmation });
    return { payload, submit, confirm, plans, reads, requests, errors, results, mutations,
        close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}

test('Πλήρης φόρμα 6→5 στην ίδια 29/11/2026: πραγματική Mongoose/BSON και τελικός ιστορικός έλεγχος',
    { skip: !binary, timeout: 180000 }, async t => {
        const db = await startApprovedProposalMongo(binary); t.after(db.close);
        for (const [key, model] of Object.entries({ scheduleModel: Models.ProdhlomenaOrariaModel,
            branchModel: require('../../server/models/companies').YpokatasthmataModel })) {
            db[key] = db.connection.model(model.modelName, model.schema.clone());
            await db[key].createCollection();
        }
        assert.equal(mongoose.connection.readyState, 0);
        console.log('Απομονωμένη MongoDB:', db.folder);
        const commands = [];
        db.connection.getClient().on('commandStarted', event => commands.push(event));
        const f = await seed(db), h = await controller(db, f), initial = await rawState(f);
        t.after(h.close);
        const newBody = await h.payload('NEW_CHANGE', six), newPreview = await h.submit(newBody);
        assert.equal(newPreview.body.success, true, JSON.stringify({ response: newPreview.body, errors: h.errors }));
        assert.equal(newPreview.body.decision, 'COMBINED_SAVE');
        assert.deepEqual(await rawState(f), initial);
        const created = await h.submit(h.confirm(newBody, newPreview));
        assert.equal(created.body.success, true, JSON.stringify({ response: created.body, errors: h.errors }));
        const afterNew = await f.input(), successor = afterNew.completeHistoryRows.find(row => row.aa_eggrafhs === '0004');
        assert.ok(successor);
        assert.equal(successor.hmeres_ergasias_ebdomadas, 6);
        assert.equal(successor[C.START].toISOString(), '2026-11-29T00:00:00.000Z');
        const before = await rawState(f), body = await h.payload('CORRECT_SAVED_ERROR', five, String(successor._id));
        const preview = await h.submit(body);
        assert.equal(preview.body.success, true, JSON.stringify({ response: preview.body, errors: h.errors }));
        assert.equal(preview.body.status, 'READY_FOR_COMBINED_SAVE');
        assert.deepEqual(await rawState(f), before);
        await t.test('Η προεπισκόπηση δεν επιτρέπει αποθήκευση χωρίς τη δική της ρητή υπογεγραμμένη έγκριση', async () => {
            for (const extra of [{}, { historyDecision: preview.body.decision, historyConfirmation: 'forged' }]) {
                const rejected = await h.submit({ ...body, historyPreflight: false, ...extra });
                assert.equal(rejected.body.success, false);
                assert.deepEqual(await rawState(f), before);
            }
        });
        const saved = await h.submit(h.confirm(body, preview));
        const plan = h.plans.at(-1), actual = h.reads.at(-1).find(row => String(row._id) === plan.targetId);
        const diff = differences(plan.targetBefore, plan.targetPatch, actual);
        console.log('Αποκλίσεις αρχικής/targetPatch/επανανάγνωσης:', A.stringify(diff));
        if (!saved.body.success) assert.deepEqual(await rawState(f), before, 'The rejected correction must roll back every physical write');
        assert.equal(saved.body.success, true, JSON.stringify({ response: saved.body, errors: h.errors, diff }));
        assert.deepEqual(diff, []);
        const final = await f.input(), after = await rawState(f);
        assert.equal(final.completeHistoryRows.length, 4);
        assert.equal(final.completeHistoryRows.some(row => row.aa_eggrafhs === '0005'), false);
        const corrected = final.completeHistoryRows.find(row => String(row._id) === String(successor._id));
        for (const row of [corrected, final.currentEmployee]) for (const [field, value] of Object.entries(five)) assert.equal(row[field], value);
        assert.equal(final.currentEmployee.apasxolhsh_basei_symbashs, '5');
        assert.equal(Object.hasOwn(corrected, 'apasxolhsh_basei_symbashs'), false);
        assert.ok(corrected.updatedAt instanceof Date);
        assert.ok(corrected.updatedAt > successor.updatedAt);
        assert.ok(corrected._id instanceof mongoose.Types.ObjectId);
        assert.equal(corrected[C.START].toISOString(), '2026-11-29T00:00:00.000Z');
        assert.equal(corrected[C.END], null);
        for (const field of Object.keys(plan.targetPatch)) {
            assert.ok(db.historyModel.schema.path(field), field);
            assert.equal(A.equal(corrected[field], plan.targetPatch[field]), true, field);
        }
        const persistedTypes = mongoose.mongo.BSON.deserialize(after.history.find(raw =>
            String(mongoose.mongo.BSON.deserialize(raw)._id) === plan.targetId), { promoteValues: false });
        assert.equal(persistedTypes.hmeres_ergasias_ebdomadas._bsontype, 'Int32');
        assert.equal(persistedTypes.ores_ergasias_ebdomadas._bsontype, 'Int32');
        assert.equal(persistedTypes.mo_oron_hmerhsias_ergasias._bsontype, 'Int32');
        assert.ok(persistedTypes.updatedAt instanceof Date);
        assert.ok(persistedTypes[C.START] instanceof Date);
        assert.equal(Object.hasOwn(persistedTypes, 'apasxolhsh_basei_symbashs'), false);
        const unchanged = final.completeHistoryRows.filter(row => row.aa_eggrafhs !== '0004');
        assert.equal(unchanged.length, 3);
        for (const row of unchanged) assert.equal(A.equal(row, afterNew.completeHistoryRows.find(old => String(old._id) === String(row._id))), true);
        assert.deepEqual(after.history.filter(raw => mongoose.mongo.BSON.deserialize(raw).aa_eggrafhs !== '0004'), before.history.filter(raw => mongoose.mongo.BSON.deserialize(raw).aa_eggrafhs !== '0004'));
        assert.deepEqual(after.audit.slice(0, before.audit.length), before.audit);
        assert.deepEqual(after.controls, before.controls); assert.deepEqual(after.frozen, before.frozen);
        assert.equal(final.approvedHistoryDecisions.length, 1);
        assert.equal(Row.verify(final, final.approvedHistoryDecisions[0]).selectedCaseStatus, Row.STATUS);
        assert.ok(Object.keys(h.requests.at(-1).maintenance.submittedFormValues).length > 300);
        assert.ok(Object.keys(plan.targetPatch).length > 50);
        console.log('Πλήθος πεδίων φόρμας / targetPatch:', Object.keys(h.requests.at(-1).maintenance.submittedFormValues).length,
            Object.keys(plan.targetPatch).length);
        const transactions = commands.filter(event => event.commandName === 'commitTransaction');
        assert.ok(transactions.length >= 3);
        assert.ok(commands.some(event => event.commandName === 'update' && event.command.autocommit === false &&
            event.command.updates.some(update => update.u.$set?.hmeres_ergasias_ebdomadas === 5)));

        await t.test('Αληθινή απρογραμμάτιστη τροποποίηση της 0001 απορρίπτεται και όλη η συναλλαγή αναιρείται', async () => {
            // Make another legitimate six-day successor state using the same
            // already-created 0004; this setup is isolated synthetic data only.
            await db.historyModel.updateOne({ _id: corrected._id }, { $set: six });
            await db.employeeModel.updateOne({ _id: f.employee._id }, { $set: { ...six, apasxolhsh_basei_symbashs: '6' } });
            const bad = await controller(db, f, { corrupt: true }); t.after(bad.close);
            const body = await bad.payload('CORRECT_SAVED_ERROR', five, String(corrected._id));
            const baseline = await rawState(f), preview = await bad.submit(body);
            assert.equal(preview.body.success, true, JSON.stringify(preview.body));
            const rejected = await bad.submit(bad.confirm(body, preview));
            assert.equal(rejected.body.success, false);
            assert.equal(bad.mutations.length, 1);
            assert.ok(bad.errors.some(args => args.some(value => value?.errorCode === 'EMPLOYEE_APPROVED_ATOMIC_UNPLANNED_OLD_HISTORY_MUTATION')));
            assert.deepEqual(await rawState(f), baseline);
            assert.ok(commands.some(event => event.commandName === 'abortTransaction'));
        });
    });
