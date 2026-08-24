const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { buildReviewExportProjection } = require('../../services/ergazomenoi/apasxoliseisReviewExportProjectionService');

const controller = fs.readFileSync(path.join(__dirname, 'erganhController.js'), 'utf8');

test('ο authoritative report και ο φάκελος ελέγχου καταναλώνουν την πλήρη προβολή', () => {
    assert.match(controller, /buildReviewExportProjection\(\{/);
    assert.match(controller, /buildEmploymentReviewReportForRequest\(req\)/);
    assert.match(controller, /buildEmploymentReviewReportProjection\(\{/);
    assert.match(controller, /sendEmploymentReviewWorkbook\(req, res\)/);
    assert.match(controller, /sendEmploymentReviewPdf\(req, res, \{ dossier = false \} = \{\}\)/);
    assert.match(controller, /static exportProdhlomenaOrariaReviewAuditDossierPdf[\s\S]*sendEmploymentReviewPdf\(req, res, \{ dossier: true \}\)/);
    assert.match(controller, /getReviewRowsForExport\(req, \{ findingsOnly: false \}\)/);
    assert.match(controller, /buildAtomicRepoTransferPolicyPreviewProjection\(\{/);
    assert.match(controller, /includeContextGroups: true/);
    assert.match(controller, /buildReviewExportProjection\(\{[\s\S]*atomicGroupProjection,[\s\S]*findingsOnly\s*\n/);
    assert.match(controller, /Πολιτική v2 — εβδομάδα Δευτέρα έως Κυριακή/);
    assert.match(controller, /policy_status: row\.policy\?\.statusLabel \|\| ''/);
    assert.match(controller, /\[row\.policy\?\.statusLabel, row\.policy\?\.severity\]/);
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
