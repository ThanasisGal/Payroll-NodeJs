const assert = require('node:assert/strict');
const {
    buildWeeklyRepoPostCheckWritePlan
} = require('./apasxoliseisWeeklyPostCheckWritePlanService');
const {
    buildWeeklyIllegalOvertimePersistenceMapping,
    OVERLAPPING_LEGAL_FIELDS
} = require('./apasxoliseisWeeklyIllegalOvertimeMappingService');
const { analyzeWeeklySixthSeventhDay } = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const { buildCanonicalWeeklyDecisionSnapshot, fingerprint } =
    require('./apasxoliseisWeeklyCanonicalDecisionService');
const { buildWeeklyCanonicalDecisionSnapshotInput, groupWeeklyCanonicalDecisions } =
    require('./apasxoliseisWeeklyCanonicalDecisionSnapshotInputService');
const { getWeeklyRepoProfileInfo } =
    require('./apasxoliseisWeeklyRepoTransferAuthoritativeContextService');

const ILLEGAL_FIELDS = [
    'ores_paranomhs_yperorias_apologistika',
    'ores_paranomhs_yperorias_nyxtas_apologistika',
    'ores_paranomhs_yperorias_argion_apologistika',
    'ores_paranomhs_yperorias_argion_nyxtas_apologistika'
];

function timeMinutes(value) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}

function illegalUpdate(row, profile, hours, holidays, options) {
    const worked = [];
    for (let index = 1; index <= 3; index += 1) {
        const startValue = row[`cards_apo_ora_0${index}`];
        const endValue = row[`cards_eos_ora_0${index}`];
        if (!startValue || !endValue) continue;
        const start = timeMinutes(startValue);
        let end = timeMinutes(endValue);
        if (end < start) end += 1440;
        for (let minute = start; minute < end; minute += 1) worked.push(minute);
    }
    const target = Math.round(hours * 60);
    const classified = { normal: 0, night: 0, holiday: 0, holidayNight: 0 };
    for (const minute of worked.slice(Math.max(0, worked.length - target))) {
        const actualDate = new Date(row.hmeromhnia);
        actualDate.setUTCDate(actualDate.getUTCDate() + Math.floor(minute / 1440));
        const key = actualDate.toISOString().slice(0, 10);
        const localMinute = minute % 1440;
        const night = localMinute >= 22 * 60 || localMinute < 6 * 60;
        const holiday = actualDate.getUTCDay() === 0 || holidays.has(key);
        const bucket = night && holiday ? 'holidayNight' : holiday ? 'holiday' : night ? 'night' : 'normal';
        classified[bucket] += 1 / 60;
    }
    return buildWeeklyIllegalOvertimePersistenceMapping(
        Object.fromEntries(Object.entries(classified).map(([key, value]) => [key, +value.toFixed(2)])),
        options
    );
}

function employee(overrides = {}) {
    return {
        kodikos: 'D1',
        ypokatasthma: '0000',
        eponymo: 'TEST',
        onoma: 'D1',
        hmeres_ergasias_ebdomadas: 5,
        ores_ergasias_ebdomadas: 40,
        mo_oron_hmerhsias_ergasias: 8,
        typos_apasxolhshs: '0',
        typos_ergazomenon: 'Μ',
        pososto_prosayxhshs_6hs_hmeras: 40,
        nomimoOromisthio: 8,
        pragmatikoOromisthio: 10,
        source: 'CURRENT_EMPLOYEE_FALLBACK',
        ...overrides
    };
}

