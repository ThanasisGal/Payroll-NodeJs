// =========================================================================
// ✅ WTO XML GENERATOR για ΕΡΓΑΝΗ II
//    Βασισμένο στο επίσημο sample WTOWEEKLY.xml της ΕΡΓΑΝΗ II
// =========================================================================

/**
 * ✅ Generate WTO XML για ΕΡΓΑΝΗ II
 * @param {Object} ergazomenos - Mongoose Employee Document
 * @param {Object} companyData - Company info
 * @param {Object} ypokatasthmataData - Branch data
 * @param {Array} schedules - Array of ProdhlomenaOraria documents
 * @returns {Promise<Object>} XML result object
 */
async function generateWtoXML(ergazomenos, companyData, ypokatasthmataData, schedules) {
    try {
        console.log('🔧 [WTO-GENERATOR] Starting XML generation...');
        console.log('   Employee:', ergazomenos?.eponymo, ergazomenos?.onoma);
        console.log('   Company:', companyData?.eponymia || 'N/A');
        console.log('   Schedules:', Array.isArray(schedules) ? schedules.length : 0, 'days');

        if (!Array.isArray(schedules) || schedules.length === 0) {
            throw new Error('No schedules provided for WTO XML generation');
        }

        // =====================================================================
        // ✅ SORT & VALIDATE SCHEDULES
        // =====================================================================

        const validSchedules = schedules
            .filter((doc) => doc?.hmeromhnia)
            .map((doc) => {
                // ✅ Convert Mongoose doc to plain object FIRST
                const plainDoc = doc.toObject ? doc.toObject() : doc;
                return {
                    ...plainDoc,
                    __dateObj: new Date(plainDoc.hmeromhnia)
                };
            })
            .filter((doc) => !isNaN(doc.__dateObj.getTime()))
            .sort((a, b) => a.__dateObj - b.__dateObj);

        if (validSchedules.length === 0) {
            throw new Error('No valid schedule dates found');
        }

        const fromDate = validSchedules[0].__dateObj;
        const toDate = validSchedules[validSchedules.length - 1].__dateObj;

        console.log(
            '   Date range:',
            formatDateForErganh(fromDate),
            '-',
            formatDateForErganh(toDate)
        );

        // =====================================================================
        // ✅ XML DATA
        //    Βάσει sample:
        //    <f_rel_protocol />
        //    <f_rel_date />
        //    <f_comments />
        //    <f_to_date></f_to_date>
        // =====================================================================

        const xmlData = {
            f_aa_pararthmatos: normalizePararthmaKodikos(ypokatasthmataData?.kodikos),
            f_rel_protocol: '',
            f_rel_date: '',
            f_comments: '',
            f_from_date: formatDateForErganh(fromDate),
            f_to_date: '',

            f_afm: safeString(ergazomenos?.afm),
            f_eponymo: safeString(ergazomenos?.eponymo).toUpperCase(),
            f_onoma: safeString(ergazomenos?.onoma).toUpperCase(),

            days: validSchedules.map((doc) => buildDayEntry(doc))
        };

        // =====================================================================
        // ✅ BUILD XML
        // =====================================================================

        const xml = buildWtoXML(xmlData);

        console.log('✅ [WTO-GENERATOR] XML generated successfully');
        console.log('   XML length:', xml.length, 'bytes');
        console.log('   Days in XML:', xmlData.days.length);

        // =====================================================================
        // ✅ SAVE XML TO S3
        // =====================================================================

        try {
            const { uploadBufferToS3 } = require('../s3Helper');

            // ✅ Get employee details
            const eponymoClean = safeString(ergazomenos?.eponymo)
                .toUpperCase()
                .replace(/\s+/g, '_');

            const onomaClean = safeString(ergazomenos?.onoma).toUpperCase().replace(/\s+/g, '_');

            const dateStr = formatDateForFilename(fromDate);

            // ✅ Get employee ID (MongoDB _id)
            const employeeId = safeString(ergazomenos?._id || 'UNKNOWN');

            // ✅ New filename format: id_EPONYMO_ONOMA_DATE.xml
            const filename = `${employeeId}_${eponymoClean}_${onomaClean}_${dateStr}.xml`;

            const companyNameClean = companyData?.eponymia
                ? companyData.eponymia.replace(/\s+/g, '_').substring(0, 50)
                : 'UNKNOWN';

            // ✅ New path with WTO_weekly subfolder
            const s3Key = `xmls/${safeString(ergazomenos?.team)}/${safeString(companyData?.kod)}_${companyNameClean}/WTO_weekly/${filename}`;

            console.log('💾 [WTO-GENERATOR] Saving XML to:', s3Key);

            const xmlBuffer = Buffer.from(xml, 'utf-8');
            const uploadResult = await uploadBufferToS3(xmlBuffer, s3Key, 'application/xml');

            console.log(
                '✅ [WTO-GENERATOR] XML saved:',
                uploadResult.s3Url || uploadResult.localPath
            );

            return {
                success: true,
                xml,
                s3Key: uploadResult.s3Key,
                s3Url: uploadResult.s3Url || uploadResult.localPath,
                filename
            };
        } catch (saveError) {
            console.error('❌ [WTO-GENERATOR] Failed to save XML:', saveError.message);

            const eponymoClean = safeString(ergazomenos?.eponymo)
                .toUpperCase()
                .replace(/\s+/g, '_');

            const onomaClean = safeString(ergazomenos?.onoma).toUpperCase().replace(/\s+/g, '_');

            const dateStr = formatDateForFilename(fromDate);
            const filename = `WTO_${eponymoClean}_${onomaClean}_${dateStr}.xml`;

            return {
                success: false,
                xml,
                s3Key: null,
                s3Url: null,
                filename,
                saveError: saveError.message
            };
        }
    } catch (error) {
        console.error('❌ [WTO-GENERATOR] Error:', error.message);
        throw error;
    }
}

