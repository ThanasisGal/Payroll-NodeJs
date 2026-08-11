const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

const {
    analyzeWeeklySixthSeventhDay
} = require('./apasxoliseisWeeklySixthSeventhDayPolicyService');
const {
    OVERLAPPING_LEGAL_FIELDS
} = require('./apasxoliseisWeeklyIllegalOvertimeMappingService');

function loadControllerTestHelper() {
    const filename = path.resolve(__dirname, '../../controllers/ergazomenoi/erganhController.js');
    const source = `${fs.readFileSync(filename, 'utf8')}\n` +
        'module.exports.__c36BuildWeeklyIllegalOvertimeUpdate = buildWeeklyIllegalOvertimeUpdate;\n';
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    const originalRequire = loaded.require.bind(loaded);
    loaded.require = (request) => request === '../../config/aws'
        ? { s3Client: {} }
        : originalRequire(request);
    loaded._compile(source, filename);
    return loaded.exports.__c36BuildWeeklyIllegalOvertimeUpdate;
}

const buildWeeklyIllegalOvertimeUpdate = loadControllerTestHelper();
const ILLEGAL_FIELDS = Object.freeze({
    normal: 'ores_paranomhs_yperorias_apologistika',
    night: 'ores_paranomhs_yperorias_nyxtas_apologistika',
    holiday: 'ores_paranomhs_yperorias_argion_apologistika',
    holidayNight: 'ores_paranomhs_yperorias_argion_nyxtas_apologistika'
});

function row(date, hours, intervals, repo) {
    const result = {
        hmeromhnia: date,
        kathgoria_ergasias: repo ? 'ΑΝ' : 'ΕΡΓ',
        repo,
        ores_ergasias: hours,
        cards_ores_ergasias: hours
    };
    intervals.forEach(([start, end], index) => {
        result[`cards_apo_ora_0${index + 1}`] = start;
        result[`cards_eos_ora_0${index + 1}`] = end;
    });
    return result;
}

function canonicalWeek({ seventhDate, hours, intervals }) {
    const dates = Array.from({ length: 7 }, (_, index) => {
        const date = new Date('2026-08-03T00:00:00.000Z');
        date.setUTCDate(date.getUTCDate() + index);
        return date.toISOString().slice(0, 10);
    });
    const saturday = dates[5];
    const sunday = dates[6];
    const rows = dates.map((date, index) => row(date, 7, [['10:00', '17:00']], index >= 5));
    const seventhIndex = seventhDate === 'SUNDAY' ? 6 : 5;
    rows[seventhIndex] = row(dates[seventhIndex], hours, intervals, true);
    if (seventhIndex === 6) rows[5] = row(saturday, 8, [['10:00', '18:00']], true);
    if (seventhIndex === 5) rows[6] = row(sunday, 8, [['10:00', '18:00']], true);

    const analysis = analyzeWeeklySixthSeventhDay({
        weekRows: rows,
        effectiveProfile: {
            hmeres_ergasias_ebdomadas: 5,
            pososto_prosayxhshs_6hs_hmeras: 40,
            source: 'C3.6_TEST'
        }
    });
    return { analysis, seventhRow: rows[seventhIndex] };
}

const cases = [
    { name: 'A plain daytime', seventhDate: 'SATURDAY', hours: 8,
        intervals: [['10:00', '18:00']], expected: [8, 0, 0, 0] },
    { name: 'B pure night', seventhDate: 'SATURDAY', hours: 4,
        intervals: [['02:00', '06:00']], expected: [0, 4, 0, 0] },
    { name: 'C mixed day and night', seventhDate: 'SATURDAY', hours: 5,
        intervals: [['18:00', '23:00']], expected: [4, 1, 0, 0] },
    { name: 'D Sunday daytime', seventhDate: 'SUNDAY', hours: 10,
        intervals: [['10:00', '20:00']], expected: [0, 0, 10, 0] },
    { name: 'E Sunday and night', seventhDate: 'SUNDAY', hours: 10,
        intervals: [['10:00', '19:00'], ['22:00', '23:00']], expected: [0, 0, 9, 1] },
    { name: 'F official holiday daytime', seventhDate: 'SATURDAY', hours: 8,
        intervals: [['10:00', '18:00']], holidays: ['2026-08-08'], expected: [0, 0, 8, 0] },
    { name: 'G official holiday and night', seventhDate: 'SATURDAY', hours: 8,
        intervals: [['14:00', '20:00'], ['22:00', '00:00']], holidays: ['2026-08-08'],
        expected: [0, 0, 6, 2] },
    { name: 'H overnight date crossing into Sunday', seventhDate: 'SATURDAY', hours: 4,
        intervals: [['22:00', '02:00']], expected: [0, 2, 0, 2] },
    { name: 'I more than eight hours', seventhDate: 'SATURDAY', hours: 10,
        intervals: [['10:00', '20:00']], expected: [10, 0, 0, 0] }
];

for (const scenario of cases) {
    const { analysis, seventhRow } = canonicalWeek(scenario);
    assert.equal(analysis.status, 'READY', `${scenario.name}: canonical analysis status`);
    assert.equal(analysis.seventhDay.hmeromhnia, seventhRow.hmeromhnia,
        `${scenario.name}: canonical seventh identity`);
    assert.equal(analysis.seventhDay.classification, 'SEVENTH_DAY_ILLEGAL_OVERTIME');
    assert.equal(analysis.seventhDay.severity, 'SERIOUS_VIOLATION');
    assert.equal(analysis.seventhDay.illegalOvertimeHours, scenario.hours);

    const mapped = buildWeeklyIllegalOvertimeUpdate(
        seventhRow,
        {},
        analysis.seventhDay.illegalOvertimeHours,
        new Set(scenario.holidays || []),
        { clearOverlappingLegal: true }
    );
    const actual = Object.values(ILLEGAL_FIELDS).map((field) => mapped[field]);
    assert.deepEqual(actual, scenario.expected, `${scenario.name}: illegal overlay buckets`);
    assert.ok(Math.abs(actual.reduce((sum, value) => sum + value, 0) - scenario.hours) <= 0.02,
        `${scenario.name}: illegal-hour conservation`);
    OVERLAPPING_LEGAL_FIELDS.forEach((field) => {
        assert.equal(mapped[field], 0, `${scenario.name}: ${field} leakage`);
    });
}

console.log('seventh-day illegal-overtime overlay matrix tests passed');
