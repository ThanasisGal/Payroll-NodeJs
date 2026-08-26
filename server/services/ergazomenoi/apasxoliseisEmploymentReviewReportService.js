'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { dateKeyUtc, getMondaySundayWeekRange } = require('../../utils/date/mondaySundayWeek');
const {
    canonicalOrphanResolutionMetadata
} = require('./apasxoliseisOrphanResolutionPersistenceService');

const REPORT_SCHEMA_VERSION = 'employment-review-report:v1';
const DAILY_DETAIL_FONT_SIZE = 7.2;
const SUMMARY_FONT_SIZE = DAILY_DETAIL_FONT_SIZE + 1;
const DAILY_NUMBER_FIELDS = Object.freeze([
    ['ores_ergasias_apologistika', 'Ώρες εργασίας'],
    ['ores_pragmatikhs_ergasias_apologistika', 'Πραγματικές ώρες'],
    ['ores_adeias_pistomenes_apologistika', 'Πιστωμένες ώρες άδειας'],
    ['ores_argias_pistomenes_apologistika', 'Πιστωμένες ώρες αργίας'],
    ['hmeres_apoysias_apologistika', 'Ημέρες απουσίας'],
    ['ores_apoysias_base_apologistika', 'Βασικές ώρες απουσίας'],
    ['ores_apoysias_apologistika', 'Ώρες απουσίας'],
    ['ores_nyxtas_apologistika', 'Ώρες νύχτας'],
    ['ores_argion_prosayxhsh_apologistika', 'Προσαύξηση αργίας'],
    ['ores_argion_ergasia_apologistika', 'Εργασία αργίας'],
    ['ores_prostheths_ergasias_apologistika', 'Πρόσθετη εργασία'],
    ['ores_yperergasias_apologistika', 'Υπερεργασία'],
    ['ores_yperergasias_nyxtas_apologistika', 'Υπερεργασία νύχτας'],
    ['ores_yperergasias_argion_apologistika', 'Υπερεργασία αργίας'],
    ['ores_yperergasias_argion_nyxtas_apologistika', 'Υπερεργασία αργίας και νύχτας'],
    ['ores_nominhs_yperorias_apologistika', 'Νόμιμη υπερωρία'],
    ['ores_nominhs_yperorias_nyxtas_apologistika', 'Νόμιμη υπερωρία νύχτας'],
    ['ores_nominhs_yperorias_argion_apologistika', 'Νόμιμη υπερωρία αργίας'],
    ['ores_nominhs_yperorias_argion_nyxtas_apologistika', 'Νόμιμη υπερωρία αργίας και νύχτας'],
    ['ores_paranomhs_yperorias_apologistika', 'Παράνομη υπερωρία'],
    ['ores_paranomhs_yperorias_nyxtas_apologistika', 'Παράνομη υπερωρία νύχτας'],
    ['ores_paranomhs_yperorias_argion_apologistika', 'Παράνομη υπερωρία αργίας'],
    ['ores_paranomhs_yperorias_argion_nyxtas_apologistika', 'Παράνομη υπερωρία αργίας και νύχτας']
]);
const TOTAL_NUMBER_FIELDS = Object.freeze([
    ['ores_ergasias_apologistika', 'Ώρες εργασίας'],
    ['ores_pragmatikhs_ergasias_apologistika', 'Πραγματική εργασία'],
    ['ores_apoysias_apologistika', 'Ώρες απουσίας'],
    ['ores_nyxtas_apologistika', 'Ώρες νύχτας'],
    ['ores_argion_prosayxhsh_apologistika', 'Προσαύξηση αργίας'],
    ['ores_argion_ergasia_apologistika', 'Εργασία αργίας'],
    ['ores_prostheths_ergasias_apologistika', 'Πρόσθετη εργασία'],
    ['ores_yperergasias_apologistika', 'Υπερεργασία'],
    ['ores_yperergasias_nyxtas_apologistika', 'Υπερεργασία νύχτας'],
    ['ores_yperergasias_argion_apologistika', 'Υπερεργασία αργίας'],
    ['ores_yperergasias_argion_nyxtas_apologistika', 'Υπερεργασία αργίας + νύχτας'],
    ['ores_nominhs_yperorias_apologistika', 'Νόμιμη υπερωρία'],
    ['ores_nominhs_yperorias_nyxtas_apologistika', 'Νόμιμη υπερωρία νύχτας'],
    ['ores_nominhs_yperorias_argion_apologistika', 'Νόμιμη υπερωρία αργίας'],
    ['ores_nominhs_yperorias_argion_nyxtas_apologistika', 'Νόμιμη υπερωρία αργίας + νύχτας'],
    ['ores_paranomhs_yperorias_apologistika', 'Παράνομη υπερωρία'],
    ['ores_paranomhs_yperorias_nyxtas_apologistika', 'Παράνομη υπερωρία νύχτας'],
    ['ores_paranomhs_yperorias_argion_apologistika', 'Παράνομη υπερωρία αργίας'],
    ['ores_paranomhs_yperorias_argion_nyxtas_apologistika', 'Παράνομη υπερωρία αργίας + νύχτας']
]);
const COUNT_FIELDS = Object.freeze([
    ['repos', 'Ρεπό', 'repo'], ['leaves', 'Άδειες', 'leave'],
    ['sicknesses', 'Ασθένειες', 'sickness'], ['absences', 'Απουσίες', 'absence'],
    ['sundays', 'Κυριακές', 'sunday'], ['holidays', 'Αργίες', 'holiday'],
    ['sixthDays', '6ες ημέρες', 'sixthDay'], ['seventhDays', '7ες ημέρες', 'seventhDay'],
    ['apologistikoBookDays', 'Ημέρες απολογιστικού βιβλίου', 'apologistikoBook']
]);

function number(value) {
    const parsed = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}
