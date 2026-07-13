const assert = require('assert');

const {
    buildWeeklyRepoTransferSinglePairProposal,
    PROPOSAL_STATUS,
    PROPOSAL_VERSION,
    CHOICE_CODE
} = require('./apasxoliseisWeeklyRepoTransferSinglePairProposalService');
const {
    getApasxoliseisPolicyByCode
} = require('./apasxoliseisPolicyCatalogService');

const WEEK_START = '2026-07-05';

function dateKey(offset) {
    const date = new Date(`${WEEK_START}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
}

function workRow(offset, overrides = {}) {
    return {
        _id: `row-${offset}`,
        team: 'team-a',
        company_kod: 'company-a',
        kodikos: '001',
        hmeromhnia: dateKey(offset),
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

function fullTimeWeek({ sourceDay = 1, targetDay = 4, existingRepoDay = 6 } = {}) {
    const rows = Array.from({ length: 7 }, (_, offset) => workRow(offset));
    rows[sourceDay] = workRow(sourceDay, { kathgoria_ergasias: 'ΑΝ' });
    rows[targetDay] = workRow(targetDay, {
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    rows[existingRepoDay] = workRow(existingRepoDay, {
        kathgoria_ergasias: 'ΑΝ',
        ores_ergasias: 0,
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    return rows;
}

function partTimeWeek() {
    const rows = Array.from({ length: 7 }, (_, offset) => workRow(offset, { ores_ergasias: 4 }));
    rows[2] = workRow(2, {
        kathgoria_ergasias: 'ΜΕ',
        ores_ergasias: 0,
        cards_ores_ergasias: 4,
        cards_apo_ora_01: '08:30',
        cards_eos_ora_01: '12:30'
    });
    rows[4] = workRow(4, {
        ores_ergasias: 4,
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    rows[6] = workRow(6, {
        kathgoria_ergasias: 'ΜΕ',
        ores_ergasias: 0,
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    return rows;
}

function build(rows, profile = { typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 }, contexts = {}) {
    return buildWeeklyRepoTransferSinglePairProposal({
        weekRows: rows,
        employmentProfile: profile,
        holidayByDateKey: contexts.holidayByDateKey || new Map(),
        existingAuditCountByRowKey: contexts.existingAuditCountByRowKey || new Map()
    });
}

function expectedClearedTarget(category) {
    return {
        kathgoria_ergasias_apologistika: category,
        repo_apologistika: true,
        ores_ergasias_apologistika: 0,
        apo_ora_01_apologistika: '',
        eos_ora_01_apologistika: '',
        apo_ora_02_apologistika: '',
        eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '',
        eos_ora_03_apologistika: ''
    };
}

function assertReadyContract(result, sourceDate, targetDate, targetCategory) {
    assert.strictEqual(result.scenario_code, 'REPO_TRANSFER_WITHIN_WEEK_SINGLE_PAIR');
    assert.strictEqual(result.scenario_version, 'repo-transfer-single-pair:v1');
    assert.strictEqual(result.proposal_version, PROPOSAL_VERSION);
    assert.strictEqual(result.proposal_status, PROPOSAL_STATUS.READY);
    assert.strictEqual(result.choice_code, CHOICE_CODE);
    assert.strictEqual(result.requires_hr_review, true);
    assert.strictEqual(result.can_auto_apply, false);
    assert.strictEqual(result.atomic_pair_required, true);
    assert.strictEqual(result.runtime_apply_supported, false);
    assert.strictEqual(result.items.length, 2);
    assert.strictEqual(result.items[0].role, 'SOURCE_BECOMES_WORK');
    assert.strictEqual(result.items[1].role, 'TARGET_BECOMES_REPO');
    assert.strictEqual(result.items[0].hmeromhnia, sourceDate);
    assert.strictEqual(result.items[1].hmeromhnia, targetDate);
    assert.strictEqual(
        result.items[1].proposed_values.kathgoria_ergasias_apologistika,
        targetCategory
    );
    assert.deepStrictEqual(result.apply_readiness, {
        status: 'BLOCKED',
        reason: 'ATOMIC_APPLY_SUPPORT_REQUIRED'
    });
}

function assertNotAvailable(result, reason) {
    assert.strictEqual(result.proposal_status, PROPOSAL_STATUS.NOT_AVAILABLE);
    assert.deepStrictEqual(result.items, []);
    assert.ok(result.reasons.includes(reason), `${reason} missing from ${result.reasons.join(',')}`);
    assert.strictEqual(JSON.stringify(result).includes('proposed_values'), false);
}

function assertInvalid(result, reason) {
    assert.strictEqual(result.proposal_status, PROPOSAL_STATUS.INVALID_ANALYSIS);
    assert.deepStrictEqual(result.items, []);
    assert.ok(result.reasons.includes(reason), `${reason} missing from ${result.reasons.join(',')}`);
}

function testValidFullTimeProposal() {
    const rows = fullTimeWeek();
    rows[1].cards_apo_ora_01 = '9:00';
    rows[1].cards_eos_ora_01 = '17:00:00';
    const result = build(rows);

    assertReadyContract(result, dateKey(1), dateKey(4), 'ΑΝ');
    assert.deepStrictEqual(result.items[0], {
        role: 'SOURCE_BECOMES_WORK',
        prodhlomena_oraria_id: 'row-1',
        employee_kodikos: '001',
        hmeromhnia: dateKey(1),
        current_category: 'ΑΝ',
        proposed_values: {
            kathgoria_ergasias_apologistika: 'ΕΡΓ',
            repo_apologistika: false,
            apo_ora_01_apologistika: '09:00',
            eos_ora_01_apologistika: '17:00',
            apo_ora_02_apologistika: '',
            eos_ora_02_apologistika: '',
            apo_ora_03_apologistika: '',
            eos_ora_03_apologistika: '',
            ores_ergasias_apologistika: 8
        }
    });
    assert.deepStrictEqual(result.items[1], {
        role: 'TARGET_BECOMES_REPO',
        prodhlomena_oraria_id: 'row-4',
        employee_kodikos: '001',
        hmeromhnia: dateKey(4),
        current_category: 'ΕΡΓ',
        proposed_values: expectedClearedTarget('ΑΝ')
    });
    assert.deepStrictEqual(result.policy_context, {
        weekly_repo_policy_code: 'WEEKLY_REPO_BALANCE',
        weekly_repo_policy_version: 'foundation:v1',
        source_work_policy_code: 'DECLARED_REPO_OR_NON_WORK_WITH_CARDS',
        source_work_policy_version: 'foundation:v1'
    });
}

function testValidPartTimeProposal() {
    const result = build(partTimeWeek(), {
        typos_apasxolhshs: 'MERIKH',
        mhniaia_repo: 2
    });
    assertReadyContract(result, dateKey(2), dateKey(4), 'ΜΕ');
    assert.strictEqual(result.items[0].proposed_values.ores_ergasias_apologistika, 4);
    assert.deepStrictEqual(result.items[1].proposed_values, expectedClearedTarget('ΜΕ'));
}

function testSemanticOrderWhenTargetComesFirst() {
    const result = build(fullTimeWeek({ sourceDay: 5, targetDay: 1, existingRepoDay: 6 }));
    assertReadyContract(result, dateKey(5), dateKey(1), 'ΑΝ');
    assert.ok(result.items[0].hmeromhnia > result.items[1].hmeromhnia);
}

function testSourceIntervalPositionsAndZeroLengthClearing() {
    const rows = fullTimeWeek();
    Object.assign(rows[1], {
        cards_ores_ergasias: '7,5',
        cards_apo_ora_01: '08:00',
        cards_eos_ora_01: '12:00',
        cards_apo_ora_02: '12:30',
        cards_eos_ora_02: '16:00',
        cards_apo_ora_03: '',
        cards_eos_ora_03: ''
    });
    const twoIntervals = build(rows);
    assertReadyContract(twoIntervals, dateKey(1), dateKey(4), 'ΑΝ');
    assert.deepStrictEqual(twoIntervals.items[0].proposed_values, {
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false,
        apo_ora_01_apologistika: '08:00',
        eos_ora_01_apologistika: '12:00',
        apo_ora_02_apologistika: '12:30',
        eos_ora_02_apologistika: '16:00',
        apo_ora_03_apologistika: '',
        eos_ora_03_apologistika: '',
        ores_ergasias_apologistika: 7.5
    });

    const zeroLengthRows = fullTimeWeek();
    Object.assign(zeroLengthRows[1], {
        cards_ores_ergasias: 4,
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '09:00',
        cards_apo_ora_02: '12:00',
        cards_eos_ora_02: '16:00'
    });
    const zeroLength = build(zeroLengthRows);
    assertReadyContract(zeroLength, dateKey(1), dateKey(4), 'ΑΝ');
    assert.strictEqual(zeroLength.items[0].proposed_values.apo_ora_01_apologistika, '');
    assert.strictEqual(zeroLength.items[0].proposed_values.eos_ora_01_apologistika, '');
    assert.strictEqual(
        zeroLength.items[0].proposed_values.apo_ora_02_apologistika,
        '12:00'
    );
    assert.strictEqual(
        zeroLength.items[0].proposed_values.eos_ora_02_apologistika,
        '16:00'
    );

    const invalidExtraPairRows = fullTimeWeek();
    invalidExtraPairRows[1].cards_apo_ora_02 = 'invalid';
    invalidExtraPairRows[1].cards_eos_ora_02 = 'invalid';
    assertInvalid(
        build(invalidExtraPairRows),
        'SOURCE_CARD_INTERVALS_NOT_MATERIALIZABLE'
    );
}

function testSourceCardHourNormalizationAndAuthority() {
    [8, '8', '7,5'].forEach((value) => {
        const rows = fullTimeWeek();
        rows[1].cards_ores_ergasias = value;
        rows[1].ores_ergasias = 99;
        const result = build(rows);
        assert.strictEqual(result.proposal_status, PROPOSAL_STATUS.READY);
        assert.strictEqual(
            result.items[0].proposed_values.ores_ergasias_apologistika,
            value === '7,5' ? 7.5 : 8
        );
    });

    [0, -1, 'invalid', Infinity].forEach((value) => {
        const rows = fullTimeWeek();
        rows[1].cards_ores_ergasias = value;
        assert.notStrictEqual(build(rows).proposal_status, PROPOSAL_STATUS.READY);
    });
}

function testTargetCardAnomaliesAlwaysClearWorkFields() {
    const cases = [
        { cards_apo_ora_01: '09:00', cards_eos_ora_01: '09:00' },
        { cards_apo_ora_01: '09:00', cards_eos_ora_01: '09:15' },
        { cards_apo_ora_01: '09:00', cards_eos_ora_01: '' }
    ];

    cases.forEach((targetCards) => {
        const rows = fullTimeWeek();
        Object.assign(rows[4], targetCards, {
            cards_ores_ergasias: 0,
            ores_ergasias_apologistika: 0,
            apo_ora_02_apologistika: '00:00',
            eos_ora_02_apologistika: '00:00'
        });
        const result = build(rows);
        assertReadyContract(result, dateKey(1), dateKey(4), 'ΑΝ');
        assert.ok(result.warnings.length > 0);
        assert.deepStrictEqual(result.items[1].proposed_values, expectedClearedTarget('ΑΝ'));
    });
}

function testPolicyAllowlistUnion() {
    const result = build(fullTimeWeek());
    const weekly = getApasxoliseisPolicyByCode('WEEKLY_REPO_BALANCE');
    const source = getApasxoliseisPolicyByCode('DECLARED_REPO_OR_NON_WORK_WITH_CARDS');
    const union = new Set([
        ...weekly.proposed_update_fields,
        ...source.proposed_update_fields
    ]);

    result.items.forEach((item) => {
        Object.keys(item.proposed_values).forEach((field) => assert.ok(union.has(field), field));
    });
}

function testMissingAndDuplicateIds() {
    const missingSource = fullTimeWeek();
    delete missingSource[1]._id;
    assertInvalid(build(missingSource), 'MISSING_SOURCE_RECORD_ID');

    const missingTarget = fullTimeWeek();
    delete missingTarget[4]._id;
    assertInvalid(build(missingTarget), 'MISSING_TARGET_RECORD_ID');

    const duplicate = fullTimeWeek();
    duplicate[4]._id = duplicate[1]._id;
    assertInvalid(build(duplicate), 'DUPLICATE_PAIR_RECORD_ID');
}

function testNonEligibleAnalyzerPaths() {
    assertNotAvailable(
        build(fullTimeWeek(), { typos_apasxolhshs: 'EK_PERITROPHS', mhniaia_repo: 2 }),
        'ROTATIONAL_EMPLOYMENT_NOT_SUPPORTED'
    );

    const multipleSources = fullTimeWeek();
    multipleSources[2] = workRow(2, { kathgoria_ergasias: 'ΑΝ' });
    assertNotAvailable(build(multipleSources), 'MULTIPLE_SOURCE_CANDIDATES');

    const multipleTargets = fullTimeWeek();
    multipleTargets[3] = workRow(3, {
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    assertNotAvailable(build(multipleTargets), 'MULTIPLE_TARGET_CANDIDATES');

    const deficit = fullTimeWeek();
    deficit[6] = workRow(6);
    assertNotAvailable(build(deficit), 'REPO_DEFICIT_REMAINS');
    assertNotAvailable(
        build(fullTimeWeek(), { typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 1 }),
        'REPO_LIMIT_EXCEEDED'
    );
    assertNotAvailable(build(fullTimeWeek().slice(0, 6)), 'INCOMPLETE_WEEK_DATA');
}

function deepFreezeFixture(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    if (value instanceof Map) {
        value.forEach((mapValue) => deepFreezeFixture(mapValue));
    } else {
        Object.keys(value).forEach((key) => deepFreezeFixture(value[key]));
    }
    return Object.freeze(value);
}

function testInputImmutabilityAndFreezeIsolation() {
    const mutableRows = fullTimeWeek();
    const mutableProfile = { typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 };
    const mutableHoliday = new Map([[dateKey(0), null]]);
    const mutableAudit = { [dateKey(0)]: 0 };
    const before = JSON.stringify({ mutableRows, mutableProfile, mutableAudit });
    const holidayBefore = [...mutableHoliday.entries()];
    buildWeeklyRepoTransferSinglePairProposal({
        weekRows: mutableRows,
        employmentProfile: mutableProfile,
        holidayByDateKey: mutableHoliday,
        existingAuditCountByRowKey: mutableAudit
    });
    assert.strictEqual(JSON.stringify({ mutableRows, mutableProfile, mutableAudit }), before);
    assert.deepStrictEqual([...mutableHoliday.entries()], holidayBefore);
    assert.strictEqual(Object.isFrozen(mutableRows), false);
    assert.strictEqual(Object.isFrozen(mutableRows[0]), false);
    assert.strictEqual(Object.isFrozen(mutableProfile), false);
    assert.strictEqual(Object.isFrozen(mutableHoliday), false);

    const frozenRows = deepFreezeFixture(fullTimeWeek());
    const frozenProfile = deepFreezeFixture({ typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 });
    const frozenHoliday = deepFreezeFixture(new Map([[dateKey(0), deepFreezeFixture({ isHoliday: false })]]));
    const frozenAudit = deepFreezeFixture({});
    const result = buildWeeklyRepoTransferSinglePairProposal({
        weekRows: frozenRows,
        employmentProfile: frozenProfile,
        holidayByDateKey: frozenHoliday,
        existingAuditCountByRowKey: frozenAudit
    });
    assert.strictEqual(result.proposal_status, PROPOSAL_STATUS.READY);
}

function testOutputImmutabilityAndOwnership() {
    const rows = fullTimeWeek();
    const result = build(rows);
    [
        result,
        result.reasons,
        result.warnings,
        result.week,
        result.employee,
        result.counts,
        result.policy_context,
        result.items,
        result.items[0],
        result.items[0].proposed_values,
        result.items[1],
        result.items[1].proposed_values,
        result.apply_readiness
    ].forEach((value) => assert.strictEqual(Object.isFrozen(value), true));
    assert.notStrictEqual(result.items[0], rows[1]);
    assert.strictEqual(result instanceof Map, false);
    assert.strictEqual(result.week.start_date instanceof Date, false);
}

function testDeterminismAcrossInputOrder() {
    const rows = fullTimeWeek();
    const expected = build(rows);
    const shuffled = build([rows[4], rows[1], rows[6], rows[0], rows[5], rows[2], rows[3]]);
    assert.deepStrictEqual(shuffled, expected);
}

function run() {
    testValidFullTimeProposal();
    testValidPartTimeProposal();
    testSemanticOrderWhenTargetComesFirst();
    testSourceIntervalPositionsAndZeroLengthClearing();
    testSourceCardHourNormalizationAndAuthority();
    testTargetCardAnomaliesAlwaysClearWorkFields();
    testPolicyAllowlistUnion();
    testMissingAndDuplicateIds();
    testNonEligibleAnalyzerPaths();
    testInputImmutabilityAndFreezeIsolation();
    testOutputImmutabilityAndOwnership();
    testDeterminismAcrossInputOrder();
    console.log('apasxoliseis weekly repo transfer single-pair proposal tests passed');
}

run();
