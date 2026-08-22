'use strict';

const assert = require('assert/strict');
const mongoose = require('mongoose');
const Model = require('./apasxoliseisWeeklyHrWorkflowAudit');

const record = {
    team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: new mongoose.Types.ObjectId(), employee_kodikos: '0004',
    week_start: new Date('2026-06-01T00:00:00.000Z'),
    week_end: new Date('2026-06-07T00:00:00.000Z'),
    workflow_version: 'weekly-hr-workflow:v1', stage: 'STAGE1',
    action: 'STAGE1_COMPLETED', stage_version: 1,
    input_fingerprint: 'a'.repeat(64), previous_completion_fingerprint: '',
    new_completion_fingerprint: 'a'.repeat(64),
    before_stage: { status: 'OPEN', completion_fingerprint: '', version: 0 },
    after_stage: { status: 'COMPLETED', completion_fingerprint: 'a'.repeat(64), version: 1 },
    performed_at: new Date(), performed_by_user_id: new mongoose.Types.ObjectId(),
    performed_by_user_name: 'HR User', performed_by_user_role: 'HR',
    reason_or_notes: 'Stage 1 reviewed', request_id: 'stage1:req-0001',
    command_identity: 'b'.repeat(64)
};

assert.equal(new Model(record).validateSync(), undefined);
assert.ok(new Model({ ...record, action: 'STAGE2_COMPLETED' }).validateSync()?.errors?.action);
assert.ok(new Model({ ...record, input_fingerprint: 'invalid' })
    .validateSync()?.errors?.input_fingerprint);
assert.ok(new Model({ ...record, request_id: 'bad request' }).validateSync()?.errors?.request_id);
assert.equal(Model.schema.options.collection, 'Apasxoliseis_Weekly_Hr_Workflow_Audits');
assert.equal(Model.schema.options.autoIndex, false);
assert.equal(Model.schema.options.autoCreate, false);
for (const field of ['team', 'action', 'before_stage', 'performed_at', 'request_id']) {
    assert.equal(Model.schema.path(field).options.immutable, true);
}
const indexes = Model.schema.indexes();
assert.equal(indexes.length, 1);
assert.deepEqual(indexes[0][0], { team: 1, company_kod: 1, request_id: 1 });
assert.equal(indexes[0][1].unique, true);
assert.equal(indexes[0][1].name, 'unique_weekly_hr_workflow_audit_request');

console.log('weekly HR workflow audit model tests passed');
