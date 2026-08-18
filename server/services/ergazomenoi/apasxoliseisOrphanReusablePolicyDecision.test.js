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
        const found = records.find((record) =>
            record.team === filter.team &&
            record.company_kod === filter.company_kod &&
            record.ypokatasthma === filter.ypokatasthma &&
            record.active_policy_key === filter.active_policy_key &&
            record.policy_code === filter.policy_code &&
            record.reuse_scope === filter.reuse_scope &&
            record.reuse_status === filter.reuse_status &&
            record.decision_status === filter.decision_status) || null;
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
    assert.strictEqual(created.items[0].employee_kodikos, '0014');
    assert.strictEqual(JSON.stringify(created.reuse_match_criteria).includes('employee_kodikos'),
        false);
    assert.strictEqual(records.length, 1);
    await createOrphanReusablePolicyDecisionRecord({ session, row, rule,
        dbSession: { id: 'transaction' }, approvalModel: model });
    assert.strictEqual(records.length, 1);
    const matched = await findMatchingOrphanReusablePolicyDecision({ session,
        ypokatasthma: '0000', rule, approvalModel: model,
        asOfDate: new Date('2026-06-15T00:00:00.000Z') });
    assert.strictEqual(matched.active_policy_key, created.active_policy_key);
    const differentEmployeeSameBranch = { ...row, _id: new mongoose.Types.ObjectId(),
        kodikos: '0009' };
    assert.notStrictEqual(differentEmployeeSameBranch.kodikos,
        created.items[0].employee_kodikos);
    const crossEmployeeMatch = await findMatchingOrphanReusablePolicyDecision({ session,
        ypokatasthma: differentEmployeeSameBranch.ypokatasthma, rule, approvalModel: model,
        asOfDate: new Date('2026-06-15T00:00:00.000Z') });
    assert.strictEqual(crossEmployeeMatch.active_policy_key, created.active_policy_key);
    const otherBranchMatch = await findMatchingOrphanReusablePolicyDecision({ session,
        ypokatasthma: '0001', rule, approvalModel: model,
        asOfDate: new Date('2026-06-15T00:00:00.000Z') });
    assert.strictEqual(otherBranchMatch, null);
    const otherCompanyMatch = await findMatchingOrphanReusablePolicyDecision({
        session: { ...session, companyInUse: 'other-company' }, ypokatasthma: '0000', rule,
        approvalModel: model, asOfDate: new Date('2026-06-15T00:00:00.000Z') });
    assert.strictEqual(otherCompanyMatch, null);
    const otherTeamMatch = await findMatchingOrphanReusablePolicyDecision({
        session: { ...session, userTeam: 'OTHER' }, ypokatasthma: '0000', rule,
        approvalModel: model, asOfDate: new Date('2026-06-15T00:00:00.000Z') });
    assert.strictEqual(otherTeamMatch, null);
    const averageRule = { policy_version: 'orphan-card-continuous:v1',
        orphan_type: 'END_ONLY', schedule_kind: 'NON_DECLARED',
        rule: 'ACTUAL_END_MINUS_EFFECTIVE_DAILY_AVERAGE' };
    const averageCreated = await createOrphanReusablePolicyDecisionRecord({ session, row,
        rule: averageRule, dbSession: { id: 'transaction' }, approvalModel: model });
    assert.strictEqual(averageCreated.reuse_match_criteria.criteria.rule,
        'ACTUAL_END_MINUS_EFFECTIVE_DAILY_AVERAGE');
    assert.strictEqual(JSON.stringify(averageCreated.reuse_match_criteria).includes('23:47'), false);
    assert.strictEqual(JSON.stringify(averageCreated.reuse_match_criteria)
        .includes('mo_oron_hmerhsias_ergasias'), false);
    console.log('orphan reusable policy persistence/retrieval contract passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
