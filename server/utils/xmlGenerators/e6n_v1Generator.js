// =========================================================================
// ✅ E6N XML/JSON GENERATOR V1 για ΕΡΓΑΝΗ II
//    WebE6NMP: Καταγγελία Σύμβασης με Προειδοποίηση
//    WebE6NXP: Καταγγελία Σύμβασης Χωρίς Προειδοποίηση
//    Βάσει E6NMP_v1.xsd / E6NXP_v1.xsd
// =========================================================================

'use strict';

const { formatCurrencyForErgani: formatCurrency } = require('../erganh/erganiFormatters');

const E6N_COMMON_FIELDS_BEFORE_TYPE_SPECIFIC = [
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
    'f_kathestosapasxolisis',
    'f_xaraktirismos',
    'f_eidikothta'
];

const E6N_COMMON_FIELDS_AFTER_TYPE_SPECIFIC = [
    'f_omadiki',
    'f_omadikiarithmos',
    'f_omadikidate',
    'f_proslipsidate',
    'f_apolysisdate',
    'f_apodoxes',
    'f_posoapozimiosis',
    'f_comments',
    'f_file',
    'f_foreign_file',
    'f_young_file'
];

const E6NMP_FIELDS = [
    ...E6N_COMMON_FIELDS_BEFORE_TYPE_SPECIFIC,
    'f_proidopoihshdate',
    'f_minesproidopoihsh',
    ...E6N_COMMON_FIELDS_AFTER_TYPE_SPECIFIC
];

const E6NXP_FIELDS = [
    ...E6N_COMMON_FIELDS_BEFORE_TYPE_SPECIFIC,
    'f_omadiki',
    'f_omadikiarithmos',
    'f_omadikidate',
    'f_proslipsidate',
    'f_apolysisdate',
    'f_apodoxes',
    'f_koinopoihshdate',
    'f_posoapozimiosis',
    'f_comments',
    'f_file',
    'f_foreign_file',
    'f_young_file'
];

const E6N_CONFIG = {
    MP: {
        submissionCode: 'WebE6NMP',
        xmlType: 'ma_221',
        productionId: 221,
        trialId: 109,
        root: 'AnaggeliesE6NMP',
        item: 'AnaggeliaE6NMP',
        namespace: 'http://www.yeka.gr/E6NMP',
        folder: 'E6NMP',
        label: 'Καταγγελία Σύμβασης με Προειδοποίηση',
        fields: E6NMP_FIELDS
    },
    XP: {
        submissionCode: 'WebE6NXP',
        xmlType: 'ma_220',
        productionId: 220,
        trialId: 107,
        root: 'AnaggeliesE6NXP',
        item: 'AnaggeliaE6NXP',
        namespace: 'http://www.yeka.gr/E6NXP',
        folder: 'E6NXP',
        label: 'Καταγγελία Σύμβασης Χωρίς Προειδοποίηση',
        fields: E6NXP_FIELDS
    }
};

function normalizeE6NType(value) {
    const raw = String(value || '')
        .trim()
        .toLowerCase();

    if (['mp', 'e6nmp', 'webe6nmp', 'ma_221', '221'].includes(raw)) return 'MP';
    if (['xp', 'e6nxp', 'webe6nxp', 'ma_220', '220'].includes(raw)) return 'XP';

    throw new Error(
        `[E6N-GENERATOR-v1] Μη έγκυρος τύπος E6N: ${value || '(κενό)'}. Επιτρεπτά: WebE6NMP / WebE6NXP.`
    );
}

function resolveE6NApolysisDate(ergazomenos, options = {}) {
    return (
        options.f_apolysisdate ||
        options.apolysisdate ||
        options.hmeromhnia_apolysis ||
        options.hmeromhnia_apolyshs ||
        options.hmeromhnia_apoxorhshs ||
        options.hmeromhnia_apoxwrhshs ||
        options.apoxwrisi_date ||
        ergazomenos.f_apolysisdate ||
        ergazomenos.apolysisdate ||
        ergazomenos.hmeromhnia_apolysis ||
        ergazomenos.hmeromhnia_apolyshs ||
        ergazomenos.hmeromhnia_apoxorhshs ||
        ergazomenos.hmeromhnia_apoxwrhshs ||
        ergazomenos.hmeromhnia_lhxhs_symbashs ||
        ''
    );
}

