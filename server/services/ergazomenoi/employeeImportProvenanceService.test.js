'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const Import = require('../../utils/ergazomenoi/employeeImportProvenance');
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const H = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { buildCompleteProfileSnapshot } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { getOrarioTermsForDate } = require('../../utils/ergazomenoi/getOrarioTermsForDate');
const W = require('./employeeEmploymentProfileWriter');
const { canonicalizeEmployeeHistory: canonical } = require('./employeeHistoryCanonicalizationService');
const { coordinateEmployeeHistorySettlement: coordinate } = require('./employeeHistorySettlementCoordinatorService');
const { buildUnifiedEmployeeHistorySettlementPreview: preview } = require('./employeeHistorySettlementPreviewService');
const { buildEmployeeHistoryEditorStateToken: stateToken } = require('./employeeHistoryEditorStateService');
const { fixture, store, scope, historyId, deferred } = require('../../../test/fixtures/employeeProfileTransactionStore');
const { userModel, token } = require('../../../test/fixtures/employeeHistorySupervisor');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
const admin = { privileges: 'A', team: 'THA', situation: 'A' };
const request = () => ({ intent: 'VERIFY_IMPORT', targetHistoryId: null, confirmation: null,
    facts: { trackingStartDate: '2026-04-01' } });
const provenance = () => ({ version: 1, source: Import.SOURCE, status: 'VERIFIED', hireDate: '2017-05-24',
    trackingStartDate: '2026-04-01', sourceApplication: 'Συνθετική εφαρμογή', evidenceReference: 'Συνθετικό τεκμήριο',
    verifiedBy: 'synthetic-admin', verifiedAt: new Date('2026-10-01'), auditId: historyId('employee', 8) });
function importedFixture(verified = true) {
    const history = ['2026-04-01', '2026-07-01'].map((from, index) => ({
        ...buildCompleteProfileSnapshot({ effectiveFrom: from }), ...scope,
        _id: historyId('employee', index), aa_eggrafhs: `000${index+1}`,
        hmeromhnia_proslhpshs: '2017-05-24', hmeromhnia_allaghs_symbashs: from,
        hmeromhnia_isxyos_oron_ergasias_eos: index ? '2026-10-04' : '2026-06-30',
        hmeromhnia_apoxorhshs: '2026-10-04', hmeromhnia_lhxhs_symbashs: '2026-12-31',
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
        symbatikes_ores_ergasias: 40, evelikth_proselefsh: 0, nomimoOromisthio: 7,
        pragmatikoOromisthio: 8, pragmatikosMisthos: 1200 + index * 100,
        createdAt: new Date(from), updatedAt: new Date(from)
    }));
    return { history, employee: { ...history[1], _id: 'employee', energos: false, oristikh_enhmerosh: true,
        ...(verified ? { [Import.FIELD]: provenance() } : {}) } };
}
const coverage = f => H.employeeHistoryCoverageGaps({ currentEmployee: f.employee, historyRows: f.history });
const input = f => ({ scope, currentEmployee: f.employee, completeHistoryRows: f.history,
    protectedReferenceSummary: Object.fromEntries(f.history.map(row => [row._id, []])) });
function save(db, correction, extra = {}) {
    return W.writeEmployeeEmploymentHistoryOperations({ ...db.deps, scope, employeeId: 'employee', operations: [],
        expectedStateToken: token(db), actorUserId: 'synthetic-admin', userModel: userModel(admin), correction, ...extra });
}
async function prepare(db, req = request()) {
    let error; try { await save(db, req); } catch (e) { error = e; }
    assert.equal(error?.resolution?.phase, 'PREVIEW', error?.stack);
    return { ...req, confirmation: { fingerprint: error.resolution.fingerprint, confirmed: true } };
}

test('verified import retains the 2017 hire and complete coverage begins on 01/04/2026', () => {
    const f = importedFixture(), before = structuredClone(f);
    assert.deepEqual(coverage(f), []);
    assert.equal(canonical({ scope, currentEmployee: f.employee, historyRows: f.history }).status, 'CLEAN');
    const plan = coordinate(input(f));
    assert.equal(plan.status, 'CLEAN', JSON.stringify(plan)); assert.equal(plan.noOp, true);
    assert.equal(plan.insertedRows.length, 0); assert.equal(preview(input(f)).state, 'clean');
    assert.deepEqual(f, before);
});

