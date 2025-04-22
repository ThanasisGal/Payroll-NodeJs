document.addEventListener("DOMContentLoaded", function () {
  var checkboxConfigurations = {
    "selectEmployes": {
      labelTrue: "ΜΟΝΟ ΟΙ ΕΝΕΡΓΟΙ",
      labelFalse: "ΟΛΟΙ"
    }
  };

  // Αρχικοποίηση του dropdown
  var ypokatasthmataDropdown = document.getElementById("ypokatasthma");

  // Κύρια λειτουργία για την αρχικοποίηση όλων των checkboxes
  Object.keys(checkboxConfigurations).forEach(setupCheckbox);

  function setupCheckbox(checkboxId) {
    var checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      checkbox.addEventListener("change", function () {
        toggleCheckboxState(checkboxId, checkbox.checked);
      });
      toggleCheckboxState(checkboxId, checkbox.checked); // Περνά την τρέχουσα κατάσταση του checkbox
    }
  }

  function toggleCheckboxState(checkboxId, isChecked) {
    var config = checkboxConfigurations[checkboxId];
    var label = document.getElementById("label-" + checkboxId);
  
    label.textContent = isChecked ? config.labelTrue : config.labelFalse;
  
    // Καθώς αλλάζει το checkbox, επιτρέπουμε νέα φόρτωση των δεδομένων
    window.hasLoadedOnce = false;
  
    // Κλήση της loadErgazomenoi με την ενημερωμένη κατάσταση
    loadErgazomenoi(isChecked, ypokatasthmataDropdown.value);
  }

  // Προσθήκη event listener στο dropdown
  if (ypokatasthmataDropdown) {
    ypokatasthmataDropdown.addEventListener("change", function () {
      // Ενημέρωση του hidden input με το κείμενο του επιλεγμένου option
      const selectedOptionText = ypokatasthmataDropdown.options[ypokatasthmataDropdown.selectedIndex].textContent;
      document.getElementById("ypokatasthma_Hidden").value = selectedOptionText;
      updateLabelsFromHidden('ypokatasthma_Hidden', [ 'ypokatasthmaLabel_Krathseis', 'ypokatasthmaLabel_Foroi', 'ypokatasthmaLabel_Astheneia', 'ypokatasthmaLabel_Adeies' ]);
    
      // Χρησιμοποιούμε την κατάσταση του checkbox μαζί με την τιμή του dropdown
      var checkbox = document.getElementById("selectEmployes");
      var isChecked = checkbox ? checkbox.checked : false;
      loadErgazomenoi(isChecked, ypokatasthmataDropdown.value);
    });
  }
});
