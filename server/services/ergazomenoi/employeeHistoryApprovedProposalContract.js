'use strict';
const crypto = require('node:crypto');
const A = require('./employeeHistoryAutomaticReconstructionApplyContract');
const C = require('./employeeHistoryAutomaticReconstructionContract');
const OPERATION = 'EMPLOYEE_HISTORY_APPROVED_XLSX_APPLY';
const FLAG = 'PAYROLL_EMPLOYEE_HISTORY_APPROVED_XLSX_APPLY_ENABLED';
const VERSION = 'approved-history-proposal:v3';
const transactionOptions = { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' };
const proofs = new WeakSet();
const permittedFields = Object.freeze([...C.PROFILE_FIELDS, C.CHANGE, C.START, C.END, C.CONTRACT_END,
    'hmeromhnia_allaghs_orarioy_apo', 'hmeromhnia_allaghs_orarioy_eos']);
const enabled = (env = process.env) => env[FLAG] === 'true';
function failure(reason, statusCode = 409) {
    return Object.assign(Error(reason), { reason, code: `${OPERATION}_${reason}`, statusCode });
}
function exactKeys(value, keys) {
    return value && typeof value === 'object' && !Array.isArray(value) && A.equal(Object.keys(value).sort(), [...keys].sort());
}
function request(value) {
    if (!exactKeys(value, ['selection', 'completion']) || typeof value.selection !== 'string' ||
        value.selection && !/^(UPDATE:[a-f\d]{24}|INSERT:history-case-[A-Za-z\d_-]{24})$/i.test(value.selection) ||
        !exactKeys(value.completion, ['caseId', 'snapshotFingerprint', 'context', 'changes'])) throw failure('REQUEST', 400);
    return value;
}
function sign(payload, secret) {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${data}.${crypto.createHmac('sha256', secret).update(data).digest('base64url')}`;
}
function verify(token, secret) {
    if (typeof token !== 'string' || token.length > 4096) throw failure('APPROVAL', 400);
    const [data, signature, extra] = token.split('.');
    if (!data || !signature || extra || !A.tokenMatches(signature, crypto.createHmac('sha256', secret).update(data).digest('base64url')))
        throw failure('APPROVAL', 409);
    let payload;
    try { payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); } catch { throw failure('APPROVAL'); }
    if (payload.version !== VERSION || !/^[a-f\d]{64}$/.test(payload.approvalId || '') || !Number.isSafeInteger(payload.expiresAt)) throw failure('APPROVAL');
    return payload;
}
function sealExecution(proof) { proofs.add(proof); return proof; }
function assertExecution(proof, { currentBefore, filter, employeeId, session, currentPatch, deleteCurrent }) {
    if (!proofs.has(proof) || !proof.isEnabled() || !session?.inTransaction() || deleteCurrent || Object.keys(currentPatch).length ||
        !A.equal(proof.current, currentBefore) || !A.equal(proof.scope, filter) || String(currentBefore._id) !== String(employeeId) ||
        !A.equal(currentBefore, { ...proof.originalCurrent,
            employee_profile_mutation_sequence: (proof.originalCurrent.employee_profile_mutation_sequence || 0) + 1 }) ||
        proof.payload.executionEnabled !== true || proof.payload.approved !== true || proof.payload.fingerprint !== proof.fingerprint ||
        proof.payload.binding.actorUserId !== proof.actorUserId || proof.payload.binding.employeeId !== String(employeeId) ||
        !A.equal(proof.payload.binding.scope, filter) || typeof proof.evidence !== 'string' || proof.evidence.length > 4000 || proof.declaration !== 'Ναι' ||
        Object.keys(proof.patch).some(field => !permittedFields.includes(field) &&
            !(proof.operation === 'UPDATE' && proof.certification && require('./employeeHistoryProfileCertificationService').metadata.includes(field))) ||
        proof.before.some(row => !C.SCOPE_FIELDS.every(field => row[field] === filter[field])) ||
        new Set(proof.before.map(row => String(row._id))).size !== proof.before.length)
        throw failure('BOUNDARY');
    if (proof.operation === 'UPDATE') {
        const original = proof.before.find(row => String(row._id) === proof.targetHistoryId);
        if (!original || !A.equal(proof.candidate, { ...original, ...proof.patch })) throw failure('BOUNDARY');
        if (proof.certification) {
            if (!A.equal(proof.certificationApproval, { ...proof.payload, purpose: 'PROFILE_CERTIFICATION' }) ||
                proof.payload.certificationHash !== A.hash(proof.certification) ||
                !require('./employeeHistoryProfileCertificationService').assertCertificate(original, proof.candidate, proof.patch, proof.certification))
                throw failure('BOUNDARY');
        } else if (proof.certificationApproval || proof.payload.certificationHash) throw failure('BOUNDARY');
    } else if (proof.operation === 'INSERT') {
        if (proof.certification || proof.certificationApproval || proof.payload.certificationHash) throw failure('BOUNDARY');
        const Profile = require('../../utils/ergazomenoi/employmentProfileContract');
        const structural = [...C.SCOPE_FIELDS, C.HIRE, 'afora_proslhpsh', 'afora_allagh_oron_ergasias',
            'afora_allagh_dialleimatos', Profile.SCHEMA_VERSION, Profile.TYPE_VERSION];
        if (proof.targetHistoryId !== null || proof.candidate.afora_proslhpsh !== false || proof.candidate.afora_allagh_oron_ergasias !== true ||
            proof.candidate.afora_allagh_dialleimatos !== true || proof.candidate[Profile.SCHEMA_VERSION] !== Profile.EMPLOYMENT_PROFILE_SCHEMA_VERSION ||
            !A.equal(proof.candidate.hmeromhnia_isxyos_dialleimatos_apo, proof.candidate[C.START]) ||
            Object.keys(proof.candidate).some(field => !permittedFields.includes(field) && !structural.includes(field)) ||
            !C.SCOPE_FIELDS.every(field => proof.candidate[field] === filter[field])) throw failure('BOUNDARY');
    } else throw failure('BOUNDARY');
}
module.exports = { VERSION, FLAG, OPERATION, enabled, failure, exactKeys, request, sign, verify,
    transactionOptions, permittedFields, sealExecution, assertExecution };