function resolveE6NProidopoihshDate(ergazomenos, options = {}, apolysisDate = '') {
    // WebE6NMP: το f_proidopoihshdate πρέπει να ενημερώνεται από
    // ErgazomenoiModel.hmeromhnia_koinopoihshs_kataggelias.
    // Κρατάμε τα παλαιότερα aliases μόνο ως fallback για συμβατότητα.
    return (
        ergazomenos.hmeromhnia_koinopoihshs_kataggelias ||
        ergazomenos.f_proidopoihshdate ||
        ergazomenos.proidopoihshdate ||
        ergazomenos.hmeromhnia_proidopoihshs ||
        ergazomenos.hmeromhnia_proeidopoihshs ||
        ergazomenos.hmeromhnia_eggrafhs_proeidopoihshs ||
        options.hmeromhnia_koinopoihshs_kataggelias ||
        options.f_proidopoihshdate ||
        options.proidopoihshdate ||
        options.hmeromhnia_proidopoihshs ||
        options.hmeromhnia_proeidopoihshs ||
        apolysisDate ||
        ''
    );
}

function resolveE6NKoinopoihshDate(ergazomenos, options = {}, apolysisDate = '') {
    return (
        options.f_koinopoihshdate ||
        options.koinopoihshdate ||
        options.hmeromhnia_koinopoihshs ||
        options.hmeromhnia_koinopoihshs_kataggelias ||
        ergazomenos.f_koinopoihshdate ||
        ergazomenos.koinopoihshdate ||
        ergazomenos.hmeromhnia_koinopoihshs ||
        ergazomenos.hmeromhnia_koinopoihshs_kataggelias ||
        apolysisDate ||
        ''
    );
}

function resolveE6NMinesProidopoihshs(ergazomenos, options = {}) {
    // WebE6NMP: το f_minesproidopoihsh πρέπει να ενημερώνεται από
    // ErgazomenoiModel.mhnes_proeidopoihshs.
    // Κρατάμε τα παλαιότερα aliases μόνο ως fallback για συμβατότητα.
    const raw =
        ergazomenos.mhnes_proeidopoihshs ||
        ergazomenos.f_minesproidopoihsh ||
        ergazomenos.minesproidopoihsh ||
        ergazomenos.mines_proidopoihshs ||
        ergazomenos.mines_proeidopoihshs ||
        options.mhnes_proeidopoihshs ||
        options.f_minesproidopoihsh ||
        options.minesproidopoihsh ||
        options.mines_proidopoihshs ||
        options.mines_proeidopoihshs ||
        '1';

    const n = Number(String(raw).replace(/[^0-9]/g, ''));
    if ([1, 2, 3, 4].includes(n)) return String(n);
    return '1';
}

function validateE6NRequiredFields(e6nType, ergazomenos, options = {}) {
    const requiredFields = [
        { field: 'eponymo', label: 'Επώνυμο' },
        { field: 'onoma', label: 'Όνομα' },
        { field: 'patronymo', label: 'Πατρώνυμο' },
        { field: 'mhtronymo', label: 'Μητρώνυμο' },
        { field: 'hmeromhnia_gennhshs', label: 'Ημ/νία Γέννησης' },
        { field: 'afm', label: 'ΑΦΜ' },
        { field: 'adt', label: 'Αριθμός Νομιμοποιητικού εγγράφου' },
        { field: 'hmeromhnia_proslhpshs', label: 'Ημ/νία Πρόσληψης' }
    ];

    const apolysisDate = resolveE6NApolysisDate(ergazomenos, options);
    if (!apolysisDate) {
        throw new Error('[E6N-GENERATOR-v1] Λείπει υποχρεωτικό πεδίο: Ημ/νία Απόλυσης');
    }

    if (e6nType === 'MP' && !resolveE6NProidopoihshDate(ergazomenos, options, apolysisDate)) {
        throw new Error(
            '[E6N-GENERATOR-v1] Λείπει υποχρεωτικό πεδίο: Ημ/νία Προειδοποίησης/Κοινοποίησης'
        );
    }

    if (e6nType === 'XP' && !resolveE6NKoinopoihshDate(ergazomenos, options, apolysisDate)) {
        throw new Error(
            '[E6N-GENERATOR-v1] Λείπει υποχρεωτικό πεδίο: Ημ/νία Κοινοποίησης Καταγγελίας'
        );
    }

    const missingFields = requiredFields
        .filter(({ field }) => !ergazomenos[field])
        .map(({ label }) => label);

    if (missingFields.length > 0) {
        throw new Error(
            `[E6N-GENERATOR-v1] Λείπουν υποχρεωτικά πεδία: ${missingFields.join(', ')}`
        );
    }

    return { apolysisDate };
}

