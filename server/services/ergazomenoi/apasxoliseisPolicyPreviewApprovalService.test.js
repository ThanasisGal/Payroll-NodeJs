const assert = require('assert');

const {
    MAX_ITEMS,
    validatePolicyPreviewApprovalPayload,
    validateSessionScope,
    buildPolicyPreviewApprovalListFilter,
    createPolicyPreviewApprovalRecord
} = require('./apasxoliseisPolicyPreviewApprovalService');

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
}

async function run() {
    testMissingGroupIdRejected();
    testInvalidDecisionTypeRejected();
    testInvalidItemsRejected();
    testValidPayloadAccepted();
    testDuplicatePreviewIdRejected();
    testItemOutsidePeriodRejected();
    testInactiveSessionRejected();
    testMissingOrInvalidSessionUserIdRejected();
    testListingFilterUsesSessionScope();
    await testCreateWritesOnlyToInjectedApprovalModel();
    console.log('apasxoliseis policy preview approval service tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
