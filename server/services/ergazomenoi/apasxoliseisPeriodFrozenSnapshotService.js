'use strict';

const crypto = require('crypto');

const SNAPSHOT_SCHEMA_VERSION = 'employment-period-frozen:v3';
const DEFAULT_SOURCE_VERSION = 'employment-calculation:v2';
const DAILY_FIELDS = Object.freeze([
    '_id', 'kodikos', 'ypokatasthma', 'hmeromhnia', 'apologistiko_biblio', 'kathgoria_ergasias_apologistika',
    'kathgoria_ergasias', 'repo', 'repo_effective_identity', 'repo_original_identity',
    'ores_ergasias', 'ores_apoysias', 'adeia', 'kathgoria_adeias', 'astheneia',
    'argia', 'argia_apologistika', 'is_locked',
    'apo_ora_01', 'eos_ora_01', 'apo_ora_02', 'eos_ora_02', 'apo_ora_03', 'eos_ora_03',
    'repo_apologistika', 'adeia_apologistika', 'kathgoria_adeias_apologistika', 'astheneia_apologistika',
    'apo_ora_01_apologistika', 'eos_ora_01_apologistika', 'apo_ora_02_apologistika',
    'eos_ora_02_apologistika', 'apo_ora_03_apologistika', 'eos_ora_03_apologistika',
    'cards_apo_ora_01', 'cards_eos_ora_01', 'cards_apo_ora_02', 'cards_eos_ora_02',
    'cards_apo_ora_03', 'cards_eos_ora_03', 'cards_ores_ergasias',
    'orphan_card_resolution',
    'ores_ergasias_apologistika', 'ores_pragmatikhs_ergasias_apologistika',
    'ores_apoysias_apologistika', 'ores_adeias_pistomenes_apologistika',
    'ores_argias_pistomenes_apologistika', 'ores_nyxtas_apologistika',
    'ores_argion_prosayxhsh_apologistika', 'ores_argion_ergasia_apologistika',
    'ores_prostheths_ergasias_apologistika', 'ores_yperergasias_apologistika',
    'ores_yperergasias_nyxtas_apologistika', 'ores_yperergasias_argion_apologistika',
    'ores_yperergasias_argion_nyxtas_apologistika', 'ores_nominhs_yperorias_apologistika',
    'ores_nominhs_yperorias_nyxtas_apologistika', 'ores_nominhs_yperorias_argion_apologistika',
    'ores_nominhs_yperorias_argion_nyxtas_apologistika', 'ores_paranomhs_yperorias_apologistika',
    'ores_paranomhs_yperorias_nyxtas_apologistika', 'ores_paranomhs_yperorias_argion_apologistika',
    'ores_paranomhs_yperorias_argion_nyxtas_apologistika', 'kyriakes_apologistika',
    'compensation_breakdown_apologistika', 'effective_is_full_time', 'effective_kathestos_apasxolhshs',
    'effective_typos_apasxolhshs', 'effective_typos_ebdomadas', 'effective_weekly_workdays',
    'effective_weekly_hours', 'effective_daily_hours', 'effective_profile_source',
    'effective_profile_date', 'effective_profile_istoriko_id', 'effective_profile_resolved',
    'effective_schedule_phase_code',
    'effective_sixth_day_rate', 'sixth_seventh_classification', 'sixth_day_hours', 'seventh_day_hours'
]);
const EMPLOYEE_FIELDS = Object.freeze(['kodikos', 'afm', 'eponymo', 'onoma', 'hmeres_ergasias_ebdomadas',
    'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias', 'kathestos_apasxolhshs',
    'typos_apasxolhshs', 'typos_ebdomadas', 'pososto_prosayxhshs_6hs_hmeras',
    'nomimoHmeromisthio', 'nomimoOromisthio', 'pragmatikoHmeromisthio', 'pragmatikoOromisthio',
    'hmeromhnia_proslhpshs', 'hmeromhnia_apoxorhshs', 'aa_eggrafhs', 'typos_ergazomenon',
    'eidikh_kathgoria_ergazomenoy', 'eidikh_periptosh', 'dialleima_entos_ektos_orarioy',
    'dialleima_se_lepta', 'evelikth_proselefsh', 'plhrhs_apasxolhsh', 'pliris_apasxolhsh',
    'merikh_apasxolhsh']);
