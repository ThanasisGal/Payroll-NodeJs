/* Presentation only: no requests, persistence, or payroll semantics. */
(function () {
    'use strict';
    function initEmploymentProfileUi(root) {
        const master = root.getElementById('afora_egkekrimenh_rythmish_ergasias');
        if (!master) return;
        const type = root.getElementById('typos_egkekrimenhs_rythmishs');
        const category = root.getElementById('kathgoria_adeias_egkekrimenhs_rythmishs');
        const label = root.getElementById('label-afora_egkekrimenh_rythmish_ergasias');
        const controls = root.querySelectorAll('[data-approved-arrangement-control]');
        function update() {
            controls.forEach(control => { control.disabled = !master.checked; });
            category.disabled = !master.checked || type.selectedOptions[0]?.dataset.leaveCategory !== 'true';
            label.textContent = master.checked ? 'ΝΑΙ' : 'ΟΧΙ';
        }
        master.addEventListener('change', update);
        type.addEventListener('change', update);
        update(); // Never change values or dispatch initialization change events.
        const duration = root.getElementById('dialleima_se_lepta');
        if (duration) duration.addEventListener('input', () => {
            const n = Number(duration.value);
            duration.setCustomValidity(duration.value === '' || (Number.isInteger(n) && (n === 0 || (n >= 15 && n <= 30)))
                ? '' : 'Το διάλειμμα πρέπει να είναι 0 ή 15–30 λεπτά.');
        });
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { initEmploymentProfileUi };
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initEmploymentProfileUi(document));
        else initEmploymentProfileUi(document);
    }
})();
