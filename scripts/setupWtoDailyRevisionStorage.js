'use strict';
const { MongoClient } = require('mongodb');
const { validateSetupRequest } = require('./setupEmployeeHistoryRepairAudit');
// Uses the repository's existing explicit target/production confirmation gates.
// Only the two empty append/attempt collections are provisioned. No payroll,
// source, frozen result, approval or submission record is rewritten.
async function runSetup({ argv = process.argv.slice(2), env = process.env, knownProductionUri } = {}) {
    const target = validateSetupRequest({ argv, env, knownProductionUri });
    const client = new MongoClient(target.uri, { appName: 'payroll-wto-revision-storage-setup' });
    try {
        await client.connect(); const db = client.db(target.database);
        for (const name of ['WTO_Daily_Submission_Revisions', 'WTO_Daily_Revision_Transmissions']) {
            const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
            if (!exists) await db.createCollection(name);
            const indexes = await db.collection(name).indexes();
            if (!indexes.some(index => index.name === '_id_' && index.key._id === 1)) throw new Error('Missing required unique identity');
        }
        console.log('Η ασφαλής αποθήκευση διορθωτικών εκδόσεων και αποπειρών είναι διαθέσιμη. Δεν ενεργοποιήθηκε αποστολή ΕΡΓΑΝΗ.');
    } finally { await client.close(); }
}
if (require.main === module) runSetup().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { runSetup };
