'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { resolveReviewRestState: resolve } = require('./apasxoliseisReviewRestStateService');
const { resolveEffectiveRepoState } = require('./apasxoliseisEffectiveRepoStateService');
const { evaluateRow, buildRepairPreview } = require('./apasxoliseisLegacyNoWorkSemanticRepairService');
const { buildWeeklyHrLifecycleProjection: lifecycle } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { buildWeeklyHrStage2BulkPreview: preview } = require('./apasxoliseisWeeklyHrStage2BulkPreviewService');
const { deriveStage1PeriodSlice, buildStage1PeriodSliceFingerprints } = require('./apasxoliseisStage1PeriodSliceService');
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
    assert.equal(result.manual_exception_count, 1);
    assert.equal(result.technical_conflict_count, 0);
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

test('unchanged predeclared ME needs no retrospective participation and never becomes rest', () => {
    for (const category of ['', 'ΜΕ']) {
        const row = { ...rest, kathgoria_ergasias: 'ΜΕ', repo: false,
            kathgoria_ergasias_apologistika: category, apologistiko_biblio: false };
        assert.equal(resolve(row).status, 'VALID_DECLARED_NON_WORK');
        assert.equal(resolve(row).classification, 'NON_WORK');
        assert.notEqual(resolve({ ...row, cards_ores_ergasias: 1 }).status, 'VALID_DECLARED_NON_WORK');
    }
});

test('book participation and a human participation choice do not create rest decisions', () => {
    for (const fields of [
        { apologistiko_biblio: true, cards_ores_ergasias: 8 },
        { repo_apologistika: true, is_locked: true }
    ]) {
        const row = { ...rest, kathgoria_ergasias: 'ΕΡΓ', repo: false,
            kathgoria_ergasias_apologistika: '', ...fields };
        assert.equal(resolve(row).status, 'NOT_APPLICABLE');
    }
});

test('an explicit retrospective rest with actual work remains a real conflict', () => {
    const row = { ...rest, kathgoria_ergasias: 'ΕΡΓ', repo: false,
        apologistiko_biblio: true, repo_apologistika: true, cards_ores_ergasias: 8 };
    assert.equal(resolve(row).status, 'REVIEW_REQUIRED');
    assert.equal(resolve(row).reason_code, 'REST_CLASSIFICATION_WORK_CONFLICT');
});

test('settled linked transfer preserves worked source and canonical rest target', () => {
    const source = { ...rest, kathgoria_ergasias_apologistika: 'ΕΡΓ', repo_apologistika: false,
        apologistiko_biblio: true, is_locked: true, cards_ores_ergasias: 8 };
    const target = { ...rest, kathgoria_ergasias: 'ΕΡΓ', repo: false,
        repo_apologistika: true, apologistiko_biblio: true, is_locked: true };
    assert.equal(resolve(source).status, 'NOT_APPLICABLE');
    assert.equal(resolve(target).status, 'CANONICAL');
    const rows = Array.from({ length: 7 }, (_, index) => ({ ...rest,
        _id: `settled-${index}`, kodikos: '0001',
        hmeromhnia: `2026-09-${String(7 + index).padStart(2, '0')}` }));
    rows[0] = { ...rows[0], ...source, hmeromhnia: rows[0].hmeromhnia };
    rows[1] = { ...rows[1], ...target, hmeromhnia: rows[1].hmeromhnia };
    const before = structuredClone(rows);
    const result = lifecycle({ weekRows: rows, effectiveProfile: profile });
    assert.equal(result.stages.stage2.pending_count, 0);
    assert.equal(result.stages.stage2.business_status, 'COMPLETED');
    assert.deepEqual(rows, before);
});

test('automatic Stage 2 days never include a possible leave in the previous period', () => {
    const rows = Array.from({ length: 7 }, (_, day) => ({ _id: `boundary-${day}`,
        hmeromhnia: new Date(Date.UTC(2026, 7, 31 + day)), kathgoria_ergasias: 'ΕΡΓ',
        repo: false, kathgoria_ergasias_apologistika: '', repo_apologistika: false,
        ores_ergasias: 8, cards_ores_ergasias: [0, 6].includes(day) ? 0 : 8,
        kathgoria_adeias_apologistika: [0, 6].includes(day) ? 'POSSIBLE_LEAVE' : '' }));
    const scope = { week_start: '2026-08-31', week_end: '2026-09-06' };
    const periodScope = { period_start: '2026-09-01', period_end: '2026-09-30' };
    const slice = deriveStage1PeriodSlice({ weekRows: rows, ...scope, ...periodScope });
    const fingerprints = buildStage1PeriodSliceFingerprints({ weekRows: rows, slice });
    const result = lifecycle({ weekRows: rows, effectiveProfile: profile, scope, periodScope,
        persistedStage1State: { status: 'OPEN', period_slices: [{ ...slice,
            ...fingerprints, status: 'COMPLETED' }] } });
    assert.deepEqual(result.stages.stage3.stage2_automatic_resolution_items.map(item => item.date), ['2026-09-06']);
    assert.deepEqual(result.stages.stage2.pending_dates, ['2026-09-06']);
});

