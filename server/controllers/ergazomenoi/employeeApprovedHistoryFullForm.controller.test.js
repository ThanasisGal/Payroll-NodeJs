'use strict';

const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const mongoose = require('mongoose');
const F = require('../../../test/fixtures/employeeHistoryResolvedProposal');
const { store } = require('../../../test/fixtures/employeeProfileTransactionStore');
const W = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const A = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const { clone } = require('../../services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
const D = require('../../services/ergazomenoi/employeeHistoryDeferralService');
const S = require('../../utils/ergazomenoi/employeeSaveState');
const M = require('../../utils/ergazomenoi/employmentProfileMaintenance');
const C = require('../../utils/ergazomenoi/employmentProfileContract');
const Models = require('../../models/ergazomenoi');

const source = fs.readFileSync(__dirname + '/ergazomenoiController.js', 'utf8').replaceAll('\r', '');
const start = source.indexOf('    static postErgazomenoiUpdate = ');
const end = source.indexOf('    static deleteErgazomenoi', start);
const method = source.slice(start, end).trim().replace('static postErgazomenoiUpdate = ', '').replace(/;$/, '');
const helpers = source.slice(source.indexOf('function valueOrEmpty('), source.indexOf('// ✅ HELPERS: Εμπλουτισμός ιστορικού'));
const constants = source.slice(source.indexOf('const fieldsStoixeionSymbashs'), source.indexOf('function parseS3Uri'));
const actorUserId = '630000000000000000000001';
const q = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });

before(() => require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());

// Full form values, including every mapped scalar, all profile facts and all
// fifteen contract/deduction slots. HTML numbers/checkboxes/dates use the same
// JSON types as putFieldValues.js; unchanged values are deliberately resent.
function fullForm(employee) {
    const aliases = { eponymoHidden: 'eponymo', onomaHidden: 'onoma',
        afm_ergazomenoyHidden: 'afm', amka_ergazomenoyHidden: 'amka',
        kataggelia_me_proeidopoihsh: 'afora_kataggelia_me_proeidopoihsh',
        hmnia_koinopoihshs_kataggelias: 'hmeromhnia_koinopoihshs_kataggelias',
        logos_peratoshs_stathera: 'logos_peratosis', parathrhseis_peratoshs: 'parathrhseis_peratosis',
        parathrhseis_efarmosteas_sse: 'efarmostea_sse_parathrhseis',
        evelikth_proselefsh_edit: 'evelikth_proselefsh' };
    const names = new Set([...method.slice(0, method.indexOf('let updatedErgazomenos')).matchAll(/formData\.([a-zA-Z_0-9]+)/g)]
        .map(match => match[1]));
    for (const field of C.FACT_FIELDS) if (![C.SCHEMA_VERSION, C.TYPE_VERSION].includes(field)) names.add(field);
    for (let i = 1; i <= 15; i++) {
        const suffix = String(i).padStart(2, '0');
        for (const prefix of ['stoixeio_symbashs', 'poso_symbashs', 'poso_symbashs_basei_oron_ergasias', 'krathsh'])
            names.add(`${prefix}_${suffix}`);
        names.add(`stoixeio_symbashs_${suffix}_hidden`);
    }
    const form = {};
    for (const name of names) {
        const field = aliases[name] || name.replace(/_stathera$/, '').replace(/^(stoixeio_symbashs_\d{2})_hidden$/, '$1');
        const path = Models.ErgazomenoiModel.schema.path(field);
        if (!path) continue;
        const value = employee[field];
        form[name] = path.instance === 'Date' ? (value ? new Date(value).toISOString().slice(0, 10) : null)
            : path.instance === 'Number' ? Number(value || 0)
            : path.instance === 'Boolean' ? value === true
            : path.instance === 'Array' ? [...(value || [])] : value ?? '';
    }
    return form;
}

