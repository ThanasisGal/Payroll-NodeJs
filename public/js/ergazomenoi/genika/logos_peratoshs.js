document.addEventListener('DOMContentLoaded', () => {
    const lhxhInput = document.getElementById('hmeromhnia_lhxhs_symbashs');
    const apoxorhshInput = document.getElementById('hmeromhnia_apoxorhshs');
    const logosSelect = document.getElementById('logos_peratoshs');
    const logosHidden = document.getElementById('logos_peratoshs_stathera');

    function hasValue(el) {
        return !!String(el?.value ?? '').trim();
    }

    function clearLogosPeratoshs() {
        if (logosHidden) logosHidden.value = '';

        if (logosSelect?.tomselect) {
            logosSelect.tomselect.clear(true);
        } else if (logosSelect) {
            logosSelect.value = '';
        }
    }

    function setLogosEnabled(enabled) {
        if (!logosSelect) return;

        if (enabled) {
            if (logosSelect.tomselect) {
                logosSelect.tomselect.enable();
            } else {
                logosSelect.disabled = false;
            }
        } else {
            clearLogosPeratoshs();

            if (logosSelect.tomselect) {
                logosSelect.tomselect.disable();
            } else {
                logosSelect.disabled = true;
            }
        }
    }

    function toggleLogosPeratoshs() {
        const enabled = hasValue(lhxhInput) && hasValue(apoxorhshInput);
        setLogosEnabled(enabled);
    }

    [lhxhInput, apoxorhshInput].forEach((input) => {
        if (!input) return;

        input.addEventListener('input', clearLogosPeratoshs);
        input.addEventListener('change', clearLogosPeratoshs);

        input.addEventListener('input', toggleLogosPeratoshs);
        input.addEventListener('change', toggleLogosPeratoshs);
        input.addEventListener('blur', toggleLogosPeratoshs);
    });

    document.addEventListener('click', (event) => {
        const clearBtn = event.target.closest(
            '.clearInput, .clear-input, [data-clear-input], [data-action="clear-input"]'
        );

        if (!clearBtn) return;

        setTimeout(() => {
            clearLogosPeratoshs();
            toggleLogosPeratoshs();
        }, 0);
    });

    toggleLogosPeratoshs();
});
