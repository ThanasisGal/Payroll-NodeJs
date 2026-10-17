// Εμφάνιση μόνο των ενημερωτικών αποτελεσμάτων της συγκεκριμένης φόρμας.
const calcApasxolhseisNoticeOptions = () => ({
    target: document.querySelector('main.payroll-form-layout') || document.body,
    heightAuto: false,
    width: 'min(560px, 100%)',
    confirmButtonText: 'Κλείσιμο',
    showCancelButton: false,
    customClass: {
        title: 'custom-title',
        popup: 'custom-swal-popup new-year-confirmation z-depth-5',
        container: 'new-year-confirmation-container calc-apasxolhseis-notice',
        confirmButton: 'class-info custom-confirm-button custom-swal-button'
    }
});

document.getElementById('calcApasxolhseonButton')?.addEventListener('click', async () => {
    const apo_hmeromhnia = document.getElementById('apo_hmeromhnia')?.value;
    const eos_hmeromhnia = document.getElementById('eos_hmeromhnia')?.value;

    const ypokatasthmata_stathera = document.getElementById('ypokatasthmata_stathera')?.value || '';

    const proorh_proseleysh = document.getElementById('xronosProetoimasias_stathera')?.value || '';

    const proorhApoxorhsh_stathera =
        document.getElementById('proorhApoxorhsh_stathera')?.value || '';

    try {
        const response = await fetch('/ergazomenoi/programmata/calcApasxolhseisPeriodoy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apo_hmeromhnia,
                eos_hmeromhnia,
                ypokatasthmata_stathera,
                proorh_proseleysh,
                proorhApoxorhsh_stathera
            })
        });

        const payload = await response.json();

        if (!payload.success) {
            return Swal.fire({
                ...calcApasxolhseisNoticeOptions(),
                icon: 'warning',
                title: 'Υπολογισμός Απασχολήσεων',
                text: payload.message || 'Ο υπολογισμός δεν ολοκληρώθηκε.'
            });
        }

        console.log(payload);

        await Swal.fire({
            ...calcApasxolhseisNoticeOptions(),
            icon: 'success',
            title: 'Υπολογισμός Απασχολήσεων',
            text: `Βρέθηκαν ${payload.employeesCount} εργαζόμενοι.`
        });
    } catch (error) {
        console.error(error);

        await Swal.fire({
            ...calcApasxolhseisNoticeOptions(),
            icon: 'error',
            title: 'Υπολογισμός Απασχολήσεων',
            text: 'Σφάλμα επικοινωνίας με τον server.'
        });
    }
});
