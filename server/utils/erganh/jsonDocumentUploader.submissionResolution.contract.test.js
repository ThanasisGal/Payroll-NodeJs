'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { resolveSubmissionByCode, normalizeSubmissionList, normalizeSubmissionRecord } = require('./jsonDocumentUploader');
const source = fs.readFileSync(path.join(__dirname, 'jsonDocumentUploader.js'), 'utf8');
assert.match(source, /async function resolveSubmissionByCode\(accessToken, submissionCode,/);
assert.match(source, /getSubmissionsFn\(accessToken\)/);
assert.match(source, /id: found\.id,[\s\S]*code: found\.code/);
assert.match(source, /resolveSubmissionByCode\(accessToken, submissionCode\)/);
assert.match(source, /submitDocument\(accessToken, submission\.code, payload\)/);
assert.doesNotMatch(source, /submitDocument\(accessToken,\s*(?:91|207),/);

const actualTrialShape = [{ id: 91, code: 'WTODailyA',
    description: 'Οργάνωση Χρόνου Εργασίας - Απολογιστικό' }];
assert.strictEqual(normalizeSubmissionList(actualTrialShape).length, 1);
assert.deepStrictEqual(normalizeSubmissionRecord({ Id: '91', Code: 'wtodailya', Title: 'Trial' }),
    { id: '91', code: 'wtodailya', description: 'Trial' });

(async () => {
    const trial = await resolveSubmissionByCode('safe-token', 'WTODailyA', {
        getSubmissionsFn: async () => actualTrialShape
    });
    assert.deepStrictEqual(trial, actualTrialShape[0]);
    await assert.rejects(resolveSubmissionByCode('safe-token', 'WTODayilyA', {
        getSubmissionsFn: async () => actualTrialShape
    }), /WTODayilyA/);
    await assert.rejects(resolveSubmissionByCode('safe-token', 'WTODailyA', {
        getSubmissionsFn: async () => [{ id: 91, code: 'DifferentCode' }]
    }), /WTODailyA/);
    await assert.rejects(resolveSubmissionByCode('safe-token', 'WTODailyA', {
        getSubmissionsFn: async () => [{ code: 'WTODailyA' }]
    }), /έγκυρο numeric id/);
    console.log('ERGANI REST submission-code resolution contract passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
