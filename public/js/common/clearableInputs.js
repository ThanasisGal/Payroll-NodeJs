document.addEventListener('DOMContentLoaded', () => {

  // βρίσκουμε ΟΛΑ τα input type="text"
  document.querySelectorAll('input[type="text"]').forEach(input => {

    /* --- φτιάχνουμε wrapper & button ---------------------------------- */
    const wrapper = document.createElement('span');
    wrapper.className = 'clearable-wrapper';

    const btn = document.createElement('span');
    btn.className = 'clear-btn';
    btn.innerHTML = '&times;';          // HTML entity για το Χ
    btn.setAttribute('aria-label', 'Καθαρισμός πεδίου');
    btn.setAttribute('role', 'button');
    wrapper.appendChild(input.cloneNode(true));  // αντιγράφει το input
    wrapper.appendChild(btn);

    input.replaceWith(wrapper);         // αντικαθιστά το αρχικό input

    const txt = wrapper.querySelector('input'); // το «καινούργιο» input

    /* --- helper: δείχνει/κρύβει το Χ ---------------------------------- */
    const toggle = () => {
      btn.style.opacity = txt.value ? '1' : '0';
    };
    toggle();                           // αρχική κατάσταση

    /* --- events -------------------------------------------------------- */
    txt.addEventListener('input', toggle);

    btn.addEventListener('click', () => {
      txt.value = '';
      toggle();
      txt.focus();                      // κρατάμε το focus στο πεδίο
      txt.dispatchEvent(new Event('input')); // ενημερώνουμε τυχόν listeners
    });
  });

});
