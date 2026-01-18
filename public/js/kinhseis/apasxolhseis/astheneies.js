// ============================================================
// GLOBAL μεταβλητές
// ============================================================

// const oneSpaces = '\u00A0'.repeat(1);
// const twoSpaces = '\u00A0'.repeat(2);
// const tenSpaces = '\u00A0'.repeat(10);

// let 
//     _APASXOLHSH_BASEI_SYMBASHS = 0,
//     _ARGIES = 0, 
//     _ASTHENEIES = 0, 
//     _DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS = 0, 
//     _DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS = 0, 
//     _HMERES_ARGION = 0,
//     _KOINES_ARGIES = 0, 
//     _LHFTHEISA_ADEIA_ASTHENEIAS = 0, 
//     _MH_ERGASIMES_HMERES = 0, 
//     _PRAGMATIKES_HMERES_ASTHENEIAS = 0,
//     _REPO = 0, 
//     _SYNOLO_DIKAIOYMENHS_ASTHENEIAS = 0, 
//     _SYNOLIKO_DIASTHMA_ASTHENEIAS = 0, 
//     _YPOLOIPO_ADEIAS_ASTHENEIAS = 0, 
//     _YPOLOIPO_ADEIAS_ASTHENEIAS_TREXONTOS_ETOYS = 0;
    
// let diasthmataAstheneias = {};
// let diasthmataMhErgasimon = {};
// let hmeromhniesMhErgasimon = {};
// let diasthmataRepo = {};
// let hmeromhniesRepo = {};
// let diasthmataArgion = {};
// let hmeromhniesArgion = {};
// let diasthmataArgionSeRepoKaiMhErgasimes = {};
// let hmeromhniesArgionSeRepoKaiMhErgasimes = {};

// let lhftheisa_adeia = 0,
//     synoloProhgoymenonHmeronAstheneias = 0,
//     synoloProhgoymenonHmeronGreater3 = 0,
//     synoloProhgoymenonHmeronLess3 = 0,
//     geniko_synolo_astheneias = 0, 
//     differenceInDays = 0;

// let anapaysh_repo_hmeromhnies, 
//     anapaysh_repo_timh, 
//     mh_ergasimes_basei_orarioy_timh, 
//     mh_ergasimes_hmeromhnies,
//     argies_timh, 
//     argies_hmeromhnies,
//     hmeromhnia_arxhs_ergasiakoy_etoys, 
//     hmeromhnia_teloys_ergasiakoy_etoys, 
//     hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys, 
//     hmeromhnia_teloys_epomenoy_ergasiakoy_etoys,
//     synolo_less_3, 
//     synolo_greater_3, 
//     geniko_synolo_hmeron_astheneias, 
//     oldLess3Value, 
//     oldGreater3Value, 
//     oldSynoloValue,
//     dikaioymenh_astheneia_trexontos_ergasiakoy_etoys,
//     dikaioymenh_astheneia_trexontos_ergasiakoy_etoys_timh,
//     lhfteisa_adeia_asteneias_prohgoymenon_mhnon,
//     lhfteisa_adeia_asteneias_prohgoymenon_mhnon_timh,
//     ypoloipo_adeias_astheneias_trexontos_etoys,
//     ypoloipo_adeias_astheneias_trexontos_etoys_timh,
//     dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys,
//     dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys_timh,
//     synolo_dikaioymenhs_adeias_astheneias,
//     synolo_dikaioymenhs_adeias_astheneias_timh,
//     lhftheisa_adeia_astheneias,
//     lhftheisa_adeia_astheneias_timh,
//     ypoloipo_adeias_astheneias,
//     ypoloipo_adeias_astheneias_timh
// ;

anapaysh_repo_timh = document.getElementById("repo_timh");
anapaysh_repo_hmeromhnies = document.getElementById("repo_hmeromhnies");
mh_ergasimes_basei_orarioy_timh = document.getElementById("mh_ergasimes_basei_orarioy_timh");
mh_ergasimes_hmeromhnies = document.getElementById("mh_ergasimes_hmeromhnies");
dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys = document.getElementById("dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys");
dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys_timh = document.getElementById("dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys_timh");

argies_timh = document.getElementById("argies_timh");
argies_hmeromhnies = document.getElementById("argies_hmeromhnies");

dikaioymenh_astheneia_trexontos_ergasiakoy_etoys = document.getElementById("dikaioymenh_astheneia_trexontos_ergasiakoy_etoys");
dikaioymenh_astheneia_trexontos_ergasiakoy_etoys_timh = document.getElementById("dikaioymenh_astheneia_trexontos_ergasiakoy_etoys_timh");
lhfteisa_adeia_asteneias_prohgoymenon_mhnon = document.getElementById("lhfteisa_adeia_asteneias_prohgoymenon_mhnon");
lhfteisa_adeia_asteneias_prohgoymenon_mhnon_timh = document.getElementById("lhfteisa_adeia_asteneias_prohgoymenon_mhnon_timh");
ypoloipo_adeias_astheneias_trexontos_etoys = document.getElementById("ypoloipo_adeias_astheneias_trexontos_etoys");
ypoloipo_adeias_astheneias_trexontos_etoys_timh = document.getElementById("ypoloipo_adeias_astheneias_trexontos_etoys_timh");

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

        for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[51].timh); i++) {
            diasthmataAstheneias[`_HMERES_ASTHENEIAS_0${i}`] = 0;
            diasthmataMhErgasimon[`_HMERES_MH_ERGASIMON_0${i}`] = 0;
            hmeromhniesMhErgasimon[`_HMEROMHNIES_MH_ERGASIMON_0${i}`] = null;
            diasthmataRepo[`_HMERES_REPO_0${i}`] = 0;
            hmeromhniesRepo[`_HMEROMHNIES_REPO_0${i}`] = null;
            diasthmataArgion[`_HMERES_ARGION_0${i}`] = 0;
            hmeromhniesArgion[`_HMEROMHNIES_ARGION_0${i}`] = null;
            diasthmataArgionSeRepoKaiMhErgasimes[`_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_0${i}`] = 0;
            hmeromhniesArgionSeRepoKaiMhErgasimes[`_HMEROMHNIES_ARGION_SE_REPO_KAI_MH_ERGASIMES_0${i}`] = null;
        }
        
        _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_LESS_365 =
            parseInt(sharedParams.genikesParametroi[34].timh);

        _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_LESS_365 =
            parseInt(sharedParams.genikesParametroi[35].timh);

        _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_GREATER_365 =
            parseInt(sharedParams.genikesParametroi[36].timh);

        _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_GREATER_365 =
            parseInt(sharedParams.genikesParametroi[37].timh);

        // "Δένουμε" τους listeners για όλες τις γραμμές (01..05)
        for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[51].timh); i++) {
            const rowString = i < 10 ? `0${i}` : String(i);
            await attachRowListeners_Astheneias(rowString);
        }
    });

    // click ΣΤΟ tab Ασθένεια, ΥΠΟΛΟΓΙΖΟΥΜΕ ΤΑ ΕΡΓΑΣΙΑΚΑ ΕΤΗ (ΤΡΕΧΟΝ ΚΑΙ ΕΠΟΜΕΝΟ) ΚΑΙ ΕΥΡΕΣΗ ΠΡΟΗΓΟΥΜΕΝΩΝ ΑΣΘΕΝΕΙΩΝ
    const astheneia = document.querySelector('.astheneia'); 
    if (astheneia) {
        astheneia.addEventListener('click', async () => {
            const currentYear = parseInt(document.getElementById("etos").value);
            const nextYear = currentYear + 1;
            const hmeromhnia_proslhpshs = _HMEROMHNIA_PROSLHPSHS;
            const hmeromhnia_apoxorhshs = _HMEROMHNIA_APOXORHSHS;

            const workYearDates = calculateWorkYearDates(hmeromhnia_proslhpshs, hmeromhnia_apoxorhshs, currentYear, nextYear);
            const periodos = document.getElementById("periodos");

            // _HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS = document.getElementById("hmeromhnia_teloys_ergasiakoy_etoys");
            // _HMEROMHNIA_ARXHS_EPOMENOY_ERGASIAKOY_ETOYS = document.getElementById("hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys");



            _HMEROMHNIA_TELOYS_EPOMENOY_ERGASIAKOY_ETOYS = document.getElementById("hmeromhnia_teloys_epomenoy_ergasiakoy_etoys");

            // Μετατρέπουμε σε “φιλικές” μορφές ή ISO κ.λπ.
            const isoStartDate = workYearDates.startWorkYear;
            const isoEndDate = workYearDates.endWorkYear;
            const isoStartNextDate = workYearDates.startWorkNextYear;
            const isoEndNextDate = workYearDates.endWorkNextYear;

            _HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS = isoStartDate;
            _HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS = isoEndDate;
            _HMEROMHNIA_ARXHS_EPOMENOY_ERGASIAKOY_ETOYS = isoStartNextDate;
            _HMEROMHNIA_TELOYS_EPOMENOY_ERGASIAKOY_ETOYS = isoEndNextDate;

            hmeromhnia_arxhs_ergasiakoy_etoys = formatDate(isoStartDate);
            hmeromhnia_teloys_ergasiakoy_etoys = formatDate(isoEndDate);
            hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys = formatDate(isoStartNextDate);
            hmeromhnia_teloys_epomenoy_ergasiakoy_etoys = formatDate(isoEndNextDate);

            const ergasiako_etos = document.getElementById("ergasiako_etos");
            const epomeno_ergasiako_etos = document.getElementById("epomeno_ergasiako_etos");
            const diasthma_apasxolhshs = document.getElementById("diasthma_apasxolhshs");

            // Υπολογισμός workDays
            const apo_hmeromhnia_astheneias_01 = document.getElementById("apo_hmeromhnia_astheneias_01");
            // const periodos = document.getElementById("periodos");

            const workDays = calcDateDiffWorkYear(
                apo_hmeromhnia_astheneias_01?.value,
                hmeromhnia_proslhpshs,
                periodos?.value
            );

            ergasiako_etos.innerHTML = `<b>Τρέχον</b> Εργασιακό έτος: ${twoSpaces} Από ${hmeromhnia_arxhs_ergasiakoy_etoys} Έως ${hmeromhnia_teloys_ergasiakoy_etoys}`;
            document.getElementById("ergasiakoEtos").value =`Από ${hmeromhnia_arxhs_ergasiakoy_etoys} Έως ${hmeromhnia_teloys_ergasiakoy_etoys}`;

            if (isoStartNextDate && isoEndNextDate) {
                epomeno_ergasiako_etos.innerHTML = `<b>Επόμενο</b> Εργασιακό έτος: ${twoSpaces} Από ${hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys} Έως ${hmeromhnia_teloys_epomenoy_ergasiakoy_etoys}`;
                document.getElementById("epomenoErgasiakoEtos").value = `Από ${hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys} Έως ${hmeromhnia_teloys_epomenoy_ergasiakoy_etoys}`;
            }

            diasthma_apasxolhshs.innerHTML = `Συνολικές Ημέρες Απασχόλησης: ${twoSpaces} <b>${workDays}</b>`;
            document.getElementById("diasthmaApasxolhshs").value = workDays;

            _TELOS_TREXONTOS_ERGASIAKOY_ETOYS = hmeromhnia_teloys_ergasiakoy_etoys;
            _ARXH_EPOMENOY_ERGASIAKOY_ETOYS = formatDateToISO(hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys);

            // Λογική υπολογισμού δικαιούμενης ασθένειας
            _APASXOLHSH_BASEI_SYMBASHS = window.sharedParams.ergazomenoi.apasxolhsh_basei_symbashs;

            switch(window.sharedParams.ergazomenoi.typos_ergazomenon) {
                case "Μ":
                    switch (true) {
                        case workDays < 10:
                            _DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS = 0;
                            _DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS = 0;
                            break;
                        case workDays > 9 && workDays < 365:
                            _DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS = _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_LESS_365;
                            _DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS = _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_GREATER_365;
                            break;
                        case workDays >= 365 :
                            _DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS = _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_GREATER_365;
                            _DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS = _HMERES_DIKAIOYMENHS_ASTHENEIAS_MISTHOTON_ME_ERGASIA_GREATER_365;
                            break;
                        default:
                            _DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS = 0;
                            _DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS = 0;
                            break;
                    }
                    break;
                case "Η":
                case "Ω":
                    switch (true) {
                        case workDays < 10:
                            _DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS = 0;
                            _DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS = 0;
                            break;
                        case workDays > 9 && workDays < 365:
                            _DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS = _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_LESS_365;
                            _DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS = _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_GREATER_365;
                            break;
                        case workDays >= 365:
                            _DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS = _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_GREATER_365;
                            _DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS = _HMERES_DIKAIOYMENHS_ASTHENEIAS_HMEROMISTHION_ME_ERGASIA_GREATER_365;
                            break;
                        default:
                            _DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS = 0;
                            _DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS = 0;
                    }
                    break;
            }
        });
    }
});

