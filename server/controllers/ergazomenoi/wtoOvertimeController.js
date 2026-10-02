'use strict';

const { CompaniesModel, PasswordsModel, YpokatasthmataModel } = require('../../models/companies');
const { ErgazomenoiErganhModel } = require('../../models/ergazomenoi');
const { UserPrivilegesModel } = require('../../models/privileges');
const { PeriodsModel } = require('../../models/stathera_arxeia');
const { uploadJsonDocumentToErgani } = require('../../utils/erganh/jsonDocumentUploader');
const { loadWtoOvertimeDataset } =
    require('../../services/ergazomenoi/wtoOvertimeDatasetService');
const { buildWtoOvertimePayloadFingerprint } =
    require('../../services/ergazomenoi/wtoOvertimeSubmissionService');
const { REQUIRED_INDEXES, exactIndex } =
    require('../../services/ergazomenoi/wtoDailySubmissionIndexGuardService');

const SUBMISSION_CODE = 'WTOOvA';
const SUBMISSION_ID = 233;
const SUBMISSION_DESCRIPTION = 'Οργάνωση Χρόνου Εργασίας - Υπερωρίες - Απολογιστικό';
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const CLAIM_INDEX_NAME = 'unique_ergani_submission_command_request';
const CLAIM_INDEX = REQUIRED_INDEXES.find((index) => index.name === CLAIM_INDEX_NAME);

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
function getWtoOvertimePdfRoute(id) {
    return id ? `/ergazomenoi/ergazomenoi/ergani/pdf/${id}` : '';
}
function hasWtoOvertimePdf(record = {}) {
    return !!(record.pdf_s3_key || record.pdf_relative_path || record.pdf_s3_url);
}
async function saveWtoOvertimePdf({ pdfBuffer, contentType, team, company, restResult }) {
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.subarray(0, 5).toString() !== '%PDF-') {
        return { pdfSaved: false, pdfS3Key: null, pdfS3Url: null, pdfRelativePath: null,
            pdfFilename: null, pdfContentType: contentType || 'application/pdf', pdfSizeBytes: 0,
            pdfSaveError: 'Δεν υπάρχει έγκυρο PDF από το ΕΡΓΑΝΗ.' };
    }
    try {
        const { uploadBufferToS3 } = require('../../utils/s3Helper');
        const filename = `WTOOvA_${safeFilenamePart(restResult.protocol, 'NO_PROTOCOL')}_${safeFilenamePart(String(restResult.submitDate || '').replace(/\//g, '-'))}.pdf`;
        const companyKod = safeFilenamePart(company.kod || company.kodikos);
        const companyName = safeFilenamePart(company.eponymia || company.perigrafh);
        const key = `ergani-submissions/${safeFilenamePart(team, 'NO_TEAM')}/${companyKod}_${companyName}/WTOOvA/${filename}`;
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
    const allowed = new Set(['ypokatasthma', 'from_date', 'to_date',
        ...(submit ? ['request_id', 'preview_fingerprint'] : [])]);
    const forbidden = ['WTOS', 'payload', 'rows', 'canonicalRows', 'employees',
        'f_from_date', 'f_to_date', 'f_from', 'f_to'];
    if (forbidden.some((key) => body?.[key] !== undefined) ||
        Object.keys(body || {}).some((key) => !allowed.has(key) && key !== '_csrf')) {
        throw controllerError('WTOOVA_FORGED_AUTHORITATIVE_INPUT',
            'Το αίτημα περιέχει μη επιτρεπτά authoritative δεδομένα.', 400);
    }
}
function assertPreviewFingerprint(value) {
    const fingerprint = String(value || '').trim();
    if (!FINGERPRINT_PATTERN.test(fingerprint)) {
        throw controllerError('WTOOVA_INVALID_PREVIEW_FINGERPRINT',
            'Απαιτείται νέα έγκυρη προεπισκόπηση πριν από την υποβολή.', 400);
    }
    return fingerprint;
}
function assertRequestId(value) {
    const requestId = String(value || '').trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(requestId)) {
        throw controllerError('WTOOVA_INVALID_REQUEST_ID',
            'Απαιτείται έγκυρο αναγνωριστικό αιτήματος.', 400);
    }
    return requestId;
}
function datasetFingerprint(dataset) {
    if (!dataset?.payload || dataset?.parity?.exact !== true) return null;
    const team = String(dataset.authorized?.team || '').trim();
    const company = String(dataset.authorized?.company || '').trim();
    const branch = String(dataset.branch?.kodikos || '').trim();
    if (!team || !company || !branch) return null;
    return buildWtoOvertimePayloadFingerprint({ team, company, branch, payload: dataset.payload });
}
function claimRequestId(fingerprint) {
    if (!FINGERPRINT_PATTERN.test(String(fingerprint || ''))) {
        throw controllerError('WTOOVA_INVALID_CLAIM_FINGERPRINT',
            'Δεν ήταν δυνατή η δημιουργία ασφαλούς αξίωσης υποβολής.', 500);
    }
    return `wtoova:${fingerprint}`;
}
async function assertWtoOvertimeClaimIndexReady({ loader } = {}) {
    try {
        const indexes = await loader();
        const actual = Array.isArray(indexes)
            ? indexes.find((index) => index?.name === CLAIM_INDEX_NAME) : null;
        if (!CLAIM_INDEX || !exactIndex(actual, CLAIM_INDEX)) throw new Error('INDEX_NOT_READY');
    } catch (_) {
        throw controllerError('WTOOVA_CLAIM_INDEX_NOT_READY',
            'Ο ασφαλής index υποβολής WTOOvA δεν είναι διαθέσιμος. Η υποβολή WTOOvA δεν επιχειρήθηκε.', 503);
    }
}
function exactKeyPattern(actual, expected) {
    if (!actual || typeof actual !== 'object') return false;
    return JSON.stringify(actual) === JSON.stringify(expected);
}
function duplicateMessageIdentifiesClaimIndex(message) {
    const escapedName = CLAIM_INDEX_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`index:\\s*${escapedName}(?=\\s|$)`).test(String(message || ''));
}
function isExpectedClaimDuplicateKeyError(error) {
    const code = error?.code ?? error?.errorResponse?.code;
    if (code !== 11000 && code !== 11001) return false;
    const keyPattern = error?.keyPattern ?? error?.errorResponse?.keyPattern;
    const keyPatternPresent = keyPattern !== undefined;
    const keyPatternMatches = exactKeyPattern(keyPattern, CLAIM_INDEX?.key);
    if (keyPatternPresent && !keyPatternMatches) return false;
    const explicitIndexNames = [error?.index, error?.indexName,
        error?.errorResponse?.index, error?.errorResponse?.indexName]
        .filter((value) => typeof value === 'string' && value.trim());
    if (explicitIndexNames.some((name) => name !== CLAIM_INDEX_NAME)) return false;
    const messageMatches = [error?.message, error?.errmsg, error?.errorResponse?.errmsg]
        .some(duplicateMessageIdentifiesClaimIndex);
    return keyPatternMatches || explicitIndexNames.includes(CLAIM_INDEX_NAME) || messageMatches;
}
function isReusableRecord(record) {
    return record?.submission_status === 'SUCCESS' && record.document_status === 'ACTIVE' &&
        record.is_final === true && record.reconciliation_required !== true;
}
function reusedResponse(record) {
    const pdfSaved = hasWtoOvertimePdf(record);
    return { success: true, idempotent: true, status: 'REUSED',
        submissionCode: SUBMISSION_CODE, protocol: record.protocol,
        submitDate: record.submit_date_text, erganhSubmissionId: record.erganh_submission_id,
        erganhLogId: record._id, pdfSaved, pdfDeferred: record.pdf_deferred === true,
        pdfUrl: pdfSaved ? getWtoOvertimePdfRoute(record._id) : '' };
}
function classifyExistingClaim(record, fingerprint) {
    if (!record) {
        throw controllerError('WTOOVA_SUBMISSION_IN_PROGRESS',
            'Η ίδια canonical υποβολή έχει ήδη δεσμευτεί και βρίσκεται σε εξέλιξη.', 409);
    }
    if (record.payload_fingerprint !== fingerprint) {
        throw controllerError('WTOOVA_CLAIM_CONFLICT',
            'Η διαρκής αξίωση δεν αντιστοιχεί στο canonical payload.', 409);
    }
    if (isReusableRecord(record)) {
        return reusedResponse(record);
    }
    if (record.reconciliation_required === true) {
        throw controllerError('WTOOVA_SUBMISSION_REQUIRES_RECONCILIATION',
            'Η προηγούμενη προσπάθεια ενδέχεται να έχει γίνει δεκτή από το ΕΡΓΑΝΗ, αλλά δεν οριστικοποιήθηκε τοπικά. Απαιτείται συμφωνία πριν από νέα προσπάθεια.', 409);
    }
    if (record.submission_status === 'TEMPORARY' && record.document_status === 'ACTIVE') {
        throw controllerError('WTOOVA_SUBMISSION_IN_PROGRESS',
            'Η ίδια canonical υποβολή βρίσκεται ήδη σε εξέλιξη. Μην επαναλάβετε την υποβολή.', 409);
    }
    throw controllerError('WTOOVA_SUBMISSION_REQUIRES_RECONCILIATION',
        'Υπάρχει μη ασφαλώς οριστικοποιημένη προηγούμενη προσπάθεια. Απαιτείται συμφωνία με το ΕΡΓΑΝΗ πριν από νέα προσπάθεια.', 409);
}
function resolvedSubmissionIdentity(restResult) {
    const code = String(restResult?.submission?.code || '').trim();
    const id = Number(restResult?.submission?.id);
    if (code !== SUBMISSION_CODE || !Number.isInteger(id) || id !== SUBMISSION_ID) {
        throw controllerError('WTOOVA_RESOLVED_SUBMISSION_INVALID',
            `Το ΕΡΓΑΝΗ δεν επέστρεψε την αναμενόμενη ταυτότητα ${SUBMISSION_CODE} (${SUBMISSION_ID}).`, 502);
    }
    return { code, id };
}
function sendControllerError(res, error, fallback) {
    return res.status(error.statusCode || 500).json({ success: false,
        code: error.code || 'WTOOVA_INTERNAL_ERROR',
        message: error.statusCode ? error.message : fallback });
}

