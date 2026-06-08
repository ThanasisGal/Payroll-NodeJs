#!/usr/bin/env node

// =========================================================================
// ✅ Dump E3N JSON payload χωρίς υποβολή στο ΕΡΓΑΝΗ
// =========================================================================
//
// Usage examples:
//
// node scripts/dump-e3n-json-payload.js --employee=EMPLOYEE_ID
// node scripts/dump-e3n-json-payload.js --employee=EMPLOYEE_ID --ypokatasthma=0000
//
// Προϋπόθεση:
// - Να φορτώνεται το ίδιο DB connection όπως στα υπόλοιπα scripts σου.
// - Αν στο repo έχεις διαφορετικό db bootstrap, άλλαξε μόνο το require στο loadDatabase().
//
// Output:
// tmp/erganh-json/e3n_<employeeId>.json

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { generateE3NJsonPayload } = require('../server/utils/jsonGenerators/e3N_v1JsonGenerator');

function getArg(name, fallback = '') {
    const prefix = `--${name}=`;
    const found = process.argv.find((arg) => arg.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
}

async function loadDatabase() {
    // Προσαρμόζεται εύκολα αν το repo σου έχει κεντρικό db connector.
    // Κρατάμε fallback με MONGODB_URI για να μπορεί να τρέξει ανεξάρτητα.
    if (mongoose.connection.readyState === 1) return;

    const mongoUri =
        process.env.MONGODB_URI ||
        process.env.DB_STRING ||
        process.env.DATABASE_URL ||
        process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error(
            'Δεν βρέθηκε MongoDB connection string. Βάλε MONGODB_URI ή σύνδεσε εδώ το υπάρχον db bootstrap του repo.'
        );
    }

    await mongoose.connect(mongoUri);
}

async function main() {
    const employeeId = getArg('employee') || getArg('ergazomenos') || getArg('id');
    const ypokatasthmaArg = getArg('ypokatasthma', '');

    if (!employeeId) {
        console.error('Usage: node scripts/dump-e3n-json-payload.js --employee=EMPLOYEE_ID');
        process.exit(1);
    }

    await loadDatabase();

    const Models_C = require('../server/models/companies');
    const Models_D = require('../server/models/ergazomenoi');

    const { CompaniesModel, YpokatasthmataModel } = Models_C;
    const { ErgazomenoiModel } = Models_D;

    const employeeQuery = mongoose.Types.ObjectId.isValid(String(employeeId))
        ? { _id: employeeId }
        : { kodikos: String(employeeId) };

    const ergazomenos = await ErgazomenoiModel.findOne(employeeQuery).lean();

    if (!ergazomenos) {
        throw new Error(`Δεν βρέθηκε εργαζόμενος: ${employeeId}`);
    }

    const companyId =
        ergazomenos.company_kod ||
        ergazomenos.companykod_object ||
        ergazomenos.company ||
        ergazomenos.companyId;

    let companyData = null;

    if (companyId && mongoose.Types.ObjectId.isValid(String(companyId))) {
        companyData = await CompaniesModel.findById(companyId).lean();
    }

    if (!companyData && companyId) {
        companyData =
            (await CompaniesModel.findOne({ kod: companyId }).lean()) ||
            (await CompaniesModel.findOne({ kodikos: companyId }).lean());
    }

    if (!companyData) {
        throw new Error('Δεν βρέθηκαν στοιχεία εταιρείας για τον εργαζόμενο.');
    }

    const ypokatasthmaKod =
        ypokatasthmaArg ||
        ergazomenos.ypokatasthma ||
        ergazomenos.ypokatasthma_kodikos ||
        '0';

    let ypokatasthmataData = await YpokatasthmataModel.findOne({
        companykod_object: companyData._id,
        kodikos: String(ypokatasthmaKod)
    }).lean();

    if (!ypokatasthmataData) {
        ypokatasthmataData = await YpokatasthmataModel.findOne({
            company: companyData.kod || companyData.kodikos,
            kodikos: String(ypokatasthmaKod)
        }).lean();
    }

    if (!ypokatasthmataData) {
        throw new Error(`Δεν βρέθηκε υποκατάστημα: ${ypokatasthmaKod}`);
    }

    const payload = await generateE3NJsonPayload(ergazomenos, companyData, ypokatasthmataData);

    const outDir = path.join(process.cwd(), 'tmp', 'erganh-json');
    fs.mkdirSync(outDir, { recursive: true });

    const filename = `e3n_${String(ergazomenos._id || employeeId)}.json`;
    const outPath = path.join(outDir, filename);

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

    const record = payload.AnaggeliesE3N.AnaggeliaE3N[0];

    console.log('✅ E3N JSON payload generated');
    console.log('Output:', outPath);
    console.log('Keys:', Object.keys(record).length);
    console.log('Employee:', `${record.f_eponymo} ${record.f_onoma}`);
    console.log('AFM:', record.f_afm);
    console.log('AMKA:', record.f_amka);
    console.log('f_proslipsidate:', record.f_proslipsidate);
    console.log('f_proslipsitime:', record.f_proslipsitime);
    console.log('f_apoxwrisitime:', record.f_apoxwrisitime);

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error('❌ dump-e3n-json-payload failed:', error.message);
    if (process.env.NODE_ENV !== 'production' && error.stack) {
        console.error(error.stack);
    }
    try {
        await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});
