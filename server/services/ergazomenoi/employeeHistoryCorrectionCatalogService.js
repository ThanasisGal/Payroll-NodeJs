'use strict';

const { KpkEfkaModel, EidikesKathgoriesModel } = require('../../models/stathera_arxeia');
const { SymbaseisModel, KathgoriesSymbaseonModel,
    EidikothtesAnaKathgoriaSymbaseonModel, StoixeiaSymbaseonModel } = require('../../models/symbaseis');
const { contractDescriptionCatalog, PARENT_FIELDS } = require('./employeeContractDescriptionService');
const { normalizedCatalog } = require('./employeeHistoryCorrectionFieldRegistryService');

async function loadEmployeeHistoryCorrectionCatalogs({ session = null, requiredCatalogs = null,
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
    const required = requiredCatalogs === null ? null : new Set(requiredCatalogs);
    const selected = (name, model) => required && !required.has(name) ? [] : load(model, name);
    const [kpkRows, specialCategories, contractTypes, contractCategories, contractSpecialties, contractItems] = await Promise.all([
        selected('KPK_EFKA', kpkModel), selected('SPECIAL_EMPLOYEE_CATEGORY', specialCategoryModel),
        selected('CONTRACT_TYPE', contractTypeModel), selected('CONTRACT_CATEGORY', contractCategoryModel),
        selected('CONTRACT_SPECIALTY', contractSpecialtyModel), selected('CONTRACT_ITEM', contractItemModel)
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
