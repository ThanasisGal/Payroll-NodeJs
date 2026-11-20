'use strict';
// Synthetic transaction store and provider doubles only. Application bootstrap,
// MongoDB, HTTP, S3 and browser/server startup are deliberately absent.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mongoose = require('mongoose');
const W = require('./employeeEmploymentProfileWriter');
const D = require('./employeeHistoryDeferralService');
const E = require('./employeeDeferredExternalActionService');
const R = require('./employeeExternalRecoveryService');
const Evidence = require('./employeeExternalRecoveryEvidence');
const S = require('../../utils/ergazomenoi/employeeSaveState');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { fixture, store, scope } = require('../../../test/fixtures/employeeProfileTransactionStore');
const actorUserId = '700000000000000000000001';
const query = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } });
const catalogs = { KPK_EFKA: [{ code: '0101' }], CONTRACT_TYPE: [{ code: '01' }],
    CONTRACT_CATEGORY: [{ code: '01', afora_thn_symbash: '01' }],
    CONTRACT_SPECIALTY: [{ code: '01', afora_thn_symbash_kathgoria: '0101' }] };
const providerReceipt = { protocol: 'SYNTHETIC-123', id: 'SYNTHETIC-DOC-123', submitDate: '20/11/2026 12:30:00' };

async function harness({ method = 'rest', mutationDate = '2026-03-01' } = {}) {
    const f = fixture(); f.employee._id = '507f1f77bcf86cd799439199';
    Object.assign(f.employee, { afm: '123456789', ypokatasthma: '0001', oristikh_enhmerosh: true });
    delete f.employee.krathsh_01; delete f.history.at(-1).krathsh_01;
    const db = store([f], { cloneFn: A.clone }), logs = [], logReads = [], access = { active: true, update: true, team: scope.team };
    const dependencies = { ...db.deps, actorUserId,
        userModel: { findById: () => query({ team: access.team, situation: access.active ? 'A' : 'I' }) },
        privilegeModel: { findOne: () => query({ privileges: { update: access.update } }) } };
    const input = { scope, employeeId: String(f.employee._id), confirmationSession: 'synthetic-recovery-session',
        expectedEmployeeStateToken: S.employeeStateToken(f.employee),
        maintenance: { employeeChanges: { pragmatikosMisthos: 1500 }, historyChanges: { pragmatikosMisthos: 1500 },
            submittedHistoryChanges: { pragmatikosMisthos: 1500 }, submittedEmployeeFields: ['pragmatikosMisthos'],
            submittedFormValues: { pragmatikosMisthos: 1500, hmeromhnia_metabolhs: mutationDate } },
        externalIntent: { e3_metaboles_ergasiakhs_sxeshs: true, erganiUploadMethod: method, isPermanent: true } };
    const before = db.state();
    const preview = await W.writeEmployeeMaintenance({ ...dependencies, ...input, historyPreflight: true,
        correctionCatalogLoader: async () => catalogs });
    assert.equal(preview.status, 'MISSING_REQUIRED_HISTORY_FIELDS');
    const committed = await W.writeEmployeeMaintenance({ ...dependencies, ...input, historyDecision: 'DEFER_HISTORY',
        historyConfirmation: preview.historyConfirmation, correctionCatalogLoader: async () => catalogs });
    assert.equal(committed.employeeUpdated, true); assert.equal(committed.externalActionsAllowed, true);
    assert.deepEqual(db.state().history, before.history);
    const employeeModel = { ...db.deps.employeeModel, findOne(filter) {
        const q = db.deps.employeeModel.findOne(filter), lean = q.lean;
        q.lean = function() {
            return this.s ? lean.call(this) : Promise.resolve(db.state().employees.find(employee =>
                Object.entries(filter).every(([key, value]) => String(employee[key]) === String(value))) || null);
        };
        return q;
    } };
    const submissionModel = { find(filter) {
        logReads.push(filter);
        return { session(session) { assert.ok(session, 'provider evidence must share the transaction'); return this; },
            lean: async () => structuredClone(logs.filter(log => Object.entries(filter).every(([key, value]) =>
                String(log[key]) === String(value)))) };
    } };
    const deps = { ...dependencies, employeeModel, submissionModel };
    const options = { ...deps, scope, employeeId: input.employeeId, key: committed.idempotencyKey, type: 'MA' };
    const req = { path: method === 'xml' ? '/ergazomenoi/ergazomenoi/upload-ma-to-erganh' :
        '/ergazomenoi/ergazomenoi/submit-ma-to-erganh',
        headers: { 'x-employee-history-action': options.key },
        session: { userTeam: scope.team, companyInUse: scope.company_kod, userId: actorUserId },
        body: { ergazomenosId: input.employeeId, erganiUploadMethod: method, hmeromhnia_metabolhs: mutationDate } };
    const payload = { AnaggeliesMA: { AnaggeliaMA: [{ f_afm: f.employee.afm, f_aa_pararthmatos: '1',
        f_date_metabolhs: '01/03/2026' }] } };
    let dispatches = 0;
    const guard = E.guardDeferredExternalAction('MA', deps);
    const action = () => db.state().employees[0][D.ACTIONS][0].actions[0];
    async function claim() {
        const res = response();
        await guard(req, res, () => { assert.ok(db.events.some(e => e.type === 'commit')); });
        assert.equal(res.body, undefined, JSON.stringify(res.body));
        return req.employeeExternalAction;
    }
    async function bind() {
        await req.employeeExternalAction.bindRequest({ submissionCode: 'WebMA', payload,
            environment: String(process.env.ERGANI_ENV || 'trial').trim().toLowerCase() });
    }
    function dispatch() {
        assert.ok(action().attempt.request, 'dispatch precedes durable payload binding');
        assert.equal(db.state().employees[0].pragmatikosMisthos, 1500);
        dispatches++;
    }
    function receiptLog() {
        const attempt = action().attempt, i = attempt.identity;
        const log = { _id: '507f1f77bcf86cd799439288', team: scope.team, companykod_object: scope.company_kod,
            ergazomenos_object: input.employeeId, ergazomenos_kodikos: scope.kodikos, ergazomenos_afm: f.employee.afm,
            ypokatasthma_kodikos: '0001', created_by_user: actorUserId, environment: i.environment,
            upload_method: 'REST', submission_code: 'WebMA', process_code: i.environment === 'production' ? 'ma_230' : 'ma_127',
            submission_status: 'SUCCESS', is_temporary: false, is_final: true, document_status: 'ACTIVE',
            request_payload: structuredClone(payload), ...Evidence.providerLogFields(req, payload),
            erganh_raw_response: structuredClone(providerReceipt), protocol: providerReceipt.protocol,
            submit_date_text: providerReceipt.submitDate, erganh_submission_id: providerReceipt.id };
        logs.push(log); return log;
    }
    const inspect = () => R.run(options);
    async function recover(service = R) {
        const inspected = await service.run(options);
        return service.run({ ...options, recover: true, expectedStateToken: inspected.expectedStateToken });
    }
    function unchanged() {
        assert.deepEqual(db.state().history, before.history);
        assert.equal(db.events.some(e => e.type === 'write' && e.kind === 'history'), false);
        assert.deepEqual(db.state().audits, before.audits);
        assert.equal(db.state().employees[0].pragmatikosMisthos, 1500);
    }
    return { db, deps, options, req, payload, logs, logReads, access, guard, claim, bind, dispatch, receiptLog,
        action, inspect, recover, unchanged, dispatches: () => dispatches };
}

