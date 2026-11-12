'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const service = require('./apasxoliseisEmploymentReviewReportService');
const { reviewTotalsRow, legacyReviewTotalsRow, reviewTotalsFixture } = require('../../../test/fixtures/employmentReviewTotalsFixture');
const project = service.buildEmploymentReviewReportProjection;

test('verified history retains the recorded daily and employee numbers', () => {
    const report = project({ rows: [reviewTotalsRow()] });
    assert.equal(report.daily[0].values.ores_pragmatikhs_ergasias_apologistika, 8);
    assert.equal(report.employees[0].totals.ores_pragmatikhs_ergasias_apologistika, 8);
    assert.equal(report.summary.totals.ores_pragmatikhs_ergasias_apologistika, 8);
});

test('continuation terms do not erase recorded actual work and absence totals', () => {
    const input = reviewTotalsFixture(), before = structuredClone(input), report = project(input);
    const employee = report.employees.find(item => item.employeeCode === '0002');
    assert.deepEqual(employee.rows.map(row => row.values.ores_pragmatikhs_ergasias_apologistika), [8, 7.5]);
    assert.equal(employee.totals.ores_pragmatikhs_ergasias_apologistika, 15.5);
    assert.equal(employee.totals.ores_ergasias_apologistika, 15.5);
    assert.equal(employee.totals.ores_apoysias_apologistika, 0.5);
    assert.equal(report.summary.totals.ores_pragmatikhs_ergasias_apologistika, 23.5);
    assert.equal(report.summary.totals.ores_apoysias_apologistika, 0.5);
    for (const row of employee.rows) {
        assert.equal(row.historyPending, true);
        assert.equal(row.allResultsDocumented, false);
        assert.equal(row.source.compensation_breakdown_apologistika.total_amount, null);
        assert.equal(row.values.ores_prostheths_ergasias_apologistika, null);
        assert.equal(row.values.ores_nominhs_yperorias_apologistika, null);
        assert.equal(row.sixthDayHours, null);
        assert.equal(row.seventhDayHours, null);
        assert.ok(!row.unavailableFields.includes('ores_pragmatikhs_ergasias_apologistika'));
    }
    assert.deepEqual(input, before);
});

test('fully recorded sickness and maternity retain zero actual hours, credited hours and daily counts', () => {
    const rows = ['ΑΣΘΕΝΕΙΑ', 'ΑΔΕΙΑ'].map((category, index) => legacyReviewTotalsRow({
        _id: 'synthetic-leave-' + index, hmeromhnia: '2026-09-' + (28 + index),
        cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
        kathgoria_ergasias_apologistika: category, astheneia_apologistika: index === 0,
        adeia_apologistika: index === 1, kathgoria_adeias_apologistika: index === 1 ? 'ΜΗΤΡΟΤΗΤΑ' : '',
        ores_ergasias_apologistika: 0, ores_pragmatikhs_ergasias_apologistika: 0,
        ores_adeias_pistomenes_apologistika: 8
    }));
    const before = structuredClone(rows), report = project({ rows });
    assert.equal(report.employees[0].totals.ores_pragmatikhs_ergasias_apologistika, 0);
    assert.equal(report.employees[0].totals.ores_apoysias_apologistika, 0);
    assert.deepEqual(report.daily.map(row => row.values.ores_adeias_pistomenes_apologistika), [8, 8]);
    assert.equal(report.summary.counts.sicknesses, 1);
    assert.equal(report.summary.counts.leaves, 1);
    assert.deepEqual(rows, before);
});

for (const missing of [null, undefined, '', '   ', 'invalid', NaN, Infinity]) {
    test(`missing daily actual hours stay unknown (${String(missing)}) without hiding other measurements`, () => {
        const rows = [reviewTotalsRow(), reviewTotalsRow({ hmeromhnia: '2026-09-29',
            ores_pragmatikhs_ergasias_apologistika: missing, ores_apoysias_apologistika: 2 })];
        const report = project({ rows });
        assert.equal(report.daily[1].values.ores_pragmatikhs_ergasias_apologistika, null);
        assert.equal(report.employees[0].totals.ores_pragmatikhs_ergasias_apologistika, null);
        assert.equal(report.summary.totals.ores_pragmatikhs_ergasias_apologistika, null);
        assert.equal(report.summary.totals.ores_apoysias_apologistika, 2);
    });
}

