const assert = require('assert');
const {
    LEAVE_PROVENANCE,
    classifyLeaveProvenance
} = require('./apasxoliseisLeaveProvenanceService');
const {
    resolveDailyActualWorkFacts
} = require('./apasxoliseisDailyActualWorkFactsService');
const {
    analyzeWeeklyRepoTransferSinglePair
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const {
    buildWeeklyRepoTransferSinglePairProposal
} = require('./apasxoliseisWeeklyRepoTransferSinglePairProposalService');
const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const {
    APPLY_FIELDS,
    CURRENT_GUARD_FIELDS
} = require('./apasxoliseisWeeklyRepoTransferApplyPreflightService');

function row(day, overrides = {}) {
    return {
        _id: `regression-${day}`,
        team: 'THA',
        company_kod: 'fixture-company',
        ypokatasthma: '0000',
        kodikos: '0002',
        hmeromhnia: `2026-06-${String(day).padStart(2, '0')}`,
        kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 8,
        cards_ores_ergasias: 8,
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '17:00',
        ...overrides
    };
}

function sixWorkdaysWithAutoLeave() {
    const rows = Array.from({ length: 7 }, (_, index) => row(index + 1));
    Object.assign(rows[0], { kathgoria_ergasias: 'ΑΝ', repo: true });
    Object.assign(rows[6], {
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: '',
        adeia: false,
        kathgoria_adeias: '',
        ores_apoysias: 0,
        adeia_apologistika: true,
        kathgoria_adeias_apologistika: 'ΑΔΑΛ',
        kathgoria_ergasias_apologistika: '',
        ores_apoysias_apologistika: 0,
        ores_ergasias_apologistika: 0,
        repo_apologistika: false
    });
    return rows;
}

const profile = {
    typos_apasxolhshs: 'PLHRHS',
    hmeres_ergasias_ebdomadas: 5,
    pososto_prosayxhshs_6hs_hmeras: 0,
    eidikh_kathgoria_ergazomenoy: '0009'
};

assert.ok(!APPLY_FIELDS.includes('adeia'));
assert.ok(!APPLY_FIELDS.includes('kathgoria_adeias'));
assert.ok(!APPLY_FIELDS.includes('ores_apoysias'));
assert.ok(CURRENT_GUARD_FIELDS.includes('adeia'));
assert.ok(CURRENT_GUARD_FIELDS.includes('kathgoria_adeias'));
assert.ok(CURRENT_GUARD_FIELDS.includes('ores_apoysias'));

{
    const rows = sixWorkdaysWithAutoLeave();
    assert.strictEqual(
        classifyLeaveProvenance(rows[6]),
        LEAVE_PROVENANCE.AUTO_CALCULATED_LEAVE
    );
    assert.strictEqual(resolveDailyActualWorkFacts(rows[6]).countsAsActualWorkDay, false);

    const analysis = analyzeWeeklyRepoTransferSinglePair({
        weekRows: rows,
        employmentProfile: profile
    });
    assert.strictEqual(analysis.eligibility_status, 'ELIGIBLE');
    assert.ok(!analysis.reasons.includes('REPO_DEFICIT_REMAINS'));
    assert.strictEqual(analysis.counts.existing_actual_repo, 0);
    assert.strictEqual(analysis.counts.predicted_final_repo, 1);
    assert.deepStrictEqual(
        {
            expected: analysis.weekly_resolution.expected_repo,
            resolved: analysis.weekly_resolution.resolved_repo,
            workdays: analysis.weekly_resolution.actual_workdays,
            sixth: analysis.weekly_resolution.sixth_day_count,
            seventh: analysis.weekly_resolution.seventh_day_count
        },
        { expected: 2, resolved: 1, workdays: 6, sixth: 1, seventh: 0 }
    );

    const proposal = buildWeeklyRepoTransferSinglePairProposal({
        weekRows: rows,
        employmentProfile: profile
    });
    assert.strictEqual(proposal.proposal_status, 'READY');
    const target = proposal.items.find((item) => item.role === 'TARGET_BECOMES_REPO');
    assert.deepStrictEqual(
        {
            category: target.proposed_values.kathgoria_ergasias_apologistika,
            repo: target.proposed_values.repo_apologistika,
            leave: target.proposed_values.adeia_apologistika,
            leaveCategory: target.proposed_values.kathgoria_adeias_apologistika,
            absenceHours: target.proposed_values.ores_apoysias_apologistika,
            workHours: target.proposed_values.ores_ergasias_apologistika
        },
        {
            category: 'ΑΝ',
            repo: true,
            leave: false,
            leaveCategory: '',
            absenceHours: 0,
            workHours: 0
        }
    );
}

for (const marker of [
    { adeia: true },
    { kathgoria_adeias: 'HR' },
    { ores_apoysias: 8 }
]) {
    const rows = sixWorkdaysWithAutoLeave();
    Object.assign(rows[6], marker);
    assert.strictEqual(
        classifyLeaveProvenance(rows[6]),
        LEAVE_PROVENANCE.HR_DECLARED_LEAVE
    );
    const analysis = analyzeWeeklyRepoTransferSinglePair({
        weekRows: rows,
        employmentProfile: profile
    });
    assert.notStrictEqual(analysis.eligibility_status, 'ELIGIBLE');
    assert.ok(analysis.reasons.includes('TARGET_LEAVE_OR_SICKNESS'));
}

{
    const rows = sixWorkdaysWithAutoLeave();
    Object.assign(rows[6], { adeia: true, kathgoria_adeias: 'HR' });
    assert.strictEqual(
        classifyLeaveProvenance(rows[6]),
        LEAVE_PROVENANCE.HR_DECLARED_LEAVE
    );
    const analysis = analyzeWeeklyRepoTransferSinglePair({
        weekRows: rows,
        employmentProfile: profile
    });
    assert.notStrictEqual(analysis.eligibility_status, 'ELIGIBLE');
    assert.ok(analysis.reasons.includes('TARGET_LEAVE_OR_SICKNESS'));
}

{
    const rows = Array.from({ length: 7 }, (_, index) => row(index + 1));
    const analysis = analyzeWeeklySixthSeventhDay({
        weekRows: rows,
        effectiveProfile: profile
    });
    assert.strictEqual(analysis.status, 'READY');
    assert.ok(analysis.sixthDay);
    assert.ok(analysis.seventhDay);
    assert.ok(
        analysis.warnings.includes(
            'SEVENTH_CONSECUTIVE_ACTUAL_WORK_DAY_CONTRACT_VIOLATION'
        )
    );
}

{
    const rows = Array.from({ length: 7 }, (_, index) => row(index + 1));
    Object.assign(rows[6], {
        kathgoria_ergasias: 'ΑΝ',
        repo: true,
        ores_ergasias: 0,
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    const analysis = analyzeWeeklySixthSeventhDay({
        weekRows: rows,
        effectiveProfile: { ...profile, hmeres_ergasias_ebdomadas: 6 }
    });
    assert.strictEqual(analysis.status, 'NOT_APPLICABLE');
    assert.strictEqual(analysis.sixthDay, undefined);
}

console.log('PASS auto-leave provenance and sixth-day repo-transfer integration');
