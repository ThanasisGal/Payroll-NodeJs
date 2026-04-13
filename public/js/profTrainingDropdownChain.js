// /static/js/dropdowns/profTrainingDropdownChain.js

import { initTomDropdown } from './dropdown-item.js';

(function () {
    if (window.__profTrainingDropdownChainInit) return;
    window.__profTrainingDropdownChainInit = true;

    const el = (id) => document.getElementById(id);
    const ts = (id) => el(id)?.tomselect || null;
    const hid = (id) => el(`${id}_stathera`) || null;

    const enothtaParams = {};
    let userInteracted = false;

    const silentClear = {
        thematiko_pedio: false,
        thematikh_enothta: false,
        foreas_katartishs: false
    };

    const cascadeBusy = {
        thematiko_pedio: false,
        thematikh_enothta: false,
        foreas_katartishs: false
    };

    const reloadSeq = {
        thematikh_enothta: 0,
        foreas_katartishs: 0
    };

    function runSilentClear(id, fn) {
        silentClear[id] = true;
        try {
            fn();
        } finally {
            setTimeout(() => {
                silentClear[id] = false;
            }, 0);
        }
    }

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
     * 🎯 FOCUS / OPEN HELPERS
     * ═══════════════════════════════════════════════════════════════ */
    function focusAndOpen(inst) {
        if (!inst) return;

        setTimeout(() => {
            try {
                inst.focus();
            } catch (_) {}

            const ci = inst.control_input || inst.wrapper?.querySelector('input');
            ci?.focus();

            setTimeout(() => {
                try {
                    inst.open();
                } catch (_) {}
            }, 20);
        }, 20);
    }

    function waitForLoad(inst, timeout = 1200) {
        return new Promise((resolve) => {
            if (!inst) {
                resolve();
                return;
            }

            let done = false;
            let timer = null;

            const finish = () => {
                if (done) return;
                done = true;

                if (timer) clearTimeout(timer);

                try {
                    inst.off('load', onLoad);
                } catch (_) {}

                resolve();
            };

            const onLoad = () => finish();

            try {
                inst.on('load', onLoad);
            } catch (_) {
                resolve();
                return;
            }

            timer = setTimeout(finish, timeout);
        });
    }

    async function reloadTomOptions(id, { focusAfterLoad = false } = {}) {
        const inst = ts(id);
        if (!inst) return 0;

        const seq = (reloadSeq[id] || 0) + 1;
        reloadSeq[id] = seq;

        inst.loadedSearches = {};
        inst.loading = 0;

        try {
            inst.clearOptions();
        } catch (_) {}

        const loadPromise = waitForLoad(inst);

        try {
            inst.load('');
        } catch (_) {}

        await loadPromise;

        if (reloadSeq[id] !== seq) return 0;

        try {
            inst.refreshOptions(false);
        } catch (_) {}

        const count = Object.keys(inst.options || {}).length;

        if (focusAfterLoad) {
            focusAndOpen(inst);

            setTimeout(() => {
                if (reloadSeq[id] !== seq) return;
                try {
                    inst.refreshOptions(true);
                } catch (_) {}
            }, 40);
        }

        return count;
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

        if (id === 'thematiko_pedio') return;

        if (!btn.__cascadeWired) {
            btn.__cascadeWired = true;
            btn.addEventListener(
                'click',
                function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    userInteracted = true;

                    if (id === 'thematikh_enothta') {
                        void cascadeFromEnothta();
                    }

                    if (id === 'foreas_katartishs') {
                        void cascadeFromForeas();
                    }
                },
                true
            );
        }
    }

    function forceAllTrashVisible() {
        ['thematiko_pedio', 'thematikh_enothta', 'foreas_katartishs'].forEach((id) => {
            if (ts(id)?.items?.length) {
                forceTrashVisible(id);
            }
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

        runSilentClear(id, () => {
            try {
                inst.clear(true);
            } catch (_) {}

            try {
                inst.clearOptions();
            } catch (_) {}
        });

        applyLock(id);

        const b = inst.wrapper?.querySelector('.ts-single-reset-btn');
        if (b) {
            b.hidden = true;
            b.style.cssText = '';
            b.__cascadeWired = false;
        }
    }

    function clearDownstreamOfPedio() {
        delete enothtaParams.kodikos_sysxetishs;
        clearHiddenAndLock('thematikh_enothta');
        clearHiddenAndLock('foreas_katartishs');
        syncForeasState();
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🔓 ΦΟΡΕΑΣ — unlock / lock
     * ═══════════════════════════════════════════════════════════════ */
    function syncForeasState() {
        const enothtaVal = hid('thematikh_enothta')?.value?.trim() || '';

        if (enothtaVal) {
            applyUnlock('foreas_katartishs');
            void reloadTomOptions('foreas_katartishs');
        } else {
            clearHiddenAndLock('foreas_katartishs');
        }
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🗑️ CASCADE — Trash Πεδίου
     * ═══════════════════════════════════════════════════════════════ */
    function cascadeFromPedio() {
        if (cascadeBusy.thematiko_pedio) return;
        cascadeBusy.thematiko_pedio = true;

        try {
            if (hid('thematiko_pedio')) hid('thematiko_pedio').value = '';
            el('thematiko_pedio')?.removeAttribute('data-has-value');
            clearDownstreamOfPedio();
        } finally {
            cascadeBusy.thematiko_pedio = false;
        }
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🗑️ CASCADE — Trash Ενότητας
     * ═══════════════════════════════════════════════════════════════ */
    async function cascadeFromEnothta() {
        if (cascadeBusy.thematikh_enothta) return;
        cascadeBusy.thematikh_enothta = true;

        try {
            if (hid('thematikh_enothta')) hid('thematikh_enothta').value = '';
            el('thematikh_enothta')?.removeAttribute('data-has-value');

            const E = ts('thematikh_enothta');
            if (E) {
                applyUnlock('thematikh_enothta');

                runSilentClear('thematikh_enothta', () => {
                    try {
                        E.clear(true);
                    } catch (_) {}

                    try {
                        E.clearOptions();
                    } catch (_) {}
                });

                E.loadedSearches = {};
                E.loading = 0;
                E.wrapper?.classList.remove('ts-locked');
                E.wrapper?.classList.remove('ts-disabled-selected');
            }

            clearHiddenAndLock('foreas_katartishs');

            const curPedio = hid('thematiko_pedio')?.value?.trim() || '';
            if (curPedio) {
                enothtaParams.kodikos_sysxetishs = curPedio;
                await reloadTomOptions('thematikh_enothta', { focusAfterLoad: true });
            } else {
                applyLock('thematikh_enothta');
            }
        } finally {
            cascadeBusy.thematikh_enothta = false;
        }
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🗑️ CASCADE — Trash Φορέα
     * ═══════════════════════════════════════════════════════════════ */
    async function cascadeFromForeas() {
        if (cascadeBusy.foreas_katartishs) return;
        cascadeBusy.foreas_katartishs = true;

        try {
            if (hid('foreas_katartishs')) hid('foreas_katartishs').value = '';
            el('foreas_katartishs')?.removeAttribute('data-has-value');

            const F = ts('foreas_katartishs');
            if (!F) return;

            applyUnlock('foreas_katartishs');

            runSilentClear('foreas_katartishs', () => {
                try {
                    F.clear(true);
                } catch (_) {}

                try {
                    F.clearOptions();
                } catch (_) {}
            });

            F.loadedSearches = {};
            F.loading = 0;
            F.wrapper?.classList.remove('ts-locked');
            F.wrapper?.classList.remove('ts-disabled-selected');

            await reloadTomOptions('foreas_katartishs', { focusAfterLoad: true });
        } finally {
            cascadeBusy.foreas_katartishs = false;
        }
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🔗 __onItemAddChain / __onClearChain HOOKS
     * ═══════════════════════════════════════════════════════════════ */
    const pedioNode = el('thematiko_pedio');
    const enothtaNode = el('thematikh_enothta');
    const foreasNode = el('foreas_katartishs');

    if (pedioNode) {
        pedioNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;

            if (hid('thematiko_pedio')) hid('thematiko_pedio').value = v;
            userInteracted = true;

            if (!window.__profTrainingHydrating) {
                clearDownstreamOfPedio();
                enothtaParams.kodikos_sysxetishs = v;
                applyUnlock('thematikh_enothta');
                void reloadTomOptions('thematikh_enothta', { focusAfterLoad: true });
            } else {
                enothtaParams.kodikos_sysxetishs = v;
                void reloadTomOptions('thematikh_enothta');
            }

            setTimeout(() => forceTrashVisible('thematiko_pedio'), 200);
        };

        pedioNode.__onClearChain = () => {
            if (silentClear.thematiko_pedio) return;
            userInteracted = true;
            cascadeFromPedio();
        };
    }

    if (enothtaNode) {
        enothtaNode.__onItemAddChain = (val) => {
            const v = (val || '').trim();
            if (!v) return;

            if (hid('thematikh_enothta')) hid('thematikh_enothta').value = v;
            userInteracted = true;

            applyLock('thematikh_enothta');
            syncForeasState();

            setTimeout(() => forceTrashVisible('thematikh_enothta'), 200);
        };

        enothtaNode.__onClearChain = () => {
            if (silentClear.thematikh_enothta) return;
            userInteracted = true;
            void cascadeFromEnothta();
        };
    }

    if (foreasNode) {
        foreasNode.__onClearChain = () => {
            if (silentClear.foreas_katartishs) return;
            userInteracted = true;
            void cascadeFromForeas();
        };
    }

    /* ═══════════════════════════════════════════════════════════════
     * 🔧 INIT
     * ═══════════════════════════════════════════════════════════════ */
    const bootPedio = hid('thematiko_pedio')?.value?.trim() || '';
    const bootEnothta = hid('thematikh_enothta')?.value?.trim() || '';

    window.__profTrainingHydrating = !!(bootPedio || bootEnothta);

    if (bootPedio) {
        enothtaParams.kodikos_sysxetishs = bootPedio;
    }

    const forceInit = (id, url, extraParams) => {
        const node = el(id);
        if (!node) return null;

        if (node.tomselect) {
            node.tomselect.destroy();
        }

        node.removeAttribute('data-has-value');

        return initTomDropdown({
            selector: `#${id}`,
            url,
            extraParams,
            minChars: 0
        });
    };

    forceInit('thematiko_pedio', '/api/dropdown/ergazomenoi/thematiko_pedio');
    forceInit('thematikh_enothta', '/api/dropdown/ergazomenoi/thematikh_enothta', enothtaParams);
    forceInit('foreas_katartishs', '/api/dropdown/ergazomenoi/foreas_katartishs');

    /* ═══════════════════════════════════════════════════════════════
     * ✅ IMMEDIATE LOCK
     * ═══════════════════════════════════════════════════════════════ */
    applyLock('thematikh_enothta');
    applyLock('foreas_katartishs');

    /* ═══════════════════════════════════════════════════════════════
     * 🚀 SAFETY NET
     * ═══════════════════════════════════════════════════════════════ */
    [400, 800, 1500].forEach((delay) => {
        setTimeout(() => {
            if (userInteracted) return;

            const instEno = ts('thematikh_enothta');
            if (instEno?.items?.length) {
                applyLock('thematikh_enothta');
                setTimeout(() => forceTrashVisible('thematikh_enothta'), 50);
            } else {
                applyLock('thematikh_enothta');
            }

            syncForeasState();

            const instFor = ts('foreas_katartishs');
            if (instFor?.items?.length) {
                applyLock('foreas_katartishs');
                setTimeout(() => forceTrashVisible('foreas_katartishs'), 50);
            }

            forceAllTrashVisible();

            if (delay >= 1500) {
                window.__profTrainingHydrating = false;
            }
        }, delay);
    });

    /* ═══════════════════════════════════════════════════════════════
     * 📤 EXPORT
     * ═══════════════════════════════════════════════════════════════ */
    window.__profTrainingHelpers = {
        el,
        ts,
        hid,
        applyLock,
        applyUnlock,
        forceTrashVisible,
        forceAllTrashVisible,
        syncForeasState,
        cascadeFromPedio,
        cascadeFromEnothta,
        cascadeFromForeas,
        runSilentClear,
        reloadTomOptions
    };
})();
