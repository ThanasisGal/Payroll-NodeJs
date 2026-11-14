'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const F = require('../../../test/fixtures/employee0002HistoryProposalFixture');
const Legacy = require('../../../test/fixtures/employee0015ReviewFixture');
const { acceptanceBWithInitialGap } = require('../../../test/fixtures/employeeHistoryCoordinatedSettlementFixture');
const { settlementDecisionFixture } = require('../../../test/fixtures/employeeHistorySettlementDecisionFixture');
const { startUnifiedPreviewHarness } = require('../../../test/fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const { startSettlementHarness } = require('../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { coordinateEmployeeHistorySettlement } = require('./employeeHistorySettlementCoordinatorService');
const { buildUnifiedEmployeeHistorySettlementPreview } = require('./employeeHistorySettlementPreviewService');
const { buildEmployeeHistoryProposalComparisons } = require('./employeeHistoryProposalComparisonService');
const { employeeHistoryCoverageGaps } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { DISPLAY_FIELDS } = require('./employeeHistoryReconstructionPreviewService');
const labels = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const X = require('./employeeHistoryProposalXlsxService');
const rows = sheet => sheet.getSheetValues().slice(2).filter(Boolean);
const entries = (book, key) => rows(book.getWorksheet('Ταυτοποίηση')).filter(row => row[1] === key).map(row => JSON.parse(row[2]));
const fields = book => entries(book, 'comparisonField');
const field = (book, name) => fields(book).find(entry => entry.canonicalField === name);
const cell = (book, name, col = 'D') => book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(`${col}${field(book, name).row}`);
async function reload(result) {
    const buffer = await X.serializeEmployeeHistoryProposalWorkbook(result.workbook);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
    return { ...result, workbook, buffer };
}
let input, original, plan, sample;
before(async () => {
    forbidRealSettlementMongo(mock);
    input = F.employee0002HistoryProposalFixture(); original = A.stringify(input);
    plan = coordinateEmployeeHistorySettlement(input, { catalogs: F.catalogs });
    sample = await reload(await X.buildEmployeeHistoryProposalWorkbook(input, F.catalogs));
});
after(() => mock.restoreAll());

test('0002 REVIEW_REQUIRED without questions exports a full four-column comparison instead of a message', () => {
    assert.equal(plan.status, 'REVIEW_REQUIRED');
    assert.equal(buildUnifiedEmployeeHistorySettlementPreview(input, F.catalogs).questions.length, 0);
    const visible = sample.workbook.worksheets.filter(sheet => sheet.state === 'visible');
    assert.deepEqual(visible.map(sheet => sheet.name), ['ΠΡΙΝ - ΜΕΤΑ']);
    assert.equal(visible[0].columnCount, 4);
    assert.deepEqual(visible[0].getRow(4).values.slice(1), ['ΠΡΙΝ: Περιγραφή πεδίου', 'ΠΡΙΝ: Αποθηκευμένη τιμή',
        'ΜΕΤΑ: Περιγραφή πεδίου', 'ΜΕΤΑ: Προτεινόμενη / συμπληρώσιμη τιμή']);
    assert.ok(visible[0].rowCount > 100);
    assert.match(visible[0].getCell('A2').text, /0002.*09\/02\/2026.*31\/03\/2026.*0001 \/ 0002/);
});
test('all fields use the existing complete contract and application labels, including unchanged contract amounts', () => {
    const actual = new Map(fields(sample.workbook).map(entry => [entry.canonicalField, entry]));
    for (const name of DISPLAY_FIELDS) {
        assert.ok(actual.has(name), name);
        const row = sample.workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getRow(actual.get(name).row);
        assert.equal(row.getCell('A').text, labels[name]); assert.equal(row.getCell('C').text, labels[name]);
    }
    assert.ok(actual.get('symbash').row < actual.get('nomimosMisthos').row);
    assert.ok(actual.get('nomimosMisthos').row < actual.get('krathsh_01').row);
    assert.equal(cell(sample.workbook, 'poso_symbashs_01', 'B').value, 1000);
    assert.equal(cell(sample.workbook, 'poso_symbashs_01').value, 1000);
});
test('compatible contract facts and explicit zero/false values are copied without fabricated defaults', () => {
    for (const name of ['misthologiko_klimakio', 'nomimosMisthos', 'krathsh_01', 'poso_symbashs_01']) {
        assert.equal(field(sample.workbook, name).state, 'CONTINUING', name);
        assert.equal(field(sample.workbook, name).sourceHistoryId, String(input.completeHistoryRows[0]._id));
        assert.equal(cell(sample.workbook, name).fill.fgColor.argb, 'FFD1E7DD');
    }
    assert.equal(cell(sample.workbook, 'evelikth_proselefsh', 'B').value, 0);
    assert.equal(field(sample.workbook, 'typos_orarioy').rawBefore, false);
    assert.equal(cell(sample.workbook, 'typos_orarioy').text, 'Σταθερό');
});
test('later-only values stay yellow with exact provenance and mandatory human confirmation', () => {
    for (const name of ['nomimoOromisthio', 'eidikothta_symbashs']) {
        const mapping = field(sample.workbook, name), proposed = cell(sample.workbook, name);
        assert.equal(mapping.state, 'SUGGESTED_LATER'); assert.equal(mapping.confirmationRequired, true);
        assert.equal(mapping.coverage.covered, false); assert.equal(mapping.coverage.valueRecorded, false);
        assert.equal(mapping.sourceHistoryId, String(input.completeHistoryRows[1]._id));
        assert.equal(proposed.fill.fgColor.argb, 'FFFFF3CD');
        assert.match(JSON.stringify(proposed.note), /Πρόταση από μεταγενέστερη εγγραφή 0002 — απαιτείται επιβεβαίωση/);
    }
    assert.equal(cell(sample.workbook, 'nomimoOromisthio').value, 7.35);
});
test('different earnings remain unresolved with the prior amount and a clear later alternative', () => {
    assert.equal(cell(sample.workbook, 'pragmatikosMisthos', 'B').value, 1100);
    assert.equal(cell(sample.workbook, 'pragmatikosMisthos').value, 1100);
    assert.equal(field(sample.workbook, 'pragmatikosMisthos').state, 'CONFIRM_PREVIOUS');
    assert.match(JSON.stringify(cell(sample.workbook, 'pragmatikosMisthos').note), /1\.300|1300/);
    assert.match(JSON.stringify(cell(sample.workbook, 'pragmatikosMisthos').note), /Οι εγγραφές διαφέρουν/);
    assert.equal(cell(sample.workbook, 'pragmatikosMisthos').fill.fgColor.argb, 'FFFFF3CD');
});
test('a value missing in 0001 and 0002 can use 0003 only as an explicitly unconfirmed later suggestion', async () => {
    const data = F.employee0002HistoryProposalFixture(); delete data.completeHistoryRows[1].nomimoOromisthio;
    const result = await reload(await X.buildEmployeeHistoryProposalWorkbook(data, F.catalogs));
    assert.equal(cell(result.workbook, 'nomimoOromisthio').value, 8);
    assert.equal(field(result.workbook, 'nomimoOromisthio').state, 'SUGGESTED_LATER');
    assert.equal(field(result.workbook, 'nomimoOromisthio').sourceHistoryId, String(data.completeHistoryRows[2]._id));
    assert.match(JSON.stringify(cell(result.workbook, 'nomimoOromisthio').note), /μεταγενέστερη εγγραφή 0003 — απαιτείται επιβεβαίωση/);
});
test('unrecorded deductions stay empty, editable and explicitly uncertain', () => {
    const unknown = cell(sample.workbook, 'krathsh_02');
    assert.equal(unknown.value, null); assert.equal(unknown.protection.locked, false);
    assert.equal(field(sample.workbook, 'krathsh_02').state, 'UNCERTAIN');
    assert.match(JSON.stringify(unknown.note), /Παραμένει αβέβαιο/);
});
test('coverage comes from real gaps and remains field-specific rather than assigning one expiry to everything', () => {
    const result = buildEmployeeHistoryProposalComparisons(input, plan);
    assert.deepEqual(result.gaps, employeeHistoryCoverageGaps({ currentEmployee: input.currentEmployee, historyRows: input.completeHistoryRows }));
    assert.deepEqual(result.gaps.map(gap => [gap.from, gap.to]), [['2026-02-09', '2026-03-31']]);
    const variant = F.employee0002HistoryProposalFixture({ datedInitialProfile: false, reviewRequired: false });
    const projected = buildEmployeeHistoryProposalComparisons(variant, coordinateEmployeeHistorySettlement(variant, { catalogs: F.catalogs })).comparisons[0];
    assert.equal(projected.period.from, '2026-02-02');
    assert.deepEqual(projected.values.find(value => value.field === 'ores_ergasias_ebdomadas').coverage.uncovered,
        [{ from: '2026-02-09', to: '2026-03-31' }]);
    const pay = projected.values.find(value => value.field === 'nomimosMisthos');
    assert.equal(pay.coverage.covered, true); assert.deepEqual(pay.coverage.uncovered, []);
});
test('future events never move backwards; only the actual gap supplies new validity boundaries', () => {
    assert.equal(cell(sample.workbook, 'hmeromhnia_allaghs_symbashs').value, null);
    assert.notEqual(cell(sample.workbook, 'hmeromhnia_allaghs_symbashs').protection?.locked, false);
    assert.equal(field(sample.workbook, 'hmeromhnia_allaghs_symbashs').confirmationRequired, false);
    assert.equal(cell(sample.workbook, 'hmeromhnia_allaghs_symbashs').fill.fgColor.argb, 'FFF8F9FA');
    assert.equal(cell(sample.workbook, 'hmeromhnia_isxyos_oron_ergasias_apo').value.toISOString(), '2026-02-09T00:00:00.000Z');
    assert.equal(cell(sample.workbook, 'hmeromhnia_isxyos_oron_ergasias_eos').value.toISOString(), '2026-03-31T00:00:00.000Z');
    for (const name of ['hmeromhnia_proslhpshs', 'hmeromhnia_isxyos_oron_ergasias_apo', 'hmeromhnia_isxyos_oron_ergasias_eos']) {
        assert.equal(cell(sample.workbook, name).numFmt, 'dd/mm/yyyy');
        assert.notEqual(cell(sample.workbook, name).protection?.locked, false);
    }
});
test('only allowlisted AFTER cells unlock; BEFORE, metadata, identities and unused cells remain protected', () => {
    const permitted = new Set(sample.editableCells.map(entry => `${entry.sheet}!${entry.cell}`)); let found = 0;
    for (const sheet of sample.workbook.worksheets) {
        assert.equal(sheet.sheetProtection.sheet, true, sheet.name);
        sheet.eachRow(row => row.eachCell({ includeEmpty: true }, entry => {
            if (entry.protection?.locked === false) {
                found++; assert.equal(sheet.name, 'ΠΡΙΝ - ΜΕΤΑ'); assert.equal(entry.col, 4);
                assert.ok(permitted.has(`${sheet.name}!${entry.address}`));
            }
        }));
    }
    assert.equal(found, permitted.size);
    assert.notEqual(sample.workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell('D1000').protection?.locked, false);
    for (const name of ['Σύνοψη', 'Τεκμηριωμένες διορθώσεις', 'Αμφίβολες περιπτώσεις', 'Αρχικό Ιστορικό', 'Οδηγίες', 'Ταυτοποίηση', 'Επιλογές'])
        assert.equal(sample.workbook.getWorksheet(name).state, 'veryHidden', name);
});
test('catalog dropdowns, typed dates/numbers and canonical mappings survive serialization', () => {
    for (const name of ['symbash', 'kathgoria_symbashs', 'eidikothta_symbashs', 'stoixeio_symbashs_01', 'krathsh_01', 'typos_orarioy']) {
        const validation = cell(sample.workbook, name).dataValidation;
        assert.equal(validation.type, 'list', name);
        assert.match(sample.workbook.definedNames.getRanges(validation.formulae[0]).ranges[0], /Επιλογές/);
    }
    assert.equal(cell(sample.workbook, 'nomimosMisthos').dataValidation.type, 'decimal');
    assert.equal(cell(sample.workbook, 'hmeres_ergasias_ebdomadas').dataValidation.type, 'whole');
    assert.equal(cell(sample.workbook, 'hmeromhnia_lhxhs_symbashs').dataValidation.type, 'date');
    for (const entry of fields(sample.workbook)) { assert.ok(labels[entry.canonicalField]); assert.ok(entry.comparisonId); }
});
test('REVIEW_REQUIRED never becomes CLEAN or approval, even when all workbook answers are edited', () => {
    const summary = new Map(rows(sample.workbook.getWorksheet('Σύνοψη')).map(row => [row[1], row[2]]));
    const manifest = new Map(rows(sample.workbook.getWorksheet('Ταυτοποίηση')).map(row => [row[1], row[2]]));
    for (const entry of sample.editableCells) sample.workbook.getWorksheet(entry.sheet).getCell(entry.cell).value = 'Συνθετική απάντηση';
    assert.equal(summary.get('Κατάσταση πρότασης'), 'REVIEW_REQUIRED');
    assert.equal(manifest.get('plannerStatus'), 'REVIEW_REQUIRED');
    assert.equal(manifest.get('importEnabled'), 'false'); assert.equal(manifest.get('executionCapability'), 'NONE');
    assert.equal(coordinateEmployeeHistorySettlement(input, { catalogs: F.catalogs }).status, 'REVIEW_REQUIRED');
    assert.equal(A.stringify(input), original);
});
test('CLEAN planner technical rows, differences and logical identities retain their established meanings', async () => {
    const data = acceptanceBWithInitialGap(), before = A.stringify(data), expected = coordinateEmployeeHistorySettlement(data);
    const result = await X.buildEmployeeHistoryProposalWorkbook(data), technical = rows(result.workbook.getWorksheet('Τεκμηριωμένες διορθώσεις'));
    assert.equal(expected.status, 'CLEAN');
    for (const change of expected.fieldChanges) for (const [name, value] of Object.entries(change.patch)) {
        const exported = technical.find(row => row[2] === change.historyId && row[7] === (labels[name] || name));
        assert.ok(exported); assert.equal(String(exported[9]), String(value));
    }
    assert.equal(A.stringify(data), before);
});
test('fingerprints bind source and references while credentials, frozen payloads and executable formulas never serialize', async () => {
    const data = F.employee0002HistoryProposalFixture(), same = await X.buildEmployeeHistoryProposalWorkbook(data, F.catalogs);
    assert.equal(same.snapshotFingerprint, sample.snapshotFingerprint);
    data.currentEmployee.parathrhseis = 'later synthetic observation';
    assert.notEqual((await X.buildEmployeeHistoryProposalWorkbook(data, F.catalogs)).snapshotFingerprint, same.snapshotFingerprint);
    const privateData = F.employee0002HistoryProposalFixture(); privateData.currentEmployee.password = 'SECRET_SENTINEL';
    privateData.completeHistoryRows[0].api_key = 'PRIVATE_KEY_SENTINEL';
    privateData.protectedReferenceSummary[String(privateData.completeHistoryRows[0]._id)].push({ collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'synthetic-reference', privatePayload: 'FROZEN_SENTINEL' });
    const exported = await reload(await X.buildEmployeeHistoryProposalWorkbook(privateData, F.catalogs));
    assert.notEqual(exported.snapshotFingerprint, same.snapshotFingerprint);
    const zip = await JSZip.loadAsync(exported.buffer), xml = (await Promise.all(Object.keys(zip.files).filter(name => name.endsWith('.xml')).map(name => zip.file(name).async('string')))).join('\n');
    assert.doesNotMatch(xml, /SECRET_SENTINEL|PRIVATE_KEY_SENTINEL|FROZEN_SENTINEL|<f>/);
    exported.workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').eachRow(row => row.eachCell(entry => assert.doesNotMatch(entry.text, /\b[a-f\d]{24,}\b|REVIEW_REQUIRED|hmeromhnia_/)));
});
test('a structural CLEAN candidate still cannot conceal failure of the final save policy', async () => {
    const fixtures = require('./fixtures/unifiedEmployeeHistorySettlementFixtures');
    const data = fixtures.references(fixtures.families.find(item => item.number === 23).make());
    assert.equal(coordinateEmployeeHistorySettlement(data).status, 'CLEAN');
    const result = await X.buildEmployeeHistoryProposalWorkbook(data);
    const summary = new Map(rows(result.workbook.getWorksheet('Σύνοψη')).map(row => [row[1], row[2]]));
    assert.equal(summary.get('Κατάσταση πρότασης'), 'REVIEW_REQUIRED');
    assert.equal(rows(result.workbook.getWorksheet('Τεκμηριωμένες διορθώσεις')).length, 1);
});
test('generic business choices retain exact option identities without physical withdrawal or apply capability', async () => {
    const result = await X.buildEmployeeHistoryProposalWorkbook(settlementDecisionFixture());
    const choice = result.editableCells.find(entry => entry.options?.some(option => option.id === 'KEEP_TWO_DAY_PROFILE'));
    assert.ok(choice);
    assert.deepEqual(choice.options.map(option => option.id), ['KEEP_TWO_DAY_PROFILE', 'KEEP_FOUR_DAY_PROFILE', 'SPLIT_AT_2026_06_29']);
    assert.equal(result.editableCells.some(entry => /REMOVE|DELETE|WITHDRAW|RETIRE/.test(entry.fieldId)), false);
});
test('synthetic HTTP download remains read-only and retains authorization', async () => {
    const h = await startUnifiedPreviewHarness({ data: F.employee0002HistoryProposalFixture(), catalogs: F.catalogs });
    try {
        const before = A.stringify(h.state), response = await fetch(`${h.origin}/api/ergazomenoi/${h.state.currentEmployee._id}/history-proposal.xlsx`);
        assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /spreadsheetml/);
        const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
        assert.equal(book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').columnCount, 4);
        assert.equal(A.stringify(h.state), before); assert.equal(h.counts.applyRequests, 0); assert.equal(h.counts.permissionReads, 1);
        assert.equal((await fetch(`${h.origin}/api/ergazomenoi/507f1f77bcf86cd799439198/history-proposal.xlsx`)).status, 404);
    } finally { await h.close(); }
});
test('normal export loads catalogs even without schedule evidence, without any fence, write or commit', async t => {
    let reads = 0;
    const loader = mock.method(require('./employeeHistoryCorrectionCatalogService'), 'loadEmployeeHistoryCorrectionCatalogs', async () => { reads++; return F.catalogs; });
    t.after(() => loader.mock.restore());
    const h = await startSettlementHarness({ fixture: acceptanceBWithInitialGap(), realHttp: true, normal: true, enriched: false });
    try {
        const before = A.stringify(h.db.state()), response = await fetch(`${h.origin}/api/ergazomenoi/${h.initial.employeeId}/history-proposal.xlsx`);
        assert.equal(response.status, 200); assert.equal(reads, 1); assert.equal(A.stringify(h.db.state()), before);
        assert.equal(h.db.events.some(event => ['write', 'commit', 'fence'].includes(event.type)), false);
        h.actor.situation = 'I'; assert.equal((await fetch(`${h.origin}/api/ergazomenoi/${h.initial.employeeId}/history-proposal.xlsx`)).status, 403);
    } finally { await h.close(); }
});
test('legacy source mappings and wrapped rows retain hidden identities, AutoFit and active worksheet protection', async () => {
    const result = await reload(await X.buildEmployeeHistoryProposalWorkbook(Legacy.data(), Legacy.catalogs));
    assert.ok(rows(result.workbook.getWorksheet('Αμφίβολες περιπτώσεις')).length > 1);
    assert.ok(result.editableCells.some(entry => entry.sourceSheet === 'Αμφίβολες περιπτώσεις'));
    const sheet = result.workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ'); assert.equal(sheet.views[0].ySplit, 5);
    sheet.eachRow(row => row.eachCell(entry => { assert.equal(entry.alignment.wrapText, true); assert.equal(entry.alignment.vertical, 'top'); }));
    const zip = await JSZip.loadAsync(result.buffer), xml = await zip.file(`xl/worksheets/sheet${sheet.id}.xml`).async('string');
    assert.match(xml, /sheetProtection sheet="1"/); assert.match(xml, /dataValidations/); assert.doesNotMatch(xml, /customHeight="1"/);
    assert.ok(Object.keys(zip.files).some(name => /^xl\/comments\d+\.xml$/.test(name)));
    assert.equal(A.stringify(input), original);
});
