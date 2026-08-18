'use strict';

const assert = require('node:assert/strict');
const { completeWeeklyHrWorkflowStage2 } = require(
    './apasxoliseisWeeklyHrWorkflowStage2CompletionService'
);

const FP1 = 'a'.repeat(64); const FP2 = 'b'.repeat(64);
function context(classification = 'REST_REPO') {
    const date = classification === 'REST_REPO' ? '2026-06-09' : '2026-06-16';
    return { scope: { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
        employee_id: '507f191e810c19729de860eb', employee_kodikos: '0009',
        week_start: new Date('2026-06-08Z'), week_end: new Date('2026-06-14Z') },
    rows: [{ _id: classification === 'REST_REPO' ? '6a7c515e6aeaefb3c8764c7c' :
        '507f191e810c19729de860ec', hmeromhnia: new Date(`${date}T00:00:00Z`),
    updatedAt: new Date('2026-08-18Z'), repo: false, kathgoria_ergasias: 'ΕΡΓ',
    cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
    apologistiko_biblio: false, repo_apologistika: false,
    kathgoria_ergasias_apologistika: '',
    kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE',
    adeia_apologistika: false, astheneia_apologistika: false,
    apousia_apologistika: null, ores_ergasias_apologistika: 0 }],
    effectiveProfilesByDate: { [date]: { typos_apasxolhshs:
        classification === 'REST_REPO' ? '0' : '1' } },
    lifecycle: { stages: { stage3: { stage2_automatic_resolution_items: [
        { date, classification }
    ] } } }, upstream: { stage1_current_fingerprint: FP1 } };
}
function harness(classification, failure = '') {
    const initial = context(classification);
    const committed = { daily: [], state: { stage1: { status: 'COMPLETED',
        completion_fingerprint: FP1, effective_fingerprint: FP1, version: 1 } }, audits: [] };
    let staged;
    const session = {};
    const transactionRunner = async (work) => {
        staged = structuredClone(committed);
        try { const result = await work(session); Object.assign(committed, staged); return result; }
        catch (error) { throw error; }
    };
    const stateModel = { findOne: () => ({ session() { return this; },
        async lean() { return staged.state; } }), collection: { async updateOne() {
        if (failure === 'state') throw new Error('state');
        staged.state.stage2 = { status: 'COMPLETED' }; return { matchedCount: 1 };
    } } };
    const auditModel = { findOne: (filter) => ({ session() { return this; },
        async lean() { return staged.audits.find((item) =>
            item.request_id === filter.request_id) || null; } }), async create(records) {
        if (failure === 'audit') throw new Error('audit'); staged.audits.push(...records);
    } };
    const writeDaily = async (input) => {
        if (failure === 'daily') throw new Error('daily');
        staged.daily.push(input); return { unchanged: false };
    };
    const post = { ...initial, lifecycle: { stages: { stage3: {
        stage2_automatic_resolution_items: [] } } },
    upstream: { stage1_current_fingerprint: FP2 } };
    return { initial, committed, args: { initialContext: initial,
        actor: { user_id: '507f191e810c19729de860ea', user_name: 'HR', role: 'HR' },
        reason_or_notes: 'Deterministic Stage 2 materialization',
        request_id: `stage2-${classification.toLowerCase()}-0001`, transactionRunner,
        loadFreshContext: async () => initial, loadPostWriteContext: async () => post,
        writeDaily, stateModel, auditModel } };
}

