document.addEventListener('DOMContentLoaded', function () {
  // Επιλογή όλων των input πεδίων
  const inputs = document.querySelectorAll('input[type="text"]');

  // Προσθήκη event listener σε κάθε input
  inputs.forEach(input => {
    input.addEventListener('blur', function () {
      let maxLength = this.maxLength;
      let currentValue = this.value;

      // Έλεγχος αν το πεδίο έχει attribute maxlength και το τρέχον μήκος της τιμής είναι μικρότερο από αυτό
      if (maxLength > 0 && currentValue.length < maxLength) {
        // Συμπλήρωση της τιμής με μηδενικά μέχρι το μέγιστο μήκος
        this.value = currentValue.padStart(maxLength, '0');
      }
    });
  });
});