function row(date, hours, repo, interval = ['10:00', '17:00'], overrides = {}) {
    return {
        _id: String(100000000000000000000000n + BigInt(new Date(date).getUTCDate())),
        team: 'THA',
        company_kod: 'company',
        ypokatasthma: '0000',
        kodikos: 'D1',
        hmeromhnia: date,
        kathgoria_ergasias: repo ? 'ΑΝ' : 'ΕΡΓ',
        kathgoria_ergasias_apologistika: repo ? 'ΑΝ' : 'ΕΡΓ',
        repo,
        repo_apologistika: repo,
        ores_ergasias: hours,
        ores_ergasias_apologistika: hours,
        cards_ores_ergasias: hours,
        cards_apo_ora_01: hours > 0 ? interval[0] : '',
        cards_eos_ora_01: hours > 0 ? interval[1] : '',
        cards_apo_ora_02: '', cards_eos_ora_02: '',
        cards_apo_ora_03: '', cards_eos_ora_03: '',
        adeia: false, adeia_apologistika: false,
        argia: false, argia_apologistika: false,
        astheneia: false, astheneia_apologistika: false,
        ores_apoysias: 0,
        ores_nyxtas_apologistika: 0,
        ores_argion_prosayxhsh_apologistika: 0,
        ores_argion_ergasia_apologistika: 0,
        ...Object.fromEntries(ILLEGAL_FIELDS.map((field) => [field, 0])),
        ...overrides
    };
}

function week(hours, intervals = {}) {
    return hours.map((hoursForDay, index) => {
        const date = new Date('2026-08-03T00:00:00.000Z');
        date.setUTCDate(date.getUTCDate() + index);
        return row(
            date.toISOString().slice(0, 10),
            hoursForDay,
            index >= 5,
            intervals[index] || (hoursForDay === 9 ? ['10:00', '19:00']
                : hoursForDay === 10 ? ['10:00', '20:00'] : ['10:00', '17:00'])
        );
    });
}

function plan(rows, overrides = {}) {
    return buildWeeklyRepoPostCheckWritePlan({
        sessionTeam: 'THA',
        companyId: 'company',
        apoDate: new Date('2026-08-03T00:00:00.000Z'),
        eosDate: new Date('2026-08-09T23:59:59.999Z'),
        employees: [employee()],
        rows,
        istorikoRowsByKodikos: new Map(),
        companyPolicyRules: [],
        postCheckArgiesDateSet: new Set(),
        noCardsDisplayContext: {},
        appliedProtectionContext: { entriesByRowId: {} },
        appliedProtectionReasonsByWeek: new Map(),
        buildWeeklyIllegalOvertimeUpdate: illegalUpdate,
        ...overrides
    });
}

function updateFor(result, date) {
    const day = new Date(`${date}T00:00:00.000Z`).getUTCDate();
    const rowId = String(100000000000000000000000n + BigInt(day));
    const operation = result.bulkOps.find(({ updateOne }) => updateOne.filter._id === rowId);
    assert.ok(operation, `missing update for ${date}`);
    return operation.updateOne.update.$set;
}

function onlyDeviation(result) {
    assert.equal(result.deviations.length, 1);
    return result.deviations[0];
}

function decisionFor(rows, decisionType, decisionPayload, overrides = {}) {
    const sourceEmployee = employee();
    const decisionWeek = { naturalWeekStart: new Date('2026-08-03'),
        naturalWeekEnd: new Date('2026-08-09'), weekStart: new Date('2026-08-03'),
        weekEnd: new Date('2026-08-09'), isFullWeek: true };
    const effectiveProfile = getWeeklyRepoProfileInfo({ week: decisionWeek,
        istorikoRows: [], ergazomenos: sourceEmployee }).effectiveProfile;
    const automaticAnalysis = analyzeWeeklySixthSeventhDay({ weekRows: rows,
        effectiveProfile, hourlyRate: effectiveProfile.pragmatikoOromisthio });
    const snapshotInput = buildWeeklyCanonicalDecisionSnapshotInput({
        team: 'THA', company_kod: 'company', employee: sourceEmployee,
        week: decisionWeek,
        weekRows: rows, effectiveProfile, profileHistory: [], automaticAnalysis,
        appliedProtectionContext: overrides.appliedProtectionContext || { entriesByRowId: {} }
    });
    const snapshot = buildCanonicalWeeklyDecisionSnapshot(snapshotInput);
    return { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
        employee_kodikos: 'D1', week_start: new Date('2026-08-03'),
        week_end: new Date('2026-08-09'), decision_status: 'RECORDED',
        snapshot_fingerprint: snapshot.fingerprint, decision_type: decisionType,
        decision_payload: decisionPayload, decision_payload_fingerprint: fingerprint(decisionPayload),
        created_at: new Date('2026-08-10') };
}

