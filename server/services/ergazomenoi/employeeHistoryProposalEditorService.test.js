'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const F = require('../../../test/fixtures/employee0002HistoryProposalFixture');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { startUnifiedPreviewHarness } = require('../../../test/fixtures/employeeHistoryUnifiedPreviewHttpHarness');
const { buildEmployeeHistoryProposalComparisons, PROPOSAL_GROUPS } = require('./employeeHistoryProposalComparisonService');
const { coordinateEmployeeHistorySettlement } = require('./employeeHistorySettlementCoordinatorService');
const { DISPLAY_FIELDS } = require('./employeeHistoryReconstructionPreviewService');
const { editorModel, editorContext, applyLocalCompletion } = require('./employeeHistoryProposalEditorService');
const X = require('./employeeHistoryProposalXlsxService');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
let result, input;
const metadata = (book, key) => book.getWorksheet('Ταυτοποίηση').getSheetValues().slice(2).filter(row => row?.[1] === key).map(row => JSON.parse(row[2]));
const req = { sessionID: 'synthetic-local-xlsx-session', session: { userId: '630000000000000000000001', userTeam: 'THA', companyInUse: '' }, params: {} };
before(async () => { forbidRealSettlementMongo(mock); input = F.employee0002HistoryProposalFixture(); result = await X.buildEmployeeHistoryProposalWorkbook(input, F.catalogs);
    req.params.id = String(input.currentEmployee._id); req.session.companyInUse = input.scope.company_kod; });
after(() => mock.restoreAll());
const body = changes => ({ caseId: result.caseSelection.selectedCase.id, snapshotFingerprint: result.snapshotFingerprint,
    context: editorContext(req, result.snapshotFingerprint, result.caseSelection.selectedCase.id), changes });
const index = field => result.editableCells.findIndex(entry => entry.canonicalField === field);

