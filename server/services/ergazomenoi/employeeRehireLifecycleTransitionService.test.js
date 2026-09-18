'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    buildEmployeeRehireTransition
} = require('./employeeRehireLifecycleTransitionService');

function oldClosedEmployee(overrides = {}) {
    return {
        _id: 'employee-1',
        kodikos: '0001',
        ypokatasthma: '0000',
        energos: false,
        archived: false,
        hmeromhnia_proslhpshs: '2025-01-01',
        hmeromhnia_apoxorhshs: '2026-07-31',
        ...overrides
    };
}

function oldClosedHistory() {
    return [
        {
            _id: 'history-1',
            hmeromhnia_proslhpshs: '2025-01-01',
            hmeromhnia_apoxorhshs: '2026-07-31',
            hmeromhnia_isxyos_oron_ergasias_apo: '2025-01-01',
            aa_eggrafhs: '0001'
        }
    ];
}

test('31/07 departure and 17/09 rehire build a new independent cycle transition', () => {
    const current = oldClosedEmployee();
    const history = oldClosedHistory();

    const transition = buildEmployeeRehireTransition({
        currentEmployee: current,
        history,
        rehireDate: '2026-09-17'
    });

    assert.equal(transition.cycle_no, 2);
    assert.equal(transition.effective_from, '2026-09-17');
    assert.equal(transition.previous_cycle.hire_date, '2025-01-01');
    assert.equal(transition.previous_cycle.departure_date, '2026-07-31');

    assert.equal(
        transition.employee_changes.hmeromhnia_proslhpshs,
        '2026-09-17'
    );
    assert.equal(
        transition.employee_changes.hmeromhnia_apoxorhshs,
        null
    );
    assert.equal(transition.employee_changes.energos, true);

    assert.equal(
        transition.employee_changes.hmeromhnia_allaghs_symbashs,
        '2026-09-17'
    );
    assert.equal(
        transition.employee_changes.hmeromhnia_allaghs_orarioy_apo,
        '2026-09-17'
    );
    assert.equal(
        transition.employee_changes.hmeromhnia_allaghs_orarioy_eos,
        null
    );
    assert.equal(
        transition.employee_changes.hmeromhnia_lhxhs_symbashs,
        null
    );

    assert.equal(
        transition.history_changes.hmeromhnia_proslhpshs,
        '2026-09-17'
    );
    assert.equal(
        transition.history_changes.hmeromhnia_apoxorhshs,
        null
    );
    assert.equal(transition.history_changes.afora_proslhpsh, true);

    // Pure planning: the old employee/history objects stay untouched.
    assert.equal(current.hmeromhnia_proslhpshs, '2025-01-01');
    assert.equal(current.hmeromhnia_apoxorhshs, '2026-07-31');
    assert.equal(history[0].hmeromhnia_apoxorhshs, '2026-07-31');
});

test('stale old lifecycle values cannot override the authoritative rehire identity', () => {
    const transition = buildEmployeeRehireTransition({
        currentEmployee: oldClosedEmployee(),
        history: oldClosedHistory(),
        rehireDate: '2026-09-17',
        employeeChanges: {
            hmeromhnia_proslhpshs: '2025-01-01',
            hmeromhnia_apoxorhshs: '2026-07-31',
            energos: false
        },
        historyChanges: {
            hmeromhnia_proslhpshs: '2025-01-01',
            hmeromhnia_apoxorhshs: '2026-07-31',
            afora_proslhpsh: false
        }
    });

    assert.equal(transition.employee_changes.hmeromhnia_proslhpshs, '2026-09-17');
    assert.equal(transition.employee_changes.hmeromhnia_apoxorhshs, null);
    assert.equal(transition.employee_changes.energos, true);
    assert.equal(transition.history_changes.hmeromhnia_proslhpshs, '2026-09-17');
    assert.equal(transition.history_changes.hmeromhnia_apoxorhshs, null);
    assert.equal(transition.history_changes.afora_proslhpsh, true);
});

test('new relationship can explicitly supply new contract and schedule boundaries', () => {
    const transition = buildEmployeeRehireTransition({
        currentEmployee: oldClosedEmployee(),
        history: oldClosedHistory(),
        rehireDate: '2026-09-17',
        employeeChanges: {
            hmeromhnia_allaghs_symbashs: '2026-09-17',
            hmeromhnia_lhxhs_symbashs: '2027-03-31',
            hmeromhnia_allaghs_orarioy_apo: '2026-09-20',
            hmeromhnia_allaghs_orarioy_eos: '2027-03-31'
        },
        historyChanges: {
            hmeromhnia_lhxhs_symbashs: '2027-03-31',
            hmeromhnia_allaghs_orarioy_eos: '2027-03-31'
        }
    });

    assert.equal(
        transition.employee_changes.hmeromhnia_allaghs_orarioy_apo,
        '2026-09-20'
    );
    assert.equal(
        transition.employee_changes.hmeromhnia_lhxhs_symbashs,
        '2027-03-31'
    );
    assert.equal(
        transition.history_changes.hmeromhnia_allaghs_orarioy_apo,
        '2026-09-20'
    );
    assert.equal(
        transition.history_changes.hmeromhnia_lhxhs_symbashs,
        '2027-03-31'
    );
});

