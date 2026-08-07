const assert = require('assert');
const mongoose = require('mongoose');

const {
    buildWeeklyRepoTransferSinglePairGroupProjection,
    PROJECTION_STATUS,
    GROUP_TYPE,
    normalizeRowId
} = require('./apasxoliseisWeeklyRepoTransferSinglePairGroupProjectionService');
const {
    buildWeeklyRepoTransferSinglePairProposal
} = require('./apasxoliseisWeeklyRepoTransferSinglePairProposalService');
const {
    buildAtomicReusableCriteriaV5
} = require('./apasxoliseisWeeklyRepoTransferAtomicReusableDecisionService');

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
        ypokatasthma: '0001',
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
    return buildWeeklyRepoTransferSinglePairGroupProjection({
        weekRows: rows,
        employmentProfile: { hmeres_ergasias_ebdomadas: 5, ...profile },
        holidayByDateKey: contexts.holidayByDateKey || new Map(),
        existingAuditCountByRowKey: contexts.existingAuditCountByRowKey || new Map()
    });
}

function assertReady(result) {
    assert.strictEqual(result.version, 1);
    assert.strictEqual(result.scope, 'weekly_atomic_pair');
    assert.strictEqual(result.projection_status, PROJECTION_STATUS.READY);
    assert.deepStrictEqual(result.summary, {
        groups_count: 1,
        decision_units_count: 1,
        items_count: 2,
        employees_count: 1,
        ready_count: 1,
        not_available_count: 0
    });
    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].items.length, 2);
    assert.strictEqual(result.groups[0].items[0].role, 'SOURCE_BECOMES_WORK');
    assert.strictEqual(result.groups[0].items[1].role, 'TARGET_BECOMES_REPO');
    assert.strictEqual(result.groups[0].representative_item, result.groups[0].items[0]);
}

