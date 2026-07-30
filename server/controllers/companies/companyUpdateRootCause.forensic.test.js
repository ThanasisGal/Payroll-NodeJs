const assert = require('assert');
const { CompaniesModel } = require('../../models/companies');
const {
    TexnikosAsfaleiasModel,
    IatrosErgasiasModel,
    EmmesosErgodothsModel
} = require('../../models/stathera_arxeia');

function castRawUpdate(Model, update) {
    const query = Model.findOneAndUpdate({}, { $set: update });
    return query._castUpdate(query.getUpdate()).$set;
}

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

console.log('PASS raw company edit Date CastError forensic reproduction and stage map');
