'use strict';

const assert = require('assert');
const test = require('node:test');
const mongoose = require('mongoose');
const { CompaniesModel } = require('../../models/companies');
const { ErgazomenoiModel, ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');
const {
    candidateEmployeeFilter,
    sourceCompaniesFilter,
    sourceSchedulesFilter,
    targetSchedulesFilter,
    resolveBorrowedSourceContext,
    updateBorrowedEmployeeDeclaredSchedules
} = require('./daneizomenoiProdhlomenaOrariaUpdateService');

const scope = {
    team: 'TEAM-A',
    company_kod: '64b000000000000000000001',
    target_ypokatasthma: '0001',
    source_ypokatasthma: '0099',
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-08-31T00:00:00.000Z')
};
const sourceCompanyId = '64b000000000000000000002';
const validAfm = '094259216';

function query(rows) {
    return {
        select() { return this; },
        lean: async () => rows
    };
}

function harness({ employees = [], companies = [], sourceRows = [], targetRows = [], bulkResults = [] } = {}) {
    const calls = { employeeFind: [], companyFind: [], scheduleFind: [], targetFind: [], bulkWrite: [] };
    let bulkIndex = 0;
    return {
        calls,
        models: {
            employeeModel: {
                find(filter) { calls.employeeFind.push(filter); return query(employees); }
            },
            companiesModel: {
                find(filter) { calls.companyFind.push(filter); return query(companies); }
            },
            prodhlomenaModel: {
                find(filter) {
                    if (String(filter.company_kod) === String(scope.company_kod)) {
                        calls.targetFind.push(filter);
                        return query(targetRows);
                    }
                    calls.scheduleFind.push(filter);
                    return query(sourceRows.filter((row) =>
                        String(row.company_kod) === String(filter.company_kod) &&
                        String(row.ypokatasthma) === String(filter.ypokatasthma)));
                },
                async bulkWrite(ops, options) {
                    calls.bulkWrite.push({ ops, options });
                    return bulkResults[bulkIndex++] || { upsertedCount: ops.length, modifiedCount: 0 };
                },
                async deleteMany() { throw new Error('deleteMany must never be called'); },
                async deleteOne() { throw new Error('deleteOne must never be called'); }
            }
        }
    };
}

function employee(overrides = {}) {
    return {
        kodikos: '0031',
        afm_daneizomenoy_ergodoth: validAfm,
        kodikos_ergazomenoy_alloy_ergodoth: '0003',
        ...overrides
    };
}

function sourceRow(overrides = {}) {
    return {
        team: scope.team,
        company_kod: sourceCompanyId,
        ypokatasthma: '0099',
        kodikos: '0003',
        hmeromhnia: new Date('2026-08-05T00:00:00.000Z'),
        kathgoria_ergasias: 'ΕΡΓ',
        apo_ora_01: '08:00', eos_ora_01: '16:00',
        apo_ora_02: '', eos_ora_02: '', apo_ora_03: '', eos_ora_03: '',
        repo: false, argia: false, perigrafh_argias: '', ores_ergasias: 8,
        cards_apo_ora_01: 'SHOULD_NOT_COPY',
        orphan_card_resolution: { unsafe: true },
        is_locked: true,
        ...overrides
    };
}

test('candidate query is server-scoped and includes only explicit lending-employer employees', () => {
    assert.deepStrictEqual(candidateEmployeeFilter(scope), {
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: scope.target_ypokatasthma,
        afora_daneismo_ergazomenoy: true,
        typos_ergodoth_daneismoy: false
    });
});

test('candidate query excludes every non-explicit flag/team/company/branch variant', async () => {
    const all = [
        { ...employee(), team: scope.team, company_kod: scope.company_kod, ypokatasthma: scope.target_ypokatasthma,
            afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false },
        { ...employee(), kodikos: '1001', team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.target_ypokatasthma, afora_daneismo_ergazomenoy: false, typos_ergodoth_daneismoy: false },
        { ...employee(), kodikos: '1002', team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.target_ypokatasthma, typos_ergodoth_daneismoy: false },
        { ...employee(), kodikos: '1003', team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.target_ypokatasthma, afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: true },
        { ...employee(), kodikos: '1004', team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: scope.target_ypokatasthma, afora_daneismo_ergazomenoy: true },
        { ...employee(), kodikos: '1005', team: 'OTHER', company_kod: scope.company_kod,
            ypokatasthma: scope.target_ypokatasthma, afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false },
        { ...employee(), kodikos: '1006', team: scope.team, company_kod: 'OTHER',
            ypokatasthma: scope.target_ypokatasthma, afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false },
        { ...employee(), kodikos: '1007', team: scope.team, company_kod: scope.company_kod,
            ypokatasthma: '9999', afora_daneismo_ergazomenoy: true, typos_ergodoth_daneismoy: false }
    ];
    const h = harness({ companies: [{ _id: sourceCompanyId, afm: validAfm }] });
    h.models.employeeModel.find = (filter) => {
        h.calls.employeeFind.push(filter);
        return query(all.filter((row) => Object.entries(filter).every(([key, value]) => row[key] === value)));
    };
    const result = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: h.models });
    assert.equal(result.targetEmployeesFound, 1);
});

