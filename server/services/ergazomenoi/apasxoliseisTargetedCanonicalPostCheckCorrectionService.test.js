'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
mongoose.connect = mongoose.createConnection = () => { throw new Error('REAL_DB_FORBIDDEN'); };
const { buildTargetedCanonicalPostCheckCorrectionPlan: build,
    persistTargetedCanonicalPostCheckCorrection: persist } =
    require('./apasxoliseisTargetedCanonicalPostCheckCorrectionService');
const { runWithPeriodWriteFence } = require('./apasxoliseisPeriodControlService');
const { buildWeeklyRepoPostCheckWritePlan } = require('./apasxoliseisWeeklyPostCheckWritePlanService');
const { buildDailyCompensationBreakdown } = require('./apasxoliseisDailyCompensationBreakdownService');
const { ProdhlomenaOrariaModel } = require('../../models/ergazomenoi');

// Same test-only access pattern as the existing seventh-day overlay regression:
// compile unmodified controller logic in memory; never invoke a controller action.
const filename = path.resolve(__dirname, '../../controllers/ergazomenoi/erganhController.js');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const originalRequire = loaded.require.bind(loaded);
loaded.require = (request) => request === '../../config/aws' ? { s3Client: {} } : originalRequire(request);
loaded._compile(fs.readFileSync(filename, 'utf8') +
    '\nmodule.exports.__targetedTestMapper = buildWeeklyIllegalOvertimeUpdate;', filename);
const mapper = loaded.exports.__targetedTestMapper;
const copy = (value) => {
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof mongoose.Types.ObjectId) return new mongoose.Types.ObjectId(value.toHexString());
    if (Array.isArray(value)) return value.map(copy);
    if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, copy(item)]));
    return value;
};
function matches(row, filter) {
    return Object.entries(filter).every(([path, condition]) => {
        if (path === '$and') return condition.every((clause) => matches(row, clause));
        let value = row; let present = true;
        for (const key of path.split('.')) {
            if (value == null || !Object.hasOwn(value, key)) { present = false; value = undefined; break; }
            value = value[key];
        }
        if (condition && Object.getPrototypeOf(condition) === Object.prototype &&
            Object.keys(condition).some((key) => key.startsWith('$'))) {
            return Object.entries(condition).every(([op, expected]) => {
                if (op === '$exists') return present === expected;
                if (op === '$eq') return require('node:util').isDeepStrictEqual(value, expected);
                if (op === '$size') return Array.isArray(value) && value.length === expected;
                if (op === '$type') return expected === 'array' ? Array.isArray(value)
                    : value !== null && typeof value === 'object' && !Array.isArray(value);
                assert.fail(`Unexpected predicate: ${op}`);
            });
        }
        return require('node:util').isDeepStrictEqual(value, condition);
    });
}
const targetId = '6a92b46e5de956f225bd3a4f';
const scope = { team: 'THA', company_kod: '69e8e92fb198b803164b824a', ypokatasthma: '0000',
    period_start: new Date('2026-04-01'), period_end: new Date('2026-04-30') };
const contextFingerprint = 'a'.repeat(64);
const zeroBuckets = Object.fromEntries(['yperergasias', 'nominhs_yperorias', 'paranomhs_yperorias']
    .flatMap((kind) => ['', '_nyxtas', '_argion', '_argion_nyxtas']
        .map((suffix) => [`ores_${kind}${suffix}_apologistika`, 0])));

