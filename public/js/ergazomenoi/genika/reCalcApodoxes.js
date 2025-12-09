// // reCalcApodoxes.js
// // Επανυπολογισμός Αποδοχών με Decimal.js precision

// // ========================================================================
// // ΠΕΡΙΜΕΝΕ ΤΟ DECIMAL.JS ΝΑ ΦΟΡΤΩΘΕΙ
// // ========================================================================

// (function() {
//     'use strict';

//     // Περίμενε μέχρι να φορτωθεί το Decimal
//     function waitForDecimal(callback) {
//         if (typeof Decimal !== 'undefined') {
//             callback();
//         } else {
//             console.warn('⏳ Waiting for Decimal.js to load...');
//             setTimeout(() => waitForDecimal(callback), 50);
//         }
//     }

//     waitForDecimal(function() {
//         console.log('✅ Decimal.js loaded, initializing reCalcApodoxes...');
//         initReCalc();
//     });

//     function initReCalc() {
//         // ========================================================================
//         // DECIMAL.JS CONFIGURATION
//         // ========================================================================
        
//         Decimal.set({ 
//             precision: 28,
//             rounding: Decimal.ROUND_HALF_UP,
//             toExpNeg: -7,
//             toExpPos: 15
//         });

//         // ========================================================================
//         // HELPER FUNCTIONS
//         // ========================================================================

//         function toDecimal(value) {
//             if (value instanceof Decimal) return value;
//             if (value === null || value === undefined || value === '') return new Decimal(0);
//             try {
//                 return new Decimal(value);
//             } catch (e) {
//                 console.warn('Invalid decimal value:', value);
//                 return new Decimal(0);
//             }
//         }

//         function formatDecimal(value, decimals = 2) {
//             return toDecimal(value).toFixed(decimals);
//         }

//         function showAlert({ 
//             title, 
//             html, 
//             icon = 'info', 
//             confirmButtonText = 'Κλείσιμο',
//             allowOutsideClick = false 
//         } = {}) {
//             return Swal.fire({
//                 backdrop: false,
//                 allowOutsideClick,
//                 icon,
//                 title,
//                 html,
//                 showConfirmButton: true,
//                 confirmButtonText,
//                 customClass: {
//                     confirmButton: `class-${icon} custom-confirm-button custom-swal-button`,
//                     title: 'custom-title',
//                     popup: 'custom-swal-popup',
//                 },
//             });
//         }

//         // ========================================================================
//         // INITIALIZATION
//         // ========================================================================

//         document.addEventListener("DOMContentLoaded", function () {
//             const recalcButton = document.getElementById('reCalcButton');
//             if (recalcButton) {
//                 recalcButton.addEventListener('click', reCalculate);
//             }
//         });

//         // ========================================================================
//         // MAIN RECALCULATION FUNCTION
//         // ========================================================================

//         async function reCalculate() {
//             try {
//                 clearInputsApodoxon();

//                 const genikesParametroi = await fetchGenikesParametroi();
//                 if (!genikesParametroi || !Array.isArray(genikesParametroi)) {
//                     throw new Error('Αποτυχία φόρτωσης Γενικών Παραμέτρων');
//                 }

//                 updateGeneralParameters(genikesParametroi);

//                 const contract = document.getElementById("symbash_stathera")?.value?.trim().padStart(4, '0');
//                 const category = document.getElementById("kathgoria_symbashs_stathera")?.value?.trim().padStart(4, '0');
//                 const specialty = document.getElementById("eidikothta_symbashs_stathera")?.value?.trim().padStart(4, '0');
//                 const klimakio = document.getElementById("misthologiko_klimakio")?.value?.trim().padStart(2, '0') || '01';
//                 const hmeromhnia = document.getElementById("hmeromhnia_allaghs_symbashs")?.value || '';

//                 if (!contract || !category || !specialty) {
//                     showAlert({
//                         icon: 'warning',
//                         title: 'Προσοχή',
//                         html: 'Παρακαλώ επιλέξτε <strong>Σύμβαση</strong>, <strong>Κατηγορία</strong> και <strong>Ειδικότητα</strong> πριν τον επανυπολογισμό.'
//                     });
//                     return;
//                 }

//                 const limit = window._ARITHMOS_STOIXEION_SYMBASEON || 15;
                
//                 for (let i = 1; i <= limit; i++) {
//                     const idNum = i.toString().padStart(2, '0');
//                     const selectEl = document.getElementById(`stoixeio_symbashs_${idNum}`);
                    
//                     if (!selectEl) continue;

//                     const selectedElement = selectEl.tomselect?.getValue() || selectEl.value;
                    
//                     if (selectedElement && selectedElement !== "" && selectedElement !== "0000") {
//                         await updatePosoAndTotal(
//                             i, 
//                             contract, 
//                             category, 
//                             specialty, 
//                             selectedElement.padStart(4, '0'), 
//                             klimakio, 
//                             hmeromhnia,
//                             genikesParametroi
//                         );
//                     }
//                 }

