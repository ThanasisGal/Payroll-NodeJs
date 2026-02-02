// public/js/ergazomenoi/genika/updateLinkFromTomDropdown.js

document.addEventListener('DOMContentLoaded', function () {
    const sel = document.getElementById('programma_dypa');
    const btn = document.getElementById('gotoProgrammaDypa');
    const hid = document.getElementById('link_programma_dypa_stathera');
    
    if (!sel || !btn) return;

    function getUrlFromHtmlOption(value) {
        if (!value) return '';
        const option = sel.querySelector(`option[value="${value}"]`);
        return option?.dataset.urlLink || '';
    }

    function updateButton() {
        const ts = sel.tomselect;
        let val = '';
        let url = '';
        
        if (ts) {
            val = ts.getValue() || sel.value || '';
            if (val && ts.options && ts.options[val]) {
                url = ts.options[val].url_link || '';
            }
        } else {
            val = sel.value || '';
        }
        
        // Fallback: HTML option
        if (!url && val) {
            url = getUrlFromHtmlOption(val);
        }
        
        if (hid) hid.value = url;
        
        if (url) {
            btn.href = url;
            btn.classList.remove('disabled');
            btn.removeAttribute('aria-disabled');
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        } else {
            btn.href = '#';
            btn.classList.add('disabled');
            btn.setAttribute('aria-disabled', 'true');
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.4';
        }
    }

    // Wait for TomSelect (max 2 seconds)
    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    
    const wait = setInterval(() => {
        attempts++;
        const ts = sel.tomselect;
        
        if (ts) {
            clearInterval(wait);
        
            // Bind TomSelect events
            ts.on('change', updateButton);
            ts.on('item_add', updateButton);
            ts.on('item_remove', updateButton);
            ts.on('clear', updateButton);
            ts.on('load', updateButton);
            
            // Bind checkbox event
            const checkbox = document.getElementById('topothethsh_me_programma');
            if (checkbox) {
                checkbox.addEventListener('change', function() {
                setTimeout(updateButton, 200);
                });
            }
            
            // ✅ Smart polling: Ελέγχει μόνο αν άλλαξε κάτι
            let lastValue = '';
            let lastUrl = '';
            
            setInterval(function() {
                const currentValue = ts.getValue() || sel.value || '';
                
                // Ενημέρωσε μόνο αν άλλαξε το value
                if (currentValue !== lastValue) {
                lastValue = currentValue;
                updateButton();
                } else {
                // Έλεγξε αν τα options φόρτωσαν (για edit mode)
                const currentUrl = (ts.options && ts.options[currentValue]) 
                    ? (ts.options[currentValue].url_link || '') 
                    : getUrlFromHtmlOption(currentValue);
                
                if (currentUrl !== lastUrl) {
                    lastUrl = currentUrl;
                    updateButton();
                }
                }
            }, 500); // ✅ Κάθε 500ms (πιο γρήγορο)
            
            // Initial update
            updateButton();
        
        } else if (attempts >= MAX_ATTEMPTS) {
            clearInterval(wait);
        }
    }, 100);
});