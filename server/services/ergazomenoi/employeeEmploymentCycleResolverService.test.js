'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
    STATUS,
    buildEmploymentCycles,
    resolveEmploymentCycleForDate,
    isDateWithinEmploymentCycles
} = require('./employeeEmploymentCycleResolverService');

const row = (
    id,
    hire,
    departure,
    effectiveFrom,
    aa
) => ({
    _id: id,
    hmeromhnia_proslhpshs: hire,
    hmeromhnia_apoxorhshs: departure,
    hmeromhnia_isxyos_oron_ergasias_apo:
        effectiveFrom || hire,
    aa_eggrafhs: aa || '0001'
});

test(
    'single current employee remains one open employment cycle',
    () => {
        const cycles = buildEmploymentCycles({
            currentEmployee: row(
                'employee',
                '2025-01-01',
                null
            )
        });

        assert.deepEqual(
            cycles.map(
                ({
                    cycle_no,
                    hire_date,
                    departure_date,
                    is_current_cycle
                }) => ({
                    cycle_no,
                    hire_date,
                    departure_date,
                    is_current_cycle
                })
            ),
            [
                {
                    cycle_no: 1,
                    hire_date: '2025-01-01',
                    departure_date: null,
                    is_current_cycle: true
                }
            ]
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2026-09-17',
                {
                    currentEmployee: row(
                        'employee',
                        '2025-01-01',
                        null
                    )
                }
            ).status,
            STATUS.EMPLOYED
        );
    }
);

test(
    'multiple profile versions with the same hire date collapse into one employment cycle',
    () => {
        const history = [
            row(
                'h1',
                '2025-01-01',
                null,
                '2025-01-01',
                '0001'
            ),
            row(
                'h2',
                '2025-01-01',
                '2026-07-31',
                '2026-04-01',
                '0002'
            )
        ];

        const cycles = buildEmploymentCycles({ history });

        assert.equal(cycles.length, 1);
        assert.equal(
            cycles[0].hire_date,
            '2025-01-01'
        );
        assert.equal(
            cycles[0].departure_date,
            '2026-07-31'
        );
        assert.deepEqual(
            cycles[0].history_ids,
            ['h1', 'h2']
        );
    }
);

test(
    'departure 31/07 and rehire 17/09 preserve both cycles and the inactive gap',
    () => {
        const history = [
            row(
                'old-1',
                '2025-01-01',
                null,
                '2025-01-01',
                '0001'
            ),
            row(
                'old-2',
                '2025-01-01',
                '2026-07-31',
                '2026-04-01',
                '0002'
            ),
            row(
                'rehire',
                '2026-09-17',
                null,
                '2026-09-17',
                '0003'
            )
        ];

        const currentEmployee = row(
            'employee',
            '2026-09-17',
            null,
            '2026-09-17'
        );

        const input = {
            currentEmployee,
            history
        };

        const cycles = buildEmploymentCycles(input);

        assert.deepEqual(
            cycles.map(
                ({
                    cycle_no,
                    hire_date,
                    departure_date
                }) => ({
                    cycle_no,
                    hire_date,
                    departure_date
                })
            ),
            [
                {
                    cycle_no: 1,
                    hire_date: '2025-01-01',
                    departure_date: '2026-07-31'
                },
                {
                    cycle_no: 2,
                    hire_date: '2026-09-17',
                    departure_date: null
                }
            ]
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2026-07-20',
                input
            ).status,
            STATUS.EMPLOYED
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2026-07-31',
                input
            ).status,
            STATUS.EMPLOYED
        );

        const gapStart =
            resolveEmploymentCycleForDate(
                '2026-08-01',
                input
            );

        assert.equal(
            gapStart.status,
            STATUS.BETWEEN_CYCLES
        );

        assert.equal(
            gapStart.previous_cycle.cycle_no,
            1
        );

        assert.equal(
            gapStart.next_cycle.cycle_no,
            2
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2026-09-16',
                input
            ).status,
            STATUS.BETWEEN_CYCLES
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2026-09-17',
                input
            ).status,
            STATUS.EMPLOYED
        );

        assert.equal(
            isDateWithinEmploymentCycles(
                '2026-08-20',
                input
            ),
            false
        );

        assert.equal(
            isDateWithinEmploymentCycles(
                '2026-09-20',
                input
            ),
            true
        );
    }
);

