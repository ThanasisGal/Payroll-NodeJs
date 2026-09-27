'use strict';

function twoDaySchedule(previousIntervals, currentIntervals, overrides = {}) {
    const formData = {
        hmeromhnia_01: '2026-09-27',
        kathgoria_ergasias_sthathera_01: 'ΕΡΓ',
        hmeromhnia_02: '2026-09-28',
        kathgoria_ergasias_sthathera_02: 'ΕΡΓ'
    };

    for (const [day, intervals] of [[1, previousIntervals], [2, currentIntervals]]) {
        const daySuffix = String(day).padStart(2, '0');
        for (let index = 1; index <= 3; index++) {
            const intervalSuffix = String(index).padStart(2, '0');
            const interval = intervals[index - 1] || {};
            formData[`apo_ora_${intervalSuffix}_${daySuffix}`] = interval.start || '';
            formData[`eos_ora_${intervalSuffix}_${daySuffix}`] = interval.end || '';
        }
    }

    return { ...formData, ...overrides };
}

const fixtures = Object.freeze([
    {
        name: 'ten-hour rest',
        formData: twoDaySchedule(
            [{ start: '14:00', end: '22:00' }],
            [{ start: '08:00', end: '16:00' }]
        ),
        expectedRestMinutes: [600]
    },
    {
        name: 'exact eleven-hour rest',
        formData: twoDaySchedule(
            [{ start: '14:00', end: '22:00' }],
            [{ start: '09:00', end: '17:00' }]
        ),
        expectedRestMinutes: []
    },
    {
        name: 'previous overnight interval',
        formData: twoDaySchedule(
            [{ start: '22:00', end: '06:00' }],
            [{ start: '08:00', end: '16:00' }]
        ),
        expectedRestMinutes: [120]
    },
    {
        name: 'multiple intervals use the final previous end',
        formData: twoDaySchedule(
            [
                { start: '14:00', end: '18:00' },
                { start: '19:00', end: '22:00' }
            ],
            [{ start: '08:00', end: '16:00' }]
        ),
        expectedRestMinutes: [600]
    },
    {
        name: 'intervening non-working day resets adjacency',
        formData: {
            ...twoDaySchedule(
                [{ start: '14:00', end: '22:00' }],
                []
            ),
            kathgoria_ergasias_sthathera_02: 'ΑΝ',
            hmeromhnia_03: '2026-09-29',
            kathgoria_ergasias_sthathera_03: 'ΕΡΓ',
            apo_ora_01_03: '08:00',
            eos_ora_01_03: '16:00'
        },
        expectedRestMinutes: []
    }
]);

module.exports = { fixtures, twoDaySchedule };
