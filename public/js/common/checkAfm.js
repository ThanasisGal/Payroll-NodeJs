// public\js\common\checkAfm.js

document.addEventListener("DOMContentLoaded", () => {
    // === CSRF setup ===
    let CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]')?.content || null;

    const ensureCsrfToken = async () => {
        if (CSRF_TOKEN) return;
        const r = await fetch("/api/csrf-token", { credentials: "same-origin" });
        if (!r.ok) throw new Error("CSRF token fetch failed");
        const j = await r.json();
        CSRF_TOKEN = j.csrfToken;
    };

    // JSON helper: πάντα στέλνει CSRF + cookies
    const apiJson = async (url, bodyObj, method = "POST", signal) => {
        await ensureCsrfToken();
        return fetch(url, {
        method,
        credentials: "same-origin",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            ...(CSRF_TOKEN ? { "X-CSRF-Token": CSRF_TOKEN } : {})
        },
        body: method === "GET" ? undefined : JSON.stringify(bodyObj ?? {}),
        signal
        });
    };

    // === Χάρτης πεδίων -> συναρτήσεις ===
    const afmMappings = {
        afm_etaireias:   fetchEtaireiaData,
        afm_ta:          fetchTexnikosAsfaleiasData,
        afm_ia:          fetchIatrosErgasiasData,
        afm_lo:          fetchLogisthsData,
        afm_em_erg:      fetchEmmesosErgodothsData,
        afm_diad_erg:    fetchDiadoxosErgodothsData,
        afm_ergolaboy:   blankFunction,
    };

    // === Debounce + Abort ανά πεδίο (για “γρήγορα” blur) ===
    const timers = {};
    const controllers = {};

    const debounce = (key, fn, delay = 200) => {
        clearTimeout(timers[key]);
        timers[key] = setTimeout(fn, delay);
    };
    const newSignal = (key) => {
        if (controllers[key]) controllers[key].abort();
        const c = new AbortController();
        controllers[key] = c;
        return c.signal;
    };

    // === Wire up listeners ===
    Object.keys(afmMappings).forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (!field) return;

        field.addEventListener("blur", () => {
            debounce(fieldId, async () => {
                const raw = field.value?.trim() || "";
                if (raw === "") return;

                if (!isValidAfmStrict(raw)) {
                    Swal.fire({
                        icon: "warning",
                        title: "Λάθος ΑΦΜ",
                        text: "Πληκτρολογήστε σωστό 9-ψήφιο ΑΦΜ ή αφήστε το πεδίο κενό.",
                        timer: 2500,
                        focusConfirm: true,
                        showConfirmButton: true,
                        confirmButtonText: "Επιστροφή",
                        customClass: {
                        confirmButton: "class-warning custom-confirm-button custom-swal-button",
                        title: "custom-title",
                        popup: "custom-swal-popup",
                        },
                    }).then(() => {
                        field.value = "";
                        field.focus();
                    });
                    return;
                }

                const fn = afmMappings[fieldId];
                try {
                    const signal = newSignal(fieldId);
                    await fn(raw, signal);
                } catch (err) {
                    if (err?.name !== "AbortError") console.error("Σφάλμα:", err);
                }
            });
        });
    });

    // === AFM validation (αυστηρό: 9 ψηφία) ===
    function isValidAfmStrict(value) {
        const v = String(value).trim();
        if (!/^\d{9}$/.test(v)) return false;
        const cd = Number(v[8]);
        const div = [256,128,64,32,16,8,4,2];
        let tot = 0;
        for (let i = 0; i < 8; i++) tot += div[i] * Number(v[i]);
        const rem = tot % 11;
        return (rem % 10) === cd;
    }

    // === API calls (όλες μέσω apiJson) ===

    async function fetchEtaireiaData(afm, signal) {
        const resp = await apiJson("/api/afmEtaireias", { afm }, "POST", signal);
        if (!resp.ok) throw new Error("Σφάλμα κατά την αποστολή αιτήματος");
        const data = await resp.json();
        if (data) {
            // Ασφαλές escaping για HTML
            const esc = (s) => String(s ?? "")
            .trim()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

            const afmTxt   = esc(data.afm);
            const epon     = esc(data.eponymia);
            const first    = esc(data.firstname);

            Swal.fire({
            icon: "error",
            title: "Προσοχή",
            html: `
                Η εταιρεία με ΑΦΜ
                <strong>${afmTxt} (${epon} ${first})</strong>
                είναι ήδη καταχωρημένη. Δεν επιτρέπεται διπλή καταχώρηση ως προς το ΑΦΜ.
            `,
            customClass: {
                confirmButton: "class-normal custom-confirm-button custom-swal-button",
                title: "custom-title",
                popup: "custom-swal-popup",
            },
            confirmButtonText: "Κλείσιμο",
            timer: 4000,
            });
        }
    }

    async function fetchTexnikosAsfaleiasData(afm, signal) {
        const r = await apiJson("/api/texnikosAsfaleias", { afm_ta: afm }, "POST", signal);
        if (!r.ok) return;
        const data = await r.json();
        if (!data) return;

        if (data.aa_kod_ta) document.getElementById("kod_ta").value = data.aa_kod_ta;
        if (data.doc) {
            const d = data.doc;
            assignIfExists("kod_ta", d.kodikos);
            assignIfExists("eponymo_ta", d.eponymo);
            assignIfExists("onoma_ta", d.onoma);
            assignIfExists("dieythynsh_ta", d.dieythynsh);
            assignIfExists("thlefono_ta", d.thlefono);
            assignIfExists("ores_ta", d.ores);
            assignIfExists("ap_katatheshs_ta", d.ap_katatheshs);
            assignIfExists("hmnia_katatheshs_ta", window.formatISODate?.(d.hmnia_katatheshs) ?? d.hmnia_katatheshs);
            assignIfExists("isxyei_eos_ta", window.formatISODate?.(d.isxyei_eos) ?? d.isxyei_eos);
        }
    }

    async function fetchIatrosErgasiasData(afm, signal) {
        const r = await apiJson("/api/iatrosErgasias", { afm_ia: afm }, "POST", signal);
        if (!r.ok) return;
        const data = await r.json();
        if (!data) return;

        if (data.aa_kod_ia) document.getElementById("kod_ia").value = data.aa_kod_ia;
        if (data.doc) {
            const d = data.doc;
            assignIfExists("kod_ia", d.kodikos);
            assignIfExists("eponymo_ia", d.eponymo);
            assignIfExists("onoma_ia", d.onoma);
            assignIfExists("dieythynsh_ia", d.dieythynsh);
            assignIfExists("thlefono_ia", d.thlefono);
            assignIfExists("ores_ia", d.ores);
            assignIfExists("ap_katatheshs_ia", d.ap_katatheshs);
            assignIfExists("hmnia_katatheshs_ia", window.formatISODate?.(d.hmnia_katatheshs) ?? d.hmnia_katatheshs);
            assignIfExists("isxyei_eos_ia", window.formatISODate?.(d.isxyei_eos) ?? d.isxyei_eos);
            // (κρατάς και raw αν χρειάζεται)
            assignIfExists("hmnia_Katatheshs_ia", d.hmnia_katatheshs);
            assignIfExists("isxyei_eos_ia", d.isxyei_eos);
        }
    }

    async function fetchLogisthsData(afm, signal) {
        const r = await apiJson("/api/logisths", { afm_lo: afm }, "POST", signal);
        if (!r.ok) return;
        const data = await r.json();
        if (!data) return;

        if (data.aa_kod_lo) document.getElementById("kod_lo").value = data.aa_kod_lo;
        if (data.doc) {
            const d = data.doc;
            assignIfExists("kod_lo", d.kodikos);
            assignIfExists("eponymo_lo", d.eponymo);
            assignIfExists("onoma_lo", d.onoma);
            assignIfExists("dieythynsh_lo", d.dieythynsh);
            assignIfExists("thlefono_lo", d.thlefono);
            assignIfExists("doy_logisths", d.doy);

            // TomSelect (#doy_accountant) show value with padding
            const selectEl = document.querySelector("#doy_accountant");
            const padLen = Number(selectEl?.dataset.padLength) || 0;
            const ts = window.__tomInstances?.["#doy_accountant"];
            if (ts) {
                const val = String(d.doy ?? "");
                const buildLabel = (v, txt = "") => {
                    const padded = v.padEnd(padLen, " ");
                    const label = `${padded} - ${txt}`.trim();
                    return { value: v, text: label };
                };

                if (val) {
                if (ts.options[val]) {
                    const opt = ts.options[val];
                    if (!opt.text?.startsWith(val.padEnd(padLen, " "))) {
                        opt.text = buildLabel(val, opt.text?.split("-").slice(1).join("-").trim()).text;
                        ts.updateOptions({ [val]: opt });
                        ts.refreshOptions(false);
                    }
                    ts.setValue(val);
                } else {
                    try {
                        const resp = await apiJson(
                            `/api/dropdown/logistes?value=${encodeURIComponent(val)}&padLength=${padLen}`,
                            undefined,
                            "GET",
                            newSignal("ts_doy")
                        );
                        const { items } = resp.ok ? await resp.json() : { items: [] };
                        if (items?.length) {
                            ts.addOption(items[0]);
                            ts.setValue(val);
                        } else {
                            ts.addOption(buildLabel(val));
                            ts.setValue(val);
                        }
                    } catch (e) {
                        if (e?.name !== "AbortError") console.error(e);
                    }
                }
            }
        }

        assignIfExists("arithmos_adeias_lo", d.arithmos_adeias);
        assignIfExists("kathgoria_adeias_lo", d.kathgoria_adeias);
        }
    }

    async function fetchEmmesosErgodothsData(afm, signal) {
        const r = await apiJson("/api/emmesosErgodoths", { afm_em_erg: afm }, "POST", signal);
        if (!r.ok) return;
        const data = await r.json();
        if (!data) return;

        if (data.aa_kod_em_erg) assignIfExists("kod_em_erg", data.aa_kod_em_erg);

        if (data.doc) {
            const d = data.doc;
            // νέα πεδία μπορεί να λείπουν: fallback σε ""
            assignIfExists("daneismos_epa_apo_em_erg", d.daneismosApo ?? "");
            assignIfExists("daneismos_epa_eos_em_erg", d.daneismosEos ?? "");

            assignIfExists("kod_em_erg", d.kodikos);
            assignIfExists("eponymo_em_erg", d.eponymo);
            assignIfExists("onoma_em_erg", d.onoma);
            assignIfExists("dieythynsh_em_erg", d.dieythynsh);
            assignIfExists("thlefono_em_erg", d.thlefono);
            assignIfExists("titlos_em_erg", d.titlos);
            assignIfExists("nomikh_morfh_em_erg", d.nomikhMorfh);
            assignIfExists("drasthriothta_em_erg", d.drasthriothta);
            assignIfExists("email_em_erg", d.email);
        }
    }

    async function fetchDiadoxosErgodothsData(afm, signal) {
        const r = await apiJson("/api/diadoxosErgodoths", { afm_diad_erg: afm }, "POST", signal);
        if (!r.ok) return;
        const data = await r.json();
        if (!data) return;

        if (data.aa_kod_diad_erg) assignIfExists("kod_diad_erg", data.aa_kod_diad_erg);

        if (data.doc) {
            const d = data.doc;
            assignIfExists("kod_diad_erg", d.kodikos);
            assignIfExists("eponymo_diad_erg", d.eponymo);
            assignIfExists("onoma_diad_erg", d.onoma);
            assignIfExists("dieythynsh_diad_erg", d.dieythynsh);
            assignIfExists("thlefono_diad_erg", d.thlefono);
            assignIfExists("titlos_diad_erg", d.titlos);
            assignIfExists("nomikh_morfh_diad_erg", d.nomikhMorfh);
            assignIfExists("drasthriothta_diad_erg", d.drasthriothta);
            assignIfExists("email_diad_erg", d.email);
        }
    }

    async function blankFunction() { /* no-op */ }

    // μικρός helper για ασφαλή setValue
    function assignIfExists(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val ?? "";
    }
});
