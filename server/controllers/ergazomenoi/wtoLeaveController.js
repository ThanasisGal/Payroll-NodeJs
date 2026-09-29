'use strict';

const { CompaniesModel, PasswordsModel, YpokatasthmataModel } = require('../../models/companies');
const { ErgazomenoiErganhModel } = require('../../models/ergazomenoi');
const { UserPrivilegesModel } = require('../../models/privileges');
const { uploadJsonDocumentToErgani } = require('../../utils/erganh/jsonDocumentUploader');
const { loadWtoLeaveDataset } =
    require('../../services/ergazomenoi/wtoLeaveDatasetService');
const { buildWtoLeavePayloadFingerprint } =
    require('../../services/ergazomenoi/wtoLeaveSubmissionService');

function controllerError(code, message, statusCode = 400) {
    const error = new Error(message || code);
    error.code = code;
    error.statusCode = statusCode;
    return error;
}
function parseSubmitDate(value) {
    if (!value) return null;
    const raw = String(value).trim();
    const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(raw);
    if (match) {
        const [, day, month, year, hour = '00', minute = '00'] = match;
        const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}
function payloadDate(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || '').trim());
    return match ? new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`) : null;
}
function safeFilenamePart(value, fallback = 'UNKNOWN') {
    const cleaned = String(value || fallback).trim().replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_').substring(0, 80);
    return cleaned || fallback;
}
async function saveWtoLeavePdf({ pdfBuffer, contentType, team, company, restResult }) {
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.subarray(0, 5).toString() !== '%PDF-') {
        return { pdfSaved: false, pdfS3Key: null, pdfS3Url: null, pdfRelativePath: null,
            pdfFilename: null, pdfContentType: contentType || 'application/pdf', pdfSizeBytes: 0,
            pdfSaveError: 'Δεν υπάρχει έγκυρο PDF από το ΕΡΓΑΝΗ.' };
    }
    try {
        const { uploadBufferToS3 } = require('../../utils/s3Helper');
        const filename = `WTOLeave_${safeFilenamePart(restResult.protocol, 'NO_PROTOCOL')}_${safeFilenamePart(String(restResult.submitDate || '').replace(/\//g, '-'))}.pdf`;
        const companyKod = safeFilenamePart(company.kod || company.kodikos);
        const companyName = safeFilenamePart(company.eponymia || company.perigrafh);
        const key = `ergani-submissions/${safeFilenamePart(team, 'NO_TEAM')}/${companyKod}_${companyName}/WTOLeave/${filename}`;
        const uploaded = await uploadBufferToS3(pdfBuffer, key, contentType || 'application/pdf');
        return { pdfSaved: true, pdfS3Key: uploaded.s3Key,
            pdfS3Url: uploaded.s3Url || uploaded.localPath || null,
            pdfRelativePath: uploaded.s3Key, pdfFilename: filename,
            pdfContentType: contentType || 'application/pdf', pdfSizeBytes: pdfBuffer.length,
            pdfSaveError: null };
    } catch (error) {
        return { pdfSaved: false, pdfS3Key: null, pdfS3Url: null, pdfRelativePath: null,
            pdfFilename: null, pdfContentType: contentType || 'application/pdf',
            pdfSizeBytes: pdfBuffer.length, pdfSaveError: error.message || String(error) };
    }
}
function assertBrowserInput(body, { submit = false } = {}) {
    const allowed = new Set(['ypokatasthma', 'from_date', 'to_date', ...(submit ? ['request_id'] : [])]);
    const forbidden = ['WTOS', 'payload', 'rows', 'canonicalRows', 'employees', 'f_from_date', 'f_to_date'];
    if (forbidden.some((key) => body?.[key] !== undefined) ||
        Object.keys(body || {}).some((key) => !allowed.has(key) && key !== '_csrf')) {
        throw controllerError('WTOLEAVE_FORGED_AUTHORITATIVE_INPUT',
            'Το αίτημα περιέχει μη επιτρεπτά authoritative δεδομένα.', 400);
    }
}
function assertRequestId(value) {
    const requestId = String(value || '').trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(requestId)) {
        throw controllerError('WTOLEAVE_INVALID_REQUEST_ID',
            'Απαιτείται έγκυρο αναγνωριστικό αιτήματος.', 400);
    }
    return requestId;
}
function resolvedSubmissionIdentity(restResult) {
    const code = String(restResult?.submission?.code || '').trim();
    const id = Number(restResult?.submission?.id);
    if (code !== 'WTOLeave' || !Number.isInteger(id) || id !== 195) {
        throw controllerError('WTOLEAVE_RESOLVED_SUBMISSION_INVALID',
            'Το ΕΡΓΑΝΗ δεν επέστρεψε την αναμενόμενη ταυτότητα WTOLeave (195).', 502);
    }
    return { code, id };
}
function sendControllerError(res, error, fallback) {
    return res.status(error.statusCode || 500).json({ success: false,
        code: error.code || 'WTOLEAVE_INTERNAL_ERROR',
        message: error.statusCode ? error.message : fallback });
}

