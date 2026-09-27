'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { REFERENCE_QUERIES, findHistoryIdReferences } =
    require('./employeeHistoryReferenceAuditService');

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
