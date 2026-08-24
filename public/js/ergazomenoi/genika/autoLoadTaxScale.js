/**
 * Auto-load tax scale from ForologikesKlimakesModel
 * 
 * LOOKUP: server session year AND kodikos = calcAge + calcChildren
 * UPDATE: createTaxScale = calcAge + calcChildren
 * UPDATE: forologikh_klimaka = kodikos + perigrafh
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
    async function fetchTaxScale(rawValue = '') {
    const csrfToken = getCsrfToken();
    
    if (!csrfToken) {
        console.error('❌ No CSRF token found!');
        return;
    }
    

        try {
            const calcAge = calcAgeField.value.trim();
            const calcChildren = calcChildrenField.value.trim();
            const kodikos = rawValue || calcAge + calcChildren;

            if (!kodikos || (!rawValue && (!calcAge || !calcChildren))) {
                return;
            }

            // API call
            const response = await fetch('/api/forologikes-klimakes/lookup', {
                method:  'POST',
                headers:  {
                    'Content-Type':  'application/json',
                    'csrf-token': csrfToken  // ✅ ΑΛΛΑΓΗ:    lowercase & direct variable
                },
                body: JSON.stringify({ kodikos }),
                credentials: 'same-origin'
            });            
            
            if (!response.ok) {
                throw new Error('API error');
            }
            
            const data = await response.json();
            
            if (data.success && data.taxScale) {
                createTaxScaleField.value = data.kodikos;
                forologikhKlimakaField.value = data.kodikos + " - " + data.taxScale.perigrafh;
            } else {
                createTaxScaleField.value = data.kodikos || '';
                forologikhKlimakaField.value = data.kodikos || rawValue;
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

    const initialValue = forologikhKlimakaField.value.trim();
    if (initialValue) {
        fetchTaxScale(initialValue);
    }
    
})();
