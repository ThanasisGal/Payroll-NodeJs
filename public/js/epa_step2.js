// /static/js/dropdowns/epa_step2.js
// Επιλογή EPA (χειροκίνητα) ⇒ mapping (EPA + KPK_apo) ⇒
// ⇒ fetch KPK από server με ?kodikos=... ⇒ set σιωπηρά στο kpk_efka
// Δεν κάνουμε re-init, δεν καθαρίζουμε/απενεργοποιούμε το epa_efka.

(function () {
    if (window.__epaStep2Init) return;
    window.__epaStep2Init = true;

    // ------------- helpers -------------
    const byIdOrName = (idOrName) =>
        document.getElementById(idOrName) ||
        document.querySelector(`#${CSS.escape(idOrName)}, input[name="${idOrName}"]`);

    const el  = (id) => document.getElementById(id);
    const ts  = (id) => el(id)?.tomselect || null;

    const getVal = (idOrName) => (byIdOrName(idOrName)?.value ?? '');
    const setVal = (idOrName, val) => {
        const n = byIdOrName(idOrName);
        if (n) n.value = val ?? '';
    };

    const norm = (v) => String(v ?? '').trim();
    const enc  = (s) => encodeURIComponent(norm(s));
    const esc  = (s) =>
        String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;').replace(/`/g, '&#96;');

    // --- CSP hardening: εξαναγκάζουμε same-origin endpoints, ακόμη κι αν δοθούν μέσω data-attr
    const toSameOrigin = (u, fallbackPath) => {
        if (!u) return fallbackPath;
        try {
            const url = new URL(u, location.origin);
            if (url.origin !== location.origin) return fallbackPath;
            return url.pathname + url.search; // κανονικοποιούμε σε relative
        } catch {
            return fallbackPath;
        }
    };

    // --- CSRF: πάρε token από meta (αν υπάρχει)
    const csrfToken =
        document.querySelector('meta[name="csrf-token"]')?.content ||
        document.querySelector('meta[name="csrf_token"]')?.content || '';

    // SweetAlert2 helper με το δικό σου στυλ (και escaped τιμές)
    const showSwal = async (html) => {
        if (!window.Swal?.fire) return;
        await Swal.fire({
            icon: "warning",
            title: "Προσοχή",
            html,
            backdrop: false,
            allowOutsideClick: false,
            customClass: {
                confirmButton: "class-warning custom-confirm-button custom-swal-button",
                title: "custom-title",
                popup: "custom-swal-popup",
            },
            confirmButtonText: "Κλείσιμο",
        });
    };

    // Endpoint για mapping EPA→KPK (αν υπάρχει data-attr, αλλιώς default) — με same-origin φίλτρο
    const mapEndpoint = toSameOrigin(
        el('epa_efka')?.dataset?.epaKpkMapApi,
        '/api/dropdown/ergazomenoi/antistoixishEpaKpk'
    );

    const byCodeEndpoint = toSameOrigin(
        '/api/dropdown/ergazomenoi/kpk_efka_by_code',
        '/api/dropdown/ergazomenoi/kpk_efka_by_code'
    );

    // Flags για σίγαση events όταν αλλάζουμε προγραμματικά
    let __muteEpa = 0;
    let __muteKpk = 0;

    // Καθάρισμα του EPA (control + hidden) χωρίς side-effects
    const clearEpaCompletely = () => {
        const inst = ts('epa_efka');
        const node = el('epa_efka');

        setVal('epa_efka_stathera', '');
        setVal('tmp_epa_efka_stathera', '');

        if (inst && node) {
            __muteEpa++;
            const prevTrigger      = inst.trigger?.bind(inst);
            const prevIgnore       = inst.ignoreFocusOpen;
            const prevOpenOnFocus  = inst.settings?.openOnFocus;
            const prevOpenFn       = inst.open?.bind(inst);

            inst.ignoreFocusOpen = true;
            if (inst.settings) inst.settings.openOnFocus = false;
            inst.open = () => {};
            inst.trigger = () => {};

            try {
                inst.clear(true);
                inst.close(); node.blur(); inst.control_input?.blur?.();
            } finally {
                setTimeout(() => {
                    inst.trigger = prevTrigger;
                    inst.open = prevOpenFn;
                    if (inst.settings) inst.settings.openOnFocus = prevOpenOnFocus;
                    inst.ignoreFocusOpen = prevIgnore;
                    __muteEpa = Math.max(0, __muteEpa - 1);
                }, 0);
            }
        } else if (node) {
            node.value = '';
            node.blur();
        }
    };

    // Πρόσθεσε/βάλε ΜΟΝΟ τον mapped KPK και επίλεξέ τον σιωπηρά ΧΩΡΙΣ να ανοίγει το dropdown
    const selectKpkSilently = (value, label) => {
        const inst = ts('kpk_efka');
        const node = el('kpk_efka');
        if (!inst || !node) return;

        const v   = norm(value);
        const lbl = norm(label) || v;

        // γράψε μόνο το σταθερό hidden του KPK (ΔΕΝ πειράζουμε το tmp εδώ)
        setVal('kpk_efka_stathera', v);

        // --- Καταστολή ανοίγματος dropdown & events για όλο το block ---
        __muteKpk++;
        const prevIgnore      = inst.ignoreFocusOpen;
        const prevOpenOnFocus = inst.settings?.openOnFocus;
        const prevOpenFn      = inst.open.bind(inst);
        const prevTrigger     = inst.trigger?.bind(inst);

        inst.ignoreFocusOpen = true;
        if (inst.settings) inst.settings.openOnFocus = false;
        inst.open = () => {};                 // προσωρινό no-op
        inst.trigger = () => {};              // σίγαση όλων των TS events

        const killOpen = () => { try { inst.close(); } catch(_){} };
        inst.on('dropdown_open', killOpen);

        try {
            inst.close(); node.blur(); inst.control_input?.blur?.();

            inst.clear(true);        // silent
            inst.clearOptions();
            inst.addOption({ value: v, label: lbl, text: lbl });
            inst.setValue(v, true);  // silent

            inst.close(); node.blur(); inst.control_input?.blur?.();
            inst.refreshItems();
            inst.refreshOptions(false);
        } finally {
            inst.off?.('dropdown_open', killOpen);
            setTimeout(() => {
                inst.open = prevOpenFn;
                if (inst.settings) inst.settings.openOnFocus = prevOpenOnFocus;
                inst.ignoreFocusOpen = prevIgnore;
                inst.trigger = prevTrigger;
                __muteKpk = Math.max(0, __muteKpk - 1);
            }, 0);
        }

        node.disabled = false;
        inst.enable();
        inst.wrapper?.classList?.remove('disabled');
    };

    // Φέρε από server τον συγκεκριμένο KPK (με έλεγχο ισχύος) και κάνε silent select
    // ΕΠΙΣΤΡΕΦΕΙ true/false για να ξέρουμε αν υπάρχει ο κωδικός στο μοντέλο
    const loadAndSelectKpkByCode = async (code) => {
        const k = norm(code);
        if (!k) return false;

        const url = `${byCodeEndpoint}?kodikos=${enc(k)}`;
        const res = await fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'X-CSRF-Token': csrfToken || '',
                'X-Requested-With': 'XMLHttpRequest',
                'Cache-Control': 'no-store'
            }
        });
        if (!res.ok) return false;

        const data = await res.json();
        const item = data?.items?.[0];
        if (!item?.value) return false;

        selectKpkSilently(item.value, item.label);
        return true;
    };

    // Mapping EPA + KPK_apo → KPK_se (server κάνει και τον έλεγχο ισχύος)
    const getMappedKpk = async (epa, kpkApo) => {
        const url = `${mapEndpoint}?epa=${enc(epa)}&kpk=${enc(kpkApo)}`;
        const res = await fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'X-CSRF-Token': csrfToken || '',
                'X-Requested-With': 'XMLHttpRequest',
                'Cache-Control': 'no-store'
            }
        });
        if (!res.ok) return '';

        const data = await res.json();

        // υποστήριξε είτε array [{kodikos,perigrafh}] είτε object {ok,kpk:{kodikos,..}} / {kodikos|mapped}
        if (Array.isArray(data)) return norm(data[0]?.kodikos || '');
        if (data && typeof data === 'object') {
            return norm(data?.kpk?.kodikos || data?.kodikos || data?.mapped || '');
        }
        return '';
    };

    // Κύριος handler: ο χρήστης ΕΠΕΛΕΞΕ χειροκίνητα EPA
    const handleEpaPick = async (epaVal) => {
        const epa = norm(epaVal);
        if (!epa) return;

        // γράψε τα hidden της EPA (κρατάμε την επιλογή)
        setVal('epa_efka_stathera', epa);
        setVal('tmp_epa_efka_stathera', epa); // και το tmp

        // KPK_apo: από hidden ή από το τρέχον TS (αν δεν υπάρχει hidden)
        const kpkApo = norm(getVal('kpk_efka_stathera') || ts('kpk_efka')?.getValue());
        if (!kpkApo) return; // αν δεν υπάρχει “από”, σταματάμε

        // 1) Ζήτα mapping ⇒ kodikos_kpk_se
        const kpkSe = await getMappedKpk(epa, kpkApo);

        // Αν ΔΕΝ υπάρχει αντιστοίχιση, καθάρισε EPA και εμφάνισε το swal
        if (!kpkSe) {
            clearEpaCompletely();
            await showSwal(
                `Δεν βρέθηκε αντιστοίχιση μεταξύ <strong>Κ.Π.Κ. ${esc(kpkApo)}</strong> και <strong>Ειδικής Περίπτωσης Ασφάλισης ${esc(epa)}</strong>.`
            );
            return;
        }

        // 2) Φέρε τον KPK από το νέο endpoint by_code και επίλεξέ τον σιωπηρά
        const kpkExists = await loadAndSelectKpkByCode(kpkSe);

        // Αν ο kodikos_kpk_se δεν υπάρχει στο KpkEfkaModel → ίδιος χειρισμός
        if (!kpkExists) {
            clearEpaCompletely();
            await showSwal(
                `Ο κωδικός KPK <strong>${esc(kpkSe)}</strong> δεν βρέθηκε στο σύστημα. Ελέγξτε την επιλογή της <strong>Ειδικής Περίπτωσης Ασφάλισης ${esc(epa)}</strong> ή αλλάξτε Κ.Π.Κ.`
            );
            return;
        }

        // --- Έλεγχοι στο tmp_kpk_efka_stathera ---
        const tmpKpk = norm(getVal('tmp_kpk_efka_stathera'));
        const curKpk = norm(getVal('kpk_efka_stathera'));

        // 1) Αν tmp_kpk είναι κενό/falsey Ή ίσο με το τρέχον kpk_efka_stathera
        //    => καθάρισε το tmp_epa_efka_stathera και έξοδος
        if (!tmpKpk || tmpKpk === curKpk) {
            setVal('tmp_epa_efka_stathera', '');
            return;
        }

        // 2) Αν διαφέρει => επίλεξε αυτόματα στο epa_efka την τιμή tmp_epa_efka_stathera,
        //    κλείσε το dropdown και έξοδος (ΧΩΡΙΣ να επηρεαστεί ο KPK)
        const wantEpa = norm(getVal('tmp_epa_efka_stathera'));
        if (!wantEpa) return;

        const epaInst = ts('epa_efka');
        const epaNode = el('epa_efka');

        if (epaInst && epaNode) {
            // Σίγαση ΟΛΩΝ των events + μη άνοιγμα dropdown όσο αλλάζουμε
            __muteEpa++;
            const prevTrigger      = epaInst.trigger?.bind(epaInst);
            const prevIgnore       = epaInst.ignoreFocusOpen;
            const prevOpenOnFocus  = epaInst.settings?.openOnFocus;
            const prevOpenFn       = epaInst.open?.bind(epaInst);

            epaInst.ignoreFocusOpen = true;
            if (epaInst.settings) epaInst.settings.openOnFocus = false;
            epaInst.open = () => {};
            const killOpen = () => { try { epaInst.close(); } catch(_){} };
            epaInst.on?.('dropdown_open', killOpen);

            // Πνίξε τυχόν item_add/change/clear που πυροδοτεί ο TomSelect εσωτερικά
            epaInst.trigger = () => {};

            try {
                // Βρες label από TomSelect options ή από το DOM <option>
                const existing = epaInst.options?.[wantEpa];
                let label = norm(existing?.label || existing?.text || '');
                if (!label) {
                    const optNode = epaNode.querySelector(`option[value="${CSS.escape(wantEpa)}"]`);
                    label = norm(optNode?.textContent);
                }
                if (!label) label = wantEpa; // fallback

                const data = { value: wantEpa, label, text: label };

                if (!existing) {
                    epaInst.addOption(data);
                } else {
                    const curLbl = norm(existing.label || existing.text || '');
                    if (epaInst.updateOption && curLbl !== label) {
                        try { epaInst.updateOption(wantEpa, data); } catch (_) {}
                    }
                }

                epaInst.setValue(wantEpa, true);      // silent
                setVal('epa_efka_stathera', wantEpa); // sync hidden
                epaInst.close(); epaNode.blur(); epaInst.control_input?.blur?.();
            } finally {
                epaInst.trigger = prevTrigger;
                epaInst.off?.('dropdown_open', killOpen);
                setTimeout(() => {
                    epaInst.open = prevOpenFn;
                    if (epaInst.settings) epaInst.settings.openOnFocus = prevOpenOnFocus;
                    epaInst.ignoreFocusOpen = prevIgnore;
                    __muteEpa = Math.max(0, __muteEpa - 1);
                }, 0);
            }
            return;
        }

        // Fallback όταν ΔΕΝ υπάρχει TomSelect στο epa_efka (π.χ. απλό <select>)
        if (epaNode) {
            __muteEpa++;
            try {
                // Θέσε την option (DOM ήδη έχει σωστό label)
                epaNode.value = wantEpa;             // χωρίς dispatch event
                setVal('epa_efka_stathera', wantEpa);
                epaNode.blur();
            } finally {
                __muteEpa = Math.max(0, __muteEpa - 1);
            }
        }
        return;
    };

    // Bind μόνο για χειροκίνητη επιλογή από τα dropdowns
    const bind = () => {
        // --- EPA ---
        const epaInst = ts('epa_efka');
        if (epaInst) {
            // Αν έχουμε mute (προγραμματική αλλαγή), ΜΗΝ ξανατρέξεις τον handler
            epaInst.on('item_add', (v) => { if (__muteEpa) return; handleEpaPick(v); });
            epaInst.on('clear',    ()  => { if (__muteEpa) return; setVal('epa_efka_stathera', ''); });
        } else {
            el('epa_efka')?.addEventListener('change', (e) => handleEpaPick(e.target.value));
        }

        // --- KPK ---
        const kpkInst = ts('kpk_efka');
        if (kpkInst) {
            // Χειροκίνητη επιλογή KPK: γράψε tmp_kpk_efka_stathera ΚΑΙ καθάρισε tmp_epa_efka_stathera
            kpkInst.on('item_add', (v) => {
                if (__muteKpk) return; // αγνόησε σιωπηρές αλλαγές
                const val = norm(v);
                setVal('tmp_kpk_efka_stathera', val);
                setVal('tmp_epa_efka_stathera', '');  // καθάρισμα αμέσως μετά
            });
        } else {
            el('kpk_efka')?.addEventListener('change', (e) => {
                if (__muteKpk) return;
                const val = norm(e.target.value);
                setVal('tmp_kpk_efka_stathera', val);
                setVal('tmp_epa_efka_stathera', '');
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind, { once: true });
    } else {
        bind();
    }
})();
