(function employeeHistoryGuidedResolutionModule(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.employeeHistoryGuidedResolution = api;
})(typeof window !== 'undefined' ? window : globalThis, function buildModule() {
    'use strict';

    const EXPECTED_VERSION = 1;
    const EXPECTED_KIND = 'UNIQUE_SAFE_REPAIR';
    const EXPECTED_CHOICE = 'APPLY_UNIQUE_SAFE_PLAN';
    const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

    function isPlainObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function normalizeResolutionResponse(data) {
        const resolution = data?.resolution;
        const option = resolution?.options?.[0];
        if (data?.resolutionRequired !== true || !isPlainObject(resolution) ||
            resolution.version !== EXPECTED_VERSION || resolution.kind !== EXPECTED_KIND ||
            !FINGERPRINT_PATTERN.test(String(resolution.fingerprint || '')) ||
            !Array.isArray(resolution.options) || resolution.options.length !== 1 ||
            option?.id !== EXPECTED_CHOICE) return null;

        return Object.freeze({
            title: String(resolution.title || 'Βρέθηκε ασυνέπεια στο ιστορικό'),
            explanation: String(resolution.explanation || ''),
            option: Object.freeze({
                id: EXPECTED_CHOICE,
                label: String(option.label || 'Τακτοποίηση ιστορικού'),
                description: String(option.description || '')
            }),
            fingerprint: String(resolution.fingerprint)
        });
    }

    async function readResolutionFromResponse(response) {
        if (!response || response.status !== 409 || typeof response.clone !== 'function') return null;
        try {
            return normalizeResolutionResponse(await response.clone().json());
        } catch (_) {
            return null;
        }
    }

    function buildSafeContent(documentRef, resolution) {
        const container = documentRef.createElement('div');
        const explanation = documentRef.createElement('p');
        explanation.textContent = resolution.explanation;
        container.appendChild(explanation);

        if (resolution.option.description) {
            const description = documentRef.createElement('p');
            description.className = 'text-muted mt-3';
            description.textContent = resolution.option.description;
            container.appendChild(description);
        }
        return container;
    }

    function buildRetryPayload(originalPayload, resolution) {
        const payload = { ...(isPlainObject(originalPayload) ? originalPayload : {}) };
        payload.resolution = {
            choiceId: resolution.option.id,
            fingerprint: resolution.fingerprint
        };
        return payload;
    }

    async function handleInitialResponse({ response, originalPayload, retryRequest,
        swal, documentRef } = {}) {
        const resolution = await readResolutionFromResponse(response);
        if (!resolution) return { handled: false, response };
        if (typeof retryRequest !== 'function' || !swal || !documentRef) {
            return { handled: false, response };
        }

        if (typeof swal.close === 'function') swal.close();
        const result = await swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            allowEscapeKey: () => !(typeof swal.isLoading === 'function' && swal.isLoading()),
            icon: 'warning',
            titleText: resolution.title,
            html: buildSafeContent(documentRef, resolution),
            showCancelButton: true,
            focusCancel: true,
            confirmButtonText: resolution.option.label,
            cancelButtonText: 'Ακύρωση',
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                if (typeof swal.disableButtons === 'function') swal.disableButtons();
                try {
                    return await retryRequest(buildRetryPayload(originalPayload, resolution));
                } catch (error) {
                    if (typeof swal.showValidationMessage === 'function') {
                        swal.showValidationMessage(
                            'Η επανάληψη της αποθήκευσης δεν ολοκληρώθηκε. Δεν αποθηκεύτηκε αλλαγή.'
                        );
                    }
                    if (typeof swal.enableButtons === 'function') swal.enableButtons();
                    throw error;
                }
            },
            customClass: {
                title: 'custom-title',
                popup: 'custom-swal-popup',
                htmlContainer: 'custom-html-container',
                confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                cancelButton: 'custom-cancel-button custom-swal-button'
            }
        });

        if (!result?.isConfirmed) return { handled: true, cancelled: true, response: null };
        return { handled: true, cancelled: false, response: result.value };
    }

    return Object.freeze({
        EXPECTED_VERSION,
        EXPECTED_KIND,
        EXPECTED_CHOICE,
        normalizeResolutionResponse,
        readResolutionFromResponse,
        buildRetryPayload,
        handleInitialResponse
    });
});
