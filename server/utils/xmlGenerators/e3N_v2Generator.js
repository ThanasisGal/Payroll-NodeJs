// =========================================================================
// ✅ E3 XML GENERATOR για ΕΡΓΑΝΗ II - V2 VERSION (based on E3N_v2.xsd)
// =========================================================================

/**
 * ✅ Generate E3N XML για ΕΡΓΑΝΗ II - V2
 * @param {Object} ergazomenos - Mongoose Employee Document
 * @param {Object} companyData - Company info
 * @param {Object} ypokatasthmataData - Branch data
 * @returns {Promise<Object>} XML result object
 */
async function generateE3XML(ergazomenos, companyData, ypokatasthmataData) {
    try {
        console.log('🔧 [E3-GENERATOR-V2] Starting XML generation...');
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
            { field: 'adt', label: 'Τύπος Νομιμοποιητικού εγγράφου' }
            // ✅ V2: Αφαιρέθηκε το xronos_katabolhs_apodoxon από τα required
        ];

        const missingFields = requiredFields
            .filter(({ field }) => !ergazomenos[field])
            .map(({ label }) => label);

        if (missingFields.length > 0) {
            throw new Error(`Λείπουν υποχρεωτικά πεδία: ${missingFields.join(', ')}`);
        }

        // =====================================================================
        // ✅ V2: PARSE OSYK SELECTIONS (αντικατάσταση Epikouriki)
        // =====================================================================

        let osykSelections = [];

        try {
            const osykData = ergazomenos.foreas_epikoyrikhs_asfalishs;

            if (osykData) {
                let parsed;

                if (typeof osykData === 'string' && osykData.trim() !== '') {
                    parsed = JSON.parse(osykData);
                } else if (Array.isArray(osykData)) {
                    parsed = osykData;
                }

                if (Array.isArray(parsed)) {
                    osykSelections = parsed
                        .filter((item) => item)
                        .map((item) => ({
                            f_kad_efka: String(item.f_kad_efka || item.kad || '').padStart(4, '0'),
                            f_step_efka: String(item.f_step_efka || item.eidikothta || ''),
                            f_insurance_packet: String(
                                item.f_insurance_packet || item.paketo || ''
                            ),
                            f_special_case: String(item.f_special_case || item.eidikh || '')
                        }));

                    console.log(
                        `✅ [E3-GENERATOR-V2] Found ${osykSelections.length} OSYK selections`
                    );
                }
            }
        } catch (parseError) {
            console.error('❌ [E3-GENERATOR-V2] Failed to parse OSYK JSON:', parseError.message);
            osykSelections = [];
        }

        // =====================================================================
        // ✅ DOWNLOAD CONTRACT PDF FROM S3 & CONVERT TO BASE64
        // =====================================================================

        let contractPdfBase64 = '';
        let foreignPdfBase64 = '';
        let youngPdfBase64 = '';
        let symbashPdfBase64 = '';

        // ΑΡΧΕΙΟ ΟΥΣΙΩΔΩΝ ΟΡΩΝ
        if (ergazomenos.oysiodeis_oroi === '0') {
            if (ergazomenos.arxeio_apodoxhs_oysiodon_oron_path) {
                try {
                    console.log('📥 [E3-GENERATOR-V2] Downloading terms PDF from S3...');
                    const { downloadFileFromS3 } = require('../s3Helper');
                    const pdfBuffer = await downloadFileFromS3(
                        ergazomenos.arxeio_apodoxhs_oysiodon_oron_path
                    );
                    contractPdfBase64 = pdfBuffer.toString('base64');
                    console.log(
                        `✅ [E3-GENERATOR-V2] Terms PDF: ${contractPdfBase64.length} chars`
                    );
                } catch (pdfError) {
                    console.error(
                        '❌ [E3-GENERATOR-V2] Failed to download terms PDF:',
                        pdfError.message
                    );
                }
            }
        }

        // ✅ V2: ΑΡΧΕΙΟ ΑΤΟΜΙΚΗΣ ΣΥΜΒΑΣΗΣ (f_atomikh_symbash = '1')
        if (ergazomenos.atomikh_symbash === '1') {
            if (ergazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path) {
                try {
                    console.log('📥 [E3-GENERATOR-V2] Downloading contract PDF from S3...');
                    const { downloadFileFromS3 } = require('../s3Helper');
                    const pdfBuffer = await downloadFileFromS3(
                        ergazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path
                    );
                    symbashPdfBase64 = pdfBuffer.toString('base64');
                    console.log(
                        `✅ [E3-GENERATOR-V2] Contract PDF: ${symbashPdfBase64.length} chars`
                    );
                } catch (pdfError) {
                    console.error(
                        '❌ [E3-GENERATOR-V2] Failed to download contract PDF:',
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
                console.log(
                    `✅ [E3-GENERATOR-V2] Foreign docs PDF: ${foreignPdfBase64.length} chars`
                );
            } catch (pdfError) {
                console.error(
                    '❌ [E3-GENERATOR-V2] Failed to download foreign docs PDF:',
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
                    `✅ [E3-GENERATOR-V2] Young worker docs PDF: ${youngPdfBase64.length} chars`
                );
            } catch (pdfError) {
                console.error(
                    '❌ [E3-GENERATOR-V2] Failed to download young docs PDF:',
                    pdfError.message
                );
            }
        }

        // =====================================================================
        // ✅ FIELD MAPPING - V2
        // =====================================================================

        const xmlData = {
            // -----------------------------------------------------------------
            // COMPANY / BRANCH DATA
            // -----------------------------------------------------------------
            f_aa_pararthmatos: ypokatasthmataData?.kodikos || '00000',
            f_rel_protocol: '',
            f_rel_date: '',
            f_ypiresia_sepe: ypokatasthmataData?.sepe_ergoy || '00000',
            f_ypiresia_oaed: ypokatasthmataData?.dypa_ergoy || '000000',
            f_kad_pararthmatos: companyData?.kad6
                ? companyData.kad6.split('.').slice(0, 2).join('')
                : '0000',
            f_kallikratis_pararthmatos: ypokatasthmataData?.polh || '00000000',

            // -----------------------------------------------------------------
            // PERSONAL DATA
            // -----------------------------------------------------------------
            f_eponymo: ergazomenos.eponymo.toUpperCase(),
            f_onoma: ergazomenos.onoma.toUpperCase(),

            // ✅ V2: Νέα πεδία επωνύμων γονέων
            f_eponymo_patros: (ergazomenos.eponymo_patera || '').toUpperCase(),
            f_onoma_patros: ergazomenos.patronymo.toUpperCase(),
            f_eponymo_mitros: (ergazomenos.eponymo_mhteras || '').toUpperCase(),
            f_onoma_mitros: ergazomenos.mhtronymo.toUpperCase(),

            // ✅ V2: Νέο πεδίο τόπου γέννησης
            f_topos_gennhshs: ergazomenos.topos_gennhshs || '',

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

            // -----------------------------------------------------------------
            // RESIDENCE PERMITS
            // -----------------------------------------------------------------
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

            // -----------------------------------------------------------------
            // FAMILY STATUS
            // -----------------------------------------------------------------
            f_marital_status: ergazomenos.oikogeneiakh_katastash || '0',
            f_arithmos_teknon: String(ergazomenos.arithmos_teknon || 0).padStart(2, '0'),

            // -----------------------------------------------------------------
            // TAX & INSURANCE
            // -----------------------------------------------------------------
            f_afm: ergazomenos.afm,
            f_doy: ergazomenos.doy || '',
            f_amika: ergazomenos.ama_krathshs_01 || '',
            f_amka: ergazomenos.amka || '',
            f_code_anergias: ergazomenos.arithmos_deltioy_anergias || '',
            f_ar_vivliou_anilikou: ergazomenos.arithmos_bibliarioy_anhlikoy || '',
            f_epipedo_morfosis: ergazomenos.ekpaideytiko_epipedo || '1',

            // -----------------------------------------------------------------
            // EMPLOYMENT DATA
            // -----------------------------------------------------------------
            f_proslipsidate: formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs),
            f_proslipsitime: ergazomenos.ora_enarxhs_proths_foras || '08:00',
            f_apoxwrisitime: ergazomenos.ora_apoxorhshs_proths_foras || '16:00',
            f_week_hours: formatWeekHours(ergazomenos.ores_ergasias_ebdomadas),
            f_eidikothta: ergazomenos.eidikothta_erganh || '000000',
            f_eidikothta_anal: ergazomenos.antikeimeno_ergasion || '',
            f_proipiresia: String(ergazomenos.proyphresia_se_eth || 0),

            // -----------------------------------------------------------------
            // SALARY DATA
            // -----------------------------------------------------------------
            f_apodoxes: formatCurrency(
                ergazomenos.pragmatikosMisthos || ergazomenos.synolo_symbashs || 0
            ),
            f_hour_apodoxes: formatCurrency(ergazomenos.pragmatikoOromisthio || 0),

            // -----------------------------------------------------------------
            // CONTRACT TYPE
            // -----------------------------------------------------------------
            f_sxeshapasxolisis: ergazomenos.sxesh_ergasias || '0',
            f_orismenou_apo:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs)
                    : '',
            f_orismenou_ews:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDateForErganh(ergazomenos.hmeromhnia_lhxhs_symbashs)
                    : '',

            // -----------------------------------------------------------------
            // EMPLOYMENT STATUS
            // ✅ V2: f_kathestosapasxolisis τώρα δέχεται και τιμή "3" (ΚΑΤΑ ΠΑΡΑΓΓΕΛΙΑ)
            // -----------------------------------------------------------------
            f_kathestosapasxolisis: ergazomenos.kathestos_apasxolhshs || '0',
            f_xaraktirismos: ergazomenos.xarakthrismos_ergazomenon ? '1' : '0',
            f_special_case: ergazomenos.eidikh_periptosh || '',
            f_responsible_position: ergazomenos.thesh_eythynhs || '1',

            // ✅ V2: Νέα πεδία γεωγραφικής προέλευσης
            f_apoalliperioxi: ergazomenos.apo_allh_perioxi || '',
            f_nationalityalli: ergazomenos.nationality_allhs_xwras
                ? normalizeYphkoothta(ergazomenos.nationality_allhs_xwras)
                : '',
            f_kallikratisalli: ergazomenos.kallikratis_allhs_perioixhs || '',

            // -----------------------------------------------------------------
            // WORKING TIME ORGANIZATION
            // -----------------------------------------------------------------
            f_working_time_digital_organization: ergazomenos.pshfiakh_organosh ? '1' : '0',
            f_full_employment_hours: formatWeekHours(ergazomenos.symbatikes_ores_ergasias || 40),
            f_week_days: (() => {
                const days = parseInt(ergazomenos.apasxolhsh_basei_symbashs);
                return days === 6 ? '6' : '5';
            })(),
            f_euelikto_wrario_minutes: String(ergazomenos.evelikth_proselefsh || 0),
            f_working_card: ergazomenos.karta_ergasias ? '1' : '0',
            f_dialeimma_minutes: String(ergazomenos.dialleima_se_lepta || 30),
            f_dialeimma_entos_wrariou: ergazomenos.dialleima_entos_ektos_orarioy ? '1' : '0',

            // -----------------------------------------------------------------
            // ΔΥΠΑ PROGRAMS
            // -----------------------------------------------------------------
            f_topothetisioaed: ergazomenos.topothethsh_me_programma ? '1' : '0',
            f_programaoaed: ergazomenos.programma_dypa || '',
            f_replaceprograma: ergazomenos.antikatastash_ergazomenoy ? '1' : '0',
            f_replaceprograma_afm: ergazomenos.afm_antikatastath || '',
            f_replaceprograma_amka: ergazomenos.amka_antikatastath || '',

            // -----------------------------------------------------------------
            // TRIAL PERIOD
            // -----------------------------------------------------------------
            f_trial_period: ergazomenos.afora_dokimastikh_periodo ? '1' : '0',
            f_trial_date_to: formatDateForErganh(ergazomenos.hmnia_lhxhs_dokimastikhs_periodoy),

            // -----------------------------------------------------------------
            // ✅ V2: ΚΑΤΑ ΠΑΡΑΓΓΕΛΙΑ πεδία (ενεργά όταν f_kathestosapasxolisis = '3')
            // -----------------------------------------------------------------
            f_paraggelia_hours_arithmos:
                ergazomenos.kathestos_apasxolhshs === '3'
                    ? String(ergazomenos.paraggelia_ores_mhniaiws || '')
                    : '',
            f_paraggelia_hour_apodoxes:
                ergazomenos.kathestos_apasxolhshs === '3'
                    ? formatCurrency(ergazomenos.paraggelia_oromisthio_engyimenon || 0)
                    : '',
            f_paraggelia_extra_hour_apodoxes:
                ergazomenos.kathestos_apasxolhshs === '3'
                    ? formatCurrency(ergazomenos.paraggelia_oromisthio_epipleon || 0)
                    : '',
            f_paraggelia_hmeres_hours: ergazomenos.hmeres_ores_anaforas || '',
            f_paraggelia_min_notification: ergazomenos.eidopoihsh_prin_thn_anathesh || '',
            f_paraggelia_min_time:
                ergazomenos.kathestos_apasxolhshs === '3'
                    ? String(ergazomenos.paraggelia_elaxistes_engyimenes_ores || '')
                    : '',
            f_paraggelia_notes: ergazomenos.paraggelia_parathrhseis || '',

            // -----------------------------------------------------------------
            // ACCEPTANCE OF TERMS
            // -----------------------------------------------------------------
            f_basics_acceptance: ergazomenos.oysiodeis_oroi || '1',
            f_file: contractPdfBase64,

            // ✅ V2: f_atomikh_symbash - νέο πεδίο (0=ΌΧΙ, 1=ΜΕ ΑΡΧΕΙΟ, 2=ΕΚΚΡΕΜΕΙ)
            f_atomikh_symbash: ergazomenos.atomikh_symbash || '0',
            f_file_symbash: symbashPdfBase64,

            f_comments: ergazomenos.parathrhseis || '',
            f_foreign_file: foreignPdfBase64,
            f_young_file: youngPdfBase64,

            // -----------------------------------------------------------------
            // ✅ V2: OSYK SELECTIONS (αντικατάσταση EpikourikiSelections)
            // -----------------------------------------------------------------
            osykSelections: osykSelections

            // ✅ V2: ΑΦΑΙΡΕΘΗΚΑΝ τα παρακάτω πεδία της V1:
            // - f_kyria_asfalisi
            // - f_prosthetes_asfalistikes
            // - f_mh_provlepsimo_programma
            // - f_xronos_katavolis_apodoxon
            // - f_ipoxreotiki_katartisi
            // - f_efarmoste_sillogiki_simbasi
            // - f_efarmoste_sillogiki_simbasi_comments
            // - f_topos_ergasias
            // - f_topos_ergasias_comment
        };

        // =====================================================================
        // ✅ BUILD XML
        // =====================================================================

        const xml = buildE3XML(xmlData);

        console.log('✅ [E3-GENERATOR-V2] XML generated successfully');
        console.log('   XML length:    ', xml.length, 'bytes');
        console.log('   Terms PDF:     ', contractPdfBase64 ? 'YES' : 'NO');
        console.log('   Contract PDF:  ', symbashPdfBase64 ? 'YES' : 'NO');
        console.log('   Foreign docs:  ', foreignPdfBase64 ? 'YES' : 'NO');
        console.log('   Young docs:    ', youngPdfBase64 ? 'YES' : 'NO');
        console.log('   OSYK:          ', osykSelections.length);

        // =====================================================================
        // ✅ SAVE XML TO S3
        // =====================================================================

        try {
            const { uploadBufferToS3 } = require('../s3Helper');

            const eponymoClean = ergazomenos.eponymo.toUpperCase().replace(/\s+/g, '_');
            const onomaClean = ergazomenos.onoma.toUpperCase().replace(/\s+/g, '_');
            const dateStr = formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs).replace(
                /\//g,
                '-'
            );
            const employeeId = String(ergazomenos._id || 'UNKNOWN');
            const filename = `${employeeId}_${eponymoClean}_${onomaClean}_${dateStr}.xml`;

            const companyNameClean = companyData?.eponymia
                ? companyData.eponymia.replace(/\s+/g, '_').substring(0, 50)
                : 'UNKNOWN';

            const s3Key = `xmls/${ergazomenos.team}/${companyData.kod}_${companyNameClean}/E3N/${filename}`;

            console.log('💾 [E3-GENERATOR-V2] Saving XML to:', s3Key);

            const xmlBuffer = Buffer.from(xml, 'utf-8');
            const uploadResult = await uploadBufferToS3(xmlBuffer, s3Key, 'application/xml');

            console.log(
                '✅ [E3-GENERATOR-V2] XML saved:',
                uploadResult.s3Url || uploadResult.localPath
            );

            return {
                xml,
                s3Key: uploadResult.s3Key,
                s3Url: uploadResult.s3Url || uploadResult.localPath,
                filename
            };
        } catch (saveError) {
            console.error('❌ [E3-GENERATOR-V2] Failed to save XML:', saveError.message);
            return {
                xml,
                s3Key: null,
                s3Url: null,
                filename: null,
                saveError: saveError.message
            };
        }
    } catch (error) {
        console.error('❌ [E3-GENERATOR-V2] Error:', error.message);
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
    return n.toFixed(1).replace('.', ',');
}