async function harness({ approveCurrent = false, versioned = false, approvedTerms = {},
    independent = false, alter = () => {} } = {}) {
    const input = F.resolvedProposalFixture({ independent });
    Object.assign(input.currentEmployee, { eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΕΛΕΓΧΟΣ', afm: '123456789',
        amka: '12345678901', oristikh_enhmerosh: true, apasxolhsh_basei_symbashs: '5',
        proyphresia_se_eth: 0, proyphresia_se_mhnes: 0, proyphresia_adeias_se_eth: 0,
        oysiodeis_oroi: '0', foreas_epikoyrikhs_asfalishs: [], typos_metabolhs: [], typos_metabolhs_table: '[]',
        thlefono: '2100000000', odos: 'ΣΥΝΘΕΤΙΚΗ', arithmos: '10', tk: '00000' });
    if (versioned) for (const row of [input.currentEmployee, input.completeHistoryRows.at(-1)])
        Object.assign(row, C.normalizeEmploymentProfileSubmission({}, row));
    input.currentEmployee = new Models.ErgazomenoiModel(input.currentEmployee).toObject();
    input.completeHistoryRows.forEach((row, index) => { row.history_reference_fence = index + 2; });
    F.approveSyntheticEdition(input);
    if (approveCurrent) {
        const order = input.completeHistoryRows;
        delete order.at(-1).eidikothta_symbashs;
        input.completeHistoryRows = [order.at(-1), ...order.slice(0, -1)];
        F.approveSyntheticEdition(input, approvedTerms, { n: 2,
            mode: Object.keys(approvedTerms).length ? 'CORRECTION_EDITION' : 'APPROVAL_ONLY' });
        input.completeHistoryRows = order;
    }
    alter(input);
    const db = store([{ employee: input.currentEmployee, history: input.completeHistoryRows }], { cloneFn: clone });
    const matchesAudit = (row, filter) => Object.entries(filter).every(([path, value]) =>
        path === '$or' ? value.some(branch => matchesAudit(row, branch)) :
            String(path.split('.').reduce((part, key) => part?.[key], row)) === String(value));
    db.deps.auditModel.find = filter => ({ sort() { return this; }, session(s) { this.s = s; return this; },
        async lean() { return clone(this.s.draft.audits.filter(row => matchesAudit(row, filter))); } });
    const seed = await db.deps.connection.startSession();
    await seed.withTransaction(async () => {
        for (const audit of input.approvedHistoryDecisions) await db.deps.auditModel.create([audit], { session: seed });
    });
    await seed.endSession();
    db.events.length = 0;
    const captured = [], results = [], errors = [], effects = [];
    const employeeModel = { ...db.deps.employeeModel,
        schema: Models.ErgazomenoiModel.schema,
        hydrate: Models.ErgazomenoiModel.hydrate.bind(Models.ErgazomenoiModel),
        findOne(filter) {
            const query = db.deps.employeeModel.findOne(filter), lean = query.lean;
            query.lean = function () { return this.s ? lean.call(this) : Promise.resolve(db.state().employees.find(row =>
                Object.entries(filter).every(([field,value]) => String(row[field]) === String(value))) || null); };
            return query;
        } };
    const frozen = clone(input.protectedReferenceSummary);
    const deps = { ...db.deps, employeeModel,
        historyModel:{...db.deps.historyModel,create:(rows,options)=>
            db.deps.historyModel.create(rows.map(row=>row.toObject?.() || row),options)},
        referenceChecker: async ({ historyIds }) => clone(historyIds.flatMap(id => frozen[id] || [])),
        userModel: { findById: () => q({ _id: actorUserId, team: input.scope.team, situation: 'A' }) },
        privilegeModel: { findOne: () => q({ privileges: { update: true } }) },
        correctionCatalogLoader: async () => F.catalogs,
        approvedHistoryServiceFactory: options => {
            const service = require('../../services/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceService')
            .createApprovedHistoryAtomicMaintenanceService({...options,enabled:() => true,
                secret:'synthetic-full-form-workweek-signing-key',
                periodProtection:async() => ({uncertain:false,controls:[],snapshots:[],wire:[]}),
                claimPeriodProtection:async() => {},claimCompanyPeriod:async() => {},
                buildHistoryDocument:(_model,row) => new Models.IstorikoProslhpseonAllagonModel(row,null,{defaults:false})});
            return service;
        } };
    const handler = vm.runInNewContext(`${constants}\n${helpers}\n(${method})`, {
        SaveState: S, HistoryDeferral: D, Date, URL, mongoose,
        require(name) {
            if (name.endsWith('/contractGenerator')) return {};
            if (name.endsWith('/userContext')) return {};
            if (name.endsWith('/pdfHandler')) return {};
            if (name.endsWith('/e3_MA_v1Generator')) return { async generateMAXML() {
                assert.ok(db.events.some(event => event.type === 'commit'));
                assert.equal(db.state().employees[0].hmeres_ergasias_ebdomadas,6);
                effects.push('MA_XML');
                return {success:true,xml:'<synthetic/>',s3Key:'synthetic/MA.xml',s3Url:'s3://synthetic/MA.xml',filename:'MA.xml'};
            } };
            if (name.endsWith('/employeeDeferredExternalActionService')) return {
                updateAction:args => require('../../services/ergazomenoi/employeeDeferredExternalActionService').updateAction({...deps,...args}) };
            throw Error(`Unexpected dependency: ${name}`);
        },
        console: { log() {}, warn() {}, error(...args) { errors.push(args); } },
        logger: { info() {}, debug() {}, warn() {}, error() {} },
        ...M, ...require('../../utils/ergazomenoi/getOrarioTermsForDate'),
        ...require('../../services/ergazomenoi/employeeScheduleDailyRestValidationService'),
        ...require('../../utils/ergazomenoi/forologikhKlimakaCode'),
        ...require('../../utils/date/mondaySundayWeek'),
        ...require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionSaveContract'),
        ...require('../../services/ergazomenoi/employeeHistoryResolutionAnalysisService'),
        requireScopedEmployeeForUpdate: require('./employeeUpdateScope').requireScopedEmployeeForUpdate,
        ErgazomenoiModel: employeeModel,
        ProdhlomenaOrariaModel: { async findOneAndUpdate() { return null; } },
        CompaniesModel: { findById: () => q({ eponymia: 'ΣΥΝΘΕΤΙΚΗ' }) },
        YpokatasthmataModel: { findOne: () => q({}) },
        async writeEmployeeMaintenance(args) {
            captured.push(args);
            const result = await W.writeEmployeeMaintenance({ ...deps, ...args });
            results.push(result);
            return result;
        }
    });
    const payload = changes => ({ saveMode: 'final', historyPreflight: true,
        expectedEmployeeStateToken: S.employeeStateToken(db.state().employees[0]),
        formData: { ...fullForm(db.state().employees[0]),
            historyExpectedRevision: input.completeHistoryRows.at(-1).updatedAt.toISOString(),
            ...changes },
        filesToUpdate: { create_contract: false, isPermanent: true, erganiUploadMethod: 'xml' } });
    async function submit(body) {
        const req = { body: clone(body), params: { ergazomenoiId: String(input.currentEmployee._id) },
            sessionID: 'synthetic-approved-full-form',
            session: { userId: actorUserId, userTeam: input.scope.team, companyInUse: input.scope.company_kod } };
        const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
            json(value) { this.body = value; return this; } };
        await handler(req, res);
        return res;
    }
    async function save(changes) {
        const body = payload(changes), response = await submit(body);
        if (response.body.preflight !== true || response.body.success !== true) return response;
        assert.equal(response.body.decision, 'COMBINED_SAVE', JSON.stringify(response.body));
        return submit({ ...body, historyPreflight: false, historyDecision: response.body.decision,
            historyConfirmation: response.body.historyConfirmation });
    }
    const preserved = original => {
        assert.deepEqual(db.state().history.filter(row => input.approvedHistoryDecisions.some(audit =>
            audit.diagnostics.targetHistoryId === String(row._id))), original.history.filter(row =>
            input.approvedHistoryDecisions.some(audit => audit.diagnostics.targetHistoryId === String(row._id))));
        assert.deepEqual(db.state().audits.slice(0, original.audits.length), original.audits);
        assert.deepEqual(input.protectedReferenceSummary, frozen);
    };
    return { input, db, captured, results, errors, effects, deps, payload, submit, save, preserved };
}

