'use strict';

const C = require('./employmentProfileContract');

function dateOnlyUtc(value) {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function monthStartUtc(value) {
    const date = dateOnlyUtc(value);
    return date ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)) : null;
}

function normalizeBreakConfiguration(source = {}) {
    return {
        break_inside_schedule: source.dialleima_entos_ektos_orarioy === true,
        break_minutes: Math.max(Number.parseInt(source.dialleima_se_lepta || 0, 10) || 0, 0)
    };
}

// New profile changes use calendar-day validity. Legacy month-start rows still
// resolve exactly as before; no payroll duration formula changes here.
function buildBreakConfigurationHistoryChange({ formData = {}, currentEmployee = {} } = {}) {
    const facts = C.normalizeEmploymentProfileSubmission(formData, currentEmployee);
    const current = C.readEmploymentProfile(currentEmployee).facts;
    const changed = C.BREAK_FIELDS.some((field) => facts[field] !== current[field]);
    if (!changed) return Object.freeze({ changed: false });
    const effectiveFrom = C.calendarDate(formData.hmeromhnia_metabolhs, 'hmeromhnia_metabolhs');
    if (!effectiveFrom) C.invalid('hmeromhnia_metabolhs', 'required');
    return Object.freeze({ changed: true, effectiveFrom,
        snapshot: Object.freeze({
            afora_allagh_dialleimatos: true,
            hmeromhnia_isxyos_dialleimatos_apo: effectiveFrom,
            ...Object.fromEntries(C.BREAK_FIELDS.map((field) => [field, facts[field]]))
        }) });
}

function stableIdentity(row = {}) {
    return `${String(row.aa_eggrafhs || '').padStart(20, '0')}|${String(row._id || '')}`;
}

function resolveBreakConfigurationForDate(date, historyRows = [], employee = {}) {
    const targetDate = dateOnlyUtc(date);
    if (!targetDate) throw new TypeError('Invalid break configuration target date');
    const candidates = historyRows.filter((row) => {
        if (row?.afora_allagh_dialleimatos !== true) return false;
        const effective = dateOnlyUtc(row.hmeromhnia_isxyos_dialleimatos_apo);
        const isCompleteProfile = C.readEmploymentProfile(row).recorded;
        const end = isCompleteProfile ? dateOnlyUtc(row.hmeromhnia_isxyos_oron_ergasias_eos) : null;
        // Legacy rows retain the original month-start eligibility and do not
        // acquire complete-profile end-boundary semantics through schema defaults.
        return effective && (isCompleteProfile || effective.getUTCDate() === 1) &&
            effective <= targetDate && (!end || targetDate <= end);
    }).sort((left, right) => {
        const dateDiff = dateOnlyUtc(right.hmeromhnia_isxyos_dialleimatos_apo) -
            dateOnlyUtc(left.hmeromhnia_isxyos_dialleimatos_apo);
        return dateDiff || stableIdentity(right).localeCompare(stableIdentity(left));
    });
    if (candidates.length > 0) {
        const selected = candidates[0];
        return Object.freeze({ ...normalizeBreakConfiguration(selected),
            effective_from: dateOnlyUtc(selected.hmeromhnia_isxyos_dialleimatos_apo),
            source: 'BREAK_CONFIGURATION_HISTORY', history_id: selected._id || null });
    }
    return Object.freeze({ ...normalizeBreakConfiguration(employee), effective_from: null,
        source: 'LEGACY_EMPLOYEE_FALLBACK', history_id: null });
}

module.exports = { dateOnlyUtc, monthStartUtc,
    normalizeBreakConfiguration, buildBreakConfigurationHistoryChange,
    resolveBreakConfigurationForDate };
