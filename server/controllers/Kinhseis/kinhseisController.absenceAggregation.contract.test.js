'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'kinhseisController.js'), 'utf8');

assert.match(source, /buildEffectiveAbsenceDaysAggregationExpression/);
assert.match(source, /total_hmeres_apoysias:\s*\{\s*\$sum:\s*buildEffectiveAbsenceDaysAggregationExpression\(\)/s);
assert.match(source, /total_ores_apoysias:\s*\{\s*\$sum:\s*buildEffectiveAbsenceHoursAggregationExpression\(\)/s);
assert.doesNotMatch(source, /total_hmeres_apoysias:\s*\{[\s\S]{0,300}\$gt:\s*\[[\s\S]{0,100}\$ores_apoysias_apologistika/);

console.log('kinhseis explicit absence aggregation contract tests passed');
