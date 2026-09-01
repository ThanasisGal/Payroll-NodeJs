'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const test = require('node:test');
const { BLOCK_REASON, employeeKey, preloadBorrowedEmploymentProfileContexts } =
    require('./apasxoliseisBorrowedEmploymentProfileResolverService');
const { HOLIDAY_CONTEXT_STATUS, preloadEffectiveHolidayContextProvider } =
    require('./apasxoliseisEffectiveHolidayContextProviderService');

const LENDING_COMPANY_ID = '000000000000000000000004';
const BORROWING_COMPANY_ID = '000000000000000000000008';

function employee(overrides = {}) {
    return { _id: 'employee-0031', team: 'THA', company_kod: LENDING_COMPANY_ID,
        kodikos: '0031', hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        kathestos_apasxolhshs: '0', ...overrides };
}
function lendingEmployee(overrides = {}) {
    return employee({ afora_daneismo_ergazomenoy: true,
        typos_ergodoth_daneismoy: false,
        hmnia_enarxhs_daneismoy: new Date('2026-02-18T00:00:00.000Z'),
        hmnia_lhxhs_daneismoy: new Date('2026-02-25T00:00:00.000Z'),
        afm_daneizomenoy_ergodoth: '094259216',
        kodikos_ergazomenoy_alloy_ergodoth: '0031', ...overrides });
}
function borrowingEmployee(overrides = {}) {
    return employee({ _id: 'borrowing-employee-0031',
        company_kod: BORROWING_COMPANY_ID, ...overrides });
}
function queryModel(rows = [], calls = []) {
    return { find(filter) { calls.push(filter); return { select() {
        return { lean: async () => rows.map((row) => ({ ...row })) };
    } }; } };
}
function realPreloadModels({
    companies = [{ _id: BORROWING_COMPANY_ID, afm: '094259216' }],
    employees = [borrowingEmployee()], histories = [], calls = {}
} = {}) {
    calls.companies = calls.companies || [];
    calls.employees = calls.employees || [];
    calls.histories = calls.histories || [];
    return { companiesModel: queryModel(companies, calls.companies),
        employeeModel: queryModel(employees, calls.employees),
        historyModel: queryModel(histories, calls.histories) };
}
function holidayLoader(loadCalls) {
    return async ({ companyId }) => {
        loadCalls.push(companyId);
        return Object.freeze({ company_kodikos: companyId.slice(-4),
            argiesByDateKey: new Map(), companyFlags: {} });
    };
}
async function buildProvider({ employees = [lendingEmployee()],
    periodStart = '2026-02-23T00:00:00.000Z',
    periodEnd = '2026-02-23T23:59:59.999Z', borrowedProfileContexts,
    models = realPreloadModels(), preloadBorrowedContexts, loadCalls = [] } = {}) {
    return preloadEffectiveHolidayContextProvider({ team: 'THA', employees, etos: '2026',
        periodStart: new Date(periodStart), periodEnd: new Date(periodEnd),
        borrowedProfileContexts, models, preloadBorrowedContexts,
        loadHolidayContext: holidayLoader(loadCalls) });
}

test('real borrowing preload maps 0031 through AFM to company 0008', async () => {
    const local = lendingEmployee();
    const models = realPreloadModels();
    const contexts = await preloadBorrowedEmploymentProfileContexts({
        team: 'THA', employees: [local], models });
    const mapped = contexts.get(employeeKey(local));
    assert.strictEqual(mapped.reason, null);
    assert.strictEqual(mapped.borrowingCompanyId, BORROWING_COMPANY_ID);
    assert.strictEqual(mapped.borrowingEmployee.company_kod, BORROWING_COMPANY_ID);

    const loadCalls = [];
    const provider = await buildProvider({ employees: [local], models, loadCalls });
    const result = provider.resolveForEmployeeDate({ employee: local,
        reviewDate: '2026-02-23' });
    assert.strictEqual(result.effectiveProfile.profile_company_id, BORROWING_COMPANY_ID);
    assert.strictEqual(result.effective_company_id, BORROWING_COMPANY_ID);
    assert.deepStrictEqual(loadCalls, [BORROWING_COMPANY_ID]);
    assert.strictEqual(result.holidayContext.company_kodikos, '0008');
});

