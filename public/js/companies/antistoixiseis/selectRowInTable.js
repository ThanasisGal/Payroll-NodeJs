// document.addEventListener('DOMContentLoaded', () => {
//   let currentSelectedId = null;

//   const table    = document.getElementById('myTable');
//   const addBtn   = document.getElementById('add-btn');
//   const editBtn  = document.getElementById('edit-btn');
//   const deleteBtn= document.getElementById('delete-btn');
//   const csrf     = document.querySelector('meta[name="csrf-token"]')?.content || '';

//   // Delegation: click σε κύρια γραμμή
//   table.addEventListener('click', (event) => {
//     const row = event.target.closest('tr[data-id]');
//     if (!row || !table.contains(row)) return;

//     const icon = row.querySelector('.btn-nesting i');
//     const wasSelected = row.classList.contains('selected-row');

//     // καθάρισε προηγούμενα selections + γύρνα τα icons σε down
//     table.querySelectorAll('tr.selected-row').forEach(r => {
//       r.classList.remove('selected-row');
//       const i = r.querySelector('.btn-nesting i');
//       if (i) { i.classList.remove('bi-chevron-up'); i.classList.add('bi-chevron-down'); }
//     });

//     if (!wasSelected) {
//       row.classList.add('selected-row');
//       currentSelectedId = row.dataset.id;

//       if (icon) { icon.classList.remove('bi-chevron-down'); icon.classList.add('bi-chevron-up'); }

//       if (addBtn)   addBtn.href   = `/companies/antistoixiseis/add/${currentSelectedId}`;
//       if (editBtn)  editBtn.href  = `/companies/antistoixiseis/edit/${currentSelectedId}`;
//       if (deleteBtn) deleteBtn.href = '#'; // handled via JS
//     } else {
//       currentSelectedId = null;

//       if (icon) { icon.classList.remove('bi-chevron-up'); icon.classList.add('bi-chevron-down'); }

//       if (addBtn)   addBtn.href   = '#';
//       if (editBtn)  editBtn.href  = '#';
//       if (deleteBtn) deleteBtn.href = '#';
//     }
//   });

//   // DELETE με CSRF + same-origin cookies
//   if (deleteBtn) {
//     deleteBtn.addEventListener('click', async (event) => {
//       event.preventDefault();
//       if (!currentSelectedId) return;

//       const deleteUrl = `/companies/antistoixiseis/delete/${currentSelectedId}`;

//       const result = await Swal.fire({
//         title: 'Είστε σίγουρος / η;',
//         html:
//           'ΠΡΟΣΟΧΗ!!! Θα διαγραφούν ΟΛΕΣ οι αντιστοιχίσεις Κ.Π.Κ. ' +
//           '<mark>που αφορούν την κράτηση</mark> (<strong>για την συγκεκριμένη εταιρεία</strong>) ' +
//           'και δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια!',
//         icon: 'error',
//         showCancelButton: true,
//         focusConfirm: true,
//         confirmButtonColor: '#3085d6',
//         cancelButtonColor: '#3332049a',
//         confirmButtonText: 'Διαγραφή',
//         cancelButtonText: 'Ακύρωση',
//         customClass: {
//           confirmButton: 'class-error custom-confirm-button custom-swal-button',
//           cancelButton:  'custom-cancel-button custom-swal-button',
//         },
//         didOpen: () => Swal.getCancelButton().focus(),
//       });
//       if (!result.isConfirmed) return;

//       try {
//         const response = await fetch(deleteUrl, {
//           method: 'DELETE',
//           headers: {
//             'X-CSRF-Token': csrf,
//             'Accept': 'application/json'
//           },
//           credentials: 'same-origin'
//         });

//         if (!response.ok) throw new Error('Network response was not ok');
//         const data = await response.json();

//         await Swal.fire({
//           icon: 'success',
//           title: 'Επιτυχής Διαγραφή των Αντιστοίχισεων Κ.Π.Κ.',
//           timer: 3000,
//           confirmButtonText: 'Κλείσιμο',
//           customClass: { confirmButton: 'class-success custom-confirm-button custom-swal-button' },
//         });
//         window.location.href = data.redirectUrl;
//       } catch (error) {
//         await Swal.fire({
//           icon: 'error',
//           title: 'Σφάλμα κατά τη Διαγραφή των Αντιστοιχίσεων Κ.Π.Κ.',
//           html: 'Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>',
//           timer: 3000,
//           confirmButtonText: 'Κλείσιμο',
//           customClass: { confirmButton: 'class-normal custom-confirm-button custom-swal-button' },
//         });
//         window.location.href = '/companies/antistoixiseis';
//       }
//     });
//   }
// });


// selectRowInTable.js
// Κάνει επιλογή ΚΥΡΙΑΣ γραμμής μόνο για τα κουμπιά (add/edit/delete κύριας)
// Δεν ανοίγει/κλείνει nested, δεν αλλάζει icons/classes — αυτά τα χειρίζεται το nestingTables.js.

document.addEventListener('DOMContentLoaded', () => {
  const table     = document.getElementById('myTable');
  const addBtn    = document.getElementById('add-btn');
  const editBtn   = document.getElementById('edit-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const csrf      = document.querySelector('meta[name="csrf-token"]')?.content || '';

  if (!table) return;

  let currentMainId = null; // η τελευταία κύρια γραμμή που κλικάραμε (ΟΧΙ nested)

  // -----------------------------
  // Επιλογή ΚΥΡΙΑΣ γραμμής (για κουμπιά)
  // -----------------------------
  table.addEventListener('click', (event) => {
    // αν το κλικ ξεκίνησε μέσα σε ανοιχτό nested, ΜΗΝ τρέχει αυτός ο handler
    if (event.target.closest('.collapse')) return;

    const row = event.target.closest('tr[data-id]');
    if (!row || !table.contains(row)) return;

    currentMainId = row.dataset.id;

    // Ρύθμιση κουμπιών για ΚΥΡΙΑ εγγραφή (add/edit). Το delete το χειριζόμαστε ξεχωριστά.
    if (addBtn)   addBtn.href   = `/companies/antistoixiseis/add/${currentMainId}`;
    if (editBtn)  editBtn.href  = `/companies/antistoixiseis/edit/${currentMainId}`;
    if (deleteBtn) deleteBtn.href = '#'; // το DELETE γίνεται μέσω fetch (βλ. παρακάτω)

    // ΣΗΜΑΝΤΙΚΟ: δεν αλλάζουμε classes (selected-row/active-row) ούτε τα icons εδώ,
    // για να μην συγκρουστούμε με το nestingTables.js που ανοίγει/κλείνει τον nested.
  });

  // -----------------------------
  // DELETE για ΚΥΡΙΑ εγγραφή (με CSRF)
  // -----------------------------
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async (event) => {
      event.preventDefault();

      // αν δεν έχεις επιλέξει ΚΥΡΙΑ εγγραφή, δεν κάνουμε τίποτα
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
            'X-CSRF-Token': csrf,      // CSRF token από <meta>
            'Accept': 'application/json'
          },
          credentials: 'same-origin'   // στέλνει τα session cookies μόνο στο ίδιο origin
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

        // Ανακατεύθυνση όπου ορίζει ο server
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
