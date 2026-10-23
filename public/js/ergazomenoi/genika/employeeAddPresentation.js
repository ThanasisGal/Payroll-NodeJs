/* Κοινή εμφάνιση Προσθήκης/Διόρθωσης· οι χειριστές ενεργειών παραμένουν ίδιοι. */
(() => {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const page = document.querySelector('.employee-add-page, .employee-edit-page');
        if (!page) return;
        const isEdit = page.classList.contains('employee-edit-page');

        const active = page.querySelector('#energos');
        const activeLabel = page.querySelector('#label-energos');
        const updateRelationshipStatus = () => {
            if (!active) return;
            const departure = page.querySelector('#hmeromhnia_apoxorhshs')?.value;
            active.disabled = Boolean(departure);
            if (departure) active.checked = false;
            if (activeLabel) {
                activeLabel.textContent = active.checked ? 'ΕΝΕΡΓΟΣ' : 'ΑΝΕΝΕΡΓΟΣ';
                activeLabel.classList.toggle('red-text', !active.checked);
            }
        };
        // Empty departure preserves the manual selection, including after reload.
        updateRelationshipStatus();
        const onRelationshipInput = event => {
            if (['energos', 'hmeromhnia_proslhpshs', 'hmeromhnia_apoxorhshs'].includes(event.target.id)) {
                updateRelationshipStatus();
            }
        };
        page.addEventListener('input', onRelationshipInput);
        page.addEventListener('change', onRelationshipInput);

        // Τα νέα πεδία ημερομηνίας κρατούν τον ίδιο κόμβο, τιμή και χειριστές.
        // Χρησιμοποιείται ο υπάρχων καθαρισμός, μαζί με τους ελέγχους κλειδώματός του.
        if (isEdit) {
            const dateObserver = new MutationObserver(records => {
                for (const record of records) for (const node of record.addedNodes) {
                    if (node.nodeType !== 1 || !node.isConnected || !node.closest('.card-body')
                        || node.closest('.ts-wrapper')) continue;
                    if (node.matches('input[type="date"]')) {
                        window.initClearableInputs?.(node.parentElement);
                    } else if (node.querySelector('input[type="date"]')) {
                        window.initClearableInputs?.(node);
                    }
                }
            });
            dateObserver.observe(page, { childList: true, subtree: true });
        }

        // Κοινό πραγματικό εξωτερικό πλάτος αναφοράς, χωρίς αλλαγή στη Γέννηση.
        const dateReference = page.querySelector('#hmeromhnia_gennhshs');
        if (dateReference && page.querySelector('.employee-add-date-pair')) {
            let frame = 0;
            let previousWidth = 0;
            const syncDateWidth = () => {
                frame = 0;
                const width = dateReference.getBoundingClientRect().width;
                // Μια κλειστή καρτέλα/ενότητα δεν πρέπει να μηδενίζει την τελευταία έγκυρη τιμή.
                if (width <= 0 || width === previousWidth) return;
                previousWidth = width;
                page.style.setProperty('--employee-add-date-reference-width', `${width}px`);
            };
            const scheduleDateWidth = () => {
                if (!frame) frame = requestAnimationFrame(syncDateWidth);
            };
            const observer = new ResizeObserver(scheduleDateWidth);
            observer.observe(dateReference);
            syncDateWidth();
        }

        if (!window.Swal) return;
        const fire = window.Swal.fire;
        const classes = (...values) => [...new Set(values.filter(Boolean).join(' ').split(/\s+/))].join(' ');
        const hideOverlay = () => {
            window.AppLoader?.hide();
            if (isEdit) window.hideLoader?.();
        };
        window.Swal.fire = function (options, ...args) {
            // Διατήρηση και της σύνταξης fire(title, text, icon).
            const settings = typeof options === 'object' && options !== null
                ? options : { title: options, text: args[0], icon: args[1] };
            // Οι σύντομες ειδοποιήσεις διατηρούν θέση, μέγεθος και χρονισμό.
            if (settings.toast) return fire.call(this, settings);
            if (String(settings.customClass?.popup || '').split(/\s+/)
                .includes('employee-history-correction-popup')) {
                hideOverlay();
                return fire.call(this, settings);
            }

            hideOverlay();
            // Τα ειδικά παράθυρα (π.χ. PDF) διατηρούν το δηλωμένο πλάτος τους.
            const useConfirmationLayout = settings.width == null;
            const popupClasses = settings.customClass?.popup || 'custom-swal-popup';
            // Το παλιό μέγεθος της Διόρθωσης δεν υπερισχύει της κοινής επιβεβαίωσης.
            const confirmationClasses = isEdit
                ? popupClasses.split(/\s+/).filter(name => name !== 'employee-maintenance-swal').join(' ')
                : popupClasses;
            const result = fire.call(this, {
                ...settings,
                // Η ακύρωση εμφανίζεται μόνο όταν ζητείται από την ίδια την ενέργεια.
                showCancelButton: settings.showCancelButton ?? false,
                cancelButtonText: settings.cancelButtonText == null
                    || /^cancel$/i.test(String(settings.cancelButtonText).trim())
                    ? 'Ακύρωση' : settings.cancelButtonText,
                target: page.closest('main.payroll-form-layout') || document.body,
                heightAuto: false,
                width: settings.width ?? 'min(560px, 100%)',
                customClass: {
                    title: 'custom-title',
                    confirmButton: 'custom-confirm-button custom-swal-button',
                    cancelButton: 'class-secondary custom-cancel-button custom-swal-button',
                    ...settings.customClass,
                    ...(useConfirmationLayout ? {
                        popup: classes(confirmationClasses, 'new-year-confirmation z-depth-5'),
                        container: classes(settings.customClass?.container, 'new-year-confirmation-container')
                    } : {})
                }
            });
            result.then(response => {
                if (response.isDismissed) hideOverlay();
            }, () => {});
            return result;
        };
    }, { once: true });
})();
