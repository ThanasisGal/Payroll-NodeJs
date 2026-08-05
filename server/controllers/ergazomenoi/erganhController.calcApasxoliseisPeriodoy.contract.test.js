const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');

function methodSource(name, nextName) {
    const startMarker = `static ${name} = async`;
    const endMarker = `static ${nextName} = async`;
    const start = controller.indexOf(startMarker);
    const end = controller.indexOf(endMarker, start);
    assert.notEqual(start, -1, `Missing controller method ${name}`);
    assert.notEqual(end, -1, `Missing following controller method ${nextName}`);
    return controller.slice(start, end);
}

test('calcApasxolhseisPeriodoy contains no Excel row references', () => {
    const source = methodSource(
        'calcApasxolhseisPeriodoy',
        'updateProdhlomenaOrariaReviewRecord'
    );

    assert.doesNotMatch(source, /\br\.getCell\s*\(/);
    assert.doesNotMatch(source, /\.getCell\s*\(/);
    assert.match(source, /ProdhlomenaOrariaModel\.find\(prodhlomenaQuery\)/);
});
