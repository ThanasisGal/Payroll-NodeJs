let _HMERES_EBDOMADIASIAS_ERGASIAS,
    _PROYPHRESIA_ADEIAS,
    _HMEROMHNIA_ARXHS_HMEROLOGIAKOY_ETOYS_ADEIAS,
    _HMEROMHNIA_TELOYS_HMEROLOGIAKOY_ETOYS_ADEIAS, 
    _HMEROMHNIA_ARXHS_EPOMENOY_HMEROLOGIAKOY_ETOYS_ADEIAS,
    _HMEROMHNIA_TELOYS_EPOMENOY_HMEROLOGIAKOY_ETOYS_ADEIAS,
    _HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS_ADEIAS,
    _HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS_ADEIAS, 
    _HMEROMHNIA_ARXHS_EPOMENOY_ERGASIAKOY_ETOYS_ADEIAS,
    _HMEROMHNIA_TELOYS_EPOMENOY_ERGASIAKOY_ETOYS_ADEIAS,
    // _HMEROMHNIA_APOXORHSHS,
    _HMEROMHNIES_REPO_ADEIAS, 
    _HMEROMHNIES_ARGION_ADEIAS,
    _ADEIA,
    _REPO_ADEIAS;


let hmeromhnia_arxhs_ergasiakoy_etoys_adeias, 
    hmeromhnia_teloys_ergasiakoy_etoys_adeias, 
    hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys_adeias, 
    hmeromhnia_teloys_epomenoy_ergasiakoy_etoys_adeias;

let hmeromhnia_arxhs_hmerologiakoy_etoys_adeias, 
    hmeromhnia_teloys_hmerologiakoy_etoys_adeias, 
    hmeromhnia_arxhs_epomenoy_hmerologiakoy_etoys_adeias, 
    hmeromhnia_teloys_epomenoy_hmerologiakoy_etoys_adeias;

let _HMERES_APASXOLHSHS_ADEIAS = 0,
    _HMERES_DIKAIOYMENHS_ADEIAS = 0,
    _DIAFORA_HMERON = 0,
    _ETH_ADEIAS = 0,
    _ARGIES_ADEIAS = 0,
    _MESO_HMEROMISTHIO = 0, 
    _SYNOLO_APODOXON_TREXOYSAS_PERIODOY = 0;

let _DISEKTO;    //Boolean

let diasthma_hmeron_adeias = {};
let hmeres_Repo_Adeias = {};
let hmeromhnies_Repo_Adeias = {};
let hmeres_Argion_Adeias = {};
let hmeromhnies_Argion_Adeias = {};

let lhfteisa_adeia_prohgoymenon_mhnon,
    lhfteisa_adeia_prohgoymenon_mhnon_timh,
    ypoloipo_adeias_trexontos_etoys,
    ypoloipo_adeias_trexontos_etoys_timh,
    ypoloipo_adeias,
    ypoloipo_adeias_timh,
    totalDays,
    old_hmeres_adeias,
    hmeres_adeias,
    _diasthma_hmeron_adeias,
    _repo,
    _argies,
    _astheneies,
    _koines_hmeres;
    
let dates = {};

const numOfArrays = 6;  // Αριθμός πινάκων.  Βάζω 6 γιατί ξενινάμε από το 1 και όχι από το 0.
const arraySize   = 6;  // Μέγεθος κάθε πίνακα

// Δημιουργία ν+1 πινάκων με 5 στοιχεία το καθένα, αρχικοποιημένα σε 0
const arrays = Array.from({ length: numOfArrays }, () => Array(arraySize).fill(0));

const periodos = document.getElementById("periodos");

const dikaioymenh_adeia = document.getElementById("dikaioymenh_adeia");
const dikaioymenh_adeia_timh = document.getElementById("dikaioymenh_adeia_timh");
const meion_repo = document.getElementById("meion_repo");
const meion_argies = document.getElementById("meion_argies");
const meion_astheneies = document.getElementById("meion_astheneies");
const anapaysh_repo_adeias = document.getElementById("repo_adeias");
const anapaysh_repo_adeias_timh = document.getElementById("repo_adeias_timh");
const anapaysh_repo_adeias_hmeromhnies = document.getElementById("repo_adeias_hmeromhnies");
const argies_adeias = document.getElementById("argies_adeias");
const argies_adeias_timh = document.getElementById("argies_adeias_timh");
const argies_adeias_hmeromhnies = document.getElementById("argies_adeias_hmeromhnies");
const astheneies_adeias = document.getElementById("astheneies_adeias");
const astheneies_adeias_timh = document.getElementById("astheneies_adeias_timh");
const astheneies_adeias_hmeromhnies = document.getElementById("astheneies_adeias_hmeromhnies");
const synolo_hmeron_adeias = document.getElementById("synolo_hmeron_adeias");
const syn_koines_hmeres = document.getElementById("syn_koines_hmeres");
const koines_hmeres_repo_argion_astheneion_adeias = document.getElementById("koines_hmeres_repo_argion_astheneion_adeias");
const koines_hmeres_repo_argion_astheneion_adeias_timh = document.getElementById("koines_hmeres_repo_argion_astheneion_adeias_timh");
const koines_hmeres_repo_argion_astheneion_adeias_hmeromhnies = document.getElementById("koines_hmeres_repo_argion_astheneion_adeias_hmeromhnies");

