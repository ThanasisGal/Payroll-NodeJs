'use strict';

// Read-only policy for the two Ergani II programs. Never use this resolver at
// the employee/history write boundary: those validators remain strict.
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { historyCoverageError } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { resolveCardPairVerification } = require('./apasxoliseisCardPairResolverService');
const { resolvePayrollBreakIntervals } = require('../../utils/ergazomenoi/resolvePayrollBreakIntervals');

function unavailableHistoryProfile(error, date, employee = {}) {
    return {
        ...Object.fromEntries(T.ANCHOR_FIELDS.map(field => [field, null])),
        source: 'LEGACY_HISTORY_UNAVAILABLE', resolution_source: 'LEGACY_HISTORY_UNAVAILABLE',
        history_terms_unavailable: true, resolution_blocked: false, resolution_reason: null,
        history_warning: { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED',
            diagnostics: error.diagnostics || [], details: error.details || {} },
        review_date: T.day(date)?.toISOString().slice(0, 10) || null,
        profile_company_id: employee.company_kod || null,
        profile_employee_id: employee._id || null, profile_history_id: null, istorikoId: null
    };
}

function resolveErganiHistoryProfile({ date, history = [], employee = {}, resolve }) {
    try {
        const target = T.day(date);
        const candidates = semanticHistoryRows(history).filter(row => {
            if (row.afora_allagh_oron_ergasias === false && !row.afora_proslhpsh) return false;
            const from = T.start(row), until = T.end(row);
            return from && target && from <= target && (!until || target <= until);
        });
        // Neither schema version, sort order nor creation time proves which
        // overlapping observation is correct.
        if (candidates.length > 1) throw historyCoverageError([{
            from: target.toISOString().slice(0, 10), to: target.toISOString().slice(0, 10),
            reason: 'OVERLAPPING_WORK_TERMS', matchingProfileCount: candidates.length
        }], target);
        if (!candidates.length && semanticHistoryRows(history).some(row =>
            row.afora_proslhpsh === true || row.afora_allagh_oron_ergasias !== false || T.start(row)))
            throw historyCoverageError([{ from: target?.toISOString().slice(0, 10),
                to: target?.toISOString().slice(0, 10), reason: 'NO_VERIFIED_PROFILE_FOR_DATE',
                matchingProfileCount: 0 }], target);
        if (candidates.length === 1) {
            try {
                const { registryEntry } = require('./employeeHistoryCorrectionFieldRegistryService');
                for (const code of ['WORK_DAYS', 'WEEKLY_HOURS', 'DAILY_HOURS']) {
                    const entry = registryEntry(code); entry.normalize(candidates[0][entry.fields[0]]);
                }
                const selected = candidates[0];
                const { calendarDate } = require('../../utils/ergazomenoi/employmentProfileContract');
                for (const field of [T.START, T.END, 'hmeromhnia_apoxorhshs',
                    'hmeromhnia_lhxhs_symbashs', 'hmeromhnia_allaghs_symbashs'])
                    if (selected[field] != null && selected[field] !== '') calendarDate(selected[field]);
                if (require('../../utils/ergazomenoi/employmentTypeSemantics')
                    .resolveEmploymentTypeSemantics(candidates[0]).status !== 'RESOLVED') throw new Error();
            } catch {
                throw historyCoverageError([{ from: target?.toISOString().slice(0, 10),
                    to: target?.toISOString().slice(0, 10), reason: 'INVALID_OR_MISSING_WORK_TERMS' }], target);
            }
        }
        const resolved = resolve();
        if (candidates.length !== 1) return resolved;
        // Today's monetary terms cannot complete an older observation. Keep
        // temporal facts usable while recording each missing monetary input.
        const monetary = ['nomimoOromisthio', 'pragmatikoOromisthio', 'pososto_prosayxhshs_6hs_hmeras'];
        const missing = monetary.filter(field => candidates[0][field] == null || candidates[0][field] === '');
        if (!missing.length) return resolved;
        return { ...resolved, ...Object.fromEntries(missing.map(field => [field, null])),
            unavailable_financial_fields: missing, all_financial_results_documented: false };
    } catch (error) {
        if (error?.code !== 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED') throw error;
        return unavailableHistoryProfile(error, date, employee);
    }
}

const DEPENDENT_HOURS = [
    'ores_ergasias', 'ores_pragmatikhs_ergasias', 'ores_apoysias', 'ores_adeias_pistomenes',
    'ores_argias_pistomenes', 'ores_nyxtas', 'ores_argion_prosayxhsh', 'ores_argion_ergasia',
    'ores_prostheths_ergasias',
    ...['yperergasias', 'nominhs_yperorias', 'paranomhs_yperorias'].flatMap(type =>
        ['', '_nyxtas', '_argion', '_argion_nyxtas'].map(suffix => 'ores_' + type + suffix))
].map(field => field + '_apologistika');

function buildHistoryUnavailableDailyPlan({ row, effectiveEmployee, operations, appliedProtectionContext }) {
    if (row.is_locked === true) return { workingRow: row, sanitizedUpdate: {}, protectionDiagnostics: [] };
    const cards = resolveCardPairVerification(row);
    const work = cards.completePairs.map(pair => ({ start: pair.startMinutes,
        end: pair.startMinutes + pair.durationMinutes }));
    const breaks = resolvePayrollBreakIntervals({ row, effectiveEmployee: {}, workIntervals: work });
    // A split daily schedule proves that no additional break applies. Otherwise
    // a missing historical break policy prevents claiming a net work duration.
    const actualHours = breaks.splitSchedule && !cards.hasUnresolvedCardEvidence
        ? breaks.netMinutes / 60 : null;
    const update = {
        ...Object.fromEntries(DEPENDENT_HOURS.map(field => [field, null])),
        ores_pragmatikhs_ergasias_apologistika: actualHours,
        ores_ergasias_apologistika: actualHours,
        compensation_breakdown_apologistika: {
            status: 'PARTIAL_HISTORY_UNAVAILABLE', calculation_executed: true,
            all_results_documented: false, history_terms_unavailable: true,
            observed_card_minutes: cards.hasCompleteCardEvidence ? cards.verifiedMinutes : null,
            card_verification_status: cards.status, actual_work_hours: actualHours,
            unavailable_fields: DEPENDENT_HOURS.filter(field => updateValue(field, actualHours) === null),
            diagnostics: effectiveEmployee.history_warning?.diagnostics || [], total_amount: null
        }
    };
    const protectedUpdate = operations.sanitizeAppliedRepoTransferUpdate({ rowId: row._id,
        currentRow: row, update, protectionContext: appliedProtectionContext });
    return { workingRow: { ...row, ...protectedUpdate.sanitizedUpdate }, update,
        sanitizedUpdate: protectedUpdate.sanitizedUpdate,
        protectionDiagnostics: protectedUpdate.diagnostics || [] };
}
function updateValue(field, actualHours) {
    return ['ores_ergasias_apologistika', 'ores_pragmatikhs_ergasias_apologistika'].includes(field)
        ? actualHours : null;
}

function unavailableWeeklyFields() {
    return Object.fromEntries(DEPENDENT_HOURS.filter(field =>
        /yperergasias|yperorias|prostheths/.test(field)).map(field => [field, null]));
}
module.exports = { resolveErganiHistoryProfile, unavailableHistoryProfile,
    buildHistoryUnavailableDailyPlan, unavailableWeeklyFields };
