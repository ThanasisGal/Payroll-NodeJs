'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { buildStage3InputFingerprint } = require('./apasxoliseisStage3FingerprintService');
const { resolveWeeklyHrStage3Day } = require('./apasxoliseisWeeklyHrWorkflowStage3ResolutionService');

const actor = { user_id: new mongoose.Types.ObjectId(), user_name: 'HR User', role: 'HR' };
function context({ full = false, residual = true, actual = false,
    remaining = ['2026-06-03'], stage1Current = 'b'.repeat(64),
    stage1Completion = 'b'.repeat(64), stage1Effective = stage1Completion,
    date = '2026-06-03', rowId = new mongoose.Types.ObjectId() } = {}) {
    const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
        employee_id: new mongoose.Types.ObjectId(), employee_kodikos: '0014',
        week_start: new Date('2026-06-01Z'), week_end: new Date('2026-06-07Z') };
    return { scope, row: { _id: rowId, team: 'THA',
        company_kod: 'company', ypokatasthma: '0000', kodikos: '0014',
        hmeromhnia: new Date(`${date}Z`), updatedAt: new Date(),
        kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 6,
        apo_ora_01: '15:00', eos_ora_01: '21:00',
        cards_ores_ergasias: actual ? 2 : 0,
        ...(actual ? { cards_apo_ora_01: '15:00', cards_eos_ora_01: '17:00' } : {}),
        kathgoria_ergasias_apologistika: '',
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' },
    dailyProfile: { kathestos_apasxolhshs: full ? '0' : '1', source: 'ISTORIKO' },
    actualFacts: { countsAsActualWorkDay: actual }, isResidual: residual,
    remaining_dates: remaining, stage2: { fingerprint: 'a'.repeat(64),
        status: 'COMPLETED', resolution: 'NOT_APPLICABLE', resolved_dates: [] },
    upstream: { stage1_current_fingerprint: stage1Current,
        stage1_completion_fingerprint: stage1Completion,
        stage1_effective_fingerprint: stage1Effective, stage1_version: 1,
        stage2_fingerprint: 'a'.repeat(64), stage2_version: 0, stage3_version: 0 } };
}
function query(value) { return { session() { return this; }, async lean() { return value; } }; }
function harness(initial, postRemaining = [], postStage1Current = 'c'.repeat(64)) {
    let beforeStateUpdate = null;
    const store = { state: { ...initial.scope, stage1: { status: 'COMPLETED',
        completion_fingerprint: initial.upstream.stage1_completion_fingerprint,
        effective_fingerprint: initial.upstream.stage1_effective_fingerprint,
        version: 1 } }, audits: [], daily: [], stateUpdateFilters: [] };
    const updateState = async (filter, update) => {
            store.stateUpdateFilters.push(filter);
            if (beforeStateUpdate) beforeStateUpdate(store);
            const rootVersionMatches = Number(store.state.stage1?.version || 0) ===
                Number(filter['stage1.version']);
            const stage3Matches = Object.hasOwn(filter, 'stage3.version')
                ? filter['stage3.version']?.$exists === false
                    ? store.state.stage3?.version === undefined
                    : Number(store.state.stage3?.version || 0) ===
                        Number(filter['stage3.version'])
                : false;
            if (!rootVersionMatches || !stage3Matches) return { matchedCount: 0 };
            store.state.stage1 = update.$set.stage1;
            store.state.stage3 = update.$set.stage3;
            return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
        };
    const stateModel = { findOne: () => query(store.state),
        collection: { updateOne: updateState } };
    const auditModel = { findOne: (filter) => query(store.audits.find((item) =>
        item.team === filter.team && item.company_kod === filter.company_kod &&
        item.request_id === filter.request_id) || null),
    create: async (items) => { store.audits.push(...items); } };
    const transactionRunner = async (work) => {
        const before = structuredClone(store);
        try { return await work({ session: {}, period_control_version: 4,
            period_write_fence_version: 8 }); }
        catch (error) { Object.assign(store, before); throw error; }
    };
    const writeDaily = async ({ row, classification, reason }) => {
        store.daily.push({ classification, reason });
        return { unchanged: false, row: { ...row,
            kathgoria_ergasias_apologistika: classification === 'NON_WORK' ? 'ΜΕ' : '',
            adeia_apologistika: classification === 'LEAVE',
            astheneia_apologistika: classification === 'SICKNESS',
            apousia_apologistika: classification === 'ABSENCE' } };
    };
    const post = { ...initial, remaining_dates: postRemaining,
        upstream: { ...initial.upstream, stage1_current_fingerprint: postStage1Current } };
    return { store, stateModel, auditModel, transactionRunner, writeDaily,
        setBeforeStateUpdate(value) { beforeStateUpdate = value; },
        loadFreshContext: async () => initial, loadPostWriteContext: async () => post };
}
function command(initial, h, overrides = {}) {
    return resolveWeeklyHrStage3Day({ initialContext: initial,
        expected_input_fingerprint: buildStage3InputFingerprint(initial).fingerprint,
        expected_stage3_version: initial.upstream.stage3_version,
        final_classification: 'NON_WORK', reason_or_notes: 'Αιτιολογία',
        request_id: 'stage3:req-0001', actor, ...h, ...overrides });
}

