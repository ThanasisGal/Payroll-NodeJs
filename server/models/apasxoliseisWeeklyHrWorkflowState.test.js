'use strict';

const assert = require('assert/strict');
const mongoose = require('mongoose');
const Model = require('./apasxoliseisWeeklyHrWorkflowState');

const base = {
    team: 'THA',
    company_kod: 'company',
    ypokatasthma: '0000',
    employee_id: new mongoose.Types.ObjectId(),
    employee_kodikos: '0004',
    week_start: new Date('2026-06-01T00:00:00.000Z'),
    week_end: new Date('2026-06-07T00:00:00.000Z')
};

assert.equal(new Model(base).validateSync(), undefined);
for (const field of ['team', 'company_kod', 'ypokatasthma', 'employee_id',
    'employee_kodikos', 'week_start', 'week_end']) {
    assert.ok(new Model({ ...base, [field]: undefined }).validateSync()?.errors?.[field]);
}
assert.deepEqual(Model.schema.path('stage1').schema.path('status').enumValues,
    ['OPEN', 'COMPLETED']);
assert.ok(new Model({ ...base, stage1: { status: 'STALE' } }).validateSync()?.errors?.['stage1.status']);
assert.ok(new Model({ ...base, stage1: { status: 'COMPLETED' } })
    .validateSync()?.errors?.['stage1.status']);
assert.ok(new Model({ ...base, stage1: {
    status: 'COMPLETED', completion_fingerprint: 'short', completed_at: new Date(),
    completed_by_user_id: new mongoose.Types.ObjectId(), completed_by_user_name: 'HR',
    completed_by_user_role: 'HR'
} }).validateSync());
assert.equal(new Model({ ...base, stage1: {
    status: 'COMPLETED', completion_fingerprint: 'a'.repeat(64), completed_at: new Date(),
    completed_by_user_id: new mongoose.Types.ObjectId(), completed_by_user_name: 'HR',
    completed_by_user_role: 'HR', reason_or_notes: 'Reviewed', version: 2
} }).validateSync(), undefined);
assert.equal(Model.schema.path('workflow_version').options.default, 'weekly-hr-workflow:v1');
assert.equal(Model.schema.path('stage2').schema.path(
    'depends_on_stage1_fingerprint').instance, 'String');
assert.equal(Model.schema.path('stage3').schema.path(
    'depends_on_stage2_fingerprint').instance, 'String');
assert.equal(Model.schema.path('final_stage').schema.path(
    'depends_on_stage3_fingerprint').instance, 'String');

assert.equal(new Model({ ...base, stage2: { status: 'OPEN' } }).validateSync(), undefined);
assert.ok(new Model({ ...base, stage2: { status: 'COMPLETED' } })
    .validateSync()?.errors?.['stage2.status']);
const completedStage = (dependencyField) => ({
    status: 'COMPLETED',
    completion_fingerprint: 'b'.repeat(64),
    completed_at: new Date('2026-08-14T10:00:00.000Z'),
    completed_by_user_id: new mongoose.Types.ObjectId(),
    completed_by_user_name: 'HR User',
    completed_by_user_role: 'HR',
    [dependencyField]: 'a'.repeat(64)
});
assert.equal(new Model({ ...base,
    stage2: completedStage('depends_on_stage1_fingerprint')
}).validateSync(), undefined);
for (const [stage, dependencyField] of [
    ['stage3', 'depends_on_stage2_fingerprint'],
    ['final_stage', 'depends_on_stage3_fingerprint']
]) {
    assert.ok(new Model({ ...base, [stage]: { status: 'COMPLETED' } })
        .validateSync()?.errors?.[`${stage}.status`]);
    assert.equal(new Model({ ...base,
        [stage]: completedStage(dependencyField)
    }).validateSync(), undefined);
}
assert.ok(new Model({ ...base, stage2: {
    ...completedStage('depends_on_stage1_fingerprint'),
    depends_on_stage1_fingerprint: 'invalid'
} }).validateSync()?.errors?.['stage2.depends_on_stage1_fingerprint']);
assert.equal(Model.schema.options.collection, 'Apasxoliseis_Weekly_Hr_Workflow_States');
assert.equal(Model.schema.options.autoIndex, false);
assert.equal(Model.schema.options.autoCreate, false);
const indexes = Model.schema.indexes();
assert.equal(indexes.length, 1);
assert.deepEqual(indexes[0][0], { team: 1, company_kod: 1, ypokatasthma: 1,
    employee_id: 1, week_start: 1, week_end: 1 });
assert.equal(Object.hasOwn(indexes[0][0], 'employee_kodikos'), false);
assert.equal(Model.schema.path('employee_kodikos').options.required, true);
assert.equal(indexes[0][1].unique, true);
assert.equal(indexes[0][1].name, 'unique_weekly_hr_workflow_employee_natural_week');
assert.ok(new Model({ ...base,
    week_start: new Date('2026-06-02T00:00:00.000Z'),
    week_end: new Date('2026-06-08T00:00:00.000Z')
}).validateSync()?.errors?.week_end);

console.log('weekly HR workflow state model tests passed');
