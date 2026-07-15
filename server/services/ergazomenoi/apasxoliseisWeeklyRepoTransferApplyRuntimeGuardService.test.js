const assert = require('assert');
const { getWeeklyRepoTransferApplyRuntimeState } = require('./apasxoliseisWeeklyRepoTransferApplyRuntimeGuardService');

assert.deepStrictEqual(getWeeklyRepoTransferApplyRuntimeState({}), { enabled: false, code: 'APPLY_RUNTIME_DISABLED' });
assert.strictEqual(getWeeklyRepoTransferApplyRuntimeState({ ALLOW_REPO_TRANSFER_APPLY: 'false' }).enabled, false);
assert.strictEqual(getWeeklyRepoTransferApplyRuntimeState({ NODE_ENV: 'development', ALLOW_REPO_TRANSFER_APPLY: 'true' }).enabled, true);
assert.strictEqual(getWeeklyRepoTransferApplyRuntimeState({ NODE_ENV: 'production', ALLOW_REPO_TRANSFER_APPLY: 'true' }).enabled, false);
assert.strictEqual(getWeeklyRepoTransferApplyRuntimeState({ NODE_ENV: 'production', ALLOW_REPO_TRANSFER_APPLY: 'true', ALLOW_PRODUCTION_REPO_TRANSFER_APPLY: 'true' }).enabled, true);
assert.strictEqual(getWeeklyRepoTransferApplyRuntimeState({ ALLOW_REPO_TRANSFER_APPLY: 'TRUE' }).enabled, false);
console.log('PASS repo-transfer apply runtime guard (6 tests)');
