const mongoose = require('mongoose');
const UserPrivilegeFormCatalogModel = require('../models/userPrivilegeFormCatalog');
const {
    USER_PRIVILEGE_FORM_CATALOG_SEED,
    validateCatalogSeed
} = require('./userPrivilegeFormCatalogSeedData');

async function main() {
    const apply = process.argv.includes('--apply');
    const dryRun = process.argv.includes('--dry-run');
    if (apply === dryRun) {
        throw new Error('Χρησιμοποίησε ακριβώς ένα από --dry-run ή --apply');
    }

    const entries = validateCatalogSeed();
    if (dryRun) {
        console.log(JSON.stringify({
            mode: 'dry-run',
            collection: 'User_Privilege_Form_Catalog',
            operations: entries.map((entry) => ({ filter: { form: entry.form }, update: entry }))
        }, null, 2));
        return;
    }

    if (!process.env.MONGODB_URL) throw new Error('Δεν έχει οριστεί MONGODB_URL');
    await mongoose.connect(process.env.MONGODB_URL);
    try {
        const operations = entries.map((entry) => ({
            updateOne: {
                filter: { form: entry.form },
                update: {
                    $setOnInsert: { form: entry.form },
                    $set: {
                        formLabel: entry.formLabel,
                        sidebarOrder: entry.sidebarOrder,
                        active: entry.active,
                        showInPrivileges: entry.showInPrivileges
                    }
                },
                upsert: true,
                runValidators: true
            }
        }));
        const result = await UserPrivilegeFormCatalogModel.bulkWrite(operations, { ordered: true });
        console.log(JSON.stringify({
            matched: result.matchedCount,
            modified: result.modifiedCount,
            upserted: result.upsertedCount
        }));
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = { main };