//                 if (typeof window.calculateTotal === 'function') {
//                     window.calculateTotal();
//                 }

//                 showAlert({
//                     icon: 'success',
//                     title: 'Επιτυχία',
//                     html: 'Οι αποδοχές επανυπολογίστηκαν με επιτυχία!',
//                     confirmButtonText: 'OK'
//                 });

//             } catch (error) {
//                 console.error('❌ Error in reCalculate:', error);
//                 showAlert({
//                     icon: 'error',
//                     title: 'Σφάλμα',
//                     html: `Σφάλμα κατά τον επανυπολογισμό: ${error.message}`
//                 });
//             }
//         }

//         // ========================================================================
//         // UPDATE FUNCTIONS
//         // ========================================================================

//         async function updatePosoAndTotal(rowIndex, contract, category, specialty, selectedElement, klimakio, hmeromhnia, genikesParametroi) {
//             try {
//                 const data = await fetchApodoxesData(contract, category, specialty, selectedElement, klimakio, hmeromhnia);
                
//                 if (!data.success) {
//                     console.warn(`⚠️ No data for row ${rowIndex}, element ${selectedElement}`);
//                     return;
//                 }

//                 const idNum = rowIndex.toString().padStart(2, '0');
//                 const posoFieldId = `poso_symbashs_${idNum}`;
//                 const posoBasedOnHoursFieldId = `poso_symbashs_basei_oron_ergasias_${idNum}`;
                
//                 const posoField = document.getElementById(posoFieldId);
                
//                 if (posoField) {
//                     posoField.value = formatDecimal(data.poso, 2);
//                 }

//                 if (data.genikesParametroi) {
//                     updateGeneralParameters(data.genikesParametroi);
//                 } else if (genikesParametroi) {
//                     updateGeneralParameters(genikesParametroi);
//                 }

//                 const extraApodoxes = false;
//                 updatePosoBasedOnHours(rowIndex, data, posoBasedOnHoursFieldId, extraApodoxes);

//             } catch (error) {
//                 console.error(`❌ Error updating row ${rowIndex}:`, error);
//             }
//         }

//         function updatePosoBasedOnHours(rowIndex, data, posoBasedOnHoursFieldId, extraApodoxes) {
//             const typeEl = document.getElementById('typos_ergazomenon');
//             if (!typeEl || !typeEl.value) {
//                 console.warn('⚠️ Τύπος Εργαζομένου δεν έχει επιλεγεί');
//                 return;
//             }
            
//             const type = typeEl.value;
//             const posoBasedOnHoursField = document.getElementById(posoBasedOnHoursFieldId);
            
//             const oresEl = document.getElementById("ores_ergasias_ebdomadas");
//             const hmeresEl = document.getElementById("hmeres_ergasias_ebdomadas");
            
//             const hours = toDecimal(oresEl?.value);
//             const days = toDecimal(hmeresEl?.value);

//             let calculatedValue = calculateWageBasedOnWorkType(type, data, hours, days, extraApodoxes);

//             if (!calculatedValue || calculatedValue.isNaN()) {
//                 console.warn('⚠️ Invalid calculated value');
//                 if (posoBasedOnHoursField) posoBasedOnHoursField.value = "0.00";
//             } else {
//                 if (posoBasedOnHoursField) {
//                     posoBasedOnHoursField.value = formatDecimal(calculatedValue, 2);
//                 }
//             }
//         }

//         function calculateWageBasedOnWorkType(type, data, hours, days, extraApodoxes) {
//             const plhrhsApasxolhsh = document.getElementById('plhrhs_apasxolhsh');
//             const isFullTime = plhrhsApasxolhsh?.checked || false;

//             let value = new Decimal(0);

//             if (isFullTime) {
//                 switch (type) {
//                     case "Μ": value = toDecimal(data.poso); break;
//                     case "Η": value = calculateMonthlyWage(data, hours, days, true, type, extraApodoxes); break;
//                     case "Ω": value = calculateHourlyWage(data, hours, days, true, extraApodoxes); break;
//                     default: value = null;
//                 }
//             } else {
//                 switch (type) {
//                     case "Μ": value = calculateMonthlyWage(data, hours, days, false, type, extraApodoxes); break;
//                     case "Η": value = calculateMonthlyWage(data, hours, days, false, type, extraApodoxes); break;
//                     case "Ω": value = calculateHourlyWage(data, hours, days, false, extraApodoxes); break;
//                     default: value = null;
//                 }
//             }

//             return value;
//         }

//         function calculateHourlyWage(data, hours, days, fullTime, extraApodoxes) {
//             let value = new Decimal(0);
//             const eidKathEl = document.getElementById('eidikh_kathgoria_ergazomenoy');
//             if (!eidKathEl) return value;

//             const poso = toDecimal(data.poso);

//             switch (eidKathEl.value) {
//                 case "0001":
//                     if (!poso.isZero()) {
//                         if (!extraApodoxes) {
//                             const _ORES_EIDIKHS = toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS);
//                             const _SYNTELESTHS_EBD_MIST = toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON);
                            
