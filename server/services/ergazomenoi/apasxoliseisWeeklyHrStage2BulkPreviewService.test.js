'use strict';

const assert = require('assert');
const { buildWeeklyHrStage2BulkPreview, publicWeeklyHrStage2BulkPreview,
    EXCEPTION_PAGE_SIZE } = require(
    './apasxoliseisWeeklyHrStage2BulkPreviewService'
);

const FP = 'a'.repeat(64);
function context(index, kind = 'safe') {
    const week = index % 5;
    const start = new Date(Date.UTC(2026, 4, 4 + week * 7));
    const end = new Date(start.getTime() + 6 * 86400000);
    const date = start.toISOString().slice(0, 10);
    const row = { _id: `row-${index}`, hmeromhnia: start, updatedAt: start,
        repo: false, kathgoria_ergasias: 'ΕΡΓ', cards_apo_ora_01: '',
        cards_eos_ora_01: '', cards_ores_ergasias: 0,
        apologistiko_biblio: false, repo_apologistika: false,
        kathgoria_ergasias_apologistika: '', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE',
        adeia_apologistika: false, astheneia_apologistika: false,
        apousia_apologistika: null, ores_ergasias_apologistika: 0 };
    const value = { scope: { employee_id: `employee-${Math.floor(index / 5)}`,
        employee_kodikos: String(Math.floor(index / 5)).padStart(4, '0'),
        week_start: start, week_end: end }, rows: [row],
    effectiveProfilesByDate: { [date]: { typos_apasxolhshs: '0' } },
    workflowState: { stage1: { status: 'COMPLETED' } },
    upstream: { stage1_current_fingerprint: FP }, lifecycle: { stages: {
        stage2: {}, stage3: { pending_dates: [], stage2_automatic_resolution_items:
            [{ date, classification: 'REST_REPO' }] } } } };
    if (kind === 'manual') value.stage2StateDiagnostic = 'INCOMPLETE_NATURAL_WEEK';
    if (kind === 'resolved') value.workflowState.stage2 = { status: 'COMPLETED' };
    if (kind === 'pair') {
        value.lifecycle.stages.stage2 = { pending_count: 1, pending_items: [{}],
            pending_reasons: ['REPO_TRANSFER_DECISION_REQUIRED'], blockers: [],
            has_transferable_pair: true, has_bounded_selection: true };
        value.period_writable = true;
        value.preparedStage2Record = { current_proposal_fingerprint: 'b'.repeat(64),
            runtime_enabled: true, index_ready: true, apply_state: 'NOT_APPROVED',
            current_proposal: { command: { proposal_id: `proposal-${index}`,
                expected_source_id: `source-${index}`, expected_target_id: `target-${index}`,
                expected_proposal_version: 'v2', expected_choice_code: 'ONLY_PAIR' } } };
    }
    return value;
}
{
    const pairs = Array.from({ length: 500 }, (_, i) => context(i, 'pair'));
    const preview = buildWeeklyHrStage2BulkPreview({ contexts: pairs });
    assert.equal(preview.safe_pair_count, 500);
    assert.equal(preview.safe_automatic_count, 0);
    assert.equal(preview.safe_bulk_count, 500);
}
{
    const mixed = [...Array.from({ length: 450 }, (_, i) => context(i, 'pair')),
        ...Array.from({ length: 50 }, (_, i) => context(500 + i))];
    const preview = buildWeeklyHrStage2BulkPreview({ contexts: mixed });
    assert.equal(preview.safe_pair_count, 450);
    assert.equal(preview.safe_automatic_count, 50);
    assert.equal(preview.safe_bulk_count, 500);
    const ambiguous = context(999, 'pair');
    ambiguous.lifecycle.stages.stage2.has_bounded_selection = false;
    assert.equal(buildWeeklyHrStage2BulkPreview({ contexts: [ambiguous] })
        .manual_exception_count, 1);
}

{
    const preview = buildWeeklyHrStage2BulkPreview({ contexts:
        [...Array.from({ length: 500 }, (_, i) => context(i)),
            ...Array.from({ length: 10 }, (_, i) => context(500 + i, 'manual'))] });
    assert.equal(preview.total_scopes, 510);
    assert.equal(preview.safe_bulk_count, 500);
    assert.equal(preview.manual_exception_count, 10);
    assert.equal(preview.exceptions.length, 10);
    assert.equal(preview.exception_page_size, EXCEPTION_PAGE_SIZE);
    assert.match(preview.preview_fingerprint, /^[a-f0-9]{64}$/);
}
{
    const contexts = Array.from({ length: 10000 }, (_, i) =>
        context(i, i < 9500 ? 'safe' : 'manual'));
    const preview = buildWeeklyHrStage2BulkPreview({ contexts });
    assert.equal(preview.total_scopes, 10000);
    assert.equal(preview.safe_bulk_count, 9500);
    assert.equal(preview.manual_exception_count, 500);
    assert.equal(preview.exceptions.length, 50);
    assert.equal(preview.safe_scope_ids.length, 9500);
    const publicPreview = publicWeeklyHrStage2BulkPreview(preview);
    assert.equal(Object.hasOwn(publicPreview, 'safe_scope_ids'), false);
}
console.log('weekly HR Stage-2 bulk preview tests passed');
