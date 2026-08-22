'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    await Swal.fire({
        icon: 'info',
        text: 'Η άντληση των δεδομένων Ψηφιακής Κάρτας από το ΕΡΓΑΝΗ ΙΙ θα πρέπει να έχει ήδη γίνει από τη Δανειζόμενη Εταιρεία. Η παρούσα ενέργεια ενημερώνει μόνο τις Ψηφιακές Κάρτες της Δανείζουσας Εταιρείας.',
        confirmButtonText: 'Το κατάλαβα',
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
            title: 'custom-title', popup: 'custom-swal-popup',
            confirmButton: 'class-info custom-confirm-button custom-swal-button'
        }
    });

    const button = document.getElementById('updateBorrowedCardsButton');
    const targetBranch = document.getElementById('target_ypokatasthma');
    const targetBranchSelect = document.getElementById('target_ypokatasthmata');
    const sourceBranch = document.getElementById('source_ypokatasthma');
    const from = document.getElementById('apo_hmeromhnia');
    const to = document.getElementById('eos_hmeromhnia');

    async function loadSourceBranches() {
        sourceBranch.disabled = true;
        sourceBranch.innerHTML = '<option value="">Φόρτωση...</option>';
        if (!targetBranch.value) {
            sourceBranch.innerHTML = '<option value="">Επιλέξτε πρώτα Παράρτημα Δανείζουσας Εταιρείας</option>';
            return;
        }
        try {
            const params = new URLSearchParams({ target_ypokatasthma: targetBranch.value });
            const response = await fetch(`/ergazomenoi/programmata/borrowed-card-source-branches?${params}`);
            const payload = await response.json();
            if (!response.ok || payload.success !== true) throw new Error(payload.message || 'Δεν βρέθηκε μοναδική Δανειζόμενη εταιρεία.');
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
            await Swal.fire({ icon: 'warning', title: 'Δεν μπορεί να συνεχιστεί η ενημέρωση', text: error.message });
        }
    }
    targetBranchSelect?.addEventListener('change', () => setTimeout(loadSourceBranches, 0));

    button?.addEventListener('click', async () => {
        if (!targetBranch.value || !sourceBranch.value || !from.value || !to.value || from.value > to.value) {
            await Swal.fire({ icon: 'warning', title: 'Ελέγξτε τα Παραρτήματα και το διάστημα ημερομηνιών' });
            return;
        }
        const loader = document.querySelector('.loader-container');
        if (loader) loader.style.display = 'grid';
        try {
            const csrfToken = document.getElementById('borrowedCardsCsrfToken')?.value;
            const response = await fetch('/ergazomenoi/programmata/updatePshfiakesKartesMonoDaneizomenon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
                body: JSON.stringify({ target_ypokatasthma: targetBranch.value,
                    source_ypokatasthma: sourceBranch.value,
                    apo_hmeromhnia: from.value, eos_hmeromhnia: to.value })
            });
            const payload = await response.json();
            if (!response.ok || payload.success !== true) throw new Error(payload.message || 'UPDATE_FAILED');
            const summary = payload.summary;
            const warnings = summary.skippedMappings + summary.conflicts + summary.ambiguities +
                summary.targetAmbiguities + summary.employeesWithoutSourceRows;
            await Swal.fire({ icon: warnings ? 'warning' : 'success',
                title: warnings ? 'Η ενημέρωση ολοκληρώθηκε με προειδοποιήσεις' : 'Η ενημέρωση ολοκληρώθηκε',
                html: `Εργαζόμενοι: <strong>${summary.targetEmployeesFound}</strong><br>` +
                    `Ενημερωμένες εγγραφές: <strong>${summary.targetRowsUpdated}</strong><br>` +
                    `Παραλείψεις/συγκρούσεις: <strong>${warnings}</strong>`,
                confirmButtonText: 'Κλείσιμο' });
        } catch (error) {
            await Swal.fire({ icon: 'error', title: 'Σφάλμα κατά την ενημέρωση',
                text: error.message === 'UPDATE_FAILED' ? 'Η ενημέρωση των Ψηφιακών Καρτών δεν ολοκληρώθηκε.' : error.message,
                confirmButtonText: 'Κλείσιμο' });
        } finally {
            if (loader) loader.style.display = 'none';
        }
    });
});