async function loadE6NAttachmentsBase64(e6nType, ergazomenos, options = {}) {
    let e6PdfBase64 = normalizeBase64PdfInput(
        options.e6_pdf_base64 ||
            options.e6n_pdf_base64 ||
            options.e6PdfBase64 ||
            options.e6nPdfBase64 ||
            options.f_file ||
            ergazomenos.e6_pdf_base64 ||
            ergazomenos.e6n_pdf_base64 ||
            ergazomenos.f_file
    );

    let foreignPdfBase64 = normalizeBase64PdfInput(
        options.foreign_pdf_base64 || ergazomenos.foreign_pdf_base64 || ''
    );
    let youngPdfBase64 = normalizeBase64PdfInput(
        options.young_pdf_base64 || ergazomenos.young_pdf_base64 || ''
    );

    const pdfPath =
        options.e6_pdf_path ||
        options.e6n_pdf_path ||
        ergazomenos.e6_pdf_path ||
        ergazomenos.e6n_pdf_path ||
        ergazomenos.arxeio_entypou_e6_path ||
        ergazomenos.arxeio_kataggelias_symbashs_path ||
        ergazomenos.arxeio_apolyshs_path;

    if (!e6PdfBase64 && pdfPath) {
        try {
            console.log('[E6N-GENERATOR-v1] pdfPath:', pdfPath);
            console.log('📥 [E6N-GENERATOR-v1] Downloading E6N PDF from S3...');
            const { downloadFileFromS3 } = require('../s3Helper');
            const pdfBuffer = await downloadFileFromS3(pdfPath);
            e6PdfBase64 = pdfBuffer.toString('base64');
            console.log(`✅ [E6N-GENERATOR-v1] E6N PDF: ${e6PdfBase64.length} chars`);
        } catch (pdfError) {
            console.error('❌ [E6N-GENERATOR-v1] Failed to download E6N PDF:', pdfError.message);
        }
    }

    if (!foreignPdfBase64 && ergazomenos.arxeio_nomimopoihtikon_eggrafon_path) {
        try {
            const { downloadFileFromS3 } = require('../s3Helper');
            const pdfBuffer = await downloadFileFromS3(
                ergazomenos.arxeio_nomimopoihtikon_eggrafon_path
            );
            foreignPdfBase64 = pdfBuffer.toString('base64');
        } catch (pdfError) {
            console.error(
                '❌ [E6N-GENERATOR-v1] Failed to download foreign docs PDF:',
                pdfError.message
            );
        }
    }

    if (!youngPdfBase64 && ergazomenos.bibliario_anhlikoy_path) {
        try {
            const { downloadFileFromS3 } = require('../s3Helper');
            const pdfBuffer = await downloadFileFromS3(ergazomenos.bibliario_anhlikoy_path);
            youngPdfBase64 = pdfBuffer.toString('base64');
        } catch (pdfError) {
            console.error(
                '❌ [E6N-GENERATOR-v1] Failed to download young docs PDF:',
                pdfError.message
            );
        }
    }

    if (!e6PdfBase64 && options.allowFallbackPdf !== false) {
        e6PdfBase64 = await buildFallbackE6NPdfBase64(e6nType, ergazomenos, options);
    }

    return {
        e6PdfBase64,
        foreignPdfBase64: foreignPdfBase64 || 'AA==',
        youngPdfBase64: youngPdfBase64 || 'AA=='
    };
}

