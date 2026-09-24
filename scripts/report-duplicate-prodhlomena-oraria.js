#!/usr/bin/env node
'use strict';

// Αποκλειστικά αναγνωστική αναφορά: δεν περιέχει λειτουργία εγγραφής ή διαχείρισης ευρετηρίων.
function invalid(message) {
    throw Object.assign(new Error(message), { code: 'INVALID_DUPLICATE_REPORT_COMMAND' });
}

function parseArgs(argv = []) {
    const args = {};
    const valueFlags = new Set(['team', 'company-kod']);
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (!token.startsWith('--') || !valueFlags.has(token.slice(2))) {
            invalid(`Unsupported option: ${token}`);
        }
        const key = token.slice(2);
        if (Object.hasOwn(args, key)) invalid(`Duplicate option: ${token}`);
        const value = argv[++index];
        if (!value || value.startsWith('--') || value.trim() !== value) {
            invalid(`Missing or invalid value: ${token}`);
        }
        args[key] = value;
    }
    for (const key of ['team', 'company-kod']) {
        if (!args[key]) invalid(`Required: --${key}`);
    }
    return args;
}

function buildPipeline(args) {
    return [
        { $match: { team: args.team, company_kod: args['company-kod'] } },
        { $group: {
            _id: {
                team: '$team',
                company_kod: '$company_kod',
                ypokatasthma: '$ypokatasthma',
                kodikos: '$kodikos',
                hmeromhnia: '$hmeromhnia'
            },
            count: { $sum: 1 },
            members: { $push: { _id: '$_id', is_locked: { $eq: ['$is_locked', true] } } }
        } },
        { $match: { count: { $gt: 1 } } },
        { $sort: {
            '_id.ypokatasthma': 1,
            '_id.kodikos': 1,
            '_id.hmeromhnia': 1
        } }
    ];
}

async function run(argv, dependencies = {}) {
    const args = parseArgs(argv);
    if (!dependencies.rowModel) invalid('rowModel dependency is required');
    const groups = await dependencies.rowModel.aggregate(buildPipeline(args));
    return {
        mode: 'READ_ONLY',
        duplicate_group_count: groups.length,
        duplicate_groups: groups.map((group) => ({
            identity: group._id,
            count: group.count,
            members: group.members.map((member) => ({
                _id: String(member._id),
                is_locked: member.is_locked === true
            }))
        }))
    };
}

async function main(argv) {
    const args = parseArgs(argv);
    if (!process.env.MONGODB_URL) invalid('MONGODB_URL must already be supplied in the operator environment');
    const mongoose = require('mongoose');
    mongoose.set('autoIndex', false);
    mongoose.set('autoCreate', false);
    mongoose.set('bufferCommands', false);
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        const { ProdhlomenaOrariaModel } = require('../server/models/ergazomenoi');
        const result = await run(argv, { rowModel: ProdhlomenaOrariaModel });
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
        await mongoose.disconnect();
    }
    return args;
}

module.exports = { parseArgs, buildPipeline, run };

if (require.main === module) {
    main(process.argv.slice(2)).catch((error) => {
        process.stderr.write(`${error.code || 'DUPLICATE_REPORT_FAILED'}: ${error.message}\n`);
        process.exitCode = 1;
    });
}
