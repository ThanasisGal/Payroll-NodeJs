// public/js/checkHlikia.js

document.addEventListener('DOMContentLoaded', function () {
    const inputHmeromhniaGennhshs = document.getElementById('hmeromhnia_gennhshs');
    const labelAnhlikos = document.getElementById('label-anhlikos');
    const bibliaInput = document.getElementById('arithmos_bibliarioy_anhlikoy');
    const customButtonAnhlikoi = document.getElementById('customButton_anhlikoi');
    const hlikia = document.getElementById('calcAge');
    const calcXrhsh = document.getElementById('calcXrhsh');

    if (!inputHmeromhniaGennhshs) return;

    function computeAge(iso) {
        const d = new Date(iso);

        if (isNaN(d)) return NaN;

        const today = new Date();

        let age = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();

        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
            age--;
        }

        if (calcXrhsh && calcXrhsh.value <= '2025') {
            if (hlikia) hlikia.value = '99';
        } else {
            if (hlikia) {
                if (age < 25) {
                    hlikia.value = '00';
                } else if (age >= 25 && age < 30) {
                    hlikia.value = '01';
                } else if (age >= 30) {
                    hlikia.value = '02';
                }
            }
        }

        return age;
    }

    function setAnhlikoiButtonState(isMinor) {
        if (!customButtonAnhlikoi) return;

        const isViewerLink = customButtonAnhlikoi.tagName.toLowerCase() === 'a';

        if (isViewerLink) {
            customButtonAnhlikoi.style.opacity = '1';
            customButtonAnhlikoi.style.cursor = 'pointer';
            customButtonAnhlikoi.removeAttribute('disabled');
            return;
        }

        customButtonAnhlikoi.disabled = !isMinor;
        customButtonAnhlikoi.style.opacity = isMinor ? '1' : '0.4';
        customButtonAnhlikoi.style.cursor = isMinor ? 'pointer' : 'not-allowed';
    }

    function setMinorFieldState(isMinor) {
        if (bibliaInput) {
            bibliaInput.disabled = !isMinor;
            bibliaInput.setAttribute('aria-disabled', String(!isMinor));

            bibliaInput.required = !!isMinor;
            bibliaInput.setAttribute('aria-required', String(!!isMinor));

            if (!isMinor) {
                bibliaInput.value = '';
                bibliaInput.classList.remove('is-invalid', 'is-valid');
            }
        }

        setAnhlikoiButtonState(isMinor);
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

    updateAge();

    inputHmeromhniaGennhshs.addEventListener('change', updateAge);
    inputHmeromhniaGennhshs.addEventListener('input', updateAge);
});
