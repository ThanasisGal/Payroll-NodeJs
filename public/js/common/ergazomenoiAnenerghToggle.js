(() => {
    'use strict';

    const toggle = document.getElementById('anenergh');
    if (!toggle) return;

    const label = document.getElementById('anenerghLabel');

    const updateLabel = () => {
        if (label) label.textContent = toggle.checked ? 'ΝΑΙ' : 'ΟΧΙ';
    };

    const updateHiddenFields = () => {
        document.querySelectorAll('input[type="hidden"][name="anenergh"]').forEach((input) => {
            input.value = toggle.checked ? 'on' : '';
        });
    };

    updateLabel();
    updateHiddenFields();

    toggle.addEventListener('change', () => {
        updateLabel();
        updateHiddenFields();

        const url = new URL(window.location.href);
        url.searchParams.set('page', '1');

        if (toggle.checked) {
            url.searchParams.set('anenergh', 'on');
        } else {
            url.searchParams.delete('anenergh');
        }

        window.location.href = url.toString();
    });
})();
