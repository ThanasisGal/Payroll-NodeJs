const assert = require('assert');

const {
    MAX_ITEMS,
    validatePolicyPreviewApprovalPayload,
    validateSessionScope,
    buildRecordedDecisionLookup,
    buildPolicyPreviewApprovalListFilter,
    createPolicyPreviewApprovalRecord,
    revokePolicyPreviewApprovalRecord,
    listActiveReusablePolicyDecisionRecords
} = require('./apasxoliseisPolicyPreviewApprovalService');
const {
    buildAtomicReusableCriteriaV5
} = require('./apasxoliseisWeeklyRepoTransferAtomicReusableDecisionService');

const session = {
    userTeam: 'team-a',
    companyInUse: '507f1f77bcf86cd799439011',
    yearInUse: '2026',
    userId: '507f191e810c19729de860ea',
    userName: 'HR User',
    userRole: 'A',
    userStatus: 'A'
};

function makeItem(overrides = {}) {
    return {
        preview_id: '507f1f77bcf86cd799439012',
        prodhlomena_oraria_id: '507f1f77bcf86cd799439012',
        employee_kodikos: '001',
        hmeromhnia: '2026-06-15',
        kathgoria_ergasias: 'ΕΡΓ',
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        cards_ores_ergasias: 8,
        proposed_values: { ores_ergasias_apologistika: 8 },
        policy_context: {
            policy_version: 'policy:v1', scenario_version: 'scenario:v1',
            decision_grain: 'ROW_DAY', rule_branch: 'TEST_REASON',
            parameters: { threshold_class: 'ELIGIBLE' }, thresholds: {},
            conditions: { declared_category: 'ΕΡΓ', has_cards: true }
        },
        flags: { requires_human_approval: true },
        ...overrides
    };
}

function makePayload(overrides = {}) {
    return {
        apo_hmeromhnia: '2026-06-01',
        eos_hmeromhnia: '2026-06-30',
        group: {
            group_id: 'policy-preview-group-abc123',
            group_key: 'status=NEEDS_REVIEW|policy_code=TEST',
            scope: 'page',
            status: 'NEEDS_REVIEW',
            policy_code: 'TEST_POLICY',
            scenario_code: 'TEST_SCENARIO',
            action_type: 'REVIEW_ONLY',
            reason_code: 'TEST_REASON'
        },
        decision_type: 'MARK_REVIEWED',
        notes: 'Ελεγχόμενο test record',
        items: [makeItem()],
        ...overrides
    };
}

function makeAtomicGroup(overrides = {}) {
    const base = {
        group_id: 'atomic-group-1',
        group_key: 'atomic-group-key-1',
        group_type: 'ATOMIC_PAIRED_PROPOSAL',
        decision_grain: 'ATOMIC_LINKED_SET',
        team: session.userTeam,
        company_kod: session.companyInUse,
        ypokatasthma: '0001',
        status: 'NEEDS_REVIEW',
        policy_code: 'WEEKLY_REPO_BALANCE',
        scenario_code: 'REPO_TRANSFER_WITHIN_WEEK_SINGLE_PAIR',
        action_type: 'PAIRED_PROPOSAL',
        reason_code: 'REPO_TRANSFER_CANDIDATE',
        count: 2,
        decision_units_count: 1,
        pair_contract: {
            atomic_pair_required: true,
            choice_code: 'TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR',
            proposal_version: 'repo-transfer-single-pair-proposal:v4'
        },
        atomic_reusable_context: {
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
            week_boundary_semantics: 'MONDAY_TO_SUNDAY_SAME_NATURAL_WEEK'
        },
        atomic_reusable_diagnostics: [],
        items: [
            {
                preview_id: '507f1f77bcf86cd799439021',
                prodhlomena_oraria_id: '507f1f77bcf86cd799439021',
                employee_kodikos: '001', team: session.userTeam,
                company_kod: session.companyInUse, ypokatasthma: '0001',
                role: 'SOURCE_BECOMES_WORK', hmeromhnia: '2026-07-06',
                kathgoria_ergasias: 'ΑΝ', proposed_values: { marker: 'current-source' },
                flags: { current_eligible: true }
            },
            {
                preview_id: '507f1f77bcf86cd799439022',
                prodhlomena_oraria_id: '507f1f77bcf86cd799439022',
                employee_kodikos: '001', team: session.userTeam,
                company_kod: session.companyInUse, ypokatasthma: '0001',
                role: 'TARGET_BECOMES_REPO', hmeromhnia: '2026-07-10',
                kathgoria_ergasias: 'ΕΡΓ', proposed_values: { marker: 'current-target' },
                flags: { current_eligible: true }
            }
        ]
    };
    return { ...base, ...overrides };
}

function makeAtomicPayload(group, overrides = {}) {
    return makePayload({
        apo_hmeromhnia: '2026-07-01',
        eos_hmeromhnia: '2026-07-31',
        ypokatasthma: '0001',
        group: {
            group_id: group.group_id,
            group_key: group.group_key,
            group_type: group.group_type,
            decision_grain: group.decision_grain,
            status: group.status,
            policy_code: group.policy_code,
            scenario_code: group.scenario_code,
            action_type: group.action_type,
            reason_code: group.reason_code
        },
        decision_type: 'APPROVE_PROPOSAL',
        reuse_scope: 'FUTURE_IDENTICAL',
        reuse_fingerprint: 'client-forged-fingerprint',
        items: group.items,
        ...overrides
    });
}

