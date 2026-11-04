'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const target = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;

test('Gate 2 deferred cross-period real controller transactions', { skip: !uri, timeout: 180000 }, async t => {
    target.assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
        disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
    const mongoose = require('mongoose');
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false, monitorCommands: true,
        appName: 'payroll-gate2-deferred-repo', serverSelectionTimeoutMS: 5000 });
    t.after(() => mongoose.disconnect()); target.assertMongoConnection(mongoose.connection);
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, 'payrollDraftTest'); assert.deepEqual(hello.hosts, ['127.0.0.1:27139']);
    const M = require('../../server/models/ergazomenoi'), C = require('../../server/models/companies'),
        A = require('../../server/models/stathera_arxeia');
    const Decision = require('../../server/models/apasxoliseisWeeklyRepoTransferDecision');
    const Period = require('../../server/models/apasxoliseisPeriodControl');
    for (const model of [M.ErgazomenoiModel, M.IstorikoProslhpseonAllagonModel, M.ProdhlomenaOrariaModel,
        M.ProdhlomenaOrariaAuditModel, C.CompaniesModel, C.YpokatasthmataModel, A.ArgiesModel, A.PeriodsModel,
        Decision, Period, require('../../server/models/employeeHistoryRepairAudit'), require('../../server/models/userModel'),
        require('../../server/models/privileges').UserPrivilegesModel]) await model.createCollection();
    // Install the model's real uniqueness constraints only in the guarded test
    // database. Never substitute partial indexes or disable a production guard.
    await Decision.createIndexes();
    const Workflow = require('../../server/models/apasxoliseisWeeklyHrWorkflowState');
    const Frozen = require('../../server/models/apasxoliseisPeriodFrozenSnapshot');
    await Workflow.createCollection(); await Frozen.createCollection(); await M.ErgazomenoiErganhModel.createCollection();
    const Controller = require('../../server/controllers/ergazomenoi/erganhController');
    const Auth = require('../../server/services/ergazomenoi/deferredCrossPeriodRepoAuthoritativeService');
    const Flow = require('../../server/services/ergazomenoi/deferredCrossPeriodRepoHrFlowService');
    const Revision = require('../../server/services/ergazomenoi/deferredCrossPeriodRepoDecisionRevisionService');
    const Index = require('../../server/services/ergazomenoi/deferredCrossPeriodRepoResolutionIndexGuardService');
    await Index.assertDeferredCrossPeriodResolutionIndexReady();
    const { createMongoSettlementStore } = require('../fixtures/employeeHistorySettlementMongoStore');
    const { acceptanceBWithInitialGap } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
    const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const commands = [], conflicts = [], client = mongoose.connection.getClient();
    client.on('commandStarted', e => commands.push(e));
    client.on('commandFailed', e => { if (e.failure?.code === 112) conflicts.push(e); });
    const bounded = async p => { let timer; try { return await Promise.race([p, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('DEFERRED_BARRIER_TIMEOUT')), 10000);
    })]); } finally { clearTimeout(timer); } };
    function pauseSession() {
        const connection = mongoose.connection, original = connection.startSession;
        let reached, release, used = false;
        const ready = new Promise(resolve => { reached = resolve; });
        const wait = new Promise(resolve => { release = resolve; });
        connection.startSession = async function (...args) { const session = await original.apply(this, args);
            if (!used) { used = true; reached(); await wait; } return session; };
        return { reached: ready, close() { release(); connection.startSession = original; } };
    }
    const business = row => { const { history_reference_fence, updatedAt, employment_history_canonical_status,
        employment_history_canonical_survivor_id, ...value } = row; return value; };
    async function setup() {
        const fixture = acceptanceBWithInitialGap();
        for (const row of [fixture.currentEmployee, ...fixture.completeHistoryRows]) row.dialleima_se_lepta = 0;
        fixture.currentEmployee.ypokatasthma = '0001';
        const db = await createMongoSettlementStore({ fixture, enriched: false, executionMode: 'NORMAL',
            settlementReferenceEvidence: true, referenceCopies: 7 });
        const companyCode = 'GATE2-' + db.employeeId, periodCode = 'GATE2-' + db.employeeId;
        await C.CompaniesModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(db.scope.company_kod) },
            { $set: { kod: companyCode, apasxolhsh_kata_tis_argies: false, leitoyrgia_stis_mh_ypoxreotikes_argies: false } });
        await C.YpokatasthmataModel.collection.insertOne({ team: db.scope.team, companykod_object: db.scope.company_kod, kodikos: '0001' });
        await A.PeriodsModel.collection.insertOne({ xrhsh: '2026', kodikos: periodCode,
            apo: new Date('2026-12-01'), eos: new Date('2026-12-31') });
        const periodScope = { team: db.scope.team, company_kod: db.scope.company_kod, ypokatasthma: '0001',
            period_start: new Date('2026-12-01'), period_end: new Date('2026-12-31') };
        await Period.create({ ...periodScope, deadline: new Date('2026-12-31'), status: 'OPEN',
            successful_calculation_version: 1, last_successful_calculation_at: new Date('2026-11-03T10:00:00Z') });
        const rows = Array.from({ length: 7 }, (_, i) => ({ _id: new mongoose.Types.ObjectId(), ...db.scope,
            ypokatasthma: '0001', hmeromhnia: new Date(Date.UTC(2026, 10, 30 + i)),
            kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8, apo_ora_01: '09:00', eos_ora_01: '17:00',
            cards_ores_ergasias: 8, cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', is_locked: false }));
        Object.assign(rows[0], { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0, apo_ora_01: '', eos_ora_01: '' });
        Object.assign(rows[3], { cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '', adeia_apologistika: false, kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', repo_apologistika: false });
        Object.assign(rows[2], { cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '', adeia_apologistika: false, kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', repo_apologistika: false });
        Object.assign(rows[4], { cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '', adeia_apologistika: false, kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', repo_apologistika: false });
        Object.assign(rows[6], { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0, apo_ora_01: '', eos_ora_01: '', cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '' });
        await M.ProdhlomenaOrariaModel.collection.insertMany(rows);
        const state = await db.state();
        const frozen = { _id: new mongoose.Types.ObjectId(), ...db.nextFrozenReferenceIdentity(), ...periodScope,
            period_start: new Date('2026-11-01'), period_end: new Date('2026-11-30'), frozen_snapshot_fingerprint: 'a'.repeat(64),
            frozen_snapshot: { employees: [state.employee], daily_results: [{ ...rows[0],
                effective_profile_employee_id: db.employeeId, effective_profile_istoriko_id: state.history.at(-1)._id }] } };
        await Frozen.collection.insertOne(frozen);
        await Workflow.collection.insertOne({ ...db.scope, employee_id: new mongoose.Types.ObjectId(db.employeeId),
            employee_kodikos: db.scope.kodikos, ypokatasthma: '0001', week_start: new Date('2026-11-30'), week_end: new Date('2026-12-06') });
        const session = { userTeam: db.scope.team, companyInUse: db.scope.company_kod, userId: db.actorUserId,
            userRole: 'A', userStatus: 'A', userName: 'Gate 2 isolated HR', yearInUse: '2026', periodInUse: periodCode, companyKodikos: companyCode };
        const deferredWeekId = JSON.stringify([db.scope.team, db.scope.company_kod, '0001', db.employeeId,
            '2026-11-30', '2026-12-06', '2026-11-01', '2026-11-30']);
        async function command(targetIndex = 3, patch = {}) {
            const preliminary = { deferred_week_id: deferredWeekId, source_row_id: String(rows[0]._id), target_row_id: String(rows[targetIndex]._id) };
            const input = await Auth.reconstructAuthoritativeDeferredCrossPeriod({ command: preliminary, session,
                resolutionPeriod: { period_start: '2026-12-01', period_end: '2026-12-31' } });
            const preview = Flow.buildPreview({ authoritativeInput: input, session });
            return { ...preliminary, proposal_identity: preview.proposal_identity, resolution_fingerprint: preview.resolution_fingerprint,
                request_id: 'gate2-deferred-' + db.employeeId, resolution_reason: 'Απομονωμένη απόφαση', ...patch };
        }
        async function invoke(body) { const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } };
            await Controller.resolveDeferredCrossPeriodRepoResolution({ session, body: { ypokatasthma: '0001', ...body } }, res); return res; }
        async function settle() { const input = await db.approvalInput();
            const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal: U.buildCoordinatedSettlementProposal(input) });
            return () => W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({ syntheticStore: db.handle,
                scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId, coordinated: true,
                approval: { confirmed: true, fingerprint } }); }
        return { db, rows, frozen, session, periodScope, deferredWeekId, command, invoke, settle,
            decisions: () => Decision.find({ team: db.scope.team, company_kod: db.scope.company_kod }).sort({ resolution_revision: 1 }).lean() };
    }
    await t.test('real authoritative initial resolution has revision 1 and protected history references', async () => {
        const c = await setup(), result = await c.invoke(await c.command());
        assert.equal(result.statusCode, 201, JSON.stringify(result.body));
        const records = await c.decisions(); assert.equal(records.length, 1); assert.equal(records[0].resolution_revision, 1);
        assert.ok(require('../../server/services/ergazomenoi/employeeHistoryReferenceWriteFenceService')
            .employeeHistoryReferenceTargets(Decision.collection.name, records).length > 0);
    });
    await t.test('regression: source changed after reconstruction must reject initial decision', async () => {
        const c = await setup(), body = await c.command(), barrier = pauseSession(); const pending = c.invoke(body);
        try { await bounded(barrier.reached); await M.ProdhlomenaOrariaModel.collection.updateOne({ _id: c.rows[0]._id },
            { $set: { cards_apo_ora_01: '10:00', cards_eos_ora_01: '18:00' } }); } finally { barrier.close(); }
        const result = await pending; assert.equal(result.statusCode, 409, JSON.stringify(result.body));
        assert.equal((await c.decisions()).length, 0);
    });
    await t.test('regression: same request id with different reason is a command conflict', async () => {
        const c = await setup(), body = await c.command(); assert.equal((await c.invoke(body)).statusCode, 201);
        const result = await c.invoke({ ...body, resolution_reason: 'Άλλη αιτιολογία' });
        assert.equal(result.statusCode, 409, JSON.stringify(result.body));
        assert.equal(result.body.code, 'DEFERRED_CROSS_PERIOD_RESOLUTION_REQUEST_CONFLICT');
    });

    async function initial(c) {
        const body = await c.command(); const result = await c.invoke(body);
        assert.equal(result.statusCode, 201, JSON.stringify(result.body)); return (await c.decisions())[0];
    }
    async function correction(c, previous, index = 4, suffix = '-revision2') {
        return c.command(index, { request_id: 'gate2-deferred-' + c.db.employeeId + suffix,
            correction_reason: 'Διορθωτική επιλογή', expected_previous_decision_id: String(previous._id),
            expected_previous_resolution_fingerprint: previous.resolution_fingerprint });
    }
    for (const change of ['target', 'history', 'frozen', 'workflow', 'period', 'holiday', 'protected-reference']) await t.test(`transactional initial reconstruction rejects concurrent ${change}`, async () => {
        const c = await setup(), body = await c.command(), barrier = pauseSession(); const pending = c.invoke(body);
        try { await bounded(barrier.reached);
            if (change === 'target') await M.ProdhlomenaOrariaModel.collection.updateOne({ _id: c.rows[3]._id }, { $set: { apo_ora_01: '08:00' } });
            if (change === 'history') { const state = await c.db.state(); await M.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: state.history[0]._id }, { $set: { ores_ergasias_ebdomadas: 39 } }); }
            if (change === 'frozen') await Frozen.collection.updateOne({ _id: c.frozen._id }, { $set: { 'frozen_snapshot.extra_amount': 999 } });
            if (change === 'workflow') await Workflow.collection.updateOne({ employee_id: new mongoose.Types.ObjectId(c.db.employeeId) }, { $set: { employee_kodikos: 'WRONG' } });
            if (change === 'period') await Period.collection.updateOne(c.periodScope, { $set: { status: 'LOCKED' } });
            if (change === 'holiday') await A.ArgiesModel.collection.insertOne({ team: c.db.scope.team, company_kod: c.session.companyKodikos, etos: '2026', hmeromhnia: c.rows[3].hmeromhnia, ypoxreotikh_argia: true });
            if (change === 'protected-reference') { const state = await c.db.state(); await c.db.addReference(String(state.history[0]._id)); }
        } finally { barrier.close(); }
        const result = await pending; assert.equal(result.statusCode, 409, JSON.stringify(result.body));
        assert.equal((await c.decisions()).length, 0); assert.equal((await c.db.state()).audits.length, 0);
    });
    await t.test('append-only revisions 1 2 3 preserve exact previous records and supersedes links', async () => {
        const c = await setup(), first = await initial(c), old = await c.decisions();
        const secondResult = await c.invoke(await correction(c, first)); assert.equal(secondResult.statusCode, 201, JSON.stringify(secondResult.body));
        const second = (await c.decisions())[1]; assert.equal(second.resolution_revision, 2);
        const thirdResult = await c.invoke(await correction(c, second, 2, '-revision3'));
        assert.equal(thirdResult.statusCode, 201, JSON.stringify(thirdResult.body));
        const records = await c.decisions(); assert.deepEqual(records.map(r => r.resolution_revision), [1,2,3]);
        assert.deepEqual(records[0], old[0]);
        for (let i = 1; i < records.length; i++) {
            assert.equal(String(records[i].supersedes_decision_id), String(records[i-1]._id));
            assert.equal(records[i].supersedes_resolution_fingerprint, records[i-1].resolution_fingerprint);
        }
        assert.equal(String(Revision.resolveEffectiveDeferredCrossPeriodDecision(records, c.deferredWeekId)._id), String(records[2]._id));
    });
    for (const field of ['expected_previous_decision_id', 'expected_previous_resolution_fingerprint']) await t.test(`correction rejects wrong ${field}`, async () => {
        const c = await setup(), first = await initial(c), body = await correction(c, first);
        const result = await c.invoke({ ...body, [field]: field.endsWith('_id') ? String(new mongoose.Types.ObjectId()) : 'wrong' });
        assert.equal(result.statusCode, 409); assert.equal((await c.decisions()).length, 1);
    });
    await t.test('active revision changes between reconstruction and transaction: loser remains append-only', async () => {
        const c = await setup(), first = await initial(c), body = await correction(c, first), barrier = pauseSession();
        const pending = c.invoke(body);
        try { await bounded(barrier.reached);
            const result = await c.invoke(await correction(c, first, 2, '-winning-correction'));
            assert.equal(result.statusCode, 201, JSON.stringify(result.body));
        } finally { barrier.close(); }
        const result = await pending; assert.equal(result.statusCode, 409); assert.equal((await c.decisions()).length, 2);
    });
    for (const sameRequest of [true, false]) await t.test(`concurrent corrections use real transaction and revision index: same request=${sameRequest}`, async () => {
        const c = await setup(), first = await initial(c), body = await correction(c, first);
        const results = await Promise.all([c.invoke(body), c.invoke(sameRequest ? body : { ...body, request_id: body.request_id + '-other' })]);
        assert.deepEqual(results.map(r => r.statusCode).sort(), sameRequest ? [200,201] : [201,409]);
        assert.equal((await c.decisions()).length, 2);
    });
    await t.test('real unique revision index rejects a second document for revision 1', async () => {
        const c = await setup(), first = await initial(c);
        await assert.rejects(() => Decision.collection.insertOne({ ...first, _id: new mongoose.Types.ObjectId(),
            request_id: first.request_id + '-collision', proposal_identity: 'different-proposal' }),
            e => e.code === 11000 && String(e.message).includes(Index.INDEX_NAME));
        assert.equal(await Index.assertDeferredCrossPeriodResolutionIndexReady(), true);
        assert.equal((await c.decisions()).length, 1);
    });
    for (const field of ['source_row_id', 'target_row_id', 'expected_previous_decision_id', 'expected_previous_resolution_fingerprint', 'correction_reason', 'resolution_reason']) await t.test(`request identity rejects changed ${field}`, async () => {
        const c = await setup(), body = await c.command(); assert.equal((await c.invoke(body)).statusCode, 201);
        const result = await c.invoke({ ...body, [field]: field.endsWith('_row_id') ? String(c.rows[4]._id) : 'different' });
        assert.equal(result.statusCode, 409); assert.equal(result.body.code, 'DEFERRED_CROSS_PERIOD_RESOLUTION_REQUEST_CONFLICT');
        assert.equal((await c.decisions()).length, 1);
    });
    for (const revision of [false, true]) await t.test(`writer first versus NORMAL Settlement: corrective=${revision}`, async () => {
        const c = await setup(), previous = revision ? await initial(c) : null;
        const body = previous ? await correction(c, previous) : await c.command();
        const run = await c.settle(), before = await c.db.state(), barrier = c.db.pauseNextEmployeeRead(), start = conflicts.length;
        const settlement = assert.rejects(run(), e => e.code === S.PREFIX + 'STALE');
        try { await bounded(barrier.reached); const result = await bounded(c.invoke(body)); assert.equal(result.statusCode, 201, JSON.stringify(result.body)); }
        finally { barrier.resume(); }
        await settlement; assert.ok(conflicts.length > start); assert.ok(c.db.transactionCallbacks() >= 2);
        const after = await c.db.state(); assert.equal(after.audits.length, 0); assert.deepEqual(after.employee, before.employee);
        assert.deepEqual(after.history.map(business), before.history.map(business)); assert.deepEqual(after.references, before.references);
    });
    for (const revision of [false, true]) await t.test(`NORMAL Settlement first rejects old cross-period state: corrective=${revision}`, async () => {
        const c = await setup(), previous = revision ? await initial(c) : null;
        const body = previous ? await correction(c, previous) : await c.command();
        const run = await c.settle(), before = await c.db.state(), barrier = c.db.pauseNextReferenceClaim();
        let listener; const conflict = new Promise(resolve => { listener = e => { if (e.failure?.code === 112) resolve(); }; });
        client.on('commandFailed', listener); const settlement = run(); let pending;
        try { await bounded(barrier.reached); pending = c.invoke(body); await bounded(conflict); }
        finally { barrier.resume(); client.off('commandFailed', listener); }
        assert.equal((await settlement).applied, true); const result = await pending;
        assert.equal(result.statusCode, 409, JSON.stringify(result.body)); assert.equal((await c.decisions()).length, revision ? 1 : 0);
        const after = await c.db.state(); assert.equal(after.audits.length, 1);
        assert.equal(after.employee.employee_profile_mutation_sequence, (before.employee.employee_profile_mutation_sequence || 0) + 1);
        assert.deepEqual(after.references, before.references);
    });
    for (const revision of [false, true]) for (const mode of ['unknown-commit', 'lost-ack']) await t.test(`uncertain outcome ${mode}, corrective=${revision} recovers exact committed request once`, async () => {
        const c = await setup(), previous = revision ? await initial(c) : null,
            body = previous ? await correction(c, previous) : await c.command(), before = await c.db.state(), admin = mongoose.connection.db.admin();
        const original = mongoose.connection.startSession; let lost = 0, uncertain = 0;
        const observer = e => { if (e.commandName === 'commitTransaction' && e.reply?.writeConcernError?.code === 64) uncertain++; };
        client.on('commandSucceeded', observer);
        if (mode === 'lost-ack') mongoose.connection.startSession = async function (...args) {
            const session = await original.apply(this, args), withTransaction = session.withTransaction.bind(session);
            session.withTransaction = async (...options) => { await withTransaction(...options); lost++; throw Error('ISOLATED_ACK_LOST'); }; return session; };
        let result;
        try {
            if (mode === 'unknown-commit') await admin.command({ configureFailPoint: 'failCommand', mode: { times: 1 }, data: {
                failCommands: ['commitTransaction'], appName: 'payroll-gate2-deferred-repo',
                writeConcernError: { code: 64, errmsg: 'isolated deferred commit uncertainty' }, errorLabels: ['UnknownTransactionCommitResult'] } });
            result = await c.invoke(body);
        } finally { mongoose.connection.startSession = original; client.off('commandSucceeded', observer);
            if (mode === 'unknown-commit') await admin.command({ configureFailPoint: 'failCommand', mode: 'off' }); }
        assert.ok([200,201].includes(result.statusCode), JSON.stringify(result.body));
        assert.equal(mode === 'lost-ack' ? lost : uncertain, 1);
        assert.equal((await c.invoke(body)).statusCode, 200); assert.equal((await c.decisions()).length, revision ? 2 : 1);
        if (previous) assert.deepEqual((await c.decisions())[0], previous);
        const after = await c.db.state(); assert.deepEqual(after.employee, before.employee); assert.equal(after.audits.length, 0);
        assert.deepEqual(after.references, before.references);
    });

    function pauseWrite(model, matches) {
        const original = model.findOneAndUpdate; let reached, release, used = false;
        const ready = new Promise(resolve => { reached = resolve; });
        const wait = new Promise(resolve => { release = resolve; });
        model.findOneAndUpdate = function (...args) { const query = original.apply(this, args);
            if (!used && matches(args[0])) { used = true; const exec = query.exec.bind(query);
                query.exec = async (...options) => { const value = await exec(...options); reached(); await wait; return value; }; }
            return query; };
        return { reached: ready, close() { release(); model.findOneAndUpdate = original; } };
    }
    for (const change of ['source', 'history', 'frozen', 'workflow', 'calendar']) await t.test(`regression: ${change} after transaction snapshot forces retry and rejects stale input`, async () => {
        const c = await setup(); let holiday;
        if (change === 'calendar') { holiday = { _id: new mongoose.Types.ObjectId(), team: c.db.scope.team,
            company_kod: c.session.companyKodikos, etos: '2026', hmeromhnia: c.rows[5].hmeromhnia, ypoxreotikh_argia: true, perigrafh: 'old' };
            await A.ArgiesModel.collection.insertOne(holiday); }
        const body = await c.command(), start = conflicts.length;
        const barrier = pauseWrite(Period, f => f.company_kod === c.db.scope.company_kod), pending = c.invoke(body);
        try { await bounded(barrier.reached);
            if (change === 'source') await M.ProdhlomenaOrariaModel.collection.updateOne({ _id: c.rows[0]._id }, { $set: { cards_apo_ora_01: '10:00', cards_eos_ora_01: '18:00' } });
            if (change === 'history') { const state = await c.db.state(); await M.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: state.history[0]._id }, { $set: { ores_ergasias_ebdomadas: 39 } }); }
            if (change === 'frozen') await Frozen.collection.updateOne({ _id: c.frozen._id }, { $set: { 'frozen_snapshot.extra_amount': 999 } });
            if (change === 'workflow') await Workflow.collection.updateOne({ employee_id: new mongoose.Types.ObjectId(c.db.employeeId) }, { $set: { employee_kodikos: 'WRONG' } });
            if (change === 'calendar') await A.ArgiesModel.collection.updateOne({ _id: holiday._id }, { $set: { perigrafh: 'changed' } });
        } finally { barrier.close(); }
        const result = await pending; assert.equal(result.statusCode, 409, JSON.stringify(result.body));
        assert.ok(conflicts.length > start); assert.equal((await c.decisions()).length, 0);
    });

    await t.test('rollback after real insert restores all historical payroll and reference documents', async () => {
        const c = await setup(), body = await c.command(), before = await c.db.state();
        const rows = await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).sort({ _id: 1 }).toArray();
        const original = Decision.create; let inserts = 0;
        Decision.create = async function (...args) { const created = await original.apply(this, args); inserts++; throw Error('ISOLATED_AFTER_REAL_INSERT'); };
        let result; try { result = await c.invoke(body); } finally { Decision.create = original; }
        assert.equal(result.statusCode, 500); assert.equal(inserts, 1); assert.equal((await c.decisions()).length, 0);
        assert.deepEqual(await c.db.state(), before);
        assert.deepEqual(await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).sort({ _id: 1 }).toArray(), rows);
    });
    await t.test('independent employee progresses while another Settlement owns its references', async () => {
        const c = await setup(), other = await setup(), run = await c.settle(), body = await other.command();
        const barrier = c.db.pauseNextReferenceClaim(), settlement = run();
        try { await bounded(barrier.reached); const result = await bounded(other.invoke(body)); assert.equal(result.statusCode, 201, JSON.stringify(result.body)); }
        finally { barrier.resume(); }
        assert.equal((await settlement).applied, true); assert.equal((await other.decisions()).length, 1);
        assert.equal((await other.db.state()).audits.length, 0);
    });
    await t.test('independent natural weeks of one employee have separate revision chains', async () => {
        const c = await setup(), first = await initial(c), state = await c.db.state();
        const rows = c.rows.map((row, i) => ({ ...row, _id: new mongoose.Types.ObjectId(), hmeromhnia: new Date(Date.UTC(2026, 11, 28 + i)) }));
        await M.ProdhlomenaOrariaModel.collection.insertMany(rows);
        await Frozen.collection.insertOne({ ...c.frozen, ...c.db.nextFrozenReferenceIdentity(), _id: new mongoose.Types.ObjectId(),
            period_start: new Date('2026-12-01'), period_end: new Date('2026-12-31') });
        await Workflow.collection.insertOne({ ...c.db.scope, employee_id: new mongoose.Types.ObjectId(c.db.employeeId),
            employee_kodikos: c.db.scope.kodikos, ypokatasthma: '0001', week_start: new Date('2026-12-28'), week_end: new Date('2027-01-03') });
        const periodCode = 'GATE2-JAN-' + c.db.employeeId;
        await A.PeriodsModel.collection.insertOne({ xrhsh: '2027', kodikos: periodCode, apo: new Date('2027-01-01'), eos: new Date('2027-01-31') });
        await Period.create({ ...c.periodScope, period_start: new Date('2027-01-01'), period_end: new Date('2027-01-31'), deadline: new Date('2027-02-28'), status: 'OPEN' });
        const session = { ...c.session, yearInUse: '2027', periodInUse: periodCode };
        const command = { deferred_week_id: JSON.stringify([c.db.scope.team,c.db.scope.company_kod,'0001',c.db.employeeId,'2026-12-28','2027-01-03','2026-12-01','2026-12-31']),
            source_row_id: String(rows[0]._id), target_row_id: String(rows[4]._id) };
        const input = await Auth.reconstructAuthoritativeDeferredCrossPeriod({ command, session,
            resolutionPeriod: { period_start: '2027-01-01', period_end: '2027-01-31' } });
        const preview = Flow.buildPreview({ authoritativeInput: input, session });
        const res = { statusCode: 200, status(n) { this.statusCode=n; return this; }, json(b) { this.body=b; return this; } };
        await Controller.resolveDeferredCrossPeriodRepoResolution({ session, body: { ...command, ypokatasthma:'0001',
            proposal_identity:preview.proposal_identity,resolution_fingerprint:preview.resolution_fingerprint,
            request_id:'gate2-independent-week-'+c.db.employeeId,resolution_reason:'Άλλη εβδομάδα' } },res);
        assert.equal(res.statusCode,201,JSON.stringify(res.body));
        const decisions=await c.decisions();assert.equal(decisions.length,2);assert.ok(decisions.every(row=>row.resolution_revision===1));
        assert.deepEqual(decisions.find(row=>String(row._id)===String(first._id)),first);
        assert.deepEqual((await c.db.state()).employee,state.employee);
    });

    await t.test('regression: another open branch cannot authorize a locked deferred branch', async () => {
        const c = await setup(), body = await c.command();
        await C.YpokatasthmataModel.collection.insertOne({ team: c.db.scope.team, companykod_object: c.db.scope.company_kod, kodikos: '0002' });
        await Period.create({ ...c.periodScope, ypokatasthma: '0002', deadline: new Date('2027-01-31'), status:'OPEN' });
        await Period.collection.updateOne(c.periodScope, { $set: { status:'LOCKED' } });
        const result = await c.invoke({ ...body, ypokatasthma:'0002' });
        assert.ok([403,409].includes(result.statusCode),JSON.stringify(result.body));
        assert.equal((await c.decisions()).length,0);
    });
});
