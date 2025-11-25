// /js/common/kathestos-apasxolhshs-fulltime-sync.js
(function () {
    const IDS = {
        select:  'kathestos_apasxolhshs',
        hidden:  'kathestos_apasxolhshs_stathera',
        cb:      'plhrhs_apasxolhsh',
        label:   'label-plhrhs_apasxolhsh',
        hours:   'ores_ergasias_ebdomadas',
    };

    const $ = (id) => document.getElementById(id);

    // βρίσκουμε το TomSelect wrapper (div.ts-wrapper)
    function getTsWrapper(sel) {
        if (!sel) return null;
        if (sel.parentElement && sel.parentElement.classList.contains('ts-wrapper')) {
            return sel.parentElement;
        }
        return sel.closest && sel.closest('.ts-wrapper');
    }

    // διαβάζουμε το εμφανιζόμενο κείμενο (π.χ. "0 - ΠΛΗΡΕΣ")
    function getDisplayedText(sel) {
        const wrap = getTsWrapper(sel);
        if (!wrap) return '';
        const item = wrap.querySelector('.ts-control .item');
        return item ? (item.textContent || '').trim() : '';
    }

    // διαβάζουμε "αξιόπιστα" την τιμή: 1) από εμφανιζόμενο κείμενο, 2) tomselect, 3) value, 4) hidden
    function getSelectRaw(sel, hid) {
        const txt = getDisplayedText(sel);
        if (txt) {
            const m = txt.match(/^(\d+)\s*-\s*/);
            if (m) return m[1];
            if (/ΠΛΗΡΕΣ/i.test(txt)) return '0';
        }
        if (sel && sel.tomselect && typeof sel.tomselect.getValue === 'function') {
            const v = sel.tomselect.getValue();
            return String(Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));
        }
        if (sel && sel.value != null && sel.value !== '') return String(sel.value);
        if (hid && hid.value != null) return String(hid.value);
        return '';
    }

    function setCheckboxUI(cb, label, isFull) {
        if (!cb) return;
        cb.checked = isFull;
        if (label) label.textContent = isFull ? 'ΝΑΙ' : 'ΟΧΙ';
    }

    // <-- ΝΕΟ: μηδενισμός ωρών εβδομάδας (υποστηρίζει και TomSelect)
    function zeroWeeklyHours() {
        const hoursEl = $(IDS.hours);
        if (!hoursEl) return;
        if (hoursEl.tomselect && typeof hoursEl.tomselect.setValue === 'function') {
            hoursEl.tomselect.setValue('0', true);
        } else {
            hoursEl.value = '0';
            hoursEl.dispatchEvent(new Event('input', { bubbles: true }));
            hoursEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function wireUp() {
        const sel   = $(IDS.select);
        const hid   = $(IDS.hidden);
        const cb    = $(IDS.cb);
        const label = $(IDS.label);
        if (!sel || !cb) return false;

        // ---- sync από dropdown προς checkbox ----
        let lastRaw = null;
        const sync = () => {
            const raw = getSelectRaw(sel, hid);
            if (raw === lastRaw) return;
            lastRaw = raw;
            const isFull = (String(raw).trim() === '0'); // 0 = ΠΛΗΡΕΣ
            setCheckboxUI(cb, label, isFull);
        };

        setTimeout(sync, 0);

        sel.addEventListener('change', sync);
        sel.addEventListener('input',  sync);
        if (hid) {
            hid.addEventListener('change', sync);
            hid.addEventListener('input',  sync);
        }
        if (sel.tomselect && typeof sel.tomselect.on === 'function') {
            sel.tomselect.on('change', sync);
            sel.tomselect.on('dropdown_close', sync);
            sel.tomselect.on('item_add', sync);
            sel.tomselect.on('item_remove', sync);
        }

        const wrap = getTsWrapper(sel);
        if (wrap) {
            const mo = new MutationObserver(sync);
            mo.observe(wrap, { childList: true, subtree: true, characterData: true });
        }

        const poller = setInterval(sync, 300);

        const killObs = new MutationObserver(() => {
            if (!document.body.contains(sel)) {
                clearInterval(poller);
                killObs.disconnect();
            }
        });
        killObs.observe(document.body, { childList: true, subtree: true });

        // ---- έλεγχος ασυμφωνίας όταν αλλάζει ο χρήστης το checkbox ----
        cb.addEventListener('change', async () => {
            const isFullFromSelect = (getSelectRaw(sel, hid).trim() === '0');
            const isFullFromCb = cb.checked;
            if (isFullFromSelect === isFullFromCb) {
                setCheckboxUI(cb, label, isFullFromCb);
                return;
            }
            if (window.Swal) {
                await Swal.fire({
                    backdrop: false,
                    allowOutsideClick: false,
                    icon: "warning",
                    title: "Ασυμφωνία επιλογών",
                    html: isFullFromCb
                        ? 'Το checkbox Πλήρης Απασχόληση δείχνει <b>ΝΑΙ</b>, αλλά το Καθεστώς Απασχόλησης δεν είναι <b>0 - ΠΛΗΡΗΣ</b>.'
                        : 'Το checkbox Πλήρης Απασχόληση δείχνει <b>ΟΧΙ</b>, αλλά το Καθεστώς Απασχόλησης είναι <b>0 - ΠΛΗΡΗΣ</b>.',
                    showConfirmButton: true,
                    confirmButtonText: "Κλείσιμο",
                    customClass: {
                        confirmButton: "class-warning custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                    },
                });
                // <-- ΝΕΟ: μηδένισε τις ώρες εβδομάδας όταν ενεργοποιηθεί το Swal
                zeroWeeklyHours();
            }

            // επαναφορά ώστε να συμφωνεί με το dropdown
            setCheckboxUI(cb, label, isFullFromSelect);
        });

        return true;
    }

    function init() {
        if (wireUp()) return;
        const obs = new MutationObserver(() => { if (wireUp()) obs.disconnect(); });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
