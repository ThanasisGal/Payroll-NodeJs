'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { simplePdfFooterLayout } = require('./apasxoliseisEmploymentReviewReportService');
const {
    REPORT_TITLE, generatePdf, metadataHeader, COLUMN_KEYS
} = require('./apologistikosPinakasControlPdfService');

(async () => {
    const criteria = { ypokatasthma: '0000', startIso: '2026-08-01', endIso: '2026-08-31' };
    const row = { ypokatasthma: '0000', kodikos: '0001', afm: '111111111', eponymo: 'ΔΟΚΙΜΗ', onoma: 'ΕΛΕΝΗ',
        hmeromhnia: '01/08/2026', category: 'ΕΡΓ', zeugos1: '09:00 – 17:00', zeugos2: '— – —', zeugos3: '— – —' };
    const companyName = 'ΧΡΗΣΤΟΣ ΚΑΡΡΑΣ ΚΑΙ ΒΑΣΙΛΙΚΗ ΤΣΟΥΡΑΠΑ ΕΠΕ';
    assert.deepStrictEqual(COLUMN_KEYS, ['ypokatasthma', 'kodikos', 'afm', 'eponymo', 'onoma', 'hmeromhnia',
        'category', 'zeugos1', 'zeugos2', 'zeugos3']);
    const columns = ['Παράρτημα', 'Κωδικός', 'ΑΦΜ', 'Επώνυμο', 'Όνομα', 'Ημερομηνία', 'Κατηγορία',
        'ΑΠΟ-ΕΩΣ ΩΡΑ 1', 'ΑΠΟ-ΕΩΣ ΩΡΑ 2', 'ΑΠΟ-ΕΩΣ ΩΡΑ 3'];
    assert.strictEqual(REPORT_TITLE, 'Κατάσταση Ελέγχου Απολογιστικού Πίνακα');
    assert.strictEqual(metadataHeader({ companyName, criteria }),
        'Εταιρεία: ΧΡΗΣΤΟΣ ΚΑΡΡΑΣ ΚΑΙ ΒΑΣΙΛΙΚΗ ΤΣΟΥΡΑΠΑ ΕΠΕ   Παράρτημα: 0000   ' +
        'Περίοδος: 01/08/2026–31/08/2026');
    assert.strictEqual(simplePdfFooterLayout(1, 1).center,
        '© 2009 - 2026 Copyright: www.WebPayrollSolutions.com   Ιωλκού 266α Βόλος   ' +
        'Τηλ.: 2421056825   Κιν.: 6972012650   email: support@WebPayrollSolutions.com');
    assert.strictEqual(simplePdfFooterLayout(1, 1).page, 'Σελίδα 1 / 1');
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    for (const rows of [[], Array.from({ length: 180 }, () => row)]) {
        const buffer = await generatePdf({ rows, criteria, columns, companyName });
        assert.ok(Buffer.isBuffer(buffer)); assert.strictEqual(buffer.subarray(0, 4).toString(), '%PDF');
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
        if (!rows.length) assert.strictEqual(pdf.numPages, 1);
        else assert.ok(pdf.numPages > 1);
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const text = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ');
            const footer = simplePdfFooterLayout(pageNumber, pdf.numPages);
            assert.match(text, /© 2009 - 2026 Copyright: www\.WebPayrollSolutions\.com/);
            assert.ok(text.includes(footer.page));
            if (!rows.length) assert.ok(text.includes('Δεν βρέθηκαν εγγραφές για τα επιλεγμένα κριτήρια.'));
        }
    }
    const source = fs.readFileSync(path.join(__dirname, 'apologistikosPinakasControlPdfService.js'), 'utf8');
    assert.ok(source.includes("layout: 'landscape'"));
    assert.ok(source.includes("size: 'A4'"));
    assert.ok(source.includes('bufferPages: true'));
    assert.ok(source.includes('addSimplePdfFooters(doc, fonts)'));
    assert.ok(source.includes('Κατάσταση Ελέγχου Απολογιστικού Πίνακα'));
    assert.ok(source.includes('Δεν βρέθηκαν εγγραφές για τα επιλεγμένα κριτήρια.'));
    assert.ok(source.includes('if (doc.y + rowHeight > bottom()) newPage()'));
    console.log('PASS accounting control PDF buffer, A4 landscape, Greek, pagination and empty result');
})().catch((error) => { console.error(error); process.exitCode = 1; });
