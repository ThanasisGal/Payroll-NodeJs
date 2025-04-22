document.addEventListener("DOMContentLoaded", function () {
  var checkboxConfigurations = {
    "poso_pososto": {
      labelTrue: "ΠΟΣΟ",
      labelFalse: "ΠΟΣΟΣΤΟ",
      enableId: "poso",
      disableId: "pososto"
    }
  };

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
    var enableElement = document.getElementById(config.enableId);
    var disableElement = document.getElementById(config.disableId);

    label.textContent = isChecked ? config.labelTrue : config.labelFalse;

    // Ρύθμιση της ενεργοποίησης/απενεργοποίησης των πεδίων εισαγωγής
    if (isChecked) {
      enableElement.disabled = false;
      disableElement.disabled = true;
    } else {
      enableElement.disabled = true;
      disableElement.disabled = false;
    }
  }
});
