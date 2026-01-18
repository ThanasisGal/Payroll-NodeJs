document.addEventListener("DOMContentLoaded", function() {
  // Επιλέγουμε το input πεδίο όπου ο χρήστης θα πατήσει Enter
  const searchInput = document.getElementById("searchInput");

  // Προσθέτουμε event listener για το "keydown" event
  searchInput.addEventListener("keydown", function(event) {
      // Ελέγχουμε αν το πλήκτρο που πατήθηκε είναι το Enter
      if (event.key === "Enter") {
          event.preventDefault(); // Αποτρέπουμε την προεπιλεγμένη λειτουργία

          // Επιλέγουμε τη φόρμα
          const form = document.querySelector("form[name='SearchForm']");

          // Υποβάλλουμε τη φόρμα
          form.submit();
      }
  });
});