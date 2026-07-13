const assert = require('assert');

const {
    buildWeeklyRepoTransferAtomicInputs,
    buildWeeklyRepoTransferAtomicPageProjection,
    composePolicyPreviewResponse,
    getAtomicPeriodRangeDiagnostic,
    buildCompanyWideUniqueEmployeeByKodikos,
    isEmployeeCompatibleWithBranch,
    MAX_ATOMIC_PERIOD_DAYS,
    INPUT_REASON
} = require('./apasxoliseisWeeklyRepoTransferAtomicPageProjectionService');

function dateKey(start, offset) {
    const date = new Date(`${start}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
}

function workRow(start, offset, employeeKodikos = '001', overrides = {}) {
    return {
        _id: `${employeeKodikos}-${dateKey(start, offset)}`,
        team: 'team-a',
        company_kod: 'company-a',
        ypokatasthma: '0001',
        kodikos: employeeKodikos,
        hmeromhnia: dateKey(start, offset),
        kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 8,
        cards_ores_ergasias: 8,
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '17:00',
        cards_apo_ora_02: '',
        cards_eos_ora_02: '',
        cards_apo_ora_03: '',
        cards_eos_ora_03: '',
        ...overrides
    };
}

function fullTimeWeek(start = '2026-07-05', employeeKodikos = '001') {
    const rows = Array.from({ length: 7 }, (_, offset) =>
        workRow(start, offset, employeeKodikos)
    );
    rows[1] = workRow(start, 1, employeeKodikos, { kathgoria_ergasias: 'ΑΝ' });
    rows[4] = workRow(start, 4, employeeKodikos, {
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    rows[6] = workRow(start, 6, employeeKodikos, {
        kathgoria_ergasias: 'ΑΝ',
        ores_ergasias: 0,
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    return rows;
}

function partTimeWeek(start = '2026-07-05', employeeKodikos = '001') {
    const rows = Array.from({ length: 7 }, (_, offset) =>
        workRow(start, offset, employeeKodikos, { ores_ergasias: 4 })
    );
    rows[2] = workRow(start, 2, employeeKodikos, {
        kathgoria_ergasias: 'ΜΕ',
        ores_ergasias: 0,
        cards_ores_ergasias: 4,
        cards_apo_ora_01: '08:30',
        cards_eos_ora_01: '12:30'
    });
    rows[4] = workRow(start, 4, employeeKodikos, {
        ores_ergasias: 4,
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    rows[6] = workRow(start, 6, employeeKodikos, {
        kathgoria_ergasias: 'ΜΕ',
        ores_ergasias: 0,
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    return rows;
}

function weeklyInput(
    rows,
    employmentProfile = { typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 }
) {
    return {
        weekRows: rows,
        employmentProfile,
        holidayByDateKey: new Map(),
        existingAuditCountByRowKey: new Map()
    };
}

function testCompleteWeekInputConstruction() {
    const validRows = fullTimeWeek();
    const partialRows = fullTimeWeek('2026-07-12', '002').slice(0, 4);
    const calls = [];
    const result = buildWeeklyRepoTransferAtomicInputs({
        rows: [...partialRows, ...validRows].reverse(),
        periodStart: '2026-07-05',
        periodEnd: '2026-07-18',
        resolveEmploymentProfile: (context) => {
            calls.push(context);
            return { typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 };
        }
    });

    assert.strictEqual(result.weeklyInputs.length, 1);
    assert.deepStrictEqual(
        result.weeklyInputs[0].weekRows.map((row) => row.hmeromhnia),
        validRows.map((row) => row.hmeromhnia)
    );
    assert.deepStrictEqual(result.inputReasonCodes, [INPUT_REASON.INCOMPLETE_WEEK]);
    assert.deepStrictEqual(calls, [
        {
            team: 'team-a',
            company_kod: 'company-a',
            ypokatasthma: '0001',
            employee_kodikos: '001',
            week_start: '2026-07-05',
            week_end: '2026-07-11'
        }
    ]);

    const partialPeriod = buildWeeklyRepoTransferAtomicInputs({
        rows: validRows.slice(1),
        periodStart: '2026-07-06',
        periodEnd: '2026-07-11',
        resolveEmploymentProfile: () => ({ typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 })
    });
    assert.deepStrictEqual(partialPeriod.weeklyInputs, []);
    assert.deepStrictEqual(partialPeriod.inputReasonCodes, [INPUT_REASON.PARTIAL_WEEK]);

    const duplicateRows = fullTimeWeek();
    duplicateRows.push({ ...duplicateRows[3], _id: 'duplicate-date-row' });
    const duplicate = buildWeeklyRepoTransferAtomicInputs({
        rows: duplicateRows,
        periodStart: '2026-07-05',
        periodEnd: '2026-07-11',
        resolveEmploymentProfile: () => ({ typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 })
    });
    assert.deepStrictEqual(duplicate.weeklyInputs, []);
    assert.deepStrictEqual(duplicate.inputReasonCodes, [INPUT_REASON.DUPLICATE_DATE]);

    const noRange = buildWeeklyRepoTransferAtomicInputs({ rows: validRows });
    assert.deepStrictEqual(noRange.weeklyInputs, []);
    assert.deepStrictEqual(noRange.inputReasonCodes, [INPUT_REASON.DATE_RANGE_REQUIRED]);

    const unresolvedHolidayContext = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: [],
        inputReasonCodes: [INPUT_REASON.HOLIDAY_CONTEXT_NOT_RESOLVED]
    });
    assert.strictEqual(
        unresolvedHolidayContext.reason_counts.ATOMIC_HOLIDAY_CONTEXT_NOT_RESOLVED,
        1
    );
}

function testValidFullTimeAndPartTimeWeeks() {
    const fullTime = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: [weeklyInput(fullTimeWeek())]
    });
    assert.deepStrictEqual(fullTime.summary, {
        weeks_evaluated: 1,
        groups_count: 1,
        decision_units_count: 1,
        items_count: 2,
        employees_count: 1,
        ready_count: 1,
        not_available_count: 0,
        invalid_projection_count: 0
    });
    assert.strictEqual(fullTime.groups.length, 1);
    assert.deepStrictEqual(
        fullTime.groups[0].items.map((item) => item.role),
        ['SOURCE_BECOMES_WORK', 'TARGET_BECOMES_REPO']
    );

    const partTime = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: [
            weeklyInput(partTimeWeek(), { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 2 })
        ]
    });
    const target = partTime.groups[0].items[1];
    assert.strictEqual(target.proposed_values.kathgoria_ergasias_apologistika, 'ΜΕ');
    assert.strictEqual(target.proposed_values.repo_apologistika, true);
}

function testInputConstructionSeparatesEmployeesAndWeeks() {
    const employeeOneFirstWeek = fullTimeWeek('2026-07-05', '001');
    const employeeTwoFirstWeek = fullTimeWeek('2026-07-05', '002');
    const employeeOneSecondWeek = fullTimeWeek('2026-07-12', '001');
    const rows = [
        ...employeeOneSecondWeek,
        ...employeeTwoFirstWeek,
        ...employeeOneFirstWeek
    ].reverse();
    const before = JSON.stringify(rows);
    const result = buildWeeklyRepoTransferAtomicInputs({
        rows,
        periodStart: '2026-07-05',
        periodEnd: '2026-07-18',
        resolveEmploymentProfile: () => ({
            typos_apasxolhshs: 'PLHRHS',
            mhniaia_repo: 2
        })
    });

    assert.strictEqual(result.weeklyInputs.length, 3);
    assert.deepStrictEqual(
        result.weeklyInputs.map((input) => [
            input.weekRows[0].kodikos,
            input.weekRows[0].hmeromhnia,
            input.weekRows[6].hmeromhnia
        ]),
        [
            ['001', '2026-07-05', '2026-07-11'],
            ['001', '2026-07-12', '2026-07-18'],
            ['002', '2026-07-05', '2026-07-11']
        ]
    );
    assert.strictEqual(JSON.stringify(rows), before);
}

function testBranchAwareBucketsAndResolverContext() {
    const branchOne = fullTimeWeek().map((row) => ({ ...row, ypokatasthma: '0001' }));
    const branchTwo = fullTimeWeek().map((row, index) => ({
        ...row,
        _id: `branch-2-${index}`,
        ypokatasthma: '0002'
    }));
    const contexts = [];
    const separated = buildWeeklyRepoTransferAtomicInputs({
        rows: [...branchTwo, ...branchOne].reverse(),
        periodStart: '2026-07-05',
        periodEnd: '2026-07-11',
        resolveEmploymentProfile: (context) => {
            contexts.push(context);
            return { typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 };
        }
    });

    assert.strictEqual(separated.weeklyInputs.length, 2);
    assert.deepStrictEqual(
        separated.weeklyInputs.map((input) => [
            input.weekRows[0].ypokatasthma,
            new Set(input.weekRows.map((row) => row.ypokatasthma)).size
        ]),
        [
            ['0001', 1],
            ['0002', 1]
        ]
    );
    assert.deepStrictEqual(contexts[0], {
        team: 'team-a',
        company_kod: 'company-a',
        ypokatasthma: '0001',
        employee_kodikos: '001',
        week_start: '2026-07-05',
        week_end: '2026-07-11'
    });

    const complementary = buildWeeklyRepoTransferAtomicInputs({
        rows: [...branchOne.slice(0, 3), ...branchTwo.slice(3)],
        periodStart: '2026-07-05',
        periodEnd: '2026-07-11',
        resolveEmploymentProfile: () => ({ typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 })
    });
    assert.deepStrictEqual(complementary.weeklyInputs, []);
    assert.deepStrictEqual(complementary.inputReasonCodes, [
        INPUT_REASON.INCOMPLETE_WEEK,
        INPUT_REASON.INCOMPLETE_WEEK
    ]);

    const missingBranch = buildWeeklyRepoTransferAtomicInputs({
        rows: branchOne.map((row) => ({ ...row, ypokatasthma: '' })),
        periodStart: '2026-07-05',
        periodEnd: '2026-07-11',
        resolveEmploymentProfile: () => ({ typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 })
    });
    assert.deepStrictEqual(missingBranch.weeklyInputs, []);
    assert.strictEqual(missingBranch.inputReasonCodes.length, 7);
    assert.ok(missingBranch.inputReasonCodes.every((reason) => reason === INPUT_REASON.INVALID_ROW));
}

function testCompanyWideEmployeeUniquenessAndBranchCompatibility() {
    const employee = {
        kodikos: '001',
        ypokatasthma: '0001',
        energos: true,
        archived: false
    };
    const unique = buildCompanyWideUniqueEmployeeByKodikos([employee]);
    assert.strictEqual(unique.get('001'), employee);

    const duplicateCases = [
        [{ ...employee }, { ...employee }],
        [{ ...employee }, { ...employee, energos: false, archived: true }],
        [{ ...employee }, { ...employee, energos: false, archived: false }],
        [{ ...employee }, { ...employee, ypokatasthma: '0002' }]
    ];
    duplicateCases.forEach((employees) => {
        assert.strictEqual(buildCompanyWideUniqueEmployeeByKodikos(employees).get('001'), null);
    });

    assert.strictEqual(isEmployeeCompatibleWithBranch(employee, '0001'), true);
    assert.strictEqual(isEmployeeCompatibleWithBranch(employee, '0002'), false);
    assert.strictEqual(isEmployeeCompatibleWithBranch({ ...employee, ypokatasthma: '' }, '0001'), false);
    assert.strictEqual(isEmployeeCompatibleWithBranch(employee, ''), false);

    const branchMismatch = buildWeeklyRepoTransferAtomicInputs({
        rows: fullTimeWeek(),
        periodStart: '2026-07-05',
        periodEnd: '2026-07-11',
        resolveEmploymentProfile: ({ ypokatasthma }) =>
            isEmployeeCompatibleWithBranch({ ...employee, ypokatasthma: '0002' }, ypokatasthma)
                ? { typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 }
                : null
    });
    assert.deepStrictEqual(branchMismatch.weeklyInputs, []);
    assert.deepStrictEqual(branchMismatch.inputReasonCodes, [INPUT_REASON.PROFILE_NOT_RESOLVED]);
}

function testAtomicPeriodRangeLimit() {
    assert.strictEqual(MAX_ATOMIC_PERIOD_DAYS, 62);
    assert.strictEqual(
        getAtomicPeriodRangeDiagnostic({
            periodStart: '2026-01-01',
            periodEnd: '2026-03-03'
        }),
        null
    );
    assert.strictEqual(
        getAtomicPeriodRangeDiagnostic({
            periodStart: '2026-01-01',
            periodEnd: '2026-03-04'
        }),
        INPUT_REASON.DATE_RANGE_EXCEEDS_LIMIT
    );

    const overLimit = buildWeeklyRepoTransferAtomicInputs({
        rows: fullTimeWeek(),
        periodStart: '2026-01-01',
        periodEnd: '2026-03-04',
        resolveEmploymentProfile: () => ({ typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 })
    });
    assert.deepStrictEqual(overLimit.weeklyInputs, []);
    assert.deepStrictEqual(overLimit.inputReasonCodes, [INPUT_REASON.DATE_RANGE_EXCEEDS_LIMIT]);

    const pageProjection = buildWeeklyRepoTransferAtomicPageProjection(overLimit);
    assert.deepStrictEqual(pageProjection.reason_counts, {
        ATOMIC_DATE_RANGE_EXCEEDS_LIMIT: 1
    });
}

function testMultipleEmployeesAndWeeksSortDeterministically() {
    const employeeTwo = weeklyInput(fullTimeWeek('2026-07-05', '002'));
    const employeeOne = weeklyInput(fullTimeWeek('2026-07-05', '001'));
    const nextWeek = weeklyInput(fullTimeWeek('2026-07-12', '001'));
    const result = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: [nextWeek, employeeTwo, employeeOne]
    });

    assert.strictEqual(result.summary.weeks_evaluated, 3);
    assert.strictEqual(result.summary.groups_count, 3);
    assert.strictEqual(result.summary.employees_count, 2);
    assert.strictEqual(result.summary.items_count, 6);
    assert.deepStrictEqual(
        result.groups.map((group) => [
            group.first_date,
            group.representative_item.employee_kodikos
        ]),
        [
            ['2026-07-06', '001'],
            ['2026-07-06', '002'],
            ['2026-07-13', '001']
        ]
    );
    assert.notStrictEqual(result.groups[0].group_id, result.groups[2].group_id);
}

function testNonReadyInvalidAndDuplicateDiagnostics() {
    const nonReady = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: [
            weeklyInput(fullTimeWeek(), {
                typos_apasxolhshs: 'EK_PERITROPHS',
                mhniaia_repo: 2
            })
        ]
    });
    assert.strictEqual(nonReady.summary.not_available_count, 1);
    assert.strictEqual(nonReady.summary.groups_count, 0);
    assert.strictEqual(nonReady.reason_counts.ROTATIONAL_EMPLOYMENT_NOT_SUPPORTED, 1);

    const invalid = buildWeeklyRepoTransferAtomicPageProjection(
        { weeklyInputs: [weeklyInput(fullTimeWeek())] },
        {
            singleWeekProjectionBuilder: () => ({
                projection_status: 'INVALID_PROJECTION',
                reasons: ['TEST_INVALID_PROJECTION'],
                warnings: [],
                groups: []
            })
        }
    );
    assert.strictEqual(invalid.summary.invalid_projection_count, 1);
    assert.strictEqual(invalid.summary.groups_count, 0);
    assert.strictEqual(invalid.reason_counts.TEST_INVALID_PROJECTION, 1);

    const duplicateInput = weeklyInput(fullTimeWeek());
    const duplicate = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: [duplicateInput, duplicateInput],
        inputReasonCodes: ['INCOMPLETE_EMPLOYEE_WEEK']
    });
    assert.strictEqual(duplicate.summary.ready_count, 1);
    assert.strictEqual(duplicate.summary.groups_count, 1);
    assert.strictEqual(duplicate.summary.decision_units_count, 1);
    assert.strictEqual(duplicate.summary.items_count, 2);
    assert.strictEqual(duplicate.reason_counts.DUPLICATE_ATOMIC_GROUP_ID, 1);
    assert.strictEqual(duplicate.reason_counts.INCOMPLETE_EMPLOYEE_WEEK, 1);
}

function testSplitShiftReachesPageProjection() {
    const rows = fullTimeWeek();
    Object.assign(rows[1], {
        cards_ores_ergasias: '7,5',
        cards_apo_ora_01: '08:00',
        cards_eos_ora_01: '12:00',
        cards_apo_ora_02: '12:30',
        cards_eos_ora_02: '16:00'
    });
    const result = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: [weeklyInput(rows)]
    });
    const values = result.groups[0].items[0].proposed_values;

    assert.strictEqual(values.apo_ora_01_apologistika, '08:00');
    assert.strictEqual(values.eos_ora_01_apologistika, '12:00');
    assert.strictEqual(values.apo_ora_02_apologistika, '12:30');
    assert.strictEqual(values.eos_ora_02_apologistika, '16:00');
    assert.strictEqual(values.apo_ora_03_apologistika, '');
    assert.strictEqual(values.eos_ora_03_apologistika, '');
    assert.strictEqual(values.ores_ergasias_apologistika, 7.5);
}

function testDeterminismOwnershipAndInputPreservation() {
    const rowsOne = fullTimeWeek('2026-07-05', '001');
    const rowsTwo = fullTimeWeek('2026-07-05', '002');
    const inputs = [weeklyInput(rowsTwo), weeklyInput(rowsOne)];
    const before = JSON.stringify([rowsOne, rowsTwo]);
    const first = buildWeeklyRepoTransferAtomicPageProjection({ weeklyInputs: inputs });
    const shuffled = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: [
            { ...inputs[1], weekRows: [...inputs[1].weekRows].reverse() },
            { ...inputs[0], weekRows: [...inputs[0].weekRows].reverse() }
        ]
    });

    assert.deepStrictEqual(shuffled, first);
    assert.strictEqual(JSON.stringify([rowsOne, rowsTwo]), before);
    assert.strictEqual(Object.isFrozen(rowsOne), false);
    assert.strictEqual(Object.isFrozen(inputs), false);
    assert.notStrictEqual(first.groups[0], inputs[1]);

    const seen = new Set();
    function assertFrozenPlainGraph(value) {
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        assert.strictEqual(Object.isFrozen(value), true);
        assert.strictEqual(value instanceof Date, false);
        assert.strictEqual(value instanceof Map, false);
        assert.strictEqual(value instanceof Set, false);
        const prototype = Object.getPrototypeOf(value);
        assert.ok(Array.isArray(value) || prototype === Object.prototype || prototype === null);
        Object.values(value).forEach(assertFrozenPlainGraph);
    }
    assertFrozenPlainGraph(first);
}

function testWarningsAndResponseComposition() {
    const rows = fullTimeWeek();
    rows[4].cards_apo_ora_01 = '09:00';
    rows[4].cards_eos_ora_01 = '09:15';
    const atomic = buildWeeklyRepoTransferAtomicPageProjection({
        weeklyInputs: [weeklyInput(rows)]
    });
    assert.strictEqual(atomic.warning_counts.TARGET_ZERO_HOURS_WITH_CARD_INTERVALS, 1);

    const grouping = { version: 1, scope: 'page', summary: { groups_count: 0 }, groups: [] };
    const baseResponse = {
        success: true,
        page: 2,
        limit: 50,
        total: 125,
        totalPages: 3,
        count: 50,
        summary: { total: 50 },
        grouping,
        rows: [{ prodhlomena_oraria_id: 'page-row' }]
    };
    const response = composePolicyPreviewResponse({
        baseResponse,
        atomicGroupProjection: atomic
    });

    assert.deepStrictEqual(
        Object.keys(response),
        [...Object.keys(baseResponse), 'atomic_group_projection']
    );
    Object.keys(baseResponse).forEach((key) => assert.strictEqual(response[key], baseResponse[key]));
    assert.strictEqual(response.grouping, grouping);
    assert.strictEqual(response.grouping.groups.includes(atomic.groups[0]), false);
    assert.strictEqual(response.atomic_group_projection, atomic);
    assert.doesNotThrow(() => JSON.stringify(response));
    assert.strictEqual(JSON.stringify(response).includes('APPROVE_PREFILL'), false);
}

function run() {
    testCompleteWeekInputConstruction();
    testValidFullTimeAndPartTimeWeeks();
    testInputConstructionSeparatesEmployeesAndWeeks();
    testBranchAwareBucketsAndResolverContext();
    testCompanyWideEmployeeUniquenessAndBranchCompatibility();
    testAtomicPeriodRangeLimit();
    testMultipleEmployeesAndWeeksSortDeterministically();
    testNonReadyInvalidAndDuplicateDiagnostics();
    testSplitShiftReachesPageProjection();
    testDeterminismOwnershipAndInputPreservation();
    testWarningsAndResponseComposition();
    console.log('apasxoliseis weekly repo transfer atomic page projection tests passed');
}

run();
