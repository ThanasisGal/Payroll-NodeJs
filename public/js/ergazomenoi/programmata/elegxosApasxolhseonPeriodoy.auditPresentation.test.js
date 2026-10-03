'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    'elegxosApasxolhseonPeriodoy.js'), 'utf8');
const start = source.indexOf('const auditFieldLabels');
const end = source.indexOf('async function restoreFromAudit', start);
const sandbox = {
    escapeHtml(value) {
        return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
    }
};
vm.createContext(sandbox);
vm.runInContext(`${source.slice(start, end)}
this.renderAuditValues = renderAuditValues;
this.auditFieldLabels = auditFieldLabels;`, sandbox);

const oldValues = {
    zero_length_card_resolution: { status: 'HR_APPROVED',
        approved_intervals: [{ pairNumber: 1, start: '10:00', end: '10:04' }] },
    ores_pragmatikhs_ergasias_apologistika: 4 / 60,
    ores_apoysias_base_apologistika: 3.93,
    apologistiko_biblio: false,
    is_locked: false
};
const newValues = {
    zero_length_card_resolution: { status: 'HR_APPROVED', revision_number: 1,
        approved_intervals: [{ pairNumber: 1, start: '10:00', end: '14:04' }] },
    ores_pragmatikhs_ergasias_apologistika: 244 / 60,
    ores_apoysias_base_apologistika: 0,
    apologistiko_biblio: true,
    is_locked: true
};
const before = JSON.parse(JSON.stringify({ oldValues, newValues }));
const html = sandbox.renderAuditValues(oldValues, newValues);

assert.doesNotMatch(html, /zero_length_card_resolution/);
assert.doesNotMatch(html, /\[object Object\]/);
assert.doesNotMatch(html, /ores_pragmatikhs_ergasias_apologistika/);
assert.match(html, /Πραγματικές ώρες εργασίας/);
assert.doesNotMatch(html, /ores_apoysias_base_apologistika/);
assert.match(html, /Βασικές ώρες απουσίας/);
assert.match(html, /Απολογιστικό βιβλίο/);
assert.match(html, /Κλειδωμένη εγγραφή/);
assert.match(html, /ΝΑΙ/);
assert.match(html, /ΟΧΙ/);
assert.deepEqual({ oldValues, newValues }, before);

const requiredLabels = {
    kathgoria_ergasias_apologistika: 'Κατηγορία εργασίας απολογιστικά',
    apo_ora_02_apologistika: 'Απολογιστικό Από 2',
    eos_ora_03_apologistika: 'Απολογιστικό Έως 3',
    ores_apoysias_apologistika: 'Ώρες απουσίας',
    hmeres_apoysias_apologistika: 'Ημέρες απουσίας',
    unlocked_at: 'Ξεκλείδωμα στις'
};
for (const [field, label] of Object.entries(requiredLabels)) {
    assert.equal(sandbox.auditFieldLabels[field], label);
}

const escaped = sandbox.renderAuditValues({}, { locked_by: '<script>alert(1)</script>' });
assert.doesNotMatch(escaped, /<script>/);
assert.match(escaped, /&lt;script&gt;/);

console.log('employment review audit presentation tests passed');
