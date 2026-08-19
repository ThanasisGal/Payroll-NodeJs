'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { execFileSync } = require('node:child_process');
const {
    buildEmploymentReviewReportProjection,
    buildEmploymentReviewWorkbook,
    buildEmploymentReviewPdf,
    dailyAnalysis,
    REPORT_SCHEMA_VERSION,
    DAILY_NUMBER_FIELDS,
    TOTAL_NUMBER_FIELDS,
    COUNT_FIELDS,
    pdfFooterLines,
    employmentStatusLabel,
    dossierFooterLine,
    buildDossierHistoryEntries,
    branchDescription,
    COMPACT_DAILY_XLSX_COLUMNS,
    COMPACT_DAILY_NUMERIC_KEYS,
    OVERTIME_COMPONENTS,
    overtimeValues,
    buildCompactDailyXlsxRows
} = require('./apasxoliseisEmploymentReviewReportService');

function row(overrides = {}) {
    return {
        _id: `row-${overrides.kodikos || '0009'}-${overrides.hmeromhnia || '2026-06-07'}`,
        kodikos: '0009', employeeName: 'ΔΟΚΙΜΗ ΕΡΓΑΖΟΜΕΝΟΥ', ypokatasthma: '0000',
        hmeromhnia: new Date('2026-06-07T00:00:00.000Z'),
        apo_ora_01: '14:38', eos_ora_01: '22:38', cards_apo_ora_01: '14:38',
        apo_ora_01_apologistika: '14:38', eos_ora_01_apologistika: '23:08',
        ores_ergasias_apologistika: 8, ores_pragmatikhs_ergasias_apologistika: 8,
        ores_apoysias_apologistika: 0, ores_nyxtas_apologistika: 1.13,
        ores_argion_prosayxhsh_apologistika: 8, kyriakes_apologistika: true,
        orphan_card_resolution_preview: { orphanType: 'START_ONLY' },
        orphan_card_resolution: { status: 'HR_APPROVED', reuse_scope: 'ONE_TIME' },
        policy: { classification: 'NORMAL' }, ...overrides
    };
}
function state(kodikos, weekStart, overrides = {}) {
    return { employee_kodikos: kodikos, week_start: new Date(`${weekStart}T00:00:00.000Z`),
        week_end: new Date('2026-06-07T00:00:00.000Z'),
        stage1: { status: 'COMPLETED', version: 1 }, stage2: { status: 'COMPLETED', version: 1 },
        stage3: { status: 'COMPLETED', version: 1 }, final_stage: { status: 'COMPLETED', version: 1 }, ...overrides };
}
function fixture() {
    const rows = [
        row(),
        row({ kodikos: '0022', employeeName: 'ΜΟΝΟΗΜΕΡΗ ΣΧΕΣΗ', hmeromhnia: new Date('2026-06-01T00:00:00.000Z'),
            apo_ora_01: '', eos_ora_01: '', cards_apo_ora_01: '', apo_ora_01_apologistika: '',
            eos_ora_01_apologistika: '', ores_ergasias_apologistika: 0,
            kathgoria_ergasias_apologistika: 'POSSIBLE_LEAVE', requires_hr_action: false, total_pending_count: 0,
            orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0025', employeeName: 'ΕΚΤΗ ΗΜΕΡΑ', hmeromhnia: new Date('2026-06-14T00:00:00.000Z'),
            policy: { classification: 'SIXTH', sixthDayRate: 0 }, orphan_card_resolution_preview: null,
            orphan_card_resolution: null }),
        row({ kodikos: '0029', employeeName: 'ΜΕΡΙΚΗ ΕΒΔΟΜΑΔΑ', hmeromhnia: new Date('2026-06-30T00:00:00.000Z'),
            policy: { classification: 'NORMAL' }, orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0014', employeeName: 'ΜΙΚΤΗ ΑΠΑΣΧΟΛΗΣΗ', hmeromhnia: new Date('2026-06-16T00:00:00.000Z'),
            effective_kathestos_apasxolhshs: 'ΜΕΡΙΚΗ', orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0030', employeeName: 'ΣΠΑΣΤΟ ΩΡΑΡΙΟ', hmeromhnia: new Date('2026-06-18T00:00:00.000Z'),
            apo_ora_01: '08:00', eos_ora_01: '12:00', apo_ora_02: '16:00', eos_ora_02: '20:00',
            orphan_card_resolution_preview: { orphanType: 'END_ONLY' }, orphan_card_resolution: { status: 'UNRESOLVED' } })
    ];
    return buildEmploymentReviewReportProjection({ rows,
        workflowStates: [state('0009', '2026-06-01'), state('0022', '2026-06-01'),
            state('0025', '2026-06-08'), state('0029', '2026-06-29'),
            state('0014', '2026-06-15'), state('0030', '2026-06-15')],
        workflowAudits: [{ employee_kodikos: '0029', week_start: new Date('2026-06-29T00:00:00.000Z'),
            action: 'STAGE3_DAILY_RESOLVED', final_classification: 'ABSENCE' }],
        metadata: { companyName: '0004', branch: '0000', periodStart: '2026-06-01', periodEnd: '2026-06-30' } });
}

test('η κοινή προβολή διατηρεί τις κανονικές ημερήσιες και εβδομαδιαίες πληροφορίες', () => {
    const report = fixture();
    assert.equal(report.schemaVersion, REPORT_SCHEMA_VERSION);
    assert.equal(report.daily.find((item) => item.employeeCode === '0009').orphan.status, 'Επιλυμένο με έγκριση HR');
    assert.equal(report.daily.find((item) => item.employeeCode === '0022').classification, '');
    assert.equal(report.daily.find((item) => item.employeeCode === '0025').sixthDayRate, 0);
    assert.equal(report.weekly.find((item) => item.employeeCode === '0029').sliceEnd, '2026-06-30');
    assert.match(report.daily.find((item) => item.employeeCode === '0030').declared, /08:00–12:00, 16:00–20:00/);
    assert.equal(report.daily.find((item) => item.employeeCode === '0009').cards, '14:38–—');
});

test('μία εβδομαδιαία εκκρεμότητα δεν αθροίζεται επτά φορές', () => {
    const rows = Array.from({ length: 7 }, (_, index) => row({
        kodikos: '0040', employeeName: 'ΜΙΑ ΕΚΚΡΕΜΟΤΗΤΑ',
        hmeromhnia: new Date(Date.UTC(2026, 5, 1 + index)),
        orphan_card_resolution_preview: null, orphan_card_resolution: null
    }));
    const lifecycleByWeek = new Map([['0040|2026-06-01', {
        total_pending_count: 1, requires_hr_action: true,
        employment_date_scope: { authoritative_date_set: rows.map((item) => item.hmeromhnia.toISOString().slice(0, 10)) },
        stages: { stage1: { pending_count: 0 }, stage2: { pending_count: 0 },
            stage3: { pending_count: 1, pending_dates: ['2026-06-03'], presentation_status: 'ACTIVE' },
            stage4: { pending_count: 0, presentation_status: 'LOCKED', final_weekly_analysis: {} } }
    }]]);
    const report = buildEmploymentReviewReportProjection({ rows, lifecycleByWeek });
    assert.equal(report.summary.pendingCount, 1);
});

