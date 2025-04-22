document.addEventListener("DOMContentLoaded", function () {
var checkboxes = [
  "kyrio_epikoyriko_h", "apla_barea_h", "typos_apodoxon_001", "typos_apodoxon_003", "typos_apodoxon_004", "typos_apodoxon_005", "typos_apodoxon_006", "typos_apodoxon_007", "typos_apodoxon_008", "typos_apodoxon_009", "typos_apodoxon_010", "typos_apodoxon_011", "typos_apodoxon_012", "typos_apodoxon_013", "typos_apodoxon_014", "typos_apodoxon_015", "typos_apodoxon_016", "typos_apodoxon_017", "typos_apodoxon_018", "typos_apodoxon_019", "typos_apodoxon_021", "typos_apodoxon_022", "typos_apodoxon_023", "typos_apodoxon_024", "typos_apodoxon_025", "typos_apodoxon_026", "typos_apodoxon_027", "typos_apodoxon_028", "typos_apodoxon_029", "typos_apodoxon_030", "typos_apodoxon_031", "typos_apodoxon_032", "typos_apodoxon_033", "typos_apodoxon_034", "typos_apodoxon_035", "typos_apodoxon_068", "typos_apodoxon_069", "typos_apodoxon_070", "typos_apodoxon_071", "typos_apodoxon_114", "typos_apodoxon_115", "typos_apodoxon_601", "typos_apodoxon_603", "typos_apodoxon_604", "typos_apodoxon_605", "typos_apodoxon_608", "typos_apodoxon_609", "typos_apodoxon_610", "typos_apodoxon_611", "typos_apodoxon_901", "typos_apodoxon_902", "typos_apodoxon_903", "typos_apodoxon_904", "typos_apodoxon_905", "typos_apodoxon_906", "typos_apodoxon_907", "typos_apodoxon_908", "typos_apodoxon_909", "typos_apodoxon_910", "typos_apodoxon_911", "typos_apodoxon_912", "typos_apodoxon_913", "typos_apodoxon_914", "ypologizetai_sto_foro_h", "ypologismos_epi_plasmatikhs", 
  "apaiteitai_hmnia_apo", "apaiteitai_panta_proslhpsh", "apaiteitai_kata_thn_adeia_apo", 
  "apaiteitai_hmnia_eos", "apaiteitai_panta_apoxorhsh", "apaiteitai_kata_thn_adeia_eos", 
  "apaiteitai_hmeres_asfalishs", "apaiteitai_apodoxes_asfalishs",
];

  // Επανάληψη της λίστας για να καλέσω την setupCheckbox για κάθε checkbox
  checkboxes.forEach(setupCheckbox);
});


function setupCheckbox(checkboxId) {
  var checkbox = document.getElementById(checkboxId);
  if (checkbox) {
    checkbox.addEventListener("change", function () {
      toggleCheckboxState(checkboxId, checkbox.checked);
    });
    toggleCheckboxState(checkboxId, checkbox.checked); // Περνά την τρέχουσα κατάσταση του checkbox
  }
}

function toggleCheckboxState(checkboxId) {
  var isChecked = document.getElementById(checkboxId).checked;
  var labelId = "label-" + checkboxId; 
  var label = document.getElementById(labelId);

  if (checkboxId === "kyrio_epikoyriko_h") {
    label.textContent = isChecked ? "ΕΠΙΚΟΥΡΙΚΟ" : "ΚΥΡΙΟ";
  } else if (checkboxId === "apla_barea_h") {
    label.textContent = isChecked ? "ΒΑΡΕΑ" : "ΑΠΛΑ";
  } else if (checkboxId === "apaiteitai_panta_proslhpsh") {
    label.textContent = isChecked ? "ΠΑΝΤΑ" : "ΠΡΟΣΛΗΨΗ";
  } else if (checkboxId === "apaiteitai_panta_apoxorhsh") {
    label.textContent = isChecked ? "ΠΑΝΤΑ" : "ΑΠΟΧΩΡΗΣΗ";
  } else {
    label.textContent = isChecked ? "ΝΑΙ" : "ΟΧΙ";
  }

  switch (checkboxId) {
    case "apaiteitai_hmnia_apo":
      setFieldsDisabled(["apaiteitai_panta_proslhpsh"], !isChecked);
      break;

      case "apaiteitai_hmnia_eos":
      setFieldsDisabled(["apaiteitai_panta_apoxorhsh"], !isChecked);
      break;
  }
  
}

function setFieldsDisabled(fieldIds, disabled) {
  fieldIds.forEach(function (fieldId) {
    var field = document.getElementById(fieldId);
    if (field) {
      field.disabled = disabled;
    }
  });
}
