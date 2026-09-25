#!/usr/bin/env node
'use strict';

const CONFIRMATION = 'APPLY_CONFIRMED_FULL_DAY_LEAVE_HOURS_REPAIR';
const invalid = message => { throw Object.assign(new Error(message), { code: 'INVALID_REPAIR_COMMAND' }); };

function parseArgs(argv = []) {
    const args = {};
    const values = new Set(['team', 'company', 'branch', 'period-start', 'period-end',
        'preview-fingerprint', 'reason', 'actor', 'confirm']);
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (token === '--apply') { if (args.apply) invalid('Duplicate option: --apply'); args.apply = true; continue; }
        if (token === '--dry-run') { if (args.dryRun) invalid('Duplicate option: --dry-run'); args.dryRun = true; continue; }
        const key = token.startsWith('--') ? token.slice(2) : '';
        if (!values.has(key) || Object.hasOwn(args, key)) invalid(`Unsupported or duplicate option: ${token}`);
        const value = argv[++index];
        if (!value || value.startsWith('--') || value !== value.trim()) invalid(`Missing or invalid value: ${token}`);
        args[key] = value;
    }
    for (const key of ['team', 'company', 'branch', 'period-start', 'period-end']) {
        if (!args[key]) invalid(`Required: --${key}`);
    }
    if (args.apply && args.dryRun) invalid('--apply and --dry-run are mutually exclusive');
    if (args.apply) {
        for (const key of ['preview-fingerprint', 'reason', 'actor', 'confirm']) if (!args[key]) invalid(`Required with --apply: --${key}`);
        if (args.confirm !== CONFIRMATION) invalid('Invalid explicit confirmation');
    } else if (['preview-fingerprint', 'reason', 'actor', 'confirm'].some(key => args[key])) {
        invalid('Apply-only options require --apply');
    }
    return args;
}
const scopeFromArgs = args => ({ team: args.team, company_kod: args.company,
    ypokatasthma: args.branch, period_start: args['period-start'], period_end: args['period-end'] });

async function run(argv, dependencies = {}) {
    const args = parseArgs(argv);
    const service = dependencies.service || require('../server/services/ergazomenoi/apasxoliseisConfirmedFullDayLeaveHoursRepairService');
    const scope = scopeFromArgs(args);
    if (!args.apply) return service.publicPreview(await service.buildRepairPreview({ scope }));
    return service.applyRepairBatch({ scope, previewFingerprint: args['preview-fingerprint'],
        confirmed: true, reason: args.reason, changedBy: args.actor });
}

async function main(argv) {
    parseArgs(argv);
    if (!process.env.MONGODB_URL) invalid('MONGODB_URL must already be supplied in the operator environment');
    const mongoose = require('mongoose');
    mongoose.set('autoIndex', false); mongoose.set('autoCreate', false); mongoose.set('bufferCommands', false);
    try {
        await mongoose.connect(process.env.MONGODB_URL, { autoIndex: false, autoCreate: false,
            serverSelectionTimeoutMS: 10000 });
        console.log(JSON.stringify(await run(argv), null, 2));
    } finally { await mongoose.disconnect(); }
}
if (require.main === module) main(process.argv.slice(2)).catch(error => {
    console.error(error.code || 'CONFIRMED_FULL_DAY_LEAVE_HOURS_REPAIR_FAILED'); process.exitCode = 1;
});
module.exports = { CONFIRMATION, parseArgs, scopeFromArgs, run };
