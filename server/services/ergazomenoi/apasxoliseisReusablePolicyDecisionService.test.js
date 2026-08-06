const assert = require('assert');

const {
    buildReusableMatchCriteriaFromGroup,
    buildReusableMatchCriteriaFromPreviewRow,
    buildReusableItemMatchCriteriaFromPreviewRow,
    buildReusablePolicyContextFromPreviewRow,
    buildReusablePolicyCriteria,
    buildReusablePolicyCriteriaV4,
    buildReusableDecisionFingerprint,
    getReusableDecisionEligibility,
    utcDateKey,
    applyReusablePolicyDecisionsToPreviewRows
} = require('./apasxoliseisReusablePolicyDecisionService');

function group(overrides = {}) {
    return {
        ypokatasthma: '0000',
        status: 'NEEDS_REVIEW',
        policy_code: 'UNSCHEDULED_DAY_WITH_COMPLETE_CARDS',
        scenario_code: 'UNSCHEDULED_DAY_WITH_CARDS',
        action_type: 'REVIEW_ONLY',
        reason_code: 'UNSCHEDULED_DAY_WITH_CARDS',
        items: [{ proposed_values: {} }],
        ...overrides
    };
}

function previewRow(overrides = {}) {
    return {
        prodhlomena_oraria_id: 'row-1',
        team: 'team-a',
        company_kod: 'company-a',
        kodikos: '001',
        ypokatasthma: '0000',
        hmeromhnia: new Date('2026-07-10T00:00:00.000Z'),
        scenarioFactsSummary: {
            declared_category: 'ΕΡΓ', apologistika_category: 'ΕΡΓ',
            declared_hours: 8, card_hours: 8, has_cards: true,
            is_holiday: false, is_mandatory_holiday: false,
            is_optional_holiday: false, is_locked: false, has_manual_override: false
        },
        scenarioDecision: {
            scenario_code: 'UNSCHEDULED_DAY_WITH_CARDS',
            scenario_version: 'scenario:v1',
            rule_branch: 'UNSCHEDULED_DAY_WITH_CARDS',
            requires_review: true,
            reasons: ['UNSCHEDULED_DAY_WITH_CARDS']
        },
        policyResult: {
            result_status: 'NEEDS_REVIEW',
            policy_code: 'UNSCHEDULED_DAY_WITH_COMPLETE_CARDS',
            policy_version: 'policy:v1',
            rule_branch: 'UNSCHEDULED_DAY_WITH_CARDS',
            mode: 'REVIEW_ONLY',
            reasons: ['UNSCHEDULED_DAY_WITH_CARDS'],
            requires_human_approval: true,
            proposed_updates: {},
            audit_payload: { parameters: { threshold_class: 'ELIGIBLE' } }
        },
        ...overrides
    };
}

