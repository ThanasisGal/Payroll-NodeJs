const reasonText = r => {
  const reasons = {
    'Μη string': 'Άκυρη τιμή.',
    'Μη 11ψήφιο': 'Το ΑΜΚΑ πρέπει να έχει 11 ψηφία.',
    'Άκυρη/ασύμβατη ημ/νία': 'Μη έγκυρη ημερομηνία γέννησης στο ΑΜΚΑ.',
    'Αποτυγχάνει Luhn': 'Άκυρο ΑΜΚΑ (έλεγχος Luhn).'
  };
  return reasons[r] || 'Μη έγκυρο ΑΜΚΑ.';
};

function debounce(fn, wait = 300){
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function enforceDigits(input){
  const cleaned = input.value.replace(/\D+/g,'').slice(0,11);
  if (cleaned !== input.value) input.value = cleaned;
}

function validateAndStyle(input, opts){
  const v = input.value.trim();
  if (!v){ input.classList.remove('is-valid','is-invalid'); return {ok:true, empty:true}; }
  const res = window.validateAMKA(v, opts || {});
  if (!res.ok){
    input.classList.add('is-invalid'); input.classList.remove('is-valid');
    return { ok:false, reason: res.reason };
  }
  input.classList.add('is-valid'); input.classList.remove('is-invalid');
  return { ok:true, res };
}

function attachAmkaField(input, opts, {showPopupOnBlur=true, alertCooldownMs=1200} = {}){
  if (!input) return;
  input.addEventListener('input', () => enforceDigits(input));
  const debouncedValidate = debounce(() => validateAndStyle(input, opts), 300);
  input.addEventListener('input', debouncedValidate);
  input.addEventListener('blur', async () => {
    if (!showPopupOnBlur) { validateAndStyle(input, opts); return; }
    const now = Date.now();
    if (input.__swalOpen || (input.__lastAlertAt && now - input.__lastAlertAt < alertCooldownMs)) return;
    const { ok, reason, empty } = validateAndStyle(input, opts);
    if (empty || ok) return;
    input.__swalOpen = true;
    try{
      await Swal.fire({
        icon: "warning",
        title: "Έλεγχος ΑΜΚΑ",
        text: reasonText(reason),
        confirmButtonText: "Κλείσιμο",
        focusConfirm: true,
        allowOutsideClick: false,
        backdrop: false,
        customClass: {
          confirmButton: "class-warning custom-confirm-button custom-swal-button",
          title: "custom-title",
          popup: "custom-swal-popup",
        },
      });
    } finally {
      input.__swalOpen = false;
      input.__lastAlertAt = Date.now();
      input.focus(); input.select();
    }
  });
}

function attachFormSubmit(form, fields){
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    const errors = [];
    const firstInvalid = [];
    for (const {el, label, opts} of fields){
      enforceDigits(el);
      const { ok, reason, empty } = validateAndStyle(el, opts);
      if (empty){
        errors.push(label + ': Το πεδίο είναι κενό.');
        firstInvalid.push(el);
      } else if (!ok){
        errors.push(label + ': ' + reasonText(reason));
        firstInvalid.push(el);
      }
    }
    if (errors.length){
      e.preventDefault();
      await Swal.fire({
        icon: "error",
        title: "Διορθώστε τα ακόλουθα",
        html: '<ul style="text-align:left;margin:0;padding-left:18px">' + errors.map(x => '<li>' + x + '</li>').join('') + '</ul>',
        confirmButtonText: "Εντάξει",
        allowOutsideClick: false
      });
      const el = firstInvalid[0];
      if (el){ el.focus(); el.select(); }
      return;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const amkaErg = document.getElementById('amka_ergazomenoy');
  const amkaAnt = document.getElementById('amka_antikatastath');
  attachAmkaField(amkaErg, { minAge:15, maxAge:80, strategy:'cutoff' }, { showPopupOnBlur:true });
  attachAmkaField(amkaAnt, { minAge:0,  maxAge:110, strategy:'cutoff' }, { showPopupOnBlur:true });
  const form = document.querySelector('form');
  attachFormSubmit(form, [
    { el: amkaErg, label: 'ΑΜΚΑ εργαζομένου',   opts: { minAge:15, maxAge:80, strategy:'cutoff' } },
    { el: amkaAnt, label: 'ΑΜΚΑ αντικαταστάτη', opts: { minAge:0,  maxAge:110, strategy:'cutoff' } },
  ]);
});
