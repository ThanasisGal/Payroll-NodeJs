const assert = require('assert');
const {
    extractForologikhKlimakaSuffix,
    buildForologikhKlimakaLookup
} = require('./forologikhKlimakaCode');

assert.strictEqual(extractForologikhKlimakaSuffix('0100'), '0100');
assert.strictEqual(extractForologikhKlimakaSuffix('20260100'), '0100');
assert.strictEqual(
    extractForologikhKlimakaSuffix('20260100 - ΠΕΡΙΓΡΑΦΗ'),
    '0100'
);
assert.strictEqual(extractForologikhKlimakaSuffix('0100 - ΠΕΡΙΓΡΑΦΗ'), '0100');

assert.deepStrictEqual(buildForologikhKlimakaLookup('0100', '2027'), {
    xrhsh: '2027',
    kodikos: '0100',
    suffix: '0100'
});
assert.deepStrictEqual(buildForologikhKlimakaLookup('20260100', '2027'), {
    xrhsh: '2027',
    kodikos: '0100',
    suffix: '0100'
});

for (const invalid of ['', '100', '00100', '2026010', '202601000', 'invalid']) {
    assert.strictEqual(extractForologikhKlimakaSuffix(invalid), null);
}
assert.strictEqual(buildForologikhKlimakaLookup('0100', '27'), null);

console.log('forologikh klimaka code tests passed');
