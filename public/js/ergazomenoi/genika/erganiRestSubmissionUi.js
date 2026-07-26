(function initErganiRestSubmissionUi(global) {
    'use strict';

    const PDF_ROUTE_PATTERN =
        /^\/ergazomenoi\/ergazomenoi\/ergani\/pdf\/[a-f\d]{24}$/i;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeResult(result = {}) {
        const submission = result.submission || result.erganh?.submission || {};
        const success = result.success === true;

        return {
            success,
            submissionCode:
                result.submissionCode ||
                result.submission_code ||
                submission.code ||
                result.processCode ||
                '',
            processDescription:
                result.processDescription ||
                result.process_description ||
                submission.description ||
                '',
            protocol: result.protocol || result.erganh?.protocol || '',
            submitDate: result.submitDate || result.submit_date || result.erganh?.submitDate || '',
            erganhSubmissionId:
                result.erganhSubmissionId || result.submissionId || result.id || result.erganh?.id || '',
            erganhLogId: result.erganhLogId || result.logId || '',
            status: result.status || result.submissionStatus || (success ? 'SUCCESS' : 'FAILED'),
            pdfSaved: result.pdfSaved === true,
            pdfUrl: result.pdfUrl || result.pdf_url || '',
            pdfDeferred: result.pdfDeferred === true,
            pdfWarning: result.pdfWarning || '',
            pdfFilename: result.pdfFilename || '',
            message: result.message || '',
            errorMessage:
                result.errorMessage || result.error || result.userMessage || result.message || ''
        };
    }

    function getSafeSameOriginPdfUrl(value) {
        if (!value || !global.location?.origin) return '';

        try {
            const resolved = new URL(String(value), global.location.origin);
            if (resolved.origin !== global.location.origin) return '';
            if (resolved.search || resolved.hash) return '';
            if (!PDF_ROUTE_PATTERN.test(resolved.pathname)) return '';
            return resolved.pathname;
        } catch (_) {
            return '';
        }
    }

    function closeLoaders() {
        if (typeof global.hideLoader === 'function') global.hideLoader();
        if (typeof global.AppLoader?.hide === 'function') global.AppLoader.hide();
        if (global.Swal?.isVisible?.()) global.Swal.close();
    }

    function getCsrfToken() {
        return global.document?.querySelector?.('meta[name="csrf-token"]')?.content || '';
    }

    async function retrySubmittedPdf(logId) {
        if (!/^[a-f\d]{24}$/i.test(String(logId || ''))) {
            return {
                success: false,
                pdfDeferred: true,
                message: 'Δεν υπάρχει έγκυρο αναγνωριστικό υποβολής για ανάκτηση PDF.'
            };
        }

        try {
            const response = await global.fetch(
                `/ergazomenoi/ergazomenoi/ergani/pdf/${encodeURIComponent(logId)}/retry`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': getCsrfToken()
                    },
                    credentials: 'include',
                    skipLoader: true,
                    body: JSON.stringify({})
                }
            );

            const payload = await response.json().catch(() => ({}));
            if (response.ok !== true) {
                return {
                    success: false,
                    pdfDeferred: true,
                    pdfUrl: '',
                    message: `Η υποβολή ολοκληρώθηκε, αλλά η ανάκτηση του PDF απέτυχε προσωρινά (HTTP ${response.status}).`,
                    errorCategory: 'PDF_RETRY_HTTP_ERROR'
                };
            }

            return {
                ...payload,
                success: payload?.success === true,
                pdfDeferred: payload?.pdfDeferred === true,
                pdfUrl: getSafeSameOriginPdfUrl(payload?.pdfUrl)
            };
        } catch (_) {
            return {
                success: false,
                pdfDeferred: true,
                pdfUrl: '',
                message: 'Η υποβολή ολοκληρώθηκε, αλλά η ανάκτηση του PDF απέτυχε προσωρινά.',
                errorCategory: 'PDF_RETRY_NETWORK_ERROR'
            };
        }
    }

    async function showRetrievalProgress(result) {
        closeLoaders();
        global.Swal.fire({
            title: 'Ανάκτηση PDF από ΕΡΓΑΝΗ',
            html: `
                <p>Η υποβολή <strong>${escapeHtml(result.submissionCode || 'ΕΡΓΑΝΗ')}</strong> ολοκληρώθηκε.</p>
                <p>Ανακτάται το παραγόμενο PDF από το ΕΡΓΑΝΗ.</p>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => global.Swal.showLoading()
        });
    }

    async function showPdfModal(result, safePdfUrl) {
        closeLoaders();

        const title = result.submissionCode
            ? `ΕΡΓΑΝΗ - ${result.submissionCode}`
            : 'ΕΡΓΑΝΗ - Υποβληθέν PDF';

        await global.Swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            width: 1250,
            title,
            html: `
                <div class="ergani-submitted-pdf-result">
                    <p>
                        ${result.processDescription ? `<strong>${escapeHtml(result.processDescription)}</strong><br>` : ''}
                        ${result.protocol ? `Πρωτόκολλο: <strong>${escapeHtml(result.protocol)}</strong><br>` : ''}
                        ${result.submitDate ? `Ημερομηνία: ${escapeHtml(result.submitDate)}<br>` : ''}
                        Κατάσταση: <strong>${escapeHtml(result.status)}</strong>
                        ${result.pdfFilename ? `<br>Αρχείο: ${escapeHtml(result.pdfFilename)}` : ''}
                    </p>
                    <iframe
                        src="${escapeHtml(safePdfUrl)}"
                        class="pdf-preview-iframe"
                        title="PDF υποβολής ΕΡΓΑΝΗ">
                    </iframe>
                    <div class="pdf-preview-actions">
                        <button type="button" id="erganiSubmittedPdfOpen" class="btn btn-primary">Άνοιγμα PDF</button>
                        <a href="${escapeHtml(safePdfUrl)}" target="_blank" rel="noopener noreferrer" download class="btn btn-success">Αποθήκευση Τοπικά</a>
                        <button type="button" id="erganiSubmittedPdfClose" class="btn btn-secondary">Κλείσιμο</button>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            didOpen: () => {
                global.document
                    ?.getElementById?.('erganiSubmittedPdfOpen')
                    ?.addEventListener('click', () =>
                        global.open(safePdfUrl, '_blank', 'noopener,noreferrer')
                    );
                global.document
                    ?.getElementById?.('erganiSubmittedPdfClose')
                    ?.addEventListener('click', () => global.Swal.close());
            }
        });
    }

    async function showSubmissionError(result) {
        closeLoaders();
        await global.Swal.fire({
            icon: 'error',
            title: `Αποτυχία υποβολής ${result.submissionCode || 'ΕΡΓΑΝΗ'}`,
            html: `<p>${escapeHtml(result.errorMessage || 'Η υποβολή δεν ολοκληρώθηκε.')}</p>`,
            confirmButtonText: 'OK'
        });
    }

    async function showSuccessWithoutPdf(result, allowManualRetry) {
        closeLoaders();
        return global.Swal.fire({
            icon: 'warning',
            title: `Επιτυχής υποβολή ${result.submissionCode || 'ΕΡΓΑΝΗ'}`,
            html: `
                ${result.protocol ? `<p>Πρωτόκολλο: <strong>${escapeHtml(result.protocol)}</strong></p>` : ''}
                <p>Η υποβολή παραμένει επιτυχημένη, αλλά δεν ανακτήθηκε το PDF.</p>
                <p>${escapeHtml(result.pdfWarning || result.message || 'Δοκιμάστε ξανά αργότερα.')}</p>
            `,
            showCancelButton: allowManualRetry,
            confirmButtonText: allowManualRetry ? 'Νέα προσπάθεια ανάκτησης PDF' : 'OK',
            cancelButtonText: 'Κλείσιμο'
        });
    }

    async function presentSubmissionResult(rawResult) {
        const result = normalizeResult(rawResult);
        if (!result.success) {
            await showSubmissionError(result);
            return result;
        }

        let safePdfUrl = getSafeSameOriginPdfUrl(result.pdfUrl);
        if (safePdfUrl) {
            await showPdfModal(result, safePdfUrl);
            return { ...result, pdfUrl: safePdfUrl };
        }

        const canRetry = result.pdfDeferred && /^[a-f\d]{24}$/i.test(result.erganhLogId);
        if (!canRetry) {
            await showSuccessWithoutPdf(result, false);
            return result;
        }

        await showRetrievalProgress(result);
        let retryResult = await retrySubmittedPdf(result.erganhLogId);
        safePdfUrl = getSafeSameOriginPdfUrl(retryResult.pdfUrl);

        while (!safePdfUrl) {
            const choice = await showSuccessWithoutPdf(
                {
                    ...result,
                    pdfWarning: retryResult.message || retryResult.error || result.pdfWarning
                },
                true
            );
            if (!choice.isConfirmed) return { ...result, pdfDeferred: true };

            await showRetrievalProgress(result);
            retryResult = await retrySubmittedPdf(result.erganhLogId);
            safePdfUrl = getSafeSameOriginPdfUrl(retryResult.pdfUrl);
        }

        const finalResult = normalizeResult({ ...rawResult, ...retryResult, success: true });
        await showPdfModal(finalResult, safePdfUrl);
        return { ...finalResult, pdfUrl: safePdfUrl };
    }

    async function presentSubmissionResultSafely(rawResult) {
        const result = normalizeResult(rawResult);
        try {
            return await presentSubmissionResult(rawResult);
        } catch (_) {
            closeLoaders();
            try {
                await global.Swal.fire({
                    icon: 'warning',
                    title: result.success
                        ? `Επιτυχής υποβολή ${result.submissionCode || 'ΕΡΓΑΝΗ'}`
                        : `Αποτυχία υποβολής ${result.submissionCode || 'ΕΡΓΑΝΗ'}`,
                    html: result.success
                        ? '<p>Η υποβολή ολοκληρώθηκε, αλλά δεν ήταν δυνατή η προβολή του αποτελέσματος.</p>'
                        : '<p>Δεν ήταν δυνατή η προβολή των λεπτομερειών της αποτυχίας.</p>',
                    confirmButtonText: 'OK'
                });
            } catch (_) {
                // Το submission result παραμένει αμετάβλητο ακόμη και αν αποτύχει το fallback UI.
            }
            return result;
        }
    }

    const api = {
        escapeHtml,
        normalizeResult,
        getSafeSameOriginPdfUrl,
        closeLoaders,
        retrySubmittedPdf,
        presentSubmissionResult,
        presentSubmissionResultSafely
    };

    global.ErganiRestSubmissionUi = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