test('a missing component invalidates only its own employee and period total', () => {
    const input = reviewTotalsFixture();
    input.rows[2].ores_nyxtas_apologistika = null;
    const report = project(input);
    assert.equal(report.employees[0].totals.ores_nyxtas_apologistika, 0);
    assert.equal(report.employees[1].totals.ores_nyxtas_apologistika, null);
    assert.equal(report.summary.totals.ores_nyxtas_apologistika, null);
    assert.equal(report.summary.totals.ores_pragmatikhs_ergasias_apologistika, 23.5);
});

test('explicit unavailable fields override stale numbers; locked evidence retains recorded values', () => {
    const row = legacyReviewTotalsRow();
    row.compensation_breakdown_apologistika.unavailable_fields = ['ores_apoysias_apologistika'];
    row.ores_apoysias_apologistika = 2;
    const report = project({ rows: [row] });
    assert.equal(report.daily[0].values.ores_apoysias_apologistika, null);
    assert.equal(report.daily[0].values.ores_pragmatikhs_ergasias_apologistika, 8);
    const locked = { ...row, is_locked: true, ores_nominhs_yperorias_apologistika: 1.5 };
    const before = structuredClone(locked), frozen = project({ rows: [locked] });
    assert.equal(frozen.daily[0].values.ores_nominhs_yperorias_apologistika, 1.5);
    assert.equal(frozen.daily[0].values.ores_apoysias_apologistika, 2);
    assert.deepEqual(locked, before);
});

test('boundary-week context does not contribute outside-period hours or finalize the week', () => {
    const input = reviewTotalsFixture();
    input.lifecycleByWeek = new Map([['0002|2026-09-28', {
        history_pending: true, stages: { stage4: { business_status: 'OPEN', final_weekly_analysis_available: false } },
        context_only_dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']
    }]]);
    const report = project(input);
    assert.equal(report.summary.totals.ores_pragmatikhs_ergasias_apologistika, 23.5);
    assert.equal(report.employees[1].weeks[0].weekEnd, '2026-10-04');
    assert.equal(report.employees[1].rows.length, 2);
    assert.equal(report.employees[1].totals.seventhDayHours, null);
});

test('real Excel bytes agree on daily values, employee totals and grand totals', async () => {
    const report = project(reviewTotalsFixture());
    const bytes = await service.buildEmploymentReviewWorkbook(report).xlsx.writeBuffer();
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes);
    const daily = book.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    const actual = daily.getColumn(7).values;
    assert.ok(actual.includes(15.5), JSON.stringify(actual));
    assert.ok(actual.includes(23.5), JSON.stringify(actual));
    const totals = book.getWorksheet('ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ');
    assert.ok(totals);
    const header = totals.getRow(1).values;
    const actualIndex = header.indexOf('Πραγματική εργασία');
    assert.equal(totals.getRow(3).getCell(actualIndex).value, 15.5);
    assert.equal(totals.getRow(4).getCell(actualIndex).value, 23.5);
});

for (const dossier of [false, true]) test(`real ${dossier ? 'dossier' : 'simple'} PDF preserves available totals and unavailable classifications`, async () => {
    const report = project(reviewTotalsFixture());
    const doc = service.buildEmploymentReviewPdf(report, { dossier }), chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    const done = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });
    doc.end(); await done;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-pr380-pdf-'));
    const filename = path.join(dir, 'report.pdf'); fs.writeFileSync(filename, Buffer.concat(chunks));
    const text = execFileSync('pdftotext', ['-layout', filename, '-'], { encoding: 'utf8' });
    assert.match(text, /15[.,]50/);
    assert.match(text, /23[.,]50/);
    assert.match(text, /Μη\s+διαθέσιμο/);
});

