// /static/js/dropdowns/geoDropdownChain.js
// Περιφέρεια → Νομός → Δήμος → Πόλη
// Pattern: ίδιο με symbaseisDropdownChain3.js

import { initTomDropdown } from './dropdown-item.js';

(function () {
    if (window.__geoDropdownChainInit) return;
    window.__geoDropdownChainInit = true;

    const el = (id) => document.getElementById(id);
    const ts = (id) => el(id)?.tomselect || null;
    const hid = (id) => el(`${id}_stathera`) || null;

    // mutable extraParams — περνιούνται by reference στο initTomDropdown
    const nomosParams = {};
    const dhmosParams = {};
    const polhParams = {};

    /* ═══════════════════════════════════════════════════════════════
     * 🔐 LOCK / UNLOCK  (ίδιο pattern με symbaseisDropdownChain3)
     * ═══════════════════════════════════��═══════════════════════════ */
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
     * 🗑️ TRASH — force visible even when ts-locked
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

        // perifereia: το native trash του dropdown-item.js αρκεί
        if (id === 'perifereia') return;

        if (!btn.__cascadeWired) {
            btn.__cascadeWired = true;
            btn.addEventListener(
                'click',
                function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    if (id === 'nomos') cascadeFromNomos();
                    if (id === 'dhmos') cascadeFromDhmos();
                    if (id === 'polh') cascadeFromPolh();
                },
                true
            );
        }
    }

    function forceAllTrashVisible() {
        ['perifereia', 'nomos', 'dhmos', 'polh'].forEach((id) => {
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

    function clearDownstreamOfPerifereia() {
        delete nomosParams.perifereia;
        delete dhmosParams.nomos;
        delete polhParams.dhmos;
        ['nomos', 'dhmos', 'polh'].forEach(clearHiddenAndLock);
    }

    function clearDownstreamOfNomos() {
        delete dhmosParams.nomos;
        delete polhParams.dhmos;
        ['dhmos', 'polh'].forEach(clearHiddenAndLock);
    }

    function clearDownstreamOfDhmos() {
        delete polhParams.dhmos;
        ['polh'].forEach(clearHiddenAndLock);
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🗑️ CASCADE ACTIONS (από trash buttons)
     * ═══════════════════════════════════════════════════════════════ */
    function cascadeFromPerifereia() {
        if (hid('perifereia')) hid('perifereia').value = '';
        el('perifereia')?.removeAttribute('data-has-value');
        clearDownstreamOfPerifereia();
        // dropdown-item.js χειρίζεται enable+clear+open για perifereia
    }

    function cascadeFromNomos() {
        clearDownstreamOfNomos();
        applyUnlock('nomos');
        const N = ts('nomos');
        if (N) {
            try {
                N.enable();
            } catch (_) {}
            try {
                N.clear(true);
            } catch (_) {}
            try {
                N.clearOptions();
            } catch (_) {}
            N.wrapper?.classList.remove('ts-locked');
            N.wrapper?.classList.remove('ts-disabled-selected');
            const curPer = hid('perifereia')?.value?.trim() || '';
            if (curPer) {
                nomosParams.perifereia = curPer;
                setTimeout(() => {
                    try {
                        N.load('');
                    } catch (_) {}
                }, 50);
            }
            setTimeout(() => {
                const ci = N.control_input || N.wrapper?.querySelector('input');
                ci?.focus();
                setTimeout(() => {
                    try {
                        N.open();
                    } catch (_) {}
                }, 80);
            }, 100);
        }
    }

    function cascadeFromDhmos() {
        clearDownstreamOfDhmos();
        applyUnlock('dhmos');
        const D = ts('dhmos');
        if (D) {
            try {
                D.enable();
            } catch (_) {}
            try {
                D.clear(true);
            } catch (_) {}
            try {
                D.clearOptions();
            } catch (_) {}
            D.wrapper?.classList.remove('ts-locked');
            D.wrapper?.classList.remove('ts-disabled-selected');
            const curNom = hid('nomos')?.value?.trim() || '';
            if (curNom) {
                dhmosParams.nomos = curNom;
                setTimeout(() => {
                    try {
                        D.load('');
                    } catch (_) {}
                }, 50);
            }
            setTimeout(() => {
                const ci = D.control_input || D.wrapper?.querySelector('input');
                ci?.focus();
                setTimeout(() => {
                    try {
                        D.open();
                    } catch (_) {}
                }, 80);
            }, 100);
        }
    }

    function cascadeFromPolh() {
        if (hid('polh')) hid('polh').value = '';
        if (hid('polh_stathera')) hid('polh_stathera').value = '';
        el('polh')?.removeAttribute('data-has-value');
        applyUnlock('polh');
        const P = ts('polh');
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
            const curDhm = hid('dhmos')?.value?.trim() || '';
            if (curDhm) {
                polhParams.dhmos = curDhm;
                setTimeout(() => {
                    try {
                        P.load('');
                    } catch (_) {}
                }, 50);
            }
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
     * 🔗 __onItemAddChain HOOKS — ορίζονται ΠΡΙΝ το forceInit
     * ═══════════════════════════════════════════════════════════════ */
    const periNode = el('perifereia');
    const nomNode = el('nomos');
    const dhmNode = el('dhmos');
    const polNode = el('polh');

    if (periNode) {
        periNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;
            if (hid('perifereia')) hid('perifereia').value = v;
            nomosParams.perifereia = v;

            if (!window.__geoHydrating) {
                applyUnlock('nomos');
                const N = ts('nomos');
                if (N) {
                    try {
                        N.clearOptions();
                    } catch (_) {}
                    try {
                        N.load('');
                    } catch (_) {}
                }
                setTimeout(() => {
                    const N2 = ts('nomos');
                    if (!N2 || N2.items?.length) return;
                    const ci = N2.control_input || N2.wrapper?.querySelector('input');
                    ci?.focus();
                    setTimeout(() => {
                        try {
                            N2.open();
                        } catch (_) {}
                    }, 120);
                }, 150);
            } else {
                // hydration: φορτώνουμε options, παραμένει locked
                const N = ts('nomos');
                if (N) {
                    try {
                        N.load('');
                    } catch (_) {}
                }
            }
            setTimeout(() => forceTrashVisible('perifereia'), 200);
        };
        periNode.__onClearChain = () => cascadeFromPerifereia();
    }

    if (nomNode) {
        nomNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;
            if (hid('nomos')) hid('nomos').value = v;
            dhmosParams.nomos = v;
            applyLock('nomos');

            if (!window.__geoHydrating) {
                applyUnlock('dhmos');
                const D = ts('dhmos');
                if (D) {
                    try {
                        D.clearOptions();
                    } catch (_) {}
                    try {
                        D.load('');
                    } catch (_) {}
                }
                setTimeout(() => {
                    const D2 = ts('dhmos');
                    if (!D2 || D2.items?.length) return;
                    const ci = D2.control_input || D2.wrapper?.querySelector('input');
                    ci?.focus();
                    setTimeout(() => {
                        try {
                            D2.open();
                        } catch (_) {}
                    }, 120);
                }, 150);
            } else {
                const D = ts('dhmos');
                if (D) {
                    try {
                        D.load('');
                    } catch (_) {}
                }
            }
            setTimeout(() => forceTrashVisible('nomos'), 200);
        };
    }

    if (dhmNode) {
        dhmNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;
            if (hid('dhmos')) hid('dhmos').value = v;
            polhParams.dhmos = v;
            applyLock('dhmos');

            if (!window.__geoHydrating) {
                applyUnlock('polh');
                const P = ts('polh');
                if (P) {
                    try {
                        P.clearOptions();
                    } catch (_) {}
                    try {
                        P.load('');
                    } catch (_) {}
                }
                setTimeout(() => {
                    const P2 = ts('polh');
                    if (!P2 || P2.items?.length) return;
                    const ci = P2.control_input || P2.wrapper?.querySelector('input');
                    ci?.focus();
                    setTimeout(() => {
                        try {
                            P2.open();
                        } catch (_) {}
                    }, 120);
                }, 150);
            } else {
                const P = ts('polh');
                if (P) {
                    try {
                        P.load('');
                    } catch (_) {}
                }
            }
            setTimeout(() => forceTrashVisible('dhmos'), 200);
        };
    }

    if (polNode) {
        polNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;
            if (hid('polh')) hid('polh').value = v;
            applyLock('polh');
            setTimeout(() => forceTrashVisible('polh'), 200);
        };
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🔧 INIT (μετά τα hooks)
     * ═══════════════════════════════════════════════════════════════ */
    const bootPer = hid('perifereia')?.value?.trim() || '';
    const bootNom = hid('nomos')?.value?.trim() || '';
    const bootDhm = hid('dhmos')?.value?.trim() || '';
    const bootPol = hid('polh')?.value?.trim() || '';

    window.__geoHydrating = !!(bootPer || bootNom || bootDhm || bootPol);

    if (bootPer) {
        nomosParams.perifereia = bootPer;
    }
    if (bootNom) {
        dhmosParams.nomos = bootNom;
    }
    if (bootDhm) {
        polhParams.dhmos = bootDhm;
    }

    const forceInit = (id, url, extraParams) => {
        const node = el(id);
        if (!node) return null;
        if (node.tomselect) node.tomselect.destroy();
        node.removeAttribute('data-has-value');
        return initTomDropdown({ selector: `#${id}`, url, extraParams, minChars: 0 });
    };

    forceInit('perifereia', '/api/dropdown/ergazomenoi/perifereia');
    forceInit('nomos', '/api/dropdown/ergazomenoi/nomos', nomosParams);
    forceInit('dhmos', '/api/dropdown/ergazomenoi/dhmos', dhmosParams);
    forceInit('polh', '/api/dropdown/ergazomenoi/polh', polhParams);

    /* ═══════════════════════════════════════════════════════════════
     * ✅ IMMEDIATE LOCK — αμέσως μετά forceInit
     * ═══════════════════════════════════════════════════════════════ */
    applyLock('nomos');
    applyLock('dhmos');
    applyLock('polh');

    /* ═══════════════════════════════════════════════════════════════
     * 🚀 SAFETY NET
     * ═══════════════════════════════════════════════════════════════ */
    [400, 800, 1500].forEach((delay) => {
        setTimeout(() => {
            ['nomos', 'dhmos', 'polh'].forEach((id) => {
                const inst = ts(id);
                if (!inst) return;
                if (inst.items?.length) {
                    applyLock(id);
                    setTimeout(() => forceTrashVisible(id), 50);
                } else {
                    applyLock(id);
                }
            });
            forceAllTrashVisible();
            if (delay >= 1500) window.__geoHydrating = false;
        }, delay);
    });

    /* ═══════════════════════════════════════════════════════════════
     * 📤 EXPORT
     * ═══════════════════════════════════════════════════════════════ */
    window.__geoHelpers = {
        el,
        ts,
        hid,
        applyLock,
        applyUnlock,
        forceTrashVisible,
        forceAllTrashVisible,
        cascadeFromPerifereia,
        cascadeFromNomos,
        cascadeFromDhmos,
        cascadeFromPolh
    };
})();
