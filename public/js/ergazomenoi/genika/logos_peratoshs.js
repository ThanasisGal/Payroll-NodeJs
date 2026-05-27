document.addEventListener('DOMContentLoaded', () => {
    const lhxhInput = document.getElementById('hmeromhnia_lhxhs_symbashs');
    const apoxorhshInput = document.getElementById('hmeromhnia_apoxorhshs');
    const logosSelect = document.getElementById('logos_peratoshs');

    function hasValue(el) {
        return !!String(el?.value ?? '').trim();
    }

    function setLogosEnabled(enabled) {
        if (!logosSelect) return;

        if (logosSelect.tomselect) {
            if (enabled) {
                logosSelect.tomselect.enable();
            } else {
                logosSelect.tomselect.clear(true);
                logosSelect.tomselect.disable();
            }
        } else {
            logosSelect.disabled = !enabled;
            if (!enabled) logosSelect.value = '';
        }
    }

    function toggleLogosPeratoshs() {
        const enabled = hasValue(lhxhInput) && hasValue(apoxorhshInput);
        setLogosEnabled(enabled);
    }

    [lhxhInput, apoxorhshInput].forEach((input) => {
        if (!input) return;

        input.addEventListener('input', toggleLogosPeratoshs);
        input.addEventListener('change', toggleLogosPeratoshs);
        input.addEventListener('blur', toggleLogosPeratoshs);
    });

    document.addEventListener('click', (event) => {
        const clearBtn = event.target.closest(
            '.clearInput, .clear-input, [data-clear-input], [data-action="clear-input"]'
        );

        if (!clearBtn) return;

        setTimeout(toggleLogosPeratoshs, 0);
    });

    toggleLogosPeratoshs();
});
