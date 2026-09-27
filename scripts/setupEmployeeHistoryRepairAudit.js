'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const {
    setupEmployeeHistoryRepairAuditStorage
} = require('../server/services/ergazomenoi/employeeHistoryRepairAuditSetupService');

function argument(argv, name) {
    const prefix = `--${name}=`;
    return argv.find(value => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function mongoTarget(uri) {
    if (!uri) throw new Error('Δεν έχει οριστεί MONGODB_URL.');
    let protocol;
    let host;
    let pathname;
    try {
        const parsed = new URL(uri);
        protocol = parsed.protocol;
        host = parsed.host;
        pathname = parsed.pathname;
    } catch {
        const match = String(uri).match(/^(mongodb(?:\+srv)?):\/\/([^/]+)\/([^?#]+)/i);
        if (!match) throw new Error('Ο στόχος MongoDB δεν αναγνωρίζεται με ασφάλεια.');
        protocol = `${match[1].toLowerCase()}:`;
        host = match[2].slice(match[2].lastIndexOf('@') + 1).split(',')
            .map(value => value.toLowerCase()).sort().join(',');
        pathname = `/${match[3]}`;
    }
    if (!['mongodb:', 'mongodb+srv:'].includes(protocol) || !host) {
        throw new Error('Ο στόχος MongoDB δεν αναγνωρίζεται με ασφάλεια.');
    }
    const database = decodeURIComponent(pathname.replace(/^\//, ''));
    if (!database || database.includes('/')) {
        throw new Error('Η βάση δεδομένων του στόχου δεν αναγνωρίζεται με ασφάλεια.');
    }
    return {
        database,
        identity: `${protocol}//${host.toLowerCase()}/${database}`
    };
}

function readKnownProductionUri({ env, productionEnvPath = path.resolve('.env.production'),
    readFile = fs.readFileSync } = {}) {
    for (const name of ['PRODUCTION_MONGODB_URL', 'MONGODB_PRODUCTION_URL']) {
        if (String(env?.[name] || '').trim()) return env[name];
    }
    try {
        const parsed = dotenv.parse(readFile(productionEnvPath));
        return String(parsed.MONGODB_URL || '').trim() || null;
    } catch {
        return null;
    }
}

function validateSetupRequest({ argv = [], env = {}, knownProductionUri = undefined,
    productionEnvPath, readFile } = {}) {
    if (!argv.includes('--apply')) {
        throw new Error('Απαιτείται ρητά η παράμετρος --apply. Δεν έγινε καμία αλλαγή.');
    }
    const uri = env.MONGODB_URL;
    const effectiveTarget = mongoTarget(uri);
    const expectedDatabase = argument(argv, 'expected-database');
    if (!expectedDatabase || expectedDatabase !== effectiveTarget.database) {
        throw new Error('Το --expected-database δεν συμφωνεί με τον επιλεγμένο στόχο.');
    }

    const configuredProductionUri = knownProductionUri === undefined
        ? readKnownProductionUri({ env, productionEnvPath, readFile })
        : knownProductionUri;
    let productionTarget = null;
    if (configuredProductionUri) productionTarget = mongoTarget(configuredProductionUri);
    const nodeEnvironment = String(env.NODE_ENV || '').trim().toLowerCase();
    const matchesProduction = productionTarget &&
        productionTarget.identity === effectiveTarget.identity;
    if (productionTarget && nodeEnvironment === 'production' && !matchesProduction) {
        throw new Error('Η ταυτότητα περιβάλλοντος και ο στόχος βάσης είναι ασύμβατα. Δεν έγινε καμία αλλαγή.');
    }
    if (!productionTarget) {
        throw new Error('Η ταυτότητα του στόχου βάσης είναι ασαφής. Δεν έγινε καμία αλλαγή.');
    }
    const production = Boolean(matchesProduction || nodeEnvironment === 'production');
    if (production && !argv.includes('--allow-production')) {
        throw new Error('Ο στόχος παραγωγής απαιτεί επιπλέον τη ρητή παράμετρο --allow-production.');
    }
    return { uri, database: effectiveTarget.database, production };
}

async function runSetup({ argv = process.argv.slice(2), env = process.env,
    knownProductionUri = undefined, productionEnvPath, readFile,
    clientFactory = uri => new MongoClient(uri, {
        appName: 'payroll-employee-history-repair-audit-setup', retryWrites: true
    }), output = value => console.log(value) } = {}) {
    const target = validateSetupRequest({ argv, env, knownProductionUri,
        productionEnvPath, readFile });
    const client = clientFactory(target.uri);
    try {
        await client.connect();
        const result = await setupEmployeeHistoryRepairAuditStorage({ db: client.db() });
        output(JSON.stringify({ database: target.database, ...result }, null, 2));
        return result;
    } finally {
        await client.close();
    }
}

async function main() {
    dotenv.config();
    return runSetup();
}

if (require.main === module) {
    main().catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = { argument, mongoTarget, readKnownProductionUri,
    validateSetupRequest, runSetup, main };
