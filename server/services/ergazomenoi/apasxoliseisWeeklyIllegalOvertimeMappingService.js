const OVERLAPPING_LEGAL_FIELDS = Object.freeze([
    'ores_yperergasias_apologistika',
    'ores_yperergasias_nyxtas_apologistika',
    'ores_yperergasias_argion_apologistika',
    'ores_yperergasias_argion_nyxtas_apologistika',
    'ores_nominhs_yperorias_apologistika',
    'ores_nominhs_yperorias_nyxtas_apologistika',
    'ores_nominhs_yperorias_argion_apologistika',
    'ores_nominhs_yperorias_argion_nyxtas_apologistika'
]);

function buildWeeklyIllegalOvertimePersistenceMapping(
    classified = {},
    { clearOverlappingLegal = true, authoritativeTotalHours = null } = {}
) {
    const update = clearOverlappingLegal
        ? Object.fromEntries(OVERLAPPING_LEGAL_FIELDS.map((field) => [field, 0]))
        : {};
    const illegal = {
        ores_paranomhs_yperorias_apologistika: Number(classified.normal || 0),
        ores_paranomhs_yperorias_nyxtas_apologistika: Number(classified.night || 0),
        ores_paranomhs_yperorias_argion_apologistika: Number(classified.holiday || 0),
        ores_paranomhs_yperorias_argion_nyxtas_apologistika: Number(
            classified.holidayNight || 0
        )
    };
    const hasAuthoritativeTotal = authoritativeTotalHours !== null &&
        authoritativeTotalHours !== undefined &&
        String(authoritativeTotalHours).trim() !== '';
    const target = Number(authoritativeTotalHours);
    if (hasAuthoritativeTotal && Number.isFinite(target) && target >= 0) {
        const fields = Object.keys(illegal);
        const sum = fields.reduce((total, field) => total + illegal[field], 0);
        const residual = Number((target - sum).toFixed(2));
        if (residual !== 0) {
            const reconciliationField = [...fields].sort((left, right) =>
                illegal[right] - illegal[left] || left.localeCompare(right))[0];
            illegal[reconciliationField] = Number(
                Math.max(illegal[reconciliationField] + residual, 0).toFixed(2)
            );
        }
    }
    return {
        ...update,
        ...illegal
    };
}

module.exports = {
    OVERLAPPING_LEGAL_FIELDS,
    buildWeeklyIllegalOvertimePersistenceMapping
};
