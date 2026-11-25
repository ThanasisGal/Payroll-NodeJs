'use strict';

const { createEmployeeHistoryAutomaticSettlementController } = require('../controllers/ergazomenoi/employeeHistoryAutomaticSettlementController');

// The application and isolated HTTP tests register exactly these same paths.
function registerEmployeeHistorySettlementRoutes(router, { checkAuth, requireUserPrivilegeAction,
    archiveController = require('../controllers/ergazomenoi/employeeHistoryArchiveController').createEmployeeHistoryArchiveController(),
    approvedProposalController = require('../controllers/ergazomenoi/employeeHistoryApprovedProposalController').createEmployeeHistoryApprovedProposalController(),
    approvedAtomicMaintenanceController = require('../controllers/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceController').createEmployeeApprovedHistoryAtomicMaintenanceController(),
    controller = createEmployeeHistoryAutomaticSettlementController() }) {
    const exportProposal = controller.exportXlsx ||
        require('../controllers/ergazomenoi/employeeHistoryReconstructionPreviewController')
            .createEmployeeHistoryReconstructionPreviewController({ downloadWorkbook: true });
    for (const route of ['history-proposal.xlsx', 'history-proposal-editor'])
        router.get(`/api/ergazomenoi/:id/${route}`, checkAuth,
            requireUserPrivilegeAction('Ergazomenoi', 'read'), exportProposal);
    // Local file generation is a read operation; existing global CSRF still applies.
    router.post('/api/ergazomenoi/:id/history-proposal.xlsx', checkAuth,
        requireUserPrivilegeAction('Ergazomenoi', 'read'), exportProposal);
    router.post('/api/ergazomenoi/:id/history-proposal-import-preview',checkAuth,
        requireUserPrivilegeAction('Ergazomenoi','read'),
        require('../middlewares/employeeHistoryProposalImportUpload').parseHistoryProposalImport,exportProposal);
    router.post('/api/ergazomenoi/:id/history-proposal-apply-preview', checkAuth,
        requireUserPrivilegeAction('Ergazomenoi', 'read'), approvedProposalController.preview);
    // Default-OFF gate lives before every write in the service. Update/history
    // authorization is repeated inside the same transaction as the mutation.
    router.post('/api/ergazomenoi/:id/history-proposal-apply', checkAuth, approvedProposalController.apply);
    router.post('/api/ergazomenoi/:id/history-proposal-archive', checkAuth,
        archiveController);
    router.post('/api/ergazomenoi/:id/history-proposal-apply-reconcile', checkAuth,
        requireUserPrivilegeAction('Ergazomenoi', 'read'), approvedProposalController.reconcile);
    // PR406 Stage5E: signed, separately authorized atomic work-term changes.
    // No database-backed privilege middleware before the default-OFF service
    // gate. The Stage5D transaction reloads and rechecks actual permissions.
    router.post('/api/ergazomenoi/:id/history-approved-maintenance-preview', checkAuth,
        approvedAtomicMaintenanceController.preview);
    router.post('/api/ergazomenoi/:id/history-approved-maintenance-apply', checkAuth,
        approvedAtomicMaintenanceController.apply);
    // Read-only, default-OFF, server-scoped context for correction of the same period.
    router.post('/api/ergazomenoi/:id/history-approved-maintenance-context', checkAuth,
        approvedAtomicMaintenanceController.context);
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
