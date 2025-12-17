/**
 * Auto-format arithmos_teknon and sync to calcChildren
 */
(function() {
    const inputField = document.getElementById('arithmos_teknon');
    const hiddenField = document.getElementById('calcChildren');
    const calcXrhsh = document.getElementById('calcXrhsh');
    
    if (! inputField || !hiddenField) {
        console.warn('arithmos_teknon or calcChildren field not found');
        return;
    }
    
    inputField.addEventListener('blur', function() {
        // Get and validate value
        let value = parseInt(this.value);
        
        if (isNaN(value) || value < 0) {
            value = 0;
        } else if (value > 9) {
            value = 9;
        }
        
        // Update input field
        this.value = value;

        let formattedValue = ""

            if (calcXrhsh.value <= "2025") {
                value = 0;
                formattedValue = value.toString().padStart(2, '0');
            } else {
                // Format with leading zero (00-09)
                formattedValue = value.toString().padStart(2, '0');
            }
        // Update hidden field
        hiddenField.value = formattedValue;
    });
    
    // Initialize on page load
    inputField.dispatchEvent(new Event('blur'));
})();