test('six exact groups retain every field once and preserve source events independently of proposed business values', () => {
    assert.deepEqual(PROPOSAL_GROUPS, ['Χρονικά Στοιχεία', 'Στοιχεία Σύμβασης', 'Στοιχεία Σύμβασης / Ποσά', 'Αποδοχές', 'Κρατήσεις / Ασφάλιση', 'Λοιπά Στοιχεία']);
    const gap = F.employee0002HistoryProposalFixture(); gap.completeHistoryRows[0].eidikothta_symbashs = '01';
    const before = A.stringify(gap), projection = buildEmployeeHistoryProposalComparisons(gap, coordinateEmployeeHistorySettlement(gap));
    for (const item of projection.comparisons) {
        assert.deepEqual([...new Set(item.values.map(value => value.group))], PROPOSAL_GROUPS);
        assert.equal(new Set(item.values.map(value => value.field)).size, item.values.length);
        for (const field of DISPLAY_FIELDS) assert.equal(item.values.filter(value => value.field === field).length, 1, field);
        const event = item.values.find(value => value.field === 'hmeromhnia_allaghs_symbashs');
        assert.equal(event.after, null); assert.equal(event.displayAfter, item.original.hmeromhnia_allaghs_symbashs);
        assert.equal(event.displayOnly, true); assert.equal(event.editable, false); assert.equal(item.candidate.hmeromhnia_allaghs_symbashs, null);
    }
    const model = editorModel(result);
    assert.deepEqual(model.rows.filter(row => row.kind === 'group').map(row => row.title), PROPOSAL_GROUPS);
    assert.equal(A.stringify(gap), before);
});
test('fixed equal heights, explicit OOXML customHeight, no cell notes/popups, and concise protected provenance survive serialization', async () => {
    const buffer = await X.serializeEmployeeHistoryProposalWorkbook(result.workbook), book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
    const sheet = book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ'), fields = metadata(book, 'comparisonField');
    assert.equal(new Set(fields.map(field => sheet.getRow(field.row).height)).size, 1);
    assert.ok(sheet.getRow(fields[0].row).height >= 56);
    const zip = await JSZip.loadAsync(buffer), xml = await zip.file(`xl/worksheets/sheet${sheet.id}.xml`).async('string');
    for (const field of fields) {
        const row = xml.match(new RegExp(`<row r="${field.row}"[^>]*>`))[0]; assert.match(row, /customHeight="1"/);
        assert.equal(sheet.getCell(field.cell).note, undefined); assert.equal(sheet.getCell(field.cell).alignment.horizontal, 'left');
    }
    for (const entry of result.editableCells) {
        const validation = sheet.getCell(entry.cell).dataValidation;
        assert.notEqual(validation.showInputMessage, true); assert.equal(validation.showErrorMessage, true);
    }
    const provenance = book.getWorksheet('Προέλευση και εκκρεμότητες'); assert.equal(provenance.state, 'visible'); assert.equal(provenance.sheetProtection.sheet, true);
    assert.doesNotMatch(provenance.getSheetValues().flat().join(' '), /[a-f\d]{24,}|fingerprint|hmeromhnia_/);
    const recorded = fields.find(field => field.canonicalField === 'nomimosMisthos');
    assert.equal(editorModel(result).attention.some(row => row[1] === sheet.getCell(`A${recorded.row}`).text), false);
});
test('local completion validates allowlist, types, choices, duplicates, scope and snapshot before touching any workbook cell', () => {
    const original = result.workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(result.editableCells[index('nomimosMisthos')].cell).value;
    for (const changes of [ [{ index: -1, value: 'forged' }], [{ index: 9999, value: 'forged' }],
        [{ index: index('nomimosMisthos'), value: '123,4.5' }], [{ index: index('nomimosMisthos'), value: -1 }],
        [{ index: index('hmeres_ergasias_ebdomadas'), value: 2.5 }],
        [{ index: index('hmnia_enarxhs_egkekrimenhs_rythmishs'), value: '2026-02-30' }],
        [{ index: index('typos_orarioy'), value: '999' }], [{ index: index('hmeres_efarmoghs_egkekrimenhs_rythmishs'), value: [0, 8] }],
        [{ index: index('nomimosMisthos'), value: 5 }, { index: index('nomimosMisthos'), value: 6 }] ])
        assert.throws(() => applyLocalCompletion(result, body(changes), req), { statusCode: 400 });
    assert.throws(() => applyLocalCompletion(result, { ...body([]), snapshotFingerprint: 'stale', context: editorContext(req, 'stale', result.caseSelection.selectedCase.id) }, req), { statusCode: 409 });
    assert.throws(() => applyLocalCompletion(result, body([]), { ...req, session: { ...req.session, userTeam: 'ANOTHER' } }), { statusCode: 403 });
    assert.throws(() => applyLocalCompletion(result, body([]), { ...req, sessionID: 'another-session' }), { statusCode: 403 });
    assert.equal(result.workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(result.editableCells[index('nomimosMisthos')].cell).value, original);
});
test('HTTP editor and completed download reauthorize, reject stale sources with 409 and never write or approve History', async () => {
    const catalogs = structuredClone(F.catalogs);
    const h = await startUnifiedPreviewHarness({ data: input, catalogs });
    const prefix = `${h.origin}/api/ergazomenoi/${h.state.currentEmployee._id}`;
    const post = payload => fetch(`${prefix}/history-proposal.xlsx`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    try {
        const before = A.stringify(h.state), response = await fetch(`${prefix}/history-proposal-editor`), html = await response.text();
        assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.match(html, /Αποθήκευση XLSX στον υπολογιστή/); assert.doesNotMatch(html, /sourceHistoryId|rawProposed|canonicalField/);
        const saved = await post(body([{ index: index('nomimosMisthos'), value: 1234.56 }])); assert.equal(saved.status, 200);
        const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await saved.arrayBuffer()));
        assert.equal(book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(result.editableCells[index('nomimosMisthos')].cell).value, 1234.56);
        assert.equal(metadata(book, 'localCompletion')[0].approval, false);
        assert.equal(book.getWorksheet('Ταυτοποίηση').getSheetValues().some(row => row?.[1] === 'proposalStatus' && row[2] === 'REVIEW_REQUIRED'), true);
        assert.equal(A.stringify(h.state), before); assert.equal(h.counts.applyRequests, 0);
        for (const mutate of [() => h.state.currentEmployee.updatedAt = '2026-11-15', () => h.state.completeHistoryRows[0].nomimosMisthos++,
            () => h.state.protectedReferenceSummary[String(h.state.completeHistoryRows[0]._id)].push({ collection: 'synthetic-new-reference' }),
            () => catalogs.CONTRACT_TYPE[0].label = 'Νέα συνθετική περιγραφή']) {
            mutate(); const changed = A.stringify(h.state), stale = await post(body([])); assert.equal(stale.status, 409);
            assert.match((await stale.json()).message, /Δεν αποθηκεύτηκε καμία αλλαγή/); assert.equal(A.stringify(h.state), changed);
        }
        h.access.read = false; assert.equal((await post(body([]))).status, 403);
        h.access.authenticated = false; assert.equal((await fetch(`${prefix}/history-proposal-editor`)).status, 401);
    } finally { await h.close(); }
});

