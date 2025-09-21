// public/js/companies/genikastoixeia/loadDropdowns_edit.js

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

    // === Elements (με ασφάλεια αν λείπει κάτι από το DOM) ===
    const perifereiesSelected = document.getElementById("perifereies");
    const nomoiSelect         = document.getElementById("nomos");
    const dhmoiSelect         = document.getElementById("dhmos");
    const poleisSelect        = document.getElementById("polh");

    if (!perifereiesSelected || !nomoiSelect || !dhmoiSelect || !poleisSelect) {
        console.warn("Λείπουν select elements από το DOM.");
        return;
    }

    const selectedNomosKodikos = document.getElementById("companyNomos")?.value || "";
    const selectedDhmosKodikos = document.getElementById("companyDhmos")?.value || "";
    const selectedPolhKodikos  = document.getElementById("companyPolh")?.value  || "";

    const resetSelect = (el) => { el.innerHTML = '<option value=""></option>'; el.disabled = true; };
    const enableSelect = (el) => { el.disabled = false; };

    // Προαιρετικό: ακύρωση παλιών requests αν αλλάξουν γρήγορα οι επιλογές
    let controllers = { nomoi:null, dhmoi:null, poleis:null };
    const newController = (key) => {
        if (controllers[key]) controllers[key].abort();
        controllers[key] = new AbortController();
        return controllers[key].signal;
    };

    async function loadNomoi(perifereiaKodikos) {
        try {
            if (!perifereiaKodikos) { resetSelect(nomoiSelect); resetSelect(dhmoiSelect); resetSelect(poleisSelect); return; }
            await ensureCsrfToken();

            const url = `/api/loadNomoi/${encodeURIComponent(perifereiaKodikos)}`;
            const response = await apiFetch(url, { signal: newController("nomoi") });
            if (!response.ok) throw new Error("Network response was not ok");

            const nomoiData = await response.json();
            resetSelect(nomoiSelect);
            nomoiData.forEach((nomoi) => {
                const option = new Option(nomoi.perigrafh, nomoi.kodikos);
                if (String(nomoi.kodikos) === String(selectedNomosKodikos)) option.selected = true;
                nomoiSelect.appendChild(option);
            });
            enableSelect(nomoiSelect);

            if (selectedNomosKodikos) {
                await loadDhmoi(selectedNomosKodikos);
            } else {
                resetSelect(dhmoiSelect);
                resetSelect(poleisSelect);
            }
        } catch (error) {
            if (error.name !== "AbortError") console.error("Αποτυχία φόρτωσης των νομών:", error);
        }
    }

    async function loadDhmoi(nomosKodikos) {
        try {
            if (!nomosKodikos) { resetSelect(dhmoiSelect); resetSelect(poleisSelect); return; }
            await ensureCsrfToken();

            const url = `/api/loadDhmoi/${encodeURIComponent(nomosKodikos)}`;
            const response = await apiFetch(url, { signal: newController("dhmoi") });
            if (!response.ok) throw new Error("Network response was not ok");

            const dhmoiData = await response.json();
            resetSelect(dhmoiSelect);
            dhmoiData.forEach((dhmos) => {
                const option = new Option(dhmos.perigrafh, dhmos.kodikos);
                if (String(dhmos.kodikos) === String(selectedDhmosKodikos)) option.selected = true;
                dhmoiSelect.appendChild(option);
            });
            enableSelect(dhmoiSelect);

            if (selectedDhmosKodikos) {
                await loadPoleis(selectedDhmosKodikos);
            } else {
                resetSelect(poleisSelect);
            }
        } catch (error) {
            if (error.name !== "AbortError") console.error("Αποτυχία φόρτωσης των δήμων:", error);
        }
    }

    async function loadPoleis(dhmosKodikos) {
        try {
            if (!dhmosKodikos) { resetSelect(poleisSelect); return; }
            await ensureCsrfToken();

            const url = `/api/loadPoleis/${encodeURIComponent(dhmosKodikos)}`;
            const response = await apiFetch(url, { signal: newController("poleis") });
            if (!response.ok) throw new Error("Network response was not ok");

            const poleisData = await response.json();
            resetSelect(poleisSelect);
            poleisData.forEach((polis) => {
                const option = new Option(polis.perigrafh, polis.kodikos);
                if (String(polis.kodikos) === String(selectedPolhKodikos)) option.selected = true;
                poleisSelect.appendChild(option);
            });
            enableSelect(poleisSelect);
        } catch (error) {
            if (error.name !== "AbortError") console.error("Αποτυχία φόρτωσης των πόλεων:", error);
        }
    }

    // Events
    perifereiesSelected.addEventListener("change", function () { loadNomoi(this.value); });
    nomoiSelect.addEventListener("change", function () { loadDhmoi(this.value); });
    dhmoiSelect.addEventListener("change", function () { loadPoleis(this.value); });

    // Init
    if (perifereiesSelected.value) {
        loadNomoi(perifereiesSelected.value);
    } else {
        resetSelect(nomoiSelect); resetSelect(dhmoiSelect); resetSelect(poleisSelect);
    }
});
