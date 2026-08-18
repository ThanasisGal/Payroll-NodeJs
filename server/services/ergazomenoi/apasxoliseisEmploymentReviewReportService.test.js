'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
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
    employmentStatusLabel
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
    assert.equal(exported.getCell('classification').value, 'ΑΝ');
    assert.equal(exported.getCell('classificationLabel').value, 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ');
    assert.equal(exported.getCell('repo').value, 'ΝΑΙ');
    assert.equal(exported.getCell('apologistikoBook').value, 'ΝΑΙ');
    assert.notEqual(exported.getCell('classification').value, 'ΕΡΓ');
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

test('το XLSX διατηρεί όλα τα απολογιστικά αριθμητικά πεδία ως αριθμούς με 0.00', () => {
    const workbook = buildEmploymentReviewWorkbook(fixture());
    const sheet = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    for (const [field] of DAILY_NUMBER_FIELDS) {
        assert.equal(sheet.getColumn(field).numFmt, '0.00', field);
        assert.equal(typeof sheet.getRow(2).getCell(field).value, 'number', field);
    }
    assert.equal(sheet.getColumn('sixthDayRate').numFmt, '0.00');
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
        'ΣΥΝΟΨΗ', 'ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', 'ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ',
        'ΑΠΟΦΑΣΕΙΣ ΣΤΑΔΙΩΝ', 'ΕΒΔΟΜΑΔΙΑΙΟΣ ΕΛΕΓΧΟΣ', 'ΙΧΝΗΛΑΣΙΜΟΤΗΤΑ'
    ]);
    const sheet = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    assert.ok(sheet.getColumn('sixth').values.includes('ΝΑΙ'));
    assert.ok(sheet.getColumn('sixthDayRate').values.includes(0));
    const totals = workbook.getWorksheet('ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ');
    assert.equal(totals.getRow(totals.rowCount).getCell('employeeCode').value, 'ΓΕΝΙΚΟ ΣΥΝΟΛΟ');
    TOTAL_NUMBER_FIELDS.forEach(([field]) => assert.equal(totals.getColumn(field).numFmt, '0.00'));
    assert.ok((await workbook.xlsx.writeBuffer()).byteLength > 1000);
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

test('το κοινό PDF footer χρησιμοποιεί δυναμικό έτος και διατηρεί την αρίθμηση σελίδων', () => {
    const lines = pdfFooterLines(2, 7);
    assert.match(lines[0], new RegExp(`^\\(c\\) 2009 - ${new Date().getFullYear()}  Copyright: WebPayrollSolutions\\.com`));
    assert.match(lines.join(' '), /Ιωλκού 266α Βόλος/);
    assert.match(lines.join(' '), /Τηλ\. 2421056825/);
    assert.match(lines.join(' '), /Κιν\. 6972012650/);
    assert.match(lines.join(' '), /support@WebPayrollSolutions\.com/);
    assert.match(lines[1], /Σελίδα 2 \/ 7$/);
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
    assert.equal(sheet.getColumn('employmentStatus').values[2], 'ΜΕΡΙΚΗ');
    assert.equal(sheet.getColumn('employmentStatus').values[3], 'ΠΛΗΡΗΣ');
    assert.equal(sheet.getColumn('employmentStatus').values[4], 'ΠΛΗΡΗΣ');
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
    assert.equal(sheet.getColumn('leaveCategory').values[2], '');
    assert.equal(sheet.getColumn('leaveCategory').values[3], '');
    assert.equal(sheet.getColumn('leaveCategory').values[4], 'ΑΔΚΑΝ');
    assert.equal(sheet.getColumn('leaveCategory').values[5], 'ΑΔΑΣ');
});