function createWtoLeaveController(dependencies = {}) {
    const Company = dependencies.CompaniesModel || CompaniesModel;
    const Password = dependencies.PasswordsModel || PasswordsModel;
    const Branch = dependencies.YpokatasthmataModel || YpokatasthmataModel;
    const Log = dependencies.ErgazomenoiErganhModel || ErgazomenoiErganhModel;
    const Privilege = dependencies.UserPrivilegesModel || UserPrivilegesModel;
    const loadDataset = dependencies.loadWtoLeaveDataset || loadWtoLeaveDataset;
    const upload = dependencies.uploadJsonDocumentToErgani || uploadJsonDocumentToErgani;
    const savePdf = dependencies.saveWtoLeavePdf || saveWtoLeavePdf;

    return {
        page: async (req, res) => {
            try {
                const scope = req.programmataAccessScope;
                const [company, branches, privilege] = await Promise.all([
                    Company.findOne({ _id: scope.companyId, team: scope.effectiveTeam }).lean(),
                    Branch.find({ companykod_object: scope.companyId, team: scope.effectiveTeam })
                        .sort({ kodikos: 1 }).lean(),
                    Privilege.findOne({ userId: req.session.userId, form: 'YpobolhAdeion' }).lean()
                ]);
                return res.render('ergazomenoi/programmata/ypovoliAdeion', {
                    locals: { title: 'Υποβολή Αδειών ΕΡΓΑΝΗ ΙΙ', description: 'WTOLeave' },
                    companyName: company?.eponymia || company?.perigrafh || company?.kod || '',
                    branches, userPrivileges: privilege?.privileges || {}, rec: {}
                });
            } catch (error) {
                return sendControllerError(res, error, 'Δεν ήταν δυνατή η φόρτωση της σελίδας WTOLeave.');
            }
        },
        preview: async (req, res) => {
            try {
                assertBrowserInput(req.body);
                const dataset = await loadDataset({ scope: req.programmataAccessScope, input: req.body });
                return res.json(dataset.response);
            } catch (error) {
                return sendControllerError(res, error, 'Η προεπισκόπηση WTOLeave απέτυχε.');
            }
        },
        submit: async (req, res) => {
            let externalSuccess = false;
            try {
                assertBrowserInput(req.body, { submit: true });
                const requestId = assertRequestId(req.body.request_id);
                const dataset = await loadDataset({ scope: req.programmataAccessScope, input: req.body });
                if (!dataset.response.submission_eligible || !dataset.payload || !dataset.parity.exact) {
                    throw controllerError('WTOLEAVE_PREVIEW_NOT_SUBMITTABLE',
                        'Τα authoritative δεδομένα WTOLeave δεν είναι επιλέξιμα για υποβολή.', 409);
                }
                const scope = dataset.authorized;
                const branchCode = String(dataset.branch.kodikos || '').trim();
                const fingerprint = buildWtoLeavePayloadFingerprint({ team: scope.team,
                    company: scope.company, branch: branchCode, payload: dataset.payload });
                const requestRecord = await Log.findOne({ team: scope.team,
                    companykod_object: scope.company, submission_code: 'WTOLeave',
                    request_id: requestId }).lean();
                if (requestRecord && requestRecord.payload_fingerprint !== fingerprint) {
                    throw controllerError('WTOLEAVE_REQUEST_ID_CONFLICT',
                        'Το request_id έχει χρησιμοποιηθεί για διαφορετικό authoritative payload.', 409);
                }
                if (requestRecord && (requestRecord.submission_status !== 'SUCCESS' ||
                    requestRecord.document_status !== 'ACTIVE')) {
                    throw controllerError('WTOLEAVE_REQUEST_ID_NOT_REUSABLE',
                        'Το request_id αντιστοιχεί σε μη ενεργή ή αποτυχημένη προσπάθεια.', 409);
                }
                const existing = requestRecord || await Log.findOne({ team: scope.team,
                    companykod_object: scope.company, ypokatasthma_kodikos: branchCode,
                    submission_code: 'WTOLeave', payload_fingerprint: fingerprint,
                    submission_status: 'SUCCESS', is_final: true, document_status: 'ACTIVE' }).lean();
                if (existing) return res.json({ success: true, idempotent: true,
                    submissionCode: 'WTOLeave', protocol: existing.protocol,
                    submitDate: existing.submit_date_text,
                    erganhSubmissionId: existing.erganh_submission_id,
                    erganhLogId: existing._id, pdfUrl: existing.pdf_s3_url || '' });

                const [company, password] = await Promise.all([
                    Company.findOne({ _id: scope.company, team: scope.team }).lean(),
                    Password.findOne({ team: scope.team, companykod_object: scope.company,
                        kodikos: '0002' }).lean()
                ]);
                if (!company || !password?.username || !password?.password) {
                    throw controllerError('WTOLEAVE_SUBMISSION_CONTEXT_MISSING',
                        'Λείπουν authoritative στοιχεία εταιρείας ή κωδικοί ΕΡΓΑΝΗ.', 409);
                }
                const restResult = await upload({ submissionCode: 'WTOLeave', payload: dataset.payload,
                    creds: { username: password.username, password: password.password,
                        userType: process.env.ERGANI_USERTYPE || '01' }, fetchSubmittedPdf: true });
                if (!restResult?.success) {
                    await Log.create({ team: scope.team, companykod_object: scope.company,
                        companykod: company.kod || company.kodikos || '',
                        ypokatasthma_object: dataset.branch._id, ypokatasthma_kodikos: branchCode,
                        submission_code: 'WTOLeave', submission_description:
                            'Οργάνωση Χρόνου Εργασίας - Άδειες', process_code: 'WTOLeave',
                        process_description: 'Υποβολή Αδειών', upload_method: 'REST',
                        environment: String(process.env.ERGANI_ENV || 'trial').toLowerCase(),
                        submission_status: 'FAILED', is_temporary: false, is_final: true,
                        document_status: 'ACTIVE', request_payload: dataset.payload,
                        payload_fingerprint: fingerprint, request_id: requestId,
                        erganh_raw_response: restResult?.raw || null,
                        error_message: restResult?.error || 'Η υποβολή WTOLeave απέτυχε.',
                        created_by_user: req.session.userId,
                        created_by_username: req.session.userName || req.session.username || '',
                        actor_role: req.session.userRole });
                    throw controllerError('WTOLEAVE_REST_SUBMISSION_FAILED',
                        restResult?.error || 'Η υποβολή WTOLeave απέτυχε.', 502);
                }
                externalSuccess = true;
                const identity = resolvedSubmissionIdentity(restResult);
                const submittedAt = parseSubmitDate(restResult.submitDate);
                if (!submittedAt || !restResult.protocol || !restResult.id) {
                    throw controllerError('WTOLEAVE_REST_RESULT_INCOMPLETE',
                        'Το REST αποτέλεσμα δεν περιέχει protocol, id και submitDate.', 502);
                }
                const pdf = await savePdf({ pdfBuffer: restResult?.submittedPdf?.buffer,
                    contentType: restResult?.submittedPdf?.contentType || 'application/pdf',
                    team: scope.team, company, restResult });
                const outer = dataset.payload.WTOS.WTO[0];
                const record = await Log.create({ team: scope.team,
                    companykod_object: scope.company, companykod: company.kod || company.kodikos || '',
                    ypokatasthma_object: dataset.branch._id, ypokatasthma_kodikos: branchCode,
                    submission_code: identity.code, submission_id: identity.id,
                    submission_description: restResult.submission?.description ||
                        'Οργάνωση Χρόνου Εργασίας - Άδειες',
                    process_code: 'WTOLeave', process_description: 'Υποβολή Αδειών',
                    upload_method: 'REST', environment: String(process.env.ERGANI_ENV || 'trial').toLowerCase(),
                    submission_status: 'SUCCESS', is_temporary: false, is_final: true,
                    document_status: 'ACTIVE', protocol: String(restResult.protocol),
                    submit_date_text: String(restResult.submitDate), submit_date: submittedAt,
                    erganh_submission_id: String(restResult.id),
                    employment_period_start: payloadDate(outer.f_from_date),
                    employment_period_end: payloadDate(outer.f_to_date),
                    submission_year: submittedAt.getFullYear(), submission_month: submittedAt.getMonth() + 1,
                    submission_day: submittedAt.getDate(), request_payload: dataset.payload,
                    payload_fingerprint: fingerprint, request_id: requestId,
                    erganh_raw_response: restResult.raw || null, error_message: pdf.pdfSaveError,
                    pdf_s3_key: pdf.pdfS3Key, pdf_s3_url: pdf.pdfS3Url,
                    pdf_relative_path: pdf.pdfRelativePath, pdf_filename: pdf.pdfFilename,
                    pdf_content_type: pdf.pdfContentType, pdf_size_bytes: pdf.pdfSizeBytes,
                    pdf_deferred: !pdf.pdfSaved, created_by_user: req.session.userId,
                    created_by_username: req.session.userName || req.session.username || '',
                    actor_role: req.session.userRole });
                return res.status(201).json({ success: true, idempotent: false,
                    submissionCode: 'WTOLeave', protocol: record.protocol,
                    submitDate: record.submit_date_text, erganhSubmissionId: record.erganh_submission_id,
                    erganhLogId: record._id, pdfUrl: record.pdf_s3_url || '',
                    pdfDeferred: record.pdf_deferred === true });
            } catch (error) {
                if (externalSuccess && !error.statusCode) {
                    error.code = 'WTOLEAVE_POST_SUBMISSION_LOGGING_FAILED';
                    error.statusCode = 500;
                }
                return sendControllerError(res, error, externalSuccess
                    ? 'Η υποβολή έγινε, αλλά απέτυχε η τοπική καταγραφή. Απαιτείται συμφωνία με το ΕΡΓΑΝΗ.'
                    : 'Η υποβολή WTOLeave απέτυχε.');
            }
        }
    };
}

const controller = createWtoLeaveController();
Object.defineProperty(controller, '__testHooks', { value: Object.freeze({ createWtoLeaveController,
    assertBrowserInput, assertRequestId, resolvedSubmissionIdentity, parseSubmitDate }), enumerable: false });

module.exports = controller;
