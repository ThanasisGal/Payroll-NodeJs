'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const {
    createOrphanReusablePolicyDecisionRecord,
    findMatchingOrphanReusablePolicyDecision
} = require('./apasxoliseisPolicyPreviewApprovalService');

const records = [];
function query(result) {
    return { session() { return this; }, select() { return this; }, sort() { return this; },
        lean: async () => result };
}
const model = {
    findOne(filter) {
        const found = records.find((record) => record.active_policy_key === filter.active_policy_key &&
            record.policy_code === filter.policy_code) || null;
        return query(found);
    },
    async create(documents, options) {
        assert.strictEqual(options.session.id, 'transaction');
        records.push(documents[0]);
        return documents;
    }
};
const session = { userTeam: 'THA', companyInUse: 'company', yearInUse: '2026',
    periodInUse: '06', userId: new mongoose.Types.ObjectId().toString(),
    userName: 'HR Test', userRole: 'HR', userStatus: 'A' };
const row = { _id: new mongoose.Types.ObjectId(), ypokatasthma: '0000', kodikos: '0014',
    hmeromhnia: new Date('2026-06-14T00:00:00.000Z'), kathgoria_ergasias: 'ΕΡΓ',
    ores_ergasias: 8 };
const rule = { policy_version: 'orphan-card-continuous:v1', orphan_type: 'START_ONLY',
    schedule_kind: 'CONTINUOUS', rule: 'ACTUAL_START_PLUS_DECLARED_DURATION' };

(async () => {
    const created = await createOrphanReusablePolicyDecisionRecord({ session, row, rule,
        dbSession: { id: 'transaction' }, approvalModel: model });
    assert.strictEqual(created.policy_code, 'ORPHAN_CARD_CONTINUOUS');
    assert.strictEqual(created.reuse_match_criteria.criteria.orphan_type, 'START_ONLY');
    assert.strictEqual(records.length, 1);
    await createOrphanReusablePolicyDecisionRecord({ session, row, rule,
        dbSession: { id: 'transaction' }, approvalModel: model });
    assert.strictEqual(records.length, 1);
    const matched = await findMatchingOrphanReusablePolicyDecision({ session,
        ypokatasthma: '0000', rule, approvalModel: model,
        asOfDate: new Date('2026-06-15T00:00:00.000Z') });
    assert.strictEqual(matched.active_policy_key, created.active_policy_key);
    console.log('orphan reusable policy persistence/retrieval contract passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
