// =========================================================================
// ✅ MA XML GENERATOR V1 για ΕΡΓΑΝΗ II
//    Μεταβολή Στοιχείων Εργασιακής Σχέσης (codes 230, 231)
//    Βάσει MA_v1.xsd
// =========================================================================

async function generateMAXML(ergazomenos, companyData, ypokatasthmataData, options = {}) {
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
            { field: 'adt', label: 'Τύπος Νομιμοποιητικού εγγράφου' }
        ];

        const missingFields = requiredFields
            .filter(({ field }) => !ergazomenos[field])
            .map(({ label }) => label);

        if (missingFields.length > 0) {
            throw new Error(
                `[MA-GENERATOR-v1] Λείπουν υποχρεωτικά πεδία: ${missingFields.join(', ')}`
            );
        }

        // =====================================================================
        // ✅ PARSE TYPOS METABOLHS (από typos_metabolhs_table)
        //    Πίνακας τύπων μεταβολής που έχουν καταχωρηθεί για τον εργαζόμενο
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

                // ✅ Log ΠΡΙΝ τον έλεγχο — πάντα ασφαλές
                console.log('🔍 [MA] rawData:', JSON.stringify(rawData));
                console.log('🔍 [MA] parsed:', JSON.stringify(parsed ?? null));

                if (Array.isArray(parsed) && parsed.length > 0) {
                    typesMetabolon = parsed
                        .filter((item) => item)
                        .map((item) => {
                            let typos;
                            if (typeof item === 'object') {
                                typos =
                                    item.typos_metabolhs ??
                                    item.typos ??
                                    item.value ??
                                    item.code ??
                                    Object.values(item)[0];
                            } else {
                                typos = item;
                            }
                            return { typos_metabolhs: String(typos || '') };
                        })
                        .filter((item) => item.typos_metabolhs !== '');

                    console.log('🔍 [MA] typesMetabolon:', JSON.stringify(typesMetabolon));
                }
            }
        } catch (parseError) {
            console.error(
                '❌ [MA-GENERATOR-v1] Failed to parse typos_metabolhs_table:',
                parseError.message
            );
            typesMetabolon = [];
        }

        // Αν δεν υπάρχουν τύποι μεταβολής, βάζουμε default '1' (Γενική Μεταβολή)
        if (typesMetabolon.length === 0) {
            console.warn('⚠️ [MA-GENERATOR-v1] No metaboles types found — using default type "1"');
            typesMetabolon = [{ typos_metabolhs: '1' }];
        }

        // =====================================================================
        // ✅ PARSE EPIKOURIKI ASFALISH (ίδια λογική με E3N)
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
                            return { kodikos: String(kodikos).padStart(3, '0') };
                        });
                    console.log(
                        `✅ [MA-GENERATOR-v1] Found ${epikourikiSelections.length} epikouriki selections`
                    );
                }
            }
        } catch (parseError) {
            console.error(
                '❌ [MA-GENERATOR-v1] Failed to parse epikouriki JSON:',
                parseError.message
            );
            epikourikiSelections = [];
        }

        // =====================================================================
        // ✅ DOWNLOAD PDFs FROM S3 (ίδια λογική με E3N)
        // =====================================================================

        let contractPdfBase64 = '';
        let foreignPdfBase64 = '';
        let youngPdfBase64 = '';
        let epivolhPdfBase64 = ''; // ✅ MA-ONLY: Αρχείο Επιβολής (δεν υπάρχει στο E3N)

        if (ergazomenos.oysiodeis_oroi === '0') {
            if (ergazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path) {
                try {
                    console.log('📥 [MA-GENERATOR-v1] Downloading contract PDF from S3...');
                    const { downloadFileFromS3 } = require('../s3Helper');
                    const pdfBuffer = await downloadFileFromS3(
                        ergazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path
                    );
                    contractPdfBase64 = pdfBuffer.toString('base64');
                    console.log(
                        `✅ [MA-GENERATOR-v1] Contract PDF: ${contractPdfBase64.length} chars`
                    );
                } catch (pdfError) {
                    console.error(
                        '❌ [MA-GENERATOR-v1] Failed to download contract PDF:',
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
                console.log(
                    `✅ [MA-GENERATOR-v1] Foreign docs PDF: ${foreignPdfBase64.length} chars`
                );
            } catch (pdfError) {
                console.error(
                    '❌ [MA-GENERATOR-v1] Failed to download foreign docs PDF:',
                    pdfError.message
                );
            }
        }

        if (ergazomenos.bibliario_anhlikoy_path) {
            try {
                const { downloadFileFromS3 } = require('../s3Helper');
                const pdfBuffer = await downloadFileFromS3(ergazomenos.bibliario_anhlikoy_path);
                youngPdfBase64 = pdfBuffer.toString('base64');
                console.log(
                    `✅ [MA-GENERATOR-v1] Young worker docs PDF: ${youngPdfBase64.length} chars`
                );
            } catch (pdfError) {
                console.error(
                    '❌ [MA-GENERATOR-v1] Failed to download young docs PDF:',
                    pdfError.message
                );
            }
        }

        // =====================================================================
        // ✅ ΥΠΟΛΟΓΙΣΜΟΣ ΠΕΡΙΟΔΟΥ ΑΝΑΦΟΡΑΣ
        //    Αν δεν υπάρχουν αποθηκευμένες ημερομηνίες, υπολογίζουμε αυτόματα
        //    1η - τελευταία του τρέχοντος μήνα
        // =====================================================================

        const today = new Date();

        const periodos_apo = ergazomenos.periodos_anaforas_from
            ? formatDateForErganh(ergazomenos.periodos_anaforas_from)
            : '';

        const periodos_eos = ergazomenos.periodos_anaforas_to
            ? formatDateForErganh(ergazomenos.periodos_anaforas_to)
            : '';

        const date_metabolhs = options.hmeromhnia_metabolhs
            ? formatDateForErganh(options.hmeromhnia_metabolhs)
            : '';

        // =====================================================================
        // ✅ FIELD MAPPING
        //    Τα πεδία που είναι ΙΔΙΑ με E3N παίρνουν ΙΔΙΕΣ τιμές
        //    Τα πεδία που είναι ΜΟΝΟ MA έχουν σχόλιο // MA-ONLY
        // =====================================================================

        const xmlData = {
            // ── COMPANY DATA (ίδιο με E3N) ──
            f_aa_pararthmatos: ypokatasthmataData?.kodikos || '00000',
            f_rel_protocol: '',
            f_rel_date: '',
            f_ypiresia_sepe: ypokatasthmataData?.sepe_ergoy || '00000',
            f_ypiresia_oaed: ypokatasthmataData?.dypa_ergoy || '000000',
            f_kad_pararthmatos: companyData?.kad6
                ? companyData.kad6.split('.').slice(0, 2).join('')
                : '0000',
            f_kallikratis_pararthmatos: ypokatasthmataData?.polh || '00000000',

            // ── PERSONAL DATA (ίδιο με E3N) ──
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

            // ── RESIDENCE PERMITS (ίδιο με E3N) ──
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

            // ── FAMILY STATUS (ίδιο με E3N) ──
            f_marital_status: ergazomenos.oikogeneiakh_katastash || '0',
            f_arithmos_teknon: String(ergazomenos.arithmos_teknon || 0).padStart(2, '0'),

            // ── TAX & INSURANCE (ίδιο με E3N) ──
            f_afm: ergazomenos.afm,
            f_doy: ergazomenos.doy || '',
            f_amika: ergazomenos.ama_krathshs_01 || '',
            f_amka: ergazomenos.amka || '',
            f_code_anergias: ergazomenos.arithmos_deltioy_anergias || '',
            f_ar_vivliou_anilikou: ergazomenos.arithmos_bibliarioy_anhlikoy || '',
            f_epipedo_morfosis: ergazomenos.ekpaideytiko_epipedo || '1',

            // ── MA-ONLY: Στοιχεία Μεταβολής ──
            f_date_metabolhs: date_metabolhs,
            f_eidos_dieuthethshs: ergazomenos.eidos_dieuthethshs || '2',
            f_eidos_dieuthethshs_comments: ergazomenos.eidos_dieuthethshs_comments || '',
            f_periodos_anaforas_from: periodos_apo,
            f_periodos_anaforas_to: periodos_eos,

            // ── EMPLOYMENT DATA (ίδιο με E3N) ──
            f_eidikothta: ergazomenos.eidikothta_erganh || '000000',
            f_eidikothta_anal: ergazomenos.antikeimeno_ergasion || '',
            f_proipiresia: String(ergazomenos.proyphresia_se_eth || 0),

            // ── SALARY DATA (ίδιο με E3N) ──
            f_apodoxes: formatCurrency(
                ergazomenos.pragmatikosMisthos || ergazomenos.synolo_symbashs || 0
            ),
            f_hour_apodoxes: formatCurrency(ergazomenos.pragmatikoOromisthio || 0),

            // ── MA-ONLY: Χρόνος Καταβολής (διαφορετικό όνομα από E3N) ──
            f_xronos_katabolhs:
                ergazomenos.xronos_katabolhs_apodoxon ||
                'ΕΝΤΟΣ 20ΗΜΕΡΟΥ ΑΠΟ ΤΟ ΤΕΛΟΣ ΚΑΘΕ ΜΙΣΘΟΛΟΓΙΚΗΣ ΠΕΡΙΟΔΟΥ',

            // ── WORKPLACE (ίδιο με E3N) ──
            f_topos_ergasias: ergazomenos.topos_ergasias ? '1' : '0',
            f_topos_ergasias_comments: ergazomenos.topos_ergasias
                ? ergazomenos.topos_ergasias_parathrhseis || ''
                : '',

            // ── CONTRACT TYPE (ίδιο με E3N) ──
            f_sxeshapasxolisis: ergazomenos.sxesh_ergasias || '0',
            f_orismenou_apo:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDateForErganh(ergazomenos.hmeromhnia_proslhpshs)
                    : '',
            f_orismenou_ews:
                ergazomenos.sxesh_ergasias === '1'
                    ? formatDateForErganh(ergazomenos.hmeromhnia_lhxhs_symbashs)
                    : '',

            // ── EMPLOYMENT STATUS (ίδιο με E3N) ──
            f_kathestosapasxolisis: ergazomenos.kathestos_apasxolhshs || '0',
            f_xaraktirismos: ergazomenos.xarakthrismos_ergazomenon ? '1' : '0',
            f_special_case: ergazomenos.eidikh_periptosh || '',
            f_responsible_position: ergazomenos.thesh_eythynhs || '1',

            // ── INSURANCE (ίδιο με E3N — διαφορετικό tag name στο XML) ──
            f_efarmostea_sillogiki_simbasi: ergazomenos.efarmostea_sse ? '1' : '0',
            f_efarmostea_sillogiki_simbasi_comments: ergazomenos.efarmostea_sse_parathrhseis || '',
            f_kyria_asfalish: ergazomenos.foreas_kyrias_asfalishs || '',
            f_prosthetes_asfalistikes_paroxes: ergazomenos.prosthetes_asfalistikes_apodoxes || '',
            epikourikiSelections: epikourikiSelections,
            f_ipoxreotiki_katartisi: ergazomenos.ypoxreotikh_ek_toy_nomoy_katartish ? '1' : '0',

            // ── WORKING TIME (ίδιο με E3N) ──
            f_working_time_digital_organization: ergazomenos.pshfiakh_organosh ? '1' : '0',
            f_mh_problepsimo_programma: ergazomenos.mh_problepsimo_programma ? '1' : '0',
            f_paraggelia_hmeres_hours: ergazomenos.hmeres_ores_anaforas || '',
            f_paraggelia_min_notification: ergazomenos.eidopoihsh_prin_thn_anathesh || '',
            f_paraggelia_notes: ergazomenos.prothesmia_akyroshs_ths_anatheshs || '',
            f_week_hours: formatWeekHours(ergazomenos.ores_ergasias_ebdomadas),
            f_full_employment_hours: formatWeekHours(ergazomenos.symbatikes_ores_ergasias || 40),
            f_week_days: (() => {
                const days = parseInt(ergazomenos.apasxolhsh_basei_symbashs);
                return days === 6 ? '6' : '5';
            })(),
            f_euelikto_wrario_minutes: String(ergazomenos.evelikth_proselefsh || 0),
            f_working_card: ergazomenos.karta_ergasias ? '1' : '0',
            f_dialeimma_minutes: String(ergazomenos.dialleima_se_lepta || 30),
            f_dialeimma_entos_wrariou: ergazomenos.dialleima_entos_ektos_orarioy ? '1' : '0',

            // ── ΔΥΠΑ (ίδιο με E3N) ──
            f_topothetisioaed: ergazomenos.topothethsh_me_programma ? '1' : '0',
            f_programaoaed: ergazomenos.programma_dypa || '',

            // ── TRIAL PERIOD (ίδιο με E3N) ──
            f_trial_period: ergazomenos.afora_dokimastikh_periodo ? '1' : '0',
            f_trial_date_to: formatDateForErganh(ergazomenos.hmnia_lhxhs_dokimastikhs_periodoy),

            // ── MA-ONLY: Δανεισμός ──
            f_borrow_type: ergazomenos.typos_daneismoy || '',
            f_borrow_date_from: formatDateForErganh(ergazomenos.hmeromhnia_enarxhs_daneismoy),
            f_borrow_date_to: formatDateForErganh(ergazomenos.hmeromhnia_lhxhs_daneismoy),
            f_borrow_company_afm: ergazomenos.afm_epixeirishs_daneismoy || '',
            f_borrow_company_eponimia: ergazomenos.eponimia_epixeirishs_daneismoy || '',

            // ── FILES (ίδιο με E3N + MA-ONLY f_epibolh_file) ──
            // ✅ '2' ΜΟΝΟ αν υπάρχει ακριβώς ΕΝΑ type ΚΑΙ είναι '001'
            f_basics_acceptance:
                typesMetabolon.length === 1 &&
                String(typesMetabolon[0].typos_metabolhs).padStart(3, '0') === '001'
                    ? '2'
                    : ergazomenos.oysiodeis_oroi || '2',
            f_file: contractPdfBase64,
            f_comments: ergazomenos.parathrhseis || '',
            f_foreign_file: foreignPdfBase64,
            f_young_file: youngPdfBase64,
            f_epibolh_file: epivolhPdfBase64, // MA-ONLY

            // ── MA-ONLY: Τύποι Μεταβολών ──
            typesMetabolon: typesMetabolon
        };

        // =====================================================================
        // ✅ BUILD XML
        // =====================================================================

        const xml = buildMAXML(xmlData);

        console.log('✅ [MA-GENERATOR-v1] XML generated successfully');
        console.log('   XML length:', xml.length, 'bytes');
        console.log('   Metaboles types:', typesMetabolon.length);
        console.log('   Epikouriki:', epikourikiSelections.length);
        console.log('   Contract PDF:', contractPdfBase64 ? 'YES' : 'NO');

        // =====================================================================
        // ✅ SAVE XML TO S3
        //    Path: xmls/{team}/{company}/MA/{id_EPONYMO_ONOMA_DATE}.xml
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

            // ✅ MA subfolder (όχι E3N)
            const s3Key = `xmls/${ergazomenos.team}/${companyData.kod}_${companyNameClean}/MA/${filename}`;

            console.log('💾 [MA-GENERATOR-v1] Saving XML to:', s3Key);

            const xmlBuffer = Buffer.from(xml, 'utf-8');
            const uploadResult = await uploadBufferToS3(xmlBuffer, s3Key, 'application/xml');

            console.log(
                '✅ [MA-GENERATOR-v1] XML saved:',
                uploadResult.s3Url || uploadResult.localPath
            );

            return {
                success: true,
                xml: xml,
                s3Key: uploadResult.s3Key,
                s3Url: uploadResult.s3Url || uploadResult.localPath,
                relativePath: uploadResult.s3Key,
                filename: filename
            };
        } catch (saveError) {
            console.error('❌ [MA-GENERATOR-v1] Failed to save XML:', saveError.message);
            return {
                success: true, // XML δημιουργήθηκε αλλά δεν αποθηκεύτηκε
                xml: xml,
                s3Key: null,
                s3Url: null,
                filename: null,
                saveError: saveError.message
            };
        }
    } catch (error) {
        console.error('❌ [MA-GENERATOR-v1] Error:', error.message);
        throw error;
    }
}

