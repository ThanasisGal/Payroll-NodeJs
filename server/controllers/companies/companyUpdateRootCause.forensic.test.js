const assert = require('assert');
const fixture = require('./fixtures/company-0004.sanitized.json');
const { CompaniesModel } = require('../../models/companies');
const {
    TexnikosAsfaleiasModel,
    IatrosErgasiasModel,
    LogisthsModel,
    EmmesosErgodothsModel
} = require('../../models/stathera_arxeia');
const {
    normalizeCompanyUpdatePayload
} = require('../../services/companies/companyUpdateNormalization');

function castRawUpdate(Model, update) {
    const query = Model.findOneAndUpdate({}, { $set: update });
    return query._castUpdate(query.getUpdate()).$set;
}

const exactSanitizedPlan = normalizeCompanyUpdatePayload(fixture);
assert.strictEqual(exactSanitizedPlan.relatedOperations.length, 1);
assert.deepStrictEqual(
    exactSanitizedPlan.relatedOperations.map(({ modelKey, stage, kod }) => ({
        modelKey,
        stage,
        kod
    })),
    [{ modelKey: 'logisths', stage: 'LOGISTHS_UPSERT', kod: '1' }]
);
castRawUpdate(CompaniesModel, exactSanitizedPlan.company);
castRawUpdate(LogisthsModel, exactSanitizedPlan.relatedOperations[0].payload);

const emptyCompanyDates = castRawUpdate(CompaniesModel, {
    hmeromhnia_payshs_polyetias_apo: '',
    hmeromhnia_payshs_polyetias_eos: ''
});
assert.strictEqual(emptyCompanyDates.hmeromhnia_payshs_polyetias_apo, null);
assert.strictEqual(emptyCompanyDates.hmeromhnia_payshs_polyetias_eos, null);

for (const [Model, field, stage] of [
    [CompaniesModel, 'hmeromhnia_payshs_polyetias_apo', 'COMPANY_BASE_UPDATE'],
    [TexnikosAsfaleiasModel, 'hmnia_katatheshs', 'TEXNIKOS_ASFALEIAS_UPSERT'],
    [IatrosErgasiasModel, 'isxyei_eos', 'IATROS_ERGASIAS_UPSERT'],
    [EmmesosErgodothsModel, 'daneismosApo', 'EMMESOS_ERGODOTHS_UPSERT']
]) {
    assert.throws(
        () => castRawUpdate(Model, { [field]: 'not-a-date' }),
        (error) => {
            assert.strictEqual(error.name, 'CastError');
            assert.strictEqual(error.path, field);
            assert.ok(stage);
            return true;
        }
    );
}

console.log('PASS sanitized company 0004 plan and synthetic Date CastError forensic coverage');
