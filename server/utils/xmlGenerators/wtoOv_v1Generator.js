// ============================================================================
// WTOOv v1 XML GENERATOR — Απολογιστικός Πίνακας Υπερωριών
// 1 εργαζόμενος + 1 ημερομηνία = 1 ErgazomenoiWTO
// Αν η υπερωρία περνάει μεσάνυχτα, σπάει σε:
//   τρέχουσα ημέρα: apo - 23:59
//   επόμενη ημέρα: 00:00 - eos
// Αν η επόμενη ημέρα έχει και δική της υπερωρία, μπαίνει σαν 2ο analytic.
// ============================================================================

const fs = require('fs');
const path = require('path');
const libxmljs = require('libxmljs2');

async function generateWTOOvXML(companyData, ypokatasthmataData, prodhlomenaRows, options = {}) {
    try {
        console.log('🔧 [WTOOv-v1] Starting XML generation...');

        if (!Array.isArray(prodhlomenaRows) || prodhlomenaRows.length === 0) {
            throw new Error('[WTOOv-v1] Δεν υπάρχουν εγγραφές υπερωριών για XML.');
        }

        const sourceRows = prodhlomenaRows
            .map((doc) => (doc?.toObject ? doc.toObject() : doc))
            .filter((row) => row?.hmeromhnia)
            .filter((row) => normalizeTime(row?.apo_ora_yperories))
            .filter((row) => normalizeTime(row?.eos_ora_yperories))
            .sort((a, b) => {
                const dateDiff = new Date(a.hmeromhnia) - new Date(b.hmeromhnia);
                if (dateDiff !== 0) return dateDiff;
                return String(a.kodikos || '').localeCompare(String(b.kodikos || ''), 'el');
            });

        if (sourceRows.length === 0) {
            throw new Error(
                '[WTOOv-v1] Δεν βρέθηκαν εγγραφές με συμπληρωμένα apo_ora_yperories / eos_ora_yperories.'
            );
        }

        const employees = buildEmployees(sourceRows);

        if (employees.length === 0) {
            throw new Error('[WTOOv-v1] Δεν δημιουργήθηκε καμία έγκυρη εγγραφή XML.');
        }

        const xmlData = {
            f_aa_pararthmatos: normalizePararthmaKodikos(
                options.ypokatasthma || ypokatasthmataData?.kodikos
            ),
            f_rel_protocol: '',
            f_rel_date: '',
            f_comments: options.comments || '',
            f_from_date: formatDateForErganh(options.apo_hmeromhnia || sourceRows[0].hmeromhnia),
            f_to_date: formatDateForErganh(
                options.eos_hmeromhnia || sourceRows[sourceRows.length - 1].hmeromhnia
            ),
            employees
        };

        const xml = buildWTOOvXML(xmlData);

        const xsdPath = path.join(__dirname, 'xsd', 'WTO_v1.xsd');

        if (!fs.existsSync(xsdPath)) {
            throw new Error(`[WTOOv-v1] Δεν βρέθηκε XSD αρχείο: ${xsdPath}`);
        }

        const xsdContent = fs.readFileSync(xsdPath, 'utf8');

        const xmlDoc = libxmljs.parseXml(xml);
        const xsdDoc = libxmljs.parseXml(xsdContent);

        const isValid = xmlDoc.validate(xsdDoc);

        if (!isValid) {
            console.error('❌ [WTOOv-v1] XSD validation errors:');

            xmlDoc.validationErrors.forEach((err) => {
                console.error('   •', err.message);
            });

            throw new Error(
                `[WTOOv-v1] Το XML απέτυχε στο XSD validation (${xmlDoc.validationErrors.length} errors).`
            );
        }

        console.log('✅ [WTOOv-v1] XSD validation passed');
        console.log('✅ [WTOOv-v1] XML generated successfully');
        console.log('   XML length:', xml.length, 'bytes');
        console.log('   Source rows:', sourceRows.length);
        console.log('   Employee/date groups:', xmlData.employees.length);

        const filename = `WTO_OVERTIME_APOLOGISTIKOS_${formatDateForFilename(
            xmlData.f_from_date
        )}_${formatDateForFilename(xmlData.f_to_date)}.xml`;

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
            'WTO_Apologistikos_Yperorion',
            filename
        ].join('/');

        console.log('💾 [WTOOv-v1] Saving XML to:', s3Key);

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
        console.error('❌ [WTOOv-v1] Error:', error.message);
        throw error;
    }
}

