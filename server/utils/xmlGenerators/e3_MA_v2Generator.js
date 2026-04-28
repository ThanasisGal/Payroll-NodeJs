// =========================================================================
// ✅ MA XML GENERATOR v2 για ΕΡΓΑΝΗ II
//    Μεταβολή Στοιχείων Εργασιακής Σχέσης (process codes 230, 231)
//    Βάσει MA_v2.xsd
// =========================================================================

async function generateMAXML(ergazomenos, companyData, ypokatasthmataData, options = {}) {
    try {
        // =====================================================================
        // ✅ VALIDATION
        // =====================================================================
        const requiredFields = [
            { field: 'eponymo', label: 'Επώνυμο' },
            { field: 'onoma', label: 'Όνομα' },
            { field: 'patronymo', label: 'Πατρώνυμο' },
            { field: 'mhtronymo', label: 'Μητρώνυμο' },
            { field: 'hmeromhnia_gennhshs', label: 'Ημ/νία Γέννησης' },
            { field: 'afm', label: 'ΑΦΜ' },
            { field: 'amka', label: 'ΑΜΚΑ' },
            { field: 'adt', label: 'Τύπος Νομιμοποιητικού εγγράφου' }
        ];

        const missingFields = requiredFields
            .filter(({ field }) => !ergazomenos[field])
            .map(({ label }) => label);

        if (missingFields.length > 0) {
            throw new Error(
                `[MA-GENERATOR-v2] Λείπουν υποχρεωτικά πεδία: ${missingFields.join(', ')}`
            );
        }

        // =====================================================================
        // ✅ PARSE TYPOS METABOLHS
        // =====================================================================
        let typesMetabolon = [];

        try {
            const rawData = ergazomenos.typos_metabolhs_table;
            if (rawData) {
                let parsed;
                if (typeof rawData === 'string' && rawData.trim() !== '') {
                    parsed = JSON.parse(rawData);
                } else if (Array.isArray(rawData)) {
                    parsed = rawData;
                }
                if (Array.isArray(parsed) && parsed.length > 0) {
                    typesMetabolon = parsed
                        .filter((item) => item)
                        .map((item) => {
                            const typos =
                                typeof item === 'object'
                                    ? item.typos_metabolhs || item.typos || item.value || item
                                    : item;
                            return { typos_metabolhs: String(typos) };
                        });
                    console.log(
                        `✅ [MA-GENERATOR-v2] Found ${typesMetabolon.length} metaboles types`
                    );
                }
            }
        } catch (parseError) {
            console.error(
                '[MA-GENERATOR-v2] Failed to parse typos_metabolhs_table:',
                parseError.message
            );
            typesMetabolon = [];
        }

        if (typesMetabolon.length === 0) {
            console.warn(
                '⚠️ [MA-GENERATOR-v2] No metaboles types found — using default type "001"'
            );
            typesMetabolon = [{ typos_metabolhs: '001' }];
        }

        // =====================================================================
        // ✅ PARSE OSYK SELECTIONS (v2 — αντικαθιστά Epikourikes)
        //    Πηγή: kad_efka, eidikothta_efka, kpk_efka, epa_efka
        // =====================================================================
        let osykSelections = [];

        try {
            // ✅ Αν υπάρχει πίνακας ΟΣΥΚ στον εργαζόμενο
            const osykData = ergazomenos.osyk_selections;
            if (osykData) {
                let parsed;
                if (typeof osykData === 'string' && osykData.trim() !== '') {
                    parsed = JSON.parse(osykData);
                } else if (Array.isArray(osykData)) {
                    parsed = osykData;
                }
                if (Array.isArray(parsed) && parsed.length > 0) {
                    osykSelections = parsed
                        .filter((item) => item)
                        .map((item) => ({
                            f_kad_efka: String(item.kad_efka || item.f_kad_efka || '').padStart(
                                4,
                                '0'
                            ),
                            f_step_efka: String(item.eidikothta_efka || item.f_step_efka || ''),
                            f_insurance_packet: String(
                                item.kpk_efka || item.f_insurance_packet || ''
                            ),
                            f_special_case: String(item.epa_efka || item.f_special_case || '')
                        }));
                    console.log(
                        `✅ [MA-GENERATOR-v2] Found ${osykSelections.length} OSYK selections`
                    );
                }
            }

            // ✅ Fallback: χρήση απλών πεδίων αν δεν υπάρχει πίνακας
            if (osykSelections.length === 0 && ergazomenos.kad_efka) {
                osykSelections = [
                    {
                        f_kad_efka: String(ergazomenos.kad_efka || '').padStart(4, '0'),
                        f_step_efka: String(ergazomenos.eidikothta_efka || ''),
                        f_insurance_packet: String(
                            ergazomenos.kpk_efka || ergazomenos.kpk_efka_basei_symbashs || ''
                        ),
                        f_special_case: String(ergazomenos.epa_efka || '')
                    }
                ];
                console.log('✅ [MA-GENERATOR-v2] OSYK from single fields (fallback)');
            }
        } catch (parseError) {
            console.error('[MA-GENERATOR-v2] Failed to parse OSYK data:', parseError.message);
            osykSelections = [];
        }

        // =====================================================================
        // ✅ DOWNLOAD PDFs FROM S3
        // =====================================================================
        let contractPdfBase64 = '';
        let foreignPdfBase64 = '';
        let youngPdfBase64 = '';

        if (ergazomenos.oysiodeis_oroi === '0') {
            if (ergazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path) {
                try {
                    const { downloadFileFromS3 } = require('../s3Helper');
                    const pdfBuffer = await downloadFileFromS3(
                        ergazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path
                    );
                    contractPdfBase64 = pdfBuffer.toString('base64');
                    console.log(
                        `✅ [MA-GENERATOR-v2] Contract PDF: ${contractPdfBase64.length} chars`
                    );
                } catch (pdfError) {
                    console.error(
                        '[MA-GENERATOR-v2] Failed to download contract PDF:',
                        pdfError.message
                    );
                }
            }
        }

        if (ergazomenos.arxeio_nomimopoihtikon_eggrafon_path) {
            try {
                const { downloadFileFromS3 } = require('../s3Helper');
                const pdfBuffer = await downloadFileFromS3(
                    ergazomenos.arxeio_nomimopoihtikon_eggrafon_path
                );
                foreignPdfBase64 = pdfBuffer.toString('base64');
            } catch (pdfError) {
                console.error(
                    '[MA-GENERATOR-v2] Failed to download foreign docs PDF:',
                    pdfError.message
                );
            }
        }

        if (ergazomenos.bibliario_anhlikoy_path) {
            try {
                const { downloadFileFromS3 } = require('../s3Helper');
                const pdfBuffer = await downloadFileFromS3(ergazomenos.bibliario_anhlikoy_path);
                youngPdfBase64 = pdfBuffer.toString('base64');
            } catch (pdfError) {
                console.error(
                    '[MA-GENERATOR-v2] Failed to download young docs PDF:',
                    pdfError.message
                );
            }
        }

        // =====================================================================
        // ✅ ΗΜΕΡΟΜΗΝΙΑ ΜΕΤΑΒΟΛΗΣ
        // =====================================================================
        const today = new Date();

        const date_metabolhs = options.hmeromhnia_metabolhs
            ? formatDateForErganh(options.hmeromhnia_metabolhs)
            : formatDateForErganh(today);

        console.log(`📅 [MA-GENERATOR-v2] Ημ/νία μεταβολής: ${date_metabolhs}`);

        // =====================================================================
        // ✅ FIELD MAPPING
        // =====================================================================
        const xmlData = {
            // ── COMPANY DATA ──
            f_aa_pararthmatos: ypokatasthmataData?.kodikos || '00000',
            f_rel_protocol: '',
            f_rel_date: '',
            f_ypiresia_sepe: ypokatasthmataData?.sepe_ergoy || '00000',
            f_ypiresia_oaed: ypokatasthmataData?.dypa_ergoy || '000000',
            f_kad_pararthmatos: companyData?.kad6
                ? companyData.kad6.split('.').slice(0, 2).join('')
                : '0000',
            f_kallikratis_pararthmatos: ypokatasthmataData?.polh || '00000000',

            // ── PERSONAL DATA ──
            f_eponymo: ergazomenos.eponymo.toUpperCase(),
            f_onoma: ergazomenos.onoma.toUpperCase(),
            f_eponymo_patros: (ergazomenos.eponymo_patera || '').toUpperCase(), // ✅ NEW v2
            f_onoma_patros: ergazomenos.patronymo.toUpperCase(),
            f_eponymo_mitros: (ergazomenos.eponymo_mhteras || '').toUpperCase(), // ✅ NEW v2
            f_onoma_mitros: ergazomenos.mhtronymo.toUpperCase(),
            f_topos_gennhshs: ergazomenos.topos_gennhshs || '', // ✅ NEW v2
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

            // ── RESIDENCE PERMITS ──
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

            // ── FAMILY STATUS ──
            f_marital_status: ergazomenos.oikogeneiakh_katastash || '0',
            f_arithmos_teknon: String(ergazomenos.arithmos_teknon || 0).padStart(2, '0'),

            // ── TAX & INSURANCE ──
            f_afm: ergazomenos.afm,
            f_doy: ergazomenos.doy || '',
            f_amika: ergazomenos.ama_krathshs_01 || '',
            f_amka: ergazomenos.amka || '',
            f_code_anergias: ergazomenos.arithmos_deltioy_anergias || '',
            f_ar_vivliou_anilikou: ergazomenos.arithmos_bibliarioy_anhlikoy || '',
            f_epipedo_morfosis: ergazomenos.ekpaideytiko_epipedo || '1',

            // ── ΜΕΤΑΒΟΛΗ ──
            f_date_metabolhs: date_metabolhs,

            // ── WORKING HOURS (✅ v2: αμέσως μετά το f_date_metabolhs) ──
            f_week_hours: formatWeekHours(ergazomenos.ores_ergasias_ebdomadas),

            // ── EMPLOYMENT DATA ──
            f_eidikothta: ergazomenos.eidikothta_erganh || '000000',
            f_eidikothta_anal: ergazomenos.antikeimeno_ergasion || '',
            f_proipiresia: String(ergazomenos.proyphresia_se_eth || 0),

            // ── SALARY DATA ──
            f_apodoxes: formatCurrency(
                ergazomenos.pragmatikosMisthos || ergazomenos.synolo_symbashs || 0
            ),
            f_hour_apodoxes: formatCurrency(ergazomenos.pragmatikoOromisthio || 0),

            // ── CONTRACT TYPE ──
            f_sxeshapasxolisis: ergazomenos.sxesh_ergasias || '0',
            f_orismenou_apo:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs)
                    : '',
            f_orismenou_ews:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDateForErganh(ergazomenos.hmeromhnia_lhxhs_symbashs)
                    : '',

            // ── EMPLOYMENT STATUS ──
            f_kathestosapasxolisis: ergazomenos.kathestos_apasxolhshs || '0', // ✅ v2: προστέθηκε "3" ΚΑΤΑ ΠΑΡΑΓΓΕΛΙΑ
            f_xaraktirismos: ergazomenos.xarakthrismos_ergazomenon ? '1' : '0',
            f_special_case: ergazomenos.eidikh_periptosh || '',
            f_responsible_position: ergazomenos.thesh_eythynhs || '1',

            // ── WORKING TIME ──
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

            // ── ΔΥΠΑ ──
            f_topothetisioaed: ergazomenos.topothethsh_me_programma ? '1' : '0',
            f_programaoaed: ergazomenos.programma_dypa || '',

            // ── TRIAL PERIOD ──
            f_trial_period: ergazomenos.afora_dokimastikh_periodo ? '1' : '0',
            f_trial_date_to: formatDateForErganh(ergazomenos.hmnia_lhxhs_dokimastikhs_periodoy),

            // ── ΚΑΤΑ ΠΑΡΑΓΓΕΛΙΑ (✅ NEW v2) ──
            f_paraggelia_hours_arithmos: ergazomenos.paraggelia_hours_arithmos || '',
            f_paraggelia_hour_apodoxes: ergazomenos.paraggelia_hour_apodoxes
                ? formatCurrency(ergazomenos.paraggelia_hour_apodoxes)
                : '',
            f_paraggelia_extra_hour_apodoxes: ergazomenos.paraggelia_extra_hour_apodoxes
                ? formatCurrency(ergazomenos.paraggelia_extra_hour_apodoxes)
                : '',
            f_paraggelia_hmeres_hours: ergazomenos.hmeres_ores_anaforas || '',
            f_paraggelia_min_notification: ergazomenos.eidopoihsh_prin_thn_anathesh || '',
            f_paraggelia_min_time: ergazomenos.paraggelia_min_time || '', // ✅ NEW v2
            f_paraggelia_notes: ergazomenos.prothesmia_akyroshs_ths_anatheshs || '',

            // ── ΔΑΝΕΙΣΜΟΣ ──
            f_borrow_type: ergazomenos.typos_daneismoy || '',
            f_borrow_date_from: formatDateForErganh(ergazomenos.hmeromhnia_enarxhs_daneismoy),
            f_borrow_date_to: formatDateForErganh(ergazomenos.hmeromhnia_lhxhs_daneismoy),
            f_borrow_company_afm: ergazomenos.afm_epixeirishs_daneismoy || '',
            f_borrow_company_eponimia: ergazomenos.eponimia_epixeirishs_daneismoy || '',

            // ── FILES ──
            f_basics_acceptance: typesMetabolon.some(
                (t) => String(t.typos_metabolhs).padStart(3, '0') === '001'
            )
                ? '2'
                : ergazomenos.oysiodeis_oroi || '2',
            f_file: contractPdfBase64,
            f_comments: ergazomenos.parathrhseis || '',
            f_foreign_file: foreignPdfBase64,
            f_young_file: youngPdfBase64,

            // ── LISTS ──
            typesMetabolon: typesMetabolon,
            osykSelections: osykSelections // ✅ NEW v2 — αντικαθιστά epikourikiSelections
        };

        // =====================================================================
        // ✅ BUILD XML
        // =====================================================================
        const xml = buildMAXML(xmlData);

        console.log('✅ [MA-GENERATOR-v2] XML generated successfully');
        console.log('   XML length:', xml.length, 'bytes');
        console.log('   Metaboles types:', typesMetabolon.length);
        console.log('   OSYK selections:', osykSelections.length);
        console.log('   Contract PDF:', contractPdfBase64 ? 'YES' : 'NO');

        // =====================================================================
        // ✅ SAVE XML TO S3
        // =====================================================================
        try {
            const { uploadBufferToS3 } = require('../s3Helper');

            const eponymoClean = ergazomenos.eponymo.toUpperCase().replace(/\s+/g, '_');
            const onomaClean = ergazomenos.onoma.toUpperCase().replace(/\s+/g, '_');
            const dateStr = date_metabolhs.replace(/\//g, '-');
            const employeeId = String(ergazomenos._id || 'UNKNOWN');
            const filename = `${employeeId}_${eponymoClean}_${onomaClean}_${dateStr}.xml`;

            const companyNameClean = companyData?.eponymia
                ? companyData.eponymia.replace(/\s+/g, '_').substring(0, 50)
                : 'UNKNOWN';

            const s3Key = `xmls/${ergazomenos.team}/${companyData.kod}_${companyNameClean}/MA/${filename}`;

            console.log('💾 [MA-GENERATOR-v2] Saving XML to:', s3Key);

            const xmlBuffer = Buffer.from(xml, 'utf-8');
            const uploadResult = await uploadBufferToS3(xmlBuffer, s3Key, 'application/xml');

            console.log(
                '✅ [MA-GENERATOR-v2] XML saved:',
                uploadResult.s3Url || uploadResult.localPath
            );

            return {
                success: true,
                xml,
                s3Key: uploadResult.s3Key,
                s3Url: uploadResult.s3Url || uploadResult.localPath,
                relativePath: uploadResult.s3Key,
                filename
            };
        } catch (saveError) {
            console.error('❌ [MA-GENERATOR-v2] Failed to save XML:', saveError.message);
            return {
                success: true,
                xml,
                s3Key: null,
                s3Url: null,
                filename: null,
                saveError: saveError.message
            };
        }
    } catch (error) {
        console.error('❌ [MA-GENERATOR-v2] Error:', error.message);
        throw error;
    }
}

