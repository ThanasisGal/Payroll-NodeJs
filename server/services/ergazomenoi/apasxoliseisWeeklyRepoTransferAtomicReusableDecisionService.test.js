const assert = require('assert');

const {
    DIAGNOSTIC,
    validateAtomicLinkedSet,
    buildAtomicReusableCriteriaV5,
    validateAtomicGroupOverlaps,
    validateAtomicReusableDecision,
    matchAtomicReusableApproval
} = require('./apasxoliseisWeeklyRepoTransferAtomicReusableDecisionService');

function context(overrides = {}) {
    return {
        primary_policy_code: 'WEEKLY_REPO_BALANCE',
        secondary_policy_code: 'DECLARED_REPO_OR_NON_WORK_WITH_CARDS',
        policy_versions: { primary: 'foundation:v3', secondary: 'foundation:v3' },
        source_conditions: { current_category: 'ΑΝ', required_result_category: 'ΕΡΓ' },
        target_conditions: { current_category: 'ΕΡΓ', required_result_category: 'ΑΝ' },
        employment_profile_class: { type: 'FULL_TIME', weekly_days: 5 },
        effective_parameters: { expected_repo: 2, weekly_days: 5 },
        thresholds: { linked_member_count: 2, decision_units_count: 1 },
        role_structure: {
            SOURCE_BECOMES_WORK: { transition: 'REPO_OR_NON_WORK_TO_WORK' },
            TARGET_BECOMES_REPO: { transition: 'WORK_TO_REPO_OR_NON_WORK' }
        },
        target_repo_category_rule: 'FULL_TIME_REPO_DAY',
        target_category: 'ΑΝ',
        week_boundary_semantics: 'MONDAY_TO_SUNDAY_SAME_NATURAL_WEEK',
        ...overrides
    };
}

function item(role, id, date, overrides = {}) {
    return {
        role,
        prodhlomena_oraria_id: id,
        employee_kodikos: '001',
        team: 'TEAM-A',
        company_kod: 'COMPANY-A',
        ypokatasthma: '0001',
        hmeromhnia: date,
        cards_ores_ergasias: 8,
        proposed_values: { calculated_compensation: 10 },
        flags: { current_eligible: true },
        ...overrides
    };
}

function group(overrides = {}) {
    const base = {
        group_id: 'case-specific-group',
        group_type: 'ATOMIC_PAIRED_PROPOSAL',
        decision_grain: 'ATOMIC_LINKED_SET',
        scenario_code: 'REPO_TRANSFER_WITHIN_WEEK_SINGLE_PAIR',
        action_type: 'PAIRED_PROPOSAL',
        count: 2,
        decision_units_count: 1,
        pair_contract: {
            atomic_pair_required: true,
            choice_code: 'TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR',
            proposal_version: 'repo-transfer-single-pair-proposal:v4'
        },
        atomic_reusable_context: context(),
        items: [
            item('SOURCE_BECOMES_WORK', 'source-1', '2026-07-06'),
            item('TARGET_BECOMES_REPO', 'target-1', '2026-07-10')
        ]
    };
    return { ...base, ...overrides };
}

function fingerprint(value) {
    const built = buildAtomicReusableCriteriaV5(value);
    assert.strictEqual(built.validation.eligible, true, built.validation.diagnostics.join(','));
    return built.fingerprint;
}

function approval(forGroup, overrides = {}) {
    return {
        _id: 'approval-1',
        reuse_scope: 'FUTURE_IDENTICAL',
        reuse_status: 'ACTIVE',
        decision_status: 'RECORDED',
        decision_type: 'APPROVE_PROPOSAL',
        reuse_effective_from: '2026-01-01',
        reuse_effective_to: null,
        reuse_fingerprint: fingerprint(forGroup),
        ...overrides
    };
}

function expectDiagnostic(value, code) {
    const validation = validateAtomicLinkedSet(value);
    assert.strictEqual(validation.eligible, false);
    assert.ok(validation.diagnostics.includes(code), validation.diagnostics.join(','));
}