function aggregateRows(rows) {
    const totals = Object.fromEntries(TOTAL_NUMBER_FIELDS.map(([field]) => [field,
        number(rows.reduce((sum, row) => sum + number(row.values[field]), 0))]));
    totals.sixthDayHours = number(rows.reduce((sum, row) => sum + number(row.sixthDayHours), 0));
    totals.seventhDayHours = number(rows.reduce((sum, row) => sum + number(row.seventhDayHours), 0));
    const counts = Object.fromEntries(COUNT_FIELDS.map(([key, , rowKey]) => [key,
        rows.filter((row) => row[rowKey] === true).length]));
    return { totals, counts };
}
function text(value) { return String(value ?? '').trim(); }
function id(value) { return text(value?._id ?? value); }
function dateLabel(value) {
    const key = dateKeyUtc(value);
    if (!key) return '';
    const [year, month, day] = key.split('-');
    return `${day}/${month}/${year}`;
}
function pdfFileNamePart(value) {
    return text(value).replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
}
function pdfFileNameDate(value) {
    return dateLabel(value).replaceAll('/', '-');
}
function buildSimplePdfFileName({ team, companyCode, companyName, periodStart, periodEnd } = {}) {
    const parts = [team, companyCode, companyName].map(pdfFileNamePart);
    const dates = [pdfFileNameDate(periodStart), pdfFileNameDate(periodEnd)];
    return `${[...parts, ...dates].filter(Boolean).join('_')}.pdf`;
}
function buildDossierPdfFileName({ team, companyCode, companyName, periodStart, periodEnd } = {}) {
    const parts = [team, companyCode, companyName]
        .map((value) => pdfFileNamePart(value).replace(/_+/g, '_'));
    const dates = [pdfFileNameDate(periodStart), pdfFileNameDate(periodEnd)];
    return `ΦΑΚΕΛΟΣ_ΕΛΕΓΧΟΥ_ΑΠΑΣΧΟΛΗΣΕΩΝ_${[...parts, ...dates]
        .filter(Boolean).join('_')}.pdf`;
}
function time(value) { return text(value).slice(0, 5); }
function intervals(row, kind = 'declared') {
    const result = [];
    for (let index = 1; index <= 3; index += 1) {
        const suffix = String(index).padStart(2, '0');
        const start = time(kind === 'approved'
            ? row[`apo_ora_${suffix}_apologistika`] : row[`apo_ora_${suffix}`]);
        const end = time(kind === 'approved'
            ? row[`eos_ora_${suffix}_apologistika`] : row[`eos_ora_${suffix}`]);
        if (start || end) result.push(`${start || '—'}–${end || '—'}`);
    }
    return result.join(', ');
}
function cards(row) {
    const result = [];
    for (let index = 1; index <= 3; index += 1) {
        const suffix = String(index).padStart(2, '0');
        const start = time(row[`cards_apo_ora_${suffix}`]);
        const end = time(row[`cards_eos_ora_${suffix}`]);
        if (start || end) result.push(`${start || '—'}–${end || '—'}`);
    }
    return result.join(', ');
}
function orphanLabel(type) {
    return type === 'START_ONLY' ? 'Μόνο είσοδος' : type === 'END_ONLY' ? 'Μόνο έξοδος' : '';
}
function statusLabel(value) {
    return ({ OPEN: 'Ενεργό', COMPLETED: 'Ολοκληρωμένο', BLOCKED: 'Μπλοκαρισμένο',
        LOCKED: 'Κλειδωμένο', NOT_APPLICABLE: 'Δεν εφαρμόζεται' })[text(value)] || text(value);
}
function stageValue(state, key) {
    if (key === 'STAGE4') return state?.final_stage;
    return state?.[key.toLowerCase()];
}
function stateKey(row) {
    const week = getMondaySundayWeekRange(dateKeyUtc(row.hmeromhnia));
    return `${text(row.kodikos)}|${week?.weekStartKey || ''}`;
}
function decisionCodeLabel(value) {
    return ({ APPROVE_PROPOSAL: 'Εγκρίθηκε η πρόταση', REJECT_PROPOSAL: 'Απορρίφθηκε η πρόταση',
        NEEDS_MORE_REVIEW: 'Απαιτείται περαιτέρω έλεγχος', LEAVE: 'Άδεια', SICKNESS: 'Ασθένεια',
        ABSENCE: 'Απουσία', NON_WORK: 'Μη εργασία', UNCLASSIFIED: 'Χωρίς χαρακτηρισμό',
        PENDING: 'Εκκρεμεί' })[text(value)] || text(value);
}
function reuseScopeLabel(value) {
    return value === 'ONE_TIME' ? 'Μόνο για αυτή την περίπτωση'
        : value === 'FUTURE_IDENTICAL' ? 'Επαναχρησιμοποιήσιμη πολιτική ίδιου παραρτήματος' : '';
}
function orphanStatusLabel(value) {
    return value === 'HR_APPROVED' ? 'Επιλυμένο με έγκριση HR'
        : value === 'AUTO_APPLIED' ? 'Επιλυμένο από εγκεκριμένη πολιτική'
            : 'Απαιτεί επίλυση';
}
function technicalSourceLabel(value) {
    return ({ HISTORY: 'Ιστορικό όρων εργασίας', EMPLOYEE: 'Μητρώο εργαζομένου',
        CONTRACT: 'Σύμβαση', POLICY: 'Ειδική πολιτική', DEFAULT: 'Κανονική πολιτική',
        SCHEDULE_PHASE: 'Ισχύον καθεστώς ωραρίου' })[text(value)] || (value ? 'Κανονική πηγή δεδομένων' : '');
}
function violationLabel(value) {
    const labels = {
        MISSING_OR_INVALID_SIXTH_DAY_PREMIUM_RATE: 'Λείπει έγκυρο ποσοστό προσαύξησης 6ης ημέρας',
        SEVENTH_DAY_WORK: 'Εργασία κατά την 7η ημέρα',
        SIXTH_DAY_WORK: 'Εργασία κατά την 6η ημέρα'
    };
    return labels[text(value)] || (value ? 'Καταγράφηκε σοβαρή απόκλιση' : '');
}
function lifecycleStage(lifecycle, stage) { return lifecycle?.stages?.[stage.toLowerCase()] || {}; }
function stage2DailyResolution(lifecycle, rowDate) {
    const items = lifecycleStage(lifecycle, 'stage3').stage2_automatic_resolution_items || [];
    return items.find((item) => dateKeyUtc(item?.date) === rowDate) || null;
}
function declaredDailyCategory(row = {}) {
    const category = text(row.kathgoria_ergasias_original || row.kathgoria_ergasias);
    return category || (row.repo === true ? 'ΑΝ' : '');
}
function authoritativeDailyState(row, lifecycle, rowDate, stage2DailyResolutionsByDate = new Map()) {
    const canonicalPositive = row.adeia_apologistika === true ||
        row.astheneia_apologistika === true || row.apousia_apologistika === true;
    const resolution = canonicalPositive ? null :
        stage2DailyResolutionsByDate.get(`${text(row.kodikos)}|${rowDate}`) ||
        stage2DailyResolution(lifecycle, rowDate);
    if (resolution?.classification === 'REST_REPO') {
        return { classification: 'ΑΝ', repo: true, apologistikoBook: true,
            source: 'STAGE2_FINAL_PROJECTION' };
    }
    if (resolution?.classification === 'NON_WORK') {
        return { classification: 'ΜΕ', repo: false, apologistikoBook: true,
            source: 'STAGE2_FINAL_PROJECTION' };
    }
    const finalCategory = row.repo_apologistika === true
        ? 'ΑΝ'
        : text(row.kathgoria_ergasias_apologistika ||
            row.kathgoria_ergasias_effective || row.kathgoria_ergasias);
    return { classification: finalCategory,
    repo: Boolean(row.repo_apologistika), apologistikoBook: row.apologistiko_biblio === true,
    source: 'CANONICAL_DAILY' };
}
function classificationLabel(value) {
    return value === 'ΑΝ' ? 'ΑΝΑΠΑΥΣΗ / ΡΕΠΟ' : value === 'ΜΕ' ? 'ΜΗ ΕΡΓΑΣΙΑ' : text(value);
}
function presentationLeaveCategory(value) {
    const category = text(value);
    return category.toUpperCase() === 'POSSIBLE_LEAVE' ? '' : category;
}
function employmentStatusLabel(value) {
    const normalized = text(value).toUpperCase().replace(/\s+/g, '_');
    if (['0', '00', 'ΠΛΗΡΗΣ', 'PLHRHS', 'PLIRIS', 'FULL', 'FULL_TIME'].includes(normalized)) {
        return 'ΠΛΗΡΗΣ';
    }
    if (['1', '01', 'ΜΕΡΙΚΗ', 'MERIKH', 'MERIKI', 'PART_TIME'].includes(normalized)) {
        return 'ΜΕΡΙΚΗ';
    }
    if (['2', '02', 'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ', 'ΕΚ_ΠΕΡΙΤΡΟΠΗΣ_ΑΠΑΣΧΟΛΗΣΗ',
        'EK_PERITROPHS', 'EK_PERITROPHIS', 'ROTATIONAL'].includes(normalized)) {
        return 'ΕΚ ΠΕΡΙΤΡΟΠΗΣ';
    }
    return text(value).toUpperCase();
}
function buildEmploymentReviewReportProjection({ rows = [], workflowStates = [], workflowAudits = [],
    lifecycleByWeek = new Map(), finalWeeklyAnalysisByWeek = new Map(),
    stage2DailyResolutionsByDate = new Map(),
    repoTransferDecisions = [], metadata = {} } = {}) {
    const states = new Map(workflowStates.map((state) => [
        `${text(state.employee_kodikos)}|${dateKeyUtc(state.week_start)}`, state
    ]));
    const auditsByWeek = new Map();
    workflowAudits.forEach((audit) => {
        const key = `${text(audit.employee_kodikos)}|${dateKeyUtc(audit.week_start)}`;
        if (!auditsByWeek.has(key)) auditsByWeek.set(key, []);
        auditsByWeek.get(key).push(audit);
    });
    const daily = rows.map((row) => {
        const week = getMondaySundayWeekRange(dateKeyUtc(row.hmeromhnia));
        const key = stateKey(row);
        const state = states.get(key);
        const lifecycle = lifecycleByWeek.get(key) || {};
        const lifecycleFinalAnalysis = lifecycleStage(lifecycle, 'stage4').final_weekly_analysis || {};
        const finalAnalysis = lifecycleByWeek.has(key)
            ? lifecycleFinalAnalysis
            : finalWeeklyAnalysisByWeek.get(key) || {};
        const rowDate = dateKeyUtc(row.hmeromhnia);
        const preview = row.orphan_card_resolution_preview || {};
        const resolution = canonicalOrphanResolutionMetadata(row.orphan_card_resolution || {});
        const sixthFromFinalAnalysis = dateKeyUtc(finalAnalysis.sixthDay?.hmeromhnia) === rowDate;
        const seventhFromFinalAnalysis = dateKeyUtc(finalAnalysis.seventhDay?.hmeromhnia) === rowDate;
        const sixth = sixthFromFinalAnalysis || row.policy?.classification === 'SIXTH';
        const seventh = seventhFromFinalAnalysis || row.policy?.classification === 'SEVENTH';
        const premium = sixthFromFinalAnalysis ? finalAnalysis.sixthDay?.premiumRate
            : sixth ? row.policy?.sixthDayRate : null;
        const noActionPossibleLeave = (lifecycle.requires_hr_action === false ||
            (!lifecycleByWeek.has(key) && row.requires_hr_action === false)) &&
            Number(lifecycle.total_pending_count ?? row.total_pending_count ?? 0) === 0;
        const authoritative = authoritativeDailyState(
            row, lifecycle, rowDate, stage2DailyResolutionsByDate
        );
        return {
            source: row,
            employeeCode: text(row.kodikos), employeeName: text(row.employeeName || `${row.eponymo || ''} ${row.onoma || ''}`),
            branch: text(row.exportYpokatasthma || row.ypokatasthma), date: dateKeyUtc(row.hmeromhnia),
            weekStart: week?.weekStartKey || '', weekEnd: week?.weekEndKey || '',
            employmentProfile: text(row.effective_kathestos_apasxolhshs || row.effective_typos_apasxolhshs),
            employmentType: text(row.effective_typos_apasxolhshs || row.effective_kathestos_apasxolhshs),
            employmentStatus: employmentStatusLabel(
                row.effective_typos_apasxolhshs || row.effective_kathestos_apasxolhshs
            ),
            specialCategory: text(row.effective_special_category || row.eidikh_kathgoria_ergazomenoy),
            weeklyWorkdays: number(row.effective_weekly_workdays), weeklyHours: number(row.effective_weekly_hours),
            profileSixthDayRate: row.effective_sixth_day_rate === null || row.effective_sixth_day_rate === undefined
                ? null : number(row.effective_sixth_day_rate),
            profileSource: technicalSourceLabel(row.effective_profile_source), declared: intervals(row), cards: cards(row),
            approved: intervals(row, 'approved'),
            declaredCategory: declaredDailyCategory(row),
            finalCategory: authoritative.classification,
            finalCategorySource: authoritative.source,
            classification: noActionPossibleLeave &&
                text(row.kathgoria_ergasias_apologistika) === 'POSSIBLE_LEAVE' &&
                authoritative.source === 'CANONICAL_DAILY' ? '' : authoritative.classification,
            classificationSource: authoritative.source,
            classificationLabel: classificationLabel(authoritative.classification),
            apologistikoBook: authoritative.apologistikoBook,
            repo: authoritative.repo, leave: Boolean(row.adeia_apologistika),
            leaveCategory: presentationLeaveCategory(row.kathgoria_adeias_apologistika),
            sickness: Boolean(row.astheneia_apologistika), absence: Boolean(row.apousia_apologistika),
            sunday: Boolean(row.kyriakes_apologistika), holiday: row.argia === true ||
                number(row.ores_argion_ergasia_apologistika) > 0 ||
                number(row.ores_argias_pistomenes_apologistika) > 0,
            values: Object.fromEntries(DAILY_NUMBER_FIELDS.map(([field]) => [field, number(row[field])])),
            sixthDay: sixth, sixthDayRate: premium === null || premium === undefined ? null : number(premium),
            sixthDayHours: sixthFromFinalAnalysis
                ? number(finalAnalysis.sixthDay?.sixthDayHours)
                : sixth ? number(row.policy?.sixthDayHours) : 0,
            seventhDay: seventh,
            seventhDayHours: seventhFromFinalAnalysis
                ? number(finalAnalysis.seventhDay?.illegalOvertimeHours ??
                    finalAnalysis.seventhDay?.actualWorkHours)
                : seventh ? number(row.policy?.seventhDayHours ??
                    row.policy?.illegalOvertimeHours ?? row.illegalOvertime?.total ??
                    row.ores_pragmatikhs_ergasias_apologistika) : 0,
            requiresHrAction: lifecycle.requires_hr_action === true,
            orphan: preview.orphanType || resolution.orphan_type ? {
                type: preview.orphanType || resolution.orphan_type,
                label: orphanLabel(preview.orphanType || resolution.orphan_type),
                status: orphanStatusLabel(resolution.status),
                rawPunch: cards(row),
                approvedInterval: intervals(row, 'approved'),
                reuseScope: reuseScopeLabel(resolution.reuse_scope),
                approvedBy: text(resolution.approved_by),
                approvedAt: resolution.approved_at || null,
                restViolation: Boolean(preview.restValidation?.hasViolation || preview.rest?.hasViolation ||
                    resolution.rest_violation),
                restResult: preview.restValidation?.hasViolation || preview.rest?.hasViolation ||
                    resolution.rest_violation
                    ? 'Παραβίαση 11ωρης ανάπαυσης' : 'Δεν διαπιστώθηκε παραβίαση 11ωρης ανάπαυσης',
                riskRequired: Boolean(preview.restValidation?.hasViolation || preview.rest?.hasViolation ||
                    resolution.rest_violation),
                riskAcknowledged: resolution.risk_acknowledged
            } : null,
            stageStatuses: Object.fromEntries(['STAGE1', 'STAGE2', 'STAGE3', 'STAGE4'].map((stage) =>
                [stage, statusLabel(stageValue(state, stage)?.status)]))
        };
    }).sort((a, b) => a.employeeCode.localeCompare(b.employeeCode, 'el', { numeric: true }) || a.date.localeCompare(b.date));
    const weeklyMap = new Map();
    daily.forEach((row) => {
        const key = `${row.employeeCode}|${row.weekStart}`;
        if (!weeklyMap.has(key)) weeklyMap.set(key, []);
        weeklyMap.get(key).push(row);
    });
    const weekly = [...weeklyMap.entries()].map(([key, weekRows]) => {
        const [employeeCode, weekStart] = key.split('|');
        const state = states.get(key) || {};
        const lifecycle = lifecycleByWeek.get(key) || {};
        const stage1Lifecycle = lifecycleStage(lifecycle, 'stage1');
        const stage2Lifecycle = lifecycleStage(lifecycle, 'stage2');
        const stage3Lifecycle = lifecycleStage(lifecycle, 'stage3');
        const stage4Lifecycle = lifecycleStage(lifecycle, 'stage4');
        const finalAnalysis = stage4Lifecycle.final_weekly_analysis || {};
        const workRows = weekRows.filter((row) => row.values.ores_ergasias_apologistika > 0);
        const sixth = weekRows.find((row) => row.sixthDay) || null;
        const seventh = weekRows.find((row) => row.seventhDay) || null;
        const dates = weekRows.map((row) => row.date).sort();
        const stage1Decisions = weekRows.map((row) => ({ date: row.date,
            initial: text(row.source.kathgoria_ergasias_original || row.source.kathgoria_ergasias),
            result: row.classification || 'Χωρίς τελικό χαρακτηρισμό',
            source: row.source.hr_declared_leave === true || row.leave || row.sickness || row.absence ? 'HR' : 'Αυτόματα',
            reason: text(state.stage1?.reason_or_notes),
            actor: text(state.stage1?.completed_by_user_name),
            decidedAt: state.stage1?.completed_at || null }));
        const repoDecisions = repoTransferDecisions.filter((decision) =>
            text(decision.employee_kodikos) === employeeCode && dateKeyUtc(decision.week_start) === weekStart)
            .map((decision) => ({ applicable: true,
                sourceDate: dateKeyUtc(decision.canonical_snapshot?.source?.hmeromhnia),
                targetDate: dateKeyUtc(decision.canonical_snapshot?.target?.hmeromhnia),
                result: decisionCodeLabel(decision.decision_code), source: decision.created_by_user_id ? 'HR' : 'Αυτόματα',
                reason: text(decision.notes), decidedAt: decision.created_at || null,
                actor: text(decision.created_by_user_name),
                reuseScope: reuseScopeLabel(decision.reuse_scope) }));
        const stage3Decisions = (auditsByWeek.get(key) || [])
            .filter((audit) => audit.action === 'STAGE3_DAILY_RESOLVED')
            .map((audit) => { const decidedRow = weekRows.find((row) => row.date === dateKeyUtc(audit.decision_date));
                return { date: dateKeyUtc(audit.decision_date), initial: decisionCodeLabel(audit.previous_classification),
                    result: decisionCodeLabel(audit.final_classification),
                    leaveCategory: presentationLeaveCategory(
                        decidedRow?.source?.kathgoria_adeias_apologistika
                    ),
                    reason: text(audit.reason_or_notes), source: audit.performed_by_user_id ? 'HR' : 'Αυτόματα',
                    decidedAt: audit.performed_at || null, actor: text(audit.performed_by_user_name) }; });
        const automaticRepoResolutions = (stage3Lifecycle.stage2_automatic_resolution_items || [])
            .filter((item) => item.classification === 'REST_REPO')
            .map((item) => ({ targetDate: dateKeyUtc(item.date), reason: text(item.reason),
                sourceDate: weekRows.find((row) => row.declaredCategory === 'ΑΝ' &&
                    row.finalCategory === 'ΕΡΓ')?.date || '' }));
        const totals = Object.fromEntries(DAILY_NUMBER_FIELDS.map(([field]) => [field,
            number(weekRows.reduce((sum, row) => sum + number(row.values[field]), 0))]));
        return { key, employeeCode, employeeName: weekRows[0]?.employeeName || '', weekStart,
            weekEnd: weekRows[0]?.weekEnd || '',
            sliceStart: lifecycle.employment_date_scope?.authoritative_date_set?.[0] || dates[0] || '',
            sliceEnd: lifecycle.employment_date_scope?.authoritative_date_set?.at?.(-1) || dates.at(-1) || '',
            workdays: workRows.length, repos: weekRows.filter((row) => row.repo).length,
            sixthDay: dateKeyUtc(finalAnalysis.sixthDay?.hmeromhnia) || sixth?.date || '',
            sixthDayRate: finalAnalysis.sixthDay?.premiumRate ?? sixth?.sixthDayRate ?? null,
            sixthDayHours: number(finalAnalysis.sixthDay?.sixthDayHours ?? sixth?.sixthDayHours),
            sixthDayIllegalOvertimeHours: number(
                finalAnalysis.sixthDay?.illegalOvertimeHours),
            sixthDayRateSource: text(finalAnalysis.sixthDay?.premiumRateSource),
            seventhDay: dateKeyUtc(finalAnalysis.seventhDay?.hmeromhnia) || seventh?.date || '',
            seventhDayHours: number(finalAnalysis.seventhDay?.actualWorkHours ??
                finalAnalysis.seventhDay?.illegalOvertimeHours ?? seventh?.seventhDayHours),
            seventhDayIllegalOvertimeHours: number(
                finalAnalysis.seventhDay?.illegalOvertimeHours ?? seventh?.seventhDayHours),
            violations: weekRows.filter((row) =>
                row.values.ores_paranomhs_yperorias_apologistika > 0).length,
            totals,
            sundays: weekRows.filter((row) => row.sunday).length,
            holidays: weekRows.filter((row) => row.holiday).length,
            severeReasons: (finalAnalysis.reasons || []).map(violationLabel),
            status: statusLabel(stage4Lifecycle.presentation_status || stage4Lifecycle.business_status ||
                state.final_stage?.status || state.stage3?.status || state.stage2?.status || state.stage1?.status),
            pendingCount: Number(lifecycle.total_pending_count || 0),
            pendingIdentities: ['stage1', 'stage2', 'stage3', 'stage4'].flatMap((stageName) => {
                const stage = lifecycleStage(lifecycle, stageName);
                const datesForStage = stage.pending_dates || [];
                if (datesForStage.length) return datesForStage.map((date) => `${key}|${stageName}|${dateKeyUtc(date)}`);
                const reasons = stage.pending_reasons || stage.blockers || [];
                if (reasons.length) return reasons.map((reason) => `${key}|${stageName}|${text(reason)}`);
                return Array.from({ length: Number(stage.pending_count || 0) }, (_, index) => `${key}|${stageName}|${index}`);
            }),
            stage1Decisions, repoDecisions, stage3Decisions, automaticRepoResolutions,
            stages: ['STAGE1', 'STAGE2', 'STAGE3', 'STAGE4'].map((stage) => {
                const value = stageValue(state, stage) || {};
                const projected = lifecycleStage(lifecycle, stage);
                return { stage, status: statusLabel(projected.presentation_status || projected.business_status || value.status), date: value.completed_at || null,
                    source: value.completed_by_user_id ? 'HR' : 'Αυτόματα', reason: text(value.reason_or_notes),
                    version: Number(value.version || 0), fingerprint: text(value.completion_fingerprint) };
            }), audits: auditsByWeek.get(key) || [] };
    }).sort((a, b) => a.employeeCode.localeCompare(b.employeeCode, 'el', { numeric: true }) || a.weekStart.localeCompare(b.weekStart));
    const employees = new Map();
    daily.forEach((row) => {
        if (!employees.has(row.employeeCode)) employees.set(row.employeeCode, {
            employeeCode: row.employeeCode, employeeName: row.employeeName, branch: row.branch,
            employmentType: row.employmentType, specialCategory: row.specialCategory,
            weeklyWorkdays: row.weeklyWorkdays, weeklyHours: row.weeklyHours,
            sixthDayRate: row.profileSixthDayRate, profileSource: row.profileSource,
            rows: [], weeks: []
        });
        employees.get(row.employeeCode).rows.push(row);
    });
    weekly.forEach((week) => employees.get(week.employeeCode)?.weeks.push(week));
    employees.forEach((employee) => {
        const statuses = [...new Set(employee.rows.map((row) => row.employmentStatus).filter(Boolean))];
        Object.assign(employee, aggregateRows(employee.rows), {
            periodEmploymentStatus: statuses.length > 1 ? 'ΜΙΚΤΟ ΚΑΤΑ ΤΗΝ ΠΕΡΙΟΔΟ' : statuses[0] || '—'
        });
    });
    const uniquePendingIdentities = new Set(weekly.flatMap((week) => week.pendingIdentities));
    const derivedPending = uniquePendingIdentities.size || weekly.reduce((sum, week) => sum + week.pendingCount, 0);
    const periodAggregate = aggregateRows(daily);
    const summary = {
        employeeCount: employees.size,
        pendingCount: derivedPending,
        completedWeeks: weekly.filter((week) => week.status === 'Ολοκληρωμένο').length,
        problematicWeeks: weekly.filter((week) => !['', 'Ολοκληρωμένο'].includes(week.status)).length,
        sixthDays: daily.filter((row) => row.sixthDay).length,
        seventhDays: daily.filter((row) => row.seventhDay).length,
        severeViolations: weekly.reduce((sum, week) => sum + week.violations, 0),
        totals: periodAggregate.totals,
        counts: periodAggregate.counts
    };
    return { schemaVersion: REPORT_SCHEMA_VERSION, generatedAt: metadata.generatedAt || new Date(),
        metadata, summary, daily, weekly, employees: [...employees.values()] };
}

