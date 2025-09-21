// public\js\companies\genikastoixeia\loadDropdowns_add.js

document.addEventListener("DOMContentLoaded", function () {
    // === CSRF setup ===
    let CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]')?.content || null;
    const ensureCsrfToken = async () => {
        if (CSRF_TOKEN) return;
        const r = await fetch("/api/csrf-token", { credentials: "same-origin" });
        if (!r.ok) throw new Error("CSRF token fetch failed");
        const j = await r.json();
        CSRF_TOKEN = j.csrfToken;
    };

    const apiFetch = (url, options = {}) => {
        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");
        if (CSRF_TOKEN) headers.set("X-CSRF-Token", CSRF_TOKEN);
        return fetch(url, { credentials: "same-origin", ...options, headers });
    };

    // === Elements ===
    const perifereiesDropdown = document.getElementById("perifereies");
    const nomosDropdown       = document.getElementById("nomos");
    const dhmosDropdown       = document.getElementById("dhmos");
    const polhDropdown        = document.getElementById("polh");
    const allUsersDropdown    = document.getElementById("selectedUsers");

    const resetSelect = (el) => { el.innerHTML = '<option value="" selected></option>'; el.disabled = true; };
    const enableSelect = (el) => { el.disabled = false; };

    // Προαιρετικά: ακύρωση προηγούμενων fetch για να αποφεύγεις “γλιστρήματα” επιλογών
    let controllers = { nomoi:null, dhmoi:null, poleis:null, users:null };
    const newController = (key) => {
        if (controllers[key]) controllers[key].abort();
        controllers[key] = new AbortController();
        return controllers[key].signal;
    };

    // === Loaders ===
    const loadPerifereies = async () => {
        resetSelect(perifereiesDropdown);
        try {
            await ensureCsrfToken();
            const response = await apiFetch("/api/perifereies");
            if (!response.ok) throw new Error("Network response was not ok");
            const data = await response.json();
            data.forEach((perifereia) => {
                const option = new Option(perifereia.perigrafh, perifereia.kodikos);
                perifereiesDropdown.appendChild(option);
            });
            enableSelect(perifereiesDropdown);
        } catch (err) {
            console.error("Αποτυχία φόρτωσης περιφερειών:", err);
        }
    };

    perifereiesDropdown.addEventListener("change", async () => {
        const selectedPerifereia = perifereiesDropdown.value;
        resetSelect(nomosDropdown); resetSelect(dhmosDropdown); resetSelect(polhDropdown);

        if (!selectedPerifereia) return;
        try {
            await ensureCsrfToken();
            const url = `/api/nomoi?perifereia=${encodeURIComponent(selectedPerifereia)}`;
            const response = await apiFetch(url, { signal: newController("nomoi") });
            if (!response.ok) throw new Error("Network response was not ok");
            const data = await response.json();
            data.forEach((nomos) => {
                const option = new Option(nomos.perigrafh, nomos.kodikos);
                nomosDropdown.appendChild(option);
            });
            enableSelect(nomosDropdown);
        } catch (err) {
            if (err.name !== "AbortError") console.error("Αποτυχία φόρτωσης νομών:", err);
        }
    });

    nomosDropdown.addEventListener("change", async () => {
        const selectedNomos = nomosDropdown.value;
        resetSelect(dhmosDropdown); resetSelect(polhDropdown);

        if (!selectedNomos) return;
        try {
            await ensureCsrfToken();
            const url = `/api/dhmoi?nomos=${encodeURIComponent(selectedNomos)}`;
            const response = await apiFetch(url, { signal: newController("dhmoi") });
            if (!response.ok) throw new Error("Network response was not ok");
            const data = await response.json();
            data.forEach((dhmos) => {
                const option = new Option(dhmos.perigrafh, dhmos.kodikos);
                dhmosDropdown.appendChild(option);
            });
            enableSelect(dhmosDropdown);
        } catch (err) {
            if (err.name !== "AbortError") console.error("Αποτυχία φόρτωσης δήμων:", err);
        }
    });

    dhmosDropdown.addEventListener("change", async () => {
        const selectedDhmos = dhmosDropdown.value;
        resetSelect(polhDropdown);

        if (!selectedDhmos) return;
        try {
            await ensureCsrfToken();
            const url = `/api/poleis?dhmos=${encodeURIComponent(selectedDhmos)}`;
            const response = await apiFetch(url, { signal: newController("poleis") });
            if (!response.ok) throw new Error("Network response was not ok");
            const data = await response.json();
            data.forEach((polis) => {
                const option = new Option(polis.perigrafh, polis.kodikos);
                polhDropdown.appendChild(option);
            });
            enableSelect(polhDropdown);
        } catch (err) {
            if (err.name !== "AbortError") console.error("Αποτυχία φόρτωσης πόλεων:", err);
        }
    });

    const loadAllUsers = async () => {
        try {
            await ensureCsrfToken();
            const response = await apiFetch("/api/allUser", { signal: newController("users") });
            if (!response.ok) throw new Error("Network response was not ok");
            const data = await response.json();
            // προαιρετικά: καθάρισε πριν γεμίσεις
            allUsersDropdown.innerHTML = "";
            data.forEach((u) => {
                // Χρησιμοποιούμε new Option ώστε να μπει σαν text, όχι HTML
                const option = new Option(`${u.lastName} ${u.firstName}`, u._id);
                allUsersDropdown.appendChild(option);
            });
        } catch (err) {
            if (err.name !== "AbortError") console.error("Αποτυχία φόρτωσης χρηστών:", err);
        }
    };

    // αρχικές φορτώσεις
    loadPerifereies();
    loadAllUsers();
});
