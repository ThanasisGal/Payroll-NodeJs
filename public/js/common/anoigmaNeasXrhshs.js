// public/js/admin/anoigmaNeasXrhshs.js
(() => {
    'use strict';

    // ------------------------------------------------------------------ //
    // Helpers — ίδιο pattern με το υπόλοιπο codebase
    // ------------------------------------------------------------------ //
    const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

    // ------------------------------------------------------------------ //
    // Handler
    // ------------------------------------------------------------------ //
    async function handleAnoigmaNeasXrhshs(e) {
        e.preventDefault();

        // ✅ SweetAlert confirm — ίδιο pattern με το υπόλοιπο codebase
        const result = await Swal.fire({
            backdrop: true,
            allowOutsideClick: false,
            title: 'Άνοιγμα Νέας Χρήσης',
            html: 'Είστε σίγουρος ότι θέλετε να δημιουργήσετε τα αρχεία για τη νέα χρήση;<br><br><b>Η ενέργεια δεν μπορεί να αναιρεθεί.</b>',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Δημιουργία',
            cancelButtonText: 'Ακύρωση',
            customClass: {
                title: 'custom-title',
                popup: 'custom-swal-popup',
                confirmButton: 'class-danger custom-confirm-button custom-swal-button',
                cancelButton: 'class-secondary custom-cancel-button custom-swal-button'
            }
        });

        if (!result.isConfirmed) return;

        // ✅ Εμφάνιση loader
        Swal.fire({
            backdrop: true,
            allowOutsideClick: false,
            title: 'Παρακαλώ περιμένετε...',
            html: 'Δημιουργία αρχείων νέας χρήσης...',
            icon: 'info',
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const token = csrfToken();

            if (!token) {
                Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    title: 'Σφάλμα ασφαλείας',
                    html: 'Δεν βρέθηκε το CSRF token. Παρακαλώ ανανεώστε τη σελίδα.',
                    icon: 'error',
                    showConfirmButton: true,
                    confirmButtonText: 'Κλείσιμο'
                });
                return;
            }

            // ✅ fetch — ίδιο pattern με το υπόλοιπο codebase
            const res = await fetch('/admin/dhmioyrgia-arxeion-neas-xrhshs', {
                method: 'POST',
                credentials: 'same-origin', // στέλνει session cookie
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': token, // ✅ CSRF header
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json',
                    'Cache-Control': 'no-store'
                }
            });

            const data = await res.json();

            if (res.ok) {
                // ✅ HTTP 200 — Επιτυχία
                Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    title: 'Επιτυχία!',
                    html: data.message || 'Τα αρχεία δημιουργήθηκαν επιτυχώς.',
                    icon: 'success',
                    showConfirmButton: true,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        title: 'custom-title',
                        popup: 'custom-swal-popup',
                        confirmButton: 'class-success custom-confirm-button custom-swal-button'
                    }
                });
            } else if (res.status === 409) {
                // ✅ HTTP 409 — Υπάρχουν ήδη εγγραφές
                Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    title: 'Ήδη υπάρχουν εγγραφές',
                    html: data.message || 'Υπάρχουν ήδη εγγραφές για αυτή τη χρήση.',
                    icon: 'warning',
                    showConfirmButton: true,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        title: 'custom-title',
                        popup: 'custom-swal-popup',
                        confirmButton: 'class-warning custom-confirm-button custom-swal-button'
                    }
                });
            } else {
                // ✅ HTTP 400, 404, 500 κ.λπ.
                Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    title: 'Σφάλμα',
                    html: data.message || 'Παρουσιάστηκε σφάλμα. Παρακαλώ δοκιμάστε ξανά.',
                    icon: 'error',
                    showConfirmButton: true,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        title: 'custom-title',
                        popup: 'custom-swal-popup',
                        confirmButton: 'class-danger custom-confirm-button custom-swal-button'
                    }
                });
            }
        } catch (err) {
            // ✅ Network error
            Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                title: 'Σφάλμα Δικτύου',
                html: 'Δεν ήταν δυνατή η επικοινωνία με τον server. Ελέγξτε τη σύνδεσή σας.',
                icon: 'error',
                showConfirmButton: true,
                confirmButtonText: 'Κλείσιμο',
                customClass: {
                    title: 'custom-title',
                    popup: 'custom-swal-popup',
                    confirmButton: 'class-danger custom-confirm-button custom-swal-button'
                }
            });
        }
    }

    // ------------------------------------------------------------------ //
    // Init — addEventListener (CSP-safe, χωρίς inline handlers)
    // ------------------------------------------------------------------ //
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('btn-anoigma-neas-xrhshs');
        if (!btn) return;

        btn.addEventListener('click', handleAnoigmaNeasXrhshs);
    });
})();
