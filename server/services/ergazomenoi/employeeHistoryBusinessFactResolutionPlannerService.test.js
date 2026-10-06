'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { CANONICAL_STATUSES } =
    require('./employeeHistoryCanonicalizationService');
const { REDUNDANT_REFERENCED } =
    require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { RESOLUTION_CLASSES, REFERENCE_CLASSES } =
    require('./employeeHistoryResolutionAnalysisService');
const { PLAN_STATUSES, SHAPE_KINDS, ANSWERS,
    planEmployeeHistoryBusinessFactResolution,
    resolveEmployeeHistoryBusinessFacts } =
    require('./employeeHistoryBusinessFactResolutionPlannerService');
const { IDS, provenance, competingDepartureDatesFixture,
    departureAndHistoricalPayFactFixture } =
    require('./fixtures/businessFactEmployeeHistoryResolutionFixtures');

function plan(fixture) {
    return planEmployeeHistoryBusinessFactResolution(fixture);
}

function resolve(fixture, answers) {
    const plannerResult = plan(fixture);
    return resolveEmployeeHistoryBusinessFacts({ plannerResult, answers,
        currentEmployee: fixture.currentEmployee,
        completeHistoryRows: fixture.completeHistoryRows });
}

function assertClean(result) {
    assert.equal(result.hypotheticalCanonicalResult.status, CANONICAL_STATUSES.CLEAN);
    assert.equal(result.hypotheticalCanonicalResult.cleanupRequired, false);
    assert.equal(result.hypotheticalCanonicalResult.idempotent, true);
    assert.equal(result.secondCanonicalResult.status, CANONICAL_STATUSES.CLEAN);
    assert.deepEqual(result.secondCanonicalResult.canonicalRows,
        result.hypotheticalCanonicalResult.canonicalRows);
}

test('αναγνωρίζει γενικά και με σταθερή σειρά τις τέσσερις παραλλαγές ανταγωνιστικών αποχωρήσεων', () => {
    const variants = [
        ['2026-04-29', '2026-08-19', '2026-08-20', true],
        ['2026-04-23', '2026-07-04', '2026-07-05', false],
        ['2026-05-02', '2026-06-25', '2026-06-28', true],
        ['2026-06-22', '2026-07-27', '2026-07-31', true]
    ];
    for (const [hire, firstDeparture, secondDeparture, includeOpenProfile] of variants) {
        const result = plan(competingDepartureDatesFixture({ hire, firstDeparture,
            secondDeparture, includeOpenProfile, name: `variant-${hire}` }));
        assert.equal(result.status, PLAN_STATUSES.APPLICABLE);
        assert.equal(result.resolutionClass, RESOLUTION_CLASSES.BUSINESS_FACT_REQUIRED);
        assert.equal(result.resolutionKind, 'BUSINESS_FACT_COLLECTION');
        assert.equal(result.shapeKind, SHAPE_KINDS.COMPETING_DEPARTURE_DATES);
        assert.deepEqual(result.factQuestions.map(question => question.id),
            ['departureOutcome', 'departureDate']);
        assert.deepEqual(result.factQuestions[0].options.map(option => option.id), [
            ANSWERS.DEPARTED_ON_FIRST_RECORDED_DATE,
            ANSWERS.DEPARTED_ON_SECOND_RECORDED_DATE,
            ANSWERS.DEPARTED_ON_OTHER_DATE,
            ANSWERS.NO_DEPARTURE
        ]);
    }
});

test('κάθε απάντηση γνωστής, άλλης ή ανύπαρκτης αποχώρησης προσομοιώνεται CLEAN', () => {
    const fixture = competingDepartureDatesFixture();
    for (const answers of [
        { departureOutcome: ANSWERS.DEPARTED_ON_FIRST_RECORDED_DATE },
        { departureOutcome: ANSWERS.DEPARTED_ON_SECOND_RECORDED_DATE },
        { departureOutcome: ANSWERS.DEPARTED_ON_OTHER_DATE,
            departureDate: '2026-08-15' },
        { departureOutcome: ANSWERS.NO_DEPARTURE }
    ]) {
        const result = resolve(fixture, answers);
        assertClean(result);
        assert.equal(result.currentPatch.energos,
            answers.departureOutcome === ANSWERS.NO_DEPARTURE);
        assert.equal(result.insertedRows.length, 0);
    }
});

