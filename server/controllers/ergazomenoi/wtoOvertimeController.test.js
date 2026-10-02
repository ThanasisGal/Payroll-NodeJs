'use strict';

const assert = require('assert');
const controllerModule = require('./wtoOvertimeController');
const {
    createWtoOvertimeController, assertBrowserInput, assertPreviewFingerprint,
    datasetFingerprint, claimRequestId, classifyExistingClaim, isReusableRecord,
    isExpectedClaimDuplicateKeyError, resolvedSubmissionIdentity,
    getWtoOvertimePdfRoute, hasWtoOvertimePdf, CLAIM_INDEX_NAME, CLAIM_INDEX
} = controllerModule.__testHooks;

function lean(value) { return { lean: async () => value }; }
function response() {
    return { statusCode: 200, body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; } };
}
function request(previewFingerprint, requestId = 'wtoova-test-0001') {
    return { body: { ypokatasthma: '0001', from_date: '2026-08-01',
        to_date: '2026-08-31', request_id: requestId,
        preview_fingerprint: previewFingerprint },
    session: { userId: 'user-1', userName: 'tester', userRole: 'A' },
    programmataAccessScope: { effectiveTeam: 'TEAM1',
        companyId: '507f1f77bcf86cd799439011' } };
}

const payload = { WTOS: { WTO: [{ f_aa_pararthmatos: '0001', f_rel_protocol: '',
    f_rel_date: '', f_comments: '', f_from_date: '10/08/2026', f_to_date: '10/08/2026',
    Ergazomenoi: { ErgazomenoiWTO: [{ f_afm: '123456789', f_eponymo: 'ΔΟΚΙΜΗ',
        f_onoma: 'ΜΑΡΙΑ', f_date: '10/08/2026', ErgazomenosAnalytics: {
            ErgazomenosWTOAnalytics: [{ f_type: 'ΥΠ', f_from: '17:15', f_to: '18:45' }]
        } }] } }] } };
const changedPayload = JSON.parse(JSON.stringify(payload));
changedPayload.WTOS.WTO[0].Ergazomenoi.ErgazomenoiWTO[0]
    .ErgazomenosAnalytics.ErgazomenosWTOAnalytics[0].f_to = '19:00';

function dataset(value = payload) {
    return { response: { success: true, submission_eligible: true,
        parity: { exact: true }, employee_count: 1, employee_day_count: 1,
        total_submitted_overtime_minutes: 90 },
    payload: value, parity: { exact: true },
    authorized: { team: 'TEAM1', company: '507f1f77bcf86cd799439011' },
    branch: { _id: 'branch-id', kodikos: '0001' } };
}
const fingerprint = datasetFingerprint(dataset());
const changedFingerprint = datasetFingerprint(dataset(changedPayload));

