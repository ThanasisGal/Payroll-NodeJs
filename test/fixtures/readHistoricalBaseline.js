'use strict';
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

// Source ZIPs have no Git object database. An explicitly supplied archive may
// provide only these pinned upstream blobs; current worktree files never qualify.
const blobs = Object.freeze({
    'da765ee8050c91419b7707839b55e4ead0412ef3:server/controllers/ergazomenoi/ergazomenoiController.js': '1f4a0d82c1bf8a3d5908c944c179acae30e8cc7e',
    'bba736417cf30ff9d2de6e460496b96b552b21ba:server/utils/ergazomenoi/getOrarioTermsForDate.js': 'e98b0ab6d872751fb619648ed0dc9bca8a853d55',
    'bba736417cf30ff9d2de6e460496b96b552b21ba:server/utils/ergazomenoi/resolveBreakConfigurationForDate.js': '53e8e6fa6a7d17df7331f26298d9661a0d0b8a28'
});
function readHistoricalBaseline(ref) {
    const root = process.env.PAYROLL_TEST_BASELINE_DIRECTORY;
    if (!root) return execFileSync('git', ['show', ref], { encoding: 'utf8' });
    if (!Object.hasOwn(blobs, ref)) throw new Error('Unrecognized historical baseline');
    const bytes = readFileSync(path.join(root, ...ref.split(':')));
    const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (sha !== blobs[ref]) throw new Error(`Historical baseline blob mismatch: ${ref}`);
    return bytes.toString('utf8');
}
module.exports = { readHistoricalBaseline };