// Input rows deliberately represent the post-first-stage/reload boundary.
const sixthRows = week([4, 4, 4, 4, 4, 9, 0]);
let result = plan(sixthRows);
let update = updateFor(result, '2026-08-08');
assert.equal(update.compensation_breakdown_apologistika.hours.sixthDayHours, 8);
assert.equal(update.compensation_breakdown_apologistika.hours.illegalOvertimeHours, 1);
assert.deepEqual(ILLEGAL_FIELDS.map((field) => update[field]), [1, 0, 0, 0]);

const seventhRows = week([7, 7, 7, 7, 7, 7, 10]);
result = plan(seventhRows);
update = updateFor(result, '2026-08-09');
assert.deepEqual(ILLEGAL_FIELDS.map((field) => update[field]), [0, 0, 10, 0]);
assert.equal(update.compensation_breakdown_apologistika.hours.illegalOvertimeHours, 10);
assert.equal(update.apologistiko_biblio, true);
assert.equal(update.apo_ora_01_apologistika, '10:00');
assert.equal(update.eos_ora_01_apologistika, '20:00');
OVERLAPPING_LEGAL_FIELDS.forEach((field) => assert.equal(update[field], 0));

const overlayRows = week([7, 7, 7, 7, 7, 7, 4], { 6: ['22:00', '02:00'] });
result = plan(overlayRows);
update = updateFor(result, '2026-08-09');
assert.deepEqual(ILLEGAL_FIELDS.map((field) => update[field]), [0, 2, 0, 2]);
assert.equal(ILLEGAL_FIELDS.reduce((sum, field) => sum + update[field], 0), 4);
OVERLAPPING_LEGAL_FIELDS.forEach((field) => assert.equal(update[field], 0));

const movedRows = week([7, 7, 7, 7, 7, 10, 7]);
const oldIdentity = movedRows[6];
ILLEGAL_FIELDS.forEach((field) => { oldIdentity[field] = 0; });
result = plan(movedRows);
const oldUpdate = updateFor(result, '2026-08-09');
assert.equal(oldUpdate.compensation_breakdown_apologistika.hours.illegalOvertimeHours, 0);
assert.ok(ILLEGAL_FIELDS.every((field) => !Object.hasOwn(oldUpdate, field)));
update = updateFor(result, '2026-08-08');
assert.equal(ILLEGAL_FIELDS.reduce((sum, field) => sum + update[field], 0), 10);

const protectedRows = week([7, 7, 7, 7, 7, 9, 0]);
const protectedRow = protectedRows[5];
protectedRow.kathgoria_ergasias = 'ΕΡΓ';
protectedRow.ores_ergasias = 9;
protectedRow.kathgoria_ergasias_apologistika = 'ΜΕ';
protectedRow.repo_apologistika = true;
const normalizedId = protectedRow._id.toLowerCase();
result = plan(protectedRows, {
    appliedProtectionContext: {
        entriesByRowId: {
            [normalizedId]: {
                state: 'PROTECTED',
                protectedValues: {
                    kathgoria_ergasias_apologistika: 'ΜΕ',
                    repo_apologistika: true
                }
            }
        }
    }
});
update = updateFor(result, '2026-08-08');
assert.ok(!Object.hasOwn(update, 'kathgoria_ergasias_apologistika'));
assert.ok(!Object.hasOwn(update, 'repo_apologistika'));
assert.ok(Object.hasOwn(update, 'compensation_breakdown_apologistika'));