function atomicApprovalModel(candidates = []) {
    let created = null;
    return {
        model: {
            findOne: () => ({ select: () => ({ lean: async () => null }) }),
            find: () => ({ select: () => ({ lean: async () => candidates }) }),
            create: async (record) => { created = record; return { _id: 'atomic-created', ...record }; },
            countDocuments: async () => 1
        },
        created: () => created
    };
}

async function testAuthoritativeAtomicV5ApprovalCreationAndGuards() {
    const group = makeAtomicGroup();
    const expected = buildAtomicReusableCriteriaV5(group);
    const storage = atomicApprovalModel();
    await createPolicyPreviewApprovalRecord({
        session,
        payload: makeAtomicPayload(group),
        authoritativeAtomicGroup: group,
        authoritativeAtomicOverlap: { conflict: false },
        approvalModel: storage.model
    });
    const created = storage.created();
    assert.strictEqual(created.reuse_fingerprint, expected.fingerprint);
    assert.notStrictEqual(created.reuse_fingerprint, 'client-forged-fingerprint');
    assert.strictEqual(created.reuse_match_criteria.version, 5);
    assert.strictEqual(created.reuse_match_criteria.decision_grain, 'ATOMIC_LINKED_SET');
    assert.deepStrictEqual(created.reuse_match_criteria.role_contract,
        ['SOURCE_BECOMES_WORK', 'TARGET_BECOMES_REPO']);
    assert.deepStrictEqual(created.items.map((item) => item.flags.atomic_role),
        ['SOURCE_BECOMES_WORK', 'TARGET_BECOMES_REPO']);

    for (const decisionType of ['REJECT_PROPOSAL', 'NEEDS_MORE_REVIEW']) {
        const blocked = atomicApprovalModel();
        await assert.rejects(() => createPolicyPreviewApprovalRecord({
            session,
            payload: makeAtomicPayload(group, { decision_type: decisionType }),
            authoritativeAtomicGroup: group,
            authoritativeAtomicOverlap: { conflict: false },
            approvalModel: blocked.model
        }), (error) => error.statusCode === 400 &&
            error.code === 'ATOMIC_REUSABLE_DECISION_TYPE_NOT_ALLOWED');
        assert.strictEqual(blocked.created(), null);
    }

    const invalidCases = [
        {
            group: { ...group, items: [group.items[0]] },
            overlap: { conflict: false }
        },
        {
            group: { ...group, items: [group.items[1]] },
            overlap: { conflict: false }
        },
        {
            group: {
                ...group,
                ypokatasthma: null,
                atomic_reusable_diagnostics: ['ATOMIC_LINKED_SET_SOURCE_SCOPE_UNRESOLVED']
            },
            overlap: { conflict: false }
        },
        { group, overlap: { conflict: true } }
    ];
    for (const invalid of invalidCases) {
        const blocked = atomicApprovalModel();
        await assert.rejects(() => createPolicyPreviewApprovalRecord({
            session,
            payload: makeAtomicPayload(group),
            authoritativeAtomicGroup: invalid.group,
            authoritativeAtomicOverlap: invalid.overlap,
            approvalModel: blocked.model
        }), (error) => error.statusCode === 400);
        assert.strictEqual(blocked.created(), null);
    }
    await assert.rejects(() => createPolicyPreviewApprovalRecord({
        session,
        payload: makeAtomicPayload(group, {
            reuse_scope: 'ONE_TIME',
            decision_type: 'REJECT_PROPOSAL'
        }),
        authoritativeAtomicGroup: group,
        authoritativeAtomicOverlap: { conflict: false },
        approvalModel: atomicApprovalModel().model
    }), (error) => error.statusCode === 400 &&
        error.code === 'ATOMIC_ONE_TIME_USES_DEDICATED_PIPELINE');
}

async function testAtomicV5DuplicateLifecycleAndCrossEmployeeIdentity() {
    const group = makeAtomicGroup();
    const fingerprint = buildAtomicReusableCriteriaV5(group).fingerprint;
    const active = {
        _id: 'active-v5', reuse_scope: 'FUTURE_IDENTICAL', reuse_status: 'ACTIVE',
        decision_status: 'RECORDED', decision_type: 'APPROVE_PROPOSAL',
        reuse_effective_from: new Date('2026-07-01T00:00:00.000Z'),
        reuse_effective_to: null, reuse_fingerprint: fingerprint
    };
    for (const employeeKodikos of ['001', '999']) {
        const employeeGroup = {
            ...group,
            items: group.items.map((item) => ({ ...item, employee_kodikos: employeeKodikos }))
        };
        const blocked = atomicApprovalModel([active]);
        await assert.rejects(() => createPolicyPreviewApprovalRecord({
            session,
            payload: makeAtomicPayload(employeeGroup),
            authoritativeAtomicGroup: employeeGroup,
            authoritativeAtomicOverlap: { conflict: false },
            approvalModel: blocked.model
        }), (error) => error.statusCode === 409);
        assert.strictEqual(blocked.created(), null);
    }

    for (const historical of [
        { ...active, reuse_status: 'REVOKED' },
        { ...active, decision_status: 'CANCELLED' },
        { ...active, reuse_effective_to: new Date('2026-07-05T00:00:00.000Z') }
    ]) {
        const visible = historical.reuse_status === 'ACTIVE' &&
            historical.decision_status === 'RECORDED' ? [historical] : [];
        const allowed = atomicApprovalModel(visible);
        await createPolicyPreviewApprovalRecord({
            session,
            payload: makeAtomicPayload(group),
            authoritativeAtomicGroup: group,
            authoritativeAtomicOverlap: { conflict: false },
            approvalModel: allowed.model
        });
        assert.ok(allowed.created());
    }
}