test('Συνθετικό auditModel.find: το $or συνδυάζεται με όλα τα φίλτρα και τα εμφωλευμένα πεδία', async () => {
    const h = await harness(), original = h.db.state(), audit = original.audits[0];
    const scope = Object.fromEntries(Object.entries(audit.employeeScope).map(([key, value]) => [`employeeScope.${key}`, value]));
    const approved = { mutationSource: audit.mutationSource,
        'diagnostics.rowApproval.version': audit.diagnostics.rowApproval.version,
        'diagnostics.rowApproval.status': audit.diagnostics.rowApproval.status };
    const rejected = { ...approved, 'diagnostics.rowApproval.status': 'COMMITTED_AWAITING_VERIFICATION' };
    const session = await h.db.deps.connection.startSession();
    try {
        await session.withTransaction(async () => {
            const find = filter => h.db.deps.auditModel.find(filter).session(session).lean();
            assert.deepEqual(await find({ ...scope, ...approved }), original.audits);
            for (const branches of [[approved, rejected], [rejected, approved], [{ $or: [rejected, approved] }]])
                assert.deepEqual(await find({ ...scope, $or: branches }), original.audits);
            assert.deepEqual(await find({ ...scope, $or: [rejected, { 'diagnostics.missing.status': 'APPROVED_RESOLVED' }] }), []);
            for (const field of Object.keys(scope))
                assert.deepEqual(await find({ ...scope, [field]: 'OTHER_SYNTHETIC_SCOPE', $or: [approved] }), []);
            assert.deepEqual(await find({ ...scope, mutationSource: 'OTHER_SYNTHETIC_OPERATION', $or: [approved] }), []);
        });
    } finally { await session.endSession(); }
    assert.deepEqual(h.db.state(), original);
});

for (const approveCurrent of [false, true]) for (const versioned of [false, true]) test(`Πλήρης φόρμα με εγκεκριμένο Ιστορικό (${approveCurrent}, ${versioned}): αμετάβλητη αποθήκευση και ανεξάρτητη μεταβολή`, async () => {
    const h = await harness({ approveCurrent, versioned }), original = h.db.state();
    const unchanged = await h.submit(h.payload());
    assert.equal(unchanged.body.success, true, JSON.stringify({ body: unchanged.body, errors: h.errors }));
    assert.equal(unchanged.body.employeeUpdated, false);
    assert.equal(unchanged.body.historyUpdated, false);
    assert.deepEqual(h.db.state(), original);
    const changed = await h.save({ arithmos: '12' });
    assert.equal(changed.body.success, true, JSON.stringify({ body: changed.body, errors: h.errors }));
    assert.equal(changed.body.employeeUpdated, true);
    assert.equal(changed.body.historyUpdated, false);
    assert.equal(h.db.state().employees[0].arithmos, '12');
    assert.deepEqual(h.db.state().history, original.history);
    assert.deepEqual(h.db.state().audits, original.audits);
    h.preserved(original);
    const submitted = h.captured.at(-1);
    assert.ok(Object.keys(submitted.maintenance.submittedFormValues).length > 300);
    assert.ok(Object.keys(submitted.input).length > 10);
    assert.ok(Object.keys(submitted.maintenance.submittedHistoryChanges).length > 50);
    const intent = require('../../utils/ergazomenoi/employeeMaintenanceIntent')
        .normalizeEmployeeMaintenanceIntent(submitted, original.employees[0]);
    assert.deepEqual(Object.keys(intent.input), []);
    assert.deepEqual(Object.keys(intent.maintenance.historyChanges), []);
    assert.deepEqual(Object.keys(intent.maintenance.submittedHistoryChanges), []);
    assert.deepEqual(Object.keys(intent.maintenance.employeeChanges), ['arithmos']);
});

for (const approvedTerms of [{ pragmatikosMisthos: 1450 }, { dialleima_se_lepta: 15 },
    { hmeres_ergasias_ebdomadas: 6, typos_ebdomadas: '6HMERH', mo_oron_hmerhsias_ergasias: 40 / 6 }])
    test(`Αμετάβλητη επανυποβολή έναντι εγκεκριμένης διορθωτικής έκδοσης: ${JSON.stringify(approvedTerms)}`, async () => {
        const h = await harness({ approveCurrent: true, approvedTerms });
        const original = h.db.state();
        const unchanged = await h.submit(h.payload());
        assert.equal(unchanged.body.success, true, JSON.stringify(unchanged.body));
        const changed = await h.save({ arithmos: '12' });
        assert.equal(changed.body.success, true, JSON.stringify(changed.body));
        assert.equal(changed.body.employeeUpdated, true);
        assert.equal(changed.body.historyUpdated, false);
        assert.equal(changed.body.ambiguousHistoryPreserved, false);
        assert.equal(changed.body.historyPreservationReason, null);
        assert.equal(h.db.state().employees[0].arithmos, '12');
        assert.equal(h.db.state().employees[0].pragmatikosMisthos, original.employees[0].pragmatikosMisthos);
        assert.equal(h.db.state().employees[0].hmeres_ergasias_ebdomadas, original.employees[0].hmeres_ergasias_ebdomadas);
        assert.deepEqual(h.db.state().history, original.history);
        assert.deepEqual(h.db.state().audits, original.audits);
        h.preserved(original);
    });

