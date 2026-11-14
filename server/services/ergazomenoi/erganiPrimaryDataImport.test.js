'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const mongoose = require('mongoose');
mongoose.connect = mongoose.createConnection = () => { throw Error('DATABASE_ACCESS_FORBIDDEN'); };
mongoose.Query.prototype.exec = () => { throw Error('DATABASE_ACCESS_FORBIDDEN'); };
const controller = require('../../controllers/ergazomenoi/erganhController');
const { importHarness, inputRow, scheduleSheet } = require('../../../test/fixtures/erganiImportTransactionFixture');
const { declaredPipelineState, cardsPipelineState, pendingSourceStage,
    assertCardsReceivedForCalculation, calculatedPipelineState, completeCalculationPipeline } = require('./erganiDataPipelineService');
const { buildWeeklyHrLifecycleProjection } = require('./apasxoliseisWeeklyHrLifecycleProjectionService');
const { runErganiPrimaryDataWrite } = require('./erganiPrimaryDataWriteService');
const schedule = async (h, rows = [inputRow]) => controller.__scheduleDownloadTestHooks.assertErganiImportApplied(
    await controller.__scheduleDownloadTestHooks.saveTelikoToProdhlomena(scheduleSheet(rows), '2026', h.dependencies.authorizedScope, h.dependencies));
const cards = async (h, rows = [inputRow]) => controller.__scheduleDownloadTestHooks.assertErganiImportApplied(
    await controller.__cardsDownloadTestHooks.saveKartesPayloadToMongo(rows, h.dependencies));

test('history-free imports: all declared categories and cards accept dates outside employment without touching History', async () => {
    for (const category of ['ΕΡΓ', 'ΤΗΛ', 'ΜΕ', 'ΑΝ']) {
        const h = importHarness({ kind: 'gap' }), before = h.db.state().history;
        h.db.hooks.read = (_session, kind) => { if (kind === 'history') assert.fail('History must never be read'); };
        await schedule(h, [{ ...inputRow, kathgoria: category }]);
        await cards(h);
        assert.equal(h.rows()[0].kathgoria_ergasias, category);
        assert.equal(h.rows()[0].cards_apo_ora_01, '08:00');
        assert.deepEqual(h.db.state().history, before);
        assert.equal(h.db.events.some(event => event.kind === 'history'), false);
    }
});

test('source preservation: schedule receipt changes no primary cards or calculated results', async () => {
    const row = { ...importHarness().rows()[0], cards_apo_ora_01: '07:55', cards_eos_ora_01: '16:03',
        cards_ores_ergasias: 8.1, apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΕΡΓ',
        ores_nyxtas_apologistika: 2, repo_apologistika: true, compensation_breakdown_apologistika: { saved: true } };
    const h = importHarness({ initialRows: [row] });
    await schedule(h);
    for (const field of Object.keys(row)) assert.deepEqual(h.rows()[0][field], row[field], field);
    assert.deepEqual(h.rows()[0].ergani_pipeline, { cards_pending: true, calculation_pending: true });
});

test('card source preservation: receipt retains declared and calculated values and never truncates a fourth pair', async () => {
    const row = { ...importHarness().rows()[0], kathgoria_ergasias: 'ΤΗΛ', apo_ora_01: '09:00', eos_ora_01: '17:00',
        ores_ergasias: 8, apologistiko_biblio: true, ores_nyxtas_apologistika: 2,
        compensation_breakdown_apologistika: { preserved: true } };
    const h = importHarness({ initialRows: [row] });
    await cards(h);
    for (const field of Object.keys(row)) assert.deepEqual(h.rows()[0][field], row[field], field);
    const before = h.db.state(), saved = h.rows(), writes = h.writes.length;
    const result = await controller.__cardsDownloadTestHooks.saveKartesPayloadToMongo(
        Array.from({ length: 4 }, (_, index) => ({ ...inputRow, apo_ora: `${8 + index}:00`, eos_ora: `${9 + index}:00` })),
        h.dependencies);
    assert.equal(result.bulkOps.length, 0);
    assert.ok(result.diagnostics.some(item => item.code === 'ERGANI_IMPORT_TOO_MANY_CARD_PAIRS'));
    assert.deepEqual(h.db.state(), before);
    assert.deepEqual(h.rows(), saved);
    assert.equal(h.writes.length, writes);
});

