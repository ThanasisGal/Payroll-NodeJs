'use strict';

const assert = require('assert');
const {
    intervalDurationMinutes,
    totalDeclaredDailyMinutes,
    buildDurationAnchoredInterval,
    resolveApologistikoArrivalDecision,
    resolveSafeStartOnlyOrphan
} = require('./apasxoliseisAttendanceDerivedScheduleService');

const decide = (actualArrival, flexibleArrivalMinutes = 120) =>
    resolveApologistikoArrivalDecision({ declaredStart: '12:00', actualArrival,
        flexibleArrivalMinutes }).requiresBook;

assert.strictEqual(decide('11:59'), true);
assert.strictEqual(decide('12:00'), false);
assert.strictEqual(decide('14:00'), false);
assert.strictEqual(decide('14:01'), true);
assert.strictEqual(resolveApologistikoArrivalDecision({ declaredStart: '12:00', actualArrival: '11:50',
    flexibleArrivalMinutes: 120, proorhProseleyshMinutes: 30 }).requiresBook, true);
for (const departure of ['19:00', '20:00', '23:59']) {
    assert.strictEqual(resolveApologistikoArrivalDecision({ declaredStart: '12:00',
        actualArrival: '12:00', actualDeparture: departure, flexibleArrivalMinutes: 120 }).requiresBook, false);
}

const split = { apo_ora_01: '08:00', eos_ora_01: '12:00',
    apo_ora_02: '16:00', eos_ora_02: '20:00' };
assert.strictEqual(totalDeclaredDailyMinutes(split), 480);
assert.deepStrictEqual(buildDurationAnchoredInterval({ row: split, actualArrival: '08:30' }),
    { start: '08:30', end: '16:30', durationMinutes: 480 });
assert.strictEqual(intervalDurationMinutes('22:00', '06:00'), 480);

const orphan = { kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
    apo_ora_01: '14:51', eos_ora_01: '22:51', cards_apo_ora_01: '14:51',
    cards_eos_ora_01: '', cards_ores_ergasias: 0 };
assert.deepStrictEqual(resolveSafeStartOnlyOrphan(orphan, { flexibleArrivalMinutes: 120 }), {
    pairNumber: '01', start: '14:51', end: '22:51', durationMinutes: 480,
    requiresBook: false, diagnostic: 'SAFE_START_ONLY_ORPHAN_DERIVED'
});
assert.strictEqual(resolveSafeStartOnlyOrphan({ ...orphan, cards_apo_ora_01: '',
    cards_eos_ora_01: '22:51' }), null);
assert.strictEqual(resolveSafeStartOnlyOrphan({ ...orphan, cards_apo_ora_01: 'bad' }), null);
assert.strictEqual(resolveSafeStartOnlyOrphan({ ...orphan, cards_apo_ora_02: '18:00' }), null);

assert.strictEqual(decide('12:59', 59), false);
assert.strictEqual(decide('12:59', 58), true);

console.log('apasxoliseisAttendanceDerivedScheduleService tests passed');
