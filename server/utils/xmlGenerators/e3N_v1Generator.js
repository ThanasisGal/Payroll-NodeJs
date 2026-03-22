// =========================================================================
// ✅ E3 XML GENERATOR για ΕΡΓΑΝΗ II - FIXED VERSION
// =========================================================================

/**
 * ✅ Generate E3N XML για ΕΡΓΑΝΗ II
 * @param {Object} ergazomenos - Mongoose Employee Document
 * @param {Object} companyData - Company info
 * @param {Object} ypokatasthmataData - Branch data
 * @returns {Promise<Object>} XML result object
 */
async function generateE3XML(ergazomenos, companyData, ypokatasthmataData) {
    try {
        console.log('🔧 [E3-GENERATOR] Starting XML generation...');
        console.log('   Employee AFM:', ergazomenos.afm);
        console.log('   Company:', companyData?.eponymia || 'N/A');

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
            { field: 'hmeromhnia_proslhpshs', label: 'Ημ/νία Πρόσληψης' },
            { field: 'xronos_katabolhs_apodoxon', label: 'Χρόνος Καταβολής Αποδοχών' },
            { field: 'adt', label: 'Τύπος Νομιμοποιητικού εγγράφου' }
        ];

        const missingFields = requiredFields
            .filter(({ field }) => !ergazomenos[field])
            .map(({ label }) => label);

        if (missingFields.length > 0) {
            throw new Error(`Λείπουν υποχρεωτικά πεδία: ${missingFields.join(', ')}`);
        }

        // =====================================================================
        // ✅ PARSE EPIKOURIKI ASFALISH (from database field)
        // =====================================================================

        let epikourikiSelections = [];

        try {
            const epikourikiData = ergazomenos.foreas_epikoyrikhs_asfalishs;

            if (epikourikiData) {
                let parsed;

                if (typeof epikourikiData === 'string' && epikourikiData.trim() !== '') {
                    parsed = JSON.parse(epikourikiData);
                } else if (Array.isArray(epikourikiData)) {
                    parsed = epikourikiData;
                }

                if (Array.isArray(parsed)) {
                    epikourikiSelections = parsed
                        .filter((item) => item)
                        .map((item) => {
                            const kodikos =
                                typeof item === 'object' ? item.kodikos || item.value : item;
                            return {
                                kodikos: String(kodikos).padStart(3, '0')
                            };
                        });

                    console.log(
                        `✅ [E3-GENERATOR] Found ${epikourikiSelections.length} epikouriki selections`
                    );
                }
            }
        } catch (parseError) {
            console.error('❌ [E3-GENERATOR] Failed to parse epikouriki JSON:', parseError.message);
            epikourikiSelections = [];
        }

        // =====================================================================
        // ✅ DOWNLOAD CONTRACT PDF FROM S3 & CONVERT TO BASE64
        // =====================================================================

        let contractPdfBase64 = '';
        let foreignPdfBase64 = '';
        let youngPdfBase64 = '';

        // ΑΡΧΕΙΟ ΣΥΜΒΑΣΗΣ ΕΡΓΑΣΙΑΣ
        if (ergazomenos.oysiodeis_oroi === '0') {
            if (ergazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path) {
                try {
                    console.log('📥 [E3-GENERATOR] Downloading contract PDF from S3...');

                    const { downloadFileFromS3 } = require('../s3Helper');
                    const pdfBuffer = await downloadFileFromS3(
                        ergazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path
                    );

                    contractPdfBase64 = pdfBuffer.toString('base64');

                    console.log(`✅ [E3-GENERATOR] Contract PDF converted to base64`);
                    console.log(
                        `   Size: ${pdfBuffer.length} bytes → ${contractPdfBase64.length} chars`
                    );
                } catch (pdfError) {
                    console.error(
                        '❌ [E3-GENERATOR] Failed to download contract PDF:',
                        pdfError.message
                    );
                }
            }
        }

        // ΑΡΧΕΙΟ ΝΟΜΙΜΟΠΟΙΗΤΙΚΩΝ ΕΓΓΡΑΦΩΝ
        if (ergazomenos.arxeio_nomimopoihtikon_eggrafon_path) {
            try {
                const { downloadFileFromS3 } = require('../s3Helper');
                const pdfBuffer = await downloadFileFromS3(
                    ergazomenos.arxeio_nomimopoihtikon_eggrafon_path
                );
                foreignPdfBase64 = pdfBuffer.toString('base64');
                console.log(`✅ [E3-GENERATOR] Foreign docs PDF: ${foreignPdfBase64.length} chars`);
            } catch (pdfError) {
                console.error(
                    '❌ [E3-GENERATOR] Failed to download foreign docs PDF:',
                    pdfError.message
                );
            }
        }

        // ΑΡΧΕΙΟ ΕΓΓΡΑΦΩΝ ΑΝΗΛΙΚΩΝ
        if (ergazomenos.bibliario_anhlikoy_path) {
            try {
                const { downloadFileFromS3 } = require('../s3Helper');
                const pdfBuffer = await downloadFileFromS3(ergazomenos.bibliario_anhlikoy_path);
                youngPdfBase64 = pdfBuffer.toString('base64');
                console.log(
                    `✅ [E3-GENERATOR] Young worker docs PDF: ${youngPdfBase64.length} chars`
                );
            } catch (pdfError) {
                console.error(
                    '❌ [E3-GENERATOR] Failed to download young docs PDF:',
                    pdfError.message
                );
            }
        }

        // =====================================================================
        // ✅ FIELD MAPPING
        // =====================================================================

        const xmlData = {
            // COMPANY DATA
            f_aa_pararthmatos: ypokatasthmataData?.kodikos || '00000',
            f_rel_protocol: '',
            f_rel_date: '',
            f_ypiresia_sepe: ypokatasthmataData?.sepe_ergoy || '00000',
            f_ypiresia_oaed: ypokatasthmataData?.dypa_ergoy || '000000',
            f_kad_pararthmatos: companyData?.kad6
                ? companyData.kad6.split('.').slice(0, 2).join('')
                : '0000',
            f_kallikratis_pararthmatos: ypokatasthmataData?.polh || '00000000',

            // PERSONAL DATA
            f_eponymo: ergazomenos.eponymo.toUpperCase(),
            f_onoma: ergazomenos.onoma.toUpperCase(),
            f_onoma_patros: ergazomenos.patronymo.toUpperCase(),
            f_onoma_mitros: ergazomenos.mhtronymo.toUpperCase(),
            f_birthdate: formatDateForErganh(ergazomenos.hmeromhnia_gennhshs),
            f_sex: ergazomenos.fylo ? '1' : '0',
            f_yphkoothta: normalizeYphkoothta(ergazomenos.yphkoothta, '348'),
            f_typos_taytothtas: ergazomenos.typos_taytothtas || 'ΔΑΤ',
            f_ar_taytothtas: ergazomenos.adt || 'Α00000000',
            f_ekdousa_arxh: ergazomenos.arxh_ekdoshs || '',
            f_date_ekdosis: formatDateForErganh(ergazomenos.hmeromhnia_ekdoshs),
            f_date_ekdosis_lixi: formatDateForErganh(
                ergazomenos.hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy
            ),

            // RESIDENCE PERMITS
            f_res_permit_inst: ergazomenos.adeia_diamonhs_me_amesh_prosbash_gia_ergasia ? '1' : '0',
            f_res_permit_inst_type:
                ergazomenos.eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia || '',
            f_res_permit_inst_ar:
                ergazomenos.arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia || '',
            f_res_permit_inst_lixi: formatDateForErganh(
                ergazomenos.hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia
            ),

            f_res_permit_ap: ergazomenos.adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia
                ? '1'
                : '0',
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

            // FAMILY STATUS
            f_marital_status: ergazomenos.oikogeneiakh_katastash || '0',
            f_arithmos_teknon: String(ergazomenos.arithmos_teknon || 0).padStart(2, '0'),

            // TAX & INSURANCE
            f_afm: ergazomenos.afm,
            f_doy: ergazomenos.doy || '',
            f_amika: ergazomenos.ama_krathshs_01 || '',
            f_amka: ergazomenos.amka || '',
            f_code_anergias: ergazomenos.arithmos_deltioy_anergias || '',
            f_ar_vivliou_anilikou: ergazomenos.arithmos_bibliarioy_anhlikoy || '',
            f_epipedo_morfosis: ergazomenos.ekpaideytiko_epipedo || '1',

            // EMPLOYMENT DATA
            f_proslipsidate: formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs),
            f_proslipsitime: ergazomenos.ora_enarxhs_proths_foras || '08:00',
            f_apoxwrisitime: ergazomenos.ora_apoxorhshs_proths_foras || '16:00',
            f_week_hours: formatWeekHours(ergazomenos.symbatikes_ores_ergasias),
            f_eidikothta: ergazomenos.eidikothta_erganh || '000000',
            f_eidikothta_anal: ergazomenos.antikeimeno_ergasion || '',
            f_proipiresia: String(ergazomenos.proyphresia_se_eth || 0),

            // SALARY DATA
            f_apodoxes: formatCurrency(
                ergazomenos.pragmatikosMisthos || ergazomenos.synolo_symbashs || 0
            ),
            f_hour_apodoxes: formatCurrency(ergazomenos.pragmatikoOromisthio || 0),

            // CONTRACT TYPE
            f_sxeshapasxolisis: ergazomenos.sxesh_ergasias || '0',
            f_orismenou_apo:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs)
                    : '',
            f_orismenou_ews:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDateForErganh(ergazomenos.hmeromhnia_lhxhs_symbashs)
                    : '',

            // EMPLOYMENT STATUS
            f_kathestosapasxolisis: ergazomenos.kathestos_apasxolhshs || '0',
            f_xaraktirismos: ergazomenos.xarakthrismos_ergazomenon ? '1' : '0',
            f_special_case: ergazomenos.eidikh_periptosh || '',
            f_responsible_position: ergazomenos.thesh_eythynhs || '1',

            // WORKING TIME ORGANIZATION
            f_working_time_digital_organization: ergazomenos.pshfiakh_organosh ? '1' : '0',
            f_full_employment_hours: formatWeekHours(ergazomenos.symbatikes_ores_ergasias || 40),
            f_week_days: (() => {
                const days = parseInt(ergazomenos.apasxolhsh_basei_symbashs);

                // ✅ Validate: Must be 5 or 6
                if (days === 6) {
                    return '6'; // ΕΞΑΗΜΕΡΟ
                } else if (days === 5 || !days || days < 5) {
                    return '5'; // ΠΕΝΘΗΜΕΡΟ
                } else {
                    return '5';
                }
            })(),
            f_euelikto_wrario_minutes: String(ergazomenos.evelikth_proselefsh || 0),
            f_working_card: ergazomenos.karta_ergasias ? '1' : '0',
            f_dialeimma_minutes: String(ergazomenos.dialleima_se_lepta || 30),
            f_dialeimma_entos_wrariou: ergazomenos.dialleima_entos_ektos_orarioy ? '1' : '0',

            // ΔΥΠΑ PROGRAMS
            f_topothetisioaed: ergazomenos.topothethsh_me_programma ? '1' : '0',
            f_programaoaed: ergazomenos.programma_dypa || '',
            f_replaceprograma: ergazomenos.antikatastash_ergazomenoy ? '1' : '0',
            f_replaceprograma_afm: ergazomenos.afm_antikatastath || '',
            f_replaceprograma_amka: ergazomenos.amka_antikatastath || '',

            // TRIAL PERIOD
            f_trial_period: ergazomenos.afora_dokimastikh_periodo ? '1' : '0',
            f_trial_date_to: formatDateForErganh(ergazomenos.hmnia_lhxhs_dokimastikhs_periodoy),

            // ACCEPTANCE OF TERMS
            // f_basics_acceptance: ergazomenos.arxeio_apodoxhs_oysiodon_oron_path ? '0' : '1',
            f_basics_acceptance: ergazomenos.oysiodeis_oroi,
            f_file: '',
            f_file_symbash: contractPdfBase64,
            f_comments: ergazomenos.parathrhseis || '',
            f_foreign_file: foreignPdfBase64,
            f_young_file: youngPdfBase64,

            // ADDITIONAL FIELDS
            f_xronos_katavolis_apodoxon:
                ergazomenos.xronos_katabolhs_apodoxon ||
                'ΕΝΤΟΣ 20ΗΜΕΡΟΥ ΑΠΟ ΤΟ ΤΕΛΟΣ ΚΑΘΕ ΜΙΣΘΟΛΟΓΙΚΗΣ ΠΕΡΙΟΔΟΥ',
            f_ipoxreotiki_katartisi: ergazomenos.ypoxreotikh_ek_toy_nomoy_katartish ? '1' : '0',
            f_efarmoste_sillogiki_simbasi: ergazomenos.efarmostea_sse ? '1' : '0',
            f_efarmoste_sillogiki_simbasi_comments: ergazomenos.efarmostea_sse_parathrhseis || '',

            // INSURANCE
            f_kyria_asfalisi: ergazomenos.foreas_kyrias_asfalishs,
            epikourikiSelections: epikourikiSelections,
            f_prosthetes_asfalistikes: ergazomenos.prosthetes_asfalistikes_apodoxes || '',

            // NON-PREDICTABLE SCHEDULE
            f_mh_provlepsimo_programma: ergazomenos.mh_problepsimo_programma ? '1' : '0',
            f_paraggelia_hmeres_hours: ergazomenos.hmeres_ores_anaforas || '',
            f_paraggelia_min_notification: ergazomenos.eidopoihsh_prin_thn_anathesh || '',
            f_paraggelia_notes: ergazomenos.prothesmia_akyroshs_ths_anatheshs || '',

            // WORKPLACE
            f_topos_ergasias: ergazomenos.topos_ergasias ? '1' : '0',
            f_topos_ergasias_comment: ergazomenos.topos_ergasias
                ? ergazomenos.topos_ergasias_parathrhseis
                : ''
        };

        // =====================================================================
        // ✅ BUILD XML
        // =====================================================================

        const xml = buildE3XML(xmlData);

        console.log('✅ [E3-GENERATOR] XML generated successfully');
        console.log('   XML length:', xml.length, 'bytes');
        console.log('   Contract PDF:', contractPdfBase64 ? 'YES' : 'NO');
        console.log('   Foreign docs:', foreignPdfBase64 ? 'YES' : 'NO');
        console.log('   Young docs:', youngPdfBase64 ? 'YES' : 'NO');
        console.log('   Epikouriki:', epikourikiSelections.length);

        // =====================================================================
        // ✅ SAVE XML TO S3
        // =====================================================================

        try {
            const { uploadBufferToS3 } = require('../s3Helper');

            // ✅ Get employee details
            const eponymoClean = ergazomenos.eponymo.toUpperCase().replace(/\s+/g, '_');
            const onomaClean = ergazomenos.onoma.toUpperCase().replace(/\s+/g, '_');
            const dateStr = formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs).replace(
                /\//g,
                '-'
            );

            // ✅ Get employee ID (MongoDB _id)
            const employeeId = String(ergazomenos._id || 'UNKNOWN');

            // ✅ New filename format: id_EPONYMO_ONOMA_DATE.xml
            const filename = `${employeeId}_${eponymoClean}_${onomaClean}_${dateStr}.xml`;

            const companyNameClean = companyData?.eponymia
                ? companyData.eponymia.replace(/\s+/g, '_').substring(0, 50)
                : 'UNKNOWN';

            // ✅ New path with E3N subfolder
            const s3Key = `xmls/${ergazomenos.team}/${companyData.kod}_${companyNameClean}/E3N/${filename}`;

            console.log('💾 [E3-GENERATOR] Saving XML to:', s3Key);

            const xmlBuffer = Buffer.from(xml, 'utf-8');
            const uploadResult = await uploadBufferToS3(xmlBuffer, s3Key, 'application/xml');

            console.log(
                '✅ [E3-GENERATOR] XML saved:',
                uploadResult.s3Url || uploadResult.localPath
            );

            return {
                xml: xml,
                s3Key: uploadResult.s3Key,
                s3Url: uploadResult.s3Url || uploadResult.localPath,
                filename: filename
            };
        } catch (saveError) {
            console.error('❌ [E3-GENERATOR] Failed to save XML:', saveError.message);

            return {
                xml: xml,
                s3Key: null,
                s3Url: null,
                filename: null,
                saveError: saveError.message
            };
        }
    } catch (error) {
        console.error('❌ [E3-GENERATOR] Error:', error.message);
        throw error;
    }
}

