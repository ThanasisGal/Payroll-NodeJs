async function clearFormFields() {
  const form = document.getElementById("apasxolhseisForm");
  if (!form) {
    console.warn("Το στοιχείο 'apasxolhseisForm' δεν βρέθηκε.");
    return;
  }

  const elements = form.querySelectorAll("input, select, textarea");
  elements.forEach((element) => {
    if (element.classList.contains("notCleared")) {
      return; // Παράκαμψη του συγκεκριμένου στοιχείου αν έχει την κλάση notCleared
    }

    // TomSelect/TomDropdown δημιουργεί δικά του εσωτερικά inputs μέσα σε .ts-wrapper.
    // Αυτά ΔΕΝ είναι πραγματικά πεδία της φόρμας. Αν τα καθαρίσουμε εδώ,
    // μπορεί να χαθεί οπτικά η επιλογή ή να πυροδοτηθούν άσκοπα reloads.
    if (element.closest && element.closest(".ts-wrapper, .ts-control, .ts-dropdown")) {
      return;
    }

    if (element.tagName === "INPUT") {
      if (element.type === "checkbox" || element.type === "radio") {
        element.checked = false;
      } else if (element.type === "number") {
        element.value = "0";
      } else if (element.type === "text") {
        element.value = "";
      }
    } else if (element.tagName === "SELECT") {
      element.selectedIndex = 0;
    } else if (element.tagName === "TEXTAREA") {
      element.value = "";
    }
  });
}