// ============================================================
// ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ
// ============================================================

// Συνάρτηση που συγκεντρώνει όλες τις repo ημερομηνίες από όλες τις γραμμές και ενημερώνει το anapaysh_repo_hmeromhnies
async function updateGlobalRepoDisplay() {
    // 1. Ήδη αποθηκευμένα δεδομένα από όλες τις γραμμές
    let allRepoDates = [];
  
    // 2. Συγκεντρώνουμε τις ημερομηνίες όλων των γραμμών (χωρίς να τις ξαναφιλτράρουμε)
    Object.keys(hmeromhniesRepo).forEach(key => {
        const rowDates = hmeromhniesRepo[key];
        if (Array.isArray(rowDates) && rowDates.length > 0) {
          allRepoDates = allRepoDates.concat(rowDates);
        }
      });
    
      // 3. Αφαίρεση διπλοτύπων
      allRepoDates = [...new Set(allRepoDates)];
    
      // 4. Ταξινόμηση (εάν θέλετε οι ημερομηνίες να εμφανίζονται με σειρά)
      if (allRepoDates.length > 0) {
          allRepoDates.sort((a, b) => parseDateDDMMYYYY(a) - parseDateDDMMYYYY(b));
      }
      anapaysh_repo_hmeromhnies.innerHTML = allRepoDates.join(', ');
  }
  
// Συνάρτηση που συγκεντρώνει όλες τις repo ημερομηνίες από όλες τις γραμμές και ενημερώνει το anapaysh_repo_hmeromhnies
async function updateGlobalMhErgasimesDisplay() {
    // 1. Ήδη αποθηκευμένα δεδομένα από όλες τις γραμμές
    let allRepoDates = [];
  
    // 2. Συγκεντρώνουμε τις ημερομηνίες όλων των γραμμών (χωρίς να τις ξαναφιλτράρουμε)
    Object.keys(hmeromhniesMhErgasimon).forEach(key => {
        const rowDates = hmeromhniesMhErgasimon[key];
        if (Array.isArray(rowDates) && rowDates.length > 0) {
          allRepoDates = allRepoDates.concat(rowDates);
        }
      });
    
      // 3. Αφαίρεση διπλοτύπων
      allRepoDates = [...new Set(allRepoDates)];
    
      // 4. Ταξινόμηση (εάν θέλετε οι ημερομηνίες να εμφανίζονται με σειρά)
      if (allRepoDates.length > 0) {
          allRepoDates.sort((a, b) => parseDateDDMMYYYY(a) - parseDateDDMMYYYY(b));
      }
      mh_ergasimes_hmeromhnies.innerHTML = allRepoDates.join(', ');
  }
  
  /****************************************
   * Ενημέρωση Συνολικού Repo Count
   ****************************************/
  async function updateTotalRepoCount() {
    let total = 0;
    for (const key in diasthmataRepo) {
      if (diasthmataRepo.hasOwnProperty(key)) {
        total += Number(diasthmataRepo[key]) || 0;
      }
    }
    anapaysh_repo_timh.innerHTML = `<b>${total}</b>`;
  }
    
  /****************************************
   * Ενημέρωση Συνολικού mhErgasimes Count
   ****************************************/
  async function updateTotalMhErgasimesCount() {
    let total = 0;
    for (const key in diasthmataMhErgasimon) {
      if (diasthmataMhErgasimon.hasOwnProperty(key)) {
        total += Number(diasthmataMhErgasimon[key]) || 0;
      }
    }
    mh_ergasimes_basei_orarioy_timh.innerHTML = `<b>${total}</b>`;
  }
    
// Συνάρτηση που συγκεντρώνει όλες τις ημερομηνίες αργιών από όλες τις γραμμές και ενημερώνει το argies_hmeromhnies
async function updateGlobalArgiesDisplay() {
    // 1. Ήδη αποθηκευμένα δεδομένα από όλες τις γραμμές
    let allArgiesDates = [];
  
    // 2. Συγκεντρώνουμε τις ημερομηνίες όλων των γραμμών (χωρίς να τις ξαναφιλτράρουμε)
    Object.keys(hmeromhniesArgion).forEach(key => {
      const rowDates = hmeromhniesArgion[key];
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
    argies_hmeromhnies.innerHTML = allArgiesDates.join(', ');
    // argies_hmeromhnies.innerHTML = allArgiesDates.join(', ');
  }
  
/****************************************
* Ενημέρωση Συνολικού Argies Count
****************************************/
async function updateTotalArgiesCount() {
    let total = 0;
    for (const key in diasthmataArgion) {
        if (diasthmataArgion.hasOwnProperty(key)) {
            total += Number(diasthmataArgion[key]) || 0;
        }
    }
    argies_timh.innerHTML = `<b>${total}</b>`;
}

async function calcLhftheisaAdeiaAstheneias() {
    geniko_synolo_astheneias = 0;

    for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[51].timh); i++) { 
        const tmpValue = parseInt(document.getElementById(`synolo_astheneias_0${i}`).value) || 0;

        if (tmpValue !== 0) {
            geniko_synolo_astheneias += tmpValue;
            lhftheisa_adeia = parseInt((parseInt(synoloProhgoymenonHmeronAstheneias) + parseInt(geniko_synolo_astheneias)));
        }
    }
    _PRAGMATIKES_HMERES_ASTHENEIAS = parseInt(synoloProhgoymenonHmeronAstheneias);
    return lhftheisa_adeia;
}

// Συνάρτηση για προσθήκη ημερών σε μια ημερομηνία
async function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return formatDateToCustom(result);
}
  
