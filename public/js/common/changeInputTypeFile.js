document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("customButton")
    .addEventListener("click", function () {
      document.getElementById("sfragida").click();
    });

  document
    .getElementById("sfragida")
    .addEventListener("change", function () {
      const fileName = this.files[0] ? this.files[0].name : "";
      // Ενημέρωση του κειμένου του προσαρμοσμένου κουμπιού ή άλλου στοιχείου UI εδώ
      document.getElementById("customButton").textContent =
        fileName || "Επιλέξτε Αρχείο";
    });
});