// =========================================================================
// ✅ Generate WTOWeek JSON για REST API ΕΡΓΑΝΗ II
//    Βασισμένο στο ίδιο mapping με το generateWtoXML()
//    SubmissionCode: WTOWeek
//    Trial ID: 80
//    Production ID: 182
// =========================================================================
async function generateWTOWeekJSON(ergazomenos, companyData, ypokatasthmataData, schedules) {
    try {
        console.log('🔧 [WTOWeek-JSON] Starting JSON generation...');
        console.log('   Employee:', ergazomenos?.eponymo, ergazomenos?.onoma);
        console.log('   Company:', companyData?.eponymia || 'N/A');
        console.log('   Schedules:', Array.isArray(schedules) ? schedules.length : 0, 'days');

        if (!Array.isArray(schedules) || schedules.length === 0) {
            throw new Error('No schedules provided for WTOWeek JSON generation');
        }

        // =====================================================================
        // ✅ SORT & VALIDATE SCHEDULES
        // =====================================================================

        const validSchedules = schedules
            .filter((doc) => doc?.hmeromhnia)
            .map((doc) => {
                const plainDoc = doc.toObject ? doc.toObject() : doc;
                return {
                    ...plainDoc,
                    __dateObj: new Date(plainDoc.hmeromhnia)
                };
            })
            .filter((doc) => !isNaN(doc.__dateObj.getTime()))
            .sort((a, b) => a.__dateObj - b.__dateObj);

        if (validSchedules.length === 0) {
            throw new Error('No valid schedule dates found for WTOWeek JSON generation');
        }

        const fromDate = validSchedules[0].__dateObj;

        // =====================================================================
        // ✅ WTOWeek REST JSON payload
        //
        // ΠΡΟΣΟΧΗ:
        // Στο REST JSON κρατάμε ΑΚΡΙΒΩΣ τη σειρά του schema/XSD:
        // f_aa_pararthmatos
        // f_rel_protocol
        // f_rel_date
        // f_comments
        // f_from_date
        // f_to_date
        // Ergazomenoi
        //
        // Και στον εργαζόμενο:
        // f_afm
        // f_eponymo
        // f_onoma
        // f_day
        // ErgazomenosAnalytics
        // =====================================================================

        const ergazomenoiWTO = validSchedules.map((doc) => {
            const dayEntry = buildDayEntry(doc);

            return {
                f_afm: safeString(ergazomenos?.afm),
                f_eponymo: safeString(ergazomenos?.eponymo).toUpperCase(),
                f_onoma: safeString(ergazomenos?.onoma).toUpperCase(),
                f_day: dayEntry.f_day,
                ErgazomenosAnalytics: {
                    ErgazomenosWTOAnalytics: dayEntry.shifts.map((shift) => ({
                        f_type: safeString(shift.f_type).toUpperCase(),
                        f_from: safeString(shift.f_from),
                        f_to: safeString(shift.f_to)
                    }))
                }
            };
        });

        const payload = {
            WTOS: {
                WTO: [
                    {
                        f_aa_pararthmatos: normalizePararthmaKodikos(ypokatasthmataData?.kodikos),
                        f_rel_protocol: '',
                        f_rel_date: '',
                        f_comments: '',
                        f_from_date: formatDateForErganh(fromDate),
                        f_to_date: '',
                        Ergazomenoi: {
                            ErgazomenoiWTO: ergazomenoiWTO
                        }
                    }
                ]
            }
        };

        console.log('✅ [WTOWeek-JSON] JSON generated successfully');
        console.log('   Payload root:', Object.keys(payload));
        console.log('   Days in payload:', ergazomenoiWTO.length);

        return {
            success: true,
            submissionCode: 'WTOWeek',
            payload,
            json: payload
        };
    } catch (error) {
        console.error('❌ [WTOWeek-JSON] Error:', error.message);
        throw error;
    }
}

