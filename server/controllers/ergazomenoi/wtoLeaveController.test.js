'use strict';

const assert = require('assert');
const controllerModule = require('./wtoLeaveController');
const { createWtoLeaveController, getWtoLeavePdfRoute, hasWtoLeavePdf } =
    controllerModule.__testHooks;

function lean(value) { return { lean: async () => value }; }
const payload = { WTOS: { WTO: [{ f_aa_pararthmatos: '0001', f_rel_protocol: '',
    f_rel_date: '', f_comments: '', f_from_date: '10/08/2026', f_to_date: '10/08/2026',
    Ergazomenoi: { ErgazomenoiWTO: [{ f_afm: '123456789', f_eponymo: 'ΔΟΚΙΜΗ',
        f_onoma: 'ΜΑΡΙΑ', f_date: '10/08/2026', ErgazomenosAnalytics: {
            ErgazomenosWTOAnalytics: [{ f_type: 'ΑΔΑΛΛΗ', f_from: '', f_to: '',
                f_year: '', f_req_days: '' }] } }] } }] } };
const dataset = { response: { success: true, submission_eligible: true }, payload,
    parity: { exact: true }, authorized: { team: 'TEAM1', company: '507f1f77bcf86cd799439011' },
    branch: { _id: 'branch-id', kodikos: '0001' } };
const uploads = [];
const records = [];
const logFindResults = [null, null];
const controller = createWtoLeaveController({
    loadWtoLeaveDataset: async () => dataset,
    uploadJsonDocumentToErgani: async (options) => {
        uploads.push(options);
        return { success: true, submission: { id: 195, code: 'WTOLeave',
            description: 'Οργάνωση Χρόνου Εργασίας - Άδειες' }, protocol: 'PROTO-1',
        submitDate: '10/08/2026 12:30', id: 'document-1', raw: { mocked: true },
        submittedPdf: { error: 'mocked-no-pdf' } };
    },
    saveWtoLeavePdf: async () => ({ pdfSaved: true,
        pdfS3Key: 'ergani-submissions/TEAM1/WTOLeave/result.pdf',
        pdfS3Url: 'https://private-bucket.example/result.pdf',
        pdfRelativePath: 'ergani-submissions/TEAM1/WTOLeave/result.pdf',
        pdfFilename: 'result.pdf', pdfContentType: 'application/pdf',
        pdfSizeBytes: 60887, pdfSaveError: null }),
    CompaniesModel: { findOne: () => lean({ _id: 'company-id', kod: 'C1', eponymia: 'ΕΤΑΙΡΕΙΑ' }) },
    PasswordsModel: { findOne: () => lean({ username: 'mock-user', password: 'mock-password' }) },
    YpokatasthmataModel: {}, UserPrivilegesModel: {},
    ErgazomenoiErganhModel: {
        findOne: () => lean(logFindResults.shift() || null),
        create: async (record) => { records.push(record); return {
            _id: '507f1f77bcf86cd799439012', ...record
        }; }
    }
});
const req = { body: { ypokatasthma: '0001', from_date: '2026-08-01',
    to_date: '2026-08-31', request_id: 'wtoleave-test-0001' },
session: { userId: 'user-1', userName: 'tester', userRole: 'A' },
programmatataAccessScope: {}, programmataAccessScope: { effectiveTeam: 'TEAM1',
    companyId: '507f1f77bcf86cd799439011' } };
const response = { statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };

