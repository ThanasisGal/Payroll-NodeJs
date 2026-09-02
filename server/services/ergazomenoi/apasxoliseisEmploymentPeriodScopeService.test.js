const assert = require('assert');
const {
    buildPostDepartureExclusionDescriptors,
    isDateWithinEmploymentPeriod,
    isWeekFullyWithinEmploymentPeriod,
    restrictBoundaryContextToPeriodEmployees,
    deriveEmploymentOwnedDateScope,
    buildFullMonthBoundaryContextPreflight
} = require('./apasxoliseisEmploymentPeriodScopeService');

const periodRows = [
    { kodikos: '0031', ypokatasthma: '0000', hmeromhnia: '2026-04-01' },
    { kodikos: '0016', ypokatasthma: '0000', hmeromhnia: '2026-04-30' }
];
const scopedBoundaryRows = restrictBoundaryContextToPeriodEmployees(periodRows, [
    { kodikos: '0031', ypokatasthma: '0000', hmeromhnia: '2026-03-31' },
    { kodikos: '0031', ypokatasthma: '0000', hmeromhnia: '2026-05-01' },
    { kodikos: '0016', ypokatasthma: '0000', hmeromhnia: '2026-05-01' },
    { kodikos: '0017', ypokatasthma: '0000', hmeromhnia: '2026-05-01' },
    { kodikos: '0099', ypokatasthma: '0000', hmeromhnia: '2026-03-31' },
    { kodikos: '0031', ypokatasthma: '0001', hmeromhnia: '2026-04-01' }
]);
assert.deepStrictEqual(scopedBoundaryRows.map((row) =>
    `${row.ypokatasthma}|${row.kodikos}|${row.hmeromhnia}`), [
    '0000|0031|2026-03-31',
    '0000|0031|2026-05-01',
    '0000|0016|2026-05-01'
]);

const aprilPeriod = { period_start: '2026-04-01', period_end: '2026-04-30' };
const afterPeriodHire = deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-04-27', natural_week_end: '2026-05-03',
    ...aprilPeriod, hire_date: '2026-05-01'
});
assert.deepStrictEqual(afterPeriodHire.authoritative_date_set, []);
assert.deepStrictEqual(afterPeriodHire.context_only_dates,
    ['2026-05-01', '2026-05-02', '2026-05-03']);

const lastDayHire = deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-04-27', natural_week_end: '2026-05-03',
    ...aprilPeriod, hire_date: '2026-04-30'
});
assert.deepStrictEqual(lastDayHire.authoritative_date_set, ['2026-04-30']);
assert.deepStrictEqual(lastDayHire.context_only_dates,
    ['2026-05-01', '2026-05-02', '2026-05-03']);

const beforePeriodDeparture = deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-03-30', natural_week_end: '2026-04-05',
    ...aprilPeriod, departure_date: '2026-03-31'
});
assert.deepStrictEqual(beforePeriodDeparture.authoritative_date_set, []);
assert.deepStrictEqual(beforePeriodDeparture.context_only_dates, ['2026-03-30', '2026-03-31']);

const activeNextBoundary = deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-04-27', natural_week_end: '2026-05-03', ...aprilPeriod
});
assert.deepStrictEqual(activeNextBoundary.authoritative_date_set,
    ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30']);
assert.deepStrictEqual(activeNextBoundary.context_only_dates,
    ['2026-05-01', '2026-05-02', '2026-05-03']);

const activePreviousBoundary = deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-03-30', natural_week_end: '2026-04-05', ...aprilPeriod
});
assert.deepStrictEqual(activePreviousBoundary.authoritative_date_set,
    ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05']);
assert.deepStrictEqual(activePreviousBoundary.context_only_dates, ['2026-03-30', '2026-03-31']);

const ordinaryAprilWeek = deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-04-06', natural_week_end: '2026-04-12', ...aprilPeriod
});
assert.strictEqual(ordinaryAprilWeek.is_full_natural_week, true);
assert.strictEqual(ordinaryAprilWeek.context_only_dates.length, 0);

const departed = {
    kodikos: '0014',
    ypokatasthma: '0000',
    hmeromhnia_proslhpshs: '2025-01-01',
    hmeromhnia_apoxorhshs: '2026-06-02'
};

assert.strictEqual(isDateWithinEmploymentPeriod('2026-06-01', departed), true);
assert.strictEqual(isDateWithinEmploymentPeriod('2026-06-02', departed), true);
assert.strictEqual(isDateWithinEmploymentPeriod('2026-06-03', departed), false);

assert.strictEqual(isWeekFullyWithinEmploymentPeriod('2026-05-25', departed), true);
assert.strictEqual(isWeekFullyWithinEmploymentPeriod('2026-06-01', departed), false);

const descriptors = buildPostDepartureExclusionDescriptors([departed]);
assert.strictEqual(descriptors.length, 1);
assert.strictEqual(descriptors[0].kodikos, '0014');
assert.strictEqual(descriptors[0].ypokatasthma, '0000');
assert.strictEqual(descriptors[0].departureEnd.toISOString(), '2026-06-02T23:59:59.999Z');

