'use strict';

const assert = require('assert');
const { buildEmploymentDailyCalculationUpdate } = require('./apasxoliseisEmploymentDailyCalculationAdapterService');
const calls = [];
const operation = (name, result) => (...args) => { calls.push({ name, args }); return typeof result === 'function' ? result(...args) : result; };
const operations = {
    normalizeZeroLengthCardPairs: operation('normalize', (row) => ({ ...row, normalized: true })),
    resolveCardPairVerification: operation('verify', { hasUnresolvedCardEvidence: false }),
    buildPartialVerifiedCardUpdate: operation('partial', { update: { partial: true } }),
    checkBrokenProgramVsBrokenCards: operation('broken-program-cards', {}),
    checkEarlyOrLateCard: operation('early-late', (_context, pair) => ({ [`pair_${pair}`]: pair })),
    checkContinuousVsBrokenCards: operation('continuous-broken', { continuous: true }),
    checkBrokenProgramVsContinuousCards: operation('broken-continuous', { broken_continuous: true }),
    checkNoDeclaredScheduleCards: operation('no-schedule', { no_schedule: true }),
    checkNightHours: operation('night', { night: 2 }),
    checkSundayHolidayHours: operation('sunday-holiday', { holiday: 1 }),
    checkRepoAdeiaAstheneiaApologistika: operation('repo-leave', { repo: false }),
    checkOresApoysias: operation('absence', { absence: 0 }),
    calculateAdditionalAndOverworkForDay: operation('overtime', { overwork: 3 }),
    sanitizeAppliedRepoTransferUpdate: operation('protection', ({ update }) => ({ sanitizedUpdate: update,
        diagnostics: ['PROTECTED'] }))
};
const expected = { pair_1: 1, pair_2: 2, pair_3: 3, continuous: true, broken_continuous: true,
    no_schedule: true, night: 2, holiday: 1, repo: false, absence: 0, overwork: 3 };
const normal = buildEmploymentDailyCalculationUpdate({ row: { _id: '1' }, effectiveEmployee: {},
    argiesDateSet: new Set(), weeklyState: {}, operations });
const corrective = buildEmploymentDailyCalculationUpdate({ row: { _id: '1' }, effectiveEmployee: {},
    argiesDateSet: new Set(), weeklyState: {}, operations });
assert.deepStrictEqual(normal.sanitizedUpdate, expected);
assert.deepStrictEqual(corrective.sanitizedUpdate, expected);
assert.deepStrictEqual(corrective.sanitizedUpdate, normal.sanitizedUpdate);
for (const required of ['normalize', 'verify', 'broken-program-cards', 'early-late', 'continuous-broken',
    'broken-continuous', 'no-schedule', 'night', 'sunday-holiday', 'repo-leave', 'absence', 'overtime', 'protection']) {
    assert.ok(calls.some((call) => call.name === required), required);
}
console.log('shared authoritative daily adapter characterization/parity: PASS');
