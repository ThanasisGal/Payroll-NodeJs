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
  // try {
    const res = await fetch('/api/session-data', {
      credentials: 'include'
    });

    const session = await res.json();

    currentSession = {
      xrhsh: session.sessionEtos || new Date().getFullYear().toString(),
      team: session.sessionTeam || 'DefaultTeam',
      company: session.sessionCompanyInUse || 'DefaultCompany'
    };

    initDropdowns();
    autoBindFilterListeners();

  // } catch (err) {
  //   console.error("❌ Σφάλμα φόρτωσης session:", err);
  // }
}

loadSessionAndInit();
