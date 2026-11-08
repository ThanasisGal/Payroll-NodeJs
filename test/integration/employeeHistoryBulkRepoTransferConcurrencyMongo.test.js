'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const target = require('../fixtures/employeeHistorySettlementMongoTarget');
const uri = process.env.PAYROLL_SETTLEMENT_TEST_MONGO_URI;

test('Gate 2 bulk SAFE_PAIR_TRANSFER real transactions', { skip: !uri, timeout: 180000 }, async t => {
    target.assertMongoTarget({ uri, ci: process.env.GITHUB_ACTIONS,
        disposable: process.env.PAYROLL_SETTLEMENT_TEST_DISPOSABLE, job: process.env.GITHUB_JOB });
    const mongoose = require('mongoose');
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false, monitorCommands: true,
        appName: 'payroll-gate2-bulk-repo', serverSelectionTimeoutMS: 5000 });
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
    const Execution = require('../../server/models/apasxoliseisWeeklyRepoTransferExecution');
    await Execution.createCollection(); await Execution.createIndexes();
    const P = require('../../server/services/ergazomenoi/apasxoliseisPeriodControlService');
    const Bulk = require('../../server/services/ergazomenoi/apasxoliseisWeeklyHrWorkflowStage2BulkCompletionService');
    const Preview = require('../../server/services/ergazomenoi/apasxoliseisWeeklyHrStage2BulkPreviewService');
    const complete = Controller.__bulkSafePairTransferTestHooks.completeBulkSafePairTransfer;
    async function bulkSetup() { return prepareBulk(await setup(7)); }
    async function prepareBulk(c) {
        const freshRows = await M.ProdhlomenaOrariaModel.find(c.db.scope).lean();
        const context = { scope: { employee_id: c.db.employeeId, employee_kodikos: c.db.scope.kodikos,
            week_start: '2026-11-02', week_end: '2026-11-08' }, rows: freshRows, period_writable: true,
            lifecycle: { stages: { stage2: { has_transferable_pair: true, has_bounded_selection: true,
                pending_count: 1, pending_items: [{}], blockers: [] } } },
            preparedStage2Pair: c.first, preparedStage2Record: { current_proposal: { command: c.command },
                current_proposal_fingerprint: c.first.fingerprint, runtime_enabled: true, index_ready: true } };
        const prepared = { freshRowsById: new Map(freshRows.map(row => [String(row._id), row])),
            contexts: [context], periodAccess: { scope: c.periodScope }, decisionByRequestId: new Map(),
            decisionByProposalIdentity: new Map(), decisionById: new Map(), executionByRequestId: new Map(),
            executionByDecisionId: new Map() };
        const invoke = (options = {}) => complete({ session: c.session, prepared, context,
            request_id: c.command.request_id, reason_or_notes: c.command.notes, ...options });
        return { ...c, context, prepared, invoke,
            executions: () => Execution.find({ team: c.db.scope.team, company_kod: c.db.scope.company_kod }).lean() };
    }
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
    await t.test('regression: changed source after preparation must not create stale decision', async () => {
        const c = await bulkSetup(); await changeSource(c);
        await assert.rejects(c.invoke, e => e.code === 'REPO_DECISION_INPUT_CHANGED');
        assert.equal((await c.decisions()).length, 0); assert.equal((await c.executions()).length, 0);
    });
    await t.test('regression: History changed after preparation must not apply stale snapshot', async () => {
        const c = await bulkSetup(), before = await c.db.state();
        await M.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: before.history[0]._id },
            { $set: { ores_ergasias_ebdomadas: 39 } });
        await assert.rejects(c.invoke, e => ['REPO_DECISION_INPUT_CHANGED', 'STALE_FINGERPRINT'].includes(e.code));
        assert.equal((await c.decisions()).length, 0); assert.equal((await c.executions()).length, 0);
    });
    await t.test('regression: History changes after decision and apply snapshot must be rejected', async () => {
        const c = await bulkSetup(); let writes = 0;
        const barrier = pauseWrite(Period, 'findOneAndUpdate', f => f.company_kod === c.db.scope.company_kod && ++writes === 2);
        const pending = c.invoke();
        try { await bounded(barrier.reached); const state = await c.db.state();
            await M.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: state.history[0]._id },
                { $set: { ores_ergasias_ebdomadas: 39 } });
        } finally { barrier.close(); }
        await assert.rejects(pending, e => e.code === 'STALE_FINGERPRINT');
        assert.equal((await c.decisions()).length, 1); assert.equal((await c.executions()).length, 0);
    });

    // Pause only session allocation. All subsequent reads/writes use the actual
    // models, native driver callback and MongoDB transaction.
    function pauseSession(number = 2) {
        const connection = mongoose.connection, original = connection.startSession;
        let count = 0, reached, release;
        const ready = new Promise(resolve => { reached = resolve; });
        const wait = new Promise(resolve => { release = resolve; });
        connection.startSession = async function (...args) {
            const session = await original.apply(this, args);
            if (++count === number) { reached(); await wait; }
            return session;
        };
        return { reached: ready, close() { release(); connection.startSession = original; } };
    }
    async function noApply(c) {
        assert.equal((await c.executions()).length, 0);
        assert.equal(await M.ProdhlomenaOrariaAuditModel.countDocuments({ team: c.db.scope.team,
            company_kod: c.db.scope.company_kod }), 0);
        assert.equal((await c.db.state()).audits.length, 0);
    }
    await t.test('valid bulk pair uses transactional reads despite poisoned preloaded rows', async () => {
        const c = await bulkSetup(), before = await c.db.state(), start = commands.length;
        // A fake lock in the preview must never replace the real transactional read.
        c.prepared.freshRowsById.get(String(c.rows[1]._id)).is_locked = true;
        assert.equal((await c.invoke()).completed, true);
        assert.equal((await c.decisions()).length, 1); assert.equal((await c.executions()).length, 1);
        const after = await c.db.state(); assert.deepEqual(after.employee, before.employee);
        assert.deepEqual(after.history.map(business), before.history.map(business)); assert.equal(after.audits.length, 0);
        for (const row of after.history) assert.equal(row.history_reference_fence, 1);
        const reads = commands.slice(start).filter(e => e.commandName === 'find' && e.command.autocommit === false);
        assert.ok(reads.filter(e => e.command.find === M.ProdhlomenaOrariaModel.collection.name).length >= 6);
        assert.equal((await Period.findOne(c.periodScope).lean()).write_fence_version, 2);
    });
    for (const change of ['target', 'nonpair-week-row', 'period']) await t.test(`prepared decision rejects ${change} change`, async () => {
        const c = await bulkSetup();
        if (change === 'target') await M.ProdhlomenaOrariaModel.collection.updateOne({ _id: c.rows[4]._id }, { $set: { apo_ora_01: '09:00' } });
        if (change === 'nonpair-week-row') await M.ProdhlomenaOrariaModel.collection.updateOne({ _id: c.rows[2]._id }, { $set: { kathgoria_ergasias: 'ΑΝ' } });
        if (change === 'period') await Period.collection.updateOne(c.periodScope, { $set: { status: 'LOCKED' } });
        await assert.rejects(c.invoke, e => ['REPO_DECISION_INPUT_CHANGED', 'REPO_PROPOSAL_NOT_AVAILABLE', 'PERIOD_CONTROL_STATE_CONFLICT'].includes(e.code));
        assert.equal((await c.decisions()).length, 0); await noApply(c);
    });
    for (const change of ['source', 'target', 'history', 'period', 'decision-reference']) await t.test(`decision to apply gap rejects ${change}`, async () => {
        const c = await bulkSetup(), barrier = pauseSession(); const pending = c.invoke();
        let rows;
        try { await bounded(barrier.reached); assert.equal((await c.decisions()).length, 1);
            if (change === 'source') await changeSource(c);
            if (change === 'target') await M.ProdhlomenaOrariaModel.collection.updateOne({ _id: c.rows[4]._id }, { $set: { apo_ora_01: '09:00' } });
            if (change === 'history') {
                const state = await c.db.state();
                await M.IstorikoProslhpseonAllagonModel.collection.updateOne({ _id: state.history[0]._id }, { $set: { ores_ergasias_ebdomadas: 39 } });
            }
            if (change === 'period') await Period.collection.updateOne(c.periodScope, { $set: { status: 'LOCKED' } });
            if (change === 'decision-reference') await Decision.collection.updateOne({ team: c.db.scope.team, company_kod: c.db.scope.company_kod },
                { $set: { 'canonical_snapshot.employment_profile.history.1.id': String(new mongoose.Types.ObjectId()) } });
            rows = await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).sort({ _id: 1 }).toArray();
        } finally { barrier.close(); }
        await assert.rejects(pending, e => ['STALE_FINGERPRINT', 'REPO_DECISION_INPUT_CHANGED', 'PERIOD_CONTROL_STATE_CONFLICT'].includes(e.code));
        await noApply(c);
        assert.deepEqual(await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).sort({ _id: 1 }).toArray(), rows);
    });
    await t.test('bulk writer first: Settlement conflicts, retries and rejects old v2 approval', async () => {
        const c = await bulkSetup(), before = await c.db.state(), barrier = c.db.pauseNextEmployeeRead(), start = conflicts.length;
        const settlement = assert.rejects(c.run(), e => e.code === S.PREFIX + 'STALE');
        try { await bounded(barrier.reached); assert.equal((await c.invoke()).completed, true); }
        finally { barrier.resume(); }
        await settlement; assert.ok(conflicts.length > start); assert.ok(c.db.transactionCallbacks() >= 2);
        const after = await c.db.state(); assert.equal(after.audits.length, 0);
        assert.deepEqual(after.employee, before.employee); assert.deepEqual(after.references, before.references);
        assert.deepEqual(after.history.map(business), before.history.map(business));
    });
    await t.test('Settlement first: bulk real WriteConflict retries and rejects stale prepared pair', async () => {
        const c = await bulkSetup(), before = await c.db.state(), barrier = c.db.pauseNextReferenceClaim();
        let listener;
        const failed = new Promise(resolve => { listener = e => { if (e.failure?.code === 112) resolve(); }; });
        client.on('commandFailed', listener); const settlement = c.run(); let bulk;
        const start = commands.length;
        try { await bounded(barrier.reached); bulk = assert.rejects(c.invoke(), e => e.code === 'REPO_DECISION_INPUT_CHANGED'); await bounded(failed); }
        finally { barrier.resume(); client.off('commandFailed', listener); }
        assert.equal((await settlement).applied, true); await bulk;
        assert.equal((await c.decisions()).length, 0); assert.equal((await c.executions()).length, 0);
        const reads = commands.slice(start).filter(e => e.commandName === 'find' && e.command.find === M.ProdhlomenaOrariaModel.collection.name && e.command.filter?._id?.$in && e.command.autocommit === false);
        assert.ok(reads.length >= 2);
        const after = await c.db.state(); assert.equal(after.audits.length, 1);
        assert.equal(after.employee.employee_profile_mutation_sequence, (before.employee.employee_profile_mutation_sequence || 0) + 1);
        assert.deepEqual(after.references, before.references);
    });
    await t.test('protected nonrepresentative BSON update survives bulk and invalidates old Settlement approval', async () => {
        const c = await bulkSetup(), barrier = pauseSession(); const pending = c.invoke(); let changed;
        try { await bounded(barrier.reached);
            const old = (await c.db.state()).references[6];
            await mongoose.connection.collection('Apasxoliseis_Period_Frozen_Snapshots').updateOne({ _id: old._id }, { $set: { 'frozen_snapshot.amount': 999 } });
            changed = (await c.db.state()).references;
        } finally { barrier.close(); }
        assert.equal((await pending).completed, true); assert.deepEqual((await c.db.state()).references, changed);
        await assert.rejects(c.run, e => e.code === S.PREFIX + 'STALE');
    });
    await t.test('new protected reference between decision and apply is preserved and old approval rejected', async () => {
        const c = await bulkSetup(), barrier = pauseSession(); const pending = c.invoke(); let changed;
        try { await bounded(barrier.reached);
            const state = await c.db.state(), old = state.references[0];
            await c.db.addReference(old.frozen_snapshot.daily_results[0].effective_profile_istoriko_id);
            changed = (await c.db.state()).references;
        } finally { barrier.close(); }
        assert.equal((await pending).completed, true); assert.deepEqual((await c.db.state()).references, changed);
        await assert.rejects(c.run, e => e.code === S.PREFIX + 'STALE');
    });

    await t.test('same bulk request same command replays without duplicate audit or mutations', async () => {
        const c = await bulkSetup(), before = await c.db.state(); await c.invoke();
        const rows = await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).sort({ _id: 1 }).toArray();
        assert.equal((await c.invoke()).idempotent, true);
        await assert.rejects(() => c.invoke({ reason_or_notes: 'different content' }), e => e.code === 'REPO_DECISION_REQUEST_ID_CONFLICT');
        assert.equal((await c.decisions()).length, 1); assert.equal((await c.executions()).length, 1);
        assert.equal(await M.ProdhlomenaOrariaAuditModel.countDocuments({ team: c.db.scope.team, company_kod: c.db.scope.company_kod }), 2);
        assert.deepEqual(await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).sort({ _id: 1 }).toArray(), rows);
        assert.deepEqual((await c.db.state()).employee, before.employee);
    });
    await t.test('regression: existing decision shortcut must reject request id with different command', async () => {
        const c = await bulkSetup(); await c.invoke();
        c.context.preparedStage2Record.current_decision = (await c.decisions())[0];
        await assert.rejects(() => c.invoke({ reason_or_notes: 'different content' }), e => e.code === 'REPO_DECISION_REQUEST_ID_CONFLICT');
    });
    await t.test('decision snapshot race produces real WriteConflict and revalidates on driver retry', async () => {
        const c = await bulkSetup(), start = commands.length, conflictsBefore = conflicts.length;
        const barrier = pauseWrite(Period, 'findOneAndUpdate', f => f.company_kod === c.db.scope.company_kod);
        const pending = c.invoke();
        try { await bounded(barrier.reached); await changeSource(c); } finally { barrier.close(); }
        await assert.rejects(pending, e => e.code === 'REPO_DECISION_INPUT_CHANGED');
        assert.ok(conflicts.length > conflictsBefore); assert.equal((await c.decisions()).length, 0); await noApply(c);
        assert.ok(commands.slice(start).filter(e => e.commandName === 'find' && e.command.find === M.ProdhlomenaOrariaModel.collection.name && e.command.filter?._id?.$in && e.command.autocommit === false).length >= 2);
    });
    await t.test('real unknown apply commit is retried once without duplicate application', async () => {
        const c = await bulkSetup(), before = await c.db.state(), barrier = pauseSession(); let uncertain = 0;
        const observer = e => { if (e.commandName === 'commitTransaction' && e.reply?.writeConcernError?.code === 64) uncertain++; };
        client.on('commandSucceeded', observer); const admin = mongoose.connection.db.admin();
        const pending = c.invoke(); let result;
        try { await bounded(barrier.reached);
            await admin.command({ configureFailPoint: 'failCommand', mode: { times: 1 }, data: {
                failCommands: ['commitTransaction'], appName: 'payroll-gate2-bulk-repo',
                writeConcernError: { code: 64, errmsg: 'isolated bulk apply uncertainty' }, errorLabels: ['UnknownTransactionCommitResult'] } });
            barrier.close(); result = await pending;
        } finally { barrier.close(); await admin.command({ configureFailPoint: 'failCommand', mode: 'off' }); client.off('commandSucceeded', observer); }
        assert.equal(result.completed, true); assert.equal(uncertain, 1);
        assert.equal((await c.decisions()).length, 1); assert.equal((await c.executions()).length, 1);
        assert.equal(await M.ProdhlomenaOrariaAuditModel.countDocuments({ team: c.db.scope.team, company_kod: c.db.scope.company_kod }), 2);
        assert.deepEqual((await c.db.state()).employee, before.employee);
        assert.equal((await c.invoke()).idempotent, true);
    });
    await t.test('lost application acknowledgement after real apply commit recovers by request', async () => {
        const c = await bulkSetup(), connection = mongoose.connection, original = connection.startSession;
        let sessions = 0, lost = 0;
        connection.startSession = async function (...args) {
            const session = await original.apply(this, args);
            if (++sessions === 2) {
                const withTransaction = session.withTransaction.bind(session);
                session.withTransaction = async (...options) => {
                    await withTransaction(...options); lost++;
                    throw Object.assign(Error('ISOLATED_COMMIT_ACK_LOST'), { errorLabels: ['UnknownTransactionCommitResult'] });
                };
            }
            return session;
        };
        let result; try { result = await c.invoke(); } finally { connection.startSession = original; }
        assert.equal(result.completed, true); assert.equal(result.idempotent, true); assert.equal(lost, 1);
        assert.equal((await c.invoke()).idempotent, true);
        assert.equal((await c.decisions()).length, 1); assert.equal((await c.executions()).length, 1);
        assert.equal(await M.ProdhlomenaOrariaAuditModel.countDocuments({ team: c.db.scope.team, company_kod: c.db.scope.company_kod }), 2);
    });

    await t.test('existing approved decision is applied once and existing successful execution replays', async () => {
        const c = await bulkSetup(); const response = await c.writer(); assert.equal(response.statusCode, 201);
        const decision = (await c.decisions())[0];
        c.context.preparedStage2Record.current_decision = { id: String(decision._id), decision_code: 'APPROVE_PROPOSAL' };
        c.prepared.decisionById.set(String(decision._id), decision);
        c.prepared.decisionByRequestId.set(decision.request_id, decision);
        c.prepared.decisionByProposalIdentity.set(decision.snapshot_fingerprint, decision);
        assert.equal((await c.invoke()).completed, true);
        const execution = (await c.executions())[0];
        c.prepared.executionByRequestId.set(execution.request_id, execution);
        c.prepared.executionByDecisionId.set(String(decision._id), execution);
        assert.equal((await c.invoke()).idempotent, true);
        assert.equal((await c.decisions()).length, 1); assert.equal((await c.executions()).length, 1);
        assert.equal(await M.ProdhlomenaOrariaAuditModel.countDocuments({ team: c.db.scope.team, company_kod: c.db.scope.company_kod }), 2);
    });
    async function secondEmployee(c) {
        const state = await c.db.state(), scope = { ...c.db.scope, kodikos: c.db.scope.kodikos + '-second' };
        const employee = { ...state.employee, ...scope, _id: new mongoose.Types.ObjectId() };
        const ids = new Map(state.history.map(row => [String(row._id), new mongoose.Types.ObjectId()]));
        const history = state.history.map(row => ({ ...row, ...scope, _id: ids.get(String(row._id)),
            ...(row.employment_history_canonical_survivor_id ? { employment_history_canonical_survivor_id: ids.get(String(row.employment_history_canonical_survivor_id)) } : {}) }));
        await M.ErgazomenoiModel.collection.insertOne(employee);
        await M.IstorikoProslhpseonAllagonModel.collection.insertMany(history);
        const rows = c.rows.map(row => ({ ...row, ...scope, _id: new mongoose.Types.ObjectId() }));
        await M.ProdhlomenaOrariaModel.collection.insertMany(rows);
        const context = await R.defaultContextLoader({ scope: c.scope, sourceId: String(rows[1]._id), targetId: String(rows[4]._id) });
        const projection = G.buildWeeklyRepoTransferSinglePairGroupProjection({ weekRows: context.weekRows,
            employmentProfile: context.employmentProfile, holidayByDateKey: context.holidayByDateKey,
            existingAuditCountByRowKey: new Map(), contractVersion: 'v1' });
        assert.equal(projection.projection_status, 'READY'); const group = projection.groups[0];
        const command = { ...c.command, proposal_id: group.group_id, expected_source_id: String(rows[1]._id),
            expected_target_id: String(rows[4]._id), request_id: c.command.request_id + '-second' };
        const first = await R.reconstructWeeklyRepoTransferDecision({ scope: c.scope, command });
        return prepareBulk({ ...c, db: { scope, employeeId: String(employee._id) }, rows, command, first });
    }
    for (const failSecond of [false, true]) await t.test(`real bulk same company two employees: second failure=${failSecond}`, async () => {
        const c = await bulkSetup(), other = await secondEmployee(c), before = await c.db.state();
        const contexts = [c.context, other.context], preview = Preview.buildWeeklyHrStage2BulkPreview({ contexts });
        assert.equal(preview.safe_bulk_count, 2);
        // Use one shared batch with all real prepared maps, as the controller does.
        const prepared = c.prepared; prepared.contexts = contexts;
        for (const [id, row] of other.prepared.freshRowsById) prepared.freshRowsById.set(id, row);
        if (failSecond) await changeSource(other);
        const batchScopes = contexts.map(ctx => preview.safe_scope_ids.find(item => item.employee_id === ctx.scope.employee_id));
        const batch = await Bulk.completeWeeklyHrWorkflowStage2Bulk({
            period_start: '2026-11-01', period_end: '2026-11-30', ypokatasthma: '0001',
            bulk_request_id: 'gate2-bulk-' + c.db.employeeId, reason_or_notes: c.command.notes,
            expected_preview_fingerprint: preview.preview_fingerprint, actor: { role: 'A' },
            batch_scopes: batchScopes, loadPreparedContexts: async () => contexts,
            completePreparedScope: args => complete({ session: c.session, prepared, ...args }) });
        assert.equal(batch.applied, failSecond ? 1 : 2); assert.equal(batch.failed, failSecond ? 1 : 0);
        assert.equal((await c.decisions()).length, failSecond ? 1 : 2);
        assert.equal((await c.executions()).length, failSecond ? 1 : 2);
        assert.equal(await M.ProdhlomenaOrariaAuditModel.countDocuments({ team: c.db.scope.team, company_kod: c.db.scope.company_kod }), failSecond ? 2 : 4);
        assert.deepEqual((await c.db.state()).employee, before.employee);
        if (failSecond) {
            assert.equal(batch.result_details[0].code, 'REPO_DECISION_INPUT_CHANGED');
            assert.equal(await Execution.countDocuments({ employee_id: other.db.employeeId }), 0);
            assert.equal(await Decision.countDocuments({ employee_id: c.db.employeeId }), 1);
        }
    });

    await t.test('regression: lost decision acknowledgement recovers and completes on request replay', async () => {
        const c = await bulkSetup(), connection = mongoose.connection, original = connection.startSession;
        let first = true;
        connection.startSession = async function (...args) {
            const session = await original.apply(this, args);
            if (first) { first = false; const withTransaction = session.withTransaction.bind(session);
                session.withTransaction = async (...options) => { await withTransaction(...options);
                    throw Object.assign(Error('ISOLATED_DECISION_ACK_LOST'), { code: 'ISOLATED_DECISION_ACK_LOST' }); };
            }
            return session;
        };
        try { await assert.rejects(c.invoke, e => e.code === 'ISOLATED_DECISION_ACK_LOST'); }
        finally { connection.startSession = original; }
        assert.equal((await c.decisions()).length, 1); assert.equal((await c.executions()).length, 0);
        assert.equal((await c.invoke()).completed, true);
        assert.equal((await c.decisions()).length, 1); assert.equal((await c.executions()).length, 1);
        assert.equal(await M.ProdhlomenaOrariaAuditModel.countDocuments({ team: c.db.scope.team, company_kod: c.db.scope.company_kod }), 2);
    });

    async function approvedBulkSetup() {
        const c = await bulkSetup(); assert.equal((await c.writer()).statusCode, 201);
        const decision = (await c.decisions())[0];
        c.context.preparedStage2Record.current_decision = { id: String(decision._id), decision_code: 'APPROVE_PROPOSAL' };
        c.prepared.decisionById.set(String(decision._id), decision);
        c.prepared.decisionByRequestId.set(decision.request_id, decision);
        c.prepared.decisionByProposalIdentity.set(decision.snapshot_fingerprint, decision);
        // This approval includes the already committed Decision. These two
        // schedules therefore race with actual apply, not decision insertion.
        const input = await c.db.approvalInput();
        const fingerprint = S.buildEmployeeHistorySettlementApprovalFingerprint({ ...input, proposal: U.buildCoordinatedSettlementProposal(input) });
        const settle = () => W.applyEmployeeEmploymentHistorySettlementInSyntheticStore({ syntheticStore: c.db.handle,
            scope: c.db.scope, employeeId: c.db.employeeId, actorUserId: c.db.actorUserId, coordinated: true,
            approval: { confirmed: true, fingerprint } });
        return { ...c, settle };
    }
    await t.test('actual apply first: Settlement retries and fully rechecks unchanged reference evidence v2', async () => {
        const c = await approvedBulkSetup(), before = await c.db.state(), barrier = c.db.pauseNextEmployeeRead(), start = conflicts.length;
        const settlement = c.settle();
        try { await bounded(barrier.reached); assert.equal((await bounded(c.invoke())).completed, true); }
        finally { barrier.resume(); }
        assert.equal((await settlement).applied, true);
        assert.ok(conflicts.length > start); assert.ok(c.db.transactionCallbacks() >= 2);
        assert.equal((await c.executions()).length, 1); assert.equal((await c.decisions()).length, 1);
        const after = await c.db.state(); assert.equal(after.audits.length, 1);
        assert.equal(after.employee.employee_profile_mutation_sequence, (before.employee.employee_profile_mutation_sequence || 0) + 1);
        assert.deepEqual(after.references, before.references);
    });
    await t.test('Settlement first versus actual apply: driver retry rejects old decision, fresh pair then succeeds', async () => {
        const c = await approvedBulkSetup(), before = await c.db.state(), barrier = c.db.pauseNextReferenceClaim();
        let listener;
        const failed = new Promise(resolve => { listener = e => { if (e.failure?.code === 112) resolve(); }; });
        client.on('commandFailed', listener); const settlement = c.settle(); let bulk;
        const start = commands.length;
        try { await bounded(barrier.reached); bulk = assert.rejects(c.invoke(), e => e.code === 'STALE_FINGERPRINT'); await bounded(failed); }
        finally { barrier.resume(); client.off('commandFailed', listener); }
        assert.equal((await settlement).applied, true); await bulk;
        assert.equal((await c.executions()).length, 0); assert.equal((await c.decisions()).length, 1);
        assert.ok(commands.slice(start).filter(e => e.commandName === 'find' && e.command.find === M.ProdhlomenaOrariaModel.collection.name && e.command.filter?._id?.$in && e.command.autocommit === false).length >= 2);
        const after = await c.db.state(); assert.equal(after.audits.length, 1);
        assert.equal(after.employee.employee_profile_mutation_sequence, (before.employee.employee_profile_mutation_sequence || 0) + 1);
        const fresh = await prepareBulk({ ...c, command: { ...c.command, request_id: c.command.request_id + '-fresh' },
            first: await R.reconstructWeeklyRepoTransferDecision({ scope: c.scope, command: c.command }) });
        assert.equal((await fresh.invoke()).completed, true);
        assert.equal((await c.executions()).length, 1); assert.equal((await c.decisions()).length, 2);
        const final = await c.db.state(); assert.equal(final.audits.length, 1);
        assert.equal(final.employee.employee_profile_mutation_sequence, after.employee.employee_profile_mutation_sequence);
        assert.deepEqual(final.references, before.references);
    });
    await t.test('bulk preserves existing sequence and increments only the actual pair versions once', async () => {
        const c = await bulkSetup();
        await M.ProdhlomenaOrariaModel.collection.updateMany(c.db.scope, { $set: { __v: 7 } });
        await M.ErgazomenoiModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(c.db.employeeId) },
            { $set: { employee_profile_mutation_sequence: 11 } });
        assert.equal((await c.invoke()).completed, true);
        const rows = await M.ProdhlomenaOrariaModel.collection.find(c.db.scope).toArray();
        for (const row of rows) assert.equal(row.__v, [String(c.rows[1]._id), String(c.rows[4]._id)].includes(String(row._id)) ? 8 : 7);
        assert.equal((await c.db.state()).employee.employee_profile_mutation_sequence, 11);
        assert.equal((await c.db.state()).audits.length, 0);
    });
});