// =======================================================================================================
// DOMContentLoaded
// =======================================================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Μόλις φορτώσουν τα sharedParams
    document.addEventListener('sharedParamsReady', async () => {
        const sharedParams = window.sharedParams;
        _KODIKOS_ETAIREIAS = sharedParams._KODIKOS_ETAIREIAS;
        _ID_ETAIREIAS = sharedParams.ergazomenoi.company_kod;
        _KODIKOS_ERGAZOMENOY = sharedParams.ergazomenoi.kodikos;
        _HMEROMHNIA_PROSLHPSHS = sharedParams.ergazomenoi.hmeromhnia_proslhpshs;
        _HMEROMHNIA_APOXORHSHS = sharedParams.ergazomenoi.hmeromhnia_apoxorhshs;
        _HMERES_EBDOMADIASIAS_ERGASIAS = sharedParams.ergazomenoi.hmeres_ergasias_ebdomadas;
        _PROYPHRESIA_ADEIAS = parseInt(sharedParams.ergazomenoi.proyphresia_adeias_se_eth);
        _ETOS_XRHSHS = sharedParams._XRHSH;
        _TYPOS_ERGAZOMENOY = sharedParams.ergazomenoi.typos_ergazomenon;

        for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[52].timh); i++) {
            diasthma_hmeron_adeias[`_HMERES_ADEIAS_0${i}`] = 0;
            hmeres_Repo_Adeias[`_HMERES_REPO_ADEIAS_0${i}`] = 0;
            hmeromhnies_Repo_Adeias[`_HMEROMHNIES_REPO_ADEIAS_0${i}`] = null;
            hmeres_Argion_Adeias[`_HMERES_ARGION_ADEIAS_0${i}`] = 0;
            hmeromhnies_Argion_Adeias[`_HMEROMHNIES_ARGION_ADEIAS_0${i}`] = null;
        }

        for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[52].timh); i++) {
            const rowString = i < 10 ? `0${i}` : String(i);
            await attachRowListeners_Adeias(rowString);
        }
    });

    // click ΣΤΟ tab Ασθένεια, ΥΠΟΛΟΓΙΖΟΥΜΕ ΤΑ ΕΡΓΑΣΙΑΚΑ ΕΤΗ (ΤΡΕΧΟΝ ΚΑΙ ΕΠΟΜΕΝΟ) ΚΑΙ ΕΥΡΕΣΗ ΠΡΟΗΓΟΥΜΕΝΩΝ ΑΣΘΕΝΕΙΩΝ
    const adeies = document.querySelector('.adeies'); 
    if (adeies) {
        adeies.addEventListener('click', async () => {
            const currentYear = parseInt(document.getElementById("etos").value);
            const nextYear = currentYear + 1;
            const hmeromhnia_proslhpshs = _HMEROMHNIA_PROSLHPSHS;
            const hmeromhnia_apoxorhshs = _HMEROMHNIA_APOXORHSHS;

            // 2) Φορτώνουμε τις κατηγορίες των αδειών και γεμίζουμε τα select
            const data = await fetch("/api/kinhseis/kathgories_adeion");
            const result = await data.json();
        
            for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[52].timh); i++) {
                const eidosAdeiasDropdown = document.getElementById(`eidos_adeias_0${i}`);

                // Δημιουργία της αρχικής επιλογής
                eidosAdeiasDropdown.innerHTML = '<option value="" selected></option>';
        
                for (const eidos_adeias of result) {
                    const textToConvert = removeGreekAccentsAndToUpper(eidos_adeias.perigrafh);
                    const option = new Option(
                        eidos_adeias.kodikos.padEnd(10, '\u00A0') + textToConvert,
                        eidos_adeias.kodikos
                    );
        
                    // Προσθήκη δεδομένων στο option
                    Object.assign(option.dataset, {
                        prosmetratai_stis_dikaioymenes_hmeres: eidos_adeias.prosmetratai_stis_dikaioymenes_hmeres || false,
                    });
                    eidosAdeiasDropdown.appendChild(option);
                }
            }
        
            const workYearDates = calculateWorkYearDates(hmeromhnia_proslhpshs, hmeromhnia_apoxorhshs, currentYear, nextYear);
            // const periodos = document.getElementById("periodos");

            _HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS_ADEIAS = workYearDates.startWorkYear;
            _HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS_ADEIAS = workYearDates.endWorkYear;
            _HMEROMHNIA_ARXHS_EPOMENOY_ERGASIAKOY_ETOYS_ADEIAS = workYearDates.startWorkNextYear;
            _HMEROMHNIA_TELOYS_EPOMENOY_ERGASIAKOY_ETOYS_ADEIAS = workYearDates.endWorkNextYear;

            _HMEROMHNIA_ARXHS_HMEROLOGIAKOY_ETOYS_ADEIAS = workYearDates.arxh_hmerologiakoy_etoys;
            _HMEROMHNIA_TELOYS_HMEROLOGIAKOY_ETOYS_ADEIAS = workYearDates.telos_hmerologiakoy_etoys; 
            _HMEROMHNIA_ARXHS_EPOMENOY_HMEROLOGIAKOY_ETOYS_ADEIAS = workYearDates.arxh_epomenoy_hmerologiakoy_etoys; 
            _HMEROMHNIA_TELOYS_EPOMENOY_HMEROLOGIAKOY_ETOYS_ADEIAS = workYearDates.telos_epomenoy_hmerologiakoy_etoys;
        
            hmeromhnia_arxhs_ergasiakoy_etoys_adeias = formatDate(_HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS_ADEIAS);
            hmeromhnia_teloys_ergasiakoy_etoys_adeias = formatDate(_HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS_ADEIAS);
            hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys_adeias = formatDate(_HMEROMHNIA_ARXHS_EPOMENOY_ERGASIAKOY_ETOYS_ADEIAS);
            hmeromhnia_teloys_epomenoy_ergasiakoy_etoys_adeias = formatDate(_HMEROMHNIA_TELOYS_EPOMENOY_ERGASIAKOY_ETOYS_ADEIAS);

            hmeromhnia_arxhs_hmerologiakoy_etoys_adeias = formatDate(_HMEROMHNIA_ARXHS_HMEROLOGIAKOY_ETOYS_ADEIAS);
            hmeromhnia_teloys_hmerologiakoy_etoys_adeias = formatDate(_HMEROMHNIA_TELOYS_HMEROLOGIAKOY_ETOYS_ADEIAS);
            hmeromhnia_arxhs_epomenoy_hmerologiakoy_etoys_adeias = formatDate(_HMEROMHNIA_ARXHS_EPOMENOY_HMEROLOGIAKOY_ETOYS_ADEIAS);
            hmeromhnia_teloys_epomenoy_hmerologiakoy_etoys_adeias = formatDate(_HMEROMHNIA_TELOYS_EPOMENOY_HMEROLOGIAKOY_ETOYS_ADEIAS);

            const hmerologiako_etos_adeias = document.getElementById("hmerologiako_etos_adeias");
            const epomeno_hmerologiako_etos_adeias = document.getElementById("epomeno_hmerologiako_etos_adeias");
            const ergasiako_etos_adeias = document.getElementById("ergasiako_etos_adeias");

            hmerologiako_etos_adeias.innerHTML = `<b>Τρέχον</b> Ημερολογιακό έτος: ${twoSpaces} Από ${hmeromhnia_arxhs_hmerologiakoy_etoys_adeias} Έως ${hmeromhnia_teloys_hmerologiakoy_etoys_adeias}`
            document.getElementById("hmerologiakoEtosAdeias").value = `Από ${hmeromhnia_arxhs_hmerologiakoy_etoys_adeias} Έως ${hmeromhnia_teloys_hmerologiakoy_etoys_adeias}`

            epomeno_hmerologiako_etos_adeias.innerHTML = `<b>Επόμενο</b> Ημερολογιακό έτος: ${twoSpaces} Από ${hmeromhnia_arxhs_epomenoy_hmerologiakoy_etoys_adeias} Έως ${hmeromhnia_teloys_epomenoy_hmerologiakoy_etoys_adeias}`
            document.getElementById("epomenoHmerologiakoEtosAdeias").value = `Από ${hmeromhnia_arxhs_epomenoy_hmerologiakoy_etoys_adeias} Έως ${hmeromhnia_teloys_epomenoy_hmerologiakoy_etoys_adeias}`

            ergasiako_etos_adeias.innerHTML = `<b>Τρέχον</b> Εργασιακό έτος: ${twoSpaces} Από ${hmeromhnia_arxhs_ergasiakoy_etoys_adeias} Έως ${hmeromhnia_teloys_ergasiakoy_etoys_adeias}`
            document.getElementById("ergasiakoEtosAdeias").value = `Από ${hmeromhnia_arxhs_ergasiakoy_etoys_adeias} Έως ${hmeromhnia_teloys_ergasiakoy_etoys_adeias}`

            // Υπολογισμός workDays
            const apo_hmeromhnia_adeias_01 = document.getElementById("apo_hmeromhnia_adeias_01");

            const workDays = calcDiaforaHmeron(
                apo_hmeromhnia_adeias_01?.value,
                hmeromhnia_proslhpshs,
                periodos?.value
            );

            _DISEKTO = isLeapYear(parseInt(document.getElementById("etos").value));
            let hmeres_etoys = _DISEKTO ? 366 : 365;

            _ETH_ADEIAS = Math.floor((parseInt(workDays) / hmeres_etoys));

            let fromDate, toDate, analogoysa_adeia, _DIAFORA_HMERON, _YPOLOIPO_HMERON;

            switch(true) {

                case _ETH_ADEIAS < 1:
                    fromDate = new Date(_HMEROMHNIA_PROSLHPSHS);
                    if (_HMEROMHNIA_APOXORHSHS && new Date(_HMEROMHNIA_APOXORHSHS) <= new Date(_HMEROMHNIA_TELOYS_HMEROLOGIAKOY_ETOYS_ADEIAS)) {
                        toDate = new Date(_HMEROMHNIA_APOXORHSHS);
                        _HMERES_EBDOMADIASIAS_ERGASIAS = "6";
                    } else {
                        toDate = new Date(_HMEROMHNIA_TELOYS_HMEROLOGIAKOY_ETOYS_ADEIAS);
                    }
                    _DIAFORA_HMERON = Math.floor((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
                    if (_HMERES_EBDOMADIASIAS_ERGASIAS === "6") {
                        analogoysa_adeia = (_DIAFORA_HMERON >= 360 ? 360 : _DIAFORA_HMERON) * parseInt(sharedParams.genikesParametroi[46].timh) / 360;
                    } else {
                        analogoysa_adeia = (_DIAFORA_HMERON >= 360 ? 360 : _DIAFORA_HMERON) * parseInt(sharedParams.genikesParametroi[41].timh) / 360;
                    }

                    _HMERES_DIKAIOYMENHS_ADEIAS = Math.round(analogoysa_adeia);
                    dikaioymenh_adeia.innerHTML = `Δικαιούμενη άδεια ${_ETH_ADEIAS + 1}ου Ημερολογιακού έτους: ${twoSpaces}`;
                    dikaioymenh_adeia_timh.innerHTML = `<strong>${_HMERES_DIKAIOYMENHS_ADEIAS}</strong>`;
                    document.getElementById("etosAdeias").value = parseInt(_ETH_ADEIAS + 1) || 0;
                    document.getElementById("dikaioymenhAdeiaTimh").value = parseInt(_HMERES_DIKAIOYMENHS_ADEIAS) || 0;
                    break;

                case _ETH_ADEIAS > 0 && _ETH_ADEIAS < 2:
                    fromDate = new Date(_HMEROMHNIA_ARXHS_HMEROLOGIAKOY_ETOYS_ADEIAS);
                    if (new Date(_HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS_ADEIAS) < new Date(_HMEROMHNIA_TELOYS_HMEROLOGIAKOY_ETOYS_ADEIAS)) {
                        if (_HMEROMHNIA_APOXORHSHS && new Date(_HMEROMHNIA_APOXORHSHS) <= new Date(_HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS_ADEIAS)) {
                            toDate = new Date(_HMEROMHNIA_APOXORHSHS);
                            _HMERES_EBDOMADIASIAS_ERGASIAS = "6";
                        } else {
                            toDate = new Date(_HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS_ADEIAS);
                        }

                        _DIAFORA_HMERON = Math.floor((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
                        _YPOLOIPO_HMERON = hmeres_etoys - _DIAFORA_HMERON;

                        if (_HMERES_EBDOMADIASIAS_ERGASIAS === "6") {
                            analogoysa_adeia = (_DIAFORA_HMERON >= 360 ? 360 : _DIAFORA_HMERON) * parseInt(sharedParams.genikesParametroi[46].timh) / 360;
                            analogoysa_adeia += (_YPOLOIPO_HMERON >= 360 ? 360 : _YPOLOIPO_HMERON) * parseInt(sharedParams.genikesParametroi[47].timh) / 360;
                        } else {
                            analogoysa_adeia = (_DIAFORA_HMERON >= 360 ? 360 : _DIAFORA_HMERON) * parseInt(sharedParams.genikesParametroi[41].timh) / 360;
                            analogoysa_adeia += ((_DIAFORA_HMERON + _YPOLOIPO_HMERON) >= 360 ? (360 - _DIAFORA_HMERON) : _YPOLOIPO_HMERON) * parseInt(sharedParams.genikesParametroi[42].timh) / 360;
                        }
                    } else {
                        if (_HMEROMHNIA_APOXORHSHS && new Date(_HMEROMHNIA_APOXORHSHS) <= new Date(_HMEROMHNIA_TELOYS_HMEROLOGIAKOY_ETOYS_ADEIAS)) {
                            toDate = new Date(_HMEROMHNIA_APOXORHSHS);
                        } else {
                            toDate = new Date(_HMEROMHNIA_TELOYS_HMEROLOGIAKOY_ETOYS_ADEIAS);
                        }

                        _DIAFORA_HMERON = Math.floor((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

                        if (_HMERES_EBDOMADIASIAS_ERGASIAS === "6") {
                            analogoysa_adeia = (_DIAFORA_HMERON >= 360 ? 360 : _DIAFORA_HMERON) * parseInt(sharedParams.genikesParametroi[47].timh) / 360;
                        } else {
                            analogoysa_adeia = (_DIAFORA_HMERON >= 360 ? 360 : _DIAFORA_HMERON) * parseInt(sharedParams.genikesParametroi[42].timh) / 360;
                        }
                    }

                    _HMERES_DIKAIOYMENHS_ADEIAS = Math.round(analogoysa_adeia);
                    dikaioymenh_adeia.innerHTML = `Δικαιούμενη άδεια ${_ETH_ADEIAS + 1}ου Ημερολογιακού έτους: ${twoSpaces}`;
                    dikaioymenh_adeia_timh.innerHTML = `<strong>${_HMERES_DIKAIOYMENHS_ADEIAS}</strong>`;
                    document.getElementById("etosAdeias").value = parseInt(_ETH_ADEIAS + 1) || 0;
                    document.getElementById("dikaioymenhAdeiaTimh").value = parseInt(_HMERES_DIKAIOYMENHS_ADEIAS) || 0;
                    break;

                case _ETH_ADEIAS > 2 && _ETH_ADEIAS < 10:
                    fromDate = new Date(_HMEROMHNIA_ARXHS_HMEROLOGIAKOY_ETOYS_ADEIAS);
                    if (new Date(_HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS_ADEIAS) < new Date(_HMEROMHNIA_TELOYS_HMEROLOGIAKOY_ETOYS_ADEIAS)) {
                        if (_HMEROMHNIA_APOXORHSHS && new Date(_HMEROMHNIA_APOXORHSHS) <= new Date(_HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS_ADEIAS)) {
                            toDate = new Date(_HMEROMHNIA_APOXORHSHS);
                        } else {
                            toDate = new Date(_HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS_ADEIAS);
                        }

                        _DIAFORA_HMERON = Math.floor((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
                        _YPOLOIPO_HMERON = hmeres_etoys - _DIAFORA_HMERON;

                        if (_HMERES_EBDOMADIASIAS_ERGASIAS === "6") {
                            analogoysa_adeia = (_DIAFORA_HMERON >= 360 ? 360 : _DIAFORA_HMERON) * parseInt(sharedParams.genikesParametroi[47].timh) / 360;
                            analogoysa_adeia += (_YPOLOIPO_HMERON >= 360 ? 360 : _YPOLOIPO_HMERON) * parseInt(sharedParams.genikesParametroi[48].timh) / 360;
                        } else {
                            analogoysa_adeia = (_DIAFORA_HMERON >= 360 ? 360 : _DIAFORA_HMERON) * parseInt(sharedParams.genikesParametroi[42].timh) / 360;
                            analogoysa_adeia += ((_DIAFORA_HMERON + _YPOLOIPO_HMERON) >= 360 ? (360 - _DIAFORA_HMERON) : _YPOLOIPO_HMERON) * parseInt(sharedParams.genikesParametroi[43].timh) / 360;
                        }
                    } else {
                        if (_HMERES_EBDOMADIASIAS_ERGASIAS === "6") {
                            analogoysa_adeia = parseInt(sharedParams.genikesParametroi[48].timh);
                        } else {
                            analogoysa_adeia = parseInt(sharedParams.genikesParametroi[43].timh);
                        }
                    }

                    _HMERES_DIKAIOYMENHS_ADEIAS = Math.round(analogoysa_adeia);
                    dikaioymenh_adeia.innerHTML = `Δικαιούμενη άδεια ${_ETH_ADEIAS + 1}ου Ημερολογιακού έτους: ${twoSpaces}`;
                    dikaioymenh_adeia_timh.innerHTML = `<strong>${_HMERES_DIKAIOYMENHS_ADEIAS}</strong>`;
                    document.getElementById("etosAdeias").value = parseInt(_ETH_ADEIAS + 1) || 0;
                    document.getElementById("dikaioymenhAdeiaTimh").value = parseInt(_HMERES_DIKAIOYMENHS_ADEIAS) || 0;
                    break;

                case _ETH_ADEIAS > 10 && _ETH_ADEIAS < 12:
                    if (_HMERES_EBDOMADIASIAS_ERGASIAS === "6") {
                        analogoysa_adeia = parseInt(sharedParams.genikesParametroi[49].timh);
                    } else {
                        analogoysa_adeia = parseInt(sharedParams.genikesParametroi[44].timh);
                    }

                    _HMERES_DIKAIOYMENHS_ADEIAS = Math.round(analogoysa_adeia);
                    dikaioymenh_adeia.innerHTML = `Δικαιούμενη άδεια ${_ETH_ADEIAS + 1}ου Ημερολογιακού έτους: ${twoSpaces}`;
                    dikaioymenh_adeia_timh.innerHTML = `<strong>${_HMERES_DIKAIOYMENHS_ADEIAS}</strong>`;
                    document.getElementById("etosAdeias").value = parseInt(_ETH_ADEIAS + 1) || 0;
                    document.getElementById("dikaioymenhAdeiaTimh").value = parseInt(_HMERES_DIKAIOYMENHS_ADEIAS) || 0;
                    break;

                case _ETH_ADEIAS >= 12:
                    if (_HMERES_EBDOMADIASIAS_ERGASIAS === "6") {
                        analogoysa_adeia = parseInt(sharedParams.genikesParametroi[50].timh);
                    } else {
                        analogoysa_adeia = parseInt(sharedParams.genikesParametroi[45].timh);
                    }

                    _HMERES_DIKAIOYMENHS_ADEIAS = Math.round(analogoysa_adeia);
                    dikaioymenh_adeia.innerHTML = `Δικαιούμενη άδεια ${_ETH_ADEIAS + 1}ου Ημερολογιακού έτους: ${twoSpaces}`;
                    dikaioymenh_adeia_timh.innerHTML = `<strong>${_HMERES_DIKAIOYMENHS_ADEIAS}</strong>`;
                    document.getElementById("etosAdeias").value = parseInt(_ETH_ADEIAS + 1) || 0;
                    document.getElementById("dikaioymenhAdeiaTimh").value = parseInt(_HMERES_DIKAIOYMENHS_ADEIAS) || 0;
                    break;
            }

            const { synolo_apodoxon, synolo_hmeres_asfalishs } = await getApodoxesProhgoymenonPeriodon({
                team: sharedParams._TEAM,
                company_kod: _KODIKOS_ETAIREIAS,
                xrhsh: sharedParams._XRHSH,
                kodikos: _KODIKOS_ERGAZOMENOY,
                periodos: periodos?.value,
                typos_apodoxon: "001"
            });

            if (!synolo_apodoxon && !synolo_hmeres_asfalishs) {
                _SYNOLO_APODOXON_TREXOYSAS_PERIODOY = parseFloat(document.getElementById("synoloMiktonApodoxon").value || 0) - 
                (parseFloat(document.getElementById("axiaParanomhsYperorias").value || 0) + 
                parseFloat(document.getElementById("axiaParanomhsYperoriasNyxtas").value || 0) + 
                parseFloat(document.getElementById("axiaParanomhsYperoriasArgion").value || 0) + 
                parseFloat(document.getElementById("axiaParanomhsYperoriasArgionNyxtas").value || 0) + 
                parseFloat(document.getElementById("epimerizomenesSeMhnesErgasias").value || 0) +
                parseFloat(document.getElementById("primBonus").value || 0) +
                parseFloat(document.getElementById("apallassomenesForoy").value || 0) +
                parseFloat(document.getElementById("apallassomenesKrathseon").value || 0));

                _MESO_HMEROMISTHIO = parseFloat(document.getElementById("hmeresAsfalishs").value) === 0 ? parseFloat(_SYNOLO_APODOXON_TREXOYSAS_PERIODOY) : (parseFloat(parseFloat(_SYNOLO_APODOXON_TREXOYSAS_PERIODOY) / parseFloat(document.getElementById("hmeresAsfalishs").value)) || 0).toFixed(4);
            } else {
                _MESO_HMEROMISTHIO = parseFloat(parseFloat(synolo_apodoxon) / parseFloat(synolo_hmeres_asfalishs)).toFixed(4);
            }

        });
    }
});

// =======================================================================================================
// Δένει τα events (blur) για μια γραμμή π.χ. "01", "02", κλπ. με eventListeneds attachRowListeners(row)
// =======================================================================================================
async function attachRowListeners_Adeias(row) {
    // 1) Εντοπίζουμε τα πεδία DOM
    const apo_hmeromhnia_adeias = document.getElementById(`apo_hmeromhnia_adeias_${row}`);
    const eos_hmeromhnia_adeias = document.getElementById(`eos_hmeromhnia_adeias_${row}`);
    hmeres_adeias = document.getElementById(`hmeres_adeias_${row}`);
    const eidos_adeias = document.getElementById(`eidos_adeias_${row}`);
    const apodoxes_epidomatos_adeias = document.getElementById(`apodoxes_epidomatos_adeias_${row}`)
    const apodoxes_adeias = document.getElementById(`apodoxes_adeias_${row}`)
    const apo_ora = document.getElementById(`apo_ora_${row}`);
    const eos_ora = document.getElementById(`eos_ora_${row}`);

    // 2) blur event στο apo_hmeromhnia_{row}
    apo_hmeromhnia_adeias.addEventListener('blur', async () => {
        if (!apo_hmeromhnia_adeias.value) return;
    });

    // 3) blur event τόσο στο apo_hmeromhnia_{row} όσο και στο eos_hmeromhnia_{row} για έλεγχο μήνα vs periodos, αφαίρεση αργιών, κ.λπ.
    [apo_hmeromhnia_adeias, eos_hmeromhnia_adeias].forEach((field) => {
        field.addEventListener('blur', async () => {
            // Αν δεν έχουν τιμές, σταματάμε
            if (!apo_hmeromhnia_adeias.value || !eos_hmeromhnia_adeias.value) return;

            document.getElementById(`hmeres_adeias_${row}`).value = 0;

            // Έλεγχος μήνα
            const apoMonth = getMonthFromDateString(apo_hmeromhnia_adeias.value);
            const eosMonth = getMonthFromDateString(eos_hmeromhnia_adeias.value);
            const periodosSelect = document.getElementById("periodos");
            if (!periodosSelect) return;

            const selectedPeriod = parseInt(periodosSelect.value, 10);

            if (apoMonth !== selectedPeriod || eosMonth !== selectedPeriod) {
                document.getElementById(`hmeres_adeias_${row}`).value = 0;
                document.getElementById(`eidos_adeias_${row}`).value = "";
                document.getElementById(`apodoxes_epidomatos_adeias_${row}`).value = 0;
                document.getElementById(`apodoxes_adeias_${row}`).value = 0;
    
                apo_hmeromhnia_adeias.value = "";
                eos_hmeromhnia_adeias.value = "";

                message = `
                    <p class="bold-text">Λάθος ημερομηνίες (γραμμή ${row})</p>
                    <p>&nbsp;</p>
                    <p>Οι ημερομηνίες που πληκτρολογήσατε δεν αφορούν την περίοδο μισθοδοσίας που είναι ο <strong>${selectedPeriod}ος (${periodosSelect.options[periodosSelect.selectedIndex].text})</strong>.</p>`
                showAlert(message);
                return;
            }

            // Ελέγχουμε αν οι επόμενες της 1ης γραμμής ημερομηνίες είναι επιτρεπτές 
            if (row !== '01') {
                const previousRow = "0" + (parseInt(row) - 1);
                const previous_eos_hmeromhnia_adeias = document.getElementById(`eos_hmeromhnia_adeias_${previousRow}`);

                if (formatDateToISO(formatDate(apo_hmeromhnia_adeias.value)) <= formatDateToISO(formatDate(previous_eos_hmeromhnia_adeias.value)) || formatDateToISO(formatDate(eos_hmeromhnia_adeias.value)) <= formatDateToISO(formatDate(previous_eos_hmeromhnia_adeias.value))) {
                    apo_hmeromhnia_adeias.value = "";
                    eos_hmeromhnia_adeias.value = "";
    
                    message = `
                        <p class="bold-text">Λάθος ημερομηνίες (γραμμή ${row})</p>
                        <p>&nbsp;</p>
                        <p>Δεν επιτρέπεται η ημερομηνία έναρξης ή και λήξης της τρέχουσας γραμμής της άδειας, να είναι <strong>μικρότερη/ες ή ίση/ες</strong> της ημερομηνίας λήξης της προηγούμενης περιόδου άδειας.</p>`
                    showAlert(message);
                    return;
                }
            }

            // Ελέγχουμε για την ορθότητα των ημερομηνιών των αδειών σε σχέση με την ημερομηνία αποχώρησης 
            let startDate = new Date(parseInt(document.getElementById("etos").value, 10), parseInt(document.getElementById("mhnas").value, 10) - 1, 1);
            let endDate = new Date(parseInt(document.getElementById("etos").value, 10), parseInt(document.getElementById("mhnas").value, 10), 0);

            if (_HMEROMHNIA_APOXORHSHS && (formatDateToCustom(new Date(_HMEROMHNIA_APOXORHSHS)) >= formatDateToCustom(startDate) && formatDateToCustom(new Date(_HMEROMHNIA_APOXORHSHS)) <= formatDateToCustom(endDate))) {
                if (formatDateToCustom(new Date(apo_hmeromhnia_adeias.value)) > formatDateToCustom(new Date(_HMEROMHNIA_APOXORHSHS)) || formatDateToCustom(new Date(eos_hmeromhnia_adeias.value)) > formatDateToCustom(new Date(_HMEROMHNIA_APOXORHSHS))) {
                    apo_hmeromhnia_adeias.value = "";
                    eos_hmeromhnia_adeias.value = "";
                    message = `
                        <p class="bold-text">Λάθος ημερομηνίες (γραμμή ${row})</p>
                        <p>&nbsp;</p>
                        <p>Ο/Η εργαζόμενος/η αποχώρησε στις <strong>${formatDateRepo_Argies(new Date(_HMEROMHNIA_APOXORHSHS).toString())}</strong>.</p>`
                    showAlert(message);
                    return;
                }
            }

            // Ελέγχουμε αν ο μήνας των ημερομηνιών των αδειών είναι ίδιος με την περίοδο χρήσης
            const diasthma_hmeron_adeias = document.getElementById("diasthma_hmeron_adeias");
            const diasthma_hmeron_adeias_timh = document.getElementById("diasthma_hmeron_adeias_timh");
            lhfteisa_adeia_prohgoymenon_mhnon = document.getElementById("lhfteisa_adeia_prohgoymenon_mhnon");
            lhfteisa_adeia_prohgoymenon_mhnon_timh = document.getElementById("lhfteisa_adeia_prohgoymenon_mhnon_timh");
            ypoloipo_adeias_trexontos_etoys = document.getElementById("ypoloipo_adeias_trexontos_etoys");
            ypoloipo_adeias_trexontos_etoys_timh = document.getElementById("ypoloipo_adeias_trexontos_etoys_timh");
            ypoloipo_adeias = document.getElementById("ypoloipo_adeias");
            ypoloipo_adeias_timh = document.getElementById("ypoloipo_adeias_timh");

            let eos_hmeromhnia_elegxoy;
            const apoHmeromhniaDate = new Date(formatDateToCustom(apo_hmeromhnia_adeias.value));
            const eosHmeromhniaDate = new Date(formatDateToCustom(eos_hmeromhnia_adeias.value));
            eos_hmeromhnia_elegxoy = formatDateToCustom(new Date(apo_hmeromhnia_adeias.value).setDate(new Date(apo_hmeromhnia_adeias.value).getDate() - 1));
                        
            dates = {};
            for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[51].timh); i++) {
                const apoValue = document.getElementById(`apo_hmeromhnia_astheneias_0${i}`).value;
                const eosValue = document.getElementById(`eos_hmeromhnia_astheneias_0${i}`).value;
                const apoValue1 = document.getElementById(`apo_hmeromhnia_adeias_0${i}`).value;
                const eosValue1 = document.getElementById(`eos_hmeromhnia_adeias_0${i}`).value;
            
                // Αποθηκεύουμε π.χ. στα κλειδιά apo_hmeromhnia_01, apo_hmeromhnia_02, κ.λπ.
                dates[`apo_hmeromhnia_0${i}`] = apoValue;
                dates[`eos_hmeromhnia_0${i}`] = eosValue;
                dates[`apo_hmeromhnia_adeias_0${i}`] = apoValue1;
                dates[`eos_hmeromhnia_adeias_0${i}`] = eosValue1;
            }

            const { totalSicknessDays, sicknessDatesString, sicknessDatesGrouped } = await getHmeromhniesAstheneias({
                team: sharedParams._TEAM,
                company_kod: _ID_ETAIREIAS,
                kodikos: _KODIKOS_ERGAZOMENOY,
                ...dates
            });

            const sicknessLengths = sicknessDatesGrouped.map(dates => dates.length);
            arrays[parseInt(row)][4] = sicknessLengths[parseInt(row) - 1] || 0;

            _DIAFORA_HMERON = await diffDays(apo_hmeromhnia_adeias.value, eos_hmeromhnia_adeias.value) + 1;

            diasthma_hmeron_adeias[`_HMERES_ADEIAS_${row}`] = _DIAFORA_HMERON || 0;

            diasthma_hmeron_adeias.innerHTML = `Συνολικό Διάστημα Αιτούμενης Άδειας: `;

            totalDays = 0;
            for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[52].timh); i++) {
                totalDays += diasthma_hmeron_adeias[`_HMERES_ADEIAS_0${i}`] || 0; 
            }
            _diasthma_hmeron_adeias = totalDays;
            diasthma_hmeron_adeias_timh.innerHTML = `<b>${totalDays}</b>`;
            document.getElementById("diasthmaHmeronAdeiasTimh").value = parseInt(totalDays) || 0;

            arrays[parseInt(row)][0] = diasthma_hmeron_adeias[`_HMERES_ADEIAS_${row}`] || 0;
            
            await handleRepo_AdeiasDates(row);
            await handleArgies_AdeiasDates(row);
            
            meion_repo.innerHTML = ` - `;

            anapaysh_repo_adeias.innerHTML = `Ρεπό: `;

            totalDays = 0;
            for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[52].timh); i++) {
                totalDays += hmeres_Repo_Adeias[`_HMERES_REPO_ADEIAS_0${i}`] || 0; 
            }

            anapaysh_repo_adeias_timh.innerHTML = `<b>${totalDays}</b>`;
            _repo = totalDays;
            arrays[parseInt(row)][2] = hmeres_Repo_Adeias[`_HMERES_REPO_ADEIAS_${row}`] || 0;
            document.getElementById("repoAdeiasTimh").value = parseInt(totalDays) || 0;

            argies_adeias.innerHTML = `Αργίες: `;
            totalDays = 0;
            for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[52].timh); i++) {
                totalDays += hmeres_Argion_Adeias[`_HMERES_ARGION_ADEIAS_0${i}`] || 0; 
            }

            meion_argies.innerHTML = ` - `;

            argies_adeias_timh.innerHTML = `<b>${totalDays}</b>`;
            _argies = totalDays;
            arrays[parseInt(row)][3] = hmeres_Argion_Adeias[`_HMERES_ARGION_ADEIAS_${row}`] || 0;
            document.getElementById("argiesAdeiasTimh").value = parseInt(totalDays) || 0;

            _astheneies = totalSicknessDays;

            meion_astheneies.innerHTML = ` - `;

            astheneies_adeias.innerHTML = `Ασθένειες: `;
            astheneies_adeias_timh.innerHTML = `<b>${totalSicknessDays}</b>`;

            astheneies_adeias_hmeromhnies.innerHTML = !sicknessDatesString ? ` ` : `${sicknessDatesString}`;
            document.getElementById("astheneiesAdeiasTimh").value = parseInt(totalSicknessDays) || 0;
            document.getElementById("astheneiesAdeiasHmeromhnies").value = astheneies_adeias_hmeromhnies.innerHTML;
            
            _HMEROMHNIA_ARXHS_HMEROLOGIAKOY_ETOYS_ADEIAS = hmeromhnia_arxhs_hmerologiakoy_etoys_adeias.value;

            // ΕΥΡΕΣΗ ΤΩΝ ΠΡΟΗΓΟΥΜΕΝΩΝ ΑΔΕΙΩΝ ΠΟΥ ΑΦΟΡΟΥΝ ΤΟ ΤΡΕΧΟΝ ΗΜΕΡΟΛΟΓΙΑΚΟ ΕΤΟΣ
            const results = await getProhgoymenesHmeresAdeias({
                team: sharedParams._TEAM,
                company_kod: _KODIKOS_ETAIREIAS,
                etos: sharedParams._XRHSH,
                kodikos: _KODIKOS_ERGAZOMENOY,
                dateStart: formatDateToISO(_HMEROMHNIA_ARXHS_HMEROLOGIAKOY_ETOYS_ADEIAS),
                dateEnd: eos_hmeromhnia_elegxoy
            });
    
            synoloProhgoymenonHmeronAdeias = results.synola.synolo_hmeron_adeias || 0;
            
            lhfteisa_adeia_prohgoymenon_mhnon.innerHTML = `Ληφθείσα Άδεια από την Αρχή του Έτους:`;
            lhfteisa_adeia_prohgoymenon_mhnon_timh.innerHTML = `<b>${synoloProhgoymenonHmeronAdeias}</b>`;
            document.getElementById("lhfteisaAdeiaProhgoymenonMhnonTimh").value = parseInt(synoloProhgoymenonHmeronAdeias) || 0;
            
            ypoloipo_adeias_trexontos_etoys.innerHTML = `Υπόλοιπο Άδειας Τρέχοντος Έτους:`
            ypoloipo_adeias_trexontos_etoys_timh.innerHTML = `<b>${_HMERES_DIKAIOYMENHS_ADEIAS - synoloProhgoymenonHmeronAdeias}</b>`
            document.getElementById("ypoloipoAdeiasTrexontosEtoysTimh").value = parseInt(_HMERES_DIKAIOYMENHS_ADEIAS - synoloProhgoymenonHmeronAdeias) || 0;

            const repoDatesArray = anapaysh_repo_adeias_hmeromhnies.innerHTML.split(', ').filter(Boolean);
            const argiesDatesArray = argies_adeias_hmeromhnies.innerHTML.split(', ').filter(Boolean);
            const astheneiesDatesArray = astheneies_adeias_hmeromhnies.innerHTML.split(', ').filter(Boolean);
            
            // Συνενώνουμε όλες τις ημερομηνίες
            const allDates = [...repoDatesArray, ...argiesDatesArray, ...astheneiesDatesArray];
            
            // Μετρητής συχνότητας ημερομηνιών
            const dateCounts = {};
            
            // Μετράμε πόσες φορές εμφανίζεται κάθε ημερομηνία
            allDates.forEach(date => {
                dateCounts[date] = (dateCounts[date] || 0) + 1;
            });
            
            // Κρατάμε τις ημερομηνίες που εμφανίζονται σε **τουλάχιστον 2 πίνακες**
            const commonDates = Object.keys(dateCounts).filter(date => dateCounts[date] >= 2);
            _koines_hmeres = commonDates.length || 0;

            arrays[parseInt(row)][5] = _koines_hmeres;

            // Ενημέρωση του τρίτου label
            syn_koines_hmeres.innerHTML = ` + `;

            koines_hmeres_repo_argion_astheneion_adeias.innerHTML = `Κοινές ημέρες Ρεπό-Αργιών-Ασθενειών: `;
            koines_hmeres_repo_argion_astheneion_adeias_timh.innerHTML = `<b>${commonDates.length || 0}</b>`;
            koines_hmeres_repo_argion_astheneion_adeias_hmeromhnies.innerHTML = commonDates.join(', ');
            document.getElementById("koinesHmeresRepoArgionAstheneionAdeiasTimh").value = parseInt(commonDates.length) || 0;
            document.getElementById("koinesHmeresRepoArgionAstheneionAdeiasHmeromhnies").value = koines_hmeres_repo_argion_astheneion_adeias_hmeromhnies.innerHTML;
            
            ypoloipo_adeias.innerHTML = `ΥΠΟΛΟΙΠΟ ΑΔΕΙΑΣ:`
            ypoloipo_adeias_timh.innerHTML = `<b>${_HMERES_DIKAIOYMENHS_ADEIAS - (_diasthma_hmeron_adeias - ((synoloProhgoymenonHmeronAdeias + totalSicknessDays + _repo + _argies) - _koines_hmeres))}</b>`

            arrays[parseInt(row)][1] = parseInt(parseInt(arrays[parseInt(row)][0]) - arrays[parseInt(row)][2] - arrays[parseInt(row)][3] - arrays[parseInt(row)][4] + arrays[parseInt(row)][5]) || 0;

            document.getElementById(`hmeres_adeias_${row}`).value = arrays[parseInt(row)][1];

            old_hmeres_adeias = parseInt(document.getElementById(`hmeres_adeias_${row}`).value);

            await calcTrexontaSynola_Adeias(row);
            await calcApodoxesAdeias(row);
            await calcTotalApodoxesAdeias();
        });
    });

    async function calcTrexontaSynola_Adeias(row) {
        let synolo_hmeron_adeias = 0;
        let hmeres = 0, ypoloipo_adeias = 0;

        for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[52].timh); i++) {
            // if (parseInt(document.getElementById(`hmeres_adeias_0${i}`).value) === 0 ) {
            //     continue;
            // }
            hmeres = parseInt(document.getElementById(`hmeres_adeias_0${i}`).value) || 0;

            synolo_hmeron_adeias += parseInt(document.getElementById(`hmeres_adeias_0${i}`).value);
            document.getElementById("synolo_hmeron_adeias").value = parseInt(synolo_hmeron_adeias);
            ypoloipo_adeias = parseInt(_HMERES_DIKAIOYMENHS_ADEIAS - synolo_hmeron_adeias);

            ypoloipo_adeias_timh.innerHTML = `<b>${_HMERES_DIKAIOYMENHS_ADEIAS - synolo_hmeron_adeias}</b>`
        }
        document.getElementById("ypoloipoAdeiasTimh").value = parseInt(_HMERES_DIKAIOYMENHS_ADEIAS - synolo_hmeron_adeias) || 0;

        if (synolo_hmeron_adeias > _HMERES_DIKAIOYMENHS_ADEIAS) {
            let message = `
            <p class="bold-text">ΠΡΟΣΟΧΗ !!!</p>
            <p>&nbsp;</p>
            <p>
                Οι ημέρες άδειας που πληκτρολογήσατε, είναι μεγαλύτερες της υπολλειπόμενης ετήσιας άδειας. </br> Οι ημέρες άδειας της γραμμής θα μετατραπούν σε δικαιούμενη άδεια μείον το σύνολο της άδειας μέχρι την προηγούμενη γραμμή.
            </p>`;
            document.getElementById(`hmeres_adeias_${row}`).value = parseInt(old_hmeres_adeias) + parseInt(_HMERES_DIKAIOYMENHS_ADEIAS - synolo_hmeron_adeias);

            for (let j = 1; j <= parseInt(sharedParams.genikesParametroi[52].timh); j++) {
                synolo_hmeron_adeias += parseInt(document.getElementById(`hmeres_adeias_0${j}`).value);
                document.getElementById("synolo_hmeron_adeias").value = parseInt(synolo_hmeron_adeias);

                ypoloipo_adeias_timh.innerHTML = `<b>${_HMERES_DIKAIOYMENHS_ADEIAS - synolo_hmeron_adeias}</b>`
                document.getElementById("ypoloipoAdeiasTimh").value = parseInt(_HMERES_DIKAIOYMENHS_ADEIAS - synolo_hmeron_adeias) || 0;
            }
            showAlert(message);
            return;
        }
    }

    [hmeres_adeias].forEach((field) => {
        field.addEventListener('blur', async () => {
            await calcTrexontaSynola_Adeias(row);
            await calcApodoxesAdeias(row);
            await calcTotalApodoxesAdeias();
        });
    });

    [apo_ora, eos_ora].forEach((field) => {
        field.addEventListener('input', () => {
            autoFormatTime(field);
        });
          
        field.addEventListener('blur', async () => {
            apo_ora.value = transformTimeValue(apo_ora.value);
            eos_ora.value = transformTimeValue(eos_ora.value);
        
            document.getElementById(`ores_adeias_${row}`).value = "";
            let diafora = await calculateTimeDifference(apo_ora.value, eos_ora.value);
            document.getElementById(`ores_adeias_${row}`).value = diafora;
            
            let synolo_diaforas_adeias = await calcSynoloOronAdeias();
            document.getElementById("synolo_oron_adeias").value = synolo_diaforas_adeias;
        });
    });
            
    [apodoxes_epidomatos_adeias, apodoxes_adeias].forEach((field) => {
        field.addEventListener('blur', async () => {
            await calcTotalApodoxesAdeias();
        });
    });

    [eidos_adeias].forEach((field) => {
        field.addEventListener('blur', async () => {
            await checkEidosAdeias(row);
        });
    });

};

