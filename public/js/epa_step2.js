// /static/js/dropdowns/epa_step2.js

(function () {
    if (window.__epaStep2Init) return;
    window.__epaStep2Init = true;

    const byIdOrName = (idOrName) =>
        document.getElementById(idOrName) ||
        document.querySelector(`#${CSS.escape(idOrName)}, input[name="${idOrName}"]`);

    const el = (id) => document.getElementById(id);
    const ts = (id) => el(id)?.tomselect || null;

    const getVal = (idOrName) => byIdOrName(idOrName)?.value ?? '';

    const setVal = (idOrName, val) => {
        const n = byIdOrName(idOrName);
        if (n) n.value = val ?? '';
    };

    const norm = (v) => String(v ?? '').trim();
    const enc = (s) => encodeURIComponent(norm(s));

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;');

    const toSameOrigin = (u, fallbackPath) => {
        if (!u) return fallbackPath;

        try {
            const url = new URL(u, location.origin);
            if (url.origin !== location.origin) return fallbackPath;
            return url.pathname + url.search;
        } catch {
            return fallbackPath;
        }
    };

    const csrfToken =
        document.querySelector('meta[name="csrf-token"]')?.content ||
        document.querySelector('meta[name="csrf_token"]')?.content ||
        '';

    const showSwal = async (html) => {
        if (!window.Swal?.fire) return;

        await Swal.fire({
            icon: 'warning',
            title: 'Προσοχή',
            html,
            backdrop: false,
            allowOutsideClick: false,
            customClass: {
                confirmButton: 'class-warning custom-confirm-button custom-swal-button',
                title: 'custom-title',
                popup: 'custom-swal-popup'
            },
            confirmButtonText: 'Κλείσιμο'
        });
    };

    const mapEndpoint = toSameOrigin(
        el('epa_efka')?.dataset?.epaKpkMapApi,
        '/api/dropdown/ergazomenoi/antistoixishEpaKpk'
    );

    const byCodeEndpoint = toSameOrigin(
        '/api/dropdown/ergazomenoi/kpk_efka_by_code',
        '/api/dropdown/ergazomenoi/kpk_efka_by_code'
    );

    let __muteEpa = 0;
    let __muteKpk = 0;
    let __restoringBaseKpk = false;

    const clearEpaCompletely = () => {
        const inst = ts('epa_efka');
        const node = el('epa_efka');

        setVal('epa_efka_stathera', '');
        setVal('tmp_epa_efka_stathera', '');

        if (inst && node) {
            __muteEpa++;

            const prevTrigger = inst.trigger?.bind(inst);
            const prevIgnore = inst.ignoreFocusOpen;
            const prevOpenOnFocus = inst.settings?.openOnFocus;
            const prevOpenFn = inst.open?.bind(inst);

            inst.ignoreFocusOpen = true;
            if (inst.settings) inst.settings.openOnFocus = false;
            inst.open = () => {};
            inst.trigger = () => {};

            try {
                inst.clear(true);
                inst.close();
                node.blur();
                inst.control_input?.blur?.();
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

    const selectKpkSilently = (value, label) => {
        const inst = ts('kpk_efka');
        const node = el('kpk_efka');

        if (!inst || !node) return;

        const v = norm(value);
        const lbl = norm(label) || v;

        setVal('kpk_efka_stathera', v);

        __muteKpk++;

        const prevIgnore = inst.ignoreFocusOpen;
        const prevOpenOnFocus = inst.settings?.openOnFocus;
        const prevOpenFn = inst.open.bind(inst);
        const prevTrigger = inst.trigger?.bind(inst);

        inst.ignoreFocusOpen = true;
        if (inst.settings) inst.settings.openOnFocus = false;
        inst.open = () => {};
        inst.trigger = () => {};

        const killOpen = () => {
            try {
                inst.close();
            } catch (_) {}
        };

        inst.on('dropdown_open', killOpen);

        try {
            inst.close();
            node.blur();
            inst.control_input?.blur?.();

            inst.clear(true);
            inst.clearOptions();

            inst.addOption({
                value: v,
                label: lbl,
                text: lbl
            });

            inst.setValue(v, true);

            inst.close();
            node.blur();
            inst.control_input?.blur?.();
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

    const loadAndSelectKpkByCode = async (code) => {
        const k = norm(code);
        if (!k) return false;

        const url = `${byCodeEndpoint}?kodikos=${enc(k)}`;

        const res = await fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
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

    const restoreBaseKpk = async () => {
        if (__restoringBaseKpk) return;

        const baseKpk = norm(getVal('kpk_efka_basei_symbashs_stathera'));

        console.log('[RESTORE BASE KPK]', {
            baseKpk,
            kpk_efka_stathera: getVal('kpk_efka_stathera'),
            kpk_efka_value: ts('kpk_efka')?.getValue()
        });

        if (!baseKpk) return;

        __restoringBaseKpk = true;

        try {
            const ok = await loadAndSelectKpkByCode(baseKpk);

            console.log('[RESTORE BASE KPK RESULT]', {
                baseKpk,
                ok
            });

            if (ok) {
                setVal('kpk_efka_stathera', baseKpk);
                setVal('tmp_kpk_efka_stathera', '');
                setVal('tmp_epa_efka_stathera', '');
                setVal('epa_efka_stathera', '');
            } else {
                await showSwal(
                    `Δεν μπόρεσε να επανέλθει το αρχικό Κ.Π.Κ. <strong>${esc(baseKpk)}</strong>.`
                );
            }
        } finally {
            __restoringBaseKpk = false;
        }
    };

    const getMappedKpk = async (epa, kpkApo) => {
        const url = `${mapEndpoint}?epa=${enc(epa)}&kpk=${enc(kpkApo)}`;

        const res = await fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-CSRF-Token': csrfToken || '',
                'X-Requested-With': 'XMLHttpRequest',
                'Cache-Control': 'no-store'
            }
        });

        if (!res.ok) return '';

        const data = await res.json();

        if (Array.isArray(data)) return norm(data[0]?.kodikos || '');

        if (data && typeof data === 'object') {
            return norm(data?.kpk?.kodikos || data?.kodikos || data?.mapped || '');
        }

        return '';
    };

    const handleEpaPick = async (epaVal) => {
        const epa = norm(epaVal);

        if (!epa) {
            await restoreBaseKpk();
            return;
        }

        setVal('epa_efka_stathera', epa);
        setVal('tmp_epa_efka_stathera', epa);

        const kpkApo = norm(
            getVal('kpk_efka_basei_symbashs_stathera') ||
                getVal('tmp_kpk_efka_stathera') ||
                getVal('kpk_efka_stathera') ||
                ts('kpk_efka')?.getValue()
        );

        if (!kpkApo) return;

        console.log('[EPA STEP2 DEBUG]', {
            epa,
            kpkApo,
            kpk_efka_basei_symbashs_stathera: getVal('kpk_efka_basei_symbashs_stathera'),
            kpk_efka_stathera: getVal('kpk_efka_stathera'),
            kpk_efka_value: ts('kpk_efka')?.getValue(),
            tmp_kpk_efka_stathera: getVal('tmp_kpk_efka_stathera')
        });

        const kpkSe = await getMappedKpk(epa, kpkApo);

        if (!kpkSe) {
            clearEpaCompletely();

            await showSwal(
                `Δεν βρέθηκε αντιστοίχιση μεταξύ <strong>Κ.Π.Κ. ${esc(kpkApo)}</strong> και <strong>Ειδικής Περίπτωσης Ασφάλισης ${esc(epa)}</strong>.`
            );

            return;
        }

        const kpkExists = await loadAndSelectKpkByCode(kpkSe);

        if (!kpkExists) {
            clearEpaCompletely();

            await showSwal(
                `Ο κωδικός KPK <strong>${esc(kpkSe)}</strong> δεν βρέθηκε στο σύστημα. Ελέγξτε την επιλογή της <strong>Ειδικής Περίπτωσης Ασφάλισης ${esc(epa)}</strong> ή αλλάξτε Κ.Π.Κ.`
            );

            return;
        }

        const tmpKpk = norm(getVal('tmp_kpk_efka_stathera'));
        const curKpk = norm(getVal('kpk_efka_stathera'));

        if (!tmpKpk || tmpKpk === curKpk) {
            setVal('tmp_epa_efka_stathera', '');
            return;
        }

        const wantEpa = norm(getVal('tmp_epa_efka_stathera'));
        if (!wantEpa) return;

        const epaInst = ts('epa_efka');
        const epaNode = el('epa_efka');

        if (epaInst && epaNode) {
            __muteEpa++;

            const prevTrigger = epaInst.trigger?.bind(epaInst);
            const prevIgnore = epaInst.ignoreFocusOpen;
            const prevOpenOnFocus = epaInst.settings?.openOnFocus;
            const prevOpenFn = epaInst.open?.bind(epaInst);

            epaInst.ignoreFocusOpen = true;
            if (epaInst.settings) epaInst.settings.openOnFocus = false;
            epaInst.open = () => {};

            const killOpen = () => {
                try {
                    epaInst.close();
                } catch (_) {}
            };

            epaInst.on?.('dropdown_open', killOpen);
            epaInst.trigger = () => {};

            try {
                const existing = epaInst.options?.[wantEpa];
                let label = norm(existing?.label || existing?.text || '');

                if (!label) {
                    const optNode = epaNode.querySelector(`option[value="${CSS.escape(wantEpa)}"]`);
                    label = norm(optNode?.textContent);
                }

                if (!label) label = wantEpa;

                const data = {
                    value: wantEpa,
                    label,
                    text: label
                };

                if (!existing) {
                    epaInst.addOption(data);
                } else {
                    const curLbl = norm(existing.label || existing.text || '');

                    if (epaInst.updateOption && curLbl !== label) {
                        try {
                            epaInst.updateOption(wantEpa, data);
                        } catch (_) {}
                    }
                }

                epaInst.setValue(wantEpa, true);
                setVal('epa_efka_stathera', wantEpa);

                epaInst.close();
                epaNode.blur();
                epaInst.control_input?.blur?.();
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

        if (epaNode) {
            __muteEpa++;

            try {
                epaNode.value = wantEpa;
                setVal('epa_efka_stathera', wantEpa);
                epaNode.blur();
            } finally {
                __muteEpa = Math.max(0, __muteEpa - 1);
            }
        }
    };

    const bind = () => {
        const epaInst = ts('epa_efka');

        if (epaInst) {
            let epaClearInProgress = false;

            const handleEpaClear = async () => {
                if (__muteEpa || epaClearInProgress) return;

                epaClearInProgress = true;

                try {
                    setVal('epa_efka_stathera', '');
                    setVal('tmp_epa_efka_stathera', '');

                    await restoreBaseKpk();
                } finally {
                    epaClearInProgress = false;
                }
            };

            epaInst.on('item_add', (v) => {
                if (__muteEpa) return;
                handleEpaPick(v);
            });

            epaInst.on('clear', async () => {
                if (__muteEpa) return;
                await handleEpaClear();
            });

            epaInst.on('item_remove', async () => {
                if (__muteEpa) return;

                const currentEpa = norm(epaInst.getValue());

                if (!currentEpa) {
                    await handleEpaClear();
                }
            });

            epaInst.on('change', async (value) => {
                if (__muteEpa) return;

                const currentEpa = norm(value);

                if (!currentEpa) {
                    await handleEpaClear();
                }
            });

            epaInst.wrapper?.addEventListener('click', () => {
                setTimeout(async () => {
                    if (__muteEpa) return;

                    const currentEpa = norm(epaInst.getValue());

                    if (!currentEpa) {
                        await handleEpaClear();
                    }
                }, 50);
            });
        } else {
            el('epa_efka')?.addEventListener('change', async (e) => {
                const val = norm(e.target.value);

                if (!val) {
                    setVal('epa_efka_stathera', '');
                    setVal('tmp_epa_efka_stathera', '');

                    await restoreBaseKpk();
                    return;
                }

                handleEpaPick(val);
            });
        }

        const kpkInst = ts('kpk_efka');

        if (kpkInst) {
            let userOpenedKpkDropdown = false;

            kpkInst.on('dropdown_open', () => {
                if (__muteKpk) return;
                userOpenedKpkDropdown = true;
            });

            kpkInst.on('item_add', (v) => {
                if (__muteKpk) return;

                if (!userOpenedKpkDropdown) return;

                const val = norm(v);

                setVal('kpk_efka_basei_symbashs_stathera', val);
                setVal('tmp_kpk_efka_stathera', val);
                setVal('tmp_epa_efka_stathera', '');

                userOpenedKpkDropdown = false;
            });

            kpkInst.on('clear', () => {
                if (__muteKpk) return;

                setVal('kpk_efka_stathera', '');
                setVal('tmp_kpk_efka_stathera', '');
                setVal('tmp_epa_efka_stathera', '');
            });
        } else {
            el('kpk_efka')?.addEventListener('change', (e) => {
                if (__muteKpk) return;

                const val = norm(e.target.value);

                setVal('kpk_efka_basei_symbashs_stathera', val);
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
