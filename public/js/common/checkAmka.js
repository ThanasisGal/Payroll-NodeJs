// ===== helpers validate =====
function isRealDate(y, m, d) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && (dt.getMonth() + 1) === m && dt.getDate() === d;
}
function ageOn(date, today = new Date()) {
  let a = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) a--;
  return a;
}
function resolveAmkaCentury(dd, mm, yy, { minAge = 0, maxAge = 110, strategy = 'cutoff' } = {}) {
  const now = new Date();
  const currYY = now.getFullYear() % 100;
  const candidates = [1900 + yy, 2000 + yy]
    .filter(Y => isRealDate(Y, mm, dd))
    .map(Y => new Date(Y, mm - 1, dd))
    .filter(dt => {
      const a = ageOn(dt, now);
      return a >= minAge && a <= maxAge && dt <= now;
    });
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  if (strategy === 'prefer2000') return candidates.find(dt => dt.getFullYear() >= 2000) || candidates[0];
  if (strategy === 'prefer1900') return candidates.find(dt => dt.getFullYear() < 2000) || candidates[0];
  const prefer2000 = yy <= currYY; // 'cutoff'
  return candidates.find(dt => (dt.getFullYear() >= 2000) === prefer2000) || candidates[0];
}
function luhnCheck(numStr) {
  let sum = 0, flip = false;
  for (let i = numStr.length - 1; i >= 0; i--) {
    let n = numStr.charCodeAt(i) - 48;
    if (flip) { n *= 2; if (n > 9) n -= 9; }
    sum += n; flip = !flip;
  }
  return sum % 10 === 0;
}
/** @returns {{ok:boolean, reason?:string, birthDate?:Date, gender?:'male'|'female', normalized?:string}} */
function validateAMKA(amka, opts = {}) {
  if (typeof amka !== 'string') return { ok:false, reason:'Μη string' };
  const normalized = amka.replace(/\D+/g, '');
  if (!/^\d{11}$/.test(normalized)) return { ok:false, reason:'Μη 11ψήφιο' };
  const dd = parseInt(normalized.slice(0,2), 10);
  const mm = parseInt(normalized.slice(2,4), 10);
  const yy = parseInt(normalized.slice(4,6), 10);
  const birthDate = resolveAmkaCentury(dd, mm, yy, opts);
  if (!birthDate) return { ok:false, reason:'Άκυρη/ασύμβατη ημ/νία' };
  if (!luhnCheck(normalized)) return { ok:false, reason:'Αποτυγχάνει Luhn' };
  const genderDigit = parseInt(normalized[9], 10);
  const gender = (genderDigit % 2 === 0) ? 'female' : 'male';
  return { ok:true, birthDate, gender, normalized };
}
window.validateAMKA = validateAMKA;

// --- binding για ΦΥΛΟ (mutual exclusive) + γέμισμα Ημ/νίας Γέννησης ---
document.addEventListener('DOMContentLoaded', () => {
  const actionBtn = document.getElementById('downloadBtn');
  // Πιθανές είσοδοι ΑΜΚΑ
  const amkaInputs = Array.from(document.querySelectorAll(
    '#amka_ergazomenoy, #amka_antikatastath, #amka, input[id*="amka" i], input[name*="amka" i]'
  )).filter(el => el.tagName === 'INPUT');
  if (!amkaInputs.length) return;

  // Ημερομηνία γέννησης (type="date")
  const birthInput = document.getElementById('hmeromhnia_gennhshs');

  // Checkboxes φύλου (ΓΥΝΑΙΚΑ / ΑΝΔΡΑΣ)
  const femaleChk = document.getElementById('fylo');     // ΓΥΝΑΙΚΑ
  const maleChk   = document.getElementById('andras');   // ΑΝΔΡΑΣ
  if (!femaleChk && !maleChk) return;

  // Mutual exclusive συμπεριφορά
  if (femaleChk && maleChk) {
    femaleChk.addEventListener('change', () => {
      if (femaleChk.checked) {
        maleChk.checked = false;
        if (typeof toggleCheckboxState === 'function') {
          toggleCheckboxState('andras', false);
          toggleCheckboxState('fylo', true);
        }
        maleChk.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        if (typeof toggleCheckboxState === 'function') toggleCheckboxState('fylo', false);
      }
    });
    maleChk.addEventListener('change', () => {
      if (maleChk.checked) {
        femaleChk.checked = false;
        if (typeof toggleCheckboxState === 'function') {
          toggleCheckboxState('fylo', false);
          toggleCheckboxState('andras', true);
        }
        femaleChk.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        if (typeof toggleCheckboxState === 'function') toggleCheckboxState('andras', false);
      }
    });
  }

  // helper: Date -> "yyyy-mm-dd"
  const toISO = (d) => {
    if (!(d instanceof Date) || isNaN(d)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  // Από το ΑΜΚΑ -> όρισε φύλο + ημερομηνία γέννησης (+trigger age check)
  const setFromAmka = (res) => {
    // φύλο
    const gender = res && res.ok ? res.gender : null;
    const isFemale = gender === 'female';
    const isMale   = gender === 'male';
    if (femaleChk) femaleChk.checked = !!isFemale;
    if (maleChk)   maleChk.checked   = !!isMale;

    if (typeof toggleCheckboxState === 'function') {
      if (femaleChk) toggleCheckboxState('fylo', !!isFemale);
      if (maleChk)   toggleCheckboxState('andras', !!isMale);
    }
    if (femaleChk) femaleChk.dispatchEvent(new Event('change', { bubbles: true }));
    if (maleChk)   maleChk.dispatchEvent(new Event('change', { bubbles: true }));

    // ημερομηνία + trigger change για checkHlikia.js
    if (birthInput) {
      if (res && res.ok && res.birthDate) {
        const iso = toISO(res.birthDate);
        if (birthInput.value !== iso) {
          birthInput.value = iso;
          // 🔔 fire change για να τρέξει το checkHlikia.js (που ακούει change)
          birthInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          // ίδια τιμή; αν θες να εξαναγκάσεις επανυπολογισμό:
          birthInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        if (birthInput.value) {
          birthInput.value = '';
          // 🔔 ενημέρωσε και το ηλικιακό label (θα το καθαρίσει)
          birthInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          birthInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
    // Enable / Disable button ανάλογα με εγκυρότητα
    if (actionBtn) {
      actionBtn.disabled = !(res && res.ok);
    }    
  };

  const updateFromInput = (inp) => {
    const v = (inp.value || '').trim();
    if (!v) { setFromAmka(null); return; }
    const res = validateAMKA(v);
    setFromAmka(res.ok ? res : null);
  };

  // Bind + αρχικό sync
  amkaInputs.forEach(inp => {
    let t;
    inp.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => updateFromInput(inp), 180);
    });
    inp.addEventListener('blur', () => updateFromInput(inp));
    updateFromInput(inp);
  });
});
