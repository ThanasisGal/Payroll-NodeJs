const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    extractForologikhKlimakaSuffix,
    buildForologikhKlimakaLookup
} = require('../../utils/ergazomenoi/forologikhKlimakaCode');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const employeeController = read('server/controllers/ergazomenoi/ergazomenoiController.js');
const taxController = read('server/controllers/Kinhseis/forosContoller.js');
const getKlimakiaForoy = taxController.slice(
    taxController.indexOf('static getKlimakiaForoy'),
    taxController.indexOf('static getEkptoshForoy')
);
const autoLoadTaxScale = read('public/js/ergazomenoi/genika/autoLoadTaxScale.js');
const payrollTax = read('public/js/kinhseis/ypologismoi/klimakiaForoy.js');

assert.deepStrictEqual(buildForologikhKlimakaLookup('0100', '2026'), {
    xrhsh: '2026',
    kodikos: '0100',
    suffix: '0100'
});
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
assert.strictEqual(extractForologikhKlimakaSuffix('20260100 - ΠΕΡΙΓΡΑΦΗ'), '0100');
assert.strictEqual(extractForologikhKlimakaSuffix('20260200 - ΠΕΡΙΓΡΑΦΗ'), '0200');

assert.strictEqual(
    (employeeController.match(
        /extractForologikhKlimakaSuffix\(formData\.forologikh_klimaka\) \|\| ''/g
    ) || []).length,
    2,
    'ADD and EDIT must both store only the four-character suffix'
);
assert.ok(employeeController.includes('req.session?.yearInUse'));
assert.ok(employeeController.includes('xrhsh: resolved.xrhsh'));
assert.ok(employeeController.includes('kodikos: resolved.kodikos'));
assert.ok(!employeeController.includes('const { xrhsh, kodikos } = req.body'));

assert.ok(autoLoadTaxScale.includes('const kodikos = rawValue || calcAge + calcChildren;'));
assert.ok(autoLoadTaxScale.includes('body: JSON.stringify({ kodikos })'));
assert.ok(autoLoadTaxScale.includes('createTaxScaleField.value = data.kodikos;'));
assert.ok(
    autoLoadTaxScale.includes(
        'forologikhKlimakaField.value = data.kodikos + " - " + data.taxScale.perigrafh;'
    )
);
assert.ok(autoLoadTaxScale.includes('fetchTaxScale(initialValue);'));
assert.ok(!autoLoadTaxScale.includes('xrhsh + calcAge + calcChildren'));

assert.ok(payrollTax.includes("params.set('forologikh_klimaka', forologikhKlimaka)"));
assert.ok(!payrollTax.includes('.slice(4, 8)'));
assert.ok(getKlimakiaForoy.includes('req.session?.yearInUse'));
assert.ok(getKlimakiaForoy.includes('filter.kodikos_klimakas = resolved.kodikos'));
assert.ok(!getKlimakiaForoy.includes('req.query?.xrhsh'));

console.log('forologikh klimaka current-year integration contract passed');
