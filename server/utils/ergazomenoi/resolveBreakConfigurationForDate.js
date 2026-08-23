'use strict';

function dateOnlyUtc(value) {
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

function assertMonthStart(value) {
    const date = dateOnlyUtc(value);
    if (!date || date.getUTCDate() !== 1) {
        const error = new Error('Η αλλαγή διαλείμματος πρέπει να ισχύει από την πρώτη ημέρα μήνα.');
        error.code = 'BREAK_CONFIGURATION_EFFECTIVE_DATE_MUST_BE_MONTH_START';
        error.statusCode = 400;
        throw error;
    }
    return date;
}

function buildBreakConfigurationHistoryChange({ formData = {}, currentEmployee = {} } = {}) {
    const next = normalizeBreakConfiguration(formData);
    const current = normalizeBreakConfiguration(currentEmployee);
    const changed = next.break_inside_schedule !== current.break_inside_schedule ||
        next.break_minutes !== current.break_minutes;
    if (!changed) return Object.freeze({ changed: false });
    const effectiveFrom = assertMonthStart(formData.hmeromhnia_metabolhs);
    return Object.freeze({ changed: true, effectiveFrom,
        snapshot: Object.freeze({
            afora_allagh_dialleimatos: true,
            hmeromhnia_isxyos_dialleimatos_apo: effectiveFrom,
            dialleima_entos_ektos_orarioy: next.break_inside_schedule,
            dialleima_se_lepta: next.break_minutes
        }) });
}

function stableIdentity(row = {}) {
    return `${String(row.aa_eggrafhs || '').padStart(20, '0')}|${String(row._id || '')}`;
}

function resolveBreakConfigurationForDate(date, historyRows = [], employee = {}) {
    const targetMonth = monthStartUtc(date);
    if (!targetMonth) throw new TypeError('Invalid break configuration target date');
    const candidates = historyRows.filter((row) => {
        if (row?.afora_allagh_dialleimatos !== true) return false;
        const effective = dateOnlyUtc(row.hmeromhnia_isxyos_dialleimatos_apo);
        return effective && effective.getUTCDate() === 1 && effective <= targetMonth;
    }).sort((left, right) => {
        const dateDiff = dateOnlyUtc(right.hmeromhnia_isxyos_dialleimatos_apo) -
            dateOnlyUtc(left.hmeromhnia_isxyos_dialleimatos_apo);
        return dateDiff || stableIdentity(right).localeCompare(stableIdentity(left));
    });
    if (candidates.length > 0) {
        const selected = candidates[0];
        return Object.freeze({ ...normalizeBreakConfiguration(selected),
            effective_from: monthStartUtc(selected.hmeromhnia_isxyos_dialleimatos_apo),
            source: 'BREAK_CONFIGURATION_HISTORY', history_id: selected._id || null });
    }
    return Object.freeze({ ...normalizeBreakConfiguration(employee), effective_from: null,
        source: 'LEGACY_EMPLOYEE_FALLBACK', history_id: null });
}

module.exports = { dateOnlyUtc, monthStartUtc, assertMonthStart,
    normalizeBreakConfiguration, buildBreakConfigurationHistoryChange,
    resolveBreakConfigurationForDate };