test('maps target 0031 to source 0003 and bulk-upserts the target identity only', async () => {
    const h = harness({
        employees: [employee()],
        companies: [{ _id: sourceCompanyId, afm: validAfm }],
        sourceRows: [sourceRow()]
    });
    const summary = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: h.models });
    assert.equal(summary.targetEmployeesFound, 1);
    assert.equal(summary.validMappings, 1);
    assert.equal(summary.sourceRowsFound, 1);
    assert.equal(summary.sourceCompanyResolved, true);
    assert.equal(summary.sourceBranchValidated, true);
    assert.equal(summary.targetRowsInserted, 1);
    assert.equal(h.calls.employeeFind.length, 1);
    assert.equal(h.calls.companyFind.length, 1);
    assert.equal(h.calls.scheduleFind.length, 1);
    assert.equal(h.calls.scheduleFind[0].ypokatasthma, '0099');
    const operation = h.calls.bulkWrite[0].ops[0].updateOne;
    assert.deepStrictEqual(operation.filter, {
        team: scope.team,
        company_kod: scope.company_kod,
        ypokatasthma: scope.target_ypokatasthma,
        kodikos: '0031',
        hmeromhnia: new Date('2026-08-05T00:00:00.000Z')
    });
    assert.notEqual(h.calls.scheduleFind[0].ypokatasthma, operation.filter.ypokatasthma);
    assert.equal(operation.upsert, true);
    assert.equal(operation.update.$set.apo_ora_01, '08:00');
    assert.equal(operation.update.$set.cards_apo_ora_01, '');
    for (const protectedField of [
        '_id', 'team', 'company_kod', 'kodikos', 'ypokatasthma', 'hmeromhnia',
        'orphan_card_resolution', 'is_locked', 'compensation_breakdown_apologistika'
    ]) assert.ok(!Object.hasOwn(operation.update.$set, protectedField), protectedField);
});

test('repeated identical execution uses the same identity and creates no duplicate', async () => {
    const h = harness({
        employees: [employee()],
        companies: [{ _id: sourceCompanyId, afm: validAfm }],
        sourceRows: [sourceRow()],
        bulkResults: [
            { upsertedCount: 1, modifiedCount: 0 },
            { upsertedCount: 0, modifiedCount: 0 }
        ]
    });
    const first = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: h.models });
    const second = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: h.models });
    assert.equal(first.targetRowsInserted, 1);
    assert.equal(second.targetRowsInserted, 0);
    assert.deepStrictEqual(
        h.calls.bulkWrite[0].ops[0].updateOne.filter,
        h.calls.bulkWrite[1].ops[0].updateOne.filter
    );
});

