'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { CONFIRMATION, parseArgs, candidateFilter, run } =
    require('./repair-approved-start-only-orphan-book-flag');

function query(rows) {
    return { select() { return this; }, sort() { return this; }, lean: async () => rows };
}

const baseArgs = ['--team', 'THA', '--company-kod', 'company'];
const recordArgs = [...baseArgs, '--record-id', '6a92babe5de956f225bd485c'];
const candidate = {
    _id: '6a92babe5de956f225bd485c', team: 'THA', company_kod: 'company',
    kodikos: '0012', ypokatasthma: '0000', hmeromhnia: new Date('2026-08-07Z'),
    is_locked: true, apologistiko_biblio: false,
    orphan_card_resolution: { status: 'HR_APPROVED', orphan_type: 'START_ONLY',
        approved_at: new Date('2026-09-23T05:04:06.842Z'), approved_by: 'ΘΑΝΑΣΗΣ',
        approved_interval: { start: '09:00', end: '17:00', workDurationHours: 7.5 } }
};

test('dry run is the default and performs no update', async () => {
    let updates = 0;
    const result = await run(baseArgs, { rowModel: {
        find(filter) {
            assert.deepEqual(filter, candidateFilter(parseArgs(baseArgs)));
            return query([candidate]);
        },
        async updateOne() { updates++; }
    } });
    assert.equal(result.mode, 'DRY_RUN');
    assert.equal(result.candidate_count, 1);
    assert.equal(result.candidates[0].kodikos, '0012');
    assert.deepEqual(result.candidates[0].approved_interval,
        candidate.orphan_card_resolution.approved_interval);
    assert.equal(updates, 0);
});

test('record-id narrows the dry-run candidate filter and is validated', async () => {
    const parsed = parseArgs(recordArgs);
    assert.equal(candidateFilter(parsed)._id, '6a92babe5de956f225bd485c');
    assert.throws(() => parseArgs([...baseArgs, '--record-id', 'not-an-object-id']),
        /Invalid value: --record-id/);
    await run(recordArgs, { rowModel: {
        find(filter) {
            assert.deepEqual(filter, {
                _id: '6a92babe5de956f225bd485c',
                team: 'THA',
                company_kod: 'company',
                'orphan_card_resolution.status': 'HR_APPROVED',
                'orphan_card_resolution.orphan_type': 'START_ONLY',
                apologistiko_biblio: false
            });
            return query([candidate]);
        }
    } });
});

test('apply changes only the book flag and creates an audit entry', async () => {
    const calls = { updates: [], audits: [] };
    const session = { async withTransaction(work) { await work(); }, async endSession() {} };
    const args = [...recordArgs, '--apply', '--actor', 'ΘΑΝΑΣΗΣ', '--reason',
        'Legacy START_ONLY orphan book invariant repair', '--confirm', CONFIRMATION];
    const result = await run(args, {
        rowModel: {
            find: () => query([candidate]),
            async updateOne(filter, update) {
                calls.updates.push({ filter, update });
                return { matchedCount: 1 };
            }
        },
        auditModel: { async create(documents) { calls.audits.push(...documents); } },
        connection: { async startSession() { return session; } }
    });
    assert.deepEqual(calls.updates[0].update, { $set: { apologistiko_biblio: true } });
    assert.equal(calls.updates[0].filter.apologistiko_biblio, false);
    assert.equal(calls.updates[0].filter._id, '6a92babe5de956f225bd485c');
    assert.equal(calls.updates[0].filter['orphan_card_resolution.status'], 'HR_APPROVED');
    assert.equal(calls.audits[0].newValues.apologistiko_biblio, true);
    assert.equal(result.repaired, 1);
});

test('apply requires an explicit confirmation', () => {
    assert.throws(() => parseArgs([...baseArgs, '--apply']), /Required with --apply/);
});
