// /public/js/common/totalPercentChecker.js
document.addEventListener("DOMContentLoaded", function () {
    const inputs = document.querySelectorAll(".percentTotal");

    // --- helpers ---
    function parseEL(v) {
        if (v == null) return 0;
        let s = String(v).trim();
        if (!s) return 0;
        s = s.replace(/\s/g, '');

        const hasComma = s.includes(',');
        const hasDot = s.includes('.');

        if (hasComma && hasDot) {
            const lastComma = s.lastIndexOf(',');
            const lastDot = s. lastIndexOf('.');
            if (lastComma > lastDot) {
                s = s. replace(/\./g, '').replace(',', '.');
            } else {
                s = s. replace(/,/g, '');
            }
        } else if (hasComma) {
            const parts = s.split(',');
            s = parts.length > 2 ? parts.slice(0, -1).join('') + '.' + parts.at(-1)
                                : s. replace(',', '.');
        } else if (hasDot) {
            const parts = s.split('.');
            s = parts. length > 2 ? parts. slice(0, -1).join('') + '.' + parts.at(-1)
                                :  s;
        }

        const n = Number(s);
        return Number.isFinite(n) ? n : 0;
    }

    const formatEL = (n) =>
        Number(n).toLocaleString("el-GR", {
            minimumFractionDigits:  2,
            maximumFractionDigits: 2,
            useGrouping: false,
        });

    function checkTotal() {
        const total = Array.from(inputs).reduce((sum, el) => sum + parseEL(el.value), 0);
        const rounded = Number(total.toFixed(2));

        if (rounded > 100) {
            Swal. fire({
                icon: "warning",
                title: "Λάθος Σύνολο Ποσοστών",
                html: `Το σύνολο των ποσοστών <strong>${formatEL(rounded)}%</strong> δεν μπορεί να είναι μεγαλύτερο του <strong>100,00%</strong>`,
                confirmButtonText: "Κλείσιμο",
                focusConfirm: true,
                allowOutsideClick:  false,
                backdrop: false,
                customClass: {
                    confirmButton: "class-warning custom-confirm-button custom-swal-button",
                    title: "custom-title",
                    popup: "custom-swal-popup",
                },
            });
        }
    }

    inputs.forEach((input) => {
        input.addEventListener("input", checkTotal);

        // ✅ FOCUS: type="text" + auto-select
        input.addEventListener("focus", (e) => {
            const input = e.target;
            const n = parseEL(input. value);
            
            // Αποθήκευση για change event
            input.dataset.valueBeforeFocus = input.value;
            
            // Γίνε text για να δουλέψει το select
            input.  type = "text";
            input.value = Number. isFinite(n) ? String(n) : "";
            
            setTimeout(() => {
                try {
                    input.select();
                } catch (err) {}
            }, 10);
            
            // Validation ενώ πληκτρολογείς
            function validatePercent(event) {
                const inp = event.target;
                const value = inp.value;
                const sanitized = value.replace(/[^0-9.,]/g, '');
                
                if (sanitized !== value) {
                    inp. value = sanitized;
                }
            }
            
            input.addEventListener('input', validatePercent);
            
            // ✅ BLUR:  Μορφοποίηση + επαναφορά type + change event
            function restoreOnBlur(event) {
                const inp = event.target;
                const currentValue = inp.value;
                
                // Parse με υποστήριξη κόμματος
                const n = parseEL(currentValue);
                
                // Μορφοποίηση σε "###0,00"
                const formatted = Number.isFinite(n) ? formatEL(n) : "";
                
                // Επιστροφή σε number (αν δεν έχει κόμμα)
                if (formatted && formatted.includes(",")) {
                    inp.type = "text";
                    inp.value = formatted;
                } else {
                    inp.type = "number";
                    inp.value = formatted. replace(',', '.');
                }
                
                // ✅ Manual change event
                if (inp.dataset.valueBeforeFocus !== inp.value) {
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                // Cleanup
                delete inp.dataset. valueBeforeFocus;
                inp.removeEventListener('input', validatePercent);
                inp.removeEventListener('blur', restoreOnBlur);
            }
            
            input.addEventListener('blur', restoreOnBlur, { once: true });
        });
    });
});