function assertValidationError(fn, expectedText) {
    assert.throws(fn, (error) => {
        assert.strictEqual(error.statusCode, 400);
        assert.match(error.message, expectedText);
        return true;
    });
}

function testMissingGroupIdRejected() {
    const payload = makePayload();
    delete payload.group.group_id;
    assertValidationError(
        () => validatePolicyPreviewApprovalPayload(payload),
        /group_id/
    );
}

function testInvalidDecisionTypeRejected() {
    assertValidationError(
        () => validatePolicyPreviewApprovalPayload(makePayload({ decision_type: 'APPLY_NOW' })),
        /δεν υποστηρίζεται/
    );
}

function testInvalidItemsRejected() {
    assertValidationError(
        () => validatePolicyPreviewApprovalPayload(makePayload({ items: {} })),
        /array/
    );

    assertValidationError(
        () =>
            validatePolicyPreviewApprovalPayload(
                makePayload({ items: Array.from({ length: MAX_ITEMS + 1 }, () => makeItem()) })
            ),
        /1 έως 500/
    );
}

function testValidPayloadAccepted() {
    const normalized = validatePolicyPreviewApprovalPayload(makePayload());
    assert.strictEqual(normalized.group.group_id, 'policy-preview-group-abc123');
    assert.strictEqual(normalized.decision_type, 'MARK_REVIEWED');
    assert.strictEqual(normalized.items.length, 1);
    assert.strictEqual(normalized.items[0].cards_ores_ergasias, 8);
    assert.strictEqual(normalized.reuse_scope, 'ONE_TIME');
}

function testInvalidReuseScopeRejected() {
    assertValidationError(
        () => validatePolicyPreviewApprovalPayload(makePayload({ reuse_scope: 'FOREVER' })),
        /εμβέλεια επαναχρησιμοποίησης/
    );
}

function testDuplicatePreviewIdRejected() {
    assertValidationError(
        () =>
            validatePolicyPreviewApprovalPayload(
                makePayload({ items: [makeItem(), makeItem()] })
            ),
        /διπλό preview_id/
    );
}

function testItemOutsidePeriodRejected() {
    assertValidationError(
        () =>
            validatePolicyPreviewApprovalPayload(
                makePayload({ items: [makeItem({ hmeromhnia: '2026-07-01' })] })
            ),
        /εκτός της δηλωμένης περιόδου/
    );
}

function testInactiveSessionRejected() {
    assert.throws(
        () => validateSessionScope({ ...session, userStatus: 'I' }),
        (error) => {
            assert.strictEqual(error.statusCode, 403);
            assert.match(error.message, /δεν είναι ενεργός/);
            return true;
        }
    );
}

function testMissingOrInvalidSessionUserIdRejected() {
    ['', 'not-an-object-id'].forEach((userId) => {
        assert.throws(
            () => validateSessionScope({ ...session, userId }),
            (error) => {
                assert.strictEqual(error.statusCode, 403);
                assert.match(error.message, /στοιχεία συνεδρίας/);
                return true;
            }
        );
    });
}

function testListingFilterUsesSessionScope() {
    const filter = buildPolicyPreviewApprovalListFilter({
        session,
        filters: {
            team: 'untrusted-team',
            company_kod: 'untrusted-company',
            apo_hmeromhnia: '2026-06-01',
            eos_hmeromhnia: '2026-06-30',
            group_id: 'policy-preview-group-abc123',
            decision_status: 'RECORDED'
        }
    });

    assert.strictEqual(filter.team, session.userTeam);
    assert.strictEqual(filter.company_kod, session.companyInUse);
    assert.strictEqual(filter.group_id, 'policy-preview-group-abc123');
    assert.strictEqual(filter.decision_status, 'RECORDED');
    assert.strictEqual(
        filter.apo_hmeromhnia.$gte.toISOString(),
        '2026-06-01T00:00:00.000Z'
    );
    assert.strictEqual(
        filter.eos_hmeromhnia.$lte.toISOString(),
        '2026-06-30T00:00:00.000Z'
    );
}

function testRecordedDecisionLookupSeparatesReusableActiveFromOneTimeHistory() {
    const normalizedOneTime = validatePolicyPreviewApprovalPayload(makePayload());
    const oneTimeLookup = buildRecordedDecisionLookup(
        validateSessionScope(session),
        normalizedOneTime
    );
    assert.strictEqual(oneTimeLookup.decision_status, 'RECORDED');
    assert.strictEqual(oneTimeLookup.reuse_scope, undefined);
    assert.strictEqual(oneTimeLookup.reuse_status, undefined);

    const normalizedReusable = validatePolicyPreviewApprovalPayload(makePayload({
        reuse_scope: 'FUTURE_IDENTICAL',
        ypokatasthma: '0000'
    }));
    const reusableLookup = buildRecordedDecisionLookup(
        validateSessionScope(session),
        normalizedReusable
    );
    assert.strictEqual(reusableLookup.decision_status, 'RECORDED');
    assert.strictEqual(reusableLookup.reuse_scope, 'FUTURE_IDENTICAL');
    assert.strictEqual(reusableLookup.reuse_status, 'ACTIVE');
}

