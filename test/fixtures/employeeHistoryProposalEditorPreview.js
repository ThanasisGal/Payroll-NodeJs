'use strict';
// Interactive, loopback-only preview with synthetic data and forbidden MongoDB I/O.
const { mock } = require('node:test');
const { forbidRealSettlementMongo } = require('./forbidRealSettlementMongo');
const { startUnifiedPreviewHarness } = require('./employeeHistoryUnifiedPreviewHttpHarness');
const F = require('./employee0002HistoryProposalFixture');
const fs = require('node:fs/promises'),path=require('node:path'),os=require('node:os');
forbidRealSettlementMongo(mock);
startUnifiedPreviewHarness({ data: F.employee0002HistoryProposalFixture(), catalogs: F.catalogs }).then(async h => {
    const folder=await fs.mkdtemp(path.join(os.tmpdir(),'payroll-xlsx-import-preview-'));
    for(const operation of ['UPDATE','INSERT']){
        const sample=await require('./employeeHistoryProposalImportFixture').importSample(operation,h.state);
        await fs.writeFile(path.join(folder,sample.result.filename),sample.buffer);
    }
    console.log(`Συνθετική προεπισκόπηση: ${h.origin}`);
    console.log(`Συνθετικά αρχεία UPDATE/INSERT: ${folder}`);
    console.log('Πατήστε «Εξαγωγή πρότασης Ιστορικού» και επιλέξτε ένα συνθετικό XLSX στο «Έλεγχος συμπληρωμένου XLSX». Επιτρέπονται αλλαγές μόνο στα ξεκλείδωτα ΜΕΤΑ μέσω Calc. Η εισαγωγή εμφανίζει μόνο προεπισκόπηση. Τερματισμός με Ctrl+C.');
    const close = async () => { await h.close(); mock.restoreAll(); };
    process.once('SIGINT', close); process.once('SIGTERM', close);
}).catch(error => { console.error(error); mock.restoreAll(); process.exitCode = 1; });