test('an existing target row is reported as updated without creating a new row', async () => {
    const h = harness({
        employees: [employee()],
        companies: [{ _id: sourceCompanyId, afm: validAfm }],
        sourceRows: [sourceRow({ apo_ora_01: '09:00', eos_ora_01: '17:00' })],
        targetRows: [{
            team: scope.team, company_kod: scope.company_kod, ypokatasthma: scope.target_ypokatasthma,
            kodikos: '0031', hmeromhnia: new Date('2026-08-05T00:00:00.000Z')
        }],
        bulkResults: [{ upsertedCount: 0, modifiedCount: 1 }]
    });
    const summary = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: h.models });
    assert.equal(summary.targetRowsInserted, 0);
    assert.equal(summary.targetRowsUpdated, 1);
    assert.equal(h.calls.bulkWrite[0].ops[0].updateOne.upsert, true);
});

test('no existing target row is upserted as an insert', async () => {
    const h = harness({
        employees: [employee()],
        companies: [{ _id: sourceCompanyId, afm: validAfm }],
        sourceRows: [sourceRow()]
    });
    const summary = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: h.models });
    assert.equal(summary.targetRowsInserted, 1);
    assert.equal(h.calls.targetFind.length, 1);
    assert.equal(h.calls.bulkWrite.length, 1);
});

test('duplicate existing target identity is ambiguous and is never written', async () => {
    const targetIdentity = {
        team: scope.team, company_kod: scope.company_kod, ypokatasthma: scope.target_ypokatasthma,
        kodikos: '0031', hmeromhnia: new Date('2026-08-05T00:00:00.000Z')
    };
    const h = harness({
        employees: [employee()],
        companies: [{ _id: sourceCompanyId, afm: validAfm }],
        sourceRows: [sourceRow()],
        targetRows: [{ _id: '1', ...targetIdentity }, { _id: '2', ...targetIdentity }]
    });
    const summary = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: h.models });
    assert.equal(summary.targetAmbiguities, 1);
    assert.equal(summary.targetRowsInserted, 0);
    assert.equal(summary.targetRowsUpdated, 0);
    assert.equal(h.calls.bulkWrite.length, 0);
});

test('invalid or missing employee mappings perform no writes', async () => {
    for (const candidate of [
        employee({ afm_daneizomenoy_ergodoth: '' }),
        employee({ afm_daneizomenoy_ergodoth: '123' }),
        employee({ kodikos_ergazomenoy_alloy_ergodoth: '' })
    ]) {
        const h = harness({ employees: [candidate] });
        const result = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: h.models });
        assert.equal(result.validationError, 'SOURCE_COMPANY_NOT_FOUND');
        assert.equal(h.calls.bulkWrite.length, 0);
    }
});

test('missing or duplicate source companies perform no writes', async () => {
    for (const companies of [
        [],
        [{ _id: sourceCompanyId, afm: validAfm }, { _id: `${sourceCompanyId.slice(0, -1)}3`, afm: validAfm }]
    ]) {
        const h = harness({ employees: [employee()], companies });
        const result = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: h.models });
        assert.ok(['SOURCE_COMPANY_NOT_FOUND', 'MULTIPLE_SOURCE_COMPANIES'].includes(result.validationError));
        assert.equal(h.calls.bulkWrite.length, 0);
    }
});

test('duplicate source mapping and ambiguous source day are skipped without writes', async () => {
    const duplicateMapping = harness({
        employees: [employee(), employee({ kodikos: '0032' })],
        companies: [{ _id: sourceCompanyId, afm: validAfm }],
        sourceRows: [sourceRow()]
    });
    const duplicateSummary = await updateBorrowedEmployeeDeclaredSchedules({
        scope, models: duplicateMapping.models
    });
    assert.equal(duplicateSummary.conflicts, 1);
    assert.equal(duplicateMapping.calls.bulkWrite.length, 0);

    const ambiguousRows = harness({
        employees: [employee()],
        companies: [{ _id: sourceCompanyId, afm: validAfm }],
        sourceRows: [sourceRow(), sourceRow({ apo_ora_01: '09:00' })]
    });
    const ambiguousSummary = await updateBorrowedEmployeeDeclaredSchedules({
        scope, models: ambiguousRows.models
    });
    assert.equal(ambiguousSummary.ambiguities, 1);
    assert.equal(ambiguousSummary.employeesWithoutSourceRows, 0);
    assert.equal(ambiguousRows.calls.bulkWrite.length, 0);
});

