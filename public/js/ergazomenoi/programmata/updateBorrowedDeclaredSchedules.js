'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    const ENTRY_MESSAGE =
        'Η άντληση των δεδομένων από το ΕΡΓΑΝΗ ΙΙ θα πρέπει να έχει γίνει από την Δανειζόμενη Εταιρεία. ' +
        'Με την παρούσα ενέργεια θα γίνει μόνο ενημέρωση των Προδηλωμένων Ωραρίων της Δανείζουσας Εταιρείας.';
    await Swal.fire({
        icon: 'info',
        text: ENTRY_MESSAGE,
        confirmButtonText: 'Το κατάλαβα',
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
            title: 'custom-title',
            popup: 'custom-swal-popup',
            confirmButton: 'class-info custom-confirm-button custom-swal-button'
        }
    });

    const button = document.getElementById('updateBorrowedSchedulesButton');
    const targetBranch = document.getElementById('target_ypokatasthma');
    const targetBranchSelect = document.getElementById('target_ypokatasthmata');
    const sourceBranch = document.getElementById('source_ypokatasthma');
    const from = document.getElementById('apo_hmeromhnia');
    const to = document.getElementById('eos_hmeromhnia');

    function validateForm() {
        if (!targetBranch.value || !sourceBranch.value) {
            Swal.fire({ icon: 'warning', title: 'Επιλέξτε και τα δύο Παραρτήματα' });
            return false;
        }
        if (!from.value || !to.value) {
            Swal.fire({ icon: 'warning', title: 'Συμπληρώστε το διάστημα ημερομηνιών' });
            return false;
        }
        const fromDate = new Date(`${from.value}T00:00:00`);
        const toDate = new Date(`${to.value}T00:00:00`);
        if (fromDate > toDate) {
            Swal.fire({ icon: 'warning', title: 'Το «Από» δεν μπορεί να είναι μετά το «Έως»' });
            return false;
        }
        return true;
    }

    async function loadSourceBranches() {
        sourceBranch.disabled = true;
        sourceBranch.innerHTML = '<option value="">Φόρτωση...</option>';
        if (!targetBranch.value) {
            sourceBranch.innerHTML = '<option value="">Επιλέξτε πρώτα Παράρτημα Δανείζουσας Εταιρείας</option>';
            return;
        }
        try {
            const params = new URLSearchParams({ target_ypokatasthma: targetBranch.value });
            const response = await fetch(`/ergazomenoi/programmata/borrowed-source-branches?${params}`);
            const payload = await response.json();
            if (!response.ok || payload.success !== true) throw new Error(payload.message || 'LOAD_FAILED');
            sourceBranch.innerHTML = '<option value="">Επιλέξτε Παράρτημα</option>';
            for (const row of payload.branches) {
                const option = document.createElement('option');
                option.value = row.kodikos;
                option.textContent = `${row.kodikos}${row.perigrafh ? ` - ${row.perigrafh}` : ''}`;
                sourceBranch.appendChild(option);
            }
            sourceBranch.disabled = false;
        } catch (error) {
            sourceBranch.innerHTML = '<option value="">Δεν είναι διαθέσιμα Παραρτήματα</option>';
            await Swal.fire({ icon: 'warning', title: 'Δεν μπορεί να συνεχιστεί η ενημέρωση',
                text: error.message === 'LOAD_FAILED' ? 'Δεν βρέθηκε μοναδική Δανειζόμενη εταιρεία.' : error.message });
        }
    }

    targetBranchSelect?.addEventListener('change', () => setTimeout(loadSourceBranches, 0));

    button?.addEventListener('click', async () => {
        if (!validateForm()) return;
        const loader = document.querySelector('.loader-container');
        if (loader) loader.style.display = 'grid';
        try {
            const csrfToken = document.cookie
                .split('; ')
                .find((row) => row.startsWith('psifl.x-csrf-token='))
                ?.split('=')[1];
            const response = await fetch(
                '/ergazomenoi/programmata/updateProdhlomenaOrariaMonoDaneizomenon',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
                    body: JSON.stringify({
                        target_ypokatasthma: targetBranch.value,
                        source_ypokatasthma: sourceBranch.value,
                        apo_hmeromhnia: from.value,
                        eos_hmeromhnia: to.value
                    })
                }
            );
            const payload = await response.json();
            if (!response.ok || payload.success !== true) throw new Error('UPDATE_FAILED');
            const summary = payload.summary;
            const hasWarnings = summary.skippedMappings > 0 || summary.conflicts > 0 ||
                summary.ambiguities > 0 || summary.targetAmbiguities > 0 ||
                summary.employeesWithoutSourceRows > 0;
            await Swal.fire({
                icon: hasWarnings ? 'warning' : 'success',
                title: hasWarnings ? 'Η ενημέρωση ολοκληρώθηκε με προειδοποιήσεις' : 'Η ενημέρωση ολοκληρώθηκε',
                html:
                    `Εργαζόμενοι: <strong>${summary.targetEmployeesFound}</strong><br>` +
                    `Νέες εγγραφές: <strong>${summary.targetRowsInserted}</strong><br>` +
                    `Ενημερωμένες εγγραφές: <strong>${summary.targetRowsUpdated}</strong><br>` +
                    `Παραλείψεις/συγκρούσεις: <strong>${summary.skippedMappings + summary.conflicts + summary.ambiguities + summary.targetAmbiguities}</strong><br>` +
                    `Αμφίσημες υπάρχουσες εγγραφές: <strong>${summary.targetAmbiguities}</strong>`,
                confirmButtonText: 'Κλείσιμο'
            });
        } catch (_error) {
            await Swal.fire({
                icon: 'error',
                title: 'Σφάλμα κατά την ενημέρωση',
                text: 'Η ενημέρωση των Προδηλωμένων Ωραρίων δεν ολοκληρώθηκε.',
                confirmButtonText: 'Κλείσιμο'
            });
        } finally {
            if (loader) loader.style.display = 'none';
        }
    });
});