//                             const oromisthio = new Decimal(6).div(_ORES_EIDIKHS).div(25).times(poso);
//                             value = oromisthio.times(hours).times(_SYNTELESTHS_EBD_MIST);
//                         } else {
//                             value = poso;
//                         }
//                     }
//                     break;
//                 default:
//                     value = null;
//             }
//             return value;
//         }

//         function calculateMonthlyWage(data, hours, days, fullTime, type, extraApodoxes) {
//             let value = new Decimal(0);
//             const poso = toDecimal(data.poso);
            
//             if (!poso.isZero()) {
//                 if (!extraApodoxes) {
//                     const _ORES_ERGASIAS_MHNA = toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS);
//                     const _SYNTELESTHS_METATR = toDecimal(window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO);
//                     const _SYNTELESTHS_EBD_MIST = toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON);
//                     const _SYNTELESTHS_EBD_HMER = toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION);
                    
//                     let oromisthio;
//                     if (type === "Μ") {
//                         oromisthio = poso.div(_ORES_ERGASIAS_MHNA);
//                     } else {
//                         oromisthio = poso.times(_SYNTELESTHS_METATR);
//                     }
                    
//                     const syntelesths = type === "Μ" ? _SYNTELESTHS_EBD_MIST : _SYNTELESTHS_EBD_HMER;
//                     value = oromisthio.times(hours).times(syntelesths);
//                 } else {
//                     value = poso;
//                 }
//             }  
//             return value;
//         }

//         // ========================================================================
//         // API FUNCTIONS
//         // ========================================================================

//         async function fetchGenikesParametroi() {
//             try {
//                 const response = await fetch('/api/genikesParametroi', {
//                     method: 'GET',
//                     headers: { 'Content-Type': 'application/json' },
//                     credentials: 'include'
//                 });

//                 if (!response.ok) {
//                     throw new Error(`API Error: ${response.status} ${response.statusText}`);
//                 }

//                 const result = await response.json();
                
//                 if (!result.success) {
//                     throw new Error('Failed to fetch genikes parametroi');
//                 }

//                 return result.data;

//             } catch (error) {
//                 console.error('❌ Error fetching genikes parametroi:', error);
//                 throw error;
//             }
//         }

//         async function fetchApodoxesData(contract, category, specialty, selectedElement, klimakio, date) {
//             try {
//                 const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
                
//                 if (!csrfToken) {
//                     console.error('❌ CSRF token not found!');
//                     throw new Error('CSRF token missing. Please refresh the page.');
//                 }

//                 const response = await fetch('/api/apodoxesErgazomenon', {
//                     method: 'POST',
//                     headers: {
//                         'Content-Type': 'application/json',
//                         'CSRF-Token': csrfToken,
//                         'X-CSRF-Token': csrfToken
//                     },
//                     credentials: 'include',
//                     body: JSON.stringify({
//                         contract,
//                         category,
//                         specialty,
//                         selectedElement,
//                         klimakio,
//                         date,
//                         _csrf: csrfToken
//                     })
//                 });

//                 if (!response.ok) {
//                     if (response.status === 403) {
//                         throw new Error('CSRF validation failed. Please refresh the page and try again.');
//                     }
//                     throw new Error(`API Error: ${response.status} ${response.statusText}`);
//                 }

//                 const data = await response.json();
//                 return data;

//             } catch (error) {
//                 console.error('❌ Fetch Error:', error);
//                 throw error;
//             }
//         }

//         function updateGeneralParameters(parameters) {
//             if (!parameters || !Array.isArray(parameters)) return;
            
//             window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = toDecimal(parameters[0]?.timh);
//             window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = toDecimal(parameters[1]?.timh);
//             window._SYNTELESTHS_EBDOMADON_MISTHOTON = toDecimal(parameters[2]?.timh);
//             window._SYNTELESTHS_EBDOMADON_HMEROMISTHION = toDecimal(parameters[3]?.timh);
//             window._ORES_HMERHSIAS_ERGASIAS = toDecimal(parameters[4]?.timh);
//             window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = toDecimal(parameters[5]?.timh);
//             window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = toDecimal(parameters[6]?.timh);
//             window._ARITHMOS_STOIXEION_SYMBASEON = toDecimal(parameters[22]?.timh);
//         }

//         // ========================================================================
//         // UTILITY FUNCTIONS
//         // ========================================================================

//         function clearInputsApodoxon() {
//             const inputs = document.querySelectorAll('.clearAble');
//             inputs.forEach(input => {
//                 input.value = '';
//             });
//         }

//     } // end initReCalc

// })();





// reCalcApodoxes.js
// Επανυπολογισμός Αποδοχών - ES6 Module

// import { 
//     toDecimal, 
//     formatDecimal, 
//     showAlert,
//     fetchGenikesParametroi,
//     fetchApodoxesData,
//     updateGeneralParameters,
//     updatePosoBasedOnHours
// } from '/static/js/modules/apodoxesCalculations.js';
// reCalcApodoxes.js
// Clean import με alias

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