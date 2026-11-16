'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const ejs = require('ejs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { forbidRealSettlementMongo } = require('../../../test/fixtures/forbidRealSettlementMongo');
const { buildCompleteProfileSnapshot } = require('../../utils/ergazomenoi/employmentProfileHistory');
const { coordinateEmployeeHistorySettlement } = require('./employeeHistorySettlementCoordinatorService');
const { inspectEmployeeHistorySave } = require('./employeeHistorySaveValidationService');
const { selectEmployeeHistoryProposalCase } = require('./employeeHistoryProposalCaseService');
const { buildEmployeeHistoryProposalComparisons, PROPOSAL_GROUPS } = require('./employeeHistoryProposalComparisonService');
const { editorModel, editorContext, applyLocalCompletion } = require('./employeeHistoryProposalEditorService');
const X = require('./employeeHistoryProposalXlsxService');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const { employeeHistoryProposalFilename } = require('./employeeHistoryProposalFilenameService');
const catalogs = require('../../../test/fixtures/employee0002HistoryProposalFixture').catalogs;
before(() => forbidRealSettlementMongo(mock)); after(() => mock.restoreAll());
function fixture(count = 3) {
    const scope = { team: 'SYNTHETIC', company_kod: '610000000000000000000001', kodikos: '0099' };
    const starts = ['2026-01-01', '2026-04-01', '2026-06-01'], ends = ['2026-03-31', '2026-05-31'];
    const facts = { ...scope, hmeromhnia_proslhpshs: starts[0], hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8, kathestos_apasxolhshs: '0', typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH',
        krathsh_01: '0101', symbash: '01', kathgoria_symbashs: '01', eidikothta_symbashs: '01',
        nomimosMisthos: 1200, pragmatikosMisthos: 1300, synolo_symbashs: 1300,
        evelikth_proselefsh: 0, symbatikes_ores_ergasias: 40, dialleima_se_lepta: 0, energos: true, oristikh_enhmerosh: true };
    const completeHistoryRows = starts.slice(0, count).map((from, i) => ({
        ...buildCompleteProfileSnapshot({ current: { ...facts, pragmatikosMisthos: 1300 + i * 100 }, effectiveFrom: from }),
        ...scope, _id: `62000000000000000000000${i + 1}`, aa_eggrafhs: `000${i + 1}`, afora_proslhpsh: i === 0,
        [C.CHANGE]: from, ...(i + 1 < count ? { [C.END]: ends[i] } : {}) }));
    const currentEmployee = { ...facts, ...completeHistoryRows.at(-1), _id: '620000000000000000000900' };
    return { scope, currentEmployee, completeHistoryRows, protectedReferenceSummary: Object.fromEntries(completeHistoryRows.map(row => [row._id, []])) };
}
const select = data => selectEmployeeHistoryProposalCase(data, coordinateEmployeeHistorySettlement(data, { catalogs }));
const metadata = (result, key) => result.workbook.getWorksheet('Ταυτοποίηση').getSheetValues().filter(row => row?.[1] === key).map(row => JSON.parse(row[2]));
const reqFor = data => ({ sessionID: 'synthetic-case-session', session: { userId: 'synthetic-user', userTeam: data.scope.team,
    companyInUse: data.scope.company_kod }, params: { id: data.currentEmployee._id } });
const payload = (result, req, changes, caseId = result.caseSelection.selectedCase.id) => ({ caseId,
    snapshotFingerprint: result.snapshotFingerprint, context: editorContext(req, result.snapshotFingerprint, caseId), changes });

