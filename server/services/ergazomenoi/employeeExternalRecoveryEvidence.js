'use strict';
const D = require('./employeeHistoryDeferralService');
const C = require('../../utils/ergazomenoi/employmentProfileContract');

const VERSION = 'employee-external-attempt:v1';
function submissionCode(type, parameters = {}) {
    return { E3N: 'WebE3N', E5N: 'WebE5N', E7N: 'WebE7N', MA: 'WebMA', WTO: 'WTOWeek',
        E6N: parameters.processCode === '221' ? 'WebE6NMP' : 'WebE6NXP' }[type] || null;
}
function identity(record, current, type) {
    const p = record.parameters || {};
    const day = value => { try { return C.calendarDate(value)?.toISOString().slice(0, 10) || null; } catch { return null; } };
    return { version: VERSION, team: current.team, companyId: String(current.company_kod),
        employeeId: String(current._id), employeeCode: current.kodikos, employeeAfm: current.afm || null,
        actorUserId: record.actorUserId, selectionKey: record.key, type, method: p.method,
        processCode: type === 'E3N' ? '213' : type === 'WTO' ? '182' : p.processCode,
        submissionCode: submissionCode(type, p), branch: p.branch, hire: p.hire,
        effectiveDate: type === 'MA' ? day(p.mutationDate) : type === 'WTO' ? p.scheduleFrom :
            type === 'E3N' ? p.hire : p.departure,
        effectiveUntil: type === 'WTO' ? p.scheduleUntil : null,
        environment: p.method === 'xml' ? 'production' : String(process.env.ERGANI_ENV || 'trial').trim().toLowerCase() };
}
function providerProcessCode(i) {
    if (i.type === 'MA' && i.processCode !== '230') return null; // No verified REST 231 contract here.
    return { E3N: i.environment === 'production' ? 'ma_213' : 'ma_93',
        E5N: i.environment === 'production' ? 'ma_217' : 'ma_101', E7N: 'ma_222',
        E6N: `ma_${i.processCode}`, MA: i.environment === 'production' ? 'ma_230' : 'ma_127',
        WTO: i.environment === 'production' ? 'ma_182' : 'ma_80' }[i.type] || null;
}
function completeIdentity(attempt) {
    const i = attempt?.identity;
    return i?.version === VERSION && attempt.identityDigest === D.digest(i) &&
        ['team', 'companyId', 'employeeId', 'employeeCode', 'employeeAfm', 'actorUserId', 'selectionKey',
            'type', 'method', 'processCode', 'submissionCode', 'branch', 'hire', 'effectiveDate']
            .every(field => typeof i[field] === 'string' && i[field].length > 0) &&
        ['trial', 'production'].includes(i.environment) && (i.type !== 'WTO' || Boolean(i.effectiveUntil));
}
function providerDate(value) {
    const text = String(value || '').trim();
    const local = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/.exec(text);
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T|\s|$)/.exec(text);
    const parts = local ? [local[3], local[2], local[1]] : iso?.slice(1);
    if (!parts) return null;
    const date = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    return date.toISOString().slice(0, 10) === parts.join('-') ? parts.join('-') : null;
}
function receipt(raw) {
    if (Array.isArray(raw) && raw.length !== 1) return null;
    const first = Array.isArray(raw) ? raw[0] : raw;
    if (!first || typeof first !== 'object' || first.success === false || first.Success === false ||
        first.error || first.Error || first.errors?.length || first.Errors?.length) return null;
    const one = keys => {
        const values = keys.filter(key => first[key] != null).map(key => first[key]);
        return values.length && values.every(value => ['string', 'number'].includes(typeof value) &&
            String(value).trim() && String(value).trim() === String(values[0]).trim()) ? String(values[0]).trim() : null;
    };
    const protocol = one(['protocol', 'Protocol', 'protocolNumber', 'ProtocolNumber', 'arithmosProtokollou', 'arithmos_protokollou']);
    const id = one(['id', 'Id', 'submissionId', 'SubmissionId', 'documentId', 'DocumentId']);
    const submitDate = one(['submitDate', 'SubmitDate', 'issuedDate', 'IssuedDate', 'date', 'Date']);
    return protocol && id && submitDate && providerDate(submitDate) ? { protocol, id, submitDate } : null;
}
const branch = value => /^\d+$/.test(String(value ?? '')) ? String(BigInt(String(value))) : null;
function payloadMatchesIdentity(payload, i) {
    if (i.type === 'WTO') {
        const rows = payload?.WTOS?.WTO;
        if (!Array.isArray(rows) || rows.length !== 1) return false;
        const row = rows[0], employees = row.Ergazomenoi?.ErgazomenoiWTO;
        return branch(row.f_aa_pararthmatos) === branch(i.branch) &&
            providerDate(row.f_from_date) === i.effectiveDate &&
            providerDate(row.f_to_date) === i.effectiveUntil && Array.isArray(employees) && employees.length > 0 &&
            employees.every(employee => employee.f_afm === i.employeeAfm);
    }
    const suffix = i.type === 'E6N' ? (i.processCode === '221' ? 'E6NMP' : 'E6NXP') : i.type;
    const rows = payload?.[`Anaggelies${suffix}`]?.[`Anaggelia${suffix}`];
    if (!Array.isArray(rows) || rows.length !== 1) return false;
    const row = rows[0], dateField = { E3N: 'f_proslipsidate', E5N: 'f_apoxwrisidate',
        E6N: 'f_apolysisdate', E7N: 'f_apolysisdate', MA: 'f_date_metabolhs' }[i.type];
    return row.f_afm === i.employeeAfm && branch(row.f_aa_pararthmatos) === branch(i.branch) &&
        providerDate(row[dateField]) === i.effectiveDate &&
        (i.type === 'MA' || providerDate(row.f_proslipsidate) === i.hire);
}