async function testCreateWritesOnlyToInjectedApprovalModel() {
    let lookup = null;
    let createdRecord = null;
    const fakeApprovalModel = {
        findOne(filter) {
            lookup = filter;
            return {
                select() {
                    return {
                        lean: async () => null
                    };
                }
            };
        },
        async create(record) {
            createdRecord = record;
            return { _id: 'approval-test-id', ...record };
        },
        find() {
            return {
                select() {
                    return { lean: async () => [] };
                }
            };
        }
    };

    const result = await createPolicyPreviewApprovalRecord({
        session,
        payload: makePayload(),
        approvalModel: fakeApprovalModel
    });

    assert.strictEqual(result._id, 'approval-test-id');
    assert.strictEqual(lookup.team, session.userTeam);
    assert.strictEqual(lookup.company_kod, session.companyInUse);
    assert.strictEqual(lookup.decision_status, 'RECORDED');
    assert.strictEqual(createdRecord.team, session.userTeam);
    assert.strictEqual(createdRecord.company_kod, session.companyInUse);
    assert.strictEqual(createdRecord.decision_status, 'RECORDED');
    assert.strictEqual(createdRecord.items.length, 1);
    assert.strictEqual(createdRecord.reuse_scope, 'ONE_TIME');
    assert.strictEqual(createdRecord.reuse_status, 'NOT_APPLICABLE');
}

async function testReusableApprovalStoresServerFingerprintAndAuditScope() {
    const lookups = [];
    let createdRecord = null;
    const fakeApprovalModel = {
        findOne(filter) {
            lookups.push(filter);
            return {
                select() {
                    return { lean: async () => null };
                }
            };
        },
        find: () => ({ select: () => ({ lean: async () => [] }) }),
        async create(record) {
            createdRecord = record;
            return { _id: 'reusable-approval-id', ...record };
        }
    };

    await createPolicyPreviewApprovalRecord({
        session,
        payload: makePayload({
            ypokatasthma: '0000',
            reuse_scope: 'FUTURE_IDENTICAL',
            items: [makeItem({ proposed_values: {} })]
        }),
        approvalModel: fakeApprovalModel
    });

    assert.strictEqual(lookups.length, 1);
    assert.strictEqual(createdRecord.reuse_scope, 'FUTURE_IDENTICAL');
    assert.strictEqual(createdRecord.reuse_status, 'ACTIVE');
    assert.strictEqual(createdRecord.reuse_fingerprint.length, 64);
    assert.strictEqual(createdRecord.reuse_match_criteria.version, 4);
    assert.strictEqual(createdRecord.reuse_match_criteria.variants[0].ypokatasthma, '0000');
    assert.strictEqual(createdRecord.reuse_match_criteria.variants[0].employee_kodikos, undefined);
    assert.strictEqual(createdRecord.items[0].employee_kodikos, '001');
    assert.strictEqual(createdRecord.reuse_match_criteria.variants[0].team, session.userTeam.toUpperCase());
    assert.strictEqual(createdRecord.reuse_match_criteria.variants[0].company_kod, session.companyInUse.toUpperCase());
    assert.strictEqual(createdRecord.reuse_match_criteria.variants[0].policy_version, 'POLICY:V1');
    assert.strictEqual(createdRecord.reuse_match_criteria.variants[0].scenario_version, 'SCENARIO:V1');
    assert.strictEqual(createdRecord.reuse_match_criteria.variants[0].decision_type, undefined);
    assert.deepStrictEqual(createdRecord.reuse_match_criteria.variants[0].thresholds, {});
    assert.strictEqual(createdRecord.reuse_fingerprints.length, 1);
    assert.strictEqual(createdRecord.active_policy_key, createdRecord.reuse_fingerprint);
    assert.deepStrictEqual(createdRecord.active_policy_keys, createdRecord.reuse_fingerprints);
    assert.strictEqual(
        createdRecord.reuse_effective_from.toISOString(),
        '2026-06-01T00:00:00.000Z'
    );
}

async function testRevokedReusableHistoryAllowsNewReusableDocument() {
    const revokedId = '6a743bc11cc18bdde16f3dcd';
    let duplicateLookup;
    let createdRecord;
    let updateCalled = false;
    let deleteCalled = false;
    const result = await createPolicyPreviewApprovalRecord({
        session,
        payload: makePayload({
            ypokatasthma: '0000',
            reuse_scope: 'FUTURE_IDENTICAL',
            decision_type: 'APPROVE_PREFILL'
        }),
        approvalModel: {
            findOne(filter) {
                duplicateLookup = filter;
                return { select: () => ({ lean: async () => null }) };
            },
            find: () => ({ select: () => ({ lean: async () => [] }) }),
            create: async (record) => {
                createdRecord = record;
                return { _id: 'new-reusable-approval', ...record };
            },
            findOneAndUpdate: () => { updateCalled = true; },
            deleteOne: () => { deleteCalled = true; }
        }
    });

    assert.strictEqual(duplicateLookup.reuse_scope, 'FUTURE_IDENTICAL');
    assert.strictEqual(duplicateLookup.reuse_status, 'ACTIVE');
    assert.strictEqual(result._id, 'new-reusable-approval');
    assert.notStrictEqual(result._id, revokedId);
    assert.strictEqual(createdRecord.reuse_status, 'ACTIVE');
    assert.strictEqual(updateCalled, false);
    assert.strictEqual(deleteCalled, false);
}

