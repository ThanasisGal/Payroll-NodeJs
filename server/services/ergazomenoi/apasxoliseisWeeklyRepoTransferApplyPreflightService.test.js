const assert = require('assert');
const mongoose = require('mongoose');
const ExecutionModel = require('../../models/apasxoliseisWeeklyRepoTransferExecution');
const { fingerprintSnapshot } = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');
const { commandIdentity } = require('./apasxoliseisWeeklyRepoTransferApplyCommandService');
const { APPLY_FIELDS, APPLY_FIELD_TYPES, CURRENT_GUARD_FIELDS, validateCurrentApplyValues, validateProposed, preflightWeeklyRepoTransferApply } = require('./apasxoliseisWeeklyRepoTransferApplyPreflightService');
const SOURCE = '507f1f77bcf86cd799439012', TARGET = '507f1f77bcf86cd799439013', DECISION = '507f1f77bcf86cd799439011';
const session = { userTeam: 'team', companyInUse: 'company', userId: '507f191e810c19729de860ea', userName: 'Actor', userStatus: 'A', userRole: 'A' };
const payload = { decision_id: DECISION, request_id: 'request-0001' };
const values = Object.fromEntries(APPLY_FIELDS.map((field) => [field, field === 'repo_apologistika' || field === 'adeia_apologistika' ? false : field.includes('ores_') ? 0 : '']));
const currentValues = { ...values, cards_ores_ergasias: 8, cards_apo_ora_01: '08:00', kathgoria_ergasias: 'ΕΡΓ', ores_nyxtas_apologistika: 1 };
function snapshot() { return { proposal_id: 'proposal', proposal_version: 'v1', choice_code: 'choice', team: 'team', company_kod: 'company', ypokatasthma: 'branch', employee_id: '507f191e810c19729de860eb', employee_kodikos: '001', week_start: '2026-07-12', week_end: '2026-07-18', source: { prodhlomena_oraria_id: SOURCE, hmeromhnia: '2026-07-13', current_values: { ...currentValues }, proposed_values: { ...values, kathgoria_ergasias_apologistika: 'ΕΡΓ' }, lock_state: false }, target: { prodhlomena_oraria_id: TARGET, hmeromhnia: '2026-07-14', current_values: { ...currentValues }, proposed_values: { ...values, kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true }, lock_state: false } }; }
function setup(change = () => {}) { const snap = snapshot(); const decision = { _id: DECISION, decision_code: 'APPROVE_PROPOSAL', decision_status: 'RECORDED', canonical_snapshot: snap, proposal_id: 'proposal', team: 'team', company_kod: 'company', ypokatasthma: 'branch', employee_id: snap.employee_id, employee_kodikos: '001', week_start: new Date('2026-07-12'), week_end: new Date('2026-07-18'), source_prodhlomena_oraria_id: SOURCE, target_prodhlomena_oraria_id: TARGET }; decision.snapshot_fingerprint = fingerprintSnapshot(snap); const rebuilt = JSON.parse(JSON.stringify(snap)); change({ snap, decision, rebuilt }); return { decision, rebuilt }; }
function model(decision, executions = []) { return { decisionModel: { findOne: () => ({ lean: async () => decision }) }, executionModel: { findOne(filter) { return { lean: async () => executions.find((row) => Object.entries(filter).every(([key,value]) => String(row[key]) === String(value))) || null }; } } }; }
async function run(change, code, executions = []) { const { decision, rebuilt } = setup(change); const models = model(decision, executions); const action = () => preflightWeeklyRepoTransferApply({ session, payload, ...models, reconstruct: async () => ({ snapshot: rebuilt, fingerprint: decision.snapshot_fingerprint }) }); if (code) return assert.rejects(action, (error) => error.code === code); return action(); }
function executionFixture() { const id = () => new mongoose.Types.ObjectId(); const before = { ...values, kathgoria_adeias_apologistika: null, repo_apologistika: null, ores_apoysias_apologistika: null, apo_ora_02_apologistika: null, eos_ora_02_apologistika: null }; const snapshot = (item) => ({ source: { ...item }, target: { ...item }, source_locked: false, target_locked: false }); return { decision_id: id(), decision_fingerprint: 'f'.repeat(64), proposal_id: 'proposal', source_prodhlomena_oraria_id: id(), target_prodhlomena_oraria_id: id(), team: 'team', company_kod: 'company', ypokatasthma: 'branch', employee_id: id(), employee_kodikos: '001', week_start: new Date('2026-07-12'), week_end: new Date('2026-07-18'), request_id: 'request-0001', command_identity: 'c'.repeat(64), created_by_user_id: id(), created_by_user_name: 'Synthetic User', created_by_user_role: 'A', execution_status: 'APPLIED', before_snapshot: snapshot(before), after_snapshot: snapshot(values), applied_at: new Date('2026-07-14'), created_at: new Date('2026-07-14') }; }
function modelValidation(record) { try { return new ExecutionModel(record).validateSync(); } catch (error) { return error; } }
(async () => {
    assert.strictEqual(Object.keys(APPLY_FIELD_TYPES).length, 12);
    const proposed = { ...values };
    assert.deepStrictEqual(Object.keys(validateProposed(proposed)), APPLY_FIELDS);
    assert.strictEqual(validateProposed({ ...proposed, kathgoria_ergasias_apologistika: '' }).kathgoria_ergasias_apologistika, '');
    assert.strictEqual(validateProposed({ ...proposed, repo_apologistika: false }).repo_apologistika, false);
    assert.strictEqual(validateProposed({ ...proposed, ores_ergasias_apologistika: 0 }).ores_ergasias_apologistika, 0);
    for (const field of ['kathgoria_ergasias_apologistika','repo_apologistika','ores_ergasias_apologistika']) {
        const missing = { ...proposed }; delete missing[field];
        assert.throws(() => validateProposed(missing), (error) => error.code === 'UNSUPPORTED_PROPOSED_FIELD');
    }
    assert.throws(() => validateProposed({ ...proposed, extra: true }), (error) => error.code === 'UNSUPPORTED_PROPOSED_FIELD');
    for (const [field, value] of [['kathgoria_ergasias_apologistika', {}],['repo_apologistika', 'false'],['ores_ergasias_apologistika', '0'],['ores_ergasias_apologistika', NaN],['ores_ergasias_apologistika', Infinity]]) {
        assert.throws(() => validateProposed({ ...proposed, [field]: value }), (error) => error.code === 'INVALID_PROPOSED_VALUE');
    }
    assert.strictEqual(modelValidation(executionFixture()), undefined);
    for (const field of ['kathgoria_ergasias_apologistika','repo_apologistika','ores_ergasias_apologistika']) { const record = executionFixture(); delete record.after_snapshot.source[field]; assert.ok(modelValidation(record)); }
    { const record = executionFixture(); record.after_snapshot.source.repo_apologistika = null; assert.ok(modelValidation(record)); }
    { const record = executionFixture(); record.after_snapshot.source.extra = 'x'; assert.ok(modelValidation(record)); }
    { const record = executionFixture(); delete record.before_snapshot.source.apo_ora_02_apologistika; assert.ok(modelValidation(record)); }
    assert.deepStrictEqual(Object.keys(validateCurrentApplyValues({ ...values, apo_ora_02_apologistika: undefined })), APPLY_FIELDS); assert.strictEqual(validateCurrentApplyValues({ ...values, apo_ora_02_apologistika: undefined }).apo_ora_02_apologistika, null);
    for (const [field, value] of [['apo_ora_02_apologistika', {}],['repo_apologistika', 'false'],['ores_ergasias_apologistika', '8'],['ores_ergasias_apologistika', NaN],['ores_ergasias_apologistika', Infinity]]) assert.throws(() => validateCurrentApplyValues({ ...values, [field]: value }), (error) => error.code === 'INVALID_CURRENT_VALUE');
    const accepted = await run(); assert.strictEqual(accepted.plan.source.id, SOURCE);
    assert.strictEqual(CURRENT_GUARD_FIELDS.length, 52); assert.deepStrictEqual(Object.keys(accepted.plan.source.expected_current), CURRENT_GUARD_FIELDS); assert.ok(Object.isFrozen(accepted.plan.source.expected_current));
    for (const field of ['cards_ores_ergasias','cards_apo_ora_01','kathgoria_ergasias','ores_nyxtas_apologistika']) { assert.strictEqual(accepted.plan.source.expected_current[field], currentValues[field]); assert.strictEqual(accepted.plan.target.expected_current[field], currentValues[field]); }
    assert.deepStrictEqual(Object.keys(payload), ['decision_id','request_id']);
    await run(({ decision }) => { decision.decision_code = 'REJECT_PROPOSAL'; }, 'DECISION_NOT_APPROVED');
    await run(({ decision }) => { decision.decision_code = 'NEEDS_MORE_REVIEW'; }, 'DECISION_NOT_APPROVED');
    const missing = setup(); await assert.rejects(() => preflightWeeklyRepoTransferApply({ session, payload, ...model(null), reconstruct: async () => missing.rebuilt }), (e) => e.code === 'DECISION_NOT_FOUND');
    for (const field of ['team','company_kod','ypokatasthma','employee_id','employee_kodikos','week_start']) await run(({ rebuilt }) => { rebuilt[field] = field === 'week_start' ? '2026-07-05' : 'wrong'; }, 'SCOPE_MISMATCH');
    await run(({ decision }) => { decision.snapshot_fingerprint = 'x'; }, 'STALE_FINGERPRINT');
    await run(({ rebuilt }) => { rebuilt.source.prodhlomena_oraria_id = '507f1f77bcf86cd799439099'; }, 'PAIR_IDENTITY_MISMATCH');
    await run(({ rebuilt }) => { rebuilt.target.prodhlomena_oraria_id = '507f1f77bcf86cd799439099'; }, 'PAIR_IDENTITY_MISMATCH');
    await run(({ rebuilt }) => { rebuilt.source.current_values.repo_apologistika = true; }, 'SOURCE_STALE');
    await run(({ rebuilt }) => { rebuilt.target.current_values.repo_apologistika = true; }, 'TARGET_STALE');
    await run(({ snap, rebuilt, decision }) => { snap.source.lock_state = rebuilt.source.lock_state = true; decision.snapshot_fingerprint = fingerprintSnapshot(snap); }, 'SOURCE_LOCKED');
    await run(({ snap, rebuilt, decision }) => { snap.target.lock_state = rebuilt.target.lock_state = true; decision.snapshot_fingerprint = fingerprintSnapshot(snap); }, 'TARGET_LOCKED');
    await run(({ snap, decision }) => { snap.source.proposed_values.bad = 1; decision.snapshot_fingerprint = fingerprintSnapshot(snap); }, 'UNSUPPORTED_PROPOSED_FIELD');
    const identity = commandIdentity(payload); const existing = { team: 'team', company_kod: 'company', request_id: payload.request_id, decision_id: DECISION, command_identity: identity };
    const replay = await run(() => {}, null, [existing]); assert.strictEqual(replay.idempotent, true);
    await run(() => {}, 'REQUEST_ID_CONFLICT', [{ ...existing, command_identity: 'different' }]);
    await run(() => {}, 'DECISION_ALREADY_APPLIED', [{ ...existing, request_id: 'request-other' }]);
    console.log('weekly repo-transfer apply preflight tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
