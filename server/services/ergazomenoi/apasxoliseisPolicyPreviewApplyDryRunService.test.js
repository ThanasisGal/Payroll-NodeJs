const assert = require('assert');
const mongoose = require('mongoose');

const {
    buildApplyDryRunApprovalFilter,
    compareProposedValuesWithCurrentRecord,
    buildApplyDryRunReport,
    runPolicyPreviewApplyDryRun
} = require('./apasxoliseisPolicyPreviewApplyDryRunService');

const session = {
    userTeam: 'team-a',
    companyInUse: '507f1f77bcf86cd799439011',
    yearInUse: '2026',
    userId: '507f191e810c19729de860ea',
    userName: 'HR User',
    userRole: 'A',
    userStatus: 'A'
};
const recordId = '507f1f77bcf86cd799439012';

function makeApproval(overrides = {}) {
    return {
        _id: '507f1f77bcf86cd799439013',
        group_id: 'policy-preview-group-test',
        decision_type: 'APPROVE_PREFILL',
        decision_status: 'RECORDED',
        created_at: new Date('2026-06-20T10:00:00.000Z'),
        created_by_user_name: 'HR User',
        notes: 'Test',
        items: [
            {
                prodhlomena_oraria_id: recordId,
                employee_kodikos: '001',
                hmeromhnia: new Date('2026-06-15T00:00:00.000Z'),
                proposed_values: { ores_apoysias_apologistika: 8 }
            }
        ],
        ...overrides
    };
}

function testUnsupportedFieldSkipped() {
    const [diff] = compareProposedValuesWithCurrentRecord({
        proposedValues: { argia: true },
        currentRecord: { argia: false }
    });
    assert.strictEqual(diff.action, 'SKIPPED');
}

function testSameValueNoChange() {
    const report = buildApplyDryRunReport({
        approvals: [makeApproval()],
        currentRecordsById: new Map([[recordId, { _id: recordId, ores_apoysias_apologistika: 8 }]])
    });
    assert.strictEqual(report.approvals[0].items[0].status, 'NO_CHANGE');
    assert.strictEqual(report.approvals[0].items[0].field_diffs[0].action, 'ALREADY_SAME');
}

function testDifferentValueWouldChange() {
    const report = buildApplyDryRunReport({
        approvals: [makeApproval()],
        currentRecordsById: new Map([[recordId, { _id: recordId, ores_apoysias_apologistika: 0 }]])
    });
    assert.strictEqual(report.approvals[0].items[0].status, 'WOULD_CHANGE');
    assert.strictEqual(report.approvals[0].items[0].field_diffs[0].action, 'WOULD_SET');
}

function testWorkHoursSameAndDifferent() {
    const same = compareProposedValuesWithCurrentRecord({
        proposedValues: { ores_ergasias_apologistika: 8 },
        currentRecord: { ores_ergasias_apologistika: '8.00' }
    });
    const different = compareProposedValuesWithCurrentRecord({
        proposedValues: { ores_ergasias_apologistika: 8 },
        currentRecord: { ores_ergasias_apologistika: 7.5 }
    });

    assert.strictEqual(same[0].action, 'ALREADY_SAME');
    assert.strictEqual(different[0].action, 'WOULD_SET');
}

function testMissingRecordSkipped() {
    const report = buildApplyDryRunReport({ approvals: [makeApproval()] });
    assert.strictEqual(report.approvals[0].items[0].status, 'SKIPPED');
    assert.match(report.approvals[0].items[0].reason, /Δεν βρέθηκε/);
}

function testInvalidObjectIdSkipped() {
    const approval = makeApproval();
    approval.items[0].prodhlomena_oraria_id = 'invalid-id';
    const report = buildApplyDryRunReport({ approvals: [approval] });
    assert.strictEqual(report.approvals[0].items[0].status, 'SKIPPED');
    assert.match(report.approvals[0].items[0].reason, /Μη έγκυρο/);
}

function testOnlyApprovePrefillRecordedIncluded() {
    const report = buildApplyDryRunReport({
        approvals: [
            makeApproval(),
            makeApproval({ decision_type: 'MARK_REVIEWED' }),
            makeApproval({ decision_status: 'CANCELLED' })
        ]
    });
    assert.strictEqual(report.summary.approvals_found, 1);
    assert.strictEqual(report.summary.approvals_returned, 1);
    assert.strictEqual(report.approvals.length, 1);
}

