let _EISFORA_ALLHLEGYHS, 
    _MHNES_YPOLOGISMOY_FOROY,
    _POSO_ENARJHS_MEIOSHS_THS_EKPTOSHS_FOROY,
    _SYNTELESTHS_MEIOSHS_THS_EKPTOSHS_FOROY,
    _SYNTELESTHS_MEIOSHS_TOY_FOROY_LOGO_PARAKRATHSHS,
    _SYNTELESTHS_PARAKRATHSHS_FOROY_EKTAKTON_AMOIBON,
    _NEO_PLHROTEO = 0,
    _SYNOLO_POSOY_EISFORON_PLASMATIKHS_AXIAS = 0,
    _POSO_MH_YPOLOGIZOMENO_STIS_ASFALISTIKES_APODOXES = 0,
    _SYNOLO_POSOSTON_ERGAZOMENOY_MH_YPOKEIMENA_STO_FORΟ = 0,
    _SYNOLO_POSON_ERGAZOMENOY_MH_YPOKEIMENO_STO_FORΟ = 0,
    _SYNOLO_POSOSTON_ERGAZOMENOY = 0,
    _SYNOLO_POSON_ERGAZOMENOY = 0,
    _MHNIAIES_MIKTES_APODOXES = 0,
    _MHNIAIES_MIKTES_APODOXES_FOROLOGHTEES = 0,
    _SYNOLO_MIKTON_MHNIAION_APODOXON = 0,
    _YPOLOGIZEI_FORO
;

document.addEventListener("DOMContentLoaded", async function () {
    document.addEventListener('sharedParamsReady', async function () {
        const sharedParams = window.sharedParams;
    });

});

const ethsio_forologhteo_poso_taktikon_apodoxon = document.getElementById("ethsio_forologhteo_poso_taktikon_apodoxon");
const ekptosh_logo_oikogeneiakhs_katastashs = document.getElementById("ekptosh_logo_oikogeneiakhs_katastashs");
const analogoyn_foros_pro_ekptoshs = document.getElementById("analogoyn_foros_pro_ekptoshs");
const mhniaios_analogoyn_foros_pro_ekptoshs = document.getElementById("mhniaios_analogoyn_foros_pro_ekptoshs");
const eisfora_allhleggyhs = document.getElementById("eisfora_allhleggyhs");
const mhniaia_ekptosh_logo_oikogeneiakhs_katastashs = document.getElementById("mhniaia_ekptosh_logo_oikogeneiakhs_katastashs");
const analogoyn_foros_meta_thn_ekptosh = document.getElementById("analogoyn_foros_meta_thn_ekptosh");
const synolo_ektakton_amoibon = document.getElementById("synolo_ektakton_amoibon");
const analogoyn_foros_ektakton_amoibon = document.getElementById("analogoyn_foros_ektakton_amoibon");
const analogoyn_foros_epoxikon_row = document.getElementById("analogoyn_foros_epoxikon_row");
const foroiCard = analogoyn_foros_epoxikon_row ? analogoyn_foros_epoxikon_row.closest(".card") : null;
const analogoyn_foros_epoxikon = document.getElementById("analogoyn_foros_epoxikon");
const synolo_foroy = document.getElementById("synolo_foroy");
// const synoloForoy = document.getElementById("synolo_foroy");
let allaghPlhroteoy = document.getElementById("allaghPlhroteoy_Hidden");

function parseDateOnlyUtc(value) {
    if (!value) {
        return null;
    }

    const rawValue = value instanceof Date ? value.toISOString() : String(value);
    const match = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
        return null;
    }

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }

    return date;
}