function testExplicitBranchIgnoresReasonOrderAndMutableGates() {
    const base = previewRow();
    const changed = previewRow({
        scenarioFactsSummary: { ...base.scenarioFactsSummary, is_locked: true, has_manual_override: true },
        scenarioDecision: { ...base.scenarioDecision, reasons: ['SECOND', 'FIRST'] },
        policyResult: { ...base.policyResult, reasons: ['SECOND', 'FIRST'] }
    });
    const baseCriteria = buildReusablePolicyCriteria({
        ...buildReusableMatchCriteriaFromGroup(group(), '0000'), team: base.team, company_kod: base.company_kod
    }, { employee_kodikos: base.kodikos, policy_context: buildReusablePolicyContextFromPreviewRow(base) });
    const changedCriteria = buildReusablePolicyCriteria({
        ...buildReusableMatchCriteriaFromGroup(group(), '0000'), team: changed.team, company_kod: changed.company_kod
    }, { employee_kodikos: changed.kodikos, policy_context: buildReusablePolicyContextFromPreviewRow(changed) });
    assert.strictEqual(buildReusableDecisionFingerprint(baseCriteria), buildReusableDecisionFingerprint(changedCriteria));

    const locked = previewRow({
        scenarioFactsSummary: { ...base.scenarioFactsSummary, is_locked: true },
        policyResult: { ...base.policyResult, proposed_updates: { current: 'locked' } }
    });
    const manual = previewRow({
        scenarioFactsSummary: { ...base.scenarioFactsSummary, has_manual_override: true },
        policyResult: { ...base.policyResult, proposed_updates: { current: 'manual' } }
    });
    const noRuleRows = applyReusablePolicyDecisionsToPreviewRows({ rows: [locked, manual], rules: [] });
    noRuleRows.forEach((row) => {
        assert.strictEqual(row.policyResult.reusable_application_blocked, undefined);
        assert.strictEqual(row.policyResult.reusable_application_gate_code, undefined);
        assert.strictEqual(row.policyResult.result_status, 'NEEDS_REVIEW');
    });

    const [lockedBlocked] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [locked], rules: [reusableV3Rule(base)]
    });
    assert.strictEqual(lockedBlocked.policyResult.reusable_application_gate_code, 'CURRENT_RECORD_LOCKED');
    assert.deepStrictEqual(lockedBlocked.policyResult.proposed_updates, { current: 'locked' });

    const [manualBlocked] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [manual], rules: [reusableV3Rule(base)]
    });
    assert.strictEqual(manualBlocked.policyResult.reusable_application_gate_code, 'CURRENT_MANUAL_OVERRIDE');
    assert.deepStrictEqual(manualBlocked.policyResult.proposed_updates, { current: 'manual' });
}

function testPolicySpecificConditionsExcludeUnrelatedApologistikaOutput() {
    const base = previewRow({
        policyResult: { ...previewRow().policyResult, policy_code: 'NO_CARDS_DECLARED_WORK_LEAVE_OR_HOLIDAY' },
        scenarioDecision: { ...previewRow().scenarioDecision,
            scenario_code: 'DECLARED_WORK_NO_CARDS_LEAVE', rule_branch: 'DECLARED_WORK_NO_CARDS_LEAVE' }
    });
    const changed = previewRow({
        ...base,
        scenarioFactsSummary: { ...base.scenarioFactsSummary, apologistika_category: 'ΑΝ' }
    });
    assert.deepStrictEqual(
        buildReusablePolicyContextFromPreviewRow(base).conditions,
        buildReusablePolicyContextFromPreviewRow(changed).conditions
    );
}

function reusableRule(criteria, overrides = {}) {
    return {
        _id: 'approval-1',
        decision_type: 'MARK_REVIEWED',
        decision_status: 'RECORDED',
        reuse_scope: 'FUTURE_IDENTICAL',
        reuse_status: 'ACTIVE',
        reuse_fingerprint: buildReusableDecisionFingerprint(criteria),
        reuse_effective_from: new Date('2026-06-01T00:00:00.000Z'),
        created_by_user_name: 'HR User',
        created_at: new Date('2026-06-30T10:00:00.000Z'),
        group_id: 'source-group',
        apo_hmeromhnia: new Date('2026-06-01T00:00:00.000Z'),
        eos_hmeromhnia: new Date('2026-06-30T00:00:00.000Z'),
        ...overrides
    };
}

function reusableV2Rule(row, overrides = {}) {
    const decisionType = overrides.decision_type || 'MARK_REVIEWED';
    const criteria = buildReusableItemMatchCriteriaFromPreviewRow(row, decisionType);
    return reusableRule(criteria, {
        team: row.team,
        company_kod: row.company_kod,
        ypokatasthma: row.ypokatasthma,
        decision_type: decisionType,
        reuse_fingerprints: [buildReusableDecisionFingerprint(criteria)],
        items: [{ employee_kodikos: row.kodikos }],
        ...overrides
    });
}