test('holiday company follows 0004 → 0008 → 0004 by review date', async () => {
    const local = lendingEmployee();
    const loadCalls = [];
    const provider = await buildProvider({ employees: [local], loadCalls,
        periodStart: '2026-02-17T00:00:00.000Z',
        periodEnd: '2026-02-26T23:59:59.999Z' });
    for (const [reviewDate, expected] of [['2026-02-17', LENDING_COMPANY_ID],
        ['2026-02-23', BORROWING_COMPANY_ID], ['2026-02-26', LENDING_COMPANY_ID]]) {
        assert.strictEqual(provider.resolveForEmployeeDate({ employee: local, reviewDate })
            .effective_company_id, expected);
    }
    assert.deepStrictEqual(loadCalls.sort(), [LENDING_COMPANY_ID, BORROWING_COMPANY_ID].sort());
});

test('provided borrowed contexts are reused without another borrowing preload', async () => {
    const local = lendingEmployee();
    const calls = {};
    const models = realPreloadModels({ calls });
    const contexts = await preloadBorrowedEmploymentProfileContexts({
        team: 'THA', employees: [local], models });
    const readsBefore = Object.values(calls).reduce((sum, rows) => sum + rows.length, 0);
    let duplicatePreloads = 0;
    const provider = await buildProvider({ employees: [local], models,
        borrowedProfileContexts: contexts,
        preloadBorrowedContexts: async () => { duplicatePreloads += 1; return new Map(); } });
    assert.strictEqual(provider.resolveForEmployeeDate({ employee: local,
        reviewDate: '2026-02-23' }).effective_company_id, BORROWING_COMPANY_ID);
    assert.strictEqual(duplicatePreloads, 0);
    assert.strictEqual(Object.values(calls).reduce((sum, rows) => sum + rows.length, 0),
        readsBefore);
});

test('without provided contexts one batched preload is performed', async () => {
    const local = lendingEmployee();
    const contexts = await preloadBorrowedEmploymentProfileContexts({
        team: 'THA', employees: [local], models: realPreloadModels() });
    let preloadCalls = 0;
    const provider = await buildProvider({ employees: [local],
        preloadBorrowedContexts: async () => { preloadCalls += 1; return contexts; } });
    provider.resolveForEmployeeDate({ employee: local, reviewDate: '2026-02-23' });
    provider.resolveForEmployeeDate({ employee: local, reviewDate: '2026-02-23' });
    assert.strictEqual(preloadCalls, 1);
});

test('blocked company and employee mappings never load borrowing holidays', async () => {
    for (const [fixture, expectedReason] of [
        [{ companies: [], employees: [] }, BLOCK_REASON.COMPANY_MISSING],
        [{ companies: [{ _id: BORROWING_COMPANY_ID, afm: '094259216' },
            { _id: '000000000000000000000009', afm: '094259216' }], employees: [] },
        BLOCK_REASON.COMPANY_AMBIGUOUS],
        [{ companies: [{ _id: BORROWING_COMPANY_ID, afm: '094259216' }], employees: [] },
        BLOCK_REASON.EMPLOYEE_MISSING],
        [{ companies: [{ _id: BORROWING_COMPANY_ID, afm: '094259216' }],
            employees: [borrowingEmployee({ _id: 'borrowed-a' }),
                borrowingEmployee({ _id: 'borrowed-b' })] },
        BLOCK_REASON.EMPLOYEE_AMBIGUOUS]
    ]) {
        const local = lendingEmployee();
        const loadCalls = [];
        const provider = await buildProvider({ employees: [local], loadCalls,
            models: realPreloadModels(fixture) });
        const result = provider.resolveForEmployeeDate({ employee: local,
            reviewDate: '2026-02-23' });
        assert.strictEqual(result.status, HOLIDAY_CONTEXT_STATUS.BLOCKED);
        assert.strictEqual(result.resolution_reason, expectedReason);
        assert.strictEqual(result.effective_company_id, null);
        assert.strictEqual(result.holidayContext, null);
        assert.deepStrictEqual(loadCalls, []);
    }
});

