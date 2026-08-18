'use strict';

const assert = require('assert');
const {
    RESOLUTION_SCOPE,
    resolveOrphanCardResolution
} = require('./apasxoliseisOrphanCardResolutionService');

function row(date, overrides = {}) {
    return {
        _id: `row-${date}`,
        hmeromhnia: `${date}T00:00:00.000Z`,
        kathgoria_ergasias: 'ΕΡΓ',
        apo_ora_01: '14:51', eos_ora_01: '22:51',
        apo_ora_02: '', eos_ora_02: '', apo_ora_03: '', eos_ora_03: '',
        ores_ergasias: 8,
        dialleima_se_lepta: 30,
        dialleima_entos_ektos_orarioy: true,
        cards_apo_ora_01: '14:51', cards_eos_ora_01: '',
        cards_apo_ora_02: '', cards_eos_ora_02: '',
        cards_apo_ora_03: '', cards_eos_ora_03: '',
        ...overrides
    };
}

const startOnly = row('2026-06-14');
const startResult = resolveOrphanCardResolution({ row: startOnly, contextRows: [startOnly] });
assert.strictEqual(startResult.category, 'ΕΡΓ');
assert.strictEqual(startResult.orphanType, 'START_ONLY');
assert.strictEqual(startResult.proposal.start, '14:51');
assert.strictEqual(startResult.proposal.end, '22:51');
assert.strictEqual(startResult.proposal.workDurationMinutes, 480);
assert.strictEqual(startResult.proposal.durationSource, 'DECLARED_CONTINUOUS_DURATION');
assert.strictEqual(startResult.apologistikoBookUpdate, false);
assert.strictEqual(startResult.canApprove, true);
assert.strictEqual(startResult.approvedUpdates.apologistiko_biblio, false);
assert.strictEqual(startOnly.cards_eos_ora_01, '');

const endOnly = row('2026-06-14', {
    cards_apo_ora_01: '', cards_eos_ora_01: '22:51'
});
const endResult = resolveOrphanCardResolution({ row: endOnly, contextRows: [endOnly] });
assert.strictEqual(endResult.orphanType, 'END_ONLY');
assert.strictEqual(endResult.proposal.start, '14:51');
assert.strictEqual(endResult.proposal.end, '22:51');
assert.strictEqual(endResult.apologistikoBookUpdate, true);
assert.strictEqual(endResult.approvedUpdates.apologistiko_biblio, true);
assert.strictEqual(endOnly.cards_apo_ora_01, '');
const externalStart = row('2026-06-14', { dialleima_entos_ektos_orarioy: false });
const externalStartResult = resolveOrphanCardResolution({
    row: externalStart, contextRows: [externalStart]
});
assert.strictEqual(externalStartResult.proposal.end, '23:21');
assert.strictEqual(externalStartResult.proposal.durationMinutes, 510);
assert.strictEqual(externalStartResult.proposal.workDurationMinutes, 480);
assert.strictEqual(externalStartResult.approvedUpdates.ores_ergasias_apologistika, 8);
const actualPrevious = row('2026-06-13', { _id: 'actual-previous',
    cards_apo_ora_01: '15:44', cards_eos_ora_01: '22:35' });
const actualNext = row('2026-06-15', { _id: 'actual-next',
    cards_apo_ora_01: '14:07', cards_eos_ora_01: '23:13' });
const actualExternalRest = resolveOrphanCardResolution({ row: externalStart,
    contextRows: [actualPrevious, externalStart, actualNext] });
assert.strictEqual(actualExternalRest.rest.backwardMinutes, 976);
assert.strictEqual(actualExternalRest.rest.forwardMinutes, 886);
assert.strictEqual(actualExternalRest.rest.hasViolation, false);
const externalEnd = row('2026-06-14', { cards_apo_ora_01: '', cards_eos_ora_01: '22:51',
    dialleima_entos_ektos_orarioy: false });
const externalEndResult = resolveOrphanCardResolution({ row: externalEnd,
    contextRows: [externalEnd] });
assert.strictEqual(externalEndResult.proposal.start, '14:21');
assert.strictEqual(externalEndResult.proposal.end, '22:51');
assert.strictEqual(externalEndResult.approvedUpdates.ores_ergasias_apologistika, 8);
const reusableEndRule = resolveOrphanCardResolution({ row: endOnly, contextRows: [endOnly],
    reuseScope: RESOLUTION_SCOPE.FUTURE_IDENTICAL }).reusableDecisionRule;
const safeEndReuse = resolveOrphanCardResolution({ row: endOnly, contextRows: [endOnly],
    reusableRule: reusableEndRule });
assert.strictEqual(safeEndReuse.canAutomaticReuse, true);

const previousSafe = row('2026-06-13', {
    cards_apo_ora_01: '02:00', cards_eos_ora_01: '03:00'
});
const nextSafe = row('2026-06-15', {
    cards_apo_ora_01: '10:00', cards_eos_ora_01: '11:00'
});
const safe = resolveOrphanCardResolution({ row: startOnly,
    contextRows: [previousSafe, startOnly, nextSafe],
    reuseScope: RESOLUTION_SCOPE.FUTURE_IDENTICAL });
