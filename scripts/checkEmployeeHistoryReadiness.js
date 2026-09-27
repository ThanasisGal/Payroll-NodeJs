'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
// Use the exact MongoDB driver bundled with Mongoose. Mixing a separately
// hoisted driver with mongoose.Types.ObjectId can otherwise cross BSON majors.
const { MongoClient } = mongoose.mongo;
const { mongoTarget, readKnownProductionUri } = require('./setupEmployeeHistoryRepairAudit');
const { scanEmployeeHistoryPopulation } =
    require('../server/services/ergazomenoi/employeeHistoryPopulationReadinessService');

function argument(argv, name) {
    const exact = `--${name}`;
    const prefix = `${exact}=`;
    const index = argv.indexOf(exact);
    if (index >= 0) return argv[index + 1] || null;
    return argv.find(value => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function readConfiguredUri({ env, names, envPath, readFile = fs.readFileSync } = {}) {
    for (const name of names) {
        if (String(env?.[name] || '').trim()) return String(env[name]).trim();
    }
    try {
        const parsed = dotenv.parse(readFile(envPath));
        return String(parsed.MONGODB_URL || '').trim() || null;
    } catch {
        return null;
    }
}

function identifyReadOnlyTarget({ argv = [], env = {}, knownProductionUri = undefined,
    knownDevelopmentUri = undefined, developmentEnvPath = path.resolve('.env'),
    productionEnvPath = path.resolve('.env.production'), readFile = fs.readFileSync } = {}) {
    const uri = String(env.MONGODB_URL || '').trim();
    const effective = mongoTarget(uri);
    const expectedDatabase = argument(argv, 'expected-database') ||
        String(env.EMPLOYEE_HISTORY_EXPECTED_DATABASE || '').trim();
    if (!expectedDatabase || expectedDatabase !== effective.database) {
        throw new Error('EMPLOYEE_HISTORY_EXPECTED_DATABASE_MISMATCH');
    }
    const productionUri = knownProductionUri === undefined
        ? readKnownProductionUri({ env, productionEnvPath, readFile }) : knownProductionUri;
    const nodeEnvironment = String(env.NODE_ENV || '').trim().toLowerCase();
    const developmentUri = knownDevelopmentUri === undefined
        ? readConfiguredUri({ env, names: ['DEVELOPMENT_MONGODB_URL', 'MONGODB_DEVELOPMENT_URL'],
            envPath: nodeEnvironment === 'production' ? null : developmentEnvPath,
            readFile }) : knownDevelopmentUri;
    if (!productionUri) {
        throw new Error('EMPLOYEE_HISTORY_ENVIRONMENT_NOT_SAFELY_IDENTIFIED');
    }
    const production = mongoTarget(productionUri).identity === effective.identity;
    const development = developmentUri
        ? mongoTarget(developmentUri).identity === effective.identity : false;
    if ((!production && !development) || (production && development)) {
        throw new Error('EMPLOYEE_HISTORY_ENVIRONMENT_NOT_SAFELY_IDENTIFIED');
    }
    if ((nodeEnvironment === 'production' && !production) ||
        (nodeEnvironment === 'development' && !development)) {
        throw new Error('EMPLOYEE_HISTORY_ENVIRONMENT_CONFIGURATION_CONFLICT');
    }
    const acknowledged = argv.includes('--acknowledge-production-read-only') ||
        env.EMPLOYEE_HISTORY_READINESS_PRODUCTION_ACK === 'READ_ONLY';
    if (production && !acknowledged) {
        throw new Error('EMPLOYEE_HISTORY_PRODUCTION_READ_ONLY_ACKNOWLEDGEMENT_REQUIRED');
    }
    return { uri, database: effective.database,
        environment: production ? 'PRODUCTION' : 'DEVELOPMENT' };
}

async function runReadiness({ argv = process.argv.slice(2), env = process.env,
    knownProductionUri = undefined, knownDevelopmentUri = undefined,
    developmentEnvPath = argument(argv, 'development-config') || path.resolve('.env'),
    productionEnvPath = argument(argv, 'production-config') || path.resolve('.env.production'),
    readFile = fs.readFileSync,
    clientFactory = uri => new MongoClient(uri, { appName: 'employee-history-readiness',
        retryWrites: false }), output = value => console.log(value),
    humanOutput = value => console.error(value) } = {}) {
    const target = identifyReadOnlyTarget({ argv, env, knownProductionUri,
        knownDevelopmentUri, developmentEnvPath, productionEnvPath, readFile });
    const client = clientFactory(target.uri);
    try {
        await client.connect();
        const summary = await scanEmployeeHistoryPopulation({ db: client.db(),
            batchSize: Number(argument(argv, 'batch-size') || 100) });
        const machine = { environment: target.environment, database: target.database, ...summary };
        humanOutput(`Έλεγχος ιστορικού: ${summary.totalEmployees} εργαζόμενοι, ` +
            `${summary.totalHistoryRows} εγγραφές, ` +
            `${summary.WOULD_ORDINARY_MAINTENANCE_BLOCK_COUNT} αναστολές συντήρησης.`);
        output(JSON.stringify(machine, null, 2));
        if (summary.WOULD_ORDINARY_MAINTENANCE_BLOCK_COUNT > 0) {
            const error = new Error('EMPLOYEE_HISTORY_POPULATION_NOT_READY');
            error.summary = machine;
            throw error;
        }
        return machine;
    } finally {
        await client.close();
    }
}

async function main() {
    dotenv.config();
    return runReadiness();
}

if (require.main === module) main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});

module.exports = { argument, readConfiguredUri, identifyReadOnlyTarget, runReadiness, main };
