'use strict';

// PR406 Stage5E. HTTP adapter for the approved atomic week-terms writer.
// This endpoint is OFF until the server explicitly enables the existing
// Stage5D flag. The browser supplies only a typed intent and, on apply,
// the exact confirmation from its own preview. Scope/rights/history/approvals
// stay owned by the service and are reloaded under a single transaction.
const { createApprovedHistoryAtomicMaintenanceService } =
    require('../../services/ergazomenoi/employeeApprovedHistoryAtomicMaintenanceService');
const PREFIX = 'EMPLOYEE_APPROVED_ATOMIC_';
const { validProfileChangeShape, normalizeProfileChangeTerms } = require('../../utils/ergazomenoi/historicalProfileChange');
const ALLOWED_CHANGE = ['kind', 'effectiveFrom', 'correctedTerms', 'targetHistoryId'];
const own = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every(key => keys.includes(key));
const exactly = (value, keys) => own(value, keys) &&
    keys.every(key => Object.hasOwn(value, key)) && Object.keys(value).length === keys.length;
const day = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value+'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
};
const oid = value => typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);
function validChange(change) {
    if (!own(change, ALLOWED_CHANGE) || !Object.hasOwn(change,'kind') ||
        !Object.hasOwn(change,'effectiveFrom') || !Object.hasOwn(change,'correctedTerms') ||
        !['NEW_CHANGE','CORRECT_SAVED_ERROR'].includes(change.kind) || !day(change.effectiveFrom) ||
        !validProfileChangeShape(change)) return false;
    if (change.kind === 'NEW_CHANGE' && Object.hasOwn(change,'targetHistoryId')) return false;
    if (change.kind === 'CORRECT_SAVED_ERROR' && !oid(change.targetHistoryId)) return false;
    return normalizeProfileChangeTerms(change.correctedTerms,{}) !== null;
}
function createEmployeeApprovedHistoryAtomicMaintenanceController(
    { service = createApprovedHistoryAtomicMaintenanceService() } = {}) {
    if (!service || typeof service.isEnabled !== 'function' ||
        typeof service.preview !== 'function' || typeof service.apply !== 'function')
        throw new TypeError('APPROVED_ATOMIC_CONTROLLER_SERVICE_REQUIRED');
    const safeResponse = (res, code, data) => res.status(code).json(data);
    async function handle(req, res, operation) {
        res.set('Cache-Control','no-store');
        res.set('Pragma','no-cache');
        // Do not inspect req.body or open a DB/permission lookup when disabled.
        if (!service.isEnabled()) return safeResponse(res, 423, {
            success:false, saved:false, executionEnabled:false, code:PREFIX+'DISABLED',
            message:'Η ασφαλής αποθήκευση νέων ιστορικών μεταβολών δεν έχει ενεργοποιηθεί. Δεν αποθηκεύτηκε καμία αλλαγή.' });
        try {
            if (!req.session?.userId || !req.sessionID) return safeResponse(res, 401, {
                success:false, saved:false, code:PREFIX+'AUTHENTICATION', message:'Απαιτείται ενεργή σύνδεση.' });
            if (!oid(req.params?.id)) return safeResponse(res, 400, {
                success:false, saved:false, code:PREFIX+'INVALID_EMPLOYEE', message:'Μη έγκυρο αναγνωριστικό εργαζομένου.' });
            const body = req.body;
            // Client cannot supply scope, approvals or History to context.
            if (operation === 'context') {
                if (!exactly(body,[]) || typeof service.context !== 'function')
                    return safeResponse(res,400,{success:false,saved:false,
                        code:PREFIX+'INVALID_REQUEST',message:'Μη έγκυρο αίτημα ιστορικού.'});
                return safeResponse(res,200,await service.context(req));
            }
            if (!exactly(body, operation === 'preview' ? ['change'] : ['change','approval']) ||
                !validChange(body.change) || operation === 'apply' &&
                (!exactly(body.approval, ['token','confirmed']) || body.approval.confirmed !== true ||
                    typeof body.approval.token !== 'string' || body.approval.token.length > 4096 || !body.approval.token))
                return safeResponse(res, 400, { success:false, saved:false, code:PREFIX+'INVALID_REQUEST',
                    message:'Χρειάζονται συγκεκριμένη μεταβολή, έγκυρη ημερομηνία και συνεπείς ημέρες/ώρες. Δεν αποθηκεύτηκε αλλαγή.' });
            const result = operation === 'preview'
                ? await service.preview(req, body.change)
                : await service.apply(req, body.change, body.approval.token);
            return safeResponse(res, 200, result);
        } catch (error) {
            const known = typeof error?.code === 'string' && error.code.startsWith(PREFIX) &&
                Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 503;
            const uncertain = !known && operation === 'apply' || error?.hasErrorLabel?.('UnknownTransactionCommitResult') ||
                error?.errorLabels?.includes('UnknownTransactionCommitResult');
            const reason = known ? error.code : PREFIX+'TRANSACTION_UNVERIFIED';
            // Unknown transaction outcome is NEVER misreported as a rollback.
            return safeResponse(res, uncertain ? 503 : known ? error.statusCode : 503, {
                success:false, saved:uncertain ? null : false, outcome:uncertain ? 'UNKNOWN':'REJECTED',
                code:reason, executionEnabled:false,
                message:uncertain
                    ? 'Δεν επιβεβαιώθηκε το αποτέλεσμα της συναλλαγής. Μην επαναλάβετε την αποθήκευση πριν από ανεξάρτητο έλεγχο.'
                    : 'Η μεταβολή δεν εφαρμόστηκε. Ελέγξτε την ημερομηνία, την προηγούμενη περίοδο και τις προστατευμένες εγγραφές. Κωδικός: '+reason+'.' });
        }
    }
    return Object.freeze({ preview:(req,res)=>handle(req,res,'preview'),
        apply:(req,res)=>handle(req,res,'apply'),
        context:(req,res)=>handle(req,res,'context') });
}
module.exports = { createEmployeeApprovedHistoryAtomicMaintenanceController };
