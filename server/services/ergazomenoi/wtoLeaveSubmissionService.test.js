'use strict';

const assert = require('assert');
const {
    employeeEligibleForWtoLeave,
    candidateKind,
    buildWtoLeaveCanonicalDataset,
    buildWtoLeavePayload,
    validateWtoLeaveParity
} = require('./wtoLeaveSubmissionService');

const employee = (overrides = {}) => ({ kodikos: '0001', afm: '123456789',
    eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΜΑΡΙΑ', karta_ergasias: true,
    afora_daneismo_ergazomenoy: false, typos_ergodoth_daneismoy: false,
    hmeromhnia_proslhpshs: new Date('2024-01-01T00:00:00Z'),
    hmeres_ergasias_ebdomadas: 5, kathestos_apasxolhshs: '', typos_apasxolhshs: '0',
    proyphresia_adeias_se_eth: 0, ...overrides });
const row = (date, overrides = {}) => ({ _id: `row-${date}`, kodikos: '0001',
    hmeromhnia: new Date(`${date}T00:00:00Z`), adeia_apologistika: true,
    kathgoria_adeias_apologistika: 'ΑΔΑΛΛΗ',
    egkekrimenh_oroadeia_apologistika: false,
    egkekrimena_diastimata_oroadeias_apologistika: [], ...overrides });

assert.equal(employeeEligibleForWtoLeave(employee()), true, 'κάρτα true');
assert.equal(employeeEligibleForWtoLeave(employee({ karta_ergasias: false })), true,
    'η ψηφιακή κάρτα δεν είναι προϋπόθεση WTOLeave');
assert.equal(employeeEligibleForWtoLeave(employee({ afora_daneismo_ergazomenoy: true,
    typos_ergodoth_daneismoy: false })), false, 'πλευρά δανειζόμενου αποκλείεται');
assert.equal(employeeEligibleForWtoLeave(employee({ afora_daneismo_ergazomenoy: true,
    typos_ergodoth_daneismoy: true })), true, 'δανείζων εργοδότης περιλαμβάνεται');
assert.equal(buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10')],
    employees: [employee({ karta_ergasias: false })] }).rows.length, 1,
'εργαζόμενος χωρίς κάρτα αλλά με lending eligibility περιλαμβάνεται');
assert.equal(buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10')],
    employees: [employee({ karta_ergasias: true })] }).rows.length, 1,
'εργαζόμενος με κάρτα και lending eligibility περιλαμβάνεται');
assert.equal(buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10')],
    employees: [employee({ karta_ergasias: false, afora_daneismo_ergazomenoy: true,
        typos_ergodoth_daneismoy: false })] }).rows.length, 0,
'η υπάρχουσα lending-side εξαίρεση διατηρείται ανεξάρτητα από την κάρτα');

