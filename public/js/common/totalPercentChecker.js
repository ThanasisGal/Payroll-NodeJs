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
            // δεκαδικό = το δεξιότερο από , ή .
            const lastComma = s.lastIndexOf(',');
            const lastDot = s.lastIndexOf('.');
            if (lastComma > lastDot) {
                // κόμμα δεκαδικό → βγάλε τελείες (χιλιάδες), κόμμα→τελεία
                s = s.replace(/\./g, '').replace(',', '.');
            } else {
                // τελεία δεκαδικό → βγάλε κόμματα (χιλιάδες)
                s = s.replace(/,/g, '');
            }
        } else if (hasComma) {
            const parts = s.split(',');
            // αν υπάρχουν πολλά κόμματα: όλα εκτός του τελευταίου είναι χιλιάδες
            s = parts.length > 2 ? parts.slice(0, -1).join('') + '.' + parts.at(-1)
                                : s.replace(',', '.');
        } else if (hasDot) {
            const parts = s.split('.');
            // αν υπάρχουν πολλές τελείες: όλες εκτός της τελευταίας είναι χιλιάδες
            s = parts.length > 2 ? parts.slice(0, -1).join('') + '.' + parts.at(-1)
                                : s; // μία τελεία = δεκαδικό
        }

        const n = Number(s);
        return Number.isFinite(n) ? n : 0;
    }

    const formatEL = (n) =>
        Number(n).toLocaleString("el-GR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: false, // "###0,00"
        });

    function checkTotal() {
        const total =
        Array.from(inputs).reduce((sum, el) => sum + parseEL(el.value), 0);
        const rounded = Number(total.toFixed(2)); // στρογγυλοποίηση στα 2 δεκαδικά

        if (rounded > 100) {
            Swal.fire({
                icon: "warning",
                title: "Λάθος Σύνολο Ποσοστών",
                html: `Το σύνολο των ποσοστών <strong>${formatEL(
                rounded
                )}%</strong> δεν μπορεί να είναι μεγαλύτερο του <strong>100,00%</strong>`,
                confirmButtonText: "Κλείσιμο",
                focusConfirm: true,
                allowOutsideClick: false,
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

        // Προαιρετικά: μορφοποίηση πεδίου στο blur σε "###0,00"
        input.addEventListener("blur", (e) => {
            const n = parseEL(e.target.value);
            e.target.value = n ? formatEL(n) : "";
            // Αν ο browser δεν δέχεται κόμμα σε type=number, γυρνάμε προσωρινά σε text
            if (e.target.type === "number" && e.target.value.includes(",")) {
                e.target.type = "text";
            }
        });

        // Επαναφορά για εύκολη επεξεργασία
        input.addEventListener("focus", (e) => {
            const n = parseEL(e.target.value);
            e.target.type = "number";
            e.target.value = n ? String(n) : "";
        });
    });
});
