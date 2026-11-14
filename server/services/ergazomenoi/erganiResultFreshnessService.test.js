'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
mongoose.connect = mongoose.createConnection = () => { throw Error('DATABASE_ACCESS_FORBIDDEN'); };
mongoose.Query.prototype.exec = () => { throw Error('DATABASE_ACCESS_FORBIDDEN'); };
const { assertErganiResultsCurrent, assertErganiScopeCurrent, pendingResultResponse,
    assertErganiRevisionMatches, readErganiSourceRevision } = require('./erganiResultFreshnessService');
const { reviewErrorResponse } = require('./apasxoliseisReviewErrorPresentationService');
const pending = { _id: 'pending', kodikos: '0001', hmeromhnia: new Date('2026-10-01'),
    apologistiko_biblio: false, ores_ergasias_apologistika: 999,
    ergani_pipeline: { cards_pending: false, calculation_pending: true } };
const scope = { team: 'SYNTHETIC', company_kod: '507f1f77bcf86cd799439099', ypokatasthma: '0000',
    period_start: '2026-10-01', period_end: '2026-10-31' };
const query = rows => ({ select() { return this; }, sort() { return this; }, session() { return this; }, lean: async () => rows });

test('downstream guard: legacy/current results remain readable; both pending stages block old values', () => {
    assert.doesNotThrow(() => assertErganiResultsCurrent([{}, { ergani_pipeline: { cards_pending: false, calculation_pending: false } }]));
    for (const cards of [false, true]) {
        assert.throws(() => assertErganiResultsCurrent([{ ...pending, ergani_pipeline: {
            cards_pending: cards, calculation_pending: true } }]), {
            code: cards ? 'ERGANI_CARDS_RECEIPT_REQUIRED' : 'ERGANI_CALCULATION_REQUIRED', statusCode: 409
        });
    }
});

test('downstream guard: a derived filter cannot hide a pending day from a financial scope', async () => {
    let filter;
    await assert.rejects(assertErganiScopeCurrent({ find(value) { filter = value; return query([pending]); } }, {
        ...scope, hmeromhnia: { $gte: new Date('2026-10-01'), $lte: new Date('2026-10-31') },
        apologistiko_biblio: true, kathgoria_ergasias_apologistika: 'ΕΡΓ'
    }), { code: 'ERGANI_CALCULATION_REQUIRED' });
    assert.equal(filter.team, scope.team);
    assert.equal(filter.company_kod, scope.company_kod);
    assert.equal(filter.ypokatasthma, scope.ypokatasthma);
    assert.equal(filter.apologistiko_biblio, undefined);
    assert.equal(filter.kathgoria_ergasias_apologistika, undefined);
    assert.ok(filter.hmeromhnia.$gte instanceof Date);
});

test('downstream guard: visible instructions retain the right sequence without exposing arbitrary error text', () => {
    for (const code of ['ERGANI_CARDS_RECEIPT_REQUIRED', 'ERGANI_CALCULATION_REQUIRED', 'ERGANI_CARDS_REQUIRED_BEFORE_CALCULATION']) {
        const response = reviewErrorResponse({ code, message: 'PRIVATE_MARKER' }, 'UNKNOWN', { readOnly: true });
        assert.equal(response.success, false);
        assert.equal(response.pipelineComplete, false);
        assert.match(response.message, /1\..*2\./);
        assert.match(response.message, /δεν αποθήκευσε καμία αλλαγή/);
        assert.match(response.message, /Δεν χρειάζεται νέα λήψη προδηλωμένων/);
        assert.equal(JSON.stringify(response).includes('PRIVATE_MARKER'), false);
        assert.equal(response.pendingStages[0], code.includes('CARDS') ? 'CARDS' : 'CALCULATION');
    }
    assert.equal(pendingResultResponse({ code: 'ANOTHER_CODE' }), null);
});

for (const name of ['wtoLeaveDatasetService', 'wtoOvertimeDatasetService']) {
    test(`downstream guard: ${name} refuses a submission dataset before using old results`, async () => {
        const service = require('./' + name);
        const load = service.loadWtoLeaveDataset || service.loadWtoOvertimeDataset;
        await assert.rejects(load({ scope, input: { ypokatasthma: '0000', from_date: '2026-10-01', to_date: '2026-10-31' },
            models: { YpokatasthmataModel: { findOne: () => query({ kodikos: '0000' }) },
                ProdhlomenaOrariaModel: { find: () => query([pending]) },
                ErgazomenoiModel: { find: () => assert.fail('old results must not enter the builder') } }
        }), { code: 'ERGANI_CALCULATION_REQUIRED' });
    });
}

test('downstream guard: an accounting report cannot silently omit a pending non-book day', async () => {
    const { buildReport } = require('./apologistikosPinakasControlReportService');
    let reads = 0;
    await assert.rejects(buildReport({ ...scope,
        input: { ypokatasthma: '0000', apo_hmeromhnia: '2026-10-01', eos_hmeromhnia: '2026-10-31' },
        models: { ProdhlomenaOrariaModel: { find(filter) { reads++; assert.equal(filter.apologistiko_biblio, undefined); return query([pending]); } },
            ErgazomenoiModel: { find: () => assert.fail('report must not be built') } }
    }), { code: 'ERGANI_CALCULATION_REQUIRED' });
    assert.equal(reads, 1);
});

