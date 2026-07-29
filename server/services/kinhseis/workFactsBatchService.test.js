const assert = require('node:assert/strict');
const test = require('node:test');

const {
    generateWorkFactsForCompanyPeriod
} = require('./workFactsBatchService');

test('one persisted batch as-of context is propagated unchanged to every employee', async () => {
    const jobKey = 'THA|company|ALL|2026-07-01|2026-07-31|MONTHLY';
    const calls = [];
    const startedJob = {
        _id: '507f1f77bcf86cd799439011',
        jobKey,
        status: 'RUNNING',
        asOfDate: '2026-07-02',
        asOfDateSource: 'SESSION_APP_DATE'
    };
    const result = await generateWorkFactsForCompanyPeriod({
        team: 'THA',
        company_kod: 'company',
        apo: '2026-07-01',
        eos: '2026-07-31',
        scope: 'MONTHLY',
        startedJob,
        dependencies: {
            employeeLoader: async () => [
                { kodikos: '0001' },
                { kodikos: '0002' }
            ],
            snapshotFinder: async () => null,
            snapshotGenerator: async (input) => {
                calls.push(input);
                return { status: 'READY', saveStatus: 'CREATED' };
            },
            jobFinisher: async ({ update }) => ({
                ...startedJob,
                ...update,
                asOfDate: startedJob.asOfDate,
                asOfDateSource: startedJob.asOfDateSource
            }),
            progressUpdater: async () => startedJob
        }
    });

    assert.equal(result.status, 'SUCCESS');
    assert.equal(calls.length, 2);
    assert.deepEqual(
        calls.map(({ kodikos, asOfDate, asOfDateSource }) => ({
            kodikos,
            asOfDate,
            asOfDateSource
        })),
        [
            {
                kodikos: '0001',
                asOfDate: '2026-07-02',
                asOfDateSource: 'SESSION_APP_DATE'
            },
            {
                kodikos: '0002',
                asOfDate: '2026-07-02',
                asOfDateSource: 'SESSION_APP_DATE'
            }
        ]
    );
});

test('invalid explicit batch as-of context fails before employee loading', async () => {
    let employeeLoads = 0;
    const result = await generateWorkFactsForCompanyPeriod({
        team: 'THA',
        company_kod: 'company',
        apo: '2026-07-01',
        eos: '2026-07-31',
        scope: 'MONTHLY',
        asOfDate: 'invalid',
        asOfDateSource: 'SESSION_APP_DATE',
        clock: () => new Date('2026-07-28T00:00:00.000Z'),
        dryRun: true,
        dependencies: {
            employeeLoader: async () => {
                employeeLoads += 1;
                return [];
            }
        }
    });

    assert.equal(result.status, 'FAILED');
    assert.ok(result.warnings.includes('INVALID_AS_OF_DATE'));
    assert.equal(employeeLoads, 0);
});
