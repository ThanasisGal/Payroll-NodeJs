async function fillFields(result, sharedParams, loaderContainer) {
    const formatCurrencyInput2 = (value) => {
        const num = Number(String(value ?? '0').replace(',', '.'));
        return Number.isFinite(num) ? num.toFixed(2) : '0.00';
    };

    // Ο loader ελέγχεται από τον outer AppLoader span του employee pipeline.
    // Εδώ δεν χρειαζόμαστε ανεξάρτητο έλεγχο loader αν τρέχει το pipeline.
    const fillFieldsOwnsLoader =
        !!loaderContainer &&
        window.apasxolhseisEmployeeLoadPipeline !== true;

    if (fillFieldsOwnsLoader) {
        loaderContainer.style.display = "grid";
    }
    
    firstTimeCalcPlhroteo = true;
    hasRecord = true;
    
    await clearFormFields();
    await clearValueFields();

    const selectedTeam = result.team;
    const selectedCompany = result.company_kod;
    const selectedKodikos = result.kodikos;
    const response = await fetch(`/api/kinhseis/getLoipaStoixeiaErgazomenoy/${selectedTeam}/${selectedCompany}/${selectedKodikos}`);   
    const _result = await response.json();

    // Ανάθεση τιμών στις global μεταβλητές
    let _ergazomenoi = _result.ergazomenoi;
    let _sxeshErgasias = _result.sxeshErgasias;
    let _kathestosApasxolhshs = _result.kathestosApasxolhshs;
    let _oikogeneiakhKatastash = _result.oikogeneiakhKatastash;
    let _typosErgazomenoy = _result.typosErgazomenoy;
    let _genikesParametroi = _result.genikesParametroi;
    let _asfalistikesKlaseis = _result.asfalistikesKlaseis;
    let _argies = _result.argies;
    let _etaireia = _result.etaireia;
    let _astheneies = _result.astheneies;

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

    document.getElementById("idKinhseonHidden").value = result._id; 
    document.getElementById("synoloApodoxon").value = parseFloat(result.synolo_apodoxon).toFixed(2); 
    document.getElementById("symfonhtheisMisthos").value = parseFloat(result.symfonhtheis_misthos).toFixed(2); 
    document.getElementById("nomimoHmeromisthio").value = parseFloat(result.nomimo_hmeromisthio).toFixed(2); 
    document.getElementById("pragmatikoHmeromisthio").value = parseFloat(result.pragmatiko_hmeromisthio).toFixed(2); 
    document.getElementById("nomimoOromisthio").value = parseFloat(result.nomimo_oromisthio).toFixed(2); 
    document.getElementById("pragmatikoOromisthio").value = parseFloat(result.pragmatiko_oromisthio).toFixed(2); 
    document.getElementById("hmeresErgasias").value = parseInt(result.hmeres_ergasias); 
    document.getElementById("oresErgasias").value = parseFloat(result.ores_ergasias).toFixed(4); 
    document.getElementById("hmeresApoysias").value = parseInt(result.hmeres_apoysias); 
    document.getElementById("oresApoysias").value = parseFloat(result.ores_apoysias).toFixed(4); 
    document.getElementById("hmeresErgasiasMeionApoysies").value = parseInt(result.hmeres_ergasias_meion_apoysies); 
    document.getElementById("oresErgasiasMeionApoysies").value = parseFloat(result.ores_ergasias_meion_apoysies).toFixed(4); 
    document.getElementById("hmeresAsfalishs").value = parseInt(result.hmeres_asfalishs); 
    
    document.getElementById("oresArgion").value = parseFloat(result.ores_argion); 
    document.getElementById("axiaArgion").value = parseFloat(result.axia_argion).toFixed(2); 
    document.getElementById("asfalistikhAxiaArgion").value = parseFloat(result.asfalistikh_axia_argion).toFixed(2); 

    document.getElementById("oresNyxtas").value = parseFloat(result.ores_nyxtas); 
    document.getElementById("axiaNyxtas").value = parseFloat(result.axia_nyxtas).toFixed(2); 
    document.getElementById("asfalistikhAxiaNyxtas").value = parseFloat(result.asfalistikh_axia_nyxtas).toFixed(2); 

    document.getElementById("oresYperergasias").value = parseFloat(result.ores_yperergasias); 
    document.getElementById("axiaYperergasias").value = parseFloat(result.axia_yperergasias).toFixed(2); 
    document.getElementById("asfalistikhAxiaYperergasias").value = parseFloat(result.asfalistikh_axia_yperergasias).toFixed(2); 
    document.getElementById("oresYperergasiasNyxtas").value = parseFloat(result.ores_yperergasias_nyxtas); 
    document.getElementById("axiaYperergasiasNyxtas").value = parseFloat(result.axia_yperergasias_nyxtas).toFixed(2); 
    document.getElementById("asfalistikhAxiaYperergasiasNyxtas").value = parseFloat(result.asfalistikh_axia_yperergasias_nyxtas).toFixed(2); 
    document.getElementById("oresYperergasiasArgion").value = parseFloat(result.ores_yperergasias_argion); 
    document.getElementById("axiaYperergasiasArgion").value = parseFloat(result.axia_yperergasias_argion).toFixed(2); 
    document.getElementById("asfalistikhAxiaYperergasiasArgion").value = parseFloat(result.asfalistikh_axia_yperergasias_argion).toFixed(2); 
    document.getElementById("oresYperergasiasArgionNyxtas").value = parseFloat(result.ores_yperergasias_argion_nyxtas); 
    document.getElementById("axiaYperergasiasArgionNyxtas").value = parseFloat(result.axia_yperergasias_argion_nyxtas).toFixed(2); 
    document.getElementById("asfalistikhAxiaYperergasiasArgionNyxtas").value = parseFloat(result.asfalistikh_axia_yperergasias_argion_nyxtas).toFixed(2); 

    document.getElementById("oresNomimhsYperorias").value = parseFloat(result.ores_nomimhs_yperorias); 
    document.getElementById("axiaNomimhsYperorias").value = parseFloat(result.axia_nomimhs_yperorias).toFixed(2); 
    document.getElementById("asfalistikhAxiaNomimhsYperorias").value = parseFloat(result.asfalistikh_axia_nomimhs_yperorias).toFixed(2); 
    document.getElementById("oresNomimhsYperoriasNyxtas").value = parseFloat(result.ores_nomimhs_yperorias_nyxtas); 
    document.getElementById("axiaNomimhsYperoriasNyxtas").value = parseFloat(result.axia_nomimhs_yperorias_nyxtas).toFixed(2); 
    document.getElementById("asfalistikhAxiaNomimhsYperoriasNyxtas").value = parseFloat(result.asfalistikh_axia_nomimhs_yperorias_nyxtas).toFixed(2); 
    document.getElementById("oresNomimhsYperoriasArgion").value = parseFloat(result.ores_nomimhs_yperorias_argion); 
    document.getElementById("axiaNomimhsYperoriasArgion").value = parseFloat(result.axia_nomimhs_yperorias_argion).toFixed(2); 
    document.getElementById("asfalistikhAxiaNomimhsYperoriasArgion").value = parseFloat(result.asfalistikh_axia_nomimhs_yperorias_argion).toFixed(2); 
    document.getElementById("oresNomimhsYperoriasArgionNyxtas").value = parseFloat(result.ores_nomimhs_yperorias_argion_nyxtas); 
    document.getElementById("axiaNomimhsYperoriasArgionNyxtas").value = parseFloat(result.axia_nomimhs_yperorias_argion_nyxtas).toFixed(2); 
    document.getElementById("asfalistikhAxiaNomimhsYperoriasArgionNyxtas").value = parseFloat(result.asfalistikh_axia_nomimhs_yperorias_argion_nyxtas).toFixed(2); 

    document.getElementById("oresParanomhsYperorias").value = parseFloat(result.ores_paranomhs_yperorias); 
    document.getElementById("axiaParanomhsYperorias").value = parseFloat(result.axia_paranomhs_yperorias).toFixed(2); 
    document.getElementById("asfalistikhAxiaParanomhsYperorias").value = parseFloat(result.axia_paranomhs_yperorias).toFixed(2); 
    document.getElementById("oresParanomhsYperoriasNyxtas").value = parseFloat(result.ores_paranomhs_yperorias_nyxtas); 
    document.getElementById("axiaParanomhsYperoriasNyxtas").value = parseFloat(result.axia_paranomhs_yperorias_nyxtas).toFixed(2); 
    document.getElementById("asfalistikhAxiaParanomhsYperoriasNyxtas").value = parseFloat(result.axia_paranomhs_yperorias_nyxtas).toFixed(2); 
    document.getElementById("oresParanomhsYperoriasArgion").value = parseFloat(result.ores_paranomhs_yperorias_argion); 
    document.getElementById("axiaParanomhsYperoriasArgion").value = parseFloat(result.axia_paranomhs_yperorias_argion).toFixed(2); 
    document.getElementById("asfalistikhAxiaParanomhsYperoriasArgion").value = parseFloat(result.axia_paranomhs_yperorias_argion).toFixed(2); 
    document.getElementById("oresParanomhsYperoriasArgionNyxtas").value = parseFloat(result.ores_paranomhs_yperorias_argion_nyxtas); 
    document.getElementById("axiaParanomhsYperoriasArgionNyxtas").value = parseFloat(result.axia_paranomhs_yperorias_argion_nyxtas).toFixed(2); 
    document.getElementById("asfalistikhAxiaParanomhsYperoriasArgionNyxtas").value = parseFloat(result.axia_paranomhs_yperorias_argion_nyxtas).toFixed(2); 

    document.getElementById("oresErgasias6Hmeras").value = parseFloat(result.ores_ergasias_6_hmeras); 
    document.getElementById("axiaErgasias6Hmeras").value = parseFloat(result.axia_ergasias_6_hmeras).toFixed(2); 
    document.getElementById("oresProsthethsErgasias").value = parseFloat(result.ores_prostheths_ergasias); 
    document.getElementById("axiaProsthethsErgasias").value = parseFloat(result.axia_prostheths_ergasias).toFixed(2); 
    document.getElementById("synoloProsayxhseon").value = parseFloat(result.synolo_prosayxhseon).toFixed(2); 
    document.getElementById("taktikesApodoxesMhYpologizomenesSeDoraText").value = result.taktikes_apodoxes_mh_ypologizomenes_se_dora_text; 
    document.getElementById("taktikesApodoxesMhYpologizomenesSeDora").value = parseFloat(result.taktikes_apodoxes_mh_ypologizomenes_se_dora).toFixed(2); 
    document.getElementById("taktikesApodoxesYpologizomenesSeDoraText").value = result.taktikes_apodoxes_ypologizomenes_se_dora_text; 
    document.getElementById("taktikesApodoxesYpologizomenesSeDora").value = parseFloat(result.taktikes_apodoxes_ypologizomenes_se_dora).toFixed(2); 
    document.getElementById("sympsifisteesApodoxes").value = parseFloat(result.sympsifistees_apodoxes).toFixed(2); 
    document.getElementById("synoloTaktikaKataballomenonApodoxon").value = parseFloat(result.synolo_taktika_kataballomenon_apodoxon).toFixed(2); 
    document.getElementById("epimerizomenesSeMhnesErgasiasText").value = result.epimerizomenes_se_mhnes_ergasias_text; 
    document.getElementById("epimerizomenesSeMhnesErgasias").value = parseFloat(result.epimerizomenes_se_mhnes_ergasias).toFixed(2); 
    document.getElementById("primBonusText").value = result.prim_bonus_text; 
    document.getElementById("primBonus").value = parseFloat(result.prim_bonus).toFixed(2); 
    document.getElementById("apallassomenesForoyText").value = result.apallassomenes_foroy_text; 
    document.getElementById("apallassomenesForoy").value = parseFloat(result.apallassomenes_foroy).toFixed(2); 
    document.getElementById("apallassomenesKrathseonText").value = result.apallassomenes_krathseon_text; 
    document.getElementById("apallassomenesKrathseon").value = parseFloat(result.apallassomenes_krathseon).toFixed(2); 
    document.getElementById("synoloEktaktaKataballomenonApodoxon").value = parseFloat(result.synolo_ektakta_kataballomenon_apodoxon).toFixed(2); 
    document.getElementById("meioshErgatikhsEisforas").value = parseFloat(result.meiosh_ergatikhs_eisforas).toFixed(2); 
    document.getElementById("epidothshErgodotikhsEisforas").value = parseFloat(result.meiosh_ergodotikhs_eisforas).toFixed(2); 
    document.getElementById("neoPragmatikoHmeromisthio").value = parseFloat(result.neo_pragmatiko_hmeromisthio).toFixed(2); 
    document.getElementById("pragmatikoHmeromisthioAstheneias").value = parseFloat(result.pragmatiko_hmeromisthio_astheneias).toFixed(2); 
    document.getElementById("apoHmeromhnia").value = result.apo_hmeromhnia; 
    document.getElementById("eosHmeromhnia").value = result.eos_hmeromhnia;

    document.getElementById("synoloAsfalistikhsAxias").value = parseFloat(result.synolo_asfalistikhs_axias_prosayxhseon).toFixed(2); 
    document.getElementById("synoloMiktonApodoxon").value = parseFloat(result.synolo_mikton_apodoxon).toFixed(2); 
    document.getElementById("synoloMiktonApodoxon_Hidden").value = parseFloat(parseFloat(result.synolo_mikton_apodoxon) - parseFloat(result.synolo_prosayxhseon)).toFixed(2) 
    document.getElementById("synoloKrathseon_I").value = parseFloat(result.synolo_krathseon_i).toFixed(2); 
    document.getElementById("synoloForoy").value = parseFloat(result.synolo_foroy).toFixed(2); 
    document.getElementById("prokatabolh").value = parseFloat(result.prokatabolh).toFixed(2); 
    document.getElementById("plhroteo").value = parseFloat(result.plhroteo).toFixed(2); 
    document.getElementById("asfalistikes_apodoxes").value = parseFloat(result.asfalistikes_apodoxes).toFixed(2); 
    document.getElementById("asfalistikes_apodoxes_hidden").value = parseFloat(result.asfalistikes_apodoxes_hidden).toFixed(2); 

    // ΚΡΑΤΗΣΕΙΣ
    const data = await fetchKrathseisData(); // Μία κλήση στον server
    await generateSelectRowsOfKrathseis(data, sharedParams); // Δημιουργία dropdowns

    await loadKrathseis_Edit(data, result, sharedParams); // Γέμισμα dropdowns
    
    document.getElementById("synolo_axias_krathshs_ergazomenoy").value = formatCurrencyInput2(result.synolo_axias_krathshs_ergazomenoy);
    document.getElementById("synolo_axias_krathshs_ergodoth").value = formatCurrencyInput2(result.synolo_axias_krathshs_ergodoth);
    document.getElementById("synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro").value = formatCurrencyInput2(result.synolo_axias_krathshs_ergazomenoy_ypologizomenh_sto_foro);
    document.getElementById("synolo_axias_krathshs_ergodoth_ypologizomenh_sto_foro").value = formatCurrencyInput2(result.synolo_axias_krathshs_ergodoth_ypologizomenh_sto_foro);
    document.getElementById("synolo_axias_krathshs_ergazomenoy_mh_ypologizomenh_sto_foro").value = formatCurrencyInput2(result.synolo_axias_krathshs_ergazomenoy_mh_ypologizomenh_sto_foro);
    document.getElementById("synolo_axias_krathshs_ergodoth_mh_ypologizomenh_sto_foro").value = formatCurrencyInput2(result.synolo_axias_krathshs_ergodoth_mh_ypologizomenh_sto_foro);

    // ΦΟΡΟΙ
    document.getElementById("analogoyn_foros_pro_ekptoshs").value = parseFloat(result.analogoyn_foros_pro_ekptoshs).toFixed(2); 
    document.getElementById("mhniaios_analogoyn_foros_pro_ekptoshs").value = parseFloat(result.mhniaios_analogoyn_foros_pro_ekptoshs).toFixed(2); 
    document.getElementById("eisfora_allhleggyhs").value = parseFloat(result.eisfora_allhleggyhs).toFixed(2); 
    document.getElementById("ekptosh_logo_oikogeneiakhs_katastashs").value = parseFloat(result.ekptosh_logo_oikogeneiakhs_katastashs).toFixed(2); 
    document.getElementById("mhniaia_ekptosh_logo_oikogeneiakhs_katastashs").value = parseFloat(result.mhniaia_ekptosh_logo_oikogeneiakhs_katastashs).toFixed(2); 
    document.getElementById("mhniaia_ekptosh_logo_oikogeneiakhs_katastashs").value = parseFloat(result.mhniaia_ekptosh_logo_oikogeneiakhs_katastashs).toFixed(2); 
    document.getElementById("analogoyn_foros_meta_thn_ekptosh").value = parseFloat(result.analogoyn_foros_meta_thn_ekptosh).toFixed(2); 
    document.getElementById("synolo_ektakton_amoibon").value = parseFloat(result.synolo_ektakton_amoibon).toFixed(2); 
    document.getElementById("analogoyn_foros_ektakton_amoibon").value = parseFloat(result.analogoyn_foros_ektakton_amoibon).toFixed(2); 


    // ΑΣΘΕΝΕΙΕΣ

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

    for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[51].timh); i++) {
        const rowString = i < 10 ? `0${i}` : String(i);
        await attachRowListeners_Astheneias(rowString);
    }

    // for (let i = 1; i <= parseInt(sharedParams.genikesParametroi[51].timh); i++) {

    // }

    if (fillFieldsOwnsLoader) {
        loaderContainer.style.display = "none";
    }

}