test('το σχήμα αποχώρησης και ιστορικής ισχύος αποδοχών απαιτεί ακριβώς δύο γεγονότα', () => {
    const result = plan(departureAndHistoricalPayFactFixture());
    assert.equal(result.status, PLAN_STATUSES.APPLICABLE);
    assert.equal(result.shapeKind, SHAPE_KINDS.DEPARTURE_AND_PAY_EFFECTIVE_DATE);
    assert.deepEqual(result.factQuestions.map(question => question.id), [
        'departureOutcome', 'departureDate', 'payEffectiveOutcome', 'payEffectiveDate'
    ]);
    assert.equal(result.factQuestions[0].label,
        'Πότε αποχώρησε πραγματικά ο εργαζόμενος;');
    assert.match(result.factQuestions[2].label, /1\.006,06/);
    assert.deepEqual(result.factQuestions[2].options.map(option => option.id), [
        ANSWERS.PAY_APPLIED_FROM_HIRE,
        ANSWERS.PAY_APPLIED_FROM_OTHER_DATE
    ]);
});

test('όλοι οι υποστηριζόμενοι συνδυασμοί D2 καταλήγουν CLEAN χωρίς αναδρομική εικασία', () => {
    const fixture = departureAndHistoricalPayFactFixture();
    const departures = [
        { departureOutcome: ANSWERS.DEPARTED_ON_FIRST_RECORDED_DATE },
        { departureOutcome: ANSWERS.DEPARTED_ON_SECOND_RECORDED_DATE },
        { departureOutcome: ANSWERS.DEPARTED_ON_OTHER_DATE,
            departureDate: '2026-08-15' },
        { departureOutcome: ANSWERS.NO_DEPARTURE }
    ];
    for (const departure of departures) {
        for (const pay of [
            { payEffectiveOutcome: ANSWERS.PAY_APPLIED_FROM_HIRE },
            { payEffectiveOutcome: ANSWERS.PAY_APPLIED_FROM_OTHER_DATE,
                payEffectiveDate: '2026-07-01' }
        ]) {
            const result = resolve(fixture, { ...departure, ...pay });
            assertClean(result);
            const semanticRows = result.desiredHistoryRows.filter(row =>
                row.employment_history_canonical_status !== REDUNDANT_REFERENCED);
            if (pay.payEffectiveOutcome === ANSWERS.PAY_APPLIED_FROM_HIRE) {
                assert.equal(semanticRows.length, 1);
            } else {
                assert.equal(semanticRows.length, 2);
                assert.equal(semanticRows[0].synolo_symbashs, 1095.16);
                assert.equal(semanticRows[1].synolo_symbashs, 1006.06);
            }
        }
    }
});

test('ελλιπείς, κακοσχηματισμένες και εκτός κύκλου ημερομηνίες απορρίπτονται πριν από σχέδιο', () => {
    const fixture = departureAndHistoricalPayFactFixture();
    const invalid = [
        {},
        { departureOutcome: ANSWERS.DEPARTED_ON_OTHER_DATE },
        { departureOutcome: ANSWERS.DEPARTED_ON_OTHER_DATE,
            departureDate: '2026-02-30', payEffectiveOutcome: ANSWERS.PAY_APPLIED_FROM_HIRE },
        { departureOutcome: ANSWERS.DEPARTED_ON_OTHER_DATE,
            departureDate: '2026-04-30', payEffectiveOutcome: ANSWERS.PAY_APPLIED_FROM_HIRE },
        { departureOutcome: ANSWERS.DEPARTED_ON_SECOND_RECORDED_DATE,
            payEffectiveOutcome: ANSWERS.PAY_APPLIED_FROM_OTHER_DATE,
            payEffectiveDate: '2026-08-13' },
        { departureOutcome: ANSWERS.NO_DEPARTURE,
            payEffectiveOutcome: ANSWERS.PAY_APPLIED_FROM_OTHER_DATE,
            payEffectiveDate: '2026-05-01T00:00:00.000Z' },
        { departureOutcome: ANSWERS.NO_DEPARTURE,
            payEffectiveOutcome: ANSWERS.PAY_APPLIED_FROM_HIRE,
            periodEnd: '2026-08-12' }
    ];
    for (const answers of invalid) assert.throws(() => resolve(fixture, answers), error =>
        String(error.code).startsWith('EMPLOYEE_HISTORY_'));
});