async function handleRepoDates(row) {
    // 1. Παίρνουμε από τα input τις τιμές Από & Έως (π.χ. "apo_hmeromhnia_astheneias_2", "eos_hmeromhnia_astheneias_2")
    const apoInput = document.getElementById(`apo_hmeromhnia_astheneias_${row}`);
    const eosInput = document.getElementById(`eos_hmeromhnia_astheneias_${row}`);
    const apoValue = formatDate(apoInput.value); // π.χ. μετατρέπει "2024-10-01" -> "01/10/2024"
    const eosValue = formatDate(eosInput.value);
  
    // 4. Καλούμε το getMhErgasiaCount για να πάρουμε νέες τιμές (repo και ημερομηνίες)
    const { mhErgasimes, astheneia, repo, mhErgasimesDates, repoDates, mhErgasimesKaiRepoDates } = await getMhErgasiaCount({
        team: sharedParams._TEAM,
        company_kod: _ID_ETAIREIAS,
        kodikos: _KODIKOS_ERGAZOMENOY,
        dateStart: formatDateToISO(apoValue),
        dateEnd: formatDateToISO(eosValue)
    });
  
    // 5. Ενημέρωση κάποιων global μεταβλητών (αν χρειάζεται)
    _MH_ERGASIMES_HMERES = mhErgasimes;
    _REPO = repo;
    _HMEROMHNIES_REPO = repoDates;
    _MH_ERGASIMES_HMERES_REPO = mhErgasimesKaiRepoDates;
    _ASTHENEIES = astheneia;

    // 6. Αποθήκευση του mhErgasimes count για αυτή τη γραμμή
    diasthmataMhErgasimon[`_HMERES_MH_ERGASIMON_${row}`] = mhErgasimes;
  
    // 7. Αποθήκευση του repo count για αυτή τη γραμμή
    diasthmataRepo[`_HMERES_REPO_${row}`] = repo;
  
    // 8. Δημιουργούμε τον *νέο* πίνακα για αυτή τη γραμμή στο hmeromhniesRepo
    if (repo > 0) {
        const newDates = repoDates.map(dateString => {
            const datePart = dateString.split('T')[0]; // "YYYY-MM-DD"
            const [yyyy, mm, dd] = datePart.split('-');
            const formatted = `${dd}/${mm}/${yyyy}`;   // "DD/MM/YYYY"
            return formatDateRepoArgies(formatted);
        });
        // Αντικαθιστούμε *εξ ολοκλήρου* τις ημερομηνίες της τρέχουσας γραμμής
        hmeromhniesRepo[`_HMEROMHNIES_REPO_${row}`] = newDates;
    } else {
        // Αν δεν έχουμε repo, αδειάζουμε τον πίνακα για τη γραμμή
        hmeromhniesRepo[`_HMEROMHNIES_REPO_${row}`] = null;
    }
  
    // 9. Δημιουργούμε τον *νέο* πίνακα για αυτή τη γραμμή στο hmeromhniesMhErgasimon
    if (mhErgasimes > 0) {
        const newDates = mhErgasimesDates.map(dateString => {
            const datePart = dateString.split('T')[0]; // "YYYY-MM-DD"
            const [yyyy, mm, dd] = datePart.split('-');
            const formatted = `${dd}/${mm}/${yyyy}`;   // "DD/MM/YYYY"
            return formatDateRepoArgies(formatted);
        });
        // Αντικαθιστούμε *εξ ολοκλήρου* τις ημερομηνίες της τρέχουσας γραμμής
        hmeromhniesMhErgasimon[`_HMEROMHNIES_MH_ERGASIMON_${row}`] = newDates;
    } else {
        // Αν δεν έχουμε repo, αδειάζουμε τον πίνακα για τη γραμμή
        hmeromhniesMhErgasimon[`_HMEROMHNIES_MH_ERGASIMON_${row}`] = null;
    }
  
    // 10. Ενημερώνουμε και τα συνολικά repo και mhErgasimes count
    await updateGlobalMhErgasimesDisplay();
    await updateTotalMhErgasimesCount();
    await updateGlobalRepoDisplay();
    await updateTotalRepoCount();

    document.getElementById("mhErgasimesHmeromhnies").value = mh_ergasimes_hmeromhnies.innerHTML;
    document.getElementById("repoHmeromhnies").value = anapaysh_repo_hmeromhnies.innerHTML;
}
  
async function handleArgiesDates(row) {
    const apo_hmeromhnia_astheneias = document.getElementById(`apo_hmeromhnia_astheneias_${row}`);
    const eos_hmeromhnia_astheneias = document.getElementById(`eos_hmeromhnia_astheneias_${row}`);

    // Παίρνουμε τις τιμές ως string "DD/MM/YYYY"
    const apoValue = formatDate(apo_hmeromhnia_astheneias.value); // π.χ. "01/10/2024"
    const eosValue = formatDate( eos_hmeromhnia_astheneias.value); // π.χ. "06/10/2024"

    // Κλήση της getMhErgasiaCount
    const { count: originalCount, hmeromhnies } = await getArgiesCount({
        team: sharedParams._TEAM,
        company_kod: _KODIKOS_ETAIREIAS,
        etos: sharedParams._XRHSH,
        dateStart: apo_hmeromhnia_astheneias.value,
        dateEnd: eos_hmeromhnia_astheneias.value
    });

    let argiesCount = originalCount;
            
    hmeromhnies.forEach(hmeromhnia => {
        if (_MH_ERGASIMES_HMERES_REPO.some(date => new Date(date).toISOString() === new Date(hmeromhnia).toISOString())) {
            argiesCount -= 1; // Αφαιρούμε 1 από το count αν υπάρχει η ημερομηνία
        }
    });

    _KOINES_ARGIES = parseInt(argiesCount);
    _ARGIES = parseInt(originalCount);
    // 6. Αποθήκευση του repo count για αυτή τη γραμμή
    diasthmataArgion[`_HMERES_ARGION_${row}`] = _ARGIES;
  
    // 7. Δημιουργούμε τον *νέο* πίνακα για αυτή τη γραμμή στο hmeromhniesRepo
    if (_ARGIES > 0) {
        const newDates = hmeromhnies.map(dateString => {
            const datePart = dateString.split('T')[0]; // "YYYY-MM-DD"
            const [yyyy, mm, dd] = datePart.split('-');
            const formatted = `${dd}/${mm}/${yyyy}`;   // "DD/MM/YYYY"
            return formatDateRepoArgies(formatted);
        });
        // Αντικαθιστούμε *εξ ολοκλήρου* τις ημερομηνίες της τρέχουσας γραμμής
        hmeromhniesArgion[`_HMEROMHNIES_ARGION_${row}`] = newDates;
    } else {
        // Αν δεν έχουμε repo, αδειάζουμε τον πίνακα για τη γραμμή
        hmeromhniesArgion[`_HMEROMHNIES_ARGION_${row}`] = null;
    }
  
    // 8. Ενημερώνουμε και το συνολικό repo count
    await updateGlobalArgiesDisplay();
    await updateTotalArgiesCount();

    argies_timh.innerHTML = `<b>${
        diasthmataArgion['_HMERES_ARGION_01'] +
        diasthmataArgion['_HMERES_ARGION_02'] +
        diasthmataArgion['_HMERES_ARGION_03'] +
        diasthmataArgion['_HMERES_ARGION_04'] +
        diasthmataArgion['_HMERES_ARGION_05']
    }</b>`;
    document.getElementById("argiesTimh").value = parseInt(
        diasthmataArgion['_HMERES_ARGION_01'] +
        diasthmataArgion['_HMERES_ARGION_02'] +
        diasthmataArgion['_HMERES_ARGION_03'] +
        diasthmataArgion['_HMERES_ARGION_04'] +
        diasthmataArgion['_HMERES_ARGION_05'] );
    document.getElementById("argiesHmeromhnies").value = argies_hmeromhnies.innerHTML;
}

