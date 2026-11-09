'use strict';

// Read-only policy for the two Ergani II programs. Never use this resolver at
// the employee/history write boundary: those validators remain strict.
const T = require('../../utils/ergazomenoi/employmentProfileTemporal');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { historyCoverageError } = require('../../utils/ergazomenoi/employmentHistoryCoverage');
const { resolveCardPairVerification } = require('./apasxoliseisCardPairResolverService');
const { resolvePayrollBreakIntervals } = require('../../utils/ergazomenoi/resolvePayrollBreakIntervals');

const LEGACY_FALLBACK_ASSUMED = 'LEGACY_FALLBACK_ASSUMED';
const FALLBACK_TERMS = Object.freeze({ hmeres_ergasias_ebdomadas: 5,
    ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 8,
    kathestos_apasxolhshs: '0', typos_apasxolhshs: '0', typos_ebdomadas: '5HMERH',
    dialleima_se_lepta: 0, evelikth_proselefsh: 0 });

function assumeLegacyTerms(profile, fields = Object.keys(FALLBACK_TERMS)) {
    const assumed = Object.fromEntries(fields.map(field => [field, FALLBACK_TERMS[field]]));
    return { ...profile, ...assumed, source: LEGACY_FALLBACK_ASSUMED,
        resolution_source: LEGACY_FALLBACK_ASSUMED, legacy_fallback_status: LEGACY_FALLBACK_ASSUMED,
        assumed_work_terms: assumed, history_terms_unavailable: true,
        history_warning: profile.history_warning || { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED',
            diagnostics: [], details: {} },
        resolution_blocked: false, resolution_reason: null, all_financial_results_documented: false };
}

function unavailableHistoryProfile(error, date, employee = {}) {
    return assumeLegacyTerms({
        ...Object.fromEntries(T.ANCHOR_FIELDS.map(field => [field, null])),
        source: 'LEGACY_HISTORY_UNAVAILABLE', resolution_source: 'LEGACY_HISTORY_UNAVAILABLE',
        history_terms_unavailable: true, resolution_blocked: false, resolution_reason: null,
        history_warning: { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED',
            diagnostics: error.diagnostics || [], details: error.details || {} },
        review_date: T.day(date)?.toISOString().slice(0, 10) || null,
        profile_company_id: employee.company_kod || null,
        profile_employee_id: employee._id || null, profile_history_id: null, istorikoId: null,
        unavailable_financial_fields: ['nomimoOromisthio', 'pragmatikoOromisthio',
            'pososto_prosayxhshs_6hs_hmeras']
    });
}

