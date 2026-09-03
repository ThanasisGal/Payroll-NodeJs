'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const {
    buildEmploymentReviewReportProjection,
    buildEmploymentReviewWorkbook,
    buildEmploymentReviewPdf,
    dailyAnalysis,
    REPORT_SCHEMA_VERSION,
    DAILY_NUMBER_FIELDS,
    TOTAL_NUMBER_FIELDS,
    COUNT_FIELDS,
    employmentStatusLabel,
    SIMPLE_PDF_SUMMARY_COLUMNS,
    buildSimplePdfSummaryRows,
    simplePdfFooterLayout,
    DAILY_DETAIL_FONT_SIZE,
    SUMMARY_FONT_SIZE,
    buildSimplePdfFileName,
    SIMPLE_PDF_GRAND_TOTAL_FILL,
    simplePdfSummaryFill,
    buildDossierWeekNarrative,
    buildDossierPdfFileName
} = require('./apasxoliseisEmploymentReviewReportService');
const { buildStage1Fingerprint } = require('./apasxoliseisStage1FingerprintService');
const {
    buildWeeklyHrLifecycleProjection
} = require('./apasxoliseisWeeklyHrLifecycleProjectionService');

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
            policy: { classification: 'SIXTH', sixthDayRate: 0, sixthDayHours: 8 }, orphan_card_resolution_preview: null,
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

