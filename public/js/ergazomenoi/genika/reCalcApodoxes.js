// const Decimal = window.Decimal;

// import {
//     toDecimal,
//     formatDecimal,
//     showAlert,
//     fetchGenikesParametroi,
//     fetchApodoxesData,
//     updateGeneralParameters,
//     updatePosoBasedOnHours
// } from 'apodoxes-calculations';

// // ========================================================================
// // DECIMAL.JS CONFIGURATION
// // ========================================================================

// function waitForDecimal(callback) {
//     if (typeof Decimal !== 'undefined') {
//         callback();
//     } else {
//         console.warn('⏳ Waiting for Decimal.js to load...');
//         setTimeout(() => waitForDecimal(callback), 50);
//     }
// }

// waitForDecimal(function () {
//     Decimal.set({
//         precision: 28,
//         rounding: Decimal.ROUND_HALF_UP,
//         toExpNeg: -7,
//         toExpPos: 15
//     });

//     initReCalc();
// });

// // ========================================================================
// // INITIALIZATION
// // ========================================================================

// function initReCalc() {
//     document.addEventListener('DOMContentLoaded', function () {
//         const recalcButton = document.getElementById('reCalcButton');
//         if (recalcButton) {
//             recalcButton.addEventListener('click', reCalculate);
//         }
//     });
// }

// // ========================================================================
// // MAIN RECALCULATION FUNCTION
// // ========================================================================

// async function reCalculate() {
//     try {
//         // 🔵 ΒΗΜΑ 1: Αποθήκευση δωτών ποσών ΠΡΙΝ τον καθαρισμό
//         const savedExtraValues = saveExtraApodoxes();

//         clearInputsApodoxon();

//         const genikesParametroi = await fetchGenikesParametroi();
//         if (!genikesParametroi || !Array.isArray(genikesParametroi)) {
//             throw new Error('Αποτυχία φόρτωσης Γενικών Παραμέτρων');
//         }

//         updateGeneralParameters(genikesParametroi);

//         const contract = document
//             .getElementById('symbash_stathera')
//             ?.value?.trim()
//             .padStart(4, '0');
//         const category = document
//             .getElementById('kathgoria_symbashs_stathera')
//             ?.value?.trim()
//             .padStart(4, '0');
//         const specialty = document
//             .getElementById('eidikothta_symbashs_stathera')
//             ?.value?.trim()
//             .padStart(4, '0');
//         const klimakio =
//             document.getElementById('misthologiko_klimakio')?.value?.trim().padStart(2, '0') ||
//             '01';
//         const hmeromhnia = document.getElementById('hmeromhnia_allaghs_symbashs')?.value || '';

//         if (!contract || !category || !specialty) {
//             showAlert({
//                 icon: 'warning',
//                 title: 'Προσοχή',
//                 html: 'Παρακαλώ επιλέξτε <strong>Σύμβαση</strong>, <strong>Κατηγορία</strong> και <strong>Ειδικότητα</strong> πριν τον επανυπολογισμό.'
//             });
//             return;
//         }

//         const limit = window._ARITHMOS_STOIXEION_SYMBASEON || 15;

//         for (let i = 1; i <= limit; i++) {
//             const idNum = i.toString().padStart(2, '0');
//             const selectEl = document.getElementById(`stoixeio_symbashs_${idNum}`);

//             if (!selectEl) continue;

//             const selectedElement = selectEl.tomselect?.getValue() || selectEl.value;

//             if (selectedElement && selectedElement !== '' && selectedElement !== '0000') {
//                 await updatePosoAndTotal(
//                     i,
//                     contract,
//                     category,
//                     specialty,
//                     selectedElement.padStart(4, '0'),
//                     klimakio,
//                     hmeromhnia
//                 );
//             }
//         }

//         // 🔵 ΒΗΜΑ 2: Επαναφορά δωτών ποσών ΜΕΤΑ τον επανυπολογισμό
//         restoreExtraApodoxes(savedExtraValues);

