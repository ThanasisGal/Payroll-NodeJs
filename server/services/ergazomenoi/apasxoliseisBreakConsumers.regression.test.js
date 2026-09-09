'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveOrphanCardResolution } = require('./apasxoliseisOrphanCardResolutionService');
const { resolvePayrollBreakIntervals } = require('../../utils/ergazomenoi/resolvePayrollBreakIntervals');
const { getPayrollCalculationIntervals, buildWeeklyIllegalOvertimeUpdate } =
    require('./apasxoliseisWeeklyIllegalOvertimeCalculationService');
const { buildWeeklyRepoDeviationPreview } = require('./apasxoliseisWeeklyRepoDeviationPreviewService');
const profile = { dialleima_se_lepta: 30, dialleima_entos_ektos_orarioy: false,
    hmeres_ergasias_ebdomadas: 6, typos_apasxolhshs: '0' };

for (const [hours, end, expectedBreaks] of [[3, '11:00', []], [4, '12:00', []],
    [5, '13:30', [['12:00', '12:30']]]]) {
    test(`ορφανή πρόταση ${hours} ωρών: ${end}`, () => {
        const row = { hmeromhnia: '2026-04-01', kathgoria_ergasias: 'ΕΡΓ',
            ores_ergasias: hours, apo_ora_01: '08:00', eos_ora_01: `${8 + hours}:00`,
            cards_apo_ora_01: '08:00', cards_eos_ora_01: '' };
        const before = structuredClone(row);
        const result = resolveOrphanCardResolution({ row, contextRows: [row], effectiveEmployee: profile });
        assert.equal(result.proposal.start, '08:00');
        assert.equal(result.proposal.end, end);
        assert.equal(result.proposal.workDurationMinutes, hours * 60);
        const [h, m] = end.split(':').map(Number);
        const resolved = resolvePayrollBreakIntervals({ row, effectiveEmployee: profile,
            workIntervals: [{ start: 480, end: h * 60 + m }] });
        assert.equal(resolved.netMinutes, hours * 60);
        assert.deepEqual(resolved.breakIntervals.map(x => [x.apo, x.eos]), expectedBreaks);
        assert.deepEqual(row, before);
    });
}

test('προεπισκόπηση: κοινά καθαρά γεγονότα 240 λεπτών και σε ελλιπή κάρτα', () => {
    for (const partial of [false, true]) {
        const rows = Array.from({ length: 7 }, (_, i) => ({
            _id: `row-${i}`, kodikos: '0031', ypokatasthma: '0000',
            hmeromhnia: `2026-04-${String(i + 6).padStart(2, '0')}`,
            kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 4, cards_ores_ergasias: 250 / 60,
            apo_ora_01: '12:30', eos_ora_01: '16:40',
            cards_apo_ora_01: '12:30', cards_eos_ora_01: '16:40',
            ...(partial ? { cards_apo_ora_02: '18:00', cards_eos_ora_02: '' } : {})
        }));
        const before = structuredClone(rows);
        let captured;
        buildWeeklyRepoDeviationPreview({ rows, periodStart: '2026-04-01', periodEnd: '2026-04-30',
            asOfDate: '2026-05-01',
            resolveWeeklyProfile: () => ({ expectedWeeklyRepo: 1, effectiveProfile: profile }),
            resolveDailyProfile: () => profile,
            resolveCanonicalAnalysis: input => { captured = input; return null; } });
        assert.ok(captured);
        assert.equal(captured.weekRows[0].ores_ergasias_apologistika, 4);
        assert.equal(captured.automaticAnalysis.dailyFacts[0].actualWorkHours, 4);
        assert.equal(getPayrollCalculationIntervals(rows[0], profile)
            .reduce((sum, x) => sum + x.end - x.start, 0), 240);
        assert.deepEqual(rows, before);
    }
});

test('ελλιπής ενδιάμεση κάρτα δεν μεταφέρει την επόμενη πλήρη κάρτα στην Κυριακή', () => {
    const row = { hmeromhnia: '2026-04-04', apo_ora_01: '08:00', eos_ora_01: '12:00',
        cards_apo_ora_01: '08:00', cards_eos_ora_01: '12:00',
        cards_apo_ora_02: '22:00', cards_eos_ora_02: '',
        cards_apo_ora_03: '04:00', cards_eos_ora_03: '06:00' };
    assert.deepEqual(getPayrollCalculationIntervals(row, profile).map(x => [x.start, x.end]),
        [[480, 720], [240, 360]]);
    const result = buildWeeklyIllegalOvertimeUpdate(row, profile, 1.23, new Set());
    assert.equal(result.ores_paranomhs_yperorias_nyxtas_apologistika, 1.23);
    assert.equal(result.ores_paranomhs_yperorias_argion_nyxtas_apologistika, 0);
});