function fixture() {
    const employee = { kodikos: '0031', ypokatasthma: '0000', hmeres_ergasias_ebdomadas: 6,
        ores_ergasias_ebdomadas: 40, mo_oron_hmerhsias_ergasias: 6.67,
        typos_apasxolhshs: '0', typos_ergazomenon: 'Μ',
        nomimoOromisthio: 6.072, pragmatikoOromisthio: 7.176 };
    const weeklyContextRows = Array.from({ length: 7 }, (_, index) => {
        const date = new Date('2026-03-30'); date.setUTCDate(date.getUTCDate() + index);
        const seventh = index === 6;
        return { _id: seventh ? new mongoose.Types.ObjectId(targetId)
            : new mongoose.Types.ObjectId(String(index + 1).padStart(24, '0')),
        team: scope.team, company_kod: scope.company_kod, ypokatasthma: '0000', kodikos: '0031',
        hmeromhnia: date, __v: 0, is_locked: false, repo: seventh,
        kathgoria_ergasias: seventh ? 'ΑΝ' : 'ΕΡΓ', kathgoria_ergasias_apologistika: 'ΕΡΓ',
        repo_apologistika: false, apologistiko_biblio: true,
        ores_ergasias: seventh ? 0 : 6.67, ores_ergasias_apologistika: seventh ? 4.98 : 6.67,
        ores_pragmatikhs_ergasias_apologistika: seventh ? 4.98 : 6.67,
        cards_ores_ergasias: seventh ? 5.483333333333333 : 6.67,
        cards_apo_ora_01: '12:30', cards_eos_ora_01: seventh ? '17:59' : '19:10',
        cards_apo_ora_02: '', cards_eos_ora_02: '', cards_apo_ora_03: '', cards_eos_ora_03: '',
        apo_ora_01_apologistika: '12:30', eos_ora_01_apologistika: '19:10',
        apo_ora_02_apologistika: '', eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '', eos_ora_03_apologistika: '',
        argia: false, kyriakes_apologistika: seventh, adeia: false, astheneia: false,
        ores_argion_ergasia_apologistika: seventh ? 5.48 : 0,
        ores_argion_prosayxhsh_apologistika: 0, ores_nyxtas_apologistika: 0,
        ores_adeias_pistomenes_apologistika: 0, ores_argias_pistomenes_apologistika: 0,
        ...zeroBuckets };
    });
    const storedRow = weeklyContextRows[6];
    storedRow.compensation_breakdown_apologistika = buildDailyCompensationBreakdown({
        row: storedRow, paidHourlyRate: employee.pragmatikoOromisthio,
        legalHourlyRate: employee.nomimoOromisthio, calculatedWorkHoursAuthoritative: true });
    const canonicalWritePlan = buildWeeklyRepoPostCheckWritePlan({
        sessionTeam: scope.team, companyId: scope.company_kod,
        apoDate: scope.period_start, eosDate: new Date('2026-04-05T23:59:59.999Z'),
        employees: [employee], rows: [storedRow], weeklyContextRows,
        appliedProtectionContext: { entriesByRowId: {} },
        buildWeeklyIllegalOvertimeUpdate: mapper });
    return { target: { _id: storedRow._id, team: scope.team, company_kod: scope.company_kod,
        ypokatasthma: '0000', kodikos: '0031', hmeromhnia: storedRow.hmeromhnia },
    storedRow, canonicalWritePlan: copy(canonicalWritePlan), periodScope: scope,
    expectedPeriodToken: { exists: true, stored_status: 'OPEN', version: 3 },
    expectedWriteFenceVersion: 6, expectedContextFingerprint: contextFingerprint };
}

function harness(input = fixture()) {
    const initial = { rows: [copy(input.storedRow), { _id: 'unrelated-106-sentinel', value: 106 }],
        period: { ...scope, status: 'OPEN', version: 3, write_fence_version: 6 }, audits: [] };
    const state = copy(initial);
    const calls = { reads: [], rows: [], audits: [], period: [], context: 0, transactions: 0 };
    const session = { fakeTransaction: true };
    const options = { staleRow: false, rowFailure: false, auditFailure: false,
        context: contextFingerprint };
    const forbidden = () => assert.fail('period-wide or unrelated persistence invoked');
    const rowModel = { bulkWrite: forbidden, updateMany: forbidden, deleteMany: forbidden,
        insertMany: forbidden,
        findOne(filter) {
            calls.reads.push(filter);
            return { session(received) {
                assert.equal(received, session);
                return { lean: async () => copy(state.rows.find((row) => matches(row, filter)) || null) };
            } };
        },
        async updateOne(filter, update, opts) {
            assert.equal(opts.session, session);
            calls.rows.push({ filter, update });
            if (options.rowFailure) throw new Error('row failure');
            if (options.staleRow || !matches(state.rows[0], filter)) return { matchedCount: 0 };
            Object.assign(state.rows[0], copy(update.$set));
            return { matchedCount: 1, modifiedCount: 1 };
        } };
    const auditModel = { async create(records, opts) {
        assert.equal(opts.session, session); calls.audits.push(records);
        if (options.auditFailure) throw new Error('audit failure');
        state.audits.push(...copy(records));
    } };
    const periodControlModel = { async findOneAndUpdate(filter, update, opts) {
        assert.equal(opts.session, session); calls.period.push({ filter, update });
        for (const key of ['status', 'version', 'write_fence_version']) {
            if (Object.hasOwn(filter, key) && state.period[key] !== filter[key]) return null;
        }
        state.period.write_fence_version += update.$inc.write_fence_version;
        Object.assign(state.period, update.$set);
        return copy(state.period);
    } };
    const transactionRunner = async (work) => {
        calls.transactions++;
        const before = copy(state);
        try { return await work(session); }
        catch (error) { Object.assign(state, before); throw error; }
    };
    const periodFence = (args) => runWithPeriodWriteFence({ ...args,
        now: new Date('2026-04-06'), periodControlModel, indexGuard: async () => {}, transactionRunner });
    const dependencies = { rowModel, auditModel, periodFence,
        resolveCurrentContextFingerprint: async (args) => {
            assert.equal(args.session, session); calls.context++;
            assert.equal(args.target._id, targetId);
            return options.context;
        } };
    return { state, initial, calls, options, dependencies, periodFence,
        run: (plan = build(input)) => persist({ plan, changedBy: 'reviewer', reason: 'canonical correction',
            ...dependencies }) };
}

