// document.addEventListener("DOMContentLoaded", function () {
//   const recalcButton = document.getElementById('reCalcButton');
//   if (recalcButton) {
//       recalcButton.addEventListener('click', reCalculate);
//   }
// });

// async function reCalculate() {
//   // Μηδενίζουμε όλα τα input πεδία στο δεύτερο tab της φόρμας
//   clearInputsApodoxon();

//   for (let i = 1; i <= 15; i++) {
//       const selectedElement = document.getElementById(`stoixeioSymbashsHidden_${i.toString().padStart(2, '0')}`).value;
//       const contract = document.getElementById("selectedSymbash").value.toString().padStart(4, '0');
//       const category = document.getElementById("selectedKathgoria").value.toString().padStart(4, '0');
//       const specialty = document.getElementById("selectedEidikothta").value.toString().padStart(4, '0');
//       const klimakio = document.getElementById("misthologiko_klimakio").value.toString().padStart(2, '0');
//       if (selectedElement && selectedElement !== "") {
//         await updatePosoAndTotal(i, contract, category, specialty, selectedElement, klimakio);
//       }
//     // }
//   }

// }

// function clearInputsApodoxon() {
//   const inputs = document.querySelectorAll('.clearAble');
//   inputs.forEach(input => {
//       input.value = '';
//   });
// }

// public/js/ergazomenoi/genika/reCalcApodoxes_Edit.js

// ============================================================================
// ΕΠΑΝΥΠΟΛΟΓΙΣΜΟΣ ΑΠΟΔΟΧΩΝ - EDIT FLOW
// ============================================================================
// Σκοπός:
// 1. Καθαρίζει τα πεδία αποδοχών.
// 2. Ξαναφέρνει τα ποσά από τη σύμβαση/κλιμάκιο.
// 3. Καλεί calculateTotal() ώστε να ξαναϋπολογιστούν τα σύνολα.
// 4. Καλεί calculatePartTimeWages() ώστε σε μερική απασχόληση να εφαρμοστεί
//    η ίδια λογική πραγματικού ωρομισθίου που χρησιμοποιείται και στην αρχική φόρμα:
//      - actual_plus_extra
//      - full_legal_plus_extra
// ============================================================================

document.addEventListener('DOMContentLoaded', function () {
    const recalcButton = document.getElementById('reCalcButton');
    if (recalcButton) {
        recalcButton.addEventListener('click', reCalculate);
    }
});

async function reCalculate() {
    try {
        // Μηδενίζουμε όλα τα input πεδία αποδοχών.
        clearInputsApodoxon();

        const contract = getValueByIds(['selectedSymbash', 'symbash_stathera']).padStart(4, '0');
        const category = getValueByIds([
            'selectedKathgoria',
            'kathgoria_symbashs_stathera'
        ]).padStart(4, '0');
        const specialty = getValueByIds([
            'selectedEidikothta',
            'eidikothta_symbashs_stathera'
        ]).padStart(4, '0');
        const klimakio = (getValueByIds(['misthologiko_klimakio']) || '01').padStart(2, '0');

        for (let i = 1; i <= 15; i++) {
            const idNum = i.toString().padStart(2, '0');

            const selectedElement = getValueByIds([
                `stoixeioSymbashsHidden_${idNum}`,
                `stoixeio_symbashs_${idNum}`
            ]).padStart(4, '0');

            if (selectedElement && selectedElement !== '0000') {
                await updatePosoAndTotal(
                    i,
                    contract,
                    category,
                    specialty,
                    selectedElement,
                    klimakio
                );
            }
        }

        // Πρώτα ξαναϋπολογίζουμε τα συνολικά ποσά.
        if (typeof window.calculateTotal === 'function') {
            window.calculateTotal();
        } else if (typeof calculateTotal === 'function') {
            calculateTotal();
        }

        // Μετά ξανατρέχουμε τον υπολογισμό μερικής απασχόλησης.
        // Αυτό είναι απαραίτητο για να εφαρμοστεί σωστά η επιλογή της εταιρείας:
        // actual_plus_extra ή full_legal_plus_extra.
        callPartTimeWagesAfterRecalc();
    } catch (error) {
        console.error('❌ [reCalcApodoxes_Edit] Error in reCalculate:', error);
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                backdrop: false,
                allowOutsideClick: false,
                icon: 'error',
                title: 'Σφάλμα',
                html: `Σφάλμα κατά τον επανυπολογισμό: ${error.message || error}`,
                confirmButtonText: 'Κλείσιμο',
                customClass: {
                    confirmButton: 'class-error custom-confirm-button custom-swal-button',
                    title: 'custom-title',
                    popup: 'custom-swal-popup'
                }
            });
        }
    }
}

function callPartTimeWagesAfterRecalc() {
    const calculatePartTimeWagesFn =
        typeof window.calculatePartTimeWages === 'function'
            ? window.calculatePartTimeWages
            : typeof calculatePartTimeWages === 'function'
              ? calculatePartTimeWages
              : null;

    if (!calculatePartTimeWagesFn) {
        console.warn(
            '⚠️ [reCalcApodoxes_Edit] Δεν βρέθηκε calculatePartTimeWages(). ' +
                'Βάλε στο αρχείο που την περιέχει: window.calculatePartTimeWages = calculatePartTimeWages;'
        );
        return;
    }

    const typosErg = getValueByIds([
        'typos_apodoxon',
        'typosErg',
        'typos_ergazomenoy',
        'typos_ergazomenoy_stathera',
        'typos_apodoxon_stathera'
    ]);

    const eidKath =
        getValueByIds(['eidikh_kathgoria', 'eidikh_kathgoria_stathera', 'eidKath']) || '0001';

    const ores = toDecimalLocal(
        getValueByIds(['ores_ergasias_ebdomadas', 'ores_ergasias_ebdomadas_stathera']) || 0
    );

    const hmeres = toDecimalLocal(
        getValueByIds(['hmeres_ergasias_ebdomadas', 'hmeres_ergasias_ebdomadas_stathera']) || 0
    );

    console.log('🔁 [reCalcApodoxes_Edit] Calling calculatePartTimeWages:', {
        typosErg,
        eidKath,
        ores: ores.toString(),
        hmeres: hmeres.toString(),
        extraMode:
            window._EXTRA_APODOXES_CALC_MODE ||
            document.getElementById('extra_apodoxes_calc_mode')?.value ||
            'actual_plus_extra'
    });

    calculatePartTimeWagesFn(typosErg, eidKath, ores, hmeres);
}

function getValueByIds(ids) {
    for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;

        let value = '';

        if (el.tomselect && typeof el.tomselect.getValue === 'function') {
            value = el.tomselect.getValue();
        } else {
            value = el.value;
        }

        value = String(value ?? '').trim();
        if (value !== '') return value;
    }

    return '';
}

function toDecimalLocal(value) {
    if (typeof window.Decimal !== 'undefined') {
        return new window.Decimal(String(value || 0).replace(',', '.'));
    }

    if (typeof Decimal !== 'undefined') {
        return new Decimal(String(value || 0).replace(',', '.'));
    }

    throw new Error('Δεν έχει φορτωθεί το Decimal.js');
}

function clearInputsApodoxon() {
    const inputs = document.querySelectorAll('.clearAble');
    inputs.forEach((input) => {
        input.value = '';
    });
}

window.reCalculate = reCalculate;
