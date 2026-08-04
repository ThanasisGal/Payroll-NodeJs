const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const {
    ErgazomenoiModel,
    IstorikoProslhpseonAllagonModel
} = require('../../../../server/models/ergazomenoi');

const root = path.resolve(__dirname, '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const editView = read('views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section2/apodoxes.ejs');
const addView = read('views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section2/apodoxes.ejs');
const editScript = read('public/js/ergazomenoi/genika/editStoixeiaSymbaseon.js');
const addScript = read('public/js/ergazomenoi/genika/addStoixeiaSymbaseon.js');
const controller = read('server/controllers/ergazomenoi/ergazomenoiController.js');
const shortcutLabel = 'F9: Τροποποίηση Πραγματικού Ωρομισθίου / F10: Οριστικοποίηση';

assert.ok(editView.includes(shortcutLabel));
assert.ok(addView.includes(shortcutLabel));

const renderedStored = ejs.render(editView, {
    ergazomenoiData: {
        pragmatikoOromisthio: 15,
        pragmatikoHmeromisthio: 100,
        pragmatikosMisthos: 2500,
        nomimoOromisthio: 6.072,
        nomimoHmeromisthio: 40.48,
        nomimosMisthos: 1012,
        synolo_symbashs: 1012,
        synolo_symbashs_basei_oron_ergasias: 2500
    },
    companyData: {}
});
assert.ok(renderedStored.includes('value="15.0000"'));
assert.ok(renderedStored.includes('value="100.0000"'));
assert.ok(renderedStored.includes('value="2500.00"'));

const renderedZero = ejs.render(editView, {
    ergazomenoiData: {
        pragmatikoOromisthio: 0,
        pragmatikoHmeromisthio: 0,
        pragmatikosMisthos: 0,
        nomimoOromisthio: 6.072,
        nomimoHmeromisthio: 40.48,
        nomimosMisthos: 1012,
        synolo_symbashs: 1012,
        synolo_symbashs_basei_oron_ergasias: 1012
    },
    companyData: {}
});
assert.ok(renderedZero.includes('value="0.0000"'));

const renderedFallback = ejs.render(editView, {
    ergazomenoiData: {
        pragmatikoOromisthio: null,
        pragmatikoHmeromisthio: '',
        pragmatikosMisthos: undefined,
        nomimoOromisthio: 6.072,
        nomimoHmeromisthio: 40.48,
        nomimosMisthos: 1012,
        synolo_symbashs: 1012,
        synolo_symbashs_basei_oron_ergasias: 1012
    },
    companyData: {}
});
assert.ok(renderedFallback.includes('value="6.0720"'));
assert.ok(renderedFallback.includes('value="40.4800"'));
assert.ok(renderedFallback.includes('value="1012.00"'));

for (const source of [editScript, addScript]) {
    assert.ok(source.includes("event.key === 'F9'"));
    assert.ok(source.includes("event.key === 'F10'"));
    assert.ok(source.includes('event.preventDefault()'));
    assert.ok(source.includes('__manualOromisthioEditorBound'));
    assert.ok(source.includes('__manualOromisthioKeyboardBound'));
    assert.ok(source.includes('_TOTAL_EXTRA_APODOXES'));
    assert.ok(source.includes('findExistingOrFirstEmptyExtraRow'));
}

for (const field of ['pragmatikosMisthos', 'pragmatikoHmeromisthio', 'pragmatikoOromisthio']) {
    assert.ok(controller.includes(`formData.${field}`));
}

for (const Model of [ErgazomenoiModel, IstorikoProslhpseonAllagonModel]) {
    const document = new Model({
        pragmatikoOromisthio: '15.0000',
        pragmatikoHmeromisthio: '100.0000',
        pragmatikosMisthos: '2500.00',
        stoixeio_symbashs_01: '0099',
        poso_symbashs_basei_oron_ergasias_01: '1488.00'
    });
    assert.strictEqual(document.pragmatikoOromisthio, 15);
    assert.strictEqual(document.pragmatikoHmeromisthio, 100);
    assert.strictEqual(document.pragmatikosMisthos, 2500);
    assert.strictEqual(document.poso_symbashs_basei_oron_ergasias_01, 1488);
}

console.log('apodoxes F9/F10 add/edit contract tests passed');
