async function handleTypos001(sharedParams) {
    // Λογική για τον τύπο αποδοχών 001 (Τακτικές Αποδοχές)
    switch(sharedParams.ergazomenoi.xarakthrismos_ergazomenon) {
        case true:    // ΥΠΑΛΛΗΛΟΣ
            switch(sharedParams.ergazomenoi.typos_ergazomenon) {
          
                case "Μ":    // ΜΙΣΘΩΤΟΣ
                    const hmeresErgasias = document.getElementById("hmeresErgasias");
                    const hmeresApoysias = document.getElementById("hmeresApoysias");
                    const oresApoysias = document.getElementById("oresApoysias");
                    const hmeresAsfalishs = document.getElementById("hmeresAsfalishs");
                    const pragmatikoOromisthio = document.getElementById("pragmatikoOromisthio");
                    const hmeresErgasiasMeionApoysies = document.getElementById("hmeresErgasiasMeionApoysies");
                    const oresErgasiasMeionApoysies = document.getElementById("oresErgasiasMeionApoysies");
                    const pragmatikes_ergasimes_mhna = sharedParams._ERGASIMES_HMERES_MHNA;
                    const chk_hmeres = parseFloat(sharedParams._SYNOLO_ERGASIMON_HMERON_MHNA) / 2;
                    const hmeromhniaProslhpshs = sharedParams.ergazomenoi.hmeromhnia_proslhpshs;
                    const hmeromhniaApoxorhshs = sharedParams.ergazomenoi.hmeromhnia_apoxorhshs;
                    const _1h_Eidikh = parseFloat(sharedParams.asfalistikesKlaseis[28].poso);
                    const _1h_Asfalistikh = parseFloat(sharedParams.asfalistikesKlaseis[0].poso);
                    const mhnas = parseInt(document.getElementById("periodos").value);
                    let fromDate = new Date(Date.UTC(parseInt(sharedParams._XRHSH, 10), parseInt(mhnas, 10) - 1, 1)).toISOString();
                    let toDate = new Date(Date.UTC(parseInt(sharedParams._XRHSH, 10), parseInt(mhnas, 10), 0)).toISOString();

                    switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
                        case "0":    // ΠΛΗΡΗΣ
                            hmeresErgasias.value = sharedParams._ERGASIMES_HMERES_MHNA;
                            if (hmeresErgasias.value >= parseFloat(sharedParams.genikesParametroi[5].timh)) {
                                hmeresErgasias.value = parseFloat(sharedParams.genikesParametroi[5].timh);
                            } 

                            if (parseFloat(hmeresErgasias.value) != 0 && !window.isManualEntry) {
                                let result = await adjustEmploymentDates(hmeromhniaApoxorhshs, hmeromhniaProslhpshs, fromDate, toDate, hmeresErgasias, sharedParams, chk_hmeres);

                                fromDate = result.fromDate;
                                toDate = result.toDate;
                            }

                            if (parseFloat(hmeresErgasias.value) != 0 && window.isManualEntry) {
                                let result = await adjustEmploymentDates(hmeromhniaApoxorhshs, hmeromhniaProslhpshs, fromDate, toDate, hmeresErgasias, sharedParams, chk_hmeres);
                                
                                fromDate = result.fromDate;
                                toDate = result.toDate;
                            }

                            let tmpHhmeres_Apoys = 0;    
               
                            // Έχει εφαρμογή μόνο όταν τηρείται το αρχείο απουσιών
                    
                            // let tmpHhmeres_Apoys = parseFloat(oresApoysias.value) === 0 || parseFloat(pragmatikoOromisthio.value) === 0 
                            // ? 0 
                            // : (parseFloat(_1h_Asfalistikh.value) / parseFloat(pragmatikoOromisthio.value)) > parseFloat(oresErgasiasMeionApoysies.value) 
                            //   ? 1 
                            //   : 0;

                            hmeresAsfalishs.value = parseInt(parseFloat(hmeresErgasias.value) - parseInt(hmeresApoysias.value) - tmpHhmeres_Apoys);
                            
                            let apoDate = new Date(fromDate);
                            let eosDate = new Date(toDate);
                            const diffTime = eosDate - apoDate;

                            // Μετατροπή σε ημέρες (1 ημέρα = 1000ms * 60s * 60m * 24h)
                            const diffDays = diffTime / (1000 * 60 * 60 * 24);

                            if (diffDays < 6) {
                                hmeresAsfalishs.value = pragmatikes_ergasimes_mhna;
                                _CHECK_HMERES_ASFALISHS = true;
                            } else {
                                _CHECK_HMERES_ASFALISHS = false;
                            }
                            break;
                        case "1":    // ΜΕΡΙΚΗ
                            break;
                        case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
                            break;
                    }
                    break;
                case "Η":    // ΗΜΕΡΟΜΙΣΘΙΟΣ
                    switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
                        case "0":    // ΠΛΗΡΗΣ
                            break;
                        case "1":    // ΜΕΡΙΚΗ
                            break;
                        case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
                            break;
                    }
                    break;
                case "Ω":    // ΩΜΕΡΟΜΙΣΘΙΟΣ
                    switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
                        case "0":    // ΠΛΗΡΗΣ
                            break;
                        case "1":    // ΜΕΡΙΚΗ
                            break;
                        case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
                            break;
                    }
                    break;
            }
            break;

        case false:   // ΕΡΓΑΤΗΣ
            switch(sharedParams.ergazomenoi.typos_ergazomenon) {
                case "Μ":    // ΜΙΣΘΩΤΟΣ
                    switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
                        case "0":    // ΠΛΗΡΗΣ
                            break;
                        case "1":    // ΜΕΡΙΚΗ
                            break;
                        case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
                            break;
                    }
                    break;
                case "Η":    // ΗΜΕΡΟΜΙΣΘΙΟΣ
                    switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
                        case "0":    // ΠΛΗΡΗΣ
                            break;
                        case "1":    // ΜΕΡΙΚΗ
                            break;
                        case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
                            break;
                    }
                    break;
                case "Ω":    // ΩΜΕΡΟΜΙΣΘΙΟΣ
                    switch(sharedParams.ergazomenoi.kathestos_apasxolhshs) {
                        case "0":    // ΠΛΗΡΗΣ
                            break;
                        case "1":    // ΜΕΡΙΚΗ
                            break;
                        case "2":    // ΕΚ ΠΕΡΙΤΡΟΠΗΣ
                            break;
                    }
                    break;
            }
            break;
    }

    async function adjustEmploymentDates(hmeromhniaApoxorhshs, hmeromhniaProslhpshs, fromDate, toDate, hmeresErgasias, sharedParams, chk_hmeres) {
        const param9 = parseFloat(sharedParams.genikesParametroi[9].timh);
        const param4 = parseFloat(sharedParams.genikesParametroi[4].timh);
        const param5 = parseFloat(sharedParams.genikesParametroi[5].timh);
    
        const calculateHmeresErgasias = (currentValue) => {
            let tmp_hmeres = sharedParams.ergazomenoi.apasxolhsh_basei_symbashs === "5" ? parseFloat(currentValue) * (param9 / param4) : parseFloat(currentValue);
            return Math.min(tmp_hmeres, param5).toFixed(2);
        };
    
        let fromDateStr = new Date(fromDate).toISOString();
        let toDateStr = new Date(toDate).toISOString();
    
        const apoxorhshDateStr = hmeromhniaApoxorhshs ? new Date(hmeromhniaApoxorhshs).toISOString() : null;
        const proslhpshDateStr = hmeromhniaProslhpshs ? new Date(hmeromhniaProslhpshs).toISOString() : null;
    
        if (apoxorhshDateStr && proslhpshDateStr && apoxorhshDateStr.slice(0, 7) === proslhpshDateStr.slice(0, 7)) {
            fromDateStr = proslhpshDateStr;
            toDateStr = apoxorhshDateStr;
            hmeresErgasias.value = calculateHmeresErgasias(hmeresErgasias.value);
        } 
        else if (apoxorhshDateStr && apoxorhshDateStr >= fromDateStr && apoxorhshDateStr <= toDateStr) {
            toDateStr = apoxorhshDateStr;
            hmeresErgasias.value = calculateHmeresErgasias(hmeresErgasias.value);
        } 
        else if (proslhpshDateStr && proslhpshDateStr >= fromDateStr && apoxorhshDateStr && apoxorhshDateStr <= toDateStr) {
            fromDateStr = proslhpshDateStr;
            hmeresErgasias.value = calculateHmeresErgasias(hmeresErgasias.value);
        } 
        else {
            let tmp_hmeres = hmeresErgasias.value >= chk_hmeres ? calculateHmeresErgasias(hmeresErgasias.value) : hmeresErgasias.value;
            hmeresErgasias.value = Math.min(parseFloat(tmp_hmeres), param5).toFixed(2);
        }
    
        // Επιστρέφουμε τα νέα fromDate και toDate!
        return { fromDate: fromDateStr, toDate: toDateStr };
    }
                        
}

// === ΚΑΝΕΙ ΤΗ ΣΥΝΑΡΤΗΣΗ ΔΙΑΘΕΣΙΜΗ ΣΤΟΝ BROWSER ===
if (typeof window !== "undefined") {
  window.handleTypos001 = handleTypos001;
}

// === ΚΑΝΕΙ EXPORT ΓΙΑ COMMONJS (π.χ. Node.js scripts) ===
if (typeof module !== "undefined" && module.exports) {
  module.exports = { handleTypos001 };
}
