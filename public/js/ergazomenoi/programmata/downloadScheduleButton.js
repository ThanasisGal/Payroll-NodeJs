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

    let downloadInProgress = false;
    const failureReasons = Object.freeze({
        SCHEDULE_INVALID_REQUEST: 'Οι επιλογές της φόρμας δεν έγιναν δεκτές.',
        SCHEDULE_AUTH_REQUIRED: 'Η εφαρμογή δεν επιβεβαίωσε ενεργή σύνδεση χρήστη.',
        SCHEDULE_FORBIDDEN: 'Η εφαρμογή δεν επέτρεψε τη λήψη με τα τρέχοντα δικαιώματα.',
        SCHEDULE_CSRF_REJECTED: 'Η εφαρμογή δεν μπόρεσε να επιβεβαιώσει ότι η αίτηση προήλθε από την ενεργή φόρμα.',
        SCHEDULE_RESOURCE_UNAVAILABLE: 'Η εταιρεία ή το παράρτημα δεν είναι διαθέσιμα για αυτή την ενέργεια.',
        SCHEDULE_CONFLICT: 'Η εφαρμογή βρήκε κατάσταση που εμποδίζει τη συνέχιση της λήψης.',
        SCHEDULE_ACCESS_CHECK_FAILED: 'Δεν ολοκληρώθηκε ο έλεγχος πρόσβασης στη λήψη.',
        SCHEDULE_DATES_INVALID: 'Οι ημερομηνίες της λήψης δεν έγιναν δεκτές.',
        SCHEDULE_BRANCH_INVALID: 'Η επιλογή παραρτήματος δεν έγινε δεκτή.',
        SCHEDULE_CREDENTIALS_MISSING: 'Δεν βρέθηκαν οι απαραίτητες ρυθμίσεις σύνδεσης για τη λήψη.',
        SCHEDULE_PERIOD_FAILED: 'Δεν ολοκληρώθηκε η ανάκτηση της περιόδου αποθήκευσης.',
        SCHEDULE_FILE_PREPARATION_FAILED: 'Δεν ολοκληρώθηκε η προετοιμασία του αρχείου αποθήκευσης.',
        SCHEDULE_DOWNLOAD_FAILED: 'Δεν ολοκληρώθηκε η λήψη του αρχείου ωραρίων.',
        SCHEDULE_LOCAL_SAVE_FAILED: 'Δεν ολοκληρώθηκε η αποθήκευση του αρχείου ωραρίων.',
        SCHEDULE_PROCESSING_FAILED: 'Δεν ολοκληρώθηκε η επεξεργασία και η αποθήκευση των ωραρίων.',
        SCHEDULE_ARCHIVE_FAILED: 'Δεν ολοκληρώθηκε η αρχειοθέτηση του αρχείου ωραρίων.',
        SCHEDULE_INTERNAL_ERROR: 'Η εφαρμογή δεν ολοκλήρωσε την επεξεργασία της λήψης.',
        SCHEDULE_BROWSER_FAILED: 'Δεν ολοκληρώθηκε η λειτουργία του εργαλείου περιήγησης που χρησιμοποιεί η λήψη.',
        SCHEDULE_SEARCH_FAILED: 'Δεν ολοκληρώθηκε η αναζήτηση των ωραρίων στη σελίδα του ΕΡΓΑΝΗ ΙΙ.',
        SCHEDULE_EXPORT_FAILED: 'Δεν ολοκληρώθηκε η εξαγωγή του αρχείου ωραρίων από το ΕΡΓΑΝΗ ΙΙ.',
        EMPLOYEE_WORK_WRITE_SCOPE_REQUIRED: 'Δεν επιβεβαιώθηκαν τα απαραίτητα στοιχεία για ασφαλή αποθήκευση των ωραρίων.',
        EMPLOYEE_WORK_WRITE_EMPLOYEE_MISSING: 'Δεν επιβεβαιώθηκε η αντιστοίχιση των ωραρίων για ασφαλή αποθήκευση.',
        EMPLOYEE_WORK_WRITE_OUTSIDE_EMPLOYMENT: 'Βρέθηκε ημέρα εκτός τεκμηριωμένης απασχόλησης.',
        EMPLOYEE_WORK_WRITE_NOT_APPLIED: 'Δεν επιβεβαιώθηκε η αποθήκευση όλων των αναμενόμενων εγγραφών.',
        EMPLOYEE_WORK_WRITE_PERIOD_PROTECTED: 'Η περίοδος έχει κλειδωθεί ή οριστικοποιηθεί.',
        EMPLOYEE_WORK_WRITE_COMMIT_UNCONFIRMED: 'Δεν ολοκληρώθηκε η επιβεβαίωση αποθήκευσης των ωραρίων.',
        EMPLOYEE_WORK_WRITE_PROTECTION_UNAVAILABLE: 'Δεν επιβεβαιώθηκε ότι η αποθήκευση των ωραρίων μπορεί να γίνει με ασφάλεια.',
        ERGANI_LOGIN_OR_NAVIGATION_FAILED: 'Δεν ολοκληρώθηκε η σύνδεση ή η μετάβαση στη σελίδα ωραρίων του ΕΡΓΑΝΗ ΙΙ.',
        ERGANI_BRANCH_SELECTOR_MISSING: 'Δεν εντοπίστηκε η επιλογή παραρτήματος στη σελίδα του ΕΡΓΑΝΗ ΙΙ.',
        ERGANI_BRANCH_OPTION_MISSING: 'Δεν εντοπίστηκε το επιλεγμένο παράρτημα στη σελίδα του ΕΡΓΑΝΗ ΙΙ.',
        ERGANI_BRANCH_SELECTION_FAILED: 'Δεν επιβεβαιώθηκε η επιλογή παραρτήματος στη σελίδα του ΕΡΓΑΝΗ ΙΙ.',
        SCHEDULE_NETWORK_FAILED: 'Δεν παραλήφθηκε απάντηση από την εφαρμογή. Δεν είναι γνωστό αν η λήψη ξεκίνησε ή ολοκληρώθηκε.',
        SCHEDULE_RESPONSE_INVALID: 'Παραλήφθηκε απάντηση που δεν μπόρεσε να διαβαστεί με ασφάλεια.',
        SCHEDULE_REJECTED: 'Η απάντηση της εφαρμογής δεν επιβεβαίωσε επιτυχημένη λήψη.',
        SCHEDULE_HTTP_FAILED: 'Η εφαρμογή επέστρεψε ανεπιτυχή απάντηση για τη λήψη.'
    });
    const statusCodes = { 400: 'SCHEDULE_INVALID_REQUEST', 401: 'SCHEDULE_AUTH_REQUIRED',
        403: 'SCHEDULE_FORBIDDEN', 404: 'SCHEDULE_RESOURCE_UNAVAILABLE', 409: 'SCHEDULE_CONFLICT',
        500: 'SCHEDULE_INTERNAL_ERROR' };
    const referencePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    async function requestSchedule(body, csrfToken) {
        let response;
        try {
            response = await fetch('/ergazomenoi/programmata/downloadSchedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
                body: JSON.stringify(body)
            });
        } catch (_networkError) {
            return { success: false, kind: 'network', code: 'SCHEDULE_NETWORK_FAILED' };
        }
        const status = response.status;
        const headerReference = response.headers.get('X-Correlation-ID');
        const correlationId = referencePattern.test(headerReference || '') ? headerReference : '';
        let data;
        try {
            const contentType = response.headers.get('Content-Type') || '';
            if (!/application\/(?:[a-z0-9.+-]+\+)?json(?:;|$)/i.test(contentType)) {
                throw new Error('Unexpected response format');
            }
            data = await response.json();
        } catch (_responseError) {
            return { success: false, status, correlationId,
                kind: response.ok ? 'response' : 'http',
                code: response.ok ? 'SCHEDULE_RESPONSE_INVALID' : statusCodes[status] || 'SCHEDULE_HTTP_FAILED' };
        }
        const error = data && typeof data.error === 'object' && data.error !== null ? data.error : {};
        const reference = referencePattern.test(error.correlationId || '') ? error.correlationId : correlationId;
        if (!response.ok || data?.success === false || data?.error) {
            return { success: false, status, correlationId: reference,
                kind: response.ok ? 'application' : 'http',
                code: Object.hasOwn(failureReasons, error.code) ? error.code
                    : response.ok ? 'SCHEDULE_REJECTED' : statusCodes[status] || 'SCHEDULE_HTTP_FAILED',
                storageState: ['not_started', 'uncertain', 'completed'].includes(error.storageState)
                    ? error.storageState : 'uncertain' };
        }
        if (!data || Array.isArray(data) || data.success !== true) {
            return { success: false, kind: 'response', status, correlationId,
                code: 'SCHEDULE_RESPONSE_INVALID' };
        }
        return { success: true };
    }

    function failureText(result) {
        const storage = result.code === 'EMPLOYEE_WORK_WRITE_COMMIT_UNCONFIRMED'
            ? 'Δεν μπορεί να επιβεβαιωθεί αν αποθηκεύτηκαν αλλαγές στις εγγραφές ωραρίων από αυτή την προσπάθεια.'
            : result.code.startsWith('EMPLOYEE_WORK_WRITE_')
              ? 'Δεν αποθηκεύτηκε καμία αλλαγή στις εγγραφές ωραρίων από αυτή την προσπάθεια. Ενδέχεται να έχει παραληφθεί το αρχείο λήψης.'
            : result.storageState === 'not_started'
            ? 'Δεν αποθηκεύτηκε καμία αλλαγή από αυτή την προσπάθεια.'
            : result.storageState === 'completed'
              ? 'Η αποθήκευση των ωραρίων έχει ολοκληρωθεί.'
              : 'Δεν μπορεί να επιβεβαιωθεί αν αποθηκεύτηκαν αλλαγές. Ενδέχεται η ενέργεια να έχει εκτελεστεί εν μέρει.';
        const firstStep = result.code === 'SCHEDULE_AUTH_REQUIRED'
            ? 'Συνδεθείτε ξανά στην εφαρμογή.'
            : result.code === 'SCHEDULE_DATES_INVALID' || result.code === 'SCHEDULE_BRANCH_INVALID' || result.status === 400
              ? 'Ελέγξτε τις ημερομηνίες, την εταιρεία και το παράρτημα της φόρμας.'
              : result.kind === 'network' ? 'Ελέγξτε τη σύνδεσή σας στο διαδίκτυο.'
                : 'Κρατήστε τον παρακάτω κωδικό αναφοράς.';
        return `Η λήψη των προδηλωμένων ωραρίων δεν επιβεβαιώθηκε. ${failureReasons[result.code]}\n\n` +
            `1. ${firstStep}\n` +
            '2. Ζητήστε από την υποστήριξη έλεγχο της αποθήκευσης και του σφάλματος πριν επαναλάβετε τη λήψη.\n\n' +
            `${storage}\n` +
            (result.status ? `Κατάσταση HTTP: ${result.status}\n` : '') +
            `Κωδικός αναφοράς: ${result.code}${result.correlationId ? ' / ' + result.correlationId : ''}`;
    }

    downloadScheduleButton.addEventListener('click', async function (event) {
        event.preventDefault();
        if (downloadInProgress || !validateForm()) return;
        downloadInProgress = true;
        const wasDisabled = downloadScheduleButton.disabled;
        downloadScheduleButton.disabled = true;
        const loader = document.querySelector('.loader-container');
        try {
            const _result = await ErganiFormsSwal.fire({
                title: 'Είσαι σίγουρος / η;',
                html: `Θα γίνει λήψη των προδηλωμένων ωραρίων από την Εργάνη ΙΙ και αποθήκευση τους.`,
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

            if (!_result.isConfirmed) return;
            if (loader) loader.style.display = 'grid';
            const formatDate = (value) => value.substring(8, 10) + '/' +
                value.substring(5, 7) + '/' + value.substring(0, 4);
            const csrfToken = document.cookie.split('; ')
                .find((row) => row.startsWith('psifl.x-csrf-token='))?.split('=')[1];
            const result = await requestSchedule({
                selectedTeam, selectedCompany,
                fromDate: formatDate(fromDateField.value),
                toDate: formatDate(toDateField.value),
                selectedPararthma: selectedPararthma.value || ''
            }, csrfToken);
            if (loader) loader.style.display = 'none';
            if (!result.success) {
                await ErganiFormsSwal.fire({
                    icon: 'error',
                    title: 'Η λήψη των ωραρίων δεν επιβεβαιώθηκε',
                    text: failureText(result),
                    confirmButtonText: 'Κλείσιμο',
                    allowOutsideClick: false,
                    customClass: {
                        title: 'custom-title', popup: 'custom-swal-popup schedule-download-error',
                        confirmButton: 'class-normal custom-confirm-button custom-swal-button'
                    }
                });
                return;
            }
            await ErganiFormsSwal.fire({
                icon: 'success', title: 'Επιτυχής Λήψη Ωραρίων',
                text: 'Τα ωράρια αποθηκεύτηκαν επιτυχώς.',
                confirmButtonText: 'Κλείσιμο',
                customClass: {
                    title: 'custom-title', popup: 'custom-swal-popup',
                    confirmButton: 'class-success custom-confirm-button custom-swal-button'
                }
            });
            window.location.href = '/ergazomenoi/programmata/lhpshOrarionApoErganh';
        } finally {
            if (loader) loader.style.display = 'none';
            downloadScheduleButton.disabled = wasDisabled;
            downloadInProgress = false;
        }
    });
});
