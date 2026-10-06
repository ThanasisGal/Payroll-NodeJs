(function employeeHistoryGuidedResolutionModule(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.employeeHistoryGuidedResolution = api;
})(typeof window !== 'undefined' ? window : globalThis, function buildModule() {
    'use strict';

    const EXPECTED_VERSION = 1;
    const EXPECTED_KIND = 'UNIQUE_SAFE_REPAIR';
    const EXPECTED_CHOICE = 'APPLY_UNIQUE_SAFE_PLAN';
    const GUIDED_KIND = 'GUIDED_BUSINESS_CHOICE';
    const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
    const OPTION_ID_PATTERN = /^[A-Z0-9_]{3,100}$/;
    const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

    function isPlainObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function validCalendarDate(value) {
        if (!DATE_PATTERN.test(String(value || ''))) return false;
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }

    function normalizeInput(input) {
        if (!isPlainObject(input) || Object.keys(input).sort().join(',') !==
            'id,label,max,min,required,type' || input.id !== 'effectiveDate' ||
            input.type !== 'date' || input.required !== true ||
            !String(input.label || '').trim() || !validCalendarDate(input.min) ||
            !validCalendarDate(input.max) || input.min > input.max) return null;
        return Object.freeze({ id: 'effectiveDate', type: 'date',
            label: String(input.label), required: true,
            min: String(input.min), max: String(input.max) });
    }

    function normalizeBusinessOption(option) {
        if (!isPlainObject(option) || !OPTION_ID_PATTERN.test(String(option.id || '')) ||
            !String(option.label || '').trim() || !String(option.description || '').trim() ||
            Object.keys(option).some(key => !['id', 'label', 'description', 'inputs'].includes(key))) {
            return null;
        }
        let inputs;
        if (option.inputs !== undefined) {
            if (!Array.isArray(option.inputs) || option.inputs.length !== 1) return null;
            const input = normalizeInput(option.inputs[0]);
            if (!input) return null;
            inputs = Object.freeze([input]);
        }
        return Object.freeze({ id: String(option.id), label: String(option.label),
            description: String(option.description), ...(inputs ? { inputs } : {}) });
    }

    function normalizeResolutionResponse(data) {
        const resolution = data?.resolution;
        if (data?.resolutionRequired !== true || !isPlainObject(resolution) ||
            resolution.version !== EXPECTED_VERSION ||
            !FINGERPRINT_PATTERN.test(String(resolution.fingerprint || '')) ||
            !Array.isArray(resolution.options)) return null;

        if (resolution.kind === EXPECTED_KIND) {
            const option = resolution.options[0];
            if (resolution.options.length !== 1 || option?.id !== EXPECTED_CHOICE) return null;
            return Object.freeze({
                kind: EXPECTED_KIND,
                title: String(resolution.title || 'Βρέθηκε ασυνέπεια στο ιστορικό'),
                explanation: String(resolution.explanation || ''),
                option: Object.freeze({
                    id: EXPECTED_CHOICE,
                    label: String(option.label || 'Τακτοποίηση ιστορικού'),
                    description: String(option.description || '')
                }),
                options: Object.freeze([]),
                fingerprint: String(resolution.fingerprint)
            });
        }

        if (resolution.kind !== GUIDED_KIND || resolution.options.length < 2 ||
            resolution.options.length > 10) return null;
        const options = resolution.options.map(normalizeBusinessOption);
        if (options.some(option => !option) ||
            new Set(options.map(option => option.id)).size !== options.length) return null;
        return Object.freeze({
            kind: GUIDED_KIND,
            title: String(resolution.title || 'Χρειάζεται επιβεβαίωση του ιστορικού'),
            explanation: String(resolution.explanation || ''),
            options: Object.freeze(options),
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

    function appendText(documentRef, parent, tag, text, className = '') {
        const element = documentRef.createElement(tag);
        element.textContent = text;
        if (className) element.className = className;
        parent.appendChild(element);
        return element;
    }

    function buildUniqueContent(documentRef, resolution) {
        const container = documentRef.createElement('div');
        appendText(documentRef, container, 'p', resolution.explanation);
        if (resolution.option.description) appendText(documentRef, container, 'p',
            resolution.option.description, 'text-muted mt-3');
        return { element: container, selected: () => ({ choiceId: resolution.option.id }) };
    }

    function buildGuidedContent(documentRef, resolution, onValidityChange = () => {}) {
        const container = documentRef.createElement('div');
        appendText(documentRef, container, 'p', resolution.explanation);
        const group = documentRef.createElement('div');
        group.className = 'text-start mt-3';
        container.appendChild(group);
        const state = { choiceId: null, answers: null };
        const controls = [];
        const emitValidity = () => {
            const selected = controls.find(control => control.option.id === state.choiceId);
            const input = selected?.dateInput;
            const valid = Boolean(selected && (!input ||
                (validCalendarDate(input.value) && input.value >= input.min && input.value <= input.max)));
            state.answers = valid && input ? { effectiveDate: input.value } : null;
            onValidityChange(valid);
            return valid;
        };

        for (const option of resolution.options) {
            const wrapper = documentRef.createElement('div');
            wrapper.className = 'form-check mb-3';
            const radio = documentRef.createElement('input');
            radio.type = 'radio';
            radio.name = 'employee-history-business-choice';
            radio.value = option.id;
            radio.checked = false;
            radio.className = 'form-check-input';
            const label = documentRef.createElement('label');
            label.className = 'form-check-label';
            label.textContent = option.label;
            wrapper.appendChild(radio);
            wrapper.appendChild(label);
            appendText(documentRef, wrapper, 'div', option.description,
                'small text-muted ms-4');
            let dateInputElement = null;
            if (option.inputs?.length) {
                const input = option.inputs[0];
                const dateWrapper = documentRef.createElement('div');
                dateWrapper.className = 'ms-4 mt-2';
                appendText(documentRef, dateWrapper, 'label', input.label,
                    'form-label small');
                dateInputElement = documentRef.createElement('input');
                dateInputElement.type = 'date';
                dateInputElement.min = input.min;
                dateInputElement.max = input.max;
                dateInputElement.required = true;
                dateInputElement.disabled = true;
                dateInputElement.value = '';
                dateInputElement.className = 'form-control';
                dateWrapper.appendChild(dateInputElement);
                wrapper.appendChild(dateWrapper);
                if (typeof dateInputElement.addEventListener === 'function') {
                    dateInputElement.addEventListener('input', emitValidity);
                    dateInputElement.addEventListener('change', emitValidity);
                }
            }
            const control = { option, radio, dateInput: dateInputElement };
            controls.push(control);
            if (typeof radio.addEventListener === 'function') radio.addEventListener('change', () => {
                if (!radio.checked) return;
                state.choiceId = option.id;
                for (const item of controls) if (item.dateInput) {
                    item.dateInput.disabled = item.option.id !== option.id;
                }
                emitValidity();
            });
            group.appendChild(wrapper);
        }
        return {
            element: container,
            controls,
            selected() {
                if (!emitValidity()) return null;
                return { choiceId: state.choiceId,
                    ...(state.answers ? { answers: { ...state.answers } } : {}) };
            }
        };
    }

    function buildSafeContent(documentRef, resolution, onValidityChange) {
        return resolution.kind === GUIDED_KIND
            ? buildGuidedContent(documentRef, resolution, onValidityChange)
            : buildUniqueContent(documentRef, resolution);
    }

    function buildRetryPayload(originalPayload, resolution, selection = null) {
        const payload = { ...(isPlainObject(originalPayload) ? originalPayload : {}) };
        const selected = selection || (resolution.kind === EXPECTED_KIND
            ? { choiceId: resolution.option.id } : null);
        if (!selected || !OPTION_ID_PATTERN.test(String(selected.choiceId || ''))) {
            throw new TypeError('Valid guided resolution selection required');
        }
        if (resolution.kind === GUIDED_KIND) {
            const option = resolution.options.find(item => item.id === selected.choiceId);
            const input = option?.inputs?.[0];
            if (!option || (!input && selected.answers !== undefined) ||
                (input && (!isPlainObject(selected.answers) ||
                    Object.keys(selected.answers).length !== 1 ||
                    !Object.hasOwn(selected.answers, 'effectiveDate') ||
                    !validCalendarDate(selected.answers.effectiveDate) ||
                    selected.answers.effectiveDate < input.min ||
                    selected.answers.effectiveDate > input.max))) {
                throw new TypeError('Valid guided resolution selection required');
            }
        }
        payload.resolution = {
            choiceId: selected.choiceId,
            fingerprint: resolution.fingerprint,
            ...(selected.answers ? { answers: { effectiveDate: selected.answers.effectiveDate } } : {})
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
        const setConfirmValidity = valid => {
            if (valid && typeof swal.enableConfirmButton === 'function') swal.enableConfirmButton();
            if (!valid && typeof swal.disableConfirmButton === 'function') swal.disableConfirmButton();
        };
        const content = buildSafeContent(documentRef, resolution, setConfirmValidity);
        const guided = resolution.kind === GUIDED_KIND;
        const result = await swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            allowEscapeKey: () => !(typeof swal.isLoading === 'function' && swal.isLoading()),
            icon: 'warning',
            titleText: resolution.title,
            html: content.element,
            showCancelButton: true,
            focusCancel: true,
            confirmButtonText: guided ? 'Συνέχεια' : resolution.option.label,
            cancelButtonText: 'Ακύρωση',
            showLoaderOnConfirm: true,
            didOpen: () => { if (guided) setConfirmValidity(false); },
            preConfirm: async () => {
                const selection = content.selected();
                if (!selection) {
                    if (typeof swal.showValidationMessage === 'function') {
                        swal.showValidationMessage('Επιλέξτε τι συνέβη πραγματικά και συμπληρώστε την απαιτούμενη ημερομηνία. Δεν αποθηκεύτηκε αλλαγή.');
                    }
                    return false;
                }
                if (typeof swal.disableButtons === 'function') swal.disableButtons();
                try {
                    return await retryRequest(buildRetryPayload(originalPayload,
                        resolution, selection));
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
        GUIDED_KIND,
        normalizeResolutionResponse,
        readResolutionFromResponse,
        buildSafeContent,
        buildRetryPayload,
        handleInitialResponse
    });
});