// =========================================================================
// ✅ HELPER FUNCTIONS
// =========================================================================

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

function formatWeekHours(hours) {
    const n = Number(String(hours || 0).replace(',', '.'));
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
// ✅ BUILD TypesMetabolon XML section
// =========================================================================
function buildTypesMetabolonXml(types) {
    if (!types || types.length === 0) return '';
    const items = types
        .map((t) => {
            const typos = String(t.typos_metabolhs || '').padStart(3, '0');
            return `
    <TypesMetabolonMA>
      <f_typos_metabolhs>${escapeXml(typos)}</f_typos_metabolhs>
    </TypesMetabolonMA>`;
        })
        .join('');
    return `
  <TypesMetabolon>${items}
  </TypesMetabolon>`;
}

// =========================================================================
// ✅ BUILD OsykSelections XML section (v2 — αντικαθιστά Epikourikes)
// =========================================================================
function buildOsykSelectionsXml(selections) {
    if (!selections || selections.length === 0) return '';
    const items = selections
        .map(
            (item) => `
    <OsykSelectionsMA>
      <f_kad_efka>${escapeXml(item.f_kad_efka)}</f_kad_efka>
      <f_step_efka>${escapeXml(item.f_step_efka)}</f_step_efka>
      <f_insurance_packet>${escapeXml(item.f_insurance_packet)}</f_insurance_packet>
      <f_special_case>${escapeXml(item.f_special_case)}</f_special_case>
    </OsykSelectionsMA>`
        )
        .join('');
    return `
  <OsykSelections>${items}
  </OsykSelections>`;
}

// =========================================================================
// ✅ BUILD MA XML v2 STRING
// =========================================================================
function buildMAXML(data) {
    const typesMetabolonXml = buildTypesMetabolonXml(data.typesMetabolon);
    const osykSelectionsXml = buildOsykSelectionsXml(data.osykSelections);

    return `<?xml version="1.0" encoding="utf-8"?>
<AnaggeliesMA xmlns="http://www.yeka.gr/MA" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <AnaggeliaMA xmlns="">
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
    <f_date_metabolhs>${escapeXml(data.f_date_metabolhs)}</f_date_metabolhs>
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
    <f_trial_period>${escapeXml(data.f_trial_period)}</f_trial_period>
    <f_trial_date_to>${escapeXml(data.f_trial_date_to)}</f_trial_date_to>
    <f_paraggelia_hours_arithmos>${escapeXml(data.f_paraggelia_hours_arithmos)}</f_paraggelia_hours_arithmos>
    <f_paraggelia_hour_apodoxes>${escapeXml(data.f_paraggelia_hour_apodoxes)}</f_paraggelia_hour_apodoxes>
    <f_paraggelia_extra_hour_apodoxes>${escapeXml(data.f_paraggelia_extra_hour_apodoxes)}</f_paraggelia_extra_hour_apodoxes>
    <f_paraggelia_hmeres_hours>${escapeXml(data.f_paraggelia_hmeres_hours)}</f_paraggelia_hmeres_hours>
    <f_paraggelia_min_notification>${escapeXml(data.f_paraggelia_min_notification)}</f_paraggelia_min_notification>
    <f_paraggelia_min_time>${escapeXml(data.f_paraggelia_min_time)}</f_paraggelia_min_time>
    <f_paraggelia_notes>${escapeXml(data.f_paraggelia_notes)}</f_paraggelia_notes>
    <f_borrow_type>${escapeXml(data.f_borrow_type)}</f_borrow_type>
    <f_borrow_date_from>${escapeXml(data.f_borrow_date_from)}</f_borrow_date_from>
    <f_borrow_date_to>${escapeXml(data.f_borrow_date_to)}</f_borrow_date_to>
    <f_borrow_company_afm>${escapeXml(data.f_borrow_company_afm)}</f_borrow_company_afm>
    <f_borrow_company_eponimia>${escapeXml(data.f_borrow_company_eponimia)}</f_borrow_company_eponimia>
    <f_basics_acceptance>${escapeXml(data.f_basics_acceptance)}</f_basics_acceptance>
    <f_file>${escapeXml(data.f_file)}</f_file>
    <f_comments>${escapeXml(data.f_comments)}</f_comments>
    <f_foreign_file>${escapeXml(data.f_foreign_file)}</f_foreign_file>
    <f_young_file>${escapeXml(data.f_young_file)}</f_young_file>
${typesMetabolonXml}
${osykSelectionsXml}
  </AnaggeliaMA>
</AnaggeliesMA>`;
}

module.exports = { generateMAXML };
