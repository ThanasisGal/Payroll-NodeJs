'use strict';

const assert = require('assert/strict');
const mongoose = require('mongoose');
const { completeWeeklyHrStage1PeriodSlice } = require(
    './apasxoliseisWeeklyHrWorkflowStage1PeriodSliceCompletionService'
);

const employeeId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const scope = { team: 'THA', company_kod: 'company', ypokatasthma: '0000',
    employee_id: employeeId, employee_kodikos: '0014',
    week_start: new Date('2026-06-29T00:00:00.000Z'),
    week_end: new Date('2026-07-05T00:00:00.000Z') };
const weekRows = Array.from({ length: 7 }, (_, index) => ({
    _id: new mongoose.Types.ObjectId(), employee_id: employeeId, kodikos: '0014',
    hmeromhnia: new Date(Date.UTC(2026, 5, 29 + index)),
    kathgoria_ergasias: 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
    ores_ergasias: index < 2 ? 8 : 0, ores_ergasias_apologistika: 0,
    cards_ores_ergasias: 0, cards_apo_ora_01: '', cards_eos_ora_01: '',
    apo_ora_01: index < 2 ? '11:00' : '', eos_ora_01: index < 2 ? '19:00' : '',
    kathgoria_adeias_apologistika: index === 0 ? 'POSSIBLE_LEAVE' : '',
    adeia_apologistika: false, astheneia_apologistika: false,
    apousia_apologistika: false, repo: false, repo_apologistika: false
}));

let storedState = null;
const audits = [];
function query(value) { return { session() { return this; }, lean: async () => value }; }
const stateModel = {
    findOne: () => query(storedState),
    create: async ([value]) => { storedState = structuredClone(value); },
    updateOne: async (filter, update) => {
        if (!storedState || storedState.stage1.version !== filter['stage1.version']) {
            return { matchedCount: 0 };
        }
        storedState.stage1 = structuredClone(update.$set.stage1);
        return { matchedCount: 1 };
    }
};
const auditModel = {
    findOne: (filter) => query(audits.find((item) => item.team === filter.team &&
        item.company_kod === filter.company_kod && item.request_id === filter.request_id) || null),
    create: async ([value]) => { audits.push(structuredClone(value)); }
};
const common = { scope, weekRows, effectiveProfile: { typos_apasxolhshs: '0',
    hmeres_ergasias_ebdomadas: 5 }, actor: { user_id: String(userId),
    user_name: 'HR User', role: 'HR' }, reason_or_notes: 'Ολοκλήρωση ελέγχου.',
    loadFreshWeekRows: async () => weekRows,
    transactionRunner: async (work) => work({ session: {} }), stateModel, auditModel };

(async () => {
    const juneResult = await completeWeeklyHrStage1PeriodSlice({ ...common,
        period_start: '2026-06-01', period_end: '2026-06-30',
        request_id: 'slice-june-0001' });
    assert.equal(juneResult.completed, true);
    assert.equal(storedState.stage1.period_slices.length, 1);
    const june = storedState.stage1.period_slices[0];
    assert.deepEqual(june.actionable_dates.map((value) => new Date(value).toISOString().slice(0, 10)),
        ['2026-06-29', '2026-06-30']);
    assert.equal(audits[0].action, 'STAGE1_PERIOD_SLICE_COMPLETED');
    assert.equal(audits[0].slice_completion_fingerprint, june.completion_fingerprint);

    const replay = await completeWeeklyHrStage1PeriodSlice({ ...common,
        period_start: '2026-06-01', period_end: '2026-06-30',
        request_id: 'slice-june-0001' });
    assert.equal(replay.idempotent, true);
    assert.equal(audits.length, 1);

    await completeWeeklyHrStage1PeriodSlice({ ...common,
        period_start: '2026-07-01', period_end: '2026-07-31',
        request_id: 'slice-july-0001' });
    assert.equal(storedState.stage1.period_slices.length, 2);
    const persistedJune = storedState.stage1.period_slices.find((item) =>
        new Date(item.period_end).toISOString().slice(0, 10) === '2026-06-30');
    const persistedJuly = storedState.stage1.period_slices.find((item) =>
        new Date(item.period_start).toISOString().slice(0, 10) === '2026-07-01');
    assert.ok(persistedJune);
    assert.ok(persistedJuly);
    assert.notEqual(persistedJune.completion_fingerprint, persistedJuly.completion_fingerprint);
    assert.equal(audits.length, 2);

    const changedRows = structuredClone(weekRows);
    changedRows[0].apo_ora_01 = '12:00';
    await assert.rejects(completeWeeklyHrStage1PeriodSlice({ ...common,
        period_start: '2026-06-01', period_end: '2026-06-30',
        request_id: 'slice-june-0002', loadFreshWeekRows: async () => changedRows }),
    { code: 'STAGE1_INPUT_CHANGED' });
    assert.equal(audits.length, 2);

    storedState = null;
    audits.length = 0;
    const januaryScope = { ...scope,
        week_start: new Date('2025-12-29T00:00:00.000Z'),
        week_end: new Date('2026-01-04T00:00:00.000Z') };
    const januaryRows = Array.from({ length: 7 }, (_, index) => ({
        ...weekRows[index],
        _id: new mongoose.Types.ObjectId(),
        hmeromhnia: new Date(Date.UTC(2025, 11, 29 + index)),
        kathgoria_adeias_apologistika: index === 6 ? 'POSSIBLE_LEAVE' : ''
    }));
    const januaryResult = await completeWeeklyHrStage1PeriodSlice({ ...common,
        scope: januaryScope, weekRows: januaryRows,
        period_start: '2026-01-01', period_end: '2026-01-31',
        employment_date_scope: {
            authoritative_date_set: ['2026-01-01', '2026-01-02',
                '2026-01-03', '2026-01-04'],
            context_only_dates: ['2025-12-29', '2025-12-30', '2025-12-31']
        },
        request_id: 'slice-january-boundary-0001',
        loadFreshWeekRows: async () => januaryRows });
    assert.equal(januaryResult.completed, true);
    assert.deepEqual(storedState.stage1.period_slices[0].actionable_dates
        .map((value) => new Date(value).toISOString().slice(0, 10)),
    ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
    assert.ok(!storedState.stage1.period_slices[0].actionable_dates
        .some((value) => new Date(value).toISOString().slice(0, 10) < '2026-01-01'));
    console.log('Stage-1 period-slice completion tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
