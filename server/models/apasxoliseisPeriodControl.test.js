'use strict';

const assert = require('assert');
const Control = require('./apasxoliseisPeriodControl');
const Audit = require('./apasxoliseisPeriodControlAudit');

const options = Control.schema.options;
assert.strictEqual(options.autoIndex, false);
assert.strictEqual(options.autoCreate, false);
assert.deepStrictEqual(Control.schema.path('status').enumValues, ['OPEN', 'LOCKED']);
assert.strictEqual(Control.schema.path('team').options.immutable, true);
assert.strictEqual(Control.schema.path('period_start').options.immutable, true);
const unique = Control.schema.indexes().find(([, config]) => config.name === 'unique_apasxoliseis_period_control_scope');
assert.ok(unique);
assert.deepStrictEqual(unique[0], { team: 1, company_kod: 1, ypokatasthma: 1, period_start: 1, period_end: 1 });
assert.strictEqual(unique[1].unique, true);
assert.strictEqual(Control.schema.path('write_fence_version').options.default, 0);
assert.strictEqual(Control.schema.path('active_calculation_id').options.default, '');
assert.strictEqual(Control.schema.path('active_calculation_started_at').options.default, null);
assert.strictEqual(Audit.schema.options.autoIndex, false);
assert.strictEqual(Audit.schema.options.autoCreate, false);
assert.strictEqual(Audit.schema.path('reason').options.immutable, true);
console.log('apasxoliseisPeriodControl model tests: 13/13 PASS');
