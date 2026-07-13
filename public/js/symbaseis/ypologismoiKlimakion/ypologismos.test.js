const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Decimal = require('decimal.js');
const math = require('mathjs');

const productionFile = path.join(__dirname, 'ypologismos.js');
const productionSource = fs.readFileSync(productionFile, 'utf8');

const context = vm.createContext({
    console,
    Decimal,
    math,
    window: {},
    document: {
        addEventListener() {},
        getElementById() {
            return null;
        },
        querySelector() {
            return null;
        }
    },
    Swal: {},
    setTimeout,
    clearTimeout
});

vm.runInContext(productionSource, context, { filename: productionFile });

const calculate = context.dynamicCalculation;
const sortItems = context.getDeterministicallySortedItems;

assert.equal(typeof calculate, 'function', 'dynamicCalculation must be loaded from production');
assert.equal(typeof sortItems, 'function', 'deterministic sort helper must be loaded from production');

const formula = '(poso(0001) + poso(0002)) * 10 / 100';
const scope0001 = '000200010001';
const scope0006 = '000200010006';

function computedRow(scope, code, poso, klimakio = '03') {
    return {
        afora_thn_symbash_kathgoria_eidikothta: scope,
        kodikos_stoixeioy: code,
        klimakio,
        poso
    };
}

function localData(scope, first = 1030, second = 11.2) {
    return [
        { kodikos: '0001', poso: first, pososto: 0, poso_pososto: 1 },
        { kodikos: '0002', poso: second, pososto: 0, poso_pososto: 1 },
        {
            kodikos: '0003',
            poso: 0,
            pososto: 10,
            poso_pososto: 0,
            afora_thn_symbash_kathgoria_eidikothta: scope
        }
    ];
}

function calculateForScope(scope, data = localData(scope), expression = formula) {
    return calculate(data, data[2], expression, 1, 3);
}

const tests = [];

function test(name, run) {
    tests.push({ name, run });
}

test('scope isolation uses 0006 values when 0001 rows are first', () => {
    context.window.dataForUpdate = [
        computedRow(scope0001, '0001', 1030),
        computedRow(scope0001, '0002', 5.6),
        computedRow(scope0006, '0001', 1030),
        computedRow(scope0006, '0002', 11.2)
    ];

    const result = calculateForScope(scope0006);
    assert.equal(result, 104.12);
    assert.notEqual(result, 103.56);
});

test('reversed scope order remains isolated in both directions', () => {
    context.window.dataForUpdate = [
        computedRow(scope0006, '0001', 1030),
        computedRow(scope0006, '0002', 11.2),
        computedRow(scope0001, '0001', 1030),
        computedRow(scope0001, '0002', 5.6)
    ];

    assert.equal(calculateForScope(scope0006), 104.12);
    assert.equal(calculateForScope(scope0001, localData(scope0001, 1030, 5.6)), 103.56);
});

test('same element and klimakio in another contract cannot contaminate', () => {
    context.window.dataForUpdate = [
        computedRow('000300010006', '0001', 900),
        computedRow('000300010006', '0002', 1),
        computedRow(scope0006, '0001', 1030),
        computedRow(scope0006, '0002', 11.2)
    ];

    assert.equal(calculateForScope(scope0006), 104.12);
});

test('same element and klimakio in another category cannot contaminate', () => {
    context.window.dataForUpdate = [
        computedRow('000200020006', '0001', 900),
        computedRow('000200020006', '0002', 1),
        computedRow(scope0006, '0001', 1030),
        computedRow(scope0006, '0002', 11.2)
    ];

    assert.equal(calculateForScope(scope0006), 104.12);
});

test('four-digit computed amount is not reinterpreted as an element code', () => {
    context.window.dataForUpdate = [
        computedRow(scope0006, '0001', 1030),
        computedRow(scope0006, '0002', 11.2)
    ];

    assert.equal(calculateForScope(scope0006), 104.12);
});

test('plain four-digit tokens retain static lookup semantics', () => {
    context.window.dataForUpdate = [];
    assert.equal(calculateForScope(scope0006, localData(scope0006), '(0001 + 0002) * 10 / 100'), 104.12);
});

test('poso token falls back only to current local data', () => {
    context.window.dataForUpdate = [
        computedRow(scope0001, '0001', 800),
        computedRow(scope0001, '0002', 2)
    ];

    assert.equal(calculateForScope(scope0006), 104.12);
});

test('production ordering helper returns 0001, 0002, 0003 without mutating input', () => {
    const input = [{ kodikos: '0003' }, { kodikos: '0001' }, { kodikos: '0002' }];
    const sorted = sortItems(input);

    assert.deepEqual(
        Array.from(sorted, (item) => item.kodikos),
        ['0001', '0002', '0003']
    );
    assert.deepEqual(
        input.map((item) => item.kodikos),
        ['0003', '0001', '0002']
    );
});

test('Decimal ROUND_HALF_UP returns Number 104.12 at two decimals', () => {
    context.window.dataForUpdate = [
        computedRow(scope0006, '0001', 1030),
        computedRow(scope0006, '0002', 11.2)
    ];

    const result = calculateForScope(scope0006);
    assert.equal(Decimal.rounding, Decimal.ROUND_HALF_UP);
    assert.equal(result, 104.12);
    assert.equal(typeof result, 'number');
});

test('repeated execution with identical fixtures is deterministic', () => {
    context.window.dataForUpdate = [
        computedRow(scope0001, '0001', 1030),
        computedRow(scope0001, '0002', 5.6),
        computedRow(scope0006, '0001', 1030),
        computedRow(scope0006, '0002', 11.2)
    ];

    const first = calculateForScope(scope0006);
    const second = calculateForScope(scope0006);
    assert.equal(first, 104.12);
    assert.equal(second, first);
});

let passed = 0;
for (const { name, run } of tests) {
    run();
    passed += 1;
    console.log(`PASS ${passed}: ${name}`);
}

console.log(`All ${passed} focused ypologismos tests passed.`);
