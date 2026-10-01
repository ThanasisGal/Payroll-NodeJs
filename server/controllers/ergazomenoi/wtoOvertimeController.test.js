'use strict';

const assert = require('assert');
const controllerModule = require('./wtoOvertimeController');
const { createWtoOvertimeController, assertBrowserInput, resolvedSubmissionIdentity,
    getWtoOvertimePdfRoute, hasWtoOvertimePdf } = controllerModule.__testHooks;

function lean(value) { return { lean: async () => value }; }
const payload = { WTOS: { WTO: [{ f_aa_pararthmatos: '0001', f_rel_protocol: '',
    f_rel_date: '', f_comments: '', f_from_date: '10/08/2026', f_to_date: '10/08/2026',
    Ergazomenoi: { ErgazomenoiWTO: [{ f_afm: '123456789', f_eponymo: 'ΔΟΚΙΜΗ',
        f_onoma: 'ΜΑΡΙΑ', f_date: '10/08/2026', ErgazomenosAnalytics: {
            ErgazomenosWTOAnalytics: [{ f_type: 'ΥΠ', f_from: '17:01', f_to: '18:31' }]
        } }] } }] } };
const dataset = { response: { success: true, submission_eligible: true }, payload,
    parity: { exact: true }, authorized: { team: 'TEAM1', company: '507f1f77bcf86cd799439011' },
    branch: { _id: 'branch-id', kodikos: '0001' } };
const req = { body: { ypokatasthma: '0001', from_date: '2026-08-01',
    to_date: '2026-08-31', request_id: 'wtoova-test-0001' },
session: { userId: 'user-1', userName: 'tester', userRole: 'A' },
programmatataAccessScope: {}, programmataAccessScope: { effectiveTeam: 'TEAM1',
    companyId: '507f1f77bcf86cd799439011' } };
function response() { return { statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } }; }