function styleSheet(sheet) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: sheet.getRow(1).getCell(sheet.columnCount).address };
    sheet.getRow(1).font = { name: 'DejaVu Sans', size: 9, bold: true,
        color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B4F3A' } };
    sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    sheet.eachRow((row, index) => { if (index > 1) row.alignment = { vertical: 'top', wrapText: true }; });
}
function addSheet(workbook, name, columns, rows, { state = 'hidden' } = {}) {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.state = state;
    sheet.columns = columns;
    sheet.addRows(rows);
    styleSheet(sheet);
    return sheet;
}
const REVIEW_EXCEL_FOOTER =
    '© 2009 - 2026 Copyright: www.WebPayrollSolutions.com   Ιωλκού 266α Βόλος   ' +
    'Τηλ.: 2421056825   Κιν.: 6972012650   email: support@WebPayrollSolutions.com';
const REVIEW_EXCEL_BORDER = Object.freeze({
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
});
const DAILY_DETAIL_ROW_HEIGHT_POINTS = 60.0945;
const OVERTIME_COMPONENTS = Object.freeze({
    overwork: ['ores_yperergasias_apologistika', 'ores_yperergasias_nyxtas_apologistika',
        'ores_yperergasias_argion_apologistika', 'ores_yperergasias_argion_nyxtas_apologistika'],
    legal: ['ores_nominhs_yperorias_apologistika', 'ores_nominhs_yperorias_nyxtas_apologistika',
        'ores_nominhs_yperorias_argion_apologistika', 'ores_nominhs_yperorias_argion_nyxtas_apologistika'],
    illegal: ['ores_paranomhs_yperorias_apologistika', 'ores_paranomhs_yperorias_nyxtas_apologistika',
        'ores_paranomhs_yperorias_argion_apologistika', 'ores_paranomhs_yperorias_argion_nyxtas_apologistika']
});
function overtimeBreakdown(values = {}, fields = []) {
    const parts = fields.map((field) => number(values[field]));
    const total = number(parts.reduce((sum, value) => sum + value, 0));
    const display = (value) => value.toFixed(2).replace('.', ',');
    return `Σύνολο: ${display(total)}\nΑπλή: ${display(parts[0])}\n` +
        `Νύχτα: ${display(parts[1])}\nΑργία: ${display(parts[2])}\n` +
        `Αργία+Νύχτα: ${display(parts[3])}`;
}
function holidayTotal(values = {}) {
    return number(number(values.ores_argion_prosayxhsh_apologistika) +
        number(values.ores_argion_ergasia_apologistika));
}
function reviewCategoryRichText(row) {
    const regular = { name: 'DejaVu Sans', size: 9 };
    const declaredCategory = text(row.declaredCategory);
    const finalCategory = text(row.finalCategory);
    const finalDiffers = declaredCategory !== finalCategory;
    return { richText: [
        { font: regular, text: `Προδ.: ${declaredCategory || '—'}\n\n` },
        { font: regular, text: 'Απολ.: ' },
        { font: { ...regular, ...(finalDiffers ? { bold: true } : {}) }, text: finalCategory || '—' }
    ] };
}
function excelHeaderText(value) {
    return text(value).replace(/&/g, '&&');
}
function configureVisibleReviewSheet(sheet, report, { printTitlesRow, margins }) {
    sheet.pageSetup = {
        paperSize: 9, orientation: 'landscape', fitToPage: true,
        fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
        verticalCentered: false, margins: { ...margins, header: 0.19 }
    };
    sheet.pageSetup.printTitlesRow = printTitlesRow;
    const font = '&"DejaVu Sans"&9';
    sheet.headerFooter.oddHeader = `&L${font}${excelHeaderText(report.metadata.companyName)}` +
        `&C${font}Περίοδος από ${dateLabel(report.metadata.periodStart)} έως ${dateLabel(report.metadata.periodEnd)}` +
        `&R${font}Ημερομηνία - Ώρα Εκτύπωσης: &D &T`;
    sheet.headerFooter.evenHeader = sheet.headerFooter.oddHeader;
    sheet.headerFooter.firstHeader = sheet.headerFooter.oddHeader;
    sheet.headerFooter.oddFooter = `&C&"DejaVu Sans"&9${REVIEW_EXCEL_FOOTER}` +
        '&R&"DejaVu Sans"&9Σελίδα &P / &N';
    sheet.headerFooter.evenFooter = sheet.headerFooter.oddFooter;
    sheet.headerFooter.firstFooter = sheet.headerFooter.oddFooter;
}
function styleReviewRange(sheet, fromRow, toRow, fromColumn, toColumn) {
    for (let rowNumber = fromRow; rowNumber <= toRow; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        for (let column = fromColumn; column <= toColumn; column += 1) {
            const cell = row.getCell(column);
            cell.border = REVIEW_EXCEL_BORDER;
            cell.alignment = cell.alignment || { vertical: 'middle', wrapText: true };
        }
    }
}
function enforceWorkbookFont(workbook) {
    workbook.worksheets.forEach((sheet) => {
        const lastRow = Math.max(sheet.rowCount, 1);
        const lastColumn = Math.max(sheet.columnCount, 1);
        for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
            const row = sheet.getRow(rowNumber);
            for (let column = 1; column <= lastColumn; column += 1) {
                const cell = row.getCell(column);
                cell.font = { ...(cell.font || {}), name: 'DejaVu Sans', size: 9 };
            }
        }
    });
}
function buildEmploymentReviewWorkbook(report) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Payroll-NodeJs';
    workbook.created = new Date(report.generatedAt);
    addSheet(workbook, 'ΣΥΝΟΨΗ', [
        { header: 'Στοιχείο', key: 'label', width: 38 }, { header: 'Τιμή', key: 'value', width: 42 }
    ], [
        ['Εταιρεία', report.metadata.companyName], ['Παράρτημα', report.metadata.branch],
        ['Περίοδος', `${dateLabel(report.metadata.periodStart)}–${dateLabel(report.metadata.periodEnd)}`],
        ['Πλήθος εργαζομένων', report.summary.employeeCount], ['Συνολικές εκκρεμότητες', report.summary.pendingCount],
        ['Ολοκληρωμένες εβδομάδες', report.summary.completedWeeks], ['Προβληματικές εβδομάδες', report.summary.problematicWeeks],
        ['6ες ημέρες', report.summary.sixthDays], ['7ες ημέρες', report.summary.seventhDays],
        ['Σοβαρές παραβάσεις', report.summary.severeViolations],
        ...TOTAL_NUMBER_FIELDS.map(([field, label]) => [`Σύνολο — ${label}`, report.summary.totals[field].toFixed(2)]),
        ...COUNT_FIELDS.map(([key, label]) => [`Σύνολο — ${label}`, report.summary.counts[key]])
    ].map(([label, value]) => ({ label, value })));
    const dailyColumns = [
        ['Εργαζόμενος', 'employee', 18], ['Ημερομηνία / Καθεστώς', 'dateStatus', 14],
        ['Προδηλωμένο', 'declared', 13], ['Κάρτες', 'cards', 15],
        ['Κατηγορίες εργασίας', 'categories', 14], ['Απολογιστικό', 'approved', 15],
        ['Πραγματική εργασία', 'actual', 10], ['Απουσία', 'absence', 9],
        ['Νύχτα', 'night', 8], ['Αργίες', 'holiday', 8], ['Πρόσθετη εργασία', 'extra', 9],
        ['6η ημέρα', 'sixth', 7], ['7η ημέρα', 'seventh', 7],
        ['Υπερεργασία', 'overwork', 18], ['Νόμιμη Υπερωρία', 'legal', 18],
        ['Παράνομη Υπερωρία', 'illegal', 18]
    ].map(([header, key, width]) => ({ header, key, width }));
    const dailySheet = addSheet(workbook, 'ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', dailyColumns, [],
        { state: 'visible' });
    dailySheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    dailySheet.getRow(1).height = 30;
    let previousEmployee = null;
    for (const row of report.daily) {
        if (previousEmployee && previousEmployee !== row.employeeCode) {
            const employee = report.employees.find((item) => item.employeeCode === previousEmployee);
            const total = dailySheet.addRow({ employee: `Σύνολα εργαζομένου: ${employee.employeeName}`,
                actual: employee.totals.ores_pragmatikhs_ergasias_apologistika,
                absence: employee.totals.ores_apoysias_apologistika,
                night: employee.totals.ores_nyxtas_apologistika,
                holiday: holidayTotal(employee.totals),
                extra: employee.totals.ores_prostheths_ergasias_apologistika,
                sixth: employee.totals.sixthDayHours, seventh: employee.totals.seventhDayHours,
                overwork: overtimeBreakdown(employee.totals, OVERTIME_COMPONENTS.overwork),
                legal: overtimeBreakdown(employee.totals, OVERTIME_COMPONENTS.legal),
                illegal: overtimeBreakdown(employee.totals, OVERTIME_COMPONENTS.illegal) });
            total.height = 68;
            total.font = { bold: true };
            total.alignment = { vertical: 'middle', wrapText: true };
            total.eachCell({ includeEmpty: true }, (cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } };
            });
        }
        previousEmployee = row.employeeCode;
        const detail = dailySheet.addRow({
            employee: `${row.employeeCode} — ${row.employeeName}`,
            dateStatus: `${dateLabel(row.date)}\n${row.employmentStatus || '—'}`,
            declared: row.declared, cards: row.cards, categories: reviewCategoryRichText(row),
            approved: row.approved,
            actual: row.values.ores_pragmatikhs_ergasias_apologistika,
            absence: row.values.ores_apoysias_apologistika,
            night: row.values.ores_nyxtas_apologistika,
            holiday: holidayTotal(row.values),
            extra: row.values.ores_prostheths_ergasias_apologistika,
            sixth: row.sixthDay ? row.sixthDayHours : '',
            seventh: row.seventhDay ? row.seventhDayHours : '',
            overwork: overtimeBreakdown(row.values, OVERTIME_COMPONENTS.overwork),
            legal: overtimeBreakdown(row.values, OVERTIME_COMPONENTS.legal),
            illegal: overtimeBreakdown(row.values, OVERTIME_COMPONENTS.illegal)
        });
        detail.height = DAILY_DETAIL_ROW_HEIGHT_POINTS;
        detail.alignment = { vertical: 'middle', wrapText: true };
        detail.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: detail.number % 2 ? 'FFFFFFFF' : 'FFF7F3EF' } };
        });
        const semanticFills = [[8, row.absence || number(row.values.ores_apoysias_apologistika) > 0, 'FFFFC7CE'],
            [10, row.holiday, 'FFFCE4D6'], [11, number(row.values.ores_prostheths_ergasias_apologistika) > 0, 'FFEADCF8'],
            [12, row.sixthDay, 'FFFFF2CC'], [13, row.seventhDay, 'FFFFC7CE'],
            [14, OVERTIME_COMPONENTS.overwork.some((field) => number(row.values[field]) > 0), 'FFFFF2CC'],
            [15, OVERTIME_COMPONENTS.legal.some((field) => number(row.values[field]) > 0), 'FFF8CBAD'],
            [16, OVERTIME_COMPONENTS.illegal.some((field) => number(row.values[field]) > 0), 'FFF4CCCC']];
        semanticFills.forEach(([column, active, color]) => {
            if (active) detail.getCell(column).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: color } };
        });
    }
    if (previousEmployee) {
        const employee = report.employees.find((item) => item.employeeCode === previousEmployee);
        const total = dailySheet.addRow({ employee: `Σύνολα εργαζομένου: ${employee.employeeName}`,
            actual: employee.totals.ores_pragmatikhs_ergasias_apologistika,
            absence: employee.totals.ores_apoysias_apologistika,
            night: employee.totals.ores_nyxtas_apologistika,
            holiday: holidayTotal(employee.totals),
            extra: employee.totals.ores_prostheths_ergasias_apologistika,
            sixth: employee.totals.sixthDayHours, seventh: employee.totals.seventhDayHours,
            overwork: overtimeBreakdown(employee.totals, OVERTIME_COMPONENTS.overwork),
            legal: overtimeBreakdown(employee.totals, OVERTIME_COMPONENTS.legal),
            illegal: overtimeBreakdown(employee.totals, OVERTIME_COMPONENTS.illegal) });
        total.height = 68;
        total.font = { bold: true };
        total.alignment = { vertical: 'middle', wrapText: true };
        total.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } };
        });
    }
    const grand = dailySheet.addRow({ employee: 'Γενικά σύνολα',
        actual: report.summary.totals.ores_pragmatikhs_ergasias_apologistika,
        absence: report.summary.totals.ores_apoysias_apologistika,
        night: report.summary.totals.ores_nyxtas_apologistika,
        holiday: holidayTotal(report.summary.totals),
        extra: report.summary.totals.ores_prostheths_ergasias_apologistika,
        sixth: report.summary.totals.sixthDayHours, seventh: report.summary.totals.seventhDayHours,
        overwork: overtimeBreakdown(report.summary.totals, OVERTIME_COMPONENTS.overwork),
        legal: overtimeBreakdown(report.summary.totals, OVERTIME_COMPONENTS.legal),
        illegal: overtimeBreakdown(report.summary.totals, OVERTIME_COMPONENTS.illegal) });
    grand.height = 68;
    grand.font = { bold: true };
    grand.alignment = { vertical: 'middle', wrapText: true };
    grand.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
    });
    ['actual', 'absence', 'night', 'holiday', 'extra', 'sixth', 'seventh'].forEach((key) => {
        dailySheet.getColumn(key).numFmt = '0.00';
    });
    styleReviewRange(dailySheet, 1, dailySheet.rowCount, 1, 16);
    configureVisibleReviewSheet(dailySheet, report, { printTitlesRow: '1:1',
        margins: { left: 0.22, right: 0.22, top: 0.38, bottom: 0.38, footer: 0.17 } });
    dailySheet.pageSetup.printArea = `A1:P${dailySheet.rowCount}`;

    const recapSheet = workbook.addWorksheet('ΑΝΑΚΕΦΑΛΑΙΩΣΗ');
    recapSheet.state = 'visible';
    recapSheet.columns = [10, 28, 16, 12, 12, 12, 16, 11, 11, 24, 24, 24]
        .map((width) => ({ width }));
    recapSheet.mergeCells('A1:L1');
    recapSheet.getCell('A1').value = 'ΑΝΑΚΕΦΑΛΑΙΩΣΗ ΣΥΝΟΛΩΝ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ';
    recapSheet.getCell('A1').font = { bold: true };
    recapSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    recapSheet.addRow(['Κωδικός', 'Εργαζόμενος', 'Πραγματική εργασία', 'Απουσία', 'Νύχτα',
        'Αργίες', 'Πρόσθετη εργασία', '6η ημέρα', '7η ημέρα', 'Υπερεργασία',
        'Νόμιμη Υπερωρία', 'Παράνομη Υπερωρία']);
    recapSheet.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    recapSheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B4F3A' } };
    report.employees.forEach((employee, index) => {
        const row = recapSheet.addRow([employee.employeeCode, employee.employeeName,
            employee.totals.ores_pragmatikhs_ergasias_apologistika,
            employee.totals.ores_apoysias_apologistika, employee.totals.ores_nyxtas_apologistika,
            holidayTotal(employee.totals),
            employee.totals.ores_prostheths_ergasias_apologistika,
            employee.totals.sixthDayHours, employee.totals.seventhDayHours,
            overtimeBreakdown(employee.totals, OVERTIME_COMPONENTS.overwork),
            overtimeBreakdown(employee.totals, OVERTIME_COMPONENTS.legal),
            overtimeBreakdown(employee.totals, OVERTIME_COMPONENTS.illegal)]);
        row.height = 60;
        row.alignment = { vertical: 'middle', wrapText: true };
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: index % 2 ? 'FFF7F3EF' : 'FFFFFFFF' } };
        });
    });
    const recapGrand = recapSheet.addRow(['', 'ΓΕΝΙΚΑ ΣΥΝΟΛΑ',
        report.summary.totals.ores_pragmatikhs_ergasias_apologistika,
        report.summary.totals.ores_apoysias_apologistika,
        report.summary.totals.ores_nyxtas_apologistika,
        holidayTotal(report.summary.totals),
        report.summary.totals.ores_prostheths_ergasias_apologistika,
        report.summary.totals.sixthDayHours,
        report.summary.totals.seventhDayHours,
        overtimeBreakdown(report.summary.totals, OVERTIME_COMPONENTS.overwork),
        overtimeBreakdown(report.summary.totals, OVERTIME_COMPONENTS.legal),
        overtimeBreakdown(report.summary.totals, OVERTIME_COMPONENTS.illegal)]);
    recapGrand.height = 68;
    recapGrand.font = { bold: true };
    recapGrand.alignment = { vertical: 'middle', wrapText: true };
    recapGrand.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
    });
    styleReviewRange(recapSheet, 1, recapSheet.rowCount, 1, 12);
    recapSheet.views = [{ state: 'frozen', ySplit: 2 }];
    configureVisibleReviewSheet(recapSheet, report, { printTitlesRow: '2:2',
        margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, footer: 0.15 } });
    recapSheet.pageSetup.printArea = `A1:L${recapSheet.rowCount}`;
    const totalColumns = [
        ['Κωδικός', 'employeeCode', 11], ['Εργαζόμενος', 'employeeName', 28],
        ...TOTAL_NUMBER_FIELDS.map(([field, label]) => [label, field, 16]),
        ...COUNT_FIELDS.map(([key, label]) => [label, key, 14])
    ].map(([header, key, width]) => ({ header, key, width }));
    const employeeTotalRows = report.employees.map((employee) => ({
        employeeCode: employee.employeeCode, employeeName: employee.employeeName,
        ...employee.totals, ...employee.counts
    }));
    employeeTotalRows.push({ employeeCode: 'ΓΕΝΙΚΟ ΣΥΝΟΛΟ', employeeName: '',
        ...report.summary.totals, ...report.summary.counts });
    const totalsSheet = addSheet(workbook, 'ΣΥΝΟΛΑ ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ', totalColumns, employeeTotalRows);
    TOTAL_NUMBER_FIELDS.forEach(([field]) => { totalsSheet.getColumn(field).numFmt = '0.00'; });
    totalsSheet.getRow(totalsSheet.rowCount).font = { bold: true };
    const stageDecisionRows = report.weekly.flatMap((week) => [
        ...week.stage1Decisions.map((decision) => ({ employeeCode: week.employeeCode,
            employeeName: week.employeeName, week: `${dateLabel(week.weekStart)}–${dateLabel(week.weekEnd)}`,
            stage: 'Στάδιο 1', status: decision.result, date: '', subjectDate: dateLabel(decision.date),
            decision: `${decision.initial || '—'} → ${decision.result}`, transfer: '', source: decision.source, reason: decision.reason })),
        ...(week.repoDecisions.length ? week.repoDecisions.map((decision) => ({ employeeCode: week.employeeCode,
            employeeName: week.employeeName, week: `${dateLabel(week.weekStart)}–${dateLabel(week.weekEnd)}`,
            stage: 'Στάδιο 2', status: decision.result, date: dateLabel(decision.decidedAt), subjectDate: '',
            decision: decision.result, transfer: `${dateLabel(decision.sourceDate)} → ${dateLabel(decision.targetDate)}`,
            source: decision.source, reason: decision.reason })) : [{ employeeCode: week.employeeCode,
            employeeName: week.employeeName, week: `${dateLabel(week.weekStart)}–${dateLabel(week.weekEnd)}`,
            stage: 'Στάδιο 2', status: 'Δεν εφαρμόστηκε μεταφορά ρεπό', date: '', subjectDate: '',
            decision: '', transfer: '', source: 'Αυτόματα', reason: '' }]),
        ...week.stage3Decisions.map((decision) => ({ employeeCode: week.employeeCode,
            employeeName: week.employeeName, week: `${dateLabel(week.weekStart)}–${dateLabel(week.weekEnd)}`,
            stage: 'Στάδιο 3', status: decision.result, date: dateLabel(decision.decidedAt),
            subjectDate: dateLabel(decision.date), decision: `${decision.initial} → ${decision.result}`,
            transfer: '', source: decision.source, reason: decision.reason })),
        ...week.stages.filter((stage) => stage.stage === 'STAGE4').map((stage) => ({
            employeeCode: week.employeeCode, employeeName: week.employeeName,
            week: `${dateLabel(week.weekStart)}–${dateLabel(week.weekEnd)}`,
            stage: 'Στάδιο 4', status: stage.status, date: dateLabel(stage.date), subjectDate: '',
            decision: stage.status, transfer: '', source: stage.source, reason: stage.reason }))
    ]);
    addSheet(workbook, 'ΑΠΟΦΑΣΕΙΣ ΣΤΑΔΙΩΝ', [
        ['Κωδικός', 'employeeCode', 11], ['Εργαζόμενος', 'employeeName', 28], ['Εβδομάδα', 'week', 24],
        ['Στάδιο', 'stage', 12], ['Αποτέλεσμα', 'status', 25], ['Ημερομηνία απόφασης', 'date', 18],
        ['Ημερομηνία που αφορά', 'subjectDate', 18], ['Απόφαση', 'decision', 28],
        ['Μεταφορά ρεπό', 'transfer', 24], ['Πηγή', 'source', 14], ['Αιτιολογία', 'reason', 42]
    ].map(([header, key, width]) => ({ header, key, width })), stageDecisionRows);
    addSheet(workbook, 'ΕΒΔΟΜΑΔΙΑΙΟΣ ΕΛΕΓΧΟΣ', [
        ['Κωδικός', 'employeeCode', 11], ['Εργαζόμενος', 'employeeName', 28], ['Φυσική εβδομάδα', 'week', 24],
        ['Διάστημα σχέσης', 'slice', 24], ['Ημέρες εργασίας', 'workdays', 16], ['Ρεπό', 'repos', 9],
        ['6η ημέρα', 'sixth', 22], ['7η ημέρα', 'seventh', 14], ['Παραβάσεις', 'violations', 13],
        ['Τελική κατάσταση', 'status', 20]
    ].map(([header, key, width]) => ({ header, key, width })), report.weekly.map((week) => ({
        employeeCode: week.employeeCode, employeeName: week.employeeName,
        week: `${dateLabel(week.weekStart)}–${dateLabel(week.weekEnd)}`,
        slice: `${dateLabel(week.sliceStart)}–${dateLabel(week.sliceEnd)}`, workdays: week.workdays, repos: week.repos,
        sixth: week.sixthDay ? `${dateLabel(week.sixthDay)} — ${week.sixthDayRate ?? 0}%` : '',
        seventh: dateLabel(week.seventhDay), violations: week.violations, status: week.status
    })));
    addSheet(workbook, 'ΙΧΝΗΛΑΣΙΜΟΤΗΤΑ', [
        ['Στοιχείο', 'label', 42], ['Τιμή', 'value', 90]
    ].map(([header, key, width]) => ({ header, key, width })), [
        ['Ημερομηνία δημιουργίας', new Date(report.generatedAt).toISOString()],
        ['Έκδοση σχήματος αναφοράς', report.schemaVersion], ['Κατάσταση περιόδου', report.metadata.periodStatus],
        ['Έκδοση ελέγχου περιόδου', report.metadata.periodVersion],
        ['Κατάσταση ανακατασκευής', report.metadata.reconstructionStatus],
        ['Έκδοση ανακατασκευής', report.metadata.reconstructionVersion],
        ['Έκδοση πολιτικής', report.metadata.policyVersion], ['Αποτύπωμα παγωμένου αποτελέσματος', report.metadata.frozenFingerprint],
        ...report.weekly.flatMap((week) => week.stages.filter((stage) => stage.fingerprint).map((stage) => [
            `${week.employeeCode} ${dateLabel(week.weekStart)}–${dateLabel(week.weekEnd)} ${stage.stage} αποτύπωμα`,
            stage.fingerprint
        ]))
    ].map(([label, value]) => ({ label, value: value ?? '' })));
    workbook.views = [{ activeTab: 1, firstSheet: 1, visibility: 'visible' }];
    workbook.getWorksheet('ΣΥΝΟΨΗ').state = 'hidden';
    enforceWorkbookFont(workbook);
    return workbook;
}