for (const [label, changes, field, value] of [
    ['αποδοχών', { pragmatikosMisthos: 1550 }, 'pragmatikosMisthos', 1550],
    ['ποσού σύμβασης', { poso_symbashs_01: 1250 }, 'poso_symbashs_01', 1250],
    ['όρων διαλείμματος', { dialleima_se_lepta: 15 }, 'dialleima_se_lepta', 15]
]) test(`Πλήρης φόρμα με πραγματική αλλαγή ${label}: υπάρχων έλεγχος και επιβεβαιωμένη αποθήκευση`, async () => {
    const h = await harness(), original = h.db.state();
    const response = await h.save(changes);
    assert.equal(response.body.success, true, JSON.stringify({ body: response.body, errors: h.errors }));
    assert.equal(response.body.historyUpdated, true);
    assert.equal(h.results[0].preflight, true);
    assert.equal(h.results[0].decision, 'COMBINED_SAVE');
    assert.equal(h.db.state().employees[0][field], value);
    assert.equal(h.db.state().history.find(row => String(row._id) === String(original.history.at(-1)._id))[field], value);
    h.preserved(original);
});

test('Πλήρης φόρμα: πραγματική αλλαγή εγκεκριμένης τρέχουσας έκδοσης δεν παρακάμπτει την προστασία της', async () => {
    const h = await harness({ approveCurrent: true, approvedTerms: { pragmatikosMisthos: 1450 } });
    const original = h.db.state();
    const response = await h.save({ pragmatikosMisthos: 1550, arithmos: '12' });
    assert.equal(response.body.success, false);
    assert.equal(response.body.status, 'UNSAFE_HISTORY_CHANGE');
    assert.deepEqual(h.db.state(), original);
    h.preserved(original);
});

test('Πλήρης φόρμα: ανεξάρτητη μη εγκεκριμένη ιστορική έλλειψη παραμένει ορατή', async () => {
    const h = await harness({ independent: true }), original = h.db.state();
    const response = await h.save({ arithmos: '12' });
    assert.equal(response.body.success, false);
    assert.ok(response.body.missingFields.some(item => item.field === 'krathsh_01'));
    assert.deepEqual(h.db.state(), original);
    h.preserved(original);
});

for (const [label, alter] of [
    ['αλλοιωμένη έγκριση', input => { input.approvedHistoryDecisions[0].diagnostics.rowApproval.approvedContent.pragmatikosMisthos = 999; }],
    ['μη επαληθευμένη έγκριση', input => { input.approvedHistoryDecisions[0].diagnostics.rowApproval.status = 'COMMITTED_AWAITING_VERIFICATION'; }]
]) test(`Πλήρης φόρμα: ${label} δεν επιτρέπει ανεξάρτητη αποθήκευση ως καθαρό Ιστορικό`, async () => {
    const h = await harness({ alter }), original = h.db.state();
    const response = await h.save({ arithmos: '12' });
    assert.equal(response.body.success, false);
    assert.deepEqual(h.db.state(), original);
});

test('Πλήρης φόρμα: παρωχημένη κατάσταση εργαζομένου απορρίπτεται πριν από ανεξάρτητη εγγραφή', async () => {
    const h = await harness(), body = h.payload({ arithmos: '12' });
    h.db.changeCommittedEmployee(String(h.input.currentEmployee._id), { email: 'synthetic@example.invalid' });
    const original = h.db.state(), response = await h.submit(body);
    assert.equal(response.body.success, false);
    assert.equal(response.body.reason, 'EMPLOYEE_SAVE_STATE_STALE');
    assert.deepEqual(h.db.state(), original);
});

test('5→6 από 01/12/2026: ανοικτή εγκεκριμένη περίοδος επιλέγεται από ημερομηνίες και κλείνει μόνο λογικά', async () => {
    const h = await harness({ approveCurrent: true, approvedTerms: { eidikothta_symbashs: '01' },
        alter: input => input.completeHistoryRows.reverse() });
    const original = h.db.state(), currentId = h.input.approvedHistoryDecisions.at(-1).diagnostics.targetHistoryId;
    const prior = original.history.find(row => String(row._id) === currentId);
    assert.equal(prior.hmeromhnia_isxyos_oron_ergasias_eos, null);
    assert.notEqual(Number(prior.aa_eggrafhs), Math.max(...original.history.map(row => Number(row.aa_eggrafhs))));
    const service = require('../../services/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceService')
        .createApprovedHistoryAtomicMaintenanceService({ ...h.deps, enabled: () => true,
            secret: 'synthetic-december-workweek-signing-key', auditReady: async () => true,
            periodProtection: async () => ({ uncertain: false, controls: [], snapshots: [], wire: [] }),
            claimPeriodProtection: async () => {}, claimCompanyPeriod: async () => {},
            buildHistoryDocument: (_model, row) => row });
    const req = { session: { userId: actorUserId, userTeam: h.input.scope.team,
        companyInUse: h.input.scope.company_kod }, params: { id: String(h.input.currentEmployee._id) },
        sessionID: 'synthetic-december-workweek-session' };
    const context = await service.context(req);
    assert.equal(context.targetHistoryId, currentId);
    const change = { kind: 'NEW_CHANGE', effectiveFrom: '2026-12-01', correctedTerms: {
        hmeres_ergasias_ebdomadas: 6, typos_ebdomadas: '6HMERH',
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 40 / 6 } };
    const preview = await service.preview(req, change);
    assert.equal(preview.status, 'READY_FOR_SIGNED_ATOMIC_COMMIT');
    assert.deepEqual(h.db.state(), original);
    const result = await service.apply(req, change, preview.approval), after = h.db.state();
    assert.equal(after.history.length, original.history.length + 1);
    for (const row of original.history) assert.deepEqual(after.history.find(item => String(item._id) === String(row._id)), row);
    const added = after.history.find(row => String(row._id) === result.insertedHistoryId);
    assert.equal(new Date(added.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0, 10), '2026-12-01');
    assert.equal(added.hmeromhnia_isxyos_oron_ergasias_eos, null);
    for (const record of [added, after.employees[0]]) {
        assert.equal(record.hmeres_ergasias_ebdomadas, 6);
    }
    assert.equal(after.employees[0].apasxolhsh_basei_symbashs, '6');
    assert.equal(Object.hasOwn(added, 'apasxolhsh_basei_symbashs'), false);
    const projected = require('../../services/ergazomenoi/employeeHistoryProposalReadService').proposalHistoryState({
        ...h.input, currentEmployee: after.employees[0], completeHistoryRows: after.history, atomicBoundaryAudits: after.audits });
    const logicalPrior = projected.historyRows.find(row => String(row._id) === currentId);
    assert.equal(new Date(logicalPrior.hmeromhnia_isxyos_oron_ergasias_eos).toISOString().slice(0, 10), '2026-11-30');
    assert.equal(after.audits.at(-1).diagnostics.boundary.priorHistoryId, currentId);
    h.preserved(original);
});

