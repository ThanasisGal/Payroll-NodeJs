'use strict';

const assert = require('assert/strict');
const mongoose = require('mongoose');
const {
    commandIdentity,
    completeWeeklyHrWorkflowStage1
} = require('./apasxoliseisWeeklyHrWorkflowStage1CompletionService');
const {
    resolveWeeklyHrWorkflow
} = require('./apasxoliseisWeeklyHrWorkflowResolverService');

const dates = ['01', '02', '03', '04', '05', '06', '07'].map((day) => `2026-06-${day}`);

function workRow(date) {
    return { _id: `row-${date}`, hmeromhnia: date, kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: 8, apo_ora_01: '09:00', eos_ora_01: '17:00',
        cards_apo_ora_01: '09:00', cards_eos_ora_01: '17:00', cards_ores_ergasias: 8,
        kathgoria_ergasias_apologistika: 'ΕΡΓ', ores_ergasias_apologistika: 8,
        repo: false, repo_apologistika: false, adeia: false,
        adeia_apologistika: false, astheneia: false, astheneia_apologistika: false,
        kathgoria_adeias: '', kathgoria_adeias_apologistika: '',
        ores_apoysias_apologistika: 0, ores_adeias_pistomenes_apologistika: 0,
        is_locked: false };
}

function possibleLeaveRow(date = dates[1]) {
    return { ...workRow(date), cards_apo_ora_01: '', cards_eos_ora_01: '',
        cards_ores_ergasias: 0, kathgoria_ergasias_apologistika: '',
        ores_ergasias_apologistika: 0,
        kathgoria_adeias_apologistika: 'POSSIBLE_LEAVE' };
}

function week(replacement = possibleLeaveRow()) {
    return dates.map((date) => date === replacement.hmeromhnia ? replacement : workRow(date));
}

const objectId = () => new mongoose.Types.ObjectId();
const baseScope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: objectId(), employee_kodikos: '0004',
    week_start: '2026-06-01', week_end: '2026-06-07' };
const actor = { user_id: objectId(), user_name: 'HR User', role: 'HR' };
const workflow_context = { effectiveProfile: { hmeres_ergasias_ebdomadas: 5,
    typos_apasxolhshs: '0', pososto_prosayxhshs_6hs_hmeras: 40 } };

function clone(value) {
    return value === null || value === undefined ? value : structuredClone(value);
}

function fakePersistence({ state = null, audits = [], forceVersionConflict = false } = {}) {
    const store = { state: clone(state), audits: clone(audits), forceVersionConflict };
    const stateModel = {
        findOne: async () => clone(store.state),
        create: async ([document]) => {
            if (store.state) { const error = new Error('duplicate'); error.code = 11000; throw error; }
            store.state = clone(document);
            return [clone(document)];
        },
        updateOne: async (filter, update) => {
            if (store.forceVersionConflict || !store.state ||
                store.state.stage1.version !== filter['stage1.version']) return { matchedCount: 0 };
            store.state.stage1 = clone(update.$set.stage1);
            return { matchedCount: 1 };
        }
    };
    const auditModel = {
        findOne: async (filter) => clone(store.audits.find((audit) =>
            audit.team === filter.team && audit.company_kod === filter.company_kod &&
            audit.request_id === filter.request_id) || null),
        create: async ([document]) => {
            if (store.audits.some((audit) => audit.team === document.team &&
                audit.company_kod === document.company_kod &&
                audit.request_id === document.request_id)) {
                const error = new Error('duplicate'); error.code = 11000; throw error;
            }
            store.audits.push(clone(document));
            return [clone(document)];
        }
    };
    const transactionRunner = async (work) => {
        const before = clone({ state: store.state, audits: store.audits });
        try { return await work({ fake: true }); } catch (error) {
            store.state = before.state; store.audits = before.audits; throw error;
        }
    };
    return { store, stateModel, auditModel, transactionRunner };
}

