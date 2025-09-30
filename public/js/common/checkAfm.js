// // public/js/common/checkAfm.js
// document.addEventListener("DOMContentLoaded", () => {
//     // === CSRF setup ===
//     let CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]')?.content || null;

//     const ensureCsrfToken = async () => {
//         if (CSRF_TOKEN) return;
//         const r = await fetch("/api/csrf-token", { credentials: "same-origin" });
//         if (!r.ok) throw new Error("CSRF token fetch failed");
//         const j = await r.json();
//         CSRF_TOKEN = j.csrfToken;
//     };

//     // JSON helper: πάντα στέλνει CSRF + cookies
//     const apiJson = async (url, bodyObj, method = "POST", signal) => {
//         await ensureCsrfToken();
//         return fetch(url, {
//             method,
//             credentials: "same-origin",
//             headers: {
//                 Accept: "application/json",
//                 "Content-Type": "application/json",
//                 ...(CSRF_TOKEN ? { "X-CSRF-Token": CSRF_TOKEN } : {}),
//             },
//             body: method === "GET" ? undefined : JSON.stringify(bodyObj ?? {}),
//             signal,
//         });
//     };

//     // === Χάρτης πεδίων -> συναρτήσεις ===
//     const afmMappings = {
//         afm_etaireias:  fetchEtaireiaData,
//         afm_ta:         fetchTexnikosAsfaleiasData,
//         afm_ia:         fetchIatrosErgasiasData,
//         afm_lo:         fetchLogisthsData,
//         afm_em_erg:     fetchEmmesosErgodothsData,
//         afm_diad_erg:   fetchDiadoxosErgodothsData,
//         afm_ekprosopoy: fetchNomimosEkprosoposData,
//         afm_ergolaboy:  blankFunction,
//     };

//     // === Debounce + Abort ανά πεδίο (για “γρήγορα” blur) ===
//     const timers = {};
//     const controllers = {};
//     const debounce = (key, fn, delay = 200) => {
//         clearTimeout(timers[key]);
//         timers[key] = setTimeout(fn, delay);
//     };

//     const newSignal = (key) => {
//         if (controllers[key]) controllers[key].abort();
//         const c = new AbortController();
//         controllers[key] = c;
//         return c.signal;
//     };

//     function setSaveDisabled(disabled = true) {
//         document.querySelectorAll(".submitButton").forEach(btn => {
//             btn.disabled = !!disabled;
//             // btn.classList.toggle("disabled", !!disabled);        // αν έχεις CSS για .disabled
//             btn.setAttribute("aria-disabled", disabled ? "true" : "false");
//         });
//     }

//     setSaveDisabled(false);

//     const afmRep = document.getElementById("afm_ekprosopoy");
//     if (afmRep) {
//         afmRep.addEventListener("input", () => setSaveDisabled(false));
//     }

//     function assignIfExists(id, val, { keepIfUndefined = false } = {}) {
//         const el = document.getElementById(id);
//         if (!el) return;
//         if (val === undefined || val === null) {
//             if (keepIfUndefined) return;   // ΜΗΝ αλλάξεις το υπάρχον value
//             el.value = "";
//         } else {
//             el.value = val;
//         }
//     }

//     // helper: εφαρμόζει enable/disable σε όσα έχουν data-depends-on="<checkbox id>"
//     function applyCheckboxDependencies(ch, { clearIfDisable = false } = {}) {
//         if (!ch) return;
//         const depends = document.querySelectorAll(`[data-depends-on="${ch.id}"]`);

//         depends.forEach(el => {
//             const enableIfChecked = (el.dataset.enableIfChecked ?? "true") === "true";
//             const shouldEnable = enableIfChecked ? ch.checked : !ch.checked;

//             // native
//             el.disabled = !shouldEnable;

//             // TomSelect
//             const selector = `#${el.id}`;
//             const ts = (window.__tomInstances && window.__tomInstances[selector]) || el.tomselect;
//             if (ts) {
//                 if (shouldEnable) ts.enable();
//                 else {
//                     ts.disable();
//                     if (clearIfDisable) { try { ts.clear(true); } catch {} }
//                 }
//             }
//         });
//     }

//     async function setTSByValueOrText(selector, valueOrText) {
//         const el = document.querySelector(selector);
//         if (!el) return;

//         const padLen = Number(el.dataset?.padLength) || 0;
//         const raw = valueOrText == null ? "" : String(valueOrText).trim();
//         const ts = (window.__tomInstances && window.__tomInstances[selector]) || el.tomselect;

//         if (!ts) { el.value = raw; return; }
//         if (!raw) { try { ts.clear(true); } catch {} return; }

//         // πάρ’ τα πραγματικά value/label fields του TomSelect
//         const valueField = ts.settings?.valueField || "value";
//         const labelField = ts.settings?.labelField || "text";

//         // βοηθητικά
//         const normItem = (it) => {
//             const v = it?.[valueField] ?? it?.value ?? it?.id ?? raw;
//             const t = it?.[labelField] ?? it?.text ?? it?.label ?? String(v);
//             return { [valueField]: String(v), [labelField]: String(t) };
//         };
//         const addAndSet = (it) => {
//             const n = normItem(it);
//             ts.addOption(n);
//             ts.setValue(n[valueField], true);
//         };

//         // 1) Δοκίμασε σαν value (με pad για ακέραιους)
//         const vPad = raw.length < padLen && /^\d+$/.test(raw) ? raw.padStart(padLen, "0") : raw;
//         if (ts.options[vPad]) { ts.setValue(vPad, true); return; }

//         const api = el.dataset.api;

//         if (api) {
//             // 2) lookup by value
//             try {
//                 const resp = await apiJson(`${api}?value=${encodeURIComponent(vPad)}&padLength=${padLen}`, undefined, "GET", newSignal(`ts_val_${selector}`));
//                 const { items = [] } = resp.ok ? await resp.json() : { items: [] };
//                 if (items.length) { addAndSet(items[0]); return; }
//             } catch {}