assert.deepStrictEqual(
    buildPostDepartureExclusionDescriptors([
        departed,
        { ...departed, hmeromhnia_apoxorhshs: null }
    ]),
    []
);

assert.deepStrictEqual(deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-06-08', natural_week_end: '2026-06-14',
    hire_date: '2026-06-09'
}).authoritative_date_set, [
    '2026-06-09', '2026-06-10', '2026-06-11',
    '2026-06-12', '2026-06-13', '2026-06-14'
]);
assert.deepStrictEqual(deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-06-22', natural_week_end: '2026-06-28',
    hire_date: '2026-06-27'
}).authoritative_date_set, ['2026-06-27', '2026-06-28']);
assert.deepStrictEqual(deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-06-01', natural_week_end: '2026-06-07',
    departure_date: '2026-06-02'
}).authoritative_date_set, ['2026-06-01', '2026-06-02']);
assert.deepStrictEqual(deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-06-29', natural_week_end: '2026-07-05',
    period_start: '2026-06-01', period_end: '2026-06-30',
    hire_date: '2026-06-30', departure_date: '2026-07-02'
}), Object.freeze({
    natural_week_start: '2026-06-29', natural_week_end: '2026-07-05',
    period_start: '2026-06-01', period_end: '2026-06-30',
    employment_start: '2026-06-30', employment_end: '2026-07-02',
    employment_owned_dates: Object.freeze(['2026-06-30', '2026-07-01', '2026-07-02']),
    authoritative_date_set: Object.freeze(['2026-06-30']),
    context_only_dates: Object.freeze(['2026-07-01', '2026-07-02']),
    is_full_natural_week: false
}));

const julyLeading = deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-06-29', natural_week_end: '2026-07-05',
    period_start: '2026-07-01', period_end: '2026-07-31'
});
assert.deepStrictEqual(julyLeading.employment_owned_dates, [
    '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02',
    '2026-07-03', '2026-07-04', '2026-07-05'
]);
assert.deepStrictEqual(julyLeading.authoritative_date_set, [
    '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'
]);
assert.deepStrictEqual(julyLeading.context_only_dates, ['2026-06-29', '2026-06-30']);

const hiredJulySecond = deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-06-29', natural_week_end: '2026-07-05',
    period_start: '2026-07-01', period_end: '2026-07-31', hire_date: '2026-07-02'
});
assert.deepStrictEqual(hiredJulySecond.employment_owned_dates,
    ['2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']);
assert.deepStrictEqual(hiredJulySecond.context_only_dates, []);