// ============================================================
// ΕΥΡΕΣΗ ΤΗΣ ΤΕΛΕΥΤΑΙΑΣ ΗΜΕΡΑΣ ΤΗΣ ΤΡΕΧΟΥΣΑΣ ΠΕΡΙΟΥΔΟΥ ΚΑΙ ΤΟΥ ΤΡΕΧΟΝΤΟΣ ΕΤΟΥΣ ΜΕ ΜΟΡΦΗ ΗΗ/ΜΜ/ΕΕΕΕ
// ============================================================
function getLastDateOfMonth(periodos, xrhsh) {
    // Μετατρέπουμε το έτος χρήσης και την περίοδο σε αριθμούς
    const year = parseInt(xrhsh, 10); // π.χ. 2024
    const month = parseInt(periodos, 10); // π.χ. 10 (Οκτώβριος)

    // Δημιουργούμε την ημερομηνία για την 1η του επόμενου μήνα
    const firstDayOfNextMonth = new Date(year, month, 1);

    // Αφαιρούμε μία ημέρα για να πάρουμε την τελευταία ημέρα του μήνα
    const lastDate = new Date(firstDayOfNextMonth - 1);

    // Μορφοποιούμε την ημερομηνία σε ηη/μμ/εεεε
    const formattedDate = lastDate.toLocaleDateString('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    return formattedDate;
}

// ============================================================
// API για επιστροφή απ' τη ΒΔ του αριθμού και των ημερομηνιών των αργιών
// ============================================================
async function getArgiesCount(params) {
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

// ============================================================
// API για επιστροφή απ' τη ΒΔ του αριθμού των μη εργασίμων, των ρεπό και των ημερομηνιών των ρεπό
// ============================================================
async function getMhErgasiaCount(params) {
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

// ============================================================
// API για επιστροφή απ' τη ΒΔ του αριθμού των προηγούμενων ασθενειών
// ============================================================
async function getAstheneiesCount(params) {
    const data = await fetch('/api/kinhseis/prohgoymenes_astheneies', {
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

async function getAsfalistikesKlaseis(params) {
    const data = await fetch('/api/kinhseis/asfalistikes_klaseis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({  etos:                           params.etos,
                                pragmatikoHmeromisthioParsed:   params.pragmatikoHmeromisthioParsed
                            })
    });
    const result = await data.json();
    return result;
}


// ============================================================
// Υπολογισμός εργασίμων ημερών για έλεγχο αν είναι < 10 ημέρες (Δεν δικαιούται άδεια ασθενείας)
// ============================================================
async function calcWorkDays(dateStart, dateEnd) {
    const { ergasimes } = await getMhErgasiaCount({
        team: sharedParams._TEAM,
        company_kod: _ID_ETAIREIAS,
        kodikos: _KODIKOS_ERGAZOMENOY,
        dateStart: dateStart,
        dateEnd: dateEnd
    });

    return ergasimes;
}

// ============================================================
// Διαφορά ημερών μεταξύ δύο ημερομηνιών (string ή Date), χωρίς ώρες.
// ============================================================
async function diffDays(dateStart, dateEnd) {
    const d1 = new Date(dateStart);
    const d2 = new Date(dateEnd);
    const msPerDay = 24 * 60 * 60 * 1000;
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());

    return Math.floor((utc2 - utc1) / msPerDay);
}

// ============================================================
// Επιστρέφει τον μήνα (1-12) από string "yyyy-mm-dd" ή ISO
// ============================================================
function getMonthFromDateString(dateString) {
    if (!dateString) return null;
    return parseInt(dateString.substring(5, 7), 10);
}

// ============================================================
// Υπολογισμός του ημερολογιακού διαστήματος των ασθενειών
// ============================================================
function calcDateDiffWorkYear(apo_hmeromhnia_astheneias, hmeromhnia_proslhpshs, periodos) {
    if (apo_hmeromhnia_astheneias) {
        const apoDate = new Date(apo_hmeromhnia_astheneias);
        const proslhpshDate = new Date(hmeromhnia_proslhpshs);
        differenceInDays = Math.floor((apoDate - proslhpshDate) / (1000 * 60 * 60 * 24)) - 1;
    } else {
        const arxh_periodoy = document.getElementById("etos").value + "-" + periodos + "-01T00:00:00.000Z"
        const today = new Date(arxh_periodoy); 
        const year = today.getFullYear();
        const month = parseInt(periodos) - 1;
        const startDayOfMonth = new Date(year, month - 1 + 1, 1);
        const proslhpshDate = new Date(hmeromhnia_proslhpshs);
        differenceInDays = Math.floor((startDayOfMonth - proslhpshDate) / (1000 * 60 * 60 * 24));
    }
    if (!differenceInDays) {
        return 0;
    } else {
        return differenceInDays;
    }
}

// ============================================================
//  Υπολογισμός εργασιακού & ημερολογιακού έτους.
// ============================================================
function calculateWorkYearDates(
    hmeromhnia_proslhpshs,
    hmeromhnia_apoxorhshs,
    currentYear,
    nextYear
) {
    // 1. Μετατρέπουμε την hmeromhnia_proslhpshs σε Date (UTC parsing αν υπάρχει "Z" στο τέλος)
    const hireDate  = new Date(hmeromhnia_proslhpshs);
    const hireApoxDate  = new Date(hmeromhnia_apoxorhshs);

    // Παίρνουμε έτος, μήνα, ημέρα σε UTC (και όχι τοπική ώρα)
    const hireYear  = hireDate.getUTCFullYear();
    const hireMonth = hireDate.getUTCMonth();    // 0-based
    const hireDay   = hireDate.getUTCDate();     // 1-based
    
    const endOfCurrentYear = currentYear + "-12-31T00:00:00.000Z"

    let arxh_hmerologiakoy_etoys = hireYear < currentYear ? currentYear + "-01-01T00:00:00.000Z" : hireYear + "-01-01T00:00:00.000Z";
    
    let telos_hmerologiakoy_etoys = !hireApoxDate 
    ? null 
    : hireApoxDate < endOfCurrentYear 
        ? hireApoxDate 
        : endOfCurrentYear;

    let arxh_epomenoy_hmerologiakoy_etoys = currentYear + 1 + "-01-01T00:00:00.000Z";
    let telos_epomenoy_hmerologiakoy_etoys = currentYear + 1 + "-12-31T00:00:00.000Z";
    let startWorkYear, endWorkYear;
    let startWorkNextYear, endWorkNextYear;

    if (hireYear === currentYear - 1) {
        // Σενάριο 1
        startWorkYear     = new Date(Date.UTC(hireYear, hireMonth, hireDay));
        endWorkYear       = new Date(Date.UTC(currentYear, hireMonth, hireDay));
        // Tέλος στο "μία μέρα πριν" (σε UTC)
        endWorkYear.setUTCDate(endWorkYear.getUTCDate() - 1);

        startWorkNextYear = new Date(Date.UTC(currentYear, hireMonth, hireDay));
        endWorkNextYear   = new Date(Date.UTC(nextYear, hireMonth, hireDay));
        endWorkNextYear.setUTCDate(endWorkNextYear.getUTCDate() - 1);

    } else if (hireYear < currentYear - 1) {
        // Σενάριο 2
        startWorkYear     = new Date(Date.UTC(currentYear - 1, hireMonth, hireDay));
        endWorkYear       = new Date(Date.UTC(currentYear, hireMonth, hireDay));
        endWorkYear.setUTCDate(endWorkYear.getUTCDate() - 1);

        startWorkNextYear = new Date(Date.UTC(currentYear, hireMonth, hireDay));
        endWorkNextYear   = new Date(Date.UTC(nextYear, hireMonth, hireDay));
        endWorkNextYear.setUTCDate(endWorkNextYear.getUTCDate() - 1);

    } else if (hireYear === currentYear) {
        // Σενάριο 3
        startWorkYear     = new Date(Date.UTC(hireYear, hireMonth, hireDay));
        endWorkYear       = new Date(Date.UTC(nextYear, hireMonth, hireDay));
        endWorkYear.setUTCDate(endWorkYear.getUTCDate() - 1);

        startWorkNextYear = new Date(Date.UTC(nextYear, hireMonth, hireDay));
        endWorkNextYear   = new Date(Date.UTC(nextYear + 1, hireMonth, hireDay));
        endWorkNextYear.setUTCDate(endWorkNextYear.getUTCDate() - 1);

    } else {
        // Εάν hireYear > currentYear
        // <p class="bold-text">Λάθος ημερομηνία</p>
        let message = `
            <p class="bold-text">Λάθος ημερομηνία (γραμμή ${row})</p>
            <p>&nbsp;</p>
            <p>
                Το έτος πρόσληψης του/ης εργαζόμενου/ης (<strong>${hireYear}</strong>) 
                είναι μεγαλύτερο από το τρέχον έτος χρήσης (<strong>${currentYear}</strong>).
            </p>`;

        startWorkYear = null;
        endWorkYear = null;
        startWorkNextYear = null;
        endWorkNextYear = null;

        showAlert(message);
        return;
    }

    // 2. Προαιρετικός έλεγχος αποχώρησης (αν η αποχώρηση είναι μέσα στο τρέχον εργασιακό έτος)
    if (hmeromhnia_apoxorhshs && startWorkYear && endWorkYear) {
        const apoxorhshDate = new Date(hmeromhnia_apoxorhshs);
        // (Αν το string έχει "Z", θα διαβαστεί σε UTC, αλλιώς μπορεί να γίνει local->UTC conversion)
        if (apoxorhshDate >= startWorkYear && apoxorhshDate <= endWorkYear) {
            // Τερματίζουμε το τρέχον έτος στην ημερομηνία αποχώρησης
            endWorkYear = apoxorhshDate; 
            // Ακυρώνουμε το επόμενο εργασιακό έτος (αν θέλουμε)
            startWorkNextYear = null;
            endWorkNextYear   = null;
        }
    }

    // 3. Επιστρέφουμε τις ημερομηνίες σε μορφή ISO string (π.χ. 2023-10-05T00:00:00.000Z)
    return {
        startWorkYear: startWorkYear ? formatDateToCustom(startWorkYear) : null,
        endWorkYear: endWorkYear ? formatDateToCustom(endWorkYear) : null,
        startWorkNextYear: startWorkNextYear ? formatDateToCustom(startWorkNextYear) : null,
        endWorkNextYear: endWorkNextYear ? formatDateToCustom(endWorkNextYear) : null,
        arxh_hmerologiakoy_etoys: arxh_hmerologiakoy_etoys ? formatDateToCustom(arxh_hmerologiakoy_etoys) : null,
        telos_hmerologiakoy_etoys: telos_hmerologiakoy_etoys ? formatDateToCustom(telos_hmerologiakoy_etoys) : null,
        arxh_epomenoy_hmerologiakoy_etoys: arxh_epomenoy_hmerologiakoy_etoys ? formatDateToCustom(arxh_epomenoy_hmerologiakoy_etoys) : null,
        telos_epomenoy_hmerologiakoy_etoys: telos_epomenoy_hmerologiakoy_etoys ? formatDateToCustom(telos_epomenoy_hmerologiakoy_etoys) : null
    };
}

// =======================================================================================================
// Δένει τα events (blur) για μια γραμμή π.χ. "01", "02", κλπ. με eventListeneds attachRowListeners(row)
// =======================================================================================================
async function attachRowListeners_Astheneias(row) {
    // 1) Εντοπίζουμε τα πεδία DOM
    const apo_hmeromhnia_astheneias = document.getElementById(`apo_hmeromhnia_astheneias_${row}`);
    const eos_hmeromhnia_astheneias = document.getElementById(`eos_hmeromhnia_astheneias_${row}`);
    const days_less_3 = document.getElementById(`days_less_3_${row}`);
    const days_greater_3 = document.getElementById(`days_greater_3_${row}`);
    const synolo_astheneias = document.getElementById(`synolo_astheneias_${row}`);
    const idios_logos = document.getElementById(`idios_logos_${row}`);
    const epidothsh_efka = document.getElementById(`epidothsh_efka_${row}`)

    // Αν κάποια πεδία δεν υπάρχουν, απλώς τυπώνουμε προειδοποίηση κι επιστρέφουμε
    if (!apo_hmeromhnia_astheneias || !eos_hmeromhnia_astheneias || !days_less_3 || !days_greater_3 || !synolo_astheneias) {
        console.warn(`Δεν βρέθηκαν πεδία για τη γραμμή "${row}"`);
        return;
    }

    // 2) blur event στο apo_hmeromhnia_astheneias_{row}
    apo_hmeromhnia_astheneias.addEventListener('blur', async () => {
        if (!apo_hmeromhnia_astheneias.value) return;

        // Υπολογισμός πόσες μέρες από την πρόσληψη
        const diff = await calcWorkDays(_HMEROMHNIA_PROSLHPSHS, formatDateToCustom(apo_hmeromhnia_astheneias.value));
        
        // Έλεγχος < 10
        if (diff < 11) {
            document.getElementById(`days_less_3_${row}`).value = 0;
            document.getElementById(`days_greater_3_${row}`).value = 0;
            document.getElementById(`synolo_astheneias_${row}`).value = 0;
            document.getElementById(`eidos_astheneias_${row}`).value = "ΑΔΑΣ";

            apo_hmeromhnia_astheneias.value = "";
            eos_hmeromhnia_astheneias.value = "";

            let message;
            if (diff < 0) {
                message = `
                    <p class="bold-text">Λάθος ημερομηνία (γραμμή ${row})</p>
                    <p>&nbsp;</p>
                    <p>Ο/Η εργαζόμενος/η έχει προσληφθεί στις <strong>${formatDate(_HMEROMHNIA_PROSLHPSHS)}</strong>.</p>`
            } else {
                message = `
                    <p class="bold-text">Λάθος ημερομηνία (γραμμή ${row})</p>
                    <p>&nbsp;</p>
                    <p>Ο/Η εργαζόμενος/η δεν έχει συμπληρώσει ( από την πρόσληψη ${formatDate(_HMEROMHNIA_PROSLHPSHS)} ) 10 ημέρες πραγματικής απασχόλησης. <strong>Δεν δικαιούται άδεια ασθενείας</strong>.</p>`
            }
            showAlert(message);
            return;
        }

    });

    // 3) blur event τόσο στο apo_hmeromhnia_astheneias_{row} όσο και στο eos_hmeromhnia_astheneias_{row} για έλεγχο μήνα vs periodos, αφαίρεση αργιών, κ.λπ.
    [apo_hmeromhnia_astheneias, eos_hmeromhnia_astheneias].forEach((field) => {
        field.addEventListener('blur', async () => {
            // Αν δεν έχουν τιμές, σταματάμε
            if (!apo_hmeromhnia_astheneias.value || !eos_hmeromhnia_astheneias.value) return;

            document.getElementById(`days_less_3_${row}`).value = 0;
            document.getElementById(`days_greater_3_${row}`).value = 0;
            document.getElementById(`synolo_astheneias_${row}`).value = 0;

            // Έλεγχος μήνα
            const apoMonth = getMonthFromDateString(apo_hmeromhnia_astheneias.value);
            const eosMonth = getMonthFromDateString(eos_hmeromhnia_astheneias.value);
            const periodosSelect = document.getElementById("periodos");
            if (!periodosSelect) return;

            const selectedPeriod = parseInt(periodosSelect.value, 10);

            if (apoMonth !== selectedPeriod || eosMonth !== selectedPeriod) {
                document.getElementById(`days_less_3_${row}`).value = 0;
                document.getElementById(`days_greater_3_${row}`).value = 0;
                document.getElementById(`synolo_astheneias_${row}`).value = 0;
    
                apo_hmeromhnia_astheneias.value = "";
                eos_hmeromhnia_astheneias.value = "";

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
                const previous_eos_hmeromhnia_astheneias = document.getElementById(`eos_hmeromhnia_astheneias_${previousRow}`);

                if (formatDateToISO(formatDate(apo_hmeromhnia_astheneias.value)) <= formatDateToISO(formatDate(previous_eos_hmeromhnia_astheneias.value)) || formatDateToISO(formatDate(eos_hmeromhnia_astheneias.value)) <= formatDateToISO(formatDate(previous_eos_hmeromhnia_astheneias.value))) {
                    apo_hmeromhnia_astheneias.value = "";
                    eos_hmeromhnia_astheneias.value = "";
    
                    message = `
                        <p class="bold-text">Λάθος ημερομηνίες (γραμμή ${row})</p>
                        <p>&nbsp;</p>
                        <p>Δεν επιτρέπεται η ημερομηνία έναρξης ή και λήξης της τρέχουσας γραμμής της ασθένειας, να είναι <strong>μικρότερη/ες ή ίση/ες</strong> της ημερομηνίας λήξης της προηγούμενης περιόδου ασθένειας.</p>`
                    showAlert(message);
                    return;
                }
            }

            // Ελέγχουμε για την ορθότητα των ημερομηνιών των ασθενειών σε σχέση με την ημερομηνία αποχώρησης 
            const hmeromhnia_apoxorhshs = document.getElementById("hmeromhnia_apoxorhshs_hidden");

            let startDate = new Date(parseInt(document.getElementById("etos").value, 10), parseInt(document.getElementById("mhnas").value, 10) - 1, 1);
            let endDate = new Date(parseInt(document.getElementById("etos").value, 10), parseInt(document.getElementById("mhnas").value, 10), 0);

            // if (new Date(_HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS) >= formatDateToISO(arxh_periodoy)) { 
            //     _HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS = document.getElementById("hmeromhnia_arxhs_ergasiakoy_etoys").value;
            // } 
            // if (fromDatePerRow >= new Date(_HMEROMHNIA_ARXHS_EPOMENOY_ERGASIAKOY_ETOYS)) { 
            //     _HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS = document.getElementById("hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys").value;
            // }

            if (hmeromhnia_apoxorhshs && (formatDateToCustom(new Date(hmeromhnia_apoxorhshs.value)) >= formatDateToCustom(startDate) && formatDateToCustom(new Date(hmeromhnia_apoxorhshs.value)) <= formatDateToCustom(endDate))) {
                if (formatDateToCustom(new Date(apo_hmeromhnia_astheneias.value)) > formatDateToCustom(new Date(hmeromhnia_apoxorhshs.value)) || formatDateToCustom(new Date(eos_hmeromhnia_astheneias.value)) > formatDateToCustom(new Date(hmeromhnia_apoxorhshs.value))) {
                    apo_hmeromhnia_astheneias.value = "";
                    eos_hmeromhnia_astheneias.value = "";
                    message = `
                        <p class="bold-text">Λάθος ημερομηνίες (γραμμή ${row})</p>
                        <p>&nbsp;</p>
                        <p>Ο/Η εργαζόμενος/η αποχώρησε στις <strong>${formatDateRepo_Argies(new Date(hmeromhnia_apoxorhshs.value).toString())}</strong>.</p>`
                    showAlert(message);
                    return;
                }
            }

            // Ελέγχουμε αν ο μήνας των ημερομηνιών των ασθενειών είναι ίδιος με την περίοδο χρήσης
            const diasthma_hmeron_astheneias = document.getElementById("diasthma_hmeron_astheneias");
            const diasthma_hmeron_astheneias_timh = document.getElementById("diasthma_hmeron_astheneias_timh");
            const meion = document.getElementById("meion");
            const mh_ergasimes_basei_orarioy = document.getElementById("mh_ergasimes_basei_orarioy");
            const mh_ergasimes_basei_orarioy_timh = document.getElementById("mh_ergasimes_basei_orarioy_timh");
            const anapaysh_repo = document.getElementById("repo");
            const argies = document.getElementById("argies");
            const syn = document.getElementById("syn");
            const argies_mh_ergasimon_repo = document.getElementById("argies_mh_ergasimon_repo");
            const argies_mh_ergasimon_repo_timh = document.getElementById("argies_mh_ergasimon_repo_timh");
            const argies_mh_ergasimon_repo_hmeromhnies = document.getElementById("argies_mh_ergasimon_repo_hmeromhnies");

            dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys = document.getElementById("dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys");
            dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys_timh = document.getElementById("dikaioymenh_astheneia_epomenoy_ergasiakoy_etoys_timh");
            synolo_dikaioymenhs_adeias_astheneias = document.getElementById("synolo_dikaioymenhs_adeias_astheneias");
            synolo_dikaioymenhs_adeias_astheneias_timh = document.getElementById("synolo_dikaioymenhs_adeias_astheneias_timh");
            lhftheisa_adeia_astheneias = document.getElementById("lhftheisa_adeia_astheneias");
            lhftheisa_adeia_astheneias_timh = document.getElementById("lhftheisa_adeia_astheneias_timh");
            ypoloipo_adeias_astheneias = document.getElementById("ypoloipo_adeias_astheneias");
            ypoloipo_adeias_astheneias_timh = document.getElementById("ypoloipo_adeias_astheneias_timh");

            let eos_hmeromhnia_astheneias_elegxoy;
            const apoHmeromhniaDate = new Date(formatDateToCustom(apo_hmeromhnia_astheneias.value));
            const eosHmeromhniaDate = new Date(formatDateToCustom(eos_hmeromhnia_astheneias.value));
            const hmeromhniaTeloysErgasiakoyEtoysDate = new Date(_HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS);
            const hmeromhniaArxhsEpomenoyEtoysDate = new Date(_HMEROMHNIA_ARXHS_EPOMENOY_ERGASIAKOY_ETOYS);
            eos_hmeromhnia_astheneias_elegxoy = formatDateToCustom(new Date(apo_hmeromhnia_astheneias.value).setDate(new Date(apo_hmeromhnia_astheneias.value).getDate() - 1));
                        
            if (hmeromhniaTeloysErgasiakoyEtoysDate >= apoHmeromhniaDate) { 
                _HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS = hmeromhnia_arxhs_ergasiakoy_etoys;
                if (hmeromhniaTeloysErgasiakoyEtoysDate >= eosHmeromhniaDate) {
                    _TELOS_ERGASIAKHS_PERIODOY = formatDateRepo_Argies(hmeromhniaTeloysErgasiakoyEtoysDate);
                } else {
                    _TELOS_ERGASIAKHS_PERIODOY = formatDateRepo_Argies(new Date(eos_hmeromhnia_astheneias.value).setDate(new Date(eos_hmeromhnia_astheneias.value).getDate() - 1));
                }
            } 
            if (apoHmeromhniaDate >= hmeromhniaArxhsEpomenoyEtoysDate) { 
                _HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS = hmeromhnia_arxhs_epomenoy_ergasiakoy_etoys;
                _TELOS_ERGASIAKHS_PERIODOY = formatDateRepo_Argies(_HMEROMHNIA_TELOYS_EPOMENOY_ERGASIAKOY_ETOYS);
            }

            // Υπολογισμός διαφοράς ημερών
            _HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS = formatDateToISO(hmeromhnia_teloys_ergasiakoy_etoys);

            differenceInDays = await diffDays(apo_hmeromhnia_astheneias.value, eos_hmeromhnia_astheneias.value) + 1;
            
            diasthmataAstheneias[`_HMERES_ASTHENEIAS_${row}`] = differenceInDays || 0;

            diasthma_hmeron_astheneias.innerHTML = `Συνολικό Διάστημα Ασθένειας: `;
            diasthma_hmeron_astheneias_timh.innerHTML = `<b>${
                diasthmataAstheneias['_HMERES_ASTHENEIAS_01'] +
                diasthmataAstheneias['_HMERES_ASTHENEIAS_02'] +
                diasthmataAstheneias['_HMERES_ASTHENEIAS_03'] +
                diasthmataAstheneias['_HMERES_ASTHENEIAS_04'] +
                diasthmataAstheneias['_HMERES_ASTHENEIAS_05']
            }</b>`;
            document.getElementById("diasthmaHmeronAstheneias").value = `${
                diasthmataAstheneias['_HMERES_ASTHENEIAS_01'] +
                diasthmataAstheneias['_HMERES_ASTHENEIAS_02'] +
                diasthmataAstheneias['_HMERES_ASTHENEIAS_03'] +
                diasthmataAstheneias['_HMERES_ASTHENEIAS_04'] +
                diasthmataAstheneias['_HMERES_ASTHENEIAS_05']
            }`;

            await handleRepoDates(row);
            
            await handleArgiesDates(row);
            

            const repoDatesArray = anapaysh_repo_hmeromhnies.innerHTML.split(', ').filter(Boolean);
            const argiesDatesArray = argies_hmeromhnies.innerHTML.split(', ').filter(Boolean);

            // Βρίσκουμε τις κοινές ημερομηνίες
            const commonDates = repoDatesArray.filter(date => argiesDatesArray.includes(date));

            // Ενημέρωση του τρίτου label
            argies_mh_ergasimon_repo_hmeromhnies.innerHTML = commonDates.join(', ');
            const argies_mh_ergasimon_repo_hmeromhnies_Text = argies_mh_ergasimon_repo_hmeromhnies.innerHTML;
            document.getElementById("argiesMhErgasimonRepoHmeromhnies").value = argies_mh_ergasimon_repo_hmeromhnies.innerHTML;

            // Μετατρέπουμε το κείμενο σε πίνακα ημερομηνιών
            const argies_mh_ergasimon_repo_hmeromhnies_Array = argies_mh_ergasimon_repo_hmeromhnies_Text.split(',').map(x => x.trim()).filter(Boolean);
            
            // Υπολογίζουμε το πλήθος των ημερομηνιών
            _KOINES_ARGIES = argies_mh_ergasimon_repo_hmeromhnies_Array.length;

            diasthmataArgionSeRepoKaiMhErgasimes[`_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_${row}`] = _KOINES_ARGIES; 

            meion.innerHTML = `ΜΕΙΟΝ `;

            mh_ergasimes_basei_orarioy.innerHTML = `Μη Εργάσιμες Βάσει Ωραρίου: `;
            mh_ergasimes_basei_orarioy_timh.innerHTML = `<b>${
                diasthmataMhErgasimon['_HMERES_MH_ERGASIMON_01'] +
                diasthmataMhErgasimon['_HMERES_MH_ERGASIMON_02'] +
                diasthmataMhErgasimon['_HMERES_MH_ERGASIMON_03'] +
                diasthmataMhErgasimon['_HMERES_MH_ERGASIMON_04'] +
                diasthmataMhErgasimon['_HMERES_MH_ERGASIMON_05']
            }</b>`;
            document.getElementById("mhErgasimesBaseiOrarioy").value = parseInt(
                diasthmataMhErgasimon['_HMERES_MH_ERGASIMON_01'] +
                diasthmataMhErgasimon['_HMERES_MH_ERGASIMON_02'] +
                diasthmataMhErgasimon['_HMERES_MH_ERGASIMON_03'] +
                diasthmataMhErgasimon['_HMERES_MH_ERGASIMON_04'] +
                diasthmataMhErgasimon['_HMERES_MH_ERGASIMON_05']);
               
            anapaysh_repo.innerHTML = `Ρεπό: `;
            anapaysh_repo_timh.innerHTML = `<b>${
                diasthmataRepo['_HMERES_REPO_01'] +
                diasthmataRepo['_HMERES_REPO_02'] +
                diasthmataRepo['_HMERES_REPO_03'] +
                diasthmataRepo['_HMERES_REPO_04'] +
                diasthmataRepo['_HMERES_REPO_05']
            }</b>`;
            document.getElementById("repoTimh").value = parseInt(
                diasthmataRepo['_HMERES_REPO_01'] +
                diasthmataRepo['_HMERES_REPO_02'] +
                diasthmataRepo['_HMERES_REPO_03'] +
                diasthmataRepo['_HMERES_REPO_04'] +
                diasthmataRepo['_HMERES_REPO_05'] );
            
            argies.innerHTML = `Αργίες: `;
            argies_timh.innerHTML = `<b>${
                diasthmataArgion['_HMERES_ARGION_01'] +
                diasthmataArgion['_HMERES_ARGION_02'] +
                diasthmataArgion['_HMERES_ARGION_03'] +
                diasthmataArgion['_HMERES_ARGION_04'] +
                diasthmataArgion['_HMERES_ARGION_05']
            }</b>`;

            syn.innerHTML = ` `;
            argies_mh_ergasimon_repo.innerHTML = `Αργίες σε Ρεπό και μη Εργάσιμες: `;
            argies_mh_ergasimon_repo_timh.innerHTML = `<b>${
                diasthmataArgionSeRepoKaiMhErgasimes['_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_01'] +
                diasthmataArgionSeRepoKaiMhErgasimes['_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_02'] +
                diasthmataArgionSeRepoKaiMhErgasimes['_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_03'] +
                diasthmataArgionSeRepoKaiMhErgasimes['_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_04'] +
                diasthmataArgionSeRepoKaiMhErgasimes['_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_05']
            }</b>`;
            document.getElementById("argiesMhErgasimonRepoTimh").value = parseInt(
                diasthmataArgionSeRepoKaiMhErgasimes['_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_01'] +
                diasthmataArgionSeRepoKaiMhErgasimes['_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_02'] +
                diasthmataArgionSeRepoKaiMhErgasimes['_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_03'] +
                diasthmataArgionSeRepoKaiMhErgasimes['_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_04'] +
                diasthmataArgionSeRepoKaiMhErgasimes['_HMERES_ARGION_SE_REPO_KAI_MH_ERGASIMES_05']);

            _HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS = hmeromhnia_teloys_ergasiakoy_etoys.value;

            // ΕΥΡΕΣΗ ΤΩΝ ΠΡΟΗΓΟΥΜΕΝΩΝ ΑΣΘΕΝΕΙΩΝ ΠΟΥ ΑΦΟΡΟΥΝ ΤΟ ΤΡΕΧΟΝ ΕΡΓΑΣΙΑΚΟ ΕΤΟΣ
            lhftheisa_adeia = 0;
            const results = await getAstheneiesCount({
                team: sharedParams._TEAM,
                company_kod: _KODIKOS_ETAIREIAS,
                etos: sharedParams._XRHSH,
                kodikos: _KODIKOS_ERGAZOMENOY,
                dateStart: formatDateToISO(_HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS),
                dateEnd: eos_hmeromhnia_astheneias_elegxoy
            });
    
            synoloProhgoymenonHmeronLess3 = results.synola.synolo_hmeron_less_3 || 0;
            synoloProhgoymenonHmeronGreater3 = results.synola.synolo_hmeron_greater_3 || 0;
            synoloProhgoymenonHmeronAstheneias = results.synola.synolo_hmeron_astheneias || 0;
            
            // Αφαιρούμε από το χρονικό διάστημα της ασθένειας τις αργίες, τις μη εργάσιμες και τα ρεπό
            let synoloVal = 0, trexon_ypoloipo = 0;

            synoloVal = Math.max(0, (differenceInDays - (_MH_ERGASIMES_HMERES + _REPO)));

            let fromDatePerRow, toDatePerRow;
            _HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS = formatDateToISO(hmeromhnia_teloys_ergasiakoy_etoys);

            fromDatePerRow = new Date(formatDateToCustom(apo_hmeromhnia_astheneias.value));
            toDatePerRow = new Date(formatDateToCustom(eos_hmeromhnia_astheneias.value));

            await calcHmeresAstheneias(fromDatePerRow, toDatePerRow, synoloVal, row);
            await calcTrexontaSynola();
            await calcEpidothsEfka(row);
            await calcApodoxesAstheneias(row);
            await calcHmeresErgasiasMeionApoysies();
            await calcMiktesApodoxes();
            await handleSynoloMiktonChange();

            // ΕΥΡΕΣΗ ΤΗΣ ΤΕΛΕΥΤΑΙΑΣ ΗΜΕΡΑΣ ΤΗΣ ΠΕΡΙΟΔΟΥ ΜΙΣΘΟΔΟΣΙΑΣ
            let etos_xrhshs = eos_hmeromhnia_astheneias.value.toString().substring(0, 4);
            let mhnas_xrhshs = eos_hmeromhnia_astheneias.value.toString().substring(5, 7);
            const teleytaia_hmera_periodoy = getLastDateOfMonth(mhnas_xrhshs, etos_xrhshs)
        });

    });

    async function calcTrexontaSynola() {
        let synolo_days_less_3 = 0, synolo_days_greater_3 = 0, synolo_asteneias_L3_G3 = 0;
        let ypoloipo_adeias_astheneias = parseInt(_SYNOLO_DIKAIOYMENHS_ASTHENEIAS) - parseInt(synoloProhgoymenonHmeronAstheneias);
        let hmeres = 0;

        for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[51].timh); i++) {
            hmeres = parseInt(document.getElementById(`days_less_3_0${i}`).value) + parseInt(document.getElementById(`days_greater_3_0${i}`).value);

            if (hmeres > ypoloipo_adeias_astheneias) {
                let message = `
                <p class="bold-text">ΠΡΟΣΟΧΗ !!!</p>
                <p>&nbsp;</p>
                <p>
                    Οι ημέρες άδειας ασθενείας που πληκτρολογήσατε, είναι μεγαλύτερες της υπολλειπόμενης άδειας ασθενείας
                </p>`;
                document.getElementById(`days_less_3_0${i}`).value = parseInt(oldLess3Value);
                document.getElementById(`days_greater_3_0${i}`).value = parseInt(oldGreater3Value);
                document.getElementById(`synolo_astheneias_0${i}`).value = parseInt(oldSynoloValue);

                for (let j = 1; j <= parseInt(sharedParams.genikesParametroi[51].timh); j++) {
                    document.getElementById(`synolo_astheneias_0${j}`).value = parseInt(document.getElementById(`days_less_3_0${j}`).value) + parseInt(document.getElementById(`days_greater_3_0${j}`).value);

                    synolo_days_less_3 += parseInt(document.getElementById(`days_less_3_0${j}`).value);
                    synolo_days_greater_3 += parseInt(document.getElementById(`days_greater_3_0${j}`).value);
                    synolo_asteneias_L3_G3 += parseInt(document.getElementById(`synolo_astheneias_0${j}`).value);
    
                    document.getElementById("synolo_less_3").value = parseInt(synolo_days_less_3);
                    document.getElementById("synolo_greater_3").value = parseInt(synolo_days_greater_3);
                    document.getElementById("geniko_synolo_hmeron_astheneias").value = parseInt(synolo_asteneias_L3_G3);
                }
                showAlert(message);
                return;

            } else {
                document.getElementById(`synolo_astheneias_0${i}`).value = parseInt(document.getElementById(`days_less_3_0${i}`).value) + parseInt(document.getElementById(`days_greater_3_0${i}`).value);

                synolo_days_less_3 += parseInt(document.getElementById(`days_less_3_0${i}`).value);
                synolo_days_greater_3 += parseInt(document.getElementById(`days_greater_3_0${i}`).value);
                synolo_asteneias_L3_G3 += parseInt(document.getElementById(`synolo_astheneias_0${i}`).value);

                document.getElementById("synolo_less_3").value = parseInt(synolo_days_less_3);
                document.getElementById("synolo_greater_3").value = parseInt(synolo_days_greater_3);
                document.getElementById("geniko_synolo_hmeron_astheneias").value = parseInt(synolo_asteneias_L3_G3);

                let lhfteisa_adeia = await calcLhftheisaAdeiaAstheneias();
                lhfteisa_adeia_asteneias_prohgoymenon_mhnon.innerHTML = `<strong>ΛΗΦΘΕΙΣΑ</strong> Άδεια Ασθενείας περ. (${_HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS} - ${_TELOS_ERGASIAKHS_PERIODOY}):`;
                lhfteisa_adeia_asteneias_prohgoymenon_mhnon_timh.innerHTML = `<b>${parseInt(lhfteisa_adeia)}</b>`;
                document.getElementById("lhfteisaAdeiaAsteneiasProhgoymenonMhnon"),value = parseInt(lhfteisa_adeia) || 0;
                
                _YPOLOIPO_ADEIAS_ASTHENEIAS_TREXONTOS_ETOYS = parseInt(_SYNOLO_DIKAIOYMENHS_ASTHENEIAS) - parseInt(lhftheisa_adeia);

                ypoloipo_adeias_astheneias_trexontos_etoys.innerHTML = `Υπόλοιπο Άδειας Ασθενείας Τρέχοντος Εργασιακού Έτους: `;
                ypoloipo_adeias_astheneias_trexontos_etoys_timh.innerHTML = 
                    _YPOLOIPO_ADEIAS_ASTHENEIAS_TREXONTOS_ETOYS < 0 
                    ? `<b>0</b>` 
                    : `<b>${parseInt(parseInt(_SYNOLO_DIKAIOYMENHS_ASTHENEIAS) - parseInt(lhftheisa_adeia))}</b>`;
                document.getElementById("ypoloipoAstheneiasTrexontosEtoys").value = parseInt(parseInt(_SYNOLO_DIKAIOYMENHS_ASTHENEIAS) - parseInt(lhftheisa_adeia)) || 0;
            }
        }
    }

    [days_less_3, days_greater_3].forEach((field) => {
        field.addEventListener('blur', async () => {
            await calcTrexontaSynola();
        });
    });

    [epidothsh_efka].forEach((field) => {
        field.addEventListener('blur', async () => {
            await calcApodoxesAstheneias(row);
        });
    });

    [idios_logos].forEach((field) => {
        field.addEventListener('click', async () => {
            if (idios_logos.checked) {
                document.getElementById(`days_less_3_${row}`).value = 0;
                document.getElementById(`days_greater_3_${row}`).value = 0;
                document.getElementById(`synolo_astheneias_${row}`).value = 0;
            } else {
                document.getElementById(`days_less_3_${row}`).value = parseInt(oldLess3Value) || 0;
                document.getElementById(`days_greater_3_${row}`).value = parseInt(oldGreater3Value) || 0;
                document.getElementById(`synolo_astheneias_${row}`).value = parseInt(oldSynoloValue) || 0;
            }
            document.getElementById(`eidos_astheneias_${row}`).value = "ΑΔΑΣ";

            await calcTrexontaSynola();
        });
    });
}