test('crash after Employee commit before dispatch stays RUNNING; no receipt is never proof of non-dispatch', async () => {
    const h = await harness(); await h.claim();
    const result = await h.recover();
    assert.equal(result.externalStatus, 'BLOCKED'); assert.equal(result.reason, 'REQUEST_CORRELATION_UNAVAILABLE');
    assert.equal(result.retryAllowed, false); assert.equal(h.action().status, 'RUNNING');
    assert.equal(h.action().recoveryAudit[0].outcome, 'BLOCKED');
    const res = response(); await h.guard(h.req, res, h.dispatch);
    assert.equal(res.statusCode, 409); assert.equal(h.dispatches(), 0); h.unchanged();
});
test('crash after dispatch before provider reply remains BLOCKED even after a fresh inspection', async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch();
    const result = await h.recover();
    assert.equal(result.externalStatus, 'BLOCKED'); assert.equal(result.reason, 'PROVIDER_OUTCOME_UNAVAILABLE');
    await assert.rejects(E.updateAction(h.options), { code: 'EMPLOYEE_HISTORY_DEFER_ACTION_RECONCILIATION_REQUIRED' });
    assert.equal(h.dispatches(), 1); h.unchanged();
});
for (const status of ['RUNNING', 'UNKNOWN']) test(`${status}: exact provider receipt recovers success with an immutable audit and no resubmission`, async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch(); const log = h.receiptLog();
    if (status === 'UNKNOWN') await E.updateAction({ ...h.options, outcome: { success: false, httpStatus: 504 } });
    const result = await h.recover();
    assert.equal(result.externalStatus, 'RECOVERED'); assert.equal(result.status, 'SUCCEEDED');
    assert.equal(result.retryAllowed, false); assert.equal(h.action().result.protocol, providerReceipt.protocol);
    assert.equal(h.action().result.evidence.logId, log._id);
    assert.equal(h.action().recoveryAudit[0].beforeStatus, status);
    assert.equal(h.action().recoveryAudit[0].actorUserId, actorUserId);
    assert.deepEqual(h.logReads[0], { team: scope.team, companykod_object: scope.company_kod,
        ergazomenos_object: h.options.employeeId, request_id: h.action().attempt.id });
    await assert.rejects(E.updateAction(h.options));
    assert.equal(h.dispatches(), 1); h.unchanged();
});
test('provider rejection before document dispatch is BLOCKED without a certified negative lookup contract', async () => {
    const h = await harness(); await h.claim();
    await E.updateAction({ ...h.options, outcome: { success: false, httpStatus: 401 } });
    h.logs.push({ request_id: h.action().attempt.id, team: scope.team, companykod_object: scope.company_kod,
        ergazomenos_object: h.options.employeeId, submission_status: 'FAILED', erganh_raw_response: { error: 'synthetic authentication rejection' } });
    const result = await h.recover();
    assert.equal(result.externalStatus, 'BLOCKED'); assert.equal(h.action().status, 'UNKNOWN');
    await assert.rejects(E.updateAction(h.options)); assert.equal(h.dispatches(), 0); h.unchanged();
});
test('a negative flag cannot reopen a bound document request, including HTTP rejection after dispatch', async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch();
    await E.updateAction({ ...h.options, outcome: { success: false, submissionAttempted: false, httpStatus: 400 } });
    assert.equal(h.action().status, 'UNKNOWN');
    assert.equal((await h.recover()).externalStatus, 'BLOCKED');
    await assert.rejects(E.updateAction(h.options)); assert.equal(h.dispatches(), 1); h.unchanged();
});
test('ambiguous provider records cannot be treated as success', async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch(); const log = h.receiptLog();
    h.logs.push({ ...structuredClone(log), _id: '507f1f77bcf86cd799439289' });
    const result = await h.recover(); assert.equal(result.reason, 'AMBIGUOUS_PROVIDER_EVIDENCE');
    assert.equal(h.action().status, 'RUNNING'); assert.equal(h.dispatches(), 1); h.unchanged();
});
test('XML temporary confirmation without protocol has no certified recovery contract', async () => {
    const h = await harness({ method: 'xml' }); await h.claim();
    const result = await h.recover(); assert.equal(result.reason, 'XML_VERIFICATION_UNAVAILABLE');
    assert.equal(result.externalStatus, 'BLOCKED'); assert.equal(h.dispatches(), 0); h.unchanged();
});
test('legacy RUNNING without attempt correlation cannot borrow a same-day success log', async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch(); h.receiptLog();
    const current = h.db.state().employees[0], ledger = current[D.ACTIONS]; delete ledger[0].actions[0].attempt;
    h.db.changeCommittedEmployee(h.options.employeeId, { [D.ACTIONS]: ledger });
    assert.equal((await h.recover()).reason, 'IDENTITY_UNVERIFIABLE');
    assert.equal(h.dispatches(), 1); h.unchanged();
});
test('unknown original MA date versus distinct newer MA reports reconciliation-needed, never SAME or a free dispatch', async () => {
    const h = await harness({ mutationDate: null }); await h.claim();
    const employee = h.db.state().employees[0], record = employee[D.ACTIONS][0];
    assert.equal(E.sameExternalEvent(record, employee, 'MA', { hmeromhnia_metabolhs: '2026-04-01' }), null);
    h.db.changeCommittedEmployee(h.options.employeeId, { [D.FIELD]: undefined });
    const req = { ...h.req, body: { ...h.req.body }, headers: {} }; delete req.employeeExternalAction;
    req.body.hmeromhnia_metabolhs = '2026-04-01';
    const res = response(); await h.guard(req, res, h.dispatch);
    assert.equal(res.statusCode, 409); assert.equal(res.body.externalStatus, 'BLOCKED');
    assert.equal(res.body.reason, 'EMPLOYEE_HISTORY_DEFER_ACTION_IDENTITY_UNCERTAIN');
    assert.equal((await h.recover()).reason, 'IDENTITY_UNVERIFIABLE'); assert.equal(h.dispatches(), 0); h.unchanged();
});
test('a genuinely different known MA date proceeds; a new key for the old date cannot submit twice', async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch(); h.receiptLog(); await h.recover();
    const current = h.db.state().employees[0], ledger = current[D.ACTIONS];
    h.db.changeCommittedEmployee(h.options.employeeId, { [D.FIELD]: undefined });
    const req = { ...h.req, headers: {}, body: { ...h.req.body, hmeromhnia_metabolhs: '2026-04-01' } };
    let laterEvents = 0; await h.guard(req, response(), () => { laterEvents++; });
    assert.equal(laterEvents, 1);
    ledger.push({ ...structuredClone(ledger[0]), key: 'new-forged-selection', actions: [{ type: 'MA', status: 'SELECTED' }] });
    h.db.changeCommittedEmployee(h.options.employeeId, { [D.ACTIONS]: ledger });
    await assert.rejects(E.updateAction({ ...h.options, key: 'new-forged-selection' }),
        { code: 'EMPLOYEE_HISTORY_DEFER_ACTION_RECONCILIATION_REQUIRED' });
    assert.equal(h.dispatches(), 1); h.unchanged();
});
test('a stale recovery cannot overwrite newer Employee state or an independently updated action', async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch(); h.receiptLog();
    const inspected = await h.inspect();
    h.db.changeCommittedEmployee(h.options.employeeId, { email: 'new-synthetic@example.invalid' });
    const before = h.db.state();
    await assert.rejects(R.run({ ...h.options, recover: true, expectedStateToken: inspected.expectedStateToken }),
        { code: 'EMPLOYEE_EXTERNAL_RECOVERY_STALE' });
    assert.deepEqual(h.db.state(), before); assert.equal(h.dispatches(), 1); h.unchanged();
});
for (const kind of ['key', 'actor', 'privilege', 'inactive', 'team', 'company', 'employee', 'type']) {
    test(`recovery rechecks ${kind} and denies all writes or dispatches`, async () => {
        const h = await harness(); await h.claim(); await h.bind(); h.dispatch(); h.receiptLog();
        const inspected = await h.inspect(), before = h.db.state(), options = { ...h.options,
            recover: true, expectedStateToken: inspected.expectedStateToken };
        if (kind === 'key') options.key = 'forged';
        if (kind === 'actor') options.actorUserId = '700000000000000000000002';
        if (kind === 'privilege') h.access.update = false;
        if (kind === 'inactive') h.access.active = false;
        if (kind === 'team') h.access.team = 'WRONG';
        if (kind === 'company') options.scope = { ...scope, company_kod: 'wrong-company' };
        if (kind === 'employee') options.employeeId = '507f1f77bcf86cd799439298';
        if (kind === 'type') options.type = 'E7N';
        await assert.rejects(R.run(options), error => error.statusCode === 403);
        assert.deepEqual(h.db.state(), before); assert.equal(h.dispatches(), 1); h.unchanged();
    });
}
test('the recovery HTTP handler rejects client success, protocol, non-dispatch and retry overrides', async () => {
    const h = await harness(); await h.claim();
    for (const body of [{ success: true }, { protocol: 'forged' }, { submissionAttempted: false },
        { retryAllowed: true }, { actionKey: 'forged' }]) {
        const res = response(), before = h.db.state();
        await R.handler(true, h.deps)({ ...h.req, body,
            params: { employeeId: h.options.employeeId, key: h.options.key, type: 'MA' } }, res);
        assert.equal(res.statusCode, 400); assert.equal(res.body.retryAllowed, false);
        assert.deepEqual(h.db.state(), before);
    }
    assert.equal(h.dispatches(), 0); h.unchanged();
});
test('recovery HTTP endpoints expose a fresh state, report missing negative verification as BLOCKED and recover only stored evidence', async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch();
    const params = { employeeId: h.options.employeeId, key: h.options.key, type: 'MA' };
    const get = response(); await R.handler(false, h.deps)({ ...h.req, body: {}, params }, get);
    assert.equal(get.statusCode, 200); assert.equal(get.body.capabilities.nonDispatchVerification, 'BLOCKED');
    const blocked = response();
    await R.handler(true, h.deps)({ ...h.req, params, body: { expectedStateToken: get.body.expectedStateToken } }, blocked);
    assert.equal(blocked.statusCode, 409); assert.equal(blocked.body.externalStatus, 'BLOCKED');
    assert.match(blocked.body.message, /1\.[\s\S]*2\.[\s\S]*Κωδικός αναφοράς:/);
    assert.match(blocked.body.message, /Αποθηκεύτηκε μόνο η καταγραφή/);
    const priorAudit = structuredClone(h.action().recoveryAudit);
    h.receiptLog();
    const recovered = response();
    await R.handler(true, h.deps)({ ...h.req, params, body: { expectedStateToken: blocked.body.expectedStateToken } }, recovered);
    assert.equal(recovered.statusCode, 200); assert.equal(recovered.body.status, 'SUCCEEDED');
    assert.deepEqual(h.action().recoveryAudit.slice(0, 1), priorAudit);
    const latest = await h.inspect(); assert.equal(latest.expectedStateToken, recovered.body.expectedStateToken);
    assert.equal(h.dispatches(), 1); h.unchanged();
});
test('lost recovery commit acknowledgement never grants a retry; a fresh read recognizes the committed success', async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch(); h.receiptLog();
    const inspected = await h.inspect();
    const connection = { async startSession() {
        const session = await h.deps.connection.startSession(), original = session.withTransaction;
        session.withTransaction = async work => {
            await original.call(session, work);
            throw Object.assign(Error('synthetic lost commit acknowledgement'), { errorLabels: ['UnknownTransactionCommitResult'] });
        };
        return session;
    } };
    const res = response();
    await R.handler(true, { ...h.deps, connection })({ ...h.req,
        params: { employeeId: h.options.employeeId, key: h.options.key, type: 'MA' },
        body: { expectedStateToken: inspected.expectedStateToken } }, res);
    assert.equal(res.statusCode, 503); assert.equal(res.body.retryAllowed, false);
    assert.match(res.body.message, /μπορεί να έχει αποθηκευτεί/);
    assert.equal((await h.inspect()).status, 'SUCCEEDED');
    await assert.rejects(E.updateAction(h.options)); assert.equal(h.action().recoveryAudit.length, 1);
    assert.equal(h.dispatches(), 1); h.unchanged();
});
test('a fresh Node process restores serialized durable evidence, recovers once and retains duplicate protection', async t => {
    const childEnvironment = { ...process.env };
    delete childEnvironment.NODE_TEST_CONTEXT;
    // Probe an empty child first: an execution restriction is not a recovery
    // failure and must be reported as SKIP, never as a successful restart.
    try { execFileSync(process.execPath, ['-e', 'process.exit(0)'], { env: childEnvironment, timeout: 1000 }); }
    catch (error) {
        if (!['EPERM', 'EACCES', 'ETIMEDOUT'].includes(error.code)) throw error;
        t.skip(`Isolated child-process execution unavailable: ${error.code}; real process restart remains unverified`);
        return;
    }
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch(); h.receiptLog();
    const program = `
        const assert = require('node:assert/strict');
        const data = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
        const { store } = require('./test/fixtures/employeeProfileTransactionStore');
        const R = require('./server/services/ergazomenoi/employeeExternalRecoveryService');
        const E = require('./server/services/ergazomenoi/employeeDeferredExternalActionService');
        const db = store([{ employee: data.state.employees[0], history: data.state.history }]);
        const q = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
        const options = { ...db.deps, scope: data.scope, employeeId: data.state.employees[0]._id,
            key: data.key, type: 'MA', actorUserId: data.actor,
            userModel: { findById: () => q({ team: data.scope.team, situation: 'A' }) },
            privilegeModel: { findOne: () => q({ privileges: { update: true } }) },
            submissionModel: { find: () => q(data.logs) } };
        (async () => {
            const inspected = await R.run(options);
            const result = await R.run({ ...options, recover: true, expectedStateToken: inspected.expectedStateToken });
            assert.equal(result.status, 'SUCCEEDED');
            await assert.rejects(E.updateAction(options));
            assert.deepEqual(db.state().history, data.state.history);
            assert.equal(db.events.some(e => e.type === 'write' && e.kind === 'history'), false);
            process.stdout.write(JSON.stringify({ status: result.status, retryAllowed: result.retryAllowed }), () => process.exit(0));
        })().catch(error => { process.stderr.write(error.stack, () => process.exit(1)); });
    `;
    const output = execFileSync(process.execPath, ['--require', './test/fixtures/correction3OfflineGuard.cjs', '-e', program],
        { cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8', timeout: 10000, env: childEnvironment,
            input: JSON.stringify({ state: h.db.state(), logs: h.logs, scope, key: h.options.key, actor: actorUserId }) });
    assert.deepEqual(JSON.parse(output), { status: 'SUCCEEDED', retryAllowed: false });
    assert.equal(h.dispatches(), 1); h.unchanged();
});
test('module restart with a reconstructed serialized store keeps the original attempt and duplicate fence', async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch(); h.receiptLog();
    const data = JSON.parse(JSON.stringify(h.db.state()));
    const fresh = store([{ employee: data.employees[0], history: data.history }]);
    delete require.cache[require.resolve('./employeeExternalRecoveryService')];
    const restarted = require('./employeeExternalRecoveryService');
    const options = { ...h.options, ...fresh.deps };
    const inspected = await restarted.run(options);
    const result = await restarted.run({ ...options, recover: true, expectedStateToken: inspected.expectedStateToken });
    assert.equal(result.status, 'SUCCEEDED'); await assert.rejects(E.updateAction(options));
    assert.deepEqual(fresh.state().history, data.history); assert.equal(h.dispatches(), 1); h.unchanged();
});
test('concurrent recovery and retry use the durable Employee fence; one recovery, no second dispatch', async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch(); h.receiptLog();
    const state = await h.inspect(), options = { ...h.options, recover: true, expectedStateToken: state.expectedStateToken };
    const results = await Promise.allSettled([R.run(options), R.run(options), E.updateAction(h.options)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'fulfilled').value.status, 'SUCCEEDED');
    assert.equal(h.action().recoveryAudit.length, 1);
    assert.ok(h.db.events.some(event => event.type === 'retry'));
    assert.equal(h.dispatches(), 1); h.unchanged();
});
test('two simultaneous original guarded requests dispatch exactly once after the confirmed Employee commit', async () => {
    const h = await harness();
    async function request() {
        const res = response(), req = { ...h.req, body: { ...h.req.body } };
        await h.guard(req, res, async () => {
            await req.employeeExternalAction.bindRequest({ submissionCode: 'WebMA', payload: h.payload,
                environment: String(process.env.ERGANI_ENV || 'trial').trim().toLowerCase() });
            h.dispatch(); await res.json({ success: true, ...providerReceipt });
        });
        return res;
    }
    const results = await Promise.all([request(), request()]);
    assert.equal(results.filter(res => res.statusCode === 200).length, 1);
    assert.equal(results.filter(res => res.statusCode === 409).length, 1);
    assert.equal(h.dispatches(), 1); h.unchanged();
});

