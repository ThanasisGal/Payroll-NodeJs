'use strict';
const assert = require('node:assert/strict');
const { assessDeferredCrossPeriodRequirementsBulk, assessAnalysis } = require(
    './deferredCrossPeriodRepoAuthoritativeService');
const { analyzeDeferredCrossPeriodRepoTransfer } = require(
    './apasxoliseisWeeklyRepoTransferSinglePairService');

const employeeId = '507f1f77bcf86cd799439011';
const deferredWeekId = JSON.stringify(['T', 'C', '0001', employeeId,
    '2026-04-27', '2026-05-03', '2026-04-01', '2026-04-30']);
const rows = Array.from({ length: 7 }, (_, index) => {
    const date = new Date('2026-04-27T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + index);
    return { _id: `r${index}`, hmeromhnia: date, ypokatasthma: '0001',
        kodikos: '001', effective_profile_employee_id: employeeId,
        effective_weekly_workdays: 5, effective_weekly_hours: 40,
        effective_daily_hours: 8, effective_kathestos_apasxolhshs: '0',
        kathgoria_ergasias: index < 5 ? 'ΕΡΓ' : 'ΜΕ',
        ores_ergasias: index < 5 ? 8 : 0,
        cards_ores_ergasias: index < 5 ? 8 : 0 };
});

const common = { deferredWeekIds: [deferredWeekId],
    session: { userTeam: 'T', companyInUse: 'C' }, preparedRows: rows };
const first = assessDeferredCrossPeriodRequirementsBulk(common);
const second = assessDeferredCrossPeriodRequirementsBulk(common);
assert.deepStrictEqual(second, first);
assert.equal(first.length, 1);
assert.equal(first[0].deferredWeek.deferred_week_id, deferredWeekId);
assert.equal(first[0].analysis.weekRows, undefined);

function comparePreparedCase(name, caseRows, submitted = false) {
    const singleAnalysis = analyzeDeferredCrossPeriodRepoTransfer({ weekRows: caseRows,
        employmentProfile: { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
            mo_oron_hmerhsias_ergasias: 8, typos_apasxolhshs: '0' },
        holidayByDateKey: new Map(caseRows.filter(row => row.holiday_is_mandatory).map(row => [
            new Date(row.hmeromhnia).toISOString().slice(0, 10), {
                isMandatoryHoliday: true, companyOperatesOnHoliday: false }])) });
    const single = assessAnalysis(singleAnalysis);
    if (submitted && single.requirement_status === 'REQUIRED') {
        single.requirement_status = 'ERGANI_CORRECTION_REQUIRED';
    }
    const bulk = assessDeferredCrossPeriodRequirementsBulk({ ...common, preparedRows: caseRows,
        submittedSourcePeriods: submitted ? new Set(['2026-04-01|2026-04-30']) : new Set() })[0];
    const business = value => ({ requirement_status: value.requirement_status,
        source_candidates: value.source_candidates, target_candidates: value.target_candidates,
        reasons: value.reasons });
    assert.deepStrictEqual(business(bulk), business(single), name);
}
comparePreparedCase('NOT_REQUIRED', rows);
const requiredRows = rows.map(row => ({ ...row }));
Object.assign(requiredRows[1], { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0,
    cards_ores_ergasias: 8, cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00' });
Object.assign(requiredRows[4], { kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '' });
comparePreparedCase('REQUIRED', requiredRows);
comparePreparedCase('ERGANI_CORRECTION_REQUIRED', requiredRows, true);
const holidayRows = requiredRows.map(row => ({ ...row }));
Object.assign(holidayRows[4], { holiday_is_mandatory: true,
    holiday_company_operates: false });
comparePreparedCase('holiday context', holidayRows);
const workedTargetRows = requiredRows.map(row => ({ ...row }));
Object.assign(workedTargetRows[4], { cards_ores_ergasias: 8,
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00' });
comparePreparedCase('worked target', workedTargetRows);
const ambiguousRows = requiredRows.map(row => ({ ...row }));
Object.assign(ambiguousRows[4], { cards_ores_ergasias: 0,
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '' });
comparePreparedCase('ambiguous card evidence', ambiguousRows);
assert.throws(() => assessDeferredCrossPeriodRequirementsBulk({ ...common,
    preparedRows: rows.slice(0, 6) }), { code: 'DEFERRED_RESOLUTION_FULL_WEEK_REQUIRED' });
assert.throws(() => assessDeferredCrossPeriodRequirementsBulk({ ...common,
    deferredWeekIds: [JSON.stringify(['WRONG', 'C', '0001', employeeId,
        '2026-04-27', '2026-05-03', '2026-04-01', '2026-04-30'])] }),
{ code: 'DEFERRED_RESOLUTION_EMPLOYEE_SCOPE_MISMATCH' });
console.log('deferred cross-period prepared bulk assessment: PASS');