//         if (typeof window.calculateTotal === 'function') {
//             window.calculateTotal();
//         }

//         showAlert({
//             icon: 'success',
//             title: 'Επιτυχία',
//             html: 'Οι αποδοχές επανυπολογίστηκαν με επιτυχία!',
//             confirmButtonText: 'OK'
//         });
//     } catch (error) {
//         console.error('❌ Error in reCalculate:', error);
//         showAlert({
//             icon: 'error',
//             title: 'Σφάλμα',
//             html: `Σφάλμα κατά τον επανυπολογισμό: ${error.message}`
//         });
//     }
// }

// // ========================================================================
// // SAVE / RESTORE ΔΩΤΩΝ ΑΠΟΔΟΧΩΝ
// // ========================================================================

// /**
//  * Αποθηκεύει τα δωτά ποσά (στοιχεία που έχουν posoBasei > 0 και poso == 0)
//  * πριν τον καθαρισμό των πεδίων.
//  */
// function saveExtraApodoxes() {
//     const saved = [];
//     const limit = window._ARITHMOS_STOIXEION_SYMBASEON || 15;

//     for (let i = 1; i <= limit; i++) {
//         const idNum = i.toString().padStart(2, '0');
//         const posoField = document.getElementById(`poso_symbashs_${idNum}`);
//         const posoBaseiField = document.getElementById(
//             `poso_symbashs_basei_oron_ergasias_${idNum}`
//         );

//         if (!posoField || !posoBaseiField) continue;

//         const posoVal = toDecimal(posoField.value);
//         const posoBaseiVal = toDecimal(posoBaseiField.value);

//         // Δωτό = έχει τιμή βάσει ωρών αλλά ΔΕΝ έχει τιμή βάσει σύμβασης
//         if (!posoBaseiVal.isZero() && posoVal.isZero()) {
//             saved.push({
//                 idNum,
//                 posoBasei: posoBaseiField.value
//             });
//         }
//     }

//     if (saved.length > 0) {
//         console.log(
//             `💾 Αποθηκεύτηκαν ${saved.length} δωτά ποσά:`,
//             saved.map((v) => `Row ${v.idNum}: ${v.posoBasei}`).join(', ')
//         );
//     }

//     return saved;
// }

// /**
//  * Επαναφέρει τα δωτά ποσά μετά τον επανυπολογισμό.
//  */
// function restoreExtraApodoxes(savedValues) {
//     if (!savedValues || savedValues.length === 0) return;

//     for (const saved of savedValues) {
//         const posoBaseiField = document.getElementById(
//             `poso_symbashs_basei_oron_ergasias_${saved.idNum}`
//         );
//         if (posoBaseiField) {
//             posoBaseiField.value = saved.posoBasei;
//         }
//     }

//     console.log(`♻️ Επαναφέρθηκαν ${savedValues.length} δωτά ποσά`);
// }

// // ========================================================================
// // UPDATE FUNCTIONS
// // ========================================================================

// async function updatePosoAndTotal(
//     rowIndex,
//     contract,
//     category,
//     specialty,
//     selectedElement,
//     klimakio,
//     hmeromhnia
// ) {
//     try {
//         const data = await fetchApodoxesData(
//             contract,
//             category,
//             specialty,
//             selectedElement,
//             klimakio,
//             hmeromhnia
//         );

//         if (!data.success) {
//             console.warn(`⚠️ No data for row ${rowIndex}, element ${selectedElement}`);
//             return;
//         }

//         const idNum = rowIndex.toString().padStart(2, '0');
//         const posoField = document.getElementById(`poso_symbashs_${idNum}`);

//         if (posoField) {
//             posoField.value = formatDecimal(data.poso, 2);
//         }

//         if (data.genikesParametroi) {
//             updateGeneralParameters(data.genikesParametroi);
//         }