function getInclusiveDays(startValue, endValue) {
    const startDate = parseDateOnlyUtc(startValue);
    const endDate = parseDateOnlyUtc(endValue);

    if (!startDate || !endDate || endDate < startDate) {
        return 0;
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((endDate - startDate) / millisecondsPerDay) + 1;
}

async function calcForos() {
    const _AA_FOROLOGIKHS_KLIMAKAS = window._AA_FOROLOGIKHS_KLIMAKAS;
    const _KLIMAKA_FOROY = window._KLIMAKA_FOROY;
    const _EKPTOSH_FOROY = window._EKPTOSH_FOROY;

    _MHNES_YPOLOGISMOY_FOROY = parseInt(sharedParams.genikesParametroi[29].timh);
    _SYNTELESTHS_PARAKRATHSHS_FOROY_EKTAKTON_AMOIBON = parseFloat(sharedParams.genikesParametroi[28].timh).toFixed(2);
    _EISFORA_ALLHLEGYHS = sharedParams.genikesParametroi[30].timh
    _POSO_ENARJHS_MEIOSHS_THS_EKPTOSHS_FOROY = parseFloat(sharedParams.genikesParametroi[31].timh).toFixed(2);
    _SYNTELESTHS_MEIOSHS_THS_EKPTOSHS_FOROY = parseFloat(sharedParams.genikesParametroi[32].timh).toFixed(2);
    _SYNTELESTHS_MEIOSHS_TOY_FOROY_LOGO_PARAKRATHSHS = parseFloat(sharedParams.genikesParametroi[33].timh).toFixed(2);
    _YPOLOGIZEI_FORO = sharedParams.ergazomenoi.ypologismos_foroy;

    let ypoloipo_klimakas_foroy = 0, poso_klimakas_foroy = 0, forologhteo_poso = 0;
    let analogoynta_klimakia_apo_poso = new Array();
    let analogoynta_klimakia_eos_poso = new Array();
    let analogoyn_syntelesths = new Array();
    let analogoyn_syntelesths_eisforas_allhleggyhs = new Array();
    let analogoyn_eisodhma_eos_poso = new Array();

    for (let i = 0; i < parseInt(_AA_FOROLOGIKHS_KLIMAKAS); i++) {
        analogoynta_klimakia_apo_poso.push(parseFloat(_KLIMAKA_FOROY[i][1]));
        analogoynta_klimakia_eos_poso.push(parseFloat(_KLIMAKA_FOROY[i][2]));
        analogoyn_syntelesths.push(parseFloat(_KLIMAKA_FOROY[i][3]));
        analogoyn_syntelesths_eisforas_allhleggyhs.push(parseFloat(_KLIMAKA_FOROY[i][5]));
    }
    forologhteo_poso = parseFloat(ethsio_forologhteo_poso_taktikon_apodoxon.value || 0);
    
    for (let i = 0; i < parseInt(_AA_FOROLOGIKHS_KLIMAKAS); i++) {
        if (i == 0) {
            poso_klimakas_foroy = parseFloat(analogoynta_klimakia_eos_poso[i]) - parseFloat(analogoynta_klimakia_apo_poso[i]);
        } else {
            poso_klimakas_foroy = parseFloat(analogoynta_klimakia_eos_poso[i]) - parseFloat(analogoynta_klimakia_eos_poso[i - 1]);
        }

        if (forologhteo_poso > poso_klimakas_foroy) {
            analogoyn_eisodhma_eos_poso.push(parseFloat(analogoynta_klimakia_eos_poso[i]).toFixed(4));
            ypoloipo_klimakas_foroy = forologhteo_poso - poso_klimakas_foroy;
            forologhteo_poso = ypoloipo_klimakas_foroy;
        } else {
            analogoyn_eisodhma_eos_poso.push(parseFloat(forologhteo_poso).toFixed(4));
            break;
        }
    }
    
    let analForos = 0;
    let analogoysa_eisfora_allhleggyhs = 0;
    let foros_meta_thn_ekptosh = 0, parakratheis_foros = 0, foros_ektakton_amoibon = 0; 

    for (let i = 0; i < analogoyn_eisodhma_eos_poso.length; i++) {
        if (i == 0 || (i + 1) == analogoyn_eisodhma_eos_poso.length) {
            analForos += parseFloat(parseFloat(analogoyn_eisodhma_eos_poso[i]) * (parseFloat(analogoyn_syntelesths[i]) / 100));
            if (_EISFORA_ALLHLEGYHS == 'ΝΑΙ') {
                analogoysa_eisfora_allhleggyhs += parseFloat(parseFloat(analogoyn_eisodhma_eos_poso[i]) * (parseFloat(analogoyn_syntelesths_eisforas_allhleggyhs[i]) / 100));
            } else {
                analogoysa_eisfora_allhleggyhs = 0;
            }
        } else {
            analForos += parseFloat((parseFloat(analogoyn_eisodhma_eos_poso[i]) - parseFloat(analogoyn_eisodhma_eos_poso[i - 1])) * (parseFloat(analogoyn_syntelesths[i]) / 100));
            if (_EISFORA_ALLHLEGYHS == 'ΝΑΙ') {
                analogoysa_eisfora_allhleggyhs += parseFloat((parseFloat(analogoyn_eisodhma_eos_poso[i]) - parseFloat(analogoyn_eisodhma_eos_poso[i - 1])) * (parseFloat(analogoyn_syntelesths_eisforas_allhleggyhs[i]) / 100));
            } else {
                analogoysa_eisfora_allhleggyhs = 0;
            }
        }
    }
    analogoyn_foros_pro_ekptoshs.value = _YPOLOGIZEI_FORO ? parseFloat(analForos).toFixed(2) : 0;
    mhniaios_analogoyn_foros_pro_ekptoshs.value = _YPOLOGIZEI_FORO ? (parseFloat(analForos) / parseFloat(_MHNES_YPOLOGISMOY_FOROY)).toFixed(2) : 0;
    eisfora_allhleggyhs.value = (parseFloat(analogoysa_eisfora_allhleggyhs) / parseFloat(_MHNES_YPOLOGISMOY_FOROY)).toFixed(2);

    let meiosh_ekptoshs_foroy = parseFloat(_EKPTOSH_FOROY[parseInt(sharedParams.ergazomenoi.arithmos_teknon)] || 0);
    ekptosh_logo_oikogeneiakhs_katastashs.value = parseFloat(meiosh_ekptoshs_foroy).toFixed(2);
    // if (parseInt(sharedParams.ergazomenoi.arithmos_teknon) > 4) {
    //     meiosh_ekptoshs_foroy = ekptosh_logo_oikogeneiakhs_katastashs.value;
    // } else {
        if (parseFloat(ethsio_forologhteo_poso_taktikon_apodoxon.value) > parseFloat(_POSO_ENARJHS_MEIOSHS_THS_EKPTOSHS_FOROY)) {
        //     meiosh_ekptoshs_foroy = ekptosh_logo_oikogeneiakhs_katastashs.value;
        // } else {
            meiosh_ekptoshs_foroy = (parseFloat(ekptosh_logo_oikogeneiakhs_katastashs.value) - ((parseFloat(ethsio_forologhteo_poso_taktikon_apodoxon.value) - parseFloat(_POSO_ENARJHS_MEIOSHS_THS_EKPTOSHS_FOROY)) * (_SYNTELESTHS_MEIOSHS_THS_EKPTOSHS_FOROY / 100))).toFixed(2);
        }
        if (parseFloat(meiosh_ekptoshs_foroy) > parseFloat(ekptosh_logo_oikogeneiakhs_katastashs.value) || parseFloat(meiosh_ekptoshs_foroy) < 0) {
            meiosh_ekptoshs_foroy = 0
        }
    // }
    ekptosh_logo_oikogeneiakhs_katastashs.value = parseFloat(meiosh_ekptoshs_foroy).toFixed(2);
    mhniaia_ekptosh_logo_oikogeneiakhs_katastashs.value = (parseFloat(meiosh_ekptoshs_foroy) / parseFloat(_MHNES_YPOLOGISMOY_FOROY)).toFixed(2);

    if (parseFloat(mhniaios_analogoyn_foros_pro_ekptoshs.value) < parseFloat(mhniaia_ekptosh_logo_oikogeneiakhs_katastashs.value) || 0) {
        foros_meta_thn_ekptosh = parseFloat('0').toFixed(2);
    } else {
        foros_meta_thn_ekptosh = (parseFloat(mhniaios_analogoyn_foros_pro_ekptoshs.value) - parseFloat(mhniaia_ekptosh_logo_oikogeneiakhs_katastashs.value) || 0).toFixed(2);
    }
    parakratheis_foros = (parseFloat(foros_meta_thn_ekptosh) * (parseFloat(_SYNTELESTHS_MEIOSHS_TOY_FOROY_LOGO_PARAKRATHSHS) / 100) || 0).toFixed(2);

    analogoyn_foros_meta_thn_ekptosh.value = (parseFloat(foros_meta_thn_ekptosh) - parseFloat(parakratheis_foros) || 0).toFixed(2);

    if (parseFloat(synolo_ektakton_amoibon.value) !== 0) {
        foros_ektakton_amoibon = (parseFloat(synolo_ektakton_amoibon.value) * (parseFloat(_SYNTELESTHS_PARAKRATHSHS_FOROY_EKTAKTON_AMOIBON / 100)) || 0).toFixed(2);
    }
    analogoyn_foros_ektakton_amoibon.value = parseFloat(foros_ektakton_amoibon).toFixed(2);

    const analogoynForosMetaThnEkptosh = parseFloat(analogoyn_foros_meta_thn_ekptosh.value) || 0;
    const analogoynForosEktaktonAmoibon = parseFloat(analogoyn_foros_ektakton_amoibon.value) || 0;
    const ergazomenos = sharedParams.ergazomenoi || {};
    const einaiEpoxikos = ergazomenos.epoxikos === true;

    if (einaiEpoxikos) {
        if (foroiCard) {
            foroiCard.classList.add("foroi-card-epoxikos");
        }
        if (analogoyn_foros_epoxikon_row) {
            analogoyn_foros_epoxikon_row.hidden = false;
            analogoyn_foros_epoxikon_row.classList.remove("d-none");
        }

        const hmeresEpoxikoy = getInclusiveDays(
            ergazomenos.hmeromhnia_proslhpshs,
            ergazomenos.hmeromhnia_lhxhs_symbashs
        );
        const forosEpoxikoy = hmeresEpoxikoy > 0 ? (analogoynForosMetaThnEkptosh / 365) * hmeresEpoxikoy : 0;

        if (analogoyn_foros_epoxikon) {
            analogoyn_foros_epoxikon.value = parseFloat(forosEpoxikoy).toFixed(2);
        }
        synolo_foroy.value = (forosEpoxikoy + analogoynForosEktaktonAmoibon).toFixed(2);
    } else {
        if (foroiCard) {
            foroiCard.classList.remove("foroi-card-epoxikos");
        }
        if (analogoyn_foros_epoxikon_row) {
            analogoyn_foros_epoxikon_row.hidden = true;
            analogoyn_foros_epoxikon_row.classList.add("d-none");
        }
        if (analogoyn_foros_epoxikon) {
            analogoyn_foros_epoxikon.value = parseFloat(0).toFixed(2);
        }
        synolo_foroy.value = (analogoynForosMetaThnEkptosh + analogoynForosEktaktonAmoibon).toFixed(2);
    }
    
    if (hasRecord) {
        if (metrhths > 5 && metrhths < 7) {
            setTimeout(() => {
                document.querySelector(".menu_Links .foroi").click();
            }, 50); // Περιμένουμε λίγο για να σιγουρευτούμε ότι όλα τα δεδομένα είναι σταθερά
            metrhths++
        } else {
            metrhths++
        }
        if (metrhths >= 7) {
            setTimeout(() => {
                document.querySelector(".menu_Links .apodoxes").click();
                hasRecord = false;
            }, 100);
        }
    }
}

async function calcMiktesApodoxesApoPlhroteo() {
    // const klimakia = window.KlimakiaForoyModule; // Βεβαιώσου ότι έχει φορτωθεί από <script>

    const _APODOXES_PRO_EKPTOSHS_FOROY = window._APODOXES_PRO_EKPTOSHS_FOROY;
    const _KLIMAKA_FOROY = window._KLIMAKA_FOROY;
    const _EKPTOSH_FOROY = window._EKPTOSH_FOROY;

    _MHNES_YPOLOGISMOY_FOROY = parseInt(sharedParams.genikesParametroi[29].timh);
    _SYNTELESTHS_PARAKRATHSHS_FOROY_EKTAKTON_AMOIBON = parseFloat(sharedParams.genikesParametroi[28].timh).toFixed(2);
    _EISFORA_ALLHLEGYHS = sharedParams.genikesParametroi[30].timh
    _POSO_ENARJHS_MEIOSHS_THS_EKPTOSHS_FOROY = parseFloat(sharedParams.genikesParametroi[31].timh).toFixed(2);
    _SYNTELESTHS_MEIOSHS_THS_EKPTOSHS_FOROY = parseFloat(sharedParams.genikesParametroi[32].timh).toFixed(2);
    _SYNTELESTHS_MEIOSHS_TOY_FOROY_LOGO_PARAKRATHSHS = parseFloat(sharedParams.genikesParametroi[33].timh).toFixed(2);
    _YPOLOGIZEI_FORO = sharedParams.ergazomenoi.ypologismos_foroy;

    _NEO_PLHROTEO = parseFloat(document.getElementById("plhroteo").value);
    allaghPlhroteoy.value = _NEO_PLHROTEO;
    _SYNOLO_POSOY_EISFORON_PLASMATIKHS_AXIAS = 0;
    _SYNOLO_POSOSTON_ERGAZOMENOY = 0;
    _SYNOLO_POSON_ERGAZOMENOY = 0;
    _SYNOLO_POSOSTON_ERGAZOMENOY_MH_YPOKEIMENA_STO_FORΟ = 0;
    _SYNOLO_POSON_ERGAZOMENOY_MH_YPOKEIMENO_STO_FORΟ = 0;
    _POSO_MH_YPOLOGIZOMENO_STIS_ASFALISTIKES_APODOXES = 0;
    _SYNOLO_MIKTON_MHNIAION_APODOXON = 0;

    let mikApod = 0, mikApod1 = 0, mikApod2 = 0, posostoForoy = 0, poso_prohgoymenoy_Klimakioy = 0;
    let eisfora_allhleggyhs = _EISFORA_ALLHLEGYHS === 'ΟΧΙ' ? 0 : 1;
    let aa_klimakioy = 0, klimakio_syntelesth_foroy = 0, eisodhma_prohgoymenoy_klimakioy = 0;

    const arithmos_teknon = parseInt(sharedParams.ergazomenoi.arithmos_teknon);
    const ethsio_Plhroteo = parseFloat(_NEO_PLHROTEO) * parseFloat(_MHNES_YPOLOGISMOY_FOROY);
    const apodoxesProForoy = _APODOXES_PRO_EKPTOSHS_FOROY[parseInt(eisfora_allhleggyhs)][parseInt(arithmos_teknon)];
    const ethsio_forologhteo_poso = document.getElementById("ethsio_forologhteo_poso_taktikon_apodoxon");
    const mhniaio_forologhteo_poso = document.getElementById("forologhteo_poso_taktikon_apodoxon");
    const synolo_mikton_apodoxon = document.getElementById("synoloMiktonApodoxon");
    const asfalistikes_apodoxes = document.getElementById("asfalistikes_apodoxes");

    const diafora_apodoxon = document.getElementById("sympsifisteesApodoxes");
    
    if (ethsio_Plhroteo <= parseFloat(apodoxesProForoy["poso00"])) {
        aa_klimakioy = 0;
    } else if (ethsio_Plhroteo > parseFloat(apodoxesProForoy["poso00"]) && ethsio_Plhroteo <= parseFloat(apodoxesProForoy["poso01"])) {
        aa_klimakioy = 0, klimakio_syntelesth_foroy = 0;
        posostoForoy = parseFloat(_KLIMAKA_FOROY[klimakio_syntelesth_foroy][3]) // + parseFloat(_KLIMAKA_FOROY[klimakio_syntelesth_foroy][4]) + _KLIMAKA_FOROY[klimakio_syntelesth_foroy][5];
        poso_prohgoymenoy_Klimakioy = parseFloat(apodoxesProForoy["poso0" + aa_klimakioy]);
    } else {
        for (let i = 1; i <= 7; i++) {
            let j = i + 1;
            if (ethsio_Plhroteo > parseFloat(apodoxesProForoy["poso0" + i]) && ethsio_Plhroteo <= parseFloat(apodoxesProForoy["poso0" + j])) {
                aa_klimakioy = i, klimakio_syntelesth_foroy = i, eisodhma_prohgoymenoy_klimakioy = i - 1;
                posostoForoy = parseFloat(_KLIMAKA_FOROY[klimakio_syntelesth_foroy][3]) + parseFloat(_KLIMAKA_FOROY[klimakio_syntelesth_foroy][4]) + _KLIMAKA_FOROY[klimakio_syntelesth_foroy][5];
                poso_prohgoymenoy_Klimakioy = parseFloat(_KLIMAKA_FOROY[eisodhma_prohgoymenoy_klimakioy][2]);
                break;
            }
        }
    }
    if (ethsio_Plhroteo > parseFloat(apodoxesProForoy["poso0" + 8])) {
        aa_klimakioy = 8, klimakio_syntelesth_foroy = 8, eisodhma_prohgoymenoy_klimakioy = 7;
        posostoForoy = parseFloat(_KLIMAKA_FOROY[klimakio_syntelesth_foroy][3]) + parseFloat(_KLIMAKA_FOROY[klimakio_syntelesth_foroy][4]) + _KLIMAKA_FOROY[klimakio_syntelesth_foroy][5];
        poso_prohgoymenoy_Klimakioy = parseFloat(_KLIMAKA_FOROY[eisodhma_prohgoymenoy_klimakioy][1]);
    }

    const klimakioyKey = "poso0" + aa_klimakioy;
    if (apodoxesProForoy.hasOwnProperty(klimakioyKey)) {
    mikApod1 = ethsio_Plhroteo - apodoxesProForoy[klimakioyKey];

        mikApod = ethsio_Plhroteo <= parseFloat(apodoxesProForoy[klimakioyKey]) 
            ? parseFloat(ethsio_Plhroteo).toFixed(2) 
            : (() => {
                mikApod1 = ethsio_Plhroteo - apodoxesProForoy[klimakioyKey];
                mikApod2 = mikApod1 / (1 - (posostoForoy / 100));
                return mikApod2 + poso_prohgoymenoy_Klimakioy;
            })();
    }
    if (_YPOLOGIZEI_FORO) {
        mhniaio_forologhteo_poso.value = (parseFloat(mikApod) / parseFloat(_MHNES_YPOLOGISMOY_FOROY)).toFixed(2);
        ethsio_forologhteo_poso.value = parseFloat(mikApod).toFixed(2);
    } else {
        mhniaio_forologhteo_poso.value = parseFloat(_NEO_PLHROTEO).toFixed(2);
        ethsio_forologhteo_poso.value = (parseFloat(_NEO_PLHROTEO) * _MHNES_YPOLOGISMOY_FOROY).toFixed(2);
    }
    
    for (let j = 0; j < 7; j++) {
        const q1 = `${j + 1}`.padStart(2, '0');
        const kodikos_krathshs = document.getElementById(`kodikos_${q1}`).value;
        if (kodikos_krathshs === "") {
            continue;
        }
        const plasmatikh_axia = document.getElementById(`plasmatikh_axia_${q1}`).value;
        const floatValue_PlasmatikhAxia = parseFloat(plasmatikh_axia.replace(',', '.'));
        const pososto_krathshs_ergazomenoy = document.getElementById(`pososto_krathshs_ergazomenoy_${q1}`).value;
        const floatValue_PosostoKrathshsErgazomenoy = parseFloat(pososto_krathshs_ergazomenoy.replace(',', '.'));
        const poso_krathshs_ergazomenoy = document.getElementById(`poso_krathshs_ergazomenoy_${q1}`).value;
        const floatValue_PosoKrathshsErgazomenoy = parseFloat(poso_krathshs_ergazomenoy.replace(',', '.'));
        const ypologizetai_sto_foro = document.getElementById(`ypologizomenoStoForo_${q1}`);
        const enhmeronei_apodoxes_asfalishs = document.getElementById(`apaiteitai_apodoxes_asfalishs_${q1}`);
        
        if (parseFloat(floatValue_PlasmatikhAxia) !== 0) {
            _SYNOLO_POSOY_EISFORON_PLASMATIKHS_AXIAS += parseFloat(floatValue_PlasmatikhAxia * (floatValue_PosostoKrathshsErgazomenoy / 100));
        } else if (ypologizetai_sto_foro.value === 'false') {
            _SYNOLO_POSOSTON_ERGAZOMENOY_MH_YPOKEIMENA_STO_FORΟ += floatValue_PosostoKrathshsErgazomenoy;
            _SYNOLO_POSON_ERGAZOMENOY_MH_YPOKEIMENO_STO_FORΟ += floatValue_PosoKrathshsErgazomenoy;
        } else {
            _SYNOLO_POSOSTON_ERGAZOMENOY += floatValue_PosostoKrathshsErgazomenoy;
            _SYNOLO_POSON_ERGAZOMENOY += floatValue_PosoKrathshsErgazomenoy;
            _POSO_MH_YPOLOGIZOMENO_STIS_ASFALISTIKES_APODOXES += floatValue_PosoKrathshsErgazomenoy;
        }
    }

    _MHNIAIES_MIKTES_APODOXES_FOROLOGHTEES = ((parseFloat(mhniaio_forologhteo_poso.value) + _SYNOLO_POSOY_EISFORON_PLASMATIKHS_AXIAS + _SYNOLO_POSON_ERGAZOMENOY) / (1 - (_SYNOLO_POSOSTON_ERGAZOMENOY / 100))).toFixed(2);

    _DOTO_PLHROTEO = true;
    _NEOS_FOROS = parseFloat(mhniaio_forologhteo_poso.value) - _NEO_PLHROTEO;
    _PROHGOYMENES_MIKTES_APODOXES = parseFloat(synolo_mikton_apodoxon.value);
    _NEES_PLHROTEES_APODOXES = parseFloat(_NEO_PLHROTEO);

    if (_SYNOLO_MIKTON_MHNIAION_APODOXON === 0) {
        _SYNOLO_MIKTON_MHNIAION_APODOXON = (parseFloat(_MHNIAIES_MIKTES_APODOXES_FOROLOGHTEES) + parseFloat(_SYNOLO_POSON_ERGAZOMENOY) + parseFloat(_SYNOLO_POSON_ERGAZOMENOY_MH_YPOKEIMENO_STO_FORΟ)).toFixed(2);
        diafora_apodoxon.value = (parseFloat(_SYNOLO_MIKTON_MHNIAION_APODOXON) - parseFloat(_SYNOLO_MIKTON_APODOXON)).toFixed(2);
        // diafora_apodoxon.value = (parseFloat(_SYNOLO_MIKTON_MHNIAION_APODOXON) - parseFloat(synolo_mikton_apodoxon.value)).toFixed(2);
    }

    if (diafora_apodoxon.value < 0) {
        diafora_apodoxon.value = 0
    }

}

// === ΚΑΝΕΙ ΤΗ ΣΥΝΑΡΤΗΣΗ ΔΙΑΘΕΣΙΜΗ ΣΤΟΝ BROWSER ===
if (typeof window !== "undefined") {
  window.calcForos = calcForos;
  window.calcMiktesApodoxesApoPlhroteo = calcMiktesApodoxesApoPlhroteo;
}

// === ΚΑΝΕΙ EXPORT ΓΙΑ COMMONJS (π.χ. Node.js scripts) ===
if (typeof module !== "undefined" && module.exports) {
  module.exports = { calcForos, calcMiktesApodoxesApoPlhroteo };
}
