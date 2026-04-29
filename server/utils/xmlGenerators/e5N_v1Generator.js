// =========================================================================
// ✅ E5N XML GENERATOR V1 για ΕΡΓΑΝΗ II
//    Αναγγελία Οικειοθελούς Αποχώρησης Μισθωτού
//    Βάσει E5N_v1.xsd
// =========================================================================

async function generateE5NXML(ergazomenos, companyData, ypokatasthmataData, options = {}) {
    try {
        // =====================================================================
        // ✅ VALIDATION: Required Fields
        // =====================================================================

        const requiredFields = [
            { field: 'eponymo', label: 'Επώνυμο' },
            { field: 'onoma', label: 'Όνομα' },
            { field: 'patronymo', label: 'Πατρώνυμο' },
            { field: 'mhtronymo', label: 'Μητρώνυμο' },
            { field: 'hmeromhnia_gennhshs', label: 'Ημ/νία Γέννησης' },
            { field: 'afm', label: 'ΑΦΜ' },
            { field: 'amka', label: 'ΑΜΚΑ' },
            { field: 'adt', label: 'Αριθμός Νομιμοποιητικού εγγράφου' },
            { field: 'hmeromhnia_proslhpshs', label: 'Ημ/νία Πρόσληψης' }
        ];

        const apoxwrisiDate =
            options.hmeromhnia_apoxwrhshs ||
            options.apoxwrisi_date ||
            ergazomenos.hmeromhnia_apoxwrhshs ||
            ergazomenos.hmeromhnia_apoxorisis ||
            ergazomenos.apoxwrisi_date ||
            ergazomenos.apoxwrisidate;

        if (!apoxwrisiDate) {
            throw new Error('[E5N-GENERATOR-v1] Λείπει υποχρεωτικό πεδίο: Ημ/νία Αποχώρησης');
        }

        const missingFields = requiredFields
            .filter(({ field }) => !ergazomenos[field])
            .map(({ label }) => label);

        if (missingFields.length > 0) {
            throw new Error(
                `[E5N-GENERATOR-v1] Λείπουν υποχρεωτικά πεδία: ${missingFields.join(', ')}`
            );
        }

        // =====================================================================
        // ✅ DOWNLOAD PDFs FROM S3
        // =====================================================================

        let e5PdfBase64 = '';
        let foreignPdfBase64 = '';
        let youngPdfBase64 = '';

        const pdfPath =
            options.e5_pdf_path ||
            options.apoxwrhsh_pdf_path ||
            ergazomenos.e5_pdf_path ||
            ergazomenos.apoxwrhsh_pdf_path ||
            ergazomenos.arxeio_entypou_e5_path ||
            ergazomenos.arxeio_oikeiothelous_apoxwrhshs_path ||
            ergazomenos.arxeio_apoxwrhshs_path;

        if (pdfPath) {
            try {
                console.log('📥 [E5N-GENERATOR-v1] Downloading E5N PDF from S3...');
                const { downloadFileFromS3 } = require('../s3Helper');
                const pdfBuffer = await downloadFileFromS3(pdfPath);
                e5PdfBase64 = pdfBuffer.toString('base64');
                console.log(`✅ [E5N-GENERATOR-v1] E5N PDF: ${e5PdfBase64.length} chars`);
            } catch (pdfError) {
                console.error('❌ [E5N-GENERATOR-v1] Failed to download E5N PDF:', pdfError.message);
            }
        }

        if (ergazomenos.arxeio_nomimopoihtikon_eggrafon_path) {
            try {
                const { downloadFileFromS3 } = require('../s3Helper');
                const pdfBuffer = await downloadFileFromS3(ergazomenos.arxeio_nomimopoihtikon_eggrafon_path);
                foreignPdfBase64 = pdfBuffer.toString('base64');
                console.log(`✅ [E5N-GENERATOR-v1] Foreign docs PDF: ${foreignPdfBase64.length} chars`);
            } catch (pdfError) {
                console.error('❌ [E5N-GENERATOR-v1] Failed to download foreign docs PDF:', pdfError.message);
            }
        }

        if (ergazomenos.bibliario_anhlikoy_path) {
            try {
                const { downloadFileFromS3 } = require('../s3Helper');
                const pdfBuffer = await downloadFileFromS3(ergazomenos.bibliario_anhlikoy_path);
                youngPdfBase64 = pdfBuffer.toString('base64');
                console.log(`✅ [E5N-GENERATOR-v1] Young worker docs PDF: ${youngPdfBase64.length} chars`);
            } catch (pdfError) {
                console.error('❌ [E5N-GENERATOR-v1] Failed to download young docs PDF:', pdfError.message);
            }
        }

        // =====================================================================
        // ✅ FIELD MAPPING βάσει E5N_v1.xsd και testApoxwrhshsNew.xml
        // =====================================================================

        const xmlData = {
            f_aa_pararthmatos: String(ypokatasthmataData?.kodikos || '0'),
            f_rel_protocol: options.f_rel_protocol || ergazomenos.f_rel_protocol || '',
            f_rel_date: formatDateForErganh(options.f_rel_date || ergazomenos.f_rel_date),
            f_ypiresia_sepe: ypokatasthmataData?.sepe_ergoy || '00000',
            f_ypiresia_oaed: ypokatasthmataData?.dypa_ergoy || '000000',
            f_kad_pararthmatos: getKad4(ypokatasthmataData?.kad6 || ypokatasthmataData?.kad || companyData?.kad6 || companyData?.kad) || '0000',
            f_kallikratis_pararthmatos: ypokatasthmataData?.polh || ypokatasthmataData?.kallikratis || '00000000',

            f_eponymo: upper(ergazomenos.eponymo),
            f_onoma: upper(ergazomenos.onoma),
            f_onoma_patros: upper(ergazomenos.patronymo),
            f_onoma_mitros: upper(ergazomenos.mhtronymo),
            f_birthdate: formatDateForErganh(ergazomenos.hmeromhnia_gennhshs),
            f_sex: ergazomenos.fylo ? '1' : '0',
            f_yphkoothta: normalizeYphkoothta(ergazomenos.yphkoothta, '348'),
            f_typos_taytothtas: ergazomenos.typos_taytothtas || 'ΔΑΤ',
            f_ar_taytothtas: ergazomenos.adt || '',
            f_ekdousa_arxh: ergazomenos.arxh_ekdoshs || '',
            f_date_ekdosis: formatDateForErganh(ergazomenos.hmeromhnia_ekdoshs),
            f_date_ekdosis_lixi: formatDateForErganh(ergazomenos.hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy),

            f_res_permit_inst: ergazomenos.adeia_diamonhs_me_amesh_prosbash_gia_ergasia ? '1' : '0',
            f_res_permit_inst_type: ergazomenos.eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia || '',
            f_res_permit_inst_ar: ergazomenos.arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia || '',
            f_res_permit_inst_lixi: formatDateForErganh(ergazomenos.hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia),
            f_res_permit_ap: ergazomenos.adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia ? '1' : '0',
            f_res_permit_ap_type: ergazomenos.eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia || '',
            f_res_permit_ap_ar: ergazomenos.arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia || '',
            f_res_permit_ap_lixi: formatDateForErganh(ergazomenos.hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia),
            f_res_permit_visa: ergazomenos.adeia_eisodoy_gia_epoxikh_apasxolhsh ? '1' : '0',
            f_res_permit_visa_ar: ergazomenos.arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh || '',
            f_res_permit_visa_from: formatDateForErganh(ergazomenos.apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh),
            f_res_permit_visa_to: formatDateForErganh(ergazomenos.eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh),

            f_marital_status: ergazomenos.oikogeneiakh_katastash || '0',
            f_arithmos_teknon: String(ergazomenos.arithmos_teknon || 0),
            f_afm: ergazomenos.afm,
            f_doy: ergazomenos.doy || '',
            f_amika: ergazomenos.ama_krathshs_01 || ergazomenos.amika || '',
            f_amka: ergazomenos.amka || '',
            f_code_anergias: ergazomenos.arithmos_deltioy_anergias || '',
            f_ar_vivliou_anilikou: ergazomenos.arithmos_bibliarioy_anhlikoy || '',
            f_epipedo_morfosis: ergazomenos.ekpaideytiko_epipedo || '1',

            f_xaraktirismos: ergazomenos.xarakthrismos_ergazomenon ? '1' : '0',
            f_sxeshapasxolisis: ergazomenos.sxesh_ergasias || '0',
            f_orismenou_apo: ergazomenos.sxesh_ergasias === '1' ? formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs) : '',
            f_orismenou_ews: ergazomenos.sxesh_ergasias === '1' ? formatDateForErganh(ergazomenos.hmeromhnia_lhxhs_symbashs) : '',
            f_kathestosapasxolisis: ergazomenos.kathestos_apasxolhshs || '0',
            f_eidikothta: ergazomenos.eidikothta_erganh || '000000',
            f_proslipsidate: formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs),
            f_apoxwrisidate: formatDateForErganh(apoxwrisiDate),
            f_apodoxes: formatCurrency(ergazomenos.pragmatikosMisthos || ergazomenos.synolo_symbashs || ergazomenos.apodoxes_apoxwrhshs || 0),
            f_comments: ergazomenos.parathrhseis || options.comments || '',

            f_file: e5PdfBase64,
            f_foreign_file: foreignPdfBase64,
            f_young_file: youngPdfBase64
        };

        const xml = buildE5NXML(xmlData);

        console.log('✅ [E5N-GENERATOR-v1] XML generated successfully');
        console.log('   XML length:', xml.length, 'bytes');
        console.log('   E5N PDF:', e5PdfBase64 ? 'YES' : 'NO');

        try {
            const { uploadBufferToS3 } = require('../s3Helper');

            const eponymoClean = upper(ergazomenos.eponymo).replace(/\s+/g, '_');
            const onomaClean = upper(ergazomenos.onoma).replace(/\s+/g, '_');
            const dateStr = formatDateForErganh(apoxwrisiDate).replace(/\//g, '-');
            const employeeId = String(ergazomenos._id || 'UNKNOWN');
            const filename = `${employeeId}_${eponymoClean}_${onomaClean}_${dateStr}.xml`;

            const companyNameClean = companyData?.eponymia
                ? companyData.eponymia.replace(/\s+/g, '_').substring(0, 50)
                : 'UNKNOWN';

            const s3Key = `xmls/${ergazomenos.team}/${companyData.kod}_${companyNameClean}/E5N/${filename}`;

            console.log('💾 [E5N-GENERATOR-v1] Saving XML to:', s3Key);

            const xmlBuffer = Buffer.from(xml, 'utf-8');
            const uploadResult = await uploadBufferToS3(xmlBuffer, s3Key, 'application/xml');

            return {
                success: true,
                xml: xml,
                s3Key: uploadResult.s3Key,
                s3Url: uploadResult.s3Url || uploadResult.localPath,
                relativePath: uploadResult.s3Key,
                filename: filename
            };
        } catch (saveError) {
            console.error('❌ [E5N-GENERATOR-v1] Failed to save XML:', saveError.message);
            return {
                success: true,
                xml: xml,
                s3Key: null,
                s3Url: null,
                filename: null,
                saveError: saveError.message
            };
        }
    } catch (error) {
        console.error('❌ [E5N-GENERATOR-v1] Error:', error.message);
        throw error;
    }
}

