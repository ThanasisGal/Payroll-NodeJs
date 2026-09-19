'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {
    selectMaintenanceMode
} = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const {
    isEmploymentProfileError
} = require('../../utils/ergazomenoi/employmentProfileMaintenance');

const source = fs
    .readFileSync(__dirname + '/ergazomenoiController.js', 'utf8')
    .replaceAll('\r', '');

function extract(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(start, -1, startMarker);
    assert.notEqual(end, -1, endMarker);
    return source.slice(start, end);
}

function editHandler(historyRows) {
    const helper = extract(
        'function getIstorikoDateIdentity(formData = {}) {',
        '// =========================================================================\n// ✅ HELPERS: Εμπλουτισμός ιστορικού'
    );
    const method = extract(
        '    static editErgazomenoiForm = async (req, res, next) => {',
        '    static getIstorikoData = async (req, res) => {'
    ).replace('    static editErgazomenoiForm = ', '');
    const employee = {
        _id: '69e8ca00b198b803164b7718',
        team: 'BLG',
        company_kod: '69e7812a74cb535fd4d1a6e1',
        kodikos: '0005',
        hmeromhnia_proslhpshs: new Date('2026-04-23'),
        hmeromhnia_allaghs_symbashs: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_eos: new Date('2026-04-29'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_lhxhs_symbashs: new Date('2026-10-31'),
        hmeromhnia_apoxorhshs: new Date('2026-04-24')
    };
    const query = (value) => ({
        sort() { return this; },
        lean() { return this; },
        exec: async () => value,
        then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
    });
    const context = {
        Date,
        console: { error() {} },
        toDateOrNull(value) {
            if (!value) return null;
            return value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
        },
        CompaniesModel: { findById: () => query({ _id: employee.company_kod }) },
        ErgazomenoiModel: { findById: () => query(employee) },
        IstorikoProslhpseonAllagonModel: { find: () => query(historyRows) },
        PerifereiesModel: { find: () => query([]) },
        GenikesParametroiModel: { find: () => query([]) },
        ProdhlomenaOrariaModel: { find: () => query([]) },
        ProgrammataDypaModel: { findOne: () => query(null) },
        mongoose: { trusted: (value) => value },
        enrichIstorikoRowsForDetails: async (rows) => rows,
        getEmploymentProfileUiContext: async () => ({}),
        selectMaintenanceMode,
        isEmploymentProfileError
    };
    vm.runInNewContext(`${helper}\nthis.handler = ${method}`, context);
    return context.handler;
}

test('edit page returns a completed friendly 409 response for normalized legacy/modern ambiguity', async () => {
    const shared = {
        team: 'BLG',
        company_kod: '69e7812a74cb535fd4d1a6e1',
        kodikos: '0005',
        hmeromhnia_proslhpshs: new Date('2026-04-23'),
        hmeromhnia_allaghs_symbashs: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_eos: new Date('2026-04-29'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_lhxhs_symbashs: new Date('2026-10-31'),
        hmeromhnia_apoxorhshs: new Date('2026-04-24')
    };
    const legacy = { ...shared, _id: '69e8ca00b198b803164b7731', aa_eggrafhs: '0001' };
    delete legacy.hmeromhnia_isxyos_oron_ergasias_apo;
    const modern = { ...shared, _id: '6a65e737a2ce245e430d4d70', aa_eggrafhs: '0002',
        employment_profile_source: 'ERGOMENOI_CONTROLLER', afora_allagh_oron_ergasias: true };
    const req = { params: { id: '69e8ca00b198b803164b7718' }, session: {
        userTeam: 'BLG', companyInUse: '69e7812a74cb535fd4d1a6e1', yearInUse: '2026'
    } };
    const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        render(view, locals) { this.view = view; this.locals = locals; this.finished = true; return this; }
    };
    let forwarded = null;

    await editHandler([legacy, modern])(req, res, (error) => { forwarded = error; });

    assert.equal(res.statusCode, 409);
    assert.equal(res.finished, true);
    assert.equal(res.view, 'ergazomenoi/ergazomenoi/employment-profile-conflict');
    assert.match(res.locals.message, /περισσότερες από μία/);
    assert.doesNotMatch(res.locals.message, /EMPLOYEE_PROFILE|Error|stack/i);
    assert.equal(forwarded, null);
});

test('edit page selects the open modern row and reaches the normal render path', async () => {
    const shared = {
        team: 'BLG', company_kod: '69e7812a74cb535fd4d1a6e1', kodikos: '0005',
        hmeromhnia_proslhpshs: new Date('2026-04-23'),
        hmeromhnia_allaghs_symbashs: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_apo: new Date('2026-04-23'),
        hmeromhnia_allaghs_orarioy_eos: new Date('2026-04-29'),
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-04-23'),
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_lhxhs_symbashs: new Date('2026-10-31'),
        hmeromhnia_apoxorhshs: new Date('2026-04-24')
    };
    const legacy = { ...shared, _id: '69e8ca00b198b803164b7731', aa_eggrafhs: '0001' };
    delete legacy.hmeromhnia_isxyos_oron_ergasias_apo;
    delete legacy.hmeromhnia_isxyos_oron_ergasias_eos;
    const modern = { ...shared, _id: '6a65e737a2ce245e430d4d70', aa_eggrafhs: '0002',
        employment_profile_source: 'ERGOMENOI_CONTROLLER', afora_allagh_oron_ergasias: true };
    const req = { params: { id: '69e8ca00b198b803164b7718' }, session: {
        userTeam: 'BLG', companyInUse: '69e7812a74cb535fd4d1a6e1', yearInUse: '2026'
    } };
    const res = { render(view, locals) { this.view = view; this.locals = locals; this.finished = true; } };
    let forwarded = null;

    await editHandler([legacy, modern])(req, res, (error) => { forwarded = error; });

    assert.equal(res.finished, true);
    assert.equal(res.view, 'ergazomenoi/ergazomenoi/edit');
    assert.equal(res.locals.originalEmploymentHistoryId, '6a65e737a2ce245e430d4d70');
    assert.equal(forwarded, null);
});

test('edit page timing labels are not process-global and unexpected failures are forwarded', async () => {
    assert.doesNotMatch(source, /console\.time\(['"](?:ENRICH|ISTORIKO_FIND)['"]\)/);
    assert.doesNotMatch(source, /console\.timeEnd\(['"](?:ENRICH|ISTORIKO_FIND)['"]\)/);

    const req = { params: { id: 'missing' }, session: {
        userTeam: 'BLG', companyInUse: 'company', yearInUse: '2026'
    } };
    const unexpected = new Error('database unavailable');
    const query = () => ({ lean: async () => { throw unexpected; } });
    const method = extract(
        '    static editErgazomenoiForm = async (req, res, next) => {',
        '    static getIstorikoData = async (req, res) => {'
    ).replace('    static editErgazomenoiForm = ', '');
    const context = {
        console: { error() {} },
        CompaniesModel: { findById: query },
        isEmploymentProfileError
    };
    vm.runInNewContext(`this.handler = ${method}`, context);
    const handler = context.handler;
    let forwarded;

    await handler(req, {}, (error) => { forwarded = error; });

    assert.equal(forwarded, unexpected);
});

test('conflict page exposes only the friendly escaped message contract', () => {
    const view = fs.readFileSync(
        __dirname + '/../../../views/ergazomenoi/ergazomenoi/employment-profile-conflict.ejs',
        'utf8'
    );
    assert.match(view, /<%= message %>/);
    assert.match(
        view,
        /href="\/ergazomenoi\/ergazomenoi" class="btn btn-brown rounded-4 buttons-content"/
    );
    assert.doesNotMatch(view, /btn-outline-secondary/);
    assert.doesNotMatch(view, /error\.(?:stack|message)|reason|code/);
});