const blockedRows = week([7, 7, 7, 7, 7, 7, 0]);
blockedRows[5].cards_eos_ora_01 = '';
result = plan(blockedRows);
update = updateFor(result, '2026-08-08');
assert.equal(update.compensation_breakdown_apologistika.status, 'NEEDS_HR_DECISION');
assert.ok(update.compensation_breakdown_apologistika.reasons.includes('CARD_VERIFICATION_PENDING'));
assert.equal(update.compensation_breakdown_apologistika.hours.sixthDayHours, 0);

const ambiguousRows = week([7, 7, 7, 7, 7, 7, 0]);
Object.assign(ambiguousRows[6], {
    kathgoria_ergasias: 'ΕΡΓ',
    kathgoria_ergasias_apologistika: 'ΕΡΓ',
    repo: false,
    repo_apologistika: false
});
result = plan(ambiguousRows);
let deviation = onlyDeviation(result);
assert.equal(deviation.status, 'NEEDS_HR_DECISION');
assert.ok(deviation.reasons.includes('CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'));

const humanRepoRows = week([7, 7, 7, 7, 7, 8, 7]);
Object.assign(humanRepoRows[4], { kathgoria_ergasias: 'ΑΝ',
    kathgoria_ergasias_apologistika: 'ΑΝ', repo: true, repo_apologistika: true });
const humanRepoDecision = decisionFor(humanRepoRows,
    'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC', {
        current_repo_identities: ['2026-08-08', '2026-08-09'], applied_execution_id: null
    });
result = plan(humanRepoRows, {
    canonicalDecisionsByWeek: groupWeeklyCanonicalDecisions([humanRepoDecision])
});
update = updateFor(result, '2026-08-08');
assert.equal(update.compensation_breakdown_apologistika.hours.sixthDayHours, 8);
assert.equal(update.compensation_breakdown_apologistika.hours.illegalOvertimeHours, 0);
update = updateFor(result, '2026-08-09');
assert.equal(update.compensation_breakdown_apologistika.hours.sixthDayHours, 0);
deviation = onlyDeviation(result);
assert.ok(!Array.isArray(deviation.reasons) ||
    !deviation.reasons.includes('CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'));

const classificationRows = week([7, 7.9, 7.5, 7, 7, 7.8, 7.7]);
classificationRows[5].cards_eos_ora_01 = '17:48';
const classificationDecision = decisionFor(classificationRows, 'CLASSIFICATION_BY_DATE', {
    classification_by_date: {
        '2026-08-04': 'NORMAL',
        '2026-08-05': 'SIXTH',
        '2026-08-08': 'SEVENTH'
    }
});
result = plan(classificationRows, {
    canonicalDecisionsByWeek: groupWeeklyCanonicalDecisions([classificationDecision])
});
update = updateFor(result, '2026-08-05');
assert.equal(update.compensation_breakdown_apologistika.hours.sixthDayHours, 7.5);
assert.equal(update.compensation_breakdown_apologistika.hours.illegalOvertimeHours, 0);
const automaticCandidateUpdate = updateFor(result, '2026-08-04');
assert.equal(automaticCandidateUpdate.compensation_breakdown_apologistika.hours.sixthDayHours, 0);
update = updateFor(result, '2026-08-08');
assert.equal(update.compensation_breakdown_apologistika.hours.illegalOvertimeHours, 7.8);
assert.equal(ILLEGAL_FIELDS.reduce((sum, field) => sum + update[field], 0), 7.8);
OVERLAPPING_LEGAL_FIELDS.forEach((field) => assert.equal(update[field], 0));

const staleDecision = { ...decisionFor(ambiguousRows,
    'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC', {
        current_repo_identities: ['2026-08-08', '2026-08-09'], applied_execution_id: null
    }), snapshot_fingerprint: '0'.repeat(64) };
result = plan(ambiguousRows, {
    canonicalDecisionsByWeek: groupWeeklyCanonicalDecisions([staleDecision])
});
deviation = onlyDeviation(result);
assert.ok(deviation.reasons.includes('CANONICAL_DECISION_STALE'));

