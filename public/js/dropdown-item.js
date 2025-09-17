// ✅ dropdown-item.js – Tom-Select v2.4.3  +  custom infinite scroll (ΧΩΡΙΣ virtual_scroll)

const globalRenderMap = {};
const globalHookMap   = {};
const templateCache   = {};
const selectedCache = {};

window.setTomDropdownRender = (id, r) => (globalRenderMap[id] = r);
window.setTomDropdownHooks  = (id, h) => (globalHookMap[id]  = h);

const debounce = (fn, d = 100) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d);} };

export const initTomDropdown = ({
    selector,
    url,
    extraParams = {},
    render      = {},
    hooks       = {},        // επιπλέον events του caller
    minChars    = 0,
} = {}) => {
    if (!selector || !url) return;

    const el = document.querySelector(selector);
    if (!el) return;
    
    // if (el.dataset.skipAutoload === 'true') {
        // μην κάνεις pre-load • περιμένουμε ο χρήστης να πληκτρολογήσει
    //     tom.settings.preload = false;
    // }

    // ✅ Ασφαλής καθαρισμός υπάρχοντος instance
    if (el.tomselect) {
        el.tomselect.destroy();
    }

    // ⬅️ Αν υπάρχει pad-length στο HTML, πέρασέ το στα extraParams
    const padLength = el.dataset.padLength;
    if (padLength && !extraParams.padLength) {
        extraParams.padLength = padLength;
    }

    /* -------------------------------------------------------------- */
    /* helper: πόσο είναι το limit που ζητήσαμε στην κλήση            */
    const getLimitFromUrl = (urlStr) => {
        const v = parseInt(new URL(urlStr, location.origin)
                .searchParams.get('limit'), 10);
        return Number.isFinite(v) && v > 0 ? v : 50;      // default 50
    };

    /* helper: επόμενη σελίδα, κληρονομεί ΟΛΑ τα query-params         */
    const buildNextPageUrl = (urlStr) => {
        const urlObj = new URL(urlStr, location.origin);
        const next = (+urlObj.searchParams.get('page') || 1) + 1;
        urlObj.searchParams.set('page', next);
        return urlObj.toString();
    };

    /* ---------------------------------------------------------------- */
    const isMultiple = el.hasAttribute('multiple') ;
    const preloadAll = el.dataset.preloadAll === 'true';

    /* helper για next‑page URL  -------------------------------------- */
    const nextUrl = (current) => {
        const urlObj = new URL(current);
        const p = (+urlObj.searchParams.get('page') || 1) + 1;
        urlObj.searchParams.set('page', p);
        return urlObj.toString();
    };

    /* ---------------------------------------------------------- */
    // ➜ αποθηκεύουμε τυχόν custom onInitialize που πέρασε ο caller
    const userOnInit = hooks.onInitialize || hooks.initialize;
    delete hooks.onInitialize;
    delete hooks.initialize;

    /* ---------------------------------------------------------- */
    let currentAbort = null;

    const tom = new TomSelect(el, {
        /* ▼ βασικά πεδία ▼ */
        valueField      : 'value',
        labelField      : 'label',
        searchField     : ['label'],
        sort            : false,
        dropdownDirection: 'auto',

        /* custom score ώστε κενό search ⇒ όλα τα items */
        score(search) {
            if (!search || !Array.isArray(search.tokens) || !search.tokens.length) {
                return () => 1;
            }
            const toks = search.tokens.map(t => t.string.toLowerCase());
            return (item) => toks.every(t => item.label.toLowerCase().includes(t)) ? 1 : 0;
        },

        maxOptions   : null,
        maxItems     : isMultiple ? null : 1,
        hideSelected : isMultiple,   // false → single, true → multi
        create       : false,
        persist      : false,

        /* preload λογική */
        preload      : preloadAll ? 'focus' : false,
        loadThrottle : 0,
        shouldLoad   : (q) => preloadAll ? true : q.trim().length >= minChars,

        placeholder  : '',
        plugins      : [ ...(isMultiple ? ['remove_button'] : []), 'dropdown_input' ],

        /* ------ async LOAD (σελίδα 1) ------------------------- */
        async load(searchText, callback) {

            /* 1. ακύρωσε τυχόν προηγούμενο fetch */
            try { currentAbort?.abort(); } catch {}
            currentAbort = new AbortController();

            /* 2. χτίζω το URL  – το δικό σου κομμάτι μένει όπως ήταν */
            const urlToFetch = (typeof searchText === 'string' && searchText.startsWith('http'))
                ? searchText
                : (() => {
                    const urlObj = new URL(url, location.origin);
                    Object.entries(extraParams).forEach(([k,v]) => v && urlObj.searchParams.set(k,v));
                    urlObj.searchParams.set('search', searchText || '');
                    urlObj.searchParams.set('page',   1);
                    urlObj.searchParams.set('limit',  50);
                    return urlObj.toString();
                    })
                ();

            try {
                /* 3. fetch */
                const json = await fetch(urlToFetch, { signal: currentAbort.signal })
                                        .then(r => r.json());
                let items = Array.isArray(json.items) ? json.items : [];

                /* 4. πρόσθεσε ΟΠΟΙΟ επιλεγμένο λείπει */
                this.items.forEach(v => {
                    const cached = selectedCache[v];
                    const alreadyInOptions = this.options[v];

                    if (!alreadyInOptions && cached) {
                        this.addOption(cached);
                    } else if (!cached) {
                        console.warn('⚠️ Cannot re-add – missing from cache:', v);
                    }
                });

                /* 5. πέρασέ τα στον Tom-Select */
                items.length ? callback(items) : callback();   // κλείνει και το spinner

                /* 6. diff-clean-up  */
                const idKey = this.settings.valueField;        // π.χ. 'kodikos'
                const keep  = new Set([
                    ...(this.items || []),                       // ήδη επιλεγμένα
                    ...items.map(o => o[idKey])                  // φρέσκα + «ενέσεις»
                ]);
                Object.keys(this.options).forEach(id => {
                    if (!keep.has(id)) this.removeOption(id);
                });

                /* 7. endless-scroll: επόμενη σελίδα */
                const limit   = Number(new URL(urlToFetch).searchParams.get('limit')) || 50;
                const hasMore = ('hasMore' in json) ? !!json.hasMore
                                                    : items.length === limit;
                this.nextPage = hasMore ? nextUrl(urlToFetch) : null;

            } catch (err) {
                if (err.name !== 'AbortError') console.error('Dropdown load failed', err);
                callback();                 // κλείσε spinner σε κάθε σφάλμα
            }
        },
        /* ------ render ----------------------------------------- */
        render : {
            option(optionData, e) {
                return `<div class="ts-option">${e(optionData.label)}</div>`;
            },
            item(optionData, e) {
                if (!optionData || typeof optionData !== 'object' || !('value' in optionData)) {
                    const phText = el.getAttribute('placeholder') || '…';
                    return `<div class="item placeholder-item" aria-placeholder="true">${e(phText)}</div>`;
                }
                const vKey = this.settings.valueField || 'value';
                return `<div class="item" data-value="${e(optionData[vKey])}">${e(optionData.label)}</div>`;
                },
            ...render,
        },

        /* flag ώστε να είναι διαθέσιμο στο onInitialize */
        _preloadAll : preloadAll,

        /* ===== onInitialize (core + project specific + χρήστη) ===== */
        onInitialize() {
            const ts = this; // ← alias του instance

            /******************* A. Core reset logic *******************/
            const resetList = () => {
                this.setTextboxValue('');
                // this.lastQuery = '';
                this.clearFilter();          // μηδενίζει το εσωτερικό filter του TS
                this.refreshOptions(false);  // επαναφέρει hideSelected
            };

            const isMultiple = el.hasAttribute('multiple');

            /* -- επιλέχθηκε item (ΜΟΝΟ στο multiple) --------------*/
            if (isMultiple) {
                this.on('item_add', value => {
                    // ➜ αφήνουμε τον Tom-Select να ρίξει πρώτα το tag στο DOM
                    setTimeout(() => {
                        const q = this.lastQuery;

                        resetList();                     // τώρα δεν «σβήνει» το tag

                        if (!this.settings._preloadAll && q) {
                            this.load(q);
                        }
                        this.open();                     // dropdown μένει ανοιχτό
                    }, 0);                               // 0 ms = τρέχει στο επόμενο tick
                });
            } else {
                /* SINGLE: συμπεριφορά όπως πριν */
                this.on('item_add', () => {
                    resetList();
                    this.ignoreFocusOpen = true;
                    this.close();
                    this.control_input.blur();
                    setTimeout(() => (this.ignoreFocusOpen = false), 0);
                });
            }

            // /* ➜ κλείσιμο + blur ΜΟΝΟ μετά από επιλογή */
            /* -- clear (σκουπιδάκι) -------------------------------- */
            this.on('clear', () => {
                // 1. εσωτερικό reset
                resetList();
                // 2. ο TomSelect καθαρίζει selected ⇒ ας κάνουμε reload
                this.clearOptions();
                this.nextPage = null;
                if (this.settings._preloadAll) {
                    this.load('');       // φέρνει ξανά όλα ~50 options
                }
                // 3. μικρό delay ώστε refreshOptions να "δει" τα νέα data
                setTimeout(() => this.refreshOptions(false));
            });

            /* ---------------------------------------------------------------
            * dropdown_open  ➜  position + preload + trash btn κ.λπ.
            * -------------------------------------------------------------*/
            this.on('dropdown_open', () => {
                ts.wrapper.classList.add('open');

                /* ---------- προαιρετικό preload ---------------------------------*/
                if (this.settings._preloadAll && !this.control_input.value) {
                    if (Object.keys(this.options).length < 2) {
                        this.load('');
                    } else {
                        this.refreshOptions(false);
                    }
                }

                /* ---------- helper: έξυπνη τοποθέτηση (ΧΩΡΙΣ inline styles) -----*/
                const reposition = () => {
                    const controlRect = this.control.getBoundingClientRect();
                    const ddEl        = this.dropdown;

                    /* 1. «ιδανικό» ύψος =  search + ~6.5 rows */
                    const searchH     = 36;   // fallback ύψος search
                    const optionH     = 34;   // fallback ύψος μίας option
                    const idealHeight = searchH + optionH * 6.5;

                    /* 2. διαθέσιμος χώρος ΜΕΣΑ στο .card (για να μην «ξεχειλίζει» ) */
                    const cardRect    = ts.wrapper.closest('.card')
                        ?.getBoundingClientRect()
                        ?? { top: 0, bottom: window.innerHeight };

                    const spaceAbove  = controlRect.top    - cardRect.top;
                    const spaceBelow  = cardRect.bottom    - controlRect.bottom;

                    /* καθάρισε προηγούμενες κλάσεις θέσης/ύψους */
                    ddEl.classList.remove('place-above','place-below','maxh-ideal','maxh-limited');

                    /* 3. λογική επιλογής (ίδια με πριν, αλλά με κλάσεις) */
                    if (idealHeight <= spaceBelow) {
                        // χωράει κάτω στο «ιδανικό»
                        ddEl.classList.add('place-below','maxh-ideal');
                    } else if (idealHeight <= spaceAbove) {
                        // χωράει πάνω στο «ιδανικό»
                        ddEl.classList.add('place-above','maxh-ideal');
                    } else {
                        // δεν χωρά ολόκληρο: ΠΑΝΩ με περιορισμένο ύψος (scrollbar)
                        ddEl.classList.add('place-above','maxh-limited');
                    }
                };

                /* --- 1η τοποθέτηση (ανοίγει κενό αν skip-autoload) --------------*/
                requestAnimationFrame(reposition);

                /* --- 2η τοποθέτηση όταν φορτωθούν τα options --------------------*/
                const origLoad = this.settings.load;
                this.settings.load = (query, callback) => {
                    origLoad.call(this, query, items => {
                        if (Array.isArray(items) && items.length) {
                            callback(items);          // κανονική ροή
                        } else {
                            callback();               // κλείνει το spinner – δεν κρασάρει
                        }
                        requestAnimationFrame(reposition);   // ξαναϋπολόγισε με τα νέα ύψη
                    });
                };
            });

            /******************* B. Project-specific setup *****************/
            this.wrapper.classList.add('dropdown-wrapper'); // CSS: position:relative κ.λπ.
            this.control_input.classList.add('dropdown-input');
            // (was) this.wrapper.style.position = 'relative';  ➜ αφαιρέθηκε λόγω CSP
            const phTxt = el.getAttribute('placeholder') || 'Αναζήτηση…';
            this.control_input.setAttribute('placeholder', phTxt);

            this.on('type', debounce((query) => {
                /* κενό search ----------------------------------------------*/
                if (!query.trim()) {
                    this.nextPage = null;
                    if (this.settings._preloadAll) {
                        this.load('');                 // default λίστα
                    } else {
                        this.refreshOptions(false);    // απλώς ξαναδείξε τη cache
                    }
                    return;
                }

                /* κανονικό search ------------------------------------------*/
                /* ΔΕΝ καλούμε clearOptions()  -> κρατά τα ήδη selected options */
                this.clearOptions();
                this.nextPage = null;
                this.load(query);
            }, 300));

            // overflow handling -----------------------------------
            updateOverflow(this);

            /* =====================================================
            *  ΕΜΦΑΝΙΣΗ 🗑 ΑΜΕΣΩΣ  μόλις προστεθεί/φορτωθεί επιλογή
            * ----------------------------------------------------- */
            const overflowNow = () => requestAnimationFrame(() => updateOverflow(this));

            this.on('load'       , overflowNow);   // fire μετά από κάθε async load
            this.on('item_add'   , overflowNow);   // single & multi
            this.on('item_remove', overflowNow);
            this.on('clear'      , overflowNow);
            
            if (isMultiple && typeof hooks.onInit === 'function') hooks.onInit(this);

            if (isMultiple) {
                const refresh = debounce(() => updateOverflow(this), 50);
                refresh();
                this.on('item_add',    refresh);
                this.on('item_remove', refresh);
                window.addEventListener('resize', refresh);
            } else {
                this.on('change', () => updateOverflow(this));
                this.on('dropdown_close', () => updateOverflow(this));
            }

            /******************* C. Custom onInitialize (caller) ***********/
            if (typeof userOnInit === 'function') userOnInit.call(this);

            /* -------------------------------------------------------------
            *  Προεπιλογή κωδικού από τη ΒΔ
            * ------------------------------------------------------------*/

            // 🔁 Re-render any missing tags manually (multi-select issue fix)
            this.items.forEach(val => {
                const itemExists = this.control.querySelector(`.item[data-value="${val}"]`);
                if (!itemExists) {
                    console.warn('⚠️ Missing tag for value:', val, '→ Re-adding...');
                    this.removeItem(val, true);
                    this.addItem(val);
                }
            });

            const doPreselect = async () => {
            const preSelId = el.dataset.preselect;
            if (!preSelId) return;

            const preSelVal = document.getElementById(preSelId)?.value?.trim();
            if (!preSelVal) return;

            if (el.hasAttribute('data-has-value')) return;

            // Φτιάξε URL + extra params
            const u = new URL(url, location.origin);
            Object.entries(extraParams || {}).forEach(([k, v]) => v && u.searchParams.set(k, v));
            u.searchParams.set('value', preSelVal);

            // Abort τυχόν προηγούμενο preselect
            try { ts._preselectAbort?.abort(); } catch {}
            const controller = new AbortController();
            ts._preselectAbort = controller;

            try {
                const res   = await fetch(u, { credentials: 'include', signal: controller.signal });
                const json  = await res.json();
                const item  = json?.items?.[0];
                if (!item) return;

                // Αν στο μεταξύ έγινε άλλο preselect → μην συνεχίσεις (stale)
                if (ts._preselectAbort !== controller) return;

                const key = ts.settings.valueField || 'value';
                const id  = item[key] ?? preSelVal;

                ts.addOption(item);
                ts.setValue(id, true);
                selectedCache[id] = item;
                requestAnimationFrame(() => updateOverflow(ts));
                el.setAttribute('data-has-value', 'true');
            } catch (err) {
                if (err?.name !== 'AbortError') console.error('❌ Preselect fetch failed:', err);
            } finally {
                if (ts._preselectAbort === controller) ts._preselectAbort = null;
            }
            };

            doPreselect();

            /* -----------------------------------------------------------------
            *  Α. Ενημέρωση κρυφού input  ΜΟΝΟ στο single
            * ----------------------------------------------------------------*/
            if (!isMultiple) {
                this.on('change', val => {
                    const inputId = el.dataset.targetInput;
                    const input   = document.getElementById(inputId);
                    if (input) input.value = val;
                });
            }
        },

        onDropdownOpen () {
            // placeholder μέσα στο input του dropdown
            const ddInput = this.dropdown?.querySelector('.dropdown-input');
            if (ddInput) {
                // αποθήκευση αρχικού placeholder για restore στο close
                if (!this._origDdPlaceholderSaved) {
                this._origDdPlaceholder = ddInput.getAttribute('placeholder') || '';
                this._origDdPlaceholderSaved = true;
                }
                ddInput.setAttribute('placeholder', el.getAttribute('placeholder') || 'Αναζήτηση…');
            }

            // bind once το χειροποίητο infinite scroll
            if (!this._infiniteBound) {
                const content = this.dropdown?.querySelector('.ts-dropdown-content');
                if (content) {
                // κρατάμε ref για να μπορούμε να το αφαιρέσουμε αν ποτέ χρειαστεί
                this._infiniteScrollHandler = () => handleScroll(this, content);
                content.addEventListener('scroll', this._infiniteScrollHandler, { passive: true });
                this._infiniteBound = true;
                }
            }

            // flag στο wrapper (αν χρειάζεσαι CSS εφέ κατά το άνοιγμα)
            tom.wrapper.classList.add('open');

            hooks.onOpen?.(this);
        },

        onDropdownClose () {
            // αφαίρεση open flag
            tom.wrapper.classList.remove('open');

            // επαναφορά placeholder όπως ήταν πριν το open
            const ddInput = this.dropdown?.querySelector('.dropdown-input');
            if (ddInput && this._origDdPlaceholderSaved) {
                if (this._origDdPlaceholder) {
                ddInput.setAttribute('placeholder', this._origDdPlaceholder);
                } else {
                ddInput.removeAttribute('placeholder');
                }
            }
        },

        onFocus () {
            // ➜ αν φαίνεται σκουπιδάκι, «πάτα» το
            clickClearIfVisible(this);

            if (!this.ignoreFocusOpen) this.open();
        },

        onChange (vals) {
            if (!this.settings.mode.includes('multi') || !Array.isArray(vals)) return;
            const recs = vals.map(v=>this.options[v]);
            recs.sort((a,b)=>parseInt(a.label)-parseInt(b.label));
        }
    });

//     const preselectId = el.dataset.preselect;
//     const preselectValue = document.getElementById(preselectId)?.value;

// // --- Προεπιλογή από ΒΔ (respect valueField & credentials, με abort) ---
//     if (preselectValue && url) {
//     const urlObj = new URL(url, location.origin);
//     urlObj.searchParams.set('value', preselectValue);

//     // ➕ Πέρνα όλα τα extraParams στο URL (π.χ. padLength)
//     Object.entries(extraParams || {}).forEach(([k, v]) => {
//         if (v !== undefined && v !== null && v !== '') {
//         urlObj.searchParams.set(k, v);
//         }
//     });

//     try {
//         // ακύρωσε τυχόν προηγούμενο preselect request
//         try { this._preselectAbort?.abort(); } catch {}
//         this._preselectAbort = new AbortController();

//         fetch(urlObj.toString(), { credentials: 'include', signal: this._preselectAbort.signal })
//         .then(res => res.json())
//         .then(data => {
//             const item = data?.items?.[0]; // ή αναλόγως το format του API
//             if (!item) {
//             console.warn('⚠️ No matching item found in fetch for', preselectValue);
//             return;
//             }

//             const key = tom.settings.valueField || 'value';
//             const id  = item[key] ?? preselectValue;

//             tom.addOption(item);
//             tom.setValue(id, true);
//             selectedCache[id] = item;
//             requestAnimationFrame(() => updateOverflow(tom));
//             el.setAttribute('data-has-value', 'true');
//         })
//         .catch(err => {
//             if (err?.name !== 'AbortError') console.error('❌ Preselect fetch failed:', err);
//         });
//     } catch (err) {
//         if (err?.name !== 'AbortError') console.error('❌ Preselect fetch failed:', err);
//     }
//     }

    // --- Cache του επιλεγμένου option ώστε να μπορεί να «ξαναμπεί» αν λείπει ---
    tom.on('item_add', (value /* , $itemEl */) => {
    const key   = tom.settings.valueField || 'value';
    const rec   = tom.options?.[value];  // πιο αξιόπιστο από το 2ο arg του event
    const cacheId = rec?.[key] ?? value;

    if (rec) {
        selectedCache[cacheId] = rec;

        // ✅ Αν δεν υπάρχει στο options (π.χ. από προ-επιλογή), ξαναπέρασέ το
        if (!tom.options[cacheId]) {
        tom.addOption(rec);
        }
    } else {
        console.error('❌ item_add: cannot cache or re-add', value);
    }
    });

    /** ----------------------------------------------------------------
    *  Χειροποίητο infinite scroll
    * ----------------------------------------------------------------*/
    async function handleScroll (instance, content) {
    // Φρένο αν δεν υπάρχει επόμενη σελίδα ή ήδη φορτώνουμε
    if (!instance.nextPage || instance._loadingNext) return;

    // Trigger όταν πλησιάσουμε ~50px από το τέλος
    if (content.scrollTop + content.clientHeight < content.scrollHeight - 50) return;

    instance._loadingNext = true;

    const urlToFetch = instance.nextPage;
    const limit      = getLimitFromUrl(urlToFetch);

    try {
        const json  = await fetch(urlToFetch, { credentials: 'include' }).then(r => r.json());
        const items = Array.isArray(json.items) ? json.items : [];

        // hasMore: αν δίνεται ρητά, αλλιώς με βάση το limit
        const hasMore = ('hasMore' in json) ? Boolean(json.hasMore) : items.length === limit;
        instance.nextPage = hasMore ? buildNextPageUrl(urlToFetch) : null;

        // 1) θυμόμαστε scroll & ύψος ΠΡΙΝ την προσθήκη
        const prevScroll = content.scrollTop;
        const prevHeight = content.scrollHeight;

        // 2) προσθέτουμε options (dedupe με βάση valueField)
        const key = instance.settings.valueField || 'value';
        let newCount = 0;
        for (const it of items) {
        const id = it?.[key];
        if (id == null) continue;
        if (!instance.options[id]) {
            instance.addOption(it);
            newCount++;
        }
        }
        instance.refreshOptions(false);

        // Αν δεν προσθέσαμε τίποτα καινούργιο → τέλος infinite
        if (newCount === 0) {
        instance.nextPage = null;
        return;
        }

        // 3) επαναφέρουμε τη θέση 1-του-πριν (με ένα «μαξιλαράκι» ασφαλείας)
        requestAnimationFrame(() => {
        const newHeight = content.scrollHeight;
        const delta     = newHeight - prevHeight;
        const SAFE      = 500; // pixel από το τέλος
        content.scrollTop = prevScroll + delta - SAFE;
        });

    } catch (err) {
        console.error('❌ Dropdown next-page load failed', err);
    } finally {
        instance._loadingNext = false;
    }
    }

    /* --------------------------------------------------------------- */
    (window.__tomInstances ??= {})[selector] = tom;
}

