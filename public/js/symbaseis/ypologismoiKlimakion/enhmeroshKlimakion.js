/**
 * enhmeroshKlimakion.js
 * Ενημέρωση κλιμακίων από το emfanish.js
 * Στέλνει τις αλλαγές (updated & deleted) στο backend
 * Ξαναγεμίζει τον πίνακα διατηρώντας την κατάσταση (scroll, expand/collapse)
 */

document.addEventListener("DOMContentLoaded", () => {
    const updateKlimakiaBtn = document.getElementById("update-klimakia-btn");
    if (!updateKlimakiaBtn) return;

    // Παίρνουμε CSRF token
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

    async function handleUpdateKlimakiaClick(event) {
        event.preventDefault();
        event.stopPropagation();

        try {
            // ===== ΣΥΛΛΟΓΗ ΔΕΔΟΜΕΝΩΝ ΑΠΟ EMFANISH.JS =====
            let changesFromEmfanish = {
                updated: [],
                deleted: [],
            };
            
            // Αν υπάρχει η συνάρτηση collectChangesFromTable
            if (typeof collectChangesFromTable === 'function') {
                changesFromEmfanish = collectChangesFromTable();
            }

            console.log('📊 Αλλαγές για αποθήκευση:', changesFromEmfanish);

            // ===== Έλεγχος αν υπάρχουν αλλαγές =====
            if (changesFromEmfanish.updated.length === 0 && changesFromEmfanish.deleted.length === 0) {
                showSwal('info', 'Δεν υπάρχουν αλλαγές', 'Δεν έχετε κάνει καμμία αλλαγή για αποθήκευση');
                return;
            }

            // ===== ΔΕΔΟΜΕΝΑ ΓΙΑ ΑΠΟΣΤΟΛΗ =====
            const payload = {
                klimakiaChanges: changesFromEmfanish,
                timestamp: new Date().toISOString(),
            };

            console.log('📤 Στέλνω στο backend:', payload);

            const response = await fetch("/api/enhmeroshKlimakia", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "CSRF-Token": csrfToken,
                },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            // 1) Αν ο browser ακολούθησε redirect αυτόματα
            if (response.redirected && response.url) {
                window.location.href = response.url;
                return;
            }

            // 2) 3xx χωρίς auto-follow
            if (response.status >= 300 && response.status < 400) {
                const loc = response.headers.get("Location") || response.headers.get("location");
                if (loc) {
                    const abs = loc.startsWith("http")
                        ? loc
                        : new URL(loc, window.location.origin).toString();
                    window.location.href = abs;
                    return;
                }
                throw new Error(`Redirect ${response.status} χωρίς Location header`);
            }

            // 3) CSRF/Forbidden
            if (response.status === 403) {
                throw new Error("CSRF blocked (403) — η συνεδρία έληξε ή λείπει token.");
            }

            // 4) 204 No Content
            if (response.status === 204) {
                await showSwal('success', 'Επιτυχής ενημέρωση!', 'Τα κλιμάκια αποθηκεύτηκαν με επιτυχία', 1200);
                
                // ===== ΞΑΝΑΓΕΜΙΖΟΥΜΕ ΤΟΝ ΠΙΝΑΚΑ =====
                await reloadTableFromEmfanish();
                
                return;
            }

            // 5) JSON απάντηση
            const ct = response.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
                const data = await response.json();

                if (!response.ok || !data?.success) {
                    throw new Error(`HTTP ${response.status} / success=${data?.success}`);
                }

                await showSwal('success', 'Επιτυχής ενημέρωση!', data.message || 'Τα κλιμάκια αποθηκεύτηκαν με επιτυχία', 1200);
                
                // ===== ΞΑΝΑΓΕΜΙΖΟΥΜΕ ΤΟΝ ΠΙΝΑΚΑ =====
                await reloadTableFromEmfanish();

                return;
            }

            // 6) Άλλος content-type αλλά OK
            if (response.ok) {
                await showSwal('success', 'Επιτυχής ενημέρωση!', 'Τα κλιμάκια αποθηκεύτηκαν με επιτυχία', 1200);
                
                // ===== ΞΑΝΑΓΕΜΙΖΟΥΜΕ ΤΟΝ ΠΙΝΑΚΑ =====
                await reloadTableFromEmfanish();
                
                return;
            }

            // 7) Σφάλμα HTTP
            throw new Error(`HTTP error ${response.status}`);

        } catch (err) {
            console.error('❌ Σφάλμα:', err);
            
            await showSwal(
                'error', 
                'Αποτυχία ενημέρωσης κλιμακίων',
                String(err?.message || err)
            );
        }
    }

    updateKlimakiaBtn.addEventListener("click", handleUpdateKlimakiaClick);
});

