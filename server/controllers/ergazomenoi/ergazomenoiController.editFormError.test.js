'use strict';
const Authorization = require('../../services/ergazomenoi/employeeHistoryAuthorizationService');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ejs = require('ejs');
const { dataFor } = require('../../../test/fixtures/responsiveForms');
const mongoose = require('mongoose');
const EditorState = require('../../services/ergazomenoi/employeeHistoryEditorStateService');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const {
    selectMaintenanceMode
} = require('../../services/ergazomenoi/employeeEmploymentProfileWriter');
const { buildEmployeeMaintenanceIdentity } =
    require('../../services/ergazomenoi/employeeMaintenanceHistoryPlannerService');
const { dateKeyUtc } = require('../../utils/date/mondaySundayWeek');
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

function editHandler(historyRows, calls = { history: [], writes: [] }) {
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
    const historyQuery = {
        mongooseOptions(options) {
            calls.history.push(['mongooseOptions', { ...options }]);
            return options;
        },
        sort(order) { calls.history.push(['sort', { ...order }]); return this; },
        lean() { calls.history.push(['lean']); return this; },
        then(resolve, reject) {
            calls.history.push(['read']);
            return Promise.resolve(historyRows).then(resolve, reject);
        }
    };
    const readOnlyModel = (methods) => new Proxy(methods, {
        get(target, name) {
            if (Object.hasOwn(target, name)) return target[name];
            return () => {
                calls.writes.push(name);
                throw new Error(`Unexpected model operation: ${String(name)}`);
            };
        }
    });
    const context = { SaveState: require('../../utils/ergazomenoi/employeeSaveState'),
        Date,
        ...EditorState,
        semanticHistoryRows,
        console: { error() {} },
        CompaniesModel: readOnlyModel({ findById: () => query({ _id: employee.company_kod }) }),
        ErgazomenoiModel: readOnlyModel({ findOne: (filter) => {
            (calls.employees ||= []).push({ ...filter });
            return query(Object.entries(filter).every(([field, value]) => employee[field] === value)
                ? employee : null);
        } }),
        IstorikoProslhpseonAllagonModel: readOnlyModel({ find(filter) {
            calls.history.push(['find', { ...filter }]);
            return historyQuery;
        } }),
        PerifereiesModel: readOnlyModel({ find: () => query([]) }),
        GenikesParametroiModel: readOnlyModel({ find: () => query([]) }),
        ProdhlomenaOrariaModel: readOnlyModel({ find: () => query([]) }),
        ProgrammataDypaModel: readOnlyModel({ findOne: () => query(null) }),
        mongoose: { trusted: (value) => value },
        enrichIstorikoRowsForDetails: async (rows) => rows,
        getEmploymentProfileUiContext: async () => ({ types: [], categories: [] }),
        ...Authorization, getEmployeeHistoryAccess: async () => ({ mode: Authorization.ACCESS_MODES.NONE }),
        buildEmployeeMaintenanceIdentity,
        dateKeyUtc,
        selectMaintenanceMode,
        isEmploymentProfileError
    };
    vm.runInNewContext(`this.handler = ${method}`, context);
    return context.handler;
}

test('ambiguous History opens Maintenance with HTTP 200, both rows intact and no selected History identity', async () => {
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
        employment_profile_source: 'ERGOMENOI_CONTROLLER', afora_allagh_oron_ergasias: true,
        updatedAt: new Date('2026-09-26T07:30:00.000Z') };
    const req = { params: { id: '69e8ca00b198b803164b7718' }, session: {
        userTeam: 'BLG', companyInUse: '69e7812a74cb535fd4d1a6e1', yearInUse: '2026'
    } };
    const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        render(view, locals) { this.view = view; this.locals = locals; this.finished = true; return this; }
    };
    let forwarded = null;

    const historyRows = [legacy, modern];
    const before = structuredClone(historyRows);
    const calls = { history: [], writes: [] };
    await editHandler(historyRows, calls)(req, res, (error) => { forwarded = error; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.finished, true);
    assert.equal(res.view, 'ergazomenoi/ergazomenoi/edit');
    assert.equal(res.locals.originalEmploymentHistoryId, '');
    assert.equal(res.locals.originalEmploymentHistoryRevision, '');
    assert.deepEqual(res.locals.istorikoData, historyRows);
    assert.deepEqual(historyRows, before);
    assert.equal(res.locals.employeeHistoryStateToken, EditorState.buildEmployeeHistoryEditorStateToken({
        currentEmployee: res.locals.rec, historyRows
    }));
    assert.equal(res.locals.employeeHistoryAccessMode, Authorization.ACCESS_MODES.NONE);
    assert.equal(res.locals.canManageEmployeeHistory, false);
    assert.deepEqual(calls.writes, []);

    const file = 'views/ergazomenoi/ergazomenoi/edit.ejs';
    const html = await ejs.renderFile(path.join(__dirname, '../../..', file), {
        ...dataFor(file), ...res.locals
    });
    assert.match(html, /employee-edit-page/);
    assert.match(html, /id="istorikoId"[^>]*value=""/);
    for (const row of historyRows) assert.ok(html.includes(`data-id="${row._id}"`));
    assert.match(html, /data-history-access-mode="NONE"/);
    assert.match(html, /data-can-manage-history="false"/);
    assert.match(html, /data-action="edit"[^>]*disabled aria-disabled="true"/);
    // Preserve the non-blocking History review control and its no-write explanation.
    assert.match(html, /id="employeeHistoryReconstructionPreviewBtn"/);
    assert.match(html, /Η προεπισκόπηση δεν αποθηκεύει αλλαγές/);
    assert.equal(forwarded, null);
});

