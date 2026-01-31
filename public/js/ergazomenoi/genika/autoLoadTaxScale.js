/**
 * Auto-load tax scale from ForologikesKlimakesModel
 * 
 * LOOKUP:   xrhsh = calcXrhsh AND kodikos = calcAge + calcChildren
 * UPDATE:  createTaxScale = xrhsh + calcAge + calcChildren
 * UPDATE:  forologikh_klimaka = perigrafh
 */
(function() {
    'use strict';
    
    // Get CSRF token
    function getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    }
    
    // Get fields
    const birthDateField = document.querySelector('[name="hmeromhnia_gennhshs"]');
    const childrenField = document.getElementById('arithmos_teknon');
    const calcAgeField = document.getElementById('calcAge');
    const calcChildrenField = document.getElementById('calcChildren');
    const calcXrhshField = document.getElementById('calcXrhsh');
    const createTaxScaleField = document.getElementById('createTaxScale');
    const forologikhKlimakaField = document.getElementById('forologikh_klimaka');
    
    if (!birthDateField || !childrenField || !calcXrhshField || 
        !calcAgeField || !calcChildrenField || 
        !createTaxScaleField || !forologikhKlimakaField) {
        return;
    }
    
    /**
     * Fetch tax scale from database
     */
    async function fetchTaxScale() {
    const csrfToken = getCsrfToken();
    
    if (!csrfToken) {
        console.error('❌ No CSRF token found!');
        return;
    }
    

        try {
            const xrhsh = calcXrhshField.value.trim();
            const calcAge = calcAgeField.value.trim();
            const calcChildren = calcChildrenField.value. trim();
            const kodikos = calcAge + calcChildren;
            
            if (!xrhsh || !calcAge || !calcChildren) {
                return;
            }
            
            // API call
            const response = await fetch('/api/forologikes-klimakes/lookup', {
                method:  'POST',
                headers:  {
                    'Content-Type':  'application/json',
                    'csrf-token': csrfToken  // ✅ ΑΛΛΑΓΗ:    lowercase & direct variable
                },
                body: JSON.stringify({ xrhsh, kodikos }),
                credentials: 'same-origin'
            });            
            
            if (!response.ok) {
                throw new Error('API error');
            }
            
            const data = await response.json();
            
            if (data.success && data.taxScale) {
                createTaxScaleField.value = xrhsh + calcAge + calcChildren;
                forologikhKlimakaField.value = createTaxScaleField.value + " - " + data.taxScale.perigrafh;
            } else {
                createTaxScaleField.value = '';
                forologikhKlimakaField.value = 'Δεν βρέθηκε';
            }
            
        } catch (error) {
            console.error('[TaxScale] Error:', error);
            forologikhKlimakaField.value = 'Σφάλμα αναζήτησης';
        }
    }
    
    // Debounce
    let timeout;
    function debouncedFetch() {
        clearTimeout(timeout);
        timeout = setTimeout(fetchTaxScale, 500);
    }
    
    // Events
    birthDateField.addEventListener('blur', debouncedFetch);
    childrenField.addEventListener('blur', debouncedFetch);
    
})();