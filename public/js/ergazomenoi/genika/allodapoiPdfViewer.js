// public/js/ergazomenoi/genika/allodapoiPdfViewer.js;

(function () {
    'use strict';

    // ------------------------------------------------------------------
    // Helper: κρύβει global loader (δοκιμάζει διάφορους τρόπους)
    // ------------------------------------------------------------------
    function hideGlobalLoader() {
        try {
            // Προτεραιότητα: αν έχεις συγκεκριμένο API
            if (window.AppLoader && typeof window.AppLoader.hide === 'function') {
                window.AppLoader.hide();
                return;
            }
            if (typeof window.hideLoader === 'function') {
                window.hideLoader();
                return;
            }
            // SweetAlert2 common case
            if (window.Swal && typeof window.Swal.close === 'function') {
                window.Swal.close();
                return;
            }
            // Generic DOM fallbacks
            const sel = [
                '.pdf-generation-progress',
                '.global-loader',
                '.swal2-container',
                '#globalLoader',
                '.loader-overlay'
            ].join(',');
            const el = document.querySelector(sel);
            if (el) {
                // Αφαίρεση ή κρυφή εμφάνιση
                el.style.display = 'none';
            }
        } catch (e) {
            // δεν κάνουμε throw
            // eslint-disable-next-line no-console
            console.warn('hideGlobalLoader error', e);
        }
    }

    // ------------------------------------------------------------------
    // Post message helpers
    // ------------------------------------------------------------------
    function postToOpener(msg) {
        try {
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage(msg, '*'); // αν θέλεις, βάλε συγκεκριμένο origin
            }
        } catch (e) {
            // ignore
        }
    }

    function handleIncomingMessage(ev) {
        // Αν χρειάζεται, ελέγχεις ev.origin για ασφάλεια
        const msg = ev?.data || {};
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'pdf-viewer:loaded' || msg.type === 'pdf-viewer:closed') {
            hideGlobalLoader();
        }
    }

    // ------------------------------------------------------------------
    // DOMContentLoaded main
    // ------------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', () => {
        // 1) Opener logic: intercept click σε όλα τα links με data-pdf-viewer-link="true"
        document.querySelectorAll('[data-pdf-viewer-link="true"]').forEach((el) => {
            el.addEventListener('click', (ev) => {
                ev.preventDefault();

                // πάρτε href (fallback σε data-existing-pdf-url αν χρησιμοποιείς attribute)
                const href =
                    el.getAttribute('href') ||
                    el.dataset.existingPdfUrl ||
                    el.dataset.existingPdfUrl;
                if (!href) {
                    // eslint-disable-next-line no-console
                    console.error('Δεν βρέθηκε URL για προβολή PDF.');
                    return;
                }

                // Κρύβουμε loader αμέσως (πολλές εφαρμογές έχουν loader object)
                hideGlobalLoader();

                // Ανοίγουμε script-opened tab (window.open) — επιτρέπει μετά το window.close()
                const win = window.open(href, '_blank');

                if (!win) {
                    // Popup blocked ή failure => fallback: ανοίγουμε στο ίδιο tab
                    window.location.href = href;
                }
            });
        });

        // 2) Viewer-side logic: αν βρισκόμαστε στη viewer page (έλεγχος για στοιχεία)
        const iframe = document.querySelector('.pdf-frame');
        const closeBtn = document.getElementById('closePdfTab');
        const closeWarning = document.getElementById('closeWarning');
        const deleteAllodapoiBtn = document.getElementById('deleteButton_allodapoi');

        if (deleteAllodapoiBtn) {
            deleteAllodapoiBtn.addEventListener('click', async () => {
                const ergazomenosId = deleteAllodapoiBtn.dataset.ergazomenosId;

                if (!ergazomenosId) {
                    alert('Δεν βρέθηκε ID εργαζόμενου.');
                    return;
                }

                const confirmed = window.Swal
                    ? await Swal.fire({
                          icon: 'warning',
                          title: 'Διαγραφή PDF',
                          text: 'Θέλετε σίγουρα να διαγραφεί το υπάρχον PDF;',
                          showCancelButton: true,
                          confirmButtonText: 'Ναι, διαγραφή',
                          cancelButtonText: 'Άκυρο'
                      })
                    : { isConfirmed: confirm('Θέλετε σίγουρα να διαγραφεί το υπάρχον PDF;') };

                if (!confirmed.isConfirmed) return;

                try {
                    const response = await fetch(
                        `/api/ergazomenoi/${ergazomenosId}/documents/allodapoi`,
                        {
                            method: 'DELETE',
                            headers: {
                                Accept: 'application/json'
                            }
                        }
                    );

                    const payload = await response.json();

                    if (!response.ok || !payload.success) {
                        throw new Error(payload.message || 'Αποτυχία διαγραφής PDF.');
                    }

                    if (window.Swal) {
                        await Swal.fire({
                            icon: 'success',
                            title: 'Ολοκληρώθηκε',
                            text: payload.message || 'Το PDF διαγράφηκε επιτυχώς.',
                            confirmButtonText: 'OK'
                        });
                    }

                    window.location.reload();
                } catch (error) {
                    console.error(error);

                    if (window.Swal) {
                        await Swal.fire({
                            icon: 'error',
                            title: 'Σφάλμα',
                            text: error.message || 'Σφάλμα κατά τη διαγραφή του PDF.',
                            confirmButtonText: 'OK'
                        });
                    } else {
                        alert(error.message || 'Σφάλμα κατά τη διαγραφή του PDF.');
                    }
                }
            });
        }

        if (iframe) {
            // Όταν το iframe φορτώσει, στέλνουμε μήνυμα στον opener για να κλείσει loader
            iframe.addEventListener('load', () => {
                // Ενημέρωση opener (αν υπάρχει)
                postToOpener({ type: 'pdf-viewer:loaded' });
                // Επίσης κρύβουμε το τοπικό loader αν υπάρχει
                hideGlobalLoader();
            });

            // Σε περίπτωση που το PDF χρειάζεται redirect/long-loading, μπορείς να δοκιμάσεις polling
            // ή να παρακολουθήσεις το onload του document του iframe αλλά αυτό περιορίζεται
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                // Ενημερώνουμε opener πριν το κλείσιμο (για cleanup)
                postToOpener({ type: 'pdf-viewer:closed' });

                // Προσπάθεια κλεισίματος
                window.close();

                // fallback: αν δεν έκλεισε άμεσα, εμφανίζουμε μικρό μήνυμα
                setTimeout(() => {
                    if (!window.closed && closeWarning) {
                        closeWarning.style.display = 'block';
                    }
                }, 250);
            });
        }

        // 3) Opener: ακούμε μηνύματα από viewer (αν το ίδιο script φορτώνεται και στο opener)
        // Αυτό θα κλείσει loader αν ο viewer στείλει μήνυμα (π.χ. iframe loaded)
        window.addEventListener('message', handleIncomingMessage, false);
    });

    // Clean-up on pagehide (προαιρετικό)
    window.addEventListener('pagehide', () => {
        try {
            window.removeEventListener('message', handleIncomingMessage);
        } catch (e) {}
    }, { once: true });
})();
