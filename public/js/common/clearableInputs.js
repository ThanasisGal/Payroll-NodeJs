// document.addEventListener('DOMContentLoaded', () => {
//     document.querySelectorAll('input[type="text"]').forEach(input => {
//         if (input.parentElement?.classList.contains('clearable-wrapper')) return;

//         const wrapper = document.createElement('span');
//         wrapper.className = 'clearable-wrapper';

//         const btn = document.createElement('span');
//         btn.className = 'clear-btn';
//         btn.textContent = '×';
//         btn.setAttribute('aria-label', 'Καθαρισμός πεδίου');
//         btn.setAttribute('role', 'button');

//         input.insertAdjacentElement('beforebegin', wrapper);
//         wrapper.appendChild(input);
//         wrapper.appendChild(btn);

//         const isLocked = () => input.disabled || input.readOnly;

//         const toggle = () => {
//             const visible = !!input.value && !isLocked();
//             btn.classList.toggle('is-visible', visible);
//             btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
//             btn.tabIndex = visible ? 0 : -1;
//             btn.classList.toggle('is-locked', isLocked());
//         };

//         // keep visibility up-to-date
//         toggle();

//         input.addEventListener('input', toggle);
//         input.addEventListener('change', toggle);

//         // ΔΕΝ καθαρίζει αν είναι disabled/readonly
//         btn.addEventListener('click', () => {
//             if (isLocked()) return; 
//             input.value = '';
//             toggle();
//             input.focus();
//             input.dispatchEvent(new Event('input', { bubbles: true }));
//         });

//         btn.addEventListener('keydown', (e) => {
//             if ((e.key === 'Enter' || e.key === ' ') && !isLocked()) {
//                 e.preventDefault();
//                 btn.click();
//             }
//         });

//         // Αν αλλάξει δυναμικά disabled/readonly, ανανέωσε την κατάσταση του Χ
//         const mo = new MutationObserver(toggle);
//         mo.observe(input, { attributes: true, attributeFilter: ['disabled', 'readonly'] });
//     });
// });






document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[type="text"]').forEach(input => {
    if (input.parentElement?.classList.contains('clearable-wrapper')) return;

    const wrapper = document.createElement('span');
    wrapper.className = 'clearable-wrapper';

    const btn = document.createElement('span');
    btn.className = 'clear-btn';
    btn.textContent = '×';
    btn.setAttribute('aria-label', 'Καθαρισμός πεδίου');
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '-1');              // ❗ εκτός tab-order από την αρχή
    btn.tabIndex = -1;

    input.insertAdjacentElement('beforebegin', wrapper);
    wrapper.appendChild(input);
    wrapper.appendChild(btn);

    const isLocked = () => input.disabled || input.readOnly;

    const toggle = () => {
      const visible = !!input.value && !isLocked();
      btn.classList.toggle('is-visible', visible);
      btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
      btn.classList.toggle('is-locked', isLocked());
      // ❌ ΜΗΝ αλλάζεις πια το tabIndex εδώ
    };

    toggle();
    input.addEventListener('input', toggle);
    input.addEventListener('change', toggle);

    // Μην παίρνει focus με click (mouse down → no focus)
    btn.addEventListener('mousedown', e => e.preventDefault());

    // Αν παρ’ όλα αυτά πάρει focus (π.χ. λόγω blur/tab), γύρνα το πίσω στο input
    wrapper.addEventListener('focusin', e => {
      if (e.target === btn) {
        requestAnimationFrame(() => input.focus());
      }
    }, true);

    // Καθαρισμός με click
    btn.addEventListener('click', () => {
      if (isLocked()) return;
      input.value = '';
      toggle();
      input.focus();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Keyboard shortcut πάνω στο input (π.χ. Esc για clear)
    input.addEventListener('keydown', e => {
      if ((e.key === 'Escape' || (e.key === 'Backspace' && e.ctrlKey)) && !isLocked()) {
        e.preventDefault();
        input.value = '';
        toggle();
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // sync αν αλλάξουν disabled/readonly δυναμικά
    const mo = new MutationObserver(toggle);
    mo.observe(input, { attributes: true, attributeFilter: ['disabled', 'readonly'] });
  });
});