let requestCounter = 0;
function command(persistence, overrides = {}) {
    requestCounter += 1;
    const initialRows = overrides.weekRows || week();
    return completeWeeklyHrWorkflowStage1({ scope: overrides.scope || baseScope,
        weekRows: initialRows, actor: overrides.actor || actor,
        reason_or_notes: overrides.reason_or_notes ?? 'Stage 1 reviewed',
        request_id: overrides.request_id || `stage1:req-${String(requestCounter).padStart(4, '0')}`,
        workflow_context, ...persistence,
        fenceWeeklyInput: overrides.fenceWeeklyInput || (async () => {}),
        loadFreshWeekRows: overrides.loadFreshWeekRows || (async () => clone(initialRows)),
        now: () => new Date('2026-08-14T10:00:00.000Z') });
}

(async () => {
    // A. First completion creates version 1 and exactly one immutable audit event.
    const first = fakePersistence();
    const firstResult = await command(first);
    assert.equal(firstResult.idempotent, false);
    assert.equal(first.store.state.stage1.status, 'COMPLETED');
    assert.equal(first.store.state.stage1.version, 1);
    assert.equal(first.store.state.stage1.effective_fingerprint,
        first.store.state.stage1.completion_fingerprint);
    assert.equal(first.store.audits.length, 1);
    assert.equal(first.store.audits[0].performed_by_user_name, 'HR User');
    assert.equal(first.store.audits[0].reason_or_notes, 'Stage 1 reviewed');
    assert.ok(first.store.audits[0].new_completion_fingerprint);
    assert.ok(first.store.state.stage1.completed_at);

    // Completion without a positive classification does not mutate or consume
    // the candidate; the same day remains available to the downstream review.
    const unclassifiedRows = week();
    for (const index of [0, 2]) Object.assign(unclassifiedRows[index], {
        kathgoria_ergasias: 'ΑΝ', ores_ergasias: 0, apo_ora_01: '', eos_ora_01: '', repo: true,
        cards_apo_ora_01: '', cards_eos_ora_01: '', cards_ores_ergasias: 0,
        kathgoria_ergasias_apologistika: 'ΑΝ', ores_ergasias_apologistika: 0,
        repo_apologistika: true
    });
    const downstream = resolveWeeklyHrWorkflow({ weekRows: unclassifiedRows,
        effectiveProfile: workflow_context.effectiveProfile,
        leave_classification_completed: true });
    assert.equal(unclassifiedRows[1].kathgoria_adeias_apologistika, 'POSSIBLE_LEAVE');
    assert.deepEqual(downstream.remaining_possible_leave_days, [dates[1]]);

    // B. Existing OPEN state increments its existing version.
    const open = fakePersistence({ state: { ...baseScope, stage1: {
        status: 'OPEN', completion_fingerprint: '', version: 3 } } });
    await command(open);
    assert.equal(open.store.state.stage1.version, 4);
    assert.equal(open.store.audits.length, 1);
    assert.deepEqual(open.store.audits[0].before_stage,
        { status: 'OPEN', completion_fingerprint: '', version: 3 });

    // C. Same completed fingerprint is a no-op, even with a new request id.
    const auditCount = first.store.audits.length;
    const same = await command(first);
    assert.equal(same.idempotent, true);
    assert.equal(first.store.state.stage1.version, 1);
    assert.equal(first.store.audits.length, auditCount);

    // D/E. Stale Stage 1 is re-completed; prior audit and Stage 2 remain untouched.
    const oldFingerprint = first.store.state.stage1.completion_fingerprint;
    const stage2 = { status: 'COMPLETED', completion_fingerprint: 'c'.repeat(64),
        version: 1, depends_on_stage1_fingerprint: oldFingerprint };
    const stale = fakePersistence({ state: { ...first.store.state, stage2 },
        audits: first.store.audits });
    const changedRows = week({ ...possibleLeaveRow(), adeia_apologistika: true,
        kathgoria_adeias_apologistika: 'ΑΔΚΑΝ' });
    await command(stale, { weekRows: changedRows });
    assert.equal(stale.store.state.stage1.version, 2);
    assert.notEqual(stale.store.state.stage1.completion_fingerprint, oldFingerprint);
    assert.equal(stale.store.state.stage1.effective_fingerprint,
        stale.store.state.stage1.completion_fingerprint);
    assert.equal(stale.store.audits.length, auditCount + 1);
    assert.equal(stale.store.audits[0].new_completion_fingerprint, oldFingerprint);
    assert.equal(stale.store.audits[1].previous_completion_fingerprint, oldFingerprint);
    assert.deepEqual(stale.store.state.stage2, stage2);

    // ST. Initial/final mismatch rolls back both state and audit.
    const changing = fakePersistence();
    const changingSnapshot = clone(changing.store);
    await assert.rejects(command(changing, {
        loadFreshWeekRows: async () => changedRows
    }), (error) => error.code === 'STAGE1_INPUT_CHANGED');
    assert.deepEqual(changing.store.state, changingSnapshot.state);
    assert.deepEqual(changing.store.audits, changingSnapshot.audits);

    // Z. Optimistic stage version mismatch cannot overwrite state.
    const conflictedState = { ...baseScope, stage1: {
        status: 'OPEN', completion_fingerprint: '', version: 2 } };
    const conflicted = fakePersistence({ state: conflictedState, forceVersionConflict: true });
    await assert.rejects(command(conflicted),
        (error) => error.code === 'STAGE1_VERSION_CONFLICT');
    assert.deepEqual(conflicted.store.state.stage1, conflictedState.stage1);
    assert.equal(conflicted.store.audits.length, 0);

    // H/TH. Same request is replayed; changed command under that request conflicts.
    const replay = fakePersistence();
    const replayRequest = 'stage1:replay-0001';
    await command(replay, { request_id: replayRequest });
    const replayAuditCount = replay.store.audits.length;
    const replayed = await command(replay, { request_id: replayRequest });
    assert.equal(replayed.replayed_request, true);
    assert.equal(replay.store.audits.length, replayAuditCount);
    await assert.rejects(command(replay, { request_id: replayRequest,
        reason_or_notes: 'Different command content' }),
    (error) => error.code === 'STAGE1_REQUEST_ID_CONFLICT');

    // I/IA/IB. Authorization, reason and natural-week validation.
    await assert.rejects(command(fakePersistence(), { actor: { ...actor, role: 'U' } }),
        (error) => error.code === 'CRITICAL_EMPLOYMENT_DECISION_NOT_AUTHORIZED');
    await assert.rejects(command(fakePersistence(), { reason_or_notes: '   ' }),
        (error) => error.code === 'STAGE1_REASON_REQUIRED');
    await assert.rejects(command(fakePersistence(), { scope: { ...baseScope,
        week_start: '2026-06-02', week_end: '2026-06-08' } }),
    (error) => error.code === 'INVALID_WEEK_SCOPE');

    // A real unresolved card-evidence blocker prevents completion.
    const blockedRows = week({ ...workRow(dates[1]), cards_apo_ora_01: '09:00',
        cards_eos_ora_01: '', cards_ores_ergasias: 0,
        ores_ergasias_apologistika: 0 });
    await assert.rejects(command(fakePersistence(), { weekRows: blockedRows }),
        (error) => error.code === 'STAGE1_COMPLETION_BLOCKED');

    // Employee identity is employee_id; a later code is reference metadata only.
    const originalCodeState = { ...baseScope, employee_kodikos: '0004', stage1: {
        status: 'OPEN', completion_fingerprint: '', version: 1 } };
    const changedCode = fakePersistence({ state: originalCodeState });
    const changedCodeResult = await command(changedCode, { scope: {
        ...baseScope, employee_kodikos: '0999' } });
    assert.equal(changedCodeResult.idempotent, false);
    assert.equal(changedCode.store.state.stage1.status, 'COMPLETED');
    assert.equal(changedCode.store.state.stage1.version, 2);
    assert.equal(changedCode.store.state.employee_kodikos, '0004');

    const identityInput = { scope: baseScope, fingerprint: 'a'.repeat(64), actor,
        reason: 'Stage 1 reviewed' };
    assert.equal(commandIdentity(identityInput), commandIdentity({ ...identityInput,
        scope: { ...baseScope, employee_kodikos: '0999' } }));

    console.log('weekly HR Stage-1 completion service tests passed (16 scenarios)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