function matches(record, filter) {
    return Object.entries(filter).every(([key, value]) => {
        if (value && typeof value === 'object' &&
            Object.prototype.hasOwnProperty.call(value, '$ne')) {
            return record[key] !== value.$ne;
        }
        return String(record[key]) === String(value);
    });
}
function claimIndex(overrides = {}) {
    return { name: CLAIM_INDEX.name, key: CLAIM_INDEX.key, unique: CLAIM_INDEX.unique,
        partialFilterExpression: CLAIM_INDEX.partialFilterExpression, ...overrides };
}
function expectedDuplicateError() {
    return Object.assign(new Error(
        `E11000 duplicate key error index: ${CLAIM_INDEX_NAME} dup key`), {
        code: 11000, keyPattern: CLAIM_INDEX.key
    });
}
function createLogStore({ failSuccessFinalization = false, failReconciliationUpdate = false,
    indexes = [claimIndex()], indexError = null, initialRecords = [] } = {}) {
    const records = initialRecords.map((record) => ({ ...record }));
    const counts = { create: 0, indexes: 0 };
    let sequence = 1;
    return { records, counts, model: {
        collection: { async indexes() {
            counts.indexes += 1;
            if (indexError) throw indexError;
            return indexes;
        } },
        findOne(filter) {
            return lean(records.find((record) => matches(record, filter)) || null);
        },
        async create(value) {
            counts.create += 1;
            const duplicate = records.find((record) => record.team === value.team &&
                String(record.companykod_object) === String(value.companykod_object) &&
                record.request_id === value.request_id && record.submission_code === value.submission_code);
            if (duplicate) throw expectedDuplicateError();
            const record = { _id: String(sequence++).padStart(24, '0'), ...value };
            records.push(record);
            return record;
        },
        findOneAndUpdate(filter, update) {
            return { lean: async () => {
                if (failSuccessFinalization && update?.$set?.submission_status === 'SUCCESS') {
                    throw new Error('mocked local finalization failure');
                }
                if (failReconciliationUpdate && update?.$set?.reconciliation_required === true) {
                    throw new Error('mocked reconciliation update failure');
                }
                const record = records.find((item) => matches(item, filter));
                if (!record) return null;
                Object.assign(record, update.$set || {});
                return record;
            } };
        }
    } };
}
function successResult() {
    return { success: true, submission: { id: 233, code: 'WTOOvA',
        description: 'Οργάνωση Χρόνου Εργασίας - Υπερωρίες - Απολογιστικό' },
    protocol: 'PROTO-OV-1', submitDate: '10/08/2026 12:30', id: 'document-1',
    raw: { mocked: true }, submittedPdf: { error: 'mocked-no-pdf' } };
}
function existingRecord(overrides = {}) {
    return { _id: '6abc231ef24b646c53158c4e', team: 'TEAM1',
        companykod_object: '507f1f77bcf86cd799439011', ypokatasthma_kodikos: '0001',
        submission_code: 'WTOOvA', payload_fingerprint: fingerprint,
        request_id: `wtoova:${fingerprint}`, submission_status: 'SUCCESS',
        document_status: 'ACTIVE', is_final: true, reconciliation_required: false,
        protocol: 'ΟΡ70202286', submit_date_text: '10/08/2026 12:30',
        erganh_submission_id: 'document-existing', ...overrides };
}
function dependencies({ store, loadDataset = async () => dataset(), upload, savePdf,
    companyModel, passwordModel } = {}) {
    return {
        loadWtoOvertimeDataset: loadDataset,
        uploadJsonDocumentToErgani: upload || (async () => successResult()),
        saveWtoOvertimePdf: savePdf || (async () => ({ pdfSaved: true,
            pdfS3Key: 'ergani-submissions/TEAM1/WTOOvA/result.pdf',
            pdfS3Url: 'https://private-bucket.example/result.pdf',
            pdfRelativePath: 'ergani-submissions/TEAM1/WTOOvA/result.pdf',
            pdfFilename: 'result.pdf', pdfContentType: 'application/pdf',
            pdfSizeBytes: 60887, pdfSaveError: null })),
        CompaniesModel: companyModel || { findOne: () => lean({ _id: 'company-id', kod: 'C1', eponymia: 'ΕΤΑΙΡΕΙΑ' }) },
        PasswordsModel: passwordModel || { findOne: () => lean({ username: 'mock-user', password: 'mock-password' }) },
        YpokatasthmataModel: {}, UserPrivilegesModel: {},
        ErgazomenoiErganhModel: store.model
    };
}