test('canonical και legacy orphan metadata έχουν ίδια ασφαλή παρουσίαση', () => {
    const canonical = buildEmploymentReviewReportProjection({ rows: [row({
        orphan_card_resolution: { status: 'HR_APPROVED', reuse_scope: 'FUTURE_IDENTICAL',
            rest_violation: true, risk_acknowledged: true }
    })] }).daily[0].orphan;
    const legacy = buildEmploymentReviewReportProjection({ rows: [row({
        orphan_card_resolution: { status: 'HR_APPROVED', resolution_scope: 'FUTURE_IDENTICAL',
            rest_conflicts: ['PREVIOUS'], rest_risk_acknowledged: true }
    })] }).daily[0].orphan;
    assert.equal(canonical.reuseScope, legacy.reuseScope);
    assert.equal(canonical.restViolation, true);
    assert.equal(legacy.restViolation, true);
    assert.equal(canonical.riskAcknowledged, true);
    assert.equal(legacy.riskAcknowledged, true);
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

test('χωρίς lifecycle η 6η και η 7η ημέρα προέρχονται από την ήδη υπολογισμένη πολιτική', () => {
    const report = buildEmploymentReviewReportProjection({ rows: [
        row({ kodikos: '0051', employeeName: 'ΕΚΤΗ ΗΜΕΡΑ ΧΩΡΙΣ LIFECYCLE',
            hmeromhnia: new Date('2026-06-13T00:00:00.000Z'),
            policy: { classification: 'SIXTH', sixthDayRate: 40, sixthDayHours: 8 },
            orphan_card_resolution_preview: null, orphan_card_resolution: null }),
        row({ kodikos: '0052', employeeName: 'ΕΒΔΟΜΗ ΗΜΕΡΑ ΧΩΡΙΣ LIFECYCLE',
            hmeromhnia: new Date('2026-06-14T00:00:00.000Z'),
            policy: { classification: 'SEVENTH' },
            orphan_card_resolution_preview: null, orphan_card_resolution: null })
    ], lifecycleByWeek: new Map() });

    assert.equal(report.daily.find((item) => item.employeeCode === '0051').sixthDay, true);
    assert.equal(report.daily.find((item) => item.employeeCode === '0052').seventhDay, true);
    assert.equal(report.summary.sixthDays, 1);
    assert.equal(report.summary.seventhDays, 1);
    assert.equal(report.summary.counts.sixthDays, 1);
    assert.equal(report.summary.counts.seventhDays, 1);
});

test('η κλασική τελική εβδομαδιαία ανάλυση υπερισχύει του NORMAL policy και μεταφέρει ώρες', () => {
    const rows = [
        row({ kodikos: '0053', hmeromhnia: new Date('2026-06-13T00:00:00.000Z'),
            policy: { classification: 'NORMAL' }, orphan_card_resolution_preview: null,
            orphan_card_resolution: null }),
        row({ kodikos: '0053', hmeromhnia: new Date('2026-06-14T00:00:00.000Z'),
            policy: { classification: 'NORMAL' }, orphan_card_resolution_preview: null,
            orphan_card_resolution: null })
    ];
    const finalWeeklyAnalysisByWeek = new Map([['0053|2026-06-08', {
        status: 'READY',
        sixthDay: { hmeromhnia: '2026-06-13', sixthDayHours: 7.5, premiumRate: 40 },
        seventhDay: { hmeromhnia: '2026-06-14', actualWorkHours: 6.25 }
    }]]);
    const report = buildEmploymentReviewReportProjection({ rows, lifecycleByWeek: new Map(),
        finalWeeklyAnalysisByWeek });

    assert.equal(report.daily[0].sixthDay, true);
    assert.equal(report.daily[0].sixthDayHours, 7.5);
    assert.equal(report.daily[1].seventhDay, true);
    assert.equal(report.daily[1].seventhDayHours, 6.25);
    assert.equal(report.employees[0].totals.sixthDayHours, 7.5);
    assert.equal(report.employees[0].totals.seventhDayHours, 6.25);
    assert.equal(report.summary.totals.sixthDayHours, 7.5);
    assert.equal(report.summary.totals.seventhDayHours, 6.25);
    assert.equal(report.summary.counts.sixthDays, 1);
    assert.equal(report.summary.counts.seventhDays, 1);
});

test('η 7η ημέρα καταναλώνεται από την authoritative export projection χωρίς επανυπολογισμό', () => {
    const rawOnly = row({ kodikos: '0026', hmeromhnia: new Date('2026-06-14T00:00:00.000Z'),
        policy: { classification: 'SEVENTH' }, repo_apologistika: true,
        orphan_card_resolution_preview: null, orphan_card_resolution: null });
    let report = buildEmploymentReviewReportProjection({ rows: [rawOnly] });
    assert.equal(report.daily[0].seventhDay, true);
    assert.equal(report.weekly[0].seventhDay, '2026-06-14');

    const lifecycleByWeek = new Map([['0026|2026-06-08', {
        stages: { stage1: {}, stage2: {}, stage3: {}, stage4: {
            final_weekly_analysis: { seventhDay: { hmeromhnia: '2026-06-14' } }
        } }
    }]]);
    report = buildEmploymentReviewReportProjection({ rows: [rawOnly], lifecycleByWeek });
    assert.equal(report.daily[0].seventhDay, true);
    assert.equal(report.weekly[0].seventhDay, '2026-06-14');
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
    const exportedCategory = exported.getCell(5).value.richText.map((part) => part.text).join('');
    assert.match(exportedCategory, /Απολ\.: ΑΝ/);
    assert.doesNotMatch(exportedCategory, /Απολ\.: ΕΡΓ/);
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

test('το XLSX διατηρεί αριθμητικές τις βασικές ώρες και πλήρη ανάλυση υπερωριών', () => {
    const workbook = buildEmploymentReviewWorkbook(fixture());
    const sheet = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    for (const column of [7, 8, 9, 10, 11, 12, 13]) {
        assert.equal(sheet.getColumn(column).numFmt, '0.00');
    }
    for (const column of [14, 15, 16]) {
        assert.match(String(sheet.getRow(2).getCell(column).value),
            /Σύνολο:[\s\S]*Απλή:[\s\S]*Νύχτα:[\s\S]*Αργία:[\s\S]*Αργία\+Νύχτα:/);
    }
});

test('οι κατηγορίες εξαγωγής ταυτίζονται με την ημερήσια σημασιολογία του Stage4', () => {
    const policyContextRows = Array.from({ length: 7 }, (_, index) => row({
        kodikos: '0001', hmeromhnia: new Date(Date.UTC(2026, 5, 1 + index)),
        kathgoria_ergasias: index === 0 ? 'ΑΝ' : 'ΕΡΓ', repo: index === 0,
        ores_ergasias: 8,
        cards_apo_ora_01: index === 1 ? '' : '09:00',
        cards_eos_ora_01: index === 1 ? '' : '17:00',
        cards_ores_ergasias: index === 1 ? 0 : 8,
        apo_ora_01_apologistika: index === 1 ? '' : '09:00',
        eos_ora_01_apologistika: index === 1 ? '' : '17:00',
        ores_ergasias_apologistika: index === 1 ? 0 : 8,
        ores_pragmatikhs_ergasias_apologistika: index === 1 ? 0 : 8,
        kathgoria_ergasias_apologistika: index === 1 ? '' : 'ΕΡΓ',
        kathgoria_adeias_apologistika: index === 1 ? 'POSSIBLE_LEAVE' : '',
        orphan_card_resolution_preview: null, orphan_card_resolution: null
    }));
    const effectiveProfile = { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: '0' };
    const effectiveProfilesByDate = Object.fromEntries(policyContextRows.map((item) => [
        item.hmeromhnia.toISOString().slice(0, 10), effectiveProfile
    ]));
    const dateKeys = Object.keys(effectiveProfilesByDate);
    const lifecycle = buildWeeklyHrLifecycleProjection({
        weekRows: policyContextRows,
        effectiveProfile,
        effectiveProfilesByDate,
        persistedStage1State: { status: 'COMPLETED', completion_fingerprint:
            buildStage1Fingerprint(policyContextRows).fingerprint },
        scope: { employee_kodikos: '0001', week_start: new Date('2026-06-01T00:00:00.000Z'),
            week_end: new Date('2026-06-07T00:00:00.000Z') },
        periodScope: null,
        employmentDateScope: { employment_owned_dates: dateKeys,
            authoritative_date_set: dateKeys, is_full_natural_week: true }
    });
    const derivedItems = lifecycle.stages.stage3.stage2_automatic_resolution_items;
    assert.deepEqual(derivedItems, [{ date: '2026-06-02', classification: 'REST_REPO',
        reason: 'DETERMINISTIC_STAGE2_REPO_RESOLUTION' }]);
    const stage2DailyResolutionsByDate = new Map(derivedItems.map((item) => [
        `0001|${item.date}`, item
    ]));
    const report = buildEmploymentReviewReportProjection({ rows: [
        row({ kodikos: '0001', employeeName: 'ΕΛΕΓΧΟΣ ΚΑΤΗΓΟΡΙΩΝ',
            hmeromhnia: new Date('2026-06-01T00:00:00.000Z'),
            kathgoria_ergasias_original: 'ΑΝ', kathgoria_ergasias: 'ΕΡΓ',
            kathgoria_ergasias_apologistika: 'ΕΡΓ', repo: true,
            repo_apologistika: false, orphan_card_resolution_preview: null,
            orphan_card_resolution: null }),
        row({ kodikos: '0001', employeeName: 'ΕΛΕΓΧΟΣ ΚΑΤΗΓΟΡΙΩΝ',
            hmeromhnia: new Date('2026-06-02T00:00:00.000Z'),
            kathgoria_ergasias_original: 'ΕΡΓ', kathgoria_ergasias: 'ΕΡΓ',
            kathgoria_ergasias_apologistika: 'ΕΡΓ', kathgoria_ergasias_effective: 'ΕΡΓ',
            repo_apologistika: false, orphan_card_resolution_preview: null,
            orphan_card_resolution: null }),
        row({ kodikos: '0001', employeeName: 'ΕΛΕΓΧΟΣ ΚΑΤΗΓΟΡΙΩΝ',
            hmeromhnia: new Date('2026-06-03T00:00:00.000Z'),
            kathgoria_ergasias_original: 'ΕΡΓ', kathgoria_ergasias: 'ΕΡΓ',
            kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: false,
            orphan_card_resolution_preview: null, orphan_card_resolution: null })
    ], stage2DailyResolutionsByDate });
    assert.deepEqual(report.daily.map((item) => [item.date, item.declaredCategory,
        item.finalCategory]), [
        ['2026-06-01', 'ΑΝ', 'ΕΡΓ'],
        ['2026-06-02', 'ΕΡΓ', 'ΑΝ'],
        ['2026-06-03', 'ΕΡΓ', 'ΕΡΓ']
    ]);
    assert.equal(report.daily[0].finalCategorySource, 'CANONICAL_DAILY');
    assert.equal(report.daily[1].finalCategorySource, 'STAGE2_FINAL_PROJECTION');

    const sheet = buildEmploymentReviewWorkbook(report).getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    const categoryCell = (rowNumber) => sheet.getRow(rowNumber).getCell(5).value;
    assert.equal(categoryCell(2).richText.map((part) => part.text).join(''),
        'Προδ.: ΑΝ\n\nΑπολ.: ΕΡΓ');
    assert.equal(categoryCell(2).richText.at(-1).font.bold, true);
    assert.equal(categoryCell(3).richText.map((part) => part.text).join(''),
        'Προδ.: ΕΡΓ\n\nΑπολ.: ΑΝ');
    assert.equal(categoryCell(3).richText.at(-1).font.bold, true);
    assert.equal(categoryCell(4).richText.map((part) => part.text).join(''),
        'Προδ.: ΕΡΓ\n\nΑπολ.: ΕΡΓ');
    assert.notEqual(categoryCell(4).richText.at(-1).font.bold, true);
    [2, 3, 4].forEach((rowNumber) => assert.equal(
        categoryCell(rowNumber).richText.slice(0, -1).some((part) => part.font.bold === true), false));
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

test('το βιβλίο έχει ακριβώς επτά φύλλα, δύο ορατά και πλήρες print contract', async () => {
    const workbook = buildEmploymentReviewWorkbook(fixture());
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
        'ΣΥΝΟΨΗ', 'ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ', 'ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ',
        'ΑΠΟΦΑΣΕΙΣ ΣΤΑΔΙΩΝ', 'ΕΒΔΟΜΑΔΙΑΙΟΣ ΕΛΕΓΧΟΣ', 'ΙΧΝΗΛΑΣΙΜΟΤΗΤΑ'
    ]);
    assert.deepEqual(workbook.worksheets.filter((sheet) => sheet.state === 'visible')
        .map((sheet) => sheet.name), ['ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ']);
    workbook.worksheets.filter((sheet) => !['ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ']
        .includes(sheet.name)).forEach((sheet) => assert.equal(sheet.state, 'hidden'));

    const sheet = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    assert.equal(sheet.columnCount, 16);
    assert.deepEqual(sheet.getRow(1).values.slice(1), [
        'Εργαζόμενος', 'Ημερομηνία / Καθεστώς', 'Προδηλωμένο', 'Κάρτες',
        'Κατηγορίες εργασίας', 'Απολογιστικό', 'Πραγματική εργασία', 'Απουσία',
        'Νύχτα', 'Αργίες', 'Πρόσθετη εργασία', '6η ημέρα', '7η ημέρα',
        'Υπερεργασία', 'Νόμιμη Υπερωρία', 'Παράνομη Υπερωρία'
    ]);
    assert.deepEqual(sheet.columns.map((column) => column.width),
        [18, 14, 13, 15, 14, 15, 10, 9, 8, 8, 9, 7, 7, 18, 18, 18]);
    assert.equal(sheet.views[0].xSplit, 1);
    assert.equal(sheet.views[0].ySplit, 1);
    assert.equal(sheet.pageSetup.paperSize, 9);
    assert.equal(sheet.pageSetup.orientation, 'landscape');
    assert.equal(sheet.pageSetup.fitToWidth, 1);
    assert.equal(sheet.pageSetup.fitToHeight, 0);
    assert.equal(sheet.pageSetup.horizontalCentered, true);
    assert.equal(sheet.pageSetup.verticalCentered, false);
    assert.equal(sheet.pageSetup.printTitlesRow, '1:1');
    assert.equal(sheet.pageSetup.printArea, `A1:P${sheet.rowCount}`);
    assert.match(sheet.headerFooter.oddHeader, /&L&"DejaVu Sans"&9(?:0004)/);
    assert.match(sheet.headerFooter.oddHeader, /Περίοδος από 01\/06\/2026 έως 30\/06\/2026/);
    assert.match(sheet.headerFooter.oddHeader, /Ημερομηνία - Ώρα Εκτύπωσης: &D &T/);
    assert.match(sheet.headerFooter.oddFooter, /www\.WebPayrollSolutions\.com/);
    assert.match(sheet.headerFooter.oddFooter, /Σελίδα &P \/ &N/);

    const recap = workbook.getWorksheet('ΑΝΑΚΕΦΑΛΑΙΩΣΗ');
    assert.equal(recap.columnCount, 12);
    assert.equal(recap.getCell('A1').value, 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ ΣΥΝΟΛΩΝ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ');
    assert.deepEqual(recap.getRow(2).values.slice(1), [
        'Κωδικός', 'Εργαζόμενος', 'Πραγματική εργασία', 'Απουσία', 'Νύχτα', 'Αργίες',
        'Πρόσθετη εργασία', '6η ημέρα', '7η ημέρα', 'Υπερεργασία',
        'Νόμιμη Υπερωρία', 'Παράνομη Υπερωρία'
    ]);
    assert.deepEqual(recap.columns.map((column) => column.width),
        [10, 28, 16, 12, 12, 12, 16, 11, 11, 24, 24, 24]);
    assert.equal(recap.pageSetup.paperSize, 9);
    assert.equal(recap.pageSetup.orientation, 'landscape');
    assert.equal(recap.pageSetup.fitToWidth, 1);
    assert.equal(recap.pageSetup.fitToHeight, 0);
    assert.equal(recap.pageSetup.printTitlesRow, '2:2');
    assert.equal(recap.pageSetup.printArea, `A1:L${recap.rowCount}`);
    assert.equal(recap.headerFooter.oddHeader, sheet.headerFooter.oddHeader);
    assert.equal(recap.headerFooter.oddFooter, sheet.headerFooter.oddFooter);

    workbook.worksheets.forEach((worksheet) => {
        for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
            for (let column = 1; column <= worksheet.columnCount; column += 1) {
                const font = worksheet.getRow(rowNumber).getCell(column).font;
                assert.equal(font.name, 'DejaVu Sans', `${worksheet.name}!${rowNumber}:${column}`);
                assert.equal(font.size, 9, `${worksheet.name}!${rowNumber}:${column}`);
            }
        }
    });
    const sixthRow = sheet.getRows(1, sheet.rowCount)
        .find((row) => String(row.getCell(1).value).startsWith('0025 —'));
    assert.equal(sixthRow.getCell(12).value, 8);
    const totals = workbook.getWorksheet('ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ');
    assert.equal(totals.getRow(totals.rowCount).getCell('employeeCode').value, 'ΓΕΝΙΚΟ ΣΥΝΟΛΟ');
    TOTAL_NUMBER_FIELDS.forEach(([field]) => assert.equal(totals.getColumn(field).numFmt, '0.00'));
    const buffer = await workbook.xlsx.writeBuffer();
    assert.ok(buffer.byteLength > 1000);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer);
    assert.deepEqual(loaded.worksheets.filter((worksheet) => worksheet.state === 'visible')
        .map((worksheet) => worksheet.name), ['ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ']);
    loaded.worksheets.forEach((worksheet) => assert.equal(worksheet.state,
        ['ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ'].includes(worksheet.name)
            ? 'visible' : 'hidden', worksheet.name));
    assert.equal(loaded.getWorksheet('ΣΥΝΟΨΗ').state, 'hidden');
    assert.equal(loaded.views[0].activeTab, 1);
    assert.equal(loaded.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ').pageSetup.printArea,
        `A1:P${sheet.rowCount}`);
    assert.equal(loaded.getWorksheet('ΑΝΑΚΕΦΑΛΑΙΩΣΗ').pageSetup.printArea,
        `A1:L${recap.rowCount}`);
    loaded.worksheets.forEach((worksheet) => worksheet.eachRow({ includeEmpty: true },
        (row) => row.eachCell({ includeEmpty: true }, (cell) => {
            assert.equal(cell.font.name, 'DejaVu Sans');
            assert.equal(cell.font.size, 9);
        })));
});

test('το κλασικό Excel αποδίδει projected 6η/7η, rich κατηγορίες και ίδια πλήρη ανάλυση συνόλων', () => {
    const sourceValues = {
        ores_yperergasias_apologistika: 1,
        ores_yperergasias_nyxtas_apologistika: 2,
        ores_yperergasias_argion_apologistika: 3,
        ores_yperergasias_argion_nyxtas_apologistika: 4,
        ores_nominhs_yperorias_apologistika: 0.5,
        ores_nominhs_yperorias_nyxtas_apologistika: 1.5,
        ores_nominhs_yperorias_argion_apologistika: 2.5,
        ores_nominhs_yperorias_argion_nyxtas_apologistika: 3.5,
        ores_paranomhs_yperorias_apologistika: 0.25,
        ores_paranomhs_yperorias_nyxtas_apologistika: 0.5,
        ores_paranomhs_yperorias_argion_apologistika: 0.75,
        ores_paranomhs_yperorias_argion_nyxtas_apologistika: 1
    };
    const report = buildEmploymentReviewReportProjection({ rows: [
        row({ kodikos: '0060', employeeName: 'ΕΛΕΓΧΟΣ ΠΡΟΒΟΛΗΣ',
            hmeromhnia: new Date('2026-06-13T00:00:00.000Z'),
            kathgoria_ergasias: 'ΑΝ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
            policy: { classification: 'NORMAL' },
            orphan_card_resolution_preview: null, orphan_card_resolution: null, ...sourceValues }),
        row({ kodikos: '0060', employeeName: 'ΕΛΕΓΧΟΣ ΠΡΟΒΟΛΗΣ',
            hmeromhnia: new Date('2026-06-14T00:00:00.000Z'),
            kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
            policy: { classification: 'NORMAL' },
            orphan_card_resolution_preview: null, orphan_card_resolution: null })
    ], lifecycleByWeek: new Map(), finalWeeklyAnalysisByWeek: new Map([['0060|2026-06-08', {
        status: 'READY',
        sixthDay: { hmeromhnia: '2026-06-13', sixthDayHours: 7.5, premiumRate: 40 },
        seventhDay: { hmeromhnia: '2026-06-14', actualWorkHours: 6.25 }
    }]]), metadata: {
        companyName: 'ΕΤΑΙΡΕΙΑ ΔΟΚΙΜΗΣ', periodStart: '2026-06-01', periodEnd: '2026-06-30'
    } });
    const workbook = buildEmploymentReviewWorkbook(report);
    const daily = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    const recap = workbook.getWorksheet('ΑΝΑΚΕΦΑΛΑΙΩΣΗ');

    assert.equal(daily.getRow(2).getCell(12).value, 7.5);
    assert.equal(daily.getRow(3).getCell(13).value, 6.25);
    assert.equal(recap.getRow(3).getCell(8).value, 7.5);
    assert.equal(recap.getRow(3).getCell(9).value, 6.25);
    assert.equal(daily.getRow(4).getCell(12).value, 7.5);
    assert.equal(daily.getRow(4).getCell(13).value, 6.25);
    assert.equal(daily.getRow(5).getCell(12).value, 7.5);
    assert.equal(daily.getRow(5).getCell(13).value, 6.25);
    assert.equal(recap.getRow(4).getCell(8).value, 7.5);
    assert.equal(recap.getRow(4).getCell(9).value, 6.25);

    const category = daily.getRow(2).getCell(5).value;
    assert.equal(category.richText.map((part) => part.text).join(''),
        'Προδ.: ΑΝ\n\nΑπολ.: ΕΡΓ');
    assert.equal(category.richText.at(-1).text, 'ΕΡΓ');
    assert.equal(category.richText.at(-1).font.bold, true);
    assert.equal(category.richText.slice(0, -1).some((part) => part.font.bold === true), false);
    assert.equal(daily.getRow(2).getCell(5).alignment.wrapText, true);
    assert.equal(daily.getRow(2).getCell(5).alignment.vertical, 'middle');

    const expected = [
        ['Σύνολο: 10,00', 'Απλή: 1,00', 'Νύχτα: 2,00', 'Αργία: 3,00', 'Αργία+Νύχτα: 4,00'],
        ['Σύνολο: 8,00', 'Απλή: 0,50', 'Νύχτα: 1,50', 'Αργία: 2,50', 'Αργία+Νύχτα: 3,50'],
        ['Σύνολο: 2,50', 'Απλή: 0,25', 'Νύχτα: 0,50', 'Αργία: 0,75', 'Αργία+Νύχτα: 1,00']
    ];
    for (const [offset, lines] of expected.entries()) {
        for (const target of [daily.getRow(4).getCell(14 + offset),
            daily.getRow(5).getCell(14 + offset), recap.getRow(3).getCell(10 + offset),
            recap.getRow(4).getCell(10 + offset)]) {
            lines.forEach((line) => assert.match(target.value, new RegExp(line.replace('+', '\\+'))));
            assert.equal(target.alignment.wrapText, true);
            assert.equal(target.alignment.vertical, 'middle');
        }
    }
    const sameCategory = daily.getRow(3).getCell(5).value;
    assert.equal(sameCategory.richText.at(-1).text, 'ΕΡΓ');
    assert.notEqual(sameCategory.richText.at(-1).font.bold, true);
    assert.equal(daily.getRow(2).height, 60.0945);
    assert.equal(daily.getRow(3).height, 60.0945);
    assert.equal(daily.getRow(4).height, 68);
    assert.equal(daily.getRow(5).height, 68);
    assert.equal(recap.getRow(3).height, 60);
    assert.equal(recap.getRow(4).getCell(2).value, 'ΓΕΝΙΚΑ ΣΥΝΟΛΑ');
    assert.equal(recap.getRow(4).height, 68);
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

test('η ανθρώπινη εβδομαδιαία τεκμηρίωση εξηγεί ΑΝ → ΕΡΓ και μεταφορά ρεπό με λόγο', () => {
    const narrative = buildDossierWeekNarrative({
        weekStart: '2026-06-01', weekEnd: '2026-06-07',
        stage1Decisions: [
            { date: '2026-06-01', initial: 'ΑΝ', result: 'ΕΡΓ', reason: '' },
            { date: '2026-06-02', initial: 'ΕΡΓ', result: 'ΑΝ', reason: '' }
        ],
        automaticRepoResolutions: [{ sourceDate: '2026-06-01', targetDate: '2026-06-02',
            reason: 'DETERMINISTIC_STAGE2_REPO_RESOLUTION' }],
        repoDecisions: [], stage3Decisions: [], sixthDay: '', seventhDay: '',
        totals: { ores_prostheths_ergasias_apologistika: 0 }
    }, [
        { date: '2026-06-01', declaredCategory: 'ΑΝ', finalCategory: 'ΕΡΓ', cards: '09:00–17:00' },
        { date: '2026-06-02', declaredCategory: 'ΕΡΓ', finalCategory: 'ΑΝ', cards: '' }
    ]);
    assert.equal(narrative.title, 'Εβδομάδα 01/06/2026 – 07/06/2026');
    assert.match(narrative.summary, /μεταφορά ρεπό/);
    assert.equal(narrative.events.length, 1);
    assert.match(narrative.events[0], /01\/06\/2026[\s\S]*προδηλωθεί ΑΝ[\s\S]*προέκυψε ΕΡΓ/);
    assert.match(narrative.events[0], /μεταφορά ρεπό από τις 01\/06\/2026 στις 02\/06\/2026/);
    assert.match(narrative.events[0], /τελική κατάσταση[\s\S]*ΑΝ/);
    assert.match(narrative.events[0], /Η αλλαγή αυτή έγινε επειδή/);
    narrative.events.forEach((event) => assert.match(event,
        /επειδή|βασίστηκε|βασίζεται|προέκυψε/));
});

test('εβδομάδα χωρίς ουσιώδη μεταβολή έχει σύντομη καθαρή σύνοψη', () => {
    const narrative = buildDossierWeekNarrative({ weekStart: '2026-06-22',
        weekEnd: '2026-06-28', stage1Decisions: [
            { date: '2026-06-22', initial: 'ΕΡΓ', result: 'ΕΡΓ', reason: '' }
        ], automaticRepoResolutions: [], repoDecisions: [], stage3Decisions: [],
        sixthDay: '', seventhDay: '', totals: {} }, []);
    assert.deepEqual(narrative.events, []);
    assert.equal(narrative.summary,
        'Κατά την εβδομάδα αυτή δεν προέκυψε ουσιώδης μεταβολή μεταξύ των προδηλωμένων ' +
        'και των τελικών στοιχείων και δεν απαιτήθηκε ανθρώπινη παρέμβαση.');
});

test('η αφήγηση καλύπτει ορφανά εισόδου/εξόδου, HR, επαναχρησιμοποίηση και 11ωρη ανάπαυση', () => {
    const narrative = buildDossierWeekNarrative({ weekStart: '2026-06-08',
        weekEnd: '2026-06-14', stage1Decisions: [], automaticRepoResolutions: [],
        repoDecisions: [{ sourceDate: '2026-06-08', targetDate: '2026-06-09',
            result: 'Εγκρίθηκε η πρόταση', reason: 'Οι κάρτες επιβεβαίωσαν εργασία',
            source: 'HR', actor: 'ΥΠΕΥΘΥΝΟΣ HR', decidedAt: '2026-07-15',
            reuseScope: 'Επαναχρησιμοποιήσιμη πολιτική ίδιου παραρτήματος' }],
        stage3Decisions: [], sixthDay: '', seventhDay: '', totals: {}
    }, [
        { date: '2026-06-12', orphan: { type: 'START_ONLY', status: 'Επιλυμένο με έγκριση HR',
            rawPunch: '08:05–—', approvedInterval: '08:05–16:03', approvedBy: 'HR USER',
            approvedAt: '2026-07-15', reuseScope: 'Μόνο για αυτή την περίπτωση',
            restResult: 'Δεν διαπιστώθηκε παραβίαση 11ωρης ανάπαυσης' } },
        { date: '2026-06-13', orphan: { type: 'END_ONLY', status: 'Επιλυμένο από εγκεκριμένη πολιτική',
            rawPunch: '—–16:10', approvedInterval: '08:10–16:10', approvedBy: '', approvedAt: null,
            reuseScope: 'Επαναχρησιμοποιήσιμη πολιτική ίδιου παραρτήματος',
            restResult: 'Παραβίαση 11ωρης ανάπαυσης' } }
    ]);
    const output = narrative.events.join(' ');
    assert.match(output, /μόνο η είσοδος[\s\S]*έλειπε η αντίστοιχη έξοδος/);
    assert.match(output, /μόνο η έξοδος[\s\S]*έλειπε η αντίστοιχη είσοδος/);
    assert.match(output, /08:05–16:03/);
    assert.match(output, /εγκρίθηκε από το HR[\s\S]*ΥΠΕΥΘΥΝΟΣ HR[\s\S]*15\/07\/2026/);
    assert.match(output, /Επαναχρησιμοποιήσιμη πολιτική ίδιου παραρτήματος/);
    assert.match(output, /Δεν διαπιστώθηκε παραβίαση 11ωρης ανάπαυσης/);
    assert.match(output, /Παραβίαση 11ωρης ανάπαυσης/);
});

test('η αφήγηση καλύπτει άδεια, ασθένεια, απουσία, 6η και σοβαρή 7η ημέρα', () => {
    const narrative = buildDossierWeekNarrative({ weekStart: '2026-06-22',
        weekEnd: '2026-06-28', automaticRepoResolutions: [], repoDecisions: [],
        stage3Decisions: [], stage1Decisions: [
            { date: '2026-06-22', initial: 'ΕΡΓ', result: 'ΑΔΕΙΑ', reason: 'Εγκρίθηκε αίτημα άδειας' },
            { date: '2026-06-23', initial: 'ΕΡΓ', result: 'ΑΣΘΕΝΕΙΑ', reason: 'Υποβλήθηκε δικαιολογητικό' },
            { date: '2026-06-24', initial: 'ΕΡΓ', result: 'ΑΠΟΥΣΙΑ', reason: 'Δεν καταγράφηκε εργασία' }
        ], sixthDay: '2026-06-27', sixthDayHours: 7.42, sixthDayRate: 40,
        sixthDayIllegalOvertimeHours: 0, seventhDay: '2026-06-28', seventhDayHours: 6.5,
        seventhDayIllegalOvertimeHours: 6.5, totals: {
            ores_yperergasias_apologistika: 1,
            ores_nominhs_yperorias_apologistika: 2,
            ores_paranomhs_yperorias_apologistika: 6.5
        }
    }, [
        { date: '2026-06-22', leave: true },
        { date: '2026-06-23', sickness: true },
        { date: '2026-06-24', absence: true }
    ]);
    const output = narrative.events.join(' ');
    assert.match(output, /χαρακτηρίστηκε ως άδεια[\s\S]*Εγκρίθηκε αίτημα άδειας/);
    assert.match(output, /χαρακτηρίστηκε ως ασθένεια[\s\S]*Υποβλήθηκε δικαιολογητικό/);
    assert.match(output, /χαρακτηρίστηκε ως απουσία[\s\S]*Δεν καταγράφηκε εργασία/);
    assert.match(output, /27\/06\/2026[\s\S]*6η ημέρα[\s\S]*7\.42 ώρες[\s\S]*40%/);
    assert.match(output, /28\/06\/2026[\s\S]*7η ημέρα[\s\S]*σοβαρή παράβαση[\s\S]*6\.50 ώρες/);
    assert.match(output, /1\.00 ώρες υπερεργασίας[\s\S]*2\.00 ώρες νόμιμης υπερωρίας/);
});

test('ο Φάκελος Ελέγχου αρχίζει με εξώφυλλο και δεν εμφανίζει τις παλιές τεχνικές λίστες', async () => {
    const report = fixture();
    report.metadata = { ...report.metadata, team: 'THA', companyCode: '0004',
        companyName: 'ΕΤΑΙΡΕΙΑ ΔΟΚΙΜΗΣ', generatedBy: 'ΧΡΗΣΤΗΣ ΔΟΚΙΜΗΣ',
        periodStart: '2026-06-01', periodEnd: '2026-06-30' };
    const doc = buildEmploymentReviewPdf(report, { dossier: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const completed = new Promise((resolve, reject) => {
        doc.on('end', resolve); doc.on('error', reject);
    });
    doc.end();
    await completed;
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(Buffer.concat(chunks)),
        useSystemFonts: true }).promise;
    const pageTexts = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const items = content.items.filter((item) => item.str.trim());
        pageTexts.push(items.map((item) => item.str).join(' ').replace(/\s+/g, ' '));
        const footerText = items.filter((item) => item.transform[5] < 30)
            .map((item) => item.str).join(' ').replace(/\s+/g, ' ');
        const footer = simplePdfFooterLayout(pageNumber, pdf.numPages);
        assert.match(footerText, /© 2009 - 2026 Copyright: www\.WebPayrollSolutions\.com/);
        assert.ok(footerText.includes(footer.page));
    }
    assert.match(pageTexts[0], /ΦΑΚΕΛΟΣ ΕΛΕΓΧΟΥ ΑΠΑΣΧΟΛΗΣΕΩΝ/);
    assert.match(pageTexts[0], /ΕΤΑΙΡΕΙΑ ΔΟΚΙΜΗΣ/);
    assert.match(pageTexts[0], /01\/06\/2026 έως 30\/06\/2026/);
    const allText = pageTexts.join(' ');
    assert.match(allText, /Επεξηγήσεις και ιστορικό μεταβολών/);
    assert.match(allText, /Εβδομάδα \d{2}\/\d{2}\/\d{4} – \d{2}\/\d{2}\/\d{4}/);
    SIMPLE_PDF_SUMMARY_COLUMNS.forEach((column) => assert.ok(allText.includes(column.label)));
    assert.match(allText, /ΓΕΝΙΚΑ ΣΥΝΟΛΑ/);
    assert.match(allText, /Άδειες:[\s\S]*Ασθένειες:[\s\S]*Απουσίες:[\s\S]*Ημέρες απολογιστικού βιβλίου:/);
    assert.doesNotMatch(allText, /Β\. Στάδιο 1|Γ\. Στάδιο 2|Δ\. Στάδιο 3|Ε\. Στάδιο 4/);
    assert.doesNotMatch(allText, /Αρχική κατάσταση:|Τελικό αποτέλεσμα:|Πηγή:|Αιτιολογία:/);
    assert.doesNotMatch(allText, /Τεχνικό παράρτημα|Αποτύπωμα παγωμένου αποτελέσματος/);
});

test('απλό PDF και Φάκελος χρησιμοποιούν κοινές υλοποιήσεις σελίδας, σύνοψης και footer', () => {
    const source = require('node:fs').readFileSync(require('node:path').join(__dirname,
        'apasxoliseisEmploymentReviewReportService.js'), 'utf8');
    const renderer = source.slice(source.indexOf('function buildEmploymentReviewPdf'),
        source.indexOf('module.exports'));
    assert.equal((renderer.match(/writeBasicEmployeePresentation\(doc, employee, fonts\)/g) || []).length, 2);
    assert.equal((renderer.match(/writePeriodSummary\(doc, report, fonts\)/g) || []).length, 2);
    assert.equal((renderer.match(/addSimplePdfFooters\(doc, fonts\)/g) || []).length, 1);
    assert.doesNotMatch(source, /writeDossierPeriodSummary|addFooters\(doc/);
});

test('η απλή PDF ανακεφαλαίωση χρησιμοποιεί τις ίδιες 12 στήλες και συγκεντρωτικές τιμές με το Excel', () => {
    const report = fixture();
    assert.deepEqual(SIMPLE_PDF_SUMMARY_COLUMNS.map((column) => column.label), [
        'Κωδικός', 'Εργαζόμενος', 'Πραγματική εργασία', 'Απουσία', 'Νύχτα', 'Αργίες',
        'Πρόσθετη εργασία', '6η ημέρα', '7η ημέρα', 'Υπερεργασία',
        'Νόμιμη Υπερωρία', 'Παράνομη Υπερωρία'
    ]);
    const rows = buildSimplePdfSummaryRows(report);
    const employee = report.employees[0];
    const summary = rows.employees[0];
    assert.equal(summary.sixth, employee.totals.sixthDayHours.toFixed(2));
    assert.equal(summary.seventh, employee.totals.seventhDayHours.toFixed(2));
    for (const value of [summary.overwork, summary.legal, summary.illegal]) {
        const amounts = value.split('\n').map((line) => Number(line.split(': ')[1].replace(',', '.')));
        assert.equal(amounts.length, 5);
        assert.equal(amounts[0], Number(amounts.slice(1).reduce((sum, item) => sum + item, 0).toFixed(2)));
        assert.match(value, /Απλή:[\s\S]*Νύχτα:[\s\S]*Αργία:[\s\S]*Αργία\+Νύχτα:/);
    }
    assert.equal(rows.grandTotal.name, 'ΓΕΝΙΚΑ ΣΥΝΟΛΑ');
    assert.equal(rows.grandTotal.sixth, report.summary.totals.sixthDayHours.toFixed(2));
    assert.equal(rows.grandTotal.seventh, report.summary.totals.seventhDayHours.toFixed(2));
});

test('το production-pattern 0031 μεταφέρει 4.98 detailed illegal holiday hours σε PDF και XLSX projections', () => {
    const report = buildEmploymentReviewReportProjection({ rows: [row({
        kodikos: '0031',
        employeeName: 'ΣΑΛΑΠΑ ΕΥΣΤΑΘΙΑ',
        hmeromhnia: new Date('2026-04-05T00:00:00.000Z'),
        ores_nominhs_yperorias_apologistika: 13.19,
        ores_paranomhs_yperorias_apologistika: 0,
        ores_paranomhs_yperorias_nyxtas_apologistika: 0,
        ores_paranomhs_yperorias_argion_apologistika: 4.98,
        ores_paranomhs_yperorias_argion_nyxtas_apologistika: 0,
        orphan_card_resolution_preview: null,
        orphan_card_resolution: null
    })] });

    assert.deepEqual([
        report.daily[0].values.ores_paranomhs_yperorias_apologistika,
        report.daily[0].values.ores_paranomhs_yperorias_nyxtas_apologistika,
        report.daily[0].values.ores_paranomhs_yperorias_argion_apologistika,
        report.daily[0].values.ores_paranomhs_yperorias_argion_nyxtas_apologistika
    ], [0, 0, 4.98, 0]);
    assert.equal(report.employees[0].totals.ores_paranomhs_yperorias_argion_apologistika,
        4.98);
    assert.equal(report.summary.totals.ores_paranomhs_yperorias_argion_apologistika,
        4.98);

    const pdfSummary = buildSimplePdfSummaryRows(report);
    assert.match(pdfSummary.employees[0].illegal, /Σύνολο: 4,98/);
    assert.match(pdfSummary.employees[0].illegal, /Αργία: 4,98/);
    assert.match(pdfSummary.employees[0].legal, /Σύνολο: 13,19/);

    const workbook = buildEmploymentReviewWorkbook(report);
    const dailySheet = workbook.getWorksheet('ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ');
    const illegalCell = dailySheet.getRow(3).getCell(16).value;
    assert.match(illegalCell, /Σύνολο: 4,98/);
    assert.match(illegalCell, /Αργία: 4,98/);
});

test('η γραμματοσειρά PDF ανακεφαλαίωσης είναι ακριβώς μία στιγμή μεγαλύτερη από την ημερήσια', () => {
    assert.equal(DAILY_DETAIL_FONT_SIZE, 7.2);
    assert.equal(SUMMARY_FONT_SIZE, 8.2);
    assert.equal(SUMMARY_FONT_SIZE, DAILY_DETAIL_FONT_SIZE + 1);
});

test('κάθε PDF συγκεντρωτική ομάδα έχει ενιαίο εναλλασσόμενο φόντο και πράσινα γενικά σύνολα', () => {
    assert.equal(simplePdfSummaryFill(0), '#ffffff');
    assert.equal(simplePdfSummaryFill(1), '#f7f3ef');
    assert.notEqual(simplePdfSummaryFill(0), simplePdfSummaryFill(1));
    assert.equal(SIMPLE_PDF_GRAND_TOTAL_FILL, '#e2f0d9');
    assert.equal(simplePdfSummaryFill(2, true), SIMPLE_PDF_GRAND_TOTAL_FILL);
    const source = require('node:fs').readFileSync(require('node:path').join(__dirname,
        'apasxoliseisEmploymentReviewReportService.js'), 'utf8');
    assert.match(source, /const fill = simplePdfSummaryFill\(rowIndex, grandTotal\)/);
    assert.match(source, /rect\(left, detailY, width, secondaryHeight\)[\s\S]*\.fillAndStroke\(fill, '#d9cfc7'\)/);
});

test('η δευτερεύουσα περιοχή έχει μοναδικές ταξινομημένες ημερομηνίες και canonical πλήθη', () => {
    const base = fixture();
    const employee = base.employees[0];
    const markedRows = [
        { ...employee.rows[0], date: '2026-06-18', leave: true, sickness: false, absence: false },
        { ...employee.rows[0], date: '2026-06-05', leave: true, sickness: false, absence: false },
        { ...employee.rows[0], date: '2026-06-05', leave: true, sickness: false, absence: false },
        { ...employee.rows[0], date: '2026-06-11', leave: false, sickness: true, absence: false },
        { ...employee.rows[0], date: '2026-06-25', leave: false, sickness: false, absence: true },
        { ...employee.rows[0], date: '2026-06-24', leave: false, sickness: false, absence: true }
    ];
    const counts = { ...employee.counts, leaves: 2, sicknesses: 1, absences: 2,
        sundays: 4, holidays: 1, apologistikoBookDays: 12 };
    const report = { ...base, employees: [{ ...employee, rows: markedRows, counts }],
        summary: { ...base.summary, counts } };
    const rows = buildSimplePdfSummaryRows(report);
    assert.deepEqual(rows.employees[0].details, [
        'Άδειες: 2  •  05/06/2026, 18/06/2026',
        'Ασθένειες: 1  •  11/06/2026',
        'Απουσίες: 2  •  24/06/2026, 25/06/2026',
        'Κυριακές: 4     Αργίες: 1     Ημέρες απολογιστικού βιβλίου: 12'
    ]);
    assert.deepEqual(rows.grandTotal.details, [
        'Άδειες: 2', 'Ασθένειες: 1', 'Απουσίες: 2',
        'Κυριακές: 4     Αργίες: 1     Ημέρες απολογιστικού βιβλίου: 12'
    ]);
    assert.doesNotMatch(rows.grandTotal.details.join(' '), /\d{2}\/\d{2}\/\d{4}/);
});

test('το όνομα απλού PDF διατηρεί ελληνικά και καθαρίζει μόνο μη ασφαλείς χαρακτήρες', () => {
    assert.equal(buildSimplePdfFileName({ team: 'THA', companyCode: '0004',
        companyName: 'ΕΠΩΝΥΜΙΑ', periodStart: '2026-06-01', periodEnd: '2026-06-30' }),
    'THA_0004_ΕΠΩΝΥΜΙΑ_01-06-2026_30-06-2026.pdf');
    assert.equal(buildSimplePdfFileName({ team: 'THA', companyCode: '0004',
        companyName: 'ΕΤΑΙΡΕΙΑ /  ΔΟΚΙΜΗ:*?', periodStart: '2026-06-01', periodEnd: '2026-06-30' }),
    'THA_0004_ΕΤΑΙΡΕΙΑ_ΔΟΚΙΜΗ_01-06-2026_30-06-2026.pdf');
});

test('το όνομα Φακέλου Ελέγχου είναι ελληνικό, περιγραφικό και χωρίς χρονική τιμή', () => {
    const fileName = buildDossierPdfFileName({ team: 'THA', companyCode: '0004',
        companyName: 'ΧΡΗΣΤΟΣ  ΚΑΡΡΑΣ__ΚΑΙ / ΒΑΣΙΛΙΚΗ ΤΣΟΥΡΑΠΑ ΕΠΕ',
        periodStart: '2026-06-01', periodEnd: '2026-06-30' });
    assert.equal(fileName,
        'ΦΑΚΕΛΟΣ_ΕΛΕΓΧΟΥ_ΑΠΑΣΧΟΛΗΣΕΩΝ_THA_0004_ΧΡΗΣΤΟΣ_ΚΑΡΡΑΣ_ΚΑΙ_ΒΑΣΙΛΙΚΗ_ΤΣΟΥΡΑΠΑ_ΕΠΕ_01-06-2026_30-06-2026.pdf');
    assert.doesNotMatch(fileName, /Date\.now|\d{13}/);
});

test('το απλό PDF κρατά την υπάρχουσα κοινή διαδρομή εργαζομένων και ανακεφαλαίωσης', () => {
    const source = require('node:fs').readFileSync(require('node:path').join(__dirname,
        'apasxoliseisEmploymentReviewReportService.js'), 'utf8');
    const simpleBranch = source.slice(source.indexOf('if (!dossier) {'), source.indexOf('} else {',
        source.indexOf('if (!dossier) {')));
    assert.match(simpleBranch, /report\.employees\.forEach\(\(employee, index\)/);
    assert.match(simpleBranch, /if \(index > 0\) doc\.addPage\(\)/);
    assert.match(simpleBranch, /writeBasicEmployeePresentation\(doc, employee, fonts\)/);
    assert.match(simpleBranch, /writePeriodSummary\(doc, report, fonts\)/);
    const commonEmployee = source.slice(source.indexOf('function writeBasicEmployeePresentation'),
        source.indexOf('function buildEmploymentReviewPdf'));
    assert.match(commonEmployee, /writeCompactDailyTable\(doc, employee\.rows, fonts\)/);
    assert.match(commonEmployee, /writeTotalsGrid\(doc, employee, fonts, 'Σύνολα εργαζομένου'\)/);
    assert.match(source, /addSimplePdfFooters\(doc, fonts\)/);
    assert.doesNotMatch(source, /writeDossierPeriodSummary|addFooters\(doc/);
    assert.match(source, /const requiredHeight = rowHeight\(row\) \+ detailHeight\(row\)/);
    assert.match(source, /if \(doc\.y \+ requiredHeight > bottom\(\)\) newSummaryPage\(\)/);
});

test('η απλή PDF ανακεφαλαίωση επαναλαμβάνει επικεφαλίδα και έχει μονογραμμικό footer με x / y', async () => {
    const base = fixture();
    const template = base.employees[0];
    const employees = Array.from({ length: 14 }, (_, index) => ({ ...template,
        employeeCode: String(7000 + index), employeeName: `ΔΟΚΙΜΗ ΣΕΛΙΔΟΠΟΙΗΣΗΣ ${index + 1}` }));
    const report = { ...base, employees, summary: { ...base.summary, employeeCount: employees.length } };
    const doc = buildEmploymentReviewPdf(report, { dossier: false });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const completed = new Promise((resolve, reject) => {
        doc.on('end', resolve); doc.on('error', reject);
    });
    doc.end();
    await completed;
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(Buffer.concat(chunks)),
        useSystemFonts: true }).promise;
    let continuationHeaders = 0;
    const pageTexts = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const items = content.items.filter((item) => item.str.trim());
        pageTexts.push(items.map((item) => item.str).join(' ').replace(/\s+/g, ' '));
        const footer = simplePdfFooterLayout(pageNumber, pdf.numPages);
        const footerItems = items.filter((item) => item.transform[5] < 30);
        const footerText = footerItems.map((item) => item.str).join(' ').replace(/\s+/g, ' ');
        assert.match(footerText, /© 2009 - 2026 Copyright: www\.WebPayrollSolutions\.com/,
            `footer σελίδας ${pageNumber}`);
        assert.ok(footerText.includes(footer.page), `αρίθμηση σελίδας ${pageNumber}`);
        assert.equal(new Set(footerItems.map((item) => item.transform[5].toFixed(1))).size, 1);
        const number = footerItems.find((item) => item.str.includes('Σελίδα'));
        assert.ok(number.transform[4] + number.width > page.view[2] - 32);
        const centerItems = footerItems.filter((item) => !item.str.includes('Σελίδα'));
        const minX = Math.min(...centerItems.map((item) => item.transform[4]));
        const maxX = Math.max(...centerItems.map((item) => item.transform[4] + item.width));
        assert.ok(Math.abs((minX + maxX) / 2 - page.view[2] / 2) < 2);
        continuationHeaders += items.filter((item) =>
            item.str.includes('ΑΝΑΚΕΦΑΛΑΙΩΤΙΚΟΣ ΠΙΝΑΚΑΣ ΠΕΡΙΟΔΟΥ — ΣΥΝΕΧΕΙΑ')).length;
    }
    assert.ok(continuationHeaders >= 1);
    employees.forEach((employee) => {
        const summaryPage = pageTexts.find((pageText) =>
            pageText.includes('ΑΝΑΚΕΦΑΛΑΙΩΤΙΚΟΣ ΠΙΝΑΚΑΣ ΠΕΡΙΟΔΟΥ') &&
            pageText.includes(employee.employeeName));
        assert.ok(summaryPage, `ακέραιη ομάδα ${employee.employeeCode}`);
        assert.match(summaryPage, /Άδειες:[\s\S]*Ασθένειες:[\s\S]*Απουσίες:/);
    });
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
    const statuses = sheet.getColumn(2).values.filter((value) =>
        typeof value === 'string' && value.includes('\n')).map((value) => value.split('\n')[1]);
    assert.deepEqual(statuses, ['ΜΕΡΙΚΗ', 'ΠΛΗΡΗΣ', 'ΠΛΗΡΗΣ']);
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
    const categories = sheet.getColumn(5).values.filter((value) => value?.richText)
        .map((value) => value.richText.map((part) => part.text).join(''));
    assert.equal(categories.some((value) => value.includes('POSSIBLE_LEAVE')), false);
    assert.equal(categories.some((value) => value.includes('ΑΝ')), true);
    assert.equal(categories.some((value) => value.includes('ΜΕ')), true);
});