// =========================================================================
// ✅ HELPER FUNCTIONS (ίδιες με e3N_v1Generator.js)
// =========================================================================

function formatDateForErganh(date) {
    if (!date) return '';

    // ✅ FIX: YYYY-MM-DD format (από HTML input type="date") → parse χωρίς timezone
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
// ✅ BUILD TypesMetabolon XML section (MA-ONLY)
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
// ✅ BUILD Epikourikes XML section (MA format — διαφορετικό από E3N)
// =========================================================================
function buildEpikourikesXml(selections) {
    if (!selections || selections.length === 0) return '';
    const items = selections
        .map(
            (item) => `
    <EpikourikesMA>
      <f_epikouriki_kod>${escapeXml(item.kodikos)}</f_epikouriki_kod>
    </EpikourikesMA>`
        )
        .join('');
    return `
  <Epikourikes>${items}
  </Epikourikes>`;
}

// =========================================================================
// ✅ BUILD MA XML STRING
// =========================================================================
function buildMAXML(data) {
    const typesMetabolonXml = buildTypesMetabolonXml(data.typesMetabolon);
    const epikourikesXml = buildEpikourikesXml(data.epikourikiSelections);

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
    <f_date_metabolhs>${escapeXml(data.f_date_metabolhs)}</f_date_metabolhs>
    <f_eidos_dieuthethshs>${escapeXml(data.f_eidos_dieuthethshs)}</f_eidos_dieuthethshs>
    <f_eidos_dieuthethshs_comments>${escapeXml(data.f_eidos_dieuthethshs_comments)}</f_eidos_dieuthethshs_comments>
    <f_periodos_anaforas_from>${escapeXml(data.f_periodos_anaforas_from)}</f_periodos_anaforas_from>
    <f_periodos_anaforas_to>${escapeXml(data.f_periodos_anaforas_to)}</f_periodos_anaforas_to>
    <f_eidikothta>${escapeXml(data.f_eidikothta)}</f_eidikothta>
    <f_eidikothta_anal>${escapeXml(data.f_eidikothta_anal)}</f_eidikothta_anal>
    <f_proipiresia>${escapeXml(data.f_proipiresia)}</f_proipiresia>
    <f_apodoxes>${escapeXml(data.f_apodoxes)}</f_apodoxes>
    <f_hour_apodoxes>${escapeXml(data.f_hour_apodoxes)}</f_hour_apodoxes>
    <f_xronos_katabolhs>${escapeXml(data.f_xronos_katabolhs)}</f_xronos_katabolhs>
    <f_topos_ergasias>${escapeXml(data.f_topos_ergasias)}</f_topos_ergasias>
    <f_topos_ergasias_comments>${escapeXml(data.f_topos_ergasias_comments)}</f_topos_ergasias_comments>
    <f_sxeshapasxolisis>${escapeXml(data.f_sxeshapasxolisis)}</f_sxeshapasxolisis>
    <f_orismenou_apo>${escapeXml(data.f_orismenou_apo)}</f_orismenou_apo>
    <f_orismenou_ews>${escapeXml(data.f_orismenou_ews)}</f_orismenou_ews>
    <f_kathestosapasxolisis>${escapeXml(data.f_kathestosapasxolisis)}</f_kathestosapasxolisis>
    <f_xaraktirismos>${escapeXml(data.f_xaraktirismos)}</f_xaraktirismos>
    <f_special_case>${escapeXml(data.f_special_case)}</f_special_case>
    <f_responsible_position>${escapeXml(data.f_responsible_position)}</f_responsible_position>
    <f_efarmostea_sillogiki_simbasi>${escapeXml(data.f_efarmostea_sillogiki_simbasi)}</f_efarmostea_sillogiki_simbasi>
    <f_efarmostea_sillogiki_simbasi_comments>${escapeXml(data.f_efarmostea_sillogiki_simbasi_comments)}</f_efarmostea_sillogiki_simbasi_comments>
    <f_kyria_asfalish>${escapeXml(data.f_kyria_asfalish)}</f_kyria_asfalish>
    <f_prosthetes_asfalistikes_paroxes>${escapeXml(data.f_prosthetes_asfalistikes_paroxes)}</f_prosthetes_asfalistikes_paroxes>
    <f_ipoxreotiki_katartisi>${escapeXml(data.f_ipoxreotiki_katartisi)}</f_ipoxreotiki_katartisi>
    <f_working_time_digital_organization>${escapeXml(data.f_working_time_digital_organization)}</f_working_time_digital_organization>
    <f_mh_problepsimo_programma>${escapeXml(data.f_mh_problepsimo_programma)}</f_mh_problepsimo_programma>
    <f_paraggelia_hmeres_hours>${escapeXml(data.f_paraggelia_hmeres_hours)}</f_paraggelia_hmeres_hours>
    <f_paraggelia_min_notification>${escapeXml(data.f_paraggelia_min_notification)}</f_paraggelia_min_notification>
    <f_paraggelia_notes>${escapeXml(data.f_paraggelia_notes)}</f_paraggelia_notes>
    <f_week_hours>${escapeXml(data.f_week_hours)}</f_week_hours>
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
    <f_epibolh_file>${escapeXml(data.f_epibolh_file)}</f_epibolh_file>
${typesMetabolonXml}
${epikourikesXml}
  </AnaggeliaMA>
</AnaggeliesMA>`;
}

module.exports = { generateMAXML };