async function buildE6NData(
    e6nTypeInput,
    ergazomenos,
    companyData,
    ypokatasthmataData,
    options = {}
) {
    const e6nType = normalizeE6NType(e6nTypeInput);
    const { apolysisDate } = validateE6NRequiredFields(e6nType, ergazomenos, options);
    const { e6PdfBase64, foreignPdfBase64, youngPdfBase64 } = await loadE6NAttachmentsBase64(
        e6nType,
        ergazomenos,
        options
    );

    const requireMainPdf = options.requireMainPdf === true;
    if (requireMainPdf && (!e6PdfBase64 || e6PdfBase64.trim() === '')) {
        throw new Error('[E6N-GENERATOR-v1] Λείπει το υποχρεωτικό PDF Εντύπου E6N (f_file).');
    }

    const data = {
        f_aa_pararthmatos: String(ypokatasthmataData?.kodikos || '0'),
        f_rel_protocol: options.f_rel_protocol || ergazomenos.f_rel_protocol || '',
        f_rel_date: formatDateForErganh(options.f_rel_date || ergazomenos.f_rel_date),
        f_ypiresia_sepe: normalizeFixedDigits(ypokatasthmataData?.sepe_ergoy, 5, '00000'),
        f_ypiresia_oaed: normalizeFixedDigits(ypokatasthmataData?.dypa_ergoy, 6, '000000'),
        f_kad_pararthmatos:
            getKad4(
                ypokatasthmataData?.kad6 ||
                    ypokatasthmataData?.kad ||
                    companyData?.kad6 ||
                    companyData?.kad
            ) || '0000',
        f_kallikratis_pararthmatos: normalizeFixedDigits(
            ypokatasthmataData?.kallikratis || ypokatasthmataData?.polh,
            8,
            '00000000'
        ),

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
        f_date_ekdosis_lixi: formatDateForErganh(
            ergazomenos.hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy
        ),

        f_res_permit_inst: ergazomenos.adeia_diamonhs_me_amesh_prosbash_gia_ergasia ? '1' : '0',
        f_res_permit_inst_type:
            ergazomenos.eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia || '',
        f_res_permit_inst_ar:
            ergazomenos.arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia || '',
        f_res_permit_inst_lixi: formatDateForErganh(
            ergazomenos.hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia
        ),
        f_res_permit_ap: ergazomenos.adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia ? '1' : '0',
        f_res_permit_ap_type:
            ergazomenos.eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia || '',
        f_res_permit_ap_ar:
            ergazomenos.arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia || '',
        f_res_permit_ap_lixi: formatDateForErganh(
            ergazomenos.hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia
        ),
        f_res_permit_visa: ergazomenos.adeia_eisodoy_gia_epoxikh_apasxolhsh ? '1' : '0',
        f_res_permit_visa_ar: ergazomenos.arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh || '',
        f_res_permit_visa_from: formatDateForErganh(
            ergazomenos.apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh
        ),
        f_res_permit_visa_to: formatDateForErganh(
            ergazomenos.eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh
        ),

        f_marital_status: ergazomenos.oikogeneiakh_katastash || '0',
        f_arithmos_teknon: String(ergazomenos.arithmos_teknon || 0),
        f_afm: ergazomenos.afm,
        f_doy: normalizeOptionalDoy(ergazomenos.doy),
        f_amika: ergazomenos.ama_krathshs_01 || ergazomenos.amika || '',
        f_amka: ergazomenos.amka || '',
        f_code_anergias: ergazomenos.arithmos_deltioy_anergias || '',
        f_ar_vivliou_anilikou: ergazomenos.arithmos_bibliarioy_anhlikoy || '',
        f_epipedo_morfosis: ergazomenos.ekpaideytiko_epipedo || '1',

        f_kathestosapasxolisis: ergazomenos.kathestos_apasxolhshs || '0',
        f_xaraktirismos: ergazomenos.xarakthrismos_ergazomenon ? '1' : '0',
        f_eidikothta: ergazomenos.eidikothta_erganh || '000000',

        f_omadiki: boolToErgani(
            options.f_omadiki ?? options.omadiki ?? ergazomenos.omadiki_apolysh
        ),
        f_omadikiarithmos:
            options.f_omadikiarithmos ||
            options.omadikiarithmos ||
            ergazomenos.omadikiarithmos ||
            '',
        f_omadikidate: formatDateForErganh(
            options.f_omadikidate || options.omadikidate || ergazomenos.omadikidate
        ),
        f_proslipsidate: formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs),
        f_apolysisdate: formatDateForErganh(apolysisDate),
        f_apodoxes: formatCurrency(
            options.f_apodoxes ||
                options.apodoxes ||
                ergazomenos.pragmatikosMisthos ||
                ergazomenos.synolo_symbashs_basei_oron_ergasias ||
                ergazomenos.synolo_symbashs ||
                ergazomenos.apodoxes_apolyshs ||
                0
        ),
        f_posoapozimiosis: formatCurrency(
            options.f_posoapozimiosis ||
                options.posoapozimiosis ||
                options.poso_apozimiosis ||
                ergazomenos.posoapozimiosis ||
                ergazomenos.poso_apozimiosis ||
                0
        ),
        f_comments: (
            options.f_comments ||
            options.comments ||
            ergazomenos.parathrhseis_peratosis ||
            ''
        ).slice(0, 100),
        f_file: e6PdfBase64,
        f_foreign_file: foreignPdfBase64,
        f_young_file: youngPdfBase64
    };

    if (e6nType === 'MP') {
        data.f_proidopoihshdate = formatDateForErganh(
            resolveE6NProidopoihshDate(ergazomenos, options, apolysisDate)
        );
        data.f_minesproidopoihsh = resolveE6NMinesProidopoihshs(ergazomenos, options);
    } else {
        data.f_koinopoihshdate = formatDateForErganh(
            resolveE6NKoinopoihshDate(ergazomenos, options, apolysisDate)
        );
    }

    return data;
}

