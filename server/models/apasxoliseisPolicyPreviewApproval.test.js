const assert = require('assert');
const mongoose = require('mongoose');

const ApprovalModel = require('./apasxoliseisPolicyPreviewApproval');

const EXISTING_DECISION_TYPES = [
    'APPROVE_PREFILL',
    'MARK_OK',
    'MARK_REVIEWED',
    'REJECT_PROPOSAL',
    'NEEDS_MORE_REVIEW'
];

function validRecord(decisionType) {
    const sourceId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();
    return {
        team: 'team-a',
        company_kod: 'company-a',
        ypokatasthma: '0001',
        apo_hmeromhnia: new Date('2026-07-01T00:00:00.000Z'),
        eos_hmeromhnia: new Date('2026-07-31T00:00:00.000Z'),
        group_id: 'atomic-group-1',
        group_key: 'atomic-group-key-1',
        decision_type: decisionType,
        decision_status: 'RECORDED',
        reuse_scope: decisionType === 'APPROVE_PROPOSAL'
            ? 'FUTURE_IDENTICAL'
            : 'ONE_TIME',
        reuse_status: decisionType === 'APPROVE_PROPOSAL' ? 'ACTIVE' : 'NOT_APPLICABLE',
        reuse_fingerprint: decisionType === 'APPROVE_PROPOSAL' ? 'a'.repeat(64) : '',
        reuse_fingerprints: decisionType === 'APPROVE_PROPOSAL' ? ['a'.repeat(64)] : [],
        reuse_match_criteria: decisionType === 'APPROVE_PROPOSAL'
            ? {
                  version: 5,
                  decision_grain: 'ATOMIC_LINKED_SET',
                  linked_set_type: 'ATOMIC_PAIRED_PROPOSAL',
                  linked_member_count: 2,
                  role_contract: ['SOURCE_BECOMES_WORK', 'TARGET_BECOMES_REPO']
              }
            : null,
        reuse_effective_from: decisionType === 'APPROVE_PROPOSAL'
            ? new Date('2026-07-01T00:00:00.000Z')
            : null,
        items: [
            {
                preview_id: String(sourceId),
                prodhlomena_oraria_id: sourceId,
                employee_kodikos: '001',
                hmeromhnia: new Date('2026-07-06T00:00:00.000Z'),
                flags: { atomic_role: 'SOURCE_BECOMES_WORK' }
            },
            {
                preview_id: String(targetId),
                prodhlomena_oraria_id: targetId,
                employee_kodikos: '001',
                hmeromhnia: new Date('2026-07-10T00:00:00.000Z'),
                flags: { atomic_role: 'TARGET_BECOMES_REPO' }
            }
        ],
        snapshot_summary: {
            items_count: 2,
            employees_count: 1,
            first_date: new Date('2026-07-06T00:00:00.000Z'),
            last_date: new Date('2026-07-10T00:00:00.000Z')
        },
        created_by_user_id: new mongoose.Types.ObjectId(),
        created_by_user_name: 'HR User'
    };
}

function assertValid(decisionType) {
    const document = new ApprovalModel(validRecord(decisionType));
    assert.strictEqual(document.validateSync(), undefined, decisionType);
}

assertValid('APPROVE_PROPOSAL');
EXISTING_DECISION_TYPES.forEach(assertValid);

const invalid = new ApprovalModel(validRecord('UNKNOWN_DECISION'));
const validationError = invalid.validateSync();
assert.ok(validationError?.errors?.decision_type);
assert.strictEqual(validationError.errors.decision_type.kind, 'enum');

const decisionTypePath = ApprovalModel.schema.path('decision_type');
assert.deepStrictEqual(decisionTypePath.enumValues, [
    'APPROVE_PROPOSAL',
    ...EXISTING_DECISION_TYPES
]);
assert.strictEqual(decisionTypePath.options.required, true);
assert.strictEqual(ApprovalModel.schema.options.collection,
    'Apasxoliseis_Policy_Preview_Approvals');
assert.strictEqual(ApprovalModel.modelName, 'ApasxoliseisPolicyPreviewApprovals');
assert.deepStrictEqual(ApprovalModel.schema.indexes().length, 6);
const orphanUniqueIndex = ApprovalModel.schema.indexes().find(([, options]) =>
    options.name === 'uniq_active_orphan_reusable_policy');
assert(orphanUniqueIndex);
assert.strictEqual(orphanUniqueIndex[1].unique, true);
assert.strictEqual(orphanUniqueIndex[1].partialFilterExpression.policy_code,
    'ORPHAN_CARD_CONTINUOUS_RESOLUTION');

const atomic = new ApprovalModel(validRecord('APPROVE_PROPOSAL'));
assert.strictEqual(atomic.reuse_match_criteria.version, 5);
assert.strictEqual(atomic.reuse_match_criteria.decision_grain, 'ATOMIC_LINKED_SET');
assert.strictEqual(atomic.reuse_scope, 'FUTURE_IDENTICAL');
assert.strictEqual(atomic.validateSync(), undefined);

console.log('policy preview approval model validation tests passed');
