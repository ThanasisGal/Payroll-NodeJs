function hideTable() {
  const myTableBody = document.querySelector("#myTable tbody");
  myTableBody.innerHTML = '';
}

var element1 = document.getElementById('clearSelect-001');
if (element1) {
  element1.addEventListener('click', function() {
    // Καθαρισμός τιμών
    document.getElementById('symbash') && (document.getElementById('symbash').value = '');
    document.getElementById('kathgoria_symbashs') && (document.getElementById('kathgoria_symbashs').value = '');
    document.getElementById('eidikothta_symbashs') && (document.getElementById('eidikothta_symbashs').value = '');

    // Απενεργοποίηση selects
    document.getElementById('kathgoria_symbashs') && (document.getElementById('kathgoria_symbashs').disabled = true);
    document.getElementById('eidikothta_symbashs') && (document.getElementById('eidikothta_symbashs').disabled = true);

    hideTable()
  });
}

var element2 = document.getElementById('clearSelect-002');
if (element2) {
  element2.addEventListener('click', function() {
    // Καθαρισμός τιμών
    document.getElementById('kathgoria_symbashs') && (document.getElementById('kathgoria_symbashs').value = '');
    document.getElementById('eidikothta_symbashs') && (document.getElementById('eidikothta_symbashs').value = '');

    // Απενεργοποίηση selects
    document.getElementById('eidikothta_symbashs') && (document.getElementById('eidikothta_symbashs').disabled = true);

    hideTable();
  });
}

var element3 = document.getElementById('clearSelect-003');
  if (element3) {
    element3.addEventListener('click', function() {
    // Καθαρισμός τιμών
    document.getElementById('eidikothta_symbashs') && (document.getElementById('eidikothta_symbashs').value = '');
    document.getElementById("add-btn").href = "#";

    hideTable();
  });
}

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
