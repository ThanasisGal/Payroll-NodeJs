'use strict';

const assert = require('assert');
const PostingModel = require('../../models/apasxoliseisCorrectivePayrollPosting');
const BalanceModel = require('../../models/apasxoliseisCorrectivePayrollBalance');
const { roundMoney, calculateCorrectivePostingAmounts, nextFreePayrollSequence, resolveEmployeeTypeGrossDelta } =
    require('./apasxoliseisCorrectivePayrollPostingService');

let amount = calculateCorrectivePostingAmounts({ grossDelta: 100, openBalance: 0, withholdingRatePercent: 0 });
assert.strictEqual(amount.payable_now, 100); assert.strictEqual(amount.withholding_amount, 0);
amount = calculateCorrectivePostingAmounts({ grossDelta: 100, openBalance: 0, withholdingRatePercent: 20 });
assert.strictEqual(amount.withholding_amount, 20); assert.strictEqual(amount.payable_now, 80);
amount = calculateCorrectivePostingAmounts({ grossDelta: 100, openBalance: 30, withholdingRatePercent: 20 });
assert.strictEqual(amount.offset_applied, 30); assert.strictEqual(amount.remaining_after_offset, 70);
assert.strictEqual(amount.withholding_amount, 14); assert.strictEqual(amount.payable_now, 56);
amount = calculateCorrectivePostingAmounts({ grossDelta: 20, openBalance: 30, withholdingRatePercent: 20 });
assert.strictEqual(amount.offset_applied, 20); assert.strictEqual(amount.withholding_amount, 0);
assert.strictEqual(amount.next_open_balance, 10);
amount = calculateCorrectivePostingAmounts({ grossDelta: -44.445, openBalance: 10, withholdingRatePercent: 50 });
assert.strictEqual(amount.gross_corrective_delta, -44.45); assert.strictEqual(amount.payable_now, 0);
assert.strictEqual(amount.withholding_amount, 0); assert.strictEqual(amount.carry_forward_created, 44.45);
assert.strictEqual(amount.next_open_balance, 54.45);
amount = calculateCorrectivePostingAmounts({ grossDelta: 0, openBalance: 10, withholdingRatePercent: 25 });
assert.strictEqual(amount.offset_applied, 0); assert.strictEqual(amount.payable_now, 0);
assert.strictEqual(nextFreePayrollSequence(['1', '2', '3'], ['2']), '4');
assert.strictEqual(nextFreePayrollSequence(['1', '2', '3', '4', '5', '6', '7', '8'], ['8']), '9');
assert.throws(() => nextFreePayrollSequence(['1','2','3','4','5','6','7','8','9'], ['9']),
    (error) => error.code === 'CORRECTIVE_PAYROLL_SEQUENCE_EXHAUSTED');
assert.throws(() => nextFreePayrollSequence(['1', '8', '9'], ['8']),
    (error) => error.code === 'CORRECTIVE_PAYROLL_SEQUENCE_EXHAUSTED');
assert.throws(() => nextFreePayrollSequence(['1', '9'], ['9']),
    (error) => error.code === 'CORRECTIVE_PAYROLL_SEQUENCE_EXHAUSTED');
assert.strictEqual(roundMoney(10.005), 10.01); assert.strictEqual(roundMoney(10.004), 10);
assert.strictEqual(roundMoney(-10.005), -10.01);
const twoEmployees = { monetary_by_employee_and_type: [
    { employee_kodikos: 'A', typos_apodoxon: '01', gross_corrective_delta: 123.456 },
    { employee_kodikos: 'B', typos_apodoxon: '01', gross_corrective_delta: -77.777 }
] };
assert.strictEqual(resolveEmployeeTypeGrossDelta(twoEmployees, 'A', '01'), 123.46);
assert.strictEqual(resolveEmployeeTypeGrossDelta(twoEmployees, 'B', '01'), -77.78);
assert.throws(() => resolveEmployeeTypeGrossDelta(twoEmployees, 'A', '02'),
    (error) => error.code === 'CORRECTIVE_PAYROLL_MONETARY_DELTA_NOT_DETERMINISTIC');
assert.strictEqual(PostingModel.schema.options.autoIndex, false); assert.strictEqual(PostingModel.schema.options.autoCreate, false);
assert.strictEqual(BalanceModel.schema.options.autoIndex, false); assert.strictEqual(BalanceModel.schema.options.autoCreate, false);
assert.ok(PostingModel.schema.indexes().some(([, options]) => options.name === 'unique_corrective_payroll_posting_business_key'));
assert.ok(BalanceModel.schema.indexes().some(([, options]) => options.name === 'unique_corrective_payroll_balance_scope'));
assert.strictEqual(PostingModel.schema.path('typos_apodoxon').options.immutable, true);
assert.strictEqual(PostingModel.schema.path('corrective_aa_misthodosias').options.immutable, true);
console.log('corrective payroll posting money/allocation/schema contracts: PASS');
