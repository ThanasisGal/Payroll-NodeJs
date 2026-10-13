'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ownsEmploymentReviewDate: owns } = require('./employmentReviewLoanOwnershipService');
const { overlapsPeriod } = require('../../controllers/ergazomenoi/employmentReviewEmployeesController');
const { deriveEmploymentOwnedDateScope, assertEmploymentReviewDateOwned } = require('./apasxoliseisEmploymentPeriodScopeService');
const lender = { hmeromhnia_proslhpshs: '2017-05-24', afora_daneismo_ergazomenoy: true,
    typos_ergodoth_daneismoy: false, hmnia_enarxhs_daneismoy: '2026-01-01', hmnia_lhxhs_daneismoy: '2027-12-31' };
const borrower = { ...lender, typos_ergodoth_daneismoy: true };
const period = (startIso, endIso) => ({ startIso, endIso });
test('full loan interval is absent from lender selection and all weekly owned dates', () => {
    assert.equal(overlapsPeriod(lender, [], period('2026-09-01', '2026-09-30')), false);
    assert.equal(overlapsPeriod(borrower, [], period('2026-09-01', '2026-09-30')), true);
    const scope = deriveEmploymentOwnedDateScope({ natural_week_start: '2026-09-07',
        natural_week_end: '2026-09-13', employee: lender });
    assert.deepEqual(scope.employment_owned_dates, []);
    assert.deepEqual(scope.authoritative_date_set, []);
});
test('partial loan splits employers inclusively and does not backdate current lending flag', () => {
    const local = { ...lender, hmnia_enarxhs_daneismoy: '2026-09-10', hmnia_lhxhs_daneismoy: '2026-09-12' };
    const remote = { ...local, typos_ergodoth_daneismoy: true };
    for (const employee of [local, remote]) assert.equal(overlapsPeriod(employee, [],
        period('2026-09-07', '2026-09-13')), true);
    const scope = employee => deriveEmploymentOwnedDateScope({ natural_week_start: '2026-09-07',
        natural_week_end: '2026-09-13', employee });
    assert.deepEqual(scope(local).authoritative_date_set, ['2026-09-07','2026-09-08','2026-09-09','2026-09-13']);
    assert.deepEqual(scope(remote).authoritative_date_set, ['2026-09-10','2026-09-11','2026-09-12']);
    assert.equal(owns('2025-12-31', lender), true);
    assert.equal(owns('2025-12-31', borrower), false);
    assert.equal(owns('2028-01-01', lender), true);
});
test('daily authorization rejects lender writes during loan and borrower writes outside it', () => {
    assert.throws(() => assertEmploymentReviewDateOwned('2026-09-02', [lender]),
        { code: 'EMPLOYMENT_REVIEW_DATE_OUTSIDE_EMPLOYMENT' });
    assert.doesNotThrow(() => assertEmploymentReviewDateOwned('2026-09-02', [borrower]));
    assert.throws(() => assertEmploymentReviewDateOwned('2025-12-31', [borrower]));
    for (const changes of [{ hmnia_enarxhs_daneismoy: null },
        { hmnia_lhxhs_daneismoy: 'invalid' }, { hmnia_lhxhs_daneismoy: '2025-01-01' },
        { typos_ergodoth_daneismoy: null }]) assert.equal(owns('2026-09-02', { ...lender, ...changes }), false);
});
