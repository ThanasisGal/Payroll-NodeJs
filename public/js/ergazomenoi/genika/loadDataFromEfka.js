// document.addEventListener('DOMContentLoaded', () => {
//     // CSRF από meta
//     let csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || null;
//     const loader = document.querySelector('.loader-container');

//     // Κρατάμε sessionId για συνέχεια
//     let efkaSessionId = null;

//     async function postJson(url, body) {
//         if (!csrfToken) throw new Error('Missing CSRF token meta tag');

//         const r = await fetch(url, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'x-csrf-token': csrfToken
//             },
//             credentials: 'same-origin',
//             body: JSON.stringify(body || {})
//         });

//         const j = await r.json().catch(() => ({}));
//         if (!r.ok || !j.success) {
//             throw new Error(j.error || `Request failed: ${r.status}`);
//         }
//         return j;
//     }

//     // 1) Καλεί server να ανοίξει EFKA -> επιστρέφει sessionId
//     async function efkaOpen() {
//         const r = await fetch('/api/efka/apd/open', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'x-csrf-token': csrfToken
//             },
//             credentials: 'same-origin',
//             body: JSON.stringify({
//                 keepSession: true, // ✅ αυτό λείπει
//                 ttlMs: 10 * 60 * 1000
//             })
//         });

//         const j = await r.json();
//         if (!r.ok || !j.success) throw new Error(j.error || 'open failed');

//         efkaSessionId = j.sessionId; // τώρα θα είναι string
//         return j;
//     }
//     // 2) Συνέχεια (στο Βήμα 6 θα βάλουμε πραγματικές ενέργειες)
//     async function efkaContinue() {
//         if (!efkaSessionId) throw new Error('Missing efkaSessionId');
//         return postJson('/api/efka/apd/continue', { sessionId: efkaSessionId });
//     }

//     // === εδώ δένουμε το downloadBtn ===
//     const btn = document.getElementById('downloadBtn');
//     if (!btn) return;

//     btn.addEventListener('click', async (e) => {
//         e.preventDefault();
//         e.stopPropagation();

//         try {
//             btn.disabled = true;
//             showLoader('Γίνεται ανάκτηση από ΕΦΚΑ...');

//             // 🔹 ΠΑΡΕ ΤΟ AMKA ΑΠΟ ΤΟ INPUT
//             const amka = document.getElementById('amka_ergazomenoy')?.value?.trim();

//             if (!amka) {
//                 throw new Error('Δεν υπάρχει ΑΜΚΑ');
//             }

//             // (A) άνοιγμα EFKA session
//             const openRes = await efkaOpen();

//             // (B) συνέχεια + στείλε και το AMKA
//             const contRes = await postJson('/api/efka/apd/continue', {
//                 sessionId: efkaSessionId,
//                 amka: amka // ✅ ΕΔΩ ΤΟ ΠΕΡΝΑΜΕ
//             });

//             // === Γέμισε τα πεδία της φόρμας από τα στοιχεία που επέστρεψε ο server ===
//             const p = contRes.person;
//             if (p) {
//                 // 1η στήλη -> ama1
//                 const ama1El = document.getElementById('ama_01');
//                 if (ama1El) ama1El.value = p.ama1 || '';

//                 // 4η -> επώνυμο
//                 const eponymoEl = document.getElementById('eponymo');
//                 const eponymoElHidden = document.getElementById('eponymoHidden');
//                 if (eponymoEl) {
//                     eponymoEl.value = p.eponymo || '';
//                     eponymoElHidden.value = p.eponymo || '';
//                     eponymoEl.dispatchEvent(new Event('input', { bubbles: true }));
//                 }

//                 // 5η -> όνομα
//                 const onomaEl = document.getElementById('onoma');
//                 const onomaElHidden = document.getElementById('onomaHidden');
//                 if (onomaEl) {
//                     onomaEl.value = p.onoma || '';
//                     onomaElHidden.value = p.onoma || '';
//                     onomaEl.dispatchEvent(new Event('input', { bubbles: true }));
//                 }

//                 // 3η -> ΑΦΜ
//                 const afmEl = document.getElementById('afm_ergazomenoy');
//                 const afmElHidden = document.getElementById('afm_ergazomenoyHidden');
//                 if (afmEl) {
//                     afmEl.value = p.afm || '';
//                     afmElHidden.value = p.afm || '';
//                     afmEl.dispatchEvent(new Event('input', { bubbles: true }));
//                 }

//                 // 6η -> πατρώνυμο
//                 const patronymoEl = document.getElementById('patronymo');
//                 if (patronymoEl) patronymoEl.value = p.patronymo || '';
//                 patronymoEl.dispatchEvent(new Event('input', { bubbles: true }));

//                 // 7η -> μητρώνυμο
//                 const mhtronymoEl = document.getElementById('mhtronymo');
//                 if (mhtronymoEl) mhtronymoEl.value = p.mhtronymo || '';
//                 mhtronymoEl.dispatchEvent(new Event('input', { bubbles: true }));

//                 // 9η -> ΠΑΛΙΟΣ => false, αλλιώς true
//                 const paliosNeosEl = document.getElementById('palios_neos');
//                 if (paliosNeosEl) {
//                     paliosNeosEl.checked = !!p.palios_neos;
//                     // ✅ Trigger το change event για να ενημερωθεί το label
//                     paliosNeosEl.dispatchEvent(new Event('change', { bubbles: true }));
//                 }
//             }
//         } catch (e) {
//             console.error(e);
//             alert('Σφάλμα: ' + (e?.message || e));
//         } finally {
//             hideLoader();
//             btn.disabled = false;
//         }
//     });
// });