const sicknessRow = row('2026-08-11', { adeia_apologistika: false,
    astheneia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΑΝΕΥΑΠ' });
assert.deepStrictEqual(candidateKind(sicknessRow), {
    kind: 'full_day', type: 'ΑΔΑΝΕΥΑΠ', intervals: []
}, 'η canonical ασθένεια χρησιμοποιεί την επιλεγμένη κατηγορία HR');
const sicknessResult = buildWtoLeaveCanonicalDataset({ sourceRows: [sicknessRow],
    employees: [employee()] });
assert.equal(sicknessResult.rows.length, 1);
const sicknessAnalytics = buildWtoLeavePayload({ canonicalRows: sicknessResult.rows,
    branch: '0001' }).WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics[0];
assert.deepStrictEqual(sicknessAnalytics, {
    f_type: 'ΑΔΑΝΕΥΑΠ', f_from: '', f_to: '', f_year: '', f_req_days: ''
}, 'η ασθένεια διατηρεί τον επιλεγμένο τύπο χωρίς hard-coded ΑΔΑΣ');

const weekendAn = row('2026-08-09', { adeia_apologistika: false,
    astheneia_apologistika: false, kathgoria_adeias_apologistika: '',
    kathgoria_ergasias_apologistika: 'ΑΝ', apologistiko_biblio: true });
assert.deepStrictEqual(candidateKind(weekendAn), { kind: 'excluded' },
    'το Σαββατοκύριακο ΑΝ χωρίς leave/sickness flags αποκλείεται');
assert.equal(buildWtoLeaveCanonicalDataset({ sourceRows: [weekendAn],
    employees: [employee()] }).rows.length, 0);

for (const [label, profile, expected] of [
    ['canonical full-time', { kathestos_apasxolhshs: '0', typos_apasxolhshs: '' }, '0'],
    ['canonical part-time', { kathestos_apasxolhshs: '1', typos_apasxolhshs: '' }, '1'],
    ['canonical rotational', { kathestos_apasxolhshs: '2', typos_apasxolhshs: '' }, '2'],
    ['legacy fallback', { kathestos_apasxolhshs: '', typos_apasxolhshs: '1' }, '1']
]) {
    const resolved = buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10', {
        kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' })], employees: [employee(profile)] });
    assert.equal(resolved.blockers.length, 0, label);
    assert.equal(resolved.rows[0].entitlement_debug.employmentType, expected, label);
}
const missingEmploymentType = buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10', {
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' })], employees: [employee({
    kathestos_apasxolhshs: '', typos_apasxolhshs: '' })] });
assert.equal(missingEmploymentType.rows.length, 0);
assert.equal(missingEmploymentType.blockers[0].code, 'WTOLEAVE_INVALID_EMPLOYMENT_TYPE');

let result = buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10')], employees: [employee()] });
assert.equal(result.rows.length, 1, 'επιβεβαιωμένη ολοήμερη άδεια');
assert.equal(result.rows[0].full_day, true);

result = buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10', {
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' })], employees: [employee()] });
assert.equal(result.rows.length, 0, 'POSSIBLE_LEAVE δεν αποστέλλεται');
assert.equal(result.blockers.length, 0);

const hourly = row('2026-08-10', { adeia_apologistika: false,
    egkekrimenh_oroadeia_apologistika: true,
    egkekrimena_diastimata_oroadeias_apologistika: [
        { apo_lepto: 600, eos_lepto: 660 }, { apo_lepto: 840, eos_lepto: 930 }
    ] });
result = buildWtoLeaveCanonicalDataset({ sourceRows: [hourly], employees: [employee()] });
assert.equal(result.rows.length, 1, 'εγκεκριμένη ωριαία άδεια');
assert.deepStrictEqual(result.rows[0].intervals.map(({ from, to }) => ({ from, to })), [
    { from: '10:00', to: '11:00' }, { from: '14:00', to: '15:30' }
]);
let payload = buildWtoLeavePayload({ canonicalRows: result.rows, branch: '0001' });
assert.equal(payload.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics.length, 2, 'τα διαστήματα δεν συγχωνεύονται');

result = buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10', {
    adeia_apologistika: false, egkekrimenh_oroadeia_apologistika: true,
    egkekrimena_diastimata_oroadeias_apologistika: [{ apo_lepto: 660, eos_lepto: 600 }]
})], employees: [employee()] });
assert.equal(result.blockers[0].code, 'WTOLEAVE_INVALID_HOURLY_SEGMENTS');

result = buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10', {
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ', egkekrimenh_oroadeia_apologistika: true,
    egkekrimena_diastimata_oroadeias_apologistika: [{ apo_lepto: 600, eos_lepto: 660 }]
})], employees: [employee()] });
assert.equal(result.blockers[0].code, 'WTOLEAVE_ADKAN_HOURLY_CONFLICT');
assert.equal(buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10', {
    kathgoria_adeias_apologistika: '   ' })], employees: [employee()] }).blockers[0].code,
'WTOLEAVE_EMPTY_TYPE');

result = buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10'), row('2026-08-20')],
    employees: [employee()] });
