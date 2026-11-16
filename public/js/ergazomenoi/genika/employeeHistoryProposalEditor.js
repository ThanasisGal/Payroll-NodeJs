'use strict';
(() => {
    const form = document.getElementById('historyProposalEditor');
    const importForm = document.getElementById('historyProposalImport');
    const selector = document.getElementById('proposalCaseSelector'), warning = document.getElementById('proposalSelectionWarning');
    let unsaved = false, busy = false;
    function freezeControls() {
        busy = true;
        const controls = [form, importForm, selector].filter(Boolean).flatMap(node => [...node.querySelectorAll('input,select,textarea,button')]);
        const states = controls.map(control => [control, control.disabled]);
        controls.forEach(control => { control.disabled = true; });
        return () => { states.forEach(([control, disabled]) => { control.disabled = disabled; }); busy = false; };
    }
    const importFailure = (reason, code, steps = '1. Διατηρήστε τις συμπληρώσεις και το τοπικό αρχείο.\n2. Δημιουργήστε νέα πρόταση στη σωστή περίπτωση και επαναλάβετε την επιλογή αρχείου.') =>
        `Ζητήσατε φόρτωση ΜΕΤΑ από XLSX. ${reason} Η φόρτωση σταμάτησε. Δεν άλλαξε κανένα πεδίο της καρτέλας και δεν αποθηκεύτηκε καμία αλλαγή στην εφαρμογή.\n${steps}\nΚωδικός αναφοράς: ${code}.`;
    function prepareImportedValues(payload) {
        const controls = [...form.querySelectorAll('[data-field-id][data-edit-index]')];
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
    if (importForm) {
        const file = document.getElementById('proposalImportFile'), button = document.getElementById('chooseProposalFile'),
            filename = document.getElementById('proposalImportFilename'), status = document.getElementById('proposalImportStatus'),
            preview = document.getElementById('proposalImportPreview'), rows = document.getElementById('proposalImportRows');
        const clear = () => { preview.hidden = true; rows.replaceChildren(); status.textContent = ''; };
        button.addEventListener('click', () => file.click());
        file.addEventListener('change', () => {
            filename.textContent = file.files[0]?.name || 'Δεν έχει επιλεγεί αρχείο';
            clear();
            if (file.files.length) importForm.requestSubmit();
        });
        importForm.addEventListener('submit', async event => {
            event.preventDefault();
            if (busy) return;
            clear();
            if (!file.files.length) {
                status.textContent = importFailure('Δεν έχει επιλεγεί αρχείο.', 'ΙΣΤ-XLSX-ΑΡΧΕΙΟ',
                    '1. Πατήστε «Επιλέξτε αρχείο».\n2. Επιλέξτε το συμπληρωμένο XLSX της ανοιχτής περίπτωσης.');
                return;
            }
            const release = freezeControls();
            status.textContent = 'Ανάγνωση και έλεγχος της συγκεκριμένης πρότασης, χωρίς αποθήκευση…';
            try {
                if (file.files[0].size > 5 * 1024 * 1024) throw new Error(importFailure('Το αρχείο υπερβαίνει τα 5 MB.', 'EMPLOYEE_HISTORY_XLSX_IMPORT_SIZE'));
                const data = new FormData(); data.append('proposal', file.files[0]);
                const response = await fetch(importForm.dataset.importUrl, { method: 'POST', credentials: 'same-origin',
                    headers: { 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content }, body: data });
                const result = await response.json().catch(() => null);
                if (!response.ok || !result?.success || result.previewOnly !== true || result.executionEnabled !== false || result.saved !== false || result.historyStatus !== 'REVIEW_REQUIRED' || !Array.isArray(result.rows)) {
                    if (result?.code) {
                        const reason = result.message?.split('\nΚωδικός αναφοράς:')[0] || 'Το αρχείο απορρίφθηκε από την εφαρμογή. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Διατηρήστε το τοπικό αρχείο.\n2. Δημιουργήστε νέα πρόταση στη σωστή περίπτωση και επαναλάβετε.';
                        throw new Error(`${reason}\nΔεν άλλαξε κανένα πεδίο της καρτέλας. Οι προηγούμενες συμπληρώσεις διατηρούνται.\nΚωδικός αναφοράς: ${result.code}.`);
                    }
                    throw new Error(result?.message || '');
                }
                const payload = result.editorValues;
                if (!payload || typeof payload.caseId !== 'string' || typeof payload.snapshotFingerprint !== 'string' || typeof payload.selectionLabel !== 'string') throw new Error();
                let prepared, message;
                if (!form || payload.caseId !== form.dataset.caseId) {
                    message = importFailure(`Το αρχείο αφορά την περίπτωση «${payload.selectionLabel}» και διαφέρει από την ανοιχτή καρτέλα.`,
                        'EMPLOYEE_HISTORY_XLSX_IMPORT_CASE_MISMATCH',
                        `1. Διατηρήστε την τρέχουσα καρτέλα ανοικτή και ανοίξτε την πρόταση Ιστορικού σε νέα καρτέλα.\n2. Επιλέξτε «${payload.selectionLabel}», ανοίξτε την περίπτωση και επιλέξτε ξανά το ίδιο XLSX εκεί.`);
                } else if (payload.snapshotFingerprint !== form.dataset.snapshot) {
                    message = importFailure('Τα αρχικά στοιχεία της ανοιχτής καρτέλας διαφέρουν από τα επαληθευμένα στοιχεία του αρχείου.', 'EMPLOYEE_HISTORY_XLSX_IMPORT_STALE');
                } else {
                    prepared = prepareImportedValues(payload);
                    message = 'Τα επαληθευμένα ΜΕΤΑ φορτώθηκαν ως τοπικές συμπληρώσεις στην καρτέλα ΠΡΙΝ/ΜΕΤΑ και θα περιληφθούν στην επόμενη «Αποθήκευση XLSX στον υπολογιστή». Η φόρτωση δεν αποτελεί εφαρμογή στη βάση. Δεν αποθηκεύτηκε καμία αλλαγή στην εφαρμογή. Το Ιστορικό παραμένει προς έλεγχο.';
                }
                const date = value => value ? value.split('-').reverse().join('/') : 'χωρίς λήξη';
                const context = `Ομάδα ${result.team} · Εταιρεία ${result.companyCode || 'χωρίς επιβεβαιωμένο κωδικό'} · Εργαζόμενος ${result.employeeCode} · Υποκατάστημα ${result.branch} · ${result.referenceCount} προστατευμένες αναφορές ελέγχθηκαν · ${result.pendingCases} άλλες περιπτώσεις παραμένουν εκκρεμείς.`;
                const evidence = `Τεκμήριο χρήστη: ${result.evidence || 'Δεν δηλώθηκε'}. Δήλωση: ${result.declaration}. Η δήλωση δεν αποτελεί ανεξάρτητη επαλήθευση.`;
                const fragment = document.createDocumentFragment();
                for (const item of result.rows) {
                    const row = document.createElement('tr');
                    const values = [`${result.employeeCode} · ${result.historySequence ? `ΙΣΤ${result.historySequence}` : 'Νέα περίοδος'}`, result.operation,
                        `${date(result.period.from)} – ${date(result.period.to)}`, item.field, item.before, item.after, item.source, item.documentation];
                    for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
                    fragment.append(row);
                }
                if (!result.rows.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 8; cell.textContent = 'Δεν βρέθηκαν μεταβολές στα επιτρεπόμενα ΜΕΤΑ.'; row.append(cell); fragment.append(row); }
                document.getElementById('proposalImportContext').textContent = context;
                document.getElementById('proposalImportEvidence').textContent = evidence;
                rows.replaceChildren(fragment);
                if (prepared) {
                    for (const { control, value, raw } of prepared) {
                        if (control.multiple) for (const option of control.options) option.selected = value.includes(option.value);
                        else control.value = value;
                        control.dataset.edited = 'true';
                        control.dataset.importedNull = String(raw === null);
                    }
                    filterCatalogs(); unsaved = true;
                }
                status.textContent = message; preview.hidden = false;
            } catch (error) {
                status.textContent = error.message?.includes('Κωδικός αναφοράς:') ? error.message :
                    importFailure('Η σύνδεση ή η απάντηση της εφαρμογής δεν επιβεβαιώθηκε.', 'ΙΣΤ-XLSX-ΠΡΟΕΠΙΣΚΟΠΗΣΗ');
            } finally { release(); }
        });
    }
    selector?.addEventListener('submit', event => {
        if (!unsaved) return;
        event.preventDefault(); warning.showModal();
    });
    document.getElementById('keepProposalEdits')?.addEventListener('click', () => warning.close());
    document.getElementById('openProposalInNewTab')?.addEventListener('click', () => {
        selector.target = '_blank'; selector.submit(); selector.removeAttribute('target');
        document.getElementById('proposalSelection').value = new URL(location.href).searchParams.get('selection') || '';
        warning.close();
    });
    if (!form) return;
    const save = document.getElementById('saveProposalXlsx'), status = document.getElementById('proposalSaveStatus');
    form.addEventListener('input', event => {
        if (event.target.matches('[data-edit-index]')) { event.target.dataset.edited = 'true'; delete event.target.dataset.importedNull; unsaved = true; }
    });
    form.addEventListener('change', event => {
        if (event.target.matches('[data-edit-index]')) { event.target.dataset.edited = 'true'; delete event.target.dataset.importedNull; unsaved = true; }
    });
    function filterCatalogs() {
        for (const select of form.querySelectorAll('select[data-parents]')) {
            const parents = select.dataset.parents.split(',').filter(Boolean);
            if (!parents.length) continue;
            const key = parents.map(index => form.querySelector(`[data-edit-index="${index}"]`)?.selectedOptions[0]?.dataset.code || '').join('');
            for (const option of select.options) {
                if (!option.value || option.value === 'current') continue;
                option.hidden = option.dataset.parent !== key; option.disabled = option.hidden;
            }
        }
    }
    form.addEventListener('change', filterCatalogs); filterCatalogs();
    form.addEventListener('submit', event => event.preventDefault());
    window.addEventListener('beforeunload', event => { if (unsaved) { event.preventDefault(); event.returnValue = ''; } });
    function download(blob) {
        const url = URL.createObjectURL(blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = form.dataset.filename; anchor.hidden = true;
        document.body.append(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    save.addEventListener('click', async () => {
        if (busy || !form.reportValidity()) return;
        // Freeze the current edits until this file has been generated/saved.
        const controls = [...form.querySelectorAll('[data-edit-index]')];
        const changes = controls.filter(control => control.dataset.edited === 'true').map(control => ({
            index: Number(control.dataset.editIndex),
            value: control.multiple ? control.dataset.importedNull === 'true' ? '' : [...control.selectedOptions].map(option => Number(option.value)) : control.value
        }));
        const release = freezeControls();
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
            unsaved = false;
            status.textContent = written ? 'Το XLSX αποθηκεύτηκε με τις συμπληρώσεις σας. Δεν αποθηκεύτηκε αλλαγή στην εφαρμογή.' :
                'Το XLSX με όλες τις συμπληρώσεις σας παραδόθηκε για λήψη. Ο φάκελος και το όνομα επιλέγονται σύμφωνα με τις ρυθμίσεις λήψεων του προγράμματος περιήγησης. Δεν αποθηκεύτηκε αλλαγή στην εφαρμογή.';
        } catch (error) {
            status.textContent = error.message?.includes('Κωδικός αναφοράς:') ? error.message :
                'Η αποθήκευση XLSX σταμάτησε λόγω προβλήματος επικοινωνίας. Οι συμπληρώσεις παραμένουν στην καρτέλα. Δεν αποθηκεύτηκε αλλαγή στην εφαρμογή και δεν επιβεβαιώθηκε αποθήκευση αρχείου.\n1. Ελέγξτε τη σύνδεσή σας.\n2. Πατήστε ξανά «Αποθήκευση XLSX στον υπολογιστή».\nΚωδικός αναφοράς: ΙΣΤ-XLSX-ΔΙΚΤΥΟ.';
        } finally { release(); }
    });
})();
