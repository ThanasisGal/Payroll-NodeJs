'use strict';

const assert = require('assert');
const {
    LEGAL_OVERTIME_FIELDS,
    LEGAL_OVERWORK_FIELDS,
    hoursToMinutes,
    totalFieldMinutes,
    buildWtoOvertimeCanonicalDataset,
    buildWtoOvertimePayload,
    validateWtoOvertimeParity,
    buildWtoOvertimePayloadFingerprint
} = require('./wtoOvertimeSubmissionService');

const employee = (overrides = {}) => ({ kodikos: '0001', afm: '123456789',
    eponymo: 'ΤΡΕΧΟΝ', onoma: 'ΟΝΟΜΑ', karta_ergasias: true,
    afora_daneismo_ergazomenoy: false, typos_ergodoth_daneismoy: false, ...overrides });
const row = (date = '2026-08-10', overrides = {}) => ({ _id: `row-${date}`, kodikos: '0001',
    hmeromhnia: new Date(`${date}T00:00:00.000Z`),
    cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00',
    apo_ora_yperories: '17:01', eos_ora_yperories: '18:01',
    ores_nominhs_yperorias_apologistika: 1, ...overrides });

assert.deepStrictEqual(LEGAL_OVERTIME_FIELDS, [
    'ores_nominhs_yperorias_apologistika', 'ores_nominhs_yperorias_nyxtas_apologistika',
    'ores_nominhs_yperorias_argion_apologistika',
    'ores_nominhs_yperorias_argion_nyxtas_apologistika'
]);
assert.deepStrictEqual(LEGAL_OVERWORK_FIELDS, [
    'ores_yperergasias_apologistika', 'ores_yperergasias_nyxtas_apologistika',
    'ores_yperergasias_argion_apologistika', 'ores_yperergasias_argion_nyxtas_apologistika'
]);
assert.equal(hoursToMinutes(1.5), 90);
assert.equal(hoursToMinutes(1.25), 75);
assert.equal(hoursToMinutes(1.0084), 61, 'τα κλασματικά λεπτά στρογγυλοποιούνται στο πλησιέστερο');

const fourFieldRow = row('2026-08-10', {
    ores_nominhs_yperorias_apologistika: 0.5,
    ores_nominhs_yperorias_nyxtas_apologistika: 0.25,
    ores_nominhs_yperorias_argion_apologistika: 0.5,
    ores_nominhs_yperorias_argion_nyxtas_apologistika: 0.25,
    ores_paranomhs_yperorias_apologistika: 99,
    ores_paranomhs_yperorias_nyxtas_apologistika: 99,
    ores_yperergasias_apologistika: 0.25,
    ores_yperergasias_nyxtas_apologistika: 0.25,
    ores_yperergasias_argion_apologistika: 0.25,
    ores_yperergasias_argion_nyxtas_apologistika: 0.25
});
assert.equal(totalFieldMinutes(fourFieldRow, LEGAL_OVERTIME_FIELDS), 90,
    'η νόμιμη υπερωρία είναι το άθροισμα των τεσσάρων canonical πεδίων');
assert.equal(totalFieldMinutes(fourFieldRow, LEGAL_OVERWORK_FIELDS), 60,
    'η νόμιμη υπερεργασία είναι το άθροισμα των τεσσάρων canonical πεδίων');
let result = buildWtoOvertimeCanonicalDataset({ sourceRows: [fourFieldRow], employees: [employee()] });
assert.equal(result.rows.length, 1);
assert.equal(result.rows[0].legal_overtime_minutes, 90, 'η παράνομη υπερωρία δεν συμμετέχει');
assert.equal(result.rows[0].legal_overwork_minutes, 60);
assert.equal(result.rows[0].f_type, 'ΥΠ');
assert.equal(result.rows[0].f_from, '17:01');
assert.equal(result.rows[0].f_to, '18:01');

result = buildWtoOvertimeCanonicalDataset({ sourceRows: [row('2026-08-11', {
    ores_nominhs_yperorias_apologistika: 0, ores_yperergasias_apologistika: 2
})], employees: [employee()] });
assert.equal(result.rows.length, 0, 'η υπερεργασία μόνη της δεν δημιουργεί WTOOvA row');

