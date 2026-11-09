'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const target = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;

test('Gate 2 human repo transfer with real loader and controller', { skip: !uri, timeout: 180000 }, async t => {
    target.assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
        disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
    const mongoose = require('mongoose');
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false, monitorCommands: true,
        appName: 'payroll-gate2-human-repo', serverSelectionTimeoutMS: 5000 });
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
    const R = require('../../server/services/ergazomenoi/apasxoliseisWeeklyRepoTransferDecisionReconstructionService');
    const G = require('../../server/services/ergazomenoi/apasxoliseisWeeklyRepoTransferSinglePairGroupProjectionService');
    const Service = require('../../server/services/ergazomenoi/apasxoliseisWeeklyRepoTransferDecisionService');
    const Controller = require('../../server/controllers/ergazomenoi/erganhController');
    const { createMongoSettlementStore } = require('../fixtures/employeeHistorySettlementMongoStore');
    const { acceptanceBWithInitialGap } = require('../fixtures/employeeHistoryCoordinatedSettlementFixture');
    const S = require('../../server/services/ergazomenoi/employeeHistoryAutomaticSettlementPreparationContract');
    const U = require('../../server/services/ergazomenoi/employeeHistoryCoordinatedSettlementContract');
    const W = require('../../server/services/ergazomenoi/employeeEmploymentProfileWriter');
    const commands = [], conflicts = [], client = mongoose.connection.getClient();
    client.on('commandStarted', e => commands.push(e));
    client.on('commandFailed', e => { if (e.failure?.code === 112) conflicts.push(e); });
    const bounded = async p => { let timer; try { return await Promise.race([p, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('HUMAN_REPO_BARRIER_TIMEOUT')), 10000);
    })]); } finally { clearTimeout(timer); } };
    function pauseRead(model, method, matches) {
        const original = model[method]; let release, reached, used = false;
        const wait = new Promise(resolve => { release = resolve; });
        const ready = new Promise(resolve => { reached = resolve; });
        model[method] = function (...args) {
            const query = original.apply(this, args);
            if (!used && matches(args[0])) {
                used = true; const lean = query.lean.bind(query);
                query.lean = async (...options) => { const value = await lean(...options); reached(); await wait; return value; };
            }
            return query;
        };
        return { reached: ready, resume: release, close: () => { release(); model[method] = original; } };
    }
    async function changeSource(c) {
        await M.ProdhlomenaOrariaModel.collection.updateOne({ _id: c.rows[1]._id },
            { $set: { cards_apo_ora_01: '09:01', cards_eos_ora_01: '17:01' } });
    }
    const business = row => { const { history_reference_fence, updatedAt, employment_history_canonical_status,
        employment_history_canonical_survivor_id, ...value } = row; return value; };
    async function setup(referenceCopies = 1) {
        const fixture = acceptanceBWithInitialGap();
        for (const row of [fixture.currentEmployee, ...fixture.completeHistoryRows]) row.dialleima_se_lepta = 0;
        fixture.currentEmployee.ypokatasthma = '0001';
        const db = await createMongoSettlementStore({ fixture, enriched: false, executionMode: 'NORMAL',
            settlementReferenceEvidence: true, referenceCopies });
        const companyCode = 'GATE2-' + db.employeeId, periodCode = 'GATE2-' + db.employeeId;
        await C.CompaniesModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(db.scope.company_kod) },
            { $set: { kod: companyCode, apasxolhsh_kata_tis_argies: false, leitoyrgia_stis_mh_ypoxreotikes_argies: false } });
        await C.YpokatasthmataModel.collection.insertOne({ team: db.scope.team, companykod_object: db.scope.company_kod, kodikos: '0001' });
        await A.PeriodsModel.collection.insertOne({ xrhsh: '2026', kodikos: periodCode,
            apo: new Date('2026-11-01'), eos: new Date('2026-11-30') });
        await A.ArgiesModel.collection.insertOne({ team: db.scope.team, company_kod: companyCode, etos: '2026',
            hmeromhnia: new Date('2026-11-01'), ypoxreotikh_argia: true, perigrafh: 'isolated holiday outside selected week' });
        const periodScope = { team: db.scope.team, company_kod: db.scope.company_kod, ypokatasthma: '0001',
            period_start: new Date('2026-11-01'), period_end: new Date('2026-11-30') };
        await Period.create({ ...periodScope, deadline: new Date('2026-12-31'), status: 'OPEN',
            successful_calculation_version: 1, last_successful_calculation_at: new Date('2026-11-03T10:00:00Z') });
        const rows = Array.from({ length: 7 }, (_, i) => ({ _id: new mongoose.Types.ObjectId(), ...db.scope,
            ypokatasthma: '0001', hmeromhnia: new Date(Date.UTC(2026, 10, 2 + i)),
            kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8, cards_ores_ergasias: 8,
            cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', cards_apo_ora_02: '', cards_eos_ora_02: '',
            cards_apo_ora_03: '', cards_eos_ora_03: '', is_locked: false }));
        Object.assign(rows[1], { kathgoria_ergasias: 'ΑΝ' });
        Object.assign(rows[4], { cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '' });
        Object.assign(rows[6], { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0, cards_ores_ergasias: 0,
            cards_apo_ora_01: '', cards_eos_ora_01: '' });
        await M.ProdhlomenaOrariaModel.collection.insertMany(rows);
        const session = { userTeam: db.scope.team, companyInUse: db.scope.company_kod, userId: db.actorUserId,
            userRole: 'A', userStatus: 'A', userName: 'Gate 2 isolated HR', yearInUse: '2026', periodInUse: periodCode,
            companyKodikos: companyCode };
        const scope = Service.scopeFromSession(session);
        const context = await R.defaultContextLoader({ scope, sourceId: String(rows[1]._id), targetId: String(rows[4]._id) });
        const projection = G.buildWeeklyRepoTransferSinglePairGroupProjection({ weekRows: context.weekRows,
            employmentProfile: context.employmentProfile, holidayByDateKey: context.holidayByDateKey,
            existingAuditCountByRowKey: new Map(), contractVersion: 'v1' });
        assert.equal(projection.projection_status, 'READY', JSON.stringify({ reasons: projection.reasons, profile: context.employmentProfile }));
        const group = projection.groups[0];
        const command = { proposal_id: group.group_id, expected_source_id: String(rows[1]._id),
            expected_target_id: String(rows[4]._id), expected_proposal_version: group.pair_contract.proposal_version,
            expected_choice_code: group.pair_contract.choice_code, decision_code: 'APPROVE_PROPOSAL', notes: 'isolated real reconstruction',
            request_id: 'gate2-human-' + db.employeeId };
        const first = await R.reconstructWeeklyRepoTransferDecision({ scope, command });
        assert.equal(first.snapshot.employment_profile.history.length, 4);
        const input = await db.approvalInput();
        const approved = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal: U.buildCoordinatedSettlementProposal(input) });
        const run = () => W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({ syntheticStore: db.handle,
            scope: db.scope, employeeId: db.employeeId, actorUserId: db.actorUserId, coordinated: true,
            approval: { confirmed: true, fingerprint: approved } });
        async function writer(patch = {}) {
            const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
                json(body) { this.body = body; return this; } };
            await Controller.createWeeklyRepoTransferDecision({ session, body: { ...command, ...patch } }, res);
            return res;
        }
        return { db, scope, session, periodScope, command, rows, first, writer, run,
            decisions: () => Decision.find({ team: db.scope.team, company_kod: db.scope.company_kod }).lean() };
    }
    await t.test('real default loader, controller period guard and request idempotency', async () => {
        const c = await setup();
        const second = await R.reconstructWeeklyRepoTransferDecision({ scope: c.scope, command: c.command });
        assert.equal(second.fingerprint, c.first.fingerprint);
        const start = commands.length;
        const result = await c.writer(); assert.equal(result.statusCode, 201, JSON.stringify(result.body));
        const reconstructions = commands.slice(start).filter(e => e.commandName === 'find' &&
            e.command.find === M.ProdhlomenaOrariaModel.collection.name && e.command.filter?._id?.$in);
        assert.equal(reconstructions.length, 3);
        assert.equal(reconstructions.filter(e => e.command.autocommit === false).length, 1);
        const txReads = commands.slice(start).filter(e => e.commandName === 'find' && e.command.autocommit === false);
        for (const model of [M.ProdhlomenaOrariaModel, M.ErgazomenoiModel,
            M.IstorikoProslhpseonAllagonModel, C.CompaniesModel, A.ArgiesModel])
            assert.ok(txReads.some(e => e.command.find === model.collection.name),
                'Reconstruction must read ' + model.collection.name + ' in the actual transaction');
        const retry = await c.writer(); assert.equal(retry.statusCode, 200); assert.equal(retry.body.idempotent, true);
        assert.equal((await c.decisions()).length, 1);
        const conflicting = await c.writer({ notes: 'different content, same request' }); assert.equal(conflicting.statusCode, 409);
        for (const row of (await c.db.state()).history) assert.equal(row.history_reference_fence, 1,
            'Every real history reference, including nonrepresentatives, is fenced once');
    });
    await t.test('regression: source changes after reconstruction and before transactional write must be rejected', async () => {
        const c = await setup();
        const barrier = pauseRead(Period, 'findOne', f => f.company_kod === c.db.scope.company_kod);
        const pending = c.writer();
        try { await bounded(barrier.reached); await changeSource(c); }
        finally { barrier.close(); }
        const result = await pending;
        assert.equal(result.statusCode, 409, JSON.stringify(result.body));
        assert.equal((await c.decisions()).length, 0);
    });
    await t.test('target changes between the two real reconstructions: no decision is stored', async () => {
        const c = await setup();
        const barrier = pauseRead(A.ArgiesModel, 'find', f => f.company_kod === c.session.companyKodikos);
        const pending = c.writer();
        try { await bounded(barrier.reached); await M.ProdhlomenaOrariaModel.collection.updateOne({ _id: c.rows[4]._id },
            { $set: { apo_ora_01: '09:00', eos_ora_01: '17:00' } }); }
        finally { barrier.close(); }
        const result = await pending; assert.equal(result.statusCode, 409, JSON.stringify(result.body));
        assert.equal((await c.decisions()).length, 0);
    });
    await t.test('period changes between guard and write: expectedToken rejects and rolls back', async () => {
        const c = await setup(), before = await c.db.state();
        const barrier = pauseRead(Period, 'findOne', f => f.company_kod === c.db.scope.company_kod);
        const pending = c.writer();
        try { await bounded(barrier.reached); await Period.collection.updateOne(c.periodScope,
            { $inc: { version: 1 } }); }
        finally { barrier.close(); }
        const result = await pending; assert.equal(result.statusCode, 409, JSON.stringify(result.body));
        assert.equal(result.body.code, 'PERIOD_CONTROL_STATE_CONFLICT');
        assert.equal((await c.decisions()).length, 0); assert.deepEqual(await c.db.state(), before);
        assert.equal((await Period.findOne(c.periodScope).lean()).write_fence_version, 0);
    });
    for (const copies of [1, 7]) await t.test(`real human writer first adds reference ${copies + 1}: Settlement conflicts, retries and rejects old approval`, async () => {
        const c = await setup(copies), before = await c.db.state(), barrier = c.db.pauseNextEmployeeRead(), start = conflicts.length;
        const pending = assert.rejects(c.run(), e => e.code === S.PREFIX + 'STALE');
        try { await bounded(barrier.reached); const result = await c.writer(); assert.equal(result.statusCode, 201, JSON.stringify(result.body)); }
        finally { barrier.resume(); }
        await pending; assert.ok(conflicts.length > start); assert.ok(c.db.transactionCallbacks() >= 2);
        const after = await c.db.state(); assert.deepEqual(after.employee, before.employee); assert.equal(after.audits.length, 0);
        assert.equal((await c.decisions()).length, 1);
        const strip = row => { const { history_reference_fence, updatedAt, ...value } = row; return value; };
        assert.deepEqual(after.history.map(strip), before.history.map(strip)); assert.deepEqual(after.references, before.references);
        const fresh = await c.db.approvalInput();
        for (const row of fresh.completeHistoryRows) assert.equal(fresh.protectedReferenceSummary[String(row._id)].length, copies + 1);
    });
    await t.test('Settlement first: real writer conflict retries full reconstruction; fresh later decision is legal', async () => {
        const c = await setup(7), before = await c.db.state(), barrier = c.db.pauseNextReferenceClaim(), start = commands.length;
        let listener;
        const failed = new Promise(resolve => { listener = e => { if (e.failure?.code === 112) resolve(e); }; });
        client.on('commandFailed', listener);
        const settlement = c.run(); let writing;
        try { await bounded(barrier.reached); writing = c.writer(); await bounded(failed); }
        finally { barrier.resume(); client.off('commandFailed', listener); }
        assert.equal((await settlement).applied, true);
        const result = await writing; assert.equal(result.statusCode, 409, JSON.stringify(result.body));
        assert.equal((await c.decisions()).length, 0);
        const txReconstructions = commands.slice(start).filter(e => e.commandName === 'find' &&
            e.command.find === M.ProdhlomenaOrariaModel.collection.name && e.command.filter?._id?.$in && e.command.autocommit === false);
        assert.ok(txReconstructions.length >= 2, 'Actual writer callback must reload the real proposal after conflict');
        const after = await c.db.state(); assert.equal(after.audits.length, 1);
        assert.equal(after.employee.employee_profile_mutation_sequence, (before.employee.employee_profile_mutation_sequence || 0) + 1);
        for (const original of before.history) assert.deepEqual(business(after.history.find(row => String(row._id) === String(original._id))), business(original));
        const fresh = await R.reconstructWeeklyRepoTransferDecision({ scope: c.scope, command: c.command });
        assert.notEqual(fresh.fingerprint, c.first.fingerprint);
        const legal = await c.writer({ request_id: c.command.request_id + '-fresh' });
        assert.equal(legal.statusCode, 201, JSON.stringify(legal.body)); assert.equal((await c.decisions()).length, 1);
        assert.equal((await c.db.state()).audits.length, 1);
        assert.equal((await c.db.state()).employee.employee_profile_mutation_sequence, after.employee.employee_profile_mutation_sequence);
    });
    await t.test('source changes between the two real reconstructions: reject the old proposal', async () => {
        const c = await setup(), barrier = pauseRead(A.ArgiesModel, 'find', f => f.company_kod === c.session.companyKodikos);
        const pending = c.writer();
        try { await bounded(barrier.reached); await changeSource(c); } finally { barrier.close(); }
        const result = await pending; assert.equal(result.statusCode, 409, JSON.stringify(result.body));
        assert.equal((await c.decisions()).length, 0);
    });
    await t.test('target changes after reconstruction: transaction reload rejects it', async () => {
        const c = await setup(), barrier = pauseRead(Period, 'findOne', f => f.company_kod === c.db.scope.company_kod);
        const pending = c.writer();
        try { await bounded(barrier.reached); await M.ProdhlomenaOrariaModel.collection.updateOne({ _id: c.rows[4]._id },
            { $set: { apo_ora_01: '09:00', eos_ora_01: '17:00' } }); } finally { barrier.close(); }
        const result = await pending; assert.equal(result.statusCode, 409, JSON.stringify(result.body));
        assert.equal((await c.decisions()).length, 0);
    });
    await t.test('real period guard rejects an already locked period before write', async () => {
        const c = await setup(), before = await c.db.state();
        await Period.collection.updateOne(c.periodScope, { $set: { status: 'LOCKED' } });
        const result = await c.writer(); assert.equal(result.statusCode, 409, JSON.stringify(result.body));
        assert.equal(result.body.code, 'PERIOD_CONTROL_LOCKED');
        assert.equal((await c.decisions()).length, 0); assert.deepEqual(await c.db.state(), before);
    });
    await t.test('different employee in the same company can record a real proposal while Settlement holds the first employee', async () => {
        const c = await setup(), before = await c.db.state(), code = c.db.scope.kodikos + '-other';
        const employeeId = new mongoose.Types.ObjectId();
        const history = { ...before.history.at(-1), _id: new mongoose.Types.ObjectId(), kodikos: code };
        await M.IstorikoProslhpseonAllagonModel.collection.insertOne(history);
        await M.ErgazomenoiModel.collection.insertOne({ ...before.employee, _id: employeeId, kodikos: code, ypokatasthma: '0002' });
        await C.YpokatasthmataModel.collection.insertOne({ team: c.db.scope.team, companykod_object: c.db.scope.company_kod, kodikos: '0002' });
        await Period.create({ ...c.periodScope, ypokatasthma: '0002', deadline: new Date('2026-12-31'), status: 'OPEN',
            successful_calculation_version: 1, last_successful_calculation_at: new Date('2026-11-03') });
        const rows = c.rows.map(row => ({ ...row, _id: new mongoose.Types.ObjectId(), kodikos: code, ypokatasthma: '0002' }));
        await M.ProdhlomenaOrariaModel.collection.insertMany(rows);
        const context = await R.defaultContextLoader({ scope: c.scope, sourceId: String(rows[1]._id), targetId: String(rows[4]._id) });
        const projection = G.buildWeeklyRepoTransferSinglePairGroupProjection({ weekRows: context.weekRows,
            employmentProfile: context.employmentProfile, holidayByDateKey: context.holidayByDateKey,
            existingAuditCountByRowKey: new Map(), contractVersion: 'v1' });
        assert.equal(projection.projection_status, 'READY', JSON.stringify(projection.reasons));
        const group = projection.groups[0], command = { ...c.command, proposal_id: group.group_id,
            expected_source_id: String(rows[1]._id), expected_target_id: String(rows[4]._id), request_id: c.command.request_id + '-other' };
        const barrier = c.db.pauseNextReferenceClaim(), settlement = c.run();
        try {
            await bounded(barrier.reached);
            const result = await bounded(c.writer(command)); assert.equal(result.statusCode, 201, JSON.stringify(result.body));
        } finally { barrier.resume(); }
        assert.equal((await settlement).applied, true); assert.equal((await c.db.state()).audits.length, 1);
        assert.equal((await c.decisions()).length, 1);
    });
    await t.test('real decision insert failure rolls back the period and all History fences', async () => {
        const c = await setup(), before = await c.db.state(), create = Decision.create;
        Decision.create = async function (...args) { await create.apply(this, args); throw Error('GATE2_REAL_REPO_INSERT_FAILURE'); };
        let result;
        try { result = await c.writer(); } finally { Decision.create = create; }
        assert.equal(result.statusCode, 500); assert.equal((await c.decisions()).length, 0);
        assert.deepEqual(await c.db.state(), before);
        assert.equal((await Period.findOne(c.periodScope).lean()).write_fence_version, 0);
    });
});
