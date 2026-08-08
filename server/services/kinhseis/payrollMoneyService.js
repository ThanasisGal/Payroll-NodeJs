'use strict';

function roundPayrollMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Number(number.toFixed(2));
}

module.exports = { roundPayrollMoney };