test('edit page reads History and renders without writes when mongooseOptions returns a non-query', async () => {
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
        employment_profile_source: 'ERGOMENOI_CONTROLLER', afora_allagh_oron_ergasias: true,
        updatedAt: new Date('2026-09-26T07:30:00.000Z') };
    const req = { params: { id: '69e8ca00b198b803164b7718' }, session: {
        userTeam: 'BLG', companyInUse: '69e7812a74cb535fd4d1a6e1', yearInUse: '2026'
    } };
    const res = { statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        render(view, locals) { this.view = view; this.locals = locals; this.finished = true; } };
    let forwarded = null;
    const calls = { history: [], writes: [] };

    await editHandler([legacy, modern], calls)(req, res, (error) => { forwarded = error; });

    assert.equal(forwarded, null);
    assert.deepEqual(calls.history, [
        ['find', { team: 'BLG', company_kod: '69e7812a74cb535fd4d1a6e1', kodikos: '0005' }],
        ['mongooseOptions', { includeRedundantHistoryArtifacts: true }],
        ['sort', { aa_eggrafhs: 1 }],
        ['lean'],
        ['read']
    ]);
    assert.deepEqual(calls.writes, []);
    assert.equal(res.finished, true);
    assert.equal(res.view, 'ergazomenoi/ergazomenoi/edit');
    assert.equal(res.statusCode, 200);
    assert.equal(res.locals.employeeHistoryAccessMode, Authorization.ACCESS_MODES.NONE);
    assert.equal(res.locals.canManageEmployeeHistory, false);
    assert.equal(res.locals.originalEmploymentHistoryId, '6a65e737a2ce245e430d4d70');
    assert.equal(res.locals.originalEmploymentHistoryRevision, '2026-09-26T07:30:00.000Z');
    assert.equal(forwarded, null);
});

test('real Mongoose query retains sort and lean after setting mongooseOptions separately without a database', () => {
    const query = new mongoose.Query();
    const options = { includeRedundantHistoryArtifacts: true };

    assert.equal(query.mongooseOptions(options), options);
    assert.notEqual(options, query);
    assert.equal(query.mongooseOptions().includeRedundantHistoryArtifacts, true);
    assert.equal(query.sort({ aa_eggrafhs: 1 }), query);
    assert.deepEqual(query.options.sort, { aa_eggrafhs: 1 });
    assert.equal(query.lean(), query);
    assert.equal(query.mongooseOptions().lean, true);
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
    const context = { SaveState: require('../../utils/ergazomenoi/employeeSaveState'),
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

test('approved non-blocking History warning remains after a confirmed Employee save', () => {
    const frontend = fs.readFileSync(path.join(__dirname,
        '../../../public/js/ergazomenoi/genika/putFieldValues.js'), 'utf8');
    const start = frontend.indexOf('if (response.ok && data?.success === true && data?.employeeUpdated === true &&');
    assert.ok(start >= 0);
    const end = frontend.indexOf('window.applyEmployeeFinalState?.(data);', start);
    assert.ok(end > start);
    const notification = frontend.slice(start, end);
    assert.match(notification, /data\?\.historyUpdated === false && data\?\.ambiguousHistoryPreserved === true/);
    assert.match(notification, /title: 'Η αποθήκευση ολοκληρώθηκε'/);
    assert.ok(notification.includes('Τα στοιχεία του εργαζομένου αποθηκεύτηκαν επιτυχώς. Το εργασιακό ιστορικό δεν ενημερώθηκε λόγω ασυμφωνίας στις ιστορικές εγγραφές. Απαιτείται έλεγχος από διαχειριστή.'));
    assert.match(notification, /withEmployeeMaintenanceButtonStyles\(/);
    assert.match(notification, /showConfirmButton: true, showCancelButton: false, confirmButtonText: 'Κλείσιμο'/);
});

for (const [field, value] of [['userTeam', 'OTHER_TEAM'], ['companyInUse', 'OTHER_COMPANY']]) {
    test(`Maintenance retains Employee access scoping for ${field}`, async () => {
        const calls = { history: [], writes: [] };
        const req = { params: { id: '69e8ca00b198b803164b7718' }, session: {
            userTeam: 'BLG', companyInUse: '69e7812a74cb535fd4d1a6e1', yearInUse: '2026',
            [field]: value
        } };
        const res = { statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; },
            render() { assert.fail('An out-of-scope Employee must not render'); }
        };
        await editHandler([], calls)(req, res, error => { throw error; });
        assert.equal(res.statusCode, 404);
        assert.equal(res.body.success, false);
        assert.equal(res.body.reason, 'EMPLOYEE_SAVE_NOT_FOUND');
        assert.equal(calls.employees[0].team, req.session.userTeam);
        assert.equal(calls.employees[0].company_kod, req.session.companyInUse);
        assert.deepEqual(calls.history, []);
        assert.deepEqual(calls.writes, []);
    });
}

test('Maintenance route still requires authentication before opening the form', async () => {
    const routes = fs.readFileSync(path.join(__dirname, '../../routes/usersRoute.js'), 'utf8');
    assert.match(routes, /router\.get\(\s*'\/ergazomenoi\/ergazomenoi\/edit\/:id',\s*checkAuth,\s*ergazomenoiController\.editErgazomenoiForm/);
    const checkAuth = require('../../middlewares/checkValidUser');
    const redirects = [];
    let allowed = false;
    await checkAuth({ session: {} }, { redirect: url => redirects.push(url) }, () => { allowed = true; });
    assert.deepEqual(redirects, ['/login']);
    assert.equal(allowed, false);
    await checkAuth({ session: { userId: 'synthetic-authorized-user' } },
        { redirect() { assert.fail('Authenticated user should continue'); } }, () => { allowed = true; });
    assert.equal(allowed, true);
});
