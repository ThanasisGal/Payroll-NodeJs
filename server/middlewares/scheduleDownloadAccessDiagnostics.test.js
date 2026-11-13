'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const diagnostics = require('../utils/erganh/scheduleDownloadDiagnostics');
const teamScope = require('../services/userTeamScopeService');
const { requestHarness } = require('../../test/helpers/scheduleDownloadHarness');

function load(filename, imports) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, filename), 'utf8'), {
        module, exports: module.exports,
        require(name) {
            assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`);
            return imports[name];
        }
    });
    return module.exports;
}

function accessHarness(failure) {
    const harness = requestHarness();
    const calls = [];
    const query = (value, name) => ({ select() { return this; }, lean: async () => {
        calls.push(name);
        if (failure === name) throw Error('synthetic-secret-marker');
        if (name === 'branch' && failure === 'conflict') {
            throw Object.assign(Error('synthetic-secret-marker'), { status: 409 });
        }
        return value;
    } });
    const privilege = load('requireUserPrivilegeForm.js', {
        '../models/privileges': { UserPrivilegesModel: {
            findOne: () => query({ privileges: { update: failure !== 'forbidden' } }, 'privilege')
        } },
        '../models/userModel': { findById: () => query(failure === 'inactive' ? null
            : { situation: 'A', team: 'TEST' }, 'user') },
        '../services/userTeamScopeService': teamScope,
        '../utils/erganh/scheduleDownloadDiagnostics': diagnostics
    }).requireUserPrivilegeAction('LhpshOrarionApoErganh', 'update');
    const scope = load('programmataAccessScope.js', {
        './../utils/ergazomenoi/finalizedEmployeeFilter': { finalizedEmployeeFilter: value => value },
        mongoose: { isValidObjectId: value => /^[a-f0-9]{24}$/.test(value) }, path,
        '../models/companies': {
            CompaniesModel: { findById: () => query(failure === 'missing-company' ? null
                : { team: failure === 'foreign-company' ? 'OTHER' : 'TEST', kod: 'TEST' }, 'company') },
            YpokatasthmataModel: { findOne: filter => {
                assert.equal(filter.kodikos, '0000');
                return query(failure === 'missing-branch' ? null : { _id: 'synthetic-branch' }, 'branch');
            } }
        },
        '../models/ergazomenoi': { ErgazomenoiModel: {} },
        '../services/ergazomenoi/daneizomenoiProdhlomenaOrariaUpdateService': {},
        '../services/userTeamScopeService': teamScope,
        '../utils/erganh/scheduleDownloadDiagnostics': diagnostics
    }).authorizeExternalAction;
    if (failure === 'unauthenticated') delete harness.req.session.userId;
    if (failure === 'invalid-company') harness.req.session.companyInUse = 'invalid';
    if (failure === 'foreign-request') harness.req.body.selectedTeam = 'OTHER';
    if (failure === 'invalid-date') harness.req.body.fromDate = '31/02/2026';
    if (failure === 'reversed-date') harness.req.body.toDate = '01/09/2026';
    if (failure === 'invalid-branch') harness.req.body.selectedPararthma = '';
    return { ...harness, calls, async run() {
        await privilege(harness.req, harness.res, () => scope(harness.req, harness.res, () => {
            calls.push('controller'); harness.res.json({ success: true });
        }));
    } };
}

for (const [failure, status, code, stage] of [
    ['unauthenticated', 401, 'SCHEDULE_AUTH_REQUIRED', 'authorization'],
    ['inactive', 403, 'SCHEDULE_FORBIDDEN', 'authorization'],
    ['forbidden', 403, 'SCHEDULE_FORBIDDEN', 'authorization'],
    ['privilege', 500, 'SCHEDULE_ACCESS_CHECK_FAILED', 'authorization'],
    ['invalid-company', 400, 'SCHEDULE_INVALID_REQUEST', 'company-authorization'],
    ['foreign-request', 404, 'SCHEDULE_RESOURCE_UNAVAILABLE', 'company-authorization'],
    ['missing-company', 404, 'SCHEDULE_RESOURCE_UNAVAILABLE', 'company-authorization'],
    ['foreign-company', 404, 'SCHEDULE_RESOURCE_UNAVAILABLE', 'company-authorization'],
    ['invalid-date', 400, 'SCHEDULE_DATES_INVALID', 'date-validation'],
    ['reversed-date', 400, 'SCHEDULE_DATES_INVALID', 'date-validation'],
    ['invalid-branch', 400, 'SCHEDULE_BRANCH_INVALID', 'branch-validation'],
    ['missing-branch', 404, 'SCHEDULE_RESOURCE_UNAVAILABLE', 'branch-authorization'],
    ['conflict', 409, 'SCHEDULE_CONFLICT', 'branch-authorization'],
    ['branch', 500, 'SCHEDULE_ACCESS_CHECK_FAILED', 'branch-authorization']
]) {
    test(`${failure} is rejected before the controller with safe ${status} diagnostics`, async () => {
        const h = accessHarness(failure);
        await h.run();
        assert.equal(h.res.statusCode, status);
        assert.equal(h.res.body.success, false);
        assert.equal(h.res.body.error.code, code);
        assert.equal(h.res.body.error.stage, stage);
        assert.equal(h.res.body.error.storageState, 'not_started');
        assert.equal(h.calls.includes('controller'), false);
        assert.equal(h.entries.length, 1);
        assert.equal(JSON.stringify({ body: h.res.body, entries: h.entries }).includes('synthetic-secret-marker'), false);
    });
}

test('authorized input preserves date values and normalizes branch zero before the controller', async () => {
    const h = accessHarness();
    await h.run();
    assert.equal(h.res.body.success, true);
    assert.equal(h.req.programmataAccessScope.ypokatasthma, '0000');
    assert.equal(h.req.programmataAccessScope.externalDateRange.startValue, '01/10/2026');
    assert.equal(h.calls.filter(call => call === 'controller').length, 1);
});

test('ordinary routes preserve their existing authorization response', async () => {
    const h = accessHarness('unauthenticated');
    delete h.req.scheduleDownloadDiagnostics;
    await h.run();
    assert.equal(h.res.statusCode, 401);
    assert.equal(h.res.body, 'Απαιτείται σύνδεση');
});

test('application initializes diagnostics before body parsing and returns a safe CSRF failure', () => {
    const app = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');
    assert.ok(app.indexOf('app.use(beginScheduleDownloadDiagnostics)') < app.indexOf("app.use(json({ limit:"));
    assert.ok(app.includes('app.use(scheduleDownloadRequestError)'));
    const start = app.indexOf('    if (!validateSimpleCsrfToken(req))');
    const end = app.indexOf('\n    next();\n});', start);
    const handler = vm.runInNewContext(`(req, res) => { ${app.slice(start, end)} }`, {
        validateSimpleCsrfToken: () => false,
        sendScheduleDownloadFailure: diagnostics.sendScheduleDownloadFailure
    });
    const h = requestHarness();
    handler(h.req, h.res);
    assert.equal(h.res.statusCode, 403);
    assert.equal(h.res.body.error.code, 'SCHEDULE_CSRF_REJECTED');
    assert.equal(h.entries[0].details.stage, 'authorization');
});
