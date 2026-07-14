const assert = require('assert');
const {
    validateCommand,
    createWeeklyRepoTransferDecision,
    listWeeklyRepoTransferDecisions,
    MAX_COMMAND_BYTES
} = require('./apasxoliseisWeeklyRepoTransferDecisionService');
const { canonicalSerialize, fingerprintSnapshot } = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');

const SOURCE = '507f1f77bcf86cd799439011';
const TARGET = '507f1f77bcf86cd799439012';
const session = { userTeam: 'team-a', companyInUse: 'company-a', yearInUse: '2026', userId: '507f191e810c19729de860ea', userName: 'HR User', userRole: 'HR', userStatus: 'A' };
const command = { proposal_id: 'policy-preview-paired-group-test', expected_source_id: SOURCE, expected_target_id: TARGET, expected_proposal_version: 'repo-transfer-single-pair-proposal:v1', expected_choice_code: 'TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR', decision_code: 'APPROVE_PROPOSAL', notes: '', request_id: 'request-0001' };

function reconstruction(fingerprint = 'a'.repeat(64)) {
    return {
        fingerprint,
        snapshot: {
            snapshot_version: 'weekly-repo-transfer-decision-snapshot:v1', proposal_id: command.proposal_id,
            canonical_group_key: 'safe-key', ypokatasthma: '0001', employee_id: '507f191e810c19729de860eb',
            employee_kodikos: '001', week_start: '2026-06-14', week_end: '2026-06-20',
            source: { prodhlomena_oraria_id: SOURCE }, target: { prodhlomena_oraria_id: TARGET }
        }
    };
}

function fakeModel(existing = []) {
    const records = [...existing];
    const queryResult = (value) => ({ lean: async () => value });
    return {
        records,
        findOne(filter) { return queryResult(records.find((row) => Object.entries(filter).every(([key, value]) => String(row[key]) === String(value))) || null); },
        async create(record) { const saved = { _id: `decision-${records.length + 1}`, created_at: new Date('2026-06-20T10:00:00Z'), ...record }; records.push(saved); return saved; },
        find() {
            let projected = records.map((record) => ({ ...record }));
            return {
                select(selection) {
                    const excluded = String(selection || '')
                        .split(/\s+/)
                        .filter((field) => field.startsWith('-'))
                        .map((field) => field.slice(1));
                    projected = projected.map((record) => {
                        const copy = { ...record };
                        excluded.forEach((field) => delete copy[field]);
                        return copy;
                    });
                    return this;
                },
                sort() {
                    projected.sort(
                        (left, right) =>
                            new Date(right.created_at || 0) - new Date(left.created_at || 0)
                    );
                    return this;
                },
                limit() { return this; },
                lean: async () => projected
            };
        }
    };
}

function assertStatus(fn, status) { assert.throws(fn, (error) => error.statusCode === status); }

