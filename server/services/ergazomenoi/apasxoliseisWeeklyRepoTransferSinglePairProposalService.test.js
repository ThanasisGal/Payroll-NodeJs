const assert = require('assert');

const {
    buildWeeklyRepoTransferSinglePairProposal,
    PROPOSAL_STATUS,
    PROPOSAL_VERSION,
    PROPOSAL_VERSION_V2,
    CHOICE_CODE
} = require('./apasxoliseisWeeklyRepoTransferSinglePairProposalService');
const {
    getApasxoliseisPolicyByCode
} = require('./apasxoliseisPolicyCatalogService');

const WEEK_START = '2026-07-06';

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

function build(rows, profile = { typos_apasxolhshs: 'PLHRHS'}, contexts = {}) {
    return buildWeeklyRepoTransferSinglePairProposal({
        weekRows: rows,
        employmentProfile: { hmeres_ergasias_ebdomadas: 5, ...profile },
        holidayByDateKey: contexts.holidayByDateKey || new Map(),
        existingAuditCountByRowKey: contexts.existingAuditCountByRowKey || new Map()
    });
}

function buildV2(rows, dependencies = {}) {
    return buildWeeklyRepoTransferSinglePairProposal({
        weekRows: rows,
        employmentProfile: {
            typos_apasxolhshs: 'MERIKH', hmeres_ergasias_ebdomadas: 5
        },
        contractVersion: 'v2'
    }, dependencies);
}

function expectedClearedTarget(category) {
    return {
        kathgoria_ergasias_apologistika: category,
        repo_apologistika: true,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: '',
        ores_ergasias_apologistika: 0,
        ores_pragmatikhs_ergasias_apologistika: 0,
        ores_adeias_pistomenes_apologistika: 0,
        ores_argias_pistomenes_apologistika: 0,
        compensation_breakdown_apologistika: null,
        ores_apoysias_apologistika: 0,
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
    assert.strictEqual(result.scenario_version, 'repo-transfer-single-pair:v4');
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
    assert.strictEqual(
        result.items[0].proposed_values.ores_pragmatikhs_ergasias_apologistika,
        result.items[0].proposed_values.ores_ergasias_apologistika
    );
    for (const item of result.items) {
        assert.strictEqual(item.proposed_values.ores_adeias_pistomenes_apologistika, 0);
        assert.strictEqual(item.proposed_values.ores_argias_pistomenes_apologistika, 0);
        assert.strictEqual(item.proposed_values.compensation_breakdown_apologistika, null);
    }
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
            adeia_apologistika: false,
            kathgoria_adeias_apologistika: '',
            ores_apoysias_apologistika: 0,
            apo_ora_01_apologistika: '09:00',
            eos_ora_01_apologistika: '17:00',
            apo_ora_02_apologistika: '',
            eos_ora_02_apologistika: '',
            apo_ora_03_apologistika: '',
            eos_ora_03_apologistika: '',
            ores_ergasias_apologistika: 8,
            ores_pragmatikhs_ergasias_apologistika: 8,
            ores_adeias_pistomenes_apologistika: 0,
            ores_argias_pistomenes_apologistika: 0,
            compensation_breakdown_apologistika: null
        }
    });
    assert.deepStrictEqual(result.items[1], {
        role: 'TARGET_BECOMES_REPO',
        prodhlomena_oraria_id: 'row-4',
        employee_kodikos: '001',
        hmeromhnia: dateKey(4),
        current_category: 'ΕΡΓ',
        current_apologistika_category: 'ΑΔΕΙΑ',
        proposed_values: expectedClearedTarget('ΑΝ')
    });
    assert.deepStrictEqual(result.policy_context, {
        weekly_repo_policy_code: 'WEEKLY_REPO_BALANCE',
        weekly_repo_policy_version: 'foundation:v3',
        source_work_policy_code: 'DECLARED_REPO_OR_NON_WORK_WITH_CARDS',
        source_work_policy_version: 'foundation:v3'
    });
}

