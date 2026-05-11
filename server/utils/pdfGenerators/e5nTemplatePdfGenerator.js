// ============================================================================
// E5N TEMPLATE PDF GENERATOR
// Γεμίζει το official template PDF του ΕΡΓΑΝΗ
// ============================================================================

const fs = require('fs-extra');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const { uploadBufferToS3 } = require('../s3Helper');

function formatDate(date) {
    if (!date) return '';

    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [y, m, d] = date.split('-');
        return `${d}/${m}/${y}`;
    }

    const dt = new Date(date);

    if (isNaN(dt.getTime())) return '';

    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(
        2,
        '0'
    )}/${dt.getFullYear()}`;
}

async function generateE5NPdf(ergazomenos, companyData, ypokatasthmataData, options = {}) {
    try {
        // =========================================================================
        // LOAD TEMPLATE
        // =========================================================================

        const templatePath = path.join(
            process.cwd(),
            'server',
            'templates',
            'pdf',
            'e5n_template.pdf'
        );

        if (!(await fs.pathExists(templatePath))) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        const existingPdfBytes = await fs.readFile(templatePath);

        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        const pages = pdfDoc.getPages();

        const page1 = pages[0];
        const page2 = pages[1];

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const drawText = (page, text, x, y, size = 9) => {
            page.drawText(String(text || ''), {
                x,
                y,
                size,
                font,
                color: rgb(0, 0, 0)
            });
        };

        // =========================================================================
        // PAGE 1
        // =========================================================================

        // ΕΡΓΟΔΟΤΗΣ

        drawText(page1, companyData?.eponymia || '', 120, 575);
        drawText(page1, companyData?.afm || '', 60, 548);

        drawText(page1, ypokatasthmataData?.doy || '', 350, 520);

        drawText(page1, ypokatasthmataData?.dieythynsh || ypokatasthmataData?.odos || '', 50, 415);

        drawText(page1, ypokatasthmataData?.tk || '', 55, 392);

        drawText(page1, ypokatasthmataData?.polh || '', 180, 392);

        drawText(page1, ypokatasthmataData?.thlefwno || '', 60, 365);

        drawText(page1, companyData?.email || '', 260, 365);

        // =========================================================================
        // ΕΡΓΑΖΟΜΕΝΟΣ
        // =========================================================================

        drawText(page1, ergazomenos?.eponymo || '', 85, 310);

        drawText(page1, ergazomenos?.onoma || '', 320, 310);

        drawText(page1, ergazomenos?.patronymo || '', 100, 285);

        drawText(page1, ergazomenos?.mhtronymo || '', 330, 285);

        drawText(page1, ergazomenos?.afm || '', 60, 258);

        drawText(page1, ergazomenos?.amka || '', 235, 258);

        drawText(page1, ergazomenos?.ama_krathshs_01 || ergazomenos?.amika || '', 390, 258);

        drawText(page1, formatDate(ergazomenos?.hmeromhnia_gennhshs), 70, 230);

        drawText(page1, ergazomenos?.fylo ? 'ΑΝΔΡΑΣ' : 'ΓΥΝΑΙΚΑ', 370, 230);

        drawText(page1, ergazomenos?.doy || '', 50, 205);

        drawText(page1, ergazomenos?.yphkoothta || '', 50, 150);

        drawText(page1, ergazomenos?.ekpaideytiko_epipedo || '', 280, 150);

        drawText(page1, ergazomenos?.typos_taytothtas || 'ΔΑΤ', 55, 95);

        drawText(page1, ergazomenos?.adt || '', 190, 95);

        drawText(page1, ergazomenos?.arxh_ekdoshs || '', 350, 95);

        // =========================================================================
        // PAGE 2
        // =========================================================================

        const apoxwrisiDate =
            options.hmeromhnia_apoxwrhshs ||
            ergazomenos.hmeromhnia_apoxwrhshs ||
            ergazomenos.hmeromhnia_apoxorisis ||
            '';

        drawText(page2, formatDate(ergazomenos?.hmeromhnia_proslhpshs), 70, 455);

        drawText(page2, formatDate(apoxwrisiDate), 260, 455);

        drawText(
            page2,
            String(ergazomenos?.pragmatikosMisthos || ergazomenos?.synolo_symbashs || 0),
            420,
            455
        );

        drawText(page2, ergazomenos?.eidikothta_erganh || '', 65, 425);

        drawText(page2, ergazomenos?.parathrhseis || '', 50, 305);

        // =========================================================================
        // SAVE PDF
        // =========================================================================

        const pdfBytes = await pdfDoc.save();

        const pdfBuffer = Buffer.from(pdfBytes);

        // =========================================================================
        // FILENAME
        // =========================================================================

        const employeeId = String(ergazomenos._id || 'UNKNOWN');

        const eponymo = String(ergazomenos.eponymo || '')
            .replace(/\s+/g, '_')
            .toUpperCase();

        const onoma = String(ergazomenos.onoma || '')
            .replace(/\s+/g, '_')
            .toUpperCase();

        const filename = `${employeeId}_${eponymo}_${onoma}_${Date.now()}.pdf`;

        const companyNameClean = companyData?.eponymia
            ? companyData.eponymia.replace(/\s+/g, '_').substring(0, 50)
            : 'UNKNOWN';

        const s3Key = `pdfs/${ergazomenos.team}/${companyData.kod}_${companyNameClean}/E5N/${filename}`;

        // =========================================================================
        // UPLOAD TO S3
        // =========================================================================

        const uploadResult = await uploadBufferToS3(pdfBuffer, s3Key, 'application/pdf');

        return {
            success: true,
            s3Key: uploadResult.s3Key,
            s3Url: uploadResult.s3Url || uploadResult.localPath,
            filename
        };
    } catch (error) {
        console.error('[E5N-TEMPLATE-PDF] Error:', error);

        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    generateE5NPdf
};
