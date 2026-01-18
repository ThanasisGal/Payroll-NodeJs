document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("sfragida")
    .addEventListener("change", function (e) {
      var preview = document.getElementById("preview-image");
      var file = e.target.files[0]; // Παίρνετε το πρώτο επιλεγμένο αρχείο

      if (file) {
        var reader = new FileReader();

        reader.onload = function (e) {
          preview.src = e.target.result;
          preview.style.display = "inline-block";
        };
 
        reader.readAsDataURL(file);
      }
    });
});