function reusableV3Rule(row, overrides = {}) {
    const context = buildReusablePolicyContextFromPreviewRow(row);
    const criteria = buildReusablePolicyCriteria({
        ...buildReusableMatchCriteriaFromGroup(group(), row.ypokatasthma),
        team: row.team,
        company_kod: row.company_kod
    }, { employee_kodikos: row.kodikos, policy_context: context });
    return reusableRule(criteria, {
        team: row.team,
        company_kod: row.company_kod,
        ypokatasthma: row.ypokatasthma,
        reuse_fingerprints: [buildReusableDecisionFingerprint(criteria)],
        reuse_match_criteria: { version: 3, variants: [criteria] },
        items: [{ employee_kodikos: row.kodikos, policy_context: context }],
        ...overrides
    });
}

function reusableV4Rule(row, overrides = {}) {
    const context = buildReusablePolicyContextFromPreviewRow(row);
    const criteria = buildReusablePolicyCriteriaV4({
        ...buildReusableMatchCriteriaFromPreviewRow(row),
        team: row.team,
        company_kod: row.company_kod
    }, { policy_context: context });
    return reusableRule(criteria, {
        team: row.team,
        company_kod: row.company_kod,
        ypokatasthma: row.ypokatasthma,
        reuse_fingerprints: [buildReusableDecisionFingerprint(criteria)],
        reuse_match_criteria: { version: 4, variants: [criteria] },
        items: [{ employee_kodikos: row.kodikos, policy_context: context }],
        ...overrides
    });
}

function v4Criteria(row, contextOverrides = {}) {
    const context = {
        ...buildReusablePolicyContextFromPreviewRow(row),
        ...contextOverrides
    };
    return buildReusablePolicyCriteriaV4({
        ...buildReusableMatchCriteriaFromPreviewRow(row),
        team: row.team,
        company_kod: row.company_kod
    }, { policy_context: context });
}

function testV4PolicyIdentityIsCrossEmployeeAndResultIndependent() {
    const source = previewRow();
    const changedPresentation = previewRow({
        prodhlomena_oraria_id: 'different-row-id',
        kodikos: '999',
        hmeromhnia: new Date('2027-01-20T00:00:00.000Z'),
        scenarioFactsSummary: {
            ...source.scenarioFactsSummary,
            declared_hours: 3.5,
            card_hours: 4.25
        },
        policyResult: {
            ...source.policyResult,
            proposed_updates: { kathgoria_ergasias_apologistika: 'ΑΝ' }
        }
    });
    const sourceCriteria = v4Criteria(source);
    const changedCriteria = v4Criteria(changedPresentation);
    assert.strictEqual(sourceCriteria.version, 4);
    assert.strictEqual(sourceCriteria.employee_kodikos, undefined);
    assert.strictEqual(buildReusableDecisionFingerprint(sourceCriteria),
        buildReusableDecisionFingerprint(changedCriteria));

    const [resolved] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [changedPresentation],
        rules: [reusableV4Rule(source)]
    });
    assert.strictEqual(resolved.policyResult.result_status, 'RESOLVED_BY_POLICY');
    assert.deepStrictEqual(
        resolved.policyResult.proposed_updates,
        { kathgoria_ergasias_apologistika: 'ΑΝ' }
    );
    assert.strictEqual(resolved.kodikos, '999');
}

function testV4NormalizesMissingObjects() {
    const row = previewRow();
    const missing = v4Criteria(row, {
        parameters: undefined,
        thresholds: undefined,
        conditions: undefined
    });
    const empty = v4Criteria(row, {
        parameters: {},
        thresholds: {},
        conditions: {}
    });
    assert.deepStrictEqual(missing.parameters, {});
    assert.deepStrictEqual(missing.thresholds, {});
    assert.deepStrictEqual(missing.conditions, {});
    assert.strictEqual(buildReusableDecisionFingerprint(missing),
        buildReusableDecisionFingerprint(empty));
}

