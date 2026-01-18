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