document.addEventListener("DOMContentLoaded", () => {
  // CSRF από meta
  let csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || null;
  const loader = document.querySelector(".loader-container");

  // Κρατάμε sessionId για συνέχεια
  let efkaSessionId = null;

  async function postJson(url, body) {
    if (!csrfToken) throw new Error('Missing CSRF token meta tag');

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify(body || {}),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) {
      throw new Error(j.error || `Request failed: ${r.status}`);
    }
    return j;
  }

  // 1) Καλεί server να ανοίξει EFKA -> επιστρέφει sessionId
async function efkaOpen() {
  const r = await fetch('/api/efka/apd/open', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      keepSession: true,   // ✅ αυτό λείπει
      ttlMs: 10 * 60 * 1000
    })
  });

  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j.error || 'open failed');

  efkaSessionId = j.sessionId;   // τώρα θα είναι string
  return j;
}
  // 2) Συνέχεια (στο Βήμα 6 θα βάλουμε πραγματικές ενέργειες)
  async function efkaContinue() {
    if (!efkaSessionId) throw new Error('Missing efkaSessionId');
    return postJson('/api/efka/apd/continue', { sessionId: efkaSessionId });
  }

  // === εδώ δένουμε το downloadBtn ===
  const btn = document.getElementById('downloadBtn');
  if (!btn) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      btn.disabled = true;
      showLoader('Γίνεται ανάκτηση από ΕΦΚΑ...');

      // 🔹 ΠΑΡΕ ΤΟ AMKA ΑΠΟ ΤΟ INPUT
      const amka = document.getElementById('amka_ergazomenoy')?.value?.trim();

      if (!amka) {
        throw new Error('Δεν υπάρχει ΑΜΚΑ');
      }

      // (A) άνοιγμα EFKA session
      const openRes = await efkaOpen();
      console.log('EFKA open:', openRes);

      // (B) συνέχεια + στείλε και το AMKA
      const contRes = await postJson('/api/efka/apd/continue', {
        sessionId: efkaSessionId,
        amka: amka   // ✅ ΕΔΩ ΤΟ ΠΕΡΝΑΜΕ
      });

      console.log('EFKA continue:', contRes);

      // === Γέμισε τα πεδία της φόρμας από τα στοιχεία που επέστρεψε ο server ===
      const p = contRes.person;
      if (p) {
        // 1η στήλη -> ama1
        const ama1El = document.getElementById('ama1');
        if (ama1El) ama1El.value = p.ama1 || '';

        // 4η -> επώνυμο
        const eponymoEl = document.getElementById('eponymo');
        if (eponymoEl) eponymoEl.value = p.eponymo || '';

        // 5η -> όνομα
        const onomaEl = document.getElementById('onoma');
        if (onomaEl) onomaEl.value = p.onoma || '';

        // 3η -> ΑΦΜ
        const afmEl = document.getElementById('afm_ergazomenoy');
        if (afmEl) afmEl.value = p.afm || '';

        // 6η -> πατρώνυμο
        const patronymoEl = document.getElementById('patronymo');
        if (patronymoEl) patronymoEl.value = p.patronymo || '';

        // 7η -> μητρώνυμο
        const mhtronymoEl = document.getElementById('mhtronymo');
        if (mhtronymoEl) mhtronymoEl.value = p.mhtronymo || '';

        // 9η -> ΠΑΛΙΟΣ => false, αλλιώς true
        const paliosNeosEl = document.getElementById('palios_neos');
        if (paliosNeosEl) paliosNeosEl.checked = !!p.palios_neos;
      }    
    } catch (e) {
      console.error(e);
      alert('Σφάλμα: ' + (e?.message || e));
    } finally {
      hideLoader();
      btn.disabled = false;
    }
  });
});