async function testActiveSameGroupReusableStillBlocksCreate() {
    let createCalled = false;
    await assert.rejects(() => createPolicyPreviewApprovalRecord({
        session,
        payload: makePayload({ ypokatasthma: '0000', reuse_scope: 'FUTURE_IDENTICAL' }),
        approvalModel: {
            findOne: () => ({ select: () => ({ lean: async () => ({
                _id: 'active-same-group',
                reuse_scope: 'FUTURE_IDENTICAL',
                reuse_effective_from: new Date('2026-06-01T00:00:00.000Z'),
                reuse_effective_to: null
            }) }) }),
            create: async () => { createCalled = true; }
        }
    }), (error) => error.statusCode === 409);
    assert.strictEqual(createCalled, false);
}

async function testRecordedOneTimeDuplicateBehaviorIsUnchanged() {
    let capturedLookup;
    let createCalled = false;
    await assert.rejects(() => createPolicyPreviewApprovalRecord({
        session,
        payload: makePayload({ reuse_scope: 'ONE_TIME', decision_type: 'MARK_REVIEWED' }),
        approvalModel: {
            findOne(filter) {
                capturedLookup = filter;
                return { select: () => ({ lean: async () => ({ _id: 'existing-one-time' }) }) };
            },
            create: async () => { createCalled = true; }
        }
    }), (error) => error.statusCode === 409 && /ίδια καταγεγραμμένη/.test(error.message));
    assert.strictEqual(capturedLookup.decision_status, 'RECORDED');
    assert.strictEqual(capturedLookup.reuse_scope, undefined);
    assert.strictEqual(capturedLookup.reuse_status, undefined);
    assert.strictEqual(createCalled, false);
}

async function testIneffectiveReusableHistoryDoesNotBlockNewReusable() {
    for (const historical of [
        {
            _id: 'expired', reuse_scope: 'FUTURE_IDENTICAL',
            reuse_effective_from: new Date('2026-05-01T00:00:00.000Z'),
            reuse_effective_to: new Date('2026-05-31T00:00:00.000Z')
        },
        {
            _id: 'not-yet-effective', reuse_scope: 'FUTURE_IDENTICAL',
            reuse_effective_from: new Date('2026-07-01T00:00:00.000Z'),
            reuse_effective_to: null
        }
    ]) {
        let createCalled = false;
        await createPolicyPreviewApprovalRecord({
            session,
            payload: makePayload({ ypokatasthma: '0000', reuse_scope: 'FUTURE_IDENTICAL' }),
            approvalModel: {
                findOne: () => ({ select: () => ({ lean: async () => historical }) }),
                find: () => ({ select: () => ({ lean: async () => [historical] }) }),
                create: async (record) => {
                    createCalled = true;
                    return { _id: `new-after-${historical._id}`, ...record };
                }
            }
        });
        assert.strictEqual(createCalled, true, historical._id);
    }
}

async function testReusableDuplicateUsesDecisionIndependentActivePolicyKey() {
    let reusableLookup;
    const existing = {
        _id: '507f1f77bcf86cd799439099', decision_type: 'MARK_OK',
        reuse_effective_from: new Date('2026-06-01T00:00:00.000Z'),
        reuse_effective_to: null
    };
    let createCalled = false;
    let cancellationCalled = false;
    await assert.rejects(() => createPolicyPreviewApprovalRecord({
        session,
        payload: makePayload({ ypokatasthma: '0000', reuse_scope: 'FUTURE_IDENTICAL',
            decision_type: 'REJECT_PROPOSAL' }),
        approvalModel: {
            findOne: () => ({ select: () => ({ lean: async () => null }) }),
            find(filter) {
                reusableLookup = filter;
                return { select: () => ({ lean: async () => [existing] }) };
            },
            create: async () => { createCalled = true; },
            findOneAndUpdate: () => { cancellationCalled = true; }
        }
    }), (error) => error.statusCode === 409 && /πρώτα να ανακληθεί/.test(error.message));
    assert.ok(reusableLookup.$or[0].active_policy_keys.$in.length > 0);
    assert.strictEqual(reusableLookup.decision_type, undefined);
    assert.strictEqual(createCalled, false);
    assert.strictEqual(cancellationCalled, false);
}

async function testReusableDuplicateIsCrossEmployeeForSameV4PolicyKey() {
    async function captureKey(employeeKodikos, previewId) {
        let created;
        await createPolicyPreviewApprovalRecord({
            session,
            payload: makePayload({
                ypokatasthma: '0000',
                reuse_scope: 'FUTURE_IDENTICAL',
                items: [makeItem({
                    preview_id: previewId,
                    prodhlomena_oraria_id: previewId,
                    employee_kodikos: employeeKodikos,
                    hmeromhnia: employeeKodikos === '001' ? '2026-06-15' : '2026-06-20',
                    cards_ores_ergasias: employeeKodikos === '001' ? 8 : 6,
                    proposed_values: employeeKodikos === '001'
                        ? { ores_ergasias_apologistika: 8 }
                        : { kathgoria_ergasias_apologistika: 'ΕΡΓ' }
                })]
            }),
            approvalModel: {
                findOne: () => ({ select: () => ({ lean: async () => null }) }),
                find: () => ({ select: () => ({ lean: async () => [] }) }),
                create: async (record) => { created = record; return record; }
            }
        });
        return created;
    }

    const first = await captureKey('001', '507f1f77bcf86cd799439012');
    const second = await captureKey('002', '507f1f77bcf86cd799439013');
    assert.strictEqual(first.active_policy_key, second.active_policy_key);
    assert.strictEqual(first.items[0].employee_kodikos, '001');
    assert.strictEqual(second.items[0].employee_kodikos, '002');

    await assert.rejects(() => createPolicyPreviewApprovalRecord({
        session,
        payload: makePayload({
            ypokatasthma: '0000',
            reuse_scope: 'FUTURE_IDENTICAL',
            items: [makeItem({
                preview_id: '507f1f77bcf86cd799439013',
                prodhlomena_oraria_id: '507f1f77bcf86cd799439013',
                employee_kodikos: '002'
            })]
        }),
        approvalModel: {
            findOne: () => ({ select: () => ({ lean: async () => null }) }),
            find: () => ({ select: () => ({ lean: async () => [{
                _id: '507f1f77bcf86cd799439099',
                reuse_effective_from: new Date('2026-06-01T00:00:00.000Z'),
                reuse_effective_to: null
            }] }) })
        }
    }), (error) => error.statusCode === 409);
}