payload = buildWtoLeavePayload({ canonicalRows: result.rows, branch: '0001' });
assert.equal(payload.WTOS.WTO[0].f_from_date, '10/08/2026');
assert.equal(payload.WTOS.WTO[0].f_to_date, '20/08/2026');
assert.equal(payload.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0].f_eponymo, 'ΔΟΚΙΜΗ');

result = buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10', {
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' })], employees: [employee()] });
assert.equal(result.blockers.length, 0);
const parityRows = result.rows;
payload = buildWtoLeavePayload({ canonicalRows: result.rows, branch: '0001' });
const adkan = payload.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics[0];
assert.equal(adkan.f_from, ''); assert.equal(adkan.f_to, '');
assert.equal(adkan.f_year, '2026'); assert.match(adkan.f_req_days, /^\d{3}$/);

const fiveDays = ['10', '11', '12', '13', '14'].map((day) => row(`2026-08-${day}`, {
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' }));
result = buildWtoLeaveCanonicalDataset({ sourceRows: fiveDays,
    employees: [employee({ hmeromhnia_apoxorhshs: new Date('2026-08-09T00:00:00Z') })] });
assert.equal(result.rows.length, 5, 'κάθε ημερομηνία ΑΔΚΑΝ δημιουργεί χωριστό ErgazomenosWTO');
assert.equal(result.blockers.length, 0, 'η ημερομηνία αποχώρησης δεν κόβει τη referenceDate');

result = buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-07-01', {
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' }), row('2026-12-31', {
    kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' })], employees: [employee({
    hmeromhnia_proslhpshs: new Date('2026-07-01T00:00:00Z') })] });
assert.notEqual(result.rows[0].required_days, result.rows[1].required_days,
    'το f_req_days επανυπολογίζεται για κάθε f_date');

const other = buildWtoLeavePayload({ canonicalRows: buildWtoLeaveCanonicalDataset({
    sourceRows: [row('2026-08-10')], employees: [employee()] }).rows, branch: '0001' })
    .WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics[0];
assert.equal(other.f_year, ''); assert.equal(other.f_req_days, '');
const exactType = buildWtoLeaveCanonicalDataset({ sourceRows: [row('2026-08-10', {
    kathgoria_adeias_apologistika: 'ΑΔΑΛΛΗ ' })], employees: [employee()] });
assert.equal(buildWtoLeavePayload({ canonicalRows: exactType.rows, branch: '0001' }).WTOS.WTO[0]
    .Ergazomenoi.ErgazomenoiWTO[0].ErgazomenosAnalytics.ErgazomenosWTOAnalytics[0].f_type,
'ΑΔΑΛΛΗ ', 'το f_type διατηρεί ακριβώς την τιμή του απολογιστικού πεδίου');

assert.equal(validateWtoLeaveParity(parityRows, payload).exact, true);
const altered = JSON.parse(JSON.stringify(payload));
altered.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics[0].f_type = 'OTHER';
assert.equal(validateWtoLeaveParity(parityRows, altered).exact, false, 'αλλοιωμένος τύπος απορρίπτεται');
altered.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics[0].f_type = 'ΑΔΚΑΝ';
altered.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0].f_date = '11/08/2026';
assert.equal(validateWtoLeaveParity(parityRows, altered).exact, false, 'αλλοιωμένη ημερομηνία απορρίπτεται');
altered.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0].f_date = '10/08/2026';
altered.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics[0].f_from = '10:00';
assert.equal(validateWtoLeaveParity(parityRows, altered).exact, false, 'αλλοιωμένο διάστημα απορρίπτεται');
const alteredOuter = JSON.parse(JSON.stringify(payload));
alteredOuter.WTOS.WTO[0].f_from_date = '01/08/2026';
assert.equal(validateWtoLeaveParity(parityRows, alteredOuter).exact, false,
    'αλλοιωμένο πραγματικό εξωτερικό διάστημα απορρίπτεται');

console.log('PASS WTOLeave canonical selection, identity, intervals, dates and parity');