assert.strictEqual(safe.rest.hasViolation, false);
assert.strictEqual(safe.reusableEligible, true);
const reusableRule = safe.reusableDecisionRule;
const safeReuse = resolveOrphanCardResolution({ row: startOnly,
    contextRows: [previousSafe, startOnly, nextSafe], reusableRule });
assert.strictEqual(safeReuse.canAutomaticReuse, true);
const differentBreakReuse = resolveOrphanCardResolution({
    row: row('2026-06-16', { cards_apo_ora_01: '14:51', cards_eos_ora_01: '',
        dialleima_entos_ektos_orarioy: false, dialleima_se_lepta: 45 }),
    contextRows: [], reusableRule
});
assert.strictEqual(differentBreakReuse.proposal.end, '23:36');
assert.strictEqual(differentBreakReuse.canAutomaticReuse, true);

const previousRisk = row('2026-06-14', { _id: 'previous',
    cards_apo_ora_01: '10:00', cards_eos_ora_01: '10:00' });
// A complete interval on the prior calendar day ending at 08:00 leaves 6h51.
previousRisk.hmeromhnia = '2026-06-14T00:00:00.000Z';
previousRisk.cards_apo_ora_01 = '07:00'; previousRisk.cards_eos_ora_01 = '08:00';
const sameDayTarget = row('2026-06-14', { _id: 'target' });
const backwardRisk = resolveOrphanCardResolution({ row: sameDayTarget,
    contextRows: [previousRisk, sameDayTarget], reusableRule });
assert.deepStrictEqual(backwardRisk.rest.conflicts, ['PREVIOUS']);
assert.strictEqual(backwardRisk.canApprove, false);
assert.strictEqual(backwardRisk.canAutomaticReuse, false);
const unsafeEndReuse = resolveOrphanCardResolution({ row: endOnly,
    contextRows: [previousRisk, endOnly], reusableRule: reusableEndRule });
assert.strictEqual(unsafeEndReuse.canAutomaticReuse, false);
const acknowledged = resolveOrphanCardResolution({ row: sameDayTarget,
    contextRows: [previousRisk, sameDayTarget], riskAcknowledged: true });
assert.strictEqual(acknowledged.canApprove, true);

const nextRisk = row('2026-06-15', { _id: 'next-risk',
    cards_apo_ora_01: '05:00', cards_eos_ora_01: '06:00' });
const forwardRisk = resolveOrphanCardResolution({ row: startOnly,
    contextRows: [startOnly, nextRisk] });
assert.deepStrictEqual(forwardRisk.rest.conflicts, ['NEXT']);

const bothRisk = resolveOrphanCardResolution({ row: sameDayTarget,
    contextRows: [previousRisk, sameDayTarget, nextRisk] });
assert.deepStrictEqual(bothRisk.rest.conflicts, ['PREVIOUS', 'NEXT']);

const manualRisk = resolveOrphanCardResolution({ row: startOnly,
    contextRows: [startOnly, nextRisk], manualInterval: { start: '16:00', end: '23:30' } });
assert.strictEqual(manualRisk.requiresRiskAcknowledgement, true);
const automaticRiskTarget = row('2026-06-14', { _id: 'automatic-risk-target',
    cards_apo_ora_01: '18:00', cards_eos_ora_01: '' });
const automaticRisk = resolveOrphanCardResolution({ row: automaticRiskTarget,
    contextRows: [automaticRiskTarget, nextRisk] });
assert.strictEqual(automaticRisk.rest.hasViolation, true);
const manuallySafe = resolveOrphanCardResolution({ row: automaticRiskTarget,
    contextRows: [automaticRiskTarget, nextRisk],
    manualInterval: { start: '08:00', end: '16:00' } });
assert.strictEqual(manuallySafe.rest.hasViolation, false);
assert.strictEqual(manuallySafe.requiresRiskAcknowledgement, false);

const monthBoundaryTarget = row('2026-06-30', { _id: 'month-target',
    apo_ora_01: '22:00', eos_ora_01: '06:00', ores_ergasias: 8,
    cards_apo_ora_01: '22:00', cards_eos_ora_01: '' });
const julyNext = row('2026-07-01', { _id: 'july-next',
    cards_apo_ora_01: '12:00', cards_eos_ora_01: '16:00' });
const crossMonth = resolveOrphanCardResolution({ row: monthBoundaryTarget,
    contextRows: [monthBoundaryTarget, julyNext] });
assert.strictEqual(crossMonth.proposal.end, '06:00');
assert.strictEqual(crossMonth.rest.forwardMinutes, 360);
assert.deepStrictEqual(crossMonth.rest.conflicts, ['NEXT']);

