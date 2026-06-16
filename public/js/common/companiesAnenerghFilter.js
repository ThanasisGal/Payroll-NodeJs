document.addEventListener('DOMContentLoaded', function () {
    const checkbox = document.getElementById('anenergh');
    const label = document.getElementById('anenerghLabel');
    const form = document.getElementById('companiesFilterForm');

    if (!checkbox || !label || !form) return;

    let submitting = false;

    function updateAnenerghLabel() {
        if (checkbox.checked) {
            label.textContent = 'ΝΑΙ';
            label.classList.remove('text-success');
            label.classList.add('text-danger');
        } else {
            label.textContent = 'ΟΧΙ';
            label.classList.remove('text-danger');
            label.classList.add('text-success');
        }
    }

    updateAnenerghLabel();

    checkbox.addEventListener('change', function () {
        if (submitting) return;
        submitting = true;

        updateAnenerghLabel();

        if (window.AppLoader && typeof window.AppLoader.show === 'function') {
            window.AppLoader.show('Διαδικασία σε εξέλιξη...');
        }

        requestAnimationFrame(function () {
            setTimeout(function () {
                HTMLFormElement.prototype.submit.call(form);
            }, 80);
        });
    });
});
