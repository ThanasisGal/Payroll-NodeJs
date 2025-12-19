/**
 * Auto-calculate end date - DEBUG VERSION
 */
(function() {
    'use strict';
    
    const startDateInput = document.querySelector('[name="hmeromhnia_allaghs_orarioy_apo"]');
    const endDateInput = document.querySelector('[name="hmeromhnia_allaghs_orarioy_eos"]');
    
    if (!startDateInput || !endDateInput) {
        console.error('[AutoEndDate] ❌ Fields not found!');
        return;
    }
    
    /**
     * Parse date
     */
    function parseDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') {
            return null;
        }
        
        dateStr = dateStr.trim();
        let year, month, day;
        
        // ISO:  yyyy-mm-dd
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = dateStr.split('-');
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
        }
        // Greek: dd/mm/yyyy
        else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const parts = dateStr.split('/');
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
        }
        else {
            console.error('[AutoEndDate] Unknown format:', dateStr);
            return null;
        }
        
        return new Date(year, month, day);
    }
    
    /**
     * Format date
     */
    // function formatDate(date, inputType) {
    //     if (!(date instanceof Date) || isNaN(date.getTime())) {
    //         console. error('[AutoEndDate] Invalid date:', date);
    //         return '';
    //     }
        
    //     const day = date.getDate().toString().padStart(2, '0');
    //     const month = (date.getMonth() + 1).toString().padStart(2, '0');
    //     const year = date.getFullYear();
        
    //     let result;
        
    //     if (inputType === 'date') {
    //         result = `${year}-${month}-${day}`;
    //     } else {
    //         result = `${day}/${month}/${year}`;
    //     }
        
    //     return result;
    // }
    function formatDate(date, inputType) {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            console.error('[AutoEndDate] Invalid date object');
            return '';
        }
        
        if (inputType === 'date') {
            // For type="date", use ISO format (guaranteed correct)
            return date.toISOString().split('T')[0]; // "2025-12-21"
        } else {
            // For type="text", use Greek format
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear());
            return `${day}/${month}/${year}`;
        }
    }    
    /**
     * Get last day of year
     */
    function getLastDayOfYear(date) {
        return new Date(date.getFullYear(), 11, 31);
    }
    
    /**
     * Calculate end date
     */
    function calculateEndDate() {
        try {
            // Get start date
            const startDateStr = startDateInput.value. trim();
            
            if (!startDateStr) {
                return;
            }
            
            // Parse
            const startDate = parseDate(startDateStr);
            
            if (!startDate || isNaN(startDate.getTime())) {
                console. error('[AutoEndDate] Failed to parse start date');
                return;
            }
            
            // Add 6 days
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);
            
            // Cap at year end
            const yearEnd = getLastDayOfYear(startDate);
            
            const finalEndDate = endDate > yearEnd ? yearEnd : endDate;
            
            // Get input type
            const endFieldType = endDateInput.type || endDateInput.getAttribute('type') || 'text';
            
            // Format
            const endDateStr = formatDate(finalEndDate, endFieldType);
            
            // Set value
            endDateInput.value = endDateStr;
            
            // Calculate days
            const days = Math.floor((finalEndDate - startDate) / (1000 * 60 * 60 * 24));
            
        } catch (error) {
            console.error('[AutoEndDate] ❌ Error:', error);
            console.error('[AutoEndDate] Stack:', error.stack);
        }
    }
    
    // Event listeners
    // startDateInput.addEventListener('blur', function() {
    //     calculateEndDate();
    // });
    
    startDateInput.addEventListener('change', function() {
        calculateEndDate();
    });
    
})();