//             // 3) lookup by text/label (π.χ. "ΔΑΤ")
//             try {
//                 const resp = await apiJson(`${api}?q=${encodeURIComponent(raw)}&limit=20&padLength=${padLen}`, undefined, "GET", newSignal(`ts_txt_${selector}`));
//                 const { items = [] } = resp.ok ? await resp.json() : { items: [] };
//                 if (items.length) {
//                     const norm = s => String(s ?? "").toUpperCase().trim();
//                     const hit =
//                     items.find(it => norm((it[labelField] ?? it.text ?? it.label)).startsWith(norm(raw))) ||
//                     items.find(it => norm((it[labelField] ?? it.text ?? it.label)) === norm(raw)) ||
//                     items[0];
//                     addAndSet(hit);
//                     return;
//                 }
//             } catch {}
//         }

//         // 4) fallback: φτιάξε πρόχειρο option με τα σωστά fields
//         ts.addOption({ [valueField]: raw, [labelField]: raw });
//         ts.setValue(raw, true);
//     }

//     async function setTSByValue(selector, value) {
//         const el = document.querySelector(selector);
//         if (!el) return;

//         const padLen = Number(el.dataset?.padLength) || 0;
//         const v = value == null ? "" : String(value).padStart(padLen, "0");
//         const ts = (window.__tomInstances && window.__tomInstances[selector]) || el.tomselect;

//         if (!ts) { el.value = v; return; }          // fallback
//         if (!v) { try { ts.clear(true); } catch {} return; }

//         if (ts.options[v]) { ts.setValue(v, true); return; }

//         const api = el.dataset.api;                 // π.χ. "/api/dropdown/nomikesMorfes"
//         const url = `${api}?value=${encodeURIComponent(v)}&padLength=${padLen}`;

//         try {
//             const resp = await apiJson(url, undefined, "GET", newSignal(`ts_${selector}`));
//             const { items } = resp.ok ? await resp.json() : { items: [] };
//             if (items?.length) {
//                 ts.addOption(items[0]);
//                 ts.setValue(v, true);
//             } else {
//                 ts.addOption({ value: v, text: v });
//                 ts.setValue(v, true);
//             }
//         } catch {
//             ts.addOption({ value: v, text: v });
//             ts.setValue(v, true);
//         }
//     }

//     function optionMatches(opt, val) {
//         const v = String(val ?? "").trim().toUpperCase();
//         const byValue = String(opt.value ?? "").trim().toUpperCase() === v;
//         const byText  = String(opt.text  ?? "").trim().toUpperCase() === v
//                     || String(opt.text  ?? "").trim().toUpperCase().startsWith(v);
//         return byValue || byText;
//     }

//     function hasOption(el, val) {
//         return Array.from(el.options).some(o => optionMatches(o, val));
//     }

//     function waitForOption(el, val, timeoutMs = 5000) {
//         return new Promise(resolve => {
//             if (hasOption(el, val)) return resolve(true);

//             let done = false;
//             const finish = (ok) => { if (!done) { done = true; obs?.disconnect(); clearTimeout(to); resolve(ok); } };

//             // 1) MutationObserver: πιάσε όταν προστεθούν options
//             const obs = new MutationObserver(() => {
//                 if (hasOption(el, val)) finish(true);
//             });
//             obs.observe(el, { childList: true, subtree: true });

//             // 2) Fallback timeout
//             const to = setTimeout(() => finish(false), timeoutMs);
//         });
//     }

//     async function setSelectAndTrigger(id, val, { disableIfEmpty = true } = {}) {
//         const el = document.getElementById(id);
//         if (!el) return;

//         // κενό -> clear/disable & notify
//         if (val == null || val === "") {
//             el.value = "";
//             if (disableIfEmpty) el.disabled = true;
//             el.dispatchEvent(new Event("change", { bubbles: true }));
//             return;
//         }

//         el.disabled = false;

//         // Αν υπάρχει ήδη η επιλογή, set άμεσα
//         if (!hasOption(el, val)) {
//             // περίμενε να φορτωθεί από το AJAX του parent
//             await waitForOption(el, val, 5000);
//         }

//         // set είτε από value είτε από text (αν δεν ταυτίζεται το value)
//         const opt = Array.from(el.options).find(o => optionMatches(o, val));
//         if (opt) {
//             el.value = opt.value;
//         } else {
//             // έσχατο fallback: βάλε προσωρινή επιλογή για να μην μείνει άδειο
//             el.add(new Option(String(val), String(val), true, true));
//         }

//         el.dispatchEvent(new Event("change", { bubbles: true }));
//     }

//     // === Wire up listeners ===
//     Object.keys(afmMappings).forEach((fieldId) => {
//         const field = document.getElementById(fieldId);
//         if (!field) return; // το συγκεκριμένο πεδίο δεν υπάρχει στη σελίδα

//         field.addEventListener("blur", () => {
//             debounce(fieldId, async () => {
//                 const raw = field.value?.trim() || "";
//                 if (raw === "") return;

//                 // 1) Κράτα ΜΟΝΟ ψηφία (κόβει κενά, παύλες, NBSP, κ.λπ.)
//                 const digits = raw.replace(/\D/g, "");
//                 if (digits !== raw) {
//                     field.value = digits;   // δείξε στον χρήστη την καθαρή μορφή
//                     raw = digits;
//                 }

//                 if (!isValidAfmStrict(raw)) {
//                     Swal.fire({
//                         icon: "warning",
//                         title: "Λάθος ΑΦΜ",
//                         text: "Πληκτρολογήστε σωστό 9-ψήφιο ΑΦΜ ή αφήστε το πεδίο κενό.",
//                         timer: 2500,
//                         focusConfirm: true,
//                         showConfirmButton: true,
//                         confirmButtonText: "Επιστροφή",
//                         customClass: {
//                         confirmButton: "class-warning custom-confirm-button custom-swal-button",
//                         title: "custom-title",
//                         popup: "custom-swal-popup",
//                         },
//                     }).then(() => {
//                         field.value = "";
//                         field.focus();
//                     });
//                     return;
//                 }

