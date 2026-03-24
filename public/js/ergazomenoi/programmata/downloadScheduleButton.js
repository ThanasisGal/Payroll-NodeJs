document.addEventListener('DOMContentLoaded', async function () {
    const downloadScheduleButton = document.getElementById('downloadScheduleButton');

    const selectedTeam = document.getElementById('team').value;
    const selectedCompany = document.getElementById('company_kod').value;
    const selectedPararthma = document.getElementById('ypokatasthmaHidden');
    const fromDateField = document.getElementById('apo_hmeromhnia');
    const toDateField = document.getElementById('eos_hmeromhnia');

    document.getElementById('ypokatasthmata').addEventListener('change', function (event) {
        const selectedOption = event.target.options[event.target.selectedIndex];
        const valueLength = selectedOption.value.length;
        selectedPararthma.value = valueLength > 0 ? parseInt(selectedOption.value).toString() : '';
    });

    function validateForm() {
        // Έλεγχος υποχρεωτικών πεδίων
        const requiredFields = document.querySelectorAll('#transferForm [required]');
        for (let field of requiredFields) {
            if (!field.value) {
                const label = document.querySelector(`label[for="${field.id}"]`);
                const labelText = label ? label.textContent.trim() : '???';
                alert(`Το πεδίο "${labelText}" είναι υποχρεωτικό.`);
                field.focus();
                return false;
            }
        }

        // Έλεγχος ίδιου μήνα/έτους
        const from = new Date(fromDateField.value);
        const to = new Date(toDateField.value);
        if (from.getMonth() !== to.getMonth() || from.getFullYear() !== to.getFullYear()) {
            alert('Οι ημερομηνίες πρέπει να ανήκουν στον ίδιο μήνα και στο ίδιο έτος');
            toDateField.focus();
            return false;
        }

        return true;
    }

    downloadScheduleButton.addEventListener('click', async function (event) {
        event.preventDefault();

        const isValid = validateForm();
        if (!isValid) return;

        const _result = await Swal.fire({
            title: 'Είσαι σίγουρος / η;',
            html: `Θα γίνει λήψη των ωραρίων από την Εργάνη και αποθήκευση τους.`,
            icon: 'info',
            showCancelButton: true,
            focusConfirm: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#3332049a',
            confirmButtonText: 'Λήψη',
            cancelButtonText: 'Ακύρωση',
            customClass: {
                title: 'custom-title',
                popup: 'custom-swal-popup',
                confirmButton: 'class-info custom-confirm-button custom-swal-button',
                cancelButton: 'custom-cancel-button custom-swal-button'
            },
            didOpen: () => {
                Swal.getCancelButton().focus();
            }
        });

        if (_result.isConfirmed) {
            const loader = document.querySelector('.loader-container');
            if (loader) loader.style.display = 'grid';

            const pararthma = selectedPararthma.value || '';

            // Μετατροπή ημερομηνιών από YYYY-MM-DD σε DD/MM/YYYY
            const fromDate =
                fromDateField.value.substring(8, 10) +
                '/' +
                fromDateField.value.substring(5, 7) +
                '/' +
                fromDateField.value.substring(0, 4);

            const toDate =
                toDateField.value.substring(8, 10) +
                '/' +
                toDateField.value.substring(5, 7) +
                '/' +
                toDateField.value.substring(0, 4);

            try {
                // Διάβασε το CSRF token από το cookie
                const csrfToken = document.cookie
                    .split('; ')
                    .find((row) => row.startsWith('psifl.x-csrf-token='))
                    ?.split('=')[1];

                const response = await fetch('/ergazomenoi/programmata/downloadSchedule', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'csrf-token': csrfToken
                    },
                    body: JSON.stringify({
                        selectedTeam: selectedTeam,
                        selectedCompany: selectedCompany,
                        fromDate: fromDate,
                        toDate: toDate,
                        selectedPararthma: pararthma
                    })
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                if (loader) loader.style.display = 'none';

                const data = await response.json();

                Swal.fire({
                    icon: 'success',
                    title: 'Επιτυχής Λήψη Ωραρίων',
                    html: `Τα ωράρια αποθηκεύτηκαν επιτυχώς.`,
                    timer: 4000,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        title: 'custom-title',
                        popup: 'custom-swal-popup',
                        confirmButton: 'class-success custom-confirm-button custom-swal-button'
                    },
                    willClose: () => {
                        window.location.href = data.redirectUrl;
                    }
                });
            } catch (error) {
                const loader = document.querySelector('.loader-container');
                if (loader) loader.style.display = 'none';

                Swal.fire({
                    icon: 'error',
                    title: 'Σφάλμα κατά τη Λήψη Ωραρίων',
                    html: `Επικοινωνήστε με τον διαχειριστή μέσω της φόρμας <strong>"Επικοινωνία"</strong>`,
                    timer: 5000,
                    confirmButtonText: 'Κλείσιμο',
                    customClass: {
                        title: 'custom-title',
                        popup: 'custom-swal-popup',
                        confirmButton: 'class-normal custom-confirm-button custom-swal-button'
                    },
                    willClose: () => {
                        window.location.href = '/mainapp';
                    }
                });
            }
        }
    });
});
