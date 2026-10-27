'use strict';

// Read projections only: never resolve current work terms or calculate work time.
const { dateKeyUtc, startOfWeekMondayUtc, endOfWeekSundayUtc } = require('../../utils/date/mondaySundayWeek');
const { deriveEmploymentOwnedDateScope, deriveDeferredWeekScope } = require('./apasxoliseisEmploymentPeriodScopeService');

const copy = value => JSON.parse(JSON.stringify(value));
const text = value => String(value ?? '').trim();
const branch = value => text(value).padStart(4, '0');
const HISTORY_WARNING = 'Εμφανίζονται τα αποθηκευμένα αποτελέσματα. Δεν ήταν δυνατή η συμπλήρωση ορισμένων πληροφοριών επειδή λείπει επαληθευμένο Ιστορικό. 1. Ελέγξτε το Ιστορικό του εργαζομένου πριν από νέο υπολογισμό ή αλλαγή. 2. Επαναλάβετε την επιθυμητή ενέργεια μετά την τακτοποίηση. Δεν αποθηκεύτηκε καμία αλλαγή από την προβολή. Κωδικός αναφοράς: ΙΣΤ-ΚΑΛΥΨΗ-01.';

function frozenReadError(code = 'FINALIZED_SNAPSHOT_MISSING') {
    return Object.assign(new Error('Δεν ανακτήθηκε το αποθηκευμένο αποτέλεσμα της οριστικοποιημένης περιόδου. Η προβολή σταμάτησε για να προστατευθούν οι παλιές τιμές. 1. Επιβεβαιώστε την εταιρεία, το υποκατάστημα και την περίοδο. 2. Ζητήστε τεχνικό έλεγχο του αποθηκευμένου στιγμιοτύπου. Δεν αποθηκεύτηκε καμία αλλαγή. Κωδικός αναφοράς: ' + code + '.'), { code, statusCode: 409 });
}

