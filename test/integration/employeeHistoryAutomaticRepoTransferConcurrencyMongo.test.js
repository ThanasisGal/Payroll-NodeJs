'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const target = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;

test('Gate 2 automatic repo transfer real runtime decision and apply', { skip: !uri, timeout: 180000 }, async t => {
    target.assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
        disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
    const mongoose = require('mongoose');
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false, monitorCommands: true,
        appName: 'payroll-gate2-auto-repo', serverSelectionTimeoutMS: 5000 });
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
        Object.assign(rows[4], { cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '', adeia_apologistika: false, kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', repo_apologistika: false });
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
    const P = require('../../server/services/ergazomenoi/apasxoliseisPeriodControlService');
    const Runtime = require('../../server/services/ergazomenoi/apasxoliseisPossibleLeaveRepoAutoRuntimeService');
    const Approval = require('../../server/models/apasxoliseisPolicyPreviewApproval');
    const Execution = require('../../server/models/apasxoliseisWeeklyRepoTransferExecution');
    await Approval.createCollection(); await Execution.createCollection(); await Execution.createIndexes();
    await require('../../server/services/ergazomenoi/apasxoliseisWeeklyRepoTransferApplyIndexGuardService').assertWeeklyRepoTransferApplyIndexesReady();
    function pauseWrite(model, method, matches) {
        const original = model[method]; let release, reached, used = false;
        const wait = new Promise(resolve => { release = resolve; });
        const ready = new Promise(resolve => { reached = resolve; });
        model[method] = function (...args) {
            const query = original.apply(this, args);
            if (!used && matches(args[0])) {
                used = true; const exec = query.exec.bind(query);
                query.exec = async (...options) => { const value = await exec(...options); reached(); await wait; return value; };
            }
            return query;
        };
        return { reached: ready, close: () => { release(); model[method] = original; } };
    }
    async function autoSetup() {
        const c = await setup(7), calculationId = 'gate2-auto-' + c.db.employeeId;
        await P.acquirePeriodCalculationOwnership({ scope: c.periodScope, calculationId });
        const approval = await Approval.create({ team: c.db.scope.team, company_kod: c.db.scope.company_kod,
            ypokatasthma: '0001', apo_hmeromhnia: new Date('2026-11-02'), eos_hmeromhnia: new Date('2026-11-08'),
            group_id: c.first.group.group_id, group_key: c.first.group.group_key,
            decision_type: 'APPROVE_PROPOSAL', decision_status: 'RECORDED', reuse_scope: 'FUTURE_IDENTICAL', reuse_status: 'ACTIVE',
            created_by_user_id: c.db.actorUserId, created_by_user_name: 'Isolated previous HR', created_by_user_role: 'A',
            items: [{ preview_id: 'isolated-source-' + c.db.employeeId, prodhlomena_oraria_id: c.rows[1]._id,
                hmeromhnia: c.rows[1].hmeromhnia, kathgoria_ergasias: 'ΑΝ', cards_ores_ergasias: 8,
                proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } }],
            snapshot_summary: { items_count: 1, employees_count: 1, first_date: new Date('2026-11-02'), last_date: new Date('2026-11-08') }
        });
        const callbacks = Controller.__automaticRepoTransferTestHooks.automaticRepoTransferCallbacks({
            session: c.session, periodScope: c.periodScope, calculationId });
        const runAuto = (overrides = {}) => Runtime.runPossibleLeaveRepoAutoRuntime({ periodScope: c.periodScope,
            rows: c.rows, groups: [c.first.group], approvals: [approval.toObject()], appliedExecutions: [],
            ...callbacks, ...overrides });
        return { ...c, calculationId, callbacks, runAuto,
            executions: () => Execution.find({ team: c.db.scope.team, company_kod: c.db.scope.company_kod }).lean() };
    }
    await t.test('real automatic runtime creates and applies exactly one valid pair', async () => {
        const c = await autoSetup(), before = await c.db.state(); const result = await c.runAuto();
        assert.equal(result.results[0].status, 'AUTO_APPLIED', JSON.stringify(result));
        assert.equal((await c.decisions()).length, 1); assert.equal((await c.executions()).length, 1);
        const after = await c.db.state(); assert.deepEqual(after.employee, before.employee);
        assert.deepEqual(after.history.map(business), before.history.map(business)); assert.equal(after.audits.length, 0);
        for (const row of after.history) assert.equal(row.history_reference_fence, 1);
        assert.equal((await Period.findOne(c.periodScope).lean()).write_fence_version, 2);
    });
    await t.test('regression: automatic decision must reject a source change after reconstruction', async () => {
        const c = await autoSetup();
        const barrier = pauseWrite(Period, 'findOneAndUpdate', f => f.company_kod === c.db.scope.company_kod);
        const pending = c.runAuto();
        try { await bounded(barrier.reached); await changeSource(c); } finally { barrier.close(); }
        await assert.rejects(pending, e => e.code === 'REPO_DECISION_INPUT_CHANGED');
        assert.equal((await c.decisions()).length, 0); assert.equal((await c.executions()).length, 0);
    });
    for (const change of ['source', 'target', 'history', 'protected-reference', 'period', 'ownership']) await t.test(`decision to apply gap: ${change} changes are rejected without partial application`, async () => {
        const c = await autoSetup(); let expectedRows;
        const pending = c.runAuto({ applyDecision: async args => {
            assert.equal((await c.decisions()).length, 1);
            if (change === 'source') await changeSource(c);
            if (change === 'target') await M.ProdhlomenaOrariaModel.collection.updateOne({ _id: c.rows[4]._id }, { $set: { apo_ora_01: '09:00', eos_ora_01: '17:00' } });
            if (change === 'history') {
                const state = await c.db.state();
                await M.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: state.history[0]._id }, { $set: { ores_ergasias_ebdomadas: 39 } });
            }
            if (change === 'protected-reference') await Decision.collection.updateOne({ team: c.db.scope.team,
                company_kod: c.db.scope.company_kod }, { $set: {
                'canonical_snapshot.employment_profile.history.1.id': String(new mongoose.Types.ObjectId()) } });
            if (change === 'period') await Period.collection.updateOne(c.periodScope, { $set: { status: 'LOCKED' } });
            if (change === 'ownership') await Period.collection.updateOne(c.periodScope, { $set: { active_calculation_id: 'different-calculation-owner' } });
            expectedRows = await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).sort({ _id: 1 }).toArray();
            return c.callbacks.applyDecision(args);
        } });
        await assert.rejects(pending, e => ['STALE_FINGERPRINT', 'REPO_DECISION_INPUT_CHANGED', 'PERIOD_CONTROL_CALCULATION_OWNERSHIP_LOST'].includes(e.code));
        assert.equal((await c.executions()).length, 0); assert.equal((await c.decisions()).length, 1);
        assert.deepEqual(await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).sort({ _id: 1 }).toArray(), expectedRows);
        assert.equal(await M.ProdhlomenaOrariaAuditModel.countDocuments({ team: c.db.scope.team, company_kod: c.db.scope.company_kod }), 0);
        assert.equal((await c.db.state()).audits.length, 0);
    });
    await t.test('automatic writer first: real decision addition conflicts with Settlement; apply is separately serialized', async () => {
        const c = await autoSetup(), before = await c.db.state(), barrier = c.db.pauseNextEmployeeRead(), start = conflicts.length;
        const settlement = assert.rejects(c.run(), e => e.code === S.PREFIX + 'STALE');
        try {
            await bounded(barrier.reached);
            const result = await c.runAuto({ applyDecision: async args => {
                barrier.resume(); await settlement;
                return c.callbacks.applyDecision(args);
            } });
            assert.equal(result.results[0].status, 'AUTO_APPLIED');
        } finally { barrier.resume(); }
        assert.ok(conflicts.length > start); assert.ok(c.db.transactionCallbacks() >= 2);
        const after = await c.db.state(); assert.deepEqual(after.employee, before.employee); assert.equal(after.audits.length, 0);
        assert.equal((await c.decisions()).length, 1); assert.equal((await c.executions()).length, 1);
        assert.deepEqual(after.references, before.references);
        assert.deepEqual(after.history.map(business), before.history.map(business));
    });
    await t.test('Settlement first: automatic decision conflicts and revalidates on callback retry', async () => {
        const c = await autoSetup(), before = await c.db.state(), barrier = c.db.pauseNextReferenceClaim();
        let listener;
        const failed = new Promise(resolve => { listener = e => { if (e.failure?.code === 112) resolve(); }; });
        client.on('commandFailed', listener); const settlement = c.run(); let automatic;
        const start = commands.length;
        try { await bounded(barrier.reached); automatic = assert.rejects(c.runAuto(), e => e.code === 'REPO_DECISION_INPUT_CHANGED'); await bounded(failed); }
        finally { barrier.resume(); client.off('commandFailed', listener); }
        assert.equal((await settlement).applied, true); await automatic;
        assert.equal((await c.decisions()).length, 0); assert.equal((await c.executions()).length, 0);
        const reloaded = commands.slice(start).filter(e => e.commandName === 'find' && e.command.find === M.ProdhlomenaOrariaModel.collection.name && e.command.filter?._id?.$in && e.command.autocommit === false);
        assert.ok(reloaded.length >= 2);
        const after = await c.db.state(); assert.equal(after.audits.length, 1);
        assert.equal(after.employee.employee_profile_mutation_sequence, (before.employee.employee_profile_mutation_sequence || 0) + 1);
        for (const old of before.history) assert.deepEqual(business(after.history.find(row => String(row._id) === String(old._id))), business(old));
        const fresh = await c.runAuto(); assert.equal(fresh.results[0].status, 'AUTO_APPLIED');
        const final = await c.db.state(); assert.equal(final.audits.length, 1);
        assert.equal(final.employee.employee_profile_mutation_sequence, after.employee.employee_profile_mutation_sequence);
    });
    await t.test('nonrepresentative reference BSON change between stages is preserved and old Settlement approval is rejected', async () => {
        const c = await autoSetup(); let changed;
        const result = await c.runAuto({ applyDecision: async args => {
            const old = (await c.db.state()).references[6];
            await mongoose.connection.collection('Apasxoliseis_Period_Frozen_Snapshots').updateOne({ _id: old._id }, { $set: { 'frozen_snapshot.amount': 999 } });
            changed = (await c.db.state()).references;
            return c.callbacks.applyDecision(args);
        } });
        assert.equal(result.results[0].status, 'AUTO_APPLIED'); assert.deepEqual((await c.db.state()).references, changed);
        await assert.rejects(c.run, e => e.code === S.PREFIX + 'STALE'); assert.equal((await c.db.state()).audits.length, 0);
    });
    await t.test('regression: History changes after apply preflight cannot commit an old decision', async () => {
        const c = await autoSetup(); let writes = 0;
        const barrier = pauseWrite(Period, 'findOneAndUpdate', f => f.company_kod === c.db.scope.company_kod && ++writes === 2);
        const pending = c.runAuto();
        try { await bounded(barrier.reached); const state = await c.db.state();
            await M.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: state.history[0]._id }, { $set: { ores_ergasias_ebdomadas: 39 } });
        } finally { barrier.close(); }
        await assert.rejects(pending, e => e.code === 'STALE_FINGERPRINT');
        assert.equal((await c.executions()).length, 0);
    });
    await t.test('same automatic request ids are idempotent and an uncertain apply commit does not apply twice', async () => {
        const c = await autoSetup(), before = await c.db.state(); let decisionArgs, applyArgs, uncertain = 0;
        const observed = e => { if (e.commandName === 'commitTransaction' && e.reply?.writeConcernError?.code === 64) uncertain++; };
        client.on('commandSucceeded', observed); const admin = mongoose.connection.db.admin();
        let result;
        try {
            result = await c.runAuto({ createDecision: async args => { decisionArgs = args; return c.callbacks.createDecision(args); },
                applyDecision: async args => { applyArgs = args;
                    await admin.command({ configureFailPoint: 'failCommand', mode: { times: 1 }, data: {
                        failCommands: ['commitTransaction'], appName: 'payroll-gate2-auto-repo',
                        writeConcernError: { code: 64, errmsg: 'isolated automatic apply commit uncertainty' },
                        errorLabels: ['UnknownTransactionCommitResult'] } });
                    return c.callbacks.applyDecision(args);
                } });
        } finally { await admin.command({ configureFailPoint: 'failCommand', mode: 'off' }); client.off('commandSucceeded', observed); }
        assert.equal(result.results[0].status, 'AUTO_APPLIED'); assert.equal(uncertain, 1);
        const savedRows = await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).sort({ _id: 1 }).toArray();
        const decision = await c.callbacks.createDecision(decisionArgs), execution = await c.callbacks.applyDecision(applyArgs);
        assert.equal(decision.id, result.results[0].decision.id); assert.equal(execution.id, result.results[0].execution.id);
        await assert.rejects(() => c.callbacks.createDecision({ ...decisionArgs, command: { ...decisionArgs.command, notes: 'different request content' } }),
            e => e.code === 'REPO_DECISION_REQUEST_ID_CONFLICT');
        assert.equal((await c.decisions()).length, 1); assert.equal((await c.executions()).length, 1);
        assert.equal(await M.ProdhlomenaOrariaAuditModel.countDocuments({ team: c.db.scope.team, company_kod: c.db.scope.company_kod }), 2);
        assert.deepEqual(await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).sort({ _id: 1 }).toArray(), savedRows);
        assert.deepEqual((await c.db.state()).employee, before.employee); assert.equal((await c.db.state()).audits.length, 0);
        const replay = await c.runAuto({ appliedExecutions: await c.executions() }); assert.equal(replay.results[0].status, 'ALREADY_APPLIED');
    });
    await t.test('calculation ownership lost before decision transaction prevents any decision', async () => {
        const c = await autoSetup(); let reads = 0;
        const barrier = pauseRead(A.ArgiesModel, 'find', f => f.company_kod === c.session.companyKodikos && ++reads === 2);
        const pending = c.runAuto();
        try { await bounded(barrier.reached); await Period.collection.updateOne(c.periodScope,
            { $set: { active_calculation_id: 'replacement-calculation-owner' } }); } finally { barrier.close(); }
        await assert.rejects(pending, e => e.code === 'PERIOD_CONTROL_CALCULATION_OWNERSHIP_LOST');
        assert.equal((await c.decisions()).length, 0); assert.equal((await c.executions()).length, 0);
    });
    await t.test('existing schedule versions survive temporary claims and increase only once on apply', async () => {
        const c = await autoSetup(); await M.ProdhlomenaOrariaModel.collection.updateMany(c.db.scope, { $set: { __v: 7 } });
        const result = await c.runAuto(); assert.equal(result.results[0].status, 'AUTO_APPLIED');
        const rows = await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).toArray();
        for (const row of rows) assert.equal(row.__v, [String(c.rows[1]._id), String(c.rows[4]._id)].includes(String(row._id)) ? 8 : 7);
    });
    await t.test('independent automatic employee in same company progresses while Settlement holds the first employee', async () => {
        const c = await autoSetup(), state = await c.db.state(), code = c.db.scope.kodikos + '-independent';
        const employee = { ...state.employee, _id: new mongoose.Types.ObjectId(), kodikos: code, ypokatasthma: '0002' };
        const history = { ...state.history.at(-1), _id: new mongoose.Types.ObjectId(), kodikos: code };
        await M.ErgazomenoiModel.collection.insertOne(employee); await M.IstorikoProslhpseonAllagonModel.collection.insertOne(history);
        const rows = c.rows.map(row => ({ ...row, _id: new mongoose.Types.ObjectId(), kodikos: code, ypokatasthma: '0002' }));
        await M.ProdhlomenaOrariaModel.collection.insertMany(rows);
        const periodScope = { ...c.periodScope, ypokatasthma: '0002' };
        await P.acquirePeriodCalculationOwnership({ scope: periodScope, calculationId: c.calculationId });
        const context = await R.defaultContextLoader({ scope: c.scope, sourceId: String(rows[1]._id), targetId: String(rows[4]._id) });
        const projection = G.buildWeeklyRepoTransferSinglePairGroupProjection({ weekRows: context.weekRows,
            employmentProfile: context.employmentProfile, holidayByDateKey: context.holidayByDateKey,
            existingAuditCountByRowKey: new Map(), contractVersion: 'v1' });
        assert.equal(projection.projection_status, 'READY', JSON.stringify(projection.reasons));
        const approval = (await Approval.findOne({ company_kod: c.db.scope.company_kod }).lean());
        const otherApproval = await Approval.create({ ...approval, _id: new mongoose.Types.ObjectId(), ypokatasthma: '0002',
            items: [{ ...approval.items[0], prodhlomena_oraria_id: rows[1]._id }] });
        const callbacks = Controller.__automaticRepoTransferTestHooks.automaticRepoTransferCallbacks({ session: c.session,
            periodScope, calculationId: c.calculationId });
        const barrier = c.db.pauseNextReferenceClaim(), settlement = c.run();
        try { await bounded(barrier.reached);
            const result = await bounded(Runtime.runPossibleLeaveRepoAutoRuntime({ rows, groups: projection.groups,
                approvals: [otherApproval.toObject()], appliedExecutions: [], periodScope, ...callbacks }));
            assert.equal(result.results[0].status, 'AUTO_APPLIED', JSON.stringify(result));
        } finally { barrier.resume(); }
        assert.equal((await settlement).applied, true); assert.equal((await c.db.state()).audits.length, 1);
    });
});
