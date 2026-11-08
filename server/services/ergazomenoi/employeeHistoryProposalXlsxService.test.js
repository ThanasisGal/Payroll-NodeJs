'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const F = require('../../../test/fixtures/employee0015ReviewFixture');
const { acceptanceBWithInitialGap } = require('../../../test/fixtures/employeeHistoryCoordinatedSettlementFixture');
const { settlementDecisionFixture } = require('../../../test/fixtures/employeeHistorySettlementDecisionFixture');
const { startUnifiedPreviewHarness } = require('../../../test/fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const { startSettlementHarness } = require('../../../test/fixtures/employeeHistorySettlementHttpHarness');
const { coordinateEmployeeHistorySettlement } = require('./employeeHistorySettlementCoordinatorService');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const { buildEmployeeHistoryProposalWorkbook: build, serializeEmployeeHistoryProposalWorkbook: serialize, VERSION } = require('./employeeHistoryProposalXlsxService');
before(() => forbidRealSettlementMongo(mock));
after(() => mock.restoreAll());
const rows = sheet => sheet.getSheetValues().slice(2).filter(Boolean);
async function reload(result) {
    const buffer = await serialize(result.workbook), workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return { workbook, buffer };
}
test('0015 exports only the pending business sheet and retains all seven protected technical sheets without mutating evidence', async () => {
    const input = F.data(), before = A.stringify(input), result = await build(input, F.catalogs);
    const { workbook } = await reload(result);
    assert.equal(workbook.worksheets.length, 8);
    assert.deepEqual(workbook.worksheets.filter(sheet => sheet.state === 'visible').map(sheet => sheet.name), ['Στοιχεία προς συμπλήρωση']);
    assert.equal(workbook.worksheets.filter(sheet => sheet.state === 'veryHidden').length, 7);
    for (const sheet of workbook.worksheets) assert.equal(sheet.sheetProtection.sheet, true, sheet.name);
    const summary = new Map(rows(workbook.getWorksheet('Σύνοψη')).map(row => [row[1], row[2]]));
    assert.equal(summary.get('Κατάσταση πρότασης'), 'REVIEW_REQUIRED');
    assert.equal(summary.get('Κατάσταση αποθηκευμένου Ιστορικού'), 'LEGACY_REVIEW_REQUIRED');
    assert.equal(rows(workbook.getWorksheet('Αρχικό Ιστορικό')).length, input.completeHistoryRows.length);
    assert.equal(A.stringify(input), before);
});
test('exactly the declared answer/evidence/declaration cells are unlocked; IDs, dates, metadata and unused cells remain locked', async () => {
    const result = await build(F.data(), F.catalogs), { workbook } = await reload(result);
    const permitted = new Set(result.editableCells.map(entry => `${entry.sheet}!${entry.cell}`));
    assert.equal(permitted.size, 23);
    let actual = 0;
    for (const sheet of workbook.worksheets) sheet.eachRow(row => row.eachCell({ includeEmpty: true }, cell => {
        const key = `${sheet.name}!${cell.address}`;
        if (cell.protection?.locked === false) { actual++; assert.ok(permitted.has(key), key); }
        else assert.ok(!permitted.has(key), key);
    }));
    assert.equal(actual, permitted.size);
    assert.notEqual(workbook.getWorksheet('Στοιχεία προς συμπλήρωση').getCell('D1000').protection?.locked, false);
    assert.notEqual(workbook.getWorksheet('Αμφίβολες περιπτώσεις').getCell('H2').protection?.locked, false);
    assert.equal(workbook.getWorksheet('Επιλογές').state, 'veryHidden');
});
test('one concise input message and fixed declaration guidance avoid comment overlaps while all validations remain active', async () => {
    const result = await build(F.data(), F.catalogs), { workbook, buffer } = await reload(result);
    const sheet = workbook.getWorksheet('Στοιχεία προς συμπλήρωση');
    for (const entry of result.editableCells) {
        const cell = sheet.getCell(entry.cell);
        assert.equal(cell.note, undefined, entry.cell);
        if (entry.role === 'DECLARATION') {
            assert.notEqual(cell.dataValidation.showInputMessage, true);
            assert.equal(cell.dataValidation.prompt, undefined);
        } else {
            assert.equal(cell.dataValidation.showInputMessage, true);
            assert.ok(cell.dataValidation.prompt.length <= 140, entry.cell);
            assert.match(cell.dataValidation.prompt, /τεκμηριώνεται|τεκμήριο|έγγραφο/, entry.cell);
        }
        assert.equal(cell.dataValidation.showErrorMessage, true);
        if (entry.role === 'DECLARATION') assert.equal(cell.value, 'Παραμένει αβέβαιο');
    }
    assert.match(sheet.getCell('F1').text, /όλη την περίοδο.*Παραμένει αβέβαιο/);
    const choices = rows(workbook.getWorksheet('Επιλογές')).map(row => row[1]);
    for (const address of ['F4', 'F6']) {
        const cell = sheet.getCell(address);
        assert.equal(cell.dataValidation.type, 'list');
        const range = workbook.definedNames.getRanges(cell.dataValidation.formulae[0]).ranges[0];
        assert.match(range, /Επιλογές/);
        const [, first, last] = range.match(/\$A\$(\d+):\$A\$(\d+)/);
        assert.deepEqual([Number(first), Number(last)].map(row => workbook.getWorksheet('Επιλογές').getCell(`A${row}`).value),
            ['Παραμένει αβέβαιο', 'Δηλώνω τεκμηριωμένα στοιχεία']);
    }
    assert.ok(choices.includes('Παραμένει αβέβαιο'));
    sheet.getColumn('B').eachCell(cell => assert.equal(cell.note, undefined));
    for (const field of ['KPK', 'SPECIALTY', 'CONTRACT_TYPE', 'CONTRACT_CATEGORY', 'typos_orarioy']) {
        const entry = result.editableCells.find(item => item.fieldId === field && item.role === 'ANSWER');
        assert.equal(sheet.getCell(entry.cell).dataValidation.type, 'list');
    }
    const date = result.editableCells.find(item => item.fieldId === 'VALID_FROM' && item.role === 'ANSWER');
    assert.equal(sheet.getCell(date.cell).dataValidation.type, 'date');
    const zip = await JSZip.loadAsync(buffer), xml = await zip.file(`xl/worksheets/sheet${sheet.id}.xml`).async('string');
    assert.match(xml, /sheetProtection sheet="1"/);
    assert.match(xml, /dataValidations/);
    assert.match(xml, /showInputMessage="1"/);
    assert.equal(Object.keys(zip.files).some(name => /^xl\/comments\d+\.xml$/.test(name)), false);
});
test('documented BEFORE/AFTER values and logical identities match the existing complete verified proposal', async () => {
    const input = acceptanceBWithInitialGap(), before = A.stringify(input);
    const plan = coordinateEmployeeHistorySettlement(input), result = await build(input), { workbook } = await reload(result);
    assert.equal(plan.status, 'CLEAN');
    const exported = rows(workbook.getWorksheet('Τεκμηριωμένες διορθώσεις'));
    for (const change of plan.fieldChanges) for (const [field, after] of Object.entries(change.patch)) {
        const label = require('../../../public/js/ergazomenoi/genika/employeeHistoryFieldLabels')[field] || field;
        const row = exported.find(row => row[2] === change.historyId && row[7] === label);
        assert.ok(row, `${change.historyId}/${field}`);
        assert.equal(String(row[9]), String(after));
        assert.ok(row[10]); assert.ok(row[11]);
    }
    for (const row of plan.insertedRows) assert.ok(exported.some(line => line[2] === '' && line[3] === String(row._id)));
    assert.equal(A.stringify(input), before);
});
test('identity/version manifest is deterministic for the snapshot and changes for stale employee or reference evidence', async () => {
    const input = F.data(), first = await build(input, F.catalogs), again = await build(input, F.catalogs);
    assert.equal(first.snapshotFingerprint, again.snapshotFingerprint);
    assert.equal(first.proposalFingerprint, again.proposalFingerprint);
    input.currentEmployee.parathrhseis = 'later synthetic change';
    assert.notEqual((await build(input, F.catalogs)).snapshotFingerprint, first.snapshotFingerprint);
    const other = F.data(); other.protectedReferenceSummary[other.completeHistoryRows[0]._id].push({ collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'new' });
    assert.notEqual((await build(other, F.catalogs)).snapshotFingerprint, first.snapshotFingerprint);
    const metadata = new Map(rows(first.workbook.getWorksheet('Ταυτοποίηση')).map(row => [row[1], row[2]]));
    assert.equal(metadata.get('schemaVersion'), VERSION);
    assert.equal(metadata.get('importEnabled'), 'false');
    assert.equal(metadata.get('executionCapability'), 'NONE');
});
test('business choices come from the actual preview; no cell grants arbitrary physical withdrawal', async () => {
    const result = await build(settlementDecisionFixture());
    const answer = result.editableCells.find(item => item.role === 'ANSWER');
    assert.deepEqual(answer.options.map(option => option.id), ['KEEP_TWO_DAY_PROFILE', 'KEEP_FOUR_DAY_PROFILE', 'SPLIT_AT_2026_06_29']);
    assert.equal(result.editableCells.some(item => /REMOVE|DELETE|WITHDRAW|RETIRE/.test(item.fieldId)), false);
});
test('a structural CLEAN candidate cannot conceal failure of the existing final save policy', async () => {
    const fixtures = require('./fixtures/unifiedEmployeeHistorySettlementFixtures');
    const input = fixtures.references(fixtures.families.find(item => item.number === 23).make());
    assert.equal(coordinateEmployeeHistorySettlement(input).status, 'CLEAN');
    const result = await build(input), summary = new Map(rows(result.workbook.getWorksheet('Σύνοψη')).map(row => [row[1], row[2]]));
    assert.equal(summary.get('Κατάσταση πρότασης'), 'REVIEW_REQUIRED');
    assert.equal(rows(result.workbook.getWorksheet('Τεκμηριωμένες διορθώσεις')).length, 1);
});
test('no credentials or frozen reference payloads are serialized and text never becomes executable formulas', async () => {
    const input = F.data(); input.currentEmployee.password = 'SECRET_SENTINEL';
    input.completeHistoryRows[0].api_key = 'PRIVATE_KEY_SENTINEL';
    input.protectedReferenceSummary[input.completeHistoryRows[0]._id][0].privatePayload = 'FROZEN_SENTINEL';
    const { buffer } = await reload(await build(input, F.catalogs));
    const zip = await JSZip.loadAsync(buffer);
    const contents = await Promise.all(Object.keys(zip.files).filter(name => name.endsWith('.xml')).map(name => zip.file(name).async('string')));
    assert.doesNotMatch(contents.join('\n'), /SECRET_SENTINEL|PRIVATE_KEY_SENTINEL|FROZEN_SENTINEL|<f>/);
});
test('actual authenticated HTTP download returns an XLSX and performs no history/application operation', async () => {
    const h = await startUnifiedPreviewHarness({ data: F.data(), catalogs: F.catalogs }), before = A.stringify(h.state);
    try {
        const response = await fetch(`${h.origin}/api/ergazomenoi/${h.state.currentEmployee._id}/history-proposal.xlsx`);
        assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /spreadsheetml/);
        assert.match(response.headers.get('content-disposition'), /attachment; filename="employee-history-0015/);
        const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
        assert.ok(workbook.getWorksheet('Στοιχεία προς συμπλήρωση'));
        assert.equal(A.stringify(h.state), before); assert.equal(h.counts.applyRequests, 0);
        assert.equal(h.counts.permissionReads, 1);
        assert.equal((await fetch(`${h.origin}/api/ergazomenoi/507f1f77bcf86cd799439198/history-proposal.xlsx`)).status, 404);
    } finally { await h.close(); }
});
test('normal HTTP export uses the existing authorization and is read-only even with a writable synthetic backend', async () => {
    const h = await startSettlementHarness({ fixture: acceptanceBWithInitialGap(), realHttp: true, normal: true, enriched: false });
    try {
        const before = A.stringify(h.db.state());
        const response = await fetch(`${h.origin}/api/ergazomenoi/${h.initial.employeeId}/history-proposal.xlsx`);
        assert.equal(response.status, 200);
        assert.equal(A.stringify(h.db.state()), before);
        assert.equal(h.db.events.some(event => ['write', 'commit', 'fence'].includes(event.type)), false);
        h.actor.situation = 'I';
        assert.equal((await fetch(`${h.origin}/api/ergazomenoi/${h.initial.employeeId}/history-proposal.xlsx`)).status, 403);
    } finally { await h.close(); }
});
test('visible corrections contain business BEFORE/AFTER values while all original IDs and source mappings remain hidden', async () => {
    const result = await build(acceptanceBWithInitialGap()), { workbook } = await reload(result);
    const visible = workbook.worksheets.filter(sheet => sheet.state === 'visible');
    assert.deepEqual(visible.map(sheet => sheet.name), ['Προτεινόμενες διορθώσεις']);
    assert.deepEqual(visible[0].getRow(3).values.slice(1), ['Περίοδος / εγγραφή', 'Τι διορθώνεται', 'ΠΡΙΝ', 'ΜΕΤΑ', 'Αιτιολογία']);
    assert.ok(visible[0].rowCount > 3);
    for (const sheet of visible) sheet.eachRow(row => row.eachCell(cell => {
        assert.doesNotMatch(cell.text, /\b[a-f\d]{24,}\b|[A-Za-z][A-Za-z\d]*_[A-Za-z\d_]+|REDUNDANT_REFERENCED|CLEAN/);
        assert.notEqual(cell.protection?.locked, false);
    }));
    const manifest = rows(workbook.getWorksheet('Ταυτοποίηση')).filter(row => row[1] === 'presentationRow').map(row => JSON.parse(row[2]));
    assert.equal(manifest.length, visible[0].rowCount - 3);
    for (const mapping of manifest) {
        assert.equal(workbook.getWorksheet(mapping.sourceSheet).state, 'veryHidden');
        assert.ok(workbook.getWorksheet(mapping.sourceSheet).getRow(mapping.sourceRow).getCell(7).value);
    }
});
test('0015 preserves all 21 question mappings with only 19 answers, two evidence cells and two shared declarations', async () => {
    const result = await build(F.data(), F.catalogs), { workbook } = await reload(result);
    const sheet = workbook.getWorksheet('Στοιχεία προς συμπλήρωση');
    assert.equal(sheet.rowCount, 22);
    const answers = result.editableCells.filter(entry => entry.role === 'ANSWER');
    assert.equal(answers.length, 21);
    assert.equal(answers.filter(entry => /EVIDENCE$/.test(entry.fieldId)).length, 2);
    assert.equal(result.editableCells.filter(entry => entry.role === 'DECLARATION').length, 2);
    assert.equal(new Set(answers.map(entry => entry.sourceRow)).size, 21);
    for (const entry of result.editableCells) {
        assert.equal(workbook.getWorksheet(entry.sourceSheet).state, 'veryHidden');
        assert.equal(workbook.getWorksheet(entry.sourceSheet).getRow(entry.sourceRow).getCell(6).value, entry.fieldId);
    }
    const labels = rows(sheet).flatMap(row => row.slice(1)).filter(Boolean).join('\n');
    assert.doesNotMatch(labels, /507f1f77|RECORDED_PERIOD|INITIAL_TERMS|VALID_FROM|5HMERH|REVIEW_REQUIRED/);
    assert.match(sheet.getCell('C4').text, /25\/05\/2026/);
    for (const row of sheet.getSheetValues().slice(4).filter(Boolean)) assert.ok(row[1] && row[2] && row[3]);
});
test('content heights vary with actual wrapped text and visible OOXML rows allow AutoFit after edits', async () => {
    const { workbook, buffer } = await reload(await build(F.data(), F.catalogs));
    const sheet = workbook.getWorksheet('Στοιχεία προς συμπλήρωση');
    assert.ok(sheet.getRow(4).height > sheet.getRow(5).height);
    assert.equal(sheet.views[0].ySplit, 3);
    sheet.eachRow(row => row.eachCell(cell => {
        assert.equal(cell.alignment.wrapText, true);
        assert.equal(cell.alignment.vertical, 'top');
        if (cell.fill?.fgColor?.argb === 'FFFFF3CD') assert.equal(cell.protection.locked, false);
        if (cell.protection?.locked === false) assert.equal(cell.fill.fgColor.argb, 'FFFFF3CD');
    }));
    assert.equal(sheet.getCell('A3').fill.fgColor.argb, 'FF4F7358');
    assert.equal(sheet.getCell('A3').font.color.argb, 'FFFFFFFF');
    assert.equal(sheet.getCell('A1').fill.fgColor.argb, 'FFD1E7DD');
    assert.equal(sheet.getCell('A4').fill.fgColor.argb, 'FFF8F9FA');
    assert.equal(sheet.getCell('F4').font.color.argb, 'FF664D03');
    const zip = await JSZip.loadAsync(buffer), xml = await zip.file(`xl/worksheets/sheet${sheet.id}.xml`).async('string');
    assert.doesNotMatch(xml, /customHeight="1"|<mergeCell\b/);
    assert.equal((xml.match(/customHeight="0"/g) || []).length, sheet.rowCount);
});
