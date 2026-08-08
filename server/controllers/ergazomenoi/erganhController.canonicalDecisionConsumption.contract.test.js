'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const start = source.indexOf('async function runWeeklyRepoPostCheck({');
const end = source.indexOf('function getDailyDeclaredMinutes', start);
const postCheck = source.slice(start, end);

assert.ok(start >= 0 && end > start);
assert.equal((postCheck.match(/ApasxoliseisWeeklyCanonicalDecisionModel\.find\(/g) || []).length, 1);
for (const field of ['team: sessionTeam', 'company_kod: companyId',
    "decision_status: 'RECORDED'", 'employee_kodikos:', 'week_start:', 'week_end:']) {
    assert.ok(postCheck.includes(field), `missing batched decision scope: ${field}`);
}
assert.ok(postCheck.includes('.sort({ created_at: -1 }).lean()'));
assert.ok(postCheck.includes('canonicalDecisionsByWeek'));
assert.ok(postCheck.includes('buildWeeklyRepoPostCheckWritePlan({'));
assert.ok(!/for[\s\S]{0,300}ApasxoliseisWeeklyCanonicalDecisionModel\.find\(/.test(postCheck));

console.log('canonical decision consumption controller contract passed (10 contracts)');