function calcDiaforaHmeron(apo_hmeromhnia, hmeromhnia_proslhpshs, periodos) {
    if (apo_hmeromhnia) {
        const apoDate = new Date(apo_hmeromhnia);
        const proslhpshDate = new Date(hmeromhnia_proslhpshs);
        _DIAFORA_HMERON = Math.floor((apoDate - proslhpshDate) / (1000 * 60 * 60 * 24)) - 1;
    } else {
        const arxh_periodoy = document.getElementById("etos").value + "-" + periodos + "-01T00:00:00.000Z"
        const today = new Date(arxh_periodoy); 
        const year = today.getFullYear();
        const month = parseInt(periodos) - 1;
        const startDayOfMonth = new Date(year, month - 1 + 1, 1);
        const proslhpshDate = new Date(hmeromhnia_proslhpshs);
        _DIAFORA_HMERON = Math.floor((startDayOfMonth - proslhpshDate) / (1000 * 60 * 60 * 24));
    }
    if (!_DIAFORA_HMERON) {
        return 0;
    } else {
        return _DIAFORA_HMERON;
    }
}

async function handleArgies_AdeiasDates(row) {
    const apo_hmeromhnia_adeias = document.getElementById(`apo_hmeromhnia_adeias_${row}`);
    const eos_hmeromhnia_adeias = document.getElementById(`eos_hmeromhnia_adeias_${row}`);

    // Παίρνουμε τις τιμές ως string "DD/MM/YYYY"
    const apoValue = formatDate(apo_hmeromhnia_adeias.value); // π.χ. "01/10/2024"
    const eosValue = formatDate(eos_hmeromhnia_adeias.value); // π.χ. "06/10/2024"

    // Κλήση της getMhErgasiaCount
    const { count: originalCount, hmeromhnies } = await getArgies_AdeiasCount({
        team: sharedParams._TEAM,
        company_kod: _KODIKOS_ETAIREIAS,
        etos: sharedParams._XRHSH,
        dateStart: apo_hmeromhnia_adeias.value,
        dateEnd: eos_hmeromhnia_adeias.value
    });

    _ARGIES_ADEIAS = parseInt(originalCount);
    // 6. Αποθήκευση του repo count για αυτή τη γραμμή
    hmeres_Argion_Adeias[`_HMERES_ARGION_ADEIAS_${row}`] = _ARGIES_ADEIAS;
  
    // 7. Δημιουργούμε τον *νέο* πίνακα για αυτή τη γραμμή στο hmeromhniesRepo
    if (_ARGIES_ADEIAS > 0) {
        const newDates = hmeromhnies.map(dateString => {
            const datePart = dateString.split('T')[0]; // "YYYY-MM-DD"
            const [yyyy, mm, dd] = datePart.split('-');
            const formatted = `${dd}/${mm}/${yyyy}`;   // "DD/MM/YYYY"
            return formatDateRepoArgies(formatted);
        });
        // Αντικαθιστούμε *εξ ολοκλήρου* τις ημερομηνίες της τρέχουσας γραμμής
        hmeromhnies_Argion_Adeias[`_HMEROMHNIES_ARGION_ADEIAS_${row}`] = newDates;
    } else {
        // Αν δεν έχουμε repo, αδειάζουμε τον πίνακα για τη γραμμή
        hmeromhnies_Argion_Adeias[`_HMEROMHNIES_ARGION_ADEIAS_${row}`] = null;
    }
  
    // 8. Ενημερώνουμε και το συνολικό repo count
    await updateGlobalArgies_AdeiasDisplay();
    await updateTotalArgies_AdeiasCount();

    let totalDays = 0;
    for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[52].timh); i++) {
        totalDays += hmeres_Argion_Adeias[`_HMERES_ARGION_ADEIAS_0${i}`] || 0; 
    }

    argies_adeias_timh.innerHTML = `<b>${totalDays}</b>`;
}

