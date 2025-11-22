// fillLabelFromInput.js

// Ορίζουμε τις μεταβλητές για τα inputs και τις labels
document.addEventListener('DOMContentLoaded', function() {
    // Συγχρονισμός με classes και max lengths
    const syncMap = {
        'eponymo': { selector: '.sync-eponymo', maxLength: 25 },
        'onoma': { selector: '.sync-onoma', maxLength: 15 },
        'afm_ergazomenoy': { selector: '.sync-afm', maxLength: null },
        'amka_ergazomenoy': { selector: '.sync-amka', maxLength: null }
    };

    // Συνάρτηση για truncate με "..."
    function truncateText(text, maxLength) {
        if (!maxLength || text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    }

    Object.keys(syncMap).forEach(inputId => {
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;

        const config = syncMap[inputId];

        inputEl.addEventListener('input', function() {
            const displayText = truncateText(this.value, config.maxLength);
            document.querySelectorAll(config.selector).forEach(label => {
                label.textContent = displayText;
                // Προσθέτουμε title για να φαίνεται ολόκληρο το κείμενο στο hover
                if (config.maxLength && this.value.length > config.maxLength) {
                    label.setAttribute('title', this.value);
                } else {
                    label.removeAttribute('title');
                }
            });
        });

        // Αρχική τιμή
        const initialText = truncateText(inputEl.value, config.maxLength);
        document.querySelectorAll(config.selector).forEach(label => {
            label.textContent = initialText;
            if (config.maxLength && inputEl.value.length > config.maxLength) {
                label.setAttribute('title', inputEl.value);
            }
        });
    });
});