function testV4PolicyDimensionsRemainIsolated() {
    const source = previewRow();
    const sourceFingerprint = buildReusableDecisionFingerprint(v4Criteria(source));
    const changedCriteria = [
        v4Criteria(previewRow({ team: 'team-b' })),
        v4Criteria(previewRow({ company_kod: 'company-b' })),
        v4Criteria(previewRow({ ypokatasthma: '0001' })),
        v4Criteria(previewRow({ policyResult: { ...source.policyResult, policy_code: 'OTHER_POLICY' } })),
        v4Criteria(previewRow({ scenarioDecision: { ...source.scenarioDecision, scenario_code: 'OTHER_SCENARIO' } })),
        v4Criteria(source, { policy_version: 'policy:v2' }),
        v4Criteria(source, { scenario_version: 'scenario:v2' }),
        v4Criteria(source, { rule_branch: 'OTHER_BRANCH' }),
        v4Criteria(previewRow({ policyResult: { ...source.policyResult, mode: 'SUGGESTION' } })),
        v4Criteria(source, { parameters: { changed: true } }),
        v4Criteria(source, { thresholds: { limit: 1 } }),
        v4Criteria(source, { conditions: { declared_category: 'ΑΝ' } })
    ];
    changedCriteria.forEach((criteria) => assert.notStrictEqual(
        buildReusableDecisionFingerprint(criteria), sourceFingerprint
    ));

    const changedRows = [
        previewRow({ team: 'team-b' }),
        previewRow({ company_kod: 'company-b' }),
        previewRow({ ypokatasthma: '0001' })
    ];
    applyReusablePolicyDecisionsToPreviewRows({
        rows: changedRows,
        rules: [reusableV4Rule(source)]
    }).forEach((row) => assert.strictEqual(row.policyResult.result_status, 'NEEDS_REVIEW'));
}

function testStableFingerprintIgnoresEmployeeAndDate() {
    const left = buildReusableMatchCriteriaFromGroup(group(), '0000');
    const right = buildReusableMatchCriteriaFromGroup(
        { ...group(), employee_kodikos: '9999', hmeromhnia: '2027-01-01' },
        '0000'
    );
    assert.strictEqual(
        buildReusableDecisionFingerprint(left),
        buildReusableDecisionFingerprint(right)
    );
}

function testDifferentBranchDoesNotMatch() {
    const left = buildReusableMatchCriteriaFromGroup(group(), '0000');
    const right = buildReusableMatchCriteriaFromGroup(group(), '0001');
    assert.notStrictEqual(
        buildReusableDecisionFingerprint(left),
        buildReusableDecisionFingerprint(right)
    );
}

function testKnownPoliciesAndExactProposedChangesAreReusable() {
    const legalRest = getReusableDecisionEligibility({
        group: group({ policy_code: 'INTERDAY_MINIMUM_REST' }),
        decisionType: 'MARK_REVIEWED'
    });
    assert.strictEqual(legalRest.eligible, true);

    const incompleteCards = getReusableDecisionEligibility({
        group: group({ reason_code: 'CARD_VERIFICATION_PENDING' }),
        decisionType: 'MARK_REVIEWED'
    });
    assert.strictEqual(incompleteCards.eligible, true);

    const proposedChange = getReusableDecisionEligibility({
        group: group(),
        decisionType: 'MARK_REVIEWED',
        items: [{ proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } }]
    });
    assert.strictEqual(proposedChange.eligible, true);

    const unknown = getReusableDecisionEligibility({
        group: group({ policy_code: '' }),
        decisionType: 'MARK_REVIEWED'
    });
    assert.strictEqual(unknown.eligible, false);
}

function testIdenticalFutureCaseIsResolvedWithAuditMetadata() {
    const row = previewRow();
    const [resolved] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [row],
        rules: [reusableV3Rule(row)]
    });

    assert.strictEqual(resolved.policyResult.result_status, 'RESOLVED_BY_POLICY');
    assert.strictEqual(resolved.policyResult.requires_human_approval, false);
    assert.strictEqual(resolved.scenarioDecision.requires_review, false);
    assert.strictEqual(resolved.policyResult.reusable_decision.approval_id, 'approval-1');
    assert.strictEqual(resolved.policyResult.reusable_decision.approved_by_user_name, 'HR User');
}