// ============================================================
// API για επιστροφή απ' τη ΒΔ του αριθμού και των ημερομηνιών των αργιών
// ============================================================
async function getArgies_AdeiasCount(params) {
    const data = await fetch('/api/kinhseis/argies_astheneion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({  team:           params.team,
                                company_kod:    params.company_kod,
                                etos:           params.etos,
                                startDate:      params.dateStart,     
                                endDate:        params.dateEnd
                            })
    });
    const result = await data.json();
    return result;
}

async function handleRepo_AdeiasDates(row) {
    // 1. Παίρνουμε από τα input τις τιμές Από & Έως (π.χ. "apo_hmeromhnia_2", "eos_hmeromhnia_2")
    const apoInput = document.getElementById(`apo_hmeromhnia_adeias_${row}`);
    const eosInput = document.getElementById(`eos_hmeromhnia_adeias_${row}`);
    const apoValue = formatDate(apoInput.value); // π.χ. μετατρέπει "2024-10-01" -> "01/10/2024"
    const eosValue = formatDate(eosInput.value);
  
    // 4. Καλούμε το getMhErgasiaCount για να πάρουμε νέες τιμές (repo και ημερομηνίες)
    const { repo, repoDates } = await getMhErgasia_AdeiasCount({
        team: sharedParams._TEAM,
        company_kod: _ID_ETAIREIAS,
        kodikos: _KODIKOS_ERGAZOMENOY,
        dateStart: formatDateToISO(apoValue),
        dateEnd: formatDateToISO(eosValue)
    });
  
    // 5. Ενημέρωση κάποιων global μεταβλητών
    _REPO_ADEIAS = repo;
    _HMEROMHNIES_REPO_ADEIAS = repoDates;

    // 7. Αποθήκευση του repo count για αυτή τη γραμμή
    hmeres_Repo_Adeias[`_HMERES_REPO_ADEIAS_${row}`] = repo;
  
    // 8. Δημιουργούμε τον *νέο* πίνακα για αυτή τη γραμμή στο hmeromhniesRepo
    if (repo > 0) {
        const newDates = repoDates.map(dateString => {
            const datePart = dateString.split('T')[0]; // "YYYY-MM-DD"
            const [yyyy, mm, dd] = datePart.split('-');
            const formatted = `${dd}/${mm}/${yyyy}`;   // "DD/MM/YYYY"
            return formatDateRepoArgies(formatted);
        });
        // Αντικαθιστούμε *εξ ολοκλήρου* τις ημερομηνίες της τρέχουσας γραμμής
        hmeromhnies_Repo_Adeias[`_HMEROMHNIES_REPO_ADEIAS_${row}`] = newDates;
    } else {
        // Αν δεν έχουμε repo, αδειάζουμε τον πίνακα για τη γραμμή
        hmeromhnies_Repo_Adeias[`_HMEROMHNIES_REPO_ADEIAS_${row}`] = null;
    }
  
    // 10. Ενημερώνουμε και τα συνολικά repo και mhErgasimes count
    await updateGlobalRepo_AdeiasDisplay();
    await updateTotalRepo_AdeiasCount();
}

