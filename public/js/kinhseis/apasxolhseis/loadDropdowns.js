const oneSpaces = '\u00A0'.repeat(1);
const twoSpaces = '\u00A0'.repeat(2);
const tenSpaces = '\u00A0'.repeat(10);

let metrhths = 0;  // Μετρητής για αποφυγή flashing μεταξύ των tab κατά τον υπολογισμό του φόρου και του πληρωτέου
let hasRecord = false;

let _DOTO_PLHROTEO = false, _NEES_PLHROTEES_APODOXES = 0, _NEOS_FOROS = 0, _PROHGOYMENES_MIKTES_APODOXES = 0, _CHECK_HMERES_ASFALISHS = false;

let _KODIKOS_ETAIREIAS,
    _ID_ETAIREIAS,
    _KODIKOS_ERGAZOMENOY,
    _HMEROMHNIA_PROSLHPSHS,
    _HMEROMHNIA_APOXORHSHS,
    _HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS,
    _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_LESS_365,  
    _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_LESS_365,
    _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_GREATER_365,
    _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_GREATER_365,
    _TELOS_TREXONTOS_ERGASIAKOY_ETOYS,
    _ARXH_EPOMENOY_ERGASIAKOY_ETOYS,
    _HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS,
    _HMEROMHNIA_ARXHS_EPOMENOY_ERGASIAKOY_ETOYS,
    _HMEROMHNIA_TELOYS_EPOMENOY_ERGASIAKOY_ETOYS,
    _TELOS_ERGASIAKHS_PERIODOY,
    _HMEROMHNIES_REPO, 
    _MH_ERGASIMES_HMERES_REPO,
    _HMEROMHNIES_ARGION;

let _APASXOLHSH_BASEI_SYMBASHS = 0,
    _APODOXES_ORON_ERGASIAS = 0,
    _APODOXES_ORON_APOYSIAS = 0,
    _ARGIES = 0, 
    _ASTHENEIES = 0, 
    _DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS = 0, 
    _DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS = 0, 
    _HMERES_ARGION = 0,
    _KOINES_ARGIES = 0, 
    _LHFTHEISA_ADEIA_ASTHENEIAS = 0, 
    _MH_ERGASIMES_HMERES = 0, 
    _PRAGMATIKES_HMERES_ASTHENEIAS = 0,
    _REPO = 0, 
    _SYNOLO_DIKAIOYMENHS_ASTHENEIAS = 0, 
    _SYNOLIKO_DIASTHMA_ASTHENEIAS = 0, 
    _YPOLOIPO_ADEIAS_ASTHENEIAS = 0, 
    _YPOLOIPO_ADEIAS_ASTHENEIAS_TREXONTOS_ETOYS = 0,
    _SYNOLO_MIKTON_APODOXON = null;
    
let diasthmataAstheneias = {};
let diasthmataMhErgasimon = {};
let hmeromhniesMhErgasimon = {};
let diasthmataRepo = {};
let hmeromhniesRepo = {};
let diasthmataArgion = {};
let hmeromhniesArgion = {};
let diasthmataArgionSeRepoKaiMhErgasimes = {};
let hmeromhniesArgionSeRepoKaiMhErgasimes = {};

let lhftheisa_adeia = 0,
    synoloProhgoymenonHmeronAstheneias = 0,
    synoloProhgoymenonHmeronGreater3 = 0,
    synoloProhgoymenonHmeronLess3 = 0,
    geniko_synolo_astheneias = 0, 
    differenceInDays = 0;

let anapaysh_repo_hmeromhnies, 
    anapaysh_repo_timh, 
    mh_ergasimes_basei_orarioy_timh, 
    mh_ergasimes_hmeromhnies,
    argies_timh, 
    argies_hmeromhnies,
    hmeromhnia_arxhs_ergasiakoy_etoys, 
    hmeromhnia_teloys_ergasiakoy_etoys, 
    hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys, 
    hmeromhnia_teloys_epomenoy_ergasiakoy_etoys,
    synolo_less_3, 
    synolo_greater_3, 
    geniko_synolo_hmeron_astheneias, 
    oldLess3Value, 
    oldGreater3Value, 
    oldSynoloValue,
    dikaioymenh_astheneia_trexontos_ergasiakoy_etoys,
    dikaioymenh_astheneia_trexontos_ergasiakoy_etoys_timh,
    lhfteisa_adeia_asteneias_prohgoymenon_mhnon,
    lhfteisa_adeia_asteneias_prohgoymenon_mhnon_timh,
    ypoloipo_adeias_astheneias_trexontos_etoys,
    ypoloipo_adeias_astheneias_trexontos_etoys_timh,
    dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys,
    dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys_timh,
    synolo_dikaioymenhs_adeias_astheneias,
    synolo_dikaioymenhs_adeias_astheneias_timh,
    lhftheisa_adeia_astheneias,
    lhftheisa_adeia_astheneias_timh,
    ypoloipo_adeias_astheneias,
    ypoloipo_adeias_astheneias_timh
;
    
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const loaderContainer = document.querySelector(".loader-container");
const saveButton = document.getElementById("saveButton");
const updateButton = document.getElementById("updateButton");
const undoButton = document.getElementById("undoButton");
const deleteButton = document.getElementById("deleteButton");

