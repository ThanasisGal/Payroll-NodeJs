const assert = require('assert');
const { reconstructWeeklyRepoTransferDecision, defaultContextLoader } = require('./apasxoliseisWeeklyRepoTransferDecisionReconstructionService');

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
    pair_contract: { proposal_version: 'repo-transfer-single-pair-proposal:v5', choice_code: 'choice', policy_versions: {} },
    items: [
        { role: 'SOURCE_BECOMES_WORK', prodhlomena_oraria_id: sourceId, hmeromhnia: '2026-06-15', proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' }, flags: { approval_supported: false, runtime_apply_supported: false } },
        { role: 'TARGET_BECOMES_REPO', prodhlomena_oraria_id: targetId, hmeromhnia: '2026-06-16', proposed_values: { kathgoria_ergasias_apologistika: 'ΑΝ' }, flags: { approval_supported: false, runtime_apply_supported: false } }
    ]
};
const context = { candidates: [{ _id: sourceId, team: 't', company_kod: 'c', ypokatasthma: '0001', kodikos: '001' }, { _id: targetId, team: 't', company_kod: 'c', ypokatasthma: '0001', kodikos: '001' }], weekRows: [{ _id: sourceId, hmeromhnia: '2026-06-15' }, { _id: targetId, hmeromhnia: '2026-06-16' }], employee: { _id: '507f191e810c19729de860eb' }, employmentProfile: { typos_apasxolhshs: 'PLHRHS' }, history: [], audits: [], week: { start: '2026-06-15', end: '2026-06-21' }, companyFlags: {}, companyKodikos: '0004', holidayByDateKey: new Map() };
const command = { proposal_id: 'proposal-1', expected_source_id: sourceId, expected_target_id: targetId, expected_proposal_version: 'repo-transfer-single-pair-proposal:v5', expected_choice_code: 'choice' };

function query(value) {
    return { select() { return this; }, sort() { return this; }, lean: async () => value };
}

async function borrowedDefaultContext(lendingDays, borrowingDays, duplicateCompanies = false) {
    const rows = [
        { ...context.candidates[0], hmeromhnia: new Date('2026-06-15'), kodikos: '001',
            ypokatasthma: '0001' },
        { ...context.candidates[1], hmeromhnia: new Date('2026-06-16'), kodikos: '001',
            ypokatasthma: '0001' }
    ];
    const lendingEmployee = { _id: '507f191e810c19729de860eb', team: 't', company_kod: 'c',
        kodikos: '001', ypokatasthma: '0001', hmeres_ergasias_ebdomadas: lendingDays,
        typos_apasxolhshs: 'PLHRHS', kathestos_apasxolhshs: 'PLHRHS',
        afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false,
        hmnia_enarxhs_daneismoy: new Date('2026-01-01'), hmnia_lhxhs_daneismoy: null,
        afm_daneizomenoy_ergodoth: '094259216',
        kodikos_ergazomenoy_alloy_ergodoth: 'B1' };
    const borrowingEmployee = { ...lendingEmployee, _id: '507f191e810c19729de860ec',
        company_kod: '507f191e810c19729de860ed', kodikos: 'B1',
        hmeres_ergasias_ebdomadas: borrowingDays, afora_daneismo_ergazomenoy: false };
    const companies = [{ _id: '507f191e810c19729de860ed', afm: '094259216' }];
    if (duplicateCompanies) companies.push({ _id: '507f191e810c19729de860ee', afm: '094259216' });
    let prodCalls = 0;
    return defaultContextLoader({ scope: { team: 't', company_kod: 'c',
        company_kodikos: '0004', year: '2026' }, sourceId, targetId,
        models: {
            prodhlomenaModel: { find: () => query(prodCalls++ === 0 ? rows : rows) },
            employeeModel: { find: (filter) => query(typeof filter.company_kod === 'object'
                ? [borrowingEmployee] : [lendingEmployee]) },
            historyModel: { find: () => query([]) }, auditModel: { find: () => query([]) },
            companiesModel: { find: () => query(companies) }
        },
        holidayContextBuilder: async () => ({ argiesByDateKey: new Map(), companyFlags: {} })
    });
}

async function run() {
    assert.equal((await borrowedDefaultContext(5, 6)).employmentProfile
        .hmeres_ergasias_ebdomadas, 6);
    assert.equal((await borrowedDefaultContext(6, 5)).employmentProfile
        .hmeres_ergasias_ebdomadas, 5);
    assert.equal((await borrowedDefaultContext(5, 6, true)).employmentProfile
        .resolution_blocked, true);
    const originalRows = JSON.stringify(context.weekRows);
    const result = await reconstructWeeklyRepoTransferDecision({ scope: { team: 't', company_kod: 'c' }, command, contextLoader: async () => context, projectionBuilder: () => ({ projection_status: 'READY', groups: [group] }) });
    assert.strictEqual(result.snapshot.source.prodhlomena_oraria_id, sourceId);
    assert.strictEqual(result.snapshot.target.prodhlomena_oraria_id, targetId);
    assert.deepStrictEqual(result.snapshot.repo_resolution, group.repo_resolution);
    assert.strictEqual(result.fingerprint.length, 64);
    assert.strictEqual(JSON.stringify(context.weekRows), originalRows);
    const presentationOnlyGroup = {
        ...group,
        items: [
            group.items[0],
            {
                ...group.items[1],
                kathgoria_ergasias: 'ΕΡΓ',
                current_kathgoria_ergasias_apologistika: 'ΑΔΕΙΑ'
            }
        ]
    };
    const presentationOnlyResult = await reconstructWeeklyRepoTransferDecision({
        scope: { team: 't', company_kod: 'c' },
        command,
        contextLoader: async () => context,
        projectionBuilder: () => ({
            projection_status: 'READY',
            groups: [presentationOnlyGroup]
        })
    });
    assert.strictEqual(presentationOnlyResult.fingerprint, result.fingerprint);
    assert.strictEqual(
        presentationOnlyResult.group.items[1].current_kathgoria_ergasias_apologistika,
        'ΑΔΕΙΑ'
    );
    const changedResolutionGroup = {
        ...group,
        repo_resolution: {
            ...group.repo_resolution,
            effective_expected_weekly_repo: 2,
            repo_resolution_source: 'ALTERED_CONTRACT_SOURCE',
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
