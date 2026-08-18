'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
    runWithStaleStage1CompletionWriteFence
} = require('./apasxoliseisPeriodControlService');
const {
    completeWeeklyHrWorkflowStage1
} = require('./apasxoliseisWeeklyHrWorkflowStage1CompletionService');
const {
    resolveWeeklyHrWorkflow
} = require('./apasxoliseisWeeklyHrWorkflowResolverService');

const now = new Date('2026-08-16T10:00:00.000Z');
const periodScope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    period_start: '2026-06-01', period_end: '2026-06-30' };
const employeeId = new mongoose.Types.ObjectId();
const actor = { user_id: new mongoose.Types.ObjectId(), user_name: 'HR User', role: 'HR' };
const profile = { hmeres_ergasias_ebdomadas: 5, typos_apasxolhshs: '0',
    pososto_prosayxhshs_6hs_hmeras: 40 };

function rows(start = '2026-06-01', possibleOffsets = [2]) {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(`${start}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + index);
        const possible = possibleOffsets.includes(index);
        return { _id: `row-${start}-${index}`, hmeromhnia: date.toISOString().slice(0, 10),
            kathgoria_ergasias: 'ΕΡΓ', ores_ergasias: 8,
            apo_ora_01: '09:00', eos_ora_01: '17:00',
            cards_apo_ora_01: possible ? '' : '09:00',
            cards_eos_ora_01: possible ? '' : '17:00',
            cards_ores_ergasias: possible ? 0 : 8,
            kathgoria_ergasias_apologistika: possible ? '' : 'ΕΡΓ',
            ores_ergasias_apologistika: possible ? 0 : 8,
            kathgoria_adeias_apologistika: possible ? 'POSSIBLE_LEAVE' : '',
            repo: false, repo_apologistika: false, adeia: false,
            adeia_apologistika: false, astheneia: false,
            astheneia_apologistika: false, apousia_apologistika: false,
            ores_apoysias_apologistika: 0, ores_adeias_pistomenes_apologistika: 0,
            is_locked: false };
    });
}

function periodStore(overrides = {}) {
    const record = { ...periodScope, status: 'OPEN', version: 3, write_fence_version: 9,
        deadline: new Date('2026-07-31T00:00:00.000Z'), active_calculation_id: '',
        historical_reconstruction_status: 'COMPLETED', historical_reconstruction_version: 1,
        historical_dependency_fingerprint: 'a'.repeat(64),
        historical_source_fingerprint: 's'.repeat(64),
        historical_result_fingerprint: 'r'.repeat(64),
        historical_reconstruction_completed_at: new Date('2026-08-14T10:00:00.000Z'),
        ...overrides };
    return { record, model: { async findOneAndUpdate(filter, update) {
        if (record.status !== filter.status || record.version !== filter.version ||
            record.historical_reconstruction_status !== filter.historical_reconstruction_status ||
            Number(record.historical_reconstruction_version) < 1 || record.active_calculation_id) return null;
        record.write_fence_version += Number(update.$inc?.write_fence_version || 0);
        Object.assign(record, update.$set || {});
        return { ...record };
    } } };
}

function workflowStore() {
    const store = { state: null, audits: [] };
    return { store,
        stateModel: {
            findOne: async () => store.state ? structuredClone(store.state) : null,
            create: async ([document]) => { store.state = structuredClone(document);
                return [structuredClone(document)]; },
            updateOne: async () => ({ matchedCount: 0 })
        },
        auditModel: {
            findOne: async () => null,
            create: async ([document]) => { store.audits.push(structuredClone(document));
                return [structuredClone(document)]; }
        } };
}

async function completeInStalePeriod({ weekRows, freshRows = weekRows,
    completionScope = null, period = periodStore(), extra = {} }) {
    const workflow = workflowStore();
    const weekStart = weekRows[0].hmeromhnia;
    const weekEnd = weekRows[6].hmeromhnia;
    const scope = completionScope || { team: 'THA', company_kod: 'company',
        ypokatasthma: '0000', employee_id: employeeId, employee_kodikos: '0014',
        week_start: weekStart, week_end: weekEnd };
    const result = await completeWeeklyHrWorkflowStage1({ scope, weekRows, actor,
        reason_or_notes: 'Ολοκλήρωση χωρίς θετικό χαρακτηρισμό',
        request_id: `stage1-stale:${weekStart}`, workflow_context: { effectiveProfile: profile },
        stateModel: workflow.stateModel, auditModel: workflow.auditModel,
        fenceWeeklyInput: async ({ session }) => assert.ok(session),
        loadFreshWeekRows: async () => structuredClone(freshRows), now: () => now,
        transactionRunner: async (work) => (await runWithStaleStage1CompletionWriteFence({
            scope: periodScope,
            expectedToken: { exists: true, stored_status: 'OPEN', version: 3 }, now,
            periodControlModel: period.model, indexGuard: async () => ({ ready: true }),
            fingerprintResolver: async () => ({ dependency_fingerprint: 'b'.repeat(64) }),
            transactionRunner: async (boundedWork) => boundedWork({ transaction: true }),
            work: ({ session }) => work(session)
        })).result,
        ...extra });
    return { result, workflow, period };
}

(async () => {
    for (const fixture of [rows('2026-06-01', [2]), rows('2026-06-08', [1, 2]),
        rows('2026-06-22', [0])]) {
        const before = structuredClone(fixture);
        const completed = await completeInStalePeriod({ weekRows: fixture,
            extra: { daily_updates: { adeia_apologistika: true } } });
        assert.equal(completed.result.completed, true);
        assert.equal(completed.workflow.store.state.stage1.status, 'COMPLETED');
        assert.match(completed.workflow.store.state.stage1.completion_fingerprint, /^[a-f0-9]{64}$/);
        assert.equal(completed.workflow.store.audits.length, 1);
        assert.deepEqual(fixture, before);
        const downstream = resolveWeeklyHrWorkflow({ weekRows: fixture, effectiveProfile: profile,
            leave_classification_completed: true });
        assert.deepEqual(downstream.possible_leave_days,
            before.filter((row) => row.kathgoria_adeias_apologistika === 'POSSIBLE_LEAVE')
                .map((row) => row.hmeromhnia));
        assert.equal(completed.period.record.write_fence_version, 10);
        assert.equal(completed.period.record.historical_reconstruction_status, 'COMPLETED');
        assert.equal(completed.period.record.historical_reconstruction_version, 1);
        assert.equal(completed.period.record.historical_dependency_fingerprint, 'a'.repeat(64));
        assert.equal(completed.period.record.active_calculation_id, '');
    }

    const blocked = rows();
    Object.assign(blocked[4], { cards_apo_ora_01: '09:00', cards_eos_ora_01: '',
        cards_ores_ergasias: 0, ores_ergasias_apologistika: 0 });
    await assert.rejects(() => completeInStalePeriod({ weekRows: blocked }),
        (error) => error.code === 'STAGE1_COMPLETION_BLOCKED');

    const changed = rows();
    const changedFresh = structuredClone(changed);
    changedFresh[2].kathgoria_adeias_apologistika = '';
    await assert.rejects(() => completeInStalePeriod({ weekRows: changed,
        freshRows: changedFresh }), (error) => error.code === 'STAGE1_INPUT_CHANGED');
    await assert.rejects(() => completeInStalePeriod({ weekRows: changed,
        freshRows: changedFresh.slice(0, 6) }),
    (error) => ['STAGE1_COMPLETION_BLOCKED', 'STAGE1_INPUT_CHANGED'].includes(error.code));
    await assert.rejects(() => completeInStalePeriod({ weekRows: changed,
        completionScope: { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
            employee_id: employeeId, employee_kodikos: '0014',
            week_start: '2026-06-02', week_end: '2026-06-08' } }),
    (error) => error.code === 'INVALID_WEEK_SCOPE');

    for (const invalidPeriod of [
        periodStore({ status: 'LOCKED' }),
        periodStore({ historical_reconstruction_status: 'AUTHORIZED' }),
        periodStore({ historical_dependency_fingerprint: 'b'.repeat(64) })
    ]) await assert.rejects(() => completeInStalePeriod({ weekRows: rows(),
        period: invalidPeriod }), (error) => ['PERIOD_CONTROL_STATE_CONFLICT',
        'PERIOD_CONTROL_STALE_STAGE1_COMPLETION_NOT_ALLOWED'].includes(error.code));

    console.log('stale historical Stage-1 completion fence tests passed (12 contracts)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
