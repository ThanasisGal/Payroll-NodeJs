/* Presentation only: no requests, persistence, or payroll semantics. */
(function () {
    'use strict';
    const THIRD_BREAK_CATEGORIES = new Set(['0004', '0005']);
    // Serialization only. Disabled dependent controls are omitted, never cleared by a visual toggle.
    function serializeEmploymentProfileField(input, payload) {
        if (input.hasAttribute('data-approved-arrangement-control') && input.disabled) return true;
        if (input.name === 'hmeres_efarmoghs_egkekrimenhs_rythmishs') {
            payload[input.name] ||= [];
            if (input.checked && !payload[input.name].includes(Number(input.value))) payload[input.name].push(Number(input.value));
            return true;
        }
        // Durations are always submitted: an unchanged legacy value must also
        // satisfy the currently selected category, without silent clamping.
        return false;
    }
    function updateEmploymentProfileBreak(root) {
        const category = root.getElementById('eidikh_kathgoria_ergazomenoy');
        const alwaysInside = THIRD_BREAK_CATEGORIES.has(category?.value);
        const duration = root.getElementById('dialleima_se_lepta');
        const inside = root.getElementById('dialleima_entos_ektos_orarioy');
        if (inside) {
            inside.disabled = alwaysInside;
            if (alwaysInside) inside.checked = true;
            const label = root.getElementById('label-dialleima_entos_ektos_orarioy');
            if (label) label.textContent = inside.checked ? 'ΕΝΤΟΣ' : 'ΕΚΤΟΣ';
        }
        if (duration) {
            const max = alwaysInside ? 45 : 30;
            duration.max = String(max);
            const n = Number(duration.value);
            duration.setCustomValidity(duration.value === '' || (Number.isInteger(n) && (n === 0 || (n >= 15 && n <= max)))
                ? '' : `Το διάλειμμα πρέπει να είναι 0 ή 15–${max} λεπτά.`);
        }
        return duration;
    }
    function validateEmploymentProfileBreak(root) {
        const duration = updateEmploymentProfileBreak(root);
        return !duration || duration.reportValidity();
    }
    function initEmploymentProfileUi(root) {
        const specialCategory = root.getElementById('eidikh_kathgoria_ergazomenoy');
        if (specialCategory) {
            const thirdBreakInputs = root.querySelectorAll('[data-third-profile-break]');
            function updateBreakIntervalAvailability() {
                thirdBreakInputs.forEach(input => { input.disabled = !THIRD_BREAK_CATEGORIES.has(specialCategory.value); });
            }
            specialCategory.addEventListener('change', updateBreakIntervalAvailability);
            updateBreakIntervalAvailability(); // Also reused by the existing async dropdown change event.
        }
        const duration = root.getElementById('dialleima_se_lepta');
        const inside = root.getElementById('dialleima_entos_ektos_orarioy');
        const updateBreak = () => updateEmploymentProfileBreak(root);
        specialCategory?.addEventListener('change', updateBreak);
        duration?.addEventListener('input', updateBreak);
        inside?.addEventListener('change', updateBreak);
        updateBreak();
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
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { initEmploymentProfileUi, serializeEmploymentProfileField, validateEmploymentProfileBreak };
    if (typeof window !== 'undefined') {
        window.serializeEmploymentProfileField = serializeEmploymentProfileField;
        window.validateEmploymentProfileBreak = validateEmploymentProfileBreak;
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initEmploymentProfileUi(document));
        else initEmploymentProfileUi(document);
    }
})();
