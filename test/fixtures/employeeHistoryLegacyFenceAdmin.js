'use strict';
// CI adapter only; the single algorithm is the production Admin service.
const { assertMongoConnection } = require('./employeeHistorySettlementMongoTarget');
const service = require('../../server/services/ergazomenoi/employeeHistoryLegacyFenceService');
function testContext(connection, context, { failAudit, onWritten } = {}) {
    assertMongoConnection(connection);
    const audit = require('../../server/models/employeeHistoryRepairAudit');
    const auditModel = new Proxy(audit, { get(target, key) {
        if (key === 'create') return async (records, options) => {
            const result = await audit.create(records, options);
            if (records[0].mutationSource === service.SOURCE) {
                if (failAudit) throw Object.assign(Error('INJECTED_AUDIT_FAILURE'), { code: 'INJECTED_AUDIT_FAILURE' });
                if (onWritten) await onWritten();
            }
            return result;
        };
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
    return { ...context, legacyFenceEnabled: true, deps: { ...context.deps, auditModel } };
}
async function fenceLegacyApproval(options) {
    const context = testContext(options.connection, options.context, options);
    const input = { ...options, context };
    const preview = await service.previewLegacyApproval(input);
    try {
        const result = await service.fenceLegacyApproval({ ...input, approval: { confirmed: true, fingerprint: preview.approvalFingerprint } });
        if (options.loseAcknowledgement) throw Object.assign(Error('COMMIT_RESULT_UNKNOWN'), { code: 'COMMIT_RESULT_UNKNOWN' });
        return result;
    } catch (error) {
        if (options.failAudit && error.reason === 'FENCE_RESULT_UNCERTAIN') error.code = 'INJECTED_AUDIT_FAILURE';
        throw error;
    }
}
module.exports = { fenceLegacyApproval, testContext, SOURCE: service.SOURCE, SEQUENCE: service.SEQUENCE, executionEnabled: false };
