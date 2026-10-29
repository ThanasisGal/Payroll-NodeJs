'use strict';

const { createEmployeeHistoryAutomaticSettlementController } = require('../controllers/ergazomenoi/employeeHistoryAutomaticSettlementController');

// The application and isolated HTTP tests register exactly these same paths.
function registerEmployeeHistorySettlementRoutes(router, { checkAuth, requireUserPrivilegeAction,
    controller = createEmployeeHistoryAutomaticSettlementController() }) {
    router.post('/api/ergazomenoi/:id/history-automatic-settlement-resolve', checkAuth,
        requireUserPrivilegeAction('Ergazomenoi', 'read'), controller.resolve);
    router.post('/api/ergazomenoi/:id/history-automatic-settlement-apply', checkAuth,
        controller.apply);
    // Real apply is blocked before any database-backed permission middleware.
    // The issued synthetic handler revalidates update rights inside its transaction.
}

module.exports = { registerEmployeeHistorySettlementRoutes };
