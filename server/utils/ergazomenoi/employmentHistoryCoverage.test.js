'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { employeeHistoryCoverageGaps, assertVerifiedHistoryCoverageForDate } = require('./employmentHistoryCoverage');

function legacyPeriod() {
    const row = { _id: 'legacy-profile', hmeromhnia_proslhpshs: '2026-01-01',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-01-01',
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-03-31',
        afora_allagh_oron_ergasias: true };
    return { currentEmployee: { ...row, _id: 'employee' }, historyRows: [row] };
}

test('an explicit legacy work-terms event supplies coverage without changing its recorded facts', () => {
    const input = legacyPeriod(), before = structuredClone(input);
    assert.deepEqual(employeeHistoryCoverageGaps(input), []);
    assert.deepEqual(input, before);
    assert.doesNotThrow(() => assertVerifiedHistoryCoverageForDate('2026-02-15',
        input.historyRows, input.currentEmployee));
});

test('explicit validity alone cannot certify a non-terms row without a recorded hire event', () => {
    const input = legacyPeriod();
    input.historyRows[0].afora_allagh_oron_ergasias = false;
    const before = structuredClone(input);
    assert.deepEqual(employeeHistoryCoverageGaps(input).map(({ from, to }) => [from, to]),
        [['2026-01-01', '2026-03-31']]);
    assert.throws(() => assertVerifiedHistoryCoverageForDate('2026-02-15',
        input.historyRows, input.currentEmployee), { code: 'EMPLOYEE_HISTORY_COVERAGE_REQUIRED' });
    assert.deepEqual(input, before);
});

test('explicit initial hire terms supply coverage even when the change-event flag is false', () => {
    const input = legacyPeriod();
    Object.assign(input.historyRows[0], { afora_allagh_oron_ergasias: false, afora_proslhpsh: true });
    assert.deepEqual(employeeHistoryCoverageGaps(input), []);
    assert.doesNotThrow(() => assertVerifiedHistoryCoverageForDate('2026-02-15',
        input.historyRows, input.currentEmployee));
});

test('legacy validity cannot cover a real internal gap', () => {
    const input = legacyPeriod();
    input.historyRows[0].hmeromhnia_isxyos_oron_ergasias_eos = '2026-01-31';
    input.historyRows.push({ ...input.historyRows[0], _id: 'later-profile',
        hmeromhnia_isxyos_oron_ergasias_apo: '2026-03-01',
        hmeromhnia_isxyos_oron_ergasias_eos: '2026-03-31' });
    assert.deepEqual(employeeHistoryCoverageGaps(input).map(({ from, to }) => [from, to]),
        [['2026-02-01', '2026-02-28']]);
});

for (const status of ['WITHDRAWN_ERRONEOUS', 'REDUNDANT_REFERENCED']) {
    test(`inactive legacy validity cannot supply coverage: ${status}`, () => {
        const input = legacyPeriod();
        input.historyRows[0].employment_history_canonical_status = status;
        assert.deepEqual(employeeHistoryCoverageGaps(input).map(({ from, to }) => [from, to]),
            [['2026-01-01', '2026-03-31']]);
    });
}

for (const start of [undefined, null, '', 'invalid-date']) {
    test(`schedule dates cannot replace missing or invalid explicit legacy validity: ${start}`, () => {
        const input = legacyPeriod();
        Object.assign(input.historyRows[0], { hmeromhnia_isxyos_oron_ergasias_apo: start,
            hmeromhnia_allaghs_orarioy_apo: '2026-01-01', hmeromhnia_allaghs_orarioy_eos: '2026-03-31' });
        assert.deepEqual(employeeHistoryCoverageGaps(input).map(({ from, to }) => [from, to]),
            [['2026-01-01', '2026-03-31']]);
    });
}

for (const version of [1, 2]) {
    test(`explicit non-terms rows with a schema version remain excluded: ${version}`, () => {
        const input = legacyPeriod();
        input.historyRows[0].employment_profile_schema_version = version;
        input.historyRows[0].afora_allagh_oron_ergasias = false;
        assert.deepEqual(employeeHistoryCoverageGaps(input).map(({ from, to }) => [from, to]),
            [['2026-01-01', '2026-03-31']]);
    });
}
