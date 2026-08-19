'use strict';

const assert = require('assert');
const Control = require('./apasxoliseisPeriodControl');
const Audit = require('./apasxoliseisPeriodControlAudit');

const options = Control.schema.options;
assert.strictEqual(options.autoIndex, false);
assert.strictEqual(options.autoCreate, false);
assert.deepStrictEqual(Control.schema.path('status').enumValues, ['OPEN', 'LOCKED', 'FINALIZED']);
assert.strictEqual(Control.schema.path('team').options.immutable, true);
assert.strictEqual(Control.schema.path('period_start').options.immutable, true);
const unique = Control.schema.indexes().find(([, config]) => config.name === 'unique_apasxoliseis_period_control_scope');
assert.ok(unique);
assert.deepStrictEqual(unique[0], { team: 1, company_kod: 1, ypokatasthma: 1, period_start: 1, period_end: 1 });
assert.strictEqual(unique[1].unique, true);
assert.strictEqual(Control.schema.path('write_fence_version').options.default, 0);
assert.strictEqual(Control.schema.path('active_calculation_id').options.default, '');
assert.strictEqual(Control.schema.path('active_calculation_started_at').options.default, null);
assert.strictEqual(Control.schema.path('successful_calculation_version').options.default, 0);
assert.strictEqual(Control.schema.path('last_successful_calculation_id').options.default, '');
assert.strictEqual(Control.schema.path('last_successful_calculation_at').options.default, null);
assert.strictEqual(Audit.schema.options.autoIndex, false);
assert.strictEqual(Audit.schema.options.autoCreate, false);
assert.strictEqual(Audit.schema.path('reason').options.immutable, true);
const reconstructedAudit = new Audit({
    team: 'THA',
    company_kod: 'company-id',
    ypokatasthma: '0000',
    period_start: new Date('2026-06-01T00:00:00.000Z'),
    period_end: new Date('2026-06-30T00:00:00.000Z'),
    previous_status: 'OPEN',
    new_status: 'LOCKED',
    effective_mode_before: 'HISTORICAL_RECONSTRUCTED',
    effective_mode_after: 'LOCKED',
    actor_user_id: '507f1f77bcf86cd799439011',
    actor_user_name: 'HR User',
    actor_user_role: 'HR',
    reason: 'Period lock',
    request_id: 'period-lock-request-001',
    command_identity: 'command-identity',
    transitioned_at: new Date('2026-08-19T19:22:00.000Z'),
    version_before: 6,
    version_after: 7
});
assert.strictEqual(reconstructedAudit.validateSync(), undefined);
console.log('apasxoliseisPeriodControl model tests: 17/17 PASS');
