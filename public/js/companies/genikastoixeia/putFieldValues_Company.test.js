const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { companyUpdateServerMessage } = require('./putFieldValues_Company');

assert.strictEqual(
    companyUpdateServerMessage(
        { success: false, message: 'Μη έγκυρη τιμή στο πεδίο hmnia_katatheshs_ta.' },
        400
    ),
    'Μη έγκυρη τιμή στο πεδίο hmnia_katatheshs_ta.'
);
assert.strictEqual(
    companyUpdateServerMessage({ success: false }, 500),
    'HTTP 500 / success=false'
);

const source = fs.readFileSync(path.join(__dirname, 'putFieldValues_Company.js'), 'utf8');
assert.doesNotMatch(source, /\son[a-z]+\s*=/i);
assert.match(source, /input\.type === 'date'/);
assert.match(source, /\.filter\(Boolean\)/);
assert.match(source, /new Set\(/);

console.log('PASS company edit frontend normalization, safe message and CSP contract');
