// // public/js/ergazomenoi/genika/updateLinkFromTomDropdown.js
// // ✅ Τρέχει ως module → μετά το initTomDropdown
// document.addEventListener('DOMContentLoaded', function () {
//     const sel = document.getElementById('programma_dypa');
//     const btn = document.getElementById('gotoProgrammaDypa');
//     const hid = document.getElementById('link_programma_dypa_stathera');

//     if (!sel || !btn) return;

//     function getUrlFromOption(value) {
//         if (!value) return '';
//         const val = String(value).trim();
//         const ts = sel.tomselect;
//         if (ts?.options) {
//             if (ts.options[val]) return ts.options[val].url_link || '';
//             const found = Object.values(ts.options).find((o) => String(o.value).trim() === val);
//             if (found) return found.url_link || '';
//         }
//         return '';
//     }

//     function updateButton() {
//         const ts = sel.tomselect;
//         const val = String((ts ? ts.getValue() : sel.value) || '').trim();
//         const url = getUrlFromOption(val);
//         const checkbox = document.getElementById('topothethsh_me_programma');
//         const isChecked = checkbox ? checkbox.checked : true;

//         if (hid) hid.value = url;

//         if (url && isChecked) {
//             btn.href = url;
//             btn.classList.remove('disabled');
//             btn.removeAttribute('aria-disabled');
//             btn.style.pointerEvents = 'auto';
//             btn.style.opacity = '1';
//         } else {
//             btn.href = '#';
//             btn.classList.add('disabled');
//             btn.setAttribute('aria-disabled', 'true');
//             btn.style.pointerEvents = 'none';
//             btn.style.opacity = '0.4';
//         }
//     }

//     // ✅ Αναμονή για TomSelect (modules τρέχουν deferred αλλά
//     //    το initTomDropdown μπορεί να καθυστερεί λίγο)
//     let attempts = 0;
//     const wait = setInterval(() => {
//         attempts++;
//         const ts = sel.tomselect;

//         if (ts) {
//             clearInterval(wait);

//             // Events από χρήστη
//             ts.on('change', updateButton);
//             ts.on('item_add', updateButton);
//             ts.on('item_remove', updateButton);
//             ts.on('clear', updateButton);

//             // Checkbox
//             document
//                 .getElementById('topothethsh_me_programma')
//                 ?.addEventListener('change', () => setTimeout(updateButton, 200));

//             // ✅ Monkey-patch setValue (για silent preselect)
//             const _setValue = ts.setValue.bind(ts);
//             ts.setValue = function (value, silent) {
//                 _setValue(value, silent);
//                 setTimeout(updateButton, 0);
//             };

//             // ✅ Polling backup (max 3sec)
//             let p = 0;
//             const poll = setInterval(() => {
//                 const v = String(ts.getValue() || '').trim();
//                 if ((v && ts.options?.[v]?.url_link) || ++p >= 30) {
//                     clearInterval(poll);
//                     updateButton();
//                 }
//             }, 100);
//         } else if (attempts >= 30) {
//             clearInterval(wait);
//         }
//     }, 100);
// });

// public/js/ergazomenoi/genika/updateLinkFromTomDropdown.js
document.addEventListener('DOMContentLoaded', function () {
    const sel = document.getElementById('programma_dypa');
    const btn = document.getElementById('gotoProgrammaDypa');
    const hidLink = document.getElementById('link_programma_dypa_stathera');

    if (!sel || !btn) return;

    function getUrlFromOption(value) {
        if (!value) return '';
        const val = String(value).trim();
        const tomInst = sel.tomselect;
        if (tomInst?.options) {
            if (tomInst.options[val]) return tomInst.options[val].url_link || '';
            const found = Object.values(tomInst.options).find(
                (o) => String(o.value).trim() === val
            );
            if (found) return found.url_link || '';
        }
        return '';
    }

    function updateButton(value) {
        const tomInst = sel.tomselect;
        const val =
            value != null
                ? String(value).trim()
                : String((tomInst ? tomInst.getValue() : sel.value) || '').trim();

        const url = getUrlFromOption(val);
        const checkbox = document.getElementById('topothethsh_me_programma');
        const isChecked = checkbox ? checkbox.checked : true;

        if (hidLink) hidLink.value = url;

        if (url && isChecked) {
            btn.href = url;
            btn.classList.remove('disabled');
            btn.removeAttribute('aria-disabled');
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        } else {
            btn.href = '#';
            btn.classList.add('disabled');
            btn.setAttribute('aria-disabled', 'true');
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.4';
        }
    }

    function clearButton() {
        if (hidLink) hidLink.value = '';
        btn.href = '#';
        btn.classList.add('disabled');
        btn.setAttribute('aria-disabled', 'true');
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.4';
    }

    // ✅ Hook ΠΡΙΝ αρχικοποιηθεί το TomSelect — ώστε να υπάρχει στο __onItemAddChain
    sel.__onItemAddChain = (val) => {
        // Μικρή καθυστέρηση ώστε το options[] να έχει φορτωθεί
        setTimeout(() => updateButton(val), 50);
    };

    sel.__onClearChain = () => {
        clearButton();
    };

    // ✅ Αναμονή για TomSelect (για events + polling backup)
    let attempts = 0;
    const wait = setInterval(() => {
        attempts++;
        const tomInst = sel.tomselect;

        if (tomInst) {
            clearInterval(wait);

            // ✅ item_add: πυροδοτείται ΠΡΙΝ το disable() στο single mode
            tomInst.on('item_add', (val) => {
                setTimeout(() => updateButton(val), 50);
            });

            // clear
            tomInst.on('clear', clearButton);

            // Checkbox
            document
                .getElementById('topothethsh_me_programma')
                ?.addEventListener('change', () => setTimeout(updateButton, 200));

            // ✅ Preselect (edit mode): polling μέχρι να φορτωθεί το option με url_link
            let p = 0;
            const poll = setInterval(() => {
                const v = String(tomInst.getValue() || '').trim();
                if (v && tomInst.options?.[v]?.url_link) {
                    clearInterval(poll);
                    updateButton(v);
                } else if (++p >= 40) {
                    clearInterval(poll);
                    if (v) updateButton(v);
                }
            }, 100);
        } else if (attempts >= 40) {
            clearInterval(wait);
        }
    }, 100);
});