const pendingRows = week([7, 7, 7, 7, 7, 0, 0]);
pendingRows[0].cards_eos_ora_01 = '';
result = plan(pendingRows);
deviation = onlyDeviation(result);
assert.equal(deviation.expected_repo, 2);
assert.equal(deviation.actual_repo, 2);
assert.equal(deviation.missing_repo, 0);
assert.equal(deviation.excess_repo, 0);
assert.equal(deviation.status, 'NEEDS_HR_DECISION');
assert.deepEqual(deviation.reasons, ['CARD_VERIFICATION_PENDING']);
update = updateFor(result, '2026-08-03');
assert.ok(update.compensation_breakdown_apologistika.reasons.includes('CARD_VERIFICATION_PENDING'));
assert.ok(deviation.reasons.every((reason) =>
    update.compensation_breakdown_apologistika.reasons.includes(reason)
));

const profileRows = week([7, 7, 7, 7, 7, 0, 0]);
Object.assign(profileRows[6], {
    kathgoria_ergasias: 'ΕΡΓ',
    kathgoria_ergasias_apologistika: 'ΕΡΓ',
    repo: false,
    repo_apologistika: false
});
const changedHistory = {
    _id: '200000000000000000000001',
    kodikos: 'D1',
    hmeromhnia_isxyos_oron_ergasias_apo: '2026-08-06',
    hmeres_ergasias_ebdomadas: 6,
    ores_ergasias_ebdomadas: 40,
    mo_oron_hmerhsias_ergasias: 6.67,
    typos_apasxolhshs: '0',
    pososto_prosayxhshs_6hs_hmeras: 40,
    nomimoOromisthio: 8,
    pragmatikoOromisthio: 10,
    employment_profile_source: 'D3_HISTORY'
};
result = plan(profileRows, {
    istorikoRowsByKodikos: new Map([['D1', [changedHistory]]])
});
deviation = onlyDeviation(result);
assert.equal(deviation.expected_repo, 1);
assert.equal(deviation.actual_repo, 1);
assert.equal(deviation.missing_repo, 0);
assert.equal(deviation.excess_repo, 0);
assert.equal(deviation.status, 'NEEDS_HR_DECISION');
assert.deepEqual(deviation.reasons, ['PROFILE_CHANGED_INSIDE_WEEK']);
assert.equal(deviation.deviation_type, 'PROFILE_CHANGED_INSIDE_WEEK');

result = plan(ambiguousRows, {
    appliedProtectionReasonsByWeek: new Map([[
        'D1|2026-08-03',
        new Set([
            'CURRENT_IDENTITY_DIFFERS_FROM_APPLIED_EXECUTION',
            'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'
        ])
    ]])
});
deviation = onlyDeviation(result);
assert.deepEqual(deviation.reasons, [
    'CURRENT_IDENTITY_DIFFERS_FROM_APPLIED_EXECUTION',
    'CANONICAL_REPO_IDENTITIES_NOT_DETERMINISTIC'
]);

const readyRows = week([7, 7, 7, 7, 7, 0, 0]);
result = plan(readyRows);
assert.deepEqual(result.deviations, []);

const mismatchRows = week([7, 7, 7, 7, 7, 0, 0]);
Object.assign(mismatchRows[6], {
    kathgoria_ergasias: 'ΕΡΓ',
    kathgoria_ergasias_apologistika: 'ΕΡΓ',
    repo: false,
    repo_apologistika: false
});
result = plan(mismatchRows);
deviation = onlyDeviation(result);
assert.equal(deviation.expected_repo, 2);
assert.equal(deviation.actual_repo, 1);
assert.equal(deviation.missing_repo, 1);
assert.equal(deviation.excess_repo, 0);
assert.equal(deviation.status, undefined);
assert.equal(deviation.reasons, undefined);
assert.equal(deviation.deviation_type, 'WEEKLY_REPO_MISMATCH');

result = plan(sixthRows);
update = updateFor(result, '2026-08-08');
assert.equal(
    update.compensation_breakdown_apologistika.components.find(
        (component) => component.code === 'SIXTH_DAY_PREMIUM'
    ).ratePercent,
    40
);
assert.equal(update.compensation_breakdown_apologistika.rates.paidHourlyRate, 10);

