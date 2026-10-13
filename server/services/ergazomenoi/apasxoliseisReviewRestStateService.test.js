'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { resolveReviewRestState: resolve } = require('./apasxoliseisReviewRestStateService');
const { resolveEffectiveRepoState } = require('./apasxoliseisEffectiveRepoStateService');
const { evaluateRow, buildRepairPreview } = require('./apasxoliseisLegacyNoWorkSemanticRepairService');
const { buildWeeklyHrLifecycleProjection: lifecycle } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildWeeklyHrStage2BulkPreview: preview } = require('./apasxoliseisWeeklyHrStage2BulkPreviewService');
const rest = { _id: 'row', hmeromhnia: '2026-09-02', kathgoria_ergasias: 'ΑΝ', repo: true,
    kathgoria_ergasias_apologistika: 'ΑΝ', repo_apologistika: false,
    apologistiko_biblio: false, cards_ores_ergasias: 0, ores_ergasias_apologistika: 0 };
const profile = { typos_apasxolhshs: '0', typos_ebdomadas: '5ΗΜΕΡΗ', hmeres_ergasias_ebdomadas: 5 };
test('declared AN is valid without retrospective participation; preview never proposes a write', () => {
    for (const category of ['', 'ΑΝ']) for (const repo of [true, false]) {
        const row = { ...rest, kathgoria_ergasias_apologistika: category, repo_apologistika: repo };
        const before = structuredClone(row);
        assert.equal(resolve(row).status, 'VALID_DECLARED_REST');
        assert.equal(resolveEffectiveRepoState({ row, expectedRepoCategory: 'ΑΝ' }).effectiveRepo, true);
        const result = evaluateRow({ row, effectiveProfile: profile });
        assert.equal(result.status, 'VALID_DECLARED_REST');
        assert.equal(result.proposed, null);
        assert.deepEqual(row, before);
    }
});
test('absence of cards alone does not classify work days; contradictory evidence cancels recognition', () => {
    assert.equal(resolve({ ...rest, kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: '' }).status, 'NOT_APPLICABLE');
    for (const fields of [{ cards_ores_ergasias: 1 }, { cards_apo_ora_01: '09:00' },
        { cards_apo_ora_01: '09:00', cards_eos_ora_01: '10:00' },
        { ores_ergasias_apologistika: 1 }, { ores_pragmatikhs_ergasias_apologistika: 1 },
        { apo_ora_01_apologistika: '09:00', eos_ora_01_apologistika: '10:00' },
        { kathgoria_ergasias_apologistika: 'ΕΡΓ' }]) {
        assert.notEqual(resolve({ ...rest, ...fields }).status, 'VALID_DECLARED_REST');
    }
});
test('real incomplete rest blocks stages 2 and 4; valid declared rest does not', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ ...rest, _id: `row-${i}`,
        kodikos: '0001', hmeromhnia: `2026-09-${String(7 + i).padStart(2, '0')}` }));
    const valid = lifecycle({ weekRows: rows, effectiveProfile: profile });
    assert.equal(valid.rest_review_items.filter(i => i.status === 'VALID_DECLARED_REST').length, 7);
    assert.equal(valid.stages.stage2.blockers.includes('REST_CLASSIFICATION_REVIEW_REQUIRED'), false);
    rows[2] = { ...rows[2], kathgoria_ergasias: 'ΕΡΓ', repo: false };
    const pending = lifecycle({ weekRows: rows, effectiveProfile: profile,
        persistedStage2State: { status: 'COMPLETED' } });
    assert.equal(pending.stages.stage2.business_status, 'BLOCKED');
    assert.ok(pending.stages.stage4.blockers.includes('REST_CLASSIFICATION_REVIEW_REQUIRED'));
});
test('old completed state cannot bypass fresh bulk inspection', () => {
    const context = { scope: { employee_id: 'one', week_start: '2026-09-07', week_end: '2026-09-13' },
        rows: [rest], workflowState: { stage2: { status: 'COMPLETED' } },
        lifecycle: { stages: { stage2: { blockers: ['REST_CLASSIFICATION_REVIEW_REQUIRED'] } } } };
    const result = preview({ contexts: [context] });
    assert.equal(result.already_resolved_count, 0);
    assert.equal(result.technical_conflict_count, 1);
});
test('read-only reconciliation preview for 100, 500 and 2000 employees is repeatable and bounded', async t => {
    for (const count of [100, 500, 2000]) {
        const rows = Array.from({ length: count * 8 }, (_, i) => ({ ...rest,
            _id: `synthetic-${i}`, kodikos: String(Math.floor(i / 8)).padStart(4, '0') }));
        const query = { select() { return this; }, sort() { return this; }, lean: async () => rows };
        const args = { scope: { team: 'TEST', company_kod: 'synthetic', ypokatasthma: '0000',
            period_start: '2026-09-01', period_end: '2026-09-30' }, rowModel: { find: () => query },
            profileLoader: async () => new Map(rows.map(row => [row._id, profile])),
            protectionLoader: async () => ({}), auditModel: { find: () => ({ select() { return this; }, lean: async () => [] }) } };
        const start = performance.now();
        const first = await buildRepairPreview(args);
        const elapsed = performance.now() - start;
        assert.equal(first.valid_declared_rest_count, rows.length);
        assert.equal(first.repairable_count, 0);
        assert.equal(first.excluded_count, 0);
        assert.equal((await buildRepairPreview(args)).preview_fingerprint, first.preview_fingerprint);
        t.diagnostic(`${count} employees / ${rows.length} rest days: ${elapsed.toFixed(1)} ms`);
        assert.ok(elapsed < 10000);
    }
});

test('presentation-neutralized declared ME preserves its actual stored canonical state', () => {
    assert.equal(resolve({ kathgoria_ergasias: 'ΜΕ', repo_apologistika: false,
        kathgoria_ergasias_apologistika: '', apologistiko_biblio: true,
        kathgoria_ergasias_apologistika_original: 'ΜΕ', repo_apologistika_original: false
    }).status, 'CANONICAL');
});