function testSupportedSameWithUnsupportedFieldIsNoChange() {
    const approval = makeApproval();
    approval.items[0].proposed_values = {
        ores_apoysias_apologistika: 8,
        argia: true
    };
    const report = buildApplyDryRunReport({
        approvals: [approval],
        currentRecordsById: new Map([
            [recordId, { _id: recordId, ores_apoysias_apologistika: 8, argia: false }]
        ])
    });
    const item = report.approvals[0].items[0];
    assert.strictEqual(item.status, 'NO_CHANGE');
    assert.deepStrictEqual(
        item.field_diffs.map((diff) => diff.action),
        ['ALREADY_SAME', 'SKIPPED']
    );
    assert.strictEqual(report.summary.fields_already_same, 1);
    assert.strictEqual(report.summary.fields_skipped, 1);
}

function testSessionScopeOverridesQuery() {
    const built = buildApplyDryRunApprovalFilter({
        session,
        filters: {
            team: 'untrusted-team',
            company_kod: 'untrusted-company',
            apo_hmeromhnia: '2026-06-01',
            eos_hmeromhnia: '2026-06-30'
        }
    });
    assert.strictEqual(built.filter.team, session.userTeam);
    assert.strictEqual(built.filter.company_kod, session.companyInUse);
    assert.strictEqual(built.filter.decision_type, 'APPROVE_PREFILL');
    assert.strictEqual(built.filter.decision_status, 'RECORDED');
}

function makeFindChain(result, capture) {
    return {
        sort() {
            return this;
        },
        skip() {
            return this;
        },
        limit() {
            return this;
        },
        select() {
            return this;
        },
        async lean() {
            capture.leanCalls++;
            return result;
        }
    };
}

async function testDryRunUsesReadMethodsOnly() {
    const capture = { approvalFilter: null, prodhlomenaFilter: null, leanCalls: 0 };
    const forbidden = () => {
        throw new Error('Απαγορευμένη write μέθοδος κλήθηκε.');
    };
    const fakeApprovalModel = {
        find(filter) {
            capture.approvalFilter = filter;
            return makeFindChain([makeApproval()], capture);
        },
        async countDocuments() {
            return 2;
        },
        create: forbidden,
        updateOne: forbidden,
        updateMany: forbidden,
        findOneAndUpdate: forbidden,
        bulkWrite: forbidden
    };
    const fakeProdhlomenaModel = {
        find(filter) {
            capture.prodhlomenaFilter = filter;
            return makeFindChain(
                [{ _id: new mongoose.Types.ObjectId(recordId), ores_apoysias_apologistika: 0 }],
                capture
            );
        },
        create: forbidden,
        updateOne: forbidden,
        updateMany: forbidden,
        findOneAndUpdate: forbidden,
        bulkWrite: forbidden
    };

    const result = await runPolicyPreviewApplyDryRun({
        session,
        filters: { apo_hmeromhnia: '2026-06-01', eos_hmeromhnia: '2026-06-30' },
        approvalModel: fakeApprovalModel,
        prodhlomenaModel: fakeProdhlomenaModel
    });
    assert.strictEqual(result.summary.items_with_changes, 1);
    assert.strictEqual(result.summary.approvals_found, 2);
    assert.strictEqual(result.summary.approvals_returned, 1);
    assert.strictEqual(capture.approvalFilter.team, session.userTeam);
    assert.strictEqual(capture.prodhlomenaFilter.company_kod, session.companyInUse);
    assert.ok(Array.isArray(capture.prodhlomenaFilter._id.$in));
    assert.ok(capture.prodhlomenaFilter._id.$in[0] instanceof mongoose.Types.ObjectId);
    assert.strictEqual(capture.leanCalls, 2);
}

async function run() {
    testUnsupportedFieldSkipped();
    testSameValueNoChange();
    testDifferentValueWouldChange();
    testWorkHoursSameAndDifferent();
    testMissingRecordSkipped();
    testInvalidObjectIdSkipped();
    testOnlyApprovePrefillRecordedIncluded();
    testSupportedSameWithUnsupportedFieldIsNoChange();
    testSessionScopeOverridesQuery();
    await testDryRunUsesReadMethodsOnly();
    console.log('apasxoliseis policy preview apply dry-run service tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