const sixTerms = {hmeres_ergasias_ebdomadas:6,typos_ebdomadas:'6HMERH',
    ores_ergasias_ebdomadas:40,mo_oron_hmerhsias_ergasias:6.67};
function weekChangePayload(h, changes = {}) {
    return {...h.payload({...sixTerms,apasxolhsh_basei_symbashs:'6',arithmos:'12',hmeromhnia_metabolhs:'2026-12-01',...changes}),
        change:{kind:'NEW_CHANGE',effectiveFrom:'2026-12-01',correctedTerms:sixTerms},
        filesToUpdate:{create_contract:false,isPermanent:true,erganiUploadMethod:'rest',e3_metaboles_ergasiakhs_sxeshs:true}};
}
async function saveWeekChange(h, changes = {}) {
    const body=weekChangePayload(h,changes), preview=await h.submit(body);
    assert.equal(preview.body.success,true,JSON.stringify(preview.body));
    const confirmed={...body,historyPreflight:false,historyDecision:preview.body.decision,historyConfirmation:preview.body.historyConfirmation};
    const saved=await h.submit(confirmed);
    assert.equal(saved.body.success,true,JSON.stringify({body:saved.body,errors:h.errors}));
    return {body,preview,saved,confirmed};
}
async function dispatchMA(h, key, {beforeDispatchFailure=false,unknown=false,mutationDate='2026-12-01'} = {}) {
    const External=require('../../services/ergazomenoi/employeeDeferredExternalActionService');
    const Recovery=require('../../services/ergazomenoi/employeeExternalRecoveryEvidence');
    const req={session:{userId:actorUserId,userTeam:h.input.scope.team,companyInUse:h.input.scope.company_kod},
        headers:{'x-employee-history-action':key},path:'/ergazomenoi/ergazomenoi/submit-ma-to-erganh',
        body:{ergazomenosId:String(h.input.currentEmployee._id),processCode:'230',erganiUploadMethod:'rest',hmeromhnia_metabolhs:mutationDate}};
    const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
    await External.guardDeferredExternalAction('MA',h.deps)(req,res,async()=>{
        const worker=h.db.state().employees[0];
        assert.equal(worker.hmeres_ergasias_ebdomadas,6);
        assert.ok(h.db.events.some(event=>event.type==='commit'));
        const record=worker[D.ACTIONS].find(item=>item.key===key);
        const action=record.actions.find(item=>item.type==='MA');
        assert.equal(action.status,'RUNNING');
        if(beforeDispatchFailure) return res.status(503).json({success:false,submissionAttempted:false});
        await req.employeeExternalAction.bindRequest({submissionCode:Recovery.submissionCode('MA',record.parameters),
            environment:action.attempt.identity.environment,payload:{synthetic:'MA-submission'}});
        h.effects.push('ERGANI_MA');
        return res.status(unknown?503:200).json({success:!unknown,submissionAttempted:true,protocol:unknown?null:'SYNTHETIC-PROTOCOL'});
    });
    return res;
}
for (const missing of [false,true]) test(`Πλήρης αποθήκευση 5→6 + ΕΡΓΑΝΗ: ${missing ? 'πραγματική έλλειψη και Συνέχεια' : 'πλήρη στοιχεία'}`, async () => {
    const h = await harness({approveCurrent:true,approvedTerms:{eidikothta_symbashs:'01'}}), original = h.db.state();
    const body = weekChangePayload(h,missing ? {eidikothta_symbashs:''} : {});
    const preview = await h.submit(body);
    assert.equal(preview.body.success,true,JSON.stringify({body:preview.body,errors:h.errors}));
    assert.equal(preview.body.preflight,true);
    assert.equal(preview.body.decision,missing ? 'DEFER_HISTORY' : 'COMBINED_SAVE');
    if (missing) assert.deepEqual(Array.from(preview.body.missingFields,item => item.field),['eidikothta_symbashs']);
    assert.deepEqual(h.db.state(),original);
    assert.deepEqual(h.effects,[]);
    const response = await h.submit({...body,historyPreflight:false,historyDecision:preview.body.decision,
        historyConfirmation:preview.body.historyConfirmation});
    assert.equal(response.body.success,true,JSON.stringify({body:response.body,errors:h.errors}));
    assert.equal(response.body.historyDeferred,missing);
    assert.equal(response.body.historyUpdated,!missing);
    assert.equal(response.body.employeeUpdated,true);
    assert.equal(response.body.externalActionsAllowed,true);
    assert.equal(response.body.maXmlData.success,true);
    assert.deepEqual(h.effects,['MA_XML']);
    const after = h.db.state();
    assert.equal(after.employees[0].arithmos,'12');
    assert.equal(after.employees[0].hmeres_ergasias_ebdomadas,6);
    assert.equal(after.employees[0].apasxolhsh_basei_symbashs,'6');
    assert.equal(after.history.length,original.history.length+(missing ? 0 : 1));
    if (missing) {
        assert.deepEqual(after.history,original.history);
        assert.deepEqual(after.audits,original.audits);
        assert.equal(after.employees[0][D.FIELD].eventType,'NEW_CHANGE');
        assert.equal(new Date(after.employees[0][D.FIELD].effectiveFrom).toISOString().slice(0,10),'2026-12-01');
    }
    assert.equal(after.employees[0][D.ACTIONS].at(-1).key,response.body.idempotencyKey);
    assert.equal(after.employees[0][D.ACTIONS].at(-1).documents.status,'COMPLETED');
    const dispatched=await dispatchMA(h,response.body.idempotencyKey);
    assert.equal(dispatched.body.success,true);
    assert.equal(h.db.state().employees[0][D.ACTIONS].at(-1).actions[0].status,'SUCCEEDED');
    const replayed=await dispatchMA(h,response.body.idempotencyKey);
    assert.equal(replayed.body.success,false);
    assert.equal(replayed.body.reason,'EMPLOYEE_HISTORY_DEFER_ACTION_RECONCILIATION_REQUIRED');
    assert.deepEqual(h.effects,['MA_XML','ERGANI_MA']);
    const repeatedSave=await h.submit({...body,historyPreflight:false,historyDecision:preview.body.decision,
        historyConfirmation:preview.body.historyConfirmation});
    assert.equal(repeatedSave.body.success,false);
    assert.deepEqual(h.effects,['MA_XML','ERGANI_MA']);
    h.preserved(original);
});

