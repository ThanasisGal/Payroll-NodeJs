// /static/js/dropdowns/efkaDropdownChain.js
// Αλυσίδα: KAD → Ειδικότητα → KPK → EPA
// Pattern: ίδιο με symbaseisDropdownChain3.js + geoDropdownChain.js
// Εξαίρεση: EPA παραμένει ΠΑΝΤΑ unlocked όταν έχει KPK

import { initTomDropdown } from './dropdown-item.js';

(function () {
    if (window.__efkaDropdownChainInit) return;
    window.__efkaDropdownChainInit = true;

    const el = (id) => document.getElementById(id);
    const ts = (id) => el(id)?.tomselect || null;
    const hid = (id) => el(`${id}_stathera`) || null;

    // mutable extraParams
    const pEid = {};
    const pKpk = {};
    const pEpa = {};

    /* ═══════════════════════════════════════════════════════════════
     * 🔐 LOCK / UNLOCK
     * ═══════════════════════════════════════════════════════════════ */
    function applyLock(id) {
        const inst = ts(id);
        if (!inst) return;
        try {
            inst.disable();
        } catch (_) {}
        inst.wrapper?.classList.add('ts-locked');
        inst.wrapper?.classList.add('ts-disabled-selected');
    }

    function applyUnlock(id) {
        const inst = ts(id);
        if (!inst) return;
        try {
            inst.enable();
        } catch (_) {}
        inst.wrapper?.classList.remove('ts-locked');
        inst.wrapper?.classList.remove('ts-disabled-selected');
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🗑️ TRASH
     * ═══════════════════════════════════════════════════════════════ */
    function forceTrashVisible(id) {
        const inst = ts(id);
        if (!inst?.wrapper) return;
        if (!inst.items?.length) return;

        const btn = inst.wrapper.querySelector('.ts-single-reset-btn');
        if (!btn) {
            setTimeout(() => forceTrashVisible(id), 100);
            return;
        }

        btn.hidden = false;
        btn.style.setProperty('display', 'inline-flex', 'important');
        btn.style.setProperty('align-items', 'center', 'important');
        btn.style.setProperty('justify-content', 'center', 'important');
        btn.style.setProperty('visibility', 'visible', 'important');
        btn.style.setProperty('pointer-events', 'auto', 'important');
        btn.style.setProperty('opacity', '1', 'important');

        // kad_efka: το native trash του dropdown-item.js αρκεί
        if (id === 'kad_efka') return;

        if (!btn.__cascadeWired) {
            btn.__cascadeWired = true;
            btn.addEventListener(
                'click',
                function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    if (id === 'eidikothta_efka') cascadeFromEid();
                    if (id === 'kpk_efka') cascadeFromKpk();
                    if (id === 'epa_efka') cascadeFromEpa();
                },
                true
            );
        }
    }

    function forceAllTrashVisible() {
        ['kad_efka', 'eidikothta_efka', 'kpk_efka', 'epa_efka'].forEach((id) => {
            if (ts(id)?.items?.length) forceTrashVisible(id);
        });
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🔄 DOWNSTREAM CLEARS
     * ═══════════════════════════════════════════════════════════════ */
    function clearHiddenAndLock(id) {
        const inst = ts(id);
        if (!inst) return;
        if (hid(id)) hid(id).value = '';
        el(id)?.removeAttribute('data-has-value');
        try {
            inst.enable();
        } catch (_) {}
        try {
            inst.clear(true);
        } catch (_) {}
        try {
            inst.clearOptions();
        } catch (_) {}
        applyLock(id);
        const b = inst.wrapper?.querySelector('.ts-single-reset-btn');
        if (b) {
            b.hidden = true;
            b.style.cssText = '';
            b.__cascadeWired = false;
        }
    }

    function clearDownstreamOfKad() {
        delete pEid.kad;
        delete pKpk.kad;
        delete pKpk.eidikothta;
        delete pEpa.kpk;
        ['eidikothta_efka', 'kpk_efka', 'epa_efka'].forEach(clearHiddenAndLock);
    }

    function clearDownstreamOfEid() {
        delete pKpk.kad;
        delete pKpk.eidikothta;
        delete pEpa.kpk;
        ['kpk_efka', 'epa_efka'].forEach(clearHiddenAndLock);
    }

    function clearDownstreamOfKpk() {
        delete pEpa.kpk;
        // EPA: lock μόνο αν δεν έχει KPK
        clearHiddenAndLock('epa_efka');
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🗑️ CASCADE ACTIONS
     * ═══════════════════════════════════════════════════════════════ */
    function cascadeFromKad() {
        if (hid('kad_efka')) hid('kad_efka').value = '';
        el('kad_efka')?.removeAttribute('data-has-value');
        clearDownstreamOfKad();
        // dropdown-item.js χειρίζεται enable+clear+open για kad_efka
    }

    function cascadeFromEid() {
        clearDownstreamOfEid();
        applyUnlock('eidikothta_efka');
        const E = ts('eidikothta_efka');
        if (E) {
            try {
                E.enable();
            } catch (_) {}
            try {
                E.clear(true);
            } catch (_) {}
            try {
                E.clearOptions();
            } catch (_) {}
            E.wrapper?.classList.remove('ts-locked');
            E.wrapper?.classList.remove('ts-disabled-selected');
            const curKad = hid('kad_efka')?.value?.trim() || '';
            if (curKad) {
                pEid.kad = curKad;
                setTimeout(() => {
                    try {
                        E.load('');
                    } catch (_) {}
                }, 50);
            }
            setTimeout(() => {
                const ci = E.control_input || E.wrapper?.querySelector('input');
                ci?.focus();
                setTimeout(() => {
                    try {
                        E.open();
                    } catch (_) {}
                }, 80);
            }, 100);
        }
    }

    function cascadeFromKpk() {
        clearDownstreamOfKpk();
        applyUnlock('kpk_efka');
        const K = ts('kpk_efka');
        if (K) {
            try {
                K.enable();
            } catch (_) {}
            try {
                K.clear(true);
            } catch (_) {}
            try {
                K.clearOptions();
            } catch (_) {}
            K.wrapper?.classList.remove('ts-locked');
            K.wrapper?.classList.remove('ts-disabled-selected');
            const curKad = hid('kad_efka')?.value?.trim() || '';
            const curEid = hid('eidikothta_efka')?.value?.trim() || '';
            if (curKad) pKpk.kad = curKad;
            if (curEid) pKpk.eidikothta = curEid;
            if (curKad && curEid) {
                setTimeout(() => {
                    try {
                        K.load('');
                    } catch (_) {}
                }, 50);
            }
            setTimeout(() => {
                const ci = K.control_input || K.wrapper?.querySelector('input');
                ci?.focus();
                setTimeout(() => {
                    try {
                        K.open();
                    } catch (_) {}
                }, 80);
            }, 100);
        }
    }

    function cascadeFromEpa() {
        // EPA: δεν κλειδώνει — απλά καθαρίζει και ξαναφορτώνει
        if (hid('epa_efka')) hid('epa_efka').value = '';
        el('epa_efka')?.removeAttribute('data-has-value');

        const P = ts('epa_efka');
        if (P) {
            try {
                P.enable();
            } catch (_) {}
            try {
                P.clear(true);
            } catch (_) {}
            try {
                P.clearOptions();
            } catch (_) {}
            P.wrapper?.classList.remove('ts-locked');
            P.wrapper?.classList.remove('ts-disabled-selected');
            setTimeout(() => {
                try {
                    P.load('');
                } catch (_) {}
            }, 50);
            setTimeout(() => {
                const ci = P.control_input || P.wrapper?.querySelector('input');
                ci?.focus();
                setTimeout(() => {
                    try {
                        P.open();
                    } catch (_) {}
                }, 80);
            }, 100);
        }
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🔗 __onItemAddChain HOOKS — ΠΡΙΝ το forceInit
     * ═══════════════════════════════════════════════════════════════ */
    const kadNode = el('kad_efka');
    const eidNode = el('eidikothta_efka');
    const kpkNode = el('kpk_efka');
    const epaNode = el('epa_efka');

    if (kadNode) {
        kadNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;
            if (hid('kad_efka')) hid('kad_efka').value = v;
            pEid.kad = v;

            if (!window.__efkaHydrating) {
                applyUnlock('eidikothta_efka');
                const E = ts('eidikothta_efka');
                if (E) {
                    try {
                        E.clearOptions();
                    } catch (_) {}
                    try {
                        E.load('');
                    } catch (_) {}
                }
                setTimeout(() => {
                    const E2 = ts('eidikothta_efka');
                    if (!E2 || E2.items?.length) return;
                    const ci = E2.control_input || E2.wrapper?.querySelector('input');
                    ci?.focus();
                    setTimeout(() => {
                        try {
                            E2.open();
                        } catch (_) {}
                    }, 120);
                }, 150);
            } else {
                const E = ts('eidikothta_efka');
                if (E) {
                    try {
                        E.load('');
                    } catch (_) {}
                }
            }
            setTimeout(() => forceTrashVisible('kad_efka'), 200);
        };
        kadNode.__onClearChain = () => cascadeFromKad();
    }

    if (eidNode) {
        eidNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;
            if (hid('eidikothta_efka')) hid('eidikothta_efka').value = v;
            const curKad = hid('kad_efka')?.value?.trim() || '';
            pKpk.kad = curKad;
            pKpk.eidikothta = v;
            applyLock('eidikothta_efka');

            if (!window.__efkaHydrating) {
                applyUnlock('kpk_efka');
                const K = ts('kpk_efka');
                if (K) {
                    try {
                        K.clearOptions();
                    } catch (_) {}
                    try {
                        K.load('');
                    } catch (_) {}
                }
                setTimeout(() => {
                    const K2 = ts('kpk_efka');
                    if (!K2 || K2.items?.length) return;
                    const ci = K2.control_input || K2.wrapper?.querySelector('input');
                    ci?.focus();
                    setTimeout(() => {
                        try {
                            K2.open();
                        } catch (_) {}
                    }, 120);
                }, 150);
            } else {
                const K = ts('kpk_efka');
                if (K) {
                    try {
                        K.load('');
                    } catch (_) {}
                }
            }
            setTimeout(() => forceTrashVisible('eidikothta_efka'), 200);
        };
    }

    if (kpkNode) {
        kpkNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;
            if (hid('kpk_efka')) hid('kpk_efka').value = v;
            applyLock('kpk_efka');

            // ✅ EPA: ΠΑΝΤΑ unlock όταν έχει KPK — δεν κλειδώνει ποτέ
            applyUnlock('epa_efka');
            const P = ts('epa_efka');
            if (P) {
                try {
                    P.clearOptions();
                } catch (_) {}
                try {
                    P.load('');
                } catch (_) {}
            }

            if (!window.__efkaHydrating) {
                setTimeout(() => {
                    const P2 = ts('epa_efka');
                    if (!P2 || P2.items?.length) return;
                    const ci = P2.control_input || P2.wrapper?.querySelector('input');
                    ci?.focus();
                    setTimeout(() => {
                        try {
                            P2.open();
                        } catch (_) {}
                    }, 120);
                }, 150);
            }
            setTimeout(() => forceTrashVisible('kpk_efka'), 200);
        };
    }

    if (epaNode) {
        epaNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;
            if (hid('epa_efka')) hid('epa_efka').value = v;
            // ✅ EPA: ΔΕΝ κλειδώνει — παραμένει unlocked για αλλαγή
            // Μόνο trash για καθαρισμό
            setTimeout(() => forceTrashVisible('epa_efka'), 200);
        };
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🔧 INIT (μετά τα hooks)
     * ═══════════════════════════════════════════════════════════════ */
    const bootKad = hid('kad_efka')?.value?.trim() || '';
    const bootEid = hid('eidikothta_efka')?.value?.trim() || '';
    const bootKpk = hid('kpk_efka')?.value?.trim() || '';
    const bootEpa = hid('epa_efka')?.value?.trim() || '';

    window.__efkaHydrating = !!(bootKad || bootEid || bootKpk || bootEpa);

    if (bootKad) {
        pEid.kad = bootKad;
    }
    if (bootEid) {
        pKpk.kad = bootKad;
        pKpk.eidikothta = bootEid;
    }

    const forceInit = (id, url, extraParams) => {
        const node = el(id);
        if (!node) return null;
        if (node.tomselect) node.tomselect.destroy();
        node.removeAttribute('data-has-value');
        return initTomDropdown({ selector: `#${id}`, url, extraParams, minChars: 0 });
    };

    forceInit('kad_efka', '/api/dropdown/ergazomenoi/kad_efka');
    forceInit('eidikothta_efka', '/api/dropdown/ergazomenoi/eidikothta_efka', pEid);
    forceInit('kpk_efka', '/api/dropdown/ergazomenoi/kpk_efka', pKpk);
    forceInit('epa_efka', '/api/dropdown/ergazomenoi/epa_efka', pEpa);

    /* ═══════════════════════════════════════════════════════════════
     * ✅ IMMEDIATE LOCK — αμέσως μετά forceInit
     * ═══════════════════════════════════════════════════════════════ */
    applyLock('eidikothta_efka');
    applyLock('kpk_efka');
    applyLock('epa_efka');

    /* ═══════════════════════════════════════════════════════════════
     * 🚀 SAFETY NET
     * ═══════════════════════════════════════════════════════════════ */
    [400, 800, 1500].forEach((delay) => {
        setTimeout(() => {
            // eidikothta + kpk: locked πάντα εκτός αν ο χρήστης κάνει cascade
            ['eidikothta_efka', 'kpk_efka'].forEach((id) => {
                const inst = ts(id);
                if (!inst) return;
                if (inst.items?.length) {
                    applyLock(id);
                    setTimeout(() => forceTrashVisible(id), 50);
                } else {
                    applyLock(id);
                }
            });

            // EPA: locked μόνο αν δεν υπάρχει KPK
            const kpkInst = ts('kpk_efka');
            const epaInst = ts('epa_efka');
            if (epaInst) {
                if (kpkInst?.items?.length) {
                    // ✅ Έχει KPK → EPA unlocked
                    applyUnlock('epa_efka');
                    if (epaInst.items?.length) {
                        setTimeout(() => forceTrashVisible('epa_efka'), 50);
                    }
                } else {
                    applyLock('epa_efka');
                }
            }

            forceAllTrashVisible();
            if (delay >= 1500) window.__efkaHydrating = false;
        }, delay);
    });

    /* ═══════════════════════════════════════════════════════════════
     * 📤 EXPORT
     * ═══════════════════════════════════════════════════════════════ */
    window.__efkaHelpers = {
        el,
        ts,
        hid,
        applyLock,
        applyUnlock,
        forceTrashVisible,
        forceAllTrashVisible,
        cascadeFromKad,
        cascadeFromEid,
        cascadeFromKpk,
        cascadeFromEpa
    };
})();