// ============================
// ΔΙΑΤΗΡΗΣΗ ΚΑΤΑΣΤΑΣΗΣ ΠΙΝΑΚΑ
// ============================

/**
 * Αποθηκεύει την κατάσταση του πίνακα (ποιες γραμμές είναι ανοικτές)
 */
function saveTableState() {
    const state = {
        scrollY: window.scrollY,
        expandedRows: []
    };

    // Βρίσκουμε όλες τις ανοικτές group rows
    const groupRows = document.querySelectorAll('tr.group-row');
    for (const row of groupRows) {
        const targetId = row.dataset.target;
        const contentRow = document.querySelector(`tr[data-row-id="${targetId}"]`);
        
        // Αν η γραμμή είναι ανοικτή (display !== 'none')
        if (contentRow && contentRow.style.display !== 'none') {
            state.expandedRows.push(targetId);
        }
    }

    return state;
}

/**
 * Επαναφέρει την κατάσταση του πίνακα
 */
function restoreTableState(state) {
    if (!state) return;

    // Επαναφορά ανοικτών γραμμών
    for (const targetId of state.expandedRows) {
        const contentRow = document.querySelector(`tr[data-row-id="${targetId}"]`);
        const groupRow = document.querySelector(`tr[data-target="${targetId}"]`);

        if (contentRow && groupRow) {
            contentRow.style.display = ''; // Ανοιχτή
            const chevron = groupRow.querySelector('.chevron');
            if (chevron) {
                chevron.textContent = '▾';
            }
        }
    }

    // Επαναφορά scroll position
    if (state.scrollY > 0) {
        window.scrollTo(0, state.scrollY);
    }
}

/**
 * Ξαναγεμίζει τον πίνακα κλιμακίων χωρίς redirect
 * Διατηρεί την κατάσταση (scroll, expand/collapse)
 * Καλεί τη συνάρτηση από emfanish.js
 */
