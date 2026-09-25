'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const S = require('./apasxoliseisConfirmedFullDayLeaveHoursRepairService');

const categories = new Set(['ΑΔΚΑΝ']);
const base = { _id: '6a92babe5de956f225bd485c', team: 'THA', company_kod: 'C1',
    ypokatasthma: '0001', kodikos: '0012', hmeromhnia: new Date('2026-08-07T00:00:00.000Z'),
    adeia_apologistika: true, kathgoria_adeias_apologistika: 'ΑΔΚΑΝ', ores_ergasias: 2,
    ores_ergasias_apologistika: 0, ores_pragmatikhs_ergasias_apologistika: 0,
    explicit_hourly_leave_hours: 0, egkekrimenh_oroadeia_apologistika: false,
    egkekrimena_diastimata_oroadeias_apologistika: [], is_locked: true,
    locked_by: 'HR', locked_at: new Date('2026-08-08T10:00:00.000Z') };

test('confirmed locked full-day leave is repairable and preserves lock intent', () => {
    const result = S.identifyRepairCandidate(base, categories);
    assert.equal(result.repairable, true);
    assert.equal(result.proposedCredited, 2);
    assert.equal(result.proposedActual, 0);
    assert.equal(base.is_locked, true);
});

test('decimal scheduled hours remain exact', () => {
    assert.equal(S.identifyRepairCandidate({ ...base, ores_ergasias: 3.5 }, categories).proposedCredited, 3.5);
});

test('already-correct leave requires no write', () => {
    const result = S.identifyRepairCandidate({ ...base, ores_ergasias_apologistika: 2 }, categories);
    assert.equal(result.repairable, false); assert.equal(result.alreadyCorrect, true);
});

for (const [name, patch, reason] of [
    ['explicit hourly hours', { explicit_hourly_leave_hours: 1 }, 'HOURLY_LEAVE'],
    ['approved hourly flag', { egkekrimenh_oroadeia_apologistika: true }, 'HOURLY_LEAVE'],
    ['approved hourly segments', { egkekrimena_diastimata_oroadeias_apologistika: [{ apo_lepto: 600, eos_lepto: 660 }] }, 'HOURLY_LEAVE'],
    ['approved hourly singular start', { apo_ora_egkekrimenhs_oroadeias_apologistika: '10:00' }, 'HOURLY_LEAVE'],
    ['POSSIBLE_LEAVE', { kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' }, 'POSSIBLE_LEAVE'],
    ['sickness', { astheneia_apologistika: true }, 'SICKNESS'],
    ['absence', { apousia_apologistika: true }, 'ABSENCE'],
    ['repo', { repo_apologistika: true }, 'REPO']
]) test(`${name} is excluded`, () => {
    const result = S.identifyRepairCandidate({ ...base, ...patch }, categories);
    assert.equal(result.repairable, false); assert.ok(result.exclusionReasons.includes(reason));
});

function query(value) { return { select() { return this; }, sort() { return this; }, lean: async () => value }; }
function harness(initial = base) {
    let row = structuredClone(initial); const audits = []; let writes = 0; let forceStale = false;
    const rowModel = {
        find() { return query(row ? [structuredClone(row)] : []); },
        async updateOne(_filter, update) {
            if (forceStale) return { matchedCount: 0 };
            writes++; Object.assign(row, update.$set); return { matchedCount: 1 };
        }
    };
    const leaveCategoryModel = { find() { return query([{ kodikos: 'ΑΔΚΑΝ' }]); } };
    const auditModel = { async create(docs) { audits.push(...structuredClone(docs)); } };
    const connection = { async startSession() { return { async withTransaction(work) { await work(); }, async endSession() {} }; } };
    return { rowModel, leaveCategoryModel, auditModel, connection, audits,
        get row() { return row; }, get writes() { return writes; }, stale() { forceStale = true; } };
}
const scope = { team: 'THA', company_kod: 'C1', ypokatasthma: '0001',
    period_start: '2026-08-01', period_end: '2026-08-31' };

test('apply changes only the two hour fields, keeps locking, and audits exactly once', async () => {
    const h = harness(); const before = structuredClone(h.row);
    const preview = await S.buildRepairPreview({ scope, ...h });
    const result = await S.applyRepairBatch({ scope, previewFingerprint: preview.preview_fingerprint,
        confirmed: true, reason: 'Εγκεκριμένη διόρθωση', changedBy: 'operator', ...h });
    assert.equal(result.repaired_count, 1); assert.equal(h.audits.length, 1);
    assert.equal(h.row.ores_ergasias_apologistika, 2);
    assert.equal(h.row.ores_pragmatikhs_ergasias_apologistika, 0);
    assert.equal(h.row.is_locked, true); assert.equal(h.row.locked_by, before.locked_by);
    assert.deepEqual(h.row.locked_at, before.locked_at);
    assert.deepEqual(Object.keys(h.audits[0].oldValues).sort(),
        ['ores_ergasias_apologistika', 'ores_pragmatikhs_ergasias_apologistika']);
    assert.match(h.audits[0].reason, /Repair confirmed full-day leave credited hours/);
});

test('stale row is not overwritten and is reported for review', async () => {
    const h = harness(); const preview = await S.buildRepairPreview({ scope, ...h }); h.stale();
    const result = await S.applyRepairBatch({ scope, previewFingerprint: preview.preview_fingerprint,
        confirmed: true, reason: 'reason', changedBy: 'operator', ...h });
    assert.equal(result.repaired_count, 0); assert.equal(result.stale_count, 1);
    assert.equal(h.writes, 0); assert.equal(h.audits.length, 0);
    assert.equal(result.stale[0].status, 'STALE / REVIEW_REQUIRED');
});

test('CAS missing-field selector narrowly trusts only the server-owned operator', () => {
    const filter = S.casFilter({ source: { _id: base._id,
        astheneia_apologistika: undefined, adeia_apologistika: true } });
    assert.equal(Object.getOwnPropertySymbols(filter).length, 0);
    assert.ok(Object.getOwnPropertySymbols(filter.astheneia_apologistika).length > 0);
    assert.deepEqual(Object.keys(filter.astheneia_apologistika), ['$exists']);
    assert.equal(filter.astheneia_apologistika.$exists, false);
    assert.equal(filter.adeia_apologistika, true);
});

test('rerun after apply is idempotent with zero repairable rows and writes', async () => {
    const h = harness(); const first = await S.buildRepairPreview({ scope, ...h });
    await S.applyRepairBatch({ scope, previewFingerprint: first.preview_fingerprint,
        confirmed: true, reason: 'reason', changedBy: 'operator', ...h });
    const second = await S.buildRepairPreview({ scope, ...h });
    assert.equal(second.repairable_count, 0); assert.equal(second.already_correct_count, 1);
    const writes = h.writes;
    const result = await S.applyRepairBatch({ scope, previewFingerprint: second.preview_fingerprint,
        confirmed: true, reason: 'reason', changedBy: 'operator', ...h });
    assert.equal(result.repaired_count, 0); assert.equal(h.writes, writes); assert.equal(h.audits.length, 1);
});
