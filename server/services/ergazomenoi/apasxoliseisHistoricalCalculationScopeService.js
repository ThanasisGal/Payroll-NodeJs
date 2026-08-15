'use strict';

function historicalCalculationScopeError() {
    const error = new Error(
        'Η ανακατασκευή εκπρόθεσμης περιόδου πρέπει να εκτελεστεί για ολόκληρο το παράρτημα, ' +
        'επειδή η ολοκλήρωση και τα fingerprints τηρούνται σε επίπεδο περιόδου.'
    );
    error.code = 'HISTORICAL_RECONSTRUCTION_REQUIRES_PERIOD_WIDE_SCOPE';
    error.statusCode = 409;
    return error;
}

function assertHistoricalCalculationPeriodWide({ periodControlState = {}, employeeCode = '' } = {}) {
    if (periodControlState.past_deadline === true && String(employeeCode || '').trim()) {
        throw historicalCalculationScopeError();
    }
    return true;
}

module.exports = { assertHistoricalCalculationPeriodWide, historicalCalculationScopeError };
