'use strict';

const assert = require('assert');
const controllerModule = require('./wtoLeaveController');
const { createWtoLeaveController } = controllerModule.__testHooks;

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
    saveWtoLeavePdf: async () => ({ pdfSaved: false, pdfS3Key: null, pdfS3Url: null,
        pdfRelativePath: null, pdfFilename: null, pdfContentType: 'application/pdf',
        pdfSizeBytes: 0, pdfSaveError: 'mocked-no-pdf' }),
    CompaniesModel: { findOne: () => lean({ _id: 'company-id', kod: 'C1', eponymia: 'ΕΤΑΙΡΕΙΑ' }) },
    PasswordsModel: { findOne: () => lean({ username: 'mock-user', password: 'mock-password' }) },
    YpokatasthmataModel: {}, UserPrivilegesModel: {},
    ErgazomenoiErganhModel: {
        findOne: () => lean(logFindResults.shift() || null),
        create: async (record) => { records.push(record); return { _id: 'log-1', ...record }; }
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
    await controller.submit(req, response);
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.success, true);
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
    console.log('PASS WTOLeave submit uses mocked generic uploader and persists canonical audit fields');
})().catch((error) => { console.error(error); process.exitCode = 1; });
