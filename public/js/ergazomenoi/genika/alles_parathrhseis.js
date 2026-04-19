document.addEventListener('DOMContentLoaded', function () {
    const tableInput = document.getElementById('typos_metabolhs_table');
    const row = document.getElementById('allo-parathrhseis-row');
    const input = document.getElementById('allo_parathrhseis');

    function toggleAlloRow() {
        let tableData = [];
        try {
            tableData = JSON.parse(tableInput?.value || '[]');
        } catch (e) {
            tableData = [];
        }

        // ✅ Ελέγχει αν υπάρχει κάποιο item με kodikos === '999'
        const has999 = tableData.some((item) => item.kodikos === '999');

        if (has999) {
            row.classList.remove('d-none');
        } else {
            row.classList.add('d-none');
            input.value = '';
        }
    }

    // ✅ Άκουσε αλλαγές στο hidden input (το TomSelect το ενημερώνει)
    tableInput?.addEventListener('change', toggleAlloRow);

    // ✅ MutationObserver για αλλαγές στην τιμή του hidden input
    // (γιατί το programmatic value change δεν πυροδοτεί το 'change' event)
    const observer = new MutationObserver(toggleAlloRow);
    if (tableInput) {
        observer.observe(tableInput, { attributes: true, attributeFilter: ['value'] });
    }

    // ✅ Polling fallback — ο πιο αξιόπιστος τρόπος για hidden inputs
    let lastValue = tableInput?.value || '';
    setInterval(() => {
        const currentValue = tableInput?.value || '';
        if (currentValue !== lastValue) {
            lastValue = currentValue;
            toggleAlloRow();
        }
    }, 200);

    // ✅ Έλεγχος κατά τη φόρτωση
    toggleAlloRow();
});