function buildE6NJSON(e6nTypeInput, data) {
    const e6nType = normalizeE6NType(e6nTypeInput);
    const config = E6N_CONFIG[e6nType];
    return {
        [config.root]: {
            [config.item]: [pickFields(data, config.fields)]
        }
    };
}

async function generateE6NXML(
    e6nTypeInput,
    ergazomenos,
    companyData,
    ypokatasthmataData,
    options = {}
) {
    const e6nType = normalizeE6NType(e6nTypeInput);
    const config = E6N_CONFIG[e6nType];
    const data = await buildE6NData(e6nType, ergazomenos, companyData, ypokatasthmataData, options);
    const xml = buildE6NXML(e6nType, data);

    console.log(`✅ [E6N-GENERATOR-v1] XML generated successfully for ${config.submissionCode}`);
    console.log('   XML length:', xml.length, 'bytes');
    console.log('   E6N PDF:', data.f_file ? 'YES' : 'NO');

    try {
        const { uploadBufferToS3 } = require('../s3Helper');
        const eponymoClean = upper(ergazomenos.eponymo).replace(/\s+/g, '_');
        const onomaClean = upper(ergazomenos.onoma).replace(/\s+/g, '_');
        const dateStr = data.f_apolysisdate.replace(/\//g, '-');
        const employeeId = String(ergazomenos._id || 'UNKNOWN');
        const filename = `${employeeId}_${eponymoClean}_${onomaClean}_${dateStr}_${config.folder}.xml`;

        const companyNameClean = companyData?.eponymia
            ? companyData.eponymia.replace(/\s+/g, '_').substring(0, 50)
            : 'UNKNOWN';

        const s3Key = `xmls/${ergazomenos.team}/${companyData.kod}_${companyNameClean}/${config.folder}/${filename}`;
        const xmlBuffer = Buffer.from(xml, 'utf-8');
        const uploadResult = await uploadBufferToS3(xmlBuffer, s3Key, 'application/xml');

        return {
            success: true,
            xml,
            s3Key: uploadResult.s3Key,
            s3Url: uploadResult.s3Url || uploadResult.localPath,
            relativePath: uploadResult.s3Key,
            filename,
            submissionCode: config.submissionCode,
            xmlType: config.xmlType
        };
    } catch (saveError) {
        console.error('❌ [E6N-GENERATOR-v1] Failed to save XML:', saveError.message);
        return {
            success: true,
            xml,
            s3Key: null,
            s3Url: null,
            filename: `${String(ergazomenos._id || ergazomenos.kodikos || config.folder)}_${config.folder}.xml`,
            submissionCode: config.submissionCode,
            xmlType: config.xmlType,
            saveError: saveError.message
        };
    }
}

async function generateE6NJSON(
    e6nTypeInput,
    ergazomenos,
    companyData,
    ypokatasthmataData,
    options = {}
) {
    const e6nType = normalizeE6NType(e6nTypeInput);
    const config = E6N_CONFIG[e6nType];
    const data = await buildE6NData(e6nType, ergazomenos, companyData, ypokatasthmataData, {
        ...options,
        requireMainPdf: true
    });
    const json = buildE6NJSON(e6nType, data);

    console.log(`✅ [E6N-GENERATOR-v1] JSON generated successfully for ${config.submissionCode}`);
    console.log('   Root:', Object.keys(json).join(', '));
    console.log('   E6N PDF:', data.f_file ? 'YES' : 'NO');

    return {
        success: true,
        json,
        payload: json,
        data,
        submissionCode: config.submissionCode,
        xmlType: config.xmlType
    };
}

function buildE6NXML(e6nTypeInput, data) {
    const e6nType = normalizeE6NType(e6nTypeInput);
    const config = E6N_CONFIG[e6nType];
    const cleanData = pickFields(data, config.fields);

    const body = config.fields
        .map((field) => `    <${field}>${escapeXml(cleanData[field])}</${field}>`)
        .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<${config.root} xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="${config.namespace}">
  <${config.item} xmlns="">
${body}
  </${config.item}>
</${config.root}>`;
}

function pickFields(data, fields) {
    return fields.reduce((acc, field) => {
        acc[field] = data[field] ?? '';
        return acc;
    }, {});
}

async function buildFallbackE6NPdfBase64(e6nTypeInput, ergazomenos, options = {}) {
    try {
        const PDFDocument = require('pdfkit');
        const e6nType = normalizeE6NType(e6nTypeInput);
        const config = E6N_CONFIG[e6nType];
        const chunks = [];

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.on('data', (chunk) => chunks.push(chunk));

        const done = new Promise((resolve, reject) => {
            doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
            doc.on('error', reject);
        });

        doc.fontSize(16).text(`ERGANI ${config.submissionCode}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(11).text('Generated attachment for REST submission.');
        doc.moveDown();
        doc.text(`Employee code: ${safeAscii(ergazomenos.kodikos || '')}`);
        doc.text(`AFM: ${safeAscii(ergazomenos.afm || '')}`);
        doc.text(`Last name: ${safeAscii(ergazomenos.eponymo || '')}`);
        doc.text(`First name: ${safeAscii(ergazomenos.onoma || '')}`);
        doc.text(
            `Termination date: ${formatDateForErganh(resolveE6NApolysisDate(ergazomenos, options))}`
        );
        doc.moveDown();
        doc.fontSize(9).text(
            'Note: Replace this fallback PDF with the official company-signed termination PDF when available.'
        );
        doc.end();

        return await done;
    } catch (error) {
        console.error('[E6N-GENERATOR-v1] Fallback PDF generation failed:', error.message);
        return '';
    }
}

