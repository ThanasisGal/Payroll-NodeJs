'use strict';

const { dateKeyUtc, startOfWeekMondayUtc, endOfWeekSundayUtc } = require(
    '../../utils/date/mondaySundayWeek');

function text(value) { return String(value ?? '').trim(); }

function buildWeeklyHrStage2BulkContextScope({ key, lifecycle = {}, weekRows = [],
    preparedEmployee = null } = {}) {
    const [keyEmployeeKodikos = '', keyWeekStart = ''] = String(key || '').split('|');
    const firstRow = Array.isArray(weekRows) ? weekRows[0] || {} : {};
    const deferred = lifecycle?.deferred_week || {};
    const employeeId = firstRow.employee_id || preparedEmployee?._id || deferred.employee_id || '';
    const employeeKodikos = text(firstRow.kodikos || preparedEmployee?.kodikos ||
        keyEmployeeKodikos);
    const weekStart = firstRow.hmeromhnia
        ? dateKeyUtc(startOfWeekMondayUtc(firstRow.hmeromhnia))
        : dateKeyUtc(keyWeekStart || deferred.week_start);
    const weekEnd = weekStart
        ? dateKeyUtc(endOfWeekSundayUtc(new Date(`${weekStart}T00:00:00.000Z`)))
        : dateKeyUtc(deferred.week_end);
    const branch = text(firstRow.ypokatasthma || preparedEmployee?.ypokatasthma ||
        deferred.ypokatasthma);
    return { team: text(firstRow.team || preparedEmployee?.team || deferred.team),
        company_kod: text(firstRow.company_kod || preparedEmployee?.company_kod ||
            deferred.company_kod),
        ypokatasthma: branch ? branch.padStart(4, '0') : '',
        employee_id: text(employeeId), employee_kodikos: employeeKodikos,
        week_start: weekStart, week_end: weekEnd,
        ...(lifecycle?.deferred_week ? {
            period_start: dateKeyUtc(deferred.period_start),
            period_end: dateKeyUtc(deferred.period_end)
        } : {}) };
}

module.exports = { buildWeeklyHrStage2BulkContextScope };
