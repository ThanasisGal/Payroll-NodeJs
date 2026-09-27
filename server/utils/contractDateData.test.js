'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildContractDateData,
    calculateContractDateDifference,
    formatContractDate,
    validateContractDateInvariants
} = require('./contractDateData');

const observedFixture = Object.freeze({
    hmeromhnia_proslhpshs: '2026-09-16',
    hmeromhnia_allaghs_symbashs: '2026-09-16',
    hmeromhnia_lhxhs_symbashs: '2027-07-30'
});

test('observed year-crossing contract keeps the persisted 2027 expiry in every placeholder', () => {
    const data = buildContractDateData(observedFixture);

    assert.equal(data._HMEROMHNIA_PROSLHPSHS, '16/09/2026');
    assert.equal(data._HMEROMHNIA_LHXHS_SYMBASHS, '30/07/2027');
    assert.equal(data.durationText, '10 μηνών, 14 ημερών');
    assert.equal(
        data._DIARKEIA,
        ', διάρκειας 10 μηνών, 14 ημερών και η οποία λήγει την 30/07/2027.'
    );
    assert.doesNotMatch(data._DIARKEIA, /30\/07\/2026/);
});

test('same-year fixed-term contract remains valid', () => {
    const data = buildContractDateData({
        hmeromhnia_proslhpshs: '2026-01-15',
        hmeromhnia_allaghs_symbashs: '2026-01-15',
        hmeromhnia_lhxhs_symbashs: '2026-06-30'
    });

    assert.equal(data._HMEROMHNIA_LHXHS_SYMBASHS, '30/06/2026');
    assert.equal(data.durationText, '5 μηνών, 15 ημερών');
});

test('year-crossing fixed-term contract retains its end year', () => {
    const data = buildContractDateData({
        hmeromhnia_proslhpshs: '2026-12-15',
        hmeromhnia_allaghs_symbashs: '2026-12-15',
        hmeromhnia_lhxhs_symbashs: '2027-01-20'
    });

    assert.equal(data._HMEROMHNIA_LHXHS_SYMBASHS, '20/01/2027');
    assert.equal(data.durationText, '1 μηνός, 5 ημερών');
});

test('leap-year boundary follows the existing calendar difference semantics', () => {
    assert.equal(
        calculateContractDateDifference('2024-02-29', '2025-02-28'),
        '11 μηνών, 30 ημερών'
    );
    assert.equal(formatContractDate(new Date('2024-02-29T00:00:00.000Z')), '29/02/2024');
});

test('open-ended contract does not invent an expiry', () => {
    const data = buildContractDateData({
        hmeromhnia_proslhpshs: '2026-09-16',
        hmeromhnia_allaghs_symbashs: '2026-09-16',
        hmeromhnia_lhxhs_symbashs: null
    });

    assert.equal(data._HMEROMHNIA_LHXHS_SYMBASHS, '');
    assert.equal(data.durationText, '');
    assert.equal(data._DIARKEIA, '.');
});

test('expiry before hire is blocked instead of producing a plausible positive duration', () => {
    const invalid = {
        hmeromhnia_proslhpshs: '2026-09-16',
        hmeromhnia_allaghs_symbashs: '2026-09-16',
        hmeromhnia_lhxhs_symbashs: '2026-07-30'
    };

    assert.throws(
        () => buildContractDateData(invalid),
        (error) =>
            error.code === 'CONTRACT_END_BEFORE_HIRE' &&
            error.message ===
                'Η ημερομηνία λήξης της σύμβασης προηγείται της ημερομηνίας πρόσληψης. Δεν δημιουργήθηκε PDF σύμβασης.'
    );
});

test('expiry before contract change is also blocked', () => {
    assert.throws(
        () => validateContractDateInvariants({
            hmeromhnia_proslhpshs: '2026-01-01',
            hmeromhnia_allaghs_symbashs: '2026-09-16',
            hmeromhnia_lhxhs_symbashs: '2026-09-15'
        }),
        (error) => error.code === 'CONTRACT_END_BEFORE_CHANGE'
    );
});

test('invalid calendar dates fail closed', () => {
    assert.throws(
        () => buildContractDateData({
            hmeromhnia_proslhpshs: '2026-02-30',
            hmeromhnia_allaghs_symbashs: '2026-02-28',
            hmeromhnia_lhxhs_symbashs: '2026-12-31'
        }),
        (error) => error.code === 'CONTRACT_DATE_INVALID'
    );
});
