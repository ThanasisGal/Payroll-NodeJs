'use strict';
const { createHash } = require('node:crypto');
const { Types } = require('mongoose');
const Import = require('../../utils/ergazomenoi/employeeImportProvenance');
const { semanticHistoryRows } = require('../../utils/ergazomenoi/employmentHistoryCanonicalStatus');
const { buildEmployeeHistoryEditorStateToken } = require('./employeeHistoryEditorStateService');
const { employeeHistoryCoverageGaps } = require('../../utils/ergazomenoi/employmentHistoryCoverage');

function importError(message) {
    const code = 'EMPLOYEE_HISTORY_IMPORT_REJECTED';
    return Object.assign(new Error(code), { code, statusCode: 409,
        publicMessage: `${message} Δεν αποθηκεύτηκε καμία αλλαγή. 1. Ελέγξτε το τεκμήριο μεταφοράς με διαχειριστή. 2. Ανοίξτε ξανά τον εργαζόμενο και επαναλάβετε τη δήλωση. Κωδικός αναφοράς: ΙΣΤ-ΜΕΤ-02.` });
}

function planEmployeeImport({ scope, currentEmployee, historyRows, request, accessMode, publicResolution }) {
    if (accessMode !== 'ADMIN_FULL') throw importError('Η επιβεβαίωση μεταφοράς χρειάζεται ενεργό διαχειριστή με δικαίωμα διόρθωσης Ιστορικού.');
    if (currentEmployee[Import.FIELD] != null) throw importError('Υπάρχει ήδη δήλωση μεταφοράς. Δεν επιτρέπεται αντικατάσταση της τεκμηρίωσής της.');
    const { trackingStartDate, sourceApplication, evidenceReference } = request.facts;
    const hire = Import.day(currentEmployee.hmeromhnia_proslhpshs);
    const departure = Import.day(currentEmployee.hmeromhnia_apoxorhshs);
    const first = semanticHistoryRows(historyRows)
        .filter(row => Import.day(row.hmeromhnia_proslhpshs) === hire)
        .map(row => Import.day(row.hmeromhnia_isxyos_oron_ergasias_apo)).filter(Boolean).sort()[0];
    if (typeof trackingStartDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(trackingStartDate) ||
        Import.day(trackingStartDate) !== trackingStartDate || !hire || trackingStartDate <= hire ||
        trackingStartDate > new Date().toISOString().slice(0,10) || departure && trackingStartDate > departure ||
        !first || trackingStartDate > first || !Import.text(sourceApplication) || !Import.text(evidenceReference)) {
        throw importError('Η ημερομηνία μεταφοράς ή η τεκμηρίωση δεν συμφωνεί με την πρόσληψη και τις καταγεγραμμένες περιόδους. Η έναρξη παρακολούθησης πρέπει να είναι το αργότερο στην πρώτη καταγεγραμμένη περίοδο.');
    }
    const facts = { hireDate: hire, trackingStartDate, sourceApplication: sourceApplication.trim(),
        evidenceReference: evidenceReference.trim() };
    const fingerprint = createHash('sha256').update(JSON.stringify({ version: 1, scope, accessMode,
        state: buildEmployeeHistoryEditorStateToken({ currentEmployee, historyRows }), facts })).digest('hex');
    const greek = value => value.split('-').reverse().join('/');
    return { importDeclaration: facts, public: publicResolution({ phase: 'PREVIEW', fingerprint,
        explanation: 'Επιβεβαιώστε τη μεταφορά μόνο βάσει διαθέσιμου τεκμηρίου. Η δήλωση δεν πιστοποιεί τους παλαιότερους όρους εργασίας.',
        attention: 'Δεν αποθηκεύτηκε ακόμη καμία αλλαγή. 1. Ελέγξτε την ημερομηνία και το τεκμήριο. 2. Επιβεβαιώστε μόνο αν συμφωνούν.',
        changes: [`Πραγματική πρόσληψη: ${greek(hire)}.`, `Έναρξη παρακολούθησης: ${greek(trackingStartDate)}.`,
            `Προηγούμενη εφαρμογή: ${facts.sourceApplication}.`, `Τεκμήριο μεταφοράς: ${facts.evidenceReference}.`,
            'Η πληρότητα του Ιστορικού θα ελέγχεται από την έναρξη παρακολούθησης. Τα πραγματικά κενά και οι διαφωνίες μετά τη μεταφορά παραμένουν προς έλεγχο.'],
        unchanged: ['Οι ημερομηνίες πρόσληψης, όλες οι ιστορικές εγγραφές και τα αποθηκευμένα παλαιά αποτελέσματα διατηρούνται.',
            'Για προγενέστερους υπολογισμούς χρειάζονται τεκμηριωμένοι ιστορικοί όροι.'] }) };
}

