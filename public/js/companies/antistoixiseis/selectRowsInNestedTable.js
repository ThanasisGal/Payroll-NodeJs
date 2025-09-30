// selectRowsInNestedTable.js
document.addEventListener('DOMContentLoaded', () => {
  // πιάνουμε το σταθερό table container
  const table = document.getElementById('myTable');
  if (!table) return;

  // Helpers για κουμπιά
  function setHref(id, href) {
    const el = document.getElementById(id);
    if (el) el.href = href;
  }
  function resetHrefs() {
    ['add-btn','edit-btn','delete-btn'].forEach(id => setHref(id, '#'));
    if (table.dataset) delete table.dataset.currentNestedId;
  }

  // Επιλογή σε nested row (ΜΟΝΟ όταν υπάρχει .collapse.show)
  table.addEventListener('click', (event) => {
    const nestedRow = event.target.closest('.collapse.show tbody tr[data-id]');
    if (!nestedRow || !table.contains(nestedRow)) return;

    // μη «ανέβει» στο main handler
    event.stopPropagation();

    const wasSelected = nestedRow.classList.contains('selected-row');
    table.querySelectorAll('.collapse.show .selected-row')
      .forEach(r => r.classList.remove('selected-row'));

    if (!wasSelected) {
      nestedRow.classList.add('selected-row');
      const nestedId = nestedRow.dataset.id;

      // Ρύθμιση κουμπιών για NESTED context
      setHref('add-btn',  `/companies/antistoixiseis/addFromNested/${nestedId}`);
      setHref('edit-btn', `/companies/antistoixiseis/edit/${nestedId}`);
      table.dataset.currentNestedId = nestedId; // για το DELETE
    } else {
      resetHrefs();
    }
  });

  // DELETE για NESTED (εδώ απλά κρατάμε τη συμπεριφορά – ο κώδικάς σου που κάνει Swal/CSRF κ.λπ. είναι σε άλλο αρχείο αν το προτιμάς)
  const deleteBtn = document.getElementById('delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      const nestedId = table.dataset.currentNestedId;
      if (!nestedId) return;

      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const deleteUrl = `/companies/antistoixiseis/deleteFromNested/${nestedId}`;

      const result = await Swal.fire({
        title: 'Είστε σίγουρος/η;',
        text: 'ΠΡΟΣΟΧΗ! Η ενέργεια δεν αναιρείται.',
        icon: 'error',
        showCancelButton: true,
        focusConfirm: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#3332049a',
        confirmButtonText: 'Διαγραφή',
        cancelButtonText: 'Ακύρωση',
        customClass: {
          confirmButton: 'class-error custom-confirm-button custom-swal-button',
          cancelButton:  'custom-cancel-button custom-swal-button',
        },
        didOpen: () => Swal.getCancelButton().focus(),
      });
      if (!result.isConfirmed) return;

      try {
        const resp = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': csrf,
            'Accept': 'application/json'
          },
          credentials: 'same-origin'
        });
        if (!resp.ok) throw new Error('Network response was not ok');
        const data = await resp.json();

        await Swal.fire({
          icon: 'success',
          title: 'Επιτυχής Διαγραφή της Αντιστοίχισης Κ.Π.Κ',
          timer: 3000,
          customClass: { confirmButton: 'class-success custom-confirm-button custom-swal-button' }
        });
        window.location.href = data.redirectUrl;
      } catch (error) {
        await Swal.fire({
          icon: 'error',
          title: 'Σφάλμα κατά τη Διαγραφή των Αντιστοιχίσεων Κ.Π.Κ.',
          html: 'Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>',
          timer: 4000,
          customClass: { confirmButton: 'class-normal custom-confirm-button custom-swal-button' }
        });
        window.location.href = '/companies/antistoixiseis';
      }
    });
  }
});
