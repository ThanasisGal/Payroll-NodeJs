import { initTomDropdown } from '../../dropdown-item.js';

document.addEventListener('DOMContentLoaded', () => {
        const selectId = `doy_logisth`;
        const selectEl = document.getElementById(selectId);

        const tomKey = `#${selectId}`;

        // 🧹 FORCE CLEANUP μόνο για αυτό το dropdown (χωρίς να πειράζονται άλλα)
        const existing = window.__tomInstances?.[tomKey];
        if (existing) {
            existing.destroy(); // καθάρισε TomSelect
            delete window.__tomInstances[tomKey];
        }

        const api = selectEl.dataset.api;
        const preselectId = selectEl.dataset.preselect;
        const preselectValue = document.getElementById(preselectId)?.value?.trim();

        // ✅ Επανεκκίνηση dropdown
        initTomDropdown({
            selector    : tomKey,
            url         : api,
            extraParams : {},
            minChars    : 0
        });

        // ✅ Αν έχει τιμή -> κάνε preselect
        if (preselectValue) {
            fetch(`${api}?value=${encodeURIComponent(preselectValue)}`)
                .then(res => res.json())
                .then(({ items }) => {
                    if (items?.length) {
                        const item = items[0];
                        const tom = window.__tomInstances?.[tomKey];
                        if (tom) {
                            tom.addOption(item);
                            tom.setValue(item.value, true);
                        }
                    }
                })
                .catch(console.error);
        }
});