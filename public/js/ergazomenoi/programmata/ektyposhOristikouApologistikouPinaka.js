(function initFinalWtoSubmittedDocumentPage(global) {
    'use strict';

    const ENDPOINT =
        '/api/prodhlomena-oraria/review/period-control/submission/final/document';
    const PROCESS_DESCRIPTION =
        'Οργάνωση Χρόνου Εργασίας - Απολογιστικός Πίνακας Ωραρίων';
    const NOT_FOUND_MESSAGE =
        'Δεν βρέθηκε οριστικά υποβλημένος Απολογιστικός Πίνακας για την επιλεγμένη περίοδο και το παράρτημα.';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function userMessageHtml(message, code, steps) {
        const stepItems = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
        return `
            <p>${escapeHtml(message)}</p>
            <p>Η εφαρμογή σταμάτησε χωρίς να δημιουργήσει νέα υποβολή.</p>
            <p><strong>Τι να κάνετε:</strong></p>
            <ol>${stepItems}</ol>
            <p>Δεν έγινε νέα υποβολή και δεν άλλαξαν δεδομένα.</p>
            <small>Κωδικός αναφοράς: ${escapeHtml(code)}</small>
        `;
    }

    async function showError({ title, message, code, steps }) {
        return global.ErganiFormsSwal.fire({
            icon: 'error',
            title,
            html: userMessageHtml(message, code, steps),
            confirmButtonText: 'Κλείσιμο'
        });
    }

    function fieldValue(id) {
        return String(global.document.getElementById(id)?.value || '').trim();
    }

    function validateCriteria() {
        const periodStart = fieldValue('apo_hmeromhnia');
        const periodEnd = fieldValue('eos_hmeromhnia');
        const branch = fieldValue('ypokatasthma_stathera_advanced');
        if (!periodStart || !periodEnd) {
            return {
                error: 'Συμπληρώστε και τις δύο ημερομηνίες της περιόδου.',
                code: 'FINAL_WTODAILY_DOCUMENT_DATES_REQUIRED'
            };
        }
        if (periodStart > periodEnd) {
            return {
                error: 'Η Από Ημερομηνία πρέπει να είναι πριν ή ίδια με την Έως Ημερομηνία.',
                code: 'FINAL_WTODAILY_DOCUMENT_DATES_INVALID'
            };
        }
        if (!/^\d{1,4}$/.test(branch) || branch.toUpperCase() === 'ALL' || branch.includes(',')) {
            return {
                error: 'Επιλέξτε ένα συγκεκριμένο παράρτημα.',
                code: 'FINAL_WTODAILY_DOCUMENT_BRANCH_REQUIRED'
            };
        }
        return {
            branch: branch.padStart(4, '0'),
            periodStart,
            periodEnd
        };
    }

    function displayMetadata(result) {
        const container = global.document.getElementById('finalWtoSubmittedDocumentMetadata');
        if (!container) return;
        global.document.getElementById('finalWtoSubmittedProtocol').textContent =
            result.protocol || '-';
        global.document.getElementById('finalWtoSubmittedDate').textContent =
            result.submitDate || '-';
        global.document.getElementById('finalWtoSubmittedStatus').textContent =
            result.status === 'SUCCESS' ? 'Υποβλήθηκε στο ΕΡΓΑΝΗ' : result.status || '-';
        container.classList.remove('d-none');
    }

    async function readOfficialPdf(payload, params) {
        const choice = await global.ErganiFormsSwal.fire({ icon: 'info',
            title: 'Υποβλήθηκε στο ΕΡΓΑΝΗ',
            text: `Πρωτόκολλο: ${payload.protocol}. Δεν υπάρχει αποθηκευμένο επίσημο PDF. Μπορείτε να ζητήσετε μόνο ανάγνωση του αποδεικτικού από το ΕΡΓΑΝΗ. Δεν άλλαξαν δεδομένα.`,
            showCancelButton: true, confirmButtonText: 'Ανάκτηση επίσημου PDF', cancelButtonText: 'Κλείσιμο' });
        if (!choice.isConfirmed) return;
        let response;
        try { response = await global.fetch(`${ENDPOINT}/pdf?${params.toString()}`, {
            method: 'GET', credentials: 'include', headers: { Accept: 'application/pdf' }
        }); } catch (_) {
            return showError({ title: 'Η υποβολή είναι επιτυχής — το PDF δεν ανακτήθηκε',
                message: `Η υποβολή παραμένει επιτυχής με πρωτόκολλο ${payload.protocol}. Η σύνδεση για ανάγνωση του επίσημου PDF δεν ολοκληρώθηκε.`,
                code: 'FINAL_WTODAILY_PDF_UNAVAILABLE',
                steps: ['Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά την ανάκτηση.', 'Ελέγξτε το αποδεικτικό στο ΕΡΓΑΝΗ με τον υπεύθυνο.'] });
        }
        if (!response.ok || !String(response.headers.get('content-type')).includes('application/pdf')) {
            const failure = await response.json().catch(() => ({}));
            return showError({ title: 'Η υποβολή είναι επιτυχής — το PDF δεν είναι διαθέσιμο',
                message: failure.message || `Η υποβολή παραμένει επιτυχής με πρωτόκολλο ${payload.protocol}. Το επίσημο PDF δεν ανακτήθηκε.`,
                code: failure.code || 'FINAL_WTODAILY_PDF_UNAVAILABLE',
                steps: ['Δοκιμάστε ξανά αργότερα την ανάκτηση του εγγράφου.', 'Ελέγξτε το αποδεικτικό στο ΕΡΓΑΝΗ με τον υπεύθυνο.'] });
        }
        const url = global.URL.createObjectURL(await response.blob());
        try {
            await global.ErganiFormsSwal.fire({ title: 'Επίσημο αποδεικτικό ΕΡΓΑΝΗ',
                html: `<p>Πρωτόκολλο: ${escapeHtml(payload.protocol)}</p><iframe title="Επίσημο PDF ΕΡΓΑΝΗ" src="${escapeHtml(url)}" style="width:100%;height:60vh;min-height:12rem;border:0"></iframe>`,
                confirmButtonText: 'Κλείσιμο' });
        } finally { global.URL.revokeObjectURL(url); }
    }

    async function openSubmittedDocument() {
        const criteria = validateCriteria();
        if (criteria.error) {
            return showError({
                title: 'Δεν άνοιξε το οριστικό PDF',
                message: criteria.error,
                code: criteria.code,
                steps: [
                    'Διορθώστε τα στοιχεία της περιόδου ή του παραρτήματος.',
                    'Πατήστε ξανά «Άνοιγμα Οριστικού PDF».'
                ]
            });
        }

        const params = new URLSearchParams({
            ypokatasthma: criteria.branch,
            apo_hmeromhnia: criteria.periodStart,
            eos_hmeromhnia: criteria.periodEnd
        });
        try {
            if (typeof global.showLoader === 'function') global.showLoader();
            const response = await global.fetch(`${ENDPOINT}?${params.toString()}`, {
                method: 'GET',
                credentials: 'include',
                headers: { Accept: 'application/json' }
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.success !== true || payload.found !== true) {
                return showError({
                    title: 'Δεν βρέθηκε οριστικό PDF',
                    message: payload.message || NOT_FOUND_MESSAGE,
                    code: payload.code || 'FINAL_WTODAILY_DOCUMENT_NOT_FOUND',
                    steps: [
                        'Ελέγξτε ότι επιλέξατε το σωστό παράρτημα και τη σωστή περίοδο.',
                        'Βεβαιωθείτε ότι η οριστική υποβολή έχει ολοκληρωθεί και δοκιμάστε ξανά.',
                        'Αν η υποβολή έχει ολοκληρωθεί αλλά το PDF δεν εμφανίζεται, επικοινωνήστε με τον διαχειριστή.'
                    ]
                });
            }
            displayMetadata(payload);
            if (payload.pdfReadOnly && !payload.pdfUrl) return await readOfficialPdf(payload, params);
            return global.ErganiRestSubmissionUi.presentSubmissionResultSafely({
                ...payload,
                submissionCode: 'WTODailyA',
                processDescription: PROCESS_DESCRIPTION,
                pdfViewerVariant: 'compact-portrait'
            }, { showDialog: options => global.ErganiFormsSwal.fire(options) });
        } catch (_) {
            return showError({
                title: 'Δεν άνοιξε το οριστικό PDF',
                message: 'Η εφαρμογή δεν μπόρεσε να διαβάσει τώρα τα στοιχεία της οριστικής υποβολής.',
                code: 'FINAL_WTODAILY_DOCUMENT_READ_FAILED',
                steps: [
                    'Ελέγξτε τη σύνδεσή σας.',
                    'Πατήστε ξανά «Άνοιγμα Οριστικού PDF».',
                    'Αν το μήνυμα εμφανιστεί ξανά, επικοινωνήστε με τον διαχειριστή.'
                ]
            });
        } finally {
            if (typeof global.hideLoader === 'function') global.hideLoader();
            if (typeof global.AppLoader?.hide === 'function') global.AppLoader.hide();
        }
    }

    global.document.addEventListener('DOMContentLoaded', () => {
        const button = global.document.getElementById('openFinalWtoSubmittedDocumentButton');
        if (!button || button.disabled) return;
        button.addEventListener('click', openSubmittedDocument);
    });

    global.FinalWtoSubmittedDocumentPage = Object.freeze({
        ENDPOINT,
        PROCESS_DESCRIPTION,
        NOT_FOUND_MESSAGE,
        validateCriteria,
        openSubmittedDocument
    });
})(window);
