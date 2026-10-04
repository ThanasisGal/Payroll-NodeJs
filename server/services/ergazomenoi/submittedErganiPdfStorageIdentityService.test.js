'use strict';

const assert = require('assert');
const {
    buildSubmittedErganiPdfStorageIdentity,
    buildSubmittedErganiPdfDisplayFilename
} = require('./submittedErganiPdfStorageIdentityService');

const periodSubmission = {
    submission_code: 'WTODailyA',
    team: 'TEAM-1',
    ypokatasthma_kodikos: '0',
    employment_period_start: '2026-09-01',
    employment_period_end: '2026-09-30',
    protocol: 'OP84859148',
    submit_date_text: '04/10/2026 13:57'
};
const expectedPeriodFilename =
    'WTODailyA_0000_2026-09-01_2026-09-30_OP84859148_04-10-2026_13_57.pdf';

const initial = buildSubmittedErganiPdfStorageIdentity({
    submissionCode: 'WTODailyA',
    submission: periodSubmission,
    ergazomenos: { team: 'TEAM-1' },
    restResult: { protocol: 'OP84859148', submitDate: '04/10/2026 13:57' }
});
const retry = buildSubmittedErganiPdfStorageIdentity({
    submissionCode: 'WTODailyA',
    submission: periodSubmission,
    ergazomenos: { _id: '507f1f77bcf86cd799439011', team: 'TEAM-1' },
    restResult: { protocol: 'OP84859148', submitDate: '04/10/2026 13:57' }
});
assert.strictEqual(initial.filename, expectedPeriodFilename);
assert.strictEqual(retry.filename, expectedPeriodFilename);
assert.doesNotMatch(initial.filename, /UNKNOWN/);

const employee = buildSubmittedErganiPdfStorageIdentity({
    submissionCode: 'WebE7N',
    ergazomenos: {
        _id: 'EMP-1', team: 'TEAM-1', eponymo: 'ΠΑΠΑΔΟΠΟΥΛΟΣ', onoma: 'ΝΙΚΟΣ'
    },
    restResult: { protocol: 'PROT/1', submitDate: '04/10/2026 13:57' }
});
assert.strictEqual(
    employee.filename,
    'EMP-1_ΠΑΠΑΔΟΠΟΥΛΟΣ_ΝΙΚΟΣ_PROT_1_04-10-2026_13_57.pdf'
);

const legacy = {
    ...periodSubmission,
    pdf_filename: '507f1f77bcf86cd799439011_UNKNOWN_UNKNOWN_OP84859148_04-10-2026_13_57.pdf'
};
assert.strictEqual(buildSubmittedErganiPdfDisplayFilename(legacy), expectedPeriodFilename);
assert.strictEqual(
    buildSubmittedErganiPdfDisplayFilename({ submission_code: 'WebE7N', pdf_filename: 'stored.pdf' }),
    'stored.pdf'
);
assert.strictEqual(
    buildSubmittedErganiPdfDisplayFilename({
        submission_code: 'WTODailyA', pdf_filename: 'legacy-malformed.pdf'
    }),
    'legacy-malformed.pdf'
);

const sanitized = buildSubmittedErganiPdfStorageIdentity({
    submissionCode: 'WTODailyA',
    submission: {
        ...periodSubmission,
        ypokatasthma_kodikos: '../00/01',
        protocol: '../../OP:1'
    }
});
assert.doesNotMatch(sanitized.filename, /[\\/:*?"<>|]/);

console.log('PASS submitted ERGANI PDF storage identity (9 checks)');
