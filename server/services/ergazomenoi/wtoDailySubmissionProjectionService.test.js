'use strict';

const assert = require('assert');
const { buildWtoDailySubmissionProjection, buildWTODayilyAPayload, formatDate,
    selectWtoDailySourceRows, resolveWtoDailyAnalytics, TYPE_RULES } = require('./wtoDailySubmissionProjectionService');
const juneFixtures = require('./fixtures/weeklyRepoTransferProductionRegressionFixtures');
const { buildWTOXML } = require('../../utils/xmlGenerators/wto_v1Generator');

const employees = [
    { kodikos: '1', afm: '123456789', eponymo: 'Α&Β', onoma: 'ΑΝΝΑ' },
    { kodikos: '2', afm: '987654321', eponymo: 'ΔΕΥΤΕΡΟΣ', onoma: 'ΝΙΚΟΣ' }
];
const row = (overrides = {}) => ({ kodikos: '1', hmeromhnia: '2026-06-01',
    apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΕΡΓ', apo_ora_01_apologistika: '08:00',
    eos_ora_01_apologistika: '16:00', ...overrides });
const build = (rows, overrides = {}) => buildWtoDailySubmissionProjection({ rows, employees,
    branch: '0000', periodStart: '2026-06-01', periodEnd: '2026-06-30', ...overrides });
const payloadFor = (rows, overrides) => buildWTODayilyAPayload(build(rows, overrides));
const analytics = (payload, index = 0) => payload.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[index]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics;
function code(error) { return error?.code; }

