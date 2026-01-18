document.addEventListener('DOMContentLoaded', function() {
  var table = document.querySelector('#myTable');

  table.addEventListener('click', function(e) {
    var target = e.target;
    
    // Ελέγχουμε το στοιχείο target και όλους τους προγόνους του για τις κλάσεις 'edit', 'delete' ή 'cancel'
    while (target !== this && !(target.classList.contains('edit') || target.classList.contains('delete') || target.classList.contains('cancel'))) {
      target = target.parentNode; // Μετακίνηση στον πρόγονο
    }

    var row = target.closest('tr');
    var cells = row.querySelectorAll('td:not(:last-child)'); // Exclude the last column of buttons

    if (target.classList.contains('edit')) {
      // Καθιστά τα κελιά επεξεργάσιμα και αποθηκεύει τις τρέχουσες τιμές
      cells.forEach(function(cell) {
        cell.setAttribute('contenteditable', 'true');
        cell.setAttribute('data-original-content', cell.textContent);
        cell.style.color = ''; // Επιστροφή στο μαύρο χρώμα κειμένου αν είναι απαραίτητο
      });
      target.style.display = 'none';
      row.querySelector('.cancel').style.display = '';
    } else if (target.classList.contains('delete')) {
      // Κάνει τα κελιά κόκκινα και το κείμενο άσπρο
      cells.forEach(function(cell) {
        cell.style.backgroundColor = 'red';
        cell.style.color = 'white'; // Αλλαγή χρώματος κειμένου σε άσπρο
      });
      row.querySelector('.edit').style.display = 'none';
      row.querySelector('.cancel').style.display = '';
    } else if (target.classList.contains('cancel')) {
      // Επαναφέρει τα κελιά στην αρχική τους κατάσταση
      cells.forEach(function(cell) {
        if (cell.hasAttribute('contenteditable')) {
          // Επαναφέρει το κείμενο αν έχει επεξεργαστεί
          cell.textContent = cell.getAttribute('data-original-content');
          cell.removeAttribute('contenteditable');
          cell.removeAttribute('data-original-content');
        }
        // Επαναφέρει το χρώμα του κελιού και το κείμενο σε κανονική κατάσταση
        cell.style.backgroundColor = '';
        cell.style.color = ''; // Επιστροφή στο μαύρο χρώμα κειμένου
      });
      row.querySelector('.edit').style.display = '';
      target.style.display = 'none';
    }
  });
});
