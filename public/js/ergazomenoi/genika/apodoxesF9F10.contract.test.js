const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ejs = require('ejs');
const Decimal = require('decimal.js');
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
    assert.ok(source.includes('isManualOromisthioEqualToLegalAtDisplayPrecision'));
    assert.ok(source.includes('const legalValues = getManualLegalWageValues();'));
    assert.ok(source.includes('pragmatikoHmeromisthioValue = legalValues.hmeromisthio;'));
    assert.ok(source.includes('pragmatikosMisthosValue = legalValues.misthos;'));
    assert.ok(source.includes('const existingExtraRow = findExistingExtraApodoxesRow();'));
    assert.ok(source.includes('setManualExtraAmountToRow(existingExtraRow, new Decimal(0));'));
    assert.ok(source.includes('await calculateTotal();'));
}

assert.ok(addScript.includes('clearManualExtraApodoxesSnapshot();'));

function extractFunction(source, functionName) {
    const start = source.indexOf(`function ${functionName}(`);
    assert.notStrictEqual(start, -1, `missing function ${functionName}`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let i = bodyStart; i < source.length; i++) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, i + 1);
    }
    throw new Error(`unterminated function ${functionName}`);
}

function runManualHelpersContract(source) {
    const elements = new Map();
    const makeAmount = (id, value) => ({ id, value });
    const extraSelect = {
        id: 'stoixeio_symbashs_01',
        value: '0099',
        selectedOptions: [
            { textContent: 'EXTRA ΑΠΟΔΟΧΕΣ ΔΥΝΑΜΕΝΕΣ ΝΑ ΑΝΑΙΡΕΘΟΥΝ' }
        ]
    };
    elements.set(extraSelect.id, extraSelect);
    elements.set('poso_symbashs_01', makeAmount('poso_symbashs_01', '0.00'));
    elements.set(
        'poso_symbashs_basei_oron_ergasias_01',
        makeAmount('poso_symbashs_basei_oron_ergasias_01', '240.55')
    );

    const context = {
        Decimal,
        currentValues: {
            poso_symbashs_01: '0',
            poso_symbashs_basei_oron_ergasias_01: '240.55'
        },
        document: { getElementById: (id) => elements.get(id) || null },
        getEffectiveRowCount: () => 2,
        MANUAL_EXTRA_APODOXES_TEXT: 'EXTRA ΑΠΟΔΟΧΕΣ ΔΥΝΑΜΕΝΕΣ ΝΑ ΑΝΑΙΡΕΘΟΥΝ',
        formatForDisplay: (value, decimals) => new Decimal(value).toFixed(decimals)
    };
    vm.createContext(context);
    vm.runInContext(
        [
            extractFunction(source, 'normalizeGreekSearchText'),
            extractFunction(source, 'isManualOromisthioEqualToLegalAtDisplayPrecision'),
            extractFunction(source, 'findExistingExtraApodoxesRow'),
            extractFunction(source, 'setManualExtraAmountToRow')
        ].join('\n'),
        context
    );

    assert.strictEqual(
        context.isManualOromisthioEqualToLegalAtDisplayPrecision(
            new Decimal('7.0567'),
            new Decimal('7.05672')
        ),
        true
    );
    assert.strictEqual(context.findExistingExtraApodoxesRow(), '01');
    context.setManualExtraAmountToRow('01', new Decimal(0));
    assert.strictEqual(elements.get('poso_symbashs_01').value, '0.00');
    assert.strictEqual(elements.get('poso_symbashs_basei_oron_ergasias_01').value, '0.00');
    assert.strictEqual(context.currentValues.poso_symbashs_01, '0');
    assert.strictEqual(context.currentValues.poso_symbashs_basei_oron_ergasias_01, '0');

    extraSelect.value = '';
    extraSelect.selectedOptions = [];
    assert.strictEqual(context.findExistingExtraApodoxesRow(), null);
}

runManualHelpersContract(addScript);
runManualHelpersContract(editScript);

for (const source of [addScript, editScript]) {
    const canonicalBranch = source.indexOf('if (isCanonicalLegalReset)');
    const fullTimeFormula = source.indexOf('} else if (isFullTime)', canonicalBranch);
    const noExtraBranch = source.indexOf('if (diafora.lte(0))', canonicalBranch);
    const createExtraRow = source.indexOf(
        'findExistingOrFirstEmptyExtraRow(extraItem.value)',
        noExtraBranch
    );
    assert.ok(canonicalBranch > -1 && fullTimeFormula > canonicalBranch);
    assert.ok(noExtraBranch > fullTimeFormula && createExtraRow > noExtraBranch);
    assert.ok(
        source.slice(noExtraBranch, createExtraRow).includes('findExistingExtraApodoxesRow()')
    );
    assert.ok(
        !source
            .slice(noExtraBranch, createExtraRow)
            .includes('findExistingOrFirstEmptyExtraRow(')
    );
    assert.ok(source.includes('pragmatikoHmeromisthioValue = neoOromisthio.div('));
    assert.ok(source.includes('pragmatikosMisthosValue = neoOromisthio.times('));
    assert.ok(source.includes('setManualExtraAmountToRow(targetRow, diafora);'));
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
