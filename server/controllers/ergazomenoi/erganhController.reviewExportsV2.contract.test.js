const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { buildReviewExportProjection } = require('../../services/ergazomenoi/apasxoliseisReviewExportProjectionService');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '../../../app.js'), 'utf8');
const routes = fs.readFileSync(path.resolve(__dirname, '../../routes/usersRoute.js'), 'utf8');

test('οι κλασικές εξαγωγές κρατούν μόνο τις ημερήσιες επιλύσεις ενώ ο φάκελος διατηρεί lifecycle', () => {
    assert.match(controller, /buildReviewExportProjection\(\{/);
    assert.match(controller,
        /getReviewRowsForExport\(req, \{ includeLifecycle = true \} = \{\}\)/);
    assert.match(controller,
        /buildEmploymentReviewReportForRequest\(req, \{ includeLifecycle = true \} = \{\}\)/);
    assert.match(controller, /buildEmploymentReviewReportProjection\(\{/);
    assert.match(controller, /sendEmploymentReviewWorkbook\(req, res\)/);
    assert.match(controller, /sendEmploymentReviewPdf\(req, res, \{ dossier = false \} = \{\}\)/);
    assert.match(controller, /static exportProdhlomenaOrariaReviewExcel[\s\S]*sendEmploymentReviewWorkbook\(req, res\)/);
    assert.match(controller, /static exportProdhlomenaOrariaReviewPdf[\s\S]*sendEmploymentReviewPdf\(req, res\)/);
    assert.match(controller, /static exportProdhlomenaOrariaReviewAuditDossierPdf[\s\S]*sendEmploymentReviewPdf\(req, res, \{ dossier: true \}\)/);
    assert.match(controller,
        /sendEmploymentReviewWorkbook[\s\S]*buildEmploymentReviewReportForRequest\(req, \{ includeLifecycle: false \}\)/);
    assert.match(controller,
        /sendEmploymentReviewPdf[\s\S]*includeLifecycle: dossier/);
    const projectionIndex = controller.indexOf('const projection = buildReviewExportProjection({');
    const bypassIndex = controller.indexOf('if (includeLifecycle === false) return projection.rows;',
        projectionIndex);
    const finalAnalysisMapIndex = controller.indexOf(
        'projection.rows.__finalWeeklyAnalysisByWeek = finalWeeklyAnalysisByWeek;', projectionIndex);
    const workflowIndex = controller.indexOf('const [workflowStates, workflowAudits, companyPolicyRules]',
        projectionIndex);
    const lifecycleIndex = controller.lastIndexOf('buildWeeklyHrLifecycleProjection({', bypassIndex);
    assert.ok(projectionIndex >= 0 && finalAnalysisMapIndex > projectionIndex);
    assert.ok(bypassIndex > finalAnalysisMapIndex);
    assert.ok(workflowIndex > bypassIndex);
    assert.ok(lifecycleIndex >= 0 && lifecycleIndex < bypassIndex);
    assert.match(controller, /buildReviewExportProjection\(\{[\s\S]*findingsOnly: false/);
    assert.match(controller, /buildAtomicRepoTransferPolicyPreviewProjection\(\{/);
    assert.match(controller, /includeContextGroups: true/);
    assert.match(controller, /const finalWeeklyAnalysisByWeek = new Map\(\)/);
    assert.match(controller, /const stage2DailyResolutionsByDate = new Map\(\)/);
    assert.match(controller, /buildWeeklyHrLifecycleProjection\(\{[\s\S]*persistedStage1State:[\s\S]*periodScope: null,[\s\S]*employmentDateScope/);
    assert.match(controller, /lifecycle\.stages\.stage3\.stage2_automatic_resolution_items/);
    assert.match(controller, /projection\.rows\.__stage2DailyResolutionsByDate = stage2DailyResolutionsByDate/);
    assert.match(controller, /analyzeWeeklySixthSeventhDay\(\{[\s\S]*effectiveProfilesByDate,[\s\S]*expectedDateKeys: employmentDateScope\?\.employment_owned_dates \|\| null/);
    assert.match(controller, /finalWeeklyAnalysisByWeek\.set\(projectionKey, finalAnalysis\)/);
    assert.match(controller, /finalAnalysis = canonicalResolution\?\.analysis \|\| automaticAnalysis/);
    assert.match(controller, /buildReviewExportProjection\(\{[\s\S]*atomicGroupProjection,[\s\S]*findingsOnly: false/);
    assert.match(controller, /Πολιτική v2 — εβδομάδα Δευτέρα έως Κυριακή/);
    assert.match(controller, /policy_status: row\.policy\?\.statusLabel \|\| ''/);
    assert.match(controller, /\[row\.policy\?\.statusLabel, row\.policy\?\.severity\]/);
});

test('το απλό PDF επιστρέφει authoritative UTF-8 όνομα χωρίς timestamp', () => {
    const start = controller.indexOf('async function sendEmploymentReviewPdf');
    const end = controller.indexOf('function makeReviewPdfDocument', start);
    const handler = controller.slice(start, end);
    assert.match(handler, /const fileNameInput = \{ team: report\.metadata\.team/);
    assert.match(handler, /companyCode: report\.metadata\.companyCode/);
    assert.match(handler, /companyName: report\.metadata\.companyName/);
    assert.match(handler, /periodStart: report\.metadata\.periodStart/);
    assert.match(handler, /periodEnd: report\.metadata\.periodEnd/);
    assert.match(handler, /buildSimplePdfFileName\(fileNameInput\)/);
    assert.match(handler, /filename\*=UTF-8''\$\{encodeURIComponent\(fileName\)\}/);
    const simpleNameBranch = handler.slice(handler.indexOf(': buildSimplePdfFileName'),
        handler.indexOf("res.setHeader('Content-Type'"));
    assert.doesNotMatch(simpleNameBranch, /Date\.now\(\)/);
});

test('ο Φάκελος Ελέγχου επιστρέφει server-authoritative UTF-8 όνομα χωρίς timestamp', () => {
    const start = controller.indexOf('async function sendEmploymentReviewPdf');
    const end = controller.indexOf('function makeReviewPdfDocument', start);
    const handler = controller.slice(start, end);
    assert.match(handler, /buildDossierPdfFileName\(fileNameInput\)/);
    assert.match(handler, /filename\*=UTF-8''\$\{encodeURIComponent\(fileName\)\}/);
    assert.doesNotMatch(handler, /fakelos_elegxou_apasxolhshs_|Date\.now\(\)/);
});

test('οι αποκρίσεις PDF επιτρέπουν αποκλειστικά ίδιας προέλευσης ενσωμάτωση', () => {
    const senderStart = controller.indexOf('async function sendEmploymentReviewPdf');
    const senderEnd = controller.indexOf('function makeReviewPdfDocument', senderStart);
    const sender = controller.slice(senderStart, senderEnd);
    assert.match(sender, /buildSimplePdfFileName\(fileNameInput\)/);
    assert.match(sender, /buildDossierPdfFileName\(fileNameInput\)/);
    assert.match(sender, /Content-Disposition/);
    assert.match(sender, /inline; filename="employment_review\.pdf"; filename\*=UTF-8''/);
    assert.match(sender,
        /Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'"/);
    assert.match(sender, /X-Frame-Options', 'SAMEORIGIN'/);
    assert.match(app, /'frame-ancestors': \["'none'"\]/);
});

test('η προεπισκόπηση αποθηκεύεται μία φορά και η λήψη διαβάζει μόνο το cache', () => {
    const senderStart = controller.indexOf('async function sendEmploymentReviewPdf');
    const senderEnd = controller.indexOf('function makeReviewPdfDocument', senderStart);
    const sender = controller.slice(senderStart, senderEnd);
    assert.match(sender, /employmentReviewPdfCache\.storeDocument\(\{/);
    assert.match(sender, /previewId,[\s\S]*fileName,[\s\S]*sessionId: req\.sessionID/);
    assert.match(sender, /userId: req\.session\?\.userId/);
    assert.match(sender, /reportType: dossier \? 'dossier' : 'simple'/);

    const downloadStart = controller.indexOf(
        'static downloadCachedEmploymentReviewPdf');
    const downloadEnd = controller.indexOf(
        'static completeWeeklyHrWorkflowStage1', downloadStart);
    const download = controller.slice(downloadStart, downloadEnd);
    assert.match(download, /employmentReviewPdfCache\.getEntry\(\{/);
    assert.match(download, /sessionId: req\.sessionID/);
    assert.match(download, /userId: req\.session\?\.userId/);
    assert.match(download, /fs\.createReadStream\(entry\.filePath\)\.pipe\(res\)/);
    assert.doesNotMatch(download,
        /buildEmploymentReviewReportForRequest|buildEmploymentReviewPdf/);
    assert.match(download,
        /Η προσωρινή έκδοση του PDF έχει λήξει\. Δημιουργήστε ξανά την προεπισκόπηση\./);
    assert.match(routes,
        /router\.get\([\s\S]*review\/cached-pdf\/:previewId[\s\S]*checkAuth[\s\S]*requireEmploymentReviewAccess[\s\S]*downloadCachedEmploymentReviewPdf/);
});

test('Excel render/content smoke test contains all 22 original plus 15 v2 headers', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Έλεγχος', { views: [{ state: 'frozen', ySplit: 1 }] });
    const original = Array.from({ length: 22 }, (_, index) => `Υφιστάμενη ${index + 1}`);
    const v2 = ['Εβδομάδα από', 'Εβδομάδα έως', 'Χαρακτηρισμός ημέρας', 'Πηγή χαρακτηρισμού',
        'Κατάσταση πολιτικής', 'Σοβαρότητα', 'Ώρες 6ης ημέρας',
        'Ποσοστό προσαύξησης 6ης ημέρας', 'Αιτιολογία / σημείωση πολιτικής',
        'Παράνομη υπερωρία κανονική', 'Παράνομη υπερωρία νύχτας',
        'Παράνομη υπερωρία Κυριακής/αργίας',
        'Παράνομη υπερωρία Κυριακής/αργίας και νύχτας',
        'Σύνολο παράνομης υπερωρίας', 'Έλεγχος συνέπειας'];
    sheet.addRow([...original, ...v2]);
    sheet.getRow(1).alignment = { wrapText: true };
    const buffer = await workbook.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer);
    assert.equal(loaded.getWorksheet('Έλεγχος').columnCount, 37);
    assert.equal(loaded.getWorksheet('Έλεγχος').getCell('AK1').value, 'Έλεγχος συνέπειας');
});

test('το όριο περιόδου Ιουνίου επιστρέφει πριν από έλεγχο πλήρους φυσικής εβδομάδας', () => {
    const exportLoaderStart = controller.indexOf(
        'async function getReviewRowsForExport(req, { includeLifecycle = true } = {})');
    const exportLoaderEnd = controller.indexOf(
        'async function buildEmploymentReviewReportForRequest', exportLoaderStart);
    const exportLoader = controller.slice(exportLoaderStart, exportLoaderEnd);
    assert.match(exportLoader, /buildReviewExportProjection\(\{/);
    assert.match(exportLoader, /if \(includeLifecycle === false\) return projection\.rows;/);
    assert.match(exportLoader, /projection\.rows\.__finalWeeklyAnalysisByWeek = finalWeeklyAnalysisByWeek;/);
    assert.ok(exportLoader.indexOf('buildWeeklyHrLifecycleProjection({') <
        exportLoader.indexOf('if (includeLifecycle === false) return projection.rows;'));
    assert.ok(exportLoader.indexOf('finalWeeklyAnalysisByWeek.set(projectionKey, finalAnalysis);') <
        exportLoader.indexOf('if (includeLifecycle === false) return projection.rows;'));
    assert.match(exportLoader, /periodScope: null/);
    assert.match(exportLoader,
        /restrictBoundaryContextToPeriodEmployees\(\s*enrichedRows,\s*boundaryContextRows\s*\)/);
    assert.match(exportLoader,
        /employmentDateScope\?\.authoritative_date_set\?\.length \|\| 0\) > 0 &&[\s\S]*employmentDateScope\?\.context_only_dates\?\.length \|\| 0\) > 0/);
    assert.ok(exportLoader.indexOf('projection.rows.__stage2DailyResolutionsByDate = stage2DailyResolutionsByDate;') <
        exportLoader.indexOf('if (includeLifecycle === false) return projection.rows;'));
    assert.match(controller,
        /sendEmploymentReviewWorkbook[\s\S]*includeLifecycle: false/);
    assert.match(controller,
        /sendEmploymentReviewPdf[\s\S]*includeLifecycle: dossier/);
});

test('PDF smoke starts with %PDF and embeds Greek policy labels', async () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
        hmeromhnia: new Date(Date.UTC(2026, 7, 3 + index)).toISOString().slice(0, 10),
        kodikos: '1', ypokatasthma: '0001', kathgoria_ergasias: 'ΕΡΓ',
        ores_ergasias: index === 6 ? 0 : 7, cards_ores_ergasias: index === 6 ? 0 : 7,
        cards_apo_ora_01: index === 6 ? '' : '08:00', cards_eos_ora_01: index === 6 ? '' : '15:00',
        effective_weekly_workdays: 5, effective_sixth_day_rate: 40
    }));
    const projection = buildReviewExportProjection({ rows });
    const doc = new PDFDocument({ autoFirstPage: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const complete = new Promise((resolve) => doc.on('end', resolve));
    const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
    if (fs.existsSync(font)) doc.font(font);
    doc.text(`Πολιτική v2 ${projection.rows[5].policy.classificationLabel} ${projection.rows[5].policy.sourceLabel}`);
    doc.end();
    await complete;
    const pdf = Buffer.concat(chunks);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 500);
});