test('mixed 81-week reproduction separates 94 false flags from five dated automatic days', () => {
    const fp = 'a'.repeat(64);
    const contexts = Array.from({ length: 81 }, (_, index) => {
        const rows = Array.from({ length: 7 }, (_, day) => ({ _id: `mixed-${index}-${day}`,
            kodikos: String(index).padStart(4, '0'), hmeromhnia: new Date(Date.UTC(2026, 7, 31 + day)),
            kathgoria_ergasias: 'ΕΡΓ', repo: false, kathgoria_ergasias_apologistika: 'ΕΡΓ',
            repo_apologistika: false, apologistiko_biblio: false,
            cards_ores_ergasias: 8, ores_ergasias: 8, ores_ergasias_apologistika: 8 }));
        if (index < 44) Object.assign(rows[2], { kathgoria_ergasias: 'ΑΝ', repo: true,
            kathgoria_ergasias_apologistika: 'ΑΝ', cards_ores_ergasias: 0,
            ores_ergasias: 0, ores_ergasias_apologistika: 0 });
        if (index < 43) for (const day of (index < 8 ? [0, 1, 3] : [0, 1])) {
            Object.assign(rows[day], { apologistiko_biblio: true, kathgoria_ergasias_apologistika: '' });
        }
        if (index === 0) Object.assign(rows[1], { apologistiko_biblio: false,
            repo_apologistika: true, is_locked: true, cards_ores_ergasias: 0, ores_ergasias_apologistika: 0 });
        const value = { scope: { employee_id: `employee-${index}`, employee_kodikos: rows[0].kodikos,
            week_start: '2026-08-31', week_end: '2026-09-06' }, rows,
        lifecycle: lifecycle({ weekRows: rows, effectiveProfile: { ...profile, pososto_prosayxhshs_6hs_hmeras: 40 } }) };
        if (index >= 43 && index < 46) {
            const items = (index === 45 ? [6] : [5, 6]).map(day => {
                Object.assign(rows[day], { kathgoria_ergasias_apologistika: '',
                    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE', cards_ores_ergasias: 0,
                    ores_ergasias_apologistika: 0, adeia_apologistika: false,
                    astheneia_apologistika: false, apousia_apologistika: false });
                return { date: rows[day].hmeromhnia.toISOString().slice(0, 10), classification: 'REST_REPO' };
            });
            const slice = { period_start: '2026-09-01', period_end: '2026-09-30',
                status: 'COMPLETED', context_fingerprint: fp, completion_fingerprint: fp,
                actionable_dates: rows.slice(1).map(row => row.hmeromhnia.toISOString().slice(0, 10)) };
            value.workflowState = { stage1: { status: 'OPEN', period_slices: [slice] } };
            value.upstream = { stage1_current_fingerprint: fp };
            value.effectiveProfile = profile;
            value.lifecycle = { stages: {
                stage1: { attestation_scope: 'PERIOD_SLICE', period_slice: slice, current_context_fingerprint: fp },
                stage2: { pending_count: items.length, pending_dates: items.map(item => item.date),
                    automatic_materialization_count: items.length },
                stage3: { pending_dates: [], stage2_automatic_resolution_items: items }
            } };
        }
        return value;
    });
    const oldFalseFlags = contexts.slice(0, 43).flatMap(c => c.rows).filter(row =>
        row.repo_apologistika === true || row.apologistiko_biblio === true && !row.kathgoria_ergasias_apologistika);
    assert.equal(oldFalseFlags.length, 94);
    const result = preview({ contexts });
    assert.equal(result.total_scopes, 81);
    assert.equal(result.valid_declared_rest_count, 44);
    assert.equal(result.safe_bulk_count, 3);
    assert.equal(result.safe_day_change_count, 5);
    assert.equal(result.pending_scope_count, 3);
    assert.equal(result.pending_day_count, 5);
    assert.equal(result.already_resolved_count, 78);
    assert.equal(result.manual_exception_count, 0);
    assert.equal(result.technical_conflict_count, 0);
});
