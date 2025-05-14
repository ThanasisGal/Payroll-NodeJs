document.addEventListener("DOMContentLoaded", () => {
  // Αρχικοποίηση tooltips για στοιχεία εκτός του dropdown
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]:not(#add-btn)'));
  tooltipTriggerList.forEach(function (tooltipTriggerEl) {
    var maxWidth = tooltipTriggerEl.getAttribute('data-tooltip-max-width');
    var tooltip = new bootstrap.Tooltip(tooltipTriggerEl);

    tooltipTriggerEl.addEventListener('inserted.bs.tooltip', function () {
      var tooltipInner = document.querySelector('.tooltip .tooltip-inner');
      if (tooltipInner && maxWidth) {
        tooltipInner.style.maxWidth = maxWidth;
      }
    });

    // Προσθήκη event listener για το 'click' που κρύβει το tooltip
    tooltipTriggerEl.addEventListener('click', function () {
      tooltip.hide();
    });

    // Επιπλέον, όταν θέλω να κρύβω το tooltip όταν το στοιχείο χάνει το focus (π.χ., μετά από κλικ έξω από το κουμπί)
    tooltipTriggerEl.addEventListener('blur', function () {
      tooltip.hide();
    });
  
  });

  // Αρχικοποίηση tooltip για το κουμπί dropdown "Εισαγωγή"
  var addButton = document.getElementById('add-btn');
  if (addButton) {
    var maxWidth = addButton.getAttribute('data-tooltip-max-width');
    var title = addButton.getAttribute('title'); // Προσθήκη προκαθορισμένης τιμής
    if (title) { // Ελέγχει αν υπάρχει τίτλος
      var tooltip = new bootstrap.Tooltip(addButton, {
        title: title,
        placement: 'bottom',
      });
  
  
      addButton.addEventListener('inserted.bs.tooltip', function () {
        var tooltipInner = document.querySelector('.tooltip .tooltip-inner');
        if (tooltipInner && maxWidth) {
          tooltipInner.style.maxWidth = maxWidth;
        }
      });

      // Προσθήκη event listener για το κλικ στο κουμπί
      addButton.addEventListener('click', function () {
        tooltip.hide(); // Κρύβει το tooltip όταν γίνεται κλικ στο κουμπί
      });
    }
  }
});
