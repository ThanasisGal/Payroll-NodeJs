// =========================================================================
// ✅ E3N JSON GENERATOR για ΕΡΓΑΝΗ II REST API
// =========================================================================

/**
 * ✅ Generate E3N JSON payload για ΕΡΓΑΝΗ II REST API
 *
 * Χρήση:
 * const { generateE3NJsonPayload } = require('../utils/jsonGenerators/e3N_jsonGenerator');
 * const payload = await generateE3NJsonPayload(ergazomenos, companyData, ypokatasthmataData);
 *
 * Το payload έχει δομή:
 * {
 *   AnaggeliesE3N: {
 *     AnaggeliaE3N: [ { ...fields... } ]
 *   }
 * }
 *
 * Βασίστηκε στο υπάρχον XML generator e3N_v1Generator.js και κρατάει το ίδιο mapping.
 * Η υποβολή Πρόσληψης στη λίστα Submissions είναι WebE3N / id 213.
 */
async function generateE3NJsonPayload(ergazomenos, companyData, ypokatasthmataData) {
    try {
        console.log('🔧 [E3N-JSON-GENERATOR] Starting JSON payload generation...');
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
            { field: 'adt', label: 'Τύπος/Αριθμός Νομιμοποιητικού εγγράφου' }
        ];

        const missingFields = requiredFields
            .filter(({ field }) => !ergazomenos[field])
            .map(({ label }) => label);

        if (missingFields.length > 0) {
            throw new Error(`Λείπουν υποχρεωτικά πεδία: ${missingFields.join(', ')}`);
        }

        // =====================================================================
        // ✅ PARSE ΕΠΙΚΟΥΡΙΚΗ ΑΣΦΑΛΙΣΗ
        // =====================================================================

        const epikourikiSelections = parseEpikourikiSelections(
            ergazomenos.foreas_epikoyrikhs_asfalishs
        );

        // =====================================================================
        // ✅ DOWNLOAD PDFs FROM S3 & CONVERT TO BASE64
        // =====================================================================

        let contractPdfBase64 = '';
        let foreignPdfBase64 = '';
        let youngPdfBase64 = '';

        // ΑΡΧΕΙΟ ΣΥΜΒΑΣΗΣ ΕΡΓΑΣΙΑΣ
        // Στο υπάρχον XML generator, όταν oysiodeis_oroi === '0', μπαίνει αρχείο σύμβασης στο f_file_symbash.
        if (ergazomenos.oysiodeis_oroi === '0') {
            contractPdfBase64 = await downloadPdfAsBase64(
                ergazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path,
                'Contract PDF'
            );
        }

        // ΑΡΧΕΙΟ ΝΟΜΙΜΟΠΟΙΗΤΙΚΩΝ ΕΓΓΡΑΦΩΝ
        foreignPdfBase64 = await downloadPdfAsBase64(
            ergazomenos.arxeio_nomimopoihtikon_eggrafon_path,
            'Foreign/legal docs PDF'
        );

        // ΑΡΧΕΙΟ ΕΓΓΡΑΦΩΝ ΑΝΗΛΙΚΩΝ
        youngPdfBase64 = await downloadPdfAsBase64(
            ergazomenos.bibliario_anhlikoy_path,
            'Young worker docs PDF'
        );

        // =====================================================================
        // ✅ FIELD MAPPING - ΙΔΙΑ ΛΟΓΙΚΗ ΜΕ ΤΟ XML E3N GENERATOR
        // =====================================================================

        const anaggeliaE3N = {
            // COMPANY DATA
            f_aa_pararthmatos: toStr(ypokatasthmataData?.kodikos || '00000'),
            f_rel_protocol: '',
            f_rel_date: '',
            f_ypiresia_sepe: toStr(ypokatasthmataData?.sepe_ergoy || '00000'),
            f_ypiresia_oaed: toStr(ypokatasthmataData?.dypa_ergoy || '000000'),
            f_kad_pararthmatos: companyData?.kad6
                ? toStr(companyData.kad6).split('.').slice(0, 2).join('')
                : '0000',
            f_kallikratis_pararthmatos: toStr(ypokatasthmataData?.polh || '00000000'),

            // PERSONAL DATA
            f_eponymo: upper(ergazomenos.eponymo),
            f_onoma: upper(ergazomenos.onoma),
            f_onoma_patros: upper(ergazomenos.patronymo),
            f_onoma_mitros: upper(ergazomenos.mhtronymo),
            f_birthdate: formatDateForErganh(ergazomenos.hmeromhnia_gennhshs),
            f_sex: booleanToErgani01(ergazomenos.fylo, '0'),
            f_yphkoothta: normalizeYphkoothta(ergazomenos.yphkoothta, '348'),
            f_typos_taytothtas: toStr(ergazomenos.typos_taytothtas || 'ΔΑΤ'),
            f_ar_taytothtas: toStr(ergazomenos.adt || 'Α00000000'),
            f_ekdousa_arxh: toStr(ergazomenos.arxh_ekdoshs || ''),
            f_date_ekdosis: formatDateForErganh(ergazomenos.hmeromhnia_ekdoshs),
            f_date_ekdosis_lixi: formatDateForErganh(
                ergazomenos.hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy
            ),

            // RESIDENCE PERMITS
            f_res_permit_inst: bool01(ergazomenos.adeia_diamonhs_me_amesh_prosbash_gia_ergasia),
            f_res_permit_inst_type: toStr(
                ergazomenos.eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia || ''
            ),
            f_res_permit_inst_ar: toStr(
                ergazomenos.arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia || ''
            ),
            f_res_permit_inst_lixi: formatDateForErganh(
                ergazomenos.hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia
            ),

            f_res_permit_ap: bool01(ergazomenos.adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia),
            f_res_permit_ap_type: toStr(
                ergazomenos.eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia || ''
            ),
            f_res_permit_ap_ar: toStr(
                ergazomenos.arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia || ''
            ),
            f_res_permit_ap_lixi: formatDateForErganh(
                ergazomenos.hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia
            ),

            f_res_permit_visa: bool01(ergazomenos.adeia_eisodoy_gia_epoxikh_apasxolhsh),
            f_res_permit_visa_ar: toStr(
                ergazomenos.arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh || ''
            ),
            f_res_permit_visa_from: formatDateForErganh(
                ergazomenos.apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh
            ),
            f_res_permit_visa_to: formatDateForErganh(
                ergazomenos.eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh
            ),

            // FAMILY STATUS
            f_marital_status: toStr(ergazomenos.oikogeneiakh_katastash || '0'),
            f_arithmos_teknon: toStr(ergazomenos.arithmos_teknon || 0).padStart(2, '0'),

            // TAX & INSURANCE
            f_afm: toStr(ergazomenos.afm),
            f_doy: toStr(ergazomenos.doy || ''),
            f_amika: toStr(ergazomenos.ama_krathshs_01 || ''),
            f_amka: toStr(ergazomenos.amka || ''),
            f_code_anergias: toStr(ergazomenos.arithmos_deltioy_anergias || ''),
            f_ar_vivliou_anilikou: toStr(ergazomenos.arithmos_bibliarioy_anhlikoy || ''),
            f_epipedo_morfosis: toStr(ergazomenos.ekpaideytiko_epipedo || '1'),

            // EMPLOYMENT DATA
            f_proslipsidate: formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs),
            f_proslipsitime: toStr(ergazomenos.ora_enarxhs_proths_foras || '08:00'),
            f_apoxwrisitime: toStr(ergazomenos.ora_apoxorhshs_proths_foras || '16:00'),
            f_week_hours: formatWeekHours(ergazomenos.ores_ergasias_ebdomadas),
            f_eidikothta: toStr(ergazomenos.eidikothta_erganh || '000000'),
            f_eidikothta_anal: toStr(ergazomenos.antikeimeno_ergasion || ''),
            f_proipiresia: toStr(ergazomenos.proyphresia_se_eth || 0),

            // SALARY DATA
            f_apodoxes: formatCurrency(
                ergazomenos.pragmatikosMisthos || ergazomenos.synolo_symbashs || 0
            ),
            f_hour_apodoxes: formatCurrency(ergazomenos.pragmatikoOromisthio || 0),

            // CONTRACT TYPE
            f_sxeshapasxolisis: toStr(ergazomenos.sxesh_ergasias || '0'),
            f_orismenou_apo:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs)
                    : '',
            f_orismenou_ews:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDateForErganh(ergazomenos.hmeromhnia_lhxhs_symbashs)
                    : '',

            // EMPLOYMENT STATUS
            f_kathestosapasxolisis: toStr(ergazomenos.kathestos_apasxolhshs || '0'),
            f_xaraktirismos: booleanToErgani01(ergazomenos.xarakthrismos_ergazomenon, '0'),
            f_special_case: enumValue(ergazomenos.eidikh_periptosh, ['', '2', '3'], ''),
            f_responsible_position: enumValue(
                ergazomenos.thesh_eythynhs,
                ['', '1', '2', '3', '4'],
                '1'
            ),

            // WORKING TIME ORGANIZATION
            f_working_time_digital_organization: bool01(ergazomenos.pshfiakh_organosh),
            f_full_employment_hours: formatWeekHours(ergazomenos.symbatikes_ores_ergasias || 40),
            f_week_days: normalizeWeekDays(ergazomenos.apasxolhsh_basei_symbashs),
            f_euelikto_wrario_minutes: toStr(ergazomenos.evelikth_proselefsh || 0),
            f_working_card: bool01(ergazomenos.karta_ergasias),
            f_dialeimma_minutes: toStr(ergazomenos.dialleima_se_lepta || 30),
            f_dialeimma_entos_wrariou: bool01(ergazomenos.dialleima_entos_ektos_orarioy),

            // ΔΥΠΑ PROGRAMS
            f_topothetisioaed: bool01(ergazomenos.topothethsh_me_programma),
            f_programaoaed: toStr(ergazomenos.programma_dypa || ''),
            f_replaceprograma: bool01(ergazomenos.antikatastash_ergazomenoy),
            f_replaceprograma_afm: toStr(ergazomenos.afm_antikatastath || ''),
            f_replaceprograma_amka: toStr(ergazomenos.amka_antikatastath || ''),

            // TRIAL PERIOD
            f_trial_period: bool01(ergazomenos.afora_dokimastikh_periodo),
            f_trial_date_to: formatDateForErganh(ergazomenos.hmnia_lhxhs_dokimastikhs_periodoy),

            // ACCEPTANCE OF TERMS / FILES
            f_basics_acceptance: toStr(ergazomenos.oysiodeis_oroi || '0'),
            f_file: '',
            f_file_symbash: contractPdfBase64,
            f_comments: maxLen(ergazomenos.parathrhseis || '', 100),
            f_foreign_file: foreignPdfBase64,
            f_young_file: youngPdfBase64,

            // ADDITIONAL FIELDS
            f_xronos_katavolis_apodoxon: toStr(
                ergazomenos.xronos_katabolhs_apodoxon ||
                    'ΕΝΤΟΣ 20ΗΜΕΡΟΥ ΑΠΟ ΤΟ ΤΕΛΟΣ ΚΑΘΕ ΜΙΣΘΟΛΟΓΙΚΗΣ ΠΕΡΙΟΔΟΥ'
            ),
            f_ipoxreotiki_katartisi: bool01(ergazomenos.ypoxreotikh_ek_toy_nomoy_katartish),
            f_efarmoste_sillogiki_simbasi: bool01(ergazomenos.efarmostea_sse),
            f_efarmoste_sillogiki_simbasi_comments: maxLen(
                ergazomenos.efarmostea_sse_parathrhseis || '',
                500
            ),

            // INSURANCE
            f_prosthetes_asfalistikes: maxLen(
                ergazomenos.prosthetes_asfalistikes_apodoxes || '',
                500
            ),
            f_kyria_asfalisi: toStr(ergazomenos.foreas_kyrias_asfalishs || ''),
            EpikourikiSelections: {
                EpikourikiSelectionsE3N: epikourikiSelections.map((item) => ({
                    f_kod_epikourikis: item.kodikos
                }))
            },

            // NON-PREDICTABLE SCHEDULE
            f_mh_provlepsimo_programma: bool01(ergazomenos.mh_problepsimo_programma),
            f_paraggelia_hmeres_hours: maxLen(ergazomenos.hmeres_ores_anaforas || '', 1000),
            f_paraggelia_min_notification: maxLen(
                ergazomenos.eidopoihsh_prin_thn_anathesh || '',
                50
            ),
            f_paraggelia_notes: maxLen(ergazomenos.prothesmia_akyroshs_ths_anatheshs || '', 50),

            // WORKPLACE
            f_topos_ergasias: bool01(ergazomenos.topos_ergasias),
            f_topos_ergasias_comment: ergazomenos.topos_ergasias
                ? maxLen(ergazomenos.topos_ergasias_parathrhseis || '', 500)
                : ''
        };

        const payload = {
            AnaggeliesE3N: {
                AnaggeliaE3N: [anaggeliaE3N]
            }
        };

        console.log('✅ [E3N-JSON-GENERATOR] JSON payload generated successfully');
        console.log('   Contract PDF:', contractPdfBase64 ? 'YES' : 'NO');
        console.log('   Foreign docs:', foreignPdfBase64 ? 'YES' : 'NO');
        console.log('   Young docs:', youngPdfBase64 ? 'YES' : 'NO');
        console.log('   Epikouriki:', epikourikiSelections.length);

        return payload;
    } catch (error) {
        console.error('❌ [E3N-JSON-GENERATOR] Error:', error.message);
        throw error;
    }
}

