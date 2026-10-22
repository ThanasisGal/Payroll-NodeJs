'use strict';
(() => {
    let pending = false;
    const state = () => document.getElementById('employeeSaveState');
    window.employeeSaveBaseline = () => ({
        expectedEmployeeStateToken: state()?.dataset.token || undefined,
        expectedTemporary: state()?.dataset.temporary === 'true'
    });
    window.applyEmployeeFinalState = data => {
        if (data?.success !== true || data?.data?.oristikh_enhmerosh !== true) return;
        if (state()) state().dataset.temporary = 'false';
        document.querySelectorAll('[data-save-mode="temporary"], .employee-draft-indicator').forEach(element => element.remove());
        const hire = document.getElementById('hmeromhnia_proslhpshs');
        if (hire) { hire.readOnly = true; hire.setAttribute('aria-readonly', 'true'); }
    };
    window.saveTemporaryEmployee = async ({ formData, mode }) => {
        if (window.EmployeeFormReadiness && !window.EmployeeFormReadiness.FORM_READY) return;
        if (pending) return;
        pending = true;
        const buttons = [...document.querySelectorAll('.submitButton')];
        const disabled = buttons.map(button => button.disabled);
        buttons.forEach(button => { button.disabled = true; });
        try {
            const id = document.getElementById('ergazomenoiId')?.value;
            const url = mode === 'add' ? '/ergazomenoi/ergazomenoi/add' : `/api/ergazomenoi/update/${id}`;
            const response = await fetch(url, { method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json',
                    'CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '' },
                body: JSON.stringify({ formData, saveMode: 'temporary', ...window.employeeSaveBaseline() }) });
            const data = await response.json();
            if (!response.ok || data.success !== true) {
                await Swal.fire({ icon: 'error', title: 'Η προσωρινή αποθήκευση δεν ολοκληρώθηκε',
                    text: data.message || data.errorMessage, confirmButtonText: 'Κλείσιμο' });
                return;
            }
            if (state()) state().dataset.token = data.employeeStateToken;
            await Swal.fire({ icon: 'success', title: 'Προσωρινή Αποθήκευση', text: data.message,
                timer: 2000, showConfirmButton: false });
            // Reload the saved, server-owned state. This also makes a newly created
            // draft an ordinary Maintenance form with a fresh concurrency baseline.
            window.location.href = data.redirectUrl;
        } catch {
            await Swal.fire({ icon: 'error', title: 'Δεν επιβεβαιώθηκε η προσωρινή αποθήκευση',
                text: 'Δεν ήταν δυνατή η επιβεβαίωση από την εφαρμογή. Ενδέχεται να έχει αποθηκευτεί η αλλαγή.\n' +
                    '1. Ανοίξτε ξανά τη Συντήρηση Εργαζομένων.\n2. Ελέγξτε αν υπάρχουν τα στοιχεία πριν επαναλάβετε την αποθήκευση.',
                confirmButtonText: 'Κλείσιμο' });
        } finally {
            pending = false;
            buttons.forEach((button, index) => { button.disabled = disabled[index]; });
        }
    };
})();