function testLinkedSetContractAndCanonicalization() {
    const original = group();
    const valid = validateAtomicLinkedSet(original);
    assert.strictEqual(valid.eligible, true);
    assert.deepStrictEqual(valid.canonical_items.map((entry) => entry.role), [
        'SOURCE_BECOMES_WORK', 'TARGET_BECOMES_REPO'
    ]);
    const reversed = group({ items: [...original.items].reverse() });
    assert.strictEqual(fingerprint(reversed), fingerprint(original));

    expectDiagnostic(group({ items: [original.items[1]], count: 2 }), DIAGNOSTIC.MISSING_SOURCE);
    expectDiagnostic(group({ items: [original.items[0]], count: 2 }), DIAGNOSTIC.MISSING_TARGET);
    expectDiagnostic(group({
        items: [original.items[0], { ...original.items[0], prodhlomena_oraria_id: 'source-2' }]
    }), DIAGNOSTIC.DUPLICATE_SOURCE);
    expectDiagnostic(group({
        items: [original.items[1], { ...original.items[1], prodhlomena_oraria_id: 'target-2' }]
    }), DIAGNOSTIC.DUPLICATE_TARGET);
    expectDiagnostic(group({
        items: [original.items[0], { ...original.items[1], prodhlomena_oraria_id: 'source-1' }]
    }), DIAGNOSTIC.ROW_ID_DUPLICATE);
    expectDiagnostic(group({
        items: [original.items[0], { ...original.items[1], employee_kodikos: '002' }]
    }), DIAGNOSTIC.EMPLOYEE_MISMATCH);
    expectDiagnostic(group({
        items: [original.items[0], { ...original.items[1], company_kod: 'COMPANY-B' }]
    }), DIAGNOSTIC.COMPANY_MISMATCH);
    expectDiagnostic(group({
        items: [original.items[0], { ...original.items[1], ypokatasthma: '0002' }]
    }), DIAGNOSTIC.BRANCH_MISMATCH);
    expectDiagnostic(group({
        items: [original.items[0], { ...original.items[1], team: 'TEAM-B' }]
    }), DIAGNOSTIC.TEAM_MISMATCH);
    expectDiagnostic(group({
        items: [original.items[0], { ...original.items[1], hmeromhnia: '2026-07-13' }]
    }), DIAGNOSTIC.WEEK_MISMATCH);
    expectDiagnostic(group({ group_type: 'ROW_GROUP' }), DIAGNOSTIC.CONTRACT_INVALID);
    expectDiagnostic(group({ atomic_reusable_context: context({ source_conditions: {} }) }),
        DIAGNOSTIC.POLICY_CONTEXT_INCOMPLETE);
}

function testFingerprintIdentityAndExclusions() {
    const base = group();
    const sameIdentity = group({
        group_id: 'another-group',
        items: [
            item('SOURCE_BECOMES_WORK', 'different-source', '2026-08-03', {
                employee_kodikos: '999', cards_ores_ergasias: 2,
                proposed_values: { calculated_compensation: 999, ores: 2 }
            }),
            item('TARGET_BECOMES_REPO', 'different-target', '2026-08-07', {
                employee_kodikos: '999', cards_ores_ergasias: 0,
                proposed_values: { calculated_compensation: 0, ores: 0 }
            })
        ]
    });
    assert.strictEqual(fingerprint(base), fingerprint(sameIdentity));

    const changes = [
        group({ atomic_reusable_context: context({
            target_category: 'ΜΕ', target_repo_category_rule: 'PART_TIME_NON_WORK_DAY',
            target_conditions: { current_category: 'ΕΡΓ', required_result_category: 'ΜΕ' }
        }) }),
        group({ atomic_reusable_context: context({
            policy_versions: { primary: 'foundation:v4', secondary: 'foundation:v3' }
        }) }),
        group({ pair_contract: { ...base.pair_contract, proposal_version: 'proposal:v5' } }),
        group({ atomic_reusable_context: context({
            source_conditions: { current_category: 'ΜΕ', required_result_category: 'ΕΡΓ' }
        }) }),
        group({ atomic_reusable_context: context({
            employment_profile_class: { type: 'PART_TIME', weekly_days: 5 }
        }) })
    ];
    changes.forEach((changed) => assert.notStrictEqual(fingerprint(base), fingerprint(changed)));

    const roleChanged = group({
        atomic_reusable_context: context({
            role_structure: {
                SOURCE_BECOMES_WORK: { transition: 'WORK_TO_WORK' },
                TARGET_BECOMES_REPO: { transition: 'WORK_TO_REPO_OR_NON_WORK' }
            }
        })
    });
    assert.notStrictEqual(fingerprint(base), fingerprint(roleChanged));
}

