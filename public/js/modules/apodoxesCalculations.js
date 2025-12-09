// apodoxesCalculations.js
// Shared utilities για υπολογισμούς αποδοχών με Decimal.js
// Last Updated: 24/11/2025

const Decimal = window.Decimal;

// ========================================================================
// DECIMAL.JS HELPER FUNCTIONS
// ========================================================================

export function toDecimal(value) {
    if (value instanceof Decimal) return value;
    if (value === null || value === undefined || value === '') return new Decimal(0);
    try {
        return new Decimal(value);
    } catch (e) {
        console.warn('Invalid decimal value:', value);
        return new Decimal(0);
    }
}

export function formatDecimal(value, decimals = 2) {
    return toDecimal(value).toFixed(decimals);
}

export function showAlert({ 
    title, 
    html, 
    icon = 'info', 
    confirmButtonText = 'Κλείσιμο',
    allowOutsideClick = false 
} = {}) {
    return Swal.fire({
        backdrop: false,
        allowOutsideClick,
        icon,
        title,
        html,
        showConfirmButton: true,
        confirmButtonText,
        customClass: {
            confirmButton: `class-${icon} custom-confirm-button custom-swal-button`,
            title: 'custom-title',
            popup: 'custom-swal-popup',
        },
    });
}

// ========================================================================
// API FUNCTIONS
// ========================================================================

export async function fetchGenikesParametroi() {
    try {
        const response = await fetch('/api/genikesParametroi', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error('Failed to fetch genikes parametroi');
        }

        return result.data;

    } catch (error) {
        console.error('❌ Error fetching genikes parametroi:', error);
        throw error;
    }
}

export async function fetchApodoxesData(contract, category, specialty, selectedElement, klimakio, date) {
    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
        
        if (!csrfToken) {
            console.error('❌ CSRF token not found!');
            throw new Error('CSRF token missing. Please refresh the page.');
        }

        const response = await fetch('/api/apodoxesErgazomenon', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken,
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({
                contract,
                category,
                specialty,
                selectedElement,
                klimakio,
                date,
                _csrf: csrfToken
            })
        });

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('CSRF validation failed. Please refresh the page and try again.');
            }
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('❌ Fetch Error:', error);
        throw error;
    }
}

// ========================================================================
// GENERAL PARAMETERS
// ========================================================================

export function updateGeneralParameters(parameters) {
    if (!parameters || !Array.isArray(parameters)) return;
    
    window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS = toDecimal(parameters[0]?.timh);
    window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO = toDecimal(parameters[1]?.timh);
    window._SYNTELESTHS_EBDOMADON_MISTHOTON = toDecimal(parameters[2]?.timh);
    window._SYNTELESTHS_EBDOMADON_HMEROMISTHION = toDecimal(parameters[3]?.timh);
    window._ORES_HMERHSIAS_ERGASIAS = toDecimal(parameters[4]?.timh);
    window._HMERES_MHNIAIAS_PLHROYS_APASXOLHSHS = toDecimal(parameters[5]?.timh);
    window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS = toDecimal(parameters[6]?.timh);
    window._ARITHMOS_STOIXEION_SYMBASEON = toDecimal(parameters[22]?.timh);
}

// ========================================================================
// WAGE CALCULATIONS
// ========================================================================

export function calculateHourlyWage(data, hours, days, fullTime, extraApodoxes) {
    let value = new Decimal(0);
    const eidKathEl = document.getElementById('eidikh_kathgoria_ergazomenoy');
    if (!eidKathEl) return value;

    const poso = toDecimal(data.poso);

    switch (eidKathEl.value) {
        case "0001": // ΚΑΘΗΓΗΤΕΣ ΦΡΟΝΤΙΣΤΗΡΙΩΝ
            if (!poso.isZero()) {
                if (!extraApodoxes) {
                    const _ORES_EIDIKHS = toDecimal(window._ORES_EIDIKHS_KATHGORIAS_PLHROYS_APASXOLHSHS);
                    const _SYNTELESTHS_EBD_MIST = toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON);
                    
                    const oromisthio = new Decimal(6).div(_ORES_EIDIKHS).div(25).times(poso);
                    value = oromisthio.times(hours).times(_SYNTELESTHS_EBD_MIST);
                } else {
                    value = poso;
                }
            }
            break;
        default:
            value = null;
    }
    return value;
}

