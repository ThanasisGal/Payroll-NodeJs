'use strict';
// Offline, synthetic safety tests. No MongoDB, HTTP requests, ERGANI or server startup.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const servicePath = process.env.CORRECTION3_CONTRACT_SERVICE ||
    path.join(root, 'server/services/ergazomenoi/employeeDeferredExternalActionService.js');
const source = fs.readFileSync(servicePath, 'utf8');
const js = fs.readFileSync(path.join(root, 'public/js/ergazomenoi/genika/putFieldValues.js'), 'utf8');
const begin = source.indexOf('function isXmlActionRequest(');
const end = source.indexOf('\nmodule.exports =', begin);
assert.ok(begin >= 0 && end > begin, 'Production helper must exist');
const context = { D: { failure(reason) { return Object.assign(new Error(reason), { code: 'EMPLOYEE_HISTORY_DEFER_' + reason }); } },
    require(name) {
        if (name.endsWith('employmentProfileContract')) return { calendarDate(input) {
            if (input == null || input === '') return null;
            const date = input instanceof Date ? input : new Date(input);
            return Number.isNaN(date.valueOf()) ? null : date;
        } };
        throw Error('No external require in offline contract test');
    }
};
vm.createContext(context);
vm.runInContext(source.slice(begin, end), context);
const record = { parameters: { method: 'xml', processCode: '230', branch: '0001',
        mutationDate: '2026-03-01', hire: '2026-01-01', departure: null,
        scheduleFrom: '2026-01-01', scheduleUntil: '2026-03-31' },
    documents: { results: [{ type: 'MA_XML', success: true, locations: ['s3://synthetic/ma.xml'] }] } };
const employee = { hmeromhnia_proslhpshs: '2026-01-01', hmeromhnia_apoxorhshs: null };
const xmlMA = date => ({ body: { ergazomenosId: 'synthetic', s3Url: 's3://synthetic/ma.xml',
    processCode: '230', hmeromhnia_metabolhs: date }, xml: true });

test('direct E6N XML route is XML despite submit-* URL', () => {
    assert.equal(context.isXmlActionRequest('/ergazomenoi/ergazomenoi/submit-e6n-to-erganh', 'E6N', { erganiUploadMethod: 'xml' }), true);
});
test('direct E6N REST remains REST, mismatched choice remains rejected', () => {
    assert.equal(context.isXmlActionRequest('/ergazomenoi/ergazomenoi/submit-e6n-to-erganh', 'E6N', { erganiUploadMethod: 'rest' }), false);
    assert.equal(context.isXmlActionRequest('/ergazomenoi/ergazomenoi/submit-e5n-to-erganh', 'E5N', { erganiUploadMethod: 'xml' }), false);
});
test('existing /upload-* routes remain XML', () => {
    assert.equal(context.isXmlActionRequest('/ergazomenoi/ergazomenoi/upload-ma-to-erganh', 'MA', {}), true);
    assert.equal(context.isXmlActionRequest('/ergazomenoi/ergazomenoi/upload-wto-to-erganh', 'WTO', {}), true);
});
test('MA XML with exact date and recorded artifact is allowed', () => {
    assert.doesNotThrow(() => context.assertActionRequestMatches(record, 'MA', xmlMA('2026-03-01')));
});
test('forged MA XML date cannot change original deferred submission', () => {
    assert.throws(() => context.assertActionRequestMatches(record, 'MA', xmlMA('2026-04-01')),
        { code: 'EMPLOYEE_HISTORY_DEFER_ACTION_PROPOSAL_CHANGED' });
});
test('omitted MA XML date cannot bypass original event binding', () => {
    assert.throws(() => context.assertActionRequestMatches(record, 'MA', xmlMA(undefined)),
        { code: 'EMPLOYEE_HISTORY_DEFER_ACTION_PROPOSAL_CHANGED' });
});
test('a future dated MA event differs from previously committed MA event', () => {
    assert.equal(context.sameExternalEvent(record, employee, 'MA', {hmeromhnia_metabolhs: '2026-04-01'}), false);
    assert.equal(context.sameExternalEvent(record, employee, 'MA', {hmeromhnia_metabolhs: '2026-03-01'}), true);
    assert.equal(context.sameExternalEvent(record, employee, 'MA', {}), null);
});
test('a prior MA without a mutation date cannot falsely identify a distinct newer event', () => {
    const legacy = { ...record, parameters: { ...record.parameters, mutationDate: null } };
    assert.equal(context.sameExternalEvent(legacy, employee, 'MA', { hmeromhnia_metabolhs: '2026-04-01' }), null);
});
test('missing hire or schedule identity cannot silently prove that an old action is distinct', () => {
    const missingHire = { ...record, parameters: { ...record.parameters, hire: null } };
    assert.equal(context.sameExternalEvent(missingHire, employee, 'MA', { hmeromhnia_metabolhs: '2026-04-01' }), null);
    const missingSchedule = { ...record, parameters: { ...record.parameters, scheduleFrom: null } };
    assert.equal(context.sameExternalEvent(missingSchedule, { ...employee,
        hmeromhnia_allaghs_orarioy_apo: '2026-04-01', hmeromhnia_allaghs_orarioy_eos: '2026-04-30' }, 'WTO', {}), null);
});
test('production MA XML request carries the exact event date used by service', () => {
    const match = js.match(/async function uploadMaToErganh\([\s\S]*?\)\s*\{/);
    assert.ok(match && match[0].includes('hmeromhniaMetabolhs'));
    const i = js.indexOf("await fetch('/ergazomenoi/ergazomenoi/upload-ma-to-erganh'");
    assert.ok(i >= 0);
    const block = js.slice(i, i+640);
    assert.match(block, /hmeromhnia_metabolhs:\s*hmeromhniaMetabolhs\s*\|\|\s*null/);
});
