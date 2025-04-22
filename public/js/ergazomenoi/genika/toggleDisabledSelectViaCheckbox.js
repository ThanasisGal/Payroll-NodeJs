document.addEventListener('DOMContentLoaded', function () {
  const checkboxes = document.querySelectorAll('.checkbox-class');

  checkboxes.forEach(checkbox => {
    // Παίρνουμε τα IDs από τα data attributes
    const selectId = checkbox.getAttribute('data-related-select');
    const select1Id = checkbox.getAttribute('data-related-select1');
    const select2Id = checkbox.getAttribute('data-related-select2');
    const textId = checkbox.getAttribute('data-related-text');
    const dateId = checkbox.getAttribute('data-related-date');
    const date1Id = checkbox.getAttribute('data-related-date1');
    const date2Id = checkbox.getAttribute('data-related-date2');
    const number1Id = checkbox.getAttribute('data-related-number1');
    const number2Id = checkbox.getAttribute('data-related-number2');

    // Ελέγχουμε αν τα στοιχεία υπάρχουν πριν προσπαθήσουμε να τα αλλάξουμε
    const elements = {
      select: selectId ? document.getElementById(selectId) : null,
      select1: selectId ? document.getElementById(select1Id) : null,
      select2: selectId ? document.getElementById(select2Id) : null,
      text: textId ? document.getElementById(textId) : null,
      date: dateId ? document.getElementById(dateId) : null,
      date1: date1Id ? document.getElementById(date1Id) : null,
      date2: date2Id ? document.getElementById(date2Id) : null,
      number1: number1Id ? document.getElementById(number1Id) : null,
      number2: number2Id ? document.getElementById(number2Id) : null
    };

    // Συνάρτηση για την ενημέρωση της κατάστασης των στοιχείων
    function updateElements() {
      Object.keys(elements).forEach(key => {
        const element = elements[key];
        if (element) {
          element.disabled = !checkbox.checked;
          if (!checkbox.checked) {
            element.value = '';  // Καθαρίζουμε τις τιμές αν το checkbox δεν είναι επιλεγμένο
          }
        }
      });
    }

    checkbox.addEventListener('change', updateElements);

    // Αρχικοποίηση της κατάστασης των στοιχείων κατά τη φόρτωση της σελίδας
    updateElements();
  });
});
