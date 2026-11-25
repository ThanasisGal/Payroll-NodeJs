'use strict';
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const contexts = new WeakMap();
const correlations = new WeakMap();
const root = path.resolve(__dirname, '../../..');
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const names = new Set(['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError',
    'MongoError', 'MongoServerError', 'MongoNetworkError', 'MongoServerSelectionError',
    'MongoTransactionError', 'MongoInvalidArgumentError', 'MongoWriteConcernError', 'MongoBulkWriteError',
    'MongoTopologyClosedError', 'MongoExpiredSessionError', 'MongoNotConnectedError',
    'BSONError', 'BSONVersionError', 'ValidationError', 'ValidatorError', 'CastError', 'StrictModeError']);
const labels = new Set(['TransientTransactionError', 'UnknownTransactionCommitResult',
    'RetryableWriteError', 'NoWritesPerformed', 'RetryableReadError']);
function capture(error, stage) {
    if (error && typeof error === 'object' && !contexts.has(error)) contexts.set(error, { error, stage });
    return error;
}
function translate(error, original) {
    contexts.set(error, contexts.get(original) || { error: original, stage: 'UNKNOWN' });
    return error;
}
function safeStack(error) {
    // Error messages, function names and absolute user paths can contain
    // documents, credentials or personal data. Retain source locations only.
    return String(error?.stack || '').split('\n').slice(1).flatMap(line => {
        const match = line.match(/(?:\(|\s)((?:\/[^()\r\n]+|node:[^()\s]+)):(\d+):(\d+)\)?$/);
        if (!match) return [];
        const file = match[1].startsWith('node:') ? match[1] : path.relative(root, match[1]);
        if (file.startsWith('..') || !/^[a-zA-Z\d_./:@-]+$/.test(file)) return [];
        return [`at ${file}:${match[2]}:${match[3]}`];
    }).slice(0, 24).join('\n');
}
function getCorrelationId(req) {
    if (!req || typeof req !== 'object') return randomUUID();
    if (typeof req.id === 'string' && uuid.test(req.id)) return req.id;
    if (!correlations.has(req)) correlations.set(req, randomUUID());
    return correlations.get(req);
}
function logFailure(logger, req, phase, error) {
    const context = contexts.get(error) || { error, stage: 'REQUEST_VALIDATION' };
    const original = context.error;
    const correlationId = getCorrelationId(req);
    const code = Number.isSafeInteger(original?.code) ? original.code :
        typeof original?.code === 'string' && /^(?:ERR_|EMPLOYEE_|PERIOD_CONTROL_)[A-Z\d_]{1,120}$/.test(original.code) ? original.code : null;
    const diagnostic = { correlationId, phase, transactionStage: context.stage,
        name: names.has(original?.name) ? original.name : 'Error', code,
        errorLabels: (Array.isArray(original?.errorLabels) ? original.errorLabels : []).filter(label => labels.has(label)),
        stack: safeStack(original) };
    // Diagnostics must never replace the original failure or affect its outcome.
    try { logger.error('EMPLOYEE_HISTORY_APPROVED_PROPOSAL_FAILURE', diagnostic); } catch { /* Preserve original response. */ }
    return correlationId;
}
module.exports = { capture, translate, logFailure, getCorrelationId };