// =========================================================================
// ✅ HELPER: Build one day entry
// =========================================================================

function buildDayEntry(doc) {
    // ✅ Use hmeromhnia or __dateObj
    const hmeromhnia = doc?.hmeromhnia || doc?.__dateObj;
    const dayOfWeek = getDayOfWeek(hmeromhnia);

    console.log(`   DEBUG: hmeromhnia = ${hmeromhnia}, dayOfWeek = ${dayOfWeek}`);

    // ✅ Get category (single field per day, not per weekday)
    const fType = safeString(doc?.kathgoria_ergasias || 'ΕΡΓ')
        .toUpperCase()
        .trim();

    const shifts = [];

    // ---------------------------------------------------------------------
    // ΑΝ / ΜΕ -> no times
    // ---------------------------------------------------------------------
    if (fType === 'ΑΝ' || fType === 'ΜΕ') {
        console.log(
            `   ${formatDateForErganh(hmeromhnia)} (Day ${dayOfWeek}): ${fType} (no times)`
        );

        shifts.push({
            f_type: fType,
            f_from: '',
            f_to: ''
        });

        return {
            f_day: String(dayOfWeek),
            shifts
        };
    }

    // ---------------------------------------------------------------------
    // ΕΡΓ / ΤΗΛ -> με ώρες όταν υπάρχουν
    // ---------------------------------------------------------------------

    pushShiftIfValid(shifts, fType, doc?.apo_ora_01, doc?.eos_ora_01);
    pushShiftIfValid(shifts, fType, doc?.apo_ora_02, doc?.eos_ora_02);
    pushShiftIfValid(shifts, fType, doc?.apo_ora_03, doc?.eos_ora_03);

    // ---------------------------------------------------------------------
    // Αν δεν υπάρχουν ώρες, στείλε κενά
    // ---------------------------------------------------------------------
    if (shifts.length === 0) {
        console.log(
            `   ${formatDateForErganh(hmeromhnia)} (Day ${dayOfWeek}): ${fType} (empty times)`
        );

        shifts.push({
            f_type: fType,
            f_from: '',
            f_to: ''
        });
    } else {
        console.log(
            `   ${formatDateForErganh(hmeromhnia)} (Day ${dayOfWeek}): ${fType} - ${shifts.length} shift(s)`
        );
    }

    return {
        f_day: String(dayOfWeek),
        shifts
    };
}

