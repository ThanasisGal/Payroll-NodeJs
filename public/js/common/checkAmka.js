// ----------------- helpers -----------------
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
  // 'cutoff': 2000s αν YY <= τρέχον YY, αλλιώς 1900s
  const prefer2000 = yy <= currYY;
  return candidates.find(dt => (dt.getFullYear() >= 2000) === prefer2000) || candidates[0];
}

function luhnCheck(numStr) {
  let sum = 0, flip = false;
  for (let i = numStr.length - 1; i >= 0; i--) {
    let n = numStr.charCodeAt(i) - 48;      // fast parseInt for digits
    if (flip) { n *= 2; if (n > 9) n -= 9; }
    sum += n; flip = !flip;
  }
  return sum % 10 === 0;
}

// ----------------- main -----------------
/**
 * Validate AMKA
 * @param {string} amka - 11 digits
 * @param {{minAge?:number,maxAge?:number,strategy?:'prefer2000'|'prefer1900'|'cutoff'}} [opts]
 * @returns {{ok:boolean, reason?:string, birthDate?:Date, gender?:'male'|'female', normalized?:string}}
 */
function validateAMKA(amka, opts = {}) {
  if (typeof amka !== 'string') return { ok:false, reason:'Μη string' };
  const normalized = amka.replace(/\D+/g, ''); // καθάρισε τυχόν διαχωριστικά
  if (!/^\d{11}$/.test(normalized)) return { ok:false, reason:'Μη 11ψήφιο' };

  const dd = parseInt(normalized.slice(0,2), 10);
  const mm = parseInt(normalized.slice(2,4), 10);
  const yy = parseInt(normalized.slice(4,6), 10);

  const birthDate = resolveAmkaCentury(dd, mm, yy, opts);
  if (!birthDate) return { ok:false, reason:'Άκυρη/ασύμβατη ημ/νία' };

  if (!luhnCheck(normalized)) return { ok:false, reason:'Αποτυγχάνει Luhn' };

  // 10ο ψηφίο (index 9): μονός = άνδρας, ζυγός = γυναίκα
  const genderDigit = parseInt(normalized[9], 10);
  const gender = (genderDigit % 2 === 0) ? 'female' : 'male';

  return { ok:true, birthDate, gender, normalized };
}
