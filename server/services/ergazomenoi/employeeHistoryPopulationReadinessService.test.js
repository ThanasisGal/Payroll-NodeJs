'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { CLASSIFICATIONS, classifyEmployeeHistory, scanEmployeeHistoryPopulation } =
    require('./employeeHistoryPopulationReadinessService');
const { buildReal0002SanitizedHistoryFixture } =
    require('./fixtures/real0002SanitizedHistoryFixture');

test('0002 semantic event reconstruction is repairable and does not block ordinary maintenance', async () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const result = await classifyEmployeeHistory({ currentEmployee: fixture.currentEmployee,
        historyRows: fixture.history, connection: {}, referenceChecker: async () => [] });
    assert.equal(result.classification, CLASSIFICATIONS.REPAIRABLE);
    assert.equal(result.blocksOrdinaryMaintenance, false);
    assert.equal(result.resolver.targetHistoryId, fixture.history[2]._id);
});

test('readiness audits a referenced canonical UPDATE and preserves frozen provenance semantics', async () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const checked = [];
    const result = await classifyEmployeeHistory({ currentEmployee: fixture.currentEmployee,
        historyRows: fixture.history, connection: {}, referenceChecker: async ({ historyIds }) => {
            checked.push(...historyIds);
            return historyIds.includes(fixture.history[0]._id)
                ? [{ collection: 'Apasxoliseis_Period_Frozen_Snapshots', documentId: 'frozen' }]
                : [];
        } });
    assert.deepEqual(checked, [fixture.history[0]._id]);
    assert.equal(result.classification, CLASSIFICATIONS.REPAIRABLE);
    assert.deepEqual(result.references, [{
        collection: 'Apasxoliseis_Period_Frozen_Snapshots',
        documentId: 'frozen', historyId: fixture.history[0]._id, mutation: 'UPDATE'
    }]);
});

test('invalid departure before hire is reported as business data, not a classifier weakness', async () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const current = { ...fixture.currentEmployee,
        hmeromhnia_proslhpshs: '2026-05-04', hmeromhnia_apoxorhshs: '2026-04-30' };
    const row = { ...fixture.history[2], hmeromhnia_proslhpshs: '2026-05-04',
        hmeromhnia_apoxorhshs: '2026-04-30' };
    const result = await classifyEmployeeHistory({ currentEmployee: current,
        historyRows: [row], connection: {}, referenceChecker: async () => [] });
    assert.equal(result.classification, CLASSIFICATIONS.INVALID_BUSINESS_DATA);
    assert.equal(result.reason, 'EMPLOYMENT_CYCLE_DEPARTURE_BEFORE_HIRE');
    assert.equal(result.blocksOrdinaryMaintenance, true);
});

test('population scan batches employee/history reads and emits privacy-safe blockers', async () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const invalid = { ...fixture.currentEmployee, _id: 'invalid', kodikos: '0999',
        hmeromhnia_proslhpshs: '2026-05-04', hmeromhnia_apoxorhshs: '2026-04-30',
        onoma: 'MUST_NOT_APPEAR', afm: 'MUST_NOT_APPEAR' };
    const invalidHistory = { ...fixture.history[2], _id: 'invalid-history', kodikos: '0999',
        hmeromhnia_proslhpshs: '2026-05-04', hmeromhnia_apoxorhshs: '2026-04-30' };
    const employees = [fixture.currentEmployee, invalid];
    let position = 0;
    const cursor = { async hasNext() { return position < employees.length; },
        async next() { return employees[position++]; }, async close() {} };
    const db = { collection(name) {
        if (name === 'Companies') return { find() { return { async toArray() { return [
            { _id: fixture.scope.company_kod, team: fixture.scope.team, kod: '0006' }
        ]; } }; } };
        if (name === 'Ergazomenoi') return { find() { return cursor; } };
        if (name === 'Istoriko_Proslhpseon_Allagon') return { find() { return {
            sort() { return { async toArray() { return [...fixture.history, invalidHistory]; } }; }
        }; } };
        throw new Error(`unexpected ${name}`);
    } };
    const result = await scanEmployeeHistoryPopulation({ db, batchSize: 10,
        referenceChecker: async () => [] });
    assert.equal(result.totalEmployees, 2);
    assert.equal(result.WOULD_ORDINARY_MAINTENANCE_BLOCK_COUNT, 1);
    assert.equal(result.blockers[0].kodikos, '0999');
    assert.equal(result.blockers[0].company_kod, fixture.scope.company_kod);
    assert.equal(result.blockers[0].company_display_code, '0006');
    assert.equal(JSON.stringify(result.blockers).includes('MUST_NOT_APPEAR'), false);
});

test('privacy-safe reporting cannot substitute another company with the same employee code', async () => {
    const fixture = buildReal0002SanitizedHistoryFixture();
    const otherCompanyId = '6a2d40a6ac6a095967000ba0';
    const other = { ...fixture.currentEmployee, _id: 'other-employee',
        company_kod: otherCompanyId };
    const invalidOtherHistory = { ...fixture.history[2], _id: 'other-history',
        company_kod: otherCompanyId, hmeromhnia_proslhpshs: '2026-05-04',
        hmeromhnia_apoxorhshs: '2026-04-30' };
    other.hmeromhnia_proslhpshs = '2026-05-04';
    other.hmeromhnia_apoxorhshs = '2026-04-30';
    const employees = [fixture.currentEmployee, other];
    let position = 0;
    const cursor = { async hasNext() { return position < employees.length; },
        async next() { return employees[position++]; }, async close() {} };
    const db = { collection(name) {
        if (name === 'Companies') return { find() { return { async toArray() { return [
            { _id: fixture.scope.company_kod, team: 'THA', kod: '0006' },
            { _id: otherCompanyId, team: 'THA', kod: '0004' }
        ]; } }; } };
        if (name === 'Ergazomenoi') return { find() { return cursor; } };
        if (name === 'Istoriko_Proslhpseon_Allagon') return { find(query) { return {
            sort() { return { async toArray() {
                const scopes = query.$or.map(item => JSON.stringify(item));
                return [...fixture.history, invalidOtherHistory].filter(row =>
                    scopes.includes(JSON.stringify({ team: row.team,
                        company_kod: String(row.company_kod), kodikos: row.kodikos })));
            } }; }
        }; } };
        throw new Error(`unexpected ${name}`);
    } };
    const result = await scanEmployeeHistoryPopulation({ db, batchSize: 10,
        referenceChecker: async () => [] });
    assert.equal(result.blockers.length, 1);
    assert.deepEqual(Object.fromEntries(['team', 'company_kod', 'company_display_code', 'kodikos']
        .map(field => [field, result.blockers[0][field]])), {
        team: 'THA', company_kod: otherCompanyId, company_display_code: '0004', kodikos: '0002'
    });
});