document.addEventListener('DOMContentLoaded', () => {
    let csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || null;

    let efkaSessionId = null;

    async function postJson(url, body) {
        if (!csrfToken) throw new Error('Missing CSRF token meta tag');
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
            credentials: 'same-origin',
            body: JSON.stringify(body || {})
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.success) throw new Error(j.error || `Request failed: ${r.status}`);
        return j;
    }

    async function efkaOpen() {
        const r = await fetch('/api/efka/apd/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
            credentials: 'same-origin',
            body: JSON.stringify({ keepSession: true, ttlMs: 10 * 60 * 1000 })
        });
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j.error || 'open failed');
        efkaSessionId = j.sessionId;
        return j;
    }

    const btn = document.getElementById('downloadBtn');
    if (!btn) return;

    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            btn.disabled = true;

            const amka = document.getElementById('amka_ergazomenoy')?.value?.trim();
            if (!amka) throw new Error('Δεν υπάρχει ΑΜΚΑ');

            // =====================================================================
            // ✅ ΒΗΜΑ 0: Έλεγχος ΤΕΚΑ — ΠΡΙΝ το efkaOpen()
            // =====================================================================
            let tekaMessage = '';

            let tekaData = null;

            showLoader('Παρακαλώ περιμένετε...', 'Έλεγχος υπαγωγής στο ΤΕΚΑ');

            try {
                const tekaRes = await fetch('/api/efka/teka/check', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ amka })
                });

                console.log('[TEKA] Response status:', tekaRes.status);
                tekaData = await tekaRes.json().catch(() => ({})); // ✅ assign στη let
                console.log('[TEKA] Response data:', tekaData);

                if (!tekaData.success) {
                    console.error('[TEKA] Check failed:', tekaData.error);
                }
            } catch (tekaErr) {
                console.error('[TEKA] Exception:', tekaErr?.message || tekaErr);
                tekaData = {}; // ✅ fallback για να μην κρασάρει παρακάτω
            }

            // =====================================================================
            // ✅ ΒΗΜΑ 1: Ανάκτηση από ΕΦΚΑ (ΑΠΔ) — ΜΕΤΑ το ΤΕΚΑ
            // =====================================================================
            showLoader('Παρακαλώ περιμένετε...', 'Αναζήτηση Στοιχείων Εργαζόμενου');

            const openRes = await efkaOpen(); // ← αυτό ήταν πριν, τώρα είναι 2ο

            const contRes = await postJson('/api/efka/apd/continue', {
                sessionId: efkaSessionId,
                amka
            });

            // =====================================================================
            // ✅ ΓΕΜΙΣΕ ΤΑ ΠΕΔΙΑ ΤΗΣ ΦΟΡΜΑΣ (όπως ήταν)
            // =====================================================================
            const p = contRes.person;
            if (p) {
                const ama1El = document.getElementById('ama_01');
                if (ama1El) ama1El.value = p.ama1 || '';

                const eponymoEl = document.getElementById('eponymo');
                const eponymoHidden = document.getElementById('eponymoHidden');
                if (eponymoEl) {
                    eponymoEl.value = p.eponymo || '';
                    if (eponymoHidden) eponymoHidden.value = p.eponymo || '';
                    eponymoEl.dispatchEvent(new Event('input', { bubbles: true }));
                }

                const onomaEl = document.getElementById('onoma');
                const onomaHidden = document.getElementById('onomaHidden');
                if (onomaEl) {
                    onomaEl.value = p.onoma || '';
                    if (onomaHidden) onomaHidden.value = p.onoma || '';
                    onomaEl.dispatchEvent(new Event('input', { bubbles: true }));
                }

                const afmEl = document.getElementById('afm_ergazomenoy');
                const afmHidden = document.getElementById('afm_ergazomenoyHidden');
                if (afmEl) {
                    afmEl.value = p.afm || '';
                    if (afmHidden) afmHidden.value = p.afm || '';
                    afmEl.dispatchEvent(new Event('input', { bubbles: true }));
                }

                const patronymoEl = document.getElementById('patronymo');
                if (patronymoEl) {
                    patronymoEl.value = p.patronymo || '';
                    patronymoEl.dispatchEvent(new Event('input', { bubbles: true }));
                }

                const mhtronymoEl = document.getElementById('mhtronymo');
                if (mhtronymoEl) {
                    mhtronymoEl.value = p.mhtronymo || '';
                    mhtronymoEl.dispatchEvent(new Event('input', { bubbles: true }));
                }

                const paliosNeosEl = document.getElementById('palios_neos');
                if (paliosNeosEl) {
                    paliosNeosEl.checked = !!p.palios_neos;
                    paliosNeosEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            // =====================================================================
            // ✅ ΒΑΛΕ ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΤΕΚΑ — τώρα το tekaData είναι ορατό εδώ
            // =====================================================================
            const tekaLabel = document.getElementById('ypagogh_se_teka');
            const tekaRow = document.getElementById('teka-result-row');

            if (tekaLabel && tekaRow) {
                if (tekaData?.tekaYpagogi === true && tekaData?.tekaMessage) {
                    tekaLabel.textContent = tekaData.tekaMessage;
                    tekaRow.classList.remove('d-none');
                } else {
                    tekaLabel.textContent = '';
                    tekaRow.classList.add('d-none');
                }
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
