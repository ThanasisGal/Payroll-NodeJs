document.addEventListener("DOMContentLoaded", (event) => {
  document.getElementById("clear-image").addEventListener("click", function () {
    var preview = document.getElementById("preview-image");
    var fileInput = document.getElementById("sfragida");
    var customButton = document.getElementById("customButton");

    // Καθαρίζει την προεπισκόπηση και το επιλεγμένο αρχείο
    preview.src = "";
    preview.style.display = "none";
    fileInput.value = "";
    // Επαναφέρει το κείμενο και το εικονίδιο στο προσαρμοσμένο κουμπί
    customButton.innerHTML = '<i class="bi bi-cloud-arrow-up"></i> Επιλέξτε Αρχείο';
  });
});