function testOpenEndedAndBoundedReusableEffectiveDates() {
    assert.strictEqual(utcDateKey(null), null);
    assert.strictEqual(utcDateKey(undefined), null);
    assert.strictEqual(utcDateKey(''), null);
    assert.strictEqual(utcDateKey('   '), null);
    assert.strictEqual(utcDateKey('2026-07-10T12:00:00.000Z'), '2026-07-10');
    assert.strictEqual(utcDateKey('not-a-date'), null);

    const row = previewRow();
    for (const reuseEffectiveTo of [null, undefined, '', '   ', new Date('2026-07-10T23:59:59.999Z')]) {
        const rule = reusableV4Rule(row);
        if (reuseEffectiveTo === undefined) delete rule.reuse_effective_to;
        else rule.reuse_effective_to = reuseEffectiveTo;
        const [resolved] = applyReusablePolicyDecisionsToPreviewRows({ rows: [row], rules: [rule] });
        assert.strictEqual(resolved.policyResult.result_status, 'RESOLVED_BY_POLICY');
        assert.strictEqual(resolved.policyResult.requires_human_approval, false);
        assert.strictEqual(resolved.policyResult.reusable_decision.approval_id, 'approval-1');
    }

    const [expired] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [row],
        rules: [reusableV4Rule(row, { reuse_effective_to: new Date('2026-07-09T00:00:00.000Z') })]
    });
    assert.strictEqual(expired.policyResult.result_status, 'NEEDS_REVIEW');

    const [beforeStart] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [previewRow({ hmeromhnia: new Date('2026-05-31T00:00:00.000Z') })],
        rules: [reusableV4Rule(row)]
    });
    assert.strictEqual(beforeStart.policyResult.result_status, 'NEEDS_REVIEW');
}

function testFifteenV4RowsResolveWithoutChangingCurrentRowValues() {
    const source = previewRow();
    const rule = reusableV4Rule(source, {
        _id: '6a743bc11cc18bdde16f3dcd',
        decision_type: 'APPROVE_PREFILL',
        reuse_effective_to: null
    });
    const rows = Array.from({ length: 15 }, (_, index) => previewRow({
        prodhlomena_oraria_id: `row-${index + 1}`,
        kodikos: String(Math.floor(index / 3) + 1).padStart(4, '0'),
        hmeromhnia: new Date(`2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`),
        scenarioFactsSummary: {
            ...source.scenarioFactsSummary,
            card_hours: 4 + index / 10
        },
        policyResult: {
            ...source.policyResult,
            proposed_updates: { kathgoria_ergasias_apologistika: 'ΕΡΓ' }
        }
    }));
    const resolvedRows = applyReusablePolicyDecisionsToPreviewRows({ rows, rules: [rule] });

    resolvedRows.forEach((resolved, index) => {
        assert.strictEqual(resolved.policyResult.result_status, 'RESOLVED_BY_POLICY');
        assert.strictEqual(resolved.policyResult.requires_human_approval, false);
        assert.strictEqual(resolved.policyResult.reusable_decision.approval_id, rule._id);
        assert.strictEqual(resolved.kodikos, rows[index].kodikos);
        assert.strictEqual(resolved.hmeromhnia, rows[index].hmeromhnia);
        assert.strictEqual(
            resolved.scenarioFactsSummary.card_hours,
            rows[index].scenarioFactsSummary.card_hours
        );
        assert.deepStrictEqual(
            resolved.policyResult.proposed_updates,
            rows[index].policyResult.proposed_updates
        );
    });
}

function testAbsoluteHoursAndCurrentResultMayChangeButEmployeeMayNot() {
    const source = previewRow();
    const changedHours = previewRow({
        scenarioFactsSummary: { ...source.scenarioFactsSummary, declared_hours: 7, card_hours: 7 },
        policyResult: { ...source.policyResult, proposed_updates: { kathgoria_ergasias_apologistika: 'ΜΕ' } }
    });
    const otherEmployee = previewRow({ kodikos: '002' });
    const results = applyReusablePolicyDecisionsToPreviewRows({
        rows: [changedHours, otherEmployee],
        rules: [reusableV3Rule(source)]
    });
    assert.strictEqual(results[0].policyResult.result_status, 'RESOLVED_BY_POLICY');
    assert.deepStrictEqual(results[0].policyResult.proposed_updates, { kathgoria_ergasias_apologistika: 'ΜΕ' });
    assert.strictEqual(results[1].policyResult.result_status, 'NEEDS_REVIEW');
}

