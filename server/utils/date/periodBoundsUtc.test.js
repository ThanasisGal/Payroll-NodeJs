const assert = require('assert');
const { buildPeriodBoundsUtc } = require('./periodBoundsUtc');

function assertUtcMidnight(date) {
    assert.strictEqual(date.getUTCHours(), 0);
    assert.strictEqual(date.getUTCMinutes(), 0);
    assert.strictEqual(date.getUTCSeconds(), 0);
    assert.strictEqual(date.getUTCMilliseconds(), 0);
}

function assertBounds(year, periodCode, expectedApo, expectedEos) {
    const bounds = buildPeriodBoundsUtc(year, periodCode);
    assert.strictEqual(bounds.apo.toISOString(), `${expectedApo}T00:00:00.000Z`);
    assert.strictEqual(bounds.eos.toISOString(), `${expectedEos}T00:00:00.000Z`);
    assertUtcMidnight(bounds.apo);
    assertUtcMidnight(bounds.eos);
}

assertBounds('2026', '01', '2026-01-01', '2026-01-31');
assertBounds('2026', '02', '2026-02-01', '2026-02-28');
assertBounds('2028', '02', '2028-02-01', '2028-02-29');
assertBounds('2026', '03', '2026-03-01', '2026-03-31');
assertBounds('2026', '04', '2026-04-01', '2026-04-30');
assertBounds('2026', '12', '2026-12-01', '2026-12-31');

for (const year of ['2026', '2028']) {
    for (let month = 1; month <= 12; month += 1) {
        const periodCode = String(month).padStart(2, '0');
        const bounds = buildPeriodBoundsUtc(year, periodCode);
        assert.strictEqual(bounds.apo.getUTCFullYear(), Number(year));
        assert.strictEqual(bounds.apo.getUTCMonth(), month - 1);
        assert.strictEqual(bounds.apo.getUTCDate(), 1);
        assert.strictEqual(bounds.eos.getUTCFullYear(), Number(year));
        assert.strictEqual(bounds.eos.getUTCMonth(), month - 1);
        assert.strictEqual(bounds.eos.getUTCDate(), new Date(Date.UTC(Number(year), month, 0)).getUTCDate());
        assertUtcMidnight(bounds.apo);
        assertUtcMidnight(bounds.eos);
    }
}

for (const invalidYear of ['invalid', '26', '20260', '', null, undefined]) {
    assert.throws(() => buildPeriodBoundsUtc(invalidYear, '01'), /four-digit year/);
}

for (const invalidPeriodCode of ['00', '13', '1', '2x', '', null, undefined]) {
    assert.throws(() => buildPeriodBoundsUtc('2026', invalidPeriodCode), /"01" to "12"/);
}

console.log('UTC payroll period bounds tests passed');