//         const posoBasedOnHoursFieldId = `poso_symbashs_basei_oron_ergasias_${idNum}`;
//         const extraApodoxes = false;

//         updatePosoBasedOnHours(rowIndex, data, posoBasedOnHoursFieldId, extraApodoxes);
//     } catch (error) {
//         console.error(`❌ Error updating row ${rowIndex}:`, error);
//     }
// }

// // ========================================================================
// // UTILITY FUNCTIONS
// // ========================================================================

// function clearInputsApodoxon() {
//     const inputs = document.querySelectorAll('.clearAble');
//     inputs.forEach((input) => {
//         input.value = '';
//     });
// }

// // ========================================================================
// // GLOBAL EXPORT
// // ========================================================================

// window.reCalculate = reCalculate;

const Decimal = window.Decimal;

import {
    toDecimal,
    formatDecimal,
    showAlert,
    fetchGenikesParametroi,
    fetchApodoxesData,
    updateGeneralParameters,
    updatePosoBasedOnHours
} from 'apodoxes-calculations';

// ========================================================================
// DECIMAL.JS CONFIGURATION
// ========================================================================

function waitForDecimal(callback) {
    if (typeof Decimal !== 'undefined') {
        callback();
    } else {
        console.warn('⏳ Waiting for Decimal.js to load...');
        setTimeout(() => waitForDecimal(callback), 50);
    }
}

waitForDecimal(function () {
    Decimal.set({
        precision: 28,
        rounding: Decimal.ROUND_HALF_UP,
        toExpNeg: -7,
        toExpPos: 15
    });

    initReCalc();
});

// ========================================================================
// INITIALIZATION
// ========================================================================

function initReCalc() {
    document.addEventListener('DOMContentLoaded', function () {
        const recalcButton = document.getElementById('reCalcButton');
        if (recalcButton) {
            recalcButton.addEventListener('click', reCalculate);
        }
    });
}

// ========================================================================
// MAIN RECALCULATION FUNCTION
// ========================================================================

async function reCalculate() {
    try {
        // 🔵 ΒΗΜΑ 1: Αποθήκευση δωτών ποσών ΠΡΙΝ τον καθαρισμό
        const savedExtraValues = saveExtraApodoxes();

        clearInputsApodoxon();

        const genikesParametroi = await fetchGenikesParametroi();
        if (!genikesParametroi || !Array.isArray(genikesParametroi)) {
            throw new Error('Αποτυχία φόρτωσης Γενικών Παραμέτρων');
        }

        updateGeneralParameters(genikesParametroi);

        const contract = document
            .getElementById('symbash_stathera')
            ?.value?.trim()
            .padStart(4, '0');
        const category = document
            .getElementById('kathgoria_symbashs_stathera')
            ?.value?.trim()
            .padStart(4, '0');
        const specialty = document
            .getElementById('eidikothta_symbashs_stathera')
            ?.value?.trim()
            .padStart(4, '0');
        const klimakio =
            document.getElementById('misthologiko_klimakio')?.value?.trim().padStart(2, '0') ||
            '01';
        const hmeromhnia = document.getElementById('hmeromhnia_allaghs_symbashs')?.value || '';

        if (!contract || !category || !specialty) {
            showAlert({
                icon: 'warning',
                title: 'Προσοχή',
                html: 'Παρακαλώ επιλέξτε <strong>Σύμβαση</strong>, <strong>Κατηγορία</strong> και <strong>Ειδικότητα</strong> πριν τον επανυπολογισμό.'
            });
            return;
        }

        const limit = window._ARITHMOS_STOIXEION_SYMBASEON || 15;

        for (let i = 1; i <= limit; i++) {
            const idNum = i.toString().padStart(2, '0');
            const selectEl = document.getElementById(`stoixeio_symbashs_${idNum}`);

            if (!selectEl) continue;

            const selectedElement = selectEl.tomselect?.getValue() || selectEl.value;

            if (selectedElement && selectedElement !== '' && selectedElement !== '0000') {
                await updatePosoAndTotal(
                    i,
                    contract,
                    category,
                    specialty,
                    selectedElement.padStart(4, '0'),
                    klimakio,
                    hmeromhnia
                );
            }
        }

        // 🔵 ΒΗΜΑ 2: Επαναφορά δωτών ποσών ΜΕΤΑ τον επανυπολογισμό
        restoreExtraApodoxes(savedExtraValues);

        if (typeof window.calculateTotal === 'function') {
            window.calculateTotal();
        }

        // 🔵 ΒΗΜΑ 3: Ξανατρέχουμε τον ίδιο υπολογισμό μερικής απασχόλησης
        // που χρησιμοποιείται και στην αρχική φόρμα αποδοχών.
        //
        // Σημαντικό: γίνεται ΜΕΤΑ το calculateTotal(), γιατί η calculatePartTimeWages()
        // χρησιμοποιεί τα global totals:
        // - totalSymbashs
        // - totalBaseiOronErgasias
        // - _TOTAL_EXTRA_APODOXES
        recalculatePartTimeWagesAfterTotals();

        showAlert({
            icon: 'success',
            title: 'Επιτυχία',
            html: 'Οι αποδοχές επανυπολογίστηκαν με επιτυχία!',
            confirmButtonText: 'OK'
        });
    } catch (error) {
        console.error('❌ Error in reCalculate:', error);
        showAlert({
            icon: 'error',
            title: 'Σφάλμα',
            html: `Σφάλμα κατά τον επανυπολογισμό: ${error.message}`
        });
    }
}