test('provider receipt verification rejects altered scope, event, method, request, receipt and provider environment', async () => {
    const h = await harness(); await h.claim(); await h.bind(); h.dispatch(); const original = h.receiptLog(), attempt = h.action().attempt;
    assert.equal(Evidence.verify(attempt, [original]).verified, true);
    for (const patch of [{ team: 'WRONG' }, { companykod_object: 'wrong-company' },
        { ergazomenos_object: 'wrong-employee' }, { ergazomenos_afm: '999999999' },
        { created_by_user: 'wrong-actor' }, { request_id: 'wrong-attempt' },
        { process_code: 'ma_231' }, { submission_code: 'WebE3N' }, { upload_method: 'XML' },
        { environment: attempt.identity.environment === 'trial' ? 'production' : 'trial' },
        { ypokatasthma_kodikos: '999' }, { payload_fingerprint: '0'.repeat(64) },
        { request_payload: { wrong: true } }, { protocol: 'FORGED' }, { erganh_submission_id: 'FORGED' },
        { submit_date_text: '21/11/2026' }, { erganh_raw_response: null },
        { erganh_raw_response: { ...providerReceipt, success: false } },
        { erganh_raw_response: [providerReceipt, providerReceipt] },
        { erganh_raw_response: { ...providerReceipt, Protocol: 'conflicting-protocol' } },
        { submission_status: 'FAILED' }, { is_temporary: true }, { document_status: 'CANCELLED' }]) {
        assert.equal(Evidence.verify(attempt, [{ ...structuredClone(original), ...patch }]).verified, false, JSON.stringify(patch));
    }
    // Even a self-consistent payload hash cannot borrow the identity of another MA date.
    const log = structuredClone(original), different = structuredClone(attempt);
    log.request_payload.AnaggeliesMA.AnaggeliaMA[0].f_date_metabolhs = '01/04/2026';
    log.payload_fingerprint = different.request.payloadFingerprint = D.digest(log.request_payload);
    assert.equal(Evidence.verify(different, [log]).verified, false);
    assert.equal(h.dispatches(), 1); h.unchanged();
});
test('receipt verification binds the real E3N/E5N/E6N/E7N shapes; incomplete WTO interval and unsupported MA 231 stay BLOCKED', async () => {
    const h = await harness(); await h.claim(); await h.bind(); const base = h.receiptLog();
    const current = h.db.state().employees[0], selected = current[D.ACTIONS][0];
    for (const [type, processCode, providerCode, suffix, dateField] of [
        ['E3N', '213', 'ma_93', 'E3N', 'f_proslipsidate'],
        ['E5N', '217', 'ma_101', 'E5N', 'f_apoxwrisidate'],
        ['E6N', '220', 'ma_220', 'E6NXP', 'f_apolysisdate'],
        ['E6N', '221', 'ma_221', 'E6NMP', 'f_apolysisdate'],
        ['E7N', '222', 'ma_222', 'E7N', 'f_apolysisdate']]) {
        const record = { ...selected, parameters: { ...selected.parameters, processCode, departure: '2026-09-30' } };
        const identity = Evidence.identity(record, current, type); identity.environment = 'trial';
        const payload = { [`Anaggelies${suffix}`]: { [`Anaggelia${suffix}`]: [{ f_afm: current.afm,
            f_aa_pararthmatos: '1', f_proslipsidate: '01/01/2026',
            [dateField]: type === 'E3N' ? '01/01/2026' : '30/09/2026' }] } };
        const attempt = { ...h.action().attempt, identity, identityDigest: D.digest(identity),
            request: { submissionCode: identity.submissionCode, environment: 'trial', payloadFingerprint: D.digest(payload) } };
        const log = { ...base, process_code: providerCode, environment: 'trial', submission_code: identity.submissionCode,
            request_payload: payload, payload_fingerprint: D.digest(payload) };
        assert.equal(Evidence.verify(attempt, [log]).verified, true, suffix);
    }
    const record = { ...selected, parameters: { ...selected.parameters, scheduleFrom: '2026-03-01', scheduleUntil: '2026-03-31' } };
    const identity = Evidence.identity(record, current, 'WTO'); identity.environment = 'trial';
    const payload = { WTOS: { WTO: [{ f_aa_pararthmatos: '1', f_from_date: '01/03/2026', f_to_date: '',
        Ergazomenoi: { ErgazomenoiWTO: [{ f_afm: current.afm }] } }] } };
    const attempt = { ...h.action().attempt, identity, identityDigest: D.digest(identity),
        request: { submissionCode: 'WTOWeek', environment: 'trial', payloadFingerprint: D.digest(payload) } };
    assert.equal(Evidence.verify(attempt, [{ ...base, submission_code: 'WTOWeek', process_code: 'ma_80',
        environment: 'trial', request_payload: payload, payload_fingerprint: D.digest(payload) }]).verified, false);
    const ma231 = structuredClone(h.action().attempt); ma231.identity.processCode = '231'; ma231.identityDigest = D.digest(ma231.identity);
    assert.equal(Evidence.verify(ma231, [base]).verified, false);
    assert.equal(h.dispatches(), 0); h.unchanged();
});