async function getMhErgasia_AdeiasCount(params) {
    const data = await fetch('/api/kinhseis/hmeres_mh_ergasias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({  team:           params.team,
                                company_kod:    params.company_kod,
                                kodikos:        params.kodikos,
                                startDate:      params.dateStart,     
                                endDate:        params.dateEnd
                            })
    });
    const result = await data.json();
    return result;
}

async function updateGlobalArgies_AdeiasDisplay() {
    // 1. Ήδη αποθηκευμένα δεδομένα από όλες τις γραμμές
    let allArgiesDates = [];
  
    // 2. Συγκεντρώνουμε τις ημερομηνίες όλων των γραμμών (χωρίς να τις ξαναφιλτράρουμε)
    Object.keys(hmeromhnies_Argion_Adeias).forEach(key => {
      const rowDates = hmeromhnies_Argion_Adeias[key];
      if (Array.isArray(rowDates) && rowDates.length > 0) {
        allArgiesDates = allArgiesDates.concat(rowDates);
      }
    });
  
    // 3. Αφαίρεση διπλοτύπων
    allArgiesDates = [...new Set(allArgiesDates)];
  
    // 4. Ταξινόμηση (εάν θέλετε οι ημερομηνίες να εμφανίζονται με σειρά)
    if (allArgiesDates.length > 0) {
        allArgiesDates.sort((a, b) => parseDateDDMMYYYY(a) - parseDateDDMMYYYY(b));
    }
    argies_adeias_hmeromhnies.innerHTML = allArgiesDates.join(', ');
    document.getElementById("argiesAdeiasHmeromhnies").value = argies_adeias_hmeromhnies.innerHTML;
}
  
