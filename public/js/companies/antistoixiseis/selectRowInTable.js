// selectRowInTable.js
document.addEventListener('DOMContentLoaded', () => {
  const table = document.getElementById('myTable');
  if (!table) return;

  // Αν το nestingTables.js έχει αναλάβει τα κουμπιά/footer (flag),
  // μην κάνεις ΤΙΠΟΤΑ σε αυτή τη σελίδα.
  if (window._nestedControlsFooter) return;

  // --- Διαφορετικά (σε άλλες σελίδες χωρίς nested), η παλιά συμπεριφορά: ---
  const addBtn    = document.getElementById('add-btn');
  const editBtn   = document.getElementById('edit-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const csrf      = document.querySelector('meta[name="csrf-token"]')?.content || '';

  let currentMainId = null;

  // Επιλογή ΚΥΡΙΑΣ γραμμής (αγνόησε nested collapses)
  table.addEventListener('click', (event) => {
    if (event.target.closest('.collapse')) return;

    const row = event.target.closest('tr[data-id]');
    if (!row || !table.contains(row)) return;

    currentMainId = row.dataset.id;

    if (addBtn)    addBtn.href   = `/companies/antistoixiseis/add/${currentMainId}`;
    if (editBtn)   editBtn.href  = `/companies/antistoixiseis/edit/${currentMainId}`;
    if (deleteBtn) deleteBtn.href = '#'; // delete με fetch
  });

  // Προαιρετικά: DELETE για ΚΥΡΙΑ εγγραφή (αν υπάρχει σε αυτή τη σελίδα)
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      if (!currentMainId) return;

      const deleteUrl = `/companies/antistoixiseis/delete/${currentMainId}`;

      const result = await Swal.fire({
        title: 'Είστε σίγουρος / η;',
        html:
          'ΠΡΟΣΟΧΗ!!! Θα διαγραφούν ΟΛΕΣ οι αντιστοιχίσεις Κ.Π.Κ. ' +
          '<mark>που αφορούν την κράτηση</mark> (<strong>για την συγκεκριμένη εταιρεία</strong>) ' +
          'και δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια!',
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
        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': csrf,
            'Accept': 'application/json'
          },
          credentials: 'same-origin'
        });

        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        await Swal.fire({
          icon: 'success',
          title: 'Επιτυχής Διαγραφή των Αντιστοιχίσεων Κ.Π.Κ.',
          timer: 3000,
          confirmButtonText: 'Κλείσιμο',
          customClass: { confirmButton: 'class-success custom-confirm-button custom-swal-button' },
        });

        window.location.href = data.redirectUrl;
      } catch (error) {
        await Swal.fire({
          icon: 'error',
          title: 'Σφάλμα κατά τη Διαγραφή των Αντιστοιχίσεων Κ.Π.Κ.',
          html: 'Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>',
          timer: 3000,
          confirmButtonText: 'Κλείσιμο',
          customClass: { confirmButton: 'class-normal custom-confirm-button custom-swal-button' },
        });
        window.location.href = '/companies/antistoixiseis';
      }
    });
  }
});