//                 const fn = afmMappings[fieldId];
//                 try {
//                     const signal = newSignal(fieldId);
//                     await fn(raw, signal);
//                 } catch (err) {
//                     if (err?.name !== "AbortError") console.error("Σφάλμα:", err);
//                 }
//             });
//         });
//     });

//     // === AFM validation (αυστηρό: 9 ψηφία) ===
//     function isValidAfmStrict(value) {
//         const v = String(value).trim();
//         if (!/^\d{9}$/.test(v)) return false;
//         const cd = Number(v[8]);
//         const div = [256, 128, 64, 32, 16, 8, 4, 2];
//         let tot = 0;
//         for (let i = 0; i < 8; i++) tot += div[i] * Number(v[i]);
//         const rem = tot % 11;
//         return (rem % 10) === cd;
//     }

//     // === API calls (όλες μέσω apiJson) ===

//     async function fetchEtaireiaData(afm, signal) {
//         const resp = await apiJson("/api/afmEtaireias", { afm }, "POST", signal);
//         if (!resp.ok) throw new Error("Σφάλμα κατά την αποστολή αιτήματος");
//         const data = await resp.json();
//         if (data) {
//             const esc = (s) =>
//                 String(s ?? "")
//                 .trim()
//                 .replace(/&/g, "&amp;")
//                 .replace(/</g, "&lt;")
//                 .replace(/>/g, "&gt;")
//                 .replace(/"/g, "&quot;")
//                 .replace(/'/g, "&#39;");
//             const afmTxt = esc(data.afm);
//             const epon = esc(data.eponymia);
//             const first = esc(data.firstname);

//             Swal.fire({
//                 icon: "error",
//                 title: "Προσοχή",
//                 html: `
//                     Η εταιρεία με ΑΦΜ
//                     <strong>${afmTxt} (${epon} ${first})</strong>
//                     είναι ήδη καταχωρημένη. Δεν επιτρέπεται διπλή καταχώρηση ως προς το ΑΦΜ.
//                 `,
//                 customClass: {
//                     confirmButton: "class-normal custom-confirm-button custom-swal-button",
//                     title: "custom-title",
//                     popup: "custom-swal-popup",
//                 },
//                 confirmButtonText: "Κλείσιμο",
//                 timer: 4000,
//             });
//         }
//     }

//     async function fetchTexnikosAsfaleiasData(afm, signal) {
//         const r = await apiJson("/api/texnikosAsfaleias", { afm_ta: afm }, "POST", signal);
//         if (!r.ok) return;
//         const data = await r.json();
//         if (!data) return;

//         if (data.aa_kod_ta) assignIfExists("kod_ta", data.aa_kod_ta);
//         if (data.doc) {
//             const d = data.doc;
//             assignIfExists("kod_ta", d.kodikos);
//             assignIfExists("eponymo_ta", d.eponymo);
//             assignIfExists("onoma_ta", d.onoma);
//             assignIfExists("dieythynsh_ta", d.dieythynsh);
//             assignIfExists("thlefono_ta", d.thlefono);
//             assignIfExists("ores_ta", d.ores);
//             assignIfExists("ap_katatheshs_ta", d.ap_katatheshs);
//             assignIfExists("hmnia_katatheshs_ta", window.formatISODate?.(d.hmnia_katatheshs) ?? d.hmnia_katatheshs);
//             assignIfExists("isxyei_eos_ta", window.formatISODate?.(d.isxyei_eos) ?? d.isxyei_eos);
//         }
//     }

//     async function fetchIatrosErgasiasData(afm, signal) {
//         const r = await apiJson("/api/iatrosErgasias", { afm_ia: afm }, "POST", signal);
//         if (!r.ok) return;
//         const data = await r.json();
//         if (!data) return;

//         if (data.aa_kod_ia) assignIfExists("kod_ia", data.aa_kod_ia);
//         if (data.doc) {
//             const d = data.doc;
//             assignIfExists("kod_ia", d.kodikos);
//             assignIfExists("eponymo_ia", d.eponymo);
//             assignIfExists("onoma_ia", d.onoma);
//             assignIfExists("dieythynsh_ia", d.dieythynsh);
//             assignIfExists("thlefono_ia", d.thlefono);
//             assignIfExists("ores_ia", d.ores);
//             assignIfExists("ap_katatheshs_ia", d.ap_katatheshs);
//             assignIfExists("hmnia_katatheshs_ia", window.formatISODate?.(d.hmnia_katatheshs) ?? d.hmnia_katatheshs);
//             assignIfExists("isxyei_eos_ia", window.formatISODate?.(d.isxyei_eos) ?? d.isxyei_eos);
//             assignIfExists("hmnia_Katatheshs_ia", d.hmnia_katatheshs); // raw
//             assignIfExists("isxyei_eos_ia", d.isxyei_eos);              // raw
//         }
//     }

//     async function fetchLogisthsData(afm, signal) {
//         const r = await apiJson("/api/logisths", { afm_lo: afm }, "POST", signal);
//         if (!r.ok) return;
//         const data = await r.json();
//         if (!data) return;

//         if (data.aa_kod_lo) assignIfExists("kod_lo", data.aa_kod_lo);
//         if (data.doc) {
//             const d = data.doc;
//             assignIfExists("kod_lo", d.kodikos);
//             assignIfExists("eponymo_lo", d.eponymo);
//             assignIfExists("onoma_lo", d.onoma);
//             assignIfExists("dieythynsh_lo", d.dieythynsh);
//             assignIfExists("thlefono_lo", d.thlefono);
//             assignIfExists("doy_logisths", d.doy);

