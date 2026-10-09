'use strict';
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createEmployeeHistoryReconstructionApplyController: create } = require('./employeeHistoryReconstructionApplyController');
const A = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
const User = require('../../models/userModel');
const { UserPrivilegesModel: Privileges } = require('../../models/privileges');
const { requireUserPrivilegeAction } = require('../../middlewares/requireUserPrivilegeForm');
const employeeId = '507f1f77bcf86cd799439011', companyId = '507f1f77bcf86cd799439022';
const query = value => ({ select(fields) { this.fields = fields; return this; }, lean: async () => value });
function setup(error) {
    const calls = [], reads = [];
    const req = { params: { id: employeeId }, session: { userId: 'authenticated', userTeam: 'TEST', companyInUse: companyId },
        authenticatedUserTeam: 'TEST', body: { previewToken: 'a'.repeat(43), approvalAccepted: true },
        query: { team: 'THA', privileges: 'A' } };
    const res = { code: 200, headers: {}, set(key, value) { this.headers[key] = value; return this; },
        status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
    const controller = create({ companyModel: { findOne(filter) { reads.push(filter); return query({ _id: companyId }); } },
        employeeModel: { findOne(filter) { reads.push(filter); return query({ _id: employeeId, team: 'TEST', company_kod: companyId, kodikos: '0002' }); } },
        apply: async options => { calls.push(options); if (error) throw error; return { success: true, applied: true, changedRows: 2, changedFields: 97 }; } });
    return { req, res, controller, calls, reads };
}
test('Apply passes only authenticated scope, identity, opaque token and boolean approval to server service', async () => {
    const { req, res, controller, calls } = setup(); await controller(req, res);
    assert.equal(res.code, 200);
    assert.deepEqual(calls, [{ scope: { team: 'TEST', company_kod: companyId, kodikos: '0002' },
        employeeId, previewToken: req.body.previewToken, approvalAccepted: true, actorUserId: 'authenticated' }]);
    assert.deepEqual(res.body, { success: true, applied: true, changedRows: 2, changedFields: 97 });
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.doesNotMatch(JSON.stringify(res.body), /507f|token|rowDiff|patch|_id/);
});
for (const field of ['proposedRows', 'rowDiffs', 'patches', 'sourceHistoryIds', 'assumedValues', 'updates', 'accessMode', 'actorUserId', 'requestId', '_csrf']) {
    test(`browser ${field} rejected before any database read or writer call`, async () => {
        const { req, res, controller, reads, calls } = setup(); req.body[field] = [];
        await controller(req, res); assert.equal(res.code, 400); assert.deepEqual(calls, []); assert.deepEqual(reads, []);
    });
}
for (const [name, mutate, status] of [
    ['no actor', req => { delete req.session.userId; }, 401],
    ['approval false', req => { req.body.approvalAccepted = false; }, 400],
    ['approval string', req => { req.body.approvalAccepted = 'true'; }, 400],
    ['missing token', req => { delete req.body.previewToken; }, 400],
    ['malformed token', req => { req.body.previewToken = {}; }, 400],
    ['team injection', req => { req.authenticatedUserTeam = 'OTHER'; }, 404],
    ['missing authenticated team', req => { delete req.authenticatedUserTeam; }, 403],
    ['query-shaped company', req => { req.session.companyInUse = { $ne: null }; }, 404],
    ['query-shaped employee', req => { req.params.id = { $ne: null }; }, 404]
]) test(`${name}: controlled rejection with zero service calls`, async () => {
    const { req, res, controller, calls } = setup(); mutate(req); await controller(req, res);
    assert.equal(res.code, status); assert.deepEqual(calls, []);
    assert.match(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή.*1\..*2\..*Κωδικός αναφοράς/s);
});
for (const [error, status, code] of [
    [A.failure('STALE'), 409, A.PREFIX + 'STALE'],
    [A.failure('BLOCKED'), 409, A.PREFIX + 'BLOCKED'],
    [A.failure('FINAL_VERIFICATION_FAILED'), 500, A.PREFIX + 'FINAL_VERIFICATION_FAILED'],
    [A.failure('AUDIT_UNAVAILABLE', 503), 503, A.PREFIX + 'FAILED'],
    [Object.assign(new Error('SECRET'), { code: 'EMPLOYEE_HISTORY_SUPERVISOR_SCOPE_FORBIDDEN', statusCode: 403 }), 403, A.PREFIX + 'FORBIDDEN'],
    [new Error('SECRET_PII'), 500, A.PREFIX + 'FAILED']
]) test(`${code}: safe HTTP ${status} without internal exception disclosure`, async () => {
    const { req, res, controller } = setup(error); await controller(req, res);
    assert.equal(res.code, status); assert.equal(res.body.code, code);
    assert.doesNotMatch(res.body.message, /SECRET|stack|ObjectId|rowDiff/);
    assert.match(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
});
for (const [name, user, privileges, expected] of [
    ['active update actor', { situation: 'A', team: 'TEST' }, { update: true }, 200],
    ['active form Admin', { situation: 'A', team: 'THA' }, { admin: true }, 200],
    ['read only actor', { situation: 'A', team: 'TEST' }, { read: true }, 403],
    ['inactive actor', { situation: 'I', team: 'TEST' }, { update: true }, 403]
]) test(`existing form permission: ${name}`, async () => {
    const { req, res, controller, calls } = setup();
    const userMock = mock.method(User, 'findById', () => query(user));
    const privilegesMock = mock.method(Privileges, 'findOne', () => query({ privileges }));
    try { await requireUserPrivilegeAction('Ergazomenoi', 'update')(req, res, () => controller(req, res));
        assert.equal(res.code, expected); assert.equal(calls.length, expected === 200 ? 1 : 0);
    } finally { userMock.mock.restore(); privilegesMock.mock.restore(); }
});
test('new endpoint retains authentication, form update permission and global CSRF; ordinary Save remains independent', () => {
    const routes = readFileSync(__dirname + '/../../routes/usersRoute.js', 'utf8');
    assert.match(routes, /router\.post\(\s*'\/api\/ergazomenoi\/:id\/history-reconstruction-apply',\s*checkAuth,\s*requireUserPrivilegeAction\('Ergazomenoi', 'update'\),\s*employeeHistoryReconstructionApply/);
    const app = readFileSync(__dirname + '/../../../app.js', 'utf8');
    const skip = app.slice(app.indexOf("const skipPaths = [\n        '/health'"), app.indexOf("if (!validateSimpleCsrfToken(req))"));
    assert.doesNotMatch(skip, /history-reconstruction/);
    const ordinaryController = readFileSync(__dirname + '/ergazomenoiController.js', 'utf8');
    assert.doesNotMatch(ordinaryController, /applyEmployeeHistoryAutomaticReconstruction|history-reconstruction-apply/);
});

test('uncertain commit acknowledgement never claims rollback or automatic retry', async () => {
    const { req, res, controller, calls } = setup(A.failure('COMMIT_UNCERTAIN', 503));
    await controller(req, res); assert.equal(res.code, 503); assert.equal(calls.length, 1);
    assert.equal(res.body.code, A.PREFIX + 'COMMIT_UNCERTAIN');
    assert.match(res.body.message, /δεν μπόρεσε να επιβεβαιώσει αν αποθηκεύτηκε.*1\..*2\./s);
    assert.doesNotMatch(res.body.message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
});
