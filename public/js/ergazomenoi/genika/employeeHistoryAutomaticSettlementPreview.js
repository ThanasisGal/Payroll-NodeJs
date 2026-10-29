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
    // Uncertain acknowledgements retain the SAME approval even after closing.
    const pendingApprovals = new Map();
    const answers = new Map();
    const text = (tag, value, parent = body) => {
        const node = document.createElement(tag);
        node.textContent = value;
        parent.appendChild(node);
        return node;
    };
    function reset() {
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
        body.replaceChildren();
        report.replaceChildren();
        body.hidden = false;
        report.hidden = true;
        details.hidden = true;
        approve.hidden = true;
        back.hidden = true;
        approve.disabled = true;
        title.textContent = 'Αυτόματη Τακτοποίηση Ιστορικού';
    }
    const unknownMessage = 'Ο έλεγχος του Ιστορικού δεν έδωσε ασφαλή πρόταση για αυτόματη τακτοποίηση. Η αυτόματη τακτοποίηση σταμάτησε. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Επικοινωνήστε με τον διαχειριστή για έλεγχο του Ιστορικού.\n2. Πατήστε «Συνέχεια» ή «Κλείσιμο» και συνεχίστε τις λειτουργίες που δεν εξαρτώνται από αυτό.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-3Α.';
    function notice(message, warning = false) {
        const node = text('p', message);
        node.className = `alert ${warning ? 'alert-warning' : 'alert-info'} employee-settlement-message`;
        return node;
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
            node.querySelectorAll('input').forEach(input => {
                input.disabled = node.hidden || Boolean(input.closest('.employee-settlement-option-inputs')?.hidden);
            });
        });
        approve.disabled = applying || (preview.state === 'decision' ? !validAnswers() : approved);
    }
    function dateControl(spec, parent, onChange) {
        const label = text('label', spec.label, parent);
        label.className = 'form-label mt-2';
        const input = document.createElement('input');
        input.type = 'date';
        input.className = 'form-control';
        input.id = `settlement-date-${spec.id}-${parent.querySelectorAll('input').length}`;
        label.htmlFor = input.id;
        input.required = spec.required === true;
        if (spec.min) input.min = spec.min;
        if (spec.max) input.max = spec.max;
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
            if (question.type === 'DATE') {
                dateControl(question, group, input => {
                    answers.set(question.id, { value: input.value, label: `${question.label}: ${input.value}`,
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
            value.state === 'decision' && !value.questions.length) throw new Error('Invalid preview');
        preview = value;
        continueButton.hidden = false;
        if (value.state === 'clean') notice('Το Ιστορικό ελέγχθηκε και είναι σωστό');
        else if (value.state === 'automatic') {
            notice('Το Ιστορικό μπορεί να τακτοποιηθεί αυτόματα. Η έγκρισή σας αφορά μόνο την προεπισκόπηση· η αποθήκευση παραμένει ανενεργή.');
            approve.textContent = 'Έγκριση & Τακτοποίηση';
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
        } else notice(unknownMessage, true);
        details.hidden = value.state === 'unknown';
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
        approve.hidden = true;
        back.hidden = false;
        title.textContent = 'Προβολή διορθώσεων';
        back.focus();
    }
    details.addEventListener('click', showReport);
    function acceptExecution(payload, employeeId) {
        decisionEnabled = payload.decisionEnabled === true;
        changeChoice.hidden = !payload.businessDecision;
        if (!syntheticExecution) return;
        if (preview.state === 'automatic' && payload.executionMode === 'SYNTHETIC_ONLY' &&
            /^[A-Za-z0-9_-]{43}$/.test(payload.approvalFingerprint || '')) {
            execution = { employeeId, preview, approval: { confirmed: true, fingerprint: payload.approvalFingerprint },
                ...(payload.businessDecision ? { businessDecision: payload.businessDecision } : {}) };
            changeChoice.hidden = !payload.businessDecision;
            intro.textContent = 'Απομονωμένη συνθετική δοκιμή. Η έγκριση καλύπτει ολόκληρη την πρόταση και τις υποθέσεις της.';
        }
    }
    async function resolveDecision(businessDecision) {
        if (!decisionEnabled || applying || request || closing) return;
        const currentEmployee = employee.value, currentGeneration = ++generation;
        execution = null;
        approved = false;
        body.hidden = false;
        report.hidden = true;
        back.hidden = true;
        title.textContent = 'Αυτόματη Τακτοποίηση Ιστορικού';
        request = new AbortController();
        approve.disabled = true;
        details.disabled = true;
        changeChoice.disabled = true;
        body.setAttribute('aria-busy', 'true');
        try {
            const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
            const response = await fetch(`/api/ergazomenoi/${encodeURIComponent(currentEmployee)}/history-automatic-settlement-resolve`, {
                method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: request.signal,
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'CSRF-Token': csrf, 'X-CSRF-Token': csrf },
                body: JSON.stringify({ businessDecision }) });
            const payload = await response.json();
            if (generation !== currentGeneration) return;
            if (!response.ok || response.redirected || payload.success !== true || employee.value !== currentEmployee) throw Error('Invalid decision');
            body.replaceChildren();
            answers.clear();
            changeChoice.hidden = true;
            approve.hidden = true;
            render(payload.settlementPreview);
            acceptExecution(payload, currentEmployee);
        } catch (error) {
            if (generation === currentGeneration && error.name !== 'AbortError') {
                body.replaceChildren();
                approve.hidden = true;
                changeChoice.hidden = true;
                details.hidden = true;
                notice(unknownMessage, true);
            }
        } finally {
            if (generation === currentGeneration) {
                request = null;
                details.disabled = false;
                changeChoice.disabled = false;
                body.removeAttribute('aria-busy');
            }
        }
    }
    changeChoice.addEventListener('click', () => resolveDecision(null));
    continueButton.addEventListener('click', () => { if (!applying) modal.hide(); });
    const uncertainMessage = 'Δεν επιβεβαιώθηκε αν καταχωρίστηκε η τακτοποίηση του Ιστορικού. Παραμένει άγνωστο αν αποθηκεύτηκαν αλλαγές.\n1. Πατήστε «Επανάληψη με την ίδια έγκριση».\n2. Αν το αποτέλεσμα παραμένει άγνωστο, επικοινωνήστε με τον διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-ΑΥΤ-3Β-ΑΒ.';
    approve.addEventListener('click', async () => {
        if (!preview || approve.disabled || applying) return;
        if (preview.state === 'automatic') {
            if (syntheticExecution && execution) {
                if (employee.value !== execution.employeeId) return;
                applying = true;
                approve.disabled = true;
                details.disabled = true;
                changeChoice.hidden = true;
                body.setAttribute('aria-busy', 'true');
                element.querySelectorAll('[data-bs-dismiss="modal"]').forEach(node => { node.disabled = true; });
                pendingApprovals.set(execution.employeeId, execution);
                try {
                    const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
                    const response = await fetch(`/api/ergazomenoi/${encodeURIComponent(execution.employeeId)}/history-automatic-settlement-apply`, {
                        method: 'POST', credentials: 'same-origin', cache: 'no-store',
                        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'CSRF-Token': csrf, 'X-CSRF-Token': csrf },
                        body: JSON.stringify({ approval: execution.approval,
                            ...(execution.businessDecision ? { businessDecision: execution.businessDecision } : {}) }) });
                    const payload = await response.json();
                    if (employee.value !== execution.employeeId) throw new Error('Employee changed');
                    if (response.redirected || payload.outcome === 'UNKNOWN' || payload.code?.endsWith('_COMMIT_UNCERTAIN')) throw new Error('Unknown outcome');
                    body.replaceChildren();
                    if (response.ok && payload.success === true && payload.historyStatus === 'CLEAN') {
                        pendingApprovals.delete(execution.employeeId);
                        completed = payload.corrections;
                        approved = true;
                        intro.hidden = true;
                        details.hidden = false;
                        notice('Το Ιστορικό τακτοποιήθηκε επιτυχώς');
                        approve.hidden = true;
                        continueButton.hidden = false;
                    } else if (payload.success === false && typeof payload.message === 'string') {
                        // A later denial cannot resolve an earlier uncertain commit.
                        if (execution.uncertain) throw new Error('Earlier outcome still unknown');
                        pendingApprovals.delete(execution.employeeId);
                        execution = null;
                        approve.hidden = true;
                        details.hidden = true;
                        notice(payload.message, true);
                    } else throw new Error('Unknown outcome');
                } catch {
                    execution.uncertain = true;
                    body.replaceChildren();
                    notice(uncertainMessage, true);
                    approve.textContent = 'Επανάληψη με την ίδια έγκριση';
                    approve.disabled = false;
                    details.hidden = true;
                } finally {
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
        details.hidden = false;
        approve.hidden = Boolean(completed) || !['automatic', 'decision'].includes(preview.state);
        title.textContent = 'Αυτόματη Τακτοποίηση Ιστορικού';
        details.focus();
    });
    element.addEventListener('hide.bs.modal', event => {
        if (applying) { event.preventDefault(); return; }
        if (event.defaultPrevented) return;
        closing = true;
        generation += 1;
        request?.abort();
        request = null;
        trigger.disabled = false;
        body.removeAttribute('aria-busy');
    });
    element.addEventListener('hidden.bs.modal', () => { reset(); closing = false; trigger.focus(); });
    window.employeeHistoryAutomaticSettlementPreview = { async open() {
        if (request || closing || element.classList.contains('show')) return;
        reset();
        const currentGeneration = ++generation, currentEmployee = employee.value;
        request = new AbortController();
        trigger.disabled = true;
        body.setAttribute('aria-busy', 'true');
        text('p', 'Γίνεται έλεγχος του Ιστορικού…');
        modal.show();
        if (pendingApprovals.has(currentEmployee)) {
            execution = pendingApprovals.get(currentEmployee);
            preview = execution.preview;
            body.replaceChildren();
            notice(uncertainMessage, true);
            intro.hidden = true;
            approve.hidden = false;
            approve.disabled = false;
            approve.textContent = 'Επανάληψη με την ίδια έγκριση';
            request = null;
            trigger.disabled = false;
            body.removeAttribute('aria-busy');
            return;
        }
        try {
            const response = await fetch(`/api/ergazomenoi/${encodeURIComponent(currentEmployee)}/history-reconstruction-preview?presentation=settlement`,
                { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: request.signal,
                    headers: { Accept: 'application/json' } });
            if (!response.ok || response.redirected) throw new Error('Unavailable');
            const payload = await response.json();
            if (currentGeneration !== generation) return;
            if (employee.value !== currentEmployee) throw new Error('Employee changed');
            if (payload.success !== true) throw new Error('Unavailable');
            body.replaceChildren();
            render(payload.settlementPreview);
            acceptExecution(payload, currentEmployee);
        } catch (error) {
            if (error.name !== 'AbortError' && currentGeneration === generation) {
                reset();
                continueButton.hidden = false;
                notice(unknownMessage, true);
            }
        } finally {
            if (currentGeneration === generation) {
                request = null;
                trigger.disabled = false;
                body.removeAttribute('aria-busy');
            }
        }
    } };
});
