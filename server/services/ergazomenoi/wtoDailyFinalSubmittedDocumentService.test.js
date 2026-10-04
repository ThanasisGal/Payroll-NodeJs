'use strict';

const assert = require('assert');
const { resolveFinalWtoDailySubmittedDocument } = require('./wtoDailyFinalSubmittedDocumentService');

const reference = '507f1f77bcf86cd799439011';
const scope = { team: 'TEAM-1', company_kod: '507f1f77bcf86cd799439012', ypokatasthma: '0001', period_start: '2026-08-01', period_end: '2026-08-31' };
const validSubmission = {
    _id: reference, team: scope.team, companykod_object: scope.company_kod,
    ypokatasthma_kodikos: scope.ypokatasthma,
    employment_period_start: new Date('2026-08-01T00:00:00.000Z'),
    employment_period_end: new Date('2026-08-31T00:00:00.000Z'),
    submission_code: 'WTODailyA', submission_status: 'SUCCESS', is_final: true,
    document_status: 'ACTIVE', submission_id: 4321, erganh_submission_id: 'ERG-4321',
    protocol: 'PROTO-2026-08', submit_date: new Date('2026-09-01T08:00:00.000Z'),
    submit_date_text: '01/09/2026 11:00', pdf_s3_key: 'safe/key.pdf',
    pdf_filename: '507f1f77bcf86cd799439011_UNKNOWN_UNKNOWN_PROTO-2026-08_01-09-2026_11_00.pdf',
    pdf_deferred: false
};

function periodControl(overrides = {}) {
    return async () => ({ exists: true, stored_status: 'FINALIZED', submission_reference: reference, ...overrides });
}
function submissionModel(record, calls = []) {
    return { findOne(filter) { calls.push(filter); return { lean: async () => record }; } };
}
async function expectMismatch(overrides, label) {
    await assert.rejects(() => resolveFinalWtoDailySubmittedDocument({
        scope, periodControlResolver: periodControl(),
        submissionModel: submissionModel({ ...validSubmission, ...overrides })
    }), (error) => error.code === 'FINAL_WTODAILY_DOCUMENT_SCOPE_MISMATCH', label);
}

(async () => {
    const calls = [];
    const result = await resolveFinalWtoDailySubmittedDocument({
        scope, periodControlResolver: periodControl(), submissionModel: submissionModel(validSubmission, calls)
    });
    assert.deepStrictEqual(calls, [{ _id: reference }], 'lookup must use only the linked identity');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.submissionCode, 'WTODailyA');
    assert.strictEqual(result.protocol, validSubmission.protocol);
    assert.strictEqual(result.erganhLogId, reference);
    assert.strictEqual(result.pdfUrl, `/ergazomenoi/ergazomenoi/ergani/pdf/${reference}`);
    assert.strictEqual(
        result.pdfFilename,
        'WTODailyA_0001_2026-08-01_2026-08-31_PROTO-2026-08_01-09-2026_11_00.pdf'
    );
    assert.strictEqual(validSubmission.pdf_filename.includes('UNKNOWN_UNKNOWN'), true,
        'the stored legacy filename remains untouched');
    assert.strictEqual(result.pdfDeferred, false);

    let unexpectedLookup = false;
    const missing = await resolveFinalWtoDailySubmittedDocument({
        scope, periodControlResolver: periodControl({ submission_reference: null }),
        submissionModel: { findOne() { unexpectedLookup = true; } }
    });
    assert.strictEqual(missing.found, false);
    assert.strictEqual(unexpectedLookup, false, 'missing link must not fall back to latest submission');

    await expectMismatch({ companykod_object: '507f1f77bcf86cd799439099' }, 'wrong company');
    await expectMismatch({ ypokatasthma_kodikos: '0002' }, 'wrong branch');
    await expectMismatch({ employment_period_end: new Date('2026-09-30T00:00:00.000Z') }, 'wrong period');
    await expectMismatch({ submission_status: 'FAILED' }, 'not successful');
    await expectMismatch({ is_final: false }, 'not final');
    await expectMismatch({ document_status: 'SUPERSEDED' }, 'not active');
    await expectMismatch({ submission_code: 'WTOOvA' }, 'wrong submission code');

    const deferred = await resolveFinalWtoDailySubmittedDocument({
        scope, periodControlResolver: periodControl(),
        submissionModel: submissionModel({ ...validSubmission, pdf_s3_key: '', pdf_relative_path: '', pdf_s3_url: '', pdf_deferred: true })
    });
    assert.strictEqual(deferred.pdfUrl, '');
    assert.strictEqual(deferred.pdfSaved, false);
    assert.strictEqual(deferred.pdfDeferred, true);
    assert.strictEqual(deferred.erganhLogId, reference);
    console.log('PASS linked final WTODailyA submitted-document resolver (11 checks)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
