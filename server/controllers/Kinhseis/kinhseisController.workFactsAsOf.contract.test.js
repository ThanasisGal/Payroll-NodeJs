const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const controllerPath = path.join(__dirname, 'kinhseisController.js');
const source = fs.readFileSync(controllerPath, 'utf8');

test('request-driven work-facts paths resolve and propagate session appDate', () => {
    assert.match(
        source,
        /explicitAsOfDate:\s*req\.session\?\.appDate/
    );
    assert.match(
        source,
        /explicitSource:\s*'SESSION_APP_DATE'/
    );
    assert.ok(
        (source.match(/asOfDate:\s*asOfContext\.asOfDate/g) || []).length >= 4
    );
    assert.ok(
        (source.match(/asOfDateSource:\s*asOfContext\.asOfDateSource/g) || []).length >= 4
    );
    assert.match(
        source,
        /reason:\s*asOfContext\.reason/
    );
});

test('batch creation receives the resolved session date before background execution', () => {
    const startCall = source.match(
        /startWorkFactsBatchJob\(\{[\s\S]*?asOfDate:\s*asOfContext\.asOfDate,[\s\S]*?asOfDateSource:\s*asOfContext\.asOfDateSource[\s\S]*?\}\)/
    );
    assert.ok(startCall);
    assert.match(
        source,
        /generateWorkFactsForCompanyPeriod\(\{[\s\S]*?startedJob:\s*job/
    );
});
