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
    buildWeeklyRepoTransferSinglePairGroupProjection
} = require('./apasxoliseisWeeklyRepoTransferSinglePairGroupProjectionService');
const {
    analyzeWeeklyRepoTransferSinglePairV1,
    analyzeWeeklyRepoTransferSinglePairV2
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const {
    writeWeeklyRepoTransferAtomically
} = require('./apasxoliseisWeeklyRepoTransferAtomicWriterService');
const {
    applyWeeklyRepoTransfer
} = require('./apasxoliseisWeeklyRepoTransferApplyService');
const {
    loadWeeklyRepoTransferDecisionBatch
} = require('./apasxoliseisWeeklyRepoTransferDecisionBatchService');
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
    Object.freeze({ name: 'FULL', family: 'FULL', typos_apasxolhshs: 'PLHRHS', contractVersion: 'v1', proposalVersion: 'repo-transfer-single-pair-proposal:v4', targetCategory: 'ΑΝ', workdays: 5, dailyHours: 8 }),
    Object.freeze({ name: 'MERIKH', family: 'PARTIAL_FAMILY', typos_apasxolhshs: 'MERIKH', contractVersion: 'v2', proposalVersion: 'repo-transfer-single-pair-proposal:v4', targetCategory: 'ΜΕ', workdays: 5, dailyHours: 4 }),
    Object.freeze({ name: 'EK_PERITROPHS', family: 'PARTIAL_FAMILY', typos_apasxolhshs: 'EK_PERITROPHS', contractVersion: 'v2', proposalVersion: 'repo-transfer-single-pair-proposal:v4', targetCategory: 'ΜΕ', workdays: 5, dailyHours: 4 }),
    Object.freeze({
        name: 'MERIKH_REDUCED_DAYS_AND_HOURS',
        family: 'PARTIAL_FAMILY',
        typos_apasxolhshs: 'MERIKH',
        contractVersion: 'v2',
        proposalVersion: 'repo-transfer-single-pair-proposal:v4',
        targetCategory: 'ΜΕ',
        profile_case: 'REDUCED_DAYS_AND_DAILY_HOURS', workdays: 5,
        dailyHours: 4
    }),
    Object.freeze({
        name: 'EK_PERITROPHS_REDUCED_DAYS_AND_HOURS',
        family: 'PARTIAL_FAMILY',
        typos_apasxolhshs: 'EK_PERITROPHS',
        contractVersion: 'v2',
        proposalVersion: 'repo-transfer-single-pair-proposal:v4',
        targetCategory: 'ΜΕ',
        profile_case: 'REDUCED_DAYS_AND_DAILY_HOURS', workdays: 5,
        dailyHours: 4
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
        if (field === 'compensation_breakdown_apologistika') return [field, null];
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
function weekRows(employment) {
    const sourceOffset = employment.family === 'FULL' ? 1 : 2;
    const targetOffset = 4;
    const rows = Array.from({ length: 7 }, (_, offset) => ({
        _id: offset === sourceOffset ? IDS.source : offset === targetOffset ? IDS.target : `507f1f77bcf86cd7994390${20 + offset}`,
        team: SESSION.userTeam,
        company_kod: SESSION.companyInUse,
        ypokatasthma: '0001',
        kodikos: '001',
        hmeromhnia: new Date(Date.UTC(2026, 6, 13 + offset)),
        kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: employment.dailyHours,
        cards_ores_ergasias: employment.dailyHours,
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: employment.dailyHours === 8 ? '17:00' : '13:00',
        cards_apo_ora_02: '',
        cards_eos_ora_02: '',
        cards_apo_ora_03: '',
        cards_eos_ora_03: '',
        repo: false,
        is_locked: false
    }));
    Object.assign(rows[sourceOffset], {
        kathgoria_ergasias: employment.family === 'FULL' ? 'ΑΝ' : 'ΜΕ',
        ores_ergasias: 0
    });
    Object.assign(rows[targetOffset], {
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    Object.assign(rows[6], {
        kathgoria_ergasias: employment.family === 'FULL' ? 'ΑΝ' : 'ΜΕ',
        ores_ergasias: 0,
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    if (employment.workdays === 4) {
        Object.assign(rows[0], {
            kathgoria_ergasias: 'ΜΕ',
            ores_ergasias: 0,
            cards_ores_ergasias: 0,
            cards_apo_ora_01: '',
            cards_eos_ora_01: ''
        });
    }
    return rows;
}
async function canonicalFixture(employment = EMPLOYMENT_FIXTURES[1]) {
    const rows = weekRows(employment);
    const employmentProfile = {
        typos_apasxolhshs: employment.typos_apasxolhshs,
        hmeres_ergasias_ebdomadas: employment.workdays,
        ores_ergasias_ebdomadas: employment.workdays * employment.dailyHours,
        mo_oron_hmerhsias_ergasias: employment.dailyHours
    };
    const projectionBuilder = (input) => buildWeeklyRepoTransferSinglePairGroupProjection(input);
    const analysis = (
        employment.contractVersion === 'v1'
            ? analyzeWeeklyRepoTransferSinglePairV1
            : analyzeWeeklyRepoTransferSinglePairV2
    )({
        weekRows: rows,
        employmentProfile,
        holidayByDateKey: new Map(),
        existingAuditCountByRowKey: new Map()
    });
    assert.strictEqual(analysis.eligibility_status, 'ELIGIBLE', employment.name);
    const projection = projectionBuilder({
        weekRows: rows,
        employmentProfile,
        contractVersion: employment.contractVersion,
        holidayByDateKey: new Map(),
        existingAuditCountByRowKey: new Map()
    });
    assert.strictEqual(projection.projection_status, 'READY', `${employment.name} projection: ${JSON.stringify(projection.reasons || [])}`);
    assert.strictEqual(projection.groups.length, 1);
    const group = projection.groups[0];
    const context = {
        candidates: rows.filter((row) => [IDS.source, IDS.target].includes(String(row._id))),
        weekRows: rows,
        employee: { _id: IDS.employee, kodikos: '001' },
        employmentProfile,
        history: [],
        audits: [],
        week: { start: '2026-07-13', end: '2026-07-19' },
        companyFlags: {},
        companyKodikos: SESSION.companyKodikos,
        holidayByDateKey: new Map()
    };
    const reconstructionCommand = {
        proposal_id: group.group_id,
        expected_source_id: IDS.source,
        expected_target_id: IDS.target,
        expected_proposal_version: employment.proposalVersion,
        expected_choice_code: group.pair_contract.choice_code
    };
    const reconstruct = (commandOverrides = {}) => reconstructWeeklyRepoTransferDecision({
        scope: { team: SESSION.userTeam, company_kod: SESSION.companyInUse },
        command: { ...reconstructionCommand, ...commandOverrides },
        contextLoader: async () => context,
        projectionBuilder
    });
    const reconstruction = await reconstruct();
    const snapshot = reconstruction.snapshot;
    assert.deepStrictEqual(snapshot.repo_resolution, group.repo_resolution);
    assert.strictEqual(
        snapshot.employment_profile.hmeres_ergasias_ebdomadas,
        employment.workdays
    );
    assert.strictEqual(snapshot.proposal_version, employment.proposalVersion);
    assert.strictEqual(snapshot.source.proposed_values.kathgoria_ergasias_apologistika, 'ΕΡΓ');
    assert.strictEqual(snapshot.target.proposed_values.kathgoria_ergasias_apologistika, employment.targetCategory);
    const decision = {
        _id: IDS.decision,
        decision_code: 'APPROVE_PROPOSAL',
        decision_status: 'RECORDED',
        canonical_snapshot: snapshot,
        snapshot_fingerprint: reconstruction.fingerprint,
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
    return { snapshot, decision, group, analysis, context, reconstruct, employment };
}
function matches(record, filter) {
    return Object.entries(filter).every(([key, value]) => {
        const actual = record?.[key];
        if (actual instanceof Date || value instanceof Date) {
            return new Date(actual).toISOString() === new Date(value).toISOString();
        }
        return Object.is(actual ?? null, value ?? null);
    });
}
async function createStore(options = {}) {
    const fixture = await canonicalFixture(options.employment || EMPLOYMENT_FIXTURES[1]);
    const committed = {
        rows: {
            [IDS.source]: { _id: IDS.source, team: SESSION.userTeam, company_kod: SESSION.companyInUse, ypokatasthma: '0001', kodikos: '001', hmeromhnia: new Date(`${fixture.snapshot.source.hmeromhnia}T00:00:00.000Z`), ...fixture.snapshot.source.current_values, __v: 1, is_locked: false },
            [IDS.target]: { _id: IDS.target, team: SESSION.userTeam, company_kod: SESSION.companyInUse, ypokatasthma: '0001', kodikos: '001', hmeromhnia: new Date(`${fixture.snapshot.target.hmeromhnia}T00:00:00.000Z`), ...fixture.snapshot.target.current_values, __v: 2, is_locked: false }
        },
        audits: [],
        executions: []
    };
    const initialRows = structuredClone(committed.rows);
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
    let reconstructionCalls = 0;
    const realPreflight = (args) => preflightWeeklyRepoTransferApply({
        ...args,
        reconstruct: async () => {
            reconstructionCalls++;
            return fixture.reconstruct();
        }
    });
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
    return { fixture, committed, initialRows, counters, decisionModel, executionModel, realPreflight, realWriter, get reconstructionCalls() { return reconstructionCalls; } };
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
    assert.deepStrictEqual(store.committed.rows, store.initialRows);
    assert.strictEqual(store.committed.audits.length, 0);
    assert.strictEqual(store.committed.executions.length, 0);
    assert.strictEqual(store.counters.commits, 0);
}
function fakeQuery(rows) {
    return {
        select() { return this; },
        sort() { return this; },
        lean: async () => rows
    };
}
async function authoritativeAppliedState(store) {
    const employee = {
        _id: IDS.employee,
        team: SESSION.userTeam,
        company_kod: SESSION.companyInUse,
        ypokatasthma: '0001',
        kodikos: '001',
        energos: true,
        archived: false,
        kathestos_apasxolhshs: store.fixture.employment.typos_apasxolhshs,
        typos_apasxolhshs: store.fixture.employment.typos_apasxolhshs, hmeres_ergasias_ebdomadas: store.fixture.employment.workdays,
        ores_ergasias_ebdomadas:
            store.fixture.employment.workdays * store.fixture.employment.dailyHours,
        mo_oron_hmerhsias_ergasias: store.fixture.employment.dailyHours
    };
    const result = await loadWeeklyRepoTransferDecisionBatch({
        session: SESSION,
        filters: { apo_hmeromhnia: '2026-07-13', eos_hmeromhnia: '2026-07-19', ypokatasthma: '0001' },
        models: {
            prodhlomenaModel: { find: () => fakeQuery(Object.values(store.committed.rows)) },
            employeeModel: { find: () => fakeQuery([employee]) },
            historyModel: { find: () => fakeQuery([]) },
            auditModel: { find: () => fakeQuery(store.committed.audits) },
            decisionModel: { find: () => fakeQuery([store.fixture.decision]) },
            executionModel: { find: () => fakeQuery(store.committed.executions) }
        },
        holidayContextBuilder: async () => ({
            companyFlags: {
                apasxolhsh_kata_tis_argies: false,
                leitoyrgia_stis_mh_ypoxreotikes_argies: false
            },
            company_kodikos: SESSION.companyKodikos,
            argiesByDateKey: new Map()
        }),
        runtimeStateLoader: async () => ({ enabled: true }),
        indexStateLoader: async () => ({ ready: true })
    });
    const record = result.records.find((item) => item.proposal_id === store.fixture.decision.proposal_id);
    assert.ok(record);
    assert.strictEqual(record.apply_state, 'ALREADY_APPLIED');
    assert.strictEqual(record.can_apply, false);
    assert.strictEqual(record.current_execution.execution_status, 'APPLIED');
    assert.strictEqual(record.current_execution.id, String(store.committed.executions[0]._id));
    return record;
}

async function run() {
    // Static inventory only: behavioral evidence comes from the executed suites and assertions below.
    const staticCoverageInventory = COVERAGE_FILES.map((file) => fs.readFileSync(require.resolve(`./${file}`), 'utf8')).join('\n');
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
        'STALE_DECISION',
        'ALREADY_APPLIED'
    ]) {
        assert.ok(staticCoverageInventory.includes(evidence), `Static inventory missing ${evidence}`);
    }
    assert.deepStrictEqual(
        EMPLOYMENT_FIXTURES.map((item) => item.typos_apasxolhshs),
        ['PLHRHS', 'MERIKH', 'EK_PERITROPHS', 'MERIKH', 'EK_PERITROPHS']
    );
    assert.strictEqual(EMPLOYMENT_FIXTURES[3].profile_case, 'REDUCED_DAYS_AND_DAILY_HOURS');
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

    const successfulStores = [];
    for (const employment of EMPLOYMENT_FIXTURES) {
        const store = await createStore({ employment });
        const declaredWorkdays = store.fixture.context.weekRows.filter(
            (row) => row.kathgoria_ergasias === 'ΕΡΓ'
        ).length;
        const declaredNonWorkdays = store.fixture.context.weekRows.filter(
            (row) => ['ΜΕ', 'ΑΝ'].includes(row.kathgoria_ergasias)
        ).length;
        const actualWorkdaysBefore = store.fixture.context.weekRows.filter(
            (row) => Number(row.cards_ores_ergasias) > 0
        ).length;
        assert.strictEqual(declaredWorkdays, employment.workdays, employment.name);
        assert.strictEqual(declaredNonWorkdays, 7 - employment.workdays, employment.name);
        assert.strictEqual(actualWorkdaysBefore, employment.workdays, employment.name);
        if (employment.workdays === 4) {
            assert.strictEqual(store.fixture.analysis.counts.existing_actual_repo, 2);
            assert.strictEqual(store.fixture.analysis.counts.predicted_final_repo, 3);
            assert.strictEqual(
                store.fixture.analysis.employee.effective_expected_weekly_repo,
                3
            );
        }
        assert.strictEqual(store.fixture.snapshot.proposal_version, employment.proposalVersion);
        assert.strictEqual(store.fixture.snapshot.source.proposed_values.kathgoria_ergasias_apologistika, 'ΕΡΓ');
        assert.strictEqual(store.fixture.snapshot.target.proposed_values.kathgoria_ergasias_apologistika, employment.targetCategory);
        assert.strictEqual(store.fixture.snapshot.source.prodhlomena_oraria_id, IDS.source);
        assert.strictEqual(store.fixture.snapshot.target.prodhlomena_oraria_id, IDS.target);
        assert.strictEqual(store.fixture.decision.snapshot_fingerprint.length, 64);

        const success = await integratedApply(store);
        assert.strictEqual(store.reconstructionCalls, 1, `${employment.name} must use real reconstruction in preflight`);
        assert.strictEqual(success.idempotent, false);
        assert.strictEqual(success.execution.execution_status, 'APPLIED');
        assert.strictEqual(store.counters.transactions, 1);
        assert.strictEqual(store.counters.commits, 1);
        assert.strictEqual(store.counters.updates, 2);
        assert.strictEqual(store.committed.rows[IDS.source].kathgoria_ergasias_apologistika, 'ΕΡΓ');
        assert.strictEqual(store.committed.rows[IDS.target].kathgoria_ergasias_apologistika, employment.targetCategory);
        const proposedCategories = store.fixture.context.weekRows.map((row) => {
            if (String(row._id) === IDS.source) return 'ΕΡΓ';
            if (String(row._id) === IDS.target) return employment.targetCategory;
            return row.kathgoria_ergasias;
        });
        assert.strictEqual(
            proposedCategories.filter((category) => category === 'ΕΡΓ').length,
            employment.workdays,
            employment.name
        );
        assert.strictEqual(
            proposedCategories.filter((category) => ['ΜΕ', 'ΑΝ'].includes(category)).length,
            7 - employment.workdays,
            employment.name
        );
        assert.strictEqual(store.committed.audits.length, 2);
        assert.strictEqual(store.committed.executions.length, 1);
        for (const secret of ['canonical_snapshot', 'snapshot_fingerprint', 'command_identity', 'request_id']) {
            assert.ok(!Object.hasOwn(success.execution, secret));
        }

        const replay = await integratedApply(store);
        assert.strictEqual(replay.idempotent, true);
        assert.strictEqual(replay.execution.id, success.execution.id);
        assert.strictEqual(store.counters.writerCalls, 1);
        assert.strictEqual(store.counters.transactions, 1);
        assert.strictEqual(store.committed.audits.length, 2);
        assert.strictEqual(store.committed.executions.length, 1);
        await authoritativeAppliedState(store);
        successfulStores.push(store);
    }
    assert.strictEqual(successfulStores.length, EMPLOYMENT_FIXTURES.length);
    const successStore = successfulStores[1];
    const writerCallsBeforeReconstructionMismatches = successStore.counters.writerCalls;
    for (const mismatch of [
        { expected_proposal_version: successStore.fixture.employment.contractVersion === 'v1' ? 'repo-transfer-single-pair-proposal:v2' : 'repo-transfer-single-pair-proposal:v1' },
        { expected_choice_code: 'wrong-choice' },
        { expected_source_id: IDS.target },
        { expected_target_id: IDS.source }
    ]) {
        await assert.rejects(() => successStore.fixture.reconstruct(mismatch), (error) => error.statusCode === 409);
    }
    assert.strictEqual(successStore.counters.writerCalls, writerCallsBeforeReconstructionMismatches);

    await assert.rejects(
        () => integratedApply(successStore, { ...COMMAND, request_id: 'validation-request-0002' }),
        (error) => error.code === 'DECISION_ALREADY_APPLIED'
    );
    const conflictStore = await createStore();
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
        const store = await createStore();
        await assert.rejects(() => integratedApply(store, payload), (error) => error.code === code);
        assert.strictEqual(store.counters.writerCalls, 0);
    }
    const hrStore = await createStore();
    const hrSuccess = await integratedApply(hrStore, COMMAND, { ...SESSION, userRole: 'HR' });
    assert.strictEqual(hrSuccess.idempotent, false);
    assert.strictEqual(hrStore.counters.writerCalls, 1);

    const unauthorizedStore = await createStore();
    await assert.rejects(
        () => integratedApply(unauthorizedStore, COMMAND, { ...SESSION, userRole: 'U' }),
        (error) => error.code === 'APPLY_NOT_AUTHORIZED'
    );
    assert.strictEqual(unauthorizedStore.counters.writerCalls, 0);

    for (const failAt of ['before-source', 'source-update', 'target-update', 'source-audit', 'target-audit', 'execution', 'commit', 'abort']) {
        const store = await createStore({ failAt });
        await assert.rejects(() => integratedApply(store));
        assertRolledBack(store);
    }
    const unavailable = await createStore({ transactionsAvailable: false });
    await assert.rejects(() => integratedApply(unavailable), (error) => error.code === 'TRANSACTIONS_UNAVAILABLE');
    assertRolledBack(unavailable);

    assert.strictEqual(mongoose.connection.readyState, 0);
    console.log('PASS repo-transfer functional and operational validation (database-free integrated contract)');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