async function calcHmeresAstheneias(fromDatePerRow, toDatePerRow, synoloVal, row) {
    if (new Date(_HMEROMHNIA_TELOYS_ERGASIAKOY_ETOYS) >= fromDatePerRow) { 
        _SYNOLO_DIKAIOYMENHS_ASTHENEIAS = parseInt(_DIKAIOYMENH_ASTHENEIA_TREXONTOS_ETOYS);

        await ypologismosHmeronAstheneias(fromDatePerRow, toDatePerRow, _SYNOLO_DIKAIOYMENHS_ASTHENEIAS, synoloVal, row);
    } 

    if (fromDatePerRow >= new Date(_ARXH_EPOMENOY_ERGASIAKOY_ETOYS)) { 
        _SYNOLO_DIKAIOYMENHS_ASTHENEIAS = parseInt(_DIKAIOYMENH_ASTHENEIA_EPOMENOY_ETOYS);

        await ypologismosHmeronAstheneias(fromDatePerRow, toDatePerRow, _SYNOLO_DIKAIOYMENHS_ASTHENEIAS, synoloVal, row);
    }
}

async function ypologismosHmeronAstheneias(fromDatePerRow, toDatePerRow, _SYNOLO_DIKAIOYMENHS_ASTHENEIAS, synoloVal, row) {
    _YPOLOIPO_ADEIAS_ASTHENEIAS_TREXONTOS_ETOYS = parseInt(_SYNOLO_DIKAIOYMENHS_ASTHENEIAS) - parseInt(synoloProhgoymenonHmeronAstheneias);

    dikaioymenh_astheneia_trexontos_ergasiakoy_etoys.innerHTML = `<strong>ΔΙΚΑΙΟΥΜΕΝΗ</strong> Ασθένεια περ. (${_HMEROMHNIA_ARXHS_ERGASIAKOY_ETOYS} - ${_TELOS_ERGASIAKHS_PERIODOY}):`;
    dikaioymenh_astheneia_trexontos_ergasiakoy_etoys_timh.innerHTML = `<b>${parseInt(_SYNOLO_DIKAIOYMENHS_ASTHENEIAS)}</b>`;
    document.getElementById("dikaioymenhAstheneiaTrexontosErgasiakoyEtoys").value = parseInt(_SYNOLO_DIKAIOYMENHS_ASTHENEIAS);
    let tmpProhgAstheneia = 0, tmpMore3 = 0;

    for (let j = 1; j <= parseInt(row) - 1; j++) {
        const tmpSum = parseInt(document.getElementById(`synolo_astheneias_0${j}`).value) || 0;
        const tmpSumMore3 = parseInt(document.getElementById(`days_greater_3_0${j}`).value) || 0;
        if (tmpSum !== 0) tmpProhgAstheneia += tmpSum;
        if (tmpSumMore3 !== 0) tmpMore3 += tmpSumMore3;
    }

    let tmpYpoloipoAdeiasAstheneias = parseInt(_YPOLOIPO_ADEIAS_ASTHENEIAS_TREXONTOS_ETOYS) - tmpProhgAstheneia;
    document.getElementById(`synolo_astheneias_${row}`).value = parseInt(synoloVal <= tmpYpoloipoAdeiasAstheneias ? synoloVal : tmpYpoloipoAdeiasAstheneias);
    document.getElementById(`eidos_astheneias_${row}`).value = "ΑΔΑΣ";

    let counter = 0, daysLess3 = 0, daysMore3 = 0;

    const offDaysSet = new Set([
        ...Object.values(hmeromhniesRepo).filter(Boolean).flat(),
        ...Object.values(hmeromhniesMhErgasimon).filter(Boolean).flat()
    ]);

    // ---- ΥΠΟΧΡΕΩΤΙΚΗ ΕΚΤΕΛΕΣΗ ΤΟΥ ΒΡΟΧΟΥ ----
    for (let current = formatDateToCustom(new Date(fromDatePerRow)); current <= formatDateToCustom(toDatePerRow); current = await addDays(current, 1)) {
        const currentStr = formatDateToCustom(current);

        if (counter < 3) {
            if (_APASXOLHSH_BASEI_SYMBASHS === "5") {
                if (offDaysSet.has(formatDate(currentStr))) continue;
                counter++;
                daysLess3++;
            } else {
                if (offDaysSet.has(formatDate(currentStr))) {
                    counter++;
                } else {
                    counter++;
                    daysLess3++;
                }
            }
        } else {
            if (offDaysSet.has(formatDate(currentStr))) continue;
            counter++;
            daysMore3++;
        }
    }

    // ---- ΕΦΑΡΜΟΓΗ ΤΩΝ ΚΑΝΟΝΩΝ ΜΕΤΑ ΤΟΝ ΒΡΟΧΟ ----
    const synoloAstheneiasRow = parseInt(document.getElementById(`synolo_astheneias_${row}`).value) || 0;

    if (synoloAstheneiasRow <= 3) {
        document.getElementById(`days_less_3_${row}`).value = synoloAstheneiasRow;
        document.getElementById(`days_greater_3_${row}`).value = 0;
    } else if (tmpMore3 === 0) {
        const newDaysLess3 = Math.min(3, synoloAstheneiasRow);
        const newDaysMore3 = synoloAstheneiasRow - newDaysLess3;

        document.getElementById(`days_less_3_${row}`).value = newDaysLess3;
        document.getElementById(`days_greater_3_${row}`).value = newDaysMore3;
    } else {
        document.getElementById(`days_less_3_${row}`).value = 0;
        document.getElementById(`days_greater_3_${row}`).value = synoloAstheneiasRow;
    }
    document.getElementById(`eidos_astheneias_${row}`).value = "ΑΔΑΣ";

    // ---- ΕΝΗΜΕΡΩΣΗ ΥΠΟΛΟΙΠΩΝ ΔΕΔΟΜΕΝΩΝ ----
    lhftheisa_adeia = await calcLhftheisaAdeiaAstheneias();
    lhfteisa_adeia_asteneias_prohgoymenon_mhnon_timh.innerHTML = `<b>${parseInt(lhftheisa_adeia)}</b>`;

    _YPOLOIPO_ADEIAS_ASTHENEIAS_TREXONTOS_ETOYS = parseInt(_SYNOLO_DIKAIOYMENHS_ASTHENEIAS) - parseInt(lhftheisa_adeia);

    ypoloipo_adeias_astheneias_trexontos_etoys.innerHTML = `Υπόλοιπο Άδειας Ασθενείας Τρέχοντος Εργασιακού Έτους: `;
    ypoloipo_adeias_astheneias_trexontos_etoys_timh.innerHTML = 
        _YPOLOIPO_ADEIAS_ASTHENEIAS_TREXONTOS_ETOYS < 0 
        ? `<b>0</b>` 
        : `<b>${parseInt(_YPOLOIPO_ADEIAS_ASTHENEIAS_TREXONTOS_ETOYS)}</b>`;
    document.getElementById("ypoloipoAstheneiasTrexontosEtoys").value = parseInt(_YPOLOIPO_ADEIAS_ASTHENEIAS_TREXONTOS_ETOYS) || 0;

    oldLess3Value = parseInt(document.getElementById(`days_less_3_${row}`).value);
    oldGreater3Value = parseInt(document.getElementById(`days_greater_3_${row}`).value);
    oldSynoloValue = parseInt(document.getElementById(`synolo_astheneias_${row}`).value);
}

