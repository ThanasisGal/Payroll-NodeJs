const COMPANY_FREEZE_DATE_FIELDS = Object.freeze([
    'hmeromhnia_payshs_polyetias_apo',
    'hmeromhnia_payshs_polyetias_eos'
]);

function formatDateOnlyForInput(value) {
    if (value === null || value === undefined || value === '') return '';

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toISOString().slice(0, 10);
}

function presentCompanyForEdit(company) {
    const presented = { ...company };
    for (const field of COMPANY_FREEZE_DATE_FIELDS) {
        presented[field] = formatDateOnlyForInput(company?.[field]);
    }
    return presented;
}

module.exports = {
    COMPANY_FREEZE_DATE_FIELDS,
    formatDateOnlyForInput,
    presentCompanyForEdit
};
