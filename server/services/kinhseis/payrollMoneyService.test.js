'use strict';
const assert = require('assert');
const { roundPayrollMoney } = require('./payrollMoneyService');
assert.strictEqual(roundPayrollMoney(10.005), Number(Number(10.005).toFixed(2)));
assert.strictEqual(roundPayrollMoney(-10.005), Number(Number(-10.005).toFixed(2)));
assert.strictEqual(roundPayrollMoney(12.344), 12.34);
console.log('payroll money rounding parity: PASS');