//             // TomSelect (#doy_accountant) show value with padding
//             const selectEl = document.querySelector("#doy_accountant");
//             const padLen = Number(selectEl?.dataset.padLength) || 0;
//             const ts = window.__tomInstances?.["#doy_accountant"];
//             if (ts) {
//                 const val = String(d.doy ?? "");
//                 const buildLabel = (v, txt = "") => {
//                 const padded = v.padEnd(padLen, " ");
//                 const label = `${padded} - ${txt}`.trim();
//                 return { value: v, text: label };
//                 };

//                 if (val) {
//                     if (ts.options[val]) {
//                         const opt = ts.options[val];
//                         if (!opt.text?.startsWith(val.padEnd(padLen, " "))) {
//                         opt.text = buildLabel(val, opt.text?.split("-").slice(1).join("-").trim()).text;
//                         ts.updateOptions({ [val]: opt });
//                         ts.refreshOptions(false);
//                         }
//                         ts.setValue(val);
//                     } else {
//                         try {
//                             const resp = await apiJson(
//                                 `/api/dropdown/logistes?value=${encodeURIComponent(val)}&padLength=${padLen}`,
//                                 undefined,
//                                 "GET",
//                                 newSignal("ts_doy")
//                             );
//                             const { items } = resp.ok ? await resp.json() : { items: [] };
//                             if (items?.length) {
//                                 ts.addOption(items[0]);
//                                 ts.setValue(val);
//                             } else {
//                                 ts.addOption(buildLabel(val));
//                                 ts.setValue(val);
//                             }
//                         } catch (e) {
//                             if (e?.name !== "AbortError") console.error(e);
//                         }
//                     }
//                 }
//             }

//             assignIfExists("arithmos_adeias_lo", d.arithmos_adeias);
//             assignIfExists("kathgoria_adeias_lo", d.kathgoria_adeias);
//         }
//     }

//     async function fetchEmmesosErgodothsData(afm, signal) {
//         const r = await apiJson("/api/emmesosErgodoths", { afm_em_erg: afm }, "POST", signal);
//         if (!r.ok) return;
//         const data = await r.json();
//         if (!data) return;

//         if (data.aa_kod_em_erg) assignIfExists("kod_em_erg", data.aa_kod_em_erg);

//         if (data.doc) {
//             const d = data.doc;
//             assignIfExists("daneismos_epa_apo_em_erg", d.daneismosApo ?? "");
//             assignIfExists("daneismos_epa_eos_em_erg", d.daneismosEos ?? "");
//             assignIfExists("kod_em_erg", d.kodikos);
//             assignIfExists("eponymo_em_erg", d.eponymo);
//             assignIfExists("onoma_em_erg", d.onoma);
//             assignIfExists("dieythynsh_em_erg", d.dieythynsh);
//             assignIfExists("thlefono_em_erg", d.thlefono);
//             assignIfExists("titlos_em_erg", d.titlos);
//             assignIfExists("nomikh_morfh_em_erg", d.nomikhMorfh);
//             assignIfExists("drasthriothta_em_erg", d.drasthriothta);
//             assignIfExists("email_em_erg", d.email);
//         }
//     }

//     async function fetchDiadoxosErgodothsData(afm, signal) {
//         const r = await apiJson("/api/diadoxosErgodoths", { afm_diad_erg: afm }, "POST", signal);
//         if (!r.ok) return;
//         const data = await r.json();
//         if (!data) return;

//         if (data.aa_kod_diad_erg) assignIfExists("kod_diad_erg", data.aa_kod_diad_erg);

//         if (data.doc) {
//             const d = data.doc;
//             assignIfExists("kod_diad_erg", d.kodikos);
//             assignIfExists("eponymo_diad_erg", d.eponymo);
//             assignIfExists("onoma_diad_erg", d.onoma);
//             assignIfExists("dieythynsh_diad_erg", d.dieythynsh);
//             assignIfExists("thlefono_diad_erg", d.thlefono);
//             assignIfExists("titlos_diad_erg", d.titlos);
//             assignIfExists("nomikh_morfh_diad_erg", d.nomikhMorfh);
//             assignIfExists("drasthriothta_diad_erg", d.drasthriothta);
//             assignIfExists("email_diad_erg", d.email);
//         }
//     }

//     // === ΝΕΟ: Νόμιμος Εκπρόσωπος ===
//     async function fetchNomimosEkprosoposData(afm, signal) {
//         const r = await apiJson("/companies/api/nomimosEkprosopos", { afm_ekprosopoy: afm }, "POST", signal);
//         if (!r.ok) return; 
//         let data;
//         try { data = await r.json(); } catch { data = null; }
//         if (!data) return;

//         const d = (data && typeof data === "object") ? data.doc : null;
//         if (!d) { setSaveDisabled(false); return; }

//         const alreadyExists =
//             !!(data.aa_kod_ekpr || d.kod_ekprosopou || d.kodikos || d.id || d._id);

//         setSaveDisabled(alreadyExists);

//         // Αν υπάρχει πρωτεύων κωδικός από αναζήτηση
//         if (data.aa_kod_ekpr) assignIfExists("kod_ekprosopou", data.aa_kod_ekpr);

//         // Γέμισμα φόρμας
//         if (d.afm != null && d.afm !== "") assignIfExists("afm_ekprosopoy", d.afm);    
//         assignIfExists("eponymia", d.eponymia);
//         assignIfExists("onoma", d.onoma);

//         assignIfExists("eponymo_patera", d.eponymo_patera);
//         assignIfExists("onoma_patera", d.onoma_patera);
//         assignIfExists("onoma_mhteras", d.onoma_mhteras);

//         assignIfExists("eponymo_syzygoy", d.eponymo_syzygoy);
//         assignIfExists("onoma_syzygoy", d.onoma_syzygoy);

