'use strict';

const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { mongoTarget, readKnownProductionUri } = require('./setupEmployeeHistoryRepairAudit');
const { canonicalizeEmployeeHistory, CANONICAL_STATUSES } =
    require('../server/services/ergazomenoi/employeeHistoryCanonicalizationService');
const { repairEmployeeHistoryCanonical } =
    require('../server/services/ergazomenoi/employeeEmploymentProfileWriter');
const { findHistoryIdReferences } =
    require('../server/services/ergazomenoi/employeeHistoryReferenceAuditService');
const { ErgazomenoiModel, IstorikoProslhpseonAllagonModel } =
    require('../server/models/ergazomenoi');

function option(argv, name) {
    const prefix = `--${name}=`;
    return argv.find(value => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function validateRepairRequest({ argv = [], env = process.env, knownProductionUri } = {}) {
    const dryRun = argv.includes('--dry-run');
    const apply = argv.includes('--apply');
    if (dryRun === apply) throw new Error('Απαιτείται ακριβώς μία από τις --dry-run ή --apply.');
    const target = mongoTarget(env.MONGODB_URL);
    if (option(argv, 'expected-database') !== target.database) {
        throw new Error('Το --expected-database δεν συμφωνεί με τον επιλεγμένο στόχο.');
    }
    const productionUri = knownProductionUri === undefined
        ? readKnownProductionUri({ env }) : knownProductionUri;
    if (!productionUri) throw new Error('Η ταυτότητα περιβάλλοντος δεν προσδιορίστηκε με ασφάλεια.');
    const production = mongoTarget(productionUri).identity === target.identity;
    if (apply && production && !argv.includes('--confirm-production-history-repair')) {
        throw new Error('Η εφαρμογή σε παραγωγή απαιτεί --confirm-production-history-repair.');
    }
    return { dryRun, apply, production, database: target.database };
}

async function runRepair({ argv = process.argv.slice(2), env = process.env,
    knownProductionUri, output = value => console.log(value) } = {}) {
    const request = validateRepairRequest({ argv, env, knownProductionUri });
    await mongoose.connect(env.MONGODB_URL, { autoIndex: false });
    const summary = { database: request.database, mode: request.dryRun ? 'DRY_RUN' : 'APPLY',
        scanned: 0, clean: 0, repairable: 0, repaired: 0, ambiguous: 0,
        referencedRepairReferences: 0 };
    try {
        const cursor = ErgazomenoiModel.find().select('-bibliario_anhlikoy_base64 ' +
            '-arxeio_nomimopoihtikon_eggrafon_base64 -arxeio_apodoxhs_oysiodon_oron_base64 ' +
            '-arxeio_apodoxhs_oron_atomikhs_symbashs_base64 -arxeio_symbashs_daneismoy_base64')
            .lean().cursor({ batchSize: 100 });
        for await (const employee of cursor) {
            const scope = Object.fromEntries(['team', 'company_kod', 'kodikos']
                .map(field => [field, String(employee[field] ?? '')]));
            const historyQuery = IstorikoProslhpseonAllagonModel.find(scope);
            historyQuery.mongooseOptions({ includeRedundantHistoryArtifacts: true });
            const rows = await historyQuery.lean();
            const canonical = canonicalizeEmployeeHistory({ scope,
                currentEmployee: employee, historyRows: rows });
            summary.scanned += 1;
            if (canonical.status === CANONICAL_STATUSES.TRUE_AMBIGUITY) {
                summary.ambiguous += 1;
            } else if (!canonical.cleanupRequired) {
                summary.clean += 1;
            } else {
                summary.repairable += 1;
                const changedIds = [...new Set([
                    ...canonical.rowsToUpdate.map(item => item.historyId),
                    ...canonical.rowsToDelete.map(item => item.historyId)
                ])];
                if (changedIds.length) {
                    const references = await findHistoryIdReferences({
                        connection: mongoose.connection, historyIds: changedIds });
                    summary.referencedRepairReferences += references.length;
                }
                if (request.apply) {
                    await repairEmployeeHistoryCanonical({ scope, employeeId: String(employee._id) });
                    summary.repaired += 1;
                }
            }
        }
        output(JSON.stringify(summary, null, 2));
        return summary;
    } finally {
        await mongoose.disconnect();
    }
}

async function main() {
    dotenv.config();
    return runRepair();
}

if (require.main === module) main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});

module.exports = { option, validateRepairRequest, runRepair, main };
