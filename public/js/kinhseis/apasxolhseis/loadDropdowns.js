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
        _ETHSIES_ORES_YPERORION = parseFloat(ethsiesYperories_result.total_ores_yperorias);
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
            _TYPOS_APODOXON = document.getElementById("typ_apod").value;

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

    // window.fillFields = async function (result, sharedParams) {
    //     if (loaderContainer) loaderContainer.style.display = "grid";
        
    //     firstTimeCalcPlhroteo = true;
    //     hasRecord = true;
        
    //     const saveButton = document.getElementById("saveButton");
    //     const updateButton = document.getElementById("updateButton");
    //     const deleteButton = document.getElementById("deleteButton");
        
    //     // Ανάγνωση των data-attributes από το κουμπί
    //     const isAdmin = updateButton.getAttribute("data-admin") === "true";
    //     const canCreate = saveButton.getAttribute("data-create") === "true";
    //     const canUpdate = updateButton.getAttribute("data-update") === "true";
    //     const canDelete = deleteButton.getAttribute("data-delete") === "true";
    
    //     // Εφαρμογή των κανόνων απενεργοποίησης για saveButton
    //     if (!isAdmin && !canCreate) {
    //         disableSaveButton(saveButton);
    //     } else if (isAdmin && !canCreate) {
    //         disableSaveButton(saveButton);
    //     } else {
    //         disableSaveButton(saveButton);
    //     }
        
    //     // Εφαρμογή των κανόνων απενεργοποίησης για updateButton
    //     if (!isAdmin && !canUpdate) {
    //         disableButton(updateButton);
    //     } else if (isAdmin && !canUpdate) {
    //         disableButton(updateButton);
    //     } else {
    //         enableButton(updateButton);
    //     }
        
    //     // Eφαρμογή των κανόνων απενεργοποίησης για deleteButton
    //     if (!isAdmin && !canDelete) {
    //         disableButton(deleteButton);
    //     } else if (isAdmin && !canDelete) {
    //         disableButton(deleteButton);
    //     } else {
    //         enableButton(deleteButton);
    //     }

    //     toggleReadonlyFields(true);

    //     let _AA_KRATHSEON = 0;
    //     await clearFormFields();
    //     await clearValueFields();

    //     if (deleteButton) {
    //         deleteButton.addEventListener("click", async (event) => {
    //             event.preventDefault(); // Αποτρέπει το default action
    //             await deleteRecord(result._id);
    //         });
    //     }
    
    //     selectedKodikos = result.kodikos;
    //     const response = await fetch(`/api/kinhseis/getLoipaStoixeiaErgazomenoy/${selectedTeam}/${selectedCompany}/${selectedKodikos}`);   
    //     const _result = await response.json();

    //     // Ανάθεση τιμών στις global μεταβλητές
    //     _ergazomenoi = _result.ergazomenoi;
    //     _sxeshErgasias = _result.sxeshErgasias;
    //     _kathestosApasxolhshs = _result.kathestosApasxolhshs;
    //     _oikogeneiakhKatastash = _result.oikogeneiakhKatastash;
    //     _typosErgazomenoy = _result.typosErgazomenoy;
    //     _genikesParametroi = _result.genikesParametroi;
    //     _asfalistikesKlaseis = _result.asfalistikesKlaseis;
    //     _argies = _result.argies;
    //     _etaireia = _result.etaireia;
    //     _astheneies = _result.astheneies;

    //     document.getElementById("ergazomenos_Hidden").value = _ergazomenoi.eponymo.trim() + " " + _ergazomenoi.patronymo.substring(0,3).trim() + " " + _ergazomenoi.onoma.trim();
    //     updateLabelsFromHidden("ergazomenos_Hidden", [ 'ergazomenosLabel_Krathseis', 'ergazomenosLabel_Foroi', 'ergazomenosLabel_Astheneia', 'ergazomenosLabel_Adeies' ]);

    //     // Ενημέρωση των στοιχείων του DOM με τα δεδομένα που λήφθηκαν
    //     let originalDate, year, month, day, formattedDate;
    //     document.getElementById("value1").textContent = _ergazomenoi.kodikos;
    //     if (_ergazomenoi.hmeromhnia_proslhpshs) {
    //         originalDate = _ergazomenoi.hmeromhnia_proslhpshs.slice(0, 10);
    //         [year, month, day] = originalDate.split('-');
    //         formattedDate = `${day}/${month}/${year}`;
    //         document.getElementById("hmeromhnia_proslhpshs_hidden").value = originalDate;
    //         document.getElementById("value2").textContent = formattedDate;
    //     } else {
    //         document.getElementById("value2").textContent = "";
    //     }

    //     if (_ergazomenoi.hmeromhnia_lhxhs_symbashs) {
    //         originalDate = _ergazomenoi.hmeromhnia_lhxhs_symbashs.slice(0, 10);
    //         [year, month, day] = originalDate.split('-');
    //         formattedDate = `${day}/${month}/${year}`;
    //         document.getElementById("hmeromhnia_lhxhs_symbashs_hidden").value = originalDate;
    //         document.getElementById("value3").textContent = formattedDate;
    //     } else {
    //         document.getElementById("value3").textContent = "";
    //     }

    //     if (_ergazomenoi.hmeromhnia_apoxorhshs) {
    //         originalDate = _ergazomenoi.hmeromhnia_apoxorhshs.slice(0, 10);
    //         [year, month, day] = originalDate.split('-');
    //         formattedDate = `${day}/${month}/${year}`;
    //         document.getElementById("hmeromhnia_apoxorhshs_hidden").value = originalDate;
    //         document.getElementById("value4").textContent = formattedDate;
    //     } else {
    //         document.getElementById("value4").textContent = "";
    //     }
        
    //     document.getElementById("value5").textContent = _ergazomenoi.xarakthrismos_ergazomenon ? 'ΥΠΑΛΛΗΛΟΣ' : 'ΕΡΓΑΤΗΣ';
    //     document.getElementById("value6").textContent = _ergazomenoi?.oikogeneiakh_katastash ? _oikogeneiakhKatastash?.perigrafh : '';
    //     document.getElementById("value7").textContent = parseInt(_ergazomenoi.arithmos_teknon);
    //     document.getElementById("value8").textContent = _ergazomenoi?.typos_ergazomenon ? _typosErgazomenoy?.perigrafh : '';
    //     document.getElementById("value9").textContent = _ergazomenoi?.kathestos_apasxolhshs ? _kathestosApasxolhshs?.perigrafh : '';
    //     document.getElementById("value10").textContent = _ergazomenoi?.sxesh_ergasias ? _sxeshErgasias?.perigrafh : '';
    //     document.getElementById("value11").textContent = parseFloat(_ergazomenoi.ores_ergasias_ebdomadas).toFixed(2);
    //     document.getElementById("value12").textContent = parseFloat(_ergazomenoi.hmeres_ergasias_ebdomadas).toFixed(2);
    //     document.getElementById("value13").textContent = _ergazomenoi.palios_neos ? 'ΝΕΟΣ' : 'ΠΑΛΙΟΣ';
    //     document.getElementById("value14").textContent = parseFloat(_ergazomenoi.symfonhtheis_misthos_genikos).toFixed(2);
    //     document.getElementById("value15").textContent = parseFloat(_ergazomenoi.symfonhtheis_misthos_apasxolhseis).toFixed(2);
    //     document.getElementById("value16").textContent = parseInt(_ergazomenoi.paketo_apodoxon);
    //     document.getElementById("value17").textContent = parseInt(_ergazomenoi.mhniaia_repo);
    //     document.getElementById("eidikhKathgoriaErgazomenoy_Hidden").value = _ergazomenoi.eidikh_kathgoria_ergazomenoy;
    //     document.getElementById("oikogeneiakhKatastash_Hidden").value = _ergazomenoi.oikogeneiakh_katastash;
    //     document.getElementById("typosErgazomenon_Hidden").value = _ergazomenoi.typos_ergazomenon;
    //     document.getElementById("sxeshErgasias_Hidden").value = _ergazomenoi.sxesh_ergasias;
    //     document.getElementById("kathestosApasxolhshs_Hidden").value = _ergazomenoi.kathestos_apasxolhshs;
    //     document.getElementById("apasxolhshBaseiSymbashs_Hidden").value = _ergazomenoi.apasxolhsh_basei_symbashs;

    //     _AA_KRATHSEON = parseInt(sharedParams.genikesParametroi[23].timh)
    //     const data = await fetchKrathseisData(); // Μία κλήση στον server
    //     await generateSelectRowsOfKrathseis(data, sharedParams); // Δημιουργία dropdowns

    //     document.getElementById("synoloApodoxon").value = parseFloat(result.synolo_apodoxon).toFixed(2); 
    //     document.getElementById("symfonhtheisMisthos").value = parseFloat(result.symfonhtheis_misthos).toFixed(2); 
    //     document.getElementById("nomimoHmeromisthio").value = parseFloat(result.nomimo_hmeromisthio).toFixed(2); 
    //     document.getElementById("pragmatikoHmeromisthio").value = parseFloat(result.pragmatiko_hmeromisthio).toFixed(2); 
    //     document.getElementById("nomimoOromisthio").value = parseFloat(result.nomimo_oromisthio).toFixed(2); 
    //     document.getElementById("pragmatikoOromisthio").value = parseFloat(result.pragmatiko_oromisthio).toFixed(2); 
    //     document.getElementById("hmeresErgasias").value = parseInt(result.hmeres_ergasias); 
    //     document.getElementById("oresErgasias").value = parseFloat(result.ores_ergasias).toFixed(4); 
    //     document.getElementById("hmeresApoysias").value = parseInt(result.hmeres_apoysias); 
    //     document.getElementById("oresApoysias").value = parseFloat(result.ores_apoysias).toFixed(4); 
    //     document.getElementById("hmeresErgasiasMeionApoysies").value = parseInt(result.hmeres_ergasias_meion_apoysies); 
    //     document.getElementById("oresErgasiasMeionApoysies").value = parseFloat(result.ores_ergasias_meion_apoysies).toFixed(4); 
    //     document.getElementById("hmeresAsfalishs").value = parseInt(result.hmeres_asfalishs); 
        
    //     document.getElementById("oresArgion").value = parseFloat(result.ores_argion); 
    //     document.getElementById("axiaArgion").value = parseFloat(result.axia_argion).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaArgion").value = parseFloat(result.asfalistikh_axia_argion).toFixed(2); 

    //     document.getElementById("oresNyxtas").value = parseFloat(result.ores_nyxtas); 
    //     document.getElementById("axiaNyxtas").value = parseFloat(result.axia_nyxtas).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaNyxtas").value = parseFloat(result.asfalistikh_axia_nyxtas).toFixed(2); 

    //     document.getElementById("oresYperergasias").value = parseFloat(result.ores_yperergasias); 
    //     document.getElementById("axiaYperergasias").value = parseFloat(result.axia_yperergasias).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaYperergasias").value = parseFloat(result.asfalistikh_axia_yperergasias).toFixed(2); 
    //     document.getElementById("oresYperergasiasNyxtas").value = parseFloat(result.ores_yperergasias_nyxtas); 
    //     document.getElementById("axiaYperergasiasNyxtas").value = parseFloat(result.axia_yperergasias_nyxtas).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaYperergasiasNyxtas").value = parseFloat(result.asfalistikh_axia_yperergasias_nyxtas).toFixed(2); 
    //     document.getElementById("oresYperergasiasArgion").value = parseFloat(result.ores_yperergasias_argion); 
    //     document.getElementById("axiaYperergasiasArgion").value = parseFloat(result.axia_yperergasias_argion).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaYperergasiasArgion").value = parseFloat(result.asfalistikh_axia_yperergasias_argion).toFixed(2); 
    //     document.getElementById("oresYperergasiasArgionNyxtas").value = parseFloat(result.ores_yperergasias_argion_nyxtas); 
    //     document.getElementById("axiaYperergasiasArgionNyxtas").value = parseFloat(result.axia_yperergasias_argion_nyxtas).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaYperergasiasArgionNyxtas").value = parseFloat(result.asfalistikh_axia_yperergasias_argion_nyxtas).toFixed(2); 

    //     document.getElementById("oresNomimhsYperorias").value = parseFloat(result.ores_nomimhs_yperorias); 
    //     document.getElementById("axiaNomimhsYperorias").value = parseFloat(result.axia_nomimhs_yperorias).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaNomimhsYperorias").value = parseFloat(result.asfalistikh_axia_nomimhs_yperorias).toFixed(2); 
    //     document.getElementById("oresNomimhsYperoriasNyxtas").value = parseFloat(result.ores_nomimhs_yperorias_nyxtas); 
    //     document.getElementById("axiaNomimhsYperoriasNyxtas").value = parseFloat(result.axia_nomimhs_yperorias_nyxtas).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaNomimhsYperoriasNyxtas").value = parseFloat(result.asfalistikh_axia_nomimhs_yperorias_nyxtas).toFixed(2); 
    //     document.getElementById("oresNomimhsYperoriasArgion").value = parseFloat(result.ores_nomimhs_yperorias_argion); 
    //     document.getElementById("axiaNomimhsYperoriasArgion").value = parseFloat(result.axia_nomimhs_yperorias_argion).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaNomimhsYperoriasArgion").value = parseFloat(result.asfalistikh_axia_nomimhs_yperorias_argion).toFixed(2); 
    //     document.getElementById("oresNomimhsYperoriasArgionNyxtas").value = parseFloat(result.ores_nomimhs_yperorias_argion_nyxtas); 
    //     document.getElementById("axiaNomimhsYperoriasArgionNyxtas").value = parseFloat(result.axia_nomimhs_yperorias_argion_nyxtas).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaNomimhsYperoriasArgionNyxtas").value = parseFloat(result.asfalistikh_axia_nomimhs_yperorias_argion_nyxtas).toFixed(2); 

    //     document.getElementById("oresParanomhsYperorias").value = parseFloat(result.ores_paranomhs_yperorias); 
    //     document.getElementById("axiaParanomhsYperorias").value = parseFloat(result.axia_paranomhs_yperorias).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaParanomhsYperorias").value = parseFloat(result.axia_paranomhs_yperorias).toFixed(2); 
    //     document.getElementById("oresParanomhsYperoriasNyxtas").value = parseFloat(result.ores_paranomhs_yperorias_nyxtas); 
    //     document.getElementById("axiaParanomhsYperoriasNyxtas").value = parseFloat(result.axia_paranomhs_yperorias_nyxtas).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaParanomhsYperoriasNyxtas").value = parseFloat(result.axia_paranomhs_yperorias_nyxtas).toFixed(2); 
    //     document.getElementById("oresParanomhsYperoriasArgion").value = parseFloat(result.ores_paranomhs_yperorias_argion); 
    //     document.getElementById("axiaParanomhsYperoriasArgion").value = parseFloat(result.axia_paranomhs_yperorias_argion).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaParanomhsYperoriasArgion").value = parseFloat(result.axia_paranomhs_yperorias_argion).toFixed(2); 
    //     document.getElementById("oresParanomhsYperoriasArgionNyxtas").value = parseFloat(result.ores_paranomhs_yperorias_argion_nyxtas); 
    //     document.getElementById("axiaParanomhsYperoriasArgionNyxtas").value = parseFloat(result.axia_paranomhs_yperorias_argion_nyxtas).toFixed(2); 
    //     document.getElementById("asfalistikhAxiaParanomhsYperoriasArgionNyxtas").value = parseFloat(result.axia_paranomhs_yperorias_argion_nyxtas).toFixed(2); 

    //     document.getElementById("oresErgasias6Hmeras").value = parseFloat(result.ores_ergasias_6_hmeras); 
    //     document.getElementById("axiaErgasias6Hmeras").value = parseFloat(result.axia_ergasias_6_hmeras).toFixed(2); 
    //     document.getElementById("oresProsthethsErgasias").value = parseFloat(result.ores_prostheths_ergasias); 
    //     document.getElementById("axiaProsthethsErgasias").value = parseFloat(result.axia_prostheths_ergasias).toFixed(2); 
    //     document.getElementById("synoloProsayxhseon").value = parseFloat(result.synolo_prosayxhseon).toFixed(2); 
    //     document.getElementById("taktikesApodoxesMhYpologizomenesSeDoraText").value = result.taktikes_apodoxes_mh_ypologizomenes_se_dora_text; 
    //     document.getElementById("taktikesApodoxesMhYpologizomenesSeDora").value = parseFloat(result.taktikes_apodoxes_mh_ypologizomenes_se_dora).toFixed(2); 
    //     document.getElementById("taktikesApodoxesYpologizomenesSeDoraText").value = result.taktikes_apodoxes_ypologizomenes_se_dora_text; 
    //     document.getElementById("taktikesApodoxesYpologizomenesSeDora").value = parseFloat(result.taktikes_apodoxes_ypologizomenes_se_dora).toFixed(2); 
    //     document.getElementById("sympsifisteesApodoxes").value = parseFloat(result.sympsifistees_apodoxes).toFixed(2); 
    //     document.getElementById("synoloTaktikaKataballomenonApodoxon").value = parseFloat(result.synolo_taktika_kataballomenon_apodoxon).toFixed(2); 
    //     document.getElementById("epimerizomenesSeMhnesErgasiasText").value = result.epimerizomenes_se_mhnes_ergasias_text; 
    //     document.getElementById("epimerizomenesSeMhnesErgasias").value = parseFloat(result.epimerizomenes_se_mhnes_ergasias).toFixed(2); 
    //     document.getElementById("primBonusText").value = result.prim_bonus_text; 
    //     document.getElementById("primBonus").value = parseFloat(result.prim_bonus).toFixed(2); 
    //     document.getElementById("apallassomenesForoyText").value = result.apallassomenes_foroy_text; 
    //     document.getElementById("apallassomenesForoy").value = parseFloat(result.apallassomenes_foroy).toFixed(2); 
    //     document.getElementById("apallassomenesKrathseonText").value = result.apallassomenes_krathseon_text; 
    //     document.getElementById("apallassomenesKrathseon").value = parseFloat(result.apallassomenes_krathseon).toFixed(2); 
    //     document.getElementById("synoloEktaktaKataballomenonApodoxon").value = parseFloat(result.synolo_ektakta_kataballomenon_apodoxon).toFixed(2); 
    //     document.getElementById("meioshErgatikhsEisforas").value = parseFloat(result.meiosh_ergatikhs_eisforas).toFixed(2); 
    //     document.getElementById("epidothshErgodotikhsEisforas").value = parseFloat(result.meiosh_ergodotikhs_eisforas).toFixed(2); 
    //     document.getElementById("neoPragmatikoHmeromisthio").value = parseFloat(result.neo_pragmatiko_hmeromisthio).toFixed(2); 
    //     document.getElementById("pragmatikoHmeromisthioAstheneias").value = parseFloat(result.pragmatiko_hmeromisthio_astheneias).toFixed(2); 
    //     document.getElementById("apoHmeromhnia").value = result.apo_hmeromhnia; 
    //     document.getElementById("eosHmeromhnia").value = result.eos_hmeromhnia;

    //     document.getElementById("synoloAsfalistikhsAxias").value = parseFloat(result.synolo_asfalistikhs_axias_prosayxhseon).toFixed(2); 
    //     document.getElementById("synoloMiktonApodoxon").value = parseFloat(result.synolo_mikton_apodoxon).toFixed(2); 
    //     document.getElementById("synoloKrathseon_I").value = parseFloat(result.synolo_krathseon_i).toFixed(2); 
    //     document.getElementById("synoloForoy").value = parseFloat(result.synolo_foroy).toFixed(2); 
    //     document.getElementById("prokatabolh").value = parseFloat(result.prokatabolh).toFixed(2); 
    //     document.getElementById("plhroteo").value = parseFloat(result.plhroteo).toFixed(2); 

    //     // await mhnyma();
    //     // await loadKrathseis(data, sharedParams); // Γέμισμα dropdowns
    //     await loadKrathseis_Edit(data, result, _AA_KRATHSEON); // Γέμισμα dropdowns
        
    //     document.getElementById("synolo_axias_krathshs_ergazomenoy").value = parseFloat(result.synolo_axias_krathshs_ergazomenoy).toFixed(2); 
    //     document.getElementById("synolo_axias_krathshs_ergodoth").value = parseFloat(result.synolo_axias_krathshs_ergodoth).toFixed(2); 
    //     document.getElementById("synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro").value = parseFloat(result.synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro).toFixed(2); 
    //     document.getElementById("synolo_axias_krathshs_ergodoth_ypologizomenh_sto_foro").value = parseFloat(result.synolo_axias_krathshs_ergodoth_ypologizomenh_sto_foro).toFixed(2); 
    //     document.getElementById("synolo_axias_krathshs_ergazomenoy_mh_ypologizomenh_sto_foro").value = parseFloat(result.synolo_axias_krathshs_ergazomenoy_mh_ypologizomenh_sto_foro).toFixed(2); 
    //     document.getElementById("synolo_axias_krathshs_ergodoth_mh_ypologizomenh_sto_foro").value = parseFloat(result.synolo_axias_krathshs_ergodoth_mh_ypologizomenh_sto_foro).toFixed(2); 

    //     // ΦΟΡΟΙ
    //     document.getElementById("analogoyn_foros_pro_ekptoshs").value = parseFloat(result.analogoyn_foros_pro_ekptoshs).toFixed(2); 
    //     document.getElementById("mhniaios_analogoyn_foros_pro_ekptoshs").value = parseFloat(result.mhniaios_analogoyn_foros_pro_ekptoshs).toFixed(2); 
    //     document.getElementById("eisfora_allhleggyhs").value = parseFloat(result.eisfora_allhleggyhs).toFixed(2); 
    //     document.getElementById("ekptosh_logo_oikogeneiakhs_katastashs").value = parseFloat(result.ekptosh_logo_oikogeneiakhs_katastashs).toFixed(2); 
    //     document.getElementById("mhniaia_ekptosh_logo_oikogeneiakhs_katastashs").value = parseFloat(result.mhniaia_ekptosh_logo_oikogeneiakhs_katastashs).toFixed(2); 
    //     document.getElementById("mhniaia_ekptosh_logo_oikogeneiakhs_katastashs").value = parseFloat(result.mhniaia_ekptosh_logo_oikogeneiakhs_katastashs).toFixed(2); 
    //     document.getElementById("analogoyn_foros_meta_thn_ekptosh").value = parseFloat(result.analogoyn_foros_meta_thn_ekptosh).toFixed(2); 
    //     document.getElementById("synolo_ektakton_amoibon").value = parseFloat(result.synolo_ektakton_amoibon).toFixed(2); 
    //     document.getElementById("analogoyn_foros_ektakton_amoibon").value = parseFloat(result.analogoyn_foros_ektakton_amoibon).toFixed(2); 


    //     // ΑΣΘΕΝΕΙΕΣ

    //     _KODIKOS_ETAIREIAS = sharedParams._KODIKOS_ETAIREIAS;
    //     _ID_ETAIREIAS = sharedParams.ergazomenoi.company_kod;
    //     _KODIKOS_ERGAZOMENOY = sharedParams.ergazomenoi.kodikos;
    //     _HMEROMHNIA_PROSLHPSHS = sharedParams.ergazomenoi.hmeromhnia_proslhpshs;
    //     _HMEROMHNIA_APOXORHSHS = sharedParams.ergazomenoi.hmeromhnia_apoxorhshs;

    //     for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[51].timh); i++) {
    //         diasthmataAstheneias[`_HMERES_ASTHENEIAS_0${i}`] = 0;
    //         diasthmataMhErgasimon[`_HMERES_MH_ERGASIMON_0${i}`] = 0;
    //         hmeromhniesMhErgasimon[`_HMEROMHNIES_MH_ERGASIMON_0${i}`] = null;
    //         diasthmataRepo[`_HMERES_REPO_0${i}`] = 0;
    //         hmeromhniesRepo[`_HMEROMHNIES_REPO_0${i}`] = null;
    //         diasthmataArgion[`_HMERES_ARGION_0${i}`] = 0;
    //         hmeromhniesArgion[`_HMEROMHNIES_ARGION_0${i}`] = null;
    //         diasthmataArgionSeRepoKaiMhErgasimes[`_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_0${i}`] = 0;
    //         hmeromhniesArgionSeRepoKaiMhErgasimes[`_HMEROMHNIES_ARGION_SE_REPO_KAI_MH_ERGASIMES_0${i}`] = null;
    //     }
        
    //     _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_LESS_365 =
    //         parseInt(sharedParams.genikesParametroi[34].timh);

    //     _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_LESS_365 =
    //         parseInt(sharedParams.genikesParametroi[35].timh);

    //     _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_GREATER_365 =
    //         parseInt(sharedParams.genikesParametroi[36].timh);

    //     _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_GREATER_365 =
    //         parseInt(sharedParams.genikesParametroi[37].timh);

    //     for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[51].timh); i++) {
    //         const rowString = i < 10 ? `0${i}` : String(i);
    //         await attachRowListeners_Astheneias(rowString);
    //     }
    
    //     for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[51].timh); i++) {

    //     }




    // }

    // async function loadKrathseis_Edit(data, result, aa) {
    //     let flag = 0;
    //     const fieldsStoixeionKrathseon = ['kodikos', 'krathsh', 'asfalistikesApodoxes', 'pososto_krathshs_ergazomenoy', 'pososto_krathshs_ergodoth', 'synolo_pososton_krathshs', 'poso_krathshs_ergazomenoy', 'poso_krathshs_ergodoth', 'synolo_poson_krathshs', 'axia_krathshs_ergazomenoy', 'axia_krathshs_ergodoth', 'ypologizomenoStoForo', 'ypologizomenoEpiPlasmatikhs', 'plasmatikh_axia', 'apaiteitai_apodoxes_asfalishs', 'anotato_orio_palion', 'anotato_orio_neon', 'kad', 'eidikothta', 'kpk', 'se_typos_apodoxon', 'epa'];

    //     // Ορίζουμε ποια fields είναι numbers με Fixed(4)
    //     const numberFieldsKrathseon_4 = new Set(['pososto_krathshs_ergazomenoy', 'pososto_krathshs_ergodoth', 'synolo_pososton_krathshs', 'axia_krathshs_ergazomenoy', 'axia_krathshs_ergodoth']);

    //     // Ορίζουμε ποια fields είναι numbers με Fixed(2)
    //     const numberFieldsKrathseon_2 = new Set(['asfalistikesApodoxes', 'poso_krathshs_ergazomenoy', 'poso_krathshs_ergodoth', 'synolo_poson_krathshs', 'plasmatikh_axia', 'anotato_orio_palion', 'anotato_orio_neon']);

    //     // Ορίζουμε ποια fields είναι booleans
    //     const booleanFieldsKrathseon = new Set(['ypologizomenoStoForo', 'ypologizomenoEpiPlasmatikhs', 'apaiteitai_apodoxes_asfalishs']);

    //     for (let i = 1; i <= parseInt(window.sharedParams.genikesParametroi[23].timh); i++) {
    //         const index = i.toString().padStart(2, '0');
    //         // const ergazomenoiField = sharedParams.ergazomenoi[`krathsh_${index}`] || '';
    //         // const krathseisDropdown = document.getElementById(`krathsh_${index}`);
    //         // let kodikos_krathshs = document.getElementById(`kodikos_${index}`);

    //         const resultKrathsh = result[`krathsh_${index}`] || '';
    //         const krathseisDropdown = document.getElementById(`krathsh_${index}`);
    //         let kodikos_krathshs = document.getElementById(`kodikos_${index}`);
            

    //         flag = index === "01" ? 1 : 0;
    
    //         // Δημιουργία της αρχικής επιλογής
    //         krathseisDropdown.innerHTML = '<option value="" selected></option>';
    
    //         for (const krathsh of data) {
    //             const textToConvert = removeGreekAccentsAndToUpper(krathsh.perigrafh);
    //             const option = new Option(
    //                 krathsh.kodikos.padEnd(10, '\u00A0') + textToConvert,
    //                 krathsh.kodikos
    //             );
    
    //             // Προσθήκη δεδομένων στο option
    //             if (krathsh.pososta) {
    //                 Object.assign(option.dataset, {
    //                     posostoErgazomenoy: krathsh.pososta.pososto_ergazomenoy || '',
    //                     posostoErgodoth: krathsh.pososta.pososto_ergodoth || '',
    //                     synoloPososton: krathsh.pososta.synolo_pososton || '',
    //                     posoErgazomenoy: krathsh.pososta.poso_ergazomenoy || '',
    //                     posoErgodoth: krathsh.pososta.poso_ergodoth || '',
    //                     synoloPoson: krathsh.pososta.synolo_poson || '',
    //                     anotatoOrioPalion: krathsh.pososta.anotato_orio_palion || '',
    //                     anotatoOrioNeon: krathsh.pososta.anotato_orio_neon || '',
    //                     plasmatikhAxia: krathsh.pososta.plasmatikh_axia || '',
    //                     ypologizomenoStoForo: krathsh.ypologizetaiStoForo || false,
    //                     ypologizomenoEpiPlasmatikhs: krathsh.ypologizetaiEpiPlasmatikhs || false,
    //                     asfalistikesApodoxes: krathsh.ypologizetaiEpiPlasmatikhs === true ? krathsh.pososta.plasmatikh_axia || '' : (result[`asfalistikesApodoxes_${index}`] || result["asfalistikes_apodoxes"] || 0),
    //                     apaiteitaiApodoxesAsfalishs: krathsh.apaiteitai_apodoxes_asfalishs || false,
    //                 });
    //             }
    
    //             if (krathsh.kodikos === resultKrathsh) {
    //                 option.selected = true;
    //                 kodikos_krathshs.value = krathsh.kodikos;
    //                 try {
    //                     const apoTyposApodoxonValue = document.getElementById("typosApodoxon_Hidden").value;
    //                     const teamValue = document.getElementById("team").value;
    //                     const kodikosEtaireias = sharedParams._KODIKOS_ETAIREIAS;
    //                     // Fetch δεδομένων για AntistoixiseisModel
    //                     const antistoixiseisResponse = await fetch(`/api/kinhseis/getAntistoixiseisByKrathshAndTypoApodoxon?team=${encodeURIComponent(teamValue)}&etaireia=${encodeURIComponent(kodikosEtaireias)}&krathshKod=${encodeURIComponent(kodikos_krathshs.value)}&apo_typos_apodoxon=${encodeURIComponent(apoTyposApodoxonValue)}`, {
    //                         method: 'GET',
    //                         headers: { 'Content-Type': 'application/json' },
    //                     });
    //                     const antistoixiseisData = await antistoixiseisResponse.json();
    
    //                     // Προσθήκη επιπλέον δεδομένων στο dataset του option από τα μοντέλα
    //                     const data = antistoixiseisData || {
    //                         kad: sharedParams.ergazomenoi.kad_efka || '',
    //                         eidikothta: sharedParams.ergazomenoi.eidikothta_efka || '',
    //                         kpk: sharedParams.ergazomenoi.kpk_efka || '',
    //                         se_typos_apodoxon: apoTyposApodoxonValue || '',
    //                         epa: flag === 1 ? sharedParams.ergazomenoi.epa_efka || '' : "00"
    //                     };
                    
    //                     Object.assign(option.dataset, {
    //                         kad: data.kad,
    //                         eidikothta: data.eidikothta,
    //                         kpk: data.kpk,
    //                         se_typos_apodoxon: data.se_typos_apodoxon,
    //                         epa: data.epa,
    //                     });
    //                 } catch (error) {
    //                     console.error('Σφάλμα κατά την ανάκτηση δεδομένων:', error);
    //                 }
    //             }
    //             krathseisDropdown.appendChild(option);
    //         };
    
    //         // === ΕΔΩ προσθέτουμε τον event listener ===
    //         // Κάθε φορά που αλλάζει η επιλεγμένη κράτηση, ενημερώνει το αντίστοιχο πεδίο kodikos_{index}.
    //         krathseisDropdown.addEventListener('change', (event) => {
    //             kodikos_krathshs.value = event.target.value;
    
    //             // Αν θέλετε να πάρετε δεδομένα από το dataset του επιλεγμένου option:
    //             const selectedOption = event.target.options[event.target.selectedIndex];
    //             // Παράδειγμα: console.log(selectedOption.dataset.posostoErgazomenoy);
    //         });
    
    //         // Ενημέρωση των πεδίων με βάση την αρχική τιμή
    //         updatePosostaFields(i);
    
    //         // Προσθήκη event listener (μόνο μία φορά)
    //         krathseisDropdown.addEventListener('change', () => updatePosostaFields(i));
    
    //         // Προσθήκη event listener στο κουμπί καθαρισμού
    //         const clearButton = document.getElementById(`clearSelectKrathseon_${index}`);
    //         clearButton.addEventListener('click', async () => {
    //             await clearRowFields(index);
    //         });
    //     }

    //     // await calcPlhroteo();

    //     if (loaderContainer) loaderContainer.style.display = "none";
        
    // };

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