test('real canonical one-row regression: two fields, attendance preserved, blocking status preserved', () => {
    const input = fixture(); const before = copy(input);
    assert.equal(input.canonicalWritePlan.bulkOps.length, 1);
    const plan = build(input);
    assert.equal(plan.target._id, targetId);
    assert.equal(plan.changedFieldCount, 2);
    assert.deepEqual(Object.keys(plan.minimalCanonicalDiff).sort(),
        ['compensation_breakdown_apologistika', 'ores_paranomhs_yperorias_argion_apologistika']);
    assert.equal(plan.minimalCanonicalDiff.ores_paranomhs_yperorias_argion_apologistika, 4.98);
    const breakdown = plan.minimalCanonicalDiff.compensation_breakdown_apologistika;
    assert.equal(breakdown.hours.illegalOvertimeHours, 4.98);
    assert.equal(breakdown.components.find((x) => x.code === 'ILLEGAL_OVERTIME_PREMIUM').hours, 4.98);
    assert.equal(breakdown.components.find((x) => x.code === 'ILLEGAL_OVERTIME_PREMIUM').premiumAmount, 42.88);
    assert.equal(breakdown.status, 'NEEDS_HR_DECISION');
    assert.deepEqual(breakdown.reasons, ['HOLIDAYWORKHOURS_EXCEEDS_ACTUAL_WORK']);
    assert.equal(breakdown.amounts.grossWorkAmount, null);
    assert.deepEqual(input, before);
});