const authoritativeRow = row('2026-08-12', {
    cards_eos_ora_01: '22:00', eos_ora_03_apologistika: '21:30',
    ores_yperergasias_apologistika: 1.5,
    apo_ora_yperories: '20:13', eos_ora_yperories: '21:43'
});
result = buildWtoOvertimeCanonicalDataset({ sourceRows: [authoritativeRow], employees: [employee()] });
assert.equal(result.rows[0].f_from, '20:13', 'η canonical αρχή υπερωρίας είναι authoritative');
assert.equal(result.rows[0].f_to, '21:43', 'η canonical λήξη διατηρείται έως 180 λεπτά');
assert.notEqual(result.rows[0].f_from, '23:31',
    'δεν εφαρμόζεται έξοδος κάρτας + υπερεργασία + 1 λεπτό');

const changedOverworkRow = { ...authoritativeRow, ores_yperergasias_apologistika: 0 };
const unchangedInterval = buildWtoOvertimeCanonicalDataset({ sourceRows: [changedOverworkRow],
    employees: [employee()] }).rows[0];
assert.deepStrictEqual([unchangedInterval.f_from, unchangedInterval.f_to], ['20:13', '21:43'],
    'η μεταβολή της υπερεργασίας δεν μεταβάλλει το WTOOvA διάστημα');

for (const karta_ergasias of [true, false]) {
    const sameRule = buildWtoOvertimeCanonicalDataset({ sourceRows: [authoritativeRow],
        employees: [employee({ karta_ergasias })] }).rows[0];
    assert.deepStrictEqual([sameRule.f_from, sameRule.f_to], ['20:13', '21:43'],
        'εργαζόμενοι με και χωρίς κάρτα χρησιμοποιούν το ίδιο canonical διάστημα');
}

for (const invalidInterval of [
    { apo_ora_yperories: '' },
    { eos_ora_yperories: '' },
    { apo_ora_yperories: '24:00' },
    { eos_ora_yperories: '18:60' }
]) {
    result = buildWtoOvertimeCanonicalDataset({ sourceRows: [row('2026-08-13', invalidInterval)],
        employees: [employee()] });
    assert.equal(result.rows.length, 0);
    assert.equal(result.blockers[0].code, 'WTOOVA_CANONICAL_OVERTIME_INTERVAL_MISSING');
    assert.equal(result.blockers[0].message,
        'Δεν υπάρχει έγκυρο απολογιστικό διάστημα νόμιμης υπερωρίας.\n' +
        'Εκτελέστε ξανά τον Υπολογισμό / Έλεγχο Απασχολήσεων για τη συγκεκριμένη ημέρα.');
}

result = buildWtoOvertimeCanonicalDataset({ sourceRows: [row('2026-08-15')], employees: [employee({
    karta_ergasias: false, afora_daneismo_ergazomenoy: true,
    typos_ergodoth_daneismoy: false })] });
assert.equal(result.rows.length, 0, 'η ακριβής lending-side εξαίρεση διατηρείται');
assert.equal(result.blockers.length, 0);

result = buildWtoOvertimeCanonicalDataset({ sourceRows: [row('2026-08-16', {
    apo_ora_yperories: '23:15', eos_ora_yperories: '01:15',
    ores_nominhs_yperorias_apologistika: 2
})], employees: [employee()] });
assert.equal(result.rows[0].f_from, '23:15');
assert.equal(result.rows[0].f_to, '01:15');
let payload = buildWtoOvertimePayload({ canonicalRows: result.rows, branch: '0001' });
const midnightEmployee = payload.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0];
assert.equal(midnightEmployee.f_date, '16/08/2026');
assert.equal(midnightEmployee.ErgazomenosAnalytics.ErgazomenosWTOAnalytics.length, 1,
    'η υπερωρία μετά τα μεσάνυχτα δεν σπάει');

result = buildWtoOvertimeCanonicalDataset({ sourceRows: [row('2026-08-17', {
    apo_ora_yperories: '20:13', eos_ora_yperories: '23:23',
    ores_nominhs_yperorias_apologistika: 1.78,
    ores_nominhs_yperorias_argion_nyxtas_apologistika: 1.38
})], employees: [employee()] });
assert.equal(result.rows[0].legal_overtime_minutes, 190);
assert.equal(result.rows[0].submitted_overtime_minutes, 180);
assert.equal(result.rows[0].excess_minutes, 10);
assert.equal(result.rows[0].f_from, '20:13');
assert.equal(result.rows[0].f_to, '23:13');
assert.equal(result.warnings.length, 1);
assert.equal(result.blockers.length, 0, 'η υπέρβαση 180 λεπτών είναι warning και όχι blocker');
assert.match(result.warnings[0].message, /έως 3 ώρες/);

