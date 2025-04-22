// Αυτή η συνάρτηση ενεργοποιεί ή απενεργοποιεί τα input fields ανάλογα με την κατάσταση του συσχετισμένου checkbox
function toggleInputs(checkboxId, inputIds) {
  var checkbox = document.getElementById(checkboxId);
  checkbox.addEventListener('change', function() {
    inputIds.forEach(function(inputId) {
      var input = document.getElementById(inputId);
      if (input) {
        input.disabled = !checkbox.checked;
      }
      if (!checkbox.checked) {
        input.value = "";
      }
    });
  });

  // Ενεργοποιεί/απενεργοποιεί τα inputs αμέσως με βάση την αρχική κατάσταση του checkbox
  inputIds.forEach(function(inputId) {
    var input = document.getElementById(inputId);
    if (input) {
      input.disabled = !checkbox.checked;
    }
    if (!checkbox.checked) {
      input.value = "";
    }
  });
}

// Εξασφαλίζει ότι οι λειτουργίες θα εκτελεστούν μόλις το DOM είναι πλήρως φορτωμένο
document.addEventListener('DOMContentLoaded', function() {
  toggleInputs('antikatastash_ergazomenoy', ['afm_antikatastath', 'amka_antikatastath']);
  toggleInputs('diathesimothta', ['enarxh_diathesimothtas', 'lhxh_diathesimothtas']);
  toggleInputs('adeia_diamonhs_me_amesh_prosbash_gia_ergasia', ['eidos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia', 'arithmos_adeias_diamonhs_me_amesh_prosbash_gia_ergasia', 'hmeromhnia_lhxhs_adeias_diamonhs_me_amesh_prosbash_gia_ergasia']);
  toggleInputs('adeia_diamonhs_xwris_amesh_prosbash_gia_ergasia', ['eidos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia', 'arithmos_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia', 'hmeromhnia_lhxhs_adeias_diamonhs_xwris_amesh_prosbash_gia_ergasia']);
  toggleInputs('adeia_eisodoy_gia_epoxikh_apasxolhsh', ['arithmos_adeias_eisodoy_gia_epoxikh_apasxolhsh', 'apo_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh', 'eos_hmeromhnia_eisodoy_gia_epoxikh_apasxolhsh']);
  toggleInputs('epaggelmatikh_katartish', ['antikeimeno_katartishs', 'thematiko_pedio', 'thematikh_enothta', 'foreas_katartishs', 'katartish_apo', 'katartish_eos', 'diarkeia_se_ores', 'etos_apokthshs']);
  toggleInputs('kataggelia_katopin_eggrafhs_proeidopoihshs', ['hmeromhnia_eggrafhs_proeidopoihshs']);
  toggleInputs('omadikh_apolysh', ['arithmos_apofashs_gia_omadikh_apolysh', 'hmeromhnia_apofashs_gia_omadikh_apolysh']);
  toggleInputs('epidosh_me_dikastiko_epimelhth', ['hmeromhnia_epidoshs']);
});