const invalidCases = {
    'zero operations': (x) => { x.canonicalWritePlan.bulkOps = []; },
    'two operations': (x) => { x.canonicalWritePlan.bulkOps.push(x.canonicalWritePlan.bulkOps[0]); },
    'wrong target id': (x) => { x.canonicalWritePlan.bulkOps[0].updateOne.filter._id = '0'.repeat(24); },
    'upsert': (x) => { x.canonicalWritePlan.bulkOps[0].updateOne.upsert = true; },
    'updateMany': (x) => { x.canonicalWritePlan.bulkOps = [{ updateMany: {} }]; },
    'replaceOne': (x) => { x.canonicalWritePlan.bulkOps = [{ replaceOne: {} }]; },
    'deleteOne': (x) => { x.canonicalWritePlan.bulkOps = [{ deleteOne: {} }]; },
    'deleteMany': (x) => { x.canonicalWritePlan.bulkOps = [{ deleteMany: {} }]; },
    'insertOne': (x) => { x.canonicalWritePlan.bulkOps = [{ insertOne: {} }]; },
    'pipeline': (x) => { x.canonicalWritePlan.bulkOps[0].updateOne.update = []; },
    'extra filter operator': (x) => { x.canonicalWritePlan.bulkOps[0].updateOne.filter.$or = []; },
    'invalid filter date': (x) => { x.canonicalWritePlan.bulkOps[0].updateOne.filter.hmeromhnia = 'invalid'; },
    'missing context token': (x) => { delete x.expectedContextFingerprint; },
    'missing period version': (x) => { delete x.expectedPeriodToken.version; },
    'missing fence version': (x) => { delete x.expectedWriteFenceVersion; },
    'missing row version': (x) => { delete x.storedRow.__v; },
    'locked row': (x) => { x.storedRow.is_locked = true; },
    'wrong period branch': (x) => { x.periodScope = { ...scope, ypokatasthma: '0001' }; },
    'out of period': (x) => { x.periodScope = { ...scope, period_end: new Date('2026-04-04') }; },
    'missing breakdown': (x) => { delete x.canonicalWritePlan.bulkOps[0].updateOne.update.$set.compensation_breakdown_apologistika; }
};
for (const key of ['team', 'company_kod', 'ypokatasthma', 'kodikos', 'hmeromhnia']) {
    invalidCases[`wrong business key ${key}`] = (x) => { x.target[key] = key === 'hmeromhnia' ? new Date('2026-04-04') : 'wrong'; };
    invalidCases[`wrong filter business key ${key}`] = (x) => { x.canonicalWritePlan.bulkOps[0].updateOne.filter[key] = key === 'hmeromhnia' ? new Date('2026-04-04') : 'wrong'; };
}
for (const op of ['$unset', '$rename', '$inc']) invalidCases[op] = (x) => {
    x.canonicalWritePlan.bulkOps[0].updateOne.update[op] = { bad: 1 };
};
for (const key of ['_id', 'team', 'company_kod', 'ypokatasthma', 'kodikos', 'hmeromhnia', '__v',
    'cards_apo_ora_01', 'cards_ores_ergasias', 'is_locked', 'locked_by', 'locked_at',
    'orphan_card_resolution', 'review_metadata', 'seventh_day_classification']) {
    invalidCases[`protected ${key}`] = (x) => { x.canonicalWritePlan.bulkOps[0].updateOne.update.$set[key] = 'bad'; };
}
for (const [name, mutate] of Object.entries(invalidCases)) test(`reject ${name}`, () => {
    const input = fixture(); mutate(input);
    assert.throws(() => build(input), { statusCode: 409 });
});

test('one minimal write + one audit, full identity/CAS, no lock or other rows; real mongoose casts filter offline', async () => {
    const h = harness(); const out = await h.run();
    assert.equal(out.updated, true);
    assert.equal(h.calls.rows.length, 1); assert.equal(h.calls.audits.length, 1);
    assert.equal(h.calls.context, 1);
    const { filter, update } = h.calls.rows[0];
    for (const key of ['_id', 'team', 'company_kod', 'ypokatasthma', 'kodikos', 'hmeromhnia', '__v']) {
        assert.deepEqual(filter[key], h.initial.rows[0][key]);
    }
    assert.equal(h.calls.reads.length, 1);
    assert.deepEqual(Object.keys(h.calls.reads[0]).sort(),
        ['_id', 'team', 'company_kod', 'ypokatasthma', 'kodikos', 'hmeromhnia'].sort());
    assert.equal(Object.hasOwn(filter, '$expr'), false);
    assert.doesNotMatch(JSON.stringify(filter), /\$\$ROOT|\$literal/);
    assert.equal(matches(h.initial.rows[0], filter), true);
    const modified = copy(h.initial.rows[0]);
    modified.ores_paranomhs_yperorias_argion_apologistika = 1;
    assert.equal(matches(modified, filter), false);
    assert.doesNotThrow(() => ProdhlomenaOrariaModel.updateOne(filter, update).cast(ProdhlomenaOrariaModel));
    assert.deepEqual(Object.keys(update), ['$set']); assert.equal(Object.keys(update.$set).length, 2);
    assert.deepEqual(h.state.rows[1], h.initial.rows[1]);
    for (const key of Object.keys(h.initial.rows[0]).filter((k) => !Object.hasOwn(update.$set, k))) {
        assert.deepEqual(h.state.rows[0][key], h.initial.rows[0][key], key);
    }
    assert.equal(h.state.rows[0].is_locked, false);
    assert.deepEqual(Object.keys(h.state.audits[0].oldValues).sort(), Object.keys(update.$set).sort());
    assert.deepEqual(Object.keys(h.state.audits[0].newValues).sort(), Object.keys(update.$set).sort());
    assert.equal(h.state.audits[0].oldValues.ores_paranomhs_yperorias_argion_apologistika, 0);
    assert.equal(h.state.period.write_fence_version, 7);
    assert.equal(h.state.period.version, 3); assert.equal(h.state.period.status, 'OPEN');
});

