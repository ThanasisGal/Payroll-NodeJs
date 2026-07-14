const assert = require('assert');
const { reconstructWeeklyRepoTransferDecision } = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');

const sourceId = '507f1f77bcf86cd799439011';
const targetId = '507f1f77bcf86cd799439012';
const group = {
    group_id: 'proposal-1', group_key: 'key', group_type: 'ATOMIC_PAIRED_PROPOSAL', scenario_code: 'REPO_TRANSFER_WITHIN_WEEK_SINGLE_PAIR',
    policy_code: 'WEEKLY_REPO_BALANCE', secondary_policy_code: 'DECLARED_REPO_OR_NON_WORK_WITH_CARDS',
    pair_contract: { proposal_version: 'v1', choice_code: 'choice', policy_versions: {} },
    items: [
        { role: 'SOURCE_BECOMES_WORK', prodhlomena_oraria_id: sourceId, hmeromhnia: '2026-06-15', proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' }, flags: { approval_supported: false, runtime_apply_supported: false } },
        { role: 'TARGET_BECOMES_REPO', prodhlomena_oraria_id: targetId, hmeromhnia: '2026-06-16', proposed_values: { kathgoria_ergasias_apologistika: 'ΑΝ' }, flags: { approval_supported: false, runtime_apply_supported: false } }
    ]
};
const context = { candidates: [{ _id: sourceId, team: 't', company_kod: 'c', ypokatasthma: '0001', kodikos: '001' }, { _id: targetId, team: 't', company_kod: 'c', ypokatasthma: '0001', kodikos: '001' }], weekRows: [{ _id: sourceId, hmeromhnia: '2026-06-15' }, { _id: targetId, hmeromhnia: '2026-06-16' }], employee: { _id: '507f191e810c19729de860eb' }, employmentProfile: {}, history: [], audits: [], week: { start: '2026-06-14', end: '2026-06-20' }, companyFlags: {}, companyKodikos: '0004', holidayByDateKey: new Map() };
const command = { proposal_id: 'proposal-1', expected_source_id: sourceId, expected_target_id: targetId, expected_proposal_version: 'v1', expected_choice_code: 'choice' };

async function run() {
    const originalRows = JSON.stringify(context.weekRows);
    const result = await reconstructWeeklyRepoTransferDecision({ scope: { team: 't', company_kod: 'c' }, command, contextLoader: async () => context, projectionBuilder: () => ({ projection_status: 'READY', groups: [group] }) });
    assert.strictEqual(result.snapshot.source.prodhlomena_oraria_id, sourceId);
    assert.strictEqual(result.snapshot.target.prodhlomena_oraria_id, targetId);
    assert.strictEqual(result.fingerprint.length, 64);
    assert.strictEqual(JSON.stringify(context.weekRows), originalRows);
    const holidayChanged = {
        ...context,
        holidayByDateKey: new Map([
            ['2026-06-16', { isHoliday: true, isMandatoryHoliday: false, companyOperatesOnHoliday: false, blocksRepoTransfer: true }]
        ])
    };
    const changedResult = await reconstructWeeklyRepoTransferDecision({ scope: { team: 't', company_kod: 'c' }, command, contextLoader: async () => holidayChanged, projectionBuilder: () => ({ projection_status: 'READY', groups: [group] }) });
    assert.notStrictEqual(changedResult.fingerprint, result.fingerprint);
    for (const changed of [
        { expected_source_id: targetId }, { expected_target_id: sourceId }, { expected_proposal_version: 'v2' }, { expected_choice_code: 'other' }
    ]) await assert.rejects(() => reconstructWeeklyRepoTransferDecision({ scope: { team: 't', company_kod: 'c' }, command: { ...command, ...changed }, contextLoader: async () => context, projectionBuilder: () => ({ projection_status: 'READY', groups: [group] }) }), (error) => error.statusCode === 409);
    await assert.rejects(() => reconstructWeeklyRepoTransferDecision({ scope: { team: 't', company_kod: 'c' }, command, contextLoader: async () => context, projectionBuilder: () => ({ projection_status: 'READY', groups: [{ ...group, items: [group.items[0]] }] }) }), (error) => error.statusCode === 409);
    console.log('weekly repo transfer decision reconstruction tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
