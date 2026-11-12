'use strict';

// Shared read-only availability rules. Never calculate hours or change stored evidence.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.EmploymentReviewNumbers = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function numberOrNull(value) {
        if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
        const parsed = Number(String(value).trim().replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : null;
    }

    function historyPending(row = {}) {
        return row.history_terms_unavailable === true ||
            row.compensation_breakdown_apologistika?.history_terms_unavailable === true;
    }

    function dailyNumber(row = {}, field) {
        if (row.is_locked !== true) {
            if (row.compensation_breakdown_apologistika?.unavailable_fields?.includes(field)) return null;
            // Additional work and overtime classifications require verified work
            // terms. Recorded work/absence/night/holiday measurements and approved
            // leave quantities remain usable, without certifying the whole result.
            if (historyPending(row) && /^ores_(prostheths_ergasias|yperergasias|nominhs_yperorias|paranomhs_yperorias)(_|$)/.test(field)) return null;
        }
        return numberOrNull(row[field]);
    }

    function sum(values) {
        const numbers = values.map(numberOrNull);
        return numbers.some(value => value === null) ? null : numbers.reduce((total, value) => total + value, 0);
    }

    return Object.freeze({ numberOrNull, historyPending, dailyNumber, sum });
});