const CLEAR_BTN_SELECTOR = '.ts-single-reset-btn';

function clickClearIfVisible(ts) {
  const btn = ts.wrapper.querySelector(CLEAR_BTN_SELECTOR);
  // ➜ offsetParent === null → το element είναι display:none ή hidden
  if (btn && btn.offsetParent !== null) {
    btn.click(); // πυροδοτεί το 'clear' + ό,τι handler έχουμε
  }
}

/* ------------------------------------------------------------------
 * updateOverflow – κοινός helper για όλα τα TomSelect instances
 *   ▸ multi-select :  +N indicator  +  reset (+ / −)
 *   ▸ single-select:  trash-clear  (🗑)  +  ellipsis σε μακρύ label
 * ------------------------------------------------------------------ */
function updateOverflow(tom) {
  // 1. Safety checks -------------------------------------------------
  if (!tom?.wrapper) return;

  const wrapper = tom.wrapper;               // .ts-wrapper
  const ctrl    = wrapper.querySelector('.ts-control');
  if (!ctrl) return;

  const isMulti = tom.settings.mode?.includes?.('multi');

  /* ==================================================================
  *  SINGLE-SELECT MODE                                               */
  /* ==================================================================*/
  if (!isMulti) {
    /* ----------------------------------------------------------------
    * A. Δημιουργία / update του trash-clear κουμπιού
    * ----------------------------------------------------------------*/
    let trash = wrapper.querySelector('.ts-single-reset-btn');
    if (!trash) {
      trash           = document.createElement('button');
      trash.type      = 'button';
      trash.className = 'ts-single-reset-btn ts-fill-reset-btn';
      trash.title     = 'Καθαρισμός επιλογής';
      trash.innerHTML = '<i class="bi bi-trash3"></i>'; // bootstrap-icons
      wrapper.appendChild(trash);

      // Click handler – clear & refresh
      trash.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!(tom.items || []).length) return;

        tom.ignoreFocusOpen = true;
        tom.clear();
        tom.close();
        tom.control_input.blur();
        tom.ignoreFocusOpen = false;

        setTimeout(() => tom?.wrapper && updateOverflow(tom), 0);
      });
    }

    // Εμφάνιση / απόκρυψη ανάλογα με επιλογή (χωρίς inline styles)
    trash.hidden = !(tom.items || []).length;

    // ✔ Μόλις γίνει ορατό, πάρε focus
    if (!trash.hidden) {
      trash.focus();
    }

    /* ----------------------------------------------------------------
    * B. Ellipsis στο label όταν είναι μακρύ (χωρίς inline styles)
    * ----------------------------------------------------------------*/
    const itemEl = ctrl.querySelector('.item');
    if (itemEl) itemEl.classList.add('ts-item-ellipsis');

    return; // single-select τελείωσε εδώ
  }

  /* ==================================================================
  *  MULTI-SELECT MODE                                                */
  /* =================================================================*/

  /* 2. resetBtn (+/−) — δημιουργείται ΠΑΝΤΑ μία φορά -----------------*/
  if (!ctrl.querySelector('.ts-fill-reset-btn')) {
    const resetBtn = document.createElement('button');
    resetBtn.className = 'ts-fill-reset-btn';
    resetBtn.type      = 'button';
    resetBtn.title     = 'Επιλογή όλων ή Καθαρισμός';
    resetBtn.innerHTML = '<i class="bi bi-plus-slash-minus"></i>';
    ctrl.appendChild(resetBtn);

    /* ⇄ toggle: αν υπάρχουν tags → clear, αλλιώς → επίλεξε ΟΛΑ χωρίς dropdown */
    resetBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      tom.ignoreFocusOpen = true; // stop auto-open

      try {
        const hasTags = (tom.items || []).length > 0;

        if (hasTags) {
          tom.clear();       // clear all
        } else {
          /* ▸▸ Επιλογή ΟΛΩΝ ------------------------------------------------*/
          let allValues = Object.values(tom.options).map(o => o.value);

          // αν είναι κενό (π.χ. remote) → fetch
          if (!allValues.length && typeof url !== 'undefined') {
            const finalUrl = new URL(url, window.location.origin);
            if (typeof extraParams === 'object') {
              Object.entries(extraParams).forEach(([k, v]) => v && finalUrl.searchParams.set(k, v));
            }
            try {
              const json = await fetch(finalUrl, { credentials: 'include' }).then(r => r.json());
              const allItems = json.items || [];
              tom.addOptions(allItems);
              allValues = allItems.map(i => i.value);
            } catch (err) {
              console.error('❌ resetBtn remote load failed', err);
            }
          }

          if (allValues.length) {
            tom.setValue([], true);          // redraw trick
            tom.setValue(allValues, true);
          }
        }
      } finally {
        tom.close();
        tom.control_input.blur();
        tom.ignoreFocusOpen = false;
        setTimeout(() => tom?.wrapper && updateOverflow(tom), 0);
      }
    });
  }

  /* 3. Υπολογισμός overflow -----------------------------------------*/
  const ARROW = 36, GAP = 28;
  const wrapW = wrapper.getBoundingClientRect().width;
  let avail   = wrapW - ARROW;
  let total   = 0;

  const items = [...ctrl.querySelectorAll('.item')].filter(i => !i.closest('.ts-overflow-popup'));

  // καθάρισμα προηγούμενων δεικτών
  ctrl.querySelector('.ts-overflow-indicator')?.remove();
  ctrl.querySelector('.ts-overflow-popup')?.remove();

  const hidden = [];
  for (let i = 0; i < items.length; i++) {
    const el = items[i];
    el.hidden = false; // δείξε το αρχικά
    const w = el.offsetWidth + (parseInt(getComputedStyle(el).marginRight) || 0) + GAP;
    if (total + w <= avail) {
      total += w;
    } else {
      hidden.push(el);
    }
  }
  hidden.forEach(el => (el.hidden = true));

  if (!hidden.length) return;   // early exit (resetBtn κρατήθηκε)

  /* 4. +N indicator & ταξινομημένο popup -----------------------------*/
  const dot = document.createElement('div');
  dot.className = 'ts-overflow-indicator';
  dot.tabIndex  = -1;
  dot.textContent = `+${hidden.length}`;
  dot.title       = `Πατήστε για εμφάνιση (${hidden.length} ακόμη)`;
  ctrl.appendChild(dot);

  dot.addEventListener('click', (e) => {  
    e.preventDefault();
    e.stopPropagation();

    tom.ignoreFocusOpen = true;
    tom.control_input.blur();

    setTimeout(() => {
      tom.ignoreFocusOpen = false;
      if (ctrl.querySelector('.ts-overflow-popup')) return;

      const popup = document.createElement('div');
      popup.className = 'ts-overflow-popup';

      const sorted = hidden.slice().sort((a, b) => {
        const extract = (el) => {
          const lbl = (tom.options[el.dataset.value]?.label || el.dataset.value).split('-')[0].trim();
          return lbl;
        };
        return extract(a).localeCompare(extract(b), undefined, { numeric: true, sensitivity: 'base' });
      });

      popup.innerHTML = sorted.map(el => {
        const v = el.dataset.value;
        const l = tom.options[v]?.label || v;
        return `<div class="ts-popup-row"><span>${l}</span><button data-val="${v}" title="Αφαίρεση"><i class="bi bi-trash3"></i></button></div>`;
      }).join('');

      // ➜ Προσαρτούμε ΣΤΟΝ WRAPPER (όχι στο body), ώστε το CSS absolute να δουλεύει χωρίς inline τοποθέτηση
      wrapper.appendChild(popup);

      // κουμπάκια αφαίρεσης μέσα στο popup
      popup.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          ctrl.querySelector(`.item[data-value="${btn.dataset.val}"] .remove`)?.click();
          popup.remove();
          updateOverflow(tom);
        });
      });

      // κλείσιμο popup όταν κλικάρει έξω ή ξαναπατήσει το +N
      document.addEventListener('click', function close(ev) {
        if (!popup.contains(ev.target) && ev.target !== dot) {
          popup.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 0);
  });
}

window.tomDropdownConfig = {
  setRender  : (id, r) => (globalRenderMap[id] = r),
  setHooks   : (id, h) => (globalHookMap[id]  = h),
  setTemplate: (id, t) => (templateCache[id]  = t)
};
