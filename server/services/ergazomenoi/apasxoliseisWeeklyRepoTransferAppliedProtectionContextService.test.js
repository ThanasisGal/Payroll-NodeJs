'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const test = require('node:test');
const {
    EXECUTION_PROTECTION_FIELDS,
    buildAppliedExecutionQuery,
    loadAppliedRepoTransferProtectionContext
} = require('./apasxoliseisWeeklyRepoTransferAppliedProtectionContextService');

const IDS = Object.freeze({
    execution: '100000000000000000000001',
    decision: '200000000000000000000001',
    employee: '300000000000000000000001',
    source: '400000000000000000000001',
    target: '400000000000000000000002',
    other: '400000000000000000000003'
});

function snapshot(category, repo) {
    return {
        kathgoria_ergasias_apologistika: category,
        repo_apologistika: repo,
        apologistiko_biblio: repo,
        adeia_apologistika: false,
        kathgoria_adeias_apologistika: '',
        ores_apoysias_apologistika: 0,
        apo_ora_01_apologistika: '',
        eos_ora_01_apologistika: '',
        apo_ora_02_apologistika: '',
        eos_ora_02_apologistika: '',
        apo_ora_03_apologistika: '',
        eos_ora_03_apologistika: '',
        ores_ergasias_apologistika: 0,
        ores_pragmatikhs_ergasias_apologistika: 0,
        ores_adeias_pistomenes_apologistika: 0,
        ores_argias_pistomenes_apologistika: 0,
        compensation_breakdown_apologistika: null
    };
}

function execution() {
    return {
        _id: IDS.execution,
        decision_id: IDS.decision,
        decision_fingerprint: 'f'.repeat(64),
        proposal_id: 'proposal-v1',
        source_prodhlomena_oraria_id: IDS.source,
        target_prodhlomena_oraria_id: IDS.target,
        team: 'TEAM',
        company_kod: 'COMPANY',
        ypokatasthma: '0000',
        employee_id: IDS.employee,
        employee_kodikos: 'EMP-001',
        week_start: '2026-06-15T00:00:00.000Z',
        week_end: '2026-06-21T00:00:00.000Z',
        request_id: 'request-1',
        command_identity: 'c'.repeat(64),
        created_by_user_id: IDS.employee,
        created_by_user_name: 'Synthetic Actor',
        created_by_user_role: 'A',
        execution_status: 'APPLIED',
        before_snapshot: {
            source: snapshot('ΑΝ', true),
            target: snapshot('ΕΡΓ', false),
            source_locked: false,
            target_locked: false
        },
        after_snapshot: {
            source: snapshot('ΕΡΓ', false),
            target: snapshot('ΑΝ', true),
            source_locked: false,
            target_locked: false
        },
        applied_at: '2026-06-15T10:00:00.000Z',
        created_at: '2026-06-15T10:00:00.000Z'
    };
}

function scope(ypokatasthma = '0000', loadedRowIds = [IDS.source, IDS.target]) {
    return { team: 'TEAM', company_kod: 'COMPANY', ypokatasthma, loadedRowIds };
}

function fakeModel(rows) {
    const calls = { find: 0, select: 0, lean: 0, query: null, projection: '' };
    return {
        calls,
        find(query) {
            calls.find += 1;
            calls.query = query;
            return {
                select(projection) {
                    calls.select += 1;
                    calls.projection = projection;
                    return {
                        async lean() {
                            calls.lean += 1;
                            return rows;
                        }
                    };
                }
            };
        }
    };
}

test('single-branch query has exact scope, APPLIED status and source/target row clauses', () => {
    assert.deepEqual(buildAppliedExecutionQuery([scope()]), {
        team: 'TEAM',
        company_kod: 'COMPANY',
        execution_status: 'APPLIED',
        ypokatasthma: '0000',
        $or: [
            { source_prodhlomena_oraria_id: { $in: [IDS.source, IDS.target] } },
            { target_prodhlomena_oraria_id: { $in: [IDS.source, IDS.target] } }
        ]
    });
});

