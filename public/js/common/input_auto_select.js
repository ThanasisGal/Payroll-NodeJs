// /public/js/common/input-auto-select.js
/**
 * Auto-select content on focus για ΟΛΑ τα input[type="number"]
 * Υποστηρίζει ελληνική μορφή (κόμμα) + change events
 */

(function() {
    function setupAutoSelect(input) {
        if (input.dataset.autoSelectBound) return;
        if (input.classList.contains('percentTotal')) return;
        input.dataset.autoSelectBound = 'true';
        
        if (!input.dataset.originalType) {
            input.dataset.originalType = input.type;
        }
        
        input.addEventListener('focus', function(e) {
            const input = e.target;
            const originalType = input.dataset.originalType || 'number';
            
            // Αποθήκευση αρχικής τιμής για το change event
            input.dataset.valueBeforeFocus = input.value;
            
            // Γίνε text για να δουλέψει το select
            input. type = 'text';
            
            setTimeout(() => {
                try {
                    input.select();
                } catch (err) {}
            }, 10);
            
            // Validation ενώ πληκτρολογείς
            function validateInput(e) {
                const input = e.target;
                const value = input. value;
                
                // Επιτρέπει:  αριθμούς, τελεία, κόμμα, μείον
                const sanitized = value. replace(/[^0-9.,\-]/g, '');
                
                if (sanitized !== value) {
                    input. value = sanitized;
                }
            }
            
            input. addEventListener('input', validateInput);
            
            // Επαναφορά σε number στο blur
            function restoreOnBlur() {
                const currentValue = input.value;
                
                // ✅ Μετατροπή κόμματος σε τελεία για type="number"
                const normalizedValue = currentValue.replace(/,/g, '.');
                
                // Επιστροφή σε number
                input.type = originalType;
                input.value = normalizedValue;
                
                // ✅ Manual trigger του change event (αν άλλαξε η τιμή)
                if (input.dataset.valueBeforeFocus !== normalizedValue) {
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                // Cleanup
                delete input.dataset.valueBeforeFocus;
                input.removeEventListener('input', validateInput);
                input.removeEventListener('blur', restoreOnBlur);
            }
            
            input.addEventListener('blur', restoreOnBlur, { once: true });
        });
    }
    
    function applyToExisting() {
        document.querySelectorAll('input[type="number"]').forEach(setupAutoSelect);
    }
    
    if (document.readyState === 'loading') {
        document. addEventListener('DOMContentLoaded', applyToExisting);
    } else {
        applyToExisting();
    }
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) return;
                
                if (node.matches && node.matches('input[type="number"]')) {
                    setupAutoSelect(node);
                }
                
                if (node. querySelectorAll) {
                    node.querySelectorAll('input[type="number"]').forEach(setupAutoSelect);
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    window.addEventListener('load', applyToExisting);
    document.addEventListener('shown.bs. modal', applyToExisting);
    
    if (window. htmx) {
        document.body.addEventListener('htmx:afterSwap', applyToExisting);
    }
})();