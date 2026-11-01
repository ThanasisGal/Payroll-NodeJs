'use strict';

// Read-only preflight. This file never imports app.js, starts jobs, or writes to MongoDB.
const fs = require('node:fs');
const path = require('node:path');
const DATABASE = 'payroll_test_isolated';
const USER = 'payroll_dev_test';
const ROOT = path.resolve(__dirname, '../..');

function requireSafeUri(uri) {
    if (typeof uri !== 'string' || uri !== uri.trim()) throw Error('URI_REJECTED');
    const parsed = new URL(uri);
    if (parsed.protocol !== 'mongodb+srv:' || !parsed.hostname.endsWith('.mongodb.net')
        || parsed.port || decodeURIComponent(parsed.username) !== USER
        || !parsed.password || parsed.pathname !== `/${DATABASE}` || parsed.hash) throw Error('URI_REJECTED');
    const allowed = new Set(['authSource', 'retryWrites', 'w', 'appName', 'tls', 'ssl']);
    const seen = new Set();
    for (const [key, value] of parsed.searchParams) {
        if (!allowed.has(key) || seen.has(key)) throw Error('URI_OPTIONS_REJECTED');
        seen.add(key);
        if (key === 'authSource' && !['admin', DATABASE].includes(value)) throw Error('AUTH_SOURCE_REJECTED');
        if (['tls', 'ssl'].includes(key) && value !== 'true') throw Error('TLS_REQUIRED');
    }
    return parsed;
}

function requireIsolatedPrivileges(status) {
    const info = status?.authInfo;
    const users = info?.authenticatedUsers;
    const roles = info?.authenticatedUserRoles;
    const privileges = info?.authenticatedUserPrivileges;
    if (!Array.isArray(users) || users.length !== 1 || users[0].user !== USER
        || !['admin', DATABASE].includes(users[0].db)) throw Error('USER_REJECTED');
    if (!Array.isArray(roles) || roles.length !== 1
        || roles[0].role !== 'readWrite' || roles[0].db !== DATABASE) throw Error('ROLES_REJECTED');
    if (!Array.isArray(privileges) || privileges.length === 0) throw Error('PRIVILEGES_MISSING');
    for (const privilege of privileges) {
        const resource = privilege.resource;
        if (!resource || resource.db !== DATABASE || typeof resource.collection !== 'string'
            || Object.keys(resource).some(key => !['db', 'collection'].includes(key))
            || !Array.isArray(privilege.actions) || privilege.actions.length === 0) throw Error('CROSS_DATABASE_PRIVILEGE');
    }
    if (!privileges.some(item => item.resource.collection === '' && item.actions.includes('insert')
        && item.actions.includes('update'))) throw Error('READ_WRITE_NOT_CONFIRMED');
    return { user: USER, database: DATABASE, role: `readWrite@${DATABASE}`, productionWritePrivilege: false };
}

function privateJson(filename) {
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)
        || stat.uid !== process.getuid()) throw Error('PRIVATE_FILE_REQUIRED');
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

async function main() {
    if (process.argv.length !== 2 || process.cwd() !== ROOT) throw Error('WORKTREE_REQUIRED');
    const directory = path.join(ROOT, '.cache/isolated-atlas');
    const directoryStat = fs.lstatSync(directory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()
        || (directoryStat.mode & 0o077) || directoryStat.uid !== process.getuid()) throw Error('PRIVATE_DIRECTORY_REQUIRED');
    const settings = privateJson(path.join(directory, 'runtime.json'));
    if (settings.database !== DATABASE || settings.user !== USER || settings.PORT !== 5025
        || settings.HOST !== '127.0.0.1' || settings.NODE_ENV !== 'development'
        || settings.PAYROLL_AUTOMATIC_DB_SCHEMA_OPERATIONS_ENABLED !== 'false'
        || settings.PAYROLL_USAGE_CLEANUP_ENABLED !== 'false'
        || settings.PAYROLL_PRECALC_SCHEDULER_ENABLED !== 'false'
        || settings.USE_LOCAL_STORAGE !== 'true' || settings.serverStartAllowed !== false) throw Error('SETTINGS_REJECTED');
    const { mongodbUrl } = privateJson(path.join(directory, 'credentials.json'));
    requireSafeUri(mongodbUrl);
    // No inherited URI, AWS credentials, .env, or production settings are used.
    const { MongoClient } = require('mongoose').mongo;
    const client = new MongoClient(mongodbUrl, { dbName: DATABASE, appName: 'payroll-isolated-preflight',
        serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, socketTimeoutMS: 8000,
        maxPoolSize: 1, retryWrites: false });
    try {
        await client.connect();
        const db = client.db();
        if (db.databaseName !== DATABASE || client.options.credentials?.username !== USER) throw Error('TARGET_REJECTED');
        const status = await db.command({ connectionStatus: 1, showPrivileges: true });
        const confirmed = requireIsolatedPrivileges(status);
        await db.command({ ping: 1 });
        console.log(JSON.stringify({ ...confirmed, connection: 'verified', writesAttempted: 0,
            serverStarted: false, historyExecutionEnabled: false }));
    } finally {
        await client.close();
    }
}

module.exports = { requireSafeUri, requireIsolatedPrivileges };
if (require.main === module) main().catch(() => {
    // Do not render errors from the driver or URL parser: they may contain secrets.
    console.error('Ο έλεγχος της δοκιμαστικής σύνδεσης σταμάτησε επειδή δεν επιβεβαιώθηκαν η ρύθμιση, η πρόσβαση ή τα δικαιώματα. Δεν εκκινήθηκε εφαρμογή και δεν ζητήθηκε εγγραφή στη βάση.\n1. Ορίστε τοπικά τη σύνδεση με το configure.py.\n2. Ελέγξτε στο Atlas ότι υπάρχει μόνο readWrite@payroll_test_isolated και επαναλάβετε.\nΚωδικός αναφοράς: ATLAS-ISOLATED-PREFLIGHT-01.');
    process.exitCode = 1;
});
