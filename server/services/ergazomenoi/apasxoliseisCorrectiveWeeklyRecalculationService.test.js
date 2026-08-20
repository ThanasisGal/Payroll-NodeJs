'use strict';

const assert = require('assert');
const { patchHistoricalCardFacts, recalculateFrozenCorrectiveWeeks } =
    require('./apasxoliseisCorrectiveWeeklyRecalculationService');
const { normalizeCorrectionCommands, reconstructCorrectedHistoricalResult } =
    require('./apasxoliseisPeriodCorrectiveService');
const { canonicalize } = require('./apasxoliseisPeriodFrozenSnapshotService');

function makeRow(index, employee = '1') {
    const date = new Date('2026-06-01T00:00:00.000Z'); date.setUTCDate(date.getUTCDate() + index);
    return { _id: `${employee.padStart(2, '0')}${String(index).padStart(22, '0')}`, kodikos: employee,
        hmeromhnia: date.toISOString(), cards_apo_ora_01: '', cards_eos_ora_01: '',
        cards_apo_ora_02: '', cards_eos_ora_02: '', cards_apo_ora_03: '', cards_eos_ora_03: '',
        sixth_day_hours: index === 5 ? 0 : undefined, frozen_marker: `${employee}-${index}` };
}
function snapshot(version = 'employment-period-frozen:v2') {
    const rows = [...Array.from({ length: 7 }, (_, index) => makeRow(index)),
        ...Array.from({ length: 7 }, (_, index) => makeRow(index, '2'))];
    return { snapshot_schema_version: version, source_calculation_version: 'employment-calculation:v2',
        scope: { team: 'T', company_kod: 'C', ypokatasthma: 'B', period_start: '2026-06-01', period_end: '2026-06-30' },
        daily_results: rows, deviations: [{ kodikos: '2', week_apo: '2026-06-01', status: 'FROZEN' }],
        weekly_calculation_context: { rows } };
}
const command = { type: 'REPLACE_HISTORICAL_CARD_INTERVALS', employee_kodikos: '1', date: '2026-06-06',
    intervals: [{ start: '09:00', end: '18:00' }] };
let received;
const authoritativeRunner = (input) => { received = canonicalize(input.frozenRows);
    return { correctedRows: input.frozenRows.map((row, index) => ({ ...row,
        authoritative_daily: true, sixth_day_hours: index === 5 ? 8 : 0,
        ores_paranomhs_yperorias_apologistika: index === 5 ? 1 : 0 })),
    deviations: [{ kodikos: input.employeeKodikos, week_apo: input.weekStart, status: 'AUTHORITATIVE' }],
    diagnostics: ['SHARED_PLAN'], canonical: { source: 'FROZEN_E2' } }; };

const raw = makeRow(5); raw.calculated_bucket = 99;
const patched = patchHistoricalCardFacts(raw, command);
assert.strictEqual(patched.cards_apo_ora_01, '09:00'); assert.strictEqual(patched.cards_eos_ora_01, '18:00');
assert.strictEqual(patched.calculated_bucket, 99); assert.strictEqual(raw.cards_apo_ora_01, '');

const baseline = snapshot();
const untouchedBefore = canonicalize(baseline.daily_results.filter((row) => row.kodikos === '2'));
const result = recalculateFrozenCorrectiveWeeks({ baselineSnapshot: baseline, commands: [command],
    runAuthoritativeWeek: authoritativeRunner });
assert.strictEqual(received.length, 7);
assert.strictEqual(received[5].cards_apo_ora_01, '09:00');
assert.strictEqual(received[5].cards_eos_ora_01, '18:00');
assert.strictEqual(result.correctedRows.find((row) => row.kodikos === '1' && row.hmeromhnia.startsWith('2026-06-06')).sixth_day_hours, 8);
assert.deepStrictEqual(canonicalize(result.correctedRows.filter((row) => row.kodikos === '2')), untouchedBefore);
assert.deepStrictEqual(result.correctedDeviations.map((row) => row.status).sort(), ['AUTHORITATIVE', 'FROZEN']);
assert.strictEqual(Object.hasOwn(result, 'bulkOps'), false);
assert.throws(() => recalculateFrozenCorrectiveWeeks({ baselineSnapshot: snapshot('employment-period-frozen:v1'),
    commands: [command], runAuthoritativeWeek: authoritativeRunner }),
    (error) => error.code === 'CORRECTIVE_FROZEN_WEEKLY_CONTEXT_UNSUPPORTED');
const locked = snapshot(); locked.weekly_calculation_context.rows[5].is_locked = true;
assert.throws(() => recalculateFrozenCorrectiveWeeks({ baselineSnapshot: locked, commands: [command],
    runAuthoritativeWeek: authoritativeRunner }), (error) => error.code === 'CORRECTIVE_ROW_MANUALLY_LOCKED');

const frozenWeekCommand = normalizeCorrectionCommands({ corrections: [{ type: 'RECOMPUTE_FROZEN_WEEK',
    employee_kodikos: '1', week_start: '2026-06-01' }] });
let frozenOnlyInput;
const deterministic = reconstructCorrectedHistoricalResult({ baselineSnapshot: snapshot(),
    commands: frozenWeekCommand, runAuthoritativeWeek: (input) => {
        frozenOnlyInput = canonicalize(input.frozenRows);
        return { correctedRows: input.frozenRows.map((row, index) => ({ ...row,
            sixth_day_hours: index === 5 ? 8 : 0, seventh_day_hours: 0 })),
        deviations: [], diagnostics: ['READY_FROM_FROZEN_BASELINE'], canonical: [{ status: 'READY' }] };
    } });
assert.deepStrictEqual(frozenOnlyInput, canonicalize(snapshot().weekly_calculation_context.rows.slice(0, 7)));
assert.strictEqual(deterministic.correctedRows.find((row) => row.kodikos === '1' &&
    row.hmeromhnia.startsWith('2026-06-06')).sixth_day_hours, 8);
assert.strictEqual(deterministic.correctedContext.correction_type, 'RECOMPUTE_FROZEN_WEEK');
assert.strictEqual(Object.hasOwn(deterministic, 'bulkOps'), false);

assert.throws(() => reconstructCorrectedHistoricalResult({ baselineSnapshot: snapshot(),
    commands: frozenWeekCommand, runAuthoritativeWeek: ({ frozenRows }) => ({
        correctedRows: frozenRows.map((row) => ({ ...row, sixth_day_hours: 0, seventh_day_hours: 0 })),
        deviations: [{ kodikos: '1', week_apo: '2026-06-01', status: 'NEEDS_HR_DECISION' }],
        canonical: [{ status: 'NEEDS_HR_DECISION' }] }) }),
    (error) => error.code === 'CORRECTIVE_WEEK_NEEDS_HR_DECISION');

assert.throws(() => normalizeCorrectionCommands({ corrections: [{ type: 'RECOMPUTE_FROZEN_WEEK',
    employee_kodikos: '1', week_start: '2026-06-01', sixth_day_hours: 8 }] }),
    (error) => error.code === 'CORRECTIVE_AUTHORITATIVE_FIELD_FORBIDDEN');
console.log('corrective shared-authoritative weekly orchestration: PASS');