const split = row('2026-06-14', {
    apo_ora_01: '08:00', eos_ora_01: '12:00',
    apo_ora_02: '16:00', eos_ora_02: '20:00'
});
const splitResult = resolveOrphanCardResolution({ row: split, contextRows: [split],
    reuseScope: RESOLUTION_SCOPE.FUTURE_IDENTICAL });
assert.strictEqual(splitResult.eligible, false);
assert.strictEqual(splitResult.category, 'ΕΡΓ');
assert.strictEqual(splitResult.blocking, true);
assert.strictEqual(splitResult.canAutomaticReuse, undefined);
assert.strictEqual(splitResult.orphanType, 'START_ONLY');
const splitManual = resolveOrphanCardResolution({ row: split, contextRows: [split],
    manualInterval: { start: '08:15', end: '17:45' },
    reuseScope: RESOLUTION_SCOPE.FUTURE_IDENTICAL,
    breakConfiguration: { break_inside_schedule: false, break_minutes: 30 } });
assert.strictEqual(splitManual.eligible, true);
assert.strictEqual(splitManual.proposal.scheduleKind, 'SPLIT');
assert.strictEqual(splitManual.proposal.durationSource, 'HR_MANUAL_SPLIT_INTERVAL');
assert.strictEqual(splitManual.proposal.start, '08:15');
assert.strictEqual(splitManual.proposal.end, '17:45');
assert.strictEqual(splitManual.proposal.workDurationHours, 9);
assert.strictEqual(splitManual.proposal.manualIntervalMatchesRule, false);
assert.strictEqual(splitManual.reuseScope, 'ONE_TIME');
assert.strictEqual(splitManual.reusableEligible, false);
assert.strictEqual(splitManual.reusableDecisionRule, null);

const averageEnd = row('2026-06-15', { kathgoria_ergasias: 'ΑΝ', repo: true,
    apo_ora_01: '', eos_ora_01: '', cards_apo_ora_01: '', cards_eos_ora_01: '23:47' });
const averageNoBreak = resolveOrphanCardResolution({ row: averageEnd,
    contextRows: [averageEnd], effectiveEmployee: { mo_oron_hmerhsias_ergasias: 8 },
    breakConfiguration: { break_inside_schedule: true, break_minutes: 30 } });
assert.strictEqual(averageNoBreak.proposal.start, '15:47');
assert.strictEqual(averageNoBreak.proposal.end, '23:47');
assert.strictEqual(averageNoBreak.proposal.workDurationHours, 8);
assert.strictEqual(averageNoBreak.proposal.durationHours, 8);
assert.strictEqual(averageNoBreak.proposal.durationSource, 'EFFECTIVE_DAILY_AVERAGE');
const averageExternal = resolveOrphanCardResolution({ row: averageEnd,
    contextRows: [averageEnd], effectiveEmployee: { mo_oron_hmerhsias_ergasias: 8,
        _workTermsSource: 'ISTORIKO' },
    breakConfiguration: { break_inside_schedule: false, break_minutes: 30,
        source: 'BREAK_CONFIGURATION_HISTORY' },
    reuseScope: RESOLUTION_SCOPE.FUTURE_IDENTICAL });
assert.strictEqual(averageExternal.proposal.start, '15:17');
assert.strictEqual(averageExternal.proposal.durationHours, 8.5);
assert.strictEqual(averageExternal.reusableDecisionRule.rule,
    'ACTUAL_END_MINUS_EFFECTIVE_DAILY_AVERAGE');
assert.strictEqual(averageExternal.reusableDecisionRule.schedule_kind,
    'NON_DECLARED');
assert.strictEqual(JSON.stringify(averageExternal.reusableDecisionRule).includes('23:47'), false);
const averageSixHoursReuse = resolveOrphanCardResolution({ row: {
    ...averageEnd, hmeromhnia: '2026-06-16T00:00:00.000Z', cards_eos_ora_01: '22:00' },
    contextRows: [], effectiveEmployee: { mo_oron_hmerhsias_ergasias: 6 },
    breakConfiguration: { break_inside_schedule: false, break_minutes: 15 },
    reusableRule: averageExternal.reusableDecisionRule });
assert.strictEqual(averageSixHoursReuse.proposal.start, '15:45');
assert.strictEqual(averageSixHoursReuse.canAutomaticReuse, true);
const invalidAverage = resolveOrphanCardResolution({ row: averageEnd,
    contextRows: [averageEnd], effectiveEmployee: { mo_oron_hmerhsias_ergasias: 0 } });
assert.strictEqual(invalidAverage.eligible, false);
const manualFuture = resolveOrphanCardResolution({ row: averageEnd,
    contextRows: [averageEnd], effectiveEmployee: { mo_oron_hmerhsias_ergasias: 8 },
    manualInterval: { start: '16:00', end: '23:47' },
    reuseScope: RESOLUTION_SCOPE.FUTURE_IDENTICAL });
assert.strictEqual(manualFuture.reuseScope, 'ONE_TIME');
assert.strictEqual(manualFuture.reusableDecisionRule, null);

console.log('orphan card resolution pure tests passed (START/END/rest/reuse/split)');