function activeReusableCandidate(overrides = {}) {
    return {
        _id: '507f1f77bcf86cd799439099',
        decision_type: 'APPROVE_PREFILL',
        decision_status: 'RECORDED',
        reuse_scope: 'FUTURE_IDENTICAL',
        reuse_status: 'ACTIVE',
        reuse_effective_from: new Date('2026-06-01T00:00:00.000Z'),
        reuse_effective_to: null,
        active_policy_key: 'active-v4-key',
        ...overrides
    };
}

function oneTimeApprovalModel(candidates = []) {
    let createCalled = false;
    return {
        model: {
            findOne: () => ({ select: () => ({ lean: async () => null }) }),
            find: () => ({ select: () => ({ lean: async () => candidates }) }),
            create: async (record) => {
                createCalled = true;
                return { _id: 'new-one-time', ...record };
            }
        },
        wasCreateCalled: () => createCalled
    };
}

async function testActiveReusablePolicyBlocksConflictingOneTimeDecisions() {
    for (const decisionType of ['REJECT_PROPOSAL', 'MARK_REVIEWED', 'NEEDS_MORE_REVIEW']) {
        const approvalModel = oneTimeApprovalModel([activeReusableCandidate()]);
        await assert.rejects(
            () => createPolicyPreviewApprovalRecord({
                session,
                payload: makePayload({
                    ypokatasthma: '0000',
                    reuse_scope: 'ONE_TIME',
                    decision_type: decisionType
                }),
                approvalModel: approvalModel.model
            }),
            (error) =>
                error.statusCode === 409 &&
                error.code === 'ACTIVE_REUSABLE_POLICY_ALREADY_APPLIES' &&
                /πρώτα να ανακληθεί/.test(error.message)
        );
        assert.strictEqual(approvalModel.wasCreateCalled(), false);
    }
}

async function testInactiveOrIneffectiveReusablePoliciesDoNotBlockOneTimeDecision() {
    const allowedCandidates = [
        activeReusableCandidate({ reuse_status: 'REVOKED' }),
        activeReusableCandidate({ decision_status: 'CANCELLED' }),
        activeReusableCandidate({ reuse_effective_to: new Date('2026-05-31T00:00:00.000Z') }),
        activeReusableCandidate({ reuse_effective_from: new Date('2026-07-01T00:00:00.000Z') })
    ];

    for (const candidate of allowedCandidates) {
        const visibleCandidates =
            candidate.reuse_status === 'ACTIVE' && candidate.decision_status === 'RECORDED'
                ? [candidate]
                : [];
        const approvalModel = oneTimeApprovalModel(visibleCandidates);
        const created = await createPolicyPreviewApprovalRecord({
            session,
            payload: makePayload({ ypokatasthma: '0000', reuse_scope: 'ONE_TIME' }),
            approvalModel: approvalModel.model
        });
        assert.strictEqual(created._id, 'new-one-time');
        assert.strictEqual(approvalModel.wasCreateCalled(), true);
    }
}

async function testDifferentReusablePolicyScopeOrKeyDoesNotBlockOneTimeDecision() {
    let capturedFilter;
    const approvalModel = oneTimeApprovalModel([]);
    approvalModel.model.find = (filter) => {
        capturedFilter = filter;
        return { select: () => ({ lean: async () => [] }) };
    };
    const created = await createPolicyPreviewApprovalRecord({
        session,
        payload: makePayload({ ypokatasthma: '0000', reuse_scope: 'ONE_TIME' }),
        approvalModel: approvalModel.model
    });

    assert.strictEqual(created._id, 'new-one-time');
    assert.strictEqual(capturedFilter.team, session.userTeam);
    assert.strictEqual(capturedFilter.company_kod, session.companyInUse);
    assert.strictEqual(capturedFilter.ypokatasthma, '0000');
    assert.ok(capturedFilter.$or[0].active_policy_keys.$in[0]);
}

