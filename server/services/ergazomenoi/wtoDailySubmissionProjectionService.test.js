'use strict';

const assert = require('assert');
const fs = require('fs');
const { buildCanonicalApologistikosRows, buildReportFromCanonical } =
    require('./apologistikosPinakasControlReportService');
const { buildWtoDailySubmissionProjection, buildWTODayilyAPayload,
    flattenCanonicalControlFacts, flattenWtoDailyPayloadFacts,
    assertWtoDailyControlPayloadParity } = require('./wtoDailySubmissionProjectionService');
const { buildWTOXML } = require('../../utils/xmlGenerators/wto_v1Generator');

const employee = { kodikos: '0030', afm: '123456789', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΑΝΝΑ' };
const raw = (overrides = {}) => ({ _id: 'source-1', ypokatasthma: '0001', kodikos: '0030',
    hmeromhnia: '2026-08-05', apologistiko_biblio: true,
    kathgoria_ergasias_apologistika: 'ΕΡΓ', apo_ora_01_apologistika: '08:00',
    eos_ora_01_apologistika: '16:00', ...overrides });
const canonical = (rows) => buildCanonicalApologistikosRows({ rows, employees: [employee] });
const projection = (canonicalRows) => buildWtoDailySubmissionProjection({ canonicalRows,
    branch: '0001', periodStart: '2026-08-01', periodEnd: '2026-08-31' });
const payload = (rows) => buildWTODayilyAPayload(projection(canonical(rows)));
const analytics = (document, index = 0) => document.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[index]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics;

// 1. Η γραμμή ελέγχου 0030/05-08/ΕΡΓ/08:00-16:00 δίνει ακριβώς το ίδιο REST fact.
const oneCanonical = canonical([raw()]);
const oneReport = buildReportFromCanonical({ canonicalRows: oneCanonical,
    criteria: { ypokatasthma: '0001', startIso: '2026-08-01', endIso: '2026-08-31' } });
assert.strictEqual(oneReport.rows[0].kodikos, '0030');
assert.strictEqual(oneReport.rows[0].hmeromhnia, '05/08/2026');
assert.strictEqual(oneReport.rows[0].category, 'ΕΡΓ');
assert.strictEqual(oneReport.rows[0].zeugos1, '08:00 – 16:00');
assert.deepStrictEqual(analytics(payload([raw()])), [
    { f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' }
]);

// 2. Δύο canonical intervals παράγουν ακριβώς δύο analytics.
assert.deepStrictEqual(analytics(payload([raw({ apo_ora_02_apologistika: '18:00',
    eos_ora_02_apologistika: '20:00' })])), [
    { f_type: 'ΕΡΓ', f_from: '08:00', f_to: '16:00' },
    { f_type: 'ΕΡΓ', f_from: '18:00', f_to: '20:00' }
]);

// 3-5. ΑΝ/ΜΕ με κενές ώρες και ΤΗΛ με ακριβώς τα canonical intervals.
for (const category of ['ΑΝ', 'ΜΕ']) {
    assert.deepStrictEqual(analytics(payload([raw({ kathgoria_ergasias_apologistika: category,
        apo_ora_01_apologistika: 'stale', eos_ora_01_apologistika: '' })])), [
        { f_type: category, f_from: '', f_to: '' }
    ]);
}
assert.deepStrictEqual(analytics(payload([raw({ kathgoria_ergasias_apologistika: 'ΤΗΛ',
    apo_ora_01_apologistika: '09:15', eos_ora_01_apologistika: '17:15' })])), [
    { f_type: 'ΤΗΛ', f_from: '09:15', f_to: '17:15' }
]);

// 6. ΕΡΓ χωρίς canonical interval αποτυγχάνει κλειστά.
assert.throws(() => payload([raw({ apo_ora_01_apologistika: '', eos_ora_01_apologistika: '' })]),
    (error) => error.code === 'WTODAILY_CONTROL_INTERVAL_REQUIRED' &&
        error.details.employee_code === '0030' && error.details.source_record_id === 'source-1');

// 7. Η μη υποστηριζόμενη κατηγορία δεν εξαφανίζεται.
assert.throws(() => payload([raw({ kathgoria_ergasias_apologistika: 'ΑΔΕΙΑ' })]),
    (error) => error.code === 'WTODAILY_CONTROL_CATEGORY_UNSUPPORTED' &&
        error.details.employee_code === '0030' && error.details.date === '2026-08-05' &&
        error.details.source_record_id === 'source-1' && error.details.category === 'ΑΔΕΙΑ');

// 8. Τα cards_* δεν είναι μέρος του canonical fact και δεν λειτουργούν ως fallback.
assert.throws(() => payload([raw({ apo_ora_01_apologistika: '', eos_ora_01_apologistika: '',
    cards_apo_ora_01: '08:05', cards_eos_ora_01: '16:03' })]),
    (error) => error.code === 'WTODAILY_CONTROL_INTERVAL_REQUIRED');

// 9. Ακριβής ισότητα flattened control/payload facts και αναλυτικό diff σε απόκλιση.
const parityCanonical = canonical([raw({ apo_ora_02_apologistika: '18:00', eos_ora_02_apologistika: '20:00' })]);
const parityPayload = buildWTODayilyAPayload(projection(parityCanonical));
assert.deepStrictEqual(flattenCanonicalControlFacts(parityCanonical), flattenWtoDailyPayloadFacts(parityPayload));
assert.strictEqual(assertWtoDailyControlPayloadParity(parityCanonical, parityPayload).valid, true);
const altered = JSON.parse(JSON.stringify(parityPayload));
altered.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics[0].f_from = '08:01';
assert.throws(() => assertWtoDailyControlPayloadParity(parityCanonical, altered),
    (error) => error.code === 'WTODAILY_CONTROL_PAYLOAD_PARITY_MISMATCH' &&
        error.details.control_only.length === 1 && error.details.payload_only.length === 1);

// Η category υπολογίζεται μία φορά με το δηλωμένο fallback μόνο στην canonical layer.
assert.strictEqual(canonical([raw({ kathgoria_ergasias_apologistika: ' ',
    kathgoria_ergasias: 'τηλ' })])[0].category, 'ΤΗΛ');

const xml = buildWTOXML(projection(oneCanonical));
assert.match(xml, /<f_type>ΕΡΓ<\/f_type>/);
assert.match(xml, /<f_from>08:00<\/f_from>/);
assert.match(xml, /<f_to>16:00<\/f_to>/);

const generatorSource = fs.readFileSync(require.resolve('../../utils/xmlGenerators/wto_v1Generator'),
    'utf8');
assert.match(generatorSource, /filterEligibleApologistikosSource\(\{ rows: validRows,/);
assert.match(generatorSource, /WTODAILY_EMPLOYEE_ELIGIBILITY_SOURCE_REQUIRED/);
assert.ok(!generatorSource.includes('afora_daneismo_ergazomenoy === true'));

console.log('WTODailyA shared canonical control projection tests passed');