test('Ελλιπής νέα μεταβολή + Επιστροφή: καμία εγγραφή, έγγραφο ή υποβολή',async()=>{
    const h=await harness(), original=h.db.state();
    const preview=await h.submit(weekChangePayload(h,{eidikothta_symbashs:''}));
    assert.equal(preview.body.status,'MISSING_REQUIRED_HISTORY_FIELDS');
    assert.deepEqual(h.db.state(),original);
    assert.deepEqual(h.effects,[]);
    assert.equal(h.db.events.some(event=>['write','fence'].includes(event.type)),false);
});

for(const missing of [true,false]) test(`Αποτυχία εγγραφής εργαζομένου σταματά το ΕΡΓΑΝΗ (${missing ? 'Συνέχεια' : 'πλήρες Ιστορικό'})`,async()=>{
    const h=await harness(), original=h.db.state(), body=weekChangePayload(h,missing?{eidikothta_symbashs:''}:{});
    const preview=await h.submit(body);
    assert.equal(preview.body.success,true,JSON.stringify(preview.body));
    h.db.hooks.beforeCommit=session=>{if(session.touched.size) throw Error('synthetic Employee commit failure');};
    const saved=await h.submit({...body,historyPreflight:false,historyDecision:preview.body.decision,historyConfirmation:preview.body.historyConfirmation});
    assert.equal(saved.body.success,false);
    assert.deepEqual(h.db.state(),original);
    assert.deepEqual(h.effects,[]);
    h.preserved(original);
});

test('Αποτυχία πριν από αποστολή επιτρέπει την υπάρχουσα ελεγχόμενη επανάληψη μόνο μία φορά',async()=>{
    const h=await harness(), original=h.db.state(), {saved}=await saveWeekChange(h,{eidikothta_symbashs:''});
    const failed=await dispatchMA(h,saved.body.idempotencyKey,{beforeDispatchFailure:true});
    assert.equal(failed.body.success,false);
    assert.equal(h.db.state().employees[0][D.ACTIONS].at(-1).actions[0].status,'FAILED_BEFORE_DISPATCH');
    assert.deepEqual(h.effects,['MA_XML']);
    const repeated=await dispatchMA(h,saved.body.idempotencyKey);
    assert.equal(repeated.body.success,true);
    assert.equal(h.effects.filter(effect=>effect==='ERGANI_MA').length,1);
    const third=await dispatchMA(h,saved.body.idempotencyKey);
    assert.equal(third.body.reason,'EMPLOYEE_HISTORY_DEFER_ACTION_RECONCILIATION_REQUIRED');
    assert.equal(h.effects.filter(effect=>effect==='ERGANI_MA').length,1);
    h.preserved(original);
});

test('Αβέβαιο αποτέλεσμα ΕΡΓΑΝΗ δεν επαναλαμβάνεται και ο εργαζόμενος παραμένει αποθηκευμένος',async()=>{
    const h=await harness(), original=h.db.state(), {saved}=await saveWeekChange(h,{eidikothta_symbashs:''});
    const uncertain=await dispatchMA(h,saved.body.idempotencyKey,{unknown:true});
    assert.equal(uncertain.body.success,false);
    assert.equal(h.db.state().employees[0][D.ACTIONS].at(-1).actions[0].status,'UNKNOWN');
    const repeated=await dispatchMA(h,saved.body.idempotencyKey);
    assert.equal(repeated.body.reason,'EMPLOYEE_HISTORY_DEFER_ACTION_RECONCILIATION_REQUIRED');
    assert.equal(h.effects.filter(effect=>effect==='ERGANI_MA').length,1);
    assert.equal(h.db.state().employees[0].arithmos,'12');
    assert.equal(h.db.state().employees[0].hmeres_ergasias_ebdomadas,6);
    h.preserved(original);
});

