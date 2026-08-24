'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { dateKeyUtc, getMondaySundayWeekRange } = require('../../utils/date/mondaySundayWeek');

const REPORT_SCHEMA_VERSION = 'employment-review-report:v1';
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
function authoritativeDailyState(row, lifecycle, rowDate) {
    const canonicalPositive = row.adeia_apologistika === true ||
        row.astheneia_apologistika === true || row.apousia_apologistika === true;
    const resolution = canonicalPositive ? null : stage2DailyResolution(lifecycle, rowDate);
    if (resolution?.classification === 'REST_REPO') {
        return { classification: 'ΑΝ', repo: true, apologistikoBook: true,
            source: 'STAGE2_FINAL_PROJECTION' };
    }
    if (resolution?.classification === 'NON_WORK') {
        return { classification: 'ΜΕ', repo: false, apologistikoBook: true,
            source: 'STAGE2_FINAL_PROJECTION' };
    }
    return { classification: text(row.kathgoria_ergasias_apologistika ||
        row.kathgoria_ergasias_effective || row.kathgoria_ergasias),
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
    lifecycleByWeek = new Map(), repoTransferDecisions = [], metadata = {} } = {}) {
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
        const finalAnalysis = lifecycleStage(lifecycle, 'stage4').final_weekly_analysis || {};
        const rowDate = dateKeyUtc(row.hmeromhnia);
        const preview = row.orphan_card_resolution_preview || {};
        const resolution = row.orphan_card_resolution || {};
        const sixthFromLifecycle = dateKeyUtc(finalAnalysis.sixthDay?.hmeromhnia) === rowDate;
        const seventhFromLifecycle = dateKeyUtc(finalAnalysis.seventhDay?.hmeromhnia) === rowDate;
        const sixth = sixthFromLifecycle || row.policy?.classification === 'SIXTH';
        const seventh = seventhFromLifecycle;
        const premium = sixthFromLifecycle ? finalAnalysis.sixthDay?.premiumRate
            : sixth ? row.policy?.sixthDayRate : null;
        const noActionPossibleLeave = (lifecycle.requires_hr_action === false ||
            (!lifecycleByWeek.has(key) && row.requires_hr_action === false)) &&
            Number(lifecycle.total_pending_count ?? row.total_pending_count ?? 0) === 0;
        const authoritative = authoritativeDailyState(row, lifecycle, rowDate);
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
            seventhDay: seventh,
            requiresHrAction: lifecycle.requires_hr_action === true,
            orphan: preview.orphanType || resolution.orphan_type ? {
                type: preview.orphanType || resolution.orphan_type,
                label: orphanLabel(preview.orphanType || resolution.orphan_type),
                status: orphanStatusLabel(resolution.status),
                rawPunch: cards(row),
                approvedInterval: intervals(row, 'approved'),
                reuseScope: reuseScopeLabel(resolution.reuse_scope),
                restViolation: Boolean(preview.restValidation?.hasViolation || resolution.rest_violation),
                restResult: preview.restValidation?.hasViolation || resolution.rest_violation
                    ? 'Παραβίαση 11ωρης ανάπαυσης' : 'Δεν διαπιστώθηκε παραβίαση 11ωρης ανάπαυσης',
                riskRequired: Boolean(preview.restValidation?.hasViolation || resolution.rest_violation),
                riskAcknowledged: Boolean(resolution.risk_acknowledgement)
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
            reason: text(state.stage1?.reason_or_notes) }));
        const repoDecisions = repoTransferDecisions.filter((decision) =>
            text(decision.employee_kodikos) === employeeCode && dateKeyUtc(decision.week_start) === weekStart)
            .map((decision) => ({ applicable: true,
                sourceDate: dateKeyUtc(decision.canonical_snapshot?.source?.hmeromhnia),
                targetDate: dateKeyUtc(decision.canonical_snapshot?.target?.hmeromhnia),
                result: decisionCodeLabel(decision.decision_code), source: decision.created_by_user_id ? 'HR' : 'Αυτόματα',
                reason: text(decision.notes), decidedAt: decision.created_at || null,
                actor: text(decision.created_by_user_name) }));
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
        const totals = Object.fromEntries(DAILY_NUMBER_FIELDS.map(([field]) => [field,
            number(weekRows.reduce((sum, row) => sum + number(row.values[field]), 0))]));
        return { key, employeeCode, employeeName: weekRows[0]?.employeeName || '', weekStart,
            weekEnd: weekRows[0]?.weekEnd || '',
            sliceStart: lifecycle.employment_date_scope?.authoritative_date_set?.[0] || dates[0] || '',
            sliceEnd: lifecycle.employment_date_scope?.authoritative_date_set?.at?.(-1) || dates.at(-1) || '',
            workdays: workRows.length, repos: weekRows.filter((row) => row.repo).length,
            sixthDay: dateKeyUtc(finalAnalysis.sixthDay?.hmeromhnia) || sixth?.date || '',
            sixthDayRate: finalAnalysis.sixthDay?.premiumRate ?? sixth?.sixthDayRate ?? null,
            sixthDayRateSource: text(finalAnalysis.sixthDay?.premiumRateSource),
            seventhDay: dateKeyUtc(finalAnalysis.seventhDay?.hmeromhnia) || seventh?.date || '',
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
            stage1Decisions, repoDecisions, stage3Decisions,
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
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B4F3A' } };
    sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    sheet.eachRow((row, index) => { if (index > 1) row.alignment = { vertical: 'top', wrapText: true }; });
}
function addSheet(workbook, name, columns, rows) {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = columns;
    sheet.addRows(rows);
    styleSheet(sheet);
    return sheet;
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
        ['Κωδικός', 'employeeCode', 11], ['Εργαζόμενος', 'employeeName', 28], ['Ημερομηνία', 'date', 13],
        ['Καθεστώς απασχόλησης', 'employmentStatus', 22],
        ['Προδηλωμένο', 'declared', 24], ['Κάρτες', 'cards', 24], ['Απολογιστικό', 'approved', 24],
        ...DAILY_NUMBER_FIELDS.map(([field, label]) => [label, field, 14]),
        ['Απολογιστικό βιβλίο', 'apologistikoBook', 16], ['Ρεπό', 'repo', 9],
        ['Άδεια', 'leave', 9], ['Κατηγορία άδειας', 'leaveCategory', 20],
        ['Ασθένεια', 'sickness', 11], ['Απουσία', 'absence', 10], ['Κυριακή', 'sunday', 10],
        ['Αργία', 'holiday', 9], ['6η ημέρα', 'sixth', 11], ['Ποσοστό 6ης ημέρας', 'sixthDayRate', 16],
        ['7η ημέρα', 'seventh', 11], ['Ορφανό χτύπημα', 'orphan', 20],
        ['Κωδικός χαρακτηρισμού', 'classification', 18],
        ['Τελικός χαρακτηρισμός', 'classificationLabel', 22],
        ['Πηγή τελικής κατάστασης', 'classificationSource', 22]
    ].map(([header, key, width]) => ({ header, key, width }));
    const dailySheet = addSheet(workbook, 'ΗΜΕΡΗΣΙΑ ΣΤΟΙΧΕΙΑ', dailyColumns, report.daily.map((row) => ({
        ...row.values, employeeCode: row.employeeCode, employeeName: row.employeeName, date: dateLabel(row.date),
        employmentStatus: row.employmentStatus,
        declared: row.declared, cards: row.cards, approved: row.approved,
        apologistikoBook: row.apologistikoBook ? 'ΝΑΙ' : '', repo: row.repo ? 'ΝΑΙ' : '',
        leave: row.leave ? 'ΝΑΙ' : '', sickness: row.sickness ? 'ΝΑΙ' : '',
        absence: row.absence ? 'ΝΑΙ' : '', sunday: row.sunday ? 'ΝΑΙ' : '', holiday: row.holiday ? 'ΝΑΙ' : '',
        leaveCategory: row.leaveCategory, sixth: row.sixthDay ? 'ΝΑΙ' : '',
        sixthDayRate: row.sixthDay ? number(row.sixthDayRate) : null,
        seventh: row.seventhDay ? 'ΝΑΙ' : '',
        orphan: row.orphan ? `${row.orphan.label} — ${row.orphan.status}` : '',
        classification: row.classification, classificationLabel: row.classificationLabel,
        classificationSource: row.classificationSource
    })));
    DAILY_NUMBER_FIELDS.forEach(([field]) => { dailySheet.getColumn(field).numFmt = '0.00'; });
    dailySheet.getColumn('sixthDayRate').numFmt = '0.00';
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
function pdfFooterLines(pageNumber, pageCount) {
    const currentYear = new Date().getFullYear();
    return [
        `(c) 2009 - ${currentYear}  Copyright: WebPayrollSolutions.com • Ιωλκού 266α Βόλος`,
        `Τηλ. 2421056825 • Κιν. 6972012650 • eMail: support@WebPayrollSolutions.com • Σελίδα ${pageNumber} / ${pageCount}`
    ];
}
function addFooters(doc, fonts, report) {
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
        doc.switchToPage(index);
        const bottomMargin = doc.page.margins.bottom;
        const left = doc.page.margins.left;
        const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const [firstLine, secondLine] = pdfFooterLines(index + 1, range.count);
        doc.page.margins.bottom = 0;
        doc.save().lineWidth(0.35).strokeColor('#b9b1aa')
            .moveTo(left, doc.page.height - 36).lineTo(left + width, doc.page.height - 36).stroke().restore();
        doc.font(fonts.regular).fontSize(6.8).fillColor('#666666')
            .text(firstLine, left, doc.page.height - 32,
                { width, align: 'center', lineBreak: false })
            .text(secondLine, left, doc.page.height - 22,
                { width, align: 'center', lineBreak: false });
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
        doc.font(fonts.regular).fontSize(7.2);
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
            doc.font(fonts.regular).fontSize(7.2).fillColor('#3f342c').text(`↳ Απολογιστικά: ${analysis}`,
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
function writePeriodSummary(doc, report, fonts) {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    ensureSpace(doc, 90);
    doc.x = left;
    doc.moveDown(0.8).font(fonts.bold).fontSize(11).fillColor('#4f392a')
        .text('ΑΝΑΚΕΦΑΛΑΙΩΤΙΚΟΣ ΠΙΝΑΚΑΣ ΠΕΡΙΟΔΟΥ', left, doc.y, { width });
    doc.moveDown(0.25);
    const base = report.employees.map((employee) => ({ code: employee.employeeCode, name: employee.employeeName,
        work: employee.totals.ores_ergasias_apologistika.toFixed(2),
        actual: employee.totals.ores_pragmatikhs_ergasias_apologistika.toFixed(2),
        absence: employee.totals.ores_apoysias_apologistika.toFixed(2),
        night: employee.totals.ores_nyxtas_apologistika.toFixed(2),
        holiday: employee.totals.ores_argion_ergasia_apologistika.toFixed(2),
        extra: employee.totals.ores_prostheths_ergasias_apologistika.toFixed(2),
        sixth: employee.counts.sixthDays, seventh: employee.counts.seventhDays }));
    table(doc, [
        { label: 'Κωδ.', key: 'code', width: 7 }, { label: 'Εργαζόμενος', key: 'name', width: 22 },
        { label: 'Εργασία', key: 'work', width: 9 }, { label: 'Πραγματική', key: 'actual', width: 10 },
        { label: 'Απουσία', key: 'absence', width: 9 }, { label: 'Νύχτα', key: 'night', width: 8 },
        { label: 'Εργασία αργίας', key: 'holiday', width: 11 }, { label: 'Πρόσθετη', key: 'extra', width: 9 },
        { label: '6η', key: 'sixth', width: 5 }, { label: '7η', key: 'seventh', width: 5 }
    ], base, fonts);
    doc.x = left;
    doc.moveDown(0.35).font(fonts.bold).fontSize(8.5).fillColor('#4f392a')
        .text('Β. ΥΠΕΡΕΡΓΑΣΙΑ / ΥΠΕΡΩΡΙΕΣ', left, doc.y, { width });
    const special = report.employees.map((employee) => ({ code: employee.employeeCode, name: employee.employeeName,
        overwork: employee.totals.ores_yperergasias_apologistika.toFixed(2),
        legal: employee.totals.ores_nominhs_yperorias_apologistika.toFixed(2),
        illegal: employee.totals.ores_paranomhs_yperorias_apologistika.toFixed(2),
        holidayPremium: employee.totals.ores_argion_prosayxhsh_apologistika.toFixed(2) }));
    table(doc, [
        { label: 'Κωδ.', key: 'code', width: 8 }, { label: 'Εργαζόμενος', key: 'name', width: 32 },
        { label: 'Υπερεργασία', key: 'overwork', width: 15 },
        { label: 'Νόμιμη υπερωρία', key: 'legal', width: 15 },
        { label: 'Παράνομη υπερωρία', key: 'illegal', width: 15 },
        { label: 'Προσαύξηση αργίας', key: 'holidayPremium', width: 15 }
    ], special, fonts);
    writeTotalsGrid(doc, { totals: report.summary.totals, counts: report.summary.counts }, fonts,
        `Γενικό σύνολο περιόδου — ${report.summary.employeeCount} εργαζόμενοι`);
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
function buildEmploymentReviewPdf(report, { dossier = false } = {}) {
    const fonts = createPdf({ landscape: true });
    const { doc } = fonts;
    writeHeader(doc, report, fonts, dossier ? 'ΦΑΚΕΛΟΣ ΕΛΕΓΧΟΥ ΑΠΑΣΧΟΛΗΣΗΣ' : 'ΕΛΕΓΧΟΣ ΑΠΑΣΧΟΛΗΣΕΩΝ');
    doc.font(fonts.bold).fontSize(10).text('Σύνοψη');
    doc.font(fonts.regular).fontSize(8).text(
        `Εργαζόμενοι: ${report.summary.employeeCount}   Εκκρεμότητες: ${report.summary.pendingCount}   ` +
        `6ες ημέρες: ${report.summary.sixthDays}   7ες ημέρες: ${report.summary.seventhDays}   ` +
        `Παραβάσεις: ${report.summary.severeViolations}`
    );
    if (!dossier) {
        report.employees.forEach((employee, index) => {
            if (index > 0) doc.addPage();
            doc.moveDown(0.7).font(fonts.bold).fontSize(11).fillColor('#4f392a')
                .text(`${employee.employeeCode} — ${employee.employeeName}`);
            doc.font(fonts.regular).fontSize(7.5).fillColor('#222222')
                .text(`Καθεστώς απασχόλησης: ${employee.periodEmploymentStatus}`);
            doc.moveDown(0.2);
            writeCompactDailyTable(doc, employee.rows, fonts);
            writeTotalsGrid(doc, employee, fonts, 'Σύνολα εργαζομένου');
        });
        writePeriodSummary(doc, report, fonts);
    } else {
        report.employees.forEach((employee) => {
            doc.addPage();
            doc.font(fonts.bold).fontSize(14).fillColor('#4f392a').text(`${employee.employeeCode} — ${employee.employeeName}`);
            const dates = employee.rows.map((row) => row.date).sort();
            doc.font(fonts.regular).fontSize(8).fillColor('#222222').text(
                `Διάστημα σχέσης στην περίοδο: ${dateLabel(dates[0])}–${dateLabel(dates.at(-1))}   Παράρτημα: ${employee.branch}\n` +
                `Καθεστώς απασχόλησης: ${employee.periodEmploymentStatus}   Ειδική κατηγορία: ${employee.specialCategory || '—'}\n` +
                `Εβδομαδιαίες ημέρες/ώρες: ${employee.weeklyWorkdays || '—'} / ${employee.weeklyHours || '—'}   ` +
                `Ποσοστό 6ης ημέρας: ${employee.sixthDayRate === null ? 'κανονική πολιτική' : `${employee.sixthDayRate}%`}   ` +
                `Πηγή προφίλ: ${employee.profileSource || '—'}`
            );
            doc.moveDown(0.5).font(fonts.bold).fontSize(10).text('Α. Ημερήσιο ημερολόγιο');
            writeCompactDailyTable(doc, employee.rows, fonts);
            writeTotalsGrid(doc, employee, fonts, 'Σύνολα εργαζομένου');
            ensureSpace(doc, 55);
            doc.moveDown(0.6).font(fonts.bold).fontSize(10).text('Β. Στάδιο 1 — Χαρακτηρισμός αδειών');
            doc.font(fonts.regular).fontSize(7.5);
            employee.weeks.forEach((week) => {
                doc.font(fonts.bold).text(`${dateLabel(week.weekStart)}–${dateLabel(week.weekEnd)}`);
                doc.font(fonts.regular);
                week.stage1Decisions.forEach((decision) => doc.text(
                    `${dateLabel(decision.date)} — Αρχική κατάσταση: ${decision.initial || '—'} — ` +
                    `Τελικό αποτέλεσμα: ${decision.result} — Πηγή: ${decision.source}` +
                    `${decision.reason ? ` — Αιτιολογία: ${decision.reason}` : ''}`));
            });
            ensureSpace(doc, 55);
            doc.moveDown(0.6).font(fonts.bold).fontSize(10).text('Γ. Στάδιο 2 — Μεταφορά ρεπό');
            doc.font(fonts.regular).fontSize(7.5);
            employee.weeks.forEach((week) => {
                doc.font(fonts.bold).text(`${dateLabel(week.weekStart)}–${dateLabel(week.weekEnd)}`);
                doc.font(fonts.regular);
                if (!week.repoDecisions.length) doc.text('Δεν εφαρμόστηκε μεταφορά ρεπό.');
                week.repoDecisions.forEach((decision) => doc.text(
                    `Εφαρμόζεται — ${dateLabel(decision.sourceDate)} → ${dateLabel(decision.targetDate)} — ` +
                    `Αποτέλεσμα: ${decision.result} — Πηγή: ${decision.source}` +
                    `${decision.reason ? ` — Αιτιολογία: ${decision.reason}` : ''}`));
            });
            ensureSpace(doc, 55);
            doc.moveDown(0.6).font(fonts.bold).fontSize(10).text('Δ. Στάδιο 3 — Υπόλοιπες πιθανές άδειες');
            doc.font(fonts.regular).fontSize(7.5);
            const stage3Decisions = employee.weeks.flatMap((week) => week.stage3Decisions);
            if (!stage3Decisions.length) doc.text('Δεν καταγράφηκε απόφαση για υπόλοιπη πιθανή άδεια.');
            stage3Decisions.forEach((decision) => doc.text(
                `${dateLabel(decision.date)} — ${decision.initial} → ${decision.result}` +
                `${decision.leaveCategory ? ` — Κατηγορία άδειας: ${decision.leaveCategory}` : ''} — ` +
                `Πηγή: ${decision.source}${decision.reason ? ` — Αιτιολογία: ${decision.reason}` : ''}` +
                `${decision.decidedAt ? ` — Χρόνος: ${new Date(decision.decidedAt).toISOString()}` : ''}` +
                `${decision.actor ? ` — Χρήστης: ${decision.actor}` : ''}`));
            ensureSpace(doc, 80);
            doc.moveDown(0.6).font(fonts.bold).fontSize(10).text('Ε. Στάδιο 4 — Τελικός εβδομαδιαίος έλεγχος');
            doc.font(fonts.regular).fontSize(7.5);
            employee.weeks.forEach((week) => doc.text(
                `${dateLabel(week.weekStart)}–${dateLabel(week.weekEnd)} — ` +
                `Διάστημα σχέσης: ${dateLabel(week.sliceStart)}–${dateLabel(week.sliceEnd)} — ` +
                `Ημέρες εργασίας: ${week.workdays} — Ρεπό: ${week.repos} — ` +
                `6η ημέρα: ${week.sixthDay ? `${dateLabel(week.sixthDay)} / ${week.sixthDayRate ?? 0}%` : 'Όχι'} — ` +
                `7η ημέρα: ${week.seventhDay ? dateLabel(week.seventhDay) : 'Όχι'} — ` +
                `Νύχτα: ${week.totals.ores_nyxtas_apologistika.toFixed(2)} — ` +
                `Κυριακές/αργίες: ${week.sundays}/${week.holidays} — ` +
                `Πρόσθετη: ${week.totals.ores_prostheths_ergasias_apologistika.toFixed(2)} — ` +
                `Υπερεργασία: ${week.totals.ores_yperergasias_apologistika.toFixed(2)} — ` +
                `Νόμιμη υπερωρία: ${week.totals.ores_nominhs_yperorias_apologistika.toFixed(2)} — ` +
                `Παράνομη υπερωρία: ${week.totals.ores_paranomhs_yperorias_apologistika.toFixed(2)} — ` +
                `Σοβαρές παραβάσεις: ${week.severeReasons.length ? week.severeReasons.join(', ') : 'Καμία'} — ` +
                `Τελική κατάσταση: ${week.status || '—'}`));
            const orphans = employee.rows.filter((row) => row.orphan);
            if (orphans.length) {
                ensureSpace(doc, 55);
                doc.moveDown(0.6).font(fonts.bold).fontSize(10).text('ΣΤ. Ορφανά χτυπήματα');
                doc.font(fonts.regular).fontSize(7.5);
                orphans.forEach((row) => doc.text(`${dateLabel(row.date)} — ${row.orphan.label} — Πραγματικό χτύπημα: ${row.orphan.rawPunch || '—'} — ` +
                    `Κατάσταση: ${row.orphan.status} — Εγκεκριμένο διάστημα: ${row.orphan.approvedInterval || '—'} — ` +
                    `Εμβέλεια απόφασης: ${row.orphan.reuseScope || '—'} — ${row.orphan.restResult} — ` +
                    `Επιβεβαίωση κινδύνου: ${row.orphan.riskRequired ? (row.orphan.riskAcknowledged ? 'Δόθηκε' : 'Απαιτήθηκε, δεν καταγράφεται ως δοθείσα') : 'Δεν απαιτήθηκε'} — ` +
                    `Τελικά στοιχεία: εργασία ${row.values.ores_ergasias_apologistika.toFixed(2)}, ` +
                    `νύχτα ${row.values.ores_nyxtas_apologistika.toFixed(2)}, ` +
                    `Κυριακή/αργία ${row.sunday || row.holiday ? 'ΝΑΙ' : 'ΟΧΙ'}`));
            }
        });
        writePeriodSummary(doc, report, fonts);
        doc.addPage();
        doc.font(fonts.bold).fontSize(13).text('Τεχνικό παράρτημα');
        doc.font(fonts.regular).fontSize(8).text([
            `Ημερομηνία δημιουργίας: ${new Date(report.generatedAt).toISOString()}`,
            `Κατάσταση περιόδου: ${text(report.metadata.periodStatus)}`,
            `Έκδοση ελέγχου περιόδου: ${text(report.metadata.periodVersion)}`,
            `Κατάσταση ανακατασκευής: ${text(report.metadata.reconstructionStatus)}`,
            `Έκδοση ανακατασκευής: ${text(report.metadata.reconstructionVersion)}`,
            `Έκδοση πολιτικής: ${text(report.metadata.policyVersion)}`,
            `Έκδοση σχήματος αναφοράς: ${report.schemaVersion}`,
            `Αποτύπωμα παγωμένου αποτελέσματος/αναφοράς: ${text(report.metadata.frozenFingerprint) || 'Δεν υπάρχει'}`,
            ...report.weekly.flatMap((week) => week.stages.filter((stage) => stage.fingerprint).map((stage) =>
                `${week.employeeCode} ${dateLabel(week.weekStart)}–${dateLabel(week.weekEnd)} ${stage.stage}: ${stage.fingerprint}`))
        ].join('\n'));
    }
    addFooters(doc, fonts, report);
    return doc;
}

module.exports = { REPORT_SCHEMA_VERSION, DAILY_NUMBER_FIELDS, TOTAL_NUMBER_FIELDS, COUNT_FIELDS,
    authoritativeDailyState,
    buildEmploymentReviewReportProjection, buildEmploymentReviewWorkbook,
    buildEmploymentReviewPdf, dailyAnalysis, dateLabel, orphanLabel, pdfFooterLines,
    employmentStatusLabel, presentationLeaveCategory };
