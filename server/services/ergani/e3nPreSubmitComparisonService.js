const mongoose = require('mongoose');

const { CompaniesModel, YpokatasthmataModel } = require('../../models/companies');
const { ErgazomenoiModel } = require('../../models/ergazomenoi');
const { generateE3XML, generateE3NJSON } = require('../../utils/xmlGenerators/e3N_v1Generator');

const EMPTY = '';

const displayMaps = {
    f_sex: {
        1: 'ΓΥΝΑΙΚΑ',
        0: 'ΑΝΤΡΑΣ'
    },
    f_xaraktirismos: {
        1: 'ΥΠΑΛΛΗΛΟΣ',
        0: 'ΕΡΓΑΤΗΣ'
    },
    f_kathestosapasxolisis: {
        0: 'ΠΛΗΡΗΣ',
        1: 'ΜΕΡΙΚΗ',
        2: 'ΕΚ ΠΕΡΙΤΡΟΠΗΣ'
    },
    f_sxeshapasxolisis: {
        0: 'ΑΟΡΙΣΤΟΥ',
        1: 'ΟΡΙΣΜΕΝΟΥ'
    },
    boolean: {
        1: 'ΝΑΙ',
        0: 'ΟΧΙ'
    },
    f_week_days: {
        5: '5ΗΜΕΡΗ',
        6: '6ΗΜΕΡΗ'
    },
    filePresence: {
        1: 'ΥΠΑΡΧΕΙ',
        0: 'ΔΕΝ ΥΠΑΡΧΕΙ'
    }
};

const boolFields = new Set([
    'f_res_permit_inst',
    'f_res_permit_ap',
    'f_res_permit_visa',
    'f_working_time_digital_organization',
    'f_working_card',
    'f_dialeimma_entos_wrariou',
    'f_topothetisioaed',
    'f_replaceprograma',
    'f_trial_period',
    'f_ipoxreotiki_katartisi',
    'f_efarmoste_sillogiki_simbasi',
    'f_mh_provlepsimo_programma',
    'f_topos_ergasias',
    'f_basics_acceptance'
]);

const fileFields = new Set(['f_file', 'f_file_symbash', 'f_foreign_file', 'f_young_file']);

