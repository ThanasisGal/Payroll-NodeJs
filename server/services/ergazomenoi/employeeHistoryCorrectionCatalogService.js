'use strict';

const { KpkEfkaModel, EidikesKathgoriesModel } = require('../../models/stathera_arxeia');
const { SymbaseisModel, KathgoriesSymbaseonModel,
    EidikothtesAnaKathgoriaSymbaseonModel, StoixeiaSymbaseonModel } = require('../../models/symbaseis');
const { contractDescriptionCatalog, PARENT_FIELDS } = require('./employeeContractDescriptionService');
const { normalizedCatalog } = require('./employeeHistoryCorrectionFieldRegistryService');

async function loadEmployeeHistoryCorrectionCatalogs({ session = null,
    kpkModel = KpkEfkaModel, specialCategoryModel = EidikesKathgoriesModel, contractTypeModel = SymbaseisModel,
    contractCategoryModel = KathgoriesSymbaseonModel,
    contractSpecialtyModel = EidikothtesAnaKathgoriaSymbaseonModel,
    contractItemModel = StoixeiaSymbaseonModel } = {}) {
    const load = async (model, catalog) => {
        const parent = PARENT_FIELDS[catalog];
        let query = model.find({}, { _id: 0, kodikos: 1, perigrafh: 1, ...(parent ? { [parent]: 1 } : {}) }).sort({ kodikos: 1 });
        if (session && typeof query.session === 'function') query = query.session(session);
        if (typeof query.lean === 'function') query = query.lean();
        return query;
    };
    const [kpkRows, specialCategories, contractTypes, contractCategories, contractSpecialties, contractItems] = await Promise.all([
        load(kpkModel), load(specialCategoryModel), load(contractTypeModel), load(contractCategoryModel, 'CONTRACT_CATEGORY'),
        load(contractSpecialtyModel, 'CONTRACT_SPECIALTY'), load(contractItemModel, 'CONTRACT_ITEM')
    ]);
    const catalog = rows => Object.freeze(normalizedCatalog(rows).map(item => Object.freeze({
        code: item.value, label: item.label.replace(`${item.value} — `, '')
    })));
    return Object.freeze({
        KPK_EFKA: catalog(kpkRows),
        SPECIAL_EMPLOYEE_CATEGORY: catalog(specialCategories),
        CONTRACT_TYPE: contractDescriptionCatalog(contractTypes, 'CONTRACT_TYPE'),
        CONTRACT_CATEGORY: contractDescriptionCatalog(contractCategories, 'CONTRACT_CATEGORY'),
        CONTRACT_SPECIALTY: contractDescriptionCatalog(contractSpecialties, 'CONTRACT_SPECIALTY'),
        CONTRACT_ITEM: contractDescriptionCatalog(contractItems, 'CONTRACT_ITEM')
    });
}

module.exports = { loadEmployeeHistoryCorrectionCatalogs };
