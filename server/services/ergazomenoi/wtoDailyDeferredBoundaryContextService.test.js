'use strict';
const assert = require('assert');
const { assessAnalysis, REQUIREMENT_STATUS } = require('./deferredCrossPeriodRepoAuthoritativeService');
const { resolveWtoDailyDeferredBoundaryReadiness } = require('./wtoDailyDeferredBoundaryReadinessService');
const { analyzeDeferredCrossPeriodRepoTransfer } = require('./apasxoliseisWeeklyRepoTransferSinglePairService');
const noDiscrepancy = assessAnalysis({ eligibility_status: 'NOT_APPLICABLE', reasons: ['NO_SOURCE_CANDIDATE'],
    source: null, target: null, semantic_proposal: null });
assert.equal(noDiscrepancy.requirement_status, REQUIREMENT_STATUS.NOT_REQUIRED);
const multiple = assessAnalysis({ eligibility_status: 'NEEDS_REVIEW', reasons: ['MULTIPLE_TARGET_CANDIDATES'],
    semantic_proposal: { selectable_source_candidates: [{ prodhlomena_oraria_id: 's', hmeromhnia: '2026-04-30' }],
        selectable_target_candidates: [{ prodhlomena_oraria_id: 't1', hmeromhnia: '2026-05-01' },
            { prodhlomena_oraria_id: 't2', hmeromhnia: '2026-05-02' }] } });
assert.equal(multiple.requirement_status, REQUIREMENT_STATUS.REQUIRED);
assert.equal(multiple.target_candidates.length, 2);
const candidateRows = Array.from({ length: 7 }, (_, i) => { const date = new Date('2026-04-27T00:00:00Z'); date.setUTCDate(date.getUTCDate() + i);
    return { _id: `r${i}`, team: 'T', company_kod: 'C', kodikos: '1', hmeromhnia: date.toISOString().slice(0, 10),
        kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8, apo_ora_01: '09:00', eos_ora_01: '17:00',
        cards_ores_ergasias: 8, cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00' }; });
Object.assign(candidateRows[3], { kathgoria_ergasias: 'ΑΝ' });
for (const index of [4, 5]) Object.assign(candidateRows[index], { cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '' });
Object.assign(candidateRows[6], { kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0, cards_ores_ergasias: 0,
    cards_apo_ora_01: '', cards_eos_ora_01: '' });
const ambiguous = analyzeDeferredCrossPeriodRepoTransfer({ weekRows: candidateRows,
    employmentProfile: { typos_apasxolhshs: 'PLHRHS', hmeres_ergasias_ebdomadas: 5 } });
assert.equal(ambiguous.reasons.includes('MULTIPLE_TARGET_CANDIDATES'), true);
assert.equal(ambiguous.semantic_proposal.selectable_target_candidates.length, 2);
const selected = analyzeDeferredCrossPeriodRepoTransfer({ weekRows: candidateRows,
    employmentProfile: { typos_apasxolhshs: 'PLHRHS', hmeres_ergasias_ebdomadas: 5 },
    selectedSourceRowId: 'r3', selectedTargetRowId: 'r4' });
assert.equal(selected.eligibility_status, 'ELIGIBLE'); assert.equal(selected.target.prodhlomena_oraria_id, 'r4');
const baseWeek = { deferred_week_id: 'week', current_period_dates: ['2026-04-30'], next_period_context_dates: ['2026-05-01'] };
assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [{ ...baseWeek, requirement_status: 'NOT_REQUIRED' }],
    decisions: [], periodStart: '2026-04-01', periodEnd: '2026-04-30' }).status, 'READY');
assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [{ ...baseWeek, requirement_status: 'REQUIRED' }],
    decisions: [], periodStart: '2026-04-01', periodEnd: '2026-04-30' }).status,
    'WTODAILY_DEFERRED_BOUNDARY_RESOLUTION_REQUIRED');
for (const requirement_status of ['NO_VALID_REST_DAY', 'ERGANI_CORRECTION_REQUIRED']) {
    assert.equal(resolveWtoDailyDeferredBoundaryReadiness({ deferredWeeks: [{ ...baseWeek, requirement_status }],
        decisions: [], periodStart: '2026-04-01', periodEnd: '2026-04-30' }).status, 'READY');
}
console.log('WTODaily deferred boundary requirement-state tests passed');