test('χειροκίνητο UPDATE επιλέγει πραγματική εγγραφή ακόμη και χωρίς εύρημα, με πλήρη ΠΡΙΝ/ΜΕΤΑ και προστατευμένο κύκλο', async () => {
    for (const count of [1, 3]) {
        const data = fixture(count), original = data.completeHistoryRows.at(-1), before = A.stringify(data);
        const result = await X.buildEmployeeHistoryProposalWorkbook(data, catalogs, { selection: `UPDATE:${original._id}` });
        const fields = metadata(result, 'comparisonField');
        assert.equal(result.caseSelection.selectedCase.targetHistoryId, original._id);
        assert.equal(result.caseSelection.selectedCase.operation, 'UPDATE');
        assert.equal(result.caseSelection.selectedCase.candidatePeriodId, null);
        assert.equal(result.caseSelection.historyStatus, 'REVIEW_REQUIRED');
        for (const field of [C.CHANGE, C.START, C.END, C.CONTRACT_END, 'hmeromhnia_allaghs_orarioy_apo']) {
            const entry = fields.find(entry => entry.canonicalField === field);
            assert.equal(entry.editable, true, field);
            assert.equal(JSON.stringify(entry.rawProposed), JSON.stringify(original[field] ?? null));
        }
        for (const field of [C.HIRE, C.DEPARTURE, 'afora_proslhpsh', 'aa_eggrafhs'])
            assert.equal(fields.find(entry => entry.canonicalField === field).editable, false, field);
        assert.ok(result.editableCells.every(entry => entry.targetHistoryId === original._id));
        assert.ok(!result.editableCells.some(entry => C.FIELD_GROUPS.IDENTITY_PROTECTED.includes(entry.canonicalField)));
        const dateIndex = result.editableCells.findIndex(entry => entry.canonicalField === C.CHANGE), req = reqFor(data);
        applyLocalCompletion(result, payload(result, req, [{ index: dateIndex, value: '2026-02-03' }]), req, catalogs);
        assert.equal(metadata(result, 'localCompletion')[0].value, '2026-02-03');
        assert.equal(A.stringify(data), before);
        assert.throws(() => applyLocalCompletion(result, payload(result, req, [{index:dateIndex,value:'2026-02-03',targetHistoryId:'forged'}]), req, catalogs), { statusCode: 400 });
    }
});

test('η επιλογή UPDATE διατηρεί όλες τις εκκρεμότητες και απορρίπτει ξένη εγγραφή ή παρωχημένη πρόταση INSERT', async () => {
    const data = fixture(); data.completeHistoryRows.splice(1, 1);
    const automatic = await X.buildEmployeeHistoryProposalWorkbook(data, catalogs), before = A.stringify(data);
    const manual = await X.buildEmployeeHistoryProposalWorkbook(data, catalogs, { selection: `UPDATE:${data.completeHistoryRows.at(-1)._id}` });
    for (const item of automatic.caseSelection.cases) assert.ok(manual.caseSelection.cases.some(other => other.id === item.id));
    assert.equal(manual.caseSelection.historyStatus, 'REVIEW_REQUIRED');
    assert.equal(A.stringify(data), before);
    await assert.rejects(X.buildEmployeeHistoryProposalWorkbook(data, catalogs, { selection:'UPDATE:630000000000000000000999' }), {statusCode:404});
    const foreign = structuredClone(data); foreign.completeHistoryRows.at(-1).company_kod = '610000000000000000000099';
    await assert.rejects(X.buildEmployeeHistoryProposalWorkbook(foreign, catalogs, { selection:`UPDATE:${foreign.completeHistoryRows.at(-1)._id}` }), {statusCode:404});
    const updated = structuredClone(data); updated.completeHistoryRows[0][C.END] = '2026-04-10';
    await assert.rejects(X.buildEmployeeHistoryProposalWorkbook(updated, catalogs, { selection:`INSERT:${automatic.caseSelection.selectedCase.id}` }), {statusCode:409});
    const refreshed = await X.buildEmployeeHistoryProposalWorkbook(updated, catalogs);
    const req = reqFor(data);
    assert.throws(() => applyLocalCompletion(refreshed, payload(automatic, req, []), req, catalogs), {statusCode:409});
});

