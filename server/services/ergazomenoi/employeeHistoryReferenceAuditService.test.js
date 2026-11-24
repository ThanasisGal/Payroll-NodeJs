'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { REFERENCE_QUERIES, findHistoryIdReferences } =
    require('./employeeHistoryReferenceAuditService');
const { findHistoryIdReferenceSummary } = require('./employeeHistoryReferenceAuditService');

function valuesAt(value, segments) {
    if (Array.isArray(value)) return value.flatMap(item => valuesAt(item, segments));
    if (!segments.length) return [value];
    if (value === null || value === undefined) return [];
    return valuesAt(value[segments[0]], segments.slice(1));
}

function matchingConnection(documentsByCollection) {
    return { collection(name) { return { async findOne(query) {
        return (documentsByCollection[name] || []).find(document => query.$or.some(clause => {
            const [path, condition] = Object.entries(clause)[0];
            return valuesAt(document, path.split('.')).some(value =>
                condition.$in.map(String).includes(String(value)));
        })) || null;
    } }; } };
}

test('repository reference audit covers direct and immutable snapshot stores', () => {
    const collections = new Set(REFERENCE_QUERIES.map(([name]) => name));
    assert.ok(collections.has('Prodhlomena_Oraria_Deviations'));
    assert.ok(collections.has('Oraria_Apologistika'));
    assert.ok(collections.has('Apasxoliseis_Period_Frozen_Snapshots'));
    assert.ok(collections.has('Apasxoliseis_Weekly_Canonical_Decisions'));
    assert.ok(collections.has('Apasxoliseis_Weekly_Repo_Transfer_Decisions'));
});

test('specific external reference is reported without any write', async () => {
    const visited = [];
    const connection = { collection(name) { return { async findOne(query, options) {
        visited.push({ name, query, options });
        return name === 'Prodhlomena_Oraria_Deviations' ? { _id: 'reference-1' } : null;
    } }; } };
    const session = { id: 'session' };
    const references = await findHistoryIdReferences({ connection,
        historyIds: ['507f1f77bcf86cd799439011'], session });
    assert.deepEqual(references, [{ collection: 'Prodhlomena_Oraria_Deviations',
        documentId: 'reference-1' }]);
    assert.equal(visited.length, REFERENCE_QUERIES.length);
    assert.equal(visited[0].options.session, session);
});

test('audit queries match every current persisted weekly decision path', async () => {
    const id = '507f1f77bcf86cd799439011';
    const cases = [
        ['Apasxoliseis_Weekly_Canonical_Decisions',
            { canonical_snapshot: { profile_history: [{ _id: id }] } }],
        ['Apasxoliseis_Weekly_Canonical_Decisions',
            { canonical_snapshot: { effective_profile: { istorikoId: id } } }],
        ['Apasxoliseis_Weekly_Repo_Transfer_Decisions',
            { canonical_snapshot: { employment_profile: { profile_istoriko_id: id } } }],
        ['Apasxoliseis_Weekly_Repo_Transfer_Decisions',
            { canonical_snapshot: { employment_profile: { history: [{ id }] } } }],
        ['Apasxoliseis_Weekly_Repo_Transfer_Decisions',
            { canonical_snapshot: { full_week_context: [
                { effective_profile_istoriko_id: id }
            ] } }]
    ];
    for (const [index, [collection, document]] of cases.entries()) {
        document._id = `${collection}-${index}`;
        const references = await findHistoryIdReferences({
            connection: matchingConnection({ [collection]: [document] }), historyIds: [id]
        });
        assert.equal(references.length, 1, collection);
        assert.equal(references[0].collection, collection);
    }
});

test('audit queries retain all legacy persisted weekly decision paths', () => {
    const byCollection = new Map(REFERENCE_QUERIES);
    assert.ok(byCollection.get('Apasxoliseis_Weekly_Canonical_Decisions')
        .includes('canonical_snapshot.input.profile_history._id'));
    assert.ok(byCollection.get('Apasxoliseis_Weekly_Canonical_Decisions')
        .includes('canonical_snapshot.analysis.profile_history._id'));
    assert.ok(byCollection.get('Apasxoliseis_Weekly_Repo_Transfer_Decisions')
        .includes('canonical_snapshot.employee.profile_istoriko_id'));
});

test('every shared audit field path performs a real nested field match', async () => {
    const id = '507f1f77bcf86cd799439011';
    for (const [collection, fields] of REFERENCE_QUERIES) {
        for (const field of fields) {
            const document = { _id: `${collection}:${field}` };
            const segments = field.split('.');
            let cursor = document;
            for (const segment of segments.slice(0, -1)) cursor = cursor[segment] = {};
            cursor[segments.at(-1)] = id;
            const references = await findHistoryIdReferences({
                connection: matchingConnection({ [collection]: [document] }), historyIds: [id]
            });
            assert.deepEqual(references, [{ collection, documentId: document._id }], field);
        }
    }
});

test('missing database handle fails closed when ids are candidates for deletion', async () => {
    await assert.rejects(
        findHistoryIdReferences({ historyIds: ['507f1f77bcf86cd799439011'] }),
        /collection\(\) required/
    );
});


