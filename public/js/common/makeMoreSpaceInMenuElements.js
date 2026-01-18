document.addEventListener("DOMContentLoaded", function () {
  // Επιλέγουμε τα συγκεκριμένα ζευγάρια στοιχείων
  const pairsToHandle = [
    { triggerId: "li224", targetId: "li23" },
    // Προσθήκη και αλλων ζευγαριών στοιχείων ανάλογα με τις ανάγκες της εφαρμογής
  ];

  // Προσθήκη event listeners σε κάθε ζευγάρι στοιχείων
  pairsToHandle.forEach(pair => {
    const triggerElement = document.getElementById(pair.triggerId);
    const targetElement = document.getElementById(pair.targetId);

    triggerElement.addEventListener("mouseenter", function() {
      targetElement.classList.add("mt-3");
    });

    triggerElement.addEventListener("mouseleave", function() {
      targetElement.classList.remove("mt-3");
    });
  });
});