async function loadKrathseis_Edit(data, result, sharedParams = window.sharedParams) {
    const previousBulkLoading = window.apasxolhseisKrathseisBulkLoading;
    window.apasxolhseisKrathseisBulkLoading = true;
    const fieldsStoixeionKrathseon = ['kodikos', 'krathsh', 'asfalistikesApodoxes', 'pososto_krathshs_ergazomenoy', 'pososto_krathshs_ergodoth', 'synolo_pososton_krathshs', 'poso_krathshs_ergazomenoy', 'poso_krathshs_ergodoth', 'synolo_poson_krathshs', 'axia_krathshs_ergazomenoy', 'axia_krathshs_ergodoth', 'ypologizomenoStoForo', 'ypologizomenoEpiPlasmatikhs', 'plasmatikh_axia', 'apaiteitai_apodoxes_asfalishs', 'anotato_orio_palion', 'anotato_orio_neon', 'kad', 'eidikothta', 'kpk', 'se_typos_apodoxon', 'epa'];

    // Ορίζουμε ποια fields είναι numbers με Fixed(4)
    const numberFieldsKrathseon_4 = new Set(['pososto_krathshs_ergazomenoy', 'pososto_krathshs_ergodoth', 'synolo_pososton_krathshs']);

    // Ορίζουμε ποια fields είναι numbers με Fixed(2)
    const numberFieldsKrathseon_2 = new Set(['asfalistikesApodoxes', 'poso_krathshs_ergazomenoy', 'poso_krathshs_ergodoth', 'synolo_poson_krathshs', 'axia_krathshs_ergazomenoy', 'axia_krathshs_ergodoth', 'plasmatikh_axia', 'anotato_orio_palion', 'anotato_orio_neon']);

    // Ορίζουμε ποια fields είναι booleans
    const booleanFieldsKrathseon = new Set(['ypologizomenoStoForo', 'ypologizomenoEpiPlasmatikhs', 'apaiteitai_apodoxes_asfalishs']);

    try {
        for (let i = 1; i <= parseInt(window.sharedParams.genikesParametroi[23].timh); i++) {
        const index = i.toString().padStart(2, '0');
        // const ergazomenoiField = sharedParams.ergazomenoi[`krathsh_${index}`] || '';
        // const krathseisDropdown = document.getElementById(`krathsh_${index}`);
        // let kodikos_krathshs = document.getElementById(`kodikos_${index}`);

        const resultKrathsh = result[`krathsh_${index}`] || '';
        const krathseisDropdown = document.getElementById(`krathsh_${index}`);
        let kodikos_krathshs = document.getElementById(`kodikos_${index}`);
        if (!krathseisDropdown || !kodikos_krathshs) continue;

        // Δημιουργία της αρχικής επιλογής
        if (krathseisDropdown.tomselect) krathseisDropdown.tomselect.destroy();
        krathseisDropdown.innerHTML = '<option value="" selected></option>';

        for (const krathsh of data) {
            const option = window.createKrathshOption(
                krathsh,
                result[`asfalistikesApodoxes_${index}`] || result["asfalistikes_apodoxes"] || 0
            );

            if (krathsh.kodikos === resultKrathsh) {
                option.selected = true;
                kodikos_krathshs.value = krathsh.kodikos;
                await window.applyKrathshAntistoixiseisDataset(index, option, {
                    sharedParams,
                    fallbackSource: sharedParams.ergazomenoi
                });
            }
            krathseisDropdown.appendChild(option);
        };

        window.initKrathseisTomSelect(krathseisDropdown);
        window.setKrathseisTomSelectValue(krathseisDropdown, resultKrathsh, true);

        // Ενημέρωση των πεδίων με βάση την αρχική τιμή
        await updatePosostaFields_Edit(i);

        // Προσθήκη event listener (μόνο μία φορά)
        krathseisDropdown.addEventListener('change', async () => {
            if (window.apasxolhseisKrathseisBulkLoading === true) return;

            kodikos_krathshs.value = krathseisDropdown.value || '';
            const selectedOption = window.getSelectedKrathshOption(krathseisDropdown);
            await window.applyKrathshAntistoixiseisDataset(index, selectedOption, {
                sharedParams,
                fallbackSource: sharedParams.ergazomenoi
            });
            await updatePosostaFields_Edit(i);
        });

        // Προσθήκη event listener στο κουμπί καθαρισμού
        const clearButton = document.getElementById(`clearSelectKrathseon_${index}`);
        clearButton.addEventListener('click', async () => {
            await clearRowFields_Edit(index);
        });

        document.getElementById(`asfalistikesApodoxes_${index}`).addEventListener('input', () => { 
            if (!window.apasxolhseisKrathseisBulkLoading) {
                Promise.resolve(ypologismosAxiasKrathseon()).then(() => {
                    if (typeof window.scheduleKrathseisAmountsFormatting === 'function') {
                        window.scheduleKrathseisAmountsFormatting();
                    }
                });
            }
        });
    }

        window.apasxolhseisKrathseisBulkLoading = previousBulkLoading;

        if (typeof ypologismosAxiasKrathseon === 'function') {
            await ypologismosAxiasKrathseon(window.sharedParams);
            if (typeof window.scheduleKrathseisAmountsFormatting === 'function') {
                window.scheduleKrathseisAmountsFormatting();
            }
        }
    } finally {
        window.apasxolhseisKrathseisBulkLoading = previousBulkLoading;
    }

    // await calcPlhroteo();
    
};