function testPolicyScopeVersionParameterBranchAndConditionsMustMatch() {
    const source = previewRow({
        policyResult: {
            ...previewRow().policyResult,
            proposed_updates: { kathgoria_ergasias_apologistika: 'ΕΡΓ' }
        }
    });
    const sameSource = (overrides = {}) => ({ ...source, ...overrides });
    const changedRows = [
        sameSource({ team: 'team-b' }),
        sameSource({ company_kod: 'company-b' }),
        sameSource({ ypokatasthma: '0001' }),
        sameSource({ policyResult: { ...source.policyResult, policy_version: 'policy:v2' } }),
        sameSource({ scenarioDecision: { ...source.scenarioDecision, scenario_version: 'scenario:v2' } }),
        sameSource({ policyResult: { ...source.policyResult, audit_payload: { parameters: { threshold_class: 'INELIGIBLE' } } } }),
        sameSource({ policyResult: { ...source.policyResult, rule_branch: 'OTHER_RULE_BRANCH' } })
    ];
    const results = applyReusablePolicyDecisionsToPreviewRows({
        rows: changedRows,
        rules: [reusableV3Rule(source)]
    });
    results.forEach((row) => assert.strictEqual(row.policyResult.result_status, 'NEEDS_REVIEW'));
}

function testAllHrPolicyChoicesCanBeReusableWhenTermsAreExact() {
    for (const decisionType of ['APPROVE_PREFILL', 'MARK_OK', 'MARK_REVIEWED', 'REJECT_PROPOSAL']) {
        assert.strictEqual(getReusableDecisionEligibility({
            group: group({ status: 'PREFILLED_PENDING_APPROVAL' }),
            decisionType,
            items: [{ proposed_values: { kathgoria_ergasias_apologistika: 'ΕΡΓ' } }]
        }).eligible, true);
        const row = previewRow();
        const [resolved] = applyReusablePolicyDecisionsToPreviewRows({
            rows: [row],
            rules: [reusableV3Rule(row, { decision_type: decisionType })]
        });
        assert.strictEqual(resolved.policyResult.result_status, 'RESOLVED_BY_POLICY');
        assert.strictEqual(resolved.policyResult.reusable_decision.decision_type, decisionType);
    }
}

function testExpiredRevokedAndMultipleActiveRulesFailClosed() {
    const row = previewRow({
        scenarioFactsSummary: { ...previewRow().scenarioFactsSummary, is_locked: true },
        policyResult: { ...previewRow().policyResult, proposed_updates: { current: 'conflict' } }
    });
    const expired = reusableV3Rule(row, { reuse_effective_to: new Date('2026-07-01T00:00:00Z') });
    const revoked = reusableV3Rule(row, { reuse_status: 'REVOKED' });
    const systemCancelled = reusableV3Rule(row, {
        decision_status: 'CANCELLED', reuse_status: 'REVOKED',
        cancel_reason_code: 'CONCURRENT_ACTIVE_POLICY_CONFLICT'
    });
    for (const rule of [expired, revoked, systemCancelled]) {
        const [pending] = applyReusablePolicyDecisionsToPreviewRows({ rows: [row], rules: [rule] });
        assert.strictEqual(pending.policyResult.result_status, 'NEEDS_REVIEW');
    }
    const [conflict] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [row],
        rules: [reusableV3Rule(row, { _id: 'a', decision_type: 'MARK_OK' }),
            reusableV3Rule(row, { _id: 'b', decision_type: 'REJECT_PROPOSAL' })]
    });
    assert.strictEqual(conflict.policyResult.result_status, 'NEEDS_REVIEW');
    assert.strictEqual(conflict.policyResult.reusable_conflict_code, 'MULTIPLE_ACTIVE_REUSABLE_DECISIONS');
    assert.strictEqual(conflict.policyResult.reusable_application_gate_code, undefined);
    assert.deepStrictEqual(conflict.policyResult.proposed_updates, { current: 'conflict' });
}

