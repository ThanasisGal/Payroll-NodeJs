const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    buildCanonicalWorkTermsSnapshotFields
} = require('../../utils/ergazomenoi/getOrarioTermsForDate');

const controllerPath = path.join(__dirname, 'ergazomenoiController.js');
const controllerSource = fs.readFileSync(controllerPath, 'utf8');

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

function testWeekTypeAndRepoSnapshot() {
    assert.strictEqual(
        snapshot({ hmeres_ergasias_ebdomadas: 5 }).typos_ebdomadas,
        '5HMERH'
    );
    assert.strictEqual(
        snapshot({ hmeres_ergasias_ebdomadas: 6 }).typos_ebdomadas,
        '6HMERH'
    );
    assert.strictEqual(snapshot({ mhniaia_repo: 1 }).mhniaia_repo, 1);
    assert.strictEqual(snapshot({ mhniaia_repo: 2 }).mhniaia_repo, 2);
}

function testExpectedRepoSnapshotFallback() {
    assert.strictEqual(snapshot({ hmeres_ergasias_ebdomadas: 5 }).mhniaia_repo, 2);
    assert.strictEqual(snapshot({ hmeres_ergasias_ebdomadas: 6 }).mhniaia_repo, 1);
    assert.strictEqual(
        snapshot({ hmeres_ergasias_ebdomadas: 5, mhniaia_repo: 1 }).mhniaia_repo,
        1
    );
    assert.strictEqual(
        snapshot({ hmeres_ergasias_ebdomadas: 6, mhniaia_repo: 2 }).mhniaia_repo,
        2
    );
    assert.strictEqual(
        buildCanonicalWorkTermsSnapshotFields(
            { hmeres_ergasias_ebdomadas: 5 },
            { mhniaia_repo: 1 }
        ).mhniaia_repo,
        1
    );
    assert.strictEqual(
        buildCanonicalWorkTermsSnapshotFields(
            { hmeres_ergasias_ebdomadas: 6 },
            { mhniaia_repo: 2 }
        ).mhniaia_repo,
        2
    );
    assert.strictEqual(snapshot({ hmeres_ergasias_ebdomadas: 3 }).mhniaia_repo, 0);
}

function testWeekTypeRemainsIndependentFromRepo() {
    const explicitMismatch = snapshot({
        hmeres_ergasias_ebdomadas: 5,
        mhniaia_repo: 1
    });
    assert.strictEqual(explicitMismatch.typos_ebdomadas, '5HMERH');
    assert.strictEqual(explicitMismatch.mhniaia_repo, 1);
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
        mhniaia_repo: 2
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
}

function run() {
    testCanonicalEmploymentTypes();
    testWeeklyDayFieldsCannotBecomeEmploymentType();
    testWeekTypeAndRepoSnapshot();
    testExpectedRepoSnapshotFallback();
    testWeekTypeRemainsIndependentFromRepo();
    testInvalidCanonicalSnapshotDoesNotUseLegacyFallback();
    testControllerUsesPureCanonicalSnapshotHelper();
    console.log('ergazomenoi controller work-terms snapshot tests passed');
}

run();
