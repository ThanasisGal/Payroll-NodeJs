'use strict';

// Read-only source files; all employee/schedule writes go to the synthetic store.
// Never load app.js, configuration files, credentials or a database connection.
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const mongoose = require('mongoose');
mongoose.connect = mongoose.createConnection = () => { throw Error('DATABASE_ACCESS_FORBIDDEN'); };
mongoose.Query.prototype.exec = () => { throw Error('DATABASE_ACCESS_FORBIDDEN'); };
const ExcelJS = require('exceljs');
const { employmentFixture, importHarness } = require('../test/fixtures/erganiImportTransactionFixture');
const hash = buffer => createHash('sha256').update(buffer).digest('hex');

async function verify(schedulePath, cardsPath) {
    if (!schedulePath || !cardsPath) throw Object.assign(Error(), { code: 'TWO_XLSX_PATHS_REQUIRED' });
    const [scheduleBuffer, cardsBuffer] = await Promise.all([fs.readFile(schedulePath), fs.readFile(cardsPath)]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(scheduleBuffer);
    const source = workbook.worksheets[0], identities = new Map(), dates = new Set();
    source.eachRow((row, index) => {
        if (index === 1) return;
        const afm = row.getCell(2).text.trim();
        const branch = String(row.getCell(1).text.trim()).padStart(4, '0');
        identities.set(afm, branch); dates.add(row.getCell(5).text.trim());
    });
    assert.equal(new Set(identities.values()).size, 1, 'SOURCE_BRANCH_AMBIGUOUS');
    const fixtures = [...identities].map(([afm, branch], index) => {
        const f = employmentFixture('gap'), code = String(index + 1).padStart(4, '0');
        Object.assign(f.employee, { _id: 'offline-' + index, kodikos: code, afm, ypokatasthma: branch,
            hmeromhnia_proslhpshs: '2026-11-01', hmeromhnia_apoxorhshs: '2026-09-30' });
        // Deliberately unusable History: the imports must not inspect it.
        f.history = []; return f;
    });
    const h = importHarness({ fixtures, existing: false });
    h.dependencies.authorizedScope.ypokatasthma = [...identities.values()][0];
    h.dependencies.persistWorkbook = false;
    h.dependencies.importRange = { startDate: new Date('2026-10-01'), endDate: new Date('2026-10-31') };
    h.db.hooks.read = (_session, kind) => { if (kind === 'history') throw Error('HISTORY_ACCESS_FORBIDDEN'); };
    const controller = require('../server/controllers/ergazomenoi/erganhController');
    const schedules = await controller.__scheduleDownloadTestHooks.processOrariaXlsx(
        schedulePath, '2026', h.dependencies.authorizedScope, h.dependencies);
    const sourceRows = structuredClone(h.rows());
    assert.equal(sourceRows.length, source.rowCount - 1, 'DECLARED_ROW_LOSS');
    assert.ok(sourceRows.every(row => row.ergani_pipeline.cards_pending));
    const prepared = await controller.__cardsDownloadTestHooks.prepareKartesXlsx(cardsBuffer, '01/10/2026');
    const unresolvedCards = prepared.persistencePayload.filter(row => !identities.has(row.afm));
    assert.equal(unresolvedCards.length, 0, 'UNMATCHED_CARD_EMPLOYEE');
    const cards = controller.__scheduleDownloadTestHooks.assertErganiImportApplied(
        await controller.__cardsDownloadTestHooks.saveKartesPayloadToMongo(prepared.persistencePayload, h.dependencies));
    assert.equal(h.rows().length, sourceRows.length, 'DECLARED_ROWS_CHANGED');
    assert.ok(h.rows().every(row => !row.ergani_pipeline.cards_pending && row.ergani_pipeline.calculation_pending));
    for (const row of sourceRows) {
        const after = h.rows().find(value => value._id === row._id);
        for (const field of ['kathgoria_ergasias', 'apo_ora_01', 'eos_ora_01', 'ores_ergasias', 'repo']) {
            assert.deepEqual(after[field], row[field], 'CARD_IMPORT_CHANGED_DECLARED_SOURCE');
        }
    }
    assert.equal(h.db.events.some(event => event.kind === 'history'), false);
    const [scheduleAfter, cardsAfter] = await Promise.all([fs.readFile(schedulePath), fs.readFile(cardsPath)]);
    assert.equal(hash(scheduleBuffer), hash(scheduleAfter), 'SOURCE_FILE_CHANGED');
    assert.equal(hash(cardsBuffer), hash(cardsAfter), 'SOURCE_FILE_CHANGED');
    return { mode: 'OFFLINE_MEMORY_ONLY', employeeCount: identities.size, dateCount: dates.size,
        scheduleRowsImported: schedules.matchedCount + schedules.upsertedCount,
        cardsPayloadRows: prepared.persistencePayload.length, cardEmployeeCount: new Set(prepared.persistencePayload.map(row => row.afm)).size,
        scheduleRowsCoveredByCards: cards.matchedCount, unmatchedEmployees: unresolvedCards.length,
        historyReads: 0, databaseConnections: 0, sourceFilesUnchanged: true,
        nextStages: ['CALCULATION', 'REVIEW'], pipelineComplete: false };
}

if (require.main === module) {
    const log = console.log, warn = console.warn;
    console.log = console.warn = () => {};
    verify(process.argv[2], process.argv[3]).then(result => {
        console.log = log; console.warn = warn; log(JSON.stringify(result, null, 2));
    }, error => {
        console.log = log; console.warn = warn;
        console.error(JSON.stringify({ success: false, code: error.code || 'OFFLINE_VERIFICATION_FAILED',
            assertion: error.name === 'AssertionError' ? error.message.split('\n')[0] : undefined }));
        process.exitCode = 1;
    });
}

module.exports = { verify };
