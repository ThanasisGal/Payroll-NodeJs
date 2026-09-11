'use strict';
const assert = require('assert');
const { loadAuthoritativeWeekContext } = require('./deferredCrossPeriodRepoAuthoritativeService');
function query(value) { return { select() { return this; }, sort() { return this; }, lean: async () => value }; }
const deferredWeek = { team: 'T', company_kod: 'C', ypokatasthma: '0001', employee_id: '507f1f77bcf86cd799439011',
    week_start: '2026-04-27', week_end: '2026-05-03', source_period_start: '2026-04-01', source_period_end: '2026-04-30' };
const rows = Array.from({ length: 7 }, (_, i) => { const date = new Date('2026-04-27T00:00:00Z'); date.setUTCDate(date.getUTCDate() + i);
    return { _id: `r${i}`, team: 'T', company_kod: 'C', ypokatasthma: '0001', kodikos: 'OLD', hmeromhnia: date }; });
const workflow = { employee_id: deferredWeek.employee_id, employee_kodikos: 'OLD', week_start: deferredWeek.week_start, week_end: deferredWeek.week_end };
const frozenEmployee = { kodikos: 'OLD', typos_apasxolhshs: '0', hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40 };
(async () => {
    const models = { workflowModel: { findOne: () => query(workflow) },
        frozenModel: { findOne: () => query({ frozen_snapshot_fingerprint: 'f', frozen_snapshot: { employees: [frozenEmployee] } }) },
        employeeModel: { findOne: () => query(null) }, rowModel: { find: () => query(rows) }, historyModel: { find: () => query([]) },
        borrowedContexts: new Map(), holidayProvider: { resolveForEmployeeDate: () => ({ blocked: false,
            holidayContext: { argiesByDateKey: new Map() } }) } };
    const removed = await loadAuthoritativeWeekContext({ deferredWeek, models });
    assert.equal(removed.employee.kodikos, 'OLD'); assert.equal(removed.employee.typos_apasxolhshs, '0');
    models.employeeModel.findOne = () => query({ _id: deferredWeek.employee_id, kodikos: 'NEW', typos_apasxolhshs: '1', hmeres_ergasias_ebdomadas: 6 });
    const changed = await loadAuthoritativeWeekContext({ deferredWeek, models });
    assert.equal(changed.employee.kodikos, 'OLD'); assert.equal(changed.employee.typos_apasxolhshs, '0');
    assert.ok(changed.rows.every((row) => row.employee_kodikos === 'OLD'));
    models.workflowModel.findOne = () => query(null);
    models.frozenModel.findOne = () => query({ frozen_snapshot_fingerprint: 'f', frozen_snapshot: {
        employees: [frozenEmployee], daily_results: [{ effective_profile_employee_id: deferredWeek.employee_id,
            kodikos: 'OLD', hmeromhnia: '2026-04-30' }] } });
    const legacy = await loadAuthoritativeWeekContext({ deferredWeek, models });
    assert.equal(legacy.workflow.employee_kodikos, 'OLD');
    assert.ok(legacy.rows.every((row) => row.employee_kodikos === 'OLD'));
    console.log('deferred cross-period frozen identity/history context tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