test('overlapping borrowing history blocks without loading borrowing holidays', async () => {
    const history = (id) => ({ _id: id, company_kod: BORROWING_COMPANY_ID,
        kodikos: '0031', afora_allagh_oron_ergasias: true,
        hmeromhnia_isxyos_oron_ergasias_apo: new Date('2026-02-01T00:00:00.000Z'),
        hmeromhnia_isxyos_oron_ergasias_eos: new Date('2026-02-28T00:00:00.000Z'),
        hmeres_ergasias_ebdomadas: 5, ores_ergasias_ebdomadas: 40,
        kathestos_apasxolhshs: '0' });
    const loadCalls = [];
    const provider = await buildProvider({ loadCalls, models: realPreloadModels({
        histories: [history('history-a'), history('history-b')] }) });
    const result = provider.resolveForEmployeeDate({ employee: lendingEmployee(),
        reviewDate: '2026-02-23' });
    assert.strictEqual(result.resolution_reason, BLOCK_REASON.HISTORY_OVERLAP);
    assert.strictEqual(result.effective_company_id, null);
    assert.strictEqual(result.holidayContext, null);
    assert.deepStrictEqual(loadCalls, []);
});

test('same company returns the identical cached holiday context object', async () => {
    const first = employee({ _id: 'employee-0031' });
    const second = employee({ _id: 'employee-0042', kodikos: '0042' });
    const loadCalls = [];
    const provider = await buildProvider({ employees: [first, second], loadCalls,
        borrowedProfileContexts: new Map() });
    const one = provider.resolveForEmployeeDate({ employee: first, reviewDate: '2026-02-23' });
    const two = provider.resolveForEmployeeDate({ employee: second, reviewDate: '2026-02-23' });
    assert.strictEqual(one.holidayContext, two.holidayContext);
    assert.deepStrictEqual(loadCalls, [LENDING_COMPANY_ID]);
});

test('ObjectId object and equivalent mixed-case string share one cache entry', async () => {
    const objectId = new mongoose.Types.ObjectId('ABCDEFABCDEFABCDEFABCDEF');
    const first = employee({ _id: 'employee-object', company_kod: objectId });
    const second = employee({ _id: 'employee-string', kodikos: '0042',
        company_kod: 'AbCdEfAbCdEfAbCdEfAbCdEf' });
    const loadCalls = [];
    const provider = await buildProvider({ employees: [first, second], loadCalls,
        borrowedProfileContexts: new Map() });
    const one = provider.resolveForEmployeeDate({ employee: first, reviewDate: '2026-02-23' });
    const two = provider.resolveForEmployeeDate({ employee: second, reviewDate: '2026-02-23' });
    assert.strictEqual(one.effective_company_id, 'abcdefabcdefabcdefabcdef');
    assert.strictEqual(two.effective_company_id, one.effective_company_id);
    assert.strictEqual(one.holidayContext, two.holidayContext);
    assert.deepStrictEqual(loadCalls, ['abcdefabcdefabcdefabcdef']);
});

test('non-borrowed employee keeps normal period-company semantics', async () => {
    const local = employee();
    const loadCalls = [];
    let preloadCalls = 0;
    const provider = await buildProvider({ employees: [local], loadCalls,
        preloadBorrowedContexts: async () => { preloadCalls += 1; return new Map(); } });
    const result = provider.resolveForEmployeeDate({ employee: local,
        reviewDate: '2026-02-23' });
    assert.strictEqual(result.status, HOLIDAY_CONTEXT_STATUS.RESOLVED);
    assert.strictEqual(result.effective_company_id, LENDING_COMPANY_ID);
    assert.strictEqual(result.effectiveProfile.profile_company_id, LENDING_COMPANY_ID);
    assert.deepStrictEqual(loadCalls, [LENDING_COMPANY_ID]);
    assert.strictEqual(preloadCalls, 1);
});
