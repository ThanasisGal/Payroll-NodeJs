'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { buildCanonicalClassificationUpdates,
    writeCanonicalDailyClassification } = require('./apasxoliseisCanonicalDailyClassificationWriterService');

assert.deepEqual(buildCanonicalClassificationUpdates({ classification: 'NON_WORK' }), {
    apologistiko_biblio: true,
    kathgoria_ergasias_apologistika: 'ΜΕ', repo_apologistika: false,
    adeia_apologistika: false, kathgoria_adeias_apologistika: '',
    astheneia_apologistika: false, apousia_apologistika: false,
    ores_ergasias_apologistika: 0
});
assert.deepEqual(buildCanonicalClassificationUpdates({ classification: 'REST_REPO' }), {
    apologistiko_biblio: true,
    kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true,
    adeia_apologistika: false, kathgoria_adeias_apologistika: '',
    astheneia_apologistika: false, apousia_apologistika: false,
    ores_ergasias_apologistika: 0
});
assert.equal(buildCanonicalClassificationUpdates({ classification: 'SICKNESS' })
    .astheneia_apologistika, true);
assert.throws(() => buildCanonicalClassificationUpdates({ classification: 'LEAVE' }),
    { code: 'LEAVE_CATEGORY_REQUIRED' });

const row = { _id: new mongoose.Types.ObjectId(), team: 'THA', company_kod: 'company',
    ypokatasthma: '0000', kodikos: '0014', hmeromhnia: new Date('2026-06-03Z'),
    updatedAt: new Date(), kathgoria_ergasias_apologistika: '',
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', ores_ergasias: 6 };
let updateCall; let auditCall;
(async () => {
const result = await writeCanonicalDailyClassification({ row, classification: 'NON_WORK',
    reason: 'Αιτιολογία', actor_name: 'HR', session: {},
    prodhlomenaModel: { updateOne: async (...args) => { updateCall = args;
        return { matchedCount: 1 }; } },
    prodhlomenaAuditModel: { create: async (...args) => { auditCall = args; } } });
assert.equal(result.row.kathgoria_ergasias_apologistika, 'ΜΕ');
assert.ok(updateCall[2].session);
assert.ok(auditCall[1].session);
assert.equal(auditCall[0][0].reason, 'Αιτιολογία');
await assert.rejects(() => writeCanonicalDailyClassification({ row,
    classification: 'NON_WORK' }), { code: 'DAILY_CLASSIFICATION_TRANSACTION_REQUIRED' });
let auditWritten = false;
await assert.rejects(() => writeCanonicalDailyClassification({ row,
    classification: 'NON_WORK', reason: 'x', actor_name: 'HR', session: {},
    prodhlomenaModel: { updateOne: async () => ({ matchedCount: 0 }) },
    prodhlomenaAuditModel: { create: async () => { auditWritten = true; } } }),
{ code: 'DAILY_REVIEW_INPUT_CHANGED' });
assert.equal(auditWritten, false);

async function writeLeave(rowOverrides, leaveCategory = 'ΑΔΚΑΝ') {
    let persistedUpdate;
    const leaveRow = { ...row, ores_pragmatikhs_ergasias_apologistika: 0,
        ...rowOverrides };
    const result = await writeCanonicalDailyClassification({ row: leaveRow,
        classification: 'LEAVE', leave_category: leaveCategory,
        reason: 'Τελική εξέταση άδειας', actor_name: 'HR', session: {},
        prodhlomenaModel: { updateOne: async (...args) => {
            persistedUpdate = args[1].$set;
            return { matchedCount: 1 };
        } },
        prodhlomenaAuditModel: { create: async () => {} } });
    return { result, persistedUpdate };
}

const singleIntervalLeave = await writeLeave({
    apo_ora_01: '14:00', eos_ora_01: '22:00',
    apo_ora_02: '', eos_ora_02: '', apo_ora_03: '', eos_ora_03: ''
});
assert.equal(singleIntervalLeave.result.row.adeia_apologistika, true);
assert.equal(singleIntervalLeave.result.row.kathgoria_adeias_apologistika, 'ΑΔΚΑΝ');
assert.equal(singleIntervalLeave.persistedUpdate.ores_ergasias_apologistika, 8);
assert.equal(singleIntervalLeave.result.row.ores_pragmatikhs_ergasias_apologistika, 0);
assert.equal(Object.hasOwn(singleIntervalLeave.persistedUpdate,
    'ores_pragmatikhs_ergasias_apologistika'), false);

const splitIntervalLeave = await writeLeave({
    ores_ergasias: 0,
    apo_ora_01: '08:00', eos_ora_01: '12:00',
    apo_ora_02: '16:00', eos_ora_02: '20:00',
    apo_ora_03: '', eos_ora_03: ''
}, 'ΑΔΑΠ');
assert.equal(splitIntervalLeave.persistedUpdate.ores_ergasias_apologistika, 8);
assert.equal(splitIntervalLeave.result.row.kathgoria_adeias_apologistika, 'ΑΔΑΠ');
assert.equal(splitIntervalLeave.result.row.ores_pragmatikhs_ergasias_apologistika, 0);
console.log('shared canonical daily classification writer tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