(async () => {
    assert.match(fingerprint, /^[a-f0-9]{64}$/);
    assert.notEqual(fingerprint, changedFingerprint);
    assert.equal(claimRequestId(fingerprint), `wtoova:${fingerprint}`);
    assert.equal(getWtoOvertimePdfRoute('6abc231ef24b646c53158c4e'),
        '/ergazomenoi/ergazomenoi/ergani/pdf/6abc231ef24b646c53158c4e');
    assert.equal(hasWtoOvertimePdf({ pdf_s3_key: 'stored-key' }), true);
    assert.equal(hasWtoOvertimePdf({}), false);
    assert.throws(() => assertPreviewFingerprint('bad'), /έγκυρη προεπισκόπηση/);
    assert.throws(() => assertBrowserInput({ ...request(fingerprint).body, rows: [] }, { submit: true }),
        /authoritative δεδομένα/);
    assert.throws(() => assertBrowserInput({ ...request(fingerprint).body, payload }, { submit: true }),
        /authoritative δεδομένα/);
    assert.throws(() => assertBrowserInput({ ypokatasthma: '0001', from_date: '2026-08-01',
        to_date: '2026-08-31', preview_fingerprint: fingerprint }), /authoritative δεδομένα/);
    assert.deepStrictEqual(resolvedSubmissionIdentity({ submission: { code: 'WTOOvA', id: 233 } }),
        { code: 'WTOOvA', id: 233 });
    assert.throws(() => resolvedSubmissionIdentity({ submission: { code: 'WTOOvA', id: 232 } }),
        /WTOOvA \(233\)/);
    assert.equal(isReusableRecord(existingRecord()), true);
    assert.equal(isReusableRecord(existingRecord({ reconciliation_required: true })), false);
    assert.equal(isReusableRecord(existingRecord({ is_final: false })), false);
    assert.equal(isExpectedClaimDuplicateKeyError(expectedDuplicateError()), true);
    assert.equal(isExpectedClaimDuplicateKeyError(Object.assign(new Error(
        `E11000 duplicate key error collection: test.logs index: ${CLAIM_INDEX_NAME} dup key`),
    { code: 11000 })), true);
    assert.equal(isExpectedClaimDuplicateKeyError({ code: 11000,
        indexName: CLAIM_INDEX_NAME }), true);
    assert.equal(isExpectedClaimDuplicateKeyError(Object.assign(new Error(
        'E11000 duplicate key error index: unrelated_unique_index'), {
        code: 11000, keyPattern: { unrelated_field: 1 }
    })), false);
    assert.equal(isExpectedClaimDuplicateKeyError(Object.assign(new Error(
        `E11000 duplicate key error index: ${CLAIM_INDEX_NAME}_other dup key`),
    { code: 11000 })), false);
    assert.throws(() => classifyExistingClaim(existingRecord({
        document_status: 'CANCELLED' }), fingerprint),
    (error) => error.code === 'WTOOVA_SUBMISSION_REQUIRES_RECONCILIATION');

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

    const previewStore = createLogStore();
    const previewController = createWtoOvertimeController(dependencies({ store: previewStore }));
    const previewResponse = response();
    await previewController.preview({ body: { ypokatasthma: '0001', from_date: '2026-08-01',
        to_date: '2026-08-31' }, programmataAccessScope: {} }, previewResponse);
    assert.equal(previewResponse.body.preview_fingerprint, fingerprint);
    assert.match(previewResponse.body.preview_fingerprint, /^[a-f0-9]{64}$/);

    for (const invalid of [undefined, '', 'z'.repeat(64), 'a'.repeat(63)]) {
        let loads = 0; let uploads = 0;
        const invalidStore = createLogStore();
        const invalidController = createWtoOvertimeController(dependencies({ store: invalidStore,
            loadDataset: async () => { loads += 1; return dataset(); },
            upload: async () => { uploads += 1; return successResult(); } }));
        const invalidResponse = response();
        const invalidRequest = request(invalid);
        if (invalid === undefined) delete invalidRequest.body.preview_fingerprint;
        await invalidController.submit(invalidRequest, invalidResponse);
        assert.equal(invalidResponse.statusCode, 400);
        assert.equal(invalidResponse.body.code, 'WTOOVA_INVALID_PREVIEW_FINGERPRINT');
        assert.equal(loads, 0); assert.equal(uploads, 0); assert.equal(invalidStore.records.length, 0);
    }

    let source = dataset(); let staleUploads = 0;
    const staleStore = createLogStore();
    const staleController = createWtoOvertimeController(dependencies({ store: staleStore,
        loadDataset: async () => source,
        upload: async () => { staleUploads += 1; return successResult(); } }));
    const approved = response();
    await staleController.preview({ body: { ypokatasthma: '0001', from_date: '2026-08-01',
        to_date: '2026-08-31' }, programmataAccessScope: {} }, approved);
    source = dataset(changedPayload);
    const stale = response();
    await staleController.submit(request(approved.body.preview_fingerprint), stale);
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.body.code, 'WTOOVA_PREVIEW_STALE');
    assert.equal(staleUploads, 0);
    assert.equal(staleStore.records.length, 0);
    source = { ...dataset(), payload: null, parity: { exact: false },
        response: { success: true, submission_eligible: false, parity: { exact: false } } };
    const noLongerEligible = response();
    await staleController.submit(request(approved.body.preview_fingerprint,
        'wtoova-stale-ineligible'), noLongerEligible);
    assert.equal(noLongerEligible.statusCode, 409);
    assert.equal(noLongerEligible.body.code, 'WTOOVA_PREVIEW_STALE');
    assert.equal(staleUploads, 0);
    assert.equal(staleStore.records.length, 0);

    const invalidIndexCases = [
        ['missing', []],
        ['not unique', [claimIndex({ unique: false })]],
        ['wrong key', [claimIndex({ key: { team: 1, request_id: 1 } })]],
        ['wrong partial filter', [claimIndex({
            partialFilterExpression: { request_id: { $exists: true } } })]]
    ];
    for (const [label, indexes] of invalidIndexCases) {
        const guardStore = createLogStore({ indexes });
        let uploads = 0; let credentialLookups = 0;
        const guardController = createWtoOvertimeController(dependencies({ store: guardStore,
            upload: async () => { uploads += 1; return successResult(); },
            companyModel: { findOne: () => { credentialLookups += 1; return lean({}); } },
            passwordModel: { findOne: () => { credentialLookups += 1; return lean({}); } } }));
        const guardResponse = response();
        await guardController.submit(request(fingerprint, `wtoova-index-${label.replace(/\s/g, '-')}`),
            guardResponse);
        assert.equal(guardResponse.statusCode, 503, label);
        assert.equal(guardResponse.body.code, 'WTOOVA_CLAIM_INDEX_NOT_READY', label);
        assert.match(guardResponse.body.message, /δεν επιχειρήθηκε/);
        assert.equal(guardStore.counts.create, 0, label);
        assert.equal(uploads, 0, label);
        assert.equal(credentialLookups, 0, label);
    }
    const inspectionFailureStore = createLogStore({
        indexError: new Error('mocked index inspection failure') });
    let inspectionFailureUploads = 0;
    const inspectionFailureController = createWtoOvertimeController(dependencies({
        store: inspectionFailureStore,
        upload: async () => { inspectionFailureUploads += 1; return successResult(); } }));
    const inspectionFailure = response();
    await inspectionFailureController.submit(request(fingerprint, 'wtoova-index-inspection-failure'),
        inspectionFailure);
    assert.equal(inspectionFailure.statusCode, 503);
    assert.equal(inspectionFailure.body.code, 'WTOOVA_CLAIM_INDEX_NOT_READY');
    assert.equal(inspectionFailureStore.counts.create, 0);
    assert.equal(inspectionFailureUploads, 0);

    const successStore = createLogStore(); let successUploads = 0;
    const successController = createWtoOvertimeController(dependencies({ store: successStore,
        upload: async (options) => { successUploads += 1;
            assert.deepStrictEqual(options.payload, payload); return successResult(); } }));
    const submitted = response();
    await successController.submit(request(fingerprint), submitted);
    assert.equal(submitted.statusCode, 201);
    assert.equal(successUploads, 1);
    assert.equal(successStore.records.length, 1);
    assert.equal(successStore.counts.indexes, 1);
    assert.equal(successStore.counts.create, 1);
    assert.equal(successStore.records[0].submission_status, 'SUCCESS');
    assert.equal(successStore.records[0].submission_code, 'WTOOvA');
    assert.equal(successStore.records[0].submission_id, 233);
    assert.equal(successStore.records[0].request_id, `wtoova:${fingerprint}`);
    assert.equal(submitted.body.pdfUrl,
        `/ergazomenoi/ergazomenoi/ergani/pdf/${successStore.records[0]._id}`);
    assert.ok(!JSON.stringify(submitted.body).includes('private-bucket.example'));
    const sequential = response();
    await successController.submit(request(fingerprint, 'wtoova-test-sequential'), sequential);
    assert.equal(sequential.body.status, 'REUSED');
    assert.equal(successUploads, 1);
    assert.equal(successStore.records.length, 1);

    for (const [label, record] of [
        ['success-reconciliation', existingRecord({ reconciliation_required: true })],
        ['success-not-final', existingRecord({ is_final: false })]
    ]) {
        const strictStore = createLogStore({ initialRecords: [record] });
        let strictUploads = 0;
        const strictController = createWtoOvertimeController(dependencies({ store: strictStore,
            upload: async () => { strictUploads += 1; return successResult(); } }));
        const strictResponse = response();
        await strictController.submit(request(fingerprint, `wtoova-${label}`), strictResponse);
        assert.equal(strictResponse.statusCode, 409, label);
        assert.equal(strictResponse.body.code,
            'WTOOVA_SUBMISSION_REQUIRES_RECONCILIATION', label);
        assert.notEqual(strictResponse.body.status, 'REUSED', label);
        assert.equal(strictStore.counts.create, 0, label);
        assert.equal(strictUploads, 0, label);
    }

    const strictReusableStore = createLogStore({ initialRecords: [existingRecord()] });
    let strictReusableUploads = 0;
    const strictReusableController = createWtoOvertimeController(dependencies({
        store: strictReusableStore,
        upload: async () => { strictReusableUploads += 1; return successResult(); } }));
    const strictReusable = response();
    await strictReusableController.submit(request(fingerprint, 'wtoova-strict-reused'), strictReusable);
    assert.equal(strictReusable.body.status, 'REUSED');
    assert.equal(strictReusableStore.counts.create, 0);
    assert.equal(strictReusableUploads, 0);

    const historical = existingRecord({ request_id: 'historical-browser-request-123' });
    const historicalStore = createLogStore({ initialRecords: [historical] });
    let historicalUploads = 0;
    const historicalController = createWtoOvertimeController(dependencies({ store: historicalStore,
        upload: async () => { historicalUploads += 1; return successResult(); } }));
    const historicalResponse = response();
    await historicalController.submit(request(fingerprint, 'wtoova-historical-random-id'),
        historicalResponse);
    assert.equal(historicalResponse.body.status, 'REUSED');
    assert.equal(historicalResponse.body.erganhLogId, historical._id);
    assert.equal(historicalStore.counts.create, 0);
    assert.equal(historicalUploads, 0);

    const deferredStore = createLogStore();
    const deferredController = createWtoOvertimeController(dependencies({ store: deferredStore,
        savePdf: async () => ({ pdfSaved: false, pdfS3Key: null, pdfS3Url: null,
            pdfRelativePath: null, pdfFilename: null, pdfContentType: 'application/pdf',
            pdfSizeBytes: 0, pdfSaveError: 'mocked deferred PDF' }) }));
    const deferred = response();
    await deferredController.submit(request(fingerprint, 'wtoova-deferred-pdf'), deferred);
    assert.equal(deferred.body.pdfSaved, false);
    assert.equal(deferred.body.pdfDeferred, true);
    assert.equal(deferred.body.pdfUrl, '');

    const concurrentStore = createLogStore(); let concurrentUploads = 0;
    let releaseUpload; let uploadEntered;
    const uploadGate = new Promise((resolve) => { releaseUpload = resolve; });
    const enteredGate = new Promise((resolve) => { uploadEntered = resolve; });
    const concurrentController = createWtoOvertimeController(dependencies({ store: concurrentStore,
        upload: async () => { concurrentUploads += 1; uploadEntered(); await uploadGate;
            return successResult(); } }));
    const responseA = response();
    const pendingA = concurrentController.submit(request(fingerprint, 'wtoova-concurrent-a'), responseA);
    await enteredGate;
    const responseB = response();
    await concurrentController.submit(request(fingerprint, 'wtoova-concurrent-b'), responseB);
    assert.equal(responseB.statusCode, 409);
    assert.equal(responseB.body.code, 'WTOOVA_SUBMISSION_IN_PROGRESS');
    assert.equal(concurrentUploads, 1);
    assert.equal(concurrentStore.records.length, 1);
    assert.equal(concurrentStore.records[0].submission_status, 'TEMPORARY');
    releaseUpload();
    await pendingA;
    assert.equal(responseA.statusCode, 201);
    assert.equal(concurrentStore.records[0].submission_status, 'SUCCESS');
    const responseC = response();
    await concurrentController.submit(request(fingerprint, 'wtoova-concurrent-c'), responseC);
    assert.equal(responseC.body.status, 'REUSED');
    assert.equal(concurrentUploads, 1);
    assert.equal(concurrentStore.records.length, 1);

    for (const duplicateCase of [
        { label: 'expected', error: expectedDuplicateError(), expectedCode: 'WTOOVA_SUBMISSION_IN_PROGRESS',
            existingClaim: existingRecord({ submission_status: 'TEMPORARY', is_final: false }) },
        { label: 'unrelated', error: Object.assign(new Error(
            'E11000 duplicate key error index: unrelated_unique_index'), {
            code: 11000, keyPattern: { unrelated_field: 1 }
        }), expectedCode: 11000, existingClaim: null }
    ]) {
        let findCalls = 0; let createCalls = 0; let uploads = 0;
        const raceModel = {
            collection: { indexes: async () => [claimIndex()] },
            findOne() {
                findCalls += 1;
                return lean(findCalls >= 3 ? duplicateCase.existingClaim : null);
            },
            async create() { createCalls += 1; throw duplicateCase.error; }
        };
        const raceController = createWtoOvertimeController(dependencies({
            store: { model: raceModel },
            upload: async () => { uploads += 1; return successResult(); } }));
        const raceResponse = response();
        await raceController.submit(request(fingerprint, `wtoova-race-${duplicateCase.label}`),
            raceResponse);
        assert.equal(raceResponse.body.code, duplicateCase.expectedCode, duplicateCase.label);
        assert.equal(createCalls, 1, duplicateCase.label);
        assert.equal(uploads, 0, duplicateCase.label);
        if (duplicateCase.label === 'unrelated') {
            assert.equal(raceResponse.statusCode, 500);
            assert.notEqual(raceResponse.body.code, 'WTOOVA_SUBMISSION_IN_PROGRESS');
            assert.equal(findCalls, 2);
        } else {
            assert.equal(raceResponse.statusCode, 409);
            assert.equal(findCalls, 3);
        }
    }

    const failedStore = createLogStore(); let failedUploads = 0;
    const failedController = createWtoOvertimeController(dependencies({ store: failedStore,
        upload: async () => { failedUploads += 1;
            return { success: false, error: 'mocked ERGANI failure', raw: { failed: true } }; } }));
    const failed = response();
    await failedController.submit(request(fingerprint, 'wtoova-failed-a'), failed);
    assert.equal(failed.statusCode, 502);
    assert.equal(failedStore.records[0].submission_status, 'FAILED');
    const failedRetry = response();
    await failedController.submit(request(fingerprint, 'wtoova-failed-b'), failedRetry);
    assert.equal(failedRetry.statusCode, 409);
    assert.equal(failedRetry.body.code, 'WTOOVA_SUBMISSION_REQUIRES_RECONCILIATION');
    assert.equal(failedUploads, 1);
    assert.equal(failedStore.records.length, 1);

    const reconciliationStore = createLogStore({ failSuccessFinalization: true });
    let reconciliationUploads = 0;
    const reconciliationController = createWtoOvertimeController(dependencies({
        store: reconciliationStore,
        upload: async () => { reconciliationUploads += 1; return successResult(); } }));
    const reconciliation = response();
    await reconciliationController.submit(request(fingerprint, 'wtoova-reconcile-a'), reconciliation);
    assert.equal(reconciliation.statusCode, 500);
    assert.equal(reconciliation.body.code, 'WTOOVA_POST_SUBMISSION_LOGGING_FAILED');
    assert.equal(reconciliationStore.records.length, 1);
    assert.equal(reconciliationStore.records[0].submission_status, 'TEMPORARY');
    assert.equal(reconciliationStore.records[0].reconciliation_required, true);
    const reconciliationRetry = response();
    await reconciliationController.submit(request(fingerprint, 'wtoova-reconcile-b'), reconciliationRetry);
    assert.equal(reconciliationRetry.statusCode, 409);
    assert.equal(reconciliationRetry.body.code, 'WTOOVA_SUBMISSION_REQUIRES_RECONCILIATION');
    assert.equal(reconciliationUploads, 1);
    assert.equal(reconciliationStore.records.length, 1);

    const doubleFailureStore = createLogStore({ failSuccessFinalization: true,
        failReconciliationUpdate: true });
    let doubleFailureUploads = 0;
    const doubleFailureController = createWtoOvertimeController(dependencies({
        store: doubleFailureStore,
        upload: async () => { doubleFailureUploads += 1; return successResult(); } }));
    const doubleFailure = response();
    await doubleFailureController.submit(request(fingerprint, 'wtoova-double-failure-a'),
        doubleFailure);
    assert.equal(doubleFailure.statusCode, 500);
    assert.equal(doubleFailure.body.code, 'WTOOVA_POST_SUBMISSION_LOGGING_FAILED');
    assert.equal(doubleFailureStore.records.length, 1);
    assert.equal(doubleFailureStore.records[0].submission_status, 'TEMPORARY');
    assert.notEqual(doubleFailureStore.records[0].reconciliation_required, true);
    const doubleFailureRetry = response();
    await doubleFailureController.submit(request(fingerprint, 'wtoova-double-failure-b'),
        doubleFailureRetry);
    assert.equal(doubleFailureRetry.statusCode, 409);
    assert.equal(doubleFailureRetry.body.code, 'WTOOVA_SUBMISSION_IN_PROGRESS');
    assert.equal(doubleFailureUploads, 1);
    assert.equal(doubleFailureStore.records.length, 1);
    assert.equal(doubleFailureStore.counts.create, 1);

    const gone = response();
    successController.deprecatedLegacy({}, gone);
    assert.equal(gone.statusCode, 410);
    assert.equal(gone.body.code, 'WTOOVA_LEGACY_ROUTE_GONE');
    console.log('PASS WTOOvA preview binding, durable concurrency claim, failure fencing and PDF responses');
})().catch((error) => { console.error(error); process.exitCode = 1; });