test('downstream guard: payroll totals and absences never aggregate pending results', async () => {
    const controller = require('../../controllers/Kinhseis/kinhseisController');
    const Model = require('../../models/ergazomenoi').ProdhlomenaOrariaModel;
    const original = { find: Model.find, aggregate: Model.aggregate, error: console.error };
    try {
        console.error = () => {};
        Model.find = () => query([pending]);
        Model.aggregate = () => assert.fail('pending data cannot be aggregated');
        await assert.rejects(controller.getTotalValues(scope.team, scope.company_kod, '0000', '0001', '2026-10-01', '2026-10-31'),
            { code: 'ERGANI_CALCULATION_REQUIRED' });
        await assert.rejects(controller.getApoysies(scope.team, scope.company_kod, '2026', '0001', '2026-10-01', '2026-10-31', '0000'),
            { code: 'ERGANI_CALCULATION_REQUIRED' });
        Model.find = () => query([]);
        Model.aggregate = async () => [{ synthetic_total: 8 }];
        assert.deepEqual(await controller.getTotalValues(scope.team, scope.company_kod, '0000', '0001', '2026-10-01', '2026-10-31'), { synthetic_total: 8 });
    } finally { Model.find = original.find; Model.aggregate = original.aggregate; console.error = original.error; }
});

test('downstream guard: payroll save refuses cached form totals before writing payroll', async () => {
    const controller = require('../../controllers/Kinhseis/kinhseisController');
    const Model = require('../../models/ergazomenoi').ProdhlomenaOrariaModel;
    const original = Model.find;
    try {
        Model.find = () => query([pending]);
        const response = { status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
        await controller.postApasxolhseisForm({ session: { userTeam: scope.team, companyInUse: scope.company_kod, yearInUse: '2026' },
            body: { filesToUpdate: { enhmeroshApasxolhseon: true }, formData: {
                ypokatasthma_Hidden: '0000', kodikosHidden: '0001', periodos_Hidden: '10', typosApodoxon_Hidden: '01',
                aa_misthodosias_Hidden: '0001', apoHmeromhnia: '2026-10-01', eosHmeromhnia: '2026-10-31'
            } } }, response);
        assert.equal(response.statusCode, 409);
        assert.equal(response.body.code, 'ERGANI_CALCULATION_REQUIRED');
        assert.equal(response.body.pipelineComplete, false);
    } finally { Model.find = original; }
});

test('downstream guard: finalization refuses stale initial and freshly reread results before frozen writes', async () => {
    const { finalizeEmploymentPeriod } = require('./apasxoliseisPeriodLifecycleService');
    const options = { session: { userRole: 'HR', userId: '507f1f77bcf86cd799439011', userName: 'Synthetic' },
        scope, reason: 'Synthetic finalization', requestId: 'synthetic-finalize-guard', indexGuard: async () => {},
        snapshotInput: { dailyResults: [pending] }, transactionRunner: () => assert.fail('must stop before transaction') };
    await assert.rejects(finalizeEmploymentPeriod(options), { code: 'ERGANI_CALCULATION_REQUIRED' });
    await assert.rejects(finalizeEmploymentPeriod({ ...options, snapshotInput: { dailyResults: [{ ...pending, ergani_pipeline: undefined }] },
        transactionRunner: work => work({}), frozenModel: { findOne: () => query(null) },
        periodControlModel: { findOne: () => query({ status: 'LOCKED', active_calculation_id: '', ...scope }) },
        loadFreshSnapshotInput: async () => ({ dailyResults: [pending] })
    }), { code: 'ERGANI_CALCULATION_REQUIRED' });
});

test('cached PDF: changed period fences invalidate old documents even after recalculation clears pending flags', async () => {
    const periods = [{ _id: 'previous-period', write_fence_version: 4, successful_calculation_version: 2, status: 'OPEN' },
        { _id: 'current-period', write_fence_version: 5, successful_calculation_version: 3, status: 'OPEN' }];
    const models = { rowModel: { find: () => query([]) }, periodModel: { find: () => query(periods) } };
    const original = await readErganiSourceRevision(scope, models);
    periods[0].write_fence_version++;
    const changed = await readErganiSourceRevision(scope, models);
    assert.throws(() => assertErganiRevisionMatches(original, changed), { code: 'ERGANI_CACHED_RESULT_STALE' });
    assert.throws(() => assertErganiRevisionMatches(undefined, changed), { code: 'ERGANI_CACHED_RESULT_STALE' });
    assert.doesNotThrow(() => assertErganiRevisionMatches(changed, changed));
    const response = pendingResultResponse({ code: 'ERGANI_CACHED_RESULT_STALE', message: 'PRIVATE_MARKER' });
    assert.deepEqual(response.pendingStages, ['REVIEW']);
    assert.match(response.message, /1\..*2\./);
    assert.equal(response.message.includes('PRIVATE_MARKER'), false);
});

test('cached PDF: finalized snapshots retain their immutable revision independently of live adjacent periods', async () => {
    const models = { rowModel: { find: () => assert.fail('a frozen document must not use current source rows') },
        periodModel: { find: () => query([{ _id: 'frozen', ...scope, status: 'FINALIZED', frozen_snapshot_fingerprint: 'frozen-content' }]) } };
    assert.equal(await readErganiSourceRevision(scope, models), JSON.stringify(['FROZEN', 'frozen-content']));
});