test('η 6η ημέρα και το 0% προέρχονται από το τελικό εβδομαδιαίο αποτέλεσμα', () => {
    const source = row({ kodikos: '0025', hmeromhnia: new Date('2026-06-14T00:00:00.000Z'),
        policy: { classification: 'NORMAL' }, orphan_card_resolution_preview: null, orphan_card_resolution: null });
    const lifecycleByWeek = new Map([['0025|2026-06-08', {
        total_pending_count: 0, requires_hr_action: false,
        employment_date_scope: { authoritative_date_set: ['2026-06-09', '2026-06-10', '2026-06-11',
            '2026-06-12', '2026-06-13', '2026-06-14'] },
        stages: { stage1: {}, stage2: {}, stage3: {}, stage4: { presentation_status: 'COMPLETED',
            final_weekly_analysis: { sixthDay: { hmeromhnia: '2026-06-14', premiumRate: 0,
                premiumRateSource: 'POLICY' } } } }
    }]]);
    const report = buildEmploymentReviewReportProjection({ rows: [source], lifecycleByWeek });
    assert.equal(report.daily[0].sixthDay, true);
    assert.equal(report.daily[0].sixthDayRate, 0);
    assert.equal(report.weekly[0].sixthDay, '2026-06-14');
    assert.equal(report.weekly[0].sixthDayRate, 0);
});

test('0009 / 09-06: η τελική Stage-2 προβολή εξάγεται ως ΡΕΠΟ και ΑΝ, όχι ΕΡΓ', () => {
    const raw = row({ _id: '6a7c515e6aeaefb3c8764c7c', kodikos: '0009',
        hmeromhnia: new Date('2026-06-09T00:00:00.000Z'),
        kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: '',
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', repo: false,
        repo_apologistika: false, apo_ora_01: '09:30', eos_ora_01: '12:30',
        cards_apo_ora_01: '', cards_eos_ora_01: '',
        orphan_card_resolution_preview: null, orphan_card_resolution: null });
    const lifecycleByWeek = new Map([['0009|2026-06-08', {
        total_pending_count: 0, requires_hr_action: false,
        stages: { stage1: {}, stage2: {}, stage3: {
            stage2_automatic_resolution_items: [
                { date: '2026-06-09', classification: 'REST_REPO' }
            ] }, stage4: { final_weekly_analysis: {} } }
    }]]);
    const report = buildEmploymentReviewReportProjection({ rows: [raw], lifecycleByWeek });
    assert.equal(report.daily[0].classification, 'ΑΝ');
    assert.equal(report.daily[0].classificationLabel, 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ');
    assert.equal(report.daily[0].repo, true);
    assert.equal(report.daily[0].apologistikoBook, true);
    assert.equal(report.daily[0].classificationSource, 'STAGE2_FINAL_PROJECTION');
    assert.equal(raw.kathgoria_ergasias, 'ΕΡΓ');
    assert.equal(raw.repo, false);
    assert.equal(raw.cards_apo_ora_01, '');

    const workbook = buildEmploymentReviewWorkbook(report);
    const exported = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ').getRow(2);
    assert.equal(exported.getCell('workCategories').value, 'Προδ.: ΕΡΓ\nΑπολ.: ΑΝ');
});

test('μερική/εκ περιτροπής Stage-2 ημέρα εξάγεται ως ΜΗ ΕΡΓΑΣΙΑ και όχι ΡΕΠΟ', () => {
    const source = row({ kodikos: '0014', hmeromhnia: new Date('2026-06-16T00:00:00.000Z'),
        effective_typos_apasxolhshs: '1', kathgoria_ergasias: 'ΕΡΓ',
        kathgoria_ergasias_apologistika: '', repo_apologistika: false,
        apologistiko_biblio: false, cards_apo_ora_01: '', cards_eos_ora_01: '',
        ores_ergasias_apologistika: 0, ores_pragmatikhs_ergasias_apologistika: 0,
        orphan_card_resolution_preview: null, orphan_card_resolution: null });
    const lifecycleByWeek = new Map([['0014|2026-06-15', { requires_hr_action: false,
        stages: { stage1: {}, stage2: {}, stage3: { stage2_automatic_resolution_items: [
            { date: '2026-06-16', classification: 'NON_WORK' }
        ] }, stage4: { final_weekly_analysis: {} } } }]]);
    const report = buildEmploymentReviewReportProjection({ rows: [source], lifecycleByWeek });
    assert.equal(report.daily[0].classification, 'ΜΕ');
    assert.equal(report.daily[0].classificationLabel, 'ΜΗ ΕΡΓΑΣΙΑ');
    assert.equal(report.daily[0].repo, false);
    assert.equal(report.daily[0].apologistikoBook, true);
});

test('το XLSX διατηρεί τις αυτόνομες στήλες G–M ως αριθμούς με 0.00', () => {
    const workbook = buildEmploymentReviewWorkbook(fixture());
    const sheet = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    for (const key of COMPACT_DAILY_NUMERIC_KEYS) {
        assert.equal(sheet.getColumn(key).numFmt, '0.00', key);
        assert.equal(typeof sheet.getRow(2).getCell(key).value, 'number', key);
    }
});

test('η ανάλυση PDF παραλείπει μηδενικά αριθμητικά αλλά διατηρεί τις βασικές canonical καταστάσεις', () => {
    const report = buildEmploymentReviewReportProjection({ rows: [row({
        kodikos: '0014', hmeromhnia: new Date('2026-06-22T00:00:00.000Z'),
        apologistiko_biblio: true, repo_apologistika: true,
        kathgoria_ergasias_apologistika: 'ΑΝ', kathgoria_adeias_apologistika: '',
        adeia_apologistika: false, astheneia_apologistika: false,
        apousia_apologistika: false, kyriakes_apologistika: false,
        ores_ergasias_apologistika: 0,
        ores_pragmatikhs_ergasias_apologistika: 0,
        ores_nyxtas_apologistika: 0, ores_argion_prosayxhsh_apologistika: 0,
        orphan_card_resolution_preview: null, orphan_card_resolution: null
    })] });
    const entries = dailyAnalysis(report.daily[0]);
    assert.deepEqual(entries, [
        { field: 'Απολογιστικό βιβλίο', value: 'ΝΑΙ' },
        { field: 'Ρεπό', value: 'ΝΑΙ' },
        { field: 'Τελικός απολογιστικός χαρακτηρισμός', value: 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ' }
    ]);
    assert.equal(entries.some((entry) => entry.value === '0.00'), false);
});

test('το βιβλίο έχει το φύλλο συνόλων ανά εργαζόμενο, γενικό σύνολο και διατηρεί το 0%', async () => {
    const workbook = buildEmploymentReviewWorkbook(fixture());
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
        'ΣΥΝΟΨΗ', 'ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ', 'ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ',
        'ΑΠΟΦΑΣΕΙΣ ΣΤΑΔΙΩΝ', 'ΕΒΔΟΜΑΔΙΑΙΟΣ ΕΛΕΓΧΟΣ', 'ΙΧΝΗΛΑΣΙΜΟΤΗΤΑ'
    ]);
    const sheet = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    assert.ok(sheet.getColumn('sixthDayHours').values.some((value) => Number(value) > 0));
    const totals = workbook.getWorksheet('ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ');
    assert.equal(totals.getRow(totals.rowCount).getCell('employeeCode').value, 'ΓΕΝΙΚΟ ΣΥΝΟΛΟ');
    TOTAL_NUMBER_FIELDS.filter(([field]) => !Object.values(OVERTIME_COMPONENTS).flat().includes(field))
        .forEach(([field]) => assert.equal(totals.getColumn(field).numFmt, '0.00'));
    assert.ok((await workbook.xlsx.writeBuffer()).byteLength > 1000);
});

