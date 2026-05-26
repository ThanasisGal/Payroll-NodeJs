document.addEventListener('DOMContentLoaded', function () {
    let currentSelectedId = null; // Κρατά το ID της επιλεγμένης γραμμής

    document.getElementById('myTable').addEventListener('click', function (event) {
        if (event.target.closest('.collapse')) return;

        const clickedNestingButton = event.target.closest('.btn-nesting');

        const targetRow = event.target.closest('tr[data-id]');
        if (!targetRow) return;

        const nestingButton = targetRow.querySelector('.btn-nesting');
        const wasSelected = targetRow.classList.contains('selected-row');

        if (!clickedNestingButton && nestingButton) {
            nestingButton.click();
        }

        document
            .querySelectorAll('#myTable > tbody > tr.selected-row')
            .forEach((row) => row.classList.remove('selected-row'));

        if (wasSelected) {
            currentSelectedId = null;

            document.getElementById('edit-btn').href = '#';
            document.getElementById('edit-btn').innerHTML =
                `<i class="buttons-content bi bi-pencil-square"></i> Συντήρηση`;

            document.getElementById('delete-btn').href = '#';
            document.getElementById('delete-btn').innerHTML =
                `<i class="buttons-content bi bi-trash"></i> Διαγραφή`;

            return;
        }

        targetRow.classList.add('selected-row');
        currentSelectedId = targetRow.dataset.id;

        document.getElementById('edit-btn').href = `/krathseis/genika/edit/${currentSelectedId}`;

        document.getElementById('edit-btn').innerHTML =
            `<i class="buttons-content bi bi-pencil-square"></i> Συντήρηση Κράτησης`;

        adjustFontSizeToFit('edit-btn', 15);

        document.getElementById('delete-btn').innerHTML =
            `<i class="buttons-content bi bi-trash"></i> Διαγραφή Κράτησης`;

        adjustFontSizeToFit('delete-btn', 15);
    });

    document.getElementById('delete-btn').addEventListener('click', async function (event) {
        event.preventDefault();
        if (!currentSelectedId) {
            return; // Εμφάνιση μηνύματος ή επιστροφή
        }
        console.log(currentSelectedId);
        const deleteUrl = `/krathseis/genika/delete/${currentSelectedId}`;

        const result = await Swal.fire({
            title: 'Είστε σίγουρος / η;',
            html: `ΠΡΟΣΟΧΗ!!! Δεν θα μπορείτε να αναιρέσετε αυτή την ενέργεια!  Θα διαγραφεί επίσης και όλο το ιστορικό των Ποσοστών των Κρατήσεων και υπάρχει <strong>μεγάλη πιθανότητα</strong> μη καλής λειτουργίας της εφαρμογής...`,
            icon: 'error',
            showCancelButton: true,
            focusConfirm: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#3332049a',
            confirmButtonText: 'Διαγραφή',
            cancelButtonText: 'Ακύρωση',
            customClass: {
                confirmButton: 'class-error custom-confirm-button custom-swal-button',
                cancelButton: 'custom-cancel-button custom-swal-button'
            },
            didOpen: () => {
                // Εστιάζει στο κουμπί "Ακύρωση" μετά το άνοιγμα του SweetAlert
                Swal.getCancelButton().focus();
            }
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const data = await response.json();
                Swal.fire({
                    icon: 'success',
                    title: 'Επιτυχής Διαγραφή της Κράτησης',
                    timer: 3000,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        confirmButton: 'class-success custom-confirm-button custom-swal-button'
                    },
                    willClose: () => {
                        window.location.href = data.redirectUrl; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
                    }
                });
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Σφάλμα κατά τη Διαγραφή της Κράτησης',
                    text: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>`,
                    timer: 3000,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        confirmButton: 'class-normal custom-confirm-button custom-swal-button'
                    },
                    willClose: () => {
                        window.location.href = '/krathseis/krathseis'; // Ανακατεύθυνση μετά το κλείσιμο του SweetAlert
                    }
                });
            }
        }
    });
});
