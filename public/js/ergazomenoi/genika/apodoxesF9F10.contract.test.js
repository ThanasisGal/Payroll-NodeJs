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
    assert.ok(source.includes('resolveManualPragmatikoOromisthio'));
    assert.ok(source.includes('calculateManualActualWages'));
    assert.ok(!source.includes('pragmatikoHmeromisthioValue = legalValues.hmeromisthio;'));
    assert.ok(!source.includes('pragmatikosMisthosValue = legalValues.misthos;'));
    assert.ok(source.includes('const existingExtraRow = findExistingExtraApodoxesRow();'));
    assert.ok(source.includes('setManualExtraAmountToRow(existingExtraRow, new Decimal(0));'));
    assert.ok(source.includes('await calculateTotal();'));
}

assert.ok(editScript.includes('const preserveManualDeviation = hasManualPragmatikoOromisthioDeviation();'));
assert.ok(editScript.includes('await recalculateActualWagesAfterLegalChange(preserveManualDeviation);'));
assert.ok(editScript.includes("if (typeof window.reCalculate === 'function')"));
assert.ok(editScript.includes('await window.reCalculate();'));
assert.ok(editScript.includes('const effectiveHourly = preserveManualDeviation'));
assert.ok(editScript.includes(': getNomimoOromisthioValue();'));
const editInterceptor = editScript.slice(editScript.indexOf(
    'function setupManualRecalcButtonInterceptor()'), editScript.indexOf(
    'function saveManualPragmatikoOromisthioSnapshot'));
assert.ok(editInterceptor.indexOf(
    'if (!_manualPragmatikoOromisthioActive || !_manualPragmatikoOromisthioSnapshot)') <
    editInterceptor.indexOf('event.preventDefault();'));

assert.ok(addScript.includes('clearManualExtraApodoxesSnapshot();'));

function extractFunction(source, functionName) {
    const functionStart = source.indexOf(`function ${functionName}(`);
    assert.notStrictEqual(functionStart, -1, `missing function ${functionName}`);
    const asyncPrefix = 'async ';
    const start = source.slice(functionStart - asyncPrefix.length, functionStart) === asyncPrefix
        ? functionStart - asyncPrefix.length
        : functionStart;
    const bodyStart = source.indexOf('{', functionStart);
    let depth = 0;
    for (let i = bodyStart; i < source.length; i++) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, i + 1);
    }
    throw new Error(`unterminated function ${functionName}`);
}

function runStoredActualWagesActivationContract() {
    const elements = {
        pragmatikoOromisthio: { value: '8.1650' },
        pragmatikoHmeromisthio: { value: '54.4336' },
        pragmatikosMisthos: { value: '1360.84' }
    };
    const context = {
        Decimal,
        _manualPragmatikoOromisthioActive: false,
        _manualPragmatikoOromisthioSnapshot: null,
        _storedActualWagesSnapshotCandidate: null,
        hasExtra: false,
        document: { getElementById: (id) => elements[id] || null },
        toDecimal: (value) => new Decimal(value || 0),
        formatForDisplay: (value, decimals) => new Decimal(value).toFixed(decimals),
        findExistingExtraApodoxesRow: () => context.hasExtra ? '01' : null,
        saveManualPragmatikoOromisthioSnapshot: (snapshot) => {
            context._manualPragmatikoOromisthioActive = true;
            context._manualPragmatikoOromisthioSnapshot = snapshot;
        }
    };
    vm.createContext(context);
    vm.runInContext([
        extractFunction(editScript, 'initializeStoredActualWagesSnapshot'),
        extractFunction(editScript, 'restoreManualPragmatikoOromisthioSnapshot'),
        extractFunction(editScript, 'activateStoredActualWagesSnapshotIfManualExtraExists'),
        extractFunction(editScript, 'clearManualPragmatikoOromisthioSnapshot')
    ].join('\n'), context);

    context.initializeStoredActualWagesSnapshot();
    assert.strictEqual(context._manualPragmatikoOromisthioActive, false);
    assert.strictEqual(context.activateStoredActualWagesSnapshotIfManualExtraExists(), false);
    assert.strictEqual(context._manualPragmatikoOromisthioActive, false);

    context.hasExtra = true;
    assert.strictEqual(context.activateStoredActualWagesSnapshotIfManualExtraExists(), true);
    assert.strictEqual(context._manualPragmatikoOromisthioActive, true);
    assert.ok(context._manualPragmatikoOromisthioSnapshot.oromisthio.eq('8.1650'));

    context.clearManualPragmatikoOromisthioSnapshot();
    assert.strictEqual(context._manualPragmatikoOromisthioActive, false);
    assert.strictEqual(context._manualPragmatikoOromisthioSnapshot, null);
    assert.strictEqual(context._storedActualWagesSnapshotCandidate, null);
}