function createWtoOvertimeController(dependencies = {}) {
    const Company = dependencies.CompaniesModel || CompaniesModel;
    const Password = dependencies.PasswordsModel || PasswordsModel;
    const Branch = dependencies.YpokatasthmataModel || YpokatasthmataModel;
    const Log = dependencies.ErgazomenoiErganhModel || ErgazomenoiErganhModel;
    const Privilege = dependencies.UserPrivilegesModel || UserPrivilegesModel;
    const Period = dependencies.PeriodsModel || PeriodsModel;
    const loadDataset = dependencies.loadWtoOvertimeDataset || loadWtoOvertimeDataset;
    const upload = dependencies.uploadJsonDocumentToErgani || uploadJsonDocumentToErgani;
    const savePdf = dependencies.saveWtoOvertimePdf || saveWtoOvertimePdf;
    const assertClaimIndexReady = dependencies.assertWtoOvertimeClaimIndexReady ||
        (() => assertWtoOvertimeClaimIndexReady({ loader: () => Log.collection.indexes() }));

    return {
        page: async (req, res) => {
            try {
                const scope = req.programmataAccessScope;
                const [company, branches, privilege, periodRec] = await Promise.all([
                    Company.findOne({ _id: scope.companyId, team: scope.effectiveTeam }).lean(),
                    Branch.find({ companykod_object: scope.companyId, team: scope.effectiveTeam })
                        .sort({ kodikos: 1 }).lean(),
                    Privilege.findOne({ userId: req.session.userId,
                        form: 'ApologistikosPinakasYperorion' }).lean(),
                    Period.findOne({ xrhsh: req.session.yearInUse,
                        kodikos: req.session.periodInUse }).lean()
                ]);
                return res.render('ergazomenoi/programmata/apologistikosPinakasYperorion', {
                    locals: { title: 'Απολογιστικός Πίνακας Υπερωριών',
                        description: SUBMISSION_CODE },
                    companyName: company?.eponymia || company?.perigrafh || company?.kod || '',
                    branches, userPrivileges: privilege?.privileges || {}, periodRec, rec: {}
                });
            } catch (error) {
                return sendControllerError(res, error,
                    'Δεν ήταν δυνατή η φόρτωση της σελίδας απολογιστικών υπερωριών.');
            }
        },
        preview: async (req, res) => {
            try {
                assertBrowserInput(req.body);
                const dataset = await loadDataset({ scope: req.programmataAccessScope, input: req.body });
                return res.json({ ...dataset.response,
                    preview_fingerprint: dataset.response.submission_eligible
                        ? datasetFingerprint(dataset)
                        : null });
            } catch (error) {
                return sendControllerError(res, error, 'Η προεπισκόπηση WTOOvA απέτυχε.');
            }
        },
        submit: async (req, res) => {
            let externalSuccess = false;
            let claim = null;
            try {
                assertBrowserInput(req.body, { submit: true });
                assertRequestId(req.body.request_id);
                const previewFingerprint = assertPreviewFingerprint(req.body.preview_fingerprint);
                const dataset = await loadDataset({ scope: req.programmataAccessScope, input: req.body });
                const scope = dataset.authorized;
                const branchCode = String(dataset.branch.kodikos || '').trim();
                const fingerprint = datasetFingerprint(dataset);
                if (!dataset.response.submission_eligible || !dataset.payload ||
                    dataset.parity?.exact !== true || fingerprint !== previewFingerprint) {
                    throw controllerError('WTOOVA_PREVIEW_STALE',
                        'Τα authoritative δεδομένα άλλαξαν μετά την προεπισκόπηση. Εκτελέστε νέα προεπισκόπηση πριν από την υποβολή.', 409);
                }
                const existing = await Log.findOne({ team: scope.team,
                    companykod_object: scope.company, ypokatasthma_kodikos: branchCode,
                    submission_code: SUBMISSION_CODE, payload_fingerprint: fingerprint,
                    submission_status: 'SUCCESS', is_final: true,
                    document_status: 'ACTIVE', reconciliation_required: { $ne: true } }).lean();
                if (existing) {
                    return res.json(classifyExistingClaim(existing, fingerprint));
                }
                const ambiguous = await Log.findOne({ team: scope.team,
                    companykod_object: scope.company, ypokatasthma_kodikos: branchCode,
                    submission_code: SUBMISSION_CODE, payload_fingerprint: fingerprint }).lean();
                if (ambiguous) return res.json(classifyExistingClaim(ambiguous, fingerprint));

                await assertClaimIndexReady();

                const [company, password] = await Promise.all([
                    Company.findOne({ _id: scope.company, team: scope.team }).lean(),
                    Password.findOne({ team: scope.team, companykod_object: scope.company,
                        kodikos: '0002' }).lean()
                ]);
                if (!company || !password?.username || !password?.password) {
                    throw controllerError('WTOOVA_SUBMISSION_CONTEXT_MISSING',
                        'Λείπουν canonical στοιχεία εταιρείας ή κωδικοί ΕΡΓΑΝΗ.', 409);
                }
                const outer = dataset.payload.WTOS.WTO[0];
                const durableRequestId = claimRequestId(fingerprint);
                try {
                    claim = await Log.create({ team: scope.team, companykod_object: scope.company,
                        companykod: company.kod || company.kodikos || '',
                        ypokatasthma_object: dataset.branch._id, ypokatasthma_kodikos: branchCode,
                        submission_code: SUBMISSION_CODE, submission_description: SUBMISSION_DESCRIPTION,
                        process_code: SUBMISSION_CODE,
                        process_description: 'Απολογιστικός Πίνακας Υπερωριών', upload_method: 'REST',
                        environment: String(process.env.ERGANI_ENV || 'trial').toLowerCase(),
                        submission_status: 'TEMPORARY', is_temporary: true, is_final: false,
                        document_status: 'ACTIVE', employment_period_start: payloadDate(outer.f_from_date),
                        employment_period_end: payloadDate(outer.f_to_date), request_payload: dataset.payload,
                        payload_fingerprint: fingerprint, request_id: durableRequestId,
                        created_by_user: req.session.userId,
                        created_by_username: req.session.userName || req.session.username || '',
                        actor_role: req.session.userRole });
                } catch (error) {
                    if (!isExpectedClaimDuplicateKeyError(error)) throw error;
                    const existingClaim = await Log.findOne({ team: scope.team,
                        companykod_object: scope.company, submission_code: SUBMISSION_CODE,
                        request_id: durableRequestId }).lean();
                    return res.json(classifyExistingClaim(existingClaim, fingerprint));
                }
                const restResult = await upload({ submissionCode: SUBMISSION_CODE,
                    payload: dataset.payload, creds: { username: password.username,
                        password: password.password,
                        userType: process.env.ERGANI_USERTYPE || '01' }, fetchSubmittedPdf: true });
                if (!restResult?.success) {
                    await Log.findOneAndUpdate({ _id: claim._id, submission_status: 'TEMPORARY' },
                        { $set: { submission_status: 'FAILED', is_temporary: false, is_final: true,
                            erganh_raw_response: restResult?.raw || null,
                            error_message: restResult?.error || 'Η υποβολή WTOOvA απέτυχε.' } },
                        { new: true }).lean();
                    throw controllerError('WTOOVA_REST_SUBMISSION_FAILED',
                        restResult?.error || 'Η υποβολή WTOOvA απέτυχε.', 502);
                }
                externalSuccess = true;
                const identity = resolvedSubmissionIdentity(restResult);
                const submittedAt = parseSubmitDate(restResult.submitDate);
                if (!submittedAt || !restResult.protocol || !restResult.id) {
                    throw controllerError('WTOOVA_REST_RESULT_INCOMPLETE',
                        'Το REST αποτέλεσμα δεν περιέχει protocol, id και submitDate.', 502);
                }
                const pdf = await savePdf({ pdfBuffer: restResult?.submittedPdf?.buffer,
                    contentType: restResult?.submittedPdf?.contentType || 'application/pdf',
                    team: scope.team, company, restResult });
                const record = await Log.findOneAndUpdate({ _id: claim._id,
                    submission_status: 'TEMPORARY', payload_fingerprint: fingerprint }, { $set: {
                    submission_code: identity.code, submission_id: identity.id,
                    submission_description: restResult.submission?.description || SUBMISSION_DESCRIPTION,
                    submission_status: 'SUCCESS', is_temporary: false, is_final: true,
                    protocol: String(restResult.protocol), submit_date_text: String(restResult.submitDate),
                    submit_date: submittedAt, erganh_submission_id: String(restResult.id),
                    submission_year: submittedAt.getFullYear(),
                    submission_month: submittedAt.getMonth() + 1,
                    submission_day: submittedAt.getDate(), erganh_raw_response: restResult.raw || null,
                    error_message: pdf.pdfSaveError, pdf_s3_key: pdf.pdfS3Key,
                    pdf_s3_url: pdf.pdfS3Url, pdf_relative_path: pdf.pdfRelativePath,
                    pdf_filename: pdf.pdfFilename, pdf_content_type: pdf.pdfContentType,
                    pdf_size_bytes: pdf.pdfSizeBytes, pdf_deferred: !pdf.pdfSaved,
                    reconciliation_required: false
                } }, { new: true }).lean();
                if (!record) throw new Error('WTOOVA_CLAIM_FINALIZATION_FAILED');
                return res.status(201).json({ success: true, idempotent: false,
                    status: 'SUBMITTED', submissionCode: SUBMISSION_CODE,
                    protocol: record.protocol, submitDate: record.submit_date_text,
                    erganhSubmissionId: record.erganh_submission_id, erganhLogId: record._id,
                    pdfSaved: hasWtoOvertimePdf(record),
                    pdfUrl: hasWtoOvertimePdf(record) ? getWtoOvertimePdfRoute(record._id) : '',
                    pdfDeferred: record.pdf_deferred === true });
            } catch (error) {
                if (externalSuccess) {
                    if (claim?._id) {
                        try {
                            await Log.findOneAndUpdate({ _id: claim._id,
                                submission_status: 'TEMPORARY' }, { $set: {
                                reconciliation_required: true,
                                error_message: 'EXTERNAL_SUCCESS_LOCAL_FINALIZATION_FAILED'
                            } }, { new: true }).lean();
                        } catch (_) {
                            // The TEMPORARY claim itself remains the durable fail-closed barrier.
                        }
                    }
                    return sendControllerError(res, controllerError(
                        'WTOOVA_POST_SUBMISSION_LOGGING_FAILED',
                        'Η υποβολή έγινε, αλλά απέτυχε η τοπική οριστικοποίηση. Απαιτείται συμφωνία με το ΕΡΓΑΝΗ πριν από νέα προσπάθεια.', 500),
                    'Η υποβολή έγινε, αλλά απέτυχε η τοπική οριστικοποίηση.');
                }
                return sendControllerError(res, error, 'Η υποβολή WTOOvA απέτυχε.');
            }
        },
        deprecatedLegacy: (_req, res) => res.status(410).json({ success: false,
            code: 'WTOOVA_LEGACY_ROUTE_GONE',
            message: 'Η παλιά XML ροή υπερωριών έχει καταργηθεί. Χρησιμοποιήστε τη canonical WTOOvA φόρμα.' })
    };
}

const controller = createWtoOvertimeController();
Object.defineProperty(controller, '__testHooks', { value: Object.freeze({
    createWtoOvertimeController, assertBrowserInput, assertRequestId, assertPreviewFingerprint,
    datasetFingerprint, claimRequestId, assertWtoOvertimeClaimIndexReady,
    classifyExistingClaim, isReusableRecord, isExpectedClaimDuplicateKeyError,
    resolvedSubmissionIdentity, parseSubmitDate, getWtoOvertimePdfRoute,
    hasWtoOvertimePdf, SUBMISSION_CODE, SUBMISSION_ID, SUBMISSION_DESCRIPTION,
    CLAIM_INDEX_NAME, CLAIM_INDEX
}), enumerable: false });

module.exports = controller;
