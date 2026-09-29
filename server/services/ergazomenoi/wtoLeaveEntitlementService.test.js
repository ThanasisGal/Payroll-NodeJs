'use strict';

const assert = require('assert');
const {
    calculateAnnualLeaveEntitlement, halfUp, type2Round
} = require('./wtoLeaveEntitlementService');

function calc(overrides = {}) {
    return calculateAnnualLeaveEntitlement({ hireDate: '2026-01-01', referenceDate: '2026-12-31',
        weeklyDays: 5, employmentType: '0', previousLeaveServiceYears: 0,
        actualWorkRows: [], ...overrides });
}
assert.equal(halfUp(3.4), 3); assert.equal(halfUp(3.5), 4); assert.equal(halfUp(15.75), 16);
assert.equal(type2Round(3.4), 3); assert.equal(type2Round(3.5), 3); assert.equal(type2Round(3.6), 4);

const partial = calc({ hireDate: '2026-07-01', referenceDate: '2026-08-15' });
assert.ok(Math.abs(partial.segments[0].month_equivalent - (1 + 15 / 31)) < 1e-12);
assert.equal(partial.annualBasisDays, 20);
assert.equal(partial.calendarEmploymentYear, 1);
const partialSix = calc({ hireDate: '2026-07-01', referenceDate: '2026-08-15', weeklyDays: 6 });
assert.equal(partialSix.annualBasisDays, 24);

const crossing = calc({ hireDate: '2025-07-01', referenceDate: '2026-08-15' });
assert.deepStrictEqual(crossing.segments.map((segment) => segment.annual_basis_days), [20, 21]);
assert.equal(crossing.completedServiceMonths, 13);

assert.equal(calc({ hireDate: '2024-12-01', referenceDate: '2026-01-15' }).annualBasisDays, 21);
assert.equal(calc({ hireDate: '2024-12-01', referenceDate: '2026-12-01' }).annualBasisDays, 22);
const type0 = calc({ hireDate: '2025-07-01', referenceDate: '2026-08-15', employmentType: '0' });
const type1 = calc({ hireDate: '2025-07-01', referenceDate: '2026-08-15', employmentType: '1' });
assert.equal(type1.entitledDaysRaw, type0.entitledDaysRaw, 'type 1 έχει τις ίδιες ημέρες με type 0');
assert.equal(type1.entitledDaysRounded, halfUp(type1.entitledDaysRaw),
    'η στρογγυλοποίηση γίνεται μία φορά στο τελικό άθροισμα');

assert.equal(calc({ hireDate: '2016-08-10', referenceDate: '2026-08-10' }).annualBasisDays, 25);
assert.equal(calc({ hireDate: '2026-01-01', referenceDate: '2026-12-31',
    previousLeaveServiceYears: 12 }).annualBasisDays, 25);
assert.equal(calc({ hireDate: '2001-08-10', referenceDate: '2026-08-10' }).annualBasisDays, 26);
assert.equal(calc({ hireDate: '2026-01-01', referenceDate: '2026-12-31', weeklyDays: 6,
    previousLeaveServiceYears: 12 }).annualBasisDays, 30);
assert.equal(calc({ hireDate: '2026-01-01', referenceDate: '2026-12-31', weeklyDays: 6,
    previousLeaveServiceYears: 25 }).annualBasisDays, 31);

const workRows = Array.from({ length: 25 }, (_, index) => ({
    hmeromhnia: new Date(Date.UTC(2026, 0, index + 1)),
    kathgoria_ergasias_apologistika: 'ΕΡΓ', cards_ores_ergasias: 8,
    cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00',
    ores_ergasias: 8, ores_ergasias_apologistika: 8
}));
const rotational = calc({ hireDate: '2025-01-01', referenceDate: '2026-01-25',
    employmentType: '2', actualWorkRows: workRows });
assert.equal(rotational.segments[0].actual_employment_days, 25);
assert.equal(rotational.segments[0].month_equivalent, 1);
assert.ok(Math.abs(rotational.entitledDaysRaw - 21 / 12) < 1e-12);
assert.equal(rotational.segments[0].from, '2026-01-01', 'έναρξη max(1/1, πρόσληψη)');
assert.ok(rotational.segments[0].actual_work_dates.includes('2026-01-25'), 'referenceDate inclusive');

const anniversaryRows = [
    { hmeromhnia: new Date('2026-06-30T00:00:00Z'), kathgoria_ergasias_apologistika: 'ΕΡΓ',
        cards_ores_ergasias: 8, cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00',
        ores_ergasias: 8, ores_ergasias_apologistika: 8 },
    { hmeromhnia: new Date('2026-07-01T00:00:00Z'), kathgoria_ergasias_apologistika: 'ΕΡΓ',
        cards_ores_ergasias: 8, cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00',
        ores_ergasias: 8, ores_ergasias_apologistika: 8 }
];
const segmented = calc({ hireDate: '2025-07-01', referenceDate: '2026-07-01',
    employmentType: '2', actualWorkRows: anniversaryRows });
assert.deepStrictEqual(segmented.segments.map((segment) => segment.annual_basis_days), [20, 21]);
assert.deepStrictEqual(segmented.segments.map((segment) => segment.actual_employment_days), [1, 1]);

console.log('PASS WTOLeave annual leave entitlement type 0/1/2, partial months and overrides');