function testV2RemainsResultSpecific() {
    const source = previewRow();
    const changed = previewRow({
        scenarioFactsSummary: { ...source.scenarioFactsSummary, card_hours: 7 },
        policyResult: { ...source.policyResult, proposed_updates: { kathgoria_ergasias_apologistika: 'ΜΕ' } }
    });
    const [pending] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [changed], rules: [reusableV2Rule(source)]
    });
    assert.strictEqual(pending.policyResult.result_status, 'NEEDS_REVIEW');
}

function testLegacyRuleRemainsCompatibleButEmployeeScoped() {
    const criteria = buildReusableMatchCriteriaFromGroup(group(), '0000');
    const rule = reusableRule(criteria, {
        team: 'team-a', company_kod: 'company-a', ypokatasthma: '0000',
        items: [{ employee_kodikos: '001' }]
    });
    const [sameEmployee, otherEmployee] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [previewRow({ kodikos: '001' }), previewRow({ kodikos: '002' })],
        rules: [rule]
    });
    assert.strictEqual(sameEmployee.policyResult.result_status, 'RESOLVED_BY_POLICY');
    assert.strictEqual(otherEmployee.policyResult.result_status, 'NEEDS_REVIEW');

    const crossScopeRows = applyReusablePolicyDecisionsToPreviewRows({
        rows: [
            previewRow({ team: 'team-b' }),
            previewRow({ company_kod: 'company-b' }),
            previewRow({ ypokatasthma: '0001' })
        ],
        rules: [rule]
    });
    crossScopeRows.forEach((row) =>
        assert.strictEqual(row.policyResult.result_status, 'NEEDS_REVIEW'));
}

function testChangedScenarioAndEarlierDateRemainPending() {
    const criteria = buildReusableMatchCriteriaFromGroup(group(), '0000');
    const [changedScenario, earlierDate] = applyReusablePolicyDecisionsToPreviewRows({
        rows: [
            previewRow({
                scenarioDecision: {
                    scenario_code: 'DECLARED_REPO_WITH_CARDS',
                    requires_review: true,
                    reasons: ['DECLARED_REPO_WITH_CARDS']
                }
            }),
            previewRow({ hmeromhnia: new Date('2026-05-31T00:00:00.000Z') })
        ],
        rules: [reusableRule(criteria, {
            team: 'team-a', company_kod: 'company-a', ypokatasthma: '0000',
            items: [{ employee_kodikos: '001' }]
        })]
    });

    assert.strictEqual(changedScenario.policyResult.result_status, 'NEEDS_REVIEW');
    assert.strictEqual(earlierDate.policyResult.result_status, 'NEEDS_REVIEW');
}

function run() {
    testV4PolicyIdentityIsCrossEmployeeAndResultIndependent();
    testV4NormalizesMissingObjects();
    testV4PolicyDimensionsRemainIsolated();
    testStableFingerprintIgnoresEmployeeAndDate();
    testDifferentBranchDoesNotMatch();
    testKnownPoliciesAndExactProposedChangesAreReusable();
    testIdenticalFutureCaseIsResolvedWithAuditMetadata();
    testOpenEndedAndBoundedReusableEffectiveDates();
    testFifteenV4RowsResolveWithoutChangingCurrentRowValues();
    testAbsoluteHoursAndCurrentResultMayChangeButEmployeeMayNot();
    testPolicyScopeVersionParameterBranchAndConditionsMustMatch();
    testAllHrPolicyChoicesCanBeReusableWhenTermsAreExact();
    testLegacyRuleRemainsCompatibleButEmployeeScoped();
    testExpiredRevokedAndMultipleActiveRulesFailClosed();
    testV2RemainsResultSpecific();
    testChangedScenarioAndEarlierDateRemainPending();
    testExplicitBranchIgnoresReasonOrderAndMutableGates();
    testPolicySpecificConditionsExcludeUnrelatedApologistikaOutput();
    console.log('apasxoliseis reusable policy decision service tests passed');
}

run();