export function calculateMonthlyWage(data, hours, days, fullTime, type, extraApodoxes) {
    let value = new Decimal(0);
    const poso = toDecimal(data.poso);
    
    if (!poso.isZero()) {
        if (!extraApodoxes) {
            const _ORES_ERGASIAS_MHNA = toDecimal(window._ORES_ERGASIAS_MHNA_PLHROYS_APASXOLHSHS);
            const _SYNTELESTHS_METATR = toDecimal(window._SYNTELESTHS_METATROPHS_OROMISTHIOY_SE_HMEROMISTHIO);
            const _SYNTELESTHS_EBD_MIST = toDecimal(window._SYNTELESTHS_EBDOMADON_MISTHOTON);
            const _SYNTELESTHS_EBD_HMER = toDecimal(window._SYNTELESTHS_EBDOMADON_HMEROMISTHION);
            
            let oromisthio;
            if (type === "Μ") {
                oromisthio = poso.div(_ORES_ERGASIAS_MHNA);
            } else {
                oromisthio = poso.times(_SYNTELESTHS_METATR);
            }
            
            const syntelesths = type === "Μ" ? _SYNTELESTHS_EBD_MIST : _SYNTELESTHS_EBD_HMER;
            value = oromisthio.times(hours).times(syntelesths);
        } else {
            value = poso;
        }
    }  
    return value;
}

export function calculateWageBasedOnWorkType(type, data, hours, days, extraApodoxes) {
    const plhrhsApasxolhsh = document.getElementById('plhrhs_apasxolhsh');
    const isFullTime = plhrhsApasxolhsh?.checked || false;

    let value = new Decimal(0);

    if (isFullTime) {
        switch (type) {
            case "Μ": value = toDecimal(data.poso); break;
            case "Η": value = calculateMonthlyWage(data, hours, days, true, type, extraApodoxes); break;
            case "Ω": value = calculateHourlyWage(data, hours, days, true, extraApodoxes); break;
            default: value = null;
        }
    } else {
        switch (type) {
            case "Μ": value = calculateMonthlyWage(data, hours, days, false, type, extraApodoxes); break;
            case "Η": value = calculateMonthlyWage(data, hours, days, false, type, extraApodoxes); break;
            case "Ω": value = calculateHourlyWage(data, hours, days, false, extraApodoxes); break;
            default: value = null;
        }
    }

    return value;
}

export function updatePosoBasedOnHours(rowIndex, data, posoBasedOnHoursFieldId, extraApodoxes) {
    const typeEl = document.getElementById('typos_ergazomenon');
    if (!typeEl || !typeEl.value) {
        console.warn('⚠️ Τύπος Εργαζομένου δεν έχει επιλεγεί');
        return;
    }
    
    const type = typeEl.value;
    const posoBasedOnHoursField = document.getElementById(posoBasedOnHoursFieldId);
    
    const oresEl = document.getElementById("ores_ergasias_ebdomadas");
    const hmeresEl = document.getElementById("hmeres_ergasias_ebdomadas");
    
    const hours = toDecimal(oresEl?.value);
    const days = toDecimal(hmeresEl?.value);

    let calculatedValue = calculateWageBasedOnWorkType(type, data, hours, days, extraApodoxes);

    if (!calculatedValue || calculatedValue.isNaN()) {
        showAlert({
            icon: 'info',
            title: 'Λείπει ο Τύπος Εργαζομένου',
            html: 'Δεν είναι εφικτός ο υπολογισμός των αποδοχών βάσει των ωρών εργασίας γιατί δεν έχετε επιλέξει <strong>ΤΥΠΟ ΕΡΓΑΖΟΜΕΝΟΥ</strong> στην καρτέλλα <strong>Σταθερά Στοιχεία</strong>.'
        });
        if (posoBasedOnHoursField) posoBasedOnHoursField.value = "0.00";
    } else {
        if (posoBasedOnHoursField) {
            posoBasedOnHoursField.value = formatDecimal(calculatedValue, 2);
        }
    }
}