const immutableInput = {
    rows: week([7, 7, 7, 7, 7, 9, 0]),
    histories: new Map([['D1', []]]),
    policies: [],
    holidays: new Set(),
    protection: { entriesByRowId: {} }
};
const before = structuredClone(immutableInput);
plan(immutableInput.rows, {
    istorikoRowsByKodikos: immutableInput.histories,
    companyPolicyRules: immutableInput.policies,
    postCheckArgiesDateSet: immutableInput.holidays,
    appliedProtectionContext: immutableInput.protection
});
assert.deepEqual(immutableInput, before);

// Focused shape assertions; complete old-vs-new extraction parity is verified separately.
const parityOperation = result.bulkOps.find(({ updateOne }) => updateOne.filter._id === sixthRows[5]._id);
assert.deepEqual(parityOperation.updateOne.filter, { _id: sixthRows[5]._id });
assert.equal(parityOperation.updateOne.upsert, false);
assert.deepEqual(result.compensationBreakdowns, {
    ready: 7,
    needsHrDecision: 0,
    daysWithRejectedCompanyRule: 0
});
assert.deepEqual(result.diagnostics, []);

const possibleRows = week([7, 7, 7, 7, 7, 0, 0]);
Object.assign(possibleRows[5], { kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    kathgoria_ergasias_apologistika: '', cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '', adeia_apologistika: false,
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' });
result = plan(possibleRows, { noCardsDisplayContext: {
    argiesByDateKey: new Map(), leaveByEmployeeDateKey: new Map()
} });
update = updateFor(result, '2026-08-08');
assert.notEqual(update.kathgoria_adeias_apologistika, 'ΑΔΑΛ');

const actualLeaveRows = week([7, 7, 7, 7, 7, 0, 0]);
Object.assign(actualLeaveRows[5], { kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    kathgoria_ergasias_apologistika: '', cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '', adeia: true,
    kathgoria_adeias: 'ΑΔΑΛ', adeia_apologistika: true,
    kathgoria_adeias_apologistika: 'ΑΔΑΛ' });
result = plan(actualLeaveRows);
update = updateFor(result, '2026-08-08');
assert.ok(!Object.hasOwn(update, 'kathgoria_adeias_apologistika'));

// Sequencing contract: Phase C consumes only the rows reloaded after Phase B.
// An already-applied repo transfer is therefore part of the effective input.
const appliedSequencingRows = week([7, 7, 8, 7, 7, 7, 0]);
Object.assign(appliedSequencingRows[2], {
    kathgoria_ergasias: 'ΑΝ', repo: true,
    kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: false
});
Object.assign(appliedSequencingRows[6], {
    kathgoria_ergasias: 'ΕΡΓ', repo: false, ores_ergasias: 8,
    kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true,
    apologistiko_biblio: true
});
result = plan(appliedSequencingRows);
update = updateFor(result, '2026-08-05');
assert.equal(update.compensation_breakdown_apologistika.hours.sixthDayHours, 8);

// A proposal which has not been applied is not an input to Phase C. The raw
// target must not be materialized as repo/book by the post-check write plan.
const unapprovedSequencingRows = structuredClone(appliedSequencingRows);
Object.assign(unapprovedSequencingRows[2], {
    kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: true
});
Object.assign(unapprovedSequencingRows[6], {
    kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: false,
    apologistiko_biblio: false
});
result = plan(unapprovedSequencingRows);
const unapprovedTargetUpdate = updateFor(result, '2026-08-09');
assert.notEqual(unapprovedTargetUpdate.repo_apologistika, true);
assert.notEqual(unapprovedTargetUpdate.kathgoria_ergasias_apologistika, 'ΑΝ');
assert.notEqual(unapprovedTargetUpdate.apologistiko_biblio, true);

console.log('weekly post-check pure write-plan contract tests passed (20 contracts)');