async function reloadTableFromEmfanish() {
    try {
        console.log('🔄 Ξαναγεμίζω τον πίνακα...');

        // ===== ΑΠΟΘΗΚΕΥΣΗ ΚΑΤΑΣΤΑΣΗΣ =====
        const tableState = saveTableState();
        console.log('💾 Αποθηκευμένη κατάσταση:', tableState);

        // Βρίσκουμε το tbody του πίνακα
        const tbody = document.querySelector('#myTable tbody');
        if (!tbody) {
            console.warn('⚠️ Δεν βρέθηκε το tbody του πίνακα');
            return;
        }

        // ===== ΚΑΘΑΡΙΣΜΟΣ =====
        tbody.innerHTML = '';
        window.treeDataEmfanish = {};
        window.categoryDescriptionsEmfanish = {};
        window.eidikotitaDescriptionsEmfanish = {};
        window.stoixeiaDescriptionsEmfanish = {};
        window.allKlimakiaData = [];

        // Εμφάνιση loader (αν υπάρχει)
        const loader = document.getElementById('ypologismos-loader');
        if (loader) {
            loader.style.display = 'flex';
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // ===== ΦΕΡΝΟΥΜΕ ΤΑ ΔΕΔΟΜΕΝΑ ΞΑΝΑ =====

        // 1) Παίρνουμε τα επιλεγμένα δεδομένα
        const el = document.getElementById('eidikothta_symbashs_table');
        const raw = (el.value ?? el.textContent ?? '').trim();
        const eidArr = JSON.parse(raw);

        if (!eidArr || eidArr.length === 0) {
            console.warn('⚠️ Δεν βρέθηκαν ειδικότητες');
            return;
        }

        // 2) Μοναδικές συμβάσεις και κατηγορίες
        const symbashSet = new Set(
            eidArr
                .map(row => row.afora_thn_symbash_kathgoria?.slice(0, 4))
                .filter(Boolean)
        );

        const symbashKathgoriaSet = new Set(
            eidArr
                .map(row => row.afora_thn_symbash_kathgoria)
                .filter(Boolean)
        );

        // 3) Φέρνουμε περιγραφές κατηγοριών
        let symbashIndex = 0;
        for (const symbash of symbashSet) {
            if (symbashIndex++ % 3 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }

            try {
                const resp = await fetch(`/api/kathgoriesSymbaseon/${encodeURIComponent(symbash)}`, {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: { 'Accept': 'application/json' }
                });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);

                const katArr = await resp.json();
                for (const kat of katArr) {
                    const katCode = symbash + kat.kodikos;
                    const katDescr =
                        kat.perigrafi_kathgorias ??
                        kat.perigrafh_kathgorias ??
                        kat.perigrafh ??
                        '';

                    if (katCode && katDescr) {
                        window.categoryDescriptionsEmfanish[katCode] = katDescr;
                    }
                }
            } catch (err) {
                console.error('Error fetching kathgoriesSymbaseon', err);
            }
        }

        // 4) Φέρνουμε περιγραφές ειδικοτήτων
        let symKatIndex = 0;
        for (const symKat of symbashKathgoriaSet) {
            if (symKatIndex++ % 3 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }

            try {
                const resp = await fetch(`/api/eidikothtesSymbaseon/${encodeURIComponent(symKat)}`, {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: { 'Accept': 'application/json' }
                });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);

                const eidApiArr = await resp.json();
                for (const eid of eidApiArr) {
                    const eidCode = symKat + eid.kodikos;
                    const eidDescr =
                        eid.perigrafi_eidikothtas ??
                        eid.perigrafh_eidikothtas ??
                        eid.perigrafh ??
                        '';

                    if (eidCode && eidDescr) {
                        window.eidikotitaDescriptionsEmfanish[eidCode] = eidDescr;
                    }
                }
            } catch (err) {
                console.error('Error fetching eidikothtesSymbaseon', err);
            }
        }

        // 5) Φέρνουμε τα στοιχεία από το API
        const stoixeiaMap = {};
        let rowIndex = 0;
        
        for (const row of eidArr) {
            if (rowIndex++ % 5 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }

            const kodikosSymbashs    = row.afora_thn_symbash_kathgoria.slice(0, 4);
            const kodikosKathgorias  = row.afora_thn_symbash_kathgoria.slice(4, 8);
            const kodikosEidikothtas = row.kodikos;
            const key = `${kodikosSymbashs}${kodikosKathgorias}${kodikosEidikothtas}`;

            if (!kodikosEidikothtas) continue;

            try {
                const response = await fetch(`/api/stoixeiaSymbaseon/${encodeURIComponent(key)}`, {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: { 'Accept': 'application/json' }
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                
                const stoixeiaData = await response.json();
                stoixeiaMap[key] = stoixeiaData;
                
            } catch (error) {
                console.error('Error fetching stoixeiaSymbaseon for key:', key, error);
                stoixeiaMap[key] = [];
            }
        }

        // 6) Φέρνουμε τα κλιμάκια από το API ΑΝΑ ΣΤΟΙΧΕΙΟ
        window.allKlimakiaData = [];
        
        for (const row of eidArr) {
            await new Promise(r => setTimeout(r, 0));

            const kodikosSymbashs    = row.afora_thn_symbash_kathgoria.slice(0, 4);
            const kodikosKathgorias  = row.afora_thn_symbash_kathgoria.slice(4, 8);
            const kodikosEidikothtas = row.kodikos;
            
            if (!kodikosEidikothtas) continue;

            const stoixeiaKey = `${kodikosSymbashs}${kodikosKathgorias}${kodikosEidikothtas}`;
            const stoixeiaDataForThisRow = stoixeiaMap[stoixeiaKey] || [];

            for (const stoixeio of stoixeiaDataForThisRow) {
                const kodikosStoxeiou = stoixeio.kodikos;
                const klimakiaKey = `${kodikosSymbashs}${kodikosKathgorias}${kodikosEidikothtas}${kodikosStoxeiou}`;

                try {
                    const response = await fetch(`/api/klimakiaSymbaseon/${encodeURIComponent(klimakiaKey)}`, {
                        method: 'GET',
                        credentials: 'same-origin',
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!response.ok) throw new Error('HTTP ' + response.status);

                    const klimakiaDataForThisItem = await response.json();
                    
                    if (Array.isArray(klimakiaDataForThisItem)) {
                        window.allKlimakiaData = window.allKlimakiaData.concat(klimakiaDataForThisItem);
                    }

                } catch (error) {
                    console.error('Error fetching klimakiaSymbaseon for key:', klimakiaKey, error);
                }
            }
        }

        if (window.allKlimakiaData.length === 0) {
            console.warn('⚠️ Δεν βρέθηκαν κλιμάκια');
            return;
        }

        // 7) Φτιάχνουμε την δομή δεδομένων
        buildTreeFromData(window.allKlimakiaData, stoixeiaMap);

        // 8) Render
        renderNestedTablesEmfanish(tbody);

        // ===== ΕΠΑΝΑΦΟΡΑ ΚΑΤΑΣΤΑΣΗΣ =====
        setTimeout(() => {
            restoreTableState(tableState);
            console.log('✅ Πίνακας ξαναγεμίστηκε και κατάσταση επαναφέρθηκε!');
        }, 100);

    } catch (error) {
        console.error('❌ Error reloading table:', error);
        showSwal('error', 'Σφάλμα', 'Αποτυχία ανανέωσης του πίνακα');
    } finally {
        const loader = document.getElementById('ypologismos-loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }
}