test('rehire requires a closed current employment relationship', () => {
    assert.throws(
        () => buildEmployeeRehireTransition({
            currentEmployee: oldClosedEmployee({
                hmeromhnia_apoxorhshs: null,
                energos: true
            }),
            history: [{
                _id: 'history-open',
                hmeromhnia_proslhpshs: '2025-01-01',
                hmeromhnia_apoxorhshs: null,
                hmeromhnia_isxyos_oron_ergasias_apo: '2025-01-01'
            }],
            rehireDate: '2026-09-17'
        }),
        (error) => error.code === 'EMPLOYEE_REHIRE_CURRENT_RELATIONSHIP_OPEN'
    );
});

test('rehire date must be strictly after the previous departure', () => {
    for (const rehireDate of ['2026-07-30', '2026-07-31']) {
        assert.throws(
            () => buildEmployeeRehireTransition({
                currentEmployee: oldClosedEmployee(),
                history: oldClosedHistory(),
                rehireDate
            }),
            (error) => error.code === 'EMPLOYEE_REHIRE_DATE_NOT_AFTER_DEPARTURE'
        );
    }
});

test('archived employee is not silently revived by rehire planning', () => {
    assert.throws(
        () => buildEmployeeRehireTransition({
            currentEmployee: oldClosedEmployee({ archived: true }),
            history: oldClosedHistory(),
            rehireDate: '2026-09-17'
        }),
        (error) => error.code === 'EMPLOYEE_REHIRE_ARCHIVED_EMPLOYEE'
    );
});

test('current master must represent the latest employment cycle', () => {
    assert.throws(
        () => buildEmployeeRehireTransition({
            currentEmployee: oldClosedEmployee({
                hmeromhnia_proslhpshs: '2025-01-01',
                hmeromhnia_apoxorhshs: '2025-12-31'
            }),
            history: [
                {
                    _id: 'cycle-1',
                    hmeromhnia_proslhpshs: '2025-01-01',
                    hmeromhnia_apoxorhshs: '2025-12-31',
                    hmeromhnia_isxyos_oron_ergasias_apo: '2025-01-01'
                },
                {
                    _id: 'cycle-2',
                    hmeromhnia_proslhpshs: '2026-02-01',
                    hmeromhnia_apoxorhshs: '2026-07-31',
                    hmeromhnia_isxyos_oron_ergasias_apo: '2026-02-01'
                }
            ],
            rehireDate: '2026-09-17'
        }),
        (error) => error.code === 'EMPLOYEE_REHIRE_CURRENT_CYCLE_MISMATCH'
    );
});

test('unlimited prior cycles increment without overwriting earlier relationships', () => {
    const current = oldClosedEmployee({
        hmeromhnia_proslhpshs: '2026-04-01',
        hmeromhnia_apoxorhshs: '2026-08-31'
    });
    const history = [
        {
            _id: 'c1',
            hmeromhnia_proslhpshs: '2024-01-01',
            hmeromhnia_apoxorhshs: '2024-06-30',
            hmeromhnia_isxyos_oron_ergasias_apo: '2024-01-01'
        },
        {
            _id: 'c2',
            hmeromhnia_proslhpshs: '2024-09-01',
            hmeromhnia_apoxorhshs: '2025-03-31',
            hmeromhnia_isxyos_oron_ergasias_apo: '2024-09-01'
        },
        {
            _id: 'c3',
            hmeromhnia_proslhpshs: '2026-04-01',
            hmeromhnia_apoxorhshs: '2026-08-31',
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-04-01'
        }
    ];

    const transition = buildEmployeeRehireTransition({
        currentEmployee: current,
        history,
        rehireDate: '2026-10-01'
    });

    assert.equal(transition.cycle_no, 4);
    assert.equal(transition.cycles_before_rehire.length, 3);
    assert.equal(transition.previous_cycle.departure_date, '2026-08-31');
});

test('contract and schedule starts cannot precede the rehire date', () => {
    assert.throws(
        () => buildEmployeeRehireTransition({
            currentEmployee: oldClosedEmployee(),
            history: oldClosedHistory(),
            rehireDate: '2026-09-17',
            employeeChanges: {
                hmeromhnia_allaghs_symbashs: '2026-09-16'
            }
        }),
        (error) => error.code === 'EMPLOYEE_REHIRE_INVALID_CONTRACT_START'
    );

    assert.throws(
        () => buildEmployeeRehireTransition({
            currentEmployee: oldClosedEmployee(),
            history: oldClosedHistory(),
            rehireDate: '2026-09-17',
            employeeChanges: {
                hmeromhnia_allaghs_orarioy_apo: '2026-09-16'
            }
        }),
        (error) => error.code === 'EMPLOYEE_REHIRE_INVALID_SCHEDULE_START'
    );
});