test('Εκκρεμής νέα περίοδος: ανεξάρτητη αλλαγή και νέα επιλογή ΕΡΓΑΝΗ διατηρούν την αρχική εκκρεμότητα',async()=>{
    const h=await harness(), {saved}=await saveWeekChange(h,{eidikothta_symbashs:''});
    await dispatchMA(h,saved.body.idempotencyKey);
    const before=h.db.state(), body={...h.payload({arithmos:'13',hmeromhnia_metabolhs:'2026-12-01'}),filesToUpdate:weekChangePayload(h).filesToUpdate};
    const preview=await h.submit(body);
    assert.equal(preview.body.decision,'SAVE_PENDING_CONTACT',JSON.stringify(preview.body));
    const response=await h.submit({...body,historyPreflight:false,historyDecision:preview.body.decision,historyConfirmation:preview.body.historyConfirmation});
    assert.equal(response.body.success,true,JSON.stringify({body:response.body,errors:h.errors}));
    assert.equal(response.body.externalActionsAllowed,true);
    assert.equal(h.db.state().employees[0].arithmos,'13');
    assert.deepEqual(h.db.state().employees[0][D.FIELD],before.employees[0][D.FIELD]);
    assert.deepEqual(h.db.state().history,before.history);
    assert.deepEqual(h.db.state().audits,before.audits);
    const duplicate=await dispatchMA(h,response.body.idempotencyKey);
    assert.equal(duplicate.body.reason,'EMPLOYEE_HISTORY_DEFER_ACTION_RECONCILIATION_REQUIRED');
    assert.equal(h.effects.filter(effect=>effect==='ERGANI_MA').length,1);
});

test('Συμπλήρωση της αρχικής νέας περιόδου δημιουργεί το λογικό όριο χωρίς επανάληψη ΕΡΓΑΝΗ',async()=>{
    const h=await harness({approveCurrent:true,approvedTerms:{eidikothta_symbashs:'01'}}), {saved}=await saveWeekChange(h,{eidikothta_symbashs:''});
    await dispatchMA(h,saved.body.idempotencyKey);
    const before=h.db.state(), pending=before.employees[0][D.FIELD];
    const body={...h.payload({eidikothta_symbashs:'01'}),pendingResolution:{id:pending.id,effectiveFrom:'2026-12-01',confirmed:true}};
    const preview=await h.submit(body);
    assert.equal(preview.body.decision,'RESOLVE_PENDING',JSON.stringify(preview.body));
    const response=await h.submit({...body,historyPreflight:false,historyDecision:preview.body.decision,historyConfirmation:preview.body.historyConfirmation});
    assert.equal(response.body.success,true,JSON.stringify({body:response.body,errors:h.errors}));
    assert.equal(response.body.pendingResolved,true);
    assert.equal(response.body.historyStatus,h.results.at(-1).historyStatus);
    assert.equal(h.db.state().employees[0][D.FIELD],null);
    assert.deepEqual(h.db.state().employees[0][D.ACTIONS],before.employees[0][D.ACTIONS]);
    assert.equal(h.db.state().history.length,before.history.length+1);
    assert.equal(h.effects.filter(effect=>effect==='ERGANI_MA').length,1);
    h.preserved(before);
});

test('Κενό ΕΩΣ παραμένει έγκυρο και ο μέσος όρος 6,67 δέχεται μόνο την υπάρχουσα ανοχή στρογγυλοποίησης',async()=>{
    const h=await harness(), row={...h.input.completeHistoryRows.at(-1),...sixTerms};
    const inspect=require('../../services/ergazomenoi/employeeHistorySaveValidationService').inspectEmployeeHistoryProposedRowSave;
    assert.deepEqual(inspect(row).issues,[]);
    const invalid=inspect({...row,mo_oron_hmerhsias_ergasias:6.68});
    assert.ok(invalid.issues.some(issue=>issue.check==='WEEKLY_HOURS_PRODUCT_MISMATCH'));
});

for(const failure of ['unauthorized','invalid_contract','invalid_catalog']) test(`Νέα μεταβολή δεν παρακάμπτει τον έλεγχο ${failure}`,async()=>{
    const h=await harness(), original=h.db.state(), body=weekChangePayload(h);
    if(failure==='unauthorized') h.deps.privilegeModel.findOne=()=>q({privileges:{update:false}});
    if(failure==='invalid_contract') body.formData.apasxolhsh_basei_symbashs='5';
    if(failure==='invalid_catalog') body.formData.eidikothta_symbashs='UNKNOWN_SYNTHETIC_SPECIALTY';
    const response=await h.submit(body);
    assert.equal(response.body.success,false,JSON.stringify(response.body));
    assert.deepEqual(h.db.state(),original);
    assert.deepEqual(h.effects,[]);
});

const saveUiSource = fs.readFileSync(__dirname + '/../../../public/js/ergazomenoi/genika/putFieldValues.js', 'utf8');
const saveUi = vm.runInNewContext(saveUiSource.slice(0,
    saveUiSource.indexOf("document.addEventListener('DOMContentLoaded'")) +
    '\n({ continueEmployeeSaveWithHistoryDecision })', {});
const jsonResponse = response => new Response(JSON.stringify(response.body), {
    status: response.statusCode, headers: { 'Content-Type': 'application/json' }
});

