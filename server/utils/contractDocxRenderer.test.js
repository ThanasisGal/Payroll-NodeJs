'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const PizZip = require('pizzip');

const { buildContractDateData } = require('./contractDateData');
const { renderContractDocxBuffer } = require('./contractDocxRenderer');

const execFileAsync = promisify(execFile);
const templatePath = path.resolve(
    __dirname,
    '../../public/templates/ΑΡΧΙΚΗ ΣΥΜΒΑΣΗ ΕΡΓΑΖΟΜΕΝΩΝ.docx'
);
const fixture = {
    hmeromhnia_proslhpshs: '2026-09-16',
    hmeromhnia_allaghs_symbashs: '2026-09-16',
    hmeromhnia_lhxhs_symbashs: '2027-07-30'
};

function documentXml(buffer) {
    return new PizZip(buffer).file('word/document.xml').asText();
}

function xmlText(xml) {
    return xml
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<w:br\/>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

async function executableExists(executable) {
    try {
        await fs.access(executable);
        return true;
    } catch {
        return false;
    }
}

test('actual contract template has the expected date placeholders without a hard-coded year', async () => {
    const template = await fs.readFile(templatePath);
    const xml = documentXml(template);
    const text = xmlText(xml);

    assert.equal((text.match(/\{_DIARKEIA\}/g) || []).length, 1);
    assert.equal((text.match(/\{_HMEROMHNIA_LHXHS_SYMBASHS\}/g) || []).length, 1);
    assert.equal((text.match(/\{_HMEROMHNIA_PROSLHPSHS\}/g) || []).length, 4);
    assert.doesNotMatch(text, /30\/07\/2026|30\/07\/2027/);
});

test('generated DOCX contains the authoritative dates consistently', async () => {
    const template = await fs.readFile(templatePath);
    const rendered = renderContractDocxBuffer(template, buildContractDateData(fixture));
    const text = xmlText(documentXml(rendered));

    assert.match(text, /16\/09\/2026/);
    assert.equal((text.match(/30\/07\/2027/g) || []).length, 2);
    assert.match(text, /10 μηνών, 14 ημερών/);
    assert.doesNotMatch(text, /30\/07\/2026/);
    assert.doesNotMatch(text, /\{_DIARKEIA\}|\{_HMEROMHNIA_LHXHS_SYMBASHS\}/);
});

test('LibreOffice conversion preserves the 2027 expiry in PDF text', async (t) => {
    const libreOffice = '/usr/bin/libreoffice';
    const pdfToText = '/usr/bin/pdftotext';
    if (!(await executableExists(libreOffice)) || !(await executableExists(pdfToText))) {
        t.skip('Δεν είναι διαθέσιμα το LibreOffice και το pdftotext.');
        return;
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contract-pdf-date-'));
    try {
        const template = await fs.readFile(templatePath);
        const docxPath = path.join(tempDir, 'contract.docx');
        const pdfPath = path.join(tempDir, 'contract.pdf');
        const textPath = path.join(tempDir, 'contract.txt');
        await fs.writeFile(
            docxPath,
            renderContractDocxBuffer(template, buildContractDateData(fixture))
        );

        await execFileAsync(libreOffice, [
            '--headless',
            '--convert-to',
            'pdf',
            docxPath,
            '--outdir',
            tempDir
        ]);
        await execFileAsync(pdfToText, [pdfPath, textPath]);
        const pdfText = await fs.readFile(textPath, 'utf8');

        assert.match(pdfText, /16\/09\/2026/);
        assert.match(pdfText, /30\/07\/2027/);
        assert.doesNotMatch(pdfText, /30\/07\/2026/);
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
});
