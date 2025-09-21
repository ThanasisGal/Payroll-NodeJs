document.addEventListener("DOMContentLoaded", function () {
var checkboxes = [
  "anenergh",
  "oikodomika",
  "doropasxa_apd",
  "doroxrist_apd",
  "ypologismos_epi_pragmatikoy_oromisthioy",
  "apasxolhsh5hmeron",
  "epoxikothta",
  "oikodomika_erga",
  "ypergolabia",
  "nomiko_prosopo"
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

  if (label) {
    label.textContent = isChecked ? "ΝΑΙ" : "ΟΧΙ"; // Ενημέρωση του κειμένου του label
  }

  switch (checkboxId) {
    case "oikodomika_erga":
      setFieldsDisabled(["ypergolabia", "amoe", "eidos_ergoy", "username_ergoy", "password_ergoy"], !isChecked);
      if (!isChecked) {
        document.getElementById("ypergolabia").checked = false;
        toggleCheckboxState("ypergolabia"); 
        setFieldsDisabled(["eponymo_ergolaboy", "onoma_ergolaboy", "patronymo_ergolaboy", "afm_ergolaboy", "odos_ergolaboy", "arithmos_ergolaboy", "tk_ergolaboy", "polh_ergolaboy", "ame_ergolaboy", "pararthma_efka_ergolaboy", "username_ypergol_ergoy", "password_ypergol_ergoy"], true);
      }
      break;
    case "ypergolabia":
      setFieldsDisabled(["eponymo_ergolaboy", "onoma_ergolaboy", "patronymo_ergolaboy", "afm_ergolaboy", "odos_ergolaboy", "arithmos_ergolaboy", "tk_ergolaboy", "polh_ergolaboy", "ame_ergolaboy", "pararthma_efka_ergolaboy", "username_ypergol_ergoy", "password_ypergol_ergoy"], !isChecked);
      break;
    case "nomiko_prosopo":
      setFieldsDisabled(["nomikh_morfh"], !isChecked);
      break;
  }
}

function setFieldsDisabled(fieldIds, disabled) {
  fieldIds.forEach(function (fieldId) {
    var el = document.getElementById(fieldId);
    if (!el) return;

    // 1) Native disabled
    el.disabled = disabled;

    // 2) Αν είναι checkbox και το απενεργοποιούμε, ξε-τικάρ’ το και συγχρόνισε την ετικέτα
    if (el.type === "checkbox" && disabled) {
      el.checked = false;
      toggleCheckboxState(fieldId);
    }

    // 3) Tom Select (instance διαθέσιμο ως el.tomselect)
    if (el.tomselect) {
      disabled ? el.tomselect.disable() : el.tomselect.enable();
    }

    // 4) bootstrap-select (εάν χρησιμοποιείται)
    // if (window.jQuery && jQuery.fn.selectpicker && jQuery(el).hasClass("selectpicker")) {
    //   jQuery(el).prop("disabled", disabled).selectpicker("refresh");
    // }

    // 5) Εξαναγκασμός redraw/ενημέρωσης listeners
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
