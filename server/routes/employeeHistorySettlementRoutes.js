'use strict';

const { createEmployeeHistoryAutomaticSettlementController } = require('../controllers/ergazomenoi/employeeHistoryAutomaticSettlementController');

// The application and isolated HTTP tests register exactly these same paths.
function registerEmployeeHistorySettlementRoutes(router, { checkAuth, requireUserPrivilegeAction,
    controller = createEmployeeHistoryAutomaticSettlementController() }) {
    router.get('/api/ergazomenoi/:id/history-proposal.xlsx', checkAuth,
        requireUserPrivilegeAction('Ergazomenoi', 'read'), controller.exportXlsx ||
            require('../controllers/ergazomenoi/employeeHistoryReconstructionPreviewController')
                .createEmployeeHistoryReconstructionPreviewController({ downloadWorkbook: true }));
    router.post('/api/ergazomenoi/:id/history-automatic-settlement-resolve', checkAuth,
        requireUserPrivilegeAction('Ergazomenoi', 'read'), controller.resolve);
    router.post('/api/ergazomenoi/:id/history-automatic-settlement-apply', checkAuth,
        controller.apply);
    if (controller.recover) router.post('/api/ergazomenoi/:id/history-automatic-settlement-recover', checkAuth, controller.recover);
    if (controller.confirm) router.post('/api/ergazomenoi/:id/history-automatic-settlement-confirm', checkAuth, controller.confirm);
    const legacyFence = require('../controllers/ergazomenoi/employeeHistoryLegacyFenceController').createEmployeeHistoryLegacyFenceController();
    router.post('/api/ergazomenoi/:id/history-legacy-fence-preview', checkAuth, legacyFence.preview);
    router.post('/api/ergazomenoi/:id/history-legacy-fence-apply', checkAuth, legacyFence.apply);
    // Real apply is blocked before any database-backed permission middleware.
    // The issued synthetic handler revalidates update rights inside its transaction.
}

module.exports = { registerEmployeeHistorySettlementRoutes };
