// public/js/common/checkAfm.js
// ============================================================================
// Έλεγχος & αναζήτηση στοιχείων με βάση το ΑΦΜ για διάφορα πεδία φόρμας.
// - Εμφάνιση Bootstrap icons (is-valid/is-invalid) + aria-invalid
// - SweetAlert2 για σφάλματα, clear + refocus στο πεδίο
// - CSRF bootstrapping, fetchJson helper, debounce & abort ανά πεδίο
// - Σύνδεση με TomSelect & native <select>, γέμισμα σχετικών πεδίων
// ============================================================================

const debounceTimers = {};
const abortControllers = {};
const activeRequests = {};  // ✅ Track active requests

const debounceByKey = (key, fn, delay = 400) => {  // ✅ Αύξηση σε 400ms
    clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(fn, delay);
};

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================================================
    // CSRF setup
    // ==========================================================================
    let csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || null;

    const ensureCsrfTokenAvailable = async () => {
        if (csrfToken) return;
        const r = await fetch("/api/csrf-token", { credentials: "same-origin" });
        if (!r.ok) throw new Error("CSRF token fetch failed");
        const j = await r.json();
        csrfToken = j.csrfToken;
    };

    // ==========================================================================
    // JSON helper (fetch)
    // ==========================================================================
    const fetchJson = async (url, bodyObj, method = "POST", signal) => {
        await ensureCsrfTokenAvailable();
        try {
            const fetchOptions = {
                method,
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
                },
                body: method === "GET" ? undefined : JSON.stringify(bodyObj ??  {}),
                signal,
            };
            
            const response = await fetch(url, fetchOptions);
            return response;
            
        } catch (error) {
            console.error('❌ fetchJson error:', error);
            throw error;
        }
    };

    // ==========================================================================
    // Map: id πεδίου ΑΦΜ -> handler συνάρτηση που καλεί σωστό API
    // ==========================================================================
    const afmFieldToHandlerMap = {
        afm_etaireias: fetchEtaireiaData,
        afm_ta: fetchTexnikosAsfaleiasData,
        afm_ia: fetchIatrosErgasiasData,
        afm_lo: fetchLogisthsData,
        afm_em_erg: fetchEmmesosErgodothsData,
        afm_diad_erg: fetchDiadoxosErgodothsData,
        afm_ekprosopoy: fetchNomimosEkprosoposData,
        afm_ergolaboy: noOpHandler,

        afm_ergazomenoy: fetchErgazomenoiData,
        afm_antikatastath: noOpHandler,
    };

    // ==========================================================================
    // Debounce & Abort ανά πεδίο
    // ==========================================================================
    const debounceTimers = {};
    const abortControllers = {};

    const debounceByKey = (key, fn, delay = 200) => {
        clearTimeout(debounceTimers[key]);
        debounceTimers[key] = setTimeout(fn, delay);
    };

    const createAbortSignal = (key) => {
        // Αν υπάρχει ήδη active request, μην ξεκινήσεις νέο
        if (activeRequests[key]) {
            throw new Error('Request already in progress');  // ✅ Throw για να σταματήσει
        }
        
        // Ακύρωση παλιού controller (για safety)
        if (abortControllers[key] && !abortControllers[key].signal.aborted) {
            abortControllers[key].abort('Replaced by new request');
        }

        const controller = new AbortController();
        abortControllers[key] = controller;
        activeRequests[key] = true;  // ✅ Mark as active
        
        return controller.signal;
    };

    const cleanupAbortSignal = (key) => {
        delete activeRequests[key];
        delete abortControllers[key];
    };

    // ==========================================================================
    // Βοηθητικά για κουμπιά υποβολής
    // ==========================================================================
    function toggleSaveButtonsDisabled(disabled = true) {
        document.querySelectorAll(".submitButton").forEach((btn) => {
            btn.disabled = !!disabled;
            btn.setAttribute("aria-disabled", disabled ? "true" : "false");
        });
    }
    toggleSaveButtonsDisabled(false);

    const afmRepresentativeInput = document.getElementById("afm_ekprosopoy");
    if (afmRepresentativeInput) {
        afmRepresentativeInput.addEventListener("input", () => toggleSaveButtonsDisabled(false));
    }

    // ==========================================================================
    // Setters για input/selects
    // ==========================================================================
    function setInputValueIfExists(id, value, { keepIfUndefined = false } = {}) {
        const el = document.getElementById(id);
        if (!el) return;
        if (value === undefined || value === null) {
            if (keepIfUndefined) return;
            el.value = "";
        } else {
            el.value = value;
        }
    }

    function applyCheckboxDependencies(checkboxEl, { clearIfDisable = false } = {}) {
        if (!checkboxEl) return;
        const dependents = document.querySelectorAll(`[data-depends-on="${checkboxEl.id}"]`);
        dependents.forEach((el) => {
            const enableIfChecked = (el.dataset.enableIfChecked ?? "true") === "true";
            const shouldEnable = enableIfChecked ? checkboxEl.checked : !checkboxEl.checked;
            el.disabled = !shouldEnable;

            const selector = `#${el.id}`;
            const ts = (window.__tomInstances && window.__tomInstances[selector]) || el.tomselect;
            if (ts) {
                if (shouldEnable) ts.enable();
                else {
                    ts.disable();
                    if (clearIfDisable) {
                        try { ts.clear(true); } catch {}
                    }
                }
            }
        });
    }

    async function setTomSelectByValueOrLabel(selector, valueOrLabel) {
        const el = document.querySelector(selector);
        if (!el) return;

        const padLen = Number(el.dataset?.padLength) || 0;
        const raw = valueOrLabel == null ? "" : String(valueOrLabel).trim();
        const ts = (window.__tomInstances && window.__tomInstances[selector]) || el.tomselect;

        if (!ts) { el.value = raw; return; }
        if (!raw) { try { ts.clear(true); } catch {} return; }

        const valueField = ts.settings?.valueField || "value";
        const labelField = ts.settings?.labelField || "text";
        const normalizeOption = (it) => {
            const v = it?.[valueField] ?? it?.value ?? it?.id ?? raw;
            const t = it?.[labelField] ?? it?.text ?? it?.label ?? String(v);
            return { [valueField]: String(v), [labelField]: String(t) };
        };
        const addAndSelect = (it) => { const n = normalizeOption(it); ts.addOption(n); ts.setValue(n[valueField], true); };

        const padded = raw.length < padLen && /^\d+$/.test(raw) ? raw.padStart(padLen, "0") : raw;
        if (ts.options[padded]) { ts.setValue(padded, true); return; }

        const api = el.dataset.api;
        if (api) {
            try {
                const resp = await fetchJson(`${api}?value=${encodeURIComponent(padded)}&padLength=${padLen}`, undefined, "GET", createAbortSignal(`ts_val_${selector}`));
                const { items = [] } = resp.ok ? await resp.json() : { items: [] };
                if (items.length) { addAndSelect(items[0]); return; }
            } catch {}
            try {
                const resp = await fetchJson(`${api}?q=${encodeURIComponent(raw)}&limit=20&padLength=${padLen}`, undefined, "GET", createAbortSignal(`ts_txt_${selector}`));
                const { items = [] } = resp.ok ? await resp.json() : { items: [] };
                if (items.length) {
                    const norm = (s) => String(s ?? "").toUpperCase().trim();
                    const hit =
                        items.find((it) => norm((it[labelField] ?? it.text ?? it.label)).startsWith(norm(raw))) ||
                        items.find((it) => norm((it[labelField] ?? it.text ?? it.label)) === norm(raw)) ||
                        items[0];
                    addAndSelect(hit); return;
                }
            } catch {}
        }
        ts.addOption({ [valueField]: raw, [labelField]: raw });
        ts.setValue(raw, true);
    }

    async function setTomSelectByValue(selector, value) {
        const el = document.querySelector(selector);
        if (!el) return;

        const padLen = Number(el.dataset?.padLength) || 0;
        const v = value == null ? "" : String(value).padStart(padLen, "0");
        const ts = (window.__tomInstances && window.__tomInstances[selector]) || el.tomselect;

        if (!ts) { el.value = v; return; }
        if (!v) { try { ts.clear(true); } catch {} return; }

        if (ts.options[v]) { ts.setValue(v, true); return; }

        const api = el.dataset.api;
        const url = `${api}?value=${encodeURIComponent(v)}&padLength=${padLen}`;
        try {
            const resp = await fetchJson(url, undefined, "GET", createAbortSignal(`ts_${selector}`));
            const { items } = resp.ok ? await resp.json() : { items: [] };
            if (items?.length) { ts.addOption(items[0]); ts.setValue(v, true); }
            else { ts.addOption({ value: v, text: v }); ts.setValue(v, true); }
        } catch {
            ts.addOption({ value: v, text: v }); ts.setValue(v, true);
        }
    }

    function optionMatches(optionEl, val) {
        const target = String(val ?? "").trim().toUpperCase();
        const byValue = String(optionEl.value ?? "").trim().toUpperCase() === target;
        const label = String(optionEl.text ?? "").trim().toUpperCase();
        const byText = label === target || label.startsWith(target);
        return byValue || byText;
    }
    function selectHasOption(selectEl, val) {
        return Array.from(selectEl.options).some((o) => optionMatches(o, val));
    }
    function waitForOption(selectEl, val, timeoutMs = 5000) {
        return new Promise((resolve) => {
            if (selectHasOption(selectEl, val)) return resolve(true);
            let finished = false;
            const finish = (ok) => { if (!finished) { finished = true; observer?.disconnect(); clearTimeout(to); resolve(ok); } };
            const observer = new MutationObserver(() => { if (selectHasOption(selectEl, val)) finish(true); });
            observer.observe(selectEl, { childList: true, subtree: true });
            const to = setTimeout(() => finish(false), timeoutMs);
        });
    }
    async function setNativeSelectAndTriggerChange(id, val, { disableIfEmpty = true } = {}) {
        const el = document.getElementById(id);
        if (!el) return;

        if (val == null || val === "") {
            el.value = "";
            if (disableIfEmpty) el.disabled = true;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            return;
        }
        el.disabled = false;
        if (!selectHasOption(el, val)) { await waitForOption(el, val, 5000); }
        const opt = Array.from(el.options).find((o) => optionMatches(o, val));
        if (opt) el.value = opt.value;
        else el.add(new Option(String(val), String(val), true, true));
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // ==========================================================================
    // Helpers εμφάνισης (icons + aria)
    // ==========================================================================
    const resetAfmState = (el) => {
        el.classList.remove("is-valid", "is-invalid");
        el.removeAttribute("aria-invalid");
    };

    const setAfmOK = (el) => {
        el.classList.remove("is-invalid");
        el.classList.add("is-valid");
        el.setAttribute("aria-invalid", "false");
    };

    const setAfmError = (el) => {
        el.classList.remove("is-valid");
        el.classList.add("is-invalid");
        el.setAttribute("aria-invalid", "true");
    };

    // ==========================================================================
    // Wire up listeners (blur σε όλα τα πεδία ΑΦΜ που υπάρχουν στη σελίδα)
    // ==========================================================================
    Object.keys(afmFieldToHandlerMap).forEach((fieldId) => {
        const inputEl = document.getElementById(fieldId);
        if (!inputEl) return;

        inputEl.classList.add("form-control");

        // live “ήσυχος” έλεγχος για outline (χωρίς popups)
        let t;
        inputEl.addEventListener("input", () => {
            clearTimeout(t);
            t = setTimeout(() => {
                const raw = (inputEl.value || "").trim();
                if (!raw) return resetAfmState(inputEl);
                const onlyDigits = raw.replace(/\D/g, "");
                if (onlyDigits !== raw) inputEl.value = onlyDigits;
                isValidAfm9Digits(onlyDigits) ? setAfmOK(inputEl) : setAfmError(inputEl);
            }, 220);
        });

        // τελικός έλεγχος στο blur (με SweetAlert + refocus)
        //     inputEl.addEventListener("blur", () => {
        //         debounceByKey(fieldId, async () => {
        //             let rawValue = inputEl.value?.trim() || "";
        //             if (rawValue === "") { resetAfmState(inputEl); return; }

        //             const onlyDigits = rawValue.replace(/\D/g, "");
        //             if (onlyDigits !== rawValue) { inputEl.value = onlyDigits; rawValue = onlyDigits; }

        //             if (!isValidAfm9Digits(rawValue)) {
        //                 setAfmError(inputEl);

        //                 // guard: μην ξανατρέξεις αν είναι ήδη ανοιχτό alert για αυτό το input
        //                 if (inputEl.__swalOpen) return;
        //                 inputEl.__swalOpen = true;

        //                 try {
        //                     await Swal.fire({
        //                         icon: "warning",
        //                         title: "Λάθος ΑΦΜ",
        //                         text: "Πληκτρολογήστε σωστό 9-ψήφιο ΑΦΜ ή αφήστε το πεδίο κενό.",
        //                         showConfirmButton: true,
        //                         confirmButtonText: "Κλείσιμο",
        //                         backdrop: false,
        //                         allowOutsideClick: false,
        //                         focusConfirm: true,
        //                         returnFocus: false,             // μην κάνει auto-return focus το Swal
        //                         didClose: () => {
        //                             // δώσε εσύ πίσω το focus στο ΑΦΜ, σε microtask/next tick
        //                             setTimeout(() => { 
        //                             inputEl.focus();
        //                             inputEl.select();
        //                             }, 0);
        //                         },
        //                         customClass: {
        //                             confirmButton: "class-warning custom-confirm-button custom-swal-button",
        //                             title: "custom-title",
        //                             popup: "custom-swal-popup",
        //                         },
        //                     });
        //                 } finally {
        //                     inputEl.value = "";
        //                     resetAfmState(inputEl);
        //                     inputEl.__swalOpen = false;
        //                 }
        //                 return;
        //             } else {
        //                 setAfmOK(inputEl);
        //             }

        //             // Κλήση του κατάλληλου handler (API, γέμισμα πεδίων κ.λπ.)
        //             const handler = afmFieldToHandlerMap[fieldId];
        //             try {
        //                 const signal = createAbortSignal(fieldId);
        //                 await handler(rawValue, signal);
        //             } catch (err) {
        //                 if (err?.name !== "AbortError") console.error("Σφάλμα:", err);
        //             }
        //         });
        //     });

        inputEl.addEventListener("blur", () => {
            debounceByKey(fieldId, async () => {
                let rawValue = inputEl.value?. trim() || "";
                if (rawValue === "") { 
                    resetAfmState(inputEl); 
                    return; 
                }

                const onlyDigits = rawValue.replace(/\D/g, "");
                if (onlyDigits !== rawValue) { 
                    inputEl.value = onlyDigits; 
                    rawValue = onlyDigits; 
                }

                if (!isValidAfm9Digits(rawValue)) {
                    setAfmError(inputEl);

                    // guard: μην ξανατρέξεις αν είναι ήδη ανοιχτό alert για αυτό το input
                    if (inputEl.__swalOpen) return;
                    inputEl.__swalOpen = true;

                    try {
                        await Swal.fire({
                            icon: "warning",
                            title: "Λάθος ΑΦΜ",
                            text: "Πληκτρολογήστε σωστό 9-ψήφιο ΑΦΜ ή αφήστε το πεδίο κενό.",
                            showConfirmButton: true,
                            confirmButtonText: "Κλείσιμο",
                            backdrop: false,
                            allowOutsideClick: false,
                            focusConfirm: true,
                            returnFocus: false,             // μην κάνει auto-return focus το Swal
                            didClose: () => {
                                // δώσε εσύ πίσω το focus στο ΑΦΜ, σε microtask/next tick
                                setTimeout(() => { 
                                inputEl.focus();
                                inputEl.select();
                                }, 0);
                            },
                            customClass: {
                                confirmButton: "class-warning custom-confirm-button custom-swal-button",
                                title: "custom-title",
                                popup: "custom-swal-popup",
                            },
                        });
                    } finally {
                        inputEl.value = "";
                        resetAfmState(inputEl);
                        inputEl.__swalOpen = false;
                    }
                    return;
                } else {
                    setAfmOK(inputEl);
                }

                // Κλήση του κατάλληλου handler
                const handler = afmFieldToHandlerMap[fieldId];

                try {
                    const signal = createAbortSignal(fieldId);
                    await handler(rawValue, signal);
                } catch (err) {
                    if (err?.message === 'Request already in progress') {
                        return;  // ✅ Αγνόησε το duplicate
                    }
                    if (err?.name !== "AbortError") {
                        console.error("Σφάλμα:", err);
                    }
                }
            }, 100);  // ✅ 100ms debounce
        });        
    });

    // ==========================================================================
    // Έλεγχος εγκυρότητας ΑΦΜ (9 ψηφία + checksum mod 11)
    // ==========================================================================
    function isValidAfm9Digits(value) {
        const v = String(value).trim();
        if (!/^\d{9}$/.test(v)) return false;
        const checkDigit = Number(v[8]);
        const weights = [256, 128, 64, 32, 16, 8, 4, 2];
        let sum = 0;
        for (let i = 0; i < 8; i++) sum += weights[i] * Number(v[i]);
        const rem = sum % 11;
        return rem % 10 === checkDigit;
    }

    // ==========================================================================
    // API calls (όλες μέσω fetchJson)
    // ==========================================================================

    async function fetchEtaireiaData(afm, signal) {
        const resp = await fetchJson("/api/afmEtaireias", { afm }, "POST", signal);
        if (!resp.ok) throw new Error("Σφάλμα κατά την αποστολή αιτήματος");
        const data = await resp.json();
        if (data) {
            const esc = (s) =>
                String(s ?? "")
                .trim()
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
            const afmTxt = esc(data.afm);
            const epon = esc(data.eponymia);
            const first = esc(data.firstname);

            Swal.fire({
                icon: "error",
                title: "Προσοχή",
                html: `Η εταιρεία με ΑΦΜ <strong>${afmTxt} (${epon} ${first})</strong> είναι ήδη καταχωρημένη. Δεν επιτρέπεται διπλή, ως προς το ΑΦΜ, καταχώρηση.`,
                backdrop: false,
                allowOutsideClick: false,
                customClass: {
                confirmButton: "class-normal custom-confirm-button custom-swal-button",
                title: "custom-title",
                popup: "custom-swal-popup",
                },
                confirmButtonText: "Κλείσιμο",
            });
        }
    }

    async function fetchTexnikosAsfaleiasData(afm, signal) {
        const r = await fetchJson("/api/texnikosAsfaleias", { afm_ta: afm }, "POST", signal);
        if (!r.ok) return;
        const data = await r.json();
        if (!data) return;

        if (data.aa_kod_ta) setInputValueIfExists("kod_ta", data.aa_kod_ta);
        if (data.doc) {
            const d = data.doc;
            setInputValueIfExists("kod_ta", d.kodikos);
            setInputValueIfExists("eponymo_ta", d.eponymo);
            setInputValueIfExists("onoma_ta", d.onoma);
            setInputValueIfExists("dieythynsh_ta", d.dieythynsh);
            setInputValueIfExists("thlefono_ta", d.thlefono);
            setInputValueIfExists("ores_ta", d.ores);
            setInputValueIfExists("ap_katatheshs_ta", d.ap_katatheshs);
            setInputValueIfExists("hmnia_katatheshs_ta", window.formatISODate?.(d.hmnia_katatheshs) ?? d.hmnia_katatheshs);
            setInputValueIfExists("isxyei_eos_ta", window.formatISODate?.(d.isxyei_eos) ?? d.isxyei_eos);
        }
    }

    async function fetchIatrosErgasiasData(afm, signal) {
        const r = await fetchJson("/api/iatrosErgasias", { afm_ia: afm }, "POST", signal);
        if (!r.ok) return;
        const data = await r.json();
        if (!data) return;

        if (data.aa_kod_ia) setInputValueIfExists("kod_ia", data.aa_kod_ia);
        if (data.doc) {
            const d = data.doc;
            setInputValueIfExists("kod_ia", d.kodikos);
            setInputValueIfExists("eponymo_ia", d.eponymo);
            setInputValueIfExists("onoma_ia", d.onoma);
            setInputValueIfExists("dieythynsh_ia", d.dieythynsh);
            setInputValueIfExists("thlefono_ia", d.thlefono);
            setInputValueIfExists("ores_ia", d.ores);
            setInputValueIfExists("ap_katatheshs_ia", d.ap_katatheshs);
            setInputValueIfExists("hmnia_katatheshs_ia", window.formatISODate?.(d.hmnia_katatheshs) ?? d.hmnia_katatheshs);
            setInputValueIfExists("isxyei_eos_ia", window.formatISODate?.(d.isxyei_eos) ?? d.isxyei_eos);
            setInputValueIfExists("hmnia_Katatheshs_ia", d.hmnia_katatheshs);
            setInputValueIfExists("isxyei_eos_ia", d.isxyei_eos);
        }
    }

    async function fetchLogisthsData(afm, signal) {
        const r = await fetchJson("/api/logisths", { afm_lo: afm }, "POST", signal);
        if (!r.ok) return;
        const data = await r.json();
        if (!data) return;

        if (data.aa_kod_lo) setInputValueIfExists("kod_lo", data.aa_kod_lo);
        if (data.doc) {
            const d = data.doc;
            setInputValueIfExists("kod_lo", d.kodikos);
            setInputValueIfExists("eponymo_lo", d.eponymo);
            setInputValueIfExists("onoma_lo", d.onoma);
            setInputValueIfExists("dieythynsh_lo", d.dieythynsh);
            setInputValueIfExists("thlefono_lo", d.thlefono);
            setInputValueIfExists("doy_logisths", d.doy);

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
                            ts.updateOptions({ [val]: opt }); ts.refreshOptions(false);
                        }
                        ts.setValue(val);
                    } else {
                        try {
                            const resp = await fetchJson(`/api/dropdown/logistes?value=${encodeURIComponent(val)}&padLength=${padLen}`, undefined, "GET", createAbortSignal("ts_doy"));
                            const { items } = resp.ok ? await resp.json() : { items: [] };
                            if (items?.length) { ts.addOption(items[0]); ts.setValue(val); }
                            else { ts.addOption(buildLabel(val)); ts.setValue(val); }
                        } catch (e) { if (e?.name !== "AbortError") console.error(e); }
                    }
                }
            }
            setInputValueIfExists("arithmos_adeias_lo", d.arithmos_adeias);
            setInputValueIfExists("kathgoria_adeias_lo", d.kathgoria_adeias);
        }
    }

    async function fetchEmmesosErgodothsData(afm, signal) {
        const r = await fetchJson("/api/emmesosErgodoths", { afm_em_erg: afm }, "POST", signal);
        if (!r.ok) return;
        const data = await r.json();
        if (!data) return;

        if (data.aa_kod_em_erg) setInputValueIfExists("kod_em_erg", data.aa_kod_em_erg);
        if (data.doc) {
            const d = data.doc;
            setInputValueIfExists("daneismos_epa_apo_em_erg", d.daneismosApo ?? "");
            setInputValueIfExists("daneismos_epa_eos_em_erg", d.daneismosEos ?? "");
            setInputValueIfExists("kod_em_erg", d.kodikos);
            setInputValueIfExists("eponymo_em_erg", d.eponymo);
            setInputValueIfExists("onoma_em_erg", d.onoma);
            setInputValueIfExists("dieythynsh_em_erg", d.dieythynsh);
            setInputValueIfExists("thlefono_em_erg", d.thlefono);
            setInputValueIfExists("titlos_em_erg", d.titlos);
            setInputValueIfExists("nomikh_morfh_em_erg", d.nomikhMorfh);
            setInputValueIfExists("drasthriothta_em_erg", d.drasthriothta);
            setInputValueIfExists("email_em_erg", d.email);
        }
    }

    async function fetchDiadoxosErgodothsData(afm, signal) {
        const r = await fetchJson("/api/diadoxosErgodoths", { afm_diad_erg: afm }, "POST", signal);
        if (!r.ok) return;
        const data = await r.json();
        if (!data) return;

        if (data.aa_kod_diad_erg) setInputValueIfExists("kod_diad_erg", data.aa_kod_diad_erg);
        if (data.doc) {
            const d = data.doc;
            setInputValueIfExists("kod_diad_erg", d.kodikos);
            setInputValueIfExists("eponymo_diad_erg", d.eponymo);
            setInputValueIfExists("onoma_diad_erg", d.onoma);
            setInputValueIfExists("dieythynsh_diad_erg", d.dieythynsh);
            setInputValueIfExists("thlefono_diad_erg", d.thlefono);
            setInputValueIfExists("titlos_diad_erg", d.titlos);
            setInputValueIfExists("nomikh_morfh_diad_erg", d.nomikhMorfh);
            setInputValueIfExists("drasthriothta_diad_erg", d.drasthriothta);
            setInputValueIfExists("email_diad_erg", d.email);
        }
    }

    // ------------------ ΝΟΜΙΜΟΣ ΕΚΠΡΟΣΩΠΟΣ ------------------
    async function fetchNomimosEkprosoposData(afm, signal) {
        const r = await fetchJson("/companies/api/nomimosEkprosopos", { afm_ekprosopoy: afm }, "POST", signal);
        if (!r.ok) return;
        let data; try { data = await r.json(); } catch { data = null; }
        if (!data) return;

        const d = data && typeof data === "object" ? data.doc : null;
        if (!d) { toggleSaveButtonsDisabled(false); return; }

        const alreadyExists = !!(data.aa_kod_ekpr || d.kod_ekprosopou || d.kodikos || d.id || d._id);
        toggleSaveButtonsDisabled(alreadyExists);
        if (data.aa_kod_ekpr) setInputValueIfExists("kod_ekprosopou", data.aa_kod_ekpr);

        if (d.afm != null && d.afm !== "") setInputValueIfExists("afm_ekprosopoy", d.afm);
        setInputValueIfExists("eponymia", d.eponymia);
        setInputValueIfExists("onoma", d.onoma);

        setInputValueIfExists("eponymo_patera", d.eponymo_patera);
        setInputValueIfExists("onoma_patera", d.onoma_patera);
        setInputValueIfExists("onoma_mhteras", d.onoma_mhteras);

        setInputValueIfExists("eponymo_syzygoy", d.eponymo_syzygoy);
        setInputValueIfExists("onoma_syzygoy", d.onoma_syzygoy);

        setInputValueIfExists("topos_gennhshs", d.topos_gennhshs);
        setInputValueIfExists("odos", d.odos);
        setInputValueIfExists("arithmos", d.arithmos);
        setInputValueIfExists("tk", d.tk);

        setInputValueIfExists("thlefono", d.thlefono);
        setInputValueIfExists("email", d.email);

        setInputValueIfExists("arithmos_taytothtas", d.arithmos_taytothtas);
        setInputValueIfExists("arxh_ekdoshs", d.arxh_ekdoshs);

        setInputValueIfExists("ame", d.ame);

        const iso = (x) => window.formatISODate?.(x) ?? x;
        setInputValueIfExists("hmnia_gennhshs", iso(d.hmnia_gennhshs));
        setInputValueIfExists("hmnia_ekdoshs", iso(d.hmnia_ekdoshs));
        setInputValueIfExists("hmnia_enarjhs_idiothtas", iso(d.hmnia_enarjhs_idiothtas));

        const ch = document.getElementById("nomiko_prosopo");
        if (ch) {
            ch.checked = !!d.nomiko_prosopo;
            const lbl = document.getElementById("label-nomiko_prosopo");
            if (lbl) lbl.textContent = ch.checked ? "ΝΑΙ" : "ΟΧΙ";
            applyCheckboxDependencies(ch, { clearIfDisable: true });
            ch.addEventListener("change", () => {
                if (lbl) lbl.textContent = ch.checked ? "ΝΑΙ" : "ΟΧΙ";
                applyCheckboxDependencies(ch, { clearIfDisable: true });
            });
        }

        setInputValueIfExists("nomikhmorfh_stathera", d.nomikh_morfh);
        await setTomSelectByValue("#nomikhmorfh", d.nomikh_morfh);

        setInputValueIfExists("doy_stathera", d.doy);
        await setTomSelectByValue("#doyEkprosopoy", d.doy);

        setInputValueIfExists("taytothta_stathera", d.typos_taytothtas);
        await setTomSelectByValueOrLabel("#taytothtaEkprosopoy", d.typos_taytothtas);

        setInputValueIfExists("idiothta_stathera", d.idiothta);
        await setTomSelectByValue("#idiothtaEkprosopoy", d.idiothta);

        const selPer = document.getElementById("perifereies");
        if (selPer) selPer.disabled = false;

        await setNativeSelectAndTriggerChange("perifereies", d.perifereia, { disableIfEmpty: false });
        await setNativeSelectAndTriggerChange("nomos", d.nomos);
        await setNativeSelectAndTriggerChange("dhmos", d.dhmos);
        await setNativeSelectAndTriggerChange("polh", d.polh);
    }

