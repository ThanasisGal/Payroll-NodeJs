const assert = require('node:assert/strict');
const {
    buildWeeklyRepoPostCheckWritePlan
} = require('./apasxoliseisWeeklyPostCheckWritePlanService');
const {
    buildWeeklyIllegalOvertimePersistenceMapping,
    OVERLAPPING_LEGAL_FIELDS
} = require('./apasxoliseisWeeklyIllegalOvertimeMappingService');

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

// Input rows deliberately represent the post-first-stage/reload boundary.
const sixthRows = week([7, 7, 7, 7, 7, 9, 0]);
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

console.log('weekly post-check pure write-plan contract tests passed (9 contracts)');