function createPdf({ landscape = true } = {}) {
    const doc = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait',
        margins: { top: 34, bottom: 34, left: 30, right: 30 }, bufferPages: true });
    const candidates = [
        ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'],
        [path.join(process.cwd(), 'fonts/DejaVuSans/DejaVuSans.ttf'), path.join(process.cwd(), 'fonts/DejaVuSans/DejaVuSans-Bold.ttf')]
    ];
    const fonts = candidates.find(([regular, bold]) => fs.existsSync(regular) && fs.existsSync(bold));
    if (fonts) { doc.registerFont('ReportRegular', fonts[0]); doc.registerFont('ReportBold', fonts[1]); }
    doc.font(fonts ? 'ReportRegular' : 'Helvetica');
    return { doc, regular: fonts ? 'ReportRegular' : 'Helvetica', bold: fonts ? 'ReportBold' : 'Helvetica-Bold' };
}
function ensureSpace(doc, height, heading) {
    if (doc.y + height <= doc.page.height - doc.page.margins.bottom) return;
    doc.addPage();
    if (heading) heading();
}
function table(doc, columns, rows, fonts) {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const total = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => width * column.width / total);
    const header = () => {
        let x = left;
        const headerY = doc.y;
        doc.font(fonts.bold).fontSize(6.5).fillColor('#ffffff');
        columns.forEach((column, index) => { doc.rect(x, headerY, widths[index], 19).fill('#6b4f3a');
            doc.fillColor('#ffffff').text(column.label, x + 2, headerY + 4, { width: widths[index] - 4 }); x += widths[index]; });
        doc.y = headerY + 19;
    };
    header();
    rows.forEach((row, rowIndex) => {
        ensureSpace(doc, 24, header);
        const y = doc.y; let x = left;
        doc.font(fonts.regular).fontSize(6).fillColor('#222222');
        columns.forEach((column, index) => { const value = text(row[column.key]);
            doc.rect(x, y, widths[index], 22).fill(rowIndex % 2 ? '#f7f3ef' : '#ffffff');
            doc.fillColor('#222222').text(value, x + 2, y + 3, { width: widths[index] - 4, height: 17, ellipsis: true }); x += widths[index]; });
        doc.y = y + 22;
    });
}
function writeHeader(doc, report, fonts, title) {
    doc.font(fonts.bold).fontSize(16).fillColor('#4f392a').text(title, { align: 'center' });
    doc.moveDown(0.4).font(fonts.regular).fontSize(9).fillColor('#222222')
        .text(`Εταιρεία: ${text(report.metadata.companyName)}   Παράρτημα: ${text(report.metadata.branch)}   ` +
            `Περίοδος: ${dateLabel(report.metadata.periodStart)}–${dateLabel(report.metadata.periodEnd)}`, { align: 'center' });
    doc.moveDown(0.7);
}
const SIMPLE_PDF_FOOTER_TEXT =
    '© 2009 - 2026 Copyright: www.WebPayrollSolutions.com   Ιωλκού 266α Βόλος   ' +
    'Τηλ.: 2421056825   Κιν.: 6972012650   email: support@WebPayrollSolutions.com';