for (const value of [undefined, { trackingStartDate: '2026-04-01' }, { ...provenance(), status: 'PENDING' },
    { ...provenance(), auditId: null }, { ...provenance(), hireDate: '2020-01-01' }]) {
    test(`unverified or unrelated import never changes coverage: ${JSON.stringify(value)}`, () => {
        const f = importedFixture(false); f.employee[Import.FIELD] = value;
        assert.equal(coverage(f)[0].from, '2017-05-24'); assert.equal(coverage(f)[0].to, '2026-03-31');
    });
}

test('createdAt, earliest row and pre-V1 observation are not import evidence', () => {
    const f = importedFixture(false); f.employee.createdAt = new Date('2026-04-01');
    assert.equal(Import.verifiedImport(f.employee), null);
    assert.equal(coverage(f)[0].from, '2017-05-24');
    f.employee[T.ANCHOR] = { source: 'PRE_V1_CURRENT_OBSERVATION', before: '2026-07-01', facts: {} };
    assert.equal(Import.verifiedImport(f.employee), null);
    f.employee[Import.FIELD] = provenance();
    f.history[0].hmeromhnia_isxyos_oron_ergasias_apo = '2026-04-02';
    assert.equal(coverage(f)[0].from, '2026-04-01', 'compatibility anchor cannot hide a post-import gap');
});

test('a genuine post-import gap stays REVIEW_REQUIRED without guessed periods', () => {
    const f = importedFixture(); f.history[0].hmeromhnia_isxyos_oron_ergasias_eos = '2026-05-31';
    const before = structuredClone(f), plan = coordinate(input(f));
    assert.equal(plan.status, 'REVIEW_REQUIRED'); assert.equal(plan.reason, 'HISTORY_COVERAGE_MISSING');
    assert.deepEqual(plan.coverageGaps.map(g => [g.from, g.to]), [['2026-06-01', '2026-06-30']]);
    assert.deepEqual(plan.proposedRows, []); assert.deepEqual(f, before);
});

test('conflicting same-period pay is not merged from the current employee preference', () => {
    const f = importedFixture(); f.history.push({ ...f.history[1], _id: historyId('employee', 7), pragmatikosMisthos: 9900 });
    const before = structuredClone(f), result = canonical({ scope, currentEmployee: f.employee, historyRows: f.history });
    assert.equal(result.status, 'TRUE_AMBIGUITY'); assert.equal(result.diagnostics.reason, 'CONFLICTING_PROFILE_EVENTS');
    assert.deepEqual(result.rowsToDelete, []); assert.deepEqual(f, before);
    assert.notEqual(coordinate(input(f)).status, 'CLEAN');
});

