'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('MA REST path has one POST target and bypasses XML upload', () => {
    const source = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');
    const restFunction = source.slice(source.indexOf('async function submitMARestToErganh('),
        source.indexOf('// ============================================================================\n    // ✅ E5N REST JSON UPLOAD'));
    assert.equal((restFunction.match(/fetch\('\/ergazomenoi\/ergazomenoi\/submit-ma-to-erganh'/g) || []).length, 1);
    const dispatch = source.slice(source.indexOf('if (isMARestSubmit) {', source.indexOf('async function uploadMaToErganh')),
        source.indexOf('if (isE7NRestSubmit) {', source.indexOf('async function uploadMaToErganh')));
    assert.match(dispatch, /if \(erganiUploadInProgress\)/);
    assert.match(dispatch, /erganiUploadInProgress = true/);
    assert.match(dispatch, /await submitMARestToErganh\(ergazomenosId, hmeromhniaMetabolhs\)/);
    assert.match(dispatch, /finally\s*\{[\s\S]*?erganiUploadInProgress = false/);
    assert.equal((dispatch.match(/await submitMARestToErganh\(/g) || []).length, 1);
    assert.doesNotMatch(dispatch, /upload-ma-to-erganh/);
    assert.match(source, /'REST_MA_NO_XML_REQUIRED'/);
    assert.match(source, /hmeromhnia_metabolhs: hmeromhniaMetabolhs/);
    assert.match(source, /formData\.hmeromhnia_metabolhs/);
    const controller = fs.readFileSync(path.resolve(__dirname,
        '../../../../server/controllers/ergazomenoi/erganhController.js'), 'utf8');
    const maController = controller.slice(controller.indexOf('static submitMAToErganh ='),
        controller.indexOf('static cancelE7NSubmission ='));
    assert.match(maController, /hmeromhnia_metabolhs: mutationDate/);
    assert.match(maController, /validateMaMutationDate\(body\.hmeromhnia_metabolhs\)/);
    assert.doesNotMatch(maController, /ergazomenos\.hmeromhnia_proslhpshs/);
    assert.equal((source.match(/button\.addEventListener\('click', handleFormSubmitOnce\)/g) || []).length, 1);
    assert.match(source, /function handleFormSubmitOnce\(event\)[\s\S]*runFormSubmissionOnce\(\(\) => handleFormSubmit\(event\)\)/);
    assert.match(source, /const runFormSubmissionOnce = createSingleFlight\(\)/);
    assert.match(source, /finally \{ inProgress = false; \}/);
});

for (const shouldFail of [false, true]) {
    test(`rapid double-click yields one mocked WebMA POST and resets after ${shouldFail ? 'failure' : 'success'}`, async () => {
        const source = fs.readFileSync(path.join(__dirname, 'putFieldValues.js'), 'utf8');
        const helper = source.slice(source.indexOf('function createSingleFlight()'),
            source.indexOf('\ndocument.addEventListener', source.indexOf('function createSingleFlight()')));
        const browser = await chromium.launch({ channel: 'chromium', headless: true });
        try {
            const page = await browser.newPage();
            await page.setContent('<button id="save">Αποθήκευση</button>');
            await page.addScriptTag({ content: `${helper}\nwindow.createSingleFlight = createSingleFlight;` });
            await page.evaluate(fail => {
                window.posts = 0;
                window.releasePost = null;
                window.fetch = async (url, options) => {
                    if (url !== '/ergazomenoi/ergazomenoi/submit-ma-to-erganh' || options.method !== 'POST')
                        throw new Error('Unexpected request');
                    window.posts++;
                    await new Promise(resolve => { window.releasePost = resolve; });
                    if (fail) throw new Error('Mocked WebMA failure');
                    return { ok: true };
                };
                const runOnce = window.createSingleFlight();
                window.outcomes = [];
                document.getElementById('save').addEventListener('click', () => {
                    const task = runOnce(() => window.fetch('/ergazomenoi/ergazomenoi/submit-ma-to-erganh',
                        { method: 'POST' }));
                    task.then(value => window.outcomes.push(value?.skipped ? 'skipped' : 'success'),
                        () => window.outcomes.push('failure'));
                });
                document.getElementById('save').click();
                document.getElementById('save').click();
            }, shouldFail);
            assert.equal(await page.evaluate(() => window.posts), 1);
            await page.evaluate(() => window.releasePost());
            await page.waitForFunction(() => window.outcomes.length === 2);
            assert.ok((await page.evaluate(() => window.outcomes)).includes('skipped'));
            await page.evaluate(() => document.getElementById('save').click());
            assert.equal(await page.evaluate(() => window.posts), 2);
            await page.evaluate(() => window.releasePost());
            await page.waitForFunction(() => window.outcomes.length === 3);
        } finally { await browser.close(); }
    });
}
