'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { requireSafeUri } = require('./preflight.cjs');
const ROOT = path.resolve(__dirname, '../..');

function privateJson(name) {
    const directory = path.join(ROOT, '.cache/isolated-atlas');
    for (const item of [directory, path.join(directory, name)]) {
        const stat = fs.lstatSync(item);
        if (stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw Error('PRIVATE_CONFIG_REQUIRED');
    }
    return JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
}

function loadEnvironment() {
    if(process.env.CI || process.env.GITHUB_ACTIONS || process.env.NODE_ENV==='production')throw Error('CI_OR_PRODUCTION_REJECTED');
    if (ROOT !== '/home/thanasis/Projects/Payroll-NodeJs-atlas-isolated-test-20261031'
        || fs.realpathSync(process.cwd()) !== ROOT) throw Error('WORKTREE_REQUIRED');
    const settings = privateJson('runtime.json');
    if (settings.database !== 'payroll_test_isolated' || settings.user !== 'payroll_dev_test'
        || settings.PORT !== 5025 || settings.HOST !== '127.0.0.1') throw Error('SETTINGS_REJECTED');
    const { mongodbUrl } = privateJson('credentials.json');
    requireSafeUri(mongodbUrl);
    for (const key of Object.keys(process.env)) if (!['PATH', 'NODE_PATH', 'HOME'].includes(key)) delete process.env[key];
    Object.assign(process.env, { NODE_ENV:'development', HOST:'127.0.0.1', PORT:'5025', MONGODB_URL:mongodbUrl,
        SESSION_SECRET:crypto.randomBytes(48).toString('hex'), USE_LOCAL_STORAGE:'true',
        PAYROLL_AUTOMATIC_DB_SCHEMA_OPERATIONS_ENABLED:'false', PAYROLL_USAGE_CLEANUP_ENABLED:'false',
        PAYROLL_PRECALC_SCHEDULER_ENABLED:'false', AWS_EC2_METADATA_DISABLED:'true',
        AWS_SHARED_CREDENTIALS_FILE:'/dev/null', AWS_CONFIG_FILE:'/dev/null', CLIENT_URL:'http://127.0.0.1:5025' });
    // app.js must not import additional settings from any .env file in this process.
    require('dotenv').config = () => ({ parsed: {} });
    return mongodbUrl;
}

function reportFailure(stage) {
    console.error(`Η δοκιμαστική ενέργεια σταμάτησε στο στάδιο ${stage}. Δεν ενεργοποιήθηκε αποθήκευση Ιστορικού.\n1. Ελέγξτε τη δοκιμαστική σύνδεση με το preflight.cjs.\n2. Ζητήστε έλεγχο της δοκιμαστικής εκκίνησης πριν επαναλάβετε.\nΚωδικός αναφοράς: ATLAS-ISOLATED-${stage}.`);
}
module.exports = { loadEnvironment, reportFailure };
