// public/js/checkHlikia.js
document.addEventListener('DOMContentLoaded', function () {
  const inputHmeromhniaGennhshs = document.getElementById('hmeromhnia_gennhshs');
  const labelAnhlikos = document.getElementById('label-anhlikos');
  const bibliaInput   = document.getElementById('arithmos_bibliarioy_anhlikoy');

  if (!inputHmeromhniaGennhshs) return;

  function computeAge(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return NaN;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
  }

  function setMinorFieldState(isMinor) {
    if (!bibliaInput) return;

    // enable/disable
    bibliaInput.disabled = !isMinor;
    bibliaInput.setAttribute('aria-disabled', String(!isMinor));

    // required μόνο για ανήλικους
    bibliaInput.required = !!isMinor;
    bibliaInput.setAttribute('aria-required', String(!!isMinor));

    // καθάρισε αν το κλείνεις
    if (!isMinor) {
      bibliaInput.value = '';
      // αφαίρεσε τυχόν validation classes
      bibliaInput.classList.remove('is-invalid', 'is-valid');
    }
  }

  function updateAge() {
    const age = computeAge(inputHmeromhniaGennhshs.value);

    if (isNaN(age)) {
      if (labelAnhlikos) {
        labelAnhlikos.textContent = '';
        labelAnhlikos.classList.remove('label-anhlikos-style');
      }
      setMinorFieldState(false);
      return;
    }

    if (age < 18) {
      if (labelAnhlikos) {
        labelAnhlikos.textContent = 'ΑΝΗΛΙΚΟΣ / Η';
        labelAnhlikos.classList.add('label-anhlikos-style');
      }
      setMinorFieldState(true);
    } else {
      if (labelAnhlikos) {
        labelAnhlikos.textContent = `Ηλικία : ${age} ετών`;
        labelAnhlikos.classList.remove('label-anhlikos-style');
      }
      setMinorFieldState(false);
    }
  }

  // αρχική αξιολόγηση
  updateAge();

  // ενημέρωση σε αλλαγές
  inputHmeromhniaGennhshs.addEventListener('change', updateAge);
  inputHmeromhniaGennhshs.addEventListener('input', updateAge);
});
