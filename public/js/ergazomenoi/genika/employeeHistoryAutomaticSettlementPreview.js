'use strict';

// Normal employee forms are read-only, regardless of response capabilities.
// Execution additionally requires the explicit isolated test-template marker.
document.addEventListener('DOMContentLoaded', () => {
    const element = document.getElementById('employeeSettlementPreviewModal');
    const employee = document.getElementById('istorikoEmployeeId');
    if (!element || !employee || !globalThis.bootstrap?.Modal) return;
    document.body.appendChild(element);
    const modal = bootstrap.Modal.getOrCreateInstance(element);
    const syntheticExecution = element.dataset.executionMode === 'SYNTHETIC_ONLY';
    const body = document.getElementById('employeeSettlementPreviewBody');
    const report = document.getElementById('employeeSettlementPreviewReport');
    const details = document.getElementById('employeeSettlementPreviewDetails');
    const why = document.getElementById('employeeSettlementPreviewWhy');
    const approve = document.getElementById('employeeSettlementPreviewApprove');
    const back = document.getElementById('employeeSettlementPreviewBack');
    const title = document.getElementById('employeeSettlementPreviewTitle');
    const trigger = document.getElementById('employeeHistoryReconstructionPreviewBtn');
    const intro = element.querySelector('.modal-body > p');
    const originalIntro = intro.textContent;
    const continueButton = document.getElementById('employeeSettlementPreviewContinue');
    const changeChoice = document.getElementById('employeeSettlementPreviewChangeChoice');
    let request = null, generation = 0, preview = null, approved = false, closing = false;
    let execution = null, applying = false, completed = null;
    let decisionEnabled = false;
    const busy = (button, message) => window.employeeHistoryGuidedResolution?.beginButtonBusy?.(button, message) || (() => {});
    let finishTrigger = () => {}, finishDecision = () => {}, finishProgress = () => {};
    const progress = message => window.employeeHistoryGuidedResolution?.beginRegionBusy?.(element.querySelector('.modal-body'), message) || (() => {});
    // Only isolated synthetic/dev retries may retain an executable approval.
    const pendingApprovals = new Map();
    // NORMAL diagnostics survive modal reset, but never contain reusable UI state.
    const blockedAttempts = new Map();
    const scopeIdentity = () => JSON.stringify([employee.value,
        document.getElementById('company_kod')?.value || '', document.getElementById('team')?.value || '',
        document.querySelector('meta[name="csrf-token"]')?.content || document.querySelector('input[name="_csrf"]')?.value || '']);
    const activeScope = scopeIdentity();
    let reloadRequired = false, reloadMessage = null;
    const answers = new Map();
    const correctionControls = new Map();
    const text = (tag, value, parent = body) => {
        const node = document.createElement(tag);
        node.textContent = value;
        parent.appendChild(node);
        return node;
    };
    function reset() {
        finishProgress();
        for (const [key, attempt] of pendingApprovals) if (attempt.normal) pendingApprovals.delete(key);
        preview = null;
        approved = false;
        execution = null;
        completed = null;
        decisionEnabled = false;
        changeChoice.hidden = true;
        intro.hidden = false;
        intro.textContent = originalIntro;
        continueButton.hidden = true;
        answers.clear();
        correctionControls.clear();
        body.replaceChildren();
        report.replaceChildren();
        body.hidden = false;
        report.hidden = true;
        details.hidden = true;
        if (why) { why.hidden = true; why.setAttribute('aria-expanded', 'false'); }
        approve.hidden = true;
        back.hidden = true;
        approve.disabled = true;
        title.textContent = 'Αυτόματη Τακτοποίηση Ιστορικού';
    }
    const unknownMessage = 'Ο έλεγχος του Ιστορικού δεν έδωσε ασφαλή πρόταση για αυτόματη τακτοποίηση. Η αυτόματη τακτοποίηση σταμάτησε. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Επικοινωνήστε με τον διαχειριστή για έλεγχο του Ιστορικού.\n2. Πατήστε «Συνέχεια» ή «Κλείσιμο» και συνεχίστε τις λειτουργίες που δεν εξαρτώνται από αυτό.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-3Α.';
    const technicalMessage = 'Ο έλεγχος του Ιστορικού σταμάτησε επειδή δεν ολοκληρώθηκε η φόρτωση της προεπισκόπησης. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Πατήστε «Επανάληψη ελέγχου».\n2. Αν το πρόβλημα παραμένει, ανοίξτε ξανά τη σελίδα ή επικοινωνήστε με τον διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-3Τ.';
    const reviewMessage = 'Βρέθηκε πρόταση τακτοποίησης, αλλά δεν επιβεβαιώθηκε ότι μπορεί να παρουσιαστεί με ασφάλεια για ολόκληρο το Ιστορικό. Η αυτόματη τακτοποίηση σταμάτησε. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Ζητήστε από τον διαχειριστή να ελέγξει την πρόταση και τα ιστορικά στοιχεία.\n2. Πατήστε «Συνέχεια» ή «Κλείσιμο» για τις ανεξάρτητες λειτουργίες.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-3Α.';
    function notice(message, warning = false) {
        const node = body.querySelector('.employee-settlement-message') || text('p', message);
        node.id = 'employeeSettlementPreviewMessage';
        node.textContent = message;
        node.className = `alert ${warning ? 'alert-warning' : 'alert-info'} employee-settlement-message`;
        return node;
    }
    function blockedPreview(payload, employeeId) {
        if (payload?.outcome !== 'BLOCKED') return false;
        blockedAttempts.set(activeScope, Object.freeze({ employeeId, code: payload.code }));
        preview = null;
        execution = null;
        decisionEnabled = false;
        body.replaceChildren();
        notice(recoveryBlockedMessage, true);
        intro.hidden = true;
        continueButton.hidden = false;
        approve.hidden = false;
        approve.disabled = true;
        approve.textContent = 'Απαιτείται έλεγχος διαχειριστή';
        details.hidden = true;
        changeChoice.hidden = true;
        return true;
    }
    function technicalFailure(retry) {
        execution = null;
        approved = false;
        body.replaceChildren();
        body.hidden = false;
        report.hidden = true;
        approve.hidden = true;
        details.hidden = true;
        if (why) { why.hidden = true; why.setAttribute('aria-expanded', 'false'); }
        back.hidden = true;
        changeChoice.hidden = true;
        continueButton.hidden = false;
        notice(technicalMessage, true);
        const button = text('button', 'Επανάληψη ελέγχου');
        button.type = 'button';
        button.className = 'btn btn-brown rounded-4';
        button.addEventListener('click', async () => {
            const finish = busy(button, 'Επαναλαμβάνεται ο έλεγχος…');
            try { await retry(); } finally { finish(); }
        });
    }
    function questionVisible(question) {
        return !question.condition || answers.get(question.condition.questionId)?.value === question.condition.equals;
    }
    function validAnswers() {
        return preview.questions.every(question => !questionVisible(question) ||
            answers.get(question.id)?.valid === true);
    }
    function refresh() {
        body.querySelectorAll('[data-question]').forEach(node => {
            const question = preview.questions.find(item => item.id === node.dataset.question);
            node.hidden = !questionVisible(question);
            if (question.type === 'HISTORY_FACTS') return;
            node.querySelectorAll('input').forEach(input => {
                input.disabled = node.hidden || Boolean(input.closest('.employee-settlement-option-inputs')?.hidden);
            });
        });
        approve.disabled = applying || Boolean(request) || reloadRequired || blockedAttempts.has(activeScope) ||
            (preview.state === 'decision' ? !validAnswers() : approved);
    }
    function dateControl(spec, parent, onChange) {
        const label = text('label', spec.label, parent);
        label.className = 'form-label mt-2';
        const input = document.createElement('input');
        input.type = spec.type === 'DECIMAL' ? 'number' : 'date';
        input.className = 'form-control';
        input.id = `settlement-date-${spec.id}-${parent.querySelectorAll('input').length}`;
        label.htmlFor = input.id;
        input.required = spec.required === true;
        if (spec.min !== undefined) input.min = spec.min;
        if (spec.max !== undefined) input.max = spec.max;
        if (spec.step !== undefined) input.step = spec.step;
        parent.appendChild(input);
        input.addEventListener('input', () => onChange(input));
        return input;
    }
    function renderQuestions() {
        for (const question of preview.questions) {
            const group = document.createElement('fieldset');
            group.dataset.question = question.id;
            body.appendChild(group);
            text('legend', question.label, group);
            if (question.type === 'HISTORY_FACTS') {
                const content = globalThis.employeeHistoryGuidedResolution.buildSafeContent(document,
                    question.resolution, valid => {
                        answers.set(question.id, { valid, label: question.label });
                        refresh();
                    }, true);
                correctionControls.set(question.id, content);
                // The same factual questions can occur in successive cycles.
                // Keep their radio groups separate and their labels accessible.
                content.element.querySelectorAll('input,select,textarea').forEach((control,index) => {
                    const previousId = control.id;
                    control.id = `settlement-${question.id}-${index}`;
                    if (control.name) control.name = `settlement-${question.id}-${control.name}`;
                    content.element.querySelectorAll('label').forEach(label => {
                        if (previousId && label.htmlFor === previousId) label.htmlFor = control.id;
                    });
                    const label = control.parentElement.querySelector(':scope > label');
                    if (label && !label.htmlFor) label.htmlFor = control.id;
                });
                group.appendChild(content.element);
                continue;
            }
            if (['DATE', 'DECIMAL'].includes(question.type)) {
                dateControl(question, group, input => {
                    answers.set(question.id, { value: question.type === 'DECIMAL' ? Number(input.value) : input.value, label: `${question.label}: ${input.value}`,
                        valid: Boolean(input.value) && input.checkValidity() });
                    refresh();
                });
                continue;
            }
            for (const [index, option] of question.options.entries()) {
                const choice = document.createElement('div');
                choice.className = 'employee-settlement-choice';
                const input = document.createElement('input');
                input.type = 'radio';
                input.className = 'form-check-input';
                input.name = `settlement-${question.id}`;
                input.id = `settlement-${question.id}-${index}`;
                input.value = option.id;
                choice.appendChild(input);
                const label = text('label', option.label, choice);
                label.htmlFor = input.id;
                group.appendChild(choice);
                if (option.description) text('p', option.description, group).className = 'text-muted';
                const extra = document.createElement('div');
                extra.hidden = true;
                group.appendChild(extra);
                const dates = (option.inputs || []).map(spec => dateControl({ ...spec, id: `${question.id}-${index}-${spec.id}` }, extra, () => update()));
                function update() {
                    if (!input.checked) return;
                    answers.set(question.id, { value: option.id,
                        label: option.label + dates.map(date => ` — ${date.value}`).join(''),
                        ...(dates.length ? { answers: Object.fromEntries(option.inputs.map((spec, index) => [spec.id, dates[index].value])) } : {}),
                        valid: dates.every(date => Boolean(date.value) && date.checkValidity()) });
                    refresh();
                }
                input.addEventListener('change', () => {
                    group.querySelectorAll('.employee-settlement-option-inputs').forEach(node => {
                        node.hidden = true;
                        node.querySelectorAll('input').forEach(control => { control.disabled = true; });
                    });
                    extra.hidden = !dates.length;
                    dates.forEach(date => { date.disabled = false; });
                    update();
                });
                extra.className = 'employee-settlement-option-inputs';
                dates.forEach(date => { date.disabled = true; });
            }
        }
        refresh();
    }
    function render(value) {
        const states = ['clean', 'automatic', 'decision', 'unknown', 'split'];
        if (!value || value.previewOnly !== true || !states.includes(value.state) ||
            !['questions', 'assumptions', 'actions'].every(key => Array.isArray(value[key])) ||
            !['assumptions', 'actions'].every(key => value[key].every(item => typeof item === 'string')) ||
            !value.questions.every(question => question && typeof question.id === 'string' &&
                typeof question.label === 'string' && (['DATE', 'DECIMAL'].includes(question.type) ||
                    question.type === 'HISTORY_FACTS' && question.resolution?.kind === 'USER_CONFIRMED_HISTORY_CORRECTION' &&
                        typeof globalThis.employeeHistoryGuidedResolution?.buildSafeContent === 'function' ||
                    question.type === 'SINGLE_CHOICE' && Array.isArray(question.options) && question.options.length &&
                    question.options.every(option => option && typeof option.id === 'string' && typeof option.label === 'string'))) ||
            value.state === 'decision' && !value.questions.length) throw new Error('Invalid preview');
        if (value.explanation && (typeof value.explanation.finding !== 'string' ||
            typeof value.explanation.safety !== 'string' || typeof value.explanation.reference !== 'string' ||
            typeof value.explanation.reviewed !== 'string' || typeof value.explanation.example !== 'string' ||
            !['locations', 'checks'].every(key => Array.isArray(value.explanation[key]) &&
                value.explanation[key].every(item => typeof item === 'string')))) throw new Error('Invalid explanation');
        preview = value;
        continueButton.hidden = false;
        if (value.state === 'clean') notice('Το Ιστορικό ελέγχθηκε και είναι σωστό');
        else if (value.state === 'automatic') {
            notice(value.limitation || 'Το Ιστορικό μπορεί να τακτοποιηθεί αυτόματα. Η έγκρισή σας αφορά μόνο την προεπισκόπηση· η αποθήκευση παραμένει ανενεργή.');
            approve.textContent = value.limitation ? 'Έγκριση προεπισκόπησης' : 'Έγκριση & Τακτοποίηση';
            approve.hidden = false;
            approve.disabled = false;
        } else if (value.state === 'decision') {
            notice('Χρειάζεται να επιλέξετε τι συνέβη πραγματικά. Οι επιλογές σας θα εμφανιστούν μόνο στην προεπισκόπηση. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Επιλέξτε τα πραγματικά στοιχεία.\n2. Πατήστε «Προεπισκόπηση επιλογών».');
            renderQuestions();
            approve.textContent = 'Προεπισκόπηση επιλογών';
            approve.hidden = false;
        } else if (value.state === 'split') {
            notice('Η προτεινόμενη διάσπαση επαληθεύτηκε. Η αποθήκευση νέων περιόδων παραμένει ανενεργή. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Πατήστε «Προβολή διορθώσεων» για να δείτε τις διαδοχικές περιόδους.\n2. Πατήστε «Συνέχεια» ή «Κλείσιμο» για να συνεχίσετε τις ανεξάρτητες εργασίες.\nΚωδικός αναφοράς: ΙΣΤ-ΔΙΑΣΠ-01.', true);
            approve.hidden = true;
            continueButton.hidden = false;
        } else notice(typeof value.message === 'string' ? value.message : value.reviewRequired === true ? reviewMessage : unknownMessage, true);
        details.hidden = value.state === 'unknown';
        if (why) why.hidden = value.state !== 'unknown' || !value.explanation;
    }
    function showReport() {
        report.replaceChildren();
        function section(label, items, fallback) {
            text('h6', label, report);
            if (!items.length) return void text('p', fallback, report);
            const list = document.createElement('ul');
            items.forEach(item => text('li', item, list));
            report.appendChild(list);
        }
        section('Επιλογές', completed?.choices || preview.choices || preview.questions.filter(questionVisible).map(question => answers.get(question.id)?.label).filter(Boolean),
            preview.state === 'decision' ? 'Δεν έχουν συμπληρωθεί οι απαιτούμενες επιλογές.'
                : 'Δεν απαιτείται πρόσθετη επιχειρησιακή επιλογή.');
        section('Εγκεκριμένες υποθέσεις', completed?.assumptions || preview.assumptions, 'Δεν χρησιμοποιήθηκαν πρόσθετες υποθέσεις.');
        section(completed ? 'Καταγεγραμμένες ενέργειες' : 'Προτεινόμενες ενέργειες', completed?.actions || preview.actions, preview.state === 'decision'
            ? 'Οι επιλογές χρειάζονται επανέλεγχο πριν προκύψει εφαρμόσιμη πρόταση.' : 'Δεν προτείνονται αλλαγές.');
        text('p', completed ? 'Οι παραπάνω ενέργειες προέρχονται από την καταγραφή της αποθηκευμένης τακτοποίησης.' : approved ? 'Η έγκριση αφορά μόνο αυτή την προεπισκόπηση. Δεν αποθηκεύτηκε καμία αλλαγή.'
            : 'Δεν αποθηκεύτηκε καμία αλλαγή.', report);
        body.hidden = true;
        report.hidden = false;
        details.hidden = true;
        if (why) { why.hidden = true; why.setAttribute('aria-expanded', 'false'); }
        approve.hidden = true;
        back.hidden = false;
        title.textContent = 'Προβολή διορθώσεων';
        back.focus();
    }
    function showExplanation() {
        if (preview?.state !== 'unknown' || !preview.explanation || applying || request) return;
        const explanation = preview.explanation;
        report.replaceChildren();
        function section(label, content) {
            const section = text('section', '', report);
            section.className = 'employee-settlement-explanation-section';
            text('h6', label, section);
            content(section);
        }
        function findingText(value, parent) {
            const paragraph = text('p', '', parent);
            // Emphasize calendar dates without interpreting any text as markup.
            value.split(/(\d{2}\/\d{2}\/\d{4}|Α\/Α \d+(?:, \d+)*)/g).forEach(part => {
                if (/^(?:\d{2}\/\d{2}\/\d{4}|Α\/Α \d+)/.test(part)) text('strong', part, paragraph);
                else paragraph.appendChild(document.createTextNode(part));
            });
        }
        section('Α. Τι ελέγξαμε;', node => text('p', explanation.reviewed, node));
        section('Β. Τι βρήκαμε στο δικό σας Ιστορικό;', node => {
            text('p', explanation.finding, node);
            explanation.locations.forEach(item => findingText(item, node));
        });
        section('Γ. Ένα παράδειγμα για να καταλάβετε', node => {
            node.classList.add('employee-settlement-hypothetical');
            text('p', explanation.example, node);
        });
        section('Δ. Γιατί δεν διορθώσαμε αυτόματα το Ιστορικό;', node => text('p', explanation.safety, node));
        section('Ε. Τι πρέπει να κάνετε τώρα;', node => {
            const checks = text('ol', '', node);
            explanation.checks.forEach(item => text('li', item, checks));
        });
        text('p', 'Δεν αποθηκεύτηκε καμία αλλαγή.', report);
        text('p', `Κωδικός αναφοράς: ${explanation.reference}.`, report);
        body.hidden = true;
        report.hidden = false;
        details.hidden = true;
        approve.hidden = true;
        why.hidden = true;
        why.setAttribute('aria-expanded', 'true');
        back.hidden = false;
        title.textContent = 'Γιατί σταμάτησε ο έλεγχος;';
        back.focus();
    }
    why?.addEventListener('click', showExplanation);
    details.addEventListener('click', showReport);
    function acceptExecution(payload, employeeId) {
        decisionEnabled = payload.decisionEnabled === true;
        changeChoice.hidden = !payload.businessDecision;
        const controlledDev = ['CONTROLLED_DEV', 'NORMAL'].includes(payload.executionMode);
        if (preview.state === 'automatic' && payload.executionMode === 'NORMAL' &&
            !/^[A-Za-z0-9_-]{43}$/.test(payload.browserApprovalContext || '')) {
            approve.hidden = true;
            approve.disabled = true;
            return;
        }
        if (controlledDev ? preview.executionEnabled !== true : (!syntheticExecution || preview.executionEnabled === false)) return;
        if (preview.state === 'automatic' && (controlledDev || payload.executionMode === 'SYNTHETIC_ONLY') &&
            /^[A-Za-z0-9_-]{43}$/.test(payload.approvalFingerprint || '')) {
            execution = { employeeId, scope: activeScope, preview, normal: payload.executionMode === 'NORMAL',
                browserApprovalContext: payload.browserApprovalContext,
                approval: { confirmed: true, fingerprint: payload.approvalFingerprint },
                ...(payload.businessDecision ? { businessDecision: payload.businessDecision } : {}) };
            changeChoice.hidden = !payload.businessDecision;
            intro.textContent = controlledDev ? 'Η έγκρισή σας καλύπτει ολόκληρη την πρόταση και τις εμφανιζόμενες υποθέσεις.' : 'Απομονωμένη συνθετική δοκιμή. Η έγκριση καλύπτει ολόκληρη την πρόταση και τις υποθέσεις της.';
            approve.textContent = 'Έγκριση & Τακτοποίηση';
            notice('Η συνολική πρόταση επαληθεύτηκε. Ελέγξτε τις διορθώσεις πριν εγκρίνετε την αποθήκευση.');
        }
    }
    async function resolveDecision(businessDecision) {
        if (!decisionEnabled || applying || request || closing || !ensureScope() || blockedAttempts.has(activeScope)) return;
        const currentEmployee = employee.value, currentGeneration = ++generation;
        execution = null;
        approved = false;
        body.hidden = false;
        report.hidden = true;
        back.hidden = true;
        title.textContent = 'Αυτόματη Τακτοποίηση Ιστορικού';
        request = new AbortController();
        const finishApprove = busy(approve, 'Ελέγχονται οι επιλογές…');
        const finishChoice = busy(changeChoice, 'Ανανεώνεται η πρόταση…');
        finishDecision = () => { finishApprove(approve.disabled); finishChoice(false); };
        approve.disabled = true;
        details.disabled = true;
        changeChoice.disabled = true;
        body.setAttribute('aria-busy', 'true');
        finishProgress = progress(businessDecision ? 'Γίνεται έλεγχος των επιλογών…' : 'Γίνεται ενημέρωση της πρότασης…');
        try {
            const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
            const response = await fetch(`/api/ergazomenoi/${encodeURIComponent(currentEmployee)}/history-automatic-settlement-resolve`, {
                method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: request.signal,
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'CSRF-Token': csrf, 'X-CSRF-Token': csrf },
                body: JSON.stringify({ businessDecision }) });
            const payload = await response.json();
            if (generation !== currentGeneration || !ensureScope()) return;
            if (blockedPreview(payload, currentEmployee)) return;
            if (!response.ok || response.redirected || payload.success !== true || employee.value !== currentEmployee) throw Error('Invalid decision');
            body.replaceChildren();
            answers.clear();
            correctionControls.clear();
            changeChoice.hidden = true;
            approve.hidden = true;
            render(payload.settlementPreview);
            acceptExecution(payload, currentEmployee);
        } catch (error) {
            if (generation === currentGeneration && error.name !== 'AbortError') {
                technicalFailure(() => resolveDecision(businessDecision));
            }
        } finally {
            if (generation === currentGeneration) {
                request = null;
                finishDecision();
                finishProgress();
                if (preview) refresh();
                details.disabled = false;
                changeChoice.disabled = false;
                body.removeAttribute('aria-busy');
            }
        }
    }
    changeChoice.addEventListener('click', () => resolveDecision(null));
    continueButton.addEventListener('click', () => { if (!applying) modal.hide(); });
    const uncertainMessage = 'Δεν επιβεβαιώθηκε αν καταχωρίστηκε η τακτοποίηση του Ιστορικού. Παραμένει άγνωστο αν αποθηκεύτηκαν αλλαγές.\n1. Πατήστε «Επανάληψη με την ίδια έγκριση».\n2. Αν το αποτέλεσμα παραμένει άγνωστο, επικοινωνήστε με τον διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-3Β-ΑΒ.';
    const recoveryBlockedMessage = 'Το αποτέλεσμα της προσπάθειας τακτοποίησης παραμένει άγνωστο. Η αποθήκευση δεν μπορεί να επαναληφθεί από αυτή τη φόρμα. Δεν επιβεβαιώθηκε αν αποθηκεύτηκαν αλλαγές.\n1. Ζητήστε από τον διαχειριστή έλεγχο της μόνιμης κατάστασης.\n2. Μετά την επιβεβαίωσή του, ανανεώστε ολόκληρη τη φόρμα και ζητήστε νέα προεπισκόπηση Ιστορικού.\n3. Ελέγξτε τις προτεινόμενες διορθώσεις και δώστε νέα ξεχωριστή έγκριση μόνο στη μελλοντική πραγματική εκτέλεση.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-ΚΑΝ-02.';
    const scopeChangedMessage = 'Άλλαξε ο εργαζόμενος, η εταιρεία, η ομάδα ή η συνεδρία της φόρμας. Η προηγούμενη πρόταση ακυρώθηκε για να μην χρησιμοποιηθεί σε διαφορετικά στοιχεία. Η ακύρωση στην οθόνη δεν αποθηκεύει αλλαγές και δεν επιβεβαιώνει το αποτέλεσμα τυχόν προηγούμενης αποθήκευσης.\n1. Ανανεώστε ολόκληρη τη φόρμα στον σωστό εργαζόμενο και στη σωστή εταιρεία.\n2. Ζητήστε νέα προεπισκόπηση και ελέγξτε τις διορθώσεις πριν από νέα ξεχωριστή έγκριση.\n3. Αν εκκρεμούσε αποθήκευση, ζητήστε πρώτα έλεγχο από τον διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-ΠΛΑΙΣΙΟ-01.';
    const staleApprovalMessage = 'Η έγκριση τακτοποίησης απορρίφθηκε επειδή δεν επιβεβαιώθηκαν τα τρέχοντα στοιχεία ή η συνεδρία της πρότασης. Δεν αποθηκεύτηκε καμία αλλαγή από αυτή την προσπάθεια.\n1. Ανανεώστε ολόκληρη τη φόρμα στον σωστό εργαζόμενο και στη σωστή εταιρεία.\n2. Ζητήστε νέα προεπισκόπηση Ιστορικού και ελέγξτε τις προτεινόμενες διορθώσεις.\n3. Δώστε νέα ξεχωριστή έγκριση μόνο στη μελλοντική πραγματική εκτέλεση.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-ΕΓΚΡΙΣΗ-01.';
    function ensureScope() {
        if (scopeIdentity() !== activeScope && !reloadRequired) {
            reloadRequired = true;
            reloadMessage = scopeChangedMessage;
            generation += 1;
            request?.abort();
            request = null;
            finishTrigger(false);
            finishDecision();
            pendingApprovals.clear();
            reset();
            trigger.disabled = false;
            body.removeAttribute('aria-busy');
        }
        if (reloadRequired) {
            continueButton.hidden = false;
            intro.hidden = true;
            approve.hidden = true;
            approve.disabled = true;
            notice(reloadMessage || scopeChangedMessage, true);
        }
        return !reloadRequired;
    }
    document.addEventListener('change', ensureScope, true);
    document.addEventListener('input', ensureScope, true);
    window.addEventListener('pageshow', event => { if (event.persisted) { reloadRequired = true; reset(); } });
    approve.addEventListener('click', async () => {
        if (!ensureScope() || !preview || approve.disabled || applying || blockedAttempts.has(activeScope)) return;
        if (preview.state === 'automatic') {
            if (execution) {
                if (employee.value !== execution.employeeId || execution.scope !== activeScope || execution.recoveryBlocked) return;
                const attempt = execution, currentGeneration = generation;
                const applyRequest = new AbortController();
                const applyTimeout = setTimeout(() => applyRequest.abort(), 30000);
                applying = true;
                const finishApply = busy(approve, 'Καταχωρίζεται η εγκεκριμένη τακτοποίηση…');
                const finishApplyProgress = progress('Γίνεται εφαρμογή της εγκεκριμένης τακτοποίησης…');
                approve.disabled = true;
                details.disabled = true;
                changeChoice.hidden = true;
                body.setAttribute('aria-busy', 'true');
                element.querySelectorAll('[data-bs-dismiss="modal"]').forEach(node => { node.disabled = true; });
                pendingApprovals.set(attempt.scope, attempt);
                try {
                    const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
                    const response = await fetch(`/api/ergazomenoi/${encodeURIComponent(attempt.employeeId)}/history-automatic-settlement-apply`, {
                        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: applyRequest.signal,
                        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'CSRF-Token': csrf, 'X-CSRF-Token': csrf,
                            ...(attempt.normal ? { 'X-Employee-Settlement-Context': attempt.browserApprovalContext } : {}) },
                        body: JSON.stringify({ approval: attempt.approval,
                            ...(attempt.businessDecision ? { businessDecision: attempt.businessDecision } : {}) }) });
                    const payload = await response.json();
                    if (!ensureScope() || generation !== currentGeneration) throw new Error('Scope changed');
                    if (response.redirected || ['UNKNOWN', 'BLOCKED'].includes(payload.outcome) || payload.code?.endsWith('_COMMIT_UNCERTAIN')) throw new Error('Unknown outcome');
                    body.replaceChildren();
                    if (response.ok && payload.success === true && payload.historyStatus === 'CLEAN') {
                        if (!payload.corrections || !['actions', 'assumptions'].every(key =>
                            Array.isArray(payload.corrections[key]) && payload.corrections[key].every(item => typeof item === 'string')))
                            throw new Error('Missing recorded corrections');
                        pendingApprovals.delete(attempt.scope);
                        completed = payload.corrections;
                        approved = true;
                        intro.hidden = true;
                        details.hidden = false;
                        notice('Το Ιστορικό τακτοποιήθηκε επιτυχώς');
                        approve.hidden = true;
                        continueButton.hidden = false;
                    } else if (payload.success === false && typeof payload.message === 'string') {
                        // A later denial cannot resolve an earlier uncertain commit.
                        if (attempt.uncertain) throw new Error('Earlier outcome still unknown');
                        pendingApprovals.delete(attempt.scope);
                        execution = null;
                        approve.hidden = true;
                        details.hidden = true;
                        if (why) { why.hidden = true; why.setAttribute('aria-expanded', 'false'); }
                        if (attempt.normal) {
                            reloadRequired = true;
                            reloadMessage = staleApprovalMessage;
                        }
                        notice(attempt.normal ? staleApprovalMessage : payload.message, true);
                    } else throw new Error('Unknown outcome');
                } catch {
                    attempt.recoveryBlocked = attempt.normal;
                    attempt.uncertain = true;
                    if (attempt.normal) {
                        blockedAttempts.set(attempt.scope, Object.freeze({ employeeId: attempt.employeeId,
                            scope: attempt.scope, fingerprint: attempt.approval.fingerprint }));
                        pendingApprovals.delete(attempt.scope);
                        execution = null;
                    }
                    if (!ensureScope() || generation !== currentGeneration) return;
                    body.replaceChildren();
                    notice(attempt.recoveryBlocked ? recoveryBlockedMessage : uncertainMessage, true);
                    intro.hidden = true;
                    continueButton.hidden = false;
                    approve.textContent = attempt.recoveryBlocked ? 'Απαιτείται έλεγχος διαχειριστή' : 'Επανάληψη με την ίδια έγκριση';
                    approve.disabled = attempt.recoveryBlocked;
                    details.hidden = true;
                    if (why) { why.hidden = true; why.setAttribute('aria-expanded', 'false'); }
                } finally {
                    clearTimeout(applyTimeout);
                    finishApply(approve.disabled);
                    finishApplyProgress();
                    applying = false;
                    details.disabled = false;
                    body.removeAttribute('aria-busy');
                    element.querySelectorAll('[data-bs-dismiss="modal"]').forEach(node => { node.disabled = false; });
                }
                return;
            }
            approved = true;
            notice('Η πρόταση εγκρίθηκε μόνο για προεπισκόπηση. Η αποθήκευση δεν έχει συνδεθεί σε αυτή τη φάση. Δεν αποθηκεύτηκε καμία αλλαγή.');
            approve.disabled = true;
        } else if (preview.state === 'decision' && validAnswers()) {
            if (decisionEnabled) {
                if (preview.decisionContext) {
                    const selections = { ...preview.decisionContext.baseSelections };
                    for (const group of preview.decisionContext.groups) {
                        if (group.kind === 'MULTIPLE_GROUPS') {
                            selections[group.id]={choiceId:group.choiceId,answers:Object.fromEntries(group.questionIds.map(questionId=>
                                [questionId.slice(group.id.length+2),answers.get(questionId).value]))};
                        } else if (group.kind === 'MULTIPLE') {
                            const selected = answers.get(group.questionIds[0]);
                            selections[group.id] = { choiceId: selected.value,
                                ...(selected.answers ? { answers: selected.answers } : {}) };
                        } else if (group.kind === 'USER_CORRECTION') {
                            selections[group.id] = { confirmation: correctionControls.get(group.questionIds[0]).selected() };
                        } else {
                            const facts = {};
                            for (const questionId of group.questionIds) {
                                const question = preview.questions.find(item => item.id === questionId);
                                if (questionVisible(question)) facts[questionId.slice(group.id.length + 2)] = answers.get(questionId).value;
                            }
                            selections[group.id] = { ...group.priorSelection, [group.answerKey || 'answers']: facts };
                        }
                    }
                    await resolveDecision({ snapshotFingerprint: preview.decisionContext.snapshotFingerprint, selections });
                    return;
                }
                const selected = answers.get('businessChoice');
                await resolveDecision({ choiceId: selected?.value, ...(selected?.answers ? { answers: selected.answers } : {}) });
            }
            else showReport();
        }
    });
    back.addEventListener('click', () => {
        body.hidden = false;
        report.hidden = true;
        back.hidden = true;
        details.hidden = preview.state === 'unknown';
        if (why) { why.hidden = preview.state !== 'unknown' || !preview.explanation; why.setAttribute('aria-expanded', 'false'); }
        approve.hidden = Boolean(completed) || !['automatic', 'decision'].includes(preview.state);
        title.textContent = 'Αυτόματη Τακτοποίηση Ιστορικού';
        (preview.state === 'unknown' ? why : details)?.focus();
    });
    element.addEventListener('hide.bs.modal', event => {
        if (applying) { event.preventDefault(); return; }
        if (event.defaultPrevented) return;
        closing = true;
        generation += 1;
        request?.abort();
        request = null;
        finishTrigger(false);
        finishDecision();
        finishProgress();
        trigger.disabled = false;
        body.removeAttribute('aria-busy');
    });
    element.addEventListener('hidden.bs.modal', () => { reset(); closing = false; trigger.focus(); });
    async function openPreview(retry = false) {
        if (request || closing || element.classList.contains('show') && !retry) return;
        if (!ensureScope()) { modal.show(); return; }
        reset();
        const currentGeneration = ++generation, currentEmployee = employee.value;
        request = new AbortController();
        finishTrigger = busy(trigger, 'Ελέγχεται το Ιστορικό…');
        trigger.disabled = true;
        body.setAttribute('aria-busy', 'true');
        finishProgress = progress('Γίνεται έλεγχος του Ιστορικού…');
        modal.show();
        if (blockedAttempts.has(activeScope)) {
            notice(recoveryBlockedMessage, true);
            intro.hidden = true;
            continueButton.hidden = false;
            approve.hidden = false;
            approve.disabled = true;
            approve.textContent = 'Απαιτείται έλεγχος διαχειριστή';
            request = null;
            finishTrigger(false);
            finishProgress();
            trigger.disabled = false;
            body.removeAttribute('aria-busy');
            return;
        }
        if (pendingApprovals.has(activeScope)) {
            execution = pendingApprovals.get(activeScope);
            preview = execution.preview;
            body.replaceChildren();
            notice(execution.recoveryBlocked ? recoveryBlockedMessage : uncertainMessage, true);
            intro.hidden = true;
            approve.hidden = false;
            approve.disabled = execution.recoveryBlocked === true;
            approve.textContent = execution.recoveryBlocked ? 'Απαιτείται έλεγχος διαχειριστή' : 'Επανάληψη με την ίδια έγκριση';
            request = null;
            finishTrigger(false);
            finishProgress();
            trigger.disabled = false;
            body.removeAttribute('aria-busy');
            return;
        }
        try {
            const response = await fetch(`/api/ergazomenoi/${encodeURIComponent(currentEmployee)}/history-reconstruction-preview?presentation=settlement`,
                { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: request.signal,
                    headers: { Accept: 'application/json' } });
            const payload = await response.json();
            if (currentGeneration !== generation || !ensureScope()) return;
            if (blockedPreview(payload, currentEmployee)) return;
            if (!response.ok || response.redirected) throw new Error('Unavailable');
            if (employee.value !== currentEmployee) throw new Error('Employee changed');
            if (payload.success !== true) throw new Error('Unavailable');
            body.replaceChildren();
            render(payload.settlementPreview);
            acceptExecution(payload, currentEmployee);
        } catch (error) {
            if (error.name !== 'AbortError' && currentGeneration === generation) {
                reset();
                technicalFailure(() => openPreview(true));
            }
        } finally {
            if (currentGeneration === generation) {
                request = null;
                finishTrigger(false);
                finishProgress();
                trigger.disabled = false;
                body.removeAttribute('aria-busy');
            }
        }
    }
    window.employeeHistoryAutomaticSettlementPreview = { open: () => openPreview() };
});
