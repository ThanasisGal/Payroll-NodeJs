document.addEventListener('DOMContentLoaded', () => {
    const lhxhInput = document.getElementById('hmeromhnia_lhxhs_symbashs');
    const apoxorhshInput = document.getElementById('hmeromhnia_apoxorhshs');
    const logosSection = document.getElementById('logos_peratoshs_section');
    const logosSelect = document.getElementById('logos_peratoshs');
    const logosHidden = document.getElementById('logos_peratoshs_stathera');
    const parathrhseisInput = document.getElementById('parathrhseis_peratosis');

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

    function clearParathrhseisPeratosis() {
        if (parathrhseisInput) parathrhseisInput.value = '';
    }

    function setControlDisabled(control, disabled) {
        if (!control) return;

        if (control.tomselect) {
            if (disabled) {
                control.tomselect.disable();
            } else {
                control.tomselect.enable();
            }
            return;
        }

        control.disabled = disabled;
    }

    function setPeratosisVisible(enabled) {
        if (logosSection) {
            logosSection.style.display = enabled ? '' : 'none';
        }

        setControlDisabled(logosSelect, !enabled);
        setControlDisabled(parathrhseisInput, !enabled);

        if (!enabled) {
            clearLogosPeratoshs();
            clearParathrhseisPeratosis();
        }
    }

    function toggleLogosPeratoshs() {
        const enabled = hasValue(lhxhInput) && hasValue(apoxorhshInput);
        setPeratosisVisible(enabled);
    }

    [lhxhInput, apoxorhshInput].forEach((input) => {
        if (!input) return;

        input.addEventListener('input', () => {
            clearLogosPeratoshs();
            clearParathrhseisPeratosis();
            toggleLogosPeratoshs();
        });

        input.addEventListener('change', () => {
            clearLogosPeratoshs();
            clearParathrhseisPeratosis();
            toggleLogosPeratoshs();
        });

        input.addEventListener('blur', toggleLogosPeratoshs);
    });

    document.addEventListener('click', (event) => {
        const clearBtn = event.target.closest(
            '.clearInput, .clear-input, [data-clear-input], [data-action="clear-input"]'
        );

        if (!clearBtn) return;

        setTimeout(() => {
            clearLogosPeratoshs();
            clearParathrhseisPeratosis();
            toggleLogosPeratoshs();
        }, 0);
    });

    toggleLogosPeratoshs();
});