async function updatePosostaFields_Edit(i) {
    const index = i.toString().padStart(2, '0');
    const dropdown = document.getElementById(`krathsh_${index}`);
    if (!dropdown) return;

    const selectedOption = window.getSelectedKrathshOption(dropdown);

    if (!selectedOption) return;

    // Ενημέρωση τιμών των πεδίων
    setValue_Edit(`pososto_krathshs_ergazomenoy_${index}`, selectedOption.dataset.posostoErgazomenoy, 4, false, true);
    setValue_Edit(`pososto_krathshs_ergodoth_${index}`, selectedOption.dataset.posostoErgodoth, 4, false, true);
    setValue_Edit(`synolo_pososton_krathshs_${index}`, selectedOption.dataset.synoloPososton, 4, false, true);

    setValue_Edit(`poso_krathshs_ergazomenoy_${index}`, selectedOption.dataset.posoErgazomenoy, 2, false, true);
    setValue_Edit(`poso_krathshs_ergodoth_${index}`, selectedOption.dataset.posoErgodoth, 2, false, true);
    setValue_Edit(`synolo_poson_krathshs_${index}`, selectedOption.dataset.synoloPoson, 2, false, true);

    setValue_Edit(`anotato_orio_palion_${index}`, selectedOption.dataset.anotatoOrioPalion, 2, false, true);
    setValue_Edit(`anotato_orio_neon_${index}`, selectedOption.dataset.anotatoOrioNeon, 2, false, true);
    
    setValue_Edit(`ypologizomenoStoForo_${index}`, selectedOption.dataset.ypologizomenoStoForo, null, true);
    setValue_Edit(`ypologizomenoEpiPlasmatikhs_${index}`, selectedOption.dataset.ypologizomenoEpiPlasmatikhs, null, true);
    setValue_Edit(`plasmatikh_axia_${index}`, selectedOption.dataset.plasmatikhAxia, 2, false, true);
    setValue_Edit(`asfalistikesApodoxes_${index}`, selectedOption.dataset.asfalistikesApodoxes, 2, false, true);
    setValue_Edit(`apaiteitai_apodoxes_asfalishs_${index}`, selectedOption.dataset.apaiteitaiApodoxesAsfalishs, null, true);

    setValue_Edit(`kad_${index}`, selectedOption.dataset.kad, null, false, false);
    setValue_Edit(`eidikothta_${index}`, selectedOption.dataset.eidikothta, null, false, false);
    setValue_Edit(`kpk_${index}`, selectedOption.dataset.kpk, null, false, false);
    setValue_Edit(`se_typos_apodoxon_${index}`, selectedOption.dataset.se_typos_apodoxon, null, false, false);
    setValue_Edit(`epa_${index}`, selectedOption.dataset.epa, null, false, false);

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
    if (!window.apasxolhseisKrathseisBulkLoading) {
        await ypologismosAxiasKrathseon();
        if (typeof window.scheduleKrathseisAmountsFormatting === 'function') {
            window.scheduleKrathseisAmountsFormatting();
        }
    }

}

function isNumberInputField_Edit(field) {
    return field && field.tagName === 'INPUT' && String(field.type || '').toLowerCase() === 'number';
}

function setValue_Edit(fieldId, value, decimalPlaces = null, isBoolean = false, format = false) {
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

    const parsedValue = parseFloat(String(value ?? '').replace(',', '.'));

    if (isNaN(parsedValue)) {
        field.value = decimalPlaces ? `0.${'0'.repeat(decimalPlaces)}` : '';
    } else {
        const fixedValue = parsedValue.toFixed(decimalPlaces);
        field.value = format && !isNumberInputField_Edit(field)
            ? fixedValue.replace('.', ',')
            : fixedValue;
    }
}

async function clearRowFields_Edit(index) {
    const fields = [
        `krathsh_${index}`,
        `kodikos_${index}`,
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
                window.setKrathseisTomSelectValue(field, '', true);
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
  
  // Ενημέρωση των πεδίων μετά τον καθαρισμό
  await ypologismosAxiasKrathseon();
  if (typeof window.scheduleKrathseisAmountsFormatting === 'function') {
    window.scheduleKrathseisAmountsFormatting();
  }

}
