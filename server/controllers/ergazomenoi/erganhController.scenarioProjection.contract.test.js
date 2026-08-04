const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');

function getControllerMethodSource(methodName, nextMethodName) {
    const start = source.indexOf(`static ${methodName}`);
    const end = source.indexOf(`static ${nextMethodName}`, start + 1);

    assert.ok(start >= 0, `missing controller method ${methodName}`);
    assert.ok(end > start, `missing controller method boundary ${nextMethodName}`);

    return source.slice(start, end);
}

function assertScenarioProjectionFields(methodSource, methodName) {
    const findStart = methodSource.indexOf('ProdhlomenaOrariaModel.find(filter)');
    const selectEnd = methodSource.indexOf(
        '.sort({ ypokatasthma: 1, kodikos: 1, hmeromhnia: 1 })',
        findStart
    );

    assert.ok(findStart >= 0 && selectEnd > findStart, `missing projection in ${methodName}`);

    const projection = methodSource.slice(findStart, selectEnd);

    for (const field of [
        'kathgoria_ergasias_apologistika',
        'ores_ergasias_apologistika',
        'ores_pragmatikhs_ergasias_apologistika',
        'compensation_breakdown_apologistika'
    ]) {
        assert.ok(
            new RegExp(`(?:^|[^A-Za-z0-9_])${field}(?:$|[^A-Za-z0-9_])`).test(
                projection
            ),
            `${methodName} projection is missing ${field}`
        );
    }
}

const policyPreviewSource = getControllerMethodSource(
    'getProdhlomenaOrariaPolicyPreview',
    'getProdhlomenaOrariaPolicyPreviewApprovals'
);
const scenarioClassificationSource = getControllerMethodSource(
    'getProdhlomenaOrariaScenarioClassifications',
    'exportProdhlomenaOrariaReviewExcel'
);

assertScenarioProjectionFields(
    policyPreviewSource,
    'getProdhlomenaOrariaPolicyPreview'
);
assertScenarioProjectionFields(
    scenarioClassificationSource,
    'getProdhlomenaOrariaScenarioClassifications'
);

console.log('employment review scenario projection controller contract passed');
