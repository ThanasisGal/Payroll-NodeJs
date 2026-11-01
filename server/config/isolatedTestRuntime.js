'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = '/home/thanasis/Projects/Payroll-NodeJs-atlas-isolated-test-20261031';
let active = false;
let clientsVerified = null;

function eligible(context) {
    return context.root === ROOT && context.cwd === ROOT
        && context.entry === path.join(ROOT, 'tools/isolated-atlas/start.cjs')
        && context.environment === 'development' && context.host === '127.0.0.1'
        && context.port === '5025' && !context.ci && (context.argumentCount === 2 ||
            context.argumentCount === 3 && [require('../services/ergazomenoi/employeeHistorySettlementIsolatedTestPolicy').FLAG,
                require('../services/ergazomenoi/employeeHistorySettlementIsolatedTestPolicy').EXECUTE_FLAG].includes(context.argument));
}

async function verifyClient(client) {
    if (client.db().databaseName !== 'payroll_test_isolated'
        || client.options.credentials?.username !== 'payroll_dev_test') throw Error('ISOLATED_TARGET_REJECTED');
    return require('../../tools/isolated-atlas/preflight.cjs').requireIsolatedPrivileges(
        await client.db().command({ connectionStatus: 1, showPrivileges: true }));
}

async function activate({ clients }) {
    const context = { root: fs.realpathSync(path.join(__dirname, '../..')),
        cwd: fs.realpathSync(process.cwd()), entry: path.resolve(process.argv[1] || ''),
        environment: process.env.NODE_ENV, host: process.env.HOST, port: process.env.PORT,
        argumentCount: process.argv.length, argument:process.argv[2], ci:Boolean(process.env.CI||process.env.GITHUB_ACTIONS) };
    if (active || !eligible(context) || !Array.isArray(clients) || clients.length !== 2 || clients[0]===clients[1])
        throw Error('ISOLATED_RUNTIME_REJECTED');
    for (const client of clients) await verifyClient(client);
    active = true;
    clientsVerified = Object.freeze([...clients]);
}

function automaticTasksEnabled() { return !active; }
function isolatedCacheDirectory() { return active ? path.join(ROOT, '.cache/isolated-atlas/pdf-cache') : null; }
function verifiedClients(){return active?clientsVerified:null;}
module.exports = { eligible, verifyClient, activate, automaticTasksEnabled, isolatedCacheDirectory, verifiedClients };
