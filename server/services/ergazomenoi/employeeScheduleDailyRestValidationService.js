'use strict';

const {
    collectDailyRestViolations,
    scheduleDaysFromFormData
} = require('../../../public/js/ergazomenoi/genika/dailyRestValidation');

const EMPLOYEE_SCHEDULE_DAILY_REST_VIOLATION =
    'EMPLOYEE_SCHEDULE_DAILY_REST_VIOLATION';
const EMPLOYEE_SCHEDULE_DAILY_REST_MESSAGE =
    'Το ωράριο δεν μπορεί να αποθηκευτεί επειδή παραβιάζεται η ελάχιστη ημερήσια ανάπαυση των 11 ωρών.';

function validateEmployeeScheduleDailyRest(formData) {
    const scheduleDays = scheduleDaysFromFormData(formData);
    const violations = collectDailyRestViolations(scheduleDays);
    return {
        valid: violations.length === 0,
        violations
    };
}

function rejectEmployeeScheduleDailyRest(res, validation) {
    return res.status(400).json({
        success: false,
        reason: EMPLOYEE_SCHEDULE_DAILY_REST_VIOLATION,
        message: EMPLOYEE_SCHEDULE_DAILY_REST_MESSAGE,
        errorMessage: EMPLOYEE_SCHEDULE_DAILY_REST_MESSAGE,
        violations: validation.violations.map((violation) => ({
            previousDate: violation.previousDate,
            currentDate: violation.currentDate,
            restMinutes: violation.restMinutes
        }))
    });
}

module.exports = {
    EMPLOYEE_SCHEDULE_DAILY_REST_MESSAGE,
    EMPLOYEE_SCHEDULE_DAILY_REST_VIOLATION,
    rejectEmployeeScheduleDailyRest,
    validateEmployeeScheduleDailyRest
};