test('Legacy Fence sorting is opt-in; ordinary reference audits keep their exact options', async () => {
    const visited = [], session = {};
    const connection = { collection(name) { return { async findOne(query, options) {
        visited.push({ name, options });
        return name === 'Apasxoliseis_Period_Frozen_Snapshots' ? { _id: options.sort ? 'first-by-id' : 'ordinary-first' } : null;
    } }; } };
    const input = { connection, historyIds: ['507f1f77bcf86cd799439011'], session };
    assert.equal((await findHistoryIdReferences(input))[0].documentId, 'ordinary-first');
    for (const { options } of visited) assert.deepEqual(options, { session, projection: { _id: 1 } });
    visited.length = 0;
    const references = await require('./employeeHistoryLegacyFenceService')
        .legacyFenceReferenceSummary(connection, [{ _id: input.historyIds[0] }], session);
    assert.equal(references[input.historyIds[0]][0].documentId, 'first-by-id');
    for (const { options } of visited) assert.deepEqual(options, { session, projection: { _id: 1 }, sort: { _id: 1 } });
});

test('batch absence checks every collection and both BSON/string forms in the same transaction', async () => {
    const ids = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
    const session = { inTransaction: () => true }, visited = [];
    const connection = { collection(name) { return { async findOne(query, options) {
        visited.push({ name, query, options }); return null;
    } }; } };
    assert.deepEqual(await findHistoryIdReferenceSummary({ connection, historyIds: ids, session }),
        Object.fromEntries(ids.map(id => [id, []])));
    assert.deepEqual(visited.map(item => item.name), REFERENCE_QUERIES.map(([name]) => name));
    for (const { query, options } of visited) {
        assert.deepEqual(options, { session, projection: { _id: 1 } });
        for (const clause of query.$or) {
            const values = Object.values(clause)[0].$in;
            assert.deepEqual(values.slice(0, 2), ids);
            assert.ok(values.slice(2).every(value => value._bsontype === 'ObjectId'));
        }
    }
});

test('positive collections retain original per-id witnesses, order and sort options', async () => {
    const ids = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
    const session = { inTransaction: () => true };
    const documents = { Prodhlomena_Oraria_Deviations: [
        { _id: 'first-witness', effective_profile_istoriko_id: ids[1] },
        { _id: 'second-witness', effective_profile_istoriko_id: ids[0] }
    ] };
    const connection = matchingConnection(documents), expected = {};
    for (const id of ids) expected[id] = await findHistoryIdReferences({ connection, historyIds: [id], session });
    assert.deepEqual(await findHistoryIdReferenceSummary({ connection, historyIds: ids, session }), expected);
});

test('batching requires a transaction and does not reuse absence across calls', async () => {
    const ids = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
    const lengths = [];
    const connection = { collection() { return { async findOne(query) {
        lengths.push(query.$or[0].effective_profile_istoriko_id?.$in.length ||
            Object.values(query.$or[0])[0].$in.length); return null;
    } }; } };
    await findHistoryIdReferenceSummary({ connection, historyIds: ids });
    assert.equal(lengths.length, ids.length * REFERENCE_QUERIES.length);
    assert.ok(lengths.every(length => length === 2));
    lengths.length = 0;
    const input = { connection, historyIds: ids, session: { inTransaction: () => true } };
    await findHistoryIdReferenceSummary(input); await findHistoryIdReferenceSummary(input);
    assert.equal(lengths.length, REFERENCE_QUERIES.length * 2);
});

test('empty batches do not query, while missing handles and query failures stay fail-closed', async () => {
    assert.deepEqual(await findHistoryIdReferenceSummary(), {});
    await assert.rejects(findHistoryIdReferenceSummary({ historyIds: ['507f1f77bcf86cd799439011'] }), /collection\(\) required/);
    const failure = new Error('REFERENCE_READ_FAILED');
    await assert.rejects(findHistoryIdReferenceSummary({ historyIds: ['a', 'b'],
        session: { inTransaction: () => true }, connection: { collection() {
            return { async findOne() { throw failure; } };
        } } }), error => error === failure);
});

test('dense evidence stops additional probes; bounded chunks retain every id', async () => {
    const ids = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
    let queries = 0;
    const connection = { collection() { return { async findOne() { queries++; return { _id: 'witness' }; } }; } };
    const summary = await findHistoryIdReferenceSummary({ connection, historyIds: ids,
        session: { inTransaction: () => true } });
    assert.equal(queries, REFERENCE_QUERIES.length * ids.length + 1);
    assert.ok(Object.values(summary).every(references => references.length === REFERENCE_QUERIES.length));
    queries = 0;
    const many = Array.from({ length: 65 }, (_, n) => n.toString(16).padStart(24, '0'));
    const empty = await findHistoryIdReferenceSummary({ historyIds: many, session: { inTransaction: () => true },
        connection: { collection() { return { async findOne(query) {
            queries++; assert.ok(Object.values(query.$or[0])[0].$in.length <= 128); return null;
        } }; } } });
    assert.equal(Object.keys(empty).length, 65);
    assert.equal(queries, REFERENCE_QUERIES.length * 2);
});