for (const [name, change, code] of [
    ['row mismatch', (h) => { h.options.staleRow = true; }, 'TARGETED_CANONICAL_ROW_STALE'],
    ['added row field', (h) => { h.state.rows[0].new_metadata = true; }, 'TARGETED_CANONICAL_ROW_STALE'],
    ['changed cards', (h) => { h.state.rows[0].cards_eos_ora_01 = '18:00'; }, 'TARGETED_CANONICAL_ROW_STALE'],
    ['removed field', (h) => { delete h.state.rows[0].argia; }, 'TARGETED_CANONICAL_ROW_STALE'],
    ['changed row version', (h) => { h.state.rows[0].__v++; }, 'TARGETED_CANONICAL_ROW_STALE'],
    ['period version', (h) => { h.state.period.version++; }, 'PERIOD_CONTROL_STATE_CONFLICT'],
    ['write fence version', (h) => { h.state.period.write_fence_version++; }, 'PERIOD_CONTROL_STATE_CONFLICT'],
    ['closed period', (h) => { h.state.period.status = 'LOCKED'; }, 'PERIOD_CONTROL_STATE_CONFLICT'],
    ['context fingerprint', (h) => { h.options.context = 'b'.repeat(64); }, 'TARGETED_CANONICAL_CONTEXT_STALE']
]) test(`stale ${name} aborts atomically`, async () => {
    const h = harness(); change(h); const before = copy(h.state);
    await assert.rejects(() => h.run(), { code, statusCode: 409 });
    assert.deepEqual(h.state, before); assert.equal(h.calls.audits.length, 0);
});

for (const failure of ['rowFailure', 'auditFailure']) test(`${failure} rolls back row, audit and fence`, async () => {
    const h = harness(); h.options[failure] = true;
    await assert.rejects(() => h.run(), /failure/);
    assert.deepEqual(h.state, h.initial);
    if (failure === 'rowFailure') assert.equal(h.calls.audits.length, 0);
});

test('no diff is read-only/idempotent, including no period or audit write', async () => {
    const input = fixture(); Object.assign(input.storedRow, copy(input.canonicalWritePlan.bulkOps[0].updateOne.update.$set));
    const h = harness(input); const result = await h.run();
    assert.deepEqual(result, { updated: false, idempotent: true });
    assert.equal(h.calls.transactions, 0); assert.equal(h.calls.rows.length, 0); assert.equal(h.calls.audits.length, 0);
});

test('private plan snapshot resists input mutation and rejects unissued plans/missing resolver', async () => {
    const input = fixture(); const plan = build(input); const h = harness(input);
    input.storedRow.cards_eos_ora_01 = '00:00';
    input.canonicalWritePlan.bulkOps[0].updateOne.update.$set.ores_paranomhs_yperorias_argion_apologistika = 999;
    plan.periodScope.period_start.setUTCFullYear(2000);
    await h.run(plan);
    assert.equal(h.state.rows[0].ores_paranomhs_yperorias_argion_apologistika, 4.98);
    await assert.rejects(() => h.run({ ...plan }), { statusCode: 409 });
    await assert.rejects(() => persist({ plan, changedBy: 'x', reason: 'x' }), { statusCode: 409 });
});

test('optional period fence CAS leaves legacy callers unchanged', async () => {
    const h = harness(); h.state.period.write_fence_version = 20;
    await h.periodFence({ scope, expectedToken: { exists: true, stored_status: 'OPEN', version: 3 },
        work: async () => 'legacy' });
    assert.equal(Object.hasOwn(h.calls.period[0].filter, 'write_fence_version'), false);
    assert.equal(h.state.period.write_fence_version, 21);
    const strict = harness(); await strict.run();
    assert.equal(strict.calls.period[0].filter.write_fence_version, 6);
    assert.equal(strict.calls.period[0].filter.version, 3);
    const legacyWithoutToken = harness();
    await legacyWithoutToken.periodFence({ scope, work: async () => 'legacy' });
    assert.equal(Object.hasOwn(legacyWithoutToken.calls.period[0].filter, 'version'), false);
    assert.equal(Object.hasOwn(legacyWithoutToken.calls.period[0].filter, 'write_fence_version'), false);
});