test('η φυσική διαγραφή επιτρέπεται μόνο χωρίς συσχετίσεις και η προέλευση διατηρείται λογικά', () => {
    const unreferenced = competingDepartureDatesFixture();
    const physical = resolve(unreferenced,
        { departureOutcome: ANSWERS.DEPARTED_ON_FIRST_RECORDED_DATE });
    assert.ok(physical.physicalDeleteIds.length > 0);
    assert.equal(physical.referenceClass, REFERENCE_CLASSES.NO_REFERENCES);

    const referenced = competingDepartureDatesFixture({
        referencedIds: [IDS.OPEN, IDS.DEPARTURE_A, IDS.DEPARTURE_B]
    });
    const logical = resolve(referenced,
        { departureOutcome: ANSWERS.DEPARTED_ON_FIRST_RECORDED_DATE });
    assert.equal(logical.physicalDeleteIds.length, 0);
    assert.equal(logical.referenceClass, REFERENCE_CLASSES.PROVENANCE_ONLY);
    assert.ok(logical.desiredHistoryRows.some(row =>
        row.employment_history_canonical_status === REDUNDANT_REFERENCED));

    const partiallyReferenced = competingDepartureDatesFixture({
        referencedIds: [IDS.DEPARTURE_A]
    });
    const allLogical = resolve(partiallyReferenced,
        { departureOutcome: ANSWERS.DEPARTED_ON_FIRST_RECORDED_DATE });
    assert.equal(allLogical.physicalDeleteIds.length, 0);
    assert.equal(allLogical.desiredHistoryRows.filter(row =>
        row.employment_history_canonical_status === REDUNDANT_REFERENCED).length, 2);
});

test('LIVE και UNKNOWN συσχετίσεις αποτυγχάνουν κλειστά', () => {
    const unknown = competingDepartureDatesFixture();
    delete unknown.protectedReferenceSummary[IDS.DEPARTURE_A];
    assert.equal(plan(unknown).status, PLAN_STATUSES.BLOCKED);

    const live = competingDepartureDatesFixture();
    live.protectedReferenceSummary[IDS.DEPARTURE_A] = [{
        collection: 'Synthetic_Live', documentId: 'live-synthetic'
    }];
    const blocked = planEmployeeHistoryBusinessFactResolution({ ...live,
        referencePartitioner: references => ({ frozenProvenance: [],
            liveDereference: references }) });
    assert.equal(blocked.status, PLAN_STATUSES.BLOCKED);
    assert.equal(blocked.referenceClass, REFERENCE_CLASSES.LIVE_REFERENCE);
});

test('πρόσθετη μη μισθολογική αμφισημία δεν λαμβάνει ελλιπές ερωτηματολόγιο', () => {
    const fixture = departureAndHistoricalPayFactFixture();
    fixture.completeHistoryRows[2].eidikothta_symbashs = '0099';
    const result = plan(fixture);
    assert.equal(result.status, PLAN_STATUSES.NOT_APPLICABLE);
    assert.equal(result.reason, 'ADDITIONAL_BUSINESS_FACTS_REQUIRED');
});

test('δεύτερος κύκλος πρόσληψης δεν επιτρέπεται να διασχιστεί από ημερομηνία αποχώρησης', () => {
    const fixture = competingDepartureDatesFixture();
    fixture.completeHistoryRows.push({ ...fixture.completeHistoryRows[1],
        _id: '507f1f77bcf86cd799439399',
        hmeromhnia_proslhpshs: '2026-09-01',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-01',
        hmeromhnia_apoxorhshs: null,
        aa_eggrafhs: '0099' });
    fixture.protectedReferenceSummary['507f1f77bcf86cd799439399'] = [];
    const result = plan(fixture);
    assert.notEqual(result.status, PLAN_STATUSES.APPLICABLE);
});

test('η καθαρή επανάληψη δεν ξαναζητά γεγονότα και ο πηγαίος κώδικας δεν περιέχει κωδικούς αποδοχής', () => {
    const fixture = competingDepartureDatesFixture();
    const result = resolve(fixture, { departureOutcome: ANSWERS.NO_DEPARTURE });
    const repeated = planEmployeeHistoryBusinessFactResolution({
        ...fixture,
        currentEmployee: { ...fixture.currentEmployee, ...result.currentPatch },
        completeHistoryRows: result.desiredHistoryRows,
        protectedReferenceSummary: Object.fromEntries(result.desiredHistoryRows.map(row =>
            [String(row._id), []]))
    });
    assert.equal(repeated.status, PLAN_STATUSES.NOT_APPLICABLE);
    const source = fs.readFileSync(path.join(__dirname,
        'employeeHistoryBusinessFactResolutionPlannerService.js'), 'utf8');
    for (const code of ['0081', '0355', '0008', '0045', '0239']) {
        assert.equal(source.includes(code), false);
    }
    assert.equal(provenance('synthetic')[0].collection,
        'Apasxoliseis_Period_Frozen_Snapshots');
});
