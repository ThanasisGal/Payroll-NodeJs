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
        'CANCEL_DEPARTURE', 'REMOVE_RELATIONSHIP', 'INSERT_EVENT'];
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
            child?.querySelector?.('.card-header .sectionTitle'));
        const header = headerGroup?.querySelector?.('.card-header');
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
        setImportantStyle(popup, 'height', `${bounds.height}px`);
        setImportantStyle(popup, 'max-height', `${bounds.height}px`);
        if (bounds.maxWidth > 0) setImportantStyle(popup, 'max-width', `${bounds.maxWidth}px`);
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
            'recommendation','changes','unchanged','preview','choices','fields','fingerprint']) ||
            !['CHOICE','PREVIEW','BLOCKED'].includes(resolution.phase) ||
            !text(resolution.title) || !text(resolution.explanation) || !text(resolution.attention) ||
            !(resolution.recommendation === null || resolution.phase === 'PREVIEW' && text(resolution.recommendation)) ||
            !texts(resolution.changes) || !texts(resolution.unchanged) ||
            !exactKeys(resolution.preview,['before','after']) ||
            !rows(resolution.preview.before) || !rows(resolution.preview.after) ||
            !Array.isArray(resolution.choices) || resolution.choices.length > 6 ||
            resolution.choices.some(choice => !exactKeys(choice,['id','label']) ||
                !SAFE_INTENTS.includes(choice.id) || !text(choice.label)) ||
            new Set(resolution.choices.map(choice => choice.id)).size !== resolution.choices.length ||
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
        if (data?.resolutionRequired !== true || !isPlainObject(resolution) ||
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

    function buildCorrectionValueControl(documentRef, control, emitValidity) {
        const wrapper = documentRef.createElement('div');
        wrapper.className = 'ms-4 mt-2';
        const state = { control, wrapper, element: null, fieldElements: [] };
        if (control.type === 'PROFILE_FIELDS') {
            appendText(documentRef, wrapper, 'label', 'Ποια στοιχεία θα κρατήσουμε για αυτό το διάστημα;', 'form-label small');
            const baseline = documentRef.createElement('select');
            baseline.className = 'form-select';
            baseline.value = '';
            appendChoiceOptions(documentRef, baseline, control.baselineValues);
            wrapper.appendChild(baseline);
            state.element = baseline;
            for (const field of control.fields) {
                const fieldWrapper = documentRef.createElement('div');
                fieldWrapper.className = 'mt-2';
                appendText(documentRef, fieldWrapper, 'label', field.label,
                    'form-label small');
                const input = documentRef.createElement(field.inputType === 'CATALOG_CHOICE'
                    ? 'select' : 'input');
                input.value = '';
                input.className = field.inputType === 'CATALOG_CHOICE'
                    ? 'form-select' : 'form-control';
                if (field.inputType === 'CATALOG_CHOICE') {
                    appendChoiceOptions(documentRef, input, field.catalogValues || []);
                } else {
                    input.type = field.inputType === 'BOOLEAN' ? 'checkbox' : 'number';
                    if (field.min !== undefined) input.min = field.min;
                    if (field.max !== undefined) input.max = field.max;
                    if (field.inputType === 'DECIMAL') input.step = 'any';
                }
                input.disabled = true;
                fieldWrapper.appendChild(input);
                wrapper.appendChild(fieldWrapper);
                state.fieldElements.push({ field, input });
                if (typeof input.addEventListener === 'function') {
                    input.addEventListener('input', emitValidity);
                    input.addEventListener('change', emitValidity);
                }
            }
            if (typeof baseline.addEventListener === 'function') {
                baseline.addEventListener('change', emitValidity);
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
        if (control.type === 'PROFILE_FIELDS') {
            const values = {};
            for (const { field, input } of state.fieldElements) {
                const raw = field.inputType === 'BOOLEAN' ? input.checked : input.value;
                if (raw === '' || raw === undefined) continue;
                if (['INTEGER', 'DECIMAL'].includes(field.inputType)) {
                    const number = Number(raw);
                    if (!Number.isFinite(number) || field.min !== undefined && number < field.min ||
                        field.max !== undefined && number > field.max ||
                        field.inputType === 'INTEGER' && !Number.isInteger(number)) return null;
                    values[field.id] = number;
                } else values[field.id] = raw;
            }
            return element.value && Object.keys(values).length === state.fieldElements.length
                ? { value: element.value, values } : null;
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
        onValidityChange = () => {}) {
        const container = documentRef.createElement('div');
        appendText(documentRef, container, 'p', resolution.explanation);
        const state = { intents: {}, responsibilityAccepted: false, normalizedDecisions: null };
        const controls = [];
        const activeConflict = conflict => !conflict.condition ||
            state.intents[conflict.condition.conflictId] === conflict.condition.intent;
        const emitValidity = () => {
            const decisions = [];
            let valid = state.responsibilityAccepted === true;
            for (const control of controls) {
                const active = activeConflict(control.conflict);
                control.wrapper.hidden = !active;
                if (!active) continue;
                const intentId = state.intents[control.conflict.conflictId];
                const selected = control.intentControls.find(item => item.intent.id === intentId);
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
                            setCorrectionInputEnabled(field.input, enabled);
                        }
                        valueState.wrapper.hidden = !enabled;
                    }
                }
            }
            emitValidity();
        };

        for (const conflict of resolution.conflicts) {
            const wrapper = documentRef.createElement('section');
            wrapper.className = 'text-start border rounded p-3 mb-3';
            appendText(documentRef, wrapper, 'div', `Περίοδος: ${conflict.period.label}`,
                'fw-semibold');
            if (conflict.field?.label) appendText(documentRef, wrapper, 'div',
                conflict.field.label, 'fw-semibold mt-2');
            appendText(documentRef, wrapper, 'p', conflict.issue, 'mb-1 mt-2');
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
                radio.checked = false;
                radio.className = 'form-check-input';
                const label = documentRef.createElement('label');
                label.className = 'form-check-label';
                label.textContent = intent.label;
                intentWrapper.appendChild(radio);
                intentWrapper.appendChild(label);
                appendText(documentRef, intentWrapper, 'div', intent.description,
                    'small text-muted ms-4');
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
            controls.push({ conflict, wrapper, intentControls });
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
        container.appendChild(responsibilityWrapper);
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
        if (resolution.changes.length) section('Τι θα αλλάξει',resolution.changes);
        if (resolution.unchanged.length) section('Τι δεν θα αλλάξει',resolution.unchanged);
        if (resolution.preview.before.length || resolution.preview.after.length) {
            for (const [name, rows] of [['ΠΡΙΝ',resolution.preview.before],['ΜΕΤΑ',resolution.preview.after]]) {
                if (resolution.phase !== 'PREVIEW' && name === 'ΜΕΤΑ') continue;
                appendText(documentRef,container,'h4',name,'fs-6 fw-semibold');
                for (const row of rows) {
                    appendText(documentRef,container,'div',`${row.date}  ${row.event}`,'fw-semibold');
                    appendText(documentRef,container,'div',row.period,'small');
                    for (const detail of row.details) appendText(documentRef,container,'div',detail,'small');
                }
                if (!rows.length) appendText(documentRef,container,'p','Δεν θα παραμείνει εγγραφή αυτής της εργασιακής σχέσης.');
            }
        }
        const state = { intent: null, inputs: {}, valueControl: null, field: null, accepted: false };
        const dateInput = (key,label,nullable = false) => {
            const wrapper = documentRef.createElement('div');
            wrapper.className = 'employee-history-correction-fact mb-2';
            const input = documentRef.createElement('input'); input.type = 'date';
            input.className = 'form-control'; input.setAttribute?.('aria-label',label);
            appendText(documentRef,wrapper,'label',label,'form-label'); wrapper.appendChild(input);
            if (nullable) {
                const open = documentRef.createElement('input'); open.type = 'checkbox';
                open.className = 'form-check-input';
                appendText(documentRef,wrapper,'label','Χωρίς ημερομηνία λήξης','form-check-label');
                wrapper.appendChild(open);
                open.addEventListener('change',() => { input.disabled = open.checked === true; emit(); });
                state.inputs[key] = { input, open };
            } else state.inputs[key] = { input };
            input.addEventListener('change',emit); return wrapper;
        };
        const selected = () => {
            if (resolution.phase === 'PREVIEW') return state.accepted ? { confirmed: true } : null;
            if (resolution.phase !== 'CHOICE' || !state.intent) return null;
            const facts = {};
            for (const [key,{input,open}] of Object.entries(state.inputs)) {
                if (open?.checked === true) facts[key] = null;
                else if (validCalendarDate(input.value)) facts[key] = input.value;
                else return null;
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
                                state.valueControl = buildCorrectionValueControl(documentRef,state.field,emit);
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
            }
            container.appendChild(factsContainer);
        }
        if (resolution.phase === 'PREVIEW') {
            const checkbox = documentRef.createElement('input'); checkbox.type = 'checkbox';
            checkbox.checked = false; checkbox.className = 'form-check-input';
            const label = 'Επιβεβαιώνω ότι οι αλλαγές που εμφανίζονται είναι σωστές και θέλω να αποθηκευτούν.';
            checkbox.setAttribute?.('aria-label',label);
            appendText(documentRef,container,'label',label,'form-check-label'); container.appendChild(checkbox);
            checkbox.addEventListener('change',() => { state.accepted = checkbox.checked === true; emit(); });
        }
        emit();
        return { element: container, selected };
    }

    function buildSafeContent(documentRef, resolution, onValidityChange) {
        if (resolution.kind === SAFE_CORRECTION_KIND) return buildHistoryCorrectionContent(documentRef,resolution,onValidityChange);
        if (resolution.kind === USER_CORRECTION_KIND) {
            return buildUserCorrectionContent(documentRef, resolution, onValidityChange);
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
                : { ...payload.correction, intent: selection.intent, facts: selection.facts, confirmation: null };
            return payload;
        }
        if (resolution.kind === USER_CORRECTION_KIND) {
            if (!selection || selection.responsibilityAccepted !== true ||
                !Array.isArray(selection.decisions) || !selection.decisions.length) {
                throw new TypeError('Valid user-confirmed correction required');
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

    async function handleInitialResponse({ response, originalPayload, retryRequest,
        swal, documentRef, windowRef = typeof window !== 'undefined' ? window : null } = {}) {
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
        const guided = resolution.kind === GUIDED_KIND || resolution.kind === FACT_KIND ||
            resolution.kind === USER_CORRECTION_KIND;
        const safeCorrection = resolution.kind === SAFE_CORRECTION_KIND;
        const correction = resolution.kind === USER_CORRECTION_KIND || safeCorrection;
        const blocked = safeCorrection && resolution.phase === 'BLOCKED';
        let attempted = false;
        const correctionLifecycle = correction
            ? createCorrectionModalLifecycle({ swal, documentRef, windowRef }) : null;
        let result;
        try {
            result = await swal.fire({
            backdrop: false,
            allowOutsideClick: false,
            allowEscapeKey: () => !(typeof swal.isLoading === 'function' && swal.isLoading()),
            icon: 'warning',
            titleText: resolution.title,
            html: content.element,
            showCancelButton: true,
            showConfirmButton: !blocked,
            ...(safeCorrection ? { buttonsStyling: false } : {}),
            focusCancel: true,
            confirmButtonText: safeCorrection ? resolution.phase === 'PREVIEW' ? 'Επιβεβαίωση διόρθωσης' : 'Έλεγχος αλλαγών' : guided ? 'Συνέχεια' : resolution.option.label,
            cancelButtonText: 'Ακύρωση',
            showLoaderOnConfirm: true,
            didOpen: () => {
                if (guided || safeCorrection) setConfirmValidity(false);
                correctionLifecycle?.open();
            },
            willClose: () => correctionLifecycle?.close(),
            didClose: () => correctionLifecycle?.close(),
            preConfirm: async () => {
                if (blocked || safeCorrection && attempted) return false;
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
                    return await retryRequest(buildRetryPayload(originalPayload,
                        resolution, selection));
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
        if (safeCorrection && resolution.phase === 'CHOICE') {
            const selection = content.selected();
            const next = await handleInitialResponse({ response: result.value,
                originalPayload: buildRetryPayload(originalPayload,resolution,selection),
                retryRequest,swal,documentRef,windowRef });
            if (next.handled) return next;
        }
        return { handled: true, cancelled: false, response: result.value };
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
        buildRetryPayload,
        handleInitialResponse
    });
});