const one = payloadFor([row()]);
assert.deepStrictEqual(one, { WTOS: { WTO: [{ f_aa_pararthmatos: '0000', f_rel_protocol: '',
    f_rel_date: '', f_comments: '', f_from_date: '01/06/2026', f_to_date: '30/06/2026',
    Ergazomenoi: { ErgazomenoiWTO: [{ f_afm: '123456789', f_eponymo: 'Α&Β', f_onoma: 'ΑΝΝΑ',
        f_date: '01/06/2026', ErgazomenosAnalytics: { ErgazomenosWTOAnalytics: [
            { f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' }
        ] } }] } }] } });

const twoEmployees = payloadFor([row(), row({ kodikos: '2', hmeromhnia: '2026-06-01' })]);
assert.strictEqual(twoEmployees.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO.length, 2);
const twoDates = payloadFor([row(), row({ hmeromhnia: '2026-06-02' })]);
assert.deepStrictEqual(twoDates.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO.map((x) => x.f_date), ['01/06/2026', '02/06/2026']);

const multi = payloadFor([row({ apo_ora_02_apologistika: '18:00', eos_ora_02_apologistika: '20:00',
    apo_ora_03_apologistika: '22:00', eos_ora_03_apologistika: '02:00' })]);
assert.deepStrictEqual(analytics(multi), [
    { f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' },
    { f_type: 'ΕΡΓ', f_from: '18:00', f_to: '20:00' },
    { f_type: 'ΕΡΓ', f_from: '22:00', f_to: '02:00' }
]);
const apologistikaPrecedence = resolveWtoDailyAnalytics(row({ cards_apo_ora_01: '08:05',
    cards_eos_ora_01: '16:03' }), TYPE_RULES['ΕΡΓ']);
assert.deepStrictEqual(apologistikaPrecedence, { analytics: [
    { f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' }
], source: 'APOLOGISTIKA_INTERVALS' });
const cardFallback = resolveWtoDailyAnalytics(row({ apo_ora_01_apologistika: '',
    eos_ora_01_apologistika: '', cards_apo_ora_01: '08:05', cards_eos_ora_01: '16:03' }), TYPE_RULES['ΕΡΓ']);
assert.deepStrictEqual(cardFallback, { analytics: [
    { f_type: 'ΕΡΓ', f_from: '08:05', f_to: '16:03' }
], source: 'FROZEN_CARD_INTERVALS' });
assert.deepStrictEqual(resolveWtoDailyAnalytics(row({ apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
    cards_apo_ora_01: '08:00', cards_eos_ora_01: '12:00', cards_apo_ora_02: '12:30',
    cards_eos_ora_02: '16:30', cards_apo_ora_03: '22:00', cards_eos_ora_03: '02:00' }), TYPE_RULES['ΕΡΓ']).analytics, [
    { f_type: 'ΕΡΓ', f_from: '08:00', f_to: '12:00' },
    { f_type: 'ΕΡΓ', f_from: '12:30', f_to: '16:30' },
    { f_type: 'ΕΡΓ', f_from: '22:00', f_to: '02:00' }
]);
assert.strictEqual(analytics(payloadFor([row({ kathgoria_ergasias_apologistika: 'ΑΝ',
    apo_ora_01_apologistika: '', eos_ora_01_apologistika: '' })]))[0].f_type, 'ΑΝ');
assert.deepStrictEqual(analytics(payloadFor([row({ kathgoria_ergasias_apologistika: 'ΑΝ',
    apo_ora_01_apologistika: '', eos_ora_01_apologistika: '' })])), [{ f_type: 'ΑΝ', f_from: '', f_to: '' }]);
assert.deepStrictEqual(analytics(payloadFor([row({ kathgoria_ergasias_apologistika: 'ΜΕ',
    apo_ora_01_apologistika: 'stale', eos_ora_01_apologistika: 'stale' })])), [{ f_type: 'ΜΕ', f_from: '', f_to: '' }]);
assert.deepStrictEqual(analytics(payloadFor([row({ kathgoria_ergasias_apologistika: 'ΤΗΛ' })])),
    [{ f_type: 'ΤΗΛ', f_from: '08:00', f_to: '16:00' }]);
const pureLeaveRow = row({ kathgoria_ergasias_apologistika: 'ΑΔΕΙΑ', adeia_apologistika: true,
    apo_ora_01_apologistika: '', eos_ora_01_apologistika: '' });
const pureSicknessRow = row({ kathgoria_ergasias_apologistika: '', astheneia_apologistika: true,
    kathgoria_ergasias: 'ΕΡΓ',
    apo_ora_01_apologistika: '', eos_ora_01_apologistika: '' });
assert.throws(() => payloadFor([pureLeaveRow]), (error) => code(error) === 'WTODAILY_NO_SUBMITTABLE_ROWS');
assert.throws(() => payloadFor([pureSicknessRow]), (error) => code(error) === 'WTODAILY_NO_SUBMITTABLE_ROWS');
assert.throws(() => payloadFor([row({ apologistiko_biblio: false })]),
    (error) => code(error) === 'WTODAILY_NO_SUBMITTABLE_ROWS');
assert.deepStrictEqual(analytics(payloadFor([row({ adeia_apologistika: true })])),
    [{ f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' }]);
assert.deepStrictEqual(analytics(payloadFor([row({ astheneia_apologistika: true })])),
    [{ f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' }]);
assert.deepStrictEqual(analytics(payloadFor([row({ argia: true, kyriakes_apologistika: 8 })])),
    [{ f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' }]);

const categoryPrecedence = build([row({ kathgoria_ergasias_apologistika: 'ΕΡΓ', kathgoria_ergasias: 'ΑΝ' })]);
assert.deepStrictEqual(categoryPrecedence.employees[0].category_sources, ['APOLOGISTIKA_CATEGORY']);
const declaredWork = build([row({ kathgoria_ergasias_apologistika: '', kathgoria_ergasias: 'ΕΡΓ' })]);
assert.strictEqual(declaredWork.employees[0].analytics[0].f_type, 'ΕΡΓ');
assert.deepStrictEqual(declaredWork.employees[0].category_sources, ['DECLARED_CATEGORY_FALLBACK']);
assert.deepStrictEqual(analytics(payloadFor([row({ kathgoria_ergasias_apologistika: '', kathgoria_ergasias: 'ΑΝ' })])),
    [{ f_type: 'ΑΝ', f_from: '', f_to: '' }]);
assert.deepStrictEqual(analytics(payloadFor([row({ kathgoria_ergasias_apologistika: '', kathgoria_ergasias: 'ΜΕ' })])),
    [{ f_type: 'ΜΕ', f_from: '', f_to: '' }]);
assert.deepStrictEqual(analytics(payloadFor([row({ kathgoria_ergasias_apologistika: '', kathgoria_ergasias: 'ΤΗΛ' })])),
    [{ f_type: 'ΤΗΛ', f_from: '08:00', f_to: '16:00' }]);
assert.throws(() => build([row({ kathgoria_ergasias_apologistika: 'UNKNOWN', kathgoria_ergasias: 'ΕΡΓ' })]),
    (e) => code(e) === 'UNSUPPORTED_WTODAILY_TYPE');
assert.throws(() => build([row({ kathgoria_ergasias_apologistika: '', kathgoria_ergasias: 'ΕΡΓ',
    adeia_apologistika: true })]), (e) => code(e) === 'WTODAILY_NO_SUBMITTABLE_ROWS');
assert.throws(() => build([row({ kathgoria_ergasias_apologistika: '', kathgoria_ergasias: 'ΕΡΓ',
    astheneia_apologistika: true })]), (e) => code(e) === 'WTODAILY_NO_SUBMITTABLE_ROWS');
assert.throws(() => build([row({ kathgoria_ergasias_apologistika: '', kathgoria_ergasias: '' })]),
    (e) => code(e) === 'UNSUPPORTED_WTODAILY_TYPE');

const duplicate = payloadFor([row(), row()]);
assert.strictEqual(duplicate.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO.length, 1);
assert.strictEqual(analytics(duplicate).length, 1);
assert.strictEqual(one.WTOS.WTO[0].f_from_date, '01/06/2026');
assert.strictEqual(one.WTOS.WTO[0].f_to_date, '30/06/2026');
assert.strictEqual(formatDate(new Date('2026-06-01T00:00:00.000Z')), '01/06/2026');
assert.strictEqual(formatDate('2028-02-29'), '29/02/2028');
const xml = buildWTOXML(build([row()]));
assert.match(xml, /<f_aa_pararthmatos>0000<\/f_aa_pararthmatos>/);
assert.match(xml, /<f_eponymo>Α&amp;Β<\/f_eponymo>/);
assert.strictEqual(one.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0].f_eponymo, 'Α&Β');
assert.ok(!JSON.stringify(one).includes('"f_type":"ΑΔΕΙΑ"'));
assert.ok(!JSON.stringify(one).includes('"f_type":"ΑΣΘΕΝΕΙΑ"'));

const parityRows = [row(), row({ hmeromhnia: '2026-06-02', apologistiko_biblio: false })];
const oldXmlSelected = parityRows.filter((item) => item.apologistiko_biblio === true);
const parityProjection = build(parityRows);
assert.strictEqual(oldXmlSelected.length, 1);
assert.strictEqual(parityProjection.employees.length, 1);
assert.strictEqual(parityProjection.employees[0].f_date, '01/06/2026');
const juneRows = juneFixtures.flatMap((fixture) => fixture.rows);
assert.strictEqual(juneRows.length, 28);
assert.strictEqual(juneRows.filter((item) => item.apologistiko_biblio === true).length, 19);
assert.strictEqual(selectWtoDailySourceRows(juneRows).length, 19);

assert.throws(() => build([row()], { employees: [{ ...employees[0], afm: '' }] }), (e) => code(e) === 'INVALID_WTODAILY_AFM');
assert.throws(() => build([row()], { employees: [{ ...employees[0], onoma: '' }] }), (e) => code(e) === 'INVALID_WTODAILY_NAME');
assert.throws(() => build([row()], { branch: '123456' }), (e) => code(e) === 'INVALID_WTODAILY_BRANCH');
assert.throws(() => build([row()], { comments: 'x'.repeat(201) }), (e) => code(e) === 'INVALID_WTODAILY_COMMENTS');
assert.throws(() => build([row({ apo_ora_01_apologistika: '25:00' })]), (e) => code(e) === 'INVALID_WTODAILY_TIME');
assert.throws(() => build([row({ kathgoria_ergasias_apologistika: '12345678901' })]), (e) => code(e) === 'UNSUPPORTED_WTODAILY_TYPE');
assert.throws(() => build([row({ kathgoria_ergasias_apologistika: 'UNKNOWN' })]), (e) => code(e) === 'UNSUPPORTED_WTODAILY_TYPE');
assert.throws(() => build([row({ apo_ora_01_apologistika: '', eos_ora_01_apologistika: '' })]),
    (e) => code(e) === 'WTODAILY_WORK_INTERVAL_REQUIRED');
assert.throws(() => build([row({ apo_ora_01_apologistika: '08:00', eos_ora_01_apologistika: '' })]),
    (e) => code(e) === 'INCOMPLETE_WTODAILY_APOLOGISTIKO_INTERVAL');
assert.throws(() => build([row({ apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
    cards_apo_ora_01: '08:00', cards_eos_ora_01: '' })]),
    (e) => code(e) === 'INCOMPLETE_WTODAILY_CARD_INTERVAL');
assert.throws(() => build([row({ kathgoria_ergasias_apologistika: 'ΤΗΛ',
    apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
    cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00' })]),
    (e) => code(e) === 'WTODAILY_TELEWORK_INTERVAL_REQUIRED');

const representative = payloadFor([
    row({ hmeromhnia: '2026-06-01', cards_apo_ora_01: '08:05', cards_eos_ora_01: '16:03' }),
    row({ hmeromhnia: '2026-06-02', apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
        cards_apo_ora_01: '08:05', cards_eos_ora_01: '16:03' }),
    row({ hmeromhnia: '2026-06-03', kathgoria_ergasias_apologistika: 'ΑΝ',
        apo_ora_01_apologistika: 'stale', eos_ora_01_apologistika: '' }),
    row({ hmeromhnia: '2026-06-04', kathgoria_ergasias_apologistika: 'ΜΕ',
        cards_apo_ora_01: 'stale', cards_eos_ora_01: '' }),
    row({ hmeromhnia: '2026-06-05', kathgoria_ergasias_apologistika: 'ΤΗΛ',
        apo_ora_01_apologistika: '09:00', eos_ora_01_apologistika: '17:00' })
]);
assert.deepStrictEqual(representative, { WTOS: { WTO: [{ f_aa_pararthmatos: '0000',
    f_rel_protocol: '', f_rel_date: '', f_comments: '', f_from_date: '01/06/2026',
    f_to_date: '30/06/2026', Ergazomenoi: { ErgazomenoiWTO: [
        { f_afm: '123456789', f_eponymo: 'Α&Β', f_onoma: 'ΑΝΝΑ', f_date: '01/06/2026',
            ErgazomenosAnalytics: { ErgazomenosWTOAnalytics: [{ f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' }] } },
        { f_afm: '123456789', f_eponymo: 'Α&Β', f_onoma: 'ΑΝΝΑ', f_date: '02/06/2026',
            ErgazomenosAnalytics: { ErgazomenosWTOAnalytics: [{ f_type: 'ΕΡΓ', f_from: '08:05', f_to: '16:03' }] } },
        { f_afm: '123456789', f_eponymo: 'Α&Β', f_onoma: 'ΑΝΝΑ', f_date: '03/06/2026',
            ErgazomenosAnalytics: { ErgazomenosWTOAnalytics: [{ f_type: 'ΑΝ', f_from: '', f_to: '' }] } },
        { f_afm: '123456789', f_eponymo: 'Α&Β', f_onoma: 'ΑΝΝΑ', f_date: '04/06/2026',
            ErgazomenosAnalytics: { ErgazomenosWTOAnalytics: [{ f_type: 'ΜΕ', f_from: '', f_to: '' }] } },
        { f_afm: '123456789', f_eponymo: 'Α&Β', f_onoma: 'ΑΝΝΑ', f_date: '05/06/2026',
            ErgazomenosAnalytics: { ErgazomenosWTOAnalytics: [{ f_type: 'ΤΗΛ', f_from: '09:00', f_to: '17:00' }] } }
    ] } }] } });
assert.deepStrictEqual(representative.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO.map((employee) => ({
    date: employee.f_date,
    analytics: employee.ErgazomenosAnalytics.ErgazomenosWTOAnalytics
})), [
    { date: '01/06/2026', analytics: [{ f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' }] },
    { date: '02/06/2026', analytics: [{ f_type: 'ΕΡΓ', f_from: '08:05', f_to: '16:03' }] },
    { date: '03/06/2026', analytics: [{ f_type: 'ΑΝ', f_from: '', f_to: '' }] },
    { date: '04/06/2026', analytics: [{ f_type: 'ΜΕ', f_from: '', f_to: '' }] },
    { date: '05/06/2026', analytics: [{ f_type: 'ΤΗΛ', f_from: '09:00', f_to: '17:00' }] }
]);

console.log('WTODailyA authoritative projection tests passed');
