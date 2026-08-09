const assert = require('assert');
const {
    runPossibleLeaveRepoAutoRuntime
} = require('./apasxoliseisPossibleLeaveRepoAutoRuntimeService');

function fixture() {
    const base = (day, values = {}) => ({
        _id: `00000000000000000000000${day}`, team: 'T', company_kod: 'C',
        ypokatasthma: '0001', kodikos: '0001', hmeromhnia: `2026-06-0${day}`,
        kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 7.57,
        cards_ores_ergasias: 7.57, cards_apo_ora_01: '08:00',
        cards_eos_ora_01: '15:34', ...values
    });
    const source = base(1, { kathgoria_ergasias: 'ΑΝ', repo: true });
    const target = base(2, { cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '', adeia_apologistika: false,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', repo_apologistika: false });
    const existingRepo = base(3, { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0,
        cards_ores_ergasias: 0, repo_apologistika: true,
        kathgoria_ergasias_apologistika: 'ΑΝ' });
    const rows = [source, target, existingRepo, base(4), base(5), base(6), base(7)];
    const group = {
        group_id: 'pair-0001', reusable_conflict: false,
        pair_contract: { proposal_version: 'repo-transfer-single-pair-proposal:v4',
            choice_code: 'TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR' },
        items: [
            { role: 'SOURCE_BECOMES_WORK', prodhlomena_oraria_id: source._id },
            { role: 'TARGET_BECOMES_REPO', prodhlomena_oraria_id: target._id }
        ]
    };
    const approval = {
        _id: 'approval-0001', team: 'T', company_kod: 'C', ypokatasthma: '0001',
        reuse_scope: 'FUTURE_IDENTICAL', reuse_status: 'ACTIVE',
        decision_status: 'RECORDED', decision_type: 'APPROVE_PROPOSAL',
        created_by_user_name: 'Original HR', created_at: '2026-05-01T08:00:00Z',
        items: [{ role: 'SOURCE_BECOMES_WORK', kathgoria_ergasias: 'ΑΝ',
            cards_ores_ergasias: 7.57,
            proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } }]
    };
    return { rows, group, approval, source, target, existingRepo };
}

(async () => {
    const data = fixture(); let decisions = 0; let applies = 0; let persistedExecution;
    const result = await runPossibleLeaveRepoAutoRuntime({
        rows: data.rows, groups: [data.group], approvals: [data.approval], appliedExecutions: [],
        createDecision: async ({ command, authorization_metadata }) => {
            decisions += 1;
            assert.strictEqual(command.decision_code, 'APPROVE_PROPOSAL');
            assert.strictEqual(authorization_metadata.authority, 'BASED_ON_REUSABLE_HR_APPROVAL');
            return { id: '111111111111111111111111' };
        },
        applyDecision: async ({ authorization_metadata }) => {
            applies += 1;
            Object.assign(data.source, { kathgoria_ergasias_apologistika: 'ΕΡΓ',
                repo_apologistika: false, ores_ergasias_apologistika: 7.57 });
            Object.assign(data.target, { kathgoria_ergasias_apologistika: 'ΑΝ',
                repo_apologistika: true, adeia_apologistika: false,
                kathgoria_adeias_apologistika: '' });
            persistedExecution = { authorization_metadata };
            return { id: 'execution-1' };
        }
    });
    assert.strictEqual(result.results[0].status, 'AUTO_APPLIED');
    assert.strictEqual(decisions, 1); assert.strictEqual(applies, 1);
    assert.strictEqual(data.source.ores_ergasias_apologistika, 7.57);
    assert.strictEqual(data.target.kathgoria_ergasias_apologistika, 'ΑΝ');
    assert.strictEqual(data.target.repo_apologistika, true);
    assert.strictEqual(data.target.adeia_apologistika, false);
    assert.strictEqual(data.target.kathgoria_adeias_apologistika, '');
    assert.strictEqual(data.existingRepo.repo_apologistika, true);
    assert.strictEqual(persistedExecution.authorization_metadata.original_approving_user, 'Original HR');

    const replayData = fixture();
    const replay = await runPossibleLeaveRepoAutoRuntime({
        rows: replayData.rows, groups: [replayData.group], approvals: [replayData.approval],
        appliedExecutions: [persistedExecution],
        createDecision: async () => { throw new Error('must not create'); },
        applyDecision: async () => { throw new Error('must not apply'); }
    });
    assert.strictEqual(replay.results[0].status, 'ALREADY_APPLIED');
    console.log('PASS possible-leave runtime automatic apply exact 0001 (15 tests)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