function testValidPartTimeProposal() {
    const result = build(partTimeWeek(), {
        typos_apasxolhshs: 'MERIKH'
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
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: '',
        ores_apoysias_apologistika: 0,
        apo_ora_01_apologistika: '08:00',
        eos_ora_01_apologistika: '12:00',
        apo_ora_02_apologistika: '12:30',
        eos_ora_02_apologistika: '16:00',
        apo_ora_03_apologistika: '',
        eos_ora_03_apologistika: '',
        ores_ergasias_apologistika: 7.5,
        ores_pragmatikhs_ergasias_apologistika: 7.5,
        ores_adeias_pistomenes_apologistika: 0,
        ores_argias_pistomenes_apologistika: 0,
        compensation_breakdown_apologistika: null
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
    assertNotAvailable(
        build(invalidExtraPairRows),
        'CARD_VERIFICATION_PENDING'
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

function testTargetCardAnomaliesAreNotAvailable() {
    const cases = [
        [{ cards_apo_ora_01: '09:00', cards_eos_ora_01: '09:00' },
            'TARGET_ZERO_HOURS_WITH_ZERO_LENGTH_CARD_INTERVAL'],
        [{ cards_apo_ora_01: '09:00', cards_eos_ora_01: '09:15' },
            'TARGET_ZERO_HOURS_WITH_CARD_INTERVALS'],
        [{ cards_apo_ora_01: '09:00', cards_eos_ora_01: '' },
            'TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR']
    ];

    cases.forEach(([targetCards, reason]) => {
        const rows = fullTimeWeek();
        Object.assign(rows[4], targetCards, {
            cards_ores_ergasias: 0,
            ores_ergasias_apologistika: 0,
            apo_ora_02_apologistika: '00:00',
            eos_ora_02_apologistika: '00:00'
        });
        const result = build(rows);
        assertNotAvailable(result, reason);
    });
}

function testProposalClearsProvisionalAutoLeaveFieldsWithoutMutatingRows() {
    const rows = fullTimeWeek();
    Object.assign(rows[4], {
        apologistiko_biblio: true,
        adeia_apologistika: true,
        kathgoria_ergasias_apologistika: 'ΑΔΕΙΑ',
        kathgoria_adeias_apologistika: 'ΑΔΑΛ',
        ores_ergasias_apologistika: 8,
        ores_apoysias_apologistika: 0,
        apo_ora_01_apologistika: '',
        eos_ora_01_apologistika: '',
        apo_ora_02_apologistika: '',
        eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '',
        eos_ora_03_apologistika: ''
    });
    const before = JSON.stringify(rows);
    const result = build(rows);

    assertReadyContract(result, dateKey(1), dateKey(4), 'ΑΝ');
    assert.deepStrictEqual(result.items[1].proposed_values, expectedClearedTarget('ΑΝ'));
    assert.strictEqual(JSON.stringify(rows), before);
    assert.strictEqual(rows[4].adeia_apologistika, true);
    assert.strictEqual(rows[4].kathgoria_ergasias_apologistika, 'ΑΔΕΙΑ');
    assert.ok(
        !Object.prototype.hasOwnProperty.call(
            result.items[1].proposed_values,
            'apologistiko_biblio'
        )
    );
}

function testSourceProposalClearsLeaveButPreservesHolidayPayrollFields() {
    const rows = fullTimeWeek();
    Object.assign(rows[1], {
        argia: true,
        argia_apologistika: true,
        apologistiko_biblio: true,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apo_ora_01_apologistika: '09:00',
        eos_ora_01_apologistika: '17:00',
        ores_ergasias_apologistika: 8,
        ores_argion_prosayxhsh_apologistika: 8,
        ores_argion_ergasia_apologistika: 8
    });
    const before = JSON.stringify(rows);
    const result = build(rows, undefined, {
        holidayByDateKey: new Map([
            [
                dateKey(1),
                {
                    isHoliday: true,
                    isMandatoryHoliday: false,
                    isOptionalHoliday: true,
                    companyOperatesOnHoliday: true,
                    blocksRepoTransfer: false,
                    description: 'Μη υποχρεωτική αργία'
                }
            ]
        ])
    });

    assertReadyContract(result, dateKey(1), dateKey(4), 'ΑΝ');
    const values = result.items[0].proposed_values;
    assert.strictEqual(values.adeia_apologistika, false);
    assert.strictEqual(values.kathgoria_adeias_apologistika, '');
    assert.strictEqual(values.ores_apoysias_apologistika, 0);
    [
        'argia',
        'argia_apologistika',
        'ores_argion_prosayxhsh_apologistika',
        'ores_argion_ergasia_apologistika',
        'kyriakes_apologistika'
    ].forEach((field) => assert.ok(!Object.prototype.hasOwnProperty.call(values, field), field));
    assert.ok(!Object.prototype.hasOwnProperty.call(values, 'apologistiko_biblio'));
    assert.strictEqual(JSON.stringify(rows), before);
}

function testSourceProposalPreservesCompatibleCalculatedShapeAndBookFlag() {
    const rows = fullTimeWeek();
    Object.assign(rows[1], {
        ores_ergasias: 0,
        cards_apo_ora_01: '08:01',
        cards_eos_ora_01: '15:59',
        cards_ores_ergasias: 7.966666666666667,
        apologistiko_biblio: true,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apo_ora_01_apologistika: '08:01',
        eos_ora_01_apologistika: '16:01',
        ores_ergasias_apologistika: 7.47,
        ores_nyxtas_apologistika: 0.25
    });
    rows[4].apologistiko_biblio = true;
    const before = JSON.stringify(rows);
    const result = build(rows, {
        typos_apasxolhshs: 'PLHRHS', mo_oron_hmerhsias_ergasias: 8,
        external_break_minutes: 30
    });

    assertReadyContract(result, dateKey(1), dateKey(4), 'ΑΝ');
    const sourceValues = result.items[0].proposed_values;
    assert.strictEqual(sourceValues.apo_ora_01_apologistika, '08:01');
    assert.strictEqual(sourceValues.eos_ora_01_apologistika, '16:01');
    assert.strictEqual(sourceValues.ores_ergasias_apologistika, 7.47);
    assert.ok(!Object.prototype.hasOwnProperty.call(sourceValues, 'apologistiko_biblio'));
    assert.ok(
        !Object.prototype.hasOwnProperty.call(
            result.items[1].proposed_values,
            'apologistiko_biblio'
        )
    );
    assert.strictEqual(JSON.stringify(rows), before);
    assert.strictEqual(rows[1].apologistiko_biblio, true);
    assert.strictEqual(rows[4].apologistiko_biblio, true);
}

function testPartialProposalClearsProvisionalAutoLeaveFields() {
    const rows = partTimeWeek();
    Object.assign(rows[4], {
        adeia_apologistika: true,
        kathgoria_ergasias_apologistika: 'ΑΔΕΙΑ',
        kathgoria_adeias_apologistika: 'ΑΔΑΛ',
        ores_ergasias_apologistika: 4,
        ores_apoysias_apologistika: 0
    });
    const result = build(rows, {
        typos_apasxolhshs: 'MERIKH'
    });

    assertReadyContract(result, dateKey(2), dateKey(4), 'ΜΕ');
    assert.deepStrictEqual(result.items[1].proposed_values, expectedClearedTarget('ΜΕ'));
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

function testV2InvalidResultsPreserveVersions() {
    const assertV2Invalid = (result, reason) => {
        assertInvalid(result, reason);
        assert.strictEqual(result.scenario_version, 'repo-transfer-single-pair:v4');
        assert.strictEqual(result.proposal_version, PROPOSAL_VERSION_V2);
    };

    const missingSource = partTimeWeek();
    delete missingSource[2]._id;
    assertV2Invalid(buildV2(missingSource), 'MISSING_SOURCE_RECORD_ID');

    const missingTarget = partTimeWeek();
    delete missingTarget[4]._id;
    assertV2Invalid(buildV2(missingTarget), 'MISSING_TARGET_RECORD_ID');

    const invalidIntervals = partTimeWeek();
    invalidIntervals[2].cards_apo_ora_02 = 'invalid';
    invalidIntervals[2].cards_eos_ora_02 = 'invalid';
    const invalidIntervalResult = buildV2(invalidIntervals);
    assertNotAvailable(invalidIntervalResult, 'CARD_VERIFICATION_PENDING');
    assert.strictEqual(invalidIntervalResult.scenario_version, 'repo-transfer-single-pair:v4');
    assert.strictEqual(invalidIntervalResult.proposal_version, PROPOSAL_VERSION_V2);

    const validRows = partTimeWeek();
    const validAnalysis = require(
        './apasxoliseisWeeklyRepoTransferSinglePairService'
    ).analyzeWeeklyRepoTransferSinglePairV2({
        weekRows: validRows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH', hmeres_ergasias_ebdomadas: 5 }
    });

    const invalidHours = partTimeWeek();
    invalidHours[2].cards_ores_ergasias = 'invalid';
    assertV2Invalid(
        buildV2(invalidHours, { analyzer: () => validAnalysis }),
        'SOURCE_CARD_HOURS_NOT_MATERIALIZABLE'
    );

    const fallbackRows = partTimeWeek();
    Object.assign(fallbackRows[4], {
        cards_ores_ergasias: 4,
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '13:00'
    });
    const fallbackAnalysis = require(
        './apasxoliseisWeeklyRepoTransferSinglePairService'
    ).analyzeWeeklyRepoTransferSinglePairV2({
        weekRows: fallbackRows,
        employmentProfile: { typos_apasxolhshs: 'MERIKH', hmeres_ergasias_ebdomadas: 5 }
    });
    fallbackRows[2].cards_ores_ergasias = 'not-a-number';
    assertV2Invalid(
        buildV2(fallbackRows, { analyzer: () => fallbackAnalysis }),
        'SOURCE_CARD_HOURS_NOT_MATERIALIZABLE'
    );

    assertV2Invalid(
        buildV2(validRows, {
            analyzer: () => ({
                ...validAnalysis,
                target: {
                    ...validAnalysis.target,
                    semantic_target_category: 'ΑΔΕΙΑ'
                }
            })
        }),
        'TARGET_CATEGORY_NOT_MATERIALIZABLE'
    );

    assertV2Invalid(
        buildV2(validRows, {
            materializeTargetValues: () => ({
                kathgoria_ergasias_apologistika: 'ΜΕ',
                unsupported_field: true
            })
        }),
        'PROPOSED_FIELD_NOT_ALLOWED'
    );

    const v1MissingSource = fullTimeWeek();
    delete v1MissingSource[1]._id;
    const v1Result = build(v1MissingSource);
    assertInvalid(v1Result, 'MISSING_SOURCE_RECORD_ID');
    assert.strictEqual(v1Result.scenario_version, 'repo-transfer-single-pair:v4');
    assert.strictEqual(v1Result.proposal_version, PROPOSAL_VERSION);
}

function testNonEligibleAnalyzerPaths() {
    assertNotAvailable(
        build(fullTimeWeek(), { typos_apasxolhshs: 'EK_PERITROPHS'}),
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
    assertNotAvailable(
        build(deficit),
        'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'
    );
    assert.strictEqual(
        build(fullTimeWeek(), { typos_apasxolhshs: 'PLHRHS'})
            .proposal_status,
        'READY'
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
    const mutableProfile = { typos_apasxolhshs: 'PLHRHS'};
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
    const frozenProfile = deepFreezeFixture({
        typos_apasxolhshs: 'PLHRHS', hmeres_ergasias_ebdomadas: 5
    });
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

function testTargetCarriesDerivedCurrentDisplayCategoryWithoutChangingProposal() {
    const result = build(fullTimeWeek());
    const target = result.items[1];

    assert.strictEqual(target.current_category, 'ΕΡΓ');
    assert.strictEqual(target.current_apologistika_category, 'ΑΔΕΙΑ');
    assert.strictEqual(
        target.proposed_values.kathgoria_ergasias_apologistika,
        'ΑΝ'
    );
    assert.strictEqual(result.proposal_version, PROPOSAL_VERSION);
    assert.strictEqual(result.choice_code, CHOICE_CODE);
}

function run() {
    testValidFullTimeProposal();
    testValidPartTimeProposal();
    testSemanticOrderWhenTargetComesFirst();
    testSourceIntervalPositionsAndZeroLengthClearing();
    testSourceCardHourNormalizationAndAuthority();
    testTargetCardAnomaliesAreNotAvailable();
    testProposalClearsProvisionalAutoLeaveFieldsWithoutMutatingRows();
    testSourceProposalClearsLeaveButPreservesHolidayPayrollFields();
    testSourceProposalPreservesCompatibleCalculatedShapeAndBookFlag();
    testPartialProposalClearsProvisionalAutoLeaveFields();
    testPolicyAllowlistUnion();
    testMissingAndDuplicateIds();
    testV2InvalidResultsPreserveVersions();
    testNonEligibleAnalyzerPaths();
    testInputImmutabilityAndFreezeIsolation();
    testOutputImmutabilityAndOwnership();
    testDeterminismAcrossInputOrder();
    testTargetCarriesDerivedCurrentDisplayCategoryWithoutChangingProposal();
    console.log('apasxoliseis weekly repo transfer single-pair proposal tests passed');
}

run();
