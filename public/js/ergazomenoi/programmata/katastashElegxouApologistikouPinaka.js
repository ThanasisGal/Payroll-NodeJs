'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('controlReportPdfButton');
    if (!button || button.disabled) return;
    const validationError = (message) => Swal.fire({ icon: 'error', title: 'Μη έγκυρα κριτήρια', text: message });
    button.addEventListener('click', () => {
        const apo = String(document.getElementById('apo_hmeromhnia')?.value || '').trim();
        const eos = String(document.getElementById('eos_hmeromhnia')?.value || '').trim();
        const branch = String(document.getElementById('ypokatasthma_stathera_advanced')?.value || '').trim();
        if (!apo) return validationError('Συμπληρώστε την Από Ημερομηνία.');
        if (!eos) return validationError('Συμπληρώστε την Έως Ημερομηνία.');
        if (apo > eos) return validationError('Η Από Ημερομηνία δεν μπορεί να είναι μετά την Έως Ημερομηνία.');
        if (!/^\d{1,4}$/.test(branch) || branch.toUpperCase() === 'ALL' || branch.includes(',')) {
            return validationError('Επιλέξτε ένα συγκεκριμένο παράρτημα.');
        }
        const params = new URLSearchParams({ ypokatasthma: branch.padStart(4, '0'),
            apo_hmeromhnia: apo, eos_hmeromhnia: eos });
        window.open(`/ergazomenoi/programmata/katastashElegxouApologistikouPinaka/pdf?${params.toString()}`, '_blank', 'noopener');
    });
});