async function fetchErgazomenoiData(afm, signal) {
    const fieldId = 'afm_ergazomenoy';
    
    try {
        const resp = await fetchJson("/api/afmErgazomenoy", { afm }, "POST", signal);
        
        if (!resp.ok) {
            throw new Error("Σφάλμα κατά την αποστολή αιτήματος");
        }
        
        const data = await resp.json();
        
        // ✅ ΑΝ ΥΠΑΡΧΕΙ ΤΟ ΑΦΜ (duplicate)
        if (data && data.afm) {
            const esc = (s) => String(s ?? "").trim()
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
                
            await Swal.fire({
                icon: "error",
                title: "Προσοχή",
                html: `Υπάρχει ήδη καταχώρηση με ΑΦΜ <strong>${esc(data.afm)} (${esc(data.eponymia)} ${esc(data.firstname)})</strong>. Δεν επιτρέπεται διπλή καταχώρηση.`,
                backdrop: false,
                allowOutsideClick: false,
                customClass: {
                    confirmButton: "class-normal custom-confirm-button custom-swal-button",
                    title: "custom-title",
                    popup: "custom-swal-popup",
                },
                confirmButtonText: "Κλείσιμο",
            });
            
            // ❌ Clear το πεδίο μετά το error
            const inputEl = document.getElementById('afm_ergazomenoy');
            if (inputEl) inputEl.value = '';
            
            return { exists: true, data };
            
        } else {
            // ✅ ΑΝ ΔΕΝ ΥΠΑΡΧΕΙ ΤΟ ΑΦΜ (νέος εργαζόμενος)
            console.log('✅ ΑΦΜ δεν υπάρχει - επιτρέπεται η καταχώρηση');
            
            // ✅ 1. Παραμένει η τιμή στο visible input (δεν κάνουμε τίποτα)
            
            // ✅ 2. Ενημερώνουμε το hidden field
            const hiddenInput = document.getElementById('afm_ergazomenoyHidden');
            if (hiddenInput) {
                hiddenInput.value = afm;
                console.log('✅ Hidden field updated:', afm);
            }
            
            return { exists: false, data: null };
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('⏹️ Request cancelled');
            return null;
        }
        
        console.error('❌ Error checking AFM:', error);
        throw error;
        
    } finally {
        // ✅ 3. Καθαρισμός του abort controller & active request flag
        cleanupAbortSignal(fieldId);
    }
}
    /** Κενός handler όπου δεν χρειάζεται ενέργεια */
    async function noOpHandler() {}
});
