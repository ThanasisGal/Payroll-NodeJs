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
    { clearOverlappingLegal = true } = {}
) {
    const update = clearOverlappingLegal
        ? Object.fromEntries(OVERLAPPING_LEGAL_FIELDS.map((field) => [field, 0]))
        : {};
    return {
        ...update,
        ores_paranomhs_yperorias_apologistika: Number(classified.normal || 0),
        ores_paranomhs_yperorias_nyxtas_apologistika: Number(classified.night || 0),
        ores_paranomhs_yperorias_argion_apologistika: Number(classified.holiday || 0),
        ores_paranomhs_yperorias_argion_nyxtas_apologistika: Number(
            classified.holidayNight || 0
        )
    };
}

module.exports = {
    OVERLAPPING_LEGAL_FIELDS,
    buildWeeklyIllegalOvertimePersistenceMapping
};