function buildEmployees(rows) {
    const grouped = new Map();

    for (const row of rows) {
        const splitAnalytics = splitOvertimeRow(row);

        for (const item of splitAnalytics) {
            const afm = safeString(row.afm_ergazomenoy || row.afm);
            const date = formatDateForErganh(item.date);
            const key = `${afm}|${date}`;

            if (!grouped.has(key)) {
                grouped.set(key, {
                    f_afm: afm,
                    f_eponymo: safeString(row.eponymo_ergazomenoy || row.eponymo).toUpperCase(),
                    f_onoma: safeString(row.onoma_ergazomenoy || row.onoma).toUpperCase(),
                    f_date: date,
                    analytics: []
                });
            }

            grouped.get(key).analytics.push({
                f_type: 'ΥΠ',
                f_from: item.from,
                f_to: item.to
            });
        }
    }

    return Array.from(grouped.values())
        .map((emp) => ({
            ...emp,
            analytics: emp.analytics.sort(
                (a, b) => timeToMinutes(a.f_from) - timeToMinutes(b.f_from)
            )
        }))
        .filter((emp) => emp.f_afm && emp.f_date && emp.analytics.length > 0)
        .sort((a, b) => {
            const dateDiff = parseErganhDate(a.f_date) - parseErganhDate(b.f_date);
            if (dateDiff !== 0) return dateDiff;
            return String(a.f_afm || '').localeCompare(String(b.f_afm || ''), 'el');
        });
}

function splitOvertimeRow(row) {
    const baseDate = normalizeDateOnly(row.hmeromhnia);
    const from = normalizeTime(row.apo_ora_yperories);
    const to = normalizeTime(row.eos_ora_yperories);

    if (!baseDate || !from || !to) return [];

    const fromMin = timeToMinutes(from);
    const toMin = timeToMinutes(to);

    if (fromMin === null || toMin === null) return [];

    // Κανονική υπερωρία ίδιας ημέρας.
    // Π.χ. 21:09 - 23:58
    if (toMin > fromMin) {
        return [
            {
                date: baseDate,
                from,
                to
            }
        ];
    }

    // Αν είναι ίδιες ώρες, δεν στέλνουμε μηδενική διάρκεια.
    if (toMin === fromMin) {
        return [];
    }

    // Υπερωρία που περνάει μεσάνυχτα.
    // Π.χ. 22:00 - 00:30
    return [
        {
            date: baseDate,
            from,
            to: '23:59'
        },
        {
            date: addDays(baseDate, 1),
            from: '00:00',
            to
        }
    ];
}

function buildWTOOvXML(data) {
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

function normalizeTime(value) {
    if (value === null || value === undefined) return '';

    const str = String(value).trim();
    if (!str || str === '--:--') return '';

    const match = str.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return '';

    return str;
}

function timeToMinutes(value) {
    const clean = normalizeTime(value);
    if (!clean) return null;

    const [hh, mm] = clean.split(':').map(Number);
    return hh * 60 + mm;
}

function normalizeDateOnly(value) {
    if (!value) return null;

    const d = new Date(value);
    if (isNaN(d.getTime())) return null;

    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
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

function parseErganhDate(value) {
    const m = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return new Date(0);

    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
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

function normalizePararthmaKodikos(value) {
    if (value === null || value === undefined) return '0';

    const str = String(value).trim();
    if (!str) return '0';

    return str;
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
    generateWTOOvXML,
    buildWTOOvXML
};
