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
    const FACT_KIND = 'BUSINESS_FACT_COLLECTION';
    const USER_CORRECTION_KIND = 'USER_CONFIRMED_HISTORY_CORRECTION';
    const SAFE_CORRECTION_KIND = 'EMPLOYEE_HISTORY_SAFE_CORRECTION';
    const SAFE_INTENTS = ['REMOVE_ROW', 'REPLACE_START', 'CORRECT_DEPARTURE',
        'CANCEL_DEPARTURE', 'REMOVE_RELATIONSHIP', 'INSERT_EVENT', 'CONFIRM_PERIODS', 'INITIAL_FROM_HIRE', 'FILL_MISSING_PERIODS', 'RECONCILE_HISTORY'];
    const SAFE_FIELDS = ['KPK','SPECIALTY','CONTRACT_TYPE','CONTRACT_CATEGORY',
        'WORK_DAYS','WEEKLY_HOURS','DAILY_HOURS','LEGAL_PAY','ACTUAL_PAY','CONTRACT_PAY'];
    const CORRECTION_MODAL_GAP = 8;
    const CORRECTION_MODAL_MIN_HEIGHT = 280;
    const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
    const OPTION_ID_PATTERN = /^[A-Z0-9_]{3,100}$/;
    const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
    const FACT_QUESTION_ORDER = Object.freeze([
        'departureOutcome', 'departureDate', 'payEffectiveOutcome', 'payEffectiveDate'
    ]);
    const FACT_OPTIONS = Object.freeze({
        departureOutcome: Object.freeze([
            'DEPARTED_ON_FIRST_RECORDED_DATE',
            'DEPARTED_ON_SECOND_RECORDED_DATE',
            'DEPARTED_ON_OTHER_DATE',
            'NO_DEPARTURE'
        ]),
        payEffectiveOutcome: Object.freeze([
            'PAY_APPLIED_FROM_HIRE', 'PAY_APPLIED_FROM_OTHER_DATE'
        ])
    });
    const USER_CORRECTION_INTENTS = Object.freeze([
        'FROM_HIRE', 'FROM_KNOWN_HISTORY_DATE', 'OTHER_DATE', 'CONFIRM_EXISTING',
        'CORRECT_EXISTING_HISTORICAL_FACT', 'REAL_HISTORICAL_CHANGE',
        'ENTER_DIFFERENT_VALUE', 'CONFIRM_REAL_PERIOD', 'RETIRE_ERRONEOUS_ARTIFACT'
    ]);

    function visibleElementRect(element, windowRef = null) {
        if (!element || typeof element.getBoundingClientRect !== 'function') return null;
        const rect = element.getBoundingClientRect();
        if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
        const style = typeof windowRef?.getComputedStyle === 'function'
            ? windowRef.getComputedStyle(element) : null;
        if (style?.display === 'none' || style?.visibility === 'hidden') return null;
        return rect;
    }

    function employeeCardBounds(card, windowRef = null) {
        const children = Array.from(card?.children || []);
        const headerGroup = children.find(child =>
            child?.matches?.('.card-header') || child?.querySelector?.('.card-header .sectionTitle'));
        const header = headerGroup?.matches?.('.card-header')
            ? headerGroup : headerGroup?.querySelector?.('.card-header');
        const footer = children.find(child => child?.classList?.contains?.('card-footer'));
        return visibleElementRect(header, windowRef) && visibleElementRect(footer, windowRef)
            ? { card, header, footer } : null;
    }

    function findActiveEmployeeCardBounds(documentRef, windowRef = null) {
        if (!documentRef || typeof documentRef.querySelectorAll !== 'function') return null;
        const saveButtons = Array.from(documentRef.querySelectorAll(
            '.sections form .card > .card-footer .submitButton, .sections form .submitButton'
        ));
        for (const button of saveButtons) {
            if (!visibleElementRect(button, windowRef)) continue;
            const card = typeof button.closest === 'function' ? button.closest('.card') : null;
            const bounds = employeeCardBounds(card, windowRef);
            if (bounds) return bounds;
        }
        const cards = Array.from(documentRef.querySelectorAll('.sections section form > .card'));
        for (const card of cards) {
            if (!visibleElementRect(card, windowRef)) continue;
            const bounds = employeeCardBounds(card, windowRef);
            if (bounds) return bounds;
        }
        return null;
    }

    function deriveCorrectionModalBounds({ headerRect, footerRect, cardRect, viewportHeight, viewportWidth,
        viewportTop = 0, gap = CORRECTION_MODAL_GAP,
        minimumHeight = CORRECTION_MODAL_MIN_HEIGHT } = {}) {
        const safeGap = Number.isFinite(gap) && gap >= 0 ? gap : CORRECTION_MODAL_GAP;
        const safeViewportTop = Number.isFinite(viewportTop) ? viewportTop : 0;
        const safeViewportHeight = Number.isFinite(viewportHeight) && viewportHeight > 0
            ? viewportHeight : 0;
        const safeViewportWidth = Number.isFinite(viewportWidth) && viewportWidth > 0
            ? viewportWidth : 0;
        const viewportBottom = safeViewportTop + safeViewportHeight;
        const rectTop = Number(headerRect?.bottom);
        const rectBottom = Number(footerRect?.top);
        const hasCardBounds = Number.isFinite(rectTop) && Number.isFinite(rectBottom) &&
            rectBottom > rectTop;
        let top = Math.max(safeViewportTop + safeGap,
            hasCardBounds ? rectTop + safeGap : safeViewportTop + safeGap);
        let bottom = Math.min(viewportBottom - safeGap,
            hasCardBounds ? rectBottom - safeGap : viewportBottom - safeGap);
        let viewportFallback = !hasCardBounds;
        if (bottom - top < minimumHeight) {
            top = safeViewportTop + safeGap;
            bottom = viewportBottom - safeGap;
            viewportFallback = true;
        }
        const bodyWidth = Number(cardRect?.width);
        const availableWidth = Math.max(0, Math.min(
            safeViewportWidth > 0 ? safeViewportWidth - (2 * safeGap) : Number.POSITIVE_INFINITY,
            Number.isFinite(bodyWidth) && bodyWidth > 0
                ? bodyWidth - (2 * safeGap) : Number.POSITIVE_INFINITY
        ));
        return Object.freeze({
            top,
            bottom: Math.max(top, bottom),
            height: Math.max(0, bottom - top),
            maxWidth: Number.isFinite(availableWidth) ? availableWidth : 0,
            gap: safeGap,
            viewportFallback
        });
    }

    function setImportantStyle(element, property, value) {
        if (typeof element?.style?.setProperty === 'function') {
            element.style.setProperty(property, value, 'important');
        } else if (element?.style) {
            element.style[property] = value;
        }
    }

    function applyCorrectionModalGeometry(popup, cardBounds, windowRef = null) {
        if (!popup) return null;
        const visualViewport = windowRef?.visualViewport;
        const bounds = deriveCorrectionModalBounds({
            headerRect: cardBounds?.header?.getBoundingClientRect(),
            footerRect: cardBounds?.footer?.getBoundingClientRect(),
            cardRect: cardBounds?.card?.getBoundingClientRect(),
            viewportHeight: Number(visualViewport?.height) || Number(windowRef?.innerHeight),
            viewportWidth: Number(visualViewport?.width) || Number(windowRef?.innerWidth),
            viewportTop: Number(visualViewport?.offsetTop) || 0
        });
        setImportantStyle(popup, 'position', 'fixed');
        setImportantStyle(popup, 'top', `${bounds.top}px`);
        setImportantStyle(popup, 'height', 'auto');
        setImportantStyle(popup, 'max-height', `${bounds.height}px`);
        if (bounds.maxWidth > 0) setImportantStyle(popup, 'max-width', `${bounds.maxWidth}px`);
        const cardRect = cardBounds?.card?.getBoundingClientRect();
        if (cardRect && cardRect.width > 0 && typeof popup.getBoundingClientRect === 'function') {
            const popupWidth = popup.getBoundingClientRect().width;
            const viewportWidth = Number(windowRef?.innerWidth) || cardRect.right;
            const left = Math.max(bounds.gap, Math.min(viewportWidth - popupWidth - bounds.gap,
                cardRect.left + (cardRect.width - popupWidth) / 2));
            setImportantStyle(popup, 'left', `${left}px`);
            setImportantStyle(popup, 'transform', 'none');
            setImportantStyle(popup, 'margin-left', '0');
            setImportantStyle(popup, 'margin-right', '0');
        }
        return bounds;
    }

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

    function exactKeys(value, expected) {
        const keys = Object.keys(value || {}).sort();
        const wanted = [...expected].sort();
        return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
    }

    function normalizeFactQuestion(question) {
        if (!isPlainObject(question) || !FACT_QUESTION_ORDER.includes(question.id) ||
            !String(question.label || '').trim() || question.required !== true) return null;
        if (question.type === 'SINGLE_CHOICE') {
            const expected = FACT_OPTIONS[question.id];
            if (!expected || !exactKeys(question,
                ['id', 'type', 'label', 'required', 'options']) ||
                !Array.isArray(question.options) || question.options.length !== expected.length ||
                question.options.some((option, index) => !isPlainObject(option) ||
                    !exactKeys(option, ['id', 'label']) || option.id !== expected[index] ||
                    !String(option.label || '').trim())) return null;
            return Object.freeze({ id: question.id, type: 'SINGLE_CHOICE',
                label: String(question.label), required: true,
                options: Object.freeze(question.options.map(option => Object.freeze({
                    id: option.id, label: String(option.label)
                }))) });
        }
        if (question.type !== 'DATE' || !exactKeys(question,
            ['condition', 'id', 'label', 'max', 'min', 'required', 'type']) ||
            !isPlainObject(question.condition) ||
            !exactKeys(question.condition, ['equals', 'questionId']) ||
            !validCalendarDate(question.min) || !validCalendarDate(question.max) ||
            question.min > question.max) return null;
        const expectedCondition = question.id === 'departureDate'
            ? { questionId: 'departureOutcome', equals: 'DEPARTED_ON_OTHER_DATE' }
            : question.id === 'payEffectiveDate'
                ? { questionId: 'payEffectiveOutcome', equals: 'PAY_APPLIED_FROM_OTHER_DATE' }
                : null;
        if (!expectedCondition || question.condition.questionId !== expectedCondition.questionId ||
            question.condition.equals !== expectedCondition.equals) return null;
        return Object.freeze({ id: question.id, type: 'DATE', label: String(question.label),
            required: true, min: String(question.min), max: String(question.max),
            condition: Object.freeze(expectedCondition) });
    }

    function normalizeCorrectionControl(control) {
        if (!isPlainObject(control) || control.required !== true ||
            !['SINGLE_CHOICE', 'DATE', 'INTEGER', 'DECIMAL', 'CATALOG_CHOICE',
                'BOOLEAN', 'PROFILE_FIELDS'].includes(control.type)) return null;
        if (control.type === 'DATE') {
            if (!validCalendarDate(control.min) || !validCalendarDate(control.max) ||
                control.min > control.max || !String(control.label || '').trim()) return null;
        }
        if (control.allowedValues !== undefined && (!Array.isArray(control.allowedValues) ||
            !control.allowedValues.length || control.allowedValues.some(item =>
                !isPlainObject(item) || item.value === undefined ||
                !String(item.label || '').trim()))) return null;
        if (control.type === 'PROFILE_FIELDS' &&
            (!Array.isArray(control.baselineValues) || !control.baselineValues.length ||
            !Array.isArray(control.fields) || !control.fields.length)) return null;
        return Object.freeze(structuredClone(control));
    }

    function normalizeCorrectionConflict(conflict, previousIds) {
        if (!isPlainObject(conflict) || !OPTION_ID_PATTERN.test(String(conflict.conflictId || '')) ||
            !['BOUNDARY', 'FIELD', 'PROFILE', 'STRUCTURAL_PERIOD'].includes(conflict.kind) ||
            conflict.required !== true || !String(conflict.issue || '').trim() ||
            !String(conflict.decisionRequired || '').trim() || !isPlainObject(conflict.period) ||
            !validCalendarDate(conflict.period.from) || !String(conflict.period.label || '').trim() ||
            (conflict.period.to !== null && !validCalendarDate(conflict.period.to)) ||
            !Array.isArray(conflict.intents) || !conflict.intents.length) return null;
        if (conflict.condition && (!isPlainObject(conflict.condition) ||
            !previousIds.has(conflict.condition.conflictId) ||
            !USER_CORRECTION_INTENTS.includes(conflict.condition.intent))) return null;
        const intents = [];
        const ids = new Set();
        for (const intent of conflict.intents) {
            if (!isPlainObject(intent) || !USER_CORRECTION_INTENTS.includes(intent.id) ||
                ids.has(intent.id) || !String(intent.label || '').trim() ||
                !String(intent.description || '').trim()) return null;
            ids.add(intent.id);
            const valueControl = intent.valueControl === undefined ? null
                : normalizeCorrectionControl(intent.valueControl);
            const effectiveDateControl = intent.effectiveDateControl === undefined ? null
                : normalizeCorrectionControl(intent.effectiveDateControl);
            if (intent.valueControl !== undefined && !valueControl ||
                intent.effectiveDateControl !== undefined &&
                (!effectiveDateControl || effectiveDateControl.type !== 'DATE')) return null;
            intents.push(Object.freeze({ id: intent.id, label: String(intent.label),
                description: String(intent.description),
                ...(valueControl ? { valueControl } : {}),
                ...(effectiveDateControl ? { effectiveDateControl } : {}) }));
        }
        return Object.freeze({ ...structuredClone(conflict), intents: Object.freeze(intents) });
    }

    function normalizeSafeCorrection(resolution) {
        const text = value => typeof value === 'string' && value.length <= 2000;
        const texts = value => Array.isArray(value) && value.length <= 1000 && value.every(text);
        const rows = value => Array.isArray(value) && value.length <= 1000 && value.every(row =>
            exactKeys(row,['date','event','period','details']) && text(row.date) &&
            text(row.event) && text(row.period) && texts(row.details));
        if (!exactKeys(resolution,['version','kind','phase','title','explanation','attention',
            'recommendation','changes','unchanged','preview','choices','fields','fingerprint',
            ...(Object.hasOwn(resolution,'recordedTerms') ? ['recordedTerms'] : [])]) ||
            !['CHOICE','PREVIEW','BLOCKED'].includes(resolution.phase) ||
            !text(resolution.title) || !text(resolution.explanation) || !text(resolution.attention) ||
            !(resolution.recommendation === null || resolution.phase === 'PREVIEW' && text(resolution.recommendation)) ||
            !texts(resolution.changes) || !texts(resolution.unchanged) ||
            !exactKeys(resolution.preview,['before','after']) ||
            !rows(resolution.preview.before) || !rows(resolution.preview.after) ||
            !Array.isArray(resolution.choices) || resolution.choices.length > SAFE_INTENTS.length ||
            resolution.choices.some(choice => !exactKeys(choice,['id','label']) ||
                !SAFE_INTENTS.includes(choice.id) || !text(choice.label)) ||
            new Set(resolution.choices.map(choice => choice.id)).size !== resolution.choices.length ||
            resolution.recordedTerms !== undefined && (!Array.isArray(resolution.recordedTerms) || resolution.recordedTerms.length>200 ||
                resolution.recordedTerms.some(item=>!exactKeys(item,['fieldId','label','value']) || !text(item.fieldId) || !text(item.label) ||
                    !(item.value === null || typeof item.value === 'boolean' || text(item.value) ||
                        typeof item.value === 'number' && Number.isFinite(item.value) ||
                        Array.isArray(item.value) && item.value.length<=7 && item.value.every(n=>Number.isInteger(n) && n>=1 && n<=7)))) ||
            !Array.isArray(resolution.fields) || resolution.fields.length > SAFE_FIELDS.length ||
            resolution.fields.some(field => {
                if (!SAFE_FIELDS.includes(field.id) || !text(field.label) ||
                    !['INTEGER','DECIMAL','CATALOG_CHOICE'].includes(field.type)) return true;
                const keys = ['id','label','type', ...(field.type === 'CATALOG_CHOICE' ? ['allowedValues'] : ['min','max'])];
                return !exactKeys(field,keys) || field.type !== 'CATALOG_CHOICE' &&
                    (!Number.isFinite(field.min) || !Number.isFinite(field.max) || field.min > field.max) ||
                    field.type === 'CATALOG_CHOICE' && (!Array.isArray(field.allowedValues) ||
                    field.allowedValues.length > 10000 || field.allowedValues.some(item =>
                        !exactKeys(item,['value','label']) || !text(item.value) || !text(item.label)));
            })) return null;
        const publicText = JSON.stringify({ ...resolution, fingerprint: undefined });
        if (/(?:historyId|survivorId|deleteId|"_id"|"patch"|Mongo|canonical|planner|mutation|transaction|fingerprint|\bV1\b)/i.test(publicText)) return null;
        return Object.freeze(JSON.parse(JSON.stringify(resolution)));
    }

    function normalizeResolutionResponse(data) {
        const resolution = data?.resolution;
        if (data?.success === true || data?.resolutionRequired !== true || !isPlainObject(resolution) ||
            resolution.version !== EXPECTED_VERSION ||
            !FINGERPRINT_PATTERN.test(String(resolution.fingerprint || ''))) return null;

        if (resolution.kind === SAFE_CORRECTION_KIND) return normalizeSafeCorrection(resolution);

        if (resolution.kind === FACT_KIND) {
            if (!Array.isArray(resolution.questions) ||
                ![2, 4].includes(resolution.questions.length)) return null;
            const questions = resolution.questions.map(normalizeFactQuestion);
            const expectedOrder = FACT_QUESTION_ORDER.slice(0, questions.length);
            if (questions.some(question => !question) || questions.some((question, index) =>
                question.id !== expectedOrder[index])) return null;
            return Object.freeze({
                kind: FACT_KIND,
                title: String(resolution.title ||
                    'Χρειάζονται πραγματικά στοιχεία για το ιστορικό'),
                explanation: String(resolution.explanation || ''),
                questions: Object.freeze(questions),
                fingerprint: String(resolution.fingerprint)
            });
        }

        if (resolution.kind === USER_CORRECTION_KIND) {
            if (!Array.isArray(resolution.conflicts) || !resolution.conflicts.length ||
                !String(resolution.responsibilityText || '').trim()) return null;
            const ids = new Set();
            const conflicts = [];
            for (const raw of resolution.conflicts) {
                const conflict = normalizeCorrectionConflict(raw, ids);
                if (!conflict || ids.has(conflict.conflictId)) return null;
                ids.add(conflict.conflictId);
                conflicts.push(conflict);
            }
            const serialized = JSON.stringify(conflicts);
            if (/(?:"_id"|historyId|aa_eggrafhs|survivorId|deleteId|"patch"|mongo)/i
                .test(serialized)) return null;
            return Object.freeze({
                kind: USER_CORRECTION_KIND,
                title: String(resolution.title || 'Χρειάζεται διόρθωση του ιστορικού'),
                explanation: String(resolution.explanation || ''),
                conflicts: Object.freeze(conflicts),
                responsibilityText: String(resolution.responsibilityText),
                fingerprint: String(resolution.fingerprint)
            });
        }

        if (!Array.isArray(resolution.options)) return null;

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
        if (!response || ![200, 409].includes(response.status) ||
            typeof response.clone !== 'function') return null;
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

    function appendDetails(documentRef, parent, text) {
        const details = documentRef.createElement('details');
        details.className = 'small text-muted mt-2';
        appendText(documentRef, details, 'summary', 'Προβολή λεπτομερειών');
        appendText(documentRef, details, 'p', text);
        parent.appendChild(details);
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
            appendDetails(documentRef, wrapper, option.description);
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
            const control = { option, radio, wrapper, dateInput: dateInputElement };
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

    function buildFactContent(documentRef, resolution, onValidityChange = () => {}) {
        const container = documentRef.createElement('div');
        appendText(documentRef, container, 'p', resolution.explanation);
        const group = documentRef.createElement('div');
        group.className = 'text-start mt-3';
        container.appendChild(group);
        const state = { answers: {} };
        const controls = [];
        const visible = question => question.type !== 'DATE' ||
            state.answers[question.condition.questionId] === question.condition.equals;
        const emitValidity = () => {
            const normalized = {};
            let valid = true;
            for (const control of controls) {
                const question = control.question;
                if (!visible(question)) continue;
                if (question.type === 'SINGLE_CHOICE') {
                    const answer = state.answers[question.id];
                    if (!question.options.some(option => option.id === answer)) valid = false;
                    else normalized[question.id] = answer;
                } else {
                    const answer = control.dateInput.value;
                    if (!validCalendarDate(answer) || answer < question.min ||
                        answer > question.max) valid = false;
                    else normalized[question.id] = answer;
                }
            }
            state.normalizedAnswers = valid ? normalized : null;
            onValidityChange(valid);
            return valid;
        };
        const refreshConditions = () => {
            for (const control of controls.filter(item => item.question.type === 'DATE')) {
                const active = visible(control.question);
                control.wrapper.hidden = !active;
                control.dateInput.disabled = !active;
                if (!active) control.dateInput.value = '';
            }
            emitValidity();
        };

        for (const question of resolution.questions) {
            const wrapper = documentRef.createElement('div');
            wrapper.className = 'mb-3';
            appendText(documentRef, wrapper, 'div', question.label, 'form-label');
            if (question.type === 'SINGLE_CHOICE') {
                const radios = [];
                for (const option of question.options) {
                    const optionWrapper = documentRef.createElement('div');
                    optionWrapper.className = 'form-check ms-2';
                    const radio = documentRef.createElement('input');
                    radio.type = 'radio';
                    radio.name = `employee-history-fact-${question.id}`;
                    radio.value = option.id;
                    radio.checked = false;
                    radio.className = 'form-check-input';
                    const label = documentRef.createElement('label');
                    label.className = 'form-check-label';
                    label.textContent = option.label;
                    optionWrapper.appendChild(radio);
                    optionWrapper.appendChild(label);
                    wrapper.appendChild(optionWrapper);
                    radios.push(radio);
                    if (typeof radio.addEventListener === 'function') {
                        radio.addEventListener('change', () => {
                            if (!radio.checked) return;
                            state.answers[question.id] = option.id;
                            refreshConditions();
                        });
                    }
                }
                controls.push({ question, wrapper, radios, dateInput: null });
            } else {
                const dateInput = documentRef.createElement('input');
                dateInput.type = 'date';
                dateInput.setAttribute?.('aria-label', question.label);
                dateInput.min = question.min;
                dateInput.max = question.max;
                dateInput.required = true;
                dateInput.disabled = true;
                dateInput.value = '';
                dateInput.className = 'form-control';
                wrapper.hidden = true;
                wrapper.appendChild(dateInput);
                controls.push({ question, wrapper, radios: [], dateInput });
                if (typeof dateInput.addEventListener === 'function') {
                    dateInput.addEventListener('input', emitValidity);
                    dateInput.addEventListener('change', emitValidity);
                }
            }
            group.appendChild(wrapper);
        }
        return {
            element: container,
            controls,
            selected() {
                if (!emitValidity()) return null;
                return { answers: { ...state.normalizedAnswers } };
            }
        };
    }

    function appendChoiceOptions(documentRef, select, values) {
        const empty = documentRef.createElement('option');
        empty.value = '';
        empty.textContent = 'Επιλέξτε…';
        select.appendChild(empty);
        for (const item of values || []) {
            const option = documentRef.createElement('option');
            option.value = String(item.value);
            option.textContent = String(item.label);
            select.appendChild(option);
        }
    }

    function buildProfileSourceControl(documentRef, wrapper, candidates, heading = 'Καταχωρημένοι όροι εργασίας') {
        appendText(documentRef, wrapper, 'label', heading, 'form-label small');
        const sole = candidates.length === 1 ? candidates[0] : null;
        const input = documentRef.createElement(sole ? 'input' : 'select');
        if (sole) {
            // Only the value source is fixed; the user must still select an intent,
            // supply every required fact and explicitly accept responsibility.
            input.type = 'hidden';
            input.value = String(sole.value);
            appendText(documentRef, wrapper, 'p', sole.description || sole.label, 'mb-1');
        } else {
            input.className = 'form-select';
            input.value = '';
            appendChoiceOptions(documentRef, input, candidates);
        }
        input.disabled = true;
        wrapper.appendChild(input);
        appendText(documentRef, wrapper, 'p',
            'Οι ημερομηνίες ισχύος επιβεβαιώνονται χωριστά.',
            'small text-muted mt-2');
        const summaries = candidates.filter(candidate => candidate.summary?.length);
        if (summaries.length) {
            const details = documentRef.createElement('details');
            appendText(documentRef, details, 'summary', 'Προβολή καταχωρημένων όρων');
            for (const candidate of summaries) {
                appendText(documentRef, details, 'p', candidate.label, 'fw-semibold');
                for (const field of candidate.summary) appendText(documentRef, details, 'p',
                    `${field.label}: ${field.value?.label || 'Δεν υπάρχει καταχωρισμένη τιμή'}`);
            }
            wrapper.appendChild(details);
        }
        return input;
    }

    // Local, explicit edit intent. Only normalized values enter existing writers.
    function buildBeforeAfterField(documentRef, field, before, onChange = () => {}) {
        const row = documentRef.createElement('div'); row.className='employee-history-comparison-row';
        const left=documentRef.createElement('div'); left.className='employee-history-comparison-before';
        const right=documentRef.createElement('div'); right.className='employee-history-comparison-after';
        const name=field.label || 'Τιμή';
        appendText(documentRef,left,'strong',`ΠΡΙΝ — ${name}`);
        const recorded=before !== undefined;
        const display=value=>value == null || value === '' ? 'Κενή τιμή' :
            (field.catalogValues || field.allowedValues || []).find(item=>String(item.value)===String(value))?.label ||
            (typeof value === 'boolean' ? value ? 'Ναι' : 'Όχι' :
            Array.isArray(value) ? value.join(', ') || 'Όλες οι εργάσιμες ημέρες' : String(value));
        appendText(documentRef,left,'p',recorded ? display(before) : 'Δεν υπάρχει καταγεγραμμένη τιμή');
        appendText(documentRef,right,'strong',`ΜΕΤΑ — ${name}`);
        appendText(documentRef,right,'label',`Ενέργεια για «${name}»`,'form-label');
        const mode=documentRef.createElement('select'); mode.className='form-select';
        mode.setAttribute?.('aria-label',`${name}: ενέργεια`);
        appendChoiceOptions(documentRef,mode,[{value:'KEEP',label:'ΔΙΑΤΗΡΗΣΗ'},
            {value:'CHANGE',label:'ΑΛΛΑΓΗ'},{value:'CLEAR',label:'ΡΗΤΑ ΚΕΝΟ'}]);
        mode.value=recorded ? 'KEEP' : 'CHANGE';
        right.appendChild(mode);
        appendText(documentRef,right,'p',
            'ΔΙΑΤΗΡΗΣΗ: ισχύει η τιμή ΠΡΙΝ. ΑΛΛΑΓΗ: συμπλήρωσε τη νέα τιμή παρακάτω. ΡΗΤΑ ΚΕΝΟ: δηλώνεις ότι δεν υπάρχει τιμή, όπου επιτρέπεται.', 'small');
        appendText(documentRef,right,'label',`Νέα τιμή — ${name}`,'form-label');
        const type=field.inputType || field.type;
        const input=documentRef.createElement(type === 'CATALOG_CHOICE' ? 'select' : 'input');
        input.className=type === 'CATALOG_CHOICE' ? 'form-select' : 'form-control';
        input.setAttribute?.('aria-label',name);input.setAttribute?.('data-profile-field',field.id || name);
        if (field.optional) input.setAttribute?.('data-profile-optional','true');
        input.value='';
        if (type === 'CATALOG_CHOICE') appendChoiceOptions(documentRef,input,field.catalogValues || field.allowedValues || []);
        else {
            input.type=type === 'DATE' ? 'date' : ['INTEGER','DECIMAL'].includes(type) ? 'number' : 'text';
            if (field.min !== undefined) input.min=field.min;
            if (field.max !== undefined) input.max=field.max;
            if (type === 'DECIMAL') input.step='any';
            if (type === 'DAYS') input.placeholder='1,3,5 ή 0 για όλες τις εργάσιμες ημέρες';
            if (type === 'BOOLEAN') { input.type='text';input.placeholder='Ναι / Όχι'; }
        }
        right.appendChild(input);
        const actions=documentRef.createElement('div');actions.className='employee-history-comparison-actions';
        const clear=appendText(documentRef,actions,'button','Κενό (F8)','employee-history-correction-action employee-history-correction-cancel');
        const undo=appendText(documentRef,actions,'button','Αναίρεση','employee-history-correction-action employee-history-correction-cancel');
        clear.type=undo.type='button';right.appendChild(actions);
        const message=appendText(documentRef,right,'p','','small');message.setAttribute?.('role','status');
        const missing=appendText(documentRef,right,'p','','small text-danger');
        missing.hidden=true;missing.setAttribute?.('role','status');
        row.appendChild(left);row.appendChild(right);
        const state={action:mode.value,previous:null};
        const nullable=field.nullable === true;
        const refresh=()=>{mode.value=state.action;undo.hidden=state.action !== 'CLEAR';
            input.disabled=state.action === 'CLEAR';row.setAttribute?.('data-edit-state',state.action);};
        const changed=()=>{refresh();onChange();};
        const setAction=action=>{
            if (action === 'CLEAR' && !nullable) {
                message.textContent=`Το «${name}» είναι υποχρεωτικό για τον έλεγχο των όρων εργασίας. 1. Δήλωσε την πραγματική τιμή. Δεν αποθηκεύτηκε καμία αλλαγή.`;
                refresh();return;
            }
            if (action === 'KEEP' && !recorded) {
                message.textContent='Δεν υπάρχει καταγεγραμμένη τιμή. 1. Δήλωσε την πραγματική τιμή. Δεν αποθηκεύτηκε καμία αλλαγή.';
                refresh();return;
            }
            if (action === 'CLEAR' && state.action !== 'CLEAR') state.previous={action:state.action,value:input.value};
            if (action === 'CLEAR') input.value='';
            state.action=action;message.textContent='';changed();
        };
        clear.addEventListener('click',()=>setAction('CLEAR'));
        undo.addEventListener('click',()=>{if (!state.previous) return;input.value=state.previous.value;
            state.action=state.previous.action;state.previous=null;message.textContent='';changed();});
        mode.addEventListener('change',()=>setAction(mode.value));
        input.addEventListener('input',()=>{state.action='CHANGE';message.textContent='';changed();});
        input.addEventListener('change',()=>{if (state.action === 'CLEAR' || state.action === 'KEEP' && input.value === '') return;
            state.action='CHANGE';message.textContent='';changed();});
        row.addEventListener('keydown',event=>{
            if (event.isComposing) return;
            if (event.key === 'F8') {event.preventDefault();event.stopPropagation();setAction('CLEAR');
                if (state.action === 'CLEAR') mode.focus?.();return;}
            if (event.key !== 'Enter') return;
            if (String(event.target?.tagName).toLowerCase()==='button') return;
            event.preventDefault();event.stopPropagation();
            if (input.value === '' && state.action !== 'CLEAR') setAction('KEEP');
            const scope=row.closest?.('.employee-history-profile-comparison') || row.parentElement;
            const fields=Array.from(scope?.querySelectorAll?.('[data-profile-field]') || []);
            const next=fields.slice(fields.indexOf(input)+1).find(item=>!item.disabled && !item.hidden &&
                (!item.getClientRects || item.getClientRects().length>0));
            if (next) next.focus?.();
            else if (typeof CustomEvent === 'function') row.dispatchEvent?.(
                new CustomEvent('employee-history-next-field',{bubbles:true}));
        });
        function value() {
            if (state.action === 'KEEP') return recorded && (before != null || nullable) ? {value:before} : null;
            if (state.action === 'CLEAR') return nullable ? {value:null} : null;
            const raw=input.value;
            if (raw === '' || raw === undefined) return null;
            if (['INTEGER','DECIMAL'].includes(type)) {
                const n=Number(raw);if (!Number.isFinite(n) || field.min !== undefined && n<field.min ||
                    field.max !== undefined && n>field.max || type === 'INTEGER' && !Number.isInteger(n)) return null;
                return {value:n};
            }
            if (type === 'DATE') return validCalendarDate(raw) && (!field.min || raw>=field.min) && (!field.max || raw<=field.max) ? {value:raw} : null;
            if (type === 'BOOLEAN') return /^(ναι|true|1)$/i.test(raw) ? {value:true} : /^(όχι|οχι|false|0)$/i.test(raw) ? {value:false} : null;
            if (type === 'DAYS') return raw === '0' ? {value:[]} : /^[1-7](?:\s*,\s*[1-7])*$/.test(raw) ? {value:raw.split(',').map(Number)} : null;
            if (type === 'CATALOG_CHOICE' && !(field.catalogValues || field.allowedValues || []).some(item=>String(item.value)===raw)) return null;
            return {value:raw};
        }
        refresh();
        function validate(enabled=true) {
            const invalid=enabled && !value();
            const range=['INTEGER','DECIMAL','DATE'].includes(type) && (field.min !== undefined || field.max !== undefined)
                ? ` Επιτρεπόμενη τιμή: ${field.min !== undefined ? `από ${field.min}` : ''}${field.max !== undefined ? ` έως ${field.max}` : ''}.` : '';
            missing.hidden=!invalid;
            missing.textContent=invalid
                ? `Το «${name}» χρειάζεται έγκυρη απάντηση για να συνεχίσεις.${range} 1. Συμπλήρωσε την πραγματική τιμή ή επίλεξε ΔΙΑΤΗΡΗΣΗ αν υπάρχει τιμή ΠΡΙΝ.${nullable ? ' 2. Αν δεν υπάρχει τιμή, πάτησε F8 για ρητά κενό.' : ''} Δεν αποθηκεύτηκε καμία αλλαγή.` : '';
            input.setAttribute?.('aria-invalid',String(Boolean(invalid)));
            if (input.id) {missing.id=`${input.id}-missing`;input.setAttribute?.('aria-describedby',missing.id);}
            return !invalid;
        }
        return {field,input,mode,wrapper:row,state,clear,undo,value,validate};
    }

    function buildCorrectionValueControl(documentRef, control, emitValidity) {
        const wrapper = documentRef.createElement('div');
        wrapper.className = 'ms-4 mt-2';
        const state = { control, wrapper, element: null, fieldElements: [] };
        // Ordinary Save guidance keeps its existing controls and sequence (#329).
        // Explicit missing-period corrections carry a separate BEFORE contract.
        if (control.type === 'PROFILE_FIELDS' && control.beforeValues === undefined) {
            state.element=buildProfileSourceControl(documentRef,wrapper,control.baselineValues);
            for (const field of control.fields) {
                const group=documentRef.createElement('div');group.className='mt-2';
                appendText(documentRef,group,'label',field.label,'form-label small');
                const input=documentRef.createElement(field.inputType === 'CATALOG_CHOICE' ? 'select' : 'input');
                input.className=field.inputType === 'CATALOG_CHOICE' ? 'form-select' : 'form-control';input.value='';
                if (field.inputType === 'CATALOG_CHOICE') appendChoiceOptions(documentRef,input,field.catalogValues || []);
                else {input.type='number';if (field.min !== undefined) input.min=field.min;
                    if (field.max !== undefined) input.max=field.max;if (field.inputType === 'DECIMAL') input.step='any';}
                input.disabled=true;group.appendChild(input);wrapper.appendChild(group);
                state.fieldElements.push({field,input});
                input.addEventListener('input',emitValidity);input.addEventListener('change',emitValidity);
            }
            state.element.addEventListener?.('change',emitValidity);return state;
        }
        if (control.type === 'PROFILE_FIELDS') {
            const baseline=buildProfileSourceControl(documentRef,wrapper,control.baselineValues,
                Array.isArray(control.beforeValues) && !control.beforeValues.length
                    ? 'Στοιχεία αναφοράς άλλης περιόδου — δεν συμπληρώνονται αυτόματα' : undefined);
            state.element=baseline;
            if (control.baselineValues.some(candidate => candidate.value === control.initialSource))
                baseline.value=control.initialSource;
            const grid=documentRef.createElement('div');grid.className='employee-history-profile-comparison';
            appendText(documentRef,grid,'p','1. Συμπλήρωσε τα πραγματικά στοιχεία ΜΕΤΑ. Enter: διατήρηση και επόμενο πεδίο. F8: ρητό κενό.');
            for (const field of control.fields) {
                const known=(control.beforeValues || []).find(item=>item.fieldId===field.id);
                const item=buildBeforeAfterField(documentRef,field,known?.value,emitValidity);
                if (Object.hasOwn(control.initialValues || {},field.id)) {
                    const value=control.initialValues[field.id];
                    if(known && JSON.stringify(known.value)===JSON.stringify(value)) { /* Retain the existing KEEP state. */ }
                    else if(value === null) {item.mode.value='CLEAR';item.mode.dispatchEvent?.(new Event('change'));}
                    else {item.input.value=Array.isArray(value) ? value.join(',') || '0' : typeof value === 'boolean' ? value ? 'Ναι' : 'Όχι' : String(value);
                        item.input.dispatchEvent?.(new Event('input'));}
                }
                state.fieldElements.push(item);grid.appendChild(item.wrapper);
            }
            wrapper.appendChild(grid);
            baseline.addEventListener?.('change',emitValidity);
            return state;
        }
        if ((control.beforeAfter || control.beforeValue !== undefined) &&
            ['DATE','INTEGER','DECIMAL','CATALOG_CHOICE','BOOLEAN'].includes(control.type)) {
            const field={...control,inputType:control.type,nullable:control.nullable === true};
            const item=buildBeforeAfterField(documentRef,field,control.beforeValue,emitValidity);
            state.comparison=item;state.wrapper=item.wrapper;state.element=item.input;
            return state;
        }
        if (control.type === 'SINGLE_CHOICE' && control.allowedValues?.length &&
            control.allowedValues.every(item => /^PROFILE_CANDIDATE_[1-9]\d*$/.test(item.value))) {
            state.element = buildProfileSourceControl(documentRef, wrapper, control.allowedValues);
            if (typeof state.element.addEventListener === 'function') {
                state.element.addEventListener('change', emitValidity);
            }
            return state;
        }
        appendText(documentRef, wrapper, 'label', control.label || 'Τιμή',
            'form-label small');
        const input = documentRef.createElement(
            ['SINGLE_CHOICE', 'CATALOG_CHOICE'].includes(control.type) ? 'select' : 'input');
        input.className = ['SINGLE_CHOICE', 'CATALOG_CHOICE'].includes(control.type)
            ? 'form-select' : 'form-control';
        input.value = '';
        if (['SINGLE_CHOICE', 'CATALOG_CHOICE'].includes(control.type)) {
            appendChoiceOptions(documentRef, input, control.allowedValues || []);
        } else if (control.type === 'DATE') {
            input.type = 'date'; input.min = control.min; input.max = control.max;
        } else if (control.type === 'BOOLEAN') {
            input.type = 'checkbox'; input.checked = false;
        } else {
            input.type = 'number';
            if (control.min !== undefined) input.min = control.min;
            if (control.max !== undefined) input.max = control.max;
            if (control.type === 'DECIMAL') input.step = 'any';
        }
        input.disabled = true;
        wrapper.appendChild(input);
        state.element = input;
        if (typeof input.addEventListener === 'function') {
            input.addEventListener('input', emitValidity);
            input.addEventListener('change', emitValidity);
        }
        return state;
    }

    function setCorrectionInputEnabled(input, enabled) {
        if (!input) return;
        input.disabled = !enabled;
    }

    function normalizedControlValue(state) {
        const { control, element } = state;
        if (state.comparison) {
            const normalized=state.comparison.value();
            return normalized ? control.type === 'DATE' ? {effectiveDate:normalized.value} : normalized : null;
        }
        if (control.type === 'PROFILE_FIELDS') {
            const values={};
            const action=state.fieldElements.find(item=>item.field.id==='ROW_ACTION')?.value?.();
            if(action?.value==='REMOVE') return element.value ? {value:element.value,values:{ROW_ACTION:'REMOVE'}} : null;
            for (const item of state.fieldElements) {
                const raw=item.input.value;
                const normalized=typeof item.value === 'function' ? item.value() :
                    raw === '' ? null : ['INTEGER','DECIMAL'].includes(item.field.inputType)
                        ? Number.isFinite(Number(raw)) && (item.field.min === undefined || Number(raw)>=item.field.min) &&
                            (item.field.max === undefined || Number(raw)<=item.field.max) &&
                            (item.field.inputType !== 'INTEGER' || Number.isInteger(Number(raw))) ? {value:Number(raw)} : null
                        : {value:raw};
                if (!normalized) return null;
                values[item.field.id]=normalized.value;
            }
            return element.value ? {value:element.value,values} : null;
        }
        if (control.type === 'BOOLEAN') return { value: element.checked === true };
        const raw = element.value;
        if (control.type === 'DATE') return validCalendarDate(raw) && raw >= control.min &&
            raw <= control.max ? { effectiveDate: raw } : null;
        if (['INTEGER', 'DECIMAL'].includes(control.type)) {
            const number = Number(raw);
            if (raw === '' || !Number.isFinite(number) ||
                control.min !== undefined && number < control.min ||
                control.max !== undefined && number > control.max ||
                control.type === 'INTEGER' && !Number.isInteger(number)) return null;
            return { value: number };
        }
        const allowed = control.allowedValues || [];
        return allowed.some(item => String(item.value) === String(raw)) ? { value: raw } : null;
    }

    function buildUserCorrectionContent(documentRef, resolution,
        onValidityChange = () => {}, collectOnly = false) {
        const container = documentRef.createElement('div');
        appendText(documentRef, container, 'p', resolution.explanation);
        const state = { intents: {}, responsibilityAccepted: false, normalizedDecisions: null };
        const controls = [];
        const activeConflict = conflict => !conflict.condition ||
            state.intents[conflict.condition.conflictId] === conflict.condition.intent;
        const emitValidity = () => {
            const decisions = [];
            let valid = collectOnly || state.responsibilityAccepted === true;
            for (const control of controls) {
                const active = activeConflict(control.conflict);
                control.wrapper.hidden = !active;
                if (!active) continue;
                const intentId = state.intents[control.conflict.conflictId];
                const selected = control.intentControls.find(item => item.intent.id === intentId);
                control.missing.hidden=Boolean(selected);
                for (const item of control.intentControls) {
                    for (const valueState of [item.valueState,item.dateState].filter(Boolean)) {
                        const enabled=active && item===selected;
                        const removing=valueState.fieldElements.find(field=>field.field.id==='ROW_ACTION')?.value?.()?.value==='REMOVE';
                        for (const field of valueState.fieldElements) field.validate?.(enabled && (!removing || field.field.id==='ROW_ACTION'));
                        if (!valueState.missing) {
                            valueState.missing=appendText(documentRef,valueState.comparison ? valueState.element.parentElement : valueState.wrapper,'p','','small text-danger');
                            valueState.missing.setAttribute?.('role','status');
                        }
                        const invalid=enabled && !normalizedControlValue(valueState);
                        valueState.missing.hidden=!invalid;
                        valueState.missing.textContent=invalid
                            ? `Δεν μπορείς ακόμη να συνεχίσεις: λείπει έγκυρη απάντηση στο «${valueState.control.label || 'Στοιχεία περιόδου'}». 1. Έλεγξε τα πεδία που επισημαίνονται. 2. Επίλεξε στοιχεία αναφοράς αν ζητούνται. Δεν αποθηκεύτηκε καμία αλλαγή.` : '';
                        if (valueState.control.type!=='PROFILE_FIELDS') valueState.element.setAttribute?.('aria-invalid',String(Boolean(invalid)));
                        else valueState.element.setAttribute?.('aria-invalid',String(enabled && !valueState.element.value));
                    }
                }
                if (!selected) { valid = false; continue; }
                const decision = { conflictId: control.conflict.conflictId, intent: intentId };
                if (selected.valueState) {
                    const normalized = normalizedControlValue(selected.valueState);
                    if (!normalized) { valid = false; continue; }
                    Object.assign(decision, normalized);
                }
                if (selected.dateState) {
                    const normalized = normalizedControlValue(selected.dateState);
                    if (!normalized) { valid = false; continue; }
                    Object.assign(decision, normalized);
                }
                decisions.push(decision);
            }
            state.normalizedDecisions = valid ? decisions : null;
            onValidityChange(valid);
            return valid;
        };
        const refresh = () => {
            for (const control of controls) {
                const selectedId = state.intents[control.conflict.conflictId];
                for (const item of control.intentControls) {
                    const enabled = activeConflict(control.conflict) && item.intent.id === selectedId;
                    for (const valueState of [item.valueState, item.dateState].filter(Boolean)) {
                        setCorrectionInputEnabled(valueState.element, enabled);
                        for (const field of valueState.fieldElements) {
                            setCorrectionInputEnabled(field.input, enabled && field.state?.action !== 'CLEAR');
                            if (field.mode) setCorrectionInputEnabled(field.mode, enabled);
                        }
                        valueState.wrapper.hidden = !enabled;
                    }
                }
            }
            emitValidity();
        };

        for (const [position,conflict] of resolution.conflicts.entries()) {
            const wrapper = documentRef.createElement('section');
            wrapper.className = 'text-start border rounded p-3 mb-3';
            appendText(documentRef, wrapper, 'div', `Περίοδος: ${conflict.period.label}`,
                'fw-semibold');
            appendText(documentRef,wrapper,'div',`Ερώτηση ${position+1} — ${conflict.kind==='PROFILE' && conflict.intents.some(intent=>intent.valueControl?.fields?.some(field=>field.id==='ROW_ACTION')) ? 'Έλεγχος καταγεγραμμένης εγγραφής' : conflict.kind==='PROFILE' ? 'Συμπλήρωση όρων περιόδου' : conflict.decisionRequired}`,'fw-semibold');
            const samePeriod=resolution.conflicts.filter(other=>other.period.from===conflict.period.from && other.period.to===conflict.period.to);
            if (samePeriod.length>1) appendText(documentRef,wrapper,'p',
                `Αυτή είναι η ${samePeriod.indexOf(conflict)+1}η από ${samePeriod.length} διαφορετικές ερωτήσεις με τα ίδια χρονικά όρια. Κάθε απάντηση διατηρείται χωριστά. Έλεγξε το ζητούμενο αυτής της ερώτησης πριν επιλέξεις διατήρηση ή αλλαγή.`, 'small');
            if (conflict.condition || conflict.conflictId.startsWith('GAP_')) appendText(documentRef,wrapper,'p',
                'Ζητούνται επιπλέον στοιχεία για την κάλυψη αυτής της περιόδου. Οι προηγούμενες απαντήσεις διατηρούνται· δεν καλύπτουν αυτόματα το νέο ερώτημα.', 'small');
            if (conflict.field?.label) appendText(documentRef, wrapper, 'div',
                conflict.field.label, 'fw-semibold mt-2');
            appendDetails(documentRef, wrapper, conflict.issue);
            if (Array.isArray(conflict.historicalValues)) for (const item of conflict.historicalValues) {
                appendText(documentRef, wrapper, 'div', `Στο παλιό διάστημα: ${item.label}`,
                    'small');
            }
            if (conflict.laterValue) appendText(documentRef, wrapper, 'div',
                `Σε επόμενη εγγραφή: ${conflict.laterValue.label}`, 'small');
            appendText(documentRef, wrapper, 'div', conflict.decisionRequired,
                'form-label mt-3');
            const intentControls = [];
            for (const intent of conflict.intents) {
                const intentWrapper = documentRef.createElement('div');
                intentWrapper.className = 'form-check mb-2';
                const radio = documentRef.createElement('input');
                radio.type = 'radio';
                radio.name = `employee-history-correction-${conflict.conflictId}`;
                radio.value = intent.id;
                radio.checked = Boolean(intent.valueControl?.initialValues);
                if(radio.checked) state.intents[conflict.conflictId]=intent.id;
                radio.className = 'form-check-input';
                const label = documentRef.createElement('label');
                label.className = 'form-check-label';
                label.textContent = intent.label;
                intentWrapper.appendChild(radio);
                intentWrapper.appendChild(label);
                appendDetails(documentRef, intentWrapper, intent.description);
                const valueState = intent.valueControl
                    ? buildCorrectionValueControl(documentRef, intent.valueControl, emitValidity)
                    : null;
                const dateState = intent.effectiveDateControl
                    ? buildCorrectionValueControl(documentRef, intent.effectiveDateControl, emitValidity)
                    : null;
                for (const nested of [valueState, dateState].filter(Boolean)) {
                    nested.wrapper.hidden = true;
                    intentWrapper.appendChild(nested.wrapper);
                }
                if (typeof radio.addEventListener === 'function') radio.addEventListener('change', () => {
                    if (!radio.checked) return;
                    state.intents[conflict.conflictId] = intent.id;
                    refresh();
                });
                intentControls.push({ intent, radio, valueState, dateState });
                wrapper.appendChild(intentWrapper);
            }
            const missing=appendText(documentRef,wrapper,'p',
                'Χρειάζεται να επιλέξεις τι ίσχυε σε αυτή την εγγραφή για να συνεχίσεις. 1. Επίλεξε μία απάντηση παραπάνω. 2. Έλεγξε τα στοιχεία που θα εμφανιστούν. Δεν αποθηκεύτηκε καμία αλλαγή.', 'small text-danger');
            missing.setAttribute?.('role','status');
            controls.push({ conflict, wrapper, intentControls, missing });
            container.appendChild(wrapper);
        }
        const responsibilityWrapper = documentRef.createElement('div');
        responsibilityWrapper.className = 'form-check text-start mt-3';
        const responsibilityCheckbox = documentRef.createElement('input');
        responsibilityCheckbox.type = 'checkbox';
        responsibilityCheckbox.checked = false;
        responsibilityCheckbox.className = 'form-check-input';
        const responsibilityLabel = documentRef.createElement('label');
        responsibilityLabel.className = 'form-check-label';
        responsibilityLabel.textContent = resolution.responsibilityText;
        responsibilityWrapper.appendChild(responsibilityCheckbox);
        responsibilityWrapper.appendChild(responsibilityLabel);
        if (!collectOnly) container.appendChild(responsibilityWrapper);
        if (typeof responsibilityCheckbox.addEventListener === 'function') {
            responsibilityCheckbox.addEventListener('change', () => {
                state.responsibilityAccepted = responsibilityCheckbox.checked === true;
                emitValidity();
            });
        }
        refresh();

        return {
            element: container,
            controls,
            responsibilityCheckbox,
            selected() {
                if (!emitValidity()) return null;
                return { responsibilityAccepted: true,
                    decisions: state.normalizedDecisions.map(decision => ({ ...decision })) };
            }
        };
    }

    function buildHistoryCorrectionContent(documentRef, resolution, onValidityChange = () => {}) {
        const container = documentRef.createElement('div');
        container.className = 'employee-history-safe-correction text-start';
        const section = (title, values) => {
            appendText(documentRef,container,'h4',title,'fs-6 fw-semibold');
            for (const text of values) appendText(documentRef,container,'p',text);
        };
        section('Τι συμβαίνει',[resolution.explanation]);
        section('Γιατί χρειάζεται προσοχή',[resolution.attention]);
        if (resolution.recommendation) section('Πρόταση της εφαρμογής',[resolution.recommendation]);
        if (resolution.recordedTerms?.length) {
            const details=documentRef.createElement('details');
            appendText(documentRef,details,'summary','Καταγεγραμμένοι όροι της επιλεγμένης περιόδου');
            for (const field of resolution.recordedTerms) appendText(documentRef,details,'p',`${field.label}: ${
                field.value == null || field.value === '' ? 'Κενή τιμή' :
                typeof field.value === 'boolean' ? field.value ? 'Ναι' : 'Όχι' :
                Array.isArray(field.value) ? field.value.join(', ') || 'Όλες οι εργάσιμες ημέρες' : String(field.value)}`);
            container.appendChild(details);
        }
        if (resolution.changes.length) section('Τι θα αλλάξει',resolution.changes);
        if (resolution.unchanged.length) section('Τι δεν θα αλλάξει',resolution.unchanged);
        if (resolution.preview.before.length || resolution.preview.after.length) {
            const comparison=documentRef.createElement('div');comparison.className='employee-history-comparison-preview';
            for (const [name, rows] of [['ΠΡΙΝ',resolution.preview.before],['ΜΕΤΑ',resolution.preview.after]]) {
                if (resolution.phase !== 'PREVIEW' && name === 'ΜΕΤΑ') continue;
                const column=documentRef.createElement('div');comparison.appendChild(column);
                appendText(documentRef,column,'h4',name,'fs-6 fw-semibold');
                for (const row of rows) {
                    appendText(documentRef,column,'div',`${row.date}  ${row.event}`,'fw-semibold');
                    appendText(documentRef,column,'div',row.period,'small');
                    for (const detail of row.details) appendText(documentRef,column,'div',detail,'small');
                }
                if (!rows.length) appendText(documentRef,column,'p','Δεν υπάρχει καταγεγραμμένη περίοδος.');
            }
            container.appendChild(comparison);
        }
        const state = { intent: null, inputs: {}, valueControl: null, field: null, accepted: false };
        const questionElements = [];
        const confirmationElements = [];
        const dateInput = (key,label,nullable = false) => {
            const fieldId=({departureDate:'DEPARTURE',periodEnd:'END',previousPeriodEnd:'END'})[key];
            const before=resolution.recordedTerms?.find(item=>item.fieldId===fieldId);
            const comparison=buildBeforeAfterField(documentRef,{id:key,label,inputType:'DATE',nullable},before?.value,emit);
            state.inputs[key]={comparison};return comparison.wrapper;
        };
        const selected = () => {
            if (resolution.phase === 'PREVIEW') return state.accepted ? { confirmed: true } : null;
            if (resolution.phase !== 'CHOICE' || !state.intent) return null;
            const facts = {};
            for (const [key,{comparison}] of Object.entries(state.inputs)) {
                const normalized=comparison.value();if (!normalized) return null;
                facts[key]=normalized.value;
            }
            if (state.intent === 'INSERT_EVENT' || state.intent === 'REPLACE_START' && state.field) {
                const value = state.valueControl && normalizedControlValue(state.valueControl);
                if (!value || !state.field) return null;
                facts.fieldId = state.field.id; facts.value = value.value;
            }
            return { intent: state.intent, facts };
        };
        const emit = () => onValidityChange(Boolean(selected()));
        if (resolution.phase === 'CHOICE') {
            const factsContainer = documentRef.createElement('div');
            for (const choice of resolution.choices) {
                const wrapper = documentRef.createElement('div'); wrapper.className = 'form-check mb-2';
                const radio = documentRef.createElement('input'); radio.type = 'radio';
                radio.name = 'employee-history-safe-intent'; radio.value = choice.id;
                radio.checked = false; radio.className = 'form-check-input';
                radio.setAttribute?.('aria-label',choice.label);
                wrapper.appendChild(radio); appendText(documentRef,wrapper,'label',choice.label,'form-check-label');
                radio.addEventListener('change',() => {
                    if (!radio.checked) return;
                    state.intent = choice.id; state.inputs = {}; state.field = null; state.valueControl = null;
                    factsContainer.replaceChildren();
                    if (choice.id === 'CORRECT_DEPARTURE') factsContainer.appendChild(dateInput('departureDate','Σωστή ημερομηνία αποχώρησης'));
                    if (choice.id === 'CANCEL_DEPARTURE') factsContainer.appendChild(dateInput('periodEnd','Λήξη της τελευταίας περιόδου που ίσχυε πραγματικά',true));
                    if (['INSERT_EVENT','REPLACE_START'].includes(choice.id)) {
                        if (choice.id === 'INSERT_EVENT') {
                            factsContainer.appendChild(dateInput('effectiveDate','Πότε έγινε η παλαιότερη αλλαγή;'));
                            factsContainer.appendChild(dateInput('previousPeriodEnd','Πότε έληξαν οι προηγούμενοι όροι;'));
                        }
                        const select = documentRef.createElement('select'); select.className = 'form-select';
                        select.setAttribute?.('aria-label','Ποιο στοιχείο άλλαξε;');
                        const blank = documentRef.createElement('option'); blank.value = '';
                        blank.textContent = choice.id === 'REPLACE_START' ? 'Χωρίς αλλαγή άλλου στοιχείου' : 'Επιλέξτε το στοιχείο που άλλαξε'; select.appendChild(blank);
                        for (const field of resolution.fields) {
                            const option = documentRef.createElement('option'); option.value = field.id;
                            option.textContent = field.label; select.appendChild(option);
                        }
                        const valueContainer = documentRef.createElement('div');
                        select.addEventListener('change',() => {
                            state.field = resolution.fields.find(field => field.id === select.value) || null;
                            state.valueControl = null; valueContainer.replaceChildren();
                            if (state.field) {
                                const recorded=resolution.recordedTerms?.find(item=>item.fieldId===state.field.id);
                                state.valueControl = buildCorrectionValueControl(documentRef,{...state.field,beforeAfter:true,beforeValue:recorded?.value},emit);
                                setCorrectionInputEnabled(state.valueControl.element,true);
                                valueContainer.appendChild(state.valueControl.wrapper);
                            }
                            emit();
                        });
                        factsContainer.appendChild(select); factsContainer.appendChild(valueContainer);
                    }
                    emit();
                });
                container.appendChild(wrapper);
                questionElements.push(wrapper);
            }
            container.appendChild(factsContainer);
            questionElements.push(factsContainer);
        }
        if (resolution.phase === 'PREVIEW') {
            const checkbox = documentRef.createElement('input'); checkbox.type = 'checkbox';
            checkbox.checked = false; checkbox.className = 'form-check-input';
            const label = 'Επιβεβαιώνω ότι τα στοιχεία ΜΕΤΑ είναι σωστά και εγκρίνω τη διόρθωση.';
            checkbox.setAttribute?.('aria-label',label);
            confirmationElements.push(appendText(documentRef,container,'label',label,'form-check-label'));
            container.appendChild(checkbox); confirmationElements.push(checkbox);
            checkbox.addEventListener('change',() => { state.accepted = checkbox.checked === true; emit(); });
        }
        emit();
        return { element: container, selected, questionElements, confirmationElements };
    }

    function buildSafeContent(documentRef, resolution, onValidityChange, collectOnly = false) {
        if (resolution.kind === SAFE_CORRECTION_KIND) return buildHistoryCorrectionContent(documentRef,resolution,onValidityChange);
        if (resolution.kind === USER_CORRECTION_KIND) {
            return buildUserCorrectionContent(documentRef, resolution, onValidityChange, collectOnly);
        }
        if (resolution.kind === GUIDED_KIND) {
            return buildGuidedContent(documentRef, resolution, onValidityChange);
        }
        if (resolution.kind === FACT_KIND) {
            return buildFactContent(documentRef, resolution, onValidityChange);
        }
        return buildUniqueContent(documentRef, resolution);
    }

    function buildRetryPayload(originalPayload, resolution, selection = null) {
        const payload = { ...(isPlainObject(originalPayload) ? originalPayload : {}) };
        if (resolution.kind === SAFE_CORRECTION_KIND) {
            if (!selection || !isPlainObject(payload.correction)) throw new TypeError('Correction selection required');
            payload.correction = resolution.phase === 'PREVIEW'
                ? { ...payload.correction, confirmation: { fingerprint: resolution.fingerprint, confirmed: true } }
                : { ...payload.correction, intent: selection.intent, targetHistoryId: selection.intent === 'FILL_MISSING_PERIODS' ? null : payload.correction.targetHistoryId, facts: selection.facts, confirmation: null };
            return payload;
        }
        if (resolution.kind === USER_CORRECTION_KIND) {
            if (!selection || selection.responsibilityAccepted !== true ||
                !Array.isArray(selection.decisions) || !selection.decisions.length) {
                throw new TypeError('Valid user-confirmed correction required');
            }
            if (['REMOVE_ROW', 'CONFIRM_PERIODS', 'FILL_MISSING_PERIODS', 'RECONCILE_HISTORY'].includes(payload.correction?.intent)) {
                payload.correction = { ...payload.correction,
                    facts: { [['FILL_MISSING_PERIODS','RECONCILE_HISTORY'].includes(payload.correction.intent) ? 'periods' : 'periodCorrections']: selection.decisions.map(decision => ({ ...decision })) },
                    confirmation: null };
                return payload;
            }
            payload.resolution = {
                fingerprint: resolution.fingerprint,
                responsibilityAccepted: true,
                decisions: selection.decisions.map(decision => ({ ...decision,
                    ...(decision.values ? { values: { ...decision.values } } : {}) }))
            };
            return payload;
        }
        if (resolution.kind === FACT_KIND) {
            const questions = resolution.questions;
            if (!selection || !isPlainObject(selection.answers)) {
                throw new TypeError('Valid business facts required');
            }
            const answerKeys = Object.keys(selection.answers);
            const requiredKeys = questions.filter(question => question.type === 'SINGLE_CHOICE' ||
                selection.answers[question.condition.questionId] === question.condition.equals)
                .map(question => question.id);
            if (!exactKeys(selection.answers, requiredKeys) || questions.some(question => {
                const answer = selection.answers[question.id];
                if (question.type === 'SINGLE_CHOICE') {
                    return !question.options.some(option => option.id === answer);
                }
                if (!requiredKeys.includes(question.id)) return answer !== undefined;
                return !validCalendarDate(answer) || answer < question.min || answer > question.max;
            }) || answerKeys.some(key => !FACT_QUESTION_ORDER.includes(key))) {
                throw new TypeError('Valid business facts required');
            }
            payload.resolution = {
                fingerprint: resolution.fingerprint,
                answers: Object.fromEntries(requiredKeys.map(key => [key, selection.answers[key]]))
            };
            return payload;
        }
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

    function createCorrectionModalLifecycle({ swal, documentRef, windowRef } = {}) {
        let opened = false;
        let cleaned = false;
        let popup = null;
        let cardBounds = null;
        const cleanupCallbacks = [];
        const listen = (target, eventName, listener, options) => {
            if (typeof target?.addEventListener !== 'function') return;
            target.addEventListener(eventName, listener, options);
            cleanupCallbacks.push(() => target.removeEventListener?.(eventName, listener, options));
        };
        const recalculate = () => {
            if (!popup) return null;
            cardBounds = findActiveEmployeeCardBounds(documentRef, windowRef);
            return applyCorrectionModalGeometry(popup, cardBounds, windowRef);
        };
        return Object.freeze({
            open() {
                if (opened) return;
                opened = true;
                popup = typeof swal?.getPopup === 'function'
                    ? swal.getPopup() : documentRef?.querySelector?.(
                        '.swal2-popup.employee-history-correction-popup');
                recalculate();
                listen(windowRef, 'resize', recalculate, { passive: true });
                if (windowRef?.visualViewport && windowRef.visualViewport !== windowRef) {
                    listen(windowRef.visualViewport, 'resize', recalculate, { passive: true });
                }
            },
            recalculate,
            close() {
                if (cleaned) return;
                cleaned = true;
                while (cleanupCallbacks.length) cleanupCallbacks.pop()();
                popup = null;
                cardBounds = null;
            }
        });
    }

    // Presentation only: navigation never sends a request or changes the submitted facts.
    function createGuidedSteps(documentRef, content, resolution, swal, originalPayload, entryLabel = '', resumePending = false) {
        const root = documentRef.createElement('div');
        root.className = 'employee-history-safe-correction text-start';
        const progress = appendText(documentRef, root, 'p', '', 'fw-semibold');
        progress.setAttribute?.('aria-live', 'polite');
        const instruction = appendText(documentRef, root, 'p', '', 'fw-semibold');
        instruction.tabIndex = -1;
        root.appendChild(content.element);
        const originalNodes = Array.from(content.element.children);
        const intro = documentRef.createElement('div');
        appendText(documentRef, intro, 'p', resolution.phase === 'PREVIEW'
            ? `${entryLabel ? entryLabel + ': ' : ''}Έλεγξε τη διόρθωση πριν την αποθηκεύσεις.`
            : `${entryLabel ? entryLabel + ': ' : ''}Η εφαρμογή θα σε βοηθήσει να διορθώσεις το Ιστορικό. Δεν έχει αποθηκευτεί καμία αλλαγή.`);
        if (resolution.kind === USER_CORRECTION_KIND &&
            ['FILL_MISSING_PERIODS','RECONCILE_HISTORY'].includes(originalPayload?.correction?.intent))
            appendText(documentRef,intro,'p',resolution.explanation);
        const details = documentRef.createElement('details');
        appendText(documentRef, details, 'summary', 'Προβολή λεπτομερειών');
        appendText(documentRef, details, 'p', resolution.explanation);
        if (resolution.attention) appendText(documentRef, details, 'p', resolution.attention);
        intro.appendChild(details);
        root.appendChild(intro);
        const review = documentRef.createElement('div');
        root.appendChild(review);
        const approval = documentRef.createElement('label');
        approval.className = 'form-check-label employee-history-final-approval';
        const accepted = documentRef.createElement('input');
        accepted.type = 'checkbox'; accepted.checked = false; accepted.className = 'form-check-input me-2';
        approval.appendChild(accepted);
        appendText(documentRef, approval, 'span', 'Επιβεβαιώνω ότι οι επιλογές είναι σωστές και θέλω να αποθηκευτούν.');
        root.appendChild(approval);
        const nav = documentRef.createElement('div');
        nav.className = 'd-flex flex-wrap gap-2 mt-3';
        const back = appendText(documentRef, nav, 'button', 'Πίσω',
            'employee-history-correction-action employee-history-correction-cancel');
        const next = appendText(documentRef, nav, 'button', 'Συνέχεια',
            'employee-history-correction-action employee-history-correction-confirm');
        back.type = next.type = 'button';
        root.appendChild(nav);
        const pendingMessage=appendText(documentRef,root,'p','','small text-danger');
        pendingMessage.hidden=true;pendingMessage.setAttribute?.('role','status');
        const pages = [];
        const supplementalNodes = [];
        const page = (title, nodes, valid = () => true, active = () => true) =>
            pages.push({ title, nodes, valid, active });
        const isSafe = resolution.kind === SAFE_CORRECTION_KIND;
        const readOnly = isSafe && resolution.phase === 'CHOICE' ||
            resolution.kind === USER_CORRECTION_KIND && ['REMOVE_ROW', 'CONFIRM_PERIODS', 'FILL_MISSING_PERIODS', 'RECONCILE_HISTORY'].includes(originalPayload?.correction?.intent);
        const collectOnly = resolution.kind === USER_CORRECTION_KIND &&
            ['FILL_MISSING_PERIODS', 'RECONCILE_HISTORY'].includes(originalPayload?.correction?.intent);
        const blocked = isSafe && resolution.phase === 'BLOCKED';
        const controls = content.controls || [];
        const activeConflict = control => !control.conflict.condition || controls.some(previous =>
            previous.conflict.conflictId === control.conflict.condition.conflictId &&
            previous.intentControls.some(item => item.radio.checked && item.intent.id === control.conflict.condition.intent));
        const validDate = input => validCalendarDate(input.value) &&
            (!input.min || input.value >= input.min) && (!input.max || input.value <= input.max);
        page('Πάτησε «Συνέχεια» για να ξεκινήσεις.', [intro]);
        if (blocked) {
            intro.children[0].textContent = 'Η εφαρμογή δεν μπορεί να ολοκληρώσει αυτή τη διόρθωση με ασφάλεια. Δεν αποθηκεύτηκε καμία αλλαγή.';
            page('Ζήτησε από διαχειριστή να ελέγξει την επιλεγμένη εγγραφή και τις πραγματικές ημερομηνίες της. Έπειτα πάτησε «Ακύρωση».', [details]);
        } else if (isSafe && resolution.phase === 'CHOICE') {
            page('Επίλεξε τι χρειάζεται να διορθωθεί και πάτησε «Συνέχεια».', content.questionElements,
                () => Boolean(content.selected()));
        } else if (isSafe) {
            page('Έλεγξε τι θα αλλάξει. Πάτησε «Συνέχεια» μόνο αν συμφωνείς.',
                originalNodes.filter(node => !content.confirmationElements.includes(node)));
            page('Σημείωσε την επιβεβαίωση και πάτησε «Επιβεβαίωση διόρθωσης».', content.confirmationElements,
                () => Boolean(content.selected()));
        } else {
            if (resolution.kind === GUIDED_KIND) {
                page('Επίλεξε τι συνέβη πραγματικά.', [originalNodes[1]], () => Boolean(content.selected()));
            } else if (resolution.kind === FACT_KIND) {
                for (const control of controls.filter(item => item.question.type === 'SINGLE_CHOICE')) {
                    const dependent = controls.find(item => item.question.condition?.questionId === control.question.id);
                    page('Επίλεξε την απάντηση που γνωρίζεις ότι είναι σωστή.', () => [control.wrapper,
                        ...(dependent && control.radios.some(radio => radio.checked &&
                            radio.value === dependent.question.condition.equals) ? [dependent.wrapper] : [])], () => {
                        const radio = control.radios.find(item => item.checked);
                        return Boolean(radio && (!dependent || radio.value !== dependent.question.condition.equals || validDate(dependent.dateInput)));
                    });
                }
            } else if (resolution.kind === USER_CORRECTION_KIND) {
                for (const control of controls) page('Επίλεξε τι ίσχυε πραγματικά σε αυτή την περίοδο.', [control.wrapper], () => {
                    const selected = control.intentControls.find(item => item.radio.checked);
                    return Boolean(selected && [selected.valueState, selected.dateState].filter(Boolean)
                        .every(value => normalizedControlValue(value)));
                }, () => activeConflict(control));
            }
            if (collectOnly) {
                const note=appendText(documentRef,root,'p',
                    '1. Πάτησε «Έλεγχος αλλαγών» για τη συνολική προεπισκόπηση. 2. Αν λείπει άλλο πραγματικό στοιχείο, θα ζητηθεί εδώ. Δεν αποθηκεύτηκε καμία αλλαγή.');
                supplementalNodes.push(note);
                page('Οι απαντήσεις θα ελεγχθούν όλες μαζί.', [note], () => Boolean(content.selected()));
            } else {
            page('Έλεγξε όλες τις επιλογές σου. Για αλλαγή πάτησε «Πίσω».', [review]);
            page(readOnly ? 'Επιβεβαίωσε τις ημερομηνίες και πάτησε «Συνέχεια» για την προεπισκόπηση. Δεν αποθηκεύεται ακόμη αλλαγή.'
                : 'Σημείωσε την επιβεβαίωση και πάτησε «Επιβεβαίωση και αποθήκευση».',
            resolution.kind === USER_CORRECTION_KIND ? [originalNodes[originalNodes.length - 1]] : [approval],
            () => Boolean(content.selected()) && (resolution.kind === USER_CORRECTION_KIND || accepted.checked === true));
            }
        }
        let index = 0;
        if (resumePending && resolution.kind === USER_CORRECTION_KIND) {
            const pending=pages.filter(item=>item.active()).findIndex((item,position)=>position>0 && !item.valid());
            if(pending>0)index=pending;
        }
        let refreshing = false;
        let busy = false;
        const walk = node => [node, ...Array.from(node.children || []).flatMap(walk)];
        function renderReview() {
            review.replaceChildren();
            appendText(documentRef, review, 'p', 'Δεν έχει αποθηκευτεί καμία αλλαγή.');
            if (resolution.kind === EXPECTED_KIND) {
                appendText(documentRef, review, 'p', resolution.explanation);
                appendText(documentRef, review, 'p', resolution.option.description);
                return;
            }
            const scopes = resolution.kind === USER_CORRECTION_KIND
                ? controls.filter(activeConflict).map(control => control.wrapper) : [content.element];
            for (const scope of scopes) {
                if (resolution.kind === USER_CORRECTION_KIND) {
                    appendText(documentRef, review, 'p', scope.children[0].textContent, 'fw-semibold');
                    const control = controls.find(item => item.wrapper === scope);
                    const selected = control.intentControls.find(item => item.radio.checked);
                    const state = selected?.valueState;
                    if (state?.control.type === 'PROFILE_FIELDS' && state.control.beforeValues !== undefined) {
                        for (const item of state.fieldElements) {
                            const line=documentRef.createElement('div');line.className='employee-history-comparison-row';
                            const known=(state.control.beforeValues || []).find(fact=>fact.fieldId===item.field.id);
                            const normalized=item.value();
                            const show=value=>value == null ? 'ΡΗΤΑ ΚΕΝΟ' :
                                (item.field.catalogValues || item.field.allowedValues || []).find(option=>String(option.value)===String(value))?.label ||
                                (Array.isArray(value) ? value.join(', ') || 'Όλες οι εργάσιμες ημέρες' : typeof value === 'boolean' ? value ? 'Ναι' : 'Όχι' : String(value));
                            appendText(documentRef,line,'div',`ΠΡΙΝ — ${item.field.label}: ${known ? show(known.value) : 'Δεν υπάρχει καταγεγραμμένη τιμή'}`);
                            appendText(documentRef,line,'div',`ΜΕΤΑ — ${item.field.label}: ${normalized ? show(normalized.value) : 'Χρειάζεται πραγματική τιμή'}`);
                            review.appendChild(line);
                        }
                        continue;
                    }
                    const candidate = [...(state?.control.baselineValues || []), ...(state?.control.allowedValues || [])]
                        .find(item => item.value === state?.element.value);
                    if (candidate?.summary) {
                        appendText(documentRef, review, 'p', candidate.label);
                        for (const field of candidate.summary) appendText(documentRef, review, 'p',
                            `${field.label}: ${field.value?.label || 'Δεν υπάρχει καταχωρισμένη τιμή'}`);
                    }
                }
                for (const input of walk(scope).filter(node => !node.disabled &&
                    (['radio', 'date', 'number', 'checkbox', 'select-one'].includes(node.type) ||
                    String(node.tagName).toLowerCase() === 'select'))) {
                    if (input.type === 'radio' && !input.checked || input.type === 'hidden') continue;
                    const label = Array.from(input.parentElement?.children || []).find(node =>
                        String(node.tagName).toLowerCase() === 'label');
                    if (input.type === 'radio') {
                        appendText(documentRef, review, 'p', label?.textContent || 'Επιλεγμένη απάντηση');
                    } else {
                        const option = Array.from(input.children || []).find(node => node.value === input.value);
                        const value = input.type === 'date' ? String(input.value).split('-').reverse().join('/')
                            : input.type === 'checkbox' ? input.checked ? 'Ναι' : 'Όχι' : option?.textContent || input.value;
                        appendText(documentRef, review, 'p', `${label?.textContent || controls.find(control => control.dateInput === input)?.question?.label || 'Τιμή'}: ${value}`);
                    }
                }
            }
        }
        function reveal(node) {
            while (node && node !== content.element && node !== root) { node.hidden = false; node = node.parentElement; }
        }
        function refresh(focus = false) {
            if (refreshing) return;
            refreshing = true;
            try {
                const active = pages.filter(item => item.active());
                index = Math.min(index, active.length - 1);
                const current = active[index];
                // selected() also refreshes conditional controls. Validate before
                // applying step visibility, otherwise completed questions reopen.
                const valid = current.valid();
                for (const node of [...originalNodes, intro, details, review, approval, ...supplementalNodes,
                    ...(resolution.kind === GUIDED_KIND ? [] : controls.map(control => control.wrapper).filter(Boolean))]) node.hidden = true;
                const nodes = typeof current.nodes === 'function' ? current.nodes() : current.nodes;
                for (const node of nodes) reveal(node);
                if (nodes.includes(intro)) details.hidden = false;
                progress.textContent = `Βήμα ${index + 1} από ${active.length}`;
                instruction.textContent = `${index + 1}. ${current.title}`;
                back.disabled = busy || index === 0;
                next.textContent = !isSafe && readOnly && index === active.length - 2 ? 'Έλεγχος αλλαγών' : 'Συνέχεια';
                next.hidden = index === active.length - 1;
                setImportantStyle(next, 'display', next.hidden ? 'none' : 'inline-flex');
                next.disabled = busy || !valid;
                pendingMessage.hidden=busy || valid;
                pendingMessage.textContent=pendingMessage.hidden ? '' :
                    `Για να συνεχίσεις, χρειάζονται οι απαντήσεις αυτού του βήματος. 1. Συμπλήρωσε τα πεδία που επισημαίνονται παραπάνω ή σημείωσε την απαιτούμενη επιβεβαίωση. 2. ${next.hidden ? 'Πάτησε την τελική επιβεβαίωση όταν ενεργοποιηθεί.' : `Πάτησε «${next.textContent}».`} Δεν αποθηκεύτηκε καμία αλλαγή.`;
                const confirm = swal.getConfirmButton?.();
                if (confirm) {
                    confirm.hidden = blocked || index !== active.length - 1;
                    setImportantStyle(confirm, 'display', confirm.hidden ? 'none' : 'inline-block');
                    confirm.disabled = busy || blocked || index !== active.length - 1 || !valid;
                }
                if (focus) { instruction.focus?.(); root.scrollIntoView?.({ block: 'nearest' }); }
            } finally { refreshing = false; }
        }
        const move = delta => {
            if (busy || delta > 0 && !pages.filter(item => item.active())[index].valid()) return;
            if (delta < 0) {
                accepted.checked = false;
                if (content.responsibilityCheckbox) {
                    content.responsibilityCheckbox.checked = false;
                    content.responsibilityCheckbox.dispatchEvent?.(new Event('change'));
                }
                for (const input of content.confirmationElements || []) if (input.type === 'checkbox') {
                    input.checked = false; input.dispatchEvent?.(new Event('change'));
                }
            }
            swal.resetValidationMessage?.();
            renderReview();
            index = Math.max(0, Math.min(pages.filter(item => item.active()).length - 1, index + delta));
            refresh(true);
        };
        walk(content.element).filter(node => node.type && node.type !== 'hidden').forEach((input, index) => {
            const siblings=Array.from(input.parentElement?.children || []);
            const candidates=['radio','checkbox'].includes(input.type) ? siblings
                : siblings.slice(0,siblings.indexOf(input)).reverse();
            const label = candidates.find(node =>
                String(node.tagName).toLowerCase() === 'label' && !node.htmlFor);
            if (label) {
                input.id = `employee-history-step-input-${index}`;
                label.htmlFor = input.id;
            }
        });
        const invalidateApproval = event => {
            if (event.target === accepted || event.target === content.responsibilityCheckbox ||
                (content.confirmationElements || []).includes(event.target)) return;
            accepted.checked = false;
            if (content.responsibilityCheckbox?.checked) {
                content.responsibilityCheckbox.checked = false;
                content.responsibilityCheckbox.dispatchEvent?.(new Event('change'));
            }
            refresh();
        };
        content.element.addEventListener('input', invalidateApproval);
        content.element.addEventListener('change', invalidateApproval);
        back.addEventListener('click', () => move(-1));
        next.addEventListener('click', () => move(1));
        root.addEventListener('employee-history-next-field', () => {
            refresh();
            if (!next.hidden && !next.disabled) move(1);
            else if (!busy) walk(content.element).find(node=>node.getAttribute?.('aria-invalid')==='true' &&
                !node.disabled && (!node.getClientRects || node.getClientRects().length>0))?.focus?.();
        });
        accepted.addEventListener('change', () => refresh());
        return { element: root, refresh,
            canSubmit: () => !blocked && index === pages.filter(item => item.active()).length - 1 &&
                pages.filter(item => item.active())[index].valid(),
            setBusy(value) { busy = value; refresh(); },
            confirmText: readOnly ? 'Έλεγχος αλλαγών' : isSafe ? 'Επιβεβαίωση διόρθωσης' : 'Επιβεβαίωση και αποθήκευση' };
    }

    async function handleInitialResponse({ response, originalPayload, retryRequest,
        swal, documentRef, windowRef = typeof window !== 'undefined' ? window : null, entryLabel = '' } = {}) {
        let resolution = await readResolutionFromResponse(response);
        if (!resolution) return { handled: false, response };
        if (typeof retryRequest !== 'function' || !swal || !documentRef) {
            return { handled: false, response };
        }

        if (typeof swal.close === 'function') swal.close();
        let steps = null;
        const setConfirmValidity = valid => {
            if (steps) { steps.refresh(); return; }
            const confirmButton = typeof swal.getConfirmButton === 'function'
                ? swal.getConfirmButton() : null;
            if (confirmButton) confirmButton.disabled = !valid;
        };
        const totalCorrection = ['REVIEW_INITIAL','INITIAL_FROM_HIRE','FILL_MISSING_PERIODS','RECONCILE_HISTORY']
            .includes(originalPayload?.correction?.intent);
        let content = buildSafeContent(documentRef, resolution, setConfirmValidity, totalCorrection);
        const guided = resolution.kind === GUIDED_KIND || resolution.kind === FACT_KIND ||
            resolution.kind === USER_CORRECTION_KIND;
        let safeCorrection = resolution.kind === SAFE_CORRECTION_KIND;
        const correction = resolution.kind === USER_CORRECTION_KIND || safeCorrection;
        let blocked = safeCorrection && resolution.phase === 'BLOCKED';
        steps = createGuidedSteps(documentRef, content, resolution, swal, originalPayload, entryLabel);
        let attempted = false;
        const correctionLifecycle = correction
            ? createCorrectionModalLifecycle({ swal, documentRef, windowRef }) : null;
        const rememberedAnswers=new Map((originalPayload?.correction?.facts?.periods || [])
            .map(answer=>[answer.conflictId,answer]));
        let lastWorksheet=null;
        const rememberAnswers=payload=>{
            for(const answer of payload?.correction?.facts?.periods || [])
                rememberedAnswers.set(answer.conflictId,structuredClone(answer));
        };
        const installTotalResolution=(nextResolution,nextPayload)=>{
            originalPayload=nextPayload;
            resolution=structuredClone(nextResolution);
            if(resolution.kind===USER_CORRECTION_KIND) {
                for(const conflict of resolution.conflicts) {
                    const answer=rememberedAnswers.get(conflict.conflictId);
                    const intent=conflict.intents.find(item=>item.id===answer?.intent);
                    if(intent?.valueControl?.type==='PROFILE_FIELDS') {
                        intent.valueControl.initialValues=answer.values;
                        intent.valueControl.initialSource=answer.value;
                    }
                }
                lastWorksheet=resolution;
            }
            safeCorrection=resolution.kind===SAFE_CORRECTION_KIND;
            blocked=safeCorrection && resolution.phase==='BLOCKED';
            steps=null;
            content=buildSafeContent(documentRef,resolution,setConfirmValidity,true);
            steps=createGuidedSteps(documentRef,content,resolution,swal,originalPayload,entryLabel,true);
            if(safeCorrection && resolution.phase==='PREVIEW' && lastWorksheet) {
                const edit=appendText(documentRef,steps.element,'button','Αλλαγή απαντήσεων',
                    'employee-history-correction-action employee-history-correction-cancel');
                edit.type='button';
                edit.addEventListener('click',()=>{
                    if(swal.isLoading?.())return;
                    installTotalResolution(lastWorksheet,
                        {...originalPayload,correction:{...originalPayload.correction,confirmation:null}});
                });
            }
            attempted=false;
            swal.hideLoading?.();
            // SweetAlert appends HTMLElement content during update; explicitly
            // replace the old worksheet so only the current step is visible.
            swal.getHtmlContainer?.()?.replaceChildren();
            swal.update({titleText:resolution.title,html:steps.element,
                showConfirmButton:!blocked,confirmButtonText:steps.confirmText,
                buttonsStyling:!safeCorrection,
                customClass:{title:'custom-title',
                    popup:'custom-swal-popup employee-history-correction-popup',
                    htmlContainer:'custom-html-container employee-history-correction-html',
                    actions:'employee-history-correction-actions',
                    confirmButton:safeCorrection ? 'employee-history-correction-action employee-history-correction-confirm' : 'class-warning custom-confirm-button custom-swal-button',
                    cancelButton:safeCorrection ? 'employee-history-correction-action employee-history-correction-cancel' : 'custom-cancel-button custom-swal-button'}});
            const cancel=swal.getCancelButton?.();if(cancel)cancel.disabled=false;
            steps.refresh();
            correctionLifecycle?.recalculate();
        };
        let result;
        try {
            result = await swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            ...(correction && originalPayload?.correction ? {allowEnterKey:false} : {}),
            allowEscapeKey: () => !(typeof swal.isLoading === 'function' && swal.isLoading()),
            icon: 'warning',
            titleText: resolution.title,
            html: steps.element,
            showCancelButton: true,
            showConfirmButton: !blocked,
            ...(safeCorrection ? { buttonsStyling: false } : {}),
            focusCancel: true,
            confirmButtonText: steps.confirmText,
            cancelButtonText: 'Ακύρωση',
            showLoaderOnConfirm: true,
            didOpen: () => {
                if (guided || safeCorrection) setConfirmValidity(false);
                correctionLifecycle?.open();
                steps.refresh();
            },
            willClose: () => correctionLifecycle?.close(),
            didClose: () => correctionLifecycle?.close(),
            preConfirm: async () => {
                if (blocked || safeCorrection && attempted) return false;
                if (!steps.canSubmit()) {
                    swal.showValidationMessage?.('Δεν αποθηκεύτηκε καμία αλλαγή. Πάτησε «Συνέχεια» σε κάθε βήμα και επιβεβαίωσε τη διόρθωση στο τέλος.');
                    return false;
                }
                const selection = content.selected();
                if (!selection) {
                    if (typeof swal.showValidationMessage === 'function') {
                        swal.showValidationMessage(correction
                            ? 'Δεν αποθηκεύτηκε καμία αλλαγή. 1. Απαντήστε σε όλες τις ερωτήσεις. 2. Συμπληρώστε τα στοιχεία που ζητούνται. 3. Επιβεβαιώστε ότι ελέγξατε τις επιλογές σας.'
                            : 'Συμπληρώστε όλες τις απαιτούμενες αποφάσεις και επιβεβαιώστε την ευθύνη σας. Δεν αποθηκεύτηκε καμία αλλαγή.');
                    }
                    return false;
                }
                if (typeof swal.disableButtons === 'function') swal.disableButtons();
                try {
                    attempted = true;
                    steps.setBusy(true);
                    const nextPayload=buildRetryPayload(originalPayload,resolution,selection);
                    if(totalCorrection) {
                        rememberAnswers(nextPayload);
                        if(resolution.kind===USER_CORRECTION_KIND) lastWorksheet=resolution;
                    }
                    const nextResponse=await retryRequest(nextPayload);
                    // Total correction owns one physical popup for all facts,
                    // dependent questions and the final preview. Only the
                    // approved preview can reach the atomic save.
                    if (totalCorrection && typeof swal.update === 'function' &&
                        !nextPayload.correction?.confirmation) {
                        const nextResolution=await readResolutionFromResponse(nextResponse);
                        if (nextResolution) {
                            installTotalResolution(nextResolution,nextPayload);
                            return false;
                        }
                    }
                    return nextResponse;
                } catch (error) {
                    if (typeof swal.showValidationMessage === 'function') {
                        swal.showValidationMessage(
                            safeCorrection
                                ? 'Η εφαρμογή δεν μπόρεσε να επιβεβαιώσει αν αποθηκεύτηκε η διόρθωση. 1. Κλείστε το παράθυρο. 2. Ανοίξτε ξανά τον εργαζόμενο και ελέγξτε τα στοιχεία. 3. Ζητήστε βοήθεια αν το πρόβλημα παραμένει.'
                                : correction
                                ? 'Η αποθήκευση δεν ολοκληρώθηκε. Δεν αποθηκεύτηκε καμία αλλαγή. 1. Κλείστε αυτό το παράθυρο. 2. Ανοίξτε ξανά τον εργαζόμενο. 3. Ελέγξτε τα στοιχεία και δοκιμάστε πάλι.'
                                : 'Η επανάληψη της αποθήκευσης δεν ολοκληρώθηκε. Δεν αποθηκεύτηκε αλλαγή.'
                        );
                    }
                    if (typeof swal.enableButtons === 'function') swal.enableButtons();
                    steps.setBusy(false);
                    throw error;
                }
            },
            customClass: {
                title: 'custom-title',
                popup: correction
                    ? 'custom-swal-popup employee-history-correction-popup'
                    : 'custom-swal-popup',
                htmlContainer: correction
                    ? 'custom-html-container employee-history-correction-html'
                    : 'custom-html-container',
                ...(correction ? { actions: 'employee-history-correction-actions' } : {}),
                confirmButton: safeCorrection ? 'employee-history-correction-action employee-history-correction-confirm' : 'class-warning custom-confirm-button custom-swal-button',
                cancelButton: safeCorrection ? 'employee-history-correction-action employee-history-correction-cancel' : 'custom-cancel-button custom-swal-button'
            }
            });
        } finally {
            correctionLifecycle?.close();
        }

        if (!result?.isConfirmed) return { handled: true, cancelled: true, response: null };
        if (safeCorrection && resolution.phase === 'CHOICE' ||
            resolution.kind === USER_CORRECTION_KIND && ['REMOVE_ROW', 'CONFIRM_PERIODS', 'FILL_MISSING_PERIODS', 'RECONCILE_HISTORY'].includes(originalPayload?.correction?.intent)) {
            const selection = content.selected();
            const next = await handleInitialResponse({ response: result.value,
                originalPayload: buildRetryPayload(originalPayload,resolution,selection),
                retryRequest,swal,documentRef,windowRef,entryLabel });
            if (next.handled) return next;
        }
        const messages = {
            REMOVE_ROW: resolution.changes?.some(text => text.includes('θα αποσυρθεί'))
                ? 'Η λανθασμένη εγγραφή αποσύρθηκε. Τα παλιά αποθηκευμένα στοιχεία διατηρήθηκαν.'
                : 'Η λανθασμένη εγγραφή αφαιρέθηκε από το Ιστορικό.',
            CORRECT_DEPARTURE: 'Η ημερομηνία αποχώρησης και η τελευταία περίοδος διορθώθηκαν.',
            CANCEL_DEPARTURE: 'Η λανθασμένη αποχώρηση ακυρώθηκε.',
            REPLACE_START: 'Η εγγραφή έναρξης αντικαταστάθηκε με τα στοιχεία που επιβεβαίωσες.',
            REMOVE_RELATIONSHIP: 'Η λανθασμένη παλιά εργασιακή σχέση αφαιρέθηκε.',
            INSERT_EVENT: 'Η παλαιότερη αλλαγή όρων προστέθηκε στο Ιστορικό.',
            CONFIRM_PERIODS: 'Οι ημερομηνίες των περιόδων διορθώθηκαν σύμφωνα με την επιβεβαίωσή σου.',
            RECONCILE_HISTORY: 'Οι εγκεκριμένες περίοδοι διορθώθηκαν μαζί και το αποθηκευμένο Ιστορικό επανελέγχθηκε.',
            FILL_MISSING_PERIODS: 'Οι ελλείπουσες περίοδοι καταχωρίστηκαν με τους επιβεβαιωμένους όρους εργασίας.',
            INITIAL_FROM_HIRE: 'Η πρώτη ιστορική περίοδος καταχωρίστηκε από την επιβεβαιωμένη πρόσληψη.'
        };
        return { handled: true, cancelled: false, response: result.value,
            successMessage: messages[originalPayload?.correction?.intent] };
    }

    return Object.freeze({
        EXPECTED_VERSION,
        EXPECTED_KIND,
        EXPECTED_CHOICE,
        GUIDED_KIND,
        FACT_KIND,
        USER_CORRECTION_KIND,
        SAFE_CORRECTION_KIND,
        CORRECTION_MODAL_GAP,
        findActiveEmployeeCardBounds,
        deriveCorrectionModalBounds,
        applyCorrectionModalGeometry,
        normalizeResolutionResponse,
        readResolutionFromResponse,
        buildSafeContent,
        buildBeforeAfterField,
        buildRetryPayload,
        handleInitialResponse
    });
});
