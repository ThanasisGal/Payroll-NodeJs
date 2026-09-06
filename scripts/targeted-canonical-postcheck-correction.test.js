'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('../server/services/ergazomenoi/fixtures/targetedCanonicalIntegrationFixture');
const realIntegration = require('../server/services/ergazomenoi/apasxoliseisTargetedCanonicalPostCheckIntegrationService');
const cli = require('./targeted-canonical-postcheck-correction');
const base = ['--target-id', '6a92b46e5de956f225bd3a4f', '--team', 'THA', '--company-id',
    '69e8e92fb198b803164b824a', '--branch', '0000', '--employee', '0031', '--date', '2026-04-05'];
function guards(summary) {
    return [...base, '--apply', '--expected-context-fingerprint', summary.contextFingerprint,
        '--expected-period-version', String(summary.periodToken.version),
        '--expected-write-fence-version', String(summary.writeFenceVersion),
        '--expected-diff-digest', summary.diffDigest, '--reason', 'Canonical correction', '--actor', 'operator',
        '--exclusive-window-confirmed', '--confirm', cli.CONFIRMATION];
}
async function setup() {
    const h = harness(); await h.makeHistoricalCurrent();
    const calls = { builds: 0, persists: 0, warnings: [] };
    let issuedPlan;
    const integration = { ...realIntegration,
        async loadAndBuildTargetedCanonicalPostCheckDryRun(args) {
            calls.builds++;
            const out = await realIntegration.loadAndBuildTargetedCanonicalPostCheckDryRun({ ...args, models: h.models });
            issuedPlan = out.plan;
            return out;
        },
        createCurrentContextFingerprintResolver() {
            return realIntegration.createCurrentContextFingerprintResolver({ models: h.models });
        } };
    const dependencies = { integration, warn: (text) => calls.warnings.push(text),
        async persist(args) {
            calls.persists++;
            assert.equal(args.plan, issuedPlan, 'only newly issued plan in this process');
            const hash = await args.resolveCurrentContextFingerprint({ target: h.target, periodScope: h.scope, session: {} });
            assert.equal(hash, args.plan.expectedContextFingerprint);
            return { updated: true };
        } };
    const summary = await cli.run(base, dependencies);
    return { h, summary, calls, dependencies };
}
test('default dry-run uses production integration with no persist', async () => {
    const { calls, summary } = await setup();
    assert.equal(calls.builds, 1); assert.equal(calls.persists, 0); assert.equal(summary.changedFieldCount, 2);
});
test('valid fake apply rebuilds issued plan and invokes persist once with real resolver', async () => {
    const s = await setup();
    assert.deepEqual(await cli.run(guards(s.summary), s.dependencies), { updated: true });
    assert.equal(s.calls.builds, 2); assert.equal(s.calls.persists, 1);
    assert.match(s.calls.warnings[0], /EXCLUSIVE OPERATOR WINDOW IS A REQUIRED EXTERNAL PRECONDITION/);
    assert.match(s.calls.warnings[0], /cannot verify arbitrary external\/manual/);
});
for (const flag of [...base.filter((v) => v.startsWith('--')), '--expected-context-fingerprint',
    '--expected-period-version', '--expected-write-fence-version', '--expected-diff-digest', '--reason', '--actor',
    '--exclusive-window-confirmed', '--confirm']) test(`apply missing ${flag} fails before loading`, async () => {
    const s = await setup(); const args = guards(s.summary);
    const index = args.indexOf(flag);
    args.splice(index, flag === '--exclusive-window-confirmed' ? 1 : 2);
    await assert.rejects(() => cli.run(args, s.dependencies));
    assert.equal(s.calls.builds, 1); assert.equal(s.calls.persists, 0);
});
for (const [flag, value] of [['--expected-context-fingerprint', 'f'.repeat(64)],
    ['--expected-period-version', '99'], ['--expected-write-fence-version', '99'],
    ['--expected-diff-digest', 'f'.repeat(64)], ['--confirm', 'YES']]) test(`reject wrong ${flag}`, async () => {
    const s = await setup(); const args = guards(s.summary); args[args.indexOf(flag) + 1] = value;
    await assert.rejects(() => cli.run(args, s.dependencies));
    assert.equal(s.calls.persists, 0);
});
for (const flag of ['--canonical-values', '--compensation-breakdown', '--update', '--fields', '--date=2026-04-05']) {
    test(`reject arbitrary input ${flag}`, () => assert.throws(() => cli.parseArgs([...base, flag, '{}'])));
}
test('zero diff apply returns idempotent without calling persist', async () => {
    const s = await setup(); Object.assign(s.h.storedRow, s.summary.minimalCanonicalDiff);
    const summary = await cli.run(base, s.dependencies);
    assert.equal(summary.changedFieldCount, 0);
    assert.deepEqual(await cli.run(guards(summary), s.dependencies), { updated: false, idempotent: true });
    assert.equal(s.calls.persists, 0);
});
test('changed source context after operator dry-run prevents persist', async () => {
    const s = await setup(); s.h.employee.pragmatikoOromisthio++;
    await assert.rejects(() => cli.run(guards(s.summary), s.dependencies), /fingerprint mismatch/);
    assert.equal(s.calls.persists, 0);
});