test('pipeline: only downstream stages become pending, and identical receipt retains completed stages', () => {
    const row = { kathgoria_ergasias: 'ΕΡΓ', apo_ora_01: '08:00', eos_ora_01: '16:00', ores_ergasias: 8,
        cards_apo_ora_01: '08:00', cards_eos_ora_01: '16:00', cards_ores_ergasias: 8,
        ergani_pipeline: { cards_pending: false, calculation_pending: false } };
    assert.deepEqual(declaredPipelineState(row, row), row.ergani_pipeline);
    const declared = declaredPipelineState(row, { ...row, apo_ora_01: '09:00' });
    assert.equal(pendingSourceStage([{ ...row, ergani_pipeline: declared }]), 'CARDS');
    assert.throws(() => assertCardsReceivedForCalculation([{ ergani_pipeline: declared }]),
        { code: 'ERGANI_CARDS_REQUIRED_BEFORE_CALCULATION' });
    const received = cardsPipelineState({ ...row, ergani_pipeline: declared }, row);
    assert.equal(pendingSourceStage([{ ergani_pipeline: received }]), 'CALCULATION');
    assert.doesNotThrow(() => assertCardsReceivedForCalculation([{ ergani_pipeline: received }]));
    const calculated = calculatedPipelineState({ ergani_pipeline: received });
    assert.equal(pendingSourceStage([{ ergani_pipeline: calculated }]), null);
    assert.deepEqual(cardsPipelineState(row, row), row.ergani_pipeline);
    const changedCards = cardsPipelineState(row, { ...row, cards_eos_ora_01: '17:00' });
    assert.equal(changedCards.cards_pending, false);
    assert.equal(changedCards.calculation_pending, true);
});

test('pipeline: review cannot show final success while cards or calculation are pending', () => {
    for (const state of [{ cards_pending: true, calculation_pending: true },
        { cards_pending: false, calculation_pending: true }]) {
        const projection = buildWeeklyHrLifecycleProjection({ weekRows: [{ ergani_pipeline: state }] });
        assert.equal(projection.requires_hr_action, true);
        assert.equal(projection.stages.stage4.business_status, 'STALE');
        assert.equal(projection.stages.stage4.final_weekly_analysis_available, false);
        assert.equal(projection.stages.stage1.enabled, false);
    }
});

test('technical protection: imports cannot run during an active period calculation', async () => {
    const h = importHarness(), before = h.db.state();
    h.dependencies.workWriteDependencies.periodControlModel.find = () => ({ session() { return this; },
        lean: async () => [{ _id: 'period', status: 'OPEN', active_calculation_id: 'active' }] });
    await assert.rejects(schedule(h), { code: 'EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED' });
    assert.deepEqual(h.db.state(), before);
});

test('technical protection: missing identity cannot acquire an import permission', async () => {
    const h = importHarness(), before = h.db.state();
    await assert.rejects(runErganiPrimaryDataWrite({ ...h.dependencies.workWriteDependencies,
        documents: [{ ...h.fixture.employee, hmeromhnia: '2026-06-01' }], work: () => assert.fail('unsafe write') }),
    { code: 'EMPLOYEE_WORK_WRITE_EMPLOYEE_MISSING' });
    assert.deepEqual(h.db.state(), before);
});

test('pipeline presentation: pending sources never display completed review or request upstream repetition', () => {
    const source = fs.readFileSync(path.join(__dirname,
        '../../../public/js/ergazomenoi/programmata/elegxosApasxolhseonPeriodoy.js'), 'utf8');
    const start = source.indexOf('function employmentReviewAttentionPresentation(');
    const end = source.indexOf('\nfunction ', start + 1);
    const present = vm.runInNewContext('(' + source.slice(start, end) + ')');
    for (const [state, next] of [[{ cards_pending: true, calculation_pending: true }, 'καρτών'],
        [{ cards_pending: false, calculation_pending: true }, 'υπολογισμός']]) {
        const lifecycle = buildWeeklyHrLifecycleProjection({ weekRows: [{ ergani_pipeline: state }] });
        const result = present(lifecycle);
        assert.ok(result.title.includes(next));
        assert.doesNotMatch(result.title, /ολοκληρώθηκε/);
        assert.match(result.detail, /1\..*2\./);
        assert.match(result.detail, /Δεν χρειάζεται νέα λήψη προδηλωμένων/);
        assert.match(result.detail, /Δεν αποθηκεύτηκε αλλαγή/);
    }
});

test('calculation completion: partial acknowledgement preserves pending state and successful completion releases review', async () => {
    const base = { ...importHarness().rows()[0], ergani_pipeline: { cards_pending: false, calculation_pending: true } };
    for (const partial of [true, false]) {
        const h = importHarness({ initialRows: [base] }), before = h.db.state();
        const complete = () => completeCalculationPipeline({ rows: h.rows(), model: {
            bulkWrite: async (operations, options) => {
                const result = await h.dependencies.prodhlomenaModel.bulkWrite(operations, options);
                return partial ? { ...result, matchedCount: 0 } : result;
            }
        }, runTransaction: work => runErganiPrimaryDataWrite({ ...h.dependencies.workWriteDependencies,
            documents: [{ ...h.fixture.employee, employee_id: h.fixture.employee._id,
                employee_afm: inputRow.afm, hmeromhnia: '2026-06-01' }], work: ({ session }) => work(session) }) });
        if (partial) {
            await assert.rejects(complete(), { code: 'ERGANI_CALCULATION_COMPLETION_NOT_APPLIED' });
            assert.deepEqual(h.db.state(), before);
            assert.equal(h.rows()[0].ergani_pipeline.calculation_pending, true);
        } else {
            await complete();
            assert.equal(h.rows()[0].ergani_pipeline.calculation_pending, false);
            assert.equal(h.rows()[0].ergani_pipeline.cards_pending, false);
        }
    }
});
