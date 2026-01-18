async function clearValueFields() {
  // Καθαρίζουμε όλα τα άλλα πεδία με id που ξεκινά από 'value'
  const valueFields = document.querySelectorAll("[id^='value']");
  valueFields.forEach((element) => {
    if (element.classList.contains("notCleared")) {
      return; // Παράκαμψη του συγκεκριμένου στοιχείου αν έχει την κλάση notCleared
    }

    // Επαναφέρουμε το περιεχόμενο σε κενό
    if (element.tagName === "DIV" || element.tagName === "SPAN" || element.tagName === "P") {
      element.textContent = ""; // Καθαρισμός κειμένου
    } else {
      element.value = ""; // Για άλλα πεδία που έχουν value
    }
  });
}