(async () => {
    assert.equal(getWtoLeavePdfRoute('6abc231ef24b646c53158c4e'),
        '/ergazomenoi/ergazomenoi/ergani/pdf/6abc231ef24b646c53158c4e');
    assert.equal(hasWtoLeavePdf({ pdf_s3_key: 'stored-key' }), true);
    assert.equal(hasWtoLeavePdf({ pdf_relative_path: 'stored-path' }), true);
    assert.equal(hasWtoLeavePdf({ pdf_s3_url: 'stored-url' }), true);
    assert.equal(hasWtoLeavePdf({}), false);

    await controller.submit(req, response);
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.idempotent, false);
    assert.equal(uploads.length, 1, 'ο uploader καλείται μόνο μία φορά');
    assert.equal(uploads[0].submissionCode, 'WTOLeave');
    assert.deepStrictEqual(uploads[0].payload, payload);
    assert.equal(uploads[0].fetchSubmittedPdf, true);
    assert.equal(records.length, 1);
    assert.equal(records[0].submission_code, 'WTOLeave');
    assert.equal(records[0].submission_id, 195);
    assert.equal(records[0].request_id, 'wtoleave-test-0001');
    assert.match(records[0].payload_fingerprint, /^[a-f0-9]{64}$/);
    assert.deepStrictEqual(records[0].request_payload, payload);
    assert.equal(response.body.pdfSaved, true);
    assert.equal(response.body.pdfDeferred, false);
    assert.equal(response.body.pdfUrl,
        '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439012');
    assert.ok(!JSON.stringify(response.body).includes('private-bucket.example'));

    let reusedUploaderCalls = 0;
    const existing = { _id: '6abc231ef24b646c53158c4e', protocol: 'ΟΡ70202286',
        submit_date_text: '10/08/2026 12:30', erganh_submission_id: 'document-existing',
        pdf_s3_url: 'https://private-bucket.example/existing.pdf',
        pdf_deferred: false, pdf_size_bytes: 60887,
        payload_fingerprint: records[0].payload_fingerprint,
        submission_status: 'SUCCESS', document_status: 'ACTIVE' };
    const reusedController = createWtoLeaveController({
        loadWtoLeaveDataset: async () => dataset,
        uploadJsonDocumentToErgani: async () => { reusedUploaderCalls += 1; },
        CompaniesModel: { findOne: () => { throw new Error('company lookup must not run'); } },
        PasswordsModel: { findOne: () => { throw new Error('password lookup must not run'); } },
        YpokatasthmataModel: {}, UserPrivilegesModel: {},
        ErgazomenoiErganhModel: {
            findOne: () => lean(existing),
            create: async () => { throw new Error('create must not run for idempotent reuse'); }
        }
    });
    const reusedResponse = { statusCode: 200, body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; } };
    await reusedController.submit(req, reusedResponse);
    assert.equal(reusedResponse.statusCode, 200);
    assert.equal(reusedResponse.body.success, true);
    assert.equal(reusedResponse.body.idempotent, true);
    assert.equal(reusedResponse.body.protocol, 'ΟΡ70202286');
    assert.equal(reusedResponse.body.pdfSaved, true);
    assert.equal(reusedResponse.body.pdfDeferred, false);
    assert.equal(reusedResponse.body.pdfUrl,
        '/ergazomenoi/ergazomenoi/ergani/pdf/6abc231ef24b646c53158c4e');
    assert.ok(!JSON.stringify(reusedResponse.body).includes('private-bucket.example'));
    assert.equal(reusedUploaderCalls, 0, 'η reused διαδρομή δεν καλεί τον ERGANI uploader');

    let deferredUploaderCalls = 0;
    const deferredExisting = { ...existing, _id: '507f1f77bcf86cd799439013',
        pdf_s3_url: '', pdf_deferred: true };
    const deferredController = createWtoLeaveController({
        loadWtoLeaveDataset: async () => dataset,
        uploadJsonDocumentToErgani: async () => { deferredUploaderCalls += 1; },
        CompaniesModel: { findOne: () => { throw new Error('company lookup must not run'); } },
        PasswordsModel: { findOne: () => { throw new Error('password lookup must not run'); } },
        YpokatasthmataModel: {}, UserPrivilegesModel: {},
        ErgazomenoiErganhModel: {
            findOne: () => lean(deferredExisting),
            create: async () => { throw new Error('create must not run for idempotent reuse'); }
        }
    });
    const deferredResponse = { statusCode: 200, body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; } };
    await deferredController.submit(req, deferredResponse);
    assert.equal(deferredResponse.body.idempotent, true);
    assert.equal(deferredResponse.body.pdfSaved, false);
    assert.equal(deferredResponse.body.pdfDeferred, true);
    assert.equal(deferredResponse.body.pdfUrl, '');
    assert.equal(deferredUploaderCalls, 0, 'η deferred reused διαδρομή δεν καλεί τον uploader');
    console.log('PASS WTOLeave new submit and idempotent reuse keep uploader behavior distinct');
})().catch((error) => { console.error(error); process.exitCode = 1; });
