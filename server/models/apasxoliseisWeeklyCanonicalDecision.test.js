'use strict';

const assert = require('assert/strict');
const mongoose = require('mongoose');
const Model = require('./apasxoliseisWeeklyCanonicalDecision');

const record = {
    team: 'THA', company_kod: 'company', ypokatasthma: '0000', employee_kodikos: '001',
    week_start: new Date('2026-06-01T00:00:00Z'), week_end: new Date('2026-06-07T00:00:00Z'),
    scope_key: 'THA|company|0000|001|2026-06-01|2026-06-07',
    snapshot_version: 'weekly-canonical-human-decision-snapshot:v1', snapshot_fingerprint: 'a'.repeat(64),
    canonical_snapshot: { canonical_status: 'NEEDS_HR_DECISION' },
    canonical_status: 'NEEDS_HR_DECISION', canonical_reasons: ['CARD_VERIFICATION_PENDING'],
    decision_type: 'CARD_VERIFICATION_PENDING', decision_payload: { verified: true },
    decision_payload_fingerprint: 'b'.repeat(64), decision_status: 'RECORDED',
    request_id: 'request-0001', command_identity: 'c'.repeat(64),
    decision_schema_version: 'weekly-canonical-human-decision:v1', policy_version: 'policy:v1',
    source_version: 'source:v1', created_by_user_id: new mongoose.Types.ObjectId(),
    created_by_user_name: 'HR', created_by_user_role: 'HR', created_at: new Date()
};
assert.equal(new Model(record).validateSync(), undefined);
assert.ok(new Model({ ...record, decision_type: 'UNKNOWN' }).validateSync()?.errors?.decision_type);
assert.equal(Model.schema.options.collection, 'Apasxoliseis_Weekly_Canonical_Decisions');
assert.equal(Model.schema.options.autoIndex, false);
assert.equal(Model.schema.options.autoCreate, false);
assert.equal(Model.schema.indexes().length, 4);
const uniqueIndexes = Model.schema.indexes().filter(([, options]) => options.unique === true);
assert.deepEqual(uniqueIndexes.map(([, options]) => options.name), [
    'unique_weekly_canonical_decision_request',
    'unique_active_weekly_canonical_decision_snapshot_slot'
]);
assert.equal(uniqueIndexes[0][1].partialFilterExpression, undefined);
assert.deepEqual(uniqueIndexes[1][1].partialFilterExpression, {
    decision_status: 'RECORDED'
});
console.log('weekly canonical decision model tests passed (6 contracts)');
