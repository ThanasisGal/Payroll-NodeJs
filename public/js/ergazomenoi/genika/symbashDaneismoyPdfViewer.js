// public/js/ergazomenoi/genika/symbashDaneismoyPdfViewer.js

(function () {
    'use strict';

    function hideGlobalLoader() {
        try {
            if (window.AppLoader && typeof window.AppLoader.hide === 'function') {
                window.AppLoader.hide();
                return;
            }

            if (typeof window.hideLoader === 'function') {
                window.hideLoader();
                return;
            }

            if (window.Swal && typeof window.Swal.close === 'function') {
                window.Swal.close();
                return;
            }

            const el = document.querySelector(
                '.pdf-generation-progress, .global-loader, .swal2-container, #globalLoader, .loader-overlay'
            );

            if (el) {
                el.style.display = 'none';
            }
        } catch (error) {
            console.warn('hideGlobalLoader error', error);
        }
    }

    function postToOpener(msg) {
        try {
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage(msg, '*');
            }
        } catch (error) {
            // ignore
        }
    }

    function handleIncomingMessage(event) {
        const msg = event?.data || {};

        if (!msg || typeof msg !== 'object') return;

        if (
            msg.type === 'symbash-daneismoy-pdf-viewer:loaded' ||
            msg.type === 'symbash-daneismoy-pdf-viewer:closed'
        ) {
            hideGlobalLoader();
        }
    }

    async function confirmDelete() {
        if (window.Swal) {
            return Swal.fire({
                icon: 'warning',
                title: 'Διαγραφή PDF',
                text: 'Θέλετε σίγουρα να διαγραφεί το PDF σύμβασης δανεισμού;',
                showCancelButton: true,
                confirmButtonText: 'Ναι, διαγραφή',
                cancelButtonText: 'Άκυρο'
            });
        }

        return {
            isConfirmed: window.confirm('Θέλετε σίγουρα να διαγραφεί το PDF σύμβασης δανεισμού;')
        };
    }

    async function showSuccess(message) {
        if (window.Swal) {
            await Swal.fire({
                icon: 'success',
                title: 'Ολοκληρώθηκε',
                text: message || 'Το PDF διαγράφηκε επιτυχώς.',
                confirmButtonText: 'OK'
            });
        }
    }

    async function showError(message) {
        if (window.Swal) {
            await Swal.fire({
                icon: 'error',
                title: 'Σφάλμα',
                text: message || 'Σφάλμα κατά τη διαγραφή του PDF.',
                confirmButtonText: 'OK'
            });
            return;
        }

        alert(message || 'Σφάλμα κατά τη διαγραφή του PDF.');
    }

    function setupPdfViewerLink() {
        const symbashDaneismoyPdfLink = document.querySelector(
            '[data-symbash-daneismoy-pdf-viewer-link="true"]'
        );

        if (!symbashDaneismoyPdfLink) return;

        symbashDaneismoyPdfLink.addEventListener('click', (event) => {
            event.preventDefault();

            const href = symbashDaneismoyPdfLink.getAttribute('href');

            if (!href) {
                console.error('Δεν βρέθηκε URL για προβολή PDF σύμβασης δανεισμού.');
                return;
            }

            hideGlobalLoader();

            const win = window.open(href, '_blank');

            if (!win) {
                window.location.href = href;
            }
        });
    }

    function setupDeleteButton() {
        const deleteSymbashDaneismoyBtn = document.getElementById('deleteButton_symbash_daneismoy');

        if (!deleteSymbashDaneismoyBtn) return;

        deleteSymbashDaneismoyBtn.addEventListener('click', async () => {
            const ergazomenosId = deleteSymbashDaneismoyBtn.dataset.ergazomenosId;

            if (!ergazomenosId) {
                await showError('Δεν βρέθηκε ID εργαζόμενου.');
                return;
            }

            const confirmed = await confirmDelete();

            if (!confirmed.isConfirmed) return;

            try {
                const response = await fetch(
                    `/api/ergazomenoi/${ergazomenosId}/documents/symbash-daneismoy`,
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

                await showSuccess(payload.message);

                window.location.reload();
            } catch (error) {
                console.error(error);
                await showError(error.message);
            }
        });
    }

    function setupViewerPage() {
        const iframe = document.querySelector('.pdf-frame');
        const closeBtn = document.getElementById('closePdfTab');
        const closeWarning = document.getElementById('closeWarning');

        if (iframe) {
            iframe.addEventListener('load', () => {
                postToOpener({ type: 'symbash-daneismoy-pdf-viewer:loaded' });
                hideGlobalLoader();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                postToOpener({ type: 'symbash-daneismoy-pdf-viewer:closed' });

                window.close();

                setTimeout(() => {
                    if (!window.closed && closeWarning) {
                        closeWarning.style.display = 'block';
                    }
                }, 250);
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupPdfViewerLink();
        setupDeleteButton();
        setupViewerPage();

        window.addEventListener('message', handleIncomingMessage, false);
    });

    window.addEventListener('pagehide', () => {
        try {
            window.removeEventListener('message', handleIncomingMessage);
        } catch (error) {
            // ignore
        }
    }, { once: true });
})();