// =========================================================================
// ✅ HELPER FUNCTIONS
// =========================================================================

async function downloadPdfAsBase64(s3Path, label) {
    if (!s3Path) return '';

    try {
        console.log(`📥 [E3N-JSON-GENERATOR] Downloading ${label} from S3...`);

        const { downloadFileFromS3 } = require('../s3Helper');
        const pdfBuffer = await downloadFileFromS3(s3Path);
        const base64 = pdfBuffer.toString('base64');

        console.log(`✅ [E3N-JSON-GENERATOR] ${label}: ${base64.length} chars`);
        return base64;
    } catch (error) {
        console.error(`❌ [E3N-JSON-GENERATOR] Failed to download ${label}:`, error.message);
        return '';
    }
}

function parseEpikourikiSelections(epikourikiData) {
    let epikourikiSelections = [];

    try {
        if (!epikourikiData) return [];

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
                    const kodikos = typeof item === 'object' ? item.kodikos || item.value : item;
                    return {
                        kodikos: toStr(kodikos).padStart(3, '0')
                    };
                })
                .filter((item) => item.kodikos && item.kodikos !== '000');
        }

        console.log(
            `✅ [E3N-JSON-GENERATOR] Found ${epikourikiSelections.length} epikouriki selections`
        );
    } catch (error) {
        console.error('❌ [E3N-JSON-GENERATOR] Failed to parse epikouriki JSON:', error.message);
        epikourikiSelections = [];
    }

    return epikourikiSelections;
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