runStoredActualWagesActivationContract();

const negativeComponentTotal = new Decimal('1360.84').minus('20.60');
assert.equal(negativeComponentTotal.toFixed(2), '1340.24');
assert.equal(negativeComponentTotal.div(25).toFixed(4), '53.6096');
assert.equal(negativeComponentTotal.div(25).times(6).div(40).toFixed(4), '8.0414');
assert.equal(new Decimal('1360.84').plus('20.60').toFixed(2), '1381.44');
assert.ok(!addScript.includes('initializeStoredActualWagesSnapshot()'));
assert.match(addScript, /let _manualPragmatikoOromisthioActive = false;/);

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
        window: {
            _ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS: new Decimal('166.6666666667'),
            _SYNTELESTHS_EBDOMADON_HMEROMISTHION: new Decimal('4.3333333333'),
            _SYNTELESTHS_EBDOMADON_MISTHOTON: new Decimal('4.3333333333')
        },
        toDecimal: (value) => (value instanceof Decimal ? value : new Decimal(value || 0)),
        getEffectiveRowCount: () => 2,
        MANUAL_EXTRA_APODOXES_TEXT: 'EXTRA ΑΠΟΔΟΧΕΣ ΔΥΝΑΜΕΝΕΣ ΝΑ ΑΝΑΙΡΕΘΟΥΝ',
        formatForDisplay: (value, decimals) => new Decimal(value).toFixed(decimals)
    };
    vm.createContext(context);
    vm.runInContext(
        [
            extractFunction(source, 'normalizeGreekSearchText'),
            extractFunction(source, 'isManualOromisthioEqualToLegalAtDisplayPrecision'),
            extractFunction(source, 'resolveManualPragmatikoOromisthio'),
            extractFunction(source, 'calculateManualActualWages'),
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
    const canonicalHourly = context.resolveManualPragmatikoOromisthio(
        new Decimal('7.0567'),
        new Decimal('7.05672')
    );
    assert.strictEqual(canonicalHourly.toString(), '7.05672');
    assert.strictEqual(canonicalHourly.toFixed(4), '7.0567');

    const canonicalWages = context.calculateManualActualWages(
        canonicalHourly,
        new Decimal(40),
        new Decimal(5),
        'Μ',
        false
    );
    assert.strictEqual(canonicalWages.hmeromisthio.toString(), '56.45376');
    assert.ok(canonicalWages.misthos.eq(canonicalHourly.times(40).times('4.3333333333')));
    assert.ok(!canonicalWages.hmeromisthio.eq(new Decimal('40.48')));
    assert.ok(!canonicalWages.misthos.eq(new Decimal('1012')));

    const manualHourly = context.resolveManualPragmatikoOromisthio(
        new Decimal('8.5000'),
        new Decimal('7.05672')
    );
    assert.strictEqual(manualHourly.toString(), '8.5');
    const manualWages = context.calculateManualActualWages(
        manualHourly,
        new Decimal(40),
        new Decimal(5),
        'Μ',
        false
    );
    assert.strictEqual(manualWages.hmeromisthio.toString(), '68');
    assert.ok(manualWages.misthos.eq(manualHourly.times(40).times('4.3333333333')));

    const returnedToLegalHourly = context.resolveManualPragmatikoOromisthio(
        manualHourly,
        new Decimal('7.05672')
    );
    assert.strictEqual(returnedToLegalHourly.toString(), '8.5');
    const resetToLegalHourly = context.resolveManualPragmatikoOromisthio(
        new Decimal('7.0567'),
        new Decimal('7.05672')
    );
    assert.strictEqual(resetToLegalHourly.toString(), '7.05672');
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

async function runEditLegalChangeContract() {
    const hourlyInput = { value: '7.0567' };
    let legalHourly = new Decimal('7.05672');
    let appliedHourly = null;
    const context = {
        Decimal,
        _manualPragmatikoOromisthioActive: true,
        _manualPragmatikoOromisthioSnapshot: {
            oromisthio: new Decimal('7.05672'),
            hmeromisthio: new Decimal('56.45376'),
            misthos: new Decimal('1223.164799990592')
        },
        document: {
            getElementById: (id) => (id === 'pragmatikoOromisthio' ? hourlyInput : null)
        },
        getNomimoOromisthioValue: () => legalHourly,
        isManualOromisthioEqualToLegalAtDisplayPrecision: (manual, legal) =>
            new Decimal(manual).toDecimalPlaces(4).eq(new Decimal(legal).toDecimalPlaces(4)),
        formatForDisplay: (value, decimals) => new Decimal(value).toFixed(decimals),
        applyManualPragmatikoOromisthio: async () => {
            appliedHourly = new Decimal(hourlyInput.value);
        }
    };
    vm.createContext(context);
    vm.runInContext(
        [
            extractFunction(editScript, 'hasManualPragmatikoOromisthioDeviation'),
            extractFunction(editScript, 'recalculateActualWagesAfterLegalChange')
        ].join('\n'),
        context
    );

    assert.strictEqual(context.hasManualPragmatikoOromisthioDeviation(), false);
    legalHourly = new Decimal('6.50004');
    await context.recalculateActualWagesAfterLegalChange(false);
    assert.strictEqual(hourlyInput.value, '6.5000');
    assert.ok(appliedHourly.eq('6.5'));

    context._manualPragmatikoOromisthioSnapshot.oromisthio = new Decimal('8.5000');
    legalHourly = new Decimal('7.05672');
    assert.strictEqual(context.hasManualPragmatikoOromisthioDeviation(), true);
    legalHourly = new Decimal('6.50004');
    await context.recalculateActualWagesAfterLegalChange(true);
    assert.strictEqual(hourlyInput.value, '8.5000');
    assert.ok(appliedHourly.eq('8.5'));
}

runEditLegalChangeContract().then(() => {
    console.log('apodoxes F9/F10 add/edit contract tests passed');
});

for (const source of [addScript, editScript]) {
    const calculation = source.indexOf('const calculatedActualWages = calculateManualActualWages(');
    const noExtraBranch = source.indexOf('if (diafora.lte(0))', calculation);
    const createExtraRow = source.indexOf(
        'findExistingOrFirstEmptyExtraRow(extraItem.value)',
        noExtraBranch
    );
    assert.ok(calculation > -1 && noExtraBranch > calculation && createExtraRow > noExtraBranch);
    assert.ok(
        source.slice(noExtraBranch, createExtraRow).includes('findExistingExtraApodoxesRow()')
    );
    assert.ok(
        !source
            .slice(noExtraBranch, createExtraRow)
            .includes('findExistingOrFirstEmptyExtraRow(')
    );
    assert.ok(source.includes('hmeromisthio: actualHourly.times(averageDailyHours)'));
    assert.ok(source.includes('misthos: actualHourly.times(toDecimal(ores)).times(weeklyFactor)'));
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
