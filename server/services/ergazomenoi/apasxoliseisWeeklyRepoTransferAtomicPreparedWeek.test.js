'use strict';
const assert = require('node:assert/strict');
const { buildWeeklyRepoTransferAtomicInputs,
    buildWeeklyRepoTransferAtomicInputForPreparedWeek, INPUT_REASON } = require(
    './apasxoliseisWeeklyRepoTransferAtomicPageProjectionService');

const rows = Array.from({ length: 7 }, (_, index) => ({
    _id: `r${index}`, team: 'T', company_kod: 'C', ypokatasthma: '0000',
    kodikos: '001', hmeromhnia: new Date(Date.UTC(2026, 3, 27 + index))
}));
const profile = { hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40 };
const resolveEmploymentProfile = () => profile;
const wrapper = buildWeeklyRepoTransferAtomicInputs({ rows,
    periodStart: '2026-04-27', periodEnd: '2026-05-03',
    resolveEmploymentProfile });
const bucket = { team: 'T', companyKod: 'C', ypokatasthma: '0000',
    employeeKodikos: '001', weekStart: '2026-04-27', weekEnd: '2026-05-03',
    rows: rows.map((row) => ({ row, dateKey: row.hmeromhnia.toISOString().slice(0, 10) })) };
const direct = buildWeeklyRepoTransferAtomicInputForPreparedWeek({ bucket,
    periodEndKey: '2026-05-03', resolveEmploymentProfile });
assert.deepStrictEqual(direct.weeklyInput, wrapper.weeklyInputs[0]);
const incomplete = buildWeeklyRepoTransferAtomicInputForPreparedWeek({
    bucket: { ...bucket, rows: bucket.rows.slice(0, 6) },
    periodEndKey: '2026-05-03', resolveEmploymentProfile });
assert.equal(incomplete.reason, INPUT_REASON.INCOMPLETE_WEEK);
assert.equal(incomplete.diagnostic.reason, INPUT_REASON.INCOMPLETE_WEEK);
console.log('atomic prepared-week characterization tests passed');
