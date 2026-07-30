const assert = require('assert');
const {
    CompanyUpdateValidationError,
    normalizeOptionalDate,
    normalizeOptionalNumber,
    normalizeObjectIdArray,
    normalizeCompanyUpdatePayload
} = require('./companyUpdateNormalization');

const USER_A = '507f191e810c19729de860ea';
const USER_B = '507f1f77bcf86cd799439011';

assert.strictEqual(normalizeOptionalDate('', 'date'), null);
assert.strictEqual(normalizeOptionalDate(undefined, 'date'), null);
assert.strictEqual(normalizeOptionalDate('2026-07-30', 'date').toISOString(), '2026-07-30T00:00:00.000Z');
assert.throws(
    () => normalizeOptionalDate('2026-02-30', 'hmnia_katatheshs_ta'),
    (error) =>
        error instanceof CompanyUpdateValidationError &&
        error.fieldName === 'hmnia_katatheshs_ta'
);
assert.strictEqual(normalizeOptionalNumber('', 'ores_ta'), null);
assert.strictEqual(normalizeOptionalNumber('12.5', 'ores_ta'), 12.5);

const users = normalizeObjectIdArray([USER_A, '', USER_A, USER_B], 'selectedUsers');
assert.deepStrictEqual(users.map(String), [USER_A, USER_B]);
assert.throws(
    () => normalizeObjectIdArray([], 'selectedUsers'),
    (error) => error.code === 'COMPANY_USERS_REQUIRED'
);

const payload = normalizeCompanyUpdatePayload({
    selectedUsers: [USER_A],
    hmeromhnia_payshs_polyetias_apo: '',
    hmeromhnia_payshs_polyetias_eos: '',
    hmnia_katatheshs_ta: '',
    isxyei_eos_ta: '',
    hmnia_katatheshs_ia: '',
    isxyei_eos_ia: '',
    daneismos_epa_apo_em_erg: '',
    daneismos_epa_eos_em_erg: ''
});
assert.strictEqual(payload.company.hmeromhnia_payshs_polyetias_apo, null);
assert.strictEqual(payload.company.hmeromhnia_payshs_polyetias_eos, null);
assert.strictEqual(Object.hasOwn(payload.company, 'sfragida'), false);
assert.deepStrictEqual(payload.relatedOperations, []);

const inactiveRelated = normalizeCompanyUpdatePayload({
    selectedUsers: [USER_A],
    kod_ta: '',
    hmnia_katatheshs_ta: 'not-a-date',
    kod_ia: '',
    hmnia_katatheshs_ia: 'not-a-date',
    kod_em_erg: '',
    daneismos_epa_apo_em_erg: 'not-a-date'
});
assert.deepStrictEqual(inactiveRelated.relatedOperations, []);

for (const [codeField, dateField] of [
    ['kod_ta', 'hmnia_katatheshs_ta'],
    ['kod_ia', 'hmnia_katatheshs_ia'],
    ['kod_em_erg', 'daneismos_epa_apo_em_erg']
]) {
    assert.throws(
        () =>
            normalizeCompanyUpdatePayload({
                selectedUsers: [USER_A],
                [codeField]: 'ACTIVE',
                [dateField]: 'not-a-date'
            }),
        (error) => error.code === 'COMPANY_UPDATE_VALIDATION_ERROR' && error.fieldName === dateField
    );
}

console.log('PASS company update normalization');