document.addEventListener("DOMContentLoaded", function () {
    // Global variables

    firstTimeCalcPlhroteo = false;

    let selectedTeam = document.getElementById("team") ? document.getElementById("team").value : null;
    let selectedCompany = document.getElementById("company_kod") ? document.getElementById("company_kod").value : null;
    let _etaireia = null;
    let _ergazomenoi = null;
    let _sxeshErgasias = null;
    let _kathestosApasxolhshs = null;
    let _oikogeneiakhKatastash = null;
    let _typosErgazomenoy = null;
    let _genikesParametroi = null;
    let _asfalistikesKlaseis = null;
    let _astheneies = null;
    let _argies = null;
    let message = null;

    let _MHNAS_APASXOLHSHS = null;
    let _SELECTED_ERGAZOMENOS = null;
    let _PRAGMATIKES_HMERES_ERGASIAS_MHNA = null;
    let _YPOKATASTHMA = null;

    // DOM elements
    const ypokatasthmataDropdown = document.getElementById("ypokatasthma");
    const ergazomenoiDropdown = document.getElementById("ergazomenos_kin");
    const periodoiDropdown = document.getElementById("periodos");
    const typoiApodoxonDropdown = document.getElementById("typosApodoxon");
    const prevButton = document.getElementById("prevButton");
    const nextButton = document.getElementById("nextButton");

    loadYpokatasthmata();

    // Προσθήκη event listeners στα κουμπιά
    prevButton.addEventListener("click", function () {
        navigateDropdown(-1); // Πηγαίνει στην προηγούμενη εγγραφή
    });

    nextButton.addEventListener("click", function () {
        navigateDropdown(1); // Πηγαίνει στην επόμενη εγγραφή
    });

    // Συνάρτηση για πλοήγηση στο dropdown
    function navigateDropdown(direction) {
        const options = ergazomenoiDropdown.options;
        const totalOptions = options.length;
        let currentIndex = ergazomenoiDropdown.selectedIndex;

        // Προσδιορισμός του πρώτου έγκυρου index (παράκαμψη κενής επιλογής αν υπάρχει)
        const firstIndex = options[0].value === '' ? 1 : 0;

        if (currentIndex === -1) {
            currentIndex = firstIndex - direction;
        }

        // Υπολογισμός του νέου index
        let newIndex = currentIndex + direction;

        // Έλεγχος ορίων
        if (newIndex < firstIndex) {
            newIndex = firstIndex;
        } else if (newIndex >= totalOptions) {
            newIndex = totalOptions - 1;
        }

        // Ενημέρωση της επιλογής στο dropdown
        ergazomenoiDropdown.selectedIndex = newIndex;
        document.getElementById("ergazomenos_Hidden").value = ergazomenoiDropdown.value; // Ενημερώνουμε το hidden field με την προεπιλεγμένη τιμή.
        updateLabelsFromHidden("ergazomenos_Hidden", [ 'ergazomenosLabel_Krathseis', 'ergazomenosLabel_Foroi', 'ergazomenosLabel_Astheneia', 'ergazomenosLabel_Adeies' ]);

        // Ενεργοποίηση του event 'change'
        const event = new Event('change', { bubbles: true });
        ergazomenoiDropdown.dispatchEvent(event);

        // Ενημέρωση της κατάστασης των κουμπιών
        updateButtonStates();
    }

    // Συνάρτηση για ενημέρωση της κατάστασης των κουμπιών
    function updateButtonStates() {
        const options = ergazomenoiDropdown.options;
        const currentIndex = ergazomenoiDropdown.selectedIndex;

        const firstIndex = options[0].value === '' ? 1 : 0;
        const lastIndex = options.length - 1;

        prevButton.disabled = currentIndex <= firstIndex;
        nextButton.disabled = currentIndex >= lastIndex;
    }

    // Συνάρτηση χειρισμού αλλαγής του dropdown
    async function handleDropdownChange() {
        updateButtonStates();

        if (loaderContainer) loaderContainer.style.display = "grid";

        try {
            await clearFormFields();

            document.getElementById("synoloMiktonApodoxon_Hidden").value = 0;

            const selectedErgazomenos = ergazomenoiDropdown.value;
            document.getElementById("idHidden").value = selectedErgazomenos;

            const selectedOption = ergazomenoiDropdown.options[ergazomenoiDropdown.selectedIndex];

            if (selectedOption.value) {
                _SELECTED_ERGAZOMENOS = selectedOption.value; // Ορισμός global μεταβλητής

                const txtContent = selectedOption.text;
                const lastFourChars = txtContent.slice(-4).trim();
                document.getElementById("kodikosHidden").value = lastFourChars;
                const selectedKodikos = lastFourChars;
                try {
                    const response = await fetch(`/api/kinhseis/getLoipaStoixeiaErgazomenoy/${selectedTeam}/${selectedCompany}/${selectedKodikos}`);   
                    const result = await response.json();

                    // Ανάθεση τιμών στις global μεταβλητές
                    _ergazomenoi = result.ergazomenoi;
                    _sxeshErgasias = result.sxeshErgasias;
                    _kathestosApasxolhshs = result.kathestosApasxolhshs;
                    _oikogeneiakhKatastash = result.oikogeneiakhKatastash;
                    _typosErgazomenoy = result.typosErgazomenoy;
                    _genikesParametroi = result.genikesParametroi;
                    _asfalistikesKlaseis = result.asfalistikesKlaseis;
                    _argies = result.argies;
                    _etaireia = result.etaireia;
                    _astheneies = result.astheneies;

                    document.getElementById("ergazomenos_Hidden").value = _ergazomenoi.eponymo.trim() + " " + _ergazomenoi.patronymo.substring(0,3).trim() + " " + _ergazomenoi.onoma.trim();
                    updateLabelsFromHidden("ergazomenos_Hidden", [ 'ergazomenosLabel_Krathseis', 'ergazomenosLabel_Foroi', 'ergazomenosLabel_Astheneia', 'ergazomenosLabel_Adeies' ]);

                    // Ενημέρωση των στοιχείων του DOM με τα δεδομένα που λήφθηκαν
                    let originalDate, year, month, day, formattedDate;
                    document.getElementById("value1").textContent = _ergazomenoi.kodikos;
                    if (_ergazomenoi.hmeromhnia_proslhpshs) {
                        originalDate = _ergazomenoi.hmeromhnia_proslhpshs.slice(0, 10);
                        [year, month, day] = originalDate.split('-');
                        formattedDate = `${day}/${month}/${year}`;
                        document.getElementById("hmeromhnia_proslhpshs_hidden").value = originalDate;
                        document.getElementById("value2").textContent = formattedDate;
                    } else {
                        document.getElementById("value2").textContent = "";
                    }
            
                    if (_ergazomenoi.hmeromhnia_lhxhs_symbashs) {
                        originalDate = _ergazomenoi.hmeromhnia_lhxhs_symbashs.slice(0, 10);
                        [year, month, day] = originalDate.split('-');
                        formattedDate = `${day}/${month}/${year}`;
                        document.getElementById("hmeromhnia_lhxhs_symbashs_hidden").value = originalDate;
                        document.getElementById("value3").textContent = formattedDate;
                    } else {
                        document.getElementById("value3").textContent = "";
                    }
            
                    if (_ergazomenoi.hmeromhnia_apoxorhshs) {
                        originalDate = _ergazomenoi.hmeromhnia_apoxorhshs.slice(0, 10);
                        [year, month, day] = originalDate.split('-');
                        formattedDate = `${day}/${month}/${year}`;
                        document.getElementById("hmeromhnia_apoxorhshs_hidden").value = originalDate;
                        document.getElementById("value4").textContent = formattedDate;
                    } else {
                        document.getElementById("value4").textContent = "";
                    }
                    
                    document.getElementById("value5").textContent = _ergazomenoi.xarakthrismos_ergazomenon ? 'ΥΠΑΛΛΗΛΟΣ' : 'ΕΡΓΑΤΗΣ';
                    document.getElementById("value6").textContent = _ergazomenoi?.oikogeneiakh_katastash ? _oikogeneiakhKatastash?.perigrafh : '';
                    document.getElementById("value7").textContent = parseInt(_ergazomenoi.arithmos_teknon);
                    document.getElementById("value8").textContent = _ergazomenoi?.typos_ergazomenon ? _typosErgazomenoy?.perigrafh : '';
                    document.getElementById("value9").textContent = _ergazomenoi?.kathestos_apasxolhshs ? _kathestosApasxolhshs?.perigrafh : '';
                    document.getElementById("value10").textContent = _ergazomenoi?.sxesh_ergasias ? _sxeshErgasias?.perigrafh : '';
                    document.getElementById("value11").textContent = parseFloat(_ergazomenoi.ores_ergasias_ebdomadas).toFixed(2);
                    document.getElementById("value12").textContent = parseFloat(_ergazomenoi.hmeres_ergasias_ebdomadas).toFixed(2);
                    document.getElementById("value13").textContent = _ergazomenoi.palios_neos ? 'ΝΕΟΣ' : 'ΠΑΛΙΟΣ';
                    document.getElementById("value14").textContent = parseFloat(_ergazomenoi.symfonhtheis_misthos_genikos).toFixed(2);
                    document.getElementById("value15").textContent = parseFloat(_ergazomenoi.symfonhtheis_misthos_apasxolhseis).toFixed(2);
                    document.getElementById("value16").textContent = parseInt(_ergazomenoi.paketo_apodoxon);
                    document.getElementById("value17").textContent = parseInt(_ergazomenoi.mhniaia_repo);
                    document.getElementById("eidikhKathgoriaErgazomenoy_Hidden").value = _ergazomenoi.eidikh_kathgoria_ergazomenoy;
                    document.getElementById("oikogeneiakhKatastash_Hidden").value = _ergazomenoi.oikogeneiakh_katastash;
                    document.getElementById("typosErgazomenon_Hidden").value = _ergazomenoi.typos_ergazomenon;
                    document.getElementById("sxeshErgasias_Hidden").value = _ergazomenoi.sxesh_ergasias;
                    document.getElementById("kathestosApasxolhshs_Hidden").value = _ergazomenoi.kathestos_apasxolhshs;
                    document.getElementById("apasxolhshBaseiSymbashs_Hidden").value = _ergazomenoi.apasxolhsh_basei_symbashs;
                    
                    const oresProsthethsErgasias = document.getElementById('oresProsthethsErgasias');
                    const axiaProsthethsErgasias = document.getElementById('axiaProsthethsErgasias');
                    const meioshErgatikhsEisforas = document.getElementById("meioshErgatikhsEisforas");
                    const epidothshErgodotikhsEisforas = document.getElementById("epidothshErgodotikhsEisforas");
                    if (document.getElementById("kathestosApasxolhshs_Hidden").value === "1") {
                        oresProsthethsErgasias.disabled = false;
                        axiaProsthethsErgasias.disabled = false;
                    } else {
                        oresProsthethsErgasias.disabled = true;
                        axiaProsthethsErgasias.disabled = true;  
                    }

                    if (document.getElementById("kathestosApasxolhshs_Hidden").value === "0") {
                        meioshErgatikhsEisforas.disabled = false;
                    } else {
                        meioshErgatikhsEisforas.disabled = true;
                    }

                    loadPeriods();
                    loadTypoiApodoxon();
                    
                    document.getElementById("synoloApodoxon").value = parseFloat(_ergazomenoi.synolo_symbashs_basei_oron_ergasias).toFixed(2);
                    document.getElementById("symfonhtheisMisthos").value = parseFloat(_ergazomenoi.symfonhtheis_misthos_apasxolhseis).toFixed(2);
                    document.getElementById("pragmatikoOromisthio").value = parseFloat(_ergazomenoi.pragmatikoOromisthio).toFixed(2);
                    document.getElementById("pragmatikoHmeromisthio").value = parseFloat(_ergazomenoi.pragmatikoHmeromisthio).toFixed(2);
                    document.getElementById("nomimoOromisthio").value = parseFloat(_ergazomenoi.nomimoOromisthio).toFixed(2);
                    document.getElementById("nomimoHmeromisthio").value = parseFloat(_ergazomenoi.nomimoHmeromisthio).toFixed(2);
                    
                    document.getElementById("oresErgasias").focus();
                } catch (error) {
                    console.error("Fetch error:", error);
                }
            } else {
                document.getElementById("kodikosHidden").value = '';
            }
        } catch (error) {
            console.error("Dropdown change error:", error);
        } finally {
            if (loaderContainer) loaderContainer.style.display = "none";
        }
    }

    // Προσθήκη event listener για το dropdown
    ergazomenoiDropdown.addEventListener("change", handleDropdownChange);

    // Η κλήση κατά την αρχική φόρτωση των εργαζομένων γίνεται από το toggleLabelKinhseis.js

    // Συνάρτηση φόρτωσης εργαζομένων
    async function loadErgazomenoi(energoi, ypokatasthma) {
        // Ανάκτηση των τιμών team και company
        selectedTeam = document.getElementById("team") ? document.getElementById("team").value : null;
        const hmeromhnia_arxhs_periodoy = document.getElementById("etos").value + "-" + document.getElementById("mhnas").value + "-01" +  "T00:00:00.000"
        selectedCompany = document.getElementById("company_kod") ? document.getElementById("company_kod").value : null;

        ergazomenoiDropdown.innerHTML = '';
        const emptyOption = new Option('', '');
        ergazomenoiDropdown.appendChild(emptyOption);

        try {
        const response = await fetch(`/api/kinhseis/getErgazomenoi/${selectedTeam}/${selectedCompany}?energoi=${energoi}&ypokatasthma=${ypokatasthma}&hmeromhnia_arxhs_periodoy=${hmeromhnia_arxhs_periodoy}`);
        const data = await response.json();
        if (data.length === 0) {
            const menuLinks = document.querySelectorAll(".menu_Links ul li");
            menuLinks.forEach((link) => {
                link.classList.add("disabled"); // Προσθέτει την κλάση 'disabled'
            });
            message = `
            <p class="bold-text">Προσοχή !!!)</p>
            <p>&nbsp;</p>
            <p>Δεν βρέθηκαν εργαζόμενοι που να πληρούν τα κριτήρια αναζήτησης.</p>`
            showAlert(message);
            return;
        } else {
            // Enable τα menu links αν υπάρχουν δεδομένα
            const menuLinks = document.querySelectorAll(".menu_Links ul li");
            menuLinks.forEach((link) => {
                link.classList.remove("disabled"); // Αφαιρεί την κλάση 'disabled'
            });
            data.forEach((data) => {
            let txtContent = data.eponymo.substring(0, 25).padEnd(26, '\u00A0') +
                            data.patronymo.substring(0, 3).padEnd(4, '\u00A0') +
                            data.onoma.substring(0, 14).padEnd(15, '\u00A0') + 
                            data.kodikos.substring(0, 4);

            const option = new Option(txtContent, data._id);
            ergazomenoiDropdown.appendChild(option);
            });

            const options = ergazomenoiDropdown.options;
            if (options.length > 1) {
                const firstValidIndex = options[0].value === '' ? 1 : 0;
                ergazomenoiDropdown.selectedIndex = firstValidIndex;
                // Χωρίζουμε το string σε λέξεις χρησιμοποιώντας την `split` με βάση τα κενά (whitespace)
                const trimmedWords = options[1].text.split(/\s+/).filter(word => word.length > 0);
                // Παίρνουμε τις πρώτες 3 λέξεις
                const firstThreeWords = trimmedWords.slice(0, 3);
                // Επανασυνδέουμε τις λέξεις με ένα κενό ανάμεσά τους
                const result = firstThreeWords.join(' ');

                // Ενεργοποίηση του event 'change'
                const event = new Event('change', { bubbles: true });
                ergazomenoiDropdown.dispatchEvent(event);
            } else {
                await clearFormFields();
                await clearValueFields();
            }

            // Ενημέρωση της κατάστασης των κουμπιών
            updateButtonStates();
        }
        } catch (error) {
        console.error(error);
        }
    }
    
    window.loadErgazomenoi = loadErgazomenoi;
    window.navigateDropdown = navigateDropdown;

    async function loadYpokatasthmata() {
        _YPOKATASTHMA = document.getElementById("ypokatasthma").value;

        ypokatasthmataDropdown.innerHTML = '';
        const emptyOption = new Option('ΟΛΑ...', '');
        ypokatasthmataDropdown.appendChild(emptyOption);
        document.getElementById("ypokatasthma_Hidden").value = 'ΟΛΑ...';
        updateLabelsFromHidden('ypokatasthma_Hidden', [ 'ypokatasthmaLabel_Krathseis', 'ypokatasthmaLabel_Foroi', 'ypokatasthmaLabel_Astheneia' ]);

        try {
        const response = await fetch("/api/ypokatasthmata");
        const data = await response.json();
        let textToConvert;

        data.forEach((data) => {
            textToConvert = removeGreekAccentsAndToUpper(data.perigrafh);
            const option = document.createElement("option");
            option.value = data.kodikos;
            option.textContent = textToConvert;

            ypokatasthmataDropdown.appendChild(option);

            if (data.kodikos === _YPOKATASTHMA) {
            option.selected = true;
            // Προσομοίωση της αλλαγής για την ενεργοποίηση του event listener
            ypokatasthmataDropdown.value = data.kodikos;

            const changeEvent = new Event("change", { bubbles: true });
            ypokatasthmataDropdown.dispatchEvent(changeEvent);
            }
        });
        } catch (error) {
        console.error(error);
        }
    }

    // Συνάρτηση φόρτωσης περιόδων
    async function loadPeriods() {
        if (!_SELECTED_ERGAZOMENOS) return;

        _MHNAS_APASXOLHSHS = document.getElementById("mhnas").value;

        periodoiDropdown.innerHTML = '';
        const emptyOption = new Option('', '');
        periodoiDropdown.appendChild(emptyOption);

        try {
        const response = await fetch("/api/periodoi");
        const data = await response.json();
        let textToConvert;

        data.forEach((data) => {
            textToConvert = removeGreekAccentsAndToUpper(data.perigrafh);
            const option = document.createElement("option");
            option.value = data.kodikos;
            option.textContent = textToConvert;

            periodoiDropdown.appendChild(option);

            if (data.kodikos === _MHNAS_APASXOLHSHS) {
            option.selected = true;
            // Προσομοίωση της αλλαγής για την ενεργοποίηση του event listener
            periodoiDropdown.value = data.kodikos;
            const changeEvent = new Event("change", { bubbles: true });
            periodoiDropdown.dispatchEvent(changeEvent);
            }
        });
        } catch (error) {
        console.error(error);
        }
    }

    function formatValue(value) {
        return (value && !isNaN(value)) ? parseFloat(value).toFixed(4) : 0;
    }
    
    periodoiDropdown.addEventListener("change", async () => {
        // sharedParams = Αντικείμενο που περιέχει διάφορες μεταβλητές και το οποίο χρησιμοποιείται σε περίπτωση change μιας τιμής πχ περίοδος, όταν το addEventListener βρίσκεται σε εξωτερικό αρχείο JS
        window.sharedParams = {
            ergazomenoi: _ergazomenoi,
            sxeshErgasias: _sxeshErgasias,
            kathestosApasxolhshs: _kathestosApasxolhshs,
            oikogeneiakhKatastash: _oikogeneiakhKatastash,
            typosErgazomenoy: _typosErgazomenoy,
            genikesParametroi: _genikesParametroi,
            asfalistikesKlaseis: _asfalistikesKlaseis,
            astheneies: _astheneies,
            etaireia: _etaireia,
            _TEAM: document.getElementById("team").value,
            _COMPANY: document.getElementById("company_kod").value,
            _XRHSH: document.getElementById("etos").value,
            _KODIKOS_ETAIREIAS: _etaireia.kod,
            _SYNOLO_ERGASIMON_HMERON_MHNA: 0,
            _ERGASIMES_HMERES_MHNA: 0,
            _MH_ERGASIMES_HMERES_MHNA: 0,
            _ETHSIES_ORES_YPERORION: 0,
            _PROSAYXHSH_HMERON_5MERHS_ERGASIAS: 0,
            startDate: null,
            endDate: null
        };

        let sharedParams = window.sharedParams;
        console.log(sharedParams);

        // Δημιουργία του CustomEvent με τις παραμέτρους
        let event = new CustomEvent('sharedParamsLoaded', { detail: sharedParams });
        // Πυροδότηση του event
        document.dispatchEvent(event);
        
        await clearFormFields();

        const selectedPeriodos = periodoiDropdown.value;
        const selectedTyposApodoxon = typoiApodoxonDropdown.value

        await updateSessionPeriodos(selectedPeriodos);

        const synoloYperorion_data = await fetch(`/api/kinhseis/getEthsioSynoloYperorion?team=${selectedTeam}&company=${selectedCompany}&employeeKod=${document.getElementById("kodikosHidden").value}&xrhsh=${document.getElementById("etos").value}`);

        const ethsiesYperories_result = await synoloYperorion_data.json();
        let _ETHSIES_ORES_YPERORION = parseFloat(ethsiesYperories_result.total_ores_yperorias);
        document.getElementById("orioYperorion_Hidden").value = _ETHSIES_ORES_YPERORION;
        document.getElementById("aa_misthodosias_Hidden").value = document.getElementById("aaMisthodosias").value;
        
        let etosXrhshs = document.getElementById("etos").value;
        let mhnasXrhshs = periodoiDropdown.value;
        const startDate = new Date(Date.UTC(parseInt(etosXrhshs), parseInt(mhnasXrhshs) - 1, 1, 0, 0, 0, 0));
        const startDateISOString = startDate.toISOString();
        const endDate = new Date(Date.UTC(parseInt(etosXrhshs), parseInt(mhnasXrhshs) - 1, new Date(etosXrhshs, mhnasXrhshs, 0).getDate(), 0, 0, 0, 0));
        const endDateISOString = endDate.toISOString();
        
        // sharedParams._ERGASIMES_HMERES_MHNA = _PRAGMATIKES_HMERES_ERGASIAS_MHNA;
        sharedParams.startDate = startDateISOString;
        sharedParams.endDate = endDateISOString;

        const apasxolhseis_data = await fetch(`/api/kinhseis/getApasxolhseis?team=${selectedTeam}&company=${selectedCompany}&employeeKod=${document.getElementById("kodikosHidden").value}&xrhsh=${document.getElementById("etos").value}&periodos=${selectedPeriodos}&typos_apodoxon=${selectedTyposApodoxon}&aa_misthodosias=${document.getElementById("aaMisthodosias").value}`);

        const apasxolhseis_result = await apasxolhseis_data.json();
        
        if (!apasxolhseis_result || apasxolhseis_result.length === 0) {
            hasRecord = false;

            document.querySelectorAll("[id^=saveButton]").forEach(saveButton => {
                // const section = saveButton.closest("section"); // Βρίσκουμε το section που ανήκει το κουμπί
                // if (!section) return;
                applyButtonPermissions(hasRecord);
            });
            
            _PRAGMATIKES_HMERES_ERGASIAS_MHNA = await ypologismosPragmatikonErgasimonHmeronMhna(
                document.getElementById("etos").value,
                selectedPeriodos,
                document.getElementById("apasxolhshBaseiSymbashs_Hidden").value,
                _genikesParametroi,
                _argies,
                _ergazomenoi.xarakthrismos_ergazomenon,
                _ergazomenoi.hmeromhnia_proslhpshs,
                _ergazomenoi.hmeromhnia_apoxorhshs
            );
            
            if (_PRAGMATIKES_HMERES_ERGASIAS_MHNA === 0) {
                message = `
                <p class="bold-text">Τα στοιχεία του εργαζόμενου είναι ελλιπή.</p>
                <p>&nbsp;</p>
                <p style="margin-top: 1.5rem; margin-bottom: 1rem;">Διορθώστε τα στοιχεία του και ξαναπροσπαθήστε...</p>`
                showAlert(message);
            }

            sharedParams._ERGASIMES_HMERES_MHNA = _PRAGMATIKES_HMERES_ERGASIAS_MHNA;
            
            document.dispatchEvent(new Event('sharedParamsReady'));
            document.getElementById("kodikosHidden").value = sharedParams.ergazomenoi.kodikos;
            const data = await fetch(`/api/kinhseis/calcTotals?team=${selectedTeam}&company=${selectedCompany}&employeeKod=${document.getElementById("kodikosHidden").value}&startDate=${startDateISOString}&endDate=${endDateISOString}`);
            const result = await data.json();
            
            // Ενημέρωση Ωρών Υπερβάλλουσας Εργασίας    
            document.getElementById("oresArgion").value = formatValue(result.total_ores_argion);
            document.getElementById("oresNyxtas").value = formatValue(result.total_ores_nyxtas);

            document.getElementById("oresYperergasias").value = formatValue(result.total_ores_yperergasias);
            document.getElementById("oresYperergasiasArgion").value = formatValue(result.total_ores_yperergasias_argion);
            document.getElementById("oresYperergasiasNyxtas").value = formatValue(result.total_ores_yperergasias_nyxtas);
            document.getElementById("oresYperergasiasArgionNyxtas").value = formatValue(result.total_ores_yperergasias_argion_nyxtas);

            document.getElementById("oresNomimhsYperorias").value = formatValue(result.total_ores_nomimhs_yperorias);
            document.getElementById("oresNomimhsYperoriasArgion").value = formatValue(result.total_ores_nomimhs_yperorias_argion);
            document.getElementById("oresNomimhsYperoriasNyxtas").value = formatValue(result.total_ores_nomimhs_yperorias_nyxtas);
            document.getElementById("oresNomimhsYperoriasArgionNyxtas").value = formatValue(result.total_ores_nomimhs_yperorias_argion_nyxtas);

            document.getElementById("oresParanomhsYperorias").value = formatValue(result.total_ores_paranomhs_yperorias);
            document.getElementById("oresParanomhsYperoriasArgion").value = formatValue(result.total_ores_paranomhs_yperorias_argion);
            document.getElementById("oresParanomhsYperoriasNyxtas").value = formatValue(result.total_ores_paranomhs_yperorias_nyxtas);
            document.getElementById("oresParanomhsYperoriasArgionNyxtas").value = formatValue(result.total_ores_paranomhs_yperorias_argion_nyxtas);

            event = new Event('change');   // Δημιουργία του change event
            document.getElementById("oresArgion").dispatchEvent(event);
            document.getElementById("oresNyxtas").dispatchEvent(event);

            document.getElementById("oresYperergasias").dispatchEvent(event);
            document.getElementById("oresYperergasiasArgion").dispatchEvent(event);
            document.getElementById("oresYperergasiasNyxtas").dispatchEvent(event);
            document.getElementById("oresYperergasiasArgionNyxtas").dispatchEvent(event);

            document.getElementById("oresNomimhsYperorias").dispatchEvent(event);
            document.getElementById("oresNomimhsYperoriasArgion").dispatchEvent(event);
            document.getElementById("oresNomimhsYperoriasNyxtas").dispatchEvent(event);
            document.getElementById("oresNomimhsYperoriasArgionNyxtas").dispatchEvent(event);

            document.getElementById("oresParanomhsYperorias").dispatchEvent(event);
            document.getElementById("oresParanomhsYperoriasArgion").dispatchEvent(event);
            document.getElementById("oresParanomhsYperoriasNyxtas").dispatchEvent(event);
            document.getElementById("oresParanomhsYperoriasArgionNyxtas").dispatchEvent(event);

            document.getElementById("oresErgasias6Hmeras").dispatchEvent(event);
            
            document.getElementById("oresProsthethsErgasias").dispatchEvent(event);
            document.getElementById("taktikesApodoxesMhYpologizomenesSeDora").dispatchEvent(event);
            document.getElementById("taktikesApodoxesYpologizomenesSeDora").dispatchEvent(event);
            document.getElementById("epimerizomenesSeMhnesErgasias").dispatchEvent(event);
            document.getElementById("primBonus").dispatchEvent(event);
            document.getElementById("apallassomenesForoy").dispatchEvent(event);
            document.getElementById("apallassomenesKrathseon").dispatchEvent(event);
            
            var hmeresErgasiasElem = document.getElementById("hmeresErgasias");
            var oresErgasiasElem = document.getElementById("oresErgasias");
            window.isManualEntry = false; // Ορισμός σε global scope ενός Flag για να παρακολουθεί αν θα γίνει χειροκίνητη εισαγωγή

            // Ελέγχουμε αν το result είναι κενό
            if (Object.keys(result).length === 0) {
                hmeresErgasiasElem.readOnly = false;
                oresErgasiasElem.readOnly = false;
                hmeresErgasiasElem.value = 0;
                oresErgasiasElem.value = 0;
                window.isManualEntry = true;
                hmeresErgasiasElem.focus();
            } else {
                hmeresErgasiasElem.readOnly = true;
                oresErgasiasElem.readOnly = false;
            }
            
            hmeresErgasiasElem.value = (result.countNotAN_ME && !isNaN(result.countNotAN_ME)) ? parseInt(result.countNotAN_ME) : 0;
            // oresErgasiasElem.value = (result.total_ores_ergasias && !isNaN(result.total_ores_ergasias)) ? parseFloat(result.total_ores_ergasias).toFixed(4) : 0;

            event = new Event('change');   // Δημιουργία του change event
            document.getElementById("hmeresErgasias").dispatchEvent(event);   // Πυροδότηση του change event
        } else {
            await handleFillFields(apasxolhseis_result, sharedParams)

            // document.querySelectorAll("[id^=saveButton]").forEach(saveButton => {
                // const section = saveButton.closest("section"); // Βρίσκουμε το section που ανήκει το κουμπί
                // if (!section) return;
            
                applyButtonPermissions(hasRecord);
            // });

            return;
        }
    });

    async function loadTypoiApodoxon() {
        if (!_SELECTED_ERGAZOMENOS) return;
        let _TYPOS_APODOXON = document.getElementById("typ_apod").value;

        typoiApodoxonDropdown.innerHTML = '';
        const emptyOption = new Option('', '');
        typoiApodoxonDropdown.appendChild(emptyOption);

        try {
            const response = await fetch("/api/kinhseis/typoiApodoxon");
            const data = await response.json();
            let textToConvert;

            data.forEach((data) => {
                textToConvert = removeGreekAccentsAndToUpper(data.perigrafh);
                const option = document.createElement("option");
                option.value = data.kodikos;
                option.textContent = textToConvert;
                typoiApodoxonDropdown.appendChild(option);

            if (data.kodikos === _TYPOS_APODOXON) {
                option.selected = true;
                // Προσομοίωση της αλλαγής για την ενεργοποίηση του event listener
                typoiApodoxonDropdown.value = data.kodikos;
                const changeEvent = new Event("change", { bubbles: true });
                typoiApodoxonDropdown.dispatchEvent(changeEvent);
            }

        });
        } catch (error) {
            console.error(error);
        }
    }

    typoiApodoxonDropdown.addEventListener("change", async () => {
        const selectedTyposApodoxon = typoiApodoxonDropdown.value;
        document.getElementById("typosApodoxon_Hidden").value = selectedTyposApodoxon ? selectedTyposApodoxon : '';
        await updateSession(selectedTyposApodoxon);

        if (periodoiDropdown.value) {
            const changeEvent = new Event("change", { bubbles: true });
            periodoiDropdown.dispatchEvent(changeEvent);
        }
    });

    async function updateSession(selectedTyposApodoxon) {
        try {
            const response = await fetch('/api/update_session_typosApodoxon', {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json'
                },
                body: JSON.stringify({ typosApodoxon: selectedTyposApodoxon })
            });
        
            const result = await response.json();
        
            if (!result.success) {
                console.error('Σφάλμα κατά την ενημέρωση του session:', result.message);
            }
        } catch (error) {
            console.error('Σφάλμα κατά την αποστολή των δεδομένων:', error);
        }
    }

    async function updateSessionPeriodos(selectedPeriodos) {
        try {
            const response = await fetch('/api/update_session_periodos', {
                    method: 'POST',
                    headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ periodos: selectedPeriodos })
            });
        
            const result = await response.json();
        
            if (!result.success) {
                console.error('Σφάλμα κατά την ενημέρωση του session:', result.message);
            }
        } catch (error) {
            console.error('Σφάλμα κατά την αποστολή των δεδομένων:', error);
        }
    }

    async function mhnyma() {
        Swal.fire({
            icon: "info",
            title: " ",
            html: `
                Υπάρχει ήδη η εγγραφή...
            `,
            showConfirmButton: false,
            timer: 1500
        });
    }



    async function updatePosostaFields(i) {
        const index = i.toString().padStart(2, '0');
        const dropdown = document.getElementById(`krathsh_${index}`);
        const selectedOption = dropdown.options[dropdown.selectedIndex];
    
        if (!selectedOption) return;
    
        // Ενημέρωση τιμών των πεδίων
        setValue(`pososto_krathshs_ergazomenoy_${index}`, selectedOption.dataset.posostoErgazomenoy, 4, false, true);
        setValue(`pososto_krathshs_ergodoth_${index}`, selectedOption.dataset.posostoErgodoth, 4, false, true);
        setValue(`synolo_pososton_krathshs_${index}`, selectedOption.dataset.synoloPososton, 4, false, true);
    
        setValue(`poso_krathshs_ergazomenoy_${index}`, selectedOption.dataset.posoErgazomenoy, 2, false, true);
        setValue(`poso_krathshs_ergodoth_${index}`, selectedOption.dataset.posoErgodoth, 2, false, true);
        setValue(`synolo_poson_krathshs_${index}`, selectedOption.dataset.synoloPoson, 2, false, true);
    
        setValue(`anotato_orio_palion_${index}`, selectedOption.dataset.anotatoOrioPalion, 2, false, true);
        setValue(`anotato_orio_neon_${index}`, selectedOption.dataset.anotatoOrioNeon, 2, false, true);
        
        setValue(`ypologizomenoStoForo_${index}`, selectedOption.dataset.ypologizomenoStoForo, null, true);
        setValue(`ypologizomenoEpiPlasmatikhs_${index}`, selectedOption.dataset.ypologizomenoEpiPlasmatikhs, null, true);
        setValue(`plasmatikh_axia_${index}`, selectedOption.dataset.plasmatikhAxia, 2, false, true);
        setValue(`asfalistikesApodoxes_${index}`, selectedOption.dataset.asfalistikesApodoxes, 2, false, true);
        setValue(`apaiteitai_apodoxes_asfalishs_${index}`, selectedOption.dataset.apaiteitaiApodoxesAsfalishs, null, true);
    
        setValue(`kad_${index}`, selectedOption.dataset.kad, null, false, false);
        setValue(`eidikothta_${index}`, selectedOption.dataset.eidikothta, null, false, false);
        setValue(`kpk_${index}`, selectedOption.dataset.kpk, null, false, false);
        setValue(`se_typos_apodoxon_${index}`, selectedOption.dataset.se_typos_apodoxon, null, false, false);
        setValue(`epa_${index}`, selectedOption.dataset.epa, null, false, false);
    
        // Έλεγχος αν πρέπει τα πεδία να είναι readonly
        const readonlyFields = [
            `pososto_krathshs_ergazomenoy_${index}`,
            `pososto_krathshs_ergodoth_${index}`,
            `poso_krathshs_ergazomenoy_${index}`,
            `poso_krathshs_ergodoth_${index}`,
        ];
    
        if (dropdown.selectedIndex === 0) {
            readonlyFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) field.setAttribute('readonly', true);
            });
        } else {
            readonlyFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) field.removeAttribute('readonly');
            });
        }
        
        // Υπολογισμός αξίας κρατήσεων
        await ypologismosAxiasKrathseon();
    }
    
    function setValue(fieldId, value, decimalPlaces = null, isBoolean = false, format = false) {
        const field = document.getElementById(fieldId);
    
        if (!field) {
            console.warn(`Field with ID "${fieldId}" not found.`);
            return;
        }
    
        if (isBoolean) {
            field.value = value === "true" ? "true" : "false"; // Εξασφαλίζει ότι η τιμή είναι πάντα "true" ή "false"
            return;
        }
    
        if (decimalPlaces === null) {
            field.value = value || ''; // Αντιστοίχιση της αρχικής τιμής ως string
            return;
        }
    
        const parsedValue = parseFloat(value);
    
        if (isNaN(parsedValue)) {
            field.value = decimalPlaces ? `0.${'0'.repeat(decimalPlaces)}` : '';
        } else {
            field.value = format ? parsedValue.toFixed(decimalPlaces).replace('.', ',') : parsedValue.toFixed(decimalPlaces);
        }
    }

    async function clearRowFields(index) {
        const fields = [
            `krathsh_${index}`,
            `pososto_krathshs_ergazomenoy_${index}`,
            `pososto_krathshs_ergodoth_${index}`,
            `synolo_pososton_krathshs_${index}`,
            `poso_krathshs_ergazomenoy_${index}`,
            `poso_krathshs_ergodoth_${index}`,
            `synolo_poson_krathshs_${index}`,
            `axia_krathshs_ergazomenoy_${index}`,
            `axia_krathshs_ergodoth_${index}`,
            `ypologizomenoStoForo_${index}`,
            `ypologizomenoEpiPlasmatikhs_${index}`,
            `plasmatikh_axia_${index}`,
            `asfalistikesApodoxes_${index}`,
            `apaiteitai_apodoxes_asfalishs_${index}`,
            `kad_${index}`,
            `eidikothta_${index}`,
            `kpk_${index}`,
            `se_typos_apodoxon_${index}`,
            `epa_${index}`,
        ];
    
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (field.tagName === 'SELECT') {
                    field.selectedIndex = 0; // Επαναφορά της επιλογής
                } else {
                    field.value = ''; // Επαναφορά της τιμής
                }
            }
        });
    
        // Έλεγχος αν το dropdown είναι κενό
        const dropdown = document.getElementById(`krathsh_${index}`);
        const readonlyFields = [
            `pososto_krathshs_ergazomenoy_${index}`,
            `pososto_krathshs_ergodoth_${index}`,
            `poso_krathshs_ergazomenoy_${index}`,
            `poso_krathshs_ergodoth_${index}`,
        ];
    
        if (!dropdown || dropdown.selectedIndex === 0) {
            // Κάνε τα πεδία readonly αν δεν υπάρχει επιλεγμένο στοιχείο
            readonlyFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) field.setAttribute('readonly', true);
            });
        } else {
            // Αφαίρεσε το readonly αν υπάρχει επιλεγμένο στοιχείο
            readonlyFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) field.removeAttribute('readonly');
            });
        }
        await ypologismosAxiasKrathseon();
        // await calcPlhroteo();
    }

    async function handleFillFields(apasxolhseis_result, sharedParams) {
        if (hasRecord) return;
    
        const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1'; 

        try {
            // Χρησιμοποιούμε dynamic import()
            let module = isProduction ? await import('/min.js/kinhseis/fillFieldsKinhseon.min.js') : await import('../ypologismoi/fillFieldsKinhseon.js');
            
            // Αποσυγκέντρωση των συναρτήσεων αφού φορτωθεί το module
            const { 
                fillFields, 
                loadKrathseis_Edit,
                updatePosostaFields_Edit,
                setValue_Edit,
                clearRowFields_Edit
            } = module;
                    
            // Καλείται η συνάρτηση του module με το sharedParams
            if (module) {
                await fillFields(apasxolhseis_result, sharedParams);
            }

        } catch (error) {
            console.error(`Σφάλμα κατά τη φόρτωση του module:`, error);
        }
    }



});