const HISTORY_FIELDS = Object.freeze(['_id', 'kodikos', 'aa_eggrafhs', 'hmeromhnia_allaghs_orarioy_apo',
    'hmeromhnia_allaghs_orarioy_eos', 'hmeromhnia_isxyos_oron_ergasias_apo',
    'hmeromhnia_isxyos_oron_ergasias_eos', 'hmeromhnia_allaghs_symbashs',
    'hmeres_ergasias_ebdomadas', 'ores_ergasias_ebdomadas', 'mo_oron_hmerhsias_ergasias',
    'kathestos_apasxolhshs', 'typos_apasxolhshs', 'typos_ebdomadas',
    'pososto_prosayxhshs_6hs_hmeras', 'nomimoHmeromisthio', 'nomimoOromisthio',
    'pragmatikoHmeromisthio', 'pragmatikoOromisthio', 'employment_profile_source',
    'typos_ergazomenon', 'eidikh_kathgoria_ergazomenoy', 'eidikh_periptosh',
    'dialleima_entos_ektos_orarioy', 'dialleima_se_lepta', 'evelikth_proselefsh']);
const PAYROLL_FIELDS = Object.freeze([
    '_id', 'kodikos', 'ypokatasthma', 'xrhsh', 'periodos', 'typos_apodoxon', 'aa_misthodosias',
    'apo_hmeromhnia', 'eos_hmeromhnia', 'nomimo_hmeromisthio', 'pragmatiko_hmeromisthio',
    'nomimo_oromisthio', 'pragmatiko_oromisthio', 'synolo_apodoxon', 'synolo_mikton_apodoxon',
    'synolo_prosayxhseon', 'plhroteo'
]);
const DEVIATION_FIELDS = Object.freeze(['kodikos', 'ypokatasthma', 'week_apo', 'week_eos', 'policyVersion',
    'sourceVersion', 'expected_repo', 'actual_repo', 'missing_repo', 'excess_repo', 'status', 'reasons',
    'deviation_type', 'note', 'effective_expected_repo', 'effective_weekly_workdays',
    'expected_repo_source', 'effective_typos_apasxolhshs', 'effective_profile_source',
    'effective_profile_date', 'effective_profile_istoriko_id']);
const DECISION_FIELDS = Object.freeze(['_id', 'team', 'company_kod', 'ypokatasthma', 'employee_id',
    'employee_kodikos', 'week_start', 'week_end', 'snapshot_version',
    'snapshot_fingerprint', 'canonical_snapshot', 'canonical_status', 'canonical_reasons', 'decision_type',
    'decision_payload', 'decision_payload_fingerprint', 'decision_status', 'policy_version', 'source_version', 'request_id']);
const REPO_FIELDS = Object.freeze(['_id', 'decision_id', 'decision_fingerprint', 'proposal_id',
    'source_prodhlomena_oraria_id', 'target_prodhlomena_oraria_id', 'team', 'company_kod', 'ypokatasthma',
    'employee_id', 'employee_kodikos', 'week_start', 'week_end', 'execution_status',
    'before_snapshot', 'after_snapshot', 'request_id', 'command_identity', 'created_by_user_id',
    'created_by_user_name', 'created_by_user_role', 'applied_at', 'created_at']);
const PHASE_FIELDS = Object.freeze(['kodikos', 'apo', 'eos', 'scope', 'sourceVersion', 'asOfDate',
    'phases', 'phaseSummary', 'dailyFacts', 'weeklyCarryOverDifferences', 'totals', 'inputFingerprint']);
const POLICY_FIELDS = Object.freeze(['policy_code', 'policy_version', 'source_version', 'effective_from', 'effective_to',
    'status', 'parameters', 'rules', 'percentage', 'rate', 'value', 'rate_percent',
    'mandatory_floor_rate_percent', 'version', 'legal_basis_type', 'legal_basis_reference']);

