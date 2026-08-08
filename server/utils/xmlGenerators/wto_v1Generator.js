// ============================================================================
// WTO v1 XML GENERATOR — Απολογιστικός Πίνακας Ωραρίων
// Source: ProdhlomenaOrariaModel rows with apologistiko_biblio === true
// ============================================================================
const fs = require('fs');
const path = require('path');
const libxmljs = require('libxmljs2');
const {
    buildWtoDailySubmissionProjection
} = require('../../services/ergazomenoi/wtoDailySubmissionProjectionService');

async function generateWTOXML(companyData, ypokatasthmataData, prodhlomenaRows, options = {}) {
    try {
        console.log('🔧 [WTO-v1] Starting XML generation...');

        if (!Array.isArray(prodhlomenaRows) || prodhlomenaRows.length === 0) {
            throw new Error('[WTO-v1] Δεν υπάρχουν απολογιστικές εγγραφές για XML.');
        }

        const validRows = prodhlomenaRows
            .map((doc) => (doc?.toObject ? doc.toObject() : doc))
            .filter((row) => row?.apologistiko_biblio === true)
            .filter((row) => row?.hmeromhnia)
            .sort((a, b) => {
                const dateDiff = new Date(a.hmeromhnia) - new Date(b.hmeromhnia);
                if (dateDiff !== 0) return dateDiff;

                return String(a.kodikos || '').localeCompare(String(b.kodikos || ''), 'el');
            });

        if (validRows.length === 0) {
            throw new Error('[WTO-v1] Δεν βρέθηκαν εγγραφές με apologistiko_biblio=true.');
        }

        const employeesByCode = new Map();
        validRows.forEach((row) => employeesByCode.set(String(row.kodikos || '').trim(), {
            kodikos: row.kodikos, afm: row.afm_ergazomenoy || row.afm,
            eponymo: row.eponymo_ergazomenoy || row.eponymo,
            onoma: row.onoma_ergazomenoy || row.onoma
        }));
        const xmlData = options.projection || buildWtoDailySubmissionProjection({
            rows: validRows,
            employees: [...employeesByCode.values()],
            branch: options.ypokatasthma || ypokatasthmataData?.kodikos,
            periodStart: options.apo_hmeromhnia,
            periodEnd: options.eos_hmeromhnia,
            comments: options.comments || ''
        });

        const xml = buildWTOXML(xmlData);

        const xsdPath = path.join(__dirname, 'xsd', 'WTO_v1.xsd');

        if (!fs.existsSync(xsdPath)) {
            throw new Error(`[WTO-v1] Δεν βρέθηκε XSD αρχείο: ${xsdPath}`);
        }

        const xsdContent = fs.readFileSync(xsdPath, 'utf8');

        const xmlDoc = libxmljs.parseXml(xml);
        const xsdDoc = libxmljs.parseXml(xsdContent);

        const isValid = xmlDoc.validate(xsdDoc);

        if (!isValid) {
            console.error('❌ [WTO-v1] XSD validation errors:');

            xmlDoc.validationErrors.forEach((err) => {
                console.error('   •', err.message);
            });

            throw new Error(
                `[WTO-v1] Το XML απέτυχε στο XSD validation (${xmlDoc.validationErrors.length} errors).`
            );
        }

        console.log('✅ [WTO-v1] XSD validation passed');

        console.log('✅ [WTO-v1] XML generated successfully');
        console.log('   XML length:', xml.length, 'bytes');
        console.log('   Source rows:', validRows.length);
        console.log('   Employee/date groups:', xmlData.employees.length);

        const filename = `WTO_APOLOGISTIKOS_${formatDateForFilename(xmlData.f_from_date)}_${formatDateForFilename(xmlData.f_to_date)}.xml`;

        const { uploadBufferToS3 } = require('../s3Helper');

        const companyKodikosClean = safeString(
            options.companyKodikos ||
                companyData?.kod ||
                companyData?.kodikos ||
                companyData?._id ||
                'UNKNOWN'
        );

        const companyDescriptionClean = safeString(
            options.companyDescription ||
                options.companyEponymia ||
                companyData?.eponymia ||
                companyData?.perigrafh ||
                'UNKNOWN'
        )
            .replace(/\s+/g, '_')
            .substring(0, 80);

        const teamClean = safeString(options.team || companyData?.team || 'UNKNOWN');

        const s3Key = [
            'xmls',
            teamClean,
            `${companyKodikosClean}_${companyDescriptionClean}`,
            'WTO_Apologistikos',
            filename
        ].join('/');

        console.log('💾 [WTO-v1] Saving XML to:', s3Key);

        const uploadResult = await uploadBufferToS3(
            Buffer.from(xml, 'utf-8'),
            s3Key,
            'application/xml'
        );

        return {
            success: true,
            xml,
            s3Key: uploadResult.s3Key,
            s3Url: uploadResult.s3Url || uploadResult.localPath,
            filename
        };
    } catch (error) {
        console.error('❌ [WTO-v1] Error:', error.message);
        throw error;
    }
}

function buildWTOXML(data) {
    const employeesXml = data.employees
        .map((emp) => {
            const analyticsXml = emp.analytics
                .map(
                    (a) => `        <ErgazomenosWTOAnalytics>
          <f_type>${escapeXml(a.f_type)}</f_type>
          <f_from>${escapeXml(a.f_from)}</f_from>
          <f_to>${escapeXml(a.f_to)}</f_to>
        </ErgazomenosWTOAnalytics>`
                )
                .join('\n');

            return `      <ErgazomenoiWTO>
        <f_afm>${escapeXml(emp.f_afm)}</f_afm>
        <f_eponymo>${escapeXml(emp.f_eponymo)}</f_eponymo>
        <f_onoma>${escapeXml(emp.f_onoma)}</f_onoma>
        <f_date>${escapeXml(emp.f_date)}</f_date>
        <ErgazomenosAnalytics>
${analyticsXml}
        </ErgazomenosAnalytics>
      </ErgazomenoiWTO>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<WTOS xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.yeka.gr/WTO">
  <WTO xmlns="">
    <f_aa_pararthmatos>${escapeXml(data.f_aa_pararthmatos)}</f_aa_pararthmatos>
    <f_rel_protocol>${escapeXml(data.f_rel_protocol)}</f_rel_protocol>
    <f_rel_date>${escapeXml(data.f_rel_date)}</f_rel_date>
    <f_comments>${escapeXml(data.f_comments)}</f_comments>
    <f_from_date>${escapeXml(data.f_from_date)}</f_from_date>
    <f_to_date>${escapeXml(data.f_to_date)}</f_to_date>
    <Ergazomenoi>
${employeesXml}
    </Ergazomenoi>
  </WTO>
</WTOS>`;
}

function formatDateForErganh(date) {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());

    return `${day}/${month}/${year}`;
}

function formatDateForFilename(dateOrString) {
    if (!dateOrString) return '';

    if (typeof dateOrString === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateOrString)) {
        return dateOrString.replace(/\//g, '-');
    }

    const d = new Date(dateOrString);
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());

    return `${day}-${month}-${year}`;
}

function safeString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function escapeXml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';

    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

module.exports = {
    generateWTOXML,
    buildWTOXML
};
