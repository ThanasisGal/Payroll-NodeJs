'use strict';

const C = require('./employmentProfileContract');
const T = require('./employmentProfileTemporal');
const { resolveBreakConfigurationForDate } = require('./resolveBreakConfigurationForDate');
const { buildCanonicalWorkTermsSnapshotFields } = require('./getOrarioTermsForDate');

const BASE_HISTORY_FIELDS = [
    'hmeromhnia_proslhpshs', 'hmeromhnia_allaghs_symbashs',
    'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos',
    'hmeromhnia_lhxhs_symbashs', 'hmeromhnia_apoxorhshs',
    'misthologiko_klimakio', 'symbash', 'kathgoria_symbashs', 'eidikothta_symbashs',
    'synolo_symbashs', 'synolo_symbashs_basei_oron_ergasias',
    'nomimosMisthos', 'nomimoHmeromisthio', 'nomimoOromisthio',
    'pragmatikosMisthos', 'pragmatikoHmeromisthio', 'pragmatikoOromisthio',
    ...Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, '0')).flatMap((i) =>
        [`stoixeio_symbashs_${i}`, `poso_symbashs_${i}`, `poso_symbashs_basei_oron_ergasias_${i}`]),
    ...Array.from({ length: 7 }, (_, i) => `krathsh_${String(i + 1).padStart(2, '0')}`)
];

function buildCompleteProfileSnapshot({ input = {}, current = {}, effectiveFrom }) {
    const from = C.calendarDate(effectiveFrom, 'effectiveFrom');
    if (!from) C.invalid('effectiveFrom', 'required');
    const facts = C.normalizeEmploymentProfileSubmission(input, current);
    const merged = { ...current, ...input };
    return {
        ...Object.fromEntries(BASE_HISTORY_FIELDS.map((field) => [field, merged[field] ?? null])),
        ...buildCanonicalWorkTermsSnapshotFields(merged, current),
        hmeres_ergasias_ebdomadas: merged.hmeres_ergasias_ebdomadas ?? 0,
        ores_ergasias_ebdomadas: merged.ores_ergasias_ebdomadas ?? 0,
        mo_oron_hmerhsias_ergasias: merged.mo_oron_hmerhsias_ergasias ?? 0,
        ...facts,
        afora_allagh_oron_ergasias: true,
        employment_profile_source: 'EMPLOYEE_PROFILE_FOUNDATION',
        hmeromhnia_isxyos_oron_ergasias_apo: from,
        hmeromhnia_isxyos_oron_ergasias_eos: null,
        // Every complete snapshot records break facts, including explicit zero.
        // This also anchors subsequent interval-only changes in the existing mechanism.
        afora_allagh_dialleimatos: true,
        hmeromhnia_isxyos_dialleimatos_apo: from
    };
}

function effectiveStart(row) {
    // An explicit empty start on a non-terms Maintenance record is not a
    // profile version. Keep schedule fallback for genuinely older records.
    const start = row.hmeromhnia_isxyos_oron_ergasias_apo;
    if (Object.hasOwn(row, 'hmeromhnia_isxyos_oron_ergasias_apo') &&
        (start == null || start === '') && row.afora_allagh_oron_ergasias === false) return null;
    return C.calendarDate(row.hmeromhnia_isxyos_oron_ergasias_apo || row.hmeromhnia_allaghs_orarioy_apo);
}
function effectiveEnd(row) {
    // Explicit null means open-ended; do not substitute schedule-generation end.
    return C.calendarDate(Object.prototype.hasOwnProperty.call(row, 'hmeromhnia_isxyos_oron_ergasias_eos')
        ? row.hmeromhnia_isxyos_oron_ergasias_eos : row.hmeromhnia_allaghs_orarioy_eos);
}

// Separate opt-in facts resolver: existing Employment Check formulas are not wired
// to arrangement semantics in Phase 1. Missing history never borrows today's facts.
function resolveEmploymentProfileFactsForDate(date, history = [], { scheduledWorkingDay = false, currentEmployee = {} } = {}) {
    const target = C.calendarDate(date);
    if (!target) C.invalid('date', 'required');
    let candidates = history.filter((row) => {
        const from = effectiveStart(row); const until = effectiveEnd(row);
        return from && from <= target && (!until || target <= until);
    });
    if (candidates.some(T.complete)) candidates = candidates.filter(T.complete);
    if (candidates.length > 1) C.invalid('history', 'overlapping profile versions');
    const row = candidates[0];
    const fallback = T.fallback(date, currentEmployee, history);
    const resolved = { ...fallback.facts, ...(row || {}) };
    // Arrangement provenance is historical V1 only; never use current/anchor arrangement fallback.
    for (const field of C.ARRANGEMENT_FIELDS) if (!T.complete(row)) delete resolved[field];
    const read = C.readEmploymentProfile(row || {});
    const facts = C.readEmploymentProfile(resolved).facts;
    for (const field of T.STANDARD_FIELDS) facts[field] = resolved[field] ?? null;
    const recorded = Boolean(row && read.recorded);
    if (!recorded) facts[C.SCHEMA_VERSION] = null;
    if (T.versioned(currentEmployee, history)) {
        const breaks = resolveBreakConfigurationForDate(date, history, currentEmployee);
        facts.dialleima_se_lepta = breaks.break_minutes;
        facts.dialleima_entos_ektos_orarioy = breaks.break_inside_schedule;
        for (const field of C.BREAK_PAIRS.flat()) facts[field] = breaks[field];
    }
    let active = false;
    if (recorded && facts[C.ENABLED] === true) {
        const from = C.calendarDate(facts[C.FROM]); const until = C.calendarDate(facts[C.UNTIL]);
        const weekday = target.getUTCDay() || 7;
        active = Boolean(from && target >= from && (!until || target <= until) && scheduledWorkingDay === true &&
            (facts[C.DAYS].length === 0 || facts[C.DAYS].includes(weekday)));
    }
    // Return only effective arrangement facts; retained source metadata distinguishes
    // expiration / non-working days from legacy information that was never recorded.
    if (!active) {
        const absent = C.readEmploymentProfile().facts;
        for (const field of C.ARRANGEMENT_FIELDS) facts[field] = absent[field];
    }
    return { facts, arrangementEffective: active, recorded,
        source: recorded ? 'COMPLETE_PROFILE_HISTORY' : row ? 'LEGACY_PROFILE_NOT_RECORDED' :
            fallback.source === 'LEGACY_EMPLOYEE_FALLBACK' ? 'LEGACY_PROFILE_NOT_RECORDED' : fallback.source,
        historyId: row?._id || null, unrecordedFields: read.unrecordedFields };
}
module.exports = { BASE_HISTORY_FIELDS, buildCompleteProfileSnapshot, resolveEmploymentProfileFactsForDate, effectiveStart, effectiveEnd };
