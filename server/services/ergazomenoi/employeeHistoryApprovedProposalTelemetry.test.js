'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('./employeeHistoryApprovedProposalTelemetry');
const D = require('./employeeHistoryApprovedProposalFailureDiagnostics');
test('Before-send BSON failure retains its original exception and records only size, count and correlation', async () => {
    const records = [], privateValue = 'PRIVATE_TOKEN_PERSONAL_DATA';
    const req = { id: privateValue, body: { token: privateValue } };
    const original = Object.assign(new RangeError(privateValue), { code: 'ERR_OUT_OF_RANGE' });
    await assert.rejects(T.run(req, 'apply', () => T.operation('audit.insert', 'insert', 'Employee_History_Repair_Audit',
        () => { throw original; }, { documents: [{ privateValue }] }), { info(event, record) { records.push({ event, ...record }); } }),
        error => error === original);
    const insert = records.find(r => r.stage === 'apply.audit.insert');
    assert.equal(insert.succeeded, false); assert.equal(insert.operationCount, 1); assert.ok(insert.bsonBytes > 0);
    assert.equal(records.at(-1).operationCount, 1);
    assert.equal(insert.correlationId, D.getCorrelationId(req));
    assert.equal(JSON.stringify(records).includes(privateValue), false);
    assert.ok(records.every(r => r.durationMs >= 0));
});
test('Failed timing logger preserves the result and session methods use the original session identity', async () => {
    const session = { value: 41, async commitTransaction() { assert.equal(this, session); return this.value + 1; } };
    const result = await T.run({}, 'apply', async () => T.observeSession(session).commitTransaction(), { info() { throw Error('private logger details'); } });
    assert.equal(result, 42);
});
test('Scoped query and cursor timings preserve query chaining, execution count and returned values', async () => {
    let reads = 0, updates = 0; const records = [], privateValue = { secret: 'PRIVATE_RESULT' };
    const collection = { name: 'Synthetic', find() { return { sort() { return this; }, async toArray() { reads++; return [privateValue]; } }; },
        async updateOne() { updates++; return { matchedCount: 1 }; } };
    const model = { collection, findOne() { return { select() { return this; }, lean() { return this; },
        async exec() { reads++; return privateValue; }, then(resolve, reject) { return this.exec().then(resolve, reject); } }; } };
    const deps = T.dependencies({ syntheticModel: model, connection: { collection() { return collection; } } });
    await T.run({}, 'apply', async () => {
        assert.equal(await deps.syntheticModel.findOne().select('x').lean(), privateValue);
        assert.deepEqual(await deps.connection.collection('Synthetic').find().sort({ _id: 1 }).toArray(), [privateValue]);
        assert.equal((await deps.connection.collection('Synthetic').updateOne({}, {})).matchedCount, 1);
    }, { info(event, record) { records.push(record); } });
    assert.equal(reads, 2); assert.equal(updates, 1); assert.equal(records.at(-1).operationCount, 3);
    assert.equal(JSON.stringify(records).includes('PRIVATE_RESULT'), false);
});
test('Disabled approved apply still rejects before any database access, including a missing request', async () => {
    const { createEmployeeHistoryApprovedProposalService } = require('./employeeHistoryApprovedProposalService');
    const service = createEmployeeHistoryApprovedProposalService({ isEnabled: () => false,
        logger: { info() {} }, connection: { startSession() { throw Error('UNEXPECTED_DATABASE_ACCESS'); } } });
    await assert.rejects(service.apply(null, {}), e => e.reason === 'DISABLED');
});