async function calcApodoxesAstheneias(row) {
    let apodoxes_less3 = 0, apodoxes_more3 = 0, synolo_apodoxon = 0;
    const pragmatikoHmeromisthioParsed = parseFloat(document.getElementById("pragmatikoHmeromisthioAstheneias").value) || 0;

    apodoxes_less3 = parseFloat(((parseFloat(document.getElementById(`days_less_3_${row}`).value) / 2) * window.sharedParams._PROSAYXHSH_HMERON_5MERHS_ERGASIAS) * pragmatikoHmeromisthioParsed);
    apodoxes_more3 = parseFloat((parseFloat(document.getElementById(`days_greater_3_${row}`).value) * window.sharedParams._PROSAYXHSH_HMERON_5MERHS_ERGASIAS) * pragmatikoHmeromisthioParsed);

    synolo_apodoxon = parseFloat(parseFloat(apodoxes_less3) + parseFloat(apodoxes_more3) - parseFloat(document.getElementById(`epidothsh_efka_${row}`).value)).toFixed(2);
    document.getElementById(`apodoxes_astheneias_${row}`).value = parseFloat(synolo_apodoxon).toFixed(2);
    document.getElementById(`eidos_astheneias_${row}`).value = "ΑΔΑΣ";

    let geniko_synolo_astheneias = 0;
    let geniko_synolo_epidothshs_efka = 0;
    for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[51].timh); i++) {
        geniko_synolo_astheneias += parseFloat(document.getElementById(`apodoxes_astheneias_0${i}`).value);
        geniko_synolo_epidothshs_efka += parseFloat(document.getElementById(`epidothsh_efka_0${i}`).value);
    }

    document.getElementById("geniko_synolo_astheneias").value = parseFloat(geniko_synolo_astheneias).toFixed(2);
    document.getElementById("geniko_synolo_epidothshs_efka").value = parseFloat(geniko_synolo_epidothshs_efka).toFixed(2);
}

