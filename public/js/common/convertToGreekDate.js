// Custom date input handler
class CustomDateInput {
    constructor(container) {
        this.container = container;
        this.dayInput = container.querySelector('.date-day');
        this.monthInput = container.querySelector('.date-month');
        this.yearInput = container.querySelector('.date-year');
        this.hiddenInput = container.querySelector('.date-hidden') || 
                          container.nextElementSibling;
        
        this.init();
    }
    
    init() {
        // Auto-tab to next field
        this.dayInput.addEventListener('input', (e) => {
            this.handleInput(e, this.dayInput, this.monthInput, 31);
        });
        
        this.monthInput.addEventListener('input', (e) => {
            this.handleInput(e, this.monthInput, this.yearInput, 12);
        });
        
        this.yearInput.addEventListener('input', (e) => {
            this.handleInput(e, this.yearInput, null, 9999);
        });
        
        // Backspace navigation
        [this.dayInput, this.monthInput, this.yearInput].forEach(input => {
            input. addEventListener('keydown', (e) => {
                if (e. key === 'Backspace' && input.value === '' && input.previousElementSibling) {
                    const prevInput = this.getPreviousInput(input);
                    if (prevInput) {
                        prevInput.focus();
                        prevInput.setSelectionRange(prevInput.value.length, prevInput.value.length);
                    }
                }
            });
            
            // Update hidden field on change
            input.addEventListener('change', () => this.updateHiddenField());
            input.addEventListener('blur', () => this.padValue(input));
        });
    }
    
    handleInput(e, currentInput, nextInput, maxValue) {
        // Only allow numbers
        currentInput.value = currentInput.value.replace(/[^0-9]/g, '');
        
        const value = parseInt(currentInput.value);
        
        // Validate range
        if (value > maxValue) {
            currentInput.value = maxValue. toString();
        }
        
        // Auto-advance to next field
        if (currentInput. value. length === currentInput.maxLength && nextInput) {
            nextInput. focus();
            nextInput.select();
        }
        
        this.updateHiddenField();
    }
    
    padValue(input) {
        if (input.value && input.value.length < input. maxLength) {
            input. value = input.value.padStart(input.maxLength, '0');
        }
    }
    
    getPreviousInput(currentInput) {
        if (currentInput === this.monthInput) return this.dayInput;
        if (currentInput === this.yearInput) return this.monthInput;
        return null;
    }
    
    updateHiddenField() {
        const day = this.dayInput.value. padStart(2, '0');
        const month = this.monthInput.value.padStart(2, '0');
        const year = this.yearInput.value;
        
        if (day && month && year && year.length === 4) {
            // Format:  YYYY-MM-DD (for form submission)
            const isoDate = `${year}-${month}-${day}`;
            
            // Validate date
            const date = new Date(isoDate);
            if (date && date.getMonth() + 1 === parseInt(month)) {
                this.hiddenInput.value = isoDate;
                this.container.classList.remove('error');
                return;
            }
        }
        
        this.hiddenInput.value = '';
    }
    
    getValue() {
        return this.hiddenInput.value;
    }
    
    setValue(isoDate) {
        // Format: YYYY-MM-DD
        const [year, month, day] = isoDate.split('-');
        this.yearInput.value = year;
        this.monthInput.value = month;
        this.dayInput. value = day;
        this. updateHiddenField();
    }
    
    clear() {
        this.dayInput.value = '';
        this. monthInput.value = '';
        this.yearInput.value = '';
        this.hiddenInput. value = '';
    }
}

// Initialize
const dateInput = new CustomDateInput(document.getElementById('dateInput'));

// Test function
function getDateValue() {
    const value = dateInput.getValue();
    document.getElementById('output').innerHTML = 
        `<strong>Value:</strong> ${value || '(empty)'}<br>` +
        `<strong>Format:</strong> YYYY-MM-DD (ISO 8601)`;
}

// Example:  Set value programmatically
// dateInput.setValue('2026-01-21');