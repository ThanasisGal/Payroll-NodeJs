// document.addEventListener('DOMContentLoaded', () => {

//     // βρίσκουμε ΟΛΑ τα input type="text"
//     document.querySelectorAll('input[type="text"]').forEach(input => {
//         if (input.parentElement?.classList.contains('clearable-wrapper')) return;

//         /* --- φτιάχνουμε wrapper & button ---------------------------------- */
//         const wrapper = document.createElement('span');
//         wrapper.className = 'clearable-wrapper';

//         const btn = document.createElement('span');
//         btn.className = 'clear-btn';
//         btn.innerHTML = '&times;';          // HTML entity για το Χ
//         btn.setAttribute('aria-label', 'Καθαρισμός πεδίου');
//         btn.setAttribute('role', 'button');
//         wrapper.appendChild(input.cloneNode(true));  // αντιγράφει το input
//         // wrapper.appendChild(input);
//         wrapper.appendChild(btn);

//         input.replaceWith(wrapper);         // αντικαθιστά το αρχικό input

//         const txt = wrapper.querySelector('input'); // το «καινούργιο» input

//         /* --- helper: δείχνει/κρύβει το Χ ---------------------------------- */
//         const toggle = () => {
//             btn.style.opacity = txt.value ? '1' : '0';
//         };
//         toggle();                           // αρχική κατάσταση

//         /* --- events -------------------------------------------------------- */
//         txt.addEventListener('input', toggle);

//         btn.addEventListener('click', () => {
//             txt.value = '';
//             toggle();
//             txt.focus();                      // κρατάμε το focus στο πεδίο
//             txt.dispatchEvent(new Event('input')); // ενημερώνουμε τυχόν listeners
//         });
//     });
// });
document.addEventListener('DOMContentLoaded', () => {

    // βρίσκουμε ΟΛΑ τα input type="text"
    document.querySelectorAll('input[type="text"]').forEach(input => {
        if (input.parentElement?.classList.contains('clearable-wrapper')) return;

        /* --- φτιάχνουμε wrapper & button ---------------------------------- */
        const wrapper = document.createElement('span');
        wrapper.className = 'clearable-wrapper';

        const btn = document.createElement('span');
        btn.className = 'clear-btn';
        btn.innerHTML = '&times;';          // HTML entity για το Χ
        btn.setAttribute('aria-label', 'Καθαρισμός πεδίου');
        btn.setAttribute('role', 'button');

        // Τοποθετούμε το wrapper πριν το input
        input.insertAdjacentElement('beforebegin', wrapper);

        // Μετακινούμε το input μέσα στο wrapper (όχι clone)
        wrapper.appendChild(input);
        wrapper.appendChild(btn);

        /* --- helper: δείχνει/κρύβει το Χ ---------------------------------- */
        const toggle = () => {
            btn.style.opacity = input.value ? '1' : '0';
        };
        toggle(); // αρχική κατάσταση

        /* --- events -------------------------------------------------------- */
        input.addEventListener('input', toggle);

        btn.addEventListener('click', () => {
            input.value = '';
            toggle();
            input.focus(); // κρατάμε το focus στο πεδίο
            input.dispatchEvent(new Event('input')); // ενημερώνουμε τυχόν listeners
        });
    });
});
