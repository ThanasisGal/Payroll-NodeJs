'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { REPORT_COLUMNS } = require('./apologistikosPinakasControlReportService');
const {
    addSimplePdfFooters
} = require('./apasxoliseisEmploymentReviewReportService');

const REPORT_TITLE = 'Κατάσταση Ελέγχου Απολογιστικού Πίνακα';

const COLUMN_KEYS = Object.freeze([
    'ypokatasthma', 'kodikos', 'afm', 'eponymo', 'onoma', 'hmeromhnia',
    'category', 'zeugos1', 'zeugos2', 'zeugos3'
]);
const COLUMN_WEIGHTS = Object.freeze([8, 8, 10, 12, 11, 10, 15, 10, 10, 10]);

function fontsFor(doc) {
    const regular = path.join(process.cwd(), 'fonts/DejaVuSans/DejaVuSans.ttf');
    const bold = path.join(process.cwd(), 'fonts/DejaVuSans/DejaVuSans-Bold.ttf');
    if (!fs.existsSync(regular) || !fs.existsSync(bold)) throw new Error('Δεν βρέθηκαν οι γραμματοσειρές DejaVu Sans.');
    doc.registerFont('ControlRegular', regular); doc.registerFont('ControlBold', bold);
    return { regular: 'ControlRegular', bold: 'ControlBold' };
}

function metadataHeader({ companyName, criteria }) {
    const date = (value) => String(value).split('-').reverse().join('/');
    return `Εταιρεία: ${companyName || '—'}   Παράρτημα: ${criteria.ypokatasthma}   ` +
        `Περίοδος: ${date(criteria.startIso)}–${date(criteria.endIso)}`;
}

function generatePdf({ rows = [], criteria, columns = REPORT_COLUMNS, companyName = '—' }) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape',
            margins: { top: 32, bottom: 34, left: 24, right: 24 }, bufferPages: true });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
        let fonts;
        try { fonts = fontsFor(doc); } catch (error) { reject(error); doc.end(); return; }
        const left = doc.page.margins.left;
        const tableWidth = doc.page.width - left - doc.page.margins.right;
        const totalWeight = COLUMN_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
        const widths = COLUMN_WEIGHTS.map((weight) => tableWidth * weight / totalWeight);
        const bottom = () => doc.page.height - doc.page.margins.bottom;

        const drawPageHeading = () => {
            doc.font(fonts.bold).fontSize(13).text(REPORT_TITLE, left, 27,
                { width: tableWidth, align: 'center' });
            doc.font(fonts.regular).fontSize(8).text(metadataHeader({ companyName, criteria }),
                left, 49, { width: tableWidth, align: 'center' });
            doc.y = Math.max(68, doc.y + 4);
        };
        const drawHeader = () => {
            const y = doc.y; let x = left;
            doc.font(fonts.bold).fontSize(6.4);
            columns.forEach((label, index) => {
                doc.rect(x, y, widths[index], 24).fillAndStroke('#e5e5e5', '#777777');
                doc.fillColor('#000000').text(label, x + 2, y + 5, { width: widths[index] - 4, height: 16, align: 'center' });
                x += widths[index];
            });
            doc.y = y + 24;
        };
        const newPage = () => { doc.addPage(); drawPageHeading(); drawHeader(); };
        const drawRow = (row) => {
            doc.font(fonts.regular).fontSize(6.2);
            const values = COLUMN_KEYS.map((key) => String(row[key] ?? '—'));
            const heights = values.map((value, index) => doc.heightOfString(value, { width: widths[index] - 4 }));
            const rowHeight = Math.max(18, Math.max(...heights) + 7);
            if (doc.y + rowHeight > bottom()) newPage();
            const y = doc.y; let x = left;
            values.forEach((value, index) => {
                doc.rect(x, y, widths[index], rowHeight).stroke('#999999');
                doc.fillColor('#000000').text(value, x + 2, y + 4, { width: widths[index] - 4, height: rowHeight - 6, align: 'left' });
                x += widths[index];
            });
            doc.y = y + rowHeight;
        };

        drawPageHeading();
        if (!rows.length) {
            doc.font(fonts.regular).fontSize(11).text('Δεν βρέθηκαν εγγραφές για τα επιλεγμένα κριτήρια.', left, 100, { width: tableWidth, align: 'center' });
        } else {
            drawHeader(); rows.forEach(drawRow);
        }
        addSimplePdfFooters(doc, fonts);
        doc.end();
    });
}

module.exports = { REPORT_TITLE, COLUMN_KEYS, COLUMN_WEIGHTS, metadataHeader, generatePdf };
