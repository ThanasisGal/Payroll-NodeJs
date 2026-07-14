const assert = require('assert');

const {
    analyzeWeeklyRepoTransferSinglePair,
    normalizeEmploymentType
} = require('./apasxoliseisWeeklyRepoTransferSinglePairService');

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
        ores_ergasias: 0
    });
    rows[4] = workRow(4, {
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: '',
        ores_ergasias: 4
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

function autoLeavePriorityWeek() {
    const start = new Date('2026-05-31T00:00:00.000Z');
    const rows = Array.from({ length: 7 }, (_, offset) => {
        const hmeromhnia = new Date(start);
        hmeromhnia.setUTCDate(hmeromhnia.getUTCDate() + offset);
        return {
            ...workRow(offset),
            _id: `priority-row-${offset}`,
            hmeromhnia: hmeromhnia.toISOString().slice(0, 10),
            cards_apo_ora_01: '08:00',
            cards_eos_ora_01: '16:00'
        };
    });

    Object.assign(rows[1], {
        kathgoria_ergasias: 'ΑΝ',
        cards_apo_ora_01: '08:12',
        cards_eos_ora_01: '16:16',
        cards_ores_ergasias: 8.07
    });
    Object.assign(rows[2], {
        kathgoria_ergasias: 'ΕΡΓ',
        apo_ora_01: '08:00',
        eos_ora_01: '16:00',
        cards_apo_ora_01: '',
        cards_eos_ora_01: '',
        cards_ores_ergasias: 0,
        apologistiko_biblio: false,
        adeia_apologistika: true,
        kathgoria_ergasias_apologistika: 'ΑΔΕΙΑ',
        kathgoria_adeias_apologistika: 'ΑΔΑΛ',
        ores_ergasias_apologistika: 8,
        ores_apoysias_apologistika: 0
    });
    Object.assign(rows[3], {
        kathgoria_ergasias: 'ΑΝ',
        ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: '',
        cards_ores_ergasias: 0
    });

    return rows;
}

function analyze(rows, profile = { typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 2 }, contexts = {}) {
    return analyzeWeeklyRepoTransferSinglePair({
        weekRows: rows,
        employmentProfile: profile,
        holidayByDateKey: contexts.holidayByDateKey || new Map(),
        existingAuditCountByRowKey: contexts.existingAuditCountByRowKey || new Map()
    });
}

function assertEligible(result, sourceDate, targetDate, targetCategory) {
    assert.strictEqual(result.eligibility_status, 'ELIGIBLE');
    assert.strictEqual(result.requires_hr_review, true);
    assert.strictEqual(result.can_auto_apply, false);
    assert.strictEqual(result.source.hmeromhnia, sourceDate);
    assert.strictEqual(result.source.semantic_target_category, 'ΕΡΓ');
    assert.strictEqual(result.target.hmeromhnia, targetDate);
    assert.strictEqual(result.target.semantic_target_category, targetCategory);
    assert.strictEqual(result.semantic_proposal.atomic_pair_required, true);
    assert.strictEqual(result.semantic_proposal.operation_type, 'REPO_TRANSFER_WITHIN_WEEK');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'proposed_values'), false);
}

function assertReason(result, reason) {
    assert.notStrictEqual(result.eligibility_status, 'ELIGIBLE');
    assert.ok(result.reasons.includes(reason), `${reason} not found in ${result.reasons.join(',')}`);
    assert.strictEqual(result.source, null);
    assert.strictEqual(result.target, null);
}

function testEmploymentTypeConventions() {
    assert.strictEqual(normalizeEmploymentType('PLHRHS'), 'PLHRHS');
    assert.strictEqual(normalizeEmploymentType('0'), 'PLHRHS');
    assert.strictEqual(normalizeEmploymentType('MERIKH'), 'MERIKH');
    assert.strictEqual(normalizeEmploymentType('1'), 'MERIKH');
    assert.strictEqual(normalizeEmploymentType('EK_PERITROPHS'), 'EK_PERITROPHS');
    assert.strictEqual(normalizeEmploymentType('2'), 'EK_PERITROPHS');
}

function testValidFullTimeTargetAfterSource() {
    const result = analyze(fullTimeWeek());
    assertEligible(result, dateKey(1), dateKey(4), 'ΑΝ');
    assert.deepStrictEqual(result.counts, {
        source_candidates: 1,
        target_candidates: 1,
        existing_actual_repo: 1,
        predicted_final_repo: 2
    });
    assert.deepStrictEqual(result.week, { start_date: dateKey(0), end_date: dateKey(6) });
}

function testValidFullTimeTargetBeforeSource() {
    const result = analyze(fullTimeWeek({ sourceDay: 5, targetDay: 1, existingRepoDay: 6 }));
    assertEligible(result, dateKey(5), dateKey(1), 'ΑΝ');
}