// ========================================================================
// PART-TIME WAGES RECALCULATION AFTER TOTALS
// ========================================================================

function getFirstAvailableValue(ids, fallback = '') {
    for (const id of ids) {
        const el = document.getElementById(id);
        const value = el?.tomselect?.getValue?.() || el?.value;
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    return fallback;
}

function recalculatePartTimeWagesAfterTotals() {
    if (typeof window.calculatePartTimeWages !== 'function') {
        console.warn(
            '⚠️ [RECALC] window.calculatePartTimeWages δεν είναι διαθέσιμη. ' +
                'Βάλε στο τέλος του αρχείου που περιέχει τη calculatePartTimeWages(): ' +
                'window.calculatePartTimeWages = calculatePartTimeWages;'
        );
        return;
    }

    const typosErg = getFirstAvailableValue([
        'typos_apodoxon',
        'typos_apodoxon_stathera',
        'typos_ergazomenoy',
        'typos_ergazomenoy_stathera',
        'typosErg'
    ]);

    const eidKath = getFirstAvailableValue(
        ['eidikh_kathgoria', 'eidikh_kathgoria_stathera', 'eidKath'],
        '0001'
    ).padStart(4, '0');

    const ores = toDecimal(
        getFirstAvailableValue(['ores_ergasias_ebdomadas', 'ores_ergasias_ebdomadas_stathera'], '0')
    );

    const hmeres = toDecimal(
        getFirstAvailableValue(
            ['hmeres_ergasias_ebdomadas', 'hmeres_ergasias_ebdomadas_stathera'],
            '0'
        )
    );

    console.log('🔁 [RECALC] Calling calculatePartTimeWages:', {
        typosErg,
        eidKath,
        ores: ores.toString(),
        hmeres: hmeres.toString(),
        extraMode:
            window._EXTRA_APODOXES_CALC_MODE ||
            document.getElementById('extra_apodoxes_calc_mode')?.value ||
            'actual_plus_extra'
    });

    if (!typosErg || ores.isZero() || hmeres.isZero()) {
        console.warn('⚠️ [RECALC] Δεν υπάρχουν επαρκή δεδομένα για calculatePartTimeWages:', {
            typosErg,
            eidKath,
            ores: ores.toString(),
            hmeres: hmeres.toString()
        });
        return;
    }

    window.calculatePartTimeWages(typosErg, eidKath, ores, hmeres);
}

// ========================================================================
// SAVE / RESTORE ΔΩΤΩΝ ΑΠΟΔΟΧΩΝ
// ========================================================================

/**
 * Αποθηκεύει τα δωτά ποσά (στοιχεία που έχουν posoBasei > 0 και poso == 0)
 * πριν τον καθαρισμό των πεδίων.
 */
function saveExtraApodoxes() {
    const saved = [];
    const limit = window._ARITHMOS_STOIXEION_SYMBASEON || 15;

    for (let i = 1; i <= limit; i++) {
        const idNum = i.toString().padStart(2, '0');
        const posoField = document.getElementById(`poso_symbashs_${idNum}`);
        const posoBaseiField = document.getElementById(
            `poso_symbashs_basei_oron_ergasias_${idNum}`
        );

        if (!posoField || !posoBaseiField) continue;

        const posoVal = toDecimal(posoField.value);
        const posoBaseiVal = toDecimal(posoBaseiField.value);

        // Δωτό = έχει τιμή βάσει ωρών αλλά ΔΕΝ έχει τιμή βάσει σύμβασης
        if (!posoBaseiVal.isZero() && posoVal.isZero()) {
            saved.push({
                idNum,
                posoBasei: posoBaseiField.value
            });
        }
    }

    if (saved.length > 0) {
        console.log(
            `💾 Αποθηκεύτηκαν ${saved.length} δωτά ποσά:`,
            saved.map((v) => `Row ${v.idNum}: ${v.posoBasei}`).join(', ')
        );
    }

    return saved;
}

/**
 * Επαναφέρει τα δωτά ποσά μετά τον επανυπολογισμό.
 */
function restoreExtraApodoxes(savedValues) {
    if (!savedValues || savedValues.length === 0) return;

    for (const saved of savedValues) {
        const posoBaseiField = document.getElementById(
            `poso_symbashs_basei_oron_ergasias_${saved.idNum}`
        );
        if (posoBaseiField) {
            posoBaseiField.value = saved.posoBasei;
        }
    }

    console.log(`♻️ Επαναφέρθηκαν ${savedValues.length} δωτά ποσά`);
}

// ========================================================================
// UPDATE FUNCTIONS
// ========================================================================

async function updatePosoAndTotal(
    rowIndex,
    contract,
    category,
    specialty,
    selectedElement,
    klimakio,
    hmeromhnia
) {
    try {
        const data = await fetchApodoxesData(
            contract,
            category,
            specialty,
            selectedElement,
            klimakio,
            hmeromhnia
        );

        if (!data.success) {
            console.warn(`⚠️ No data for row ${rowIndex}, element ${selectedElement}`);
            return;
        }

        const idNum = rowIndex.toString().padStart(2, '0');
        const posoField = document.getElementById(`poso_symbashs_${idNum}`);

        if (posoField) {
            posoField.value = formatDecimal(data.poso, 2);
        }

        if (data.genikesParametroi) {
            updateGeneralParameters(data.genikesParametroi);
        }

        const posoBasedOnHoursFieldId = `poso_symbashs_basei_oron_ergasias_${idNum}`;
        const extraApodoxes = false;

        updatePosoBasedOnHours(rowIndex, data, posoBasedOnHoursFieldId, extraApodoxes);
    } catch (error) {
        console.error(`❌ Error updating row ${rowIndex}:`, error);
    }
}

// ========================================================================
// UTILITY FUNCTIONS
// ========================================================================

function clearInputsApodoxon() {
    const inputs = document.querySelectorAll('.clearAble');
    inputs.forEach((input) => {
        input.value = '';
    });
}

// ========================================================================
// GLOBAL EXPORT
// ========================================================================

window.reCalculate = reCalculate;
