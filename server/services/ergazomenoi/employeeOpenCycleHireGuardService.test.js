'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ERROR_CODE, assertOpenCycleHireGuard } =
    require('./employeeOpenCycleHireGuardService');
const { profileError } = require('../../utils/ergazomenoi/employmentProfileMaintenance');

const currentOpen = {
    _id: 'employee',
    hmeromhnia_proslhpshs: '2026-04-01',
    hmeromhnia_apoxorhshs: null,
    hmeromhnia_lhxhs_symbashs: '2026-12-31',
    hmeromhnia_isxyos_oron_ergasias_eos: '2026-08-31',
    hmeromhnia_allaghs_orarioy_eos: '2026-04-07'
};
const openRow = {
    _id: 'open-row',
    hmeromhnia_proslhpshs: '2026-04-01',
    hmeromhnia_apoxorhshs: null,
    hmeromhnia_lhxhs_symbashs: '2026-12-31',
    hmeromhnia_isxyos_oron_ergasias_eos: '2026-08-31',
    hmeromhnia_allaghs_orarioy_eos: '2026-04-07'
};

test('open-cycle invariant never treats work, schedule or contract end as departure', () => {
    assert.throws(() => assertOpenCycleHireGuard({
        currentBefore: currentOpen,
        historyBefore: [openRow],
        currentAfter: { ...currentOpen, hmeromhnia_proslhpshs: '2026-09-15' },
        historyAfter: [openRow, { ...openRow, _id: 'new-row',
            hmeromhnia_proslhpshs: '2026-09-15', afora_proslhpsh: true }]
    }), error => error.code === ERROR_CODE);
});

test('open-cycle invariant allows canonical correction of an old explicitly closed cycle', () => {
    const old = { _id: 'old-row', hmeromhnia_proslhpshs: '2025-01-01',
        hmeromhnia_apoxorhshs: '2025-12-31' };
    assert.doesNotThrow(() => assertOpenCycleHireGuard({
        currentBefore: currentOpen,
        historyBefore: [old, openRow],
        currentAfter: currentOpen,
        historyAfter: [{ ...old, hmeromhnia_proslhpshs: '2025-01-02' }, openRow]
    }));
});

test('open-cycle invariant accepts a new hire boundary only when latest cycle was already departed', () => {
    const closedCurrent = { ...currentOpen, hmeromhnia_apoxorhshs: '2026-08-31' };
    const closedRow = { ...openRow, hmeromhnia_apoxorhshs: '2026-08-31' };
    assert.doesNotThrow(() => assertOpenCycleHireGuard({
        currentBefore: closedCurrent,
        historyBefore: [closedRow],
        currentAfter: { ...closedCurrent, hmeromhnia_proslhpshs: '2026-09-15',
            hmeromhnia_apoxorhshs: null },
        historyAfter: [closedRow, { ...openRow, _id: 'new-row',
            hmeromhnia_proslhpshs: '2026-09-15', afora_proslhpsh: true }]
    }));
});

test('open-cycle invariant exposes only the actionable Greek message', () => {
    const response = { status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return this; } };
    profileError(response, Object.assign(new Error(ERROR_CODE), {
        code: ERROR_CODE, statusCode: 409
    }));
    assert.equal(response.statusCode, 409);
    assert.equal(response.payload.reason, ERROR_CODE);
    assert.equal(response.payload.message,
        'Δεν επιτρέπεται αλλαγή ή νέα καταχώριση πρόσληψης όσο η τρέχουσα εργασιακή σχέση δεν έχει ημερομηνία αποχώρησης. Καταχωρήστε πρώτα την αποχώρηση και στη συνέχεια χρησιμοποιήστε τη διαδικασία Επαναπρόσληψης.');
    assert.equal(JSON.stringify(response.payload).includes('open-row'), false);
    assert.equal(Object.hasOwn(response.payload, 'stack'), false);
});
