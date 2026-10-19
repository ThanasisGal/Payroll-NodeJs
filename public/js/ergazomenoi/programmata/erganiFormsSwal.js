/* Παρουσίαση μόνο για τις έξι φόρμες λήψης/εκτύπωσης ΕΡΓΑΝΗ. */
(function initErganiFormsSwal(global) {
    'use strict';

    const classes = (...values) => [...new Set(values.flatMap(value =>
        String(value || '').split(/\s+/)).filter(Boolean))].join(' ');

    function fire(options = {}) {
        const customClass = options.customClass || {};
        // Ο υπάρχων προβολέας κρατά ακριβώς πλάτος, εργαλεία και callbacks.
        if (String(customClass.popup || '').split(/\s+/).includes('ergani-submitted-pdf-popup')) {
            return global.Swal.fire(options);
        }
        const notice = !options.showCancelButton && !options.showDenyButton &&
            options.showConfirmButton !== false && !options.input &&
            !options.preConfirm && !options.inputValidator;
        const { confirmButton, cancelButton, denyButton, ...nonButtonClasses } = customClass;
        const semanticClass = /(?:^|\s)class-(?:success|error|danger|info|warning|normal)(?:\s|$)/
            .test(String(confirmButton || '')) ? '' : `class-${options.icon || 'normal'}`;

        return global.Swal.fire({
            heightAuto: false,
            ...options,
            ...(notice ? { confirmButtonText: 'Κλείσιμο', showCancelButton: false } : {}),
            customClass: {
                ...nonButtonClasses,
                container: classes('employment-review-swal-container', nonButtonClasses.container),
                popup: classes('custom-swal-popup employment-review-swal-popup', nonButtonClasses.popup),
                title: classes('custom-title', nonButtonClasses.title),
                htmlContainer: classes('custom-html-container employment-review-swal-html-container',
                    nonButtonClasses.htmlContainer),
                ...(options.showConfirmButton !== false ? {
                    confirmButton: classes(confirmButton, semanticClass,
                        'custom-confirm-button custom-swal-button')
                } : {}),
                ...(options.showCancelButton === true ? {
                    cancelButton: classes(cancelButton || 'class-normal',
                        'custom-cancel-button custom-swal-button')
                } : {}),
                ...(options.showDenyButton === true && denyButton ? { denyButton } : {})
            }
        });
    }

    global.ErganiFormsSwal = Object.freeze({ fire });
})(window);
