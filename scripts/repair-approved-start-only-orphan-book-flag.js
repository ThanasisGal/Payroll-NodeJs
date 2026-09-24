#!/usr/bin/env node
'use strict';

// Η εισαγωγή του αρχείου δεν συνδέεται ποτέ στη βάση και δεν εκτελεί ενημερώσεις.
const CONFIRMATION = 'APPLY_APPROVED_START_ONLY_ORPHAN_BOOK_REPAIR';

function invalid(message) {
    throw Object.assign(new Error(message), { code: 'INVALID_REPAIR_COMMAND' });
}

function parseArgs(argv = []) {
    const args = {};
    const valueFlags = new Set([
        'team', 'company-kod', 'record-id', 'actor', 'reason', 'confirm'
    ]);
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (token === '--apply') {
            if (args.apply) invalid('Duplicate option: --apply');
            args.apply = true;
            continue;
        }
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
    if (args['record-id'] && !/^[a-f\d]{24}$/i.test(args['record-id'])) {
        invalid('Invalid value: --record-id must be a 24-character hexadecimal ObjectId');
    }
    if (args.apply) {
        for (const key of ['actor', 'reason', 'confirm']) {
            if (!args[key]) invalid(`Required with --apply: --${key}`);
        }
        if (args.confirm !== CONFIRMATION) invalid('Invalid explicit confirmation');
    } else if (['actor', 'reason', 'confirm'].some((key) => args[key])) {
        invalid('Apply-only options require --apply');
    }
    return args;
}

function candidateFilter(args) {
    return {
        ...(args['record-id'] ? { _id: args['record-id'] } : {}),
        team: args.team,
        company_kod: args['company-kod'],
        'orphan_card_resolution.status': 'HR_APPROVED',
        'orphan_card_resolution.orphan_type': 'START_ONLY',
        apologistiko_biblio: false
    };
}

function reportRow(row) {
    return {
        _id: String(row._id),
        kodikos: row.kodikos || '',
        hmeromhnia: row.hmeromhnia || null,
        approved_at: row.orphan_card_resolution?.approved_at || null,
        approved_by: row.orphan_card_resolution?.approved_by || '',
        is_locked: row.is_locked === true,
        apologistiko_biblio: row.apologistiko_biblio === true,
        approved_interval: row.orphan_card_resolution?.approved_interval || null
    };
}

async function run(argv, dependencies = {}) {
    const args = parseArgs(argv);
    const rowModel = dependencies.rowModel;
    const auditModel = dependencies.auditModel;
    const connection = dependencies.connection;
    if (!rowModel) invalid('rowModel dependency is required');
    const rows = await rowModel.find(candidateFilter(args))
        .select('_id team company_kod kodikos ypokatasthma hmeromhnia is_locked ' +
            'apologistiko_biblio orphan_card_resolution')
        .sort({ hmeromhnia: 1, _id: 1 })
        .lean();
    const candidates = rows.map(reportRow);
    if (!args.apply) return { mode: 'DRY_RUN', candidate_count: candidates.length, candidates };
    if (!auditModel || !connection) invalid('auditModel and connection dependencies are required');

    let repaired = 0;
    let skipped = 0;
    for (const row of rows) {
        const session = await connection.startSession();
        try {
            await session.withTransaction(async () => {
                const result = await rowModel.updateOne({
                    _id: args['record-id'] || row._id,
                    team: args.team,
                    company_kod: args['company-kod'],
                    'orphan_card_resolution.status': 'HR_APPROVED',
                    'orphan_card_resolution.orphan_type': 'START_ONLY',
                    apologistiko_biblio: false
                }, { $set: { apologistiko_biblio: true } }, { session });
                if (Number(result?.matchedCount ?? result?.n ?? 0) !== 1) {
                    skipped++;
                    return;
                }
                await auditModel.create([{
                    team: row.team,
                    company_kod: row.company_kod,
                    prodhlomena_oraria_id: row._id,
                    kodikos: row.kodikos,
                    ypokatasthma: row.ypokatasthma,
                    hmeromhnia: row.hmeromhnia,
                    changedBy: args.actor,
                    reason: args.reason,
                    oldValues: { apologistiko_biblio: false },
                    newValues: { apologistiko_biblio: true }
                }], { session });
                repaired++;
            });
        } finally {
            await session.endSession();
        }
    }
    return { mode: 'APPLY', candidate_count: candidates.length, repaired, skipped };
}

async function main(argv) {
    const args = parseArgs(argv);
    if (!process.env.MONGODB_URL) invalid('MONGODB_URL must already be supplied in the operator environment');
    const mongoose = require('mongoose');
    mongoose.set('autoIndex', false);
    mongoose.set('autoCreate', false);
    mongoose.set('bufferCommands', false);
    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000
        });
        const {
            ProdhlomenaOrariaModel,
            ProdhlomenaOrariaAuditModel
        } = require('../server/models/ergazomenoi');
        const result = await run(argv, { rowModel: ProdhlomenaOrariaModel,
            auditModel: ProdhlomenaOrariaAuditModel, connection: mongoose.connection });
        console.log(JSON.stringify(result, null, 2));
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) main(process.argv.slice(2)).catch((error) => {
    console.error(error.code || 'APPROVED_ORPHAN_BOOK_REPAIR_FAILED');
    process.exitCode = 1;
});

module.exports = { CONFIRMATION, parseArgs, candidateFilter, reportRow, run };