function assertSafetyContract(group) {
    assert.strictEqual(group.group_type, GROUP_TYPE);
    assert.strictEqual(group.decision_grain, 'ATOMIC_LINKED_SET');
    assert.strictEqual(group.status, 'NEEDS_REVIEW');
    assert.strictEqual(group.action_type, 'PAIRED_PROPOSAL');
    assert.strictEqual(group.reason_code, 'REPO_TRANSFER_CANDIDATE');
    assert.strictEqual(group.count, 2);
    assert.strictEqual(group.decision_units_count, 1);
    assert.strictEqual(group.employees_count, 1);
    assert.deepStrictEqual(group.pair_contract, {
        choice_code: 'TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR',
        proposal_version: 'repo-transfer-single-pair-proposal:v4',
        policy_versions: {
            weekly_repo: 'foundation:v3',
            source_work: 'foundation:v3'
        },
        atomic_pair_required: true,
        requires_hr_review: true,
        approval_supported: false,
        batch_approvable: false,
        runtime_apply_supported: false,
        apply_readiness: {
            status: 'BLOCKED',
            reason: 'ATOMIC_APPLY_SUPPORT_REQUIRED'
        }
    });
    group.items.forEach((item) => {
        assert.deepStrictEqual(item.flags, {
            atomic_pair_member: true,
            requires_human_approval: true,
            approval_supported: false,
            batch_approvable: false,
            runtime_apply_supported: false,
            is_locked: false,
            has_manual_override: false,
            current_eligible: true
        });
    });
    assert.strictEqual(JSON.stringify(group).includes('APPROVE_PREFILL'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(group, 'decision_type'), false);
    assert.strictEqual(group.atomic_reusable_context.target_category,
        group.items[1].kathgoria_ergasias_apologistika);
    assert.ok(group.atomic_reusable_context.policy_versions.primary);
    assert.ok(group.atomic_reusable_context.policy_versions.secondary);
    const reusable = buildAtomicReusableCriteriaV5(group);
    assert.strictEqual(reusable.validation.eligible, true,
        reusable.validation.diagnostics.join(','));
    assert.strictEqual(reusable.criteria.version, 5);
}

function assertNotAvailable(result, reason) {
    assert.strictEqual(result.projection_status, PROJECTION_STATUS.NOT_AVAILABLE);
    assert.deepStrictEqual(result.summary, {
        groups_count: 0,
        decision_units_count: 0,
        items_count: 0,
        employees_count: 0,
        ready_count: 0,
        not_available_count: 1
    });
    assert.deepStrictEqual(result.groups, []);
    assert.ok(result.reasons.includes(reason), `${reason} missing from ${result.reasons.join(',')}`);
    assert.strictEqual(JSON.stringify(result).includes('proposed_values'), false);
}

function testValidFullTimeProjection() {
    const result = build(fullTimeWeek());
    assertReady(result);
    const group = result.groups[0];
    const [source, target] = group.items;

    assertSafetyContract(group);
    assert.strictEqual(group.policy_code, 'WEEKLY_REPO_BALANCE');
    assert.strictEqual(
        group.secondary_policy_code,
        'DECLARED_REPO_OR_NON_WORK_WITH_CARDS'
    );
    assert.strictEqual(group.scenario_code, 'REPO_TRANSFER_WITHIN_WEEK_SINGLE_PAIR');
    assert.strictEqual(group.title, 'Μεταφορά ρεπό εντός εβδομάδας');
    assert.strictEqual(
        group.description,
        'Μεταφορά ρεπό για τον εργαζόμενο 001: η 07/07/2026 γίνεται εργασία και η ' +
            '10/07/2026 γίνεται ρεπό (ΑΝ, πλήρης απασχόληση). Οι δύο αλλαγές απαιτούν ' +
            'μία ενιαία απόφαση HR. Η προεπισκόπηση δεν αλλάζει δεδομένα· η εφαρμογή ' +
            'επιτρέπεται μόνο μετά από έγκριση και επιτυχή έλεγχο ασφαλείας του server.'
    );
    assert.strictEqual(group.first_date, dateKey(1));
    assert.strictEqual(group.last_date, dateKey(4));
    assert.strictEqual(source.prodhlomena_oraria_id, 'row-1');
    assert.strictEqual(source.kathgoria_ergasias, 'ΑΝ');
    assert.strictEqual(source.kathgoria_ergasias_apologistika, 'ΕΡΓ');
    assert.strictEqual(source.proposed_values.repo_apologistika, false);
    assert.strictEqual(target.prodhlomena_oraria_id, 'row-4');
    assert.strictEqual(target.kathgoria_ergasias, 'ΕΡΓ');
    assert.strictEqual(target.kathgoria_ergasias_apologistika, 'ΑΝ');
    assert.strictEqual(target.proposed_values.repo_apologistika, true);
    assert.strictEqual(target.proposed_values.ores_ergasias_apologistika, 0);
}

function testValidPartTimeProjection() {
    const result = build(partTimeWeek(), {
        typos_apasxolhshs: 'MERIKH'
    });
    assertReady(result);
    const group = result.groups[0];
    const target = group.items[1];

    assertSafetyContract(group);
    assert.strictEqual(target.kathgoria_ergasias_apologistika, 'ΜΕ');
    assert.strictEqual(target.proposed_values.repo_apologistika, true);
    assert.ok(group.description.includes('ΜΕ, μερική απασχόληση'));
    assert.strictEqual(group.pair_contract.approval_supported, false);
}

function testTargetBeforeSourceKeepsSemanticOrder() {
    const result = build(fullTimeWeek({ sourceDay: 5, targetDay: 1, existingRepoDay: 6 }));
    assertReady(result);
    const group = result.groups[0];

    assert.strictEqual(group.items[0].hmeromhnia, dateKey(5));
    assert.strictEqual(group.items[1].hmeromhnia, dateKey(1));
    assert.strictEqual(group.representative_item.role, 'SOURCE_BECOMES_WORK');
    assert.strictEqual(group.first_date, dateKey(1));
    assert.strictEqual(group.last_date, dateKey(5));
}

function testStableGroupIdentity() {
    const rows = fullTimeWeek();
    const first = build(rows);
    const repeated = build(rows);
    const shuffled = build([rows[4], rows[1], rows[6], rows[0], rows[5], rows[2], rows[3]]);

    assert.deepStrictEqual(repeated, first);
    assert.deepStrictEqual(shuffled, first);
    assert.strictEqual(first.groups[0].group_id, repeated.groups[0].group_id);
    assert.strictEqual(first.groups[0].group_id, shuffled.groups[0].group_id);
    assert.strictEqual(
        first.groups[0].group_key,
        'group_type=ATOMIC_PAIRED_PROPOSAL|' +
            'scenario=REPO_TRANSFER_WITHIN_WEEK_SINGLE_PAIR|' +
            'choice=TRANSFER_REPO_WITHIN_WEEK_SINGLE_PAIR|' +
            'proposal_version=repo-transfer-single-pair-proposal:v4|' +
            'employee=001|week=2026-07-06:2026-07-12|source=row-1|target=row-4'
    );
    assert.match(first.groups[0].group_id, /^policy-preview-paired-group-[a-f0-9]{16}$/);

    const differentPair = build(
        fullTimeWeek({ sourceDay: 2, targetDay: 5, existingRepoDay: 6 })
    );
    assertReady(differentPair);
    assert.notStrictEqual(differentPair.groups[0].group_id, first.groups[0].group_id);

    const delimiterPairA = fullTimeWeek();
    delimiterPairA[1]._id = 'row-a|target=row-b';
    delimiterPairA[4]._id = 'row-c';
    const delimiterPairB = fullTimeWeek();
    delimiterPairB[1]._id = 'row-a';
    delimiterPairB[4]._id = 'row-b|target=row-c';
    const escapedA = build(delimiterPairA);
    const escapedB = build(delimiterPairB);
    assertReady(escapedA);
    assertReady(escapedB);
    assert.notStrictEqual(escapedA.groups[0].group_key, escapedB.groups[0].group_key);
    assert.notStrictEqual(escapedA.groups[0].group_id, escapedB.groups[0].group_id);
}

function testSplitShiftIntervalsArePreservedInProjection() {
    const twoIntervalRows = fullTimeWeek();
    Object.assign(twoIntervalRows[1], {
        cards_ores_ergasias: '7,5',
        cards_apo_ora_01: '08:00',
        cards_eos_ora_01: '12:00',
        cards_apo_ora_02: '12:30',
        cards_eos_ora_02: '16:00',
        cards_apo_ora_03: '',
        cards_eos_ora_03: ''
    });
    const proposal = buildWeeklyRepoTransferSinglePairProposal({
        weekRows: twoIntervalRows,
        employmentProfile: { typos_apasxolhshs: 'PLHRHS', hmeres_ergasias_ebdomadas: 5 }
    });
    const twoIntervalResult = build(twoIntervalRows);
    assertReady(twoIntervalResult);
    const twoIntervalGroup = twoIntervalResult.groups[0];
    const twoIntervalSource = twoIntervalGroup.items[0];
    const twoIntervalValues = {
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
    };

    assert.deepStrictEqual(twoIntervalSource.proposed_values, twoIntervalValues);
    assert.strictEqual(twoIntervalGroup.representative_item, twoIntervalSource);
    assert.deepStrictEqual(
        twoIntervalGroup.representative_item.proposed_values,
        twoIntervalValues
    );
    assert.notStrictEqual(
        twoIntervalSource.proposed_values,
        proposal.items[0].proposed_values
    );

    const zeroLengthRows = fullTimeWeek();
    Object.assign(zeroLengthRows[1], {
        cards_ores_ergasias: 4,
        cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '09:00',
        cards_apo_ora_02: '12:00',
        cards_eos_ora_02: '16:00'
    });
    const zeroLengthSource = build(zeroLengthRows).groups[0].items[0].proposed_values;
    assert.strictEqual(zeroLengthSource.apo_ora_01_apologistika, '');
    assert.strictEqual(zeroLengthSource.eos_ora_01_apologistika, '');
    assert.strictEqual(zeroLengthSource.apo_ora_02_apologistika, '12:00');
    assert.strictEqual(zeroLengthSource.eos_ora_02_apologistika, '16:00');

    const threeIntervalRows = fullTimeWeek();
    Object.assign(threeIntervalRows[1], {
        cards_ores_ergasias: 7.5,
        cards_apo_ora_01: '06:00',
        cards_eos_ora_01: '08:00',
        cards_apo_ora_02: '09:00',
        cards_eos_ora_02: '12:00',
        cards_apo_ora_03: '13:00',
        cards_eos_ora_03: '15:30'
    });
    const threeIntervalSource = build(threeIntervalRows).groups[0].items[0].proposed_values;
    assert.deepStrictEqual(
        [
            threeIntervalSource.apo_ora_01_apologistika,
            threeIntervalSource.eos_ora_01_apologistika,
            threeIntervalSource.apo_ora_02_apologistika,
            threeIntervalSource.eos_ora_02_apologistika,
            threeIntervalSource.apo_ora_03_apologistika,
            threeIntervalSource.eos_ora_03_apologistika
        ],
        ['06:00', '08:00', '09:00', '12:00', '13:00', '15:30']
    );
}

function testNonReadyProposalPaths() {
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
    const sixthDayResolution = build(deficit, {
        typos_apasxolhshs: 'PLHRHS', pososto_prosayxhshs_6hs_hmeras: 0,
        eidikh_kathgoria_ergazomenoy: '0009'
    });
    assert.strictEqual(sixthDayResolution.projection_status, 'READY');
    assert.strictEqual(
        sixthDayResolution.groups[0].repo_resolution.resolved_repo,
        1
    );
    assert.strictEqual(
        sixthDayResolution.groups[0].repo_resolution.sixth_day_count,
        1
    );
    assert.strictEqual(
        build(fullTimeWeek(), { typos_apasxolhshs: 'PLHRHS'})
            .projection_status,
        'READY'
    );
    assertNotAvailable(build(fullTimeWeek().slice(0, 6)), 'INCOMPLETE_WEEK_DATA');
}

function testTargetWarningsArePreserved() {
    const rows = fullTimeWeek();
    rows[4].cards_apo_ora_01 = '09:00';
    rows[4].cards_eos_ora_01 = '09:15';
    const result = build(rows);

    assertReady(result);
    assert.deepStrictEqual(result.warnings, ['TARGET_ZERO_HOURS_WITH_CARD_INTERVALS']);
    assert.deepStrictEqual(result.groups[0].warnings, result.warnings);
    assert.notStrictEqual(result.groups[0].warnings, result.warnings);
}

function testMissingAndDuplicateIdsDoNotCreateGroups() {
    const missingSource = fullTimeWeek();
    delete missingSource[1]._id;
    assertNotAvailable(build(missingSource), 'MISSING_SOURCE_RECORD_ID');

    const missingTarget = fullTimeWeek();
    delete missingTarget[4]._id;
    assertNotAvailable(build(missingTarget), 'MISSING_TARGET_RECORD_ID');

    const duplicate = fullTimeWeek();
    duplicate[4]._id = duplicate[1]._id;
    assertNotAvailable(build(duplicate), 'DUPLICATE_PAIR_RECORD_ID');
}

function deepFreezeFixture(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    if (value instanceof Map) value.forEach((mapValue) => deepFreezeFixture(mapValue));
    else Object.keys(value).forEach((key) => deepFreezeFixture(value[key]));
    return Object.freeze(value);
}

function testInputImmutability() {
    const rows = fullTimeWeek();
    const profile = { typos_apasxolhshs: 'PLHRHS'};
    const holidayByDateKey = new Map([[dateKey(0), null]]);
    const existingAuditCountByRowKey = { [dateKey(0)]: 0 };
    const before = JSON.stringify({ rows, profile, existingAuditCountByRowKey });
    const holidayBefore = [...holidayByDateKey.entries()];

    buildWeeklyRepoTransferSinglePairGroupProjection({
        weekRows: rows,
        employmentProfile: profile,
        holidayByDateKey,
        existingAuditCountByRowKey
    });
    assert.strictEqual(JSON.stringify({ rows, profile, existingAuditCountByRowKey }), before);
    assert.deepStrictEqual([...holidayByDateKey.entries()], holidayBefore);
    assert.strictEqual(Object.isFrozen(rows), false);
    assert.strictEqual(Object.isFrozen(rows[0]), false);
    assert.strictEqual(Object.isFrozen(profile), false);
    assert.strictEqual(Object.isFrozen(holidayByDateKey), false);

    const frozenRows = deepFreezeFixture(fullTimeWeek());
    const frozenProfile = deepFreezeFixture({
        typos_apasxolhshs: 'PLHRHS', hmeres_ergasias_ebdomadas: 5
    });
    const frozenHoliday = deepFreezeFixture(new Map([[dateKey(0), null]]));
    const frozenAudit = deepFreezeFixture({});
    assertReady(
        buildWeeklyRepoTransferSinglePairGroupProjection({
            weekRows: frozenRows,
            employmentProfile: frozenProfile,
            holidayByDateKey: frozenHoliday,
            existingAuditCountByRowKey: frozenAudit
        })
    );
}

function testOutputOwnershipAndFreeze() {
    const rows = fullTimeWeek();
    const proposal = buildWeeklyRepoTransferSinglePairProposal({
        weekRows: rows,
        employmentProfile: { typos_apasxolhshs: 'PLHRHS', hmeres_ergasias_ebdomadas: 5 }
    });
    const result = build(rows);
    const group = result.groups[0];

    [
        result,
        result.summary,
        result.reasons,
        result.warnings,
        result.groups,
        group,
        group.items,
        group.items[0],
        group.items[0].proposed_values,
        group.items[0].flags,
        group.items[1],
        group.items[1].proposed_values,
        group.items[1].flags,
        group.pair_contract,
        group.pair_contract.apply_readiness,
        group.warnings
    ].forEach((value) => assert.strictEqual(Object.isFrozen(value), true));
    assert.notStrictEqual(group.items[0], proposal.items[0]);
    assert.notStrictEqual(group.items[0].proposed_values, proposal.items[0].proposed_values);
    assert.notStrictEqual(group.items[0], rows[1]);
    assert.strictEqual(result instanceof Map, false);
    assert.strictEqual(group.first_date instanceof Date, false);
}

function testTargetPresentationMetadataDoesNotChangeGroupIdentity() {
    const result = build(fullTimeWeek());
    const group = result.groups[0];
    const target = group.items[1];

    assert.strictEqual(target.kathgoria_ergasias, 'ΕΡΓ');
    assert.strictEqual(
        target.current_kathgoria_ergasias_apologistika,
        'ΑΔΕΙΑ'
    );
    assert.strictEqual(
        target.proposed_values.kathgoria_ergasias_apologistika,
        'ΑΝ'
    );
    assert.strictEqual(
        group.group_id,
        'policy-preview-paired-group-' +
            require('crypto').createHash('sha1').update(group.group_key).digest('hex').slice(0, 16)
    );
    assert.ok(!group.group_key.includes('ΑΔΕΙΑ'));
}

function testMissingAuthoritativeSourceScopeDisablesOnlyV5Reuse() {
    const rows = fullTimeWeek();
    const normal = buildWeeklyRepoTransferSinglePairGroupProjection({
        weekRows: rows,
        reusableScopeRows: rows,
        employmentProfile: {
            typos_apasxolhshs: 'PLHRHS',
            hmeres_ergasias_ebdomadas: 5
        }
    });
    const unresolved = buildWeeklyRepoTransferSinglePairGroupProjection({
        weekRows: rows,
        reusableScopeRows: [{ ...rows[0], _id: 'unrelated-row', ypokatasthma: '9999' }],
        employmentProfile: {
            typos_apasxolhshs: 'PLHRHS',
            hmeres_ergasias_ebdomadas: 5
        }
    });
    const normalGroup = normal.groups[0];
    const unresolvedGroup = unresolved.groups[0];
    const normalV5 = buildAtomicReusableCriteriaV5(normalGroup);
    const unresolvedV5 = buildAtomicReusableCriteriaV5(unresolvedGroup);

    assert.strictEqual(normalV5.validation.eligible, true);
    assert.ok(normalV5.fingerprint);
    assert.strictEqual(unresolved.projection_status, PROJECTION_STATUS.READY);
    assert.strictEqual(unresolvedGroup.status, normalGroup.status);
    assert.strictEqual(unresolvedGroup.group_id, normalGroup.group_id);
    assert.strictEqual(unresolvedGroup.items.length, 2);
    assert.strictEqual(unresolvedGroup.ypokatasthma, null);
    assert.notStrictEqual(unresolvedGroup.ypokatasthma, '9999');
    assert.deepStrictEqual(unresolvedGroup.atomic_reusable_diagnostics,
        ['ATOMIC_LINKED_SET_SOURCE_SCOPE_UNRESOLVED']);
    assert.strictEqual(unresolvedV5.validation.eligible, false);
    assert.ok(unresolvedV5.validation.diagnostics.includes(
        'ATOMIC_LINKED_SET_SOURCE_SCOPE_UNRESOLVED'
    ));
    assert.strictEqual(unresolvedV5.criteria, null);
    assert.strictEqual(unresolvedV5.fingerprint, null);
}

function testMongoObjectIdRowsResolveAuthoritativeSourceScope() {
    const rows = fullTimeWeek();
    rows.forEach((row, index) => {
        row._id = new mongoose.Types.ObjectId(
            `507f1f77bcf86cd7994390${String(index + 10).padStart(2, '0')}`
        );
    });
    Object.assign(rows[1], {
        has_manual_override: true,
        current_eligible: false
    });
    const result = buildWeeklyRepoTransferSinglePairGroupProjection({
        weekRows: rows,
        reusableScopeRows: rows,
        employmentProfile: {
            typos_apasxolhshs: 'PLHRHS',
            hmeres_ergasias_ebdomadas: 5
        }
    });
    assertReady(result);
    const group = result.groups[0];
    const [source, target] = group.items;

    assert.strictEqual(source.prodhlomena_oraria_id, rows[1]._id.toHexString());
    assert.strictEqual(target.prodhlomena_oraria_id, rows[4]._id.toHexString());
    assert.strictEqual(group.ypokatasthma, '0001');
    assert.ok(!group.atomic_reusable_diagnostics.includes(
        'ATOMIC_LINKED_SET_SOURCE_SCOPE_UNRESOLVED'
    ));
    assert.deepStrictEqual(source.flags, {
        atomic_pair_member: true,
        requires_human_approval: true,
        approval_supported: false,
        batch_approvable: false,
        runtime_apply_supported: false,
        is_locked: false,
        has_manual_override: true,
        current_eligible: false
    });
    assert.strictEqual(target.flags.is_locked, false);
    assert.strictEqual(target.flags.has_manual_override, false);
    assert.strictEqual(target.flags.current_eligible, true);

    const eligibleRows = rows.map((row) => ({
        ...row,
        has_manual_override: false,
        current_eligible: true
    }));
    const eligibleGroup = buildWeeklyRepoTransferSinglePairGroupProjection({
        weekRows: eligibleRows,
        reusableScopeRows: eligibleRows,
        employmentProfile: {
            typos_apasxolhshs: 'PLHRHS',
            hmeres_ergasias_ebdomadas: 5
        }
    }).groups[0];
    const reusable = buildAtomicReusableCriteriaV5(eligibleGroup);
    assert.strictEqual(reusable.validation.eligible, true,
        reusable.validation.diagnostics.join(','));
    assert.ok(!reusable.validation.diagnostics.includes(
        'ATOMIC_LINKED_SET_BRANCH_MISMATCH'
    ));
    assert.ok(reusable.fingerprint);

    const unrelatedScope = eligibleRows.map((row) => ({ ...row }));
    unrelatedScope[1]._id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439099');
    const unresolvedGroup = buildWeeklyRepoTransferSinglePairGroupProjection({
        weekRows: eligibleRows,
        reusableScopeRows: unrelatedScope,
        employmentProfile: {
            typos_apasxolhshs: 'PLHRHS',
            hmeres_ergasias_ebdomadas: 5
        }
    }).groups[0];
    assert.strictEqual(unresolvedGroup.ypokatasthma, null);
    assert.deepStrictEqual(unresolvedGroup.atomic_reusable_diagnostics,
        ['ATOMIC_LINKED_SET_SOURCE_SCOPE_UNRESOLVED']);

    assert.strictEqual(normalizeRowId(rows[1]._id), rows[1]._id.toHexString());
    assert.strictEqual(normalizeRowId(' row-source '), 'row-source');
    assert.strictEqual(normalizeRowId({ toString: () => rows[1]._id.toHexString() }), null);
}

function run() {
    testValidFullTimeProjection();
    testValidPartTimeProjection();
    testTargetBeforeSourceKeepsSemanticOrder();
    testStableGroupIdentity();
    testSplitShiftIntervalsArePreservedInProjection();
    testNonReadyProposalPaths();
    testTargetWarningsArePreserved();
    testMissingAndDuplicateIdsDoNotCreateGroups();
    testInputImmutability();
    testOutputOwnershipAndFreeze();
    testTargetPresentationMetadataDoesNotChangeGroupIdentity();
    testMissingAuthoritativeSourceScopeDisablesOnlyV5Reuse();
    testMongoObjectIdRowsResolveAuthoritativeSourceScope();
    console.log('apasxoliseis weekly repo transfer single-pair group projection tests passed');
}

run();