//         assignIfExists("topos_gennhshs", d.topos_gennhshs);
//         assignIfExists("odos", d.odos);
//         assignIfExists("arithmos", d.arithmos);
//         assignIfExists("tk", d.tk);

//         assignIfExists("thlefono", d.thlefono);
//         assignIfExists("email", d.email);

//         assignIfExists("arithmos_taytothtas", d.arithmos_taytothtas);
//         assignIfExists("arxh_ekdoshs", d.arxh_ekdoshs);

//         assignIfExists("ame", d.ame);

//         // === Ημερομηνίες (ISO yyyy-mm-dd για <input type="date">) ===
//         const fmt = (x) => window.formatISODate?.(x) ?? x;
//         assignIfExists("hmnia_gennhshs", fmt(d.hmnia_gennhshs));
//         assignIfExists("hmnia_ekdoshs", fmt(d.hmnia_ekdoshs));
//         assignIfExists("hmnia_enarjhs_idiothtas", fmt(d.hmnia_enarjhs_idiothtas));

//         // === Checkbox: Νομικό Πρόσωπο + label "ΟΧΙ/ΝΑΙ" ===
//         const ch = document.getElementById("nomiko_prosopo");
//         if (ch) {
//             // αρχική τιμή από τα δεδομένα
//             ch.checked = !!d.nomiko_prosopo;

//             // label
//             const lbl = document.getElementById("label-nomiko_prosopo");
//             if (lbl) lbl.textContent = ch.checked ? "ΝΑΙ" : "ΟΧΙ";

//             // εφαρμόζουμε τις εξαρτήσεις (θα επηρεάσει ΜΟΝΟ όσα έχουν data-depends-on="nomiko_prosopo")
//             applyCheckboxDependencies(ch, { clearIfDisable: true });

//             // αλλαγές από χρήστη
//             ch.addEventListener("change", () => {
//                 if (lbl) lbl.textContent = ch.checked ? "ΝΑΙ" : "ΟΧΙ";
//                 applyCheckboxDependencies(ch, { clearIfDisable: true });
//             });
//         }

//         // === TomSelect / dropdowns που έχουν hidden target ===
//         // Νομική μορφή
//         assignIfExists("nomikhmorfh_stathera", d.nomikh_morfh);
//         await setTSByValue("#nomikhmorfh", d.nomikh_morfh);

//         // ΔΟΥ
//         assignIfExists("doy_stathera", d.doy);
//         await setTSByValue("#doyEkprosopoy", d.doy);

//         // Τύπος ταυτότητας
//         assignIfExists("taytothta_stathera", d.typos_taytothtas);
//         await setTSByValueOrText("#taytothtaEkprosopoy", d.typos_taytothtas);

//         // Ιδιότητα
//         assignIfExists("idiothta_stathera", d.idiothta);
//         await setTSByValue("#idiothtaEkprosopoy", d.idiothta);

//         const selPer = document.getElementById("perifereies");
//         if (selPer) selPer.disabled = false;

//         // θέσε τιμή (χωρίς ποτέ disable όταν είναι κενό)
//         await setSelectAndTrigger("perifereies", d.perifereia, { disableIfEmpty: false });
//         await setSelectAndTrigger("nomos",       d.nomos);
//         await setSelectAndTrigger("dhmos",       d.dhmos);
//         await setSelectAndTrigger("polh",        d.polh);
//     }

//     async function blankFunction() { /* no-op */ }
// });




