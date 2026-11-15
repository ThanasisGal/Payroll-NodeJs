'use strict';
(() => {
    const importForm=document.getElementById('historyProposalImport');
    if(importForm){
        const file=document.getElementById('proposalImportFile'), button=document.getElementById('previewProposalImport'),
            status=document.getElementById('proposalImportStatus'), preview=document.getElementById('proposalImportPreview'), rows=document.getElementById('proposalImportRows');
        const clear=()=>{preview.hidden=true;rows.replaceChildren();status.textContent='';};
        file.addEventListener('change',clear);
        importForm.addEventListener('submit',async event=>{
            event.preventDefault();if(!importForm.reportValidity())return;
            clear();button.disabled=true;file.disabled=true;
            status.textContent='Ανάγνωση και έλεγχος της συγκεκριμένης πρότασης, χωρίς αποθήκευση…';
            try{
                if(file.files[0].size>5*1024*1024)throw new Error('Το XLSX που επιλέξατε υπερβαίνει τα 5 MB. Η προεπισκόπηση σταμάτησε. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Επιλέξτε μόνο την εξαγόμενη πρόταση, χωρίς πρόσθετα φύλλα ή εικόνες.\n2. Δημιουργήστε νέα πρόταση αν το αρχείο έχει μεταβληθεί.\nΚωδικός αναφοράς: ΙΣΤ-XLSX-ΜΕΓΕΘΟΣ.');
                const data=new FormData();data.append('proposal',file.files[0]);
                const response=await fetch(importForm.dataset.importUrl,{method:'POST',credentials:'same-origin',
                    headers:{'X-CSRF-Token':document.querySelector('meta[name="csrf-token"]').content},body:data});
                const result=await response.json().catch(()=>null);
                if(!response.ok||!result?.success||result.previewOnly!==true||result.executionEnabled!==false||result.saved!==false||result.historyStatus!=='REVIEW_REQUIRED'||!Array.isArray(result.rows))
                    throw new Error(result?.message||'');
                const date=value=>value?value.split('-').reverse().join('/'):'χωρίς λήξη';
                document.getElementById('proposalImportContext').textContent=`Ομάδα ${result.team} · Εταιρεία ${result.companyCode||'χωρίς επιβεβαιωμένο κωδικό'} · Εργαζόμενος ${result.employeeCode} · Υποκατάστημα ${result.branch} · ${result.referenceCount} προστατευμένες αναφορές ελέγχθηκαν · ${result.pendingCases} άλλες περιπτώσεις παραμένουν εκκρεμείς.`;
                document.getElementById('proposalImportEvidence').textContent=`Τεκμήριο χρήστη: ${result.evidence||'Δεν δηλώθηκε'}. Δήλωση: ${result.declaration}. Η δήλωση δεν αποτελεί ανεξάρτητη επαλήθευση.`;
                for(const item of result.rows){
                    const row=document.createElement('tr');
                    const values=[`${result.employeeCode} · ${result.historySequence?`ΙΣΤ${result.historySequence}`:'Νέα περίοδος'}`,result.operation,
                        `${date(result.period.from)} – ${date(result.period.to)}`,item.field,item.before,item.after,item.source,item.documentation];
                    for(const value of values){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
                    rows.append(row);
                }
                if(!result.rows.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=8;cell.textContent='Δεν βρέθηκαν μεταβολές στα επιτρεπόμενα ΜΕΤΑ.';row.append(cell);rows.append(row);}
                status.textContent=result.message;preview.hidden=false;
            }catch(error){
                status.textContent=error.message?.includes('Κωδικός αναφοράς:')?error.message:
                    'Ζητήσατε έλεγχο XLSX, αλλά η σύνδεση ή η απάντηση της εφαρμογής δεν επιβεβαιώθηκε. Η προεπισκόπηση σταμάτησε. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Διατηρήστε το τοπικό αρχείο και ελέγξτε τη σύνδεσή σας.\n2. Συνδεθείτε ξανά στη σωστή εταιρεία και επαναλάβετε τον έλεγχο.\nΚωδικός αναφοράς: ΙΣΤ-XLSX-ΠΡΟΕΠΙΣΚΟΠΗΣΗ.';
            }finally{button.disabled=false;file.disabled=false;}
        });
    }
    const form = document.getElementById('historyProposalEditor');
    const selector = document.getElementById('proposalCaseSelector'), warning = document.getElementById('proposalSelectionWarning');
    let unsaved = false;
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
        const selectionControls = [...(selector?.querySelectorAll('select,button') || [])];
        const changes = controls.filter(control => control.dataset.edited === 'true').map(control => ({
            index: Number(control.dataset.editIndex),
            value: control.multiple ? [...control.selectedOptions].map(option => Number(option.value)) : control.value
        }));
        save.disabled = true; [...controls, ...selectionControls].forEach(control => { control.disabled = true; });
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
        } finally { save.disabled = false; [...controls, ...selectionControls].forEach(control => { control.disabled = false; }); }
    });
})();
