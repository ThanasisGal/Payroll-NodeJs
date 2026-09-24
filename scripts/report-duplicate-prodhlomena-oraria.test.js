'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseArgs, buildPipeline, run } = require('./report-duplicate-prodhlomena-oraria');

const argv = ['--team', 'THA', '--company-kod', 'COMPANY'];

test('requires the complete operator scope', () => {
    assert.throws(() => parseArgs([]), /Required: --team/);
    assert.throws(() => parseArgs(['--team', 'THA']), /Required: --company-kod/);
    assert.throws(() => parseArgs([...argv, '--apply']), /Unsupported option: --apply/);
});

test('pipeline groups by the complete logical identity and selects duplicates only', () => {
    const pipeline = buildPipeline(parseArgs(argv));
    assert.deepEqual(pipeline[0], { $match: { team: 'THA', company_kod: 'COMPANY' } });
    assert.deepEqual(pipeline[1].$group._id, {
        team: '$team',
        company_kod: '$company_kod',
        ypokatasthma: '$ypokatasthma',
        kodikos: '$kodikos',
        hmeromhnia: '$hmeromhnia'
    });
    assert.deepEqual(pipeline[2], { $match: { count: { $gt: 1 } } });
    assert.deepEqual(pipeline[1].$group.members,
        { $push: { _id: '$_id', is_locked: { $eq: ['$is_locked', true] } } });
});

test('report performs one aggregation and exposes ids and lock state without writes', async () => {
    let receivedPipeline;
    const rowModel = {
        async aggregate(pipeline) {
            receivedPipeline = pipeline;
            return [{
                _id: { team: 'THA', company_kod: 'COMPANY', ypokatasthma: '0000',
                    kodikos: '0012', hmeromhnia: new Date('2026-08-07Z') },
                count: 2,
                members: [{ _id: 'one', is_locked: true }, { _id: 'two', is_locked: false }]
            }];
        }
    };
    const result = await run(argv, { rowModel });
    assert.deepEqual(receivedPipeline, buildPipeline(parseArgs(argv)));
    assert.equal(result.mode, 'READ_ONLY');
    assert.equal(result.duplicate_group_count, 1);
    assert.deepEqual(result.duplicate_groups[0].members, [
        { _id: 'one', is_locked: true },
        { _id: 'two', is_locked: false }
    ]);
});