test(
    'unlimited hire-departure cycles resolve independently by date',
    () => {
        const history = [
            row(
                'c1',
                '2024-01-01',
                '2024-03-31',
                '2024-01-01',
                '0001'
            ),
            row(
                'c2',
                '2024-05-01',
                '2024-06-30',
                '2024-05-01',
                '0002'
            ),
            row(
                'c3',
                '2025-01-15',
                '2025-11-30',
                '2025-01-15',
                '0003'
            ),
            row(
                'c4',
                '2026-01-10',
                null,
                '2026-01-10',
                '0004'
            )
        ];

        const input = {
            currentEmployee: row(
                'employee',
                '2026-01-10',
                null
            ),
            history
        };

        const cycles = buildEmploymentCycles(input);

        assert.equal(cycles.length, 4);

        assert.equal(
            resolveEmploymentCycleForDate(
                '2024-02-15',
                input
            ).cycle.cycle_no,
            1
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2024-05-15',
                input
            ).cycle.cycle_no,
            2
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2025-08-01',
                input
            ).cycle.cycle_no,
            3
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2026-09-17',
                input
            ).cycle.cycle_no,
            4
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2024-04-15',
                input
            ).status,
            STATUS.BETWEEN_CYCLES
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2024-12-31',
                input
            ).status,
            STATUS.BETWEEN_CYCLES
        );
    }
);

test(
    'current employee is authoritative for its matching latest hire cycle',
    () => {
        const history = [
            row(
                'h1',
                '2026-09-17',
                '2026-12-31',
                '2026-09-17',
                '0001'
            )
        ];

        const currentEmployee = row(
            'employee',
            '2026-09-17',
            null,
            '2026-09-17'
        );

        const cycle = buildEmploymentCycles({
            currentEmployee,
            history
        })[0];

        assert.equal(
            cycle.departure_date,
            null
        );

        assert.equal(
            cycle.source,
            'CURRENT'
        );

        assert.equal(
            cycle.is_current_cycle,
            true
        );
    }
);

test(
    'invalid lifecycle data fails closed instead of inventing relationship boundaries',
    () => {
        assert.throws(
            () =>
                buildEmploymentCycles({
                    history: [
                        row(
                            'old',
                            '2025-01-01',
                            null
                        ),
                        row(
                            'new',
                            '2026-09-17',
                            null
                        )
                    ]
                }),
            (error) =>
                error.code ===
                'EMPLOYMENT_CYCLE_OPEN_BEFORE_NEXT_HIRE'
        );

        assert.throws(
            () =>
                buildEmploymentCycles({
                    history: [
                        row(
                            'old',
                            '2025-01-01',
                            '2026-09-17'
                        ),
                        row(
                            'new',
                            '2026-09-17',
                            null
                        )
                    ]
                }),
            (error) =>
                error.code ===
                'EMPLOYMENT_CYCLE_OVERLAP'
        );

        assert.throws(
            () =>
                buildEmploymentCycles({
                    history: [
                        row(
                            'bad',
                            '2026-09-17',
                            '2026-07-31'
                        )
                    ]
                }),
            (error) =>
                error.code ===
                'EMPLOYMENT_CYCLE_DEPARTURE_BEFORE_HIRE'
        );
    }
);

test(
    'dates outside all cycles get deterministic lifecycle status',
    () => {
        const history = [
            row(
                'old',
                '2025-01-01',
                '2025-12-31'
            )
        ];

        assert.equal(
            resolveEmploymentCycleForDate(
                '2024-12-31',
                { history }
            ).status,
            STATUS.BEFORE_FIRST_HIRE
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2026-01-01',
                { history }
            ).status,
            STATUS.AFTER_LAST_DEPARTURE
        );

        assert.equal(
            resolveEmploymentCycleForDate(
                '2026-01-01'
            ).status,
            STATUS.NO_EMPLOYMENT_HISTORY
        );

        assert.throws(
            () =>
                resolveEmploymentCycleForDate(
                    'bad-date',
                    { history }
                ),
            (error) =>
                error.code ===
                'EMPLOYMENT_CYCLE_INVALID_DATE'
        );
    }
);