const departedJuly = deriveEmploymentOwnedDateScope({
    natural_week_start: '2026-07-27', natural_week_end: '2026-08-02',
    period_start: '2026-07-01', period_end: '2026-07-31', departure_date: '2026-07-31'
});
assert.deepStrictEqual(departedJuly.authoritative_date_set,
    ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31']);
assert.deepStrictEqual(departedJuly.context_only_dates, []);

const julyPreflight = buildFullMonthBoundaryContextPreflight({
    period_start: '2026-07-01', period_end: '2026-07-31', employees: [
        { kodikos: '0001', hmeromhnia_proslhpshs: '2026-01-01' },
        { kodikos: '0002', hmeromhnia_proslhpshs: '2026-07-02' },
        { kodikos: '0003', hmeromhnia_proslhpshs: '2026-01-01',
            hmeromhnia_apoxorhshs: '2026-07-31' }
    ]
});
assert.strictEqual(julyPreflight.previous.status, 'NO_CARD_DATA_FOUND');
assert.deepStrictEqual(julyPreflight.previous.affected_employee_codes, ['0001', '0003']);
assert.strictEqual(julyPreflight.previous.excluded_employee_count, 1);
assert.strictEqual(julyPreflight.next.status, 'NO_CARD_DATA_FOUND');
assert.deepStrictEqual(julyPreflight.next.affected_employee_codes, ['0001', '0002']);
assert.strictEqual(julyPreflight.next.excluded_employee_count, 1);
const noBoundaryEmployment = buildFullMonthBoundaryContextPreflight({
    period_start: '2026-07-01', period_end: '2026-07-31', employees: [{
        kodikos: '0010', hmeromhnia_proslhpshs: '2026-07-02',
        hmeromhnia_apoxorhshs: '2026-07-31'
    }]
});
assert.strictEqual(noBoundaryEmployment.previous.status, 'NOT_REQUIRED');
assert.strictEqual(noBoundaryEmployment.previous.excluded_employee_count, 1);
assert.strictEqual(noBoundaryEmployment.next.status, 'NOT_REQUIRED');
assert.strictEqual(noBoundaryEmployment.next.excluded_employee_count, 1);

const cardEvidenceEmployees = [
    { kodikos: '0101', ypokatasthma: '0001', hmeromhnia_proslhpshs: '2026-01-01' },
    { kodikos: '0102', ypokatasthma: '0001', hmeromhnia_proslhpshs: '2026-01-01' },
    { kodikos: '0103', ypokatasthma: '0001', hmeromhnia_proslhpshs: '2026-01-01' },
    { kodikos: '0104', ypokatasthma: '0001', hmeromhnia_proslhpshs: '2026-01-01' },
    { kodikos: '0105', ypokatasthma: '0001', hmeromhnia_proslhpshs: '2026-01-01' }
];
const cardEvidencePreflight = buildFullMonthBoundaryContextPreflight({
    period_start: '2026-07-01', period_end: '2026-07-31',
    employees: cardEvidenceEmployees,
    previous_rows: [
        { kodikos: '0101', ypokatasthma: '0001', hmeromhnia: '2026-06-29',
            cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00' },
        { kodikos: '0102', ypokatasthma: '0001', hmeromhnia: '2026-06-29',
            cards_apo_ora_01: '08:00' },
        { kodikos: '0103', ypokatasthma: '0001', hmeromhnia: '2026-06-30',
            cards_eos_ora_01: '16:00' },
        { kodikos: '0104', ypokatasthma: '0001', hmeromhnia: '2026-06-30',
            cards_ores_ergasias: 8 },
        { kodikos: '0105', ypokatasthma: '0001', hmeromhnia: '2026-06-30' }
    ],
    next_rows: []
});
assert.strictEqual(cardEvidencePreflight.previous.status, 'CARD_DATA_FOUND');
assert.strictEqual(cardEvidencePreflight.previous.employees_with_card_evidence, 4);
assert.strictEqual(cardEvidencePreflight.previous.employees_without_card_evidence, 1);
assert.strictEqual(cardEvidencePreflight.previous.complete_card_pairs, 1);
assert.strictEqual(cardEvidencePreflight.previous.orphan_unresolved_card_evidence, 3);
assert.strictEqual(cardEvidencePreflight.next.status, 'NO_CARD_DATA_FOUND');
assert.strictEqual(cardEvidencePreflight.next.employees_with_card_evidence, 0);
assert.strictEqual(cardEvidencePreflight.next.employees_without_card_evidence, 5);

const completeCardRow = (kodikos, hmeromhnia) => ({
    kodikos, ypokatasthma: '0001', hmeromhnia,
    cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00'
});
const leadingHirePreflight = buildFullMonthBoundaryContextPreflight({
    period_start: '2026-01-01', period_end: '2026-01-31', employees: [{
        kodikos: '0201', ypokatasthma: '0001', hmeromhnia_proslhpshs: '2025-12-30'
    }], previous_rows: [
        completeCardRow('0201', '2025-12-29'),
        completeCardRow('0201', '2025-12-30')
    ]
});
assert.strictEqual(leadingHirePreflight.previous.complete_card_pairs, 1);
assert.strictEqual(leadingHirePreflight.previous.employees_with_card_evidence, 1);

const trailingDeparturePreflight = buildFullMonthBoundaryContextPreflight({
    period_start: '2025-12-01', period_end: '2025-12-31', employees: [{
        kodikos: '0202', ypokatasthma: '0001', hmeromhnia_proslhpshs: '2025-01-01',
        hmeromhnia_apoxorhshs: '2026-01-02'
    }], next_rows: [
        completeCardRow('0202', '2026-01-02'),
        completeCardRow('0202', '2026-01-03')
    ]
});
assert.strictEqual(trailingDeparturePreflight.next.complete_card_pairs, 1);
assert.strictEqual(trailingDeparturePreflight.next.employees_with_card_evidence, 1);

const openEndedPreflight = buildFullMonthBoundaryContextPreflight({
    period_start: '2026-01-01', period_end: '2026-01-31', employees: [{
        kodikos: '0203', ypokatasthma: '0001', hmeromhnia_proslhpshs: '2025-01-01'
    }], previous_rows: [completeCardRow('0203', '2025-12-29')]
});
assert.strictEqual(openEndedPreflight.previous.complete_card_pairs, 1);
assert.strictEqual(openEndedPreflight.previous.employees_with_card_evidence, 1);

const rehirePreflight = buildFullMonthBoundaryContextPreflight({
    period_start: '2026-01-01', period_end: '2026-01-31', employees: [{
        kodikos: '0204', ypokatasthma: '0001', hmeromhnia_proslhpshs: '2025-12-31'
    }, {
        kodikos: '0204', ypokatasthma: '0001', hmeromhnia_proslhpshs: '2025-12-29',
        hmeromhnia_apoxorhshs: '2025-12-29'
    }], previous_rows: [
        completeCardRow('0204', '2025-12-29'),
        completeCardRow('0204', '2025-12-30'),
        completeCardRow('0204', '2025-12-31')
    ]
});
assert.strictEqual(rehirePreflight.previous.affected_employee_count, 1);
assert.strictEqual(rehirePreflight.previous.complete_card_pairs, 1);
assert.strictEqual(rehirePreflight.previous.employees_with_card_evidence, 1);
assert.strictEqual(buildFullMonthBoundaryContextPreflight({
    period_start: '2026-07-02', period_end: '2026-07-31', employees: []
}), null);

console.log('PASS employment-period scope');