// Evaluate the actual uploader with isolated transport functions. No live call,
// safety environment mutation, controller/bootstrap require or credential read.
function syntheticUploader({ authenticate, submit } = {}) {
    const source = fs.readFileSync(require.resolve('../../utils/erganh/jsonDocumentUploader'), 'utf8');
    const calls = [];
    const context = { module: { exports: {} }, Buffer, Date,
        process: { env: { ERGANI_ENV: String(process.env.ERGANI_ENV || 'trial'),
            ALLOW_ERGANI_SUBMIT: 'true', ALLOW_ERGANI_PRODUCTION_SUBMIT: 'true' } },
        console: { log() {}, warn() {} },
        require(name) {
            if (name.endsWith('accountingIntervalValidationService')) return { assertWtoDailyPayloadIntervals() { throw Error('unselected'); } };
            if (name === './erganiSubmittedPdfDownloader') return { isPdfBuffer: () => false };
            if (name === './erganiRestClient') return {
                authenticateErgani: authenticate || (async () => ({ accessToken: 'synthetic-token' })),
                logoutErgani: async () => {}, getSubmissions: async () => [{ id: 127, code: 'WebMA' }],
                submitDocument: async (...args) => { calls.push(args); return submit ? submit() : providerReceipt; }
            };
            throw Error('Unexpected dependency');
        }
    };
    vm.runInNewContext(source, context);
    return { calls, upload: context.module.exports.uploadJsonDocumentToErgani };
}
test('stale terms, changed employee identity or revoked privilege before payload binding stop the actual uploader before POST', async () => {
    for (const kind of ['terms', 'identity', 'privilege']) {
        const h = await harness(), ctx = await h.claim(), uploader = syntheticUploader();
        if (kind === 'terms') h.db.changeCommittedEmployee(h.options.employeeId, { krathsh_01: '0101' });
        if (kind === 'identity') h.db.changeCommittedEmployee(h.options.employeeId, { afm: '999999999' });
        if (kind === 'privilege') h.access.update = false;
        const result = await uploader.upload({ submissionCode: 'WebMA', payload: h.payload,
            creds: { username: 'synthetic', password: 'synthetic' }, externalAction: ctx });
        assert.equal(result.success, false); assert.equal(uploader.calls.length, 0);
        assert.equal(h.action().attempt.request, undefined); assert.equal(h.dispatches(), 0); h.unchanged();
    }
});
test('actual uploader persists exact request before POST; pre-dispatch rejection, failed binding and lost reply never redispatch', async () => {
    for (const kind of ['success', 'authentication-rejection', 'binding-failure', 'lost-reply']) {
        const h = await harness(); const ctx = await h.claim();
        const uploader = syntheticUploader({
            authenticate: kind === 'authentication-rejection' ? async () => { throw Object.assign(Error('synthetic rejection'), { status: 401 }); } : null,
            submit: () => { h.dispatch(); if (kind === 'lost-reply') throw Error('synthetic lost reply'); return providerReceipt; }
        });
        if (kind === 'binding-failure') h.db.hooks.beforeCommit = session => {
            const action = session.draft.employees[0][D.ACTIONS][0].actions[0];
            if (action.attempt.request) throw Error('synthetic binding failure');
        };
        const result = await uploader.upload({ submissionCode: 'WebMA', payload: h.payload,
            creds: { username: 'synthetic', password: 'synthetic' }, externalAction: ctx });
        delete h.db.hooks.beforeCommit;
        assert.equal(uploader.calls.length, ['success', 'lost-reply'].includes(kind) ? 1 : 0);
        if (kind === 'success') { h.receiptLog(); assert.equal((await h.recover()).status, 'SUCCEEDED'); }
        else {
            assert.equal(result.success, false);
            await E.updateAction({ ...h.options, outcome: { success: false } });
            assert.equal((await h.recover()).externalStatus, 'BLOCKED');
        }
        await assert.rejects(E.updateAction(h.options));
        assert.equal(h.dispatches(), ['success', 'lost-reply'].includes(kind) ? 1 : 0); h.unchanged();
    }
});
test('actual MA controller saves the correlated provider log; lost ledger acknowledgement is recoverable without S3 or redispatch', async () => {
    const h = await harness();
    const source = fs.readFileSync(__dirname + '/../../controllers/ergazomenoi/erganhController.js', 'utf8');
    const begin = source.indexOf('    static submitMAToErganh = '), end = source.indexOf('    static cancelE7NSubmission', begin);
    const method = source.slice(begin, end).trim().replace('static submitMAToErganh = ', '').replace(/;$/, '');
    const uploader = syntheticUploader({ submit: () => { h.dispatch(); return providerReceipt; } });
    const controller = vm.runInNewContext(`(${method})`, { mongoose, Buffer, Date,
        process: { env: { ERGANI_ENV: String(process.env.ERGANI_ENV || 'trial') } },
        console: { error() {} }, ...require('../../utils/erganh/validateMaMutationDate'),
        ErgazomenoiModel: h.deps.employeeModel, finalizedEmployeeFilter: filter => filter,
        CompaniesModel: { findOne: () => query({ _id: scope.company_kod }) },
        YpokatasthmataModel: { findOne: () => query({ kodikos: '0001' }) },
        PasswordsModel: { findOne: () => query({ username: 'synthetic', password: 'synthetic' }) },
        generateMAJSON: async () => ({ payload: h.payload }), uploadJsonDocumentToErgani: uploader.upload,
        parseErganiSubmitDate: () => new Date('2026-11-20T12:30:00Z'),
        providerLogFields: Evidence.providerLogFields,
        ErgazomenoiErganhModel: { async create(log) {
            const row = { ...log, _id: '507f1f77bcf86cd799439288', document_status: 'ACTIVE' };
            h.logs.push(row); return row;
        } }, sanitizeErganiResultForResponse: value => value,
        getErganiPdfDeferredWarning: () => '',
        saveSubmittedErganiPdfToS3: () => { throw Error('S3 forbidden'); }
    });
    h.db.hooks.beforeCommit = session => {
        const action = session.draft.employees[0][D.ACTIONS][0].actions[0];
        if (action.status === 'SUCCEEDED') throw Error('synthetic lost ledger acknowledgement');
    };
    const res = response(); await h.guard(h.req, res, () => controller(h.req, res));
    delete h.db.hooks.beforeCommit;
    assert.equal(res.statusCode, 503); assert.equal(h.action().status, 'RUNNING');
    assert.equal(h.logs.length, 1); assert.equal(h.logs[0].request_id, h.action().attempt.id);
    assert.equal((await h.recover()).status, 'SUCCEEDED');
    assert.equal(uploader.calls.length, 1); assert.equal(h.dispatches(), 1); h.unchanged();
});