async function testPostCreateRaceCancelsOnlyNewRecordWithSystemAudit() {
    let createdRecord;
    let cancellationFilter;
    let cancellationUpdate;
    const conflictTime = new Date('2026-08-05T12:00:00.000Z');
    await assert.rejects(() => createPolicyPreviewApprovalRecord({
        session,
        payload: makePayload({ ypokatasthma: '0000', reuse_scope: 'FUTURE_IDENTICAL' }),
        now: conflictTime,
        approvalModel: {
            findOne: () => ({ select: () => ({ lean: async () => null }) }),
            find: () => ({ select: () => ({ lean: async () => [] }) }),
            create: async (record) => {
                createdRecord = record;
                return { _id: 'created-during-race', ...record };
            },
            countDocuments: async () => 2,
            findOneAndUpdate(filter, mutation) {
                cancellationFilter = filter;
                cancellationUpdate = mutation;
                return { lean: async () => ({
                    _id: filter._id, ...createdRecord, ...mutation.$set
                }) };
            }
        }
    }), (error) => error.statusCode === 409 &&
        error.code === 'MULTIPLE_ACTIVE_REUSABLE_DECISIONS' && /ακυρώθηκε με ασφάλεια/.test(error.message));
    assert.strictEqual(createdRecord.reuse_status, 'ACTIVE');
    assert.strictEqual(createdRecord.decision_status, 'RECORDED');
    assert.deepStrictEqual(cancellationFilter, {
        _id: 'created-during-race', reuse_scope: 'FUTURE_IDENTICAL',
        reuse_status: 'ACTIVE', decision_status: 'RECORDED'
    });
    assert.strictEqual(cancellationUpdate.$set.decision_status, 'CANCELLED');
    assert.strictEqual(cancellationUpdate.$set.reuse_status, 'REVOKED');
    assert.strictEqual(cancellationUpdate.$set.reuse_effective_to, conflictTime);
    assert.strictEqual(cancellationUpdate.$set.cancelled_at, conflictTime);
    assert.strictEqual(cancellationUpdate.$set.cancel_reason_code, 'CONCURRENT_ACTIVE_POLICY_CONFLICT');
    assert.strictEqual(cancellationUpdate.$set.cancelled_by, 'SYSTEM_POST_CREATE_GUARD');
    assert.strictEqual(cancellationUpdate.$set.revoked_by_user_id, undefined);
    assert.strictEqual(cancellationUpdate.$set.revoked_by_user_name, undefined);
    assert.strictEqual(cancellationUpdate.$set.revoke_reason, undefined);
}

async function testPostCreateRaceCancellationFailureIsFailClosed() {
    for (const cancellationResult of ['THROW', 'NULL']) {
        await assert.rejects(() => createPolicyPreviewApprovalRecord({
            session,
            payload: makePayload({ ypokatasthma: '0000', reuse_scope: 'FUTURE_IDENTICAL' }),
            approvalModel: {
                findOne: () => ({ select: () => ({ lean: async () => null }) }),
                find: () => ({ select: () => ({ lean: async () => [] }) }),
                create: async (record) => ({ _id: 'new-conflicting-record', ...record }),
                countDocuments: async () => 2,
                findOneAndUpdate: () => {
                    if (cancellationResult === 'THROW') throw new Error('write failed');
                    return { lean: async () => null };
                }
            }
        }), (error) => error.statusCode === 500 &&
            error.code === 'POST_CREATE_CONFLICT_CANCELLATION_FAILED');
    }
}

async function testRevokeIsScopedAtomicAndAudited() {
    let updateFilter;
    let update;
    const approvalId = '507f1f77bcf86cd799439099';
    const approvalModel = {
        findOne(filter) {
            assert.strictEqual(filter.team, session.userTeam);
            assert.strictEqual(filter.company_kod, session.companyInUse);
            assert.strictEqual(filter.ypokatasthma, undefined);
            return { select: () => ({ lean: async () => ({
                _id: approvalId, reuse_scope: 'FUTURE_IDENTICAL', reuse_status: 'ACTIVE',
                decision_status: 'RECORDED', ypokatasthma: '0000', active_policy_key: 'abc'
            }) }) };
        },
        findOneAndUpdate(filter, mutation) {
            updateFilter = filter;
            update = mutation;
            return { lean: async () => ({ _id: approvalId, ...mutation.$set, active_policy_key: 'abc' }) };
        }
    };
    const result = await revokePolicyPreviewApprovalRecord({
        session, approvalId, reason: '  Νέα επιχειρησιακή απόφαση  ', approvalModel,
        now: new Date('2026-08-05T10:00:00.000Z')
    });
    assert.strictEqual(updateFilter.reuse_status, 'ACTIVE');
    assert.strictEqual(update.$set.reuse_status, 'REVOKED');
    assert.strictEqual(update.$set.revoke_reason, 'Νέα επιχειρησιακή απόφαση');
    assert.strictEqual(update.$set.revoked_by_user_id, session.userId);
    assert.strictEqual(result.active_policy_key, 'abc');
}

async function testRevokeValidationAndAuthorization() {
    await assert.rejects(() => revokePolicyPreviewApprovalRecord({
        session, approvalId: '507f1f77bcf86cd799439099', reason: ' ', approvalModel: {}
    }), (error) => error.statusCode === 400);
    await assert.rejects(() => revokePolicyPreviewApprovalRecord({
        session: { ...session, userRole: 'U' }, approvalId: '507f1f77bcf86cd799439099',
        reason: 'reason', approvalModel: {}
    }), (error) => error.statusCode === 403);

    for (const userRole of ['A', 'S', 'HR']) {
        let updated = false;
        await revokePolicyPreviewApprovalRecord({
            session: { ...session, userRole },
            approvalId: '507f1f77bcf86cd799439099', reason: 'company-wide revoke',
            approvalModel: {
                findOne: (filter) => ({ select: () => ({ lean: async () => ({
                    _id: filter._id, reuse_scope: 'FUTURE_IDENTICAL', reuse_status: 'ACTIVE',
                    decision_status: 'RECORDED', ypokatasthma: '0099', active_policy_key: 'key'
                }) }) }),
                findOneAndUpdate: (_filter, mutation) => ({ lean: async () => {
                    updated = true;
                    return { _id: '507f1f77bcf86cd799439099', active_policy_key: 'key', ...mutation.$set };
                } })
            }
        });
        assert.strictEqual(updated, true, userRole);
    }
}