test('η ανακεφαλαίωση έχει μία row ανά εργαζόμενο και πλήρη overtime ανάλυση πέντε γραμμών', () => {
    const rows = [
        row({ kodikos: '0001', employeeName: 'ΠΡΩΤΟΣ',
            ores_yperergasias_apologistika: 1, ores_yperergasias_nyxtas_apologistika: 2,
            ores_yperergasias_argion_apologistika: 3, ores_yperergasias_argion_nyxtas_apologistika: 4,
            ores_nominhs_yperorias_apologistika: 0.1, ores_nominhs_yperorias_nyxtas_apologistika: 0.2,
            ores_nominhs_yperorias_argion_apologistika: 0.3,
            ores_nominhs_yperorias_argion_nyxtas_apologistika: 0.4,
            ores_paranomhs_yperorias_apologistika: 1.1,
            ores_paranomhs_yperorias_nyxtas_apologistika: 1.2,
            ores_paranomhs_yperorias_argion_apologistika: 1.3,
            ores_paranomhs_yperorias_argion_nyxtas_apologistika: 1.4,
            orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0002', employeeName: 'ΔΕΥΤΕΡΟΣ',
            ores_yperergasias_apologistika: 0.5, ores_yperergasias_nyxtas_apologistika: 0.6,
            ores_yperergasias_argion_apologistika: 0.7,
            ores_yperergasias_argion_nyxtas_apologistika: 0.8,
            ores_nominhs_yperorias_apologistika: 1.5, ores_nominhs_yperorias_nyxtas_apologistika: 1.6,
            ores_nominhs_yperorias_argion_apologistika: 1.7,
            ores_nominhs_yperorias_argion_nyxtas_apologistika: 1.8,
            ores_paranomhs_yperorias_apologistika: 2.5,
            ores_paranomhs_yperorias_nyxtas_apologistika: 2.6,
            ores_paranomhs_yperorias_argion_apologistika: 2.7,
            ores_paranomhs_yperorias_argion_nyxtas_apologistika: 2.8,
            orphan_card_resolution_preview: null, orphan_card_resolution: null })
    ];
    const report = buildEmploymentReviewReportProjection({ rows });
    const sheet = buildEmploymentReviewWorkbook(report).getWorksheet('ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ');
    assert.equal(sheet.rowCount, report.employees.length + 2);
    assert.equal(sheet.getColumn('overwork').header, 'Υπερεργασία');
    assert.equal(sheet.getColumn('legalOvertime').header, 'Νόμιμη Υπερωρία');
    assert.equal(sheet.getColumn('illegalOvertime').header, 'Παράνομη Υπερωρία');
    const parse = (value) => String(value).split('\n').map((line) => Number(line.split(': ')[1]));
    report.employees.forEach((employee, employeeIndex) => {
        const recapRow = sheet.getRow(employeeIndex + 2);
        assert.equal(recapRow.getCell('employeeCode').value, employee.employeeCode);
        assert.equal(recapRow.height, 60);
        assert.equal(recapRow.alignment.wrapText, true);
        for (const [key, fields] of Object.entries(OVERTIME_COMPONENTS)) {
            const values = parse(recapRow.getCell(key).value);
            assert.equal(values.length, 5);
            assert.deepEqual(values.slice(1), fields.map((field) => employee.totals[field]));
            assert.equal(values[0], Number(values.slice(1).reduce((sum, value) => sum + value, 0).toFixed(2)));
        }
    });
    const generalRow = sheet.getRow(sheet.rowCount);
    for (const [key, fields] of Object.entries(OVERTIME_COMPONENTS)) {
        const values = parse(generalRow.getCell(key).value);
        assert.equal(values.length, 5);
        assert.deepEqual(values.slice(1), fields.map((field) => report.summary.totals[field]));
        values.slice(1).forEach((value, componentIndex) => assert.equal(value,
            Number(report.employees.reduce((sum, employee) =>
                sum + employee.totals[fields[componentIndex]], 0).toFixed(2))));
        assert.equal(values[0], Number(values.slice(1).reduce((sum, value) => sum + value, 0).toFixed(2)));
    }
});

test('τα σύνολα εργαζομένου είναι SUM των daily values και τα γενικά SUM των εργαζομένων', () => {
    const report = fixture();
    for (const employee of report.employees) {
        for (const [field] of TOTAL_NUMBER_FIELDS) {
            const expected = employee.rows.reduce((sum, item) => sum + item.values[field], 0);
            assert.equal(employee.totals[field], Number(expected.toFixed(2)), `${employee.employeeCode}/${field}`);
        }
        for (const [key, , rowKey] of COUNT_FIELDS) {
            assert.equal(employee.counts[key], employee.rows.filter((item) => item[rowKey] === true).length,
                `${employee.employeeCode}/${key}`);
        }
    }
    for (const [field] of TOTAL_NUMBER_FIELDS) {
        const expected = report.employees.reduce((sum, employee) => sum + employee.totals[field], 0);
        assert.equal(report.summary.totals[field], Number(expected.toFixed(2)), field);
    }
    for (const [key] of COUNT_FIELDS) {
        assert.equal(report.summary.counts[key], report.employees.reduce((sum, employee) => sum + employee.counts[key], 0), key);
    }
});

test('τα δύο PDF δημιουργούνται χωρίς μεταβολή των αρχικών rows', async () => {
    const report = fixture();
    const before = structuredClone(report.daily.map((item) => item.source));
    for (const dossier of [false, true]) {
        const doc = buildEmploymentReviewPdf(report, { dossier });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        const completed = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });
        doc.end();
        await completed;
        assert.ok(Buffer.concat(chunks).length > 1000);
    }
    assert.deepEqual(report.daily.map((item) => item.source), before);
});

test('το απλό PDF footer είναι μία γραμμή με δυναμικό έτος και δεξιά αρίθμηση', () => {
    const lines = pdfFooterLines(2, 7);
    assert.match(lines[0], new RegExp(`^© 2009 - ${new Date().getFullYear()} Copyright: WebPayrollSolutions\\.com`));
    assert.equal(lines.some((line) => /\r|\n/.test(line)), false);
    assert.match(lines.join(' '), /Ιωλκού 266α Βόλος/);
    assert.match(lines.join(' '), /Τηλ\. 2421056825/);
    assert.match(lines.join(' '), /Κιν\. 6972012650/);
    assert.match(lines.join(' '), /support@WebPayrollSolutions\.com/);
    assert.equal(lines[1], 'Σελίδα 2 / 7');
});

