'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), mongoose = require('mongoose');
const W = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const D = require('../../services/ergazomenoi/employeeHistoryDeferralService');
const E = require('../../services/ergazomenoi/employeeDeferredExternalActionService');
const S = require('../../utils/ergazomenoi/employeeSaveState');
const A = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const Models = require('../../models/ergazomenoi');
const { fixture, store } = require('../../../test/fixtures/employeeProfileTransactionStore');
const M = require('../../utils/ergazomenoi/employmentProfileMaintenance');
const Terms = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const source = fs.readFileSync(__dirname + '/ergazomenoiController.js', 'utf8').replaceAll('\r', '');
before(() => require('../../../test/fixtures/forbidRealSettlementMongo').forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
const q = value => ({ select() { return this; }, lean: async () => value });
const catalogs = { KPK_EFKA: [{ code: '0101' }], CONTRACT_TYPE: [{ code: '01' }],
    CONTRACT_CATEGORY: [{ code: '01', afora_thn_symbash: '01' }],
    CONTRACT_SPECIALTY: [{ code: '01', afora_thn_symbash_kathgoria: '0101' }] };
function harness() {
    const f = fixture(); f.employee._id = '507f1f77bcf86cd799439199';
    Object.assign(f.employee, { eponymo: 'ΣΥΝΘΕΤΙΚΟΣ', onoma: 'ΕΡΓΑΖΟΜΕΝΟΣ', afm: '123456789', oristikh_enhmerosh: true });
    delete f.employee.krathsh_01; delete f.history.at(-1).krathsh_01;
    const db = store([f], { cloneFn: A.clone }), effects = [], errors = [];
    const afterCommit = type => {
        assert.ok(db.events.some(event => event.type === 'commit'), `${type} precedes Employee commit`);
        assert.ok(db.state().employees[0][D.FIELD], `${type} has no persisted pending evidence`);
        effects.push(type);
    };
    const employeeModel = { ...db.deps.employeeModel, hydrate: Models.ErgazomenoiModel.hydrate.bind(Models.ErgazomenoiModel),
        findOne(filter) {
            const query = db.deps.employeeModel.findOne(filter), lean = query.lean;
            query.lean = function () { return this.s ? lean.call(this) : Promise.resolve(db.state().employees[0]); };
            return query;
        },
        async updateOne(filter, update, options) {
            if (options?.session) return db.deps.employeeModel.updateOne(filter, update, options);
            afterCommit('DOCUMENT_PATH'); db.changeCommittedEmployee(String(f.employee._id), update.$set || update);
            return { matchedCount: 1 };
        } };
    const auth = { userModel: { findById: () => ({ select() { return this; }, session() { return this; },
        lean: async () => ({ team: f.employee.team, situation: 'A' }) }) }, privilegeModel: { findOne: () => ({
            select() { return this; }, session() { return this; }, lean: async () => ({ privileges: { update: true } }) }) } };
    const dependencies = { ...db.deps, ...auth, employeeModel };
    const generatedXml = type => { afterCommit(type); return { xml: '<synthetic/>', s3Key: `synthetic/${type}.xml`,
        s3Url: `s3://synthetic/${type}.xml`, filename: `${type}.xml`, success: true }; };
    const fakeRequire = name => {
        if (name.endsWith('/pdfHandler')) return { savePdfFromBase64: async () => { afterCommit('ATTACHED_PDF'); return 'synthetic/attached.pdf'; } };
        if (name.endsWith('/contractGenerator')) return { generateContractPDF: async () => { afterCommit('CONTRACT_PDF'); return 'synthetic/contract.pdf'; } };
        if (name.endsWith('/userContext')) return { getUserContext: async () => ({}) };
        if (name.endsWith('/e3_MA_v1Generator')) return { generateMAXML: async () => generatedXml('MA_XML') };
        if (name.endsWith('/e3N_v1Generator')) return { generateE3XML: async () => generatedXml('E3_XML') };
        if (name.endsWith('/e5nTemplatePdfGenerator')) return { generateE5NPdf: async () => { afterCommit('E5N_PDF'); return { success: true, s3Key: 'synthetic/e5.pdf' }; } };
        if (name.endsWith('/employeeDeferredExternalActionService')) return { updateAction: args => E.updateAction({ ...dependencies, ...args }) };
        throw Error(`Unexpected dependency: ${name}`);
    };
    const start = source.indexOf('    static postErgazomenoiUpdate = '), end = source.indexOf('    static deleteErgazomenoi', start);
    const method = source.slice(start, end).trim().replace('static postErgazomenoiUpdate = ', '').replace(/;$/, '');
    const helpers = source.slice(source.indexOf('function valueOrEmpty('), source.indexOf('// ✅ HELPERS: Εμπλουτισμός ιστορικού'));
    const constants = source.slice(source.indexOf('const fieldsStoixeionSymbashs'), source.indexOf('function parseS3Uri'));
    const handler = vm.runInNewContext(`${constants}\n${helpers}\n(${method})`, {
        SaveState: S, HistoryDeferral: D, Date, URL, mongoose, require: fakeRequire,
        console: { log() {}, error(...args) { errors.push(args); }, warn() {} }, logger: { info() {}, debug() {}, error() {}, warn() {} },
        ...M, ...Terms, ...require('../../services/ergazomenoi/employeeScheduleDailyRestValidationService'),
        ...require('../../utils/ergazomenoi/forologikhKlimakaCode'),
        ...require('../../utils/date/mondaySundayWeek'),
        ...require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionSaveContract'),
        ...require('../../services/ergazomenoi/employeeHistoryResolutionAnalysisService'),
        requireScopedEmployeeForUpdate: require('./employeeUpdateScope').requireScopedEmployeeForUpdate,
        ErgazomenoiModel: employeeModel,
        writeEmployeeMaintenance: args => W.writeEmployeeMaintenance({ ...dependencies, ...args, correctionCatalogLoader: async () => catalogs }),
        CompaniesModel: { findById: () => q({ eponymia: 'ΣΥΝΘΕΤΙΚΗ' }) }, YpokatasthmataModel: { findOne: () => q({}) },
        generatePersistedEmployeeContract: async args => args.generateContractPDF(),
        generatePresignedUrl: async key => `https://synthetic.invalid/${key}`,
        generateE5NXML: async () => generatedXml('E5N_XML'), generateE7NXML: async () => generatedXml('E7N_XML')
    });
    const formData = { eponymoHidden: f.employee.eponymo, onomaHidden: f.employee.onoma,
        hmeromhnia_proslhpshs: '2026-01-01', hmeromhnia_isxyos_oron_ergasias_apo: '2026-03-01',
        symbash: '01', kathgoria_symbashs: '01', eidikothta_symbashs: '01',
        pragmatikosMisthos: 1500, hmeromhnia_metabolhs: '2026-03-01',
        pososto_prosayxhshs_6hs_hmeras: 0, corrective_payroll_withholding_rate_percent: 0 };
    const input = { saveMode: 'final', expectedEmployeeStateToken: S.employeeStateToken(f.employee), formData,
        filesToUpdate: { create_contract: true, e3_metaboles_ergasiakhs_sxeshs: true, isPermanent: true, erganiUploadMethod: 'rest' } };
    async function submit(body) {
        const req = { body: structuredClone(body), params: { ergazomenoiId: String(f.employee._id) }, sessionID: 'synthetic-controller-session',
            session: { userId: 'synthetic-actor', userTeam: f.employee.team, companyInUse: f.employee.company_kod } };
        const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
        await handler(req, res); return res;
    }
    return { db, effects, errors, submit, input };
}
test('full update controller: preflight returns before documents/schedules; confirmed Employee commit precedes selected PDF and XML preparation', async () => {
    const h = harness(), original = h.db.state();
    const preview = await h.submit({ ...h.input, historyPreflight: true });
    assert.equal(preview.body.status, 'MISSING_REQUIRED_HISTORY_FIELDS', JSON.stringify(h.errors));
    assert.deepEqual(h.db.state(), original); assert.deepEqual(h.effects, []);
    const saved = await h.submit({ ...h.input, historyDecision: preview.body.decision, historyConfirmation: preview.body.historyConfirmation });
    assert.equal(saved.statusCode, 200); assert.equal(saved.body.historyDeferred, true, saved.body.errorMessage);
    assert.equal(saved.body.historyUpdated, false); assert.equal(saved.body.externalActionsAllowed, true);
    assert.equal(saved.body.contractPdf.showPreview, true); assert.equal(saved.body.maXmlData.success, true);
    assert.deepEqual(h.effects, ['CONTRACT_PDF', 'DOCUMENT_PATH', 'MA_XML']);
    assert.deepEqual(h.db.state().history, original.history);
    assert.equal(h.db.state().employees[0][D.ACTIONS][0].documents.status, 'COMPLETED');
    const beforeRetry = h.db.state();
    const retry = await h.submit({ ...h.input, historyDecision: preview.body.decision, historyConfirmation: preview.body.historyConfirmation });
    assert.equal(retry.body.success, false); assert.deepEqual(h.db.state(), beforeRetry);
    assert.deepEqual(h.effects, ['CONTRACT_PDF', 'DOCUMENT_PATH', 'MA_XML']);
});
test('full update controller: a forged Continue cannot start document generation or employee-only write', async () => {
    const h = harness(), before = h.db.state();
    const response = await h.submit({ ...h.input, historyDecision: 'DEFER_HISTORY', historyConfirmation: 'forged' });
    assert.equal(response.body.success, false); assert.deepEqual(h.db.state(), before); assert.deepEqual(h.effects, []);
});
for (const [flag, expected] of [['ma_217', ['E5N_PDF', 'E5N_XML']], ['ma_222', ['E7N_XML']], ['ma_221', []]]) {
    test(`full update controller: first departure keeps selected ${flag} preparation after deferred commit`, async () => {
        const h = harness(), original = h.db.state();
        Object.assign(h.input.formData, { hmeromhnia_apoxorhshs: '2026-09-30',
            hmeromhnia_lhxhs_symbashs: '2026-12-31', logos_peratoshs_stathera: '1',
            parathrhseis_peratoshs: 'Συνθετική περαίωση σύμβασης.' });
        h.input.filesToUpdate = { [flag]: true, create_contract: false, isPermanent: true, erganiUploadMethod: 'rest' };
        const p = await h.submit({ ...h.input, historyPreflight: true });
        assert.equal(p.body.status, 'MISSING_REQUIRED_HISTORY_FIELDS', JSON.stringify(h.errors));
        assert.deepEqual(h.effects, []); assert.deepEqual(h.db.state(), original);
        const r = await h.submit({ ...h.input, historyDecision: 'DEFER_HISTORY', historyConfirmation: p.body.historyConfirmation });
        assert.equal(r.body.historyDeferred, true, JSON.stringify(h.errors));
        assert.equal(r.body.externalActionsAllowed, true); assert.deepEqual(h.effects, expected);
        assert.deepEqual(h.db.state().history, original.history);
        assert.equal(h.db.state().employees[0].energos, false);
    });
}