async function testReusableApprovalAcceptsEveryPolicyWhenExactTermsAreCaptured() {
    const fakeApprovalModel = {
        findOne() {
            throw new Error('DB lookup must not run for invalid reusable approval');
        }
    };

    for (const decision_type of ['APPROVE_PREFILL', 'MARK_OK', 'MARK_REVIEWED', 'REJECT_PROPOSAL']) {
        let created = null;
        await createPolicyPreviewApprovalRecord({
                session,
                payload: makePayload({
                    ypokatasthma: '0000',
                    reuse_scope: 'FUTURE_IDENTICAL',
                    decision_type,
                    group: {
                        ...makePayload().group,
                        policy_code: 'INTERDAY_MINIMUM_REST',
                        reason_code: 'INTERDAY_REST_BELOW_MINIMUM'
                    }
                }),
                approvalModel: {
                    findOne: () => ({ select: () => ({ lean: async () => null }) }),
                    find: () => ({ select: () => ({ lean: async () => [] }) }),
                    create: async (record) => { created = record; return record; }
                }
            });
        assert.strictEqual(created.decision_type, decision_type);
        assert.strictEqual(created.reuse_match_criteria.variants[0].proposed_values, undefined);
    }
}

async function testReusableApprovalRequiresHrAdminOrSupervisorRole() {
    await assert.rejects(
        () =>
            createPolicyPreviewApprovalRecord({
                session: { ...session, userRole: 'U' },
                payload: makePayload({
                    ypokatasthma: '0000',
                    reuse_scope: 'FUTURE_IDENTICAL',
                    items: [makeItem({ proposed_values: {} })]
                }),
                approvalModel: {}
            }),
        (error) => error.statusCode === 403 && /HR, Admin ή Supervisor/.test(error.message)
    );
}

async function testReusableApprovalRequiresCompletePolicyContext() {
    await assert.rejects(() => createPolicyPreviewApprovalRecord({
        session,
        payload: makePayload({
            ypokatasthma: '0000', reuse_scope: 'FUTURE_IDENTICAL',
            items: [makeItem({ policy_context: {} })]
        }),
        approvalModel: {}
    }), /πλήρη έκδοση, grain και rule branch/);
}

async function testReusableRuleLookupIsCompanyAndBranchScoped() {
    let capturedFilter = null;
    const approvalModel = {
        find(filter) {
            capturedFilter = filter;
            return { sort: () => ({ lean: async () => [] }) };
        }
    };
    await listActiveReusablePolicyDecisionRecords({
        session,
        ypokatasthma: '1',
        approvalModel
    });
    assert.strictEqual(capturedFilter.team, session.userTeam);
    assert.strictEqual(capturedFilter.company_kod, session.companyInUse);
    assert.strictEqual(capturedFilter.ypokatasthma, '0001');
}

async function run() {
    testMissingGroupIdRejected();
    testInvalidDecisionTypeRejected();
    testInvalidItemsRejected();
    testValidPayloadAccepted();
    testInvalidReuseScopeRejected();
    testDuplicatePreviewIdRejected();
    testItemOutsidePeriodRejected();
    testInactiveSessionRejected();
    testMissingOrInvalidSessionUserIdRejected();
    testListingFilterUsesSessionScope();
    testRecordedDecisionLookupSeparatesReusableActiveFromOneTimeHistory();
    await testCreateWritesOnlyToInjectedApprovalModel();
    await testReusableApprovalStoresServerFingerprintAndAuditScope();
    await testRevokedReusableHistoryAllowsNewReusableDocument();
    await testActiveSameGroupReusableStillBlocksCreate();
    await testRecordedOneTimeDuplicateBehaviorIsUnchanged();
    await testIneffectiveReusableHistoryDoesNotBlockNewReusable();
    await testReusableApprovalAcceptsEveryPolicyWhenExactTermsAreCaptured();
    await testReusableApprovalRequiresHrAdminOrSupervisorRole();
    await testReusableApprovalRequiresCompletePolicyContext();
    await testReusableRuleLookupIsCompanyAndBranchScoped();
    await testReusableDuplicateUsesDecisionIndependentActivePolicyKey();
    await testReusableDuplicateIsCrossEmployeeForSameV4PolicyKey();
    await testActiveReusablePolicyBlocksConflictingOneTimeDecisions();
    await testInactiveOrIneffectiveReusablePoliciesDoNotBlockOneTimeDecision();
    await testDifferentReusablePolicyScopeOrKeyDoesNotBlockOneTimeDecision();
    await testPostCreateRaceCancelsOnlyNewRecordWithSystemAudit();
    await testPostCreateRaceCancellationFailureIsFailClosed();
    await testRevokeIsScopedAtomicAndAudited();
    await testRevokeValidationAndAuthorization();
    await testAuthoritativeAtomicV5ApprovalCreationAndGuards();
    await testAtomicV5DuplicateLifecycleAndCrossEmployeeIdentity();
    console.log('apasxoliseis policy preview approval service tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
