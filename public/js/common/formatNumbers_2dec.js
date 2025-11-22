(function () {
    const ids = [
        "pososto_apasxolhshs_kk1",
        "pososto_apasxolhshs_kk2",
        "pososto_apasxolhshs_kk3",
        "pososto_apasxolhshs_kk4",
        "poso",
        "pososto",
    ];

    function parseToNumber(str) {
        if (str == null || String(str).trim() === "") return null;
        const normalized = String(str).replace(/\s/g, "").replace(",", ".");
        const n = Number(normalized);
        return Number.isFinite(n) ? n : null;
    }

    function formatEL(n) {
        return n.toLocaleString("el-GR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: false
        });
    }

    function onBlur(e) {
        const el = e.target;
        const num = parseToNumber(el.value);
        
        if (num == null) { 
            el.dataset.raw = "0";
            el.type = "text"; // Αλλαγή σε text πρώτα
            el.value = "0,00"; 
            return; 
        }

        // σεβασμός min/max αν υπάρχουν
        let v = num;
        if (el.min !== "" && !isNaN(+el.min)) v = Math.max(v, +el.min);
        if (el.max !== "" && !isNaN(+el.max)) v = Math.min(v, +el.max);

        // αποθηκεύουμε την "ωμή" τιμή για επεξεργασία στο focus
        el.dataset.raw = String(v);

        // Αλλαγή σε text ΠΡΙΝ την μορφοποίηση
        el.type = "text";
        
        // μορφοποίηση με κόμμα
        el.value = formatEL(v);
    }

    function onFocus(e) {
        const el = e.target;
        // επαναφορά σε number για κανονικό editing
        el.type = "number";
        
        // επαναφορά της ωμής αριθμητικής τιμής (με τελεία)
        const raw = el.dataset.raw;
        if (raw != null) {
            el.value = raw;
        } else if (el.value) {
            const parsed = parseToNumber(el.value);
            if (parsed != null) el.value = String(parsed);
        }
    }

    // δέσιμο events & αρχική μορφοποίηση αν υπάρχουν τιμές
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("blur", onBlur);
        el.addEventListener("focus", onFocus);
        if (el.value) el.dispatchEvent(new Event("blur"));
    });
})();
