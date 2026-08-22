const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('./erganhController');
const {
    hasLendingSideBorrowedEmployees
} = require('../../services/ergazomenoi/erganiImportedEmployeeScopeService');

const { saveTelikoToProdhlomena } = controller.__scheduleDownloadTestHooks;
const { saveKartesPayloadToMongo } = controller.__cardsDownloadTestHooks;
const scope = { team: 'THA', company_kod: '69e8e92fb198b803164b824a', ypokatasthma: '0000' };
const otherCompany = '6a43937c651b88e0f3f3024a';

function cell(value) { return { value, text: String(value ?? '') }; }
function scheduleSheet(afm = '123456789', branch = '0000') {
    const values = [branch, afm, 'TEST', 'USER', '01/06/2026', 'ΕΡΓ', '08:00', '16:00'];
    return { eachRow(fn) { fn({ getCell: (number) => cell(values[number - 1]) }, 1); } };
}
function query(rows) { return { select() { return this; }, lean: async () => rows }; }
function employeeModel(employees) {
    return { find: (filter) => ({ lean: async () => employees.filter((employee) =>
        employee.team === filter.team &&
        employee.company_kod === filter.company_kod &&
        employee.ypokatasthma === filter.ypokatasthma &&
        filter.afm.$in.includes(employee.afm)
    ) }) };
}
function dependencies(employees) {
    const writes = [];
    return {
        writes,
        value: {
            ergazomenoiModel: employeeModel(employees),
            argiesModel: { find: () => ({ lean: async () => [] }) },
            prodhlomenaModel: {
                find: () => query([]),
                bulkWrite: async (ops) => { writes.push(...ops); return { upsertedCount: ops.length, modifiedCount: 0 }; }
            }
        }
    };
}
const targetEmployee = { afm: '123456789', kodikos: '0001', ...scope };
const otherEmployee = { afm: '123456789', kodikos: '9999', team: 'THA', company_kod: otherCompany, ypokatasthma: '0000' };

const eligibilityCases = [
    { name: 'explicit normal employee', fields: { afora_daneismo_ergazomenoy: false, typos_ergodoth_daneismoy: false }, expectedWrites: 1 },
    { name: 'borrowed employee', fields: { afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false }, expectedWrites: 0 },
    { name: 'borrowed employee of borrowing employer', fields: { afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: true }, expectedWrites: 1 },
    { name: 'inconsistent false/true legacy employee', fields: { afora_daneismo_ergazomenoy: false, typos_ergodoth_daneismoy: true }, expectedWrites: 1 },
    { name: 'legacy employee without lending fields', fields: {}, expectedWrites: 1 }
];

test('borrowed transfer availability uses one company-scoped true/false lookup', async () => {
    let receivedFilter;
    const available = await hasLendingSideBorrowedEmployees({
        team: 'THA', company_kod: scope.company_kod,
        employeeModel: {
            findOne(filter) {
                receivedFilter = filter;
                return { select: () => ({ lean: async () => ({ _id: 'employee' }) }) };
            }
        }
    });
    assert.equal(available, true);
    assert.deepEqual(receivedFilter, {
        team: 'THA', company_kod: scope.company_kod,
        afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false
    });
});

for (const eligibilityCase of eligibilityCases) {
    test(`schedule import eligibility: ${eligibilityCase.name}`, async () => {
        const harness = dependencies([{ ...targetEmployee, ...eligibilityCase.fields }]);
        const result = await saveTelikoToProdhlomena(scheduleSheet(), '2026', scope, harness.value);
        assert.equal(result.bulkOps.length, eligibilityCase.expectedWrites);
        assert.equal(harness.writes.length, eligibilityCase.expectedWrites);
    });
}

test('schedule import writes only the authorized company when AFM exists in both companies', async () => {
    const harness = dependencies([otherEmployee, targetEmployee]);
    const result = await saveTelikoToProdhlomena(scheduleSheet(), '2026', scope, harness.value);
    assert.equal(result.bulkOps.length, 1);
    assert.equal(harness.writes[0].updateOne.filter.company_kod, scope.company_kod);
    assert.equal(harness.writes.some((op) => op.updateOne.filter.company_kod === otherCompany), false);
});

test('schedule import does not write wrong-company-only or ambiguous in-scope AFMs', async () => {
    for (const employees of [[otherEmployee], [targetEmployee, { ...targetEmployee, _id: 'duplicate' }]]) {
        const harness = dependencies(employees);
        const result = await saveTelikoToProdhlomena(scheduleSheet(), '2026', scope, harness.value);
        assert.equal(result.bulkOps.length, 0);
        assert.equal(harness.writes.length, 0);
        assert.equal(result.diagnostics.length, 1);
    }
});

test('schedule import rejects a row from another branch', async () => {
    const harness = dependencies([targetEmployee]);
    const result = await saveTelikoToProdhlomena(scheduleSheet('123456789', '0001'), '2026', scope, harness.value);
    assert.equal(result.bulkOps.length, 0);
    assert.equal(harness.writes.length, 0);
});

function cardRows(branch = '0000') {
    return [{ rowNumber: 1, ypokatasthma: branch, afm: '123456789', hmeromhnia_raw: '01/06/2026', apo_ora: '08:00', eos_ora: '16:00', h_check: 'Ok' }];
}

test('cards update filter is pinned to authorized team company branch', async () => {
    const writes = [];
    const result = await saveKartesPayloadToMongo(cardRows(), {
        authorizedScope: scope,
        ergazomenoiModel: employeeModel([otherEmployee, targetEmployee]),
        prodhlomenaModel: { bulkWrite: async (ops) => { writes.push(...ops); return { matchedCount: 1, modifiedCount: 1 }; } }
    });
    assert.equal(result.bulkOps.length, 1);
    assert.deepEqual(writes[0].updateOne.filter, {
        team: scope.team, company_kod: scope.company_kod, ypokatasthma: scope.ypokatasthma,
        kodikos: targetEmployee.kodikos, hmeromhnia: new Date('2026-06-01T00:00:00.000Z')
    });
    assert.equal(writes[0].updateOne.upsert, false);
});

test('cards perform no update for wrong-company-only, ambiguous, or other-branch evidence', async () => {
    for (const [employees, rows] of [
        [[otherEmployee], cardRows()],
        [[targetEmployee, { ...targetEmployee, _id: 'duplicate' }], cardRows()],
        [[targetEmployee], cardRows('0001')]
    ]) {
        let writes = 0;
        const result = await saveKartesPayloadToMongo(rows, {
            authorizedScope: scope,
            ergazomenoiModel: { find: () => ({ lean: async () => employees }) },
            prodhlomenaModel: { bulkWrite: async () => { writes++; } }
        });
        assert.equal(result.bulkOps.length, 0);
        assert.equal(writes, 0);
        assert.equal(result.diagnostics.length, 1);
    }
});
