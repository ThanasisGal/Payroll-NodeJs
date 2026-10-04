'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ejs = require('ejs');
const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const viewPath = 'views/ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka.ejs';
const frontendPath = 'public/js/ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka.js';
const view = read(viewPath);
const frontend = read(frontendPath);
const service = read('server/services/ergazomenoi/wtoDailyFinalSubmittedDocumentService.js');
const controller = read('server/controllers/ergazomenoi/wtoDailyFinalSubmittedDocumentController.js');
const deploy = read('deploy-ubuntu.sh');

ejs.compile(view, { filename: path.join(root, viewPath) });
const rendered = ejs.render(view, {
    locals: { title: 'Εκτύπωση Οριστικού Απολογιστικού Πίνακα', description: 'Web Payroll Solutions' },
    userPrivileges: { export: true }, periodRec: { apo: '2026-08-01', eos: '2026-08-31' },
    companyId: 'company-1', rec: {}, script: (value) => `/js/${value}.js`
}, { filename: path.join(root, viewPath) });
assert.ok(rendered.includes('value="2026-08-01"'));
assert.ok(rendered.includes('value="2026-08-31"'));
assert.ok(rendered.includes('Άνοιγμα Οριστικού PDF'));
assert.ok(rendered.includes('Πρωτόκολλο:'));
const commonIndex = rendered.indexOf('/js/ergazomenoi/genika/erganiRestSubmissionUi.js');
const pageIndex = rendered.indexOf('/js/ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka.js');
assert.ok(commonIndex >= 0 && commonIndex < pageIndex, 'common viewer must load first');
assert.ok(frontend.includes("method: 'GET'"));
assert.ok(frontend.includes('ErganiRestSubmissionUi.presentSubmissionResultSafely'));
assert.ok(frontend.includes("submissionCode: 'WTODailyA'"));
assert.ok(frontend.includes("pdfViewerVariant: 'compact-portrait'"));
assert.ok(frontend.includes('Δεν βρέθηκε οριστικά υποβλημένος Απολογιστικός Πίνακας'));
assert.ok(!frontend.includes("method: 'POST'"));
assert.ok(!frontend.includes('uploadJsonDocumentToErgani'));
assert.ok(!frontend.includes('apologistikosPinakasControl'));
assert.ok(!service.includes('uploadJsonDocumentToErgani'));
assert.ok(!service.includes('.create('));
assert.ok(!service.includes('apologistikosPinakasControlPdfService'));
assert.ok(controller.includes('resolveFinalWtoDailySubmittedDocument'));
assert.ok(deploy.includes('public/js/ergazomenoi/programmata/ektyposhOristikouApologistikouPinaka.js'));

const elements = new Map([
    ['apo_hmeromhnia', { value: '2026-08-01' }], ['eos_hmeromhnia', { value: '2026-08-31' }],
    ['ypokatasthma_stathera_advanced', { value: '1' }],
    ['finalWtoSubmittedDocumentMetadata', { classList: { remove() {} } }],
    ['finalWtoSubmittedProtocol', { textContent: '' }], ['finalWtoSubmittedDate', { textContent: '' }],
    ['finalWtoSubmittedStatus', { textContent: '' }]
]);
let viewerPayload = null;
const window = {
    document: { addEventListener() {}, getElementById(id) { return elements.get(id) || null; } },
    URLSearchParams,
    fetch: async (url, options) => {
        assert.ok(url.startsWith('/api/prodhlomena-oraria/review/period-control/submission/final/document?'));
        assert.strictEqual(options.method, 'GET');
        return { ok: true, json: async () => ({ success: true, found: true, submissionCode: 'WTODailyA', protocol: 'PROTO-1', submitDate: '01/09/2026', status: 'SUCCESS', pdfUrl: '/ergazomenoi/ergazomenoi/ergani/pdf/507f1f77bcf86cd799439011' }) };
    },
    Swal: { fire: async () => ({}) },
    ErganiRestSubmissionUi: { presentSubmissionResultSafely: async (payload) => { viewerPayload = payload; } }
};
vm.runInNewContext(frontend, { window, URLSearchParams });
(async () => {
    await window.FinalWtoSubmittedDocumentPage.openSubmittedDocument();
    assert.strictEqual(viewerPayload.submissionCode, 'WTODailyA');
    assert.strictEqual(viewerPayload.processDescription, 'Οργάνωση Χρόνου Εργασίας - Απολογιστικός Πίνακας Ωραρίων');
    assert.strictEqual(viewerPayload.pdfViewerVariant, 'compact-portrait');
    assert.strictEqual(elements.get('finalWtoSubmittedProtocol').textContent, 'PROTO-1');
    let errorPresentation = null;
    window.fetch = async () => ({ ok: true, json: async () => ({ success: true, found: false, code: 'FINAL_WTODAILY_DOCUMENT_NOT_FOUND', message: 'Δεν βρέθηκε οριστικά υποβλημένος Απολογιστικός Πίνακας για την επιλεγμένη περίοδο και το παράρτημα.' }) });
    window.Swal.fire = async (options) => { errorPresentation = options; };
    viewerPayload = null;
    await window.FinalWtoSubmittedDocumentPage.openSubmittedDocument();
    assert.strictEqual(viewerPayload, null);
    assert.strictEqual(errorPresentation.title, 'Δεν βρέθηκε οριστικό PDF');
    assert.ok(errorPresentation.html.includes('Δεν έγινε νέα υποβολή και δεν άλλαξαν δεδομένα.'));
    assert.ok(errorPresentation.html.includes('FINAL_WTODAILY_DOCUMENT_NOT_FOUND'));
    console.log('PASS final WTODailyA submitted-document page/viewer contract (read-only)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