test('pre-import calculation rejects unknown terms and never borrows 2026 pay or hours', () => {
    const f = importedFixture();
    f.employee[T.ANCHOR] = { source: 'PRE_V1_CURRENT_OBSERVATION', before: '2026-04-01', facts: { pragmatikoOromisthio: 500 } };
    assert.throws(() => H.assertVerifiedHistoryCoverageForDate('2020-01-15', f.history, f.employee),
        { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED' });
    assert.deepEqual(T.fallback('2020-01-15', f.employee, f.history).facts, {});
    assert.throws(() => getOrarioTermsForDate('2020-01-15', f.history, f.employee),
        { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED' });
    assert.throws(() => require('../../utils/ergazomenoi/employmentProfileHistory')
        .resolveEmploymentProfileFactsForDate('2020-01-15', f.history, { currentEmployee: f.employee }),
        { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED' });
    assert.doesNotThrow(() => H.assertVerifiedHistoryCoverageForDate('2026-04-01', f.history, f.employee));
    const old = { ...f.history[0], _id: historyId('employee', 9),
        hmeromhnia_isxyos_oron_ergasias_apo: '2020-01-01', hmeromhnia_isxyos_oron_ergasias_eos: '2020-12-31',
        hmeromhnia_allaghs_symbashs: '2020-01-01', pragmatikoOromisthio: 3 };
    assert.doesNotThrow(() => H.assertVerifiedHistoryCoverageForDate('2020-01-15', [old, ...f.history], f.employee));
    assert.equal(getOrarioTermsForDate('2020-01-15', [old, ...f.history], f.employee).pragmatikoOromisthio, 3);
});

test('ordinary Save on imported CLEAN closed history has no false preservation warning', async () => {
    const f = importedFixture(), db = store([f]), before = db.state();
    const q = value => ({ select() { return this; }, session() { return this; }, lean: async () => value });
    const result = await W.writeEmployeeMaintenance({ ...db.deps, scope, employeeId: 'employee', actorUserId: 'synthetic',
        userModel: { findById: () => q({ team: scope.team, situation: 'A' }) },
        privilegeModel: { findOne: () => q({ privileges: { update: true } }) }, input: {},
        maintenance: { employeeChanges: { email: 'synthetic@example.invalid' }, submittedEmployeeFields: ['email'],
            historyChanges: {}, submittedHistoryChanges: {}, submittedProfileFields: [], submittedFormValues: { email: 'synthetic@example.invalid' } } });
    assert.notEqual(result.ambiguousHistoryPreserved, true); assert.deepEqual(db.state().history, before.history);
    assert.deepEqual(db.state().employees[0][Import.FIELD], before.employees[0][Import.FIELD]);
});

test('confirmed import uses Mongoose query after mongooseOptions returns options, not query', async () => {
    const db = store([importedFixture(false)]), before = db.state();
    const originalFind = db.deps.historyModel.find;
    db.deps.historyModel.find = (...args) => {
        const query = originalFind(...args);
        const originalMongooseOptions = query.mongooseOptions;
        query.mongooseOptions = options => {
            originalMongooseOptions.call(query, options);
            // The real Mongoose API returns the options object, NOT a chainable Query.
            return { includeRedundantHistoryArtifacts: true };
        };
        return query;
    };
    const confirmation = await prepare(db);
    assert.deepEqual(db.state(), before, 'preview must remain read-only');
    const result = await save(db, confirmation);
    assert.equal(result.success, true);
    const after = db.state();
    assert.deepEqual(after.history, before.history, 'every physical history row remains unchanged');
    assert.equal(after.audits.length, 1);
    assert.ok(Import.verifiedImport(after.employees[0]));
});

test('declaration preview writes nothing; confirmed import writes only provenance and one audit', async () => {
    const db = store([importedFixture(false)]), before = db.state(), confirmation = await prepare(db);
    assert.deepEqual(db.state(), before);
    assert.equal(db.events.some(e => ['fence', 'write', 'commit'].includes(e.type)), false);
    assert.equal((await save(db, confirmation)).success, true);
    const after = db.state(); assert.deepEqual(after.history, before.history); assert.equal(after.audits.length, 1);
    assert.equal(after.employees[0].hmeromhnia_proslhpshs, '2017-05-24');
    assert.ok(Import.verifiedImport(after.employees[0]));
    assert.equal(Object.hasOwn(after.employees[0][Import.FIELD], 'sourceApplication'), false);
    assert.equal(Object.hasOwn(after.employees[0][Import.FIELD], 'evidenceReference'), false);
    assert.equal(Object.hasOwn(after.audits[0].diagnostics.provenance, 'sourceApplication'), false);
    assert.equal(Object.hasOwn(after.audits[0].diagnostics.provenance, 'evidenceReference'), false);
    assert.equal(after.audits[0].diagnostics.actorUserId, 'synthetic-admin');
    assert.equal(String(after.audits[0]._id), after.employees[0][Import.FIELD].auditId);
    assert.deepEqual(H.employeeHistoryCoverageGaps({ currentEmployee: after.employees[0], historyRows: after.history }), []);
});

for (const role of [{ privileges: 'S', team: 'THA', situation: 'A' }, { ...admin, situation: 'I' }, null]) {
    test(`server authorization rejects forged administrator flags for ${JSON.stringify(role)}`, async () => {
        const db = store([importedFixture(false)]), before = db.state();
        await assert.rejects(save(db, request(), { userModel: userModel(role), authorizationMode: 'ADMIN_FULL' }));
        assert.deepEqual(db.state(), before);
    });
}

for (const facts of [{ ...request().facts, trackingStartDate: '2026-04-02' },
    { ...request().facts, trackingStartDate: '2026-02-30' }, { ...request().facts, trackingStartDate: '2017-05-23' },
    { ...request().facts, evidenceReference: '-' }, { ...request().facts, sourceApplication: '-' },
    { ...request().facts, status: 'VERIFIED' }]) {
    test(`invalid or forged declaration is rejected: ${JSON.stringify(facts)}`, async () => {
        const db = store([importedFixture(false)]), before = db.state();
        await assert.rejects(save(db, { ...request(), facts })); assert.deepEqual(db.state(), before);
    });
}

test('forged provenance cannot enter ordinary Save or ordinary history edits', async () => {
    const db = store([importedFixture(false)]), before = db.state();
    await assert.rejects(W.writeEmployeeMaintenance({ ...db.deps, scope, employeeId: 'employee',
        maintenance: { employeeChanges: { [Import.FIELD]: provenance() } } }), { code: 'EMPLOYEE_HISTORY_IMPORT_PROTECTED' });
    assert.throws(() => require('../../utils/ergazomenoi/employeeSaveState').employeeSaveMode({
        formData: { [`${Import.FIELD}.status`]: 'VERIFIED' } }), { code: 'EMPLOYEE_HISTORY_IMPORT_PROTECTED' });
    assert.deepEqual(db.state(), before);
});

test('stale page, stale confirmation, repeated confirmation and failed audit preserve all data', async () => {
    const db = store([importedFixture(false)]), old = token(db), confirmation = await prepare(db);
    db.changeCommittedEmployee('employee', { hmeromhnia_lhxhs_symbashs: '2026-11-30' });
    let before = db.state();
    await assert.rejects(save(db, confirmation, { expectedStateToken: old }), { code: 'EMPLOYEE_HISTORY_EDITOR_STALE' });
    assert.deepEqual(db.state(), before);
    await assert.rejects(save(db, confirmation), { code: 'EMPLOYEE_HISTORY_IMPORT_REJECTED' });
    assert.deepEqual(db.state(), before);
    const fresh = await prepare(db);
    await assert.rejects(save(db, fresh, { auditModel: { create: async () => { throw Error('synthetic audit failure'); } } }), /synthetic audit failure/);
    assert.deepEqual(db.state(), before);
    await save(db, fresh); before = db.state();
    await assert.rejects(save(db, fresh)); assert.deepEqual(db.state(), before); assert.equal(before.audits.length, 1);
});

test('two concurrent confirmations serialize, retry and create exactly one declaration/audit', async () => {
    const db = store([importedFixture(false)]), confirmation = await prepare(db), expected = token(db);
    const held = deferred(), release = deferred(), collided = deferred(), committed = deferred();
    let firstSession;
    db.hooks.read = async (session, kind) => {
        if (kind === 'employees' && !firstSession) { firstSession = session.id; held.resolve(); await release.promise; }
    };
    db.hooks.retry = async () => { collided.resolve(); await committed.promise; };
    const first = save(db, confirmation, { expectedStateToken: expected }); await held.promise;
    const second = save(db, confirmation, { expectedStateToken: expected }).catch(error => error);
    await collided.promise; release.resolve(); await first; committed.resolve();
    assert.equal((await second).code, 'EMPLOYEE_HISTORY_EDITOR_STALE');
    assert.equal(db.state().audits.length, 1); assert.equal(db.state().history.length, 2);
});

test('import provenance changes invalidate editor state, including evidence and date', () => {
    const f = importedFixture(), original = stateToken({ currentEmployee: f.employee, historyRows: f.history });
    for (const [field, value] of [['trackingStartDate', '2026-03-31'], ['evidenceReference', 'new proof'], ['sourceApplication', 'other']]) {
        const changed = structuredClone(f); changed.employee[Import.FIELD][field] = value;
        assert.notEqual(stateToken({ currentEmployee: changed.employee, historyRows: changed.history }), original);
    }
    assert.ok(T.profileSelect().split(' ').includes(Import.FIELD));
});

test('employees without import retain the previous coverage and canonical behavior', () => {
    const f = fixture(), before = structuredClone(f);
    assert.deepEqual(coverage(f), []); assert.equal(Import.verifiedImport(f.employee), null);
    assert.equal(canonical({ scope, currentEmployee: f.employee, historyRows: f.history }).status, 'CLEAN');
    assert.deepEqual(f, before);
});

test('import declaration preserves referenced conflicting rows and reports genuine gaps after registration', async () => {
    const f = importedFixture(false);
    f.history[0].hmeromhnia_isxyos_oron_ergasias_eos = '2026-05-31';
    f.history.push({ ...f.history[1], _id: historyId('employee', 7), pragmatikosMisthos: 9900 });
    const db = store([f]), before = db.state();
    for (const method of ['create','updateOne','updateMany','deleteMany']) {
        db.deps.historyModel[method] = () => { throw Error('History mutation forbidden'); };
    }
    const confirmation = await prepare(db), result = await save(db, confirmation);
    assert.deepEqual(db.state().history, before.history);
    assert.deepEqual(result.coverageGaps.map(g => [g.from,g.to]), [['2026-06-01','2026-06-30']]);
    assert.equal(coordinate(input({ employee: db.state().employees[0], history: db.state().history })).status, 'REVIEW_REQUIRED');
});

test('same-start imported legacy observation preserves recorded terms', () => {
    const f = importedFixture();
    const first = {
        ...f.history[0],
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        hmeromhnia_apoxorhshs: null,
        afora_proslhpsh: false,
        afora_allagh_oron_ergasias: true,
        afora_allagh_dialleimatos: null,
        hmeromhnia_isxyos_dialleimatos_apo: null,
        employment_profile_source: 'ERGOMENOI_CONTROLLER',
        employment_profile_schema_version: null,
        mhniaia_repo: 0
    };
    const second = {
        ...first,
        _id: historyId('employee', 1),
        aa_eggrafhs: '0002',
        afora_allagh_oron_ergasias: false,
        afora_allagh_dialleimatos: false,
        mhniaia_repo: null
    };
    f.history = [first, second];
    f.employee = {
        ...second, _id: 'employee', energos: true,
        [Import.FIELD]: f.employee[Import.FIELD]
    };
    const before = structuredClone(f);
    assert.deepEqual(coverage(f), []);
    const result = canonical({
        scope, currentEmployee: f.employee, historyRows: f.history
    });
    assert.equal(result.status, 'CLEAN', result.diagnostics?.reason);
    assert.deepEqual(result.rowsToUpdate, []);
    assert.deepEqual(result.rowsToDelete, []);
    assert.deepEqual(
        result.classifications.find(x => x.historyId === second._id)?.eventTypes,
        ['LEGACY_TECHNICAL']
    );
    const plan = coordinate(input(f));
    assert.equal(plan.status, 'CLEAN', plan.reason);
    assert.equal(plan.noOp, true);
    assert.equal(preview(input(f)).state, 'clean');

    const pay = structuredClone(f);
    pay.history[1].pragmatikosMisthos = 9900;
    const payResult = canonical({
        scope, currentEmployee: pay.employee, historyRows: pay.history
    });
    assert.equal(payResult.status, 'TRUE_AMBIGUITY');
    assert.equal(payResult.diagnostics.reason, 'CONFLICTING_PROFILE_EVENTS');

    const brk = structuredClone(f);
    brk.history[1].afora_allagh_dialleimatos = true;
    brk.history[1].hmeromhnia_isxyos_dialleimatos_apo = '2026-04-01';
    const breakResult = canonical({
        scope, currentEmployee: brk.employee, historyRows: brk.history
    });
    assert.notEqual(breakResult.status, 'CLEAN');
    assert.notDeepEqual(
        breakResult.classifications.find(
            x => x.historyId === second._id
        )?.eventTypes,
        ['LEGACY_TECHNICAL']
    );
    assert.deepEqual(f, before);
});