test('context resolver error aborts and rolls back the period fence before any row/audit write', async () => {
    const h = harness();
    await assert.rejects(() => persist({ plan: build(fixture()), changedBy: 'reviewer', reason: 'correction',
        ...h.dependencies, resolveCurrentContextFingerprint: async () => { throw new Error('context read failed'); } }),
    /context read failed/);
    assert.deepEqual(h.state, h.initial);
    assert.equal(h.calls.rows.length, 0); assert.equal(h.calls.audits.length, 0);
});

test('strict period fence token requires an existing OPEN versioned period', async () => {
    for (const expectedToken of [null, { exists: false },
        { exists: true, stored_status: 'LOCKED', version: 3 },
        { exists: true, stored_status: 'OPEN' }]) {
        const h = harness();
        await assert.rejects(() => h.periodFence({ scope, expectedToken, expectedWriteFenceVersion: 6,
            work: async () => assert.fail('work called') }),
        { code: 'PERIOD_CONTROL_INVALID_WRITE_FENCE_TOKEN' });
        assert.equal(h.calls.period.length, 0);
    }
});

for (const value of [null, -1, 1.5, '6']) test(`invalid optional fence token ${value} is rejected before write`, async () => {
    const h = harness();
    await assert.rejects(() => h.periodFence({ scope,
        expectedToken: { exists: true, stored_status: 'OPEN', version: 3 },
        expectedWriteFenceVersion: value, work: async () => assert.fail('work called') }),
    { code: 'PERIOD_CONTROL_INVALID_WRITE_FENCE_TOKEN' });
    assert.equal(h.calls.period.length, 0);
});

