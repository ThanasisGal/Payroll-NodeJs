'use strict';

function clampDateStartUtc(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCHours(0, 0, 0, 0);
    return date;
}
function clampDateEndUtc(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCHours(23, 59, 59, 999);
    return date;
}
function endOfWeekSundayUtc(value) {
    const date = clampDateEndUtc(value);
    if (!date) return null;
    const offset = (7 - date.getUTCDay()) % 7;
    date.setUTCDate(date.getUTCDate() + offset);
    return date;
}
function buildPreparedPhaseHistoryMaps({ historyByEmployee, employeeByCode,
    periodStart, periodEnd }) {
    const contractStatusHistoryByEmployee = new Map();
    const workingTermsHistoryByEmployee = new Map();
    const start = clampDateStartUtc(periodStart);
    const end = endOfWeekSundayUtc(periodEnd);
    for (const [code, historyRows] of historyByEmployee || []) {
        const employeeAa = String(employeeByCode.get(code)?.aa_eggrafhs || '').trim();
        contractStatusHistoryByEmployee.set(code, historyRows.filter((row) => {
            const changed = row.hmeromhnia_allaghs_symbashs
                ? clampDateStartUtc(row.hmeromhnia_allaghs_symbashs) : null;
            return changed && changed <= end;
        }));
        workingTermsHistoryByEmployee.set(code, historyRows.filter((row) => {
            if (row.afora_allagh_oron_ergasias !== true) return false;
            if (employeeAa && String(row.aa_eggrafhs || '').trim() !== employeeAa) return false;
            const from = clampDateStartUtc(row.hmeromhnia_isxyos_oron_ergasias_apo ||
                row.hmeromhnia_allaghs_orarioy_apo);
            const to = row.hmeromhnia_isxyos_oron_ergasias_eos ||
                row.hmeromhnia_allaghs_orarioy_eos;
            return Boolean(from && from <= end && (!to || clampDateEndUtc(to) >= start));
        }));
    }
    return { contractStatusHistoryByEmployee, workingTermsHistoryByEmployee };
}
module.exports = { buildPreparedPhaseHistoryMaps };