for (const missing of [false, true]) for (const approve of [false, true])
    test(`Προεπισκόπηση 29/11/2026 ${missing ? 'με έλλειψη και Συνέχεια' : 'χωρίς ελλείψεις'}: ${approve ? 'ρητή έγκριση με μία αποθήκευση' : 'ακύρωση με μηδενικές εγγραφές'}`, async () => {
    const h = await harness({ approveCurrent: true, approvedTerms: { eidikothta_symbashs: '01' } });
    const original = h.db.state(), body = weekChangePayload(h, { hmeromhnia_metabolhs: '2026-11-29',
        ...(missing ? { eidikothta_symbashs: '' } : {}) });
    body.change.effectiveFrom = '2026-11-29';
    const preview = await h.submit(body);
    assert.equal(preview.body.status, missing ? 'MISSING_REQUIRED_HISTORY_FIELDS' : 'READY_FOR_COMBINED_SAVE', JSON.stringify(preview.body));
    assert.deepEqual(h.db.state(), original);
    assert.deepEqual(h.effects, []);
    assert.equal(h.db.events.some(event => ['write', 'fence'].includes(event.type)), false);
    let saves = 0, prompts = 0;
    const result = await saveUi.continueEmployeeSaveWithHistoryDecision({
        response: jsonResponse(preview), originalPayload: body,
        documentRef: { createElement: () => ({ style: {}, append() {} }) },
        swal: { fire: async options => {
            prompts++;
            assert.equal(saves, 0);
            assert.deepEqual(h.db.state(), original);
            assert.deepEqual(h.effects, []);
            if (missing && prompts === 1) {
                assert.equal(options.confirmButtonText, 'Συνέχεια');
                return { isConfirmed: true };
            }
            assert.equal(options.confirmButtonText, 'Έγκριση και αποθήκευση');
            assert.match(options.text, /2026-11-29/);
            return { isConfirmed: approve };
        } },
        retryRequest: async approved => {
            saves++;
            assert.deepEqual(approved.formData, body.formData);
            assert.deepEqual(approved.change, body.change);
            assert.deepEqual(approved.filesToUpdate, body.filesToUpdate);
            return jsonResponse(await h.submit(approved));
        }
    });
    assert.equal(prompts, missing ? 2 : 1);
    assert.equal(saves, approve ? 1 : 0);
    if (!approve) {
        assert.equal(result.cancelled, true);
        assert.deepEqual(h.db.state(), original);
        assert.deepEqual(h.effects, []);
        assert.equal(h.db.events.some(event => ['write', 'fence'].includes(event.type)), false);
    } else {
        const saved = await result.response.json();
        assert.equal(saved.success, true, JSON.stringify(saved));
        assert.equal(h.db.state().employees[0].hmeres_ergasias_ebdomadas, 6);
        const added = h.db.state().history.filter(row => !original.history.some(old => String(old._id) === String(row._id)));
        assert.equal(added.length, missing ? 0 : 1);
        if (!missing) {
            assert.equal(added[0].aa_eggrafhs, '0004');
            assert.equal(new Date(added[0].hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0, 10), '2026-11-29');
        }
        assert.equal(h.db.state().audits.length, original.audits.length + (missing ? 0 : 1));
        assert.deepEqual(h.effects, ['MA_XML']);
        assert.equal((await dispatchMA(h, saved.idempotencyKey, { mutationDate: '2026-11-29' })).body.success, true);
        await dispatchMA(h, saved.idempotencyKey, { mutationDate: '2026-11-29' });
        const after = h.db.state();
        const replay = await h.submit(result.originalPayload);
        assert.equal(replay.body.success, false);
        assert.deepEqual(h.db.state(), after);
        assert.deepEqual(h.effects, ['MA_XML', 'ERGANI_MA']);
    }
    h.preserved(original);
});

test('Συνθετική 0004: CORRECT_SAVED_ERROR 6→5 στις 29/11/2026 διορθώνει την ίδια εγγραφή χωρίς 0005', async () => {
    const h = await harness({ approveCurrent: true, approvedTerms: { eidikothta_symbashs: '01' } });
    const original = h.db.state(), date = '2026-11-29';
    const body = weekChangePayload(h, { hmeromhnia_metabolhs: date });
    body.change.effectiveFrom = date;
    // This independent scenario has no selected document or ERGANI action.
    body.filesToUpdate = h.payload().filesToUpdate;
    const preview = await h.submit(body);
    assert.equal(preview.body.decision, 'COMBINED_SAVE', JSON.stringify(preview.body));
    const saved = await h.submit({ ...body, historyPreflight: false,
        historyDecision: preview.body.decision, historyConfirmation: preview.body.historyConfirmation });
    assert.equal(saved.body.success, true, JSON.stringify(saved.body));
    const before = h.db.state(), target = before.history.find(row => row.aa_eggrafhs === '0004');
    assert.ok(target);
    assert.equal(target.hmeres_ergasias_ebdomadas, 6);
    assert.ok(!h.input.approvedHistoryDecisions.some(audit => audit.diagnostics.targetHistoryId === String(target._id)));
    assert.deepEqual(h.input.protectedReferenceSummary[String(target._id)] || [], []);
    const five = { hmeres_ergasias_ebdomadas: 5, typos_ebdomadas: '5HMERH',
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8 };
    const correction = { ...h.payload({ ...five, apasxolhsh_basei_symbashs: '5', hmeromhnia_metabolhs: date }),
        change: { kind: 'CORRECT_SAVED_ERROR', effectiveFrom: date, correctedTerms: five, targetHistoryId: String(target._id) } };
    const checked = await h.submit(correction);
    assert.equal(checked.body.decision, 'COMBINED_SAVE', JSON.stringify(checked.body));
    assert.deepEqual(h.db.state(), before, 'και η προεπισκόπηση διόρθωσης είναι μόνο για ανάγνωση');
    const corrected = await h.submit({ ...correction, historyPreflight: false,
        historyDecision: checked.body.decision, historyConfirmation: checked.body.historyConfirmation });
    assert.equal(corrected.body.success, true, JSON.stringify({ body: corrected.body, errors: h.errors }));
    const after = h.db.state(), same = after.history.find(row => String(row._id) === String(target._id));
    assert.equal(after.history.length, before.history.length);
    assert.equal(after.history.some(row => row.aa_eggrafhs === '0005'), false);
    assert.equal(same.aa_eggrafhs, '0004');
    assert.equal(same.hmeres_ergasias_ebdomadas, 5);
    assert.equal(Object.hasOwn(same, 'apasxolhsh_basei_symbashs'), false);
    assert.equal(new Date(same.hmeromhnia_isxyos_oron_ergasias_apo).toISOString().slice(0, 10), date);
    assert.equal(after.employees[0].hmeres_ergasias_ebdomadas, 5);
    assert.equal(after.employees[0].apasxolhsh_basei_symbashs, '5');
    assert.equal(after.audits.length, before.audits.length + 1);
    assert.equal(after.audits.at(-1).diagnostics.operation, 'CORRECT_SAVED_ERROR');
    for (const row of original.history) assert.deepEqual(after.history.find(item => String(item._id) === String(row._id)), row);
    assert.deepEqual(h.effects, []);
    h.preserved(original);
});
