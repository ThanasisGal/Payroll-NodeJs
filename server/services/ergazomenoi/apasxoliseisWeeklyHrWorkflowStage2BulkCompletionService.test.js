'use strict';

const assert = require('assert');
const { buildWeeklyHrStage2BulkPreview } = require(
    './apasxoliseisWeeklyHrStage2BulkPreviewService'
);
const { childRequestId, completeWeeklyHrWorkflowStage2Bulk } = require(
    './apasxoliseisWeeklyHrWorkflowStage2BulkCompletionService'
);
const FP = 'a'.repeat(64);
function context(index, kind = 'safe') {
    const start = new Date(Date.UTC(2026, 4, 4 + index * 7));
    const end = new Date(start.getTime() + 6 * 86400000); const date = start.toISOString().slice(0, 10);
    const value = { scope: { employee_id: `employee-${index}`, employee_kodikos: String(index),
        week_start: start, week_end: end }, rows: [{ _id: `row-${index}`, hmeromhnia: start,
        repo: false, kathgoria_ergasias: 'ΕΡΓ', cards_apo_ora_01: '',
        cards_eos_ora_01: '', cards_ores_ergasias: 0,
        apologistiko_biblio: false, repo_apologistika: false,
        kathgoria_ergasias_apologistika: '', kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE',
        adeia_apologistika: false, astheneia_apologistika: false,
        apousia_apologistika: null, ores_ergasias_apologistika: 0 }],
    effectiveProfilesByDate: { [date]: { typos_apasxolhshs: '0' } },
    workflowState: { stage1: { status: 'COMPLETED' } }, upstream: { stage1_current_fingerprint: FP },
    lifecycle: { stages: { stage2: {}, stage3: { pending_dates: [],
        stage2_automatic_resolution_items: [{ date, classification: 'REST_REPO' }] } } } };
    if (kind === 'manual') value.stage2StateDiagnostic = 'AMBIGUOUS'; return value;
}

(async () => {
    const contexts = [context(0), context(1), context(2), context(3, 'manual')];
    const preview = buildWeeklyHrStage2BulkPreview({ contexts });
    const completed = new Set(); let loads = 0; let guards = 0; const calls = [];
    const checkedFingerprints = [];
    const args = { period_start: '2026-05-01', period_end: '2026-05-31', ypokatasthma: '0001',
        bulk_request_id: 'bulk-stage2-0001', reason_or_notes: 'Μαζική ενημέρωση',
        expected_preview_fingerprint: preview.preview_fingerprint,
        actor: { role: 'HR' }, commonGuard: async () => { guards++; },
        loadPreparedContexts: async () => { loads++; return contexts; },
        completePreparedScope: async ({ context: item, request_id,
            expected_scope_fingerprint }) => {
            calls.push(request_id); const key = String(item.scope.employee_id);
            checkedFingerprints.push(expected_scope_fingerprint);
            if (key === 'employee-1') throw Object.assign(new Error('stale'),
                { code: 'STAGE2_INPUT_CHANGED' });
            const idempotent = completed.has(request_id); completed.add(request_id);
            return { completed: true, idempotent };
        } };
    const first = await completeWeeklyHrWorkflowStage2Bulk(args);
    assert.deepEqual({ applied: first.applied, stale: first.stale, failed: first.failed,
        skipped: first.skipped_manual }, { applied: 2, stale: 1, failed: 0, skipped: 1 });
    assert.equal(loads, 1); assert.equal(guards, 1);
    assert.equal(new Set(calls).size, 3);
    assert.equal(checkedFingerprints.every((value) => /^[a-f0-9]{64}$/.test(value)), true);
    const retry = await completeWeeklyHrWorkflowStage2Bulk(args);
    assert.equal(retry.already_completed, 2);
    assert.equal(retry.stale, 1);
    assert.equal(loads, 2); assert.equal(guards, 2);
    assert.equal(childRequestId('bulk-stage2-0001', preview.safe_scope_ids[0]), calls[0]);
    await assert.rejects(() => completeWeeklyHrWorkflowStage2Bulk({ ...args,
        expected_preview_fingerprint: 'b'.repeat(64) }), { code: 'STAGE2_BULK_PREVIEW_CHANGED' });
    {
        const concurrentContexts = [context(8)];
        const concurrentPreview = buildWeeklyHrStage2BulkPreview({ contexts: concurrentContexts });
        const claimed = new Set();
        const concurrentArgs = { ...args, bulk_request_id: 'bulk-stage2-concurrent-0001',
            expected_preview_fingerprint: concurrentPreview.preview_fingerprint,
            loadPreparedContexts: async () => concurrentContexts,
            completePreparedScope: async ({ request_id }) => {
                const idempotent = claimed.has(request_id); claimed.add(request_id);
                await Promise.resolve(); return { completed: true, idempotent };
            } };
        const [left, right] = await Promise.all([
            completeWeeklyHrWorkflowStage2Bulk(concurrentArgs),
            completeWeeklyHrWorkflowStage2Bulk(concurrentArgs)
        ]);
        assert.equal(left.applied + right.applied, 1);
        assert.equal(left.already_completed + right.already_completed, 1);
        assert.equal(claimed.size, 1);
    }
    console.log('weekly HR Stage-2 bulk completion tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
