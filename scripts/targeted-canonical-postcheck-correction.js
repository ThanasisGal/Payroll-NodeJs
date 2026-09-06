#!/usr/bin/env node
'use strict';

// Operator-only entry point. Importing this module never connects or executes.
const TARGET_FLAGS = ['target-id', 'team', 'company-id', 'branch', 'employee', 'date'];
const APPLY_VALUES = ['expected-context-fingerprint', 'expected-period-version',
    'expected-write-fence-version', 'expected-diff-digest', 'reason', 'actor', 'confirm'];
const BOOLEAN_FLAGS = ['apply', 'exclusive-window-confirmed'];
const CONFIRMATION = 'APPLY_TARGETED_CANONICAL_CORRECTION';
const WINDOW_WARNING = 'EXCLUSIVE OPERATOR WINDOW IS A REQUIRED EXTERNAL PRECONDITION. ' +
    'Stop/quiesce production, dev/nodemon, scheduled/background writers, repo-transfer apply, ' +
    'manual DB modifications and every other instance sharing this MongoDB. ' +
    'This CLI cannot verify arbitrary external/manual database writers. ' +
    '--exclusive-window-confirmed is an operator acknowledgement; it does not lock external writers.';
const invalid = (message) => { throw new Error(message); };
function parseArgs(argv) {
    const args = {};
    for (let index = 0; index < argv.length; index++) {
        const flag = argv[index];
        if (!flag.startsWith('--')) invalid('Unexpected positional argument');
        const key = flag.slice(2);
        if (![...TARGET_FLAGS, ...APPLY_VALUES, ...BOOLEAN_FLAGS].includes(key) || Object.hasOwn(args, key)) invalid(`Unsupported or duplicate option: ${flag}`);
        if (BOOLEAN_FLAGS.includes(key)) args[key] = true;
        else {
            const value = argv[++index];
            if (!value || value.startsWith('--') || !value.trim() || value !== value.trim()) invalid(`Missing/invalid value: ${flag}`);
            args[key] = value;
        }
    }
    for (const key of TARGET_FLAGS) if (!args[key]) invalid(`Required: --${key}`);
    if (args.apply) {
        for (const key of APPLY_VALUES) if (!args[key]) invalid(`Required: --${key}`);
        if (args['exclusive-window-confirmed'] !== true) invalid('Required: --exclusive-window-confirmed');
        if (args.confirm !== CONFIRMATION) invalid('Invalid explicit confirmation');
        for (const key of ['expected-context-fingerprint', 'expected-diff-digest']) {
            if (!/^[a-f\d]{64}$/.test(args[key])) invalid(`Invalid: --${key}`);
        }
        for (const key of ['expected-period-version', 'expected-write-fence-version']) {
            if (!/^(0|[1-9]\d*)$/.test(args[key]) || !Number.isSafeInteger(Number(args[key])) ||
                (key === 'expected-period-version' && Number(args[key]) < 1)) invalid(`Invalid: --${key}`);
        }
    } else if ([...APPLY_VALUES, 'exclusive-window-confirmed'].some((key) => Object.hasOwn(args, key))) {
        invalid('Apply-only options require --apply');
    }
    return args;
}
function targetFromArgs(args) {
    return { _id: args['target-id'], team: args.team, company_kod: args['company-id'],
        ypokatasthma: args.branch, kodikos: args.employee, hmeromhnia: args.date };
}
async function run(argv, dependencies = {}) {
    const args = parseArgs(argv);
    const integration = dependencies.integration || require('../server/services/ergazomenoi/apasxoliseisTargetedCanonicalPostCheckIntegrationService');
    const target = integration.validateTarget(targetFromArgs(args));
    if (args.apply) (dependencies.warn || console.error)(WINDOW_WARNING);
    const { summary, plan } = await integration.loadAndBuildTargetedCanonicalPostCheckDryRun({ target });
    if (!args.apply) return summary;
    const freshTarget = integration.validateTarget(summary.target);
    if (Object.keys(target).some((key) => target[key] !== freshTarget[key])) invalid('Fresh target mismatch');
    for (const [actual, expected, name] of [
        [summary.contextFingerprint, args['expected-context-fingerprint'], 'context fingerprint'],
        [String(summary.periodToken.version), args['expected-period-version'], 'period version'],
        [String(summary.writeFenceVersion), args['expected-write-fence-version'], 'write fence'],
        [summary.diffDigest, args['expected-diff-digest'], 'diff digest']
    ]) if (actual !== expected) invalid(`Fresh ${name} mismatch; obtain a new dry-run inside the exclusive window`);
    if (summary.changedFieldCount === 0) return { updated: false, idempotent: true };
    const persist = dependencies.persist || require('../server/services/ergazomenoi/apasxoliseisTargetedCanonicalPostCheckCorrectionService')
        .persistTargetedCanonicalPostCheckCorrection;
    return persist({ plan, changedBy: args.actor, reason: args.reason,
        resolveCurrentContextFingerprint: integration.createCurrentContextFingerprintResolver() });
}
async function main(argv) {
    // Validate every operator guard before even attempting a connection.
    const args = parseArgs(argv);
    const mongoose = require('mongoose');
    mongoose.set('autoIndex', false);
    mongoose.set('autoCreate', false);
    mongoose.set('bufferCommands', false);
    const integration = require('../server/services/ergazomenoi/apasxoliseisTargetedCanonicalPostCheckIntegrationService');
    integration.validateTarget(targetFromArgs(args));
    if (!process.env.MONGODB_URL) invalid('MONGODB_URL must already be supplied in the operator environment');
    try {
        await mongoose.connect(process.env.MONGODB_URL, { autoIndex: false, autoCreate: false,
            serverSelectionTimeoutMS: 10000 });
        console.log(JSON.stringify(await run(argv, { integration }), null, 2));
    } finally { await mongoose.disconnect(); }
}
if (require.main === module) main(process.argv.slice(2)).catch((error) => {
    // Avoid printing database URLs, driver metadata or credentials.
    console.error(error.code || 'TARGETED_CANONICAL_COMMAND_FAILED');
    process.exitCode = 1;
});
module.exports = { parseArgs, run, CONFIRMATION, WINDOW_WARNING };
