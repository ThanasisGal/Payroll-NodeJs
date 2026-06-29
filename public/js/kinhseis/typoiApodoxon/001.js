async function handleTypos001(sharedParams) {
    function getOperationalPayrollPhaseCode(sharedParams) {
        const sharedCode =
            sharedParams?.operationalPayrollPhaseContext?.operationalPhaseCode;
        if (sharedCode !== undefined && sharedCode !== null) {
            return String(sharedCode).trim();
        }

        if (typeof window !== "undefined") {
            const windowCode =
                window.apasxolhseisOperationalPayrollPhaseContext?.operationalPhaseCode;
            if (windowCode !== undefined && windowCode !== null) {
                return String(windowCode).trim();
            }
        }

        return "";
    }

    const operationalPayrollPhaseCode = getOperationalPayrollPhaseCode(sharedParams);
    const usesOperationalHours =
        operationalPayrollPhaseCode === "1" || operationalPayrollPhaseCode === "2";

    function toNumber(value, defaultValue = 0) {
        const parsed = parseFloat(String(value ?? "").replace(",", "."));
        return Number.isFinite(parsed) ? parsed : defaultValue;
    }

    function getSingleFullOperationalPhase(sharedParams) {
        const context =
            sharedParams?.operationalPayrollPhaseContext ||
            (typeof window !== "undefined"
                ? window.apasxolhseisOperationalPayrollPhaseContext
                : null);

        if (!context || context.hasUsableSingleOperationalPhase !== true) return null;
        if (context.hasOperationalSplit === true || context.operationalPhasesCount !== 1) {
            return null;
        }

        const phase = context.operationalPhase || null;
        const phaseCode = String(
            context.operationalPhaseCode || phase?.detectedKathestosCode || ""
        ).trim();

        return phaseCode === "0" ? phase : null;
    }

    function getOperationalPhases(sharedParams) {
        const context =
            sharedParams?.operationalPayrollPhaseContext ||
            (typeof window !== "undefined"
                ? window.apasxolhseisOperationalPayrollPhaseContext
                : null);
        return Array.isArray(context?.operationalPhases) ? context.operationalPhases : [];
    }

    function isPureFullSalariedEmployee(sharedParams) {
        return (
            sharedParams?.ergazomenoi?.xarakthrismos_ergazomenon === true &&
            sharedParams?.ergazomenoi?.typos_ergazomenon === "Μ" &&
            sharedParams?.ergazomenoi?.kathestos_apasxolhshs === "0" &&
            getSingleFullOperationalPhase(sharedParams) !== null
        );
    }

    function getFullTimePayrollDaysFromActualWorkDays(sharedParams) {
        const phase = getSingleFullOperationalPhase(sharedParams);
        const actualWorkDays = toNumber(phase?.workedDays, NaN);
        if (!Number.isFinite(actualWorkDays)) return null;

        const maxDays = toNumber(sharedParams?.genikesParametroi?.[5]?.timh, 25);
        const fullPhaseMultiplier = 1.2;
        const hmeresErgasias = Math.min(actualWorkDays * fullPhaseMultiplier, maxDays);

        return {
            actualWorkDays,
            hmeresErgasias,
            hmeresAsfalishs: Math.min(Math.round(actualWorkDays * fullPhaseMultiplier), maxDays)
        };
    }

    function isMixedFullRotationalSalariedEmployee(sharedParams) {
        const context =
            sharedParams?.operationalPayrollPhaseContext ||
            (typeof window !== "undefined"
                ? window.apasxolhseisOperationalPayrollPhaseContext
                : null);
        const phases = getOperationalPhases(sharedParams);
        const phaseCodes = phases.map((phase) =>
            String(phase?.detectedKathestosCode || "").trim()
        );

        return (
            sharedParams?.ergazomenoi?.xarakthrismos_ergazomenon === true &&
            sharedParams?.ergazomenoi?.typos_ergazomenon === "Μ" &&
            sharedParams?.ergazomenoi?.kathestos_apasxolhshs === "0" &&
            context?.hasOperationalSplit === true &&
            phases.length > 1 &&
            phaseCodes.includes("0") &&
            phaseCodes.some((code) => code === "1" || code === "2") &&
            phaseCodes.every((code) => code === "0" || code === "1" || code === "2")
        );
    }

    function getMixedFullRotationalPayrollDays(sharedParams) {
        const phases = getOperationalPhases(sharedParams);
        if (!phases.length) return null;

        const maxDays = toNumber(sharedParams?.genikesParametroi?.[5]?.timh, 25);
        const fullPhaseMultiplier = 1.2;
        const absencesAffectInsuranceDays =
            sharedParams?.etaireia?.apousies_epireazoun_asfalistikes_hmeres === true;
        let fullPayrollDays = 0;
        let nonFullHours = 0;
        let nonFullAbsenceHours = 0;

        phases.forEach((phase) => {
            const phaseCode = String(phase?.detectedKathestosCode || "").trim();

            if (phaseCode === "0") {
                const actualFullWorkDays = toNumber(phase?.workedDays, 0);
                const phasePayrollDays = actualFullWorkDays * fullPhaseMultiplier;
                fullPayrollDays += phasePayrollDays;
            } else if (phaseCode === "1" || phaseCode === "2") {
                nonFullHours += toNumber(phase?.totalHours, 0);
                nonFullAbsenceHours += toNumber(phase?.absenceHours, 0);
            }
        });

        const effectiveNonFullInsuranceHours = absencesAffectInsuranceDays
            ? Math.max(0, nonFullHours - nonFullAbsenceHours)
            : nonFullHours;

        return {
            hmeresErgasias: Math.min(fullPayrollDays, maxDays),
            hmeresAsfalishs: fullPayrollDays + effectiveNonFullInsuranceHours / 8
        };
    }

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
	                            if (usesOperationalHours) {
	                                break;
	                            }

	                            if (isMixedFullRotationalSalariedEmployee(sharedParams)) {
	                                const payrollDays =
	                                    getMixedFullRotationalPayrollDays(sharedParams);
	                                if (payrollDays) {
	                                    hmeresErgasias.value = payrollDays.hmeresErgasias.toFixed(2);
	                                    hmeresAsfalishs.value = Math.max(
	                                        0,
	                                        Math.round(payrollDays.hmeresAsfalishs)
	                                    );
	                                    _CHECK_HMERES_ASFALISHS = true;
	                                    break;
	                                }
	                            }

	                            if (isPureFullSalariedEmployee(sharedParams)) {
	                                const payrollDays =
	                                    getFullTimePayrollDaysFromActualWorkDays(sharedParams);
	                                if (payrollDays) {
	                                    const hmeresApoysiasValue = toNumber(hmeresApoysias.value, 0);
	                                    hmeresErgasias.value = payrollDays.hmeresErgasias.toFixed(2);
	                                    hmeresAsfalishs.value = Math.max(
	                                        0,
	                                        payrollDays.hmeresAsfalishs - hmeresApoysiasValue
	                                    );
	                                    _CHECK_HMERES_ASFALISHS = true;
	                                    break;
	                                }
	                            }

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
            let tmp_hmeres = parseFloat(currentValue) * 1.2;
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
