document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tom-dropdown[data-target-input]').forEach(sel => {
        const inp = document.getElementById(sel.dataset.targetInput);
        if (!inp) return;
            sel.addEventListener('change', e => {
            inp.value = e.target.value || '';
        });
    });
});