test('multi-branch calculation remains one query with exact branch clauses', () => {
    const query = buildAppliedExecutionQuery([
        scope('0000', [IDS.source]),
        scope('0001', [IDS.other])
    ]);
    assert.equal(query.$or.length, 2);
    assert.equal(query.$or[0].ypokatasthma, '0000');
    assert.equal(query.$or[1].ypokatasthma, '0001');
    assert.equal(query.execution_status, 'APPLIED');
});

test('prefetch executes exactly one find/select/lean chain and builds protection', async () => {
    const model = fakeModel([execution()]);
    const result = await loadAppliedRepoTransferProtectionContext({
        scopes: [scope()],
        executionModel: model
    });
    assert.deepEqual(
        { find: model.calls.find, select: model.calls.select, lean: model.calls.lean },
        { find: 1, select: 1, lean: 1 }
    );
    assert.equal(result.entriesByRowId[IDS.source].state, 'PROTECTED');
    assert.equal(result.entriesByRowId[IDS.target].state, 'PROTECTED');
});

test('server-generated row ID operators survive global sanitizeFilter semantics', async () => {
    const model = fakeModel([execution()]);
    await loadAppliedRepoTransferProtectionContext({
        scopes: [scope()],
        executionModel: model
    });
    mongoose.sanitizeFilter(model.calls.query);
    assert.deepEqual(model.calls.query.$or[0].source_prodhlomena_oraria_id.$in, [
        IDS.source,
        IDS.target
    ]);
    assert.deepEqual(model.calls.query.$or[1].target_prodhlomena_oraria_id.$in, [
        IDS.source,
        IDS.target
    ]);
});

test('projection contains every mandatory field consumed by the pure engine', () => {
    for (const field of [
        '_id', 'decision_id', 'decision_fingerprint', 'proposal_id',
        'source_prodhlomena_oraria_id', 'target_prodhlomena_oraria_id',
        'team', 'company_kod', 'ypokatasthma', 'employee_id', 'employee_kodikos',
        'week_start', 'week_end', 'request_id', 'command_identity',
        'created_by_user_id', 'created_by_user_name', 'created_by_user_role',
        'execution_status', 'before_snapshot', 'after_snapshot', 'applied_at', 'created_at'
    ]) {
        assert.ok(EXECUTION_PROTECTION_FIELDS.includes(field), field);
    }
});

test('empty calculation rows avoid even the single query', async () => {
    const model = fakeModel([]);
    const result = await loadAppliedRepoTransferProtectionContext({
        scopes: [],
        executionModel: model
    });
    assert.equal(model.calls.find, 0);
    assert.deepEqual(result.entriesByRowId, {});
});

test('multi-company batch remains one query with exact scoped clauses', async () => {
    const model = fakeModel([]);
    await loadAppliedRepoTransferProtectionContext({
        scopes: [scope(), { ...scope('0001', [IDS.other]), company_kod: 'OTHER' }],
        executionModel: model
    });
    assert.equal(model.calls.find, 1);
    assert.equal(model.calls.query.execution_status, 'APPLIED');
    assert.equal(model.calls.query.$or[0].company_kod, 'COMPANY');
    assert.equal(model.calls.query.$or[1].company_kod, 'OTHER');
});


test('optional session reaches execution query before lean without changing protection', async () => {
    const legacy = fakeModel([execution()]);
    const expected = await loadAppliedRepoTransferProtectionContext({ scopes: [scope()], executionModel: legacy });
    // Legacy fake intentionally has no session method: omission remains valid.
    const suppliedSession = { transaction: true };
    const calls = [];
    const executionModel = { find(query) {
        assert.deepEqual(query, legacy.calls.query);
        return { select(projection) {
            assert.equal(projection, legacy.calls.projection);
            return { session(actual) {
                assert.equal(actual, suppliedSession); calls.push('session');
                return { async lean() { calls.push('lean'); return [execution()]; } };
            } };
        } };
    } };
    const result = await loadAppliedRepoTransferProtectionContext({
        scopes: [scope()], executionModel, session: suppliedSession
    });
    assert.deepEqual(calls, ['session', 'lean']);
    assert.deepEqual(result, expected);
});
