document.addEventListener("DOMContentLoaded", () => {
  // Προσθήκη event listener σε όλα τα input και select πεδία μέσα σε κάθε φόρμα
  document.querySelectorAll("section form").forEach((form) => {
    form.querySelectorAll("input, select").forEach((element) => {
      element.addEventListener("keypress", function (e) {
        if (e.key === "Enter" && !this.classList.contains("use-default-enter")) {
          e.preventDefault(); // Αποτροπή της προεπιλεγμένης λειτουργίας

          let allElements = Array.from(form.querySelectorAll("input, select"))
            .filter(el => !el.disabled && el.style.display !== "none");
          let sortedElements = allElements.sort((a, b) => a.tabIndex - b.tabIndex);
          let currentIndex = sortedElements.findIndex(el => el === this);
          let nextElement = sortedElements[currentIndex + 1] || sortedElements[0];

          if (nextElement) {
            nextElement.focus(); // Μετακίνηση της εστίασης στο επόμενο ενεργό πεδίο ή πίσω στο πρώτο
          }
        }
      });
    });
  });
});

