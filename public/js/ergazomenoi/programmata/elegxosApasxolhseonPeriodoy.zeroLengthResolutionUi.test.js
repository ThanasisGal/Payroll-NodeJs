'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const functionSource = source.slice(source.indexOf('function zeroLengthCardPairs'),
    source.indexOf('const orphanDerivedPreviewEditableFields'));
const sandbox = {
    pairNo: (value) => String(value).padStart(2, '0'),
    timeToMinutes: (value) => {
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''))) return null;
        const [hours, minutes] = value.split(':').map(Number);
        return hours * 60 + minutes;
    },
    escapeHtml: String
};
vm.runInNewContext(`${functionSource}\nthis.api = {
    zeroLengthCardPairs, renderZeroLengthCardResolutionSection
};`, sandbox);

const row = { _id: 'row-1404', cards_apo_ora_01: '14:04',
    cards_eos_ora_01: '14:04', cards_ores_ergasias: 0 };
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.api.zeroLengthCardPairs(row))),
    [{ pairNumber: 1, rawTime: '14:04' }]);
const html = sandbox.api.renderZeroLengthCardResolutionSection(row);
assert.match(html, /Επίλυση πραγματικής απασχόλησης/);
assert.match(html, /Τα πρωτογενή χτυπήματα δεν θα αλλάξουν/);
assert.match(html, /14:04–14:04/);
assert.match(html, /zeroLengthStart1/);
assert.match(html, /zeroLengthEnd1/);
assert.match(html, /value=""/,
    'no fabricated actual-work end time may be prefilled');
assert.match(html, /id="zeroLengthResolutionConfirm"/);
assert.match(html, /δεν διαβιβάστηκαν\/καταγράφηκαν σωστά στο ΕΡΓΑΝΗ/);

assert.match(source, /ZERO_LENGTH_CARD_EVIDENCE[\s\S]*?Μη έγκυρο μηδενικό διάστημα κάρτας/);
assert.match(source, /Δηλώστε τις πραγματικές ώρες απασχόλησης\. Τα αρχικά χτυπήματα κάρτας θα διατηρηθούν/);
assert.match(source, /issue_code === 'ZERO_LENGTH_CARD_EVIDENCE'[\s\S]*?Επίλυση πραγματικής απασχόλησης/);
assert.match(source, /zero_length_resolution: zeroLengthResolution/);
assert.match(source, /transmission_failure_confirmed: true/);
assert.match(source, /item\.start === item\.end/);
assert.match(source, /ZERO_LENGTH_CARD_INTERVAL_REQUIRES_HR_DECISION/);

console.log('zero-length employment-review UI contracts passed');
