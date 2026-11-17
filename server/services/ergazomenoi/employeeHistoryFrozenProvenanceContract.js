'use strict';
const crypto = require('node:crypto');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const P = require('./employeeHistoryApprovedProposalContract');
const F = require('./apasxoliseisPeriodFrozenSnapshotService');
const { extractEmployeeHistoryReferences } = require('./employeeHistoryReferenceDefinitionsService');
const VERSIONS = Object.freeze(['employment-period-frozen:v1', 'employment-period-frozen:v2', 'employment-period-frozen:v3']);
const keys = new Set(['snapshot_schema_version', 'source_calculation_version', 'scope', 'employees',
    'weekly_calculation_context', 'daily_results', 'payroll_results', 'deviations', 'canonical_decisions',
    'applied_repo_transfers', 'payroll_phase_facts', 'policy_context']);
// v2/v3's original writer excludes only transfer actor/time audit noise from
// its fingerprint. v1 also admits an exact canonical payload hash. In either
// case the separate wire-BSON evidence binds EVERY byte, including that noise.
function storedFrozenFingerprint(snapshot, exact = false) {
    const value = exact ? snapshot : { ...snapshot, applied_repo_transfers: (snapshot.applied_repo_transfers || []).map(row => {
        const projected = { ...row };
        for (const key of ['created_by_user_id', 'created_by_user_name', 'created_by_user_role', 'applied_at', 'created_at']) delete projected[key];
        return projected;
    }) };
    return crypto.createHash('sha256').update(JSON.stringify(F.canonicalize(value))).digest('hex');
}
function verifyStoredFrozenProvenance(doc, scope, historyId) {
    const snapshot = doc?.frozen_snapshot;
    const fail = check => {
        const error = P.failure('REFERENCE'); error.referenceCheck = check;
        const explanations = {
            FROZEN_FINGERPRINT_MISMATCH: 'Το αποθηκευμένο περιεχόμενο δεν συμφωνεί με το καταγεγραμμένο αποτύπωμά του.',
            FROZEN_REFERENCE_IDENTITY_MISMATCH: 'Δεν συμφωνούν η ιστορική αναφορά και η ταυτότητα εργαζομένου ή εταιρείας.',
            FROZEN_HOURS_NOT_SELF_CONTAINED: 'Δεν αποδεικνύονται αυτοτελώς οι αποθηκευμένες ώρες της περιόδου.',
            FROZEN_EMPLOYEE_RESULTS_REQUIRED: 'Λείπουν τα αυτοτελή αποθηκευμένα αποτελέσματα ή η ταυτότητα του εργαζομένου.'
        };
        error.problems = [{ fieldId: 'PROTECTED_SNAPSHOT', field: 'Προστατευμένο παγωμένο αποτέλεσμα',
            problem: explanations[check] || 'Η παλαιά μορφή του αποθηκευμένου αποτελέσματος δεν αποδεικνύει ασφαλή ανεξαρτησία από το σημερινό Ιστορικό.',
            cause: 'Η ιστορική διόρθωση πρέπει να διατηρεί όλες τις παλιές ώρες, αποδοχές και αναφορές ακριβώς αμετάβλητες.',
            action: '1. Διατηρήστε τα φορτωμένα ΜΕΤΑ. 2. Ελέγξτε το αρχικό αρχειοθετημένο αποτέλεσμα στην αναγνωστική προβολή της συγκεκριμένης περιόδου. 3. Για διαφορά αποδοχών χρησιμοποιήστε μόνο την υπάρχουσα διορθωτική μισθοδοσία· αυτή δεν πιστοποιεί άγνωστα ιστορικά γεγονότα. Δεν αποθηκεύτηκε καμία αλλαγή.' }];
        throw error;
    };
    if (!snapshot || !VERSIONS.includes(snapshot.snapshot_schema_version) ||
        doc.snapshot_schema_version !== snapshot.snapshot_schema_version ||
        typeof snapshot.source_calculation_version !== 'string' || !snapshot.source_calculation_version.trim() ||
        doc.source_calculation_version !== snapshot.source_calculation_version ||
        Object.keys(snapshot).some(key => !keys.has(key))) fail('UNSUPPORTED_FROZEN_SCHEMA');
    const wrapperKeys = new Set(Object.keys(require('../../models/apasxoliseisPeriodFrozenSnapshot').schema.paths));
    if (Object.keys(doc).some(key => !wrapperKeys.has(key))) fail('UNKNOWN_FROZEN_WRAPPER_SHAPE');
    if (doc.team !== scope.team || doc.company_kod !== scope.company_kod ||
        typeof doc.ypokatasthma !== 'string' || !doc.ypokatasthma.trim() || doc.ypokatasthma !== doc.ypokatasthma.trim() ||
        !(doc.period_start instanceof Date) || !(doc.period_end instanceof Date) ||
        !Number.isFinite(new Date(doc.period_start).getTime()) || !Number.isFinite(new Date(doc.period_end).getTime()) ||
        new Date(doc.period_start) > new Date(doc.period_end)) fail('FROZEN_SCOPE_REQUIRED');
    if (!snapshot.scope || ['team', 'company_kod', 'ypokatasthma'].some(key => String(snapshot.scope[key]) !== String(doc[key])) ||
        ['period_start', 'period_end'].some(key => new Date(snapshot.scope[key]).getTime() !== new Date(doc[key]).getTime())) fail('FROZEN_SCOPE_MISMATCH');
    for (const field of ['employees', 'daily_results', 'payroll_results', 'deviations', 'canonical_decisions', 'applied_repo_transfers'])
        if (!Array.isArray(snapshot[field])) fail('FROZEN_STORED_RESULTS_REQUIRED');
    const temporalFields = require('../../utils/ergazomenoi/employmentProfileTemporal').profileSelect().split(/\s+/);
    const assertRows = (rows, fields) => {
        const known = new Set(fields);
        if (rows.some(row => !row || typeof row !== 'object' || Array.isArray(row) ||
            Object.keys(row).some(key => !known.has(key)))) fail('UNKNOWN_FROZEN_RESULT_SHAPE');
    };
    assertRows(snapshot.daily_results, F.DAILY_FIELDS);
    assertRows(snapshot.employees, [...F.EMPLOYEE_FIELDS, ...temporalFields]);
    assertRows(snapshot.payroll_results, F.PAYROLL_FIELDS);
    if (snapshot.snapshot_schema_version !== VERSIONS[0] && (!snapshot.weekly_calculation_context ||
        !Array.isArray(snapshot.weekly_calculation_context.rows) || !Array.isArray(snapshot.weekly_calculation_context.profile_history)))
        fail('FROZEN_WEEKLY_CONTEXT_REQUIRED');
    if (snapshot.weekly_calculation_context) {
        const context = snapshot.weekly_calculation_context;
        if (Object.keys(context).some(key => !['rows', 'profile_history', 'calendar_facts', 'applied_transfer_protection'].includes(key)))
            fail('UNKNOWN_FROZEN_WEEKLY_SHAPE');
        assertRows(context.rows || [], F.DAILY_FIELDS);
        assertRows(context.profile_history || [], [...F.HISTORY_FIELDS, ...temporalFields]);
    }
    const expected = doc.frozen_snapshot_fingerprint;
    if (!/^[a-f\d]{64}$/.test(expected || '') || expected !== storedFrozenFingerprint(snapshot) &&
        !(snapshot.snapshot_schema_version === VERSIONS[0] && expected === storedFrozenFingerprint(snapshot, true))) fail('FROZEN_FINGERPRINT_MISMATCH');
    let targets;
    try { targets = extractEmployeeHistoryReferences('Apasxoliseis_Period_Frozen_Snapshots', [doc]); }
    catch { fail('FROZEN_REFERENCE_IDENTITY_UNKNOWN'); }
    const target = targets.filter(item => item.historyId === historyId);
    if (historyId && (!target.length || target.some(item => item.team !== scope.team || item.company_kod !== scope.company_kod || item.kodikos !== scope.kodikos)))
        fail('FROZEN_REFERENCE_IDENTITY_MISMATCH');
    const rows = snapshot.daily_results.filter(row => row.kodikos === scope.kodikos);
    if (historyId && !rows.length || rows.length && !snapshot.employees.some(employee => employee.kodikos === scope.kodikos)) fail('FROZEN_EMPLOYEE_RESULTS_REQUIRED');
    for (const row of rows) {
        if (typeof row.ores_ergasias_apologistika !== 'number' || !Number.isFinite(row.ores_ergasias_apologistika) ||
            Object.entries(row).some(([key, value]) => /^ores_/.test(key) && value != null && (typeof value !== 'number' || !Number.isFinite(value))))
            fail('FROZEN_HOURS_NOT_SELF_CONTAINED');
    }
    // The official legacy reader is a pure stored-payload projection. Exercise
    // it here; no current employee/history model is supplied or dereferenced.
    let projected;
    try { projected = require('./apasxoliseisStoredReviewReadService').projectStoredFrozenReview({ snapshot,
        scope: { team: doc.team, company_kod: doc.company_kod, ypokatasthma: doc.ypokatasthma,
            period_start: doc.period_start, period_end: doc.period_end }, kodikos: scope.kodikos }); }
    catch { fail('FROZEN_STORED_PROJECTION_CHANGED'); }
    if (!Array.isArray(projected.rows) || projected.rows.length !== rows.length ||
        projected.rows.some((row, index) => !A.equal(row.ores_ergasias_apologistika, rows[index].ores_ergasias_apologistika))) fail('FROZEN_STORED_PROJECTION_CHANGED');
    return { schemaVersion: snapshot.snapshot_schema_version, fingerprint: expected };
}
module.exports = { VERSIONS, storedFrozenFingerprint, verifyStoredFrozenProvenance };