(async () => {
    assert.equal(getWtoOvertimePdfRoute('6abc231ef24b646c53158c4e'),
        '/ergazomenoi/ergazomenoi/ergani/pdf/6abc231ef24b646c53158c4e');
    assert.equal(hasWtoOvertimePdf({ pdf_s3_key: 'stored-key' }), true);
    assert.equal(hasWtoOvertimePdf({}), false);
    assert.throws(() => assertBrowserInput({ ...req.body, rows: [] }, { submit: true }),
        /authoritative δεδομένα/);
    assert.throws(() => assertBrowserInput({ ...req.body, payload }, { submit: true }),
        /authoritative δεδομένα/);
    assert.deepStrictEqual(resolvedSubmissionIdentity({ submission: { code: 'WTOOvA', id: 233 } }),
        { code: 'WTOOvA', id: 233 });
    assert.throws(() => resolvedSubmissionIdentity({ submission: { code: 'WTOOvA', id: 232 } }),
        /WTOOvA \(233\)/);

    let renderedPage;
    const pageController = createWtoOvertimeController({
        CompaniesModel: { findOne: () => lean({ _id: 'company-id', eponymia: 'ΕΤΑΙΡΕΙΑ' }) },
        YpokatasthmataModel: { find: () => ({ sort: () => lean([{ kodikos: '0000' }]) }) },
        UserPrivilegesModel: { findOne: (filter) => {
            assert.equal(filter.form, 'ApologistikosPinakasYperorion');
            return lean({ privileges: { export: true } });
        } },
        PeriodsModel: { findOne: () => lean({ apo: new Date('2026-08-01T00:00:00.000Z'),
            eos: new Date('2026-08-31T00:00:00.000Z'), status: 'OPEN' }) },
        ErgazomenoiErganhModel: {}, PasswordsModel: {}
    });
    await pageController.page({ programmataAccessScope: { companyId: 'company-id',
        effectiveTeam: 'TEAM1' }, session: { userId: 'user-1', yearInUse: 2026,
        periodInUse: '08' } }, { render(view, data) { renderedPage = { view, data }; } });
    assert.equal(renderedPage.view, 'ergazomenoi/programmata/apologistikosPinakasYperorion');
    assert.equal(renderedPage.data.periodRec.status, 'OPEN');

    const uploads = [];
    const records = [];
    const logFindResults = [null, null];
    const controller = createWtoOvertimeController({
        loadWtoOvertimeDataset: async () => dataset,
        uploadJsonDocumentToErgani: async (options) => {
            uploads.push(options);
            return { success: true, submission: { id: 233, code: 'WTOOvA',
                description: 'Οργάνωση Χρόνου Εργασίας - Υπερωρίες - Απολογιστικό' },
            protocol: 'PROTO-OV-1', submitDate: '10/08/2026 12:30', id: 'document-1',
            raw: { mocked: true }, submittedPdf: { error: 'mocked-no-pdf' } };
        },
        saveWtoOvertimePdf: async () => ({ pdfSaved: true,
            pdfS3Key: 'ergani-submissions/TEAM1/WTOOvA/result.pdf',
            pdfS3Url: 'https://private-bucket.example/result.pdf',
            pdfRelativePath: 'ergani-submissions/TEAM1/WTOOvA/result.pdf',
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
    const submitted = response();
    await controller.submit(req, submitted);
    assert.equal(submitted.statusCode, 201);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].submissionCode, 'WTOOvA');
    assert.deepStrictEqual(uploads[0].payload, payload);
    assert.equal(uploads[0].fetchSubmittedPdf, true);
    assert.equal(records[0].submission_code, 'WTOOvA');
    assert.equal(records[0].submission_id, 233);
    assert.match(records[0].payload_fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(submitted.body.pdfUrl,
        '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439012');
    assert.ok(!JSON.stringify(submitted.body).includes('private-bucket.example'));

    let reusedUploaderCalls = 0;
    const existing = { _id: '6abc231ef24b646c53158c4e', protocol: 'ΟΡ70202286',
        submit_date_text: '10/08/2026 12:30', erganh_submission_id: 'document-existing',
        pdf_s3_url: 'https://private-bucket.example/existing.pdf', pdf_deferred: false,
        payload_fingerprint: records[0].payload_fingerprint,
        submission_status: 'SUCCESS', document_status: 'ACTIVE' };
    const reusedController = createWtoOvertimeController({
        loadWtoOvertimeDataset: async () => dataset,
        uploadJsonDocumentToErgani: async () => { reusedUploaderCalls += 1; },
        CompaniesModel: { findOne: () => { throw new Error('company lookup must not run'); } },
        PasswordsModel: { findOne: () => { throw new Error('password lookup must not run'); } },
        YpokatasthmataModel: {}, UserPrivilegesModel: {},
        ErgazomenoiErganhModel: { findOne: () => lean(existing),
            create: async () => { throw new Error('create must not run'); } }
    });
    const reused = response();
    await reusedController.submit(req, reused);
    assert.equal(reused.body.status, 'REUSED');
    assert.equal(reused.body.idempotent, true);
    assert.equal(reused.body.pdfUrl,
        '/ergazomenoi/ergazomenoi/ergani/pdf/6abc231ef24b646c53158c4e');
    assert.ok(!JSON.stringify(reused.body).includes('private-bucket.example'));
    assert.equal(reusedUploaderCalls, 0, 'η επαναχρησιμοποίηση δεν καλεί τον ERGANI uploader');

    const deferredController = createWtoOvertimeController({
        loadWtoOvertimeDataset: async () => dataset,
        uploadJsonDocumentToErgani: async () => { throw new Error('uploader must not run'); },
        CompaniesModel: {}, PasswordsModel: {}, YpokatasthmataModel: {}, UserPrivilegesModel: {},
        ErgazomenoiErganhModel: { findOne: () => lean({ ...existing,
            _id: '507f1f77bcf86cd799439013', pdf_s3_url: '', pdf_deferred: true }),
        create: async () => { throw new Error('create must not run'); } }
    });
    const deferred = response();
    await deferredController.submit(req, deferred);
    assert.equal(deferred.body.pdfSaved, false);
    assert.equal(deferred.body.pdfDeferred, true);
    assert.equal(deferred.body.pdfUrl, '');

    const gone = response();
    controller.deprecatedLegacy({}, gone);
    assert.equal(gone.statusCode, 410);
    assert.equal(gone.body.code, 'WTOOVA_LEGACY_ROUTE_GONE');
    console.log('PASS WTOOvA server rebuild, identity 233, idempotency and safe PDF responses');
})().catch((error) => { console.error(error); process.exitCode = 1; });
