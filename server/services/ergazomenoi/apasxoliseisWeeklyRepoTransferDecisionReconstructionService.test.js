const assert = require('assert');
const { reconstructWeeklyRepoTransferDecision } = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');

const sourceId = '507f1f77bcf86cd799439011';
const targetId = '507f1f77bcf86cd799439012';
const group = {
    group_id: 'proposal-1', group_key: 'key', group_type: 'ATOMIC_PAIRED_PROPOSAL', scenario_code: 'REPO_TRANSFER_WITHIN_WEEK_SINGLE_PAIR',
    policy_code: 'WEEKLY_REPO_BALANCE', secondary_policy_code: 'DECLARED_REPO_OR_NON_WORK_WITH_CARDS',
    repo_resolution: {
        effective_expected_weekly_repo: 1,
        repo_resolution_source: 'SIX_SCHEDULED_WORK_DAYS',
        scheduled_work_days: 6,
        effective_weekly_workdays: 6
    },
    pair_contract: { proposal_version: 'repo-transfer-single-pair-proposal:v3', choice_code: 'choice', policy_versions: {} },
    items: [
        { role: 'SOURCE_BECOMES_WORK', prodhlomena_oraria_id: sourceId, hmeromhnia: '2026-06-15', proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' }, flags: { approval_supported: false, runtime_apply_supported: false } },
        { role: 'TARGET_BECOMES_REPO', prodhlomena_oraria_id: targetId, hmeromhnia: '2026-06-16', proposed_values: { kathgoria_ergasias_apologistika: 'ΑΝ' }, flags: { approval_supported: false, runtime_apply_supported: false } }
    ]
};
const context = { candidates: [{ _id: sourceId, team: 't', company_kod: 'c', ypokatasthma: '0001', kodikos: '001' }, { _id: targetId, team: 't', company_kod: 'c', ypokatasthma: '0001', kodikos: '001' }], weekRows: [{ _id: sourceId, hmeromhnia: '2026-06-15' }, { _id: targetId, hmeromhnia: '2026-06-16' }], employee: { _id: '507f191e810c19729de860eb' }, employmentProfile: { typos_apasxolhshs: 'PLHRHS' }, history: [], audits: [], week: { start: '2026-06-15', end: '2026-06-21' }, companyFlags: {}, companyKodikos: '0004', holidayByDateKey: new Map() };
const command = { proposal_id: 'proposal-1', expected_source_id: sourceId, expected_target_id: targetId, expected_proposal_version: 'repo-transfer-single-pair-proposal:v3', expected_choice_code: 'choice' };

async function run() {
    const originalRows = JSON.stringify(context.weekRows);
    const result = await reconstructWeeklyRepoTransferDecision({ scope: { team: 't', company_kod: 'c' }, command, contextLoader: async () => context, projectionBuilder: () => ({ projection_status: 'READY', groups: [group] }) });
    assert.strictEqual(result.snapshot.source.prodhlomena_oraria_id, sourceId);
    assert.strictEqual(result.snapshot.target.prodhlomena_oraria_id, targetId);
    assert.deepStrictEqual(result.snapshot.repo_resolution, group.repo_resolution);
    assert.strictEqual(result.fingerprint.length, 64);
    assert.strictEqual(JSON.stringify(context.weekRows), originalRows);
    const changedResolutionGroup = {
        ...group,
        repo_resolution: {
            ...group.repo_resolution,
            effective_expected_weekly_repo: 2,
            repo_resolution_source: 'EXPLICIT_MHNIAIA_REPO',
            scheduled_work_days: 5,
            effective_weekly_workdays: 5
        }
    };
    const changedResolution = await reconstructWeeklyRepoTransferDecision({
        scope: { team: 't', company_kod: 'c' },
        command,
        contextLoader: async () => context,
        projectionBuilder: () => ({
            projection_status: 'READY',
            groups: [changedResolutionGroup]
        })
    });
    assert.notStrictEqual(changedResolution.fingerprint, result.fingerprint);
    const holidayChanged = {
        ...context,
        holidayByDateKey: new Map([
            ['2026-06-16', { isHoliday: true, isMandatoryHoliday: false, companyOperatesOnHoliday: false, blocksRepoTransfer: true }]
        ])
    };
    const changedResult = await reconstructWeeklyRepoTransferDecision({ scope: { team: 't', company_kod: 'c' }, command, contextLoader: async () => holidayChanged, projectionBuilder: () => ({ projection_status: 'READY', groups: [group] }) });
    assert.notStrictEqual(changedResult.fingerprint, result.fingerprint);
    for (const changed of [
        { expected_source_id: targetId }, { expected_target_id: sourceId }, { expected_proposal_version: 'repo-transfer-single-pair-proposal:v2' }, { expected_choice_code: 'other' }
    ]) await assert.rejects(() => reconstructWeeklyRepoTransferDecision({ scope: { team: 't', company_kod: 'c' }, command: { ...command, ...changed }, contextLoader: async () => context, projectionBuilder: () => ({ projection_status: 'READY', groups: [group] }) }), (error) => error.statusCode === 409);
    for (const shorthand of ['v1', 'v2', 'future']) {
        await assert.rejects(
            () => reconstructWeeklyRepoTransferDecision({
                scope: { team: 't', company_kod: 'c' },
                command: { ...command, expected_proposal_version: shorthand },
                contextLoader: async () => context,
                projectionBuilder: () => ({ projection_status: 'READY', groups: [group] })
            }),
            (error) => error.statusCode === 409
        );
    }
    await assert.rejects(() => reconstructWeeklyRepoTransferDecision({ scope: { team: 't', company_kod: 'c' }, command, contextLoader: async () => context, projectionBuilder: () => ({ projection_status: 'READY', groups: [{ ...group, items: [group.items[0]] }] }) }), (error) => error.statusCode === 409);
    console.log('weekly repo transfer decision reconstruction tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
