document.addEventListener('DOMContentLoaded', function () {
    // ✅ Άκουσε το native change event του select
    const selectElements = document.querySelectorAll('.krathsh-select');

    selectElements.forEach((selectEl) => {
        const rowIndex = selectEl.dataset.rowIndex;

        // ✅ NATIVE change event (όχι Tom-Select custom)
        selectEl.addEventListener('change', function (e) {
            if (selectEl.value) {
                handleKrathshChange(rowIndex, selectEl.value);
            }
        });
    });

    // ✅ ΝΕΟ:  Άκουσε το focus event στα ama_ inputs
    for (let index = 1; index <= 7; index++) {
        const idNum = index.toString().padStart(2, '0');
        const amaInput = document.getElementById(`ama_krathshs_${idNum}`);

        if (amaInput) {
            amaInput.addEventListener('focus', function () {
                handleAmaFocus(idNum);
            });
        }
    }
});

function handleKrathshChange(rowIndex, selectedValue) {
    if (!selectedValue) {
        return;
    }

    // ✅ Πάρε το Tom-Select instance από το select element
    const selectId = `select_krathsh_${rowIndex}`;
    const selectEl = document.getElementById(selectId);

    if (!selectEl || !selectEl.tomselect) {
        console.warn('[handleKrathshChange] ⚠️ Δεν βρέθηκε Tom-Select instance για:', selectId);
        return;
    }

    const ts = selectEl.tomselect;

    // ✅ Πάρε την επιλεγμένη τιμή από Tom-Select
    const currentValue = ts.getValue();
    const selectedOption = ts.options[currentValue];
    if (!selectedOption || !selectedOption.kodikos_tameioy) {
        console.error(`❌ ΠΡΟΒΛΗΜΑ: Δεν βρέθηκε kodikos_tameioy! `);
        console.error('  selectedOption:', selectedOption);
        console.error(
            '  Έχει πεδίο kodikos_tameioy;',
            selectedOption ? Object.keys(selectedOption) : 'N/A'
        );
        return;
    }

    // ✅ Πάρε το κρυφό table (JSON array)
    const tableInput = document.getElementById('krathseis_table');
    let tableData = [];
    try {
        tableData = JSON.parse(tableInput.value || '[]');
    } catch (e) {
        console.error('❌ Σφάλμα κατά την ανάγνωση krathseis_table:', e);
        tableData = [];
    }

    // ✅ Ελέγξε αν ήδη υπάρχει αυτός ο κωδικός ταμείου
    const tameioBrief = {
        kodikos: String(selectedOption.kodikos || '').padStart(4, '0'),
        kodikos_tameioy: String(selectedOption.kodikos_tameioy || '').padStart(4, '0'),
        perigrafh: selectedOption.perigrafh || ''
    };

    const alreadyExists = tableData.some(
        (item) => item.kodikos_tameioy === tameioBrief.kodikos_tameioy
    );

    if (!alreadyExists) {
        tableData.push(tameioBrief);
        tableInput.value = JSON.stringify(tableData);
    }

    // ✅ Εκπέμψε custom event
    document.dispatchEvent(
        new CustomEvent('krathshChanged', {
            detail: { rowIndex, selectedOption, tableData }
        })
    );
}

// ✅ ΝΕΑ ΣΥΝΑΡΤΗΣΗ: Χειρισμός του focus event του ama_ input
function handleAmaFocus(rowIndex) {
    // 1️⃣ Πάρε τον kodikos_tameioy της τρέχουσας γραμμής
    const selectId = `select_krathsh_${rowIndex}`;
    const selectEl = document.getElementById(selectId);

    if (!selectEl || !selectEl.tomselect) {
        return;
    }

    const ts = selectEl.tomselect;
    const currentValue = ts.getValue();

    if (!currentValue) {
        return;
    }

    const selectedOption = ts.options[currentValue];
    const currentKodikosTameioy = selectedOption?.kodikos_tameioy;

    if (!currentKodikosTameioy) {
        console.warn('[handleAmaFocus] Δεν βρέθηκε kodikos_tameioy');
        return;
    }

    // 2️⃣ Πάρε τον πίνακα krathseis_table
    const tableInput = document.getElementById('krathseis_table');
    let tableData = [];
    try {
        tableData = JSON.parse(tableInput.value || '[]');
    } catch (e) {
        console.error('[handleAmaFocus] Σφάλμα parsing:', e);
        return;
    }

    // 3️⃣ Ψάξε αν υπάρχει άλλη γραμμή με ίδιο kodikos_tameioy
    const otherRowIndex = tableData.findIndex((item, idx) => {
        // Βρες αν υπάρχει άλλη γραμμή (όχι η τρέχουσα) με ίδιο kodikos_tameioy
        const itemNum = idx + 1; // το index του πίνακα + 1
        const itemIdNum = itemNum.toString().padStart(2, '0');

        return item.kodikos_tameioy === currentKodikosTameioy && itemIdNum !== rowIndex;
    });

    const amaInput = document.getElementById(`ama_krathshs_${rowIndex}`);

    if (otherRowIndex !== -1) {
        // ✅ Υπάρχει άλλη γραμμή με ίδιο kodikos_tameioy
        const otherRowIdNum = (otherRowIndex + 1).toString().padStart(2, '0');
        const otherAmaInput = document.getElementById(`ama_krathshs_${otherRowIdNum}`);

        if (otherAmaInput && otherAmaInput.value) {
            amaInput.value = otherAmaInput.value;
            // amaInput.readOnly = true;  // ✅ Απενεργοποίηση επεξεργασίας
            amaInput.style.backgroundColor = '#f0f0f0';
            amaInput.setAttribute('data-copied-from', `ama_krathshs_${otherRowIdNum}`);
        } else {
            // amaInput.readOnly = false;
            amaInput.style.backgroundColor = '';
            amaInput.removeAttribute('data-copied-from');
        }
    } else {
        // ✅ ΔΕΝ υπάρχει άλλη γραμμή - επιτρέπεται χειροκίνητη εισαγωγή
        // amaInput.readOnly = false;
        amaInput.style.backgroundColor = '';
        amaInput.removeAttribute('data-copied-from');
    }
}