test('το dossier footer είναι μία γραμμή με δυναμικό έτος', () => {
    const footer = dossierFooterLine();
    assert.equal(footer.includes('\n'), false);
    assert.match(footer, new RegExp(`^\\(c\\) 2009 - ${new Date().getFullYear()} Copyright:`));
    assert.match(footer, /WebPayrollSolutions\.com.*Ιωλκού 266α Βόλος.*support@WebPayrollSolutions\.com/);
});

test('η πρώτη σελίδα dossier είναι αποκλειστικά εξώφυλλο και οι εργαζόμενοι αρχίζουν από τη δεύτερη', async () => {
    const report = fixture();
    Object.assign(report.metadata, { companyCode: '0004', companyName: 'ΔΟΚΙΜΑΣΤΙΚΗ ΕΤΑΙΡΕΙΑ',
        branchDescription: 'ΕΔΡΑ', branchAddress: { street: 'ΦΙΛΕΛΛΗΝΩΝ', number: '2',
            postalCode: '38221', cityCode: '91070201', cityDescription: 'ΒΟΛΟΣ' }, usage: '2026' });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'employment-dossier-cover-'));
    const pdfPath = path.join(directory, 'dossier.pdf');
    const noLogoPdfPath = path.join(directory, 'dossier-no-logo.pdf');
    const doc = buildEmploymentReviewPdf(report, { dossier: true });
    const output = fs.createWriteStream(pdfPath); doc.pipe(output); doc.end();
    await new Promise((resolve, reject) => { output.on('finish', resolve); output.on('error', reject); });
    const originalExistsSync = fs.existsSync;
    fs.existsSync = (candidate) => String(candidate).endsWith('/public/img/wps2.png')
        ? false : originalExistsSync(candidate);
    let noLogoDoc;
    try {
        noLogoDoc = buildEmploymentReviewPdf(report, { dossier: true });
    } finally {
        fs.existsSync = originalExistsSync;
    }
    const noLogoOutput = fs.createWriteStream(noLogoPdfPath); noLogoDoc.pipe(noLogoOutput); noLogoDoc.end();
    await new Promise((resolve, reject) => {
        noLogoOutput.on('finish', resolve); noLogoOutput.on('error', reject);
    });
    execFileSync('pdfseparate', [pdfPath, path.join(directory, 'page-%d.pdf')]);
    const first = execFileSync('pdftotext', ['-layout', path.join(directory, 'page-1.pdf'), '-'],
        { encoding: 'utf8' });
    const second = execFileSync('pdftotext', ['-layout', path.join(directory, 'page-2.pdf'), '-'],
        { encoding: 'utf8' });
    assert.match(first, /ΦΑΚΕΛΟΣ ΕΛΕΓΧΟΥ ΑΠΑΣΧΟΛΗΣΗΣ/);
    assert.match(first, /Εταιρεία: 0004 - ΔΟΚΙΜΑΣΤΙΚΗ ΕΤΑΙΡΕΙΑ/);
    assert.match(first, /Παράρτημα: 0000 - ΕΔΡΑ \(ΦΙΛΕΛΛΗΝΩΝ 2, 38221 ΒΟΛΟΣ\)/);
    assert.match(first, /WebPayrollSolutions\.com/);
    assert.doesNotMatch(first, /91070201/);
    assert.doesNotMatch(first, /Α\. Ημερήσιο ημερολόγιο|0009 —/);
    assert.match(second, /0009 —/);
    assert.match(second, /Παράρτημα: 0000 - ΕΔΡΑ \(ΦΙΛΕΛΛΗΝΩΝ 2, 38221 ΒΟΛΟΣ\)/);
    assert.doesNotMatch(second, /91070201/);
    assert.match(second, /Α\. Ημερήσιο ημερολόγιο/);
    const pages = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' }).match(/^Pages:\s+(\d+)/m)?.[1];
    const noLogoPages = execFileSync('pdfinfo', [noLogoPdfPath], { encoding: 'utf8' })
        .match(/^Pages:\s+(\d+)/m)?.[1];
    assert.equal(pages, noLogoPages);
    fs.rmSync(directory, { recursive: true, force: true });
});

test('το αναλυτικό ιστορικό περιέχει μόνο ουσιαστικά canonical γεγονότα σε φυσική γλώσσα', () => {
    const report = fixture();
    const orphanEntries = buildDossierHistoryEntries(
        report.employees.find((employee) => employee.employeeCode === '0009'));
    assert.ok(orphanEntries.some((entry) => /without corresponding|orphan/i.test(entry.text)) === false);
    assert.ok(orphanEntries.some((entry) => /χτύπημα εισόδου χωρίς αντίστοιχο χτύπημα εξόδου/.test(entry.text)));
    const sixthEntries = buildDossierHistoryEntries(
        report.employees.find((employee) => employee.employeeCode === '0025'));
    assert.ok(sixthEntries.some((entry) => /6η ημέρα εργασίας.*0%/.test(entry.text)));
    const allText = report.employees.flatMap(buildDossierHistoryEntries)
        .map((entry) => entry.text).join('\n');
    assert.doesNotMatch(allText, /Stage [1-4]|Στάδιο [1-4]|No action|Automatic/);
});

test('deterministic ανακατασκευή μεταφοράς δηλώνεται ως συμπέρασμα των τελικών στοιχείων', () => {
    const rows = [
        row({ kodikos: '0001', hmeromhnia: new Date('2026-06-01T00:00:00.000Z'),
            kathgoria_ergasias_original: 'ΑΝ', kathgoria_ergasias: 'ΑΝ',
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            cards_apo_ora_01: '08:12', cards_eos_ora_01: '16:16',
            orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0001', hmeromhnia: new Date('2026-06-02T00:00:00.000Z'),
            kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΑΝ',
            repo_apologistika: true, apologistiko_biblio: true,
            apo_ora_01: '08:00', eos_ora_01: '16:00', cards_apo_ora_01: '', cards_eos_ora_01: '',
            apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
            ores_ergasias_apologistika: 0, ores_pragmatikhs_ergasias_apologistika: 0,
            orphan_card_resolution_preview: null, orphan_card_resolution: null })
    ];
    const report = buildEmploymentReviewReportProjection({ rows });
    const entries = buildDossierHistoryEntries(report.employees[0]);
    assert.equal(entries.filter((entry) => entry.heading.includes('→')).length, 1);
    assert.match(entries[0].heading, /01\/06\/2026 → 02\/06\/2026/);
    assert.match(entries[0].text, /προδηλωμένο ρεπό.*κάρτες εργασίας.*ΑΝΑΠΑΥΣΗ \/ ΡΕΠΟ/);
    assert.match(entries[0].text, /Από τα τελικά απολογιστικά στοιχεία.*προκύπτει μεταφορά/);
    assert.doesNotMatch(entries[0].text, /Για τον λόγο αυτό το ρεπό μεταφέρθηκε/);
});

