const assert = require('assert');
const { commandIdentity } = require('./apasxoliseisWeeklyRepoTransferApplyCommandService');
const { applyWeeklyRepoTransfer, presentation } = require('./apasxoliseisWeeklyRepoTransferApplyService');
const decisionId = '507f1f77bcf86cd799439011'; const payload = { decision_id: decisionId, request_id: 'request-0001' };
const session = { userTeam: 'team', companyInUse: 'company', userId: '507f191e810c19729de860ea', userName: 'Actor', userStatus: 'A', userRole: 'A' };
const record = { _id: '507f1f77bcf86cd799439099', decision_id: decisionId, proposal_id: 'proposal', execution_status: 'APPLIED', source_prodhlomena_oraria_id: 'source', target_prodhlomena_oraria_id: 'target', applied_at: new Date('2026-07-14'), team: 'team', company_kod: 'company', request_id: payload.request_id, command_identity: commandIdentity(payload) };
function executionModel(records = []) { return { findOne(filter) { return { lean: async () => records.find((row) => Object.entries(filter).every(([key,value]) => String(row[key]) === String(value))) || null }; } }; }
async function invoke({ preflight, writer, records = [] }) { return applyWeeklyRepoTransfer({ session, payload, decisionModel: {}, executionModel: executionModel(records), preflight, writer }); }
(async () => {
    assert.deepStrictEqual(presentation(record), { id: String(record._id), decision_id: decisionId, proposal_id: 'proposal', execution_status: 'APPLIED', source_id: 'source', target_id: 'target', applied_at: record.applied_at });
    let writes = 0; const success = await invoke({ preflight: async () => ({ plan: {} }), writer: async () => { writes++; return record; } }); assert.strictEqual(success.idempotent, false); assert.strictEqual(writes, 1);
    writes = 0; const replay = await invoke({ preflight: async () => ({ execution: record, idempotent: true }), writer: async () => { writes++; } }); assert.strictEqual(replay.idempotent, true); assert.strictEqual(writes, 0);
    for (const code of ['REQUEST_ID_CONFLICT','DECISION_ALREADY_APPLIED']) await assert.rejects(() => invoke({ preflight: async () => { const e = new Error(code); e.code = code; e.statusCode = 409; throw e; }, writer: async () => { writes++; } }), (e) => e.code === code);
    const duplicate = Object.assign(new Error('duplicate'), { code: 11000 });
    const raced = await invoke({ preflight: async () => ({ plan: {} }), writer: async () => { writes++; throw duplicate; }, records: [record] }); assert.strictEqual(raced.idempotent, true);
    await assert.rejects(() => invoke({ preflight: async () => ({ plan: {} }), writer: async () => { throw duplicate; }, records: [{ ...record, command_identity: 'other' }] }), (e) => e.code === 'REQUEST_ID_CONFLICT');
    const unsafe = Object.assign(new Error('failure'), { statusCode: 503, secret: 'not-presented' }); await assert.rejects(() => invoke({ preflight: async () => ({ plan: {} }), writer: async () => { throw unsafe; } }), (e) => e === unsafe);
    let failureWrites = 0; await assert.rejects(() => invoke({ preflight: async () => ({ plan: {} }), writer: async () => { failureWrites++; throw new Error('writer'); } })); assert.strictEqual(failureWrites, 1);
    console.log('weekly repo-transfer apply service tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
