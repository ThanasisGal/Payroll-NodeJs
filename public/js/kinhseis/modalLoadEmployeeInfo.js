// document.addEventListener("DOMContentLoaded", function () {
    let _ergazomenoi = null;
    let _sxeshErgasias = null;
    let _kathestosApasxolhshs = null;
    let _oikogeneiakhKatastash = null;
    let _typosErgazomenoy = null;

    async function modalEmployeeInfo(kodikos_ergazomenoy, prefix) {
        if (!kodikos_ergazomenoy) return;
        let selectedTeam = document.getElementById("team") ? document.getElementById("team").value : null;
        let selectedCompany = document.getElementById("company_kod") ? document.getElementById("company_kod").value : null;
        let selectedKodikos = kodikos_ergazomenoy;
        console.log(selectedTeam, selectedCompany, selectedKodikos);
        try {
            const response = await fetch(`/api/kinhseis/getLoipaStoixeiaErgazomenoy/${selectedTeam}/${selectedCompany}/${selectedKodikos}`);   
            const result = await response.json();

          _ergazomenoi = result.ergazomenoi;
          _sxeshErgasias = result.sxeshErgasias;
          _kathestosApasxolhshs = result.kathestosApasxolhshs;
          _oikogeneiakhKatastash = result.oikogeneiakhKatastash;
          _typosErgazomenoy = result.typosErgazomenoy;
          _genikesParametroi = result.genikesParametroi;
          _asfalistikesKlaseis = result.asfalistikesKlaseis;
          _argies = result.argies;
          _etaireia = result.etaireia;
  
            document.getElementById("ergazomenos_Hidden").value = _ergazomenoi.eponymo.trim() + " " + _ergazomenoi.patronymo.substring(0,3).trim() + " " + _ergazomenoi.onoma.trim();
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
  
            document.getElementById("synoloApodoxon").value = parseFloat(_ergazomenoi.synolo_symbashs_basei_oron_ergasias).toFixed(2);
            document.getElementById("pragmatikoOromisthio").value = parseFloat(_ergazomenoi.pragmatikoOromisthio).toFixed(2);
            document.getElementById("pragmatikoHmeromisthio").value = parseFloat(_ergazomenoi.pragmatikoHmeromisthio).toFixed(2);
            document.getElementById("nomimoOromisthio").value = parseFloat(_ergazomenoi.nomimoOromisthio).toFixed(2);
            document.getElementById("nomimoHmeromisthio").value = parseFloat(_ergazomenoi.nomimoHmeromisthio).toFixed(2);
  

            window.sharedParams = {
                ergazomenoi: _ergazomenoi,
                sxeshErgasias: _sxeshErgasias,
                kathestosApasxolhshs: _kathestosApasxolhshs,
                oikogeneiakhKatastash: _oikogeneiakhKatastash,
                typosErgazomenoy: _typosErgazomenoy,
                genikesParametroi: _genikesParametroi,
                asfalistikesKlaseis: _asfalistikesKlaseis,
                argies: _argies,
                _TEAM: document.getElementById("team").value,
                _COMPANY: document.getElementById("company_kod").value,
                _XRHSH: document.getElementById("etos").value,
                _KODIKOS_ETAIREIAS: _etaireia.kod,
                _ERGASIMES_HMERES_MHNA: 0,
                _ETHSIES_ORES_YPERORION: 0,
                _PROSAYXHSH_HMERON_5MERHS_ERGASIAS: 0,
                startDate: null,
                endDate: null
              };
          
              let sharedParams = window.sharedParams;
          
              // Δημιουργία του CustomEvent με τις παραμέτρους
              let event = new CustomEvent('sharedParamsLoaded', { detail: sharedParams });
              // Πυροδότηση του event
              document.dispatchEvent(event);
          
        } catch (err) {
            console.error(err);
        }
    }
// });