const mayKnownRows = buildWtoOvertimeCanonicalDataset({
    sourceRows: [
        row('2026-05-01', { _id: 'may-0004', kodikos: '0004',
            cards_apo_ora_01: '14:00', cards_eos_ora_01: '22:17',
            apo_ora_yperories: '22:18', eos_ora_yperories: '22:19',
            ores_nominhs_yperorias_apologistika: 1 / 60 }),
        row('2026-05-09', { _id: 'may-0017', kodikos: '0017',
            cards_apo_ora_01: '14:00', cards_eos_ora_01: '22:07',
            apo_ora_yperories: '22:08', eos_ora_yperories: '01:44',
            ores_nominhs_yperorias_apologistika: 3.6 })
    ],
    employees: [
        employee({ kodikos: '0004', afm: '111111111',
            eponymo: 'ΤΣΙΤΟΓΛΟΥ', onoma: 'ΧΡΗΣΤΟΣ' }),
        employee({ kodikos: '0017', afm: '222222222',
            eponymo: 'ΜΕΛΑΧΡΟΙΝΑΚΗΣ', onoma: 'ΑΝΑΡΓΥΡΟΣ' })
    ]
});
assert.deepStrictEqual({ ...mayKnownRows.rows[0], warnings: undefined }, {
    source_record_id: 'may-0004', employee_code: '0004', afm: '111111111',
    eponymo: 'ΤΣΙΤΟΓΛΟΥ', onoma: 'ΧΡΗΣΤΟΣ', date: '2026-05-01',
    legal_overwork_minutes: 0, legal_overtime_minutes: 1, submitted_overtime_minutes: 1, excess_minutes: 0,
    f_type: 'ΥΠ', f_from: '22:18', f_to: '22:19', warnings: undefined
});
assert.deepStrictEqual({ ...mayKnownRows.rows[1], warnings: undefined }, {
    source_record_id: 'may-0017', employee_code: '0017', afm: '222222222',
    eponymo: 'ΜΕΛΑΧΡΟΙΝΑΚΗΣ', onoma: 'ΑΝΑΡΓΥΡΟΣ', date: '2026-05-09',
    legal_overwork_minutes: 0, legal_overtime_minutes: 216, submitted_overtime_minutes: 180,
    excess_minutes: 36, f_type: 'ΥΠ', f_from: '22:08', f_to: '01:08', warnings: undefined
});
assert.equal(mayKnownRows.warnings.length, 1);
assert.equal(mayKnownRows.blockers.length, 0);

result = buildWtoOvertimeCanonicalDataset({ sourceRows: [
    row('2026-08-27'), row('2026-08-05', { _id: 'earlier' })
], employees: [employee()] });
assert.equal(result.rows.length, 2, 'μία γραμμή ανά εργαζόμενο και διαφορετική ημερομηνία');
payload = buildWtoOvertimePayload({ canonicalRows: result.rows, branch: '0001' });
const outer = payload.WTOS.WTO[0];
assert.equal(outer.f_from_date, '05/08/2026');
assert.equal(outer.f_to_date, '27/08/2026');
assert.equal(outer.f_rel_protocol, ''); assert.equal(outer.f_rel_date, '');
assert.equal(outer.f_comments, '');
assert.equal(outer.Ergazomenoi.ErgazomenoiWTO[0].f_eponymo, 'ΤΡΕΧΟΝ',
    'η ταυτότητα προέρχεται από το τρέχον Employee');
assert.equal(outer.Ergazomenoi.ErgazomenoiWTO.every((item) =>
    item.ErgazomenosAnalytics.ErgazomenosWTOAnalytics.length === 1), true);
assert.equal(validateWtoOvertimeParity(result.rows, payload).exact, true);
const altered = JSON.parse(JSON.stringify(payload));
altered.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics[0].f_to = '23:59';
assert.equal(validateWtoOvertimeParity(result.rows, altered).exact, false);
const correctedFingerprint = buildWtoOvertimePayloadFingerprint({ team: 'TEAM1',
    company: '507f1f77bcf86cd799439011', branch: '0001', payload });
assert.equal(correctedFingerprint,
    'ba053655ade28efaba13d88e096d26d0331e4d325403aa9571cb7b32064504b6');
assert.notEqual(correctedFingerprint,
    '62dcd6999bbb7bc6a512d2aec06a7dfd03b37d0bfd2cf64aa1898d2cb105b872',
    'το αποτύπωμα αλλάζει όταν διορθώνεται το canonical διάστημα');

console.log('PASS WTOOvA legal-only canonical projection, time rules, cap, identity, dates and parity');
