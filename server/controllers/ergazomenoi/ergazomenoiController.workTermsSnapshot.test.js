const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    buildCanonicalWorkTermsSnapshotFields
} = require('../../utils/ergazomenoi/getOrarioTermsForDate');

const controllerPath = path.join(__dirname, 'ergazomenoiController.js');
const controllerSource = fs.readFileSync(controllerPath, 'utf8');
const editFormSource = fs.readFileSync(path.join(
    __dirname,
    '../../../views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/stoixeiaProslhpshs.ejs'
), 'utf8');
const mutationFormSource = fs.readFileSync(path.join(
    __dirname,
    '../../../views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/typoiMetabolon.ejs'
), 'utf8');

function snapshot(formData) {
    return buildCanonicalWorkTermsSnapshotFields(formData);
}

function testCanonicalEmploymentTypes() {
    ['0', '1', '2'].forEach((canonical) => {
        const result = snapshot({
            kathestos_apasxolhshs: canonical,
            apasxolhsh_basei_symbashs: canonical === '2' ? '6' : '5'
        });
        assert.strictEqual(result.kathestos_apasxolhshs, canonical);
        assert.strictEqual(result.typos_apasxolhshs, canonical);
    });
}

function testWeeklyDayFieldsCannotBecomeEmploymentType() {
    ['5', '6'].forEach((weekDays) => {
        const result = snapshot({ apasxolhsh_basei_symbashs: weekDays });
        assert.strictEqual(result.kathestos_apasxolhshs, '');
        assert.strictEqual(result.typos_apasxolhshs, '');
    });
}

function testWeekTypeSnapshot() {
    assert.strictEqual(
        snapshot({ hmeres_ergasias_ebdomadas: 5 }).typos_ebdomadas,
        '5HMERH'
    );
    assert.strictEqual(
        snapshot({ hmeres_ergasias_ebdomadas: 6 }).typos_ebdomadas,
        '6HMERH'
    );
}

function testInvalidCanonicalSnapshotDoesNotUseLegacyFallback() {
    const invalidCanonical = snapshot({
        kathestos_apasxolhshs: '5',
        typos_apasxolhshs: 'PLHRHS',
        hmeres_ergasias_ebdomadas: 5
    });
    assert.deepStrictEqual(invalidCanonical, {
        kathestos_apasxolhshs: '',
        typos_apasxolhshs: '',
        typos_ebdomadas: '5HMERH',
        pososto_prosayxhshs_6hs_hmeras: null
    });

    const validCanonical = snapshot({
        kathestos_apasxolhshs: '1',
        typos_apasxolhshs: 'PLHRHS',
        hmeres_ergasias_ebdomadas: 5
    });
    assert.strictEqual(validCanonical.kathestos_apasxolhshs, '1');
    assert.strictEqual(validCanonical.typos_apasxolhshs, '1');
}

function testControllerUsesPureCanonicalSnapshotHelper() {
    const functionStart = controllerSource.indexOf(
        'function getTyposApasxolhshsFromFormData(formData = {})'
    );
    const nextFunction = controllerSource.indexOf(
        'function buildIstorikoWorkTermsSnapshot',
        functionStart
    );
    const resolverSource = controllerSource.slice(functionStart, nextFunction);

    assert.ok(functionStart >= 0 && nextFunction > functionStart);
    assert.ok(resolverSource.includes('resolveEmploymentTypeFromFormData(formData)'));
    assert.ok(!resolverSource.includes('apasxolhsh_basei_symbashs'));
    assert.ok(controllerSource.includes('...canonicalSnapshotFields'));
    assert.ok(controllerSource.includes('kathestos_apasxolhshs_hmeras'));
    assert.ok(controllerSource.includes('getOrarioTermsForDate('));
    assert.ok(controllerSource.includes('loadOrarioTermsHistoryForSnapshot'));
    assert.ok(!/getOrarioTermsForDate\([^)]*,\s*\[\]/s.test(controllerSource));
}

function testMutationFieldsAreAuthoritativeAndHistoryPairIsTransactional() {
    assert.match(mutationFormSource, /name="typos_metabolhs"/);
    assert.match(mutationFormSource, /name="hmeromhnia_metabolhs"/);
    assert.doesNotMatch(editFormSource, /name="afora_allagh_oron_ergasias"/);
    assert.ok(controllerSource.includes('resolveWorkTermsPeriodIntent(formData)'));
    assert.ok(controllerSource.includes('mongoose.connection.startSession()'));
    assert.ok(controllerSource.includes('historySession.withTransaction'));
    assert.ok(controllerSource.includes('getPreviousUtcDate(effectiveApo)'));
    assert.ok(controllerSource.includes('session: historySession'));
}

function testBreakConfigurationUsesExistingHistoryTransaction() {
    assert.ok(controllerSource.includes('buildBreakConfigurationHistoryChange'));
    assert.ok(controllerSource.includes('hmeromhnia_isxyos_dialleimatos_apo'));
    assert.match(controllerSource,
        /breakHistoryChange\.changed \? breakHistoryChange\.snapshot : \{\}/);
    assert.ok(controllerSource.includes('historySession.withTransaction'));
}

function run() {
    testCanonicalEmploymentTypes();
    testWeeklyDayFieldsCannotBecomeEmploymentType();
    testWeekTypeSnapshot();
    testInvalidCanonicalSnapshotDoesNotUseLegacyFallback();
    testControllerUsesPureCanonicalSnapshotHelper();
    testMutationFieldsAreAuthoritativeAndHistoryPairIsTransactional();
    testBreakConfigurationUsesExistingHistoryTransaction();
    console.log('ergazomenoi controller work-terms snapshot tests passed');
}

run();
