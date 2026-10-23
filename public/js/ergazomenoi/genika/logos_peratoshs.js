document.addEventListener('DOMContentLoaded', () => {
    const departure = document.getElementById('hmeromhnia_apoxorhshs');
    const section = document.getElementById('logos_peratoshs_section');
    const reason = document.getElementById('logos_peratoshs');
    const hidden = document.getElementById('logos_peratoshs_stathera');
    const notes = document.getElementById('parathrhseis_peratoshs');
    if (!departure || !section) return;
    const buttons = [...document.querySelectorAll('.submitButton')];
    const hasValue = element => Boolean(String(element?.value || '').trim());
    const incomplete = () => hasValue(departure) && (!hasValue(hidden) || !hasValue(notes));
    // Remember other owners' requested state even while this validation owns a lock.
    const requested = new Map(buttons.map(button => [button, button.disabled]));
    const observe = () => buttons.forEach(button => observer.observe(button,
        { attributes: true, attributeFilter: ['disabled'] }));
    const acceptExternal = records => records.forEach(record =>
        requested.set(record.target, record.target.disabled));
    const observer = new MutationObserver(records => { acceptExternal(records); updateButtons(); });
    function updateButtons() {
        acceptExternal(observer.takeRecords());
        observer.disconnect();
        const blocked = incomplete();
        buttons.forEach(button => {
            button.disabled = blocked || requested.get(button) ||
                (window.EmployeeFormReadiness && !window.EmployeeFormReadiness.FORM_READY);
        });
        observe();
    }
    function refresh() {
        const enabled = hasValue(departure);
        section.style.display = enabled ? '' : 'none';
        [reason, notes].forEach(control => {
            if (!control) return;
            if (control.tomselect) enabled ? control.tomselect.enable() : control.tomselect.disable();
            else control.disabled = !enabled;
        });
        if (!enabled) {
            if (hidden) hidden.value = '';
            reason?.tomselect?.clear(true);
            if (reason && !reason.tomselect) reason.value = '';
            if (notes) notes.value = '';
        }
        updateButtons();
    }
    window.validateEmployeeTermination = async () => {
        if (!incomplete()) return true;
        await Swal.fire({ icon: 'warning', title: 'Συμπληρώστε τα στοιχεία περαίωσης',
            text: 'Η αποχώρηση δεν μπορεί να αποθηκευτεί επειδή λείπει ο λόγος ή οι παρατηρήσεις περαίωσης. Δεν αποθηκεύτηκε καμία αλλαγή.\n1. Συμπληρώστε τον Λόγο Περαίωσης Σ.Ο.Χ.\n2. Συμπληρώστε τις Παρατηρήσεις Περαίωσης Σ.Ο.Χ.\n3. Πατήστε ξανά «Αποθήκευση».',
            confirmButtonText: 'Κλείσιμο' });
        return false;
    };
    [departure, reason, hidden, notes].forEach(control => {
        control?.addEventListener('input', refresh);
        control?.addEventListener('change', refresh);
    });
    // Tom Select writes the target hidden field before its bubbling change event.
    reason?.tomselect?.on('change', refresh);
    document.addEventListener('employeeform:ready', refresh);
    observe();
    refresh();
});
