// /static/js/symbaseisDropdownChain3.js (ESM)
import { initTomDropdown } from './dropdown-item.js';

(function () {
    if (window.__symbaseisDropdownChain3MultiInit) return;
    window.__symbaseisDropdownChain3MultiInit = true;

    const el = (id) => document.getElementById(id);
    const ts = (id) => el(id)?.tomselect || null;
    const hid = (id) => el(`${id}_stathera`) || null;

    const katParams = {};
    const eidParams = {};

    const bootSym = hid('symbash')?.value?.trim() || '';
    const bootKat = hid('kathgoria_symbashs')?.value?.trim() || '';
    const bootEid = hid('eidikothta_symbashs')?.value?.trim() || '';

    window.__symbaseisHydrating = !!(bootSym || bootKat || bootEid);

    if (bootSym) {
        katParams.symbash_stathera = bootSym;
        eidParams.symbash_stathera = bootSym;
    }
    if (bootKat) {
        eidParams.kathgoria_symbashs_stathera = bootKat;
    }

    const katNode = el('kathgoria_symbashs');
    const eidNode = el('eidikothta_symbashs');

    const katUrl = katNode?.hasAttribute('multiple')
        ? '/api/dropdown/symbaseis/kathgoria_symbashs_multi'
        : '/api/dropdown/symbaseis/kathgoria_symbashs';

    const eidUrl = eidNode?.hasAttribute('multiple')
        ? '/api/dropdown/symbaseis/eidikothta_symbashs_multi'
        : '/api/dropdown/symbaseis/eidikothta_symbashs';

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

        if (id === 'symbash') return;

        if (!btn.__cascadeWired) {
            btn.__cascadeWired = true;
            btn.addEventListener(
                'click',
                function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    if (id === 'kathgoria_symbashs') cascadeFromKat();
                    if (id === 'eidikothta_symbashs') cascadeFromEid();
                },
                true
            );
        }
    }

    function forceAllTrashVisible() {
        ['symbash', 'kathgoria_symbashs', 'eidikothta_symbashs'].forEach((id) => {
            if (ts(id)?.items?.length) forceTrashVisible(id);
        });
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🔐 LOCK helpers
     * ═══════════════════════════════════════════════════════════════ */
    function applyLock(id) {
        const inst = ts(id);
        if (!inst) return;
        try {
            inst.disable();
        } catch (_) {}
        inst.wrapper?.classList.add('ts-locked');
        // inst.wrapper?.classList.remove('ts-disabled-selected');
        if (id === 'kathgoria_symbashs' || id === 'eidikothta_symbashs') {
            inst.wrapper?.classList.add('ts-disabled-selected');
        }
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
     * 🔄 DOWNSTREAM CLEARS
     * ═══════════════════════════════════════════════════════════════ */
    function clearDownstreamOfSym() {
        if (hid('kathgoria_symbashs')) hid('kathgoria_symbashs').value = '';
        if (hid('eidikothta_symbashs')) hid('eidikothta_symbashs').value = '';
        if (el('kathgoria_symbashs_table')) el('kathgoria_symbashs_table').value = '[]';
        if (el('eidikothta_symbashs_table')) el('eidikothta_symbashs_table').value = '[]';
        if (el('kathgoria_symbashs_stathera')) el('kathgoria_symbashs_stathera').value = '';
        if (el('eidikothta_symbashs_stathera')) el('eidikothta_symbashs_stathera').value = '';
        delete katParams.symbash_stathera;
        delete eidParams.symbash_stathera;
        delete eidParams.kathgoria_symbashs_stathera;

        ['kathgoria_symbashs', 'eidikothta_symbashs'].forEach((id) => {
            const inst = ts(id);
            if (!inst) return;
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
        });

        if (typeof window.clearStoixeiaSymbaseonContainer === 'function')
            window.clearStoixeiaSymbaseonContainer();
    }

    function clearDownstreamOfKat() {
        if (hid('eidikothta_symbashs')) hid('eidikothta_symbashs').value = '';
        if (el('eidikothta_symbashs_table')) el('eidikothta_symbashs_table').value = '[]';
        if (el('eidikothta_symbashs_stathera')) el('eidikothta_symbashs_stathera').value = '';
        if (el('kathgoria_symbashs_table')) el('kathgoria_symbashs_table').value = '[]';
        if (el('kathgoria_symbashs_stathera')) el('kathgoria_symbashs_stathera').value = '';
        delete eidParams.kathgoria_symbashs_stathera;

        const E = ts('eidikothta_symbashs');
        if (E) {
            try {
                E.clear(true);
            } catch (_) {}
            try {
                E.clearOptions();
            } catch (_) {}
            applyLock('eidikothta_symbashs');
            const b = E.wrapper?.querySelector('.ts-single-reset-btn');
            if (b) {
                b.hidden = true;
                b.style.cssText = '';
                b.__cascadeWired = false;
            }
        }

        if (typeof window.clearStoixeiaSymbaseonContainer === 'function')
            window.clearStoixeiaSymbaseonContainer();
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🗑️ CASCADE ACTIONS (από trash buttons)
     * ═══════════════════════════════════════════════════════════════ */
    function cascadeFromSym() {
        if (hid('symbash')) hid('symbash').value = '';
        el('symbash')?.removeAttribute('data-has-value');
        clearDownstreamOfSym();
        // dropdown-item.js χειρίζεται το enable+clear+open για το symbash
    }

    function cascadeFromKat() {
        if (hid('kathgoria_symbashs')) hid('kathgoria_symbashs').value = '';
        el('kathgoria_symbashs')?.removeAttribute('data-has-value');
        clearDownstreamOfKat();

        const K = ts('kathgoria_symbashs');
        if (K) {
            // ✅ Enable πρώτα, μετά clear ώστε να μην είναι disabled κατά το clear
            try {
                K.enable();
            } catch (_) {}
            try {
                K.clear(true);
            } catch (_) {} // ✅ καθαρίζει το επιλεγμένο item
            try {
                K.clearOptions();
            } catch (_) {}
            K.wrapper?.classList.remove('ts-locked');
            K.wrapper?.classList.remove('ts-disabled-selected');

            const curSym = hid('symbash')?.value?.trim() || '';
            if (curSym) {
                katParams.symbash_stathera = curSym;
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

    function cascadeFromEid() {
        if (hid('eidikothta_symbashs')) hid('eidikothta_symbashs').value = '';
        if (el('eidikothta_symbashs_table')) el('eidikothta_symbashs_table').value = '[]';
        el('eidikothta_symbashs')?.removeAttribute('data-has-value');

        if (typeof window.clearStoixeiaSymbaseonContainer === 'function')
            window.clearStoixeiaSymbaseonContainer();

        const E = ts('eidikothta_symbashs');
        if (E) {
            // ✅ Enable πρώτα, μετά clear
            try {
                E.enable();
            } catch (_) {}
            try {
                E.clear(true);
            } catch (_) {} // ✅ καθαρίζει το επιλεγμένο item
            try {
                E.clearOptions();
            } catch (_) {}
            E.wrapper?.classList.remove('ts-locked');
            E.wrapper?.classList.remove('ts-disabled-selected');

            const curSym = hid('symbash')?.value?.trim() || '';
            const curKat = hid('kathgoria_symbashs')?.value?.trim() || '';
            if (curSym) eidParams.symbash_stathera = curSym;
            if (curKat) eidParams.kathgoria_symbashs_stathera = curKat;
            if (curSym && curKat) {
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

        setTimeout(() => {
            try {
                window.dispatchEvent(new Event('eidikothtaChanged'));
            } catch (e) {}
        }, 50);
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🔗 __onItemAddChain HOOKS — ορίζονται ΠΡΙΝ το forceInit
     * ═══════════════════════════════════════════════════════════════ */
    const symNode = el('symbash');
    if (symNode) {
        symNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;

            if (hid('symbash')) hid('symbash').value = v;
            katParams.symbash_stathera = v;
            eidParams.symbash_stathera = v;

            // ✅ ΔΕΝ κάνουμε unlock το kathgoria εδώ
            // Το kathgoria παραμένει locked — αλλά φορτώνουμε τα options
            // ώστε να είναι έτοιμα μόλις ο χρήστης πατήσει το trash
            const K = ts('kathgoria_symbashs');
            if (K) {
                // Παραμένει locked — απλά φορτώνουμε options στο background
                try {
                    K.load('');
                } catch (_) {}
            }

            // ✅ Αν είμαστε σε νέα επιλογή (όχι hydration):
            // Πρέπει να δώσουμε τη δυνατότητα επιλογής κατηγορίας
            // → unlock + auto-focus
            if (!window.__symbaseisHydrating) {
                applyUnlock('kathgoria_symbashs');
                setTimeout(() => {
                    const K2 = ts('kathgoria_symbashs');
                    if (!K2) return;
                    const ci = K2.control_input || K2.wrapper?.querySelector('input');
                    ci?.focus();
                    setTimeout(() => {
                        try {
                            K2.open();
                        } catch (_) {}
                    }, 120);
                }, 150);
            }
            // Αν είμαστε σε hydration → παραμένει locked (το safety net θα βάλει trash)

            setTimeout(() => forceTrashVisible('symbash'), 200);
        };

        symNode.__onClearChain = () => {
            cascadeFromSym();
        };
    }

    if (katNode) {
        katNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;

            const sym4 = hid('symbash')?.value?.trim() || '';
            const katTS = ts('kathgoria_symbashs');
            if (hid('kathgoria_symbashs')) hid('kathgoria_symbashs').value = v;

            const opt = katTS?.options?.[v] || {};
            const katTable = [
                { aa: String(opt.afora_thn_symbash_kathgoria || sym4 + v), kodikos: v }
            ];
            if (el('kathgoria_symbashs_table'))
                el('kathgoria_symbashs_table').value = JSON.stringify(katTable);

            eidParams.kathgoria_symbashs_stathera = v;

            // ✅ kathgoria: ήδη locked από dropdown-item.js item_add → βεβαιωνόμαστε
            applyLock('kathgoria_symbashs');

            // ✅ eidikothta: ΔΕΝ κάνουμε unlock εδώ αν είμαστε σε hydration
            if (!window.__symbaseisHydrating) {
                applyUnlock('eidikothta_symbashs');
                const E = ts('eidikothta_symbashs');
                if (E) {
                    try {
                        E.load('');
                    } catch (_) {}
                }
                setTimeout(() => {
                    const E2 = ts('eidikothta_symbashs');
                    if (!E2) return;
                    const ci = E2.control_input || E2.wrapper?.querySelector('input');
                    ci?.focus();
                    setTimeout(() => {
                        try {
                            E2.open();
                        } catch (_) {}
                    }, 120);
                }, 150);
            } else {
                // Hydration: φορτώνουμε options στο background, παραμένει locked
                const E = ts('eidikothta_symbashs');
                if (E) {
                    try {
                        E.load('');
                    } catch (_) {}
                }
            }

            setTimeout(() => forceTrashVisible('kathgoria_symbashs'), 200);
        };
    }

    if (eidNode) {
        eidNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;

            const eidTS = ts('eidikothta_symbashs');
            const opt = eidTS?.options?.[v] || {};
            const kodikos = opt.kodikos ? String(opt.kodikos).padStart(4, '0') : v;

            if (hid('eidikothta_symbashs')) hid('eidikothta_symbashs').value = kodikos;

            const eidTable = [
                {
                    kodikos,
                    aa: String(opt.aa != null ? opt.aa : opt.id != null ? opt.id : '').trim(),
                    afora_thn_symbash_kathgoria: String(
                        opt.afora_thn_symbash_kathgoria ?? ''
                    ).trim()
                }
            ];
            if (el('eidikothta_symbashs_table'))
                el('eidikothta_symbashs_table').value = JSON.stringify(eidTable);

            // ✅ eidikothta: ήδη locked από dropdown-item.js → βεβαιωνόμαστε
            applyLock('eidikothta_symbashs');

            setTimeout(() => {
                try {
                    window.dispatchEvent(new Event('eidikothtaChanged'));
                } catch (e) {}
            }, 50);

            setTimeout(() => forceTrashVisible('eidikothta_symbashs'), 200);
        };
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🔧 INIT (μετά τα hooks)
     * ═══════════════════════════════════════════════════════════════ */
    const forceInit = (id, url, extraParams) => {
        const node = el(id);
        if (!node) return null;
        if (node.tomselect) node.tomselect.destroy();
        node.removeAttribute('data-has-value');
        return initTomDropdown({ selector: `#${id}`, url, extraParams, minChars: 0 });
    };

    forceInit('symbash', '/api/dropdown/symbaseis/symbash');
    forceInit('kathgoria_symbashs', katUrl, katParams);
    forceInit('eidikothta_symbashs', eidUrl, eidParams);

    /* ═══════════════════════════════════════════════════════════════
     * ✅ IMMEDIATE LOCK — ΠΑΝΤΑ locked αμέσως μετά forceInit
     * ═══════════════════════════════════════════════════════════════ */
    applyLock('kathgoria_symbashs');
    applyLock('eidikothta_symbashs');

    /* ═══════════════════════════════════════════════════════════════
     * 🚀 SAFETY NET — πολλαπλά checkpoints
     * ══════════════════════════���════════════════════════════════════ */
    [400, 800, 1500].forEach((delay) => {
        setTimeout(() => {
            // kathgoria: ΠΑΝΤΑ locked (εκτός αν ο χρήστης πάτησε trash → cascadeFromKat)
            // Αλλά αν έχουμε τρέξει cascadeFromKat, το kathgoria είναι unlocked
            // και ο χρήστης επιλέγει — ΔΕΝ θέλουμε να ξανακλειδώσουμε!
            // → Κλειδώνουμε ΜΟΝΟ αν δεν είμαστε σε active cascade
            if (!window.__katCascadeActive) {
                applyLock('kathgoria_symbashs');
                const K = ts('kathgoria_symbashs');
                if (K?.items?.length) setTimeout(() => forceTrashVisible('kathgoria_symbashs'), 50);
            }

            if (!window.__eidCascadeActive) {
                const E = ts('eidikothta_symbashs');
                if (E && !E.items?.length) {
                    applyLock('eidikothta_symbashs');
                }
                if (E?.items?.length)
                    setTimeout(() => forceTrashVisible('eidikothta_symbashs'), 50);
            }

            forceAllTrashVisible();
            if (delay >= 1500) window.__symbaseisHydrating = false;
        }, delay);
    });

    /* ═══════════════════════════════════════════════════════════════
     * 📤 EXPORT
     * ═══════════════════════════════════════════════════════════════ */
    window.__symbaseisHelpers = {
        el,
        ts,
        hid,
        forceTrashVisible,
        forceAllTrashVisible,
        applyLock,
        applyUnlock,
        cascadeFromSym,
        cascadeFromKat,
        cascadeFromEid
    };
})();
