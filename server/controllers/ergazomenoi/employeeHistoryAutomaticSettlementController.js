'use strict';

const { createEmployeeHistoryReconstructionPreviewController } = require('./employeeHistoryReconstructionPreviewController');

// Closed by default. Only the actual listening DEV server can issue the
// runtime capability; request flags and injected models never open this boundary.
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
    const policy = require('../../services/ergazomenoi/employeeHistorySettlementDevActivation');
    const real = require('./employeeHistorySettlementHttpController').createEmployeeHistorySettlementHttpController();
    const preview = createEmployeeHistoryReconstructionPreviewController({ resolveBusinessDecision: true });
    return Object.freeze({
        resolve(req, res) { return policy.getEmployeeHistorySettlementDevHandle(req) ? real.preview(req, res) : preview(req, res); },
        apply(req, res) {
            if (policy.getEmployeeHistorySettlementDevHandle(req)) return real.apply(req, res);
            // Deliberately before identity lookups, sessions and every writer.
            res.set('Cache-Control', 'no-store');
            return res.status(423).json({ success: false, executionEnabled: false,
                code: 'EMPLOYEE_HISTORY_SETTLEMENT_EXECUTION_DISABLED',
                message: 'Ζητήσατε εφαρμογή της τακτοποίησης του Ιστορικού, αλλά η αποθήκευση δεν έχει ενεργοποιηθεί. Η ενέργεια σταμάτησε και δεν αποθηκεύτηκε καμία αλλαγή.\n1. Κλείστε το μήνυμα και συνεχίστε τις ανεξάρτητες εργασίες.\n2. Επικοινωνήστε με τον διαχειριστή για την ενεργοποίηση της ασφαλούς τακτοποίησης.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-4Α.' });
        }
    });
}

module.exports = { createEmployeeHistoryAutomaticSettlementController };