test('edited catalog children are checked against edited parents and matching dropdowns reach the local workbook', async () => {
    const catalogs = structuredClone(F.catalogs);
    catalogs.CONTRACT_TYPE.push({ code: '02', label: 'Άλλη συνθετική σύμβαση' });
    catalogs.CONTRACT_CATEGORY.push({ code: '02', label: 'Άλλη κατηγορία', afora_thn_symbash: '02' });
    catalogs.CONTRACT_CATEGORY.push({ code: '01', label: 'Ίδιος κωδικός σε άλλη σύμβαση', afora_thn_symbash: '02' });
    const alternate = structuredClone(input);
    for (const row of [alternate.currentEmployee, ...alternate.completeHistoryRows]) row.symbash = '02';
    const alternateModel = editorModel(await X.buildEmployeeHistoryProposalWorkbook(alternate, catalogs), catalogs);
    const category = alternateModel.rows.find(row => row.control?.catalog === 'CONTRACT_CATEGORY').control;
    assert.equal(category.options.find(option => option.value === category.value).label, '01 - Ίδιος κωδικός σε άλλη σύμβαση');
    const fresh = await X.buildEmployeeHistoryProposalWorkbook(input, catalogs);
    const parent = fresh.editableCells.findIndex(entry => entry.canonicalField === 'symbash');
    const child = fresh.editableCells.findIndex(entry => entry.canonicalField === 'kathgoria_symbashs');
    const payload = changes => ({ caseId: fresh.caseSelection.selectedCase.id, snapshotFingerprint: fresh.snapshotFingerprint,
        context: editorContext(req, fresh.snapshotFingerprint, fresh.caseSelection.selectedCase.id), changes });
    assert.throws(() => applyLocalCompletion(fresh, payload([{ index: child, value: '1' }]), req, catalogs), { statusCode: 400 });
    applyLocalCompletion(fresh, payload([{ index: parent, value: '1' }, { index: child, value: '1' }]), req, catalogs);
    const cell = fresh.workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(fresh.editableCells[child].cell);
    assert.equal(cell.value, '02 - Άλλη κατηγορία'); assert.equal(cell.dataValidation.type, 'list');
    const range = fresh.workbook.definedNames.getRanges(cell.dataValidation.formulae[0]).ranges[0];
    const row = Number(range.match(/\$A\$(\d+)/)[1]);
    assert.equal(fresh.workbook.getWorksheet('Επιλογές').getRow(row).getCell(1).value, cell.value);
});

test('χειροκίνητη επιλογή μέσω HTTP επαληθεύει ξανά στόχο, εταιρεία και συνεδρία, χωρίς εγγραφή ή αποδοχή άλλης περίπτωσης', async () => {
    const data=F.employee0002HistoryProposalFixture(), h=await startUnifiedPreviewHarness({data,catalogs:F.catalogs});
    const prefix=`${h.origin}/api/ergazomenoi/${h.state.currentEmployee._id}`;
    const selection=`UPDATE:${h.state.completeHistoryRows.at(-1)._id}`;
    const local=await X.buildEmployeeHistoryProposalWorkbook(data,F.catalogs,{selection});
    const localReq={...req,session:{...req.session,companyInUse:data.scope.company_kod},params:{id:String(data.currentEmployee._id)}};
    const payload={caseId:local.caseSelection.selectedCase.id,snapshotFingerprint:local.snapshotFingerprint,
        context:editorContext(localReq,local.snapshotFingerprint,local.caseSelection.selectedCase.id),changes:[]};
    const post=(chosen,body=payload)=>fetch(`${prefix}/history-proposal.xlsx?selection=${encodeURIComponent(chosen)}`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    try {
        const before=A.stringify(h.state), page=await fetch(`${prefix}/history-proposal-editor?selection=${encodeURIComponent(selection)}`);
        const html=await page.text(); assert.equal(page.status,200); assert.match(html,/Διόρθωση υπάρχουσας ιστορικής εγγραφής/);
        assert.match(html,/UPDATE/); assert.match(html,/proposalSelectionWarning/);
        const response=await post(selection); assert.equal(response.status,200);
        const header=response.headers.get('content-disposition');
        assert.equal(decodeURIComponent(header.match(/filename\*=UTF-8''([^;]+)/i)[1]),local.filename);
        assert.ok(h.counts.selections.includes('_id kod'));
        assert.equal((await post(`UPDATE:${data.completeHistoryRows[0]._id}`)).status,409);
        assert.equal((await post('UPDATE:630000000000000000000999')).status,404);
        assert.equal((await post(['UPDATE:630000000000000000000999'])).status,404);
        assert.equal((await post(selection,{...payload,targetHistoryId:data.completeHistoryRows[0]._id})).status,400);
        h.access.company='610000000000000000000099'; assert.equal((await post(selection)).status,404); delete h.access.company;
        h.access.team='ANOTHER'; assert.equal((await post(selection)).status,404); delete h.access.team;
        h.access.read=false; assert.equal((await post(selection)).status,403); h.access.read=true;
        assert.equal(A.stringify(h.state),before); assert.equal(h.counts.applyRequests,0);
    } finally {await h.close();}
});