// Opt in only at presentation callers. Command/calculation callers stay strict.
function resolveProfileForStoredRead(resolve, { employeeKodikos = '', warnings = [] } = {}) {
    try { return resolve(); } catch (error) {
        if (error?.code !== 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED') throw error;
        if (!warnings.some(item => item.employee_kodikos === text(employeeKodikos))) {
            warnings.push({ code: error.code, employee_kodikos: text(employeeKodikos), message: HISTORY_WARNING });
        }
        return { resolution_blocked: true, resolution_reason: error.code,
            source: 'STORED_RESULT_HISTORY_UNAVAILABLE', resolution_source: 'STORED_RESULT_HISTORY_UNAVAILABLE' };
    }
}

function frozenProfileFields(row) {
    const p = row.effective_profile_resolved;
    if (!p || typeof p !== 'object') return {};
    const mapping = {
        effective_weekly_workdays: 'hmeres_ergasias_ebdomadas', effective_weekly_hours: 'ores_ergasias_ebdomadas',
        effective_daily_hours: 'mo_oron_hmerhsias_ergasias', effective_kathestos_apasxolhshs: 'kathestos_apasxolhshs',
        effective_typos_apasxolhshs: 'typos_apasxolhshs', effective_typos_ebdomadas: 'typos_ebdomadas'
    };
    return Object.fromEntries(Object.entries(mapping).filter(([, field]) => p[field] !== undefined)
        .map(([field, source]) => [field, p[source]]));
}

function storedDailyPresentation(row) {
    const intervals = prefix => ['01', '02', '03'].map(pair => ({
        start: text(row[prefix + 'apo_ora_' + pair]), end: text(row[prefix + 'eos_ora_' + pair])
    })).filter(item => item.start || item.end);
    const type = row.effective_kathestos_apasxolhshs ?? row.effective_typos_apasxolhshs ?? row.kathestos_apasxolhshs_hmeras;
    return { date: dateKeyUtc(row.hmeromhnia), employment_type: type ?? null,
        employment_label: ({ '0': 'Πλήρης', '1': 'Μερική', '2': 'Εκ περιτροπής / Μερική' })[type] || 'Άγνωστο',
        declared_intervals: intervals(''), card_intervals: intervals('cards_'),
        declared_hours: row.ores_ergasias ?? null, card_hours: row.cards_ores_ergasias ?? null,
        actual_work_hours: row.ores_pragmatikhs_ergasias_apologistika ?? row.ores_ergasias_apologistika ?? null,
        holiday_classification_eligible: false,
        current_apologistiko_classification: row.kathgoria_ergasias_apologistika || row.kathgoria_adeias_apologistika || '' };
}

function projectStoredFrozenReview({ snapshot, scope, kodikos = '', from = scope.period_start, to = scope.period_end } = {}) {
    if (!snapshot || !Array.isArray(snapshot.daily_results)) throw frozenReadError();
    if (!['employment-period-frozen:v1', 'employment-period-frozen:v2', 'employment-period-frozen:v3']
        .includes(snapshot.snapshot_schema_version)) throw frozenReadError('FINALIZED_SNAPSHOT_VERSION_UNSUPPORTED');
    const frozen = copy(snapshot);
    for (const field of ['team', 'company_kod', 'ypokatasthma']) {
        if (frozen.scope?.[field] != null && text(frozen.scope[field]) !== text(scope[field]))
            throw frozenReadError('FINALIZED_SNAPSHOT_SCOPE_MISMATCH');
    }
    const employees = new Map((frozen.employees || []).map(employee => [text(employee.kodikos), employee]));
    const inScope = row => (!row.team || text(row.team) === text(scope.team)) &&
        (!row.company_kod || text(row.company_kod) === text(scope.company_kod)) &&
        branch(row.ypokatasthma || scope.ypokatasthma) === branch(scope.ypokatasthma) &&
        (!kodikos || text(row.kodikos) === text(kodikos));
    const decorate = row => {
        const employee = employees.get(text(row.kodikos)) || {};
        // Employee identity comes from the frozen local employee, never a borrowing employer.
        const p = row.effective_profile_resolved || {};
        const employeeId = employee._id || row.employee_id ||
            (text(p.profile_company_id) === text(scope.company_kod) ? p.profile_employee_id : null);
        return { ...frozenProfileFields(row), employee_id: employeeId || null,
            eponymo: employee.eponymo || '', onoma: employee.onoma || '',
            employeeName: `${employee.eponymo || ''} ${employee.onoma || ''}`.trim(),
            exportYpokatasthma: row.ypokatasthma || scope.ypokatasthma, ...row };
    };
    const rows = frozen.daily_results.filter(row => inScope(row) && dateKeyUtc(row.hmeromhnia) >= dateKeyUtc(from) &&
        dateKeyUtc(row.hmeromhnia) <= dateKeyUtc(to)).map(decorate);
    const selected = new Set(rows.map(row => `${text(row.kodikos)}|${dateKeyUtc(startOfWeekMondayUtc(row.hmeromhnia))}`));
    const contextRows = (frozen.weekly_calculation_context?.rows || frozen.daily_results).filter(inScope).map(decorate);
    const groups = new Map();
    for (const row of contextRows) {
        const key = `${text(row.kodikos)}|${dateKeyUtc(startOfWeekMondayUtc(row.hmeromhnia))}`;
        if (!selected.has(key)) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }
    const lifecycleByWeek = new Map();
    const payloads = [];
    for (const [key, weekRows] of groups) {
        const first = weekRows[0];
        const weekStart = dateKeyUtc(startOfWeekMondayUtc(first.hmeromhnia));
        const weekEnd = dateKeyUtc(endOfWeekSundayUtc(first.hmeromhnia));
        const employee = employees.get(text(first.kodikos)) || {};
        const weeklyScope = { ...scope, employee_id: first.employee_id || '', employee_kodikos: first.kodikos,
            week_start: weekStart, week_end: weekEnd };
        const employmentScope = deriveEmploymentOwnedDateScope({ natural_week_start: weekStart,
            natural_week_end: weekEnd, period_start: scope.period_start, period_end: scope.period_end,
            hire_date: employee.hmeromhnia_proslhpshs, departure_date: employee.hmeromhnia_apoxorhshs,
            employee: { ...employee, employment_history: (frozen.weekly_calculation_context?.profile_history || [])
                .filter(row => text(row.kodikos) === text(first.kodikos)) } });
        const deferred = deriveDeferredWeekScope({ scope: weeklyScope, periodScope: scope,
            employmentDateScope: employmentScope });
        const pending = deferred?.status === 'DEFERRED_TO_NEXT_PERIOD';
        const status = pending ? 'DEFERRED_TO_NEXT_PERIOD' : 'COMPLETED';
        const stages = Object.fromEntries([1, 2, 3, 4].map(index => ['stage' + index, {
            stage: 'STAGE' + index, business_status: status, presentation_status: status,
            persisted_status: status, pending_count: 0, pending_dates: [], pending_items: [],
            pending_reasons: [], blockers: [], diagnostics: [], enabled: true, open_by_default: false,
            final_weekly_analysis_available: false,
            ...(index === 4 ? { analysis_presentation_status: pending ? 'DEFERRED_TO_NEXT_PERIOD' : 'FINAL',
                upstream_stages_completed: true } : {})
        }]));
        const sameWeek = record => text(record.employee_kodikos) === text(first.kodikos) &&
            dateKeyUtc(record.week_start) === weekStart;
        stages.stage2.stored_decisions = (frozen.canonical_decisions || []).filter(sameWeek);
        stages.stage2.stored_transfers = (frozen.applied_repo_transfers || []).filter(sameWeek);
        const lifecycle = { read_only: true, finalized_authoritative: true, source: 'FROZEN_FINALIZED',
            scope: weeklyScope, stages, current_stage: null, total_pending_count: 0, requires_hr_action: false,
            persisted_stage1_status: status, employment_date_scope: employmentScope,
            stage1_no_classification_preview_items: [], ...(deferred ? { deferred_week: deferred } : {}) };
        lifecycleByWeek.set(key, lifecycle);
        payloads.push({ success: true, scope: weeklyScope, employee_name: first.employeeName,
            rows: weekRows, stage1_daily_presentation: weekRows.map(storedDailyPresentation),
            stage1_status: status, write_enabled: false, workflow: { blocking_reasons: [] },
            lifecycle_projection: lifecycle });
    }
    rows.__deviations = frozen.deviations || [];
    rows.__policyVersion = frozen.snapshot_schema_version;
    rows.__preparedPolicyContextRows = contextRows;
    rows.__lifecycleByWeek = lifecycleByWeek;
    rows.__repoTransferDecisions = frozen.canonical_decisions || [];
    rows.__rawRepoTransferExecutions = frozen.applied_repo_transfers || [];
    rows.__periodStart = scope.period_start;
    rows.__periodEnd = scope.period_end;
    return { source: 'FROZEN_FINALIZED', finalized: true, rows, total: rows.length,
        deviations: frozen.deviations || [], payroll_results: frozen.payroll_results || [],
        canonical_decisions: frozen.canonical_decisions || [], applied_repo_transfers: frozen.applied_repo_transfers || [],
        canonicalLifecycleProjections: payloads.map(payload => ({ scope: payload.scope,
            lifecycle_projection: payload.lifecycle_projection })), payloads };
}

function projectStoredDraftReview({ rows = [], scope, workflowStates = [], warnings = [] } = {}) {
    const result = copy(rows);
    const groups = new Map();
    for (const row of result) {
        const key = `${text(row.kodikos)}|${dateKeyUtc(startOfWeekMondayUtc(row.hmeromhnia))}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }
    const payloads = [...groups.values()].map(weekRows => {
        const first = weekRows[0];
        const start = dateKeyUtc(startOfWeekMondayUtc(first.hmeromhnia));
        const state = workflowStates.find(item => text(item.employee_kodikos) === text(first.kodikos) &&
            dateKeyUtc(item.week_start) === start) || {};
        const warning = warnings.find(item => text(item.employee_kodikos) === text(first.kodikos));
        const weeklyScope = { ...scope, employee_kodikos: first.kodikos,
            employee_id: first.employee_id || state.employee_id || '', week_start: start,
            week_end: dateKeyUtc(endOfWeekSundayUtc(first.hmeromhnia)) };
        const stages = Object.fromEntries([1, 2, 3, 4].map(index => {
            const persisted = state['stage' + index]?.status;
            const status = warning ? 'BLOCKED' : persisted || 'OPEN';
            return ['stage' + index, { stage: 'STAGE' + index, business_status: status,
                persisted_status: persisted || null, presentation_status: status,
                enabled: true, open_by_default: false, pending_count: warning ? 1 : 0,
                pending_dates: [], pending_items: [], pending_reasons: warning ? [warning.code] : [],
                blockers: warning ? [warning.code] : [], diagnostics: [],
                final_weekly_analysis_available: false }];
        }));
        return { success: true, scope: weeklyScope, employee_name: first.employeeName ||
            `${first.eponymo || ''} ${first.onoma || ''}`.trim(), rows: weekRows,
            stage1_daily_presentation: weekRows.map(storedDailyPresentation), write_enabled: false,
            workflow: { blocking_reasons: warning ? [warning.code] : [] },
            lifecycle_projection: { read_only: true, stages, requires_hr_action: Boolean(warning),
                current_stage: warning ? 'STAGE1' : null, total_pending_count: warning ? 1 : 0,
                stage1_no_classification_preview_items: [] } };
    });
    result.__preparedPolicyContextRows = result.slice();
    result.__lifecycleByWeek = new Map(payloads.map(payload => [
        `${payload.scope.employee_kodikos}|${payload.scope.week_start}`, payload.lifecycle_projection]));
    result.__workflowStates = copy(workflowStates);
    result.__readWarnings = warnings;
    return { rows: result, payloads, read_warnings: warnings,
        canonicalLifecycleProjections: payloads.map(payload => ({ scope: payload.scope,
            lifecycle_projection: payload.lifecycle_projection })) };
}

module.exports = { HISTORY_WARNING, frozenReadError, resolveProfileForStoredRead, projectStoredFrozenReview,
    projectStoredDraftReview };