// =========================================================================
// ✅ HELPER: Push shift if times are valid
// =========================================================================

function pushShiftIfValid(shifts, fType, from, to) {
    const cleanFrom = normalizeTime(from);
    const cleanTo = normalizeTime(to);

    if (cleanFrom && cleanTo) {
        shifts.push({
            f_type: fType,
            f_from: cleanFrom,
            f_to: cleanTo
        });
    }
}

// =========================================================================
// ✅ HELPER: Get day of week
// JavaScript: 0=Sunday, 1=Monday, ..., 6=Saturday
// Το sample της ΕΡΓΑΝΗ χρησιμοποιεί ακριβώς αυτό το pattern
// =========================================================================

function getDayOfWeek(date) {
    if (!date) {
        return '';
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
        return '';
    }
    const dayOfWeek = d.getDay();

    return dayOfWeek;
}
// =========================================================================
// ✅ HELPER: Normalize time
// Accepts HH:mm, ignores '--:--', null, undefined
// =========================================================================

function normalizeTime(value) {
    if (value === null || value === undefined) return '';
    const str = String(value).trim();

    if (!str || str === '--:--') return '';

    const match = str.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return '';

    return str;
}

// =========================================================================
// ✅ HELPER: Date formatting DD/MM/YYYY
// =========================================================================

function formatDateForErganh(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());

    return `${day}/${month}/${year}`;
}

function formatDateForFilename(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());

    return `${day}-${month}-${year}`; // ✅ 16-03-2026
}

// =========================================================================
// ✅ HELPER: Branch code
// Το sample έχει 0. Κρατάμε τον πραγματικό κωδικό αν υπάρχει, αλλιώς 0.
// =========================================================================

function normalizePararthmaKodikos(value) {
    if (value === null || value === undefined) return '0';

    const str = String(value).trim();
    if (!str) return '0';

    return str;
}

// =========================================================================
// ✅ BUILD XML STRING
// Βάσει sample WTOWEEKLY.xml:
// 1. Root WTOS με xmlns:xsd / xmlns:xsi / default namespace
// 2. Inner WTO με xmlns=""
// 3. Σειρά: comments πριν από from_date
// =========================================================================

function buildWtoXML(data) {
    const employeesXml = data.days
        .map((day) => {
            const shiftsXml = day.shifts
                .map(
                    (shift) => `          <ErgazomenosWTOAnalytics>
            <f_type>${escapeXml(shift.f_type)}</f_type>
            <f_from>${escapeXml(shift.f_from)}</f_from>
            <f_to>${escapeXml(shift.f_to)}</f_to>
          </ErgazomenosWTOAnalytics>`
                )
                .join('\n');

            return `      <ErgazomenoiWTO>
        <f_afm>${escapeXml(data.f_afm)}</f_afm>
        <f_eponymo>${escapeXml(data.f_eponymo)}</f_eponymo>
        <f_onoma>${escapeXml(data.f_onoma)}</f_onoma>
        <f_day>${escapeXml(day.f_day)}</f_day>
        <ErgazomenosAnalytics>
${shiftsXml}
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

// =========================================================================
// ✅ HELPERS
// =========================================================================

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

// =========================================================================
// ✅ EXPORTS
// =========================================================================

module.exports = {
    generateWtoXML,
    generateWTOWeekJSON
};
