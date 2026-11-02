'use strict';
const F = require('../../services/ergazomenoi/employeeHistoryLegacyFenceService');
const A = require('../../services/ergazomenoi/employeeHistoryAutomaticReconstructionApplyContract');
function createEmployeeHistoryLegacyFenceController({ contextProvider = require('../../services/ergazomenoi/employeeHistoryLegacyFenceActivation').contextFor } = {}) {
    async function handle(req, res, apply) {
        res.set('Cache-Control', 'no-store');
        try {
            const context = contextProvider(req);
            if (!context) throw F.blocked('DISABLED'); // Before all database access.
            const keys = ['scope', 'legacyAttemptId', 'fingerprint'];
            if (req.body?.businessDecision !== undefined) keys.push('businessDecision');
            if (apply) keys.push('approval');
            if (!req.body || !A.equal(Object.keys(req.body).sort(), keys.sort())) throw F.blocked('INVALID_REQUEST');
            const { scope } = req.body;
            if (!req.session?.userId || scope?.company_kod !== req.session.companyInUse || scope?.team !== req.session.userTeam)
                throw F.blocked('SESSION_SCOPE_MISMATCH');
            const input = { ...req.body, connection: context.deps.connection, context,
                actorUserId: req.session.userId, employeeId: req.params.id };
            const result = apply ? await F.fenceLegacyApproval(input) : await F.previewLegacyApproval(input);
            const { _snapshot, ...safe } = result;
            return res.json({ success: true, ...safe, autoSettlement: false,
                message: apply ? 'Η παλιά έγκριση αποκλείστηκε και η καταγραφή αποθηκεύτηκε μόνιμα. Δεν έγινε νέα τακτοποίηση. Ανοίξτε νέα προεπισκόπηση και εξετάστε τις αλλαγές πριν δώσετε νέα ξεχωριστή έγκριση.' :
                    'Η προεπισκόπηση επιβεβαιώθηκε χωρίς αποθήκευση αλλαγών. Ο αποκλεισμός απαιτεί ξεχωριστή ρητή έγκριση διαχειριστή.' });
        } catch (error) {
            const safe = error.outcome === 'BLOCKED' ? error : F.blocked('EVIDENCE_NOT_CONFIRMED');
            return res.status(safe.reason === 'DISABLED' ? 423 : 409).json({ success: false, outcome: 'BLOCKED', reason: safe.reason,
                retryWithSameApproval: false, autoSettlement: false, message: safe.message, code: safe.code });
        }
    }
    return { preview: (req, res) => handle(req, res, false), apply: (req, res) => handle(req, res, true) };
}
module.exports = { createEmployeeHistoryLegacyFenceController };
