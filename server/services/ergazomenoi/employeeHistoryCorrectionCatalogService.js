'use strict';

const { KpkEfkaModel } = require('../../models/stathera_arxeia');
const { SymbaseisModel, KathgoriesSymbaseonModel,
    EidikothtesAnaKathgoriaSymbaseonModel } = require('../../models/symbaseis');
const { normalizedCatalog } = require('./employeeHistoryCorrectionFieldRegistryService');

async function loadEmployeeHistoryCorrectionCatalogs({ session = null,
    kpkModel = KpkEfkaModel, contractTypeModel = SymbaseisModel,
    contractCategoryModel = KathgoriesSymbaseonModel,
    contractSpecialtyModel = EidikothtesAnaKathgoriaSymbaseonModel } = {}) {
    const load = async model => {
        let query = model.find({}, { _id: 0, kodikos: 1, perigrafh: 1 }).sort({ kodikos: 1 });
        if (session && typeof query.session === 'function') query = query.session(session);
        if (typeof query.lean === 'function') query = query.lean();
        return query;
    };
    const [kpkRows, contractTypes, contractCategories, contractSpecialties] = await Promise.all([
        load(kpkModel), load(contractTypeModel), load(contractCategoryModel),
        load(contractSpecialtyModel)
    ]);
    const catalog = rows => Object.freeze(normalizedCatalog(rows).map(item => Object.freeze({
        code: item.value, label: item.label.replace(`${item.value} — `, '')
    })));
    return Object.freeze({
        KPK_EFKA: catalog(kpkRows),
        CONTRACT_TYPE: catalog(contractTypes),
        CONTRACT_CATEGORY: catalog(contractCategories),
        CONTRACT_SPECIALTY: catalog(contractSpecialties)
    });
}

module.exports = { loadEmployeeHistoryCorrectionCatalogs };
