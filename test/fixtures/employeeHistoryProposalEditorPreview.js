'use strict';
// Interactive, loopback-only preview with synthetic data and forbidden MongoDB I/O.
const { mock } = require('node:test');
const { forbidRealSettlementMongo } = require('./forbidRealSettlementMongo');
const { startUnifiedPreviewHarness } = require('./employeeHistoryUnifiedPreviewHttpHarness');
const F = require('./employee0002HistoryProposalFixture');
forbidRealSettlementMongo(mock);
startUnifiedPreviewHarness({ data: F.employee0002HistoryProposalFixture(), catalogs: F.catalogs }).then(h => {
    console.log(`Συνθετική προεπισκόπηση: ${h.origin}`);
    console.log('Πατήστε «Εξαγωγή πρότασης Ιστορικού». Τερματισμός με Ctrl+C.');
    const close = async () => { await h.close(); mock.restoreAll(); };
    process.once('SIGINT', close); process.once('SIGTERM', close);
}).catch(error => { console.error(error); mock.restoreAll(); process.exitCode = 1; });