function formatDateForErganh(date) {
    if (!date) return '';
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [year, month, day] = date.split('-');
        return `${day}/${month}/${year}`;
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());
    return `${day}/${month}/${year}`;
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined || amount === '') return '0,00';
    const numeric = Number(String(amount).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(numeric)) return '0,00';
    const formatted = numeric.toFixed(2).replace('.', ',');
    return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function normalizeYphkoothta(val, fallback = '348') {
    const digits = String(val ?? '').replace(/\D/g, '');
    const base = digits.length ? digits : String(fallback).replace(/\D/g, '');
    return base.slice(-3).padStart(3, '0');
}

function getKad4(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits ? digits.slice(0, 4).padEnd(4, '0') : '';
}

function upper(value) {
    return String(value || '').toUpperCase();
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

function buildE5NXML(data) {
    const fields = [
        'f_aa_pararthmatos',
        'f_rel_protocol',
        'f_rel_date',
        'f_ypiresia_sepe',
        'f_ypiresia_oaed',
        'f_kad_pararthmatos',
        'f_kallikratis_pararthmatos',
        'f_eponymo',
        'f_onoma',
        'f_onoma_patros',
        'f_onoma_mitros',
        'f_birthdate',
        'f_sex',
        'f_yphkoothta',
        'f_typos_taytothtas',
        'f_ar_taytothtas',
        'f_ekdousa_arxh',
        'f_date_ekdosis',
        'f_date_ekdosis_lixi',
        'f_res_permit_inst',
        'f_res_permit_inst_type',
        'f_res_permit_inst_ar',
        'f_res_permit_inst_lixi',
        'f_res_permit_ap',
        'f_res_permit_ap_type',
        'f_res_permit_ap_ar',
        'f_res_permit_ap_lixi',
        'f_res_permit_visa',
        'f_res_permit_visa_ar',
        'f_res_permit_visa_from',
        'f_res_permit_visa_to',
        'f_marital_status',
        'f_arithmos_teknon',
        'f_afm',
        'f_doy',
        'f_amika',
        'f_amka',
        'f_code_anergias',
        'f_ar_vivliou_anilikou',
        'f_epipedo_morfosis',
        'f_xaraktirismos',
        'f_sxeshapasxolisis',
        'f_orismenou_apo',
        'f_orismenou_ews',
        'f_kathestosapasxolisis',
        'f_eidikothta',
        'f_proslipsidate',
        'f_apoxwrisidate',
        'f_apodoxes',
        'f_comments',
        'f_file',
        'f_foreign_file',
        'f_young_file'
    ];

    const body = fields
        .map((field) => `    <${field}>${escapeXml(data[field])}</${field}>`)
        .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<AnaggeliesE5N xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.yeka.gr/E5N">
  <AnaggeliaE5N xmlns="">
${body}
  </AnaggeliaE5N>
</AnaggeliesE5N>`;
}

module.exports = { generateE5NXML, buildE5NXML };
