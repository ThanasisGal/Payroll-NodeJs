// Pure provenance classifier. Labels alone are never sufficient to convert HR leave.

const LEAVE_PROVENANCE = Object.freeze({
    AUTO_CALCULATED_LEAVE: 'AUTO_CALCULATED_LEAVE',
    HR_DECLARED_LEAVE: 'HR_DECLARED_LEAVE',
    NONE: 'NONE'
});

function truthy(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function text(value) {
    return String(value ?? '').trim();
}

function number(value) {
    if (value === null || value === undefined || text(value) === '') return 0;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
}

function classifyLeaveProvenance(row = {}) {
    const hasBaseLeaveMarker =
        truthy(row.adeia) ||
        text(row.kathgoria_adeias) !== '' ||
        (number(row.ores_apoysias) ?? 0) > 0 ||
        truthy(row.hr_declared_leave);

    if (hasBaseLeaveMarker) return LEAVE_PROVENANCE.HR_DECLARED_LEAVE;

    const autoCalculatedSignature =
        text(row.kathgoria_ergasias) === 'ΕΡΓ' &&
        (number(row.ores_ergasias) ?? 0) > 0 &&
        number(row.cards_ores_ergasias) === 0 &&
        truthy(row.adeia_apologistika) &&
        text(row.kathgoria_adeias_apologistika) === 'ΑΔΑΛ' &&
        ['', 'ΑΔΕΙΑ'].includes(text(row.kathgoria_ergasias_apologistika)) &&
        !truthy(row.repo_apologistika) &&
        !truthy(row.astheneia) &&
        !truthy(row.astheneia_apologistika);

    return autoCalculatedSignature
        ? LEAVE_PROVENANCE.AUTO_CALCULATED_LEAVE
        : LEAVE_PROVENANCE.NONE;
}

module.exports = { LEAVE_PROVENANCE, classifyLeaveProvenance };