/****************************************
* Ενημέρωση Συνολικού Argies Count
****************************************/
async function updateTotalArgies_AdeiasCount() {
    let total = 0;
    for (const key in hmeres_Argion_Adeias) {
        if (hmeres_Argion_Adeias.hasOwnProperty(key)) {
            total += Number(hmeres_Argion_Adeias[key]) || 0;
        }
    }
    argies_adeias_timh.innerHTML = `<b>${total}</b>`;
}

async function updateGlobalRepo_AdeiasDisplay() {
    // 1. Ήδη αποθηκευμένα δεδομένα από όλες τις γραμμές
    let allRepoDates = [];
  
    // 2. Συγκεντρώνουμε τις ημερομηνίες όλων των γραμμών (χωρίς να τις ξαναφιλτράρουμε)
    Object.keys(hmeromhnies_Repo_Adeias).forEach(key => {
        const rowDates = hmeromhnies_Repo_Adeias[key];
        if (Array.isArray(rowDates) && rowDates.length > 0) {
          allRepoDates = allRepoDates.concat(rowDates);
        }
      });
    
      // 3. Αφαίρεση διπλοτύπων
      allRepoDates = [...new Set(allRepoDates)];
    
      // 4. Ταξινόμηση
      if (allRepoDates.length > 0) {
          allRepoDates.sort((a, b) => parseDateDDMMYYYY(a) - parseDateDDMMYYYY(b));
      }
      anapaysh_repo_adeias_hmeromhnies.innerHTML = allRepoDates.join(', ');
      document.getElementById("repoAdeiasHmeromhnies").value = anapaysh_repo_adeias_hmeromhnies.innerHTML;
    }
  
  /****************************************
   * Ενημέρωση Συνολικού Repo Count
   ****************************************/
  async function updateTotalRepo_AdeiasCount() {
    let total = 0;
    for (const key in hmeres_Repo_Adeias) {
      if (hmeres_Repo_Adeias.hasOwnProperty(key)) {
        total += Number(hmeres_Repo_Adeias[key]) || 0;
      }
    }
    anapaysh_repo_adeias_timh.innerHTML = `<b>${total}</b>`;
  }
    