async function calcEpidothsEfka(row) {
    // Το 50% του τεκμαρτού ημερομισθίου της ασφαλιστικής κλάσης στην οποία ανήκει ο ασφαλισμένος, βάσει του μέσου όρου αποδοχών των τριάντα (30) τελευταίων ημερών εργασίας του προηγουμένου της αναγγελίας της ανικανότητας προς εργασία ημερολογιακού έτους.

    // Προσαυξάνεται κατά 10% για κάθε  προστατευόμενο μέλος οικογένειας του δικαιούχου και σε καμία περίπτωση δεν μπορεί να είναι ανώτερο του εκάστοτε ισχύοντος τεκμαρτού ημερομισθίου της 8ης ασφαλιστικής κλάσης, ούτε  του 70% του ημερομισθίου της ασφαλιστικής κλάσης βάση της οποίας υπολογίζεται το επίδομα.

    // Κατ` εξαίρεση, για τις πρώτες δεκαπέντε (15) ημέρες αποχής από την εργασία λόγω ασθενείας, το ποσό του επιδόματος με τις προσαυξήσεις λόγω οικογενειακών βαρών, ισούται με το 50% του  καθοριζόμενου ποσού και σε καμία περίπτωση δεν μπορεί να είναι ανώτερο του τεκμαρτού   ημερομισθίου της 3ης ασφαλιστικής  κλάσης, όπως αυτό ισχύει κάθε φορά, ούτε και του 35% του ημερομίσθιου της ασφαλιστικής κλάσης  με  την  οποία υπολογίζεται  το επίδομα.
    
    const pragmatikoHmeromisthioParsed = parseFloat(document.getElementById("pragmatikoHmeromisthioAstheneias").value) || 0;
    let arithmos_teknon = parseInt(window.sharedParams.ergazomenoi.arithmos_teknon);
    let pososto_prosayxhshs = arithmos_teknon !== 0 ? (arithmos_teknon > 7 ? 7 * 10 : arithmos_teknon * 10) : 0;

    const results = await getAsfalistikesKlaseis({
        etos: sharedParams._XRHSH,
        pragmatikoHmeromisthioParsed: pragmatikoHmeromisthioParsed
    });

    const [poso_3_asf_klash, poso_8_asf_klash, poso_trexoysa_asf_klash] = results.map(item => item.poso);

    let max_epidothsh = 0;
    let hmeromisthio_epidothshs_efka = parseFloat(pososto_prosayxhshs) !== 0 
        ? parseFloat((parseFloat(pragmatikoHmeromisthioParsed) + (parseFloat(pragmatikoHmeromisthioParsed) * parseFloat(pososto_prosayxhshs))) * (parseFloat(sharedParams.genikesParametroi[38].timh) / 100))
        : parseFloat(pragmatikoHmeromisthioParsed) * (parseFloat(sharedParams.genikesParametroi[38].timh) / 100);
    
    if (_PRAGMATIKES_HMERES_ASTHENEIAS <= 15) {
        max_epidothsh = Math.min(poso_3_asf_klash, poso_trexoysa_asf_klash * (parseFloat(sharedParams.genikesParametroi[39].timh) / 100));
    } else {
        max_epidothsh = Math.min(poso_8_asf_klash, poso_trexoysa_asf_klash * (parseFloat(sharedParams.genikesParametroi[40].timh) / 100));
    }
    hmeromisthio_epidothshs_efka = Math.min(hmeromisthio_epidothshs_efka, max_epidothsh);

    document.getElementById(`epidothsh_efka_${row}`).value = parseFloat(parseFloat(document.getElementById(`days_greater_3_${row}`).value) * parseFloat(hmeromisthio_epidothshs_efka)).toFixed(2);
}

// async function applyButtonPermissions() {
//     const isAdmin = updateButton?.getAttribute("data-admin") === "true";
//     const canCreate = saveButton?.getAttribute("data-create") === "true";
//     const canUpdate = updateButton?.getAttribute("data-update") === "true";
//     const canUndo = undoButton?.getAttribute("data-undo") === "true";
//     const canDelete = deleteButton?.getAttribute("data-delete") === "true";

//     try {
//         const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
//         let module = isProduction 
//             ? await import('/min.js/kinhseis/buttonPermissions.min.js') 
//             : await import('../ypologismoi/buttonPermissions.js');

//         const { setButtonPermissions } = module;
//         await setButtonPermissions(isAdmin, canCreate, canUpdate, canUndo, canDelete);
//     } catch (error) {
//         console.error("Σφάλμα κατά τη φόρτωση των permissions:", error);
//     }

//     toggleReadonlyFields(true);

//     if (deleteButton) {
//         deleteButton.addEventListener("click", async (event) => {
//             event.preventDefault(); // Αποτρέπει το default action
//             await deleteRecord(result._id);
//         });
//     }
// }
