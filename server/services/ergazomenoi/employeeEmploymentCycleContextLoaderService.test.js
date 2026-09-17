'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    LIFECYCLE_HISTORY_FIELDS,
    distinctHireDates,
    preloadEmployeeEmploymentCycleContexts
} = require('./employeeEmploymentCycleContextLoaderService');

function queryResult(rows, capture) {
    return {
        select(value) {
            capture.select = value;
            return this;
        },
        sort(value) {
            capture.sort = value;
            return this;
        },
        async lean() {
            return rows.map((row) => ({ ...row }));
        }
    };
}

test('preloader attaches lifecycle history only to unique masters with multiple hire dates', async () => {
    const capture = { calls: 0 };
    const historyRows = [
        {
            _id: 'old',
            kodikos: '0001',
            hmeromhnia_proslhpshs: '2025-01-01',
            hmeromhnia_apoxorhshs: '2026-07-31',
            hmeromhnia_isxyos_oron_ergasias_apo: '2025-01-01',
            aa_eggrafhs: '0001'
        },
        {
            _id: 'rehire',
            kodikos: '0001',
            hmeromhnia_proslhpshs: '2026-09-17',
            hmeromhnia_apoxorhshs: null,
            hmeromhnia_isxyos_oron_ergasias_apo: '2026-09-17',
            aa_eggrafhs: '0002'
        },
        {
            _id: 'ordinary',
            kodikos: '0002',
            hmeromhnia_proslhpshs: '2025-02-01',
            hmeromhnia_apoxorhshs: null,
            hmeromhnia_isxyos_oron_ergasias_apo: '2025-02-01',
            aa_eggrafhs: '0001'
        }
    ];
    const historyModel = {
        find(filter) {
            capture.calls += 1;
            capture.filter = filter;
            return queryResult(historyRows, capture);
        }
    };
    const employees = [
        {
            _id: 'master-1',
            kodikos: '0001',
            hmeromhnia_proslhpshs: '2026-09-17',
            hmeromhnia_apoxorhshs: null
        },
        {
            _id: 'master-2',
            kodikos: '0002',
            hmeromhnia_proslhpshs: '2025-02-01',
            hmeromhnia_apoxorhshs: null
        }
    ];

    const result = await preloadEmployeeEmploymentCycleContexts({
        team: 'THA',
        company_kod: 'company',
        employees,
        historyModel
    });

    assert.equal(capture.calls, 1);
    assert.equal(capture.filter.team, 'THA');
    assert.equal(capture.filter.company_kod, 'company');
    assert.deepEqual([...capture.filter.kodikos.$in], ['0001', '0002']);
    assert.equal(capture.select, LIFECYCLE_HISTORY_FIELDS.join(' '));
    assert.equal(result[0].employment_history.length, 2);
    assert.equal(Object.hasOwn(result[1], 'employment_history'), false);
    assert.deepEqual(employees[0].employment_history, undefined);
});

test('duplicate physical employee records stay on legacy behavior', async () => {
    let reads = 0;
    const historyModel = {
        find() {
            reads += 1;
            return queryResult([], {});
        }
    };
    const employees = [
        { _id: 'a', kodikos: '0003', hmeromhnia_proslhpshs: '2025-01-01' },
        { _id: 'b', kodikos: '0003', hmeromhnia_proslhpshs: '2026-01-01' }
    ];

    const result = await preloadEmployeeEmploymentCycleContexts({
        team: 'THA',
        company_kod: 'company',
        employees,
        historyModel
    });

    assert.equal(reads, 0);
    assert.equal(Object.hasOwn(result[0], 'employment_history'), false);
    assert.equal(Object.hasOwn(result[1], 'employment_history'), false);
});

test('empty input performs no history read', async () => {
    let reads = 0;
    const result = await preloadEmployeeEmploymentCycleContexts({
        team: 'THA',
        company_kod: 'company',
        employees: [],
        historyModel: {
            find() {
                reads += 1;
                throw new Error('must not read');
            }
        }
    });
    assert.deepEqual(result, []);
    assert.equal(reads, 0);
});

test('distinct hire-date evidence is date-normalized', () => {
    const dates = distinctHireDates(
        { hmeromhnia_proslhpshs: new Date('2026-09-17T12:00:00Z') },
        [
            { hmeromhnia_proslhpshs: '2025-01-01' },
            { hmeromhnia_proslhpshs: '2026-09-17' }
        ]
    );
    assert.deepEqual([...dates].sort(), ['2025-01-01', '2026-09-17']);
});