test('οι τύποι 0/1/2 έχουν κοινές επιλογές, ο 5 δεν διατηρείται και δεν μετατρέπεται χωρίς τεκμήριο ή επιλογή', async () => {
    for (const canonical of ['0', '1', '2', null]) {
        const data = fixture(1), row = data.completeHistoryRows[0];
        row.typos_apasxolhshs = '5'; row.kathestos_apasxolhshs = canonical;
        const before = A.stringify(data), req = reqFor(data);
        const result = await X.buildEmployeeHistoryProposalWorkbook(data, catalogs, { selection:`UPDATE:${row._id}` });
        assert.ok(result.workbook, canonical);
        const index = result.editableCells.findIndex(entry => entry.canonicalField === 'typos_apasxolhshs');
        const entry = result.editableCells[index], model = editorModel(result, catalogs);
        assert.deepEqual(entry.options.map(option => option.id), ['0','1','2']);
        assert.equal(entry.rawBefore, '5'); assert.equal(entry.rawProposed, canonical);
        const shown = model.rows.find(row => row.control?.index === index);
        assert.match(shown.before, /^5.*χρειάζεται έλεγχος/); assert.equal(shown.control.value, '');
        assert.equal(shown.control.required, true);
        assert.throws(() => applyLocalCompletion(result, payload(result, req, []), req, catalogs), {statusCode:400});
        assert.throws(() => applyLocalCompletion(result, payload(result, req, [{index,value:'5'}]), req, catalogs), {statusCode:400});
        const changes = [{index,value:canonical || '2'}];
        if (canonical === null) changes.push({index:result.editableCells.findIndex(entry=>entry.canonicalField==='kathestos_apasxolhshs'),value:'2'});
        applyLocalCompletion(result, payload(result, req, changes), req, catalogs);
        const cell = result.workbook.getWorksheet(entry.sheet).getCell(entry.cell);
        assert.equal(cell.value, canonical || '2');
        const range = result.workbook.definedNames.getRanges(cell.dataValidation.formulae[0]).ranges[0];
        const numbers = [...range.matchAll(/\$A\$(\d+)/g)].map(match=>Number(match[1]));
        assert.deepEqual(Array.from({length:numbers[1]-numbers[0]+1},(_,i)=>result.workbook.getWorksheet('Επιλογές').getCell(`A${numbers[0]+i}`).value), ['0','1','2']);
        assert.equal(A.stringify(data), before);
    }
});

test('ειδική κατηγορία: κοινός κατάλογος, αρχικά μηδενικά, ασφαλής κενή τιμή και απόρριψη αποσυρμένου κωδικού', async () => {
    for (const original of ['0004', '9999', null]) {
        const data = fixture(1); data.completeHistoryRows[0].eidikh_kathgoria_ergazomenoy = original;
        const result = await X.buildEmployeeHistoryProposalWorkbook(data, catalogs, {selection:`UPDATE:${data.completeHistoryRows[0]._id}`});
        const index = result.editableCells.findIndex(entry=>entry.canonicalField==='eidikh_kathgoria_ergazomenoy');
        const entry = result.editableCells[index], control = editorModel(result,catalogs).rows.find(row=>row.control?.index===index).control;
        assert.equal(entry.catalog,'SPECIAL_EMPLOYEE_CATEGORY');
        assert.deepEqual(control.options.map(option=>option.code),catalogs.SPECIAL_EMPLOYEE_CATEGORY.map(option=>option.code));
        if (original === '9999') {
            assert.equal(entry.rawProposed,null); assert.equal(control.required,true); assert.equal(control.value,'');
            assert.match(control.message,/δεν υπάρχει/);
            assert.throws(()=>applyLocalCompletion(result,payload(result,reqFor(data),[]),reqFor(data),catalogs),{statusCode:400});
        } else assert.equal(entry.rawProposed,original);
        assert.throws(()=>applyLocalCompletion(result,payload(result,reqFor(data),[{index,value:'9999'}]),reqFor(data),catalogs),{statusCode:400});
        applyLocalCompletion(result,payload(result,reqFor(data),[{index,value:'0'}]),reqFor(data),catalogs);
        const cell=result.workbook.getWorksheet(entry.sheet).getCell(entry.cell);
        assert.equal(cell.value,'0001 - Συνθετική βασική κατηγορία'); assert.equal(cell.numFmt,'@');
        const range=result.workbook.definedNames.getRanges(cell.dataValidation.formulae[0]).ranges[0];
        const start=Number(range.match(/\$A\$(\d+)/)[1]);
        assert.equal(result.workbook.getWorksheet('Επιλογές').getCell(`A${start}`).value,cell.value);
        assert.equal(metadata(result,'localCompletion')[0].value,'0001');
    }
    const data=fixture(1); data.completeHistoryRows[0].eidikh_kathgoria_ergazomenoy='0001';
    const emptyCatalog={...catalogs,SPECIAL_EMPLOYEE_CATEGORY:[]};
    const empty=await X.buildEmployeeHistoryProposalWorkbook(data,emptyCatalog,{selection:`UPDATE:${data.completeHistoryRows[0]._id}`});
    const entry=empty.editableCells.find(entry=>entry.canonicalField==='eidikh_kathgoria_ergazomenoy');
    assert.equal(entry.selectionRequired,true); assert.equal(entry.rawProposed,null);
    assert.equal(empty.workbook.getWorksheet(entry.sheet).getCell(entry.cell).dataValidation.type,'list');
    assert.throws(()=>applyLocalCompletion(empty,payload(empty,reqFor(data),[]),reqFor(data),emptyCatalog),{statusCode:400});
});

