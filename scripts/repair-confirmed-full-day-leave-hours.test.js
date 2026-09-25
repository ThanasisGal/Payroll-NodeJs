'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { CONFIRMATION, parseArgs, run } = require('./repair-confirmed-full-day-leave-hours');

const required = ['--team', 'THA', '--company', 'C1', '--branch', '0001',
    '--period-start', '2026-08-01', '--period-end', '2026-08-31'];

test('preview is default and apply-only options are rejected', async () => {
    let previews = 0; let applies = 0;
    const service = { async buildRepairPreview({ scope }) { previews++; assert.equal(scope.team, 'THA');
        return { repairable_count: 1, _repairable: [{}] }; }, publicPreview(value) {
        const { _repairable, ...safe } = value; return safe; }, async applyRepairBatch() { applies++; } };
    assert.deepEqual(await run(required, { service }), { repairable_count: 1 });
    assert.deepEqual(await run([...required, '--dry-run'], { service }), { repairable_count: 1 });
    assert.equal(previews, 2); assert.equal(applies, 0);
    assert.throws(() => parseArgs([...required, '--reason', 'x']), /Apply-only/);
});

test('apply requires fingerprint, reason, actor and exact confirmation', async () => {
    assert.throws(() => parseArgs([...required, '--apply']), /Required with --apply/);
    const args = [...required, '--apply', '--preview-fingerprint', 'a'.repeat(64),
        '--reason', 'repair approved', '--actor', 'operator', '--confirm', CONFIRMATION];
    let received;
    await run(args, { service: { async applyRepairBatch(value) { received = value; return { repaired_count: 0 }; } } });
    assert.equal(received.confirmed, true); assert.equal(received.scope.company_kod, 'C1');
    assert.equal(received.previewFingerprint, 'a'.repeat(64));
});
