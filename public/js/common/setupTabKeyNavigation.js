document.addEventListener('DOMContentLoaded', function() {
  // event listener για Tab και Shift + Tab
  const dateFields = document.querySelectorAll('.date-control');
  
  dateFields.forEach((field, index) => {
    field.addEventListener('keydown', function(event) {
      if (event.key === 'Tab') {
        event.preventDefault(); // Αποτροπή της default λειτουργίας

        if (event.shiftKey) {
          // Έλεγχος για Shift + Tab για μετάβαση στο προηγούμενο πεδίο
          const prevInput = dateFields[index - 1];
          if (prevInput) {
            prevInput.focus();
          }
        } else {
          // Κανονικό Tab για μετάβαση στο επόμενο πεδίο
          const nextInput = dateFields[index + 1];
          if (nextInput) {
            nextInput.focus();
          }
        }
      }
    });
  });
});