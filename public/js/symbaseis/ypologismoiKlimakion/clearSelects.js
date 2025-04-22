function hideStoixeiaSymbaseon() {
  for (let i = 1; i <= 15; i++) {
    const fieldName = `stoixeio_symbashs_${i.toString().padStart(2, '0')}`;
    const fieldRow = `showhide_row_${i.toString().padStart(2, '0')}`;
    const fieldElement = document.getElementById(fieldName);
    const fieldElementRow = document.querySelector('.' + fieldRow);
    if (fieldElement) {
      fieldElement.value = '';
    }
    if (fieldElementRow) {
      fieldElementRow.classList.add('d-none');
    }
  }
}

document.getElementById('clearSelectSymbaseon-001').addEventListener('click', function() {
  // Καθαρισμός τιμών
  document.getElementById('symbash').value = '';
  document.getElementById('kathgoria_symbashs').value = '';
  document.getElementById('eidikothta_symbashs').value = '';

  // Απενεργοποίηση selects
  document.getElementById('kathgoria_symbashs').disabled = true;
  document.getElementById('eidikothta_symbashs').disabled = true;

  hideStoixeiaSymbaseon()
});

document.getElementById('clearSelectSymbaseon-002').addEventListener('click', function() {
  // Καθαρισμός τιμών
  document.getElementById('kathgoria_symbashs').value = '';
  document.getElementById('eidikothta_symbashs').value = '';

  // Απενεργοποίηση selects
  document.getElementById('eidikothta_symbashs').disabled = true;

  hideStoixeiaSymbaseon()
});

document.getElementById('clearSelectSymbaseon-003').addEventListener('click', function() {
  // Καθαρισμός τιμών
  document.getElementById('eidikothta_symbashs').value = '';

  hideStoixeiaSymbaseon()
});

// Προσθήκη event listener σε όλα τα κουμπιά καθαρισμού
document.querySelectorAll('.clearSelect').forEach(button => {
  button.addEventListener('click', function() {
    const targetSelectId = this.getAttribute('data-target'); // Παίρνουμε το ID του target select από το attribute data-target
    const selectElement = document.getElementById(targetSelectId);
    if (selectElement) {
      selectElement.value = '';
    }
  });
});