(async () => {
    const firstContext = context({ remaining: ['2026-06-03', '2026-06-04'] });
    const firstHarness = harness(firstContext, ['2026-06-04']);
    const open = await command(firstContext, firstHarness);
    assert.equal(open.stage3_status, 'OPEN');
    assert.equal(open.completion_fingerprint, '');
    assert.equal(firstHarness.store.state.stage3.version, 1);
    assert.equal(firstHarness.store.state.stage1.version, 2);
    assert.equal(firstHarness.store.state.stage1.completion_fingerprint, 'b'.repeat(64));
    assert.equal(firstHarness.store.state.stage1.effective_fingerprint, 'c'.repeat(64));
    assert.equal(firstHarness.store.audits[0].period_write_fence_version, 8);
    assert.equal(firstHarness.store.audits[0].final_classification, 'NON_WORK');
    assert.equal(firstHarness.store.audits[0].reason_or_notes, 'Αιτιολογία');
    assert.equal(firstHarness.store.audits[0].previous_stage1_effective_fingerprint,
        'b'.repeat(64));
    assert.equal(firstHarness.store.audits[0].new_stage1_effective_fingerprint,
        'c'.repeat(64));
    assert.equal(firstHarness.store.audits[0].previous_stage1_version, 1);
    assert.equal(firstHarness.store.audits[0].new_stage1_version, 2);
    const replay = await command(firstContext, firstHarness);
    assert.equal(replay.idempotent, true);
    assert.equal(firstHarness.store.state.stage1.version, 2);
    assert.equal(firstHarness.store.audits.length, 1);
    await assert.rejects(() => command(firstContext, firstHarness,
        { reason_or_notes: 'Άλλη αιτιολογία' }), { code: 'STAGE3_REQUEST_ID_CONFLICT' });

    const secondContext = context({ date: '2026-06-04', remaining: ['2026-06-04'],
        stage1Current: 'c'.repeat(64), stage1Completion: 'b'.repeat(64),
        stage1Effective: 'c'.repeat(64) });
    secondContext.upstream.stage3_version = 1;
    firstHarness.loadFreshContext = async () => secondContext;
    firstHarness.loadPostWriteContext = async () => ({ ...secondContext, remaining_dates: [],
        upstream: { ...secondContext.upstream,
            stage1_current_fingerprint: 'd'.repeat(64) } });
    const second = await command(secondContext, firstHarness,
        { request_id: 'stage3:req-0002' });
    assert.equal(second.stage3_status, 'COMPLETED');
    assert.equal(firstHarness.store.state.stage1.completion_fingerprint, 'b'.repeat(64));
    assert.equal(firstHarness.store.state.stage1.effective_fingerprint, 'd'.repeat(64));
    assert.equal(firstHarness.store.state.stage1.version, 3);
    assert.equal(firstHarness.store.audits[1].previous_stage1_effective_fingerprint,
        'c'.repeat(64));
    assert.equal(firstHarness.store.audits[1].new_stage1_effective_fingerprint,
        'd'.repeat(64));
    assert.equal(firstHarness.store.audits[1].previous_stage1_version, 2);
    assert.equal(firstHarness.store.audits[1].new_stage1_version, 3);

    const lastContext = context(); const lastHarness = harness(lastContext, []);
    const completed = await command(lastContext, lastHarness);
    assert.equal(completed.stage3_status, 'COMPLETED');
    assert.match(completed.completion_fingerprint, /^[a-f0-9]{64}$/);

    const employee0029 = context({ date: '2026-06-30', remaining: ['2026-06-30'] });
    employee0029.scope.employee_kodikos = '0029';
    employee0029.scope.week_start = new Date('2026-06-29Z');
    employee0029.scope.week_end = new Date('2026-07-05Z');
    employee0029.row.kodikos = '0029';
    const employee0029Harness = harness(employee0029, []);
    const employee0029Result = await command(employee0029, employee0029Harness, {
        final_classification: 'ABSENCE', request_id: 'stage3:0029-20260630'
    });
    assert.equal(employee0029Result.stage3_status, 'COMPLETED');
    assert.equal(employee0029Result.stage3_version, 1);
    assert.equal(employee0029Result.remaining_count, 0);
    assert.equal(employee0029Harness.store.stateUpdateFilters.length, 1);
    assert.equal(employee0029Harness.store.stateUpdateFilters[0]['stage1.version'], 1);
    assert.deepEqual(employee0029Harness.store.stateUpdateFilters[0]['stage3.version'],
        { $exists: false });
    assert.equal(employee0029Harness.store.stateUpdateFilters[0].$or, undefined);

    const finalUpdateRaceContext = context();
    const finalUpdateRaceHarness = harness(finalUpdateRaceContext, []);
    finalUpdateRaceHarness.setBeforeStateUpdate((store) => {
        store.state.stage3 = { status: 'OPEN', version: 1, completion_fingerprint: '' };
    });
    await assert.rejects(() => command(finalUpdateRaceContext, finalUpdateRaceHarness, {
        request_id: 'stage3:final-update-race-0001'
    }), { code: 'STAGE3_VERSION_CONFLICT' });
    assert.equal(finalUpdateRaceHarness.store.daily.length, 0);

    const concurrentContext = context();
    const concurrentHarness = harness(concurrentContext, []);
    concurrentHarness.loadFreshContext = async () => ({ ...concurrentContext,
        upstream: { ...concurrentContext.upstream, stage3_version: 1 } });
    concurrentHarness.store.state.stage3 = { status: 'OPEN', version: 1,
        completion_fingerprint: '' };
    await assert.rejects(() => command(concurrentContext, concurrentHarness, {
        request_id: 'stage3:concurrent-0001'
    }), { code: 'STAGE3_VERSION_CONFLICT' });
    assert.equal(concurrentHarness.store.daily.length, 0);

    await assert.rejects(() => command(context({ full: true }), harness(context({ full: true }))),
        { code: 'STAGE3_NON_WORK_NOT_ALLOWED_FOR_FULL_TIME' });
    await assert.rejects(() => command(context({ residual: false }),
        harness(context({ residual: false }))), { code: 'STAGE3_DATE_NOT_RESIDUAL' });
    await assert.rejects(() => command(context({ actual: true }), harness(context({ actual: true }))),
        { code: 'STAGE3_ACTUAL_WORK_PRESENT' });
    await assert.rejects(() => command(context(), harness(context()),
        { reason_or_notes: '   ' }), { code: 'STAGE3_REASON_REQUIRED' });
    await assert.rejects(() => command(context(), harness(context()),
        { expected_input_fingerprint: 'c'.repeat(64) }), { code: 'STAGE3_INPUT_CHANGED' });
    const staleContext = context({ stage1Current: 'e'.repeat(64),
        stage1Effective: 'b'.repeat(64) });
    await assert.rejects(() => command(staleContext, harness(staleContext)),
        { code: 'STAGE3_UPSTREAM_STAGE1_STALE' });

    const rollbackContext = context(); const rollbackHarness = harness(rollbackContext, []);
    rollbackHarness.auditModel.create = async () => { throw new Error('audit failed'); };
    await assert.rejects(() => command(rollbackContext, rollbackHarness));
    assert.equal(rollbackHarness.store.daily.length, 0);
    assert.equal(rollbackHarness.store.state.stage3, undefined);
    assert.equal(rollbackHarness.store.state.stage1.completion_fingerprint, 'b'.repeat(64));
    assert.equal(rollbackHarness.store.state.stage1.effective_fingerprint, 'b'.repeat(64));

    const legacyContext = context(); const legacyHarness = harness(legacyContext, []);
    delete legacyHarness.store.state.stage1.effective_fingerprint;
    await command(legacyContext, legacyHarness, { request_id: 'stage3:legacy-0001' });
    assert.equal(legacyHarness.store.state.stage1.completion_fingerprint, 'b'.repeat(64));
    assert.equal(legacyHarness.store.state.stage1.effective_fingerprint, 'c'.repeat(64));

    const sliceContext = context({ date: '2026-06-29', remaining: ['2026-06-29'],
        stage1Current: 'e'.repeat(64), stage1Completion: 'd'.repeat(64),
        stage1Effective: 'e'.repeat(64) });
    sliceContext.scope.week_start = new Date('2026-06-29Z');
    sliceContext.scope.week_end = new Date('2026-07-05Z');
    Object.assign(sliceContext.upstream, { stage1_attestation_scope: 'PERIOD_SLICE',
        stage1_period_start: '2026-06-01', stage1_period_end: '2026-06-30' });
    const sliceHarness = harness(sliceContext, [], 'f'.repeat(64));
    sliceHarness.store.state.stage1 = { status: 'OPEN', completion_fingerprint: '',
        effective_fingerprint: '', version: 7, period_slices: [{
            period_start: new Date('2026-06-01Z'), period_end: new Date('2026-06-30Z'),
            actionable_dates: [new Date('2026-06-29Z'), new Date('2026-06-30Z')],
            context_only_dates: [new Date('2026-07-01Z')], status: 'COMPLETED',
            context_fingerprint: 'a'.repeat(64), completion_fingerprint: 'd'.repeat(64),
            effective_fingerprint: 'e'.repeat(64), version: 2 }, {
            period_start: new Date('2026-07-01Z'), period_end: new Date('2026-07-31Z'),
            actionable_dates: [new Date('2026-07-01Z')],
            context_only_dates: [new Date('2026-06-29Z')], status: 'OPEN',
            context_fingerprint: 'a'.repeat(64), completion_fingerprint: '',
            effective_fingerprint: '', version: 1 }] };
    sliceHarness.loadPostWriteContext = async () => ({ ...sliceContext, remaining_dates: [],
        upstream: { ...sliceContext.upstream, stage1_current_fingerprint: 'f'.repeat(64) } });
    await command(sliceContext, sliceHarness, { request_id: 'stage3:slice-0001' });
    const nextJuneSlice = sliceHarness.store.state.stage1.period_slices[0];
    assert.equal(nextJuneSlice.completion_fingerprint, 'd'.repeat(64));
    assert.equal(nextJuneSlice.effective_fingerprint, 'f'.repeat(64));
    assert.equal(nextJuneSlice.version, 3);
    assert.equal(sliceHarness.store.state.stage1.period_slices[1].status, 'OPEN');
    assert.equal(sliceHarness.store.state.stage1.completion_fingerprint, '');
    assert.equal(sliceHarness.store.audits[0].previous_stage1_effective_fingerprint,
        'e'.repeat(64));
    assert.equal(sliceHarness.store.audits[0].new_stage1_effective_fingerprint,
        'f'.repeat(64));
    assert.equal(sliceHarness.store.audits[0].previous_stage1_version, 2);
    assert.equal(sliceHarness.store.audits[0].new_stage1_version, 3);

    const raceContext = context(); const raceHarness = harness(raceContext, []);
    raceHarness.auditModel.create = async () => {
        throw Object.assign(new Error('duplicate request id'), { code: 11000 });
    };
    await assert.rejects(() => command(raceContext, raceHarness),
        { code: 'STAGE3_REQUEST_RACE_CONFLICT' });
    assert.equal(raceHarness.store.daily.length, 0);
    assert.equal(raceHarness.store.state.stage3, undefined);
    console.log('weekly HR Stage-3 atomic resolution tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
