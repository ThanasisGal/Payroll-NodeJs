'use strict';
const mongoose = require('mongoose');
const { ErgazomenoiModel } = require('../models/ergazomenoi');
const { isTemporaryEmployee, saveStateError, sendEmployeeSaveStateError } = require('../utils/ergazomenoi/employeeSaveState');

// Runs before any file preparation, payroll writes or external submission.
async function requireFinalizedEmployee(req, res, next) {
    const body = req.body || {};
    const identities = [req.params?.ergazomenoiId, body.ergazomenosId, body.employeeId, body.id, body.kodikos]
        .filter(value => value !== undefined && value !== null && value !== '')
        .map(value => mongoose.isValidObjectId(value) ? { _id: value } : { kodikos: String(value).trim() });
    if (body.formData?.kodikosHidden) identities.push({ kodikos: String(body.formData.kodikosHidden).trim() });
    const scope = { team: req.session?.userTeam, company_kod: req.session?.companyInUse };
    try {
        if (!scope.team || !scope.company_kod || !identities.length) {
            return sendEmployeeSaveStateError(res, saveStateError('EMPLOYEE_SAVE_INVALID_DATA', 400));
        }
        let employeeId;
        // Every supplied identity must resolve to the same scoped employee. An
        // extra code must never disguise the employee actually used downstream.
        for (const identity of identities) {
            const employee = await ErgazomenoiModel.findOne({ ...scope, ...identity }).select('oristikh_enhmerosh').lean();
            if (!employee || (employeeId && String(employee._id) !== employeeId)) {
                return sendEmployeeSaveStateError(res, saveStateError('EMPLOYEE_SAVE_NOT_FOUND', 404));
            }
            if (isTemporaryEmployee(employee)) return sendEmployeeSaveStateError(res, saveStateError('EMPLOYEE_SAVE_DRAFT_REQUIRED'));
            employeeId = String(employee._id);
        }
        return next();
    } catch {
        return sendEmployeeSaveStateError(res, saveStateError('EMPLOYEE_SAVE_FAILED', 503));
    }
}
module.exports = requireFinalizedEmployee;