async function getHmeromhniesAstheneias(params) {
    const data = await fetch('/api/kinhseis/hmeromhnies_astheneias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({  team:           params.team,
                                company_kod:    params.company_kod,
                                kodikos:        params.kodikos,
                                ...dates 
                            })
    });
    const result = await data.json();
    return result;
}

async function getProhgoymenesHmeresAdeias(params) {
    const data = await fetch('/api/kinhseis/prohgoymenes_adeies', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({  team:           params.team,
                                company_kod:    params.company_kod,
                                xrhsh:          params.etos,
                                kodikos:        params.kodikos,
                                startDate:      params.dateStart,     
                                endDate:        params.dateEnd
                            })
        });
    const result = await data.json();
    return result;
}

async function getApodoxesProhgoymenonPeriodon(params) {
    const data = await fetch('/api/kinhseis/apodoxes_prohgoymenon_periodon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({  team:           params.team,
                                company_kod:    params.company_kod,
                                xrhsh:          params.xrhsh,
                                kodikos:        params.kodikos,
                                periodos:       params.periodos,     
                                typos_apodoxon: params.typos_apodoxon
                            })
    });
    const result = await data.json();
    return result;
}

async function calcApodoxesAdeias(row) {
    const max_hmeres_epidomatos_adeias = _TYPOS_ERGAZOMENOY === "Μ" ? 12.5 : 13;
    let epidoma_adeias = 0, apodoxes_adeias = 0;

    epidoma_adeias = parseInt(document.getElementById(`hmeres_adeias_${row}`).value) > max_hmeres_epidomatos_adeias ? parseFloat(max_hmeres_epidomatos_adeias * _MESO_HMEROMISTHIO).toFixed(2) : parseFloat(parseInt(document.getElementById(`hmeres_adeias_${row}`).value) * _MESO_HMEROMISTHIO);
    
    apodoxes_adeias = parseFloat(parseInt(document.getElementById(`hmeres_adeias_${row}`).value) * _MESO_HMEROMISTHIO);

    document.getElementById(`apodoxes_epidomatos_adeias_${row}`).value = parseFloat(epidoma_adeias).toFixed(2);
    document.getElementById(`apodoxes_adeias_${row}`).value = parseFloat(apodoxes_adeias).toFixed(2);
}

