'use strict';
const { AsyncLocalStorage } = require('node:async_hooks');
const { performance } = require('node:perf_hooks');
const { BSON } = require('mongoose').mongo;
const Diagnostics = require('./employeeHistoryApprovedProposalFailureDiagnostics');
const context = new AsyncLocalStorage();
function emit(current, record) {
    try { (current.logger || require('../../utils/logger')).info('EMPLOYEE_HISTORY_APPROVED_PROPOSAL_TIMING', {
        correlationId: current.correlationId, ...record }); } catch { /* Preserve the operation's result. */ }
}
async function measure(stage, work, metadata = {}) {
    const current = context.getStore(); if (!current) return work();
    const before = performance.now(), count = current.counter.operations;
    const child = { ...current, stage: `${current.phase}.${stage}` }; let succeeded = false;
    try { const result = await context.run(child, work); succeeded = true; return result; }
    finally { emit(current, { stage: child.stage, durationMs: +(performance.now() - before).toFixed(3),
        operationCount: current.counter.operations - count, succeeded, ...metadata }); }
}
function operation(stage, command, collection, work, document) {
    const current = context.getStore(); if (!current) return work();
    current.counter.operations++;
    const metadata = { command, collection, operationCount: 1 };
    if (document) { try { metadata.bsonBytes = BSON.calculateObjectSize(document); } catch { metadata.bsonBytes = null; } }
    return measure(stage, work, metadata);
}
function run(req, phase, work, logger) {
    if (context.getStore()) return measure(phase, work);
    return context.run({ phase, stage: phase, logger, correlationId: Diagnostics.getCorrelationId(req), counter: { operations: 0 } },
        () => measure('total', work));
}
function auto(command, collection, work) {
    const current = context.getStore();
    return operation(`${current?.stage.slice(current.phase.length + 1) || 'data'}.mongo.${command}`, command, collection, work);
}
function cursor(target, command, collection) {
    let proxy;
    proxy = new Proxy(target, { get(object, key) {
        const value = Reflect.get(object, key, object);
        if (typeof value !== 'function') return value;
        if (['toArray', 'next', 'hasNext'].includes(key)) return (...args) => auto(command, collection, () => value.apply(object, args));
        return (...args) => { const result = value.apply(object, args); return result === object ? proxy : result; };
    } }); return proxy;
}
function native(target, collection = null) {
    return new Proxy(target, { get(object, key) {
        const value = Reflect.get(object, key, object);
        if (typeof value !== 'function') return value;
        if (key === 'collection') return (...args) => native(value.apply(object, args), args[0]);
        if (['find', 'listCollections', 'listIndexes'].includes(key)) return (...args) => cursor(value.apply(object, args), key, collection);
        if (['findOne', 'updateOne', 'insertOne', 'deleteOne', 'bulkWrite', 'command'].includes(key))
            return (...args) => auto({ findOne: 'find', updateOne: 'update', bulkWrite: 'bulkWrite', insertOne: 'insert', deleteOne: 'delete' }[key] || key,
                collection, () => value.apply(object, args));
        return value.bind(object);
    } });
}
function model(target) {
    return new Proxy(target, { get(object, key) {
        if (key === 'collection') return native(object.collection, object.collection.name);
        const value = Reflect.get(object, key, object);
        if (typeof value !== 'function') return value;
        if (['find', 'findOne', 'findById', 'updateOne'].includes(key)) return (...args) => {
            const query = value.apply(object, args);
            if (typeof query?.exec === 'function') {
                const execute = query.exec;
                query.exec = function (...options) { return auto(key === 'updateOne' ? 'update' : 'find', object.collection.name,
                    () => execute.apply(this, options)); };
            }
            return query;
        };
        return value.bind(object);
    } });
}
function dependencies(input) {
    const result = { ...input };
    for (const key of Object.keys(result)) if (key.endsWith('Model') && result[key]?.collection) result[key] = model(result[key]);
    const connection = input.connection;
    result.connection = new Proxy(connection, { get(object, key) {
        if (key === 'db' && object.db) return native(object.db);
        if (key === 'startSession') return (...args) => measure('transaction.session', async () =>
            observeSession(await object.startSession(...args)));
        if (key === 'collection') return name => native(object.collection(name), name);
        const value = Reflect.get(object, key, object); return typeof value === 'function' ? value.bind(object) : value;
    } });
    const probe = input.capabilityProbe;
    if (typeof probe === 'function') result.capabilityProbe = connection => measure('transaction.capability', () => probe(connection));
    return result;
}
function observeSession(session) {
    if (!context.getStore()) return session;
    for (const [method, stage] of [['commitTransaction', 'commit'], ['abortTransaction', 'abort']]) {
        const original = session[method]; if (typeof original !== 'function') continue;
        session[method] = function (...args) { return operation(stage, method, null, () => original.apply(this, args)); };
    }
    return session;
}
module.exports = { run, measure, operation, dependencies, observeSession };