// =========================================================================
// ✅ HELPER FUNCTIONS
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

function formatWeekHours(hours) {
    const n = Number(String(hours).replace(',', '.'));
    if (!Number.isFinite(n)) return '0,0';
    return n.toFixed(1).replace('.', ','); // πάντα 1 δεκαδικό
}
function formatCurrency(amount) {
    if (!amount) return '0,00';
    const formatted = Number(amount).toFixed(2).replace('.', ',');
    return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function normalizeYphkoothta(val, fallback = '348') {
    // Παίρνουμε μόνο ψηφία
    const digits = String(val ?? '').replace(/\D/g, '');
    // Αν δεν έχει τίποτα, χρησιμοποίησε fallback
    const base = digits.length ? digits : String(fallback).replace(/\D/g, '');
    // Κόψε στα 3 (αν είναι μεγαλύτερο) και συμπλήρωσε με μηδενικά αριστερά
    return base.slice(-3).padStart(3, '0');
}

function indent(level) {
    return '  '.repeat(level); // 2 spaces ανά επίπεδο
}

function buildEpikourikiXml(selections, level) {
    if (!selections || selections.length === 0) return '';

    const baseIndent = indent(level);
    const childIndent = indent(level + 1);
    const valueIndent = indent(level + 2);

    const items = selections
        .map(
            (item) => `
${childIndent}<EpikourikiSelectionsE3N>
${valueIndent}<f_kod_epikourikis>${escapeXml(item.kodikos)}</f_kod_epikourikis>
${childIndent}</EpikourikiSelectionsE3N>`
        )
        .join('');

    return `
${baseIndent}<EpikourikiSelections>${items}
${baseIndent}</EpikourikiSelections>`;
}

// =========================================================================
// ✅ BUILD XML STRING - ΣΩΣΤΗ ΔΟΜΗ!
// =========================================================================
function buildE3XML(data) {
    const epikourikiXml = buildEpikourikiXml(data.epikourikiSelections, 2);
    return `<?xml version="1.0" encoding="utf-8"?>
<AnaggeliesE3N xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.yeka.gr/E3N">
  <AnaggeliaE3N xmlns="">
    <f_aa_pararthmatos>${escapeXml(data.f_aa_pararthmatos)}</f_aa_pararthmatos>
    <f_rel_protocol>${escapeXml(data.f_rel_protocol)}</f_rel_protocol>
    <f_rel_date>${escapeXml(data.f_rel_date)}</f_rel_date>
    <f_ypiresia_sepe>${escapeXml(data.f_ypiresia_sepe)}</f_ypiresia_sepe>
    <f_ypiresia_oaed>${escapeXml(data.f_ypiresia_oaed)}</f_ypiresia_oaed>
    <f_kad_pararthmatos>${escapeXml(data.f_kad_pararthmatos)}</f_kad_pararthmatos>
    <f_kallikratis_pararthmatos>${escapeXml(data.f_kallikratis_pararthmatos)}</f_kallikratis_pararthmatos>
    <f_eponymo>${escapeXml(data.f_eponymo)}</f_eponymo>
    <f_onoma>${escapeXml(data.f_onoma)}</f_onoma>
    <f_onoma_patros>${escapeXml(data.f_onoma_patros)}</f_onoma_patros>
    <f_onoma_mitros>${escapeXml(data.f_onoma_mitros)}</f_onoma_mitros>
    <f_birthdate>${escapeXml(data.f_birthdate)}</f_birthdate>
    <f_sex>${escapeXml(data.f_sex)}</f_sex>
    <f_yphkoothta>${escapeXml(data.f_yphkoothta)}</f_yphkoothta>
    <f_typos_taytothtas>${escapeXml(data.f_typos_taytothtas)}</f_typos_taytothtas>
    <f_ar_taytothtas>${escapeXml(data.f_ar_taytothtas)}</f_ar_taytothtas>
    <f_ekdousa_arxh>${escapeXml(data.f_ekdousa_arxh)}</f_ekdousa_arxh>
    <f_date_ekdosis>${escapeXml(data.f_date_ekdosis)}</f_date_ekdosis>
    <f_date_ekdosis_lixi>${escapeXml(data.f_date_ekdosis_lixi)}</f_date_ekdosis_lixi>
    <f_res_permit_inst>${escapeXml(data.f_res_permit_inst)}</f_res_permit_inst>
    <f_res_permit_inst_type>${escapeXml(data.f_res_permit_inst_type)}</f_res_permit_inst_type>
    <f_res_permit_inst_ar>${escapeXml(data.f_res_permit_inst_ar)}</f_res_permit_inst_ar>
    <f_res_permit_inst_lixi>${escapeXml(data.f_res_permit_inst_lixi)}</f_res_permit_inst_lixi>
    <f_res_permit_ap>${escapeXml(data.f_res_permit_ap)}</f_res_permit_ap>
    <f_res_permit_ap_type>${escapeXml(data.f_res_permit_ap_type)}</f_res_permit_ap_type>
    <f_res_permit_ap_ar>${escapeXml(data.f_res_permit_ap_ar)}</f_res_permit_ap_ar>
    <f_res_permit_ap_lixi>${escapeXml(data.f_res_permit_ap_lixi)}</f_res_permit_ap_lixi>
    <f_res_permit_visa>${escapeXml(data.f_res_permit_visa)}</f_res_permit_visa>
    <f_res_permit_visa_ar>${escapeXml(data.f_res_permit_visa_ar)}</f_res_permit_visa_ar>
    <f_res_permit_visa_from>${escapeXml(data.f_res_permit_visa_from)}</f_res_permit_visa_from>
    <f_res_permit_visa_to>${escapeXml(data.f_res_permit_visa_to)}</f_res_permit_visa_to>
    <f_marital_status>${escapeXml(data.f_marital_status)}</f_marital_status>
    <f_arithmos_teknon>${escapeXml(data.f_arithmos_teknon)}</f_arithmos_teknon>
    <f_afm>${escapeXml(data.f_afm)}</f_afm>
    <f_doy>${escapeXml(data.f_doy)}</f_doy>
    <f_amika>${escapeXml(data.f_amika)}</f_amika>
    <f_amka>${escapeXml(data.f_amka)}</f_amka>
    <f_code_anergias>${escapeXml(data.f_code_anergias)}</f_code_anergias>
    <f_ar_vivliou_anilikou>${escapeXml(data.f_ar_vivliou_anilikou)}</f_ar_vivliou_anilikou>
    <f_epipedo_morfosis>${escapeXml(data.f_epipedo_morfosis)}</f_epipedo_morfosis>
    <f_proslipsidate>${escapeXml(data.f_proslipsidate)}</f_proslipsidate>
    <f_proslipsitime>${escapeXml(data.f_proslipsitime)}</f_proslipsitime>
    <f_apoxwrisitime>${escapeXml(data.f_apoxwrisitime)}</f_apoxwrisitime>
    <f_week_hours>${escapeXml(data.f_week_hours)}</f_week_hours>
    <f_eidikothta>${escapeXml(data.f_eidikothta)}</f_eidikothta>
    <f_eidikothta_anal>${escapeXml(data.f_eidikothta_anal)}</f_eidikothta_anal>
    <f_proipiresia>${escapeXml(data.f_proipiresia)}</f_proipiresia>
    <f_apodoxes>${escapeXml(data.f_apodoxes)}</f_apodoxes>
    <f_hour_apodoxes>${escapeXml(data.f_hour_apodoxes)}</f_hour_apodoxes>
    <f_sxeshapasxolisis>${escapeXml(data.f_sxeshapasxolisis)}</f_sxeshapasxolisis>
    <f_orismenou_apo>${escapeXml(data.f_orismenou_apo)}</f_orismenou_apo>
    <f_orismenou_ews>${escapeXml(data.f_orismenou_ews)}</f_orismenou_ews>
    <f_kathestosapasxolisis>${escapeXml(data.f_kathestosapasxolisis)}</f_kathestosapasxolisis>
    <f_xaraktirismos>${escapeXml(data.f_xaraktirismos)}</f_xaraktirismos>
    <f_special_case>${escapeXml(data.f_special_case)}</f_special_case>
    <f_responsible_position>${escapeXml(data.f_responsible_position)}</f_responsible_position>
    <f_working_time_digital_organization>${escapeXml(data.f_working_time_digital_organization)}</f_working_time_digital_organization>
    <f_full_employment_hours>${escapeXml(data.f_full_employment_hours)}</f_full_employment_hours>
    <f_week_days>${escapeXml(data.f_week_days)}</f_week_days>
    <f_euelikto_wrario_minutes>${escapeXml(data.f_euelikto_wrario_minutes)}</f_euelikto_wrario_minutes>
    <f_working_card>${escapeXml(data.f_working_card)}</f_working_card>
    <f_dialeimma_minutes>${escapeXml(data.f_dialeimma_minutes)}</f_dialeimma_minutes>
    <f_dialeimma_entos_wrariou>${escapeXml(data.f_dialeimma_entos_wrariou)}</f_dialeimma_entos_wrariou>
    <f_topothetisioaed>${escapeXml(data.f_topothetisioaed)}</f_topothetisioaed>
    <f_programaoaed>${escapeXml(data.f_programaoaed)}</f_programaoaed>
    <f_replaceprograma>${escapeXml(data.f_replaceprograma)}</f_replaceprograma>
    <f_replaceprograma_afm>${escapeXml(data.f_replaceprograma_afm)}</f_replaceprograma_afm>
    <f_replaceprograma_amka>${escapeXml(data.f_replaceprograma_amka)}</f_replaceprograma_amka>
    <f_trial_period>${escapeXml(data.f_trial_period)}</f_trial_period>
    <f_trial_date_to>${escapeXml(data.f_trial_date_to)}</f_trial_date_to>
    <f_basics_acceptance>${escapeXml(data.f_basics_acceptance)}</f_basics_acceptance>
    <f_file>${escapeXml(data.f_file)}</f_file>
    <f_file_symbash>${escapeXml(data.f_file_symbash)}</f_file_symbash>
    <f_comments>${escapeXml(data.f_comments)}</f_comments>
    <f_foreign_file>${escapeXml(data.f_foreign_file)}</f_foreign_file>
    <f_young_file>${escapeXml(data.f_young_file)}</f_young_file>
    <f_xronos_katavolis_apodoxon>${escapeXml(data.f_xronos_katavolis_apodoxon)}</f_xronos_katavolis_apodoxon>
    <f_ipoxreotiki_katartisi>${escapeXml(data.f_ipoxreotiki_katartisi)}</f_ipoxreotiki_katartisi>
    <f_efarmoste_sillogiki_simbasi>${escapeXml(data.f_efarmoste_sillogiki_simbasi)}</f_efarmoste_sillogiki_simbasi>
    <f_efarmoste_sillogiki_simbasi_comments>${escapeXml(data.f_efarmoste_sillogiki_simbasi_comments)}</f_efarmoste_sillogiki_simbasi_comments>
    <f_kyria_asfalisi>${escapeXml(data.f_kyria_asfalisi)}</f_kyria_asfalisi>
${epikourikiXml}
    <f_prosthetes_asfalistikes>${escapeXml(data.f_prosthetes_asfalistikes)}</f_prosthetes_asfalistikes>
    <f_mh_provlepsimo_programma>${escapeXml(data.f_mh_provlepsimo_programma)}</f_mh_provlepsimo_programma>
    <f_paraggelia_hmeres_hours>${escapeXml(data.f_paraggelia_hmeres_hours)}</f_paraggelia_hmeres_hours>
    <f_paraggelia_min_notification>${escapeXml(data.f_paraggelia_min_notification)}</f_paraggelia_min_notification>
    <f_paraggelia_notes>${escapeXml(data.f_paraggelia_notes)}</f_paraggelia_notes>
    <f_topos_ergasias>${escapeXml(data.f_topos_ergasias)}</f_topos_ergasias>
    <f_topos_ergasias_comment>${escapeXml(data.f_topos_ergasias_comment)}</f_topos_ergasias_comment>
  </AnaggeliaE3N>
</AnaggeliesE3N>`;
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

module.exports = { generateE3XML };
