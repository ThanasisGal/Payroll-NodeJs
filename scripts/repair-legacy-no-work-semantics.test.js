'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { CONFIRMATION, parseArgs, run } = require('./repair-legacy-no-work-semantics');

const required = ['--team', 'THA', '--company', 'C1', '--branch', '0000',
    '--period-start', '2026-08-01', '--period-end', '2026-08-31'];

test('preview is the default and never calls apply', async () => {
    let previews = 0; let applies = 0;
    const service = { async buildRepairPreview({ scope }) {
        previews++; assert.equal(scope.team, 'THA');
        return { repairable_count: 2, _repairable: [{}, {}] };
    }, publicPreview(value) { const { _repairable, ...safe } = value; return safe; },
    async applyRepairBatch() { applies++; } };
    assert.deepEqual(await run(required, { service }), { repairable_count: 2 });
    assert.deepEqual(await run([...required, '--dry-run'], { service }),
        { repairable_count: 2 });
    assert.equal(previews, 2); assert.equal(applies, 0);
    assert.throws(() => parseArgs([...required, '--actor', 'operator']), /Apply-only/);
});

test('apply requires every safeguard and exact confirmation', async () => {
    assert.throws(() => parseArgs([...required, '--apply']), /Required with --apply/);
    const argumentsList = [...required, '--apply', '--preview-fingerprint', 'a'.repeat(64),
        '--reason', 'normalize legacy rows', '--actor', 'operator',
        '--confirm', CONFIRMATION];
    let received;
    await run(argumentsList, { service: { async applyRepairBatch(value) {
        received = value; return { repaired_count: 0 };
    } } });
    assert.equal(received.confirmed, true);
    assert.equal(received.previewFingerprint, 'a'.repeat(64));
    assert.equal(received.changedBy, 'operator');
    assert.equal(received.scope.company_kod, 'C1');
    assert.throws(() => parseArgs([...required, '--apply', '--preview-fingerprint',
        'a'.repeat(64), '--reason', 'x', '--actor', 'operator', '--confirm', 'WRONG']),
    /Invalid explicit confirmation/);
});