test('persisted repo-transfer επιτρέπει βεβαιωμένη διατύπωση μεταφοράς', () => {
    const rows = [
        row({ kodikos: '0001', hmeromhnia: new Date('2026-06-01T00:00:00.000Z'),
            kathgoria_ergasias_original: 'ΑΝ', cards_apo_ora_01: '08:12', cards_eos_ora_01: '16:16',
            orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0001', hmeromhnia: new Date('2026-06-02T00:00:00.000Z'),
            kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true,
            ores_ergasias_apologistika: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
            orphan_card_resolution_preview: null, orphan_card_resolution: null })
    ];
    const report = buildEmploymentReviewReportProjection({ rows, repoTransferDecisions: [{
        employee_kodikos: '0001', week_start: new Date('2026-06-01T00:00:00.000Z'),
        decision_code: 'APPROVE', canonical_snapshot: {
            source: { hmeromhnia: new Date('2026-06-01T00:00:00.000Z') },
            target: { hmeromhnia: new Date('2026-06-02T00:00:00.000Z') }
        }
    }] });
    const history = buildDossierHistoryEntries(report.employees[0]).map((entry) => entry.text).join('\n');
    assert.match(history, /Για τον λόγο αυτό το ρεπό μεταφέρθηκε στις 02\/06\/2026/);
    assert.doesNotMatch(history, /Από τα τελικά απολογιστικά στοιχεία.*προκύπτει μεταφορά/);
});

test('η διεύθυνση παραρτήματος παραλείπει καθαρά όσα address fields λείπουν', () => {
    assert.equal(branchDescription({ branch: '0000', branchDescription: 'ΕΔΡΑ', branchAddress: {
        street: 'ΦΙΛΕΛΛΗΝΩΝ', number: '2', postalCode: '38221',
        cityCode: '91070201', cityDescription: 'ΒΟΛΟΣ'
    } }), '0000 - ΕΔΡΑ (ΦΙΛΕΛΛΗΝΩΝ 2, 38221 ΒΟΛΟΣ)');
    assert.equal(branchDescription({ branch: '0000', branchDescription: 'ΕΔΡΑ', branchAddress: {
        street: 'ΦΙΛΕΛΛΗΝΩΝ', cityDescription: 'ΒΟΛΟΣ'
    } }), '0000 - ΕΔΡΑ (ΦΙΛΕΛΛΗΝΩΝ, ΒΟΛΟΣ)');
    assert.equal(branchDescription({ branch: '0000', branchDescription: 'ΕΔΡΑ', branchAddress: {
        street: 'ΦΙΛΕΛΛΗΝΩΝ', number: '2', postalCode: '38221', cityCode: '91070201'
    } }), '0000 - ΕΔΡΑ (ΦΙΛΕΛΛΗΝΩΝ 2, 38221)');
});

test('εσωτερική ορολογία stage σε persisted αιτιολογία δεν διαρρέει στο dossier', () => {
    const report = buildEmploymentReviewReportProjection({ rows: [row({
        kodikos: '0041', hmeromhnia: new Date('2026-06-27T00:00:00.000Z'),
        apousia_apologistika: true, kathgoria_ergasias_apologistika: 'ΜΕ',
        orphan_card_resolution_preview: null, orphan_card_resolution: null
    })], workflowAudits: [{ employee_kodikos: '0041',
        week_start: new Date('2026-06-22T00:00:00.000Z'), action: 'STAGE3_DAILY_RESOLVED',
        final_classification: 'ABSENCE', reason_or_notes: 'Τελική εξέταση στο Στάδιο 3' }] });
    const history = buildDossierHistoryEntries(report.employees[0]).map((entry) => entry.text).join('\n');
    assert.match(history, /ΑΠΟΥΣΙΑ/);
    assert.doesNotMatch(history, /Stage [1-4]|Στάδιο [1-4]/);
});

test('0014: το ημερήσιο καθεστώς ακολουθεί αποκλειστικά το date-effective profile και η περίοδος είναι μικτή', () => {
    const report = buildEmploymentReviewReportProjection({ rows: [
        row({ kodikos: '0014', hmeromhnia: new Date('2026-06-14T00:00:00.000Z'),
            effective_typos_apasxolhshs: '1', effective_kathestos_apasxolhshs: '1',
            orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0014', hmeromhnia: new Date('2026-06-15T00:00:00.000Z'),
            effective_typos_apasxolhshs: '0', effective_kathestos_apasxolhshs: '0',
            effective_schedule_phase_code: '2',
            orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0014', hmeromhnia: new Date('2026-06-16T00:00:00.000Z'),
            effective_typos_apasxolhshs: '0', effective_kathestos_apasxolhshs: '0',
            orphan_card_resolution_preview: null, orphan_card_resolution: null })
    ] });
    assert.equal(employmentStatusLabel('2'), 'ΕΚ ΠΕΡΙΤΡΟΠΗΣ');
    assert.deepEqual(report.daily.map((item) => [item.date, item.employmentStatus]), [
        ['2026-06-14', 'ΜΕΡΙΚΗ'], ['2026-06-15', 'ΠΛΗΡΗΣ'],
        ['2026-06-16', 'ΠΛΗΡΗΣ']
    ]);
    assert.equal(report.employees[0].periodEmploymentStatus, 'ΜΙΚΤΟ ΚΑΤΑ ΤΗΝ ΠΕΡΙΟΔΟ');

    const sheet = buildEmploymentReviewWorkbook(report).getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    assert.equal(sheet.getColumn('dateStatus').values[2], '14/06/2026\nΜΕΡΙΚΗ');
    assert.equal(sheet.getColumn('dateStatus').values[3], '15/06/2026\nΠΛΗΡΗΣ');
    assert.equal(sheet.getColumn('dateStatus').values[4], '16/06/2026\nΠΛΗΡΗΣ');
});