function formatCurrency(amount) {
    if (!amount) return '0,00';
    const formatted = Number(amount).toFixed(2).replace('.', ',');
    return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function normalizeYphkoothta(val, fallback = '348') {
    const digits = String(val ?? '').replace(/\D/g, '');
    const base = digits.length ? digits : String(fallback).replace(/\D/g, '');
    return base.slice(-3).padStart(3, '0');
}

function indent(level) {
    return '  '.repeat(level);
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
// ✅ V2: BUILD OSYK XML (αντικατάσταση buildEpikourikiXml)
// =========================================================================
function buildOsykXml(selections, level) {
    if (!selections || selections.length === 0) return '';

    const baseIndent = indent(level);
    const childIndent = indent(level + 1);
    const valueIndent = indent(level + 2);

    const items = selections
        .map(
            (item) => `
${childIndent}<OsykSelectionsE3N>
${valueIndent}<f_kad_efka>${escapeXml(item.f_kad_efka)}</f_kad_efka>
${valueIndent}<f_step_efka>${escapeXml(item.f_step_efka)}</f_step_efka>
${valueIndent}<f_insurance_packet>${escapeXml(item.f_insurance_packet)}</f_insurance_packet>
${valueIndent}<f_special_case>${escapeXml(item.f_special_case)}</f_special_case>
${childIndent}</OsykSelectionsE3N>`
        )
        .join('');

    return `
${baseIndent}<OsykSelections>${items}
${baseIndent}</OsykSelections>`;
}

// =========================================================================
// ✅ BUILD XML STRING - V2 STRUCTURE (based on E3N_v2.xsd)
// =========================================================================
function buildE3XML(data) {
    const osykXml = buildOsykXml(data.osykSelections, 2);

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
    <f_eponymo_patros>${escapeXml(data.f_eponymo_patros)}</f_eponymo_patros>
    <f_onoma_patros>${escapeXml(data.f_onoma_patros)}</f_onoma_patros>
    <f_eponymo_mitros>${escapeXml(data.f_eponymo_mitros)}</f_eponymo_mitros>
    <f_onoma_mitros>${escapeXml(data.f_onoma_mitros)}</f_onoma_mitros>
    <f_topos_gennhshs>${escapeXml(data.f_topos_gennhshs)}</f_topos_gennhshs>
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
    <f_apoalliperioxi>${escapeXml(data.f_apoalliperioxi)}</f_apoalliperioxi>
    <f_nationalityalli>${escapeXml(data.f_nationalityalli)}</f_nationalityalli>
    <f_kallikratisalli>${escapeXml(data.f_kallikratisalli)}</f_kallikratisalli>
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
    <f_paraggelia_hours_arithmos>${escapeXml(data.f_paraggelia_hours_arithmos)}</f_paraggelia_hours_arithmos>
    <f_paraggelia_hour_apodoxes>${escapeXml(data.f_paraggelia_hour_apodoxes)}</f_paraggelia_hour_apodoxes>
    <f_paraggelia_extra_hour_apodoxes>${escapeXml(data.f_paraggelia_extra_hour_apodoxes)}</f_paraggelia_extra_hour_apodoxes>
    <f_paraggelia_hmeres_hours>${escapeXml(data.f_paraggelia_hmeres_hours)}</f_paraggelia_hmeres_hours>
    <f_paraggelia_min_notification>${escapeXml(data.f_paraggelia_min_notification)}</f_paraggelia_min_notification>
    <f_paraggelia_min_time>${escapeXml(data.f_paraggelia_min_time)}</f_paraggelia_min_time>
    <f_paraggelia_notes>${escapeXml(data.f_paraggelia_notes)}</f_paraggelia_notes>
    <f_basics_acceptance>${escapeXml(data.f_basics_acceptance)}</f_basics_acceptance>
    <f_file>${escapeXml(data.f_file)}</f_file>
    <f_atomikh_symbash>${escapeXml(data.f_atomikh_symbash)}</f_atomikh_symbash>
    <f_file_symbash>${escapeXml(data.f_file_symbash)}</f_file_symbash>
    <f_comments>${escapeXml(data.f_comments)}</f_comments>
    <f_foreign_file>${escapeXml(data.f_foreign_file)}</f_foreign_file>
    <f_young_file>${escapeXml(data.f_young_file)}</f_young_file>
${osykXml}
  </AnaggeliaE3N>
</AnaggeliesE3N>`;
}

module.exports = { generateE3XML };