function scalar(value) {
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === 'object' && typeof value.toHexString === 'function') return value.toHexString();
    return value;
}
function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object' || value instanceof Date || typeof value.toHexString === 'function') return scalar(value);
    return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined)
        .map((key) => [key, canonicalize(value[key])]));
}
function pick(source = {}, fields = []) {
    return canonicalize(Object.fromEntries(fields.filter((field) => source[field] !== undefined)
        .map((field) => [field, source[field]])));
}
function sorted(rows, key) {
    return rows.map(canonicalize).sort((a, b) => String(key(a)).localeCompare(String(key(b))));
}
function buildEmploymentPeriodFrozenSnapshot(input = {}) {
    const scope = canonicalize(input.scope || {});
    const dailyResults = sorted((input.dailyResults || []).map((row) => pick(row, DAILY_FIELDS)),
        (row) => `${row.ypokatasthma}|${row.kodikos}|${row.hmeromhnia}|${row._id}`);
    const employeesByCode = new Map((input.employees || []).map((employee) => [String(employee.kodikos || ''), pick(employee, EMPLOYEE_FIELDS)]));
    const employees = [...new Set(dailyResults.map((row) => String(row.kodikos || '')).filter(Boolean))]
        .sort().map((kodikos) => employeesByCode.get(kodikos) || { kodikos });
    const snapshot = canonicalize({
        snapshot_schema_version: SNAPSHOT_SCHEMA_VERSION,
        source_calculation_version: String(input.sourceCalculationVersion || DEFAULT_SOURCE_VERSION),
        scope,
        employees,
        weekly_calculation_context: {
            rows: sorted((input.weeklyDailyResults || input.dailyResults || [])
                .map((row) => pick(row, DAILY_FIELDS)),
            (row) => `${row.ypokatasthma}|${row.kodikos}|${row.hmeromhnia}|${row._id}`),
            profile_history: sorted((input.profileHistory || []).map((row) => pick(row, HISTORY_FIELDS)),
                (row) => `${row.kodikos}|${row.hmeromhnia_isxyos_oron_ergasias_apo || ''}|${row._id}`),
            calendar_facts: sorted((input.calendarFacts || []).map(canonicalize),
                (row) => `${row.hmeromhnia}|${row.ypokatasthma || ''}`),
            applied_transfer_protection: canonicalize(input.appliedTransferProtection || {})
        },
        daily_results: dailyResults,
        payroll_results: sorted((input.payrollResults || []).map((row) => pick(row, PAYROLL_FIELDS)),
            (row) => `${row.kodikos}|${row.typos_apodoxon}|${row.aa_misthodosias}`),
        deviations: sorted((input.deviations || []).map((row) => pick(row, DEVIATION_FIELDS)),
            (row) => `${row.kodikos}|${row.week_apo}|${row.deviation_type}`),
        canonical_decisions: sorted((input.canonicalDecisions || []).map((row) => pick(row, DECISION_FIELDS)),
            (row) => `${row.employee_kodikos}|${row.week_start}|${row.snapshot_fingerprint}`),
        applied_repo_transfers: sorted((input.appliedRepoTransfers || []).map((row) => pick(row, REPO_FIELDS)),
            (row) => `${row.employee_kodikos}|${row.week_start}|${row.decision_fingerprint}`),
        payroll_phase_facts: sorted((input.payrollPhaseFacts || []).map((row) => pick(row, PHASE_FIELDS)),
            (row) => `${row.kodikos}|${row.apo}|${row.eos}`),
        policy_context: canonicalize({ ...(input.policyContext || {}),
            rules: (input.policyContext?.rules || []).map((row) => pick(row, POLICY_FIELDS)) })
    });
    const fingerprintProjection = canonicalize({ ...snapshot,
        applied_repo_transfers: (snapshot.applied_repo_transfers || []).map((row) => {
            const projected = { ...row };
            for (const field of ['created_by_user_id', 'created_by_user_name', 'created_by_user_role',
                'applied_at', 'created_at']) delete projected[field];
            return projected;
        }) });
    const frozen_snapshot_fingerprint = crypto.createHash('sha256').update(JSON.stringify(fingerprintProjection)).digest('hex');
    return Object.freeze({ snapshot, frozen_snapshot_fingerprint,
        snapshot_schema_version: SNAPSHOT_SCHEMA_VERSION,
        source_calculation_version: snapshot.source_calculation_version });
}

function projectFrozenReview(snapshot = {}, { kodikos = '' } = {}) {
    const rows = (snapshot.daily_results || [])
        .filter((row) => !kodikos || String(row.kodikos) === String(kodikos))
        .map(projectFrozenSixthSeventhPresentation);
    return Object.freeze({ source: 'FROZEN_FINALIZED', rows, total: rows.length,
        deviations: snapshot.deviations || [], payroll_results: snapshot.payroll_results || [],
        corrective: null });
}

function projectFrozenSixthSeventhPresentation(row = {}) {
    const classification = String(row.sixth_seventh_classification || '').trim().toUpperCase();
    const isSixthDay = classification === 'SIXTH' && Number(row.sixth_day_hours || 0) > 0;
    const isSeventhDay = classification === 'SEVENTH' && Number(row.seventh_day_hours || 0) > 0;
    return { ...row,
        is_sixth_day: isSixthDay,
        sixth_day_premium_rate: isSixthDay ? row.effective_sixth_day_rate ?? null : null,
        is_seventh_day: isSeventhDay,
        seventh_day_severity: isSeventhDay ? 'SERIOUS_VIOLATION' : '' };
}

module.exports = { SNAPSHOT_SCHEMA_VERSION, DEFAULT_SOURCE_VERSION, DAILY_FIELDS, EMPLOYEE_FIELDS,
    HISTORY_FIELDS, PAYROLL_FIELDS,
    canonicalize, buildEmploymentPeriodFrozenSnapshot, projectFrozenReview,
    projectFrozenSixthSeventhPresentation };
