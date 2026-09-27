'use strict';

const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const {
    getEmployeeHistoryRepairAuditStorageState
} = require('../server/services/ergazomenoi/employeeHistoryRepairAuditSetupService');
const { mongoTarget } = require('./setupEmployeeHistoryRepairAudit');

async function runCheck({ env = process.env,
    clientFactory = uri => new MongoClient(uri, {
        appName: 'payroll-employee-history-repair-audit-check', retryWrites: false
    }), output = value => console.log(value) } = {}) {
    const uri = env.MONGODB_URL;
    const target = mongoTarget(uri);
    const client = clientFactory(uri);
    try {
        await client.connect();
        const state = await getEmployeeHistoryRepairAuditStorageState({ db: client.db() });
        if (!state.ready) {
            throw new Error('EMPLOYEE_HISTORY_REPAIR_AUDIT_NOT_READY: Εκτελέστε πρώτα την εγκεκριμένη εντολή setup και επαναλάβετε τον έλεγχο.');
        }
        output(JSON.stringify({ database: target.database, ...state }, null, 2));
        return state;
    } finally {
        await client.close();
    }
}

async function main() {
    dotenv.config();
    return runCheck();
}

if (require.main === module) {
    main().catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = { runCheck, main };