async function run() {
    assert.deepStrictEqual(JSON.parse(canonicalSerialize({ b: 2, a: { d: 4, c: 3 } })), { a: { c: 3, d: 4 }, b: 2 });
    assert.strictEqual(fingerprintSnapshot({ b: 2, a: 1 }), fingerprintSnapshot({ a: 1, b: 2 }));
    ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'NEEDS_MORE_REVIEW'].forEach((decision_code) => assert.strictEqual(validateCommand({ ...command, decision_code }).decision_code, decision_code));
    assertStatus(() => validateCommand({ ...command, decision_code: 'APPROVE_PREFILL' }), 400);
    assertStatus(() => validateCommand({ ...command, extra: true }), 400);
    assertStatus(() => validateCommand({ ...command, '$where': 'x' }), 400);
    assertStatus(() => validateCommand({ ...command, expected_target_id: SOURCE }), 400);
    assertStatus(() => validateCommand({ ...command, notes: 'x'.repeat(2001) }), 400);
    assertStatus(() => validateCommand({ ...command, blob: 'x'.repeat(MAX_COMMAND_BYTES) }), 413);

    for (const decision_code of ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'NEEDS_MORE_REVIEW']) {
        const perDecisionModel = fakeModel();
        const saved = await createWeeklyRepoTransferDecision({ session, payload: { ...command, decision_code, request_id: `request-${decision_code.toLowerCase()}` }, decisionModel: perDecisionModel, reconstruct: async () => reconstruction() });
        assert.strictEqual(saved.decision.decision_code, decision_code);
        assert.strictEqual(perDecisionModel.records.length, 1);
    }

    const model = fakeModel(); let calls = 0;
    const result = await createWeeklyRepoTransferDecision({ session, payload: command, decisionModel: model, reconstruct: async () => { calls++; return reconstruction(); } });
    assert.strictEqual(result.idempotent, false); assert.strictEqual(calls, 2); assert.strictEqual(model.records.length, 1);
    assert.strictEqual(model.records[0].decision_code, 'APPROVE_PROPOSAL');
    const retry = await createWeeklyRepoTransferDecision({ session, payload: command, decisionModel: model, reconstruct: async () => { throw new Error('retry must not reconstruct'); } });
    assert.strictEqual(retry.idempotent, true); assert.strictEqual(model.records.length, 1);
    await assert.rejects(() => createWeeklyRepoTransferDecision({ session, payload: { ...command, request_id: 'request-0002' }, decisionModel: model, reconstruct: async () => reconstruction() }), (error) => error.statusCode === 409);
    await assert.rejects(() => createWeeklyRepoTransferDecision({ session, payload: { ...command, decision_code: 'REJECT_PROPOSAL', request_id: 'request-0003' }, decisionModel: model, reconstruct: async () => reconstruction() }), (error) => error.statusCode === 409);
    await assert.rejects(() => createWeeklyRepoTransferDecision({ session, payload: { ...command, request_id: 'request-0004' }, decisionModel: fakeModel(), reconstruct: async () => reconstruction(calls++ % 2 ? 'b'.repeat(64) : 'a'.repeat(64)) }), (error) => error.statusCode === 409);
    await assert.rejects(() => createWeeklyRepoTransferDecision({ session: { ...session, userStatus: 'I' }, payload: command, decisionModel: fakeModel(), reconstruct: async () => reconstruction() }), (error) => error.statusCode === 403);

    const raceModel = fakeModel();
    raceModel.create = async () => { const error = new Error('duplicate'); error.code = 11000; throw error; };
    await assert.rejects(() => createWeeklyRepoTransferDecision({ session, payload: { ...command, request_id: 'request-race' }, decisionModel: raceModel, reconstruct: async () => reconstruction() }), (error) => error.statusCode === 409);

    const history = await listWeeklyRepoTransferDecisions({ session, filters: { ypokatasthma: '0001', apo_hmeromhnia: '2026-06-01', eos_hmeromhnia: '2026-06-30' }, decisionModel: model });
    assert.strictEqual(history.length, 1); assert.strictEqual(history[0].canonical_snapshot, undefined);
    for (const ypokatasthma of ['', 'ALL', '0001,0002']) {
        await assert.rejects(() => listWeeklyRepoTransferDecisions({ session, filters: { ypokatasthma, apo_hmeromhnia: '2026-06-01', eos_hmeromhnia: '2026-06-30' }, decisionModel: model }), (error) => error.statusCode === 400);
    }
    await assert.rejects(() => listWeeklyRepoTransferDecisions({ session, filters: { ypokatasthma: '0001', apo_hmeromhnia: '2026-99-99', eos_hmeromhnia: '2026-06-30' }, decisionModel: model }), (error) => error.statusCode === 400);
    await assert.rejects(() => listWeeklyRepoTransferDecisions({ session, filters: { ypokatasthma: '0001', apo_hmeromhnia: '2026-01-01', eos_hmeromhnia: '2026-06-30' }, decisionModel: model }), (error) => error.statusCode === 400);

    const oldRecord = { ...model.records[0], _id: 'old', snapshot_fingerprint: 'b'.repeat(64), created_at: new Date('2026-06-21') };
    const currentRecord = { ...model.records[0], _id: 'current', snapshot_fingerprint: 'a'.repeat(64), created_at: new Date('2026-06-20') };
    const versionedHistory = await listWeeklyRepoTransferDecisions({
        session,
        filters: {
            ypokatasthma: '0001', apo_hmeromhnia: '2026-06-01', eos_hmeromhnia: '2026-06-30',
            proposal_id: command.proposal_id, expected_source_id: SOURCE, expected_target_id: TARGET,
            expected_proposal_version: command.expected_proposal_version,
            expected_choice_code: command.expected_choice_code
        },
        decisionModel: fakeModel([oldRecord, currentRecord]),
        reconstruct: async () => reconstruction('a'.repeat(64))
    });
    assert.strictEqual(versionedHistory.filter((record) => record.is_current).length, 1);
    assert.strictEqual(versionedHistory.find((record) => record.is_current).id, 'current');
    assert.strictEqual(versionedHistory.find((record) => record.id === 'old').is_current, false);
    versionedHistory.forEach((record) => {
        assert.strictEqual(Object.prototype.hasOwnProperty.call(record, 'snapshot_fingerprint'), false);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(record, 'canonical_snapshot'), false);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(record, 'canonical_group_key'), false);
    });
    console.log('weekly repo transfer decision service tests passed');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