test('targeted service has no period-wide/deviations/reconstruction dependency or entry point', () => {
    const source = fs.readFileSync(path.join(__dirname, 'apasxoliseisTargetedCanonicalPostCheckCorrectionService.js'), 'utf8');
    assert.doesNotMatch(source, /runWeeklyRepoPostCheck|ProdhlomenaOrariaDeviationsModel|\.bulkWrite\(|\.deleteMany\(|\.insertMany\(|\.updateMany\(|finalizeEmploymentPeriod|saveCorrectiveResult/);
});


test('snapshot preserves ObjectId, Date and own undefined; key ordering is semantic', async () => {
    const input = fixture();
    input.storedRow.metadata = { stamp: new Date('2026-04-01'),
        id: new mongoose.Types.ObjectId(targetId), absentValue: undefined, nullValue: null,
        nested: { first: 1, second: 2 } };
    const h = harness(input); const plan = build(input);
    h.state.rows[0].metadata.nested = { second: 2, first: 1 };
    input.storedRow.metadata.stamp.setFullYear(2000);
    input.storedRow.metadata.id.id[0] = 0;
    input.storedRow.metadata.absentValue = null;
    await h.run(plan);
    assert.equal(Object.hasOwn(h.state.rows[0].metadata, 'absentValue'), true);
    assert.equal(h.state.rows[0].metadata.absentValue, undefined);
    assert.equal(h.state.rows[0].metadata.nullValue, null);
});

for (const [name, value] of [
    ['Long', mongoose.mongo.BSON.Long.fromString('9007199254740993')],
    ['Decimal128', mongoose.mongo.BSON.Decimal128.fromString('1.25')],
    ['Binary', new mongoose.mongo.BSON.Binary(Buffer.from('test'))],
    ['Timestamp', mongoose.mongo.BSON.Timestamp.fromNumber(1)],
    ['unexpected prototype', new Map()], ['nonfinite', Infinity]
]) test(`reject unsupported snapshot ${name} before issuing plan`, () => {
    const input = fixture(); input.storedRow.metadata = value;
    assert.throws(() => build(input), { code: 'TARGETED_CANONICAL_SNAPSHOT_UNSUPPORTED_TYPE', statusCode: 409 });
});

for (const [name, initial, mutate] of [
    ['missing to null', {}, (row) => { row.extra = null; }],
    ['missing to undefined', {}, (row) => { row.extra = undefined; }],
    ['undefined to missing', { extra: undefined }, (row) => { delete row.extra; }],
    ['undefined to null', { extra: undefined }, (row) => { row.extra = null; }],
    ['null to missing', { extra: null }, (row) => { delete row.extra; }],
    ['array reorder', { extra: [1, 2] }, (row) => { row.extra.reverse(); }],
    ['date change', { extra: new Date('2026-04-01') }, (row) => { row.extra.setUTCDate(2); }],
    ['ObjectId change', { extra: new mongoose.Types.ObjectId(targetId) }, (row) => { row.extra = new mongoose.Types.ObjectId(); }],
    ['source bucket change', {}, (row) => { row.ores_paranomhs_yperorias_argion_apologistika = 1; }]
]) test(`transaction reread detects ${name} before update/audit`, async () => {
    const input = fixture(); Object.assign(input.storedRow, initial);
    const h = harness(input); const plan = build(input); mutate(h.state.rows[0]);
    const before = copy(h.state);
    await assert.rejects(() => h.run(plan), { code: 'TARGETED_CANONICAL_ROW_STALE' });
    assert.equal(h.calls.rows.length, 0); assert.equal(h.calls.audits.length, 0);
    assert.deepEqual(h.state, before);
});

test('target missing aborts before update or audit', async () => {
    const h = harness(); h.state.rows.shift();
    await assert.rejects(() => h.run(), { code: 'TARGETED_CANONICAL_ROW_STALE' });
    assert.equal(h.calls.rows.length, 0); assert.equal(h.calls.audits.length, 0);
});

for (const oldKind of ['null', 'missing']) test(`audit and CAS preserve ${oldKind} old canonical field`, async () => {
    const input = fixture(); const key = 'ores_paranomhs_yperorias_argion_apologistika';
    if (oldKind === 'null') input.storedRow[key] = null;
    else delete input.storedRow[key];
    const h = harness(input); await h.run();
    const audit = h.state.audits[0];
    assert.equal(Object.hasOwn(audit.oldValues, key), oldKind === 'null');
    if (oldKind === 'null') assert.equal(audit.oldValues[key], null);
    assert.equal(audit.newValues[key], 4.98);
    assert.deepEqual(Object.keys(audit.newValues).sort(),
        ['compensation_breakdown_apologistika', key]);
    const changedPresence = copy(h.initial.rows[0]);
    if (oldKind === 'null') delete changedPresence[key]; else changedPresence[key] = null;
    assert.equal(matches(changedPresence, h.calls.rows[0].filter), false);
});

test('own undefined in a changed audit value fails closed; never serializes as null/missing', () => {
    const input = fixture(); input.storedRow.ores_paranomhs_yperorias_argion_apologistika = undefined;
    assert.throws(() => build(input), { code: 'TARGETED_CANONICAL_AUDIT_UNREPRESENTABLE_VALUE' });
});

test('unsupported newly added BSON value is a stale row, before update', async () => {
    const h = harness(); h.state.rows[0].metadata = mongoose.mongo.BSON.Long.fromNumber(1);
    await assert.rejects(() => h.run(), { code: 'TARGETED_CANONICAL_ROW_STALE' });
    assert.equal(h.calls.rows.length, 0); assert.equal(h.calls.audits.length, 0);
});

test('empty object in a changed audit value fails closed against schema minimization', () => {
    const input = fixture(); input.storedRow.compensation_breakdown_apologistika = {};
    assert.throws(() => build(input), { code: 'TARGETED_CANONICAL_AUDIT_UNREPRESENTABLE_VALUE' });
});

test('cyclic and accessor snapshots are explicitly rejected', () => {
    const cyclic = fixture(); cyclic.storedRow.extra = cyclic.storedRow;
    assert.throws(() => build(cyclic), { code: 'TARGETED_CANONICAL_SNAPSHOT_UNSUPPORTED_TYPE' });
    const accessor = fixture();
    Object.defineProperty(accessor.storedRow, 'extra', { enumerable: true, get() { assert.fail('getter invoked'); } });
    assert.throws(() => build(accessor), { code: 'TARGETED_CANONICAL_SNAPSHOT_UNSUPPORTED_TYPE' });
});