(async () => {
    for (const [classification, expected] of [['REST_REPO', ['ΑΝ', true]],
        ['NON_WORK', ['ΜΕ', false]]]) {
        const h = harness(classification);
        const result = await completeWeeklyHrWorkflowStage2(h.args);
        assert.equal(result.materialized_count, 1);
        assert.equal(h.committed.daily[0].classification, classification);
        assert.strictEqual(h.committed.daily[0].session !== undefined, true);
        assert.equal(h.committed.audits[0].stage, 'STAGE2');
        assert.equal(h.committed.audits[0].stage2_resolution_items[0].classification,
            classification);
        assert.deepEqual(expected, classification === 'REST_REPO' ? ['ΑΝ', true] : ['ΜΕ', false]);
    }
    const noAction = context(); noAction.lifecycle.stages.stage3
        .stage2_automatic_resolution_items = [];
    const none = await completeWeeklyHrWorkflowStage2({ ...harness('REST_REPO').args,
        initialContext: noAction });
    assert.equal(none.materialized_count, 0);
    for (const failure of ['daily', 'state', 'audit']) {
        const h = harness('REST_REPO', failure);
        await assert.rejects(() => completeWeeklyHrWorkflowStage2(h.args));
        assert.equal(h.committed.daily.length, 0);
        assert.equal(h.committed.audits.length, 0);
        assert.equal(h.committed.state.stage2, undefined);
    }
    {
        const h = harness('REST_REPO');
        await completeWeeklyHrWorkflowStage2(h.args);
        const replay = await completeWeeklyHrWorkflowStage2(h.args);
        assert.equal(replay.idempotent, true);
        assert.equal(h.committed.daily.length, 1);
        assert.equal(h.committed.audits.length, 1);
        const changed = context('NON_WORK');
        changed.scope = h.initial.scope;
        changed.rows[0]._id = h.initial.rows[0]._id;
        await assert.rejects(() => completeWeeklyHrWorkflowStage2({ ...h.args,
            initialContext: changed }), { code: 'STAGE2_REQUEST_ID_CONFLICT' });
    }
    {
        const h = harness('REST_REPO');
        const changedClassification = context('NON_WORK');
        changedClassification.scope = h.initial.scope;
        changedClassification.rows[0]._id = h.initial.rows[0]._id;
        await assert.rejects(() => completeWeeklyHrWorkflowStage2({ ...h.args,
            loadFreshContext: async () => changedClassification }),
        { code: 'STAGE2_INPUT_CHANGED' });
    }
    {
        const h = harness('NON_WORK');
        const changedRow = structuredClone(h.initial);
        changedRow.rows[0].kathgoria_ergasias_apologistika = 'ΜΕ';
        await assert.rejects(() => completeWeeklyHrWorkflowStage2({ ...h.args,
            loadFreshContext: async () => changedRow }),
        { code: 'STAGE2_CANONICAL_ROW_CHANGED' });
    }
    {
        const h = harness('REST_REPO');
        const changedStage1 = structuredClone(h.initial);
        changedStage1.upstream.stage1_current_fingerprint = 'c'.repeat(64);
        await assert.rejects(() => completeWeeklyHrWorkflowStage2({ ...h.args,
            loadFreshContext: async () => changedStage1 }),
        { code: 'STAGE2_INPUT_CHANGED' });
    }
    {
        const h = harness('NON_WORK');
        h.initial.lifecycle.stages.stage3.pending_dates = ['2026-06-16'];
        await assert.rejects(() => completeWeeklyHrWorkflowStage2(h.args),
            { code: 'STAGE2_DATE_MOVED_TO_STAGE3' });
    }
    {
        const h = harness('NON_WORK');
        const changedProfile = structuredClone(h.initial);
        changedProfile.effectiveProfilesByDate['2026-06-16'].typos_apasxolhshs = '2';
        await assert.rejects(() => completeWeeklyHrWorkflowStage2({ ...h.args,
            loadFreshContext: async () => changedProfile }),
        { code: 'STAGE2_INPUT_CHANGED' });
    }
    {
        const h = harness('NON_WORK');
        const actualWork = structuredClone(h.initial);
        actualWork.rows[0].cards_apo_ora_01 = '08:00';
        actualWork.rows[0].cards_eos_ora_01 = '12:00';
        actualWork.rows[0].cards_ores_ergasias = 4;
        await assert.rejects(() => completeWeeklyHrWorkflowStage2({ ...h.args,
            loadFreshContext: async () => actualWork }),
        { code: 'STAGE2_ACTUAL_WORK_OR_CARD_EVIDENCE' });
    }
    console.log('weekly HR Stage-2 atomic materialization tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