test('περιγραφικά ονόματα UPDATE/INSERT, χωρίς προσωπικά δεδομένα ή τεχνικές ταυτότητες, με όριο μήκους', async () => {
    const data=fixture(); data.companyBusinessCode='0003'; data.currentEmployee.ypokatasthma='0000';
    data.scope.team='THA'; data.scope.kodikos='0002';
    for(const row of [data.currentEmployee,...data.completeHistoryRows])Object.assign(row,data.scope);
    const update=await X.buildEmployeeHistoryProposalWorkbook(data,catalogs,{selection:`UPDATE:${data.completeHistoryRows[0]._id}`});
    assert.equal(update.filename,'THA_0003_0002_0000_ΙΣΤ0001_UPDATE_Διόρθωση_Εγγραφής_2026-01-01.xlsx');
    data.completeHistoryRows.splice(1,1);
    const insert=await X.buildEmployeeHistoryProposalWorkbook(data,catalogs);
    assert.equal(insert.filename,'THA_0003_0002_0000_INSERT_Ελλείπουσα_Περίοδος_2026-04-01_2026-05-31.xlsx');
    const incomplete={...data,companyBusinessCode:data.scope.company_kod,currentEmployee:{...data.currentEmployee,ypokatasthma:null}};
    const name=employeeHistoryProposalFilename(incomplete,insert.caseSelection.selectedCase);
    assert.ok(!name.includes(data.scope.company_kod)); assert.ok(!name.includes('0003'));
    const unsafe={...data,scope:{...data.scope,team:'CON/../:*?"<>|'.repeat(30)},companyBusinessCode:'NUL'};
    const safe=employeeHistoryProposalFilename(unsafe,insert.caseSelection.selectedCase);
    assert.doesNotMatch(safe,/[\x00-\x1f/\\:*?"<>|]/); assert.ok(Buffer.byteLength(safe)<=225);
});

test('one oldest case from several real row discrepancies is deterministic and alone in workbook/editor', async () => {
    const data = fixture(); delete data.completeHistoryRows[0].krathsh_01; delete data.completeHistoryRows[1].symbash;
    data.currentEmployee.pragmatikosMisthos = 9999;
    const before = A.stringify(data), chosen = select(data);
    assert.ok(chosen.total >= 3); assert.equal(chosen.selectedCase.targetHistoryId, data.completeHistoryRows[0]._id);
    const reversed = { ...data, completeHistoryRows: [...data.completeHistoryRows].reverse() };
    assert.equal(select(reversed).selectedCase.id, chosen.selectedCase.id);
    const result = await X.buildEmployeeHistoryProposalWorkbook(data, catalogs), mappings = metadata(result, 'comparisonField');
    assert.equal(new Set(mappings.map(field => field.caseId)).size, 1);
    assert.equal(new Set(mappings.map(field => field.comparisonId)).size, 1);
    assert.ok(mappings.every(field => field.targetHistoryId === data.completeHistoryRows[0]._id));
    const model = editorModel(result, catalogs); assert.match(model.title, /Περίπτωση 1 από/);
    assert.deepEqual(model.rows.filter(row => row.kind === 'group').map(row => row.title), PROPOSAL_GROUPS);
    assert.equal(model.rows.filter(row => row.kind === 'period').length, 1);
    assert.equal(metadata(result, 'pendingCases')[0].length, chosen.total);
    assert.equal(result.caseSelection.historyStatus, 'REVIEW_REQUIRED'); assert.equal(A.stringify(data), before);
    const overlaps = fixture(), fourth = { ...overlaps.completeHistoryRows[2], _id: '620000000000000000000004',
        aa_eggrafhs: '0004', [C.START]: '2026-09-01', [C.CHANGE]: '2026-09-01' };
    overlaps.completeHistoryRows.push(fourth);
    overlaps.currentEmployee = { ...fourth, _id: overlaps.currentEmployee._id };
    overlaps.protectedReferenceSummary[fourth._id] = [];
    overlaps.completeHistoryRows[0][C.END] = '2026-04-15';
    overlaps.completeHistoryRows[2][C.END] = '2026-09-15';
    const conflicts = select(overlaps);
    assert.ok(conflicts.cases.filter(item => item.operation === 'REVIEW_REQUIRED').length >= 2);
    assert.equal(conflicts.selectedCase.existingHistoryId, overlaps.completeHistoryRows[0]._id);
});
test('last history row is the UPDATE target without a following row or invented period identity', async () => {
    const data = fixture(); delete data.completeHistoryRows.at(-1).krathsh_01;
    const result = await X.buildEmployeeHistoryProposalWorkbook(data, catalogs), chosen = result.caseSelection.selectedCase;
    assert.equal(chosen.operation, 'UPDATE'); assert.equal(chosen.targetHistoryId, data.completeHistoryRows.at(-1)._id);
    assert.equal(chosen.candidatePeriodId, null); assert.equal(chosen.period.to, null);
    const item = buildEmployeeHistoryProposalComparisons(data, coordinateEmployeeHistorySettlement(data)).comparisons[0];
    assert.equal(item.original._id, chosen.targetHistoryId); assert.equal(item.next, null);
    assert.ok(metadata(result, 'comparisonField').every(field => field.previousHistoryId === chosen.targetHistoryId));
});
test('a sole problematic row produces one UPDATE case rather than a fabricated insertion', async () => {
    const data = fixture(1); delete data.completeHistoryRows[0].symbash;
    const result = await X.buildEmployeeHistoryProposalWorkbook(data, catalogs), chosen = result.caseSelection.selectedCase;
    assert.equal(result.caseSelection.total, 1); assert.equal(chosen.operation, 'UPDATE');
    assert.equal(chosen.existingHistoryId, data.completeHistoryRows[0]._id); assert.equal(chosen.candidatePeriodId, null);
});
test('a missing middle period has a distinct INSERT candidate identity and only its recorded gap bounds', async () => {
    const data = fixture(); data.completeHistoryRows.splice(1, 1);
    const result = await X.buildEmployeeHistoryProposalWorkbook(data, catalogs), chosen = result.caseSelection.selectedCase;
    assert.equal(chosen.operation, 'INSERT'); assert.equal(chosen.targetHistoryId, null); assert.equal(chosen.existingHistoryId, null);
    assert.ok(chosen.candidatePeriodId.startsWith('candidate-period-'));
    assert.equal(chosen.period.from, '2026-04-01'); assert.equal(chosen.period.to, '2026-05-31');
    assert.ok(!data.completeHistoryRows.some(row => row._id === chosen.candidatePeriodId));
    const event = metadata(result, 'comparisonField').find(field => field.canonicalField === C.CHANGE);
    assert.equal(event.rawProposed, null); assert.equal(event.displayOnly, true); assert.equal(event.editable, false);
    assert.equal(event.caseId, chosen.id);
});
test('overlap stays REVIEW_REQUIRED; unidentified scope shows diagnostics; clean history has no full workbook', async () => {
    const overlap = fixture(); overlap.completeHistoryRows[0][C.END] = '2026-04-15';
    const ambiguous = await X.buildEmployeeHistoryProposalWorkbook(overlap, catalogs);
    assert.equal(ambiguous.caseSelection.selectedCase.operation, 'REVIEW_REQUIRED');
    assert.equal(new Set(metadata(ambiguous, 'comparisonField').map(field => field.caseId)).size, 1);
    const unknown = fixture(); unknown.protectedReferenceSummary = {};
    const blocked = await X.buildEmployeeHistoryProposalWorkbook(unknown, catalogs);
    assert.equal(blocked.workbook, null); assert.equal(blocked.caseSelection.historyStatus, 'REVIEW_REQUIRED');
    assert.match(editorModel(blocked).message, /δεν μπορεί να προσδιοριστεί με ασφάλεια/);
    const invalid = fixture(1); invalid.completeHistoryRows[0][C.START] = '2026-02-30';
    const invalidResult = await X.buildEmployeeHistoryProposalWorkbook(invalid, catalogs);
    assert.equal(invalidResult.workbook, null); assert.equal(invalidResult.caseSelection.historyStatus, 'REVIEW_REQUIRED');
    assert.match(editorModel(invalidResult).message, /δεν έχουν έγκυρη μορφή/);
    const clean = fixture(); assert.equal(inspectEmployeeHistorySave({ scope: clean.scope, currentEmployee: clean.currentEmployee, historyRows: clean.completeHistoryRows }).status, 'CLEAN');
    const complete = await X.buildEmployeeHistoryProposalWorkbook(clean, catalogs);
    assert.equal(complete.workbook, null); assert.equal(complete.caseSelection.status, 'NO_CORRECTION');
    assert.equal(editorModel(complete).message, 'Δεν απαιτείται διόρθωση');
});
test('AFTER edits bind the selected case and source snapshot; a fresh read selects the next pending row', async () => {
    const data = fixture(); delete data.completeHistoryRows[0].krathsh_01; delete data.completeHistoryRows[1].symbash;
    const result = await X.buildEmployeeHistoryProposalWorkbook(data, catalogs), req = reqFor(data);
    const index = result.editableCells.findIndex(field => field.canonicalField === 'nomimosMisthos');
    const body = payload(result, req, [{ index, value: '1234,56' }]);
    assert.throws(() => applyLocalCompletion(result, payload(result, req, [], result.caseSelection.cases[1].id), req, catalogs), { statusCode: 409 });
    const before = A.stringify(data); applyLocalCompletion(result, body, req, catalogs);
    const completion = metadata(result, 'localCompletion')[0]; assert.equal(completion.caseId, body.caseId);
    assert.equal(completion.targetHistoryId, data.completeHistoryRows[0]._id); assert.equal(completion.confirmed, false);
    assert.equal(completion.approval, false); assert.equal(A.stringify(data), before);
    // Pure synthetic re-read after a hypothetical authorized correction, never a database write.
    const next = structuredClone(data); next.completeHistoryRows[0].krathsh_01 = '0101';
    const refreshed = await X.buildEmployeeHistoryProposalWorkbook(next, catalogs);
    assert.equal(refreshed.caseSelection.selectedCase.targetHistoryId, next.completeHistoryRows[1]._id);
    assert.throws(() => applyLocalCompletion(refreshed, body, req, catalogs), { statusCode: 409 });
});
test('dot/comma decimal inputs become the same numeric XLSX value while malformed formats, ranges and fractions of integers fail', async () => {
    const data = fixture(1); delete data.completeHistoryRows[0].krathsh_01;
    const result = await X.buildEmployeeHistoryProposalWorkbook(data, catalogs), req = reqFor(data);
    const index = result.editableCells.findIndex(field => field.canonicalField === 'nomimosMisthos');
    const cell = result.workbook.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(result.editableCells[index].cell);
    for (const value of ['1234.56', '1234,56', 1234.56]) {
        applyLocalCompletion(result, payload(result, req, [{ index, value }]), req, catalogs); assert.equal(cell.value, 1234.56);
    }
    for (const value of ['1.234,56', '1,234.56', '1.2.3', '1e3', 'NaN', '0x10', ' 1234,56 ', '-1', '10000000000000'])
        assert.throws(() => applyLocalCompletion(result, payload(result, req, [{ index, value }]), req, catalogs), { statusCode: 400 });
    const days = result.editableCells.findIndex(field => field.canonicalField === 'hmeres_ergasias_ebdomadas');
    assert.throws(() => applyLocalCompletion(result, payload(result, req, [{ index: days, value: '2,5' }]), req, catalogs), { statusCode: 400 });
    const book = new ExcelJS.Workbook(); await book.xlsx.load(await X.serializeEmployeeHistoryProposalWorkbook(result.workbook));
    assert.equal(book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(cell.address).value, 1234.56);
    assert.match(book.getWorksheet('ΠΡΙΝ - ΜΕΤΑ').getCell(cell.address).numFmt, /408/);
    const html = await ejs.renderFile(path.resolve(__dirname, '../../../views/ergazomenoi/ergazomenoi/historyProposalEditor.ejs'), {
        model: editorModel(result, catalogs), csrfToken: 'synthetic', snapshotFingerprint: result.snapshotFingerprint,
        editorContext: bodyContext(), selectionUrl: '/synthetic-editor', exportUrl: '/synthetic.xlsx' });
    function bodyContext() { return editorContext(req, result.snapshotFingerprint, result.caseSelection.selectedCase.id); }
    assert.match(html, /type="text"[\s\S]*?inputmode="decimal"/); assert.match(html, /data-case-id="history-case-/);
    const template = 'views/ergazomenoi/ergazomenoi/historyProposalEditor.ejs';
    const inventoryHtml = await ejs.renderFile(path.resolve(__dirname, '../../../', template),
        require('../../../test/fixtures/responsiveForms').dataFor(template));
    assert.match(inventoryHtml, /historyProposalEditor/);
});