function formatWeekHours(hours) {
    const n = Number(String(hours ?? 0).replace(',', '.'));
    if (!Number.isFinite(n)) return '0,0';
    return n.toFixed(1).replace('.', ',');
}

function formatCurrency(amount) {
    const n = Number(String(amount ?? 0).replace(',', '.'));
    if (!Number.isFinite(n)) return '0,00';
    const formatted = n.toFixed(2).replace('.', ',');
    return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function normalizeYphkoothta(val, fallback = '348') {
    const digits = String(val ?? '').replace(/\D/g, '');
    const base = digits.length ? digits : String(fallback).replace(/\D/g, '');
    return base.slice(-3).padStart(3, '0');
}

function normalizeWeekDays(value) {
    const days = parseInt(value, 10);
    return days === 6 ? '6' : '5';
}

function bool01(value) {
    return value ? '1' : '0';
}

function booleanToErgani01(value, fallback = '0') {
    if (value === true) return '1';
    if (value === false) return '0';

    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();

    if (['1', 'true', 'yes', 'y', 'nai', 'ναι'].includes(normalized)) {
        return '1';
    }

    if (['0', 'false', 'no', 'n', 'oxi', 'όχι', 'οχι'].includes(normalized)) {
        return '0';
    }

    return fallback;
}

function enumValue(value, allowed, fallback = '') {
    const s = toStr(value).trim();
    return allowed.includes(s) ? s : fallback;
}

function maxLen(value, length) {
    return toStr(value).substring(0, length);
}

function upper(value) {
    return toStr(value).toUpperCase();
}

function toStr(value) {
    if (value === null || value === undefined) return '';
    return String(value);
}

module.exports = {
    generateE3NJsonPayload,
    // exports για εύκολα tests/compare scripts
    formatDateForErganh,
    formatWeekHours,
    formatCurrency,
    normalizeYphkoothta,
    enumValue,
    maxLen
};
