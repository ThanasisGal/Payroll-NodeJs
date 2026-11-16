'use strict';
(() => {
    const main = document.querySelector('.proposal-page'), importForm = document.getElementById('historyProposalImport');
    if (!main || !importForm) return;
    let form = document.getElementById('historyProposalEditor');
    const warning = document.getElementById('proposalSelectionWarning'), file = document.getElementById('proposalImportFile');
    const status = document.getElementById('proposalImportStatus'), issues = document.getElementById('proposalImportIssues');
    const pending = document.getElementById('proposalImportPending'), selectionStatus = document.getElementById('proposalSelectionStatus');
    const filename = document.getElementById('proposalImportFilename'), editorUrl = new URL(main.dataset.editorUrl, location.origin);
    const scopeContext = main.dataset.scopeContext;
    let unsaved = false, busy = false, serial = 0, selectedFile = null, consent;
    let applyPreview = null, pendingApplication = null, pendingControls = [];
    const applyWarning = document.getElementById('proposalApplyWarning');
    const applyConsent = document.getElementById('proposalApplyConsent');
    const applyStatus = () => document.getElementById('proposalApplyStatus');
    const applyButton = () => document.getElementById('approveProposalApply');
    function invalidateApproval() {
        applyPreview = null;
        if (applyButton()) applyButton().disabled = true;
        const preview = document.getElementById('proposalApplyPreview');
        if (preview) { preview.replaceChildren(); preview.hidden = true; }
        if (applyStatus() && !pendingApplication) applyStatus().textContent = 'Οι συμπληρώσεις άλλαξαν. Απαιτείται νέος έλεγχος πριν από την εφαρμογή. Δεν αποθηκεύτηκε αλλαγή στο Ιστορικό.';
    }
    const applicationUrl = suffix => editorUrl.pathname.replace(/history-proposal-editor$/, `history-proposal-${suffix}`);
    function completion(all = false) {
        const controls = [...form.querySelectorAll('[data-edit-index]')];
        return { caseId: form.dataset.caseId, snapshotFingerprint: form.dataset.snapshot, context: form.dataset.context,
            changes: controls.filter(control => all || control.dataset.edited === 'true').map(control => ({ index: Number(control.dataset.editIndex),
                value: control.multiple ? control.dataset.importedNull === 'true' ? '' : [...control.selectedOptions].map(option => Number(option.value)) : control.value })) };
    }
    function currentProposal() { return { selection: activeSelection(), completion: completion(form.dataset.operation === 'INSERT') }; }
    async function applicationRequest(suffix, body) {
        const response = await fetch(applicationUrl(suffix), { method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content }, body: JSON.stringify(body) });
        const result = await response.json().catch(() => null);
        if (!result || response.redirected) throw Error();
        return result;
    }
    function renderApplicationPreview(result) {
        const region = document.getElementById('proposalApplyPreview'); region.replaceChildren();
        const context = document.createElement('p');
        context.textContent = `Εργαζόμενος ${result.employeeCode} · ${result.operation} · ${result.historySequence ? `Εγγραφή ${result.historySequence}` : 'Νέα ιστορική εγγραφή'} · ${result.period.from} – ${result.period.to || 'χωρίς λήξη'}`;
        region.append(context);
        const scroll = document.createElement('div'); scroll.className = 'proposal-table-scroll'; scroll.tabIndex = 0;
        scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Ακριβείς αλλαγές προς έγκριση');
        const table = document.createElement('table'), head = table.createTHead().insertRow();
        for (const text of ['Πεδίο', 'Αποθηκευμένο ΠΡΙΝ', 'ΜΕΤΑ προς έγκριση']) { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = text; head.append(cell); }
        const body = table.createTBody();
        for (const item of result.rows) {
            const row = body.insertRow();
            for (const value of [item.field, item.before, item.after]) row.insertCell().textContent = value === null ? 'Κενό' : Array.isArray(value) ? value.join(', ') : String(value);
        }
        scroll.append(table); region.append(scroll);
        const evidence = document.createElement('p'); evidence.textContent = `Τεκμήριο: ${result.evidence}`; region.append(evidence); region.hidden = false;
    }
    async function previewApplication() {
        if (busy || pendingApplication || !form?.reportValidity()) return;
        invalidateApproval(); const proposal = currentProposal(), { release } = freezeControls();
        applyStatus().textContent = 'Γίνεται νέος έλεγχος των τρεχόντων στοιχείων…';
        try {
            const result = await applicationRequest('apply-preview', proposal);
            if (!result.success || result.saved !== false || result.previewOnly !== true || !Array.isArray(result.rows) || !result.approval?.token) {
                applyStatus().textContent = result.message || failure('Δεν επιβεβαιώθηκε η προεπισκόπηση.'); return;
            }
            renderApplicationPreview(result); applyPreview = { proposal, result };
            applyStatus().textContent = result.message + (result.executionEnabled ? '' : ' Η πραγματική εφαρμογή παραμένει απενεργοποιημένη.');
        } catch { applyStatus().textContent = failure('Η προεπισκόπηση δεν φορτώθηκε.'); }
        finally { release(); if (applyButton()) applyButton().disabled = !applyPreview?.result.executionEnabled; }
    }
    function showApplicationConsent() {
        if (busy || !applyPreview?.result.executionEnabled || pendingApplication) return;
        if (JSON.stringify(currentProposal()) !== JSON.stringify(applyPreview.proposal)) { invalidateApproval(); return; }
        applyConsent.checked = false; document.getElementById('confirmProposalApply').disabled = true; applyWarning.showModal();
    }
    function showPendingApplication() {
        if (!pendingControls.length) {
            pendingControls = [...main.querySelectorAll('[data-edit-index], #proposalSelection, #historyProposalImport input, #historyProposalImport button')]
                .map(control => [control, control.disabled]);
            pendingControls.forEach(([control]) => { control.disabled = true; });
        }
        document.getElementById('reconcileProposalApply').hidden = false;
        document.getElementById('previewProposalApply').disabled = true; applyButton().disabled = true;
    }
    async function executeApplication(reconcile = false) {
        if (busy || !reconcile && (!applyConsent.checked || !applyPreview?.result.executionEnabled)) return;
        if (!reconcile) {
            if (JSON.stringify(currentProposal()) !== JSON.stringify(applyPreview.proposal)) { applyWarning.close(); invalidateApproval(); return; }
            pendingApplication = { proposal: applyPreview.proposal, approval: { token: applyPreview.result.approval.token, confirmed: true } };
        }
        if (!pendingApplication) return;
        applyWarning.close(); const { release } = freezeControls();
        applyStatus().textContent = reconcile ? 'Ελέγχεται μόνο το αποθηκευμένο αποτέλεσμα…' : 'Επανελέγχονται και εφαρμόζονται οι συγκεκριμένες εγκεκριμένες αλλαγές…';
        try {
            const result = await applicationRequest(reconcile ? 'apply-reconcile' : 'apply', reconcile ?
                { proposal: pendingApplication.proposal, token: pendingApplication.approval.token } : pendingApplication);
            applyStatus().textContent = result.message;
            if (result.success && result.outcome === 'COMMITTED' && result.saved === true) {
                pendingApplication = null; applyPreview = null;
                markUnsaved(false);
                document.getElementById('proposalEditState').textContent = 'Οι συγκεκριμένες εγκεκριμένες αλλαγές αποθηκεύτηκαν στο Ιστορικό. Η καρτέλα διατηρεί τις τιμές που ελέγξατε. Ανοίξτε ξανά την περίπτωση για νέα επεξεργασία ή εξαγωγή.';
                // Retain the reviewed values. The old snapshot cannot issue
                // another write; a fresh editor is a separate user action.
                document.getElementById('previewProposalApply').dataset.completed = 'true';
            } else if (result.outcome !== 'UNKNOWN') { pendingApplication = null; applyPreview = null; }
        } catch {
            applyStatus().textContent = 'Η επιβεβαίωση της εφαρμογής δεν έφθασε. Δεν γνωρίζουμε αν αποθηκεύτηκε η αλλαγή. Οι τοπικές συμπληρώσεις διατηρούνται.\n1. Μην επαναλάβετε την εφαρμογή και διατηρήστε ανοικτή την καρτέλα.\n2. Πατήστε «Έλεγχος αποτελέσματος» ή ζητήστε έλεγχο από διαχειριστή.\nΚωδικός αναφοράς: ΙΣΤ-ΕΓΚΡΙΣΗ-ΣΥΝΔΕΣΗ.';
        } finally {
            release(); applyButton().disabled = true;
            if (pendingApplication) showPendingApplication();
            else { pendingControls.forEach(([control, disabled]) => { control.disabled = disabled; }); pendingControls = [];
                document.getElementById('reconcileProposalApply').hidden = true;
                document.getElementById('previewProposalApply').disabled = document.getElementById('previewProposalApply').dataset.completed === 'true'; }
        }
    }
    applyConsent?.addEventListener('change', () => { document.getElementById('confirmProposalApply').disabled = !applyConsent.checked; });
    document.getElementById('cancelProposalApply')?.addEventListener('click', () => applyWarning.close());
    document.getElementById('confirmProposalApply')?.addEventListener('click', () => executeApplication());
    // Reserve the actual fixed bar height, including wrapped buttons and status.
    // Rebind after case replacement so detached bars are never observed.
    const actionsObserver = new ResizeObserver(updateActionSpace);
    function updateActionSpace() {
        const height = form?.querySelector('.proposal-actions')?.getBoundingClientRect().height || 0;
        document.documentElement.style.setProperty('--proposal-actions-height', `${height}px`);
    }
    function observeActions() {
        actionsObserver.disconnect();
        const actions = form?.querySelector('.proposal-actions');
        if (actions) actionsObserver.observe(actions);
        updateActionSpace();
    }
    const activeSelection = () => document.getElementById('proposalActiveCase').dataset.selection;
    const select = () => document.getElementById('proposalSelection');
    const failure = (reason, code = 'EMPLOYEE_HISTORY_EDITOR_TRANSITION_FAILED') =>
        `${reason} Οι προηγούμενες συμπληρώσεις διατηρούνται. Δεν αποθηκεύτηκε καμία αλλαγή στη βάση.\n1. Διατηρήστε την τρέχουσα εργασία.\n2. Ελέγξτε την επιλογή και τη σύνδεση και επαναλάβετε.\nΚωδικός αναφοράς: ${code}.`;
    function freezeControls() {
        busy = true; const id = ++serial; main.setAttribute('aria-busy', 'true');
        const states = [form, importForm, document.getElementById('proposalCaseSelector')].filter(Boolean)
            .flatMap(node => [...node.querySelectorAll('input,select,textarea,button')]).map(control => [control, control.disabled]);
        states.forEach(([control]) => { control.disabled = true; });
        return { id, release() {
            states.forEach(([control, disabled]) => { control.disabled = disabled; });
            if (id === serial) { busy = false; main.setAttribute('aria-busy', 'false'); }
        } };
    }
    function markUnsaved(value) {
        if (value) invalidateApproval();
        unsaved = value;
        const state = document.getElementById('proposalEditState');
        if (state) state.textContent = value ? 'Υπάρχουν τοπικές συμπληρώσεις που δεν έχουν εξαχθεί σε XLSX. Δεν έχει γίνει αποθήκευση στη βάση.' :
            'Οι τιμές παραμένουν τοπικά στην καρτέλα. Δεν έχει γίνει αποθήκευση στη βάση.';
    }
    function confirmReplacement() {
        if (!unsaved) return Promise.resolve(true);
        return new Promise(resolve => { consent = resolve; warning.showModal(); });
    }
    function finishConsent(accepted) {
        const resolve = consent; consent = null; warning.close(); resolve?.(accepted);
    }
    document.getElementById('keepProposalEdits').addEventListener('click', () => finishConsent(false));
    document.getElementById('confirmProposalSwitch').addEventListener('click', () => finishConsent(true));
    warning.addEventListener('cancel', event => { event.preventDefault(); finishConsent(false); });
    warning.addEventListener('close', () => { if (consent) finishConsent(false); });
    function clearImportResult() { status.textContent = ''; issues.replaceChildren(); issues.hidden = true; pending.hidden = true; }
    function showProblems(problems) {
        // These rows come only from actual server-side field rejections. Neither
        // BEFORE/AFTER differences nor provenance rows are diagnostics.
        if (!Array.isArray(problems) || !problems.length) return;
        const table = document.createElement('table'); table.className = 'proposal-issues';
        const caption = table.createCaption(); caption.textContent = 'Πεδία που χρειάζονται διόρθωση';
        const headings = ['Πεδίο', 'Πρόβλημα', 'Απαιτούμενη ενέργεια'];
        const header = table.createTHead().insertRow();
        for (const label of headings) { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; header.append(cell); }
        const body = table.createTBody();
        for (const item of problems) {
            if (!item || !['fieldId','field','problem','action'].every(key => typeof item[key] === 'string' && item[key])) continue;
            const row = body.insertRow();
            [item.field,item.problem,item.action].forEach((text, i) => { const cell = row.insertCell(); cell.textContent = text; cell.dataset.label = headings[i]; });
        }
        if (body.rows.length) { issues.replaceChildren(table); issues.hidden = false; }
    }
    function focusEditor(showImportResult = false) {
        const title = document.getElementById('proposalEditorTitle');
        title?.focus({ preventScroll: true }); (showImportResult ? status : title)?.scrollIntoView({ block: 'start' });
    }
    async function fetchEditor(selection, id, expected) {
        if (typeof selection !== 'string' || selection && !/^(UPDATE:[a-f\d]{24}|INSERT:history-case-[A-Za-z\d_-]{24})$/i.test(selection)) throw new Error();
        const url = new URL(editorUrl); if (selection) url.searchParams.set('selection', selection);
        const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
        if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('text/html')) {
            const body = await response.json().catch(() => null);
            throw new Error(failure('Η εφαρμογή δεν επιβεβαίωσε το άνοιγμα της επιλεγμένης περίπτωσης.', body?.code));
        }
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const page = doc.querySelector('.proposal-page'), nextCase = doc.getElementById('proposalCaseContent'), nextEditor = doc.getElementById('proposalEditorContent');
        const nextForm = nextEditor?.querySelector('#historyProposalEditor'), active = nextCase?.querySelector('#proposalActiveCase');
        const exportUrl = new URL(editorUrl); exportUrl.pathname = exportUrl.pathname.replace(/history-proposal-editor$/, 'history-proposal.xlsx');
        if (selection) exportUrl.searchParams.set('selection', selection);
        if (id !== serial || !scopeContext || page?.dataset.scopeContext !== scopeContext || page.dataset.editorUrl !== editorUrl.pathname ||
            !nextForm || !active || active.dataset.selection !== selection || nextCase.querySelector('#proposalSelection')?.value !== selection ||
            !nextForm.dataset.caseId || !nextForm.dataset.snapshot || !nextForm.dataset.context || !nextForm.dataset.filename ||
            active.dataset.caseId !== nextForm.dataset.caseId || active.dataset.snapshot !== nextForm.dataset.snapshot ||
            new URL(nextForm.dataset.exportUrl, location.origin).href !== exportUrl.href ||
            expected && (nextForm.dataset.caseId !== expected.caseId || nextForm.dataset.snapshot !== expected.snapshotFingerprint))
            throw new Error(failure('Η νέα περίπτωση δεν συμφωνεί με τα επαληθευμένα στοιχεία. Η μετάβαση σταμάτησε.'));
        return { nextCase: document.importNode(nextCase, true), nextEditor: document.importNode(nextEditor, true), url };
    }
    function commitEditor(candidate, id) {
        if (id !== serial) throw new Error();
        // All network, scope, case, snapshot and value checks finish before this
        // synchronous replacement. The file input stays in the original DOM.
        history.replaceState(null, '', candidate.url.pathname + candidate.url.search);
        document.getElementById('proposalCaseContent').replaceWith(candidate.nextCase);
        document.getElementById('proposalEditorContent').replaceWith(candidate.nextEditor);
        form = document.getElementById('historyProposalEditor'); filterCatalogs(); observeActions();
        invalidateApproval();
    }
    async function switchCase(selection) {
        if (select()) select().value = activeSelection();
        if (busy || pendingApplication || selection === activeSelection()) return;
        const { id, release } = freezeControls();
        selectionStatus.textContent = 'Άνοιγμα επιλεγμένης περίπτωσης…';
        try {
            if (!await confirmReplacement()) { selectionStatus.textContent = 'Η μετάβαση ακυρώθηκε. Οι προηγούμενες συμπληρώσεις διατηρούνται. Δεν αποθηκεύτηκε καμία αλλαγή στη βάση.'; return; }
            const candidate = await fetchEditor(selection, id); filterCatalogs(candidate.nextEditor.querySelector('form'));
            commitEditor(candidate, id); markUnsaved(false); clearImportResult();
            selectionStatus.textContent = 'Άνοιξε η επιλεγμένη περίπτωση. Δεν αποθηκεύτηκε καμία αλλαγή στη βάση.'; focusEditor();
        } catch (error) {
            selectionStatus.textContent = error.message?.includes('Κωδικός αναφοράς:') ? error.message : failure('Η επιλεγμένη περίπτωση δεν φορτώθηκε.');
        } finally { if (select()) select().value = activeSelection(); release(); }
    }
    function prepareImportedValues(payload, targetForm) {
        const controls = [...targetForm.querySelectorAll('[data-field-id][data-edit-index]')];
        const byField = new Map(controls.map(control => [control.dataset.fieldId, control]));
        if (!Array.isArray(payload.values) || payload.values.length !== controls.length || byField.size !== controls.length) throw new Error();
        const values = new Map();
        for (const item of payload.values) {
            if (!item || !byField.has(item.fieldId) || values.has(item.fieldId) || !Object.hasOwn(item, 'value')) throw new Error();
            values.set(item.fieldId, item.value);
        }
        // Resolve against raw option values and the complete imported parent set.
        // The DOM remains untouched until every field has passed this preflight.
        return controls.map(control => {
            const raw = values.get(control.dataset.fieldId);
            let value = raw === null ? '' : raw;
            if (control.tagName === 'SELECT') {
                if (control.multiple) {
                    if (raw !== null && (!Array.isArray(raw) || new Set(raw).size !== raw.length)) throw new Error();
                    value = (raw || []).map(item => {
                        const options = [...control.options].filter(option => option.dataset.rawValue === JSON.stringify(item));
                        if (options.length !== 1) throw new Error();
                        return options[0].value;
                    });
                } else if (raw !== null) {
                    const parents = (control.dataset.parents || '').split(',').filter(Boolean);
                    const key = parents.map(index => {
                        const parent = controls.find(item => item.dataset.editIndex === index);
                        if (!parent) throw new Error();
                        return values.get(parent.dataset.fieldId) ?? '';
                    }).join('');
                    const options = [...control.options].filter(option => option.dataset.rawValue === JSON.stringify(raw) &&
                        (!parents.length || option.dataset.parent === key));
                    if (options.length !== 1) throw new Error();
                    value = options[0].value;
                }
            } else {
                if (raw !== null && (control.dataset.type === 'Number' ? typeof raw !== 'number' || !Number.isFinite(raw) : typeof raw !== 'string')) throw new Error();
                value = String(value);
                const probe = control.cloneNode(true); probe.value = value;
                if (probe.value !== value) throw new Error();
            }
            return { control, value, raw };
        });
    }
    function filterCatalogs(targetForm = form) {
        for (const select of targetForm?.querySelectorAll('select[data-parents]') || []) {
            const parents = select.dataset.parents.split(',').filter(Boolean);
            if (!parents.length) continue;
            const key = parents.map(index => targetForm.querySelector(`[data-edit-index="${index}"]`)?.selectedOptions[0]?.dataset.code || '').join('');
            for (const option of select.options) {
                if (!option.value || option.value === 'current') continue;
                option.hidden = option.dataset.parent !== key; option.disabled = option.hidden;
            }
        }
    }
    async function importXlsx() {
        if (busy || pendingApplication) return;
        clearImportResult();
        const currentFile = selectedFile;
        if (!currentFile) { status.textContent = failure('Δεν έχει επιλεγεί XLSX. Πατήστε «Επιλέξτε αρχείο».', 'EMPLOYEE_HISTORY_XLSX_IMPORT_FORMAT'); return; }
        const { id, release } = freezeControls();
        status.textContent = 'Γίνεται αναγνωστικός έλεγχος του XLSX…';
        try {
            if (currentFile.size > 5 * 1024 * 1024) throw new Error(failure('Το XLSX υπερβαίνει τα 5 MB.', 'EMPLOYEE_HISTORY_XLSX_IMPORT_SIZE'));
            const data = new FormData(); data.append('proposal', currentFile);
            const response = await fetch(importForm.dataset.importUrl, { method: 'POST', credentials: 'same-origin',
                headers: { 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content }, body: data });
            const result = await response.json().catch(() => null);
            if (id !== serial) return;
            if (!response.ok || !result?.success || result.previewOnly !== true || result.executionEnabled !== false || result.saved !== false || result.historyStatus !== 'REVIEW_REQUIRED') {
                showProblems(result?.problems);
                throw new Error(result?.message?.includes('Κωδικός αναφοράς:') ? result.message : failure('Το XLSX απορρίφθηκε από την εφαρμογή.', result?.code));
            }
            const payload = result.editorValues;
            if (!payload || typeof payload.caseId !== 'string' || typeof payload.snapshotFingerprint !== 'string' || typeof result.editorSelection !== 'string') throw new Error();
            let candidate;
            if (!form || payload.caseId !== form.dataset.caseId || payload.snapshotFingerprint !== form.dataset.snapshot || result.editorSelection !== activeSelection())
                candidate = await fetchEditor(result.editorSelection, id, payload);
            const targetForm = candidate ? candidate.nextEditor.querySelector('#historyProposalEditor') : form;
            if (payload.caseId !== targetForm.dataset.caseId || payload.snapshotFingerprint !== targetForm.dataset.snapshot) throw new Error();
            const prepared = prepareImportedValues(payload, targetForm);
            if (!await confirmReplacement()) { status.textContent = 'Η φόρτωση ακυρώθηκε. Οι προηγούμενες συμπληρώσεις και το επιλεγμένο XLSX διατηρούνται. Δεν αποθηκεύτηκε καμία αλλαγή στη βάση.'; return; }
            if (id !== serial) return;
            for (const { control, value, raw } of prepared) {
                if (control.multiple) for (const option of control.options) option.selected = value.includes(option.value);
                else control.value = value;
                control.dataset.edited = 'true'; control.dataset.importedNull = String(raw === null);
            }
            filterCatalogs(targetForm);
            if (candidate) commitEditor(candidate, id);
            markUnsaved(true); selectionStatus.textContent = '';
            status.textContent = `Ο έλεγχος ολοκληρώθηκε επιτυχώς. Τα ΜΕΤΑ φορτώθηκαν ${result.operation === 'UPDATE' ? `στα πεδία της ιστορικής εγγραφής ${result.historySequence || 'χωρίς αρίθμηση'}` : 'στα πεδία της επιλεγμένης ελλείπουσας περιόδου'}. Δεν πραγματοποιήθηκε αποθήκευση στη βάση.`;
            pending.textContent = `Το Ιστορικό παραμένει προς έλεγχο. ${Number.isInteger(result.pendingCases) ? `${result.pendingCases} άλλες περιπτώσεις παραμένουν εκκρεμείς.` : 'Ενδέχεται να υπάρχουν άλλες εκκρεμείς περιπτώσεις.'}`;
            pending.hidden = false; focusEditor(true);
        } catch (error) {
            status.textContent = error.message?.includes('Κωδικός αναφοράς:') ? error.message : failure('Δεν επιβεβαιώθηκαν η φόρτωση ή η απάντηση της εφαρμογής.', 'EMPLOYEE_HISTORY_XLSX_IMPORT_RESPONSE');
        } finally { if (select()) select().value = activeSelection(); release(); }
    }
    document.getElementById('chooseProposalFile').addEventListener('click', () => { if (!busy) file.click(); });
    file.addEventListener('change', () => {
        if (busy || pendingApplication) return;
        selectedFile = file.files[0] || null;
        filename.textContent = selectedFile?.name || 'Δεν έχει επιλεγεί αρχείο';
        if (selectedFile) importXlsx();
    });
    importForm.addEventListener('submit', event => { event.preventDefault(); importXlsx(); });
    function edited(event) {
        if (busy || !event.target.matches('#historyProposalEditor [data-edit-index]')) return;
        event.target.dataset.edited = 'true'; delete event.target.dataset.importedNull; markUnsaved(true);
    }
    main.addEventListener('input', edited);
    main.addEventListener('change', event => {
        if (event.target.id === 'proposalSelection') { switchCase(event.target.value); return; }
        edited(event); if (!busy && form?.contains(event.target)) filterCatalogs();
    });
    main.addEventListener('submit', event => {
        if (event.target.id === 'proposalCaseSelector' || event.target.id === 'historyProposalEditor') event.preventDefault();
    });
    main.addEventListener('click', event => {
        if (event.target.closest('#saveProposalXlsx')) saveProposal();
        if (event.target.closest('#previewProposalApply')) previewApplication();
        if (event.target.closest('#approveProposalApply')) showApplicationConsent();
        if (event.target.closest('#reconcileProposalApply')) executeApplication(true);
    });
    window.addEventListener('beforeunload', event => { if (unsaved || pendingApplication) { event.preventDefault(); event.returnValue = ''; } });
    filterCatalogs(); observeActions();
    function download(blob) {
        const url = URL.createObjectURL(blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = form.dataset.filename; anchor.hidden = true;
        document.body.append(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    async function saveProposal() {
        const status = document.getElementById('proposalSaveStatus');
        if (busy || !form.reportValidity()) return;
        // Freeze the current edits until this file has been generated/saved.
        const controls = [...form.querySelectorAll('[data-edit-index]')];
        const changes = controls.filter(control => control.dataset.edited === 'true').map(control => ({
            index: Number(control.dataset.editIndex),
            value: control.multiple ? control.dataset.importedNull === 'true' ? '' : [...control.selectedOptions].map(option => Number(option.value)) : control.value
        }));
        const { release } = freezeControls();
        status.textContent = 'Δημιουργία αρχείου με τις συμπληρωμένες τιμές…';
        try {
            let handle;
            if (typeof window.showSaveFilePicker === 'function') {
                try {
                    // Called before the first network await, during user activation.
                    handle = await window.showSaveFilePicker({ suggestedName: form.dataset.filename,
                        types: [{ description: 'Αρχείο Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] });
                } catch (error) { if (error.name === 'AbortError') { status.textContent = 'Η επιλογή αρχείου ακυρώθηκε. Οι συμπληρώσεις παραμένουν στην καρτέλα.'; return; } }
            }
            const response = await fetch(form.dataset.exportUrl, { method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content },
                body: JSON.stringify({ caseId: form.dataset.caseId, snapshotFingerprint: form.dataset.snapshot, context: form.dataset.context, changes }) });
            if (!response.ok || !response.headers.get('content-type')?.includes('spreadsheetml.sheet')) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.message || 'Η αποθήκευση XLSX σταμάτησε επειδή η σύνδεση ή η απάντηση της εφαρμογής δεν επιβεβαιώθηκε. Δεν αποθηκεύτηκε αλλαγή στην εφαρμογή ή συμπληρωμένο αρχείο.\n1. Διατηρήστε την καρτέλα ανοικτή.\n2. Συνδεθείτε ξανά σε άλλη καρτέλα και επαναλάβετε την αποθήκευση.\nΚωδικός αναφοράς: ΙΣΤ-XLSX-ΣΥΝΔΕΣΗ.');
            }
            const encodedName = response.headers.get('content-disposition')?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
            if (!encodedName || decodeURIComponent(encodedName) !== form.dataset.filename)
                throw new Error('Ζητήσατε αποθήκευση XLSX, αλλά το όνομα της απάντησης δεν συμφωνεί με την επιλεγμένη πρόταση. Η αποθήκευση σταμάτησε. Δεν αποθηκεύτηκε αλλαγή στην εφαρμογή ή συμπληρωμένο αρχείο.\n1. Διατηρήστε τις συμπληρώσεις στην τρέχουσα καρτέλα.\n2. Ανοίξτε νέα πρόταση σε άλλη καρτέλα και συγκρίνετε τα στοιχεία.\nΚωδικός αναφοράς: ΙΣΤ-XLSX-ΟΝΟΜΑ.');
            const blob = await response.blob();
            let written = false;
            if (handle) {
                let writable;
                try { writable = await handle.createWritable(); await writable.write(blob); await writable.close(); written = true; }
                catch { if (writable) await writable.abort().catch(() => {}); }
            }
            if (!written) download(blob);
            markUnsaved(false);
            status.textContent = written ? 'Το XLSX αποθηκεύτηκε με τις συμπληρώσεις σας. Δεν αποθηκεύτηκε αλλαγή στην εφαρμογή.' :
                'Το XLSX με όλες τις συμπληρώσεις σας παραδόθηκε για λήψη. Ο φάκελος και το όνομα επιλέγονται σύμφωνα με τις ρυθμίσεις λήψεων του προγράμματος περιήγησης. Δεν αποθηκεύτηκε αλλαγή στην εφαρμογή.';
        } catch (error) {
            status.textContent = error.message?.includes('Κωδικός αναφοράς:') ? error.message :
                'Η αποθήκευση XLSX σταμάτησε λόγω προβλήματος επικοινωνίας. Οι συμπληρώσεις παραμένουν στην καρτέλα. Δεν αποθηκεύτηκε αλλαγή στην εφαρμογή και δεν επιβεβαιώθηκε αποθήκευση αρχείου.\n1. Ελέγξτε τη σύνδεσή σας.\n2. Πατήστε ξανά «Αποθήκευση XLSX στον υπολογιστή».\nΚωδικός αναφοράς: ΙΣΤ-XLSX-ΔΙΚΤΥΟ.';
        } finally { release(); }
    }
})();