function testOverlap() {
    const first = group();
    const independent = group({ items: [
        item('SOURCE_BECOMES_WORK', 'source-2', '2026-07-06'),
        item('TARGET_BECOMES_REPO', 'target-2', '2026-07-10')
    ] });
    assert.deepStrictEqual(validateAtomicGroupOverlaps([first, independent]).map((entry) => entry.eligible),
        [true, true]);

    const overlapCases = [
        [item('SOURCE_BECOMES_WORK', 'source-1', '2026-07-06'),
            item('TARGET_BECOMES_REPO', 'target-2', '2026-07-10')],
        [item('SOURCE_BECOMES_WORK', 'source-2', '2026-07-06'),
            item('TARGET_BECOMES_REPO', 'target-1', '2026-07-10')],
        [item('SOURCE_BECOMES_WORK', 'target-1', '2026-07-06'),
            item('TARGET_BECOMES_REPO', 'target-2', '2026-07-10')]
    ];
    overlapCases.forEach((items) => {
        const result = validateAtomicGroupOverlaps([first, group({ items })]);
        assert.deepStrictEqual(result.map((entry) => entry.conflict), [true, true]);
        assert.deepStrictEqual(result.map((entry) => entry.pending), [true, true]);
    });
}

function testWholeGroupMatching() {
    const candidate = group();
    assert.strictEqual(matchAtomicReusableApproval({
        group: candidate, approvals: [approval(candidate)]
    }).resolved, true);
    const oneBlocked = group({ items: [candidate.items[0], {
        ...candidate.items[1], flags: { current_eligible: false }
    }] });
    assert.strictEqual(matchAtomicReusableApproval({
        group: oneBlocked, approvals: [approval(oneBlocked)]
    }).status, 'PENDING');
    for (const flags of [{ is_locked: true }, { has_manual_override: true }]) {
        const gated = group({ items: [candidate.items[0], {
            ...candidate.items[1], flags
        }] });
        assert.strictEqual(matchAtomicReusableApproval({
            group: gated, approvals: [approval(gated)]
        }).status, 'PENDING');
    }

    assert.strictEqual(matchAtomicReusableApproval({
        group: candidate,
        approvals: [approval(candidate, { reuse_effective_from: '2026-07-06', reuse_effective_to: '2026-07-10' })]
    }).resolved, true);
    assert.strictEqual(matchAtomicReusableApproval({
        group: candidate,
        approvals: [approval(candidate, { reuse_effective_from: '2026-07-07' })]
    }).status, 'PENDING');
    assert.strictEqual(matchAtomicReusableApproval({
        group: candidate,
        approvals: [approval(candidate, { reuse_effective_to: '2026-07-09' })]
    }).status, 'PENDING');
    for (const overrides of [
        { reuse_status: 'REVOKED' },
        { decision_status: 'CANCELLED' },
        { reuse_effective_to: '2026-07-05' }
    ]) {
        assert.strictEqual(matchAtomicReusableApproval({
            group: candidate, approvals: [approval(candidate, overrides)]
        }).status, 'PENDING');
    }
    assert.strictEqual(matchAtomicReusableApproval({
        group: candidate,
        approvals: [approval(candidate), approval(candidate, { _id: 'approval-2' })]
    }).status, 'CONFLICT');
}

function testDecisionTypes() {
    assert.strictEqual(validateAtomicReusableDecision({
        reuseScope: 'FUTURE_IDENTICAL', decisionType: 'APPROVE_PROPOSAL'
    }).valid, true);
    for (const decisionType of ['REJECT_PROPOSAL', 'NEEDS_MORE_REVIEW']) {
        assert.strictEqual(validateAtomicReusableDecision({
            reuseScope: 'FUTURE_IDENTICAL', decisionType
        }).valid, false);
        assert.strictEqual(validateAtomicReusableDecision({
            reuseScope: 'ONE_TIME', decisionType
        }).valid, true);
    }
}

testLinkedSetContractAndCanonicalization();
testFingerprintIdentityAndExclusions();
testOverlap();
testWholeGroupMatching();
testDecisionTypes();

console.log('Atomic reusable repo-transfer decision service tests passed.');
