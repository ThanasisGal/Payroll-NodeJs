const assert = require('assert');
const mongoose = require('mongoose');
const {
    validateBatchFilters,
    loadWeeklyRepoTransferDecisionBatch
} = require('./apasxoliseisWeeklyRepoTransferDecisionBatchService');

function query(result, counter, name) {
    counter[name] = (counter[name] || 0) + 1;
    return {
        select() { return this; },
        sort() { return this; },
        lean: async () => result
    };
}

function date(start, offset) {
    const value = new Date(`${start}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value;
}

function week(start, employeeCode) {
    const rows = Array.from({ length: 7 }, (_, offset) => ({
        _id: new mongoose.Types.ObjectId(),
        team: 'THA',
        company_kod: '507f1f77bcf86cd799439099',
        ypokatasthma: '0000',
        kodikos: employeeCode,
        hmeromhnia: date(start, offset),
        kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 8,
        cards_ores_ergasias: 8,
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '17:00',
        repo: false,
        is_locked: false
    }));
    Object.assign(rows[1], { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0, cards_ores_ergasias: 8 });
    Object.assign(rows[4], { cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '' });
    Object.assign(rows[6], { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0, cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '' });
    return rows;
}

const session = {
    userTeam: 'THA',
    companyInUse: '507f1f77bcf86cd799439099',
    companyKodikos: '0004',
    yearInUse: '2026',
    userId: '507f1f77bcf86cd799439088',
    userName: 'HR',
    userRole: 'HR',
    userStatus: 'A'
};

function dependencies(rows, decisions = [], executions = []) {
    const counter = { filters: {} };
    const employeeCodes = [...new Set(rows.map((row) => row.kodikos))];
    const employees = employeeCodes.map((kodikos) => ({
        _id: new mongoose.Types.ObjectId(),
        team: 'THA',
        company_kod: session.companyInUse,
        ypokatasthma: '0000',
        kodikos,
        energos: true,
        archived: false,
        kathestos_apasxolhshs: 'PLHRHS',
        typos_apasxolhshs: 'PLHRHS',
        mhniaia_repo: 2,
        mo_oron_hmerhsias_ergasias: 8
    }));
    return {
        counter,
        models: {
            prodhlomenaModel: { find: (filter) => { counter.filters.rows = filter; return query(rows, counter, 'rows'); } },
            employeeModel: { find: (filter) => { counter.filters.employees = filter; return query(employees, counter, 'employees'); } },
            historyModel: { find: (filter) => { counter.filters.histories = filter; return query([], counter, 'histories'); } },
            auditModel: { find: (filter) => { counter.filters.audits = filter; return query([], counter, 'audits'); } },
            decisionModel: { find: (filter) => { counter.filters.decisions = filter; return query(decisions, counter, 'decisions'); } },
            executionModel: { find: (filter) => { counter.filters.executions = filter; return query(executions, counter, 'executions'); } }
        },
        holidayContextBuilder: async () => {
            counter.holidays = (counter.holidays || 0) + 1;
            return {
                companyFlags: {
                    apasxolhsh_kata_tis_argies: false,
                    leitoyrgia_stis_mh_ypoxreotikes_argies: false
                },
                company_kodikos: '0004',
                argiesByDateKey: new Map()
            };
        }
    };
}

async function load(rows, decisions = [], executions = [], range = { apo_hmeromhnia: '2026-07-05', eos_hmeromhnia: '2026-07-18', ypokatasthma: '0000' }) {
    const deps = dependencies(rows, decisions, executions);
    const result = await loadWeeklyRepoTransferDecisionBatch({ session, filters: range, ...deps });
    return { result, counter: deps.counter };
}

async function testZeroProposalsUsesOneBatchOfQueries() {
    const { result, counter } = await load([]);
    assert.deepStrictEqual(result.records, []);
    assert.strictEqual(result.current_groups_count, 0);
    assert.strictEqual(counter.rows, 1);
    assert.strictEqual(counter.holidays, 1);
    assert.strictEqual(counter.employees || 0, 0);
    assert.strictEqual(counter.histories || 0, 0);
    assert.strictEqual(counter.audits || 0, 0);
    assert.strictEqual(counter.decisions, 1);
    assert.strictEqual(counter.executions || 0, 0);
    assert.strictEqual(result.applied_only_count, 0);
    assert.strictEqual(counter.filters.rows.team, 'THA');
    assert.strictEqual(counter.filters.rows.company_kod, session.companyInUse);
    assert.strictEqual(counter.filters.rows.ypokatasthma, '0000');
    assert.ok(counter.filters.decisions.week_start.$lte instanceof Date);
    assert.ok(counter.filters.decisions.week_end.$gte instanceof Date);
}

async function testManyProposalsKeepConstantQueryCounts() {
    const rows = [
        ...week('2026-07-05', '0001'),
        ...week('2026-07-12', '0001'),
        ...week('2026-07-05', '0002')
    ];
    const { result, counter } = await load(rows);
    assert.strictEqual(result.current_groups_count, 3);
    assert.strictEqual(result.records.length, 3);
    assert.deepStrictEqual({ ...counter, filters: undefined }, {
        filters: undefined,
        rows: 1,
        employees: 1,
        histories: 1,
        audits: 1,
        holidays: 1,
        decisions: 1
    });
    for (const name of ['rows', 'employees', 'histories', 'audits', 'decisions']) {
        assert.strictEqual(counter.filters[name].team, 'THA');
        assert.strictEqual(counter.filters[name].company_kod, session.companyInUse);
    }
    assert.strictEqual(counter.filters.rows.ypokatasthma, '0000');
    assert.strictEqual(counter.filters.decisions.ypokatasthma, '0000');
}

async function testCurrentAndHistoricalAssociationIsSafe() {
    const rows = week('2026-07-05', '0001');
    const initial = await load(rows);
    const proposalId = initial.result.records[0].proposal_id;
    const decisions = [
        { _id: new mongoose.Types.ObjectId(), proposal_id: proposalId, snapshot_fingerprint: 'current', decision_code: 'APPROVE_PROPOSAL', decision_status: 'RECORDED', created_by_user_name: 'Current HR', created_at: new Date('2026-07-02') },
        { _id: new mongoose.Types.ObjectId(), proposal_id: proposalId, snapshot_fingerprint: 'old', decision_code: 'REJECT_PROPOSAL', decision_status: 'RECORDED', created_by_user_name: 'Old HR', created_at: new Date('2026-07-01') }
    ];
    const deps = dependencies(rows, decisions);
    const result = await loadWeeklyRepoTransferDecisionBatch({
        session,
        filters: { apo_hmeromhnia: '2026-07-05', eos_hmeromhnia: '2026-07-11', ypokatasthma: '0000' },
        ...deps,
        canonicalSnapshotBuilder: () => ({}),
        snapshotFingerprintBuilder: () => 'current'
    });
    assert.strictEqual(result.records[0].current_decision.decision_code, 'APPROVE_PROPOSAL');
    assert.strictEqual(result.records[0].history_count, 2);
    assert.strictEqual(deps.counter.executions, 1);
    assert.strictEqual(result.records[0].apply_state, 'NOT_AUTHORIZED');
    assert.strictEqual(result.records[0].apply_allowed, false);
    assert.deepStrictEqual(result.records[0].history.map((entry) => entry.is_current), [true, false]);
    assert.ok(!JSON.stringify(result).includes('snapshot_fingerprint'));
    assert.ok(!JSON.stringify(result).includes('canonical_snapshot'));
    assert.ok(!JSON.stringify(result).includes('canonical_group_key'));
}

async function testReadyAndHistoricalExecutionPrecedence() {
    const rows = week('2026-07-05', '0001');
    const initial = await load(rows);
    const proposalId = initial.result.records[0].proposal_id;
    const approvedId = new mongoose.Types.ObjectId();
    const approved = { _id: approvedId, proposal_id: proposalId, snapshot_fingerprint: 'current', decision_code: 'APPROVE_PROPOSAL', decision_status: 'RECORDED', week_start: date('2026-07-05', 0), week_end: date('2026-07-05', 6), created_at: new Date('2026-07-02') };
    const readyDeps = dependencies(rows, [approved]);
    const ready = await loadWeeklyRepoTransferDecisionBatch({
        session: { ...session, userRole: 'A' }, filters: { apo_hmeromhnia: '2026-07-05', eos_hmeromhnia: '2026-07-11', ypokatasthma: '0000' }, ...readyDeps,
        canonicalSnapshotBuilder: () => ({}), snapshotFingerprintBuilder: () => 'current',
        runtimeStateLoader: async () => ({ enabled: true }), indexStateLoader: async () => ({ ready: true })
    });
    assert.strictEqual(ready.records[0].apply_state, 'READY_TO_APPLY');
    assert.strictEqual(ready.records[0].apply_allowed, true);

    const execution = { _id: new mongoose.Types.ObjectId(), decision_id: approvedId, proposal_id: proposalId, execution_status: 'APPLIED', applied_at: new Date('2026-07-15'), created_by_user_name: 'Executor' };
    const appliedDeps = dependencies(rows, [approved], [execution]);
    const applied = await loadWeeklyRepoTransferDecisionBatch({
        session, filters: { apo_hmeromhnia: '2026-07-05', eos_hmeromhnia: '2026-07-11', ypokatasthma: '0000' }, ...appliedDeps,
        canonicalSnapshotBuilder: () => ({}), snapshotFingerprintBuilder: () => 'changed',
        runtimeStateLoader: async () => ({ enabled: false }), indexStateLoader: async () => ({ ready: false })
    });
    assert.strictEqual(applied.records[0].current_decision, null);
    assert.strictEqual(applied.records[0].apply_state, 'ALREADY_APPLIED');
    assert.strictEqual(applied.records[0].apply_allowed, false);
    assert.strictEqual(applied.records[0].current_execution.decision_id, String(approvedId));
}

async function testResolvedProjectionReturnsAppliedOnlyRecord() {
    const decisionId = new mongoose.Types.ObjectId();
    const decision = { _id: decisionId, proposal_id: 'resolved-proposal', snapshot_fingerprint: 'old', decision_code: 'APPROVE_PROPOSAL', decision_status: 'RECORDED', week_start: date('2026-07-05', 0), week_end: date('2026-07-05', 6), created_by_user_name: '<HR>', request_id: 'secret', command_identity: 'secret', canonical_snapshot: { secret: true } };
    const execution = { _id: new mongoose.Types.ObjectId(), decision_id: decisionId, proposal_id: decision.proposal_id, execution_status: 'APPLIED', applied_at: new Date('2026-07-15'), created_by_user_name: '<Executor>', before_snapshot: { secret: true }, after_snapshot: { secret: true }, request_id: 'secret', command_identity: 'secret' };
    const deps = dependencies([], [decision], [execution]);
    const result = await loadWeeklyRepoTransferDecisionBatch({ session, filters: { apo_hmeromhnia: '2026-07-05', eos_hmeromhnia: '2026-07-11', ypokatasthma: '0000' }, ...deps });
    assert.strictEqual(result.current_groups_count, 0);
    assert.strictEqual(result.applied_only_count, 1);
    assert.strictEqual(result.records.length, 1);
    assert.strictEqual(result.records[0].apply_state, 'ALREADY_APPLIED');
    assert.strictEqual(result.records[0].current_decision, null);
    assert.strictEqual(result.records[0].history[0].is_current, false);
    assert.strictEqual(deps.counter.decisions, 1);
    assert.strictEqual(deps.counter.executions, 1);
    for (const secret of ['canonical_snapshot','request_id','command_identity','before_snapshot','after_snapshot']) assert.ok(!JSON.stringify(result).includes(secret));
}

async function testTwentyPeriodDecisionsUseTwoConstantQueries() {
    const decisions = Array.from({ length: 20 }, (_, index) => ({ _id: new mongoose.Types.ObjectId(), proposal_id: `resolved-${index}`, snapshot_fingerprint: `old-${index}`, decision_code: index % 2 ? 'REJECT_PROPOSAL' : 'NEEDS_MORE_REVIEW', decision_status: 'RECORDED', week_start: date('2026-07-05', 0), week_end: date('2026-07-05', 6) }));
    const executions = decisions.map((decision, index) => ({ _id: new mongoose.Types.ObjectId(), decision_id: decision._id, proposal_id: decision.proposal_id, execution_status: 'APPLIED', applied_at: new Date(Date.UTC(2026, 6, 15, 0, index)), created_by_user_name: 'Executor' }));
    const deps = dependencies([], decisions, executions);
    const result = await loadWeeklyRepoTransferDecisionBatch({ session, filters: { apo_hmeromhnia: '2026-07-05', eos_hmeromhnia: '2026-07-11', ypokatasthma: '0000' }, ...deps });
    assert.strictEqual(deps.counter.decisions, 1);
    assert.strictEqual(deps.counter.executions, 1);
    assert.strictEqual(result.applied_only_count, 20);
    assert.strictEqual(result.records[0].current_execution.applied_at.getUTCMinutes(), 19);
    assert.deepStrictEqual(deps.counter.filters.executions.team, 'THA');
    assert.deepStrictEqual(deps.counter.filters.executions.company_kod, session.companyInUse);
}

async function testFilterAndScopeRejections() {
    for (const branch of ['', 'ALL', '0000,0001']) {
        assert.throws(() => validateBatchFilters({ apo_hmeromhnia: '2026-07-05', eos_hmeromhnia: '2026-07-11', ypokatasthma: branch }), (error) => error.statusCode === 400);
    }
    assert.throws(() => validateBatchFilters({ apo_hmeromhnia: '2026-01-01', eos_hmeromhnia: '2026-07-11', ypokatasthma: '0000' }), (error) => error.statusCode === 400);
    for (const field of ['userTeam', 'companyInUse']) {
        await assert.rejects(() => loadWeeklyRepoTransferDecisionBatch({ session: { ...session, [field]: '' }, filters: { apo_hmeromhnia: '2026-07-05', eos_hmeromhnia: '2026-07-11', ypokatasthma: '0000' }, ...dependencies([]) }), (error) => error.statusCode === 403);
    }
}

async function run() {
    await testZeroProposalsUsesOneBatchOfQueries();
    await testManyProposalsKeepConstantQueryCounts();
    await testCurrentAndHistoricalAssociationIsSafe();
    await testReadyAndHistoricalExecutionPrecedence();
    await testResolvedProjectionReturnsAppliedOnlyRecord();
    await testTwentyPeriodDecisionsUseTwoConstantQueries();
    await testFilterAndScopeRejections();
    console.log('weekly repo transfer decision batch tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
