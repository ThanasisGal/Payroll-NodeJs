const Decimal = window.Decimal;

import { 
    toDecimal, 
    formatDecimal, 
    showAlert,
    fetchGenikesParametroi,
    fetchApodoxesData,
    updateGeneralParameters,
    updatePosoBasedOnHours
} from 'apodoxes-calculations';  // ✅ Alias από importmap

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

waitForDecimal(function() {
    // console.log('✅ Decimal.js loaded, initializing reCalcApodoxes...');
    
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
    document.addEventListener("DOMContentLoaded", function () {
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
        clearInputsApodoxon();

        const genikesParametroi = await fetchGenikesParametroi();
        if (!genikesParametroi || !Array.isArray(genikesParametroi)) {
            throw new Error('Αποτυχία φόρτωσης Γενικών Παραμέτρων');
        }

        updateGeneralParameters(genikesParametroi);

        const contract = document.getElementById("symbash_stathera")?.value?.trim().padStart(4, '0');
        const category = document.getElementById("kathgoria_symbashs_stathera")?.value?.trim().padStart(4, '0');
        const specialty = document.getElementById("eidikothta_symbashs_stathera")?.value?.trim().padStart(4, '0');
        const klimakio = document.getElementById("misthologiko_klimakio")?.value?.trim().padStart(2, '0') || '01';
        const hmeromhnia = document.getElementById("hmeromhnia_allaghs_symbashs")?.value || '';

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
            
            if (selectedElement && selectedElement !== "" && selectedElement !== "0000") {
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

        if (typeof window.calculateTotal === 'function') {
            window.calculateTotal();
        }

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
// UPDATE FUNCTIONS
// ========================================================================

async function updatePosoAndTotal(rowIndex, contract, category, specialty, selectedElement, klimakio, hmeromhnia) {
    try {
        const data = await fetchApodoxesData(contract, category, specialty, selectedElement, klimakio, hmeromhnia);
        
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
    inputs.forEach(input => {
        input.value = '';
    });
}

// ========================================================================
// GLOBAL EXPORT
// ========================================================================

window.reCalculate = reCalculate;