function resolveErganiHistoryProfile({ date, history = [], employee = {}, resolve }) {
    const missingWorkTerms = [];
    try {
        const target = T.day(date);
        const candidates = semanticHistoryRows(history).filter(row => {
            if (row.afora_allagh_oron_ergasias === false && !row.afora_proslhpsh) return false;
            const from = T.start(row), until = T.end(row);
            return from && target && from <= target && (!until || target <= until);
        });
        const recordedBaseline = T.fallback(date, employee, history).source ===
            'PRE_V1_COMPATIBILITY_ANCHOR';
        // Neither schema version, sort order nor creation time proves which
        // overlapping observation is correct.
        if (candidates.length > 1) throw historyCoverageError([{
            from: target.toISOString().slice(0, 10), to: target.toISOString().slice(0, 10),
            reason: 'OVERLAPPING_WORK_TERMS', matchingProfileCount: candidates.length
        }], target);
        if (!candidates.length && !recordedBaseline && semanticHistoryRows(history).some(row =>
            row.afora_proslhpsh === true || row.afora_allagh_oron_ergasias !== false || T.start(row)))
            throw historyCoverageError([{ from: target?.toISOString().slice(0, 10),
                to: target?.toISOString().slice(0, 10), reason: 'NO_VERIFIED_PROFILE_FOR_DATE',
                matchingProfileCount: 0 }], target);
        if (candidates.length === 1) {
            try {
                const { registryEntry } = require('./employeeHistoryCorrectionFieldRegistryService');
                for (const code of ['WORK_DAYS', 'WEEKLY_HOURS', 'DAILY_HOURS']) {
                    const entry = registryEntry(code);
                    let value = candidates[0][entry.fields[0]];
                    const legacyObservation = candidates[0].employment_profile_schema_version == null;
                    // Pre-V1 observations stored days and weekly hours; their
                    // daily average has always been derived from those facts.
                    // V1 snapshots still require their recorded daily value.
                    if (code === 'DAILY_HOURS' && legacyObservation &&
                        (value === undefined || value === null || value === '')) {
                        const weekly = candidates[0].ores_ergasias_ebdomadas;
                        const days = candidates[0].hmeres_ergasias_ebdomadas;
                        if (weekly != null && weekly !== '' && days != null && days !== '')
                            value = Number(weekly) / Number(days);
                    }
                    if (legacyObservation && (value === undefined || value === null || value === '')) {
                        missingWorkTerms.push(entry.fields[0]);
                        continue;
                    }
                    entry.normalize(value);
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
        let resolved = resolve();
        if (resolved.resolution_blocked === true && ['BORROWING_HISTORY_OVERLAP',
            'BORROWING_EMPLOYMENT_PROFILE_MISSING', 'BORROWING_WEEKLY_WORKDAYS_INVALID']
            .includes(resolved.resolution_reason)) return unavailableHistoryProfile(
                historyCoverageError([{ reason: resolved.resolution_reason }], target), date, employee);
        if (candidates.length !== 1) {
            const missing = ['hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas',
                'mo_oron_hmerhsias_ergasias', 'kathestos_apasxolhshs', 'typos_apasxolhshs'].filter(field =>
                resolved[field] == null || resolved[field] === '' ||
                typeof FALLBACK_TERMS[field] === 'number' &&
                    (!Number.isFinite(Number(resolved[field])) || Number(resolved[field]) <= 0 &&
                        FALLBACK_TERMS[field] > 0));
            return missing.length ? assumeLegacyTerms(resolved, missing) : resolved;
        }
        if (missingWorkTerms.length) resolved = { ...assumeLegacyTerms(resolved, missingWorkTerms),
            history_terms_unavailable: true, resolution_blocked: false,
            unavailable_work_terms_fields: missingWorkTerms,
            history_warning: unavailableHistoryProfile(historyCoverageError([{
                from: target?.toISOString().slice(0, 10), to: target?.toISOString().slice(0, 10),
                reason: 'INVALID_OR_MISSING_WORK_TERMS'
            }], target), date, employee).history_warning };
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

function buildLegacyFallbackCompensation({ profile, row, hours = null }) {
    const cards = resolveCardPairVerification(row);
    return { status: LEGACY_FALLBACK_ASSUMED, legacy_fallback_status: LEGACY_FALLBACK_ASSUMED,
        calculation_executed: true, all_results_documented: false, history_terms_unavailable: true,
        assumed_work_terms: profile.assumed_work_terms || {},
        actual_work_hours: row.ores_pragmatikhs_ergasias_apologistika ?? row.ores_ergasias_apologistika ?? null,
        observed_card_minutes: cards.hasCompleteCardEvidence ? cards.verifiedMinutes : null,
        card_verification_status: cards.status,
        ...(hours ? { hours } : {}),
        rates: { paidHourlyRate: null, legalHourlyRate: null }, components: [],
        amounts: { baseActualWorkAmount: null, premiumTotalAmount: null, grossWorkAmount: null },
        total_amount: null, diagnostics: profile.history_warning?.diagnostics || [] };
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
    buildHistoryUnavailableDailyPlan, unavailableWeeklyFields, LEGACY_FALLBACK_ASSUMED,
    buildLegacyFallbackCompensation };