async function calcTotalApodoxesAdeias() {
    let synolo_apodoxon_epidomatos_adeias = 0, synolo_apodoxon_adeias = 0 ;

    for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[52].timh); i++) {
        synolo_apodoxon_epidomatos_adeias += parseFloat(document.getElementById(`apodoxes_epidomatos_adeias_0${i}`).value);
        synolo_apodoxon_adeias += parseFloat(document.getElementById(`apodoxes_adeias_0${i}`).value);
    }

    document.getElementById("synolo_apodoxon_epidomatos_adeias").value = parseFloat(synolo_apodoxon_epidomatos_adeias).toFixed(2);
    document.getElementById("synolo_apodoxon_adeias").value = parseFloat(synolo_apodoxon_adeias).toFixed(2);
}

async function checkEidosAdeias(row) {
    if (document.getElementById(`eidos_adeias_${row}`).value === "") {
        message = `
            <p class="bold-text">Κατηγορία Άδειας)</p>
            <p>&nbsp;</p>
            <p>Πρέπει να ορίσετε την κατηγορία της άδειας, που αφορά το χρονικό διάστημα της γραμμής <b>${row}</b>.</p>`
        showAlert(message);
        return;
    }
}

async function calculateTimeDifference(time1, time2) {
    let diafora_oron_adeias = "";
    if (time1 && time2) {
        // Διαχωρίζουμε τις ώρες και τα λεπτά
        let [hours1, minutes1] = time1.split(":").map(Number);
        let [hours2, minutes2] = time2.split(":").map(Number);

        // Μετατρέπουμε τις ώρες και τα λεπτά σε συνολικά λεπτά
        let totalMinutes1 = hours1 * 60 + minutes1;
        let totalMinutes2 = hours2 * 60 + minutes2;

        // Υπολογίζουμε τη διαφορά σε λεπτά
        let diffMinutes = Math.abs(totalMinutes2 - totalMinutes1);

        // Μετατροπή πίσω σε ώρες και λεπτά
        let diffHours = Math.floor(diffMinutes / 60);
        let diffMins = diffMinutes % 60;

        diafora_oron_adeias = `${String(diffHours).padStart(2, "0")}:${String(diffMins).padStart(2, "0")}`;

        // await calcSynoloOronAdeias();
        return diafora_oron_adeias;
    } else {
        return ""
    }
}

async function calcSynoloOronAdeias() {
    let timeSynolo = 0, totalMinutes = 0, totalHours = 0, totalMins = 0, synolo_diaforas_oron_adeias = "";
    ;
    for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[52].timh); i++) {
        timeSynolo = document.getElementById(`ores_adeias_0${i}`).value;
        let [hours1, minutes1] = timeSynolo.split(":").map(Number);
        if (!minutes1) {
            minutes1 = 0;
        }
        totalMinutes += hours1 * 60 + minutes1;
    }
    totalHours = Math.floor(totalMinutes / 60);
    totalMins = totalMinutes % 60;

    if (totalMinutes === 0) {
        synolo_diaforas_oron_adeias = ""
    } else {
        synolo_diaforas_oron_adeias = `${String(totalHours).padStart(2, "0")}:${String(totalMins).padStart(2, "0")}`;
    }

    return synolo_diaforas_oron_adeias;
}