function testValidPartTimeAndCountsMeAndAnAsRepo() {
    const rows = partTimeWeek();
    const result = analyze(rows, { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 2 });
    assertEligible(result, dateKey(2), dateKey(4), 'ΜΕ');
    assert.strictEqual(result.counts.existing_actual_repo, 1);

    rows[0] = workRow(0, {
        kathgoria_ergasias: 'ΑΝ',
        ores_ergasias: 0,
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    const withAn = analyze(rows, { typos_apasxolhshs: 'MERIKH', mhniaia_repo: 2 });
    assertReason(withAn, 'REPO_LIMIT_EXCEEDED');
    assert.strictEqual(withAn.counts.existing_actual_repo, 2);
}

function testRotationalIsNotApplicable() {
    const result = analyze(fullTimeWeek(), {
        typos_apasxolhshs: 'EK_PERITROPHS',
        mhniaia_repo: 2
    });
    assert.strictEqual(result.eligibility_status, 'NOT_APPLICABLE');
    assertReason(result, 'ROTATIONAL_EMPLOYMENT_NOT_SUPPORTED');
}

function testZeroLengthTargetRemainsEligible() {
    const rows = fullTimeWeek();
    rows[4].cards_apo_ora_01 = '09:00';
    rows[4].cards_eos_ora_01 = '09:00';
    const result = analyze(rows);
    assertEligible(result, dateKey(1), dateKey(4), 'ΑΝ');
    assert.deepStrictEqual(result.warnings, ['TARGET_ZERO_HOURS_WITH_CARD_INTERVALS']);
}

function testTargetCardAnomaliesRemainEligibleWithWarnings() {
    const completeRows = fullTimeWeek();
    completeRows[4].cards_apo_ora_01 = '09:00';
    completeRows[4].cards_eos_ora_01 = '09:15';
    const complete = analyze(completeRows);
    assertEligible(complete, dateKey(1), dateKey(4), 'ΑΝ');
    assert.deepStrictEqual(complete.warnings, ['TARGET_ZERO_HOURS_WITH_CARD_INTERVALS']);

    const incompleteRows = fullTimeWeek();
    incompleteRows[4].cards_apo_ora_01 = '09:00';
    incompleteRows[4].cards_eos_ora_01 = '';
    const incomplete = analyze(incompleteRows);
    assertEligible(incomplete, dateKey(1), dateKey(4), 'ΑΝ');
    assert.deepStrictEqual(incomplete.warnings, [
        'TARGET_ZERO_HOURS_WITH_INCOMPLETE_CARD_PAIR'
    ]);
}

function testSundaySourceAndTargetRemainEligible() {
    const targetRows = fullTimeWeek({ sourceDay: 1, targetDay: 0, existingRepoDay: 6 });
    targetRows[0].kyriakes_apologistika = true;
    assertEligible(analyze(targetRows), dateKey(1), dateKey(0), 'ΑΝ');

    const sourceRows = fullTimeWeek({ sourceDay: 0, targetDay: 4, existingRepoDay: 6 });
    sourceRows[0].kyriakes_apologistika = true;
    assertEligible(analyze(sourceRows), dateKey(0), dateKey(4), 'ΑΝ');
}

function testExpectedAndConflictingApologistikaCategories() {
    const sourceExpected = fullTimeWeek();
    sourceExpected[1].kathgoria_ergasias_apologistika = 'ΕΡΓ';
    assertEligible(analyze(sourceExpected), dateKey(1), dateKey(4), 'ΑΝ');

    const targetExpected = fullTimeWeek();
    targetExpected[4].kathgoria_ergasias_apologistika = 'ΕΡΓ';
    assertEligible(analyze(targetExpected), dateKey(1), dateKey(4), 'ΑΝ');

    const sourceConflict = fullTimeWeek();
    sourceConflict[1].kathgoria_ergasias_apologistika = 'ΑΝ';
    assertReason(analyze(sourceConflict), 'SOURCE_CONFLICTING_APOLOGISTIKA_CATEGORY');

    const targetConflict = fullTimeWeek();
    targetConflict[4].kathgoria_ergasias_apologistika = 'ΑΝ';
    assertReason(analyze(targetConflict), 'TARGET_CONFLICTING_APOLOGISTIKA_CATEGORY');
}

function testInvalidApologistikaNumericValuesNeedReview() {
    const targetCases = ['invalid', {}, []];
    targetCases.forEach((value) => {
        const rows = fullTimeWeek();
        rows[4].ores_ergasias_apologistika = value;
        assertReason(analyze(rows), 'TARGET_INVALID_APOLOGISTIKA_NUMERIC_VALUE');
    });

    const sourceCases = ['abc', {}, []];
    sourceCases.forEach((value) => {
        const rows = fullTimeWeek();
        rows[1].ores_yperergasias_apologistika = value;
        assertReason(analyze(rows), 'SOURCE_INVALID_APOLOGISTIKA_NUMERIC_VALUE');
    });
}

function testTargetExclusions() {
    const cases = [
        ['declared leave', { adeia: true }, {}, 'TARGET_LEAVE_OR_SICKNESS'],
        ['leave category', { kathgoria_adeias: 'ΑΔΑΛ' }, {}, 'TARGET_LEAVE_OR_SICKNESS'],
        ['sickness', { astheneia: true }, {}, 'TARGET_LEAVE_OR_SICKNESS'],
        ['holiday', { argia: true }, {}, 'TARGET_HOLIDAY'],
        [
            'external holiday',
            {},
            { holidayByDateKey: new Map([[dateKey(4), { isHoliday: true }]]) },
            'TARGET_HOLIDAY'
        ],
        ['locked', { is_locked: true }, {}, 'TARGET_LOCKED'],
        [
            'audit',
            {},
            { existingAuditCountByRowKey: new Map([['row-4', 1]]) },
            'TARGET_MANUAL_OVERRIDE'
        ],
        ['apologistika hours', { ores_ergasias_apologistika: 1 }, {}, 'TARGET_ALREADY_PROCESSED'],
        [
            'other apologistika hours',
            { ores_yperergasias_nyxtas_apologistika: 1 },
            {},
            'TARGET_ALREADY_PROCESSED'
        ],
        [
            'apologistika interval',
            { apo_ora_01_apologistika: '09:00', eos_ora_01_apologistika: '10:00' },
            {},
            'TARGET_ALREADY_PROCESSED'
        ],
        ['repo apologistika', { repo_apologistika: true }, {}, 'TARGET_ALREADY_PROCESSED'],
        ['legacy repo state', { repo: true }, {}, 'TARGET_CONFLICTING_REPO_STATE']
    ];

    cases.forEach(([label, overrides, contexts, reason]) => {
        const rows = fullTimeWeek();
        Object.assign(rows[4], overrides);
        const result = analyze(rows, undefined, contexts);
        assertReason(result, reason);
        assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW', label);
    });
}

function testSourceExclusions() {
    const cases = [
        ['locked', { is_locked: true }, {}, 'SOURCE_LOCKED'],
        [
            'audit',
            {},
            { existingAuditCountByRowKey: new Map([[dateKey(1), 1]]) },
            'SOURCE_MANUAL_OVERRIDE'
        ],
        ['leave', { adeia: true }, {}, 'SOURCE_LEAVE_OR_SICKNESS'],
        ['sickness', { astheneia: true }, {}, 'SOURCE_LEAVE_OR_SICKNESS'],
        ['holiday', { argia: true }, {}, 'SOURCE_HOLIDAY'],
        [
            'invalid cards',
            { cards_apo_ora_01: '', cards_eos_ora_01: '' },
            {},
            'SOURCE_INVALID_CARD_EVIDENCE'
        ],
        [
            'incomplete extra card pair',
            { cards_apo_ora_02: '18:00', cards_eos_ora_02: '' },
            {},
            'SOURCE_INVALID_CARD_EVIDENCE'
        ],
        [
            'already processed',
            { ores_ergasias_apologistika: 1 },
            {},
            'SOURCE_ALREADY_PROCESSED'
        ]
    ];

    cases.forEach(([label, overrides, contexts, reason]) => {
        const rows = fullTimeWeek();
        Object.assign(rows[1], overrides);
        const result = analyze(rows, undefined, contexts);
        assertReason(result, reason);
        assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW', label);
    });
}

function testMultipleSources() {
    const rows = fullTimeWeek();
    rows[2] = workRow(2, { kathgoria_ergasias: 'ΑΝ' });
    assertReason(analyze(rows), 'MULTIPLE_SOURCE_CANDIDATES');
}

function testMultipleTargets() {
    const rows = fullTimeWeek();
    rows[3] = workRow(3, {
        cards_ores_ergasias: 0,
        cards_apo_ora_01: '',
        cards_eos_ora_01: ''
    });
    assertReason(analyze(rows), 'MULTIPLE_TARGET_CANDIDATES');
}

function testNoTarget() {
    const rows = fullTimeWeek();
    rows[4] = workRow(4);
    const result = analyze(rows);
    assert.strictEqual(result.eligibility_status, 'NOT_APPLICABLE');
    assertReason(result, 'NO_TARGET_CANDIDATE');
}

function testExactRepoCount() {
    const deficitRows = fullTimeWeek();
    deficitRows[6] = workRow(6);
    const deficit = analyze(deficitRows);
    assertReason(deficit, 'REPO_DEFICIT_REMAINS');
    assert.strictEqual(deficit.counts.predicted_final_repo, 1);

    const excess = analyze(fullTimeWeek(), { typos_apasxolhshs: 'PLHRHS', mhniaia_repo: 1 });
    assertReason(excess, 'REPO_LIMIT_EXCEEDED');
    assert.strictEqual(excess.counts.predicted_final_repo, 2);
}

function testAutoCalculatedLeavePriorityRegression() {
    const rows = autoLeavePriorityWeek();
    const before = JSON.stringify(rows);
    const result = analyze(rows);

    assertEligible(result, '2026-06-01', '2026-06-02', 'ΑΝ');
    assert.deepStrictEqual(result.counts, {
        source_candidates: 1,
        target_candidates: 1,
        existing_actual_repo: 1,
        predicted_final_repo: 2
    });
    assert.strictEqual(JSON.stringify(rows), before);
}

function optionalHolidayContext(date, companyOperatesOnHoliday, description = 'Αργία') {
    return {
        holidayByDateKey: new Map([
            [
                date,
                {
                    isHoliday: true,
                    isMandatoryHoliday: false,
                    isOptionalHoliday: true,
                    companyOperatesOnHoliday,
                    blocksRepoTransfer: !companyOperatesOnHoliday,
                    description
                }
            ]
        ])
    };
}

function testOptionalHolidayRepoTransferPolicy() {
    const rows = fullTimeWeek();
    rows[1].apologistiko_biblio = true;
    rows[1].argia = true;
    rows[1].argia_apologistika = true;
    rows[1].ores_argion_prosayxhsh_apologistika = 8;
    rows[1].ores_argion_ergasia_apologistika = 8;
    const before = JSON.stringify(rows);
    const operatesContext = optionalHolidayContext(dateKey(1), true, 'Περιγραφή Α');
    const operates = analyze(rows, undefined, operatesContext);

    assertEligible(operates, dateKey(1), dateKey(4), 'ΑΝ');
    assert.ok(!operates.reasons.includes('SOURCE_HOLIDAY'));
    assert.strictEqual(JSON.stringify(rows), before);

    const differentDescription = analyze(
        rows,
        undefined,
        optionalHolidayContext(dateKey(1), true, '<script>διαφορετική</script>')
    );
    assert.deepStrictEqual(differentDescription, operates);

    const closed = analyze(rows, undefined, optionalHolidayContext(dateKey(1), false));
    assertReason(closed, 'SOURCE_HOLIDAY');
}

function testMandatoryAndRawHolidayRemainBlocking() {
    const mandatoryRows = fullTimeWeek();
    const mandatory = analyze(mandatoryRows, undefined, {
        holidayByDateKey: new Map([
            [
                dateKey(1),
                {
                    isHoliday: true,
                    isMandatoryHoliday: true,
                    isOptionalHoliday: false,
                    companyOperatesOnHoliday: true,
                    blocksRepoTransfer: false,
                    description: 'Υποχρεωτική'
                }
            ]
        ])
    });
    assertReason(mandatory, 'SOURCE_HOLIDAY');

    const rawRows = fullTimeWeek();
    rawRows[1].argia = true;
    assertReason(analyze(rawRows), 'SOURCE_HOLIDAY');
}

function materializeAutoSource(rows, index, overrides = {}) {
    Object.assign(rows[index], {
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apo_ora_01_apologistika: rows[index].cards_apo_ora_01,
        eos_ora_01_apologistika: rows[index].cards_eos_ora_01,
        ores_ergasias_apologistika: rows[index].cards_ores_ergasias,
        ...overrides
    });
    return rows;
}

function testRealShapeOptionalHolidayAndAutoSourceFixture() {
    const rows = materializeAutoSource(autoLeavePriorityWeek(), 1, {
        apo_ora_01_apologistika: '08:12',
        eos_ora_01_apologistika: '16:12',
        apo_ora_01_break: '12:00',
        eos_ora_01_break: '12:30',
        ores_ergasias_apologistika: 7.57,
        apologistiko_biblio: true,
        argia: true,
        argia_apologistika: true,
        ores_argion_prosayxhsh_apologistika: 8.07,
        ores_argion_ergasia_apologistika: 8.07,
        ores_nominhs_yperorias_argion_apologistika: 0.07
    });
    const before = JSON.stringify(rows);
    const result = analyze(
        rows,
        {
            typos_apasxolhshs: 'PLHRHS',
            mhniaia_repo: 2,
            mo_oron_hmerhsias_ergasias: 8,
            external_break_minutes: 30
        },
        optionalHolidayContext('2026-06-01', true, 'Αγίου Πνεύματος')
    );

    assertEligible(result, '2026-06-01', '2026-06-02', 'ΑΝ');
    assert.deepStrictEqual(result.counts, {
        source_candidates: 1,
        target_candidates: 1,
        existing_actual_repo: 1,
        predicted_final_repo: 2
    });
    assert.strictEqual(JSON.stringify(rows), before);
}

function testNonHolidayAutoSourceFixture() {
    const rows = materializeAutoSource(
        fullTimeWeek({ sourceDay: 1, targetDay: 5, existingRepoDay: 3 }),
        1
    );
    const start = new Date('2026-06-14T00:00:00.000Z');
    rows.forEach((row, index) => {
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + index);
        row.hmeromhnia = date.toISOString().slice(0, 10);
    });
    Object.assign(rows[1], {
        ores_ergasias: 0,
        cards_apo_ora_01: '08:01',
        cards_eos_ora_01: '15:59',
        cards_ores_ergasias: 7.966666666666667,
        apo_ora_01_apologistika: '08:01',
        eos_ora_01_apologistika: '16:01',
        apo_ora_01_break: '12:00',
        eos_ora_01_break: '12:30',
        ores_ergasias_apologistika: 7.47,
        apologistiko_biblio: true
    });
    const profile = {
        typos_apasxolhshs: 'PLHRHS',
        mhniaia_repo: 2,
        mo_oron_hmerhsias_ergasias: 8,
        external_break_minutes: 30
    };
    assertEligible(analyze(rows, profile), '2026-06-15', '2026-06-19', 'ΑΝ');
    assert.deepStrictEqual(analyze(rows, profile).counts, {
        source_candidates: 1,
        target_candidates: 1,
        existing_actual_repo: 1,
        predicted_final_repo: 2
    });
}

function testProvisionalAutoSourceBlockingStates() {
    const cases = [
        ['lock', { is_locked: true }, {}, 'SOURCE_LOCKED'],
        [
            'audit',
            {},
            { existingAuditCountByRowKey: new Map([['row-1', 1]]) },
            'SOURCE_MANUAL_OVERRIDE'
        ],
        ['unknown hours', { ores_asxeto_apologistika: 1 }, {}, 'SOURCE_ALREADY_PROCESSED'],
        [
            'interval mismatch',
            { eos_ora_01_apologistika: '16:30' },
            {},
            'SOURCE_ALREADY_PROCESSED'
        ],
        ['hours mismatch', { ores_ergasias_apologistika: 7 }, {}, 'SOURCE_ALREADY_PROCESSED'],
        [
            'category mismatch',
            { kathgoria_ergasias_apologistika: 'ΑΝ' },
            {},
            'SOURCE_CONFLICTING_APOLOGISTIKA_CATEGORY'
        ],
        [
            'unrelated leave category',
            { kathgoria_adeias_apologistika: 'ΑΔΑΛ' },
            {},
            'SOURCE_ALREADY_PROCESSED'
        ],
        ['declared leave', { adeia: true }, {}, 'SOURCE_LEAVE_OR_SICKNESS'],
        ['sickness', { astheneia: true }, {}, 'SOURCE_LEAVE_OR_SICKNESS'],
        [
            'incomplete cards',
            { cards_apo_ora_02: '18:00', cards_eos_ora_02: '' },
            {},
            'SOURCE_INVALID_CARD_EVIDENCE'
        ]
    ];

    cases.forEach(([label, overrides, contexts, reason]) => {
        const rows = materializeAutoSource(fullTimeWeek(), 1);
        Object.assign(rows[1], overrides);
        const result = analyze(rows, undefined, contexts);
        assertReason(result, reason);
        assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW', label);
    });

    const holidayRows = materializeAutoSource(fullTimeWeek(), 1);
    assertReason(
        analyze(holidayRows, undefined, optionalHolidayContext(dateKey(1), false)),
        'SOURCE_HOLIDAY'
    );
}

function testApologistikoBiblioIsNotEligibilityProvenance() {
    [true, false].forEach((apologistikoBiblio) => {
        const sourceRows = materializeAutoSource(fullTimeWeek(), 1, {
            apologistiko_biblio: apologistikoBiblio,
            ...(apologistikoBiblio
                ? {
                      ores_nyxtas_apologistika: 0.5,
                      ores_yperergasias_apologistika: 0.25
                  }
                : {})
        });
        assertEligible(analyze(sourceRows), dateKey(1), dateKey(4), 'ΑΝ');

        const targetRows = autoLeavePriorityWeek();
        targetRows[2].apologistiko_biblio = apologistikoBiblio;
        assertEligible(analyze(targetRows), '2026-06-01', '2026-06-02', 'ΑΝ');
    });

    const lockedSource = materializeAutoSource(fullTimeWeek(), 1, {
        apologistiko_biblio: true,
        is_locked: true
    });
    assertReason(analyze(lockedSource), 'SOURCE_LOCKED');

    const auditedTarget = autoLeavePriorityWeek();
    auditedTarget[2].apologistiko_biblio = true;
    assertReason(
        analyze(auditedTarget, undefined, {
            existingAuditCountByRowKey: new Map([['priority-row-2', 1]])
        }),
        'TARGET_MANUAL_OVERRIDE'
    );
}

function testKnownAutoDerivedPayrollFieldsAreNotManualMarkers() {
    const knownFields = [
        'ores_nyxtas_apologistika',
        'ores_argion_prosayxhsh_apologistika',
        'ores_argion_ergasia_apologistika',
        'ores_prostheths_ergasias_apologistika',
        'ores_yperergasias_apologistika',
        'ores_yperergasias_nyxtas_apologistika',
        'ores_yperergasias_argion_apologistika',
        'ores_yperergasias_argion_nyxtas_apologistika',
        'ores_nominhs_yperorias_apologistika',
        'ores_nominhs_yperorias_nyxtas_apologistika',
        'ores_nominhs_yperorias_argion_apologistika',
        'ores_nominhs_yperorias_argion_nyxtas_apologistika',
        'ores_paranomhs_yperorias_apologistika',
        'ores_paranomhs_yperorias_nyxtas_apologistika',
        'ores_paranomhs_yperorias_argion_apologistika',
        'ores_paranomhs_yperorias_argion_nyxtas_apologistika'
    ];

    knownFields.forEach((field) => {
        const rows = materializeAutoSource(fullTimeWeek(), 1, {
            apologistiko_biblio: true,
            [field]: 0.25
        });
        const isHolidayField = field.includes('_argion_') || field.startsWith('ores_argion_');
        const contexts = isHolidayField
            ? optionalHolidayContext(dateKey(1), true)
            : {};
        assertEligible(analyze(rows, undefined, contexts), dateKey(1), dateKey(4), 'ΑΝ');
    });
}

function testArbitraryIntervalOffsetsRemainBlocked() {
    [
        ['16:50', '10 minutes'],
        ['16:45', '15 minutes']
    ].forEach(([calculatedEnd, label]) => {
        const rows = materializeAutoSource(fullTimeWeek(), 1, {
            eos_ora_01_apologistika: calculatedEnd,
            apologistiko_biblio: true
        });
        const result = analyze(rows);
        assertReason(result, 'SOURCE_ALREADY_PROCESSED');
        assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW', label);
    });
}

function testAutoCalculatedLeavePriorityBlockingStates() {
    const cases = [
        ['declared leave', { adeia: true }, {}, 'TARGET_LEAVE_OR_SICKNESS'],
        ['declared leave category', { kathgoria_adeias: 'ΚΑΝ' }, {}, 'TARGET_LEAVE_OR_SICKNESS'],
        ['locked', { is_locked: true }, {}, 'TARGET_LOCKED'],
        [
            'audit',
            {},
            { existingAuditCountByRowKey: new Map([['priority-row-2', 1]]) },
            'TARGET_MANUAL_OVERRIDE'
        ],
        ['sickness', { astheneia: true }, {}, 'TARGET_LEAVE_OR_SICKNESS'],
        ['holiday', { argia: true }, {}, 'TARGET_HOLIDAY'],
        [
            'unrelated apologistika hours',
            { ores_nyxtas_apologistika: 1 },
            {},
            'TARGET_ALREADY_PROCESSED'
        ]
    ];

    cases.forEach(([label, overrides, contexts, reason]) => {
        const rows = autoLeavePriorityWeek();
        Object.assign(rows[2], overrides);
        const result = analyze(rows, undefined, contexts);
        assertReason(result, reason);
        assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW', label);
    });
}

function testAutoCalculatedLeaveWithTwoTargetsNeedsReview() {
    const rows = autoLeavePriorityWeek();
    Object.assign(rows[4], {
        cards_apo_ora_01: '',
        cards_eos_ora_01: '',
        cards_ores_ergasias: 0
    });
    assertReason(analyze(rows), 'MULTIPLE_TARGET_CANDIDATES');
}

function testSixDayRepoLimitWithExistingRepoIsExceeded() {
    const result = analyze(autoLeavePriorityWeek(), {
        typos_apasxolhshs: 'PLHRHS',
        hmeres_ergasias_ebdomadas: 6,
        mhniaia_repo: 1
    });
    assertReason(result, 'REPO_LIMIT_EXCEEDED');
    assert.strictEqual(result.counts.existing_actual_repo, 1);
    assert.strictEqual(result.counts.predicted_final_repo, 2);
}

function testSplitShiftPrioritySourceRemainsSupported() {
    const rows = autoLeavePriorityWeek();
    Object.assign(rows[1], {
        cards_apo_ora_01: '08:12',
        cards_eos_ora_01: '12:12',
        cards_apo_ora_02: '12:30',
        cards_eos_ora_02: '16:34',
        cards_ores_ergasias: 8.07,
        kathgoria_ergasias_apologistika: 'ΕΡΓ',
        apo_ora_01_apologistika: '08:12',
        eos_ora_01_apologistika: '12:12',
        apo_ora_02_apologistika: '12:30',
        eos_ora_02_apologistika: '16:34',
        ores_ergasias_apologistika: 8.07
    });
    assertEligible(analyze(rows), '2026-06-01', '2026-06-02', 'ΑΝ');
}

function testInvalidRepoLimits() {
    [0, 3, 1.5, '2', 'invalid', undefined].forEach((mhniaiaRepo) => {
        const result = analyze(fullTimeWeek(), {
            typos_apasxolhshs: 'PLHRHS',
            mhniaia_repo: mhniaiaRepo
        });
        assertReason(result, 'INVALID_MHNIAIA_REPO');
    });
}

function testInvalidWeekInputs() {
    assertReason(analyze(fullTimeWeek().slice(0, 6)), 'INCOMPLETE_WEEK_DATA');
    assertReason(analyze([...fullTimeWeek().slice(0, 6), fullTimeWeek()[0]]), 'DUPLICATE_WEEK_DATE');
    assertReason(analyze([...fullTimeWeek(), workRow(7)]), 'INCOMPLETE_WEEK_DATA');

    const crossWeek = fullTimeWeek();
    crossWeek[6].hmeromhnia = dateKey(7);
    assertReason(analyze(crossWeek), 'CROSS_WEEK_ROWS');

    const multipleEmployees = fullTimeWeek();
    multipleEmployees[3].kodikos = '002';
    assertReason(analyze(multipleEmployees), 'MULTIPLE_EMPLOYEES');

    const invalidDate = fullTimeWeek();
    invalidDate[3].hmeromhnia = 'invalid';
    assertReason(analyze(invalidDate), 'INVALID_WEEK_DATE');

    class NonPlainRow {}
    const nonPlain = fullTimeWeek();
    nonPlain[3] = Object.assign(new NonPlainRow(), nonPlain[3]);
    assertReason(analyze(nonPlain), 'INVALID_WEEK_ROW');
}

function testInputImmutability() {
    const weekRows = fullTimeWeek();
    const employmentProfile = {
        typos_apasxolhshs: 'PLHRHS',
        mhniaia_repo: 2,
        source: 'ISTORIKO',
        profile_changed_inside_week: true
    };
    const holidayByDateKey = { [dateKey(0)]: null };
    const existingAuditCountByRowKey = { [dateKey(0)]: 0 };
    const before = JSON.stringify({
        weekRows,
        employmentProfile,
        holidayByDateKey,
        existingAuditCountByRowKey
    });

    analyzeWeeklyRepoTransferSinglePair({
        weekRows,
        employmentProfile,
        holidayByDateKey,
        existingAuditCountByRowKey
    });

    assert.strictEqual(
        JSON.stringify({ weekRows, employmentProfile, holidayByDateKey, existingAuditCountByRowKey }),
        before
    );
}

function deepFreezeFixture(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach((key) => deepFreezeFixture(value[key]));
    return value;
}

function testResultMetadataIsPrimitiveAndInputIsUnfrozen() {
    const effectiveDate = new Date('2026-07-01T00:00:00.000Z');
    const inputId = {
        toHexString() {
            return '507f1f77bcf86cd799439011';
        }
    };
    const historyId = {
        toHexString() {
            return '507f1f77bcf86cd799439012';
        }
    };
    const rows = fullTimeWeek();
    rows[1]._id = inputId;
    const result = analyze(rows, {
        typos_apasxolhshs: 'PLHRHS',
        mhniaia_repo: 2,
        effective_date: effectiveDate,
        istorikoId: historyId
    });

    assertEligible(result, dateKey(1), dateKey(4), 'ΑΝ');
    assert.strictEqual(Object.isFrozen(effectiveDate), false);
    assert.strictEqual(Object.isFrozen(inputId), false);
    assert.strictEqual(Object.isFrozen(historyId), false);
    assert.strictEqual(result.employee.profile_effective_date, '2026-07-01');
    assert.strictEqual(result.employee.profile_istoriko_id, '507f1f77bcf86cd799439012');
    assert.strictEqual(result.source.prodhlomena_oraria_id, '507f1f77bcf86cd799439011');
    assert.notStrictEqual(result.employee.profile_effective_date, effectiveDate);
    assert.notStrictEqual(result.employee.profile_istoriko_id, historyId);
    assert.notStrictEqual(result.source.prodhlomena_oraria_id, inputId);

    const arbitraryId = { value: '507f1f77bcf86cd799439011' };
    const arbitraryRows = fullTimeWeek();
    arbitraryRows[1]._id = arbitraryId;
    const arbitraryResult = analyze(arbitraryRows);
    assert.strictEqual(arbitraryResult.source.prodhlomena_oraria_id, null);
    assert.strictEqual(Object.isFrozen(arbitraryId), false);
}

function testRepoLimitResultNormalizationDoesNotFreezeInvalidInputs() {
    const invalidRepoValues = [
        { value: 2 },
        [],
        new Date('2026-07-01T00:00:00.000Z'),
        { valueOf() { return 2; } }
    ];

    invalidRepoValues.forEach((invalidRepoValue) => {
        const result = analyze(fullTimeWeek(), {
            typos_apasxolhshs: 'PLHRHS',
            mhniaia_repo: invalidRepoValue
        });
        assert.strictEqual(result.eligibility_status, 'NEEDS_REVIEW');
        assert.ok(result.reasons.includes('INVALID_MHNIAIA_REPO'));
        assert.strictEqual(result.employee.mhniaia_repo, null);
        assert.notStrictEqual(result.employee.mhniaia_repo, invalidRepoValue);
        assert.strictEqual(Object.isFrozen(invalidRepoValue), false);
    });

    [1, 2].forEach((repoLimit) => {
        const rows = repoLimit === 1
            ? (() => {
                  const value = fullTimeWeek();
                  value[6] = workRow(6);
                  return value;
              })()
            : fullTimeWeek();
        const result = analyze(rows, {
            typos_apasxolhshs: 'PLHRHS',
            mhniaia_repo: repoLimit
        });
        assert.strictEqual(result.employee.mhniaia_repo, repoLimit);
    });
}

function testIdNormalizationUsesOnlySafeSupportedForms() {
    const numberRows = fullTimeWeek();
    numberRows[1]._id = 123;
    assert.strictEqual(analyze(numberRows).source.prodhlomena_oraria_id, '123');

    [NaN, Infinity, -Infinity, true, false].forEach((invalidNumber) => {
        const rows = fullTimeWeek();
        rows[1]._id = invalidNumber;
        assert.strictEqual(analyze(rows).source.prodhlomena_oraria_id, null);
    });

    let calls = 0;
    const customId = {
        toString() {
            calls++;
            return 'side-effect-id';
        }
    };
    const customRows = fullTimeWeek();
    customRows[1]._id = customId;
    assert.strictEqual(analyze(customRows).source.prodhlomena_oraria_id, null);
    assert.strictEqual(calls, 0);
    assert.strictEqual(Object.isFrozen(customId), false);

    const objectIdLike = {
        toHexString() {
            return '507f1f77bcf86cd799439011';
        }
    };
    const objectIdRows = fullTimeWeek();
    objectIdRows[1]._id = objectIdLike;
    assert.strictEqual(
        analyze(objectIdRows).source.prodhlomena_oraria_id,
        '507f1f77bcf86cd799439011'
    );
    assert.strictEqual(Object.isFrozen(objectIdLike), false);
}

function testDeepFrozenInputsRemainSupported() {
    const weekRows = deepFreezeFixture(fullTimeWeek());
    const employmentProfile = deepFreezeFixture({
        typos_apasxolhshs: 'PLHRHS',
        mhniaia_repo: 2,
        source: 'ISTORIKO'
    });
    const holidayByDateKey = deepFreezeFixture({});
    const existingAuditCountByRowKey = deepFreezeFixture({});

    const result = analyzeWeeklyRepoTransferSinglePair({
        weekRows,
        employmentProfile,
        holidayByDateKey,
        existingAuditCountByRowKey
    });
    assertEligible(result, dateKey(1), dateKey(4), 'ΑΝ');
}

function testDeterminismAcrossInputOrder() {
    const rows = fullTimeWeek();
    const expected = analyze(rows);
    const shuffled = analyze([rows[4], rows[1], rows[6], rows[0], rows[5], rows[2], rows[3]]);
    assert.deepStrictEqual(shuffled, expected);
}

function run() {
    testEmploymentTypeConventions();
    testValidFullTimeTargetAfterSource();
    testValidFullTimeTargetBeforeSource();
    testValidPartTimeAndCountsMeAndAnAsRepo();
    testRotationalIsNotApplicable();
    testZeroLengthTargetRemainsEligible();
    testTargetCardAnomaliesRemainEligibleWithWarnings();
    testSundaySourceAndTargetRemainEligible();
    testExpectedAndConflictingApologistikaCategories();
    testInvalidApologistikaNumericValuesNeedReview();
    testTargetExclusions();
    testSourceExclusions();
    testMultipleSources();
    testMultipleTargets();
    testNoTarget();
    testExactRepoCount();
    testAutoCalculatedLeavePriorityRegression();
    testOptionalHolidayRepoTransferPolicy();
    testMandatoryAndRawHolidayRemainBlocking();
    testRealShapeOptionalHolidayAndAutoSourceFixture();
    testNonHolidayAutoSourceFixture();
    testProvisionalAutoSourceBlockingStates();
    testApologistikoBiblioIsNotEligibilityProvenance();
    testKnownAutoDerivedPayrollFieldsAreNotManualMarkers();
    testArbitraryIntervalOffsetsRemainBlocked();
    testAutoCalculatedLeavePriorityBlockingStates();
    testAutoCalculatedLeaveWithTwoTargetsNeedsReview();
    testSixDayRepoLimitWithExistingRepoIsExceeded();
    testSplitShiftPrioritySourceRemainsSupported();
    testInvalidRepoLimits();
    testInvalidWeekInputs();
    testInputImmutability();
    testResultMetadataIsPrimitiveAndInputIsUnfrozen();
    testRepoLimitResultNormalizationDoesNotFreezeInvalidInputs();
    testIdNormalizationUsesOnlySafeSupportedForms();
    testDeepFrozenInputsRemainSupported();
    testDeterminismAcrossInputOrder();
    console.log('apasxoliseis weekly repo transfer single-pair tests passed');
}

run();
