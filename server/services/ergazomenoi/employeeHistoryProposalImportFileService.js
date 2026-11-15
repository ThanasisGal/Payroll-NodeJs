'use strict';

const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_XML_BYTES = 8 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 30 * 1024 * 1024;
function rejected(reason, statusCode = 422) {
    return Object.assign(new Error(`HISTORY_XLSX_${reason}`), { importReason: reason, statusCode });
}
function cellValue(cell) {
    const value = cell.value;
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) {
        if (!Number.isFinite(value.getTime())) throw rejected('VALUE');
        return value;
    }
    if (typeof value === 'object') {
        // Rich text may be introduced by Calc. Formulas, cached results,
        // hyperlinks and error objects are never evaluated or accepted.
        if (Object.keys(value).every(key => key === 'richText') && Array.isArray(value.richText) &&
            value.richText.every(run => typeof run.text === 'string')) return value.richText.map(run => run.text).join('');
        throw rejected('ACTIVE_CONTENT');
    }
    if (!['string', 'number', 'boolean'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value))
        throw rejected('VALUE');
    return value;
}
async function readImportWorkbook(buffer) {
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_FILE_BYTES) throw rejected('SIZE', 413);
    if (buffer.length < 4 || buffer.readUInt16LE(0) !== 0x4b50) throw rejected('FORMAT');
    try {
        const zip = await JSZip.loadAsync(buffer);
        const entries = Object.values(zip.files).filter(entry => !entry.dir);
        if (entries.length > 256 || !zip.file('[Content_Types].xml') || !zip.file('xl/workbook.xml')) throw rejected('FORMAT');
        let total = 0,cellCount=0;
        for (const entry of entries) {
            if (entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name || /(^|\/)\.\.(\/|$)/.test(entry.name) ||
                /(?:vbaProject|activeX|externalLinks|embeddings)\b/i.test(entry.name)) throw rejected('ACTIVE_CONTENT');
            const size = entry._data?.uncompressedSize;
            if (!Number.isFinite(size) || size > MAX_XML_BYTES || total + size > MAX_EXPANDED_BYTES) throw rejected('SIZE', 413);
            // Check actual expanded bytes too; ZIP directory sizes are untrusted.
            const bytes = await new Promise((resolve, reject) => {
                const chunks = [], stream = entry.nodeStream(); let count = 0;
                stream.on('data', chunk => {
                    count += chunk.length;
                    if (count > MAX_XML_BYTES || total + count > MAX_EXPANDED_BYTES) stream.destroy(rejected('SIZE', 413));
                    else chunks.push(chunk);
                });
                stream.on('error', reject); stream.on('end', () => resolve(Buffer.concat(chunks)));
            });
            total += bytes.length;
            if (/^xl\/worksheets\/[^/]+\.xml$/i.test(entry.name)) {
                cellCount+=(bytes.toString('utf8').match(/<c(?:\s|>)/g)||[]).length;
                if(cellCount>100000)throw rejected('SIZE',413);
            }
            if (/\.(xml|rels)$/i.test(entry.name) && /<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External|macroEnabled/i.test(bytes.toString('utf8')))
                throw rejected('ACTIVE_CONTENT');
            if (/\.xml$/i.test(entry.name)) for (const match of bytes.toString('utf8').matchAll(/<definedName\b[^>]*>([^<]*)<\/definedName>/g))
                if (['(',')','[',']','|','//'].some(token=>match[1].includes(token))) throw rejected('ACTIVE_CONTENT');
        }
        const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
        if (book.worksheets.length > 20) throw rejected('STRUCTURE');
        let inspectedCells=0;
        for (const sheet of book.worksheets) {
            if (sheet.rowCount > 10000 || sheet.columnCount > 32) throw rejected('SIZE', 413);
            inspectedCells+=sheet.rowCount*sheet.columnCount;
            if(inspectedCells>100000)throw rejected('SIZE',413);
            sheet.eachRow(row => row.eachCell(cell => { cellValue(cell); }));
        }
        return book;
    } catch (error) { throw error.importReason ? error : rejected('FORMAT'); }
}
function metadataRows(book) {
    const sheet = book.getWorksheet('Ταυτοποίηση');
    if (!sheet) throw rejected('METADATA');
    sheet.eachRow(row=>row.eachCell(cell=>{if(cell.col>2 && cellValue(cell)!==null)throw rejected('METADATA');}));
    if (cellValue(sheet.getCell('A1')) !== 'Κλειδί' || cellValue(sheet.getCell('B1')) !== 'Τιμή') throw rejected('METADATA');
    const rows = new Map();
    sheet.eachRow(row => {
        if (row.number === 1) return;
        const key = cellValue(row.getCell(1)), value = cellValue(row.getCell(2));
        if (typeof key !== 'string' || typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
            throw rejected('METADATA');
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push(value);
    });
    return rows;
}
function oneMetadata(rows, key, json = false) {
    if (rows.get(key)?.length !== 1) throw rejected('METADATA');
    try { return json ? JSON.parse(rows.get(key)[0]) : rows.get(key)[0]; }
    catch { throw rejected('METADATA'); }
}
function compareProtectedWorkbook(uploaded, baseline, rows, allChoices = []) {
    const expected = baseline.workbook, expectedRows = metadataRows(expected);
    if (!A.equal(uploaded.worksheets.map(sheet => sheet.name).sort(), expected.worksheets.map(sheet => sheet.name).sort()))
        throw rejected('STRUCTURE');
    const allowed = new Set(baseline.editableCells.map(entry => `${entry.sheet}!${entry.cell}`));
    for (const [key, values] of expectedRows) {
        if (key === 'exportId') { oneMetadata(rows, key); continue; }
        if (!A.equal(rows.get(key), values)) throw rejected('PROTECTED');
    }
    for (const key of rows.keys()) if (!expectedRows.has(key) && key !== 'localCompletion') throw rejected('METADATA');
    for (const text of rows.get('localCompletion') || []) {
        let completion;
        try { completion = JSON.parse(text); } catch { throw rejected('METADATA'); }
        const entry = baseline.editableCells.find(entry => entry.cell === completion.cell);
        if (!entry || !A.equal(Object.keys(completion).sort(), ['approval','candidatePeriodId','canonicalField','caseId','cell','confirmed','importEnabled','operation','targetHistoryId','value']) ||
            !A.equal([completion.caseId, completion.operation, completion.targetHistoryId, completion.candidatePeriodId,
                completion.canonicalField, completion.confirmed, completion.approval, completion.importEnabled],
            [entry.caseId, entry.operation, entry.targetHistoryId, entry.candidatePeriodId,
                entry.canonicalField || entry.fieldId, false, false, false])) throw rejected('PROTECTED');
        // completion.value is deliberately NOT used: the visible cell may have
        // been edited afterwards in Calc. It is never a trusted instruction.
    }
    const listValues = new Set();
    expected.getWorksheet('Επιλογές').eachRow(row => listValues.add(cellValue(row.getCell(1))));
    // Browser completion may append filtered dropdown ranges to this source.
    for (const entry of baseline.editableCells) for (const option of entry.options || []) {
        listValues.add(option.label); listValues.add(option.id);
    }
    for (const option of allChoices) {listValues.add(option.label);listValues.add(option.id);}
    listValues.add(null);
    for (const sheet of uploaded.worksheets) {
        if (sheet.name === 'Ταυτοποίηση') continue;
        const original = expected.getWorksheet(sheet.name);
        const originalRows=original.rowCount, maxRows = Math.max(sheet.rowCount, originalRows), maxColumns=Math.max(sheet.columnCount,original.columnCount);
        for (let r = 1; r <= maxRows; r++) for (let c = 1; c <= maxColumns; c++) {
            const cell = sheet.getRow(r).getCell(c), before = original.getRow(r).getCell(c);
            if (allowed.has(`${sheet.name}!${cell.address}`)) continue;
            if (sheet.name === 'Επιλογές' && r > originalRows && c === 1 && listValues.has(cellValue(cell))) continue;
            if (!A.equal(cellValue(cell), cellValue(before))) throw rejected('PROTECTED');
        }
    }
}
module.exports = { MAX_FILE_BYTES, rejected, cellValue, readImportWorkbook, metadataRows, oneMetadata, compareProtectedWorkbook };
