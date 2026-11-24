'use strict';
const assert = require('node:assert/strict');
const { verifiedEmployeeHistoryDisplay } =
    require('../../server/services/ergazomenoi/employeeApprovedHistoryDisplayProjectionService');
const B = require('../../server/services/ergazomenoi/employeeApprovedHistoryImmutableBoundaryService');

function readOnlyHistoryDisplayVmRequire({ onAuditRead } = {}) {
    const audit = { find(filter) {
        // Fail closed if the production display service changes its query.
        assert.equal(filter?.mutationSource, B.OPERATION);
        assert.equal(filter?.['diagnostics.version'], B.WRITER_VERSION);
        assert.equal(filter?.['diagnostics.operation'], 'NEW_CHANGE');
        assert.ok(filter?.['employeeScope.team']);
        assert.ok(filter?.['employeeScope.company_kod']);
        assert.ok(filter?.['employeeScope.kodikos']);
        assert.ok(filter?.['employeeScope.employee_id']);
        if (onAuditRead) onAuditRead(filter);
        return { sort() { return this; }, async lean() { return []; } };
    } };
    return function restrictedRequire(id) {
        if (id === '../../utils/ergazomenoi/historicalProfileComparison')
            return require('../../server/utils/ergazomenoi/historicalProfileComparison');
        if (id === '../../services/ergazomenoi/employeeApprovedHistoryDisplayProjectionService')
            return { verifiedEmployeeHistoryDisplay };
        if (id === '../../models/employeeHistoryRepairAudit') return audit;
        throw new Error('Unexpected controller VM dependency: ' + id);
    };
}
module.exports = { readOnlyHistoryDisplayVmRequire };