// Runs only inside the existing writer's fenced, freshly authorized transaction.
// Metadata-only: never passes through canonical cleanup or History CRUD.
async function applyEmployeeImport({ proposal, request, actorUserId, accessMode, current, originalRows,
    scope, employeeId, employeeModel, historyModel, auditModel, auditCollectionChecker, connection, session }) {
    if (accessMode !== 'ADMIN_FULL' || !actorUserId || request.confirmation?.confirmed !== true ||
        request.confirmation.fingerprint !== proposal.public.fingerprint || current[Import.FIELD] != null) {
        throw importError('Η επιβεβαίωση μεταφοράς δεν συμφωνεί με την προεπισκόπηση ή τα δικαιώματά σας.');
    }
    if (!await auditCollectionChecker({ connection })) throw importError('Δεν είναι διαθέσιμη η υποχρεωτική καταγραφή της μεταφοράς.');
    const auditId = new Types.ObjectId().toHexString(), now = new Date();
    const provenance = { ...proposal.importDeclaration, version: 1, source: Import.SOURCE, status: 'VERIFIED',
        hireDate: new Date(proposal.importDeclaration.hireDate),
        trackingStartDate: new Date(proposal.importDeclaration.trackingStartDate),
        verifiedAt: now, verifiedBy: String(actorUserId), auditId };
    const updated = await employeeModel.updateOne({ ...scope, _id: employeeId },
        { $set: { [Import.FIELD]: provenance } }, { session, runValidators: true });
    if (updated.matchedCount !== 1) throw importError('Τα στοιχεία του εργαζομένου άλλαξαν κατά την αποθήκευση.');
    const audit = await auditModel.create([{ _id: auditId, employeeScope: { ...scope, employee_id: current._id },
        repairedAt: now, currentBefore: { _id: current._id, ...scope,
            hmeromhnia_proslhpshs: current.hmeromhnia_proslhpshs }, historyBefore: originalRows, historyAfter: originalRows,
        survivingHistoryIds: originalRows.map(row => String(row._id)), deletedLegacyHistoryIds: [],
        mutationSource: 'EMPLOYEE_HISTORY_IMPORT_VERIFIED', diagnostics: { actorUserId: String(actorUserId),
            provenance, planFingerprint: proposal.public.fingerprint } }], { session });
    if (audit?.length !== 1 || !audit[0]) throw importError('Δεν επιβεβαιώθηκε η καταγραφή της μεταφοράς.');
    const fresh = await employeeModel.findOne({ ...scope, _id: employeeId }).session(session).lean();
    const rows = await historyModel.find(scope).mongooseOptions({ includeRedundantHistoryArtifacts: true }).session(session).lean();
    const stableValue = require('./employeeHistoryAutomaticReconstructionApplyContract').stringify;
    const before = { ...current }, after = { ...fresh };
    for (const field of [Import.FIELD, 'updatedAt']) { delete before[field]; delete after[field]; }
    if (!Import.verifiedImport(fresh) || stableValue(fresh[Import.FIELD]) !== stableValue(provenance) ||
        stableValue(before) !== stableValue(after) ||
        stableValue([...originalRows].sort((a,b) => String(a._id).localeCompare(String(b._id)))) !==
        stableValue([...rows].sort((a,b) => String(a._id).localeCompare(String(b._id))))) {
        throw importError('Ο τελικός έλεγχος δεν επιβεβαίωσε ότι διατηρήθηκαν τα στοιχεία και το Ιστορικό.');
    }
    return { success: true, coverageGaps: employeeHistoryCoverageGaps({ currentEmployee: fresh, historyRows: rows }) };
}

module.exports = { planEmployeeImport, applyEmployeeImport, importError };
