'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { POLICY_VERSION: ORPHAN_POLICY_VERSION } =
    require('./apasxoliseisOrphanCardResolutionService');
const { applyPredeclaredRepoBookRule, buildCanonicalClassificationUpdates,
    planCanonicalDailyClassification,
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
assert.equal(buildCanonicalClassificationUpdates({ classification: 'REST_REPO',
    row: { repo: true } }).apologistiko_biblio, false);
assert.equal(buildCanonicalClassificationUpdates({ classification: 'REST_REPO',
    row: { repo: false } }).apologistiko_biblio, true);
assert.equal(buildCanonicalClassificationUpdates({ classification: 'REST_REPO',
    row: { repo: true, repo_apologistika: false } }).apologistiko_biblio, false,
    'the writer sets repo_apologistika=true in the same authoritative update');
const existing = { apologistiko_biblio: true, marker: 'unchanged' };
assert.strictEqual(applyPredeclaredRepoBookRule({ repo: false,
    repo_apologistika: true, kathgoria_ergasias_apologistika: 'ΑΝ' }, existing), existing);
assert.strictEqual(applyPredeclaredRepoBookRule({ repo: true,
    repo_apologistika: false, kathgoria_ergasias_apologistika: 'ΑΝ' }, existing), existing);
assert.strictEqual(applyPredeclaredRepoBookRule({ repo: true,
    repo_apologistika: true, kathgoria_ergasias_apologistika: 'ΜΕ' }, existing), existing);
assert.deepEqual(applyPredeclaredRepoBookRule({ repo: true,
    repo_apologistika: true, kathgoria_ergasias_apologistika: 'ΑΝ' }, existing), {
    apologistiko_biblio: false, marker: 'unchanged'
});
for (const orphanType of ['START_ONLY', 'END_ONLY']) {
    assert.deepEqual(applyPredeclaredRepoBookRule({ repo: true,
        repo_apologistika: true, kathgoria_ergasias_apologistika: 'ΑΝ',
        orphan_card_resolution: { status: 'HR_APPROVED',
            policy_version: ORPHAN_POLICY_VERSION, orphan_type: orphanType }
    }, existing), { apologistiko_biblio: true, marker: 'unchanged' },
    `approved ${orphanType} orphan resolution keeps apologistiko_biblio=true`);
}
assert.deepEqual(planCanonicalDailyClassification({ classification: 'REST_REPO', row: {} }),
    buildCanonicalClassificationUpdates({ classification: 'REST_REPO' }));
assert.throws(() => buildCanonicalClassificationUpdates({ classification: 'SICKNESS' }),
    { code: 'SICKNESS_CATEGORY_REQUIRED' });
assert.equal(buildCanonicalClassificationUpdates({ classification: 'SICKNESS',
    leave_category: 'ΑΔΑΝΕΥΑΠ' }).astheneia_apologistika, true);
assert.throws(() => buildCanonicalClassificationUpdates({ classification: 'LEAVE' }),
    { code: 'LEAVE_CATEGORY_REQUIRED' });
for (const classification of ['LEAVE', 'SICKNESS', 'ABSENCE']) {
    for (const current of [false, true]) {
        const updates = buildCanonicalClassificationUpdates({ classification,
            ...(classification !== 'ABSENCE' ? { leave_category: 'ΑΔΑΝΕΥΑΠ' } : {}),
            row: { apologistiko_biblio: current } });
        assert.equal(Object.hasOwn(updates, 'apologistiko_biblio'), false,
            `${classification} must preserve apologistiko_biblio=${current}`);
    }
}
assert.equal(buildCanonicalClassificationUpdates({ classification: 'LEAVE',
    leave_category: 'ΑΔΚΑΝ', row: { ores_ergasias: 6 } }).ores_ergasias_apologistika, 6);
assert.equal(buildCanonicalClassificationUpdates({ classification: 'LEAVE',
    leave_category: 'ΑΔΚΑΝ', row: { ores_ergasias: 6 } })
    .ores_pragmatikhs_ergasias_apologistika, 0);
assert.equal(buildCanonicalClassificationUpdates({ classification: 'LEAVE',
    leave_category: 'ΑΔΚΑΝ', row: { ores_ergasias: -1 } }).ores_ergasias_apologistika, 0);

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
await writeCanonicalDailyClassification({ row, classification: 'LEAVE',
    leave_category: 'ΑΔΚΑΝ', reason: 'Άδεια', actor_name: 'HR', session: {},
    prodhlomenaModel: { updateOne: async (...args) => { updateCall = args;
        return { matchedCount: 1 }; } },
    prodhlomenaAuditModel: { create: async () => {} } });
assert.equal(updateCall[1].$set.ores_ergasias_apologistika, 6);
await writeCanonicalDailyClassification({ row: { ...row, repo: true },
    classification: 'REST_REPO', reason: 'Προδηλωμένο ρεπό', actor_name: 'HR', session: {},
    prodhlomenaModel: { updateOne: async (...args) => { updateCall = args;
        return { matchedCount: 1 }; } },
    prodhlomenaAuditModel: { create: async (...args) => { auditCall = args; } } });
assert.equal(updateCall[1].$set.apologistiko_biblio, false);
assert.equal(updateCall[1].$set.repo_apologistika, true);
assert.equal(updateCall[1].$set.kathgoria_ergasias_apologistika, 'ΑΝ');
assert.equal(auditCall[0][0].newValues.apologistiko_biblio, false);
await assert.rejects(() => writeCanonicalDailyClassification({ row,
    classification: 'NON_WORK' }), { code: 'DAILY_CLASSIFICATION_TRANSACTION_REQUIRED' });
let auditWritten = false;
await assert.rejects(() => writeCanonicalDailyClassification({ row,
    classification: 'NON_WORK', reason: 'x', actor_name: 'HR', session: {},
    prodhlomenaModel: { updateOne: async () => ({ matchedCount: 0 }) },
    prodhlomenaAuditModel: { create: async () => { auditWritten = true; } } }),
{ code: 'DAILY_REVIEW_INPUT_CHANGED' });
assert.equal(auditWritten, false);
console.log('shared canonical daily classification writer tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