const fieldRegistry = [
    { label: 'Κωδικός υποκαταστήματος', dbPath: 'ypokatasthma.kodikos', xmlPath: 'f_aa_pararthmatos', jsonPath: 'f_aa_pararthmatos' },
    { label: 'Υπηρεσία ΣΕΠΕ', dbPath: 'ypokatasthma.sepe_ergoy', xmlPath: 'f_ypiresia_sepe', jsonPath: 'f_ypiresia_sepe' },
    { label: 'Υπηρεσία ΔΥΠΑ', dbPath: 'ypokatasthma.dypa_ergoy', xmlPath: 'f_ypiresia_oaed', jsonPath: 'f_ypiresia_oaed' },
    { label: 'ΚΑΔ υποκαταστήματος', dbPath: 'company.kad6', xmlPath: 'f_kad_pararthmatos', jsonPath: 'f_kad_pararthmatos', normalize: normalizeKad },
    { label: 'Καλλικράτης υποκαταστήματος', dbPath: 'ypokatasthma.polh', xmlPath: 'f_kallikratis_pararthmatos', jsonPath: 'f_kallikratis_pararthmatos' },

    { label: 'Επώνυμο', dbPath: 'ergazomenos.eponymo', xmlPath: 'f_eponymo', jsonPath: 'f_eponymo', normalize: normalizeUpperText },
    { label: 'Όνομα', dbPath: 'ergazomenos.onoma', xmlPath: 'f_onoma', jsonPath: 'f_onoma', normalize: normalizeUpperText },
    { label: 'Πατρώνυμο', dbPath: 'ergazomenos.patronymo', xmlPath: 'f_onoma_patros', jsonPath: 'f_onoma_patros', normalize: normalizeUpperText },
    { label: 'Μητρώνυμο', dbPath: 'ergazomenos.mhtronymo', xmlPath: 'f_onoma_mitros', jsonPath: 'f_onoma_mitros', normalize: normalizeUpperText },
    { label: 'Ημερομηνία γέννησης', dbPath: 'ergazomenos.hmeromhnia_gennhshs', xmlPath: 'f_birthdate', jsonPath: 'f_birthdate', normalize: normalizeDate },
    { label: 'Φύλο', dbPath: 'ergazomenos.fylo', xmlPath: 'f_sex', jsonPath: 'f_sex', normalize: normalizeBoolean, displayMap: 'f_sex' },
    { label: 'Υπηκοότητα', dbPath: 'ergazomenos.yphkoothta', xmlPath: 'f_yphkoothta', jsonPath: 'f_yphkoothta', normalize: normalizeDigits3 },
    { label: 'Τύπος ταυτότητας', dbPath: 'ergazomenos.typos_taytothtas', xmlPath: 'f_typos_taytothtas', jsonPath: 'f_typos_taytothtas' },
    { label: 'ΑΔΤ/διαβατήριο', dbPath: 'ergazomenos.adt', xmlPath: 'f_ar_taytothtas', jsonPath: 'f_ar_taytothtas' },
    { label: 'Εκδούσα αρχή', dbPath: 'ergazomenos.arxh_ekdoshs', xmlPath: 'f_ekdousa_arxh', jsonPath: 'f_ekdousa_arxh' },
    { label: 'Ημερομηνία έκδοσης', dbPath: 'ergazomenos.hmeromhnia_ekdoshs', xmlPath: 'f_date_ekdosis', jsonPath: 'f_date_ekdosis', normalize: normalizeDate },
    { label: 'Ημερομηνία λήξης', dbPath: 'ergazomenos.hmeromhnia_lhxhs_nomimopoihtikoy_eggrafoy', xmlPath: 'f_date_ekdosis_lixi', jsonPath: 'f_date_ekdosis_lixi', normalize: normalizeDate },
    { label: 'Οικογενειακή κατάσταση', dbPath: 'ergazomenos.oikogeneiakh_katastash', xmlPath: 'f_marital_status', jsonPath: 'f_marital_status' },
    { label: 'Αριθμός τέκνων', dbPath: 'ergazomenos.arithmos_teknon', xmlPath: 'f_arithmos_teknon', jsonPath: 'f_arithmos_teknon', normalize: normalizeInteger },
    { label: 'ΑΦΜ', dbPath: 'ergazomenos.afm', xmlPath: 'f_afm', jsonPath: 'f_afm' },
    { label: 'ΔΟΥ', dbPath: 'ergazomenos.doy', xmlPath: 'f_doy', jsonPath: 'f_doy' },
    { label: 'ΑΜΑ', dbPath: 'ergazomenos.ama_krathshs_01', xmlPath: 'f_amika', jsonPath: 'f_amika' },
    { label: 'ΑΜΚΑ', dbPath: 'ergazomenos.amka', xmlPath: 'f_amka', jsonPath: 'f_amka' },
    { label: 'Αριθμός δελτίου ανεργίας', dbPath: 'ergazomenos.arithmos_deltioy_anergias', xmlPath: 'f_code_anergias', jsonPath: 'f_code_anergias' },
    { label: 'Αριθμός βιβλιαρίου ανηλίκου', dbPath: 'ergazomenos.arithmos_bibliarioy_anhlikoy', xmlPath: 'f_ar_vivliou_anilikou', jsonPath: 'f_ar_vivliou_anilikou' },
    { label: 'Εκπαιδευτικό επίπεδο', dbPath: 'ergazomenos.ekpaideytiko_epipedo', xmlPath: 'f_epipedo_morfosis', jsonPath: 'f_epipedo_morfosis' },

    { label: 'Άδεια διαμονής με άμεση πρόσβαση', dbPath: 'ergazomenos.adeia_diamonhs_me_amesh_prosbash_gia_ergasia', xmlPath: 'f_res_permit_inst', jsonPath: 'f_res_permit_inst', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Είδος άδειας διαμονής με άμεση πρόσβαση', dbPath: 'ergazomenos.eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia', xmlPath: 'f_res_permit_inst_type', jsonPath: 'f_res_permit_inst_type' },
    { label: 'Αριθμός άδειας διαμονής με άμεση πρόσβαση', dbPath: 'ergazomenos.arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia', xmlPath: 'f_res_permit_inst_ar', jsonPath: 'f_res_permit_inst_ar' },
    { label: 'Ημερομηνία λήξης άδειας διαμονής με άμεση πρόσβαση', dbPath: 'ergazomenos.hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia', xmlPath: 'f_res_permit_inst_lixi', jsonPath: 'f_res_permit_inst_lixi', normalize: normalizeDate },
    { label: 'Άδεια διαμονής χωρίς άμεση πρόσβαση', dbPath: 'ergazomenos.adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia', xmlPath: 'f_res_permit_ap', jsonPath: 'f_res_permit_ap', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Είδος άδειας διαμονής χωρίς άμεση πρόσβαση', dbPath: 'ergazomenos.eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia', xmlPath: 'f_res_permit_ap_type', jsonPath: 'f_res_permit_ap_type' },
    { label: 'Αριθμός άδειας διαμονής χωρίς άμεση πρόσβαση', dbPath: 'ergazomenos.arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia', xmlPath: 'f_res_permit_ap_ar', jsonPath: 'f_res_permit_ap_ar' },
    { label: 'Ημερομηνία λήξης άδειας διαμονής χωρίς άμεση πρόσβαση', dbPath: 'ergazomenos.hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia', xmlPath: 'f_res_permit_ap_lixi', jsonPath: 'f_res_permit_ap_lixi', normalize: normalizeDate },
    { label: 'Θεώρηση εισόδου', dbPath: 'ergazomenos.adeia_eisodoy_gia_epoxikh_apasxolhsh', xmlPath: 'f_res_permit_visa', jsonPath: 'f_res_permit_visa', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Αριθμός θεώρησης', dbPath: 'ergazomenos.arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh', xmlPath: 'f_res_permit_visa_ar', jsonPath: 'f_res_permit_visa_ar' },
    { label: 'Διάρκεια θεώρησης από', dbPath: 'ergazomenos.apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh', xmlPath: 'f_res_permit_visa_from', jsonPath: 'f_res_permit_visa_from', normalize: normalizeDate },
    { label: 'Διάρκεια θεώρησης έως', dbPath: 'ergazomenos.eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh', xmlPath: 'f_res_permit_visa_to', jsonPath: 'f_res_permit_visa_to', normalize: normalizeDate },

    { label: 'Ημερομηνία πρόσληψης', dbPath: 'ergazomenos.hmeromhnia_proslhpshs', xmlPath: 'f_proslipsidate', jsonPath: 'f_proslipsidate', normalize: normalizeDate },
    { label: 'Ώρα έναρξης πρώτης ημέρας', dbPath: 'ergazomenos.ora_enarxhs_proths_foras', xmlPath: 'f_proslipsitime', jsonPath: 'f_proslipsitime', normalize: normalizeTime },
    { label: 'Ώρα αποχώρησης πρώτης ημέρας', dbPath: 'ergazomenos.ora_apoxorhshs_proths_foras', xmlPath: 'f_apoxwrisitime', jsonPath: 'f_apoxwrisitime', normalize: normalizeTime },
    { label: 'Ώρες εργασίας εβδομαδιαίως', dbPath: 'ergazomenos.ores_ergasias_ebdomadas', xmlPath: 'f_week_hours', jsonPath: 'f_week_hours', normalize: normalizeNumber },
    { label: 'Κωδικός ειδικότητας', dbPath: 'ergazomenos.eidikothta_erganh', xmlPath: 'f_eidikothta', jsonPath: 'f_eidikothta' },
    { label: 'Ειδικότητα αναλυτικά', dbPath: 'ergazomenos.antikeimeno_ergasion', xmlPath: 'f_eidikothta_anal', jsonPath: 'f_eidikothta_anal' },
    { label: 'Προϋπηρεσία', dbPath: 'ergazomenos.proyphresia_se_eth', xmlPath: 'f_proipiresia', jsonPath: 'f_proipiresia', normalize: normalizeNumber },
    { label: 'Σύνολο μεικτών αποδοχών', dbPaths: ['ergazomenos.pragmatikosMisthos', 'ergazomenos.synolo_symbashs'], xmlPath: 'f_apodoxes', jsonPath: 'f_apodoxes', normalize: normalizeCurrency2Decimals },
    { label: 'Ωρομίσθιο', dbPath: 'ergazomenos.pragmatikoOromisthio', xmlPath: 'f_hour_apodoxes', jsonPath: 'f_hour_apodoxes', normalize: normalizeCurrency2Decimals },
    { label: 'Σχέση εργασίας', dbPath: 'ergazomenos.sxesh_ergasias', xmlPath: 'f_sxeshapasxolisis', jsonPath: 'f_sxeshapasxolisis', displayMap: 'f_sxeshapasxolisis' },
    { label: 'Από ημερομηνία', dbPath: 'ergazomenos.hmeromhnia_proslhpshs', xmlPath: 'f_orismenou_apo', jsonPath: 'f_orismenou_apo', normalize: normalizeDate, dbWhen: ({ ergazomenos }) => normalizeCommon(ergazomenos.sxesh_ergasias) === '1' },
    { label: 'Έως ημερομηνία', dbPath: 'ergazomenos.hmeromhnia_lhxhs_symbashs', xmlPath: 'f_orismenou_ews', jsonPath: 'f_orismenou_ews', normalize: normalizeDate, dbWhen: ({ ergazomenos }) => normalizeCommon(ergazomenos.sxesh_ergasias) === '1' },
    { label: 'Καθεστώς απασχόλησης', dbPath: 'ergazomenos.kathestos_apasxolhshs', xmlPath: 'f_kathestosapasxolisis', jsonPath: 'f_kathestosapasxolisis', displayMap: 'f_kathestosapasxolisis' },
    { label: 'Χαρακτηρισμός εργαζόμενου ΕΡΓΑΤΗΣ/ΥΠΑΛΛΗΛΟΣ', dbPath: 'ergazomenos.xarakthrismos_ergazomenon', xmlPath: 'f_xaraktirismos', jsonPath: 'f_xaraktirismos', normalize: normalizeBoolean, displayMap: 'f_xaraktirismos' },
    { label: 'Ειδική περίπτωση', dbPath: 'ergazomenos.eidikh_periptosh', xmlPath: 'f_special_case', jsonPath: 'f_special_case' },
    { label: 'Θέση εποπτείας/διεύθυνσης/εμπιστοσύνης', dbPath: 'ergazomenos.thesh_eythynhs', xmlPath: 'f_responsible_position', jsonPath: 'f_responsible_position' },

    { label: 'Ψηφιακό ωράριο', dbPath: 'ergazomenos.pshfiakh_organosh', xmlPath: 'f_working_time_digital_organization', jsonPath: 'f_working_time_digital_organization', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Συμβατικές εβδομαδιαίες ώρες πλήρους απασχόλησης', dbPath: 'ergazomenos.symbatikes_ores_ergasias', xmlPath: 'f_full_employment_hours', jsonPath: 'f_full_employment_hours', normalize: normalizeNumber },
    { label: 'Εβδομαδιαία απασχόληση 5ήμερη/6ήμερη', dbPath: 'ergazomenos.apasxolhsh_basei_symbashs', xmlPath: 'f_week_days', jsonPath: 'f_week_days', normalize: normalizeInteger, displayMap: 'f_week_days' },
    { label: 'Ευέλικτο ωράριο λεπτά', dbPath: 'ergazomenos.evelikth_proselefsh', xmlPath: 'f_euelikto_wrario_minutes', jsonPath: 'f_euelikto_wrario_minutes', normalize: normalizeInteger },
    { label: 'Κάρτα εργασίας', dbPath: 'ergazomenos.karta_ergasias', xmlPath: 'f_working_card', jsonPath: 'f_working_card', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Διάλειμμα λεπτά', dbPath: 'ergazomenos.dialleima_se_lepta', xmlPath: 'f_dialeimma_minutes', jsonPath: 'f_dialeimma_minutes', normalize: normalizeInteger },
    { label: 'Χρονική τοποθέτηση διαλείμματος εντός/εκτός ωραρίου', dbPath: 'ergazomenos.dialleima_entos_ektos_orarioy', xmlPath: 'f_dialeimma_entos_wrariou', jsonPath: 'f_dialeimma_entos_wrariou', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Τοποθέτηση με πρόγραμμα απασχόλησης', dbPath: 'ergazomenos.topothethsh_me_programma', xmlPath: 'f_topothetisioaed', jsonPath: 'f_topothetisioaed', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Πρόγραμμα απασχόλησης', dbPath: 'ergazomenos.programma_dypa', xmlPath: 'f_programaoaed', jsonPath: 'f_programaoaed' },
    { label: 'Αντικατάσταση ωφελούμενου', dbPath: 'ergazomenos.antikatastash_ergazomenoy', xmlPath: 'f_replaceprograma', jsonPath: 'f_replaceprograma', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'ΑΦΜ αντικατάστασης ωφελούμενου', dbPath: 'ergazomenos.afm_antikatastath', xmlPath: 'f_replaceprograma_afm', jsonPath: 'f_replaceprograma_afm' },
    { label: 'ΑΜΚΑ αντικατάστασης ωφελούμενου', dbPath: 'ergazomenos.amka_antikatastath', xmlPath: 'f_replaceprograma_amka', jsonPath: 'f_replaceprograma_amka' },
    { label: 'Δοκιμαστική περίοδος', dbPath: 'ergazomenos.afora_dokimastikh_periodo', xmlPath: 'f_trial_period', jsonPath: 'f_trial_period', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Όροι δοκιμαστικής περιόδου / ημερομηνία λήξης', dbPath: 'ergazomenos.hmnia_lhxhs_dokimastikhs_periodoy', xmlPath: 'f_trial_date_to', jsonPath: 'f_trial_date_to', normalize: normalizeDate },
    { label: 'Αποδοχή ουσιωδών όρων', dbPath: 'ergazomenos.oysiodeis_oroi', xmlPath: 'f_basics_acceptance', jsonPath: 'f_basics_acceptance', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Αρχείο όρων', dbPath: null, xmlPath: 'f_file', jsonPath: 'f_file', normalize: normalizeFilePresence, displayMap: 'filePresence' },
    { label: 'Αρχείο σύμβασης', dbPath: 'ergazomenos.arxeio_apodoxhs_oron_atomikhs_symbashs_path', xmlPath: 'f_file_symbash', jsonPath: 'f_file_symbash', normalize: normalizeFilePresence, displayMap: 'filePresence', dbWhen: ({ ergazomenos }) => normalizeCommon(ergazomenos.oysiodeis_oroi) === '0' },
    { label: 'Παρατηρήσεις', dbPath: 'ergazomenos.parathrhseis', xmlPath: 'f_comments', jsonPath: 'f_comments' },
    { label: 'Αρχείο νομιμοποιητικών εγγράφων', dbPath: 'ergazomenos.arxeio_nomimopoihtikon_eggrafon_path', xmlPath: 'f_foreign_file', jsonPath: 'f_foreign_file', normalize: normalizeFilePresence, displayMap: 'filePresence' },
    { label: 'Αρχείο εγγράφων ανηλίκου', dbPath: 'ergazomenos.bibliario_anhlikoy_path', xmlPath: 'f_young_file', jsonPath: 'f_young_file', normalize: normalizeFilePresence, displayMap: 'filePresence' },
    { label: 'Χρόνος καταβολής αποδοχών', dbPath: 'ergazomenos.xronos_katabolhs_apodoxon', xmlPath: 'f_xronos_katavolis_apodoxon', jsonPath: 'f_xronos_katavolis_apodoxon' },
    { label: 'Υποχρεωτική κατάρτιση', dbPath: 'ergazomenos.ypoxreotikh_ek_toy_nomoy_katartish', xmlPath: 'f_ipoxreotiki_katartisi', jsonPath: 'f_ipoxreotiki_katartisi', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Εφαρμοστέα ΣΣΕ', dbPath: 'ergazomenos.efarmostea_sse', xmlPath: 'f_efarmoste_sillogiki_simbasi', jsonPath: 'f_efarmoste_sillogiki_simbasi', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Παρατηρήσεις ΣΣΕ', dbPath: 'ergazomenos.efarmostea_sse_parathrhseis', xmlPath: 'f_efarmoste_sillogiki_simbasi_comments', jsonPath: 'f_efarmoste_sillogiki_simbasi_comments' },
    { label: 'Κύρια ασφάλιση', dbPath: 'ergazomenos.foreas_kyrias_asfalishs', xmlPath: 'f_kyria_asfalisi', jsonPath: 'f_kyria_asfalisi' },
    { label: 'Επικουρική ασφάλιση', dbPath: 'ergazomenos.foreas_epikoyrikhs_asfalishs', xmlPath: 'EpikourikiSelections.EpikourikiSelectionsE3N', jsonPath: 'EpikourikiSelections.EpikourikiSelectionsE3N', normalize: normalizeEpikouriki, display: displayEpikouriki },
    { label: 'Πρόσθετες ασφαλιστικές παροχές', dbPath: 'ergazomenos.prosthetes_asfalistikes_apodoxes', xmlPath: 'f_prosthetes_asfalistikes', jsonPath: 'f_prosthetes_asfalistikes' },
    { label: 'Μη προβλέψιμο πρόγραμμα', dbPath: 'ergazomenos.mh_problepsimo_programma', xmlPath: 'f_mh_provlepsimo_programma', jsonPath: 'f_mh_provlepsimo_programma', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Ημέρες/ώρες αναφοράς μη προβλέψιμου', dbPath: 'ergazomenos.hmeres_ores_anaforas', xmlPath: 'f_paraggelia_hmeres_hours', jsonPath: 'f_paraggelia_hmeres_hours' },
    { label: 'Ελάχιστη ειδοποίηση πριν την ανάθεση', dbPath: 'ergazomenos.eidopoihsh_prin_thn_anathesh', xmlPath: 'f_paraggelia_min_notification', jsonPath: 'f_paraggelia_min_notification' },
    { label: 'Όροι καταγγελίας / ακύρωσης ανάθεσης', dbPath: 'ergazomenos.prothesmia_akyroshs_ths_anatheshs', xmlPath: 'f_paraggelia_notes', jsonPath: 'f_paraggelia_notes' },
    { label: 'Τόπος εργασίας', dbPath: 'ergazomenos.topos_ergasias', xmlPath: 'f_topos_ergasias', jsonPath: 'f_topos_ergasias', normalize: normalizeBoolean, displayMap: 'boolean' },
    { label: 'Παρατηρήσεις τόπου εργασίας', dbPath: 'ergazomenos.topos_ergasias_parathrhseis', xmlPath: 'f_topos_ergasias_comment', jsonPath: 'f_topos_ergasias_comment', dbWhen: ({ ergazomenos }) => normalizeBoolean(ergazomenos.topos_ergasias) === '1' }
];

async function compareE3NPreSubmit({ sessionTeam, companyId, body = {} }) {
    if (!sessionTeam || !companyId) {
        const err = new Error('Δεν υπάρχει ενεργή ομάδα ή επιλεγμένη εταιρεία στο session.');
        err.status = 400;
        throw err;
    }

    const ergazomenosId = body.ergazomenosId || body.employeeId || body.id || body.kodikos || '';

    if (!ergazomenosId) {
        const err = new Error('Λείπει ο εργαζόμενος για τον έλεγχο Ε3Ν.');
        err.status = 400;
        throw err;
    }

    const { ergazomenos, companyData, ypokatasthmataData } = await loadE3NContext({
        sessionTeam,
        companyId,
        ergazomenosId,
        body
    });

    const [xmlResult, jsonResult] = await Promise.all([
        generateE3XML(ergazomenos, companyData, ypokatasthmataData, { skipSave: true }),
        generateE3NJSON(ergazomenos, companyData, ypokatasthmataData)
    ]);

    const xmlFields = extractXmlFields(xmlResult?.xml || '');
    const jsonPayload = jsonResult?.payload || jsonResult?.json || jsonResult || {};
    const jsonFields = jsonPayload?.AnaggeliesE3N?.AnaggeliaE3N?.[0] || {};

    const context = {
        ergazomenos,
        company: companyData,
        ypokatasthma: ypokatasthmataData
    };

    const differences = [];
    const warnings = [];

    for (const field of fieldRegistry) {
        const hasDbSource = hasDbComparison(field, context);
        const dbRaw = hasDbSource ? getDbRaw(context, field) : undefined;
        const xmlRaw = getPath(xmlFields, field.xmlPath);
        const jsonRaw = getPath(jsonFields, field.jsonPath);

        const normalize = field.normalize || inferNormalizer(field);
        const dbValue = hasDbSource ? normalize(dbRaw) : undefined;
        const xmlValue = normalize(xmlRaw);
        const jsonValue = normalize(jsonRaw);

        if (xmlRaw === undefined && jsonRaw !== undefined) {
            warnings.push(buildPresenceWarning(field, 'Υπάρχει μόνο στο REST JSON', jsonValue));
            continue;
        }

        if (xmlRaw !== undefined && jsonRaw === undefined) {
            warnings.push(buildPresenceWarning(field, 'Υπάρχει μόνο στο XML', xmlValue));
            continue;
        }

        const comparableValues = [
            hasDbSource ? dbValue : undefined,
            xmlRaw !== undefined ? xmlValue : undefined,
            jsonRaw !== undefined ? jsonValue : undefined
        ].filter((value) => value !== undefined);

        if (new Set(comparableValues).size <= 1) continue;

        differences.push({
            label: field.label,
            dbValue: hasDbSource ? rawForResponse(dbValue) : undefined,
            xmlValue: rawForResponse(xmlValue),
            jsonValue: rawForResponse(jsonValue),
            dbDisplay: hasDbSource ? displayValue(field, dbValue) : undefined,
            xmlDisplay: displayValue(field, xmlValue),
            jsonDisplay: displayValue(field, jsonValue),
            severity: 'warning'
        });
    }

    return {
        success: true,
        hasDifferences: differences.length > 0,
        differences,
        warnings,
        canProceed: true
    };
}

async function loadE3NContext({ sessionTeam, companyId, ergazomenosId, body }) {
    const employeeQuery = {
        team: sessionTeam,
        company_kod: companyId
    };

    if (mongoose.Types.ObjectId.isValid(String(ergazomenosId))) {
        employeeQuery._id = ergazomenosId;
    } else {
        employeeQuery.kodikos = String(ergazomenosId).trim();
    }

    const ergazomenos = await ErgazomenoiModel.findOne(employeeQuery).lean();

    if (!ergazomenos) {
        const err = new Error('Δεν βρέθηκε ο εργαζόμενος για τον έλεγχο Ε3Ν.');
        err.status = 404;
        throw err;
    }

    let companyData = null;

    if (mongoose.Types.ObjectId.isValid(String(companyId))) {
        companyData = await CompaniesModel.findById(companyId).lean();
    }

    if (!companyData) {
        companyData = await CompaniesModel.findOne({ kod: companyId }).lean();
    }

    if (!companyData) {
        companyData = await CompaniesModel.findOne({ kodikos: companyId }).lean();
    }

    if (!companyData) {
        const err = new Error('Δεν βρέθηκαν τα στοιχεία της εταιρείας.');
        err.status = 404;
        throw err;
    }

    const selectedYpokatasthma =
        body.ypokatasthma ||
        body.ypokatasthmata ||
        body.ypokatasthmata_stathera ||
        ergazomenos.ypokatasthma ||
        ergazomenos.ypokatasthma_kodikos ||
        '0';

    let ypokatasthmataData = await YpokatasthmataModel.findOne({
        companykod_object: companyId,
        kodikos: String(selectedYpokatasthma)
    }).lean();

    if (!ypokatasthmataData) {
        ypokatasthmataData = await YpokatasthmataModel.findOne({
            company: companyData.kod || companyData.kodikos || companyId,
            kodikos: String(selectedYpokatasthma)
        }).lean();
    }

    if (!ypokatasthmataData) {
        const err = new Error(`Δεν βρέθηκε το υποκατάστημα ${selectedYpokatasthma}.`);
        err.status = 404;
        throw err;
    }

    return { ergazomenos, companyData, ypokatasthmataData };
}

function extractXmlFields(xml) {
    const fields = {};
    const tagRe = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let match;

    while ((match = tagRe.exec(xml)) !== null) {
        const [, tag, value] = match;

        if (tag === 'EpikourikiSelectionsE3N') {
            const code = extractFirstTag(value, 'f_kod_epikourikis');
            if (!fields.EpikourikiSelections) {
                fields.EpikourikiSelections = { EpikourikiSelectionsE3N: [] };
            }
            fields.EpikourikiSelections.EpikourikiSelectionsE3N.push({
                f_kod_epikourikis: decodeXml(code)
            });
            continue;
        }

        if (!fields[tag]) {
            fields[tag] = decodeXml(value);
        }
    }

    return fields;
}

function extractFirstTag(xml, tag) {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
    const match = xml.match(re);
    return match ? match[1] : '';
}

function decodeXml(value) {
    return String(value ?? '')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');
}

function getPath(obj, path) {
    if (!path) return undefined;
    return String(path)
        .split('.')
        .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), obj);
}

function hasDbComparison(field, context) {
    const hasSource = !!field.dbPath || Array.isArray(field.dbPaths);
    if (!hasSource) return false;
    return typeof field.dbWhen === 'function' ? field.dbWhen(context) === true : true;
}

function getDbRaw(context, field) {
    if (Array.isArray(field.dbPaths)) {
        for (const path of field.dbPaths) {
            const value = getPath(context, path);
            if (normalizeCommon(value) !== EMPTY) return value;
        }
        return undefined;
    }

    return getPath(context, field.dbPath);
}

function inferNormalizer(field) {
    if (fileFields.has(field.xmlPath) || fileFields.has(field.jsonPath)) return normalizeFilePresence;
    if (boolFields.has(field.xmlPath) || boolFields.has(field.jsonPath)) return normalizeBoolean;
    return normalizeCommon;
}

function normalizeCommon(value) {
    if (value === null || value === undefined) return EMPTY;
    return String(value).trim().replace(/\s+/g, ' ');
}

function normalizeUpperText(value) {
    return normalizeCommon(value).toLocaleUpperCase('el-GR');
}

function normalizeDate(value) {
    if (value === null || value === undefined || value === '') return EMPTY;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDateParts(value);

    const s = normalizeCommon(value);
    const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;

    const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) return `${ymd[3].padStart(2, '0')}/${ymd[2].padStart(2, '0')}/${ymd[1]}`;

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : formatDateParts(d);
}

function formatDateParts(d) {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function normalizeTime(value) {
    const s = normalizeCommon(value);
    if (!s) return EMPTY;
    const match = s.match(/^(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : s;
}

function normalizeNumber(value) {
    const s = normalizeCommon(value);
    if (!s) return EMPTY;
    const normalized = normalizeNumericString(s);
    const n = Number(normalized);
    return Number.isFinite(n) ? String(n) : s;
}

function normalizeCurrency2Decimals(value) {
    if (value === null || value === undefined) return EMPTY;

    const normalized = normalizeCurrencyNumericString(value);
    if (!normalized) return EMPTY;

    const n = Number(normalized);
    return Number.isFinite(n) ? n.toFixed(2) : normalizeCommon(value);
}

function normalizeCurrencyNumericString(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : EMPTY;

    const s = normalizeCommon(value).replace(/\s/g, '');
    if (!s) return EMPTY;

    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');

    if (lastDot !== -1 && lastComma !== -1) {
        return lastDot > lastComma
            ? s.replace(/,/g, '')
            : s.replace(/\./g, '').replace(',', '.');
    }

    if (lastComma !== -1) {
        return s.replace(',', '.');
    }

    return s;
}

function normalizeNumericString(value) {
    const s = normalizeCommon(value);
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');

    if (lastDot !== -1 && lastComma !== -1) {
        return lastDot > lastComma
            ? s.replace(/,/g, '')
            : s.replace(/\./g, '').replace(',', '.');
    }

    if (lastComma !== -1) {
        const decimals = s.length - lastComma - 1;
        return decimals >= 1 && decimals <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
    }

    if (lastDot !== -1) {
        const decimals = s.length - lastDot - 1;
        return decimals >= 1 && decimals <= 2 ? s : s.replace(/\./g, '');
    }

    return s;
}

function normalizeInteger(value) {
    const n = Number(normalizeNumber(value));
    return Number.isFinite(n) ? String(Math.trunc(n)) : normalizeCommon(value);
}

function normalizeBoolean(value) {
    const s = normalizeCommon(value).toLocaleLowerCase('el-GR');
    if (['1', 'true', 'yes', 'y', 'ναι', 'nai'].includes(s)) return '1';
    if (['0', 'false', 'no', 'n', 'όχι', 'οχι', 'oxi', ''].includes(s)) return '0';
    return s;
}

function normalizeDigits3(value) {
    const digits = normalizeCommon(value).replace(/\D/g, '');
    return digits ? digits.slice(-3).padStart(3, '0') : EMPTY;
}

function normalizeKad(value) {
    const s = normalizeCommon(value);
    return s ? s.split('.').slice(0, 2).join('') : EMPTY;
}

function normalizeFilePresence(value) {
    return value ? '1' : '0';
}

function normalizeEpikouriki(value) {
    let items = value;

    if (typeof value === 'string') {
        try {
            items = value.trim() ? JSON.parse(value) : [];
        } catch {
            items = [];
        }
    }

    if (!Array.isArray(items)) return EMPTY;

    return items
        .map((item) => {
            if (!item) return '';
            const code = typeof item === 'object' ? item.f_kod_epikourikis || item.kodikos || item.value : item;
            return normalizeCommon(code).padStart(3, '0');
        })
        .filter((code) => code && code !== '000')
        .sort()
        .join(',');
}

function displayEpikouriki(value) {
    return value || EMPTY;
}

function displayValue(field, value) {
    if (typeof field.display === 'function') return field.display(value);
    if (!field.displayMap) return rawForResponse(value);

    const map = displayMaps[field.displayMap] || {};
    return map[value] || rawForResponse(value);
}

function rawForResponse(value) {
    if (value === undefined || value === null) return EMPTY;
    return String(value);
}

function buildPresenceWarning(field, message, value) {
    return {
        label: field.label,
        message,
        value: displayValue(field, value),
        severity: 'warning'
    };
}

module.exports = {
    compareE3NPreSubmit,
    fieldRegistry,
    normalizeCommon,
    normalizeDate,
    normalizeTime,
    normalizeNumber,
    normalizeCurrency2Decimals,
    normalizeBoolean
};
