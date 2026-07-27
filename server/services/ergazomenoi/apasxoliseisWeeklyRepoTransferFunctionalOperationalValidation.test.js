const assert = require('assert');
const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const mongoose = require('mongoose');

const forbidden = (operation) => () => {
    throw new Error(`FORBIDDEN_OPERATION:${operation}`);
};
mongoose.connect = forbidden('mongoose.connect');
net.Server.prototype.listen = forbidden('network.listen');
http.request = forbidden('http.request');
http.get = forbidden('http.get');
https.request = forbidden('https.request');
https.get = forbidden('https.get');
for (const method of ['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'rename', 'renameSync', 'rm', 'rmSync']) {
    fs[method] = forbidden(`fs.${method}`);
}

const {
    APPLY_FIELDS,
    CURRENT_GUARD_FIELDS,
    preflightWeeklyRepoTransferApply
} = require('./apasxoliseisWeeklyRepoTransferApplyPreflightService');
const {
    validateApplyCommand,
    commandIdentity
} = require('./apasxoliseisWeeklyRepoTransferApplyCommandService');
const {
    getWeeklyRepoTransferApplyRuntimeState
} = require('./apasxoliseisWeeklyRepoTransferApplyRuntimeGuardService');
const {
    REQUIRED_INDEXES,
    getWeeklyRepoTransferApplyIndexState
} = require('./apasxoliseisWeeklyRepoTransferApplyIndexGuardService');
const {
    fingerprintSnapshot,
    reconstructWeeklyRepoTransferDecision
} = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');
const {
    writeWeeklyRepoTransferAtomically
} = require('./apasxoliseisWeeklyRepoTransferAtomicWriterService');
const {
    applyWeeklyRepoTransfer
} = require('./apasxoliseisWeeklyRepoTransferApplyService');
const {
    validateRepoTransferApplyBody
} = require('../../middlewares/repoTransferApplyBodyParser');

const IDS = Object.freeze({
    decision: '507f1f77bcf86cd799439011',
    source: '507f1f77bcf86cd799439012',
    target: '507f1f77bcf86cd799439013',
    employee: '507f191e810c19729de860eb',
    actor: '507f191e810c19729de860ea'
});
const SESSION = Object.freeze({
    userTeam: 'THA',
    companyInUse: '507f1f77bcf86cd799439099',
    companyKodikos: '0004',
    yearInUse: '2026',
    userId: IDS.actor,
    userName: 'Validation Actor',
    userStatus: 'A',
    userRole: 'A'
});
const COMMAND = Object.freeze({
    decision_id: IDS.decision,
    request_id: 'validation-request-0001'
});
const EMPLOYMENT_FIXTURES = Object.freeze([
    Object.freeze({ family: 'FULL', typos_apasxolhshs: 'PLHRHS' }),
    Object.freeze({ family: 'PARTIAL_FAMILY', typos_apasxolhshs: 'MERIKH' }),
    Object.freeze({ family: 'PARTIAL_FAMILY', typos_apasxolhshs: 'EK_PERITROPHS' }),
    Object.freeze({
        family: 'PARTIAL_FAMILY',
        typos_apasxolhshs: 'MERIKH',
        profile_case: 'REDUCED_DAYS_AND_DAILY_HOURS',
        mhniaia_repo: 3,
        mo_oron_hmerhsias_ergasias: 4
    })
]);
const COVERAGE_FILES = Object.freeze([
    'apasxoliseisWeeklyRepoTransferApplyPreflightService.test.js',
    'apasxoliseisWeeklyRepoTransferAtomicWriterService.test.js',
    'apasxoliseisWeeklyRepoTransferApplyService.test.js',
    'apasxoliseisWeeklyRepoTransferDecisionBatchService.test.js',
    '../../controllers/ergazomenoi/erganhController.repoTransferApplyRuntime.test.js',
    '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.atomicRepoTransferUi.test.js'
]);

function applyValues(repo = false, category = '') {
    return Object.fromEntries(APPLY_FIELDS.map((field) => {
        if (field === 'repo_apologistika') return [field, repo];
        if (field === 'adeia_apologistika') return [field, false];
        if (field === 'kathgoria_ergasias_apologistika') return [field, category];
        if (field.includes('ores_')) return [field, 0];
        return [field, ''];
    }));
}
function guardValues(repo, category, cardsHours) {
    return {
        ...Object.fromEntries(CURRENT_GUARD_FIELDS.map((field) => [field, null])),
        ...applyValues(repo, category),
        cards_ores_ergasias: cardsHours,
        cards_apo_ora_01: cardsHours > 0 ? '09:00' : '',
        cards_eos_ora_01: cardsHours > 0 ? '17:00' : '',
        kathgoria_ergasias: category,
        ores_ergasias: category === 'ΕΡΓ' ? 8 : 0,
        is_locked: false
    };
}
function canonicalFixture(employment = EMPLOYMENT_FIXTURES[1]) {
    const sourceCurrent = guardValues(true, 'ΜΕ', 8);
    const targetCurrent = guardValues(false, 'ΕΡΓ', 0);
    const snapshot = {
        proposal_id: 'repo-transfer-functional-validation',
        proposal_version: 'repo-transfer-single-pair-proposal:v2',
        choice_code: 'choice',
        team: SESSION.userTeam,
        company_kod: SESSION.companyInUse,
        ypokatasthma: '0001',
        employee_id: IDS.employee,
        employee_kodikos: '001',
        week_start: '2026-07-12',
        week_end: '2026-07-18',
        employment,
        source: {
            prodhlomena_oraria_id: IDS.source,
            hmeromhnia: '2026-07-13',
            current_values: sourceCurrent,
            proposed_values: applyValues(false, 'ΕΡΓ'),
            lock_state: false
        },
        target: {
            prodhlomena_oraria_id: IDS.target,
            hmeromhnia: '2026-07-14',
            current_values: targetCurrent,
            proposed_values: applyValues(true, 'ΜΕ'),
            lock_state: false
        }
    };
    const decision = {
        _id: IDS.decision,
        decision_code: 'APPROVE_PROPOSAL',
        decision_status: 'RECORDED',
        canonical_snapshot: snapshot,
        snapshot_fingerprint: fingerprintSnapshot(snapshot),
        proposal_id: snapshot.proposal_id,
        team: snapshot.team,
        company_kod: snapshot.company_kod,
        ypokatasthma: snapshot.ypokatasthma,
        employee_id: snapshot.employee_id,
        employee_kodikos: snapshot.employee_kodikos,
        week_start: new Date(`${snapshot.week_start}T00:00:00.000Z`),
        week_end: new Date(`${snapshot.week_end}T00:00:00.000Z`),
        source_prodhlomena_oraria_id: IDS.source,
        target_prodhlomena_oraria_id: IDS.target
    };
    return { snapshot, decision };
}
function matches(record, filter) {
    return Object.entries(filter).every(([key, value]) => String(record?.[key] ?? '') === String(value ?? ''));
}
function createStore(options = {}) {
    const fixture = canonicalFixture();
    const committed = {
        rows: {
            [IDS.source]: { _id: IDS.source, team: SESSION.userTeam, company_kod: SESSION.companyInUse, ypokatasthma: '0001', kodikos: '001', hmeromhnia: new Date('2026-07-13T00:00:00.000Z'), ...fixture.snapshot.source.current_values, __v: 1, is_locked: false },
            [IDS.target]: { _id: IDS.target, team: SESSION.userTeam, company_kod: SESSION.companyInUse, ypokatasthma: '0001', kodikos: '001', hmeromhnia: new Date('2026-07-14T00:00:00.000Z'), ...fixture.snapshot.target.current_values, __v: 2, is_locked: false }
        },
        audits: [],
        executions: []
    };
    let staged;
    const counters = { transactions: 0, commits: 0, aborts: 0, updates: 0, writerCalls: 0 };
    const session = {
        async withTransaction(callback) {
            counters.transactions++;
            staged = structuredClone(committed);
            try {
                if (['before-source', 'abort'].includes(options.failAt)) throw new Error('synthetic private source failure');
                await callback();
                if (options.failAt === 'commit') throw new Error('synthetic private commit failure');
                committed.rows = staged.rows;
                committed.audits = staged.audits;
                committed.executions = staged.executions;
                counters.commits++;
            } catch (error) {
                counters.aborts++;
                if (options.failAt === 'abort') throw new Error('synthetic private abort failure', { cause: error });
                throw error;
            }
        },
        async endSession() {}
    };
    const connection = { async startSession() { return session; } };
    const prodhlomenaModel = {
        findOne(filter) {
            return {
                session() { return this; },
                async lean() { return structuredClone(staged.rows[String(filter._id)] || null); }
            };
        },
        async updateOne(filter, update) {
            counters.updates++;
            const id = String(filter._id);
            const role = id === IDS.source ? 'source' : 'target';
            if (options.failAt === `${role}-update`) throw new Error(`synthetic private ${role} update failure`);
            if (!matches(staged.rows[id], filter)) return { matchedCount: 0 };
            Object.assign(staged.rows[id], update.$set);
            if (update.$inc?.__v) staged.rows[id].__v += update.$inc.__v;
            return { matchedCount: 1 };
        }
    };
    let auditCalls = 0;
    const auditModel = {
        async create(records) {
            auditCalls++;
            if (options.failAt === `${auditCalls === 1 ? 'source' : 'target'}-audit`) throw new Error('synthetic private audit failure');
            staged.audits.push(...structuredClone(records));
            return records;
        }
    };
    const executionModel = {
        findOne(filter) {
            return { lean: async () => committed.executions.find((record) => matches(record, filter)) || null };
        },
        async create(records) {
            if (options.failAt === 'execution') throw new Error('synthetic private execution failure');
            const created = records.map((record) => ({ _id: '507f1f77bcf86cd799439099', ...structuredClone(record) }));
            staged.executions.push(...created);
            return created;
        }
    };
    const decisionModel = {
        findOne: (filter) => ({
            lean: async () => String(filter?._id || '') === IDS.decision
                ? structuredClone(fixture.decision)
                : null
        })
    };
    const reconstruct = async () => ({
        snapshot: structuredClone(fixture.snapshot),
        fingerprint: fixture.decision.snapshot_fingerprint
    });
    const realPreflight = (args) => preflightWeeklyRepoTransferApply({ ...args, reconstruct });
    const realWriter = async ({ plan }) => {
        counters.writerCalls++;
        return writeWeeklyRepoTransferAtomically({
            plan,
            connection,
            prodhlomenaModel,
            auditModel,
            executionModel,
            capabilityProbe: async () => options.transactionsAvailable !== false,
            now: () => new Date('2026-07-14T10:00:00.000Z')
        });
    };
    return { fixture, committed, counters, decisionModel, executionModel, realPreflight, realWriter };
}
async function integratedApply(store, payload = COMMAND, session = SESSION) {
    return applyWeeklyRepoTransfer({
        session,
        payload,
        decisionModel: store.decisionModel,
        executionModel: store.executionModel,
        preflight: store.realPreflight,
        writer: store.realWriter
    });
}
function bodyResult(body, contentType = 'application/json') {
    const result = { status: 200, payload: null, next: false };
    validateRepoTransferApplyBody(
        { body, is: (type) => type === contentType },
        { status(code) { result.status = code; return this; }, json(payload) { result.payload = payload; return this; } },
        () => { result.next = true; }
    );
    return result;
}
function assertRolledBack(store) {
    assert.strictEqual(store.committed.rows[IDS.source].repo_apologistika, true);
    assert.strictEqual(store.committed.rows[IDS.target].repo_apologistika, false);
    assert.strictEqual(store.committed.audits.length, 0);
    assert.strictEqual(store.committed.executions.length, 0);
    assert.strictEqual(store.counters.commits, 0);
}
async function validateRealReconstruction() {
    const group = {
        group_id: 'functional-reconstruction',
        group_key: 'functional-key',
        group_type: 'ATOMIC_PAIRED_PROPOSAL',
        scenario_code: 'REPO_TRANSFER_WITHIN_WEEK_SINGLE_PAIR',
        policy_code: 'WEEKLY_REPO_BALANCE',
        secondary_policy_code: 'DECLARED_REPO_OR_NON_WORK_WITH_CARDS',
        pair_contract: {
            proposal_version: 'repo-transfer-single-pair-proposal:v2',
            choice_code: 'choice',
            policy_versions: {}
        },
        items: [
            {
                role: 'SOURCE_BECOMES_WORK',
                prodhlomena_oraria_id: IDS.source,
                hmeromhnia: '2026-07-13',
                proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' },
                flags: { approval_supported: false, runtime_apply_supported: false }
            },
            {
                role: 'TARGET_BECOMES_REPO',
                prodhlomena_oraria_id: IDS.target,
                hmeromhnia: '2026-07-14',
                proposed_values: { kathgoria_ergasias_apologistika: 'ΜΕ' },
                flags: { approval_supported: false, runtime_apply_supported: false }
            }
        ]
    };
    const context = {
        candidates: [
            { _id: IDS.source, team: SESSION.userTeam, company_kod: SESSION.companyInUse, ypokatasthma: '0001', kodikos: '001' },
            { _id: IDS.target, team: SESSION.userTeam, company_kod: SESSION.companyInUse, ypokatasthma: '0001', kodikos: '001' }
        ],
        weekRows: [
            { _id: IDS.source, hmeromhnia: '2026-07-13' },
            { _id: IDS.target, hmeromhnia: '2026-07-14' }
        ],
        employee: { _id: IDS.employee },
        employmentProfile: EMPLOYMENT_FIXTURES[1],
        history: [],
        audits: [],
        week: { start: '2026-07-12', end: '2026-07-18' },
        companyFlags: {},
        companyKodikos: SESSION.companyKodikos,
        holidayByDateKey: new Map()
    };
    const result = await reconstructWeeklyRepoTransferDecision({
        scope: { team: SESSION.userTeam, company_kod: SESSION.companyInUse },
        command: {
            proposal_id: group.group_id,
            expected_source_id: IDS.source,
            expected_target_id: IDS.target,
            expected_proposal_version: group.pair_contract.proposal_version,
            expected_choice_code: group.pair_contract.choice_code
        },
        contextLoader: async () => context,
        projectionBuilder: (input) => {
            assert.strictEqual(input.contractVersion, 'v2');
            return { projection_status: 'READY', groups: [group] };
        }
    });
    assert.strictEqual(result.snapshot.source.prodhlomena_oraria_id, IDS.source);
    assert.strictEqual(result.snapshot.target.prodhlomena_oraria_id, IDS.target);
    assert.strictEqual(result.fingerprint.length, 64);
}

async function run() {
    const existingCoverage = COVERAGE_FILES.map((file) => fs.readFileSync(require.resolve(`./${file}`), 'utf8')).join('\n');
    for (const evidence of [
        'DECISION_NOT_APPROVED',
        'SCOPE_MISMATCH',
        'STALE_FINGERPRINT',
        'SOURCE_STALE',
        'TARGET_STALE',
        'SOURCE_LOCKED',
        'TARGET_LOCKED',
        'REQUEST_ID_CONFLICT',
        'DECISION_ALREADY_APPLIED',
        'RUNTIME_DISABLED',
        'INDEXES_NOT_READY',
        'NOT_AUTHORIZED',
        'STALE_DECISION',
        'ALREADY_APPLIED'
    ]) {
        assert.ok(existingCoverage.includes(evidence), `Missing focused evidence for ${evidence}`);
    }
    assert.deepStrictEqual(EMPLOYMENT_FIXTURES.map((item) => item.typos_apasxolhshs), ['PLHRHS', 'MERIKH', 'EK_PERITROPHS', 'MERIKH']);
    assert.strictEqual(EMPLOYMENT_FIXTURES[3].profile_case, 'REDUCED_DAYS_AND_DAILY_HOURS');
    await validateRealReconstruction();
    assert.deepStrictEqual(validateApplyCommand(COMMAND), COMMAND);
    assert.strictEqual(commandIdentity(COMMAND).length, 64);
    assert.strictEqual(bodyResult({ request_id: COMMAND.request_id }).next, true);
    for (const body of [{ request_id: COMMAND.request_id, extra: true }, { decision_id: IDS.decision }, []]) {
        const response = bodyResult(body);
        assert.strictEqual(response.next, false);
        assert.ok([400, 415].includes(response.status));
    }

    assert.strictEqual(getWeeklyRepoTransferApplyRuntimeState({}).enabled, false);
    assert.strictEqual(getWeeklyRepoTransferApplyRuntimeState({ ALLOW_REPO_TRANSFER_APPLY: 'true' }).enabled, true);
    assert.strictEqual(getWeeklyRepoTransferApplyRuntimeState({ NODE_ENV: 'production', ALLOW_REPO_TRANSFER_APPLY: 'true' }).enabled, false);
    assert.strictEqual(getWeeklyRepoTransferApplyRuntimeState({ NODE_ENV: 'production', ALLOW_REPO_TRANSFER_APPLY: 'true', ALLOW_PRODUCTION_REPO_TRANSFER_APPLY: 'true' }).enabled, true);
    const readyIndexes = Object.entries(REQUIRED_INDEXES).map(([name, key]) => ({ name, key, unique: true }));
    assert.strictEqual((await getWeeklyRepoTransferApplyIndexState({ indexLoader: async () => readyIndexes })).ready, true);
    assert.strictEqual((await getWeeklyRepoTransferApplyIndexState({ indexLoader: async () => [] })).ready, false);
    assert.strictEqual((await getWeeklyRepoTransferApplyIndexState({ indexLoader: async () => { throw new Error('private index failure'); } })).ready, false);

    const successStore = createStore();
    const success = await integratedApply(successStore);
    assert.strictEqual(success.idempotent, false);
    assert.strictEqual(success.execution.execution_status, 'APPLIED');
    assert.strictEqual(successStore.counters.transactions, 1);
    assert.strictEqual(successStore.counters.commits, 1);
    assert.strictEqual(successStore.counters.updates, 2);
    assert.strictEqual(successStore.committed.rows[IDS.source].kathgoria_ergasias_apologistika, 'ΕΡΓ');
    assert.strictEqual(successStore.committed.rows[IDS.target].kathgoria_ergasias_apologistika, 'ΜΕ');
    assert.strictEqual(successStore.committed.audits.length, 2);
    assert.strictEqual(successStore.committed.executions.length, 1);
    for (const secret of ['canonical_snapshot', 'snapshot_fingerprint', 'command_identity', 'request_id']) {
        assert.ok(!Object.hasOwn(success.execution, secret));
    }

    const replay = await integratedApply(successStore);
    assert.strictEqual(replay.idempotent, true);
    assert.strictEqual(replay.execution.id, success.execution.id);
    assert.strictEqual(successStore.counters.writerCalls, 1);
    assert.strictEqual(successStore.committed.audits.length, 2);
    assert.strictEqual(successStore.committed.executions.length, 1);

    await assert.rejects(
        () => integratedApply(successStore, { ...COMMAND, request_id: 'validation-request-0002' }),
        (error) => error.code === 'DECISION_ALREADY_APPLIED'
    );
    const conflictStore = createStore();
    conflictStore.committed.executions.push({
        ...successStore.committed.executions[0],
        decision_id: '507f1f77bcf86cd799439088',
        request_id: COMMAND.request_id,
        command_identity: 'different'
    });
    await assert.rejects(() => integratedApply(conflictStore), (error) => error.code === 'REQUEST_ID_CONFLICT');
    assert.strictEqual(conflictStore.counters.writerCalls, 0);

    for (const [payload, code] of [
        [{ ...COMMAND, request_id: 'short' }, 'INVALID_REQUEST_ID'],
        [{ ...COMMAND, extra: true }, 'INVALID_APPLY_COMMAND'],
        [{ ...COMMAND, decision_id: IDS.source }, 'DECISION_NOT_FOUND']
    ]) {
        const store = createStore();
        await assert.rejects(() => integratedApply(store, payload), (error) => error.code === code);
        assert.strictEqual(store.counters.writerCalls, 0);
    }
    for (const role of ['HR', 'U']) {
        const store = createStore();
        await assert.rejects(() => integratedApply(store, COMMAND, { ...SESSION, userRole: role }), (error) => error.code === 'APPLY_NOT_AUTHORIZED');
        assert.strictEqual(store.counters.writerCalls, 0);
    }

    for (const failAt of ['before-source', 'source-update', 'target-update', 'source-audit', 'target-audit', 'execution', 'commit', 'abort']) {
        const store = createStore({ failAt });
        await assert.rejects(() => integratedApply(store));
        assertRolledBack(store);
    }
    const unavailable = createStore({ transactionsAvailable: false });
    await assert.rejects(() => integratedApply(unavailable), (error) => error.code === 'TRANSACTIONS_UNAVAILABLE');
    assertRolledBack(unavailable);

    assert.strictEqual(mongoose.connection.readyState, 0);
    console.log('PASS repo-transfer functional and operational validation (database-free integrated contract)');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
