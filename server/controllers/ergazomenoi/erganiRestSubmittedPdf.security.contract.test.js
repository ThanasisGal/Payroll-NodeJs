'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const routes = read('server/routes/usersRoute.js');
const erganhController = read('server/controllers/ergazomenoi/erganhController.js');
const pdfAccess = read('server/controllers/ergazomenoi/erganiPdfAccess.js');
const employeeController = read('server/controllers/ergazomenoi/ergazomenoiController.js');
const employeeScope = read('server/controllers/ergazomenoi/employeeUpdateScope.js');
const app = read('app.js');

test('submitted PDF route requires authentication', () => {
    assert.match(
        routes,
        /router\.get\('\/ergazomenoi\/ergazomenoi\/ergani\/pdf\/:id', checkAuth, erganhController\.openErganiPdf\)/
    );
});

test('submitted PDF lookup is scoped by team and active company', () => {
    assert.match(pdfAccess, /function getScopedErganiLogFilter/);
    assert.match(pdfAccess, /team: sessionTeam/);
    assert.match(
        pdfAccess,
        /\$or: \[\{ companykod_object: companyId \}, \{ companykod: String\(companyId\) \}\]/
    );
    assert.match(
        pdfAccess,
        /findOne\(getScopedErganiLogFilter\(\{ id, sessionTeam, companyId \}\)\)/
    );
    assert.match(erganhController, /static openErganiPdf = createOpenErganiPdfHandler/);
    assert.doesNotMatch(pdfAccess, /findById\(/);
});

test('ObjectId and scope validation happen before S3 read', () => {
    const handler = pdfAccess.slice(pdfAccess.indexOf('function createOpenErganiPdfHandler'));
    assert.ok(handler.indexOf('objectId.isValid') < handler.indexOf('s3Client.send'));
    assert.ok(handler.indexOf('.findOne(') < handler.indexOf('s3Client.send'));
    assert.match(handler, /return res\.status\(404\)\.send\('PDF not found'\)/);
});

test('PDF response remains same-origin iframe-compatible without exposing S3 metadata', () => {
    const handler = pdfAccess.slice(pdfAccess.indexOf('function createOpenErganiPdfHandler'));
    assert.match(handler, /'X-Frame-Options', 'SAMEORIGIN'/);
    assert.match(handler, /"frame-ancestors 'self'"/);
    assert.match(handler, /'Content-Disposition', 'inline; filename="ergani\.pdf"'/);
    assert.doesNotMatch(handler, /res\.(json|send)\([^)]*pdf_s3_key/);
    assert.doesNotMatch(handler, /res\.(json|send)\([^)]*bucket/);
});

test('REST submission responses expose only same-origin PDF routes', () => {
    const responseSection = erganhController.slice(
        erganhController.indexOf("submissionCode: 'WebE7N'"),
        erganhController.indexOf('static getErganiSubmittedHistory')
    );
    assert.doesNotMatch(
        responseSection,
        /pdfUrl:[\s\S]{0,400}pdfS3Key:\s*pdfStorage\.pdfS3Key/
    );
    assert.doesNotMatch(responseSection, /pdfUrl:[\s\S]{0,300}pdfStorage\.pdfS3Url\s*\|\|/);
    assert.match(responseSection, /pdfUrl:[\s\S]*getErganiPdfRoute\(erganhLog\._id\)/);
});

test('history pdfSaved uses the same storage condition as pdfUrl', () => {
    const historyMapping = erganhController.slice(
        erganhController.indexOf('data: rows.map'),
        erganhController.indexOf('static openErganiPdf')
    );
    const storageCondition = /row\.pdf_s3_key \|\| row\.pdf_relative_path \|\| row\.pdf_s3_url/;
    assert.match(historyMapping, storageCondition);
    assert.match(
        historyMapping,
        /pdfSaved:\s*!!\(\s*row\.pdf_s3_key \|\|\s*row\.pdf_relative_path \|\|\s*row\.pdf_s3_url/
    );
});

test('employee read and update routes require auth and canonical privileges', () => {
    assert.match(
        routes,
        /'\/api\/ergazomenoi\/:id',\s*checkAuth,\s*requireUserPrivilegeAction\('Ergazomenoi', 'read'\)/
    );
    assert.match(
        routes,
        /'\/api\/ergazomenoi',\s*checkAuth,\s*requireUserPrivilegeAction\('Ergazomenoi', 'read'\)/
    );
    assert.match(
        routes,
        /'\/api\/ergazomenoi\/update\/:ergazomenoiId',\s*checkAuth,\s*requireUserPrivilegeAction\('Ergazomenoi', 'update'\)/
    );
});

test('employee update is covered by CSRF and uses session-scoped filter', () => {
    const skipBlock = app.slice(app.indexOf('const skipPaths = [', app.indexOf('CSRF Protection')));
    assert.doesNotMatch(skipBlock.slice(0, skipBlock.indexOf('];')), /['"]\/api['"]/);
    assert.match(employeeScope, /const sessionTeam = req\.session\?\.userTeam/);
    assert.match(employeeScope, /const companyId = req\.session\?\.companyInUse/);
    assert.match(
        employeeScope,
        /return \{\s*_id: employeeId,\s*team: sessionTeam,\s*company_kod: companyId/
    );
    assert.match(employeeController, /requireScopedEmployeeForUpdate\(/);
    assert.match(employeeController, /findOneAndUpdate\(\s*employeeScope/);
});

test('employee history identity comes from the scoped database employee', () => {
    const updateHandler = employeeController.slice(
        employeeController.indexOf('static postErgazomenoiUpdate'),
        employeeController.indexOf('static getErgazomenosById')
    );
    assert.match(employeeScope, /\.select\('_id kodikos'\)/);
    assert.match(employeeScope, /employeeCode = String\(employee\.kodikos \?\? ''\)\.trim\(\)/);
    assert.doesNotMatch(
        updateHandler,
        /const kodikosErgazomenoy = formData\.kodikosHidden/
    );
    assert.match(
        updateHandler,
        /employeeCode: kodikosErgazomenoy[\s\S]{0,250}formData\.kodikosHidden = kodikosErgazomenoy/
    );
    const canonicalSyncIndex = updateHandler.indexOf(
        'formData.kodikosHidden = kodikosErgazomenoy'
    );
    const historyLookupIndex = updateHandler.indexOf(
        'IstorikoProslhpseonAllagonModel.findOne({'
    );
    assert.ok(canonicalSyncIndex >= 0);
    assert.ok(historyLookupIndex >= 0);
    assert.ok(
        canonicalSyncIndex < historyLookupIndex
    );
});

test('employee scope lookup handles database errors internally', () => {
    assert.match(employeeScope, /try \{[\s\S]*model\.findOne\(employeeScope\)/);
    assert.match(
        employeeScope,
        /errorMessage: 'Σφάλμα κατά τον έλεγχο πρόσβασης στον εργαζόμενο'/
    );
    assert.match(employeeScope, /category: error\?\.name \|\| 'EMPLOYEE_SCOPE_LOOKUP_FAILED'/);
});

test('CSRF failure logs presence flags, not token values', () => {
    const failureBlock = app.slice(
        app.indexOf("logger.error('❌ CSRF validation FAILED'"),
        app.indexOf("return res.status(403)", app.indexOf("logger.error('❌ CSRF validation FAILED'"))
    );
    assert.match(failureBlock, /cookieTokenPresent/);
    assert.match(failureBlock, /requestTokenPresent/);
    assert.doesNotMatch(failureBlock, /Cookie token\s*:/);
    assert.doesNotMatch(failureBlock, /Body _csrf\s*:/);
    assert.doesNotMatch(app, /body_csrf:|header_csrf:/);
});
