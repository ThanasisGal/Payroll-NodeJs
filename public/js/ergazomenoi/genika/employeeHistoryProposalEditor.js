'use strict';
(() => {
    const form = document.getElementById('historyProposalEditor');
    if (!form) return;
    const save = document.getElementById('saveProposalXlsx'), status = document.getElementById('proposalSaveStatus');
    let unsaved = false;
    form.addEventListener('input', event => {
        if (event.target.matches('[data-edit-index]')) { event.target.dataset.edited = 'true'; unsaved = true; }
    });
    form.addEventListener('change', event => {
        if (event.target.matches('[data-edit-index]')) { event.target.dataset.edited = 'true'; unsaved = true; }
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
        if (!form.reportValidity()) return;
        // Freeze the current edits until this file has been generated/saved.
        const controls = [...form.querySelectorAll('[data-edit-index]')];
        const changes = controls.filter(control => control.dataset.edited === 'true').map(control => ({
            index: Number(control.dataset.editIndex),
            value: control.multiple ? [...control.selectedOptions].map(option => Number(option.value)) : control.value
        }));
        save.disabled = true; controls.forEach(control => { control.disabled = true; });
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
        } finally { save.disabled = false; controls.forEach(control => { control.disabled = false; }); }
    });
})();