test('XLSX bytes align decimal hours right and time intervals left without changing values or formats', async () => {
    const report = project(reviewTotalsFixture()), before = structuredClone(report);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await service.buildEmploymentReviewWorkbook(report).xlsx.writeBuffer());
    const daily = book.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    for (let row = 2; row <= daily.rowCount; row += 1) {
        for (const column of [3, 4, 6]) assert.equal(daily.getRow(row).getCell(column).alignment.horizontal, 'left');
        for (let column = 7; column <= 16; column += 1) {
            const cell = daily.getRow(row).getCell(column);
            assert.equal(cell.alignment.horizontal, 'right', cell.address);
            assert.equal(cell.alignment.wrapText, true);
            if (column <= 13) assert.equal(cell.numFmt, '0.00');
        }
    }
    assert.equal(daily.getCell('G2').value, 8);
    assert.equal(daily.getCell('G5').value, 7.5);
    assert.equal(daily.getCell('C2').value, '08:00–16:00');
    assert.equal(daily.getCell('K4').value, 'Μη διαθέσιμο');
    const recap = book.getWorksheet('ΑΝΑΚΕΦΑΛΑΙΩΣΗ');
    for (let row = 3; row <= recap.rowCount; row += 1) for (let column = 3; column <= 12; column += 1) {
        assert.equal(recap.getRow(row).getCell(column).alignment.horizontal, 'right');
    }
    const totals = book.getWorksheet('ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ');
    for (let row = 2; row <= totals.rowCount; row += 1) for (let column = 3; column <= 2 + service.TOTAL_NUMBER_FIELDS.length; column += 1) {
        assert.equal(totals.getRow(row).getCell(column).alignment.horizontal, 'right');
        assert.equal(totals.getRow(row).getCell(column).numFmt, '0.00');
    }
    book.getWorksheet('ΣΥΝΟΨΗ').eachRow(row => {
        if (row.getCell(1).text === 'Σύνολο — Ώρες εργασίας') {
            assert.equal(row.getCell(2).alignment.horizontal, 'right');
            assert.equal(row.getCell(2).value, '23.50');
        }
    });
    assert.deepEqual(report, before);
});

for (const dossier of [false, true]) test(`real ${dossier ? 'dossier' : 'simple'} PDF aligns decimal hours right and clock intervals left`, async () => {
    const rows = [reviewTotalsRow(), reviewTotalsRow({ hmeromhnia: '2026-09-29',
        ores_ergasias_apologistika: 7.5, ores_pragmatikhs_ergasias_apologistika: 7.5 })];
    const report = project({ rows }), before = structuredClone(report);
    const doc = service.buildEmploymentReviewPdf(report, { dossier }), chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    const done = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });
    doc.end(); await done;
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(Buffer.concat(chunks)), useSystemFonts: true }).promise;
    const blocks = [];
    let checkedClockCells = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const items = (await (await pdf.getPage(pageNumber)).getTextContent()).items;
        blocks.push(...items.filter(item => /^(Σύνολο|Απλή|Νύχτα|Αργία|Αργία\+Νύχτα): 0,00$/.test(item.str)));
        const headers = items.filter(item => ['Προδηλωμένο', 'Κάρτες'].includes(item.str))
            .sort((a, b) => a.transform[4] - b.transform[4]);
        for (const clock of items.filter(item => item.str === '08:00–16:00')) {
            const header = headers.filter(item => item.transform[4] <= clock.transform[4] + 0.1).at(-1);
            assert.ok(header);
            assert.ok(Math.abs(clock.transform[4] - header.transform[4]) < 0.1);
            checkedClockCells += 1;
        }
    }
    // Three overtime columns, each with five lines, for employee and grand totals.
    assert.equal(blocks.length, 30);
    assert.equal(checkedClockCells, 4);
    for (let index = 0; index < blocks.length; index += 5) {
        const ends = blocks.slice(index, index + 5).map(item => item.transform[4] + item.width);
        assert.ok(Math.max(...ends) - Math.min(...ends) < 0.1, JSON.stringify(ends));
    }
    await pdf.destroy();
    assert.deepEqual(report, before);
});