test('POSSIBLE_LEAVE είναι μόνο internal workflow state στο PDF/XLSX projection', () => {
    const report = buildEmploymentReviewReportProjection({ rows: [
        row({ hmeromhnia: new Date('2026-06-15T00:00:00.000Z'),
            apologistiko_biblio: true, repo_apologistika: true,
            kathgoria_ergasias_apologistika: 'ΑΝ',
            kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' }),
        row({ hmeromhnia: new Date('2026-06-16T00:00:00.000Z'),
            apologistiko_biblio: true, repo_apologistika: false,
            kathgoria_ergasias_apologistika: 'ΜΕ',
            kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' }),
        row({ hmeromhnia: new Date('2026-06-17T00:00:00.000Z'),
            adeia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' }),
        row({ hmeromhnia: new Date('2026-06-18T00:00:00.000Z'),
            astheneia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΑΣ' })
    ] });
    assert.deepEqual(report.daily.map((item) => ({ label: item.classificationLabel,
        book: item.apologistikoBook, repo: item.repo, leaveCategory: item.leaveCategory })), [
        { label: 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ', book: true, repo: true, leaveCategory: '' },
        { label: 'ΜΗ ΕΡΓΑΣΙΑ', book: true, repo: false, leaveCategory: '' },
        { label: '', book: false, repo: false, leaveCategory: 'ΑΔΚΑΝ' },
        { label: '', book: false, repo: false, leaveCategory: 'ΑΔΑΣ' }
    ]);
    const sheet = buildEmploymentReviewWorkbook(report).getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    const allText = [...sheet._rows].filter(Boolean).flatMap((row) => row.values)
        .filter((value) => typeof value === 'string').join('\n');
    assert.doesNotMatch(allText, /POSSIBLE_LEAVE/);
});

test('το ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ έχει 16 capped στήλες, λογική κεφαλίδα και μία row ανά ημερομηνία', () => {
    const report = fixture();
    const sheet = buildEmploymentReviewWorkbook(report).getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    assert.equal(sheet.columnCount, 16);
    assert.equal(sheet.getRow(1).height, 34);
    assert.equal(sheet.getRow(1).alignment.wrapText, true);
    assert.equal(sheet.getRow(1).alignment.horizontal, 'center');
    assert.deepEqual(sheet.columns.map((column) => column.width),
        COMPACT_DAILY_XLSX_COLUMNS.map(([, , width]) => width));
    assert.ok(sheet.columns.every((column) => column.width <= 28));
    const dailyRows = buildCompactDailyXlsxRows(report).filter((item) => item.rowType === 'daily');
    assert.equal(dailyRows.length, report.daily.length);
    assert.equal(sheet.rowCount, report.daily.length + (2 * report.employees.length) + 6);
    assert.deepEqual(sheet.views, [{ state: 'frozen', xSplit: 1, ySplit: 1 }]);
});

test('το ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ έχει A4 landscape print setup μίας σελίδας σε πλάτος', () => {
    const workbook = buildEmploymentReviewWorkbook(fixture());
    const sheet = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    assert.equal(sheet.pageSetup.paperSize, 9);
    assert.equal(sheet.pageSetup.orientation, 'landscape');
    assert.equal(sheet.pageSetup.fitToPage, true);
    assert.equal(sheet.pageSetup.fitToWidth, 1);
    assert.equal(sheet.pageSetup.fitToHeight, 0);
    assert.equal(sheet.pageSetup.printArea, `A1:P${sheet.rowCount}`);
    assert.equal(sheet.pageSetup.printTitlesRow, '1:1');
    assert.equal(sheet.pageSetup.showGridLines, false);
    assert.equal(sheet.pageSetup.showRowColHeaders, false);
    assert.equal(sheet.pageSetup.horizontalCentered, true);
    assert.deepEqual(sheet.pageSetup.margins,
        { left: 0.22, right: 0.22, top: 0.38, bottom: 0.38, header: 0.17, footer: 0.17 });
});

test('το ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ εφαρμόζει διακριτική WPS παλέτα χωρίς αλλαγή διαστάσεων', async () => {
    const rows = [
        row({ kodikos: '0001', hmeromhnia: new Date('2026-06-01T00:00:00.000Z'),
            ores_apoysias_apologistika: 1, ores_ergasias_apologistika: 8,
            ores_yperergasias_apologistika: 1, ores_nominhs_yperorias_apologistika: 0.5,
            policy: { classification: 'SIXTH', sixthDayRate: 0 },
            orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0001', hmeromhnia: new Date('2026-06-02T00:00:00.000Z'),
            ores_ergasias_apologistika: 6, ores_paranomhs_yperorias_apologistika: 0.75,
            policy: { classification: 'SEVENTH' },
            orphan_card_resolution_preview: null, orphan_card_resolution: null })
    ];
    const workbook = buildEmploymentReviewWorkbook(buildEmploymentReviewReportProjection({ rows }));
    const sheet = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    assert.equal(sheet.getRow(1).fill.fgColor.argb, 'FF55645B');
    assert.equal(sheet.getRow(1).font.color.argb, 'FFFFFFFF');
    assert.equal(sheet.getRow(2).fill, undefined);
    assert.equal(sheet.getCell('A3').fill.fgColor.argb, 'FFF4F6F4');
    assert.equal(sheet.getCell('H2').fill.fgColor.argb, 'FFFDECEC');
    assert.equal(sheet.getCell('L2').fill.fgColor.argb, 'FFFFF2CC');
    assert.equal(sheet.getCell('N2').fill.fgColor.argb, 'FFFFF3E0');
    assert.equal(sheet.getCell('O2').fill.fgColor.argb, 'FFE8F3EC');
    assert.equal(sheet.getCell('M3').fill.fgColor.argb, 'FFFCE8E6');
    assert.equal(sheet.getCell('P3').fill.fgColor.argb, 'FFFBE9E9');
    assert.equal(sheet.getRow(4).fill.fgColor.argb, 'FFE3EBE6');
    assert.equal(sheet.getRow(5).fill.fgColor.argb, 'FF3F5B50');
    assert.deepEqual(sheet.columns.map((column) => column.width),
        COMPACT_DAILY_XLSX_COLUMNS.map(([, , width]) => width));
    assert.deepEqual(sheet._rows.slice(0, 5).map((item) => item && item.height).filter(Boolean),
        [34, 60, 60, 60, 60]);
    const persistedWorkbook = new ExcelJS.Workbook();
    await persistedWorkbook.xlsx.load(await workbook.xlsx.writeBuffer());
    const persistedSheet = persistedWorkbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    assert.equal(persistedSheet.getCell('L2').fill.fgColor.argb, 'FFFFF2CC');
    assert.equal(persistedSheet.getCell('M3').fill.fgColor.argb, 'FFFCE8E6');
    assert.equal(persistedSheet.getCell('P3').fill.fgColor.argb, 'FFFBE9E9');
});

test('η ανακεφαλαίωση βρίσκεται στο ορατό ημερήσιο φύλλο, εντός printArea και μετά από page break', async () => {
    const report = fixture();
    const workbook = buildEmploymentReviewWorkbook(report);
    const sheet = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    const title = 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ ΣΥΝΟΛΩΝ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ';
    const titleRow = sheet._rows.find((row) => row?.getCell(1).value === title)?.number;
    assert.ok(titleRow, 'ο τίτλος πρέπει να υπάρχει στο ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    const existingGeneralRow = 1 + report.daily.length + report.employees.length + 1;
    assert.equal(titleRow, existingGeneralRow + 2);
    assert.equal(sheet.getCell(`A${existingGeneralRow}`).value, 'ΓΕΝΙΚΟ ΣΥΝΟΛΟ ΠΕΡΙΟΔΟΥ');
    assert.equal(sheet.getCell(`A${titleRow + 1}`).value, 'Κωδικός');
    const firstEmployeeRow = titleRow + 2;
    const lastEmployeeRow = firstEmployeeRow + report.employees.length - 1;
    const recapGeneralRow = lastEmployeeRow + 1;
    assert.equal(sheet.getCell(`A${firstEmployeeRow}`).value, report.employees[0].employeeCode);
    assert.equal(sheet.getCell(`A${lastEmployeeRow}`).value,
        report.employees[report.employees.length - 1].employeeCode);
    assert.equal(sheet.getCell(`A${recapGeneralRow}`).value, 'ΓΕΝΙΚΟ ΣΥΝΟΛΟ');
    assert.equal(recapGeneralRow, sheet.rowCount);
    assert.equal(sheet.pageSetup.printArea, `A1:P${recapGeneralRow}`);
    assert.ok(sheet.rowBreaks.some((item) => item.id === titleRow - 1));
    assert.equal(sheet.getCell(`A${titleRow}`).isMerged, true);
    assert.equal(sheet.getCell(`O${titleRow}`).isMerged, true);
    assert.equal(sheet.getCell(`P${titleRow}`).isMerged, false);
    const recapCodes = [];
    for (let rowNumber = 1; rowNumber < titleRow; rowNumber += 1) {
        for (const column of ['J', 'K', 'L', 'M', 'N', 'O', 'P']) {
            assert.equal(sheet.getCell(`${column}${rowNumber}`).isMerged, false,
                `${column}${rowNumber} δεν πρέπει να είναι merged`);
        }
    }
    for (let rowNumber = titleRow + 1; rowNumber <= recapGeneralRow; rowNumber += 1) {
        assert.equal(sheet.getCell(`J${rowNumber}`).isMerged, true);
        assert.equal(sheet.getCell(`K${rowNumber}`).isMerged, true);
        assert.equal(sheet.getCell(`L${rowNumber}`).isMerged, true);
        assert.equal(sheet.getCell(`M${rowNumber}`).isMerged, true);
        assert.equal(sheet.getCell(`N${rowNumber}`).isMerged, true);
        assert.equal(sheet.getCell(`O${rowNumber}`).isMerged, true);
        assert.equal(sheet.getCell(`P${rowNumber}`).isMerged, false);
        assert.equal(sheet.getCell(`P${rowNumber}`).value, null);
    }
    for (let rowNumber = firstEmployeeRow; rowNumber <= lastEmployeeRow; rowNumber += 1) {
        recapCodes.push(sheet.getCell(`A${rowNumber}`).value);
        for (const column of ['J', 'L', 'N']) {
            assert.equal(String(sheet.getCell(`${column}${rowNumber}`).value).split('\n').length, 5);
            assert.equal(sheet.getCell(`${column}${rowNumber}`).font.size,
                sheet.getCell(`I${rowNumber}`).font.size);
            assert.equal(sheet.getCell(`${column}${rowNumber}`).alignment.wrapText, true);
            assert.equal(sheet.getCell(`${column}${rowNumber}`).alignment.vertical, 'top');
        }
    }
    assert.deepEqual(recapCodes, report.employees.map((employee) => employee.employeeCode));
    for (const column of ['J', 'L', 'N']) {
        assert.equal(String(sheet.getCell(`${column}${recapGeneralRow}`).value).split('\n').length, 5);
        assert.equal(sheet.getCell(`${column}${recapGeneralRow}`).font.size,
            sheet.getCell(`I${recapGeneralRow}`).font.size);
    }
    const compactGeneral = buildCompactDailyXlsxRows(report).find((row) => row.rowType === 'generalTotal');
    ['C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach((column, index) => {
        const keys = ['actualWork', 'absenceHours', 'nightHours', 'holidayWorkHours',
            'additionalWork', 'sixthDayHours', 'seventhDayHours'];
        assert.equal(sheet.getCell(`${column}${recapGeneralRow}`).value, compactGeneral[keys[index]]);
    });
    const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
    const dailySheetXml = await zip.file('xl/worksheets/sheet2.xml').async('string');
    assert.match(dailySheetXml, new RegExp(`<rowBreaks[^>]*>.*<brk id="${titleRow - 1}"[^>]*/>`));
});

test('και τα δύο visible φύλλα χρησιμοποιούν το εγκεκριμένο PDF footer με native αρίθμηση', async () => {
    const workbook = buildEmploymentReviewWorkbook(fixture());
    const currentYear = new Date().getFullYear();
    const copyrightLine = `(c) 2009 - ${currentYear} Copyright: WebPayrollSolutions.com • Ιωλκού 266α Βόλος`;
    const contactLine = 'Τηλ. 2421056825 • Κιν. 6972012650 • eMail: support@WebPayrollSolutions.com';
    for (const name of ['ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ']) {
        const footer = workbook.getWorksheet(name).headerFooter.oddFooter;
        assert.match(footer, /&P/);
        assert.match(footer, /&N/);
        assert.match(footer, /&C/);
        assert.match(footer, /&R/);
        assert.ok(footer.includes(copyrightLine));
        assert.ok(footer.includes(contactLine));
        assert.doesNotMatch(footer, /\r|\n/);
        assert.doesNotMatch(footer, /Σελίδα \d+ \/ \d+/);
    }
    const persisted = new ExcelJS.Workbook();
    await persisted.xlsx.load(await workbook.xlsx.writeBuffer());
    for (const name of ['ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ']) {
        assert.match(persisted.getWorksheet(name).headerFooter.oddFooter, /Σελίδα &P \/ &N/);
    }
});

test('δύο φύλλα είναι visible και το ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ ανοίγει ως active worksheet', () => {
    const workbook = buildEmploymentReviewWorkbook(fixture());
    const visible = workbook.worksheets.filter((sheet) => sheet.state === 'visible');
    assert.deepEqual(visible.map((sheet) => sheet.name), ['ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ']);
    assert.ok(workbook.worksheets.filter((sheet) => !visible.includes(sheet))
        .every((sheet) => sheet.state === 'hidden'));
    const dailyIndex = workbook.worksheets.indexOf(workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ'));
    assert.equal(workbook.views[0].activeTab, dailyIndex);
    assert.equal(workbook.views[0].firstSheet, dailyIndex);
});

test('το ορατό ΑΝΑΚΕΦΑΛΑΙΩΣΗ έχει δυναμικές authoritative rows και ανεξάρτητη εκτύπωση', async () => {
    const report = fixture();
    const workbook = buildEmploymentReviewWorkbook(report);
    const sheet = workbook.getWorksheet('ΑΝΑΚΕΦΑΛΑΙΩΣΗ');
    const headers = ['Κωδικός', 'Εργαζόμενος', 'Πραγματική εργασία', 'Απουσία',
        'Νύχτα', 'Αργίες', 'Πρόσθετη εργασία', '6η ημέρα', '7η ημέρα',
        'Υπερεργασία', 'Νόμιμη Υπερωρία', 'Παράνομη Υπερωρία'];
    assert.equal(sheet.getCell('A1').value, 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ ΣΥΝΟΛΩΝ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ');
    assert.equal(sheet.getCell('A1').isMerged, true);
    assert.equal(sheet.getCell('L1').isMerged, true);
    assert.deepEqual(sheet.getRow(2).values.slice(1), headers);
    assert.equal(sheet.rowCount, report.employees.length + 3);
    assert.deepEqual(sheet.views, [{ state: 'frozen', ySplit: 2 }]);
    assert.deepEqual(sheet.columns.map((column) => column.width),
        [10, 28, 16, 12, 12, 12, 16, 11, 11, 24, 24, 24]);

    const totalFields = [
        'ores_pragmatikhs_ergasias_apologistika', 'ores_apoysias_apologistika',
        'ores_nyxtas_apologistika', 'ores_argion_ergasia_apologistika',
        'ores_prostheths_ergasias_apologistika'
    ];
    report.employees.forEach((employee, index) => {
        const row = sheet.getRow(index + 3);
        assert.equal(row.getCell('A').value, employee.employeeCode);
        assert.equal(row.getCell('B').value, employee.employeeName);
        assert.deepEqual(row.values.slice(3, 8), totalFields.map((field) => employee.totals[field]));
        for (const column of ['J', 'K', 'L']) {
            assert.equal(String(row.getCell(column).value).split('\n').length, 5);
            assert.equal(row.getCell(column).font.size, row.getCell('I').font.size);
            assert.equal(row.getCell(column).alignment.wrapText, true);
            assert.equal(row.getCell(column).alignment.vertical, 'top');
        }
    });
    const generalRow = sheet.getRow(sheet.rowCount);
    assert.equal(generalRow.getCell('A').value, 'ΓΕΝΙΚΟ ΣΥΝΟΛΟ');
    assert.deepEqual(generalRow.values.slice(3, 8),
        totalFields.map((field) => report.summary.totals[field]));
    for (const column of ['J', 'K', 'L']) {
        assert.equal(String(generalRow.getCell(column).value).split('\n').length, 5);
        assert.equal(generalRow.getCell(column).font.size, generalRow.getCell('I').font.size);
    }
    assert.equal(sheet.pageSetup.paperSize, 9);
    assert.equal(sheet.pageSetup.orientation, 'landscape');
    assert.equal(sheet.pageSetup.fitToPage, true);
    assert.equal(sheet.pageSetup.fitToWidth, 1);
    assert.equal(sheet.pageSetup.fitToHeight, 0);
    assert.equal(sheet.pageSetup.printArea, `A1:L${sheet.rowCount}`);
    assert.equal(sheet.pageSetup.printTitlesRow, '2:2');
    assert.equal(sheet.pageSetup.showGridLines, false);
    assert.equal(sheet.pageSetup.showRowColHeaders, false);

    const persisted = new ExcelJS.Workbook();
    await persisted.xlsx.load(await workbook.xlsx.writeBuffer());
    const persistedSheet = persisted.getWorksheet('ΑΝΑΚΕΦΑΛΑΙΩΣΗ');
    assert.equal(persistedSheet.pageSetup.printArea, `A1:L${persistedSheet.rowCount}`);
    assert.equal(persistedSheet.pageSetup.printTitlesRow, '2:2');
});

test('οι N–P έχουν πέντε γραμμές και totals ίσα με τα τέσσερα authoritative components', () => {
    const source = row({ kodikos: '0042', hmeromhnia: new Date('2026-06-20T00:00:00.000Z'),
        ores_yperergasias_apologistika: 1, ores_yperergasias_nyxtas_apologistika: 2,
        ores_yperergasias_argion_apologistika: 3, ores_yperergasias_argion_nyxtas_apologistika: 4,
        ores_nominhs_yperorias_apologistika: 0.1, ores_nominhs_yperorias_nyxtas_apologistika: 0.2,
        ores_nominhs_yperorias_argion_apologistika: 0.3,
        ores_nominhs_yperorias_argion_nyxtas_apologistika: 0.4,
        ores_paranomhs_yperorias_apologistika: 1.1,
        ores_paranomhs_yperorias_nyxtas_apologistika: 1.2,
        ores_paranomhs_yperorias_argion_apologistika: 1.3,
        ores_paranomhs_yperorias_argion_nyxtas_apologistika: 1.4,
        orphan_card_resolution_preview: null, orphan_card_resolution: null });
    const report = buildEmploymentReviewReportProjection({ rows: [source] });
    const rows = buildCompactDailyXlsxRows(report);
    for (const [key, fields] of Object.entries(OVERTIME_COMPONENTS)) {
        assert.equal(rows[0][key].split('\n').length, 5);
        const expected = fields.reduce((sum, field) => sum + Number(source[field]), 0);
        assert.equal(overtimeValues(report.daily[0].values, fields).total, Number(expected.toFixed(2)));
        assert.match(rows[0][key], new RegExp(`^Σύνολο: ${expected.toFixed(2)}`));
        assert.equal(rows[1][key], rows[0][key]);
        assert.equal(rows[2][key], rows[1][key]);
    }
});

test('inline employee/general totals ισούνται με daily sums και οι 6η/7η ώρες απαιτούν authoritative flag', () => {
    const rows = [
        row({ kodikos: '0001', hmeromhnia: new Date('2026-06-01T00:00:00.000Z'),
            ores_ergasias_apologistika: 8, policy: { classification: 'SIXTH', sixthDayRate: 0 },
            ores_yperergasias_apologistika: 1, ores_nominhs_yperorias_nyxtas_apologistika: 0.5,
            orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0001', hmeromhnia: new Date('2026-06-02T00:00:00.000Z'),
            ores_ergasias_apologistika: 7, policy: { classification: 'NORMAL' },
            orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0002', hmeromhnia: new Date('2026-06-07T00:00:00.000Z'),
            ores_ergasias_apologistika: 6, policy: { classification: 'SEVENTH' },
            ores_yperergasias_argion_apologistika: 2,
            ores_paranomhs_yperorias_argion_nyxtas_apologistika: 0.75,
            orphan_card_resolution_preview: null, orphan_card_resolution: null })
    ];
    const report = buildEmploymentReviewReportProjection({ rows });
    const output = buildCompactDailyXlsxRows(report);
    const employeeTotals = output.filter((item) => item.rowType === 'employeeTotal');
    const general = output.find((item) => item.rowType === 'generalTotal');
    assert.deepEqual(output.filter((item) => item.rowType === 'daily')
        .map((item) => [item.sixthDayHours, item.seventhDayHours]), [[8, 0], [0, 0], [0, 6]]);
    for (const key of COMPACT_DAILY_NUMERIC_KEYS) assert.equal(general[key],
        Number(employeeTotals.reduce((sum, item) => sum + item[key], 0).toFixed(2)), key);
    for (const key of Object.keys(OVERTIME_COMPONENTS)) {
        assert.equal(general[key].split('\n').length, 5);
        const parse = (value) => String(value).split('\n').map((line) => Number(line.split(': ')[1]));
        const generalValues = parse(general[key]);
        const employeeValues = employeeTotals.map((item) => parse(item[key]));
        generalValues.forEach((value, index) => assert.equal(value,
            Number(employeeValues.reduce((sum, components) => sum + components[index], 0).toFixed(2)),
            `${key}/${index}`));
    }
});
