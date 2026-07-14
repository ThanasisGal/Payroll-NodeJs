const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const decisionService = read('services/ergazomenoi/apasxoliseisWeeklyRepoTransferDecisionService.js');
const reconstructionService = read('services/ergazomenoi/apasxoliseisWeeklyRepoTransferDecisionReconstructionService.js');
const batchService = read('services/ergazomenoi/apasxoliseisWeeklyRepoTransferDecisionBatchService.js');
const routes = read('routes/usersRoute.js');
const frontend = fs.readFileSync(path.resolve(root, '../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');

[
    decisionService,
    reconstructionService,
    batchService
].forEach((source) => {
    assert.ok(!source.includes('apasxoliseisPolicyPreview' + 'Apply'));
    assert.ok(!/\.updateOne\s*\(|\.updateMany\s*\(|\.findOneAndUpdate\s*\(|\.bulkWrite\s*\(|\.save\s*\(/.test(source));
});
assert.ok(routes.includes("'/api/prodhlomena-oraria/review/repo-transfer-decisions'"));
assert.ok(routes.includes("'/api/prodhlomena-oraria/review/repo-transfer-decisions/current'"));
assert.ok(frontend.includes("fetch('/api/prodhlomena-oraria/review/repo-transfer-decisions'"));
assert.ok(frontend.includes('/api/prodhlomena-oraria/review/repo-transfer-decisions/current?'));
const refreshSource = frontend.slice(
    frontend.indexOf('async function refreshRepoTransferDecisions'),
    frontend.indexOf('async function submitRepoTransferDecision')
);
assert.strictEqual((refreshSource.match(/\bfetch\s*\(/g) || []).length, 1);
assert.ok(!refreshSource.includes('for (const group'));
assert.ok(frontend.includes('APPROVE_PROPOSAL'));
assert.ok(frontend.includes('REJECT_PROPOSAL'));
assert.ok(frontend.includes('NEEDS_MORE_REVIEW'));
assert.ok(!/atomic-repo-transfer-decision-btn[^>]+on(?:click|submit|change)=/i.test(frontend));
assert.ok(frontend.includes("addEventListener('click'"));
console.log('weekly repo transfer decision safety contract tests passed');
