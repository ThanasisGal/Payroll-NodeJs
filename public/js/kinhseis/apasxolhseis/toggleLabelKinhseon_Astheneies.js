document.addEventListener("DOMContentLoaded", function () {
    let checkboxes = [
        "idios_logos_01", "idios_logos_02", "idios_logos_03", "idios_logos_04", "idios_logos_05", 
        "adeia_kyhshs_loxeias_01", "adeia_kyhshs_loxeias_02", "adeia_kyhshs_loxeias_03", "adeia_kyhshs_loxeias_04", "adeia_kyhshs_loxeias_05"
    ];
    
    // Επανάληψη της λίστας για να καλέσω την setupCheckbox για κάθε checkbox
    checkboxes.forEach(setupCheckbox);
});
    
    
  function setupCheckbox(checkboxId) {
    let checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      checkbox.addEventListener("change", function () {
          toggleCheckboxState(checkboxId, checkbox.checked);
      });
      toggleCheckboxState(checkboxId, checkbox.checked); // Περνά την τρέχουσα κατάσταση του checkbox
    }
  }
  
  function toggleCheckboxState(checkboxId) {
    let isChecked = document.getElementById(checkboxId).checked;
    let labelId = "label-" + checkboxId; 
    let label = document.getElementById(labelId);
  
    label.textContent = isChecked ? "ΝΑΙ" : "ΟΧΙ";
  }
  
