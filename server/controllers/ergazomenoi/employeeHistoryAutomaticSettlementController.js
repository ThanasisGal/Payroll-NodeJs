'use strict';

const { createEmployeeHistoryReconstructionPreviewController } = require('./employeeHistoryReconstructionPreviewController');

// This is a closed application boundary, not an activation flag. No environment,
// request, model or connection can enable a real settlement write in this phase.
function createEmployeeHistoryAutomaticSettlementController(options = {}) {
    if (!options || Object.keys(options).some(key => key !== 'syntheticStore')) {
        throw new TypeError('Only an issued in-memory settlement capability is accepted');
    }
    if (options.syntheticStore !== undefined) {
        require('../../../test/fixtures/employeeHistorySettlementSyntheticStore')
            .memorySettlementContext(options.syntheticStore);
        return require('./employeeHistoryAutomaticSettlementSyntheticController')
            .createEmployeeHistoryAutomaticSettlementSyntheticController(options);
    }
    return Object.freeze({
        resolve: createEmployeeHistoryReconstructionPreviewController({ resolveBusinessDecision: true }),
        apply(req, res) {
            // Deliberately before identity lookups, sessions and every writer.
            res.set('Cache-Control', 'no-store');
            return res.status(423).json({ success: false, executionEnabled: false,
                code: 'EMPLOYEE_HISTORY_SETTLEMENT_EXECUTION_DISABLED',
                message: 'Ζητήσατε εφαρμογή της τακτοποίησης του Ιστορικού, αλλά η αποθήκευση δεν έχει ενεργοποιηθεί. Η ενέργεια σταμάτησε και δεν αποθηκεύτηκε καμία αλλαγή.\n1. Κλείστε το μήνυμα και συνεχίστε τις ανεξάρτητες εργασίες.\n2. Επικοινωνήστε με τον διαχειριστή για την ενεργοποίηση της ασφαλούς τακτοποίησης.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-4Α.' });
        }
    });
}

module.exports = { createEmployeeHistoryAutomaticSettlementController };