// public/js/common/checkAfm.js
// ============================================================================
// Έλεγχος & αναζήτηση στοιχείων με βάση το ΑΦΜ για διάφορα πεδία φόρμας.
// Περιλαμβάνει:
//  - CSRF bootstrapping
//  - JSON helper (fetch) με cookies + CSRF
//  - Debounce & Abort ανά πεδίο (ώστε γρήγορα blur να μην κάνουν άχρηστα calls)
//  - Συνδέσεις με TomSelect & native <select>
//  - Γέμισμα σχετικών πεδίων με επιστρεφόμενα δεδομένα
//  - SweetAlert2 για προειδοποιήσεις λαθών
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // CSRF setup
  // ==========================================================================

  /** Τρέχον CSRF token (αν υπάρχει από meta tag) */
  let csrfToken =
    document.querySelector('meta[name="csrf-token"]')?.content || null;

  /**
   * Βεβαιώσου ότι υπάρχει CSRF token· αν όχι, ζήτησέ το από το backend.
   * Ρίχνει exception αν αποτύχει (ώστε οι κλήσεις API να σταματούν καθαρά).
   */
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

  /**
   * Βοηθός για JSON αιτήματα. Στέλνει πάντα cookies και CSRF header.
   * @param {string} url
   * @param {object} [bodyObj] - σώμα request (θα γίνει JSON.stringify)
   * @param {"GET"|"POST"|"PUT"|"PATCH"|"DELETE"} [method="POST"]
   * @param {AbortSignal} [signal]
   * @returns {Promise<Response>}
   */
  const fetchJson = async (url, bodyObj, method = "POST", signal) => {
    await ensureCsrfTokenAvailable();
    return fetch(url, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: method === "GET" ? undefined : JSON.stringify(bodyObj ?? {}),
      signal,
    });
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
  };

  // ==========================================================================
  // Debounce & Abort ανά πεδίο
  // ==========================================================================

  /** Timers για debounce ανά key (συνήθως id input) */
  const debounceTimers = {};
  /** AbortControllers για ακύρωση request όταν γίνει νέο blur στο ίδιο πεδίο */
  const abortControllers = {};

  /**
   * Debounce με βάση ένα key.
   */
  const debounceByKey = (key, fn, delay = 200) => {
    clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(fn, delay);
  };

  /**
   * Δημιούργησε νέο AbortSignal για συγκεκριμένο key,
   * ακυρώνοντας τυχόν προηγούμενο.
   */
  const createAbortSignal = (key) => {
    if (abortControllers[key]) abortControllers[key].abort();
    const controller = new AbortController();
    abortControllers[key] = controller;
    return controller.signal;
  };

  // ==========================================================================
  // Βοηθητικά για κουμπιά υποβολής
  // ==========================================================================

  /**
   * Ενεργοποιεί/απενεργοποιεί όλα τα κουμπιά με class ".submitButton"
   */
  function toggleSaveButtonsDisabled(disabled = true) {
    document.querySelectorAll(".submitButton").forEach((btn) => {
      btn.disabled = !!disabled;
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
      // Αν θες visual state από CSS:
      // btn.classList.toggle("disabled", !!disabled);
    });
  }

  // Default: ενεργά
  toggleSaveButtonsDisabled(false);

  // Όταν ο χρήστης πειράζει το ΑΦΜ του εκπροσώπου, ξεκλείδωνε την αποθήκευση
  const afmRepresentativeInput = document.getElementById("afm_ekprosopoy");
  if (afmRepresentativeInput) {
    afmRepresentativeInput.addEventListener("input", () =>
      toggleSaveButtonsDisabled(false)
    );
  }

  // ==========================================================================
  // Setters για input/selects
  // ==========================================================================

  /**
   * Θέτει value σε input αν υπάρχει στο DOM.
   * Αν η τιμή είναι undefined/null => καθαρίζει, εκτός αν keepIfUndefined=true.
   */
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

  /**
   * Εφαρμόζει enable/disable σε στοιχεία που έχουν data-depends-on="<checkbox id>".
   * Αν clearIfDisable=true, καθαρίζει και την τιμή όταν γίνεται disable.
   */
  function applyCheckboxDependencies(checkboxEl, { clearIfDisable = false } = {}) {
    if (!checkboxEl) return;
    const dependents = document.querySelectorAll(
      `[data-depends-on="${checkboxEl.id}"]`
    );

    dependents.forEach((el) => {
      const enableIfChecked = (el.dataset.enableIfChecked ?? "true") === "true";
      const shouldEnable = enableIfChecked ? checkboxEl.checked : !checkboxEl.checked;

      // 1) native
      el.disabled = !shouldEnable;

      // 2) TomSelect (αν υπάρχει instance)
      const selector = `#${el.id}`;
      const ts =
        (window.__tomInstances && window.__tomInstances[selector]) || el.tomselect;
      if (ts) {
        if (shouldEnable) ts.enable();
        else {
          ts.disable();
          if (clearIfDisable) {
            try {
              ts.clear(true);
            } catch {}
          }
        }
      }
    });
  }

  /**
   * Θέτει TomSelect από value ή από label (ό,τι βρεθεί), με υποστήριξη padding.
   * Αν δεν υπάρχει TomSelect, πέφτει σε απλό el.value.
   */
  async function setTomSelectByValueOrLabel(selector, valueOrLabel) {
    const el = document.querySelector(selector);
    if (!el) return;

    const padLen = Number(el.dataset?.padLength) || 0;
    const raw = valueOrLabel == null ? "" : String(valueOrLabel).trim();
    const ts =
      (window.__tomInstances && window.__tomInstances[selector]) || el.tomselect;

    if (!ts) {
      el.value = raw;
      return;
    }
    if (!raw) {
      try {
        ts.clear(true);
      } catch {}
      return;
    }

    // Πεδία που χρησιμοποιεί ο TomSelect για value/label
    const valueField = ts.settings?.valueField || "value";
    const labelField = ts.settings?.labelField || "text";

    const normalizeOption = (it) => {
      const v = it?.[valueField] ?? it?.value ?? it?.id ?? raw;
      const t = it?.[labelField] ?? it?.text ?? it?.label ?? String(v);
      return { [valueField]: String(v), [labelField]: String(t) };
    };
    const addAndSelect = (it) => {
      const n = normalizeOption(it);
      ts.addOption(n);
      ts.setValue(n[valueField], true);
    };

    // (1) δοκίμασε σαν value (με padding για ακέραιους)
    const padded = raw.length < padLen && /^\d+$/.test(raw)
      ? raw.padStart(padLen, "0")
      : raw;
    if (ts.options[padded]) {
      ts.setValue(padded, true);
      return;
    }

    const api = el.dataset.api;
    if (api) {
      // (2) lookup by value
      try {
        const resp = await fetchJson(
          `${api}?value=${encodeURIComponent(padded)}&padLength=${padLen}`,
          undefined,
          "GET",
          createAbortSignal(`ts_val_${selector}`)
        );
        const { items = [] } = resp.ok ? await resp.json() : { items: [] };
        if (items.length) {
          addAndSelect(items[0]);
          return;
        }
      } catch {}

      // (3) lookup by text/label
      try {
        const resp = await fetchJson(
          `${api}?q=${encodeURIComponent(raw)}&limit=20&padLength=${padLen}`,
          undefined,
          "GET",
          createAbortSignal(`ts_txt_${selector}`)
        );
        const { items = [] } = resp.ok ? await resp.json() : { items: [] };
        if (items.length) {
          const norm = (s) => String(s ?? "").toUpperCase().trim();
          const hit =
            items.find((it) =>
              norm((it[labelField] ?? it.text ?? it.label)).startsWith(norm(raw))
            ) ||
            items.find(
              (it) => norm((it[labelField] ?? it.text ?? it.label)) === norm(raw)
            ) ||
            items[0];
          addAndSelect(hit);
          return;
        }
      } catch {}
    }

    // (4) fallback: πρόσθεσε προσωρινό option
    ts.addOption({ [valueField]: raw, [labelField]: raw });
    ts.setValue(raw, true);
  }

  /**
   * Θέτει TomSelect από συγκεκριμένη τιμή (value), με padding (π.χ. κωδικοί ΔΟΥ).
   */
  async function setTomSelectByValue(selector, value) {
    const el = document.querySelector(selector);
    if (!el) return;

    const padLen = Number(el.dataset?.padLength) || 0;
    const v = value == null ? "" : String(value).padStart(padLen, "0");
    const ts =
      (window.__tomInstances && window.__tomInstances[selector]) || el.tomselect;

    if (!ts) {
      el.value = v; // fallback για απλό select
      return;
    }
    if (!v) {
      try {
        ts.clear(true);
      } catch {}
      return;
    }

    if (ts.options[v]) {
      ts.setValue(v, true);
      return;
    }

    const api = el.dataset.api;
    const url = `${api}?value=${encodeURIComponent(v)}&padLength=${padLen}`;

    try {
      const resp = await fetchJson(url, undefined, "GET", createAbortSignal(`ts_${selector}`));
      const { items } = resp.ok ? await resp.json() : { items: [] };
      if (items?.length) {
        ts.addOption(items[0]);
        ts.setValue(v, true);
      } else {
        ts.addOption({ value: v, text: v });
        ts.setValue(v, true);
      }
    } catch {
      ts.addOption({ value: v, text: v });
      ts.setValue(v, true);
    }
  }

  // -------- Native <select> helpers (για εξαρτήσεις) -----------------------

  /** Επιστρέφει true αν υπάρχει option που ταιριάζει είτε σε value είτε σε text */
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

  /**
   * Περιμένει μέχρι να εμφανιστεί συγκεκριμένο option στο select (π.χ. όταν
   * το γεμίζει AJAX του parent). Γυρίζει false αν λήξει το timeout.
   */
  function waitForOption(selectEl, val, timeoutMs = 5000) {
    return new Promise((resolve) => {
      if (selectHasOption(selectEl, val)) return resolve(true);

      let finished = false;
      const finish = (ok) => {
        if (!finished) {
          finished = true;
          observer?.disconnect();
          clearTimeout(to);
          resolve(ok);
        }
      };

      const observer = new MutationObserver(() => {
        if (selectHasOption(selectEl, val)) finish(true);
      });
      observer.observe(selectEl, { childList: true, subtree: true });

      const to = setTimeout(() => finish(false), timeoutMs);
    });
  }

  /**
   * Θέτει τιμή σε native <select> και εκπέμπει 'change'.
   * Αν η τιμή είναι κενή, προαιρετικά το κάνει disabled.
   */
  async function setNativeSelectAndTriggerChange(
    id,
    val,
    { disableIfEmpty = true } = {}
  ) {
    const el = document.getElementById(id);
    if (!el) return;

    if (val == null || val === "") {
      el.value = "";
      if (disableIfEmpty) el.disabled = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    el.disabled = false;

    if (!selectHasOption(el, val)) {
      // Περιμενε options να φορτωθούν (αν έρχονται από AJAX)
      await waitForOption(el, val, 5000);
    }

    const opt = Array.from(el.options).find((o) => optionMatches(o, val));
    if (opt) {
      el.value = opt.value;
    } else {
      // Fallback: πρόσθεσε προσωρινά την επιλογή για να μην μείνει άδειο
      el.add(new Option(String(val), String(val), true, true));
    }

    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ==========================================================================
  // Wire up listeners (blur σε όλα τα πεδία ΑΦΜ που υπάρχουν στη σελίδα)
  // ==========================================================================

  Object.keys(afmFieldToHandlerMap).forEach((fieldId) => {
    const inputEl = document.getElementById(fieldId);
    if (!inputEl) return; // το συγκεκριμένο πεδίο δεν υπάρχει

    inputEl.addEventListener("blur", () => {
      debounceByKey(fieldId, async () => {
        let rawValue = inputEl.value?.trim() || "";
        if (rawValue === "") return;

        // Κράτα ΜΟΝΟ ψηφία (κόβει κενά, παύλες, NBSP, κ.λπ.)
        const onlyDigits = rawValue.replace(/\D/g, "");
        if (onlyDigits !== rawValue) {
          inputEl.value = onlyDigits; // δείξε την καθαρή μορφή στον χρήστη
          rawValue = onlyDigits;
        }

        // Αυστηρός έλεγχος ΑΦΜ (9 ψηφία + checksum)
        if (!isValidAfm9Digits(rawValue)) {
          Swal.fire({
            icon: "warning",
            title: "Λάθος ΑΦΜ",
            text: "Πληκτρολογήστε σωστό 9-ψήφιο ΑΦΜ ή αφήστε το πεδίο κενό.",
            timer: 2500,
            focusConfirm: true,
            showConfirmButton: true,
            confirmButtonText: "Επιστροφή",
            backdrop: false,            // <-- κανένα overlay
            allowOutsideClick: false,
            customClass: {
              confirmButton:
                "class-warning custom-confirm-button custom-swal-button",
              title: "custom-title",
              popup: "custom-swal-popup",
            },
          }).then(() => {
            inputEl.value = "";
            inputEl.focus();
          });
          return;
        }

        // Κλήση του κατάλληλου handler
        const handler = afmFieldToHandlerMap[fieldId];
        try {
          const signal = createAbortSignal(fieldId);
          await handler(rawValue, signal);
        } catch (err) {
          if (err?.name !== "AbortError") console.error("Σφάλμα:", err);
        }
      });
    });
  });

  // ==========================================================================
  // Έλεγχος εγκυρότητας ΑΦΜ (αυστηρός: 9 ψηφία + checksum mod 11)
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
        html: `
          Η εταιρεία με ΑΦΜ
          <strong>${afmTxt} (${epon} ${first})</strong>
          είναι ήδη καταχωρημένη. Δεν επιτρέπεται διπλή καταχώρηση ως προς το ΑΦΜ.
        `,
        backdrop: false,            // <-- κανένα overlay
        allowOutsideClick: false,
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
    const r = await fetchJson(
      "/api/texnikosAsfaleias",
      { afm_ta: afm },
      "POST",
      signal
    );
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
      setInputValueIfExists(
        "hmnia_katatheshs_ta",
        window.formatISODate?.(d.hmnia_katatheshs) ?? d.hmnia_katatheshs
      );
      setInputValueIfExists(
        "isxyei_eos_ta",
        window.formatISODate?.(d.isxyei_eos) ?? d.isxyei_eos
      );
    }
  }

  async function fetchIatrosErgasiasData(afm, signal) {
    const r = await fetchJson(
      "/api/iatrosErgasias",
      { afm_ia: afm },
      "POST",
      signal
    );
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
      setInputValueIfExists(
        "hmnia_katatheshs_ia",
        window.formatISODate?.(d.hmnia_katatheshs) ?? d.hmnia_katatheshs
      );
      setInputValueIfExists(
        "isxyei_eos_ia",
        window.formatISODate?.(d.isxyei_eos) ?? d.isxyei_eos
      );
      // επιπλέον raw (αν χρειάζονται χωρίς μετατροπή)
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

      // TomSelect (#doy_accountant): εμφάνιση με padding
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
              opt.text = buildLabel(
                val,
                opt.text?.split("-").slice(1).join("-").trim()
              ).text;
              ts.updateOptions({ [val]: opt });
              ts.refreshOptions(false);
            }
            ts.setValue(val);
          } else {
            try {
              const resp = await fetchJson(
                `/api/dropdown/logistes?value=${encodeURIComponent(
                  val
                )}&padLength=${padLen}`,
                undefined,
                "GET",
                createAbortSignal("ts_doy")
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

      setInputValueIfExists("arithmos_adeias_lo", d.arithmos_adeias);
      setInputValueIfExists("kathgoria_adeias_lo", d.kathgoria_adeias);
    }
  }

  async function fetchEmmesosErgodothsData(afm, signal) {
    const r = await fetchJson(
      "/api/emmesosErgodoths",
      { afm_em_erg: afm },
      "POST",
      signal
    );
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
    const r = await fetchJson(
      "/api/diadoxosErgodoths",
      { afm_diad_erg: afm },
      "POST",
      signal
    );
    if (!r.ok) return;
    const data = await r.json();
    if (!data) return;

    if (data.aa_kod_diad_erg)
      setInputValueIfExists("kod_diad_erg", data.aa_kod_diad_erg);

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
    const r = await fetchJson(
      "/companies/api/nomimosEkprosopos",
      { afm_ekprosopoy: afm },
      "POST",
      signal
    );
    if (!r.ok) return;
    let data;
    try {
      data = await r.json();
    } catch {
      data = null;
    }
    if (!data) return;

    const d = data && typeof data === "object" ? data.doc : null;
    if (!d) {
      toggleSaveButtonsDisabled(false);
      return;
    }

    // Αν υπάρχει ήδη ο εκπρόσωπος, κλείδωσε την αποθήκευση
    const alreadyExists =
      !!(data.aa_kod_ekpr || d.kod_ekprosopou || d.kodikos || d.id || d._id);
    toggleSaveButtonsDisabled(alreadyExists);

    if (data.aa_kod_ekpr) setInputValueIfExists("kod_ekprosopou", data.aa_kod_ekpr);

    // Γέμισμα βασικών πεδίων
    if (d.afm != null && d.afm !== "")
      setInputValueIfExists("afm_ekprosopoy", d.afm);
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

    // Ημερομηνίες (ISO yyyy-mm-dd για <input type="date">)
    const iso = (x) => window.formatISODate?.(x) ?? x;
    setInputValueIfExists("hmnia_gennhshs", iso(d.hmnia_gennhshs));
    setInputValueIfExists("hmnia_ekdoshs", iso(d.hmnia_ekdoshs));
    setInputValueIfExists("hmnia_enarjhs_idiothtas", iso(d.hmnia_enarjhs_idiothtas));

    // Checkbox: Νομικό Πρόσωπο + label "ΟΧΙ/ΝΑΙ"
    const ch = document.getElementById("nomiko_prosopo");
    if (ch) {
      ch.checked = !!d.nomiko_prosopo;
      const lbl = document.getElementById("label-nomiko_prosopo");
      if (lbl) lbl.textContent = ch.checked ? "ΝΑΙ" : "ΟΧΙ";

      // εφαρμογή εξαρτήσεων σε στοιχεία με data-depends-on="nomiko_prosopo"
      applyCheckboxDependencies(ch, { clearIfDisable: true });

      ch.addEventListener("change", () => {
        if (lbl) lbl.textContent = ch.checked ? "ΝΑΙ" : "ΟΧΙ";
        applyCheckboxDependencies(ch, { clearIfDisable: true });
      });
    }

    // TomSelect/dropdowns που γράφουν σε hidden:
    setInputValueIfExists("nomikhmorfh_stathera", d.nomikh_morfh);
    await setTomSelectByValue("#nomikhmorfh", d.nomikh_morfh);

    setInputValueIfExists("doy_stathera", d.doy);
    await setTomSelectByValue("#doyEkprosopoy", d.doy);

    setInputValueIfExists("taytothta_stathera", d.typos_taytothtas);
    await setTomSelectByValueOrLabel("#taytothtaEkprosopoy", d.typos_taytothtas);

    setInputValueIfExists("idiothta_stathera", d.idiothta);
    await setTomSelectByValue("#idiothtaEkprosopoy", d.idiothta);

    // Ιεραρχικά native selects
    const selPer = document.getElementById("perifereies");
    if (selPer) selPer.disabled = false;

    await setNativeSelectAndTriggerChange("perifereies", d.perifereia, {
      disableIfEmpty: false,
    });
    await setNativeSelectAndTriggerChange("nomos", d.nomos);
    await setNativeSelectAndTriggerChange("dhmos", d.dhmos);
    await setNativeSelectAndTriggerChange("polh", d.polh);
  }

  /** Κενός handler όπου δεν χρειάζεται ενέργεια */
  async function noOpHandler() {}
});