// Only a server-correlated, exact-payload provider acknowledgement is positive
// evidence. A missing row/PDF/receipt, timeout, HTTP rejection or local FAILED
// flag NEVER establishes non-dispatch. This module has no network dependency.
function verify(attempt, logs) {
    const blocked = reason => ({ verified: false, reason });
    if (!completeIdentity(attempt)) return blocked('IDENTITY_UNVERIFIABLE');
    const i = attempt.identity, request = attempt.request;
    if (i.method !== 'rest') return blocked('XML_VERIFICATION_UNAVAILABLE');
    if (!request || request.environment !== i.environment || request.submissionCode !== i.submissionCode ||
        !/^[a-f0-9]{64}$/.test(request.payloadFingerprint)) return blocked('REQUEST_CORRELATION_UNAVAILABLE');
    if (logs.length !== 1) return blocked(logs.length ? 'AMBIGUOUS_PROVIDER_EVIDENCE' : 'PROVIDER_OUTCOME_UNAVAILABLE');
    const log = logs[0], expectedProcess = providerProcessCode(i);
    if (!expectedProcess || log.request_id !== attempt.id || log.team !== i.team ||
        String(log.companykod_object) !== i.companyId || String(log.ergazomenos_object) !== i.employeeId ||
        log.ergazomenos_kodikos !== i.employeeCode || log.ergazomenos_afm !== i.employeeAfm ||
        String(log.created_by_user) !== i.actorUserId || log.environment !== i.environment ||
        log.submission_code !== i.submissionCode || log.process_code !== expectedProcess ||
        log.upload_method !== 'REST' || branch(log.ypokatasthma_kodikos) !== branch(i.branch) || branch(i.branch) === null ||
        log.payload_fingerprint !== request.payloadFingerprint || !log.request_payload ||
        D.digest(log.request_payload) !== request.payloadFingerprint || !payloadMatchesIdentity(log.request_payload, i))
        return blocked('PROVIDER_IDENTITY_MISMATCH');
    if (log.submission_status !== 'SUCCESS' || log.is_final !== true || log.is_temporary !== false ||
        log.is_cancelled === true || log.document_status !== 'ACTIVE') return blocked('NO_VERIFIED_ACCEPTANCE');
    const accepted = receipt(log.erganh_raw_response);
    if (!accepted || log.protocol !== accepted.protocol || String(log.erganh_submission_id) !== accepted.id ||
        log.submit_date_text !== accepted.submitDate) return blocked('RECEIPT_UNVERIFIABLE');
    return { verified: true, reason: 'PROVIDER_RECEIPT_VERIFIED', receipt: accepted,
        evidence: { source: 'ErgazomenoiErganh.provider_acknowledgement', logId: String(log._id),
            digest: D.digest(log), attemptId: attempt.id, identityDigest: attempt.identityDigest,
            payloadFingerprint: request.payloadFingerprint, environment: i.environment } };
}
function providerLogFields(req, payload) {
    const context = req.employeeExternalAction;
    // Do not add null request_id to unrelated submission paths or unique indexes.
    return context?.attemptId && context.payloadFingerprint === D.digest(payload) ?
        { request_id: context.attemptId, payload_fingerprint: context.payloadFingerprint } : {};
}
module.exports = { VERSION, identity, submissionCode, completeIdentity, receipt, verify, providerLogFields };
