const assert = require('assert');

const {
    analyzeWeeklyRepoTransferSinglePairV1,
    analyzeWeeklyRepoTransferSinglePairV2,
    normalizeEmploymentType,
    employmentFamily
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const {
    buildWeeklyRepoTransferSinglePairProposal,
    PROPOSAL_VERSION_V2
} = require('./apasxoliseisWeeklyRepoTransferSinglePairProposalService');
const {
    buildWeeklyRepoTransferSinglePairGroupProjection
} = require('./apasxoliseisWeeklyRepoTransferSinglePairGroupProjectionService');
const {
    buildWeeklyRepoTransferAtomicPageProjection
} = require('./apasxoliseisWeeklyRepoTransferAtomicPageProjectionService');
const {
    buildApasxoliseisScenarioFacts
} = require('./apasxoliseisScenarioFactsService');

const START = '2026-07-05';

function date(offset) {
    const value = new Date(`${START}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
}

function row(offset, values = {}) {
    return {
        _id: `507f1f77bcf86cd7994390${10 + offset}`,
        team: 'team',
        company_kod: 'company',
        ypokatasthma: '0001',
        kodikos: '001',
        hmeromhnia: date(offset),
        kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 4,
        apo_ora_01: '09:00',
        eos_ora_01: '13:00',
        cards_ores_ergasias: 4,
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '13:00',
        ...values
    };
}

function week({ sources = [1], targets = [3], existingRepo = [] } = {}) {
    const rows = Array.from({ length: 7 }, (_, offset) => row(offset));
    sources.forEach((offset) => Object.assign(rows[offset], {
        kathgoria_ergasias: 'ΜΕ',
        ores_ergasias: 0,
        apo_ora_01: '',
        eos_ora_01: ''
    }));
    targets.forEach((offset) => Object.assign(rows[offset], {
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    }));
    existingRepo.forEach((offset) => Object.assign(rows[offset], {
        kathgoria_ergasias: 'ΜΕ',
        ores_ergasias: 0,
        apo_ora_01: '',
        eos_ora_01: '',
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    }));
    return rows;
}

function analyze(rows, type = 'MERIKH', profile = {}, contexts = {}) {
    return analyzeWeeklyRepoTransferSinglePairV2({
        weekRows: rows,
        employmentProfile: {
            typos_apasxolhshs: type,
            mhniaia_repo: 1,
            ...profile
        },
        holidayByDateKey: contexts.holidayByDateKey || new Map(),
        existingAuditCountByRowKey: contexts.existingAuditCountByRowKey || new Map()
    });
}

function assertEquivalentPartialPolicy(rows, profile = {}) {
    const merikhV1 = analyzeWeeklyRepoTransferSinglePairV1({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 1, ...profile }
    });
    for (const type of ['MERIKH', 'EK_PERITROPHS', '2', '02', 'EK_PERITROPIS', 'ROTATIONAL']) {
        const result = analyze(rows, type, profile);
        assert.strictEqual(result.eligibility_status, merikhV1.eligibility_status, type);
        assert.deepStrictEqual(result.reasons, merikhV1.reasons, type);
        assert.strictEqual(result.counts.existing_actual_repo, merikhV1.counts.existing_actual_repo);
        assert.strictEqual(result.counts.predicted_final_repo, merikhV1.counts.predicted_final_repo);
    }
}

{
    const rows = week();
    assertEquivalentPartialPolicy(rows);
    const result = analyze(rows, 'EK_PERITROPHS');
    assert.strictEqual(result.eligibility_status, 'ELIGIBLE');
    assert.strictEqual(result.scenario_version, 'repo-transfer-single-pair:v2');
    assert.strictEqual(result.source.semantic_target_category, 'ΕΡΓ');
    assert.strictEqual(result.target.semantic_target_category, 'ΜΕ');
    assert.strictEqual(result.counts.existing_actual_repo, 0);
    assert.strictEqual(result.counts.predicted_final_repo, 1);
}

assertEquivalentPartialPolicy(week(), { mo_oron_hmerhsias_ergasias: 4 });

for (const alias of ['1', 'PARTIAL', '2', '02', 'EK_PERITROPHS', 'EK_PERITROPIS', 'EK_PERITROPH', 'ROTATIONAL']) {
    assert.strictEqual(employmentFamily(normalizeEmploymentType(alias)), 'PARTIAL_FAMILY');
}

{
    const result = analyze(week(), 'MERIKH', { mhniaia_repo: 0 });
    assert.strictEqual(result.eligibility_status, 'ELIGIBLE');
    assert.strictEqual(result.employee.mhniaia_repo, 1);
    assert.strictEqual(result.employee.repo_resolution_source, 'SIX_SCHEDULED_WORK_DAYS');
}

{
    const fourDayWeek = week({ sources: [1], targets: [3], existingRepo: [0, 6] });
    for (const type of ['MERIKH', 'EK_PERITROPHS']) {
        const result = analyze(fourDayWeek, type, {
            hmeres_ergasias_ebdomadas: 4,
            ores_ergasias_ebdomadas: 16,
            mo_oron_hmerhsias_ergasias: 4,
            mhniaia_repo: 3
        });
        assert.strictEqual(result.eligibility_status, 'ELIGIBLE', type);
        assert.strictEqual(result.scenario_version, 'repo-transfer-single-pair:v2');
        assert.strictEqual(result.employee.typos_apasxolhshs, type);
        assert.strictEqual(result.employee.mhniaia_repo, 3);
        assert.strictEqual(result.counts.existing_actual_repo, 2);
        assert.strictEqual(result.counts.predicted_final_repo, 3);
        assert.strictEqual(result.source.semantic_target_category, 'ΕΡΓ');
        assert.strictEqual(result.target.semantic_target_category, 'ΜΕ');
        assert.strictEqual(result.semantic_proposal.employment_family, 'PARTIAL_FAMILY');

        const proposal = buildWeeklyRepoTransferSinglePairProposal({
            weekRows: fourDayWeek,
            employmentProfile: {
                typos_apasxolhshs: type,
                hmeres_ergasias_ebdomadas: 4,
                mhniaia_repo: 3,
                mo_oron_hmerhsias_ergasias: 4
            },
            contractVersion: 'v2'
        });
        assert.strictEqual(proposal.proposal_status, 'READY');
        assert.strictEqual(proposal.proposal_version, PROPOSAL_VERSION_V2);
        assert.strictEqual(
            proposal.items[1].proposed_values.kathgoria_ergasias_apologistika,
            'ΜΕ'
        );

        const projection = buildWeeklyRepoTransferSinglePairGroupProjection({
            weekRows: fourDayWeek,
            employmentProfile: {
                typos_apasxolhshs: type,
                hmeres_ergasias_ebdomadas: 4,
                mhniaia_repo: 3,
                mo_oron_hmerhsias_ergasias: 4
            },
            contractVersion: 'v2'
        });
        assert.strictEqual(projection.projection_status, 'READY');
        assert.strictEqual(projection.groups.length, 1);
    }
}

{
    const v1 = analyzeWeeklyRepoTransferSinglePairV1({
        weekRows: week({ existingRepo: [0, 6] }),
        employmentProfile: {
            typos_apasxolhshs: 'MERIKH',
            hmeres_ergasias_ebdomadas: 4,
            mhniaia_repo: 3
        }
    });
    assert.strictEqual(v1.eligibility_status, 'ELIGIBLE');
    assert.strictEqual(v1.employee.mhniaia_repo, 3);
}

{
    const deficit = analyze(week(), 'MERIKH', { mhniaia_repo: 2 });
    assert.strictEqual(deficit.eligibility_status, 'ELIGIBLE');
    assert.strictEqual(deficit.employee.repo_resolution_source, 'SIX_SCHEDULED_WORK_DAYS');

    const exceeded = analyze(week({ existingRepo: [6] }), 'MERIKH', { mhniaia_repo: 1 });
    assert.strictEqual(exceeded.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(exceeded.reasons.includes('REPO_LIMIT_EXCEEDED'));
}

{
    const result = analyze(week({ sources: [1, 2] }));
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(result.reasons.includes('MULTIPLE_SOURCE_CANDIDATES'));
}

{
    const result = analyze(week({ targets: [2, 4] }));
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(result.reasons.includes('MULTIPLE_TARGET_CANDIDATES'));
    assert.strictEqual(result.target, null);
}

for (const [label, mutate, context, reason] of [
    ['locked source', (rows) => { rows[1].is_locked = true; }, {}, 'SOURCE_LOCKED'],
    ['audited source', () => {}, { existingAuditCountByRowKey: new Map([['507f1f77bcf86cd799439011', 1]]) }, 'SOURCE_MANUAL_OVERRIDE'],
    ['leave source', (rows) => { rows[1].adeia = true; }, {}, 'SOURCE_LEAVE_OR_SICKNESS'],
    ['sick source', (rows) => { rows[1].astheneia = true; }, {}, 'SOURCE_LEAVE_OR_SICKNESS'],
    ['incomplete cards', (rows) => { rows[1].cards_eos_ora_01 = ''; }, {}, 'NO_SOURCE_CANDIDATE'],
    ['card hours without interval', (rows) => { rows[1].cards_apo_ora_01 = ''; rows[1].cards_eos_ora_01 = ''; }, {}, 'NO_SOURCE_CANDIDATE']
]) {
    const rows = week();
    mutate(rows);
    const result = analyze(rows, 'MERIKH', {}, context);
    assert.notStrictEqual(result.eligibility_status, 'ELIGIBLE', label);
    assert.ok(result.reasons.includes(reason), `${label}: ${result.reasons.join(',')}`);
}

{
    const rows = week();
    rows[3].is_locked = true;
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(result.reasons.includes('TARGET_LOCKED'));
    assert.ok(!result.reasons.includes('NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'));
    assert.strictEqual(result.semantic_proposal.operation_type, 'PARTIAL_OFFSET_TARGET_BLOCKED');
    assert.deepStrictEqual(result.semantic_proposal.investigation_guidance, []);
}

{
    const result = analyze(week(), 'MERIKH', {}, {
        existingAuditCountByRowKey: new Map([['507f1f77bcf86cd799439013', 1]])
    });
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(result.reasons.includes('TARGET_MANUAL_OVERRIDE'));
}

for (const mutate of [
    (rows) => { rows[3].adeia = true; },
    (rows) => { rows[3].astheneia = true; }
]) {
    const rows = week();
    mutate(rows);
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(result.reasons.includes('TARGET_LEAVE_OR_SICKNESS'));
}

{
    const rows = week();
    const holidayByDateKey = new Map([[date(1), { isHoliday: true, isMandatoryHoliday: true }]]);
    const result = analyze(rows, 'MERIKH', {}, { holidayByDateKey });
    assert.notStrictEqual(result.eligibility_status, 'ELIGIBLE');
    assert.ok(result.reasons.includes('SOURCE_HOLIDAY'));
}

{
    const holidayByDateKey = new Map([[date(3), { isHoliday: true, isMandatoryHoliday: true }]]);
    const result = analyze(week(), 'MERIKH', {}, { holidayByDateKey });
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(result.reasons.includes('TARGET_HOLIDAY'));
}

{
    const rows = week();
    rows[3].ores_ergasias = 0;
    rows[3].apo_ora_01 = '';
    rows[3].eos_ora_01 = '';
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(result.reasons.includes('NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'));
    assert.strictEqual(
        result.semantic_proposal.operation_type,
        'PARTIAL_UNEXPECTED_WORK_WITHOUT_OFFSET_DAY'
    );
}

{
    const rows = week();
    rows[3].cards_apo_ora_01 = '09:00';
    rows[3].cards_eos_ora_01 = '13:00';
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.strictEqual(result.semantic_proposal.operation_type, 'PARTIAL_OFFSET_TARGET_BLOCKED');
    assert.ok(result.reasons.includes('TARGET_ZERO_HOURS_WITH_CARD_INTERVALS'));
    assert.ok(!result.reasons.includes('NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'));
    assert.deepStrictEqual(result.semantic_proposal.investigation_guidance, []);
    assert.deepStrictEqual(result.semantic_proposal.blocked_target_reasons, [
        'TARGET_ZERO_HOURS_WITH_CARD_INTERVALS'
    ]);

    const proposal = buildWeeklyRepoTransferSinglePairProposal({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 1 },
        contractVersion: 'v2'
    });
    assert.strictEqual(proposal.review_only_outcome.outcome_code, 'PARTIAL_OFFSET_TARGET_BLOCKED');
    assert.deepStrictEqual(proposal.review_only_outcome.investigation_guidance, []);
    assert.strictEqual(proposal.items.length, 0);
    assert.strictEqual(proposal.group_id, undefined);
    assert.strictEqual(proposal.decision_payload, undefined);
    assert.strictEqual(proposal.writer_plan, undefined);
}

{
    const rows = week();
    rows[3].cards_apo_ora_01 = '09:00';
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.strictEqual(result.semantic_proposal.operation_type, 'PARTIAL_OFFSET_TARGET_BLOCKED');
    assert.ok(result.reasons.includes('TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR'));
    assert.ok(!result.reasons.includes('NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'));
    assert.deepStrictEqual(result.semantic_proposal.investigation_guidance, []);
}

{
    const rows = week();
    rows[3].cards_apo_ora_01 = '09:00';
    rows[3].cards_eos_ora_01 = '09:00';
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.strictEqual(result.semantic_proposal.operation_type, 'PARTIAL_OFFSET_TARGET_BLOCKED');
    assert.ok(result.reasons.includes('TARGET_ZERO_HOURS_WITH_ZERO_LENGTH_CARD_INTERVAL'));
    assert.ok(!result.reasons.includes('NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'));
    assert.deepStrictEqual(result.semantic_proposal.investigation_guidance, []);

    const proposal = buildWeeklyRepoTransferSinglePairProposal({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 1 },
        contractVersion: 'v2'
    });
    assert.strictEqual(proposal.review_only_outcome.outcome_code, 'PARTIAL_OFFSET_TARGET_BLOCKED');
    assert.strictEqual(proposal.items.length, 0);
    assert.strictEqual(proposal.decision_payload, undefined);
    assert.strictEqual(proposal.writer_plan, undefined);
}

for (const invalidCardHours of ['invalid', -1, NaN, Infinity, -Infinity, {}, []]) {
    const rows = week();
    rows[3].cards_ores_ergasias = invalidCardHours;
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.strictEqual(result.semantic_proposal.operation_type, 'PARTIAL_OFFSET_TARGET_BLOCKED');
    assert.ok(result.reasons.includes('TARGET_INVALID_CARD_HOURS_VALUE'));
    assert.ok(!result.reasons.includes('NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'));
    assert.deepStrictEqual(result.semantic_proposal.investigation_guidance, []);
}

for (const zeroCardHours of [0, '0', '0,00', '0.00', '', null]) {
    const rows = week();
    rows[3].cards_ores_ergasias = zeroCardHours;
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'ELIGIBLE');
    assert.strictEqual(result.target.hmeromhnia, date(3));
}

{
    const rows = week({ targets: [] });
    const result = analyze(rows);
    assert.strictEqual(result.semantic_proposal.operation_type, 'PARTIAL_UNEXPECTED_WORK_WITHOUT_OFFSET_DAY');
    assert.ok(!result.reasons.includes('TARGET_INVALID_CARD_HOURS_VALUE'));
}

for (const invalidTimes of [
    { cards_apo_ora_01: 'invalid', cards_eos_ora_01: '13:00' },
    { cards_apo_ora_01: '09:00', cards_eos_ora_01: 'invalid' },
    { cards_apo_ora_01: 'invalid', cards_eos_ora_01: 'also-invalid' },
    { cards_apo_ora_02: '25:00', cards_eos_ora_02: '13:00' },
    { cards_apo_ora_03: '09:00', cards_eos_ora_03: '99:00' }
]) {
    const rows = week();
    Object.assign(rows[3], invalidTimes);
    const facts = buildApasxoliseisScenarioFacts(rows[3]);
    assert.strictEqual(facts.cards.hasInvalidCardTimeValue, true);
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.strictEqual(result.semantic_proposal.operation_type, 'PARTIAL_OFFSET_TARGET_BLOCKED');
    assert.ok(result.reasons.includes('TARGET_INVALID_CARD_TIME_VALUE'));
    assert.ok(!result.reasons.includes('NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'));
}

{
    const rows = week({ targets: [] });
    rows[3].cards_ores_ergasias = 2;
    rows[3].cards_apo_ora_01 = '09:00';
    rows[3].cards_eos_ora_01 = '11:00';
    const result = analyze(rows);
    assert.strictEqual(result.semantic_proposal.operation_type, 'PARTIAL_UNEXPECTED_WORK_WITHOUT_OFFSET_DAY');
    assert.ok(!result.reasons.includes('TARGET_INVALID_CARD_HOURS_VALUE'));
}

{
    const rows = week({ targets: [2, 4] });
    rows[4].cards_apo_ora_01 = '10:00';
    rows[4].cards_eos_ora_01 = '14:00';
    rows[2].cards_apo_ora_01 = '09:00';
    const result = analyze(rows);
    assert.strictEqual(result.semantic_proposal.operation_type, 'PARTIAL_OFFSET_TARGET_BLOCKED');
    assert.deepStrictEqual(result.semantic_proposal.blocked_target_reasons, [
        'TARGET_ZERO_HOURS_WITH_CARD_INTERVALS',
        'TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR'
    ]);
    assert.deepStrictEqual(
        result.semantic_proposal.blocked_target_candidates.map((target) => ({
            date: target.hmeromhnia,
            reasons: target.blocker_reasons
        })),
        [
            {
                date: date(2),
                reasons: ['TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR']
            },
            {
                date: date(4),
                reasons: ['TARGET_ZERO_HOURS_WITH_CARD_INTERVALS']
            }
        ]
    );
    assert.strictEqual(result.semantic_proposal.blocked_target_candidates_count, 2);
}

{
    const rows = week({ targets: [2, 4] });
    rows[4].cards_apo_ora_01 = '10:00';
    rows[4].cards_eos_ora_01 = '10:00';
    const v1 = analyzeWeeklyRepoTransferSinglePairV1({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 1 }
    });
    const v2 = analyze(rows);
    assert.ok(v1.reasons.includes('MULTIPLE_TARGET_CANDIDATES'));
    assert.strictEqual(v2.eligibility_status, v1.eligibility_status);
    assert.ok(v2.reasons.includes('MULTIPLE_TARGET_CANDIDATES'));
}

{
    const rows = week({ targets: [2, 4] });
    rows[4].cards_ores_ergasias = 'invalid';
    const v1 = analyzeWeeklyRepoTransferSinglePairV1({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 1 }
    });
    const v2 = analyze(rows);
    assert.strictEqual(v1.eligibility_status, 'ELIGIBLE');
    assert.strictEqual(v2.eligibility_status, v1.eligibility_status);
    assert.strictEqual(v2.target.hmeromhnia, date(2));
}

{
    const rows = week({ targets: [2, 4] });
    rows[4].cards_apo_ora_01 = '10:00';
    rows[4].cards_eos_ora_01 = '14:00';
    const v1 = analyzeWeeklyRepoTransferSinglePairV1({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 1 }
    });
    const v2 = analyze(rows);
    assert.strictEqual(v1.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(v1.reasons.includes('MULTIPLE_TARGET_CANDIDATES'));
    assert.strictEqual(v2.eligibility_status, v1.eligibility_status);
    assert.ok(v2.reasons.includes('MULTIPLE_TARGET_CANDIDATES'));
    assert.strictEqual(v2.target, null);
    assert.strictEqual(v2.semantic_proposal, null);
}

{
    const blockerCases = [
        {
            name: 'audit',
            mutate: () => {},
            contexts: {
                existingAuditCountByRowKey: new Map([
                    ['507f1f77bcf86cd799439013', 1]
                ])
            },
            reason: 'TARGET_MANUAL_OVERRIDE'
        },
        {
            name: 'leave',
            mutate: (rows) => { rows[3].adeia = true; },
            contexts: {},
            reason: 'TARGET_LEAVE_OR_SICKNESS'
        },
        {
            name: 'holiday',
            mutate: () => {},
            contexts: {
                holidayByDateKey: new Map([
                    [date(3), { isHoliday: true, isMandatoryHoliday: true }]
                ])
            },
            reason: 'TARGET_HOLIDAY'
        },
        {
            name: 'already processed',
            mutate: (rows) => {
                rows[3].kathgoria_ergasias_apologistika = 'ΜΕ';
                rows[3].repo_apologistika = true;
            },
            contexts: {},
            reason: 'TARGET_ALREADY_PROCESSED'
        },
        {
            name: 'invalid apologistika numeric',
            mutate: (rows) => { rows[3].ores_ergasias_apologistika = 'invalid'; },
            contexts: {},
            reason: 'TARGET_INVALID_APOLOGISTIKA_NUMERIC_VALUE'
        }
    ];
    blockerCases.forEach(({ name, mutate, contexts, reason }) => {
        const rows = week();
        mutate(rows);
        const result = analyze(rows, 'MERIKH', {}, contexts);
        assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW', name);
        assert.ok(result.reasons.includes(reason), name);
        assert.ok(!result.reasons.includes('NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'), name);
        assert.strictEqual(
            result.semantic_proposal.operation_type,
            'PARTIAL_OFFSET_TARGET_BLOCKED',
            name
        );
        assert.deepStrictEqual(result.semantic_proposal.investigation_guidance, [], name);

        const proposal = buildWeeklyRepoTransferSinglePairProposal({
            weekRows: rows,
            employmentProfile: { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 1 },
            contractVersion: 'v2',
            ...contexts
        });
        assert.strictEqual(proposal.review_only_outcome.outcome_code, 'PARTIAL_OFFSET_TARGET_BLOCKED');
        assert.deepStrictEqual(proposal.investigation_guidance, []);
        assert.deepStrictEqual(proposal.review_only_outcome.investigation_guidance, []);
        assert.strictEqual(
            proposal.review_only_outcome.apply_readiness.reason,
            'OFFSET_TARGET_BLOCKED'
        );
        assert.strictEqual(proposal.atomic_pair_required, false);
        assert.strictEqual(proposal.items.length, 0);
    });
}

{
    const rows = week({ targets: [2, 4] });
    rows[4].is_locked = true;
    rows[2].adeia = true;
    const result = analyze(rows);
    assert.strictEqual(result.semantic_proposal.operation_type, 'PARTIAL_OFFSET_TARGET_BLOCKED');
    assert.deepStrictEqual(result.semantic_proposal.blocked_target_reasons, [
        'TARGET_ALREADY_PROCESSED',
        'TARGET_LEAVE_OR_SICKNESS',
        'TARGET_LOCKED'
    ]);
    assert.deepStrictEqual(
        result.semantic_proposal.blocked_target_candidates.map((target) => target.hmeromhnia),
        [date(2), date(4)]
    );
    assert.strictEqual(result.semantic_proposal.blocked_target_candidates_count, 2);
    assert.strictEqual(result.target, null);
}

{
    const rows = week({ targets: [] });
    rows[1].cards_ores_ergasias = '4,5';
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.deepStrictEqual(result.semantic_proposal.investigation_guidance, ['ΑΔΕΙΑ', 'ΑΠΟΥΣΙΑ']);
    assert.strictEqual(result.semantic_proposal.atomic_pair_required, false);

    const proposal = buildWeeklyRepoTransferSinglePairProposal({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 1 },
        contractVersion: 'v2'
    });
    assert.strictEqual(proposal.proposal_version, PROPOSAL_VERSION_V2);
    assert.strictEqual(proposal.atomic_pair_required, false);
    assert.strictEqual(proposal.can_auto_apply, false);
    assert.strictEqual(proposal.runtime_apply_supported, false);
    assert.strictEqual(proposal.apply_readiness.status, 'BLOCKED');
    assert.deepStrictEqual(proposal.investigation_guidance, ['ΑΔΕΙΑ', 'ΑΠΟΥΣΙΑ']);
    assert.deepStrictEqual(proposal.allowed_hr_choices, []);
    assert.deepStrictEqual(proposal.items, []);
    assert.strictEqual(proposal.group_id, undefined);
    assert.strictEqual(proposal.target, undefined);
    assert.strictEqual(proposal.writer_plan, undefined);
    assert.strictEqual(proposal.decision_payload, undefined);
    assert.strictEqual(proposal.review_only_outcome.employee_kodikos, '001');
    assert.strictEqual(proposal.review_only_outcome.team, 'team');
    assert.strictEqual(proposal.review_only_outcome.company_kod, 'company');
    assert.strictEqual(proposal.review_only_outcome.ypokatasthma, '0001');
    assert.strictEqual(proposal.review_only_outcome.week_start, START);
    assert.strictEqual(proposal.review_only_outcome.week_end, date(6));
    assert.strictEqual(proposal.review_only_outcome.source.cards_ores_ergasias, 4.5);
    assert.strictEqual(Object.isFrozen(proposal.review_only_outcome), true);

    const page = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: [{
            weekRows: rows,
            employmentProfile: { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 1 }
        }]
    });
    assert.strictEqual(page.groups.length, 0);
    assert.strictEqual(page.review_outcomes[0].group_id, undefined);
    assert.strictEqual(page.review_outcomes[0].target, undefined);
    assert.strictEqual(page.review_outcomes.length, 1);
    assert.strictEqual(page.review_outcomes[0].source.proposed_category, 'ΕΡΓ');
    assert.deepStrictEqual(
        page.review_outcomes[0].investigation_guidance,
        ['ΑΔΕΙΑ', 'ΑΠΟΥΣΙΑ']
    );
    assert.strictEqual(page.summary.review_outcomes_count, 1);
    assert.strictEqual(page.summary.review_outcome_employees_count, 1);
    assert.strictEqual(page.summary.employees_count, 1);
}

for (const invalidHours of [0, '0', '', null, -1, NaN, Infinity, 'invalid']) {
    const rows = week({ targets: [] });
    rows[1].cards_ores_ergasias = invalidHours;
    const validFallbackAnalysis = analyze(week({ targets: [] }));
    const proposal = buildWeeklyRepoTransferSinglePairProposal({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 1 },
        contractVersion: 'v2'
    }, {
        analyzer: () => validFallbackAnalysis
    });
    assert.strictEqual(proposal.proposal_status, 'INVALID_ANALYSIS');
    assert.ok(proposal.reasons.includes('SOURCE_CARD_HOURS_NOT_MATERIALIZABLE'));
    assert.strictEqual(proposal.review_only_outcome, null);
}

{
    const rows = week({ targets: [] });
    rows[1].cards_ores_ergasias = '4.50';
    const proposal = buildWeeklyRepoTransferSinglePairProposal({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 1 },
        contractVersion: 'v2'
    });
    assert.strictEqual(proposal.review_only_outcome.source.cards_ores_ergasias, 4.5);
}

{
    const proposal = buildWeeklyRepoTransferSinglePairProposal({
        weekRows: week(),
        employmentProfile: { typos_apasxolhshs: 'EK_PERITROPHS', mhniaia_repo: 1 },
        contractVersion: 'v2'
    });
    assert.strictEqual(proposal.proposal_status, 'READY');
    assert.strictEqual(proposal.policy_context.weekly_repo_policy_version, 'foundation:v1');
    assert.strictEqual(proposal.policy_context.source_work_policy_version, 'foundation:v1');
    assert.strictEqual(proposal.items[0].proposed_values.kathgoria_ergasias_apologistika, 'ΕΡΓ');
    assert.strictEqual(proposal.items[1].proposed_values.kathgoria_ergasias_apologistika, 'ΜΕ');
    assert.strictEqual(proposal.items[1].proposed_values.repo_apologistika, true);

    const projection = buildWeeklyRepoTransferSinglePairGroupProjection({
        weekRows: week(),
        employmentProfile: { typos_apasxolhshs: 'EK_PERITROPHS', mhniaia_repo: 1 },
        contractVersion: 'v2'
    });
    assert.strictEqual(projection.projection_status, 'READY');
    assert.ok(projection.groups[0].group_key.includes(
        'proposal_version=repo-transfer-single-pair-proposal:v2'
    ));
}

{
    const result = analyze(week(), 'UNKNOWN');
    assert.strictEqual(result.eligibility_status, 'INVALID_INPUT');
    assert.ok(result.reasons.includes('UNSUPPORTED_EMPLOYMENT_TYPE'));
}

{
    const rows = week();
    rows[6].hmeromhnia = '2026-07-12';
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'INVALID_INPUT');
    assert.ok(result.reasons.includes('CROSS_WEEK_ROWS'));
}

assert.throws(
    () => buildWeeklyRepoTransferSinglePairProposal({ contractVersion: 'future' }),
    /Unsupported repo-transfer proposal contract version/
);

console.log('apasxoliseis partial-family v2 tests passed');
