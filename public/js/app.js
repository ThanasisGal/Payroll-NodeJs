import { initDropdowns, updateFilter, extractExtraParams } from './dropdownManager.js';

let currentSession = {};

/**
 * 🧠 Επιστρέφει τις session τιμές (χρήση από τα dropdowns)
 */
window.getSessionContext = () => currentSession;

/**
 * ✅ Εντοπίζει όλα τα φίλτρα που έχουν data-xxx-related="true"
 * και προσθέτει τους κατάλληλους event listeners
 */
function autoBindFilterListeners() {
    const fields = ['xrhsh', 'team', 'company', 'mhnas'];

    fields.forEach(field => {
        document.querySelectorAll(`[data-${field}-related="true"]`).forEach(el => {
            const tag = el.tagName.toLowerCase();

            if (tag === 'input') {
                el.addEventListener('input', e => {
                    updateFilter(field, e.target.value);
                });
            }

            if (tag === 'select') {
                el.addEventListener('change', e => {
                    updateFilter(field, e.target.value);
                });
            }
        });
    });
}

/**
 * 🚀 Εκκίνηση εφαρμογής αφού φέρει τις session τιμές
 */
async function loadSessionAndInit() {
    try {
        const res = await fetch('/api/session-data', {
            credentials: 'include'
        });

        const session = await res.json();

        currentSession = {
            xrhsh: session.sessionEtos || new Date().getFullYear().toString(),
            team: session.sessionTeam || 'DefaultTeam',
            company: session.sessionCompanyInUse || 'DefaultCompany'
        };

        // Οι ειδικές αλυσίδες και η κοινή αρχικοποίηση προηγούνται.
        if (window.EmployeeFormReadiness) {
            await window.EmployeeFormReadiness.afterDom;
            // Ολοκλήρωση όλων των ακροατών DOMContentLoaded πριν από την καταχώριση.
            await new Promise(resolve => setTimeout(resolve, 0));
        } else if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
        }
        initDropdowns();
        autoBindFilterListeners();

    } catch (err) {
        console.error("❌ Σφάλμα φόρτωσης session:", err);
    }
}

window.sessionContextReady = loadSessionAndInit();
if (window.EmployeeFormReadiness?.loading()) {
    window.EmployeeFormReadiness.track('session-context', window.sessionContextReady);
}
