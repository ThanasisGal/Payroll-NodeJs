import { initTomDropdown } from '../../dropdown-item.js';

document.addEventListener('DOMContentLoaded', () => {
    // βρίσκουμε ΟΛΑ τα select που ζητάνε Δ.Ο.Υ. (data-api τελειώνει σε /doy ή /logistes)
    document.querySelectorAll('select[data-api$="doy"], select[data-api$="logistes"]')
    .forEach(selectEl => {
        const selectId   = selectEl.id;
        const tomKey     = `#${selectId}`;

        // καθάρισμα παλιάς TomSelect, αν υπάρχει
        const existing = window.__tomInstances?.[tomKey];
        if (existing) {
            existing.destroy();
            delete window.__tomInstances[tomKey];
        }

        const api            = selectEl.dataset.api;
        const preselectId    = selectEl.dataset.preselect;
        const preselectValue = document.getElementById(preselectId)?.value?.trim();

        // init TomSelect
        initTomDropdown({
            selector    : tomKey,
            url         : api,
            extraParams : {},
            minChars    : 0
        });

        // pre-select
        if (preselectValue) {
            fetch(`${api}?value=${encodeURIComponent(preselectValue)}`)
                .then(res => res.json())
                .then(({ items }) => {
                    if (items?.length) {
                        const [item] = items;
                        const tom = window.__tomInstances?.[tomKey];
                        if (tom) {
                            tom.addOption(item);
                            tom.setValue(item.value);
                            // tom.setValue(item.value, true);   // silent = true
                        }
                    }
                })
            .catch(console.error);
        }
    });
});