const assert = require('assert');

const {
    analyzeWeeklyRepoTransferSinglePairV2,
    normalizeEmploymentType,
    employmentFamily
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const {
    buildWeeklyRepoTransferSinglePairProposal,
    PROPOSAL_VERSION_V2
} = require('./apasxoliseisWeeklyRepoTransferSinglePairProposalService');
const {
    buildWeeklyRepoTransferAtomicPageProjection
} = require('./apasxoliseisWeeklyRepoTransferAtomicPageProjectionService');

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

function week({ sources = [1], targets = [3] } = {}) {
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
    return rows;
}

function analyze(rows, type) {
    return analyzeWeeklyRepoTransferSinglePairV2({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: type }
    });
}

for (const type of ['EK_PERITROPHS', 'MERIKH']) {
    const result = analyze(week(), type);
    assert.strictEqual(result.eligibility_status, 'ELIGIBLE');
    assert.strictEqual(result.scenario_version, 'repo-transfer-single-pair:v2');
    assert.strictEqual(result.source.hmeromhnia, date(1));
    assert.strictEqual(result.source.semantic_target_category, 'ΕΡΓ');
    assert.strictEqual(result.target.hmeromhnia, date(3));
    assert.strictEqual(result.target.semantic_target_category, 'ΜΕ');
    assert.strictEqual(result.semantic_proposal.employment_family, 'PARTIAL_FAMILY');
}

assert.strictEqual(employmentFamily(normalizeEmploymentType('1')), 'PARTIAL_FAMILY');
assert.strictEqual(employmentFamily(normalizeEmploymentType('2')), 'PARTIAL_FAMILY');
for (const alias of ['PARTIAL', 'EK_PERITROPIS', 'EK_PERITROPH']) {
    assert.strictEqual(employmentFamily(normalizeEmploymentType(alias)), 'PARTIAL_FAMILY');
}

{
    const result = analyze(week({ sources: [1, 2] }), 'MERIKH');
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(result.reasons.includes('MULTIPLE_SOURCE_CANDIDATES'));
    assert.strictEqual(result.source, null);
}

{
    const rows = week({ targets: [4, 2] });
    const result = analyze(rows.reverse(), 'EK_PERITROPHS');
    assert.strictEqual(result.eligibility_status, 'ELIGIBLE');
    assert.strictEqual(result.target.hmeromhnia, date(2));
    assert.ok(result.warnings.includes('ADDITIONAL_TARGET_CANDIDATES_IGNORED:1'));
}

{
    const rows = week({ targets: [2, 4] });
    rows[2].is_locked = true;
    const result = analyze(rows, 'MERIKH');
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(result.reasons.includes('TARGET_LOCKED'));
    assert.strictEqual(result.target.hmeromhnia, date(2));
}

{
    const rows = week({ targets: [] });
    const result = analyze(rows, 'MERIKH');
    assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
    assert.ok(result.reasons.includes('NO_TARGET_SCHEDULED_WORK_WITHOUT_CARDS'));
    assert.deepStrictEqual(result.semantic_proposal.allowed_hr_choices, ['ΑΔΕΙΑ', 'ΑΠΟΥΣΙΑ']);
    assert.strictEqual(result.semantic_proposal.atomic_pair_required, false);

    const proposal = buildWeeklyRepoTransferSinglePairProposal({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH' },
        contractVersion: 'v2'
    });
    assert.strictEqual(proposal.proposal_version, PROPOSAL_VERSION_V2);
    assert.strictEqual(proposal.atomic_pair_required, false);
    assert.strictEqual(proposal.runtime_apply_supported, false);
    assert.strictEqual(proposal.apply_readiness.status, 'BLOCKED');
    assert.deepStrictEqual(proposal.allowed_hr_choices, ['ΑΔΕΙΑ', 'ΑΠΟΥΣΙΑ']);
    assert.deepStrictEqual(proposal.items, []);

    const page = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: [{
            weekRows: rows,
            employmentProfile: { typos_apasxolhshs: 'MERIKH' }
        }]
    });
    assert.strictEqual(page.groups.length, 0);
    assert.strictEqual(page.review_outcomes.length, 1);
    assert.strictEqual(page.review_outcomes[0].source.proposed_category, 'ΕΡΓ');
    assert.strictEqual(page.review_outcomes[0].runtime_apply_supported, false);
}

{
    const result = analyze(week(), 'UNKNOWN');
    assert.strictEqual(result.eligibility_status, 'INVALID_INPUT');
    assert.ok(result.reasons.includes('UNSUPPORTED_EMPLOYMENT_TYPE'));
}

console.log('apasxoliseis partial-family v2 tests passed');
