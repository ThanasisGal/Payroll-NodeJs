'use strict';

// The dropdowns store parent identities as concatenated, already normalized
// codes. Never invent missing parents or resolve a child by its code alone.
const text = value => String(value ?? '').trim();
function contractParentKey(...codes) {
    const parts = codes.map(text);
    return parts.every(Boolean) ? parts.join('') : '';
}
const PARENT_FIELDS = Object.freeze({
    CONTRACT_CATEGORY: 'afora_thn_symbash',
    CONTRACT_SPECIALTY: 'afora_thn_symbash_kathgoria',
    CONTRACT_ITEM: 'afora_thn_symbash_kathgoria_eidikothta'
});
function parentKeyForCatalog(catalog, row = {}) {
    if (catalog === 'CONTRACT_CATEGORY') return contractParentKey(row.symbash);
    if (catalog === 'CONTRACT_SPECIALTY') return contractParentKey(row.symbash, row.kathgoria_symbashs);
    if (catalog === 'CONTRACT_ITEM') return contractParentKey(row.symbash, row.kathgoria_symbashs, row.eidikothta_symbashs);
    return '';
}
function contractDescriptionCatalog(rows = [], catalog) {
    const parentField = PARENT_FIELDS[catalog];
    return Object.freeze(rows.filter(row => row && text(row.kodikos) && text(row.perigrafh) &&
        (!parentField || text(row[parentField]))).map(row => Object.freeze({
        code: text(row.kodikos), label: text(row.perigrafh),
        ...(parentField ? { [parentField]: text(row[parentField]) } : {})
    })));
}
function resolveContractDescription(catalogs, catalog, code, row = {}) {
    const parentField = PARENT_FIELDS[catalog];
    const parent = parentKeyForCatalog(catalog, row);
    if (!text(code) || (parentField && !parent)) return '';
    const matches = (catalogs[catalog] || []).filter(item => text(item.code) === text(code) &&
        (!parentField || text(item[parentField]) === parent));
    // Conflicting descriptions for the same full identity must not depend on
    // database ordering. Show the stored code until the catalog is corrected.
    const descriptions = new Set(matches.map(item => text(item.label)).filter(Boolean));
    return descriptions.size === 1 ? [...descriptions][0] : '';
}
function contractItemsForDisplay(row, describe, formatAmount) {
    const amount = value => value == null || text(value) === '' || Number(value) === 0 ? '' : formatAmount(value);
    return Array.from({ length: 15 }, (_, i) => {
        const index = String(i + 1).padStart(2, '0');
        const code = text(row[`stoixeio_symbashs_${index}`]);
        if (!code) return null;
        const description = describe(code, index);
        return { index, description: description ? `${code} - ${description}` : code,
            contractAmount: amount(row[`poso_symbashs_${index}`]),
            workTermsAmount: amount(row[`poso_symbashs_basei_oron_ergasias_${index}`]) };
    }).filter(Boolean);
}
module.exports = { contractParentKey, PARENT_FIELDS, parentKeyForCatalog,
    contractDescriptionCatalog, resolveContractDescription, contractItemsForDisplay };
