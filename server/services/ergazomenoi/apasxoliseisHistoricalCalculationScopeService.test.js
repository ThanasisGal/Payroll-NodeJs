'use strict';

const assert = require('node:assert/strict');
const {
    assertHistoricalCalculationPeriodWide
} = require('./apasxoliseisHistoricalCalculationScopeService');

assert.equal(assertHistoricalCalculationPeriodWide({
    periodControlState: { effective_mode: 'NORMAL', past_deadline: false },
    employeeCode: '0014'
}), true);

for (const effective_mode of [
    'HISTORICAL_RECONSTRUCTION_REQUIRED',
    'HISTORICAL_RECONSTRUCTION_STALE',
    'HISTORICAL_RECONSTRUCTED'
]) {
    assert.throws(() => assertHistoricalCalculationPeriodWide({
        periodControlState: { effective_mode, past_deadline: true }, employeeCode: '0014'
    }), (error) => error.code === 'HISTORICAL_RECONSTRUCTION_REQUIRES_PERIOD_WIDE_SCOPE' &&
        error.statusCode === 409);
}

let completionCalls = 0;
assert.throws(() => {
    assertHistoricalCalculationPeriodWide({
        periodControlState: { effective_mode: 'HISTORICAL_RECONSTRUCTION_STALE', past_deadline: true },
        employeeCode: '0014'
    });
    completionCalls += 1;
});
assert.equal(completionCalls, 0);

assert.equal(assertHistoricalCalculationPeriodWide({
    periodControlState: { effective_mode: 'HISTORICAL_RECONSTRUCTION_STALE', past_deadline: true },
    employeeCode: ''
}), true);

console.log('historical calculation period-wide scope safety tests: PASS');