function simplePdfFooterLayout(pageNumber, pageCount) {
    return Object.freeze({ center: SIMPLE_PDF_FOOTER_TEXT,
        page: `Σελίδα ${pageNumber} / ${pageCount}` });
}
function addSimplePdfFooters(doc, fonts) {
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
        doc.switchToPage(index);
        const bottomMargin = doc.page.margins.bottom;
        const left = doc.page.margins.left;
        const right = doc.page.margins.right;
        const width = doc.page.width - left - right;
        const footer = simplePdfFooterLayout(index + 1, range.count);
        doc.page.margins.bottom = 0;
        doc.save().lineWidth(0.35).strokeColor('#b9b1aa')
            .moveTo(left, doc.page.height - 29).lineTo(left + width, doc.page.height - 29)
            .stroke().restore();
        doc.font(fonts.regular).fontSize(5.2).fillColor('#666666')
            .text(footer.center, 0, doc.page.height - 21,
                { width: doc.page.width, align: 'center', lineBreak: false });
        doc.font(fonts.regular).fontSize(5.2).fillColor('#666666')
            .text(footer.page, doc.page.width - right - 68, doc.page.height - 21,
                { width: 68, align: 'right', lineBreak: false });
        doc.page.margins.bottom = bottomMargin;
    }
}
function dailyFlags(row) {
    return [row.apologistikoBook ? 'Απολογιστικό βιβλίο: ΝΑΙ' : '', row.repo ? 'Ρεπό' : '',
        row.leave ? `Άδεια${row.leaveCategory ? ` (${row.leaveCategory})` : ''}` : '',
        row.sickness ? 'Ασθένεια' : '', row.absence ? 'Απουσία' : '', row.sunday ? 'Κυριακή' : '',
        row.holiday ? 'Αργία' : '', row.sixthDay ? `6η ημέρα — ${number(row.sixthDayRate)}%` : '',
        row.seventhDay ? '7η ημέρα' : '', row.orphan ? `${row.orphan.label} — ${row.orphan.status}` : '',
        row.classificationLabel].filter(Boolean);
}
function dailyAnalysis(row) {
    const numeric = TOTAL_NUMBER_FIELDS
        .filter(([field]) => number(row.values[field]) !== 0)
        .map(([field, label]) => ({ field: label,
            value: number(row.values[field]).toFixed(2) }));
    const states = [
        row.apologistikoBook ? { field: 'Απολογιστικό βιβλίο', value: 'ΝΑΙ' } : null,
        row.repo ? { field: 'Ρεπό', value: 'ΝΑΙ' } : null,
        row.leave ? { field: 'Άδεια', value: 'ΝΑΙ' } : null,
        row.leaveCategory ? { field: 'Κατηγορία άδειας', value: row.leaveCategory } : null,
        row.sickness ? { field: 'Ασθένεια', value: 'ΝΑΙ' } : null,
        row.absence ? { field: 'Απουσία', value: 'ΝΑΙ' } : null,
        row.sunday ? { field: 'Κυριακή', value: 'ΝΑΙ' } : null,
        row.holiday ? { field: 'Αργία', value: 'ΝΑΙ' } : null,
        { field: 'Τελικός απολογιστικός χαρακτηρισμός',
            value: row.classificationLabel || row.classification || '—' },
        row.sixthDay ? { field: '6η ημέρα', value: `ΝΑΙ — ${number(row.sixthDayRate)}%` } : null,
        row.seventhDay ? { field: '7η ημέρα', value: 'ΝΑΙ' } : null,
        row.orphan ? { field: 'Ορφανό χτύπημα',
            value: `${row.orphan.label} — ${row.orphan.status}` } : null
    ].filter(Boolean);
    return [...numeric, ...states];
}
function compactDailyText(row) {
    const representedInMainRow = new Set([
        'Ώρες εργασίας', 'Ώρες απουσίας', 'Ώρες νύχτας',
        'Τελικός απολογιστικός χαρακτηρισμός'
    ]);
    const entries = dailyAnalysis(row).filter(({ field }) => !representedInMainRow.has(field));
    const actual = number(row.values.ores_pragmatikhs_ergasias_apologistika);
    const work = number(row.values.ores_ergasias_apologistika);
    const compactEntries = entries.filter(({ field }) =>
        (field !== 'Πραγματική εργασία' || actual !== work) &&
        (field !== 'Απολογιστικό βιβλίο' || row.repo || ['ΑΝ', 'ΜΕ'].includes(row.classification)));
    if (['ΑΝ', 'ΜΕ'].includes(row.classification)) compactEntries.push({
        field: 'Τελικός χαρακτηρισμός', value: row.classification
    });
    return compactEntries.map(({ field, value }) => `${field} ${value}`).join(' • ');
}
function writeCompactDailyTable(doc, rows, fonts) {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columns = [
        ['Ημερομηνία', 10], ['Προδηλωμένο', 16], ['Κάρτες', 14], ['Απολογιστικό', 16],
        ['Εργασία', 8], ['Απουσία', 8], ['Νύχτα', 7], ['Κατάσταση', 21]
    ];
    const totalWeight = columns.reduce((sum, [, weight]) => sum + weight, 0);
    const widths = columns.map(([, weight]) => width * weight / totalWeight);
    const header = () => {
        let x = left; const y = doc.y;
        columns.forEach(([label], index) => {
            doc.rect(x, y, widths[index], 18).fill('#6b4f3a');
            doc.font(fonts.bold).fontSize(7.2).fillColor('#ffffff').text(label, x + 3, y + 4,
                { width: widths[index] - 6, height: 11, align: index >= 4 && index <= 6 ? 'right' : 'left' });
            x += widths[index];
        });
        doc.y = y + 18; doc.x = left;
    };
    header();
    rows.forEach((row, rowIndex) => {
        const analysis = compactDailyText(row);
        doc.font(fonts.regular).fontSize(DAILY_DETAIL_FONT_SIZE);
        const analysisHeight = analysis ? Math.max(14,
            doc.heightOfString(`↳ Απολογιστικά: ${analysis}`, { width: width - 12, lineGap: 0 }) + 5) : 0;
        ensureSpace(doc, 18 + analysisHeight, header);
        const y = doc.y; const fill = rowIndex % 2 ? '#f7f3ef' : '#ffffff'; let x = left;
        const mainStatus = `${row.classificationLabel || row.classification || '—'}${
            row.apologistikoBook && !row.repo && !['ΑΝ', 'ΜΕ'].includes(row.classification)
                ? ' / ΒΙΒΛΙΟ ΝΑΙ' : ''}`;
        const values = [dateLabel(row.date), row.declared, row.cards, row.approved,
            row.values.ores_ergasias_apologistika.toFixed(2), row.values.ores_apoysias_apologistika.toFixed(2),
            row.values.ores_nyxtas_apologistika.toFixed(2), mainStatus];
        values.forEach((value, index) => {
            doc.lineWidth(0.3).rect(x, y, widths[index], 18).fillAndStroke(fill, '#d9cfc7');
            if (index === 0) {
                doc.font(fonts.regular).fontSize(6.9).fillColor('#222222')
                    .text(text(value), x + 3, y + 1.5,
                        { width: widths[index] - 6, height: 8, lineBreak: false });
                doc.font(fonts.bold).fontSize(6.3).fillColor('#5d5148')
                    .text(row.employmentStatus || '—', x + 3, y + 9,
                        { width: widths[index] - 6, height: 7, lineBreak: false, ellipsis: true });
            } else {
                doc.font(index >= 4 && index <= 6 ? fonts.bold : fonts.regular)
                    .fontSize(index >= 4 && index <= 6 ? 8.3 : 7.1).fillColor('#222222')
                    .text(text(value), x + 3, y + 3, { width: widths[index] - 6, height: 13,
                        align: index >= 4 && index <= 6 ? 'right' : 'left', ellipsis: true });
            }
            x += widths[index];
        });
        doc.y = y + 18;
        if (analysis) {
            const analysisY = doc.y;
            doc.lineWidth(0.3).rect(left, analysisY, width, analysisHeight).fillAndStroke(fill, '#d9cfc7');
            doc.font(fonts.regular).fontSize(DAILY_DETAIL_FONT_SIZE).fillColor('#3f342c')
                .text(`↳ Απολογιστικά: ${analysis}`,
                left + 6, analysisY + 2, { width: width - 12, lineGap: 0 });
            doc.y = analysisY + analysisHeight;
        }
        doc.x = left;
    });
}
function totalPairs(employee) {
    return [
        ...TOTAL_NUMBER_FIELDS.map(([field, label]) => ({ label, value: employee.totals[field].toFixed(2) })),
        ...COUNT_FIELDS.map(([key, label]) => ({ label, value: String(employee.counts[key]) }))
    ];
}
function writeTotalsGrid(doc, aggregate, fonts, heading) {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pairs = totalPairs(aggregate); const pairsPerRow = 4; const pairWidth = width / pairsPerRow;
    const gridRows = Math.ceil(pairs.length / pairsPerRow);
    ensureSpace(doc, 30 + gridRows * 17);
    doc.x = left;
    doc.moveDown(0.45).font(fonts.bold).fontSize(9.5).fillColor('#4f392a')
        .text(heading.toUpperCase(), left, doc.y, { width });
    doc.moveDown(0.2);
    for (let offset = 0; offset < pairs.length; offset += pairsPerRow) {
        ensureSpace(doc, 18);
        const y = doc.y;
        for (let index = 0; index < pairsPerRow; index += 1) {
            const pair = pairs[offset + index]; const x = left + index * pairWidth;
            doc.rect(x, y, pairWidth * 0.76, 17).fillAndStroke('#f7f3ef', '#d9cfc7');
            doc.rect(x + pairWidth * 0.76, y, pairWidth * 0.24, 17).fillAndStroke('#ffffff', '#d9cfc7');
            if (pair) {
                doc.font(fonts.regular).fontSize(6.8).fillColor('#222222').text(pair.label, x + 3, y + 3,
                    { width: pairWidth * 0.76 - 6, height: 11, ellipsis: true });
                doc.font(fonts.bold).fontSize(7.4).text(pair.value, x + pairWidth * 0.76 + 2, y + 3,
                    { width: pairWidth * 0.24 - 4, height: 11, align: 'right' });
            }
        }
        doc.y = y + 17; doc.x = left;
    }
}
const SIMPLE_PDF_SUMMARY_COLUMNS = Object.freeze([
    ['Κωδικός', 'code', 7], ['Εργαζόμενος', 'name', 18],
    ['Πραγματική εργασία', 'actual', 9], ['Απουσία', 'absence', 7],
    ['Νύχτα', 'night', 7], ['Αργίες', 'holiday', 7],
    ['Πρόσθετη εργασία', 'extra', 9], ['6η ημέρα', 'sixth', 6],
    ['7η ημέρα', 'seventh', 6], ['Υπερεργασία', 'overwork', 15],
    ['Νόμιμη Υπερωρία', 'legal', 15], ['Παράνομη Υπερωρία', 'illegal', 15]
].map(([label, key, weight]) => Object.freeze({ label, key, weight })));
const SIMPLE_PDF_GRAND_TOTAL_FILL = '#e2f0d9';
function simplePdfSummaryFill(rowIndex, grandTotal = false) {
    return grandTotal ? SIMPLE_PDF_GRAND_TOTAL_FILL : rowIndex % 2 ? '#f7f3ef' : '#ffffff';
}
function uniqueSummaryDates(rows = [], predicate) {
    return [...new Set(rows.filter(predicate).map((row) => dateKeyUtc(row.date)).filter(Boolean))]
        .sort().map(dateLabel);
}
function simplePdfSummaryDetails(counts = {}, rows = [], { includeDates = true } = {}) {
    const dated = (label, key, predicate) => {
        const count = Number(counts[key] || 0);
        const dates = includeDates ? uniqueSummaryDates(rows, predicate) : [];
        return `${label}: ${count}${dates.length ? `  •  ${dates.join(', ')}` : ''}`;
    };
    return Object.freeze([
        dated('Άδειες', 'leaves', (row) => row.leave === true),
        dated('Ασθένειες', 'sicknesses', (row) => row.sickness === true),
        dated('Απουσίες', 'absences', (row) => row.absence === true),
        `Κυριακές: ${Number(counts.sundays || 0)}     Αργίες: ${Number(counts.holidays || 0)}     ` +
            `Ημέρες απολογιστικού βιβλίου: ${Number(counts.apologistikoBookDays || 0)}`
    ]);
}
function simplePdfSummaryRow(values = {}, identity = {}, details = []) {
    return Object.freeze({ code: text(identity.code), name: text(identity.name),
        actual: number(values.ores_pragmatikhs_ergasias_apologistika).toFixed(2),
        absence: number(values.ores_apoysias_apologistika).toFixed(2),
        night: number(values.ores_nyxtas_apologistika).toFixed(2),
        holiday: holidayTotal(values).toFixed(2),
        extra: number(values.ores_prostheths_ergasias_apologistika).toFixed(2),
        sixth: number(values.sixthDayHours).toFixed(2),
        seventh: number(values.seventhDayHours).toFixed(2),
        overwork: overtimeBreakdown(values, OVERTIME_COMPONENTS.overwork),
        legal: overtimeBreakdown(values, OVERTIME_COMPONENTS.legal),
        illegal: overtimeBreakdown(values, OVERTIME_COMPONENTS.illegal),
        details: Object.freeze(details) });
}
function buildSimplePdfSummaryRows(report) {
    const employees = report.employees.map((employee) => simplePdfSummaryRow(employee.totals,
        { code: employee.employeeCode, name: employee.employeeName },
        simplePdfSummaryDetails(employee.counts, employee.rows)));
    const grandTotal = simplePdfSummaryRow(report.summary.totals,
        { code: '', name: 'ΓΕΝΙΚΑ ΣΥΝΟΛΑ' },
        simplePdfSummaryDetails(report.summary.counts, [], { includeDates: false }));
    return Object.freeze({ employees: Object.freeze(employees), grandTotal });
}
function writePeriodSummary(doc, report, fonts) {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    const totalWeight = SIMPLE_PDF_SUMMARY_COLUMNS.reduce((sum, column) => sum + column.weight, 0);
    const widths = SIMPLE_PDF_SUMMARY_COLUMNS.map((column) => width * column.weight / totalWeight);
    const drawHeadingAndHeader = (continued = false) => {
        doc.x = left;
        doc.font(fonts.bold).fontSize(continued ? 9 : 11).fillColor('#4f392a').text(
            `ΑΝΑΚΕΦΑΛΑΙΩΤΙΚΟΣ ΠΙΝΑΚΑΣ ΠΕΡΙΟΔΟΥ${continued ? ' — ΣΥΝΕΧΕΙΑ' : ''}`,
            left, doc.y, { width });
        doc.moveDown(0.25);
        const headerY = doc.y;
        let x = left;
        SIMPLE_PDF_SUMMARY_COLUMNS.forEach((column, index) => {
            doc.lineWidth(0.35).rect(x, headerY, widths[index], 27)
                .fillAndStroke('#6b4f3a', '#d9cfc7');
            doc.font(fonts.bold).fontSize(5.6).fillColor('#ffffff').text(column.label,
                x + 2, headerY + 4, { width: widths[index] - 4, height: 20,
                    align: index >= 2 ? 'center' : 'left' });
            x += widths[index];
        });
        doc.y = headerY + 27;
        doc.x = left;
    };
    const newSummaryPage = () => { doc.addPage(); drawHeadingAndHeader(true); };
    const rowHeight = (row) => {
        doc.font(fonts.regular).fontSize(SUMMARY_FONT_SIZE);
        return Math.max(64, ...SIMPLE_PDF_SUMMARY_COLUMNS.map((column, index) =>
            doc.heightOfString(text(row[column.key]), { width: widths[index] - 4,
                lineGap: index >= 9 ? 0.4 : 0 }) + 8));
    };
    const detailHeight = (row) => {
        doc.font(fonts.regular).fontSize(DAILY_DETAIL_FONT_SIZE);
        return Math.max(27, doc.heightOfString(row.details.join('\n'),
            { width: width - 12, lineGap: 1.2 }) + 10);
    };
    const drawRow = (row, rowIndex, grandTotal = false) => {
        const mainHeight = rowHeight(row);
        const secondaryHeight = detailHeight(row);
        const y = doc.y;
        const fill = simplePdfSummaryFill(rowIndex, grandTotal);
        let x = left;
        SIMPLE_PDF_SUMMARY_COLUMNS.forEach((column, index) => {
            doc.lineWidth(0.35).rect(x, y, widths[index], mainHeight)
                .fillAndStroke(fill, '#d9cfc7');
            doc.font(grandTotal || index < 2 ? fonts.bold : fonts.regular)
                .fontSize(SUMMARY_FONT_SIZE).fillColor('#222222')
                .text(text(row[column.key]), x + 2, y + 4,
                    { width: widths[index] - 4, height: mainHeight - 8,
                        align: index >= 2 && index < 9 ? 'right' : 'left', lineGap: 0.6 });
            x += widths[index];
        });
        const detailY = y + mainHeight;
        doc.lineWidth(0.35).rect(left, detailY, width, secondaryHeight)
            .fillAndStroke(fill, '#d9cfc7');
        doc.font(grandTotal ? fonts.bold : fonts.regular).fontSize(DAILY_DETAIL_FONT_SIZE)
            .fillColor('#3f342c').text(row.details.join('\n'), left + 6, detailY + 5,
                { width: width - 12, height: secondaryHeight - 10, lineGap: 1.2 });
        doc.y = detailY + secondaryHeight;
        doc.x = left;
        return mainHeight + secondaryHeight;
    };
    if (doc.y + 105 > bottom()) doc.addPage();
    else doc.moveDown(0.8);
    drawHeadingAndHeader(false);
    const rows = buildSimplePdfSummaryRows(report);
    [...rows.employees, rows.grandTotal].forEach((row, index) => {
        const requiredHeight = rowHeight(row) + detailHeight(row);
        if (doc.y + requiredHeight > bottom()) newSummaryPage();
        drawRow(row, index, index === rows.employees.length);
    });
}
function writeDailyAnalysis(doc, rows, fonts, heading = 'Απολογιστική ανάλυση') {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const widths = [width * 0.19, width * 0.56, width * 0.25];
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    const drawHeader = (continued = false) => {
        doc.x = left;
        doc.font(fonts.bold).fontSize(10).fillColor('#4f392a').text(
            `${heading.toUpperCase()}${continued ? ' — ΣΥΝΕΧΕΙΑ' : ''}`,
            left, doc.y, { width });
        doc.moveDown(0.35);
        const y = doc.y;
        let x = left;
        ['Ημερομηνία', 'Πεδίο', 'Ώρες / Τιμή'].forEach((label, index) => {
            doc.rect(x, y, widths[index], 20).fill('#6b4f3a');
            doc.font(fonts.bold).fontSize(7.5).fillColor('#ffffff').text(
                label, x + 4, y + 5, { width: widths[index] - 8, height: 12 });
            x += widths[index];
        });
        doc.y = y + 20;
        doc.x = left;
    };
    if (doc.y + 52 > bottom()) doc.addPage();
    else doc.moveDown(0.8);
    drawHeader();
    rows.forEach((row, groupIndex) => {
        const entries = dailyAnalysis(row);
        entries.forEach((entry, entryIndex) => {
            doc.font(fonts.regular).fontSize(7.5);
            const fieldHeight = doc.heightOfString(entry.field, { width: widths[1] - 8 });
            const valueHeight = doc.heightOfString(entry.value, { width: widths[2] - 8 });
            const rowHeight = Math.max(20, fieldHeight + 8, valueHeight + 8);
            if (doc.y + rowHeight > bottom()) {
                doc.addPage();
                drawHeader(true);
            }
            const y = doc.y;
            const fill = groupIndex % 2 ? '#f7f3ef' : '#ffffff';
            let x = left;
            [entryIndex === 0 ? dateLabel(row.date) : '', entry.field, entry.value]
                .forEach((value, index) => {
                    doc.lineWidth(0.35).rect(x, y, widths[index], rowHeight)
                        .fillAndStroke(fill, '#d9cfc7');
                    doc.font(index === 0 && entryIndex === 0 ? fonts.bold : fonts.regular)
                        .fontSize(7.5).fillColor('#222222').text(value, x + 4, y + 4,
                            { width: widths[index] - 8, height: rowHeight - 8 });
                    x += widths[index];
                });
            doc.y = y + rowHeight;
            doc.x = left;
        });
    });
    doc.x = left;
}
function dossierChangeReason(row = {}, explicitReason = '') {
    if (text(explicitReason)) return `Η αλλαγή αυτή έγινε επειδή ${text(explicitReason)}.`;
    if (text(row.cards)) {
        return 'Η αλλαγή αυτή έγινε επειδή οι καταγραφές της ψηφιακής κάρτας και τα ' +
            'διαθέσιμα απολογιστικά στοιχεία έδωσαν διαφορετική τελική εικόνα από την προδηλωμένη.';
    }
    return 'Η αλλαγή αυτή έγινε βάσει των διαθέσιμων προδηλωμένων και απολογιστικών ' +
        'στοιχείων της ημέρας.';
}
function dossierActorSentence({ source, actor, decidedAt, reuseScope } = {}) {
    if (source !== 'HR' && !actor && !decidedAt) return '';
    const parts = ['Η απόφαση εγκρίθηκε από το HR'];
    if (actor) parts.push(`από τον χρήστη ${actor}`);
    if (decidedAt) {
        const decided = new Date(decidedAt);
        const time = Number.isNaN(decided.getTime()) ? '' :
            `${String(decided.getUTCHours()).padStart(2, '0')}:` +
            `${String(decided.getUTCMinutes()).padStart(2, '0')}`;
        parts.push(`στις ${dateLabel(decidedAt)}${time && time !== '00:00' ? `, ώρα ${time}` : ''}`);
    }
    let sentence = `${parts.join(' ')}.`;
    if (reuseScope) sentence += ` Η εμβέλεια της απόφασης ήταν: ${reuseScope}.`;
    return sentence;
}
function buildDossierWeekNarrative(week = {}, weekRows = []) {
    const events = [];
    const coveredDates = new Set();
    const automaticTransfers = week.automaticRepoResolutions || [];
    automaticTransfers.forEach((transfer) => {
        const source = weekRows.find((row) => row.date === transfer.sourceDate) || {};
        const target = weekRows.find((row) => row.date === transfer.targetDate) || {};
        const sourceChange = transfer.sourceDate
            ? `Στις ${dateLabel(transfer.sourceDate)} είχε προδηλωθεί ${source.declaredCategory || 'ανάπαυση'}, ` +
                `όμως από τις ψηφιακές κάρτες ή τα απολογιστικά στοιχεία προέκυψε ` +
                `${source.finalCategory || 'εργασία'}. ` : '';
        events.push(`${sourceChange}Στο πλαίσιο του εβδομαδιαίου ελέγχου πραγματοποιήθηκε ` +
            `μεταφορά ρεπό${transfer.sourceDate ? ` από τις ${dateLabel(transfer.sourceDate)}` : ''} ` +
            `στις ${dateLabel(transfer.targetDate)} και η τελική κατάσταση της ημέρας ` +
            `ορίστηκε σε ${target.finalCategory || 'ΑΝ'}. Η αλλαγή αυτή έγινε επειδή η καθαρή ` +
            'εβδομαδιαία επίλυση προσδιόρισε τη συγκεκριμένη ημέρα ως ημέρα ανάπαυσης.');
        if (transfer.sourceDate) coveredDates.add(transfer.sourceDate);
        coveredDates.add(transfer.targetDate);
    });
    (week.repoDecisions || []).forEach((decision) => {
        const reason = decision.reason
            ? ` Η απόφαση τεκμηριώθηκε ως εξής: ${decision.reason}.`
            : ' Η απόφαση βασίστηκε στα διαθέσιμα στοιχεία του εβδομαδιαίου ελέγχου.';
        events.push(`Εξετάστηκε μεταφορά ρεπό από τις ${dateLabel(decision.sourceDate)} στις ` +
            `${dateLabel(decision.targetDate)}. Η καταγεγραμμένη απόφαση ήταν «${decision.result}».${reason} ` +
            dossierActorSentence(decision));
        coveredDates.add(decision.sourceDate);
        coveredDates.add(decision.targetDate);
    });
    (week.stage3Decisions || []).forEach((decision) => {
        const category = decision.leaveCategory
            ? ` ως ${decision.leaveCategory}` : ` σε ${decision.result}`;
        events.push(`Στις ${dateLabel(decision.date)} η αρχική κατάσταση ήταν ` +
            `${decision.initial || 'χωρίς οριστικό χαρακτηρισμό'} και η ημέρα χαρακτηρίστηκε${category}. ` +
            dossierChangeReason(weekRows.find((row) => row.date === decision.date), decision.reason) +
            ` ${dossierActorSentence(decision)}`);
        coveredDates.add(decision.date);
    });
    (week.stage1Decisions || []).forEach((decision) => {
        if (coveredDates.has(decision.date) || !decision.initial || !decision.result ||
            decision.initial === decision.result) return;
        const row = weekRows.find((candidate) => candidate.date === decision.date) || {};
        let classification = `η τελική κατάσταση μεταβλήθηκε από ${decision.initial} σε ${decision.result}`;
        if (row.leave) classification = `η ημέρα χαρακτηρίστηκε ως άδεια αντί για ${decision.initial}`;
        else if (row.sickness) classification = `η ημέρα χαρακτηρίστηκε ως ασθένεια αντί για ${decision.initial}`;
        else if (row.absence) classification = `η ημέρα χαρακτηρίστηκε ως απουσία αντί για ${decision.initial}`;
        events.push(`Στις ${dateLabel(decision.date)} ${classification}. ` +
            dossierChangeReason(row, decision.reason) + ` ${dossierActorSentence(decision)}`);
    });
    const sixthRow = weekRows.find((row) => row.date === week.sixthDay) || {};
    if (week.sixthDay) events.push(`Στις ${dateLabel(week.sixthDay)} καταγράφηκε 6η ημέρα ` +
        `απασχόλησης με ${number(week.sixthDayHours).toFixed(2)} ώρες εργασίας` +
        `${week.sixthDayRate === null ? '' : ` και ποσοστό προσαύξησης ${week.sixthDayRate}%`}. ` +
        `${sixthRow.specialCategory ? `Η ειδική κατηγορία του εργαζομένου ήταν ${sixthRow.specialCategory}. ` : ''}` +
        `${week.sixthDayRate === 0 ? 'Εφαρμόστηκε μηδενικό ποσοστό λόγω της καταγεγραμμένης εξαίρεσης. ' : ''}` +
        'Ο χαρακτηρισμός προέκυψε από την τελική εβδομαδιαία ανάλυση των ημερών πραγματικής εργασίας.' +
        (number(week.sixthDayIllegalOvertimeHours) > 0
            ? ` Επιπλέον καταγράφηκαν ${number(week.sixthDayIllegalOvertimeHours).toFixed(2)} ` +
                'ώρες παράνομης υπερωρίας πέραν των οκτώ ωρών.' : ''));
    if (week.seventhDay) events.push(`Στις ${dateLabel(week.seventhDay)} καταγράφηκε 7η ημέρα ` +
        `απασχόλησης με ${number(week.seventhDayHours).toFixed(2)} ώρες εργασίας σε ημέρα ` +
        `ανάπαυσης. Πρόκειται για σοβαρή παράβαση και καταγράφηκαν ` +
        `${number(week.seventhDayIllegalOvertimeHours).toFixed(2)} ώρες παράνομης υπερωρίας, ` +
        'επειδή η τελική εβδομαδιαία ανάλυση κατέγραψε πραγματική εργασία και στις επτά ημέρες.');
    weekRows.filter((row) => row.orphan).forEach((row) => {
        const orphan = row.orphan;
        const missing = orphan.type === 'START_ONLY'
            ? 'καταγράφηκε μόνο η είσοδος και έλειπε η αντίστοιχη έξοδος'
            : 'καταγράφηκε μόνο η έξοδος και έλειπε η αντίστοιχη είσοδος';
        const resolved = orphan.status === 'Απαιτεί επίλυση'
            ? 'Η περίπτωση παρέμεινε εκκρεμής και απαιτούσε περαιτέρω έλεγχο.'
            : orphan.status === 'Επιλυμένο από εγκεκριμένη πολιτική'
                ? `Η περίπτωση επιλύθηκε βάσει παλαιότερης εγκεκριμένης απόφασης HR ` +
                    `με τελικό διάστημα εργασίας ${orphan.approvedInterval || 'χωρίς διαθέσιμο διάστημα'}.`
                : `Η περίπτωση εξετάστηκε και επιλύθηκε από το HR με τελικό διάστημα ` +
                    `εργασίας ${orphan.approvedInterval || 'χωρίς διαθέσιμο διάστημα'}.`;
        const approval = orphan.approvedBy || orphan.approvedAt
            ? ` Η επίλυση εγκρίθηκε από το HR${orphan.approvedBy ? ` από τον χρήστη ${orphan.approvedBy}` : ''}` +
                `${orphan.approvedAt ? ` στις ${dateLabel(orphan.approvedAt)}` : ''}.` : '';
        const reuse = orphan.reuseScope
            ? ` Η εμβέλεια της απόφασης ήταν: ${orphan.reuseScope}.` : '';
        events.push(`Στις ${dateLabel(row.date)} ${missing}. Η πραγματική καταγραφή ήταν ` +
            `${orphan.rawPunch || 'μη διαθέσιμη'}. Η περίπτωση χαρακτηρίστηκε ως ορφανό χτύπημα. ` +
            `${resolved}${approval}${reuse} Μετά τη διόρθωση ελέγχθηκε η ελάχιστη ημερήσια ` +
            `ανάπαυση των 11 ωρών. ${orphan.restResult}.`);
    });
    const hourFacts = [
        ['πρόσθετης εργασίας', week.totals?.ores_prostheths_ergasias_apologistika],
        ['υπερεργασίας', week.totals?.ores_yperergasias_apologistika],
        ['νόμιμης υπερωρίας', week.totals?.ores_nominhs_yperorias_apologistika],
        ['παράνομης υπερωρίας', week.totals?.ores_paranomhs_yperorias_apologistika]
    ].filter(([, value]) => number(value) > 0);
    if (hourFacts.length) events.push('Οι οριστικοποιημένες ημερήσιες τιμές της εβδομάδας ' +
        `περιλαμβάνουν ${hourFacts.map(([label, value]) =>
            `${number(value).toFixed(2)} ώρες ${label}`).join(', ')}.`);
    const summaryParts = [];
    if (automaticTransfers.length || (week.repoDecisions || []).length) summaryParts.push('εξετάστηκε μεταφορά ρεπό');
    if (events.some((event) => event.includes('τελική κατάσταση μεταβλήθηκε') ||
        event.includes('χαρακτηρίστηκε ως'))) summaryParts.push('υπήρξαν αλλαγές ημερήσιων κατηγοριών');
    if (week.sixthDay) summaryParts.push('προέκυψε 6η ημέρα');
    if (week.seventhDay) summaryParts.push('προέκυψε 7η ημέρα');
    const summary = events.length
        ? `Κατά την εβδομάδα αυτή ${summaryParts.length ? summaryParts.join(', ') :
            'καταγράφηκαν ουσιώδη γεγονότα που απαιτούν τεκμηρίωση'}.`
        : 'Κατά την εβδομάδα αυτή δεν προέκυψε ουσιώδης μεταβολή μεταξύ των προδηλωμένων ' +
            'και των τελικών στοιχείων και δεν απαιτήθηκε ανθρώπινη παρέμβαση.';
    return Object.freeze({ title: `Εβδομάδα ${dateLabel(week.weekStart)} – ${dateLabel(week.weekEnd)}`,
        summary, events: Object.freeze(events) });
}
function writeDossierCover(doc, report, fonts) {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.rect(left, 58, width, 92).fill('#6b4f3a');
    doc.font(fonts.bold).fontSize(22).fillColor('#ffffff')
        .text('ΦΑΚΕΛΟΣ ΕΛΕΓΧΟΥ ΑΠΑΣΧΟΛΗΣΕΩΝ', left + 24, 82,
            { width: width - 48, align: 'center' });
    doc.font(fonts.regular).fontSize(10).fillColor('#f7f3ef')
        .text('Τεκμηρίωση ελέγχου απασχόλησης βάσει προδηλωμένων στοιχείων, ' +
            'ψηφιακών καρτών και απολογιστικών δεδομένων',
            left + 24, 119, { width: width - 48, align: 'center' });
    const boxY = 186;
    doc.roundedRect(left + 58, boxY, width - 116, 210, 5)
        .fillAndStroke('#f7f3ef', '#d9cfc7');
    const labels = [
        ['Επωνυμία εταιρείας', report.metadata.companyName],
        ['Κωδικός εταιρείας', report.metadata.companyCode],
        ['Παράρτημα', report.metadata.branch],
        ['Ομάδα', report.metadata.team],
        ['Περίοδος', `${dateLabel(report.metadata.periodStart)} έως ${dateLabel(report.metadata.periodEnd)}`],
        ['Ημερομηνία δημιουργίας', dateLabel(report.generatedAt)],
        ['Χρήστης δημιουργίας', report.metadata.generatedBy || '—']
    ];
    labels.forEach(([label, value], index) => {
        const y = boxY + 20 + index * 25;
        doc.font(fonts.bold).fontSize(8.5).fillColor('#4f392a')
            .text(label, left + 78, y, { width: 150 });
        doc.font(fonts.regular).fontSize(9).fillColor('#222222')
            .text(text(value) || '—', left + 232, y, { width: width - 310 });
    });
    doc.font(fonts.regular).fontSize(8).fillColor('#5d5148').text(
        'Το παρόν έντυπο αποτελεί ιστορική τεκμηρίωση των ελέγχων και των μεταβολών ' +
        'της περιόδου, με σκοπό τη δυνατότητα μεταγενέστερης αναδρομής και επαλήθευσης.',
        left + 90, 430, { width: width - 180, align: 'center', lineGap: 2 });
}
function writeDossierWeekNarratives(doc, employee, fonts) {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    employee.weeks.forEach((week) => {
        const narrative = buildDossierWeekNarrative(week,
            employee.rows.filter((row) => row.weekStart === week.weekStart));
        doc.font(fonts.regular).fontSize(8);
        const body = [`Σύντομη σύνοψη: ${narrative.summary}`,
            ...narrative.events.map((event) => `• ${event}`)].join('\n\n');
        const bodyHeight = doc.heightOfString(body, { width: width - 24, lineGap: 2 });
        const blockHeight = 31 + bodyHeight + 13;
        if (doc.y + blockHeight > bottom()) {
            doc.addPage();
            doc.font(fonts.bold).fontSize(10).fillColor('#4f392a')
                .text(`${employee.employeeCode} — ${employee.employeeName} — ΣΥΝΕΧΕΙΑ`);
            doc.moveDown(0.45);
        }
        const y = doc.y;
        doc.roundedRect(left, y, width, blockHeight, 3).fillAndStroke('#f7f3ef', '#d9cfc7');
        doc.rect(left, y, width, 25).fill('#8a6a50');
        doc.font(fonts.bold).fontSize(9).fillColor('#ffffff')
            .text(narrative.title, left + 8, y + 7, { width: width - 16 });
        doc.font(fonts.regular).fontSize(8).fillColor('#222222')
            .text(body, left + 12, y + 32, { width: width - 24, lineGap: 2 });
        doc.y = y + blockHeight + 8;
        doc.x = left;
    });
}
function writeBasicEmployeePresentation(doc, employee, fonts) {
    doc.moveDown(0.7).font(fonts.bold).fontSize(11).fillColor('#4f392a')
        .text(`${employee.employeeCode} — ${employee.employeeName}`);
    doc.font(fonts.regular).fontSize(7.5).fillColor('#222222')
        .text(`Καθεστώς απασχόλησης: ${employee.periodEmploymentStatus}`);
    doc.moveDown(0.2);
    writeCompactDailyTable(doc, employee.rows, fonts);
    writeTotalsGrid(doc, employee, fonts, 'Σύνολα εργαζομένου');
}
function buildEmploymentReviewPdf(report, { dossier = false } = {}) {
    const fonts = createPdf({ landscape: true });
    const { doc } = fonts;
    if (dossier) writeDossierCover(doc, report, fonts);
    else {
        writeHeader(doc, report, fonts, 'ΕΛΕΓΧΟΣ ΑΠΑΣΧΟΛΗΣΕΩΝ');
        doc.font(fonts.bold).fontSize(10).text('Σύνοψη');
        doc.font(fonts.regular).fontSize(8).text(
            `Εργαζόμενοι: ${report.summary.employeeCount}   Εκκρεμότητες: ${report.summary.pendingCount}   ` +
            `6ες ημέρες: ${report.summary.sixthDays}   7ες ημέρες: ${report.summary.seventhDays}   ` +
            `Παραβάσεις: ${report.summary.severeViolations}`
        );
    }
    if (!dossier) {
        report.employees.forEach((employee, index) => {
            if (index > 0) doc.addPage();
            writeBasicEmployeePresentation(doc, employee, fonts);
        });
        writePeriodSummary(doc, report, fonts);
    } else {
        report.employees.forEach((employee) => {
            doc.addPage();
            writeBasicEmployeePresentation(doc, employee, fonts);
            ensureSpace(doc, 55);
            doc.moveDown(0.6).font(fonts.bold).fontSize(10).fillColor('#4f392a')
                .text('Επεξηγήσεις και ιστορικό μεταβολών');
            doc.moveDown(0.35);
            writeDossierWeekNarratives(doc, employee, fonts);
        });
        writePeriodSummary(doc, report, fonts);
    }
    addSimplePdfFooters(doc, fonts);
    return doc;
}

module.exports = { REPORT_SCHEMA_VERSION, DAILY_NUMBER_FIELDS, TOTAL_NUMBER_FIELDS, COUNT_FIELDS,
    authoritativeDailyState,
    buildEmploymentReviewReportProjection, buildEmploymentReviewWorkbook,
    buildEmploymentReviewPdf, dailyAnalysis, dateLabel, orphanLabel,
    employmentStatusLabel, presentationLeaveCategory, SIMPLE_PDF_SUMMARY_COLUMNS,
    buildSimplePdfSummaryRows, simplePdfFooterLayout, DAILY_DETAIL_FONT_SIZE,
    SUMMARY_FONT_SIZE, buildSimplePdfFileName, SIMPLE_PDF_GRAND_TOTAL_FILL,
    simplePdfSummaryFill, buildDossierWeekNarrative, buildDossierPdfFileName };