test('empty candidates and source periods perform no writes or deletes', async () => {
    const empty = harness();
    const emptySummary = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: empty.models });
    assert.equal(emptySummary.targetEmployeesFound, 0);
    assert.equal(empty.calls.companyFind.length, 0);

    const noRows = harness({
        employees: [employee()],
        companies: [{ _id: sourceCompanyId, afm: validAfm }]
    });
    const noRowsSummary = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: noRows.models });
    assert.equal(noRowsSummary.employeesWithoutSourceRows, 1);
    assert.equal(noRows.calls.bulkWrite.length, 0);
});

test('multiple source companies stop before source reads or writes', async () => {
    const secondCompanyId = '64b000000000000000000003';
    const secondAfm = '090000045';
    const h = harness({
        employees: [employee(), employee({
            kodikos: '0032',
            afm_daneizomenoy_ergodoth: secondAfm,
            kodikos_ergazomenoy_alloy_ergodoth: '0004'
        })],
        companies: [
            { _id: sourceCompanyId, afm: validAfm },
            { _id: secondCompanyId, afm: secondAfm }
        ],
        sourceRows: [
            sourceRow(),
            sourceRow({ company_kod: secondCompanyId, kodikos: '0004' })
        ]
    });
    const summary = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: h.models });
    assert.equal(h.calls.employeeFind.length, 1);
    assert.equal(h.calls.companyFind.length, 1);
    assert.equal(summary.validationError, 'MULTIPLE_SOURCE_COMPANIES');
    assert.equal(h.calls.scheduleFind.length, 0);
    assert.equal(h.calls.targetFind.length, 0);
    assert.equal(h.calls.bulkWrite.length, 0);
});

test('rows in another source branch are excluded and do not create ambiguity', async () => {
    const h = harness({
        employees: [employee()],
        companies: [{ _id: sourceCompanyId, afm: validAfm }],
        sourceRows: [sourceRow(), sourceRow({ ypokatasthma: '0088', apo_ora_01: '09:00' })]
    });
    const summary = await updateBorrowedEmployeeDeclaredSchedules({ scope, models: h.models });
    assert.equal(summary.ambiguities, 0);
    assert.equal(summary.targetRowsInserted, 1);
    assert.equal(h.calls.scheduleFind[0].ypokatasthma, scope.source_ypokatasthma);
});

test('trusted company/source-code/date filters survive real Mongoose sanitize and cast', () => {
    const previous = mongoose.get('sanitizeFilter');
    mongoose.set('sanitizeFilter', true);
    try {
        const companyQuery = CompaniesModel.find(sourceCompaniesFilter(scope.team, [validAfm]));
        mongoose.sanitizeFilter(companyQuery.getFilter());
        assert.doesNotThrow(() => companyQuery.cast());

        const scheduleQuery = ProdhlomenaOrariaModel.find(sourceSchedulesFilter({
            team: scope.team,
            sourceCompanyId,
            sourceBranch: scope.source_ypokatasthma,
            sourceCodes: ['0003'],
            startDate: scope.startDate,
            endDate: scope.endDate
        }));
        mongoose.sanitizeFilter(scheduleQuery.getFilter());
        assert.doesNotThrow(() => scheduleQuery.cast());
        assert.equal(scheduleQuery.getFilter().ypokatasthma, scope.source_ypokatasthma);

        const employeeQuery = ErgazomenoiModel.find(candidateEmployeeFilter(scope));
        mongoose.sanitizeFilter(employeeQuery.getFilter());
        assert.doesNotThrow(() => employeeQuery.cast());

        const targetQuery = ProdhlomenaOrariaModel.find(targetSchedulesFilter({
            scope,
            targetCodes: ['0031', '0032']
        }));
        mongoose.sanitizeFilter(targetQuery.getFilter());
        assert.doesNotThrow(() => targetQuery.cast());
        assert.equal(targetQuery.getFilter().kodikos.$in.length, 2);
        assert.ok(targetQuery.getFilter().hmeromhnia.$gte instanceof Date);
        assert.ok(targetQuery.getFilter().hmeromhnia.$lte instanceof Date);
    } finally {
        mongoose.set('sanitizeFilter', previous);
    }
});