function formatDateForErganh(date) {
    if (!date) return '';
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [year, month, day] = date.split('-');
        return `${day}/${month}/${year}`;
    }
    if (typeof date === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date.trim())) {
        return date.trim();
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());
    return `${day}/${month}/${year}`;
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

function normalizeFixedDigits(value, length, fallback) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return fallback;
    return digits.slice(0, length).padStart(length, '0');
}

function normalizeOptionalDoy(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length === 4 ? digits : '';
}

function normalizeBase64PdfInput(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    const dataUrlMatch = raw.match(/^data:application\/pdf;base64,(.+)$/i);
    if (dataUrlMatch) return dataUrlMatch[1].trim();
    return raw;
}

function boolToErgani(value) {
    if (value === true || value === 1 || value === '1' || value === 'true' || value === 'on') {
        return '1';
    }
    return '0';
}

function upper(value) {
    return String(value || '').toUpperCase();
}

function safeAscii(value) {
    return String(value || '').replace(/[^\x20-\x7E]/g, '?');
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

async function generateE6NMPXML(ergazomenos, companyData, ypokatasthmataData, options = {}) {
    return generateE6NXML('MP', ergazomenos, companyData, ypokatasthmataData, options);
}

async function generateE6NXPXML(ergazomenos, companyData, ypokatasthmataData, options = {}) {
    return generateE6NXML('XP', ergazomenos, companyData, ypokatasthmataData, options);
}

async function generateE6NMPJSON(ergazomenos, companyData, ypokatasthmataData, options = {}) {
    return generateE6NJSON('MP', ergazomenos, companyData, ypokatasthmataData, options);
}

async function generateE6NXPJSON(ergazomenos, companyData, ypokatasthmataData, options = {}) {
    return generateE6NJSON('XP', ergazomenos, companyData, ypokatasthmataData, options);
}

module.exports = {
    E6N_CONFIG,
    E6NMP_FIELDS,
    E6NXP_FIELDS,
    normalizeE6NType,
    buildE6NData,
    buildE6NXML,
    buildE6NJSON,
    generateE6NXML,
    generateE6NJSON,
    generateE6NMPXML,
    generateE6NXPXML,
    generateE6NMPJSON,
    generateE6NXPJSON,
    formatDateForErganh
};
