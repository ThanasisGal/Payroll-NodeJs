'use strict';
const { fixture, historyId } = require('./employeeProfileTransactionStore');

// An exact, separately identified duplicate of an existing dated document.
// Never use adjacent periods with equal pay as proof of redundancy.
function redundantHistoryFixture(index = 1) {
    const input = fixture();
    input.history.push({ ...structuredClone(input.history[index]),
        _id: historyId('employee', 7), aa_eggrafhs: '0004' });
    return input;
}
module.exports = { redundantHistoryFixture };
